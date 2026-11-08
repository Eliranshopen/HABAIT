"""gain_probe.py - colour ratio of each node's skin to node-b's (or to the node it overlaps most) per bake group, outside Blender
(venv), from a bake cache: texels both nodes see well (vis > 0.9, cos > 0.3, the bake_skins.gain_stats rule), every 3rd texel,
level-0 bilinear lookup. Shows which group drives the bake's colour gains.  python -X utf8 -I gain_probe.py --baked <dir>"""
import argparse, json
import numpy as np, cv2

ap = argparse.ArgumentParser(); ap.add_argument("--baked", required=True); ap.add_argument("--groups", default="tower,podium,ground")
a = ap.parse_args()
meta = json.load(open(a.baked + "/bake_meta.json", encoding="utf8"))
nodes = meta["nodes"]
S2L = ((np.arange(256) / 255.0) ** 2.2).astype(np.float32)


def frame(nd):
    f = [x for x in json.load(open(a.baked + "/../../skins-extra/bake-nodes-v5.json", encoding="utf8"))["nodes"] if x["id"] == nd["id"]][0]
    m = json.load(open(f["faces"], encoding="utf8"))
    O = np.array(m["pos"], float); c = np.array(m["centre_look"], float) - O; c[2] = 0; c /= np.linalg.norm(c)
    return O, c, np.array([c[1], -c[0], 0.0])


img = {}
def sample(nd, d):
    if nd["id"] not in img:
        img[nd["id"]] = cv2.imread(nd["skin"])[..., ::-1]
    im = img[nd["id"]]; H, W = im.shape[:2]
    O, c, r = nd["_f"]
    u = 0.5 + np.arctan2(d @ r, d @ c) / (2 * np.pi); v = 0.5 - np.arcsin(np.clip(d[:, 2], -1, 1)) / np.pi
    x = (u * W).astype(int) % W; y = np.clip((v * H).astype(int), 0, H - 1)
    return S2L[im[y, x]]


for nd in nodes:
    nd["_f"] = frame(nd)
ref = [n for n in nodes if n["id"] == "node-b-tower"][0]
for g in a.groups.split(","):
    c = a.baked + "/_cache/"
    valid = np.load(c + f"{g}_valid.npy")[::3, ::3]
    P = np.load(c + f"{g}_pos.npy", mmap_mode="r")[::3, ::3][valid].astype(np.float32)
    N = np.load(c + f"{g}_nrm.npy", mmap_mode="r")[::3, ::3][valid].astype(np.float32)
    N /= np.maximum(np.linalg.norm(N, axis=1), 1e-6)[:, None]
    vis = {n["id"]: np.load(c + f"{g}_vis_{n['id']}.npy", mmap_mode="r")[::3, ::3][valid] for n in nodes}
    terms = {}
    for n in nodes:
        d = P - n["_f"][0].astype(np.float32); rr = np.linalg.norm(d, axis=1); d /= rr[:, None]
        terms[n["id"]] = (d, -(d * N).sum(1))
    good = {n["id"]: (vis[n["id"]] > 0.9) & (terms[n["id"]][1] > 0.3) for n in nodes}
    print(f"== {g}")
    for n in nodes:
        if n["id"] == ref["id"]:
            continue
        best = None
        for m in nodes:
            if m["id"] == n["id"]:
                continue
            both = good[n["id"]] & good[m["id"]]
            k = int(both.sum())
            if k >= 50 and (best is None or k > best[0] or m["id"] == ref["id"] and k >= 500):
                best = (k, m)
                if m["id"] == ref["id"] and k >= 500:
                    break
        out = f"  {n['id']:16s}"
        both = good[n["id"]] & good[ref["id"]]
        if both.sum() >= 50:
            cn = sample(n, terms[n["id"]][0][both]); cr = sample(ref, terms[ref["id"]][0][both])
            out += f" vs b: n {int(both.sum()):7d} ratio {np.round(np.median(cr, 0) / np.maximum(np.median(cn, 0), 1e-4), 2)}"
        if best and best[1]["id"] != ref["id"]:
            m = best[1]; both = good[n["id"]] & good[m["id"]]
            cn = sample(n, terms[n["id"]][0][both]); cm = sample(m, terms[m["id"]][0][both])
            out += f" | vs {m['id']}: n {best[0]:7d} ratio {np.round(np.median(cm, 0) / np.maximum(np.median(cn, 0), 1e-4), 2)}"
        print(out)

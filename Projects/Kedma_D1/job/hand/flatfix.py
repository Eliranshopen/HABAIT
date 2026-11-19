"""kedma-d1: straighten a part of a designed panorama that the image model drew bent (2026-11-16).

Why: the skin model draws a panorama (2:1 equirectangular). Edges of things close to the camera must be CURVES there; the model
tends to draw them as straight lines, so in the viewer (a straight-line view) they come out bent: the kitchen island's top, the
worktop line under the window and the window frame (Eliran: «הפרופורציות של האי ... נראה מוזר כאילו עקום»). The CG render of the
same camera is straight in the same view (review/kitchen-island-flat.jpg), so the fault is the picture, not the plan.

How: the fix is made in the viewer's own space.
  views  cut the SAME straight-line view out of the designed picture and out of the CG render (the true geometry)      ($0)
  (paid) one image-edit call redraws the designed view on the CG view's geometry (flatfix-call.mjs, ledgered)
  paste  the answer is projected back into the panorama with a feathered edge; every pixel outside the view stays     ($0)
The pasted picture is a new generated file with a v3 object-paste record (as tools/transplant.py writes), so band-lineage judges
its parent's chain; the fidelity gate must pass again on it.

usage: python flatfix.py views <apartment dir> <asset> <tag> --yaw Y --pitch P --hfov H [--size 1024]
       python flatfix.py paste <apartment dir> <asset> <tag> --answer <png> [--inset 20] [--feather 60] [--pick]
"""
import argparse
import json
import math
import os
import sys

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("cmd", choices=["views", "paste"])
ap.add_argument("apt"); ap.add_argument("asset"); ap.add_argument("tag")
ap.add_argument("--yaw", type=float); ap.add_argument("--pitch", type=float); ap.add_argument("--hfov", type=float)
ap.add_argument("--size", type=int, default=1024)
ap.add_argument("--answer"); ap.add_argument("--inset", type=int, default=20); ap.add_argument("--feather", type=int, default=60)
ap.add_argument("--pick", action="store_true")
# --box x0,y0,x1,y1 (fractions of the view): paste only this part of the answer, so a thing the answer redrew differently at the
# view's edge (a toilet, a console that goes on outside the view) keeps the parent's pixels; the feather runs inside the box
ap.add_argument("--box", default="0,0,1,1")
a = ap.parse_args()
GEN = os.path.join(a.apt, "_local", "generated")
OUT = os.path.join(a.apt, "_local", "flatfix", f"{a.asset}-{a.tag}")
os.makedirs(OUT, exist_ok=True)
picks_p = os.path.join(a.apt, "_local", "picks.json")
picks = json.load(open(picks_p, encoding="utf-8"))


def frame(yaw, pitch):
    y, p = math.radians(yaw), math.radians(pitch)
    F = np.array([math.cos(p) * math.sin(y), math.sin(p), math.cos(p) * math.cos(y)])
    R = np.array([math.cos(y), 0.0, -math.sin(y)])
    U = np.array([-math.sin(p) * math.sin(y), math.cos(p), -math.sin(p) * math.cos(y)])
    return F, R, U


def flat_from_pano(pano, yaw, pitch, hfov, S):
    """the straight-line view: pixel (i, j) looks along F + x R + y U; pano u 0.5 = yaw 0, v 0.5 = the horizon"""
    H, W = pano.shape[:2]
    F, R, U = frame(yaw, pitch)
    f = (S / 2) / math.tan(math.radians(hfov) / 2)
    i, j = np.meshgrid(np.arange(S) + 0.5, np.arange(S) + 0.5)
    x, y = (i - S / 2) / f, (S / 2 - j) / f
    d = F[None, None, :] + x[..., None] * R[None, None, :] + y[..., None] * U[None, None, :]
    d /= np.linalg.norm(d, axis=2, keepdims=True)
    psi, th = np.arctan2(d[..., 0], d[..., 2]), np.arcsin(np.clip(d[..., 1], -1, 1))
    mx = ((0.5 + psi / (2 * math.pi)) % 1.0) * W - 0.5
    my = (0.5 - th / math.pi) * H - 0.5
    return cv2.remap(pano, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_WRAP)


if a.cmd == "views":
    des_name = picks[a.asset]
    des = cv2.imread(os.path.join(GEN, des_name)); cg = cv2.imread(os.path.join(GEN, f"{a.asset}__cg__0.png"))
    if cg.shape != des.shape:
        cg = cv2.resize(cg, (des.shape[1], des.shape[0]), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(OUT, "designed.png"), flat_from_pano(des, a.yaw, a.pitch, a.hfov, a.size))
    cv2.imwrite(os.path.join(OUT, "cg.png"), flat_from_pano(cg, a.yaw, a.pitch, a.hfov, a.size))
    json.dump({"asset": a.asset, "tag": a.tag, "parent": des_name, "yaw": a.yaw, "pitch": a.pitch, "hfov": a.hfov, "size": a.size},
              open(os.path.join(OUT, "params.json"), "w", encoding="utf-8"), indent=1)
    print("views ->", OUT, "parent", des_name)
    sys.exit(0)

P = json.load(open(os.path.join(OUT, "params.json"), encoding="utf-8"))
parent = cv2.imread(os.path.join(GEN, P["parent"]))
ans = cv2.imread(a.answer)
S = P["size"]
if ans.shape[0] != S or ans.shape[1] != S:
    ans = cv2.resize(ans, (S, S), interpolation=cv2.INTER_AREA)
H, W = parent.shape[:2]
F, R, U = frame(P["yaw"], P["pitch"])
f = (S / 2) / math.tan(math.radians(P["hfov"]) / 2)
uu, vv = np.meshgrid((np.arange(W) + 0.5) / W, (np.arange(H) + 0.5) / H)
psi, th = (uu - 0.5) * 2 * math.pi, (0.5 - vv) * math.pi
d = np.stack([np.cos(th) * np.sin(psi), np.sin(th), np.cos(th) * np.cos(psi)], axis=2)
along = d @ F
ok = along > 1e-6
x = np.where(ok, (d @ R) / np.where(ok, along, 1), 0); y = np.where(ok, (d @ U) / np.where(ok, along, 1), 0)
fi, fj = x * f + S / 2 - 0.5, S / 2 - y * f - 0.5
inside = ok & (fi >= 0) & (fi <= S - 1) & (fj >= 0) & (fj <= S - 1)
samp = cv2.remap(ans, fi.astype(np.float32), fj.astype(np.float32), cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
bx0, by0, bx1, by1 = [float(t) for t in a.box.split(",")]
edge = np.minimum(np.minimum(fi - bx0 * (S - 1), bx1 * (S - 1) - fi), np.minimum(fj - by0 * (S - 1), by1 * (S - 1) - fj))  # px from the box's border, in view pixels
w = np.clip((edge - a.inset) / max(1, a.feather), 0, 1); w = w * w * (3 - 2 * w); w = np.where(inside, w, 0)[..., None]
res = (parent.astype(np.float32) * (1 - w) + samp.astype(np.float32) * w).round().clip(0, 255).astype(np.uint8)
name = f"{a.asset}__flat__{a.tag}.png"
cv2.imwrite(os.path.join(GEN, name), res)
ys, xs = np.where(w[..., 0] > 0.01)
side = {"version": 3, "kind": "object-paste", "parent": P["parent"],
        "object_paste": {"from": f"_local/flatfix/{a.asset}-{a.tag}/" + os.path.basename(a.answer), "tool": "jobs/kedma-d1/hand/flatfix.py",
                         "args": f"view yaw {P['yaw']} pitch {P['pitch']} hfov {P['hfov']} size {S}, inset {a.inset}, feather {a.feather}, box {a.box}",
                         "box": [int(xs.min()), int(ys.min()), int(xs.max() - xs.min()), int(ys.max() - ys.min())],
                         "why": "the image model drew near things straight in the panorama, so they were bent in the viewer; the view was redrawn on the CG render's geometry and projected back"},
        "band": {"u": round(0.5 + P["yaw"] / 360, 4), "deg": P["hfov"], "rows": [round(float(ys.min()) / H, 4), round(float(ys.max()) / H, 4)]},
        "cuts": [], "note": "no band cut: a straight-line view of the same camera, feathered; checked by eye"}
json.dump(side, open(os.path.join(GEN, name[:-4] + ".seam.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
if a.pick:
    picks[a.asset] = name; json.dump(picks, open(picks_p, "w", encoding="utf-8"), indent=1)
print(json.dumps({"out": name, "parent": P["parent"], "changed_px": int((w[..., 0] > 0.01).sum()), "picked": bool(a.pick)}))

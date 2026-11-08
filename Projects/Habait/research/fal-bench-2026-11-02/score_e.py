"""score_e.py - exterior 360 node skins: geometry retention, wrap seam, poles, by-class retention (id pass).

  python -X utf8 -I score_e.py <node>      reads inputs/E_<node>_clay.png (+ inputs/E_<node>_id.png if present), E-exterior-pano/<node>/*.png

Per output: edges kept (upper half = sky/tower tops, lower half = ground/sea), by class from the id pass (1 walls, 2 glazing,
3 doors, 4 furniture, 5 site, 6 terrain), wrap seam = mean abs diff of the 8 left vs 8 right columns (source value given for
scale; the C test: source 11, GPT 10.7, Seedream 20.7 = visibly broken), pole smear = edge density in the top/bottom 6 %.
Writes scores-E-<node>.json, review/E_<node>_sheet.jpg (all outputs), review/E_<node>_seam.jpg (wrap joints side by side).
"""
import glob
import json
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
node = sys.argv[1]
src = cv2.imread(f"{HERE}/inputs/E_{node}_clay.png")
idp = f"{HERE}/inputs/E_{node}_id.png"
ids = cv2.imread(idp, cv2.IMREAD_UNCHANGED) if os.path.exists(idp) else None
if ids is not None and ids.ndim == 3:
    ids = ids[:, :, 0]
W, H = 2048, 1024
src = cv2.resize(src, (W, H), interpolation=cv2.INTER_AREA)
if ids is not None:
    ids = cv2.resize(ids, (W, H), interpolation=cv2.INTER_NEAREST)
CLASSES = {1: "walls", 2: "glazing", 3: "doors", 4: "furniture", 5: "site", 6: "terrain"}
K = np.ones((7, 7), np.uint8)
e = lambda im: cv2.Canny(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), 60, 160)  # noqa: E731


def kept(es, eo, mask=None):
    m = (es > 0) if mask is None else ((es > 0) & mask)
    return round(float((m & (cv2.dilate(eo, K) > 0)).sum()) / max(1, float(m.sum())), 3)


def seam(im):
    a = im.astype(np.float32)
    return round(float(np.abs(a[:, :8] - a[:, -8:]).mean()), 1)


def pole(es):
    h = es.shape[0]
    band = int(h * 0.06)
    return round(float((es[:band] > 0).mean() + (es[-band:] > 0).mean()) / 2, 4)


es = e(src)
led = {}
lp = f"{HERE}/ledger-E.json"
if os.path.exists(lp):
    for r in json.load(open(lp, encoding="utf-8")):
        if not r.get("error"):
            led[os.path.basename(r["out"])[:-4]] = {"usd": r.get("usd"), "secs": r.get("secs")}
res = {"SOURCE": {"seam": seam(src), "pole_edge_density": pole(es)}}
tiles = [src.copy()]
cv2.putText(tiles[0], "CLAY source", (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 3)
joints = []


def joint(im, t):
    j = np.hstack([im[:, -200:], im[:, :200]])
    j = cv2.resize(j, (400, 1024))
    cv2.rectangle(j, (0, 0), (400, 36), (0, 0, 0), -1)
    cv2.putText(j, t[:18], (6, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    return j


joints.append(joint(src, "SOURCE"))
for p in sorted(glob.glob(f"{HERE}/E-exterior-pano/{node}/*.png")):
    name = os.path.basename(p)[:-4]
    out = cv2.imread(p)
    size = [out.shape[1], out.shape[0]]
    o = cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA)
    eo = e(o)
    row = {"size": size, "edges_kept_upper": kept(es[:H // 2], eo[:H // 2]), "edges_kept_lower": kept(es[H // 2:], eo[H // 2:]),
           "seam": seam(o), "pole_edge_density": pole(eo), **led.get(name, {})}
    if ids is not None:
        row["by_class"] = {CLASSES[c]: kept(es, eo, ids == c) for c in CLASSES if (ids == c).sum() > 2000}
    res[name] = row
    t = o.copy()
    cv2.rectangle(t, (0, 0), (W, 50), (0, 0, 0), -1)
    cv2.putText(t, f"{name}  kept {row['edges_kept_upper']:.2f}/{row['edges_kept_lower']:.2f}  seam {row['seam']}  ${row.get('usd')}", (10, 38),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 2)
    tiles.append(t)
    joints.append(joint(o, name))
json.dump(res, open(f"{HERE}/scores-E-{node}.json", "w", encoding="utf-8"), indent=1)
os.makedirs(f"{HERE}/review", exist_ok=True)
cols = 2
rows = [np.hstack(tiles[i:i + cols]) if len(tiles[i:i + cols]) == cols else np.hstack(tiles[i:i + cols] + [np.zeros_like(tiles[0])])
        for i in range(0, len(tiles), cols)]
cv2.imwrite(f"{HERE}/review/E_{node}_sheet.jpg", cv2.resize(np.vstack(rows), None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA),
            [cv2.IMWRITE_JPEG_QUALITY, 84])
cv2.imwrite(f"{HERE}/review/E_{node}_seam.jpg", np.hstack(joints), [cv2.IMWRITE_JPEG_QUALITY, 88])
for k, v in res.items():
    print(k, json.dumps(v))

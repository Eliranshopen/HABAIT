"""Step 03 - fit the scale from the printed overall dimensions and read wall edges to the half pixel.

The overall dimension lines (830, 725, 105, 1050, 540, 510, 50, 780) are thin dark lines with end ticks.
Wall edges are read on a mask thresholded at the midpoint between the wall grey (188) and white (252).
Writes work/edges.json.
Usage: python 03_scale_and_edges.py <job root>
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

root = Path(sys.argv[1])
work = root / "work"
img = cv2.imdecode(np.fromfile(str(root / "input" / "plan-hatzav-colour.png"), dtype=np.uint8), cv2.IMREAD_COLOR)
rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(int)
gray = rgb.mean(axis=2)
H, W = gray.shape


def dark_runs(line, thr=170, min_len=30):
    runs, start = [], None
    for i, v in enumerate(line):
        if v < thr and start is None:
            start = i
        elif v >= thr and start is not None:
            if i - start >= min_len:
                runs.append((start, i - 1))
            start = None
    if start is not None and len(line) - start >= min_len:
        runs.append((start, len(line) - 1))
    return runs


print("== horizontal dimension lines (row: runs) ==")
for y in range(150, 230):
    r = dark_runs(gray[y, 400:1400], 190, 60)
    if r:
        print(y, [(a + 400, b + 400, b - a + 1) for a, b in r])
for y in range(1430, 1510):
    r = dark_runs(gray[y, 400:1400], 190, 30)
    if r:
        print(y, [(a + 400, b + 400, b - a + 1) for a, b in r])
print("== vertical dimension lines (col: runs) ==")
for x in range(330, 400):
    r = dark_runs(gray[200:1400, x], 190, 60)
    if r:
        print(x, [(a + 200, b + 200, b - a + 1) for a, b in r])

# refined wall mask
r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
mx, mn = np.maximum(np.maximum(r_, g_), b_), np.minimum(np.minimum(r_, g_), b_)
m = (((mx - mn) <= 10) & (mx >= 150) & (mx <= 220)).astype(np.uint8) * 255
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
cv2.imencode(".png", m)[1].tofile(str(work / "wall-mask-220.png"))
cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
out = []
print("== refined wall polygons ==")
for i, c in enumerate(cnts):
    a = cv2.contourArea(c)
    if a < 120:
        continue
    ap = cv2.approxPolyDP(c, 1.2, True).reshape(-1, 2).tolist()
    out.append({"area": a, "hole": bool(hier[0][i][3] != -1), "pts": ap})
    print(int(a), ap)
(work / "edges.json").write_text(json.dumps(out, indent=1), encoding="utf-8")

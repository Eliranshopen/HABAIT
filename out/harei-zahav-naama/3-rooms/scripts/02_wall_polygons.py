"""Step 02 - vectorise the wall mask into rectilinear polygons and cut zoomed crops for reading.

Writes work/wall-polygons.json, work/crop-*.png (2.5x, with a 50 px grid in plan pixels).
Usage: python 02_wall_polygons.py <job root>
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

root = Path(sys.argv[1])
work = root / "work"
img = cv2.imdecode(np.fromfile(str(root / "input" / "plan-hatzav-colour.png"), dtype=np.uint8), cv2.IMREAD_COLOR)
mask = cv2.imdecode(np.fromfile(str(work / "wall-mask.png"), dtype=np.uint8), cv2.IMREAD_GRAYSCALE)

cnts, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
polys = []
for i, c in enumerate(cnts):
    if cv2.contourArea(c) < 150:
        continue
    ap = cv2.approxPolyDP(c, 1.6, True).reshape(-1, 2)
    polys.append({"hole": bool(hier[0][i][3] != -1), "area": float(cv2.contourArea(c)), "pts": ap.tolist()})
polys.sort(key=lambda p: -p["area"])
(work / "wall-polygons.json").write_text(json.dumps(polys, indent=1), encoding="utf-8")
for p in polys:
    print("hole" if p["hole"] else "wall", int(p["area"]), len(p["pts"]), p["pts"])

# zoomed crops with a grid
crops = {
    "nw": (440, 230, 900, 840),
    "ne": (780, 230, 1340, 760),
    "sw": (440, 760, 940, 1360),
    "se": (860, 680, 1660, 1360),
}
Z = 2.5
for name, (x0, y0, x1, y1) in crops.items():
    c = img[y0:y1, x0:x1]
    c = cv2.resize(c, None, fx=Z, fy=Z, interpolation=cv2.INTER_CUBIC)
    for gx in range((x0 // 50 + 1) * 50, x1, 50):
        X = int((gx - x0) * Z)
        cv2.line(c, (X, 0), (X, c.shape[0]), (255, 170, 60), 1)
        cv2.putText(c, str(gx), (X + 2, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 60, 0), 1)
    for gy in range((y0 // 50 + 1) * 50, y1, 50):
        Y = int((gy - y0) * Z)
        cv2.line(c, (0, Y), (c.shape[1], Y), (255, 170, 60), 1)
        cv2.putText(c, str(gy), (2, Y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 60, 0), 1)
    cv2.imencode(".png", c)[1].tofile(str(work / f"crop-{name}.png"))
    print("crop", name, c.shape)

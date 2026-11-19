"""Step 01 - probe the colour plan: wall colour, wall mask, connected wall groups, axis-aligned runs.

Read-only on the input. Writes work/wall-mask.png and work/probe.json.
Usage: python 01_probe_plan.py <job root>
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

root = Path(sys.argv[1])
src = root / "input" / "plan-hatzav-colour.png"
work = root / "work"
work.mkdir(exist_ok=True)

img = cv2.imdecode(np.fromfile(str(src), dtype=np.uint8), cv2.IMREAD_COLOR)
h, w = img.shape[:2]
rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

# 1. the most common colours (the wall fill is a flat grey)
q = (rgb // 4) * 4
cols, counts = np.unique(q.reshape(-1, 3), axis=0, return_counts=True)
order = np.argsort(-counts)[:14]
top = [{"rgb": cols[i].tolist(), "share": round(float(counts[i]) / (h * w), 4)} for i in order]

# 2. wall mask: neutral grey, mid brightness
r, g, b = [rgb[..., i].astype(int) for i in range(3)]
mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
grey = ((mx - mn) <= 10) & (mx >= 160) & (mx <= 200)
mask = (grey * 255).astype(np.uint8)
# remove thin grey lines (furniture outlines are 1-3 px), keep filled walls (>= 9 px)
k = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k)
cv2.imencode(".png", opened)[1].tofile(str(work / "wall-mask.png"))

n, lab, stats, _ = cv2.connectedComponentsWithStats(opened, 8)
groups = []
for i in range(1, n):
    x, y, ww, hh, area = stats[i]
    if area < 150:
        continue
    groups.append({"id": i, "x0": int(x), "y0": int(y), "x1": int(x + ww), "y1": int(y + hh), "area": int(area)})
groups.sort(key=lambda d: -d["area"])

out = {"size": [w, h], "top_colours": top, "wall_groups": groups}
(work / "probe.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
print("size", w, h)
for t in top:
    print("colour", t)
print("wall groups", len(groups))
for gr in groups:
    print(gr)

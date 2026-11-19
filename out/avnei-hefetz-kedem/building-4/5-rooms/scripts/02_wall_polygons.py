"""Step 02 ($0) - the wall fill as clean axis-aligned polygons (native px) + the list of gaps between wall ends.

Usage: python 02_wall_polygons.py <job root>
Reads  work/wall-mask-raw.png (step 01)
Writes work/wall-mask.png (furniture false-positives removed), work/wall-polygons.json, work/wall-rects.txt

A wall component is kept when it is large (area >= 20000 px) or thin-and-long like a wall stub. Blobs inside furniture
(chair seats, the bed cover, the sink bowls) have the wall grey but are small and compact: dropped, and listed.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

root = Path(sys.argv[1])
m = cv2.imdecode(np.fromfile(str(root / "work" / "wall-mask-raw.png"), dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
# the drawing is left of x=3700; the key plan on the right has no wall-grey fill but be explicit
m[:, 3700:] = 0
n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
keep = np.zeros_like(m)
kept, dropped = [], []
for i in range(1, n):
    x, y, w, h, a = [int(v) for v in stats[i]]
    fill = a / float(w * h)
    is_wall = a >= 20000 or (a >= 1500 and (min(w, h) <= 70 and max(w, h) >= 90) and fill > 0.8)
    (kept if is_wall else dropped).append({"bbox": [x, y, w, h], "area": a, "fill": round(fill, 2)})
    if is_wall:
        keep[lab == i] = 255
print("kept", len(kept), "dropped", len(dropped))
for d in dropped:
    print("  dropped", d)
cv2.imencode(".png", keep)[1].tofile(str(root / "work" / "wall-mask.png"))

cs, _ = cv2.findContours(keep, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
polys = []
lines = []
for c in sorted(cs, key=lambda c: (cv2.boundingRect(c)[1], cv2.boundingRect(c)[0])):
    p = cv2.approxPolyDP(c, 3, True).reshape(-1, 2).tolist()
    x, y, w, h = cv2.boundingRect(c)
    polys.append(p)
    lines.append(f"bbox x{x}-{x+w} y{y}-{y+h} n={len(p)}: " + " ".join(f"{a},{b}" for a, b in p))
(root / "work" / "wall-polygons.json").write_text(json.dumps(polys), encoding="utf-8")
(root / "work" / "wall-rects.txt").write_text("\n".join(lines), encoding="utf-8")
print("\n".join(lines))

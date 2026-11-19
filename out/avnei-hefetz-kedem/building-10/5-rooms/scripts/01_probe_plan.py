"""Step 01 ($0) - probe the verified sales-plan sheet: size, the wall fill colour, the plan's bounding box.

Usage: python 01_probe_plan.py <job root>
Reads  input/b10-floor1-apts-3-4.jpg (read-only copy of the original, sha256 in work/source-sha256.txt)
Writes work/probe.json, work/wall-mask.png (native px), work/plan-crop.png (the drawing alone)
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

root = Path(sys.argv[1])
src = root / "input" / "b10-floor1-apts-3-4.jpg"
img = cv2.imdecode(np.fromfile(str(src), dtype=np.uint8), cv2.IMREAD_COLOR)
h, w = img.shape[:2]
b, g, r = [img[:, :, i].astype(np.int16) for i in range(3)]
mx = np.maximum(np.maximum(r, g), b)
mn = np.minimum(np.minimum(r, g), b)
sat = mx - mn
grey = (r + g + b) // 3

# histogram of neutral (unsaturated) pixels by grey level: the wall fill is the dark neutral peak
neutral = sat <= 12
hist = np.bincount(grey[neutral].ravel(), minlength=256)
dark = hist[40:140]
peak = int(40 + dark.argmax())
print("image", w, "x", h)
print("neutral dark peak (wall fill candidate): grey", peak, "count", int(hist[peak]))
print("top neutral levels 40..140:", sorted(((int(hist[i]), i) for i in range(40, 140)), reverse=True)[:8])

lo, hi = peak - 14, peak + 14
mask = (neutral & (grey >= lo) & (grey <= hi)).astype(np.uint8) * 255
# open by 9 px: removes text strokes, furniture outlines and thin hatch lines, keeps wall bodies
k = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k)
# the plan drawing is the left part of the sheet; the key plan and the title are on the right
n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
comps = sorted(((int(stats[i, 4]), i) for i in range(1, n)), reverse=True)
print("components:", len(comps), "largest:", [(a, tuple(int(v) for v in stats[i, :4])) for a, i in comps[:12]])
cv2.imencode(".png", mask)[1].tofile(str(root / "work" / "wall-mask-raw.png"))

probe = {"image": [w, h], "wall_grey_peak": peak, "range": [lo, hi],
         "components": [{"area": a, "bbox": [int(v) for v in stats[i, :4]]} for a, i in comps[:40]]}
(root / "work" / "probe.json").write_text(json.dumps(probe, indent=1), encoding="utf-8")

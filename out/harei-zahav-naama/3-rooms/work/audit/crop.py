"""Audit helper: cut a zoomed crop of the sheet with a labelled grid (sheet pixels).
usage: crop.py name x0 y0 x1 y1 [scale] [grid]
"""
import sys
from pathlib import Path
import cv2
import numpy as np

here = Path(__file__).resolve().parent
root = here.parent.parent
src = root / "input" / (sys.argv[8] if len(sys.argv) > 8 else "plan-hatzav-colour.png")
img = cv2.imdecode(np.fromfile(str(src), dtype=np.uint8), cv2.IMREAD_COLOR)
name = sys.argv[1]
x0, y0, x1, y1 = map(int, sys.argv[2:6])
s = int(sys.argv[6]) if len(sys.argv) > 6 else 4
g = int(sys.argv[7]) if len(sys.argv) > 7 else 10
c = img[y0:y1, x0:x1]
c = cv2.resize(c, None, fx=s, fy=s, interpolation=cv2.INTER_NEAREST)
pad = 34
out = np.full((c.shape[0] + pad, c.shape[1] + pad, 3), 255, np.uint8)
out[pad:, pad:] = c
first_x = (x0 + g - 1) // g * g
for x in range(first_x, x1 + 1, g):
    cx = pad + (x - x0) * s
    major = x % (g * 5) == 0
    cv2.line(out, (cx, pad), (cx, out.shape[0] - 1), (255, 120, 0) if major else (255, 200, 150), 1)
    if major or s >= 6:
        cv2.putText(out, str(x), (cx - 12, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (200, 0, 0), 1, cv2.LINE_AA)
first_y = (y0 + g - 1) // g * g
for y in range(first_y, y1 + 1, g):
    cy = pad + (y - y0) * s
    major = y % (g * 5) == 0
    cv2.line(out, (pad, cy), (out.shape[1] - 1, cy), (255, 120, 0) if major else (255, 200, 150), 1)
    if major or s >= 6:
        cv2.putText(out, str(y), (1, cy + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (200, 0, 0), 1, cv2.LINE_AA)
ok, buf = cv2.imencode(".png", out)
buf.tofile(str(here / f"{name}.png"))
print(name, out.shape)

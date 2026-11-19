"""Gridded zoom crops of the sales-plan sheet ($0): positions are read by number, not by eye.

Usage: python zoom.py <job root> <name> <x0> <y0> <x1> <y1> [grid_px=100] [out_long_side=1600]
Writes work/zoom-<name>.jpg with a labelled grid in NATIVE sheet pixels.
"""
import sys
from pathlib import Path

import cv2
import numpy as np

root = Path(sys.argv[1])
name = sys.argv[2]
x0, y0, x1, y1 = [int(v) for v in sys.argv[3:7]]
grid = int(sys.argv[7]) if len(sys.argv) > 7 else 100
long_side = int(sys.argv[8]) if len(sys.argv) > 8 else 1600
img = cv2.imdecode(np.fromfile(str(root / "input" / "b10-floor1-apts-3-4.jpg"), dtype=np.uint8), cv2.IMREAD_COLOR)
crop = img[y0:y1, x0:x1].copy()
s = long_side / max(crop.shape[:2])
crop = cv2.resize(crop, None, fx=s, fy=s, interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
for gx in range((x0 // grid + 1) * grid, x1, grid):
    px = int(round((gx - x0) * s))
    cv2.line(crop, (px, 0), (px, crop.shape[0]), (255, 0, 255), 1)
    cv2.putText(crop, str(gx), (px + 2, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 0, 200), 1, cv2.LINE_AA)
for gy in range((y0 // grid + 1) * grid, y1, grid):
    py = int(round((gy - y0) * s))
    cv2.line(crop, (0, py), (crop.shape[1], py), (255, 160, 0), 1)
    cv2.putText(crop, str(gy), (2, py - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 110, 0), 1, cv2.LINE_AA)
cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tofile(str(root / "work" / f"zoom-{name}.jpg"))
print(name, crop.shape, "scale", round(s, 3))

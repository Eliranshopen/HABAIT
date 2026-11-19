"""Audit helper: print a grey-level profile along a row or a column of the sheet, as runs.
usage: prof.py row y x0 x1   |   prof.py col x y0 y1
Runs are classed: W white(>=245) G wall grey(170-215) D dark line(<170) L light(215-245) ; also prints BGR of the run middle.
"""
import sys
from pathlib import Path
import cv2
import numpy as np

here = Path(__file__).resolve().parent
root = here.parent.parent
img = cv2.imdecode(np.fromfile(str(root / "input" / "plan-hatzav-colour.png"), dtype=np.uint8), cv2.IMREAD_COLOR)
mode, a, b, c = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
if mode == "row":
    line = img[a, b:c]
else:
    line = img[b:c, a]
grey = line.astype(int).mean(axis=1)
sat = line.astype(int).max(axis=1) - line.astype(int).min(axis=1)

def cls(v, s):
    if s > 12:
        return "C"  # coloured (garden green / deck)
    if v >= 245:
        return "W"
    if v >= 215:
        return "L"
    if v >= 170:
        return "G"
    return "D"

runs = []
start = 0
cur = cls(grey[0], sat[0])
for i in range(1, len(grey)):
    k = cls(grey[i], sat[i])
    if k != cur:
        runs.append((cur, b + start, b + i - 1))
        start, cur = i, k
runs.append((cur, b + start, b + len(grey) - 1))
print(mode, a, "from", b, "to", c)
for k, s, e in runs:
    mid = (s + e) // 2 - b
    print(f"  {k} {s}-{e} (len {e - s + 1}) bgr={tuple(int(v) for v in line[mid])}")

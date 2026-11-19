"""Audit helper: plain crop of any input image, optional scale. usage: rcrop.py file name x0 y0 x1 y1 [scale]"""
import sys
from pathlib import Path
import cv2
import numpy as np
here = Path(__file__).resolve().parent
root = here.parent.parent
img = cv2.imdecode(np.fromfile(str(root / "input" / sys.argv[1]), dtype=np.uint8), cv2.IMREAD_COLOR)
print("size", img.shape)
x0, y0, x1, y1 = map(int, sys.argv[3:7])
s = float(sys.argv[7]) if len(sys.argv) > 7 else 1.0
c = img[y0:y1, x0:x1]
if s != 1.0:
    c = cv2.resize(c, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC if s > 1 else cv2.INTER_AREA)
ok, buf = cv2.imencode(".png", c)
buf.tofile(str(here / f"{sys.argv[2]}.png"))
print(sys.argv[2], c.shape)

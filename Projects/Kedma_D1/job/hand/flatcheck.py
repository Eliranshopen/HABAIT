"""kedma-d1 QA ($0): one picture for the eye before and after a flat-view fix (hand/flatfix.py).

before (no --answer): designed view | CG view | the designed view with the CG view's edges drawn on it in red
after  (--answer):    designed view | the answer | the answer with the CG view's edges drawn on it in red
A straight edge of the plan (the red lines) must lie on the same edge of the picture.

usage: python flatcheck.py <apartment dir> <asset> <tag> <out.jpg> [--answer <png>]
"""
import argparse
import os

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("apt"); ap.add_argument("asset"); ap.add_argument("tag"); ap.add_argument("out")
ap.add_argument("--answer")
a = ap.parse_args()
D = os.path.join(a.apt, "_local", "flatfix", f"{a.asset}-{a.tag}")
des = cv2.imread(os.path.join(D, "designed.png" if os.path.exists(os.path.join(D, "designed.png")) else "in.png")); cg = cv2.imread(os.path.join(D, "cg.png"))   # a redo view (hand/room_paint.py) has in.png: what the model was given
S = des.shape[0]
mid = cg
if a.answer:
    mid = cv2.imread(a.answer)
    if mid.shape[0] != S or mid.shape[1] != S:
        mid = cv2.resize(mid, (S, S), interpolation=cv2.INTER_AREA)
base = mid if a.answer else des
edges = cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(cg, cv2.COLOR_BGR2GRAY), (5, 5), 0), 30, 90)
edges = cv2.dilate(edges, np.ones((2, 2), np.uint8))
over = base.copy(); over[edges > 0] = (0, 0, 255)
T = 680
tiles = [cv2.resize(t, (T, T), interpolation=cv2.INTER_AREA) for t in (des, mid, over)]
gap = np.full((T, 8, 3), 255, np.uint8)
cv2.imwrite(a.out, np.hstack([tiles[0], gap, tiles[1], gap, tiles[2]]), [cv2.IMWRITE_JPEG_QUALITY, 88])
print("wrote", a.out)

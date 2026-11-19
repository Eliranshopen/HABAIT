"""kedma-d1 QA ($0): the picture a rectilinear viewer must give for one panorama file at a yaw, a pitch and a HORIZONTAL field of
view, at the browser's own window size, next to the browser's screenshot of the same state.

Why (2026-11-17): the bath's laundry window was straight in the 900x600 check view cut from the pick, and arched and about twice as
large in the browser, although the viewer reported the same file (same SHA-256), yaw 5, pitch -2 and hfov 93.8. Two pictures of one
file at the same numbers cannot differ, so one of the two is not drawing what its numbers say. This draws the reference with the
projection written out (no helper, the field of view on the horizontal axis) so the two can be compared edge for edge.

usage: python browser_view.py <panorama file> <yaw> <pitch> <hfov> <browser screenshot png> <out.jpg> [--w 1920 --h 1080]
"""
import argparse
import math

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("pano"); ap.add_argument("yaw", type=float); ap.add_argument("pitch", type=float); ap.add_argument("hfov", type=float)
ap.add_argument("shot"); ap.add_argument("out")
ap.add_argument("--w", type=int, default=1920); ap.add_argument("--h", type=int, default=1080)
a = ap.parse_args()
pano = cv2.imread(a.pano)
PH, PW = pano.shape[:2]
W, H = a.w, a.h
y, p = math.radians(a.yaw), math.radians(a.pitch)
F = np.array([math.cos(p) * math.sin(y), math.sin(p), math.cos(p) * math.cos(y)])
R = np.array([math.cos(y), 0.0, -math.sin(y)])
U = np.array([-math.sin(p) * math.sin(y), math.cos(p), -math.sin(p) * math.cos(y)])
f = (W / 2) / math.tan(math.radians(a.hfov) / 2)             # the field of view is across the WIDTH
i, j = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
d = F[None, None, :] + ((i - W / 2) / f)[..., None] * R[None, None, :] + ((H / 2 - j) / f)[..., None] * U[None, None, :]
d /= np.linalg.norm(d, axis=2, keepdims=True)
psi, th = np.arctan2(d[..., 0], d[..., 2]), np.arcsin(np.clip(d[..., 1], -1, 1))
mx = ((0.5 + psi / (2 * math.pi)) % 1.0) * PW - 0.5
my = (0.5 - th / math.pi) * PH - 0.5
ref = cv2.remap(pano, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_WRAP)
shot = cv2.imread(a.shot)
if shot.shape[:2] != (H, W):
    shot = cv2.resize(shot, (W, H), interpolation=cv2.INTER_AREA)
# the same grid on both, so an edge can be read off by its position
for im in (ref, shot):
    for gx in range(0, W, W // 8):
        cv2.line(im, (gx, 0), (gx, H - 1), (0, 0, 255), 1)
    for gy in range(0, H, H // 6):
        cv2.line(im, (0, gy), (W - 1, gy), (255, 0, 0), 1)
T = (960, 540)
cv2.imwrite(a.out, np.hstack([cv2.resize(ref, T, interpolation=cv2.INTER_AREA), np.full((T[1], 8, 3), 255, np.uint8), cv2.resize(shot, T, interpolation=cv2.INTER_AREA)]),
            [cv2.IMWRITE_JPEG_QUALITY, 90])
print("wrote", a.out, "| reference left (rectilinear, hfov across the width), browser right | focal px", round(f, 1), "| vfov", round(2 * math.degrees(math.atan((H / 2) / f)), 1))

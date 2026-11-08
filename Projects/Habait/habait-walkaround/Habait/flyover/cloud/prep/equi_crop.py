"""Perspective crop from an equirect pano (free, local).
yaw_deg: bearing offset from the pano centre column (+ = right/clockwise), pitch_deg: + = up.
Usage: python -I equi_crop.py <equi.png> <out.png> --yaw -2.6 --pitch -16 --hfov 65 --size 1280x720
"""
import argparse, numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("equi"); ap.add_argument("out")
ap.add_argument("--yaw", type=float, default=0.0); ap.add_argument("--pitch", type=float, default=0.0)
ap.add_argument("--hfov", type=float, default=65.0); ap.add_argument("--size", default="1280x720")
a = ap.parse_args()
W, H = map(int, a.size.split("x"))
E = np.asarray(Image.open(a.equi).convert("RGB"), dtype=np.float32)
eh, ew = E.shape[:2]
f = (W / 2) / np.tan(np.radians(a.hfov) / 2)
xs, ys = np.meshgrid(np.arange(W) - W / 2 + 0.5, np.arange(H) - H / 2 + 0.5)
# camera frame: x right, y down, z forward
d = np.stack([xs, ys, np.full_like(xs, f)], -1)
d /= np.linalg.norm(d, axis=-1, keepdims=True)
p, y = -np.radians(a.pitch), np.radians(a.yaw)  # camera y is down: looking up = negative y
# pitch about x (positive = look up -> y component decreases)
Rx = np.array([[1, 0, 0], [0, np.cos(p), np.sin(p)], [0, -np.sin(p), np.cos(p)]])
Ry = np.array([[np.cos(y), 0, np.sin(y)], [0, 1, 0], [-np.sin(y), 0, np.cos(y)]])
d = d @ Rx.T @ Ry.T
lon = np.arctan2(d[..., 0], d[..., 2])           # 0 = pano centre, + = right
lat = np.arcsin(np.clip(-d[..., 1], -1, 1))       # + = up
u = (lon / (2 * np.pi) + 0.5) * ew - 0.5
v = (0.5 - lat / np.pi) * eh - 0.5
u0 = np.floor(u).astype(int); v0 = np.floor(v).astype(int); fu = (u - u0)[..., None]; fv = (v - v0)[..., None]
def g(vv, uu): return E[np.clip(vv, 0, eh - 1), np.mod(uu, ew)]
out = (g(v0, u0) * (1 - fu) * (1 - fv) + g(v0, u0 + 1) * fu * (1 - fv) + g(v0 + 1, u0) * (1 - fu) * fv + g(v0 + 1, u0 + 1) * fu * fv)
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(a.out)
print("wrote", a.out, W, H)

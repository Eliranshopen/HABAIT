"""kedma-d1: a contact sheet of straight-line looks cut from one panorama, at one pitch (the way a visitor looks: level, down, up).
usage: python look_sheet.py <pano image> <out.jpg> [--pitch -38] [--hfov 90] [--yaws 0,60,120,180,240,300] [--size 640] [--cols 3]
Each tile is labelled with its yaw (pano yaw: 0 = the camera's first look) and the pitch."""
import argparse, math
import cv2, numpy as np
ap = argparse.ArgumentParser()
ap.add_argument("pano"); ap.add_argument("out"); ap.add_argument("--pitch", type=float, default=-38.0); ap.add_argument("--hfov", type=float, default=90.0)
ap.add_argument("--yaws", default="0,60,120,180,240,300"); ap.add_argument("--size", type=int, default=640); ap.add_argument("--cols", type=int, default=3)
a = ap.parse_args()
pano = cv2.imread(a.pano, cv2.IMREAD_COLOR)

def cut(yaw, pitch, hfov, w, h):
    y, p = math.radians(yaw), math.radians(pitch)
    F = np.array([math.cos(p) * math.sin(y), math.sin(p), math.cos(p) * math.cos(y)])
    R = np.array([math.cos(y), 0.0, -math.sin(y)])
    U = np.array([-math.sin(p) * math.sin(y), math.cos(p), -math.sin(p) * math.cos(y)])
    f = (w / 2) / math.tan(math.radians(hfov) / 2)
    i, j = np.meshgrid(np.arange(w) + 0.5, np.arange(h) + 0.5)
    d = F[None, None, :] + ((i - w / 2) / f)[..., None] * R[None, None, :] + ((h / 2 - j) / f)[..., None] * U[None, None, :]
    d /= np.linalg.norm(d, axis=2, keepdims=True)
    psi, th = np.arctan2(d[..., 0], d[..., 2]), np.arcsin(np.clip(d[..., 1], -1, 1))
    mx = ((0.5 + psi / (2 * math.pi)) % 1.0) * pano.shape[1] - 0.5
    my = (0.5 - th / math.pi) * pano.shape[0] - 0.5
    return cv2.remap(pano, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_WRAP)

yaws = [float(v) for v in a.yaws.split(",")]
tiles = []
for y in yaws:
    t = cut(y, a.pitch, a.hfov, a.size, a.size)
    cv2.putText(t, f"yaw {y:g} pitch {a.pitch:g}", (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 3)
    cv2.putText(t, f"yaw {y:g} pitch {a.pitch:g}", (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    tiles.append(t)
while len(tiles) % a.cols:
    tiles.append(np.zeros_like(tiles[0]))
rows = [np.hstack(tiles[k:k + a.cols]) for k in range(0, len(tiles), a.cols)]
cv2.imwrite(a.out, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])
print("wrote", a.out)

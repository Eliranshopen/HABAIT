"""pano_crop.py — a perspective view cut out of an equirectangular panorama (numpy + Pillow, no Blender).

  python -I tools/pano_crop.py pano.webp out.png --yaw-rel 0 --pitch -2 --fov-h 70 --width 1280 --height 720

Convention = the tour pipeline's: u = 0.5 is the camera's forward direction (the camera point's yaw), u grows
toward the camera's RIGHT, v = 0 is the zenith. --yaw-rel is degrees right of forward, --pitch degrees up.
"""
import argparse
import math

import numpy as np
from PIL import Image


def crop(pano, yaw_rel_deg, pitch_deg, fov_h_deg, width, height):
    H, W = pano.shape[:2]
    fov_h = math.radians(fov_h_deg)
    fx = math.tan(fov_h / 2)
    fy = fx * height / width
    xs = (np.arange(width) + 0.5) / width * 2 - 1
    ys = 1 - (np.arange(height) + 0.5) / height * 2
    X, Y = np.meshgrid(xs * fx, ys * fy)
    Z = np.ones_like(X)
    # camera space: +X right, +Y up, +Z forward
    d = np.stack([X, Y, Z], axis=-1)
    d /= np.linalg.norm(d, axis=-1, keepdims=True)
    p = math.radians(pitch_deg)
    cp, sp = math.cos(p), math.sin(p)
    # rotate about X: pitch up = look up
    y2 = d[..., 1] * cp + d[..., 2] * sp
    z2 = -d[..., 1] * sp + d[..., 2] * cp
    yw = math.radians(yaw_rel_deg)
    cy, sy = math.cos(yw), math.sin(yw)
    x3 = d[..., 0] * cy + z2 * sy
    z3 = -d[..., 0] * sy + z2 * cy
    lon = np.arctan2(x3, z3)
    lat = np.arcsin(np.clip(y2, -1, 1))
    u = 0.5 + lon / (2 * math.pi)
    v = 0.5 - lat / math.pi
    px = np.mod(u * W, W)
    py = np.clip(v * H, 0, H - 1)
    # bilinear
    x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int)
    x1 = (x0 + 1) % W; y1 = np.clip(y0 + 1, 0, H - 1)
    wx = (px - x0)[..., None]; wy = (py - y0)[..., None]
    img = pano.astype(np.float32)
    out = (img[y0, x0] * (1 - wx) * (1 - wy) + img[y0, x1] * wx * (1 - wy) + img[y1, x0] * (1 - wx) * wy + img[y1, x1] * wx * wy)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pano")
    ap.add_argument("out")
    ap.add_argument("--yaw-rel", type=float, default=0.0)
    ap.add_argument("--pitch", type=float, default=0.0)
    ap.add_argument("--fov-h", type=float, default=70.0)
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    a = ap.parse_args()
    pano = np.asarray(Image.open(a.pano).convert("RGB"))
    out = crop(pano, a.yaw_rel, a.pitch, a.fov_h, a.width, a.height)
    Image.fromarray(out).save(a.out)
    print(f"pano_crop: {a.pano} -> {a.out} ({a.width}x{a.height}, fov {a.fov_h:.1f}, yaw {a.yaw_rel}, pitch {a.pitch})")


if __name__ == "__main__":
    main()

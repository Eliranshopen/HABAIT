"""Step 31 ($0) - the 360 polish, geometry part: an equirect panorama (Cycles, step 30) <-> overlapping perspective views.
  split <pano.png> <out dir>   -> <out>/<id>_<face>.png (five views of FOV 110 deg: front/right/back/left at the horizon, down)
  join  <pano.png> <polished dir> <out.jpg> [--w 4096] -> the equirect rebuilt from the polished views, each weighted by how close a
        direction is to its view's centre (soft overlap, no seam); the ceiling (no 'up' view) and anything unseen keep the render.
Eliran 2026-11-18: polish the 10 panoramas (his dialog pick, cap $12). Plan development/plans/2026-11-18-ahk-b10-two-versions.md.
Frame: equirect u in [0,1) left to right = yaw from +180 down to -180 around the pano's centre (yaw 0 = image centre), v top = up."""
import os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

FOV = 110.0
FACES = {"front": (0, 0), "left": (90, 0), "back": (180, 0), "right": (-90, 0), "down": (0, -90)}   # (yaw deg, pitch deg); + yaw = left
N = 1024


def basis(yaw, pitch):
    y, p = np.radians(yaw), np.radians(pitch)
    f = np.array([np.cos(p) * np.sin(-y) * -1, np.sin(p), np.cos(p) * np.cos(y)])   # forward: yaw 0 = +z (image centre), + yaw turns left (+x)
    f = np.array([np.sin(y) * np.cos(p), np.sin(p), np.cos(y) * np.cos(p)])
    up0 = np.array([0, 1, 0]) if abs(pitch) < 80 else np.array([0, 0, 1])
    r = np.cross(up0, f); r /= np.linalg.norm(r); u = np.cross(f, r)
    return f, r, u


def dirs_to_equirect(d, W, H):
    yaw = np.arctan2(d[..., 0], d[..., 2])            # + = left of centre
    pit = np.arcsin(np.clip(d[..., 1], -1, 1))
    x = (0.5 - yaw / (2 * np.pi)) * W                   # left of centre = smaller x
    y = (0.5 - pit / np.pi) * H
    return x, y


def sample(img, x, y):
    out = np.zeros(x.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = map_coordinates(img[..., c], [y.ravel(), x.ravel()], order=1, mode="wrap").reshape(x.shape)
    return out


def split(pano, out):
    E = np.asarray(Image.open(pano).convert("RGB")).astype(np.float32); H, W = E.shape[:2]
    os.makedirs(out, exist_ok=True); pid = os.path.splitext(os.path.basename(pano))[0]
    t = np.tan(np.radians(FOV / 2)); g = (np.arange(N) + 0.5) / N * 2 - 1
    gx, gy = np.meshgrid(g * t, -g * t)
    for name, (yw, pt) in FACES.items():
        f, r, u = basis(yw, pt)
        d = f[None, None, :] + gx[..., None] * -r[None, None, :] * -1 + gy[..., None] * u[None, None, :]
        d = f + gx[..., None] * r + gy[..., None] * u
        d /= np.linalg.norm(d, axis=-1, keepdims=True)
        x, y = dirs_to_equirect(d, W, H)
        Image.fromarray(np.clip(sample(E, x, y), 0, 255).astype(np.uint8)).save(os.path.join(out, f"{pid}_{name}.png"))
    print("SPLIT", pid)


def join(pano, pol, out, Wout=4096, skip=()):
    E = np.asarray(Image.open(pano).convert("RGB")).astype(np.float32); H0, W0 = E.shape[:2]
    pid = os.path.splitext(os.path.basename(pano))[0]
    Hout = Wout // 2
    xs = (np.arange(Wout) + 0.5) / Wout; ys = (np.arange(Hout) + 0.5) / Hout
    X, Y = np.meshgrid(xs, ys)
    yaw = (0.5 - X) * 2 * np.pi; pit = (0.5 - Y) * np.pi
    d = np.stack([np.sin(yaw) * np.cos(pit), np.sin(pit), np.cos(yaw) * np.cos(pit)], -1)
    acc = np.zeros((Hout, Wout, 3), np.float32); wsum = np.zeros((Hout, Wout), np.float32)
    t = np.tan(np.radians(FOV / 2))
    for name, (yw, pt) in FACES.items():
        p = os.path.join(pol, f"{pid}_{name}_real.png")
        if not os.path.exists(p) or f"{pid}_{name}" in skip:   # skip: a polished view that invented objects (QA 2026-11-18) keeps the render
            continue
        F = np.asarray(Image.open(p).convert("RGB").resize((N, N), Image.LANCZOS)).astype(np.float32)
        f, r, u = basis(yw, pt)
        z = d @ f; ok = z > 0.05
        px = (d @ r) / np.maximum(z, 1e-6) / t; py = (d @ u) / np.maximum(z, 1e-6) / t
        ok &= (np.abs(px) < 1) & (np.abs(py) < 1)
        w = np.where(ok, np.clip(1 - np.maximum(np.abs(px), np.abs(py)), 0, 1) ** 2, 0).astype(np.float32)
        col = sample(F, (px + 1) / 2 * N - 0.5, (1 - py) / 2 * N - 0.5)
        acc += col * w[..., None]; wsum += w
    base = sample(E, X * W0 - 0.5, Y * H0 - 0.5)
    # the render where no polished view covers it (ceiling, skipped views) takes the polished views' colour balance, per channel
    m = wsum > 0.3
    if m.any():
        pol_mean = (acc[m] / wsum[m][:, None]).mean(0); base_mean = base[m].mean(0)
        base = base * (pol_mean / np.maximum(base_mean, 1))[None, None, :]
    k = np.clip(wsum / 0.05, 0, 1)[..., None]
    outimg = base * (1 - k) + (acc / np.maximum(wsum, 1e-6)[..., None]) * k
    Image.fromarray(np.clip(outimg, 0, 255).astype(np.uint8)).save(out, quality=90)
    print("JOIN", pid, out)


if __name__ == "__main__":
    if sys.argv[1] == "split":
        split(sys.argv[2], sys.argv[3])
    else:
        join(sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[sys.argv.index("--w") + 1]) if "--w" in sys.argv else 4096,
             tuple(sys.argv[sys.argv.index("--skip") + 1].split(",")) if "--skip" in sys.argv else ())

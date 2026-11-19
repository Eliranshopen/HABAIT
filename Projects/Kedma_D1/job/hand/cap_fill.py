"""kedma-d1 ($0): what a room canvas still lacks after its views and its floor - the ceiling above the views, and small leftovers -
is filled from the painting around it and the model's own shading.

With the viewer's eye-level rule (apartment.json view.tiltDeg) the screen never shows above about +48 deg on a desktop and +59 deg on
a phone, so the straight-up view is not painted. The cap above the level views is a plain ceiling: its colour is the painted
ceiling's, carried upward (a masked blur, wide), and its light and its edges are the render's (the render's brightness against its own
wide field). The same fill closes any small unpainted leftover elsewhere. Nothing painted is touched.

usage: python cap_fill.py <apartment dir> <asset> [--dry]
Keeps canvas.before-capfill.png / painted.before-capfill.png. Deterministic.
"""
import argparse
import io
import json
import os

import cv2
import numpy as np

def _atomic_write(path, im):
    """write to a temporary file, then replace: a run killed by its time limit never leaves a half-written canvas (2026-11-17)"""
    tmp = path[:-4] + ".tmp.png"; cv2.imwrite(tmp, im); os.replace(tmp, path)

ap = argparse.ArgumentParser(); ap.add_argument("apt"); ap.add_argument("asset"); ap.add_argument("--dry", action="store_true")
a = ap.parse_args()
R = os.path.join(a.apt, "_local", "redo", a.asset); P = lambda n: os.path.join(R, n)
C = cv2.imread(P("canvas.png")).astype(np.float32); G = cv2.imread(P("cg.png")).astype(np.float32); PT = cv2.imread(P("painted.png"), cv2.IMREAD_GRAYSCALE)
H, W = PT.shape
SC = W / 4096.0
un = PT <= 127
if not un.any():
    print(json.dumps({"step": "cap-fill", "filled_pct": 0.0})); raise SystemExit(0)
lum = lambda B: 0.114 * B[..., 0] + 0.587 * B[..., 1] + 0.299 * B[..., 2]
K = max(8, int(round(8 * SC)))


def carried(img, mask, sigma):
    m = mask.astype(np.float32)
    prod = img * (m[..., None] if img.ndim == 3 else m)
    small = lambda B: cv2.resize(B, (W // K, H // K), interpolation=cv2.INTER_AREA)
    ps, ms, s = small(prod), small(m), sigma * SC / K
    pad = min(int(s * 3) + 1, W // K)
    wrap = lambda B: np.concatenate([B[:, -pad:], B, B[:, :pad]], 1)
    num, den = cv2.GaussianBlur(wrap(ps), (0, 0), s)[:, pad:-pad], cv2.GaussianBlur(wrap(ms), (0, 0), s)[:, pad:-pad]
    big = lambda B: cv2.resize(B, (W, H), interpolation=cv2.INTER_CUBIC)
    return big(num), np.maximum(big(den), 0)


def field(img, mask, base):
    f = np.full(img.shape, base, np.float32) if img.ndim == 2 else np.ones_like(img) * base
    for sigma in (700, 220, 70):
        num, den = carried(img, mask, sigma)
        conf = np.clip(den / 0.08, 0, 1)
        if img.ndim == 3:
            f = f * (1 - conf[..., None]) + (num / np.maximum(den, 1e-6)[..., None]) * conf[..., None]
        else:
            f = f * (1 - conf) + (num / np.maximum(den, 1e-6)) * conf
    return f


painted = ~un
# the source of the colour: painted pixels near the unpainted ones (within a wide ring), so a ceiling takes the ceiling's colour
ring = cv2.dilate(un.astype(np.uint8), np.ones((int(161 * SC) | 1, int(161 * SC) | 1), np.uint8)).astype(bool) & painted
src = ring if ring.sum() > 5000 else painted
base = np.median(C[src].reshape(-1, 3), axis=0)
F = field(C, src, base[None, None, :])
GL = lum(G)
GLs = cv2.GaussianBlur(GL, (0, 0), 2.0 * SC)
gf = field(GLs, np.ones((H, W), bool), float(np.median(GLs)))
# the render's own edges, gently, and never brighter than its field: the render's round ceiling lamp came through as a pale disc
S = np.clip(GLs / np.maximum(gf, 1), 0.86, 1.0)
# the painted plaster has a fine grain; a perfectly smooth fill beside it shows as a change of texture
rs = np.random.RandomState(20261117)
grain = cv2.GaussianBlur(rs.randn(H, W).astype(np.float32), (0, 0), 0.8 * SC) * 0.012
fill = np.clip(F * (S * (1.0 + grain))[..., None], 0, 255)
w = cv2.GaussianBlur(un.astype(np.float32), (0, 0), 3.0 * SC)[..., None]
w = np.maximum(w, un.astype(np.float32)[..., None])          # every unpainted pixel is filled; the edge is soft into the painted side
OUT = np.where(painted[..., None], C * (1 - np.minimum(w, 0.0)) , fill)
soft = cv2.GaussianBlur(un.astype(np.float32), (0, 0), 6.0 * SC)[..., None]
OUT = np.where(painted[..., None], C * (1 - 0.35 * soft) + fill * (0.35 * soft), fill)   # a short cross-fade on the painted side of the edge
row = {"step": "cap-fill", "filled_pct": round(float(un.mean()) * 100, 2)}
print(json.dumps(row))
if not a.dry:
    for n, im in (("canvas", cv2.imread(P("canvas.png"))), ("painted", PT)):
        if not os.path.exists(P(f"{n}.before-capfill.png")):
            cv2.imwrite(P(f"{n}.before-capfill.png"), im)
    _atomic_write(P("canvas.png"), np.round(OUT).astype(np.uint8))
    _atomic_write(P("painted.png"), np.full((H, W), 255, np.uint8))
    log = json.load(io.open(P("log.json"), encoding="utf-8"))
    log.append(row); io.open(P("log.json"), "w", encoding="utf-8", newline="").write(json.dumps(log, indent=1, ensure_ascii=False))

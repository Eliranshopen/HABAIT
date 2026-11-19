"""kedma-d1 ($0): put a flat-view answer back on the CG view's frame before it is pasted (hand/flatfix.py).

Why: the image model sometimes answers with the right, straight picture but in a slightly different frame: the whole room moved up
a few percent, or drawn a little larger (2026-11-17: the master bedroom answer had every edge about 8 % higher than the CG view, so
the window would have been pasted ~35 cm too high). A zoom and a shift of a straight-line picture taken from the same point is still
a true picture of that point (another focal length and another picture centre), so the answer can be moved back exactly.

How: the CG view's edges are matched to the answer's edges (chamfer distance) over a scale and a shift; the answer is then redrawn in
the CG view's frame. Where the moved answer has no pixels, the paste must not use it: the tool prints the --box for flatfix.py paste.

usage: python flatreg.py <apartment dir> <asset> <tag> --answer <png> [--max-shift 160] [--scales 0.88,1.16]
writes <answer>.reg.png next to the answer and prints {scale, dx, dy, before, after, box}
"""
import argparse
import json
import os

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("apt"); ap.add_argument("asset"); ap.add_argument("tag")
ap.add_argument("--answer", required=True)
ap.add_argument("--max-shift", type=int, default=160)
ap.add_argument("--scales", default="0.88,1.16")
a = ap.parse_args()
D = os.path.join(a.apt, "_local", "flatfix", f"{a.asset}-{a.tag}")
cg = cv2.imread(os.path.join(D, "cg.png"))
S = cg.shape[0]
ans = cv2.imread(a.answer)
if ans.shape[0] != S or ans.shape[1] != S:
    ans = cv2.resize(ans, (S, S), interpolation=cv2.INTER_AREA)


def edges(im, lo, hi):
    return cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), (5, 5), 0), lo, hi)


e_cg = edges(cg, 30, 90)
e_an = edges(ans, 40, 120)
TR = 24.0
dist = np.minimum(cv2.distanceTransform(255 - e_an, cv2.DIST_L2, 3), TR)
ys, xs = np.nonzero(e_cg)
rng = np.random.default_rng(7)
if len(xs) > 6000:
    k = rng.choice(len(xs), 6000, replace=False); xs, ys = xs[k], ys[k]
P = np.stack([xs, ys], axis=1).astype(np.float32)
c = np.array([S / 2, S / 2], np.float32)


def cost(s, dx, dy, pts):
    """the CG point p is drawn in the answer at s * (p - c) + c + (dx, dy)"""
    q = s * (pts - c) + c + np.array([dx, dy], np.float32)
    xi, yi = np.rint(q[:, 0]).astype(int), np.rint(q[:, 1]).astype(int)
    ok = (xi >= 0) & (xi < S) & (yi >= 0) & (yi < S)
    v = np.full(len(pts), TR, np.float32)
    v[ok] = dist[yi[ok], xi[ok]]
    return float(v.mean())


s0, s1 = [float(t) for t in a.scales.split(",")]
coarse = P[rng.choice(len(P), min(1500, len(P)), replace=False)]
best = (cost(1.0, 0, 0, coarse), 1.0, 0, 0)
for s in np.arange(s0, s1 + 1e-6, 0.02):
    for dx in range(-a.max_shift, a.max_shift + 1, 8):
        for dy in range(-a.max_shift, a.max_shift + 1, 8):
            v = cost(s, dx, dy, coarse)
            if v < best[0]:
                best = (v, float(s), dx, dy)
_, bs, bdx, bdy = best
fine = (cost(bs, bdx, bdy, P), bs, bdx, bdy)
for s in np.arange(bs - 0.02, bs + 0.0201, 0.004):
    for dx in range(bdx - 8, bdx + 9, 2):
        for dy in range(bdy - 8, bdy + 9, 2):
            v = cost(s, dx, dy, P)
            if v < fine[0]:
                fine = (v, float(s), dx, dy)
after, s, dx, dy = fine
before = cost(1.0, 0, 0, P)
# redraw the answer in the CG frame: the CG pixel p takes the answer's pixel s * (p - c) + c + d
M = np.array([[s, 0, c[0] * (1 - s) + dx], [0, s, c[1] * (1 - s) + dy]], np.float32)
reg = cv2.warpAffine(ans, M, (S, S), flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
out = a.answer[:-4] + ".reg.png"
cv2.imwrite(out, reg)
# the part of the CG frame the answer really covers
x_lo, x_hi = (0 - c[0] - dx) / s + c[0], (S - 1 - c[0] - dx) / s + c[0]
y_lo, y_hi = (0 - c[1] - dy) / s + c[1], (S - 1 - c[1] - dy) / s + c[1]
box = [max(0.0, x_lo / (S - 1)), max(0.0, y_lo / (S - 1)), min(1.0, x_hi / (S - 1)), min(1.0, y_hi / (S - 1))]
print(json.dumps({"scale": round(s, 4), "dx": int(dx), "dy": int(dy), "before": round(before, 2), "after": round(after, 2),
                  "box": ",".join(f"{t:.3f}" for t in box), "out": out}))

"""kedma-d1 ($0): no skirting board in any viewpoint (Eliran, 2026-11-10: «לא לשים פאנלים בין הקיר לרצפה») - the foot of every wall
is painted with the wall itself.

Why (2026-11-17, the living room): the image model adds a white skirting board along the corridor walls although every prompt says
"No skirting boards". A wall is vertical, so one column of the panorama meets it at one (x, y) and only the height changes: the strip
at the wall's foot takes, column by column, the painted wall just above it (from --src-z0 to --src-z1 cm), with the render's own light
(its brightness at the foot over its brightness at the source) and a fine grain. Only pixels whose 3D point (render depth) lies within
--tol cm of a WALL LINE of the plan (every room loop edge and every wall polygon edge) and below --top cm are changed; furniture, doors
standing in front of the wall and the floor are not.

usage: python no_skirting.py <apartment dir> <tour dir> <asset> --cam cp-living [--top 16] [--src-z0 22] [--src-z1 40] [--tol 4] [--dry]
Keeps canvas.before-noskirting.png. Prints the share changed. Deterministic.
"""
import argparse
import io
import json
import math
import os

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("apt"); ap.add_argument("tour"); ap.add_argument("asset"); ap.add_argument("--cam", required=True)
ap.add_argument("--top", type=float, default=16.0); ap.add_argument("--src-z0", type=float, default=22.0)
ap.add_argument("--src-z1", type=float, default=40.0); ap.add_argument("--tol", type=float, default=4.0)
ap.add_argument("--dry", action="store_true")
a = ap.parse_args()
R = lambda n: os.path.join(a.apt, "_local", "redo", a.asset, n)
REN = lambda n: os.path.join(a.tour, "renders", a.cam, n)
C = cv2.imread(R("canvas.png")); G = cv2.imread(R("cg.png"))
H, W = C.shape[:2]
SC = W / 4096.0
j = json.load(io.open(REN("pano.render.json"), encoding="utf-8"))["point"]
tx, ty, tz = (float(v) for v in j["plan_cm"]); tyaw = float(j["yaw_deg"])
d = cv2.resize(cv2.imread(REN("depth.png"), cv2.IMREAD_COLOR), (W, H), interpolation=cv2.INTER_NEAREST)
rT = ((d[..., 2].astype(np.int64) << 16) | (d[..., 1].astype(np.int64) << 8) | d[..., 0].astype(np.int64)).astype(np.float32)
psi = np.radians(tyaw + (np.arange(W) + 0.5) / W * 360.0 - 180.0)[None, :]
lat = ((0.5 - (np.arange(H) + 0.5) / H) * math.pi)[:, None]
X = tx + rT * np.cos(lat) * np.sin(psi)
Y = ty - rT * np.cos(lat) * np.cos(psi)
Z = tz + rT * np.sin(lat)
plan = json.load(io.open(os.path.join(a.apt, "plan.general.json"), encoding="utf-8"))
segs = []
for r in plan.get("rooms", []):
    L = r.get("loop") or []
    segs += [(L[k], L[(k + 1) % len(L)]) for k in range(len(L))]
for w in plan.get("walls", []):
    P = w.get("polygon_cm") or []
    segs += [(P[k], P[(k + 1) % len(P)]) for k in range(len(P))]
# distance of every pixel's (x, y) to the nearest wall line, only where it matters (low on the walls)
low = (Z < a.src_z1 + 4) & (Z > 0.6) & (rT > 1)
ys, xs = np.nonzero(low)
px, py = X[ys, xs], Y[ys, xs]
dist = np.full(len(ys), 1e9, np.float32)
for (p, q) in segs:
    ex, ey = q[0] - p[0], q[1] - p[1]; L2 = ex * ex + ey * ey
    if L2 < 1:
        continue
    u = np.clip(((px - p[0]) * ex + (py - p[1]) * ey) / L2, 0, 1)
    dist = np.minimum(dist, np.hypot(px - (p[0] + u * ex), py - (p[1] + u * ey)))
onwall = np.zeros((H, W), bool); onwall[ys, xs] = dist <= a.tol
foot = onwall & (Z <= a.top)
src = onwall & (Z >= a.src_z0) & (Z <= a.src_z1)
lum = lambda B: 0.114 * B[..., 0] + 0.587 * B[..., 1] + 0.299 * B[..., 2]
GL = cv2.GaussianBlur(lum(G.astype(np.float32)), (0, 0), 2.0 * SC)
Cf = C.astype(np.float32); out = Cf.copy(); n = 0
cols = np.nonzero(foot.any(0))[0]
for c in cols:
    s = np.nonzero(src[:, c])[0]
    if len(s) < 3:
        continue
    ref = np.median(Cf[s, c], axis=0); gref = max(float(np.median(GL[s, c])), 1.0)
    t = np.nonzero(foot[:, c])[0]
    k = np.clip(GL[t, c] / gref, 0.75, 1.15)[:, None]
    out[t, c] = ref[None, :] * k; n += len(t)
done = foot & (np.abs(out - Cf).sum(2) > 0)
rs = np.random.RandomState(20261117)
gr = cv2.GaussianBlur(rs.randn(H, W).astype(np.float32), (0, 0), 0.8 * SC) * 2.0
out += (gr * done)[..., None]
m = done.astype(np.float32); soft = np.maximum(cv2.GaussianBlur(m, (0, 0), 1.0 * SC), m)[..., None]
OUT = np.clip(Cf * (1 - soft) + out * soft, 0, 255).round().astype(np.uint8)
row = {"step": "no-skirting", "cam": a.cam, "changed_pct": round(float(done.mean()) * 100, 3), "columns": int(len(cols)), "top_cm": a.top}
print(json.dumps(row))
if not a.dry:
    if not os.path.exists(R("canvas.before-noskirting.png")):
        cv2.imwrite(R("canvas.before-noskirting.png"), C)
    cv2.imwrite(R("canvas.png"), OUT)
    lp = R("log.json"); log = json.load(io.open(lp, encoding="utf-8")) if os.path.exists(lp) else []
    log.append(row); io.open(lp, "w", encoding="utf-8", newline="").write(json.dumps(log, indent=1, ensure_ascii=False))

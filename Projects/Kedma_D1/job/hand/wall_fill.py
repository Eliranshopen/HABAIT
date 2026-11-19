"""kedma-d1 ($0): an unpainted PLAIN wall of a room canvas is painted from the painted plaster of another wall of the same room.

Why (2026-11-17, the pantry): the image model, given a close view of a plain wall, invents things on it (a niche; then an opening, a
counter and a skirting board). A blurred fill from the neighbours (cap_fill.py) took the oak of the shelves beside it and smeared.
A plain plastered wall needs neither: its colour and grain are the painted plaster of another wall of the room, its light is the
render's own light on it.

  target = unpainted pixels whose 3D point (render depth) lies within --tol cm of the plane --plane (x=<cm> or y=<cm>), between
           --z0 and --z1, inside --span (the other axis' range)
  source = painted pixels on the plane --src-plane, inside --src-span, --z0..--z1 (plain plaster: say where it is)
  colour = the source's median colour, times the render's light on the target over the render's light on the source (median)
  grain  = the source's own fine texture (its high-pass), laid over the target from the source pixels in order (no stretch)
The edge into the painted canvas is a few pixels of cross-fade. Nothing painted is touched.

usage: python wall_fill.py <apartment dir> <tour dir> <asset> --cam cp-pantry --plane y=428 --span 1092,1249 --src-plane x=1093.8
                           --src-span 251,336 [--z0 4] [--z1 286] [--tol 3] [--whole] [--mask-from png] [--grain 0.5] [--dry]
Keeps canvas.before-wallfill.png / painted.before-wallfill.png. Deterministic.
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
ap.add_argument("--plane", required=True); ap.add_argument("--span", required=True)
ap.add_argument("--src-plane", required=True); ap.add_argument("--src-span", required=True)
ap.add_argument("--z0", type=float, default=4.0); ap.add_argument("--z1", type=float, default=286.0)
ap.add_argument("--tol", type=float, default=3.0); ap.add_argument("--dry", action="store_true")
ap.add_argument("--mask-from")
ap.add_argument("--whole", action="store_true"); ap.add_argument("--grain", type=float, default=0.5)
a = ap.parse_args()
R = lambda n: os.path.join(a.apt, "_local", "redo", a.asset, n)
REN = lambda n: os.path.join(a.tour, "renders", a.cam, n)
C = cv2.imread(R("canvas.png")); PT = cv2.imread(R("painted.png"), cv2.IMREAD_GRAYSCALE); G = cv2.imread(R("cg.png"))
H, W = C.shape[:2]
SC = W / 4096.0
j = json.load(io.open(REN("pano.render.json"), encoding="utf-8"))["point"]
tx, ty, tz = (float(v) for v in j["plan_cm"]); tyaw = float(j["yaw_deg"])
d = cv2.resize(cv2.imread(REN("depth.png"), cv2.IMREAD_COLOR), (W, H), interpolation=cv2.INTER_NEAREST)
rT = ((d[..., 2].astype(np.int64) << 16) | (d[..., 1].astype(np.int64) << 8) | d[..., 0].astype(np.int64)).astype(np.float32)
psi = np.radians(tyaw + (np.arange(W) + 0.5) / W * 360.0 - 180.0)[None, :]
lat = ((0.5 - (np.arange(H) + 0.5) / H) * math.pi)[:, None]
P = {"x": tx + rT * np.cos(lat) * np.sin(psi), "y": ty - rT * np.cos(lat) * np.cos(psi)}
Z = tz + rT * np.sin(lat)


def on(plane, span):
    ax, v = plane.split("="); v = float(v)
    if ax == "z":    # 2026-11-17: the CEILING (z=<height>): every ceiling pixel of the panorama, --span ignored
        return (np.abs(Z - v) <= a.tol) & (rT > 1)
    other = "y" if ax == "x" else "x"
    lo, hi = (float(q) for q in span.split(","))
    return (np.abs(P[ax] - v) <= a.tol) & (P[other] >= lo) & (P[other] <= hi) & (Z >= a.z0) & (Z <= a.z1) & (rT > 1)


# --mask-from: the unpainted mask of an earlier copy (re-laying a wall that later steps already marked painted)
tgt = on(a.plane, a.span) & (True if a.whole else ((cv2.imread(a.mask_from, cv2.IMREAD_GRAYSCALE) if a.mask_from else PT) <= 127))
# --whole: the whole face inside --span, painted or not (the wall is plain; its earlier edges were filled from the neighbours)
src = on(a.src_plane, a.src_span) & (PT > 127)
src = cv2.erode(src.astype(np.uint8), np.ones((int(9 * SC) | 1, int(9 * SC) | 1), np.uint8)).astype(bool)   # off its own edges
if src.sum() < 2000 or tgt.sum() == 0:
    raise SystemExit(f"too little: source {int(src.sum())} px, target {int(tgt.sum())} px")
lum = lambda B: 0.114 * B[..., 0] + 0.587 * B[..., 1] + 0.299 * B[..., 2]
Cf = C.astype(np.float32)
GL = cv2.GaussianBlur(lum(G.astype(np.float32)), (0, 0), 2.0 * SC)
col = np.median(Cf[src].reshape(-1, 3), axis=0)
light = np.clip(GL / max(float(np.median(GL[src])), 1.0), 0.6, 1.4)
if a.plane.startswith("z="):
    # a ceiling: the render's ceiling lamp is a pale disc - never brighter than the ceiling around it (as cap_fill.py does); and the
    # painted recessed spotlights (small bright or dark blobs on the painted ceiling) are kept as they are
    light = np.clip(cv2.GaussianBlur(GL, (0, 0), 25.0 * SC) / max(float(np.median(GL[src])), 1.0), 0.8, 1.04)
    CLg = lum(Cf); med = float(np.median(CLg[tgt]))
    blob = ((CLg - cv2.medianBlur(np.clip(CLg, 0, 255).astype(np.uint8), int(41 * SC) | 1).astype(np.float32)) > 0.12 * med) & tgt
    nl, lab, st, _ = cv2.connectedComponentsWithStats(blob.astype(np.uint8), 8)
    # a recessed spotlight: a BRIGHT, round blob of a lamp's size; specks, streaks and seams are not kept
    ar, bw, bh = st[:, cv2.CC_STAT_AREA], st[:, cv2.CC_STAT_WIDTH], st[:, cv2.CC_STAT_HEIGHT]
    small = (ar >= (5 * SC) ** 2) & (ar < (60 * SC) ** 2) & (np.maximum(bw, bh) <= 2.5 * np.maximum(np.minimum(bw, bh), 1)) & (ar >= 0.45 * bw * bh)
    small[0] = False
    keep = cv2.dilate(small[lab].astype(np.uint8), np.ones((int(9 * SC) | 1, int(9 * SC) | 1), np.uint8)).astype(bool)
    inner = cv2.erode(tgt.astype(np.uint8), np.ones((int(41 * SC) | 1, int(41 * SC) | 1), np.uint8)).astype(bool)   # spots away from the ceiling's edges only
    tgt = tgt & ~(keep & inner)
    # the look's ceiling is a flat WHITE ceiling: its shade is the painted ceiling's lighter part (the median took the shadowed far corners)
    col = np.percentile(Cf[src].reshape(-1, 3), 75, axis=0)
# the grain: an even fine grain with the source plaster's own strength (2026-11-17: copying the source's grain pixel by pixel in scan
# order drew wavy streaks across the wall)
hp = Cf - cv2.GaussianBlur(Cf, (0, 0), 3.0 * SC)
amp = float(np.std(lum(hp)[src]))
rs = np.random.RandomState(20261117)
nz = cv2.GaussianBlur(rs.randn(H, W).astype(np.float32), (0, 0), 1.0 * SC)
nz *= a.grain * amp / max(float(np.std(nz)), 1e-6)
ys, xs = np.nonzero(tgt)
gr = np.repeat(nz[ys, xs][:, None], 3, axis=1)
bm = np.zeros(1)
fill = np.clip(col[None, :] * light[ys, xs][:, None] + gr, 0, 255)
out = Cf.copy(); out[ys, xs] = fill
m = tgt.astype(np.float32)
soft = np.maximum(cv2.GaussianBlur(m, (0, 0), 1.5 * SC), m)[..., None]
OUT = np.round(Cf * (1 - soft) + out * soft).astype(np.uint8)
OUT[~(cv2.dilate(tgt.astype(np.uint8), np.ones((int(9 * SC) | 1, int(9 * SC) | 1), np.uint8)).astype(bool))] = C[~(cv2.dilate(tgt.astype(np.uint8), np.ones((int(9 * SC) | 1, int(9 * SC) | 1), np.uint8)).astype(bool))]
PT2 = np.maximum(PT, (tgt * 255).astype(np.uint8))
row = {"step": "wall-fill", "plane": a.plane, "span": a.span, "src_plane": a.src_plane, "src_span": a.src_span,
       "target_pct": round(float(tgt.mean()) * 100, 3), "source_px": int(src.sum()), "colour_bgr": [round(float(v), 1) for v in col],
       "grain_block": bool(bm.mean() > 0.6)}
print(json.dumps(row))
if not a.dry:
    for n, im in (("canvas", C), ("painted", PT)):
        if not os.path.exists(R(f"{n}.before-wallfill.png")):
            cv2.imwrite(R(f"{n}.before-wallfill.png"), im)
    cv2.imwrite(R("canvas.png"), OUT); cv2.imwrite(R("painted.png"), PT2)
    lp = R("log.json")
    log = json.load(io.open(lp, encoding="utf-8")) if os.path.exists(lp) else []
    log.append(row); io.open(lp, "w", encoding="utf-8", newline="").write(json.dumps(log, indent=1, ensure_ascii=False))

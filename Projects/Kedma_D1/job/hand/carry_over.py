"""kedma-d1: one room looks the same from every viewpoint - the painted surfaces are CARRIED from a finished viewpoint into the next.

Why (Eliran, 2026-11-17: «אין עקביות … האי במטבח נראה מנקודת תצפית מהמזווה לעומת … המטבח … כל חדר אמור להיראות אותו דבר מכל נקודת תצפית»):
painting the kitchen again from the pantry, even with the same words, gives a similar kitchen, not the same one. Every viewpoint is
rendered from ONE 3D model, and each render has its depth; so a surface painted in one viewpoint can be put, pixel for pixel, where
the next viewpoint sees that same surface. Only what the finished viewpoints do not see (or see from too far) is left for the image
model, which then "finishes the picture" around the carried part.

For every pixel of the target panorama: its 3D point (the target's depth), seen from each source camera; it is carried when the
source sees that same point (its own depth agrees within max(4 cm, 2 %)), the source is painted there, the source is not much farther
from the point than the target (--max-ratio: a surface seen from far is blurred when brought near), and neither picture has a depth
edge there (--edge px: at an edge the painting and the model differ by a pixel or two). The nearest source wins.

usage: python carry_over.py <apartment dir> <tour dir> <target asset> --cam cp-pantry --from 01-kitchen:cp-kitchen[,asset:cam ...]
                            [--max-ratio 1.6] [--edge 6] [--box x0,y0,x1,y1,z0,z1 ...] [--only-unpainted] [--dry]
--box (repeatable, plan cm): carry only onto the surfaces that stand inside these boxes, over whatever is painted there - for one piece
that a later view repainted differently (2026-11-17: the fridge, stainless from the kitchen, came out of the pantry's own views as a
beige panel). --only-unpainted: carry only where the target is still unpainted (after a regraft).
Needs the target's room canvas (room_paint.py init). Keeps canvas.before-carry.png / painted.before-carry.png. Deterministic, $0.
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
ap.add_argument("--from", dest="sources", required=True); ap.add_argument("--max-ratio", type=float, default=1.6)
ap.add_argument("--edge", type=int, default=6); ap.add_argument("--dry", action="store_true")
ap.add_argument("--box", action="append", default=[]); ap.add_argument("--only-unpainted", action="store_true")
a = ap.parse_args()
R = lambda asset, n: os.path.join(a.apt, "_local", "redo", asset, n)
REN = lambda cam, n: os.path.join(a.tour, "renders", cam, n)


def pose(cam):
    j = json.load(io.open(REN(cam, "pano.render.json"), encoding="utf-8"))["point"]
    x, y, z = j["plan_cm"]
    return float(x), float(y), float(z), float(j["yaw_deg"])


def depth_of(cam, W, H):
    d = cv2.resize(cv2.imread(REN(cam, "depth.png"), cv2.IMREAD_COLOR), (W, H), interpolation=cv2.INTER_NEAREST)
    return ((d[..., 2].astype(np.int64) << 16) | (d[..., 1].astype(np.int64) << 8) | d[..., 0].astype(np.int64)).astype(np.float32)


def edges(rng, px):
    """where the depth jumps (relative step over 4 % between neighbours), grown by px"""
    r = np.maximum(rng, 1.0)
    gx = np.abs(np.roll(r, -1, 1) - r) / r
    gy = np.abs(np.roll(r, -1, 0) - r) / r
    e = ((gx > 0.04) | (gy > 0.04)).astype(np.uint8)
    return cv2.dilate(e, np.ones((2 * px + 1, 2 * px + 1), np.uint8)).astype(bool) if px > 0 else e.astype(bool)


C = cv2.imread(R(a.asset, "canvas.png")); PT = cv2.imread(R(a.asset, "painted.png"), cv2.IMREAD_GRAYSCALE)
H, W = C.shape[:2]
PXS = W / 4096.0                                        # pixel sizes were set on a 4096-wide canvas
odd = lambda v: max(3, int(round(v * PXS)) | 1)
tx, ty, tz, tyaw = pose(a.cam)
rT = depth_of(a.cam, W, H)
psi = np.radians(tyaw + (np.arange(W) + 0.5) / W * 360.0 - 180.0)[None, :]
lat = ((0.5 - (np.arange(H) + 0.5) / H) * math.pi)[:, None]
X = tx + rT * np.cos(lat) * np.sin(psi)
Y = ty - rT * np.cos(lat) * np.cos(psi)
Z = tz + rT * np.sin(lat)
ok_t = (rT > 1) & (rT < 3000) & ~edges(rT, int(round(a.edge * PXS)))
if a.box:
    inb = np.zeros((H, W), bool)
    for b in a.box:
        x0, y0, x1, y1, z0, z1 = (float(v) for v in b.split(","))
        inb |= (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1) & (Z >= z0) & (Z <= z1)
    ok_t &= inb
if a.only_unpainted:
    ok_t &= PT <= 127

best = np.full((H, W), 1e9, np.float32)
out = C.astype(np.float32).copy()
took = np.zeros((H, W), bool)
rows = []
for spec in a.sources.split(","):
    s_asset, s_cam = spec.split(":")
    SC = cv2.imread(R(s_asset, "canvas.png")); SP = cv2.imread(R(s_asset, "painted.png"), cv2.IMREAD_GRAYSCALE)
    assert SC.shape[:2] == (H, W)
    sx, sy, sz, syaw = pose(s_cam)
    rS_map = depth_of(s_cam, W, H)
    eS = edges(rS_map, int(round(a.edge * PXS))).astype(np.uint8)
    dx, dy, dz = X - sx, Y - sy, Z - sz
    rS = np.sqrt(dx * dx + dy * dy + dz * dz)
    b = np.degrees(np.arctan2(dx, -dy)) - syaw
    u = ((b / 360.0 + 0.5) % 1.0) * W - 0.5
    v = (0.5 - np.arcsin(np.clip(dz / np.maximum(rS, 1e-3), -1, 1)) / math.pi) * H - 0.5
    mu, mv = u.astype(np.float32), v.astype(np.float32)
    seen = cv2.remap(rS_map, mu, mv, cv2.INTER_NEAREST, borderMode=cv2.BORDER_WRAP)
    col = cv2.remap(SC, mu, mv, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_WRAP).astype(np.float32)
    painted = cv2.remap(SP, mu, mv, cv2.INTER_NEAREST, borderMode=cv2.BORDER_WRAP) > 127
    s_edge = cv2.remap(eS, mu, mv, cv2.INTER_NEAREST, borderMode=cv2.BORDER_WRAP) > 0
    ratio = rS / np.maximum(rT, 1.0)
    good = ok_t & painted & ~s_edge & (np.abs(seen - rS) < np.maximum(4.0, 0.02 * rS)) & (ratio <= a.max_ratio) & (ratio < best)
    out[good] = col[good]; best[good] = ratio[good]; took |= good
    rows.append({"source": spec, "carried_pct": round(float(good.mean()) * 100, 2)})

# a soft meeting line with what is not carried, and no islands of a few pixels
m = cv2.morphologyEx(took.astype(np.uint8), cv2.MORPH_OPEN, np.ones((odd(5), odd(5)), np.uint8))
soft = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 2.0 * PXS)[..., None]
OUT = np.clip(C.astype(np.float32) * (1 - soft) + out * soft, 0, 255).round().astype(np.uint8)
PT2 = np.maximum(PT, (cv2.erode(m, np.ones((odd(5), odd(5)), np.uint8)) * 255).astype(np.uint8))
facts = {"step": "carry-over", "target": a.asset, "cam": a.cam, "sources": rows, "carried_pct": round(float(m.mean()) * 100, 2),
         "painted_pct": round(float((PT2 > 127).mean()) * 100, 1), "max_ratio": a.max_ratio, "edge_px": a.edge,
         **({"boxes": a.box} if a.box else {}), **({"only_unpainted": True} if a.only_unpainted else {})}
print(json.dumps(facts))
if not a.dry:
    for n, im in (("canvas", C), ("painted", PT)):
        if not os.path.exists(R(a.asset, f"{n}.before-carry.png")):
            cv2.imwrite(R(a.asset, f"{n}.before-carry.png"), im)
    cv2.imwrite(R(a.asset, "canvas.png"), OUT); cv2.imwrite(R(a.asset, "painted.png"), PT2)
    lp = R(a.asset, "log.json")
    log = json.load(io.open(lp, encoding="utf-8")) if os.path.exists(lp) else []
    log.append(facts); io.open(lp, "w", encoding="utf-8", newline="").write(json.dumps(log, indent=1, ensure_ascii=False))

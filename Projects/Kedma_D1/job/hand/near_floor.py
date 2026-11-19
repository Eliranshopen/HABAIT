"""kedma-d1: the floor under the camera comes from the model ($0; plan 2026-11-17, method step 4).

Why (2026-11-17, the kitchen pilot): the floor near the camera's foot is where a room redo is weakest. Three tilted views meet there,
each painted with its own stone (one smooth, one pitted like travertine), a straight-down view invents furniture, and a patch between
the three stays unpainted CG. Looking down - as Eliran does, at the island - shows a floor in three materials.

What this does, for one room canvas of hand/room_paint.py:
  the floor            = the CG render's own floor (Blender depth: a pixel under 4 cm above the floor plane, the render's floor colour)
  near the camera      = pitch below --p1 (fully), fading in from --p0; an unpainted floor pixel anywhere is also taken
  its colour           = the painted floor's own colour beyond the fade, carried inward (a masked blur): the near floor continues it
  its shading          = the CG render's shading, relative to the same field (the shadows of the model's own furniture)
  its joints           = the CG render's joints, pixel for pixel (the scene's true 120 cm grid, one grid through the apartment)
  its stone            = a quiet plan-space stone (large clouds, fine grain, a tone per tile): the same at every pixel of a tile, from
                         every camera
Everything else - the painted floor beyond the fade, furniture, walls - is untouched. Deterministic: the same inputs give the same file.

usage: python near_floor.py <apartment dir> <asset> --cam cp-kitchen --depth <renders/cp-*/depth.png> [--p0 -34] [--p1 -46] [--dry]
writes the room canvas and its painted mask (copies kept as canvas.before-nearfloor.png / painted.before-nearfloor.png), a log row,
and prints the measured facts (floor share, joints found on the grid).
"""
import argparse
import io
import json
import math
import os

import cv2
import numpy as np

def _atomic_write(path, im):
    """write to a temporary file, then replace: a run killed by its time limit never leaves a half-written canvas (2026-11-17)"""
    tmp = path[:-4] + ".tmp.png"; cv2.imwrite(tmp, im); os.replace(tmp, path)

ap = argparse.ArgumentParser()
ap.add_argument("apt"); ap.add_argument("asset"); ap.add_argument("--cam", required=True); ap.add_argument("--depth", required=True)
ap.add_argument("--p0", type=float, default=-32.0); ap.add_argument("--p1", type=float, default=-44.0)
ap.add_argument("--keep", action="append", default=[]); ap.add_argument("--any-floor", action="store_true"); ap.add_argument("--tile", type=float, default=120.0); ap.add_argument("--dry", action="store_true"); ap.add_argument("--whole", action="store_true"); ap.add_argument("--no-veins", action="store_true")
a = ap.parse_args()
R = os.path.join(a.apt, "_local", "redo", a.asset)
P = lambda n: os.path.join(R, n)
FLOOR_CM = 4.0

plan = json.load(io.open(os.path.join(a.apt, "plan.general.json"), encoding="utf-8"))
cam = next(c for c in plan["camera_points"] if c["id"] == a.cam)
cx, cy, cz, yaw = float(cam["x"]), float(cam["y"]), float(cam["z"]), float(cam["yaw_deg"])

C = cv2.imread(P("canvas.png"), cv2.IMREAD_COLOR).astype(np.float32)
G = cv2.imread(P("cg.png"), cv2.IMREAD_COLOR).astype(np.float32)
PT = cv2.imread(P("painted.png"), cv2.IMREAD_GRAYSCALE)
H, W = C.shape[:2]
SC = W / 4096.0                                         # pixel sizes below were set on a 4096-wide canvas
odd = lambda v: max(3, int(round(v * SC)) | 1)
assert G.shape[:2] == (H, W) and PT.shape == (H, W)

# ---- the floor of the model: depth (radial cm, rgb24 big-endian - render_pano.py's contract), as tools/floor_composite.py reads it
d = cv2.resize(cv2.imread(a.depth, cv2.IMREAD_COLOR), (W, H), interpolation=cv2.INTER_NEAREST)
rng = (d[..., 2].astype(np.int64) << 16) | (d[..., 1].astype(np.int64) << 8) | d[..., 0].astype(np.int64)
elev = (0.5 - (np.arange(H) + 0.5) / H) * math.pi                    # +up, per row
z = cz + rng * np.sin(elev)[:, None]
Md = (z < FLOOR_CM) & (rng > 0) & (elev[:, None] < 0)

# the render's floor colour: what lies on the floor plane but is not the floor (a rug, a mat, a leg's foot) has another colour
lum = lambda B: 0.114 * B[..., 0] + 0.587 * B[..., 1] + 0.299 * B[..., 2]
GL = lum(G)
near_rows = elev[:, None] < math.radians(-25)
ref = np.median(G[Md & near_rows].reshape(-1, 3), axis=0)
ref_l = float(0.114 * ref[0] + 0.587 * ref[1] + 0.299 * ref[2])
chroma = lambda B, L: np.stack([B[..., 0] / np.maximum(L, 1), B[..., 2] / np.maximum(L, 1)], -1)
gc, rc = chroma(G, GL), np.array([ref[0] / ref_l, ref[2] / ref_l])
# (a tight colour test, 0.06, dropped the floor beside the wooden cabinets, where the render's floor takes their warm bounce light:
# the old stone stayed there in strips with a stepped edge)
cg_floor = Md & (np.abs(gc - rc).max(-1) < 0.15) & (GL > 0.25 * ref_l)
if a.any_floor:   # 2026-11-17, the corridor: the floor in a door's deep shadow failed the colour test and kept blocky painted stone
    cg_floor = Md.copy()
cg_floor = cv2.erode(cg_floor.astype(np.uint8), np.ones((odd(7), odd(7)), np.uint8)).astype(bool)

# ---- where: pitch below p1 fully, fading in from p0; an unpainted floor pixel anywhere
pitch = np.degrees(elev)[:, None] * np.ones((1, W))
t = np.clip((a.p0 - pitch) / (a.p0 - a.p1), 0, 1)
fade = t * t * (3 - 2 * t)
CL = lum(C)
good = cg_floor & (PT > 127) & (pitch > a.p1) & (pitch < -8)
cref = np.median(C[good].reshape(-1, 3), axis=0) if good.sum() > 5000 else ref
cref_l = float(0.114 * cref[0] + 0.587 * cref[1] + 0.299 * cref[2])


def carried(img, mask, sigma):
    """a masked blur with wrap in u: the field of `img` over `mask`, carried into where the mask is empty.
    Worked at 1/8 size (a field this wide has nothing finer; at full size the widest reach ran for minutes)."""
    K = max(8, int(round(8 * SC)))
    m = mask.astype(np.float32)
    prod = img * (m[..., None] if img.ndim == 3 else m)
    small = lambda B: cv2.resize(B, (W // K, H // K), interpolation=cv2.INTER_AREA)
    ps, ms, s = small(prod), small(m), sigma * SC / K
    pad = min(int(s * 3) + 1, W // K)
    wrap = lambda B: np.concatenate([B[:, -pad:], B, B[:, :pad]], 1)
    num, den = cv2.GaussianBlur(wrap(ps), (0, 0), s)[:, pad:-pad], cv2.GaussianBlur(wrap(ms), (0, 0), s)[:, pad:-pad]
    big = lambda B: cv2.resize(B, (W, H), interpolation=cv2.INTER_CUBIC)
    return big(num), np.maximum(big(den), 0)


# ---- colour: ONE floor colour for the whole picture - the painted floor's median - and only its BRIGHTNESS follows the painting's
# light (a wide field: the room's light, not the old stone's patches); near the camera the field is wider still
def field(img, sigmas, base):
    f = np.full((H, W), base, np.float32)            # coarse to fine: a nearer field replaces a wider one where it has enough floor
    for sigma in sigmas:
        num, den = carried(img, good, sigma)
        conf = np.clip(den / 0.08, 0, 1)
        f = f * (1 - conf) + (num / np.maximum(den, 1e-6)) * conf
    return f


F = np.stack([field(C[..., k], (700, 220), float(cref[k])) * fade + field(C[..., k], (700, 220, 60), float(cref[k])) * (1 - fade)
              for k in range(3)], -1)                 # the painted floor's own colour, carried: wide near the camera, nearer beyond it
FL = lum(F)

# ---- where. Default: the camera's foot (pitch below p1 fully, fading in from p0) and any unpainted floor pixel. --whole: every floor
# pixel of the model (the base of a floor finish; not used for the stone the room was painted in - see the plan, 2026-11-17).
zone = np.ones_like(fade) if a.whole else np.maximum(fade, (PT <= 127).astype(np.float32))
w = np.where(cg_floor & (pitch < -3.0), zone, 0.0).astype(np.float32)
# beyond the camera's foot a painted thing that stands where the model has bare floor (a leg drawn a little wider, a cushion that
# hangs lower) is kept: it is clearly darker, lighter or more coloured than the painted floor AROUND it. The test is against the
# local floor colour - against one colour for the whole picture it kept a cream patch of floor as "not floor" (a floor in two tones).
CLs = cv2.medianBlur(np.clip(CL, 0, 255).astype(np.uint8), odd(9)).astype(np.float32)
ratio = CLs / np.maximum(FL, 1)
not_floor_paint = (PT > 127) & ((ratio < 0.70) | (ratio > 1.22) | (np.abs(chroma(C, CL) - chroma(F, FL)).max(-1) > 0.14))
w[cv2.dilate(not_floor_paint.astype(np.uint8), np.ones((odd(3), odd(3)), np.uint8)).astype(bool) & (fade < 1)] = 0.0
w = cv2.GaussianBlur(w, (0, 0), 1.6 * SC)
w[~cv2.dilate(cg_floor.astype(np.uint8), np.ones((odd(3), odd(3)), np.uint8)).astype(bool)] = 0.0

# ---- shading of the model, joints out, relative to its own carried field over the same pixels
GLs = cv2.medianBlur(np.clip(GL, 0, 255).astype(np.uint8), odd(9)).astype(np.float32)
joints = np.clip(GL / np.maximum(GLs, 1), 0.70, 1.0)
joints[~Md] = 1.0
# the shadows are the model's own at every distance (the furniture of the painting stands on the model's): the render's floor
# brightness against its own wide field. The painting's fine shading is NOT used - it carries the old stone's pits and patches.
gfield = field(GLs, (700, 220), float(np.median(GLs[good])) if good.sum() else ref_l)
S = np.clip(GLs / np.maximum(gfield, 1), 0.50, 1.12)
S = cv2.GaussianBlur(S, (0, 0), 1.2 * SC)
# beyond the camera's foot (only with --whole) the shading is the painting's own, read wide enough to leave the old stone's pits out
CLw = cv2.medianBlur(np.clip(CL, 0, 255).astype(np.uint8), odd(15)).astype(np.float32)
S = S * fade + np.clip(CLw / np.maximum(FL, 1), 0.55, 1.18) * (1 - fade)

# ---- the stone, in plan centimetres: X right, Y down; pano u 0.5 = the camera's yaw; bearings clockwise from up
psi = (np.arange(W) + 0.5) / W * 360.0 - 180.0
b = np.radians(yaw + psi)[None, :]
g = cz / np.tan(np.maximum(-elev, 1e-4))[:, None]
X, Y = cx + g * np.sin(b), cy - g * np.cos(b)
rs = np.random.RandomState(20261117)
TBL = rs.rand(256, 256).astype(np.float32)


def vnoise(x, y, wave):
    u, v = x / wave, y / wave
    i, j = np.floor(u).astype(np.int64), np.floor(v).astype(np.int64)
    fu, fv = (u - i).astype(np.float32), (v - j).astype(np.float32)
    fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
    q = lambda ii, jj: TBL[ii % 256, jj % 256]
    return (q(i, j) * (1 - fu) + q(i + 1, j) * fu) * (1 - fv) + (q(i, j + 1) * (1 - fu) + q(i + 1, j + 1) * fu) * fv - 0.5


# ---- painted floor where the model has a movable piece (2026-11-17: the painted bar stool is slimmer than the model's, and the pitted
# stone of the old tilted view stayed under it). Such a pixel is floor when (1) the plan says the floor plane behind it is open floor -
# inside a room, clear of walls and fixed casework, seen in a straight line from the camera - and (2) the painting there has the
# floor's own colour. Its shading is the painting's (the shadow under the piece), its joints are the grid's.
FIXED = {"counter", "tall_unit", "island", "wardrobe", "wc", "vanity", "bathtub", "washer", "shelving"}
pts = np.array([p for r in plan["rooms"] for p in r["loop"]], np.float64)
ox, oy = math.floor(pts[:, 0].min()) - 10, math.floor(pts[:, 1].min()) - 10
PW_, PH_ = int(pts[:, 0].max() - ox) + 20, int(pts[:, 1].max() - oy) + 20
free = np.zeros((PH_, PW_), np.uint8)
for r in plan["rooms"]:
    cv2.fillPoly(free, [np.round(np.array(r["loop"]) - [ox, oy]).astype(np.int32)], 1)
for f in plan["fixtures"]:
    if f.get("kind") in FIXED and f.get("polygon_cm"):
        cv2.fillPoly(free, [np.round(np.array(f["polygon_cm"]) - [ox, oy]).astype(np.int32)], 0)
free = cv2.erode(free, np.ones((5, 5), np.uint8))
steps = np.arange(4.0, 1400.0, 1.0)[:, None]
rx, ry = cx + steps * np.sin(b) - ox, cy - steps * np.cos(b) - oy
inb = (rx >= 0) & (rx < PW_) & (ry >= 0) & (ry < PH_)
blocked = ~inb | (free[np.clip(ry, 0, PH_ - 1).astype(np.int64), np.clip(rx, 0, PW_ - 1).astype(np.int64)] == 0)
g_free = np.where(blocked.any(0), steps[blocked.argmax(0), 0], steps[-1, 0])        # per column: the open floor's reach, cm
FL = lum(F)
CLs = cv2.medianBlur(np.clip(CL, 0, 255).astype(np.uint8), odd(9)).astype(np.float32)
fc = chroma(F, FL)
behind = (~Md) & (elev[:, None] < 0) & (g < g_free[None, :] - 4.0) & (PT > 127) & (fade > 0)
floor_like = (CLs > 0.80 * FL) & (CLs < 1.12 * FL) & (np.abs(chroma(C, CL) - fc).max(-1) < 0.045)
grow = cv2.morphologyEx((behind & floor_like).astype(np.uint8), cv2.MORPH_OPEN, np.ones((odd(5), odd(5)), np.uint8)).astype(bool)
grow &= cv2.dilate(cg_floor.astype(np.uint8), np.ones((odd(61), odd(61)), np.uint8)).astype(bool)
fp = (cz / np.maximum(np.sin(-elev), 1e-3))[:, None] * (2 * math.pi / W)             # a pixel's width on the floor, cm
gd = np.minimum(np.minimum(X % a.tile, a.tile - X % a.tile), np.minimum(Y % a.tile, a.tile - Y % a.tile))
joint_grid = 1.0 - 0.26 * np.clip(1.0 - (gd - 0.15) / np.maximum(fp, 0.05), 0, 1) * np.minimum(1.0, 0.3 / np.maximum(fp, 0.05) + 0.35)
wg = cv2.GaussianBlur((grow.astype(np.float32) * fade).astype(np.float32), (0, 0), 1.6 * SC)
wg[~cv2.dilate(grow.astype(np.uint8), np.ones((odd(3), odd(3)), np.uint8)).astype(bool)] = 0.0
S = np.where(grow, np.clip(CLs / np.maximum(FL, 1), 0.72, 1.08), S)
joints = np.where(grow, joint_grid, joints)
w = np.maximum(w, wg)
# --keep x0,y0,x1,y1 (plan cm, repeatable): a rug or a mat lies ON the floor plane (1-3 cm) and the floor test took it for floor
# (2026-11-17, the living room: the painted rug was wiped). Inside a box, what stands above 0.8 cm is kept as painted.
for kb in a.keep:
    kx0, ky0, kx1, ky1 = (float(v) for v in kb.split(','))
    km = (X >= kx0) & (X <= kx1) & (Y >= ky0) & (Y <= ky1) & (z > 0.8) & (z < 4.0)
    km = cv2.dilate(km.astype(np.uint8), np.ones((odd(5), odd(5)), np.uint8)).astype(np.float32)
    w = w * (1.0 - np.clip(cv2.GaussianBlur(km, (0, 0), 1.5 * SC) * 1.5, 0, 1))

ti, tj = np.floor(X / a.tile).astype(np.int64), np.floor(Y / a.tile).astype(np.int64)
tone = TBL[(ti * 7 + 3) % 256, (tj * 13 + 5) % 256] - 0.5
sx, sy = TBL[(ti * 3 + 11) % 256, (tj * 5 + 17) % 256] * 4000.0, TBL[(ti * 11 + 2) % 256, (tj * 3 + 7) % 256] * 4000.0   # each tile is its own slab
fpd = (cz / np.maximum(np.sin(-elev), 1e-3) ** 2)[:, None] * (math.pi / H)          # a pixel's depth on the floor, cm
att = lambda wave: np.clip((wave / np.maximum(fpd, 1e-3) - 2.0) / 4.0, 0, 1)          # a pattern finer than the pixel is not drawn
A = (1.0 + 0.020 * tone * att(a.tile) + 0.075 * vnoise(X + sx, Y + sy, 70.0) * att(70.0)
     + 0.045 * vnoise(X * 1.7 + sx, Y + sy, 22.0) * att(13.0)
     + 0.030 * vnoise((X + Y) * 0.35 + sx, (X - Y) * 2.2 + sy, 30.0) * att(13.6)
     + 0.016 * vnoise(X + sy, Y + sx, 6.0) * att(6.0) + 0.012 * vnoise(X + sx, Y + sy, 1.6) * att(1.6))

if not a.no_veins:
    # the look's floor is a white marble-look tile (Eliran 2026-11-17, look B): thin grey veins wander across each tile, each tile in
    # its own direction, fading in and out - drawn in plan centimetres, so a vein is the same from every camera
    th = TBL[(ti * 5 + 1) % 256, (tj * 7 + 3) % 256] * math.pi
    # (a first try let the noise lead: the veins closed into loops like map contours. The line leads; the noise only bends it.)
    uu = (X * np.cos(th) + Y * np.sin(th)) / 75.0 + 0.55 * vnoise(X + sx, Y + sy, 70.0) + 0.16 * vnoise(X + sy, Y + sx, 14.0)
    dv = np.abs(uu - np.round(uu))
    patch = np.clip(1.9 * (vnoise(X + 7 * sx, Y + 3 * sy, 110.0) + 0.5) - 0.75, 0, 1)      # a vein shows over part of its length only
    vein = np.exp(-(dv / 0.011) ** 2) * patch
    A = A - 0.075 * vein * att(2.0)
near = np.clip(F * (S * A * joints)[..., None], 0, 255)
OUT = C * (1 - w[..., None]) + near * w[..., None]

# ---- the facts
jm = (joints < 0.93) & cg_floor & (pitch < -30)
dist = np.minimum(np.minimum(X % a.tile, a.tile - X % a.tile), np.minimum(Y % a.tile, a.tile - Y % a.tile))
facts = {"camera": [cx, cy, cz, yaw], "floor_share_pct": round(float(cg_floor.mean()) * 100, 2), "taken_pct": round(float((w > 0.5).mean()) * 100, 2),
         "unpainted_floor_px": int(((PT <= 127) & cg_floor).sum()), "behind_piece_px": int(grow.sum()), "joint_px": int(jm.sum()),
         "joints_on_grid_pct": round(float((dist[jm] < 2.5).mean()) * 100, 1) if jm.sum() else None,
         "floor_colour_bgr": [round(float(v), 1) for v in cref], "p0": a.p0, "p1": a.p1}
print(json.dumps(facts))
if not a.dry:
    for n in ("canvas", "painted"):
        if not os.path.exists(P(f"{n}.before-nearfloor.png")):
            cv2.imwrite(P(f"{n}.before-nearfloor.png"), cv2.imread(P(f"{n}.png"), cv2.IMREAD_UNCHANGED))
    _atomic_write(P("canvas.png"), np.round(OUT).astype(np.uint8))
    PT2 = PT.copy(); PT2[w > 0.5] = 255
    _atomic_write(P("painted.png"), PT2)
    log = json.load(io.open(P("log.json"), encoding="utf-8"))
    log.append({"step": "near-floor", **facts})
    io.open(P("log.json"), "w", encoding="utf-8", newline="").write(json.dumps(log, indent=1, ensure_ascii=False))

"""kedma-d1: the model changed under a painted room canvas (2026-11-17: the stools became bar stools) - take the change into the canvas.

The camera is the same, so everything the two renders agree on stays painted. Where the NEW render differs from the render the canvas
was painted on (plus a margin, and plus any extra plan boxes named with --box: the painted piece can stand taller than the old model's),
the canvas goes back to the new render and is marked unpainted, so the next view call paints it on the new geometry.

usage: python regraft.py <apartment dir> <asset> --cg <new pano> --cam cp-kitchen [--box x0,y0,x1,y1,z0,z1 ...] [--thr 14] [--grow 28] [--near 70]
With --box (repeatable): the pixels of the boxes, plus the render difference within --near px of them. Without: every difference.
Keeps canvas.before-regraft.png / painted.before-regraft.png / cg.before-regraft.png. Prints the share that was reset.
"""
import argparse, io, json, math, os
import cv2, numpy as np
ap = argparse.ArgumentParser()
ap.add_argument("apt"); ap.add_argument("asset"); ap.add_argument("--cg", required=True); ap.add_argument("--cam", required=True)
ap.add_argument("--depth")                                # the new render's depth.png: with it, nothing in front of a box is taken
ap.add_argument("--box", action="append", default=[]); ap.add_argument("--thr", type=float, default=14.0); ap.add_argument("--grow", type=int, default=28); ap.add_argument("--near", type=int, default=70)
a = ap.parse_args()
R = os.path.join(a.apt, "_local", "redo", a.asset); P = lambda n: os.path.join(R, n)
C = cv2.imread(P("canvas.png")); PT = cv2.imread(P("painted.png"), cv2.IMREAD_GRAYSCALE); G0 = cv2.imread(P("cg.png"))
H, W = C.shape[:2]
G1 = cv2.resize(cv2.imread(a.cg), (W, H), interpolation=cv2.INTER_LANCZOS4)
d = cv2.GaussianBlur(cv2.absdiff(G0, G1).max(2).astype(np.float32), (0, 0), 2.0)
diff = cv2.morphologyEx((d > a.thr).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
m = np.zeros((H, W), np.uint8)
plan = json.load(io.open(os.path.join(a.apt, "plan.general.json"), encoding="utf-8"))
cam = next(c for c in plan["camera_points"] if c["id"] == a.cam)
cx, cy, cz, yaw = float(cam["x"]), float(cam["y"]), float(cam["z"]), float(cam["yaw_deg"])
RNG, D_NEAR = None, 1e9
if a.depth:                                              # the new render's depth: radial cm, rgb24 big-endian (render_pano.py)
    dd_ = cv2.resize(cv2.imread(a.depth, cv2.IMREAD_COLOR), (W, H), interpolation=cv2.INTER_NEAREST)
    RNG = ((dd_[..., 2].astype(np.int64) << 16) | (dd_[..., 1].astype(np.int64) << 8) | dd_[..., 0].astype(np.int64)).astype(np.float64)
for b in a.box:                                           # every pano pixel whose ray passes through the plan box
    x0, y0, x1, y1, z0, z1 = (float(v) for v in b.split(","))
    psi = np.radians(yaw + (np.arange(W) + 0.5) / W * 360.0 - 180.0)[None, :]
    el = ((0.5 - (np.arange(H) + 0.5) / H) * math.pi)[:, None]
    dx, dy, dz = np.cos(el) * np.sin(psi), -np.cos(el) * np.cos(psi), np.sin(el) * np.ones_like(psi)
    t0, t1 = np.full((H, W), -1e9), np.full((H, W), 1e9)
    for o, dd, lo, hi in ((cx, dx, x0, x1), (cy, dy, y0, y1), (cz, dz, z0, z1)):
        with np.errstate(divide="ignore", invalid="ignore"):
            ta, tb = (lo - o) / dd, (hi - o) / dd
        t0, t1 = np.maximum(t0, np.minimum(ta, tb)), np.minimum(t1, np.maximum(ta, tb))
    hit = (t1 >= np.maximum(t0, 0)) & (t1 > 0)
    if RNG is not None:
        # 2026-11-17: what the model shows IN FRONT of the box is not touched (the white partition and the island stand between the
        # camera and the invented armchair: the first run took them back to the render and the repaint left a seam across them)
        hit &= RNG >= np.maximum(t0, 0) - 6.0
    m |= hit.astype(np.uint8)
    if hit.any():
        D_NEAR = min(D_NEAR, float(np.maximum(t0, 0)[hit].min()))
# 2026-11-17: only what changed AT the named pieces is taken. The first run took every pixel where the two renders differ, and the
# brushed-metal splashback - which mirrors the room, so it changed when the stools did - went back to the render as a dark blot.
if a.box:
    near = cv2.dilate(m, np.ones((2 * a.near + 1, 2 * a.near + 1), np.uint8))
    m |= (diff & near)
else:
    m = diff
m = cv2.dilate(m, np.ones((2 * a.grow + 1, 2 * a.grow + 1), np.uint8))
if RNG is not None and a.box and D_NEAR < 1e8:
    # the margin does not climb onto what stands nearer than the nearest box (the partition's edge beside the armchair's place: the
    # first run's margin took 28 px of it, and the repaint left a pale stepped strip along the edge)
    m &= (RNG >= D_NEAR - 6.0).astype(np.uint8)
soft =cv2.GaussianBlur(m.astype(np.float32), (0, 0), 3.0)[..., None]
for n, im in (("canvas", C), ("painted", PT), ("cg", G0)):
    if not os.path.exists(P(f"{n}.before-regraft.png")):
        cv2.imwrite(P(f"{n}.before-regraft.png"), im)
cv2.imwrite(P("canvas.png"), np.round(C * (1 - soft) + G1 * soft).astype(np.uint8))
# the painted mask falls off softly a few pixels OUTSIDE the reset area (in the earlier picture, clear of the render that was blended
# in), so the repaint meets the earlier picture in a cross-fade and not along a line (2026-11-17: a pale outline around the island)
m_out = cv2.dilate(m, np.ones((17, 17), np.uint8))
if RNG is not None and a.box and D_NEAR < 1e8:
    m_out &= (RNG >= D_NEAR - 6.0).astype(np.uint8)
m_out |= m
PT2 = np.minimum(PT, np.round((1.0 - cv2.GaussianBlur(m_out.astype(np.float32), (0, 0), 5.0)) * 255).astype(np.uint8))
PT2[m > 0] = 0
cv2.imwrite(P("painted.png"), PT2); cv2.imwrite(P("cg.png"), G1)
log = json.load(io.open(P("log.json"), encoding="utf-8"))
row = {"step": "regraft", "cg": a.cg.replace("\\", "/"), "boxes": a.box, "reset_pct": round(float((m > 0).mean()) * 100, 2), "painted_pct": round(float((PT2 > 127).mean()) * 100, 1)}
log.append(row); io.open(P("log.json"), "w", encoding="utf-8", newline="").write(json.dumps(log, indent=1, ensure_ascii=False))
print(json.dumps(row))

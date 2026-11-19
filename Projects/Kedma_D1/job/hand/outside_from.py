"""kedma-d1 2026-11-19, balcony: the far view (sky, hills) beyond the railing, from ONE answer whose far view is right, into every
outside pixel of the canvas (sky: depth 0; the render's flat ground plane: its colour, large regions). Far content does not need the
near-geometry registration, so a re-framed answer's far view is usable. Bearings outside the answer's view are mirrored once about its
edge. Dark pixels of the answer (railing posts) are inpainted first. Above the answer's top, a sky gradient. Marked painted.
$0. Atomic writes; canvas/painted.before-outfrom.png kept.
usage: python outside_from.py <redo dir> <depth.png> <answer.png> <yaw> <pitch> <hfov> <yaw lo> <yaw hi> [--all]
  only canvas pixels with yaw in [lo, hi] are written; --all also overwrites painted outside pixels in that range."""
import cv2, sys, os, json, numpy as np
R, dpath, apath = sys.argv[1:4]; vy, vp, hf, lo, hi = map(float, sys.argv[4:9]); ALL = '--all' in sys.argv
c = cv2.imread(os.path.join(R, 'canvas.png')); g = cv2.imread(os.path.join(R, 'cg.png')); p = cv2.imread(os.path.join(R, 'painted.png'), 0)
H, W = c.shape[:2]
d = cv2.resize(cv2.imread(dpath, 0), (W, H), interpolation=cv2.INTER_NEAREST)
gi = g.astype(int); r_, g_, b_ = gi[..., 2], gi[..., 1], gi[..., 0]
plane = ((r_ >= 160) & (r_ <= 195) & (g_ >= 163) & (g_ <= 198) & (b_ >= 145) & (b_ <= 182) & (g_ - b_ >= 8) & (g_ - b_ <= 28)).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(plane, 8); big = np.zeros_like(plane)
for i in range(1, n):
    if st[i, 4] > 0.01 * H * W: big[lab == i] = 1
big = cv2.morphologyEx(big, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)).astype(bool)
out_mask = (d == 0) | big
yy, xx = np.mgrid[0:H, 0:W]; yawg = (xx / W - 0.5) * 360.0
sel = out_mask & (yawg >= lo) & (yawg <= hi) & ((p < 128) | ALL)
A = cv2.imread(apath); dark = (A.min(2) < 70).astype(np.uint8); dark = cv2.dilate(dark, np.ones((9, 9), np.uint8))
A = cv2.inpaint(A, dark, 9, cv2.INPAINT_TELEA); S = A.shape[0]; f = (S / 2) / np.tan(np.radians(hf / 2))
ys, xs = np.where(sel); yaw = (xs / W - 0.5) * 360.0; pit = (0.5 - ys / H) * 180.0
half = hf / 2 - 3; e0, e1 = vy - half, vy + half
src = np.where(yaw < e0, 2 * e0 - yaw, np.where(yaw > e1, 2 * e1 - yaw, yaw)); src = np.clip(src, e0, e1)
def project(yw, pt):
    yr = np.radians(yw - vy); pr = np.radians(pt); X = np.cos(pr) * np.sin(yr); Y = np.sin(pr); Z = np.cos(pr) * np.cos(yr)
    cp, sp = np.cos(np.radians(vp)), np.sin(np.radians(vp)); Y2 = Y * cp - Z * sp; Z2 = Y * sp + Z * cp
    with np.errstate(divide='ignore', invalid='ignore'):
        return f * X / Z2 + S / 2, S / 2 - f * Y2 / Z2, Z2 > 0
def bil(img, u, v):
    u = np.clip(np.nan_to_num(u), 0, img.shape[1] - 1.001); v = np.clip(np.nan_to_num(v), 0, img.shape[0] - 1.001)
    x0 = u.astype(int); y0 = v.astype(int); fx = (u - x0)[:, None]; fy = (v - y0)[:, None]; I = img.astype(np.float32)
    return I[y0, x0] * (1 - fx) * (1 - fy) + I[y0, x0 + 1] * fx * (1 - fy) + I[y0 + 1, x0] * (1 - fx) * fy + I[y0 + 1, x0 + 1] * fx * fy
u, v, front = project(src, pit); inside = front & (v >= 0) & (v <= S - 1) & (u >= 0) & (u <= S - 1)
col = bil(A, u, v)
# sky above the answer's top edge: the answer's top row colours, by bearing, fading to the column's top colour
top = bil(A, np.clip(u, 0, S - 1), np.zeros_like(u))
col = np.where(inside[:, None], col, top)
for f_ in ('canvas', 'painted'):
    bk = os.path.join(R, f_ + '.before-outfrom.png')
    if not os.path.exists(bk): cv2.imwrite(bk, cv2.imread(os.path.join(R, f_ + '.png'), cv2.IMREAD_UNCHANGED))
c[ys, xs] = np.clip(col, 0, 255).astype(np.uint8); p[ys, xs] = 255
for f_, a in (('canvas.png', c), ('painted.png', p)):
    tmp = os.path.join(R, 'tmp_' + f_); cv2.imwrite(tmp, a); os.replace(tmp, os.path.join(R, f_))
print(json.dumps({"step": "outside-from", "px": int(len(xs)), "mirrored_px": int(((yaw < e0) | (yaw > e1)).sum())}))

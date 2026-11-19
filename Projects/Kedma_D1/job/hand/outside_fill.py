"""kedma-d1 2026-11-18, balcony: beyond the railing the render has a flat pale-green ground plane at railing height and the image model
reads it as more terrace (it invented a second terrace with furniture twice). Before painting, every unpainted outside pixel (sky:
depth 0; the ground plane: its flat render colour) gets a backdrop: the hills of one answer projected from its view, carried round to
other bearings by whole shifts of 100 deg, and above 25 deg a smooth sky gradient from that answer's sky (no sun disc). Not marked painted (OF_MARK=1 marks it).
$0. Atomic writes; canvas.before-outside.png / painted.before-outside.png kept.
usage: python outside_fill.py <redo dir> <depth.png> <answer.png> <view yaw> <view pitch> <hfov>"""
import cv2, sys, os, json, numpy as np
R, dpath, apath = sys.argv[1:4]; vy, vp, hf = map(float, sys.argv[4:7])
c = cv2.imread(os.path.join(R, 'canvas.png')); g = cv2.imread(os.path.join(R, 'cg.png')); p = cv2.imread(os.path.join(R, 'painted.png'), 0)
H, W = c.shape[:2]
d = cv2.resize(cv2.imread(dpath, 0), (W, H), interpolation=cv2.INTER_NEAREST)
gi = g.astype(int); r_, g_, b_ = gi[..., 2], gi[..., 1], gi[..., 0]
plane = (r_ >= 160) & (r_ <= 195) & (g_ >= 163) & (g_ <= 198) & (b_ >= 145) & (b_ <= 182) & (g_ - b_ >= 8) & (g_ - b_ <= 28)
mask = ((d == 0) | plane) & (p < 128)
A = cv2.imread(apath); S = A.shape[0]; f = (S / 2) / np.tan(np.radians(hf / 2))
ys, xs = np.where(mask)
yaw = (xs / W - 0.5) * 360.0; pit = (0.5 - ys / H) * 180.0
def project(yw, pt):
    yr = np.radians(yw - vy); pr = np.radians(pt); X = np.cos(pr) * np.sin(yr); Y = np.sin(pr); Z = np.cos(pr) * np.cos(yr)
    cp, sp = np.cos(np.radians(vp)), np.sin(np.radians(vp)); Y2 = Y * cp - Z * sp; Z2 = Y * sp + Z * cp
    with np.errstate(divide='ignore', invalid='ignore'):
        u = f * X / Z2 + S / 2; v = S / 2 - f * Y2 / Z2
    ok = (Z2 > 0) & (u >= 0) & (u < S - 1) & (v >= 0) & (v < S - 1)
    return u, v, ok
def bil(img, u, v):
    u = np.clip(np.nan_to_num(u), 0, img.shape[1] - 1.001); v = np.clip(np.nan_to_num(v), 0, img.shape[0] - 1.001)
    x0 = u.astype(int); y0 = v.astype(int); fx = (u - x0)[:, None]; fy = (v - y0)[:, None]; I = img.astype(np.float32)
    return (I[y0, x0] * (1 - fx) * (1 - fy) + I[y0, x0 + 1] * fx * (1 - fy) + I[y0 + 1, x0] * (1 - fx) * fy + I[y0 + 1, x0 + 1] * fx * fy)
half = hf / 2 - 6
# the clean strip of the answer (sky and hills, also down through the glass), tiled round by mirroring (no hard seams)
s0, s1 = float(os.environ.get('OF_S0', 25)), float(os.environ.get('OF_S1', 52)); L = s1 - s0
t = (yaw - s0) % (2 * L); src_yaw = s0 + np.where(t <= L, t, 2 * L - t)
u, v, ok = project(src_yaw, pit)
out = np.zeros((len(xs), 3), np.float32)
samp = bil(A, u, v)
out[:] = samp
# sky gradient above 25 deg: per pitch, the median of the answer's sky (bright sun excluded)
grid = np.arange(0, 91)
uu, vv, okg = project(np.repeat(np.linspace(vy - half, vy + half, 41)[None, :], len(grid), 0), np.repeat(grid[:, None], 41, 1))
prof = np.full((len(grid), 3), np.nan, np.float32)
for i in range(len(grid)):
    m = okg[i]
    if not m.any(): continue
    s = bil(A, uu[i][m], vv[i][m])
    s = s[s.min(1) < 240]
    if len(s): prof[i] = np.median(s, 0)
okp = ~np.isnan(prof[:, 0])
for ch in range(3): prof[:, ch] = np.interp(grid, grid[okp], prof[okp, ch])
skyc = np.stack([np.interp(np.clip(pit, 0, 90), grid, prof[:, ch]) for ch in range(3)], 1)
w = np.clip((pit - 20) / 5.0, 0, 1)[:, None]
out = out * (1 - w) + skyc * w
out = np.where(ok[:, None] | (w > 0.99), out, skyc)
for f_ in ('canvas', 'painted'):
    src = os.path.join(R, f_ + '.png'); bk = os.path.join(R, f_ + '.before-outside.png')
    if not os.path.exists(bk): cv2.imwrite(bk, cv2.imread(src, cv2.IMREAD_UNCHANGED))
c[ys, xs] = np.clip(out, 0, 255).astype(np.uint8)
if os.environ.get('OF_MARK') == '1': p[ys, xs] = 255   # default: the backdrop only feeds the model; its answer replaces it
for f_, a in (('canvas.png', c), ('painted.png', p)):
    tmp = os.path.join(R, 'tmp_' + f_); cv2.imwrite(tmp, a); os.replace(tmp, os.path.join(R, f_))
print(json.dumps({"step": "outside-fill", "px": int(len(xs)), "pct": round(100 * len(xs) / (H * W), 2)}))

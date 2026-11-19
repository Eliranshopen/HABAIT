# $0 (2026-11-10, rainbow-sim-fixes round 3; Eliran: «הרצפה בלשונית סלון נראית חתוכה»): a parquet finish whose PLANKS are geometry, not paint.
# A model paints planks into an equirect as it likes: they arc, and at the picture's own wrap join the two sides meet in a V (04-living,
# 02-kitchen; a band repaint only turned the V into a chevron). Here the floor's LIGHT (sun patches, shadows, tone) stays the model's —
# the answer, bilateral-filtered so its painted plank lines go and its shadows stay — and the plank pattern is laid on the true floor
# plane: each floor pixel's ray is intersected with the plane cam_z below the camera, in WORLD bearings (the camera's yaw_deg from
# plan.general.json), so planks are straight, parallel, the same width in every tab, run the same way through the whole apartment, and
# have no join anywhere. The floor is where the finish changed the pick (Lab distance, below the horizon); rugs and furniture are not.
#   usage: floor_planks.py <pick.png> <finish answer.png> <camera yaw_deg> <cam_z cm> <out.png> [--bearing 111.3] [--plank 0.19x1.9] [--debug mask.png]
import json, os, sys
import cv2
import numpy as np

a = [x for x in sys.argv[1:] if not x.startswith('--')]
def opt(n, d):
    return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d
pick, answer, yaw0, camz, out = a[0], a[1], float(a[2]), float(a[3]) / 100.0, a[4]
BEAR = float(opt('--bearing', '111.3'))
PW, PL = map(float, opt('--plank', '0.19x1.9').split('x'))
P = cv2.imread(pick, cv2.IMREAD_COLOR); A = cv2.imread(answer, cv2.IMREAD_COLOR)
H, W = A.shape[:2]
if P.shape[:2] != (H, W): P = cv2.resize(P, (W, H), interpolation=cv2.INTER_LANCZOS4)

# 1. the floor = where the finish changed the pick, below the horizon
la = cv2.cvtColor(A, cv2.COLOR_BGR2LAB).astype(np.float32); lp = cv2.cvtColor(P, cv2.COLOR_BGR2LAB).astype(np.float32)
# OpenCV Lab is 0..255 with a*, b* offset by 128. The floor went from a pale tile to honey wood: b* rose and is clearly yellow;
# a cream sofa or rug that the edit merely brightened did not move toward yellow, so it is not floor.
db = cv2.GaussianBlur(la[..., 2] - lp[..., 2], (0, 0), 1.5); ab = cv2.GaussianBlur(la[..., 2], (0, 0), 1.5) - 128
m = ((db > float(opt('--delta', '5'))) & (ab > float(opt('--wood-b', '15')))).astype(np.uint8); m[: H // 2 + 6] = 0
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] < 400: m[lab == i] = 0
m = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
M = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)[..., None]

# 2. the floor's light without the painted planks
base = A.copy()
for _ in range(4): base = cv2.bilateralFilter(base, 13, 22, 7)
# straight below the camera a model's planks meet in a star: there the light is smoothed harder (a soft ramp from 62 deg down)
soft = cv2.GaussianBlur(base, (0, 0), 9); wn = np.clip(((np.arange(H) / H) - 0.845) / 0.06, 0, 1).astype(np.float32)[:, None, None]
base = (base.astype(np.float32) * (1 - wn) + soft.astype(np.float32) * wn).astype(np.uint8)

# 3. the plank pattern on the floor plane, supersampled 3x and area-averaged
SS = 3; W3, H3 = W * SS, (H // 2) * SS
xs = (np.arange(W3) + 0.5) / W3; ys = (np.arange(H3) + 0.5) / H3
yaw = np.deg2rad(yaw0 + xs * 360.0 - 180.0 - BEAR)[None, :]            # bearing relative to the plank direction
pitch = np.deg2rad(ys * 90.0)[:, None]                                  # below the horizon, 0..90
r = camz / np.tan(np.maximum(pitch, 1e-4))
along = r * np.cos(yaw); across = r * np.sin(yaw)
row = np.floor(across / PW)
def h(*v):
    s = sum(x * k for x, k in zip(v, (127.1, 311.7, 74.7, 19.19)))
    return (np.sin(s) * 43758.5453) % 1.0
off = h(row) * PL
col = np.floor((along + off) / PL)
fa = across / PW - row; fl = (along + off) / PL - col
t_pl = h(row, col) * 2 - 1
strip = np.floor(fa * 9)
t_st = h(row, col, strip) * 2 - 1
GAP = 0.0035
gap = ((fa < GAP / PW) | (fa > 1 - GAP / PW) | (fl < GAP / PL) | (fl > 1 - GAP / PL)).astype(np.float32)
mult = (1 + 0.045 * t_pl + 0.010 * t_st) * (1 - 0.16 * gap)
warm = 0.012 * t_pl                                                      # a little hue with the tone
mult = np.where(r > 40, 1.0, mult).astype(np.float32); warm = np.where(r > 40, 0.0, warm).astype(np.float32)
mult = cv2.resize(mult, (W, H // 2), interpolation=cv2.INTER_AREA); warm = cv2.resize(warm, (W, H // 2), interpolation=cv2.INTER_AREA)
full = np.ones((H, W), np.float32); full[H // 2:] = mult
fw = np.zeros((H, W), np.float32); fw[H // 2:] = warm
floor = base.astype(np.float32) * full[..., None]
floor[..., 0] *= (1 - fw); floor[..., 2] *= (1 + fw)                     # BGR: warmer planks are a touch redder, less blue
R = (A.astype(np.float32) * (1 - M) + floor * M).round().clip(0, 255).astype(np.uint8)
cv2.imwrite(out, R)
if '--debug' in sys.argv: cv2.imwrite(opt('--debug', ''), m * 255)
side = {'version': 3, 'kind': 'object-paste', 'parent': os.path.basename(answer),
        'object_paste': {'from': os.path.basename(answer), 'tool': 'Habait/tour360/tools/floor_planks.py', 'args': f'yaw {yaw0} z {camz} bearing {BEAR} plank {PW}x{PL}',
                         'masked_px': int(m.sum()), 'why': 'the parquet planks laid on the true floor plane (straight, one direction through the apartment, no wrap join); the light is the finish answer\'s'},
        'cuts': [], 'note': 'no band cut: the floor mask is where the finish changed the pick'}
json.dump(side, open(out[:-4] + '.seam.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(json.dumps({'out': out, 'floor_share': round(float(m.mean()), 4)}))

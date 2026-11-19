"""kedma-d1 2026-11-18: the bath door's lower part kept the render's tan (plus an oak strip from view t180) under a cream upper door.
Below row ys, every door pixel (by the render's door colour) becomes the even cream of the band [ys-bh, ys) of the same column
(smoothed across columns), times the render's own shading ratio; a 60-row feather. $0. Atomic write; canvas.before-door.png kept.
usage: python door_extend.py <redo dir> x0 x1 ys y1 [bh]   (canvas pixels; x may wrap)"""
import cv2, sys, os, numpy as np, json
R = sys.argv[1]; x0, x1, ys, y1 = map(int, sys.argv[2:6]); bh = int(sys.argv[6]) if len(sys.argv) > 6 else 220
c = cv2.imread(os.path.join(R, 'canvas.png')); cg = cv2.imread(os.path.join(R, 'cg.png'))
W = c.shape[1]; cols = np.array([(x % W) for x in range(x0, x1 + (W if x1 < x0 else 0))])
if not os.path.exists(os.path.join(R, 'canvas.before-door.png')): cv2.imwrite(os.path.join(R, 'canvas.before-door.png'), c)
y0 = ys - bh
cs = c[y0:y1][:, cols].astype(np.float32); gs = cg[y0:y1][:, cols].astype(np.float32)
D = (np.linalg.norm(gs - np.array([95, 128, 160], np.float32), axis=2) < 45)
D = cv2.morphologyEx(D.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)).astype(bool)
gl = cv2.GaussianBlur(gs.mean(2), (0, 0), 8)
band = D[:bh] & (cs[:bh].mean(2) > 170)
n = band.sum(0); ok = n > 20
fill = np.zeros((len(cols), 3), np.float32); ref = np.zeros(len(cols), np.float32)
for j in np.where(ok)[0]:
    m = band[:, j]; fill[j] = cs[:bh][m, j].mean(0); ref[j] = gl[:bh][m, j].mean()
idx = np.arange(len(cols))
for k in range(3):
    fill[:, k] = np.interp(idx, idx[ok], fill[ok, k])
ref = np.interp(idx, idx[ok], ref[ok])
fill = cv2.GaussianBlur(fill.reshape(1, -1, 3), (0, 0), 20).reshape(-1, 3); ref = cv2.GaussianBlur(ref.reshape(1, -1), (0, 0), 20).ravel()
shade = np.clip(gl / (ref[None, :] + 1e-3), 0.6, 1.15)
new = fill[None, :, :] * shade[:, :, None]
w = np.clip((np.arange(y1 - y0) - bh + 60) / 60.0, 0, 1)[:, None] * D
out = cs * (1 - w[:, :, None]) + new * w[:, :, None]
c[y0:y1, cols] = np.clip(out, 0, 255).astype(np.uint8)
tmp = os.path.join(R, 'canvas.tmp.png'); cv2.imwrite(tmp, c); os.replace(tmp, os.path.join(R, 'canvas.png'))
print(json.dumps({"step": "door-extend", "changed_px": int((w > 0).sum()), "cols_with_band": int(ok.sum()), "cols": len(cols)}))

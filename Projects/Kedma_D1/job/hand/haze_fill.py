"""kedma-d1 2026-11-19, balcony: the render's flat pale-green ground plane beyond the railing reads as floor to the image model (it
invented a second terrace twice). For the model's input only, the plane (its large connected regions, unpainted pixels) is replaced by a
neutral haze that brightens toward the horizon. Painted mask untouched: the model's answer replaces it. $0. Atomic write.
usage: python haze_fill.py <redo dir>"""
import cv2, sys, os, json, numpy as np
R = sys.argv[1]
c = cv2.imread(os.path.join(R, 'canvas.png')); g = cv2.imread(os.path.join(R, 'cg.png')); p = cv2.imread(os.path.join(R, 'painted.png'), 0)
H, W = c.shape[:2]; gi = g.astype(int); r_, g_, b_ = gi[..., 2], gi[..., 1], gi[..., 0]
plane = ((r_ >= 160) & (r_ <= 195) & (g_ >= 163) & (g_ <= 198) & (b_ >= 145) & (b_ <= 182) & (g_ - b_ >= 8) & (g_ - b_ <= 28)).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(plane, 8)
keep = np.zeros_like(plane)
for i in range(1, n):
    if st[i, 4] > 0.01 * H * W: keep[lab == i] = 1
keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)).astype(bool) & (p < 128)
ys, xs = np.where(keep); pit = (0.5 - ys / H) * 180.0
t = np.clip(-pit / 60.0, 0, 1)[:, None]                       # 0 at the horizon, 1 at 60 deg down
top = np.array([228, 222, 214], np.float32); low = np.array([196, 200, 196], np.float32)   # BGR: pale haze -> soft grey-green
cv2.imwrite(os.path.join(R, 'canvas.before-haze.png'), c)
c[ys, xs] = (top * (1 - t) + low * t).astype(np.uint8)
tmp = os.path.join(R, 'tmp_canvas.png'); cv2.imwrite(tmp, c); os.replace(tmp, os.path.join(R, 'canvas.png'))
print(json.dumps({"step": "haze-fill", "px": int(len(xs))}))

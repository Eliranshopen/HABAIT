"""kedma-d1 2026-11-19, balcony ($0): (1) orange smears at the wall foot (yaw 100..300, pitch -20..-88, pale: brighter than the terracotta pot) are
inpainted; (2) the floor under the camera (render floor, pitch < -52) is colour-matched to the painted floor ring at pitch -35..-48
(per-channel mean ratio normalised to keep brightness, blended in over 6 deg). Atomic write; canvas.before-touchup.png kept.
usage: python balcony_touchup.py <redo dir>"""
import cv2, sys, os, json, numpy as np
R = sys.argv[1]
c = cv2.imread(os.path.join(R, 'canvas.png')); g = cv2.imread(os.path.join(R, 'cg.png')); H, W = c.shape[:2]
cv2.imwrite(os.path.join(R, 'canvas.before-touchup.png'), c)
yy, xx = np.mgrid[0:H, 0:W]; yaw = (xx / W - 0.5) * 360.0; pit = (0.5 - yy / H) * 180.0
ci = c.astype(int); r_, g_, b_ = ci[..., 2], ci[..., 1], ci[..., 0]
orange = (r_ > 170) & (r_ - b_ > 45) & (g_ < r_ - 15) & (yaw > 100) & (yaw < 300) & (pit < -20) & (pit > -88) & ((r_ + g_ + b_) > 480)
m = cv2.dilate(orange.astype(np.uint8), np.ones((15, 15), np.uint8))
n_or = int(orange.sum())
if n_or: c = cv2.inpaint(c, m, 11, cv2.INPAINT_TELEA)
gi = g.astype(int); floor_cg = (gi.min(2) > 175) & (gi.max(2) - gi.min(2) < 18)
ring = floor_cg & (pit < -35) & (pit > -48); core = floor_cg & (pit < -52)
gain = c[ring].reshape(-1, 3).astype(np.float32).mean(0) / np.maximum(c[core].reshape(-1, 3).astype(np.float32).mean(0), 1)
gain = gain / gain.mean()   # colour only: the floor keeps its own brightness
w = (np.clip((-52 - pit) / 6.0, 0, 1) * core)[..., None]
c = np.clip(c.astype(np.float32) * (1 - w + w * gain[None, None, :]), 0, 255).astype(np.uint8)
tmp = os.path.join(R, 'tmp_canvas.png'); cv2.imwrite(tmp, c); os.replace(tmp, os.path.join(R, 'canvas.png'))
print(json.dumps({"step": "balcony-touchup", "orange_px": n_or, "floor_gain_bgr": [round(float(x), 3) for x in gain]}))

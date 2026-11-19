# $0: move the object a band repaint added (where the repaint differs from its parent, inside given rows/cols) by (dx, dy) px onto the
# parent, feathered; used for 04's oven, which the model painted ~4 deg left of the hob. usage: shift_patch.py parent repaint out u0 u1 v0 v1 dx dy
import sys, json
import cv2, numpy as np
P = cv2.imread(sys.argv[1]); R = cv2.imread(sys.argv[2]); out = sys.argv[3]
u0, u1, v0, v1 = map(float, sys.argv[4:8]); dx, dy = int(sys.argv[8]), int(sys.argv[9]); sy = float(sys.argv[10]) if len(sys.argv) > 10 else 1.0
H, W = P.shape[:2]
x0, x1, y0, y1 = int(u0 * W), int(u1 * W), int(v0 * H), int(v1 * H)
d = cv2.GaussianBlur(np.abs(R.astype(np.int16) - P.astype(np.int16)).max(axis=2).astype(np.uint8), (0, 0), 1.5)
m = np.zeros((H, W), np.uint8); m[y0:y1, x0:x1] = (d[y0:y1, x0:x1] > 22).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(m)
k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
bx, by, bw, bh = st[k, 0], st[k, 1], st[k, 2], st[k, 3]
box = np.zeros((H, W), np.float32); box[by:by + bh, bx:bx + bw] = 1
M = np.float32([[1, 0, dx], [0, sy, dy + by * (1 - sy)]])   # vertical scale sy about the box top
Rs = cv2.warpAffine(R, M, (W, H)); Bs = cv2.warpAffine(box, M, (W, H))
Bs = cv2.GaussianBlur(Bs, (0, 0), 1.2)[..., None]
O = (P * (1 - Bs) + Rs * Bs).astype(np.uint8)
cv2.imwrite(out, O)
print(json.dumps({"box": [int(bx), int(by), int(bw), int(bh)], "moved": [dx, dy], "y_scale": sy}))

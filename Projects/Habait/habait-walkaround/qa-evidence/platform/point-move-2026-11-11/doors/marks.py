# marks.py <out.jpg> <asset> <centre yaw> <label:yaw> [<label:yaw> ...] — a 150° wide view of a room picture with a mark where a door button stands
import sys, cv2, numpy as np
sys.path.insert(0, 'C:/Users/elira/AppData/Local/Temp/claude/76e6db1160dffba0/6ebc3d8f-7b16-4880-90d0-725aacae9a04/scratchpad/fly')
import persp
A = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846/_local/panos-parquet/'
out, asset, cy = sys.argv[1], sys.argv[2], float(sys.argv[3])
src = cv2.imread(A + asset + '.webp'); W, H, HF, P = 1500, 640, 130, -10
im = persp.view(src, cy, P, HF, W, H)
tx = np.tan(np.radians(HF) / 2); ty = tx * H / W; cp, sp = np.cos(np.radians(P)), np.sin(np.radians(P))
for a in sys.argv[4:]:
    lab, yw = a.split(':'); yw = float(yw); d = np.radians(((yw - cy + 540) % 360) - 180); pt = np.radians(-14)
    v = np.array([np.cos(pt) * np.sin(d), np.sin(pt), np.cos(pt) * np.cos(d)])
    y2 = v[1] * cp - v[2] * sp; z2 = v[1] * sp + v[2] * cp
    if z2 <= 0.05: continue
    x = int((v[0] / z2 / tx + 1) / 2 * W); y = int((1 - y2 / z2 / ty) / 2 * H)
    cv2.circle(im, (x, y), 22, (0, 0, 255), 5); cv2.putText(im, lab + ' ' + str(int(yw)), (x - 60, y - 32), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 3)
cv2.imwrite(out, im, [cv2.IMWRITE_JPEG_QUALITY, 85]); print('ok', out)

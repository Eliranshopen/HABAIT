import sys, cv2, numpy as np
from pathlib import Path
root = Path(sys.argv[1])
img = cv2.imdecode(np.fromfile(str(root/'input'/'b4-floor-minus2-apts-7-8.jpg'), dtype=np.uint8), cv2.IMREAD_COLOR)
m = cv2.imdecode(np.fromfile(str(root/'work'/'wall-mask-raw.png'), dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
x0, y0, x1, y1 = 300, 250, 3700, 5400
crop = img[y0:y1, x0:x1].copy()
mm = m[y0:y1, x0:x1]
ov = crop.copy(); ov[mm > 0] = (0, 0, 255)
out = cv2.addWeighted(crop, 0.45, ov, 0.55, 0)
s = 1700 / out.shape[0]
cv2.imencode('.jpg', cv2.resize(out, None, fx=s, fy=s, interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tofile(str(root/'work'/'mask-overlay.jpg'))
cv2.imencode('.png', crop)[1].tofile(str(root/'work'/'plan-crop.png'))
print(out.shape, s)

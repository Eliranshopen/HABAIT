"""Overlay of the kept wall mask (red) and the dropped wall-grey blobs (blue) on the sheet, for a visual check ($0)."""
import sys, cv2, numpy as np
from pathlib import Path
root = Path(sys.argv[1])
img = cv2.imdecode(np.fromfile(str(root/'input'/'b10-floor1-apts-3-4.jpg'), dtype=np.uint8), cv2.IMREAD_COLOR)
raw = cv2.imdecode(np.fromfile(str(root/'work'/'wall-mask-raw.png'), dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
m = cv2.imdecode(np.fromfile(str(root/'work'/'wall-mask.png'), dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
x0, y0, x1, y1 = 250, 200, 3400, 3250
crop = img[y0:y1, x0:x1].copy()
ov = crop.copy(); ov[raw[y0:y1, x0:x1] > 0] = (255, 0, 0); ov[m[y0:y1, x0:x1] > 0] = (0, 0, 255)
out = cv2.addWeighted(crop, 0.45, ov, 0.55, 0)
s = 1800 / out.shape[1]
cv2.imencode('.jpg', cv2.resize(out, None, fx=s, fy=s, interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tofile(str(root/'work'/'mask-overlay.jpg'))
print(out.shape, s)

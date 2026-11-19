"""Step 13 - the walkaround's backdrop: the scene's own HDRI, turned as in Blender's world, remapped to three.js's
equirectangular convention and tone-mapped to a display JPEG (walkaround/model/sky.jpg).

Blender (Cycles) samples the HDRI at v' = Rz(theta) . d_blender, theta = sun_azimuth_image - sun_azimuth_model (build-report),
  u = 0.5 - atan2(y', x') / 2pi,  v_from_bottom = asin(z') / pi + 0.5.
three.js background: u = atan2(d.z, d.x) / 2pi + 0.5, v = asin(d.y) / pi + 0.5 (row 0 = top); d_blender = (x, -z, y).
Usage: python 13_walk_sky.py <job root> [--w 4096] [--exposure 0.9]
"""
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np

root = Path(sys.argv[1])
W = int(sys.argv[sys.argv.index("--w") + 1]) if "--w" in sys.argv else 4096
EXP = float(sys.argv[sys.argv.index("--exposure") + 1]) if "--exposure" in sys.argv else 0.9
rep = json.loads((root / "scene" / "build-report.json").read_text(encoding="utf-8"))["hdri"]
theta = math.radians(rep["sun_azimuth_image_deg"] - rep["sun_azimuth_model_deg"])
hdr = cv2.imread(str(root / "assets" / "polyhaven" / "hdri" / rep["file"]), cv2.IMREAD_ANYDEPTH | cv2.IMREAD_COLOR)
Hs, Ws = hdr.shape[:2]
H = W // 2
c = (np.arange(W) + 0.5) / W
r = (np.arange(H) + 0.5) / H
u, v = np.meshgrid(c, 1.0 - r)
phi = (u - 0.5) * 2 * math.pi
lat = (v - 0.5) * math.pi
dx, dy, dz = np.cos(lat) * np.cos(phi), np.sin(lat), np.cos(lat) * np.sin(phi)
bx, by, bz = dx, -dz, dy
x2 = math.cos(theta) * bx - math.sin(theta) * by
y2 = math.sin(theta) * bx + math.cos(theta) * by
ub = (0.5 - np.arctan2(y2, x2) / (2 * math.pi)) % 1.0
vb = np.arcsin(np.clip(bz, -1, 1)) / math.pi + 0.5
mx = (ub * Ws - 0.5).astype(np.float32)
my = ((1.0 - vb) * Hs - 0.5).astype(np.float32)
img = cv2.remap(hdr, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
x = img * EXP
lum = 0.2126 * x[..., 2] + 0.7152 * x[..., 1] + 0.0722 * x[..., 0]
scale = (1 + lum / 9.0) / (1 + lum)  # Reinhard with a white point, on luminance
x = x * scale[..., None]
out = np.clip(np.power(np.clip(x, 0, None), 1 / 2.2), 0, 1)
out_dir = root / "walkaround" / "model"
out_dir.mkdir(parents=True, exist_ok=True)
cv2.imencode(".jpg", (out * 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tofile(str(out_dir / "sky.jpg"))
# where the sun lands in three.js's frame (a check: it must be the model azimuth, -38 deg from +x toward -y_blender = +z_three?)
iy, ix = np.unravel_index(np.argmax(lum), lum.shape)
ph = ((ix + 0.5) / W - 0.5) * 360
print("sky", W, H, "theta", round(math.degrees(theta), 1), "sun at three.js azimuth atan2(z,x) =", round(ph, 1),
      "deg; elevation", round(((1 - (iy + 0.5) / H) - 0.5) * 180, 1))

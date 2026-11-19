"""Step 28 - close the 360 seam of a realism panorama ($0). The AI answer's left and right edges do not join exactly
(kitchen 2026-11-18: GPT Image 2.5 seam 5.8 vs Blender 2.5, mean |first column - last column|). The two edge bands
(--band px each side) are cross-faded toward their common average, so column 0 and column W-1 become equal and the
change fades to nothing at the band's inner edge. Writes the result over <out> (JPEG q92 + the PNG) and prints the seam before/after.
Usage: python scripts/28_pano_seam.py <in.png> <out.jpg> [--band 96]
"""
import sys

import numpy as np
from PIL import Image

a = sys.argv[1:]
src, out = a[0], a[1]
band = int(a[a.index("--band") + 1]) if "--band" in a else 96
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = im.shape
seam0 = float(np.abs(im[:, 0] - im[:, -1]).mean())
L = im[:, :band].copy()          # columns 0..band-1
R = im[:, W - band:][:, ::-1].copy()   # columns W-1 down to W-band (mirror order: R[:,k] is column W-1-k)
avg = (L + R) / 2
w = (1 - np.arange(band, dtype=np.float32) / band)[None, :, None] ** 1.5   # 1 at the seam → 0 inside
im[:, :band] = L * (1 - w) + avg * w
im[:, W - band:] = (R * (1 - w) + avg * w)[:, ::-1]
seam1 = float(np.abs(im[:, 0] - im[:, -1]).mean())
img = Image.fromarray(np.clip(im, 0, 255).astype(np.uint8))
img.save(out, quality=92)
print("SEAM", src, f"{seam0:.1f} -> {seam1:.1f}", f"{W}x{H}")

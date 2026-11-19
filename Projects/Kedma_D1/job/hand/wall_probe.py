"""kedma-d1 hand trace, step 1 ($0): find the wall fill colour of the sheet and write a clean wall mask.

Reads the job's own copy of the sales plan (never the original), renders it at native resolution and
reports the dominant dark-grey colour (the wall fill), then writes:
  hand/sheet.png        the page at native resolution
  hand/wallmask.png     white = wall fill after an opening that drops furniture strokes
  hand/wall_probe.json  the colour, the tolerance, the counts
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import pymupdf

job = Path(sys.argv[1])
out = job / "hand"
out.mkdir(parents=True, exist_ok=True)
doc = pymupdf.open(job / "input" / "bldg-d-apt-1.pdf")
page = doc[0]
# the page holds one embedded image; render at its native pixel size
img_w = page.get_images(full=True)[0][2]
scale = img_w / page.rect.width
pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).copy()
cv2.imwrite(str(out / "sheet.png"), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))

# dominant dark neutral colour = the wall fill
r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
neutral = (abs(r - g) <= 6) & (abs(g - b) <= 6)
grey = ((r + g + b) // 3).astype(np.uint8)
hist = np.bincount(grey[neutral & (grey < 140)], minlength=256)
peak = int(hist[:140].argmax())
tol = 10
mask = (neutral & (abs(grey.astype(int) - peak) <= tol)).astype(np.uint8) * 255
raw = int((mask > 0).sum())
# opening: drops anything thinner than ~2*k px (furniture strokes, text); walls are tens of px thick
k = int(sys.argv[2]) if len(sys.argv) > 2 else 9
ker = cv2.getStructuringElement(cv2.MORPH_RECT, (2 * k + 1, 2 * k + 1))
opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, ker)
cv2.imwrite(str(out / "wallmask.png"), opened)
n, lab, stats, _ = cv2.connectedComponentsWithStats(opened, connectivity=8)
comps = sorted(
    [dict(id=i, x=int(s[0]), y=int(s[1]), w=int(s[2]), h=int(s[3]), area=int(s[4])) for i, s in enumerate(stats) if i],
    key=lambda c: -c["area"],
)
rep = dict(size=[pix.width, pix.height], wall_grey_peak=peak, tol=tol, raw_px=raw, opened_px=int((opened > 0).sum()),
           open_radius_px=k, components=len(comps), top=comps[:40],
           hist_top=[[int(v), int(hist[v])] for v in np.argsort(hist)[::-1][:6]])
(out / "wall_probe.json").write_text(json.dumps(rep, indent=1), encoding="utf-8")
print(json.dumps({k2: rep[k2] for k2 in ("size", "wall_grey_peak", "raw_px", "opened_px", "components", "hist_top")}))
for c in comps[:40]:
    print(c)

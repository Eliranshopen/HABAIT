"""Audit helper: render a clip of one brochure page. usage: pdfclip.py page name x0 y0 x1 y1 dpi [rotate]"""
import sys
from pathlib import Path
import pymupdf
here = Path(__file__).resolve().parent
root = here.parent.parent
doc = pymupdf.open(str(root / "input" / "brochure-naama.pdf"))
page = doc[int(sys.argv[1]) - 1]
x0, y0, x1, y1 = map(float, sys.argv[3:7])
dpi = int(sys.argv[7])
pix = page.get_pixmap(dpi=dpi, clip=pymupdf.Rect(x0, y0, x1, y1))
out = here / f"{sys.argv[2]}.png"
pix.save(str(out))
if len(sys.argv) > 8:
    import cv2, numpy as np
    img = cv2.imdecode(np.fromfile(str(out), dtype=np.uint8), cv2.IMREAD_COLOR)
    r = {"cw": cv2.ROTATE_90_CLOCKWISE, "ccw": cv2.ROTATE_90_COUNTERCLOCKWISE}[sys.argv[8]]
    img = cv2.rotate(img, r)
    cv2.imencode(".png", img)[1].tofile(str(out))
print(out.name, pix.width, pix.height)

"""sheet_zoom.py - cut a gridded crop of the sheet for reading positions by eye (pixels of the sheet).
Usage: python -I sheet_zoom.py <sheet.jpg> <out.png> x0 y0 x1 y1 [step]
Same idea as Kedma's hand/sheet_zoom.py (read fixtures on a grid, never by feel); new implementation."""
import sys
from PIL import Image, ImageDraw, ImageFont
Image.MAX_IMAGE_PIXELS = None
sheet, out = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = [int(v) for v in sys.argv[3:7]]
step = int(sys.argv[7]) if len(sys.argv) > 7 else 100
im = Image.open(sheet).convert('RGB').crop((x0, y0, x1, y1))
d = ImageDraw.Draw(im, 'RGBA')
try:
    f = ImageFont.truetype('arial.ttf', 20)
except Exception:
    f = ImageFont.load_default()
for x in range((x0 // step + 1) * step, x1, step):
    major = x % (step * 5) == 0
    d.line([(x - x0, 0), (x - x0, y1 - y0)], fill=(255, 0, 0, 150 if major else 70), width=1)
    d.text((x - x0 + 2, 2), str(x), fill=(200, 0, 0, 255), font=f)
for y in range((y0 // step + 1) * step, y1, step):
    major = y % (step * 5) == 0
    d.line([(0, y - y0), (x1 - x0, y - y0)], fill=(0, 0, 255, 150 if major else 70), width=1)
    d.text((2, y - y0 + 2), str(y), fill=(0, 0, 200, 255), font=f)
im.save(out)
print(out, im.size)

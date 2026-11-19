# gridcrop.py <out.png> <scale> x0 y0 x1 y1 <img> [<img> ...] : the same box of several equirects side by side, with a 10-px grid labelled every 20 px
import sys
from PIL import Image, ImageDraw
out, sc = sys.argv[1], int(sys.argv[2]); x0, y0, x1, y1 = map(int, sys.argv[3:7]); files = sys.argv[7:]
w, h = (x1 - x0) * sc, (y1 - y0) * sc
S = Image.new('RGB', (len(files) * (w + 6), h), '#000')
for i, f in enumerate(files):
    c = Image.open(f).convert('RGB').crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS); d = ImageDraw.Draw(c)
    for x in range(x0 - x0 % 20 + 20, x1, 20):
        d.line([((x - x0) * sc, 0), ((x - x0) * sc, 8)], fill=(255, 0, 0)); d.text(((x - x0) * sc + 2, 8), str(x), fill=(255, 0, 0))
    for y in range(y0 - y0 % 20 + 20, y1, 20):
        d.line([(0, (y - y0) * sc), (8, (y - y0) * sc)], fill=(255, 0, 0)); d.text((10, (y - y0) * sc - 5), str(y), fill=(255, 0, 0))
    S.paste(c, (i * (w + 6), 0))
S.save(out)

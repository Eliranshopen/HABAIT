"""contact.py - a labelled contact sheet of images.  usage: python -I contact.py <out.jpg> <cols> <cell_w> <img>..."""
import sys, os
from PIL import Image, ImageDraw, ImageFont
out, cols, cw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
ims = sys.argv[4:]
ch = int(cw * 2 / 3) + 34
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cw, rows * ch), 'white')
d = ImageDraw.Draw(sheet)
try:
    f = ImageFont.truetype('arial.ttf', 22)
except Exception:
    f = ImageFont.load_default()
for k, p in enumerate(ims):
    im = Image.open(p).convert('RGB'); im.thumbnail((cw - 8, ch - 38))
    x, y = (k % cols) * cw, (k // cols) * ch
    sheet.paste(im, (x + 4, y + 32))
    d.text((x + 6, y + 4), os.path.basename(os.path.dirname(p)) + '/' + os.path.basename(p), fill='black', font=f)
sheet.save(out, quality=86); print(out, sheet.size)

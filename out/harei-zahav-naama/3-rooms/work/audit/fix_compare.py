"""Side by side for the 2026-11-18 render fixes: developer render crop (left) | our proof still (right) -> qa/360/fixes/cmp-*.jpg.
Run from the job root: python work/audit/fix_compare.py
Render crops are fractions (x0, y0, x1, y1) of the developer image; `mirror` flips it so it reads in plan orientation."""
import os

from PIL import Image, ImageDraw

R = "C:/RnD/Projects/Harey_zahav_Naama"
F = "qa/360/fixes"
PAIRS = [
    ("cmp-kitchen.jpg", "1_CShading_LightMix.jpg", (0.42, 0.15, 1.0, 0.62), False, "kitchen-south-wall.png", "kitchen: oak uppers right of window, shelves left, roman blind"),
    ("cmp-bath-wc.jpg", "Corona-Camera0020000_Post-3.jpg", (0.0, 0.0, 1.0, 1.0), False, "bath-wc-shower.png", "bath: WC wall cabinet + niche, curtain on black rail, drawer vanity, globes"),
    ("cmp-bath-vanity.jpg", "Corona-Camera0020000_Post-3.jpg", (0.08, 0.2, 0.75, 0.95), False, "bath-vanity.png", "bath: drawer vanity, integrated basin, wall taps, globe lights"),
    ("cmp-saferoom.jpg", "Corona-Camera0030000_Post.jpg", (0.0, 0.0, 1.0, 1.0), False, "saferoom-window.png", "safe room: full-height sheer on a ceiling track"),
]
H = 620
for out, ref, crop, mirror, ours, label in PAIRS:
    if not os.path.exists(os.path.join(F, ours)):
        continue
    a = Image.open(os.path.join(R, ref)).convert("RGB")
    w, h = a.size
    a = a.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
    if mirror:
        a = a.transpose(Image.FLIP_LEFT_RIGHT)
    b = Image.open(os.path.join(F, ours)).convert("RGB")
    a = a.resize((int(a.width * H / a.height), H))
    b = b.resize((int(b.width * H / b.height), H))
    c = Image.new("RGB", (a.width + b.width + 10, H + 30), "white")
    c.paste(a, (0, 30))
    c.paste(b, (a.width + 10, 30))
    d = ImageDraw.Draw(c)
    d.text((6, 8), "RENDER " + ref, fill="black")
    d.text((a.width + 16, 8), "OURS (Blender, after fix): " + label, fill="black")
    c.save(os.path.join(F, out), quality=88)
    print("CMP", out)

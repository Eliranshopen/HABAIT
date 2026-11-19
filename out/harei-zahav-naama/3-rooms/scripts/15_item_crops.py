"""Cut every furniture/decor item out of the developer's interior renders ($0) and measure its colours.

Run: python scripts/15_item_crops.py <job_dir>
Reads  input renders from Projects/Harey_zahav_Naama (originals, read only)
Writes items/crops/<id>.png, items/items.json (id, room, render, box, dominant colours as hex with share)
"""
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image

JOB = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
SRC = r"C:\RnD\Projects\Harey_zahav_Naama"
R = {
    "kitchen": "1_CShading_LightMix.jpg",
    "tvwall": "Corona-Camera0060000_Post_LightMix-Interactive.jpg",
    "corner": "Corona-Camera0050000_Post_LightMix-Interactive.jpg",
    "dining": "Corona-Camera0040000_Post.jpg",
    "kids": "Corona-Camera0030000_Post.jpg",
    "shelf": "Corona-Camera0070000_Post.jpg",
    "bath": "Corona-Camera0020000_Post-3.jpg",
}
# id: (room in the house, render, box x0 y0 x1 y1 in render pixels, what it is)
ITEMS = {
    "sofa_modular":     ("living", "tvwall", (130, 1040, 1480, 1460), "3-module low sofa, rounded edges, oatmeal linen, back view"),
    "sofa_front":       ("living", "kitchen", (0, 1060, 1030, 1500), "the same sofa from the front, with cushions and a pleated throw"),
    "lounge_chair":     ("living", "corner", (490, 840, 1065, 1340), "low lounge chair, dark-stained wood frame, woven paper-cord seat and back"),
    "coffee_table":     ("living", "corner", (0, 1100, 520, 1500), "round oak coffee table on a fluted drum base"),
    "mushroom_lamp":    ("living", "corner", (0, 955, 135, 1140), "mushroom table lamp, opal glass shade, cream base"),
    "wall_sconce":      ("living", "corner", (1110, 230, 1200, 390), "round wall sconce, oak dish with an opal globe"),
    "vase_branches":    ("living", "tvwall", (240, 810, 480, 1025), "clear glass vase with olive branches"),
    "ribbed_vase":      ("living", "corner", (505, 655, 610, 785), "ribbed white ceramic egg vase"),
    "bar_stool":        ("kitchen", "kitchen", (995, 885, 1175, 1245), "counter stool, solid oak, curved backrest, woven white cord seat"),
    "paper_pendant":    ("kitchen", "kitchen", (880, 555, 950, 685), "cylinder paper pendant, white rice paper with ribs"),
    "kitchen_props":    ("kitchen", "kitchen", (850, 770, 1000, 900), "walnut cutting boards and a glass carafe"),
    "dining_table":     ("dining", "dining", (160, 895, 1035, 1310), "solid oak dining table with thick square legs"),
    "dining_chair":     ("dining", "dining", (10, 930, 280, 1285), "dining chair, oak legs, curved upholstered greige backrest and seat"),
    "rattan_pendant":   ("dining", "dining", (295, 275, 545, 590), "large woven rattan bell pendant"),
    "globe_lamp":       ("dining", "dining", (580, 580, 700, 668), "opal globe table lamp in a black wire frame"),
    "stone_bowl":       ("dining", "dining", (485, 875, 630, 940), "organic textured stone bowl"),
    "kids_bed":         ("saferoom", "kids", (80, 800, 990, 1180), "single bed, rounded upholstered cream headboard, linen bedding, clay throw"),
    "nightstand":       ("saferoom", "kids", (70, 990, 268, 1255), "rounded oak nightstand with an open shelf"),
    "paper_lantern":    ("saferoom", "kids", (465, 135, 730, 420), "flat oval paper lantern pendant"),
    "reading_lamp":     ("saferoom", "kids", (278, 680, 345, 790), "black wall reading lamp with a flexible arm"),
    "kids_rug":         ("saferoom", "kids", (228, 1105, 1100, 1285), "cream wool rug with a carved pattern"),
    "whale_plush":      ("saferoom", "kids", (495, 860, 645, 955), "cream whale plush toy"),
    "wood_toys":        ("saferoom", "shelf", (400, 380, 520, 560), "wooden toy house"),
    "vanity_double":    ("bath", "bath", (118, 1030, 885, 1385), "floating oak vanity with drawers, white top, open shelf with towels"),
    "mirror_black":     ("bath", "bath", (165, 350, 860, 875), "rectangular mirror with a thin black frame"),
    "bath_tap":         ("bath", "bath", (260, 920, 420, 1020), "black basin tap with lever handles"),
}


def colours(im, k=4):
    a = np.asarray(im.convert("RGB").resize((96, 96))).reshape(-1, 3).astype(float)
    rng = np.random.default_rng(0)
    c = a[rng.choice(len(a), k, replace=False)]
    for _ in range(20):
        lab = ((a[:, None, :] - c[None]) ** 2).sum(-1).argmin(1)
        c = np.array([a[lab == j].mean(0) if (lab == j).any() else c[j] for j in range(k)])
    share = np.bincount(lab, minlength=k) / len(a)
    order = share.argsort()[::-1]
    return [{"hex": "#%02x%02x%02x" % tuple(int(x) for x in c[j]), "share": round(float(share[j]), 3)} for j in order]


def main():
    out = os.path.join(JOB, "items", "crops")
    os.makedirs(out, exist_ok=True)
    rows = []
    for iid, (room, rk, box, what) in ITEMS.items():
        src = os.path.join(SRC, R[rk])
        im = Image.open(src)
        crop = im.crop(box)
        p = os.path.join(out, iid + ".png")
        crop.save(p)
        rows.append({"id": iid, "room": room, "render": R[rk], "box": list(box), "what": what,
                     "crop": os.path.relpath(p, JOB).replace("\\", "/"),
                     "sha256": hashlib.sha256(open(p, "rb").read()).hexdigest()[:16],
                     "colours": colours(crop)})
    json.dump({"source": SRC, "items": rows}, open(os.path.join(JOB, "items", "items.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)
    sheet_w = 6
    th = 220
    tiles = [Image.open(os.path.join(JOB, r["crop"])) for r in rows]
    sheet = Image.new("RGB", (sheet_w * th, ((len(tiles) + sheet_w - 1) // sheet_w) * th), (240, 238, 234))
    for i, t in enumerate(tiles):
        t.thumbnail((th - 8, th - 8))
        sheet.paste(t, ((i % sheet_w) * th + 4, (i // sheet_w) * th + 4))
    sheet.save(os.path.join(JOB, "items", "crops-sheet.png"))
    print("CROPS OK", len(rows))


if __name__ == "__main__":
    main()

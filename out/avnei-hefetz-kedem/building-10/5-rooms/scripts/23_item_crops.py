"""Step 23 ($0) - the pieces of Eliran's pictures (input/supplied/*.png): a full-resolution crop of each piece and its dominant
colours measured from the picture's own pixels -> items/crops/<id>.png + items/items.json (input of 24_item_3d.mjs).
Boxes are read off the 100 px grid drawn on the 1100 px previews (work/look/grids.jpg).
Usage: python 23_item_crops.py <job root>"""
import glob, json, os, sys
from PIL import Image

R = sys.argv[1]
SUP = sorted(glob.glob(os.path.join(R, "input", "supplied", "*.png")))
pic = lambda nn: next(p for p in SUP if f" - {nn} " in os.path.basename(p))
ITEMS = {
    "bed_parents": ("05", (170, 255, 740, 614), "a double bed with a tall grey velvet channel-tufted winged headboard, white sheets and pillows, a grey duvet, an upholstered grey base"),
    "bed_single": ("07", (570, 315, 895, 555), "a single bed with a light grey boucle upholstered base, white sheet and pillow, a grey duvet folded over the foot"),
    "nightstand": ("05", (10, 455, 240, 600), "a light oak nightstand with a vertically fluted (slatted) front, two drawers"),
    "mushroom_lamp": ("05", (55, 395, 160, 505), "a white mushroom table lamp: a glossy white dome shade on a white fluted cylindrical base"),
    "sofa": ("01", (825, 300, 1100, 614), "a light grey velvet three-seat sofa with square arms, deep seat cushions and back cushions"),
    "coffee_table": ("03", (0, 495, 290, 614), "a round light oak coffee table with a thick round top on a pedestal base"),
    "dining_table": ("03", (380, 300, 715, 500), "a rectangular dining table with a clear glass top on a black metal frame and black legs"),
    "dining_chair": ("03", (408, 335, 530, 545), "a dining chair upholstered in dark grey velvet with a high straight back and thin black legs"),
    "balcony_chair": ("12", (565, 470, 870, 614), "an outdoor lounge armchair: a grey woven rope frame on black metal legs with a grey seat cushion and back cushion"),
    "balcony_table": ("12", (580, 385, 720, 545), "a small round bistro table with a white marble top on a black metal X-frame base"),
    "planter_agave": ("12", (500, 200, 620, 350), "a tall black cylindrical planter with a large agave plant"),
    "plant_pachira": ("01", (0, 280, 110, 505), "a potted indoor palm plant in a round white ceramic pot"),
}
os.makedirs(os.path.join(R, "items", "crops"), exist_ok=True)
rows = []
for iid, (nn, box, what) in ITEMS.items():
    im = Image.open(pic(nn)).convert("RGB"); k = im.width / 1100
    c = im.crop(tuple(int(v * k) for v in box)); c.save(os.path.join(R, "items", "crops", f"{iid}.png"))
    q = c.resize((200, 200)).quantize(colors=5, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:15]
    cols = [{"hex": "#%02x%02x%02x" % tuple(pal[i * 3:i * 3 + 3]), "share": round(n / 40000, 3)} for n, i in sorted(q.getcolors(), reverse=True)]
    rows.append({"id": iid, "picture": os.path.basename(pic(nn)), "box_preview": box, "crop": f"items/crops/{iid}.png", "what": what, "colours": cols})
json.dump({"items": rows}, open(os.path.join(R, "items", "items.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(json.dumps([(r["id"], [c["hex"] for c in r["colours"]]) for r in rows]))

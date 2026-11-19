import urllib.request, sys, os, io
from PIL import Image, ImageDraw
UA = {"User-Agent": "asset-fetch/1.0"}
out = sys.argv[1]
H = ["hilly_terrain_01", "rolling_hills", "autumn_hill_view", "spaichingen_hill", "dry_orchard_meadow", "rural_landscape", "bloem_hill_01", "countrytrax_midday", "cape_hill", "fish_eagle_hill", "golden_gate_hills", "ehingen_hillside"]
M = ["sofa_02", "sofa_03", "coffee_table_round_01", "dining_table", "side_table_01", "round_wooden_table_01", "dining_chair_02", "modern_arm_chair_01", "outdoor_table_chair_set_01", "throw_pillows_01", "potted_plant_04", "pachira_aquatica_01"]
def grab(i, kind):
    p = os.path.join(out, f"{i}.png")
    if not os.path.exists(p):
        u = f"https://cdn.polyhaven.com/asset_img/{'primary' if kind=='h' else 'thumbs'}/{i}.png?height=300"
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
                open(p, "wb").write(r.read())
        except Exception as e:
            print("FAIL", i, e); return None
    return Image.open(p).convert("RGB")
for name, ids, kind, cols, cw, ch in (("hdris", H, "h", 3, 600, 300), ("models", M, "m", 4, 300, 300)):
    rows = (len(ids) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, rows * (ch + 22)), "white")
    d = ImageDraw.Draw(sheet)
    for n, i in enumerate(ids):
        im = grab(i, kind)
        x, y = (n % cols) * cw, (n // cols) * (ch + 22)
        if im:
            im.thumbnail((cw, ch)); sheet.paste(im, (x, y))
        d.text((x + 4, y + ch + 4), i, fill="black")
    sheet.save(os.path.join(out, f"sheet-{name}.jpg"), quality=85)
    print(name, sheet.size)

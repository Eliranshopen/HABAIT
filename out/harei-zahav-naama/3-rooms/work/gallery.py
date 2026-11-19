import json, os
from PIL import Image, ImageDraw, ImageFont
meta = {m['id']: m for m in json.load(open('items/items.json', encoding='utf-8'))['items']}
F = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 22); FB = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 26)
he = lambda s: s[::-1]   # PIL draws left-to-right: reverse Hebrew for display
ITEMS = [('sofa_corner', 'ספה פינתית', ['sofa_modular']), ('lounge_chair', 'כורסת חבל', None), ('rattan_pendant', 'מנורת ראטן', None),
         ('dining_chair', 'כיסא אוכל', None), ('dining_table', 'שולחן אוכל', None), ('alt_ctable_nesting', 'שולחנות קפה מקוננים', []),
         ('mushroom_lamp', 'מנורת שולחן', None), ('wall_sconce', 'מנורת קיר', None), ('vase_branches', 'אגרטל וענפים', None),
         ('ribbed_vase', 'אגרטל קרמיקה', None), ('globe_lamp', 'מנורת כדור', None), ('stone_bowl', 'קערת אבן', None),
         ('kitchen_props', 'קרשים וקנקן', None), ('kids_bed', 'מיטת ילדים', None), ('nightstand', 'שידת לילה', None),
         ('paper_lantern', 'מנורת נייר', None), ('kids_rug', 'שטיח', None)]
T = 300; HEAD = 70
cols = ['the render (your picture)', 'studio photo (fal, from your render)', '3D model (Hitem3D)']
S = Image.new('RGB', (3 * T + 260, HEAD + len(ITEMS) * (T + 10)), (26, 23, 19)); d = ImageDraw.Draw(S)
for c, n in enumerate(cols): d.text((260 + c * T + 8, 22), n, fill=(238, 169, 39), font=F)
def tile(p, x, y):
    if p and os.path.exists(p):
        im = Image.open(p).convert('RGB'); im.thumbnail((T - 10, T - 10))
        S.paste(im, (x + (T - im.width) // 2, y + (T - im.height) // 2))
    else:
        d.text((x + 70, y + T // 2 - 12), 'in progress...', fill=(160, 160, 160), font=F)
for r, (iid, name, crops) in enumerate(ITEMS):
    y = HEAD + r * (T + 10)
    d.text((12, y + T // 2 - 16), he(name), fill=(249, 246, 243), font=FB)
    crop = None
    cl = crops if crops is not None else [iid]
    if cl and cl[0] in meta: crop = meta[cl[0]]['crop']
    tile(crop, 260, y)
    tile(f'items/studio/{iid}.png', 260 + T, y)
    tile(f'qa/compare/{iid}_hitem.png' if os.path.exists(f'qa/compare/{iid}_hitem.png') else None, 260 + 2 * T, y)
S.save('qa/items-gallery.jpg', quality=86); print(S.size)

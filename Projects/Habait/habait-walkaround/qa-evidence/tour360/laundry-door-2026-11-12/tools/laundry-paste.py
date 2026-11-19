# laundry-paste.py (2026-11-12, Eliran: «תעשה כמו שזה נראה בתכנית מכר»): the living picture's laundry niche OPEN with a washing machine, as the
# sales plan draws it. ONLY the niche polygon (the old door leaf's place, its top edge and the washer) is taken from ONE edit-lane answer
# (04-living concrete, gpt25-medium seed 93) and pasted onto all four shipped living pictures, so the niche is identical on every floor;
# every other pixel, the floor in front of the niche included, stays the shipped picture. Feathered 2 px. A v3 object-paste sidecar is
# written beside each output (the r4paste.py form). $0.
#   run from anywhere: python -I -X utf8 laundry-paste.py
import json, os, shutil, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846/'
L, GEN = APT + '_local/', APT + '_local/generated/'
ANSWER = glob.glob(GEN + '04-living__concrete__gpt25-medium__s93__*.png')[0]
# the old door leaf: left edge col 1773-1776, top slanting 427 -> 438, bottom on the floor 612 -> 599; the washer reaches col 1822,
# the narrow cabinet door with its lever (col 1826-1837) and the pillar stay the shipped picture's
POLY = [(1771, 424), (1823, 436), (1823, 599), (1771, 613)]
A = np.asarray(Image.open(ANSWER).convert('RGB').resize((2048, 1024), Image.LANCZOS)).astype(np.float32)
m = Image.new('L', (2048, 1024), 0); ImageDraw.Draw(m).polygon(POLY, fill=255)
M = np.asarray(m.filter(ImageFilter.GaussianBlur(2))).astype(np.float32)[..., None] / 255
picks = json.load(open(L + 'picks.json', encoding='utf-8'))
for s in ('base', 'parquet', 'concrete', 'marble'):
    parent = L + f'laundry/in/04-living__{s}.png'
    P = np.asarray(Image.open(parent).convert('RGB').resize((2048, 1024), Image.LANCZOS)).astype(np.float32)
    name = '04-living__laundry.png' if s == 'base' else f'04-living__floor-{s}__laundry.png'
    out = GEN + name
    Image.fromarray((P * (1 - M) + A * M).round().clip(0, 255).astype(np.uint8)).save(out)
    side = {'version': 3, 'kind': 'object-paste', 'parent': picks['04-living'] if s == 'base' else f'panos-{s}/04-living.webp',
            'object_paste': {'from': os.path.basename(ANSWER), 'tool': 'qa-evidence/tour360/laundry-door-2026-11-12/tools/laundry-paste.py', 'polygons_rolled_by': 0, 'polygons': [POLY],
                             'why': 'Eliran 2026-11-12 «תעשה כמו שזה נראה בתכנית מכר»: the laundry niche OPEN with a washing machine, no door (the sales plan draws it open); every other pixel is the parent'},
            'cuts': [], 'note': 'no band cut: one element polygon from an edit-lane answer of the same camera'}
    json.dump(side, open(out[:-4] + '.seam.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('ok', name)

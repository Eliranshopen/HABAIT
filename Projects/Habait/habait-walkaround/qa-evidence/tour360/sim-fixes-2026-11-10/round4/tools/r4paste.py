# round 4 (2026-11-10): take ONLY the changed element's polygon from an edit-lane answer onto the gated picture(s) of the same camera
# (the white zero-line front door of 01-04; the lounger's place on the terrace of 05). Polygons are given in a copy rolled by `roll`
# px so an element on the wrap edge is whole. Feathered 2.5 px. Writes a v3 object-paste sidecar beside each output.
#   usage: r4paste.py <asset> <answer.png> <parent.png> <out.png> [<parent2.png> <out2.png> ...]
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
CFG = {
    '01-entrance': (600, [[(415, 235), (905, 235), (905, 840), (866, 840), (866, 812), (815, 804), (700, 820), (600, 834), (505, 846), (500, 900), (415, 900)]]),
    '02-kitchen': (0, [[(1546, 440), (1614, 440), (1614, 581), (1546, 581)]]),
    '03-dining': (0, [[(166, 424), (224, 424), (224, 572), (200, 572), (200, 567), (166, 567)]]),
    '04-living': (100, [[(103, 432), (182, 432), (182, 591), (103, 591)]]),
    '05-terrace-living': (0, [[(950, 555), (1310, 555), (1310, 775), (950, 775)]]),
}
asset, answer = sys.argv[1:3]; pairs = sys.argv[3:]
roll, polys = CFG[asset]
A = np.asarray(Image.open(answer).convert('RGB')).astype(np.float32); H, W = A.shape[:2]
m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
for p in polys: d.polygon(p, fill=255)
M = np.asarray(m.filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32)[..., None] / 255
M = np.roll(M, -roll, axis=1)
for i in range(0, len(pairs), 2):
    parent, out = pairs[i], pairs[i + 1]
    P = np.asarray(Image.open(parent).convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float32)
    Image.fromarray((P * (1 - M) + A * M).round().clip(0, 255).astype(np.uint8)).save(out)
    side = {'version': 3, 'kind': 'object-paste', 'parent': os.path.basename(parent),
            'object_paste': {'from': os.path.basename(answer), 'tool': 'scratchpad r4paste.py', 'polygons_rolled_by': roll, 'polygons': polys,
                             'why': 'round 4 (Eliran 2026-11-10): the white zero-line front door in every tab / the lounger off the terrace; every other pixel is the parent'},
            'cuts': [], 'note': 'no band cut: one element polygon from an edit-lane answer of the same camera'}
    json.dump(side, open(out[:-4] + '.seam.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('ok', os.path.basename(out))

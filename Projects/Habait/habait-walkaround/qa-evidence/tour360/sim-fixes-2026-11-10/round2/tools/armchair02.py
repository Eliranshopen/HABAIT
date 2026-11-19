# $0 (2026-11-10 round 2): take ONLY the armchair's silhouette from the band answer 4cb20ae4be64 onto its parent 09543d05ab7b
# (the band also redrew the console and the front door, which must stay as the parent has them). Writes a v3 object-paste sidecar.
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

parent, answer, out = sys.argv[1:4]
x0, x1, y0, y1 = 1486, 1580, 568, 660
P = np.asarray(Image.open(parent).convert('RGB')).astype(np.float32)
A = np.asarray(Image.open(answer).convert('RGB')).astype(np.float32)
d = np.abs(P - A).sum(2)
lum = A.mean(2)
m = np.zeros(d.shape, bool)
box = (d[y0:y1, x0:x1] > 24) & ((lum[y0:y1, x0:x1] > 150) | (np.arange(y0, y1)[:, None] > 600))
box = ndimage.binary_closing(box, iterations=3)
lab, n = ndimage.label(box)
if n:
    sizes = ndimage.sum(box, lab, range(1, n + 1)); box = lab == (1 + int(np.argmax(sizes)))
from skimage.morphology import convex_hull_image
box = convex_hull_image(box)
box = ndimage.binary_dilation(box, iterations=2)
m[y0:y1, x0:x1] = box
M = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32)[..., None] / 255
R = (P * (1 - M) + A * M).round().clip(0, 255).astype(np.uint8)
Image.fromarray(R).save(out)
H, W = d.shape
side = {'version': 3, 'kind': 'object-paste', 'parent': os.path.basename(parent),
        'object_paste': {'from': os.path.basename(answer), 'tool': 'scratchpad armchair02.py (silhouette paste)', 'box': [x0, y0, x1 - x0, y1 - y0],
                         'masked_px': int(m.sum()), 'why': 'round 2: the kitchen tab shows the round boucle armchair the other tabs show; console and front door stay the parent\'s'},
        'band': {'u': round((x0 + x1) / 2 / W, 4), 'deg': round((x1 - x0) / W * 360, 2), 'rows': [round(y0 / H, 4), round(y1 / H, 4)]},
        'cuts': [], 'note': 'no band cut: one object silhouette from a band answer of the same parent'}
json.dump(side, open(out[:-4] + '.seam.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(int(m.sum()))
box2 = (1420, 480, 1640, 700)
s = Image.fromarray(R).crop(box2); s = s.resize((s.width * 4, s.height * 4), Image.LANCZOS); s.save(sys.argv[4])

# $0 (2026-11-10, rainbow-sim-fixes; Eliran: «שהדלת והכניסה תראה אותו דבר בכל לשונית»): repaint a WOOD-TONED element (an oak door leaf
# and its frame) as the zero-line door the material board and 07/08/09/10/11 show — flush, painted the wall colour — without a model
# call. Two gpt25 bands on 04-living painted a blank wall over the door (the doorway vanished: a fidelity fail) and a nano band
# drew a slab in front of the camera; the leaf's own outline, shading and lever survive a recolour, which is exactly what a door
# painted the wall colour looks like from 4 m.
# Inside the box, pixels with the wood's chroma (Lab b* above --b, chroma above --c, L below --lmax) take the WALL's a*b* (sampled in
# the wall box) and an L compressed toward the wall's; the mask is feathered. Sidecar: v3 object-paste (band-lineage reads it).
#   usage: recolour_region.py <parent.png> <out.png> u0 u1 v0 v1 wu0 wu1 wv0 wv1 [--b 12] [--c 14] [--lmax 80] [--k 0.35] [--target L,a,b] [--why "..."]
import json, os, sys

import numpy as np
from PIL import Image, ImageFilter
from skimage import color

argv = sys.argv[1:]
def opt(n, d):
    return float(argv[argv.index(n) + 1]) if n in argv else d
why = argv[argv.index('--why') + 1] if '--why' in argv else ''
skip = set()
for n in ('--b', '--c', '--lmax', '--lmin', '--k', '--why', '--target'):
    if n in argv: skip.add(argv.index(n)); skip.add(argv.index(n) + 1)
a = [x for i, x in enumerate(argv) if i not in skip]
parent, out = a[0], a[1]
u0, u1, v0, v1, wu0, wu1, wv0, wv1 = map(float, a[2:10])
B, C, LMAX, K = opt('--b', 12), opt('--c', 14), opt('--lmax', 80), opt('--k', 0.35)
im = Image.open(parent).convert('RGB'); W, H = im.size
rgb = np.asarray(im).astype(np.float32) / 255
lab = color.rgb2lab(rgb)
x0, x1, y0, y1 = int(u0 * W), int(u1 * W), int(v0 * H), int(v1 * H)
wx0, wx1, wy0, wy1 = int(wu0 * W), int(wu1 * W), int(wv0 * H), int(wv1 * H)
wall = lab[wy0:wy1, wx0:wx1].reshape(-1, 3)
Lw, aw, bw = np.median(wall[:, 0]), np.median(wall[:, 1]), np.median(wall[:, 2])
if '--target' in argv:   # an explicit Lab target (another tab's door, measured), instead of the wall sample
    Lw, aw, bw = map(float, argv[argv.index('--target') + 1].split(','))
box = lab[y0:y1, x0:x1]
chroma = np.hypot(box[..., 1], box[..., 2])
m = ((box[..., 2] > B) & (chroma > C) & (box[..., 0] < LMAX) & (box[..., 0] > opt('--lmin', 0))).astype(np.float32)   # --lmin keeps a dark lever
Lo = float(np.median(box[..., 0][m > 0])) if m.any() else Lw
M = np.zeros((H, W), np.float32); M[y0:y1, x0:x1] = m
Mi = Image.fromarray((M * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
M = np.asarray(Mi).astype(np.float32) / 255
new = lab.copy()
new[..., 0] = Lw + (lab[..., 0] - Lo) * K
new[..., 1] = aw; new[..., 2] = bw
outlab = lab * (1 - M[..., None]) + new * M[..., None]
o = (color.lab2rgb(outlab) * 255).round().clip(0, 255).astype(np.uint8)
Image.fromarray(o).save(out)
side = {
    'version': 3, 'kind': 'object-paste', 'parent': os.path.basename(parent),
    'object_paste': {'from': os.path.basename(parent), 'tool': 'Habait/tour360/tools/recolour_region.py',
                     'args': ' '.join(a[2:10]) + f' --b {B} --c {C} --lmax {LMAX} --k {K}', 'box': [x0, y0, x1 - x0, y1 - y0],
                     'masked_px': int((m > 0).sum()), 'wall_lab': [round(float(Lw), 1), round(float(aw), 1), round(float(bw), 1)],
                     'wood_L': round(Lo, 1), 'why': why},
    'band': {'u': round((u0 + u1) / 2, 4), 'deg': round((u1 - u0) * 360, 2), 'rows': [v0, v1]},
    'cuts': [],
    'note': 'no band cut: a chroma recolour inside the element box; geometry, outline and shading are the parent\'s',
}
with open(out[:-4] + '.seam.json', 'w', encoding='utf-8') as f: json.dump(side, f, indent=1, ensure_ascii=False)
print(json.dumps({'out': out, 'box': side['object_paste']['box'], 'masked_px': side['object_paste']['masked_px'], 'wall_lab': side['object_paste']['wall_lab'], 'wood_L': side['object_paste']['wood_L']}))

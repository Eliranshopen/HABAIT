# $0 (2026-11-10, rainbow-sim-fixes; R31 hob-sink spacing): copy a DARK fixture (the black induction hob + the oven under it) to a
# new place along its run by (dx, dy) px with a scale, using a tight mask of its own dark pixels (L below --lmax, dilated) so no
# worktop or front lighting travels with it. The OLD place is left as it is: a row-limited close-seam band repaints it afterwards
# as plain fronts ("one hob, one oven only" — the band's words), which the model does well; what it does badly is moving a fixture.
# Sidecar: v3 object-paste (band-lineage reads it).
#   usage: paste_object.py <parent.png> <out.png> x0 x1 y0 y1 dx dy [--scale 1.0] [--lmax 45] [--dilate 2] [--why "..."]
import json, os, sys

import numpy as np
from PIL import Image, ImageFilter
from skimage import color

argv = sys.argv[1:]
def opt(n, d):
    return argv[argv.index(n) + 1] if n in argv else d
skip = set()
for n in ('--scale', '--lmax', '--dilate', '--why'):
    if n in argv: skip.add(argv.index(n)); skip.add(argv.index(n) + 1)
a = [x for i, x in enumerate(argv) if i not in skip]
parent, out = a[0], a[1]
x0, x1, y0, y1, dx, dy = map(int, a[2:8])
S = float(opt('--scale', 1.0)); LMAX = float(opt('--lmax', 45)); DIL = int(opt('--dilate', 2)); why = opt('--why', '')
im = Image.open(parent).convert('RGB'); W, H = im.size
P = np.asarray(im).astype(np.float32)
box = P[y0:y1, x0:x1]
L = color.rgb2lab(box / 255)[..., 0]
m = Image.fromarray(((L < LMAX) * 255).astype(np.uint8))
if DIL > 0: m = m.filter(ImageFilter.MaxFilter(2 * DIL + 1))
m = m.filter(ImageFilter.GaussianBlur(0.8))
obj = Image.fromarray(box.astype(np.uint8))
bw, bh = x1 - x0, y1 - y0
nw, nh = max(1, round(bw * S)), max(1, round(bh * S))
obj = obj.resize((nw, nh), Image.LANCZOS); m = m.resize((nw, nh), Image.BILINEAR)
cx, cy = (x0 + x1) / 2 + dx, (y0 + y1) / 2 + dy
nx0, ny0 = int(round(cx - nw / 2)), int(round(cy - nh / 2))
canvas = Image.fromarray(P.astype(np.uint8))
canvas.paste(obj, (nx0, ny0), m)
canvas.save(out)
side = {
    'version': 3, 'kind': 'object-paste', 'parent': os.path.basename(parent),
    'object_paste': {'from': os.path.basename(parent), 'tool': 'Habait/tour360/tools/paste_object.py',
                     'args': f'{x0} {x1} {y0} {y1} {dx} {dy} --scale {S} --lmax {LMAX} --dilate {DIL}',
                     'box': [x0, y0, bw, bh], 'moved': [dx, dy], 'scale': S, 'new_box': [nx0, ny0, nw, nh],
                     'masked_px': int((np.asarray(m) > 127).sum()), 'why': why},
    'band': {'u': round(((x0 + x1) / 2 + dx) / W, 4), 'deg': round(nw / W * 360, 2), 'rows': [round(y0 / H, 4), round(y1 / H, 4)]},
    'cuts': [],
    'note': 'no band cut: the fixture\'s own dark pixels pasted at the new place; the old place is repainted by the next band',
}
with open(out[:-4] + '.seam.json', 'w', encoding='utf-8') as f: json.dump(side, f, indent=1, ensure_ascii=False)
print(json.dumps({'out': out, 'new_box': side['object_paste']['new_box'], 'masked_px': side['object_paste']['masked_px']}))

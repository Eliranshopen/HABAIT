# $0 (2026-11-10, rainbow-sim-fixes): take ONE rectangle of a band answer onto its parent, feathered; every other pixel is the parent.
# Used when a band repaint fixed the element (03-dining's front door: oak -> the taupe door 01 shows) but the 1% gate's band-edge rule
# (R25, 4 px) caught a 15 px line step at the band's own edge on the wall beside it: the element is kept, the band's edges are not.
# The sidecar is a v3 object-paste record (as tools/shift_patch.py writes), so band-lineage judges the parent's chain and no new cut.
# PIL + numpy only (the harness python has no cv2).
#   usage: region_paste.py <parent.png> <answer.png> <out.png> u0 u1 v0 v1 [feather_px=6] [--why "..."]
import json, os, sys

import numpy as np
from PIL import Image, ImageFilter

a = [x for x in sys.argv[1:] if not x.startswith('--')]
if '--why' in sys.argv: a = [x for x in a if x != sys.argv[sys.argv.index('--why') + 1]]
why = sys.argv[sys.argv.index('--why') + 1] if '--why' in sys.argv else ''
parent, answer, out = a[0], a[1], a[2]
u0, u1, v0, v1 = map(float, a[3:7]); feather = int(a[7]) if len(a) > 7 else 6
P = np.asarray(Image.open(parent).convert('RGB')).astype(np.float32)
R = np.asarray(Image.open(answer).convert('RGB')).astype(np.float32)
assert P.shape == R.shape, f'{P.shape} != {R.shape}'
H, W = P.shape[:2]
x0, x1, y0, y1 = int(u0 * W), int(u1 * W), int(v0 * H), int(v1 * H)
m = Image.new('L', (W, H), 0); m.paste(255, (x0, y0, x1, y1))
if feather > 0: m = m.filter(ImageFilter.GaussianBlur(feather / 2))
m = np.asarray(m).astype(np.float32)[..., None] / 255
O = (P * (1 - m) + R * m).round().clip(0, 255).astype(np.uint8)
Image.fromarray(O).save(out)
side = {
    'version': 3, 'kind': 'object-paste', 'parent': os.path.basename(parent),
    'object_paste': {'from': os.path.basename(answer), 'tool': 'Habait/tour360/tools/region_paste.py',
                     'args': f'{u0} {u1} {v0} {v1} {feather}', 'box': [x0, y0, x1 - x0, y1 - y0], 'why': why},
    'band': {'u': round((u0 + u1) / 2, 4), 'deg': round((u1 - u0) * 360, 2), 'rows': [v0, v1]},
    'cuts': [],
    'note': 'no band cut: the only pasted region is the element box; its edges fall on plain wall (checked by eye)',
}
with open(out[:-4] + '.seam.json', 'w', encoding='utf-8') as f: json.dump(side, f, indent=1, ensure_ascii=False)
print(json.dumps({'out': out, 'box': [x0, y0, x1 - x0, y1 - y0], 'feather': feather}))

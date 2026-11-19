# $0 (2026-11-10, rainbow-sim-fixes; the sales-plan fidelity rule): put a flat element (a door leaf in its wall) back at the columns the
# PLAN and the CG render give it, when a repaint drew it at the right height but the wrong width or place (03-dining's entrance door:
# plan + render px 196-248, the band drew 170-244 — 45 % too wide). Rows y0..y1 only (never the floor): the element's current columns
# [ex0, ex1) are resampled into [tx0, tx1); the columns of [ex0, ex1) that fall outside the target are filled from a clean wall strip
# [wx0, wx1) of the same rows, stretched. Sidecar: v3 object-paste (band-lineage reads it).
#   usage: refit_element.py <parent.png> <out.png> y0 y1 ex0 ex1 tx0 tx1 wx0 wx1 [--why "..."]
import json, os, sys

import numpy as np
from PIL import Image

argv = sys.argv[1:]
why = argv[argv.index('--why') + 1] if '--why' in argv else ''
a = [x for i, x in enumerate(argv) if not (x == '--why' or (i > 0 and argv[i - 1] == '--why'))]
parent, out = a[0], a[1]
y0, y1, ex0, ex1, tx0, tx1, wx0, wx1 = map(int, a[2:10])
im = Image.open(parent).convert('RGB'); P = np.asarray(im).copy()
el = Image.fromarray(P[y0:y1, ex0:ex1]).resize((tx1 - tx0, y1 - y0), Image.LANCZOS)
wall = Image.fromarray(P[y0:y1, wx0:wx1])
lo, hi = min(ex0, tx0), max(ex1, tx1)
P[y0:y1, lo:hi] = np.asarray(wall.resize((hi - lo, y1 - y0), Image.BILINEAR))
P[y0:y1, tx0:tx1] = np.asarray(el)
Image.fromarray(P).save(out)
side = {
    'version': 3, 'kind': 'object-paste', 'parent': os.path.basename(parent),
    'object_paste': {'from': os.path.basename(parent), 'tool': 'Habait/tour360/tools/refit_element.py',
                     'args': ' '.join(a[2:10]), 'box': [lo, y0, hi - lo, y1 - y0], 'element_from': [ex0, ex1], 'element_to': [tx0, tx1],
                     'wall_strip': [wx0, wx1], 'why': why},
    'band': {'u': round((lo + hi) / 2 / im.width, 4), 'deg': round((hi - lo) / im.width * 360, 2), 'rows': [round(y0 / im.height, 4), round(y1 / im.height, 4)]},
    'cuts': [],
    'note': 'no band cut: the element resampled to its plan columns; the freed columns filled from the wall beside it (checked by eye)',
}
with open(out[:-4] + '.seam.json', 'w', encoding='utf-8') as f: json.dump(side, f, indent=1, ensure_ascii=False)
print(json.dumps({'out': out, 'element': [ex0, ex1], 'to': [tx0, tx1], 'wall': [wx0, wx1]}))

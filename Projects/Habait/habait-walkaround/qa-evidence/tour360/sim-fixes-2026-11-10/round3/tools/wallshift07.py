# $0 (2026-11-10 round 3, the 1% gate's fix loop): 07-bedroom-main drew the glass slit behind the bed ~13 cm (4.2 deg, bearings 164-168)
# wider than the plan on its left side. The wall beside it is extended over those columns: in a copy rolled by 100 px (the slit sits on
# the picture's wrap edge) the plain-wall columns 71..94 are copied to 95..118 and the slit's dark frame edge (95..97) is redrawn at
# 119..121, rows 300..760. Every other pixel is the parent's. Writes a v3 object-paste sidecar.
#   usage: wallshift07.py <parent.png> <out.png>
import json, os, sys
import numpy as np
from PIL import Image
parent, out = sys.argv[1:3]
a = np.asarray(Image.open(parent).convert('RGB')).copy(); H, W = a.shape[:2]
r = np.roll(a, 100, axis=1); o = r.copy()
y0, y1 = 250, 800
# the wall segment 50..94 is stretched to 50..118 (lines stay continuous: no join, no step at the skirting or the ceiling)
seg = Image.fromarray(r[y0:y1, 50:95]).resize((69, y1 - y0), Image.LANCZOS); o[y0:y1, 50:119] = np.asarray(seg)
o[y0:y1, 119:122] = r[y0:y1, 95:98]
# a 2-px feather at the top and bottom rows so no hard horizontal line is drawn
for k, w in ((0, 0.33), (1, 0.66)):
    o[y0 + k, 50:122] = (r[y0 + k, 50:122] * (1 - w) + o[y0 + k, 50:122] * w).astype(np.uint8)
    o[y1 - 1 - k, 50:122] = (r[y1 - 1 - k, 50:122] * (1 - w) + o[y1 - 1 - k, 50:122] * w).astype(np.uint8)
res = np.roll(o, -100, axis=1)
Image.fromarray(res).save(out)
side = {'version': 3, 'kind': 'object-paste', 'parent': os.path.basename(parent),
        'object_paste': {'from': os.path.basename(parent), 'tool': 'scratchpad wallshift07.py', 'box': [W - 5, y0, 27, y1 - y0],
                         'why': 'the 1% gate (2026-11-10): the glass slit at bearings 164-168 stood 13 cm past the plan wall; the wall is extended over it'},
        'cuts': [], 'note': 'no band cut: wall columns of the same picture copied 24 px sideways across the wrap edge'}
json.dump(side, open(out[:-4] + '.seam.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('ok', out)

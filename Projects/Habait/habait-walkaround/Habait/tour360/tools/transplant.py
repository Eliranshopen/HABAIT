# $0 (2026-11-10, rainbow-sim-fixes; the sales-plan fidelity rule + Eliran's «הכלל שלך הוא עקביות»): take ONE box from another
# picture of the SAME camera (the CG render = the plan's geometry, or the picture itself shifted by --dx/--dy) onto the parent,
# feathered. With --match, the source box is colour-matched first: a per-channel affine map (mean/std) from a source reference box to
# a parent reference box of the same surface (a white wall to the photo's white wall), so a render's flat white reads as the photo's.
# Used for 03-dining's entrance corner: the photo drew the door 23 px left of the plan and the column 15 px right; the render has both
# where the plan has them, and its door already IS the flush taupe door with a black lever that 01 and 04 show.
#   usage: transplant.py <parent.png> <source.png|webp> <out.png> x0 x1 y0 y1 [--dx 0 --dy 0] [--match sx0 sx1 sy0 sy1 px0 px1 py0 py1]
#          [--feather 3] [--why "..."]
import json, os, sys

import numpy as np
from PIL import Image, ImageFilter

argv = sys.argv[1:]
def take(n, k):
    if n not in argv: return None
    i = argv.index(n); v = argv[i + 1:i + 1 + k]; del argv[i:i + 1 + k]; return v
why = (take('--why', 1) or [''])[0]
dx = int((take('--dx', 1) or [0])[0]); dy = int((take('--dy', 1) or [0])[0])
match = take('--match', 8); FE = float((take('--feather', 1) or [3])[0])
parent, source, out = argv[0], argv[1], argv[2]
x0, x1, y0, y1 = map(int, argv[3:7])
P = Image.open(parent).convert('RGB'); W, H = P.size
S = Image.open(source).convert('RGB')
if S.size != (W, H): S = S.resize((W, H), Image.LANCZOS)
Pa = np.asarray(P).astype(np.float32); Sa = np.asarray(S).astype(np.float32)
src = Sa[y0 - dy:y1 - dy, x0 - dx:x1 - dx].copy()
if match:
    sx0, sx1, sy0, sy1, px0, px1, py0, py1 = map(int, match)
    sr = Sa[sy0:sy1, sx0:sx1].reshape(-1, 3); pr = Pa[py0:py1, px0:px1].reshape(-1, 3)
    gain = pr.std(0) / np.maximum(sr.std(0), 1.0); gain = np.clip(gain, 0.6, 1.6)
    src = (src - sr.mean(0)) * gain + pr.mean(0)
m = Image.new('L', (W, H), 0); m.paste(255, (x0, y0, x1, y1))
if FE > 0: m = m.filter(ImageFilter.GaussianBlur(FE / 2))
M = np.asarray(m).astype(np.float32)[..., None] / 255
O = Pa.copy(); O[y0:y1, x0:x1] = src
R = (Pa * (1 - M) + O * M).round().clip(0, 255).astype(np.uint8)
Image.fromarray(R).save(out)
side = {
    'version': 3, 'kind': 'object-paste', 'parent': os.path.basename(parent),
    'object_paste': {'from': source.replace('\\', '/').split('/Habait/')[-1], 'tool': 'Habait/tour360/tools/transplant.py',
                     'args': f'{x0} {x1} {y0} {y1} --dx {dx} --dy {dy}' + (f' --match {" ".join(match)}' if match else '') + f' --feather {FE}',
                     'box': [x0, y0, x1 - x0, y1 - y0], 'why': why},
    'band': {'u': round((x0 + x1) / 2 / W, 4), 'deg': round((x1 - x0) / W * 360, 2), 'rows': [round(y0 / H, 4), round(y1 / H, 4)]},
    'cuts': [],
    'note': 'no band cut: a box from the same camera (render or self), colour-matched; checked by eye',
}
with open(out[:-4] + '.seam.json', 'w', encoding='utf-8') as f: json.dump(side, f, indent=1, ensure_ascii=False)
print(json.dumps({'out': out, 'box': side['object_paste']['box'], 'dx': dx, 'dy': dy, 'matched': bool(match)}))

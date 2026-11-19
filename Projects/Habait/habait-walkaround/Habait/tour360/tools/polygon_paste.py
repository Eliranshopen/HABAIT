"""polygon_paste.py --spec <spec.json> [--dry] — take ONE element from ONE edit-lane answer onto every shipped picture of a room
(2026-11-15, the Pi wrapper; generalised from the apt846 laundry-niche tools laundry-paste.py / laundry2-paste.py of 2026-11-12). $0.

The element's polygons (picture pixels at 2048x1024) are taken from the answer and pasted, feathered, onto the room's base pick and
onto each floor set's shipped picture, so the room stays identical across floors and every other pixel stays the shipped picture.
Small leftovers (a lever tip at the polygon's edge) are painted out by carrying the pixel row just above down through a box.
Then the install: the base pick in _local/picks.json, the floor sets as _local/panos-<set>/<asset>.webp (q90), each replaced file
backed up ONCE under _local/<task>/finish-backup/, a v3 object-paste sidecar beside each new PNG, and a source record per floor
picture ({answer, source}) so fidelity-gate.mjs can walk the lineage. Re-running restores nothing: restore the backups first.

spec.json:
  { "apartment": "apt846", "asset": "04-living", "task": "laundry2",
    "answer": "_local/generated/04-living__concrete__gpt25-medium__s94__<hash>.png",
    "polygons": [[[1769,422],[1836,436],[1836,598],[1769,613]]],
    "local_fill": [[1834,1840,520,529]],                 # optional: x0, x1, y0, y1 boxes
    "sets": ["base", "parquet", "concrete", "marble"],   # default: base + every _local/panos-<set>/ that holds the asset
    "why": "Eliran 2026-11-12: the niche EMPTY, no door (the plan draws none)" }
Paths in the spec are relative to the apartment folder (Habait/tour360/apartments/<id>/). After it: make-sets / make-tiles /
scan-pieces for the room, fidelity-gate for each file, build-tour (see the habait-scene-fix skill).
"""
import argparse, json, os, shutil, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ap = argparse.ArgumentParser(); ap.add_argument('--spec', required=True); ap.add_argument('--dry', action='store_true')
a = ap.parse_args(); sp = json.load(open(a.spec, encoding='utf-8'))
APT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'apartments', sp['apartment']); L = os.path.join(APT, '_local'); GEN = os.path.join(L, 'generated')
asset, task = sp['asset'], sp['task']
sets = sp.get('sets') or ['base'] + sorted(d[len('panos-'):] for d in os.listdir(L) if d.startswith('panos-') and os.path.exists(os.path.join(L, d, asset + '.webp')) and d[len('panos-'):] in ('parquet', 'concrete', 'marble', 'tiles'))
picks = json.load(open(os.path.join(L, 'picks.json'), encoding='utf-8')); before = picks[asset]
ans = os.path.join(APT, sp['answer']); assert os.path.exists(ans), ans
A = np.asarray(Image.open(ans).convert('RGB').resize((2048, 1024), Image.LANCZOS)).astype(np.float32)
m = Image.new('L', (2048, 1024), 0); d = ImageDraw.Draw(m)
for poly in sp['polygons']: d.polygon([tuple(p) for p in poly], fill=255)
M = np.asarray(m.filter(ImageFilter.GaussianBlur(2))).astype(np.float32)[..., None] / 255
print('asset', asset, 'sets', sets, 'answer', os.path.basename(ans), 'polygons', len(sp['polygons']), 'pick before', before)
if a.dry: raise SystemExit('dry: nothing written')
BK = os.path.join(L, task, 'finish-backup'); os.makedirs(BK, exist_ok=True)
shutil.copy(os.path.join(L, 'picks.json'), os.path.join(L, task, 'picks.before-%s.json' % task))
for s in sets:
    src = os.path.join(GEN, before) if s == 'base' else os.path.join(L, 'panos-' + s, asset + '.webp')
    P = np.asarray(Image.open(src).convert('RGB').resize((2048, 1024), Image.LANCZOS)).astype(np.float32)
    O = P * (1 - M) + A * M
    for x0, x1, y0, y1 in sp.get('local_fill', []): O[y0:y1, x0:x1] = O[y0 - 3, x0:x1][None, :, :]
    name = f'{asset}__{task}.png' if s == 'base' else f'{asset}__floor-{s}__{task}.png'
    Image.fromarray(O.round().clip(0, 255).astype(np.uint8)).save(os.path.join(GEN, name))
    json.dump({'version': 3, 'kind': 'object-paste', 'parent': before if s == 'base' else f'panos-{s}/{asset}.webp',
               'object_paste': {'from': os.path.basename(ans), 'tool': 'Habait/tour360/tools/polygon_paste.py', 'polygons_rolled_by': 0,
                                'polygons': sp['polygons'], 'local_fill': sp.get('local_fill', []), 'why': sp.get('why', '')},
               'cuts': [], 'note': 'no band cut: element polygons from an edit-lane answer of the same camera'},
              open(os.path.join(GEN, name[:-4] + '.seam.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    if s == 'base':
        picks[asset] = name
    else:
        webp = os.path.join(L, 'panos-' + s, asset + '.webp'); bk = os.path.join(BK, f'{s}--{asset}.webp')
        if not os.path.exists(bk): shutil.copy(webp, bk)
        Image.open(os.path.join(GEN, name)).save(webp + '.tmp.webp', 'WEBP', quality=90); os.replace(webp + '.tmp.webp', webp)
        json.dump({'answer': name, 'picture': name, 'source': before, 'composite': sp.get('why', '') + ' (polygon_paste.py)'},
                  open(webp[:-5] + '.source.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('ok', s, name)
json.dump(picks, open(os.path.join(L, 'picks.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('pick now', picks[asset], '- next: make-sets --only', asset, '; make-tiles; scan-pieces; fidelity-gate per file; build-tour')

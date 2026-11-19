"""build-walk.py — builds the walk proof's page folder from the proof tour's renders. $0, deterministic.

  python build-walk.py --tour <360walkaround/tours/apt846-walk-proof> --apt <tour360/apartments/apt846> --out <folder>

Writes <out>/index.html, walk.js, walk.json, pano/<id>.webp (+ a 2048 px copy for phones), depth/<id>.png (the render's depth map,
rgb24 = centimetres, reduced to 1024x512 by nearest neighbour so the code stays exact) and compare/<scene>.webp (the shipped tour
picture of the two viewpoints that stand on a walk point, 4096 px). The graph (which point leads to which) is GRAPH below.
"""
import argparse, json, os, io, shutil, hashlib, math
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

GRAPH = [('w00', 'w01'), ('w01', 'w02'), ('w02', 'w03'), ('w03', 'w04'), ('w01', 'w05'), ('w05', 'w06'), ('w06', 'w07'), ('w07', 'w08'), ('w08', 'w09')]
COMPARE = {'w00': ('entrance', '01-entrance'), 'w04': ('living', '04-living')}
NAMES = {'w00': 'כניסה', 'w04': 'סלון', 'w07': 'מול דלת חדר ההורים', 'w09': 'פינת הארונות'}

ap = argparse.ArgumentParser(); ap.add_argument('--tour', required=True); ap.add_argument('--apt', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--finish', default='parquet')
a = ap.parse_args(); HERE = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(os.path.join(a.tour, 'plan.json'), encoding='utf-8')); man = json.load(open(os.path.join(a.tour, 'manifest.json'), encoding='utf-8'))
cams = json.load(open(os.path.join(a.apt, 'cameras.json'), encoding='utf-8')); pxcm = cams['plan']['pxPerCm']
for d in ('pano', 'pano-s', 'depth', 'compare'): os.makedirs(os.path.join(a.out, d), exist_ok=True)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()[:16]
nodes = []; missing = []
for c in plan['camera_points']:
    pid = c['id']; src = os.path.join(a.tour, 'renders', pid)
    if pid not in man.get('points', {}) or not os.path.exists(os.path.join(src, 'pano.webp')): missing.append(pid); continue
    im = Image.open(os.path.join(src, 'pano.webp')).convert('RGB')
    (im if im.width <= 2560 else im.resize((2560, 1280), Image.LANCZOS)).save(os.path.join(a.out, 'pano', pid + '.webp'), quality=90, method=5)   # one size for every point
    im.resize((2048, 1024), Image.LANCZOS).save(os.path.join(a.out, 'pano-s', pid + '.webp'), quality=86, method=5)
    dp = Image.open(os.path.join(src, 'depth.png')).convert('RGB'); dp.resize((1024, 512), Image.NEAREST).save(os.path.join(a.out, 'depth', pid + '.png'), optimize=True)
    n = {'id': pid, 'x': c['x'], 'y': c['y'], 'z': c.get('z', 160), 'yaw': c.get('yaw_deg', 0), 'room': c['room_id'], 'sha': sha(os.path.join(src, 'pano.webp'))}
    if pid in NAMES: n['name'] = NAMES[pid]
    if pid in COMPARE:
        sid, asset = COMPARE[pid]; sc = next(s for s in cams['scenes'] if s['id'] == sid)
        bearing = math.degrees(math.atan2(sc['lookAt'][0] - sc['at'][0], -(sc['lookAt'][1] - sc['at'][1]))) % 360
        off = math.hypot(sc['at'][0] / pxcm - c['x'], sc['at'][1] / pxcm - c['y'])
        cand = [os.path.join(a.apt, '_local', 'dist-src', 'panos-' + a.finish, asset + '.webp'), os.path.join(a.apt, '..', '..', 'dist', os.path.basename(os.path.normpath(a.apt)), 'panos-' + a.finish, asset + '.webp'), os.path.join(a.apt, 'panos', 'balanced', asset + '.webp')]
        srcp = next(p for p in cand if os.path.exists(p))
        ci = Image.open(srcp).convert('RGB'); ci.resize((4096, 2048), Image.LANCZOS).save(os.path.join(a.out, 'compare', sid + '.webp'), quality=88, method=5)
        n['compare'] = {'scene': sid, 'file': 'compare/' + sid + '.webp', 'bearing': round(bearing, 2), 'offset_cm': round(off, 1), 'from': os.path.relpath(srcp, a.apt).replace('\\', '/')}
    nodes.append(n)
ids = {n['id'] for n in nodes}; edges = [e for e in GRAPH if e[0] in ids and e[1] in ids]
doc = {'schema': 'walk-proof/1', 'apartment': 'apt846', 'units': 'cm, plan frame (x right, y down); a picture\'s centre faces the plan\'s up (yaw 0), right = clockwise',
       'depth': {'encoding': 'rgb24-be', 'scale': 100, 'size': [1024, 512]}, 'eye_cm': 160, 'nodes': nodes, 'edges': edges, 'missing': missing}
io.open(os.path.join(a.out, 'walk.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
for f in ('index.html', 'walk.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(a.out, f))
tot = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(a.out) for f in fs)
print('walk proof built:', len(nodes), 'points,', len(edges), 'links, missing', missing, '· %.1f MB' % (tot / 1e6), '→', a.out)
for n in nodes:
    if 'compare' in n: print('  compare', n['id'], n['compare'])

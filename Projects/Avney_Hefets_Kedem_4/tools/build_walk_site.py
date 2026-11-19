"""build_walk_site.py - assemble the walk page into one static folder.  $0.
usage: python -I build_walk_site.py <project> [--work work/walk3d4] [--dn work/daynight4] [--out walk3d-design]
2026-11-17 (evening): the look of Eliran's pictures, the tour's UI, the time of day and the generated catalog.
  model/      walk3d.gltf+bin, light_K / albedo_K (+ _1k phone copies), parts.json, wood.jpg, dn/<key>/light_K.jpg + parts_light.json
  catalog/    <id>.glb (slimmed, normalised: tools/catalog/optimize_item.py) + <id>.jpg (the studio photo as the tile)
  catalog.json, slots.json (where a swapped piece stands, from the sales-plan fixtures), anchors.json (the rings), daynight.json,
  design.json, walk3d-grid.*, fonts/ (Heebo, from the tour viewer), index.html, walk3d.js; thumbs/ is written by tools/make_thumbs.mjs."""
import os, sys, shutil, json, math, re, hashlib
from PIL import Image
P = sys.argv[1]
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
work = os.path.join(P, arg('--work', os.path.join('work', 'walk3d4')))
dnw = os.path.join(P, arg('--dn', os.path.join('work', 'daynight4')))
gl, grid = os.path.join(work, 'gl'), os.path.join(P, 'work', 'walk3d', 'grid')
out = os.path.join(P, 'out', 'avnei-hefetz-kedem', 'buildings-1-2', '4-rooms', arg('--out', 'walk3d-design'))
for d in ('model', 'catalog', 'fonts', 'thumbs'):
    os.makedirs(os.path.join(out, d), exist_ok=True)
for f in ('index.html', 'walk3d.js', 'design.json'):
    shutil.copy(os.path.join(P, 'tools', 'walk', f), out)
FONTS = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/viewer/fonts'   # read-only reference (the house fonts, OFL)
for f in ('heebo-hebrew.woff2', 'heebo-latin.woff2'):
    shutil.copy(os.path.join(FONTS, f), os.path.join(out, 'fonts'))
n = 0
for f in sorted(os.listdir(gl)):
    if f.endswith(('.gltf', '.bin', '.json', '.jpg', '.png')) and not f.startswith('bake_'):   # every file the glTF references (the generated furniture's own textures too)
        shutil.copy(os.path.join(gl, f), os.path.join(out, 'model')); n += 1
Image.open(os.path.join(P, 'assets', 'textures', 'laminate_floor_02', 'laminate_floor_02_Diffuse_2k.jpg')).convert('RGB').resize((1024, 1024), Image.LANCZOS).save(os.path.join(out, 'model', 'wood.jpg'), quality=88)
for f in ('walk3d-grid.png', 'walk3d-grid.json'):
    shutil.copy(os.path.join(grid, f), out)
# ---- the time of day (the day-night-keyframes skill, mode B)
pre = json.load(open(os.path.join(P, 'tools', 'daynight', 'presets.json'), encoding='utf-8'))
keys = []
for k in pre['keyframes']:
    row = {x: k[x] for x in ('name', 'label', 'hour', 'export_ev', 'disp_ev', 'sky_colors')}
    if k.get('from_walk'):
        row['from_walk'] = True
    else:
        src = os.path.join(dnw, k['name'], 'gl')
        if not os.path.exists(os.path.join(src, 'parts_light.json')):
            print('skip key (not baked):', k['name']); continue
        dst = os.path.join(out, 'model', 'dn', k['name']); os.makedirs(dst, exist_ok=True)
        for f in os.listdir(src):
            shutil.copy(os.path.join(src, f), dst)
    keys.append(row)
json.dump({'keyframes': keys, 'north': 'ASSUMED: plan up = north'}, open(os.path.join(out, 'daynight.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# ---- the generated catalog (only items whose model exists)
cat = json.load(open(os.path.join(P, 'tools', 'catalog', 'catalog.json'), encoding='utf-8'))
lin = lambda c: (c / 255) / 12.92 if c / 255 <= 0.04045 else ((c / 255 + 0.055) / 1.055) ** 2.4
items = []
for it in cat['items']:
    if it.get('exclude'):
        continue
    glb = os.path.join(P, 'work', 'catalog', 'web', it['id'] + '.glb'); studio = os.path.join(P, 'work', 'catalog', 'studio', it['id'] + '.png')
    if not (os.path.exists(glb) and os.path.exists(studio)):
        continue
    shutil.copy(glb, os.path.join(out, 'catalog', it['id'] + '.glb'))
    im = Image.open(studio).convert('RGB'); im.thumbnail((256, 256)); im.save(os.path.join(out, 'catalog', it['id'] + '.jpg'), quality=86)
    sm = Image.open(studio).convert('RGB').resize((64, 64)); px = [p for p in sm.getdata() if min(p) < 235]   # the product's own pixels
    mean = [round(sum(lin(p[i]) for p in px) / max(1, len(px)), 4) for i in range(3)]
    items.append(dict(id=it['id'], slot=it['slot'], he=it['he'], mean=mean))
for slot, crop in (('sofa', 'base_sofa'), ('coffee', 'base_coffee'), ('dining', 'base_dining'), ('chairs', 'base_chair')):
    cp = os.path.join(P, 'work', 'catalog', 'studio', crop + '.png')   # the generated studio photo, never a crop of his renders (public site, 2026-11-18)
    if os.path.exists(cp):
        im = Image.open(cp).convert('RGB'); im.thumbnail((256, 256)); im.save(os.path.join(out, 'thumbs', 'piece-' + slot + '.jpg'), quality=86)
base_means = {}
for slot, bid in (('sofa', 'base_sofa'), ('coffee', 'base_coffee'), ('dining', 'base_dining'), ('chairs', 'base_chair'), ('bedm', 'base_bed'), ('night', 'base_night')):
    st = os.path.join(P, 'work', 'catalog', 'studio', bid + '.png')
    if os.path.exists(st):
        sm = Image.open(st).convert('RGB').resize((64, 64)); px = [p for p in sm.getdata() if min(p) < 235]
        base_means[slot] = [round(sum(lin(p[i]) for p in px) / max(1, len(px)), 4) for i in range(3)]
json.dump({'base': base_means, 'items': items, 'note': 'generated (fal nano-banana-pro -> Hunyuan 3D v3.1 pro), see tools/catalog/ledger.json'}, open(os.path.join(out, 'catalog.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# ---- the slots: where a swapped-in piece stands (three.js frame: x = cm/100, z = cm/100; the model's front is +z)
plan = json.load(open(os.path.join(P, 'plan', 'plan.json'), encoding='utf-8'))
FX = {f['id']: f for f in plan['fixtures']}
FRONT = {'+x': (1, 0), '-x': (-1, 0), '+y': (0, 1), '-y': (0, -1), None: (0, 1)}
def place(f, depth_share=1.0, front=None):
    x0, y0, x1, y1 = f['rect_cm']; fx, fz = FRONT[front or f.get('front')]
    w, d = (x1 - x0) / 100, (y1 - y0) / 100 * depth_share
    if fx != 0:
        w, d = d, w
    return dict(x=round((x0 + x1) / 200, 3), z=round((y0 + y1) / 200, 3), w=round(w, 3), d=round(d, 3), rot=round(math.atan2(fx, fz), 4))
slots = {'sofa': {'places': [place(FX['l-sofa'])]}, 'armchair': {'places': [place(FX['l-armchair'])]}, 'coffee': {'places': [place(FX['l-coffee'])]},
         'dining': {'places': [place(FX['l-dining'], 0.70)]}}
x0, y0, x1, y1 = FX['l-dining']['rect_cm']; cy, sx, sy = (y0 + y1) / 2, x1 - x0, y1 - y0
chairs = []
for k in range(3):
    x = x0 + sx * (k + 0.5) / 3
    for t in (-1, 1):
        y = cy + t * (sy * 0.35 + 16)
        chairs.append(dict(x=round(x / 100, 3), z=round(y / 100, 3), w=0.52, d=0.56, rot=round(math.atan2(0, -t), 4)))
slots['chairs'] = {'places': chairs}
H_ = plan['plan_meta']['heights']['ceiling_cm'] / 100.0
room_of = lambda x, y: next((r['id'] for r in plan['rooms'] for q in r['rects_cm'] if q[0] <= x <= q[2] and q[1] <= y <= q[3]), '')
cur = []
for o in plan['openings']:
    if o['kind'] != 'sliding_door':
        continue
    x0, y0, x1, y1 = o['rect_cm']; along_x = (x1 - x0) >= (y1 - y0)
    # the room side: the side of the opening whose neighbour point lies inside the living room
    if along_x:
        side = 1 if room_of((x0 + x1) / 2, y1 + 30) == 'living' else -1; zc = (y1 + 14) / 100 if side > 0 else (y0 - 14) / 100
        for k, xc in enumerate((x0 + 22, x1 - 22)):
            cur.append(dict(x=round(xc / 100, 3), y=0.02, z=round(zc, 3), w=0.55, h=round(H_ - 0.06, 3), rot=0.0))
    else:
        side = 1 if room_of(x1 + 30, (y0 + y1) / 2) == 'living' else -1; xc = (x1 + 14) / 100 if side > 0 else (x0 - 14) / 100
        for k, yc in enumerate((y0 + 22, y1 - 22)):
            cur.append(dict(x=round(xc, 3), y=0.02, z=round(yc / 100, 3), w=0.55, h=round(H_ - 0.06, 3), rot=round(math.pi / 2, 4)))
slots['curtains'] = cur
json.dump(slots, open(os.path.join(out, 'slots.json'), 'w'), indent=1)
# ---- the rings: one per changeable piece per room (the plan's fixtures), at the piece's top
design = json.load(open(os.path.join(P, 'tools', 'walk', 'design.json'), encoding='utf-8'))
boxes = json.load(open(os.path.join(gl, 'parts.json'), encoding='utf-8'))['boxes']
def piece_of(name):
    return next((p['id'] for p in design['pieces'] if re.search(p['match'], name)), None)
def room_of(x, y):
    return next((r['id'] for r in plan['rooms'] for q in r['rects_cm'] if q[0] <= x <= q[2] and q[1] <= y <= q[3]), '')
TOP = {'kitchen': 1.2, 'wardrobes': 1.35, 'vanities': 1.0, 'rug': 0.25, 'armchair': 0.75}
clusters = {}
for f in plan['fixtures']:
    pc = piece_of(f['id'])
    if f['id'] == 'l-tv' or not pc or not any(p['id'] == pc and p.get('ring') for p in design['pieces']):
        continue
    x0, y0, x1, y1 = f['rect_cm']; rm = room_of((x0 + x1) / 2, (y0 + y1) / 2)
    c = clusters.setdefault((pc, rm), [1e9, 1e9, -1e9, -1e9]); c[:] = [min(c[0], x0), min(c[1], y0), max(c[2], x1), max(c[3], y1)]
anchors = []
for (pc, rm), (x0, y0, x1, y1) in sorted(clusters.items()):
    b = boxes.get(pc); top = min(TOP.get(pc, 9), b[5] + 0.06) if b else TOP.get(pc, 0.9)
    anchors.append(dict(piece=pc, room=rm, x=round((x0 + x1) / 200, 3), y=round(top, 3), z=round((y0 + y1) / 200, 3)))
b = boxes.get('chairs')
if b:
    cx, cy = (b[0] + b[3]) / 2, (b[1] + b[4]) / 2
    anchors.append(dict(piece='chairs', room=room_of(cx * 100, -cy * 100), x=round(cx, 3), y=round(b[5] + 0.06, 3), z=round(-cy - 0.55, 3)))
json.dump(anchors, open(os.path.join(out, 'anchors.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# ---- a manifest row (root rule: every step writes its artifact plus what went in)
man = {'step': 'build_walk_site', 'work': os.path.relpath(work, P), 'daynight': [k['name'] for k in keys], 'catalog': [i['id'] for i in items], 'files': {}}
for d, _, fs in os.walk(out):
    for f in fs:
        if f != 'manifest.json':
            q = os.path.join(d, f); man['files'][os.path.relpath(q, out).replace('\\', '/')] = hashlib.sha256(open(q, 'rb').read()).hexdigest()[:16]
json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
tot = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(out) for f in fs)
print('walk site', out, '| keys', [k['name'] for k in keys], '| catalog', len(items), '| rings', len(anchors), '|', round(tot / 1e6, 1), 'MB')

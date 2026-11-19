# visible.py — which rooms each tour picture SEES (the model's depth from the same spot), against the buttons it has today.
# A pixel's hit point (pulled 3 cm back toward the eye) inside a room's loop = that room seen; inside an opening's quad (a door leaf,
# a door gap) = the room on its far side. Weighted by solid angle. For each room seen: share of the sphere, and where it is seen
# (yaw from the picture centre and v of its lowest well-seen part — where a floor button would stand).
import json, math, sys
import numpy as np
from PIL import Image
H = 'C:/RnD/Projects/Habait/habait-walkaround/'
plan = json.load(open(H + '360walkaround/tours/apt846-furnished/plan.json', encoding='utf-8'))
scenes = [s for s in json.load(open(H + 'Habait/tour360/apartments/apt846/scenes.json', encoding='utf-8'))['scenes'] if not s.get('exterior')]
R2S = {'r-entrance': 'entrance', 'r-kitchen': 'kitchen', 'r-dining': 'dining', 'r-living': 'living', 'r-terrace-living': 'terraceLiving', 'r-terrace-bedroom': 'terraceBedroom',
       'r-bedroom-main': 'bedroomMain', 'r-wardrobe': 'wardrobe', 'r-bath-main': 'bathMain', 'r-bedroom-2': 'bedroom2', 'r-bath-guest': 'bathguest'}
def inside(x, y, loop):
    c = False
    for i in range(len(loop)):
        a, b = loop[i], loop[(i + 1) % len(loop)]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]: c = not c
    return c
OPEN = []
for o in plan['openings']:
    if o['kind'] == 'window' or 'outside' in o['rooms']: continue
    (ax, ay), (bx, by) = o['a_cm'], o['b_cm']; L = math.hypot(bx - ax, by - ay); ux, uy = (bx - ax) / L, (by - ay) / L; nx, ny = -uy, ux; t = 30
    OPEN.append((o, [(ax + nx * t, ay + ny * t), (bx + nx * t, by + ny * t), (bx - nx * t, by - ny * t), (ax - nx * t, ay - ny * t)]))
W, Hh = 1024, 512
from PIL import ImageDraw
C = 2.0; xs = [p[0] for r in plan['rooms'] for p in r['loop']]; ys = [p[1] for r in plan['rooms'] for p in r['loop']]
X0, Y0 = min(xs) - 60, min(ys) - 60; GW, GH = int((max(xs) + 60 - X0) / C) + 1, int((max(ys) + 60 - Y0) / C) + 1
g = lambda pts: [((x - X0) / C, (y - Y0) / C) for x, y in pts]
RIDS = list(R2S); res = {}
for s in scenes:
    side = json.load(open(f"{H}360walkaround/tours/apt846-furnished/renders/cp-{s['id']}/pano.render.json", encoding='utf-8'))['point']
    cx, cy, cz = side['plan_cm']; yaw = side['yaw_deg']
    own = next(k for k, v in R2S.items() if v == s['id'])
    lab = Image.new('L', (GW, GH), 0); d = ImageDraw.Draw(lab)
    for o, q in OPEN:   # an opening's quad = the room on its far side from this viewpoint
        far = [k for k in o['rooms'] if k != own] or o['rooms']
        d.polygon(g(q), fill=RIDS.index(far[0]) + 1)
    for rr in plan['rooms']: d.polygon(g(rr['loop']), fill=RIDS.index(rr['id']) + 1)
    lab = np.array(lab)
    a = np.asarray(Image.open(f"{H}360walkaround/tours/apt846-furnished/renders/cp-{s['id']}/depth.png").convert('RGB').resize((W, Hh), Image.NEAREST), dtype=np.int64)
    D = ((a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2]) / 100.0
    jj, ii = np.mgrid[0:Hh, 0:W]; lat = (0.5 - (jj + 0.5) / Hh) * np.pi; rel = ((ii + 0.5) / W - 0.5) * 360; lon = np.radians(rel + yaw)
    r = np.maximum(0, D * 100 - 3); x = cx + np.sin(lon) * np.cos(lat) * r; y = cy - np.cos(lon) * np.cos(lat) * r; z = cz + np.sin(lat) * r
    gi = np.clip(((x - X0) / C).astype(int), 0, GW - 1); gj = np.clip(((y - Y0) / C).astype(int), 0, GH - 1)
    L = lab[gj, gi]; ok = (D > 0) & (D < 40); wgt = np.cos(lat)
    seen = {}
    for k, rid in enumerate(RIDS):
        if rid == own: continue
        m = ok & (L == k + 1)
        if m.sum() < 3: continue
        seen[R2S[rid]] = {'w': float(wgt[m].sum()), 'pix': np.stack([rel[m], ((jj + 0.5) / Hh)[m], z[m], D[m]], 1)}
    tot = float(wgt.sum())
    have = {(h.get('as') or h.get('nameAs') or h['to']) for h in s.get('hotspots', []) if 'to' in h} | {h['to'] for h in s.get('hotspots', []) if 'to' in h}
    out = []
    for k, e in sorted(seen.items(), key=lambda kv: -kv[1]['w']):
        share = e['w'] / tot * 100
        P = e['pix']; low = P[P[:, 2] < 120] if (P[:, 2] < 120).sum() > 5 else P   # its floor / lower part
        rels = low[:, 0]; ang = math.degrees(math.atan2(np.sin(np.radians(rels)).mean(), np.cos(np.radians(rels)).mean()))
        out.append({'room': k, 'share_pct': round(share, 2), 'yaw': round(ang, 1), 'v': round(float(np.median(low[:, 1])), 3), 'near_m': round(float(np.median(low[:, 3])), 1), 'button': k in have})
    res[s['id']] = out
    print('%-15s' % s['id'], ' | '.join('%s %.1f%% @%+.0f° %s' % (o['room'], o['share_pct'], o['yaw'], 'OK' if o['button'] else 'MISSING') for o in out))
json.dump(res, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

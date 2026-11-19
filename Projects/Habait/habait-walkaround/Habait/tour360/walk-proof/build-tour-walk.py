"""build-tour-walk.py — the walk on the SHIPPED tour pictures (2026-11-12, Eliran: «אני רוצה את המראה ריאליסטי כמו שירצנו בהדמייה … אבל כן שיתאפשר הליכה»).

  python build-tour-walk.py --apt <tour360/apartments/apt846> --dist <tour360/dist/apt846> --furnished <360walkaround/tours/apt846-furnished>
                            --footprints <walk_footprints.py output> --out <folder> [--finish parquet] [--map <png>]

Every tour viewpoint gets its shipped picture (the tour's own, finish `--finish`) and the depth map Cycles rendered from the SAME spot
of the plan-true model (apt846-furnished/renders/cp-<id>/depth.png — its sidecar's plan_cm and yaw are the tour camera's, checked
to < 0.2 cm). The links are the tour's own door links (scenes.json). Each link's route is found on the plan: free = inside a room,
away from walls, panes and the model's furniture footprints, with the openings carved through; Dijkstra prefers the middle of a
passage; the route is then cut to as few straight runs as keep their clearance. A route that passes a third viewpoint is dropped
(the walk goes through that viewpoint instead) unless the graph would fall apart. $0, deterministic.
"""
import argparse, json, os, io, math, heapq, shutil, hashlib
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
Image.MAX_IMAGE_PIXELS = None

ap = argparse.ArgumentParser()
for k in ('apt', 'dist', 'furnished', 'footprints', 'out'): ap.add_argument('--' + k, required=True)
ap.add_argument('--finish', default='parquet'); ap.add_argument('--map', default=''); ap.add_argument('--cell', type=float, default=5.0)
ap.add_argument('--clear', type=float, default=24.0, help='cm a route keeps from walls and furniture')
ap.add_argument('--allow-broken', action='store_true', help='debug: write the map even when the graph falls apart')
a = ap.parse_args(); HERE = os.path.dirname(os.path.abspath(__file__)); C = a.cell
plan = json.load(open(os.path.join(a.furnished, 'plan.json'), encoding='utf-8'))
cams = json.load(open(os.path.join(a.apt, 'cameras.json'), encoding='utf-8')); pxcm = cams['plan']['pxPerCm']
scenes = [s for s in json.load(open(os.path.join(a.apt, 'scenes.json'), encoding='utf-8'))['scenes'] if not s.get('exterior')]
foot = json.load(open(a.footprints, encoding='utf-8'))['pieces']
ids = [s['id'] for s in scenes]; IX = {k: i for i, k in enumerate(ids)}

# ---- nodes: picture + depth from the same spot
nodes = []
for s in scenes:
    side = json.load(open(os.path.join(a.furnished, 'renders', 'cp-' + s['id'], 'pano.render.json'), encoding='utf-8'))['point']
    cam = next(c for c in cams['scenes'] if c['id'] == s['id']); cx, cy = cam['at'][0] / pxcm, cam['at'][1] / pxcm
    off = math.hypot(cx - side['plan_cm'][0], cy - side['plan_cm'][1]); assert off < 1.0, (s['id'], off)
    nodes.append({'id': s['id'], 'name': s['name']['he'], 'asset': s['asset'], 'x': side['plan_cm'][0], 'y': side['plan_cm'][1], 'z': side['plan_cm'][2], 'yaw': side['yaw_deg'], 'view': side['yaw_deg']})

# ---- the free floor
xs = [p[0] for r in plan['rooms'] for p in r['loop']]; ys = [p[1] for r in plan['rooms'] for p in r['loop']]
X0, Y0 = min(xs) - 40, min(ys) - 40; GW, GH = int((max(xs) + 40 - X0) / C) + 1, int((max(ys) + 40 - Y0) / C) + 1
g = lambda pts: [((x - X0) / C, (y - Y0) / C) for x, y in pts]
inside = Image.new('L', (GW, GH), 0); d = ImageDraw.Draw(inside)
for r in plan['rooms']: d.polygon(g(r['loop']), fill=255, outline=255)
OPEN = []
for o in plan['openings']:   # each opening as a quad across its wall or pane: walkable floor, carved through what blocks
    if o['kind'] == 'window': continue
    (ax_, ay_), (bx_, by_) = o['a_cm'], o['b_cm']; L = math.hypot(bx_ - ax_, by_ - ay_); ux, uy = (bx_ - ax_) / L, (by_ - ay_) / L; nx_, ny_ = -uy, ux; m = 4; t = 40
    OPEN.append([(ax_ + ux * m + nx_ * t, ay_ + uy * m + ny_ * t), (bx_ - ux * m + nx_ * t, by_ - uy * m + ny_ * t), (bx_ - ux * m - nx_ * t, by_ - uy * m - ny_ * t), (ax_ + ux * m - nx_ * t, ay_ + uy * m - ny_ * t)])
for q in OPEN: d.polygon(g(q), fill=255, outline=255)
inside = ndimage.binary_dilation(np.array(inside) > 0, iterations=2)   # rooms touching across an opening join
block = Image.new('L', (GW, GH), 0); d = ImageDraw.Draw(block)
for w in plan['walls']: d.polygon(g(w['polygon_cm']), fill=255, outline=255)
for p in plan['panes']: d.polygon(g(p['polygon_cm']), fill=255, outline=255)
for q in OPEN: d.polygon(g(q), fill=0, outline=0)
for f in foot:
    if len(f['poly']) >= 3: d.polygon(g(f['poly']), fill=255, outline=255)
free = inside & ~(np.array(block) > 0)
clear = ndimage.distance_transform_edt(free) * C   # cm to the nearest blocked cell

def cell(x, y): return int(round((y - Y0) / C)), int(round((x - X0) / C))
def ok_zone(n):   # a viewpoint may stand close to furniture: free cells within 45 cm of it are allowed
    r, c = cell(n['x'], n['y']); R = int(45 / C); z = np.zeros_like(free)
    yy, xx = np.ogrid[:GH, :GW]; z[(yy - r) ** 2 + (xx - c) ** 2 <= R * R] = True; return z & free | (((yy - r) ** 2 + (xx - c) ** 2) <= 3)

def route(A, B):
    for cl in (a.clear, 16.0, 10.0):   # the widest clearance that still finds a way (a terrace with the model's table set is tight)
        r = route_at(A, B, cl)
        if r: return r
    return None

def route_at(A, B, cl):
    allow = (clear >= cl) | ok_zone(A) | ok_zone(B)
    s, t = cell(A['x'], A['y']), cell(B['x'], B['y'])
    dist = {s: 0.0}; prev = {}; pq = [(0.0, s)]; N8 = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]
    while pq:
        dd, u = heapq.heappop(pq)
        if u == t: break
        if dd > dist[u]: continue
        for dr, dc in N8:
            v = (u[0] + dr, u[1] + dc)
            if not (0 <= v[0] < GH and 0 <= v[1] < GW) or not allow[v]: continue
            w = math.hypot(dr, dc) * C * (1 + 40.0 / max(clear[v], 5.0)); nd = dd + w
            if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    if t not in prev: return None
    cells = [t]
    while cells[-1] != s: cells.append(prev[cells[-1]])
    cells.reverse()
    def sight(p, q):   # a straight run keeps the allowed floor
        n = int(max(abs(q[0] - p[0]), abs(q[1] - p[1]))) * 2 + 1
        return all(allow[int(round(p[0] + (q[0] - p[0]) * k / n)), int(round(p[1] + (q[1] - p[1]) * k / n))] for k in range(n + 1))
    keep = [0]; i = 0
    while i < len(cells) - 1:
        j = len(cells) - 1
        while j > i + 1 and not sight(cells[i], cells[j]): j -= 1
        keep.append(j); i = j
    pts = [[round(X0 + cells[k][1] * C, 1), round(Y0 + cells[k][0] * C, 1)] for k in keep]
    pts[0] = [A['x'], A['y']]; pts[-1] = [B['x'], B['y']]
    return pts

pairs = sorted({tuple(sorted((IX[s['id']], IX[h['to']]))) for s in scenes for h in s.get('hotspots', []) if h.get('to') in IX})
edges = []; dropped = []; failed = []
for i, j in pairs:
    pts = route(nodes[i], nodes[j])
    if not pts: failed.append((ids[i], ids[j])); continue
    L = sum(math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]) for k in range(1, len(pts)))
    def seg_d(p, q, r):
        dx, dy = q[0] - p[0], q[1] - p[1]; L2 = dx * dx + dy * dy or 1; t = max(0, min(1, ((r[0] - p[0]) * dx + (r[1] - p[1]) * dy) / L2)); return math.hypot(r[0] - p[0] - t * dx, r[1] - p[1] - t * dy)
    via = [n['id'] for k, n in enumerate(nodes) if k not in (i, j) and min(seg_d(pts[m - 1], pts[m], (n['x'], n['y'])) for m in range(1, len(pts))) < 45]
    edges.append({'a': ids[i], 'b': ids[j], 'path': pts, 'len_cm': round(L, 1), 'via': via})
def connected(es):
    adj = {k: set() for k in ids}
    for e in es: adj[e['a']].add(e['b']); adj[e['b']].add(e['a'])
    seen = {ids[0]}; st = [ids[0]]
    while st:
        u = st.pop()
        for v in adj[u]:
            if v not in seen: seen.add(v); st.append(v)
    return len(seen) == len(ids)
for e in sorted([e for e in edges if e['via']], key=lambda e: -e['len_cm']):
    rest = [x for x in edges if x is not e]
    if connected(rest): edges = rest; dropped.append((e['a'], e['b'], e['via']))
if not connected(edges): print('WARNING: the walk graph falls apart; routes', [(e['a'], e['b']) for e in edges], 'no route', failed)
if not a.allow_broken: assert connected(edges), 'the walk graph falls apart'

# ---- the page folder
for sub in ('pano', 'pano-s', 'depth'): os.makedirs(os.path.join(a.out, sub), exist_ok=True)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()[:16]
for n in nodes:
    src = os.path.join(a.dist, 'panos-' + a.finish, n['asset'] + '.webp')
    shutil.copyfile(src, os.path.join(a.out, 'pano', n['id'] + '.webp')); shutil.copyfile(src, os.path.join(a.out, 'pano-s', n['id'] + '.webp'))
    Image.open(os.path.join(a.furnished, 'renders', 'cp-' + n['id'], 'depth.png')).convert('RGB').resize((1024, 512), Image.NEAREST).save(os.path.join(a.out, 'depth', n['id'] + '.png'), optimize=True)
    n['sha'] = sha(src)[:8] + sha(os.path.join(a.out, 'depth', n['id'] + '.png'))[:8]; n['from'] = os.path.relpath(src, a.apt).replace('\\', '/')
doc = {'schema': 'walk-proof/2', 'apartment': 'apt846', 'mode': 'tour-pictures', 'finish': a.finish,
       'units': "cm, plan frame (x right, y down); a node's yaw = the bearing of its picture's centre, clockwise from the plan's up",
       'depth': {'encoding': 'rgb24-be', 'scale': 100, 'size': [1024, 512], 'from': '360walkaround/tours/apt846-furnished/renders/cp-<id>/depth.png'},
       'eye_cm': 160, 'nodes': nodes, 'edges': [[e['a'], e['b'], e['path']] for e in edges], 'dropped': dropped, 'failed': failed}
io.open(os.path.join(a.out, 'walk.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
for f in ('index.html', 'walk.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(a.out, f))
tot = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(a.out) for f in fs)
print('tour walk built:', len(nodes), 'viewpoints,', len(edges), 'routes · %.1f MB → %s' % (tot / 1e6, a.out))
for e in edges: print('  %-14s ↔ %-14s %4.0f cm, %d runs%s' % (e['a'], e['b'], e['len_cm'], len(e['path']) - 1, '  (passes ' + ','.join(e['via']) + ')' if e['via'] else ''))
print('  dropped (walked through a viewpoint instead):', dropped); print('  no route found:', failed)

if a.map:   # a top map of the routes for the evidence
    S = 1.0; im = Image.new('RGB', (GW * int(C), GH * int(C)), 'white'); dr = ImageDraw.Draw(im); P = lambda x, y: ((x - X0) * S, (y - Y0) * S)
    rgb = np.zeros((GH, GW, 3), np.uint8) + 255; rgb[~inside] = (235, 235, 235); rgb[np.array(block) > 0] = (120, 120, 120); rgb[inside & (np.array(block) == 0) & (clear < a.clear)] = (255, 225, 190)
    im = Image.fromarray(rgb).resize((GW * int(C), GH * int(C)), Image.NEAREST); dr = ImageDraw.Draw(im)
    for e in edges: dr.line([P(*p) for p in e['path']], fill=(20, 90, 230), width=4)
    for n in nodes:
        x, y = P(n['x'], n['y']); dr.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(220, 30, 30)); dr.text((x + 11, y - 6), n['id'], fill=(150, 0, 0))
    im.save(a.map); print('  map →', a.map)

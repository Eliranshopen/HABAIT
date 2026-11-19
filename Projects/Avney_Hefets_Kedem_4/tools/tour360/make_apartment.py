"""make_apartment.py - the RAINBOW tour360 apartment folder for Avnei Hefetz Kedem apt 7 ($0, deterministic).

  python -I tools/tour360/make_apartment.py <PROJ>

Reads (never changes): work/pano-ai/<room>_gpt.jpg (the 11 finished panoramas), the clean Cycles renders
out/.../4-rooms/renders/pano/<room>.png, model/plan.json, work/tour360/depth-npy/<room>.npy (tools/tour360/depth_pano.py),
the sales sheet C:/RnD/Projects/Avney_Hefets_Kedem_4/<sheet> (read-only source), tools/catalog/catalog.json and the studio
photos out/.../4-rooms/gallery/m/<item>_studio.jpg (fallback walk3d-v6/catalog/<item>.jpg).
Writes tour360/apartments/ahk-apt7/ in the apt846 pattern:
  apartment.json · cameras.json · scenes.json · markers.json · plan/floorplan.webp · panos/{balanced,thumb,original}/<room>.webp
  · _local/full/<room>.webp · depth/<room>.png + depth.json · catalog/items.json + catalog/ai/<id>.jpg · manifest.json
and the evidence work/tour360/qa-prep/ (seam numbers, marker overlays on every panorama with a ring).

Frame (proven 2026-11-18 on all 11 rooms: depth edges vs render edges, normal 0.15-0.24 vs mirrored 0.08-0.12, shift 0 px):
the panorama centre (u = 0.5) looks at plan up (sheet -y), u grows clockwise seen from above; yaw = (u - 0.5) * 360.
No paid call anywhere in this file.
"""
import sys, os, json, math, hashlib
import numpy as np
from PIL import Image, ImageDraw

Image.MAX_IMAGE_PIXELS = None
PROJ = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
B = os.path.join(PROJ, 'out', 'avnei-hefetz-kedem', 'buildings-1-2', '4-rooms')
APT = os.path.join(PROJ, 'tour360', 'apartments', 'ahk-apt7')
QA = os.path.join(PROJ, 'work', 'tour360', 'qa-prep')
SHEET = 'C:/RnD/Projects/Avney_Hefets_Kedem_4/בניין 1-2 דגם יורד קומה א דירות 7-8.jpg'
ORDER = ['living', 'dining', 'kitchen', 'foyer', 'balcony', 'corridor', 'master', 'ensuite', 'mamad', 'bath', 'bedroom']
NAMES = {  # he from plan.json cameras; en / fr second
    'living': ('Living room', 'Séjour'), 'dining': ('Dining area', 'Coin repas'), 'kitchen': ('Kitchen', 'Cuisine'),
    'foyer': ('Entrance', 'Entrée'), 'balcony': ('Balcony', 'Balcon'), 'corridor': ('Corridor', 'Couloir'),
    'master': ('Master bedroom', 'Chambre parentale'), 'ensuite': ('Master bathroom', 'Salle de bains parentale'),
    'mamad': ('Bedroom / safe room', 'Chambre / espace protégé'), 'bath': ('Bathroom', 'Salle de bains'), 'bedroom': ('Bedroom', 'Chambre'),
}
ZONE = {'day': {'he': 'אזור המגורים', 'en': 'Living area', 'fr': 'Espace de vie'},
        'night': {'he': 'אזור השינה', 'en': 'Bedroom wing', 'fr': 'Espace nuit'}}
ZONE_OF = {r: 'day' for r in ['living', 'dining', 'kitchen', 'foyer', 'balcony']}
EYE = 1.60
SEAM_BAND = 64      # px each side at 3840 (the teammate's 28_pano_seam.py method, a narrower band)

sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
def wjson(p, o):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, indent=1) + '\n')
for d in ['panos/balanced', 'panos/thumb', 'panos/original', '_local/full', 'plan', 'depth', 'catalog/ai']:
    os.makedirs(os.path.join(APT, d), exist_ok=True)
os.makedirs(QA, exist_ok=True)
plan = json.load(open(os.path.join(B, 'model', 'plan.json'), encoding='utf-8'))
cams = {c['id']: c for c in plan['cameras']}
assert sorted(cams) == sorted(ORDER), sorted(cams)
manifest = {'$schema': 'ahk-tour360/manifest.v1', 'apartment': 'ahk-apt7', 'cost_usd': 0, 'inputs': {}, 'outputs': {}, 'seam': {}}

# ------------------------------------------------------------------ 1. seams + picture sets
def seam_of(a):
    return float(np.abs(a[:, 0] - a[:, -1]).mean()), float(np.median(np.abs(np.diff(a, axis=1)).mean(axis=(0, 2))))

def gnomonic(img, yaw_deg, pitch_deg, hfov_deg, w, h):
    H, W, _ = img.shape
    f = (w / 2) / math.tan(math.radians(hfov_deg) / 2)
    xs, ys = np.meshgrid(np.arange(w) - w / 2 + 0.5, np.arange(h) - h / 2 + 0.5)
    v = np.stack([xs, -ys, np.full_like(xs, f)], -1)
    v /= np.linalg.norm(v, axis=-1, keepdims=True)
    p = math.radians(pitch_deg)
    y_ = v[..., 1] * math.cos(p) + v[..., 2] * math.sin(p); z_ = -v[..., 1] * math.sin(p) + v[..., 2] * math.cos(p)
    lon = np.arctan2(v[..., 0], z_) + math.radians(yaw_deg); lat = np.arcsin(np.clip(y_, -1, 1))
    u = ((lon / (2 * math.pi) + 0.5) % 1) * W; r = (0.5 - lat / math.pi) * H
    return img[np.clip(r.astype(int), 0, H - 1), np.clip(u.astype(int), 0, W - 1)]

def bearing(a, b):  # plan degrees, 0 = up (sheet -y), clockwise
    return (math.degrees(math.atan2(b[0] - a[0], -(b[1] - a[1]))) + 360) % 360
def wrap180(d):
    return ((d + 180) % 360 + 360) % 360 - 180

headings = {r: round(wrap180(bearing((cams[r]['x'], cams[r]['y']), cams[r]['look'])), 1) for r in ORDER}
for r in ORDER:
    src = os.path.join(PROJ, 'work', 'pano-ai', f'{r}_gpt.jpg')
    cg = os.path.join(B, 'renders', 'pano', f'{r}.png')
    manifest['inputs'][r] = {'pano': os.path.relpath(src, PROJ).replace('\\', '/'), 'pano_sha256': sha(src),
                             'cg': os.path.relpath(cg, PROJ).replace('\\', '/'), 'cg_sha256': sha(cg)}
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    assert im.shape[1] == 2 * im.shape[0], (r, im.shape)
    s0, adj = seam_of(im)
    cgs, cgadj = seam_of(np.asarray(Image.open(cg).convert('RGB')).astype(np.float32))
    closed = s0 > 2 * adj   # a seam step clearly above the picture's own column-to-column change
    if closed:
        W = im.shape[1]; L = im[:, :SEAM_BAND].copy(); R = im[:, W - SEAM_BAND:][:, ::-1].copy(); avg = (L + R) / 2
        w = (1 - np.arange(SEAM_BAND, dtype=np.float32) / SEAM_BAND)[None, :, None] ** 1.5
        im[:, :SEAM_BAND] = L * (1 - w) + avg * w
        im[:, W - SEAM_BAND:] = (R * (1 - w) + avg * w)[:, ::-1]
    s1, _ = seam_of(im)
    manifest['seam'][r] = {'before': round(s0, 2), 'after': round(s1, 2), 'adjacent_median': round(adj, 2), 'closed': bool(closed),
                           'band_px': SEAM_BAND if closed else 0, 'cg_render_seam': round(cgs, 2)}
    print(f'seam {r:9s} {s0:5.2f} -> {s1:5.2f} (adjacent {adj:.2f}, CG {cgs:.2f}){" CLOSED" if closed else ""}')
    full = Image.fromarray(np.clip(im + 0.5, 0, 255).astype(np.uint8))
    full.resize((3840, 1920), Image.LANCZOS).save(os.path.join(APT, '_local', 'full', r + '.webp'), quality=90, method=6)
    full.resize((2048, 1024), Image.LANCZOS).save(os.path.join(APT, 'panos', 'balanced', r + '.webp'), quality=92, method=6)
    th = gnomonic(np.asarray(full.resize((2048, 1024), Image.LANCZOS)), headings[r], -3, 95, 640, 320)
    Image.fromarray(th).save(os.path.join(APT, 'panos', 'thumb', r + '.webp'), quality=80, method=6)
    Image.open(cg).convert('RGB').resize((2048, 1024), Image.LANCZOS).save(os.path.join(APT, 'panos', 'original', r + '.webp'), quality=92, method=6)

# ------------------------------------------------------------------ 2. depth for the ruler (rgb24-be centimetres, radial)
depth = {}
for r in ORDER:
    d = np.load(os.path.join(PROJ, 'work', 'tour360', 'depth-npy', r + '.npy'))
    depth[r] = d
    cm = np.clip(np.round(d * 100), 0, 2 ** 24 - 1).astype(np.uint32)
    rgb = np.stack([(cm >> 16) & 255, (cm >> 8) & 255, cm & 255], -1).astype(np.uint8)
    Image.fromarray(rgb, 'RGB').save(os.path.join(APT, 'depth', r + '.png'), optimize=True)
wjson(os.path.join(APT, 'depth', 'depth.json'), {
    'encoding': 'rgb24-be', 'scale': 100, 'invalid': 0,
    'decode': '(R<<16 | G<<8 | B) / 100 => metres (radial distance from the camera origin)',
    'frame': 'u = 0.5 + yaw/360 (yaw 0 = the panorama centre = plan up), v = 0.5 - pitch/180; radial distance along the ray',
    'source': 'tools/tour360/depth_pano.py: one ray per pixel against a BVH of every render-visible mesh of scene/apartment.blend (the scene the panoramas were rendered from), 1024x512; through glazing the value is the distance to the pane',
    'scenes': {r: {'file': r + '.png', 'cp': 'pano_' + r, 'plan_cm': [cams[r]['x'], cams[r]['y'], cams[r]['z']]} for r in ORDER}})

# ------------------------------------------------------------------ 3. the plan sheet (a crop of the architect's sales sheet)
pm = plan['plan_meta']; K = pm['scale_px_per_cm']; OX, OY = pm['origin_px']
xs = [v for w in plan['walls'] for v in (w['rect_cm'][0], w['rect_cm'][2])]; ys = [v for w in plan['walls'] for v in (w['rect_cm'][1], w['rect_cm'][3])]
M = 70  # cm margin
cx0, cy0 = int(OX + (min(xs) - M) * K), int(OY + (min(ys) - M) * K)
cx1, cy1 = int(OX + (max(xs) + M) * K), int(OY + (max(ys) + M) * K)
assert sha(SHEET) == pm['sheet_sha256'], 'the sales sheet on disk is not the one plan.json was traced from'
sheet = Image.open(SHEET).convert('RGB')
cx0, cy0 = max(0, cx0), max(0, cy0); cx1, cy1 = min(sheet.width, cx1), min(sheet.height, cy1)
PLAN_SCALE = 0.5
crop = sheet.crop((cx0, cy0, cx1, cy1))
sw, sh = round(crop.width * PLAN_SCALE), round(crop.height * PLAN_SCALE)
crop.resize((sw, sh), Image.LANCZOS).save(os.path.join(APT, 'plan', 'floorplan.webp'), quality=88, method=6)
to_sheet = lambda x, y: (round((OX + x * K - cx0) * PLAN_SCALE, 1), round((OY + y * K - cy0) * PLAN_SCALE, 1))

# ------------------------------------------------------------------ 4. scenes.json: door markers on the plan's openings
wall_rects = [w['rect_cm'] for w in plan['walls']]
def seg_hits_rect(p, q, R, shrink=1.0):
    x0, y0, x1, y1 = R[0] + shrink, R[1] + shrink, R[2] - shrink, R[3] - shrink
    if x0 >= x1 or y0 >= y1: return False
    t0, t1 = 0.0, 1.0; dx, dy = q[0] - p[0], q[1] - p[1]
    for pp, qq in ((-dx, p[0] - x0), (dx, x1 - p[0]), (-dy, p[1] - y0), (dy, y1 - p[1])):
        if pp == 0:
            if qq < 0: return False
        else:
            t = qq / pp
            if pp < 0: t0 = max(t0, t)
            else: t1 = min(t1, t)
            if t0 > t1: return False
    return True
sees = lambda p, q: not any(seg_hits_rect(p, q, R) for R in wall_rects)
room_of = {'dining': 'living'}  # the dining camera stands in the living room's rectangle (plan.json rooms)
open_by_pair = {}
for o in plan['openings']:
    if o['kind'] in ('window',): continue
    open_by_pair.setdefault(frozenset(o['rooms']), []).append(o)
links = set()
for a, b in plan['links']:
    links.add((a, b)); links.add((b, a))
scenes, dropped = [], []
for r in ORDER:
    C = (cams[r]['x'], cams[r]['y'])
    hs = []
    for (a, b) in sorted(links):
        if a != r: continue
        T = (cams[b]['x'], cams[b]['y'])
        ops = open_by_pair.get(frozenset([room_of.get(a, a), room_of.get(b, b)]), [])
        via, how = None, None
        for o in ops:
            x0, y0, x1, y1 = o['rect_cm']; V = ((x0 + x1) / 2, (y0 + y1) / 2)
            if o['kind'] == 'sliding_door':  # a 3 m opening: the point of it nearest the straight way to the target
                V = (min(max(T[0], x0 + 40), x1 - 40), (y0 + y1) / 2)
            if sees(C, V): via, how = V, f"the opening {o['id']} ({o['kind']}) on the plan"; break
        if via is None and sees(C, T):
            dd = math.dist(C, T); k = min(0.6, 220 / dd) if dd > 0 else 0
            via, how = (C[0] + (T[0] - C[0]) * k, C[1] + (T[1] - C[1]) * k), 'open plan: the straight way to the target camera (no wall between)'
        if via is None:  # the way round: the floor point seen from BOTH cameras with the shortest path C -> P -> T
            best = None
            for gx in range(int(min(C[0], T[0]) - 150), int(max(C[0], T[0]) + 150), 10):
                for gy in range(int(min(C[1], T[1]) - 150), int(max(C[1], T[1]) + 150), 10):
                    P = (gx, gy)
                    if math.dist(C, P) < 60 or any(R[0] <= gx <= R[2] and R[1] <= gy <= R[3] for R in wall_rects): continue
                    if not (sees(C, P) and sees(P, T)): continue
                    L = math.dist(C, P) + math.dist(P, T)
                    if best is None or L < best[0]: best = (L, P)
            if best:
                via, how = best[1], 'the way round: the nearest floor point seen from both cameras (no opening on the plan between them)'
        if via is None:
            dropped.append(f'{a} -> {b}: no opening and no straight way visible from this camera'); continue
        yaw = wrap180(bearing(C, via))
        hs.append({'to': b, 'u': round(0.5 + yaw / 360, 4), 'v': 0.68, 'source': how + f'; bearing {yaw:.1f} deg from the panorama centre (plan up)'})
    scenes.append({'id': r, 'name': {'he': cams[r]['he'], 'en': NAMES[r][0], 'fr': NAMES[r][1]}, 'zone': ZONE[ZONE_OF.get(r, 'night')],
                   'asset': r, 'plan': dict(zip(('x', 'y'), to_sheet(*C))), 'heading': headings[r], 'northOffset': 0,
                   'centreBearingDeg': 0, 'hotspots': hs})
for d in dropped: print('dropped link', d)
back = {(s['id'], h['to']) for s in scenes for h in s['hotspots']}
for (a, b) in back:
    if (b, a) not in back: print('WARN one-way link', a, '->', b)
wjson(os.path.join(APT, 'scenes.json'), {
    '$schema': 'tour360/scenes.v1', 'apartment': 'ahk-apt7',
    'coordinateNotes': {
        'u_v': 'normalized position on the FULL equirectangular image: u 0->1 left->right (0.5 = image centre = yaw 0 = plan up); v 0.68 (the viewer draws interior door markers on its floor rows)',
        'plan': 'x/y in the pixel space of plan/floorplan.webp = the sales-sheet crop x 0.5 (sheet px = plan_meta.origin_px + cm x scale_px_per_cm)',
        'hotspots': 'u from the plan bearing camera -> the opening between the two rooms (plan.json openings), or the straight way to the target camera in the open plan; computed by tools/tour360/make_apartment.py, not by eye',
        'heading': 'the start yaw = the bearing of plan.json cameras[].look (the view the panorama was composed for)'},
    'scenes': scenes})

# ------------------------------------------------------------------ 5. markers.json: the swap rings, from the plan's own furniture
FX = {f['id']: f for f in plan['fixtures']}
def rect(f, inset=0.0, depth_share=1.0):
    x0, y0, x1, y1 = f['rect_cm']; cy, hy = (y0 + y1) / 2, (y1 - y0) / 2 * depth_share
    return (x0 + inset, cy - hy + inset, x1 - inset, cy + hy - inset)
dn = rect(FX['l-dining'], 0, 0.70); dsx = FX['l-dining']['rect_cm'][2] - FX['l-dining']['rect_cm'][0]; dsy = FX['l-dining']['rect_cm'][3] - FX['l-dining']['rect_cm'][1]
dcx, dcy = (dn[0] + dn[2]) / 2, (dn[1] + dn[3]) / 2
chairs = []
for k in range(3):  # build_scene.py: 3 x 2 chairs, 52 x 56 cm, at sy*0.35+16 cm from the table's centre line
    x = FX['l-dining']['rect_cm'][0] + dsx * (k + 0.5) / 3
    for t in (-1, 1):
        y = dcy + t * (dsy * 0.35 + 16); chairs.append((x - 26, y - 28, x + 26, y + 28))
PIECES = [  # category, boxes (plan cm), height range (m); the panoramas show no armchair (build_scene.py: «no armchair»)
    ('sofa', [rect(FX['l-sofa'])], (0.0, 0.82)),
    ('coffee_table', [rect(FX['l-coffee'], 8)], (0.0, 0.40)),
    ('dining_table', [dn], (0.0, 0.76)),
    ('chair', chairs, (0.0, 0.90)),
]
def dir_of(C, P, z):
    dx, dy = P[0] - C[0], P[1] - C[1]; hd = math.hypot(dx, dy) / 100
    return wrap180(bearing(C, P)), math.degrees(math.atan2(z - EYE, hd)), math.sqrt(hd * hd + (z - EYE) ** 2)
def hull(pts):
    pts = sorted(set(pts))
    if len(pts) < 3: return pts
    cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
mk_doc = {'$schema': 'tour360/markers.v1', 'apartment': 'ahk-apt7', 'scanned_on': '2026-11-18', 'model': 'none: geometric, from plan.json fixtures and build_scene.py placements, occlusion checked on the ray-cast depth ($0)',
          'categories_with_items': [p[0] for p in PIECES], 'scenes': {}}
for r in ORDER:
    C = (cams[r]['x'], cams[r]['y']); D = depth[r]; Hd, Wd = D.shape
    bal = os.path.join(APT, 'panos', 'balanced', r + '.webp')
    out = []
    for cat, boxes, (z0, z1) in PIECES:
        corners = [((b[0], b[1]), (b[2], b[1]), (b[2], b[3]), (b[0], b[3])) for b in boxes]
        cxs = [(b[0] + b[2]) / 2 for b in boxes]; cys = [(b[1] + b[3]) / 2 for b in boxes]
        cen = (sum(cxs) / len(cxs), sum(cys) / len(cys))
        if room_of.get(r, r) not in ('living', 'kitchen', 'foyer', 'balcony') and r != 'corridor': continue
        # visibility: a ray to each box's top centre must reach it (depth >= its distance - 25 cm)
        seen = 0
        for b in boxes:
            P = ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); yw, pt, dist = dir_of(C, P, z1 * 0.9)
            u = int(((yw / 360 + 0.5) % 1) * Wd); v = int(min(Hd - 1, max(0, (0.5 - pt / 180) * Hd)))
            if D[v, u] >= dist - 0.25: seen += 1
        if seen < max(1, math.ceil(len(boxes) / 2)): continue
        yc, pc, dc = dir_of(C, cen, (z0 + z1) / 2)
        if dc > 5.0: continue  # a piece farther than 5 m is a few pixels on a phone: no ring (clutter)
        poly = []
        for cs in corners:
            for P in cs:
                for z in (z0, z1):
                    yw, pt, _ = dir_of(C, P, z); poly.append((round(yc + wrap180(yw - yc), 2), round(pt, 2)))
        hp = hull(poly)
        span = [round(max(p[0] for p in hp) - min(p[0] for p in hp), 1), round(max(p[1] for p in hp) - min(p[1] for p in hp), 1)]
        if span[0] < 6 or span[0] > 150: continue
        yawc = round((max(p[0] for p in hp) + min(p[0] for p in hp)) / 2, 2); pitchc = round((max(p[1] for p in hp) + min(p[1] for p in hp)) / 2, 2)
        if len(boxes) > 1:  # a set (the chairs): the ring on the nearest member, so it never sits on the table's ring
            nb = min(boxes, key=lambda b: math.dist(C, ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)))
            yn, pn, _ = dir_of(C, ((nb[0] + nb[2]) / 2, (nb[1] + nb[3]) / 2), (z0 + z1) / 2)
            yawc, pitchc = round(yc + wrap180(yn - yc), 2), round(pn, 2)
        outline = [[round(wrap180(p[0]), 2), p[1]] for p in hp]
        out.append({'id': f'{r}-{cat.replace("_", "-")}', 'category': cat, 'yaw': round(wrap180(yawc), 2), 'pitch': pitchc,
                    'span_deg': span, 'outlines': [outline], 'count': len(boxes), 'distance_m': round(dc, 2)})
    mk_doc['scenes'][r] = {'pano_sha256': sha(bal), 'asset': r, 'heading': headings[r], 'scanned_on': '2026-11-18', 'usd': 0, 'markers': out}
    # evidence: the outlines on the panorama
    if out:
        im = Image.open(bal).convert('RGB'); dr = ImageDraw.Draw(im)
        for m in out:
            pts = [(((p[0] / 360 + 0.5) % 1) * im.width, (0.5 - p[1] / 180) * im.height) for p in m['outlines'][0]]
            dr.line(pts + pts[:1], fill=(255, 40, 40), width=3)
            x, y = ((m['yaw'] / 360 + 0.5) % 1) * im.width, (0.5 - m['pitch'] / 180) * im.height
            dr.ellipse((x - 9, y - 9, x + 9, y + 9), outline=(40, 255, 40), width=3); dr.text((x + 12, y - 6), m['category'], fill=(255, 255, 0))
        im.save(os.path.join(QA, f'markers-{r}.jpg'), quality=85)
    print(f'markers {r:9s}', [f"{m['category']}@{m['yaw']:.0f}/{m['pitch']:.0f}" for m in out])
wjson(os.path.join(APT, 'markers.json'), mk_doc)

# ------------------------------------------------------------------ 6. the catalog (OUR items only: AI studio photos of tools/catalog)
cat_src = json.load(open(os.path.join(PROJ, 'tools', 'catalog', 'catalog.json'), encoding='utf-8'))
SLOT = {'sofa': 'sofa', 'coffee': 'coffee_table', 'dining': 'dining_table', 'chairs': 'chair'}
VIEW = {'sofa': 'living', 'coffee_table': 'living', 'dining_table': 'dining', 'chair': 'dining'}
COLOUR = {'sofa_boucle': 'ivory cream boucle', 'sofa_leather': 'cognac brown leather', 'sofa_linen': 'sage green linen',
          'coffee_travertine': 'travertine', 'coffee_walnut': 'walnut', 'dining_oak_oval': 'light oak', 'dining_marble': 'white marble',
          'chair_oak_boucle': 'light oak and cream boucle'}
ENG = {'sofa_boucle': 'Rounded boucle sofa', 'sofa_leather': 'Cognac leather sofa', 'sofa_linen': 'Sage linen sofa',
       'coffee_travertine': 'Round travertine coffee table', 'coffee_walnut': 'Oval walnut coffee table', 'dining_oak_oval': 'Oval oak dining table',
       'dining_marble': 'White marble dining table', 'chair_oak_boucle': 'Oak and boucle dining chair'}
v6_ids = [i['id'] for i in json.load(open(os.path.join(B, 'walk3d-v6', 'catalog.json'), encoding='utf-8'))['items']]
items, left_out = [], []
for it in cat_src['items']:
    if it['id'] not in v6_ids:
        continue  # only the items of the walk3d-v6 catalog (the brief's catalog)
    cat = SLOT.get(it['slot'])
    if not cat:
        left_out.append(f"{it['id']} ({it['slot']}: no such piece in the panoramas)"); continue
    studio = os.path.join(B, 'gallery', 'm', it['id'] + '_studio.jpg'); small = os.path.join(B, 'walk3d-v6', 'catalog', it['id'] + '.jpg')
    src = studio if os.path.exists(studio) else small
    ph = Image.open(src).convert('RGB'); ph.thumbnail((768, 768), Image.LANCZOS)
    iid = it['id'].replace('_', '-')
    dst = os.path.join(APT, 'catalog', 'ai', iid + '.jpg'); q = 88
    while True:
        ph.save(dst, quality=q, optimize=True)
        if os.path.getsize(dst) <= 380_000 or q <= 50: break
        q -= 8
    w, d_, h = it['size_cm']
    items.append({'id': iid, 'source': 'ai-generated', 'brand': 'Habait AI', 'name': ENG[it['id']], 'name_he': it['he'], 'category': cat,
                  'colour': COLOUR[it['id']], 'size_cm': {'w': w, 'd': d_, 'h': h}, 'image': 'ai/' + iid + '.jpg', 'view': VIEW[cat],
                  'description_en': it['desc'], 'generated': {'model': 'fal-ai/nano-banana-pro (studio photo, 2026-11-17, tools/catalog/gen_item.mjs)', 'from': os.path.relpath(src, PROJ).replace('\\', '/')},
                  'image_sha256': sha(dst)})
wjson(os.path.join(APT, 'catalog', 'items.json'), {
    '$schema': 'tour360/catalog.v1',
    'source': {'retailer': 'none (AI-generated sample pieces)', 'site': 'Avnei Hefetz Kedem apt 7 walk catalog (tools/catalog/catalog.json)', 'read_on': '2026-11-17', 'licence': 'generated for this project on fal (no retailer photo)'},
    'items': items})
print('catalog', len(items), 'items; left out:', left_out)

# ------------------------------------------------------------------ 7. cameras.json (the record) + apartment.json + manifest
wjson(os.path.join(APT, 'cameras.json'), {
    '$schema': 'tour360/cameras.v1', 'apartment': 'ahk-apt7',
    'note': 'The camera table of model/plan.json (cm on the traced sheet, x right, y down); the panoramas were rendered from scene/apartment.blend camera objects pano_<id> at these points, centre = plan up. The viewer sheet is the sales-sheet crop x planScale.',
    'plan': {'crop': SHEET, 'crop_px': [cx0, cy0, cx1, cy1], 'width': cx1 - cx0, 'height': cy1 - cy0, 'pxPerCm': K, 'planScale': PLAN_SCALE, 'sheet': 'plan/floorplan.webp'},
    'eye_m': EYE,
    'scenes': [{'id': r, 'asset': r, 'at_cm': [cams[r]['x'], cams[r]['y']], 'lookAt_cm': cams[r]['look'], 'links': [h['to'] for h in s['hotspots']]} for r, s in zip(ORDER, scenes)]})
wjson(os.path.join(APT, 'apartment.json'), {
    '$schema': 'tour360/apartment.v1', 'id': 'ahk-apt7', 'status': 'concept',
    'title': {'he': 'אבני חפץ · קדם · בניין 1-2 · קומה א׳ · דירה 7 (הדמיה)', 'en': 'Avnei Hefetz · Kedem · buildings 1-2 · floor 1 · apartment 7 (concept)',
              'fr': 'Avnei Hefetz · Kedem · bâtiments 1-2 · 1er étage · appartement 7 (concept)'},
    'project': None,
    'projectNote': 'Avnei Hefetz Kedem, model "yored", buildings 1-2, floor A, apartment 7 (8 = mirror), 4 rooms, 94 m2 + balcony 7.39 m2. Geometry: the traced sales sheet (model/plan.json); look: Cycles render of the plan-true model made photoreal by GPT Image 2.5 (tools/pano_gpt.mjs). No developer branding on the page.',
    'plan': {'image': 'plan/floorplan.webp', 'imageSize': [sw, sh], 'viewBox': [0, 0, sw, sh], 'labelsLanguage': 'he',
             'northNote': 'no north arrow and no site plan in the sources (plan_meta.assumptions): the compass is left out, never guessed'},
    'sets': {'balanced': {'dir': 'panos/balanced', 'width': 2048, 'height': 1024, 'format': 'webp', 'tracked': True},
             'thumb': {'dir': 'panos/thumb', 'width': 640, 'height': 320, 'format': 'webp', 'tracked': True},
             'full': {'dir': '_local/full', 'width': 3840, 'height': 1920, 'format': 'webp', 'tracked': False},
             'original': {'dir': 'panos/original', 'width': 2048, 'height': 1024, 'format': 'webp', 'tracked': True,
                          'note': 'the clean Cycles render each designed picture was made from (renders/pano/<room>.png), same yaw frame'}},
    'disclosure': {'badgeKey': 'badge', 'conceptLineKey': 'conceptLine', 'aiNoteKey': 'aiNote', 'copyPack': 'RAINBOW copy/tour360-copy.json (read-only)', 'permanent': True},
    'provenance': {'generation': 'openai/gpt-image-2.5/sunburst/edit via fal on the Cycles panoramas, 2026-11-18 (tools/pano_gpt.mjs, ledger tools/catalog/ledger-pano.json); this folder adds no paid step',
                   'enhancement': 'none; seam cross-fade where measured (manifest.json seam), WebP sets by tools/tour360/make_apartment.py'},
    'sceneCount': len(ORDER), 'defaultScene': 'living', 'intakeDate': '2026-11-18'})
for root, _, files in os.walk(APT):
    for f in sorted(files):
        p = os.path.join(root, f)
        if f == 'manifest.json': continue
        manifest['outputs'][os.path.relpath(p, APT).replace('\\', '/')] = sha(p)[:16]
manifest['dropped_links'] = dropped
manifest['catalog_left_out'] = left_out
wjson(os.path.join(APT, 'manifest.json'), manifest)
print('make_apartment: done ->', APT)

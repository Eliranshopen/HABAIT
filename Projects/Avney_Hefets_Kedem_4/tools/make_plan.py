"""make_plan.py - wall grid (pixels) + hand-read openings and fixtures -> plan/plan.json (centimetres).  $0.

Usage: python -I make_plan.py <project_dir> <sheet.jpg>

Frame (same convention as the Habait pipeline's plan.json): x right, y DOWN on the sheet, centimetres,
origin = top-left corner of the wall bounding box.  World: X = x/100, Y = -y/100, Z up.

Every number in the HAND-READ block was read on the 100 px grid crops (work/trace/zoom*.png) of THIS sheet:
"דגם יורד · בניינים 1-2 · קומה א' · דירה 7 · 4 חדרים + מרפסת · 94 מ"ר".  Nothing here comes from another apartment.

Evidence classes:  VERIFIED = drawn or printed on the sheet;  DERIVED = computed from the sheet;
ASSUMED = not on any source (heights, sills, finishes not in the spec) - listed in plan_meta.assumptions.
"""
import sys, os, json, hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None
proj, sheet = sys.argv[1], sys.argv[2]
grid = json.load(open(os.path.join(proj, 'work', 'trace', 'grid.json')))
XS, YS, CELLS = grid['xs'], grid['ys'], np.array(grid['cells'], bool)
OX, OY = XS[0], YS[0]

# ----------------------------------------------------------------------------- HAND-READ (sheet pixels)
# printed clear dimensions (cm) and the wall faces they run between (px)
PRINTED = [
    ('kitchen', 'מטבח', 238, (381, 921, 'x'), 337, (779, 1543, 'y')),
    ('living', 'חדר מגורים', 415, (976, 1920, 'x'), 492, (1231, 2350, 'y')),
    ('ensuite', 'חדר רחצה (הורים)', 155, (1954, 2303, 'x'), 185, (323, 739, 'y')),
    ('master', 'חדר שינה הורים', 340, (2341, 3113, 'x'), 325, (323, 1061, 'y')),
    ('mamad', 'חדר שינה/ממ"ד', 325, (2249, 2981, 'x'), 270, (1117, 1732, 'y')),
    ('bath', 'חדר רחצה', 342, (2230, 3001, 'x'), 187, (1792, 2211, 'y')),
    ('bedroom', 'חדר שינה', 335, (1954, 2716, 'x'), 270, (2247, 2862, 'y')),
]
PRINTED_AREAS = {'apartment_m2': 94, 'balcony_m2': 7.39}

# rooms as rectangles (px).  indoor finish per the brochure spec page where it speaks, else ASSUMED.
ROOMS = [
    dict(id='kitchen', he='מטבח', rects=[(381, 779, 921, 1543)], floor='tile80', evidence='VERIFIED'),
    dict(id='living', he='חדר מגורים', rects=[(976, 1231, 1920, 2350), (921, 1231, 976, 1543)], floor='tile80', evidence='VERIFIED'),
    dict(id='foyer', he='כניסה', rects=[(599, 1603, 976, 1831), (921, 1543, 976, 1603)], floor='tile80', evidence='VERIFIED'),
    dict(id='corridor', he='מסדרון', rects=[(1954, 1095, 2193, 2211)], floor='tile80', evidence='VERIFIED'),
    dict(id='master', he='חדר שינה הורים', rects=[(2341, 323, 3113, 1061), (1954, 779, 2341, 1061)], floor='parquet', evidence='VERIFIED'),
    dict(id='ensuite', he='חדר רחצה הורים', rects=[(1954, 323, 2303, 739)], floor='bathtile', evidence='VERIFIED'),
    dict(id='mamad', he='חדר שינה / ממ"ד', rects=[(2249, 1117, 2981, 1732)], floor='tile80', evidence='VERIFIED'),
    dict(id='bath', he='חדר רחצה', rects=[(2230, 1792, 3001, 2211)], floor='bathtile', evidence='VERIFIED'),
    dict(id='bedroom', he='חדר שינה', rects=[(1954, 2247, 2716, 2862)], floor='tile80', evidence='VERIFIED'),
    dict(id='balcony', he='מרפסת', rects=[(984, 701, 1889, 1156)], floor='deck', outdoor=True, evidence='VERIFIED'),
]
# balcony details: railing line (double line on the sheet) and the dashed line of the floor above
BALCONY = dict(rail_y=(730, 740), rail_x=(984, 1889), roof_from_y=772, clear_rect=(984, 738, 1889, 1156))

# openings: the gap rectangle through the wall (px).  axis = direction the wall runs.
# sill/head in cm are ASSUMED (the sheet is a plan; no elevation exists in the sources).
OPENINGS = [
    dict(id='d-entrance', kind='entrance_door', rect=(546, 1630, 599, 1831), axis='y', rooms=['outside', 'foyer'],
         hinge='y1', swing='+x', sill=0, head=210, floor='foyer'),
    dict(id='d-master', kind='door', rect=(1954, 1061, 2150, 1095), axis='x', rooms=['corridor', 'master'],
         hinge='x0', swing='-y', sill=0, head=210, floor='master'),
    dict(id='d-ensuite', kind='door', rect=(2109, 739, 2287, 779), axis='x', rooms=['master', 'ensuite'],
         hinge='x1', swing='-y', sill=0, head=210, floor='bathtile'),
    dict(id='d-mamad', kind='mamad_door', rect=(2193, 1117, 2249, 1316), axis='y', rooms=['corridor', 'mamad'],
         hinge='y1', swing='-x', sill=0, head=205, floor='tile80'),
    dict(id='d-bath', kind='door', rect=(2193, 2017, 2230, 2195), axis='y', rooms=['corridor', 'bath'],
         hinge='y1', swing='+x', sill=0, head=210, floor='bathtile'),
    dict(id='d-bedroom', kind='door', rect=(1954, 2211, 2150, 2247), axis='x', rooms=['corridor', 'bedroom'],
         hinge='x0', swing='+y', sill=0, head=210, floor='tile80'),
    dict(id='p-living-corridor', kind='passage', rect=(1920, 1702, 1954, 1896), axis='y', rooms=['living', 'corridor'],
         sill=0, head=210, floor='tile80'),
    dict(id='s-balcony', kind='sliding_door', rect=(1159, 1156, 1860, 1231), axis='x', rooms=['living', 'balcony'],
         sill=0, head=220, floor='tile80'),
    dict(id='w-kitchen', kind='window', rect=(623, 701, 891, 779), axis='x', rooms=['kitchen', 'outside'], sill=105, head=210),
    dict(id='w-ensuite', kind='window', rect=(2166, 257, 2276, 323), axis='x', rooms=['ensuite', 'outside'], sill=150, head=210, frosted=True),
    dict(id='w-master', kind='window', rect=(2552, 257, 2867, 323), axis='x', rooms=['master', 'outside'], sill=95, head=210),
    dict(id='w-mamad', kind='window', rect=(2981, 1341, 3069, 1564), axis='y', rooms=['mamad', 'outside'], sill=100, head=200),
    dict(id='w-bath', kind='window', rect=(3001, 1951, 3069, 2138), axis='y', rooms=['bath', 'outside'], sill=150, head=210, frosted=True),
    dict(id='w-laundry', kind='window', rect=(2780, 2211, 3001, 2278), axis='x', rooms=['bath', 'laundry-niche'], sill=110, head=210),
    dict(id='w-living-1', kind='window', rect=(1016, 2350, 1194, 2415), axis='x', rooms=['living', 'outside'], sill=95, head=210),
    dict(id='w-living-2', kind='window', rect=(1405, 2350, 1855, 2415), axis='x', rooms=['living', 'outside'], sill=95, head=210),
    dict(id='w-bedroom', kind='window', rect=(2200, 2862, 2469, 2926), axis='x', rooms=['bedroom', 'outside'], sill=95, head=210),
]

# fixtures and furniture exactly where the sheet draws them (px rectangles; front = side that faces the room)
FIX = [
    # kitchen (VERIFIED position on the sheet; cabinet heights ASSUMED standard)
    dict(id='k-counter-n', kind='counter', room='kitchen', rect=(381, 779, 921, 905), front='+y'),
    dict(id='k-counter-w', kind='counter', room='kitchen', rect=(381, 905, 510, 1320), front='+x'),
    dict(id='k-hob', kind='hob', room='kitchen', rect=(770, 782, 915, 900), front='+y'),
    dict(id='k-sink-1', kind='sink_bowl', room='kitchen', rect=(390, 945, 495, 1085), front='+x'),
    dict(id='k-sink-2', kind='sink_bowl', room='kitchen', rect=(390, 1105, 495, 1240), front='+x'),
    dict(id='k-fridge', kind='fridge', room='kitchen', rect=(381, 1322, 548, 1543), front='+x'),
    dict(id='k-upper-w', kind='upper_cabinet', room='kitchen', rect=(381, 905, 460, 1320), front='+x', evidence='ASSUMED'),
    dict(id='k-upper-n', kind='upper_cabinet', room='kitchen', rect=(381, 779, 618, 858), front='+y', evidence='ASSUMED'),
    # living / dining
    dict(id='l-sofa', kind='sofa', room='living', rect=(1168, 2168, 1532, 2348), front='-y'),
    dict(id='l-armchair', kind='armchair', room='living', rect=(978, 1884, 1158, 2096), front='+x'),
    dict(id='l-rug', kind='rug', room='living', rect=(1097, 1795, 1592, 2188)),
    dict(id='l-coffee', kind='coffee_table', room='living', rect=(1230, 1872, 1470, 2112), shape='round'),
    dict(id='l-tv', kind='tv_unit', room='living', rect=(1868, 1898, 1920, 2300), front='-x'),
    dict(id='l-dining', kind='dining_table', room='living', rect=(1500, 1383, 1873, 1590), chairs=[3, 3]),
    dict(id='l-plant', kind='plant', room='foyer', rect=(860, 1745, 950, 1831)),
    # master bedroom + ensuite
    dict(id='m-wardrobe', kind='wardrobe', room='master', rect=(2341, 323, 2473, 773), front='+x'),
    dict(id='m-bed', kind='bed_double', room='master', rect=(2658, 480, 3110, 895), front='-x'),
    dict(id='m-night-1', kind='nightstand', room='master', rect=(3010, 395, 3105, 485), shape='round'),
    dict(id='m-night-2', kind='nightstand', room='master', rect=(3010, 915, 3105, 1005), shape='round'),
    dict(id='e-shower', kind='shower', room='ensuite', rect=(1958, 327, 2110, 545), front='+x'),
    dict(id='e-toilet', kind='toilet', room='ensuite', rect=(2165, 325, 2265, 470), front='+y'),
    dict(id='e-vanity', kind='vanity', room='ensuite', rect=(1958, 565, 2068, 735), front='+x'),
    # safe room (bedroom / mamad)
    dict(id='s-wardrobe', kind='wardrobe', room='mamad', rect=(2250, 1370, 2385, 1732), front='+x'),
    dict(id='s-bed-1', kind='bed_single', room='mamad', rect=(2542, 1117, 2980, 1325), front='-x'),
    dict(id='s-bed-2', kind='bed_single', room='mamad', rect=(2542, 1518, 2980, 1730), front='-x'),
    # main bathroom
    dict(id='b-toilet', kind='toilet', room='bath', rect=(2270, 1798, 2370, 1945), front='+y'),
    dict(id='b-tub', kind='bathtub', room='bath', rect=(2412, 1792, 2769, 1950), front='+y'),
    dict(id='b-washer', kind='washer', room='bath', rect=(2860, 1795, 2990, 1940), front='+y'),
    dict(id='b-vanity', kind='vanity', room='bath', rect=(2478, 2100, 2658, 2210), front='-y'),
    # bedroom
    dict(id='r-wardrobe', kind='wardrobe', room='bedroom', rect=(1958, 2498, 2095, 2862), front='+x'),
    dict(id='r-bed-1', kind='bed_single', room='bedroom', rect=(2275, 2247, 2715, 2455), front='-x'),
    dict(id='r-bed-2', kind='bed_single', room='bedroom', rect=(2275, 2648, 2715, 2862), front='-x'),
    # balcony
    dict(id='o-table', kind='bistro_table', room='balcony', rect=(1560, 903, 1710, 1053), shape='round'),
    dict(id='o-chair-1', kind='outdoor_chair', room='balcony', rect=(1450, 995, 1560, 1105), angle=-30),
    dict(id='o-chair-2', kind='outdoor_chair', room='balcony', rect=(1710, 995, 1820, 1105), angle=30),
    dict(id='o-plants', kind='planter', room='balcony', rect=(1000, 760, 1230, 900)),
]

# camera points (px), eye height 160 cm.  each keeps >= ~40 cm from drawn furniture.
CAMS = [
    dict(id='living', he='סלון', xy=(1640, 1830), look=(1350, 2150)),
    dict(id='dining', he='פינת אוכל', xy=(1250, 1440), look=(1500, 1200)),
    dict(id='kitchen', he='מטבח', xy=(700, 1250), look=(450, 900)),
    dict(id='foyer', he='כניסה', xy=(800, 1715), look=(1500, 1800)),
    dict(id='balcony', he='מרפסת', xy=(1300, 960), look=(1300, 700)),
    dict(id='corridor', he='מסדרון', xy=(2073, 1800), look=(2073, 1300)),
    dict(id='master', he='חדר שינה הורים', xy=(2520, 920), look=(2900, 650)),
    dict(id='ensuite', he='חדר רחצה הורים', xy=(2190, 610), look=(2100, 400)),
    dict(id='mamad', he='חדר שינה / ממ"ד', xy=(2460, 1422), look=(2900, 1422)),
    dict(id='bath', he='חדר רחצה', xy=(2360, 2080), look=(2600, 1900)),
    dict(id='bedroom', he='חדר שינה', xy=(2185, 2550), look=(2500, 2550)),
]
# perspective still cameras (px): position, target, lens mm, eye height cm
STILLS = [
    dict(id='hero-living', he='סלון', xy=(1010, 1500), look=(1620, 2130), lens=20, z=135),
    dict(id='living-dining', he='סלון ופינת אוכל', xy=(1885, 1800), look=(1100, 1380), lens=18, z=140),
    dict(id='entry-view', he='מבט מהכניסה', xy=(650, 1730), look=(1500, 1790), lens=20, z=145),
    dict(id='kitchen', he='מטבח', xy=(870, 1500), look=(470, 880), lens=18, z=140),
    dict(id='master', he='חדר שינה הורים', xy=(2520, 1030), look=(3000, 560), lens=18, z=135),
    dict(id='bedroom', he='חדר שינה', xy=(2000, 2290), look=(2560, 2720), lens=17, z=135),
    dict(id='mamad', he='חדר שינה / ממ"ד', xy=(2940, 1170), look=(2400, 1620), lens=17, z=135),
    dict(id='bath', he='חדר רחצה', xy=(2265, 2165), look=(2720, 1890), lens=16, z=140),
    dict(id='ensuite', he='חדר רחצה הורים', xy=(2255, 705), look=(2030, 380), lens=15, z=140),
    dict(id='balcony', he='מרפסת', xy=(1850, 1110), look=(1250, 800), lens=18, z=140),
]
# links between viewpoints (what a visitor can walk to directly)
LINKS = [('foyer', 'living'), ('foyer', 'kitchen'), ('living', 'dining'), ('dining', 'kitchen'), ('dining', 'balcony'),
         ('living', 'corridor'), ('corridor', 'master'), ('master', 'ensuite'), ('corridor', 'mamad'),
         ('corridor', 'bath'), ('corridor', 'bedroom'), ('living', 'kitchen'), ('living', 'balcony')]

HEIGHTS = dict(ceiling_cm=260, door_head_cm=210, eye_cm=160, counter_cm=90, rail_cm=105)
ASSUMPTIONS = [
    'ceiling height 260 cm (no section or elevation in the sources)',
    'door heads 210 cm, safe-room door 205 cm, balcony sliding door 220 cm',
    'window sills: 95 cm rooms, 105 cm kitchen, 150 cm bathrooms (frosted), 100 cm safe room, 110 cm laundry window; heads 210 cm (200 safe room)',
    'passage living-corridor has a lintel at 210 cm like the doors',
    'balcony railing: clear glass, 105 cm, on the double line the sheet draws; balcony roofed from the dashed line inward',
    'upper kitchen cabinets on the west wall and west of the window (not drawn on a plan); cabinet and fixture heights are standard sizes',
    'floor finish outside the spec: bedrooms and corridor 80x80 like the living room, bathrooms 60x60 matt, balcony wood-look deck as the sheet colours it',
    'sun direction and the view outside (no north arrow, no site plan in the sources)',
]
# ----------------------------------------------------------------------------- derive

sx = sum(p[3][1] - p[3][0] for p in PRINTED) + sum(p[5][1] - p[5][0] for p in PRINTED)
num = sum((p[3][1] - p[3][0]) * p[2] for p in PRINTED) + sum((p[5][1] - p[5][0]) * p[4] for p in PRINTED)
den = sum(p[2] ** 2 for p in PRINTED) + sum(p[4] ** 2 for p in PRINTED)
S = num / den  # px per cm, least squares through the origin over the 14 printed dimensions


def cx(px): return round((px - OX) / S, 1)
def cy(px): return round((px - OY) / S, 1)
def crect(r): return [cx(r[0]), cy(r[1]), cx(r[2]), cy(r[3])]


dims = []
for rid, he, a, (a0, a1, _), b, (b0, b1, _) in PRINTED:
    for printed, p0, p1, ax in ((a, a0, a1, 'x'), (b, b0, b1, 'y')):
        meas = (p1 - p0) / S
        dims.append(dict(room=rid, axis=ax, printed_cm=printed, measured_cm=round(meas, 1),
                         diff_cm=round(meas - printed, 1), diff_pct=round(100 * (meas - printed) / printed, 2)))
worst = max(dims, key=lambda d: abs(d['diff_pct']))

# wall cells -> merged rectangles (cm) for the record; the builder meshes the cells directly
walls_px = []
for j in range(CELLS.shape[0]):
    i = 0
    while i < CELLS.shape[1]:
        if CELLS[j, i]:
            k = i
            while k + 1 < CELLS.shape[1] and CELLS[j, k + 1]:
                k += 1
            walls_px.append((XS[i], YS[j], XS[k + 1], YS[j + 1]))
            i = k + 1
        else:
            i += 1
# merge vertically: runs with the same x span in adjacent rows become one tall box (a wall = one box, not a stack of strips;
# stacked strips each got their own light-bake island and showed as vertical stripes in the 3D walk - 2026-11-17)
merged = True
while merged:
    merged = False
    walls_px.sort(key=lambda r: (r[0], r[2], r[1]))
    out_ = []
    for r in walls_px:
        if out_ and out_[-1][0] == r[0] and out_[-1][2] == r[2] and out_[-1][3] == r[1]:
            out_[-1] = (r[0], out_[-1][1], r[2], r[3]); merged = True
        else:
            out_.append(r)
    walls_px = out_
wall_area_cm2 = sum((r[2] - r[0]) * (r[3] - r[1]) for r in walls_px) / S / S

bc = BALCONY['clear_rect']
balcony_m2 = (bc[2] - bc[0]) * (bc[3] - bc[1]) / S / S / 1e4
room_area = {}
for r in ROOMS:
    room_area[r['id']] = round(sum((q[2] - q[0]) * (q[3] - q[1]) for q in r['rects']) / S / S / 1e4, 2)
indoor_net = sum(v for k, v in room_area.items() if k != 'balcony')

plan = dict(
    schema='ahk-plan/1', units='cm', axes='x right, y down on the sheet; origin = top-left of the wall bounding box; world X=x/100, Y=-y/100',
    apartment=dict(project='אבני חפץ - קדם', model='דגם יורד', buildings='1-2', floor='א', apartment='7 (8 = mirror image)',
                   rooms=4, area_m2=94, balcony_m2=7.39),
    plan_meta=dict(sheet=os.path.basename(sheet), sheet_sha256=hashlib.sha256(open(sheet, 'rb').read()).hexdigest(),
                   sheet_px=grid['size'], origin_px=[OX, OY], scale_px_per_cm=round(S, 4),
                   scale_basis='least squares through the origin over the 14 printed room dimensions, wall face to wall face',
                   printed_dims_checked=len(dims), within_2pct=sum(abs(d['diff_pct']) <= 2 for d in dims),
                   within_1pct=sum(abs(d['diff_pct']) <= 1 for d in dims), worst=worst,
                   grid_iou_vs_mask=grid['iou'], heights=HEIGHTS, assumptions=ASSUMPTIONS,
                   balcony_measured_m2=round(balcony_m2, 2), room_net_area_m2=room_area, indoor_net_area_m2=round(indoor_net, 2),
                   wall_footprint_m2=round(wall_area_cm2 / 1e4, 2)),
    grid=dict(xs_cm=[cx(v) for v in XS], ys_cm=[cy(v) for v in YS], cells=CELLS.astype(int).tolist()),
    walls=[dict(rect_cm=crect(r), evidence='VERIFIED') for r in walls_px],
    rooms=[dict(id=r['id'], he=r['he'], rects_cm=[crect(q) for q in r['rects']], floor=r['floor'],
                outdoor=bool(r.get('outdoor')), area_m2=room_area[r['id']], evidence=r['evidence']) for r in ROOMS],
    balcony=dict(rail_cm=[cx(BALCONY['rail_x'][0]), cy(BALCONY['rail_y'][0]), cx(BALCONY['rail_x'][1]), cy(BALCONY['rail_y'][1])],
                 roof_from_y_cm=cy(BALCONY['roof_from_y']), clear_rect_cm=crect(bc)),
    openings=[dict(id=o['id'], kind=o['kind'], rect_cm=crect(o['rect']), axis=o['axis'], rooms=o['rooms'],
                   width_cm=round(((o['rect'][2] - o['rect'][0]) if o['axis'] == 'x' else (o['rect'][3] - o['rect'][1])) / S, 1),
                   sill_cm=o['sill'], head_cm=o['head'], hinge=o.get('hinge'), swing=o.get('swing'), floor=o.get('floor'),
                   frosted=bool(o.get('frosted')), evidence='VERIFIED position and width; ASSUMED sill and head') for o in OPENINGS],
    fixtures=[dict(id=f['id'], kind=f['kind'], room=f['room'], rect_cm=crect(f['rect']), front=f.get('front'),
                   shape=f.get('shape', 'rect'), angle=f.get('angle', 0), chairs=f.get('chairs'),
                   evidence=f.get('evidence', 'VERIFIED position (furniture on a sales plan is illustrative)')) for f in FIX],
    cameras=[dict(id=c['id'], he=c['he'], x=cx(c['xy'][0]), y=cy(c['xy'][1]), z=HEIGHTS['eye_cm'],
                  look=[cx(c['look'][0]), cy(c['look'][1])]) for c in CAMS],
    stills=[dict(id=c['id'], he=c['he'], x=cx(c['xy'][0]), y=cy(c['xy'][1]), z=c['z'], look=[cx(c['look'][0]), cy(c['look'][1])], lens_mm=c['lens']) for c in STILLS],
    links=[list(l) for l in LINKS],
    dims_check=dims,
)
os.makedirs(os.path.join(proj, 'plan'), exist_ok=True)
json.dump(plan, open(os.path.join(proj, 'plan', 'plan.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ----------------------------------------------------------------------------- overlay on the sheet
im = Image.open(sheet).convert('RGB').crop((0, 0, grid['size'][0], grid['size'][1]))
ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
d = ImageDraw.Draw(ov)
try:
    font = ImageFont.truetype('arial.ttf', 26)
except Exception:
    font = ImageFont.load_default()
for r in walls_px:
    d.rectangle(r, fill=(255, 0, 0, 90))
for o in OPENINGS:
    col = (0, 160, 0, 170) if 'door' in o['kind'] or o['kind'] == 'passage' else (0, 90, 255, 170)
    d.rectangle(o['rect'], fill=col)
    d.text((o['rect'][0] + 4, o['rect'][1] - 30), o['id'], fill=(0, 0, 0, 255), font=font)
for f in FIX:
    if f.get('shape') == 'round':
        d.ellipse(f['rect'], outline=(160, 0, 200, 255), width=4)
    else:
        d.rectangle(f['rect'], outline=(160, 0, 200, 255), width=4)
for c in CAMS:
    x, y = c['xy']
    d.ellipse((x - 16, y - 16, x + 16, y + 16), fill=(255, 140, 0, 255))
    d.line((x, y, x + (c['look'][0] - x) * 0.25, y + (c['look'][1] - y) * 0.25), fill=(255, 140, 0, 255), width=5)
    d.text((x + 20, y - 14), c['id'], fill=(180, 80, 0, 255), font=font)
out = Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')
out.resize((out.width // 2, out.height // 2)).save(os.path.join(proj, 'work', 'trace', 'plan_overlay.jpg'), quality=88)

print('scale px/cm', round(S, 4))
for dd in dims:
    print('  %-8s %s printed %3d  measured %6.1f  diff %+5.1f cm (%+.2f%%)' % (dd['room'], dd['axis'], dd['printed_cm'], dd['measured_cm'], dd['diff_cm'], dd['diff_pct']))
print('within 1%:', plan['plan_meta']['within_1pct'], '/ 14   within 2%:', plan['plan_meta']['within_2pct'], '/ 14')
print('balcony measured m2', round(balcony_m2, 2), '(printed 7.39)')
print('room net areas', room_area, '| indoor net', round(indoor_net, 2), '| wall footprint', round(wall_area_cm2 / 1e4, 2))
print('openings', [(o['id'], round(((o['rect'][2] - o['rect'][0]) if o['axis'] == 'x' else (o['rect'][3] - o['rect'][1])) / S)) for o in OPENINGS])

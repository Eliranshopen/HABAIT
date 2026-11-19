"""Step 03 ($0) - the apartment's geometry file, measured on the verified sheet (Building 10, floor 1, apartment 3).

Usage: python 03_geometry.py <job root>
Reads  work/wall-polygons.json (step 02, native sheet px)
Writes geometry/geometry.json  (metres, x east, y north, origin = SW outer corner of the apartment)
       work/scale-fit.json     (the px/cm fit against the 18 printed room dimensions)

Every number below is a position read on a gridded zoom of the sheet (work/zoom-*.jpg), in NATIVE sheet pixels.
Classes: VERIFIED = drawn or printed on the sheet / in the brochure; DERIVED = computed from verified evidence;
ASSUMED = needed for a 3D model but not documented (all heights are ASSUMED: the sheet is a plan only).
"""
import json
import sys
from pathlib import Path

from shapely.geometry import Polygon, box
from shapely.ops import unary_union

root = Path(sys.argv[1])
polys_px = json.loads((root / "work" / "wall-polygons.json").read_text(encoding="utf-8"))

# ---------------------------------------------------------------- printed room dimensions (cm) vs wall-to-wall px
# (name, printed x cm, printed y cm, [x0, x1] px, [y0, y1] px) - spans between the wall faces of the mask
DIMS = [
    ("living+dining", 410, 492, (1003, 1944), (834, 1964)),
    ("kitchen", 248, 337, (408, 979), (838, 1605)),
    ("parents bedroom", 340, 325, (2366, 3147), (381, 1129)),
    ("parents bathroom", 155, 185, (1983, 2338), (382, 805)),
    ("mamad bedroom", 322, 270, (2276, 3016), (1174, 1798)),
    ("bathroom", 342, 187, (2256, 3035), (1848, 2278)),
    ("bedroom A", 265, 380, (1368, 1977), (2054, 2928)),
    ("bedroom B", 325, 270, (2003, 2751), (2304, 2928)),
    ("wc", 139, 79, (1022, 1339), (2219, 2413)),
]
num = den = 0.0
for _, cx, cy, xs, ys in DIMS:
    for cm, (a, b) in ((cx, xs), (cy, ys)):
        num += (b - a) * cm
        den += cm * cm
S = num / den  # px per cm, least squares through the origin
rows = []
for name, cx, cy, xs, ys in DIMS:
    for axis, cm, (a, b) in (("x", cx, xs), ("y", cy, ys)):
        got = (b - a) / S
        rows.append({"room": name, "axis": axis, "printed_cm": cm, "model_cm": round(got, 1),
                     "diff_cm": round(got - cm, 1), "diff_pct": round(100 * (got - cm) / cm, 2),
                     "ok": abs(got - cm) <= max(0.02 * cm, 5.0)})
(root / "work" / "scale-fit.json").write_text(json.dumps({"px_per_cm": S, "rows": rows}, indent=1), encoding="utf-8")
print(f"scale {S:.4f} px/cm; dims within max(2%,5cm): {sum(r['ok'] for r in rows)}/{len(rows)}")
for r in rows:
    if not r["ok"]:
        print("  OUT:", r)

X0, Y0 = 354, 2984  # SW outer corner (sheet px)
H = 2.60            # ASSUMED clear ceiling height (m)


def mx(px):
    return round((px - X0) / S / 100.0, 4)


def my(py):
    return round((Y0 - py) / S / 100.0, 4)


def rect(x0, y0, x1, y1):
    """sheet-px rect -> [xmin, ymin, xmax, ymax] in metres"""
    return [mx(min(x0, x1)), my(max(y0, y1)), mx(max(x0, x1)), my(min(y0, y1))]


# ---------------------------------------------------------------- walls: the extracted fill, snapped to a common grid
xs_all = sorted(v[0] for p in polys_px for v in p)
ys_all = sorted(v[1] for p in polys_px for v in p)


def clusters(vals, tol=6):
    out, cur = [], [vals[0]]
    for v in vals[1:]:
        if v - cur[-1] <= tol:
            cur.append(v)
        else:
            out.append(cur)
            cur = [v]
    out.append(cur)
    return [(c[0], c[-1], int(round(sorted(c)[len(c) // 2]))) for c in out]


CX, CY = clusters(xs_all), clusters(ys_all)


def snap(v, cl, tol=9):
    best = min(cl, key=lambda c: abs(c[2] - v))
    return best[2] if abs(best[2] - v) <= tol else int(round(v))


def sx(v):
    return snap(v, CX)


def sy(v):
    return snap(v, CY)


wall_shapes = []
for p in polys_px:
    q = [(sx(a), sy(b)) for a, b in p]
    g = Polygon(q).buffer(0)
    if g.area > 50:
        wall_shapes.append(g)
# manual wall pieces the mask split off or thinned (each seen on a zoom):
EXTRA_WALLS = [
    (3016, 1632, 3096, 1721, "mamad window south jamb block (zoom E); the mask dropped it as an 80x64 blob"),
    (3068, 1174, 3096, 1398, "mamad east wall outer leaf: the steel-shutter pocket drawn as a blue strip (zoom E)"),
    (866, 1918, 957, 1949, "electrical-board niche in the entrance wall, filled; the board door is a fixture (zoom A)"),
]
for x0, y0, x1, y1, _ in EXTRA_WALLS:
    wall_shapes.append(box(sx(x0), sy(y0), sx(x1), sy(y1)))
walls_px = unary_union(wall_shapes)
walls_px = walls_px.buffer(0)
geoms = list(walls_px.geoms) if walls_px.geom_type == "MultiPolygon" else [walls_px]
walls = []
for g in geoms:
    walls.append({"exterior": [[mx(x), my(y)] for x, y in list(g.exterior.coords)[:-1]],
                  "holes": [[[mx(x), my(y)] for x, y in list(h.coords)[:-1]] for h in g.interiors],
                  "area_m2": round(g.area / (S * S) / 1e4, 3)})
print("wall solids:", len(walls), "total wall area m2:", round(sum(w["area_m2"] for w in walls), 2))


def gap(x0, y0, x1, y1):
    """an opening's plan rect, its faces snapped onto the wall grid"""
    return rect(sx(x0), sy(y0), sx(x1), sy(y1))


# ---------------------------------------------------------------- openings (gap between two wall ends), sheet px
# axis: the wall's direction ("x" = wall runs east-west). hinge/swing only for doors.
OPENINGS = [
    # windows - widths VERIFIED on the sheet; sill/head ASSUMED (no elevation in the documents)
    dict(id="W-kitchen-N", kind="window", r=gap(649, 767, 928, 836), axis="x", sill=1.05, head=2.15, sashes=2, to="balcony"),
    dict(id="SD-living-N", kind="sliding_door", r=gap(1186, 767, 1895, 834), axis="x", sill=0.0, head=2.15, sashes=3, to="balcony"),
    dict(id="W-parentsbath-N", kind="window", r=gap(2192, 325, 2312, 382), axis="x", sill=1.30, head=2.15, sashes=1, to="outside"),
    dict(id="W-parents-N", kind="window", r=gap(2579, 325, 2902, 380), axis="x", sill=0.95, head=2.15, sashes=2, to="outside"),
    dict(id="W-mamad-E", kind="window", r=gap(3016, 1398, 3096, 1632), axis="y", sill=1.00, head=2.00, sashes=1, to="outside"),
    dict(id="W-bath-E", kind="window", r=gap(3038, 2017, 3095, 2204), axis="y", sill=1.05, head=2.15, sashes=1, to="outside"),
    dict(id="W-bath-S", kind="window", r=gap(2806, 2278, 3035, 2337), axis="x", sill=1.05, head=2.15, sashes=2, to="laundry niche"),
    dict(id="W-bedB-E", kind="window", r=gap(2751, 2574, 2806, 2852), axis="y", sill=0.95, head=2.15, sashes=2, to="outside"),
    dict(id="W-bedA-W", kind="window", r=gap(1311, 2562, 1368, 2886), axis="y", sill=0.95, head=2.15, sashes=2, to="light well"),
    dict(id="W-wc-S", kind="window", r=gap(1043, 2413, 1230, 2472), axis="x", sill=1.50, head=2.15, sashes=1, to="light well"),
    # doors - positions, widths, hinge side and swing VERIFIED on the sheet; head ASSUMED
    dict(id="D-entrance", kind="entrance_door", r=gap(575, 1687, 627, 1897), axis="y", sill=0.0, head=2.10, hinge="S", swing="E", open_deg=0),
    dict(id="D-parents", kind="door", r=gap(1998, 1129, 2185, 1152), axis="x", sill=0.0, head=2.05, hinge="W", swing="N", open_deg=88),
    dict(id="D-parentsbath", kind="door", r=gap(2136, 805, 2324, 834), axis="x", sill=0.0, head=2.05, hinge="E", swing="N", open_deg=88),
    dict(id="D-mamad", kind="mamad_door", r=gap(2228, 1194, 2276, 1382), axis="y", sill=0.0, head=2.00, hinge="S", swing="W", open_deg=170),
    dict(id="D-bath", kind="door", r=gap(2228, 2074, 2256, 2262), axis="y", sill=0.0, head=2.05, hinge="S", swing="E", open_deg=88),
    dict(id="D-bedA", kind="door", r=gap(1977, 2074, 2003, 2262), axis="y", sill=0.0, head=2.05, hinge="N", swing="W", open_deg=88),
    dict(id="D-bedB", kind="door", r=gap(2022, 2280, 2209, 2304), axis="x", sill=0.0, head=2.05, hinge="W", swing="S", open_deg=88),
    dict(id="D-wc", kind="door", r=gap(1022, 2189, 1186, 2219), axis="x", sill=0.0, head=2.05, hinge="W", swing="S", open_deg=88),
]
for o in OPENINGS:
    o["class"] = {"plan": "VERIFIED", "heights": "ASSUMED"}
    w = (o["r"][2] - o["r"][0]) if o["axis"] == "x" else (o["r"][3] - o["r"][1])
    o["width_m"] = round(w, 3)

# ---------------------------------------------------------------- rooms (interior faces), for floors, labels, cameras
ROOMS = [
    dict(id="living", he="חדר מגורים", printed="410/492", rects=[rect(1003, 834, 1944, 1964)], floor="tile80"),
    dict(id="kitchen", he="מטבח", printed="248/337", rects=[rect(408, 838, 1003, 1605)], floor="tile80"),
    dict(id="entrance", he="כניסה", printed=None, rects=[rect(575, 1660, 1003, 1918)], floor="tile80"),
    dict(id="lobby", he="מבואה", printed=None, rects=[rect(1003, 1964, 1339, 2189)], floor="tile80"),
    dict(id="corridor", he="מסדרון", printed=None, rects=[rect(1968, 1152, 2228, 2280), rect(1944, 1406, 1980, 1611)], floor="tile80"),
    dict(id="parents", he="חדר שינה הורים", printed="340/325", rects=[rect(2366, 381, 3147, 1129), rect(1983, 834, 2366, 1129)], floor="parquet"),
    dict(id="parentsbath", he="חדר רחצה הורים", printed="155/185", rects=[rect(1983, 382, 2338, 805)], floor="bathtile"),
    dict(id="mamad", he="חדר שינה / ממ\"ד", printed="322/270", rects=[rect(2276, 1174, 3016, 1798)], floor="tile80"),
    dict(id="bath", he="חדר רחצה", printed="342/187", rects=[rect(2256, 1848, 3035, 2278)], floor="bathtile"),
    dict(id="bedA", he="חדר שינה", printed="265/380", rects=[rect(1368, 2054, 1977, 2928)], floor="tile80"),
    dict(id="bedB", he="חדר שינה", printed="325/270", rects=[rect(2003, 2304, 2751, 2928)], floor="tile80"),
    dict(id="wc", he="שירותים", printed="139/79", rects=[rect(1022, 2219, 1339, 2413)], floor="bathtile"),
]
for r in ROOMS:
    r["area_m2"] = round(sum((a[2] - a[0]) * (a[3] - a[1]) for a in r["rects"]), 2)

# ---------------------------------------------------------------- outdoor parts
BALCONY = dict(
    deck=[[mx(x), my(y)] for x, y in [(628, 767), (628, 575), (745, 458), (1925, 458), (1925, 767)]],
    parapet_outer=[[mx(x), my(y)] for x, y in [(556, 767), (556, 545), (715, 385), (1925, 385)]],
    parapet_inner=[[mx(x), my(y)] for x, y in [(628, 767), (628, 575), (745, 458), (1925, 458)]],
    printed_area_m2=8.8, **{"class": "VERIFIED outline; railing type ASSUMED (dark bars, as the brochure's facade renders)"})
LIGHTWELL = dict(r=rect(1024, 2472, 1310, 2927), **{"class": "DERIVED: white void on the sheet with two windows facing it; open to the sky ASSUMED"})
LAUNDRY = dict(r=rect(2806, 2337, 3141, 2517), **{"class": "VERIFIED outline (louvre lines on the sheet)"})
NORTH_LEDGE = dict(r=rect(1925, 257, 3141, 325), **{"class": "VERIFIED band on the sheet, kind unknown; modelled as a low ledge"})

# ---------------------------------------------------------------- fixed fixtures (VERIFIED plan position; heights ASSUMED)
FIX = [
    dict(id="k-counter-N", kind="counter", r=rect(408, 838, 975, 968), room="kitchen"),
    dict(id="k-counter-W", kind="counter", r=rect(408, 968, 540, 1475), room="kitchen"),
    dict(id="k-counter-S", kind="counter", r=rect(408, 1475, 745, 1605), room="kitchen"),
    dict(id="k-hob", kind="hob", r=rect(832, 842, 972, 966), room="kitchen"),
    dict(id="k-sink-1", kind="sink", r=rect(423, 1008, 523, 1145), room="kitchen"),
    dict(id="k-sink-2", kind="sink", r=rect(423, 1165, 523, 1302), room="kitchen"),
    dict(id="k-fridge", kind="fridge", r=rect(745, 1415, 975, 1602), room="kitchen", front="N"),
    dict(id="k-uppers-W", kind="upper_cabinets", r=rect(408, 968, 490, 1475), room="kitchen", **{"class": "ASSUMED (not drawn)"}),
    dict(id="pb-shower", kind="shower", r=rect(1988, 388, 2140, 610), room="parentsbath"),
    dict(id="pb-wc", kind="wc", r=rect(2200, 385, 2300, 530), room="parentsbath", front="S"),
    dict(id="pb-vanity", kind="vanity", r=rect(1988, 630, 2085, 800), room="parentsbath", front="E"),
    dict(id="b-wc", kind="wc", r=rect(2305, 1856, 2398, 2003), room="bath", front="S"),
    dict(id="b-tub", kind="bathtub", r=rect(2444, 1852, 2800, 2010), room="bath"),
    dict(id="b-washer", kind="washer", r=rect(2893, 1870, 3010, 2008), room="bath", front="S"),
    dict(id="b-vanity", kind="vanity", r=rect(2508, 2163, 2690, 2278), room="bath", front="N"),
    dict(id="wc-wc", kind="wc", r=rect(1180, 2265, 1330, 2355), room="wc", front="W"),
    dict(id="lobby-basin", kind="basin", r=rect(1262, 2040, 1339, 2160), room="lobby", front="W"),
    dict(id="el-board", kind="panel", r=rect(866, 1915, 957, 1921), room="entrance", front="N"),
    dict(id="dining-ledge", kind="sideboard", r=rect(1372, 1968, 1938, 2028), room="living"),
]
for f in FIX:
    f.setdefault("class", "VERIFIED plan position; height ASSUMED")

# ---------------------------------------------------------------- furniture as the sheet draws it (decor layer)
FURN = [
    dict(id="sofa-N", kind="sofa", r=rect(1400, 848, 1762, 1022), front="S", room="living"),
    dict(id="sofa-E", kind="sofa", r=rect(1758, 1035, 1935, 1398), front="W", room="living"),
    dict(id="rug", kind="rug", r=rect(1384, 970, 1776, 1463), room="living"),
    dict(id="coffee", kind="round_table", c=[mx(1580), my(1212)], radius=round(120 / S / 100, 3), room="living"),
    dict(id="dining-table", kind="dining_table", r=rect(1457, 1663, 1828, 1868), room="living"),
    *[dict(id=f"chair-N{i}", kind="dining_chair", c=[mx(x), my(1628)], front="S", room="living") for i, x in enumerate((1520, 1650, 1777))],
    *[dict(id=f"chair-S{i}", kind="dining_chair", c=[mx(x), my(1903)], front="N", room="living") for i, x in enumerate((1520, 1650, 1777))],
    dict(id="plant-entrance", kind="plant", c=[mx(920), my(1860)], room="entrance"),
    dict(id="p-wardrobe", kind="wardrobe", r=rect(2370, 385, 2500, 835), front="E", room="parents"),
    dict(id="p-bed", kind="bed_double", r=rect(2669, 576, 3140, 944), head="E", room="parents",
         note="drawn about 148x157 cm (a shrunk symbol); modelled at a real 160x200 on the same centre line and wall"),
    dict(id="p-night-1", kind="nightstand", r=rect(3050, 452, 3147, 556), room="parents"),
    dict(id="p-night-2", kind="nightstand", r=rect(3050, 962, 3147, 1066), room="parents"),
    dict(id="m-wardrobe", kind="wardrobe", r=rect(2280, 1432, 2412, 1795), front="E", room="mamad"),
    dict(id="m-bed-1", kind="bed_single", r=rect(2580, 1180, 3010, 1387), head="E", room="mamad"),
    dict(id="m-bed-2", kind="bed_single", r=rect(2580, 1586, 3010, 1795), head="E", room="mamad"),
    dict(id="b-wardrobe", kind="wardrobe", r=rect(2008, 2562, 2140, 2925), front="E", room="bedB"),
    dict(id="b-bed-1", kind="bed_single", r=rect(2305, 2310, 2745, 2517), head="E", room="bedB"),
    dict(id="b-bed-2", kind="bed_single", r=rect(2305, 2716, 2745, 2925), head="E", room="bedB"),
    dict(id="a-wardrobe", kind="wardrobe", r=rect(1372, 2062, 1735, 2195), front="S", room="bedA"),
    dict(id="a-bed-1", kind="bed_single", r=rect(1375, 2495, 1585, 2925), head="S", room="bedA"),
    dict(id="a-bed-2", kind="bed_single", r=rect(1765, 2495, 1975, 2925), head="S", room="bedA"),
    dict(id="bal-table", kind="outdoor_table", c=[mx(1700), my(548)], radius=round(78 / S / 100, 3), room="balcony"),
    dict(id="bal-chair-1", kind="outdoor_chair", c=[mx(1560), my(628)], yaw_deg=-25, room="balcony"),
    dict(id="bal-chair-2", kind="outdoor_chair", c=[mx(1838), my(618)], yaw_deg=25, room="balcony"),
    dict(id="bal-plant-1", kind="plant", c=[mx(668), my(630)], room="balcony"),
    dict(id="bal-plant-2", kind="plant", c=[mx(800), my(520)], room="balcony"),
]
for f in FURN:
    f.setdefault("class", "VERIFIED plan position (decor)")

out = {
    "meta": {
        "project": "Avnei Hefetz - Kedem", "building": 10, "floor": 1, "apartment": 3, "rooms": 5,
        "printed_area_m2": 108, "printed_balcony_m2": 8.8,
        "source_sheet": "input/b10-floor1-apts-3-4.jpg", "source_sha256": "c3f34daf4496a20f708619f1eabbaf3195c66166691b4725386c4762bd93af36",
        "px_per_cm": round(S, 4), "origin_px": [X0, Y0], "units": "metres, x east (sheet right), y north (sheet up)",
        "ceiling_m": H, "ceiling_class": "ASSUMED 2.60 m (no section or elevation in the documents)",
        "north": "ASSUMED = sheet up (the sheet carries no north arrow)",
    },
    "walls": walls, "openings": OPENINGS, "rooms": ROOMS, "balcony": BALCONY, "lightwell": LIGHTWELL,
    "laundry": LAUNDRY, "north_ledge": NORTH_LEDGE, "fixtures": FIX, "furniture": FURN,
    "extra_walls_note": [e[4] for e in EXTRA_WALLS],
}
foot = unary_union([box(*r) for rm in ROOMS for r in rm["rects"]] + [Polygon(w["exterior"]) for w in walls]
                   + [box(*o["r"]) for o in OPENINGS]).buffer(0.05, join_style=2).buffer(-0.05, join_style=2)
if foot.geom_type == "MultiPolygon":
    foot = max(foot.geoms, key=lambda p: p.area)
out["footprint"] = [[round(x, 4), round(y, 4)] for x, y in list(foot.exterior.coords)[:-1]]
(root / "geometry" / "geometry.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
net = sum(r["area_m2"] for r in ROOMS)
print("rooms:", len(ROOMS), "net floor area m2:", round(net, 1), "| openings:", len(OPENINGS), "| fixtures:", len(FIX), "| furniture:", len(FURN))
print("gross footprint (rooms + walls) m2:", round(foot.area, 1), "vertices", len(out["footprint"]))

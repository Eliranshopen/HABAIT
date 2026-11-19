"""Step 04 - the geometry of record for model Hatzav (3 rooms, 80 m2), read from input/plan-hatzav-colour.png.

Frame: u = plan x - 480, v = plan y - 267, both in cm (the sheet is drawn at 1.000 px per cm, fitted on
the eight overall dimension lines; see docs/source-evidence.md). u grows to plan-right, v grows to plan-bottom.
The model frame is X = u/100, Y = -v/100, Z up, metres; origin = the outer north-west corner of the house.
"Plan north" (top of the sheet) is a NAME only: the sheet carries no north arrow.

Every element carries a class:
  VERIFIED = drawn or printed on the sheet;  DERIVED = computed from the sheet or read from the developer's
  exterior render;  ASSUMED = needed for a 3D model but not in any source (all heights are in this class).

Writes geometry/geometry.json.
Usage: python 04_geometry.py <job root>
"""
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
OX, OY = 480, 267  # plan pixel of the origin


def px(x0, y0, x1, y1):
    """plan-pixel box -> cm box in the u,v frame"""
    return [x0 - OX, y0 - OY, x1 - OX, y1 - OY]


H_CEIL = 270  # ASSUMED
heights = {
    "ceiling_cm": {"v": H_CEIL, "cls": "ASSUMED", "why": "no section on the sheet; common Israeli residential clear height 2.60-2.75 m"},
    "door_head_cm": {"v": 210, "cls": "ASSUMED", "why": "standard interior door 2.05-2.10 m"},
    "safe_room_door_head_cm": {"v": 200, "cls": "ASSUMED", "why": "standard steel safe-room door 80x200"},
    "window_sill_cm": {"v": 100, "cls": "ASSUMED", "why": "the render shows windows with a sill at about one third of the wall"},
    "window_head_cm": {"v": 210, "cls": "ASSUMED", "why": "the render shows window heads level with the sliding door head"},
    "sliding_door_head_cm": {"v": 220, "cls": "DERIVED", "why": "exterior render: door height about two thirds of the facade"},
    "roof_slab_cm": {"v": 20, "cls": "ASSUMED", "why": "flat concrete roof"},
    "parapet_top_cm": {"v": 330, "cls": "DERIVED", "why": "exterior render: flat roof with a low parapet band"},
    "deck_top_cm": {"v": -2, "cls": "ASSUMED", "why": "deck flush with the floor"},
    "ground_cm": {"v": -15, "cls": "ASSUMED", "why": "garden a step below the floor"},
}

# ---------------------------------------------------------------- walls (plan-pixel boxes)
W = []


def wall(wid, box, cls="VERIFIED", note=""):
    W.append({"id": wid, "box": px(*box), "cls": cls, "note": note})


# Interior faces are set so that every PRINTED room dimension is met exactly (the print wins over the drawn
# pixels); they sit 0-2 cm from the drawn wall edges, inside the sheet's anti-aliasing. The eight overall
# dimensions are exact as drawn.
wall("ext-n-saferoom", (480, 267, 864, 301), note="34 cm, north wall of the safe room")
wall("ext-n-bedroom", (864, 267, 1205, 291), note="24 cm")
wall("ext-w-saferoom", (480, 267, 509, 591), note="29 cm")
wall("ext-w-bath", (480, 591, 504, 807), note="24 cm")
wall("ext-e-bedroom", (1179, 267, 1205, 703), note="26 cm")
wall("int-saferoom-bedroom", (844, 267, 864, 572), note="20 cm, safe room east wall")
wall("int-saferoom-s", (480, 571, 884, 591), note="20 cm, safe room south wall, with the safe-room door")
wall("int-hall-bedroom", (874, 591, 884, 703), note="10 cm partition with the bedroom door")
wall("int-bath-e", (684, 591, 692, 793), note="8 cm partition with the bathroom door")
wall("int-bath-s", (504, 781, 692, 793), note="12 cm partition bathroom | public space")
wall("ext-sw-corner", (480, 781, 554, 807), note="outer wall step at the entrance")
wall("ext-w-public", (530, 807, 554, 1317), note="24 cm, west wall of the public space, with the entrance door")
wall("int-kitchen-nib", (554, 925, 612, 933), note="8 cm nib beside the entrance, 58 cm long")
wall("ext-s", (530, 1293, 1310, 1317), note="24 cm south wall")
wall("ext-e-public", (1284, 703, 1310, 1317), note="26 cm east wall with the sliding door")
wall("ext-n-public-east", (1179, 703, 1310, 728), note="25 cm, north wall of the living room's east part (the bedroom block is set back 105 cm)")
wall("int-bedroom-living", (884, 701, 1179, 711), note="10 cm partition bedroom | living room")
wall("shaft", (805, 703, 884, 793), note="closed service shaft 79 x 90 cm, drawn with a crossed circle; modelled as a solid block")

# ---------------------------------------------------------------- openings
O = []


def opening(oid, kind, box, wall_id, sill, head, cls_plan="VERIFIED", **kw):
    O.append({"id": oid, "kind": kind, "box": px(*box), "wall": wall_id, "sill_cm": sill, "head_cm": head,
              "cls_position": cls_plan, "cls_heights": "ASSUMED", **kw})


opening("win-saferoom", "window", (639, 267, 742, 301), "ext-n-saferoom", 105, 205, width_cm=103,
        note="safe-room window, about 100 x 100, drawn with an outer blast shutter", panes=2)
opening("win-bedroom", "window", (990, 267, 1112, 291), "ext-n-bedroom", 100, 210, width_cm=122, panes=2)
opening("win-kitchen", "window", (643, 1293, 764, 1317), "ext-s", 105, 210, width_cm=121, panes=2,
        note="above the sink; sill raised above the worktop")
opening("win-living", "window", (1152, 1293, 1274, 1317), "ext-s", 100, 210, width_cm=122, panes=2)
opening("door-sliding", "sliding_door", (1284, 973, 1310, 1275), "ext-e-public", 0, 220, width_cm=302, panes=2,
        note="two sliding panels to the deck")
opening("door-entrance", "door", (530, 816, 554, 918), "ext-w-public", 0, 210, width_cm=102,
        hinge="n", swing="in", swing_dir="e", open_deg=0, leaf_cm=92, note="leaf drawn dashed, hinged on the plan-north jamb, opens into the house")
opening("door-saferoom", "door", (702, 571, 785, 591), "int-saferoom-s", 0, 200, width_cm=83,
        hinge="e", swing="out_to_hall", swing_dir="s", open_deg=172, leaf_cm=78, note="steel safe-room door, solid arc into the hall")
opening("door-bedroom", "door", (874, 605, 884, 686), "int-hall-bedroom", 0, 210, width_cm=81,
        hinge="s", swing="into_bedroom", swing_dir="e", open_deg=90, leaf_cm=76)
opening("door-bath", "door", (684, 600, 692, 681), "int-bath-e", 0, 210, width_cm=81,
        hinge="n", swing="into_bath", swing_dir="w", open_deg=90, leaf_cm=76)

# ---------------------------------------------------------------- rooms (interior faces)
R = [
    {"id": "public", "he": "חלל ציבורי", "en": "living, dining and kitchen", "printed_sqm": 39, "cls": "VERIFIED",
     "poly_px": [(554, 793), (884, 793), (884, 711), (1179, 711), (1179, 728), (1284, 728), (1284, 1293), (554, 1293)]},
    {"id": "hall", "he": "מבואה", "en": "hall", "printed_sqm": None, "cls": "DERIVED",
     "poly_px": [(692, 591), (874, 591), (874, 703), (805, 703), (805, 793), (692, 793)]},
    {"id": "saferoom", "he": 'ממ"ד', "en": "safe room (second bedroom)", "printed_sqm": 9, "cls": "VERIFIED",
     "poly_px": [(509, 301), (844, 301), (844, 571), (509, 571)]},
    {"id": "bedroom", "he": "חדר שינה", "en": "primary bedroom", "printed_sqm": 12, "cls": "VERIFIED",
     "poly_px": [(864, 291), (1179, 291), (1179, 701), (884, 701), (884, 572), (864, 572)]},
    {"id": "bath", "he": "חדר רחצה", "en": "bathroom", "printed_sqm": None, "cls": "VERIFIED",
     "poly_px": [(504, 591), (684, 591), (684, 781), (504, 781)]},
]
for r in R:
    r["poly"] = [[x - OX, y - OY] for x, y in r.pop("poly_px")]

# ---------------------------------------------------------------- printed dimensions and where they are measured
D = [
    # label, printed cm, axis, measured between plan pixels a..b
    ("overall width (top)", 830, "x", 480, 1310),
    ("north block width", 725, "x", 480, 1205),
    ("set-back of the bedroom block", 105, "x", 1205, 1310),
    ("overall depth (left)", 1050, "y", 267, 1317),
    ("north block depth", 540, "y", 267, 807),
    ("south block depth", 510, "y", 807, 1317),
    ("west offset of the south block", 50, "x", 480, 530),
    ("south block width", 780, "x", 530, 1310),
    ("safe room width", 335, "x", 509, 844),
    ("safe room depth", 270, "y", 301, 571),
    ("bedroom width (wall to wall)", 315, "x", 864, 1179),
    ("bedroom depth", 410, "y", 291, 701),
    ("bedroom clear width (to the 20 cm band)", 295, "x", 884, 1179),
    ("bathroom width", 180, "x", 504, 684),
    ("bathroom depth", 190, "y", 591, 781),
    ("public space width", 730, "x", 554, 1284),
    ("public space depth, kitchen side", 500, "y", 793, 1293),
    ("public space depth, living side", 565, "y", 728, 1293),
    ("living width east of the shaft", 400, "x", 884, 1284),
    ("deck depth", 300, "x", 1310, 1610),
]
dims = [{"label": l, "printed_cm": p, "axis": a, "from_px": f, "to_px": t, "model_cm": t - f,
         "delta_cm": (t - f) - p, "delta_pct": round(abs((t - f) - p) / p * 100, 2)} for l, p, a, f, t in D]

# ---------------------------------------------------------------- fixed fixtures and drawn furniture
F = []


def item(fid, kind, room, box, cls="VERIFIED", **kw):
    F.append({"id": fid, "kind": kind, "room": room, "box": px(*box), "cls": cls, **kw})


# kitchen (public space, west and south walls)
item("k-fridge", "fridge", "public", (554, 935, 620, 1023), note="65 deep x 88 long; read as a refrigerator", cls="DERIVED")
item("k-tall", "tall_unit", "public", (554, 1028, 612, 1090), note="60 x 62 unit between the fridge and the worktop; read as an oven tower", cls="DERIVED")
item("k-run-w", "base_units", "public", (554, 1090, 612, 1293), note="worktop run on the west wall, 59 deep")
item("k-hob", "hob", "public", (566, 1140, 620, 1196), note="four-ring hob")
# --- From here the public space follows the developer's interior renders (Projects/Harey_zahav_Naama/Corona-*.jpg,
# added 2026-11-17 14:37; Eliran 2026-11-17: "layout + look from the renders, walls by the sales plan"). Every piece below is
# DERIVED from those renders; the sales sheet's own furniture of the public space is kept in `plan_furniture_public` for the record.
D = "DERIVED"
RS = "developer interior renders (Corona), placed inside the sales-plan walls"
item("k-run-s", "base_units", "public", (612, 1233, 770, 1293), cls=D, note="sink run on the south wall under the kitchen window; " + RS)
item("k-sink", "sink", "public", (653, 1237, 713, 1290), note="single bowl under the kitchen window")
item("k-tall-s", "tall_unit", "public", (770, 1233, 889, 1293), cls=D, note="tall dark-oak column with two built-in ovens, beside the sink run; " + RS)
item("k-island", "island", "public", (630, 1032, 820, 1127), cls=D, note="kitchen island 190 x 95 (shortened from the render's ~220 so a 70 cm passage stays to the sofa), worktop overhang on the north side for four stools; " + RS)
for i, uc in enumerate((652, 699, 746, 793)):
    item(f"k-stool-{i+1}", "bar_stool", "public", (uc - 21, 985, uc + 21, 1029), cls=D, face="s", note=RS)
item("d-table", "dining_table", "public", (950, 1112, 1130, 1202), cls=D, note="oak table 180 x 90 in front of the bookshelf, by the glazing; " + RS)
for i, uc in enumerate((995, 1085)):
    item(f"d-chair-n{i+1}", "dining_chair", "public", (uc - 24, 1066, uc + 24, 1112), cls=D, face="s")
    item(f"d-chair-s{i+1}", "dining_chair", "public", (uc - 24, 1202, uc + 24, 1248), cls=D, face="n")
item("d-chair-w", "dining_chair", "public", (904, 1133, 950, 1181), cls=D, face="e")
item("d-chair-e", "dining_chair", "public", (1130, 1133, 1176, 1181), cls=D, face="w")
item("d-shelf", "bookshelf", "public", (902, 1258, 1142, 1293), cls=D, note="oak open shelving wall 240 wide on the south wall; it ends before the living window, which the sales plan draws (the render's shelf covers that corner); " + RS)
item("l-rug", "rug", "public", (892, 760, 1200, 1030), cls=D, note=RS)
item("l-sofa", "sofa", "public", (890, 937, 1190, 1037), cls=D, back="s", note="three-module rounded sofa 300 x 100 facing the TV wall, its back to the dining table; " + RS)
item("l-table-round", "coffee_table_round", "public", (1000, 787, 1080, 867), cls=D, note="round oak table, 80 diameter; " + RS)
item("l-chair-rattan", "lounge_chair", "public", (1203, 770, 1273, 840), cls=D, rot_deg=-35, note="rattan lounge chair; " + RS)
item("l-console", "tv_console", "public", (900, 711, 1170, 751), cls=D, note="low oak console 270 x 40 on the bedroom partition; " + RS)
item("l-tv", "tv", "public", (975, 711, 1105, 715), cls=D, note="130 cm television on the partition; " + RS)
item("l-shelf-tall", "bookshelf", "public", (1180, 728, 1284, 763), cls=D, note="tall double oak bookcase in the set-back corner; " + RS)
# bedroom
item("b-bed", "double_bed", "bedroom", (979, 358, 1179, 518), head="e", note="160 x 201, head on the east wall")
item("b-night-n", "nightstand", "bedroom", (1139, 318, 1179, 358))
item("b-night-s", "nightstand", "bedroom", (1139, 518, 1179, 558))
item("b-wardrobe", "wardrobe", "bedroom", (979, 641, 1179, 701), note="201 x 60 on the south wall")
item("b-band", "wall_unit", "bedroom", (864, 291, 884, 572), cls="DERIVED",
     note="20 cm band along the west wall, not counted in the printed 12 sqm and outside the printed 295; read as a shallow wall unit that carries the television")
item("b-tv", "tv", "bedroom", (868, 356, 876, 478), cls="DERIVED", note="television symbol on the band")
# safe room
item("s-bed", "single_bed", "saferoom", (509, 301, 599, 501), head="n", note="90 x 200, head on the north wall")
item("s-desk", "desk", "saferoom", (782, 301, 844, 441), note="62 x 140 on the east wall")
item("s-chair", "desk_chair", "saferoom", (725, 345, 775, 400), face="e")
item("s-closet", "wardrobe", "saferoom", (782, 441, 844, 571), note="62 x 131 on the east wall")
# bathroom
item("t-wc-wall", "build_out", "bath", (504, 591, 523, 700), note="18-20 cm build-out behind the toilet (concealed cistern)")
item("t-wc", "toilet", "bath", (523, 614, 568, 652), face="e")
item("t-shower", "shower", "bath", (504, 703, 595, 781), note="90 x 80 shower in the south-west corner")
item("t-vanity", "vanity", "bath", (595, 735, 684, 781), note="90 x 48 vanity with a basin")


plan_furniture_public = {
    "source": "the sales sheet (plan-hatzav-colour.png); replaced in the model by the developer's interior renders, Eliran 2026-11-17",
    "dining": "table 90 x 180 at plan px (735, 942)-(825, 1122), six chairs", "living": "corner sofa 300 x 101 + 100 x 301 along the north and east walls,"
    " two nested coffee tables, armchair at 45 degrees, rug 302 x 303, TV console 250 x 41 and TV on the south wall",
}

# ---------------------------------------------------------------- outside
X = [
    {"id": "deck", "kind": "deck", "box": px(1310, 703, 1610, 1317), "cls": "VERIFIED",
     "note": "timber deck drawn 300 x 614; the printed '-380-' beside it does NOT match the drawing (see source-evidence.md, conflict C1); the drawn size is modelled"},
    {"id": "pergola", "kind": "pergola", "box": px(1310, 703, 1610, 1317), "cls": "DERIVED",
     "note": "slatted pergola at roof level over the deck: shown in the developer's exterior render of this model (brochure p.5), not drawn on the plan; size taken as the deck's"},
    {"id": "entrance-step", "kind": "paving", "box": px(480, 807, 530, 990), "cls": "VERIFIED", "note": "paved strip at the entrance door"},
    {"id": "future-extension", "kind": "not_built", "box": px(1205, 267, 2030, 700), "cls": "VERIFIED",
     "note": "dashed outline east of the bedroom, 825 x 433: an optional extension envelope (725 + 825 = 1550 = the length of model Eshel); NOT part of this house, not modelled"},
]

footprint = [[0, 0], [725, 0], [725, 436], [830, 436], [830, 1050], [50, 1050], [50, 540], [0, 540]]

geo = {
    "model": "Hatzav (דגם חצב), 3 rooms, 80 m2, garden - Moshav Na'ama, Harei Zahav",
    "source": {"file": "input/plan-hatzav-colour.png", "sha256": "f2262e246ea65b4d63a325e4e22a2332154a89f414720b5a18cd207a6d987aee",
               "px_per_cm": 1.0, "origin_px": [OX, OY]},
    "frame": "u,v in cm; X = u/100, Y = -v/100 (m); origin = outer NW corner; plan-top is called north by name only",
    "heights": heights, "footprint": footprint, "walls": W, "openings": O, "rooms": R,
    "dimensions": dims, "items": F, "outside": X, "plan_furniture_public": plan_furniture_public,
}
out = root / "geometry" / "geometry.json"
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(geo, ensure_ascii=False, indent=1), encoding="utf-8")
print("walls", len(W), "openings", len(O), "rooms", len(R), "items", len(F), "dims", len(dims))
worst = max(dims, key=lambda d: d["delta_pct"])
print("worst printed dimension:", worst["label"], worst["printed_cm"], "->", worst["model_cm"], f'{worst["delta_pct"]} %')

"""kedma-d1: the fixtures the sales-plan sheet draws, put where and as the sheet draws them (2026-11-17).

Why: Eliran's look at the tour found the kitchen island crooked; the audit behind it (hand/sheet_zoom.py: the sheet enlarged with a
centimetre grid and the traced rectangles on it) showed that the first hand trace read some rectangles by eye about 30 cm off, typed
the bathtub as a 'washer' (never built) and gave the two diagonal sun loungers their upright bounding boxes. Eliran, 2026-11-17:
furniture «בדיוק כמו בתוכנית».

What: every value below was read off the gridded enlargement named beside it (jobs/kedma-d1/review/flat/). The script rewrites the
fixtures in a plan file (the apartment's plan.general.json and hand/plan.final.json): the rectangle, the kind where it was wrong, and
the pieces the sheet draws that the trace left out. It is idempotent.

usage: python fix_fixtures_1117.py <plan.json> [<plan.json> ...]
"""
import json
import math
import sys

SRC = "sales-plan drawing, read off a centimetre grid on the sheet (hand/sheet_zoom.py, 2026-11-17)"

# id -> (x0, y0, x1, y1) in plan cm : rectangles parallel to the sheet's axes
RECTS = {
    "k-island":  (733.6, 433.6, 857.7, 492.5),   # sheet-kitchen-island.jpg: was 705.6-825.6 x 436.6-490.6 (30 cm west, 4 cm short)
    "k-counter": (626.5, 253.6, 924.5, 315.0),   # sheet-kitchen-ne.jpg: the marble run reaches the crossed unit (was 891.3)
    "k-tall-1":  (924.5, 253.0, 987.0, 310.0),   # sheet-kitchen-ne.jpg: the crossed square (was 896-952.4); the sheet's 4 cm slit to the
                                                 # grey appliance (982.7-987) is closed: two flush units, as built-in units stand
    "k-tall-2":  (987.0, 255.0, 1076.0, 324.0),  # sheet-kitchen-ne.jpg: the grey appliance with two handles (was 959-1044 x 254-323)
}
# id -> new kind
KINDS = {"ba-tub": "bathtub"}                    # sheet-room-r-bath.jpg: the bathtub on the east wall; 'washer' has no shape, it was never built
# id -> (centre x, centre y, length, width, angle of the length in degrees, plan frame: x right, y down)
ROTATED = {
    "t-lounger-1": (435.7, 357.5, 148.0, 55.0, -29.7),   # sheet-loungers.jpg: four corners read, head to the upper right
    "t-lounger-2": (472.7, 420.3, 148.0, 55.0, -29.7),
}
# id -> the bearing its front looks along (0 = up on the sheet, clockwise). A lounger is built from a bed: its front is its foot, so both
# feet point down-left and both heads up-right, as drawn; a stool faces the island it stands at.
FRONTS = {"t-lounger-1": 240.3, "t-lounger-2": 240.3, "k-stool-1": 180.0, "k-stool-2": 180.0}
# ids whose stored angle becomes 0: the crossed tall unit was stored turned a quarter (angle 90), so its front looked along the wall
ANGLE0 = {"k-tall-1"}
# pieces the sheet draws and the trace left out: id -> (room, kind, x0, y0, x1, y1, height, note)
NEW = {
    "k-stool-1": ("r-kitchen", "stool", 750.0, 404.0, 788.0, 434.0, 65.0, "a bar stool on the island's north side (sheet-kitchen-island.jpg)"),
    "k-stool-2": ("r-kitchen", "stool", 805.0, 404.0, 843.0, 434.0, 65.0, "a bar stool on the island's north side (sheet-kitchen-island.jpg)"),
    "p-shelf-n": ("r-pantry", "shelving", 1094.0, 252.4, 1194.7, 308.0, 220.0, "the wood-toned shelving on the pantry's north wall (sheet-room-r-pantry.jpg)"),
    "p-shelf-e": ("r-pantry", "shelving", 1194.7, 311.0, 1248.7, 427.3, 220.0, "the wood-toned shelving in the pantry's east recess (sheet-room-r-pantry.jpg)"),
    "l-pouf":    ("r-living", "pouf", 868.0, 656.0, 922.0, 710.0, 40.0, "the round pouf with a throw beside the coffee tables (sheet-room-r-living.jpg)"),
    "l-plant":   ("r-living", "plant", 640.0, 512.0, 690.0, 562.0, 70.0, "the plant beside the television unit (sheet-room-r-living.jpg)"),
}
# a table's chairs as the sheet draws them: id -> ("long", the count on each long side, the count on each end), or the four counts
# themselves (+N, -N, +L, -L) for a desk with its one chair (built-all.jpg against the sheet)
CHAIRS = {"d-table": ("long", 3, 0), "t-table": ("long", 3, 0), "b1-desk": [1, 0, 0, 0], "b2-desk": [1, 0, 0, 0], "s-desk": [0, 1, 0, 0]}
# beds the sheet draws alone: no bedside tables, lamps or art are derived
BEDS_ALONE = {"m-bed", "b1-bed", "b2-bed", "s-bed"}
# template pieces the sheet does not draw (it draws one rug, in the living room)
TEMPLATE_SKIP = ["ffp-family-rug", "ffp-master-rug", "ffp-living-lamp"]


def r1(v):
    return round(float(v), 1)


def rect_fields(x0, y0, x1, y1, angle):
    """the stored shape of a rectangle parallel to the axes: the trace keeps angle 0 (size = [dx, dy]) or 90 (size = [dy, dx])"""
    dx, dy = x1 - x0, y1 - y0
    size = [r1(dy), r1(dx)] if int(round(angle)) % 180 == 90 else [r1(dx), r1(dy)]
    return {"polygon_cm": [[r1(x1), r1(y1)], [r1(x0), r1(y1)], [r1(x0), r1(y0)], [r1(x1), r1(y0)]],
            "centre_cm": [r1((x0 + x1) / 2), r1((y0 + y1) / 2)], "size_cm": size}


def rotated_fields(cx, cy, length, width, ang):
    a = math.radians(ang)
    L, N = (math.cos(a), math.sin(a)), (-math.sin(a), math.cos(a))
    c = [(cx + sx * L[0] * length / 2 + sy * N[0] * width / 2, cy + sx * L[1] * length / 2 + sy * N[1] * width / 2)
         for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
    return {"polygon_cm": [[r1(x), r1(y)] for x, y in c], "centre_cm": [r1(cx), r1(cy)], "size_cm": [r1(length), r1(width)], "angle_deg": r1(ang)}


for path in sys.argv[1:]:
    plan = json.load(open(path, encoding="utf-8"))
    fx = plan.get("fixtures") or []
    by = {f["id"]: f for f in fx}
    log = []
    for fid, (x0, y0, x1, y1) in RECTS.items():
        f = by[fid]
        if fid in ANGLE0 and f.get("angle_deg") != 0:
            f["angle_deg"] = 0; log.append(f"{fid}: angle 0")
        new = rect_fields(x0, y0, x1, y1, f.get("angle_deg", 0))
        if any(f.get(k) != v for k, v in new.items()):
            f.update(new); f["source"] = SRC; log.append(f"{fid}: rectangle {x0}-{x1} x {y0}-{y1}")
    for fid, kind in KINDS.items():
        if by[fid]["kind"] != kind:
            by[fid]["kind"] = kind; by[fid]["source"] = SRC; log.append(f"{fid}: kind {kind}")
    for fid, (cx, cy, ln, wd, ang) in ROTATED.items():
        f = by[fid]; new = rotated_fields(cx, cy, ln, wd, ang)
        if any(f.get(k) != v for k, v in new.items()):
            f.update(new); f["source"] = SRC; log.append(f"{fid}: {ln} x {wd} at {ang} deg, centre {cx},{cy}")
    for fid, (room, kind, x0, y0, x1, y1, h, note) in NEW.items():
        rec = {"id": fid, "room_id": room, "kind": kind, **rect_fields(x0, y0, x1, y1, 0), "z_cm": 0, "height_cm": h, "angle_deg": 0, "source": SRC, "note": note}
        rec = {k: rec[k] for k in ("id", "room_id", "kind", "polygon_cm", "z_cm", "height_cm", "centre_cm", "angle_deg", "size_cm", "source", "note")}
        if fid not in by:
            fx.append(rec); log.append(f"{fid}: added ({kind})")
        elif by[fid] != rec:
            by[fid].clear(); by[fid].update(rec); log.append(f"{fid}: rewritten")
    by = {f["id"]: f for f in fx}
    for fid, deg in FRONTS.items():
        if by[fid].get("front_deg") != deg:
            by[fid]["front_deg"] = deg; log.append(f"{fid}: front {deg}")
    for fid, spec in CHAIRS.items():
        f = by[fid]
        if isinstance(spec, tuple):
            s0, s1 = f["size_cm"]; n_long, n_end = spec[1], spec[2]
            per = [n_long, n_long, n_end, n_end] if s0 >= s1 else [n_end, n_end, n_long, n_long]
        else:
            per = spec
        if f.get("chairs_per_side") != per:
            f["chairs_per_side"] = per; log.append(f"{fid}: chairs per side {per}")
    for fid in sorted(BEDS_ALONE):
        if by[fid].get("derive") is not False:
            by[fid]["derive"] = False; log.append(f"{fid}: drawn alone")
    cues = plan.setdefault("furnish_cues", {})
    if cues.get("template_skip") != TEMPLATE_SKIP:
        cues["template_skip"] = TEMPLATE_SKIP; log.append("furnish_cues.template_skip set")
    plan["fixtures"] = fx
    json.dump(plan, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(path, "->", len(log), "changes:", "; ".join(log) if log else "none (already applied)")

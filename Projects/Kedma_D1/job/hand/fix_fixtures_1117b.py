"""kedma-d1: the plan data after the SECOND reading of the sales-plan sheet (2026-11-17, review/audit/second-read.md).

An independent reader compared the sheet with the model room by room (hand/plan_audit.py pictures). What it found and this file fixes:
  living   two coffee tables (a round wood one, a rounded marble one), not one rectangle; the pouf is round and larger
  family   the coffee table is round
  kitchen  the brushed-steel block at the end of the north run is a fridge
  terrace  the palm stands in the north-west corner (the model had a plant in the north-east); three plants in the south-west corner
  laundry  the air-conditioner's outdoor unit («מעבה») and the water heater («דוד») were missing
  mats     the entrance mat and the shower-room mat are not drawn: not placed
Positions are read off the audit pictures (3.6 px per cm, the room's own frame). Idempotent.

usage: python fix_fixtures_1117b.py <plan.general.json> [<another plan> ...]
"""
import io
import json
import sys

SRC = "sales-plan drawing, second reading 2026-11-17 (review/audit/second-read.md, hand/plan_audit.py pictures)"


def mk(fid, room, kind, cx, cy, w, d, h, note, **extra):
    x0, y0, x1, y1 = cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2
    f = {"id": fid, "room_id": room, "kind": kind, "polygon_cm": [[x1, y1], [x0, y1], [x0, y0], [x1, y0]], "z_cm": 0, "height_cm": h,
         "centre_cm": [round(cx, 1), round(cy, 1)], "angle_deg": 0, "size_cm": [round(w, 1), round(d, 1)], "source": SRC, "note": note}
    f.update(extra)
    return f


REPLACE = {   # id -> the fixture as the sheet draws it
    "l-coffee": mk("l-coffee", "r-living", "table", 764.6, 751.6, 68, 68, 40, "the round wood coffee table", shape="round", material="wood_oak"),
    "l-pouf": mk("l-pouf", "r-living", "pouf", 897.6, 671.5, 62, 62, 40, "the round pouf with a throw", shape="round"),
}
NEW = [
    mk("l-coffee-2", "r-living", "table", 812.6, 738.0, 58, 58, 34, "the rounded marble side table, overlapping the wood one", shape="round", material="ceramic_white"),
    mk("t-palm", "r-balcony", "plant", 272.0, 282.0, 50, 50, 180, "the big palm in the north-west corner"),
    mk("t-plant-1", "r-balcony", "plant", 278.0, 755.0, 45, 45, 100, "south-west cluster: the large-leaf plant"),
    mk("t-plant-2", "r-balcony", "plant", 268.0, 806.0, 45, 45, 90, "south-west cluster: the second broad plant"),
    mk("t-plant-3", "r-balcony", "plant", 319.0, 810.0, 35, 35, 60, "south-west cluster: the small white-patterned plant"),
    mk("la-condenser", "r-laundry", "block", 1231.35, 1445.7, 103.3, 34.2, 65, "the air-conditioner's outdoor unit («מעבה»)", build_as="ac_condenser", material="ceramic_white"),
    mk("la-boiler", "r-laundry", "block", 1362.2, 1442.2, 44, 44, 150, "the water heater («דוד»)", shape="round", build_as="water_heater", material="ceramic_white"),
]
PATCH = {"f-coffee": {"shape": "round", "material": "ceramic_white", "size_cm": [70, 70], "note": "the round marble table with flowers (about 70 cm across)"},
         "k-tall-2": {"appliance": "fridge", "note": "the brushed-steel block at the east end of the north run: a fridge"}}
SKIP = ["ffp-dining-doormat", "ffp-shower-mat", "ffp-balcony-plant-1", "ffp-balcony-plant-2"]

for p in sys.argv[1:]:
    raw = io.open(p, encoding="utf-8", newline="").read()
    plan = json.loads(raw)
    fx = plan["fixtures"]
    for i, f in enumerate(fx):
        if f["id"] in REPLACE:
            fx[i] = REPLACE[f["id"]]
        if f["id"] in PATCH:
            f.update(PATCH[f["id"]])
            if f["id"] == "f-coffee":                      # round, on its own centre
                cx, cy = f["centre_cm"]
                f["polygon_cm"] = [[cx + 35, cy + 35], [cx - 35, cy + 35], [cx - 35, cy - 35], [cx + 35, cy - 35]]
    have = {f["id"] for f in fx}
    fx += [f for f in NEW if f["id"] not in have]
    cues = plan.setdefault("furnish_cues", {})
    cues["template_skip"] = sorted(set(cues.get("template_skip", [])) | set(SKIP))
    s = json.dumps(plan, ensure_ascii=False, indent=1) + "\n"
    io.open(p, "w", encoding="utf-8", newline="").write(s.replace("\n", "\r\n") if "\r\n" in raw else s)
    print(p, "fixtures", len(fx), "| template_skip", cues["template_skip"])

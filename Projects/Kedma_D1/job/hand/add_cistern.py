"""kedma-d1 hand trace, step 8 ($0): the two concealed-cistern build-outs the sheet draws behind the wall-hung toilets.

geometry.json holds them (cistern_boxes: the light-grey boxes, 14 and 19 cm deep) but the first trace left them out of the plan.
The designed bathroom picture draws the build-out behind its toilet, as the sheet does; the fidelity gate read it as a wall
7.8 cm nearer than the plan's (web set, 235-238 deg, 2.53 %): the picture was right and the plan was short of the sheet.
They enter the plan as fixtures the gate treats as standing in front of the wall (kind 'wardrobe' = a built-in that covers its
wall; the plan's fixture kinds have no build-out), each with its own words, 120 cm high. The CG renders were made before this
and do not carry them (a re-render would make every picture of the two rooms stale); recorded in plan_meta.hand_edits.
usage: python add_cistern.py <job dir> <plan.json>       (idempotent)"""
import json, sys
from pathlib import Path
job = Path(sys.argv[1]).resolve(); p = Path(sys.argv[2]).resolve(); h = job / "hand"
g = json.loads((h / "geometry.json").read_text(encoding="utf-8")); t = json.loads((h / "transform.json").read_text(encoding="utf-8"))
F, (OX, OY), PPC, S = t["F"], t["offset_px"], t["clean_px_per_cm"], t["native_px_per_cm"]
cm = lambda x, y: [round((x * F + OX) / PPC, 2), round((y * F + OY) / PPC, 2)]
plan = json.loads(p.read_text(encoding="utf-8")); have = {f["id"] for f in plan["fixtures"]}; added = []
for b in g["cistern_boxes"]:
    if b["id"] in have:
        continue
    x0, y0, x1, y1 = b["rect"]
    plan["fixtures"].append({"id": b["id"], "room_id": "r-" + b["room"], "kind": "wardrobe", "polygon_cm": [cm(x0, y0), cm(x1, y0), cm(x1, y1), cm(x0, y1)], "z_cm": 0,
                             "height_cm": 120, "centre_cm": cm((x0 + x1) / 2, (y0 + y1) / 2), "angle_deg": 90, "size_cm": [round((y1 - y0) / S, 1), round((x1 - x0) / S, 1)],
                             "words_en": "a tiled concealed-cistern build-out behind the wall-hung toilet, about 120 cm high, with a matte black flush plate",
                             "source": "the sheet's light-grey box behind the toilet (jobs/kedma-d1/hand/geometry.json cistern_boxes)",
                             "note": "kind 'wardrobe' only so that the gate treats it as a built-in covering its wall; it is a build-out, not a wardrobe"})
    added.append(b["id"])
if added:
    plan["plan_meta"].setdefault("hand_edits", []).append("add_cistern: " + ", ".join(added) + " (the sheet's concealed-cistern build-outs) added as fixtures after the CG render; the CG does not carry them")
    p.write_text(json.dumps(plan, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("added", added)

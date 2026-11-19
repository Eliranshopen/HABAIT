"""kedma-d1 hand trace, step 5 ($0): what the tracer cannot express, written into the traced plan by rule.

trace-plan.mjs knows doors and floor-to-ceiling glass (apartment 846 is a tower with a glass facade). This sheet has ordinary
windows with a sill, a sliding door to the balcony and passages with no leaf. This script reads hand/plan.general.json (the
tracer's export) and hand/geometry.json and writes hand/plan.final.json:
  - one `window` opening per window gap of the sheet (sill/head = assumptions, listed in plan_meta.assumptions)
  - the living|balcony glass as a `sliding_door` (the facade pane the tracer made for it is removed: one glass, not two)
  - the passages the sheet draws with no leaf as `opening` (nothing built), the kitchen window over the counter as `window`
  - the diagonal kitchen|dining contact the zone bars made is removed (a virtual corner, not a doorway)
  - a railing pane on the laundry hideaway's outer edge (the tracer drops it as a far screen)
Every edit is recorded in plan_meta.hand_edits. Idempotent: always starts from the tracer's export.
"""
import json
import sys
from pathlib import Path

job = Path(sys.argv[1]).resolve()
hand = job / "hand"
g = json.loads((hand / "geometry.json").read_text(encoding="utf-8"))
t = json.loads((hand / "transform.json").read_text(encoding="utf-8"))
plan = json.loads((hand / "plan.general.json").read_text(encoding="utf-8"))
F, (OX, OY), PPC, S = t["F"], t["offset_px"], t["clean_px_per_cm"], t["native_px_per_cm"]
cm = lambda p: [round((p[0] * F + OX) / PPC, 2), round((p[1] * F + OY) / PPC, 2)]
edits = []
H = plan["plan_meta"]["ceiling_height_cm"]

SILL = {"w-kitchen": (105, 215, "over the counter"), "w-family": (100, 215, ""), "w-master": (100, 215, ""), "w-shower": (150, 215, "a bathroom window"),
        "w-bed1": (100, 215, ""), "w-bed2": (100, 215, ""), "w-mamad": (100, 200, "the safe room's window"), "w-utility": (100, 215, "to the laundry hideaway")}
by_pair = {frozenset(o["rooms"]): o for o in plan["openings"]}


def seg(it):
    x0, y0, x1, y1 = it["rect"]
    if it["wall"] == "v":
        a, b = ((x0 + x1) / 2, y0), ((x0 + x1) / 2, y1); ang = 90.0; w = (y1 - y0) / S
    else:
        a, b = (x0, (y0 + y1) / 2), (x1, (y0 + y1) / 2); ang = 0.0; w = (x1 - x0) / S
    return cm(a), cm(b), cm(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)), ang, round(w, 1)


for w in g["windows"]:
    if w["kind"] == "sliding-door":
        o = by_pair.get(frozenset(["r-" + r for r in w["rooms"]]))
        assert o, f"no traced opening for {w['id']}"
        a, b, c, ang, wid = seg(w)
        o.update(kind="sliding_door", sill_cm=0, head_cm=220, a_cm=a, b_cm=b, centre_cm=c, angle_deg=ang, width_cm=wid,
                 source="hand: the sheet's glazed gap to the balcony (geometry.json " + w["id"] + ")")
        n0 = len(plan["panes"])
        plan["panes"] = [p for p in plan["panes"] if not (p["kind"] == "facade" and abs(p["bbox_cm"][0] - c[0]) < 15 and p["bbox_cm"][1] < c[1] < p["bbox_cm"][3])]
        edits.append(f"{o['id']}: opening -> sliding_door {wid} cm, head 220 (assumption); {n0 - len(plan['panes'])} facade pane removed")
        continue
    sill, head, why = SILL[w["id"]]
    a, b, c, ang, wid = seg(w)
    rooms = ["r-" + w["rooms"][0], "outside"]
    if w["id"] == "w-utility":
        rooms = ["r-bath", "r-laundry"]      # keeps the hideaway reachable (one link), as the sheet's only way into it
    old = by_pair.get(frozenset(["r-" + r for r in w["rooms"]])) if len(w["rooms"]) == 2 else None
    if old:
        plan["openings"].remove(old); edits.append(f"{old['id']} ({old['kind']} {old['rooms']}) replaced by window {w['id']}")
    plan["openings"].append({"id": w["id"], "kind": "window", "rooms": rooms, "a_cm": a, "b_cm": b, "centre_cm": c, "angle_deg": ang,
                             "width_cm": wid, "sill_cm": sill, "head_cm": head,
                             "source": f"hand: the sheet's window gap (geometry.json); sill {sill} / head {head} assumed" + (f", {why}" if why else "")})
    edits.append(f"{w['id']}: window {wid} cm added, sill {sill} head {head} (assumption)")

for pair, why in ((("r-kitchen", "r-pantry"), "the pantry passage: no leaf on the sheet"), (("r-dining", "r-family"), "the family-room passage: no leaf on the sheet"),
                  (("r-corridor", "r-living"), "the passage to the bedrooms' corridor")):
    o = next((o for o in plan["openings"] if set(o["rooms"]) == set(pair)), None)
    assert o, f"no traced opening {pair}"
    o.update(kind="opening", sill_cm=0, head_cm=H); o["source"] = (o.get("source") or "") + f"; hand: {why}"
    edits.append(f"{o['id']} {pair}: door -> opening (nothing built), {why}")
bad = [o for o in plan["openings"] if set(o["rooms"]) == {"r-dining", "r-kitchen"} and abs(o["angle_deg"]) not in (0, 90)]
for o in bad:
    plan["openings"].remove(o); edits.append(f"{o['id']} dining|kitchen at {o['angle_deg']} deg removed: the corner of two zone bars, not a doorway")

for r in g["railings"]:
    if r["id"] != "rail-laundry":
        continue
    (x0, y), (x1, _) = r["line"]
    a, b = cm((x0, y - 3)), cm((x1, y + 3))
    poly = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]]
    plan["panes"].append({"id": "railing-laundry", "kind": "railing", "sill_cm": 0, "head_cm": 110, "polygon_cm": poly,
                          "bbox_cm": [a[0], a[1], b[0], b[1]], "diag_cm": round(((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5, 1)})
    edits.append("railing-laundry: a 110 cm railing on the hideaway's outer edge (the sheet draws a louvred screen; simplified)")

ent = next(o for o in plan["openings"] if o["kind"] == "entrance_door")
plan["plan_meta"]["entrance"] = {"opening": ent["id"], "centre_cm": ent["centre_cm"], "width_cm": ent["width_cm"], "room": [r for r in ent["rooms"] if r != "outside"][0]}
plan["plan_meta"]["assumptions"] = list(plan["plan_meta"].get("assumptions", [])) + [
    "window sills 100 cm and heads 215 cm (kitchen sill 105, shower-room sill 150, safe room head 200): the sheet has no elevation",
    "the balcony door is a sliding glass door with a 220 cm head",
]
plan["plan_meta"]["hand_edits"] = edits
plan["plan_meta"]["sheet_scale"] = {"native_px_per_cm": S, "printed_dims_checked": 24, "within_max_2pct_5cm": 24, "within_1pct": 21}
(hand / "plan.final.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
from collections import Counter
print("openings:", dict(Counter(o["kind"] for o in plan["openings"])), "| panes:", [(p["id"], p["kind"]) for p in plan["panes"]])
for e in edits:
    print(" -", e)

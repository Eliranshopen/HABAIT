"""kedma-d1, after the runner's casework step ($0): the sheet has no CAD vectors, so the step writes no hob/sink symbol and types
both tall units as a fridge. The sheet DRAWS the sink, the hob and one fridge: this puts them into the apartment's plan
(plan.casework_symbols.symbols, the field furnish_from_plan.py reads; parity row 18) and restores the hand tall types."""
import json, sys
from pathlib import Path
job = Path(sys.argv[1]).resolve(); plan_p = Path(sys.argv[2]).resolve(); h = job / "hand"
g = json.loads((h / "geometry.json").read_text(encoding="utf-8")); t = json.loads((h / "transform.json").read_text(encoding="utf-8"))
F, (OX, OY), PPC = t["F"], t["offset_px"], t["clean_px_per_cm"]
cm = lambda p: [round((p[0] * F + OX) / PPC, 2), round((p[1] * F + OY) / PPC, 2)]
plan = json.loads(plan_p.read_text(encoding="utf-8"))
cs = plan.setdefault("casework_symbols", {"version": 1, "symbols": []})
cs["symbols"] = [{"kind": s["kind"], "on_fixture": s["on_fixture"], "centre_cm": cm(s["centre"]), "evidence": s["evidence"], "source": "hand (jobs/kedma-d1/hand/geometry.json)"} for s in g["casework_symbols"]]
cs["note"] = "no CAD vectors for this drawing: the hob and the sink are read off the sheet's picture by hand"
want = {f["id"]: f["tall_type"] for f in g["fixtures"] if f.get("tall_type")}
for f in plan["fixtures"]:
    if f["id"] in want:
        f["tall_type"] = want[f["id"]]; f["tall_type_source"] = "the sheet's picture, read by hand: " + next(x["note"] for x in g["fixtures"] if x["id"] == f["id"])
plan_p.write_text(json.dumps(plan, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("symbols", [(s["kind"], s["on_fixture"], s["centre_cm"]) for s in cs["symbols"]], "| tall", [(f["id"], f.get("tall_type")) for f in plan["fixtures"] if f["kind"] == "tall_unit"])

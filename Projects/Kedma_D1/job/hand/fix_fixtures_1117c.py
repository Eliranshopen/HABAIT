"""kedma-d1: the plan data after Eliran's answers of 2026-11-17 (his sixteen open items, answered in the question dialog).

  kitchen   closed upper cabinets over the north run (furnish_cues.kitchen_uppers = "cabinets"; was "shelves", the house look's)
  desks     the chair is tucked further under the desk (chair_tuck_cm 35): the sheet shows about 17 cm of it beyond the desk's edge
His other answers change no data: the bar between the island and the television wall is a full wall (as modelled); the crossed
square beside the fridge is a tall cabinet (as modelled); the small symbols of the sheet are not built.
Idempotent.

usage: python fix_fixtures_1117c.py <plan.general.json> [<another plan> ...]
"""
import io
import json
import sys

for p in sys.argv[1:]:
    raw = io.open(p, encoding="utf-8", newline="").read()
    plan = json.loads(raw)
    cues = plan.setdefault("furnish_cues", {})
    cues["kitchen_uppers"] = "cabinets"
    cues["source"] = "Eliran 2026-11-17: closed upper cabinets (the sheet draws nothing over the north run)"
    n = 0
    for f in plan["fixtures"]:
        if f["id"] in ("b1-desk", "b2-desk", "s-desk"):
            f["chair_tuck_cm"] = 35
            n += 1
    s = json.dumps(plan, ensure_ascii=False, indent=1) + "\n"
    io.open(p, "w", encoding="utf-8", newline="").write(s.replace("\n", "\r\n") if "\r\n" in raw else s)
    print(p, "kitchen_uppers", cues["kitchen_uppers"], "| desks with a deeper tuck", n)

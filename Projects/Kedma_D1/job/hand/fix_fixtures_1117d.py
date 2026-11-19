"""kedma-d1: the kitchen's closed upper cabinets are a FIXTURE of the plan, not a furnishing cue (2026-11-17).

Why: built from the cue (furnish_cues.kitchen_uppers = "cabinets") they stood in the 3D model but not in the plan, and the fidelity
gate - which checks the render against the plan's walls and its tall fixtures at eye height - read 35 cm of cabinet in front of the
north wall as a wall in the wrong place (FAIL 12.76 %). A row of cabinets at eye height is a fact of the apartment as Eliran ruled it
(«ארונות עליונים סגורים»), so it is written where the gate reads: one fixture, kind `block`, from 150 cm to 222 cm, 35 cm deep, over
the north run (k-counter). `height_cm` of a block is its TOP; `z_cm` its underside.

usage: python fix_fixtures_1117d.py <plan.general.json> [<another plan> ...]      idempotent
"""
import io
import json
import sys

for p in sys.argv[1:]:
    raw = io.open(p, encoding="utf-8", newline="").read()
    plan = json.loads(raw)
    fx = plan["fixtures"]
    c = next(f for f in fx if f["id"] == "k-counter")
    xs = [q[0] for q in c["polygon_cm"]]; ys = [q[1] for q in c["polygon_cm"]]
    x0, x1, y0 = min(xs), max(xs), min(ys)                      # the run's back is its north edge (the wall)
    up = {"id": "k-uppers", "room_id": "r-kitchen", "kind": "block", "polygon_cm": [[x1, y0 + 35.0], [x0, y0 + 35.0], [x0, y0], [x1, y0]],
          "z_cm": 150, "height_cm": 222, "centre_cm": [round((x0 + x1) / 2, 1), round(y0 + 17.5, 1)], "angle_deg": 0,
          "size_cm": [round(x1 - x0, 1), 35.0], "build_as": "kitchen_uppers", "material": "wood_oak",
          "source": "Eliran 2026-11-17: closed upper cabinets over the north run (the sheet draws nothing there)",
          "note": "wall-mounted, underside 150 cm, top 222 cm, 35 cm deep"}
    fx[:] = [f for f in fx if f["id"] != "k-uppers"] + [up]
    cues = plan.setdefault("furnish_cues", {})
    cues["kitchen_uppers"] = "fixture"
    cues["source"] = "the upper cabinets are the fixture k-uppers (hand/fix_fixtures_1117d.py)"
    s = json.dumps(plan, ensure_ascii=False, indent=1) + "\n"
    io.open(p, "w", encoding="utf-8", newline="").write(s.replace("\n", "\r\n") if "\r\n" in raw else s)
    print(p, "k-uppers", up["polygon_cm"], "| cue", cues["kitchen_uppers"])

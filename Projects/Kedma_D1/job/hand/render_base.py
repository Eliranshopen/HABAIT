"""kedma-d1: the plan the CG is FURNISHED AND RENDERED from (2026-11-17).

Why: the apartment's plan.general.json carries room loops that were snapped onto the wall faces on 2026-11-16 (hand/snap_loops.py,
split_open_edges.py, add_cistern.py) so that the fidelity gate's "CG against the plan" check reads the true wall faces. Those loops
were never rendered. Rendered on 2026-11-17 they give pure black walls (the living room's south wall, the corridor's south wall, the
pantry): a loop that lies on or inside a wall's solid shows the solid's dark section instead of the room's plaster. The loops the first
renders were made from stand a centimetre or two inside the room and render correctly.

What: the render base = the apartment's plan (today's fixtures, camera points and cues) with the ROOMS of the first render base
(kept in jobs/kedma-d1/before-island/render-rooms.json: the loops and edge kinds of 2026-11-16's tours/kedma-d1/plan.base.json).
The gate keeps reading the apartment's own plan.

Then the furnish tool is run on this base directly (the runner's `furnish` step would write the apartment's plan over it):
  python render_base.py <apartment plan.general.json> <rooms.json> <out plan.base.json>
  <engine python> -I 360walkaround/pipeline/furnish_from_plan.py --plan <out> --out <tour>/_furnish ; copy plan.furnished.json to <tour>/plan.json
"""
import json
import sys

apt_p, rooms_p, out_p = sys.argv[1:4]
plan = json.load(open(apt_p, encoding="utf-8"))
old = {r["id"]: r for r in json.load(open(rooms_p, encoding="utf-8"))}
n = 0
for r in plan["rooms"]:
    o = old[r["id"]]
    if r["loop"] != o["loop"] or r.get("edge_kinds") != o.get("edge_kinds"):
        r["loop"], r["edge_kinds"] = o["loop"], o["edge_kinds"]
        for k in ("bbox_cm", "area_m2", "clear_dims_cm"):
            if k in o:
                r[k] = o[k]
        n += 1
json.dump(plan, open(out_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"render base {out_p}: {n} rooms take the first render base's loop; fixtures {len(plan.get('fixtures', []))}, cameras {len(plan.get('camera_points', []))}")

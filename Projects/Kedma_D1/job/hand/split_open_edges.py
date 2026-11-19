"""kedma-d1 hand trace, step 6 ($0): a room-loop edge is a wall only where a wall stands.

trace-plan.mjs gives every loop edge ONE kind. Where a zone bar continues a wall face in the same line (the kitchen's south side:
the partition, then the open boundary to the living room, 4 cm apart), the simplifier makes one edge of both and calls it 'wall'.
The fidelity gate then looks for a wall across the opening and finds none (run 2026-11-16: living 31.11 %, 240 of 258 judged
columns on loop:r-kitchen#6, every real wall within 5 cm).

This applies the gate's own rule (a loop edge is a wall when a wall polygon is within 14 cm) along the edge instead of only at
its midpoint: a stretch of >= 30 cm with no wall and no pane within 14 cm becomes its own 'open' edge.
usage: python split_open_edges.py <plan.json> [--dry]     (patches the plan in place; idempotent)
"""
import json
import sys
from pathlib import Path

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

NEAR_CM, MIN_OPEN_CM, STEP_CM = 14.0, 30.0, 2.0


def split_plan(plan):
    solid = unary_union([Polygon(w["polygon_cm"]).buffer(0) for w in plan["walls"]] + [Polygon(p["polygon_cm"]).buffer(0) for p in plan.get("panes", [])])
    changes = []
    for r in plan["rooms"]:
        L, K = r["loop"], r.get("edge_kinds") or []
        if len(K) != len(L):
            continue
        nl, nk = [], []
        for i, a in enumerate(L):
            b = L[(i + 1) % len(L)]
            length = ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
            if K[i] != "wall" or length < MIN_OPEN_CM + 10:
                nl.append(a); nk.append(K[i]); continue
            n = max(2, int(length / STEP_CM))
            near = [solid.distance(Point(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)) <= NEAR_CM for k in range(n + 1)]
            runs, s = [], None                      # runs of "no wall near", as [k0, k1]
            for k, v in enumerate(near):
                if not v and s is None:
                    s = k
                if v and s is not None:
                    runs.append((s, k - 1)); s = None
            if s is not None:
                runs.append((s, n))
            runs = [(k0, k1) for k0, k1 in runs if (k1 - k0) * length / n >= MIN_OPEN_CM]
            if not runs:
                nl.append(a); nk.append("wall"); continue
            pt = lambda k: [round(a[0] + (b[0] - a[0]) * k / n, 2), round(a[1] + (b[1] - a[1]) * k / n, 2)]
            cur = 0
            for k0, k1 in runs:
                if k0 > cur:
                    nl.append(pt(cur) if cur else a); nk.append("wall")
                nl.append(pt(k0) if k0 else a); nk.append("open")
                cur = k1 + 1 if k1 < n else n
                changes.append(f"{r['id']} edge {i}: {round((k1 - k0) * length / n)} cm of {round(length)} cm had no wall within {NEAR_CM:.0f} cm -> open")
            if cur < n:
                nl.append(pt(cur)); nk.append("wall")
        r["loop"], r["edge_kinds"] = nl, nk
    return changes


if __name__ == "__main__":
    p = Path(sys.argv[1])
    plan = json.loads(p.read_text(encoding="utf-8"))
    ch = split_plan(plan)
    for c in ch:
        print(" -", c)
    if "--dry" not in sys.argv and ch:
        plan["plan_meta"].setdefault("hand_edits", []).extend("split_open_edges: " + c for c in ch)
        p.write_text(json.dumps(plan, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(ch)} edge(s) split" + (" (dry)" if "--dry" in sys.argv else ""))

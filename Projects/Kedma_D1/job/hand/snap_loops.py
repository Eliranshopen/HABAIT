"""kedma-d1 hand trace, step 7 ($0): room-loop wall edges onto the wall faces.

trace-plan.mjs floods a room, opens the region by 5 px and simplifies it to 3 cm: a loop's wall edge sits 1-5 cm inside the wall
face, sometimes a few cm askew. Apartment 846's hand trace was accurate enough and auto-trace snaps loops in auto_finalize.py; a
hand trace through trace-plan alone does neither. The fidelity gate judges the CG render (built from the wall polygons, the true
faces) against the loop edges: main bedroom 1.06 % (edge #5 up to 5.6 cm off), corridor 1.09 % (2026-11-16).

Rule: a 'wall' loop edge that is horizontal or vertical (within 4 cm over its length) is moved along its normal onto the wall
face it runs beside (the median offset of points sampled along it, each at most MAX_CM from a wall face on that normal) and made
straight. Open edges, slanted edges and edges with no face beside them are left as traced. Areas and boxes are recomputed.
usage: python snap_loops.py <plan.json> [--dry]      (patches the plan in place; idempotent)
"""
import json
import statistics
import sys
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

MAX_CM, SKEW_CM, MIN_LEN_CM = 9.0, 4.0, 8.0


def snap_plan(plan):
    solid = unary_union([Polygon(w["polygon_cm"]).buffer(0) for w in plan["walls"]])
    changes = []
    for r in plan["rooms"]:
        L, K = r["loop"], r.get("edge_kinds") or []
        if len(K) != len(L):
            continue
        n = len(L)
        newx, newy = {}, {}
        for i in range(n):
            a, b = L[i], L[(i + 1) % n]
            dx, dy = b[0] - a[0], b[1] - a[1]
            length = (dx * dx + dy * dy) ** 0.5
            if K[i] != "wall" or length < MIN_LEN_CM:
                continue
            horiz, vert = abs(dy) <= SKEW_CM, abs(dx) <= SKEW_CM
            if horiz == vert:
                continue
            offs = []
            for k in range(1, 10):
                p = (a[0] + dx * k / 10, a[1] + dy * k / 10)
                # the wall face on this edge's normal: the nearest crossing of a short normal segment with the wall outline
                seg = LineString([(p[0], p[1] - MAX_CM), (p[0], p[1] + MAX_CM)]) if horiz else LineString([(p[0] - MAX_CM, p[1]), (p[0] + MAX_CM, p[1])])
                hit = seg.intersection(solid.boundary)
                pts = [g for g in getattr(hit, "geoms", [hit]) if g.geom_type == "Point"]
                if not pts:
                    continue
                q = min(pts, key=lambda g: Point(p).distance(g))
                offs.append((q.y - p[1]) if horiz else (q.x - p[0]))
            if len(offs) < 5:
                continue
            off = statistics.median(offs)
            base = (a[1] + b[1]) / 2 if horiz else (a[0] + b[0]) / 2
            target = round(base + off, 2)
            worst = max(abs(target - (a[1] if horiz else a[0])), abs(target - (b[1] if horiz else b[0])))
            if worst < 0.3:
                continue
            for j in (i, (i + 1) % n):
                (newy if horiz else newx)[j] = target
            changes.append(f"{r['id']} edge {i} ({'h' if horiz else 'v'}, {round(length)} cm): moved {worst:.1f} cm onto the wall face")
        if not (newx or newy):
            continue
        r["loop"] = [[newx.get(j, L[j][0]), newy.get(j, L[j][1])] for j in range(n)]
        poly = Polygon(r["loop"])
        xs, ys = [p[0] for p in r["loop"]], [p[1] for p in r["loop"]]
        r["bbox_cm"] = [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)]
        if "clear_dims_cm" in r:
            r["clear_dims_cm"] = [round(max(xs) - min(xs), 1), round(max(ys) - min(ys), 1)]
        if poly.is_valid:
            r["area_m2"] = round(poly.area / 10000, 3)
    return changes


if __name__ == "__main__":
    p = Path(sys.argv[1])
    plan = json.loads(p.read_text(encoding="utf-8"))
    ch = snap_plan(plan)
    for c in ch:
        print(" -", c)
    if "--dry" not in sys.argv and ch:
        plan["plan_meta"].setdefault("hand_edits", []).append(f"snap_loops: {len(ch)} wall edges moved onto their wall faces (at most {MAX_CM:.0f} cm)")
        p.write_text(json.dumps(plan, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(ch)} edge(s) snapped" + (" (dry)" if "--dry" in sys.argv else ""))

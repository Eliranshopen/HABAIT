"""Habait Tour360 - tools/casework_symbols.py (2026-11-06, parity row 18: the hob and the sink come from the drawing's symbols).

Where the kitchen's hob and sink sit is DRAWN on a CAD sales plan: the plumbing/casework layer (auto-trace round 16, fork B's
pdf-vectors.json `plumbing_polys_px`) holds a square with four burner circles (the hob) and the sink's drain and tap holes. The furnisher
used to guess them ("sink: the centre of the longest run; hob: the centre of the second run") and put the hob on the wrong leg of the
L, about 1.3 m from the drawn one. This tool reads the symbols and writes them into the plan as `casework_symbols`, in the plan's
OWN frame; the furnisher's fixture_hints read them (furnish_from_plan.py). The old guess stays only as a labelled fallback for a
drawing without symbols.

  Symbols, from the closed polylines that lie on a drawn counter (within 8 cm of its band):
    circle  = a closed polyline with isoperimetric ratio >= 0.95 and >= 16 vertices
    hob     = a square-ish closed shape 45..95 cm (aspect <= 1.6) holding >= 3 circles of 10..32 cm: the centre of those circles
    sink    = the drain and tap holes: circles of <= 8 cm, outside any hob, clustered within 35 cm; the cluster's centre
  Frame: the vectors are in the TRACE's frame (px / scale_px_per_cm). The plan being furnished may be in another frame (a plan
  re-drawn by hand over the same drawing). The kitchen casework outline (the union of the trace's drawn counters and tall units)
  is registered onto the plan's own kitchen casework outline with a 2-D similarity (ICP on the outline, both directions); the
  mean outline distance after the fit is recorded and must be <= --max-fit-cm (default 8; a hand-redrawn 846 fits at 5.6 cm, its hob lands 4 cm from the hand-checked one) or no symbol is written (the
  furnisher then uses the labelled fallback and says so). For an auto-traced plan the two frames are the same and the fit is ~0.

  usage: python -I casework_symbols.py --plan <plan.general.json> --vectors <pdf-vectors.json> --trace-plan <trace plan.general.json>
                                      [--board <material-board.json>] [--max-fit-cm 8] [--go]
  Dry by default (prints what it found); --go writes plan.casework_symbols (and plan.furnish_cues from the board) in place.
  $0: no network, no model.
"""
import argparse
import json
import math
import re
import sys

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

CIRCLE_RATIO, CIRCLE_MIN_VERTS = 0.95, 16
HOB_SIDE = (45.0, 95.0)
BURNER_D = (10.0, 32.0)
HOLE_D_MAX = 8.0
CLUSTER_CM = 35.0
ON_COUNTER_CM = 8.0


def poly_cm(poly_px, ppc):
    return [(x / ppc, y / ppc) for x, y in poly_px]


def sides(P):
    mrr = P.minimum_rotated_rectangle
    xs, ys = mrr.exterior.coords.xy
    return sorted([math.hypot(xs[1] - xs[0], ys[1] - ys[0]), math.hypot(xs[2] - xs[1], ys[2] - ys[1])], reverse=True)


def kitchen_casework(plan):
    """the plan's kitchen casework (counters + tall units), by room type or a room id holding 'kitchen'"""
    kitchens = {r["id"] for r in plan.get("rooms", []) if r.get("type") == "kitchen" or "kitchen" in str(r.get("id", ""))}
    fx = [f for f in plan.get("fixtures", []) if f.get("kind") in ("counter", "tall_unit") and f.get("polygon_cm")]
    inside = [f for f in fx if f.get("room_id") in kitchens]
    return inside or [f for f in fx if f.get("kind") == "counter"]


def outline_points(fixtures, step=4.0):
    U = unary_union([Polygon(f["polygon_cm"]).buffer(0) for f in fixtures]).buffer(0)
    geoms = getattr(U, "geoms", [U])
    pts = []
    for g in geoms:
        ring = g.exterior
        n = max(8, int(ring.length / step))
        pts += [ring.interpolate(i * ring.length / n).coords[0] for i in range(n)]
    return np.array(pts), U


def fit_similarity(A, B):
    """least-squares s, R, t with B ~ s R A + t"""
    ma, mb = A.mean(0), B.mean(0)
    a, b = A - ma, B - mb
    U, S, Vt = np.linalg.svd(a.T @ b)
    d = np.sign(np.linalg.det(U @ Vt))
    D = np.diag([1.0, d])
    R = (U @ D @ Vt).T
    s = (S * np.diag(D)).sum() / (a ** 2).sum()
    return s, R, mb - s * R @ ma


def register(src_pts, dst_pts, iters=60):
    """ICP (symmetric nearest pairs) from an initial centroid + principal-axis alignment; 4 axis flips tried, the best kept"""
    def pca(P):
        c = P.mean(0)
        w, v = np.linalg.eigh(np.cov((P - c).T))
        return c, v[:, np.argmax(w)]
    cs, ds = pca(src_pts)
    cd, dd = pca(dst_pts)
    best = None
    for flip in (1.0, -1.0):
        ang = math.atan2(dd[1], dd[0]) - math.atan2(flip * ds[1], flip * ds[0])
        R = np.array([[math.cos(ang), -math.sin(ang)], [math.sin(ang), math.cos(ang)]])
        s, t = 1.0, cd - R @ cs
        for _ in range(iters):
            M = (s * (R @ src_pts.T)).T + t
            d1 = ((M[:, None, :] - dst_pts[None, :, :]) ** 2).sum(-1)
            j = d1.argmin(1)
            i2 = d1.argmin(0)
            A = np.vstack([src_pts, src_pts[i2]])
            B = np.vstack([dst_pts[j], dst_pts])
            s, R, t = fit_similarity(A, B)
        M = (s * (R @ src_pts.T)).T + t
        d1 = np.sqrt(((M[:, None, :] - dst_pts[None, :, :]) ** 2).sum(-1))
        err = 0.5 * (d1.min(1).mean() + d1.min(0).mean())
        if best is None or err < best[0]:
            best = (err, s, R, t)
    err, s, R, t = best
    return float(err), lambda p: (s * (R @ np.asarray(p, float))) + t, float(s), float(math.degrees(math.atan2(R[1, 0], R[0, 0])))


def find_symbols(polys_px, ppc, counters):
    bands = [Polygon(f["polygon_cm"]).buffer(ON_COUNTER_CM) for f in counters if f.get("kind") == "counter"]
    on = lambda c: any(b.contains(c) for b in bands)
    circles, shapes = [], []
    for poly in polys_px:
        if len(poly) < 4:
            continue
        try:
            P = Polygon(poly_cm(poly, ppc)).buffer(0)
        except Exception:
            continue
        if P.is_empty or P.length == 0:
            continue
        c = P.centroid
        if not on(c):
            continue
        ratio = 4 * math.pi * P.area / (P.length ** 2)
        if ratio >= CIRCLE_RATIO and len(poly) >= CIRCLE_MIN_VERTS:
            circles.append({"c": (c.x, c.y), "d": 2 * math.sqrt(P.area / math.pi)})
        else:
            shapes.append(P)
    hobs = []
    for P in shapes:
        a, b = sides(P)
        if not (HOB_SIDE[0] <= b and a <= HOB_SIDE[1] and a / max(b, 1e-6) <= 1.6):
            continue
        burners = [k for k in circles if BURNER_D[0] <= k["d"] <= BURNER_D[1] and P.buffer(2).contains(Point(k["c"]))]
        if len(burners) >= 3:
            cx = sum(k["c"][0] for k in burners) / len(burners)
            cy = sum(k["c"][1] for k in burners) / len(burners)
            hobs.append({"kind": "hob", "centre": (cx, cy), "size_cm": [round(a, 1), round(b, 1)], "burners": len(burners), "shape": P})
    in_hob = lambda c: any(h["shape"].buffer(2).contains(Point(c)) for h in hobs)
    holes = [k for k in circles if k["d"] <= HOLE_D_MAX and not in_hob(k["c"])]
    sinks, used = [], set()
    for i, k in enumerate(holes):
        if i in used:
            continue
        group = [j for j, m in enumerate(holes) if j not in used and math.dist(k["c"], m["c"]) <= CLUSTER_CM]
        if len(group) < 2:
            continue
        used.update(group)
        big = max(group, key=lambda j: holes[j]["d"])          # the drain is the biggest hole: the bowl's centre
        sinks.append({"kind": "sink", "centre": holes[big]["c"], "holes": len(group)})
    return hobs, sinks


def board_cues(board_path):
    """the house material board's kitchen words -> furnish cues (the open-shelf function wall is a board decision, not a guess)"""
    try:
        b = json.load(open(board_path, encoding="utf-8"))
    except Exception:
        return None
    text = " ".join(str(d.get(k, "")) for d in (b, b.get("surfaces") or {}, b.get("fixture_words") or {}) for k in ("kitchen", "counter")).lower()
    if re.search(r"open shel", text):
        return {"kitchen_uppers": "shelves", "source": "material board: " + re.search(r"[^,.;]*open shel[^,.;]*", text).group(0).strip()[:160]}
    if re.search(r"upper (wall )?cabinet|wall units", text):
        return {"kitchen_uppers": "cabinets", "source": "material board: upper cabinets"}
    return None


# a tall kitchen unit is WHAT THE DRAWING SAYS it is (the coordinator, 2026-11-06: Eliran saw apt846-auto's tall column painted as an
# oven tower with no fridge anywhere; the furnisher had built it as the fridge). Order: the drawing's own words for it (a legend or a
# label read from the sheet: fixture "label"/"legend"), then its size: a column that fits the fridge range IS the fridge (the default),
# anything else is tall storage. The prompt then names it (make-skin-prompts: fixture_words.tall_unit_<type>) and the furnisher builds it.
TALL_WORDS = [("fridge", r"מקרר|fridge|refrigerator|\bref\b"), ("oven", r"תנור|oven"), ("pantry", r"מזווה|pantry|storage")]
FRIDGE_W, FRIDGE_D = (55.0, 95.0), (55.0, 90.0)   # along the run, depth (a tall housing stands up to 15 cm proud of a 75 cm fridge)


def tall_types(plan):
    rows = {}
    # the fridge default is a KITCHEN rule: a tall unit drawn in another room (846's laundry niche in the living room) is tall storage
    # unless the drawing's own words say otherwise (2026-11-06, the runner's trace-only check on the 846 PDF)
    kitchens = {r["id"] for r in plan.get("rooms", []) if r.get("type") == "kitchen" or "kitchen" in str(r.get("id", ""))}
    runs = [Polygon(c["polygon_cm"]).buffer(0) for c in plan.get("fixtures", []) if c.get("kind") == "counter" and c.get("polygon_cm")]
    # part of a kitchen = in a kitchen room OR standing at a counter run (an open-plan trace can file the column under the dining zone)
    in_kitchen = lambda f: f.get("room_id") in kitchens or bool(f.get("polygon_cm") and any(Polygon(f["polygon_cm"]).buffer(0).distance(r) <= 20 for r in runs))
    for f in plan.get("fixtures", []):
        if f.get("kind") != "tall_unit":
            continue
        said = " ".join(str(f.get(k, "")) for k in ("label", "legend")).lower()
        hit = next((t for t, rx in TALL_WORDS if said and re.search(rx, said)), None)
        if hit:
            rows[f["id"]] = {"type": hit, "source": f"the drawing's words: {said.strip()[:80]}"}
            continue
        w, d = (list(f.get("size_cm") or []) + [0, 0])[:2]
        if not in_kitchen(f):
            rows[f["id"]] = {"type": "pantry", "source": f"no words on the drawing; not in a kitchen and not at a counter run ({f.get('room_id')}): tall storage"}
        elif FRIDGE_W[0] <= w <= FRIDGE_W[1] and FRIDGE_D[0] <= d <= FRIDGE_D[1]:
            rows[f["id"]] = {"type": "fridge", "source": f"no words on the drawing; {w:.0f} x {d:.0f} cm fits the fridge range ({FRIDGE_W[0]:.0f}-{FRIDGE_W[1]:.0f} x {FRIDGE_D[0]:.0f}-{FRIDGE_D[1]:.0f}): the fridge (default)"}
        else:
            rows[f["id"]] = {"type": "pantry", "source": f"no words on the drawing; {w:.0f} x {d:.0f} cm is outside the fridge range: tall storage"}
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--vectors")
    ap.add_argument("--trace-plan")
    ap.add_argument("--board")
    ap.add_argument("--max-fit-cm", type=float, default=8.0)
    ap.add_argument("--go", action="store_true")
    a = ap.parse_args()
    plan = json.load(open(a.plan, encoding="utf-8"))
    tall = tall_types(plan)
    if not (a.vectors and a.trace_plan):
        out = {"version": 1, "tool": "casework_symbols.py", "vectors": None, "symbols": [],
               "note": "no CAD vectors for this drawing: the furnisher places the hob and the sink by its labelled fallback"}
        tplan, pv, ppc = None, {}, 0
    else:
        tplan = json.load(open(a.trace_plan, encoding="utf-8"))
        pv = json.load(open(a.vectors, encoding="utf-8"))
        ppc = float((tplan.get("plan_meta") or {}).get("scale_px_per_cm") or 0)
        if ppc <= 0:
            print("casework_symbols: the trace plan has no plan_meta.scale_px_per_cm", file=sys.stderr)
            sys.exit(2)
        out = {"version": 1, "tool": "casework_symbols.py", "vectors": a.vectors.replace("\\", "/").split("/")[-1], "symbols": []}
    src_fx, dst_fx = (kitchen_casework(tplan), kitchen_casework(plan)) if tplan else ([], [])
    if not tplan:
        pass
    elif not src_fx or not dst_fx:
        out["note"] = "no kitchen casework in the trace or in the plan: no symbols (the furnisher uses its labelled fallback)"
    else:
        hobs, sinks = find_symbols(pv.get("plumbing_polys_px", []), ppc, src_fx)
        sp, _ = outline_points(src_fx)
        dp, _ = outline_points(dst_fx)
        err, T, s, rot = register(sp, dp)
        out["registration"] = {"mean_outline_cm": round(err, 2), "scale": round(s, 4), "rotation_deg": round(rot, 2), "max_cm": a.max_fit_cm}
        if err > a.max_fit_cm or abs(s - 1.0) > 0.05:
            # both frames are centimetres: a fit that needs more than 5 % of scale has matched the wrong outline (2026-11-06: a
            # re-drawn trace's casework fitted at scale 1.13 and moved the sink 55 cm) — refused, the labelled fallback is used
            out["note"] = f"the trace's kitchen casework does not register onto the plan's ({err:.1f} cm, scale {s:.3f}; limits {a.max_fit_cm} cm, 1 +/- 0.05): no symbols written"
        else:
            # parity row 35 (the coordinator, 2026-11-07): the sheet's printed dimension lines (tick to tick, dim_chains + dims_gate.pdf_lines,
            # the trace check's own source) go into the plan in the SAME frame as the symbols, so the gate runs its per-dimension print check
            # (printed_dimensions.py) on every portal job — the check that sees a 10 cm wall error the CG-only metric cannot in a big room
            try:
                sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
                import dim_chains, dims_gate
                ch = dim_chains.chains(pv.get("dimension_segments_px", []), ppc)
                lines = dims_gate.pdf_lines(ch, lambda x, y: tuple(float(v) for v in T((x / ppc, y / ppc))))
                out["printed_dimensions"] = [{"id": l["id"].replace("pdf#", "pdf-"), "printed_cm": round(float(l["printed_cm"]), 1), "a_cm": [round(v, 1) for v in l["a_cm"]], "b_cm": [round(v, 1) for v in l["b_cm"]]} for l in lines]
            except Exception as e:
                out["printed_dimensions_note"] = f"printed dimensions not read: {e}"
            counters = [f for f in plan["fixtures"] if f.get("kind") == "counter"]
            for sym in hobs + sinks:
                c = T(sym["centre"])
                host = min(counters, key=lambda f: Polygon(f["polygon_cm"]).distance(Point(c[0], c[1]))) if counters else None
                row = {"kind": sym["kind"], "centre_cm": [round(float(c[0]), 1), round(float(c[1]), 1)], "on_fixture": host["id"] if host else None,
                       "room_id": host.get("room_id") if host else None, "trace_centre_cm": [round(sym["centre"][0], 1), round(sym["centre"][1], 1)],
                       "evidence": f"{sym.get('burners', 0)} burner circles in a {sym['size_cm'][0]}x{sym['size_cm'][1]} cm square" if sym["kind"] == "hob" else f"{sym['holes']} drain/tap holes"}
                out["symbols"].append(row)
    cues = board_cues(a.board) if a.board else None
    for r in out["symbols"]:
        print(f"  {r['kind']:5s} at {r['centre_cm']} on {r['on_fixture']} ({r['evidence']}; trace {r['trace_centre_cm']})")
    print(f"  printed dimension lines: {len(out.get('printed_dimensions') or [])} {out.get('printed_dimensions_note', '')}")
    print(f"casework_symbols: {len(out['symbols'])} symbol(s); registration {json.dumps(out.get('registration'))}; {out.get('note', '')}")
    if cues:
        print(f"  furnish cue: {json.dumps(cues, ensure_ascii=False)}")
    for fid, t in tall.items():
        print(f"  tall unit {fid}: {t['type']} ({t['source']})")
    if a.go:
        for f in plan.get("fixtures", []):
            if f["id"] in tall:
                f["tall_type"], f["tall_type_source"] = tall[f["id"]]["type"], tall[f["id"]]["source"]
        if out.get("printed_dimensions") and not (plan.get("plan_meta") or {}).get("printed_dimensions"):
            plan.setdefault("plan_meta", {})["printed_dimensions"] = out["printed_dimensions"]   # a hand plan's own list wins
        plan["casework_symbols"] = {k: v for k, v in out.items() if k != "printed_dimensions"}
        if cues:
            plan["furnish_cues"] = cues
        json.dump(plan, open(a.plan, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
        print(f"written: {a.plan}")
    else:
        print("dry run: nothing written (--go to write)")


if __name__ == "__main__":
    main()

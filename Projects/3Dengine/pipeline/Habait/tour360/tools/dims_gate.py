#!/usr/bin/env python
"""dims_gate.py <auto plan-dir> <hand plan.general.json> [--hand-only] [--bar 1.0]

The 846 acceptance gate, option 2 (coordinator's ruling 2026-11-05, Eliran: the print is the authority):
- CLOSED ROOMS against the PRINTED dimensions: every dimension line of the PDF (dim_chains, tick to tick = the printed value)
  is tied to the hand room its line crosses; the room is measured ACROSS that line, between the line's own extension lines
  (the section of the room polygon along the dimension line, at its position). Pass: |section − printed| <= bar % (or 2 cm).
- the hand trace for which rooms exist (an auto room per hand room), openings (count + position within 15 cm), and the
  OPEN-PLAN zones (entrance/kitchen/dining/living) gated as ONE region: union area and outline (symmetric difference) <= bar %;
  zone splits reported, not gated. Fixed elements (kitchen run, hob, sink, columns): position within 10 cm.
Frames: the hand crop's position on the sheet comes from <auto plan-dir>/vs-hand.json (trace_vs_hand.py's registration).
Writes <auto plan-dir>/dims-gate.json (or dims-gate-hand.json with --hand-only).
"""
import json
import math
import os
import sys

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dim_chains  # noqa: E402
import printed_dimensions as PD  # noqa: E402

OPEN = {"r-entrance", "r-kitchen", "r-dining", "r-living"}


def poly(loop):
    p = Polygon(loop)
    p = p if p.is_valid else p.buffer(0)
    if p.geom_type != "Polygon":
        p = max(p.geoms, key=lambda g: g.area)
    return p


def map_plan(plan, f):
    """a copy of the plan with every cm field mapped by f (rooms, walls, panes, fixtures, openings): the frame the lines are in"""
    import copy
    q = copy.deepcopy(plan)
    P = lambda pts: [list(f(*p_)) for p_ in pts]
    for r in q.get("rooms", []):
        if r.get("loop"):
            r["loop"] = P(r["loop"])
    for key in ("walls", "panes", "fixtures"):
        for w in q.get(key, []):
            if w.get("polygon_cm"):
                w["polygon_cm"] = P(w["polygon_cm"])
            if w.get("centre_cm"):
                w["centre_cm"] = list(f(*w["centre_cm"]))
    for o in q.get("openings", []):
        for k_ in ("a_cm", "b_cm", "centre_cm"):
            if o.get(k_):
                o[k_] = list(f(*o[k_]))
    return q


def pdf_lines(chains, to_frame):
    """the PDF's printed dimension lines as printed_dimensions.py lines (an overall line of a chained dimension is replaced by
    its parts), ticks mapped into the plan frame"""
    return [{"id": "pdf#%d" % i, "printed_cm": c["len_cm"], "a_cm": list(to_frame(*c["a"])), "b_cm": list(to_frame(*c["b"]))}
            for i, c in enumerate(chains) if not (c.get("n_ticks", 2) >= 3 and not c.get("part"))]


def main():
    d, hand_p = sys.argv[1], sys.argv[2]
    hand_only = "--hand-only" in sys.argv
    bar = float(sys.argv[sys.argv.index("--bar") + 1]) if "--bar" in sys.argv else 1.0
    hand = json.load(open(hand_p, encoding="utf-8"))
    reg = json.load(open(os.path.join(d, "vs-hand.json"), encoding="utf-8"))["registration"]
    hx0, hy0 = reg["hand_crop_at_sheet_px"]
    rj = json.load(open(os.path.join(d, "raster.json"), encoding="utf-8"))
    cx0, cy0 = rj["crop"]["crop_box_px"][:2]
    pv = json.load(open(os.path.join(d, "pdf-vectors.json"), encoding="utf-8"))
    ppc_true = 2.2677 if "ppc_true" not in reg else reg["ppc_true"]
    ppc_h = float(hand["plan_meta"].get("scale_px_per_cm") or 2.25)
    chains = dim_chains.chains(pv["dimension_segments_px"], ppc_true)
    # everything in TRUE cm in the hand crop frame: (crop px + crop offset − hand offset) / 2.2677
    c2h = lambda x, y: ((x + cx0 - hx0) / ppc_true, (y + cy0 - hy0) / ppc_true)
    hk = ppc_h / ppc_true                       # hand cm -> true cm
    H = {r["id"]: poly([(x * hk, y * hk) for x, y in r["loop"]]) for r in hand["rooms"] if len(r.get("loop", [])) >= 3}
    TERR = [h for h in H if h.startswith("r-terrace")]
    if len(TERR) > 1:
        tu = unary_union([H[h] for h in TERR]).buffer(1).buffer(-1)
        tu = tu if tu.geom_type == "Polygon" else max(tu.geoms, key=lambda g: g.area)
        for h in TERR:
            del H[h]
        H["r-terrace"] = tu
    A = {}
    if not hand_only:
        auto = json.load(open(os.path.join(d, "plan.general.json"), encoding="utf-8"))
        ppc_a = float(auto["plan_meta"].get("scale_px_per_cm"))
        a2h = lambda x, y: c2h(x * ppc_a, y * ppc_a)
        A = {r["id"]: poly([a2h(*p) for p in r["loop"]]) for r in auto["rooms"] if len(r.get("loop", [])) >= 3}
        auto_terr = [r["id"] for r in auto["rooms"] if r.get("is_outdoor") and r["id"] in A]
        if auto_terr:
            tu = unary_union([A[a] for a in auto_terr]).buffer(1).buffer(-1)
            tu = tu if tu.geom_type == "Polygon" else max(tu.geoms, key=lambda g: g.area)
            for a in auto_terr:
                del A[a]
            A["auto-terrace"] = tu
        cand = sorted(((H[h].intersection(A[a]).area / max(1e-9, H[h].union(A[a]).area), h, a) for h in H for a in A if H[h].intersects(A[a])), reverse=True)
        used_h, used_a, amap = set(), set(), {}
        for iou, h, a in cand:
            if h in used_h or a in used_a or iou < 0.15:
                continue
            amap[h] = a; used_h.add(h); used_a.add(a)
    # (round 17) THE one measurement: printed_dimensions.measure (fork A, b066848) on the hand and on the auto plan, the same
    # PDF lines in the same frame. The hand says what each line measures (kind room / fixture); the auto must pass that line.
    lines = pdf_lines(chains, c2h)
    hand_rows = PD.measure(map_plan(hand, lambda x, y: (x * hk, y * hk)), lines, bar)["rows"]
    auto_rows = PD.measure(map_plan(auto, a2h), lines, bar)["rows"] if not hand_only else []
    clean = lambda r: {k: v for k, v in r.items() if not k.startswith("_")}
    rows = []
    for hr in hand_rows:
        if hr.get("kind") not in ("room", "fixture") or hr.get("verdict") in ("UNTIED", "REPORTED", "NO-FIXTURE"):
            continue
        row = {"line": hr["id"], "kind": hr["kind"], "room": hr.get("room"), "fixture": hr.get("fixture"), "printed_cm": hr["printed_cm"],
               "hand_cm": hr.get("trace_cm"), "hand_pct": hr.get("pct"), "hand_pass": hr.get("verdict") == "PASS",
               "open_plan": hr.get("room") in OPEN}
        if not hand_only:
            base_ = lambda i_: str(i_).split("/")[0]          # a fixture row is "<line>/<fixture id>": match the LINE, the fixtures differ by name
            same = [r for r in auto_rows if base_(r["id"]) == base_(hr["id"]) and r.get("kind") == hr["kind"] and r.get("verdict") not in ("UNTIED",)]
            if hr["kind"] == "fixture":
                same = sorted(same, key=lambda r: r.get("pct", 1e9))
            ar = same[0] if same else next((r for r in auto_rows if base_(r["id"]) == base_(hr["id"])), None)
            row.update(auto_room=(ar or {}).get("room"), auto_fixture=(ar or {}).get("fixture"), auto_kind=(ar or {}).get("kind"),
                       auto_cm=(ar or {}).get("trace_cm"), auto_pct=(ar or {}).get("pct"), auto_verdict=(ar or {}).get("verdict"),
                       auto_pass=bool(ar) and ar.get("verdict") == "PASS" and ar.get("kind") == hr["kind"])
        rows.append(row)
    out = {"bar_pct": bar, "ppc_true": ppc_true, "measurement": "printed_dimensions.measure (one rule, fork A b066848)",
           "dimension_lines": len(lines), "gated_rows": len(rows), "rows": rows,
           "hand_untied_or_outline": [clean(r) for r in hand_rows if r.get("verdict") in ("UNTIED", "REPORTED")]}
    closed = sorted({r["room"] for r in rows if r["kind"] == "room" and not r["open_plan"]})
    out["closed_rooms"] = closed
    out["closed_rooms_hand_pass"] = sum(all(r["hand_pass"] for r in rows if r["room"] == c and r["kind"] == "room") for c in closed)
    out["rows_hand_pass"] = sum(r["hand_pass"] for r in rows)
    if A:
        out["closed_rooms_auto_pass"] = sum(all(r.get("auto_pass") for r in rows if r["room"] == c and r["kind"] == "room") for c in closed)
        out["rows_auto_pass"] = sum(bool(r.get("auto_pass")) for r in rows)
        # existence
        out["rooms_exist"] = {"hand": len(H), "with_auto_counterpart": len(amap), "missing": sorted(set(H) - set(amap))}
        # open plan as one region
        hu = unary_union([H[h] for h in H if h in OPEN]).buffer(10).buffer(-10); au = unary_union([A[amap[h]] for h in H if h in OPEN and h in amap] +
                                                                         [A[a] for a in A if a not in amap.values() and A[a].intersects(hu) and A[a].intersection(hu).area > 0.5 * A[a].area])
        # (round 18) ONE floor definition for both sides (like with like): the floor is the room loop minus the drawn built-in
        # appliance squares — closed 4-sided shapes 45-75 cm a side on the plumbing / casework layer inside the open plan (846:
        # the hob unit, the sink unit), which the hand trace cuts out of its kitchen loop
        appl = []
        for q in pv.get("plumbing_polys_px", []):
            if len(q) < 4 or len(q) > 6 or abs(q[0][0] - q[-1][0]) + abs(q[0][1] - q[-1][1]) > 1.5 and len(q) != 4:
                continue
            P_ = Polygon([c2h(*v) for v in q]).buffer(0)
            if P_.is_empty or P_.area < 1:
                continue
            mrr = P_.minimum_rotated_rectangle; xs_m, ys_m = mrr.exterior.coords.xy
            s1 = math.hypot(xs_m[1] - xs_m[0], ys_m[1] - ys_m[0]); s2 = math.hypot(xs_m[2] - xs_m[1], ys_m[2] - ys_m[1])
            if 45 <= min(s1, s2) and max(s1, s2) <= 75 and P_.area >= 0.8 * mrr.area and P_.intersects(hu.convex_hull):
                appl.append(P_)
        # (round 22, coordinator's ruling: option 1) + ALL drawn counters and casework: the drawing's casework as auto_finalize
        #    reads it from the plumbing / casework layer (counter runs, tall units, sinks — fx-drawn-*), and the drawn closets
        #    and shower trays; the same shapes are subtracted from both sides
        case = [Polygon([a2h(*q) for q in f["polygon_cm"]]).buffer(0) for f in auto.get("fixtures", [])
                if "drawing" in str(f.get("source")) and f.get("kind") in ("counter", "tall_unit", "sink", "hob", "panel") and len(f.get("polygon_cm", [])) >= 3]
        case = [g for g in case if not g.is_empty and g.intersects(hu.convex_hull)]
        n_panels = sum(1 for f in auto.get("fixtures", []) if f.get("kind") == "panel" and "drawing" in str(f.get("source")))
        cut_all = unary_union(appl + case) if (appl or case) else None
        if cut_all is not None:
            hu = hu.difference(cut_all); au = au.difference(cut_all)
        out["floor_definition"] = ("ONE floor rule on both sides (coordinator's ruling, option 1): the room loop minus ALL drawn counters "
                                   "and casework — the built-in appliance squares (closed 4-sided shapes 45-75 cm a side on the plumbing/"
                                   "casework layer) and the casework auto_finalize reads from that layer (counter runs, tall units, sinks, hobs, and the "
                                   "counter-depth panel beside a tall unit that ends a run): "
                                   f"{len(appl)} square(s) + {len(case)} casework shape(s) (of them {n_panels} panel(s)), {cut_all.area / 1e4 if cut_all is not None else 0:.2f} m² "
                                   "in the open plan, subtracted from BOTH the hand and the auto region")
        out["open_plan"] = {"hand_m2": round(hu.area / 1e4, 2), "auto_m2": round(au.area / 1e4, 2), "area_err_pct": round(100 * (au.area - hu.area) / hu.area, 2),
                            "outline_dev_pct": round(100 * hu.symmetric_difference(au).area / hu.area, 2)}
        out["open_plan"]["pass"] = abs(out["open_plan"]["area_err_pct"]) <= bar and out["open_plan"]["outline_dev_pct"] <= bar
        def _pieces(g):
            gs = [g] if g.geom_type == "Polygon" else [x for x in getattr(g, "geoms", []) if x.geom_type == "Polygon"]
            return [{"m2": round(x.area / 1e4, 3), "at_cm": [round(v) for v in x.centroid.coords[0]]} for x in sorted(gs, key=lambda x: -x.area)[:6] if x.area >= 0.05e4]
        out["open_plan"]["auto_only"] = _pieces(au.difference(hu)); out["open_plan"]["hand_only"] = _pieces(hu.difference(au))
        # openings
        inv = {a: h for h, a in amap.items()}
        hand_o = [o for o in hand.get("openings", []) if o.get("centre_cm")]
        auto_o = [o for o in auto.get("openings", []) if o.get("centre_cm")]
        used = set(); orow = []
        cfg_p = sys.argv[sys.argv.index("--hand-config") + 1] if "--hand-config" in sys.argv else None
        zone_bars = []
        if cfg_p and os.path.exists(cfg_p):
            for b_ in json.load(open(cfg_p, encoding="utf-8")).get("bars", []):
                if not str(b_.get("name", "")).startswith("door"):
                    zone_bars.append(LineString([(b_["a"][0] * hk, b_["a"][1] * hk), (b_["b"][0] * hk, b_["b"][1] * hk)]))
        def zone_of(o):
            rs = sorted(o.get("rooms") or [])
            if len(rs) == 2 and ((rs[0] in OPEN and rs[1] in OPEN) or (rs[0].startswith("r-terrace") and rs[1].startswith("r-terrace"))):
                return True
            c_ = Point(o["centre_cm"][0] * hk, o["centre_cm"][1] * hk)
            return any(b.distance(c_) <= 30 for b in zone_bars)       # on a line the hand drew, not on the sheet
        for o in hand_o:
            hc = (o["centre_cm"][0] * hk, o["centre_cm"][1] * hk)
            pair_h = sorted(o.get("rooms") or [])
            best = None
            for j, a_ in enumerate(auto_o):
                if j in used:
                    continue
                ac = a2h(*a_["centre_cm"])
                dist = math.hypot(ac[0] - hc[0], ac[1] - hc[1])
                if dist <= 15 and (best is None or dist < best[0]):
                    best = (dist, j)
            if best:
                used.add(best[1])
            orow.append({"id": o["id"], "rooms": pair_h, "zone_split": zone_of(o), "width_cm": o.get("width_cm"), "matched": bool(best), "dist_cm": round(best[0], 1) if best else None})
        gated = [r for r in orow if not r["zone_split"]]
        out["openings"] = {"hand": len(hand_o), "gated": len(gated), "auto": len(auto_o), "matched_within_15cm": sum(r["matched"] for r in gated),
                           "zone_splits_reported": [r["id"] for r in orow if r["zone_split"]], "rows": orow}
        # fixed elements
        frow = []
        for f in hand.get("fixtures", []):
            if f.get("kind") not in ("counter", "tall_unit", "hob", "sink"):
                continue
            hc = (f["centre_cm"][0] * hk, f["centre_cm"][1] * hk)
            near = [math.hypot(a2h(*g["centre_cm"])[0] - hc[0], a2h(*g["centre_cm"])[1] - hc[1]) for g in auto.get("fixtures", []) if g.get("kind") == f["kind"] and g.get("centre_cm")]
            frow.append({"id": f["id"], "kind": f["kind"], "dist_cm": round(min(near), 1) if near else None, "pass": bool(near) and min(near) <= 10})
        out["fixed_elements"] = {"hand": len(frow), "within_10cm": sum(r["pass"] for r in frow), "rows": frow}
    json.dump(out, open(os.path.join(d, "dims-gate-hand.json" if hand_only else "dims-gate.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    msg = [f"{len(chains)} printed dimension chains -> {out['dimension_lines']} lines; {len(rows)} gated rows (the hand ties them; bar {bar} %, printed_dimensions.measure)"]
    for r in sorted(rows, key=lambda r: (r["open_plan"], r["kind"], str(r["room"]), -r["printed_cm"])):
        tag = (r["fixture"] or r["room"]) + (" (open plan)" if r["open_plan"] else "")
        s_ = f"  {r['kind']:7s} {tag:34s} printed {r['printed_cm']:7.1f}  hand {r['hand_cm']!s:>7} ({r['hand_pct']} %) {'ok' if r['hand_pass'] else 'OFF'}"
        if A:
            s_ += f"   auto {r.get('auto_cm')!s:>7} ({r.get('auto_pct')} %) {r.get('auto_verdict')} {'ok' if r.get('auto_pass') else 'OFF'} [{r.get('auto_fixture') or r.get('auto_room')}]"
        msg.append(s_)
    lines = msg
    lines.append(f"closed rooms within the bar: hand {out['closed_rooms_hand_pass']}/{len(closed)}" + (f", auto {out['closed_rooms_auto_pass']}/{len(closed)}" if A else "")
                 + f"; gated rows: hand {out['rows_hand_pass']}/{len(rows)}" + (f", auto {out['rows_auto_pass']}/{len(rows)}" if A else ""))
    if A:
        lines.append(f"rooms exist: {out['rooms_exist']['with_auto_counterpart']}/{out['rooms_exist']['hand']} (missing {out['rooms_exist']['missing']})")
        op = out["open_plan"]; lines.append(f"open plan as one region: area {op['area_err_pct']:+.2f} %, outline {op['outline_dev_pct']:.2f} % -> {'PASS' if op['pass'] else 'FAIL'}")
        lines.append(f"openings within 15 cm: {out['openings']['matched_within_15cm']}/{out['openings']['gated']} gated (+{len(out['openings']['zone_splits_reported'])} zone splits reported: {out['openings']['zone_splits_reported']}); fixed elements within 10 cm: {out['fixed_elements']['within_10cm']}/{out['fixed_elements']['hand']}")
        for r in out["openings"]["rows"]:
            lines.append(f"    {r['id']:6s} {'zone ' if r['zone_split'] else 'GATED'} {r['rooms']} w {r['width_cm']}  {'matched ' + str(r['dist_cm']) + ' cm' if r['matched'] else 'missing'}")
    sys.stdout.buffer.write(("\n".join(lines) + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()

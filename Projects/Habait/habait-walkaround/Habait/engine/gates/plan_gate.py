#!/usr/bin/env python
"""plan_gate.py - does a traced plan.json agree with the sales sheet, room by room? ($0, no network)

Engine gate A6 (board habait-workplan-2026-11-02, card 05). Generic: takes any plan.json (SCHEMA.md: cm, +y down)
plus the printed dimensions and where they sit on the sheet. Never a global score: every class is measured per room,
and the plan score is the WORST room, so one moved room cannot hide behind ten good ones (the fidelity_gate lesson).

Classes (per room):
  dims      every printed room-clear dimension mapped to the room: the traced room's face-to-face chord parallel to
            the printed dimension line, 5..20 cm off it on the side away from the room centroid (median),
            |measured - printed| / printed <= 3 %. GATES only when the lines come from report.json (--dims-gate auto);
            with the hand-read stand-in map (fixtures/<apt>.dims.json) it is ADVISORY: on 846 four chord rules were
            tried against hand-read lines and none was stable (the 846 tracer put the dimension-line strokes into its
            barrier mask, so the loops are notched along them). Kinds overall/opening/sub_element/partial are listed
            but never checked.
  area      traced area vs printed a x b for rooms whose two printed sides form the room: <= 6 % (two 3 % sides)
  walls     samples along the room edges marked 'wall' (edge_kinds): the signed offset to the nearest wall face
            (+ = outside the wall solid) must sit in [-2, +7] cm. kept = share inside the band; >= 0.6 per room.
            The band comes from the good 846 trace (median 3.2 cm, the barrier stroke) and was fixed before any bad
            input was built; a room shifted by >= ~5 cm normal to its walls leaves it.
  neighbours samples along the room's non-wall edges that face another room within 20 cm: rooms are disjoint, so a
            sample deeper than 2 cm inside another room is an overlap. kept = share not overlapping, >= 0.9
            (good 846: 0 overlapping samples in 11 rooms).
  openings  each opening's centre lies within 15 cm of the boundary of every room it joins (report only, not scored:
            region-contact openings of the 846 trace are virtual).

score = min over rooms of min(walls kept, neighbours kept[, dims share ok when gating]);
PASS = every room passes every gating class (walls >= 0.6, neighbours >= 0.9, area <= 6 %, dims <= 3 % when gating).

Printed dimensions: --report <report.json> with {"dimensions": [...]} in the same shape as
fixtures/apt846.dims.json wins; otherwise --dims (default: the fixture whose "plan" matches by apartment_id) and the
values are cross-checked against --intake (drawing.printed_dimensions_cm).

Usage:
  python plan_gate.py <plan.json> [--report report.json] [--dims map.json] [--intake intake.json] [--out result.json]
  python plan_gate.py --selftest <plan.json>      # moves every room 10 cm in 4 directions, must FAIL all with walls
  python plan_gate.py --make-bad <plan.json> --room r-bedroom-2 --dx 10 --dy 0 --out bad-plan.json
Exit: 0 PASS, 1 FAIL, 2 usage / input error.
"""
import argparse
import copy
import json
import math
import os
import sys

import numpy as np
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
# ONE printed-dimension measurement for every gate (coordinator 2026-11-05, fork A's R6/R16): a line read with its two ticks is
# measured by tour360/tools/printed_dimensions.py measure_line — the SAME code that gates Rainbow apt846 and fork B's dims gate.
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..", "..", "tour360", "tools")))
import printed_dimensions as PD  # noqa: E402


def fidelity_bar():
    """the fidelity rule's bar (tour360/fidelity.json max_deviation_pct, 1 %) — the SAME bar Rainbow is gated at"""
    try:
        return float(json.load(open(os.path.join(HERE, "..", "..", "tour360", "fidelity.json"), encoding="utf-8"))["max_deviation_pct"])
    except Exception:
        return DIM_TOL * 100
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
DIM_TOL = 0.03
AREA_TOL = 0.06
WALL_BAND = (-2.0, 7.0)
NBR_MIN = -2.0      # cm: deeper than this into another room = overlap
NBR_KEPT_MIN = 0.9  # rooms are disjoint: a hard topological rule with 10 % noise allowance
NBR_REACH = 20.0
KEPT_MIN = 0.6
OPEN_TOL = 15.0
STEP = 5.0  # cm between edge samples


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def poly(loop):
    g = Polygon(loop).buffer(0)
    if g.geom_type != "Polygon":
        g = max(g.geoms, key=lambda x: x.area)
    return g


SNAP_DEG = 12.0
SLIDE_CM = 40.0
BAND_CM = 20.0
FACE_REACH = 10.0


def snap_angle(geom, angle_deg):
    """a clear dimension runs parallel to a wall: snap to the nearest long edge direction (mod 180) within SNAP_DEG."""
    best, bestd = angle_deg, SNAP_DEG
    c = list(geom.exterior.coords) if geom.geom_type == "Polygon" else []
    for a, b in zip(c, c[1:]):
        if math.dist(a, b) < 50:
            continue
        e = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180
        dd = abs((e - angle_deg + 90) % 180 - 90)
        if dd < bestd:
            best, bestd = angle_deg + ((e - angle_deg + 90) % 180 - 90), dd
    return best


def chord(geom, anchor, angle_deg):
    """length of the piece of the line (anchor, angle) inside geom that is nearest the anchor. A label read off the
    sheet can sit in the wall next to its line: slide it perpendicular to the line (never along it) into the room."""
    t = math.radians(angle_deg)
    u = np.array([math.cos(t), math.sin(t)])
    nrm = np.array([-u[1], u[0]])
    a = np.array(anchor, float)
    if not geom.contains(Point(a)):
        for s in np.arange(1.0, SLIDE_CM + 1, 1.0):
            hit = next((a + nrm * sg * s for sg in (1, -1) if geom.contains(Point(a + nrm * sg * s))), None)
            if hit is not None:
                a = hit
                break
    d = u * 5000.0
    inter = LineString([a - d, a + d]).intersection(geom)
    parts = [g for g in getattr(inter, "geoms", [inter]) if g.geom_type == "LineString" and g.length > 0]
    if not parts:
        return None
    pt = Point(a)
    return min(parts, key=lambda g: g.distance(pt))


def to_face(seg, walls):
    """a printed clear dimension runs wall FACE to wall face; the traced loop sits a few cm inside the face (the
    tracer's barrier stroke). Extend each chord end that stops within FACE_REACH of a wall to that wall's face."""
    c = np.array(seg.coords)
    p0, p1 = c[0], c[-1]
    L = float(np.linalg.norm(p1 - p0))
    if walls is None or walls.is_empty or L == 0:
        return L
    u = (p1 - p0) / L
    ext = 0.0
    for end, out in ((p0, -u), (p1, u)):
        ray = LineString([end + out * 0.5, end + out * FACE_REACH])
        hit = ray.intersection(walls)
        if not hit.is_empty:
            ext += 0.5 + Point(end + out * 0.5).distance(hit)
    return L + ext


def measure(geom, walls, anchor, angle_deg):
    """median face-to-face chord over lines parallel to the dimension line within +-BAND_CM (the position error of a
    hand or VLM reading of the line). Returns (median, list) or (None, [])."""
    t = math.radians(angle_deg)
    nrm = np.array([-math.sin(t), math.cos(t)])
    # drafting convention: a dimension line runs in the clear strip between itself and the wall it is drawn next to;
    # the interior side is cut by closet / furniture strokes, and the line stroke itself may be in a tracer's barrier
    # mask (it is in the 846 trace). So sample only the side away from the room's centroid, 5..BAND_CM off the line.
    ctr = np.array(geom.centroid.coords[0])
    side = -1.0 if float(np.dot(ctr - np.array(anchor, float), nrm)) > 0 else 1.0
    vals = []
    for off in side * np.arange(5.0, BAND_CM + 0.1, 5.0):
        seg = chord(geom, list(np.array(anchor, float) + nrm * off), angle_deg)
        if seg is not None:
            vals.append(to_face(seg, walls))
    return (float(np.median(vals)), vals) if vals else (None, [])


def edge_samples(loop, kinds, want):
    n = len(loop)
    for i, k in enumerate(kinds or []):
        if (k == "wall") != (want == "wall"):
            continue
        a, b = np.array(loop[i], float), np.array(loop[(i + 1) % n], float)
        L = float(np.linalg.norm(b - a))
        if L < 1e-6:
            continue
        m = max(1, int(L // STEP))
        for j in range(m):
            yield a + (b - a) * ((j + 0.5) / m)


def signed_off(geom, p):
    """+ distance outside geom's solid, - depth inside it."""
    pt = Point(p)
    d = geom.boundary.distance(pt)
    return -d if geom.contains(pt) else d


def find_dims(plan, args):
    if args.report and os.path.exists(args.report):
        rep = load(args.report)
        if rep.get("dimensions"):
            return rep["dimensions"], rep.get("area_pairs", []), "report:" + args.report
    if not args.dims and (plan.get("plan_meta") or {}).get("printed_dimensions"):
        return "PLAN", [], "plan_meta.printed_dimensions (%d lines, printed_dimensions.measure)" % len(plan["plan_meta"]["printed_dimensions"])
    path = args.dims
    if not path:
        cand = os.path.join(HERE, "fixtures", f"{plan.get('apartment_id', '')}.dims.json")
        path = cand if os.path.exists(cand) else None
    if not path:
        return [], [], "none"
    m = load(path)
    return m["dimensions"], m.get("area_pairs", []), "map:" + os.path.relpath(path, REPO)


def evaluate(plan, dims, area_pairs, intake_vals=None, dims_gate=True):
    rooms = {r["id"]: r for r in plan["rooms"]}
    geoms = {rid: poly(r["loop"]) for rid, r in rooms.items()}
    walls = unary_union([Polygon(w["polygon_cm"]).buffer(0) for w in plan.get("walls", [])])
    res = {rid: {"id": rid, "name_he": r.get("name_he"), "area_m2": round(geoms[rid].area / 1e4, 3),
                 "dims": [], "area": None, "walls": None, "neighbours": None} for rid, r in rooms.items()}
    unchecked, worst_dev = [], 0.0

    if dims == "PLAN":   # the shared measurement over the plan's own lines: room and fixture rows gate, outlines are reported
        bar = fidelity_bar()
        for row in PD.measure(plan, None, bar)["rows"]:
            rec = {"printed_cm": row["printed_cm"], "kind": row.get("kind"), "label": row.get("id"), "method": "printed_dimensions.measure",
                   "tied": {"kind": row.get("kind"), "room": row.get("room"), "fixture": row.get("fixture"), "verdict": row.get("verdict")}}
            if row.get("kind") not in ("room", "fixture") or row.get("verdict") in ("UNTIED", "REPORTED", "NO-FIXTURE") or row.get("room") not in res:
                rec["why"] = row.get("verdict"); unchecked.append(rec); continue
            worst_dev = max(worst_dev, row["pct"] / 100.0)
            rec.update(measured_cm=row["trace_cm"], dev=round(row["trace_pct"] / 100.0, 4), pct=row["pct"], ok=row.get("verdict") == "PASS")
            res[row["room"]]["dims"].append(rec)
        dims = []

    for d in dims:
        rec = {"printed_cm": d["value_cm"], "kind": d["kind"], "label": d.get("label")}
        if d["kind"] != "room_clear":
            unchecked.append(rec)
            continue
        missing = [r for r in d["rooms"] if r not in geoms]
        if missing:
            rec.update(measured_cm=None, dev=None, ok=False, why=f"room(s) missing: {missing}")
        else:
            g = unary_union([geoms[r] for r in d["rooms"]])
            if len(d["rooms"]) > 1:   # close the few-cm trace gaps of an open plan
                g = g.buffer(6.0).buffer(-6.0)
            if d.get("a_cm") and d.get("b_cm"):     # the line's end ticks were read: printed_dimensions.measure_line decides
                A, B = np.array(d["a_cm"], float), np.array(d["b_cm"], float)
                rd = float(np.linalg.norm(B - A))
                rec["reading_cm"] = round(rd, 1)
                rec["reading_dev"] = round((rd - d["value_cm"]) / d["value_cm"], 4)
                rec["angle_deg"] = round(math.degrees(math.atan2(B[1] - A[1], B[0] - A[0])), 1)
                row = PD.measure_line(plan, {"id": d.get("label"), "printed_cm": d["value_cm"], "a_cm": list(d["a_cm"]), "b_cm": list(d["b_cm"]), "rooms": list(d["rooms"])}, DIM_TOL * 100)
                rec["method"] = "printed_dimensions.measure_line"
                rec["tied"] = {"kind": row.get("kind"), "room": row.get("room"), "fixture": row.get("fixture"), "verdict": row.get("verdict")}
                if row.get("verdict") == "UNTIED" or row.get("trace_cm") is None:
                    rec.update(measured_cm=None, dev=None, ok=False, why="an end of the line lands on nothing traced (UNTIED)")
                else:
                    dev = row["trace_pct"] / 100.0
                    worst_dev = max(worst_dev, row["pct"] / 100.0)
                    rec.update(measured_cm=row["trace_cm"], dev=round(dev, 4), pct=row["pct"], ok=row.get("verdict") in ("PASS", "REPORTED") and row["pct"] <= DIM_TOL * 100)
            else:
                # no ticks read (a hand stand-in map with an anchor and an angle): the old median face-to-face chord, marked as such —
                # it cannot be the shared measurement, which needs the line's two ends
                gs = g if g.geom_type == "Polygon" else max(g.geoms, key=lambda x: x.area)
                anchor, ang = d["anchor_cm"], snap_angle(gs, d["angle_deg"])
                rec["angle_deg"] = round(ang, 1)
                rec["method"] = "median chord (no ticks)"
                L, _ = measure(g, walls, anchor, ang)
                if L is None:
                    rec.update(measured_cm=None, dev=None, ok=False, why="the dimension line misses the room")
                else:
                    dev = (L - d["value_cm"]) / d["value_cm"]
                    worst_dev = max(worst_dev, abs(dev))
                    rec.update(measured_cm=round(L, 1), dev=round(dev, 4), ok=abs(dev) <= DIM_TOL)
        key = d["rooms"][0] if d["rooms"] and d["rooms"][0] in res else None
        if len(d["rooms"]) > 1:
            rec["rooms"] = d["rooms"]
        if key:
            res[key]["dims"].append(rec)

    for ap in area_pairs:
        rid = ap["rooms"][0]
        if rid not in geoms:
            continue
        pa = ap["dims_cm"][0] * ap["dims_cm"][1] / 1e4
        ta = sum(geoms[r].area for r in ap["rooms"] if r in geoms) / 1e4
        dev = (ta - pa) / pa
        res[rid]["area"] = {"printed_m2": round(pa, 3), "traced_m2": round(ta, 3), "dev": round(dev, 4), "ok": abs(dev) <= AREA_TOL}

    for rid, r in rooms.items():
        loop, kinds = r["loop"], r.get("edge_kinds")
        offs = [signed_off(walls, p) for p in edge_samples(loop, kinds, "wall")] if not walls.is_empty else []
        if len(offs) >= 10:
            offs = np.array(offs)
            kept = float(np.mean((offs >= WALL_BAND[0]) & (offs <= WALL_BAND[1])))
            res[rid]["walls"] = {"samples": int(len(offs)), "kept": round(kept, 3),
                                 "median_cm": round(float(np.median(offs)), 1), "ok": kept >= KEPT_MIN}
        others = unary_union([g for k, g in geoms.items() if k != rid])
        gaps = []
        for p in edge_samples(loop, kinds, "other"):
            pt = Point(p)
            if others.distance(pt) > NBR_REACH:
                continue
            gaps.append(signed_off(others, p))
        if len(gaps) >= 10:
            gaps = np.array(gaps)
            kept = float(np.mean(gaps >= NBR_MIN))
            res[rid]["neighbours"] = {"samples": int(len(gaps)), "kept": round(kept, 3),
                                      "median_cm": round(float(np.median(gaps)), 1), "ok": kept >= NBR_KEPT_MIN}

    for rid, x in res.items():
        parts = []
        if x["dims"] and dims_gate:
            parts.append(sum(1 for d in x["dims"] if d.get("ok")) / len(x["dims"]))
        for k in ("walls", "neighbours"):
            if x[k]:
                parts.append(x[k]["kept"])
        x["score"] = round(min(parts), 3) if parts else None
        x["pass"] = ((not dims_gate or all(d.get("ok") for d in x["dims"])) and (x["area"] is None or x["area"]["ok"])
                     and all(x[k] is None or x[k]["ok"] for k in ("walls", "neighbours")))

    openings = []
    for o in plan.get("openings", []):
        c = Point(o.get("centre_cm") or np.mean([o["a_cm"], o["b_cm"]], axis=0))
        ds = {r: round(geoms[r].boundary.distance(c), 1) for r in o.get("rooms", []) if r in geoms}
        openings.append({"id": o["id"], "kind": o.get("kind"), "dist_cm": ds, "ok": all(v <= OPEN_TOL for v in ds.values())})

    scored = [x["score"] for x in res.values() if x["score"] is not None]
    score = min(scored) if scored else 0.0
    worst = min((x for x in res.values() if x["score"] is not None), key=lambda x: x["score"], default=None)
    out = {"gate": "plan_gate", "version": 1, "dims_gating": dims_gate, "score": round(score, 3), "worst_room": worst["id"] if worst else None,
           "worst_dev": round(worst_dev, 4), "pass": False, "rooms": list(res.values()),
           "unchecked_dims": unchecked, "openings": openings,
           "openings_off": [o["id"] for o in openings if not o["ok"]],
           "thresholds": {"dim": DIM_TOL, "area": AREA_TOL, "walls_band_cm": WALL_BAND, "walls_kept_min": KEPT_MIN,
                          "neighbours_overlap_cm": NBR_MIN, "neighbours_kept_min": NBR_KEPT_MIN}}
    out["pass"] = bool(all(x["pass"] for x in res.values()))
    if intake_vals is not None:
        mv = sorted(d["value_cm"] for d in dims)
        out["intake_dims_match"] = mv == sorted(intake_vals)
        if not out["intake_dims_match"]:
            out["pass"] = False
            out["intake_note"] = f"map {mv} != intake {sorted(intake_vals)}"
    return out


def moved(plan, rid, dx, dy):
    p = copy.deepcopy(plan)
    for r in p["rooms"]:
        if r["id"] == rid:
            r["loop"] = [[x + dx, y + dy] for x, y in r["loop"]]
            if r.get("bbox_cm"):
                b = r["bbox_cm"]
                r["bbox_cm"] = [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy]
    p.setdefault("plan_meta", {})["gate_fixture"] = f"KNOWN-BAD: room {rid} moved by ({dx}, {dy}) cm by plan_gate.py --make-bad"
    return p


def summary(out):
    lines = [f"plan_gate: {'PASS' if out['pass'] else 'FAIL'}  score={out['score']:.3f}  worst_room={out['worst_room']}  worst_dim_dev={out['worst_dev'] * 100:.1f}%"]
    for x in out["rooms"]:
        dd = " ".join(f"{d['printed_cm']}->{d.get('measured_cm')}({(d['dev'] or 0) * 100:+.1f}%)" for d in x["dims"])
        w = x["walls"]["kept"] if x["walls"] else "-"
        n = x["neighbours"]["kept"] if x["neighbours"] else "-"
        a = f" area {x['area']['dev'] * 100:+.1f}%" if x["area"] else ""
        lines.append(f"  {'ok ' if x['pass'] else 'BAD'} {x['id']:<18} score={x['score']} walls={w} nbrs={n}{a} {dd}")
    lines.append(f"  unchecked printed dims: {', '.join(str(d['printed_cm']) + ':' + d['kind'] for d in out['unchecked_dims'])}")
    if "intake_dims_match" in out:
        lines.append(f"  printed values match intake: {out['intake_dims_match']}")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan")
    ap.add_argument("--report")
    ap.add_argument("--dims")
    ap.add_argument("--intake", default=os.path.join(REPO, "Habait", "studio", "fixtures", "apt846.intake.json"))   # parity-ok: the hand-map cross-check default only; a portal plan is measured on its own plan_meta lines
    ap.add_argument("--out")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--dims-gate", choices=["auto", "on", "off"], default="auto",
                    help="auto: the dimension chords gate only when they come from report.json (machine-read lines)")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--make-bad", action="store_true")
    ap.add_argument("--room")
    ap.add_argument("--dx", type=float, default=10.0)
    ap.add_argument("--dy", type=float, default=0.0)
    a = ap.parse_args()
    try:
        plan = load(a.plan)
    except Exception as e:  # noqa: BLE001
        print(f"plan_gate: cannot read {a.plan}: {e}", file=sys.stderr)
        return 2
    if a.make_bad:
        if not (a.room and a.out):
            print("--make-bad needs --room and --out", file=sys.stderr)
            return 2
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(moved(plan, a.room, a.dx, a.dy), f, ensure_ascii=False, indent=1)
        print(f"wrote {a.out}: {a.room} moved ({a.dx}, {a.dy}) cm")
        return 0
    dims, pairs, src = find_dims(plan, a)
    dg = a.dims_gate == "on" or (a.dims_gate == "auto" and (src.startswith("report:") or src.startswith("plan_meta")))   # the plan's own ticked lines gate, like a report
    intake_vals = None
    if a.intake and os.path.exists(a.intake) and src.startswith("map:"):
        iv = load(a.intake).get("drawing", {}).get("printed_dimensions_cm")
        if iv and plan.get("apartment_id") and plan["apartment_id"] in os.path.basename(a.intake):
            intake_vals = iv
    if a.selftest:
        base = evaluate(plan, dims, pairs, intake_vals, dg)
        print(summary(base))
        caught, total, gaps = 0, 0, []
        for r in plan["rooms"]:
            for dx, dy in ((10, 0), (-10, 0), (0, 10), (0, -10)):
                o = evaluate(moved(plan, r["id"], dx, dy), dims, pairs, intake_vals, dg)
                total += 1
                caught += (not o["pass"])
                rs0 = next(x["score"] for x in base["rooms"] if x["id"] == r["id"])
                rs1 = next(x["score"] for x in o["rooms"] if x["id"] == r["id"])
                if rs0 is not None and rs1 is not None:
                    gaps.append(rs0 - rs1)
                if o["pass"]:
                    print(f"  MISSED: {r['id']} moved ({dx},{dy}) room score {rs0} -> {rs1}")
        print(f"selftest: base {'PASS' if base['pass'] else 'FAIL'} {base['score']:.3f}; 10 cm moves caught {caught}/{total}; "
              f"moved-room score drop min {min(gaps):.3f} median {float(np.median(gaps)):.3f}")
        return 0 if base["pass"] and caught == total else 1
    out = evaluate(plan, dims, pairs, intake_vals, dg)
    out["input"] = os.path.abspath(a.plan)
    out["dims_source"] = src
    if a.out:
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1) if a.json else summary(out))
    return 0 if out["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())

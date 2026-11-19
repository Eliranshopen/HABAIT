"""printed_dimensions.py — THE one implementation of "does the trace agree with the sheet's printed dimensions" (2026-11-05).
Called by tools/fidelity-gate.mjs (through tools/printed-dimensions.mjs, a thin wrapper that runs this file), by the auto-trace
dims gate and by the portal runner's plan gate. No other copy of this measurement may exist (PROJECT-PACKAGE.md, parity R16).

THE RULE (coordinator, on Eliran's behalf, 2026-11-05): a printed dimension is compared to the span between ITS OWN extension lines
(its two ticks on the sheet), never to a whole room loop and never to a band section of a room polygon.
  For each tick the trace must have a feature where that extension line lands; the end is the NEAREST trace feature along the
  dimension (within MAX_TICK_CM):
    - the dimension line crossing a room-loop / wall / pane / fixture edge,
    - a loop / wall / pane / fixture vertex within PERP_CM of the dimension line (a wall end, a column corner, a closet's end),
    - the tick lying inside a traced wall / pane / fixture (the drawn line it lands on is inside a traced element: offset 0),
    (no far search: an end with nothing traced within MAX_TICK_CM is UNTIED, never matched to something far away).
  trace span = the distance between the two ends' features; row pct = max(|span − printed| / printed, every end's |offset| / printed).
  WHAT the dimension measures follows from where its ends land, mechanically:
    - kind "fixture": the data names the fixture, or both ends land on the same fixture's edges; AND every fixture lying along the
      line (within PERP_CM, overlapping half of it) whose length along it matches the printed number (within max(FIX_LEN_CM,
      FIX_LEN_PCT)) gets its own fixture row too: a closet run or a tray that a dimension spans must sit between the same extension
      lines. A fixture row's pct includes both end offsets, so a fixture slid along its wall fails even with the right length
      (apt846 2026-11-05: w-closet-1 +20, w-closet-2 +15, bg-shower -26 cm, found by this rule; fixed by snap_fixtures);
    - kind "room":    otherwise; the room is the one containing the line's midpoint (else the rooms whose loops carry the ends);
    - kind "outline": the midpoint lies in no room (an overall / facade / chain dimension outside the unit): REPORTED, not gated;
    - verdict "UNTIED": an end lands on nothing traced — reported with the end, never measured against something else.
  A room measured by two perpendicular room dimensions has a measured rectangle; loop area outside it is a NICHE (a window bay, a
  door recess), reported on its own (area + median distance of its edges to the drawn faces), not a deviation.

Data: plan["plan_meta"]["printed_dimensions"] = [{id, printed_cm, a_cm, b_cm, rooms?, fixture?}] (a/b = the ticks, plan cm);
or any list of lines in the same shape (--lines), e.g. the PDF's dimension chains converted to the plan frame by the caller.

    from printed_dimensions import measure, measure_line
    out = measure(plan)                    # {"rows": [...], "niches": [...]}
    python printed_dimensions.py <plan.general.json> [--lines lines.json] [--json] [--bar 1.0]
    python printed_dimensions.py <plan.general.json> [--lines lines.json] --snap-fixtures [--go]   # the shared fixture fix
"""
import json
import math
import sys

MAX_TICK_CM = 40.0
PERP_CM = 60.0
NEAR_CM = 60.0          # auto mode: rooms whose loop comes within this of the dimension line are candidates
FIX_LEN_CM, FIX_LEN_PCT = 3.0, 2.0   # a fixture "spans" a dimension when its length along it is this close to the printed number


def _sub(a, b): return (a[0] - b[0], a[1] - b[1])
def _dot(a, b): return a[0] * b[0] + a[1] * b[1]
def _len(a): return math.hypot(a[0], a[1])


def _area(L):
    return abs(sum(L[i][0] * L[(i + 1) % len(L)][1] - L[(i + 1) % len(L)][0] * L[i][1] for i in range(len(L)))) / 2


def _cross_s(p, u, c, d):
    e = _sub(d, c)
    den = u[0] * e[1] - u[1] * e[0]
    if abs(den) < 1e-9:
        return None
    w = _sub(c, p)
    s = (w[0] * e[1] - w[1] * e[0]) / den
    t = (w[0] * u[1] - w[1] * u[0]) / den
    return s if 0 <= t <= 1 else None


def _seg_dist(p, a, b):
    ab = _sub(b, a)
    L2 = _dot(ab, ab)
    t = max(0.0, min(1.0, _dot(_sub(p, a), ab) / L2)) if L2 else 0.0
    return _len(_sub(p, (a[0] + t * ab[0], a[1] + t * ab[1])))


def _inside(pt, P):
    x, y = pt
    ins = False
    for i in range(len(P)):
        x1, y1 = P[i]; x2, y2 = P[(i + 1) % len(P)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            ins = not ins
    return ins


def _clip(subject, convex):
    sgn = math.copysign(1, sum(convex[i][0] * convex[(i + 1) % len(convex)][1] - convex[(i + 1) % len(convex)][0] * convex[i][1] for i in range(len(convex))))
    out = list(subject)
    for i in range(len(convex)):
        if not out:
            break
        A, B = convex[i], convex[(i + 1) % len(convex)]
        inside = lambda p: sgn * ((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) >= 0

        def inter(p, q):
            r, s = _sub(q, p), _sub(B, A)
            den = r[0] * s[1] - r[1] * s[0]
            t = ((A[0] - p[0]) * s[1] - (A[1] - p[1]) * s[0]) / den
            return (p[0] + t * r[0], p[1] + t * r[1])

        inp, out = out, []
        for k in range(len(inp)):
            P, Q = inp[k], inp[(k + 1) % len(inp)]
            if inside(Q):
                if not inside(P):
                    out.append(inter(P, Q))
                out.append(Q)
            elif inside(P):
                out.append(inter(P, Q))
    return out


def _seg_seg_dist(a, b, c, d):
    if _cross_s(a, _sub(b, a), c, d) is not None:
        s = _cross_s(a, _sub(b, a), c, d)
        if 0 <= s <= 1:
            return 0.0
    return min(_seg_dist(a, c, d), _seg_dist(b, c, d), _seg_dist(c, a, b), _seg_dist(d, a, b))


def _end(a, u, s_tick, shapes, rooms_for_exterior):
    """the trace feature nearest the extension line at s_tick. shapes = [(polygon, label, closed_solid)]: room loops (not solid),
    wall / pane / fixture polygons (solid: a tick inside one is on it). Returns {s, offset_cm, feature, on} or None."""
    n = (-u[1], u[0])
    tick = (a[0] + u[0] * s_tick, a[1] + u[1] * s_tick)
    cands = []
    for P, label, solid in shapes:
        for i in range(len(P)):
            c, e = P[i], P[(i + 1) % len(P)]
            sv = _cross_s(a, u, c, e)
            if sv is not None and abs(sv - s_tick) <= MAX_TICK_CM:
                cands.append((abs(sv - s_tick), sv, "crosses " + label, label))
            w = _sub(c, a)
            if abs(_dot(w, n)) <= PERP_CM:
                sv = _dot(w, u)
                if abs(sv - s_tick) <= MAX_TICK_CM:
                    cands.append((abs(sv - s_tick), sv, "corner of " + label, label))
        if solid and not label.startswith("fixture ") and _inside(tick, P):
            cands.append((0.0, s_tick, "inside " + label, label))
    if not cands and rooms_for_exterior:
        # an EXTERIOR dimension: its extension line runs on until it meets the rooms
        for r in rooms_for_exterior:
            for q in r["loop"]:
                sv = _dot(_sub(q, a), u)
                if abs(sv - s_tick) <= MAX_TICK_CM:
                    cands.append((abs(sv - s_tick), sv, "extension line meets loop " + r["id"] + f" {abs(_dot(_sub(q, a), n)):.0f} cm from the dimension line", "loop " + r["id"]))
    if not cands:
        return None
    # ties: prefer a solid element's own face (wall/pane/fixture) over a loop edge at the same place (within 0.5 cm)
    best = min(c[0] for c in cands)
    pick = min((c for c in cands if c[0] <= best + 0.5), key=lambda c: (2 if c[3].startswith("loop ") else 1 if c[3].startswith("fixture ") else 0, c[0]))
    return {"s": pick[1], "offset_cm": round(pick[1] - s_tick, 1), "feature": pick[2], "on": pick[3]}


def _surface_end(a, u, s_tick, plan, room_id):
    """the VISIBLE wall surface first: the CG builds the facing of a room on its loop's 'wall' edges (plan_general.facings), so
    where the dimension line crosses such an edge of the room it is drawn in, within MAX_TICK_CM of the tick, that crossing is the
    end — a loop cutting across the drawing is measured as the CG will show it, not hidden behind a correct wall polygon."""
    r = next((x for x in plan.get("rooms", []) if x["id"] == room_id), None) if room_id else None
    if not r:
        return None
    L, K = r["loop"], r.get("edge_kinds") or []
    best = None
    for i in range(len(L)):
        if i >= len(K) or K[i] != "wall":
            continue
        sv = _cross_s(a, u, L[i], L[(i + 1) % len(L)])
        if sv is not None and abs(sv - s_tick) <= MAX_TICK_CM and (best is None or abs(sv - s_tick) < abs(best - s_tick)):
            best = sv
    if best is None:
        return None
    hit = {"s": best, "offset_cm": round(best - s_tick, 1), "feature": "wall surface (loop " + room_id + ")", "on": "loop " + room_id}
    # a loop edge lying inside a wall polygon has no facing in front of it: the wall prism's own face is what shows, the first wall
    # face met going from the crossing back toward the room
    pt = (a[0] + u[0] * best, a[1] + u[1] * best)
    walls = [w["polygon_cm"] for w in plan.get("walls", [])]
    if any(_inside(pt, P) for P in walls):
        toward = -1.0 if s_tick > 0 else 1.0                     # the room lies between the two ticks
        faces = [sv for P in walls for i in range(len(P)) for sv in [_cross_s(a, u, P[i], P[(i + 1) % len(P)])]
                 if sv is not None and 0 <= (sv - best) * toward <= MAX_TICK_CM]
        if faces:
            sv = min(faces, key=lambda x: (x - best) * toward)
            hit = {"s": sv, "offset_cm": round(sv - s_tick, 1), "feature": "wall face (loop " + room_id + " inside the wall)", "on": "loop " + room_id}
    # glass is a visible surface too: a tick on a pane (a window in its bay) is measured to the pane when that is nearer
    tick = (a[0] + u[0] * s_tick, a[1] + u[1] * s_tick)
    for q in plan.get("panes", []):
        P = q["polygon_cm"]
        cands = [0.0] if _inside(tick, P) else []
        cands += [sv - s_tick for i in range(len(P)) for sv in [_cross_s(a, u, P[i], P[(i + 1) % len(P)])] if sv is not None]
        for off in cands:
            if abs(off) < abs(hit["offset_cm"]) - 0.05 and abs(off) <= MAX_TICK_CM:
                hit = {"s": s_tick + off, "offset_cm": round(off, 1), "feature": ("inside " if off == 0.0 else "crosses ") + q.get("kind", "pane") + " " + q["id"], "on": q.get("kind", "pane") + " " + q["id"]}
    return hit


def _shapes(plan, room_ids, with_fixtures=True):
    rooms = {r["id"]: r for r in plan.get("rooms", [])}
    S = [(rooms[i]["loop"], "loop " + i, False) for i in room_ids if i in rooms]
    S += [(w["polygon_cm"], "wall " + w["id"], True) for w in plan.get("walls", [])]
    S += [(q["polygon_cm"], q.get("kind", "pane") + " " + q["id"], True) for q in plan.get("panes", [])]
    if with_fixtures:
        S += [(f["polygon_cm"], "fixture " + f["id"], True) for f in plan.get("fixtures", []) if f.get("polygon_cm")]
    return S


def _fixture_row(row, d, f, a, u, drawn, bar_pct, why):
    pr = [_dot(_sub(q, a), u) for q in f["polygon_cm"]]
    sA, sB = min(pr), max(pr)
    r = {**row, "id": (row.get("id") or "") + ("" if why == "named" else "/" + f["id"]), "kind": "fixture", "fixture": f["id"],
         "room": f.get("room_id"), "tied_by": why,
         "ends": [{"offset_cm": round(sA, 1), "feature": "fixture " + f["id"]}, {"offset_cm": round(sB - drawn, 1), "feature": "fixture " + f["id"]}],
         "trace_cm": round(sB - sA, 1), "trace_pct": round((sB - sA - d["printed_cm"]) / d["printed_cm"] * 100, 2),
         "shift_cm": round((sA + (sB - drawn)) / 2, 1), "_u": u}
    r["pct"] = round(max(abs(r["trace_pct"]), abs(sA) / d["printed_cm"] * 100, abs(sB - drawn) / d["printed_cm"] * 100), 2)
    if bar_pct is not None:
        r["verdict"] = "PASS" if r["pct"] <= bar_pct else "FAIL"
    return r


def spanning_fixtures(plan, d):
    """the fixtures lying along the dimension line whose length along it matches the printed number"""
    a, b = d["a_cm"], d["b_cm"]
    ab = _sub(b, a); drawn = _len(ab); u = (ab[0] / drawn, ab[1] / drawn); n = (-u[1], u[0])
    out = []
    for f in plan.get("fixtures", []):
        P = f.get("polygon_cm")
        if not P:
            continue
        pr = [_dot(_sub(q, a), u) for q in P]
        pn = [_dot(_sub(q, a), n) for q in P]
        length = max(pr) - min(pr)
        overlap = min(max(pr), drawn) - max(min(pr), 0.0)
        near = min(abs(x) for x in pn) <= PERP_CM or min(pn) <= 0 <= max(pn)
        if near and overlap >= 0.5 * drawn and abs(length - d["printed_cm"]) <= max(FIX_LEN_CM, FIX_LEN_PCT / 100 * d["printed_cm"]):
            out.append(f)
    return out


def measure_line(plan, d, bar_pct=None):
    """one printed dimension d = {id?, printed_cm, a_cm, b_cm, rooms?, fixture?} against the plan; returns its row."""
    a, b = d["a_cm"], d["b_cm"]
    ab = _sub(b, a)
    drawn = _len(ab)
    u = (ab[0] / drawn, ab[1] / drawn)
    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    rooms = plan.get("rooms", [])
    fixtures = {f["id"]: f for f in plan.get("fixtures", [])}
    in_room = next((r["id"] for r in rooms if len(r.get("loop", [])) >= 3 and _inside(mid, r["loop"])), None)
    row = {"id": d.get("id"), "printed_cm": d["printed_cm"], "a_cm": [round(a[0], 1), round(a[1], 1)], "b_cm": [round(b[0], 1), round(b[1], 1)],
           "drawn_cm": round(drawn, 1), "drawn_pct": round((drawn - d["printed_cm"]) / d["printed_cm"] * 100, 2)}
    if d.get("fixture"):
        f = fixtures.get(d["fixture"])
        if not f or not f.get("polygon_cm"):
            return {**row, "kind": "fixture", "fixture": d["fixture"], "verdict": "NO-FIXTURE"}
        return _fixture_row(row, d, f, a, u, drawn, bar_pct, "named")
    else:
        given = d.get("rooms")
        if given is not None:
            cand = list(given)
        else:
            cand = [r["id"] for r in rooms if len(r.get("loop", [])) >= 3 and (_inside(mid, r["loop"]) or min(
                _seg_seg_dist(a, b, r["loop"][i], r["loop"][(i + 1) % len(r["loop"])]) for i in range(len(r["loop"]))) <= NEAR_CM)]
        shapes = _shapes(plan, cand)
        ends = [_surface_end(a, u, 0.0, plan, in_room) or _end(a, u, 0.0, shapes, None),
                _surface_end(a, u, drawn, plan, in_room) or _end(a, u, drawn, shapes, None)]
        row["ends"] = [e and {k: v for k, v in e.items() if k != "s"} for e in ends]
        if not (ends[0] and ends[1]):
            return {**row, "kind": "room" if in_room else "outline", "room": in_room, "verdict": "UNTIED"}
        sA, sB = ends[0]["s"], ends[1]["s"]
        fx = [e["on"][len("fixture "):] for e in ends if e["on"].startswith("fixture ")]
        if len(fx) == 2 and fx[0] == fx[1]:
            row.update(kind="fixture", fixture=fx[0], room=fixtures[fx[0]].get("room_id"))
        elif in_room is None or given == []:
            row.update(kind="outline", room=None)
        else:
            at_ends = sorted({e["on"][len("loop "):] for e in ends if e["on"].startswith("loop ")})
            row.update(kind="room", room=in_room or (at_ends[0] if at_ends else None))
            if given:
                row["rooms"] = list(given)
    trace = sB - sA
    end_pct = max([0.0] + [abs(e["offset_cm"]) / d["printed_cm"] * 100 for e in row["ends"] if e])
    row.update(trace_cm=round(trace, 1), trace_pct=round((trace - d["printed_cm"]) / d["printed_cm"] * 100, 2),
               face_a_cm=[round(a[0] + u[0] * sA, 1), round(a[1] + u[1] * sA, 1)], face_b_cm=[round(a[0] + u[0] * sB, 1), round(a[1] + u[1] * sB, 1)])
    row["pct"] = round(max(abs(row["trace_pct"]), end_pct), 2)
    if bar_pct is not None:
        row["verdict"] = "REPORTED" if row.get("kind") == "outline" else "PASS" if row["pct"] <= bar_pct else "FAIL"
    row["_u"] = u
    return row


def measure(plan, lines=None, bar_pct=None):
    lines = lines if lines is not None else ((plan.get("plan_meta") or {}).get("printed_dimensions") or [])
    rows = []
    for d in lines:
        r = measure_line(plan, d, bar_pct)
        rows.append(r)
        if d.get("fixture"):
            continue
        ab = _sub(d["b_cm"], d["a_cm"]); drawn = _len(ab); u = (ab[0] / drawn, ab[1] / drawn)
        base = {k: r[k] for k in ("id", "printed_cm", "a_cm", "b_cm", "drawn_cm", "drawn_pct")}
        for f in spanning_fixtures(plan, d):
            if r.get("kind") == "fixture" and r.get("fixture") == f["id"]:
                continue
            rows.append(_fixture_row(base, d, f, d["a_cm"], u, drawn, bar_pct, "spans"))
    faces = [(w["polygon_cm"][i], w["polygon_cm"][(i + 1) % len(w["polygon_cm"])]) for w in plan.get("walls", []) + plan.get("panes", []) for i in range(len(w["polygon_cm"]))]
    niches = []
    for r in plan.get("rooms", []):
        mine = [x for x in rows if x.get("kind") == "room" and x.get("room") == r["id"] and "_u" in x]
        pair = next(((p, q) for i, p in enumerate(mine) for q in mine[i + 1:] if abs(_dot(p["_u"], q["_u"])) < 0.2), None)
        if not pair:
            continue
        p, q = pair

        def corner(fp, fq):
            n1, n2 = p["_u"], q["_u"]
            c1, c2 = _dot(n1, fp), _dot(n2, fq)
            den = n1[0] * n2[1] - n1[1] * n2[0]
            return ((c1 * n2[1] - c2 * n1[1]) / den, (n1[0] * c2 - n2[0] * c1) / den)

        rect = [corner(p["face_a_cm"], q["face_a_cm"]), corner(p["face_b_cm"], q["face_a_cm"]), corner(p["face_b_cm"], q["face_b_cm"]), corner(p["face_a_cm"], q["face_b_cm"])]
        inside = _clip(r["loop"], rect)
        niche_area = _area(r["loop"]) - (_area(inside) if inside else 0)
        L = r["loop"]
        outside = []
        for i in range(len(L)):
            m = ((L[i][0] + L[(i + 1) % len(L)][0]) / 2, (L[i][1] + L[(i + 1) % len(L)][1]) / 2)
            if not _inside(m, rect):
                outside.append((L[i], L[(i + 1) % len(L)]))
        dists = sorted(min(_seg_dist(((s[0] + e[0]) / 2, (s[1] + e[1]) / 2), c, f) for c, f in faces) for s, e in outside) if faces else []
        niches.append({"room": r["id"], "measured_by": [p["id"], q["id"]], "rectangle_m2": round(_area(rect) / 1e4, 3), "niche_m2": round(niche_area / 1e4, 3),
                       "niche_edges": len(outside), "niche_face_median_cm": round(dists[len(dists) // 2], 1) if dists else None})
    for x in rows:
        x.pop("_u", None)
    return {"rows": rows, "niches": niches}


def face_bias(rows):
    """the median OUTWARD offset of the room-dimension ends that land on a wall surface (+ = the trace's faces lie outside the
    drawn line centres): the systematic part of the trace's error, which trace-snap.py --face-bias-cm removes."""
    outs = []
    for r in rows:
        if r.get("kind") != "room" or not r.get("ends"):
            continue
        for k, e in enumerate(r["ends"]):
            if e and e["feature"].startswith("wall surface"):
                outs.append(-e["offset_cm"] if k == 0 else e["offset_cm"])
    outs.sort()
    return {"n": len(outs), "median_cm": outs[len(outs) // 2] if outs else None, "values": outs}


def fit_edges(plan, rows, min_cm=0.4, max_cm=3.0):
    """the shared residual fix: where a room dimension's end lands on the room's own loop 'wall' edge off its tick by more than
    min_cm (and at most max_cm: beyond that the trace is wrong in a way a shift must not hide), that edge slides along the dimension
    line onto the tick (both its vertices move by the same vector; the neighbouring edges stretch). The tick is the drawing's own
    statement of where that wall line is. Returns [(room, edge index, shift_cm)]."""
    moved = []
    rooms = {r["id"]: r for r in plan.get("rooms", [])}
    for r in rows:
        if r.get("kind") != "room" or not r.get("ends") or r.get("room") not in rooms:
            continue
        room = rooms[r["room"]]
        L, K = room["loop"], room.get("edge_kinds") or []
        a, b = r["a_cm"], r["b_cm"]
        ab = _sub(b, a); D = _len(ab); u = (ab[0] / D, ab[1] / D)
        for k, e in enumerate(r["ends"]):
            if not e or not e["feature"].startswith("wall surface") or not (min_cm < abs(e["offset_cm"]) <= max_cm):
                continue
            s_tick = 0.0 if k == 0 else D
            best = None
            for i in range(len(L)):
                if i >= len(K) or K[i] != "wall":
                    continue
                sv = _cross_s(a, u, L[i], L[(i + 1) % len(L)])
                if sv is not None and (best is None or abs(sv - s_tick) < abs(best[1] - s_tick)):
                    best = (i, sv)
            if not best:
                continue
            i, sv = best
            sh = s_tick - sv
            for j in (i, (i + 1) % len(L)):
                L[j] = [round(L[j][0] + u[0] * sh, 2), round(L[j][1] + u[1] * sh, 2)]
            moved.append((room["id"], i, round(sh, 1)))
    for rid in {m[0] for m in moved}:                      # the derived fields follow the loop (build_scene's self-check)
        r = rooms[rid]; L = r["loop"]
        xs = [v[0] for v in L]; ys = [v[1] for v in L]
        r["area_m2"] = round(_area(L) / 1e4, 3)
        r["bbox_cm"] = [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)]
        r["clear_dims_cm"] = [round(r["bbox_cm"][2] - r["bbox_cm"][0], 1), round(r["bbox_cm"][3] - r["bbox_cm"][1], 1)]
    return moved


def snap_fixtures(plan, rows, min_cm=1.0):
    """the shared fixture fix: slide every fixture whose fixture row shows a shift (length within FIX_LEN_PCT, both ends off the same
    way) back between its extension lines. Moves polygon_cm and centre_cm only. Returns [(fixture id, shift_cm)]."""
    moved = []
    fixtures = {f["id"]: f for f in plan.get("fixtures", [])}
    for r in rows:
        if r.get("kind") != "fixture" or "shift_cm" not in r or abs(r["trace_pct"]) > FIX_LEN_PCT or abs(r["shift_cm"]) < min_cm:
            continue
        if any(m[0] == r["fixture"] for m in moved):
            continue
        f = fixtures[r["fixture"]]
        a, b = r["a_cm"], r["b_cm"]
        ab = _sub(b, a); L = _len(ab); u = (ab[0] / L, ab[1] / L); s = -r["shift_cm"]
        f["polygon_cm"] = [[round(q[0] + u[0] * s, 2), round(q[1] + u[1] * s, 2)] for q in f["polygon_cm"]]
        if f.get("centre_cm"):
            f["centre_cm"] = [round(f["centre_cm"][0] + u[0] * s, 2), round(f["centre_cm"][1] + u[1] * s, 2)]
        moved.append((f["id"], r["shift_cm"]))
    return moved


def _fmt(x):
    ends = " · ".join(f"{e['offset_cm']:+.1f} cm {e['feature']}" for e in (x.get("ends") or []) if e)
    what = x.get("kind", "?") + (" " + (x.get("fixture") or x.get("room") or "") if (x.get("fixture") or x.get("room")) else "")
    num = f"trace {x['trace_cm']:7.1f} ({x['trace_pct']:+.2f}%) pct {x['pct']:.2f}" if "trace_cm" in x else f"{x.get('verdict')}"
    return f"{str(x.get('id')):12s} printed {x['printed_cm']:7.1f} | {what:28s} | {num} {x.get('verdict', '') if 'trace_cm' in x else ''} | ends: {ends}"


if __name__ == "__main__":
    plan = json.load(open(sys.argv[1], encoding="utf-8"))
    lines = json.load(open(sys.argv[sys.argv.index("--lines") + 1], encoding="utf-8")) if "--lines" in sys.argv else None
    bar = float(sys.argv[sys.argv.index("--bar") + 1]) if "--bar" in sys.argv else None
    out = measure(plan, lines, bar)
    if "--face-bias" in sys.argv:
        fb = face_bias(out["rows"])
        print(f"face bias: median {fb['median_cm']} cm over {fb['n']} wall-surface ends (+ = traced faces outside the drawn lines): {fb['values']}")
        sys.exit(0)
    if "--fit-edges" in sys.argv:
        moved = fit_edges(plan, out["rows"])
        for rid, i, sh in moved:
            print(f"fit-edges: {rid} edge {i} slid {sh:+.1f} cm onto its printed tick")
        if "--go" in sys.argv and moved:
            json.dump(plan, open(sys.argv[1], "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
            print("written")
        elif moved:
            print("dry run (--go to write)")
        sys.exit(0)
    if "--snap-fixtures" in sys.argv:
        moved = snap_fixtures(plan, out["rows"])
        for fid, sh in moved:
            print(f"snap-fixtures: {fid} slid {-sh:+.1f} cm along its printed dimension")
        if "--go" in sys.argv and moved:
            json.dump(plan, open(sys.argv[1], "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
            print("written")
        elif moved:
            print("dry run (--go to write)")
        sys.exit(0)
    if "--json" in sys.argv:
        sys.stdout.write(json.dumps(out, ensure_ascii=False))
        sys.exit(0)
    for x in out["rows"]:
        print(_fmt(x))
    for n in out["niches"]:
        print(f"niche {n['room']}: rectangle {n['rectangle_m2']} m2 by {n['measured_by']}, niche {n['niche_m2']} m2 over {n['niche_edges']} edges, median {n['niche_face_median_cm']} cm from the drawn faces")

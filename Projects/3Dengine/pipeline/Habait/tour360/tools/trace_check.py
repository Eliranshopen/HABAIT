#!/usr/bin/env python
"""trace_check.py <plan-dir>

The mandatory check after an automatic trace (Eliran 2026-11-04: «אני לא יכול שהיזם יאשר ולהסתמך על זה, אני צריך שהסוכן AI
מאחורי הקלעים יבדוק התאמה»). The developer's approval is NOT the check: a trace reaches the developer only after it PASSES here
and the independent vision judge (auto-trace.mjs) finds no mismatch. Hard thresholds:

  dims        a PDF run: every printed dimension line tied to its closed room, the room measured across that line within
              1 % (printed_dimensions.py, the gate's and the hand trace's rule); a raster plan: every room with printed dims,
              each traced side within max(2 %, 5 cm) of the printed side, and the shape IoU with its printed rectangle
  areas       every printed room area within 2 % (when the plan prints room areas)
  labels      every room label has exactly one traced room; no traced room without a label; rooms = labels read
  doors       every door swing arc on the drawing → an opening between two DIFFERENT traced rooms (or a room and outside)
  entrance    when the plan labels an entrance, an opening on the building's edge next to it
  windows     every window drawn on the plan → a pane in the trace
  wet rooms   every bathroom has a sanitary fixture; the kitchen has a counter, sink or hob

Writes <plan-dir>/trace-check.json: { status, checks: [{check, room?, expected, got, pass}], failures: [...],
corrections: { force_rect: [seed ids] } } — the corrections the next round applies (re-seed the room from its printed rectangle).
"""
import json
import math
import os
import sys

from shapely.geometry import Polygon, Point

WET = {"bathroom": {"wc", "shower", "bathtub", "vanity"}, "kitchen": {"counter", "sink", "hob", "tall_unit", "island"}}


def main():
    d = sys.argv[1]
    J = lambda f, dflt=None: json.load(open(os.path.join(d, f), encoding="utf-8")) if os.path.exists(os.path.join(d, f)) else dflt
    plan, seeds, report = J("plan.general.json"), J("seeds.json", []), J("report.json", {})
    doors, glazing = J("doors.json", {"arcs": []}), J("glazing.json", {"glazing": []})
    ppc = float(report.get("scale_px_per_cm") or plan["plan_meta"].get("scale_px_per_cm") or 1)
    rooms = {r["id"]: Polygon(r["loop"]).buffer(0) for r in plan["rooms"]}
    by_id = {s["room_id"]: s for s in seeds}
    checks, force = [], set()
    add = lambda **k: checks.append(k)
    # dims. A PDF run (pdf-vectors.json): every printed dimension line measured between ITS OWN extension lines by
    # printed_dimensions.measure (room / fixture rows gated at 1 %, UNTIED reported). One rule for the check and the gate (coordinator, round 17).
    pv_p = os.path.join(d, "pdf-vectors.json")
    dim_rows = []
    if os.path.exists(pv_p):
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import dim_chains
        import dims_gate
        pv = json.load(open(pv_p, encoding="utf-8"))
        ch = dim_chains.chains(pv.get("dimension_segments_px", []), ppc)
        import printed_dimensions as PD
        lines = dims_gate.pdf_lines(ch, lambda x, y: (x / ppc, y / ppc))
        for t in PD.measure(plan, lines, 1.0)["rows"]:
            if t.get("kind") not in ("room", "fixture"):
                continue                           # an outline / facade dimension: reported by the module, not a room check
            rid = t.get("room")
            if t.get("verdict") == "UNTIED":
                add(check="dims_untied", room=rid, name=by_id.get(rid, {}).get("name_he"), expected=t["printed_cm"], got="an end lands on nothing traced",
                    rule="printed_dimensions.measure_line", **{"pass": True})   # reported, not gated (the module's rule)
                continue
            ok = t.get("verdict") == "PASS"
            add(check="dims", room=rid, fixture=t.get("fixture"), name=by_id.get(rid, {}).get("name_he"), expected=t["printed_cm"], got=t.get("trace_cm"),
                pct=t.get("pct"), tol="1 % between the dimension's own extension lines", rule="printed_dimensions.measure_line", **{"pass": ok})
            if not ok and t.get("kind") == "room" and by_id.get(rid, {}).get("dims_cm"):
                force.add(by_id[rid]["id"])
    for row in ([] if os.path.exists(pv_p) else report.get("dims", [])):
        if not row.get("printed_cm"):
            continue
        pr = sorted(row["printed_cm"], reverse=True)
        got = row["measured_cm"]
        ok = all(abs(got[i] - pr[i]) <= max(0.02 * pr[i], 5) for i in range(2))
        add(check="dims", room=row["room"], name=row.get("name_he"), expected=pr, got=got, tol="max(2 %, 5 cm) per side", **{"pass": ok})
        if not ok and by_id.get(row["room"], {}).get("dims_cm"):
            force.add(by_id[row["room"]]["id"])
    # areas (only when printed per room)
    for s in seeds:
        if s.get("area_m2") and s["room_id"] in rooms:
            got = rooms[s["room_id"]].area / 1e4
            ok = abs(got - s["area_m2"]) <= 0.02 * s["area_m2"]
            add(check="area", room=s["room_id"], name=s.get("name_he"), expected=s["area_m2"], got=round(got, 2), **{"pass": ok})
    # labels <-> rooms
    labelled = [s for s in seeds if not s.get("auto") and not s.get("merged_into") and not s.get("void_on_this_floor")]   # a label merged into a room (מעבר צר → the terrace) counts with it
    for s in labelled:
        ok = s["room_id"] in rooms and rooms[s["room_id"]].area > 0.5e4
        add(check="label_has_room", room=s["room_id"], name=s.get("name_he"), expected="one traced room", got="traced" if ok else "missing", **{"pass": ok})
        if not ok and s.get("dims_cm"):
            force.add(s["id"])
    # (T9, 2026-11-06) an UNLABELLED WALKABLE CONNECTOR: the drawing prints no label in it (no label point of any seed lies
    #    inside), it is walkable (inscribed width >= 80 cm, a door's width) and it joins >= 2 rooms, at least one through a
    #    drawn door: a passage the plan leaves unnamed (846: the lobby of the master suite — door from the living room, open to
    #    the closet corner and the bedroom). It counts like a door-split lobby; anything else unlabelled still fails.
    def connector(rid):
        s = by_id.get(rid)
        if not s or s.get("auto_reason") != "corridor":
            return None
        g = rooms[rid]
        if g.is_empty:
            return None
        for s2 in seeds:
            lp = s2.get("label_px")
            if lp and not s2.get("auto") and g.contains(Point(lp[0] / ppc, lp[1] / ppc)):
                return None                                       # a printed label lies in it: not unlabelled
        import numpy as _np
        import cv2 as _cv2
        x0, y0, x1, y1 = g.bounds
        m = _np.zeros((int(y1 - y0) + 3, int(x1 - x0) + 3), _np.uint8)   # 1 px = 1 cm
        _cv2.fillPoly(m, [_np.round(_np.array(g.exterior.coords) - [x0 - 1, y0 - 1]).astype(_np.int32)], 1)
        width = 2 * float(_cv2.distanceTransform(m, _cv2.DIST_L2, 5).max())
        via_door = {o for op in plan.get("openings", []) if rid in (op.get("rooms") or []) and op.get("kind") in ("door", "entry_door", "opening")
                    for o in op["rooms"] if o != rid and o in rooms}
        open_to = {o for o, h in rooms.items() if o != rid and not h.is_empty
                   and g.buffer(3).boundary.intersection(h.buffer(3)).length >= 60}      # touching across no wall over >= 60 cm
        joins = sorted(via_door | open_to)
        if width >= 80 and len(joins) >= 2 and via_door:
            return {"width_cm": round(width), "doors_to": sorted(via_door), "open_to": sorted(open_to - via_door)}
        return None
    conn = {rid: c for rid in rooms for c in [connector(rid)] if c}
    for rid in rooms:
        s = by_id.get(rid)
        split_ = next((r for r in plan["rooms"] if r["id"] == rid and r.get("auto_reason") == "door-split"), None)   # a hall split at a drawn door
        ok = split_ is not None or rid in conn or (s is not None and (not s.get("auto") or s.get("auto_reason") in ("stairs", "entrance-hall")))
        got_ = (s or {}).get("name_he") if not (s or {}).get("auto") else None
        got_ = got_ or ("door-split lobby" if split_ else f"unlabelled walkable connector {conn[rid]}" if rid in conn else "auto hall (no printed label)" if s else "none")
        add(check="room_has_label", room=rid, expected="a printed label, or a door-split lobby / an unlabelled walkable connector", got=got_, **{"pass": ok})
    n_found = sum(1 for rid in rooms if by_id.get(rid, {}).get("auto_reason") == "stairs")   # stairs found from the drawing
    n_found += sum(1 for r in plan["rooms"] if r.get("auto_reason") == "door-split")
    n_found += len(conn)
    add(check="room_count", expected=len(labelled) + n_found, got=len(rooms), **{"pass": len(rooms) == len(labelled) + n_found})
    # doors
    for k, a in enumerate(doors.get("arcs", [])):
        if a.get("ignored"):
            continue
        ok = bool(a.get("matched_opening") or a.get("added_opening"))
        add(check="door_arc", arc=k + 1, hinge_cm=[round(v / ppc) for v in a["hinge_px"]], expected="an opening between two rooms", got=a.get("matched_opening") or a.get("added_opening") or a.get("problem"), **{"pass": ok})
    # entrance
    ent_label = next((s for s in seeds if "כניסה" in (s.get("name_he") or "") or s.get("vlm_type") == "entrance"), None)
    if ent_label:
        e = (plan.get("plan_meta") or {}).get("entrance")
        add(check="entrance", expected="an opening on the building edge next to the entrance label", got=e, **{"pass": bool(e)})
    # windows
    panes = [Polygon(p["polygon_cm"]).buffer(0) for p in plan.get("panes", []) if len(p.get("polygon_cm", [])) >= 3]
    for k, g in enumerate(glazing.get("glazing", [])):
        c = Polygon([[x / ppc, y / ppc] for x, y in g["rect_px"]]).centroid
        ok = any(p.distance(c) <= 20 for p in panes)
        add(check="window", window=k + 1, centre_cm=[round(c.x), round(c.y)], expected="a pane", got="pane" if ok else "none", **{"pass": ok})
    if not glazing.get("glazing"):
        add(check="windows_traced", expected="glazing on the plan traced as panes", got=len(panes), **{"pass": len(panes) > 0})
    # wet rooms
    fx = plan.get("fixtures", [])
    for r in plan["rooms"]:
        need = WET.get(r.get("type"))
        if not need:
            continue
        have = sorted({f["kind"] for f in fx if f.get("room_id") == r["id"]} & need)
        add(check="wet_room_fixtures", room=r["id"], name=by_id.get(r["id"], {}).get("name_he"), expected=sorted(need), got=have, **{"pass": bool(have)})
    # --- round 4: shape, orthogonality, unlabelled space, the envelope, wet-room size (with or without the judge)
    import cv2
    import numpy as np
    seed_of = {s["room_id"]: s for s in seeds}
    rj = J("rooms.json", {})
    axis = float(rj.get("axis_deg", 0.0))
    bar_full = cv2.imread(os.path.join(d, "walls-only.png"), cv2.IMREAD_GRAYSCALE)   # walls only (no automatic door bars)
    if bar_full is None:
        bar_full = cv2.imread(os.path.join(d, "barrier.png"), cv2.IMREAD_GRAYSCALE)
    env_img = cv2.imread(os.path.join(d, "envelope.png"), cv2.IMREAD_GRAYSCALE)
    line_img = cv2.imread(os.path.join(d, "barrier.png"), cv2.IMREAD_GRAYSCALE)        # the drawing's lines (T8b)
    if line_img is not None:
        for n_ in ("glazing-pen.png", "windows-glass.png"):
            g_ = cv2.imread(os.path.join(d, n_), cv2.IMREAD_GRAYSCALE) if os.path.exists(os.path.join(d, n_)) else None
            if g_ is not None and g_.shape == line_img.shape:
                line_img = np.maximum(line_img, g_)
    line_dt = cv2.distanceTransform((line_img <= 127).astype(np.uint8), cv2.DIST_L2, 5) if line_img is not None else None
    for r in plan["rooms"]:
        g = rooms[r["id"]]
        s = seed_of.get(r["id"], {})
        name = s.get("name_he")
        # (a) shape: IoU with the printed rectangle (same centre and orientation as the traced room)
        if s.get("dims_cm") and not g.is_empty and not os.path.exists(pv_p):   # a PDF run is measured on its dimension lines instead
            mrr = g.minimum_rotated_rectangle
            xs_, ys_ = mrr.exterior.coords.xy
            e1 = (xs_[1] - xs_[0], ys_[1] - ys_[0]); e2 = (xs_[2] - xs_[1], ys_[2] - ys_[1])
            long_e = e1 if math.hypot(*e1) >= math.hypot(*e2) else e2
            th = math.atan2(long_e[1], long_e[0])
            L_, S_ = max(s["dims_cm"]), min(s["dims_cm"])
            cx_, cy_ = g.centroid.x, g.centroid.y
            u = (math.cos(th), math.sin(th)); v = (-math.sin(th), math.cos(th))
            pr = Polygon([(cx_ + a * L_ / 2 * u[0] + b * S_ / 2 * v[0], cy_ + a * L_ / 2 * u[1] + b * S_ / 2 * v[1]) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
            iou = g.intersection(pr).area / g.union(pr).area
            add(check="shape_iou", room=r["id"], name=name, expected=">= 0.85 with the printed rectangle", got=round(iou, 3), **{"pass": iou >= 0.85})
        # (b) orthogonality: no edge > 30 cm off the room's own axes unless the wall band along it is itself diagonal / curved.
        #    (T8, 2026-11-06) the axes are the ROOM's, not one global axis: a plan with two wings (846: 17.5° and 35°) has
        #    several principal directions. A room's axes = the directions (mod 90°) of its WALL-BACKED edges carrying >= 20 %
        #    of its wall-backed length, plus the plan axis. Only an edge the drawing's wall layer runs along can make an axis,
        #    so a diagonal cut through open floor never legalises itself. The 5° / 30 cm thresholds are unchanged.
        loop = r["loop"]

        def wall_share(x1, y1, x2, y2, Lc):
            nx_, ny_ = -(y2 - y1) / Lc, (x2 - x1) / Lc
            hits = tot = 0
            if bar_full is not None:
                for tt in np.linspace(0.15, 0.85, 7):
                    px_, py_ = x1 + (x2 - x1) * tt, y1 + (y2 - y1) * tt
                    for sgn in (1, -1):
                        for dcm in (8, 14, 20):
                            X, Y = int((px_ + sgn * nx_ * dcm) * ppc), int((py_ + sgn * ny_ * dcm) * ppc)
                            if 0 <= Y < bar_full.shape[0] and 0 <= X < bar_full.shape[1]:
                                tot += 1
                                hits += bar_full[Y, X] > 127
            return hits / tot if tot else 0.0

        edges = []
        for i in range(len(loop)):
            (x1, y1), (x2, y2) = loop[i], loop[(i + 1) % len(loop)]
            Lc = math.hypot(x2 - x1, y2 - y1)
            if Lc <= 30:
                continue
            edges.append((x1, y1, x2, y2, Lc, math.degrees(math.atan2(y2 - y1, x2 - x1)) % 90, wall_share(x1, y1, x2, y2, Lc)))
        hist = np.zeros(90)
        for *_, Lc, a90, ws in edges:
            if ws >= 0.3:
                hist[int(round(a90)) % 90] += Lc
        room_axes = [axis % 90, (-axis) % 90]
        if hist.sum() > 0:
            sm = sum(np.roll(hist, k) for k in range(-2, 3))          # ±2° bins (mod 90)
            while sm.max() >= 0.2 * hist.sum():
                k0 = int(sm.argmax())
                ks = [(k0 + k) % 90 for k in range(-2, 3)]
                w_ = hist[ks]
                room_axes.append((k0 + float(np.dot(w_, range(-2, 3))) / max(1e-9, w_.sum())) % 90)
                for k in range(-5, 6):
                    sm[(k0 + k) % 90] = 0
        off_ax = lambda a90: min(min(abs(a90 - ax_), 90 - abs(a90 - ax_)) for ax_ in room_axes)

        def along_drawn_line(x1, y1, x2, y2):
            # (T8b) the edge follows a DRAWN line (curved glass, a parapet, a slab edge: thin lines the wall band misses):
            #   every point from 10 % to 90 % of it within 5 cm of a line pixel of the drawing (barrier.png ∪ the glazing layers)
            if line_dt is None:
                return False
            for tt in np.linspace(0.1, 0.9, 9):
                X, Y = int((x1 + (x2 - x1) * tt) * ppc), int((y1 + (y2 - y1) * tt) * ppc)
                if not (0 <= Y < line_dt.shape[0] and 0 <= X < line_dt.shape[1]) or line_dt[Y, X] / ppc > 5:
                    return False
            return True
        bad = [round(Lc) for x1, y1, x2, y2, Lc, a90, ws in edges if off_ax(a90) > 5 and ws < 0.3 and not along_drawn_line(x1, y1, x2, y2)]
        extra = sorted({round(float(a), 1) for a in room_axes[2:]})
        add(check="orthogonal", room=r["id"], name=name, expected="no edge > 30 cm off the room's own axes (wall-backed directions"
            + (f" {extra}°" if extra else "") + f", plan axis {axis:g}°) unless along a diagonal/curved wall", got=bad or "ok", **{"pass": not bad})
        # (c) unlabelled space
        if s.get("auto") and s.get("auto_reason") not in ("entrance-hall", "stairs"):
            a_m2 = g.area / 1e4
            # (T9b, 2026-11-06, the coordinator's ruling for Maale's upstairs hallway) a T9 walkable connector that is a
            #    PASSAGE (inscribed width <= 180 cm — 846's lobby 158, Maale's landing hall) is unlabelled by the plan's own
            #    choice, not leftover space; anything wider or not a connector keeps the 3 m² bar
            c_ = conn.get(r["id"])
            if c_ and c_["width_cm"] <= 180:
                add(check="unlabelled_room", room=r["id"], expected="<= 3 m², or a walkable connector <= 180 cm wide",
                    got=f"{a_m2:.2f} m², connector {c_['width_cm']} cm wide", **{"pass": True})
            else:
                add(check="unlabelled_room", room=r["id"], expected="<= 3 m², or a walkable connector <= 180 cm wide", got=round(a_m2, 2), **{"pass": a_m2 <= 3})
        # (d) indoor rooms inside the envelope
        if not r.get("is_outdoor") and env_img is not None and not g.is_empty:
            sc = env_img.shape[1] / (bar_full.shape[1] if bar_full is not None else env_img.shape[1])
            m = np.zeros(env_img.shape, np.uint8)
            cv2.fillPoly(m, [np.round(np.array(loop) * ppc * sc).astype(np.int32)], 1)
            out_frac = float(((m > 0) & (env_img == 0)).sum()) / max(1, int(m.sum()))
            add(check="inside_envelope", room=r["id"], name=name, expected="<= 2 % outside", got=f"{out_frac * 100:.1f} %", **{"pass": out_frac <= 0.02})
        # (f) a labelled room lies where its label is printed (within 50 cm; an entrance label moved inside is taken at its new point)
        if s and not s.get("auto") and not g.is_empty:
            lp = s.get("at_px") if s.get("moved_inside") else (s.get("label_px") or s.get("at_px"))
            if lp:
                from shapely.geometry import Point as _P
                dist_cm = g.distance(_P(lp[0] / ppc, lp[1] / ppc))
                lim_ = 150 if s.get("moved_inside") else 50
                add(check="label_in_room", room=r["id"], name=name, expected=f"the printed label inside its room (<= {lim_} cm)", got=f"{dist_cm:.0f} cm away", **{"pass": dist_cm <= lim_})
        # (e) a bath / WC is at least 1.5 m²
        if r.get("type") == "bathroom":
            add(check="wet_room_area", room=r["id"], name=name, expected=">= 1.5 m²", got=round(g.area / 1e4, 2), **{"pass": g.area / 1e4 >= 1.5})
    fails = [c for c in checks if not c["pass"]]
    out = {"status": "PASS" if not fails else "FAIL", "n_checks": len(checks), "n_failed": len(fails), "checks": checks,
           "failures": fails, "corrections": {"force_rect": sorted(force)}}
    json.dump(out, open(os.path.join(d, "trace-check.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"trace_check: {out['status']} — {len(checks) - len(fails)}/{len(checks)} checks pass; corrections: force_rect {sorted(force)}")


if __name__ == "__main__":
    main()

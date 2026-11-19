#!/usr/bin/env python
"""auto_finalize.py <plan.general.json> <vlm.json> <seeds.json> <barrier.png> <px_per_cm> <crop.png> <overlay.png>

auto-trace's last step: camera points at each room's pole of inaccessibility (not on the label), fixtures from the vision
model's boxes turned into rectangles aligned with the plan's dominant wall direction (sizes clamped to sane ranges per
kind), the room names from the reading, and an approval overlay (the trace in colour over the sales plan, numbered rooms,
fixtures in red) — the image the developer approves in the portal. Writes the plan in place.
"""
import json
import math
import re
import os
import sys

import cv2
import sys as _s, os as _o
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import numpy as np
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import polylabel, unary_union

SIZE = {  # kind: (min, max) for each side in cm, height, z
    "counter": ((60, 600), (55, 70), 90), "tall_unit": ((50, 250), (55, 70), 220), "hob": ((55, 90), (45, 60), 92),
    "sink": ((50, 120), (40, 60), 92), "island": ((90, 300), (60, 120), 90), "wardrobe": ((60, 400), (55, 65), 240),
    "shower": ((70, 220), (70, 120), 10), "bathtub": ((150, 190), (70, 85), 55), "wc": ((50, 70), (35, 45), 45),
    "vanity": ((50, 160), (40, 60), 85), "washer": ((55, 65), (55, 65), 85), "table": ((70, 240), (70, 120), 75),
    "sofa": ((80, 300), (80, 100), 75), "bed": ((180, 220), (90, 200), 55), "tv_unit": ((120, 320), (35, 50), 50),
}


def dominant_angle(bar):
    edges = cv2.Canny((bar * 255).astype(np.uint8), 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 360, 80, minLineLength=120, maxLineGap=6)
    if lines is None:
        return 0.0
    h = np.zeros(180)
    for x1, y1, x2, y2 in lines.reshape(-1, 4):
        a = math.degrees(math.atan2(y2 - y1, x2 - x1)) % 90
        h[int(a * 2) % 180] += math.hypot(x2 - x1, y2 - y1)
    return float(np.argmax(np.convolve(np.r_[h[-3:], h, h[:3]], np.ones(7), "valid")) / 2.0)


def main():
    plan_p, vlm_p, seeds_p, bar_p, ppc_s, crop_p, ov_p = sys.argv[1:8]
    ppc = float(ppc_s)
    plan = json.load(open(plan_p, encoding="utf-8"))
    vlm = json.load(open(vlm_p, encoding="utf-8"))
    bar = cv2.imread(bar_p, cv2.IMREAD_GRAYSCALE) > 127
    ang = dominant_angle(bar)
    degenerate = [r["id"] for r in plan["rooms"] if len(r.get("loop", [])) < 3]
    plan["rooms"] = [r for r in plan["rooms"] if len(r.get("loop", [])) >= 3]
    rooms = {r["id"]: Polygon(r["loop"]).buffer(0) for r in plan["rooms"]}
    degenerate += [rid for rid, g in rooms.items() if g.is_empty or g.area < 100]
    plan["rooms"] = [r for r in plan["rooms"] if r["id"] not in degenerate]
    rooms = {rid: g for rid, g in rooms.items() if rid not in degenerate}
    # cameras: the pole of inaccessibility of each room (≥ 60 cm from every wall where the room allows it)
    for cp in plan.get("camera_points", []):
        p = rooms.get(cp.get("room_id"))
        if p is None or p.is_empty:
            continue
        g = p if p.geom_type == "Polygon" else max(p.geoms, key=lambda q: q.area)
        q = polylabel(g, tolerance=2.0)
        cp["x"], cp["y"] = round(q.x, 1), round(q.y, 1)
        cp["note"] = "auto-trace: the room's pole of inaccessibility"
    # fixtures from the reading's boxes
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    vx, vy = -uy, ux
    fixtures = []
    for k, f in enumerate(vlm.get("fixtures", [])):
        kind = f.get("kind")
        if kind not in SIZE or not f.get("box_px"):
            continue
        x0, y0, x1, y1 = [v / ppc for v in f["box_px"]]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        su = [(x - cx) * ux + (y - cy) * uy for x, y in corners]
        sv = [(x - cx) * vx + (y - cy) * vy for x, y in corners]
        # an axis-aligned box of a rotated object over-states both sides; deflate by the rotation's spread
        cosr = abs(math.cos(a)) + abs(math.sin(a))
        L, D = (max(su) - min(su)) / cosr, (max(sv) - min(sv)) / cosr
        (lo1, hi1), (lo2, hi2), h = SIZE[kind]
        if D > L:
            L, D = D, L
            ux_, uy_, vx_, vy_ = vx, vy, ux, uy
        else:
            ux_, uy_, vx_, vy_ = ux, uy, vx, vy
        L = min(max(L, lo1), hi1); D = min(max(D, lo2), hi2)
        poly = [[round(cx + sx * L / 2 * ux_ + sy * D / 2 * vx_, 1), round(cy + sx * L / 2 * uy_ + sy * D / 2 * vy_, 1)] for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        room = next((rid for rid, p in rooms.items() if p.contains(Point(cx, cy))), None)
        fixtures.append({"id": f"fx-{k + 1}-{kind}", "room_id": room, "kind": kind, "polygon_cm": poly, "z_cm": 0, "height_cm": h,
                         "centre_cm": [round(cx, 1), round(cy, 1)], "angle_deg": round(math.degrees(math.atan2(uy_, ux_)), 1),
                         "size_cm": [round(L), round(D)], "source": "auto-trace: the vision model's box on the sales plan, aligned to the walls",
                         "note": f.get("label") or ""})
    # (round 16) a CAD PDF's plumbing/casework layer draws the kitchen run, the tall units and the sinks exactly: those
    # replace the vision model's boxes of the same kinds
    pv_fx = os.path.join(os.path.dirname(plan_p), "pdf-vectors.json")
    pp = json.load(open(pv_fx, encoding="utf-8")).get("plumbing_polys_px", []) if os.path.exists(pv_fx) else []
    if pp:
        rooms_ = {r["id"]: Polygon(r["loop"]).buffer(0) for r in plan["rooms"]}
        room_of = lambda x_, y_: next((rid for rid, g in rooms_.items() if g.buffer(40).contains(Point(x_, y_))), None)
        segs = []
        for poly in pp:
            for i_ in range(len(poly) - 1):
                (ax_, ay_), (bx_, by_) = poly[i_], poly[i_ + 1]
                L_ = math.hypot(bx_ - ax_, by_ - ay_) / ppc
                if L_ >= 100:
                    key = tuple(sorted([(round(ax_), round(ay_)), (round(bx_), round(by_))]))
                    if key not in {s_[4] for s_ in segs}:
                        segs.append((ax_ / ppc, ay_ / ppc, bx_ / ppc, by_ / ppc, key))
        drawn = []
        # (round 23) hob squares FIRST, by their burner circles (fork F's casework_symbols.find_symbols, given the whole sheet as
        #    the counter so its on-counter test passes): a hob is never a tall unit, and never cuts the counter it sits on
        hob_shapes = []
        try:
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            import casework_symbols as _cs0
            big_ = [[-1e5, -1e5], [1e5, -1e5], [1e5, 1e5], [-1e5, 1e5]]
            hob_shapes = [h_["shape"] for h_ in _cs0.find_symbols(pp, ppc, [{"kind": "counter", "polygon_cm": big_}])[0]]
        except Exception:
            hob_shapes = []
        # tall units and sinks: closed shapes
        for poly in pp:
            if len(poly) < 4:
                continue
            P_ = Polygon([(x_ / ppc, y_ / ppc) for x_, y_ in poly]).buffer(0)
            if P_.is_empty or P_.area < 400:
                continue
            mrr = P_.minimum_rotated_rectangle; xs_, ys_ = mrr.exterior.coords.xy
            sd = sorted([math.hypot(xs_[1] - xs_[0], ys_[1] - ys_[0]), math.hypot(xs_[2] - xs_[1], ys_[2] - ys_[1])], reverse=True)
            kind = "tall_unit" if 50 <= sd[1] and sd[0] <= 95 and sd[1] >= 50 else "sink" if 30 <= sd[1] <= 60 and sd[0] <= 90 else None
            if kind and any(P_.intersection(hP_).area >= 0.5 * min(P_.area, hP_.area) for hP_ in hob_shapes):
                kind = "hob"
            if not kind:
                continue
            c_ = P_.centroid; rid = room_of(c_.x, c_.y)
            if not rid:
                continue
            drawn.append({"kind": kind, "room_id": rid, "polygon_cm": [[round(x_, 1), round(y_, 1)] for x_, y_ in list(mrr.exterior.coords)[:4]],
                          "centre_cm": [round(c_.x, 1), round(c_.y, 1)], "size_cm": [round(sd[0]), round(sd[1])]})
        # counters: a long front line and a parallel back line 50..75 cm behind it -> the band over the front line's span
        used_s = set()
        for i_, f_ in enumerate(segs):
            ax_, ay_, bx_, by_, _ = f_
            L_ = math.hypot(bx_ - ax_, by_ - ay_); ux_, uy_ = (bx_ - ax_) / L_, (by_ - ay_) / L_; nx_, ny_ = -uy_, ux_
            for j_, b_ in enumerate(segs):
                if j_ == i_:
                    continue
                cx_, cy_, dx_, dy_, _ = b_
                Lb = math.hypot(dx_ - cx_, dy_ - cy_)
                if abs(((dx_ - cx_) / Lb) * nx_ + ((dy_ - cy_) / Lb) * ny_) > math.sin(math.radians(2)):
                    continue
                sep = ((cx_ - ax_) * nx_ + (cy_ - ay_) * ny_)
                if not (50 <= abs(sep) <= 75) or Lb < L_:
                    continue                      # the back line is the longer one (it runs into the corner / the wall)
                t0, t1 = 0.0, L_
                tb = sorted([(cx_ - ax_) * ux_ + (cy_ - ay_) * uy_, (dx_ - ax_) * ux_ + (dy_ - ay_) * uy_])
                lo_, hi_ = max(t0, tb[0]), min(t1, tb[1])
                if hi_ - lo_ < 80 or (i_, j_) in used_s:
                    continue
                used_s.add((i_, j_))
                band = Polygon([(ax_ + ux_ * lo_, ay_ + uy_ * lo_), (ax_ + ux_ * hi_, ay_ + uy_ * hi_),
                                (ax_ + ux_ * hi_ + nx_ * sep, ay_ + uy_ * hi_ + ny_ * sep), (ax_ + ux_ * lo_ + nx_ * sep, ay_ + uy_ * lo_ + ny_ * sep)])
                for t_u in [d_ for d_ in drawn if d_["kind"] == "tall_unit"]:
                    tu = Polygon(t_u["polygon_cm"])
                    if band.intersects(tu) and band.intersection(tu).area > 0.3 * tu.area:
                        band = band.difference(tu.buffer(1)).buffer(0)
                        if band.geom_type != "Polygon":
                            band = max(band.geoms, key=lambda g_: g_.area)
                c_ = band.centroid; rid = room_of(c_.x, c_.y)
                if not rid or band.area < 4000:
                    continue
                mrr = band.minimum_rotated_rectangle; xs_, ys_ = mrr.exterior.coords.xy
                sd = sorted([math.hypot(xs_[1] - xs_[0], ys_[1] - ys_[0]), math.hypot(xs_[2] - xs_[1], ys_[2] - ys_[1])], reverse=True)
                drawn.append({"kind": "counter", "room_id": rid, "polygon_cm": [[round(x_, 1), round(y_, 1)] for x_, y_ in list(mrr.exterior.coords)[:4]],
                              "centre_cm": [round(c_.x, 1), round(c_.y, 1)], "size_cm": [round(sd[0]), round(sd[1])]})
        # (round 23) a counter run follows the DRAWING's casework layer at both ends:
        #    - it ends at a tall unit set beside it (overlapping its lateral band by >= 50 % of the unit's depth, within 15 cm);
        #    - it runs on toward a wall up to 80 cm, but only as far as the casework layer draws the counter there (a casework
        #      line parallel to the run, inside its lateral band, covering the gap) — the drawing decides, not a fixed rule
        panels_new = []
        all_segs = []
        for poly in pp:
            for i_ in range(len(poly) - 1):
                (ax_, ay_), (bx_, by_) = poly[i_], poly[i_ + 1]
                if math.hypot(bx_ - ax_, by_ - ay_) / ppc >= 10:
                    all_segs.append((ax_ / ppc, ay_ / ppc, bx_ / ppc, by_ / ppc))
        for d_ in drawn:
            if d_["kind"] != "counter":
                continue
            Pc = Polygon(d_["polygon_cm"]).buffer(0)
            pts_c = list(Pc.minimum_rotated_rectangle.exterior.coords)[:4]
            e1c = (pts_c[1][0] - pts_c[0][0], pts_c[1][1] - pts_c[0][1]); e2c = (pts_c[2][0] - pts_c[1][0], pts_c[2][1] - pts_c[1][1])
            uc = e1c if math.hypot(*e1c) >= math.hypot(*e2c) else e2c; nu = math.hypot(*uc) or 1; uc = (uc[0] / nu, uc[1] / nu); vc = (-uc[1], uc[0])
            T = lambda x_, y_: (x_ * uc[0] + y_ * uc[1], x_ * vc[0] + y_ * vc[1])
            tt = [T(*q) for q in Pc.exterior.coords]
            t0, t1 = min(q[0] for q in tt), max(q[0] for q in tt); n0, n1 = min(q[1] for q in tt), max(q[1] for q in tt)
            changed = False
            t0_orig, t1_orig = t0, t1
            # (a) a tall unit beside the run ends it
            for tu_ in [x_ for x_ in drawn if x_["kind"] == "tall_unit"]:
                tq = [T(*q) for q in tu_["polygon_cm"]]
                a0, a1 = min(q[0] for q in tq), max(q[0] for q in tq); m0, m1 = min(q[1] for q in tq), max(q[1] for q in tq)
                lat = min(n1, m1 + 15) - max(n0, m0 - 15)
                if lat < 0.5 * (m1 - m0) or a1 <= t0 or a0 >= t1:
                    continue
                if (a0 + a1) / 2 >= (t0 + t1) / 2:   # the unit is at the run's far end: the run stops at its near face
                    if a0 - t0 >= 80: t1 = min(t1, a0); changed = True; span_p = (a0, min(a1, t1_orig))
                else:
                    if t1 - a1 >= 80: t0 = max(t0, a1); changed = True; span_p = (max(a0, t0_orig), a1)
                if changed and span_p[1] - span_p[0] > 5:
                    # (round 23) the run's band alongside the tall unit (counter depth beyond the unit's own depth: its side panel
                    #    / front line drawn on the casework layer) is casework, a 'panel', not floor
                    qb = [(uc[0] * t_ + vc[0] * n_, uc[1] * t_ + vc[1] * n_) for t_, n_ in ((span_p[0], n0), (span_p[1], n0), (span_p[1], n1), (span_p[0], n1))]
                    pb = Polygon(qb).buffer(0).difference(Polygon(tu_["polygon_cm"]).buffer(0))
                    pb = pb if pb.geom_type == "Polygon" else (max(pb.geoms, key=lambda g_: g_.area) if not pb.is_empty else pb)
                    if not pb.is_empty and pb.area >= 200:
                        mr_ = pb.minimum_rotated_rectangle; cpb = pb.centroid
                        panels_new.append({"kind": "panel", "room_id": d_["room_id"], "polygon_cm": [[round(x_, 1), round(y_, 1)] for x_, y_ in list(mr_.exterior.coords)[:4]],
                                           "centre_cm": [round(cpb.x, 1), round(cpb.y, 1)], "size_cm": [round(span_p[1] - span_p[0]), round(pb.area / max(1, span_p[1] - span_p[0]))]})
            # (b) toward a wall within 80 cm, only where the casework layer draws the counter
            rid_c = d_["room_id"]; Rp = rooms_.get(rid_c)
            if Rp is not None:
                rq = [T(*q) for q in Rp.exterior.coords]
                for side in (-1, 1):
                    end = t0 if side < 0 else t1
                    # the room's boundary along the run, at the band's middle
                    mid_n = (n0 + n1) / 2
                    from shapely.geometry import LineString as _LSc
                    # the first wall or window the drawing draws along the run, from its end (walls-only + the window layer)
                    if "_wall_px" not in dir():
                        _wp = os.path.join(os.path.dirname(plan_p), "walls-only.png"); _wv = os.path.join(os.path.dirname(plan_p), "windows-vector.png")
                        _wall_px = (cv2.imread(_wp, cv2.IMREAD_GRAYSCALE) > 127) if os.path.exists(_wp) else None
                        if _wall_px is not None and os.path.exists(_wv):
                            _wvm = cv2.imread(_wv, cv2.IMREAD_GRAYSCALE)
                            if _wvm is not None and _wvm.shape == _wall_px.shape:
                                _wall_px = _wall_px | (_wvm > 127)
                    if _wall_px is None:
                        continue
                    wall_t = None
                    for st_ in range(1, 61):
                        tq_ = end + side * st_ * 2.0
                        xq_, yq_ = uc[0] * tq_ + vc[0] * mid_n, uc[1] * tq_ + vc[1] * mid_n
                        Xq, Yq = int(round(xq_ * ppc)), int(round(yq_ * ppc))
                        if not (0 <= Yq < _wall_px.shape[0] and 0 <= Xq < _wall_px.shape[1]):
                            break
                        if _wall_px[Yq, Xq]:
                            wall_t = tq_; break
                    if wall_t is None:
                        continue
                    gap = (wall_t - end) * side
                    if not (5 < gap <= 80):
                        continue
                    lo_g, hi_g = sorted([end, wall_t]); cov = 0.0
                    for (sx0, sy0, sx1, sy1) in all_segs:
                        q0 = T(sx0, sy0); q1 = T(sx1, sy1)
                        Ls = math.hypot(q1[0] - q0[0], q1[1] - q0[1])
                        if Ls == 0 or abs(q1[1] - q0[1]) > 0.05 * Ls:
                            continue                                   # not parallel to the run
                        if not (n0 - 5 <= (q0[1] + q1[1]) / 2 <= n1 + 5):
                            continue                                   # not inside the run's band
                        cov = max(cov, min(hi_g, max(q0[0], q1[0])) - max(lo_g, min(q0[0], q1[0])))
                    if cov >= 0.6 * gap:
                        if side < 0: t0 = wall_t
                        else: t1 = wall_t
                        changed = True
            if changed:
                quad = [(uc[0] * t_ + vc[0] * n_, uc[1] * t_ + vc[1] * n_) for t_, n_ in ((t0, n0), (t1, n0), (t1, n1), (t0, n1))]
                Pn = Polygon(quad); c_ = Pn.centroid
                d_["polygon_cm"] = [[round(x_, 1), round(y_, 1)] for x_, y_ in quad]
                d_["centre_cm"] = [round(c_.x, 1), round(c_.y, 1)]; d_["size_cm"] = [round(t1 - t0), round(n1 - n0)]
        drawn += panels_new
        # (round 18) shower trays: in a bathroom, the plumbing cluster 100-230 x 70-100 cm (the outer outline of a nested pair);
        #    a "counter" found in a bathroom was that tray's two long lines and is dropped
        btype = {r["id"]: r.get("type") for r in plan["rooms"]}
        drawn = [d_ for d_ in drawn if not (d_["kind"] == "counter" and btype.get(d_["room_id"]) == "bathroom")]
        def clusters_(polys, k_px):
            m_ = np.zeros(grey_shape, np.uint8)
            for q in polys:
                cv2.polylines(m_, [np.round(np.array(q)).astype(np.int32)], False, 255, 2)
            n_c, l_c, st_c, _ = cv2.connectedComponentsWithStats(cv2.dilate(m_, np.ones((k_px, k_px), np.uint8)), connectivity=8)
            out_ = []
            for i_c in range(1, n_c):
                ys_c, xs_c = np.nonzero(l_c == i_c)
                if len(xs_c) < 50:
                    continue
                rect_ = cv2.minAreaRect(np.stack([xs_c, ys_c], 1).astype(np.float32))
                box_ = cv2.boxPoints(rect_) / ppc
                out_.append((Polygon(box_.tolist()).buffer(0), (l_c == i_c), sorted([rect_[1][0] / ppc, rect_[1][1] / ppc], reverse=True)))
            return out_
        grey_shape = cv2.imread(os.path.join(os.path.dirname(plan_p), "crop.png"), cv2.IMREAD_GRAYSCALE).shape
        trays = []
        for P_, m_, sd in clusters_(pp, 5):
            c_ = P_.centroid; rid = room_of(c_.x, c_.y)
            if rid and btype.get(rid) == "bathroom" and 100 <= sd[0] <= 230 and 70 <= sd[1] <= 100:
                if any(P_.within(t_[0].buffer(2)) for t_ in trays):
                    continue
                trays = [t_ for t_ in trays if not t_[0].within(P_.buffer(2))]
                trays.append((P_, rid, sd))
        for P_, rid, sd in trays:
            # a tray never runs into the walls: the drawn outline is clipped to its room (846: 144 -> the room's 140)
            Pc = P_.intersection(rooms_[rid]).buffer(0)
            if not Pc.is_empty and Pc.area >= 0.7 * P_.area:
                Pc = Pc if Pc.geom_type == "Polygon" else max(Pc.geoms, key=lambda g_: g_.area)
                mr_ = Pc.minimum_rotated_rectangle; xs_m, ys_m = mr_.exterior.coords.xy
                P_ = mr_; sd = sorted([math.hypot(xs_m[1] - xs_m[0], ys_m[1] - ys_m[0]), math.hypot(xs_m[2] - xs_m[1], ys_m[2] - ys_m[1])], reverse=True)
            # a tray whose ends lie within 10 cm of the room's walls runs wall to wall: its ends go onto the walls' faces
            pts_t = list(P_.exterior.coords)[:4]
            e_a = (pts_t[1][0] - pts_t[0][0], pts_t[1][1] - pts_t[0][1]); e_b = (pts_t[2][0] - pts_t[1][0], pts_t[2][1] - pts_t[1][1])
            uL = e_a if math.hypot(*e_a) >= math.hypot(*e_b) else e_b; nL = math.hypot(*uL) or 1; uL = (uL[0] / nL, uL[1] / nL)
            cc = P_.centroid
            from shapely.geometry import LineString as _LS2
            chord = _LS2([(cc.x - uL[0] * 600, cc.y - uL[1] * 600), (cc.x + uL[0] * 600, cc.y + uL[1] * 600)]).intersection(rooms_[rid])
            if not chord.is_empty and chord.geom_type != "LineString":      # a room with a notch: the part through the tray
                parts_c = [g_ for g_ in getattr(chord, "geoms", []) if g_.geom_type == "LineString"]
                chord = min(parts_c, key=lambda g_: g_.distance(cc)) if parts_c else chord
            if not chord.is_empty and chord.geom_type == "LineString":
                tw = sorted(((x_ - cc.x) * uL[0] + (y_ - cc.y) * uL[1]) for x_, y_ in chord.coords)
                tt = [((x_ - cc.x) * uL[0] + (y_ - cc.y) * uL[1]) for x_, y_ in pts_t]
                lo_t, hi_t = min(tt), max(tt)
                if abs(lo_t - tw[0]) <= 10 and abs(hi_t - tw[-1]) <= 10:
                    new_pts = []
                    for x_, y_ in pts_t:
                        t_ = (x_ - cc.x) * uL[0] + (y_ - cc.y) * uL[1]
                        t_n = tw[0] if abs(t_ - lo_t) < abs(t_ - hi_t) else tw[-1]
                        new_pts.append((x_ + (t_n - t_) * uL[0], y_ + (t_n - t_) * uL[1]))
                    P_ = Polygon(new_pts); sd = [round(tw[-1] - tw[0], 1), sd[1]]
            c_ = P_.centroid
            drawn.append({"kind": "shower", "room_id": rid, "polygon_cm": [[round(x_, 1), round(y_, 1)] for x_, y_ in list(P_.exterior.coords)[:4]],
                          "centre_cm": [round(c_.x, 1), round(c_.y, 1)], "size_cm": [round(sd[0]), round(sd[1])]})
        # (round 18) closet runs: the closets are HATCHED on the furniture layer (846: short marks every ~10 cm). The hatch,
        #    closed over 25 cm, is the closet area; a printed dimension drawn over it gives the run between its own ticks, and the
        #    hatch's extent across the line (40-80 cm) its depth
        fp = json.load(open(pv_fx, encoding="utf-8")).get("furniture_polys_px", [])
        if fp:
            short_ = [q for q in fp if len(q) >= 2 and max(math.hypot(q[i_ + 1][0] - q[i_][0], q[i_ + 1][1] - q[i_][1]) for i_ in range(len(q) - 1)) / ppc <= 15]
            hm = np.zeros(grey_shape, np.uint8)
            for q in short_:
                cv2.polylines(hm, [np.round(np.array(q)).astype(np.int32)], False, 255, 2)
            k12 = int(25 * ppc) | 1
            hm = cv2.morphologyEx(hm, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k12, k12)))
            hm = cv2.morphologyEx(hm, cv2.MORPH_OPEN, np.ones((int(10 * ppc) | 1, int(10 * ppc) | 1), np.uint8)) > 0   # a hatched area, not a lone mark
            import dim_chains as _dc2
            for c_l in _dc2.chains(json.load(open(pv_fx, encoding="utf-8")).get("dimension_segments_px", []), ppc):
                if c_l.get("n_ticks", 2) >= 3 and not c_l.get("part"):
                    continue
                (ax_, ay_), (bx_, by_) = c_l["a"], c_l["b"]
                L_ = math.hypot(bx_ - ax_, by_ - ay_)
                if L_ < 60 * ppc:
                    continue
                ux_, uy_ = (bx_ - ax_) / L_, (by_ - ay_) / L_; nx_, ny_ = -uy_, ux_
                mx_, my_ = (ax_ + bx_) / 2, (ay_ + by_) / 2
                if not (0 <= int(my_) < hm.shape[0] and 0 <= int(mx_) < hm.shape[1]) or not hm[int(my_), int(mx_)]:
                    continue
                ext = []                          # the hatch run across the line at three stations
                for t_ in (0.25, 0.5, 0.75):
                    px_, py_ = ax_ + ux_ * L_ * t_, ay_ + uy_ * L_ * t_
                    lo_n = hi_n = 0.0
                    while lo_n > -120 * ppc and 0 <= int(py_ + ny_ * (lo_n - 1)) < hm.shape[0] and 0 <= int(px_ + nx_ * (lo_n - 1)) < hm.shape[1] and hm[int(py_ + ny_ * (lo_n - 1)), int(px_ + nx_ * (lo_n - 1))]:
                        lo_n -= 1
                    while hi_n < 120 * ppc and 0 <= int(py_ + ny_ * (hi_n + 1)) < hm.shape[0] and 0 <= int(px_ + nx_ * (hi_n + 1)) < hm.shape[1] and hm[int(py_ + ny_ * (hi_n + 1)), int(px_ + nx_ * (hi_n + 1))]:
                        hi_n += 1
                    ext.append((lo_n, hi_n))
                lo_n = float(np.median([e_[0] for e_ in ext])); hi_n = float(np.median([e_[1] for e_ in ext]))
                depth = (hi_n - lo_n) / ppc
                if not (40 <= depth <= 80):
                    continue
                ins = 0.5 * ppc                   # 0.5 cm off the wall faces: the dimension's ends land on the walls (the room's row),
                ax_, ay_, bx_, by_ = ax_ + ux_ * ins, ay_ + uy_ * ins, bx_ - ux_ * ins, by_ - uy_ * ins   # the run still spans it
                cs = [(ax_ + nx_ * lo_n, ay_ + ny_ * lo_n), (bx_ + nx_ * lo_n, by_ + ny_ * lo_n), (bx_ + nx_ * hi_n, by_ + ny_ * hi_n), (ax_ + nx_ * hi_n, ay_ + ny_ * hi_n)]
                P_ = Polygon([(x_ / ppc, y_ / ppc) for x_, y_ in cs]); c_ = P_.centroid; rid = room_of(c_.x, c_.y)
                if not rid:
                    continue
                drawn.append({"kind": "wardrobe", "room_id": rid, "polygon_cm": [[round(x_, 1), round(y_, 1)] for x_, y_ in P_.exterior.coords[:4]],
                              "centre_cm": [round(c_.x, 1), round(c_.y, 1)], "size_cm": [round(c_l["len_cm"]), round(depth)]})
        # (round 23) the hob and the sink by their SYMBOLS — fork F's shared reader (casework_symbols.find_symbols, project-runner
        #    e98ea47, copied byte-identical): a 45-95 cm square holding >= 3 burner circles is the hob, not a tall unit (846:
        #    fx-drawn-7, 60 x 60 with four burners, was a tall column on the portal); drain / tap holes are the sink
        try:
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            import casework_symbols as _cs
            hobs_, sinks_ = _cs.find_symbols(pp, ppc, [d_ for d_ in drawn if d_["kind"] == "counter"])
            for h_ in hobs_:
                hP = h_["shape"]
                for d_ in drawn:
                    if d_["kind"] in ("tall_unit", "sink"):
                        dP = Polygon(d_["polygon_cm"]).buffer(0)
                        if not dP.is_empty and dP.intersection(hP).area >= 0.5 * min(dP.area, hP.area):
                            d_["kind"] = "hob"; d_["note"] = f"hob: {h_['burners']} burner circles (casework_symbols)"
                if not any(d_["kind"] == "hob" and Polygon(d_["polygon_cm"]).buffer(0).intersects(hP) for d_ in drawn):
                    c_ = hP.centroid; mr_ = hP.minimum_rotated_rectangle
                    drawn.append({"kind": "hob", "room_id": room_of(c_.x, c_.y), "polygon_cm": [[round(x_, 1), round(y_, 1)] for x_, y_ in list(mr_.exterior.coords)[:4]],
                                  "centre_cm": [round(h_["centre"][0], 1), round(h_["centre"][1], 1)], "size_cm": [round(v) for v in h_["size_cm"]]})
            plan.setdefault("plan_meta", {})["casework_symbols"] = {"hobs": [[round(v, 1) for v in h_["centre"]] for h_ in hobs_],
                                                                    "sinks": [[round(v, 1) for v in k_["centre"]] for k_ in sinks_], "reader": "casework_symbols.py (fork F, e98ea47)"}
        except Exception as e_:
            plan.setdefault("plan_meta", {})["casework_symbols_error"] = str(e_)[:200]
        if drawn:
            # (T21, 2026-11-06) one drawn shape, one fixture: the casework layer can carry a shape twice (846: two identical
            #    60 x 60 tall units at the laundry niche, 156,1207); a second fixture of the same kind covering >= 90 % of
            #    an earlier one (IoU) is the same shape
            kept_, dup_ = [], []
            for d_ in drawn:
                dP = Polygon(d_["polygon_cm"]).buffer(0)
                if any(k_["kind"] == d_["kind"] and not dP.is_empty and
                       dP.intersection(kP).area / max(1e-6, dP.union(kP).area) >= 0.9
                       for k_, kP in kept_):
                    dup_.append(d_["kind"])
                    continue
                kept_.append((d_, dP))
            drawn = [k_ for k_, _ in kept_]
            if dup_:
                plan.setdefault("plan_meta", {})["drawn_duplicates_dropped"] = dup_
            # (T24, 2026-11-06) a WASHER: a 45-75 cm square with ONE circle at its centre (the drum), set in a niche walled
            #    within 30 cm on at least three of its sides — not a tall unit with a sink (846: fx-drawn-1/2 at the laundry niche 156,1207).
            #    A hob (>= 3 burner circles) was classed before this.
            wo_w = os.path.join(os.path.dirname(plan_p), "walls-only.png")   # (d_ is a fixture in this block)
            wl_w = cv2.imread(wo_w, cv2.IMREAD_GRAYSCALE) > 127 if os.path.exists(wo_w) else None
            washers, drop_w = [], set()
            for i_w, t_w in enumerate(drawn):
                if t_w["kind"] != "tall_unit" or wl_w is None:
                    continue
                sw, sh = sorted(t_w["size_cm"])
                if not (45 <= sw and sh <= 75 and sh - sw <= 10):
                    continue
                circ = [j_w for j_w, s_w in enumerate(drawn) if s_w["kind"] == "sink" and j_w != i_w
                        and math.hypot(s_w["centre_cm"][0] - t_w["centre_cm"][0], s_w["centre_cm"][1] - t_w["centre_cm"][1]) <= 8
                        and max(s_w["size_cm"]) <= 0.85 * sh]
                if len(circ) != 1:
                    continue
                cx_w, cy_w = t_w["centre_cm"]
                walled = 0
                mr_w = Polygon(t_w["polygon_cm"]).minimum_rotated_rectangle
                xw_, yw_ = mr_w.exterior.coords.xy
                a_w = math.degrees(math.atan2(yw_[1] - yw_[0], xw_[1] - xw_[0]))      # the square's own axes (846: 17.5 deg)
                for ang in (a_w, a_w + 90, a_w + 180, a_w + 270):   # a niche: wall within 30 cm beyond three of its four sides
                    ux_w, uy_w = math.cos(math.radians(ang)), math.sin(math.radians(ang))
                    hit = False
                    for dd in range(int(sh / 2), int(sh / 2) + 31, 2):
                        X, Y = int((cx_w + ux_w * dd) * ppc), int((cy_w + uy_w * dd) * ppc)
                        if 0 <= Y < wl_w.shape[0] and 0 <= X < wl_w.shape[1] and wl_w[Y, X]:
                            hit = True
                            break
                    walled += hit
                if walled < 3:
                    continue
                t_w["kind"] = "washer"; t_w["note"] = "a square with one centred circle (the drum) in a walled niche: a washer"
                drop_w.add(circ[0]); washers.append([round(cx_w, 1), round(cy_w, 1)])
            if washers:
                drawn = [s_w for j_w, s_w in enumerate(drawn) if j_w not in drop_w]
                plan.setdefault("plan_meta", {})["washers"] = washers
            kinds_drawn = {d_["kind"] for d_ in drawn} | {"hob"}
            rooms_drawn = {d_["room_id"] for d_ in drawn}
            fixtures = [f_ for f_ in fixtures if not (f_["kind"] in kinds_drawn and f_.get("room_id") in rooms_drawn)]
            H_ = {"counter": 90, "tall_unit": 220, "sink": 92, "shower": 5, "wardrobe": 240, "hob": 92, "panel": 220, "washer": 85}
            for n_, d_ in enumerate(drawn):
                fixtures.append({"id": f"fx-drawn-{n_ + 1}-{d_['kind']}", "room_id": d_["room_id"], "kind": d_["kind"], "polygon_cm": d_["polygon_cm"], "z_cm": 0,
                                 "height_cm": H_[d_["kind"]], "centre_cm": d_["centre_cm"], "angle_deg": 0, "size_cm": d_["size_cm"],
                                 "source": "auto_finalize: the drawing's plumbing/casework layer", "note": d_.get("note", "")})
    plan["fixtures"] = fixtures
    # (T26, 2026-11-06) a drawn fixture's angle and size come from its own outline: angle_deg = its long side from +x,
    #    size_cm = [along that side, across]. They were written as 0° — the furnisher then built 846's 35°-wing counter
    #    and 17.5° closets square to the page, into the walls (counter module m4 271 cm², a closet 434 cm²)
    def orient_(f):
        g_o = Polygon(f["polygon_cm"]).buffer(0)
        if g_o.is_empty:
            return
        mr_o = g_o.minimum_rotated_rectangle
        if mr_o.geom_type != "Polygon":
            return
        xo, yo = mr_o.exterior.coords.xy
        e_o = [(xo[1] - xo[0], yo[1] - yo[0]), (xo[2] - xo[1], yo[2] - yo[1])]
        lo = sorted(e_o, key=lambda e: -math.hypot(*e))
        ang = math.degrees(math.atan2(lo[0][1], lo[0][0])) % 180
        f["angle_deg"] = round(ang if ang <= 90 else ang - 180, 1)
        f["size_cm"] = [round(math.hypot(*lo[0])), round(math.hypot(*lo[1]))]
        f["centre_cm"] = [round(mr_o.centroid.x, 1), round(mr_o.centroid.y, 1)]
    for f in plan["fixtures"]:
        if "plumbing/casework" in (f.get("source") or ""):
            orient_(f)
    # (round 18) a PDF run: the shared fixture fix (printed_dimensions.snap_fixtures, fork A's rule): a drawn fixture that a
    #    printed dimension spans slides back between that dimension's own extension lines
    if os.path.exists(pv_fx):
        try:
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            import dim_chains as _dc
            import dims_gate as _dg
            import printed_dimensions as _PD
            _pv = json.load(open(pv_fx, encoding="utf-8"))
            _lines = _dg.pdf_lines(_dc.chains(_pv.get("dimension_segments_px", []), ppc), lambda x_, y_: (x_ / ppc, y_ / ppc))
            _moved = _PD.snap_fixtures(plan, _PD.measure(plan, _lines, 1.0)["rows"])
            if _moved:
                plan.setdefault("plan_meta", {})["fixtures_snapped"] = [[m_[0], round(m_[1], 1)] for m_ in _moved]
        except Exception as e_:      # the fix is an improvement, never a reason to fail the trace
            plan.setdefault("plan_meta", {})["fixtures_snapped_error"] = str(e_)[:200]
    # --- doors from the swing arcs; the entrance next to its label
    import auto_doors
    d_ = os.path.dirname(plan_p)
    grey_img = cv2.imread(os.path.join(d_, "plan-grey.png"), cv2.IMREAD_GRAYSCALE)
    if os.path.exists(os.path.join(d_, "strokes.png")):
        stroke = (cv2.imread(os.path.join(d_, "strokes.png"), cv2.IMREAD_GRAYSCALE) > 127).astype(np.uint8) * 255
    else:
        band = ((grey_img >= 70) & (grey_img <= 150)).astype(np.uint8)
        band = cv2.morphologyEx(band, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        stroke = ((grey_img < 70) & (cv2.dilate(band, np.ones((5, 5), np.uint8)) == 0)).astype(np.uint8) * 255
    wallm = (grey_img >= 70) & (grey_img <= 150)
    arcs = auto_doors.detect_arcs(stroke, wallm, ppc)
    door_layer = os.path.exists(os.path.join(d_, "pdf-vectors.json")) and (json.load(open(os.path.join(d_, "pdf-vectors.json"), encoding="utf-8")).get("n_door_paths") or 0) > 0
    if door_layer:      # the drawn doors are exact: they replace the tracer's guessed openings (adjacency openings stay)
        plan["openings"] = [o for o in plan.get("openings", []) if (o.get("source") == "auto_rooms adjacency" and o.get("kind") != "door") or o.get("source") == "wall-gap"]   # real wall gaps stay
    def room_at(x_cm, y_cm):
        pt = Point(x_cm, y_cm)
        return next((rid for rid, g in rooms.items() if g.contains(pt)), None)
    added = 0
    env_p = os.path.join(d_, "envelope.png")
    env_img = cv2.imread(env_p, cv2.IMREAD_GRAYSCALE) if os.path.exists(env_p) else None
    bar_p_ = os.path.join(d_, "barrier.png")
    hinge_dt = None
    if os.path.exists(bar_p_):    # (T16) a door hangs on a wall: distance from the hinge to the nearest drawn wall / line
        bm_ = cv2.resize(cv2.imread(bar_p_, cv2.IMREAD_GRAYSCALE), (grey_img.shape[1], grey_img.shape[0]), interpolation=cv2.INTER_NEAREST)
        hinge_dt = cv2.distanceTransform((bm_ <= 127).astype(np.uint8), cv2.DIST_L2, 5)
    tracer_gaps = []                                   # (T22) the tracer's wall gaps, cm: AUTO gap-k  W cm  ax,ay -> bx,by
    tl_p = os.path.join(d_, "trace.log")
    if os.path.exists(tl_p):
        for line in open(tl_p, encoding="utf-8", errors="replace"):
            mm = re.match(r"AUTO gap-\d+\s+(\d+) cm\s+(-?\d+),(-?\d+) -> (-?\d+),(-?\d+)", line.strip())
            if mm:
                w_, ax_g, ay_g, bx_g, by_g = [float(v) for v in mm.groups()]
                tracer_gaps.append(((ax_g, ay_g), (bx_g, by_g), w_))
    for k, a_ in enumerate(arcs):
        (hx, hy), (ex, ey) = a_["chord_px"]
        if env_img is not None:   # an arc whose hinge lies outside the building envelope is garden furniture, not a door
            fy, fx = int(hy * env_img.shape[0] / grey_img.shape[0]), int(hx * env_img.shape[1] / grey_img.shape[1])
            if not (0 <= fy < env_img.shape[0] and 0 <= fx < env_img.shape[1]) or env_img[fy, fx] == 0:
                a_["ignored"] = "outside the building envelope (not a door)"
                continue
        if hinge_dt is not None and 0 <= int(hy) < hinge_dt.shape[0] and 0 <= int(hx) < hinge_dt.shape[1]:
            # (T16, 2026-11-06) a hinge > 40 cm from any wall is not a door (Maale ground: the arc through three dining-chair
            #    backs, 171 cm from the nearest wall); drawn doors measured 0-23 cm (846 ×7, Maale first floor)
            dh = float(hinge_dt[int(hy), int(hx)]) / ppc
            if dh > 40:
                a_["ignored"] = f"no wall at its hinge ({dh:.0f} cm from the nearest wall): furniture, not a door"
                continue
        cxm, cym = (hx + ex) / 2 / ppc, (hy + ey) / 2 / ppc
        dx, dy = (ex - hx) / ppc, (ey - hy) / ppc
        L_ = math.hypot(dx, dy) or 1
        nx, ny = -dy / L_, dx / L_
        r1, r2 = room_at(cxm + nx * 45, cym + ny * 45), room_at(cxm - nx * 45, cym - ny * 45)
        def nearest(x_cm, y_cm, other):
            pt = Point(x_cm, y_cm)
            c_ = sorted(((g.distance(pt), rid) for rid, g in rooms.items() if rid != other), key=lambda t: t[0])
            return c_[0][1] if c_ and c_[0][0] <= 80 else None
        if r1 is None: r1 = nearest(cxm + nx * 45, cym + ny * 45, r2)
        if r2 is None: r2 = nearest(cxm - nx * 45, cym - ny * 45, r1)
        a_["rooms"] = [r1, r2]
        near = [o for o in plan.get("openings", []) if o.get("centre_cm") and math.hypot(o["centre_cm"][0] - cxm, o["centre_cm"][1] - cym) <= max(60, a_["r_cm"])]
        if near and not door_layer:
            a_["matched_opening"] = near[0]["id"]
            continue
        if r1 == r2 and not door_layer:
            a_["problem"] = "both sides of the door lie in the same traced room (a wrong split or a missing room)" if r1 else "neither side lies in a traced room"
            continue
        if r1 == r2:
            a_["problem"] = "a drawn door with the same traced room on both sides (kept: the drawing is the authority)" if r1 else "a drawn door between untraced spaces (kept)"
        # (T22, 2026-11-06) the tracer's own wall gap at the hinge, when there is one, IS the opening (846, one of three
        #    readings: the front door's 110 cm gap was skipped by the tracer before the entrance existed, and the arc's chord
        #    ran 45 deg off the facade); else (round 12) walk the door line from the hinge to the wall ends
        g_at = sorted((min(math.hypot(ga[0] - hx / ppc, ga[1] - hy / ppc), math.hypot(gb[0] - hx / ppc, gb[1] - hy / ppc)), ga, gb, gw)
                      for ga, gb, gw in tracer_gaps if 0.5 * a_["r_cm"] <= gw <= 1.6 * a_["r_cm"])
        if g_at and g_at[0][0] <= 25:
            _, ga, gb, gw = g_at[0]
            hx, hy, ex, ey = ga[0] * ppc, ga[1] * ppc, gb[0] * ppc, gb[1] * ppc
            cxm, cym = (hx + ex) / 2 / ppc, (hy + ey) / 2 / ppc
            dx, dy = (ex - hx) / ppc, (ey - hy) / ppc
            a_["gap_cm"] = round(gw, 1)
            a_["gap_from"] = "the tracer's wall gap at its hinge"
        gx_, gy_ = (ex - hx), (ey - hy)
        gL = math.hypot(gx_, gy_) or 1
        ux_, uy_ = gx_ / gL, gy_ / gL
        def free_at(t):
            X, Y = int(round(hx + ux_ * t)), int(round(hy + uy_ * t))
            return 0 <= Y < wallm.shape[0] and 0 <= X < wallm.shape[1] and not wallm[Y, X]
        lim = gL + 40 * ppc
        t0 = 0.0
        while t0 > -40 * ppc and free_at(t0 - 1):
            t0 -= 1
        t1 = 1.0
        while t1 < lim and free_at(t1 + 1):
            t1 += 1
        if not a_.get("gap_from") and (t1 - t0) / ppc >= 0.5 * a_["r_cm"] and (t1 - t0) / ppc <= 1.6 * a_["r_cm"]:
            hx, hy, ex, ey = hx + ux_ * t0, hy + uy_ * t0, hx + ux_ * t1, hy + uy_ * t1
            cxm, cym = (hx + ex) / 2 / ppc, (hy + ey) / 2 / ppc
            dx, dy = (ex - hx) / ppc, (ey - hy) / ppc
            a_["gap_cm"] = round((t1 - t0) / ppc, 1)
        dup = [o for o in plan.get("openings", []) if o.get("centre_cm") and math.hypot(o["centre_cm"][0] - cxm, o["centre_cm"][1] - cym) <= 30]
        if dup:
            a_["matched_opening"] = dup[0]["id"]
            continue
        oid = f"o-arc-{k + 1}"
        plan.setdefault("openings", []).append({"id": oid, "kind": "door", "rooms": [x for x in (r1, r2) if x] + (["outside"] if None in (r1, r2) else []),
                                                "a_cm": [round(hx / ppc, 1), round(hy / ppc, 1)], "b_cm": [round(ex / ppc, 1), round(ey / ppc, 1)], "centre_cm": [round(cxm, 1), round(cym, 1)],
                                                "angle_deg": round(math.degrees(math.atan2(dy, dx)), 1), "width_cm": a_.get("gap_cm") or round(a_["r_cm"], 1), "sill_cm": 0, "head_cm": 215, "source": "auto_doors: a swing arc on the plan, the wall gap it sits in"})
        a_["added_opening"] = oid
        added += 1
    # (round 15) sliding doors: a drawn glass panel (window layer) 120..300 cm long beside an exit arrow, with an indoor room
    # on one side and an outdoor room / the outside on the other
    pv_p = os.path.join(d_, "pdf-vectors.json")
    wv_p = os.path.join(d_, "windows-vector.png")
    if os.path.exists(pv_p) and os.path.exists(wv_p):
        SYMBOL = re.compile(r"siman|symb|arrow|סימן", re.I)   # a symbol layer (CAD export: wall fills are triangulated too)
        tris = [t_ for t_ in json.load(open(pv_p, encoding="utf-8")).get("filled_triangles_px", []) if 15 <= t_[2] / ppc <= 90 and SYMBOL.search(str(t_[3]) if len(t_) > 3 else "")]
        wvm = cv2.imread(wv_p, cv2.IMREAD_GRAYSCALE) > 127
        wvm = cv2.morphologyEx(wvm.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        n_s, l_s, st_s, _ = cv2.connectedComponentsWithStats(wvm, connectivity=8)
        outdoor = {r["id"] for r in plan["rooms"] if r.get("is_outdoor")}
        n_sl = 0
        for c_s in range(1, n_s):
            if st_s[c_s, cv2.CC_STAT_AREA] < 50:
                continue
            yy_s, xx_s = np.nonzero(l_s == c_s)
            P_s = np.stack([xx_s, yy_s], 1).astype(np.float64); mu_s = P_s.mean(0)
            _, sv_s, vt_s = np.linalg.svd(P_s - mu_s, full_matrices=False)
            u_s, nrm = vt_s[0], vt_s[1]
            t_s = (P_s - mu_s) @ u_s
            near_tris = [t_ for t_ in tris if math.hypot(t_[0] - mu_s[0], t_[1] - mu_s[1]) / ppc <= 400]
            if not near_tris:
                continue
            # a long facade glazing is split at its solid jambs (thick bins along the axis); the panel facing the arrow is the door
            b_px = 2 * ppc
            bins = np.floor((t_s - t_s.min()) / b_px).astype(int)
            cnt = np.bincount(bins)
            thick = cnt > 2.5 * max(1.0, float(np.median(cnt[cnt > 0])))
            t_arrow = min(((t_[0] - mu_s[0]) * u_s[0] + (t_[1] - mu_s[1]) * u_s[1] for t_ in near_tris),
                          key=lambda tt: min(abs(tt - t_s.min()), abs(tt - t_s.max())) * 0 + abs(tt))
            ia = int(np.clip(np.floor((t_arrow - t_s.min()) / b_px), 0, len(cnt) - 1))
            lo_i = ia
            while lo_i > 0 and not thick[lo_i - 1]:
                lo_i -= 1
            hi_i = ia
            while hi_i < len(cnt) - 1 and not thick[hi_i + 1]:
                hi_i += 1
            t_lo, t_hi = t_s.min() + lo_i * b_px, t_s.min() + (hi_i + 1) * b_px
            L_cm = (t_hi - t_lo) / ppc
            if not (120 <= L_cm <= 300):
                continue
            off_n = float(np.median((P_s - mu_s) @ nrm))
            mu_s = mu_s + u_s * (t_lo + t_hi) / 2 + nrm * off_n
            t_s = np.array([-(t_hi - t_lo) / 2, (t_hi - t_lo) / 2])
            if not any(math.hypot(t_[0] - mu_s[0], t_[1] - mu_s[1]) / ppc <= 150 for t_ in near_tris):
                continue
            cxm_, cym_ = mu_s[0] / ppc, mu_s[1] / ppc
            r1_ = room_at(cxm_ + nrm[0] * 60, cym_ + nrm[1] * 60); r2_ = room_at(cxm_ - nrm[0] * 60, cym_ - nrm[1] * 60)
            sides_ = [r1_, r2_]
            ins = [x_ for x_ in sides_ if x_ and x_ not in outdoor]
            outs = [x_ for x_ in sides_ if x_ in outdoor or x_ is None]
            if len(ins) != 1 or len(outs) != 1:
                continue
            A_s = (mu_s + u_s * t_s.min()) / ppc; B_s = (mu_s + u_s * t_s.max()) / ppc
            if any(o.get("centre_cm") and math.hypot(o["centre_cm"][0] - cxm_, o["centre_cm"][1] - cym_) <= 40 for o in plan.get("openings", [])):
                continue
            n_sl += 1
            plan.setdefault("openings", []).append({"id": f"o-slide-{n_sl}", "kind": "sliding_door", "rooms": [ins[0], outs[0] or "outside"],
                                                    "a_cm": [round(A_s[0], 1), round(A_s[1], 1)], "b_cm": [round(B_s[0], 1), round(B_s[1], 1)],
                                                    "centre_cm": [round(cxm_, 1), round(cym_, 1)], "angle_deg": round(math.degrees(math.atan2(u_s[1], u_s[0])), 1),
                                                    "width_cm": round(L_cm, 1), "sill_cm": 0, "head_cm": 215, "source": "auto_finalize: a drawn glass panel beside an exit arrow"})
    # (T23, 2026-11-06) an open passage IN a wall line: a wall that stops short (its end is a jamb) and, walking on along its
    #    own line, meets another wall within 60-200 cm, with free floor all the way — that gap is an opening between the two
    #    rooms either side of it (846 o-8: the closet's partition stops 160 cm short of the living-room wall; the master
    #    bedroom and the closet lobby meet there). Only from a drawn wall end, never where no wall is drawn; never where
    #    a door or opening already sits (within half the gap + 30 cm); never between two open-plan zones; indoor rooms only.
    wo_p2 = os.path.join(d_, "walls-only.png")
    if os.path.exists(wo_p2):
        wl_ = cv2.imread(wo_p2, cv2.IMREAD_GRAYSCALE) > 127
        Hw, Ww = wl_.shape
        OPEN_ZONE = {"kitchen", "living", "dining"}
        outd_ = {r["id"] for r in plan["rooms"] if r.get("is_outdoor")}
        typ_ = {r["id"]: r.get("type") for r in plan["rooms"]}

        def wall_at_(x_cm, y_cm):
            X, Y = int(round(x_cm * ppc)), int(round(y_cm * ppc))
            return 0 <= Y < Hw and 0 <= X < Ww and wl_[Y, X]

        def wall_end_(x_cm, y_cm, R=40):
            X0, Y0, r_ = int(x_cm * ppc), int(y_cm * ppc), int(R * ppc)
            y0, y1, x0, x1 = max(0, Y0 - r_), min(Hw, Y0 + r_), max(0, X0 - r_), min(Ww, X0 + r_)
            ys_, xs_ = np.nonzero(wl_[y0:y1, x0:x1])
            if len(xs_) < 20:
                return None
            Pw = np.stack([xs_ + x0, ys_ + y0], 1).astype(float) / ppc
            mu_ = Pw.mean(0)
            _, sv_, vt_ = np.linalg.svd(Pw - mu_, full_matrices=False)
            if sv_[1] / max(sv_[0], 1e-9) > 0.5:
                return None                                   # a corner or a blob, not one wall run
            u_ = vt_[0]
            tw = (Pw - mu_) @ u_
            side = 1 if (np.array([x_cm, y_cm]) - mu_) @ u_ > 0 else -1
            te = tw.max() if side > 0 else tw.min()
            return Pw[np.abs(tw - te) <= 1.5].mean(0), u_ * side
        gaps_ = []
        rid_ = list(rooms)
        for i_ in range(len(rid_)):
            for j_ in range(i_ + 1, len(rid_)):
                a_r, b_r = rid_[i_], rid_[j_]
                if a_r in outd_ or b_r in outd_:
                    continue
                c_ = rooms[a_r].buffer(3).intersection(rooms[b_r].buffer(3))
                if c_.is_empty or c_.area < 360:
                    continue
                mrr_ = c_.minimum_rotated_rectangle
                xs_, ys_ = mrr_.exterior.coords.xy
                e1_ = (xs_[1] - xs_[0], ys_[1] - ys_[0]); e2_ = (xs_[2] - xs_[1], ys_[2] - ys_[1])
                L1_, L2_ = math.hypot(*e1_), math.hypot(*e2_)
                if max(L1_, L2_) < 50:
                    continue
                uu_ = np.array(e1_ if L1_ >= L2_ else e2_) / max(L1_, L2_)
                cc_ = np.array([c_.centroid.x, c_.centroid.y])
                for Pe in (cc_ - uu_ * max(L1_, L2_) / 2, cc_ + uu_ * max(L1_, L2_) / 2):
                    we_ = wall_end_(*Pe)
                    if we_ is None:
                        continue
                    E_, dv_ = we_
                    t_ = 3.0
                    while t_ <= 200 and not wall_at_(*(E_ + dv_ * t_)):
                        t_ += 1.0
                    if t_ > 200 or t_ < 60:
                        continue
                    Q_ = E_ + dv_ * t_
                    mid_ = (E_ + Q_) / 2
                    nr_ = np.array([-dv_[1], dv_[0]])
                    s1_ = next((k_ for k_, g_ in rooms.items() if g_.contains(Point(*(mid_ + nr_ * 40)))), None)
                    s2_ = next((k_ for k_, g_ in rooms.items() if g_.contains(Point(*(mid_ - nr_ * 40)))), None)
                    if not s1_ or not s2_ or s1_ == s2_ or s1_ in outd_ or s2_ in outd_:
                        continue
                    if typ_.get(s1_) in OPEN_ZONE and typ_.get(s2_) in OPEN_ZONE:
                        continue
                    if any(o.get("centre_cm") and math.hypot(o["centre_cm"][0] - mid_[0], o["centre_cm"][1] - mid_[1]) <= t_ / 2 + 30
                           for o in plan.get("openings", [])):
                        continue
                    if any(math.hypot(g[2][0] - mid_[0], g[2][1] - mid_[1]) <= 30 for g in gaps_):
                        continue
                    gaps_.append((E_, Q_, mid_, t_, sorted([s1_, s2_])))
        for n_g, (E_, Q_, mid_, t_, rr_) in enumerate(gaps_):
            plan.setdefault("openings", []).append({"id": f"o-gap-{n_g + 1}", "kind": "opening", "rooms": rr_,
                                                    "a_cm": [round(E_[0], 1), round(E_[1], 1)], "b_cm": [round(Q_[0], 1), round(Q_[1], 1)],
                                                    "centre_cm": [round(mid_[0], 1), round(mid_[1], 1)],
                                                    "angle_deg": round(math.degrees(math.atan2(Q_[1] - E_[1], Q_[0] - E_[0])), 1), "width_cm": round(t_, 1),
                                                    "sill_cm": 0, "head_cm": 215, "source": "auto_finalize: a wall gap — a wall end, its line on to the next wall (T23)"})
    # (T28, 2026-11-06) a door sits IN a wall gap (fork F, 846 fresh A): (a) a door whose line has a drawn wall within 30 cm
    #    in front of its middle runs along a wall, not through one — dropped (o-arc-8: the front door's open leaf against the
    #    shaft wall, read as a second entry door); (b) a door to the outside whose outer side meets drawn glass within 60 cm
    #    is a glazed corner, not a door — dropped (the master bedroom's 120 cm "door" between its wall end and the column,
    #    in front of the facade glass)
    wo_t = os.path.join(d_, "walls-only.png")
    if os.path.exists(wo_t):
        wl_t = cv2.imread(wo_t, cv2.IMREAD_GRAYSCALE) > 127
        gl_t = None
        for n_t in ("windows-vector.png", "windows-glass.png", "glazing-pen.png"):
            p_t = os.path.join(d_, n_t)
            if os.path.exists(p_t):
                g_t = cv2.imread(p_t, cv2.IMREAD_GRAYSCALE) > 127
                gl_t = g_t if gl_t is None else (gl_t | g_t)
        Ht, Wt = wl_t.shape

        def at_t(m, x, y):
            X, Y = int(round(x * ppc)), int(round(y * ppc))
            return m is not None and 0 <= Y < Ht and 0 <= X < Wt and bool(m[Y, X])
        kept_t, dropped_t = [], []
        for o in plan.get("openings", []):
            if o.get("kind") not in ("door", "entry_door") or not o.get("a_cm") or not o.get("b_cm"):
                kept_t.append(o)
                continue
            A_t, B_t = np.array(o["a_cm"], float), np.array(o["b_cm"], float)
            Ln = float(np.linalg.norm(B_t - A_t)) or 1.0
            u_t = (B_t - A_t) / Ln; n_t = np.array([-u_t[1], u_t[0]])
            why = None
            for sg in (1, -1):
                if any(at_t(wl_t, *(A_t + (B_t - A_t) * f + n_t * sg * tt)) for tt in range(3, 31) for f in (0.35, 0.5, 0.65)):
                    why = "a drawn wall within 30 cm in front of it: it runs along a wall, not through a gap"
                    break
            if why is None and gl_t is not None:          # (its label may still name a room the gap does not reach)
                for sg in (1, -1):
                    side_pt = (A_t + B_t) / 2 + n_t * sg * 40
                    if any(g_.contains(Point(*side_pt)) for g_ in rooms.values()):
                        continue                                   # the room side
                    if any(at_t(gl_t, *(A_t + (B_t - A_t) * f + n_t * sg * tt)) for tt in range(3, 61) for f in (0.35, 0.5, 0.65)):
                        why = "no room beyond it, drawn glass within 60 cm: a glazed corner, not a door"
            if why:
                dropped_t.append(f"{o['id']} {o.get('rooms')}: {why}")
            else:
                kept_t.append(o)
        plan["openings"] = kept_t
        if dropped_t:
            plan.setdefault("plan_meta", {})["doors_dropped"] = dropped_t
    # (T29, 2026-11-06) an unlabelled corridor that meets exactly ONE labelled room across no wall and no door / gap (every
    #    other neighbour is behind a drawn wall line, a door or a T23 gap) is part of that room, not a room of its own (846:
    #    the closet lobby + the closet corner «פינת ארונות» are one space on the drawing — no line between them; the hand trace
    #    does the same). The room loops then sit on the drawn walls; the lobby's separate hotspot goes.
    seeds_t = {s_["room_id"]: s_ for s_ in json.load(open(seeds_p, encoding="utf-8"))}
    for c_id in [r["id"] for r in plan["rooms"] if (seeds_t.get(r["id"]) or {}).get("auto_reason") == "corridor"]:
        if c_id not in rooms:
            continue
        gc = rooms[c_id]
        linked = {x for o in plan.get("openings", []) if c_id in (o.get("rooms") or []) for x in o["rooms"]} - {c_id}
        cand = []
        for r_id, gr in rooms.items():
            s_r = seeds_t.get(r_id) or {}
            if r_id == c_id or r_id in linked or s_r.get("auto") or s_r.get("is_outdoor"):
                continue
            if gc.buffer(3).intersection(gr.buffer(3)).area >= 60 * 6:
                cand.append(r_id)
        if len(cand) != 1:
            continue
        r_id = cand[0]
        if (seeds_t.get(r_id) or {}).get("type") in ("kitchen", "living") or (seeds_t.get(r_id) or {}).get("vlm_type") in ("kitchen", "dining", "living"):
            continue
        um = unary_union([rooms[r_id].buffer(1.5), gc.buffer(1.5)]).buffer(-1.5)
        um = um if um.geom_type == "Polygon" else max(um.geoms, key=lambda q: q.area)
        rr_ = next(r for r in plan["rooms"] if r["id"] == r_id)
        rr_["loop"] = [[round(x, 1), round(y, 1)] for x, y in list(um.simplify(1.0).exterior.coords)[:-1]]
        xs_m, ys_m = zip(*rr_["loop"])
        rr_["bbox_cm"] = [min(xs_m), min(ys_m), max(xs_m), max(ys_m)]
        rr_["area_m2"] = round(um.area / 1e4, 3)
        rooms[r_id] = um
        plan["rooms"] = [r for r in plan["rooms"] if r["id"] != c_id]
        del rooms[c_id]
        for o in plan.get("openings", []):
            o["rooms"] = [r_id if x == c_id else x for x in (o.get("rooms") or [])]
        plan["openings"] = [o for o in plan.get("openings", []) if len(set(o.get("rooms") or [])) > 1]
        for f in plan.get("fixtures", []):
            if f.get("room_id") == c_id:
                f["room_id"] = r_id
        plan["camera_points"] = [cp for cp in plan.get("camera_points", []) if cp.get("room_id") != c_id]
        for cp in plan["camera_points"]:
            if cp.get("room_id") == r_id:
                q_ = polylabel(um, tolerance=2.0)
                cp["x"], cp["y"] = round(q_.x, 1), round(q_.y, 1)
        plan.setdefault("plan_meta", {}).setdefault("rooms_merged", []).append(f"{c_id} -> {r_id}: one space on the drawing (no line between them)")
    # (T30) a vector PDF: the niches auto_rooms recorded (walled on their other sides, open only to one printed room) join that
    #    room's finished loop, so the loop sits on the drawn walls (846: the guest bath's basin niche)
    if os.path.exists(os.path.join(d_, "pdf-vectors.json")):
        rj_n = os.path.join(d_, "rooms.json")
        for rid_n, loops_n in (json.load(open(rj_n, encoding="utf-8")).get("niches", {}) if os.path.exists(rj_n) else {}).items():
            if rid_n not in rooms:
                continue
            npoly = unary_union([Polygon(l_).buffer(0) for l_ in loops_n if len(l_) >= 3])
            if npoly.is_empty:
                continue
            um = unary_union([rooms[rid_n], npoly.buffer(3)]).buffer(-3).union(rooms[rid_n])
            um = um if um.geom_type == "Polygon" else max(um.geoms, key=lambda q: q.area)
            rr_ = next(r for r in plan["rooms"] if r["id"] == rid_n)
            rr_["loop"] = [[round(x, 1), round(y, 1)] for x, y in list(um.exterior.coords)[:-1]]
            rr_["area_m2"] = round(um.area / 1e4, 3)
            rooms[rid_n] = um
            plan.setdefault("plan_meta", {}).setdefault("niches_joined", []).append(f"{rid_n} +{npoly.area / 1e4:.2f} m²")
    # (T31, 2026-11-07) a room's loop sits ON the faces of the walls the builder builds (plan["walls"]): each edge that
    #    runs along a wall face within 14 cm (>= 60 % of its samples, the middle 80 % within 4 cm) moves onto it, and
    #    the corners are re-cut as the crossings of the moved edges (fork F's render: the guest bath +4-7 cm off its walls
    #    after the niche join, the merged closet lobby ~9 cm)
    # (widened, coordinator 2026-11-07) EVERY room after all merges: an edge within 14 cm of a parallel wall face moves onto
    #    it (the hand plan sits <= 5 cm off its faces; fork F's per-wall check found 5.5-6.8 cm on the bath, living, terrace,
    #    entrance). The printed sides are re-checked by trace_check on the dimension lines (1 %).
    # (T32 changes this, 2026-11-07) with edge_kinds written (T32 below) the builder builds each 'wall' edge's facing ON the
    #    loop, so an indoor loop no longer has to sit on the wall polygon — it stays on the DRAWN face, where the printed
    #    dimension's ticks are (snapping it onto the polygon face put it 2-2.7 cm past the ticks: the closet 162.3 for 160,
    #    the master bath 213 for 210). Only an outdoor room keeps the snap: its railing / parapet is a pane with no facing,
    #    so its loop must sit on the railing the builder builds (fork F: terrace loop#160 5.5 cm)
    on_face = {r["id"] for r in plan["rooms"] if r.get("is_outdoor")} if os.path.exists(os.path.join(d_, "pdf-vectors.json")) else set()
    walls_f = unary_union([Polygon(w["polygon_cm"]).buffer(0) for w in plan.get("walls", []) if len(w.get("polygon_cm", [])) >= 3])
    for rid_f in sorted(on_face):
        if rid_f not in rooms or walls_f.is_empty:
            continue
        rr_ = next(r for r in plan["rooms"] if r["id"] == rid_f)
        g_f = Polygon(rr_["loop"]).buffer(0)
        walls_fr = walls_f
        if rr_.get("is_outdoor"):                               # a terrace: its railings / parapet are built too
            rails_ = [Polygon(pn["polygon_cm"]).buffer(0) for pn in plan.get("panes", []) if pn.get("kind") == "railing" and len(pn.get("polygon_cm", [])) >= 3]
            if rails_:
                walls_fr = unary_union([walls_f] + rails_)
        L_ = [np.array(p_, float) for p_ in rr_["loop"]]
        n_ = len(L_)
        lines, moved_n = [], 0
        for i_ in range(n_):
            A_f, B_f = L_[i_], L_[(i_ + 1) % n_]
            Le = float(np.linalg.norm(B_f - A_f))
            if Le < 1e-6:
                lines.append(None); continue
            u_f = (B_f - A_f) / Le
            nn = np.array([-u_f[1], u_f[0]])
            if g_f.contains(Point(*((A_f + B_f) / 2 + nn * 3))):
                nn = -nn                                         # outward
            off = 0.0
            if Le >= 20:
                offs = []
                ts_ = []
                for t_f in np.arange(4, Le - 4, 4):
                    p_f = A_f + u_f * t_f
                    inw = walls_fr.contains(Point(*p_f))
                    for s_f in np.arange(0, 20.5, 0.5):
                        q_f = p_f + nn * s_f if not inw else p_f - nn * s_f
                        if walls_fr.contains(Point(*q_f)) != inw:
                            offs.append(s_f if not inw else -s_f); ts_.append(t_f)
                            break
                n_samp = max(1, int((Le - 8) / 4))
                if offs and len(offs) >= 0.6 * n_samp and np.percentile(offs, 90) - np.percentile(offs, 10) <= 4:
                    med = float(np.median(offs))
                    if 0.5 <= abs(med) <= 14:
                        off = med; moved_n += 1
                elif len(offs) >= 0.6 * n_samp and len(offs) >= 4:
                    # the face is straight but the edge is tilted against it (846: the guest-bath niche edge 18 deg, the
                    #    master bath's long edge 1.3 deg): a line fit of the offsets; the edge turns onto the face when the fit
                    #    is tight (<= 1.5 cm), the tilt <= 20 deg, the edge within 14 cm of it on the median (its ends within 21)
                    k_, c_ = np.polyfit(ts_, offs, 1)
                    res_ = float(np.max(np.abs(np.polyval([k_, c_], ts_) - np.array(offs))))
                    o0, o1 = float(c_), float(k_ * Le + c_)
                    if res_ <= 1.5 and math.degrees(math.atan(abs(k_))) <= 20 and abs(float(np.median(offs))) <= 14                             and max(abs(o0), abs(o1)) <= 21 and max(abs(o0), abs(o1)) >= 0.5:
                        P0, P1 = A_f + nn * o0, B_f + nn * o1
                        dd_ = (P1 - P0) / max(1e-9, float(np.linalg.norm(P1 - P0)))
                        lines.append((P0, dd_)); moved_n += 1
                        continue
            lines.append((A_f + nn * off, u_f))
        if not moved_n:
            continue
        newL = []
        for i_ in range(n_):
            l0, l1 = lines[i_ - 1], lines[i_]
            if l0 is None or l1 is None:
                newL.append(L_[i_]); continue
            (p0, d0), (p1, d1) = l0, l1
            den = d0[0] * d1[1] - d0[1] * d1[0]
            if abs(den) < 1e-6:                                  # parallel neighbours: move the vertex with this edge
                newL.append(p1 + d1 * float((L_[i_] - p1) @ d1)); continue
            t0 = ((p1[0] - p0[0]) * d1[1] - (p1[1] - p0[1]) * d1[0]) / den
            X_ = p0 + d0 * t0
            if np.linalg.norm(X_ - L_[i_]) > 25:                 # a sliver corner: keep the old vertex
                X_ = L_[i_]
            newL.append(X_)
        ng_f = Polygon([tuple(p_) for p_ in newL]).buffer(0)
        if ng_f.is_empty or ng_f.geom_type != "Polygon" or abs(ng_f.area - g_f.area) > 0.08 * g_f.area:
            continue
        rr_["loop"] = [[round(float(x), 1), round(float(y), 1)] for x, y in newL]
        rr_["area_m2"] = round(ng_f.area / 1e4, 3)
        rooms[rid_f] = ng_f
        plan.setdefault("plan_meta", {}).setdefault("loops_on_wall_faces", []).append(f"{rid_f}: {moved_n} edge(s) moved onto the wall faces")
    # (T25, 2026-11-06) THE DRAWING WINS OVER THE VISION BOXES, and no fixture blocks a door (fork F's furnish audit on 846:
    #    the vision boxes fx-2-wc / fx-9-vanity / fx-3-vanity doubled the drawn plumbing shapes and fx-9 / fx-3 sat in the
    #    swing of o-arc-6 / o-arc-7). A vision box that overlaps a drawn fixture is dropped; the drawn shape stays, and a
    #    drawn 'sink' in a bathroom (a bowl outline) takes the vision box's kind (the reading names, the drawing places). A
    #    vision box inside a drawn closed 4-sided shape of the plumbing layer (a vanity top the casework reader does not class)
    #    becomes that shape with the vision kind. Only where the drawing has nothing does a vision box survive — and then
    #    never inside a drawn door swing. Every fixture gets the room it overlaps most.
    vis_ = [f for f in plan.get("fixtures", []) if "vision model" in (f.get("source") or "")]
    drawn_f = [f for f in plan.get("fixtures", []) if "plumbing/casework" in (f.get("source") or "")]
    room_type_ = {r["id"]: r.get("type") for r in plan["rooms"]}
    fx_notes, drop_ids = [], set()
    P_ = lambda f: Polygon(f["polygon_cm"]).buffer(0)
    pv_q = os.path.join(d_, "pdf-vectors.json")
    quads, strokes_pts = [], []
    if os.path.exists(pv_q):
        for q in json.load(open(pv_q, encoding="utf-8")).get("plumbing_polys_px", []):
            strokes_pts.extend([(x_ / ppc, y_ / ppc) for x_, y_ in q])
            if len(q) == 4:
                g4 = Polygon([[x_ / ppc, y_ / ppc] for x_, y_ in q]).buffer(0)
                if g4.is_empty or g4.area < 100:
                    continue                           # a degenerate (collinear) 4-point path
                mr4 = g4.minimum_rotated_rectangle
                if mr4.geom_type != "Polygon":
                    continue
                xs4, ys4 = mr4.exterior.coords.xy
                s4 = sorted([math.hypot(xs4[1] - xs4[0], ys4[1] - ys4[0]), math.hypot(xs4[2] - xs4[1], ys4[2] - ys4[1])])
                if not g4.is_empty and g4.area >= 0.9 * mr4.area and 30 <= s4[0] and s4[1] <= 250:
                    quads.append((g4, s4))
    for v_ in vis_:
        gv = P_(v_)
        if gv.is_empty:
            continue
        hit = [f for f in drawn_f if f["id"] not in drop_ids and (P_(f).intersection(gv).area >= 0.3 * min(P_(f).area, gv.area)
                                                                  or gv.buffer(10).contains(P_(f).centroid))]   # the box sits on a drawn shape
        if not hit and v_["kind"] == "wc":
            # a reading's WC box off its drawing (846, fresh reading A: 40 cm off): the unnamed drawn bowl outline in the same
            # bathroom within 60 cm is the WC it names
            rb_ = max(((rooms[r_].intersection(gv).area, r_) for r_ in rooms), default=(0, None))[1]
            near_b = sorted((P_(f).distance(gv), f["id"]) for f in drawn_f if f["id"] not in drop_ids and f["kind"] == "sink"
                            and f.get("room_id") == rb_ and room_type_.get(rb_) == "bathroom")
            if near_b and near_b[0][0] <= 60:
                hit = [f for f in drawn_f if f["kind"] == "sink" and f.get("room_id") == rb_ and P_(f).distance(gv) <= near_b[0][0] + 15]
        if hit:
            drop_ids.add(v_["id"])
            same = [f for f in hit if room_type_.get(f.get("room_id")) == "bathroom" and f["kind"] == "sink" and v_["kind"] != "sink"]
            if same:                                   # one shape: the drawn outlines under the box merge, named by the box
                keep_f = same[0]
                un = unary_union([P_(f) for f in same]).minimum_rotated_rectangle
                xs_u, ys_u = un.exterior.coords.xy
                e_u = [(xs_u[1] - xs_u[0], ys_u[1] - ys_u[0]), (xs_u[2] - xs_u[1], ys_u[2] - ys_u[1])]
                keep_f.update({"kind": v_["kind"], "polygon_cm": [[round(x_, 1), round(y_, 1)] for x_, y_ in list(un.exterior.coords)[:4]],
                               "centre_cm": [round(un.centroid.x, 1), round(un.centroid.y, 1)],
                               "size_cm": [round(math.hypot(*e_u[0])), round(math.hypot(*e_u[1]))],
                               "note": f"drawn outline, named {v_['kind']} by the reading (was 'sink')",
                               "id": keep_f["id"].rsplit("-", 1)[0] + "-" + v_["kind"]})
                for f in same[1:]:
                    drop_ids.add(f["id"])
            fx_notes.append(f"{v_['id']}: the drawing has {[f['id'] for f in hit]} there — the vision box is dropped")
            continue
        qq = [(g4, s4) for g4, s4 in quads if g4.intersection(gv).area >= 0.6 * gv.area]
        if qq:
            g4, s4 = min(qq, key=lambda t: t[0].area)
            mr4 = g4.minimum_rotated_rectangle
            xs4, ys4 = mr4.exterior.coords.xy
            v_.update({"polygon_cm": [[round(x_, 1), round(y_, 1)] for x_, y_ in list(mr4.exterior.coords)[:4]],
                       "centre_cm": [round(mr4.centroid.x, 1), round(mr4.centroid.y, 1)],
                       "size_cm": [round(math.hypot(xs4[1] - xs4[0], ys4[1] - ys4[0])), round(math.hypot(xs4[2] - xs4[1], ys4[2] - ys4[1]))],
                       "angle_deg": round(math.degrees(math.atan2(ys4[1] - ys4[0], xs4[1] - xs4[0])), 1),
                       "source": "auto_finalize: a drawn shape of the plumbing layer, named by the reading (T25)"})
            fx_notes.append(f"{v_['id']}: the drawn {s4[1]:.0f} x {s4[0]:.0f} cm shape under the vision box is the fixture")
            continue
        # a drawn outline made of separate strokes (846's guest basin: arcs and lines on the plumbing layer): the fixture is
        # the oriented box of the drawn strokes under the vision box (>= 20 points, >= 25 % of the box)
        from shapely.geometry import MultiPoint
        near_pts = [pt_ for pt_ in strokes_pts if gv.buffer(5).contains(Point(pt_))]
        if len(near_pts) >= 20:
            hull = MultiPoint(near_pts).convex_hull
            if hull.geom_type == "Polygon" and hull.area >= 0.25 * gv.area:
                mrh = hull.minimum_rotated_rectangle
                xs4, ys4 = mrh.exterior.coords.xy
                v_.update({"polygon_cm": [[round(x_, 1), round(y_, 1)] for x_, y_ in list(mrh.exterior.coords)[:4]],
                           "centre_cm": [round(mrh.centroid.x, 1), round(mrh.centroid.y, 1)],
                           "size_cm": [round(math.hypot(xs4[1] - xs4[0], ys4[1] - ys4[0])), round(math.hypot(xs4[2] - xs4[1], ys4[2] - ys4[1]))],
                           "source": "auto_finalize: the drawn strokes of the plumbing layer under the reading's box, named by it (T25)"})
                fx_notes.append(f"{v_['id']}: the drawn strokes under the vision box ({len(near_pts)} points) are the fixture, {mrh.area / 1e4:.2f} m²")
    # a door swing (the drawn arc: hinge, radius, its span) is never under a vision box
    swings = []
    for a_ in arcs:
        if a_.get("ignored"):
            continue
        hx_s, hy_s = [v / ppc for v in a_["hinge_px"]]
        r_s = a_["r_px"] / ppc
        a0_s, a1_s = a_["a0_deg"], a_["a1_deg"]
        if a1_s < a0_s:
            a1_s += 360
        pts_s = [(hx_s, hy_s)] + [(hx_s + r_s * math.cos(math.radians(t_)), hy_s + r_s * math.sin(math.radians(t_))) for t_ in np.linspace(a0_s, a1_s, 24)]
        swings.append(Polygon(pts_s).buffer(0))
    for v_ in vis_:
        if v_["id"] in drop_ids or "T25" in (v_.get("source") or ""):
            continue
        gv = P_(v_)
        if any(gv.intersection(sw).area > 20 for sw in swings):
            drop_ids.add(v_["id"])
            fx_notes.append(f"{v_['id']}: a vision box in a drawn door swing — dropped")
    plan["fixtures"] = [f for f in plan.get("fixtures", []) if f["id"] not in drop_ids]
    for f in plan["fixtures"]:
        if "T25" in (f.get("source") or "") or "named" in (f.get("note") or ""):
            orient_(f)
    for f in plan["fixtures"]:                          # every fixture in the room it overlaps most
        gf_ = P_(f)
        best = max(((rooms[r_].intersection(gf_).area, r_) for r_ in rooms), default=(0, None))
        if best[0] > 0 and f.get("room_id") != best[1] and (f.get("room_id") is None or rooms.get(f["room_id"]) is None
                                                             or rooms[f["room_id"]].intersection(gf_).area < best[0]):
            fx_notes.append(f"{f['id']}: room {f.get('room_id')} -> {best[1]}")
            f["room_id"] = best[1]
        elif f.get("room_id") is None:
            near_ = min(((rooms[r_].distance(gf_), r_) for r_ in rooms), default=(1e9, None))
            if near_[0] <= 30:
                f["room_id"] = near_[1]
                fx_notes.append(f"{f['id']}: room None -> {near_[1]} ({near_[0]:.0f} cm away)")
    if fx_notes:
        plan.setdefault("plan_meta", {})["fixtures_drawing_wins"] = fx_notes
    # the entrance: the opening on the building's edge nearest the entrance label (the label may sit outside the door)
    ent = next((s_ for s_ in json.load(open(seeds_p, encoding="utf-8")) if "כניסה" in (s_.get("name_he") or "") or s_.get("vlm_type") == "entrance"), None)
    entrance = None
    if ent:
        lx, ly = [v / ppc for v in (ent.get("label_px") or ent["at_px"])]
        foot = unary_union(list(rooms.values())).buffer(30)
        cands = []
        for o in plan.get("openings", []):
            c_ = o.get("centre_cm")
            if not c_:
                continue
            outer = ("outside" in (o.get("rooms") or [])) or (None in (o.get("rooms") or [])) or (not foot.buffer(-60).contains(Point(*c_)))
            if outer:
                cands.append((math.hypot(c_[0] - lx, c_[1] - ly), o))
        if cands:
            dist_, o = min(cands, key=lambda t: t[0])
            if dist_ <= 350:
                o["kind"] = "entry_door"
                entrance = {"opening": o["id"], "dist_to_label_cm": round(dist_, 1)}
    plan.setdefault("plan_meta", {})["entrance"] = entrance
    # (round 17) a wall gap between two jambs INSIDE one hall / corridor (the tracer's AUTO gap, its flood rooms stale) is a
    #    door that the drawing puts there (Maale Efraim first floor: the master-suite door in the corridor): it splits the hall;
    #    the smaller side becomes «מבואה» (auto_reason door-split) and the gap its door
    from shapely.geometry import LineString as _LS
    from shapely.ops import split as _split
    tl_p = os.path.join(d_, "trace.log")
    gaps_ = []
    if os.path.exists(tl_p):
        for ln in open(tl_p, encoding="utf-8", errors="replace"):
            m_ = re.match(r"AUTO (gap-\d+)\s+(\d+) cm\s+(-?[\d.]+),(-?[\d.]+) -> (-?[\d.]+),(-?[\d.]+)", ln.strip())
            if m_:
                gaps_.append((m_.group(1), float(m_.group(2)), (float(m_.group(3)), float(m_.group(4))), (float(m_.group(5)), float(m_.group(6)))))
    n_split = 0
    for gid, w_g, ga, gb in gaps_:
        if not (60 <= w_g <= 100):
            continue
        L_g = math.hypot(gb[0] - ga[0], gb[1] - ga[1]) or 1
        ux_g, uy_g = (gb[0] - ga[0]) / L_g, (gb[1] - ga[1]) / L_g
        off_g = abs(((math.degrees(math.atan2(uy_g, ux_g)) - ang) + 45) % 90 - 45)
        if off_g > 5:
            continue                    # a door between jambs lies along the walls' axis (a diagonal gap is a tracer artefact)
        cx_g, cy_g = (ga[0] + gb[0]) / 2, (ga[1] + gb[1]) / 2
        s1 = room_at(cx_g - uy_g * 45, cy_g + ux_g * 45); s2 = room_at(cx_g + uy_g * 45, cy_g - ux_g * 45)
        if s1 is None or s1 != s2:
            continue
        rr = next((r for r in plan["rooms"] if r["id"] == s1), None)
        if rr is None or rr.get("type") != "hall" or rr.get("is_outdoor"):
            continue
        cut = _LS([(ga[0] - ux_g * 40, ga[1] - uy_g * 40), (gb[0] + ux_g * 40, gb[1] + uy_g * 40)])
        parts = [g for g in _split(rooms[s1], cut).geoms if g.geom_type == "Polygon"]
        if len(parts) != 2 or min(g.area for g in parts) < 1.0e4:
            continue
        big, small = sorted(parts, key=lambda g: -g.area)
        n_split += 1
        new_id = f"r-lobby-{n_split}"
        rr["loop"] = [[round(x, 1), round(y, 1)] for x, y in list(big.exterior.coords)[:-1]]
        rr["area_m2"] = round(big.area / 1e4, 3)
        plan["rooms"].append({"id": new_id, "name_he": "מבואה", "name_en": "Lobby", "type": "hall", "is_outdoor": False, "roofed": None,
                              "loop": [[round(x, 1), round(y, 1)] for x, y in list(small.exterior.coords)[:-1]], "printed_dims_cm": None,
                              "area_m2": round(small.area / 1e4, 3), "source": f"auto_finalize: {s1} split at the drawn door between its jambs ({gid}, {w_g:.0f} cm)",
                              "auto_reason": "door-split", "label_moved_inside": False})
        rooms[s1], rooms[new_id] = big, small
        q_ = polylabel(small, tolerance=2.0)
        plan.setdefault("camera_points", []).append({"id": f"cp-lobby-{n_split}", "room_id": new_id, "x": round(q_.x, 1), "y": round(q_.y, 1), "z": 160, "yaw_deg": 0.0,
                                                     "note": "auto-trace: the room's pole of inaccessibility"})
        plan.setdefault("openings", []).append({"id": f"o-split-{n_split}", "kind": "door", "a_cm": [round(v, 1) for v in ga], "b_cm": [round(v, 1) for v in gb],
                                                "centre_cm": [round(cx_g, 1), round(cy_g, 1)], "width_cm": round(w_g, 1), "rooms": [s1, new_id],
                                                "source": "auto_finalize: a wall gap between two jambs inside one hall (the drawn door)"})
        plan.setdefault("plan_meta", {}).setdefault("door_splits", []).append(f"{s1}: split at the drawn door {gid} ({w_g:.0f} cm) -> «מבואה» {small.area / 1e4:.1f} m²")
    # (round 17) every opening's rooms re-derived from the FINAL rooms (45 cm either side of its centre, across its line);
    # duplicates within 45 cm merged (the entrance-labelled / drawn / wider kept); a drawn door with one room on both sides is
    # internal (a shower door, a cupboard) and leaves the room-to-room list
    outdoor_ids = {r["id"] for r in plan["rooms"] if r.get("is_outdoor")}
    clean, internal = [], []
    pref = lambda o: (o.get("source") == "wall-gap", "auto_doors" in str(o.get("source")) or "auto_finalize" in str(o.get("source")), o.get("width_cm") or 0)   # the exact wall gap first
    for o in sorted(plan.get("openings", []), key=pref, reverse=True):
        if not (o.get("a_cm") and o.get("b_cm") and o.get("centre_cm")):
            continue
        ax_o, ay_o = o["a_cm"]; bx_o, by_o = o["b_cm"]; L_o = math.hypot(bx_o - ax_o, by_o - ay_o) or 1
        nx_o, ny_o = -(by_o - ay_o) / L_o, (bx_o - ax_o) / L_o
        cx_o, cy_o = o["centre_cm"]
        s1 = room_at(cx_o + nx_o * 45, cy_o + ny_o * 45); s2 = room_at(cx_o - nx_o * 45, cy_o - ny_o * 45)
        if s1 is None and s2 is None:      # (round 18) neither side inside a room (the entrance niche was absorbed): the side
            p1_ = Point(cx_o + nx_o * 45, cy_o + ny_o * 45); p2_ = Point(cx_o - nx_o * 45, cy_o - ny_o * 45)   # nearer a room
            d1_ = min(((g.distance(p1_), rid) for rid, g in rooms.items() if not any(r_["id"] == rid and r_.get("is_outdoor") for r_ in plan["rooms"])), default=(1e9, None))
            d2_ = min(((g.distance(p2_), rid) for rid, g in rooms.items() if not any(r_["id"] == rid and r_.get("is_outdoor") for r_ in plan["rooms"])), default=(1e9, None))
            if min(d1_[0], d2_[0]) <= 60:  # takes that room (within 60 cm); the other side is outside
                if d1_[0] <= d2_[0]:
                    s1 = d1_[1]
                else:
                    s2 = d2_[1]
        if s1 == s2 and s1 is not None and o.get("kind") != "entry_door":
            internal.append(o["id"])
            continue
        o["rooms"] = [x_ or "outside" for x_ in (s1, s2)]
        dup_o = [k_ for k_ in clean if math.hypot(k_["centre_cm"][0] - cx_o, k_["centre_cm"][1] - cy_o) <= 45]
        if dup_o:
            if o.get("kind") == "entry_door":
                dup_o[0]["kind"] = "entry_door"
            continue
        clean.append(o)
    # (round 18) an open passage to OUTSIDE that lies on a window is the window, not an opening (846: bedroom 2's NE window)
    panes_g = [Polygon(p_["polygon_cm"]).buffer(0) for p_ in plan.get("panes", []) if len(p_.get("polygon_cm", [])) >= 3]
    clean = [o for o in clean if not (o.get("kind") == "opening" and "outside" in (o.get("rooms") or [])
                                      and any(g_.distance(Point(o["centre_cm"])) <= 25 for g_ in panes_g))]
    plan["openings"] = clean
    ent_m = (plan.get("plan_meta") or {}).get("entrance")
    if ent_m and ent_m.get("opening") not in {o["id"] for o in clean}:     # (round 18) the entrance record follows the merge
        e_o = next((o for o in clean if o.get("kind") == "entry_door"), None)
        if e_o:
            ent_m["opening"] = e_o["id"]
    if internal:
        plan["plan_meta"]["internal_doors"] = internal
    json.dump({"arcs": arcs, "added": added, "entrance": entrance}, open(os.path.join(d_, "doors.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    gl_p = os.path.join(os.path.dirname(plan_p), "glazing.json")
    if os.path.exists(gl_p):
        gl = json.load(open(gl_p)).get("glazing", [])
        have = [Polygon(p_["polygon_cm"]).buffer(0) for p_ in plan.get("panes", []) if len(p_.get("polygon_cm", [])) >= 3]
        added = 0
        for i, g_ in enumerate(gl):
            poly = [[round(x / ppc, 1), round(y / ppc, 1)] for x, y in g_["rect_px"]]
            pg = Polygon(poly).buffer(0)
            if any(h.intersects(pg) for h in have):
                continue
            xs_, ys_ = zip(*poly)
            plan.setdefault("panes", []).append({"id": f"window-auto-{i + 1}", "kind": "window", "sill_cm": 90, "head_cm": 215, "polygon_cm": poly,
                                                 "bbox_cm": [round(min(xs_), 1), round(min(ys_), 1), round(max(xs_), 1), round(max(ys_), 1)], "diag_cm": round(math.hypot(max(xs_) - min(xs_), max(ys_) - min(ys_)), 1),
                                                 "source": "auto_prep.py: a blue glazing bar on the brochure plan (sill/head assumed: no section)"})
            added += 1
        if added:
            plan["plan_meta"].setdefault("assumptions", []).append(f"{added} window bars read from the plan's blue glazing symbols; sill 90 / head 215 cm assumed")
    # --- the printed room dims: measured (minimum rotated rectangle of the traced room) vs printed; fit the scale when asked
    fit = "--fit-dims" in sys.argv
    seeds = json.load(open(seeds_p, encoding="utf-8"))
    dims_of = {s_["room_id"]: s_.get("dims_cm") for s_ in seeds if s_.get("dims_cm")}
    name_of = {s_["room_id"]: s_.get("name_he") for s_ in seeds}
    ratios, dim_rows = [], []
    for r in plan["rooms"]:
        p = rooms[r["id"]]
        if p.is_empty:
            continue
        g = p if p.geom_type == "Polygon" else max(p.geoms, key=lambda q: q.area)
        mrr = g.minimum_rotated_rectangle
        xs, ys = mrr.exterior.coords.xy
        e1 = math.hypot(xs[1] - xs[0], ys[1] - ys[0]); e2 = math.hypot(xs[2] - xs[1], ys[2] - ys[1])
        meas = sorted([e1, e2], reverse=True)
        d = dims_of.get(r["id"])
        row = {"room": r["id"], "name_he": name_of.get(r["id"]), "measured_cm": [round(meas[0]), round(meas[1])], "printed_cm": d}
        if d and len(d) == 2 and min(d) > 0:
            pr = sorted(d, reverse=True)
            row["ratio"] = [meas[0] / pr[0], meas[1] / pr[1]]
            ratios += row["ratio"]
        dim_rows.append(row)
    factor = 1.0
    if fit and len(ratios) >= 2:
        factor = float(np.median(ratios))            # measured = factor × printed  → every cm value shrinks by 1/factor
        def sc(v):
            if isinstance(v, list): return [sc(x) for x in v]
            if isinstance(v, (int, float)) and not isinstance(v, bool): return round(v / factor, 1)
            return v
        for r in plan["rooms"]:
            for k in ("loop", "bbox_cm", "clear_dims_cm"):
                if k in r: r[k] = sc(r[k])
            if "area_m2" in r: r["area_m2"] = round(r["area_m2"] / factor ** 2, 3)
        for w in plan.get("walls", []):
            w["polygon_cm"] = sc(w["polygon_cm"]); w["area_cm2"] = round(w.get("area_cm2", 0) / factor ** 2)
        for o in plan.get("openings", []):
            for k in ("a_cm", "b_cm", "centre_cm", "width_cm"):
                if k in o and o[k] is not None: o[k] = sc(o[k])
        for pn in plan.get("panes", []):
            for k in ("polygon_cm", "bbox_cm", "diag_cm"):
                if k in pn: pn[k] = sc(pn[k])
        for cp in plan.get("camera_points", []):
            cp["x"], cp["y"] = sc(cp["x"]), sc(cp["y"])
        for f in plan["fixtures"]:
            for k in ("polygon_cm", "centre_cm", "size_cm"):
                f[k] = sc(f[k])
        rooms = {r["id"]: Polygon(r["loop"]).buffer(0) for r in plan["rooms"]}
        new_ppc = ppc * factor
        plan["plan_meta"]["scale_px_per_cm"] = round(new_ppc, 4)
        plan["plan_meta"]["scale_basis"] = f"fitted from the printed room dimensions: {len(ratios) // 2} rooms, median ratio {factor:.4f} over the nominal {ppc} px/cm -> {new_ppc:.4f} px/cm"
        plan["axes"] = plan["axes"].replace(f"{ppc} px/cm", f"{new_ppc:.4f} px/cm") if "px/cm" in plan.get("axes", "") else plan.get("axes")
        ppc = new_ppc
        for row in dim_rows:
            row["measured_cm"] = [round(v / factor) for v in row["measured_cm"]]
    # (T17, 2026-11-06) THE PRINT WINS (Eliran 2026-11-04/05: the simulation matches the sales plan; the coordinator
    #    2026-11-06). A brochure draws a room a little off its printed size (Maale: the first-floor bath drawn 262 x 184 for
    #    275/190). A closed room with printed dims, off the tolerance (max(2 %, 5 cm)) on a side but by no more than 6 %
    #    and 25 cm on every side (a drawing imprecision, not a wrong room: a wrong room is left failing), is stretched to its
    #    printed size about its own centre along that axis — the walls around it give or take the half-difference. Never when the new
    #    rectangle would overlap another room. Raster plans only (a PDF is measured on its own dimension lines).
    if not os.path.exists(os.path.join(d_, "pdf-vectors.json")):
        fixed_print = []
        niche_back = {}
        # (T15) the niches auto_rooms recorded (a recess walled on its other sides, open only to its room): the size work
        #    below runs on the room's own body; each niche goes back to its room at the end
        rj_p = os.path.join(d_, "rooms.json")
        rec_n = json.load(open(rj_p, encoding="utf-8")).get("niches", {}) if os.path.exists(rj_p) else {}
        for rid_n, loops_n in rec_n.items():
            r = next((r_ for r_ in plan["rooms"] if r_["id"] == rid_n), None)
            if r is None or rid_n not in rooms:
                continue
            npoly = unary_union([Polygon([[x_ / factor, y_ / factor] for x_, y_ in l_]).buffer(0) for l_ in loops_n if len(l_) >= 3]).buffer(1.5)
            body = rooms[rid_n].difference(npoly)
            body = body if body.geom_type == "Polygon" else max(body.geoms, key=lambda q: q.area)
            got_n = rooms[rid_n].intersection(npoly)
            if got_n.is_empty or body.is_empty:
                continue
            niche_back.setdefault(rid_n, []).append(got_n)
            rooms[rid_n] = body
            r["loop"] = [[round(x, 1), round(y, 1)] for x, y in list(body.simplify(0.5).exterior.coords)[:-1]]
            for row in dim_rows:
                if row["room"] == rid_n:
                    mrr = body.minimum_rotated_rectangle
                    xs, ys = mrr.exterior.coords.xy
                    row["measured_cm"] = [round(v_) for v_ in sorted([math.hypot(xs[1] - xs[0], ys[1] - ys[0]), math.hypot(xs[2] - xs[1], ys[2] - ys[1])], reverse=True)]
        wo_p = os.path.join(d_, "walls-only.png")
        walls_dt = None
        if os.path.exists(wo_p):
            wo_ = cv2.imread(wo_p, cv2.IMREAD_GRAYSCALE)
            walls_dt = cv2.distanceTransform((wo_ <= 127).astype(np.uint8), cv2.DIST_L2, 5)
        for row in dim_rows:
            d = row.get("printed_cm")
            r = next((r_ for r_ in plan["rooms"] if r_["id"] == row["room"]), None)
            if not d or len(d) != 2 or r is None or r.get("is_outdoor"):
                continue
            pr = sorted(d, reverse=True)
            ms = row["measured_cm"]
            tol = [max(0.02 * pr[i], 5) for i in range(2)]
            if all(abs(ms[i] - pr[i]) <= tol[i] for i in range(2)):
                continue
            # (T17b) a room LONGER than its print, by up to 12 % and 60 cm, whose end on that axis is NOT a drawn wall (it
            #    opens onto a neighbour: Maale ground, the kitchen runs on into the stair recess, 527 against 485): the print
            #    places the undrawn boundary — the room is cut to its printed length from its walled end, and the piece cut
            #    off joins the unprinted room it opens onto
            g = Polygon(r["loop"]).buffer(0)
            mrr = g.minimum_rotated_rectangle
            xs, ys = mrr.exterior.coords.xy
            ax_ = [(xs[1] - xs[0], ys[1] - ys[0]), (xs[2] - xs[1], ys[2] - ys[1])]
            ax_ = sorted(ax_, key=lambda e: -math.hypot(*e))                  # long axis first, as pr and ms
            for i in range(2):
                if ms[i] - pr[i] <= tol[i] or ms[i] - pr[i] > min(0.12 * pr[i], 60) or walls_dt is None:
                    continue
                Lw = math.hypot(*ax_[i]); w = (ax_[i][0] / Lw, ax_[i][1] / Lw)
                pts_b = [g.exterior.interpolate(t_) for t_ in np.arange(0, g.exterior.length, 5.0)]
                tt = [p_.x * w[0] + p_.y * w[1] for p_ in pts_b]
                t0, t1 = min(tt), max(tt)

                def walled(at):
                    near = [p_ for p_, t_ in zip(pts_b, tt) if abs(t_ - at) <= 15]
                    if not near:
                        return 0.0
                    ok_ = 0
                    for p_ in near:
                        X, Y = int(p_.x * ppc), int(p_.y * ppc)
                        ok_ += 0 <= Y < walls_dt.shape[0] and 0 <= X < walls_dt.shape[1] and walls_dt[Y, X] / ppc <= 20
                    return ok_ / len(near)
                f0, f1 = walled(t0), walled(t1)
                if max(f0, f1) < 0.6 or abs(f0 - f1) < 0.25:
                    continue                                 # no clearly walled end to measure from
                big = 1e5
                n_ = (-w[1], w[0])
                if f0 >= f1:                                 # walled at t0: keep t <= t0 + printed
                    cut_t = t0 + pr[i]
                    keep = Polygon([(w[0] * (cut_t - big) + n_[0] * s_, w[1] * (cut_t - big) + n_[1] * s_) for s_ in (-big, big)] +
                                   [(w[0] * cut_t + n_[0] * s_, w[1] * cut_t + n_[1] * s_) for s_ in (big, -big)])
                else:
                    cut_t = t1 - pr[i]
                    keep = Polygon([(w[0] * cut_t + n_[0] * s_, w[1] * cut_t + n_[1] * s_) for s_ in (-big, big)] +
                                   [(w[0] * (cut_t + big) + n_[0] * s_, w[1] * (cut_t + big) + n_[1] * s_) for s_ in (big, -big)])
                ng = g.intersection(keep.buffer(0))
                off = g.difference(keep.buffer(0))
                if ng.is_empty or ng.geom_type != "Polygon":
                    continue
                g = ng
                r["loop"] = [[round(x, 1), round(y, 1)] for x, y in list(g.simplify(0.5).exterior.coords)[:-1]]
                r["area_m2"] = round(g.area / 1e4, 3)
                rooms[r["id"]] = g
                gave = []
                for piece in (getattr(off, "geoms", None) or [off]):
                    if piece.is_empty or piece.area < 100:
                        continue
                    # each part of the cut piece joins the room it opens onto, by walking distance inside the piece: an
                    # unprinted neighbour it touches across no wall, or — a niche walled on its other sides (Maale: the
                    # recess under the upper flight, open only to the kitchen) — the room itself, as a niche outside its
                    # printed size
                    cands = [o for o in rooms if o != r["id"] and not dims_of.get(o) and piece.boundary.intersection(rooms[o].buffer(3)).length >= 10]
                    owners = cands + [r["id"]]
                    bx0, by0, bx1, by1 = piece.bounds
                    S_ = 2.0                                   # cm per px
                    Wq, Hq = int((bx1 - bx0) / S_) + 3, int((by1 - by0) / S_) + 3
                    to_px = lambda geom: np.round((np.array(geom.exterior.coords) - [bx0 - S_, by0 - S_]) / S_).astype(np.int32)
                    pm = np.zeros((Hq, Wq), np.uint8); cv2.fillPoly(pm, [to_px(piece)], 1)
                    lab = np.zeros((Hq, Wq), np.int32)
                    for oi, o in enumerate(owners):
                        og_ = g if o == r["id"] else rooms[o]
                        om = np.zeros((Hq, Wq), np.uint8)
                        for gg in (getattr(og_.buffer(4), "geoms", None) or [og_.buffer(4)]):
                            cv2.fillPoly(om, [to_px(gg)], 1)
                        lab[(om > 0) & (pm > 0) & (lab == 0)] = oi + 1
                    frontier = lab > 0
                    while True:                                # geodesic growth inside the piece
                        grown = cv2.dilate(lab.astype(np.float32), np.ones((3, 3), np.uint8)).astype(np.int32)
                        new_px = (pm > 0) & (lab == 0) & (grown > 0)
                        if not new_px.any():
                            break
                        lab[new_px] = grown[new_px]
                    for oi, o in enumerate(owners):
                        part = ((lab == oi + 1) & (pm > 0)).astype(np.uint8)
                        if part.sum() * S_ * S_ < 100:
                            continue
                        cs_, _ = cv2.findContours(part, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                        polys = [Polygon((c_.reshape(-1, 2) * S_ + [bx0 - S_, by0 - S_]).tolist()).buffer(0) for c_ in cs_ if len(c_) >= 3]
                        pp = unary_union([q for q in polys if not q.is_empty]).intersection(piece.buffer(1))
                        if pp.is_empty:
                            continue
                        if o == r["id"]:
                            niche_back.setdefault(o, []).append(pp)
                            gave.append(f"{pp.area / 1e4:.2f} m² niche open only to it -> stays {o}, outside its printed size")
                            continue
                        u_ = unary_union([rooms[o], pp.buffer(0.5)]).buffer(-0.5)
                        u_ = u_ if u_.geom_type == "Polygon" else max(u_.geoms, key=lambda q: q.area)
                        ro = next(r_ for r_ in plan["rooms"] if r_["id"] == o)
                        ro["loop"] = [[round(x, 1), round(y, 1)] for x, y in list(u_.simplify(0.5).exterior.coords)[:-1]]
                        ro["area_m2"] = round(u_.area / 1e4, 3)
                        rooms[o] = u_
                        gave.append(f"{pp.area / 1e4:.2f} m² -> {o}")
                mrr2 = g.minimum_rotated_rectangle
                xs2, ys2 = mrr2.exterior.coords.xy
                ms = [round(v) for v in sorted([math.hypot(xs2[1] - xs2[0], ys2[1] - ys2[0]), math.hypot(xs2[2] - xs2[1], ys2[2] - ys2[1])], reverse=True)]
                row["drawn_cm"] = row["measured_cm"]
                row["measured_cm"] = ms
                fixed_print.append(f"{r['id']} cut to its printed {pr[i]} cm from its walled end ({gave or 'cut piece left out'})")
                break
            if all(abs(ms[i] - pr[i]) <= tol[i] for i in range(2)):
                continue
            if any(abs(ms[i] - pr[i]) > min(0.06 * pr[i], 25) for i in range(2)):
                continue
            # stretch the room along each off axis about its centre: the vertices at each end (within 15 cm of it) move
            # out (or in) by half the difference; the room keeps its drawn shape (a window reveal, a notch)
            g = Polygon(r["loop"]).buffer(0)
            mrr = g.minimum_rotated_rectangle
            xs, ys = mrr.exterior.coords.xy
            axs = sorted([(xs[1] - xs[0], ys[1] - ys[0]), (xs[2] - xs[1], ys[2] - ys[1])], key=lambda e: -math.hypot(*e))
            new = [list(map(float, q)) for q in r["loop"]]
            for i in range(2):
                dlt = pr[i] - ms[i]
                if abs(dlt) <= tol[i]:
                    continue
                Lw = math.hypot(*axs[i]); w = (axs[i][0] / Lw, axs[i][1] / Lw)
                tt = [q[0] * w[0] + q[1] * w[1] for q in new]
                t0, t1 = min(tt), max(tt)
                for q, t_ in zip(new, tt):
                    if t_ - t0 <= 15:
                        q[0] -= w[0] * dlt / 2; q[1] -= w[1] * dlt / 2
                    elif t1 - t_ <= 15:
                        q[0] += w[0] * dlt / 2; q[1] += w[1] * dlt / 2
            new = [[round(q[0], 1), round(q[1], 1)] for q in new]
            if not Polygon(new).is_valid:
                plan["plan_meta"].setdefault("assumptions", []).append(f"{r['id']}: printed {pr} cm, drawn {ms} cm; the stretch is not a valid polygon — left as drawn")
                continue
            ng = Polygon(new)
            over = {o: ng.intersection(rooms[o]).area for o in rooms if o != r["id"] and ng.intersection(rooms[o]).area > 50}
            # a neighbour WITHOUT printed dims (a hall, a corridor met across a door) gives way, up to 0.2 m²; a printed
            # neighbour never does — then the room is left as drawn
            if any(dims_of.get(o) or a_ > 2000 for o, a_ in over.items()):
                plan["plan_meta"].setdefault("assumptions", []).append(f"{r['id']}: printed {pr} cm, drawn {ms} cm; the stretched room would overlap {sorted(over)} — left as drawn")
                continue
            for o in over:
                og = rooms[o].difference(ng)
                og = og if og.geom_type == "Polygon" else max(og.geoms, key=lambda q: q.area)
                ro = next(r_ for r_ in plan["rooms"] if r_["id"] == o)
                ro["loop"] = [[round(x, 1), round(y, 1)] for x, y in list(og.simplify(0.5).exterior.coords)[:-1]]
                ro["area_m2"] = round(og.area / 1e4, 3)
                rooms[o] = og
            r["loop"] = new
            xs_, ys_ = zip(*new)
            r["bbox_cm"] = [min(xs_), min(ys_), max(xs_), max(ys_)]
            r["area_m2"] = round(ng.area / 1e4, 3)
            r["print_wins"] = {"drawn_cm": ms, "printed_cm": pr}
            rooms[r["id"]] = ng
            row["drawn_cm"] = ms
            mrr2 = ng.minimum_rotated_rectangle
            xs2, ys2 = mrr2.exterior.coords.xy
            row["measured_cm"] = [round(v_) for v_ in sorted([math.hypot(xs2[1] - xs2[0], ys2[1] - ys2[0]), math.hypot(xs2[2] - xs2[1], ys2[2] - ys2[1])], reverse=True)]
            fixed_print.append(f"{r['id']} {ms}->{row['measured_cm']} (printed {pr})")
        for o, parts in niche_back.items():           # the niches go back to their room after its stretch
            u_ = unary_union([rooms[o]] + [q.buffer(1.0) for q in parts]).buffer(-1.0)
            u_ = u_ if u_.geom_type == "Polygon" else max(u_.geoms, key=lambda q: q.area)
            ro = next(r_ for r_ in plan["rooms"] if r_["id"] == o)
            ro["loop"] = [[round(x, 1), round(y, 1)] for x, y in list(u_.simplify(0.5).exterior.coords)[:-1]]
            xs_, ys_ = zip(*ro["loop"])
            ro["bbox_cm"] = [min(xs_), min(ys_), max(xs_), max(ys_)]
            ro["area_m2"] = round(u_.area / 1e4, 3)
            ro["niche_m2"] = round(sum(q.area for q in parts) / 1e4, 2)
            rooms[o] = u_
            for row in dim_rows:
                if row["room"] == o:
                    row["measured_on"] = f"the room without its {ro['niche_m2']} m² walled niche (open only to it; the print measures the room's own rectangle)"
        if fixed_print:
            plan["plan_meta"].setdefault("assumptions", []).append("the print wins (T17): rooms set to their printed size about their centre: " + "; ".join(fixed_print))
    for row in dim_rows:
        if row.get("printed_cm"):
            pr = sorted(row["printed_cm"], reverse=True)
            row["delta_pct"] = [round(100 * (row["measured_cm"][i] - pr[i]) / pr[i], 1) for i in range(2)]
    could_not = [f"room {rid}: the traced region was degenerate (fewer than 3 points) and was dropped" for rid in degenerate]
    for s_ in seeds:
        if s_["room_id"] not in rooms:
            could_not.append(f"room '{s_.get('name_he')}' ({s_['room_id']}): no closed region was traced around its label (the flood leaked or the label sits on a line)")
    for row in dim_rows:
        if not row.get("printed_cm"):
            could_not.append(f"room '{row['name_he']}' ({row['room']}): no printed dimensions were read; its size comes from the drawing only")
        elif max(abs(x) for x in row["delta_pct"]) > 3:
            could_not.append(f"room '{row['name_he']}' ({row['room']}): traced {row['measured_cm']} cm vs printed {row['printed_cm']} cm ({row['delta_pct']} %) — check the trace or the reading")
    if not fixtures:
        could_not.append("no fixed elements (kitchen run, sanitary, closets) were read from the drawing")
    report = {"rooms": len(plan["rooms"]), "fixtures": len(fixtures), "scale_px_per_cm": round(ppc, 4), "scale_fit_factor": round(factor, 4), "scale_fitted": fit and factor != 1.0,
              "dims": dim_rows, "could_not_read": could_not, "legend": [{"n": i + 1, "id": r["id"], "name_he": name_of.get(r["id"]), "area_m2": r.get("area_m2")} for i, r in enumerate(plan["rooms"])]}
    rep_p = ov_p.rsplit(".", 1)[0].replace("overlay", "report") + ".json"
    json.dump(report, open(rep_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    md = ["# auto-trace report", "", f"rooms: {len(plan['rooms'])} · fixtures: {len(fixtures)} · scale: {ppc:.4f} px/cm" + (f" (fitted ×{factor:.4f} from the printed dims)" if report["scale_fitted"] else ""), "",
          "| # | room | printed cm | traced cm | delta % | m² |", "|---|---|---|---|---|---|"]
    for i, r in enumerate(plan["rooms"], start=1):
        row = next((x for x in dim_rows if x["room"] == r["id"]), {})
        md.append(f"| {i} | {name_of.get(r['id']) or r['id']} | {('×'.join(map(str, sorted(row['printed_cm'], reverse=True))) if row.get('printed_cm') else '—')} | {'×'.join(map(str, row.get('measured_cm', [])))} | {('/'.join(map(str, row['delta_pct'])) if row.get('delta_pct') else '—')} | {r.get('area_m2', 0):.2f} |")
    md += ["", "## could not read / check", ""] + ([f"- {x}" for x in could_not] or ["- nothing: every room has printed dimensions within 3 % of the trace"])
    open(rep_p.replace(".json", ".md"), "w", encoding="utf-8").write(chr(10).join(md))
    plan["plan_meta"]["dominant_wall_angle_deg"] = round(ang, 1)
    # (T32, 2026-11-07) every loop edge says what it is (SCHEMA rooms[].edge_kinds; the builder reads "wall" only): "wall"
    #    where a wall polygon stands within 12 cm behind it (the builder's facing band) on >= 30 % of the edge — the builder
    #    then builds the facing ON the loop edge, so the built face is the traced face (fork F's render gate: the auto
    #    plan had no edge_kinds, so the render showed the raw wall polygons 2.5-4.3 cm behind the guest-bath and
    #    master-bedroom loops; the hand plan, with edge_kinds, passes 11/11); "open" where it borders another room across
    #    no structure (a zone boundary); "line" otherwise (glass, a railing, a drawn line)
    walls_k = unary_union([Polygon(w["polygon_cm"]).buffer(0) for w in plan.get("walls", []) if len(w.get("polygon_cm", [])) >= 3])
    rooms_k = {r["id"]: Polygon(r["loop"]).buffer(0) for r in plan["rooms"]}
    n_kind = {"wall": 0, "line": 0, "open": 0}
    for r in plan["rooms"]:
        L_k = r["loop"]; g_k = rooms_k[r["id"]]
        kinds_k = []
        for i_k in range(len(L_k)):
            A_k, B_k = np.array(L_k[i_k], float), np.array(L_k[(i_k + 1) % len(L_k)], float)
            Le_k = float(np.linalg.norm(B_k - A_k))
            if Le_k < 1e-6:
                kinds_k.append("line"); continue
            u_k = (B_k - A_k) / Le_k; nn_k = np.array([-u_k[1], u_k[0]])
            if g_k.contains(Point(*((A_k + B_k) / 2 + nn_k * 0.5))):
                nn_k = -nn_k
            ts_k = np.linspace(0.1, 0.9, max(2, min(20, int(Le_k / 10))))
            backed = sum(1 for t_k in ts_k if not walls_k.is_empty and
                         walls_k.intersects(LineString([tuple(A_k + (B_k - A_k) * t_k + nn_k * 0.3), tuple(A_k + (B_k - A_k) * t_k + nn_k * 12)])))
            if backed >= 0.3 * len(ts_k):
                kinds_k.append("wall")
            elif any(o_id != r["id"] and g_o.distance(Point(*((A_k + B_k) / 2 + nn_k * 3))) < 1.0 for o_id, g_o in rooms_k.items()):
                kinds_k.append("open")
            else:
                kinds_k.append("line")
        r["edge_kinds"] = kinds_k
        for k_ in kinds_k:
            n_kind[k_] += 1
    plan["plan_meta"]["edge_kinds_written"] = n_kind
    # (T33) the built face is now the loop's 'wall' edge, so that edge must sit where the drawing says the wall is: a room
    #    dimension's end that lands on its own 'wall' edge 0.4-3 cm off its tick slides the edge onto the tick (fork A's shared
    #    printed_dimensions.fit_edges; beyond 3 cm the trace is wrong and is left to fail)
    if os.path.exists(pv_fx):
        try:
            import dim_chains as _dc2
            import dims_gate as _dg2
            import printed_dimensions as _PD2
            _pv2 = json.load(open(pv_fx, encoding="utf-8"))
            _lines2 = _dg2.pdf_lines(_dc2.chains(_pv2.get("dimension_segments_px", []), ppc), lambda x_, y_: (x_ / ppc, y_ / ppc))
            _fit = _PD2.fit_edges(plan, _PD2.measure(plan, _lines2, 1.0)["rows"])
            if _fit:
                plan["plan_meta"]["edges_fit_to_ticks"] = [[m_[0], m_[1], round(m_[2], 1)] for m_ in _fit]
                for r in plan["rooms"]:
                    g_r = Polygon(r["loop"]).buffer(0)
                    r["area_m2"] = round(g_r.area / 1e4, 3)
        except Exception as e_:
            plan["plan_meta"]["edges_fit_to_ticks_error"] = str(e_)[:200]
    json.dump(plan, open(plan_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # the approval overlay
    img = cv2.imread(crop_p)
    over = img.copy()
    rng = np.random.default_rng(3)
    for i, r in enumerate(plan["rooms"]):
        col = tuple(int(c) for c in rng.integers(40, 230, 3))
        pts = np.array([[int(x * ppc), int(y * ppc)] for x, y in r["loop"]], np.int32)
        cv2.fillPoly(over, [pts], col)
        cv2.polylines(img, [pts], True, col, 6)
    img = cv2.addWeighted(over, 0.28, img, 0.72, 0)
    for f in fixtures:
        cv2.polylines(img, [np.array([[int(x * ppc), int(y * ppc)] for x, y in f["polygon_cm"]], np.int32)], True, (0, 0, 220), 5)
    for i, r in enumerate(plan["rooms"], start=1):
        g = rooms[r["id"]]
        g = g if g.geom_type == "Polygon" else max(g.geoms, key=lambda q: q.area)
        q = polylabel(g, tolerance=2.0)
        x, y = int(q.x * ppc), int(q.y * ppc)
        cv2.circle(img, (x, y), 34, (255, 255, 255), -1); cv2.circle(img, (x, y), 34, (0, 0, 0), 3)
        cv2.putText(img, str(i), (x - 18 if i > 9 else x - 10, y + 12), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 0, 0), 3)
        cv2.putText(img, f"{r.get('area_m2', 0):.1f}", (x - 34, y + 70), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 3)
    # (round 18) windows (panes) drawn as blue bars along their long axis: the judge reads them («blue bars are windows»)
    for pn in plan.get("panes", []):
        P_ = pn.get("polygon_cm") or []
        if len(P_) < 3:
            continue
        g_ = Polygon(P_).buffer(0)
        if g_.is_empty:
            continue
        in_ = [r_ for r_ in plan["rooms"] if not r_.get("is_outdoor") and Polygon(r_["loop"]).buffer(0).distance(g_.centroid) <= 40]
        if not in_ or any(r_.get("is_outdoor") and Polygon(r_["loop"]).buffer(0).contains(g_.centroid) for r_ in plan["rooms"]):
            continue                          # a window is on an indoor room's edge (a terrace railing line is not a window)
        mrr_ = g_.minimum_rotated_rectangle; xs_p, ys_p = mrr_.exterior.coords.xy
        e1_ = ((xs_p[0] + xs_p[1]) / 2, (ys_p[0] + ys_p[1]) / 2, (xs_p[2] + xs_p[3]) / 2, (ys_p[2] + ys_p[3]) / 2)
        e2_ = ((xs_p[1] + xs_p[2]) / 2, (ys_p[1] + ys_p[2]) / 2, (xs_p[3] + xs_p[0]) / 2, (ys_p[3] + ys_p[0]) / 2)
        L1 = math.hypot(e1_[2] - e1_[0], e1_[3] - e1_[1]); L2 = math.hypot(e2_[2] - e2_[0], e2_[3] - e2_[1])
        ax_ = e2_ if L1 < L2 else e1_     # the segment joining the midpoints of the short sides = the window's long axis
        if g_.area > 0.6 * max(L1, L2) * 40 or min(L1, L2) > 40:     # (round 18) a curved / thick pane: its own outline, not a chord
            cv2.polylines(img, [np.round(np.array(g_.exterior.coords) * ppc).astype(np.int32)], True, (230, 120, 0), 9)
            continue
        A_p = (int(ax_[0] * ppc), int(ax_[1] * ppc)); B_p = (int(ax_[2] * ppc), int(ax_[3] * ppc))
        cv2.line(img, A_p, B_p, (255, 255, 255), 18)
        cv2.line(img, A_p, B_p, (230, 120, 0), 11)
    # (round 17) openings drawn LAST, thick and bright, with end ticks: the judge must see them over room outlines and fixtures
    for o in plan.get("openings", []):
        if o.get("a_cm") and o.get("b_cm"):
            A_o = (int(o["a_cm"][0] * ppc), int(o["a_cm"][1] * ppc)); B_o = (int(o["b_cm"][0] * ppc), int(o["b_cm"][1] * ppc))
            cv2.line(img, A_o, B_o, (255, 255, 255), 22)
            cv2.line(img, A_o, B_o, (0, 200, 0), 14)
            for E_o in (A_o, B_o):
                cv2.circle(img, E_o, 12, (0, 120, 0), -1)
    h0, w0 = img.shape[:2]
    s = 2000 / max(h0, w0)
    cv2.imwrite(ov_p, cv2.resize(img, (int(w0 * s), int(h0 * s)), interpolation=cv2.INTER_AREA))
    print(f"auto_finalize: {len(plan['rooms'])} rooms, {len(fixtures)} fixtures, wall angle {ang:.1f} deg, scale {ppc:.4f} px/cm (fit x{factor:.4f}), {len(could_not)} notes, overlay {ov_p}")


if __name__ == "__main__":
    main()

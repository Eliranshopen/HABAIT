#!/usr/bin/env python
"""auto_rooms.py <plan-dir> <px_per_cm>

Round 4 of auto-trace (2026-11-04): the rooms of plan.general.json rebuilt ORTHOGONALLY from the printed labels, replacing the
flood regions of trace-plan.mjs (walls, openings and panes stay).

1. The plan is rotated to its dominant wall axis (846: 17.5 deg; a brochure: 0).
2. A labelled indoor room with printed W/L = its printed rectangle at scale, containing its label, placed where it lies most
   inside the building's free space and touches most wall; then EACH EDGE is snapped to the nearest wall face (wall outside,
   floor inside) within 40 cm; where there is no wall (an open kitchen | living boundary) the printed edge stays.
   Overlaps go to the rectangle that holds the pixel deeper. Rooms are clipped to the free space inside the envelope.
3. The open space is partitioned ONLY by these rectangles. A leftover piece that holds an indoor label without dims (stairs,
   entrance) becomes that room (inside the label's reading box when there is one); else it joins the labelled room it opens into
   (the longest shared edge), and becomes its own «מבואה» only when it is >= 3 m2 and touches the entrance door.
4. An indoor room whose label is printed outside the envelope (כניסה on the front path) is placed at the door, on the inside.
5. Outdoor rooms (מרפסת / חצר / פטיו) are the free space outside the envelope around their label, inside their reading box.
6. Polygons: every edge within 12 deg of an axis is snapped to the axis; a non-axis edge is kept only where the wall band along it
   is itself diagonal or curved (846's curved facade).
Writes the rooms into plan.general.json (source "auto_rooms") and rooms-debug.png.
"""
import json
import math
import re
import os
import sys

import cv2
import numpy as np
from shapely.geometry import Point, Polygon

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from auto_split import best_rect, dominant_angle   # noqa: E402

F = 3


def rot_setup(H, W, ang):
    M = cv2.getRotationMatrix2D((W / 2, H / 2), ang, 1.0)
    c, s = abs(M[0, 0]), abs(M[0, 1])
    nW, nH = int(H * s + W * c) + 4, int(H * c + W * s) + 4
    M[0, 2] += nW / 2 - W / 2
    M[1, 2] += nH / 2 - H / 2
    Mi = cv2.invertAffineTransform(M)
    return M, Mi, (nW, nH)


def tp(M, x, y):
    return (M[0, 0] * x + M[0, 1] * y + M[0, 2], M[1, 0] * x + M[1, 1] * y + M[1, 2])


def snap_edges(rect, bar, free, t, keep_size=None):
    """rect = [x0, y0, x1, y1] in the rotated frame; move each edge to the nearest wall face within t px."""
    x0, y0, x1, y1 = [int(round(v)) for v in rect]
    H, W = bar.shape
    def score_v(x, ys, side):          # vertical edge at column x; side -1 = wall on the left, +1 = wall on the right
        xw = x + side
        if not (0 <= xw < W and 0 <= x < W) or len(ys) == 0:
            return -1
        return bar[ys, xw].mean() - bar[ys, x].mean()
    def score_h(y, xs, side):
        yw = y + side
        if not (0 <= yw < H and 0 <= y < H) or len(xs) == 0:
            return -1
        return bar[yw, xs].mean() - bar[y, xs].mean()
    ys = np.arange(max(0, y0 + (y1 - y0) // 10), min(H, y1 - (y1 - y0) // 10))
    xs = np.arange(max(0, x0 + (x1 - x0) // 10), min(W, x1 - (x1 - x0) // 10))
    best = lambda cands: max(cands, key=lambda c: c[0]) if cands else (-1, None)
    s, v = best([(score_v(x, ys, -1), x) for x in range(x0 - t, x0 + t + 1)])
    nx0 = v if s >= 0.4 else x0
    s, v = best([(score_v(x, ys, +1), x) for x in range(x1 - t, x1 + t + 1)])
    nx1 = v if s >= 0.4 else x1
    s, v = best([(score_h(y, xs, -1), y) for y in range(y0 - t, y0 + t + 1)])
    ny0 = v if s >= 0.4 else y0
    s, v = best([(score_h(y, xs, +1), y) for y in range(y1 - t, y1 + t + 1)])
    ny1 = v if s >= 0.4 else y1
    if keep_size is not None:      # (round 6) a printed rectangle keeps its printed size: a snap may move, not stretch it
        A, B, tol = keep_size
        def pick(o0, o1, n0, n1, size):
            for c0, c1 in ((n0, n1), (n0, n0 + size), (n1 - size, n1), (o0, o1)):
                if abs((c1 - c0) - size) <= tol(size):
                    return c0, c1
            return o0, o1
        nx0, nx1 = pick(x0, x1, nx0, nx1, A)
        ny0, ny1 = pick(y0, y1, ny0, ny1, B)
    if nx1 - nx0 < 0.5 * (x1 - x0) or ny1 - ny0 < 0.5 * (y1 - y0):
        return [x0, y0, x1, y1], False
    return [nx0, ny0, nx1, ny1], True


def tread_flights(sub, pf):
    """(T14, 2026-11-06) stair flights drawn in a piece: >= 5 parallel axis segments of about equal length (50-150 cm,
    within 25 % of each other), spaced 18-35 cm one to the next (a 36-70 cm gap = one tread the line finder missed, at most
    two such), overlapping >= 70 % along their length — treads, not floor
    tiles (60+ cm apart) or long tile lines. Further runs of >= 3 such lines (winders, a U-stair's
    second flight across its well) within 120 cm of the first join it. Returns the flights' bounding box (x0, y0, x1, y1) in px and the tread count, or None."""
    ls = cv2.HoughLinesP(sub.astype(np.uint8) * 255, 1, np.pi / 180, 15, minLineLength=int(40 * pf), maxLineGap=3)
    if ls is None:
        return None
    segs = {0: [], 1: []}                      # 0: vertical (x, y0, y1); 1: horizontal (y, x0, x1)
    for x1, y1, x2, y2 in ls.reshape(-1, 4):
        if abs(x2 - x1) <= 2:
            segs[0].append([(x1 + x2) / 2, min(y1, y2), max(y1, y2)])
        elif abs(y2 - y1) <= 2:
            segs[1].append([(y1 + y2) / 2, min(x1, x2), max(x1, x2)])
    runs = []
    for o in (0, 1):
        merged = []                            # collinear duplicates -> one line
        for c, a, b in sorted(segs[o]):
            for m in merged:
                if abs(m[0] - c) <= 3 and a <= m[2] + 3 and b >= m[1] - 3:
                    m[1], m[2] = min(m[1], a), max(m[2], b)
                    break
            else:
                merged.append([c, a, b])
        lines = sorted(l_ for l_ in merged if 50 * pf <= l_[2] - l_[1] <= 150 * pf)
        used = set()
        for i in range(len(lines)):
            if i in used:
                continue
            run = [i]
            for j in range(i + 1, len(lines)):
                p, q = lines[run[-1]], lines[j]
                gap = (q[0] - p[0]) / pf
                if gap < 18:
                    continue
                if gap > 70:                       # 36-70 cm: one tread the line finder missed
                    break
                lp, lq = p[2] - p[1], q[2] - q[1]
                ov = min(p[2], q[2]) - max(p[1], q[1])
                if abs(lp - lq) <= 0.25 * max(lp, lq) and ov >= 0.7 * min(lp, lq):
                    run.append(j)
            gaps_ = [(lines[run[q + 1]][0] - lines[run[q]][0]) / pf for q in range(len(run) - 1)]
            n_step = sum(1 for g_ in gaps_ if 18 <= g_ <= 35)
            if len(run) >= 3 and n_step >= max(2, len(gaps_) - 2):
                used.update(run)
                ls_ = [lines[r] for r in run]
                c0, c1 = ls_[0][0], ls_[-1][0]
                a0, a1 = min(l_[1] for l_ in ls_), max(l_[2] for l_ in ls_)
                box = (c0, a0, c1, a1) if o == 0 else (a0, c0, a1, c1)
                runs.append((len(run) + sum(1 for g_ in gaps_ if g_ > 35), box, float(np.median([l_[2] - l_[1] for l_ in ls_]))))     # + the missed treads
    if not runs or max(n for n, _, _ in runs) < 5:
        return None
    runs.sort(key=lambda t: -t[0])
    x0, y0, x1, y1 = runs[0][1]
    n_tr, tread_len = runs[0][0], runs[0][2]
    g50 = 120 * pf                              # a U-stair: the second flight across the well, the landing
    for n, (a0, b0, a1, b1), _ in runs[1:]:
        if a0 <= x1 + g50 and a1 >= x0 - g50 and b0 <= y1 + g50 and b1 >= y0 - g50:
            x0, y0, x1, y1 = min(x0, a0), min(y0, b0), max(x1, a1), max(y1, b1)
            n_tr += n
    return int(x0), int(y0), int(x1), int(y1), n_tr, tread_len


def square_chamfers(pts, keep_dir, mask, bar_r, pf_):
    """(T12, 2026-11-06) a corner the room mask rounded off (a morphology / contour artefact: Maale's paved corners, the 846
    terrace where its face meets the parapet curve) is squared back: a run of off-axis edges (each > 5 deg off, none along a
    drawn line, together 30-120 cm: what the check flags; raster jaggies stay) between two axis edges is replaced by the corner of those two edges — perpendicular
    edges meet at their corner; parallel ones take the step on the side that ADDS floor. Only when the corner region it adds
    is free floor (< 10 % drawn wall/line pixels) and nothing is cut. Rotated frame: the axes are x and y."""
    n = len(pts)
    if n < 5:
        return pts
    P = [list(map(float, p)) for p in pts]

    def ang_off(i):
        a, b = P[i], P[(i + 1) % n]
        an = abs(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))) % 90
        return min(an, 90 - an)

    def is_h(i):
        a, b = P[i], P[(i + 1) % n]
        return abs(b[0] - a[0]) >= abs(b[1] - a[1])

    def elen(i):
        a, b = P[i], P[(i + 1) % n]
        return math.hypot(b[0] - a[0], b[1] - a[1])

    dt_ = cv2.distanceTransform((~bar_r).astype(np.uint8), cv2.DIST_L2, 5) if bar_r is not None else None

    def on_line(i):                                # every point of the edge within 5 cm of a drawn line (curved glass, a parapet)
        if dt_ is None:
            return False
        a, b = P[i], P[(i + 1) % n]
        for tt in np.linspace(0.1, 0.9, 9):
            X, Y = int(round(a[0] + (b[0] - a[0]) * tt)), int(round(a[1] + (b[1] - a[1]) * tt))
            if not (0 <= Y < dt_.shape[0] and 0 <= X < dt_.shape[1]) or dt_[Y, X] > 5 * pf_:
                return False
        return True

    off = [ang_off(i) > 5 and i not in keep_dir and not on_line(i) for i in range(n)]
    if not any(off) or all(off):
        return pts
    area0 = cv2.contourArea(np.array(P, np.float32))
    drop, repl = set(), {}
    i0 = next(i for i in range(n) if not off[i])
    i = i0
    seen = 0
    while seen < n:
        j = (i + 1) % n
        seen += 1
        if not off[j] or j in drop:
            i = j
            continue
        run = []
        k = j
        while off[k] and len(run) < n:
            run.append(k)
            k = (k + 1) % n
        seen += len(run) - 1
        e_prev, e_next = i, k                      # axis edges either side of the run
        i = k
        if ang_off(e_prev) > 5 or ang_off(e_next) > 5 or not (30 * pf_ <= sum(elen(r) for r in run) <= 120 * pf_):   # axis edges: the check's 5°
            continue
        A = P[run[0]]                              # run start = end of e_prev
        B = P[k]                                   # run end = start of e_next
        hp, hn = is_h(e_prev), is_h(e_next)
        if hp != hn:                               # perpendicular: the corner of the two lines
            cands = [[B[0], A[1]] if hp else [A[0], B[1]]]
        else:                                      # parallel: a step at either end
            cands = [[A[0], B[1]] if hp else [B[0], A[1]], [B[0], A[1]] if hp else [A[0], B[1]]]
            cands = [c_ for c_ in cands]
        best = None
        for X in cands:
            ring = [A] + [P[r] for r in run[1:]] + [B, X]
            region = np.zeros(mask.shape, np.uint8)
            cv2.fillPoly(region, [np.round(np.array(ring)).astype(np.int32)], 1)
            rr = region > 0
            if rr.sum() == 0:
                continue
            newP = [p for q, p in enumerate(P) if q not in run[1:]]
            # the polygon with the run's inner vertices dropped and X put between A and B
            idxA = newP.index(A)
            newP = newP[:idxA + 1] + [X] + newP[idxA + 1:]
            if cv2.contourArea(np.array(newP, np.float32)) < area0:       # this candidate cuts floor: never
                continue
            if bar_r is not None and float((rr & bar_r).sum()) / rr.sum() >= 0.10:
                continue
            if max(abs(X[0] - A[0]) + abs(X[1] - A[1]), abs(X[0] - B[0]) + abs(X[1] - B[1])) > 100 * pf_:
                continue
            best = X
            if os.environ.get("AUTO_ROOMS_DEBUG", "").endswith(".log"):
                print(f"square_chamfers: A {[round(v / pf_) for v in A]} B {[round(v / pf_) for v in B]} -> X {[round(v / pf_) for v in X]} cm (rotated), +{rr.sum() / pf_ / pf_ / 1e4:.2f} m2, run {len(run)} edges {[round(elen(r) / pf_) for r in run]} cm", file=open(os.environ["AUTO_ROOMS_DEBUG"], "a"))
            break
        if best is None:
            continue
        for r in run[1:]:
            drop.add(r)
        repl[run[0]] = best                        # insert X after A
    if not repl:
        return pts
    out = []
    for q, p in enumerate(P):
        if q in drop:
            continue
        out.append(p)
        if q in repl:
            out.append(repl[q])
    return np.array(out, float)


def mask_poly(mask, bar_r, Mi, ppc, ang_eps=12):
    """an orthogonal polygon (image frame, cm) from a room mask in the rotated frame"""
    m = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs:
        return None
    cnt = max(cs, key=cv2.contourArea)
    if cv2.contourArea(cnt) < 20:
        return None
    eps = max(1.0, 1.5 * ppc / F)
    pts = cv2.approxPolyDP(cnt, eps, True).reshape(-1, 2).astype(float)
    n = len(pts)
    # (T11, 2026-11-06) a long edge that FOLLOWS A DRAWN LINE a few degrees off the axis keeps the drawn direction (846: the
    #    terrace parapet runs 6 deg off the plan axis; snapping it about its midpoint pulled its far end 20 cm inside the
    #    parapet and left a chamfer). Raster noise on an axis wall stays under 3 deg on a 1 m edge, so axis walls still snap.
    pf_ = ppc / F
    keep_dir = set()
    if bar_r is not None:
        dt_ = cv2.distanceTransform((~bar_r).astype(np.uint8), cv2.DIST_L2, 5)
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L < 100 * pf_:
                continue
            ang = abs(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))) % 90
            if min(ang, 90 - ang) <= 3:
                continue
            ok_ = True
            if os.environ.get("AUTO_ROOMS_DEBUG"):
                dd_ = [round(float(dt_[int(round(a[1] + (b[1] - a[1]) * tt)), int(round(a[0] + (b[0] - a[0]) * tt))]) / pf_, 1) for tt in np.linspace(0.1, 0.9, 9)]
                print(f"mask_poly T11: edge {L / pf_:.0f} cm, {min(ang, 90 - ang):.1f} deg off axis, cm to the drawn line {dd_}", file=open(os.environ["AUTO_ROOMS_DEBUG"], "a") if os.environ["AUTO_ROOMS_DEBUG"].endswith(".log") else sys.stderr)
            for tt in np.linspace(0.1, 0.9, 9):
                X, Y = int(round(a[0] + (b[0] - a[0]) * tt)), int(round(a[1] + (b[1] - a[1]) * tt))
                if not (0 <= Y < dt_.shape[0] and 0 <= X < dt_.shape[1]) or dt_[Y, X] > 5 * pf_:
                    ok_ = False
                    break
            if ok_:
                keep_dir.add(i)
    # axis snap: an edge within ang_eps of vertical/horizontal takes the mean coordinate of its two ends
    for axis in (0, 1):
        for i in range(n):
            if i in keep_dir:
                continue
            a, b = pts[i], pts[(i + 1) % n]
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            if L < 1e-6:
                continue
            ang = abs(math.degrees(math.atan2(dy, dx))) % 180
            if axis == 0 and abs(ang - 90) <= ang_eps:       # vertical
                xm = (a[0] + b[0]) / 2
                pts[i][0] = pts[(i + 1) % n][0] = xm
            if axis == 1 and (ang <= ang_eps or ang >= 180 - ang_eps):
                ym = (a[1] + b[1]) / 2
                pts[i][1] = pts[(i + 1) % n][1] = ym
    pts = square_chamfers(pts, keep_dir, mask, bar_r, pf_)
    out = []
    for x, y in pts:
        X, Y = tp(Mi, x, y)
        p = [round(X * F / ppc, 1), round(Y * F / ppc, 1)]
        if not out or abs(out[-1][0] - p[0]) + abs(out[-1][1] - p[1]) > 0.5:
            out.append(p)
    if len(out) >= 2 and abs(out[0][0] - out[-1][0]) + abs(out[0][1] - out[-1][1]) <= 0.5:
        out.pop()
    if len(out) < 3:
        return None
    poly = Polygon(out).buffer(0)
    if poly.is_empty:
        return None
    if poly.geom_type != "Polygon":
        poly = max(poly.geoms, key=lambda g: g.area)
    ring = list(poly.exterior.coords)[:-1]
    return [[round(x, 1), round(y, 1)] for x, y in ring]


def main():
    d, ppc = sys.argv[1], float(sys.argv[2])
    J = lambda f, dflt=None: json.load(open(os.path.join(d, f), encoding="utf-8")) if os.path.exists(os.path.join(d, f)) else dflt
    plan, seeds = J("plan.general.json"), J("seeds.json", [])
    # (T18, 2026-11-06) a vector PDF: the rooms come from the DRAWING; the vision reading gives names and label points only.
    #    Its room boxes change from one reading to the next (846: three readings, three different kitchen / dining boxes,
    #    one dining box over the terrace, three terrace boxes), so no room takes its region from one. They stay in seeds.json.
    if os.path.exists(os.path.join(d, "pdf-vectors.json")):
        for s_ in seeds:
            if s_.get("room_box_px"):
                s_["room_box_px_reading"] = s_.pop("room_box_px")
    # WALLS ONLY (the grey wall band of plan-grey.png, windows included): trace-plan's barrier also holds its automatic
    # door-gap bars (diagonal segments between wall ends) and door leaves, which would make rooms diagonal
    grey = cv2.imread(os.path.join(d, "plan-grey.png"), cv2.IMREAD_GRAYSCALE)
    full = ((grey >= 70) & (grey <= 150)).astype(np.uint8)
    full = cv2.morphologyEx(full, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    full = cv2.morphologyEx(full, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    # (round 19) a wall drawn HATCHED in two greys (Maale ground floor: 108 / 89 stripes between the stairs and the kitchen)
    #    is its own wall class: both tones within 3 px of each other, unsaturated, closed into a band >= 8 cm thick; it is
    #    added only where it lies between two room labels (the segment joining them crosses it) — never a global tolerance
    prep_p = os.path.join(d, "prep.json")
    crop_c = cv2.imread(os.path.join(d, "crop.png"), cv2.IMREAD_COLOR)
    if os.path.exists(prep_p) and crop_c is not None and json.load(open(prep_p, encoding="utf-8")).get("mode") == "brochure" and crop_c.shape[:2] == full.shape:
        wb_ = np.array(json.load(open(prep_p, encoding="utf-8")).get("wall_bgr", [107, 107, 107]), int)
        sat_ = cv2.cvtColor(crop_c, cv2.COLOR_BGR2HSV)[..., 1] < 40
        dd_ = np.abs(crop_c.astype(int) - wb_).max(2)
        tone_a = (dd_ <= 6) & sat_                                   # the wall grey
        lum_ = crop_c.astype(int).mean(2)
        tone_b = (lum_ >= wb_.mean() - 26) & (lum_ <= wb_.mean() - 12) & sat_   # the darker stripe
        k3_ = np.ones((7, 7), np.uint8)
        both = (cv2.dilate(tone_a.astype(np.uint8), k3_) > 0) & (cv2.dilate(tone_b.astype(np.uint8), k3_) > 0) & (tone_a | tone_b)
        hatch = cv2.morphologyEx(both.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        k8 = max(3, int(round(8 * ppc * 0.6)) | 1)
        hatch = cv2.morphologyEx(hatch, cv2.MORPH_OPEN, np.ones((k8, k8), np.uint8)) > 0
        hatch &= ~full
        lab_pts = [(s_.get("label_px") or s_.get("at_px")) for s_ in seeds if not s_.get("is_outdoor") and (s_.get("label_px") or s_.get("at_px"))]
        n_h, l_h, st_h, _ = cv2.connectedComponentsWithStats(hatch.astype(np.uint8), connectivity=8)
        added_h = 0
        for c_h in range(1, n_h):
            if st_h[c_h, cv2.CC_STAT_AREA] < (30 * ppc) * (8 * ppc):
                continue
            comp_h = l_h == c_h
            hit = False
            for i_ in range(len(lab_pts)):
                for j_ in range(i_ + 1, len(lab_pts)):
                    (x1_, y1_), (x2_, y2_) = lab_pts[i_], lab_pts[j_]
                    if math.hypot(x2_ - x1_, y2_ - y1_) > 700 * ppc:
                        continue
                    ln_ = np.zeros(full.shape, np.uint8)
                    cv2.line(ln_, (int(x1_), int(y1_)), (int(x2_), int(y2_)), 1, 3)
                    if (comp_h & (ln_ > 0)).any():
                        hit = True; break
                if hit:
                    break
            if hit:
                full |= comp_h; added_h += int(comp_h.sum())
        if added_h:
            print(f"auto_rooms: {added_h / (ppc * ppc) / 1e4:.2f} m² of two-grey hatched wall between room labels added to the walls")
    cv2.imwrite(os.path.join(d, "walls-only.png"), full.astype(np.uint8) * 255)
    wv_p = os.path.join(d, "windows-vector.png")
    if os.path.exists(wv_p) and "--windows-bound-rooms" in sys.argv:   # off: the window layer also holds glass door panels
        wv = cv2.imread(wv_p, cv2.IMREAD_GRAYSCALE)
        if wv is not None and wv.shape == full.shape:
            full = full | (wv > 127)
    H0, W0 = full.shape
    bar = cv2.resize(full.astype(np.uint8), (W0 // F, H0 // F), interpolation=cv2.INTER_AREA) > 0
    bar = cv2.morphologyEx(bar.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    env = cv2.imread(os.path.join(d, "envelope.png"), cv2.IMREAD_GRAYSCALE)
    env = (cv2.resize(env, (bar.shape[1], bar.shape[0]), interpolation=cv2.INTER_NEAREST) > 0) if env is not None else np.ones_like(bar)
    H, W = bar.shape
    ang = dominant_angle(bar)
    # pick the rotation sign that makes the walls axis-aligned
    best = None
    for a in (ang, -ang, 90 - ang, ang - 90):
        M, Mi, size = rot_setup(H, W, a)
        br = cv2.warpAffine(bar.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
        r = dominant_angle(br)
        off = min(r, 90 - r)
        if best is None or off < best[0]:
            best = (off, a, M, Mi, size)
    _, a_used, M, Mi, size = best
    bar_r = cv2.warpAffine(bar.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    env_r = cv2.warpAffine(env.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    inside = env_r & ~bar_r
    bs_p = os.path.join(d, "beam-strip.png")
    if os.path.exists(bs_p):                     # (round 19) the drawn beam strip (V25 edge .. glass) is outside the rooms
        bsm = cv2.imread(bs_p, cv2.IMREAD_GRAYSCALE)
        bss = cv2.resize((bsm > 127).astype(np.uint8) * 255, (W, H), interpolation=cv2.INTER_AREA) > 0
        beam_r = cv2.warpAffine(bss.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
        inside = inside & ~beam_r
    paved_r = None
    crop = cv2.imread(os.path.join(d, "crop.png"), cv2.IMREAD_COLOR)
    if crop is not None:
        hsv = cv2.cvtColor(cv2.resize(crop, (W, H), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2HSV)
        if (hsv[..., 1] > 55).mean() >= 0.03:          # a rendered plan: paving = light and unsaturated
            paved = ((hsv[..., 1] < 45) & (hsv[..., 2] > 120)).astype(np.uint8)
            paved = cv2.morphologyEx(paved, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
            paved_r = cv2.warpAffine(paved, M, size, flags=cv2.INTER_NEAREST) > 0
    outside = ~env_r & ~bar_r
    Hr, Wr = bar_r.shape
    pf = ppc / F
    notes = []
    niches = {}                                   # (T15) room_id -> niche loops in cm (outside its printed size)
    niche_px = {}
    def to_r(px):
        return tp(M, px[0] / F, px[1] / F)
    pvx_p = os.path.join(d, "pdf-vectors.json")
    if os.path.exists(pvx_p):                    # (round 21) a built-in box set into a wall (>= 30 % of its outline on a wall):
        n_box = 0                                #    a cabinet in its niche, not floor (846: the electrical cabinet by the laundry)
        wall_near = cv2.dilate(bar_r.astype(np.uint8), np.ones((int(10 * pf) * 2 + 1, int(10 * pf) * 2 + 1), np.uint8)) > 0
        for b_ in json.load(open(pvx_p, encoding="utf-8")).get("symbol_boxes_px", []):
            pts_b = np.round(np.array([to_r(p_) for p_ in b_])).astype(np.int32)
            bm_ = np.zeros((Hr, Wr), np.uint8); cv2.fillPoly(bm_, [pts_b], 1)
            a_b = bm_.sum() / (pf * pf) / 1e4
            if not (0.03 <= a_b <= 0.6):
                continue
            edge_b = (bm_ > 0) & ~(cv2.erode(bm_, np.ones((3, 3), np.uint8)) > 0)
            if (edge_b & wall_near).sum() >= 0.3 * max(1, edge_b.sum()):
                inside = inside & ~(cv2.dilate(bm_, np.ones((3, 3), np.uint8)) > 0); n_box += 1
        if n_box:
            print(f"auto_rooms: {n_box} built-in box(es) set into a wall: not floor")
    gl_early = None
    fb_ = cv2.imread(os.path.join(d, "barrier.png"), cv2.IMREAD_GRAYSCALE)
    if fb_ is not None:
        bb_ = cv2.resize((fb_ > 127).astype(np.uint8), (W, H), interpolation=cv2.INTER_AREA) > 0
        bb_ = cv2.morphologyEx(bb_.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
        gl_early = cv2.warpAffine(bb_.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    n_v, l_v = cv2.connectedComponents((inside & ~(gl_early if gl_early is not None else bar_r)).astype(np.uint8), connectivity=4)
    for s_ in seeds:
        if not s_.get("is_outdoor"):
            continue
        vx, vy = [int(round(v)) for v in to_r(s_.get("label_px") or s_["at_px"])]
        if not (0 <= vy < Hr and 0 <= vx < Wr and env_r[vy, vx]):
            continue
        if l_v[vy, vx] > 0:
            comp_v = l_v == l_v[vy, vx]
        else:
            yy, xx = np.nonzero(l_v > 0)
            if not len(xx):
                continue
            j = int(np.argmin((xx - vx) ** 2 + (yy - vy) ** 2))
            comp_v = l_v == l_v[yy[j], xx[j]] if math.hypot(xx[j] - vx, yy[j] - vy) <= 60 * pf else None
        if comp_v is None or comp_v.sum() / (pf * pf) / 1e4 > 60:
            continue
        inside[comp_v] = False
        outside[comp_v] = True
        if re.search(r"בקומ", s_.get("name_he") or ""):
            s_["void_on_this_floor"] = True
            notes.append(f"{s_['id']}: an outdoor label naming another floor, inside the building: a void on this floor, not a room")
        else:
            notes.append(f"{s_['id']}: an outdoor label inside the building envelope: this floor's terrace / patio, outside the rooms")
            s_["in_envelope"] = True
    win_r = np.zeros_like(inside)
    win_vec_r = np.zeros_like(inside)
    gpen_r = np.zeros_like(inside)
    wv2 = os.path.join(d, "windows-vector.png")
    if os.path.exists(wv2):                    # (round 14) the drawn windows cut a strip beyond them from the room behind (strip test only)
        wvm = cv2.imread(wv2, cv2.IMREAD_GRAYSCALE)
        if wvm is not None:
            wvs = cv2.resize((wvm > 127).astype(np.uint8) * 255, (W, H), interpolation=cv2.INTER_AREA) > 0   # 0/255: a thin line survives the shrink
            win_r = cv2.warpAffine(wvs.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
            win_vec_r = win_r.copy()           # the window layers alone (straight windows): the lines the side tests use
            gp_p = os.path.join(d, "glazing-pen.png")
            if os.path.exists(gp_p):           # (round 17) + the glass drawn by pen weight (846's curved glass wall): the facade's glass line
                gpm = cv2.imread(gp_p, cv2.IMREAD_GRAYSCALE)
                if gpm is not None and gpm.shape == wvm.shape:
                    gps = cv2.resize((gpm > 127).astype(np.uint8) * 255, (W, H), interpolation=cv2.INTER_AREA) > 0
                    gpen_r = cv2.warpAffine(gps.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
                    win_r = win_r | gpen_r
            win_r = cv2.morphologyEx(win_r.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0   # the window outline -> a solid bar
    win_lines = []                              # (cx, cy, ux, uy, mask) of each long straight window line
    n_wc, l_wc = cv2.connectedComponents(win_r.astype(np.uint8), connectivity=8)
    for c in range(1, n_wc):
        ys_c, xs_c = np.nonzero(l_wc == c)
        if len(xs_c) < 5:
            continue
        (cxw, cyw), (rw, rh), ang_w = cv2.minAreaRect(np.stack([xs_c, ys_c], 1).astype(np.float32))
        if max(rw, rh) < 60 * pf or max(rw, rh) < 4 * max(min(rw, rh), 1):
            continue
        th = math.radians(ang_w if rw >= rh else ang_w + 90)
        win_lines.append((cxw, cyw, math.cos(th), math.sin(th), l_wc == c))
    yy_e, xx_e = np.nonzero(env_r)
    env_cx, env_cy = (xx_e.mean(), yy_e.mean()) if len(xx_e) else (Wr / 2, Hr / 2)
    def far_side(pc_):
        """True when the piece lies on the far side (away from the building's centre) of a window line it touches"""
        dil = cv2.dilate(pc_.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
        yy3, xx3 = np.nonzero(pc_)
        if not len(xx3):
            return False
        sx, sy = xx3.mean(), yy3.mean()
        return any(((sx - cxw) * -uyw + (sy - cyw) * uxw) * ((env_cx - cxw) * -uyw + (env_cy - cyw) * uxw) < 0
                   for (cxw, cyw, uxw, uyw, m_) in win_lines if (m_ & dil).any())
    inside_er = cv2.erode((inside & ~(gl_early if gl_early is not None else np.zeros_like(inside)) & ~win_r).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0   # bounded by walls, glazing AND drawn windows
    n_c, l_c = cv2.connectedComponents(inside_er.astype(np.uint8), connectivity=4)
    ring_wall = cv2.dilate(bar_r.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    out_m = (~env_r).astype(np.uint8)
    out_m[:8, :] = 1; out_m[-8:, :] = 1; out_m[:, :8] = 1; out_m[:, -8:] = 1      # the image border is outside
    img_m = cv2.warpAffine(np.ones((H, W), np.uint8), M, size, flags=cv2.INTER_NEAREST)
    out_m[cv2.dilate((img_m == 0).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0] = 1   # so is the area beyond the rotated image
    ring_out = cv2.dilate(out_m, np.ones((3, 3), np.uint8)) > 0
    dropped = 0
    for c in range(1, n_c):
        comp = (cv2.dilate((l_c == c).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0) & inside
        edge = comp & ~cv2.erode(comp.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        n_edge = int(edge.sum())
        if n_edge == 0:
            continue
        on_out = int((edge & ring_out & ~ring_wall).sum())
        on_wall = int((edge & ring_wall).sum())
        has_label = False
        for s_l in seeds:
            if s_l.get("is_outdoor") or s_l.get("auto"):
                continue
            lx_, ly_ = [int(round(v)) for v in to_r(s_l.get("label_px") or s_l["at_px"])]
            if 0 <= ly_ < Hr and 0 <= lx_ < Wr and comp[ly_, lx_]:
                has_label = True; break
        beyond_facade = (not has_label) and on_wall < 0.4 * n_edge and comp.sum() / (pf * pf) / 1e4 >= 0.5   # (round 14) between the windows and the outer line
        if beyond_facade and win_lines and any((m_ & (cv2.dilate(comp.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0)).any() for (*_, m_) in win_lines) and not far_side(comp):
            beyond_facade = False   # (round 18) a corner on the ROOM side of the windows (846's kitchen NE corner, closed off by a door-gap bar)
        if on_out > 0.35 * n_edge or beyond_facade:
            inside[comp] = False
            outside[comp] = True
            dropped += 1
    if dropped:
        print(f"auto_rooms: {dropped} free strip(s) inside the envelope but not enclosed by walls -> outside")
    Hr, Wr = bar_r.shape
    pf = ppc / F                                    # rotated-frame px per cm
    t = int(40 * pf)
    # (notes defined above)
    # the entrance door: the envelope's outline gap nearest an entrance label
    ring = (cv2.dilate(env_r.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~env_r & ~bar_r
    n_r, l_r = cv2.connectedComponents(ring.astype(np.uint8), connectivity=8)
    ent = next((s for s in seeds if "כניסה" in (s.get("name_he") or "") or s.get("vlm_type") == "entrance"), None)
    # (T20, 2026-11-06) the FRONT DOOR from the drawing: when the reading names no entrance, the drawn entry arrow (a filled
    #    triangle on the symbol layer, outside the building, within 1.5 m of its edge — the plan writes «כניסה» beside it)
    #    marks it, and the entrance is seeded there (846: two of three readings skipped the «כניסה» label)
    pvx_e = os.path.join(d, "pdf-vectors.json")
    if ent is None and os.path.exists(pvx_e):
        env_dt = cv2.distanceTransform((~env_r).astype(np.uint8), cv2.DIST_L2, 5)     # distance to the building, outside it
        cand_e = []
        for t_ in json.load(open(pvx_e, encoding="utf-8")).get("filled_triangles_px", []):
            if len(t_) > 3 and re.search(r"siman|symb|arrow", str(t_[3]), re.I) and 15 <= t_[2] / ppc <= 90:
                xr, yr = to_r((t_[0], t_[1]))
                xi, yi = int(round(xr)), int(round(yr))
                if 0 <= yi < Hr and 0 <= xi < Wr and not env_r[yi, xi] and env_dt[yi, xi] / pf <= 150:
                    cand_e.append((float(env_dt[yi, xi]), t_))
        if len(cand_e) >= 1:
            _, t_e = min(cand_e, key=lambda c_: c_[0])
            ent = {"id": "entrance", "room_id": "r-entrance", "name_he": "כניסה", "name_en": "Entrance", "type": "hall", "vlm_type": "entrance",
                   "is_outdoor": False, "at_px": [t_e[0], t_e[1]], "label_px": [t_e[0], t_e[1]], "dims_cm": None,
                   "moved_inside": True, "from_drawing": "the entry arrow on the symbol layer (no entrance label in the reading)"}
            seeds.append(ent)
            notes.append(f"entrance (T20): the reading names none; the drawn entry arrow at {round(t_e[0] / ppc)},{round(t_e[1] / ppc)} cm, {len(cand_e)} arrow(s) outside the building edge")
    door_px = None
    if ent and n_r > 1:
        lx, ly = to_r(ent.get("label_px") or ent["at_px"])
        best_d = None
        for c in range(1, n_r):
            yy, xx = np.nonzero(l_r == c)
            dd = np.min((xx - lx) ** 2 + (yy - ly) ** 2)
            if best_d is None or dd < best_d[0]:
                best_d = (dd, (float(xx.mean()), float(yy.mean())))
        door_px = best_d[1]
    full_b0 = cv2.imread(os.path.join(d, "barrier.png"), cv2.IMREAD_GRAYSCALE)
    gl_r = None
    if full_b0 is not None:
        bb0 = cv2.resize((full_b0 > 127).astype(np.uint8), (W, H), interpolation=cv2.INTER_AREA) > 0
        bb0 = cv2.morphologyEx(bb0.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
        gl_r = cv2.warpAffine(bb0.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    claim = np.zeros((Hr, Wr), np.int32)
    depth = np.zeros((Hr, Wr), np.float32)
    rect_of = {}
    n_in, comp_in = cv2.connectedComponents(inside.astype(np.uint8), connectivity=4)
    def label_point(s):
        x, y = to_r(s.get("label_px") or s["at_px"])
        xi, yi = int(round(x)), int(round(y))
        if 0 <= yi < Hr and 0 <= xi < Wr and inside[yi, xi]:
            return xi, yi, False
        # an indoor label outside the envelope: at the entrance door when it is the entrance, else the nearest inside pixel
        if door_px is not None and s is ent:
            x, y = door_px
        iy, ix = np.nonzero(inside)
        j = int(np.argmin((ix - x) ** 2 + (iy - y) ** 2))
        return int(ix[j]), int(iy[j]), True
    pts = {}
    for k, s in enumerate(seeds):
        if s.get("is_outdoor") or s.get("auto"):
            continue
        pts[k] = label_point(s)
    # 2. printed rectangles (round 5): placed by score — inside the free space, containing the room's OWN fixtures (a kitchen
    #    its counter/hob/sink, a bath its WC/shower/basin), touching walls and glazing, never covering another room's label
    vlm = J("vlm.json", {})
    KIT = {"counter", "hob", "sink", "tall_unit", "island"}
    WETK = {"wc", "shower", "bathtub", "vanity", "washer"}
    fx_pts = []
    for f in vlm.get("fixtures", []) or []:
        b = f.get("box_px")
        if b:
            fx_pts.append((f.get("kind"), to_r(((b[0] + b[2]) / 2, (b[1] + b[3]) / 2))))
    label_r = {k: (pts[k][0], pts[k][1]) for k in pts}
    def own_fixtures(k):
        s = seeds[k]
        kinds = KIT if s.get("type") == "kitchen" else WETK if s.get("type") == "bathroom" else set()
        if not kinds:
            return []
        same = [j for j in pts if seeds[j].get("type") == s.get("type")]
        out = []
        for kind, (fx, fy) in fx_pts:
            if kind not in kinds:
                continue
            near = min(same, key=lambda j: (label_r[j][0] - fx) ** 2 + (label_r[j][1] - fy) ** 2)
            if near == k and math.hypot(label_r[k][0] - fx, label_r[k][1] - fy) <= 450 * pf:
                out.append((fx, fy))
        return out
    integ = lambda m: np.pad(m.astype(np.int64), ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    def boxsum(I, x0, y0, x1, y1):
        x0, y0 = max(0, int(x0)), max(0, int(y0)); x1, y1 = min(I.shape[1] - 1, int(x1)), min(I.shape[0] - 1, int(y1))
        if x1 <= x0 or y1 <= y0:
            return 0
        return I[y1, x1] - I[y0, x1] - I[y1, x0] + I[y0, x0]
    I_bar = integ(bar_r)
    def place(k, cmask, A, B):
        x, y = label_r[k]
        I_in = integ(cmask)
        own = own_fixtures(k)
        others = [label_r[j] for j in pts if j != k]
        best = None
        for (a, b) in ((A, B), (B, A)):
            step = max(1, int(min(a, b) / 24))
            for x0 in range(int(x - a), int(x) + 1, step):
                for y0 in range(int(y - b), int(y) + 1, step):
                    x1, y1 = x0 + a, y0 + b
                    frac = boxsum(I_in, x0, y0, x1, y1) / max(1.0, a * b)
                    ring = boxsum(I_bar, x0 - 3, y0 - 3, x1 + 3, y1 + 3) - boxsum(I_bar, x0 + 2, y0 + 2, x1 - 2, y1 - 2)
                    wall_in = boxsum(I_bar, x0 + 3, y0 + 3, x1 - 3, y1 - 3)   # a rectangle that crosses a wall
                    own_in = sum(1 for fx, fy in own if x0 <= fx <= x1 and y0 <= fy <= y1)
                    oth_in = sum(1 for ox, oy in others if x0 + 3 <= ox <= x1 - 3 and y0 + 3 <= oy <= y1 - 3)
                    sc = frac * 1000 + (own_in / len(own) * 400 if own else 0) - 600 * oth_in + min(ring, 4 * (a + b)) / (4 * (a + b)) * 80 - 5000 * wall_in / max(1.0, a * b)
                    if best is None or sc > best[0]:
                        best = (sc, [x0, y0, x1, y1], frac, own_in, len(own), oth_in)
        return best
    def place_in(k, cmask_l, bar_l, A, B, Ml):
        x, y = label_r[k]
        I_in = integ(cmask_l); I_b = integ(bar_l)
        own = [tp(Ml, fx, fy) for fx, fy in own_fixtures(k)]
        others = [tp(Ml, *label_r[j]) for j in pts if j != k]
        best = None
        for (a, b) in ((A, B), (B, A)):
            step = max(1, int(min(a, b) / 24))
            for x0 in range(int(x - a), int(x) + 1, step):
                for y0 in range(int(y - b), int(y) + 1, step):
                    x1, y1 = x0 + a, y0 + b
                    frac = boxsum(I_in, x0, y0, x1, y1) / max(1.0, a * b)
                    ring = boxsum(I_b, x0 - 3, y0 - 3, x1 + 3, y1 + 3) - boxsum(I_b, x0 + 2, y0 + 2, x1 - 2, y1 - 2)
                    wall_in = boxsum(I_b, x0 + 3, y0 + 3, x1 - 3, y1 - 3)
                    own_in = sum(1 for fx, fy in own if x0 <= fx <= x1 and y0 <= fy <= y1)
                    oth_in = sum(1 for ox, oy in others if x0 + 3 <= ox <= x1 - 3 and y0 + 3 <= oy <= y1 - 3)
                    sc = frac * 1000 + (own_in / len(own) * 400 if own else 0) - 600 * oth_in + min(ring, 4 * (a + b)) / (4 * (a + b)) * 80 - 5000 * wall_in / max(1.0, a * b)
                    if best is None or sc > best[0]:
                        best = (sc, [x0, y0, x1, y1], frac, own_in, len(own), oth_in)
        return best
    # (round 11) the printed dimension lines of a CAD PDF are the authority: chains measured tick to tick
    CHAINS = []
    pv_ = J("pdf-vectors.json")
    if pv_ and pv_.get("dimension_segments_px"):
        import dim_chains
        CHAINS = dim_chains.chains(pv_["dimension_segments_px"], ppc)
        notes.append(f"{len(CHAINS)} printed dimension lines read from the PDF (tick to tick)")
    TAN4 = math.tan(math.radians(4))

    def anchor_rect(k, r0, Mx, mask_f):
        """fix the rectangle's extent on each axis that a matching printed dimension line, near the label, gives exactly"""
        dims = seeds[k]["dims_cm"]
        lx, ly = label_r[k]
        if Mx is not None:
            lx, ly = tp(Mx, lx, ly)
        best = {}
        for c in CHAINS:
            A = to_r(c["a"]); B = to_r(c["b"])
            if Mx is not None:
                A = tp(Mx, *A); B = tp(Mx, *B)
            dx, dy = B[0] - A[0], B[1] - A[1]
            if abs(dy) <= TAN4 * abs(dx):
                ax_ = "x"; lo, hi = sorted([A[0], B[0]]); along, perp = lx, abs(ly - (A[1] + B[1]) / 2)
            elif abs(dx) <= TAN4 * abs(dy):
                ax_ = "y"; lo, hi = sorted([A[1], B[1]]); along, perp = ly, abs(lx - (A[0] + B[0]) / 2)
            else:
                continue
            L = hi - lo
            for si, sv in enumerate(dims):
                if abs(c["len_cm"] - sv) > max(0.015 * sv, 4):
                    continue
                other = dims[1 - si]
                if not (lo - 0.15 * L <= along <= hi + 0.15 * L) or perp > other * pf * 1.0:
                    continue
                if ax_ not in best or perp < best[ax_][0]:
                    best[ax_] = (perp, lo, hi, si, c)
        if "x" in best and "y" in best and best["x"][3] == best["y"][3] and abs(dims[0] - dims[1]) > 8:
            drop = "x" if best["x"][0] > best["y"][0] else "y"
            del best[drop]
        if not best:
            return r0, {}
        r = list(r0)
        anc = {}
        if "x" in best:
            _, lo, hi, si, c = best["x"]; r[0], r[2] = lo, hi; anc["x"] = (lo, hi, c["len_cm"])
        if "y" in best:
            _, lo, hi, si, c = best["y"]; r[1], r[3] = lo, hi; anc["y"] = (lo, hi, c["len_cm"])
        if len(best) == 1:                       # the free axis: the other printed side, placed where it lies most inside
            ax_, (_, lo, hi, si, c) = next(iter(best.items()))
            other = dims[1 - si] * pf
            I_m = integ(mask_f)
            if ax_ == "x":
                cands = [(boxsum(I_m, lo, y0, hi, y0 + other), y0) for y0 in range(int(ly - other), int(ly) + 1, max(1, int(other / 30)))]
                y0 = max(cands)[1] if cands else r[1]; r[1], r[3] = y0, y0 + other
            else:
                cands = [(boxsum(I_m, x0, lo, x0 + other, hi), x0) for x0 in range(int(lx - other), int(lx) + 1, max(1, int(other / 30)))]
                x0 = max(cands)[1] if cands else r[0]; r[0], r[2] = x0, x0 + other
        return r, anc

    def restore(r1, anc):
        r1 = list(r1)
        if "x" in anc:
            r1[0], r1[2] = anc["x"][0], anc["x"][1]
        if "y" in anc:
            r1[1], r1[3] = anc["y"][0], anc["y"][1]
        return r1
    order = sorted([k for k in pts if seeds[k].get("dims_cm")], key=lambda k: seeds[k]["dims_cm"][0] * seeds[k]["dims_cm"][1])
    for k in order:
        x, y, moved = pts[k]
        s = seeds[k]
        cmask = inside & (claim == 0)
        a_px, b_px = s["dims_cm"][0] * pf, s["dims_cm"][1] * pf
        tol = lambda size: max(0.02 * size, 5 * pf)
        # (round 6) the walls around THIS label may run on another axis (846's north wing): place in a local frame
        R_ = int(max(a_px, b_px) * 1.2) + 10
        wx0, wy0, wx1, wy1 = max(0, x - R_), max(0, y - R_), min(Wr, x + R_), min(Hr, y + R_)
        r_loc = dominant_angle(bar_r[wy0:wy1, wx0:wx1])
        off = r_loc if r_loc <= 45 else r_loc - 90
        if abs(off) > 3:
            best_l = None
            for sg in (off, -off):
                Ml = cv2.getRotationMatrix2D((float(x), float(y)), sg, 1.0)
                br_l = cv2.warpAffine(bar_r.astype(np.uint8), Ml, (Wr, Hr), flags=cv2.INTER_NEAREST) > 0
                rr = dominant_angle(br_l[wy0:wy1, wx0:wx1])
                o2 = min(rr, 90 - rr)
                if best_l is None or o2 < best_l[0]:
                    best_l = (o2, sg, Ml, br_l)
            _, sg, Ml, br_l = best_l
            Mli = cv2.invertAffineTransform(Ml)
            in_l = cv2.warpAffine(cmask.astype(np.uint8), Ml, (Wr, Hr), flags=cv2.INTER_NEAREST) > 0
            in_all_l = cv2.warpAffine(inside.astype(np.uint8), Ml, (Wr, Hr), flags=cv2.INTER_NEAREST) > 0
            saved = (label_r[k], I_bar)
            I_bar_l = integ(br_l)
            I_bar_saved = I_bar
            globals_ = None
            sc, r0, frac, own_in, n_own, oth_in = place_in(k, in_l, br_l, a_px, b_px, Ml)
            r0, anc = anchor_rect(k, r0, Ml, in_l)
            r1, snapped = snap_edges(r0, br_l, in_all_l, t, keep_size=(r0[2] - r0[0], r0[3] - r0[1], tol))
            r1 = restore(r1, anc)
            corners = [tp(Mli, r1[0], r1[1]), tp(Mli, r1[2], r1[1]), tp(Mli, r1[2], r1[3]), tp(Mli, r1[0], r1[3])]
            m = np.zeros((Hr, Wr), np.uint8)
            cv2.fillPoly(m, [np.round(np.array(corners)).astype(np.int32)], 1)
            local_axis = sg
        else:
            sc, r0, frac, own_in, n_own, oth_in = place(k, cmask, a_px, b_px)
            r0, anc = anchor_rect(k, r0, None, cmask)
            r1, snapped = snap_edges(r0, bar_r, inside, t, keep_size=(r0[2] - r0[0], r0[3] - r0[1], tol))
            r1 = restore(r1, anc)
            m = np.zeros((Hr, Wr), np.uint8)
            cv2.rectangle(m, (int(r1[0]), int(r1[1])), (int(r1[2]) - 1, int(r1[3]) - 1), 1, -1)
            local_axis = 0.0
        if anc:                  # an anchored rectangle claims its whole extent: the dimension lines, not the raster, decide
            take = (m > 0) & (claim == 0) & ~(cv2.erode(bar_r.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
        else:
            take = (m > 0) & inside & (claim == 0)
        if len(anc) < 2 and (frac < 0.70 or take.sum() < 0.6 * (m > 0).sum() or oth_in > 0):
            notes.append(f"{s['id']}: its printed {s['dims_cm']} cm rectangle fits the free space only {frac * 100:.0f} % — not a room rectangle (a span over several rooms?); traced without it")
            s["dims_rejected"] = s["dims_cm"]; s["dims_cm"] = None
            continue
        claim[take] = k + 1
        rect_of[k] = {"rect_px": [float(v) for v in r1], "fit": round(float(frac), 3), "snapped": snapped, "own_fixtures_in": f"{own_in}/{n_own}", "other_labels_covered": oth_in, "local_axis_deg": round(float(local_axis), 1),
                      "anchored": {ax_: v[2] for ax_, v in anc.items()}}
        if anc:
            s["anchored_by_dimension_lines"] = {ax_: v[2] for ax_, v in anc.items()}
    # (round 8) the front door from the drawing: the door arc whose hinge is nearest the entrance label (<= 4 m)
    door_seg = None
    if ent is not None:
        try:
            import auto_doors
            stroke_p = os.path.join(d, "strokes.png")
            if os.path.exists(stroke_p):
                stroke = (cv2.imread(stroke_p, cv2.IMREAD_GRAYSCALE) > 127).astype(np.uint8) * 255
            else:
                band_ = ((grey >= 70) & (grey <= 150)).astype(np.uint8)
                stroke = ((grey < 70) & (cv2.dilate(band_, np.ones((5, 5), np.uint8)) == 0)).astype(np.uint8) * 255
            arcs = auto_doors.detect_arcs(stroke, full, ppc)
            lx, ly = ent.get("label_px") or ent["at_px"]
            near = sorted(arcs, key=lambda a_: math.hypot(a_["hinge_px"][0] - lx, a_["hinge_px"][1] - ly))
            if near and math.hypot(near[0]["hinge_px"][0] - lx, near[0]["hinge_px"][1] - ly) <= 400 * ppc:
                (hx, hy), (ex, ey) = near[0]["chord_px"]
                p0, p1 = to_r((hx, hy)), to_r((ex, ey))
                door_seg = (p0, p1)
                notes.append(f"front door: the arc at {round(hx / ppc)},{round(hy / ppc)} cm, {near[0]['r_cm']} cm wide")
        except Exception as e_:
            notes.append(f"front door arc: {str(e_)[:80]}")
    # (round 8) no arc: the tracer's automatic door gap (60-140 cm between two wall ends) nearest the entrance label (<= 4 m)
    if ent is not None and door_seg is None and os.path.exists(os.path.join(d, "trace.log")):
        lxc, lyc = [v / ppc for v in (ent.get("label_px") or ent["at_px"])]
        gaps = []
        for line in open(os.path.join(d, "trace.log"), encoding="utf-8", errors="replace"):
            mm = re.match(r"AUTO gap-\d+\s+(\d+) cm\s+(-?\d+),(-?\d+) -> (-?\d+),(-?\d+)", line.strip())
            if mm:
                w_, ax_, ay_, bx_, by_ = [float(v) for v in mm.groups()]
                cxg, cyg = (ax_ + bx_) / 2, (ay_ + by_) / 2
                gaps.append((math.hypot(cxg - lxc, cyg - lyc), (ax_, ay_), (bx_, by_), w_))
        if gaps:
            dist_, a_, b_, w_ = min(gaps)
            if dist_ <= 400:
                door_seg = (to_r((a_[0] * ppc, a_[1] * ppc)), to_r((b_[0] * ppc, b_[1] * ppc)))
                notes.append(f"front door: the wall gap {w_:.0f} cm wide, {dist_:.0f} cm from the entrance label")
    # 2c'. (round 7) the entrance: from the front door inward, a band of the door's width, until the free space opens wider
    #      than ~2.2 doors (a stair hall) or a room / wall stops it
    if ent is not None and seeds.index(ent) in pts and (door_seg is not None or (door_px is not None and n_r > 1)):
        k_e = seeds.index(ent)
        if door_seg is not None:
            (ax_, ay_), (bx_, by_) = door_seg
            ts_ = np.linspace(0, 1, 40)
            gx = np.round(ax_ + (bx_ - ax_) * ts_).astype(int); gy = np.round(ay_ + (by_ - ay_) * ts_).astype(int)
        else:
            best_c = min(range(1, n_r), key=lambda c: (lambda yy, xx: np.min((xx - door_px[0]) ** 2 + (yy - door_px[1]) ** 2))(*np.nonzero(l_r == c)))
            gy, gx = np.nonzero(l_r == best_c)
        horiz = (gx.max() - gx.min()) >= (gy.max() - gy.min())
        un = inside & (claim == 0)
        # (round 8) the walk follows the FREE pixels anywhere across the door's span (a door may half-face a room's rectangle),
        # and the free run they extend into; a vertical door walks on the transposed arrays
        U = un if horiz else un.T
        if horiz:
            a0, a1, c0 = int(gx.min()), int(gx.max()), int(gy.mean())
        else:
            a0, a1, c0 = int(gy.min()), int(gy.max()), int(gx.mean())
        wd = max(1, a1 - a0)
        lim = U.shape[0]
        def free_runs(row):
            span = row[max(0, a0 - int(10 * pf)):min(row.shape[0], a1 + int(10 * pf)) + 1]
            if not span.any():
                return None
            idx = np.nonzero(span)[0] + max(0, a0 - int(10 * pf))
            l_, r_ = int(idx.min()), int(idx.max())
            while l_ > 0 and row[l_ - 1]: l_ -= 1
            while r_ < row.shape[0] - 1 and row[r_ + 1]: r_ += 1
            return l_, r_
        # the inside is the side whose rows (just past the wall band) hold free pixels across the door span
        sides = []
        for st_ in (1, -1):
            hits = sum(1 for dd in range(1, int(60 * pf)) if 0 <= c0 + st_ * dd < lim and free_runs(U[c0 + st_ * dd]) is not None)
            sides.append((hits, st_))
        step = max(sides)[1]
        B = np.zeros_like(U)
        y = c0 + step
        while 0 <= y < lim and free_runs(U[y]) is None and abs(y - c0) < 40 * pf:
            y += step
        while 0 <= y < lim:
            fr = free_runs(U[y])
            if fr is None:
                break
            l_, r_ = fr
            if (r_ - l_) > 2.2 * wd and abs(y - c0) > 60 * pf:
                break
            B[y, l_:r_ + 1] = True
            y += step
        band = B if horiz else B.T
        band &= un
        if band.sum() / (pf * pf) / 1e4 >= 1.0:
            claim[band] = k_e + 1
            ent["from_strip"] = True
    # (round 7) open-plan rooms WITHOUT printed dims (kitchen / dining / living) that share one region bounded by walls AND
    #     glazing: orthogonal slabs, cut at the midpoints between their labels along the axis of their greatest spread
    slab_cut = np.zeros((Hr, Wr), bool)               # (round 20) pieces the slab split cut off the open plan's own region
    open_slab_ks = []
    if gl_r is not None:
        reg_all = inside & ~gl_r & ~win_r & (claim == 0)      # (round 14) the open plan ends at the drawn windows too
        if os.environ.get("AUTO_ROOMS_DEBUG"):
            dbg = np.zeros((Hr, Wr, 3), np.uint8); dbg[inside] = (200, 200, 200); dbg[win_r] = (255, 160, 0); dbg[gl_r] = (0, 0, 255); dbg[reg_all] = (0, 200, 0)
            cv2.imwrite(os.path.join(d, "debug-slab-masks.png"), dbg)
        n_raw, l_raw = cv2.connectedComponents(reg_all.astype(np.uint8), connectivity=4)   # (round 20) before the split
        k_open = int(110 * pf) | 1
        reg_all = cv2.morphologyEx(reg_all.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (k_open, k_open))) > 0
        n_g, l_g = cv2.connectedComponents(reg_all.astype(np.uint8), connectivity=4)
        groups = {}
        for k, (x, y, _) in pts.items():
            s_ = seeds[k]
            if s_.get("dims_cm") or s_.get("vlm_type") not in ("kitchen", "dining", "living"):
                continue
            g = l_g[y, x]
            if g == 0:
                yy, xx = np.nonzero(l_g > 0)
                if not len(xx):
                    continue
                j = int(np.argmin((xx - x) ** 2 + (yy - y) ** 2)); g = l_g[yy[j], xx[j]]
            groups.setdefault(int(g), []).append(k)
        for g, ks in groups.items():
            if len(ks) < 2:
                continue
            region = l_g == g
            xs_ = [pts[k][0] for k in ks]; ys_ = [pts[k][1] for k in ks]
            axis = 0 if (max(xs_) - min(xs_)) >= (max(ys_) - min(ys_)) else 1
            ks = sorted(ks, key=lambda k: pts[k][axis])
            cuts = [(pts[ks[i]][axis] + pts[ks[i + 1]][axis]) / 2 for i in range(len(ks) - 1)]
            yy, xx = np.mgrid[0:Hr, 0:Wr]
            coord = xx if axis == 0 else yy
            for i, k in enumerate(ks):
                lo = cuts[i - 1] if i > 0 else -1e9
                hi = cuts[i] if i < len(cuts) else 1e9
                slab = region & (coord >= lo) & (coord < hi)
                claim[slab & (claim == 0)] = k + 1
                seeds[k]["from_box"] = True
                # (round 20) what the 110 cm split cut off this group's own region stays this group's: nearest slab
                raw_ids = np.unique(l_raw[region]); raw_ids = raw_ids[raw_ids > 0]
                cut_ = np.isin(l_raw, raw_ids) & ~region
                if cut_.any():
                    slab_cut[cut_] = True
                rect_of[k] = {"rect_px": None, "fit": None, "snapped": False, "from": f"open-plan slab {i + 1}/{len(ks)} (walls + glazing)"}
                open_slab_ks.append(k)
    # 2c. (round 6) the entrance: the narrow free strip (<= 160 cm wide) connected to the front door, as its own room
    if ent is not None and door_px is not None and seeds.index(ent) in pts:
        k_e = seeds.index(ent)
        un = (inside & (claim == 0)).astype(np.uint8)
        dt = cv2.distanceTransform(un, cv2.DIST_L2, 5)
        kk = int(80 * pf) * 2 + 1
        wide = cv2.dilate(dt, np.ones((kk, kk), np.uint8))
        narrow = (un > 0) & (wide <= 80 * pf)
        n_n, l_n = cv2.connectedComponents(narrow.astype(np.uint8), connectivity=4)
        dx_, dy_ = int(door_px[0]), int(door_px[1])
        yy, xx = np.nonzero(l_n > 0)
        if len(xx):
            j = int(np.argmin((xx - dx_) ** 2 + (yy - dy_) ** 2))
            if math.hypot(xx[j] - dx_, yy[j] - dy_) <= 60 * pf:
                strip = l_n == l_n[yy[j], xx[j]]
                if strip.sum() / (pf * pf) / 1e4 >= 1.0:
                    claim[strip] = k_e + 1
                    ent["from_strip"] = True
    # 2d. (round 6) a bath / WC without printed dims: the rectangle around its own fixtures (+ 20 cm), snapped to the walls
    for k in [k for k in pts if not seeds[k].get("dims_cm") and seeds[k].get("type") == "bathroom"]:
        own = own_fixtures(k)
        if len(own) < 2:
            continue
        xs_ = [p[0] for p in own]; ys_ = [p[1] for p in own]
        mg = 45 * pf
        r0 = [min(xs_) - mg, min(ys_) - mg, max(xs_) + mg, max(ys_) + mg]
        r1, snapped = snap_edges(r0, bar_r, inside, int(60 * pf))
        m = np.zeros((Hr, Wr), np.uint8)
        cv2.rectangle(m, (int(r1[0]), int(r1[1])), (int(r1[2]) - 1, int(r1[3]) - 1), 1, -1)
        take = (m > 0) & inside & (claim == 0)
        if take.sum() / (pf * pf) / 1e4 >= 1.0:
            claim[take] = k + 1
            seeds[k]["from_box"] = True
            rect_of[k] = {"rect_px": [float(v) for v in r1], "fit": None, "snapped": snapped, "from": "its fixtures"}
    # 2a. a room WITHOUT printed dims whose reading box lies inside the building: that box, snapped to the walls
    for k in [k for k in pts if not seeds[k].get("dims_cm") and not seeds[k].get("from_box") and not seeds[k].get("from_strip")]:
        s = seeds[k]
        rb = s.get("room_box_px")
        if not rb:
            continue
        cs_ = [to_r((rb[0], rb[1])), to_r((rb[2], rb[1])), to_r((rb[2], rb[3])), to_r((rb[0], rb[3]))]
        xs_, ys_ = [c[0] for c in cs_], [c[1] for c in cs_]
        r0 = [min(xs_), min(ys_), max(xs_), max(ys_)]
        cx_, cy_ = int((r0[0] + r0[2]) / 2), int((r0[1] + r0[3]) / 2)
        if not (0 <= cy_ < Hr and 0 <= cx_ < Wr and env_r[cy_, cx_]):
            continue            # the reading box sits outside the building (an entrance path): the door rule places it
        r1, snapped = snap_edges(r0, bar_r, inside, t)
        m = np.zeros((Hr, Wr), np.uint8)
        cv2.rectangle(m, (int(r1[0]), int(r1[1])), (int(r1[2]) - 1, int(r1[3]) - 1), 1, -1)
        take = (m > 0) & inside & (claim == 0)
        if take.sum() / (pf * pf) / 1e4 >= 0.5:
            claim[take] = k + 1
            s["from_box"] = True
            rect_of[k] = {"rect_px": r1, "fit": None, "snapped": snapped, "from": "reading box"}
    # 2b. a room without printed dims and no usable box keeps the tracer's flood region, on unclaimed space
    old_rooms = {r["id"]: r for r in plan["rooms"]}
    sc_ = ppc / F
    for k, s in enumerate(seeds):
        if s.get("dims_cm") or s.get("auto") or s.get("from_box") or s.get("from_strip") or s["room_id"] not in old_rooms:
            continue
        if s.get("is_outdoor") and re.search(r"חצר|גינה", s.get("name_he") or ""):
            continue            # (round 18) a courtyard / garden is built by the outdoor rule from its paved area, not the tracer's flood
        if s.get("is_outdoor") and os.path.exists(os.path.join(d, "pdf-vectors.json")):
            continue            # (T19) a vector PDF: an outdoor room is built by the outdoor rule from the drawing, whether or not the
                                #    reading gave its printed size (846: the terrace without dims kept a partial flood, 1 of 3 readings)
        loop = old_rooms[s["room_id"]]["loop"]
        if len(loop) < 3:
            continue
        m = np.zeros((Hr, Wr), np.uint8)
        cv2.fillPoly(m, [np.round(np.array([tp(M, x * sc_, y * sc_) for x, y in loop])).astype(np.int32)], 1)
        region = (m > 0) & (outside if s.get("is_outdoor") else inside) & (claim == 0)
        if s.get("is_outdoor") and paved_r is not None:
            region &= paved_r
        if gl_r is not None:          # (round 8) only the part around its label, bounded by walls AND glazing / railing
            reg2 = region & ~gl_r
            k30 = int(30 * pf) | 1
            reg2 = cv2.morphologyEx(reg2.astype(np.uint8), cv2.MORPH_OPEN, np.ones((k30, k30), np.uint8)) > 0
            n2, l2 = cv2.connectedComponents(reg2.astype(np.uint8), connectivity=4)
            lx2, ly2 = [int(round(v)) for v in to_r(s.get("label_px") or s["at_px"])]
            if n2 > 1:
                yy2, xx2 = np.nonzero(l2 > 0)
                j2 = int(np.argmin((xx2 - lx2) ** 2 + (yy2 - ly2) ** 2))
                if math.hypot(xx2[j2] - lx2, yy2[j2] - ly2) <= 150 * pf:
                    region = l2 == l2[yy2[j2], xx2[j2]]
                else:
                    region = np.zeros_like(region)      # the flood is elsewhere (a leak): drop it, the leftover rules place the room
            else:
                region = np.zeros_like(region)
        if region.sum() * (1 / (pf * pf)) / 1e4 > 0.3:
            claim[region] = k + 1
            s["kept_flood"] = True
    # 3. leftover pieces
    # (round 17) first, split at the drawn windows: a label-less piece beyond them, bounded little by walls (846's beam strip
    #    between the NE windows and the beam's own outline), is outside; the interior pieces are then cut as before
    min_px = (0.3e4) * pf * pf          # 0.3 m2
    left_w = inside & (claim == 0) & ~win_r
    n_w, l_w, st_w, _ = cv2.connectedComponentsWithStats(left_w.astype(np.uint8), connectivity=4)
    win_d5 = cv2.dilate(win_r.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    for c in range(1, n_w):
        if st_w[c, cv2.CC_STAT_AREA] < min_px:
            continue
        pc = l_w == c
        if any(0 <= y_ < Hr and 0 <= x_ < Wr and pc[y_, x_] for (x_, y_, _) in pts.values()):
            continue
        e_ = pc & ~(cv2.erode(pc.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
        n_e = max(1, int(e_.sum()))
        w_cm = 2 * float(cv2.distanceTransform(pc.astype(np.uint8), cv2.DIST_L2, 5).max()) / pf
        wsh, wls, osh = (e_ & ring_wall).sum() / n_e, (e_ & win_d5).sum() / n_e, (e_ & ring_out).sum() / n_e
        if w_cm <= 120 and wsh < 0.4 and wls >= 0.15 and open_slab_ks and (pc & slab_cut).sum() >= 0.5 * pc.sum():
            # (round 20) it touched the open plan before the 110 cm split: it goes back to the nearest open-plan slab
            back_src = np.isin(claim, [k_ + 1 for k_ in open_slab_ks])
            _, lab_b = cv2.distanceTransformWithLabels((~back_src).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
            map_b = np.zeros(int(lab_b.max()) + 1, np.int32); map_b[lab_b[back_src]] = claim[back_src]
            frame_b = cv2.morphologyEx(win_r.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(35 * pf) | 1, int(35 * pf) | 1))) > 0
            give = pc & ~frame_b                      # not the band INSIDE the window frame (between its glass lines)
            claim[give] = map_b[lab_b[give]]
            notes.append(f"a {give.sum() / (pf * pf) / 1e4:.1f} m² piece the open-plan split cut off its own region: back to the open plan")
            continue
        if w_cm <= 120 and wsh < 0.4 and wls >= 0.15:
            # (round 18) only the part on the FAR side of the window lines it touches: the piece can run round a window's end
            #    into the room's corner (846: the kitchen's NE corner at the partition wall end) — that part stays inside
            touch = [L_ for L_ in win_lines if (L_[4] & cv2.dilate(pc.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)).any()]
            beyond = pc.copy()
            if touch:
                cut_m = np.zeros((Hr, Wr), np.uint8)
                for (cxw, cyw, uxw, uyw, _m) in touch:
                    cv2.line(cut_m, (int(cxw - uxw * 4000), int(cyw - uyw * 4000)), (int(cxw + uxw * 4000), int(cyw + uyw * 4000)), 1, 2)
                n_s, l_s = cv2.connectedComponents((pc & (cut_m == 0)).astype(np.uint8), connectivity=4)
                beyond = np.zeros_like(pc)
                for c2 in range(1, n_s):
                    sp = l_s == c2
                    yy2, xx2 = np.nonzero(sp)
                    sx, sy = xx2.mean(), yy2.mean()
                    far = all(((sx - cxw) * -uyw + (sy - cyw) * uxw) * ((env_cx - cxw) * -uyw + (env_cy - cyw) * uxw) < 0 for (cxw, cyw, uxw, uyw, _m) in touch)
                    if far:
                        beyond |= sp
            else:                               # no straight window line touches it: only when it opens onto no placed room
                ring_rm = cv2.dilate(((claim > 0) & ~np.isin(claim, [k + 1 for k, s_ in enumerate(seeds) if s_.get("is_outdoor")])).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
                if (e_ & ring_rm).sum() >= 0.10 * n_e:
                    beyond = np.zeros_like(pc)
            if not beyond.any():
                continue
            pc = beyond
            inside[pc] = False; outside[pc] = True
            notes.append(f"a {pc.sum() / (pf * pf) / 1e4:.1f} m² label-less piece beyond the windows ({wsh * 100:.0f} % walls, {wls * 100:.0f} % windows, {w_cm:.0f} cm wide): outside (a beam / ledge strip)")
    left = inside & (claim == 0)
    n_l, l_l, st_l, _ = cv2.connectedComponentsWithStats(left.astype(np.uint8), connectivity=4)
    hall_k = None
    # an indoor label without dims whose point fell inside a claimed rectangle takes the nearest leftover piece (<= 150 cm)
    nodim_piece = {}
    for k, (x, y, _) in pts.items():
        if seeds[k].get("dims_cm") or l_l[y, x] > 0:
            continue
        best_c = None
        for c in range(1, n_l):
            if st_l[c, cv2.CC_STAT_AREA] < min_px:
                continue
            yy, xx = np.nonzero(l_l == c)
            dmin = float(np.sqrt(np.min((xx - x) ** 2 + (yy - y) ** 2))) / pf
            if dmin <= 150 and (best_c is None or dmin < best_c[0]):
                best_c = (dmin, c)
        if best_c:
            nodim_piece[best_c[1]] = k
    for c in range(1, n_l):
        if st_l[c, cv2.CC_STAT_AREA] < min_px:
            continue
        piece = l_l == c
        area_m2 = st_l[c, cv2.CC_STAT_AREA] / (pf * pf) / 1e4
        owners = [k for k, (x, y, _) in pts.items() if not seeds[k].get("dims_cm") and piece[y, x]] or ([nodim_piece[c]] if c in nodim_piece else [])
        if owners:
            k = owners[0]
            rb = seeds[k].get("room_box_px")
            if rb and seeds[k] is not ent:
                bm = np.zeros((Hr, Wr), np.uint8)
                cs_ = [to_r((rb[0], rb[1])), to_r((rb[2], rb[1])), to_r((rb[2], rb[3])), to_r((rb[0], rb[3]))]
                cv2.fillPoly(bm, [np.round(np.array(cs_)).astype(np.int32)], 1)
                bm = cv2.dilate(bm, np.ones((int(30 * pf) | 1, int(30 * pf) | 1), np.uint8)) > 0
                inbox = piece & bm
                if inbox.sum() > 0.3 * piece.sum():
                    rest = piece & ~bm
                    piece = inbox
                    left[rest] = True      # the rest of the piece is re-handled below as unlabelled
            claim[piece] = k + 1
            continue
        touches_door = door_px is not None and np.hypot(*(np.array(np.nonzero(piece))[::-1].T - np.array(door_px)).T).min() <= 60 * pf
        if area_m2 >= 3.0 and touches_door and ent is not None and ent_k_has_room(seeds, claim, ent) is False:
            k = seeds.index(ent)
            claim[piece] = k + 1
            continue
        if area_m2 >= 3.0 and touches_door:
            if hall_k is None:
                seeds.append({"id": "hall-entrance", "room_id": "r-hall-entrance", "name_he": "מבואה", "name_en": "Hall", "type": "hall", "is_outdoor": False, "auto": True, "auto_reason": "entrance-hall", "at_px": [0, 0]})
                hall_k = len(seeds) - 1
            claim[piece] = hall_k + 1
            continue
        # join the labelled room it opens into (longest shared edge)
        ring_p = (cv2.dilate(piece.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~piece
        nb = claim[ring_p]
        nb = nb[nb > 0]
        dtp = cv2.distanceTransform(piece.astype(np.uint8), cv2.DIST_L2, 5)
        width_cm = 2 * float(dtp.max()) / pf
        edge_p = piece & ~(cv2.erode(piece.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
        on_env = float((edge_p & ring_out).sum()) / max(1, int(edge_p.sum()))
        wall_share = float((edge_p & ring_wall).sum()) / max(1, int(edge_p.sum()))
        win_share = float((edge_p & (cv2.dilate(win_r.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)).sum()) / max(1, int(edge_p.sum()))
        if not owners and width_cm <= 120 and wall_share < 0.4 and (win_share >= 0.15 or on_env >= 0.15):
            inside[piece] = False; outside[piece] = True
            notes.append(f"a {area_m2:.1f} m² label-less piece bounded {wall_share * 100:.0f} % by walls, {win_share * 100:.0f} % by windows: beyond the facade (outside)")
            continue
        if width_cm <= 110 and on_env >= 0.25:
            inside[piece] = False; outside[piece] = True
            notes.append(f"a {area_m2:.1f} m² strip {width_cm:.0f} cm wide along the building edge: outside (a roof / ledge strip)")
            continue
        PRIVATE = {"bedroom", "bathroom", "storage", "safe_room"}
        if width_cm <= 170 and area_m2 >= 1.0 and any(seeds[v - 1].get("type") in PRIVATE for v in set(nb.tolist())) and len(set(nb.tolist())) >= 2:
            seeds.append({"id": f"corridor-{c}", "room_id": f"r-corridor-{c}", "name_he": "מעבר", "name_en": "Corridor", "type": "hall", "is_outdoor": False,
                          "auto": True, "auto_reason": "corridor", "at_px": [0, 0]})
            claim[piece] = len(seeds)
            notes.append(f"corridor-{c}: a {width_cm:.0f} cm wide passage serving {sorted({seeds[v - 1]['id'] for v in set(nb.tolist())})}: its own room «מעבר»")
            continue
        if len(nb) and len(set(nb.tolist())) == 1 and not seeds[int(nb[0]) - 1].get("is_outdoor") and not seeds[int(nb[0]) - 1].get("dims_cm"):
            claim[piece] = int(nb[0])          # enclosed by one room and walls: a corner of that room (never a printed room)
            continue
        if (len(nb) and len(set(nb.tolist())) == 1 and not seeds[int(nb[0]) - 1].get("is_outdoor")
                and os.path.exists(os.path.join(d, "pdf-vectors.json"))):
            # (T30, 2026-11-06) a vector PDF measures a printed room on its own dimension lines, so a niche walled on its
            #    other sides joins the one printed room it opens onto: its loop then sits on the drawn walls (846: the guest
            #    bath's basin niche was left out by the 140 x 199 rectangle — fork F's wall-vs-loop gate)
            #    The room's own loop is not re-traced: the niche is recorded and added to the finished loop (auto_finalize),
            #    so the printed sides measured on the dimension lines stay where they are
            cs_n, _ = cv2.findContours(piece.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for c_n in cs_n:
                if len(c_n) >= 3:
                    niches.setdefault(seeds[int(nb[0]) - 1]["room_id"], []).append(
                        [[round(v_ * F / ppc, 1) for v_ in tp(Mi, float(x_), float(y_))] for x_, y_ in c_n.reshape(-1, 2)])
            notes.append(f"a {area_m2:.1f} m² niche walled on its other sides opens only onto {seeds[int(nb[0]) - 1]['id']}: its niche")
            continue
        OPEN_TYPES = {"hall", "living", "kitchen", "other"}       # never a bedroom, a bath, a laundry or a store
        nb = np.array([v for v in nb if seeds[v - 1].get("type") in OPEN_TYPES and not seeds[v - 1].get("is_outdoor")], dtype=np.int64)
        nb_free = np.array([v for v in nb if not seeds[v - 1].get("dims_cm")], dtype=np.int64)
        if len(nb_free):
            claim[piece] = np.bincount(nb_free).argmax()
        elif len(nb):
            claim[piece] = np.bincount(nb).argmax()
        elif area_m2 >= 1.0:
            seeds.append({"id": f"corridor-{c}", "room_id": f"r-corridor-{c}", "name_he": "מעבר", "name_en": "Corridor", "type": "hall", "is_outdoor": False,
                          "auto": True, "auto_reason": "corridor", "at_px": [0, 0]})
            claim[piece] = len(seeds)
            notes.append(f"corridor-{c}: {area_m2:.1f} m² of unlabelled space next to bedrooms/baths only: its own room «מעבר» (for review)")
        else:
            # (round 21) look again across a drawn line that is not a wall (846: the entrance door's swing arc cut the floor in
            #    front of the door off the living room): the open room within 20 cm, across free space only
            k20 = int(20 * pf) * 2 + 1
            ring20 = (cv2.dilate(piece.astype(np.uint8), np.ones((k20, k20), np.uint8)) > 0) & ~piece & ~(cv2.dilate(bar_r.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
            nb20 = claim[ring20]; nb20 = np.array([v for v in nb20[nb20 > 0] if seeds[v - 1].get("type") in OPEN_TYPES and not seeds[v - 1].get("is_outdoor")], dtype=np.int64)
            if len(nb20):
                claim[piece] = int(np.bincount(nb20).argmax())
                notes.append(f"a {area_m2:.1f} m² piece behind a drawn line (not a wall) joined {seeds[int(np.bincount(nb20).argmax()) - 1]['id']}")
            else:
                notes.append(f"a {area_m2:.1f} m² piece opens into no hall or living room: left untraced")
    # (round 6) an outdoor passage («מעבר צר») is part of the terrace beside it: one terrace room
    terr = [k for k, s_ in enumerate(seeds) if s_.get("is_outdoor") and "מרפסת" in (s_.get("name_he") or "")]
    for k, s_ in enumerate(seeds):
        if s_.get("is_outdoor") and "מעבר" in (s_.get("name_he") or "") and terr:
            j = terr[0]
            claim[claim == k + 1] = j + 1
            s_["merged_into"] = seeds[j]["room_id"]
    full_b = cv2.imread(os.path.join(d, "barrier.png"), cv2.IMREAD_GRAYSCALE)
    if full_b is not None:
        bb = cv2.resize((full_b > 127).astype(np.uint8), (W, H), interpolation=cv2.INTER_AREA) > 0
        bb = cv2.morphologyEx(bb.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0   # heal railing gaps
        rail_r = cv2.warpAffine(bb.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
        outside = outside & ~cv2.dilate(rail_r.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)   # the terrace ends at its railing
    # 5. outdoor rooms
    n_o, comp_o = cv2.connectedComponents(outside.astype(np.uint8), connectivity=4)
    for k, s in enumerate(seeds):
        if not s.get("is_outdoor") or s.get("kept_flood") or s.get("merged_into") or s.get("void_on_this_floor"):
            continue
        x, y = [int(round(v)) for v in to_r(s.get("label_px") or s["at_px"])]
        if not (0 <= y < Hr and 0 <= x < Wr):
            continue
        if not outside[y, x]:
            yy, xx = np.nonzero(outside)
            j = int(np.argmin((xx - x) ** 2 + (yy - y) ** 2)); x, y = int(xx[j]), int(yy[j])
        reg = comp_o == comp_o[y, x]
        rb = s.get("room_box_px")
        if rb and re.search(r"חצר|גינה", s.get("name_he") or ""):
            reg = ~env_r & ~bar_r & (claim == 0)     # (round 18) a courtyard's paving is cut by its tile joints: not one flood
        if rb:
            bm = np.zeros((Hr, Wr), np.uint8)
            cs_ = [to_r((rb[0], rb[1])), to_r((rb[2], rb[1])), to_r((rb[2], rb[3])), to_r((rb[0], rb[3]))]
            cv2.fillPoly(bm, [np.round(np.array(cs_)).astype(np.int32)], 1)
            reg = reg & (bm > 0)
        elif not s.get("in_envelope"):   # no reading box: at most 6 m around the label (an open terrace must not swallow the garden)
            yy_, xx_ = np.mgrid[0:Hr, 0:Wr]
            reg = reg & ((xx_ - x) ** 2 + (yy_ - y) ** 2 <= (600 * pf) ** 2)
        # (T19) a terrace inside the building's outline is bounded by the drawing — its railing / parapet and the 3.5 m cap below
        if paved_r is not None:
            reg = reg & paved_r
        yard_ = bool(re.search(r"חצר|גינה", s.get("name_he") or "")) and bool(rb)   # (round 18) a private courtyard / garden:
        lim_ = 900 if yard_ else 350                                                 # its paved area inside its reading box, up to 9 m out
        near_b = cv2.dilate(env_r.astype(np.uint8), np.ones((int(lim_ * pf) | 1, int(lim_ * pf) | 1), np.uint8)) > 0
        reg = reg & near_b          # a terrace / patio is never more than 3.5 m from the building
        if reg.any():
            k80 = int(80 * pf) | 1
            reg_c = cv2.morphologyEx(reg.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (k80, k80)))
            cs_o, _ = cv2.findContours(reg_c, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            filled = np.zeros_like(reg_c)
            cv2.drawContours(filled, cs_o, -1, 1, -1)
            reg = (filled > 0) & outside          # outside includes a terrace the railing closes inside the envelope
            reg = (cv2.dilate(reg.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2) > 0) & ~bar_r & ~inside   # give back the railing erosion (~3 cm a side)
        if CHAINS and reg.any():
            ys_r, xs_r = np.nonzero(reg)
            for c in CHAINS:
                A_ = to_r(c["a"]); B_ = to_r(c["b"])
                mx_, my_ = int((A_[0] + B_[0]) / 2), int((A_[1] + B_[1]) / 2)
                if not (0 <= my_ < Hr and 0 <= mx_ < Wr) or not reg[my_, mx_]:
                    continue                         # only the dimension lines drawn in this outdoor room
                n_before = int(reg.sum())
                dx_, dy_ = B_[0] - A_[0], B_[1] - A_[1]
                if abs(dy_) <= TAN4 * abs(dx_):      # horizontal: the x extent at the tick positions
                    lo_, hi_ = sorted([A_[0], B_[0]]); band = (ys_r >= my_ - 25 * pf) & (ys_r <= my_ + 25 * pf)
                    if not band.any():
                        continue
                    rx0, rx1 = xs_r[band].min(), xs_r[band].max()
                    for y_ in range(int(ys_r.min()), int(ys_r.max()) + 1):     # the whole face the tick marks, not a band
                        row = np.nonzero(reg[y_])[0]
                        if not len(row):
                            continue
                        if 0 < row.min() - lo_ <= 12 * pf: reg[y_, int(round(lo_)):row.min()] = True
                        if 0 < hi_ - row.max() <= 12 * pf: reg[y_, row.max() + 1:int(round(hi_)) + 1] = True
                elif abs(dx_) <= TAN4 * abs(dy_):    # vertical: the y extent at the tick positions
                    lo_, hi_ = sorted([A_[1], B_[1]])
                    for x_ in range(int(xs_r.min()), int(xs_r.max()) + 1):
                        col = np.nonzero(reg[:, x_])[0]
                        if not len(col):
                            continue
                        if 0 < col.min() - lo_ <= 12 * pf: reg[int(round(lo_)):col.min(), x_] = True
                        if 0 < hi_ - col.max() <= 12 * pf: reg[col.max() + 1:int(round(hi_)) + 1, x_] = True
                notes.append(f"{s['id']}: dimension line {c['len_cm']} cm drawn in it: +{int(reg.sum()) - n_before} px toward its ticks")
        claim[reg & (claim == 0)] = k + 1
    # (round 17) a glass wall between an open-plan room and an outdoor room (846: the curved glass and the sliding panels to the
    #    terrace) belongs to the room up to its terrace-side face (the ruling: the threshold is on the terrace side); a window
    #    that faces no outdoor room (the NE window under the beam) keeps the room at its inner face
    open_ks = [k for k in rect_of if "open-plan slab" in str(rect_of[k].get("from"))]
    out_ks = [k for k, s_ in enumerate(seeds) if s_.get("is_outdoor") and (claim == k + 1).any()]
    if open_ks and out_ks and win_r.any():
        k_b = int(35 * pf) | 1             # the glass band: the space between the drawn glass lines (846's curved wall ~25 cm)
        glass_wall = win_r                                 # (round 20 tried: only the curved V40 glass — the hand also takes the sliding-door band)
        band_g = cv2.morphologyEx(glass_wall.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_b, k_b))) > 0   # window panels
        open_m = np.isin(claim, [k + 1 for k in open_ks]); out_m = np.isin(claim, [k + 1 for k in out_ks])
        auto_m = np.isin(claim, [k + 1 for k, s_ in enumerate(seeds) if s_.get("auto_reason") == "corridor"])   # a band piece the leftover rules called a corridor
        cand = band_g & env_r & ((claim == 0) | auto_m) & (~bar_r | win_r)       # never the terrace's own floor
        out_m = out_m & ~cand
        if os.environ.get("AUTO_ROOMS_DEBUG"):
            print("glass band:", int(band_g.sum()), int(cand.sum()), int(open_m.sum()), int(out_m.sum()))
            dbg = np.zeros((Hr, Wr, 3), np.uint8); dbg[inside] = (60, 60, 60); dbg[band_g] = (0, 120, 0); dbg[cand] = (0, 255, 0); dbg[win_r] = (255, 255, 255); dbg[out_m] = (120, 60, 0); dbg[open_m & ~cand] = (0, 0, 160)
            cv2.imwrite(os.path.join(d, "debug-glass-band.png"), dbg)
        k40 = int(40 * pf) * 2 + 1             # per pixel: within 40 cm of the open-plan room AND of the terrace (the glass between them)
        near_open = cv2.dilate(open_m.astype(np.uint8), np.ones((k40, k40), np.uint8)) > 0
        near_out = cv2.dilate(out_m.astype(np.uint8), np.ones((k40, k40), np.uint8)) > 0
        take_b = cand & near_open & near_out
        wgb_p = os.path.join(d, "windows-glass.png")
        if os.path.exists(wgb_p):         # (round 20) the band ends AT the drawn glass line (O-WIN): nothing past it
            wgm_ = cv2.imread(wgb_p, cv2.IMREAD_GRAYSCALE)
            wgs_ = cv2.resize((wgm_ > 127).astype(np.uint8) * 255, (W, H), interpolation=cv2.INTER_AREA) > 0
            glass_line = (cv2.warpAffine(wgs_.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0) | gpen_r
            # a band pixel is kept when the room reaches it without crossing a glass line: geodesic from the open-plan
            #    rooms through the band, the glass lines as walls
            reach = open_m.copy()
            passable = (take_b | open_m) & ~glass_line
            for _ in range(int(60 * pf)):
                grown = (cv2.dilate(reach.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & passable
                if (grown == reach).all():
                    break
                reach = grown
            take_b = take_b & (reach | (cv2.dilate(reach.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & glass_line)
        # (round 22) the band is floor only at a glass WALL or a glass DOOR: the curved V40 glass, or glazing within 1.5 m of a
        #    drawn exit arrow (846: the sliding door to the terrace); a fixed window's band stays outside (the drawing: the
        #    floor stops at the window's inner face — the dining's east windows by the column)
        pv_b = os.path.join(d, "pdf-vectors.json")
        if os.path.exists(pv_b):
            door_zone = cv2.dilate(gpen_r.astype(np.uint8), np.ones((int(40 * pf) * 2 + 1, int(40 * pf) * 2 + 1), np.uint8)) > 0
            for t_ in json.load(open(pv_b, encoding="utf-8")).get("filled_triangles_px", []):
                if len(t_) > 3 and re.search(r"siman|symb|arrow", str(t_[3]), re.I) and 15 <= t_[2] / ppc <= 90:
                    ax_t, ay_t = to_r((t_[0], t_[1]))
                    cv2.circle(door_zone.view(np.uint8), (int(ax_t), int(ay_t)), int(150 * pf), 1, -1)
            take_b &= door_zone
        # (round 21) never the frame / pocket beside a column or wall end (846: the white jamb rectangle at the terrace column):
        #    the band is glass on both faces, so a band pixel within 20 cm of a wall is not floor
        take_b &= ~(cv2.dilate(bar_r.astype(np.uint8), np.ones((int(20 * pf) * 2 + 1, int(20 * pf) * 2 + 1), np.uint8)) > 0)
        n_band = int(take_b.sum())
        if n_band:
            src = (~open_m).astype(np.uint8)
            _, lab_idx = cv2.distanceTransformWithLabels(src, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
            idx_map = np.zeros(int(lab_idx.max()) + 1, np.int32)
            # each zero pixel of src has its own label; map label -> that pixel's claim
            lab_at_open = lab_idx[open_m]
            idx_map[lab_at_open] = claim[open_m]
            claim[take_b] = idx_map[lab_idx[take_b]]
        if n_band:
            notes.append(f"glass wall to the terrace: {n_band / (pf * pf) / 1e4:.2f} m² of glazing band joined the open-plan rooms (threshold on the terrace side)")
    # (round 8) a bath is never smaller than its fixtures' bounding box (+ 15 cm): it takes that box from rooms without dims
    for k in [k for k in pts if seeds[k].get("type") == "bathroom" and not seeds[k].get("dims_cm")]:   # a printed bath keeps its printed size
        own = own_fixtures(k)
        if len(own) < 2:
            continue
        xs_ = [p_[0] for p_ in own]; ys_ = [p_[1] for p_ in own]
        mg = 15 * pf
        bx = np.zeros((Hr, Wr), np.uint8)
        cv2.rectangle(bx, (int(min(xs_) - mg), int(min(ys_) - mg)), (int(max(xs_) + mg), int(max(ys_) + mg)), 1, -1)
        bx = (bx > 0) & inside
        mine = claim == k + 1
        if mine.sum() < 0.8 * bx.sum():
            free_or_soft = (claim == 0) | np.isin(claim, [j + 1 for j, s_ in enumerate(seeds) if not s_.get("dims_cm") and j != k and s_.get("type") != "bathroom"])
            claim[bx & free_or_soft] = k + 1
            notes.append(f"{seeds[k]['id']}: grown to its fixtures' box")
    # (round 8) stairs from the drawing: an unlabelled corridor holding a regular tread pattern (>= 6 parallel lines 18-35 cm
    #    apart) becomes «מדרגות» for the tread area
    stroke_r = None
    sp_ = os.path.join(d, "strokes.png")
    if os.path.exists(sp_):
        st_full = cv2.imread(sp_, cv2.IMREAD_GRAYSCALE) > 127
        st_small = cv2.resize(st_full.astype(np.uint8), (W, H), interpolation=cv2.INTER_AREA) > 0
        stroke_r = cv2.warpAffine(st_small.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    elif grey is not None:
        dk = cv2.resize(((grey < 110) & ~full).astype(np.uint8), (W, H), interpolation=cv2.INTER_AREA) > 0
        stroke_r = cv2.warpAffine(dk.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    crop_g = cv2.imread(os.path.join(d, "crop.png"), cv2.IMREAD_GRAYSCALE)
    if crop_g is not None:
        ed = cv2.Canny(cv2.resize(crop_g, (W, H), interpolation=cv2.INTER_AREA), 40, 120) > 0
        ed_r = cv2.warpAffine(ed.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
        stroke_r = ed_r if stroke_r is None else (stroke_r | ed_r)
    if stroke_r is not None:
        for k, s_ in enumerate(list(seeds)):
            if s_.get("auto_reason") != "corridor":
                continue
            piece = claim == k + 1
            if not piece.any():
                continue
            ys_, xs_ = np.nonzero(piece)
            sub = stroke_r & piece
            best_t = None
            for ax_ in (0, 1):
                prof = sub.sum(axis=ax_).astype(float)            # ax 0: per column (lines along y); ax 1: per row
                if prof.max() <= 0:
                    continue
                thr = 0.35 * prof.max()
                idx = np.nonzero(prof >= thr)[0]
                if len(idx) < 6:
                    continue
                peaks = [idx[0]]
                for i_ in idx[1:]:
                    if i_ - peaks[-1] > 2:
                        peaks.append(i_)
                gaps = np.diff(peaks) / pf
                good = [g_ for g_ in gaps if 18 <= g_ <= 35]
                if len(good) >= 5 and len(good) >= 0.6 * len(gaps):
                    lo, hi = peaks[0], peaks[-1]
                    if best_t is None or len(good) > best_t[0]:
                        best_t = (len(good), ax_, lo, hi)
            if not best_t:
                fl = tread_flights(sub, pf)
                if fl is not None:
                    bx0, by0, bx1, by1, n_tr, t_len = fl
                    # the stair block = the flights' bounding box (a U-stair's well lies inside it); a side within a landing's
                    # depth of the piece's edge (1.25 x the tread length, >= 30 cm) runs on to that edge (the wall)
                    g30 = int(max(30 * pf, 1.25 * t_len))
                    ys_p, xs_p = np.nonzero(piece)
                    px0, px1, py0, py1 = xs_p.min(), xs_p.max(), ys_p.min(), ys_p.max()
                    bx0 = px0 if bx0 - px0 <= g30 else bx0
                    by0 = py0 if by0 - py0 <= g30 else by0
                    bx1 = px1 if px1 - bx1 <= g30 else bx1
                    by1 = py1 if py1 - by1 <= g30 else by1
                    blk = np.zeros_like(piece); blk[by0:by1 + 1, bx0:bx1 + 1] = True
                    treads = piece & blk
                    a_st = treads.sum() / (pf * pf) / 1e4
                    if a_st >= 1.5 and (piece & ~blk).sum() / (pf * pf) / 1e4 >= 0.5:
                        seeds.append({"id": f"stairs-{k}", "room_id": f"r-stairs-auto-{k}", "name_he": "מדרגות", "name_en": "Stairs", "type": "hall",
                                      "is_outdoor": False, "auto": True, "auto_reason": "stairs", "at_px": [0, 0]})
                        claim[treads] = len(seeds)
                        notes.append(f"stairs (T14): {n_tr} treads drawn in flights in {s_['id']} -> the stair block {(bx1 - bx0) / pf:.0f} x {(by1 - by0) / pf:.0f} cm «מדרגות» ({a_st:.1f} m²); the rest stays «מעבר»")
                        # a part of the hall the block cut off that opens onto nothing but the stairs (a landing behind the
                        # flights) is the stairs' too
                        rest_ = piece & ~blk
                        n_q, l_q = cv2.connectedComponents(rest_.astype(np.uint8), connectivity=4)
                        for q in range(1, n_q):
                            part_q = l_q == q
                            ring_q = (cv2.dilate(part_q.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~part_q & ~bar_r
                            nbq = set(claim[ring_q].tolist()) - {0, k + 1}
                            if nbq == {len(seeds)}:
                                claim[part_q] = len(seeds)
                                notes.append(f"stairs (T14): {part_q.sum() / (pf * pf) / 1e4:.1f} m² behind the flights opens only onto the stairs: the landing")
                continue
            if best_t:
                _, ax_, lo, hi = best_t
                treads = piece.copy()
                coord = np.arange(Wr)[None, :] if ax_ == 0 else np.arange(Hr)[:, None]
                treads &= (coord >= lo - 30 * pf) & (coord <= hi + 30 * pf)
                if treads.sum() / (pf * pf) / 1e4 >= 1.5:
                    seeds.append({"id": f"stairs-{k}", "room_id": f"r-stairs-auto-{k}", "name_he": "מדרגות", "name_en": "Stairs", "type": "hall",
                                  "is_outdoor": False, "auto": True, "auto_reason": "stairs", "at_px": [0, 0]})
                    claim[treads] = len(seeds)
                    notes.append(f"stairs: a {best_t[0] + 1}-tread pattern in {s_['id']} -> «מדרגות»")
    # (round 17) a LABELLED stair room («עליה לקומה 1», «מדרגות») is a straight flight: the largest rectangle of its piece
    #    grown from its label (each side moves out while the new row / column is >= 95 % inside the piece); the rest of its
    #    piece (Maale Efraim ground floor: the hallway past the stairs to the bath and the ממ"ד) is a corridor «מעבר»
    for k, s_ in enumerate(list(seeds)):
        nm = (s_.get("name_he") or "") + " " + (s_.get("name_en") or "")
        if s_.get("auto") or s_.get("is_outdoor") or not re.search(r"מדרג|עליה|stair", nm, re.I) or k not in pts:
            continue
        piece = claim == k + 1
        lx_, ly_ = pts[k][0], pts[k][1]
        if not piece.any() or not (0 <= ly_ < Hr and 0 <= lx_ < Wr) or not piece[ly_, lx_]:
            continue
        x0_, x1_, y0_, y1_ = lx_, lx_, ly_, ly_
        grew = True
        while grew:
            grew = False
            if x0_ > 0 and piece[y0_:y1_ + 1, x0_ - 1].mean() >= 0.95: x0_ -= 1; grew = True
            if x1_ < Wr - 1 and piece[y0_:y1_ + 1, x1_ + 1].mean() >= 0.95: x1_ += 1; grew = True
            if y0_ > 0 and piece[y0_ - 1, x0_:x1_ + 1].mean() >= 0.95: y0_ -= 1; grew = True
            if y1_ < Hr - 1 and piece[y1_ + 1, x0_:x1_ + 1].mean() >= 0.95: y1_ += 1; grew = True
        box = np.zeros_like(piece); box[y0_:y1_ + 1, x0_:x1_ + 1] = True
        rest = piece & ~box
        n_r, l_r = cv2.connectedComponents(rest.astype(np.uint8), connectivity=4)
        for c in range(1, n_r):
            part = l_r == c
            a_m2 = part.sum() / (pf * pf) / 1e4
            if a_m2 < 1.0:
                # (round 19) a recess past the flight belongs to the room on its OPEN side (Maale ground: the U recess
                #    above the stairs opens onto the kitchen): the room it touches most across free space, not the stairs
                ring_r = (cv2.dilate(part.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~part & ~bar_r
                nb_r = claim[ring_r]; nb_r = nb_r[(nb_r > 0) & (nb_r != k + 1)]
                if len(nb_r):
                    tgt_r = int(np.bincount(nb_r).argmax())
                    # (T15, 2026-11-06) the print wins: never when the join would push the open-side room off its printed
                    #    size (Maale ground: the recess holds the first treads; with it the kitchen measured 565 vs 485)
                    dims_t = seeds[tgt_r - 1].get("dims_cm")
                    if dims_t and len(dims_t) == 2:
                        def _err(m_):
                            yy_, xx_ = np.nonzero(m_)
                            ext = sorted([(xx_.max() - xx_.min() + 1) / pf, (yy_.max() - yy_.min() + 1) / pf], reverse=True)
                            pr_ = sorted(dims_t, reverse=True)
                            return max(abs(ext[i] - pr_[i]) / pr_[i] for i in range(2))
                        nm_ = niche_px.get(tgt_r, np.zeros_like(part))         # its niches so far are not its size
                        e0, e1 = _err((claim == tgt_r) & ~nm_), _err(((claim == tgt_r) & ~nm_) | part)
                        if e1 > e0 + 0.05:
                            # walled on its other sides, it is floor of the room it opens onto — a NICHE outside that
                            # room's printed size (the print measures the room's own rectangle): joined, and recorded so the
                            # size check measures the room without it
                            claim[part] = tgt_r
                            niche_px[tgt_r] = niche_px.get(tgt_r, np.zeros_like(part)) | part
                            cs_n, _ = cv2.findContours(part.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                            for c_n in cs_n:
                                if len(c_n) >= 3:
                                    niches.setdefault(seeds[tgt_r - 1]["room_id"], []).append(
                                        [[round(v_ * F / ppc, 1) for v_ in tp(Mi, float(x_), float(y_))] for x_, y_ in c_n.reshape(-1, 2)])
                            notes.append(f"{s_['id']}: a {a_m2:.2f} m² recess past the flight opens only onto {seeds[tgt_r - 1]['id']}: its niche, outside its printed size ({e1 * 100:.0f} % off the print with it, {e0 * 100:.0f} % without)")
                            continue
                    claim[part] = tgt_r
                    notes.append(f"{s_['id']}: a {a_m2:.2f} m² recess past the flight opens onto {seeds[tgt_r - 1]['id']}: joined it")
                continue
            seeds.append({"id": f"corridor-st{k}-{c}", "room_id": f"r-corridor-st{k}-{c}", "name_he": "מעבר", "name_en": "Corridor", "type": "hall",
                          "is_outdoor": False, "auto": True, "auto_reason": "corridor", "at_px": [0, 0]})
            claim[part] = len(seeds)
            notes.append(f"{s_['id']}: the stairs are the {(x1_ - x0_) / pf:.0f} x {(y1_ - y0_) / pf:.0f} cm flight at its label; {a_m2:.1f} m² past it is a hallway «מעבר»")
    # (round 6) an entrance with no room takes the automatic corridor nearest its label (within 4 m): the door-side strip
    def _largest_m2(m_):
        n_, l_, st_, _ = cv2.connectedComponentsWithStats(m_.astype(np.uint8), connectivity=4)
        return (st_[1:, cv2.CC_STAT_AREA].max() if n_ > 1 else 0) / (pf * pf) / 1e4
    if ent is not None and _largest_m2(claim == seeds.index(ent) + 1) < 1.0:     # none, or a sliver (its largest piece: the polygon keeps only that)
        lx, ly = to_r(ent.get("label_px") or ent["at_px"])
        best_c = None
        for k, s_ in enumerate(seeds):
            if s_.get("auto_reason") == "corridor" and (claim == k + 1).any():
                yy, xx = np.nonzero(claim == k + 1)
                dd = float(np.sqrt(np.min((xx - lx) ** 2 + (yy - ly) ** 2))) / pf
                if dd <= 400 and (best_c is None or dd < best_c[0]):
                    best_c = (dd, k)
        if best_c:
            claim[claim == best_c[1] + 1] = seeds.index(ent) + 1
            seeds[best_c[1]]["merged_into"] = ent["room_id"]
            notes.append(f"the entrance takes {seeds[best_c[1]]['id']} ({best_c[0]:.0f} cm from its label)")
            # (T10, 2026-11-06) an entrance hall reaches the front door it is named after (846: the passage it took lies
            #    ~2 m from the door, which opens straight into the living room). The hall gets the open-plan floor between the
            #    door and the passage's mouth, as wide as the door, its long side on the plan axis. Open-plan floor only (no
            #    room with printed dims, never a closed room); the open plan as one region is unchanged.
            ke = seeds.index(ent) + 1
            if door_seg is not None:
                (dax, day), (dbx, dby) = door_seg
                ent_m = claim == ke
                n_e, l_e, st_e, _ = cv2.connectedComponentsWithStats(ent_m.astype(np.uint8), connectivity=4)
                if n_e > 2:                                  # the passage it took, not a sliver the door band left by the door
                    ent_m = l_e == 1 + int(np.argmax(st_e[1:, cv2.CC_STAT_AREA]))
                yy_e, xx_e = np.nonzero(ent_m)
                d_door = min(float(np.min(np.hypot(xx_e - px_, yy_e - py_))) for px_, py_ in ((dax, day), (dbx, dby), ((dax + dbx) / 2, (day + dby) / 2))) / pf
                OPEN_K = [k + 1 for k, s_ in enumerate(seeds) if k + 1 != ke and s_.get("type") in ("hall", "living", "kitchen", "other")
                          and not s_.get("is_outdoor") and not s_.get("dims_cm")]
                open_m = np.isin(claim, OPEN_K)
                mouth = (cv2.dilate(ent_m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~ent_m & open_m
                notes.append(f"the entrance door: {d_door:.0f} cm from {seeds[best_c[1]]['id']}, chord {[round(v) for v in (dax, day, dbx, dby)]} px, mouth {int(mouth.sum())} px")
                if d_door > 150 and mouth.sum() > 0:
                    my, mx = np.nonzero(mouth)
                    mcx, mcy = float(mx.mean()), float(my.mean())
                    dcx, dcy = (dax + dbx) / 2, (day + dby) / 2
                    yy, xx = np.mgrid[0:Hr, 0:Wr]
                    if abs(mcx - dcx) >= abs(mcy - dcy):          # the walk door -> mouth runs along x
                        lo, hi = min(dax, dbx, mx.min()), max(dax, dbx, mx.max())
                        far = max((day, dby), key=lambda v: abs(v - mcy))
                        box = (xx >= lo) & (xx <= hi) & ((yy <= far) if far > mcy else (yy >= far))
                    else:
                        lo, hi = min(day, dby, my.min()), max(day, dby, my.max())
                        far = max((dax, dbx), key=lambda v: abs(v - mcx))
                        box = (yy >= lo) & (yy <= hi) & ((xx <= far) if far > mcx else (xx >= far))
                    cand = box & open_m
                    n_c, l_c = cv2.connectedComponents(cand.astype(np.uint8), connectivity=4)
                    touch_e = cv2.dilate(ent_m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
                    dm = np.zeros((Hr, Wr), np.uint8)
                    cv2.line(dm, (int(dax), int(day)), (int(dbx), int(dby)), 1, max(3, int(30 * pf)))
                    keep = np.zeros((Hr, Wr), bool)
                    for c in range(1, n_c):
                        part = l_c == c
                        near_door = cv2.dilate(((dm > 0) | ((claim == ke) & ~ent_m)).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
                        if (part & touch_e).any() and (part & near_door).any():   # the door line, or the sliver the door band left there
                            keep |= part
                    a_m2 = keep.sum() / (pf * pf) / 1e4
                    if os.environ.get("AUTO_ROOMS_DEBUG"):
                        dbg = np.zeros((Hr, Wr, 3), np.uint8); dbg[open_m] = (90, 90, 90); dbg[box & open_m] = (0, 160, 0); dbg[keep] = (0, 255, 255)
                        dbg[ent_m] = (255, 0, 0); dbg[(claim == ke) & ~ent_m] = (255, 0, 255); dbg[dm > 0] = (0, 0, 255)
                        cv2.imwrite(os.path.join(d, "debug-entrance-strip.png"), dbg)
                    if 1.0 <= a_m2 <= 8.0:
                        claim[keep] = ke
                        ent["door_strip_m2"] = round(a_m2, 2)
                        notes.append(f"the entrance reaches its front door: {a_m2:.1f} m² of open-plan floor between the door and {seeds[best_c[1]]['id']} (door {d_door:.0f} cm from the passage)")
                    else:
                        notes.append(f"the entrance door strip: {a_m2:.1f} m² (door {d_door:.0f} cm from the passage) — not applied")
    # (round 10) the cap on unlabelled rooms: one automatic corridor per floor
    cors = [k for k, s_ in enumerate(seeds) if s_.get("auto_reason") == "corridor" and (claim == k + 1).any()]
    if len(cors) > 1:
        cors.sort(key=lambda k: -(claim == k + 1).sum())
        keep_k = cors[0]
        for k in cors[1:]:
            piece = claim == k + 1
            ring_p = (cv2.dilate(piece.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~piece
            nb = claim[ring_p]; nb = nb[nb > 0]
            nb_all = nb.copy()
            nb = np.array([v for v in nb if seeds[v - 1].get("type") in ("hall", "living", "kitchen", "other") and not seeds[v - 1].get("is_outdoor")], dtype=np.int64)
            if (nb == keep_k + 1).any():
                target = keep_k + 1
            elif len(nb):
                target = int(np.bincount(nb).argmax())
            elif len(nb_all) and len(set(nb_all.tolist())) == 1:
                target = int(nb_all[0])
            else:
                continue                               # not adjacent to anything it may join: stays (for review)
            claim[piece] = target
            seeds[k]["merged_into"] = seeds[target - 1]["room_id"]
            notes.append(f"{seeds[k]['id']}: joined {seeds[target - 1]['id']} (one unlabelled corridor per floor)")
    # (round 10) the tracer's own openings came from its flood regions: keep one only if it still lies between two of the
    #    rebuilt rooms (<= 40 cm from each), else it is stale
    _rooms_now = {}
    for k, s_ in enumerate(seeds):
        mk = claim == k + 1
        if mk.any():
            _rooms_now[s_["room_id"]] = cv2.dilate(mk.astype(np.uint8), np.ones((int(40 * pf) | 1, int(40 * pf) | 1), np.uint8)) > 0
    kept_o = []
    for o in plan.get("openings", []):
        if o.get("source") == "auto_rooms adjacency" or not o.get("centre_cm"):
            kept_o.append(o); continue
        cx_, cy_ = tp(M, o["centre_cm"][0] * ppc / F, o["centre_cm"][1] * ppc / F)
        cx_, cy_ = int(round(cx_)), int(round(cy_))
        if not (0 <= cy_ < Hr and 0 <= cx_ < Wr):
            continue
        touching = [rid for rid, mk in _rooms_now.items() if mk[cy_, cx_]]
        if len(touching) >= 2 or (len(touching) == 1 and "outside" in (o.get("rooms") or [])):
            o["rooms"] = touching if len(touching) >= 2 else [touching[0], "outside"]
            kept_o.append(o)
    plan["openings"] = kept_o
    # (round 9) openings from adjacency: two rooms that touch across free space (a door gap, an open passage) share an
    #    opening; an indoor room that touches the outside across the envelope gap has an exterior door (the entrance)
    k3 = np.ones((5, 5), np.uint8)
    ids = [k for k in range(len(seeds)) if (claim == k + 1).any()]
    dil = {k: cv2.dilate((claim == k + 1).astype(np.uint8), k3) > 0 for k in ids}
    free_any = ~bar_r
    adj_openings = []
    def seg_from(mask):
        ys_, xs_ = np.nonzero(mask)
        if len(xs_) < 4:
            return None
        P = np.stack([xs_, ys_], 1).astype(float); mu = P.mean(0)
        _, sv, vt = np.linalg.svd(P - mu, full_matrices=False)
        if sv[0] > 0 and sv[1] / sv[0] > 0.18:
            return None                       # not a straight contact (an L around a corner): no opening line
        dvec = vt[0]; t_ = (P - mu) @ dvec
        A, B = mu + t_.min() * dvec, mu + t_.max() * dvec
        return [tp(Mi, A[0], A[1]), tp(Mi, B[0], B[1])]
    outside_free = outside.copy()
    # (round 18) glass is not an opening: the drawn windows (PDF window layers) and the read glazing (glazing.json) block a
    #    contact; an indoor room and an outdoor room may touch across up to 25 cm (an exterior door in its frame, Maale's
    #    courtyard door) where there is no wall and no glass
    glass_any = win_r.copy()
    gj_p = os.path.join(d, "glazing.json")
    if os.path.exists(gj_p):
        for g_ in json.load(open(gj_p, encoding="utf-8")).get("glazing", []):
            if g_.get("rect_px"):
                gm_ = np.zeros((Hr, Wr), np.uint8)
                cv2.fillPoly(gm_, [np.round(np.array([to_r(p_) for p_ in g_["rect_px"]])).astype(np.int32)], 1)
                glass_any |= gm_ > 0
    glass_any = cv2.dilate(glass_any.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    k25 = int(25 * pf) * 2 + 1
    dil_out = {k: cv2.dilate((claim == k + 1).astype(np.uint8), np.ones((k25, k25), np.uint8)) > 0 for k in ids if seeds[k].get("is_outdoor")}
    for i, a_ in enumerate(ids):
        for b_ in ids[i + 1:]:
            if seeds[a_].get("is_outdoor") and seeds[b_].get("is_outdoor"):
                continue
            one_out = seeds[a_].get("is_outdoor") or seeds[b_].get("is_outdoor")
            da_ = dil_out.get(a_, dil[a_]) if one_out else dil[a_]; db_ = dil_out.get(b_, dil[b_]) if one_out else dil[b_]
            contact = da_ & db_ & free_any & (~glass_any if one_out else np.ones_like(free_any))
            if one_out:
                contact &= (claim == 0) | dil[a_] & dil[b_]      # across the free frame between them, not deep into either room
                contact &= (cv2.dilate((claim == a_ + 1).astype(np.uint8), np.ones((k25, k25), np.uint8)) > 0) & (cv2.dilate((claim == b_ + 1).astype(np.uint8), np.ones((k25, k25), np.uint8)) > 0)
            if not contact.any():
                continue
            n_c, l_c = cv2.connectedComponents(contact.astype(np.uint8), connectivity=8)
            for c in range(1, n_c):
                cm_ = l_c == c
                seg = seg_from(cm_)
                if not seg:
                    continue
                L_ = math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) * F / ppc
                if L_ < 55 or L_ > 300:
                    continue
                adj_openings.append({"rooms": [seeds[a_]["room_id"], seeds[b_]["room_id"]], "seg": seg, "width_cm": round(L_, 1), "kind": "opening" if L_ > 140 else "door"})
        contact = dil[a_] & outside_free & ~env_r if (ent is not None and seeds[a_] is ent) else None   # the entrance's door only
        if contact is not None and contact.any():
            n_c, l_c = cv2.connectedComponents(contact.astype(np.uint8), connectivity=8)
            for c in range(1, n_c):
                seg = seg_from(l_c == c)
                if not seg:
                    continue
                L_ = math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) * F / ppc
                if 55 <= L_ <= 260:
                    adj_openings.append({"rooms": [seeds[a_]["room_id"], "outside"], "seg": seg, "width_cm": round(L_, 1), "kind": "door"})
    plan["openings"] = [o for o in plan.get("openings", []) if o.get("source") != "auto_rooms adjacency"]
    for i, o in enumerate(adj_openings):
        (ax_, ay_), (bx_, by_) = o["seg"]
        a_cm = [round(ax_ * F / ppc, 1), round(ay_ * F / ppc, 1)]; b_cm = [round(bx_ * F / ppc, 1), round(by_ * F / ppc, 1)]
        plan["openings"].append({"id": f"o-adj-{i + 1}", "kind": o["kind"], "rooms": o["rooms"], "a_cm": a_cm, "b_cm": b_cm,
                                 "centre_cm": [round((a_cm[0] + b_cm[0]) / 2, 1), round((a_cm[1] + b_cm[1]) / 2, 1)],
                                 "angle_deg": round(math.degrees(math.atan2(b_cm[1] - a_cm[1], b_cm[0] - a_cm[0])), 1), "width_cm": o["width_cm"],
                                 "sill_cm": 0, "head_cm": 215, "source": "auto_rooms adjacency"})
    notes.append(f"{len(adj_openings)} opening(s) from room adjacency")
    # (round 18) a small free notch (< 0.3 m², below the leftover rules' size) bordered mostly by ONE open-plan room is that
    #    room's corner (846: the kitchen's NE corner at the partition wall end, left between the slab and a door-gap bar)
    small_free = inside & (claim == 0)
    n_sf, l_sf, st_sf, _ = cv2.connectedComponentsWithStats(small_free.astype(np.uint8), connectivity=4)
    OPEN_T = {"hall", "living", "kitchen", "other"}
    n_notch = 0
    for c in range(1, n_sf):
        if st_sf[c, cv2.CC_STAT_AREA] >= min_px or st_sf[c, cv2.CC_STAT_AREA] < 4:
            continue
        pc = l_sf == c
        ring = (cv2.dilate(pc.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~pc
        nb = claim[ring]; nb = nb[nb > 0]
        if not len(nb):
            continue
        top = int(np.bincount(nb).argmax())
        if seeds[top - 1].get("type") in OPEN_T and not seeds[top - 1].get("is_outdoor") and not seeds[top - 1].get("dims_cm") and (nb == top).mean() >= 0.5:
            claim[pc] = top; n_notch += int(pc.sum())
    if n_notch:
        notes.append(f"{n_notch / (pf * pf) / 1e4:.2f} m² of small free notches joined the open-plan room around them")
    # (round 19) an unlabelled corridor piece that lies against an outdoor room and the outside (846: the narrow outdoor
    #    passage «מעבר צר» south of the master bedroom, down to the garden steps — its label was not read) is that outdoor
    #    room's passage, not an indoor corridor (the round-6 rule for a READ «מעבר צר» label)
    out_ids = [k for k, s_ in enumerate(seeds) if s_.get("is_outdoor") and (claim == k + 1).any()]
    if out_ids:
        out_any = np.isin(claim, [k + 1 for k in out_ids])
        for k, s_ in enumerate(seeds):
            if s_.get("auto_reason") != "corridor" or not (claim == k + 1).any():
                continue
            # (round 21) first split the claim into its walkable parts (>= 40 cm wide) and the thin bands: a passage in front of a
            #    door and a frame band along the facade are judged apart, not as one piece
            whole_ = claim == k + 1
            k40_ = int(40 * pf) | 1
            walk_all = (cv2.morphologyEx(whole_.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k40_, k40_))) > 0) & whole_
            parts_ = np.zeros(whole_.shape, np.int32)
            n_w_, l_w_ = cv2.connectedComponents(walk_all.astype(np.uint8), connectivity=4)
            parts_[walk_all] = l_w_[walk_all]
            n_t_, l_t_ = cv2.connectedComponents((whole_ & ~walk_all).astype(np.uint8), connectivity=4)
            parts_[whole_ & ~walk_all] = l_t_[whole_ & ~walk_all] + n_w_
            n_p = n_w_ + n_t_
            l_p = parts_
            for c in range(1, n_p):
                pc = l_p == c
                if not pc.any():
                    continue
                e_ = pc & ~(cv2.erode(pc.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
                n_e = max(1, int(e_.sum()))
                ring = (cv2.dilate(pc.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~pc
                on_out = float((e_ & (ring_out | (cv2.dilate(out_any.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0))).sum()) / n_e
                indoor_nb = {int(v) for v in claim[ring] if v > 0 and not seeds[int(v) - 1].get("is_outdoor")} - {k + 1}
                if pc.sum() / (pf * pf) / 1e4 >= 1.0:
                    notes.append(f"{s_['id']}: piece {pc.sum() / (pf * pf) / 1e4:.1f} m², {on_out * 100:.0f} % of its edge on the outside / an outdoor room, indoor neighbours {sorted(seeds[v - 1]['id'] for v in indoor_nb)}")
                if (on_out >= 0.3 and len(indoor_nb) <= 1) or on_out >= 0.45:   # mostly against the outside: outdoor, whatever it brushes
                    nb_o = claim[ring & out_any]
                    tgt = int(np.bincount(nb_o).argmax()) if len(nb_o) else out_ids[0] + 1
                    k60 = int(40 * pf) | 1             # its walkable part (>= 40 cm wide) joins the outdoor room; the thin rest is a
                    walk_ = (cv2.morphologyEx(pc.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k60, k60))) > 0) & pc
                    band_ = pc & ~walk_                # frame / sill band outside the glass: no room at all
                    claim[band_] = 0; inside[band_] = False; outside[band_] = True
                    notes.append(f"{s_['id']}: a {band_.sum() / (pf * pf) / 1e4:.1f} m² band under 40 cm wide against the outside: not a room")
                    pc = walk_
                    if not pc.any():
                        continue
                    claim[pc] = tgt
                    notes.append(f"{s_['id']}: a {pc.sum() / (pf * pf) / 1e4:.1f} m² piece against the outside and {seeds[tgt - 1]['id']} ({on_out * 100:.0f} % of its edge): an outdoor passage, joined {seeds[tgt - 1]['id']}")
    # (round 22) an open-plan room reaches the window's inner face: the window mask is drawn thick (the frame line, dilated
    #    and closed), so a room bounded by it stops ~10 cm short (846: the kitchen under the NE window, 0.4 m2). The room grows
    #    into the window mask by up to 10 cm — never past the drawn glass line, never into another room
    open_ks3 = [k for k in rect_of if "open-plan slab" in str(rect_of[k].get("from"))]
    if open_ks3 and win_r.any():
        wg3 = os.path.join(d, "windows-glass.png")
        glass3 = np.zeros_like(win_r)
        if os.path.exists(wg3):
            g3 = cv2.imread(wg3, cv2.IMREAD_GRAYSCALE)
            g3s = cv2.resize((g3 > 127).astype(np.uint8) * 255, (W, H), interpolation=cv2.INTER_AREA) > 0
            glass3 = cv2.warpAffine(g3s.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
        k10 = int(10 * pf) * 2 + 1
        grow_n = 0
        for k in open_ks3:
            mine = claim == k + 1
            add_ = (cv2.dilate(mine.astype(np.uint8), np.ones((k10, k10), np.uint8)) > 0) & win_r & (claim == 0) & ~glass3 & env_r
            claim[add_] = k + 1; grow_n += int(add_.sum())
        if grow_n:
            notes.append(f"open-plan rooms grew {grow_n / (pf * pf) / 1e4:.2f} m² into the window mask, up to its inner face (<= 10 cm)")
    # (round 21) a room's polygon keeps only its largest piece: a stray piece of its claim elsewhere (846: the entrance's
    #    reading-box niche at the front door, after the entrance took the passage) joins the indoor room it borders most
    for k, s_ in enumerate(seeds):
        if s_.get("is_outdoor") or not (claim == k + 1).any():
            continue
        n_p, l_p, st_p, _ = cv2.connectedComponentsWithStats((claim == k + 1).astype(np.uint8), connectivity=4)
        if n_p <= 2:
            continue
        big_ = 1 + int(np.argmax(st_p[1:, cv2.CC_STAT_AREA]))
        for c in range(1, n_p):
            if c == big_:
                continue
            pc = l_p == c
            k15 = int(15 * pf) * 2 + 1
            ring = (cv2.dilate(pc.astype(np.uint8), np.ones((k15, k15), np.uint8)) > 0) & ~pc & ~(cv2.dilate(bar_r.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
            nb = claim[ring]; nb = np.array([v for v in nb[nb > 0] if v != k + 1 and not seeds[v - 1].get("is_outdoor") and not seeds[v - 1].get("dims_cm") and not seeds[v - 1].get("auto") and seeds[v - 1].get("type") in ("hall", "living", "kitchen", "other")], dtype=np.int64)   # a labelled open room, never a printed one or an auto corridor
            if len(nb):
                tgt = int(np.bincount(nb).argmax()); claim[pc] = tgt
                if pc.sum() / (pf * pf) / 1e4 >= 0.2:
                    notes.append(f"{s_['id']}: a stray {pc.sum() / (pf * pf) / 1e4:.1f} m² piece of its claim joined {seeds[tgt - 1]['id']}")
    if os.environ.get("AUTO_ROOMS_DEBUG"):     # the final claim per room, before the polygons
        rng = np.random.default_rng(7); pal = rng.integers(60, 255, (len(seeds) + 1, 3)).astype(np.uint8); pal[0] = 0
        dbg = pal[claim]; dbg[outside & env_r & (claim == 0)] = (0, 0, 120); dbg[win_r] = (255, 255, 255); dbg[bar_r & (claim == 0)] = (90, 90, 90)
        for (cxw, cyw, uxw, uyw, _m) in win_lines:
            cv2.line(dbg, (int(cxw - uxw * 300), int(cyw - uyw * 300)), (int(cxw + uxw * 300), int(cyw + uyw * 300)), (0, 255, 255), 1)
        cv2.imwrite(os.path.join(d, "debug-claim.png"), dbg)
        json.dump({str(k + 1): s_["id"] for k, s_ in enumerate(seeds)}, open(os.path.join(d, "debug-claim.json"), "w"))
    # 6. polygons
    old = {r["id"]: r for r in plan["rooms"]}
    rooms = []
    for k, s in enumerate(seeds):
        m = claim == k + 1
        if not m.any():
            continue
        loop = mask_poly(m, (bar_r | win_r | gl_r) if gl_r is not None else (bar_r | win_r), Mi, ppc)   # (T11/T12) the drawn lines incl. the glass
        if not loop:
            continue
        if s.get("is_outdoor") and CHAINS:     # (round 13) the faces of an outdoor room sit on its dimension lines' extension lines
            g0 = Polygon(loop).buffer(0)
            for c in CHAINS:
                A_ = (c["a"][0] / ppc, c["a"][1] / ppc); B_ = (c["b"][0] / ppc, c["b"][1] / ppc)
                if not g0.contains(Point((A_[0] + B_[0]) / 2, (A_[1] + B_[1]) / 2)):
                    continue
                L_ = math.hypot(B_[0] - A_[0], B_[1] - A_[1]); ux_, uy_ = (B_[0] - A_[0]) / L_, (B_[1] - A_[1]) / L_
                ta, tb = A_[0] * ux_ + A_[1] * uy_, B_[0] * ux_ + B_[1] * uy_
                lo_t, hi_t = min(ta, tb), max(ta, tb)
                new = []
                for x_, y_ in loop:
                    t_ = x_ * ux_ + y_ * uy_
                    if 0 < t_ - lo_t <= 12:
                        x_, y_ = x_ - (t_ - lo_t) * ux_, y_ - (t_ - lo_t) * uy_
                    elif 0 < hi_t - t_ <= 12:
                        x_, y_ = x_ + (hi_t - t_) * ux_, y_ + (hi_t - t_) * uy_
                    new.append([round(x_, 1), round(y_, 1)])
                loop = new
                notes.append(f"{s['id']}: faces moved onto the extension lines of its {c['len_cm']} cm dimension line")
        g = Polygon(loop)
        o = old.get(s["room_id"], {})
        xs_, ys_ = zip(*loop)
        rooms.append({"id": s["room_id"], "name_he": s.get("name_he"), "name_en": s.get("name_en"), "type": s.get("type"), "is_outdoor": bool(s.get("is_outdoor")),
                      "roofed": o.get("roofed") if s.get("is_outdoor") else None, "loop": loop, "printed_dims_cm": s.get("dims_cm"),
                      "clear_dims_cm": [round(max(xs_) - min(xs_), 1), round(max(ys_) - min(ys_), 1)], "bbox_cm": [round(min(xs_), 1), round(min(ys_), 1), round(max(xs_), 1), round(max(ys_), 1)],
                      "area_m2": round(g.area / 1e4, 3), "source": ("auto_rooms: " + rect_of[k]["from"]) if k in rect_of and rect_of[k].get("from") else "auto_rooms: printed rectangle snapped to the walls" if k in rect_of else ("auto_rooms: leftover space" if not s.get("is_outdoor") else "auto_rooms: outdoor around its label"),
                      "auto_reason": s.get("auto_reason"), "label_moved_inside": bool(pts.get(k, (0, 0, False))[2])})
    plan["rooms"] = rooms
    # one camera per room (auto_finalize moves it to the room's pole of inaccessibility)
    plan["camera_points"] = [{"id": f"cp-{r['id'][2:] if r['id'].startswith('r-') else r['id']}", "room_id": r["id"], "x": round(Polygon(r["loop"]).centroid.x, 1),
                              "y": round(Polygon(r["loop"]).centroid.y, 1), "z": 160, "yaw_deg": 0.0, "note": "auto_rooms"} for r in rooms]
    plan.setdefault("plan_meta", {})["rooms_method"] = f"auto_rooms.py: orthogonal (axis {a_used:.1f} deg), printed rectangles snapped to the walls, leftover joined"
    plan["plan_meta"]["entrance_door_px"] = [round(v, 1) for v in tp(Mi, *door_px)] if door_px else None
    json.dump(plan, open(os.path.join(d, "plan.general.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(seeds, open(os.path.join(d, "seeds.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"axis_deg": a_used, "rects": {seeds[k]["id"]: v for k, v in rect_of.items()}, "notes": notes, "niches": niches}, open(os.path.join(d, "rooms.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    vis = cv2.cvtColor((bar_r * 80).astype(np.uint8), cv2.COLOR_GRAY2BGR)
    rng = np.random.default_rng(5)
    cols = rng.integers(60, 255, (len(seeds) + 2, 3)).astype(np.uint8)
    for k in range(len(seeds)):
        vis[claim == k + 1] = cols[k + 1]
    cv2.imwrite(os.path.join(d, "rooms-debug.png"), vis)
    print(f"auto_rooms: {len(rooms)} rooms (axis {a_used:.1f} deg), {len(rect_of)} printed rectangles, {sum(v['snapped'] for v in rect_of.values())} snapped; {len(notes)} notes")


def ent_k_has_room(seeds, claim, ent):
    k = seeds.index(ent)
    return bool((claim == k + 1).any())


if __name__ == "__main__":
    main()

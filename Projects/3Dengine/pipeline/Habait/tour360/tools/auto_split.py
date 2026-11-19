#!/usr/bin/env python
"""auto_split.py <barrier.png> <seeds.json> <px_per_cm> <out_lines.json> [debug.png]

The automatic replacement for the hand-placed zone bars of trace-plan.mjs (auto-trace, 2026-11-04).
Input: trace-plan's barrier mask (white = barrier) and one seed per printed room label (seeds.json: [{id, at_px, dims_cm?, type, ...}]).

1. A label outside the walls (an entrance label printed above the front door) is moved to the nearest interior pixel.
2. Geodesic Voronoi: every free pixel goes to the seed it reaches at the lowest cost (steps cost more in narrow necks); the
   OUTSIDE competes from the image frame.
3. Open plan by the printed dimensions: inside a free region that holds two or more labels, every label with printed dims
   ("מטבח 310/485") is a rectangle of that size, rotated to the plan's wall direction, containing its label, placed where it
   lies most inside the region and touches the most wall. The rectangles claim their pixels (best fit first); the rest of the
   region goes to its labels without dims (stairs, entrance, corridor) by the geodesic split, or to a new "hall" seed.
Every boundary between two labels that is not on a barrier is written as a trace-plan `lines` polyline (cm); labels.png is the
full-resolution label map (trace-plan's fallback for a leaking flood). New seeds are appended to seeds.json.
"""
import json
import math
import sys

import cv2
import numpy as np
from skimage.graph import MCP_Geometric

F = 3            # work at 1/3 resolution
NECK_CM = 70
K = 12.0


def dominant_angle(bar):
    edges = cv2.Canny(bar.astype(np.uint8) * 255, 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 360, 40, minLineLength=40, maxLineGap=3)
    if lines is None:
        return 0.0
    hist = np.zeros(180)
    for x1, y1, x2, y2 in lines.reshape(-1, 4):
        a = math.degrees(math.atan2(y2 - y1, x2 - x1)) % 90
        hist[int(a * 2) % 180] += math.hypot(x2 - x1, y2 - y1)
    return float(np.argmax(np.convolve(np.r_[hist[-3:], hist, hist[:3]], np.ones(7), "valid")) / 2.0)


def best_rect(comp_mask, bar, pt, a_px, b_px, ang_deg):
    """The placement of an a×b rectangle (rotated by ang) containing pt that lies most inside comp_mask and touches most wall."""
    th = math.radians(ang_deg)
    c, s = math.cos(th), math.sin(th)
    ys, xs = np.nonzero(comp_mask)
    by, bx = np.nonzero(bar)
    x0, y0 = pt
    to_uv = lambda X, Y: ((X - x0) * c + (Y - y0) * s, -(X - x0) * s + (Y - y0) * c)
    u, v = to_uv(xs, ys)
    bu, bv = to_uv(bx, by)
    R = int(max(a_px, b_px) * 1.6) + 4
    def integral(U, V):
        m = (np.abs(U) < R) & (np.abs(V) < R)
        H = np.zeros((2 * R + 1, 2 * R + 1), np.float64)
        np.add.at(H, ((V[m] + R).astype(int), (U[m] + R).astype(int)), 1)
        return H.cumsum(0).cumsum(1)
    I, B = integral(u, v), integral(bu, bv)
    def box(I_, u0, v0, u1, v1):
        u0, v0 = max(0, int(u0) + R), max(0, int(v0) + R); u1, v1 = min(2 * R, int(u1) + R), min(2 * R, int(v1) + R)
        if u1 < u0 or v1 < v0:
            return 0.0
        tot = I_[v1, u1]
        if u0 > 0: tot -= I_[v1, u0 - 1]
        if v0 > 0: tot -= I_[v0 - 1, u1]
        if u0 > 0 and v0 > 0: tot += I_[v0 - 1, u0 - 1]
        return tot
    best = None
    for (A, Bb) in ((a_px, b_px), (b_px, a_px)):
        step = max(1, int(min(A, Bb) / 24))
        for du in range(-int(A), 1, step):
            for dv in range(-int(Bb), 1, step):
                inside = box(I, du, dv, du + A, dv + Bb)
                frac = inside / max(1.0, A * Bb)
                ring = box(B, du - 3, dv - 3, du + A + 3, dv + Bb + 3) - box(B, du + 2, dv + 2, du + A - 2, dv + Bb - 2)
                score = frac * 1000 + min(ring, 4 * (A + Bb)) / (4 * (A + Bb)) * 60
                if best is None or score > best[0]:
                    best = (score, du, dv, A, Bb, frac)
    _, du, dv, A, Bb, frac = best
    corners_uv = [(du, dv), (du + A, dv), (du + A, dv + Bb), (du, dv + Bb)]
    corners = [(x0 + uu * c - vv * s, y0 + uu * s + vv * c) for uu, vv in corners_uv]
    return np.array(corners, np.float32), frac


def main():
    barrier_png, seeds_json, ppc, out_json = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
    debug_png = sys.argv[5] if len(sys.argv) > 5 else None
    full = cv2.imread(barrier_png, cv2.IMREAD_GRAYSCALE) > 127
    seeds = json.load(open(seeds_json, encoding="utf-8"))
    H0, W0 = full.shape
    bar = cv2.resize(full.astype(np.uint8), (W0 // F, H0 // F), interpolation=cv2.INTER_AREA) > 0
    bar = cv2.morphologyEx(bar.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    H, W = bar.shape
    notes = []
    # 0. the building envelope (round 3): the wall band closed over door/opening-sized gaps (120 cm) and filled into one
    #    polygon. Its outline, where it crosses free space (front door, garden doors, open edges), becomes a barrier and a
    #    trace-plan line, so an indoor room can never leak into the garden, the patio or the stairs outside it.
    nb_, lb_, sb_, _ = cv2.connectedComponentsWithStats(bar.astype(np.uint8), connectivity=8)
    big = [k for k in range(1, nb_) if sb_[k, cv2.CC_STAT_AREA] >= 0.02 * sb_[1:, cv2.CC_STAT_AREA].max()] if nb_ > 1 else []
    walls_big = np.isin(lb_, big).astype(np.uint8)
    wy, wx = np.nonzero(walls_big)
    hull_a = cv2.contourArea(cv2.convexHull(np.stack([wx, wy], 1).astype(np.int32))) if len(wx) > 2 else 0
    def envelope(k_cm):
        k = int(k_cm * ppc / F) | 1
        closed = cv2.morphologyEx(walls_big, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        inv = (closed == 0).astype(np.uint8)
        n_i, l_i = cv2.connectedComponents(inv, connectivity=4)
        border = set(np.unique(np.r_[l_i[0, :], l_i[-1, :], l_i[:, 0], l_i[:, -1]])) - {0}
        e = ((closed > 0) | ((l_i > 0) & ~np.isin(l_i, list(border)))).astype(np.uint8)
        n_e, l_e, s_e, _ = cv2.connectedComponentsWithStats(e, connectivity=8)
        if n_e > 1:
            e = (l_e == 1 + int(np.argmax(s_e[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
        return e
    # adaptive: the smallest closing (door gaps first, then wide garden openings) that seals the walls into one polygon
    # covering at least 60 % of their convex hull
    # ... and holding every indoor label except an entrance's (an entrance label is often printed on the path outside)
    must = [(int(s["at_px"][1] / F), int(s["at_px"][0] / F)) for s in seeds if not s.get("is_outdoor") and not s.get("auto")
            and "כניסה" not in (s.get("name_he") or "") and s.get("vlm_type") != "entrance"]
    must = [(y, x) for y, x in must if 0 <= y < H and 0 <= x < W]
    for k_cm in (120, 200, 300, 400):
        env = envelope(k_cm)
        if hull_a and env.sum() >= 0.6 * hull_a and all(env[y, x] for y, x in must):
            break
    notes.append(f"envelope closing {k_cm} cm ({env.sum() / max(hull_a, 1) * 100:.0f} % of the walls' hull)")
    ring = (cv2.dilate(env, np.ones((3, 3), np.uint8)) > 0) & (env == 0)
    ring_gap = ring & ~bar                                   # where the envelope crosses free space
    env_lines = []
    if ring_gap.any():
        n_r, l_r = cv2.connectedComponents(ring_gap.astype(np.uint8), connectivity=8)
        for c in range(1, n_r):
            m = (l_r == c).astype(np.uint8) * 255
            if int(m.sum() // 255) < 4:
                continue
            m = cv2.dilate(m, np.ones((3, 3), np.uint8))
            cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            ap = cv2.approxPolyDP(max(cs, key=len), 1.0, True).reshape(-1, 2)
            pc = [[round(float(px) * F / ppc, 1), round(float(py) * F / ppc, 1)] for px, py in ap]
            env_lines.append({"name": "auto envelope", "points": pc + [pc[0]], "width_px": 2, "span_cm": None})
    bar = bar | ring
    cv2.imwrite(sys.argv[4].rsplit(".", 1)[0].replace("lines", "envelope") + ".png", env * 255)
    env_m2 = env.sum() * (F / ppc) ** 2 / 1e4
    notes.append(f"envelope: {env_m2:.1f} m² closed footprint, {len(env_lines)} gap line(s) on its outline")
    free = (~bar).astype(np.uint8)
    ncomp, comp = cv2.connectedComponents(free, connectivity=4)
    frame_ids = set(np.unique(np.r_[comp[0, :], comp[-1, :], comp[:, 0], comp[:, -1]])) - {0}
    ang = dominant_angle(bar)
    # 1. an indoor label outside the envelope (an entrance label above the front door) → the nearest interior pixel
    #    (within ~2.5 m); an outdoor label (מרפסת / חצר / פטיו / מעבר צר) stays where it is printed
    pts = []
    foot = env
    inside_free = (free > 0) & (foot > 0)
    iy, ix = np.nonzero(inside_free)
    for s in seeds:
        x, y = int(round(s["at_px"][0] / F)), int(round(s["at_px"][1] / F))
        x = min(max(x, 0), W - 1); y = min(max(y, 0), H - 1)
        outside = not foot[y, x] and not s.get("is_outdoor")
        if (bar[y, x] or outside) and len(ix) and not (s.get("is_outdoor") and not bar[y, x]):
            d2 = (ix - x) ** 2 + (iy - y) ** 2
            j = int(np.argmin(d2))
            if math.sqrt(d2[j]) * F / ppc <= 250:
                if outside:
                    notes.append(f"{s['id']}: label outside the building, moved {math.sqrt(d2[j]) * F / ppc:.0f} cm inside")
                    s["moved_inside"] = True
                x, y = int(ix[j]), int(iy[j])
        s.setdefault("label_px", list(s["at_px"]))   # where the label is printed (the entrance check uses it)
        s["at_px_work"] = [x * F, y * F]
        pts.append((y, x))
    # 2. geodesic Voronoi
    dist = cv2.distanceTransform(free, cv2.DIST_L2, 5)
    r0 = NECK_CM * ppc / F
    cost = 1.0 + K * np.clip((r0 - dist) / r0, 0, 1) ** 2
    cost[bar] = np.inf
    frame = [(0, x) for x in range(0, W, 4)] + [(H - 1, x) for x in range(0, W, 4)] + [(y, 0) for y in range(0, H, 4)] + [(y, W - 1) for y in range(0, H, 4)]
    starts = [[p] for p in pts] + [[p for p in frame if not bar[p]]]
    costs = []
    for st in starts:
        c, _ = MCP_Geometric(cost, fully_connected=True).find_costs(st)
        costs.append(c)
    Cst = np.stack(costs, 0)
    lab = np.argmin(Cst, 0).astype(np.int32) + 1
    lab[~np.isfinite(Cst.min(0))] = 0
    lab[bar] = 0
    lab[lab == len(seeds) + 1] = 250   # the outside: a fixed label, clear of any seed added below
    OUT = 250
    # 3. open plan by the printed dims
    for cid in range(1, ncomp):
        if cid in frame_ids and not any(seeds[k].get("force_rect") for k, (y, x) in enumerate(pts) if comp[y, x] == cid):
            continue
        members = [k for k, (y, x) in enumerate(pts) if comp[y, x] == cid]
        forced = any(seeds[k].get("force_rect") and seeds[k].get("dims_cm") for k in members)
        if not forced and (len(members) < 2 or not any(seeds[k].get("dims_cm") for k in members)):
            continue
        cmask = comp == cid
        claim = np.zeros((H, W), np.int32)
        rects = []
        for k in members:
            dcm = seeds[k].get("dims_cm")
            if not dcm:
                continue
            a_px, b_px = dcm[0] * ppc / F, dcm[1] * ppc / F
            poly, frac = best_rect(cmask, bar, (pts[k][1], pts[k][0]), a_px, b_px, ang)
            rects.append((frac, k, poly))
        depth = np.zeros((H, W), np.float32)
        for frac, k, poly in sorted(rects, key=lambda r: -r[0]):
            m = np.zeros((H, W), np.uint8)
            cv2.fillPoly(m, [np.round(poly).astype(np.int32)], 1)
            d_ = cv2.distanceTransform(m, cv2.DIST_L2, 3)           # how deep a pixel lies in this rectangle
            take = (m > 0) & cmask & (d_ > depth)                   # an overlap goes to the rectangle that holds it deeper
            claim[take] = k + 1
            depth[take] = d_[take]
            seeds[k]["rect_fit"] = round(float(frac), 3)
            if frac < 0.85:
                notes.append(f"{seeds[k]['id']}: its printed {seeds[k]['dims_cm']} cm rectangle fits the drawing only {frac * 100:.0f} %")
        rest = cmask & (claim == 0)
        nodims = [k for k in members if not seeds[k].get("dims_cm")]
        if cid in frame_ids:
            # a region that leaks to the outside: only the printed rectangles are applied; the rest keeps the geodesic
            # inside/outside split (it is mostly garden, never a hall)
            lab[cmask & (claim > 0)] = claim[cmask & (claim > 0)]
            continue
        if nodims:
            sub = np.stack([Cst[k] for k in nodims], 0)
            pick = np.array(nodims)[np.argmin(sub, 0)] + 1
            claim[rest] = pick[rest]
        else:
            # the rest is a hall / corridor of its own when it is big enough, else it joins the nearest room
            area_m2 = rest.sum() * (F / ppc) ** 2 / 1e4
            if area_m2 >= 2.0:
                ry, rx = np.nonzero(rest)
                dd = cv2.distanceTransform(rest.astype(np.uint8), cv2.DIST_L2, 5)
                j = int(np.argmax(dd))
                hy, hx = np.unravel_index(j, dd.shape)
                seeds.append({"id": f"hall-auto-{cid}", "room_id": f"r-hall-auto-{cid}", "name_he": "מבואה", "name_en": "Hall", "type": "hall", "is_outdoor": False,
                              "at_px": [float(hx * F), float(hy * F)], "at_px_work": [int(hx * F), int(hy * F)], "dims_cm": None, "auto": True})
                k_new = len(seeds) - 1
                claim[rest] = k_new + 1
                notes.append(f"hall-auto-{cid}: {area_m2:.1f} m² of open space carried no label; made a hall")
            else:
                sub = np.stack([Cst[k] for k in members], 0)
                pick = np.array(members)[np.argmin(sub, 0)] + 1
                claim[rest] = pick[rest]
        lab[cmask] = claim[cmask]
    # every seed sits at the deepest point of its OWN region (a label can end up outside its rectangle or in a pocket)
    for k, s in enumerate(seeds):
        reg = (lab == k + 1).astype(np.uint8)
        if not reg.any():
            continue
        x, y = [int(v / F) for v in s.get("at_px_work", s["at_px"])]
        dd = cv2.distanceTransform(reg, cv2.DIST_L2, 5)
        if 0 <= y < H and 0 <= x < W and dd[y, x] >= 0.5 * dd.max():
            continue
        hy, hx = np.unravel_index(int(np.argmax(dd)), dd.shape)
        s["at_px_work"] = [int(hx * F), int(hy * F)]
    # boundaries → lines
    pairmap = {}
    for dy, dx in ((0, 1), (1, 0)):
        a = lab[:H - dy, :W - dx]; b = lab[dy:, dx:]
        ys, xs = np.nonzero((a != b) & (a > 0) & (b > 0))
        for y, x in zip(ys, xs):
            pairmap.setdefault(tuple(sorted((int(a[y, x]), int(b[y, x])))), []).append((x, y))
    name = lambda l: "outside" if l == OUT else seeds[l - 1]["id"]
    lines = []
    for (a, b), pp in sorted(pairmap.items()):
        if len(pp) < 6:
            continue
        m = np.zeros((H, W), np.uint8)
        for x, y in pp:
            m[y, x] = 255
        m = cv2.dilate(m, np.ones((3, 3), np.uint8))
        n, cl = cv2.connectedComponents(m, connectivity=8)
        for c in range(1, n):
            compm = (cl == c).astype(np.uint8) * 255
            if int(compm.sum() // 255) < 12:
                continue
            cs, _ = cv2.findContours(compm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            ap = cv2.approxPolyDP(max(cs, key=len), 1.0, True).reshape(-1, 2)
            pts_cm = [[round(float(px) * F / ppc, 1), round(float(py) * F / ppc, 1)] for px, py in ap]
            pts_cm.append(pts_cm[0])
            ys_, xs_ = np.nonzero(compm)
            span = float(np.hypot(xs_.max() - xs_.min(), ys_.max() - ys_.min())) * F / ppc
            lines.append({"name": f"auto {name(a)}|{name(b)}", "points": pts_cm, "width_px": 2, "span_cm": round(span, 1)})
    lines += env_lines
    json.dump(lines, open(out_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for s in seeds:
        if "at_px_work" in s:
            s["at_px"] = [float(v) for v in s["at_px_work"]]   # the camera seed trace-plan floods from (inside the walls)
    json.dump(seeds, open(seeds_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    full_lab = cv2.resize(lab.astype(np.uint8), (W0, H0), interpolation=cv2.INTER_NEAREST)
    full_lab[full_lab == OUT] = 0
    full_lab[full] = 0
    cv2.imwrite(out_json.rsplit(".", 1)[0].replace("lines", "labels") + ".png", full_lab)
    json.dump({"wall_angle_deg": ang, "notes": notes}, open(out_json.rsplit(".", 1)[0].replace("lines", "split") + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"auto_split: {len(seeds)} seeds, {len(lines)} boundary lines, wall angle {ang:.1f}, {len(notes)} notes")
    for n_ in notes:
        print("  note:", n_)
    if debug_png:
        rng = np.random.default_rng(7)
        cols = rng.integers(60, 255, (256, 3)).astype(np.uint8)
        vis = np.zeros((H, W, 3), np.uint8)
        vis[lab > 0] = cols[lab[lab > 0]]
        vis[bar] = (40, 40, 40)
        for l_ in lines:
            p = np.array([[int(x * ppc / F), int(y * ppc / F)] for x, y in l_["points"]], np.int32)
            cv2.polylines(vis, [p], False, (0, 0, 255), 2)
        for s in seeds:
            x, y = int(s["at_px"][0] / F), int(s["at_px"][1] / F)
            cv2.circle(vis, (x, y), 6, (255, 255, 255), -1)
            cv2.putText(vis, s["id"], (x + 8, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.imwrite(debug_png, vis)


if __name__ == "__main__":
    main()

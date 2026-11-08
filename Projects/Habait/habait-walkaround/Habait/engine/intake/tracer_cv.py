"""OpenCV port of the studio's raster tracer (Habait/tour360/tools/trace-plan.mjs, "trace-rooms.mjs").

Same reading of a clean CAD sales plan:
  walls    = the mid-grey fill (70..150), opened (drops thin strokes) then closed (heals the outlines drawn
             through the fill);
  strokes  = every dark pixel that is not wall;
  glazing  = DOUBLE strokes (two parallel lines 4..9 px apart: facade glass, railings), found with an 11x11
             box count; kept as barriers when their stroke network touches a wall, or when long and far
             from walls (a railing);
  leaves   = SINGLE strokes that touch a wall (door leaves + swing arcs, jambs, fixture outlines), cut at the
             walls so each is its own component; straight components >= 100 cm are dimension lines and are
             dropped; the rest are barriers;
  rooms    = watershed basins of the free-space distance transform: every passage narrower than
             2*core_radius (doors, including doors cut into glazing and the entrance door) is a saddle of
             the DT, so thresholding the DT separates the room cores and a flood over -DT inside the free
             space grows each core back to its walls; VLM labels that fall outside every core (a bathroom
             full of fixtures) seed their own basin; an opening of radius R removes glyph notches, the
             outer contour is simplified;
  zones    = a region that holds several VLM labels (open plan) is split by a watershed on its distance
             transform seeded at the labels (what the studio did by hand with "bars");
  openings = contacts of the dilated regions (D px): the shared basin boundary at a doorway; the width
             is the extent of the contact; <= 115 cm door, wider = opening; to the outside = entrance door;
  panes    = the glazing components, facade when an indoor room is adjacent, railing otherwise.

Everything here is in CROP PIXELS (x right, y down). The caller converts to cm with the calibrated scale.
No per-plan hand configuration: what the studio's trace-config.json listed by hand (bars, blacklists,
ignore boxes) is replaced by the VLM labels and by generic rules, and whatever that misses shows up as
edit-cost in the report rather than as a tuned result.
"""
from __future__ import annotations

import json
import math
import os

import cv2
import numpy as np


def _k(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def _dil(m, r):
    return cv2.dilate(m, _k(r)) if r > 0 else m.copy()


def _ero(m, r):
    return cv2.erode(m, _k(r)) if r > 0 else m.copy()


def _component_stats(labels, n, extra_masks=None):
    """Vectorised per-label stats: count, bbox, PCA elongation, and 'any pixel in mask' flags."""
    ys, xs = np.nonzero(labels)
    lab = labels[ys, xs]
    cnt = np.bincount(lab, minlength=n).astype(np.float64)
    sx = np.bincount(lab, weights=xs, minlength=n)
    sy = np.bincount(lab, weights=ys, minlength=n)
    sxx = np.bincount(lab, weights=xs.astype(np.float64) ** 2, minlength=n)
    syy = np.bincount(lab, weights=ys.astype(np.float64) ** 2, minlength=n)
    sxy = np.bincount(lab, weights=xs.astype(np.float64) * ys, minlength=n)
    with np.errstate(invalid="ignore", divide="ignore"):
        mx, my = sx / cnt, sy / cnt
        vxx, vyy, vxy = sxx / cnt - mx * mx, syy / cnt - my * my, sxy / cnt - mx * my
        tr, det = vxx + vyy, vxx * vyy - vxy * vxy
        disc = np.sqrt(np.maximum(0, tr * tr / 4 - det))
        l1, l2 = tr / 2 + disc, np.maximum(0, tr / 2 - disc)
        elong = np.where(l1 > 0, np.sqrt(l2 / np.maximum(l1, 1e-9)), 0)
    minx = np.full(n, np.inf); maxx = np.full(n, -np.inf); miny = np.full(n, np.inf); maxy = np.full(n, -np.inf)
    np.minimum.at(minx, lab, xs); np.maximum.at(maxx, lab, xs); np.minimum.at(miny, lab, ys); np.maximum.at(maxy, lab, ys)
    flags = {}
    for name, m in (extra_masks or {}).items():
        flags[name] = np.bincount(lab, weights=m[ys, xs].astype(np.float64), minlength=n) > 0
    return {"cnt": cnt, "mx": mx, "my": my, "elong": elong, "minx": minx, "maxx": maxx, "miny": miny, "maxy": maxy, "flags": flags}


def _simplify(contour, eps_px):
    poly = cv2.approxPolyDP(contour, eps_px, True).reshape(-1, 2).astype(float)
    if len(poly) >= 3 and _shoelace(poly) < 0:
        poly = poly[::-1]
    return poly


def _shoelace(poly):
    x, y = poly[:, 0], poly[:, 1]
    return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def _contour_of(mask):
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cs:
        return None
    return max(cs, key=cv2.contourArea)


def trace(crop_png: str, px_per_cm: float, out_dir: str, labels: list | None = None, opts: dict | None = None) -> dict:
    """labels: [{"name": str, "xy_px": [x, y], ...}] from the VLM (optional). Returns the trace dict (px)."""
    o = {"open_radius_px": 5, "door_dilate_px": 5, "cut_px": 8, "near_wall_px": 16, "double_count_min": 32,
         "dimension_min_cm": 100, "straight_elong_max": 0.06, "stroke_min_cm": 8, "stroke_density_max": 4.5, "leaf_cm": [50, 130], "railing_min_cm": 100, "edge_min_cm": 150,
         "core_radius_cm": 60, "min_room_m2": 1.5, "simplify_cm": 3, "opening_min_cm": 55, "wall_min_px": 400}
    o.update(opts or {})
    o.setdefault("debug", True)
    os.makedirs(out_dir, exist_ok=True)
    img = cv2.imread(crop_png, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise FileNotFoundError(crop_png)
    H, W = img.shape
    cm2px = lambda c: int(round(c * px_per_cm))
    log = []

    # --- masks -------------------------------------------------------------------------------------------
    grey = ((img >= 70) & (img <= 150)).astype(np.uint8)
    dark = (img < 150).astype(np.uint8)
    walls = cv2.morphologyEx(cv2.morphologyEx(grey, cv2.MORPH_OPEN, _k(2)), cv2.MORPH_CLOSE, _k(3))
    # drop specks of fill (text anti-aliasing, hatch crossings)
    nw, wl, ws, _ = cv2.connectedComponentsWithStats(walls, connectivity=4)
    keep = np.zeros(nw, bool)
    keep[1:] = ws[1:, cv2.CC_STAT_AREA] >= o["wall_min_px"]
    walls = keep[wl].astype(np.uint8)
    stroke = (dark & (1 - _dil(walls, 1))).astype(np.uint8)
    CUT = o["cut_px"]
    near_wall = _dil(walls, o["near_wall_px"])
    cut_halo = _dil(walls, CUT)
    touch_halo = _dil(walls, CUT + 4)
    barrier = walls.copy()

    # --- double lines (glazing / railings) ----------------------------------------------------------------
    box = cv2.boxFilter(stroke.astype(np.float32), -1, (11, 11), normalize=False)
    dbl = ((stroke > 0) & (box >= o["double_count_min"])).astype(np.uint8)
    n_s, s_lab = cv2.connectedComponents(stroke, connectivity=8)
    st = _component_stats(s_lab, n_s, {"touch": touch_halo, "dbl": dbl, "near": near_wall})
    diag_cm = np.hypot(st["maxx"] - st["minx"], st["maxy"] - st["miny"]) / px_per_cm
    glazing_lab = np.zeros(n_s, bool)
    for i in range(1, n_s):
        if not st["flags"]["dbl"][i]:
            continue
        if st["flags"]["touch"][i] or (diag_cm[i] >= o["railing_min_cm"]):
            glazing_lab[i] = True
    glazing_px = (dbl > 0) & glazing_lab[s_lab]
    barrier[glazing_px] = 1
    barrier[(_dil(barrier, 1) > 0) & (stroke > 0)] = 1
    log.append(f"double-line pixels {int(dbl.sum())}, kept as glazing barriers {int(glazing_px.sum())}")

    # --- single strokes, cut at the walls ------------------------------------------------------------------
    single = ((stroke > 0) & (dbl == 0)).astype(np.uint8)
    cut = ((single > 0) & (cut_halo == 0)).astype(np.uint8)
    n_c, c_lab = cv2.connectedComponents(cut, connectivity=8)
    cs = _component_stats(c_lab, n_c, {"touch": touch_halo})
    c_diag = np.hypot(cs["maxx"] - cs["minx"], cs["maxy"] - cs["miny"]) / px_per_cm
    dimension_like = (c_diag >= o["dimension_min_cm"]) & (cs["elong"] <= o["straight_elong_max"])
    # density = stroke pixels per px of extent: a line or an arc ~2..4, a closed outline (fixture) >= ~5.5
    with np.errstate(invalid="ignore", divide="ignore"):
        density = cs["cnt"] / np.maximum(1.0, c_diag * px_per_cm)
    closed_like = density > o["stroke_density_max"]
    # door leaves (a straight stroke 50..130 cm from a jamb) and their swing arcs (a quarter circle of that
    # radius); fixture outlines against a wall (beds, counters, wardrobes, sinks) are NOT barriers: the room
    # segmentation below separates rooms at the doorways without them, and keeping them carves the rooms
    leaf_like = (c_diag >= o["leaf_cm"][0]) & (c_diag <= o["leaf_cm"][1]) & (
        (cs["elong"] <= 0.10) | ((cs["elong"] >= 0.2) & (cs["elong"] <= 0.6) & (density <= 3.5)))
    # dimension lines: straight strokes with a printed number (a cluster of small glyph components) at their
    # midpoint. Any straight stroke >= 40 cm is a candidate; the glyph count near the midpoint decides. They are
    # never barriers (a 99 cm or 140 cm dimension line otherwise passes as a door leaf and cuts the room), and
    # they are exported so the printed values can be placed in the plan frame (report.json dimensions[]).
    far_all = ((single > 0) & (near_wall == 0)).astype(np.uint8)
    n_g, g_lab = cv2.connectedComponents(far_all, connectivity=8)
    gs = _component_stats(g_lab, n_g)
    g_diag = np.hypot(gs["maxx"] - gs["minx"], gs["maxy"] - gs["miny"]) / px_per_cm
    glyph = (g_diag >= 1.2) & (g_diag <= 9.0) & (gs["cnt"] >= 6)
    glyph[0] = False
    gx, gy = gs["mx"][glyph], gs["my"][glyph]
    straight = (cs["elong"] <= 0.08) & (c_diag >= 40)
    straight[0] = False
    dimension_lines = []
    digits_near = np.zeros(n_c, int)
    for i in np.nonzero(straight)[0]:
        mx_, my_ = cs["mx"][i], cs["my"][i]
        d = np.hypot(gx - mx_, gy - my_) / px_per_cm
        digits_near[i] = int((d <= 35).sum())
        # endpoints along the principal axis from the bbox: the sign of the covariance picks the diagonal
        ys_, xs_ = np.nonzero(c_lab == i)
        cov = np.cov(np.stack([xs_, ys_]).astype(float)) if len(xs_) > 2 else np.eye(2)
        if cov[0, 1] >= 0:
            a_, b_ = [cs["minx"][i], cs["miny"][i]], [cs["maxx"][i], cs["maxy"][i]]
        else:
            a_, b_ = [cs["minx"][i], cs["maxy"][i]], [cs["maxx"][i], cs["miny"][i]]
        dimension_lines.append({"a_px": [float(a_[0]), float(a_[1])], "b_px": [float(b_[0]), float(b_[1])],
                                "length_cm_nominal": round(float(c_diag[i]), 1), "mid_px": [float(mx_), float(my_)],
                                "digits_near": int(digits_near[i]), "touches_wall": bool(cs["flags"]["touch"][i]),
                                "angle_deg": round(math.degrees(math.atan2(b_[1] - a_[1], b_[0] - a_[0])), 1)})
    dim_with_digits = straight & (digits_near >= 2)
    keep_c = cs["flags"]["touch"] & ~dimension_like & ~closed_like & leaf_like & ~dim_with_digits
    log.append(f"straight strokes >= 40 cm: {int(straight.sum())}; with printed digits at the midpoint: {int(dim_with_digits.sum())} (never barriers)")
    keep_c[0] = False
    keep_mask = keep_c[c_lab].astype(np.uint8)
    reconnect = (_dil(keep_mask, CUT + 1) > 0) & ((near_wall > 0) | (keep_mask > 0))
    barrier[reconnect] = 1
    barrier[_dil(keep_mask, 1) > 0] = 1
    log.append(f"single strokes {n_c - 1} components; touching {int(cs['flags']['touch'][1:].sum())}; kept {int(keep_c.sum())}; "
               f"dimension-like dropped {int((dimension_like & cs['flags']['touch'])[1:].sum())}; closed outlines dropped {int((closed_like & cs['flags']['touch'])[1:].sum())}")

    # --- far edge lines: a long NON-straight single polyline away from the walls is a slab/terrace edge
    # (the curved terrace rim, a parapet line); straight long ones are dimension lines or hatches and were
    # dropped above; short ones are text and furniture
    far = ((single > 0) & (near_wall == 0)).astype(np.uint8)
    n_far, far_lab = cv2.connectedComponents(far, connectivity=8)
    fs = _component_stats(far_lab, n_far)
    f_diag = np.hypot(fs["maxx"] - fs["minx"], fs["maxy"] - fs["miny"]) / px_per_cm
    with np.errstate(invalid="ignore", divide="ignore"):
        f_density = fs["cnt"] / np.maximum(1.0, f_diag * px_per_cm)
    edge_like = (f_diag >= o["edge_min_cm"]) & (fs["elong"] > o["straight_elong_max"]) & (f_density <= o["stroke_density_max"])
    edge_like[0] = False
    edge_px = edge_like[far_lab]
    barrier[_dil(edge_px.astype(np.uint8), 1) > 0] = 1
    log.append(f"far polylines kept as edges: {int(edge_like.sum())} ({int(edge_px.sum())} px)")

    # --- rooms = watershed basins of the free-space distance transform -------------------------------------
    # Every passage narrower than 2*core_radius (doors, including doors cut into glazing or at a wall end,
    # and the entrance door to the sheet's free area) is a saddle of the distance transform: thresholding
    # the DT separates the rooms into cores, and a watershed over -DT grows each core back to the walls.
    # The basin boundaries are the doorways. Wider openings (open plan) stay merged and are split by the
    # VLM labels below.
    n_w, w_lab, w_stats, _ = cv2.connectedComponentsWithStats(walls, connectivity=4)
    obstacle = _dil(barrier, 1)
    free = (1 - obstacle).astype(np.uint8)
    dist = cv2.distanceTransform(free, cv2.DIST_L2, 5)
    core_r = o["core_radius_cm"] * px_per_cm
    cores = (dist > core_r).astype(np.uint8)
    n_c2, c2_lab, c2_stats, _ = cv2.connectedComponentsWithStats(cores, connectivity=4)
    min_px = o["min_room_m2"] * 1e4 * px_per_cm ** 2
    markers = np.zeros((H, W), np.int32)
    # no marker on the obstacles: a marker there would flood a wide band inward from every wall; the walls
    # are instead the brightest level of the image, so basins meet at them and are masked out afterwards
    next_id = 2
    core_ids = {}
    for i in range(1, n_c2):
        if c2_stats[i, cv2.CC_STAT_AREA] < 0.3 * 1e4 * px_per_cm ** 2:
            continue
        markers[c2_lab == i] = next_id
        core_ids[next_id] = f"core-{i}"
        next_id += 1
    # a VLM label that fell outside every core (a small room full of fixtures, a shaft) seeds its own marker
    labels = labels or []
    for L in labels:
        x, y = int(round(L["xy_px"][0])), int(round(L["xy_px"][1]))
        if not (0 <= x < W and 0 <= y < H):
            continue
        if markers[y, x] == 0 and free[y, x]:
            seed = np.zeros((H, W), np.uint8)
            cv2.circle(seed, (x, y), cm2px(20), 1, -1)
            seed &= free
            markers[(seed > 0) & (markers == 0)] = next_id
            core_ids[next_id] = f"label-{L.get('name', '?')}"
            next_id += 1
    # flood from the seeds over -DT, restricted to the free space (skimage: the obstacles are simply not
    # part of the domain, so a basin can never cross a wall or a glazing line)
    from skimage.segmentation import watershed as sk_watershed

    basins = sk_watershed(-dist, markers=markers, mask=free > 0, connectivity=1).astype(np.int32)
    # seedless free space of room size (a corridor narrower than 2*core_r, a room full of fixtures)
    rest = ((basins == 0) & (free > 0)).astype(np.uint8)
    n_r, r_lab, r_stats, _ = cv2.connectedComponentsWithStats(rest, connectivity=4)
    for i in range(1, n_r):
        if r_stats[i, cv2.CC_STAT_AREA] >= min_px * 0.8:
            basins[r_lab == i] = next_id
            core_ids[next_id] = f"seedless-{i}"
            next_id += 1
    if o.get("debug"):
        cv2.imwrite(os.path.join(out_dir, "cores.png"), cores * 255)
        np.save(os.path.join(out_dir, "basins.npy"), basins)
        dbg = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        dbg[cores > 0] = (0, 200, 0)
        dbg[(basins > 0) & (cores == 0)] = (200, 120, 0)
        dbg[obstacle > 0] = (0, 0, 180)
        cv2.imwrite(os.path.join(out_dir, "basins.png"), dbg)
    border_ids = set(np.unique(np.concatenate([basins[1, :], basins[-2, :], basins[:, 1], basins[:, -2]]).tolist())) - {0}
    outside = np.isin(basins, list(border_ids)) if border_ids else np.zeros((H, W), bool)
    regions = []
    for bid, src in core_ids.items():
        if bid in border_ids:
            continue
        m = basins == bid
        area = int(m.sum())
        has_label = any(0 <= int(round(L["xy_px"][0])) < W and 0 <= int(round(L["xy_px"][1])) < H and m[int(round(L["xy_px"][1])), int(round(L["xy_px"][0]))] for L in labels)
        if area < min_px and not (has_label and area >= 0.4 * 1e4 * px_per_cm ** 2):
            continue
        regions.append({"mask": m, "src": src})
    gaps = []
    log.append(f"wall components {n_w - 1}; DT cores (r={o['core_radius_cm']} cm) {len(core_ids)}; outside basins {len(border_ids)}; rooms {len(regions)}")

    # --- labels -> regions; watershed split of merged zones -------------------------------------------------
    for L in labels:
        L["region"] = None
        x, y = int(round(L["xy_px"][0])), int(round(L["xy_px"][1]))
        if 0 <= x < W and 0 <= y < H:
            for ri, r in enumerate(regions):
                if r["mask"][y, x]:
                    L["region"] = ri
                    break
            if L["region"] is None:  # the label sits on a stroke/wall: look around within 60 cm
                rad = cm2px(60)
                best = None
                for ri, r in enumerate(regions):
                    ys, xs = np.nonzero(r["mask"][max(0, y - rad):y + rad, max(0, x - rad):x + rad])
                    if len(xs):
                        d = np.min(np.hypot(xs + max(0, x - rad) - x, ys + max(0, y - rad) - y))
                        if best is None or d < best[0]:
                            best = (d, ri)
                if best:
                    L["region"] = best[1]
                    L["snapped_px"] = float(best[0])
    split_log = []
    final = []
    for ri, r in enumerate(regions):
        mine = [L for L in labels if L["region"] == ri]
        if len(mine) <= 1:
            final.append({"mask": r["mask"], "labels": mine, "src": r["src"], "zone_of": None})
            continue
        # geodesic Voronoi: each pixel of the zone goes to the label nearest along paths inside the zone
        from skimage.graph import MCP_Geometric

        cost = np.where(r["mask"], 1.0, np.inf)
        dmaps = []
        for L in mine:
            x, y = int(round(L["xy_px"][0])), int(round(L["xy_px"][1]))
            if not r["mask"][y, x]:
                ys, xs = np.nonzero(r["mask"])
                j = np.argmin(np.hypot(xs - x, ys - y)); x, y = int(xs[j]), int(ys[j])
            mcp = MCP_Geometric(cost, fully_connected=True)
            dm, _ = mcp.find_costs([(y, x)])
            dmaps.append(dm)
        owner = np.argmin(np.stack(dmaps), axis=0)
        for k, L in enumerate(mine):
            sub = (owner == k) & r["mask"]
            if sub.sum() >= min_px * 0.3:
                final.append({"mask": sub, "labels": [L], "src": r["src"], "zone_of": ri})
        split_log.append(f"{r['src']} split into {len(mine)} zones: {[L['name'] for L in mine]}")
    log.extend(split_log)
    regions = final

    # --- room geometry --------------------------------------------------------------------------------------
    R = o["open_radius_px"]
    eps = o["simplify_cm"] * px_per_cm
    rooms = []
    for i, r in enumerate(regions):
        m8 = r["mask"].astype(np.uint8)
        op = cv2.morphologyEx(m8, cv2.MORPH_OPEN, _k(R))
        if op.sum() < min_px * 0.3:
            op = m8
        ct = _contour_of(op)
        if ct is None:
            continue
        filled = np.zeros((H, W), np.uint8)
        cv2.drawContours(filled, [ct], -1, 1, -1)
        poly = _simplify(ct, eps)
        rect = cv2.minAreaRect(ct)
        (cx, cy), (rw, rh), ang = rect
        dist = cv2.distanceTransform(filled, cv2.DIST_L2, 5)
        py, px_ = np.unravel_index(np.argmax(dist), dist.shape)
        rooms.append({
            "idx": i, "src": r["src"], "zone_of": r["zone_of"],
            "label": r["labels"][0] if r["labels"] else None,
            "area_px": float(filled.sum()), "loop_px": poly.tolist(), "vertices": int(len(poly)),
            "bbox_px": [float(poly[:, 0].min()), float(poly[:, 1].min()), float(poly[:, 0].max()), float(poly[:, 1].max())],
            "min_rect_px": {"centre": [float(cx), float(cy)], "size": [float(max(rw, rh)), float(min(rw, rh))], "angle_deg": float(ang)},
            "inner_point_px": [float(px_), float(py)], "inner_radius_px": float(dist.max()),
            "mask": filled,
        })
    for k, rm in enumerate(rooms):
        rm["id"] = f"r-{k + 1}"

    # --- openings: contacts between dilated regions --------------------------------------------------------
    D = o["door_dilate_px"]
    dil = [_dil(rm["mask"], D) > 0 for rm in rooms]
    out_dil = _dil(outside.astype(np.uint8), D) > 0
    openings = []

    def contact(maskA, maskB, ids):
        pts = np.argwhere(maskA & maskB)
        if len(pts) < 40:
            return None
        ys, xs = pts[:, 0].astype(float), pts[:, 1].astype(float)
        mx, my = xs.mean(), ys.mean()
        sxx, syy, sxy = ((xs - mx) ** 2).sum(), ((ys - my) ** 2).sum(), ((xs - mx) * (ys - my)).sum()
        ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
        ux, uy = math.cos(ang), math.sin(ang)
        t = (xs - mx) * ux + (ys - my) * uy
        a = [mx + ux * t.min(), my + uy * t.min()]; b = [mx + ux * t.max(), my + uy * t.max()]
        return {"rooms": ids, "a_px": a, "b_px": b, "centre_px": [mx, my], "angle_deg": math.degrees(ang),
                "width_px": float(t.max() - t.min()), "contact_px": int(len(pts)), "source": "contact"}

    for i in range(len(rooms)):
        for j in range(i + 1, len(rooms)):
            c = contact(dil[i], dil[j], [rooms[i]["id"], rooms[j]["id"]])
            if c:
                openings.append(c)
        c = contact(dil[i], out_dil, [rooms[i]["id"], "outside"])
        if c:
            openings.append(c)
    min_op = o["opening_min_cm"] * px_per_cm
    kept = []
    for op_ in openings:
        if op_["width_px"] < min_op:
            continue
        w_cm = op_["width_px"] / px_per_cm
        zoneA = next(rm for rm in rooms if rm["id"] == op_["rooms"][0])["zone_of"]
        zoneB = next((rm for rm in rooms if rm["id"] == op_["rooms"][1]), None)
        zoneB = zoneB["zone_of"] if zoneB else "outside"
        if zoneA is not None and zoneA == zoneB:
            op_["kind"] = "opening"; op_["virtual"] = True  # a label-watershed boundary between open-plan zones
        elif "outside" in op_["rooms"]:
            if 70 <= w_cm <= 140:
                op_["kind"] = "entrance_door"
            else:
                continue  # a terrace edge against the sheet's free area: a passage, not a door
        else:
            op_["kind"] = "door" if w_cm <= 115 else "opening"
        kept.append(op_)
    for k, op_ in enumerate(kept):
        op_["id"] = f"o-{k + 1}"
    openings = kept
    log.append(f"openings kept {len(openings)}: {sum(1 for x in openings if x['kind'] == 'door')} doors, {sum(1 for x in openings if x['kind'] == 'entrance_door')} entrance, {sum(1 for x in openings if x['kind'] == 'opening')} openings")

    # --- walls as polygons ----------------------------------------------------------------------------------
    wall_polys = []
    for i in range(1, n_w):
        if w_stats[i, cv2.CC_STAT_AREA] < o["wall_min_px"]:
            continue
        m = (w_lab == i).astype(np.uint8)
        ct = _contour_of(m)
        poly = _simplify(ct, eps * 0.7)
        if len(poly) >= 3:
            halo = _dil(m, 6) > 0
            wall_polys.append({"polygon_px": poly.tolist(), "area_px": float(w_stats[i, cv2.CC_STAT_AREA]),
                               "touches_outside": bool((halo & outside).any())})
    wall_polys.sort(key=lambda w: -w["area_px"])
    for k, w in enumerate(wall_polys):
        w["id"] = f"w-{k + 1}"

    # --- panes from the glazing components ------------------------------------------------------------------
    indoor_near = np.zeros((H, W), bool)
    outdoor_near = np.zeros((H, W), bool)
    for rm in rooms:
        lab = rm["label"] or {}
        tgt = outdoor_near if lab.get("is_outdoor") else indoor_near
        tgt |= _dil(rm["mask"], 12) > 0
    gl8 = glazing_px.astype(np.uint8)
    n_g, g_lab, g_stats, _ = cv2.connectedComponentsWithStats(gl8, connectivity=8)
    panes = []
    for i in range(1, n_g):
        x, y, w, h, a = g_stats[i]
        if math.hypot(w, h) / px_per_cm < 60:
            continue
        m = (g_lab == i)
        if not (indoor_near[m].any() or outdoor_near[m].any() or (_dil(m.astype(np.uint8), 8) & outside.astype(np.uint8)).any()):
            continue
        kind = "facade" if indoor_near[m].any() else "railing"
        ct = _contour_of(cv2.dilate(m.astype(np.uint8), _k(1)))
        poly = _simplify(ct, eps * 0.5)
        panes.append({"kind": kind, "polygon_px": poly.tolist(), "diag_cm": round(math.hypot(w, h) / px_per_cm, 1)})
    for k, p in enumerate(panes):
        p["id"] = f"{p['kind']}-{k + 1}"
    log.append(f"panes {len(panes)} ({sum(1 for p in panes if p['kind'] == 'facade')} facade, {sum(1 for p in panes if p['kind'] == 'railing')} railing)")

    # --- debug images ---------------------------------------------------------------------------------------
    cv2.imwrite(os.path.join(out_dir, "walls.png"), walls * 255)
    cv2.imwrite(os.path.join(out_dir, "barrier.png"), barrier * 255)
    overlay = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    rng = np.random.RandomState(7)
    for rm in rooms:
        col = tuple(int(c) for c in rng.randint(60, 255, 3))
        tint = overlay.copy()
        tint[rm["mask"] > 0] = col
        overlay = cv2.addWeighted(overlay, 0.6, tint, 0.4, 0)
        poly = np.array(rm["loop_px"], np.int32).reshape(-1, 1, 2)
        cv2.polylines(overlay, [poly], True, (0, 0, 255), 3)
        name = (rm["label"] or {}).get("name_en") or ""
        txt = f"{rm['id']} {name}".strip()
        (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 1.6, 4)
        cx, cy = int(rm["inner_point_px"][0]), int(rm["inner_point_px"][1])
        cv2.rectangle(overlay, (cx - tw // 2 - 8, cy - th - 8), (cx + tw // 2 + 8, cy + 10), (255, 255, 255), -1)
        cv2.putText(overlay, txt, (cx - tw // 2, cy), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 0, 0), 4)
    for op_ in openings:
        a, b = op_["a_px"], op_["b_px"]
        cv2.line(overlay, (int(a[0]), int(a[1])), (int(b[0]), int(b[1])), (255, 0, 0), 6)
    for p in panes:
        cv2.polylines(overlay, [np.array(p["polygon_px"], np.int32).reshape(-1, 1, 2)], True, (0, 160, 0), 2)
    for L in labels:
        cv2.circle(overlay, (int(L["xy_px"][0]), int(L["xy_px"][1])), 14, (255, 0, 255), -1)
    cv2.imwrite(os.path.join(out_dir, "overlay.png"), overlay)

    result = {
        "crop": os.path.abspath(crop_png), "size_px": [W, H], "px_per_cm_nominal": px_per_cm, "options": o, "log": log,
        "rooms": [{k: v for k, v in rm.items() if k != "mask"} for rm in rooms],
        "openings": openings, "walls": wall_polys, "panes": panes, "dimension_lines": dimension_lines,
        "labels": [{k: v for k, v in L.items()} for L in labels],
    }
    with open(os.path.join(out_dir, "trace.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    return result


if __name__ == "__main__":
    import sys

    crop, ppc, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    labels = None
    if len(sys.argv) > 4:
        with open(sys.argv[4], encoding="utf-8") as f:
            labels = json.load(f)
    r = trace(crop, ppc, out, labels)
    print("\n".join(r["log"]))
    for rm in r["rooms"]:
        print(rm["id"], (rm["label"] or {}).get("name_en"), round(rm["area_px"] / (ppc ** 2) / 1e4, 2), "m2", [round(s / ppc) for s in rm["min_rect_px"]["size"]], "cm")

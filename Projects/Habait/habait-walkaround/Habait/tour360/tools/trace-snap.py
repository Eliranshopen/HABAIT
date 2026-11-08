#!/usr/bin/env python
"""trace-snap.py (2026-11-05, fix-846-fidelity; parity: the portal's auto-trace runs the same step) — put a traced plan onto its drawing.

Two measured faults of a flood-fill trace, fixed in place:
  1. SNAP — the room loops stop short of the wall fill (on apt846 a median 2.7-4.7 cm inside every wall), and the CG builds its wall
     faces from the loops, so every room comes out a few cm small. Each loop vertex on a non-open edge is moved onto the nearest wall /
     pane polygon edge (INSET_CM inside the face) when it lies within SNAP_CM of it. 'line' edges (a door leaf, a glazing stroke) are
     snapped only onto panes; vertices farther than SNAP_CM are left alone (a door leaf in front of a wall is not a wall face).
  2. SCALE — the cm values of every geometry field are rescaled from the scale the trace assumed (plan_meta.scale_px_per_cm) to the
     sheet's true scale: dpi / 2.54 / drawing_scale (plan_meta.source_dpi and plan_meta.drawing_scale, e.g. 288 and 50 → 2.2677
     px/cm). The raster is untouched; only the cm values move. Check it first with tools/dimline-reader.py: the printed dimension
     lines must read drawn/printed ≈ 1.000 at the true scale.
  0. DESPIKE (2026-11-05, the dims-gate audit) — a flood-fill loop can fold back on itself: a slit 10-260 cm long and ~2 cm wide
     reaching into the room (apt846: 14 of them, at door chords and wall steps). A slit cuts the floor/ceiling slab the CG builds from
     the loop and truncates any measurement across it. A vertex is a slit tip when the loop turns back through < SPIKE_DEG there
     AND the tip lies inside the loop without it (a real acute corner points outward); it is removed (repeatedly, until none is
     left), and the two edges merge (kind: wall > line > open). Vertices closer than 0.5 cm to their predecessor are merged too.
Writes the plan in place (a .bak beside it) and prints the before/after loop-to-wall distances.
usage: python -I trace-snap.py <plan.json> [--spike-deg 30] [--no-corners] [--snap-cm 9] [--inset-cm 0.5] [--no-rescale] [--dpi 288 --scale 50] [--go]
       (without --go: a dry run that only prints what would move)
"""
import json
import math
import shutil
import sys


def area(L):
    return abs(sum(L[i][0] * L[(i + 1) % len(L)][1] - L[(i + 1) % len(L)][0] * L[i][1] for i in range(len(L)))) / 2


def proj(pt, a, b):
    ax, ay = a; bx, by = b; px, py = pt; dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
    cx, cy = ax + t * dx, ay + t * dy
    return (cx, cy), math.hypot(px - cx, py - cy)


def segs_of(polys):
    return [(P[i], P[(i + 1) % len(P)]) for P in polys for i in range(len(P))]


def inside(pt, P):
    x, y = pt
    ins = False
    for i in range(len(P)):
        x1, y1 = P[i]; x2, y2 = P[(i + 1) % len(P)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            ins = not ins
    return ins


RANK = {"wall": 2, "line": 1, "open": 0}


def despike(L, K, spike_deg):
    """remove slit tips (see 0. DESPIKE); returns (loop, kinds, removed[(x, y, deg)])"""
    L, K, removed = [list(v) for v in L], list(K), []
    changed = True
    while changed and len(L) > 3:
        changed = False
        n = len(L)
        for i in range(n):
            a, b, c = L[i - 1], L[i], L[(i + 1) % n]
            l1, l2 = math.hypot(a[0] - b[0], a[1] - b[1]), math.hypot(c[0] - b[0], c[1] - b[1])
            if l1 < 0.5:
                tip, deg = True, None
            elif l2 < 1e-9:
                continue
            else:
                cos = ((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) / l1 / l2
                deg = math.degrees(math.acos(max(-1.0, min(1.0, cos))))
                tip = deg < spike_deg and inside(b, [q for j, q in enumerate(L) if j != i])
            if tip:
                k_prev, k_here = K[(i - 1) % n], K[i]
                merged = k_prev if RANK.get(k_prev, 0) >= RANK.get(k_here, 0) else k_here
                del L[i]; del K[i]
                K[(i - 1) % len(K)] = merged
                removed.append((round(b[0], 1), round(b[1], 1), None if deg is None else round(deg, 1)))
                changed = True
                break
    # a small BOW-TIE (two edges two or three apart crossing: apt846 terrace-living, edges 46 and 48): the little loop between them
    # is cut off at the crossing point
    changed = True
    while changed and len(L) > 4:
        changed = False
        n = len(L)
        for j in range(n):
            for gap in (2, 3):
                if j + gap + 1 >= n:
                    continue                                                  # (no wrap-around: rotate the loop if one ever needs it)
                k = j + gap
                p1, p2, q1, q2 = L[j], L[(j + 1) % n], L[k], L[(k + 1) % n]
                d1 = (p2[0] - p1[0], p2[1] - p1[1]); d2 = (q2[0] - q1[0], q2[1] - q1[1])
                den = d1[0] * d2[1] - d1[1] * d2[0]
                if abs(den) < 1e-9:
                    continue
                t = ((q1[0] - p1[0]) * d2[1] - (q1[1] - p1[1]) * d2[0]) / den
                s = ((q1[0] - p1[0]) * d1[1] - (q1[1] - p1[1]) * d1[0]) / den
                if 1e-6 < t < 1 - 1e-6 and 1e-6 < s < 1 - 1e-6:
                    x = [round(p1[0] + d1[0] * t, 2), round(p1[1] + d1[1] * t, 2)]
                    kk = K[k]
                    for m in range(j + gap, j, -1):                           # the vertices of the little loop
                        removed.append((round(L[m][0], 1), round(L[m][1], 1), None))
                        del L[m]; del K[m]
                    L.insert(j + 1, x); K.insert(j + 1, kk)
                    changed = True
                    break
            if changed:
                break
    return L, K, removed


def square_corners(L, K, wsegs, walls_union, inset_cm, off_cm=2.0, reach_cm=30.0):
    """1b. CORNERS (2026-11-05, the dims-gate audit) — a flood-fill loop can cut a room corner: one vertex sitting off every drawn
    face (apt846 bath-main: 11 cm inside its south-west corner) between two 'wall' edges whose far ends do sit on faces. The CG builds
    its facing (the visible wall surface) on the loop edges, so the cut shows as a slanted wall (the 210 at the shower read 199.6 cm).
    Such a vertex moves to the intersection of the two faces its neighbours stand on (inset_cm inside), when that point lies within
    reach_cm, outside every wall, and on both faces. A vertex next to an 'open' or 'line' edge is left alone (a door or glazing jamb).
    Returns (loop, n_moved)."""
    from shapely.geometry import Point
    n = len(L)
    out = [list(v) for v in L]
    moved = 0

    def face_line(p):
        best = min(wsegs, key=lambda s: proj(p, *s)[1])
        return best, proj(p, *best)[1]

    for i in range(n):
        if K[(i - 1) % n] != "wall" or K[i] != "wall":
            continue
        u, v, w = out[(i - 1) % n], out[i], out[(i + 1) % n]
        if face_line(v)[1] <= inset_cm + off_cm:
            continue
        (su, du), (sw, dw) = face_line(u), face_line(w)
        if du > inset_cm + 1.0 or dw > inset_cm + 1.0:
            continue
        (a1, b1), (a2, b2) = su, sw
        d1 = (b1[0] - a1[0], b1[1] - a1[1]); d2 = (b2[0] - a2[0], b2[1] - a2[1])
        l1, l2 = math.hypot(*d1), math.hypot(*d2)
        if l1 < 1e-6 or l2 < 1e-6:
            continue
        sin = abs(d1[0] * d2[1] - d1[1] * d2[0]) / l1 / l2
        if sin < math.sin(math.radians(20)):
            continue
        den = d1[0] * d2[1] - d1[1] * d2[0]
        t = ((a2[0] - a1[0]) * d2[1] - (a2[1] - a1[1]) * d2[0]) / den
        c = (a1[0] + d1[0] * t, a1[1] + d1[1] * t)
        # inset: toward the vertex being replaced (the room side of the corner)
        dv = math.hypot(v[0] - c[0], v[1] - c[1])
        if dv > reach_cm or dv < 1e-6:
            continue
        c_in = [round(c[0] + (v[0] - c[0]) / dv * inset_cm * math.sqrt(2), 2), round(c[1] + (v[1] - c[1]) / dv * inset_cm * math.sqrt(2), 2)]
        if walls_union.contains(Point(c_in)):
            continue
        out[i] = c_in
        moved += 1
    # rule 3 — a SHORT corner: a vertex on a face but a few cm short of that face's end, so its other edge cuts across to the next face
    # (apt846 bath-main south-east: 6.5 cm short). Candidates = the ends of the face segments within 12 cm (inset inside); the vertex
    # takes the candidate that best fits both its edges to the drawn faces (max sampled distance), when that improves the fit by > 1 cm.
    def fit(p0, p1):
        return max(face_line((p0[0] + (p1[0] - p0[0]) * t / 10, p0[1] + (p1[1] - p0[1]) * t / 10))[1] for t in range(11))
    for i in range(n):
        if K[(i - 1) % n] != "wall" or K[i] != "wall":
            continue
        u, v, w = out[(i - 1) % n], out[i], out[(i + 1) % n]
        now = max(fit(u, v), fit(v, w))
        best = None
        for s in wsegs:
            for e in s:
                d = math.hypot(e[0] - v[0], e[1] - v[1])
                if d > 12.0 or d < 1e-6:
                    continue
                c = [e[0] + (v[0] - e[0]) / d * inset_cm * math.sqrt(2), e[1] + (v[1] - e[1]) / d * inset_cm * math.sqrt(2)]
                if walls_union.contains(Point(c)):
                    continue
                score = max(fit(u, c), fit(c, w))
                if best is None or score < best[0]:
                    best = (score, c)
        if best and best[0] < now - 1.0:
            out[i] = [round(best[1][0], 2), round(best[1][1], 2)]
            moved += 1
    # rule 2 — a MISSING corner: a 'wall' edge whose two ends sit on two different, non-parallel faces while its middle is off both
    # (apt846 bath-main: the south-east corner cut 9 cm across): the faces' intersection is inserted between them.
    res, i = [], 0
    n = len(out)
    newK = []
    for i in range(n):
        a, b = out[i], out[(i + 1) % n]
        res.append(a); newK.append(K[i])
        if K[i] != "wall":
            continue
        m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        if face_line(m)[1] <= inset_cm + off_cm:
            continue
        (sa, da), (sb, db) = face_line(a), face_line(b)
        if da > inset_cm + 1.0 or db > inset_cm + 1.0:
            continue
        (a1, b1), (a2, b2) = sa, sb
        d1 = (b1[0] - a1[0], b1[1] - a1[1]); d2 = (b2[0] - a2[0], b2[1] - a2[1])
        l1, l2 = math.hypot(*d1), math.hypot(*d2)
        if l1 < 1e-6 or l2 < 1e-6 or abs(d1[0] * d2[1] - d1[1] * d2[0]) / l1 / l2 < math.sin(math.radians(20)):
            continue
        den = d1[0] * d2[1] - d1[1] * d2[0]
        t = ((a2[0] - a1[0]) * d2[1] - (a2[1] - a1[1]) * d2[0]) / den
        c = (a1[0] + d1[0] * t, a1[1] + d1[1] * t)
        dm = math.hypot(m[0] - c[0], m[1] - c[1])
        if dm > reach_cm or dm < 1e-6:
            continue
        c_in = [round(c[0] + (m[0] - c[0]) / dm * inset_cm * math.sqrt(2), 2), round(c[1] + (m[1] - c[1]) / dm * inset_cm * math.sqrt(2), 2)]
        if walls_union.contains(Point(c_in)):
            continue
        res.append(c_in); newK.append("wall")
        moved += 1
    K[:] = newK
    return res, moved


def offset_wall_edges(L, K, extra_cm):
    """5. FACE BIAS — the printed dimensions are drawn to the CENTRE of a wall's outline stroke (apt846: the tick sits mid-stroke, the
    grey fill — the traced wall polygon — begins 1.1-2.4 cm beyond it), so loops snapped onto the traced faces come out a little large.
    Every 'wall' edge moves inward by extra_cm (open / line edges stay: a door chord or a glazing line is where it is drawn); each
    vertex becomes the intersection of its two offset edges. extra_cm = the median outward offset of the room-dimension ends
    (printed_dimensions.py --face-bias), so it is measured on the sheet, never assumed."""
    n = len(L)
    def inside_pt(pt):
        return inside(pt, L)
    i0 = max(range(n), key=lambda i: math.hypot(L[(i + 1) % n][0] - L[i][0], L[(i + 1) % n][1] - L[i][1]))
    a, b = L[i0], L[(i0 + 1) % n]
    ln = math.hypot(b[0] - a[0], b[1] - a[1])
    sgn = 1.0 if inside_pt(((a[0] + b[0]) / 2 - (b[1] - a[1]) / ln * 0.5, (a[1] + b[1]) / 2 + (b[0] - a[0]) / ln * 0.5)) else -1.0
    lines = []
    for i in range(n):
        a, b = L[i], L[(i + 1) % n]
        ln = math.hypot(b[0] - a[0], b[1] - a[1]) or 1e-9
        nx, ny = sgn * -(b[1] - a[1]) / ln, sgn * (b[0] - a[0]) / ln
        o = extra_cm if K[i] == "wall" else 0.0
        lines.append(((a[0] + nx * o, a[1] + ny * o), (b[0] + nx * o, b[1] + ny * o), o, (nx, ny)))
    out = []
    for i in range(n):
        p1, p2, o1, n1 = lines[i - 1]
        q1, q2, o2, n2 = lines[i]
        d1 = (p2[0] - p1[0], p2[1] - p1[1]); d2 = (q2[0] - q1[0], q2[1] - q1[1])
        den = d1[0] * d2[1] - d1[1] * d2[0]
        l1, l2 = math.hypot(*d1) or 1e-9, math.hypot(*d2) or 1e-9
        if abs(den) / l1 / l2 < 0.05:                     # (nearly) collinear neighbours: move along the larger offset's normal
            o, nn = (o1, n1) if abs(o1) >= abs(o2) else (o2, n2)
            out.append([round(L[i][0] + nn[0] * o, 2), round(L[i][1] + nn[1] * o, 2)])
            continue
        t = ((q1[0] - p1[0]) * d2[1] - (q1[1] - p1[1]) * d2[0]) / den
        x = (p1[0] + d1[0] * t, p1[1] + d1[1] * t)
        if math.hypot(x[0] - L[i][0], x[1] - L[i][1]) > 4 * max(extra_cm, 0.5):   # a sharp corner would fly off: keep it local
            o, nn = (o1, n1) if abs(o1) >= abs(o2) else (o2, n2)
            x = (L[i][0] + nn[0] * o, L[i][1] + nn[1] * o)
        out.append([round(x[0], 2), round(x[1], 2)])
    return out


def median_wall_gap(p):
    wsegs = segs_of([w["polygon_cm"] for w in p["walls"]])
    d = []
    for r in p["rooms"]:
        L, K = r["loop"], r.get("edge_kinds") or []
        for i in range(len(L)):
            if i < len(K) and K[i] == "wall":
                a, b = L[i], L[(i + 1) % len(L)]
                m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                d.append(min(proj(m, *s)[1] for s in wsegs))
    d.sort()
    return d[len(d) // 2] if d else None


def main():
    args = sys.argv[1:]
    f = args[0]
    opt = lambda k, dflt: float(args[args.index(k) + 1]) if k in args else dflt
    SNAP, INSET = opt("--snap-cm", 9.0), opt("--inset-cm", 0.5)
    go = "--go" in args
    p = json.load(open(f, encoding="utf-8"))
    pm = p.setdefault("plan_meta", {})
    B0 = float(pm.get("face_bias_cm") or 0.0)      # a re-run keeps the bias already applied: the faces sit INSET + B0 inside
    INSET_EFF = INSET + B0
    before = median_wall_gap(p)
    wsegs = segs_of([w["polygon_cm"] for w in p["walls"]])
    psegs = segs_of([q["polygon_cm"] for q in p["panes"]])
    SPIKE = opt("--spike-deg", 30.0)
    for r in p["rooms"]:
        K0 = r.get("edge_kinds") or ["wall"] * len(r["loop"])
        L2, K2, gone = despike(r["loop"], K0, SPIKE)
        if gone:
            print(f"  despike {r['id']}: {len(gone)} slit tip(s) removed " + ", ".join(f"({x}, {y}){'' if d is None else ' ' + str(d) + ' deg'}" for x, y, d in gone))
            r["loop"] = L2
            if r.get("edge_kinds"):
                r["edge_kinds"] = K2
    moved, dist = 0, []
    for r in p["rooms"]:
        L, K = r["loop"], r.get("edge_kinds") or ["wall"] * len(r["loop"])
        n = len(L)
        out = [list(v) for v in L]
        for i in range(n):
            kinds = {K[i], K[(i - 1) % n]}
            if kinds == {"open"}:
                continue
            pool = (wsegs + psegs) if "wall" in kinds else psegs   # a 'line' vertex snaps onto glass only
            best = None
            for a, b in pool:
                q, d = proj(L[i], a, b)
                if best is None or d < best[1]:
                    best = (q, d)
            if best and abs(best[1] - INSET_EFF) > 0.1 and INSET + 0.1 < best[1] <= SNAP and B0 == 0.0:   # a vertex already on its face (at the inset) is left alone: re-runs move nothing
                (qx, qy), d = best
                vx, vy = L[i][0] - qx, L[i][1] - qy
                out[i] = [round(qx + vx / d * INSET, 2), round(qy + vy / d * INSET, 2)]
                moved += 1
                dist.append(d)
        r["loop"] = out
    if "--no-corners" not in args:
        from shapely.geometry import Polygon
        from shapely.ops import unary_union
        WU = unary_union([Polygon(w["polygon_cm"]).buffer(0) for w in p["walls"]] + [Polygon(q["polygon_cm"]).buffer(0) for q in p["panes"]])
        for r in p["rooms"]:
            if not r.get("edge_kinds"):
                continue
            L2, nch = square_corners(r["loop"], r["edge_kinds"], wsegs + psegs, WU, INSET_EFF)
            if nch:
                print(f"  corners {r['id']}: {nch} cut corner(s) squared onto the drawn faces")
                r["loop"] = L2
    BIAS = opt("--face-bias-cm", B0)
    if abs(BIAS - B0) > 1e-6:
        for r in p["rooms"]:
            if r.get("edge_kinds"):
                r["loop"] = offset_wall_edges(r["loop"], r["edge_kinds"], BIAS - B0)
        pm["face_bias_cm"] = BIAS
        print(f"  face bias: every room's wall edges moved {BIAS - B0:+.2f} cm inward (total {BIAS} cm) onto the drawn line centres")
    k = 1.0
    if "--no-rescale" not in args:
        dpi, dscale = opt("--dpi", pm.get("source_dpi") or 0), opt("--scale", pm.get("drawing_scale") or 0)
        old = float(pm.get("scale_px_per_cm") or 0)
        if dpi and dscale and old:
            true = dpi / 2.54 / dscale
            k = old / true
            pm["scale_px_per_cm"] = round(true, 4)
    if k != 1.0:
        sc = lambda v: [round(v[0] * k, 2), round(v[1] * k, 2)]
        for r in p["rooms"]:
            r["loop"] = [sc(v) for v in r["loop"]]
        for w in p["walls"]:
            w["polygon_cm"] = [sc(v) for v in w["polygon_cm"]]
            if "area_cm2" in w: w["area_cm2"] = round(area(w["polygon_cm"]), 1)
        for q in p["panes"]:
            q["polygon_cm"] = [sc(v) for v in q["polygon_cm"]]
        for o in p.get("openings", []):
            for key in ("a_cm", "b_cm", "centre_cm"):
                if o.get(key): o[key] = sc(o[key])
            if o.get("width_cm"): o["width_cm"] = round(o["width_cm"] * k, 1)
        for c in p.get("camera_points", []):
            c["x"], c["y"] = round(c["x"] * k, 1), round(c["y"] * k, 1)
        for x in p.get("fixtures", []):
            if x.get("polygon_cm"): x["polygon_cm"] = [sc(v) for v in x["polygon_cm"]]
            if x.get("centre_cm"): x["centre_cm"] = sc(x["centre_cm"])
        for h in ((p.get("furnishing") or {}).get("fixture_hints") or {}).values():
            for key in ("sink_at_cm", "hob_at_cm"):
                if h.get(key): h[key] = sc(h[key])
        for piece in (p.get("furnishing") or {}).get("pieces") or []:
            if piece.get("centre_cm"): piece["centre_cm"] = sc(piece["centre_cm"])
    for r in p["rooms"]:
        r["area_m2"] = round(area(r["loop"]) / 1e4, 3)
        xs = [v[0] for v in r["loop"]]; ys = [v[1] for v in r["loop"]]
        r["bbox_cm"] = [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)]
        r["clear_dims_cm"] = [round(r["bbox_cm"][2] - r["bbox_cm"][0], 1), round(r["bbox_cm"][3] - r["bbox_cm"][1], 1)]
    after = median_wall_gap(p)
    med = sorted(dist)[len(dist) // 2] if dist else 0
    print(f"{f}: {moved} loop vertices snapped (median move {med:.1f} cm); scale x{k:.5f}; wall edges to wall faces: median {before} -> {after} cm")
    if go:
        shutil.copy2(f, f + ".bak")
        json.dump(p, open(f, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
        print("written (backup .bak)")
    else:
        print("dry run: nothing written (--go to write)")


if __name__ == "__main__":
    main()

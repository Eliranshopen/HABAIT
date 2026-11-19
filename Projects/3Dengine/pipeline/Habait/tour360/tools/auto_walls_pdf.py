#!/usr/bin/env python
"""auto_walls_pdf.py <plan.pdf> <page 1-based> <raster.json> <dpi> <out-dir>

The VECTOR leg of auto-trace (2026-11-05). A CAD-exported sales plan keeps its layers in the PDF (846: 01wall beton_m,
H-CONC-1, W-CONC-1/2, W-BLOCK-1, S-COLS, O-WIN, 05door_m, 24dimension_m, P-PLUMBING — found with the opentakeoff MCP's layer
census and read here with pymupdf). The walls, windows and doors are then exact, not a colour guess on a raster:
  plan-grey.png   white; wall fills + columns + window bars = grey 110 (what trace-plan.mjs and auto_rooms.py read as wall);
                  door leaves and arcs = black (trace-plan's barriers; auto_doors' arcs)
  walls-only.png  the wall mask alone (255)
  glazing.json    window bars (the auto_prep schema), strokes.png (doors), pdf-vectors.json (dimension-line segments, plumbing
                  clusters, the layer census), all in CROP px (sheet px at <dpi> minus crop_box_px from raster.json)
Exit 2 when the page has no wall layers (auto-trace keeps the raster prep).
"""
import json
import math
import os
import re
import sys

import cv2
import numpy as np
import pymupdf

WALL_FILL = re.compile(r"H-CONC|S-COLS|W-CONC|W-BLOCK|wall|beton|conc", re.I)
WALL_STROKE = re.compile(r"W-CONC|W-BLOCK|wall beton|^01wall", re.I)
WINDOW = re.compile(r"O-WIN|window|halon", re.I)
DOOR = re.compile(r"door|delet|^05door", re.I)
DIM = re.compile(r"dimension|^24dim|^25dim|dim ", re.I)
PLUMB = re.compile(r"PLUMB|sanit|P-PLUM", re.I)
HATCH = re.compile(r"hatch", re.I)
GLAZING_PEN = re.compile(r"(^|\|)V40(-\d+)?$")   # (round 17) the cut glazing drawn by pen weight (846: the curved glass wall and the side
                                                 # windows are V40 / V40-1, not O-WIN): the facade's glass line where no window layer is


def bezier(b0, b1, b2, b3, t):
    xx = (1 - t) ** 3 * b0[0] + 3 * (1 - t) ** 2 * t * b1[0] + 3 * (1 - t) * t ** 2 * b2[0] + t ** 3 * b3[0]
    yy = (1 - t) ** 3 * b0[1] + 3 * (1 - t) ** 2 * t * b1[1] + 3 * (1 - t) * t ** 2 * b2[1] + t ** 3 * b3[1]
    return (xx, yy)


def main():
    pdf, page_no, raster_p, dpi, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], float(sys.argv[4]), sys.argv[5]
    rj = json.load(open(raster_p, encoding="utf-8"))
    x0, y0, x1, y1 = rj["crop"]["crop_box_px"]
    W, H = x1 - x0, y1 - y0
    k = dpi / 72.0
    d = pymupdf.open(pdf)
    p = d[page_no - 1]
    dr = p.get_drawings(extended=True)
    census = {}
    for x in dr:
        name = x.get("layer") or "(none)"
        census[name] = census.get(name, 0) + 1
    tp = lambda pt: (float(pt.x) * k - x0, float(pt.y) * k - y0)

    def path_polys(x):
        polys, cur = [], []
        for it in x["items"]:
            kind = it[0]
            if kind == "l":
                a, b = tp(it[1]), tp(it[2])
                if cur and (abs(cur[-1][0] - a[0]) > 0.5 or abs(cur[-1][1] - a[1]) > 0.5):
                    polys.append(cur); cur = []
                if not cur:
                    cur.append(a)
                cur.append(b)
            elif kind == "c":
                pts = [tp(v) for v in it[1:5]]
                if cur and (abs(cur[-1][0] - pts[0][0]) > 0.5 or abs(cur[-1][1] - pts[0][1]) > 0.5):
                    polys.append(cur); cur = []
                if not cur:
                    cur.append(pts[0])
                for t in np.linspace(0.1, 1, 10):
                    cur.append(bezier(pts[0], pts[1], pts[2], pts[3], t))
            elif kind == "re":
                r = it[1]
                if cur:
                    polys.append(cur); cur = []
                polys.append([tp(pymupdf.Point(r.x0, r.y0)), tp(pymupdf.Point(r.x1, r.y0)), tp(pymupdf.Point(r.x1, r.y1)), tp(pymupdf.Point(r.x0, r.y1))])
            elif kind == "qu":
                q = it[1]
                if cur:
                    polys.append(cur); cur = []
                polys.append([tp(q.ul), tp(q.ur), tp(q.lr), tp(q.ll)])
        if cur:
            polys.append(cur)
        return polys

    wall = np.zeros((H, W), np.uint8)
    win = np.zeros((H, W), np.uint8)
    gpen = np.zeros((H, W), np.uint8)
    glass = np.zeros((H, W), np.uint8)
    door = np.zeros((H, W), np.uint8)
    dims, plumb = [], []
    n_wall_fill = n_wall_stroke = n_win = n_door = 0
    for x in dr:
        L = x.get("layer") or ""
        if HATCH.search(L) and not WALL_FILL.search(L):
            continue
        polys = path_polys(x)
        if not polys:
            continue
        filled = x.get("fill") is not None and x.get("type") in ("f", "fs")
        if WALL_FILL.search(L) and filled:
            for poly in polys:
                if len(poly) >= 3:
                    cv2.fillPoly(wall, [np.round(np.array(poly)).astype(np.int32)], 255)
            n_wall_fill += 1
        elif WALL_STROKE.search(L) and not filled:
            w_px = max(1, int(round((x.get("width") or 0.5) * k)))
            for poly in polys:
                cv2.polylines(wall, [np.round(np.array(poly)).astype(np.int32)], False, 255, w_px)
            n_wall_stroke += 1
        elif GLAZING_PEN.search(L):
            for poly in polys:
                cv2.polylines(gpen, [np.round(np.array(poly)).astype(np.int32)], False, 255, max(2, int(round(0.72 * k))))
        elif WINDOW.search(L):
            if re.search(r"(^|\|)O-WIN(-\d+)?$", L):    # (round 18) the glass line itself (not the panel frames): the facade's line
                for poly in polys:
                    cv2.polylines(glass, [np.round(np.array(poly)).astype(np.int32)], False, 255, 2)
            for poly in polys:
                if len(poly) >= 3:
                    cv2.fillPoly(win, [np.round(np.array(poly)).astype(np.int32)], 255)
                else:
                    cv2.polylines(win, [np.round(np.array(poly)).astype(np.int32)], False, 255, max(2, int(round(0.72 * k))))
            n_win += 1
        elif DOOR.search(L):
            for poly in polys:
                cv2.polylines(door, [np.round(np.array(poly)).astype(np.int32)], False, 255, 2)
            n_door += 1
        elif DIM.search(L):
            for poly in polys:
                for i in range(len(poly) - 1):
                    (ax, ay), (bx, by) = poly[i], poly[i + 1]
                    dims.append([round(ax, 1), round(ay, 1), round(bx, 1), round(by, 1)])
        elif PLUMB.search(L):
            r = x["rect"]
            plumb.append([round(r.x0 * k - x0, 1), round(r.y0 * k - y0, 1), round(r.x1 * k - x0, 1), round(r.y1 * k - y0, 1)])
    plumb_polys = []
    for x in dr:
        if PLUMB.search(x.get("layer") or ""):
            for poly in path_polys(x):
                if len(poly) >= 2:
                    plumb_polys.append([[round(px_, 1), round(py_, 1)] for px_, py_ in poly])
    # (round 19) the beam strip: a projection edge drawn on the V25 pen (846: the decorative beam's outer edge) that runs
    #    parallel to an O-WIN glass line within 80 cm; the strip is the quadrilateral between the two over their common span
    def _segs(rx):
        out_ = []
        for x in dr:
            if "items" not in x or not re.search(rx, x.get("layer") or ""):
                continue
            for it in x["items"]:
                if it[0] == "l":
                    a_, b_ = tp(it[1]), tp(it[2])
                    if math.hypot(b_[0] - a_[0], b_[1] - a_[1]) >= 60 * 2.2677 * (dpi / 288.0) * 0.5:
                        out_.append((a_, b_))
        return out_
    beam = np.zeros((H, W), np.uint8)
    v25 = _segs(r"(^|\|)V25$"); glass_s = _segs(r"O-WIN")      # any window line; the NEAREST parallel one bounds the strip
    n_beam = 0
    for (pa, pb) in v25:
        L_ = math.hypot(pb[0] - pa[0], pb[1] - pa[1]); ux_, uy_ = (pb[0] - pa[0]) / L_, (pb[1] - pa[1]) / L_; nx_, ny_ = -uy_, ux_
        def _off(q):
            return (q[0][0] - pa[0]) * nx_ + (q[0][1] - pa[1]) * ny_
        glass_s.sort(key=lambda q: abs(_off(q)))      # nearest first: the strip ends at the first glass line inward
        used_span = []
        for (qa, qb) in glass_s:
            Lq = math.hypot(qb[0] - qa[0], qb[1] - qa[1])
            if abs(((qb[0] - qa[0]) / Lq) * nx_ + ((qb[1] - qa[1]) / Lq) * ny_) > math.sin(math.radians(3)):
                continue                            # not parallel
            off = (qa[0] - pa[0]) * nx_ + (qa[1] - pa[1]) * ny_
            if not (5 * 2.2677 <= abs(off) <= 80 * 2.2677 * (dpi / 288.0)):
                continue
            t0 = sorted([(qa[0] - pa[0]) * ux_ + (qa[1] - pa[1]) * uy_, (qb[0] - pa[0]) * ux_ + (qb[1] - pa[1]) * uy_])
            lo_, hi_ = max(0.0, t0[0]), min(L_, t0[1])
            if hi_ - lo_ < 30 or any(lo_ < u1 - 5 and hi_ > u0 + 5 for (u0, u1) in used_span):
                continue                                # this span already ends at a nearer glass line
            used_span.append((lo_, hi_))
            quad = [(pa[0] + ux_ * lo_, pa[1] + uy_ * lo_), (pa[0] + ux_ * hi_, pa[1] + uy_ * hi_),
                    (pa[0] + ux_ * hi_ + nx_ * off, pa[1] + uy_ * hi_ + ny_ * off), (pa[0] + ux_ * lo_ + nx_ * off, pa[1] + uy_ * lo_ + ny_ * off)]
            cv2.fillPoly(beam, [np.round(np.array(quad)).astype(np.int32)], 255)
            n_beam += 1
    # (round 21) built-in boxes: a closed quad on the symbol layer or the V40 cut pen (846: the electrical cabinet in the wall
    #    niche by the laundry, a box with the panel symbol) — written as their outlines for auto_rooms to test against the walls
    sym_boxes = []
    for x in dr:
        if "items" not in x or not re.search(r"siman|symb|(^|\|)V40$", x.get("layer") or "", re.I):
            continue
        for it in x["items"]:
            if it[0] == "qu":
                q = it[1]
                sym_boxes.append([list(tp(q.ul)), list(tp(q.ur)), list(tp(q.lr)), list(tp(q.ll))])
    furn_polys = []                              # (round 18) the furniture layer: closet runs are hatched rectangles on it
    for x in dr:
        if re.search(r"FURN|rihut|ריהוט", x.get("layer") or "", re.I):
            for poly in path_polys(x):
                if len(poly) >= 2:
                    furn_polys.append([[round(px_, 1), round(py_, 1)] for px_, py_ in poly])
    tris = []
    for x in dr:
        if x.get("fill") is None or x.get("type") not in ("f", "fs"):
            continue
        for poly in path_polys(x):
            pts_ = [tuple(v) for v in poly]
            uniq = []
            for q in pts_:
                if not uniq or abs(uniq[-1][0] - q[0]) + abs(uniq[-1][1] - q[1]) > 0.5:
                    uniq.append(q)
            if len(uniq) >= 2 and abs(uniq[0][0] - uniq[-1][0]) + abs(uniq[0][1] - uniq[-1][1]) <= 0.5:
                uniq.pop()
            if len(uniq) == 3:
                xs_, ys_ = [q[0] for q in uniq], [q[1] for q in uniq]
                tris.append([round(sum(xs_) / 3, 1), round(sum(ys_) / 3, 1), round(max(max(xs_) - min(xs_), max(ys_) - min(ys_)), 1), x.get("layer") or ""])
    frac = float((wall > 0).mean())
    if "--dims-only" in sys.argv:
        os.makedirs(out, exist_ok=True)
        json.dump({"source": "auto_walls_pdf.py --dims-only", "pdf": os.path.basename(pdf), "page": page_no, "dpi": dpi, "crop_box_px": [x0, y0, x1, y1],
                   "layers": census, "n_door_paths": n_door, "dimension_segments_px": dims, "plumbing_rects_px": plumb, "plumbing_polys_px": plumb_polys, "furniture_polys_px": furn_polys, "symbol_boxes_px": [[[round(v, 1) for v in p_] for p_ in b_] for b_ in sym_boxes], "filled_triangles_px": tris},
                  open(os.path.join(out, "pdf-vectors.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        if n_door:
            cv2.imwrite(os.path.join(out, "strokes.png"), door)          # the drawn door leaves and arcs, exact
        if n_win:
            # (round 20) close the gaps in a window line: collinear window / glass segments (angle <= 2 deg, offset <= 3 cm)
            #    whose ends are <= 15 cm apart along the same line are joined, so no room leaks through a mullion gap
            ws_ = _segs(r"O-WIN")
            pcm = 2.2677 * (dpi / 288.0)
            n_join = 0
            for i_ in range(len(ws_)):
                (a1, b1) = ws_[i_]
                L1 = math.hypot(b1[0] - a1[0], b1[1] - a1[1])
                u1 = ((b1[0] - a1[0]) / L1, (b1[1] - a1[1]) / L1)
                for j_ in range(i_ + 1, len(ws_)):
                    (a2, b2) = ws_[j_]
                    L2 = math.hypot(b2[0] - a2[0], b2[1] - a2[1])
                    u2 = ((b2[0] - a2[0]) / L2, (b2[1] - a2[1]) / L2)
                    if abs(u1[0] * u2[1] - u1[1] * u2[0]) > math.sin(math.radians(2)):
                        continue
                    if abs(-(a2[0] - a1[0]) * u1[1] + (a2[1] - a1[1]) * u1[0]) > 3 * pcm:
                        continue                      # not on the same line
                    best_ = min(((math.hypot(p_[0] - q_[0], p_[1] - q_[1]), p_, q_) for p_ in (a1, b1) for q_ in (a2, b2)), key=lambda t: t[0])
                    if 0.5 < best_[0] <= 15 * pcm:
                        t1 = sorted([0, L1]); tq = (best_[2][0] - a1[0]) * u1[0] + (best_[2][1] - a1[1]) * u1[1]
                        if t1[0] - 1 <= tq <= t1[1] + 1:
                            continue                  # overlapping, not a gap
                        cv2.line(win, (int(round(best_[1][0])), int(round(best_[1][1]))), (int(round(best_[2][0])), int(round(best_[2][1]))), 255, max(2, int(round(0.72 * k))))
                        n_join += 1
            if n_join:
                print(f"auto_walls_pdf: {n_join} gap(s) <= 15 cm in window lines joined")
            cv2.imwrite(os.path.join(out, "windows-vector.png"), cv2.dilate(win, np.ones((3, 3), np.uint8)))   # the drawn windows, exact
        if beam.any():
            cv2.imwrite(os.path.join(out, "beam-strip.png"), beam)   # (round 19) the strip between a V25 edge and the glass
            print(f"auto_walls_pdf: beam strip from {n_beam} V25 edge / glass pair(s), {int((beam > 0).sum())} px")
        if glass.any():
            cv2.imwrite(os.path.join(out, "windows-glass.png"), glass)   # the O-WIN glass lines only (round 18)
        if gpen.any():
            cv2.imwrite(os.path.join(out, "glazing-pen.png"), cv2.dilate(gpen, np.ones((3, 3), np.uint8)))   # the cut glass drawn by pen weight
        print(f"auto_walls_pdf --dims-only: {len(dims)} dimension segments, {n_door} door paths (walls stay raster)")
        return
    frac = float((wall > 0).mean())
    if frac < 0.004:
        top = sorted(census.items(), key=lambda t: -t[1])[:8]
        print(f"auto_walls_pdf: no wall layers on page {page_no} (wall fill {frac * 100:.2f} % of the crop); census {top}")
        sys.exit(2)
    wall = cv2.morphologyEx(wall, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    win = cv2.morphologyEx(win, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n_, lab, stats, _ = cv2.connectedComponentsWithStats(win, connectivity=8)
    glazing = []
    for c in range(1, n_):
        bx, by, bw, bh, area = stats[c]
        if area < 40 or max(bw, bh) < 20:
            continue
        cs, _ = cv2.findContours((lab == c).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        box = cv2.boxPoints(cv2.minAreaRect(max(cs, key=cv2.contourArea)))
        glazing.append({"bbox_px": [int(bx), int(by), int(bx + bw), int(by + bh)], "rect_px": [[round(float(px), 1), round(float(py), 1)] for px, py in box], "area_px": int(area)})
    clusters = []
    for r in plumb:
        placed = False
        for c in clusters:
            if not (r[2] < c[0] - 8 or r[0] > c[2] + 8 or r[3] < c[1] - 8 or r[1] > c[3] + 8):
                c[0], c[1], c[2], c[3] = min(c[0], r[0]), min(c[1], r[1]), max(c[2], r[2]), max(c[3], r[3])
                placed = True
                break
        if not placed:
            clusters.append(list(r))
    out_grey = np.full((H, W), 255, np.uint8)
    out_grey[wall > 0] = 110
    out_grey[win > 0] = 110
    out_grey[door > 0] = 0
    os.makedirs(out, exist_ok=True)
    cv2.imwrite(os.path.join(out, "plan-grey.png"), out_grey)
    cv2.imwrite(os.path.join(out, "walls-only.png"), wall)
    cv2.imwrite(os.path.join(out, "strokes.png"), door)
    json.dump({"source": "auto_walls_pdf.py: window layers of the PDF", "glazing": glazing}, open(os.path.join(out, "glazing.json"), "w"), indent=1)
    json.dump({"source": "auto_walls_pdf.py", "pdf": os.path.basename(pdf), "page": page_no, "dpi": dpi, "crop_box_px": [x0, y0, x1, y1],
               "layers": census, "n_wall_fill_paths": n_wall_fill, "n_wall_stroke_paths": n_wall_stroke, "n_window_paths": n_win, "n_door_paths": n_door,
               "dimension_segments_px": dims, "plumbing_clusters_px": clusters}, open(os.path.join(out, "pdf-vectors.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"mode": "pdf-vectors", "wall_pct": round(frac * 100, 2), "windows": len(glazing), "door_paths": n_door, "dimension_segments": len(dims)}, open(os.path.join(out, "prep.json"), "w"), indent=1)
    print(f"auto_walls_pdf: VECTOR walls from the PDF layers: {n_wall_fill} fill + {n_wall_stroke} stroke paths ({frac * 100:.1f} % of the crop), {len(glazing)} window bars, {n_door} door paths, {len(dims)} dimension segments, {len(clusters)} plumbing clusters")


if __name__ == "__main__":
    main()

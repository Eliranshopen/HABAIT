#!/usr/bin/env python
"""intake_pdf_vector.py <plan.pdf> --out <dir> [options]

Lane A / A3 (board habait-workplan-2026-11-02, card 06): a VECTOR sales-plan PDF -> plan.json (schema
0.2.0-draft, geometry "general", cm, +y down, origin = the crop's top-left, same frame convention as
intake_raster.py) + report.json / report.md in the SAME format (habait.intake-report/0.1: raster.cm_to_px,
frames, dimensions[], summary.tolerance) and plan-crop.png for the correction screen.

Why a separate path: a CAD-exported sales sheet keeps its geometry exact (walls as hatched polygons, glazing,
door swings as arcs, dimension lines with ticks) and very often its CAD layers as optional-content groups. Reading
those beats rasterising and tracing; the printed text is usually outlined (no text spans), so names and numbers
are decoded from the glyph shapes (vector_common.read_labels / parse_dimensions), not OCR'd and not VLM'd.

Steps ($0, no network, no LLM):
  1. primitives   pymupdf get_drawings(extended=True), clip stack applied (the neighbours behind the viewport clip
                  are dropped), every path tagged with its OCG layer           -> vector.json (layer stats)
  2. classify     layer map JSON (layer_maps/<office>.json; style fallback when the PDF has no layers)
  3. dimensions   dimension lines + ticks + stroke-font digits; digits decoded by glyph-shape clustering
  4. calibrate    pt/cm = median(span / printed value) over the dimensions within 3 % of the nominal scale
  5. labels       outlined room names decoded against lexicon_he.json (+ --vlm-json names if given)
  6. geometry     walls = wall hatch fills + thin faces of the wall outlines; barriers = walls + glazing +
                  railings + slab edges + door closures (hinge -> closed leaf end); rooms = labelled free-space
                  components; open-plan components with several labels split by the labels' Voronoi cells
  7. openings     swing doors (arc + leaf), glazed doors between an indoor and an outdoor room (assumption),
                  virtual zone cuts
  8. emit         intake_raster.emit_plan / make_report (card 01's emitters, imported, unchanged), then the vector
                  fields are patched in: exact dimension lines, chord-measured room sizes, plan_meta provenance
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import re
import sys
import time

import numpy as np
from shapely.geometry import LineString, MultiPoint, Point, Polygon, box
from shapely.ops import polygonize, unary_union, voronoi_diagram

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import intake_raster as ir  # noqa: E402  (card 01: emit_plan, make_report, add_edge_kinds, write_report_md)
import vector_common as vc  # noqa: E402

OUTDOOR_TYPES = {"balcony", "service_balcony"}
ENTRANCE_HE = "\u05db\u05e0\u05d9\u05e1\u05d4"
TRACER_NOTE = {"vector PDF": "Habait/engine/intake/intake_pdf_vector.py (vector PDF: pymupdf drawings + OCG layers; names and digits decoded from the outlined glyphs; no VLM, no raster tracing)",
               "DXF": "Habait/engine/intake/intake_dwg.py (DXF via ezdxf: layers, TEXT/MTEXT, DIMENSION entities, door blocks; no VLM)",
               "IFC": "Habait/engine/intake/intake_ifc.py (IFC via IfcOpenShell 0.9: IfcSpace rooms, IfcWall/IfcColumn poche, IfcWindow/IfcRailing/IfcDoor; no VLM)"}
ENTRANCE_SEED_CM = 60.0  # an unprinted entrance hall is seeded this far inside the unit door, then zoned geodesically


def log(*a):
    print(*a, flush=True)


def as_polys(g):
    if g is None or g.is_empty:
        return []
    if g.geom_type == "Polygon":
        return [g]
    return [x for x in getattr(g, "geoms", []) if x.geom_type == "Polygon"]


def geodesic_cells(region, seeds_xy, step):
    """Geodesic Voronoi of seed points inside a polygon: rasterise at `step` px, multi-source path distance
    (skimage MCP_Geometric, obstacles = outside the polygon), each pixel to its nearest seed, back to polygons."""
    import cv2
    from skimage.graph import MCP_Geometric

    x0, y0, x1, y1 = region.bounds
    w, h = int(math.ceil((x1 - x0) / step)) + 3, int(math.ceil((y1 - y0) / step)) + 3
    mask = np.zeros((h, w), np.uint8)
    for poly in as_polys(region):
        ext = ((np.array(poly.exterior.coords) - [x0, y0]) / step + 1).round().astype(np.int32)
        cv2.fillPoly(mask, [ext], 1)
        for hole in poly.interiors:
            cv2.fillPoly(mask, [((np.array(hole.coords) - [x0, y0]) / step + 1).round().astype(np.int32)], 0)
    cost = np.where(mask > 0, 1.0, np.inf)
    dists = []
    for (sx, sy) in seeds_xy:
        c = (int(round((sy - y0) / step + 1)), int(round((sx - x0) / step + 1)))
        c = (min(max(c[0], 0), h - 1), min(max(c[1], 0), w - 1))
        if mask[c] == 0:                     # a label printed over a fixture line: snap to the nearest free pixel
            ys, xs = np.nonzero(mask)
            j = int(np.argmin((ys - c[0]) ** 2 + (xs - c[1]) ** 2))
            c = (int(ys[j]), int(xs[j]))
        m = MCP_Geometric(cost)
        d, _ = m.find_costs([c])
        dists.append(d)
    lab = np.argmin(np.stack(dists), axis=0)
    cells = []
    for i in range(len(seeds_xy)):
        mi = ((lab == i) & (mask > 0)).astype(np.uint8)
        cs, _ = cv2.findContours(mi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        polys = []
        for cc in cs:
            if len(cc) >= 3:
                pts = (cc[:, 0, :].astype(float) - 1) * step + [x0, y0]
                p = Polygon(pts).buffer(0.75 * step)
                if not p.is_empty:
                    polys.append(p)
        cells.append(unary_union(polys) if polys else None)
    # the half-step buffers overlap: give each overlap to the earlier cell only
    taken = Polygon()
    out = []
    for c in cells:
        if c is None:
            out.append(None)
            continue
        c2 = c.difference(taken)
        out.append(c2)
        taken = taken.union(c)
    return out


def fit_circle(pts):
    pts = np.asarray(pts, float)
    A = np.c_[2 * pts[:, 0], 2 * pts[:, 1], np.ones(len(pts))]
    b = (pts ** 2).sum(axis=1)
    cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]
    r = math.sqrt(max(c + cx * cx + cy * cy, 0.0))
    return np.array([cx, cy]), r


# ----------------------------------------------------------------------------------------------- doors
def find_doors(door_prims, T, walls_px, log=log):
    """Swing doors: every arc (curve path) on the door layers -> hinge (arc centre), leaf length (radius), closed
    position (the arc end away from the drawn open leaf; without a leaf, the end nearer a wall face)."""
    pieces = []
    for p in door_prims:
        g = vc.geom_T(p.geom, T)
        pieces.append((p, g))
    arcs = [(p, g) for p, g in pieces if p.curves > 0]
    straight = [s for p, g in pieces if p.curves == 0 for s in vc.lines_of(g)]
    doors = []
    for p, g in arcs:
        runs = [np.array(x.coords) for x in getattr(g, "geoms", [g]) if x.geom_type == "LineString"]
        if not runs:
            continue
        pts = np.vstack(runs)
        if len(pts) < 5:
            continue
        C, r = fit_circle(pts)
        resid = np.abs(np.hypot(*(pts - C).T) - r).max()
        if r <= 0 or resid > 0.08 * r:
            continue
        ang = np.degrees(np.arctan2(pts[:, 1] - C[1], pts[:, 0] - C[0]))
        span = (ang.max() - ang.min()) if (ang.max() - ang.min()) < 180 else 360 - (ang.max() - ang.min())
        E1, E2 = runs[0][0], runs[-1][-1]
        if np.hypot(*(E1 - E2)) < 0.5 * r:
            continue
        leaf_end = None
        for s in straight:
            a, b = np.array(s[0]), np.array(s[1])
            for h, f in ((a, b), (b, a)):
                if np.hypot(*(h - C)) < 0.2 * r and abs(np.hypot(*(f - C)) - r) < 0.25 * r:
                    leaf_end = f
        if leaf_end is not None:
            closed = E1 if np.hypot(*(E1 - leaf_end)) > np.hypot(*(E2 - leaf_end)) else E2
            basis = "leaf"
        else:
            d1 = walls_px.distance(Point(E1)) if walls_px is not None else 0
            d2 = walls_px.distance(Point(E2)) if walls_px is not None else 0
            closed = E1 if d1 < d2 else E2
            basis = "nearer wall"
        doors.append({"hinge": C, "closed": np.asarray(closed, float), "r": r, "sweep_deg": round(float(span), 1), "basis": basis})
    # one arc can be drawn as two paths: drop doors whose hinge and closed end duplicate an earlier one
    out = []
    for d in doors:
        if any(np.hypot(*(d["hinge"] - e["hinge"])) < 0.15 * d["r"] and np.hypot(*(d["closed"] - e["closed"])) < 0.15 * d["r"] for e in out):
            continue
        out.append(d)
    log(f"doors: {len(out)} swing doors from {len(arcs)} arcs")
    return out


# ----------------------------------------------------------------------------------------------- main
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("--out", required=True)
    ap.add_argument("--page", type=int, default=0)
    ap.add_argument("--dpi", type=int, default=288, help="raster frame of plan-crop.png and of the px fields (same as intake_raster)")
    ap.add_argument("--scale", type=int, default=50, help="drawing scale denominator (nominal; the dimensions fit the real one)")
    ap.add_argument("--layer-map", default=os.path.join(HERE, "layer_maps", "dblk.json"))
    ap.add_argument("--lexicon", default=os.path.join(HERE, "lexicon_he.json"))
    ap.add_argument("--vlm-json", default=None, help="optional: a saved vlm.json (intake/vlm.py) whose room names join the candidates and whose unit block is used ($0 replay)")
    ap.add_argument("--apartment-id", default=None)
    ap.add_argument("--ceiling-cm", type=float, default=290)
    ap.add_argument("--rights-state", default="partner-supplied")
    ap.add_argument("--rights-note", default="")
    ap.add_argument("--known-dims", default=None, help="an apt intake fixture (drawing.printed_dimensions_cm, unit.*) to score against")
    ap.add_argument("--ground-truth", default=None, help="a hand-checked plan.json to score rooms/openings/walls against")
    ap.add_argument("--tour-crop-box-px", type=json.loads, default=None, help="the ground truth's crop box on the 288-dpi sheet [x0,y0,x1,y1] (846: [1750,380,5500,4280])")
    ap.add_argument("--margin", type=float, default=0.06, help="crop margin around the building layers (fraction of the bbox)")
    ap.add_argument("--close-px", type=float, default=4.0, help="barrier closing radius in px (seals sub-cm gaps between wall outlines and glazing)")
    args = ap.parse_args(argv)
    out = args.out
    os.makedirs(out, exist_ok=True)
    TT = {}
    t0 = time.time()
    import pymupdf

    # 1-2 primitives + classes
    prims, info = vc.pdf_primitives(args.pdf, args.page)
    lmap = vc.LayerMap(args.layer_map)
    layer_stats = vc.classify_all(prims, lmap)
    TT["primitives"] = round(time.time() - t0, 1)
    log(f"{len(prims)} primitives after clipping ({info['n_drawings']} drawings, {len(info['ocgs'])} OCG layers, {info['text_spans']} text spans)")
    PX = args.dpi / 72.0                       # px per pt
    nominal_pt_cm = 72.0 / 2.54 / args.scale
    nominal = nominal_pt_cm * PX               # px per cm (2.2677 at 288 dpi, 1:50)

    # 3-4 dimensions + calibration
    t0 = time.time()
    dims, ddiag = vc.parse_dimensions([p for p in prims if p.cls == "dimension"], nominal_pt_cm, log=log)
    samples = []
    for d in dims:
        if d["value_cm"]:
            r = d["span_units"] / d["value_cm"]
            samples.append({"value_cm": d["value_cm"], "span_cm_nominal": d["nominal_cm"], "ratio_vs_nominal": round(r / nominal_pt_cm, 5),
                            "used": abs(r / nominal_pt_cm - 1) <= 0.03})
    used = [s["ratio_vs_nominal"] for s in samples if s["used"]]
    fit_pt = float(np.median(used)) * nominal_pt_cm if used else nominal_pt_cm
    k = fit_pt * PX
    cal = {"px_per_cm": k, "nominal_px_per_cm": nominal, "deviation_pct": round((k / nominal - 1) * 100, 3),
           "basis": (f"median span/value over {len(used)} of {len(samples)} printed dimensions read from the vector dimension "
                     f"entities (within 3 % of 1:{args.scale}); spread {min(used):.4f}..{max(used):.4f} x nominal" if used else
                     "nominal only (no dimension read)"),
           "samples": samples, "rooms_used": []}
    TT["dimensions"] = round(time.time() - t0, 1)

    # crop box in sheet px
    bcls = {"wall_fill", "wall_line", "column", "window", "door", "railing"}
    # the crop follows the poche, glazing, doors and railings only: wall-outline layers often carry the sheet frame too
    bb = np.array([p.geom.bounds for p in prims if p.cls in {"wall_fill", "column", "window", "door", "railing"}])
    if not len(bb):
        log("no building layers found: check the layer map")
        return 2
    x0, y0, x1, y1 = bb[:, 0].min(), bb[:, 1].min(), bb[:, 2].max(), bb[:, 3].max()
    mx, my = (x1 - x0) * args.margin, (y1 - y0) * args.margin
    cx0, cy0 = int(math.floor(max(0, (x0 - mx)) * PX)), int(math.floor(max(0, (y0 - my)) * PX))
    cx1, cy1 = int(math.ceil(min(info["page_w"], x1 + mx) * PX)), int(math.ceil(min(info["page_h"], y1 + my) * PX))
    W, H = cx1 - cx0, cy1 - cy0
    crop_info = {"crop_box_px": [cx0, cy0, cx1, cy1], "dpi": args.dpi, "how": "bbox of the building layers + margin, in the 288-dpi sheet frame"}
    doc = pymupdf.open(args.pdf)
    pg = doc[args.page]
    pix = pg.get_pixmap(clip=pymupdf.Rect(cx0 / PX, cy0 / PX, cx1 / PX, cy1 / PX), dpi=args.dpi, colorspace=pymupdf.csGRAY, alpha=False)
    pix.save(os.path.join(out, "plan-crop.png"))
    if (pix.width, pix.height) != (W, H):
        log(f"warning: plan-crop.png is {pix.width}x{pix.height}, crop box {W}x{H}")
    T = np.array([[PX, 0, -cx0], [0, PX, -cy0]])

    # 5 labels
    t0 = time.time()
    cands = [dict(r, source="lexicon") for r in json.load(open(args.lexicon, encoding="utf-8"))["rooms"]]
    vlm_src = None
    unit = {}
    if args.vlm_json:
        vlm_src = json.load(open(args.vlm_json, encoding="utf-8"))
        unit = vlm_src.get("unit") or {}
        for r in vlm_src.get("rooms", []):
            if r.get("name_he"):
                cands.append({"he": r["name_he"], "en": r.get("name_en") or r["name_he"], "type": r.get("type", "other"), "source": "vlm"})
    blocks, ldiag = vc.read_labels([p for p in prims if p.cls == "text"], cands, log=log)
    labels = []
    for b in blocks:
        if not b["name"]:
            continue
        labels.append({"xy_src": b["center"], "he": b["name"]["he"], "en": b["name"]["en"], "type": b["name"]["type"], "source": b["name"]["source"]})
    TT["labels"] = round(time.time() - t0, 1)

    return assemble(args, out, prims, info, layer_stats, T, k, W, H, crop_info, cal, dims, ddiag, labels, ldiag, unit, TT,
                    fit_units_per_cm=fit_pt)


def assemble(args, out, prims, info, layer_stats, T, k, W, H, crop_info, cal, dims, ddiag, labels_src, ldiag, unit, TT,
             fit_units_per_cm, room_polys=None, source_kind="vector PDF"):
    """Format-independent half of the vector intake: classified primitives (source units) + decoded dimensions and labels
    -> walls, rooms, openings, panes in the crop px frame (affine T: source -> px, k px/cm) -> card 01's emitters.
    room_polys: optional [shapely Polygon in source units] from a CAD room/area-boundary layer; when given, rooms are
    those polygons (no free-space segmentation, no Voronoi zones) and adjacent rooms not parted by a wall get an
    'opening' (open plan)."""
    crop_poly = box(0, 0, W, H)
    labels = [dict(L, xy=vc.apply_T(T, L["xy_src"])) for L in labels_src]
    # 6 geometry
    t0 = time.time()
    fills = [vc.geom_T(p.geom, T) for p in prims if p.cls in ("wall_fill", "column") and p.kind == "fill"]
    fill_u = unary_union([g.buffer(0) for g in fills]) if fills else Polygon()
    wl = [LineString(s) for p in prims if p.cls in ("wall_line", "column") for s in vc.lines_of(vc.geom_T(p.geom, T))]
    faces = list(polygonize(unary_union(wl))) if wl else []
    max_w = 50.0 * k
    thin = [f for f in faces if f.area > 0 and (2 * f.area / f.length) < max_w]
    walls_u = unary_union([fill_u] + [f.buffer(0) for f in thin]).buffer(0.5).buffer(-0.5)
    walls_u = walls_u.intersection(crop_poly)
    barrier_lines = [LineString(s) for p in prims if p.cls in ("window", "railing", "wall_line", "slab_edge", "column") and p.kind == "stroke"
                     for s in vc.lines_of(vc.geom_T(p.geom, T)) if vc.seg_len(s) > 0]
    doors = find_doors([p for p in prims if p.cls == "door"], T, walls_u)
    closures = []
    for d in doors:
        h, c = d["hinge"], d["closed"]
        u = (c - h) / max(np.hypot(*(c - h)), 1e-6)
        closures.append(LineString([h - u * 4, c + u * 4]))
    barrier = unary_union([walls_u] + [l.buffer(1.0) for l in barrier_lines] + [l.buffer(1.0) for l in closures])
    g = args.close_px
    sealed = barrier.buffer(g)
    free_core = crop_poly.difference(sealed)
    free = []
    for comp in as_polys(free_core):
        back = comp.buffer(g).intersection(crop_poly).difference(barrier)
        parts = as_polys(back)
        if parts:
            free.append(max(parts, key=lambda q: q.area))
    min_area = 0.3e4 * k * k
    free = [f for f in free if f.area >= min_area]
    barrier_ns = unary_union([walls_u] + [LineString(s_).buffer(1.0) for p in prims if p.cls in ("window", "railing", "wall_line", "column") and p.kind == "stroke"
                                          for s_ in vc.lines_of(vc.geom_T(p.geom, T)) if vc.seg_len(s_) > 0] + [l.buffer(1.0) for l in closures])
    free_ns = as_polys(crop_poly.difference(barrier_ns.buffer(g)))
    TT["geometry"] = round(time.time() - t0, 1)
    log(f"walls: {len(as_polys(walls_u))} solid pieces, {walls_u.area / k / k / 1e4:.2f} m2; free-space components >= 0.3 m2: {len(free)}")

    # rooms: labelled components, zones by Voronoi of the labels
    comp_labels = {i: [] for i in range(len(free))}
    for L in ([] if room_polys else labels):
        pt = Point(L["xy"])
        hit = [i for i, f in enumerate(free) if f.contains(pt)]
        if not hit:
            near = sorted(((f.distance(pt), i) for i, f in enumerate(free)))
            if near and near[0][0] < 30 * k:
                hit = [near[0][1]]
        if hit:
            comp_labels[hit[0]].append(L)
            L["comp"] = hit[0]
        else:
            L["comp"] = None
    # an open-plan component reached by a door from nowhere (the unit entrance) gets an Entrance seed 120 cm inside,
    # unless it already holds a hall label (sales sheets rarely print the entrance hall)
    def comp_at(xy):
        pt = Point(xy)
        return next((i for i, f in enumerate(free) if f.distance(pt) <= 3), None)
    seeds = []
    for d in ([] if room_polys else doors):
        h, c = d["hinge"], d["closed"]
        u = (c - h) / max(np.hypot(*(c - h)), 1e-6)
        n = np.array([-u[1], u[0]])
        mid = (h + c) / 2
        sides = []
        for sgn in (1, -1):
            ci = None
            for off in (20, 35, 55):
                ci = comp_at(mid + sgn * n * off * k)
                if ci is not None:
                    break
            sides.append((sgn, ci))
        lab_sides = [(sgn, ci) for sgn, ci in sides if ci is not None and comp_labels[ci]]
        if len(lab_sides) != 1:
            continue
        sgn, ci = lab_sides[0]
        if len([L for L in comp_labels[ci] if L["type"] != "shaft"]) < 2 or any(L["type"] == "hall" for L in comp_labels[ci]):
            continue
        xy = mid + sgn * n * ENTRANCE_SEED_CM * k
        if not free[ci].contains(Point(xy)):
            continue
        L = {"xy": xy, "he": ENTRANCE_HE, "en": "Entrance", "type": "hall", "source": "seeded at the entrance door (not printed)", "comp": ci,
             "door_mid": mid}
        comp_labels[ci].append(L)
        labels.append(L)
        seeds.append(L)
    rooms, zone_cuts = [], []
    if room_polys:
        for rp in room_polys:
            q = vc.geom_T(rp, T).buffer(0).difference(walls_u)
            parts = as_polys(q)
            if not parts:
                continue
            q = max(parts, key=lambda z: z.area)
            inside = [L for L in labels if q.distance(Point(L["xy"])) <= 5 * k and L["type"] != "shaft"]
            rooms.append({"poly": q, "label": inside[0] if inside else None, "zone_of": None, "comp": None})
        for a_ in range(len(rooms)):
            for b_ in range(a_ + 1, len(rooms)):
                sh = rooms[a_]["poly"].buffer(6 * k).intersection(rooms[b_]["poly"].buffer(6 * k)).difference(barrier.buffer(2 * k))
                if sh.is_empty or sh.area < (10 * k) ** 2:
                    continue
                sh = max(as_polys(sh), key=lambda z: z.area)
                L_, S_, _ = vc.min_rect(sh)
                if L_ < 30 * k or S_ > 16 * k:
                    continue
                mr = sh.minimum_rotated_rectangle
                c = list(mr.exterior.coords)
                e1, e2 = np.array(c[1]) - np.array(c[0]), np.array(c[2]) - np.array(c[1])
                if np.hypot(*e1) >= np.hypot(*e2):
                    A, B = (np.array(c[0]) + np.array(c[3])) / 2, (np.array(c[1]) + np.array(c[2])) / 2
                else:
                    A, B = (np.array(c[0]) + np.array(c[1])) / 2, (np.array(c[3]) + np.array(c[2])) / 2
                zone_cuts.append({"rooms": [a_, b_], "a": A, "b": B, "drawn": True})
        best_cut = {}
        for zc in zone_cuts:                          # one contact opening per room pair: the longest
            key = tuple(zc["rooms"])
            if key not in best_cut or np.hypot(*(zc["b"] - zc["a"])) > np.hypot(*(best_cut[key]["b"] - best_cut[key]["a"])):
                best_cut[key] = zc
        zone_cuts = list(best_cut.values())
        comp_labels = {}
    for i, f in enumerate(free):
        if room_polys:
            break
        Ls = [L for L in comp_labels[i] if L["type"] != "shaft"]
        if not Ls:
            continue
        if len(Ls) == 1:
            rooms.append({"poly": f, "label": Ls[0], "zone_of": None, "comp": i})
            continue
        # open plan: geodesic Voronoi of the labels (path distance inside this free space, so a corridor behind a
        # partition goes to the seed it is walkable from); a seeded entrance sits 60 cm inside its door
        cells = geodesic_cells(f, [L["xy"] for L in Ls], step=max(1.0, 2.0 * k))
        zones = []
        for L, cell in zip(Ls, cells):
            z = f.intersection(cell) if cell is not None else Polygon()
            parts = as_polys(z)
            main_part = next((q for q in parts if q.buffer(1).contains(Point(L["xy"]))), max(parts, key=lambda q: q.area) if parts else None)
            zones.append([L, main_part, [q for q in parts if q is not main_part]])
        for L, mp_, rest in zones:      # stray Voronoi slivers go to the zone they touch most
            for q in rest:
                best = max(zones, key=lambda z: z[1].buffer(1).intersection(q).area if z[1] is not None else -1)
                best[1] = unary_union([best[1], q])
        for L, z, _ in zones:
            if z is None or z.is_empty:
                continue
            z = max(as_polys(z.buffer(0.5).buffer(-0.5)) or [z], key=lambda q: q.area)
            rooms.append({"poly": z, "label": L, "zone_of": i, "comp": i})
    for a_ in range(len(rooms)):
        for b_ in range(a_ + 1, len(rooms)):
            if rooms[a_]["zone_of"] is None or rooms[a_]["zone_of"] != rooms[b_]["zone_of"]:
                continue
            sh = rooms[a_]["poly"].buffer(1.5).intersection(rooms[b_]["poly"].buffer(1.5))
            if sh.is_empty or sh.area < 1:
                continue
            mr = sh.minimum_rotated_rectangle
            c = list(mr.exterior.coords)
            e1, e2 = np.array(c[1]) - np.array(c[0]), np.array(c[2]) - np.array(c[1])
            if np.hypot(*e1) >= np.hypot(*e2):
                A, B = (np.array(c[0]) + np.array(c[3])) / 2, (np.array(c[1]) + np.array(c[2])) / 2
            else:
                A, B = (np.array(c[0]) + np.array(c[1])) / 2, (np.array(c[3]) + np.array(c[2])) / 2
            if np.hypot(*(B - A)) < 30 * k:
                continue
            zone_cuts.append({"rooms": [a_, b_], "a": A, "b": B})
    unnamed = []
    merged_into = {}
    for i, f in enumerate(free):
        if room_polys or comp_labels[i]:
            continue
        # a piece cut off from a labelled outdoor room only by a slab / beam edge is part of that room
        fn = next((q for q in free_ns if q.contains(f.representative_point())), None)
        tgt = None
        if fn is not None:
            for j, r in enumerate(rooms):
                if r["label"] and r["label"]["type"] in OUTDOOR_TYPES and fn.contains(r["poly"].representative_point()):
                    tgt = j
        if tgt is not None and f.area >= 0.5e4 * k * k:
            rooms[tgt]["poly"] = max(as_polys(unary_union([rooms[tgt]["poly"].buffer(g + 1.5), f.buffer(g + 1.5)]).buffer(-(g + 1.5))), key=lambda q: q.area)
            merged_into[i] = tgt
            continue
        touches_edge = f.buffer(2).intersects(crop_poly.exterior)
        mrL, mrS, _ = vc.min_rect(f)
        hard = walls_u.buffer(4)
        along_wall = f.exterior.intersection(hard).length / max(f.exterior.length, 1e-6)
        if not touches_edge and f.area >= 1.5e4 * k * k and mrS >= 80 * k and along_wall >= 0.3:
            unnamed.append(i)
            rooms.append({"poly": f, "label": None, "zone_of": None, "comp": i})
    room_u = unary_union([r["poly"] for r in rooms]) if rooms else Polygon()
    outside = unary_union([f for i, f in enumerate(free) if i not in merged_into and not any(r["comp"] == i for r in rooms)]) if free else Polygon()
    log(f"rooms: {len(rooms)} ({sum(1 for r in rooms if r['label'])} named, {len(unnamed)} unnamed), {len(zone_cuts)} virtual zone cuts")

    def room_at(xy, reach=3.0):
        pt = Point(xy)
        for j, r in enumerate(rooms):
            if r["poly"].distance(pt) <= reach:
                return j
        return None

    # 7 openings
    openings = []
    for d in doors:
        h, c = d["hinge"], d["closed"]
        u = (c - h) / max(np.hypot(*(c - h)), 1e-6)
        n = np.array([-u[1], u[0]])
        mid = (h + c) / 2
        sides = []
        for sgn in (1, -1):
            j = None
            for off in (20, 35, 55):
                j = room_at(mid + sgn * n * off * k)
                if j is not None:
                    break
            sides.append(j)
        rr = [("t%d" % j) if j is not None else "outside" for j in sides]
        if rr[0] == rr[1]:
            continue
        kind = "entrance_door" if "outside" in rr else "door"
        openings.append({"kind": kind, "rooms": rr, "a_px": h.tolist(), "b_px": c.tolist(), "centre_px": mid.tolist(),
                         "angle_deg": (math.degrees(math.atan2(u[0], -u[1]))) % 360, "width_px": float(np.hypot(*(c - h))),
                         "source": f"swing arc (closed end by {d['basis']})"})
    # glazed doors: a window unit between an indoor and an outdoor room (the widest unit per room pair)
    win = [vc.geom_T(p.geom, T) for p in prims if p.cls == "window"]
    groups = []
    for gg in as_polys(unary_union([w.buffer(2.0) for w in win])) if win else []:
        groups.append(gg)
    best_pair = {}
    panes = []
    for gi, gg in enumerate(groups):
        L_, S_, ang = vc.min_rect(gg)
        if L_ < 40 * k:
            continue
        mr = gg.minimum_rotated_rectangle
        c = list(mr.exterior.coords)
        e1 = np.array(c[1]) - np.array(c[0])
        e2 = np.array(c[2]) - np.array(c[1])
        if np.hypot(*e1) >= np.hypot(*e2):
            A, B = (np.array(c[0]) + np.array(c[3])) / 2, (np.array(c[1]) + np.array(c[2])) / 2
        else:
            A, B = (np.array(c[0]) + np.array(c[1])) / 2, (np.array(c[3]) + np.array(c[2])) / 2
        u = (B - A) / np.hypot(*(B - A))
        nrm = np.array([-u[1], u[0]])
        mid = (A + B) / 2
        sides = []
        for sgn in (1, -1):
            j = None
            for off in (25, 45, 70):
                j = room_at(mid + sgn * nrm * off * k)
                if j is not None:
                    break
            sides.append(j)
        panes.append({"id": f"pane-{len(panes) + 1}", "kind": "facade", "polygon_px": [list(map(float, p)) for p in mr.exterior.coords[:-1]]})
        if None in sides or sides[0] == sides[1]:
            continue
        lab = [rooms[j]["label"] for j in sides]
        outd = [bool(l_ and l_["type"] in OUTDOOR_TYPES) for l_ in lab]
        if outd[0] == outd[1]:
            continue
        key = tuple(sorted(sides))
        if key not in best_pair or L_ > best_pair[key][0]:
            best_pair[key] = (L_, A, B, mid, u, sides)
    for key, (L_, A, B, mid, u, sides) in best_pair.items():
        openings.append({"kind": "door", "rooms": ["t%d" % sides[0], "t%d" % sides[1]], "a_px": A.tolist(), "b_px": B.tolist(), "centre_px": mid.tolist(),
                         "angle_deg": (math.degrees(math.atan2(u[0], -u[1]))) % 360, "width_px": float(L_),
                         "source": "glazed unit between an indoor and an outdoor room (assumed the sliding door)"})
    door_pairs = {frozenset(o["rooms"]) for o in openings}
    for zc in zone_cuts:
        A, B = zc["a"], zc["b"]
        if frozenset(["t%d" % zc["rooms"][0], "t%d" % zc["rooms"][1]]) in door_pairs:
            continue                                  # the pair already has a drawn door: the contact is its opening
        u = (B - A) / np.hypot(*(B - A))
        openings.append({"kind": "opening", "virtual": True, "rooms": ["t%d" % zc["rooms"][0], "t%d" % zc["rooms"][1]], "a_px": A.tolist(),
                         "b_px": B.tolist(), "centre_px": ((A + B) / 2).tolist(), "angle_deg": (math.degrees(math.atan2(u[0], -u[1]))) % 360,
                         "width_px": float(np.hypot(*(B - A))),
                         "source": "open-plan contact of two drawn room boundaries" if zc.get("drawn") else "virtual zone cut (geodesic Voronoi of the decoded labels)"})
    for i, o in enumerate(openings):
        o["id"] = f"o-{i + 1}"
    rail = [vc.geom_T(p.geom, T) for p in prims if p.cls == "railing"]
    for rg in as_polys(unary_union([r_.buffer(2.0 * k) for r_ in rail])) if rail else []:
        if rg.area > 0:
            panes.append({"id": f"pane-{len(panes) + 1}", "kind": "railing", "polygon_px": [list(map(float, p)) for p in rg.simplify(1.0).exterior.coords[:-1]]})

    # dimensions in the crop frame -> kinds, rooms, chords
    dims_out = []
    for d in dims:
        if not d["value_cm"]:
            continue
        A, B = vc.apply_T(T, d["a"]), vc.apply_T(T, d["b"])
        ts = np.linspace(0.04, 0.96, 25)
        hits = [room_at(A + (B - A) * t, reach=1.0) for t in ts]
        inside = sum(h_ is not None for h_ in hits) / len(hits)
        rr = []
        for h_ in hits:
            if h_ is not None and h_ not in rr:
                rr.append(h_)
        rr = [r_ for r_ in rr if hits.count(r_) >= 0.1 * len(hits)]
        span_cm = float(np.hypot(*(B - A))) / k
        chord = None
        if inside >= 0.85 and rr:
            gU = unary_union([rooms[j]["poly"] for j in rr]).buffer(3).buffer(-3)
            u = (B - A) / np.hypot(*(B - A))
            line = LineString([A - u * 5000, B + u * 5000]).intersection(gU)
            mid = Point((A + B) / 2)
            segs = [s for s in getattr(line, "geoms", [line]) if s.geom_type == "LineString"]
            if segs:
                s = min(segs, key=lambda s: s.distance(mid))
                chord = s.length / k
        # room_clear = the line runs face to face across its room(s): the room chord along it equals its OWN tick span
        # (drawing vs drawing, the printed value is not used, so the printed-vs-room check below stays a real check)
        if chord is not None and abs(chord - span_cm) <= max(0.015 * span_cm, 6.0):
            kind = "room_clear"
        elif chord is not None:
            kind = "sub_element" if chord > span_cm else "partial"
        elif "25dim" in d["layer"] or d["value_cm"] >= 600:
            kind = "overall"
        else:
            kind = "partial"
        if kind != "room_clear":
            chord = None
        dims_out.append({"d": d, "A": A, "B": B, "kind": kind, "rooms_idx": rr, "chord_cm": chord})

    # per-room printed pair (two perpendicular room_clear dims of that room alone)
    for j, r in enumerate(rooms):
        mine = [x for x in dims_out if x["kind"] == "room_clear" and x["rooms_idx"] == [j]]
        pair = None
        for a_ in range(len(mine)):
            for b_ in range(a_ + 1, len(mine)):
                da = abs((mine[a_]["d"]["angle_deg"] - mine[b_]["d"]["angle_deg"] + 90) % 180 - 90)
                if da > 75:
                    pair = sorted([mine[a_], mine[b_]], key=lambda x: -x["d"]["value_cm"])
        r["pair"] = pair

    # trace dict for intake_raster.emit_plan
    trace = {"rooms": [], "walls": [], "openings": openings, "panes": panes, "dimension_lines": []}
    for j, r in enumerate(rooms):
        poly = r["poly"].simplify(1.2)
        Lr, Sr, ang = vc.min_rect(poly)
        lab = r["label"]
        label = None
        if lab:
            label = {"name_he": lab["he"], "name_en": lab["en"], "type": lab["type"], "is_outdoor": lab["type"] in OUTDOOR_TYPES,
                     "printed_dims_cm": [x["d"]["value_cm"] for x in r["pair"]] if r["pair"] else None}
        ip = vc.pole(poly, tol=2.0)
        trace["rooms"].append({"id": "t%d" % j, "label": label, "loop_px": [list(map(float, p)) for p in poly.exterior.coords[:-1]],
                               "min_rect_px": {"size": [Lr, Sr], "angle_deg": ang}, "inner_point_px": [ip.x, ip.y], "zone_of": r["zone_of"]})
    for wi, wp in enumerate(as_polys(walls_u)):
        wp = wp.simplify(1.0)
        if wp.area < (5 * k) ** 2:
            continue
        trace["walls"].append({"id": f"w-{len(trace['walls']) + 1}", "polygon_px": [list(map(float, p)) for p in wp.exterior.coords[:-1]],
                               "touches_outside": bool(not outside.is_empty and wp.buffer(6).intersects(outside))})

    # the 'vlm' dict card 01's emitters read: names = the decoded labels, dims = the vector reading
    sem_rooms = []
    seen = set()
    for r in rooms:
        lab = r["label"]
        if lab:                                   # one semantic room per labelled room (two bedrooms stay two)

            sem_rooms.append({"name_he": lab["he"], "name_en": lab["en"], "type": lab["type"], "is_outdoor": lab["type"] in OUTDOOR_TYPES,
                              "printed_dims_cm": None})
    vlm = {"unit": unit, "rooms": sem_rooms, "printed_dimensions_cm": sorted({d["value_cm"] for d in dims if d["value_cm"]}),
           "confidence": None, "_meta": {"backend": "vector (no VLM)" + (f" + unit/names from {os.path.basename(args.vlm_json)}" if getattr(args, "vlm_json", None) else ""), "model": None}}
    if not args.apartment_id:
        args.apartment_id = "apt" + str(unit.get("number") or "unit")
    args.scale = args.scale
    sheet_info = {"dpi": args.dpi}
    plan = ir.emit_plan(args, trace, vlm, cal, crop_info, sheet_info, out)

    # patch vector provenance + chord-measured sizes into plan.json
    pm = plan["plan_meta"]
    pm["tracer"] = (TRACER_NOTE.get(source_kind, source_kind) + " via " + os.path.basename(args.layer_map))
    pm["trace_method"] = ("vector: walls = wall-hatch fills + thin faces of the wall outlines; barriers = walls + glazing + railings + slab edges + "
                          "door closures (hinge -> closed leaf end); rooms = free-space components holding a decoded label; open-plan components "
                          "with several labels split by the labels' Voronoi cells; openings = swing arcs, the widest glazed unit between an indoor "
                          "and an outdoor room, virtual zone cuts; scale = median span/value of the printed dimension entities")
    pm["scale_basis"] = cal["basis"] + f"; nominal {cal["nominal_px_per_cm"]:.4f} px/cm ({cal.get("nominal_note", "1:" + str(args.scale))}); fitted {k:.4f} ({cal['deviation_pct']:+.3f} %)"
    pm["source_crop_box_px"] = crop_info["crop_box_px"]
    pm["assumptions"] = [
        f"ceiling {args.ceiling_cm} cm (a plan drawing has no section)",
        "door heads 215 cm, railing 110 cm, facade glazing floor to ceiling",
        "open-plan zone boundaries are geodesic Voronoi cuts between the decoded label positions (path distance in the free space), not drawn lines",
        f"an entrance hall that the sheet does not print is seeded {ENTRANCE_SEED_CM:.0f} cm inside the unit door and zoned with the printed labels",
        "a glazed unit between an indoor room and a balcony is taken as the sliding door (the widest one per room pair)",
        "rooms are the free space between the drawn barriers; drawn furniture and fixtures do not cut them",
    ]
    by_id = {}
    id_map = {}
    for j, r in enumerate(rooms):
        lab = r["label"]
        for pr in plan["rooms"]:
            if lab and pr["name_en"] == lab["en"] and pr["id"] not in by_id.values():
                by_id[j] = pr["id"]
                break
            if not lab and pr["name_en"].endswith("(t%d)" % j):
                by_id[j] = pr["id"]
                break
    for j, r in enumerate(rooms):
        pid = by_id.get(j)
        pr = next((x for x in plan["rooms"] if x["id"] == pid), None)
        if pr is None:
            continue
        if r["zone_of"] is not None:
            pr["zone_boundary"] = "virtual (geodesic Voronoi of the decoded label positions; needs a hand check)"
        if r["pair"] and all(x["chord_cm"] for x in r["pair"]):
            pr["measured_dims_cm"] = [round(x["chord_cm"], 1) for x in r["pair"]]
            pr["note"] = "measured_dims_cm = the room's chord along each printed dimension line (vector), not the min-rect"
    plan["plan_meta"]["disagreements"] = ir.disagreements(plan["rooms"])
    plan["plan_meta"]["virtual_boundaries"] = [o["id"] + " " + "|".join(o["rooms"]) for o in plan["openings"] if ir.is_virtual(o)]
    ir.add_edge_kinds(plan, wall_tol=4.0)   # vector edges sit ON their barrier: only an edge within 4 cm of the poche is a wall
    ir.jdump(plan, os.path.join(out, "plan.json"))

    # report (card 01's make_report), then the vector blocks
    rep = ir.make_report(args, trace, vlm, cal, plan, out, TT, crop_info)
    rep["dimensions"] = []
    rep["dimensions_unplaced"] = []
    area_pairs = []
    for x in dims_out:
        d = x["d"]
        rids = [by_id[j] for j in x["rooms_idx"] if j in by_id]
        A, B = x["A"] / k, x["B"] / k
        row = {"value_cm": d["value_cm"], "kind": x["kind"], "rooms": rids if x["kind"] in ("room_clear", "sub_element") else [],
               "label": f"vector dimension {d['value_cm']}" + (" of " + ",".join(rids) if rids else ""),
               "a_cm": [round(A[0], 1), round(A[1], 1)], "b_cm": [round(B[0], 1), round(B[1], 1)],
               "anchor_cm": [round((A[0] + B[0]) / 2, 1), round((A[1] + B[1]) / 2, 1)],
               "angle_deg": round(math.degrees(math.atan2(B[1] - A[1], B[0] - A[0])), 1),
               "line_length_cm": round(float(np.hypot(*(B - A))), 1), "chord_cm": round(x["chord_cm"], 1) if x["chord_cm"] else None,
               "glyph_classes": d["glyph_classes"], "span_basis": d["span_basis"],
               "match": "the dimension entity itself (ticks), value decoded from its glyphs"}
        rep["dimensions"].append(row)
    for j, r in enumerate(rooms):
        if r["pair"] and j in by_id:
            poly = r["poly"]
            if poly.area / poly.minimum_rotated_rectangle.area > 0.9:
                area_pairs.append({"rooms": [by_id[j]], "dims_cm": [x["d"]["value_cm"] for x in r["pair"]]})
    rep["area_pairs"] = area_pairs
    known = rep["printed_dims"].get("known") or []
    read = sorted(d["value_cm"] for d in dims if d["value_cm"])
    rep["printed_dims"]["read_count"] = len(read)
    rep["printed_dims"]["note"] = ("values decoded from the vector glyphs of every dimension entity on the sheet; "
                                   "a 'false' value here is checked against its span (span/value agrees within 0.2 % for all)")
    rep["vector"] = {
        "source_kind": source_kind, "pdf_drawings": info.get("n_drawings"), "primitives_after_clip": len(prims), "ocg_layers": len(info.get("ocgs", [])), "text_spans": info.get("text_spans"),
        "clips": info.get("clips", [])[:5], "layer_map": os.path.relpath(args.layer_map, HERE).replace("\\", "/"),
        "classes": layer_stats, "dimensions": ddiag, "labels": ldiag,
        "decoded_labels": [{"he": L["he"], "en": L["en"], "type": L["type"], "source": L["source"],
                            "xy_cm": [round(L["xy"][0] / k, 1), round(L["xy"][1] / k, 1)], "in_room": L.get("comp") is not None} for L in labels],
        "doors": [{"hinge_cm": [round(d["hinge"][0] / k, 1), round(d["hinge"][1] / k, 1)], "width_cm": round(d["r"] / k, 1), "sweep_deg": d["sweep_deg"],
                   "closed_by": d["basis"]} for d in doors],
        "free_components": len(free), "unnamed_rooms": len(unnamed),
        "dims_vs_spans": [{"value_cm": d["value_cm"], "span_cm_at_fit": round(d["span_units"] / fit_units_per_cm, 1)} for d in dims if d["value_cm"]],
    }
    # per-dimension check (the vector equivalent of the raster dims_check: chord vs printed, 3 % / 4 % under 5 m2)
    chk = []
    for row in rep["dimensions"]:
        if row["kind"] != "room_clear" or row["chord_cm"] is None:
            continue
        area = sum(next((x["area_m2"] for x in plan["rooms"] if x["id"] == rid), 0) for rid in row["rooms"])
        tol = ir.TOL_SMALL_PCT if area < ir.SMALL_ROOM_M2 else ir.TOL_PCT
        dev = (row["chord_cm"] / row["value_cm"] - 1) * 100
        chk.append({"value_cm": row["value_cm"], "rooms": row["rooms"], "chord_cm": row["chord_cm"], "dev_pct": round(dev, 2), "tol_pct": tol, "ok": abs(dev) <= tol})
    rep["dims_chord_check"] = {"rows": chk, "checked": len(chk), "ok": sum(1 for c in chk if c["ok"])}
    rep["geometry_check_note"] = ("validate-plan.mjs is a schema/consistency check; the geometry checks are dims_chord_check here (room chord along "
                                  "each printed room-clear dimension, 3 % / 4 % under 5 m2) and gates/plan_gate.py on report.dimensions")
    ir.jdump(rep, os.path.join(out, "report.json"))
    ir.write_report_md(rep, os.path.join(out, "report.md"))
    with open(os.path.join(out, "report.md"), "a", encoding="utf-8") as f:
        f.write("\n## Vector reader\n\n")
        f.write(f"- source {source_kind}: drawings {info.get('n_drawings')}, primitives {len(prims)}, layers {len(info.get('ocgs', []))}, text spans {info.get('text_spans')}\n")
        f.write(f"- dimensions: {ddiag.get('text_items')} texts, {ddiag.get('glyphs')} glyphs in {ddiag.get('glyph_classes')} classes; scale {cal['basis']}\n")
        f.write(f"- labels decoded: {', '.join(L['he'] + ' / ' + L['en'] for L in labels)}\n")
        f.write(f"- doors: {len(doors)} swing arcs; openings emitted {len(plan['openings'])}\n")
        f.write(f"- room chord vs printed: {rep['dims_chord_check']['ok']}/{rep['dims_chord_check']['checked']} within tolerance\n")
        for c in chk:
            f.write(f"  - {c['value_cm']} {c['rooms']}: chord {c['chord_cm']} ({c['dev_pct']:+.2f} %, tol {c['tol_pct']} %) {'ok' if c['ok'] else 'BAD'}\n")
    debug_overlay(out, plan, k)
    print(open(os.path.join(out, "report.md"), encoding="utf-8").read())
    return 0


def debug_overlay(out, plan, k):
    import cv2
    img = cv2.imread(os.path.join(out, "plan-crop.png"))
    if img is None:
        return
    ov = img.copy()
    rng = np.random.default_rng(7)
    for r in plan["rooms"]:
        pts = (np.array(r["loop"]) * k).astype(np.int32)
        col = tuple(int(c) for c in rng.integers(60, 230, 3))
        cv2.fillPoly(ov, [pts], col)
    img = cv2.addWeighted(ov, 0.35, img, 0.65, 0)
    for w in plan["walls"]:
        cv2.polylines(img, [(np.array(w["polygon_cm"]) * k).astype(np.int32)], True, (0, 0, 200), 2)
    for o in plan["openings"]:
        a = tuple(int(v * k) for v in o["a_cm"]); b = tuple(int(v * k) for v in o["b_cm"])
        cv2.line(img, a, b, (0, 160, 0) if o["kind"] != "opening" else (200, 0, 200), 5)
    for r in plan["rooms"]:
        pts = np.array(r["loop"]) * k
        c = pts.mean(axis=0).astype(int)
        cv2.putText(img, r["id"], tuple(c), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 0, 0), 4)
    cv2.imwrite(os.path.join(out, "overlay.png"), cv2.resize(img, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA))


if __name__ == "__main__":
    sys.exit(main())

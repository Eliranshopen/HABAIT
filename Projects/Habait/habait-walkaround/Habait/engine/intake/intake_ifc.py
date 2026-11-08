#!/usr/bin/env python
"""intake_ifc.py <model.ifc> --out <dir> [options]

Lane A / A3 (board habait-workplan-2026-11-02, card 06): an IFC model -> the SAME plan.json + report.json /
report.md + plan-crop.png as the raster, vector-PDF and DXF readers. IfcOpenShell (pip ifcopenshell==0.9.0.post1,
installed in habait-venv 2026-11-02) tessellates every product in world coordinates; each product's plan footprint
(the union of its triangles projected on XY) becomes a primitive and the shared geometry half
(intake_pdf_vector.assemble) does the rest:

  IfcWall / IfcWallStandardCase / IfcCurtainWall(no) / IfcColumn / IfcMember  -> wall poche (fill)
  IfcSpace                       -> rooms as drawn (room_polys); LongName (else Name) matched to lexicon_he.json
  IfcWindow                      -> glazing (outline)
  IfcRailing                     -> railing (outline)
  IfcDoor                        -> a swing door: hinge and closed end = the ends of the footprint's long axis
                                    (IFC rarely carries the 2D swing; the leaf side is not known, so the door
                                    closure is all the room segmentation needs)
  IfcSlab, furniture, the rest   -> ignored

Storey: --storey <name or elevation in m>; default = the storey holding the most IfcSpaces. Units: the geometry
kernel returns SI metres; plan.json is cm. No dimensions in IFC: the scale is the model's own (exact), the
printed-dimension checks have nothing to check."""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time

import numpy as np
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import intake_dwg as idwg  # noqa: E402  (match_label)
import intake_pdf_vector as ipv  # noqa: E402
import vector_common as vc  # noqa: E402

WALLISH = ("IfcWall", "IfcWallStandardCase", "IfcColumn", "IfcMember", "IfcPlate")


def log(*a):
    print(*a, flush=True)


def footprint(shape):
    """plan footprint (cm, y down) of a tessellated product: union of its triangles projected on XY."""
    v = np.array(shape.geometry.verts, float).reshape(-1, 3)
    fcs = np.array(shape.geometry.faces, int).reshape(-1, 3)
    tris = []
    for a, b, c in fcs:
        P = v[[a, b, c], :2] * 100.0
        P[:, 1] *= -1.0                                  # IFC is y-up
        area = 0.5 * abs((P[1, 0] - P[0, 0]) * (P[2, 1] - P[0, 1]) - (P[2, 0] - P[0, 0]) * (P[1, 1] - P[0, 1]))
        if area > 1e-3:
            tris.append(Polygon(P))
    if not tris:
        return None, None
    z = (v[:, 2].min() * 100.0, v[:, 2].max() * 100.0)
    return unary_union([t.buffer(0.01) for t in tris]).buffer(-0.01), z


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ifc")
    ap.add_argument("--out", required=True)
    ap.add_argument("--storey", default=None)
    ap.add_argument("--lexicon", default=os.path.join(HERE, "lexicon_he.json"))
    ap.add_argument("--px-per-cm", type=float, default=2.25)
    ap.add_argument("--apartment-id", default=None)
    ap.add_argument("--ceiling-cm", type=float, default=290)
    ap.add_argument("--rights-state", default="partner-supplied")
    ap.add_argument("--rights-note", default="")
    ap.add_argument("--known-dims", default=None)
    ap.add_argument("--ground-truth", default=None)
    ap.add_argument("--margin-cm", type=float, default=60.0)
    ap.add_argument("--close-px", type=float, default=4.0)
    args = ap.parse_args(argv)
    import ifcopenshell
    import ifcopenshell.geom
    import ifcopenshell.util.element as ue

    out = args.out
    os.makedirs(out, exist_ok=True)
    TT = {}
    t0 = time.time()
    f = ifcopenshell.open(args.ifc)
    storeys = f.by_type("IfcBuildingStorey")

    def storey_of(e):
        c = ue.get_container(e)
        if c is None and e.is_a("IfcSpace"):
            c = ue.get_aggregate(e)
        return c

    if args.storey:
        st = next((s for s in storeys if s.Name == args.storey or str(getattr(s, "Elevation", "")) == args.storey), None)
    else:
        cnt = {}
        for sp in f.by_type("IfcSpace"):
            s = storey_of(sp)
            if s is not None:
                cnt[s.id()] = cnt.get(s.id(), 0) + 1
        st = f.by_id(max(cnt, key=cnt.get)) if cnt else (storeys[0] if storeys else None)
    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords", True)
    prims, room_polys, labels = [], [], []
    counts, skipped = {}, 0
    lex = json.load(open(args.lexicon, encoding="utf-8"))["rooms"]
    door_prims = []
    for e in f.by_type("IfcProduct"):
        cls = e.is_a()
        if not e.Representation or cls in ("IfcSite", "IfcBuilding", "IfcBuildingStorey"):
            continue
        if st is not None and storey_of(e) is not None and storey_of(e).id() != st.id():
            continue
        if not (cls in WALLISH or cls in ("IfcSpace", "IfcWindow", "IfcRailing", "IfcDoor")):
            skipped += 1
            continue
        try:
            sh = ifcopenshell.geom.create_shape(settings, e)
        except Exception:
            skipped += 1
            continue
        fp, z = footprint(sh)
        if fp is None or fp.is_empty:
            continue
        counts[cls] = counts.get(cls, 0) + 1
        if cls in WALLISH:
            prims.append(vc.Prim(layer=cls, kind="fill", width=0.0, color=None, fill=(0.5, 0.5, 0.5), geom=fp,
                                 cls="column" if cls == "IfcColumn" else "wall_fill"))
        elif cls == "IfcSpace":
            q = max(ipv.as_polys(fp), key=lambda g: g.area)
            room_polys.append(q)
            name = getattr(e, "LongName", None) or e.Name or ""
            m = idwg.match_label(name, lex)
            if m:
                c = vc.pole(q, tol=2.0)
                labels.append({"xy_src": (c.x, c.y), "he": m["he"], "en": m["en"], "type": m["type"], "source": "IfcSpace name, " + m["source"]})
        elif cls in ("IfcWindow", "IfcRailing"):
            for q in ipv.as_polys(fp):
                prims.append(vc.Prim(layer=cls, kind="stroke", width=0.0, color=None, fill=None, geom=q.exterior,
                                     cls="window" if cls == "IfcWindow" else "railing"))
        elif cls == "IfcDoor":
            q = max(ipv.as_polys(fp), key=lambda g: g.area)
            mr = q.minimum_rotated_rectangle
            cc = list(mr.exterior.coords)
            e1, e2 = np.array(cc[1]) - np.array(cc[0]), np.array(cc[2]) - np.array(cc[1])
            if np.hypot(*e1) >= np.hypot(*e2):
                A, B = (np.array(cc[0]) + np.array(cc[3])) / 2, (np.array(cc[1]) + np.array(cc[2])) / 2
            else:
                A, B = (np.array(cc[0]) + np.array(cc[1])) / 2, (np.array(cc[3]) + np.array(cc[2])) / 2
            w = float(np.hypot(*(B - A)))
            u = (B - A) / w
            n = np.array([-u[1], u[0]])
            # a synthetic swing (hinge A, closed end B, open leaf along +n) so the shared door finder applies
            ts = np.linspace(0, math.pi / 2, 12)
            arc = [tuple(A + w * (math.cos(t) * u + math.sin(t) * n)) for t in ts]
            door_prims.append(vc.Prim(layer=cls, kind="stroke", width=0.0, color=None, fill=None, geom=LineString(arc), curves=1, cls="door"))
            door_prims.append(vc.Prim(layer=cls, kind="stroke", width=0.0, color=None, fill=None,
                                      geom=LineString([tuple(A), tuple(A + w * n)]), cls="door"))
    prims += door_prims
    TT["read"] = round(time.time() - t0, 1)
    log(f"storey {st.Name if st is not None else None}: {counts}, skipped {skipped}; {len(room_polys)} spaces, {len(labels)} named")
    k = args.px_per_cm
    bb = np.array([p.geom.bounds for p in prims] + [r.bounds for r in room_polys])
    x0, y0 = bb[:, 0].min() - args.margin_cm, bb[:, 1].min() - args.margin_cm
    x1, y1 = bb[:, 2].max() + args.margin_cm, bb[:, 3].max() + args.margin_cm
    W, H = int(math.ceil((x1 - x0) * k)), int(math.ceil((y1 - y0) * k))
    T = np.array([[k, 0, -x0 * k], [0, k, -y0 * k]])
    import cv2
    cv2.imwrite(os.path.join(out, "plan-crop.png"), vc.render_prims(prims, T, W, H, thick=1, fill_grey=0.55))
    layer_stats = vc.classify_all(prims, vc.LayerMap({"classes": {}, "order": []}))
    for p in prims:                                       # classify_all reset them to 'unmapped': restore
        p.cls = {"IfcColumn": "column", "IfcWindow": "window", "IfcRailing": "railing", "IfcDoor": "door"}.get(p.layer, "wall_fill")
    layer_stats = {c: {"prims": sum(1 for p in prims if p.cls == c), "layers": sorted({p.layer for p in prims if p.cls == c})} for c in {p.cls for p in prims}}
    layer_stats["room_boundary"] = {"prims": len(room_polys), "layers": ["IfcSpace"]}
    info = {"n_drawings": sum(counts.values()), "entity_counts": counts, "ocgs": sorted(counts), "text_spans": len(labels), "clips": [],
            "schema": f.schema, "storey": st.Name if st is not None else None}
    crop_info = {"crop_box_px": [0, 0, W, H], "how": f"model extents + {args.margin_cm:.0f} cm, rendered at {k} px/cm", "model_origin_cm": [round(x0, 2), round(y0, 2)]}
    cal = {"px_per_cm": k, "nominal_px_per_cm": k, "deviation_pct": 0.0, "nominal_note": "IFC SI geometry (exact)",
           "basis": "the model's own units (IfcOpenShell returns SI metres); IFC carries no printed dimensions to check against",
           "samples": [], "rooms_used": []}
    args.pdf = args.ifc
    args.scale = None
    args.dpi = None
    args.vlm_json = None
    args.tour_crop_box_px = None
    args.layer_map = "(IFC classes)"
    return ipv.assemble(args, out, prims, info, layer_stats, T, k, W, H, crop_info, cal, [], {"note": "IFC has no dimension entities"},
                        labels, {"spaces": len(room_polys), "named": len(labels)}, {}, TT, fit_units_per_cm=1.0,
                        room_polys=room_polys or None, source_kind="IFC")


if __name__ == "__main__":
    sys.exit(main())

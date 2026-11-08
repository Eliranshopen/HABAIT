#!/usr/bin/env python
"""intake_dwg.py <plan.dxf|plan.dwg> --out <dir> [options]

Lane A / A3 (board habait-workplan-2026-11-02, card 06): a CAD plan (DXF; DWG through the ODA File Converter when
it is installed) -> the SAME plan.json + report.json / report.md + plan-crop.png as intake_raster.py and
intake_pdf_vector.py. The geometry half is shared with the vector-PDF reader (intake_pdf_vector.assemble), so the
three intake paths differ only in how they get primitives, labels and dimensions:

  DXF entity            -> primitive / fact
  LINE, LWPOLYLINE,      -> strokes (y flipped: DXF is y-up, plan.json is y-down), in the drawing's units -> cm
  POLYLINE, ARC, CIRCLE,
  SPLINE, ELLIPSE
  HATCH, SOLID          -> fills (the wall poche)
  INSERT                -> exploded (virtual_entities), nested blocks too; layer '0' inherits the INSERT's layer
  TEXT, MTEXT           -> room labels: the string is matched to lexicon_he.json (exact, then contained)
  DIMENSION             -> printed dimensions: the override text when numeric, else the measurement; the two
                           measured points (defpoint2/defpoint3) are the line
  closed polylines on a room_boundary layer -> rooms as drawn (no free-space segmentation, no Voronoi zones);
                           without such a layer the reader segments free space like the PDF reader

Layer semantics come from a per-office JSON map (layer_maps/*.json format; fixtures/sample.layers.json for the
sample). Units from $INSUNITS (mm/cm/m/in/ft), override with --units-cm.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

import numpy as np
from shapely.geometry import LineString, MultiLineString, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import intake_pdf_vector as ipv  # noqa: E402
import vector_common as vc  # noqa: E402

INSUNITS_CM = {1: 2.54, 2: 30.48, 4: 0.1, 5: 1.0, 6: 100.0, 14: 10.0}
HEB = re.compile(r"[^א-ת ]")


def log(*a):
    print(*a, flush=True)


def dwg_to_dxf(path, oda=None):
    """DWG -> DXF with the ODA File Converter (free, closed source; not bundled). Returns the DXF path or raises."""
    exe = oda or shutil.which("ODAFileConverter") or shutil.which("ODAFileConverter.exe")
    for cand in (r"C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe",):
        if not exe and os.path.exists(cand):
            exe = cand
    if not exe:
        raise RuntimeError("a .dwg needs the ODA File Converter (https://www.opendesign.com/guestfiles/oda_file_converter): "
                           "install it or pass --oda <exe>, or save the drawing as DXF")
    src_dir = tempfile.mkdtemp(prefix="dwg_in_")
    out_dir = tempfile.mkdtemp(prefix="dwg_out_")
    shutil.copy(path, src_dir)
    subprocess.run([exe, src_dir, out_dir, "ACAD2018", "DXF", "0", "1", "*.DWG"], check=True, timeout=300)
    dxf = os.path.join(out_dir, os.path.splitext(os.path.basename(path))[0] + ".dxf")
    if not os.path.exists(dxf):
        raise RuntimeError("ODA File Converter produced no DXF")
    return dxf


def flat_points(e, dist):
    from ezdxf import path as ezpath
    try:
        p = ezpath.make_path(e)
    except Exception:
        return []
    subs = list(p.sub_paths()) if p.has_sub_paths else [p]
    out = []
    for sp in subs:
        pts = [(v.x, v.y) for v in sp.flattening(dist)]
        if len(pts) >= 2:
            out.append(pts)
    return out


def iter_entities(msp):
    """modelspace entities with INSERTs exploded (recursively); yields (entity, effective_layer)."""
    def walk(ents, parent_layer, depth):
        for e in ents:
            t = e.dxftype()
            lay = e.dxf.get("layer", "0")
            if lay == "0" and parent_layer:
                lay = parent_layer
            if t == "INSERT" and depth < 8:
                try:
                    yield from walk(list(e.virtual_entities()), lay, depth + 1)
                except Exception:
                    continue
            else:
                yield e, lay
    yield from walk(list(msp), None, 0)


def read_dxf(path, lmap, units_cm=None, flat_cm=2.0):
    import ezdxf
    from ezdxf import recover

    try:
        doc = ezdxf.readfile(path)
    except Exception:
        doc, _aud = recover.readfile(path)
    msp = doc.modelspace()
    ins = int(doc.header.get("$INSUNITS", 0) or 0)
    ucm = units_cm or INSUNITS_CM.get(ins)
    if not ucm:
        ucm = 1.0
        log(f"$INSUNITS={ins}: unknown, assuming centimetres (pass --units-cm)")
    prims, texts, dims, rooms = [], [], [], []
    counts = {}

    def cm(pts):
        return [(x * ucm, -y * ucm) for x, y in pts]             # y flip: DXF is y-up

    for e, lay in iter_entities(msp):
        t = e.dxftype()
        counts[t] = counts.get(t, 0) + 1
        cls = lmap.classify_layer(lay)
        if cls == "ignore":
            continue
        if t in ("TEXT", "MTEXT"):
            s = e.plain_text() if t == "MTEXT" else e.dxf.text
            ip = e.dxf.insert
            texts.append({"text": s, "xy": (ip.x * ucm, -ip.y * ucm), "layer": lay, "cls": cls})
            continue
        if t == "DIMENSION":
            try:
                meas = float(e.get_measurement())
            except Exception:
                meas = None
            txt = (e.dxf.get("text", "") or "").strip()
            val = None
            if txt and txt not in ("<>", " "):
                m = re.search(r"\d+(\.\d+)?", txt.replace("<>", ""))
                if m:
                    val = float(m.group(0))
            p2, p3 = e.dxf.get("defpoint2"), e.dxf.get("defpoint3")
            if p2 is None or p3 is None or (meas is None and val is None):
                continue
            a, b = (p2.x * ucm, -p2.y * ucm), (p3.x * ucm, -p3.y * ucm)
            span = math.hypot(b[0] - a[0], b[1] - a[1])
            v_cm = round((val if val is not None else meas) * ucm)
            dims.append({"value_cm": int(v_cm), "span_units": span, "nominal_cm": round(span, 1), "a": list(a), "b": list(b),
                         "text_center": [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], "angle_deg": round(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180, 2),
                         "glyph_classes": None, "span_basis": "DIMENSION defpoints" + (" (override text)" if val is not None else ""), "layer": lay})
            continue
        if t in ("HATCH", "SOLID"):
            polys = []
            if t == "HATCH":
                from ezdxf import path as ezpath
                for pth in ezpath.from_hatch(e):
                    pts = [(v.x, v.y) for v in pth.flattening(flat_cm / ucm)]
                    if len(pts) >= 3:
                        polys.append(Polygon(cm(pts)).buffer(0))
            else:
                v = [e.dxf.vtx0, e.dxf.vtx1, e.dxf.vtx3, e.dxf.vtx2]
                polys.append(Polygon(cm([(p.x, p.y) for p in v])).buffer(0))
            g = unary_union([p for p in polys if not p.is_empty])
            if not g.is_empty:
                prims.append(vc.Prim(layer=lay, kind="fill", width=0.0, color=None, fill=(0.5, 0.5, 0.5), geom=g, cls=cls))
            continue
        runs = flat_points(e, flat_cm / ucm)
        if not runs:
            continue
        runs = [cm(r) for r in runs]
        closed = bool(getattr(e, "closed", False) or (t == "LWPOLYLINE" and e.closed) or (t == "CIRCLE"))
        if cls == "room_boundary":
            for r in runs:
                if len(r) >= 3:
                    rooms.append(Polygon(r).buffer(0))
            continue
        geom = LineString(runs[0]) if len(runs) == 1 else MultiLineString([LineString(r) for r in runs])
        prims.append(vc.Prim(layer=lay, kind="stroke", width=0.0, color=None, fill=None, geom=geom,
                             curves=1 if t in ("ARC", "CIRCLE", "ELLIPSE", "SPLINE") else 0, closed=closed, cls=cls))
    info = {"n_drawings": sum(counts.values()), "entity_counts": counts, "ocgs": sorted({l.dxf.name for l in doc.layers}),
            "text_spans": len(texts), "clips": [], "insunits": ins, "units_cm": ucm, "dxfversion": doc.dxfversion}
    return prims, texts, dims, rooms, info


def match_label(s, lex):
    n = re.sub(r"\s+", " ", HEB.sub(" ", s or "")).strip()
    if not n:
        return None
    for c in lex:
        if n == c["he"]:
            return dict(c, source="lexicon (exact)")
    best = None
    for c in lex:
        if c["he"] in n and (best is None or len(c["he"]) > len(best["he"])):
            best = c
    if best:
        return {"he": s.strip(), "en": best["en"], "type": best["type"], "source": f"lexicon (contains '{best['he']}')"}
    return None


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cad")
    ap.add_argument("--out", required=True)
    ap.add_argument("--layer-map", default=None, help="default: <cad stem>.layers.json next to the file, else layer_maps/aia.json")
    ap.add_argument("--lexicon", default=os.path.join(HERE, "lexicon_he.json"))
    ap.add_argument("--px-per-cm", type=float, default=2.25, help="raster frame of plan-crop.png (the tour's 2.25 by default)")
    ap.add_argument("--units-cm", type=float, default=None, help="centimetres per drawing unit (overrides $INSUNITS)")
    ap.add_argument("--oda", default=None, help="ODA File Converter executable, for .dwg")
    ap.add_argument("--apartment-id", default=None)
    ap.add_argument("--ceiling-cm", type=float, default=290)
    ap.add_argument("--rights-state", default="partner-supplied")
    ap.add_argument("--rights-note", default="")
    ap.add_argument("--known-dims", default=None)
    ap.add_argument("--ground-truth", default=None)
    ap.add_argument("--margin-cm", type=float, default=60.0)
    ap.add_argument("--close-px", type=float, default=4.0)
    args = ap.parse_args(argv)
    out = args.out
    os.makedirs(out, exist_ok=True)
    TT = {}
    t0 = time.time()
    cad = args.cad
    if cad.lower().endswith(".dwg"):
        cad = dwg_to_dxf(cad, args.oda)
    if not args.layer_map:
        cand = os.path.splitext(args.cad)[0] + ".layers.json"
        args.layer_map = cand if os.path.exists(cand) else os.path.join(HERE, "layer_maps", "dblk.json")
    lmap = vc.LayerMap(args.layer_map)
    prims, texts, dims, room_polys, info = read_dxf(cad, lmap, args.units_cm)
    layer_stats = vc.classify_all(prims, lmap)
    for c_ in ("room_boundary",):
        if room_polys:
            layer_stats[c_] = {"prims": len(room_polys), "layers": sorted({l for l in info["ocgs"] if lmap.classify_layer(l) == c_})}
    TT["read"] = round(time.time() - t0, 1)
    log(f"{info['n_drawings']} entities ({info['entity_counts']}), units {info['units_cm']} cm, {len(prims)} primitives, "
        f"{len(texts)} texts, {len(dims)} dimensions, {len(room_polys)} room boundaries")
    # frame: drawing cm (y down) -> crop px
    k = args.px_per_cm
    bb = np.array([p.geom.bounds for p in prims if p.cls in ("wall_fill", "wall_line", "column", "window", "door", "railing")] +
                  [r.bounds for r in room_polys])
    if not len(bb):
        log("no building layers found: check the layer map")
        return 2
    x0, y0 = bb[:, 0].min() - args.margin_cm, bb[:, 1].min() - args.margin_cm
    x1, y1 = bb[:, 2].max() + args.margin_cm, bb[:, 3].max() + args.margin_cm
    W, H = int(math.ceil((x1 - x0) * k)), int(math.ceil((y1 - y0) * k))
    T = np.array([[k, 0, -x0 * k], [0, k, -y0 * k]])
    crop_info = {"crop_box_px": [0, 0, W, H], "how": f"drawing extents + {args.margin_cm:.0f} cm, rendered at {k} px/cm",
                 "drawing_origin_cm": [round(x0, 2), round(y0, 2)]}
    import cv2
    img = vc.render_prims([p for p in prims if p.cls not in ("ignore",)], T, W, H, thick=1, fill_grey=0.55)
    cv2.imwrite(os.path.join(out, "plan-crop.png"), img)
    # labels from TEXT
    lex = json.load(open(args.lexicon, encoding="utf-8"))["rooms"]
    labels, unread = [], []
    for t in texts:
        if t["cls"] != "text":
            continue
        m = match_label(t["text"], lex)
        if m:
            labels.append({"xy_src": t["xy"], "he": m["he"], "en": m["en"], "type": m["type"], "source": m["source"]})
        else:
            unread.append(t["text"])
    ldiag = {"texts": len(texts), "labels": len(labels), "unmatched_texts": unread[:20]}
    # calibration: the DXF carries its units, the dimensions are a check
    samples = [{"value_cm": d["value_cm"], "span_cm_nominal": round(d["span_units"], 1),
                "ratio_vs_nominal": round(d["span_units"] / d["value_cm"], 5) if d["value_cm"] else None,
                "used": bool(d["value_cm"]) and abs(d["span_units"] / d["value_cm"] - 1) <= 0.03} for d in dims]
    cal = {"px_per_cm": k, "nominal_px_per_cm": k, "deviation_pct": 0.0, "nominal_note": f"DXF $INSUNITS={info['insunits']} -> {info['units_cm']} cm/unit",
           "basis": (f"drawing units from the DXF header ($INSUNITS={info['insunits']}, {info['units_cm']} cm/unit); "
                     f"{sum(s['used'] for s in samples)}/{len(samples)} DIMENSION values agree with their defpoint span within 3 %"),
           "samples": samples, "rooms_used": []}
    ddiag = {"dimension_entities": len(dims), "values": sorted(d["value_cm"] for d in dims)}
    unit = {}
    args.pdf = args.cad                  # the shared emitters name the source file 'pdf'
    args.scale = None
    args.dpi = None
    args.vlm_json = None
    args.tour_crop_box_px = None
    return ipv.assemble(args, out, prims, info, layer_stats, T, k, W, H, crop_info, cal, dims, ddiag, labels, ldiag, unit, TT,
                        fit_units_per_cm=1.0, room_polys=room_polys or None, source_kind="DXF")


if __name__ == "__main__":
    sys.exit(main())

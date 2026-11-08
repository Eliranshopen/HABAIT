"""vector_common.py - shared core of the vector intake readers (PDF vector art and DXF).

Lane A / A3 (board habait-workplan-2026-11-02, card 06). Generic: nothing here names a project.

What lives here:
  * Prim                one drawn primitive in SHEET space (PDF points for a PDF, drawing units for a DXF), with
                        its CAD layer, style and a shapely geometry (lines flattened, fills as polygons) already
                        clipped to the visible region.
  * pdf_primitives()    pymupdf get_drawings(extended=True) -> [Prim], honouring the clip stack (a sales sheet is
                        often a viewport of the whole floor, the neighbours hidden by a polygon clip) and the
                        optional-content groups (= the CAD layers, kept by most CAD PDF exporters).
  * LayerMap            per-developer JSON: regex on the layer name -> a semantic class (wall_fill, wall_line,
                        column, window, door, dimension, text, furniture, plumbing, slab_edge, ignore ...), with a
                        style fallback when a PDF carries no layers.
  * glyph tools         outlined text (CAD fonts exported as strokes/fills): group strokes into glyphs and lines,
                        shape-cluster glyphs (same font -> same geometry), decode digits.
  * render helpers      a primitive list -> a PNG in the 288-dpi raster frame the raster path uses, so the
                        correction screen (card 02) and plan_gate (card 05) see the same frame.

Units: everything returned is in the source units; the readers convert to the raster px frame (288 dpi crop,
same as intake_raster.py) and from there to cm through the fitted scale, then call intake_raster's emitters
so plan.json / report.json are byte-for-byte the same format.
"""
from __future__ import annotations

import json
import math
import os
import re
from dataclasses import dataclass, field

import numpy as np
from shapely.geometry import LineString, MultiLineString, Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))

# --------------------------------------------------------------------------------------------- primitives


@dataclass
class Prim:
    layer: str
    kind: str                    # "stroke" | "fill"
    width: float                 # stroke width in source units (0 = hairline)
    color: tuple | None
    fill: tuple | None
    geom: object                 # shapely: LineString / MultiLineString / Polygon / MultiPolygon (clipped)
    curves: int = 0              # number of bezier / arc items in the source path (door swings are curves)
    closed: bool = False
    seq: int = 0
    cls: str = "unknown"         # semantic class from the LayerMap
    meta: dict = field(default_factory=dict)


def _bezier(p0, p1, p2, p3, n=10):
    t = np.linspace(0.0, 1.0, n + 1)[:, None]
    a, b, c, d = (np.array([p.x, p.y]) for p in (p0, p1, p2, p3))
    return ((1 - t) ** 3) * a + 3 * ((1 - t) ** 2) * t * b + 3 * (1 - t) * t * t * c + (t ** 3) * d


def _items_to_polylines(items):
    """pymupdf drawing items -> list of point arrays (each a continuous run) and the number of curve items."""
    runs, cur, curves = [], [], 0

    def push(pts):
        nonlocal cur
        if cur and np.hypot(*(np.array(cur[-1]) - pts[0])) < 1e-6:
            cur.extend([tuple(p) for p in pts[1:]])
        else:
            if len(cur) >= 2:
                runs.append(np.array(cur))
            cur = [tuple(p) for p in pts]

    for it in items:
        op = it[0]
        if op == "l":
            push(np.array([[it[1].x, it[1].y], [it[2].x, it[2].y]]))
        elif op == "c":
            curves += 1
            push(_bezier(it[1], it[2], it[3], it[4]))
        elif op == "re":
            r = it[1]
            push(np.array([[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1], [r.x0, r.y0]]))
        elif op == "qu":
            q = it[1]
            push(np.array([[q.ul.x, q.ul.y], [q.ur.x, q.ur.y], [q.lr.x, q.lr.y], [q.ll.x, q.ll.y], [q.ul.x, q.ul.y]]))
    if len(cur) >= 2:
        runs.append(np.array(cur))
    return runs, curves


def _runs_to_polygon(runs):
    polys = []
    for r in runs:
        if len(r) >= 3:
            p = Polygon(r)
            if not p.is_valid:
                p = p.buffer(0)
            if not p.is_empty and p.area > 0:
                polys.append(p)
    if not polys:
        return None
    return unary_union(polys) if len(polys) > 1 else polys[0]


def pdf_primitives(pdf_path: str, page: int = 0):
    """All drawn primitives of a PDF page, clipped to the active clip stack.

    Returns (prims, info) where info has page_rect (w, h in pt), the clip polygons and the OCG (layer) names."""
    import pymupdf

    doc = pymupdf.open(pdf_path)
    pg = doc[page]
    drawings = pg.get_drawings(extended=True)
    clip_stack: dict[int, object] = {}
    clips, prims = [], []
    page_box = box(0, 0, pg.rect.width, pg.rect.height)
    for seq, d in enumerate(drawings):
        lvl = d.get("level", 0)
        if d["type"] == "clip":
            for k in [k for k in clip_stack if k >= lvl]:
                del clip_stack[k]
            runs, _ = _items_to_polylines(d["items"])
            poly = _runs_to_polygon(runs)
            if poly is None:
                sc = d.get("scissor")
                poly = box(sc.x0, sc.y0, sc.x1, sc.y1) if sc is not None else page_box
            sc = d.get("scissor")
            if sc is not None:
                poly = poly.intersection(box(sc.x0, sc.y0, sc.x1, sc.y1))
            clip_stack[lvl] = poly
            clips.append({"level": lvl, "area": poly.area, "bounds": [round(v, 1) for v in poly.bounds],
                          "is_page": poly.area >= 0.9 * page_box.area})
            continue
        for k in [k for k in clip_stack if k >= lvl]:
            del clip_stack[k]
        active = None
        for k in sorted(clip_stack):
            active = clip_stack[k] if active is None else active.intersection(clip_stack[k])
        runs, curves = _items_to_polylines(d["items"])
        if not runs:
            continue
        is_fill = d["type"] in ("f", "fs")
        if is_fill:
            geom = _runs_to_polygon(runs)
            if geom is None:
                continue
        else:
            geom = LineString(runs[0]) if len(runs) == 1 else MultiLineString([LineString(r) for r in runs])
        if active is not None and not active.contains(geom):
            geom = geom.intersection(active)
            if geom.is_empty:
                continue
        prims.append(Prim(layer=d.get("layer") or "", kind="fill" if is_fill else "stroke",
                          width=float(d.get("width") or 0.0), color=tuple(d["color"]) if d.get("color") else None,
                          fill=tuple(d["fill"]) if d.get("fill") else None, geom=geom, curves=curves,
                          closed=bool(d.get("closePath")), seq=seq))
    info = {"page_w": pg.rect.width, "page_h": pg.rect.height, "clips": clips,
            "ocgs": sorted({v["name"] for v in doc.get_ocgs().values()}) if doc.get_ocgs() else [],
            "text_spans": sum(len(l["spans"]) for b in pg.get_text("dict")["blocks"] if b.get("type") == 0 for l in b["lines"]),
            "n_drawings": len(drawings)}
    return prims, info


# --------------------------------------------------------------------------------------------- layer map


class LayerMap:
    """{"classes": {"wall_fill": ["regex", ...], ...}, "style_fallback": [...], "order": [...]}.

    A layer is matched against the classes in "order" (first hit wins), case-insensitive, against the layer name
    with any xref prefix ("<xref>|LAYER") kept, so a pattern may target either part."""

    def __init__(self, path_or_dict):
        if isinstance(path_or_dict, str):
            with open(path_or_dict, encoding="utf-8") as f:
                self.cfg = json.load(f)
            self.path = path_or_dict
        else:
            self.cfg, self.path = path_or_dict, None
        self.order = self.cfg.get("order") or list(self.cfg["classes"].keys())
        self.rx = {c: [re.compile(p, re.I) for p in self.cfg["classes"].get(c, [])] for c in self.order}
        self._cache: dict[str, str] = {}

    def classify_layer(self, layer: str) -> str:
        if layer in self._cache:
            return self._cache[layer]
        hit = "unmapped"
        for c in self.order:
            if any(r.search(layer) for r in self.rx[c]):
                hit = c
                break
        self._cache[layer] = hit
        return hit

    def classify(self, p: Prim) -> str:
        if p.layer:
            return self.classify_layer(p.layer)
        for rule in self.cfg.get("style_fallback", []):
            if rule.get("kind") and rule["kind"] != p.kind:
                continue
            if "fill_grey" in rule and not (p.fill and abs(p.fill[0] - rule["fill_grey"]) < 0.02):
                continue
            if "min_width" in rule and p.width < rule["min_width"]:
                continue
            if "max_width" in rule and p.width > rule["max_width"]:
                continue
            return rule["cls"]
        return "unmapped"


def classify_all(prims, lmap: LayerMap):
    stats = {}
    for p in prims:
        p.cls = lmap.classify(p)
        s = stats.setdefault(p.cls, {"prims": 0, "layers": set()})
        s["prims"] += 1
        s["layers"].add(p.layer)
    return {k: {"prims": v["prims"], "layers": sorted(v["layers"])} for k, v in stats.items()}


# --------------------------------------------------------------------------------------------- geometry helpers


def lines_of(geom):
    """Every 2-point segment of a (Multi)LineString / Polygon boundary as ((x0, y0), (x1, y1))."""
    out = []
    if geom.is_empty:
        return out
    if geom.geom_type in ("Polygon", "MultiPolygon"):
        geom = geom.boundary
    parts = getattr(geom, "geoms", [geom])
    for g in parts:
        if g.geom_type in ("LineString", "LinearRing"):
            c = list(g.coords)
            out.extend(zip(c[:-1], c[1:]))
        elif hasattr(g, "geoms"):
            out.extend(lines_of(g))
    return out


def seg_len(s):
    return math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1])


def seg_angle(s):
    """direction in degrees, folded to [0, 180)."""
    return math.degrees(math.atan2(s[1][1] - s[0][1], s[1][0] - s[0][0])) % 180.0


def min_rect(poly):
    """(size_long, size_short, angle_deg of the long side) of the minimum rotated rectangle."""
    mr = poly.minimum_rotated_rectangle
    c = list(mr.exterior.coords)
    e1 = math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1])
    e2 = math.hypot(c[2][0] - c[1][0], c[2][1] - c[1][1])
    if e1 >= e2:
        ang = math.degrees(math.atan2(c[1][1] - c[0][1], c[1][0] - c[0][0]))
        return e1, e2, ang
    ang = math.degrees(math.atan2(c[2][1] - c[1][1], c[2][0] - c[1][0]))
    return e2, e1, ang


def pole(poly, tol=1.0):
    """an interior point far from the boundary (polylabel when available)."""
    try:
        from shapely.ops import polylabel
        return polylabel(poly, tolerance=tol)
    except Exception:  # pragma: no cover
        return poly.representative_point()


# --------------------------------------------------------------------------------------------- outlined text

def group_glyph_strokes(prims, gap):
    """Strokes of an outlined-text layer -> clusters (glyph candidates) by bbox proximity <= gap (source units)."""
    items = [(p, p.geom.bounds) for p in prims if not p.geom.is_empty]
    n = len(items)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    bb = np.array([b for _, b in items]) if items else np.zeros((0, 4))
    for i in range(n):
        x0, y0, x1, y1 = bb[i]
        m = (bb[:, 0] <= x1 + gap) & (bb[:, 2] >= x0 - gap) & (bb[:, 1] <= y1 + gap) & (bb[:, 3] >= y0 - gap)
        for j in np.nonzero(m)[0]:
            if j > i:
                a, b = find(i), find(int(j))
                if a != b:
                    parent[b] = a
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(items[i][0])
    return list(groups.values())


def glyph_signature(segs, angle_deg, size=24):
    """A rotation-normalised raster of a glyph's segments (rotated by -angle so the text baseline is +x)."""
    import cv2
    if not segs:
        return None
    a = math.radians(-angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    pts = np.array([p for s in segs for p in s], float)
    c = pts.mean(axis=0)
    R = np.array([[ca, -sa], [sa, ca]])
    rs = [((np.array(s[0]) - c) @ R.T, (np.array(s[1]) - c) @ R.T) for s in segs]
    allp = np.array([p for s in rs for p in s])
    x0, y0 = allp.min(axis=0)
    x1, y1 = allp.max(axis=0)
    h = max(y1 - y0, 1e-6)
    img = np.zeros((size, size), np.uint8)
    sc = (size - 4) / max(h, x1 - x0, 1e-6)
    ox = 2 + ((size - 4) - (x1 - x0) * sc) / 2
    oy = 2 + ((size - 4) - (y1 - y0) * sc) / 2
    for p, q in rs:
        P = (int(round((p[0] - x0) * sc + ox)), int(round((p[1] - y0) * sc + oy)))
        Q = (int(round((q[0] - x0) * sc + ox)), int(round((q[1] - y0) * sc + oy)))
        cv2.line(img, P, Q, 255, 2)
    return img, (x1 - x0), (y1 - y0)


# --------------------------------------------------------------------------------------------- rendering

def render_prims(prims, T, W, H, classes=None, thick=None, fill_grey=None):
    """Draw primitives (source units) through affine T (2x3, source -> px) on a white W x H grey image."""
    import cv2
    img = np.full((H, W), 255, np.uint8)
    for p in prims:
        if classes and p.cls not in classes:
            continue
        g = p.geom
        if p.kind == "fill" and g.geom_type in ("Polygon", "MultiPolygon"):
            for poly in getattr(g, "geoms", [g]):
                ext = np.array(poly.exterior.coords) @ T[:, :2].T + T[:, 2]
                cv2.fillPoly(img, [np.round(ext).astype(np.int32)], int(255 * (fill_grey if fill_grey is not None else (p.fill[0] if p.fill else 0))))
            continue
        w = thick if thick is not None else max(1, int(round(p.width * abs(T[0, 0]))))
        for s in lines_of(g):
            a = np.array(s[0]) @ T[:, :2].T + T[:, 2]
            b = np.array(s[1]) @ T[:, :2].T + T[:, 2]
            cv2.line(img, tuple(np.round(a).astype(int)), tuple(np.round(b).astype(int)), 0, w, lineType=cv2.LINE_AA)
    return img


def apply_T(T, xy):
    xy = np.asarray(xy, float)
    return xy @ T[:, :2].T + T[:, 2]


def geom_T(geom, T):
    from shapely import affinity
    return affinity.affine_transform(geom, [T[0, 0], T[0, 1], T[1, 0], T[1, 1], T[0, 2], T[1, 2]])


# --------------------------------------------------------------------------------------------- dimensions

def _unit(v):
    n = math.hypot(v[0], v[1])
    return (v[0] / n, v[1] / n) if n else (0.0, 0.0)


def parse_dimensions(prims, nominal_units_per_cm, text_h=None, log=None):
    """CAD dimension entities exported as plain strokes -> ([{value_cm, a, b, span_units, ...}], diag).

    Generic recipe (no font, no OCR, no VLM):
      1. dimension lines   straight single segments >= 2.5 text heights;
      2. ticks             short segments crossing a dimension line at 25..65 deg (architectural ticks) or a
                           small filled arrowhead on it: their positions along the line are the measured ends;
      3. text items        everything else (stroke-font glyph polylines), grouped by proximity; a text item
                           belongs to the parallel dimension line it sits next to, and the side it sits on fixes
                           the reading direction (CAD keeps dimension text upright, above its line);
      4. glyphs            a text item split along its baseline; each glyph rasterised in the text frame;
      5. digit decoding    glyphs shape-clustered (one CAD font = identical geometry), then cluster -> digit by
                           maximising agreement with span / nominal over ALL dimensions at once, robustly (a
                           per-dimension error is capped, so one text override cannot steer the alphabet).
                           Every value is then READ from its own glyphs, never copied from its span, so an
                           overridden or wrong printed value shows up as a span/value outlier."""
    import cv2

    segs, texts, fills = [], [], []
    for p in prims:
        if p.kind == "fill":
            fills.append(p)
            continue
        ss = lines_of(p.geom)
        if len(ss) == 1:
            segs.append((ss[0], p))
        else:
            texts.append(p)
    if not segs:
        return [], {"note": "no straight segments on the dimension layers"}
    lens = np.array([seg_len(s) for s, _ in segs])
    if text_h is None:
        hs = [max(p.geom.bounds[2] - p.geom.bounds[0], p.geom.bounds[3] - p.geom.bounds[1]) for p in texts]
        text_h = float(np.median(hs)) if hs else float(np.median(lens))
    long_thr = 2.5 * text_h
    dim_lines = [(s, p) for (s, p), L in zip(segs, lens) if L >= long_thr]
    short = [(s, p) for (s, p), L in zip(segs, lens) if L < long_thr]
    # single-segment glyph strokes (the '1' flag, a '-' ...) are short segments that are no tick: text too
    lines_out = []
    tick_ids = set()
    for s, p in dim_lines:
        d = _unit((s[1][0] - s[0][0], s[1][1] - s[0][1]))
        n = (-d[1], d[0])
        ang = seg_angle(s)
        ticks = []
        for k, (t, tp) in enumerate(short):
            da = abs((seg_angle(t) - ang + 90) % 180 - 90)
            m = ((t[0][0] + t[1][0]) / 2, (t[0][1] + t[1][1]) / 2)
            v = (m[0] - s[0][0], m[1] - s[0][1])
            along = v[0] * d[0] + v[1] * d[1]
            off = v[0] * n[0] + v[1] * n[1]
            if not (-0.5 * text_h <= along <= seg_len(s) + 0.5 * text_h):
                continue
            if 25 <= da <= 65 and abs(off) <= 0.25 * text_h:
                ticks.append(along)
                tick_ids.add(k)
            elif da >= 75 and abs(off) <= 0.25 * text_h + seg_len(t) / 2:
                tick_ids.add(k)          # an extension line crossing the dimension line
        for f in fills:  # arrowheads
            c = f.geom.centroid
            v = (c.x - s[0][0], c.y - s[0][1])
            along = v[0] * d[0] + v[1] * d[1]
            off = v[0] * n[0] + v[1] * n[1]
            b = f.geom.bounds
            if max(b[2] - b[0], b[3] - b[1]) < 1.5 * text_h and abs(off) <= 0.3 * text_h and -0.5 * text_h <= along <= seg_len(s) + 0.5 * text_h:
                ticks.append(along)
        ticks = sorted(set(round(t, 3) for t in ticks))
        lines_out.append({"seg": s, "dir": d, "normal": n, "angle": ang, "ticks": ticks, "layer": p.layer})
    texts = texts + [tp for k, (t, tp) in enumerate(short) if k not in tick_ids and seg_len(t) < 0.8 * text_h]
    groups = group_glyph_strokes(texts, gap=0.45 * text_h)
    items = []
    for g in groups:
        geom = unary_union([p.geom for p in g])
        c = geom.centroid
        b = geom.bounds
        if max(b[2] - b[0], b[3] - b[1]) < 0.5 * text_h:
            continue
        best = None
        for j, L in enumerate(lines_out):
            s, d, n = L["seg"], L["dir"], L["normal"]
            v = (c.x - s[0][0], c.y - s[0][1])
            along = v[0] * d[0] + v[1] * d[1]
            off = v[0] * n[0] + v[1] * n[1]
            if not (0 <= along <= seg_len(s)) or abs(off) > 2.0 * text_h:
                continue
            if best is None or abs(off) < best[1]:
                best = (j, abs(off), off, along)
        if best is None:
            continue
        items.append({"prims": g, "geom": geom, "line": best[0], "off": best[2], "along": best[3]})
    sigs = []
    for it in items:
        L = lines_out[it["line"]]
        n = L["normal"]
        up = n if it["off"] > 0 else (-n[0], -n[1])        # from the line towards the text
        base = (-up[1], up[0])                             # up rotated so that it reads left -> right (y down)
        ang = math.degrees(math.atan2(base[1], base[0]))
        it["angle"] = ang
        iv = []
        for p in it["prims"]:
            pts = np.array([q for s in lines_of(p.geom) for q in s])
            pr = pts @ np.array(base)
            iv.append([pr.min(), pr.max(), p])
        iv.sort(key=lambda r: r[0])
        glyphs = []
        for lo, hi, p in iv:
            if glyphs and lo <= glyphs[-1][1] - 0.02 * text_h:
                glyphs[-1][1] = max(glyphs[-1][1], hi)
                glyphs[-1][2].append(p)
            else:
                glyphs.append([lo, hi, [p]])
        it["glyphs"] = []
        for lo, hi, ps in glyphs:
            ss = [s for p in ps for s in lines_of(p.geom)]
            sg = glyph_signature(ss, ang)
            if sg is None:
                continue
            img, w, h = sg
            it["glyphs"].append({"w": w, "h": h, "sig": len(sigs)})
            sigs.append(cv2.GaussianBlur(img.astype(np.float32), (5, 5), 1.2).ravel())
    if not sigs:
        return [], {"note": "no glyphs"}
    S = np.array(sigs)
    S = S - S.mean(axis=1, keepdims=True)
    S /= (np.linalg.norm(S, axis=1, keepdims=True) + 1e-9)
    aspect = np.zeros(len(S))
    for it in items:
        for g in it["glyphs"]:
            aspect[g["sig"]] = g["w"] / max(g["h"], 1e-6)
    lab = -np.ones(len(S), int)
    centers = []
    for i in range(len(S)):
        best, bc = -1, 0.0
        for ci, (cs, cw) in enumerate(centers):
            corr = float(S[i] @ cs)
            if corr > bc and abs(aspect[i] - cw) < 0.35:
                best, bc = ci, corr
        if best >= 0 and bc >= 0.80:
            lab[i] = best
        else:
            centers.append((S[i].copy(), aspect[i]))
            lab[i] = len(centers) - 1
    for it in items:
        it["classes"] = [int(lab[g["sig"]]) for g in it["glyphs"]]
        L = lines_out[it["line"]]
        tk = L["ticks"]
        a_al = max([t for t in tk if t <= it["along"]], default=None)
        b_al = min([t for t in tk if t >= it["along"]], default=None)
        if a_al is None or b_al is None or b_al - a_al < 0.5 * text_h:
            a_al, b_al = 0.0, seg_len(L["seg"])
            it["span_basis"] = "line ends (no ticks bracket the text)"
        else:
            it["span_basis"] = "ticks"
        s, d = L["seg"], L["dir"]
        it["a"] = (s[0][0] + d[0] * a_al, s[0][1] + d[1] * a_al)
        it["b"] = (s[0][0] + d[0] * b_al, s[0][1] + d[1] * b_al)
        it["span"] = b_al - a_al
    ncl = len(centers)
    usable = [it for it in items if 1 <= len(it["classes"]) <= 5]

    def decode(it, mp):
        v = 0
        for c in it["classes"]:
            dgt = mp.get(c)
            if dgt is None:
                return None
            v = v * 10 + dgt
        return v

    def cost(mp):
        tot = 0.0
        for it in usable:
            v = decode(it, mp)
            m = it["span"] / nominal_units_per_cm
            if not v or (len(it["classes"]) > 1 and mp.get(it["classes"][0]) == 0):
                tot += 0.08
                continue
            tot += min(abs(math.log(v / m)), 0.08)
        return tot

    votes = np.zeros((ncl, 10))
    for it in usable:
        m = it["span"] / nominal_units_per_cm
        cands = [c for c in range(int(m * 0.99), int(m * 1.01) + 2) if len(str(c)) == len(it["classes"])]
        for c in cands:
            for cl, ch in zip(it["classes"], str(c)):
                votes[cl, int(ch)] += 1.0 / len(cands)
    mp = {c: int(np.argmax(votes[c])) for c in range(ncl) if votes[c].sum() > 0}
    best = cost(mp)
    improved, rounds = True, 0
    while improved and rounds < 20:
        improved, rounds = False, rounds + 1
        for c in range(ncl):
            for dgt in range(10):
                if mp.get(c) == dgt:
                    continue
                trial = dict(mp)
                trial[c] = dgt
                ct = cost(trial)
                if ct < best - 1e-9:
                    best, mp, improved = ct, trial, True
    dims = []
    for it in items:
        v = decode(it, mp) if it in usable else None
        m = it["span"] / nominal_units_per_cm
        dims.append({"value_cm": v, "span_units": round(it["span"], 3), "nominal_cm": round(m, 1),
                     "a": [round(x, 3) for x in it["a"]], "b": [round(x, 3) for x in it["b"]],
                     "text_center": [round(it["geom"].centroid.x, 3), round(it["geom"].centroid.y, 3)],
                     "angle_deg": round(lines_out[it["line"]]["angle"], 2), "glyph_classes": it["classes"],
                     "span_basis": it["span_basis"], "layer": lines_out[it["line"]]["layer"]})
    # a class -> digit assignment is only trusted when the same shape also reads right elsewhere
    support = {}
    for it in usable:
        v = decode(it, mp)
        if v and abs(math.log(v / (it["span"] / nominal_units_per_cm))) < 0.02:
            for c in it["classes"]:
                support[c] = support.get(c, 0) + 1
    diag = {"text_h": round(text_h, 3), "dim_lines": len(lines_out), "text_items": len(items), "glyphs": len(S),
            "glyph_classes": ncl, "class_to_digit": {str(k): v for k, v in sorted(mp.items())},
            "class_support": {str(k): support.get(k, 0) for k in range(ncl)},
            "class_sizes": {str(c): int((lab == c).sum()) for c in range(ncl)}, "decode_cost": round(best, 4)}
    if log:
        log(f"dimensions: {len(lines_out)} lines, {len(items)} text items, {len(S)} glyphs in {ncl} shape classes; map {diag['class_to_digit']}")
    return dims, diag


# --------------------------------------------------------------------------------------------- room labels

HEB = re.compile(r"[א-ת]")


def letters_of(name):
    return [w for w in (re.sub(r"[^א-ת ]", "", name or "").split()) if w]


def read_labels(prims, candidates, log=None):
    """Outlined label text (stroke or filled glyphs on the text layer) -> blocks with a decoded name.

    candidates: [{"he": str, "en": str, "type": str, "source": "lexicon"|"vlm"}]. Each block (lines of words) is
    split into glyphs; glyphs are shape-clustered over the WHOLE sheet; a block takes a candidate name whose
    word/letter lengths match, under one global class -> letter function (the same glyph shape is the same letter
    everywhere). The solver maximises decoded letters and penalises a letter spread over several shape classes,
    so the true reading (one class per letter) wins ties. No VLM, no font file, no OCR."""
    import cv2

    pr = [p for p in prims if not p.geom.is_empty]
    if not pr:
        return [], {"note": "no text primitives"}
    # word grouping: touching strokes -> glyph pieces; pieces closer than 0.6 x the larger piece -> one word
    # (relative, so a sheet mixing title-block and label fonts groups both right)
    seg_l = [sum(seg_len(x) for x in lines_of(p.geom)) for p in pr]
    eps = 0.15 * float(np.median(seg_l)) if seg_l else 0.0
    small = group_glyph_strokes(pr, gap=eps)
    piece_of = {id(p): k for k, g in enumerate(small) for p in g}
    gb = np.array([unary_union([p.geom for p in g]).bounds for g in small])
    sz = np.maximum(gb[:, 2] - gb[:, 0], gb[:, 3] - gb[:, 1])
    hts = (gb[:, 3] - gb[:, 1])
    Hl = float(np.median(hts[hts >= 0.5 * np.percentile(hts, 90)])) if len(hts) else 1.0   # a letter's height
    parent = list(range(len(small)))

    def _find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for i in range(len(small)):
        gap = 0.6 * np.maximum(sz[i], sz)
        dx = np.maximum(0, np.maximum(gb[:, 0] - gb[i, 2], gb[i, 0] - gb[:, 2]))
        dy = np.maximum(0, np.maximum(gb[:, 1] - gb[i, 3], gb[i, 1] - gb[:, 3]))
        hh = gb[:, 3] - gb[:, 1]
        ww = gb[:, 2] - gb[:, 0]
        yov = np.minimum(gb[:, 3], gb[i, 3]) - np.maximum(gb[:, 1], gb[i, 1])
        xov = np.minimum(gb[:, 2], gb[i, 2]) - np.maximum(gb[:, 0], gb[i, 0])
        # same line = shared baseline or shared top line (Hebrew: lamed rises, final letters drop), not bbox overlap,
        # so two tightly stacked label lines stay apart
        tall = (hh[i] >= 0.5 * Hl) & (hh >= 0.5 * Hl)
        aligned = (np.abs(gb[:, 3] - gb[i, 3]) < 0.3 * Hl) | (np.abs(gb[:, 1] - gb[i, 1]) < 0.3 * Hl)
        same_line = np.where(tall, aligned, yov >= 0.4 * np.minimum(hh[i], hh) - eps) & (dx <= gap)
        same_letter = (xov >= 0.5 * np.minimum(ww[i], ww) - eps) & (dy <= 0.12 * np.maximum(sz[i], sz)) & ~tall
        hit = np.nonzero(same_line | same_letter)[0]
        for j in hit:
            if j != i:
                a, b = _find(i), _find(int(j))
                if a != b:
                    parent[b] = a
    wg = {}
    for i in range(len(small)):
        wg.setdefault(_find(i), []).extend(small[i])
    words = []
    for g in wg.values():
        u = unary_union([p.geom for p in g])
        b = u.bounds
        if max(b[2] - b[0], b[3] - b[1]) < 0.25 * float(np.median(sz)):
            continue
        L, S_, ang = min_rect(u.convex_hull) if u.convex_hull.geom_type == "Polygon" else (b[2] - b[0], b[3] - b[1], 0.0)
        ang = ((ang + 90) % 180) - 90
        ang = 0.0                                          # room labels are set horizontal (rotated ones: VLM / unnamed)                                      # short words: assume the sheet's horizontal
        words.append({"prims": g, "geom": u, "angle": ang, "c": (u.centroid.x, u.centroid.y), "bounds": b})
    if not words:
        return [], {"note": "no words"}
    th = float(np.median([min(w["bounds"][2] - w["bounds"][0], w["bounds"][3] - w["bounds"][1]) for w in words]))
    # glyphs
    sigs = []
    for w in words:
        a = math.radians(w["angle"])
        base = np.array([math.cos(a), math.sin(a)])
        iv = []
        for p in w["prims"]:
            pts = np.array([q for s in lines_of(p.geom) for q in s])
            if len(pts) == 0:
                continue
            prj = pts @ base
            iv.append([prj.min(), prj.max(), p])
        iv.sort(key=lambda r: r[0])
        gl = []
        for lo, hi, p in iv:
            if gl and lo <= gl[-1][1] + 0.04 * th:
                gl[-1][1] = max(gl[-1][1], hi)
                gl[-1][2].append(p)
            else:
                gl.append([lo, hi, [p]])
        w["glyphs"] = []
        for lo, hi, ps in gl:
            ss = [s for p in ps for s in lines_of(p.geom)]
            pts = np.array([q for s in ss for q in s])
            perp = pts @ np.array([-base[1], base[0]])
            if perp.max() - perp.min() < 0.35 * th and hi - lo < 0.35 * th:
                continue                                   # punctuation / dots
            sg = glyph_signature(ss, w["angle"])
            if sg is None:
                continue
            img, gw, gh = sg
            w["glyphs"].append({"sig": len(sigs), "x": (lo + hi) / 2, "w": gw, "h": gh, "pieces": len({piece_of[id(p)] for p in ps})})
            sigs.append(cv2.GaussianBlur(img.astype(np.float32), (3, 3), 0.8).ravel())
        w["glyphs"].sort(key=lambda g: -g["x"])          # Hebrew reads right -> left
    S = np.array(sigs)
    S = S - S.mean(axis=1, keepdims=True)
    S /= (np.linalg.norm(S, axis=1, keepdims=True) + 1e-9)
    asp = np.zeros(len(S))
    pcs = np.zeros(len(S), int)
    for w in words:
        for g in w["glyphs"]:
            asp[g["sig"]] = g["w"] / max(g["h"], 1e-6)
            pcs[g["sig"]] = g["pieces"]
    lab = -np.ones(len(S), int)
    centers = []
    for i in range(len(S)):
        best, bc = -1, 0.0
        for ci, (cs, cw, cp) in enumerate(centers):
            corr = float(S[i] @ cs)
            if corr > bc and abs(asp[i] - cw) < 0.25 and pcs[i] == cp:
                best, bc = ci, corr
        if best >= 0 and bc >= 0.93:
            lab[i] = best
        else:
            centers.append((S[i].copy(), asp[i], pcs[i]))
            lab[i] = len(centers) - 1
    for w in words:
        w["classes"] = [int(lab[g["sig"]]) for g in w["glyphs"]]
    # lines: words with the same angle on one baseline, near each other
    used = set()
    lines = []
    order = sorted(range(len(words)), key=lambda i: -words[i]["c"][0])
    for i in order:
        if i in used:
            continue
        line = [i]
        used.add(i)
        grew = True
        while grew:
            grew = False
            for j in order:
                if j in used or abs(words[j]["angle"] - words[i]["angle"]) > 8:
                    continue
                a = math.radians(words[i]["angle"])
                base = np.array([math.cos(a), math.sin(a)]); nrm = np.array([-base[1], base[0]])
                for k in line:
                    d = np.array(words[j]["c"]) - np.array(words[k]["c"])
                    gap = abs(d @ base) - ((words[j]["bounds"][2] - words[j]["bounds"][0]) + (words[k]["bounds"][2] - words[k]["bounds"][0])) / 2 * abs(base[0]) \
                        - ((words[j]["bounds"][3] - words[j]["bounds"][1]) + (words[k]["bounds"][3] - words[k]["bounds"][1])) / 2 * abs(base[1])
                    if abs(d @ nrm) < 0.5 * th and gap < 3.0 * th:
                        line.append(j); used.add(j); grew = True
                        break
        a = math.radians(words[i]["angle"])
        base = np.array([math.cos(a), math.sin(a)])
        line.sort(key=lambda k: -(np.array(words[k]["c"]) @ base))
        lines.append(line)
    # blocks: lines stacked within ~1.9 text heights, overlapping along the baseline
    lc = [np.mean([words[k]["c"] for k in L], axis=0) for L in lines]
    lb = [unary_union([words[k]["geom"] for k in L]).bounds for L in lines]
    parent = list(range(len(lines)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for i in range(len(lines)):
        for j in range(i + 1, len(lines)):
            if abs(words[lines[i][0]]["angle"] - words[lines[j][0]]["angle"]) > 8:
                continue
            dy = abs(lc[i][1] - lc[j][1])
            ox = min(lb[i][2], lb[j][2]) - max(lb[i][0], lb[j][0])
            if dy < 2.0 * th and ox > -0.3 * th:
                parent[find(j)] = find(i)
    blocks = {}
    for i in range(len(lines)):
        blocks.setdefault(find(i), []).append(i)
    out = []
    for bl in blocks.values():
        bl.sort(key=lambda i: lc[i][1])
        wl = [k for i in bl for k in lines[i]]
        geom = unary_union([words[k]["geom"] for k in wl])
        out.append({"words": [words[k]["classes"] for k in wl], "center": [geom.centroid.x, geom.centroid.y],
                    "bounds": list(geom.bounds), "angle": words[wl[0]]["angle"], "lines": len(bl)})
    # candidates as letter lists
    cands = []
    for c in candidates:
        ws = letters_of(c["he"])
        if ws:
            cands.append(dict(c, words=ws))
    for b in out:
        shape = [len(w) for w in b["words"]]
        b["cands"] = [ci for ci, c in enumerate(cands) if [len(w) for w in c["words"]] == shape]
    # global solve: class -> letter function; score = letters decoded - 0.6 * (extra classes per letter)
    order_b = sorted([i for i, b in enumerate(out) if b["cands"]], key=lambda i: len(out[i]["cands"]))
    best = {"score": -1e9, "assign": {}}

    def score(assign, c2l):
        n = sum(sum(len(w) for w in out[bi]["words"]) for bi in assign)
        l2c = {}
        for c_, l_ in c2l.items():
            l2c.setdefault(l_, set()).add(c_)
        extra = sum(len(v) - 1 for v in l2c.values())
        return n - 0.6 * extra

    nlet = {bi: sum(len(w) for w in out[bi]["words"]) for bi in order_b}
    rest = [sum(nlet[order_b[j]] for j in range(k, len(order_b))) for k in range(len(order_b) + 1)]
    calls = [0]

    def rec(k, assign, c2l, letters):
        calls[0] += 1
        if calls[0] > 200000:
            return
        if letters + rest[k] <= best["score"]:
            return                                        # cannot beat the best even reading every block left
        if k == len(order_b):
            s = score(assign, c2l)
            if s > best["score"]:
                best["score"], best["assign"] = s, dict(assign)
            return
        bi = order_b[k]
        for ci in out[bi]["cands"]:
            new = {}
            ok = True
            for wcls, wlet in zip(out[bi]["words"], cands[ci]["words"]):
                for c_, l_ in zip(wcls, wlet):
                    have = c2l.get(c_, new.get(c_))
                    if have is not None and have != l_:
                        ok = False
                        break
                    new[c_] = l_
                if not ok:
                    break
            if ok:
                assign[bi] = ci
                rec(k + 1, assign, {**c2l, **new}, letters + nlet[bi])
                del assign[bi]
        rec(k + 1, assign, c2l, letters)                  # leave this block unread

    rec(0, {}, {}, 0)
    # anchoring: a decoded block must share most of its glyph classes with OTHER decoded blocks, else its
    # reading is unconstrained (classes seen nowhere else take any letter) and it is dropped; iterate to a fixpoint
    assign = dict(best["assign"])
    while True:
        drop = []
        for bi, ci in assign.items():
            mine = [c_ for w_ in out[bi]["words"] for c_ in w_]
            others = {c_ for bj in assign if bj != bi for w_ in out[bj]["words"] for c_ in w_}
            if sum(c_ in others for c_ in mine) < 0.5 * len(mine):
                drop.append(bi)
        if not drop:
            break
        for bi in drop:
            del assign[bi]
    best["assign"] = assign
    for bi, b in enumerate(out):
        ci = best["assign"].get(bi)
        b["name"] = cands[ci] if ci is not None else None
        b["n_candidates"] = len(b["cands"])
        del b["cands"]
    diag = {"text_h": round(th, 3), "words": len(words), "glyphs": len(S), "glyph_classes": len(centers),
            "blocks": len(out), "decoded": sum(1 for b in out if b["name"]), "score": round(best["score"], 2)}
    if log:
        log(f"labels: {len(words)} words, {len(S)} glyphs in {len(centers)} classes, {len(out)} blocks, {diag['decoded']} decoded")
    return out, diag

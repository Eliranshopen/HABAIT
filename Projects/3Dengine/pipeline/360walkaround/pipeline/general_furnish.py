#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""general_furnish.py -- the 2-D half of FURNISHING a general-polygon plan (build_scene v1.5.0, D-WQ-36).

WHY THIS EXISTS. Apartment 846's AI skin was painted over grey placeholder masses (`fixtures[]`, Q02b), so
what room A shows through a door into room B was A's invention and every walk landed in a different
apartment. The ruling (D-WQ-36, 2026-10-29): the apartment exists ONCE as a fully furnished CG scene that
all eleven cameras see; the AI only polishes surfaces later, geometry locked. This module decides every
piece of that furniture and every interior door leaf; `build_scene.py` only executes the result.

WHY NOT placement_templates.py. Its eleven templates walk a RECTILINEAR room's wall runs (axis-aligned
`walls[]` rects, `bbox_cm` frames); a general room is any polygon at 18-36 deg off its raster. So the plan
carries the truth instead, in two layers:
  1. `fixtures[]` (schema 9a, traced by hand from the sales plan's drawn furniture) -- each one becomes
     REAL catalog models fitted to its footprint (a sofa to the drawn sofa, the kitchen run tiled in
     60 cm cabinet modules, the bed with nightstands at its head) or, where the catalog has no fitting
     model, a procedural assembly in palette materials (closet fronts, a shower tray with its screen).
  2. `furnishing` (EXTEND, new top-level object, v0.1.0 -- never a reshape): per-fixture hints
     (`fixture_hints.<id>`: where the sink and the hob sit in a run, whether a run gets uppers, a forced
     front), per-door choices (`doors.<opening id>`: swing room, hinge side, open angle) and an explicit
     per-room `pieces[]` list for what the drawing does not show (a rug, a console, terrace furniture).
Every derived piece (dining chairs, nightstands, lamps, uppers, a TV on its unit, a mirror over a vanity)
is DROPPED, never moved, when it leaves its room, overlaps a piece already placed or enters a camera's
bubble -- and the drop is reported. Plan-truth pieces (the fixtures) are kept and their checks reported.

FRAMES. Plan centimetres, +y DOWN (SCHEMA). A fixture's `angle_deg` is its long axis from +x (the
openings' convention). A placement's `yaw_deg` is the COMPASS bearing its model's front looks along, the
convention of `build_scene.place_model` (0 = plan -y, 90 = +x): yaw = atan2(dx, -dy). Every catalog model
faces its local -Y (the lock's `front_axis_note`), width on local X, depth on local Y.

INTERIOR DOORS (the skin round's open item: a flush infill reads as wall and the skin paints wall). Every
`door`-kind opening between two INDOOR rooms gets a jamb lining, an architrave on both faces, a leaf and a
lever handle on both faces, in palette materials that are not the wall's. The leaf swings into the more
private room (bathroom > storage > bedroom > the rest), hinged on the jamb nearer that room's side wall,
and stands AJAR (DOOR_AJAR_DEG) where any camera sees the doorway -- so the leaf's edge and the dark gap
read as a door -- else closed. `furnishing.doors.<id>` overrides any of the three.

Rails: no randomness, plan order everywhere, every tie broken by a fixed rule; no Blender import.
`python general_furnish.py --selftest` | `python general_furnish.py <plan.json> [--style <lock>]`.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import plan_general as pg  # noqa: E402

VERSION = "0.1.1"

CAMERA_BUBBLE_CM = 25.0        # a floor piece's footprint stays this far from every camera (T12's plan bar)
INSIDE_TOL_CM = 3.0            # a footprint shrunk by this must lie inside its room loop
OVERLAP_TOL_CM = 1.0           # two footprints overlapping by more than this collide
KITCHEN_MODULE_CM = 60.0
UPPER_BOTTOM_CM = 150.0
UPPER_DEPTH_CM = 35.0
HOOD_BOTTOM_CM = 160.0
SHELF_Z_CM = (145.0, 180.0)          # the two open shelves (material board), bottom faces
SHELF_DEPTH_CM = 24.0
SHELF_RAIL_Z_CM = 125.0              # the one long rail, under the shelves
SHELF_SPLASH_TOP_CM = 205.0          # the stainless function wall, worktop to here
NIGHTSTAND_GAP_CM = 3.0
CHAIR_GAP_CM = 12.0            # a dining chair's centre stands half its depth + this off the table edge
MIRROR_BOTTOM_CM = 110.0
ART_BOTTOM_CM = 120.0
DOOR_AJAR_DEG = 12.0
DOOR_WALK_DEGS = (30.0, 25.0)  # OQ-G12: a door the walk goes through opens this wide when clear (widest first)
DOOR_SIGHT_MAX_CM = 1500.0
LINING_CM = 2.0                # jamb lining thickness (the clear opening loses this per side)
CASING_W_CM = 7.0
CASING_PROUD_CM = 1.5
# build_scene --door-style: "cased" (lining + architraves on both faces, the v1.5 default) or "zero-line" (Habait studio,
# Eliran 2026-11-01: a frameless flush door, the lining only, no architrave on either face)
DOOR_STYLE = "cased"
LEAF_T_CM = 4.0
ENTRY_LEAF_T_CM = 4.5           # build_scene's DOOR_LEAF_THICK_CM: the entrance leaf it already builds
LEAF_GAP_CM = 0.3
CLOSET_DOOR_CM = 50.0          # target closet door width
CLOSET_PLINTH_CM = 8.0
OUTSIDE_TOL_CM = 12.0          # a sample may stand this far outside its own loop (the stroke band, the bays)
MAX_SHIFT_CM = 25.0            # a wall-backed piece moves at most this far off its traced line
MAX_TRIM_SHARE = 0.4           # a run loses at most this share of its length
DOOR_ZONE_CM = 60.0            # the clear zone in front of a door, each side
SCREEN_CAMERA_MIN_CM = 30.0
LEAF_CAMERA_MIN_CM = 30.0      # a door leaf swept 0 -> 90 deg never passes a camera nearer than this
NUDGE_MAX_CM = 60.0             # an explicit piece's hand-read point may move this far to become legal    # a shower screen never stands nearer a camera than this

LONG_IS_DEPTH = ("bed", "wc")  # the fixture's long side is the model's depth (a bed's length, a WC's reach)
PRIVACY = {"bathroom": 0, "wc": 0, "storage": 1, "bedroom": 2, "mamad": 3}

# kind -> catalog class (the model is the class's FIRST model in the lock: deterministic)
KIND_CLASS = {"sofa": "sofa", "tv_unit": "tv_unit", "bed": "bed_double", "vanity": "bathroom_sink",
              "wc": "toilet", "tall_unit": "fridge", "bedside": "nightstand"}


# ===================================================================================== small geometry
def yaw_of(dx, dy):
    return math.degrees(math.atan2(dx, -dy)) % 360.0


def dir_of_yaw(yaw):
    r = math.radians(yaw)
    return math.sin(r), -math.cos(r)


def rect(cx, cy, yaw, w, d):
    """The footprint of a model of width w (local X) and depth d (local Y) whose front looks along yaw."""
    fx, fy = dir_of_yaw(yaw)
    rx, ry = -fy, fx                      # the width axis
    hw, hd = w / 2.0, d / 2.0
    return [(cx + rx * a + fx * b, cy + ry * a + fy * b) for a, b in ((-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd))]


def signed_dist(pt, loop):
    d = min(pg.dist_point_segment(pt[0], pt[1], *loop[i], *loop[(i + 1) % len(loop)]) for i in range(len(loop)))
    return d if pg.point_in_polygon(pt, loop) else -d


def poly_inside(poly, loop, tol=INSIDE_TOL_CM):
    """Every corner and edge midpoint of `poly`, pulled `tol` toward its centroid, inside `loop`."""
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    pts = []
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        pts += [a, ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)]
    for x, y in pts:
        dx, dy = cx - x, cy - y
        L = math.hypot(dx, dy) or 1.0
        if not pg.point_in_polygon((x + dx / L * tol, y + dy / L * tol), loop):
            return False
    return True


def sat_penetration(a, b):
    """The minimum penetration depth of two convex polygons (<= 0 = apart)."""
    best = float("inf")
    for poly in (a, b):
        n = len(poly)
        for i in range(n):
            ex, ey = poly[(i + 1) % n][0] - poly[i][0], poly[(i + 1) % n][1] - poly[i][1]
            L = math.hypot(ex, ey)
            if L < 1e-9:
                continue
            ax, ay = -ey / L, ex / L
            pa = [p[0] * ax + p[1] * ay for p in a]
            pb = [p[0] * ax + p[1] * ay for p in b]
            ov = min(max(pa), max(pb)) - max(min(pa), min(pb))
            best = min(best, ov)
            if best <= 0:
                return best
    return best


def dist_point_poly(pt, poly):
    if pg.point_in_polygon(pt, poly):
        return 0.0
    return min(pg.dist_point_segment(pt[0], pt[1], *poly[i], *poly[(i + 1) % len(poly)]) for i in range(len(poly)))


def segments_cross(p, q, a, b):
    def orient(o, s, t):
        return (s[0] - o[0]) * (t[1] - o[1]) - (s[1] - o[1]) * (t[0] - o[0])
    d1, d2 = orient(a, b, p), orient(a, b, q)
    d3, d4 = orient(p, q, a), orient(p, q, b)
    return (d1 > 0) != (d2 > 0) and (d3 > 0) != (d4 > 0)


def segment_hits_polygon(p, q, poly):
    if pg.point_in_polygon(p, poly) or pg.point_in_polygon(q, poly):
        return True
    n = len(poly)
    return any(segments_cross(p, q, poly[i], poly[(i + 1) % n]) for i in range(n))


def nearest_wall_edge(pt, loop, kinds):
    """(foot point, inward unit normal, edge index, distance) of the nearest `wall` edge of a loop."""
    best = None
    n = len(loop)
    inward = 1.0 if pg.shoelace(loop) > 0 else -1.0
    for i in range(n):
        if kinds and i < len(kinds) and kinds[i] != "wall":
            continue
        (ax, ay), (bx, by) = loop[i], loop[(i + 1) % n]
        ex, ey = bx - ax, by - ay
        L2 = ex * ex + ey * ey
        if L2 < 1e-6:
            continue
        t = max(0.0, min(1.0, ((pt[0] - ax) * ex + (pt[1] - ay) * ey) / L2))
        fx, fy = ax + t * ex, ay + t * ey
        d = math.hypot(pt[0] - fx, pt[1] - fy)
        L = math.sqrt(L2)
        # plan frame is y-down: for a positive (shoelace > 0) loop the inside lies to (-ey, ex)
        nx, ny = -ey / L * inward, ex / L * inward
        if best is None or d < best[3] - 1e-9:
            best = ((fx, fy), (nx, ny), i, d, L)
    return best


# ===================================================================================== the planner
class Planner:
    def __init__(self, plan, style):
        self.plan = plan
        self.style = style
        self.rooms = {r["id"]: r for r in plan["rooms"]}
        self.loops = {r["id"]: pg.clean_ring(r["loop"]) for r in plan["rooms"]}
        self.cams = [(cp["id"], cp["room_id"], float(cp["x"]), float(cp["y"])) for cp in plan["camera_points"]]
        ext = plan.get("furnishing") or {}
        self.hints = ext.get("fixture_hints") or {}
        self.door_cfg = ext.get("doors") or {}
        self.extra = ext.get("pieces") or []
        self.placements, self.procedural, self.doors, self.entrance = [], [], [], []
        self.dropped, self.warnings = [], []
        self.footprints = []           # (owner id, poly) of every FLOOR piece placed so far, for collisions
        # the solids a piece may not enter: every wall and pane polygon (with its bbox, for speed)
        self.solids = []
        for w in plan.get("walls", []):
            poly = pg.clean_ring(w["polygon_cm"])
            self.solids.append((w["id"], poly, pg.bbox(poly)))
        for q in plan.get("panes", []):
            poly = pg.clean_ring(q["polygon_cm"])
            self.solids.append((q["id"], poly, pg.bbox(poly)))
        # rooms joined by a virtual boundary are one open floor (a piece may cross a zone bar)
        ceiling = float((plan.get("plan_meta") or {}).get("ceiling_height_cm", 290))
        self.open_to = {rid: {rid} for rid in self.rooms}
        for op in plan.get("openings", []):
            if pg.is_virtual_opening(op, ceiling) and len(op.get("rooms", [])) == 2:
                a, b = op["rooms"]
                if a in self.open_to and b in self.open_to:
                    self.open_to[a].add(b)
                    self.open_to[b].add(a)
        self.door_zones = self._door_zones()

    def _door_zones(self):
        """A clear zone in front of every cut door, both sides: the door's width x DOOR_ZONE_CM. Runs (a
        closet, a counter) are trimmed out of it and derived pieces never enter it."""
        out = []
        for op in self.plan.get("openings", []):
            if op["kind"] not in ("door", "entrance_door", "sliding_door", "glazed_door"):
                continue
            cx, cy, ux, uy, nx, ny = pg.door_frame(op)
            hw = float(op["width_cm"]) / 2.0
            out.append((f"door-zone:{op['id']}", pg.oriented_rect(cx, cy, ux, uy, nx, ny, -hw, hw,
                                                                  -DOOR_ZONE_CM, DOOR_ZONE_CM)))
        return out

    # -------------------------------------------------------------------------- the physical test
    def point_ok(self, pt, room_id):
        """A footprint sample is legal when it lies in no wall or pane and in no room that is not open to its
        own; an OUTDOOR sample must also lie within OUTSIDE_TOL_CM of its room loop (nothing but the loop
        marks the railing line). Indoors the loop is not the test: it stops at the stroke's inner edge, a
        2-5 cm band short of the walls, and the tracer cut the kitchen's bays out of it."""
        x, y = pt
        for _sid, poly, bb in self.solids:
            if bb[0] <= x <= bb[2] and bb[1] <= y <= bb[3] and pg.point_in_polygon(pt, poly):
                return False
        for rid, loop in self.loops.items():
            if rid not in self.open_to[room_id] and pg.point_in_polygon(pt, loop):
                return False
        if not self.rooms[room_id].get("is_outdoor"):
            return True        # indoors the walls and panes bound the room (its loop has the bays cut out)
        if any(pg.point_in_polygon(pt, self.loops[r]) for r in self.open_to[room_id]):
            return True
        return signed_dist(pt, self.loops[room_id]) >= -OUTSIDE_TOL_CM   # outdoors: the railing line

    def samples(self, poly, tol=INSIDE_TOL_CM):
        cx = sum(p[0] for p in poly) / len(poly)
        cy = sum(p[1] for p in poly) / len(poly)
        pts = []
        n = len(poly)
        for i in range(n):
            a, b = poly[i], poly[(i + 1) % n]
            for t in (0.0, 0.25, 0.5, 0.75):
                pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
        out = []
        for x, y in pts:
            dx, dy = cx - x, cy - y
            L = math.hypot(dx, dy) or 1.0
            out.append((x + dx / L * tol, y + dy / L * tol))
        return out

    def poly_ok(self, poly, room_id):
        return all(self.point_ok(p, room_id) for p in self.samples(poly))

    def fit(self, room_id, cx, cy, L, fr, w, d, trim=False, obstacles=True):
        """Pull a wall-backed piece INTO its room: first shift it forward (along its front) up to
        MAX_SHIFT_CM until its back leaves the wall, then -- for a run -- trim its ends 1 cm at a time
        until every sample is legal and it overlaps nothing placed (and no door zone). Returns
        (cx, cy, w, shift_cm, trimmed_cm). `L` is the unit width axis (the run's direction)."""
        def poly_at(x, y, lo, hi):
            mx, my = x + L[0] * (lo + hi) / 2.0, y + L[1] * (lo + hi) / 2.0
            return rect(mx, my, yaw_of(*fr), hi - lo, d), mx, my
        shift = 0.0
        for k in range(int(MAX_SHIFT_CM) + 1):
            poly, _, _ = poly_at(cx + fr[0] * k, cy + fr[1] * k, -w / 2.0, w / 2.0)
            back = [p for p in self.samples(poly) if (p[0] - cx - fr[0] * k) * fr[0] + (p[1] - cy - fr[1] * k) * fr[1] < 0]
            if all(self.point_ok(p, room_id) for p in back):
                shift = float(k)
                break
        else:
            shift = 0.0
        x, y = cx + fr[0] * shift, cy + fr[1] * shift
        lo, hi = -w / 2.0, w / 2.0
        if trim:
            obs = (self.footprints + self.door_zones) if obstacles else []
            for _ in range(int(w * MAX_TRIM_SHARE)):
                poly, mx, my = poly_at(x, y, lo, hi)
                bad = [p for p in self.samples(poly) if not self.point_ok(p, room_id)]
                hit = next((o for _oid, o in obs if sat_penetration(poly, o) > 0.2), None)
                if not bad and hit is None:
                    break
                if bad:
                    tx = sum(p[0] for p in bad) / len(bad)
                    ty = sum(p[1] for p in bad) / len(bad)
                else:
                    tx = sum(p[0] for p in hit) / len(hit)
                    ty = sum(p[1] for p in hit) / len(hit)
                if (tx - mx) * L[0] + (ty - my) * L[1] > 0:
                    hi -= 1.0
                else:
                    lo += 1.0
        mx, my = x + L[0] * (lo + hi) / 2.0, y + L[1] * (lo + hi) / 2.0
        return mx, my, hi - lo, shift, round(w - (hi - lo), 1)

    # -------------------------------------------------------------------------- catalog
    def model_of(self, cls, model=None):
        if model:
            if model not in self.style["models"]:
                raise SystemExit(f"furnishing: model {model!r} is not in the style lock")
            return model
        c = (self.style.get("classes") or {}).get(cls)
        if not c or not c.get("models"):
            raise SystemExit(f"furnishing: class {cls!r} has no model in the style lock")
        return c["models"][0]

    def dims(self, mid):
        s = self.style["models"][mid]
        return [float(v) for v in s["scaled_bbox_cm"]]

    def fit_scale(self, mid, w=None, d=None, h=None):
        """Per-axis scale that fits the RAW model to (w, d, h); an axis left None keeps the lock's own scale.
        A `keep_source` (photoreal Poly Haven) model is never stretched: it keeps 1.0 on every axis."""
        s = self.style["models"][mid]
        raw = [float(v) for v in s["measured_bbox_cm"]]
        lock = s.get("scale_xyz") or [s.get("scale") or 1.0] * 3
        if s.get("material_policy") == "keep_source":
            return [float(v) for v in lock]
        out = []
        for i, want in enumerate((w, d, h)):
            out.append(float(lock[i]) if want is None else float(want) / raw[i])
        return out

    # -------------------------------------------------------------------------- checks
    def check(self, room_id, poly, owner, layer, strict, parent=None):
        """(ok, reasons). layer: floor | rug | wall | on_top. A derived piece never collides with its own
        parent (a dining chair's seat tucks under its table)."""
        why = []
        if layer in ("floor", "rug") and not self.poly_ok(poly, room_id):
            why.append("enters a wall, a pane or another room")
        if layer == "floor":
            for oid, other in self.footprints + ([] if strict else self.door_zones):
                if parent is not None and oid == parent:
                    continue
                pen = sat_penetration(poly, other)
                if pen > OVERLAP_TOL_CM:
                    why.append(f"overlaps {oid} by {pen:.1f} cm")
                    break
            for cid, _rid, cx, cy in self.cams:
                dd = dist_point_poly((cx, cy), poly)
                if dd < CAMERA_BUBBLE_CM:
                    why.append(f"{dd:.1f} cm from camera {cid} (bar {CAMERA_BUBBLE_CM:.0f})")
                    break
        if why and not strict:
            return False, why
        if why:
            self.warnings.append(f"{owner}: kept (plan truth) but {'; '.join(why)}")
        return True, why

    def add(self, pid, room_id, source, cls, mid, x, y, yaw, w, d, h=None, anchor="floor", z_cm=None,
            layer="floor", strict=False, scale=None, parent=None):
        poly = rect(x, y, yaw, w, d)
        ok, why = self.check(room_id, poly, pid, layer, strict, parent)
        if not ok:
            self.dropped.append({"id": pid, "room_id": room_id, "source": source, "model": mid,
                                 "why": why})
            return None
        sc = scale or self.fit_scale(mid, w, d, h)
        rec = {"id": pid, "room_id": room_id, "source": source, "class": cls, "model": mid,
               "x_cm": round(x, 3), "y_cm": round(y, 3), "yaw_deg": round(yaw % 360.0, 4),
               "width_cm": round(w, 2), "depth_cm": round(d, 2),
               "height_cm": round(h if h is not None else self.dims(mid)[2], 2),
               "anchor": anchor, "z_cm": z_cm, "layer": layer, "scale_xyz": [round(v, 6) for v in sc],
               "footprint_cm": [[round(a, 2), round(b, 2)] for a, b in poly], "checks": why}
        self.placements.append(rec)
        if layer == "floor":
            self.footprints.append((pid, poly))
        return rec

    def add_proc(self, pid, room_id, source, kind, parts, footprint, strict=True):
        ok, why = self.check(room_id, footprint, pid, "floor", strict)
        self.procedural.append({"id": pid, "room_id": room_id, "source": source, "kind": kind,
                                "parts": parts, "checks": why,
                                "footprint_cm": [[round(a, 2), round(b, 2)] for a, b in footprint]})
        self.footprints.append((pid, footprint))

    # -------------------------------------------------------------------------- fronts
    def auto_front(self, room_id, cx, cy, cand_dirs, depth):
        """Of the candidate front directions, the one whose BACK probe lies deepest outside / nearest the
        room's boundary (the piece's back goes to the wall). Ties: candidate order."""
        loop = self.loops[room_id]
        best = None
        for k, (dx, dy) in enumerate(cand_dirs):
            px, py = cx - dx * (depth / 2.0 + 20.0), cy - dy * (depth / 2.0 + 20.0)
            s = signed_dist((px, py), loop)
            if best is None or s < best[0] - 1e-6:
                best = (s, k)
        return cand_dirs[best[1]]

    def fixture_frame(self, f):
        cx, cy = (float(v) for v in f["centre_cm"])
        a = math.radians(float(f["angle_deg"]))
        L = (math.cos(a), math.sin(a))
        N = (-L[1], L[0])
        s0, s1 = (float(v) for v in f["size_cm"])
        return cx, cy, L, N, s0, s1

    def front_for(self, f, cands, depth):
        hint = (self.hints.get(f["id"]) or {}).get("front_deg")
        if hint is not None:
            return dir_of_yaw(float(hint))
        cx, cy, *_ = self.fixture_frame(f)
        return self.auto_front(f["room_id"], cx, cy, cands, depth)

    def note_fit(self, fid, shift, trimmed):
        if shift:
            self.warnings.append(f"{fid}: moved {shift:g} cm off its traced line, out of the wall behind it")
        if trimmed:
            self.warnings.append(f"{fid}: run trimmed {trimmed:g} cm (a wall, a door zone or an earlier piece)")

    # -------------------------------------------------------------------------- per kind
    def fx_simple(self, f, cls, model=None, keep_height=True, wall_backed=True):
        cx, cy, L, N, s0, s1 = self.fixture_frame(f)
        mid = self.model_of(cls, model)
        if f["kind"] in LONG_IS_DEPTH:
            w, d, cands = s1, s0, [L, (-L[0], -L[1])]
        else:
            w, d, cands = s0, s1, [N, (-N[0], -N[1])]
        fr = self.front_for(f, cands, d)
        yaw = yaw_of(*fr)
        h = None if keep_height else float(f["height_cm"])
        if self.style["models"][mid].get("material_policy") == "keep_source":
            w, d, _ = self.dims(mid)
        if wall_backed:
            cx, cy, w, shift, trimmed = self.fit(f["room_id"], cx, cy, (-fr[1], fr[0]), fr, w, d)
            self.note_fit(f["id"], shift, trimmed)
        return self.add(f["id"], f["room_id"], f"fixture:{f['id']}", cls, mid, cx, cy, yaw, w, d, h,
                        strict=True), fr

    def fx_sofa(self, f):
        cx, cy, L, N, s0, s1 = self.fixture_frame(f)
        room = [g for g in self.plan.get("fixtures", []) if g["room_id"] == f["room_id"]]
        if max(s0, s1) < 130.0:                             # an armchair drawn as a sofa
            mid = self.model_of("armchair")
            target = next((g for g in room if g["kind"] == "table" and float(g["height_cm"]) <= 50.0), None)
            if target is not None:
                yaw = yaw_of(float(target["centre_cm"][0]) - cx, float(target["centre_cm"][1]) - cy)
            else:
                yaw = yaw_of(*self.front_for(f, [N, (-N[0], -N[1])], s1))
            w, d, _ = self.dims(mid)
            return self.add(f["id"], f["room_id"], f"fixture:{f['id']}", "armchair", mid, cx, cy, yaw, w, d,
                            strict=True)
        tv = next((g for g in room if g["kind"] == "tv_unit"), None)
        if tv is not None and (self.hints.get(f["id"]) or {}).get("front_deg") is None:
            vx, vy = float(tv["centre_cm"][0]) - cx, float(tv["centre_cm"][1]) - cy
            fr = N if vx * N[0] + vy * N[1] >= 0 else (-N[0], -N[1])
        else:
            fr = self.front_for(f, [N, (-N[0], -N[1])], s1)
        mid = self.model_of("sofa")
        return self.add(f["id"], f["room_id"], f"fixture:{f['id']}", "sofa", mid, cx, cy, yaw_of(*fr), s0, s1,
                        strict=True)

    def fx_tv(self, f):
        cx, cy, L, N, s0, s1 = self.fixture_frame(f)
        fr = self.front_for(f, [N, (-N[0], -N[1])], s1)
        yaw = yaw_of(*fr)
        R = (-fr[1], fr[0])
        cx, cy, s0, shift, trimmed = self.fit(f["room_id"], cx, cy, R, fr, s0, s1, trim=True)
        self.note_fit(f["id"], shift, trimmed)
        mid = self.model_of("tv_unit")
        n = max(1, int(round(s0 / 150.0)))                  # a long unit is two cabinets, never one stretched x2
        mw = s0 / n
        h = float(f["height_cm"])
        for i in range(n):
            u = -s0 / 2.0 + (i + 0.5) * mw
            self.add(f"{f['id']}-{i + 1}", f["room_id"], f"fixture:{f['id']}", "tv_unit", mid,
                     cx + R[0] * u, cy + R[1] * u, yaw, mw - 0.4, s1, h, strict=True)
        tvm = self.model_of("tv")
        tw, td, th = self.dims(tvm)
        back = s1 / 2.0 - td / 2.0 - 4.0
        self.add(f"{f['id']}-tv", f["room_id"], f"derived:{f['id']}", "tv", tvm,
                 cx - fr[0] * back, cy - fr[1] * back, yaw, tw, td, th, anchor="on_top", z_cm=h, layer="on_top")

    def fx_bed(self, f):
        rec, fr = self.fx_simple(f, "bed_double")
        if rec is None:
            return
        cx, cy = rec["x_cm"], rec["y_cm"]
        _x, _y, L, N, s0, s1 = self.fixture_frame(f)
        yaw = rec["yaw_deg"]
        rx, ry = -fr[1], fr[0]
        ns = self.model_of("nightstand")
        nw, nd, nh = self.dims(ns)
        lamp = self.model_of("table_lamp")
        lw, ld, lh = self.dims(lamp)
        head = s0 / 2.0                                     # bed length = the long side (LONG_IS_DEPTH)
        for side, tag in ((-1.0, "l"), (1.0, "r")):
            off = side * (s1 / 2.0 + NIGHTSTAND_GAP_CM + nw / 2.0)
            back = head - nd / 2.0 - 1.0
            x, y = cx + rx * off - fr[0] * back, cy + ry * off - fr[1] * back
            got = self.add(f"{f['id']}-nightstand-{tag}", f["room_id"], f"derived:{f['id']}", "nightstand", ns,
                           x, y, yaw, nw, nd, nh)
            if got is not None:
                self.add(f"{f['id']}-lamp-{tag}", f["room_id"], f"derived:{f['id']}", "table_lamp", lamp,
                         x, y, yaw, lw, ld, lh, anchor="on_top", z_cm=nh, layer="on_top")
        # art over the head, on the nearest wall behind it
        art = self.model_of("wall_art")
        aw, ad, ah = self.dims(art)
        hx, hy = cx - fr[0] * (head + 5.0), cy - fr[1] * (head + 5.0)
        ne = nearest_wall_edge((hx, hy), self.loops[f["room_id"]], self.rooms[f["room_id"]].get("edge_kinds"))
        if ne is not None and ne[3] <= 40.0:
            (fx, fy), (nx, ny), _i, _d, _L = ne
            self.add(f"{f['id']}-art", f["room_id"], f"derived:{f['id']}", "wall_art", art,
                     fx + nx * (ad / 2.0 + 0.5), fy + ny * (ad / 2.0 + 0.5), yaw_of(nx, ny), aw, ad, ah,
                     anchor="wall", z_cm=ART_BOTTOM_CM, layer="wall")

    def fx_table(self, f):
        cx, cy, L, N, s0, s1 = self.fixture_frame(f)
        if float(f["height_cm"]) <= 50.0:                   # a coffee table
            mid = self.model_of("coffee_table")
            w, d, _ = self.dims(mid)
            self.add(f["id"], f["room_id"], f"fixture:{f['id']}", "coffee_table", mid, cx, cy, yaw_of(*N), w, d,
                     strict=True)
            return
        mid = self.model_of("dining_table")
        self.add(f["id"], f["room_id"], f"fixture:{f['id']}", "dining_table", mid, cx, cy, yaw_of(*N), s0, s1,
                 float(f["height_cm"]), strict=True)
        ch = self.model_of("dining_chair")
        cw, cd, chh = self.dims(ch)
        for k, (dx, dy, half) in enumerate(((N[0], N[1], s1 / 2.0), (-N[0], -N[1], s1 / 2.0),
                                            (L[0], L[1], s0 / 2.0), (-L[0], -L[1], s0 / 2.0))):
            r = half + CHAIR_GAP_CM + cd / 2.0 - 15.0       # the seat tucks 15 cm under the top
            self.add(f"{f['id']}-chair-{k + 1}", f["room_id"], f"derived:{f['id']}", "dining_chair", ch,
                     cx + dx * r, cy + dy * r, yaw_of(-dx, -dy), cw, cd, chh, parent=f["id"])

    def fx_vanity(self, f):
        rec, fr = self.fx_simple(f, "bathroom_sink")
        if rec is None:
            return
        cx, cy = rec["x_cm"], rec["y_cm"]
        s0, s1 = rec["width_cm"], rec["depth_cm"]
        mm = self.model_of("mirror")
        mw, md, mh = self.dims(mm)
        back = s1 / 2.0 - md / 2.0 + 1.0
        self.add(f"{f['id']}-mirror", f["room_id"], f"derived:{f['id']}", "mirror", mm,
                 cx - fr[0] * back, cy - fr[1] * back, rec["yaw_deg"], min(mw, s0), md, mh,
                 anchor="wall", z_cm=MIRROR_BOTTOM_CM, layer="wall")

    def fx_tall(self, f):
        cx, cy, L, N, s0, s1 = self.fixture_frame(f)
        fr = self.front_for(f, [N, (-N[0], -N[1])], s1)
        cx, cy, s0, shift, trimmed = self.fit(f["room_id"], cx, cy, (-fr[1], fr[0]), fr, s0, s1)
        self.note_fit(f["id"], shift, trimmed)
        mid = self.model_of("fridge")
        self.add(f["id"], f["room_id"], f"fixture:{f['id']}", "fridge", mid, cx, cy, yaw_of(*fr), s0, s1,
                 float(f["height_cm"]), strict=True)

    def fx_counter(self, f):
        cx, cy, L, N, s0, s1 = self.fixture_frame(f)
        hint = self.hints.get(f["id"]) or {}
        if not hint:
            # 2026-11-04 (the Sandbox spike rendered tours/apt846/plan.json, which had no `furnishing` block, and got a kitchen
            # of plain cabinets with no sink, hob or uppers - silently): say it loudly
            print(f"WARNING   furnishing: no fixture_hints for counter {f['id']} - no sink, hob or uppers will be built on it "
                  f"(add plan.furnishing.fixture_hints.{f['id']})", flush=True)
        fr = self.front_for(f, [N, (-N[0], -N[1])], s1)
        yaw = yaw_of(*fr)
        R = (-fr[1], fr[0])
        cx, cy, s0, shift, trimmed = self.fit(f["room_id"], cx, cy, R, fr, s0, s1, trim=True)
        self.note_fit(f["id"], shift, trimmed)
        h = float(f["height_cm"])
        n = max(1, int(round(s0 / KITCHEN_MODULE_CM)))
        mw = s0 / n
        mods = []
        for i in range(n):
            u = -s0 / 2.0 + (i + 0.5) * mw
            x, y = cx + R[0] * u, cy + R[1] * u
            poly = rect(x, y, yaw, mw, s1)
            hit = next((oid for oid, other in self.footprints if sat_penetration(poly, other) > 10.0), None)
            if hit is not None:
                self.dropped.append({"id": f"{f['id']}-m{i + 1}", "room_id": f["room_id"],
                                     "source": f"fixture:{f['id']}", "model": None,
                                     "why": [f"the run's module overlaps {hit} (the L's corner): not built"]})
                continue
            mods.append((i, x, y))

        def nearest(pt):
            if not pt or not mods:
                return None
            return min(mods, key=lambda m: (math.hypot(m[1] - pt[0], m[2] - pt[1]), m[0]))[0]
        sink_i, hob_i = nearest(hint.get("sink_at_cm")), nearest(hint.get("hob_at_cm"))
        for i, x, y in mods:
            cls = "kitchen_sink" if i == sink_i else "stove" if i == hob_i else "kitchen_cabinet"
            mid = self.model_of(cls)
            self.add(f"{f['id']}-m{i + 1}", f["room_id"], f"fixture:{f['id']}", cls, mid, x, y, yaw, mw - 0.2, s1,
                     h, layer="on_top", strict=True)
        for i, x, y in mods:                               # the run's footprint, after its own modules
            self.footprints.append((f"{f['id']}-m{i + 1}", rect(x, y, yaw, mw, s1)))
        if hint.get("uppers") == "shelves":
            # the material board (habait-tel-aviv-luxury-v1; Eliran 2026-11-04 «לך לפי לוח החומרים, מה שהכי תואם לאמת»): no upper
            # cabinets - a brushed stainless function-wall splashback with ONE long horizontal rail and TWO slim open shelves;
            # the shelves stop short of the hob module, which keeps its hood. Wall-mounted: no floor footprint.
            back = -s1 / 2.0

            def box(u0, u1, v0, v1, z0, z1, mat, name):
                pts = [(cx + R[0] * u + fr[0] * v, cy + R[1] * u + fr[1] * v) for u, v in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]
                return {"name": name, "poly_cm": [[round(a, 3), round(b, 3)] for a, b in pts], "z_cm": [z0, z1], "material": mat}
            spans = sorted((-s0 / 2.0 + i * mw, -s0 / 2.0 + (i + 1) * mw, i) for i, _, _ in mods)
            if spans:
                u_lo, u_hi = spans[0][0], spans[-1][1]
                parts = [box(u_lo, u_hi, back, back + 1.0, h, SHELF_SPLASH_TOP_CM, "metal_brushed", f"KITCHEN_{f['id']}_splashback"),
                         box(u_lo, u_hi, back + 1.0, back + 3.0, SHELF_RAIL_Z_CM, SHELF_RAIL_Z_CM + 2.0, "metal_brushed", f"KITCHEN_{f['id']}_rail")]
                runs, cur = [], None
                for a, b, i in spans:                      # contiguous module spans without the hob module
                    if i == hob_i:
                        cur = None
                        continue
                    if cur and abs(cur[1] - a) < 0.5:
                        cur[1] = b
                    else:
                        cur = [a, b]
                        runs.append(cur)
                for k, (a, b) in enumerate(runs):
                    for j, z in enumerate(SHELF_Z_CM):
                        parts.append(box(a + 1.0, b - 1.0, back + 1.0, back + 1.0 + SHELF_DEPTH_CM, z, z + 2.5, "metal_brushed",
                                         f"KITCHEN_{f['id']}_shelf{j + 1}_{k + 1}"))
                self.procedural.append({"id": f"{f['id']}-shelves", "room_id": f["room_id"], "source": f"derived:{f['id']}",
                                        "kind": "kitchen_shelves", "parts": parts,
                                        "checks": ["wall-mounted above the run (material board): no floor footprint"],
                                        "footprint_cm": []})
            if hob_i is not None:
                hood = self.model_of("hood")
                hit = next(((x, y) for i, x, y in mods if i == hob_i), None)
                if hit:
                    hw_, hd_, hh_ = self.dims(hood)
                    hb = s1 / 2.0 - hd_ / 2.0
                    self.add(f"{f['id']}-hood", f["room_id"], f"derived:{f['id']}", "hood", hood,
                             hit[0] - fr[0] * hb, hit[1] - fr[1] * hb, yaw, hw_, hd_, hh_, anchor="wall", z_cm=HOOD_BOTTOM_CM,
                             layer="wall")
        elif hint.get("uppers"):
            up = self.model_of("kitchen_upper")
            hood = self.model_of("hood")
            back = s1 / 2.0 - UPPER_DEPTH_CM / 2.0
            for i, x, y in mods:
                ux, uy = x - fr[0] * back, y - fr[1] * back
                if i == hob_i:
                    hw_, hd_, hh_ = self.dims(hood)
                    hb = s1 / 2.0 - hd_ / 2.0
                    self.add(f"{f['id']}-hood", f["room_id"], f"derived:{f['id']}", "hood", hood,
                             x - fr[0] * hb, y - fr[1] * hb, yaw, hw_, hd_, hh_, anchor="wall", z_cm=HOOD_BOTTOM_CM,
                             layer="wall")
                    continue
                self.add(f"{f['id']}-u{i + 1}", f["room_id"], f"derived:{f['id']}", "kitchen_upper", up, ux, uy, yaw,
                         mw - 0.2, UPPER_DEPTH_CM, 70.0, anchor="wall", z_cm=UPPER_BOTTOM_CM, layer="wall")

    def fx_wardrobe(self, f):
        """No catalog wardrobe exists (RESEARCH 5c): a procedural closet -- carcass, plinth, doors ~50 cm,
        bar handles -- in palette materials, pulled out of the wall behind it and trimmed out of a wall, a
        door zone or an earlier closet (an L of two runs, never two interpenetrating boxes)."""
        cx, cy, L, N, s0, s1 = self.fixture_frame(f)
        fr = self.front_for(f, [N, (-N[0], -N[1])], s1)
        yaw = yaw_of(*fr)
        rx, ry = -fr[1], fr[0]
        mx, my, w, shift, trimmed = self.fit(f["room_id"], cx, cy, (rx, ry), fr, s0, s1, trim=True)
        self.note_fit(f["id"], shift, trimmed)
        h = float(f["height_cm"])
        # fixture finish (fix-846-fidelity 2026-11-05): "white" = the material board's zero-line flush door painted the wall colour
        # (no wood-grain fronts); the style lock has no wall paint, so its ceramic_white stands in for the CG placeholder
        body = "ceramic_white" if f.get("finish") == "white" else "wood_oak"
        plinth = "ceramic_white" if f.get("finish") == "white" else "wood_walnut"

        def box(u0, u1, v0, v1, z0, z1, mat, name):
            pts = [(mx + rx * u + fr[0] * v, my + ry * u + fr[1] * v) for u, v in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]
            return {"name": name, "poly_cm": [[round(a, 3), round(b, 3)] for a, b in pts], "z_cm": [z0, z1],
                    "material": mat}
        hd = s1 / 2.0
        parts = [box(-w / 2.0, w / 2.0, -hd, hd - 2.0, 0.0, h, body, f"CLOSET_{f['id']}_carcass"),
                 box(-w / 2.0 + 0.6, w / 2.0 - 0.6, hd - 2.6, hd - 1.5, 0.0, CLOSET_PLINTH_CM, plinth,
                     f"CLOSET_{f['id']}_plinth")]
        nd = max(1, int(round(w / CLOSET_DOOR_CM)))
        dw = w / nd
        for k in range(nd):
            u0 = -w / 2.0 + k * dw + 0.2
            u1 = u0 + dw - 0.4
            parts.append(box(u0, u1, hd - 1.9, hd, CLOSET_PLINTH_CM + 0.3, h - 0.3, body,
                             f"CLOSET_{f['id']}_door{k + 1}"))
            # the handle at the meeting edge: pairs meet in the middle, an odd last door keeps it on its left
            edge = u1 - 3.0 if (k % 2 == 0 and k < nd - 1) else u0 + 3.0
            parts.append(box(edge - 0.6, edge + 0.6, hd + 0.0, hd + 2.5, 95.0, 135.0, "metal_black",
                             f"CLOSET_{f['id']}_handle{k + 1}"))
        self.add_proc(f["id"], f["room_id"], f"fixture:{f['id']}", "closet", parts, rect(mx, my, yaw, w, s1))

    def fx_shower(self, f):
        """No catalog shower fits a drawn rectangular tray (showerRound is a 90 cm round cabin): a ceramic
        tray, a fixed glass screen on the open side at the end FARTHER from every camera (none if it would
        stand within SCREEN_CAMERA_MIN_CM of one), a riser and a head -- palette materials."""
        cx, cy, L, N, s0, s1 = self.fixture_frame(f)
        fr = self.front_for(f, [N, (-N[0], -N[1])], s1)
        rx, ry = -fr[1], fr[0]
        cx, cy, s0, shift, trimmed = self.fit(f["room_id"], cx, cy, (rx, ry), fr, s0, s1, trim=True, obstacles=False)
        self.note_fit(f["id"], shift, trimmed)

        def pts_of(u0, u1, v0, v1):
            return [(cx + rx * u + fr[0] * v, cy + ry * u + fr[1] * v) for u, v in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]

        def box(u0, u1, v0, v1, z0, z1, mat, name):
            return {"name": name, "poly_cm": [[round(a, 3), round(b, 3)] for a, b in pts_of(u0, u1, v0, v1)],
                    "z_cm": [z0, z1], "material": mat}
        hw, hd = s0 / 2.0, s1 / 2.0
        tray_h = min(float(f["height_cm"]), 6.0)
        screen = min(s0 * 0.5, 100.0)
        parts = [box(-hw + 0.5, hw - 0.5, -hd + 0.5, hd - 0.5, 0.0, tray_h, "ceramic_white", f"SHOWER_{f['id']}_tray")]
        best = None
        for side in (-1.0, 1.0):
            u0, u1 = sorted((side * (hw - 1.0), side * (hw - 1.0 - screen)))
            poly = pts_of(u0, u1, hd - 2.0, hd - 1.2)
            dmin = min(dist_point_poly((c[2], c[3]), poly) for c in self.cams)
            if best is None or dmin > best[0] + 1e-6:
                best = (dmin, u0, u1, side)
        if best[0] >= SCREEN_CAMERA_MIN_CM:
            _d, u0, u1, _s = best
            parts += [box(u0, u1, hd - 2.0, hd - 1.2, tray_h + 0.2, 200.0, "glass_clear", f"SHOWER_{f['id']}_screen"),
                      box(u0, u1, hd - 2.4, hd - 0.8, 200.5, 202.0, "metal_brushed", f"SHOWER_{f['id']}_screen_rail")]
        else:
            self.warnings.append(f"{f['id']}: no glass screen - either end would stand {best[0]:.0f} cm from a "
                                 f"camera (bar {SCREEN_CAMERA_MIN_CM:.0f})")
        parts += [box(-1.0, 1.0, -hd + 1.0, -hd + 3.0, 100.0, 205.0, "metal_brushed", f"SHOWER_{f['id']}_riser"),
                  box(-11.0, 11.0, -hd + 3.0, -hd + 25.0, 205.5, 207.0, "metal_brushed", f"SHOWER_{f['id']}_head")]
        self.add_proc(f["id"], f["room_id"], f"fixture:{f['id']}", "shower", parts, pts_of(-hw, hw, -hd, hd))

    # -------------------------------------------------------------------------- explicit pieces
    def piece(self, p):
        mid = self.model_of(p.get("class"), p.get("model"))
        cls = p.get("class") or next((c for c, v in (self.style.get("classes") or {}).items()
                                       if mid in v.get("models", [])), "?")
        w, d, h = self.dims(mid)
        if p.get("size_cm"):
            w, d = (float(v) for v in p["size_cm"][:2])
            if len(p["size_cm"]) > 2:
                h = float(p["size_cm"][2])
        x, y = (float(v) for v in p["centre_cm"])
        anchor = p.get("anchor", "floor")
        layer = p.get("layer") or ("rug" if cls in ("rug", "bath_mat") else "wall" if anchor == "wall" else
                                   "on_top" if anchor == "on_top" else "floor")
        if p.get("against_wall"):
            ne = nearest_wall_edge((x, y), self.loops[p["room_id"]], self.rooms[p["room_id"]].get("edge_kinds"))
            if ne is None:
                raise SystemExit(f"furnishing.pieces[{p['id']}]: against_wall, but its room has no wall edge")
            (fx, fy), (nx, ny), _i, _d, _L = ne
            gap = float(p.get("wall_gap_cm", 1.0))
            x, y = fx + nx * (d / 2.0 + gap), fy + ny * (d / 2.0 + gap)
            yaw = yaw_of(nx, ny)
        elif p.get("yaw_deg") is not None:
            yaw = float(p["yaw_deg"])
        elif p.get("angle_deg") is not None:                # the width axis, raster frame
            a = math.radians(float(p["angle_deg"]))
            yaw = yaw_of(-math.sin(a), math.cos(a))
        else:
            yaw = 0.0
        r0 = rect(x, y, yaw, w, d)
        if layer == "floor" and (not self.poly_ok(r0, p["room_id"]) or any(
                sat_penetration(r0, o) > OVERLAP_TOL_CM for _i, o in self.footprints)):
            # the hand-read point is a few cm off: take the NEAREST legal centre on a 5 cm ring search
            # (rings outward, each ring walked from bearing 0 clockwise -- deterministic), reported
            found = None
            for ring in range(1, int(NUDGE_MAX_CM / 5.0) + 1):
                r = ring * 5.0
                steps = max(8, int(2 * math.pi * r / 5.0))
                for k in range(steps):
                    dx, dy = dir_of_yaw(360.0 * k / steps)
                    q = rect(x + dx * r, y + dy * r, yaw, w, d)
                    if self.poly_ok(q, p["room_id"]) and not any(
                            sat_penetration(q, o) > OVERLAP_TOL_CM for _i, o in self.footprints):
                        found = (x + dx * r, y + dy * r, r)
                        break
                if found:
                    break
            if found:
                self.warnings.append(f"{p['id']}: nudged {found[2]:g} cm to the nearest legal point")
                x, y = found[0], found[1]
        self.add(p["id"], p["room_id"], f"furnishing:{p['id']}", cls, mid, x, y, yaw, w, d, h, anchor=anchor,
                 z_cm=p.get("z_cm"), layer=layer, strict=bool(p.get("keep", True)))

    # -------------------------------------------------------------------------- doors
    def door_hardware(self, ceiling_cm):
        out = []
        for op in self.plan["openings"]:                   # plan order
            if op["kind"] != "door":
                continue
            rooms = [self.rooms.get(r) for r in op.get("rooms", [])]
            if len(rooms) != 2 or any(r is None or r.get("is_outdoor") for r in rooms):
                continue
            cfg = self.door_cfg.get(op["id"]) or {}
            cx, cy, ux, uy, nx, ny = pg.door_frame(op)
            hw = float(op["width_cm"]) / 2.0
            head = float(op["head_cm"])
            inf = pg.door_infill(self.plan, op, ceiling_cm)
            n_lo, n_hi = inf["n_range_cm"]
            # the swing room and the hinge: candidates in preference order -- the more private room first
            # (bathroom > storage > bedroom > the rest), each with the jamb nearer that room's side wall
            # first; the first whose leaf, swept 0 -> 90 deg, strikes no placed piece and passes no camera
            # nearer than LEAF_CAMERA_MIN_CM wins. `furnishing.doors.<id>` pins either choice.
            order = sorted(rooms, key=lambda r: (PRIVACY.get(r["type"], 9), op["rooms"].index(r["id"])))
            if cfg.get("swing_room"):
                order = [r for r in order if r["id"] == cfg["swing_room"]]
            cands = []
            for room in order:
                sl = self.loops[room["id"]]
                s_sw = 1.0 if pg.point_in_polygon((cx + nx * (n_hi + 10.0), cy + ny * (n_hi + 10.0)), sl) else -1.0
                face = n_hi if s_sw > 0 else n_lo
                reach = {}
                for h in (-1.0, 1.0):
                    jx = cx + ux * h * hw + nx * (face + s_sw * 15.0)
                    jy = cy + uy * h * hw + ny * (face + s_sw * 15.0)
                    ts = pg.ray_polygon(jx, jy, ux * h, uy * h, sl, 400.0)
                    reach[h] = ts[0] if ts else 400.0
                first = -1.0 if reach[-1.0] <= reach[1.0] else 1.0
                hinges = [first, -first]
                if cfg.get("hinge") in ("+u", "-u"):
                    hinges = [1.0 if cfg["hinge"] == "+u" else -1.0]
                for h in hinges:
                    cands.append((room["id"], s_sw, h, reach))
            verdicts = []
            pick = None
            for rid, s_sw, h, reach in cands:
                why = None
                for ang in (30.0, 60.0, 90.0):
                    sweep = self._leaf_poly(cx, cy, ux, uy, nx, ny, hw, n_lo, n_hi, s_sw, h, ang)
                    hit = next((oid for oid, fp in self.footprints if sat_penetration(sweep, fp) > 0.5), None)
                    if hit:
                        why = f"strikes {hit} at {ang:g} deg"
                        break
                    near = min(((dist_point_poly((c[2], c[3]), sweep), c[0]) for c in self.cams), default=None)
                    if near and near[0] < LEAF_CAMERA_MIN_CM:
                        why = f"passes {near[0]:.0f} cm from {near[1]} at {ang:g} deg"
                        break
                verdicts.append(f"{rid}/{'+u' if h > 0 else '-u'}: {why or 'clear'}")
                if why is None and pick is None:
                    pick = (rid, s_sw, h, reach)
            if pick is None:
                pick = cands[0]
                verdicts.append("no candidate is clear: the first is kept")
                self.warnings.append(f"door {op['id']}: no swing is clear ({'; '.join(verdicts[:-1])}) - kept "
                                     f"{pick[0]}")
            swing, s_sw, hs, reach = pick
            swing_rule = ("furnishing.doors" if cfg.get("swing_room") else
                          "the more private room unless its leaf strikes a piece or passes a camera")
            hinge_rule = (f"candidates in order: {'; '.join(verdicts)} (side-wall reach -u {reach[-1.0]:.0f} / "
                          f"+u {reach[1.0]:.0f} cm)")
            # ajar?
            if cfg.get("open_deg") is not None:
                open_deg = float(cfg["open_deg"])
                seen_by, open_rule = [], "furnishing.doors"
            else:
                walls = [pg.clean_ring(w["polygon_cm"]) for w in self.plan["walls"]]
                seen_by = []
                for cid, _rid, px, py in self.cams:
                    if math.hypot(px - cx, py - cy) > DOOR_SIGHT_MAX_CM:
                        continue
                    if not any(segment_hits_polygon((px, py), (cx, cy), wpoly) for wpoly in walls):
                        seen_by.append(cid)
                open_deg = DOOR_AJAR_DEG if seen_by else 0.0
                open_rule = (f"ajar {DOOR_AJAR_DEG:g} deg: a camera sees the doorway" if seen_by else
                             "closed: no camera sees the doorway")
                # OQ-G12 (v0.1.1, navigator rule): a door the WALK goes through -- both its rooms hold a camera --
                # opens wider (DOOR_WALK_DEGS, widest first) when the leaf, swept 0 -> that angle in 5-deg steps,
                # strikes no placed piece and passes no camera nearer than LEAF_CAMERA_MIN_CM; else it stays at 12.
                cam_rooms = {c[1] for c in self.cams}
                if seen_by and all(r in cam_rooms for r in op["rooms"]):
                    for want in DOOR_WALK_DEGS:
                        bad = None
                        for k in range(1, int(want // 5.0) + 1):
                            ang = min(want, 5.0 * k)
                            sweep = self._leaf_poly(cx, cy, ux, uy, nx, ny, hw, n_lo, n_hi, s_sw, hs, ang)
                            hit = next((oid for oid, fp in self.footprints if sat_penetration(sweep, fp) > 0.5), None)
                            near = min(((dist_point_poly((c[2], c[3]), sweep), c[0]) for c in self.cams), default=None)
                            if hit or (near and near[0] < LEAF_CAMERA_MIN_CM):
                                bad = (f"strikes {hit}" if hit else f"passes {near[0]:.0f} cm from {near[1]}") + f" at {ang:g} deg"
                                break
                        if bad is None:
                            open_deg = want
                            open_rule = (f"open {want:g} deg: the walk goes through it (both rooms hold a camera) and "
                                         f"the leaf swept to {want:g} deg is clear")
                            break
                        open_rule += f"; {want:g} deg refused ({bad})"
            out.append(self._door_parts(op, cx, cy, ux, uy, nx, ny, hw, head, n_lo, n_hi, s_sw, hs, open_deg,
                                        swing, swing_rule, hinge_rule, open_rule, seen_by))
        self.doors = out
        return out

    def entrance_dressing(self, ceiling_cm):
        """The entrance door already has a SOLID leaf (build_scene's LEAF_<id>, T13) in the skirting white --
        flush in a white wall it reads as wall, exactly the interior doors' defect. Dress it: the leaf
        re-coloured (`leaf_material`), architraves on both faces, a lever on both faces at the jamb FARTHER
        from the entrance room's side wall (the hinge goes to the nearer one, as for the interior doors)."""
        out = []
        for op in self.plan["openings"]:                   # plan order
            if op["kind"] != "entrance_door":
                continue
            inside = next((r for r in op.get("rooms", []) if r in self.rooms), None)
            if inside is None:
                continue
            cx, cy, ux, uy, nx, ny = pg.door_frame(op)
            hw = float(op["width_cm"]) / 2.0
            head = float(op["head_cm"])
            inf = pg.door_infill(self.plan, op, ceiling_cm)
            n_lo, n_hi = inf["n_range_cm"]
            sl = self.loops[inside]
            s_in = 1.0 if pg.point_in_polygon((cx + nx * (n_hi + 10.0), cy + ny * (n_hi + 10.0)), sl) else -1.0
            face = n_hi if s_in > 0 else n_lo
            reach = {}
            for h in (-1.0, 1.0):
                jx = cx + ux * h * hw + nx * (face + s_in * 15.0)
                jy = cy + uy * h * hw + ny * (face + s_in * 15.0)
                ts = pg.ray_polygon(jx, jy, ux * h, uy * h, sl, 400.0)
                reach[h] = ts[0] if ts else 400.0
            hinge = -1.0 if reach[-1.0] <= reach[1.0] else 1.0
            hu = -hinge * (hw - 8.0)                        # the handle side

            def box_un(u0, u1, n0, n1, z0, z1, mat, name):
                pts = [(cx + ux * u + nx * n, cy + uy * u + ny * n) for u, n in ((u0, n0), (u1, n0), (u1, n1), (u0, n1))]
                return {"name": name, "poly_cm": [[round(a, 3), round(b, 3)] for a, b in pts], "z_cm": [z0, z1],
                        "material": mat}
            parts = []
            cin, cout, top = hw - 0.3, hw + CASING_W_CM, head + CASING_W_CM
            oid = op["id"]
            for sgn, nf, tag in ((1.0, n_hi, "p"), (-1.0, n_lo, "m")):
                a0, a1 = sorted((nf - sgn * 0.5, nf + sgn * CASING_PROUD_CM))
                b0, b1 = sorted((nf - sgn * 0.5, nf + sgn * (CASING_PROUD_CM + 0.3)))
                parts.append(box_un(cin, cout, a0, a1, 0.0, head + 0.5, "wood_walnut", f"ENTRY_{oid}_casing_{tag}_p"))
                parts.append(box_un(-cout, -cin, a0, a1, 0.0, head + 0.5, "wood_walnut", f"ENTRY_{oid}_casing_{tag}_m"))
                parts.append(box_un(-cout - 0.5, cout + 0.5, b0, b1, head, top, "wood_walnut",
                                    f"ENTRY_{oid}_casing_{tag}_head"))
            lt = ENTRY_LEAF_T_CM / 2.0
            for sgn, tag in ((1.0, "p"), (-1.0, "m")):
                def nn(v0, v1):
                    return sorted((sgn * (lt + v0), sgn * (lt + v1)))
                r0, r1 = nn(-0.2, 1.0)
                parts.append(box_un(hu - 2.5, hu + 2.5, r0, r1, 101.5, 106.5, "metal_black", f"ENTRY_{oid}_rose_{tag}"))
                k0, k1 = nn(0.8, 5.5)
                parts.append(box_un(hu - 0.8, hu + 0.8, k0, k1, 103.2, 104.8, "metal_black", f"ENTRY_{oid}_neck_{tag}"))
                l0, l1 = nn(4.5, 6.3)
                lu0, lu1 = sorted((hu - 0.9 * hinge, hu + 13.0 * hinge))
                parts.append(box_un(lu0, lu1, l0, l1, 103.0, 105.0, "metal_black", f"ENTRY_{oid}_lever_{tag}"))
            out.append({"opening": oid, "leaf_object": f"LEAF_{oid}", "leaf_material": "wood_walnut",
                        "hinge": "+u" if hinge > 0 else "-u", "handle_u_cm": round(hu, 2),
                        "rule": f"hinge at the jamb nearer {inside}'s side wall (reach -u {reach[-1.0]:.0f} / +u "
                                f"{reach[1.0]:.0f} cm); the handle on the other jamb, both faces",
                        "parts": parts})
        self.entrance = out
        return out

    def _leaf_poly(self, cx, cy, ux, uy, nx, ny, hw, n_lo, n_hi, s_sw, hs, open_deg):
        clear = hw - LINING_CM
        n_mid = (n_lo + n_hi) / 2.0
        leaf_w = 2.0 * clear - 2.0 * LEAF_GAP_CM
        th = math.radians(open_deg)
        a = (-hs * ux, -hs * uy)
        b = (s_sw * nx, s_sw * ny)
        e = (math.cos(th) * a[0] + math.sin(th) * b[0], math.cos(th) * a[1] + math.sin(th) * b[1])
        t = (math.sin(th) * a[0] - math.cos(th) * b[0], math.sin(th) * a[1] - math.cos(th) * b[1])
        hu, hn = hs * (clear - LEAF_GAP_CM), n_mid + s_sw * LEAF_T_CM / 2.0
        H = (cx + ux * hu + nx * hn, cy + uy * hu + ny * hn)
        return [(H[0] + e[0] * se + t[0] * st, H[1] + e[1] * se + t[1] * st)
                for se, st in ((0.0, 0.0), (leaf_w, 0.0), (leaf_w, LEAF_T_CM), (0.0, LEAF_T_CM))]

    def _door_parts(self, op, cx, cy, ux, uy, nx, ny, hw, head, n_lo, n_hi, s_sw, hs, open_deg,
                    swing, swing_rule, hinge_rule, open_rule, seen_by):
        oid = op["id"]

        def un(u, n):
            return (cx + ux * u + nx * n, cy + uy * u + ny * n)

        def box_un(u0, u1, n0, n1, z0, z1, mat, name):
            pts = [un(u, n) for u, n in ((u0, n0), (u1, n0), (u1, n1), (u0, n1))]
            return {"name": name, "poly_cm": [[round(a, 3), round(b, 3)] for a, b in pts], "z_cm": [z0, z1],
                    "material": mat}
        parts = []
        clear = hw - LINING_CM
        # jamb lining (embedded 0.5 cm into the cut faces) and the head lining
        parts.append(box_un(clear, hw + 0.5, n_lo, n_hi, 0.0, head, "wood_oak", f"DOOR_{oid}_jamb_p"))
        parts.append(box_un(-hw - 0.5, -clear, n_lo, n_hi, 0.0, head, "wood_oak", f"DOOR_{oid}_jamb_m"))
        parts.append(box_un(-hw - 0.5, hw + 0.5, n_lo, n_hi, head - LINING_CM, head + 0.5, "wood_oak",
                            f"DOOR_{oid}_head"))
        # architraves on both faces: posts stop inside the head casing, the head stands 0.3 cm prouder and
        # 0.5 cm longer -- no two visible faces coplanar (GENERAL-POLYGONS 4, defect 4)
        cin = clear - 0.3
        cout = clear + CASING_W_CM
        top = head - LINING_CM + CASING_W_CM
        for sgn, nf, tag in ((1.0, n_hi, "p"), (-1.0, n_lo, "m")) if DOOR_STYLE != "zero-line" else ():
            a0, a1 = sorted((nf - sgn * 0.5, nf + sgn * CASING_PROUD_CM))
            b0, b1 = sorted((nf - sgn * 0.5, nf + sgn * (CASING_PROUD_CM + 0.3)))
            parts.append(box_un(cin, cout, a0, a1, 0.0, head - LINING_CM + 0.5, "wood_oak", f"DOOR_{oid}_casing_{tag}_p"))
            parts.append(box_un(-cout, -cin, a0, a1, 0.0, head - LINING_CM + 0.5, "wood_oak", f"DOOR_{oid}_casing_{tag}_m"))
            parts.append(box_un(-cout - 0.5, cout + 0.5, b0, b1, head - LINING_CM, top, "wood_oak",
                                f"DOOR_{oid}_casing_{tag}_head"))
        # the leaf: hinged at (hs * (clear - gap), n_mid + s_sw * T/2), free edge swinging into the swing room
        n_mid = (n_lo + n_hi) / 2.0
        leaf_w = 2.0 * clear - 2.0 * LEAF_GAP_CM
        th = math.radians(open_deg)
        a = (-hs * ux, -hs * uy)                            # hinge -> free edge, closed
        b = (s_sw * nx, s_sw * ny)                          # into the swing room
        e = (math.cos(th) * a[0] + math.sin(th) * b[0], math.cos(th) * a[1] + math.sin(th) * b[1])
        t = (math.sin(th) * a[0] - math.cos(th) * b[0], math.sin(th) * a[1] - math.cos(th) * b[1])
        H = un(hs * (clear - LEAF_GAP_CM), n_mid + s_sw * LEAF_T_CM / 2.0)

        def leaf_pt(se, st):
            return (H[0] + e[0] * se + t[0] * st, H[1] + e[1] * se + t[1] * st)

        def box_et(e0, e1, t0, t1, z0, z1, mat, name):
            pts = [leaf_pt(se, st) for se, st in ((e0, t0), (e1, t0), (e1, t1), (e0, t1))]
            return {"name": name, "poly_cm": [[round(x, 3), round(y, 3)] for x, y in pts], "z_cm": [z0, z1],
                    "material": mat}
        z_leaf0, z_leaf1 = 1.0, head - LINING_CM - LEAF_GAP_CM
        parts.append(box_et(0.0, leaf_w, 0.0, LEAF_T_CM, z_leaf0, z_leaf1, "wood_oak", f"DOOR_{oid}_leaf"))
        he = leaf_w - 6.0
        for side, (t_face, sgn) in (("a", (0.0, -1.0)), ("b", (LEAF_T_CM, 1.0))):
            def tt(v0, v1):
                return sorted((t_face + sgn * v0, t_face + sgn * v1))
            r0, r1 = tt(-0.2, 1.0)
            parts.append(box_et(he - 2.5, he + 2.5, r0, r1, 101.5, 106.5, "metal_black", f"DOOR_{oid}_rose_{side}"))
            k0, k1 = tt(0.8, 5.5)
            parts.append(box_et(he - 0.8, he + 0.8, k0, k1, 103.2, 104.8, "metal_black", f"DOOR_{oid}_neck_{side}"))
            l0, l1 = tt(4.5, 6.3)
            parts.append(box_et(he - 13.0, he + 0.9, l0, l1, 103.0, 105.0, "metal_black", f"DOOR_{oid}_lever_{side}"))
        return {"opening": oid, "rooms": op["rooms"], "swing_room": swing, "swing_rule": swing_rule,
                "hinge": "+u" if hs > 0 else "-u", "hinge_rule": hinge_rule, "open_deg": open_deg,
                "open_rule": open_rule, "seen_by": seen_by, "clear_width_cm": round(2.0 * clear, 2),
                "leaf_cm": [round(leaf_w, 2), LEAF_T_CM, round(z_leaf1 - z_leaf0, 2)],
                "wall_body_n_cm": [n_lo, n_hi], "parts": parts}

    # -------------------------------------------------------------------------- the run
    def run(self, ceiling_cm):
        fx = self.plan.get("fixtures") or []
        order = ([f for f in fx if f["kind"] == "tall_unit"] + [f for f in fx if f["kind"] == "wardrobe"]
                 + [f for f in fx if f["kind"] not in ("tall_unit", "wardrobe")])   # stable within each group
        handled = {"sofa": self.fx_sofa, "tv_unit": self.fx_tv, "bed": self.fx_bed, "table": self.fx_table,
                   "vanity": self.fx_vanity, "tall_unit": self.fx_tall, "counter": self.fx_counter,
                   "wardrobe": self.fx_wardrobe, "shower": self.fx_shower}
        for f in order:
            k = f.get("kind")
            if k in handled:
                handled[k](f)
            elif k in KIND_CLASS:
                self.fx_simple(f, KIND_CLASS[k])
            else:
                self.warnings.append(f"{f.get('id')}: kind {k!r} has no furnishing rule - not built")
        for p in self.extra:                               # plan order
            self.piece(p)
        self.door_hardware(ceiling_cm)
        self.entrance_dressing(ceiling_cm)
        return self.result()

    def result(self):
        return {"version": VERSION, "placements": self.placements, "procedural": self.procedural,
                "doors": self.doors, "entrance": self.entrance, "dropped": self.dropped, "warnings": self.warnings,
                "bars_cm": {"camera_bubble": CAMERA_BUBBLE_CM, "inside_tol": INSIDE_TOL_CM,
                            "overlap_tol": OVERLAP_TOL_CM},
                "rooms": {rid: sorted({p["model"] for p in self.placements if p["room_id"] == rid}
                                      | {f"procedural:{q['kind']}" for q in self.procedural if q["room_id"] == rid})
                          for rid in self.rooms}}


def plan_furnishing(plan, style, ceiling_cm):
    return Planner(plan, style).run(ceiling_cm)


# ===================================================================================== selftest + CLI
def selftest():
    fails = []

    def ok(cond, what):
        print(f"  [{'PASS' if cond else 'FAIL'}] {what}")
        if not cond:
            fails.append(what)
    ok(abs(yaw_of(0, -1) - 0.0) < 1e-9 and abs(yaw_of(1, 0) - 90.0) < 1e-9, "yaw: -y is 0, +x is 90")
    dx, dy = dir_of_yaw(90.0)
    ok(abs(dx - 1) < 1e-9 and abs(dy) < 1e-9, "dir_of_yaw inverts yaw_of")
    r = rect(0, 0, 0.0, 100, 50)
    ok(abs(abs(pg.shoelace(r)) - 5000) < 1e-6, "rect area w*d")
    ok(max(p[1] for p in r) == 25 and min(p[0] for p in r) == -50, "rect at yaw 0: width on x, depth on y")
    sq = [(0, 0), (100, 0), (100, 100), (0, 100)]
    ok(sat_penetration(sq, [(90, 0), (200, 0), (200, 100), (90, 100)]) > 9.9, "SAT: 10 cm overlap")
    ok(sat_penetration(sq, [(101, 0), (200, 0), (200, 100), (101, 100)]) <= 0, "SAT: apart")
    loop = [(0, 0), (400, 0), (400, 300), (0, 300)]
    ok(poly_inside(rect(200, 150, 0, 100, 50), loop) and not poly_inside(rect(10, 150, 0, 100, 50), loop),
       "poly_inside")
    ne = nearest_wall_edge((200, 20), loop, ["wall"] * 4)
    ok(ne is not None and abs(ne[1][1] - 1.0) < 1e-9, "nearest wall edge's inward normal points into the room")
    # a toy room, a sofa against the south wall: the front must face north
    style = {"models": {"S": {"scaled_bbox_cm": [200, 90, 75], "measured_bbox_cm": [100, 45, 37.5],
                              "scale_xyz": [2, 2, 2], "material_policy": "restyle"}},
             "classes": {"sofa": {"models": ["S"]}}}
    plan = {"rooms": [{"id": "r", "type": "living", "is_outdoor": False, "loop": loop, "edge_kinds": ["wall"] * 4}],
            "camera_points": [], "openings": [], "walls": [],
            "fixtures": [{"id": "s", "room_id": "r", "kind": "sofa", "centre_cm": [200, 250], "angle_deg": 0,
                          "size_cm": [200, 90], "height_cm": 75, "z_cm": 0}]}
    res = plan_furnishing(plan, style, 290)
    s = res["placements"][0] if res["placements"] else None
    ok(s is not None and abs(s["yaw_deg"] - 0.0) < 1e-6, f"sofa against the +y wall faces -y (yaw {s and s['yaw_deg']})")
    ok(s is not None and abs(s["scale_xyz"][0] - 2.0) < 1e-6, "fit scale = target / raw")
    plan["camera_points"] = [{"id": "c", "room_id": "r", "x": 200, "y": 250}]
    res = plan_furnishing(plan, style, 290)
    ok(res["placements"] and res["warnings"], "a plan-truth piece in a camera bubble is KEPT and warned")
    print(f"selftest: {len(fails)} failure(s)")
    return 1 if fails else 0


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("plan", nargs="?")
    ap.add_argument("--style", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                                    "catalog", "style-habait-modern.json"))
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    if not a.plan:
        ap.error("plan.json required")
    with open(a.plan, encoding="utf-8") as fh:
        plan = json.load(fh)
    with open(a.style, encoding="utf-8") as fh:
        style = json.load(fh)
    res = plan_furnishing(plan, style, float(plan["plan_meta"].get("ceiling_height_cm", 290)))
    if a.json:
        print(json.dumps(res, indent=1))
        return 0
    for p in res["placements"]:
        print(f"{p['room_id']:18s} {p['id']:22s} {p['model'][-34:]:34s} ({p['x_cm']:7.1f},{p['y_cm']:7.1f}) yaw "
              f"{p['yaw_deg']:6.1f} {p['width_cm']:5.0f}x{p['depth_cm']:4.0f} {p['layer']:6s} {'; '.join(p['checks'])}")
    for q in res["procedural"]:
        print(f"{q['room_id']:18s} {q['id']:22s} procedural:{q['kind']:24s} {len(q['parts'])} parts {'; '.join(q['checks'])}")
    for d in res["doors"]:
        print(f"door {d['opening']:6s} swing {d['swing_room']:16s} hinge {d['hinge']} open {d['open_deg']:g} "
              f"({d['open_rule']}; seen by {','.join(d['seen_by'])}) clear {d['clear_width_cm']}")
    for d in res["dropped"]:
        print(f"DROPPED {d['id']}: {'; '.join(d['why'])}")
    for w in res["warnings"]:
        print(f"WARN {w}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

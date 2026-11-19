#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""furnish_from_plan.py -- furnish a whole general-polygon apartment from its plan, with NO hand placements.

Board `habait-workplan-2026-11-02`, card 07 (B1) · habait-4b · pure Python for the planning half (no
Blender; `plan_general` + `general_furnish` are imported READ-ONLY, never edited); shapely + Pillow only for
the audit and the previews, imported lazily, so the generator itself also runs under Blender's Python.

WHY. `general_furnish.py` (D-WQ-36) already turns `fixtures[]` -- the furniture the sales plan DRAWS --
into catalog models and procedural closets/showers. Everything else (the sink/hob/uppers choice, a rug, a
console, terrace furniture) came from a `furnishing` block whose positions were read BY HAND off the 846
drawing (`tours/apt846-furnished/plan.json`, 2026-10-29). That does not scale to the next apartment.
This module writes that block by RULE, from the room types and the traced geometry:

  1. fixtures: the plan's own `fixtures[]` are plan truth and pass through untouched. A room whose role
     needs a drawn fixture the plan lacks (card 01's intake emits `fixtures: []` today) gets a TEMPLATE
     fixture of the same schema (`source: "template:..."`) on a wall run measured from the walls: a
     kitchen run (+ tall unit), a bed (+ wardrobe when no closet room opens onto the bedroom), WC +
     vanity + shower, sofa + TV unit + coffee table, a dining table. A drawn `island` (schema enum, no
     general_furnish rule) is translated to a counter fronting the nearest run.
  2. fixture_hints: the sink on the longest counter run, the hob on the next run (or two modules away
     on the same one), uppers only on a run whose back is a solid wall with no glass within 25 cm.
  3. pieces[]: per room role -- living: rug under the coffee table, floor lamp at a sofa end, art over
     a wall-backed sofa, a corner plant; entrance: console + art + doormat; bedroom: a rug under the
     bed's foot; bathroom: a mat in front of the basin; terrace: the outdoor set + plants (or an
     armchair facing out on a small one); dining/hall/corridor: art on a free wall. Every piece is the
     first legal candidate of a ranked, deterministic list (no randomness) and is emitted `keep: false`,
     so general_furnish DROPS rather than keeps anything its own checks refuse.
  4. the result is run through `general_furnish.Planner` exactly as `build_scene.py` would, and AUDITED
     independently: openings blocked (free passage < min(width - 4, 80) cm through a 60 cm approach zone
     each side, or a door leaf striking a piece over 0..90 deg), items intersecting walls or panes
     (footprint shrunk 1.5 cm), items outside their room, unrealistic sizes, floor coverage, and a 50 cm
     walkway from each room's camera to its openings (reported).

OUTPUT (`--out DIR`): `placements.json` (the `furnishing` block + `fixtures_added` = exactly what
build_scene consumes, plus the resolved general_furnish result), `plan.furnished.json` (the input plan +
those two, ready for `build_scene.py` unchanged), `report.json`, `preview-<room>.png` per room and
`preview-all.png`. Frame: plan cm, +y DOWN (SCHEMA §1); yaw = compass bearing of a model's front
(0 = -y, 90 = +x), angle_deg = an axis from +x in the raster frame (general_furnish's conventions).

    python furnish_from_plan.py --plan <plan.json> --out <dir> [--style <lock>] [--selftest] [--json]
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import plan_general as pg  # noqa: E402  (read-only)
import general_furnish as gf  # noqa: E402  (read-only)

VERSION = "0.1.0"
SCHEMA_ID = "habait.furnish-from-plan/0.1"
DEFAULT_STYLE = os.path.join(os.path.dirname(HERE), "catalog", "style-habait-modern.json")

# ------------------------------------------------------------------------------------------- the bars
PROBE_OUT_CM = 9.0          # a counter's back probe stands this far behind it
PROBE_DEPTHS_CM = (4.0, 8.0, 12.0, 16.0)   # an edge is wall-backed when any probe this far outside lies in a wall
RUN_STEP_CM = 5.0           # wall-run sampling and slide pitch
RUN_TURN_DEG = 6.0          # a run breaks where the loop turns more than this
WALL_GAP_CM = 1.5           # a template piece stands this far off its wall face
TEMPLATE_CAMERA_CM = 40.0   # a template floor piece stays this far from every camera (general_furnish: 25)
VIRTUAL_ZONE_CM = 60.0      # a template floor piece entering this band either side of an open-plan boundary...
OPEN_KEEP_SHARE = 0.6       # ...unless that boundary keeps a free passage of max(PASSAGE_MIN_CM, this x its width)
                            # (between two outdoor rooms: PASSAGE_MIN_CM alone)
GLASS_NEAR_CM = 25.0        # a counter whose back has glass this near gets no uppers
AUDIT_DEPTH_CM = 60.0       # the approach zone each side of an opening (general_furnish's DOOR_ZONE_CM)
PASSAGE_MIN_CM = 80.0       # an opening keeps a free passage of min(width - 4, this)
WALL_TOL_CM = 1.5           # a footprint shrunk by this may not intersect a wall or a pane...
WALL_TOL_AREA_CM2 = 4.0     # ...by more than this area
WALKWAY_CM = 50.0           # the reported walkway (camera -> each opening of its room)
SMALL_TERRACE_M2 = 6.0
SOLID_RES_CM = 0.5          # the wall/pane raster every dense test reads (the audit stays exact, in shapely)
_MASKS = {}
SMALL_ROOM_CAMERA_CM = 30.0 # a small terrace's one chair: general_furnish's 25 cm bar + 5
ROLE_FIXTURES = {           # what a room of this role needs DRAWN; a missing kind gets a template fixture
    "living": ("tv_unit", "sofa", "table"), "kitchen": ("counter",), "dining": ("table",),
    "bedroom": ("bed", "wardrobe"), "bathroom": ("wc", "vanity", "shower"), "toilet": ("wc", "vanity"),
    "wardrobe": ("wardrobe",)}
SIZE_RULES = {              # class -> ((min w, max w), (min d, max d)) cm, the realistic envelope (audit)
    "bed_double": ((140, 200), (190, 220)), "sofa": ((150, 320), (75, 110)), "armchair": ((60, 110), (60, 110)),
    "dining_table": ((80, 240), (75, 130)), "coffee_table": ((50, 140), (40, 130)),
    "kitchen_cabinet": ((30, 90), (55, 70)), "kitchen_sink": ((30, 90), (55, 70)), "stove": ((30, 90), (55, 70)),
    "fridge": ((55, 95), (55, 75)), "nightstand": ((35, 65), (30, 55)), "toilet": ((33, 45), (50, 75)),
    "bathroom_sink": ((40, 130), (35, 60)), "tv_unit": ((90, 200), (30, 60)), "dining_chair": ((38, 60), (38, 60)),
    "closet": ((40, 400), (50, 66)), "shower": ((70, 220), (70, 120))}


# ===================================================================================== small helpers
def unit(dx, dy):
    L = math.hypot(dx, dy)
    return (dx / L, dy / L) if L > 1e-9 else (0.0, 0.0)


def axis_deg(dx, dy):
    """An axis from +x in the raster frame, [0, 360) (the openings'/fixtures' angle_deg)."""
    return math.degrees(math.atan2(dy, dx)) % 360.0


def oriented(poly):
    """Positively oriented in the y-down frame (SCHEMA: shoelace > 0)."""
    return list(poly) if pg.shoelace(poly) > 0 else list(reversed(poly))


def centroid(poly):
    return (sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly))


def r2(v):
    return round(float(v), 2)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def fixture_rect(f):
    """A fixture's footprint from its hand-read box (centre, angle = long axis, size = [along, across])."""
    cx, cy = (float(v) for v in f["centre_cm"])
    a = math.radians(float(f["angle_deg"]))
    L = (math.cos(a), math.sin(a))
    N = (-L[1], L[0])
    s0, s1 = (float(v) for v in f["size_cm"])
    return pg.oriented_rect(cx, cy, L[0], L[1], N[0], N[1], -s0 / 2.0, s0 / 2.0, -s1 / 2.0, s1 / 2.0)


def room_role(room, plan, fixtures):
    t = room.get("type")
    name = f"{room.get('name_en') or ''} {room.get('id')}".lower()
    if room.get("is_outdoor"):
        return "terrace" if t == "balcony" else "service" if t == "service_balcony" else "outdoor"
    if t == "hall":
        if any(op.get("kind") == "entrance_door" and room["id"] in op.get("rooms", []) for op in plan["openings"]):
            return "entrance"
        if "dining" in name or float(room.get("area_m2") or 0) >= 8.0 or any(
                f["room_id"] == room["id"] and f["kind"] == "table" for f in fixtures):
            return "dining"
        return "hall"
    if t == "storage":
        if "wardrobe" in name or "closet" in name or any(
                f["room_id"] == room["id"] and f["kind"] == "wardrobe" for f in fixtures):
            return "wardrobe"
        return "storage"
    return {"living": "living", "kitchen": "kitchen", "bedroom": "bedroom", "bathroom": "bathroom",
            "toilet": "toilet", "safe_room": "safe_room", "corridor": "corridor"}.get(t, "other")


class Run:
    """A straight, wall-backed stretch of a room loop: start point, unit direction, inward normal, length."""
    __slots__ = ("room_id", "p0", "u", "n", "length", "backing")

    def __init__(self, room_id, p0, p1, inward_sign, backing):
        self.room_id, self.backing = room_id, backing
        self.p0 = p0
        self.u = unit(p1[0] - p0[0], p1[1] - p0[1])
        self.n = (-self.u[1] * inward_sign, self.u[0] * inward_sign)
        self.length = math.hypot(p1[0] - p0[0], p1[1] - p0[1])

    def at(self, s, off):
        return (self.p0[0] + self.u[0] * s + self.n[0] * off, self.p0[1] + self.u[1] * s + self.n[1] * off)


# ===================================================================================== the context
class Ctx:
    """Geometry of one plan: general_furnish's own legality test (walls, panes, rooms, door zones) plus the
    template bars above, and the running list of footprints a new piece may not enter."""

    def __init__(self, plan, style):
        self.plan, self.style = plan, style
        self.pl = gf.Planner(plan, style)                  # helpers only: poly_ok, door_zones, open_to, cams
        self.ceiling = float((plan.get("plan_meta") or {}).get("ceiling_height_cm", 290))
        self.rooms, self.loops = self.pl.rooms, self.pl.loops
        self.walls = [(w["id"], pg.clean_ring(w["polygon_cm"])) for w in plan.get("walls", [])]
        self.walls = [(i, p, pg.bbox(p)) for i, p in self.walls]
        self.panes = [(q["id"], pg.clean_ring(q["polygon_cm"])) for q in plan.get("panes", [])]
        self.panes = [(i, p, pg.bbox(p)) for i, p in self.panes]
        self.virtual_zones = []      # (id, zone poly, (cx, cy), (ux, uy), half width) of every open-plan opening
        for op in plan.get("openings", []):
            if pg.is_virtual_opening(op, self.ceiling) or (op.get("kind") == "opening"):
                cx, cy, ux, uy, nx, ny = pg.door_frame(op)
                hw = float(op["width_cm"]) / 2.0
                both_out = all(r in self.rooms and self.rooms[r].get("is_outdoor") for r in op.get("rooms", []))
                self.virtual_zones.append((f"open-zone:{op['id']}", pg.oriented_rect(
                    cx, cy, ux, uy, nx, ny, -hw, hw, -VIRTUAL_ZONE_CM, VIRTUAL_ZONE_CM), (cx, cy), (ux, uy), hw,
                    both_out))
        self._mask_cache = None
        self.sweeps = []         # (id, convex poly) the floor a door leaf sweeps 0 -> 90 deg (from a resolved run)
        self.footprints = []     # (id, poly) floor pieces
        self.rugs = []
        self.wall_items = []
        self._runs = {}

    # ------------------------------------------------------------------ point tests
    @staticmethod
    def _in(pt, items):
        x, y = pt
        return any(bb[0] <= x <= bb[2] and bb[1] <= y <= bb[3] and pg.point_in_polygon(pt, poly)
                   for _i, poly, bb in items)

    def _masks(self):
        """(x0, y0, wall mask, pane mask) at SOLID_RES_CM, built once per wall/pane set (pg's scanline fill:
        a cell is solid iff its centre is)."""
        key = hashlib.md5(json.dumps([[p for _i, p, _b in self.walls], [p for _i, p, _b in self.panes]],
                                     default=list).encode()).hexdigest()
        if key not in _MASKS:
            import numpy as np
            pts = [q for _i, p, _b in self.walls + self.panes for q in p] or [(0.0, 0.0)]
            x0 = min(q[0] for q in pts) - 50.0
            y0 = min(q[1] for q in pts) - 50.0
            w = int((max(q[0] for q in pts) + 50.0 - x0) / SOLID_RES_CM) + 1
            h = int((max(q[1] for q in pts) + 50.0 - y0) / SOLID_RES_CM) + 1
            wm, pm = np.zeros((h, w), dtype=bool), np.zeros((h, w), dtype=bool)
            for _i, poly, _b in self.walls:
                pg._raster_polygon(wm, poly, x0, y0, SOLID_RES_CM)
            for _i, poly, _b in self.panes:
                pg._raster_polygon(pm, poly, x0, y0, SOLID_RES_CM)
            _MASKS.clear()
            _MASKS[key] = (x0, y0, wm, pm)
        return _MASKS[key]

    def _cell(self, pt, which):
        if self._mask_cache is None:
            self._mask_cache = self._masks()
        x0, y0, wm, pm = self._mask_cache
        m = wm if which == 0 else pm
        i, j = int((pt[0] - x0) / SOLID_RES_CM), int((pt[1] - y0) / SOLID_RES_CM)
        return bool(m[j, i]) if 0 <= j < m.shape[0] and 0 <= i < m.shape[1] else False

    def in_wall(self, pt):
        return self._cell(pt, 0)

    def in_pane(self, pt):
        return self._cell(pt, 1)

    def solid(self, pt):
        return self._cell(pt, 0) or self._cell(pt, 1)

    def near_pane(self, pt, r):
        x, y = pt
        for _i, poly, bb in self.panes:
            if bb[0] - r <= x <= bb[2] + r and bb[1] - r <= y <= bb[3] + r:
                if gf.dist_point_poly(pt, poly) <= r:
                    return True
        return False

    def inward_sign(self, room_id):
        return 1.0 if pg.shoelace(self.loops[room_id]) > 0 else -1.0

    # ------------------------------------------------------------------ wall runs
    def runs(self, room_id, backing="wall"):
        """Straight wall-backed stretches of the loop, longest first (ties: loop order). Measured, not read
        from edge_kinds: a probe PROBE_OUT_CM outside the loop must lie inside a wall polygon."""
        key = (room_id, backing)
        if key in self._runs:
            return self._runs[key]
        loop = self.loops[room_id]
        sgn = self.inward_sign(room_id)
        samples = []                                     # (point, edge dir, backed)
        n = len(loop)
        for i in range(n):
            a, b = loop[i], loop[(i + 1) % n]
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L < 1e-6:
                continue
            u = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
            nn = (-u[1] * sgn, u[0] * sgn)
            k = max(1, int(L // RUN_STEP_CM))
            for j in range(k):
                t = (j + 0.5) * L / k
                p = (a[0] + u[0] * t, a[1] + u[1] * t)
                qs = [(p[0] - nn[0] * dd, p[1] - nn[1] * dd) for dd in PROBE_DEPTHS_CM]
                if backing == "wall":
                    ok = any(self.in_wall(q) for q in qs) and not self.near_pane(qs[1], 3.0)
                else:
                    ok = self.near_pane(qs[1], 6.0)
                samples.append((p, u, ok))
        out = []
        if samples:
            # start the walk at a break so a run never splits at sample 0
            start = next((k for k in range(len(samples)) if not samples[k][2] or (k > 0 and math.degrees(math.acos(
                max(-1.0, min(1.0, samples[k][1][0] * samples[k - 1][1][0] + samples[k][1][1] * samples[k - 1][1][1]))))
                > RUN_TURN_DEG)), 0)
            seq = samples[start:] + samples[:start]
            cur = []
            for p, u, ok in seq + [(None, None, False)]:
                if ok and cur:
                    du = u[0] * cur[0][1][0] + u[1] * cur[0][1][1]
                    if math.degrees(math.acos(max(-1.0, min(1.0, du)))) > RUN_TURN_DEG:
                        out.append(cur)
                        cur = []
                if ok:
                    cur.append((p, u))
                elif cur:
                    out.append(cur)
                    cur = []
        runs = []
        for grp in out:
            if len(grp) < 2:
                continue
            p0, p1 = grp[0][0], grp[-1][0]
            u = grp[0][1]
            half = RUN_STEP_CM / 2.0
            p0 = (p0[0] - u[0] * half, p0[1] - u[1] * half)
            p1 = (p1[0] + u[0] * half, p1[1] + u[1] * half)
            r = Run(room_id, p0, p1, sgn, backing)
            if r.length >= 30.0:
                runs.append(r)
        runs.sort(key=lambda r: -r.length)
        self._runs[key] = runs
        return runs

    # ------------------------------------------------------------------ legality
    def legal(self, poly, room_id, layer="floor", cam_cm=TEMPLATE_CAMERA_CM, rug_under_ok=True,
              door_zones=True):
        """(ok, why). The general_furnish physical test + own-room containment + the template bars."""
        why = []
        loop = self.loops[room_id]
        outdoor = bool(self.rooms[room_id].get("is_outdoor"))
        if not self.pl.poly_ok(poly, room_id):
            why.append("enters a wall, a pane or another room")
        c = centroid(poly)
        if not pg.point_in_polygon(c, loop):
            why.append("centre outside its room")
        if not outdoor:
            for p in self.pl.samples(poly):
                if not any(pg.point_in_polygon(p, self.loops[r]) for r in self.pl.open_to[room_id]) \
                        and gf.signed_dist(p, loop) < -6.0:
                    why.append("leaves its room loop")
                    break
        if layer == "floor":
            for oid, other in self.footprints:
                if gf.sat_penetration(poly, other) > gf.OVERLAP_TOL_CM:
                    why.append(f"overlaps {oid}")
                    break
            for oid, z in self.pl.door_zones:
                if gf.sat_penetration(poly, z) > 0.5:
                    why.append(f"in {oid}")
                    break
            for zone in self.virtual_zones:
                if gf.sat_penetration(poly, zone[1]) > 0.5:
                    w = 2.0 * zone[4]
                    need = min(w - 4.0, PASSAGE_MIN_CM if zone[5] else max(PASSAGE_MIN_CM, OPEN_KEEP_SHARE * w))
                    free = self.open_passage(zone, poly)
                    if free < need:
                        why.append(f"narrows {zone[0]} to {free:.0f} cm (need {need:.0f})")
                        break
            for cid, _r, x, y in self.pl.cams:
                if gf.dist_point_poly((x, y), poly) < cam_cm:
                    why.append(f"near camera {cid}")
                    break
        elif layer == "rug":
            for oid, other in self.rugs:
                if gf.sat_penetration(poly, other) > 0.5:
                    why.append(f"overlaps rug {oid}")
                    break
            if not rug_under_ok:
                for oid, other in self.footprints:
                    if gf.sat_penetration(poly, other) > 0.5:
                        why.append(f"under {oid}")
                        break
            if door_zones:
                for oid, z in self.sweeps:
                    if gf.sat_penetration(poly, z) > 0.5:
                        why.append(f"under {oid}")
                        break
        elif layer == "wall":
            for oid, z in self.pl.door_zones:
                if gf.sat_penetration(poly, z) > 0.5:
                    why.append(f"in {oid}")
                    break
            for oid, other in self.wall_items:
                if gf.sat_penetration(poly, other) > 0.5:
                    why.append(f"overlaps {oid}")
                    break
        if not why and layer in ("floor", "rug") and not self.dense_clear(poly):
            why.append("cuts a wall or a pane (dense samples)")
        return (not why), why

    def open_passage(self, zone, poly):
        """The longest free stretch (cm) left along an open-plan boundary once `poly` joins the floor pieces
        that already enter its band (each piece blocks its projection onto the boundary)."""
        _zid, zpoly, (cx, cy), (ux, uy), hw, _out = zone
        iv = []
        for _oid, other in self.footprints + [("new", poly)]:
            if gf.sat_penetration(other, zpoly) > 0.5:
                us = [(x - cx) * ux + (y - cy) * uy for x, y in other]
                iv.append((max(-hw, min(us)), min(hw, max(us))))
        iv.sort()
        best, cur = 0.0, -hw
        for a, b in iv:
            if a > cur:
                best = max(best, a - cur)
            cur = max(cur, b)
        return max(best, hw - cur)

    def dense_clear(self, poly, tol=WALL_TOL_CM, pitch=2.0, grid=10.0):
        """No wall or pane inside a convex footprint shrunk by `tol`: its perimeter every `pitch` cm (a wall
        can only enter through it) plus an interior grid every `grid` cm (a column standing wholly inside)."""
        c = centroid(poly)
        n = len(poly)
        shr = []
        for x, y in poly:
            dx, dy = c[0] - x, c[1] - y
            L = math.hypot(dx, dy) or 1.0
            shr.append((x + dx / L * tol * 1.42, y + dy / L * tol * 1.42))
        pts = []
        for i in range(n):
            a, b = shr[i], shr[(i + 1) % n]
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            k = max(1, int(L // pitch))
            pts += [(a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k) for j in range(k)]
        if n == 4:
            p0, p1, p3 = shr[0], shr[1], shr[3]
            ka = max(1, int(math.hypot(p1[0] - p0[0], p1[1] - p0[1]) // grid))
            kb = max(1, int(math.hypot(p3[0] - p0[0], p3[1] - p0[1]) // grid))
            pts += [(p0[0] + (p1[0] - p0[0]) * i / ka + (p3[0] - p0[0]) * j / kb,
                     p0[1] + (p1[1] - p0[1]) * i / ka + (p3[1] - p0[1]) * j / kb)
                    for i in range(1, ka) for j in range(1, kb)]
        return not any(self.solid(q) for q in pts)

    def take(self, pid, poly, layer):
        {"floor": self.footprints, "rug": self.rugs, "wall": self.wall_items}.get(layer, []).append((pid, poly))

    # ------------------------------------------------------------------ candidate search
    def along(self, run, w, d, order="centre", gap=WALL_GAP_CM, **kw):
        """The first legal (centre, yaw, poly, station) of a w x d piece, back to `run`, front looking inward."""
        return next(self.along_all(run, w, d, order, gap, **kw), None)

    def along_all(self, run, w, d, order="centre", gap=WALL_GAP_CM, **kw):
        """Every legal (centre, yaw, poly, station) along a run, in preference order."""
        if run.length < w + 2.0:
            return
        lo, hi = w / 2.0 + 1.0, run.length - w / 2.0 - 1.0
        ss = [lo + k * RUN_STEP_CM for k in range(int((hi - lo) // RUN_STEP_CM) + 1)] or [run.length / 2.0]
        mid = run.length / 2.0
        if order == "centre":
            ss.sort(key=lambda s: (abs(s - mid), s))
        elif order == "ends":
            ss.sort(key=lambda s: (-abs(s - mid), s))
        yaw = gf.yaw_of(*run.n)
        for s in ss:
            c = run.at(s, d / 2.0 + gap)
            poly = gf.rect(c[0], c[1], yaw, w, d)
            ok, _why = self.legal(poly, run.room_id, **kw)
            if ok:
                yield c, yaw, poly, s

    def grid(self, room_id, step=10.0):
        x0, y0, x1, y1 = pg.bbox(self.loops[room_id])
        pts = []
        y = y0 + step / 2.0
        while y < y1:
            x = x0 + step / 2.0
            while x < x1:
                if pg.point_in_polygon((x, y), self.loops[room_id]):
                    pts.append((x, y))
                x += step
            y += step
        return pts

    def opening_segments(self, room_id):
        out = []
        for op in self.plan.get("openings", []):
            if room_id in op.get("rooms", []) and op.get("kind") != "window":
                cx, cy, ux, uy, _nx, _ny = pg.door_frame(op)
                hw = float(op["width_cm"]) / 2.0
                out.append((op["id"], (cx - ux * hw, cy - uy * hw), (cx + ux * hw, cy + uy * hw)))
        return out

    def dist_to_openings(self, pt, room_id):
        segs = self.opening_segments(room_id)
        if not segs:
            return 1e9
        return min(pg.dist_point_segment(pt[0], pt[1], a[0], a[1], b[0], b[1]) for _i, a, b in segs)

    def dominant_axis(self, room_id):
        """The length-weighted mode of the loop's edge directions modulo 90 deg (1-deg bins)."""
        loop = self.loops[room_id]
        bins = [0.0] * 90
        for i in range(len(loop)):
            a, b = loop[i], loop[(i + 1) % len(loop)]
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L > 1e-6:
                bins[int(round(axis_deg(b[0] - a[0], b[1] - a[1]))) % 90] += L
        return float(max(range(90), key=lambda k: (bins[k], -k)))


# ===================================================================================== phase 1: fixtures
def make_fixture(fid, room_id, kind, centre, angle, size, height, rule):
    f = {"id": fid, "room_id": room_id, "kind": kind, "centre_cm": [r2(centre[0]), r2(centre[1])],
         "angle_deg": r2(angle % 360.0), "size_cm": [r2(size[0]), r2(size[1])], "height_cm": r2(height),
         "z_cm": 0, "source": f"template:furnish_from_plan v{VERSION}", "rule": rule}
    f["polygon_cm"] = [[r2(x), r2(y)] for x, y in oriented(fixture_rect(f))]
    return f


def template_fixtures(ctx, roles, fixtures, log):
    """For every room whose role needs a drawn fixture kind the plan lacks: a template fixture of the same
    schema, on a measured wall run. Returns (added fixtures, translated islands)."""
    added, translated = [], []
    for f in fixtures:
        ctx.take(f["id"], fixture_rect(f), "floor")
    by_room = {}
    for f in fixtures:
        by_room.setdefault(f["room_id"], set()).add(f["kind"])
    closet_rooms = {rid for rid, r in roles.items() if r == "wardrobe"}
    for room in ctx.plan["rooms"]:                       # plan order
        rid = room["id"]
        role = roles[rid]
        have = by_room.get(rid, set())
        need = [k for k in ROLE_FIXTURES.get(role, ()) if k not in have]
        if role == "bedroom" and "wardrobe" in need and any(
                rid in op.get("rooms", []) and any(r in closet_rooms for r in op["rooms"])
                for op in ctx.plan["openings"]):
            need.remove("wardrobe")                      # a walk-in closet opens onto this bedroom
        if role == "living" and "table" in have:
            need = [k for k in need if k != "table"]
        if not need:
            continue
        runs = ctx.runs(rid)
        tag = rid[2:] if rid.startswith("r-") else rid

        def put(kind, f):
            ctx.take(f["id"], fixture_rect(f), "floor")
            added.append(f)
            log(f"  template fixture {f['id']:28s} {kind:9s} {f['size_cm'][0]:.0f}x{f['size_cm'][1]:.0f} at "
                f"({f['centre_cm'][0]:.0f},{f['centre_cm'][1]:.0f}) - {f['rule']}")

        if role == "kitchen" and "counter" in need:
            for k, run in enumerate(runs):
                n_mod = min(6, int((run.length - 10.0) // 60.0))
                if n_mod < 2:
                    continue
                done = False
                for nm in range(n_mod, 1, -1):
                    got = ctx.along(run, nm * 60.0, 60.0, cam_cm=30.0)
                    if got:
                        c, _yaw, _poly, s = got
                        put("counter", make_fixture(f"t-{tag}-counter", rid, "counter", c, axis_deg(*run.u),
                                                    (nm * 60.0, 60.0), 90.0, f"the longest legal wall run ({run.length:.0f} cm), {nm} modules"))
                        if "tall_unit" not in have:
                            for side in (1.0, -1.0):
                                s2 = s + side * (nm * 60.0 / 2.0 + 31.0)
                                tc = run.at(s2, 32.5 + WALL_GAP_CM)
                                poly = gf.rect(tc[0], tc[1], gf.yaw_of(*run.n), 60.0, 65.0)
                                if 30.0 <= s2 <= run.length - 30.0 and ctx.legal(poly, rid, cam_cm=30.0)[0]:
                                    put("tall_unit", make_fixture(f"t-{tag}-tall", rid, "tall_unit", tc, axis_deg(*run.u),
                                                                  (60.0, 65.0), 220.0, "the run's end"))
                                    break
                        done = True
                        break
                if done:
                    break
        if role == "living" and ("tv_unit" in need or "sofa" in need):
            placed = False
            for run, (tc, _y, _p, _s) in ((r, g) for r in runs for g in ctx.along_all(r, 180.0, 45.0)):
                if placed:
                    break
                for D in (260.0, 240.0, 280.0, 220.0, 300.0):
                    sc = (tc[0] + run.n[0] * (22.5 + D + 45.0), tc[1] + run.n[1] * (22.5 + D + 45.0))
                    spoly = gf.rect(sc[0], sc[1], gf.yaw_of(-run.n[0], -run.n[1]), 220.0, 90.0)
                    if ctx.legal(spoly, rid)[0]:
                        if "tv_unit" in need:
                            put("tv_unit", make_fixture(f"t-{tag}-tv", rid, "tv_unit", tc, axis_deg(*run.u),
                                                        (180.0, 45.0), 50.0, "the longest legal wall run = the TV wall"))
                        if "sofa" in need:
                            put("sofa", make_fixture(f"t-{tag}-sofa", rid, "sofa", sc, axis_deg(*run.u), (220.0, 90.0),
                                                     75.0, f"facing the TV wall at {D:.0f} cm"))
                            cc = (sc[0] - run.n[0] * (45.0 + 45.0 + 30.0), sc[1] - run.n[1] * (45.0 + 45.0 + 30.0))
                            cpoly = gf.rect(cc[0], cc[1], 0.0, 1.0, 1.0)
                            cpoly = fixture_rect({"centre_cm": cc, "angle_deg": axis_deg(*run.u), "size_cm": [90, 60]})
                            if "table" in need and ctx.legal(cpoly, rid, cam_cm=30.0)[0]:
                                put("table", make_fixture(f"t-{tag}-coffee", rid, "table", cc, axis_deg(*run.u),
                                                          (90.0, 60.0), 40.0, "45 cm in front of the sofa"))
                        placed = True
                        break
            if not placed and "sofa" in need:              # fallback: the sofa's back to the longest free wall
                for run in runs:
                    got = ctx.along(run, 220.0, 90.0)
                    if not got:
                        continue
                    sc, _y, _p, _s = got
                    put("sofa", make_fixture(f"t-{tag}-sofa", rid, "sofa", sc, axis_deg(*run.u), (220.0, 90.0), 75.0,
                                             "fallback: back to the longest free wall run (no TV wall fits)"))
                    cc = run.at(_s, 90.0 + WALL_GAP_CM + 45.0 + 30.0)
                    cpoly = fixture_rect({"centre_cm": cc, "angle_deg": axis_deg(*run.u), "size_cm": [90, 60]})
                    if "table" in need and ctx.legal(cpoly, rid, cam_cm=30.0)[0]:
                        put("table", make_fixture(f"t-{tag}-coffee", rid, "table", cc, axis_deg(*run.u),
                                                  (90.0, 60.0), 40.0, "45 cm in front of the sofa"))
                    break
        if role in ("dining",) and "table" in need:
            best = None
            ang = ctx.dominant_axis(rid)
            cands = sorted((round(-gf.signed_dist(p, ctx.loops[rid]), 1), p[1], p[0], a, p)
                           for p in ctx.grid(rid, 10.0) for a in (ang, ang + 90.0))
            for sc in cands:
                p, a = sc[4], sc[3]
                poly = fixture_rect({"centre_cm": p, "angle_deg": a, "size_cm": [160.0, 90.0]})
                if ctx.legal(poly, rid, cam_cm=TEMPLATE_CAMERA_CM)[0]:
                    best = (sc, p, a)
                    break
            if best:
                put("table", make_fixture(f"t-{tag}-table", rid, "table", best[1], best[2], (160.0, 90.0), 75.0,
                                          "the deepest legal point of the zone, along its dominant axis"))
        if role == "bedroom" and "bed" in need:
            opens = ctx.opening_segments(rid)
            for run in sorted(runs, key=lambda r: (-min((pg.dist_point_segment(*r.at(r.length / 2, 0), *a, *b)
                                                         for _i, a, b in opens), default=0.0), -r.length)):
                got = None
                for w, L in ((160.0, 200.0), (140.0, 200.0)):
                    got = ctx.along(run, w, L, order="centre", cam_cm=30.0)
                    if got:
                        break
                if got:
                    c, _y, _p, _s = got
                    put("bed", make_fixture(f"t-{tag}-bed", rid, "bed", c, axis_deg(*run.n), (L, w), 55.0,
                                            "headboard on the wall run farthest from the room's openings"))
                    break
        if role in ("bedroom", "wardrobe") and "wardrobe" in need:
            for run in runs:
                got = None
                for w in (240.0, 200.0, 180.0, 160.0, 120.0):
                    got = ctx.along(run, w, 60.0, order="ends", cam_cm=30.0)
                    if got:
                        break
                if got:
                    c, _y, _p, _s = got
                    put("wardrobe", make_fixture(f"t-{tag}-closet", rid, "wardrobe", c, axis_deg(*run.u), (w, 60.0),
                                                 240.0, "a closet run on the longest free wall"))
                    break
        if role in ("bathroom", "toilet"):
            opens = ctx.opening_segments(rid)

            def far(r):
                return -min((pg.dist_point_segment(*r.at(r.length / 2, 0), *a, *b) for _i, a, b in opens), default=0.0)
            if "shower" in need and float(ctx.rooms[rid].get("area_m2") or 0) >= 2.5:
                for run in sorted(runs, key=lambda r: (far(r), -r.length)):
                    got = None
                    for w in (120.0, 90.0):
                        got = ctx.along(run, w, 90.0, order="ends", cam_cm=30.0)
                        if got:
                            break
                    if got:
                        put("shower", make_fixture(f"t-{tag}-shower", rid, "shower", got[0], axis_deg(*run.u),
                                                   (w, 90.0), 10.0, "a corner of the wall farthest from the door"))
                        break
            if "wc" in need:
                for run in sorted(runs, key=lambda r: (far(r), -r.length)):
                    got = ctx.along(run, 40.0, 60.0, order="ends", cam_cm=30.0)
                    if got:
                        put("wc", make_fixture(f"t-{tag}-wc", rid, "wc", got[0], axis_deg(*run.n), (60.0, 40.0),
                                               45.0, "the wall most opposed to the door"))
                        break
            if "vanity" in need:
                for run in sorted(runs, key=lambda r: (-far(r), -r.length)):
                    got = ctx.along(run, 80.0, 50.0, order="centre", cam_cm=30.0)
                    if got:
                        put("vanity", make_fixture(f"t-{tag}-vanity", rid, "vanity", got[0], axis_deg(*run.u),
                                                   (80.0, 50.0), 85.0, "a wall near the door"))
                        break
    # islands: no general_furnish rule -> a counter whose front faces the nearest other counter
    for f in fixtures:
        if f["kind"] == "island":
            others = [g for g in fixtures + added if g["kind"] == "counter" and g["room_id"] == f["room_id"]]
            t = dict(f)
            t["kind"] = "counter"
            t["translated_from"] = "island"
            if others:
                o = min(others, key=lambda g: math.hypot(g["centre_cm"][0] - f["centre_cm"][0],
                                                         g["centre_cm"][1] - f["centre_cm"][1]))
                t["front_deg"] = r2(gf.yaw_of(o["centre_cm"][0] - f["centre_cm"][0], o["centre_cm"][1] - f["centre_cm"][1]))
            translated.append(t)
            log(f"  island {f['id']} -> counter (front {t.get('front_deg', 'auto')})")
    return added, translated


# ===================================================================================== phase 1b: fit
FIT_ROUNDS = 5
FIT_MAX_MOVE_CM = 25.0      # a plan fixture moves at most this far in all (general_furnish's MAX_SHIFT_CM)
FIT_MAX_TRIM = 0.35         # a run loses at most this share of its drawn length
FIT_STEP_CM = 1.0           # the dense sample pitch (general_furnish samples corners + quarter points only)
TRIM_KINDS = ("counter", "wardrobe", "tv_unit", "shower")


def dense_hits(ctx, poly, tol=1.0, step=FIT_STEP_CM):
    """Points of a rectangular footprint (shrunk by tol) that lie inside a wall or a pane polygon."""
    p0, p1, p3 = poly[0], poly[1], poly[3]
    a = (p1[0] - p0[0], p1[1] - p0[1])
    b = (p3[0] - p0[0], p3[1] - p0[1])
    La, Lb = math.hypot(*a), math.hypot(*b)
    if La < 2 * tol or Lb < 2 * tol:
        return []
    ua, ub = (a[0] / La, a[1] / La), (b[0] / Lb, b[1] / Lb)
    out = []
    na, nb = max(1, int((La - 2 * tol) // step)), max(1, int((Lb - 2 * tol) // step))
    for i in range(na + 1):
        s = tol + (La - 2 * tol) * i / na
        for j in range(nb + 1):
            t = tol + (Lb - 2 * tol) * j / nb
            pt = (p0[0] + ua[0] * s + ub[0] * t, p0[1] + ua[1] * s + ub[1] * t)
            if ctx.solid(pt):
                out.append(pt)
    return out


def fixture_items(res, fid):
    """Every floor footprint general_furnish built for one fixture (a run's modules, a closet, a bed...)."""
    out = [p["footprint_cm"] for p in res["placements"] if p["source"] == f"fixture:{fid}" and p["layer"] != "wall"]
    out += [q["footprint_cm"] for q in res["procedural"] if q["source"] == f"fixture:{fid}"]
    return out


def seat_search(ctx, f, c, L, N, rect_ab, orig_len, tol=1.0, ext=FIT_MAX_MOVE_CM, step=FIT_STEP_CM):
    """The cheapest re-seat of a built fixture rectangle [a_lo, a_hi] x [b_lo, b_hi] (fixture frame: a along
    its axis L, b along N) that leaves no wall/pane sample inside it: a move m along N (|m| <= ext) plus, along
    L, either a trim of either end (runs, closets, TV units, showers, a vanity: up to a share of the drawn
    length) or a slide t (|t| <= ext). Cost = trimmed cm + 1.5 x moved cm; ties: smaller |m|, then |t|."""
    import bisect
    a_lo, a_hi, b_lo, b_hi = rect_ab
    pts = []
    na, nb = int((a_hi - a_lo + 2 * ext) // step) + 1, int((b_hi - b_lo + 2 * ext) // step) + 1
    for i in range(na + 1):
        a = a_lo - ext + i * step
        for j in range(nb + 1):
            b = b_lo - ext + j * step
            pt = (c[0] + L[0] * a + N[0] * b, c[1] + L[1] * a + N[1] * b)
            if ctx.solid(pt):
                pts.append((a, b))
    trim_ok = f["kind"] in TRIM_KINDS or f["kind"] == "vanity"
    share = FIT_MAX_TRIM if f["kind"] in TRIM_KINDS else 0.2
    min_len = (1.0 - share) * orig_len
    length = a_hi - a_lo
    best = None
    for m in sorted(range(-int(ext), int(ext) + 1), key=lambda v: (abs(v), v)):
        if best is not None and 1.5 * abs(m) > best[0][0]:
            break
        blo, bhi = b_lo + m, b_hi + m
        band = sorted({round(a, 3) for a, b in pts if blo + tol < b < bhi - tol})
        if trim_ok:
            inA = [a for a in band if a_lo + tol < a < a_hi - tol]
            for k in range(len(inA) + 1):
                lo = inA[k - 1] + tol + 0.5 if k > 0 else a_lo
                hi = inA[k] - tol - 0.5 if k < len(inA) else a_hi
                if hi - lo < min_len:
                    continue
                cost = (lo - a_lo) + (a_hi - hi) + 1.5 * abs(m)
                key = (round(cost, 3), abs(m), 0.0)
                if best is None or key < best[0]:
                    why = (f"trimmed {lo - a_lo:.1f} cm at -L, {a_hi - hi:.1f} cm at +L" if (lo > a_lo or hi < a_hi) else "")
                    best = (key, (lo, hi, blo, bhi), why, m)
        for t in sorted(range(-int(ext), int(ext) + 1), key=lambda v: (abs(v), v)):
            lo, hi = a_lo + t, a_hi + t
            i = bisect.bisect_right(band, lo + tol)
            if i < len(band) and band[i] < hi - tol:
                continue
            cost = 1.5 * abs(t) + 1.5 * abs(m)
            key = (round(cost, 3), abs(m), abs(t))
            if best is None or key < best[0]:
                best = (key, (lo, hi, blo, bhi), f"slid {t:+d} cm along its axis" if t else "", m)
            break
    if best is None:
        return None
    _key, rect, why, m = best
    parts = [w for w in (why, f"moved {m:+d} cm across it" if m else "") if w]
    return rect, ("; ".join(parts) or "already clear")


def fit_fixtures(plan0, style, log):
    """Plan fixtures overlap walls by design (V13: the loops stop at the drawn lines), and general_furnish's
    fit tests corners and quarter points only, so a fitted piece can still cut a wall corner. Sample each
    built footprint densely; where it enters a wall, re-seat the FIXTURE on its BUILT rectangle (so
    general_furnish's own trims are baked in) moved/trimmed by `seat_search`, re-run, repeat. The input plan
    is never touched; every change is reported (`fixtures_adjusted`)."""
    adjusted = {}
    res = run_planner(plan0, style)
    for _round in range(FIT_ROUNDS):
        ctx = Ctx(plan0, style)
        changed = False
        for f in plan0.get("fixtures") or []:
            items = fixture_items(res, f["id"])
            hits = [h for poly in items for h in dense_hits(ctx, poly, tol=1.0)]
            if len(hits) * FIT_STEP_CM ** 2 <= WALL_TOL_AREA_CM2:
                continue
            cx, cy = (float(v) for v in f["centre_cm"])
            a_ = math.radians(float(f["angle_deg"]))
            L = (math.cos(a_), math.sin(a_))
            N = (-L[1], L[0])
            pa = [(x - cx) * L[0] + (y - cy) * L[1] for poly in items for x, y in poly]
            pb = [(x - cx) * N[0] + (y - cy) * N[1] for poly in items for x, y in poly]
            a_lo, a_hi, b_lo, b_hi = min(pa), max(pa), min(pb), max(pb)
            rec = adjusted.setdefault(f["id"], {"id": f["id"], "kind": f["kind"],
                                                "before": {"centre_cm": list(f["centre_cm"]), "size_cm": list(f["size_cm"])},
                                                "steps": [], "orig_len": float(f["size_cm"][0])})
            best = seat_search(ctx, f, (cx, cy), L, N, (a_lo, a_hi, b_lo, b_hi), rec["orig_len"])
            if best is None:
                rec["steps"].append(f"refused (no move <= {FIT_MAX_MOVE_CM:.0f} cm / trim <= share clears the walls)")
                continue
            (a_lo, a_hi, b_lo, b_hi), why = best
            if why == "already clear":                   # surface samples only (the trigger's grid is finer)
                continue
            nc = (cx + L[0] * (a_lo + a_hi) / 2.0 + N[0] * (b_lo + b_hi) / 2.0,
                  cy + L[1] * (a_lo + a_hi) / 2.0 + N[1] * (b_lo + b_hi) / 2.0)
            moved = math.hypot(nc[0] - float(rec["before"]["centre_cm"][0]), nc[1] - float(rec["before"]["centre_cm"][1]))
            if moved > FIT_MAX_MOVE_CM + 0.5 * rec["orig_len"] * FIT_MAX_TRIM:
                rec["steps"].append(f"refused ({why}; would move {moved:.0f} cm)")
                continue
            f["centre_cm"] = [r2(nc[0]), r2(nc[1])]
            f["size_cm"] = [r2(a_hi - a_lo), r2(b_hi - b_lo)]
            f["polygon_cm"] = [[r2(x), r2(y)] for x, y in oriented(fixture_rect(f))]
            rec["steps"].append(f"{why} ({len(hits) * FIT_STEP_CM ** 2:.0f} cm2 in a wall)")
            changed = True
        if not changed:
            break
        res = run_planner(plan0, style)
    out = []
    for fid, rec in adjusted.items():
        if not rec["steps"]:
            continue
        f = next(g for g in plan0["fixtures"] if g["id"] == fid)
        rec["after"] = {"centre_cm": list(f["centre_cm"]), "size_cm": list(f["size_cm"])}
        rec.pop("orig_len", None)
        out.append(rec)
        log(f"  fit {fid:12s} {rec['before']['centre_cm']} {rec['before']['size_cm']} -> {rec['after']['centre_cm']} "
            f"{rec['after']['size_cm']}: {'; '.join(rec['steps'])}")
    return res, out


# ===================================================================================== phase 2: hints
def fixture_hints(ctx, fixtures, log):
    hints = {}
    cues = ctx.plan.get("furnish_cues") or {}
    syms = [x for x in ((ctx.plan.get("casework_symbols") or {}).get("symbols") or []) if x.get("kind") in ("sink", "hob")]
    counters = [f for f in fixtures if f["kind"] == "counter"]
    by_room = {}
    for f in counters:
        by_room.setdefault(f["room_id"], []).append(f)
    for rid in sorted(by_room, key=lambda r: [x["id"] for x in ctx.plan["rooms"]].index(r) if r in ctx.rooms else 0):
        runs = sorted(by_room[rid], key=lambda f: (-float(f["size_cm"][0]), f["id"]))
        for f in runs:
            cx, cy, L, N, s0, s1 = ctx.pl.fixture_frame(f)
            fr = gf.dir_of_yaw(float(f["front_deg"])) if f.get("front_deg") is not None else \
                ctx.pl.front_for(f, [N, (-N[0], -N[1])], s1)
            R = (-fr[1], fr[0])
            wall_n, glass_n, tot = 0, 0, 0
            for k in range(7):
                t = -s0 / 2.0 + 10.0 + k * (s0 - 20.0) / 6.0
                b = (cx + R[0] * t - fr[0] * (s1 / 2.0 + PROBE_OUT_CM), cy + R[1] * t - fr[1] * (s1 / 2.0 + PROBE_OUT_CM))
                tot += 1
                wall_n += 1 if ctx.in_wall(b) else 0
                glass_n += 1 if ctx.near_pane(b, GLASS_NEAR_CM) else 0
            h = {"uppers": bool(wall_n >= 0.6 * tot and glass_n == 0 and not f.get("translated_from")),
                 "rule": f"back probes: {wall_n}/{tot} in a wall, {glass_n}/{tot} within {GLASS_NEAR_CM:.0f} cm of glass"}
            # (2026-11-06, parity row 18) the house material board decides WHAT stands on a wall-backed run: its open-shelf function
            # wall (tools/casework_symbols.py writes plan.furnish_cues) is wall-mounted and stops short of glass, so a run with its
            # back in a wall gets it even when one probe sees the facade glass at the run's end
            if cues.get("kitchen_uppers") == "shelves" and wall_n >= 0.6 * tot and not f.get("translated_from"):
                h["uppers"] = "shelves"
                h["rule"] += f"; uppers: shelves ({cues.get('source', 'the material board')})"
            if f.get("front_deg") is not None:
                h["front_deg"] = f["front_deg"]
            hints[f["id"]] = h
        main = runs[0]
        # (2026-11-06, parity row 18) the hob and the sink where the DRAWING has them: plan.casework_symbols (tools/casework_symbols.py,
        # the plumbing/casework layer's burner square and drain/tap holes, registered into this plan's frame); each symbol goes on
        # the run it sits on. The old guess is only a labelled FALLBACK for a drawing without symbols.
        ids = {f["id"] for f in runs}
        for sym in syms:
            host = sym.get("on_fixture") if sym.get("on_fixture") in ids else None
            if host is None:
                continue
            key = "sink_at_cm" if sym["kind"] == "sink" else "hob_at_cm"
            if key in hints[host]:
                continue
            hints[host][key] = [r2(v) for v in sym["centre_cm"]]
            hints[host]["rule"] += f"; {sym['kind']}: the drawing's symbol ({sym.get('evidence', 'casework layer')})"
        has = lambda key: any(key in hints[f["id"]] for f in runs)
        if not has("sink_at_cm"):
            hints[main["id"]]["sink_at_cm"] = [r2(v) for v in main["centre_cm"]]
            hints[main["id"]]["rule"] += "; sink: FALLBACK (no drawn sink symbol) - the centre of the longest run"
        if not has("hob_at_cm"):
            if len(runs) > 1:
                hints[runs[1]["id"]]["hob_at_cm"] = [r2(v) for v in runs[1]["centre_cm"]]
                hints[runs[1]["id"]]["rule"] += "; hob: FALLBACK (no drawn hob symbol) - the centre of the second run"
            else:
                cx, cy, L, N, s0, s1 = ctx.pl.fixture_frame(main)
                off = min(s0 / 2.0 - 30.0, 120.0)
                hints[main["id"]]["hob_at_cm"] = [r2(cx + L[0] * off), r2(cy + L[1] * off)]
                hints[main["id"]]["rule"] += "; hob: FALLBACK (no drawn hob symbol) - two modules from the sink on the same run"
        for f in runs:
            log(f"  hint {f['id']:12s} {json.dumps({k: v for k, v in hints[f['id']].items() if k != 'rule'})} ({hints[f['id']]['rule']})")
    return hints


# ===================================================================================== phase 3: pieces
def make_piece(pid, room_id, cls, centre, yaw, rule, size=None, anchor=None, z_cm=None, model=None):
    p = {"id": pid, "room_id": room_id, "class": cls, "centre_cm": [r2(centre[0]), r2(centre[1])],
         "yaw_deg": r2(yaw % 360.0), "keep": False, "source": f"template:furnish_from_plan v{VERSION}", "rule": rule}
    if model:
        p["model"] = model
    if size:
        p["size_cm"] = [r2(v) for v in size]
    if anchor:
        p["anchor"] = anchor
    if z_cm is not None:
        p["z_cm"] = r2(z_cm)
    return p


def door_sweeps(plan, pl, res):
    """(id, convex hull) of the floor each interior door leaf sweeps 0 -> 90 deg, on general_furnish's chosen
    swing side and hinge (`res["doors"]`)."""
    ceiling = float((plan.get("plan_meta") or {}).get("ceiling_height_cm", 290))
    ops = {o["id"]: o for o in plan["openings"]}
    out = []
    for d in res["doors"]:
        op = ops[d["opening"]]
        cx, cy, ux, uy, nx, ny = pg.door_frame(op)
        hw = float(op["width_cm"]) / 2.0
        n0, n1 = pg.door_infill(plan, op, ceiling)["n_range_cm"]
        s_sw = 1.0 if pg.point_in_polygon((cx + nx * (n1 + 10.0), cy + ny * (n1 + 10.0)), pl.loops[d["swing_room"]]) else -1.0
        hs = 1.0 if d["hinge"] == "+u" else -1.0
        pts = [p for ang in range(0, 91, 10) for p in pl._leaf_poly(cx, cy, ux, uy, nx, ny, hw, n0, n1, s_sw, hs, float(ang))]
        out.append((f"leaf-sweep:{op['id']}", pg._convex_hull(pts)))
    return out


def template_pieces(ctx, roles, res0, log):
    """Pieces the drawing does not show, per room role, anchored on the RESOLVED fixtures (res0)."""
    pl = ctx.pl
    ctx.sweeps = door_sweeps(ctx.plan, res0["_planner"], res0)
    ctx.footprints = [(i, p) for i, p in res0["_footprints"]]
    ctx.rugs = [(p["id"], p["footprint_cm"]) for p in res0["placements"] if p["layer"] == "rug"]
    ctx.wall_items = [(p["id"], p["footprint_cm"]) for p in res0["placements"] if p["layer"] == "wall"]
    pieces = []
    by_room = {}
    for p in res0["placements"]:
        by_room.setdefault(p["room_id"], []).append(p)

    def dims(cls, model=None):
        mid = pl.model_of(cls, model)
        return mid, pl.dims(mid), pl.style["models"][mid].get("material_policy") == "keep_source"

    def add(p, poly, layer):
        ctx.take(p["id"], poly, layer)
        pieces.append(p)
        log(f"  piece {p['id']:30s} {p['class']:11s} at ({p['centre_cm'][0]:.0f},{p['centre_cm'][1]:.0f}) yaw "
            f"{p['yaw_deg']:.0f} - {p['rule']}")

    def art_on(run, rid, s=None, over_h=0.0, tag="art", clear_front=False):
        mid, (w, d, h), _k = dims("wall_art")
        ss = [s] if s is not None else sorted([w / 2 + 5 + k * 5.0 for k in range(int(max(0, run.length - w - 10) // 5) + 1)],
                                             key=lambda v: abs(v - run.length / 2))
        for sv in ss:
            if sv is None or sv < w / 2 or sv > run.length - w / 2:
                continue
            c = run.at(sv, d / 2.0 + 0.5)
            yaw = gf.yaw_of(*run.n)
            poly = gf.rect(c[0], c[1], yaw, w, d)
            if clear_front and any(gf.dist_point_poly(run.at(sv + k, 25.0), fp) < 15.0
                                   for k in (-w / 2, 0.0, w / 2) for _i, fp in ctx.footprints):
                continue                                 # a wall behind a cabinet, a closet or a TV
            if ctx.legal(poly, rid, layer="wall")[0]:
                z = max(gf.ART_BOTTOM_CM, over_h + 15.0)
                add(make_piece(f"ffp-{rid[2:]}-{tag}", rid, "wall_art", c, yaw, f"centred on a wall run "
                               f"({run.length:.0f} cm), bottom {z:.0f} cm", anchor="wall", z_cm=z), poly, "wall")
                return True
        return False

    def run_behind(rid, c, back_dir, max_gap):
        """The wall run directly behind a point (within max_gap), and the station along it."""
        for run in ctx.runs(rid):
            if run.n[0] * back_dir[0] + run.n[1] * back_dir[1] > -0.95:
                continue
            vx, vy = c[0] - run.p0[0], c[1] - run.p0[1]
            s = vx * run.u[0] + vy * run.u[1]
            off = vx * run.n[0] + vy * run.n[1]
            if 0.0 <= s <= run.length and 0.0 < off <= max_gap:
                return run, s
        return None, None

    def corner_spots(rid, size, inset):
        out = []
        for run in ctx.runs(rid):
            for s in (inset, run.length - inset):
                if 0 < s < run.length:
                    out.append(run.at(s, inset))
        if ctx.rooms[rid].get("is_outdoor"):
            loop = ctx.loops[rid]
            sgn = ctx.inward_sign(rid)
            for i in range(len(loop)):
                a, b, c = loop[i - 1], loop[i], loop[(i + 1) % len(loop)]
                u1, u2 = unit(b[0] - a[0], b[1] - a[1]), unit(c[0] - b[0], c[1] - b[1])
                cross = (u1[0] * u2[1] - u1[1] * u2[0]) * sgn
                if cross > 0.5:                          # a convex corner
                    n1 = (-u1[1] * sgn, u1[0] * sgn)
                    n2 = (-u2[1] * sgn, u2[0] * sgn)
                    out.append((b[0] + (n1[0] + n2[0]) * inset, b[1] + (n1[1] + n2[1]) * inset))
        return out

    for room in ctx.plan["rooms"]:                       # plan order
        rid = room["id"]
        role = roles[rid]
        mine = by_room.get(rid, [])
        tag = rid[2:]
        if role == "living":
            sofa = next((p for p in mine if p["class"] == "sofa"), None)
            coffee = next((p for p in mine if p["class"] == "coffee_table"), None)
            if sofa:
                fr = gf.dir_of_yaw(sofa["yaw_deg"])
                R = (-fr[1], fr[0])
                # rug: centred between the sofa front and the coffee table, along the sofa
                mid_r, (rw0, rd0, _rh), _k = dims("rug")
                anchor = (coffee["x_cm"], coffee["y_cm"]) if coffee else (
                    sofa["x_cm"] + fr[0] * (sofa["depth_cm"] / 2 + 60), sofa["y_cm"] + fr[1] * (sofa["depth_cm"] / 2 + 60))
                base = (anchor[0] - fr[0] * 15.0, anchor[1] - fr[1] * 15.0)
                for rw, rd in ((240.0, 170.0), (200.0, 140.0), (160.0, 120.0)):
                    poly = gf.rect(base[0], base[1], sofa["yaw_deg"], rw, rd)
                    if ctx.legal(poly, rid, layer="rug")[0]:
                        add(make_piece(f"ffp-{tag}-rug", rid, "rug", base, sofa["yaw_deg"],
                                       f"{rw:.0f}x{rd:.0f} under the coffee table, along the sofa",
                                       size=[rw, rd, 1.78]), poly, "rug")
                        break
                # floor lamp at the sofa end farther from the room's openings
                mid_l, (lw, ld, lh), _k = dims("floor_lamp")
                cands = []
                for side in (1.0, -1.0):
                    off = sofa["width_cm"] / 2.0 + 12.0 + max(lw, ld) / 2.0
                    back = sofa["depth_cm"] / 2.0 - ld / 2.0 - 5.0
                    c = (sofa["x_cm"] + R[0] * side * off - fr[0] * back, sofa["y_cm"] + R[1] * side * off - fr[1] * back)
                    cands.append((-ctx.dist_to_openings(c, rid), side, c))
                for _s, _side, c in sorted(cands):
                    poly = gf.rect(c[0], c[1], sofa["yaw_deg"], lw, ld)
                    if ctx.legal(poly, rid)[0]:
                        add(make_piece(f"ffp-{tag}-lamp", rid, "floor_lamp", c, sofa["yaw_deg"],
                                       "beside the sofa, at the end farther from the openings"), poly, "floor")
                        break
                # art over the sofa if its back stands at a wall
                run, s = run_behind(rid, (sofa["x_cm"], sofa["y_cm"]), (-fr[0], -fr[1]), sofa["depth_cm"] / 2 + 35)
                if run is not None:
                    art_on(run, rid, s, over_h=sofa["height_cm"])
            if not any(p["room_id"] == rid and p["class"] == "wall_art" for p in pieces):
                for run in ctx.runs(rid):
                    if run.length >= 100.0 and art_on(run, rid, clear_front=True):
                        break
            # one plant: a free wall corner, else a wall station, farthest from the openings
            mid_p, (pw, pd, ph), _k = dims("plant")
            best = None
            inset = max(pw, pd) / 2 + 3
            spots = [(0, c) for c in corner_spots(rid, max(pw, pd), inset)]
            for run in ctx.runs(rid):
                spots += [(1, run.at(inset + 20.0 * k, inset)) for k in range(int(max(0.0, run.length - 2 * inset) // 20.0) + 1)]
            for sc in sorted((pri, -round(min(ctx.dist_to_openings(c, rid), 300.0), 0), round(c[1], 1), round(c[0], 1), c)
                             for pri, c in spots):
                c = sc[4]
                poly = gf.rect(c[0], c[1], 0.0, pw, pd)
                if ctx.legal(poly, rid, cam_cm=60.0)[0]:
                    best = (sc, c, poly)
                    break
            if best:
                add(make_piece(f"ffp-{tag}-plant", rid, "plant", best[1], 0.0,
                               ("a free wall corner" if best[0][0] == 0 else "a free wall station") + ", farthest from the openings"),
                    best[2], "floor")
        elif role == "entrance":
            mid_c, _d, _k = dims("tv_unit")
            w, d, h = 120.0, 40.0, 75.0
            got = None
            for run in ctx.runs(rid):
                got = ctx.along(run, w, d, order="centre")
                if got:
                    break
            if got:
                c, yaw, poly, s = got
                add(make_piece(f"ffp-{tag}-console", rid, "tv_unit", c, yaw,
                               f"a 120x40x75 console (no console class: the TV cabinet) on the longest legal wall run",
                               size=[w, d, h]), poly, "floor")
                art_on(run, rid, s, over_h=h)
            for op in ctx.plan["openings"]:
                if op.get("kind") == "entrance_door" and rid in op.get("rooms", []):
                    cx, cy, ux, uy, nx, ny = pg.door_frame(op)
                    side = 1.0 if pg.point_in_polygon((cx + nx * 40, cy + ny * 40), ctx.loops[rid]) else -1.0
                    mid_m, (mw, md, mh), _k = dims("bath_mat")
                    for dep in (32.0, 40.0, 48.0):
                        c = (cx + nx * side * dep, cy + ny * side * dep)
                        yaw = gf.yaw_of(nx * side, ny * side)
                        poly = gf.rect(c[0], c[1], yaw, mw, md)
                        if ctx.legal(poly, rid, layer="rug", door_zones=False)[0]:
                            add(make_piece(f"ffp-{tag}-doormat", rid, "bath_mat", c, yaw,
                                           f"inside the entrance door {op['id']}, {dep:.0f} cm in"), poly, "rug")
                            break
        elif role == "bedroom":
            bed = next((p for p in mine if p["class"] == "bed_double"), None)
            if bed:
                fr = gf.dir_of_yaw(bed["yaw_deg"])          # toward the foot
                for rw, rd in ((240.0, 170.0), (220.0, 150.0), (200.0, 130.0)):
                    off = bed["depth_cm"] / 2.0 - rd / 2.0 + 40.0
                    c = (bed["x_cm"] + fr[0] * off, bed["y_cm"] + fr[1] * off)
                    poly = gf.rect(c[0], c[1], bed["yaw_deg"], rw, rd)
                    if ctx.legal(poly, rid, layer="rug")[0]:
                        add(make_piece(f"ffp-{tag}-rug", rid, "rug", c, bed["yaw_deg"],
                                       f"{rw:.0f}x{rd:.0f} under the lower bed, 40 cm past its foot", size=[rw, rd, 1.78]),
                            poly, "rug")
                        break
        elif role in ("bathroom", "toilet"):
            mid_m, (mw, md, mh), _k = dims("bath_mat")
            hosts = [p for p in mine if p["class"] == "bathroom_sink"]
            hosts += [{"x_cm": None, "q": q} for q in res0["procedural"] if q["room_id"] == rid and q["kind"] == "shower"]
            done = False
            for host in hosts:
                if host.get("x_cm") is None:            # a shower tray: its open (screen) side faces the room
                    fp = host["q"]["footprint_cm"]
                    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = fp
                    c0 = ((x0 + x2) / 2.0, (y0 + y2) / 2.0)
                    fr = unit((x2 + x3) / 2.0 - (x0 + x1) / 2.0, (y2 + y3) / 2.0 - (y0 + y1) / 2.0)
                    half, what = math.hypot(x3 - x0, y3 - y0) / 2.0, "the shower"
                else:
                    c0, fr, half, what = (host["x_cm"], host["y_cm"]), gf.dir_of_yaw(host["yaw_deg"]), host["depth_cm"] / 2.0, "the basin"
                R = (-fr[1], fr[0])
                yaw = gf.yaw_of(*fr)
                for dep in (28.0, 22.0, 34.0):
                    for lat in (0.0, 10.0, -10.0, 20.0, -20.0):
                        c = (c0[0] + fr[0] * (half + dep) + R[0] * lat, c0[1] + fr[1] * (half + dep) + R[1] * lat)
                        poly = gf.rect(c[0], c[1], yaw, mw, md)
                        if ctx.legal(poly, rid, layer="rug", rug_under_ok=False)[0]:
                            add(make_piece(f"ffp-{tag}-mat", rid, "bath_mat", c, yaw, f"in front of {what}"), poly, "rug")
                            done = True
                            break
                    if done:
                        break
                if done:
                    break
        elif role == "terrace":
            area = float(room.get("area_m2") or 0)
            ang = ctx.dominant_axis(rid)
            grid = ctx.grid(rid, 10.0)
            if area >= SMALL_TERRACE_M2:
                mid_s, (sw, sd, sh), _k = dims("outdoor_set")
                best = None
                cands = sorted((-round(min(ctx.dist_to_openings(c, rid), 400.0), 0), round(c[1], 1), round(c[0], 1), a, c)
                               for c in grid for a in (ang, ang + 90.0, ang + 180.0, ang + 270.0))
                for sc in cands:
                    c, a = sc[4], sc[3]
                    yaw = (a + 90.0) % 360.0
                    poly = gf.rect(c[0], c[1], yaw, sw, sd)
                    if ctx.legal(poly, rid, cam_cm=60.0)[0]:
                        best = (sc, c, yaw, poly)
                        break
                if best:
                    add(make_piece(f"ffp-{tag}-set", rid, "outdoor_set", best[1], best[2],
                                   "the legal spot farthest from the terrace openings, along the terrace's axis"),
                        best[3], "floor")
                mid_p, (pw, pd, ph), _k = dims("plant")
                spots = []
                for c in corner_spots(rid, max(pw, pd), max(pw, pd) / 2 + 3):
                    poly = gf.rect(c[0], c[1], 0.0, pw, pd)
                    if ctx.legal(poly, rid, cam_cm=60.0)[0]:
                        spots.append((-min(ctx.dist_to_openings(c, rid), 300.0), round(c[1], 1), round(c[0], 1), c, poly))
                spots.sort()
                taken = []
                for _s, _y, _x, c, poly in spots:
                    if len(taken) >= 2:
                        break
                    if any(math.hypot(c[0] - t[0], c[1] - t[1]) < 250.0 for t in taken):
                        continue
                    if not ctx.legal(poly, rid, cam_cm=60.0)[0]:
                        continue
                    taken.append(c)
                    add(make_piece(f"ffp-{tag}-plant-{len(taken)}", rid, "plant", c, 0.0,
                                   "a convex terrace corner, far from the openings"), poly, "floor")
            else:
                mid_a, (aw, ad, ah), _k = dims("armchair")
                segs = ctx.opening_segments(rid)
                best = None
                cands = []
                for c in (grid if segs else []):
                    oc = min(((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0) for _i, a, b in segs)
                    base = gf.yaw_of(c[0] - oc[0], c[1] - oc[1])
                    for dy in (0.0, 20.0, -20.0, 40.0, -40.0):
                        cands.append((abs(dy), -round(min(ctx.dist_to_openings(c, rid), 300.0), 0), round(c[1], 1),
                                      round(c[0], 1), dy, c, (base + dy) % 360.0))
                for sc in sorted(cands):
                    c, yaw = sc[5], sc[6]
                    poly = gf.rect(c[0], c[1], yaw, aw, ad)
                    if ctx.legal(poly, rid, cam_cm=SMALL_ROOM_CAMERA_CM)[0]:
                        best = (sc, c, yaw, poly)
                        break
                if best:
                    add(make_piece(f"ffp-{tag}-chair", rid, "armchair", best[1], best[2],
                                   "the legal spot farthest from the door, facing away from it (out over the railing)"),
                        best[3], "floor")
        elif role in ("dining", "hall", "corridor"):
            for run in ctx.runs(rid):
                if run.length >= 90.0 and art_on(run, rid):
                    break
    return pieces


# ===================================================================================== the run
def run_planner(plan, style):
    pl = gf.Planner(plan, style)
    res = pl.run(float((plan.get("plan_meta") or {}).get("ceiling_height_cm", 290)))
    res["_footprints"] = [(i, [tuple(v) for v in p]) for i, p in pl.footprints]
    res["_planner"] = pl
    return res


def furnish(plan, style, log=print):
    """plan -> (furnished plan, furnishing block, fixtures added, translated islands, roles, resolved result)."""
    fixtures_in = list(plan.get("fixtures") or [])
    # (2026-11-06, the portal's first cloud build of an auto-traced 846: a vision-box vanity with room_id null crashed the planner)
    # a fixture whose room is missing or unknown goes to the room that contains its centre, else the nearest room within 60 cm;
    # one that no room holds is left out and said so (it is a trace finding, never a crash)
    room_ids = {r["id"] for r in plan["rooms"]}
    kept = []
    for f in fixtures_in:
        if f.get("room_id") in room_ids:
            kept.append(f); continue
        c = f.get("centre_cm") or (f.get("polygon_cm") and [sum(p[0] for p in f["polygon_cm"]) / len(f["polygon_cm"]), sum(p[1] for p in f["polygon_cm"]) / len(f["polygon_cm"])])
        best = None
        if c:
            for r in plan["rooms"]:
                if len(r.get("loop") or []) < 3:
                    continue
                d = gf.Polygon(r["loop"]).buffer(0).distance(gf.Point(c[0], c[1])) if hasattr(gf, "Polygon") else None
                if d is None:
                    from shapely.geometry import Polygon as _P, Point as _Pt
                    d = _P(r["loop"]).buffer(0).distance(_Pt(c[0], c[1]))
                if d <= 60 and (best is None or d < best[0]):
                    best = (d, r["id"])
        if best:
            log(f"  fixture {f['id']} had no room ({f.get('room_id')}): put in {best[1]} ({best[0]:.0f} cm from it)")
            kept.append({**f, "room_id": best[1], "room_note": f"assigned by furnish_from_plan: {best[0]:.0f} cm from the room"})
        else:
            log(f"  fixture {f['id']} ({f.get('kind')}) lies in no room: left out (a trace finding)")
    fixtures_in = kept
    roles = {r["id"]: room_role(r, plan, fixtures_in) for r in plan["rooms"]}
    log("roles      " + ", ".join(f"{k}={v}" for k, v in roles.items()))
    ctx = Ctx(plan, style)
    log("phase 1    template fixtures for rooms whose role lacks a drawn one")
    added, translated = template_fixtures(ctx, roles, fixtures_in, log)
    if not added:
        log("  (none: every room's role is covered by the plan's own fixtures)")
    tids = {t["id"] for t in translated}
    fixtures = [f for f in fixtures_in if f["id"] not in tids] + translated + added
    plan0 = copy.deepcopy(plan)
    plan0["fixtures"] = fixtures
    plan0.pop("furnishing", None)
    plan0["furnishing"] = {"version": "0.1.0", "fixture_hints": fixture_hints(Ctx(plan0, style), fixtures, lambda *_a: None),
                           "doors": {}, "pieces": []}
    log("phase 1b   fit: re-seat any built fixture that cuts a wall (dense 1 cm samples)")
    _res, adjusted = fit_fixtures(plan0, style, log)
    if not adjusted:
        log("  (none)")
    fixtures = plan0["fixtures"]
    log("phase 2    fixture hints (sink, hob, uppers)")
    hints = fixture_hints(Ctx(plan0, style), fixtures, log)
    plan0["furnishing"] = {"version": "0.1.0", "fixture_hints": hints, "doors": {}, "pieces": []}
    res0 = run_planner(plan0, style)
    log("phase 3    template pieces per room role")
    ctx1 = Ctx(plan0, style)
    pieces = template_pieces(ctx1, roles, res0, log)
    block = {"version": "0.1.0",
             "note": f"generated by furnish_from_plan.py v{VERSION} (card 07, B1): fixture_hints and pieces[] are "
                     f"derived by rule from room types and the traced geometry; no hand-read positions",
             "generator": {"name": "furnish_from_plan.py", "version": VERSION},
             "fixture_hints": hints, "doors": {}, "pieces": pieces}
    plan1 = copy.deepcopy(plan)
    plan1["fixtures"] = fixtures
    plan1["furnishing"] = block
    res1 = run_planner(plan1, style)
    res1["_adjusted"] = adjusted
    return plan1, block, added, translated, roles, res1


# ===================================================================================== the audit
def audit(plan, style, res, roles, original_ids):
    from shapely.geometry import LineString, Point, Polygon
    from shapely.ops import unary_union

    pl = res["_planner"]
    ceiling = float((plan.get("plan_meta") or {}).get("ceiling_height_cm", 290))

    def P(poly):
        g = Polygon([tuple(v) for v in poly])
        return g if g.is_valid else g.buffer(0)
    walls = unary_union([P(w["polygon_cm"]) for w in plan.get("walls", [])])
    panes = unary_union([P(q["polygon_cm"]) for q in plan.get("panes", [])]) if plan.get("panes") else Polygon()
    loops = {r["id"]: P(r["loop"]) for r in plan["rooms"]}
    room_of = {p["id"]: p["room_id"] for p in res["placements"]}
    room_of.update({q["id"]: q["room_id"] for q in res["procedural"]})
    obst = [(i, P(p)) for i, p in res["_footprints"]]
    obst_room = {i: room_of.get(i) or room_of.get(i.rsplit("-m", 1)[0]) for i, _p in obst}

    def origin(src):
        kind, _, ident = src.partition(":")
        if kind == "furnishing":
            return "template"
        base = ident
        return ("plan" if base in original_ids else "template") + ("-derived" if kind == "derived" else "")

    fp_ids = {i for i, _p in res["_footprints"]}
    items = [{"id": p["id"], "room_id": p["room_id"], "class": p["class"], "layer": p["layer"],
              "origin": origin(p["source"]), "w": p["width_cm"], "d": p["depth_cm"], "poly": p["footprint_cm"],
              "yaw": p["yaw_deg"], "floor": p["id"] in fp_ids} for p in res["placements"]]
    items += [{"id": q["id"], "room_id": q["room_id"], "class": q["kind"], "layer": "floor",
               "origin": origin(q["source"]), "poly": q["footprint_cm"], "parts": q["parts"], "floor": True}
              for q in res["procedural"]]

    # ---- walls / panes: a floor or on-top piece (each procedural part) shrunk WALL_TOL_CM; a wall-mounted
    # piece (art, mirror, uppers, hood) may sit 3 cm into the wall face: tested 2.5 cm forward, shrunk 0.5
    from shapely import affinity
    wall_hits = []
    for it in items:
        polys = [pt["poly_cm"] for pt in it.get("parts", [])] or [it["poly"]]
        for poly in polys:
            if it["layer"] == "wall":
                fx, fy = gf.dir_of_yaw(it["yaw"])
                g = affinity.translate(P(poly), fx * 2.5, fy * 2.5).buffer(-0.5)
            else:
                g = P(poly).buffer(-WALL_TOL_CM)
            if g.is_empty:
                continue
            aw, ap = g.intersection(walls).area, g.intersection(panes).area
            if aw > WALL_TOL_AREA_CM2 or ap > WALL_TOL_AREA_CM2:
                wall_hits.append({"id": it["id"], "room_id": it["room_id"], "origin": it["origin"],
                                  "wall_cm2": round(aw, 1), "pane_cm2": round(ap, 1)})
                break
    # ---- outside its room: the centre inside a room that is not open to its own, or > 40 cm from its own
    # floor (the tracer cut the kitchen bays out of the loop, so "outside the loop" alone is not the test)
    outside = []
    for it in items:
        if it["layer"] == "wall":
            continue
        c = P(it["poly"]).centroid
        ok_rooms = pl.open_to.get(it["room_id"], {it["room_id"]})
        other = next((r for r in loops if r not in ok_rooms and loops[r].contains(c)), None)
        far = min(loops[r].distance(c) for r in ok_rooms) > 40.0
        if other or far:
            outside.append({"id": it["id"], "room_id": it["room_id"], "in_room": other,
                            "dist_cm": round(min(loops[r].distance(c) for r in ok_rooms), 1)})
    # ---- openings
    door_rec = {d["opening"]: d for d in res["doors"]}
    openings = []
    for op in plan.get("openings", []):
        if op.get("kind") == "window":
            continue
        cx, cy, ux, uy, nx, ny = pg.door_frame(op)
        w = float(op["width_cm"])
        hw = w / 2.0
        sides = []
        for s in (1.0, -1.0):
            probe = (cx + nx * s * 35.0, cy + ny * s * 35.0)
            if any(r in loops and loops[r].buffer(15.0).contains(Point(probe)) for r in op["rooms"]):
                sides.append(s)
        zone_polys = [P(pg.oriented_rect(cx, cy, ux, uy, nx, ny, -hw, hw, *sorted((0.0, s * AUDIT_DEPTH_CM))))
                      for s in sides]
        zone = unary_union(zone_polys) if zone_polys else Polygon()
        intr = sorted({i for i, g in obst if g.intersection(zone).area > 1.0})
        hit_g = [g for i, g in obst if i in intr]
        free_best, cur, step = 0.0, 0.0, 2.0
        u = -hw + 1.0
        n_lo = min(sides) * AUDIT_DEPTH_CM if sides else 0.0
        n_hi = max(sides) * AUDIT_DEPTH_CM if sides else 0.0
        n_lo, n_hi = min(n_lo, 0.0), max(n_hi, 0.0)
        while u <= hw - 1.0 + 1e-9:
            seg = LineString([(cx + ux * u + nx * n_lo, cy + uy * u + ny * n_lo),
                              (cx + ux * u + nx * n_hi, cy + uy * u + ny * n_hi)])
            if any(seg.intersects(g) for g in hit_g):
                cur = 0.0
            else:
                cur += step
                free_best = max(free_best, cur)
            u += step
        free_best = min(free_best, w)
        need = min(w - 4.0, PASSAGE_MIN_CM)
        swing_hit = None
        d = door_rec.get(op["id"])
        arc = None
        if d is not None:
            inf = pg.door_infill(plan, op, ceiling)
            n0, n1 = inf["n_range_cm"]
            sl = pl.loops[d["swing_room"]]
            s_sw = 1.0 if pg.point_in_polygon((cx + nx * (n1 + 10.0), cy + ny * (n1 + 10.0)), sl) else -1.0
            hs = 1.0 if d["hinge"] == "+u" else -1.0
            arc = []
            for ang in range(0, 91, 10):
                leaf = pl._leaf_poly(cx, cy, ux, uy, nx, ny, hw, n0, n1, s_sw, hs, float(ang))
                arc.append(leaf)
                for i, g in obst:
                    if P(leaf).intersection(g).area > 2.0:
                        swing_hit = swing_hit or f"{i} at {ang} deg"
        blocked = free_best + 1e-6 < need or swing_hit is not None
        openings.append({"id": op["id"], "kind": op["kind"], "rooms": op["rooms"], "width_cm": w,
                         "virtual": pg.is_virtual_opening(op, ceiling), "need_cm": need, "free_cm": round(free_best, 1),
                         "in_zone": intr, "swing_hit": swing_hit, "blocked": blocked,
                         "_zone": [list(z.exterior.coords) for z in zone_polys], "_arc": arc,
                         "_seg": [(cx - ux * hw, cy - uy * hw), (cx + ux * hw, cy + uy * hw)]})
    # ---- sizes
    size_bad = []
    for it in items:
        rule = SIZE_RULES.get(it["class"])
        if not rule:
            continue
        # a piece the PLAN draws (a fixture read off the sales plan's casework layer, origin "plan") has the print's size: the print
        # wins over a catalogue range (fork F 2026-11-05: apt846's tall column 60.6 x 81.5 from the drawing failed the fridge range)
        if str(it.get("origin", "")) == "plan":
            continue
        if "w" in it:
            w, d = it["w"], it["d"]
        else:
            g = P(it["poly"]).minimum_rotated_rectangle
            xs = list(g.exterior.coords)
            e1 = math.dist(xs[0], xs[1])
            e2 = math.dist(xs[1], xs[2])
            w, d = max(e1, e2), min(e1, e2)
        if it["class"] == "bed_double":
            w, d = min(w, d), max(w, d)
        (w0, w1), (d0, d1) = rule
        if not (w0 - 0.5 <= w <= w1 + 0.5 and d0 - 0.5 <= d <= d1 + 0.5):
            size_bad.append({"id": it["id"], "class": it["class"], "w": round(w, 1), "d": round(d, 1), "rule": rule})
    # ---- coverage + walkway
    rooms_out = {}
    for r in plan["rooms"]:
        rid = r["id"]
        mine = [g for i, g in obst if obst_room.get(i) == rid]
        cov = unary_union(mine).intersection(loops[rid]).area / loops[rid].area if mine and loops[rid].area else 0.0
        n_items = [it for it in items if it["room_id"] == rid]
        walk = None
        cams = [(c["x"], c["y"]) for c in plan.get("camera_points", []) if c["room_id"] == rid]
        if cams and not r.get("is_outdoor"):
            floor = unary_union([loops[x] for x in pl.open_to[rid]])
            free = floor.buffer(-WALKWAY_CM / 2.0)
            if mine or obst:
                free = free.difference(unary_union([g for _i, g in obst]).buffer(WALKWAY_CM / 2.0))
            parts = list(getattr(free, "geoms", [free])) if not free.is_empty else []
            cam_pt = Point(cams[0])
            home = next((k for k, g in enumerate(parts) if g.distance(cam_pt) < 30.0), None)
            reach, total = [], 0
            for o in openings:
                if rid not in o["rooms"]:
                    continue
                total += 1
                (ax, ay), (bx, by) = o["_seg"]
                mx, my = (ax + bx) / 2.0, (ay + by) / 2.0
                tgt = Point(mx, my)
                ok = home is not None and parts[home].distance(tgt) <= WALKWAY_CM / 2.0 + 25.0
                reach.append((o["id"], ok))
            walk = {"reachable": sum(1 for _o, ok in reach if ok), "of": total,
                    "unreached": [o for o, ok in reach if not ok], "camera_free": home is not None}
        rooms_out[rid] = {"role": roles[rid], "area_m2": round(loops[rid].area / 1e4, 2),
                          "items": len(n_items),
                          "plan": sum(1 for it in n_items if it["origin"].startswith("plan")),
                          "template": sum(1 for it in n_items if it["origin"].startswith("template")),
                          "coverage_pct": round(100.0 * cov, 1), "walk": walk}
    indoor = [r["id"] for r in plan["rooms"] if not r.get("is_outdoor")]
    ind_area = sum(loops[r].area for r in indoor)
    ind_cov = unary_union([g for i, g in obst if obst_room.get(i) in indoor]).intersection(
        unary_union([loops[r] for r in indoor])).area
    counts = {"plan_fixture": sum(1 for it in items if it["origin"] == "plan"),
              "plan_derived": sum(1 for it in items if it["origin"] == "plan-derived"),
              "template": sum(1 for it in items if it["origin"] == "template"),
              "template_derived": sum(1 for it in items if it["origin"] == "template-derived")}
    furnished = [rid for rid, v in rooms_out.items() if v["items"] > 0]
    return {"rooms": rooms_out, "rooms_furnished": furnished, "items_total": len(items), "items_by_origin": counts,
            "openings": openings, "openings_blocked": [o["id"] for o in openings if o["blocked"]],
            "wall_hits": wall_hits, "outside_room": outside, "size_violations": size_bad,
            "floor_coverage_pct": round(100.0 * ind_cov / ind_area, 1) if ind_area else 0.0,
            "dropped": res["dropped"], "items": items}


# ===================================================================================== previews (Pillow)
COLORS = {"plan": (226, 140, 60), "plan-derived": (240, 196, 120), "template": (70, 160, 95),
          "template-derived": (150, 205, 160)}


def draw_previews(plan, res, aud, out_dir, rooms=None):
    from PIL import Image, ImageDraw, ImageFont
    try:
        font = ImageFont.load_default(size=13)
        big = ImageFont.load_default(size=17)
    except TypeError:
        font = big = ImageFont.load_default()
    written = []
    loops = {r["id"]: r["loop"] for r in plan["rooms"]}
    items = aud["items"]

    def render(name, bb, focus, title):
        x0, y0, x1, y1 = bb
        k = min(1100.0 / max(x1 - x0, 1.0), 1100.0 / max(y1 - y0, 1.0), 2.6)
        W, H = int((x1 - x0) * k) + 1, int((y1 - y0) * k) + 70
        img = Image.new("RGB", (W, H), (255, 255, 255))
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dr, do = ImageDraw.Draw(img), ImageDraw.Draw(ov)

        def T(p):
            return ((p[0] - x0) * k, (p[1] - y0) * k + 60)
        for r in plan["rooms"]:
            pts = [T(p) for p in r["loop"]]
            fill = (251, 246, 233) if r["id"] in focus else ((236, 244, 236) if r.get("is_outdoor") else (243, 243, 243))
            dr.polygon(pts, fill=fill, outline=(190, 190, 190))
        for w in plan.get("walls", []):
            dr.polygon([T(p) for p in w["polygon_cm"]], fill=(85, 85, 85))
        for q in plan.get("panes", []):
            dr.polygon([T(p) for p in q["polygon_cm"]], fill=(150, 196, 232), outline=(70, 130, 190))
        for o in aud["openings"]:
            if not any(r in focus for r in o["rooms"]):
                continue
            for z in o["_zone"]:
                do.polygon([T(p) for p in z], fill=(220, 40, 40, 70) if o["blocked"] else (40, 170, 210, 45))
            a, b = o["_seg"]
            col = (200, 30, 30) if o["blocked"] else ((20, 140, 170) if o["virtual"] else (30, 90, 200))
            dr.line([T(a), T(b)], fill=col, width=3)
            if o["_arc"]:
                tips = []
                for leaf in o["_arc"]:
                    tips.append(T(leaf[1]))
                dr.line(tips, fill=(30, 90, 200), width=2)
                dr.polygon([T(p) for p in o["_arc"][-1]], outline=(30, 90, 200))
            m = T(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
            dr.text((m[0] + 3, m[1] + 3), f"{o['id']} {o['free_cm']:.0f}/{o['need_cm']:.0f}", fill=col, font=font)
        img.paste(Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB"))
        dr = ImageDraw.Draw(img)
        order = {"rug": 0, "floor": 1, "on_top": 2, "wall": 3}
        for it in sorted(items, key=lambda i: order.get(i["layer"], 1)):
            if it["room_id"] not in focus:
                continue
            pts = [T(p) for p in it["poly"]]
            col = COLORS.get(it["origin"], (160, 160, 160))
            if it["layer"] == "rug":
                dr.polygon(pts, fill=tuple(min(255, c // 3 + 175) for c in col), outline=col)
            elif it["layer"] == "wall":
                dr.polygon(pts, fill=(150, 40, 150), outline=(150, 40, 150))
            elif it["layer"] == "on_top" and not it.get("floor"):
                dr.polygon(pts, outline=(60, 60, 60))
            else:
                dr.polygon(pts, fill=col, outline=(40, 40, 40))
        for it in items:
            if it["room_id"] not in focus or (it["layer"] == "on_top" and not it.get("floor")):
                continue
            c = centroid(it["poly"])
            p = T(c)
            label = it["class"].replace("kitchen_", "k.").replace("bathroom_", "b.")
            dr.text((p[0] - 3 * len(label), p[1] - 6), label, fill=(20, 20, 20), font=font)
        for cp in plan.get("camera_points", []):
            if cp["room_id"] not in focus:
                continue
            p = T((cp["x"], cp["y"]))
            rr = gf.CAMERA_BUBBLE_CM * k
            dr.ellipse([p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr], outline=(0, 90, 220))
            dr.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], fill=(0, 90, 220))
            dr.text((p[0] + 6, p[1] - 14), cp["id"], fill=(0, 70, 190), font=font)
        dr.rectangle([0, 0, W, 56], fill=(255, 255, 255))
        dr.text((8, 6), title, fill=(0, 0, 0), font=big)
        dr.text((8, 32), "orange = plan fixture, light orange = derived from it, green = template, purple = on wall, "
                         "blue zone = 60 cm approach (red = blocked), blue arc = door leaf 0-90 deg, "
                         "label free/need cm", fill=(80, 80, 80), font=font)
        path = os.path.join(out_dir, name)
        img.save(path, optimize=True)
        written.append(path)

    for r in plan["rooms"]:
        if rooms is not None and r["id"] not in rooms:
            continue
        rid = r["id"]
        bb = pg.bbox(r["loop"])
        bb = (bb[0] - 90, bb[1] - 90, bb[2] + 90, bb[3] + 90)
        v = aud["rooms"][rid]
        blk = [o["id"] for o in aud["openings"] if o["blocked"] and rid in o["rooms"]]
        title = (f"{rid} ({v['role']}, {v['area_m2']} m2): {v['items']} items - plan {v['plan']}, template "
                 f"{v['template']} | floor {v['coverage_pct']}% | blocked {len(blk)}")
        render(f"preview-{rid}.png", bb, {rid}, title)
    allb = pg.bbox([p for r in plan["rooms"] for p in r["loop"]])
    render("preview-all.png", (allb[0] - 60, allb[1] - 60, allb[2] + 60, allb[3] + 60), set(loops),
           f"{plan.get('apartment_id')}: {aud['items_total']} items, blocked {len(aud['openings_blocked'])}, "
           f"wall hits {len(aud['wall_hits'])}, floor {aud['floor_coverage_pct']}%")
    return written


# ===================================================================================== outputs
def strip(res):
    return {k: v for k, v in res.items() if not k.startswith("_")}


def write_outputs(plan_path, style_path, plan, plan1, block, added, translated, roles, res, aud, out_dir, log):
    os.makedirs(out_dir, exist_ok=True)
    prov = {"plan": {"path": plan_path.replace("\\", "/"), "sha256": sha256_file(plan_path)},
            "style": {"path": style_path.replace("\\", "/"), "sha256": sha256_file(style_path)},
            "generator": {"name": "furnish_from_plan.py", "version": VERSION,
                          "sha256": sha256_file(os.path.abspath(__file__)),
                          "general_furnish": gf.VERSION, "plan_general": getattr(pg, "VERSION", None)}}
    placements = {"schema": SCHEMA_ID, **prov,
                  "consume": "build_scene reads plan.fixtures[] + plan.furnishing: set plan['fixtures'] = "
                             "this['fixtures'] and plan['furnishing'] = this['furnishing'] (or build "
                             "plan.furnished.json as is). fixtures = the plan's own (re-seated where listed in "
                             "fixtures_adjusted) + fixtures_translated + fixtures_added",
                  "roles": roles, "fixtures": plan1["fixtures"], "furnishing": block,
                  "fixtures_added": added, "fixtures_translated": translated,
                  "fixtures_adjusted": res.get("_adjusted") or [], "resolved": strip(res)}
    with open(os.path.join(out_dir, "placements.json"), "w", encoding="utf-8") as fh:
        json.dump(placements, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(out_dir, "plan.furnished.json"), "w", encoding="utf-8") as fh:
        json.dump(plan1, fh, ensure_ascii=False, indent=1)
    rep = {"schema": SCHEMA_ID + "/report", **prov,
           "bars_cm": {"probe_out": PROBE_OUT_CM, "template_camera": TEMPLATE_CAMERA_CM,
                       "virtual_zone": VIRTUAL_ZONE_CM, "audit_depth": AUDIT_DEPTH_CM, "passage_min": PASSAGE_MIN_CM,
                       "wall_tol": WALL_TOL_CM, "wall_tol_area_cm2": WALL_TOL_AREA_CM2, "walkway": WALKWAY_CM},
           **{k: v for k, v in aud.items() if k not in ("items", "openings")},
           "openings": [{k: v for k, v in o.items() if not k.startswith("_")} for o in aud["openings"]],
           "warnings": res["warnings"]}
    with open(os.path.join(out_dir, "report.json"), "w", encoding="utf-8") as fh:
        json.dump(rep, fh, ensure_ascii=False, indent=1)
    pngs = draw_previews(plan1, res, aud, out_dir)
    return pngs


def summarize(aud, res, log):
    for rid, v in aud["rooms"].items():
        w = v["walk"]
        ws = f"walk {w['reachable']}/{w['of']}" + (f" (unreached {','.join(w['unreached'])})" if w and w["unreached"] else "") if w else "walk -"
        log(f"  {rid:18s} {v['role']:9s} {v['area_m2']:6.2f} m2  items {v['items']:3d} (plan {v['plan']:2d}, template "
            f"{v['template']:2d})  floor {v['coverage_pct']:5.1f}%  {ws}")
    for o in aud["openings"]:
        log(f"  opening {o['id']:5s} {o['kind']:13s} {o['width_cm']:6.1f} cm  free {o['free_cm']:6.1f} / need "
            f"{o['need_cm']:5.1f}  swing {o['swing_hit'] or 'clear' if o['_arc'] else '-':10s}  "
            f"{'BLOCKED' if o['blocked'] else 'ok'}  zone: {','.join(o['in_zone']) or '-'}")
    for d in aud["dropped"]:
        log(f"  dropped by general_furnish: {d['id']} ({'; '.join(d['why'])})")
    c = aud["items_by_origin"]
    log(f"rooms furnished: {len(aud['rooms_furnished'])} of {len(aud['rooms'])}")
    log(f"items placed: {aud['items_total']} (from plan: {c['plan_fixture'] + c['plan_derived']} = "
        f"{c['plan_fixture']} fixtures + {c['plan_derived']} derived; from template: "
        f"{c['template'] + c['template_derived']} = {c['template']} + {c['template_derived']} derived)")
    log(f"openings blocked: {len(aud['openings_blocked'])} of {len(aud['openings'])}"
        + (f" ({', '.join(aud['openings_blocked'])})" if aud["openings_blocked"] else ""))
    log(f"items intersecting walls: {len(aud['wall_hits'])}"
        + (" (" + ", ".join(f"{h['id']} {h['wall_cm2']}/{h['pane_cm2']} cm2" for h in aud["wall_hits"]) + ")"
           if aud["wall_hits"] else ""))
    log(f"items outside their room: {len(aud['outside_room'])}")
    log(f"size violations: {len(aud['size_violations'])}"
        + (" (" + ", ".join(f"{s['id']} {s['w']}x{s['d']}" for s in aud["size_violations"]) + ")"
           if aud["size_violations"] else ""))
    log(f"floor coverage: {aud['floor_coverage_pct']}% of the indoor floor")


def gates(aud):
    return (len(aud["rooms_furnished"]) >= 5 and not aud["openings_blocked"] and not aud["wall_hits"]
            and not aud["outside_room"] and not aud["size_violations"])


def run_one(plan_path, style_path, out_dir, log=print, quiet_phases=False):
    with open(plan_path, encoding="utf-8") as fh:
        plan = json.load(fh)
    with open(style_path, encoding="utf-8") as fh:
        style = json.load(fh)
    plog = (lambda *_a: None) if quiet_phases else log
    plan1, block, added, translated, roles, res = furnish(plan, style, plog)
    original = {f["id"] for f in plan.get("fixtures") or []}
    aud = audit(plan1, style, res, roles, original)
    pngs = []
    if out_dir:
        pngs = write_outputs(plan_path, style_path, plan, plan1, block, added, translated, roles, res, aud, out_dir, log)
    return plan, plan1, block, added, res, aud, pngs


# ===================================================================================== selftest
def toy_plan(fixtures=None):
    """Three rooms in a 1060 x 400 cm box: bedroom | kitchen | bathroom, 10 cm partitions with doors, an
    entrance door into the kitchen from the south, one camera per room."""
    def rc(x0, y0, x1, y1):
        return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    walls = [("w-n", rc(0, 0, 1060, 20)), ("w-s1", rc(0, 380, 560, 400)), ("w-s2", rc(660, 380, 1060, 400)),
             ("w-w", rc(0, 0, 20, 400)), ("w-e", rc(1040, 0, 1060, 400)),
             ("w-p1a", rc(420, 20, 430, 290)), ("w-p1b", rc(420, 370, 430, 380)),
             ("w-p2a", rc(830, 20, 840, 300)), ("w-p2b", rc(830, 370, 840, 380))]
    rooms = [("r-bed", "bedroom", rc(20, 20, 420, 380)), ("r-kit", "kitchen", rc(430, 20, 830, 380)),
             ("r-bath", "bathroom", rc(840, 20, 1040, 380))]

    def loopify(loop):
        return oriented([tuple(p) for p in loop])
    plan = {"schema_version": "0.2.0", "units": "cm", "geometry": "general", "axes": "x right, y down",
            "apartment_id": "toy", "plan_meta": {"ceiling_height_cm": 270},
            "rooms": [{"id": i, "type": t, "name_en": i, "is_outdoor": False, "loop": [list(p) for p in loopify(lp)],
                       "area_m2": abs(pg.shoelace(lp)) / 1e4, "edge_kinds": ["wall"] * 4} for i, t, lp in rooms],
            "walls": [{"id": i, "polygon_cm": [list(p) for p in loopify(p)], "height_cm": 270} for i, p in walls],
            "openings": [
                {"id": "d-1", "kind": "door", "rooms": ["r-bed", "r-kit"], "centre_cm": [425, 330], "angle_deg": 90,
                 "width_cm": 80, "sill_cm": 0, "head_cm": 210},
                {"id": "d-2", "kind": "door", "rooms": ["r-kit", "r-bath"], "centre_cm": [835, 335], "angle_deg": 90,
                 "width_cm": 70, "sill_cm": 0, "head_cm": 210},
                {"id": "d-0", "kind": "entrance_door", "rooms": ["outside", "r-kit"], "centre_cm": [610, 390],
                 "angle_deg": 0, "width_cm": 100, "sill_cm": 0, "head_cm": 210}],
            "panes": [], "camera_points": [
                {"id": "cp-bed", "room_id": "r-bed", "x": 300, "y": 300, "z": 150, "yaw_deg": 0},
                {"id": "cp-kit", "room_id": "r-kit", "x": 630, "y": 280, "z": 150, "yaw_deg": 0},
                {"id": "cp-bath", "room_id": "r-bath", "x": 960, "y": 300, "z": 150, "yaw_deg": 0}]}
    if fixtures is not None:
        plan["fixtures"] = fixtures
    return plan


def selftest(plan_path, style_path, out_dir):
    fails = []

    def ok(cond, what):
        print(f"  [{'PASS' if cond else 'FAIL'}] {what}")
        if not cond:
            fails.append(what)
    with open(style_path, encoding="utf-8") as fh:
        style = json.load(fh)
    quiet = lambda *_a: None  # noqa: E731
    print("selftest 1: a toy plan with NO fixtures key (card 01's intake today) is furnished from templates")
    toy = toy_plan(None)
    t1, _b, added, _t, roles, res = furnish(toy, style, quiet)
    aud = audit(t1, style, res, roles, set())
    kinds = {(f["room_id"], f["kind"]) for f in added}
    ok({("r-bed", "bed"), ("r-kit", "counter"), ("r-bath", "wc"), ("r-bath", "vanity")} <= kinds,
       f"template fixtures: bed, kitchen run, WC, vanity ({sorted(k for _r, k in kinds)})")
    ok(len(aud["rooms_furnished"]) == 3, f"all 3 toy rooms furnished ({aud['rooms_furnished']})")
    ok(not aud["openings_blocked"] and not aud["wall_hits"],
       f"toy: openings blocked {aud['openings_blocked']}, wall hits {[h['id'] for h in aud['wall_hits']]}")
    ok(any(p["class"] == "nightstand" for p in res["placements"]), "general_furnish derives nightstands from the template bed")
    print("selftest 2: negative controls - the audit can say NO")
    bad = copy.deepcopy(t1)
    bad["furnishing"]["pieces"].append({"id": "x-block", "room_id": "r-kit", "class": "tv_unit",
                                        "centre_cm": [470, 330], "yaw_deg": 90, "size_cm": [120, 60, 75], "keep": True})
    resb = run_planner(bad, style)
    audb = audit(bad, style, resb, roles, set())
    ok("d-1" in audb["openings_blocked"], f"a cabinet parked in front of door d-1 is caught ({audb['openings_blocked']})")
    resw = run_planner(t1, style)                        # general_furnish would nudge it out, so inject it after
    poly = gf.rect(835.0, 150.0, 90.0, 120.0, 60.0)
    resw["placements"].append({"id": "x-wall", "room_id": "r-kit", "source": "furnishing:x-wall", "class": "tv_unit",
                               "model": "x", "x_cm": 835.0, "y_cm": 150.0, "yaw_deg": 90.0, "width_cm": 120.0,
                               "depth_cm": 60.0, "height_cm": 75.0, "anchor": "floor", "z_cm": None, "layer": "floor",
                               "scale_xyz": [1, 1, 1], "footprint_cm": [list(p) for p in poly], "checks": []})
    resw["_footprints"].append(("x-wall", poly))
    audw = audit(t1, style, resw, roles, set())
    ok(any(h["id"] == "x-wall" for h in audw["wall_hits"]), "a cabinet straddling a partition is caught as a wall hit")
    print("selftest 3: an island (schema enum, no general_furnish rule) becomes a counter fronting the run")
    toy3 = toy_plan([{"id": "k-run", "room_id": "r-kit", "kind": "counter", "centre_cm": [630, 52], "angle_deg": 0,
                      "size_cm": [300, 60], "height_cm": 90},
                     {"id": "k-isl", "room_id": "r-kit", "kind": "island", "centre_cm": [630, 190], "angle_deg": 0,
                      "size_cm": [180, 90], "height_cm": 90}])
    _p3, _b3, _a3, tr3, _r3, res3 = furnish(toy3, style, quiet)
    isl = next((p for p in res3["placements"] if p["source"] == "fixture:k-isl"), None)
    ok(tr3 and isl is not None and abs(((isl["yaw_deg"] - 0.0 + 180) % 360) - 180) < 1.0,
       f"island built as a counter facing the run (yaw {isl and isl['yaw_deg']})")
    print(f"selftest 4: the real plan {plan_path}")
    plan, plan1, block, added4, res4, aud4, pngs = run_one(plan_path, style_path, out_dir, print)
    summarize(aud4, res4, print)
    roles4 = {r["id"]: v["role"] for r, v in zip(plan1["rooms"], aud4["rooms"].values())}
    need = {"living": 1, "kitchen": 1, "bedroom": 2, "bathroom": 1}
    got = {k: sum(1 for rid in aud4["rooms_furnished"] if roles4.get(rid) == k) for k in need}
    ok(all(got[k] >= v for k, v in need.items()), f"the five target rooms are furnished: {got}")
    ok(len(aud4["rooms_furnished"]) >= 5, f"rooms furnished: {len(aud4['rooms_furnished'])} >= 5")
    ok(not aud4["openings_blocked"], f"openings blocked: {len(aud4['openings_blocked'])}")
    ok(not aud4["wall_hits"], f"items intersecting walls: {len(aud4['wall_hits'])}")
    ok(not aud4["outside_room"], f"items outside their room: {aud4['outside_room']}")
    ok(not aud4["size_violations"], f"size violations: {aud4['size_violations']}")
    beds = [p for p in res4["placements"] if p["class"] == "bed_double"]
    ok(beds and all(140 <= min(p["width_cm"], p["depth_cm"]) <= 200 and 190 <= max(p["width_cm"], p["depth_cm"]) <= 220
                    for p in beds), f"beds realistic: {[(p['id'], p['width_cm'], p['depth_cm']) for p in beds]}")
    tmpl_ids = {p["id"] for p in block["pieces"]}
    built = {p["id"] for p in res4["placements"]}
    ok(tmpl_ids <= built, f"every template piece survives general_furnish's own checks ({len(tmpl_ids)} pieces, dropped "
                          f"{sorted(tmpl_ids - built)})")
    ok(all(p.get("rule") and p.get("source", "").startswith("template:") for p in block["pieces"])
       and all("centre_cm" in p for p in block["pieces"]), "every piece carries its rule (no hand-read position)")
    furnished_rooms = aud4["rooms_furnished"]
    ok(all(os.path.isfile(os.path.join(out_dir, f"preview-{rid}.png")) for rid in furnished_rooms)
       and os.path.isfile(os.path.join(out_dir, "preview-all.png")),
       f"a preview PNG per furnished room ({len(furnished_rooms)}) + preview-all.png")
    _p, _p1, block_b, _a, _r, _au, _png = run_one(plan_path, style_path, None, quiet, quiet_phases=True)
    h1 = hashlib.sha256(json.dumps(block, sort_keys=True).encode()).hexdigest()
    h2 = hashlib.sha256(json.dumps(block_b, sort_keys=True).encode()).hexdigest()
    ok(h1 == h2, f"deterministic: two runs give the same furnishing block ({h1[:12]})")
    print("selftest 5: the same plan with its fixtures REMOVED (tolerance; reported, gated on blocked/walls only)")
    plan_nf = copy.deepcopy(plan)
    plan_nf.pop("fixtures", None)
    p5, b5, a5, t5, r5, res5 = furnish(plan_nf, style, quiet)
    aud5 = audit(p5, style, res5, r5, set())
    print(f"  no-fixtures variant: {len(a5)} template fixtures ({', '.join(f['id'] for f in a5)}); rooms furnished "
          f"{len(aud5['rooms_furnished'])}; items {aud5['items_total']}; blocked {aud5['openings_blocked']}; wall hits "
          f"{[h['id'] for h in aud5['wall_hits']]}; floor {aud5['floor_coverage_pct']}%")
    ok(len(aud5["rooms_furnished"]) >= 5, "no-fixtures variant still furnishes 5+ rooms")
    ok(not aud5["openings_blocked"], f"no-fixtures variant: openings blocked {aud5['openings_blocked']}")
    ok(not aud5["wall_hits"], f"no-fixtures variant: wall hits {[h['id'] for h in aud5['wall_hits']]}")
    nf_dir = os.path.join(out_dir, "no-fixtures")
    os.makedirs(nf_dir, exist_ok=True)
    draw_previews(p5, res5, aud5, nf_dir, rooms=set())
    print(f"selftest: {len(fails)} failure(s)")
    return 1 if fails else 0


# ===================================================================================== CLI
def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--plan", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--style", default=DEFAULT_STYLE)
    ap.add_argument("--selftest", action="store_true", help="the toy + negative controls + the real-plan gates")
    ap.add_argument("--json", action="store_true", help="print placements.json's furnishing block")
    a = ap.parse_args(argv)
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except AttributeError:
        pass
    plan_path, out_dir, style_path = os.path.abspath(a.plan), os.path.abspath(a.out), os.path.abspath(a.style)
    print(f"furnish_from_plan.py v{VERSION} (general_furnish v{gf.VERSION})")
    print(f"plan  {plan_path}\nstyle {style_path}\nout   {out_dir}")
    if a.selftest:
        return selftest(plan_path, style_path, out_dir)
    _plan, _plan1, block, _added, res, aud, pngs = run_one(plan_path, style_path, out_dir, print)
    summarize(aud, res, print)
    print(f"previews: {len(pngs)} written")
    if a.json:
        print(json.dumps(block, ensure_ascii=False, indent=1))
    return 0 if gates(aud) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

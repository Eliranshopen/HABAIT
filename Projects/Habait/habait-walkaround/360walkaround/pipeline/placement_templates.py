#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""placement_templates.py -- deterministic, rule-driven furnishing: room polygon -> placements.

Board `360-v2` T12 · render-pipeline-engineer · pure Python (no Blender, no third-party deps), so it
runs in milliseconds under a plain `python3`, is testable without paying Blender's startup, and can be
asserted in CI. `build_scene.py` imports it under Blender; the CLI at the bottom runs it standalone.

    python 360walkaround/pipeline/placement_templates.py <plan.json> \
        --style 360walkaround/catalog/style-habait-modern.json --seed 0 --report out.json
    python 360walkaround/pipeline/placement_templates.py <plan.json> --style <lock> --selftest

--------------------------------------------------------------------------------------------------
WHAT THIS IS (and what it deliberately is NOT)
--------------------------------------------------------------------------------------------------
The reference product (research/walkaround-reference/REPORT.md §2.5) stages an apartment as **146
deterministic catalog placements over an unchanged traced layout**, with the style carried as a model-
name suffix. That is exactly the split here: **this file owns WHERE a `sofa` goes; the style lock owns
WHICH model a `sofa` is.** A style swap is a different lock file over an unchanged layout algorithm --
root `CLAUDE.md` §2 executed at the data layer. ⛔ There is no AI placement and no randomness beyond a
seeded, hash-derived choice among rule-legal alternatives (S-V2-2/S-V2-3 rejected those paths).

--------------------------------------------------------------------------------------------------
THE ALGORITHM: ranked candidates + accept-if-legal (not "place, then hope")
--------------------------------------------------------------------------------------------------
Every slot in a room template generates a deterministic, RANKED list of candidate placements (which
wall run, which alignment along it, which fallback position). The first candidate that passes EVERY
rule against the pieces already accepted is taken; if none passes, the slot is skipped and says so in
the log. Consequences worth stating plainly:

  * "no placement violates a rule" is true BY CONSTRUCTION, not by inspection afterwards; the
    independent `check_placements()` re-assert at the end is a second pair of eyes on the first pair,
    and `--selftest` proves that pair of eyes can actually SAY NO (a deliberately illegal layout must
    be rejected, or the check is decoration -- the T04/T07 lesson: a check that cannot fail is a
    constant).
  * A small room simply gets less furniture. That is the correct answer, not a defect to design around.

THE RULES (each one is a named function; all distances in cm, all bars in one block below)
  R-INSIDE   every footprint lies fully inside the room's own `loop` (sampled outline, so a notched
             or L-shaped room is handled, not just its bbox)
  R-OVERLAP  no two floor-layer footprints overlap (rugs sit under; counter items sit on a support)
  R-DOOR     nothing intrudes into a door's swing rectangle: the leaf width, projected `max(leaf,
             DOOR_SWING_MIN_CM)` into the room
  R-CAMERA   nothing comes within `CAMERA_BUBBLE_CM` of a camera point, measured in 3-D against the
             piece's oriented bounding box. ⭐ 3-D and OBB-based on purpose: `build_scene.py::verify`
             measures the same clearance against the BUILT MESH, and mesh-distance >= OBB-distance, so
             passing here guarantees passing there. A 2-D-only rule would happily hang a pendant 22 cm
             above the camera's head and fail the build.
  R-WALK     from every door/opening of the room there is a `WALKWAY_CM`-wide free path to the room's
             camera point (a disc of radius WALKWAY_CM/2 rolled through the free space -- exact
             per-cell clearance to the room's blocking edges and to every accepted footprint, then a
             4-neighbour flood fill). This is the rule that stops a sofa sealing an open-plan boundary.
  R-WINDOW   a piece taller than a window's sill may not stand in front of that window
  R-SUPPORT  an `on_top` piece must actually sit on an accepted support piece's footprint

--------------------------------------------------------------------------------------------------
FRAME (identical to build_scene.py's -- ENV.md §9, SCHEMA §1)
--------------------------------------------------------------------------------------------------
plan is cm, +x right, +y DOWN. `yaw_deg` is the plan bearing a piece FACES: 0 = -y (plan-north),
90 = +x (plan-east), clockwise. A placement's `(x_cm, y_cm)` is the FOOTPRINT CENTRE, which is exactly
what `build_scene.py::place_model` consumes; `front_local` (which local axis is the model's front)
lives in the style lock, per model, so this file never needs to know a model's internal orientation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import place_cameras as pc  # noqa: E402  (deepest_point / point_in_polygon / dist_to_boundary)

VERSION = "1.0.0"

# ----------------------------------------------------------------------------------------------
# THE BARS. Every numeric rule in this file is one of these constants -- one place to read them,
# one place to change them, and the report echoes them so a reader never has to trust the prose.
# ----------------------------------------------------------------------------------------------
WALKWAY_CM = 60.0          # the task's own bar: a walkable path this wide must survive furnishing
CAMERA_BUBBLE_CM = 45.0    # 5 cm of margin over build_scene's 40 cm mesh bar (T06's own criterion)
CAMERA_STAND_CM = 25.0     # ...and, in PLAN, a person's own footprint: a camera point stands on the
#                            floor, so no floor-standing piece may be nearer than this in 2-D even
#                            when it is short enough to clear the 3-D bubble (see r_camera)
DOOR_SWING_MIN_CM = 90.0   # a door arc is at least this deep even for a narrow leaf
DOOR_SWING_MAX_CM = 110.0  # ...and never deeper than a real leaf, however wide the traced opening
SLIDING_CLEAR_CM = 60.0    # a sliding door does not sweep: it needs a threshold strip, not an arc
WALL_GAP_CM = 2.0          # a piece stands this far off its wall (skirting is 1.6 cm, F-360 T06)
OPENING_MARGIN_CM = 8.0    # a wall run stops this far short of an opening's edge
GRID_CM = 5.0              # the walkway raster; 5 cm over a 4 m room is ~80 cells per side
MIN_RUN_SLACK_CM = 4.0     # a run must beat the piece's width by this much to count as hosting it
FACING_MIN_GAP_CM = 150.0  # a sofa and the wall it faces must be at least this far apart
INSIDE_EPS_CM = 0.5        # containment is tested on a footprint shrunk this much (see r_inside)
SWEEP_STEP_CM = 25.0       # after the preferred alignments, a run is swept at this pitch
WALL_ART_CENTRE_CM = 150.0    # T13: wall art hangs by its CENTRE at eye level, not by its bottom --
#                               the gallery convention. Was a flat 150 cm BOTTOM, which put this
#                               catalog's 84.1 cm frame at a 192.1 cm centre in all six art rooms.
WALL_ART_MIN_BOTTOM_CM = 90.0 # ...but never lower than this off the floor, whatever the art's height
WALL_ART_CLEAR_OVER_CM = 15.0 # ...and this far clear of the top of whatever it hangs over


# ==================================================================================== geometry
def bearing_of(dx: float, dy: float) -> float:
    """Plan bearing (deg) of the direction (dx, dy). 0 = -y (north), 90 = +x (east), clockwise."""
    return math.degrees(math.atan2(dx, -dy)) % 360.0


def dir_of(bearing_deg: float) -> tuple[float, float]:
    t = math.radians(bearing_deg)
    return math.sin(t), -math.cos(t)


def _norm(dx, dy):
    n = math.hypot(dx, dy)
    return (0.0, 0.0) if n < 1e-12 else (dx / n, dy / n)


class OBB:
    """An oriented box: centre (x,y), half-extents along its own u (width) and v (depth) axes, and a
    z range. `u` points along the piece's WIDTH, `v` along its DEPTH (the facing direction)."""

    __slots__ = ("x", "y", "u", "v", "hw", "hd", "z0", "z1")

    def __init__(self, x, y, yaw_deg, w, d, z0, z1):
        vx, vy = dir_of(yaw_deg)          # depth axis = the way the piece faces
        self.x, self.y = float(x), float(y)
        self.v = (vx, vy)
        self.u = (-vy, vx)                # width axis, 90 deg from the facing direction
        self.hw, self.hd = w / 2.0, d / 2.0
        self.z0, self.z1 = float(z0), float(z1)

    def corners(self):
        ux, uy = self.u
        vx, vy = self.v
        return [(self.x + su * self.hw * ux + sv * self.hd * vx,
                 self.y + su * self.hw * uy + sv * self.hd * vy)
                for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1))]

    def local(self, px, py):
        dx, dy = px - self.x, py - self.y
        return dx * self.u[0] + dy * self.u[1], dx * self.v[0] + dy * self.v[1]

    def dist2d(self, px, py) -> float:
        lu, lv = self.local(px, py)
        du = max(abs(lu) - self.hw, 0.0)
        dv = max(abs(lv) - self.hd, 0.0)
        return math.hypot(du, dv)

    def dist3d(self, px, py, pz) -> float:
        """Distance from a point to this box in 3-D. ⭐ `build_scene.py::verify` measures the same
        clearance against the built MESH; mesh-distance >= this, so this bound is conservative."""
        d2 = self.dist2d(px, py)
        dz = max(self.z0 - pz, pz - self.z1, 0.0)
        return math.hypot(d2, dz)

    def contains2d(self, px, py, pad=0.0) -> bool:
        lu, lv = self.local(px, py)
        return abs(lu) <= self.hw + pad and abs(lv) <= self.hd + pad

    def overlaps(self, other: "OBB", pad: float = 0.0) -> bool:
        """Separating-axis test on the four face normals (exact for two convex rectangles)."""
        for box in (self, other):
            for axis in (box.u, box.v):
                a0, a1 = _project(self, axis)
                b0, b1 = _project(other, axis)
                if a1 + pad <= b0 or b1 + pad <= a0:
                    return False
        return True


def _project(box: OBB, axis):
    ax, ay = axis
    c = box.x * ax + box.y * ay
    r = abs(box.hw * (box.u[0] * ax + box.u[1] * ay)) + abs(box.hd * (box.v[0] * ax + box.v[1] * ay))
    return c - r, c + r


def seg_point_dist(px, py, ax, ay, bx, by) -> float:
    return pc.dist_point_to_segment(px, py, ax, ay, bx, by)


# ============================================================================== room geometry
class Edge:
    """One directed edge of a room's `loop`, with the inward normal a piece placed on it would face."""

    def __init__(self, index, p0, p1, inward_sign):
        self.index = index
        self.p0, self.p1 = p0, p1
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        self.length = math.hypot(dx, dy)
        self.dir = _norm(dx, dy)
        nx, ny = (-dy, dx) if inward_sign > 0 else (dy, -dx)
        self.normal = _norm(nx, ny)
        self.bearing_in = bearing_of(*self.normal)   # the plan bearing a piece on this wall FACES
        self.openings = []                            # [(opening, s0, s1)] in edge-local cm
        self.is_virtual = False

    def point_at(self, s):
        return self.p0[0] + self.dir[0] * s, self.p0[1] + self.dir[1] * s

    def blocked_intervals(self, margin=OPENING_MARGIN_CM, piece_h=None):
        """⭐ Height-aware. An opening only breaks a wall run for a piece TALLER than its sill: a
        bathtub (55 cm) under a window with a 140 cm sill, a bed (55 cm) under a 90 cm sill and a
        kitchen counter (88 cm) under a 90 cm sill are all normal, and a height-blind rule chopped
        the pilot's only 345 cm bathroom wall into two useless 112/151 cm stubs."""
        out = []
        for op, s0, s1 in self.openings:
            sill = float(op.get("sill_cm", 0.0))
            if piece_h is not None and sill >= piece_h - 1e-6:
                continue
            out.append((max(0.0, s0 - margin), min(self.length, s1 + margin)))
        return sorted(out)

    def clear_runs(self, margin=OPENING_MARGIN_CM, piece_h=None):
        """The parts of this edge a piece `piece_h` tall can stand against, as [(s0, s1, length)]."""
        runs, cursor = [], 0.0
        for b0, b1 in self.blocked_intervals(margin, piece_h):
            if b0 - cursor > 1e-6:
                runs.append((cursor, b0, b0 - cursor))
            cursor = max(cursor, b1)
        if self.length - cursor > 1e-6:
            runs.append((cursor, self.length, self.length - cursor))
        return runs


class RoomGeo:
    """Everything the templates need to reason about one room, derived once from `plan.json`."""

    def __init__(self, room, plan):
        self.room = room
        self.id = room["id"]
        self.type = room["type"]
        self.loop = [(float(x), float(y)) for x, y in room["loop"]]
        self.area_m2 = float(room["area_m2"])
        self.bbox = pc.bbox_of(self.loop)
        sign = _inward_sign(self.loop)
        self.edges = [Edge(i, self.loop[i], self.loop[(i + 1) % len(self.loop)], sign)
                      for i in range(len(self.loop))]
        self.walls = {w["id"]: w for w in plan["walls"]}
        self.openings = [op for op in plan["openings"] if room["id"] in op.get("rooms", [])]
        self._attach_openings()
        self.cameras = [cp for cp in plan["camera_points"] if cp["room_id"] == room["id"]]
        self.ceiling_cm = float(plan["plan_meta"]["ceiling_height_cm"])
        self.deep_x, self.deep_y, self.deep_clear = pc.deepest_point(self.loop)

    # -- openings -> edges ----------------------------------------------------------------
    def _attach_openings(self):
        """Project every opening of this room onto the loop edge it sits in.

        An opening carries a `wall_id` + an axis + a [start,end] span in PLAN coordinates; the room's
        loop edge that the opening pierces is the one that is (a) parallel to the span, (b) whose
        constant coordinate lies within the wall's own rect (a room's loop runs along the wall's
        INTERIOR FACE, so the two differ by the wall's thickness, never more), and (c) that overlaps
        the span. Anything unmatched is reported by `unmatched_openings` rather than dropped."""
        self.unmatched = []
        for op in self.openings:
            w = self.walls.get(op["wall_id"])
            if w is None:
                self.unmatched.append((op["id"], "unknown wall"))
                continue
            wx0, wy0, wx1, wy1 = w["rect_cm"]
            axis = op["axis"]                     # 'x' -> the opening spans along x -> a horizontal edge
            s_lo, s_hi = float(op["start_cm"]), float(op["end_cm"])
            best = None
            for e in self.edges:
                ex0, ey0 = e.p0
                ex1, ey1 = e.p1
                if axis == "x":
                    if abs(ey1 - ey0) > 1e-6:
                        continue                   # not a horizontal edge
                    if not (min(wy0, wy1) - 1e-6 <= ey0 <= max(wy0, wy1) + 1e-6):
                        continue                   # not on this wall's band
                    lo, hi = sorted((ex0, ex1))
                else:
                    if abs(ex1 - ex0) > 1e-6:
                        continue
                    if not (min(wx0, wx1) - 1e-6 <= ex0 <= max(wx0, wx1) + 1e-6):
                        continue
                    lo, hi = sorted((ey0, ey1))
                ov = min(hi, s_hi) - max(lo, s_lo)
                if ov > 1e-6 and (best is None or ov > best[1]):
                    best = (e, ov)
            if best is None:
                self.unmatched.append((op["id"], "no loop edge matches"))
                continue
            e = best[0]
            # edge-local coordinates of the opening's span
            if axis == "x":
                s0 = (s_lo - e.p0[0]) * (1 if e.dir[0] >= 0 else -1)
                s1 = (s_hi - e.p0[0]) * (1 if e.dir[0] >= 0 else -1)
            else:
                s0 = (s_lo - e.p0[1]) * (1 if e.dir[1] >= 0 else -1)
                s1 = (s_hi - e.p0[1]) * (1 if e.dir[1] >= 0 else -1)
            s0, s1 = sorted((max(0.0, min(e.length, s0)), max(0.0, min(e.length, s1))))
            e.openings.append((op, s0, s1))
            if w["kind"] == "virtual":
                e.is_virtual = True

    # -- derived sets ---------------------------------------------------------------------
    def doors(self):
        return [(e, op, s0, s1) for e in self.edges for (op, s0, s1) in e.openings
                if op["kind"] in ("door", "entrance_door", "glazed_door", "sliding_door", "entrance")]

    def all_openings_on_edges(self):
        return [(e, op, s0, s1) for e in self.edges for (op, s0, s1) in e.openings]

    def door_swings(self):
        """The space each door needs kept clear, as `(id, kind, geometry)`.

        TWO honest modelling calls, both measured into existence:
        1. ⚠ **A SLIDING door does not swing.** `d-balcony-south` is 237 cm wide; treating that as a
           237 cm-deep arc sterilised the whole south half of the living room and cost it its coffee
           table. A slider (and a very wide glazed door) needs a THRESHOLD STRIP you can walk
           through, not an arc.
        2. ⚠ **A hinged leaf sweeps a QUARTER DISC around ONE jamb, not a full rectangle.** The plan
           does not record which jamb (SCHEMA has no hinge field), so the hinge is CHOSEN, the way a
           designer chooses it: the jamb nearer the end of its own wall, i.e. the door opens back
           against the short return -- the ordinary convention. Stated because it is a decision, not
           a measurement: a rectangle instead cost `r-ensuite` its shower over a 9 cm corner overlap
           that a real door leaf never reaches."""
        out = []
        for e, op, s0, s1 in self.doors():
            width = s1 - s0
            kind = op["kind"]
            if kind == "sliding_door" or (kind == "glazed_door" and width > 110.0):
                depth = SLIDING_CLEAR_CM if kind == "sliding_door" else DOOR_SWING_MIN_CM
                cx, cy = e.point_at((s0 + s1) / 2.0)
                cx += e.normal[0] * depth / 2.0
                cy += e.normal[1] * depth / 2.0
                out.append((op["id"], "strip", OBB(cx, cy, e.bearing_in, width, depth, 0.0, 220.0)))
            else:
                # the arc radius is the LEAF's own width -- not inflated to a passage width. Passage
                # is R-WALK's job; inflating a 78 cm leaf to 90 cm cost r-ensuite its shower by 9 cm.
                r = min(width, DOOR_SWING_MAX_CM)
                hinge_s = s0 if s0 <= (e.length - s1) else s1     # the jamb nearer its wall's end
                hx, hy = e.point_at(hinge_s)
                out.append((op["id"], "arc", (hx, hy, r)))
        return out

    def blocking_segments(self):
        """The loop edges MINUS the spans covered by any opening -- what a walkway must flow around.
        A doorway is not a blocker: you walk through it, which is the whole point of the rule."""
        segs = []
        for e in self.edges:
            cursor = 0.0
            for b0, b1 in sorted((s0, s1) for _op, s0, s1 in e.openings):
                if b0 - cursor > 1e-6:
                    segs.append((e.point_at(cursor), e.point_at(b0)))
                cursor = max(cursor, b1)
            if e.length - cursor > 1e-6:
                segs.append((e.point_at(cursor), e.point_at(e.length)))
        return segs

    def windows_on_edge(self, edge):
        return [(op, s0, s1) for (op, s0, s1) in edge.openings if op["kind"] == "window"]


def _inward_sign(loop):
    a = 0.0
    n = len(loop)
    for i in range(n):
        x0, y0 = loop[i]
        x1, y1 = loop[(i + 1) % n]
        a += x0 * y1 - x1 * y0
    return 1.0 if a > 0 else -1.0


# ================================================================================ the placer
class Piece:
    __slots__ = ("slot", "cls", "model", "obb", "yaw", "layer", "anchor", "size", "rule", "support",
                 "z_cm", "scale", "front_local")

    def __init__(self, slot, cls, model, obb, yaw, layer, anchor, size, rule,
                 support=None, z_cm=None, scale=1.0, front_local="-Y"):
        self.slot, self.cls, self.model = slot, cls, model
        self.obb, self.yaw, self.layer, self.anchor = obb, yaw, layer, anchor
        self.size, self.rule, self.support = size, rule, support
        self.z_cm, self.scale, self.front_local = z_cm, scale, front_local

    def to_dict(self):
        return {
            "slot": self.slot, "class": self.cls, "model": self.model,
            "x_cm": round(self.obb.x, 2), "y_cm": round(self.obb.y, 2),
            "z_cm": None if self.z_cm is None else round(self.z_cm, 2),
            "yaw_deg": round(self.yaw % 360.0, 2),
            "anchor": self.anchor, "layer": self.layer, "scale": self.scale,
            "front_local": self.front_local,
            "size_cm": [round(v, 2) for v in self.size],
            "aabb_z_cm": [round(self.obb.z0, 2), round(self.obb.z1, 2)],
            "support": self.support, "rule": self.rule,
        }


class Placer:
    """Accepts pieces one at a time, refusing any that breaks a rule against what is already there."""

    def __init__(self, geo: RoomGeo, log):
        self.geo = geo
        self.pieces: list[Piece] = []
        self.log = log
        self.swings = geo.door_swings()
        self.segs = geo.blocking_segments()
        self._grid = None

    # -- the individual rules -------------------------------------------------------------
    def r_inside(self, obb: OBB):
        """Sampled outline containment -- correct for a non-convex room, where "all four corners are
        inside" is not sufficient (a rectangle can straddle a notch with every corner inside).

        ⚠ The outline is sampled on a rectangle shrunk by `INSIDE_EPS_CM`: a piece pushed flush into
        a room corner has sample points EXACTLY on the polygon edge, where an even-odd test is a
        coin flip (measured: the kitchen's first base module, whose side sat on the room corner, was
        rejected as 'outside' while its five identical siblings passed)."""
        shrunk = OBB(obb.x, obb.y, bearing_of(*obb.v),
                     max(obb.hw * 2 - 2 * INSIDE_EPS_CM, 1.0),
                     max(obb.hd * 2 - 2 * INSIDE_EPS_CM, 1.0), obb.z0, obb.z1)
        cs = shrunk.corners()
        for i in range(4):
            ax, ay = cs[i]
            bx, by = cs[(i + 1) % 4]
            n = max(2, int(math.hypot(bx - ax, by - ay) / 10.0) + 1)
            for k in range(n + 1):
                t = k / n
                if not pc.point_in_polygon((ax + (bx - ax) * t, ay + (by - ay) * t), self.geo.loop):
                    return False, "outside the room polygon"
        for vx, vy in self.geo.loop:                      # a room corner poking INTO the piece
            if obb.contains2d(vx, vy, pad=-0.5):
                return False, "a room corner falls inside the footprint"
        return True, None

    def r_overlap(self, obb: OBB, layer: str):
        if layer in ("wall", "on_top"):
            return True, None
        for p in self.pieces:
            if layer == "rug" and p.layer != "rug":
                continue
            if p.layer in ("rug", "wall", "on_top") and layer != p.layer:
                continue
            if layer == "ceiling" and p.layer != "ceiling":
                continue
            if p.layer == "ceiling" and layer != "ceiling":
                continue
            if obb.overlaps(p.obb, pad=-0.5):
                return False, f"overlaps {p.slot}"
        return True, None

    def r_door(self, obb: OBB, layer: str):
        if layer in ("rug", "wall"):
            return True, None                              # a doormat under a door is fine
        if obb.z1 <= 6.0:
            return True, None                              # anything flatter than a threshold
        for oid, kind, geom in self.swings:
            if kind == "strip":
                if obb.overlaps(geom, pad=-0.5):
                    return False, f"blocks the threshold of {oid}"
            else:
                hx, hy, r = geom
                if obb.dist2d(hx, hy) < r - 0.5:
                    return False, (f"blocks the swing of {oid} "
                                   f"({obb.dist2d(hx, hy):.0f} cm from its hinge, leaf {r:.0f} cm)")
        return True, None

    def r_camera(self, obb: OBB, layer: str = "floor"):
        """TWO bars, because one was not enough.

        The 3-D bar (`CAMERA_BUBBLE_CM`) mirrors `build_scene.py::verify`'s mesh clearance, so a
        piece that passes here passes there. ⭐ But it is satisfied by anything LOW: a 39 cm coffee
        table directly under a 140 cm camera is 101 cm away in 3-D and the first draft render duly
        put the living-room viewpoint standing ON the coffee table, legs filling the nadir. A camera
        point is a person standing on the floor, so floor-standing pieces also owe a PLAN-space
        clearance -- rugs excepted, because standing on a rug is the point of a rug."""
        for cp in self.geo.cameras:
            d = obb.dist3d(float(cp["x"]), float(cp["y"]), float(cp["z"]))
            if d < CAMERA_BUBBLE_CM:
                return False, f"{d:.1f} cm from camera {cp['id']} in 3-D (bar {CAMERA_BUBBLE_CM:.0f})"
            if layer == "floor":
                d2 = obb.dist2d(float(cp["x"]), float(cp["y"]))
                if d2 < CAMERA_STAND_CM:
                    return False, (f"{d2:.1f} cm from camera {cp['id']} in PLAN -- the viewpoint "
                                   f"would stand on it (bar {CAMERA_STAND_CM:.0f})")
        return True, None

    def r_window(self, obb: OBB):
        """A piece taller than a window's sill may not stand in that window's floor band."""
        for e in self.geo.edges:
            for op, s0, s1 in self.geo.windows_on_edge(e):
                sill = float(op["sill_cm"])
                if obb.z1 <= sill + 1.0:
                    continue
                cx, cy = e.point_at((s0 + s1) / 2.0)
                band = OBB(cx + e.normal[0] * 30.0, cy + e.normal[1] * 30.0, e.bearing_in,
                           s1 - s0, 60.0, sill, 300.0)
                if obb.overlaps(band, pad=-0.5):
                    return False, f"stands in front of window {op['id']} (sill {sill:.0f} cm)"
        return True, None

    def r_support(self, obb: OBB, support_slot):
        for p in self.pieces:
            if p.slot == support_slot:
                for cx, cy in obb.corners():
                    if not p.obb.contains2d(cx, cy, pad=1.0):
                        return False, f"not fully on its support {support_slot}"
                return True, None
        return False, f"support {support_slot} was never placed"

    # -- the walkway rule -----------------------------------------------------------------
    def _grid_init(self):
        """Per-cell clearance to the room's BLOCKING edges (openings excluded, so a doorway is
        walkable). Computed once per room, then decremented in place as pieces are accepted."""
        x0, y0, x1, y1 = self.geo.bbox
        nx = max(1, int((x1 - x0) / GRID_CM) + 1)
        ny = max(1, int((y1 - y0) / GRID_CM) + 1)
        clear = [[-1.0] * ny for _ in range(nx)]
        for i in range(nx):
            px = x0 + i * GRID_CM
            for j in range(ny):
                py = y0 + j * GRID_CM
                if not pc.point_in_polygon((px, py), self.geo.loop):
                    continue
                d = min((seg_point_dist(px, py, a[0], a[1], b[0], b[1]) for a, b in self.segs),
                        default=1e9)
                clear[i][j] = d
        self._grid = {"x0": x0, "y0": y0, "nx": nx, "ny": ny, "clear": clear}

    def _grid_apply(self, obb: OBB, grid=None):
        g = grid if grid is not None else self._grid
        clear = g["clear"]
        for i in range(g["nx"]):
            px = g["x0"] + i * GRID_CM
            for j in range(g["ny"]):
                if clear[i][j] < 0:
                    continue
                py = g["y0"] + j * GRID_CM
                d = obb.dist2d(px, py)
                if d < clear[i][j]:
                    clear[i][j] = d

    def _grid_copy(self):
        g = self._grid
        return {"x0": g["x0"], "y0": g["y0"], "nx": g["nx"], "ny": g["ny"],
                "clear": [col[:] for col in g["clear"]]}

    def _walkable(self, grid) -> tuple[bool, str | None]:
        """Label the connected components of the free space (cells whose clearance >= WALKWAY_CM/2)
        and require, PER ROOM:
          (a) every camera point is reachable from at least one of the room's own openings, and
          (b) no opening is sealed into a dead pocket -- its component holds either a camera point or
              another opening.

        ⚠ Why not the stronger "every opening reaches every camera"? Because it is FALSE OF THE PLAN
        ITSELF, furniture or no furniture -- measured, not assumed. `r-dining` carries the entry
        alcove north of the corridor partition, whose only real connection to the dining area is
        WEST, through `o-corridor-north` into `r-corridor` and back in through `o-corridor-south`;
        inside r-dining's own polygon the two halves meet through a 2.4 cm neck (the offset between
        the partition's east face at x=486.7 and the WC wall's west face at x=489.1). A per-room
        rule that demanded the strong property reported a violation on the EMPTY apartment -- i.e. it
        was measuring the tracer's room split, not the furniture. The pair above keeps the property
        that matters (furniture may not seal a door or strand a viewpoint) and is true of the empty
        plan, which is the honest bar for a per-room check."""
        # ⛔ A room with no camera point is not walked: balconies are look-only by product rule
        # (REPORT §2.1, enforced by validate-plan.mjs V11), and a one-door balcony is a dead end BY
        # DESIGN -- asserting otherwise made the checker fail on the EMPTY plan and, worse, silently
        # refused to place the balcony furniture that is visible through the living-room glazing.
        if not self.geo.cameras:
            return True, None
        r = WALKWAY_CM / 2.0
        g, clear = grid, grid["clear"]

        def cell(px, py):
            return (int(round((px - g["x0"]) / GRID_CM)), int(round((py - g["y0"]) / GRID_CM)))

        def passable(i, j):
            return 0 <= i < g["nx"] and 0 <= j < g["ny"] and clear[i][j] >= r

        def nearest_passable(px, py, radius_cm=100.0):
            ci, cj = cell(px, py)
            best, bd = None, 1e9
            k = int(radius_cm / GRID_CM)
            for di in range(-k, k + 1):
                for dj in range(-k, k + 1):
                    i, j = ci + di, cj + dj
                    if not passable(i, j):
                        continue
                    d = math.hypot(di, dj)
                    if d < bd:
                        best, bd = (i, j), d
            return best

        # one labelling pass over the whole grid
        label = {}
        nlab = 0
        for i0 in range(g["nx"]):
            for j0 in range(g["ny"]):
                if not passable(i0, j0) or (i0, j0) in label:
                    continue
                nlab += 1
                stack = [(i0, j0)]
                label[(i0, j0)] = nlab
                while stack:
                    i, j = stack.pop()
                    for ni, nj in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                        if (ni, nj) in label or not passable(ni, nj):
                            continue
                        label[(ni, nj)] = nlab
                        stack.append((ni, nj))

        cam_lab = {}
        for cp in self.geo.cameras:
            t = nearest_passable(float(cp["x"]), float(cp["y"]))
            if t is None:
                return False, f"no {WALKWAY_CM:.0f} cm-wide space anywhere near camera {cp['id']}"
            cam_lab[cp["id"]] = label[t]
        # ⭐ An opening is sampled at FIVE points along its span, not just its midpoint. An open-plan
        # boundary can be 4 m wide (`o-living-west` is 428.9 cm): a sofa floated against its middle
        # leaves the boundary perfectly walkable at both ends, and a midpoint-only test called that
        # "sealed" and refused the only sofa position the room actually wants.
        open_lab = {}
        for e, op, s0, s1 in self.geo.all_openings_on_edges():
            labs = set()
            for frac in (0.1, 0.3, 0.5, 0.7, 0.9):
                mx, my = e.point_at(s0 + (s1 - s0) * frac)
                t = nearest_passable(mx + e.normal[0] * (r + GRID_CM),
                                     my + e.normal[1] * (r + GRID_CM), radius_cm=80.0)
                if t is not None:
                    labs.add(label[t])
            if not labs:
                return False, f"opening {op['id']} has no {WALKWAY_CM:.0f} cm-wide space inside it"
            open_lab[op["id"]] = labs

        reach = set().union(*open_lab.values()) if open_lab else set()
        for cid, lab in cam_lab.items():
            if lab not in reach:
                return False, (f"camera {cid} is not reachable from any of this room's openings "
                               f"with a {WALKWAY_CM:.0f} cm-wide path")
        cam_labs = set(cam_lab.values())
        for oid, labs in open_lab.items():
            others = [o for o, ls in open_lab.items() if o != oid and ls & labs]
            if not (labs & cam_labs) and not others:
                return False, (f"opening {oid} is sealed into a dead pocket (no camera and no other "
                               f"opening within a {WALKWAY_CM:.0f} cm-wide path)")
        return True, None

    # -- the accept gate ------------------------------------------------------------------
    def try_place(self, slot, cls, model, x, y, yaw, w, d, z0, z1, layer="floor", anchor="floor",
                  rule="", support=None, z_cm=None, scale=1.0, front_local="-Y", check_walk=True):
        obb = OBB(x, y, yaw, w, d, z0, z1)
        for ok, why in (self.r_inside(obb) if layer != "ceiling" else (True, None),):
            if not ok:
                return None, why
        for check in (lambda: self.r_overlap(obb, layer), lambda: self.r_door(obb, layer),
                      lambda: self.r_camera(obb, layer), lambda: self.r_window(obb)):
            ok, why = check()
            if not ok:
                return None, why
        if support is not None:
            ok, why = self.r_support(obb, support)
            if not ok:
                return None, why
        if check_walk and layer == "floor":
            if self._grid is None:
                self._grid_init()
            trial = self._grid_copy()
            self._grid_apply(obb, trial)
            ok, why = self._walkable(trial)
            if not ok:
                return None, why
            self._grid = trial
        piece = Piece(slot, cls, model, obb, yaw, layer, anchor, (w, d, z1 - z0), rule,
                      support=support, z_cm=z_cm, scale=scale, front_local=front_local)
        self.pieces.append(piece)
        return piece, None


# ============================================================================== the style lock
class Style:
    """A thin, validating reader over `catalog/style-habait-modern.json`."""

    def __init__(self, data):
        self.data = data
        self.name = data["style_name"]
        self.version = data["version"]
        self.classes = data["classes"]
        self.models = data["models"]

    def options(self, cls):
        c = self.classes.get(cls)
        return [] if not c else [m for m in c["models"] if m in self.models]

    def model(self, mid):
        return self.models[mid]

    def ordered(self, cls, *key):
        """The class's models as a RANKED list: the seeded pick first, then the rest in file order.

        ⭐ A class is a list of alternatives, so a slot should fall through it rather than fail on
        its first choice. Measured: the master bedroom's 142 cm wardrobe has no wall long enough
        (every run is broken by a window with a 90 cm sill, the en-suite door or the lobby opening),
        and the room shipped with bare walls -- while a 71 cm bookcase from the same class list
        would have fitted. Same for rugs: the 279 cm rectangle does not fit at the foot of that bed;
        the 164 cm round one does."""
        opts = self.options(cls)
        if not opts:
            return []
        h = int(hashlib.sha256("|".join(str(k) for k in key).encode("utf-8")).hexdigest()[:16], 16)
        i = h % len(opts)
        return opts[i:] + opts[:i]

    def pick(self, cls, *key):
        """Deterministic choice among a class's models: a sha256 of the key, never Python's own
        `hash()` (which is salted per process and would make a build unreproducible)."""
        opts = self.options(cls)
        if not opts:
            return None
        h = int(hashlib.sha256("|".join(str(k) for k in key).encode("utf-8")).hexdigest()[:16], 16)
        return opts[h % len(opts)]

    def geom(self, mid):
        m = self.models[mid]
        w, d = m["footprint_cm"]
        return float(w), float(d), float(m["height_cm"])


# ============================================================================ slot primitives
def _runs_for(geo: RoomGeo, want_width, allow_virtual=False, min_len=None, piece_h=None):
    """Every wall run that can host a piece `want_width` wide, ranked longest-first (ties by edge
    index, so the order is total and stable).

    ⭐ A VIRTUAL edge is offered WHOLE when `allow_virtual`: an open-plan boundary is 100 % 'opening',
    so subtracting its openings leaves nothing and the run list came back empty -- which is why the
    pilot's living-room sofa could not find the wall it obviously wants (its back to the dining-room
    boundary, facing the long east wall). There is no wall there to hang anything on, so only pieces
    that pass `allow_virtual` may use it."""
    out = []
    for e in geo.edges:
        if e.is_virtual:
            if not allow_virtual:
                continue
            runs = [(0.0, e.length, e.length)]
        else:
            runs = e.clear_runs(piece_h=piece_h)
        for s0, s1, ln in runs:
            need = (min_len if min_len is not None else want_width + MIN_RUN_SLACK_CM)
            if ln + 1e-9 >= need:
                out.append((e, s0, s1, ln))
    out.sort(key=lambda r: (-r[3], r[0].index, r[1]))
    return out


def _wall_pos(edge: Edge, s_centre, depth, gap=WALL_GAP_CM):
    px, py = edge.point_at(s_centre)
    return (px + edge.normal[0] * (gap + depth / 2.0),
            py + edge.normal[1] * (gap + depth / 2.0))


def _alignments(s0, s1, width, seed_key, style: Style, pref="centre"):
    """Candidate centre positions along a run: centred first, then biased to each end (or the other
    way round for `pref="ends"`, which is what a WC fixture wants -- a toilet belongs in the corner,
    not in the middle of a wall). The seed only permutes the two END options, so seed 0 and seed 7
    never disagree about which strategy comes first."""
    mid = (s0 + s1) / 2.0
    lo = s0 + width / 2.0 + 1.0
    hi = s1 - width / 2.0 - 1.0
    if hi < lo:
        return [mid]
    ends = [lo, hi]
    h = int(hashlib.sha256(str(seed_key).encode()).hexdigest()[:8], 16)
    if h % 2:
        ends.reverse()
    centred = min(max(mid, lo), hi)
    out = (ends + [centred]) if pref == "ends" else ([centred] + ends)
    # ⭐ then a plain sweep along the rest of the run. Three preferred positions are not enough in a
    # crowded room: the pilot's main bathroom has exactly one 85 cm gap left between the balcony
    # door's threshold strip and the bath, and "centre / either end" all miss it, so the room lost
    # its toilet to a candidate list, not to geometry.
    s = lo
    while s <= hi + 1e-9:
        if all(abs(s - o) > 1.0 for o in out):
            out.append(s)
        s += SWEEP_STEP_CM
    return out


def place_against_wall(placer: Placer, style: Style, slot, cls, *, allow_virtual=False,
                       seed=0, prefer_edges=None, gap=WALL_GAP_CM, model=None, note="",
                       align_pref="centre", runs_ranked=None):
    """The workhorse: put one piece of class `cls` with its back to a wall, facing into the room."""
    geo = placer.geo
    if model is None:
        cands = style.ordered(cls, seed, geo.id, slot)
        if len(cands) > 1:
            for m in cands:                       # fall through the class's alternatives
                piece, why = place_against_wall(placer, style, slot, cls, allow_virtual=allow_virtual,
                                                seed=seed, prefer_edges=prefer_edges, gap=gap,
                                                model=m, note=note, align_pref=align_pref,
                                                runs_ranked=runs_ranked)
                if piece:
                    return piece, None
            return None, why
    mid = model or style.pick(cls, seed, geo.id, slot)
    if mid is None:
        return None, f"no model for class '{cls}'"
    w, d, h = style.geom(mid)
    front = style.model(mid).get("front_local", "-Y")
    scale = style.model(mid).get("scale", 1.0)
    _rs = _runs_for(geo, w, allow_virtual=allow_virtual, piece_h=h)
    runs = runs_ranked(_rs) if runs_ranked else _rs
    if prefer_edges is not None:
        pref = {e.index for e in prefer_edges}
        runs.sort(key=lambda r: (0 if r[0].index in pref else 1, -r[3], r[0].index, r[1]))
    why_last = "no wall run long enough"
    for e, s0, s1, _ln in runs:
        for s in _alignments(s0, s1, w, (seed, geo.id, slot, e.index), style, pref=align_pref):
            x, y = _wall_pos(e, s, d, gap)
            piece, why = placer.try_place(slot, cls, mid, x, y, e.bearing_in, w, d, 0.0, h,
                                          rule=f"{note or 'against a wall'}; run {e.index} "
                                               f"[{s0:.0f},{s1:.0f}] cm, facing {e.bearing_in:.0f} deg",
                                          scale=scale, front_local=front)
            if piece:
                return piece, None
            why_last = why
    return None, why_last


def _scan_offsets(step=25.0, max_r=350.0, cap=160):
    """A deterministic lattice scan around an anchor: ring by ring outward, each ring ordered by
    exact radius then bearing, capped. Used where a fixed ladder is not enough -- a big piece in a
    non-convex room (the 14-vertex `r-dining`) needs to be able to walk away from its anchor."""
    pts = []
    k_max = int(max_r / step)
    for k in range(1, k_max + 1):
        ring = [(i * step, j * step) for i in range(-k, k + 1) for j in range(-k, k + 1)
                if max(abs(i), abs(j)) == k]
        ring.sort(key=lambda p: (round(math.hypot(*p), 6), round(math.atan2(p[1], p[0]), 6)))
        pts.extend(ring)
    return pts[:cap]


def place_free(placer: Placer, style: Style, slot, cls, x, y, yaw, *, seed=0, layer="floor",
               anchor="floor", z_cm=None, model=None, note="", support=None, offsets=None,
               scan=False):
    """Place a piece at a free position, trying a small deterministic ladder of offsets (and, with
    `scan=True`, a wider lattice search around the anchor)."""
    geo = placer.geo
    mid = model or style.pick(cls, seed, geo.id, slot)
    if mid is None:
        return None, f"no model for class '{cls}'"
    w, d, h = style.geom(mid)
    front = style.model(mid).get("front_local", "-Y")
    scale = style.model(mid).get("scale", 1.0)
    if anchor == "ceiling":
        z1 = geo.ceiling_cm
        z0 = geo.ceiling_cm - h
    else:
        z0, z1 = (z_cm or 0.0), (z_cm or 0.0) + h
    why_last = "no legal position"
    why_first = None
    cands = list(offsets or [(0.0, 0.0)])
    if scan:
        cands += [p for p in _scan_offsets() if p not in cands]
    for dx, dy in cands:
        piece, why = placer.try_place(slot, cls, mid, x + dx, y + dy, yaw, w, d, z0, z1,
                                      layer=layer, anchor=anchor, support=support, z_cm=z_cm,
                                      rule=f"{note or 'free placement'}"
                                           f"{'' if (dx or dy) else ''}"
                                           f"{f'; offset ({dx:+.0f},{dy:+.0f}) cm' if (dx or dy) else ''}",
                                      scale=scale, front_local=front,
                                      check_walk=(layer == "floor"))
        if piece:
            return piece, None
        why_last = why
        why_first = why_first or why
    return None, f"{why_first} (first of {len(cands)} candidate positions; last: {why_last})"


def _in_front_of(piece: Piece, distance_cm, size_d):
    """A point `distance_cm` clear of `piece`'s front face, on its facing axis."""
    vx, vy = piece.obb.v
    off = piece.obb.hd + distance_cm + size_d / 2.0
    return piece.obb.x + vx * off, piece.obb.y + vy * off


def _ceiling_light(placer: Placer, style: Style, seed, over: Piece | None, cls="pendant",
                   pendant=True):
    """A ceiling luminaire: over a named piece if there is one, else at the room's deepest point, with
    a deterministic offset ladder so it never ends up inside the camera's own bubble (T07's clipped-
    ceiling defect is fixed in build_scene by making the emitter face DOWN; keeping the FIXTURE off
    the camera's zenith is this file's half of the same fix)."""
    geo = placer.geo
    if over is not None:
        x, y = over.obb.x, over.obb.y
    else:
        x, y = geo.deep_x, geo.deep_y
    ladder = [(0.0, 0.0), (0.0, -60.0), (0.0, 60.0), (-60.0, 0.0), (60.0, 0.0),
              (-60.0, -60.0), (60.0, 60.0), (0.0, -110.0), (0.0, 110.0)]
    # ⛔ a PENDANT is a living/bedroom/dining fitting. A bathroom, a WC, a corridor, a kitchen and a
    # safe room get a flush luminaire -- the first pass hung a 95 cm glass pendant in the 2.1 m2 WC
    # and in the MAMAD, which is not a style choice, it is an unmade decision.
    if pendant and style.options(cls):
        piece, why = place_free(placer, style, "ceiling_light", cls, x, y, 0.0, seed=seed,
                                layer="ceiling", anchor="ceiling",
                                note="ceiling luminaire", offsets=ladder)
        if piece:
            return piece, None
        return None, why
    # no model for this class in this style -> a bare luminaire: build_scene makes the light + a disc
    for dx, dy in ladder:
        piece, why = placer.try_place("ceiling_light", "ceiling_light", None, x + dx, y + dy, 0.0,
                                      30.0, 30.0, geo.ceiling_cm - 6.0, geo.ceiling_cm,
                                      layer="ceiling", anchor="ceiling",
                                      rule="flush ceiling luminaire (no pendant model in this style "
                                           "for this room type)", check_walk=False)
        if piece:
            return piece, None
    return None, "no legal ceiling position"


# ================================================================================= templates
def t_living(placer: Placer, style: Style, seed):
    """LIVING: the sofa faces the longest clear wall (the TV wall); everything else hangs off that."""
    geo = placer.geo
    log = placer.log
    # 1. the TV wall = the longest SOLID clear run that can host a media unit
    tv_mid = style.pick("tv_unit", seed, geo.id, "tv_unit")
    tv_w = style.geom(tv_mid)[0] if tv_mid else 120.0
    tv_h = style.geom(tv_mid)[2] if tv_mid else 60.0
    tv_runs = _runs_for(geo, tv_w, piece_h=tv_h)
    sofa_mid = style.pick("sofa", seed, geo.id, "sofa")
    sofa_w, sofa_d, sofa_h = style.geom(sofa_mid)
    # ⭐ a sofa MAY float with its back to an open boundary; nothing else may
    sofa_runs = _runs_for(geo, sofa_w, allow_virtual=True, piece_h=sofa_h)

    # 2. pick the best opposed (sofa wall, tv wall) pair: facing each other, far enough apart
    best = None
    for se, ss0, ss1, sl in sofa_runs:
        for te, ts0, ts1, tl in tv_runs:
            if se.index == te.index:
                continue
            dot = se.normal[0] * te.normal[0] + se.normal[1] * te.normal[1]
            if dot > -0.7:                     # not facing each other
                continue
            sx, sy = _wall_pos(se, (ss0 + ss1) / 2.0, sofa_d)
            tx, ty = _wall_pos(te, (ts0 + ts1) / 2.0, 40.0)
            gap = math.hypot(tx - sx, ty - sy)
            if gap < FACING_MIN_GAP_CM:
                continue
            score = (min(sl, tl), gap)
            if best is None or score > best[0]:
                best = (score, (se, ss0, ss1), (te, ts0, ts1))
    sofa = None
    if best:
        (se, ss0, ss1), (te, ts0, ts1) = best[1], best[2]
        for s in _alignments(ss0, ss1, sofa_w, (seed, geo.id, "sofa", se.index), style):
            x, y = _wall_pos(se, s, sofa_d)
            sofa, why = placer.try_place("sofa", "sofa", sofa_mid, x, y, se.bearing_in,
                                         sofa_w, sofa_d, 0.0, sofa_h,
                                         rule=f"back to wall {se.index}"
                                              f"{' (an open boundary)' if se.is_virtual else ''}, "
                                              f"facing the longest clear wall {te.index}",
                                         scale=style.model(sofa_mid).get("scale", 1.0),
                                         front_local=style.model(sofa_mid).get("front_local", "-Y"))
            if sofa:
                break
            log(f"    - sofa candidate on run {se.index}: {why}")
        if sofa and tv_mid:
            for s in _alignments(ts0, ts1, tv_w, (seed, geo.id, "tv_unit", te.index), style):
                x, y = _wall_pos(te, s, style.geom(tv_mid)[1])
                tv, why = placer.try_place("tv_unit", "tv_unit", tv_mid, x, y, te.bearing_in,
                                           *style.geom(tv_mid)[:2], 0.0, style.geom(tv_mid)[2],
                                           rule=f"the wall the sofa faces (run {te.index})",
                                           scale=style.model(tv_mid).get("scale", 1.0),
                                           front_local=style.model(tv_mid).get("front_local", "-Y"))
                if tv:
                    if style.options("tv"):
                        tv_set = style.pick("tv", seed, geo.id, "tv")
                        tw, td, th = style.geom(tv_set)
                        placer.try_place("tv", "tv", tv_set, tv.obb.x, tv.obb.y, te.bearing_in,
                                         tw, td, tv.size[2], tv.size[2] + th, layer="on_top",
                                         anchor="floor", support="tv_unit", z_cm=tv.size[2],
                                         rule="on the media unit",
                                         scale=style.model(tv_set).get("scale", 1.0),
                                         front_local=style.model(tv_set).get("front_local", "-Y"),
                                         check_walk=False)
                    break
                log(f"    - tv_unit candidate on run {te.index}: {why}")
    if sofa is None:
        sofa, why = place_against_wall(placer, style, "sofa", "sofa", allow_virtual=True, seed=seed,
                                       note="fallback: longest run, no opposed wall found")
        if sofa is None:
            log(f"    - sofa SKIPPED: {why}")

    # 3. coffee table in front of the sofa, then a rug under the pair
    coffee = None
    if sofa:
        ct = style.pick("coffee_table", seed, geo.id, "coffee_table")
        if ct:
            cw, cd, ch = style.geom(ct)
            ux, uy = sofa.obb.u
            for gap in (60.0, 45.0, 75.0):
                for lat in (0.0, 45.0, -45.0, 90.0, -90.0):
                    x, y = _in_front_of(sofa, gap, cd)
                    x, y = x + ux * lat, y + uy * lat
                    coffee, why = placer.try_place("coffee_table", "coffee_table", ct, x, y,
                                                   (sofa.yaw + 180.0) % 360.0, cw, cd, 0.0, ch,
                                                   rule=f"{gap:.0f} cm in front of the sofa"
                                                        + (f", {lat:+.0f} cm along it" if lat else ""),
                                                   scale=style.model(ct).get("scale", 1.0),
                                                   front_local=style.model(ct).get("front_local", "-Y"))
                    if coffee:
                        break
                if coffee:
                    break
            if coffee is None:
                log(f"    - coffee_table SKIPPED: {why}")
    for rug in style.ordered("rug", seed, geo.id, "rug") if sofa else []:
        rw, rd, rh = style.geom(rug)
        cx, cy = _in_front_of(sofa, 30.0, rd)
        piece, _why = place_free(placer, style, "rug", "rug", cx, cy, sofa.yaw, seed=seed,
                                 layer="rug", model=rug,
                                 note="under the coffee table, in front of the sofa",
                                 offsets=[(0, 0), (0, -20), (0, 20)])
        if piece:
            break

    # 4. an armchair at 90 deg to the sofa, on whichever side has room
    if sofa and style.options("armchair"):
        ac = style.pick("armchair", seed, geo.id, "armchair")
        aw, ad, ah = style.geom(ac)
        ux, uy = sofa.obb.u
        placed = False
        for side in (1, -1):
            for along in (0.0, 40.0):
                bx = sofa.obb.x + ux * side * (sofa.obb.hw + 30.0 + aw / 2.0)
                by = sofa.obb.y + uy * side * (sofa.obb.hw + 30.0 + aw / 2.0)
                fx, fy = _in_front_of(sofa, 40.0 + along, 0.0)
                cx, cy = (bx + fx) / 2.0, (by + fy) / 2.0
                yaw = bearing_of(-ux * side, -uy * side)
                piece, why = placer.try_place("armchair", "armchair", ac, cx, cy, yaw, aw, ad, 0.0, ah,
                                              rule="turned 90 deg to the sofa, facing the seating group",
                                              scale=style.model(ac).get("scale", 1.0),
                                              front_local=style.model(ac).get("front_local", "-Y"))
                if piece:
                    placed = True
                    break
            if placed:
                break
        if not placed:
            log("    - armchair SKIPPED: no legal position beside the sofa")

    # 5. corner decor + a floor lamp + a bookcase on a remaining run
    _corner_plant(placer, style, seed)
    place_against_wall(placer, style, "floor_lamp", "floor_lamp", seed=seed, note="beside the seating")
    place_against_wall(placer, style, "bookcase", "bookcase", seed=seed, note="a remaining clear wall")
    _wall_art(placer, style, seed, over=sofa)
    _ceiling_light(placer, style, seed, over=coffee)


def t_bedroom(placer: Placer, style: Style, seed, kids=False):
    """BEDROOM: the bed's headboard goes on the wall OPPOSITE the door wall (the task's own rule)."""
    geo = placer.geo
    log = placer.log
    bed_cls = "bunk_bed" if kids else ("bed_double" if geo.area_m2 >= 9.5 else "bed_single")
    bed_mid = style.pick(bed_cls, seed, geo.id, "bed")
    if bed_mid is None:
        bed_cls = "bed_single"
        bed_mid = style.pick(bed_cls, seed, geo.id, "bed")
    bed = None
    if bed_mid:
        bw, bd, bh = style.geom(bed_mid)
        doors = geo.doors()
        door_normals = [e.normal for e, _op, _s0, _s1 in doors]
        runs = _runs_for(geo, bw, piece_h=bh)
        # rank: most opposed to the door wall first, then longest
        def rank(r):
            e = r[0]
            opp = min((e.normal[0] * n[0] + e.normal[1] * n[1]) for n in door_normals) if door_normals else 0.0
            return (opp, -r[3], e.index)
        runs.sort(key=rank)
        for e, s0, s1, _ln in runs:
            for s in _alignments(s0, s1, bw, (seed, geo.id, "bed", e.index), style):
                x, y = _wall_pos(e, s, bd)
                bed, why = placer.try_place("bed", bed_cls, bed_mid, x, y, e.bearing_in, bw, bd, 0.0, bh,
                                            rule=f"headboard on wall {e.index}, the run most opposed "
                                                 f"to the door wall",
                                            scale=style.model(bed_mid).get("scale", 1.0),
                                            front_local=style.model(bed_mid).get("front_local", "-Y"))
                if bed:
                    break
            if bed:
                break
        if bed is None:
            log(f"    - bed SKIPPED: {why if runs else 'no wall run long enough'}")

    # nightstands flanking the bed
    if bed and style.options("nightstand"):
        ns = style.pick("nightstand", seed, geo.id, "nightstand")
        nw, nd, nh = style.geom(ns)
        ux, uy = bed.obb.u
        n_ok = 0
        for side in (1, -1):
            cx = bed.obb.x + ux * side * (bed.obb.hw + 4.0 + nw / 2.0) - bed.obb.v[0] * (bed.obb.hd - nd / 2.0)
            cy = bed.obb.y + uy * side * (bed.obb.hw + 4.0 + nw / 2.0) - bed.obb.v[1] * (bed.obb.hd - nd / 2.0)
            piece, _why = placer.try_place(f"nightstand_{'l' if side > 0 else 'r'}", "nightstand", ns,
                                           cx, cy, bed.yaw, nw, nd, 0.0, nh,
                                           rule="flanking the bed head",
                                           scale=style.model(ns).get("scale", 1.0),
                                           front_local=style.model(ns).get("front_local", "-Y"))
            if piece:
                n_ok += 1
                if style.options("table_lamp") and n_ok == 1:
                    tl = style.pick("table_lamp", seed, geo.id, "table_lamp")
                    lw, ld, lh = style.geom(tl)
                    placer.try_place("table_lamp", "table_lamp", tl, cx, cy, bed.yaw, lw, ld,
                                     nh, nh + lh, layer="on_top", support=piece.slot, z_cm=nh,
                                     rule="on the nightstand",
                                     scale=style.model(tl).get("scale", 1.0),
                                     front_local=style.model(tl).get("front_local", "-Y"),
                                     check_walk=False)
        if n_ok == 0:
            log("    - nightstands SKIPPED: no room beside the bed")

    ward, why = place_against_wall(placer, style, "wardrobe", "wardrobe", seed=seed,
                                   note="the longest remaining clear wall")
    if ward is None:
        log(f"    - wardrobe does not fit: {why}; trying a bookcase instead")
        alt, why2 = place_against_wall(placer, style, "wardrobe", "bookcase", seed=seed,
                                       note="narrower storage - no wall takes the wardrobe")
        if alt is None:
            log(f"    - bookcase SKIPPED too: {why2}")
    if kids:
        desk, _ = place_against_wall(placer, style, "desk", "desk", seed=seed, note="under/near a window wall")
        if desk and style.options("desk_chair"):
            dc = style.pick("desk_chair", seed, geo.id, "desk_chair")
            dw, dd, dh = style.geom(dc)
            x, y = _in_front_of(desk, 12.0, dd)
            placer.try_place("desk_chair", "desk_chair", dc, x, y, (desk.yaw + 180.0) % 360.0,
                             dw, dd, 0.0, dh, rule="at the desk",
                             scale=style.model(dc).get("scale", 1.0),
                             front_local=style.model(dc).get("front_local", "-Y"))
        place_against_wall(placer, style, "bookcase_low", "bookcase_low", seed=seed, note="kids storage")
    for rug in style.ordered("rug", seed, geo.id, "rug"):
        if not bed:
            break
        rw, rd, rh = style.geom(rug)
        x, y = _in_front_of(bed, 10.0, rd)
        piece, _why = place_free(placer, style, "rug", "rug", x, y, bed.yaw, seed=seed, layer="rug",
                                 model=rug, note="at the foot of the bed",
                                 offsets=[(0, 0), (0, -25), (0, 25), (0, -50), (0, 50)])
        if piece:
            break
    _corner_plant(placer, style, seed)
    _wall_art(placer, style, seed, over=bed)
    _ceiling_light(placer, style, seed, over=None)


def t_kitchen(placer: Placer, style: Style, seed):
    """KITCHEN: one tiled base run (sink under a window if there is one, stove clear of it, fridge at
    the end), uppers above the run except over the stove, where the hood goes."""
    geo = placer.geo
    log = placer.log
    base = style.pick("kitchen_cabinet", seed, geo.id, "kitchen_cabinet")
    if base is None:
        log("    - kitchen SKIPPED: the style has no kitchen_cabinet class")
        return
    mw, md, mh = style.geom(base)
    runs = _runs_for(geo, mw, piece_h=mh)
    if not runs:
        log("    - kitchen SKIPPED: no wall run long enough for one cabinet module")
        return
    e, s0, s1, ln = runs[0]
    n_mod = max(1, int((s1 - s0) // mw))
    # which module sits under a window? (the sink goes there — the reference does, and so does life)
    win_s = None
    for op, ws0, ws1 in geo.windows_on_edge(e):
        win_s = (ws0 + ws1) / 2.0
    # ⛔ the three appliance slots must be DISTINCT indices, picked in priority order. (The first
    # version derived them independently and let the fridge win index 0 from the sink on a 6-module
    # run -- the pilot kitchen came out with no sink at all, which no eye would call a kitchen.)
    taken = set()
    idx_sink = 0
    if win_s is not None:
        idx_sink = min(range(n_mod), key=lambda i: abs((s0 + (i + 0.5) * mw) - win_s))
    taken.add(idx_sink)
    idx_stove = max((i for i in range(n_mod) if i not in taken),
                    key=lambda i: (abs(i - idx_sink), -i), default=None)
    if idx_stove is not None:
        taken.add(idx_stove)
    idx_fridge = next((i for i in (n_mod - 1, 0) if i not in taken),
                      next((i for i in range(n_mod) if i not in taken), None))
    if idx_fridge is not None:
        taken.add(idx_fridge)

    placed = 0
    for i in range(n_mod):
        s = s0 + (i + 0.5) * mw
        if i == idx_fridge and style.options("fridge"):
            mid, cls, slot = style.pick("fridge", seed, geo.id, "fridge"), "fridge", "fridge"
        elif i == idx_sink and style.options("kitchen_sink"):
            mid, cls, slot = style.pick("kitchen_sink", seed, geo.id, "sink"), "kitchen_sink", "kitchen_sink"
        elif i == idx_stove and style.options("stove"):
            mid, cls, slot = style.pick("stove", seed, geo.id, "stove"), "stove", "stove"
        else:
            mid, cls, slot = base, "kitchen_cabinet", f"base_{i}"
        w, d, h = style.geom(mid)
        x, y = _wall_pos(e, s, d, gap=0.5)
        piece, why = placer.try_place(slot, cls, mid, x, y, e.bearing_in, w, d, 0.0, h,
                                      rule=f"base run module {i + 1}/{n_mod} on wall {e.index}"
                                           + (" (under the window)" if i == idx_sink and win_s is not None else ""),
                                      scale=style.model(mid).get("scale", 1.0),
                                      front_local=style.model(mid).get("front_local", "-Y"),
                                      check_walk=(i in (0, n_mod - 1)))
        if piece:
            placed += 1
            # uppers / hood above this module
            if i == idx_stove and style.options("hood"):
                hm = style.pick("hood", seed, geo.id, "hood")
                hw, hd, hh = style.geom(hm)
                placer.try_place(f"hood_{i}", "hood", hm, x, y, e.bearing_in, hw, hd, 150.0, 150.0 + hh,
                                 layer="wall", anchor="wall", z_cm=150.0, rule="over the stove",
                                 scale=style.model(hm).get("scale", 1.0),
                                 front_local=style.model(hm).get("front_local", "-Y"), check_walk=False)
            elif style.options("kitchen_upper") and not (i == idx_sink and win_s is not None) \
                    and i != idx_fridge:
                um = style.pick("kitchen_upper", seed, geo.id, f"upper_{i}")
                uw, ud, uh = style.geom(um)
                ux, uy = _wall_pos(e, s, ud, gap=0.5)
                placer.try_place(f"upper_{i}", "kitchen_upper", um, ux, uy, e.bearing_in, uw, ud,
                                 145.0, 145.0 + uh, layer="wall", anchor="wall", z_cm=145.0,
                                 rule="wall unit above the base run",
                                 scale=style.model(um).get("scale", 1.0),
                                 front_local=style.model(um).get("front_local", "-Y"), check_walk=False)
        else:
            log(f"    - kitchen module {i}: {why}")
    log(f"    · kitchen base run: {placed}/{n_mod} modules on wall {e.index} ({ln:.0f} cm)")
    _ceiling_light(placer, style, seed, over=None, pendant=False)


def t_bathroom(placer: Placer, style: Style, seed, wc=False):
    """BATHROOM / WC: toilet on the wall most opposed to the door, then a sink+mirror, then (if the
    room is big enough) a bath or a shower, then a mat. Everything is skip-able: a 2 m2 WC that fits
    only a toilet gets only a toilet, and says so."""
    geo = placer.geo
    log = placer.log
    doors = geo.doors()
    door_normals = [e.normal for e, _o, _a, _b in doors]

    def opposed_first(runs):
        def rank(r):
            e = r[0]
            opp = min((e.normal[0] * n[0] + e.normal[1] * n[1]) for n in door_normals) if door_normals else 0.0
            return (opp, -r[3], e.index)
        return sorted(runs, key=rank)

    # ⭐ ORDER MATTERS, and the order is "biggest fixture first". Placing the toilet first (the
    # obvious reading of "toilet on the wall opposite the door") centred it on the long wall and left
    # no 170 cm run for the bath anywhere -- measured on r-bath-main, which lost its bathtub, and on
    # r-ensuite, which lost its shower. A greedy placer must spend its scarce resource (long clear
    # runs) on the pieces that need them.
    if not wc:
        big = geo.area_m2 >= 5.0
        order = (["bathtub", "shower"] if big else ["shower", "bathtub"])
        for cls in order:
            if not style.options(cls):
                continue
            piece, why = place_against_wall(placer, style, "bath", cls, seed=seed, align_pref="ends",
                                            note="the longest wall away from the door")
            if piece:
                break
            # ⭐ a 170 cm bath simply does not fit every 6 m2 bathroom (the pilot's main bathroom has
            # a 345 cm wall with a window in it and a door arc on the return) -- so fall back to the
            # 90 cm shower rather than leaving the room with neither.
            log(f"    - {cls} does not fit: {why}")

    toilet_mid = style.pick("toilet", seed, geo.id, "toilet")
    if toilet_mid:
        tw, td, th = style.geom(toilet_mid)
        got, why = None, "no wall run long enough"
        for e, s0, s1, _ln in opposed_first(_runs_for(geo, tw, piece_h=th)):
            for s in _alignments(s0, s1, tw, (seed, geo.id, "toilet", e.index), style, pref="ends"):
                x, y = _wall_pos(e, s, td)
                got, why = placer.try_place("toilet", "toilet", toilet_mid, x, y, e.bearing_in,
                                            tw, td, 0.0, th,
                                            rule=f"wall {e.index}, the run most opposed to the door",
                                            scale=style.model(toilet_mid).get("scale", 1.0),
                                            front_local=style.model(toilet_mid).get("front_local", "-Y"))
                if got:
                    break
            if got:
                break
        if got is None:
            log(f"    - toilet SKIPPED: {why}")

    sink_cls = "bathroom_sink_small" if (wc and style.options("bathroom_sink_small")) else "bathroom_sink"
    sink, why = place_against_wall(placer, style, "bathroom_sink", sink_cls, seed=seed,
                                   note="a clear wall beside the door")
    if sink is None:
        log(f"    - bathroom sink SKIPPED: {why}")
    elif style.options("mirror"):
        mm = style.pick("mirror", seed, geo.id, "mirror")
        mw2, md2, mh2 = style.geom(mm)
        placer.try_place("mirror", "mirror", mm, sink.obb.x - sink.obb.v[0] * (sink.obb.hd - 4.0),
                         sink.obb.y - sink.obb.v[1] * (sink.obb.hd - 4.0), sink.yaw,
                         mw2, md2, 120.0, 120.0 + mh2, layer="wall", anchor="wall", z_cm=120.0,
                         rule="above the basin", scale=style.model(mm).get("scale", 1.0),
                         front_local=style.model(mm).get("front_local", "-Y"), check_walk=False)

    if not wc and style.options("bathroom_cabinet"):
        place_against_wall(placer, style, "bathroom_cabinet", "bathroom_cabinet", seed=seed,
                           note="remaining wall")
    if sink and style.options("bath_mat"):
        bm = style.pick("bath_mat", seed, geo.id, "bath_mat")
        bw, bd, _bh = style.geom(bm)
        x, y = _in_front_of(sink, 8.0, bd)
        place_free(placer, style, "bath_mat", "bath_mat", x, y, sink.yaw, seed=seed, layer="rug",
                   model=bm, note="in front of the basin", offsets=[(0, 0), (0, -15), (0, 15)])
    _ceiling_light(placer, style, seed, over=None, pendant=False)


def t_dining(placer: Placer, style: Style, seed):
    """DINING: the table sits at the deepest point of the dining zone; chairs ring it; a pendant hangs
    over it; a rug goes under it."""
    geo = placer.geo
    log = placer.log
    table_mid = style.pick("dining_table", seed, geo.id, "dining_table")
    table = None
    if table_mid:
        tw, td, th = style.geom(table_mid)
        # candidate centres: the room's deepest point, then a ladder outward along both axes
        ladder = [(0, 0), (0, -60), (0, 60), (-60, 0), (60, 0), (0, -120), (0, 120), (-120, 0), (120, 0)]
        table, why = place_free(placer, style, "dining_table", "dining_table", geo.deep_x, geo.deep_y,
                                0.0 if (geo.bbox[2] - geo.bbox[0]) >= (geo.bbox[3] - geo.bbox[1]) else 90.0,
                                seed=seed, model=table_mid, note="near the room's deepest interior point",
                                offsets=ladder, scan=True)
        if table is None:
            log(f"    - dining_table SKIPPED: {why}")
    if table and style.options("dining_chair"):
        ch = style.pick("dining_chair", seed, geo.id, "dining_chair")
        cw, cd, chh = style.geom(ch)
        ux, uy = table.obb.u
        vx, vy = table.obb.v
        n_side = max(1, int(table.obb.hw * 2 // max(cw + 8.0, 1.0)))
        seats = 0
        for sgn in (1, -1):
            for k in range(n_side):
                along = (k - (n_side - 1) / 2.0) * (cw + 8.0)
                cx = table.obb.x + ux * along + vx * sgn * (table.obb.hd + 6.0 + cd / 2.0)
                cy = table.obb.y + uy * along + vy * sgn * (table.obb.hd + 6.0 + cd / 2.0)
                yaw = bearing_of(-vx * sgn, -vy * sgn)
                piece, _why = placer.try_place(f"chair_{'a' if sgn > 0 else 'b'}{k}", "dining_chair", ch,
                                               cx, cy, yaw, cw, cd, 0.0, chh,
                                               rule="around the dining table",
                                               scale=style.model(ch).get("scale", 1.0),
                                               front_local=style.model(ch).get("front_local", "-Y"),
                                               check_walk=False)
                if piece:
                    seats += 1
        log(f"    · dining chairs: {seats} placed around the table")
    if table and style.options("rug"):
        rug = style.pick("rug", seed, geo.id, "rug")
        place_free(placer, style, "rug", "rug", table.obb.x, table.obb.y, table.yaw, seed=seed,
                   layer="rug", model=rug, note="under the dining table")
    _corner_plant(placer, style, seed)
    _wall_art(placer, style, seed, over=None)
    _ceiling_light(placer, style, seed, over=table)


def t_vestibule(placer: Placer, style: Style, seed):
    """A small hall/lobby: a plant and a picture, nothing that narrows the circulation."""
    _corner_plant(placer, style, seed)
    _wall_art(placer, style, seed, over=None)
    _ceiling_light(placer, style, seed, over=None, pendant=False)


def t_corridor(placer: Placer, style: Style, seed):
    """A corridor is circulation: wall art only (zero floor footprint) plus its luminaire."""
    _wall_art(placer, style, seed, over=None)
    _ceiling_light(placer, style, seed, over=None, pendant=False)


def t_safe_room(placer: Placer, style: Style, seed):
    """⛔ A MAMAD is left BARE, on purpose (catalog/RESEARCH.md §3): a reinforced safe room is not a
    furnished bedroom, and dressing one would be a claim about the unit we cannot make. Light only."""
    _ceiling_light(placer, style, seed, over=None, pendant=False)


def t_balcony(placer: Placer, style: Style, seed):
    """An open balcony: one outdoor table+chairs set, centred. Balconies carry no camera point, but
    they ARE seen through the living room's glazing, so they are dressed, not skipped."""
    geo = placer.geo
    if not style.options("outdoor_set"):
        return
    # both orientations: a 171 cm-deep set on a 195 cm-deep balcony has almost no room to dodge the
    # slider's threshold strip end-on, but plenty of room beside the door turned 90 deg.
    for yaw in (0.0, 90.0):
        piece, why = place_free(placer, style, "outdoor_set", "outdoor_set",
                                geo.deep_x, geo.deep_y, yaw, seed=seed,
                                note=f"on the balcony at yaw {yaw:.0f}, visible through the glazing",
                                offsets=[(0, 0), (-60, 0), (60, 0), (0, -60), (0, 60)], scan=True)
        if piece:
            return
    placer.log(f"    - outdoor_set SKIPPED: {why}")


def t_none(placer: Placer, style: Style, seed):
    return


TEMPLATES = {
    "living": t_living,
    "bedroom": t_bedroom,
    "kids": lambda p, s, seed: t_bedroom(p, s, seed, kids=True),
    "kitchen": t_kitchen,
    "bathroom": lambda p, s, seed: t_bathroom(p, s, seed, wc=False),
    "toilet": lambda p, s, seed: t_bathroom(p, s, seed, wc=True),
    "dining": t_dining,
    "vestibule": t_vestibule,
    "corridor": t_corridor,
    "safe_room": t_safe_room,
    "balcony": t_balcony,
    "service_balcony": t_none,
    "none": t_none,
}


def _corner_plant(placer: Placer, style: Style, seed):
    if not style.options("plant"):
        return None
    geo = placer.geo
    mid = style.pick("plant", seed, geo.id, "plant")
    w, d, h = style.geom(mid)
    # every room corner, ranked by how much clear floor it has (deepest-point distance as the proxy)
    cands = []
    for i, (vx, vy) in enumerate(geo.loop):
        e_prev = geo.edges[(i - 1) % len(geo.edges)]
        e_next = geo.edges[i]
        inx = _norm(e_prev.normal[0] + e_next.normal[0], e_prev.normal[1] + e_next.normal[1])
        cx = vx + inx[0] * (max(w, d) / 2.0 + 6.0)
        cy = vy + inx[1] * (max(w, d) / 2.0 + 6.0)
        if not pc.point_in_polygon((cx, cy), geo.loop):
            continue
        cands.append((-pc.dist_to_boundary((cx, cy), geo.loop), i, cx, cy, e_next.bearing_in))
    cands.sort()
    for _score, i, cx, cy, yaw in cands:
        piece, _why = placer.try_place("plant", "plant", mid, cx, cy, yaw, w, d, 0.0, h,
                                       rule=f"in the clear corner at loop vertex {i}",
                                       scale=style.model(mid).get("scale", 1.0),
                                       front_local=style.model(mid).get("front_local", "-Y"))
        if piece:
            return piece
    return None


def _wall_art(placer: Placer, style: Style, seed, over: Piece | None):
    if not style.options("wall_art"):
        return None
    geo = placer.geo
    mid = style.pick("wall_art", seed, geo.id, "wall_art")
    w, d, h = style.geom(mid)
    # ⭐ T13, found by eye on the 12-point draft strip: `z` is the frame's BOTTOM, not its centre, and
    #    it was a flat 150.0 — so the pilot's only art model (84.1 cm tall) hung with its centre at
    #    192.1 cm and its top 25.9 cm from a 260 cm ceiling, in all six rooms that get art. The gallery
    #    convention is a CENTRE at eye level (~150 cm), which for this frame is a bottom at 108 cm.
    #    Expressed as the centre, so a taller or shorter art model stays hung correctly.
    z = max(WALL_ART_CENTRE_CM - h / 2.0, WALL_ART_MIN_BOTTOM_CM)
    if over is not None:
        # ...and above whatever it hangs over: a sofa back or a headboard must not overlap the frame.
        z = max(z, over.obb.z1 + WALL_ART_CLEAR_OVER_CM)
        # centred over the piece's own wall, on that piece's wall line
        bx = over.obb.x - over.obb.v[0] * (over.obb.hd + d / 2.0 + 1.0)
        by = over.obb.y - over.obb.v[1] * (over.obb.hd + d / 2.0 + 1.0)
        piece, _why = placer.try_place("wall_art", "wall_art", mid, bx, by, over.yaw, w, d,
                                       z, z + h, layer="wall", anchor="wall", z_cm=z,
                                       rule=f"on the wall above the {over.slot}",
                                       scale=style.model(mid).get("scale", 1.0),
                                       front_local=style.model(mid).get("front_local", "-Y"),
                                       check_walk=False)
        if piece:
            return piece
    for e, s0, s1, _ln in _runs_for(geo, w):
        x, y = _wall_pos(e, (s0 + s1) / 2.0, d, gap=0.5)
        piece, _why = placer.try_place("wall_art", "wall_art", mid, x, y, e.bearing_in, w, d,
                                       z, z + h, layer="wall", anchor="wall", z_cm=z,
                                       rule=f"centred on wall run {e.index}",
                                       scale=style.model(mid).get("scale", 1.0),
                                       front_local=style.model(mid).get("front_local", "-Y"),
                                       check_walk=False)
        if piece:
            return piece
    return None


# ============================================================================ the entry points
def template_for(room, style: Style) -> str:
    """Map a plan room type onto a template. The plan's vocabulary is finer than the catalog's six
    room types (SCHEMA §5 + catalog/RESEARCH.md §3), so the mapping is stated here, once."""
    t = room["type"]
    if room.get("is_outdoor"):
        return "balcony" if t == "balcony" else "service_balcony"
    if t == "hall":
        # ⭐ one plan type, two very different rooms: `r-dining` is 15.8 m2 and literally named
        # "מבואה ופינת אוכל" (lobby + dining corner); `r-master-lobby` is a 2.4 m2 vestibule.
        return "dining" if float(room["area_m2"]) >= 10.0 else "vestibule"
    return t if t in TEMPLATES else "none"


def furnish_room(room, plan, style: Style, seed=0, log=None):
    lines = []

    def _log(msg):
        lines.append(msg)
        if log:
            log(msg)

    geo = RoomGeo(room, plan)
    placer = Placer(geo, _log)
    tname = template_for(room, style)
    _log(f"  room {room['id']:<18s} {room['type']:<16s} -> template '{tname}'  "
         f"{geo.area_m2:5.2f} m2, {len(geo.edges)} edges, {len(geo.openings)} opening(s), "
         f"{len(geo.cameras)} camera(s)")
    for oid, why in geo.unmatched:
        _log(f"    ! opening {oid} could not be attached to a loop edge ({why})")
    TEMPLATES[tname](placer, style, seed)
    _log(f"    = {len(placer.pieces)} piece(s): "
         f"{', '.join(p.slot for p in placer.pieces) if placer.pieces else '(none)'}")
    return {"room_id": room["id"], "template": tname, "seed": seed,
            "placements": [p.to_dict() for p in placer.pieces], "log": lines}, placer


def furnish_plan(plan, style: Style, seed=0, log=None):
    out = {}
    placers = {}
    for room in plan["rooms"]:                       # file order == deterministic order
        rec, placer = furnish_room(room, plan, style, seed=seed, log=log)
        out[room["id"]] = rec
        placers[room["id"]] = placer
    return out, placers


# ================================================================== the independent re-assert
def check_placements(plan, style: Style, furnished) -> list[dict]:
    """A SECOND, independent pass over the finished layout. It re-derives every rule from the output
    dicts alone -- it does not reuse the Placer's incremental state -- so a bug in the accept path
    cannot hide here. `--selftest` proves it can fail."""
    violations = []
    rooms = {r["id"]: r for r in plan["rooms"]}
    for rid, rec in furnished.items():
        geo = RoomGeo(rooms[rid], plan)
        placer = Placer(geo, lambda _m: None)
        boxes = []
        for p in rec["placements"]:
            obb = OBB(p["x_cm"], p["y_cm"], p["yaw_deg"], p["size_cm"][0], p["size_cm"][1],
                      p["aabb_z_cm"][0], p["aabb_z_cm"][1])
            boxes.append((p, obb))
        for p, obb in boxes:
            if p["layer"] != "ceiling":
                ok, why = placer.r_inside(obb)
                if not ok:
                    violations.append({"room": rid, "slot": p["slot"], "rule": "R-INSIDE", "detail": why})
            ok, why = placer.r_door(obb, p["layer"])
            if not ok:
                violations.append({"room": rid, "slot": p["slot"], "rule": "R-DOOR", "detail": why})
            ok, why = placer.r_camera(obb, p["layer"])
            if not ok:
                violations.append({"room": rid, "slot": p["slot"], "rule": "R-CAMERA", "detail": why})
            ok, why = placer.r_window(obb)
            if not ok:
                violations.append({"room": rid, "slot": p["slot"], "rule": "R-WINDOW", "detail": why})
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                pi, bi = boxes[i]
                pj, bj = boxes[j]
                if pi["layer"] != "floor" or pj["layer"] != "floor":
                    continue
                if bi.overlaps(bj, pad=-0.5):
                    violations.append({"room": rid, "slot": f"{pi['slot']}+{pj['slot']}",
                                       "rule": "R-OVERLAP", "detail": "footprints intersect"})
        for p, obb in boxes:
            if p["layer"] == "on_top":
                sup = next((b for q, b in boxes if q["slot"] == p.get("support")), None)
                if sup is None or any(not sup.contains2d(cx, cy, pad=1.0) for cx, cy in obb.corners()):
                    violations.append({"room": rid, "slot": p["slot"], "rule": "R-SUPPORT",
                                       "detail": f"support '{p.get('support')}' missing or too small"})
        # walkway, rebuilt from scratch over the finished set
        placer._grid_init()
        for p, obb in boxes:
            if p["layer"] == "floor":
                placer._grid_apply(obb)
        ok, why = placer._walkable(placer._grid)
        if not ok:
            violations.append({"room": rid, "slot": "(room)", "rule": "R-WALK", "detail": why})
    return violations


# ========================================================================================= CLI
def _selftest(plan, style: Style) -> int:
    """⛔ A check that cannot fail is a constant, not a check (T04/T07's own lesson, paid for twice).
    Four deliberately illegal layouts, each of which MUST be caught by `check_placements`."""
    room = next(r for r in plan["rooms"] if r["id"] == "r-living")
    geo = RoomGeo(room, plan)
    cam = geo.cameras[0]
    door = geo.doors()[0] if geo.doors() else None
    cases = []
    # 1. a piece straddling the room boundary
    cases.append(("R-INSIDE", [{"slot": "x", "class": "sofa", "model": None,
                                "x_cm": geo.bbox[0], "y_cm": (geo.bbox[1] + geo.bbox[3]) / 2,
                                "z_cm": None, "yaw_deg": 90.0, "anchor": "floor", "layer": "floor",
                                "size_cm": [200, 90, 80], "aabb_z_cm": [0, 80], "support": None,
                                "rule": "selftest"}]))
    # 2. a piece sitting on the camera. ⚠ It has to be TALL: the first version of this case used an
    # 80 cm box under a 140 cm camera and was MISSED -- correctly, because the rule is 3-D and 60 cm
    # of headroom is 60 cm of clearance. The check was right and the test was wrong; a full-height
    # wardrobe on the camera is the real violation.
    cases.append(("R-CAMERA", [{"slot": "x", "class": "wardrobe", "model": None,
                                "x_cm": cam["x"], "y_cm": cam["y"], "z_cm": None, "yaw_deg": 0.0,
                                "anchor": "floor", "layer": "floor", "size_cm": [100, 100, 200],
                                "aabb_z_cm": [0, 200], "support": None, "rule": "selftest"}]))
    # 3. two pieces in the same place
    p = {"slot": "a", "class": "sofa", "model": None, "x_cm": geo.deep_x, "y_cm": geo.deep_y,
         "z_cm": None, "yaw_deg": 0.0, "anchor": "floor", "layer": "floor",
         "size_cm": [80, 80, 80], "aabb_z_cm": [0, 80], "support": None, "rule": "selftest"}
    q = dict(p, slot="b")
    cases.append(("R-OVERLAP", [p, q]))
    # 4. a wall of furniture sealing the room off from its own doorway
    seal = []
    if door:
        e, op, s0, s1 = door
        for k in range(9):
            cx, cy = e.point_at(s0 + (s1 - s0) * (k + 0.5) / 9.0)
            cx += e.normal[0] * 60.0
            cy += e.normal[1] * 60.0
            seal.append({"slot": f"seal{k}", "class": "sofa", "model": None, "x_cm": cx, "y_cm": cy,
                         "z_cm": None, "yaw_deg": e.bearing_in, "anchor": "floor", "layer": "floor",
                         "size_cm": [(s1 - s0) / 9.0, 110, 90], "aabb_z_cm": [0, 90], "support": None,
                         "rule": "selftest"})
        cases.append(("R-DOOR|R-WALK", seal))

    failures = 0
    for want, placements in cases:
        v = check_placements(plan, style, {"r-living": {"placements": placements}})
        got = {x["rule"] for x in v}
        ok = any(w in got for w in want.split("|"))
        print(f"  selftest {want:<16s} -> {'CAUGHT' if ok else 'MISSED'} "
              f"({', '.join(sorted(got)) if got else 'no violation reported'})")
        if not ok:
            failures += 1
    # 5. and the honest converse: the real layout must be clean
    furnished, _ = furnish_plan(plan, style, seed=0)
    v = check_placements(plan, style, furnished)
    print(f"  selftest real layout   -> {len(v)} violation(s) "
          f"{'PASS' if not v else 'FAIL: ' + json.dumps(v[:3])}")
    failures += 1 if v else 0
    return failures


def main(argv):
    ap = argparse.ArgumentParser(prog="placement_templates.py", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan")
    ap.add_argument("--style", required=True, help="path to the style lock json")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--report", default=None)
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--compare-seed", type=int, default=None,
                    help="also furnish with this seed and report how the two layouts differ")
    args = ap.parse_args(argv)

    plan = json.load(open(args.plan, encoding="utf-8"))
    style = Style(json.load(open(args.style, encoding="utf-8")))
    print(f"placement_templates.py v{VERSION}  style '{style.name}' v{style.version}  seed {args.seed}")
    print(f"bars: walkway {WALKWAY_CM:.0f} cm · camera bubble {CAMERA_BUBBLE_CM:.0f} cm · "
          f"door swing >= {DOOR_SWING_MIN_CM:.0f} cm · wall gap {WALL_GAP_CM:.1f} cm")

    if args.selftest:
        n = _selftest(plan, style)
        print("SELFTEST OK" if not n else f"SELFTEST FAILED ({n})")
        return 0 if not n else 1

    furnished, _placers = furnish_plan(plan, style, seed=args.seed, log=print)
    total = sum(len(r["placements"]) for r in furnished.values())
    violations = check_placements(plan, style, furnished)
    print(f"\nTOTAL     {total} placements across {len(furnished)} rooms")
    for v in violations:
        print(f"VIOLATION {v['rule']} {v['room']}/{v['slot']}: {v['detail']}")
    print(f"CHECKS    {len(violations)} violation(s)")

    diff = None
    if args.compare_seed is not None:
        other, _ = furnish_plan(plan, style, seed=args.compare_seed)
        same = sum(1 for rid in furnished
                   for a, b in zip(furnished[rid]["placements"], other[rid]["placements"])
                   if a == b)
        n_other = sum(len(r["placements"]) for r in other.values())
        v_other = check_placements(plan, style, other)
        diff = {"seed_a": args.seed, "seed_b": args.compare_seed, "placements_a": total,
                "placements_b": n_other, "identical_placements": same,
                "violations_b": len(v_other)}
        print(f"SEEDS     {args.seed} vs {args.compare_seed}: {total} vs {n_other} placements, "
              f"{same} identical, seed-{args.compare_seed} violations {len(v_other)}")

    if args.report:
        rep = {"generator": {"script": "pipeline/placement_templates.py", "version": VERSION},
               "style": {"name": style.name, "version": style.version,
                         "file": os.path.abspath(args.style).replace("\\", "/")},
               "plan": os.path.abspath(args.plan).replace("\\", "/"),
               "seed": args.seed,
               "bars_cm": {"walkway": WALKWAY_CM, "camera_bubble": CAMERA_BUBBLE_CM,
                           "door_swing_min": DOOR_SWING_MIN_CM, "wall_gap": WALL_GAP_CM,
                           "opening_margin": OPENING_MARGIN_CM, "grid": GRID_CM,
                           "wall_art_centre": WALL_ART_CENTRE_CM,
                           "wall_art_min_bottom": WALL_ART_MIN_BOTTOM_CM,
                           "wall_art_clear_over": WALL_ART_CLEAR_OVER_CM},
               "total_placements": total, "violations": violations, "seed_comparison": diff,
               "rooms": furnished}
        with open(args.report, "w", encoding="utf-8", newline="\n") as f:
            json.dump(rep, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"report    {args.report}")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

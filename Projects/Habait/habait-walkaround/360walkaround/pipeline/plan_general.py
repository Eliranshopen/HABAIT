#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""plan_general.py -- the 2-D half of the GENERAL-polygon path (D-WQ-28, WALKAROUND-QUALITY-PLAN Q01b).

`build_scene.py` takes a plan whose `geometry` (top level, or `plan_meta.geometry`) is "general" down a
separate branch; everything that branch needs to DECIDE lives here, as plain 2-D geometry over the plan's
own centimetres, so it is testable without paying Blender's startup (`python plan_general.py --selftest`).
Pure Python; numpy is imported lazily, by the fill raster and the luminaire search only.

WHAT A GENERAL PLAN IS (schema 0.2.0-draft, apartment 846): rooms are any simple polygon traced by flood
fill, walls are polygons extracted from the drawing's grey fill, openings are oriented segments
(centre_cm + angle_deg + width_cm), glazing is `panes[]`. Measured on 846 before a line of this file was
written (render-pipeline-engineer, 2026-10-28):

  * The room loops stop at the INNER edge of the drawing's black outline stroke and the wall polygons at
    the edge of the grey fill, so a 2-5 cm band (up to 14 cm where the raster opening shrank a piece)
    separates every room from its walls: 84.5 % of the "wall" edge length sits 2-5 cm off its wall.
    Built naively, every wall base and every ceiling edge is a slit onto the terrain or the sky.
  * Open-plan zones are 3-10 cm apart (the hand-placed zone bars), door gaps leave the threshold
    between two loops unfloored, and the tracer cut the kitchen's cooktop and sink bays and a laundry
    niche out of their rooms (fixture outlines acted as barriers).

THE FOUR ANSWERS, each deterministic and each logged into the scene report:
  1. FACINGS. Along every "wall" loop edge, wherever a wall polygon is found within
     FACING_MAX_BAND_CM along the outward normal, a box whose FRONT face is exactly the loop edge and
     whose back is buried FACING_OVERLAP_CM into the wall. The visible wall face is therefore the traced
     interior face -- what SCHEMA 4 calls the loop, what the ruler measures, and what the plan's own
     scale check used (traced 9.31 m2 against a printed 9.41 m2 for the 342 x 275 bedroom: the true
     face sits ~0.8 cm beyond the loop, so a facing is ~0.5 % small where a bare grey-fill wall would be
     1.5-3.5 % large). Samples beyond the band (a convex-hull bathroom edge 25 cm off its wall, a door
     gap) get no facing: the wall polygon's own face stays the visible one there.
  2. DOOR INFILLS. A drawn door is a GAP in the grey fill, so the walls carry no lintel. Every cut
     opening gets a full-height infill box across its span (width + INFILL_OVERLAP_CM into each wall
     end, front and back flush with the two rooms' loops), and the oriented cutter (CUTTER_DEPTH_CM +
     the builder's CUT_MARGIN_CM per side, sill to head) then removes the door from it -- leaving the
     head above `head_cm`. In a continuous wall the infill hides inside the wall and the cut is the same.
  3. THE FILL. One floor slab per floor material and one ceiling slab, rasterised at FILL_RES_CM from
     rooms + walls + panes + facings + infills + leaves, closed by FILL_CLOSE_CELLS cells (the zone
     bars), with every enclosed hole filled (the bays, the niche, the thresholds), each cell given the
     material of the room it is geodesically nearest to. The fill sits FILL_FLOOR_Z_OFFSET_CM below
     the floor and FILL_CEILING_Z_OFFSET_CM above the ceiling: NEVER coplanar with a room slab.
     MEASURED on the second 846 draft (render-pipeline-engineer, 2026-10-28): with the ceiling fill ON
     the ceiling plane the zenith of cp-living read 185.3/255 against 168.8 with it 2.5 mm above, and
     every fill-only strip showed darker and warmer. Cycles 4.x prevents self-intersection by primitive
     id, not by offsetting the ray, so a bounce ray leaving one of two coplanar faces can hit the other
     at t ~ 0 from behind, flip, and gather the sky -- the double-faced ceiling leaked light. Same
     material is NOT enough to make coplanar faces safe in this renderer.
     WHERE the ceiling goes is not "nearest room is indoor" either (the first rule, which split the
     cavity between the facade's two glass lines and left its outer half open to the sky -- 30-37 sky
     pixels on cp-living): the sky is the flood from the outdoor rooms through every fill cell that is
     neither within FILL_INDOOR_GUARD_CELLS of an indoor room nor a full-height barrier (a wall, a
     facing, an infill, a facade pane or a post that reaches the ceiling); every other fill cell is
     under the slab. A ROOFED outdoor room (`rooms[].roofed`, OQ-G4: the deck of the floor above a tower
     terrace) is never sky and gets the ceiling; the sky is then seeded from the building's outline too,
     so the deck ends at the room's own loop and the railing band stays open. The guard is what holds: the barrier line alone leaked on 846 (4,230 sky pixels on
     a 2K preview, the zone bars opened and sunlight fell through them), because a traced facade is not
     watertight at 1 cm; the guard costs at most a 12 cm slab edge beyond the glass. The barriers are
     also CLOSED by FILL_CLOSE_CELLS before the flood: on 846 a 5 cm gap between two raster wall
     fragments let the terrace's sky into a slot inside the column assembly (47 sky pixels, cp-kitchen).
  4. LUMINAIRES. No furniture template runs on a general room in this version, so the flush ceiling
     luminaire the T12 templates would have placed is placed here: at the room's deepest grid point
     that stands LUMINAIRE_CAMERA_GAP_CM clear of every camera point in it (T07/T12's ceiling lesson).

Rails: no randomness, every collection walked in plan order, every tie broken by a fixed rule; nothing
here reads or writes Blender data. Units: plan centimetres in, plan centimetres out.

2b (found on the first draft render, cp-living): pane polygons that stop 0.2-4.8 cm short of the wall or
pane they meet left see-through slits in the envelope; `pane_joints()` closes each with a frame post.

2c (Q05, the skin lane, 2026-10-29): a door whose cutter goes THROUGH a pane leaves a bare, unframed gap
in the glass -- transparent on both sides of the cut, so an image model reads the whole glass run as the
door (846's o-13: 190 cm painted for 132). `door_glass_frames()` frames such a gap IN THE PANE'S OWN
LINE (o-13's door line runs 21-35 cm inside the glass it cuts): two posts centred on the cutter's sides
and a head centred on the door's head, so every bare glass face lies INSIDE the frame, never on one of its
faces (answer 3's coplanar lesson).
"""
from __future__ import annotations

import argparse
import json
import math
import sys

VERSION = "0.2.0"

EPS = 1e-6

# 1. facings
FACING_MAX_BAND_CM = 12.0       # a gap this wide or less between a loop edge and its wall is the outline stroke
FACING_OVERLAP_CM = 2.0         # how far a facing is buried into its wall beyond the widest band sample
FACING_EXIT_MARGIN_CM = 0.5     # ...but never closer than this to the wall's far face
FACING_SAMPLE_CM = 2.0          # sample pitch along a loop edge
FACING_SEARCH_CM = 40.0         # how far the outward ray looks for a wall
FACING_MIN_RUN_CM = 4.0         # shorter runs are not built
FACING_GAP_BRIDGE_CM = 25.0     # an interruption this short between two backed runs is bridged (a door is >= 60)

# 2. openings
CUT_KINDS = ("door", "entrance_door", "sliding_door", "glazed_door", "window")
CUTTER_DEPTH_CM = 60.0          # the brief: the thickest 846 wall is ~30 cm; the builder adds CUT_MARGIN_CM per side
INFILL_OVERLAP_CM = 3.0         # an infill reaches this far into each wall end
INFILL_FACE_RECESS_CM = 0.1     # its faces stop this short of the loops: never coplanar with a facing
INFILL_MAX_DEPTH_CM = 40.0      # per side, from the door line
INFILL_DEFAULT_DEPTH_CM = 15.0  # per side, when neither a room loop nor a wall says otherwise
INFILL_GAP_SEARCH_CM = 60.0     # how far past the opening's ends the gap's wall ends are looked for
INFILL_GAP_OFFSETS_CM = (0.0, -4.0, 4.0, -8.0, 8.0)
INFILL_END_PROBES_CM = (2.0, 4.0, 6.0, 9.0)
INFILL_PROBE_OFFSETS_CM = (0.0, -1.5, 1.5, -3.0, 3.0, -5.0, 5.0, -8.0, 8.0, -12.0, 12.0)
DOOR_SPAN_PROBE_CM = 25.0       # the cross-section probed when asking "does this door span sit on a wall?"
DOOR_SPAN_WALL_WARN = 0.25      # a door whose span is more than this share on wall polygons is flagged

# 2b. pane joints
PANE_JOINT_MAX_CM = 12.0        # a pane end this close to a wall or another pane, but not touching, gets a post
                                # (Q02: 6.0 left facade-1 open at both ends, 9.76 and 6.59 cm, on cp-bedroom2/cp-living)
PANE_JOINT_CAP_CM = 4.0         # the pane vertices within this of an end form its end cap
PANE_JOINT_OVERLAP_CM = 1.0     # the post is grown this much so it overlaps both sides of the joint

# 2c. door-in-glass frames
DOOR_FRAME_KINDS = ("door", "entrance_door", "sliding_door", "glazed_door")
DOOR_GLASS_MIN_CM2 = 10.0       # this much of a pane inside a door-kind cutter (1 cm raster) = the door cuts the pane
DOOR_GLASS_SIDE_PROBE_CM = 1.0  # glass found this far outside a cutter side = the cut leaves a bare glass edge there
DOOR_GLASS_MAX_ANGLE_DEG = 30.0  # a pane crossing the door line at more than this is not framed (reported)
DOOR_GLASS_SINK_CM = 1.0        # a post standing on the floor (sill 0) starts this far below it: no hairline

# 3. the fill
FILL_RES_CM = 1.0
FILL_CLOSE_CELLS = 6            # square closing half-size: bridges a gap of up to 13 cells (13 cm)
FILL_MARGIN_CM = 20.0
FILL_FLOOR_Z_OFFSET_CM = 0.25    # the floor fill sits this far BELOW the room floors (floor materials differ)
FILL_CEILING_Z_OFFSET_CM = 0.25  # the ceiling fill sits this far ABOVE the room ceilings -- never on them
FILL_LABEL_MAX_ITER = 400
FILL_INDOOR_GUARD_CELLS = 12    # the sky never comes within this of an indoor loop (bands, bars, glass cavities)

# 4. luminaires
LUMINAIRE_GRID_CM = 5.0
LUMINAIRE_MIN_CLEAR_CM = 25.0
LUMINAIRE_CAMERA_GAP_CM = 60.0


# ============================================================================================ basics
def is_general(plan) -> bool:
    """The flag D-WQ-28 rules: a top-level `geometry` or `plan_meta.geometry` equal to "general"."""
    return (plan.get("geometry") == "general"
            or (plan.get("plan_meta") or {}).get("geometry") == "general")


def clean_ring(points, eps=EPS):
    """Drop consecutive duplicates and a repeated closing point. Collinear points are KEPT: they are
    the drawing's own vertices and cost nothing."""
    out = []
    for p in points:
        q = (float(p[0]), float(p[1]))
        if out and abs(q[0] - out[-1][0]) <= eps and abs(q[1] - out[-1][1]) <= eps:
            continue
        out.append(q)
    while len(out) > 1 and abs(out[0][0] - out[-1][0]) <= eps and abs(out[0][1] - out[-1][1]) <= eps:
        out.pop()
    return out


def shoelace(poly):
    """Signed area in the plan frame (x right, y DOWN). SCHEMA 0.2 loops are positive here."""
    a = 0.0
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        a += x0 * y1 - x1 * y0
    return a / 2.0


def perimeter(poly):
    n = len(poly)
    return sum(math.hypot(poly[(i + 1) % n][0] - poly[i][0], poly[(i + 1) % n][1] - poly[i][1])
               for i in range(n))


def bbox(poly):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return min(xs), min(ys), max(xs), max(ys)


def bbox_overlap(a, b, pad=0.0):
    return not (a[2] + pad < b[0] or b[2] + pad < a[0] or a[3] + pad < b[1] or b[3] + pad < a[1])


def point_in_polygon(pt, poly):
    """Even-odd, the same convention as place_cameras.py and both validators."""
    px, py = pt
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > py) != (yj > py):
            if px < (xj - xi) * (py - yi) / (yj - yi) + xi:
                inside = not inside
        j = i
    return inside


def dist_point_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    if l2 < 1e-12:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def ray_polygon(px, py, dx, dy, poly, tmax):
    """Every t in (0, tmax] where the ray p + t*d crosses an edge of `poly`, sorted. Half-open edges
    (u in [0, 1)) so a ray through a vertex is counted once."""
    ts = []
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        ex, ey = bx - ax, by - ay
        den = dx * ey - dy * ex
        if abs(den) < 1e-12:
            continue
        t = ((ax - px) * ey - (ay - py) * ex) / den
        u = ((ax - px) * dy - (ay - py) * dx) / den
        if 0.0 <= u < 1.0 and 1e-9 < t <= tmax:
            ts.append(t)
    ts.sort()
    return ts


def first_wall_hit(px, py, dx, dy, walls, tmax):
    """The nearest wall along the ray: (t_in, t_out or None, wall_id, height_cm), or None. A start point
    already inside a wall reads t_in = 0 (a loop edge that overlaps its wall has a zero band)."""
    best = None
    for wid, poly, height, _bb in walls:
        ts = ray_polygon(px, py, dx, dy, poly, tmax)
        if point_in_polygon((px, py), poly):
            hit = (0.0, ts[0] if ts else None, wid, height)
        elif ts:
            hit = (ts[0], ts[1] if len(ts) > 1 else None, wid, height)
        else:
            continue
        if best is None or hit[0] < best[0] - 1e-9:
            best = hit
    return best


def oriented_rect(cx, cy, ux, uy, nx, ny, u0, u1, n0, n1):
    """Four plan points of the box [u0, u1] x [n0, n1] in the (u, n) frame centred at (cx, cy)."""
    return [(cx + ux * u + nx * v, cy + uy * u + ny * v)
            for u, v in ((u0, n0), (u1, n0), (u1, n1), (u0, n1))]


def wall_records(plan):
    out = []
    for w in plan["walls"]:
        poly = clean_ring(w["polygon_cm"])
        out.append((w["id"], poly, float(w["height_cm"]), bbox(poly)))
    return out


# ========================================================================================= facings
def facings(plan, note=None):
    """The facing runs of every room's "wall" edges (module docstring, answer 1). Returns a list of
    dicts in plan order (room, edge, run), each with the four plan points of its footprint."""
    walls = wall_records(plan)
    out = []
    for room in plan["rooms"]:
        raw = [(float(p[0]), float(p[1])) for p in room["loop"]]
        kinds = room.get("edge_kinds") or []
        n = len(raw)
        sign = 1.0 if shoelace(raw) > 0 else -1.0
        for i in range(n):
            if i >= len(kinds) or kinds[i] != "wall":
                continue
            ax, ay = raw[i]
            bx, by = raw[(i + 1) % n]
            length = math.hypot(bx - ax, by - ay)
            if length < FACING_MIN_RUN_CM:
                continue
            ux, uy = (bx - ax) / length, (by - ay) / length
            # a positively oriented loop in the y-DOWN frame has its interior on the screen-right of
            # each edge, i.e. (-uy, ux); outward is the opposite. Proven per edge, not assumed:
            nx, ny = sign * uy, -sign * ux
            mx, my = (ax + bx) / 2.0, (ay + by) / 2.0
            if point_in_polygon((mx + nx * 0.5, my + ny * 0.5), raw) and \
                    not point_in_polygon((mx - nx * 0.5, my - ny * 0.5), raw):
                nx, ny = -nx, -ny
                if note:
                    note(f"facing    {room['id']} edge {i}: outward normal flipped by the inside test")
            ebb = (min(ax, bx), min(ay, by), max(ax, bx), max(ay, by))
            cand = [w for w in walls if bbox_overlap(w[3], ebb, FACING_SEARCH_CM)]
            k = max(2, int(math.ceil(length / FACING_SAMPLE_CM)))
            samples = []
            for j in range(k):
                t = (j + 0.5) / k
                hit = first_wall_hit(ax + (bx - ax) * t, ay + (by - ay) * t, nx, ny, cand,
                                     FACING_SEARCH_CM) if cand else None
                samples.append(hit if (hit is not None and hit[0] <= FACING_MAX_BAND_CM) else None)
            # Q02 (cp-bedroom2, 3,691 px of street through a hairline): the wall behind an edge can be
            # several raster fragments with 2-20 cm gaps between them; a facing interrupted there leaves a
            # full-height see-through slit. An interior interruption no longer than FACING_GAP_BRIDGE_CM
            # between two backed samples is bridged with its neighbour's reading -- never a door, which is
            # at least 60 cm wide.
            bridged = 0.0
            j = 0
            while j < k:
                if samples[j] is not None:
                    j += 1
                    continue
                j0 = j
                while j < k and samples[j] is None:
                    j += 1
                if j0 > 0 and j < k and (j - j0) * length / k <= FACING_GAP_BRIDGE_CM:
                    for q in range(j0, j):
                        samples[q] = samples[j0 - 1]
                    bridged += (j - j0) * length / k
            j = 0
            run = 0
            while j < k:
                if samples[j] is None:
                    j += 1
                    continue
                j0 = j
                while j < k and samples[j] is not None:
                    j += 1
                s0 = 0.0 if j0 == 0 else j0 / k
                s1 = 1.0 if j == k else j / k
                run_len = (s1 - s0) * length
                if run_len < FACING_MIN_RUN_CM:
                    continue
                hits = samples[j0:j]
                band_max = max(h[0] for h in hits)
                band_min = min(h[0] for h in hits)
                depth = band_max + FACING_OVERLAP_CM
                exits = [h[1] for h in hits if h[1] is not None]
                clamped = False
                if exits and min(exits) - FACING_EXIT_MARGIN_CM < depth:
                    depth = max(min(exits) - FACING_EXIT_MARGIN_CM, band_max + 0.2)
                    clamped = True
                p0 = (ax + (bx - ax) * s0, ay + (by - ay) * s0)
                p1 = (ax + (bx - ax) * s1, ay + (by - ay) * s1)
                out.append({
                    "id": f"{room['id']}_e{i}_r{run}",
                    "room_id": room["id"], "edge": i, "run": run,
                    "is_outdoor": bool(room.get("is_outdoor")),
                    "p0": [round(p0[0], 4), round(p0[1], 4)], "p1": [round(p1[0], 4), round(p1[1], 4)],
                    "outward": [round(nx, 9), round(ny, 9)],
                    "length_cm": round(run_len, 3), "depth_cm": round(depth, 3),
                    "band_cm": [round(band_min, 2), round(band_max, 2)],
                    "height_cm": max(h[3] for h in hits),
                    "walls": sorted({h[2] for h in hits}),
                    "clamped_by_wall_thickness": clamped,
                    "bridged_cm_on_edge": round(bridged, 2),
                    "rect": [(p0[0], p0[1]), (p1[0], p1[1]),
                             (p1[0] + nx * depth, p1[1] + ny * depth),
                             (p0[0] + nx * depth, p0[1] + ny * depth)],
                })
                run += 1
    return out


def facing_coverage(plan, runs):
    """Share of each room's "wall" edge length that carries a facing -- reported, not a bar."""
    tot, cov = {}, {}
    for room in plan["rooms"]:
        raw = room["loop"]
        kinds = room.get("edge_kinds") or []
        n = len(raw)
        for i in range(min(n, len(kinds))):
            if kinds[i] == "wall":
                a, b = raw[i], raw[(i + 1) % n]
                tot[room["id"]] = tot.get(room["id"], 0.0) + math.hypot(b[0] - a[0], b[1] - a[1])
    for r in runs:
        cov[r["room_id"]] = cov.get(r["room_id"], 0.0) + r["length_cm"]
    return {rid: {"wall_edge_cm": round(t, 1), "faced_cm": round(cov.get(rid, 0.0), 1),
                  "share": round(cov.get(rid, 0.0) / t, 4) if t > 0 else None}
            for rid, t in tot.items()}


# ======================================================================================== openings
def is_virtual_opening(op, ceiling_cm):
    """The brief's rule: an `opening` whose head reaches the ceiling is a virtual boundary between
    open-plan zones -- nothing to cut and nothing to build."""
    return op["kind"] == "opening" and float(op["head_cm"]) >= float(ceiling_cm) - 1e-6


def door_frame(op):
    """(cx, cy, ux, uy, nx, ny): centre, the unit vector along the opening (angle_deg from +x in the
    raster frame) and its in-plane normal."""
    cx, cy = (float(v) for v in op["centre_cm"])
    th = math.radians(float(op["angle_deg"]))
    ux, uy = math.cos(th), math.sin(th)
    return cx, cy, ux, uy, -uy, ux


def door_cutter(op, cut_margin_cm, wall_top_cm):
    """The oriented cutter of the brief: width_cm long (exactly -- a door in a gap must not widen the
    gap), CUTTER_DEPTH_CM + a margin per side deep, sill to head (overshooting only an edge it shares
    with the floor or the wall top)."""
    cx, cy, ux, uy, nx, ny = door_frame(op)
    hw = float(op["width_cm"]) / 2.0
    hd = CUTTER_DEPTH_CM / 2.0 + cut_margin_cm
    sill, head = float(op["sill_cm"]), float(op["head_cm"])
    z0 = sill - cut_margin_cm if sill <= 1e-9 else sill
    z1 = head + cut_margin_cm if head >= wall_top_cm - 1e-9 else head
    return {"rect": oriented_rect(cx, cy, ux, uy, nx, ny, -hw, hw, -hd, hd),
            "z_cm": [z0, z1], "half_width_cm": hw, "half_depth_cm": hd}


def _room_crossing(px, py, dx, dy, loop, tmax):
    """Distance along the ray to where it ENTERS `loop` (0 if it starts inside), or None."""
    if point_in_polygon((px, py), loop):
        return 0.0
    ts = ray_polygon(px, py, dx, dy, loop, tmax)
    return ts[0] if ts else None


def _wall_extent_at(px, py, nx, ny, walls):
    """The interval [lo, hi] along n (cm, relative to (px, py)) that the wall piece(s) under this point
    occupy, probed at a few offsets so a door line lying exactly on a wall face still finds its wall."""
    lo = hi = None
    for v in INFILL_PROBE_OFFSETS_CM:
        qx, qy = px + nx * v, py + ny * v
        for _wid, poly, _h, bb in walls:
            if not (bb[0] <= qx <= bb[2] and bb[1] <= qy <= bb[3]) or not point_in_polygon((qx, qy), poly):
                continue
            tf = ray_polygon(qx, qy, nx, ny, poly, 2 * INFILL_MAX_DEPTH_CM)
            tb = ray_polygon(qx, qy, -nx, -ny, poly, 2 * INFILL_MAX_DEPTH_CM)
            if tf and tb:
                a, b = v - tb[0], v + tf[0]
                lo = a if lo is None else min(lo, a)
                hi = b if hi is None else max(hi, b)
    return None if lo is None else (lo, hi)


def _first_wall_along(px, py, dx, dy, walls, tmax):
    """Distance to the first wall piece along the ray (0 if the point is already in one), or None."""
    best = None
    for _wid, poly, _h, bb in walls:
        if point_in_polygon((px, py), poly):
            return 0.0
        ts = ray_polygon(px, py, dx, dy, poly, tmax)
        if ts and (best is None or ts[0] < best):
            best = ts[0]
    return best


def door_infill(plan, op, ceiling_cm):
    """The infill box of answer 2: it FILLS THE WALL GAP the opening sits in, and the cutter then cuts
    exactly the plan's opening out of it -- so the head above the door and any part of the gap the door
    does not use stay wall, whether the trace put the door in its gap or not.
      * along the opening: its own span plus every wall-free run of a 1 cm profile that overlaps it
        (the gap), + INFILL_OVERLAP_CM into each end;
      * across: the SHORTEST chord through the wall pieces just past the gap's ends (a corner piece
        reads long, so the shortest probe wins), widened by the stroke band to each room loop, so the head
        is flush with the facings. (Measuring to the loops at the door line was tried first and is
        wrong: both rooms' flood fills reach into the gap, so it read 4-8 cm bodies on 846.)
    Falls back to the loops from the door line, then to a default 15 cm body, where no wall is found."""
    cx, cy, ux, uy, nx, ny = door_frame(op)
    w = float(op["width_cm"])
    hw = w / 2.0
    walls = wall_records(plan)
    rooms = {r["id"]: r for r in plan["rooms"]}
    loops = [[(float(p[0]), float(p[1])) for p in rooms[rid]["loop"]]
             for rid in op.get("rooms", []) if rid in rooms]
    info = {}
    # 1. the gap along u: a 1 cm profile of "no wall piece across the line" (probed at
    #    INFILL_GAP_OFFSETS_CM); the infill takes the opening's own span plus every wall-free run that
    #    overlaps it, so a door the trace slid off its gap still leaves no full-height slot beside it.
    span = hw + INFILL_GAP_SEARCH_CM
    steps = int(math.ceil(2 * span))
    free = []
    for i in range(steps):
        u = -span + i + 0.5
        hit = False
        for v in INFILL_GAP_OFFSETS_CM:
            px, py = cx + ux * u + nx * v, cy + uy * u + ny * v
            for _wid, poly, _h, bb in walls:
                if bb[0] <= px <= bb[2] and bb[1] <= py <= bb[3] and point_in_polygon((px, py), poly):
                    hit = True
                    break
            if hit:
                break
        free.append(not hit)
    reach = {1.0: hw, -1.0: hw}
    i = 0
    runs = []
    while i < steps:
        if not free[i]:
            i += 1
            continue
        j = i
        while j < steps and free[j]:
            j += 1
        runs.append((-span + i, -span + j))
        i = j
    used = [(r0, r1) for r0, r1 in runs if r1 > -hw + 1.0 and r0 < hw - 1.0]
    for r0, r1 in used:
        reach[1.0] = max(reach[1.0], r1)
        reach[-1.0] = max(reach[-1.0], -r0)
    info["free_runs_overlapping_cm"] = [[round(r0, 1), round(r1, 1)] for r0, r1 in used]
    info["gap_reach_cm"] = {"-u": round(reach[-1.0], 1), "+u": round(reach[1.0], 1)}
    # 2. the wall body across: the SHORTEST chord through the wall pieces just past either end
    chords = []
    for s in (1.0, -1.0):
        for k in INFILL_END_PROBES_CM:
            px, py = cx + ux * s * (reach[s] + k), cy + uy * s * (reach[s] + k)
            ext = _wall_extent_at(px, py, nx, ny, walls)
            if ext is not None:
                chords.append(((px, py), ext))
    if chords:
        chords.sort(key=lambda c: (round(c[1][1] - c[1][0], 6), c[0]))
        keep = [chords[0]]
        lo, hi = keep[0][1]
        band = {"+n": 0.0, "-n": 0.0}
        for (px, py), (l, h) in keep:
            for key, face, sgn in (("+n", h, 1.0), ("-n", l, -1.0)):
                fx, fy = px + nx * face, py + ny * face
                ds = [d for d in (_room_crossing(fx, fy, nx * sgn, ny * sgn, lp, FACING_MAX_BAND_CM)
                                  for lp in loops) if d is not None]
                if ds:
                    band[key] = max(band[key], min(ds))
        n_lo = lo - max(band["-n"] - INFILL_FACE_RECESS_CM, 0.0)
        n_hi = hi + max(band["+n"] - INFILL_FACE_RECESS_CM, 0.0)
        info.update({"wall_n_range_cm": [round(lo, 3), round(hi, 3)], "chords_probed": len(chords),
                     "band_cm": {k: round(v, 3) for k, v in band.items()},
                     "measured_to": "the wall pieces at the gap's ends + the stroke band to the loops"})
    else:
        sides = {}
        for s in (1.0, -1.0):
            ds = []
            for lp in loops:
                got = sorted(d for d in (_room_crossing(cx + ux * w * f, cy + uy * w * f, nx * s, ny * s, lp,
                                                        INFILL_MAX_DEPTH_CM) for f in (-0.4, 0.0, 0.4))
                             if d is not None)
                if len(got) >= 2:
                    ds.append(got[len(got) // 2])
            sides[s] = min(ds) if ds else INFILL_DEFAULT_DEPTH_CM
        n_lo, n_hi = -sides[-1.0], sides[1.0]
        info["measured_to"] = "no wall piece at either end of the gap: the room loops from the door line"
    n_lo = max(n_lo, -INFILL_MAX_DEPTH_CM)
    n_hi = min(n_hi, INFILL_MAX_DEPTH_CM)
    if n_hi - n_lo < 2.0:
        n_lo, n_hi = -INFILL_DEFAULT_DEPTH_CM / 2.0, INFILL_DEFAULT_DEPTH_CM / 2.0
        info["note"] = "the measured body was under 2 cm; a default 15 cm body was used"
    u_lo, u_hi = -(reach[-1.0] + INFILL_OVERLAP_CM), reach[1.0] + INFILL_OVERLAP_CM
    return {"rect": oriented_rect(cx, cy, ux, uy, nx, ny, u_lo, u_hi, n_lo, n_hi),
            "z_cm": [0.0, float(ceiling_cm)], "n_range_cm": [round(n_lo, 3), round(n_hi, 3)],
            "u_range_cm": [round(u_lo, 3), round(u_hi, 3)], "measure": info}


def door_leaf(op, thick_cm):
    cx, cy, ux, uy, nx, ny = door_frame(op)
    hw = float(op["width_cm"]) / 2.0
    return {"rect": oriented_rect(cx, cy, ux, uy, nx, ny, -hw, hw, -thick_cm / 2.0, thick_cm / 2.0),
            "z_cm": [float(op["sill_cm"]), float(op["head_cm"])]}


def door_span_on_walls(plan, op):
    """Share of the opening's span whose cross-section (+-DOOR_SPAN_PROBE_CM) meets a wall polygon.
    A door drawn as a gap in the grey fill reads ~0; a door laid along a solid wall reads ~1. This is a
    PLAN-DATA measurement (does the trace put the door where the drawing has its gap?), reported as a
    warning, never a build failure."""
    cx, cy, ux, uy, nx, ny = door_frame(op)
    w = float(op["width_cm"])
    walls = wall_records(plan)
    steps = max(4, int(w))
    on = 0
    for i in range(steps):
        u = -w / 2.0 + (i + 0.5) * w / steps
        hit = False
        for v in range(-int(DOOR_SPAN_PROBE_CM), int(DOOR_SPAN_PROBE_CM) + 1, 2):
            px, py = cx + ux * u + nx * v, cy + uy * u + ny * v
            for _wid, poly, _h, bb in walls:
                if bb[0] <= px <= bb[2] and bb[1] <= py <= bb[3] and point_in_polygon((px, py), poly):
                    hit = True
                    break
            if hit:
                break
        on += 1 if hit else 0
    return on / steps


def _nearest_on_polygon(px, py, poly):
    best = None
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        dx, dy = bx - ax, by - ay
        l2 = dx * dx + dy * dy
        t = 0.0 if l2 < 1e-12 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
        qx, qy = ax + t * dx, ay + t * dy
        d = math.hypot(px - qx, py - qy)
        if best is None or d < best[2]:
            best = (qx, qy, d)
    return best


def _convex_hull(points):
    """Andrew's monotone chain; deterministic on sorted input."""
    pts = sorted(set((round(x, 6), round(y, 6)) for x, y in points))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for q in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], q) <= 0:
            lower.pop()
        lower.append(q)
    for q in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], q) <= 0:
            upper.pop()
        upper.append(q)
    return lower[:-1] + upper[:-1]


def pane_joints(plan):
    """Answer 2b, found on the first 846 render: a pane polygon whose END stops 1-3 cm short of the wall
    or pane it meets leaves a see-through slit in the envelope, full height (36 sky pixels at the top
    of one, on cp-living's first draft). At each end of every pane strip -- its farthest-apart vertex
    pair -- the nearest wall or other pane is measured from the end cap; a gap of 0 < d <= 
    PANE_JOINT_MAX_CM gets a post: the convex hull of the cap and its nearest points on the other side,
    grown by PANE_JOINT_OVERLAP_CM, extruded over the pane's own sill..head. A joint that already
    touches gets nothing. Plan order, a fixed tie-break: deterministic."""
    walls = [(wid, poly, bb) for wid, poly, _h, bb in wall_records(plan)]
    panes = [(p["id"], clean_ring(p["polygon_cm"]), float(p.get("sill_cm", 0.0)), float(p["head_cm"]))
             for p in plan.get("panes", [])]
    others_all = walls + [(pid, poly, bbox(poly)) for pid, poly, _s, _h in panes]
    out = []
    for pid, poly, sill, head in panes:
        n = len(poly)
        far = (-1.0, 0, 0)
        for i in range(n):
            for j in range(i + 1, n):
                d2 = (poly[i][0] - poly[j][0]) ** 2 + (poly[i][1] - poly[j][1]) ** 2
                if d2 > far[0] + 1e-9:
                    far = (d2, i, j)
        for k, idx in enumerate((far[1], far[2])):
            ex, ey = poly[idx]
            cap = [q for q in poly if math.hypot(q[0] - ex, q[1] - ey) <= PANE_JOINT_CAP_CM]
            ebb = (ex - 10.0, ey - 10.0, ex + 10.0, ey + 10.0)
            best = None
            touching = False
            for oid, opoly, obb in others_all:
                if oid == pid or not bbox_overlap(obb, ebb):
                    continue
                if any(point_in_polygon(q, opoly) for q in cap):
                    touching = True
                    break
                d = min(_nearest_on_polygon(q[0], q[1], opoly)[2] for q in cap)
                if best is None or d < best[0] - 1e-9:
                    best = (d, oid, opoly)
            if touching or best is None or best[0] <= 0.05 or best[0] > PANE_JOINT_MAX_CM:
                continue
            pts = list(cap) + [_nearest_on_polygon(q[0], q[1], best[2])[:2] for q in cap]
            hull = _convex_hull(pts)
            if len(hull) < 3:
                continue
            gx = sum(q[0] for q in hull) / len(hull)
            gy = sum(q[1] for q in hull) / len(hull)
            grown = []
            for qx, qy in hull:
                L = math.hypot(qx - gx, qy - gy) or 1.0
                grown.append((qx + (qx - gx) / L * PANE_JOINT_OVERLAP_CM, qy + (qy - gy) / L * PANE_JOINT_OVERLAP_CM))
            out.append({"id": f"{pid}_end{k}", "pane": pid, "to": best[1], "gap_cm": round(best[0], 2),
                        "z_cm": [sill, head], "poly": grown})
    return out


def _pane_cross_section(poly, pbb, cx, cy, ux, uy, nx, ny, u, n0, n1, step=0.25):
    """The n samples (door frame) at which the line u = const lies inside the pane, n0..n1."""
    out = []
    k = int(math.floor((n1 - n0) / step)) + 1
    for i in range(k):
        n = n0 + i * step
        px, py = cx + ux * u + nx * n, cy + uy * u + ny * n
        if pbb[0] <= px <= pbb[2] and pbb[1] <= py <= pbb[3] and point_in_polygon((px, py), poly):
            out.append(n)
    return out


def door_glass_frames(plan, op, frame_w_cm, frame_d_cm, cut_margin_cm, wall_top_cm):
    """Answer 2c. One record per pane a door-kind cutter really cuts (>= DOOR_GLASS_MIN_CM2 of the pane
    inside the cutter, on a 1 cm raster in the door's frame), plan order. A pane is FRAMED when the cut
    leaves a bare glass edge beside the door -- glass found DOOR_GLASS_SIDE_PROBE_CM outside one of the
    cutter's sides; a pane wholly inside the span (846's facade-4 sliver) is reported, not framed.
      * the pane's line: the least-squares line through its cells inside the cutter, n = a + b*u in the
        door's frame (centre_cm, angle_deg), re-centred on the glass's own spread about it;
      * two posts, frame_w along that line, CENTRED on the cutter's sides u = -+w/2: each bare glass end
        lies inside a post, never on one of its faces. Both posts are built even where the pane stops
        short of one side (o-13 ends at a joint post against the wall): a door frame has two jambs. The
        clear opening between them is width - frame_w;
      * a head across both, frame_w tall, centred on the door's head, when the pane rises above it; the
        posts stop at its underside (a butt joint: no two faces share a plane);
      * depth = max(frame_d, the glass's spread about the line -- its samples padded by half a 1 cm cell,
        which is the margin: 846's facade-11 carries a second strand and a hairline in the cut, 7.39 cm);
      * a post on the floor (sill 0) starts DOOR_GLASS_SINK_CM below it.
    Each record carries the parts' plan rectangles and z ranges and the enclosure, measured in 2-D: the
    glass's cross-section on each cut side inside its post, every cut cell inside the head."""
    if op["kind"] not in DOOR_FRAME_KINDS:
        return []
    cx, cy, ux, uy, nx, ny = door_frame(op)
    cut = door_cutter(op, cut_margin_cm, wall_top_cm)
    hw, hd = cut["half_width_cm"], cut["half_depth_cm"]
    sill, head = float(op["sill_cm"]), float(op["head_cm"])
    cbb = bbox(cut["rect"])
    fw = float(frame_w_cm)
    out = []
    for p in plan.get("panes", []):                                   # plan order
        poly = clean_ring(p["polygon_cm"])
        pbb = bbox(poly)
        psill, phead = float(p.get("sill_cm", 0.0)), float(p["head_cm"])
        if not bbox_overlap(pbb, cbb) or phead <= cut["z_cm"][0] or psill >= cut["z_cm"][1]:
            continue
        cells = []
        for i in range(int(math.floor(2.0 * hw))):
            u = -hw + 0.5 + i
            for j in range(int(math.floor(2.0 * hd))):
                n = -hd + 0.5 + j
                px, py = cx + ux * u + nx * n, cy + uy * u + ny * n
                if pbb[0] <= px <= pbb[2] and pbb[1] <= py <= pbb[3] and point_in_polygon((px, py), poly):
                    cells.append((u, n))
        if len(cells) < DOOR_GLASS_MIN_CM2:
            continue
        rec = {"opening": op["id"], "pane": p["id"], "cut_cm2": len(cells), "framed": False, "reason": None}
        side_glass = {}
        for tag, sgn in (("left", -1.0), ("right", 1.0)):
            outside = _pane_cross_section(poly, pbb, cx, cy, ux, uy, nx, ny,
                                          sgn * (hw + DOOR_GLASS_SIDE_PROBE_CM), -hd, hd)
            on_cut = _pane_cross_section(poly, pbb, cx, cy, ux, uy, nx, ny, sgn * hw, -hd, hd)
            side_glass[tag] = {"continues": bool(outside), "outside": outside, "on_cut": on_cut}
        above = phead > head + EPS
        rec["continues"] = {"left": side_glass["left"]["continues"], "right": side_glass["right"]["continues"],
                            "above_head": above}
        if not (side_glass["left"]["continues"] or side_glass["right"]["continues"]):
            rec["reason"] = ("the pane lies wholly inside the door's span: the cut leaves no glass edge "
                             "beside the door")
            out.append(rec)
            continue
        mu = sum(c[0] for c in cells) / len(cells)
        mn = sum(c[1] for c in cells) / len(cells)
        suu = sum((c[0] - mu) ** 2 for c in cells)
        b = sum((c[0] - mu) * (c[1] - mn) for c in cells) / suu if suu > EPS else 0.0
        ang = math.degrees(math.atan(b))
        if suu <= EPS or abs(ang) > DOOR_GLASS_MAX_ANGLE_DEG:
            rec["reason"] = f"the pane crosses the door line at {ang:.1f} deg (> {DOOR_GLASS_MAX_ANGLE_DEG}): not framed"
            out.append(rec)
            continue
        a = mn - b * mu
        k = math.sqrt(1.0 + b * b)
        # the glass's spread about the line, perpendicular to it: the cut cells (+- half a cell) and the
        # cross-sections at and just outside both cutter sides (the posts hold those)
        pts = list(cells)
        for tag, sgn in (("left", -1.0), ("right", 1.0)):
            pts += [(sgn * (hw + DOOR_GLASS_SIDE_PROBE_CM), n) for n in side_glass[tag]["outside"]]
            pts += [(sgn * hw, n) for n in side_glass[tag]["on_cut"]]
        res = [(n - (a + b * u)) / k for u, n in pts]
        lo, hi = min(res) - 0.5, max(res) + 0.5
        e_mid = (lo + hi) / 2.0
        half_d = max(float(frame_d_cm) / 2.0, (hi - lo) / 2.0)
        a2 = a + e_mid * k                                            # the frame's own line, re-centred
        dx, dy = (ux + b * nx) / k, (uy + b * ny) / k
        ex, ey = -dy, dx
        ox, oy = cx + nx * a2, cy + ny * a2                           # the frame line at door u = 0
        s_side = hw * k
        z0 = sill - DOOR_GLASS_SINK_CM if sill <= EPS else sill
        parts = []
        if above:
            post_top = head - fw / 2.0
            parts.append({"tag": "H", "s_cm": [-s_side - fw / 2.0, s_side + fw / 2.0],
                          "z_cm": [head - fw / 2.0, head + fw / 2.0]})
        else:
            post_top = min(head, phead)
        parts = [{"tag": "L", "s_cm": [-s_side - fw / 2.0, -s_side + fw / 2.0], "z_cm": [z0, post_top]},
                 {"tag": "R", "s_cm": [s_side - fw / 2.0, s_side + fw / 2.0], "z_cm": [z0, post_top]}] + parts
        for part in parts:
            part["rect"] = oriented_rect(ox, oy, dx, dy, ex, ey, part["s_cm"][0], part["s_cm"][1], -half_d, half_d)

        def to_plan(u, n):
            return (cx + ux * u + nx * n, cy + uy * u + ny * n)

        enc = {}
        for tag, sgn, ptag in (("left", -1.0, "L"), ("right", 1.0, "R")):
            on = side_glass[tag]["on_cut"]
            if not on:
                enc[f"{tag}_glass_edge"] = None                       # no glass on that cut side
                continue
            rect = next(q["rect"] for q in parts if q["tag"] == ptag)
            enc[f"{tag}_glass_edge"] = all(point_in_polygon(to_plan(sgn * hw, n), rect) for n in (min(on), max(on)))
        if above:
            hrect = next(q["rect"] for q in parts if q["tag"] == "H")
            inside = sum(1 for u, n in cells if point_in_polygon(to_plan(u, n), hrect))
            enc["head_cells"] = [inside, len(cells)]
        rec.update({
            "framed": True,
            "line": {"angle_to_door_deg": round(ang, 3),
                     "n_at_left_cm": round(a2 - b * hw, 3), "n_at_right_cm": round(a2 + b * hw, 3),
                     "glass_spread_cm": [round(lo - e_mid, 3), round(hi - e_mid, 3)]},
            "face_cm": fw, "depth_cm": round(2.0 * half_d, 3),
            "clear_width_cm": round(2.0 * hw - fw, 3),
            "clear_height_cm": round((head - fw / 2.0) - sill, 3) if above else round(post_top - sill, 3),
            "parts": [{"tag": q["tag"], "s_cm": [round(v, 3) for v in q["s_cm"]], "z_cm": q["z_cm"],
                       "rect": q["rect"]} for q in parts],
            "enclosure": enc})
        out.append(rec)
    return out


# ====================================================================================== the fill
def _raster_polygon(mask, poly, x0, y0, res):
    """Even-odd scanline fill: a cell is in the polygon iff its CENTRE is."""
    import numpy as np
    h, w = mask.shape
    xs = np.array([(p[0] - x0) / res for p in poly], dtype=np.float64)
    ys = np.array([(p[1] - y0) / res for p in poly], dtype=np.float64)
    xs2, ys2 = np.roll(xs, -1), np.roll(ys, -1)
    j0 = max(0, int(math.floor(ys.min())))
    j1 = min(h - 1, int(math.ceil(ys.max())))
    for j in range(j0, j1 + 1):
        yc = j + 0.5
        sel = ((ys <= yc) & (ys2 > yc)) | ((ys2 <= yc) & (ys > yc))
        if not sel.any():
            continue
        xa, ya, xb, yb = xs[sel], ys[sel], xs2[sel], ys2[sel]
        xi = np.sort(xa + (yc - ya) * (xb - xa) / (yb - ya))
        for k in range(0, len(xi) - 1, 2):
            i0 = int(math.ceil(xi[k] - 0.5))
            i1 = int(math.floor(xi[k + 1] - 0.5))
            if i1 >= i0:
                mask[j, max(i0, 0):min(i1, w - 1) + 1] = True


def _dilate(m, r):
    out = m.copy()
    for s in range(1, r + 1):
        out[:, s:] |= m[:, :-s]
        out[:, :-s] |= m[:, s:]
    mid = out.copy()
    for s in range(1, r + 1):
        out[s:, :] |= mid[:-s, :]
        out[:-s, :] |= mid[s:, :]
    return out


def _exterior(free):
    """Cells of `free` 4-connected to the raster border."""
    import numpy as np
    seeds = np.zeros_like(free)
    seeds[0, :] = seeds[-1, :] = True
    seeds[:, 0] = seeds[:, -1] = True
    return _reach(free, seeds & free)


def _reach(free, seeds):
    """Cells of `free` 4-connected to any cell of `seeds` (row-run union-find; deterministic)."""
    import numpy as np
    h, w = free.shape
    parent = []

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            if ra < rb:
                parent[rb] = ra
            else:
                parent[ra] = rb

    runs = []
    prev = []
    for j in range(h):
        d = np.diff(np.concatenate(([0], free[j].astype(np.int8), [0])))
        starts, ends = np.flatnonzero(d == 1).tolist(), np.flatnonzero(d == -1).tolist()
        cur = []
        p = 0
        for s, e in zip(starts, ends):
            rid = len(parent)
            parent.append(rid)
            runs.append((j, s, e))
            cur.append((s, e, rid))
            while p < len(prev) and prev[p][1] <= s:
                p += 1
            q = p
            while q < len(prev) and prev[q][0] < e:
                union(rid, prev[q][2])
                q += 1
        prev = cur
    hit = set()
    for rid, (j, s, e) in enumerate(runs):
        if seeds[j, s:e].any():
            hit.add(find(rid))
    out = np.zeros_like(free)
    for rid, (j, s, e) in enumerate(runs):
        if find(rid) in hit:
            out[j, s:e] = True
    return out


def _rects(mask, x0, y0, res):
    """Row runs merged vertically into rectangles, in plan cm, sorted."""
    import numpy as np
    h = mask.shape[0]
    out = []
    open_runs = {}
    for j in range(h + 1):
        if j < h:
            d = np.diff(np.concatenate(([0], mask[j].astype(np.int8), [0])))
            cur = set(zip(np.flatnonzero(d == 1).tolist(), np.flatnonzero(d == -1).tolist()))
        else:
            cur = set()
        for key in sorted(set(open_runs) - cur):
            js = open_runs.pop(key)
            out.append((x0 + key[0] * res, y0 + js * res, x0 + key[1] * res, y0 + j * res))
        for key in sorted(cur - set(open_runs)):
            open_runs[key] = j
    out.sort()
    return out


def fill_regions(plan, extra_solids, floor_class_of, ceiling_barriers=None):
    """Answer 3. `extra_solids` = plan-cm polygons that are solid footprints the plan does not list
    (facings, infills, leaves, posts); `floor_class_of(room)` = the floor material key of a room;
    `ceiling_barriers` = the footprints that stand to the ceiling (see the module docstring: the sky is
    the flood from the outdoor rooms they stop). Returns the floor rectangles per material key, the
    ceiling rectangles and the numbers the report carries."""
    import numpy as np
    polys = ([clean_ring(r["loop"]) for r in plan["rooms"]]
             + [clean_ring(w["polygon_cm"]) for w in plan["walls"]]
             + [clean_ring(p["polygon_cm"]) for p in plan.get("panes", [])]
             + [list(s) for s in extra_solids])
    xs = [p[0] for poly in polys for p in poly]
    ys = [p[1] for poly in polys for p in poly]
    res = FILL_RES_CM
    x0 = math.floor(min(xs) - FILL_MARGIN_CM)
    y0 = math.floor(min(ys) - FILL_MARGIN_CM)
    w = int(math.ceil((max(xs) + FILL_MARGIN_CM - x0) / res))
    h = int(math.ceil((max(ys) + FILL_MARGIN_CM - y0) / res))
    solid = np.zeros((h, w), dtype=bool)
    for poly in polys:
        if len(poly) >= 3:
            _raster_polygon(solid, poly, x0, y0, res)
    r = FILL_CLOSE_CELLS
    closed = ~_dilate(~_dilate(solid, r), r)
    free = ~closed
    ext = _exterior(free)
    holes = free & ~ext
    fill = closed | holes

    rooms = plan["rooms"]
    lab = np.zeros((h, w), dtype=np.int32)
    for idx, room in enumerate(rooms):
        m = np.zeros((h, w), dtype=bool)
        _raster_polygon(m, clean_ring(room["loop"]), x0, y0, res)
        lab[m] = idx + 1
    iters = 0
    for iters in range(1, FILL_LABEL_MAX_ITER + 1):
        un = fill & (lab == 0)
        if not un.any():
            break
        new = lab.copy()
        for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0)):      # left, right, up, down -- fixed order
            src = np.zeros_like(lab)
            if dx == -1:
                src[:, 1:] = lab[:, :-1]
            elif dx == 1:
                src[:, :-1] = lab[:, 1:]
            elif dy == -1:
                src[1:, :] = lab[:-1, :]
            else:
                src[:-1, :] = lab[1:, :]
            take = un & (new == 0) & (src > 0)
            new[take] = src[take]
        if np.array_equal(new, lab):
            break
        lab = new
    indoor = np.zeros(len(rooms) + 1, dtype=bool)
    cls_idx = np.zeros(len(rooms) + 1, dtype=np.int32)
    names = []
    for idx, room in enumerate(rooms):
        c = floor_class_of(room)
        if c not in names:
            names.append(c)
        cls_idx[idx + 1] = names.index(c)
        indoor[idx + 1] = not room.get("is_outdoor")
    if not names:
        names.append("floor")
    cls_map = cls_idx[lab]
    classes = {}
    for k, name in enumerate(names):
        classes[name] = _rects(fill & (cls_map == k) & (lab > 0), x0, y0, res)
    unlabelled = fill & (lab == 0)
    if unlabelled.any():                        # a fill cell no room reaches: the first room's class
        classes[names[0]] = sorted(classes[names[0]] + _rects(unlabelled, x0, y0, res))
    if ceiling_barriers is not None:
        bar = np.zeros((h, w), dtype=bool)
        for poly in ceiling_barriers:
            if len(poly) >= 3:
                _raster_polygon(bar, list(poly), x0, y0, res)
        indoor_cells = np.zeros((h, w), dtype=bool)
        open_cells = np.zeros((h, w), dtype=bool)      # unroofed outdoor rooms: the sky's own seeds
        roofed_cells = np.zeros((h, w), dtype=bool)    # roofed outdoor rooms: under a deck, never sky
        for room in rooms:
            target = (indoor_cells if not room.get("is_outdoor") else
                      roofed_cells if room.get("roofed") else open_cells)
            _raster_polygon(target, clean_ring(room["loop"]), x0, y0, res)
        bar = ~_dilate(~_dilate(bar, FILL_CLOSE_CELLS), FILL_CLOSE_CELLS)   # a slot < 13 cm between barriers is shut
        passable = fill & ~bar & ~_dilate(indoor_cells, FILL_INDOOR_GUARD_CELLS) & ~roofed_cells
        edge = fill & _dilate(~fill, 1)                # fill cells on the building's outline
        sky = _reach(passable, (open_cells | edge) & passable)
        ceil_mask = fill & ~sky & ~open_cells
        sky_cells = int(sky.sum())
    else:
        ceil_mask = fill & indoor[lab]
        sky_cells = None
    return {"res_cm": res, "origin_cm": [x0, y0], "size_cells": [w, h],
            "close_cells": r, "label_iterations": iters,
            "cells": {"solid": int(solid.sum()), "closed": int(closed.sum()),
                      "holes_filled": int(holes.sum()), "fill": int(fill.sum()),
                      "ceiling": int(ceil_mask.sum()), "sky": sky_cells,
                      "unlabelled": int(unlabelled.sum())},
            "ceiling_rule": ("sky = flood from the outdoor rooms stopped by full-height barriers and indoor "
                             "rooms" if ceiling_barriers is not None else "nearest room is indoor"),
            "floor_rects": classes, "ceiling_rects": _rects(ceil_mask, x0, y0, res)}


# ================================================================================== the luminaires
def luminaire_point(loop, cameras):
    """Answer 4: the deepest 5 cm grid point of `loop` standing LUMINAIRE_CAMERA_GAP_CM clear of every
    camera (x, y) given, with LUMINAIRE_MIN_CLEAR_CM to the loop; relaxed in that order when a small
    room cannot honour both. Returns (x, y, clearance_cm, rule)."""
    import numpy as np
    loop = clean_ring(loop)
    bx0, by0, bx1, by1 = bbox(loop)
    g = LUMINAIRE_GRID_CM
    gx = np.arange(bx0 + g / 2.0, bx1, g)
    gy = np.arange(by0 + g / 2.0, by1, g)
    if not len(gx) or not len(gy):
        return (bx0 + bx1) / 2.0, (by0 + by1) / 2.0, 0.0, "bbox centre (room smaller than one grid step)"
    gxx, gyy = np.meshgrid(gx, gy)
    px, py = gxx.ravel(), gyy.ravel()
    inside = np.zeros(px.shape, dtype=bool)
    dist = np.full(px.shape, np.inf)
    n = len(loop)
    for i in range(n):
        ax, ay = loop[i]
        bx, by = loop[(i + 1) % n]
        cond = (ay > py) != (by > py)
        with np.errstate(divide="ignore", invalid="ignore"):
            xint = (bx - ax) * (py - ay) / (by - ay) + ax
        inside ^= cond & (px < xint)
        dx, dy = bx - ax, by - ay
        l2 = dx * dx + dy * dy
        if l2 < 1e-12:
            d = np.hypot(px - ax, py - ay)
        else:
            t = np.clip(((px - ax) * dx + (py - ay) * dy) / l2, 0.0, 1.0)
            d = np.hypot(px - ax - t * dx, py - ay - t * dy)
        dist = np.minimum(dist, d)
    camd = np.full(px.shape, np.inf)
    for cx, cy in cameras:
        camd = np.minimum(camd, np.hypot(px - cx, py - cy))
    tiers = [(inside & (dist >= LUMINAIRE_MIN_CLEAR_CM) & (camd >= LUMINAIRE_CAMERA_GAP_CM),
              f"deepest point >= {LUMINAIRE_CAMERA_GAP_CM:.0f} cm from every camera"),
             (inside & (camd >= LUMINAIRE_CAMERA_GAP_CM / 2.0),
              f"deepest point >= {LUMINAIRE_CAMERA_GAP_CM / 2:.0f} cm from every camera (relaxed)"),
             (inside, "deepest point (camera gap not honoured: the room is too small)")]
    for mask, rule in tiers:
        if mask.any():
            score = np.where(mask, dist, -1.0)
            k = int(np.argmax(score))
            return float(px[k]), float(py[k]), float(dist[k]), rule
    return (bx0 + bx1) / 2.0, (by0 + by1) / 2.0, 0.0, "bbox centre (no grid point inside the loop)"


# ===================================================================================== the selftest
def selftest():
    """Pure checks that need no plan: a known polygon's raster area, the closing and hole fill, the
    facing of a room 3 cm off a wall, the infill of a door in a gap. Exit 0 = all pass."""
    import numpy as np
    fails = []

    def ok(cond, what):
        print(f"  [{'PASS' if cond else 'FAIL'}] {what}")
        if not cond:
            fails.append(what)

    # 1. a 100 x 50 rectangle rasterises to 5000 cells; a right triangle to ~half its box
    m = np.zeros((80, 140), dtype=bool)
    _raster_polygon(m, [(10, 10), (110, 10), (110, 60), (10, 60)], 0, 0, 1.0)
    ok(int(m.sum()) == 5000, f"rectangle raster 5000 cells (got {int(m.sum())})")
    m[:] = False
    _raster_polygon(m, [(10, 10), (110, 10), (10, 60)], 0, 0, 1.0)
    ok(abs(int(m.sum()) - 2500) <= 60, f"triangle raster ~2500 cells (got {int(m.sum())})")
    # 2. two rooms 6 cm apart close into one floor; the ceiling stops at the outdoor one
    plan = {"rooms": [
        {"id": "r-a", "is_outdoor": False, "loop": [[0, 0], [100, 0], [100, 100], [0, 100]],
         "edge_kinds": ["wall", "open", "line", "line"]},
        {"id": "r-b", "is_outdoor": True, "loop": [[106, 0], [200, 0], [200, 100], [106, 100]],
         "edge_kinds": ["wall", "line", "line", "open"]}],
        "walls": [{"id": "w-n", "height_cm": 290,
                   "polygon_cm": [[-20, -23], [220, -23], [220, -3], [-20, -3]]}],
        "panes": [], "openings": []}
    out = fill_regions(plan, [], lambda r: "floor_outdoor" if r["is_outdoor"] else "floor")
    ok(out["cells"]["unlabelled"] == 0, "every fill cell carries a room label")
    ok(out["cells"]["fill"] >= 200 * 100 + 6 * 100, f"the 6 cm bar is floored ({out['cells']['fill']} cells)")
    ceil = sum((x1 - x0) * (y1 - y0) for x0, y0, x1, y1 in out["ceiling_rects"])
    ok(10000 <= ceil <= 10000 + 6 * 100 + 23 * 130, f"the ceiling stops near the outdoor room ({ceil} cm2)")
    # 3. the facing of a room whose north edge sits 3 cm off a wall: front on the edge, 5 cm deep
    runs = facings(plan)
    north = [r for r in runs if r["room_id"] == "r-a" and r["edge"] == 0]
    ok(len(north) == 1 and abs(north[0]["band_cm"][1] - 3.0) < 1e-6
       and abs(north[0]["depth_cm"] - 5.0) < 1e-6 and north[0]["outward"][1] < 0,
       f"facing: band 3 cm, depth 5 cm, outward toward -y "
       f"({[(r['band_cm'], r['depth_cm'], r['outward']) for r in north]})")
    ok(not [r for r in runs if r["room_id"] == "r-a" and r["edge"] != 0],
       "no facing on an edge that is not a wall edge")
    # 3b. a wall of two fragments with a 4 cm gap behind one edge: ONE facing run, the slit bridged
    plan_b = {"rooms": [{"id": "r-a", "is_outdoor": False, "loop": [[0, 0], [100, 0], [100, 100], [0, 100]],
                         "edge_kinds": ["wall", "line", "line", "line"]}],
              "walls": [{"id": "w-1", "height_cm": 290, "polygon_cm": [[-20, -23], [48, -23], [48, -3], [-20, -3]]},
                        {"id": "w-2", "height_cm": 290, "polygon_cm": [[52, -23], [120, -23], [120, -3], [52, -3]]}]}
    rb = [r for r in facings(plan_b) if r["edge"] == 0]
    ok(len(rb) == 1 and abs(rb[0]["length_cm"] - 100.0) < 1e-6 and rb[0]["bridged_cm_on_edge"] > 0,
       f"a 4 cm gap between wall fragments is bridged into one facing ({[(r['length_cm'], r['bridged_cm_on_edge']) for r in rb]})")
    # 4. a door in the gap of a 20 cm wall between two rooms: infill flush with both loops
    plan2 = {"rooms": [
        {"id": "r-a", "is_outdoor": False, "loop": [[0, 0], [300, 0], [300, 100], [0, 100]]},
        {"id": "r-b", "is_outdoor": False, "loop": [[0, 124], [300, 124], [300, 300], [0, 300]]}],
        "walls": [{"id": "w-1", "height_cm": 290, "polygon_cm": [[0, 102], [100, 102], [100, 122], [0, 122]]},
                  {"id": "w-2", "height_cm": 290,
                   "polygon_cm": [[190, 102], [300, 102], [300, 122], [190, 122]]}]}
    op = {"id": "d-1", "kind": "door", "rooms": ["r-a", "r-b"], "centre_cm": [145, 102],
          "angle_deg": 0.0, "width_cm": 90.0, "sill_cm": 0, "head_cm": 215}
    inf = door_infill(plan2, op, 290)
    ok(abs(inf["n_range_cm"][0] + 2.0 - INFILL_FACE_RECESS_CM) < 1e-6
       and abs(inf["n_range_cm"][1] - 22.0 + INFILL_FACE_RECESS_CM) < 1e-6,
       f"infill = the wall body + the bands, {INFILL_FACE_RECESS_CM} cm short of both loops: "
       f"n {inf['n_range_cm']} (want [-1.9, 21.9])")
    ok(door_span_on_walls(plan2, op) == 0.0, "a door in the gap: 0 % of its span on walls")
    ok(abs(door_span_on_walls(plan2, dict(op, centre_cm=[100, 102])) - 0.5) < 0.05,
       "a door slid half a width along its axis: ~50 % of its span on walls")
    x, y, clear, rule = luminaire_point(plan2["rooms"][1]["loop"], [(150.0, 212.0)])
    ok(math.hypot(x - 150.0, y - 212.0) >= LUMINAIRE_CAMERA_GAP_CM and clear >= LUMINAIRE_MIN_CLEAR_CM,
       f"luminaire clear of the camera and the walls ({x:.1f}, {y:.1f}, {clear:.1f} cm, {rule})")
    # 5. the sky rule: indoor | 3 cm glass | 12 cm cavity | 3 cm glass | outdoor -- the cavity is under the
    #    slab (the nearest-room rule split it and left its outer half open: the 846 cp-living leak)
    plan3 = {"rooms": [
        {"id": "r-in", "is_outdoor": False, "loop": [[0, 0], [100, 0], [100, 100], [0, 100]]},
        {"id": "r-out", "is_outdoor": True, "loop": [[120, 0], [220, 0], [220, 100], [120, 100]]}],
        "walls": [{"id": "w-n", "height_cm": 290, "polygon_cm": [[-20, -20], [240, -20], [240, -2], [-20, -2]]},
                  {"id": "w-s", "height_cm": 290, "polygon_cm": [[-20, 102], [240, 102], [240, 120], [-20, 120]]}],
        "panes": [{"id": "g-in", "kind": "facade", "head_cm": 290, "polygon_cm": [[101, -2], [102, -2], [102, 102], [101, 102]]},
                  {"id": "g-out", "kind": "facade", "head_cm": 290, "polygon_cm": [[115, -2], [116, -2], [116, 102], [115, 102]]}],
        "openings": []}
    bars = [p["polygon_cm"] for p in plan3["panes"]] + [w["polygon_cm"] for w in plan3["walls"]]
    out3 = fill_regions(plan3, [], lambda r: "floor", ceiling_barriers=bars)
    ceil3 = np.zeros((out3["size_cells"][1], out3["size_cells"][0]), dtype=bool)
    ox, oy = out3["origin_cm"]
    for x0r, y0r, x1r, y1r in out3["ceiling_rects"]:
        ceil3[int(y0r - oy):int(y1r - oy), int(x0r - ox):int(x1r - ox)] = True
    cavity = ceil3[int(50 - oy), int(108 - ox)]
    outside = ceil3[int(50 - oy), int(117 - ox)]
    ok(bool(cavity) and not bool(outside),
       f"sky rule: the cavity between two facade lines is under the slab ({bool(cavity)}), "
       f"the band beyond the outer glass is open ({not bool(outside)})")
    # 6. the same section with the outdoor room ROOFED (OQ-G4): the room and the closed cavity get the slab
    plan4 = dict(plan3, rooms=[plan3["rooms"][0], dict(plan3["rooms"][1], roofed=True)])
    out4 = fill_regions(plan4, [], lambda r: "floor", ceiling_barriers=bars)
    ceil4 = np.zeros((out4["size_cells"][1], out4["size_cells"][0]), dtype=bool)
    ox4, oy4 = out4["origin_cm"]
    for x0r, y0r, x1r, y1r in out4["ceiling_rects"]:
        ceil4[int(y0r - oy4):int(y1r - oy4), int(x0r - ox4):int(x1r - ox4)] = True
    ok(bool(ceil4[int(50 - oy4), int(170 - ox4)]) and bool(ceil4[int(50 - oy4), int(108 - ox4)]),
       "roofed outdoor room: under the deck, and the cavity stays under the slab")
    # 7. answer 2c: a door cut through a 3 cm pane gets two posts centred on the cut sides and a head
    glass = {"id": "g-1", "kind": "facade", "sill_cm": 0, "head_cm": 290,
             "polygon_cm": [[0, -1.5], [400, -1.5], [400, 1.5], [0, 1.5]]}
    plan5 = {"rooms": [], "walls": [], "panes": [glass]}
    door = {"id": "d-g", "kind": "door", "rooms": [], "centre_cm": [200, 0], "angle_deg": 0.0,
            "width_cm": 100.0, "sill_cm": 0, "head_cm": 215}
    fr = door_glass_frames(plan5, door, 6.0, 7.0, 8.0, 290)
    f0 = fr[0] if fr else {}
    tags = {q["tag"]: q for q in f0.get("parts", [])}
    ok(len(fr) == 1 and f0.get("framed") and sorted(tags) == ["H", "L", "R"]
       and tags["L"]["s_cm"] == [-53.0, -47.0] and tags["R"]["s_cm"] == [47.0, 53.0]
       and tags["H"]["z_cm"] == [212.0, 218.0] and tags["L"]["z_cm"] == [-1.0, 212.0]
       and abs(f0["depth_cm"] - 7.0) < 1e-9 and abs(f0["clear_width_cm"] - 94.0) < 1e-9,
       f"door in glass: posts centred on the cut sides, head on the door head, 7 cm deep "
       f"({[(q['tag'], q['s_cm'], q['z_cm']) for q in f0.get('parts', [])]}, depth {f0.get('depth_cm')})")
    ok(f0.get("enclosure") == {"left_glass_edge": True, "right_glass_edge": True, "head_cells": [300, 300]},
       f"door in glass: both bare glass ends and every cut cell inside the frame ({f0.get('enclosure')})")
    # 8. the door line 25 cm off the glass it cuts (846's o-13): the frame stands in the GLASS line
    fr8 = door_glass_frames(plan5, dict(door, centre_cm=[200, -25]), 6.0, 7.0, 8.0, 290)
    ok(len(fr8) == 1 and fr8[0]["framed"] and abs(fr8[0]["line"]["n_at_left_cm"] - 25.0) < 0.3
       and abs(fr8[0]["line"]["n_at_right_cm"] - 25.0) < 0.3,
       f"door line off the glass: the frame follows the pane ({fr8[0]['line'] if fr8 else None})")
    # 9. a door 45 cm off the glass (outside its cutter) and a pane wholly inside the span
    ok(door_glass_frames(plan5, dict(door, centre_cm=[200, -45]), 6.0, 7.0, 8.0, 290) == [],
       "a door whose cutter misses the pane: no record")
    sliver = {"id": "g-s", "kind": "facade", "sill_cm": 0, "head_cm": 290,
              "polygon_cm": [[170, -1], [230, -1], [230, 1], [170, 1]]}
    fr9 = door_glass_frames({"panes": [sliver]}, door, 6.0, 7.0, 8.0, 290)
    ok(len(fr9) == 1 and not fr9[0]["framed"] and fr9[0]["continues"]["left"] is False,
       f"a pane wholly inside the span: reported, not framed ({fr9[0]['reason'] if fr9 else None})")
    print(f"selftest {'PASS' if not fails else 'FAIL'} ({len(fails)} failure(s))")
    return 0 if not fails else 1


def main(argv):
    ap = argparse.ArgumentParser(prog="plan_general.py", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan", nargs="?", help="a general plan.json: print the facing / opening analysis")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args(argv)
    if args.selftest:
        return selftest()
    if not args.plan:
        ap.error("give a plan.json or --selftest")
    with open(args.plan, "r", encoding="utf-8") as f:
        plan = json.load(f)
    if not is_general(plan):
        print("not a general plan (no geometry: \"general\") - nothing to analyse")
        return 0
    ceiling = float(plan["plan_meta"]["ceiling_height_cm"])
    runs = facings(plan, note=print)
    print(f"plan_general.py v{VERSION}  {len(runs)} facing run(s)")
    for rid, c in facing_coverage(plan, runs).items():
        print(f"  {rid:20s} wall edges {c['wall_edge_cm']:7.1f} cm, faced {c['faced_cm']:7.1f} cm "
              f"({100 * (c['share'] or 0):5.1f} %)")
    for op in plan["openings"]:
        if is_virtual_opening(op, ceiling):
            print(f"  {op['id']:6s} {op['kind']:14s} virtual (head {op['head_cm']} = ceiling): nothing built")
            continue
        inf = door_infill(plan, op, ceiling)
        print(f"  {op['id']:6s} {op['kind']:14s} infill n {inf['n_range_cm']}  "
              f"span on walls {100 * door_span_on_walls(plan, op):5.1f} %")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

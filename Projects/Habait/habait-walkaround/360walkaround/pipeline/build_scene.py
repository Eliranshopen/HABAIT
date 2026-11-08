#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_scene.py v1 -- plan.json -> a Blender scene, headless, deterministic.

Board `360-v2` T06. v0 (T03) built ONE room as a probe. v1 builds the WHOLE apartment: every wall
once (no z-fighting, no per-room filtering), every door/window boolean cut through the real
neighbouring geometry (T03's PROBECAP -- a fake box closing a virtual boundary from outside -- is
gone; a virtual boundary is now genuinely open onto the real room next door), a floor+ceiling per
room (balconies get a floor, no ceiling -- they are open to the sky above the parapet, same as a
real uncovered balcony), a terrain plane so a window ray has something plausible to hit, materials
from the new `materials_kit` module (split out of this file so T12's style catalog has ONE place to
extend), and a coverage light in every windowless indoor room so a draft render is legible instead
of black. The single-room probe mode (`--room <id>`) is KEPT for debugging -- it is what T03/T04/T05
already used and there is no reason to break it -- `--room all` is the new default and the v1 path.

v1.2 (2026-10-28, D-WQ-28 / WALKAROUND-QUALITY-PLAN Q01b): a plan whose `geometry` (or
`plan_meta.geometry`) is "general" takes its own branch -- walls extruded from `polygon_cm`, facings at the
traced faces, a door infill + an oriented cutter per cut opening, `panes[]` as extruded glass, a raster
floor/ceiling fill, a luminaire per indoor room and NO furniture -- whose 2-D decisions all live in
`plan_general.py` (read its docstring first). The rectilinear statements are untouched and run in the same
order (guards only), so the pilot builds the same scene data: `probe/dump_scene.py` proves it.

v1.4 (2026-10-29, WALKAROUND-QUALITY-PLAN OQ-2, D-WQ-33): the floor carries the REAL tile grid. When the
apartment has a material board (`Habait/tour360/apartments/<apartment_id>/material-board.json`, the
material words of the skin, D-WQ-22), every floor class is `materials_kit.floor_tile()`: one procedural
grid in WORLD space from the plan origin, turned to the walls, so a joint runs straight through every
opening -- the AI skin had invented every grout line over the oak planks, and they bent in the viewer.
No board (the pilot) or `--material-board none` builds the v1.3 floor, statement for statement.

v1.5 (2026-10-29, D-WQ-36): a general plan is FURNISHED with real catalog models. The skin had been painted
over grey placeholder masses, so what one room showed of the next was that room's invention and every walk
landed in a different apartment; now the apartment exists once, furnished, and every camera sees the same
pieces. `general_furnish.py` decides every piece (the plan's `fixtures[]` fitted with catalog models or
procedural closets/showers, the new `furnishing` extension's hints and pieces, derived chairs, nightstands,
uppers, mirrors) and every interior door (lining, architraves, a leaf ajar where a camera sees the doorway,
lever handles) -- this file only executes it. `--general-furnish off` builds the v1.4 placeholder masses (the
control). The rectilinear path is untouched (guards only): the pilot's scene dump is byte-identical.

    PYTHONIOENCODING=utf-8 \
    "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b --factory-startup \
      -P D:/AgentTeams/RealEstateTeam/360walkaround/pipeline/build_scene.py -- \
      D:/AgentTeams/RealEstateTeam/360walkaround/tours/pilot-karnei/plan.json \
      --out D:/AgentTeams/RealEstateTeam/360walkaround/tours/pilot-karnei/scene-full.blend

Exit 0 = built, saved, and every geometry + camera-clearance check inside tolerance. Exit 1 = a
check failed (strict).

--------------------------------------------------------------------------------------------------
THE THREE FRAME CONTRACTS (unchanged since T03 -- see ENV.md §9 for the derivation)
--------------------------------------------------------------------------------------------------
1. UNITS.   `plan.json` is centimetres everywhere. Blender is metres. The ONLY conversion is /100,
            applied in `wx()`/`wy()`/`wz()`.
2. FRAME.   plan is LEFT-handed 2-D: +x right, +y DOWN on the drawing. World is Z-up right-handed.
                world_X = +x_cm / 100      world_Y = -y_cm / 100      world_Z = +z_cm / 100
            so world +Y is plan-north and handedness is preserved.
3. YAW.     plan `yaw_deg`: 0 = toward -y (plan-north), 90 = toward +x (plan-east), clockwise.
            dir_world = (sin(yaw), cos(yaw), 0); camera rotation_euler = (90deg, 0, -yaw_deg) in
            Blender's default XYZ order.
--------------------------------------------------------------------------------------------------
THE CAMERA RECONCILE POLICY (T06 -- the full rule and its reasoning live in `place_cameras.py`,
this is the one-paragraph pointer the task asks to keep in this file's header too): authored seeds
(T02's 9 curated points) are KEPT verbatim; every INDOOR room still lacking one gets exactly the
count REPORT §2.1 measures (1, +1 per started 15 sq m above 20 sq m -- inert on this plan, every
room needing the rule is under 20 sq m); outdoor rooms get zero, always. `place_cameras.py` is what
WRITES `plan.json`'s `camera_points[]` -- this file only ever READS whatever is already there and
builds ONE Blender camera OBJECT positioned at a deterministic default seed (render_pano.py
re-points that single object per camera_points[] entry at render time; a .blend does not need N
camera objects for N panorama points, ENV.md/T04).
--------------------------------------------------------------------------------------------------

Rails honoured here: $0 (local Blender + CC0 assets only) - determinism (no randomness anywhere,
every collection iterated in plan/file order, every name derived from an id) - SCHEMA is consumed
AS WRITTEN (footprint wall rectangles, interior-face room polygons, never reshaped, C-360-81) -
`plan_meta.assumptions[]` is carried verbatim into the report so "ceiling 260 ASSUMED" (F-360-114)
survives into every downstream artifact, never silently upgraded to fact.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from datetime import datetime, timezone

import bpy  # noqa: E402  (Blender-provided)
from mathutils import Vector  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

SCRIPT_PATH = os.path.abspath(__file__)
sys.path.insert(0, os.path.dirname(SCRIPT_PATH))  # so `import materials_kit` / `place_cameras` works
                                                    # under `blender -P` regardless of Blender's own
                                                    # sys.path defaults (not documented, so pinned).
import materials_kit  # noqa: E402
import place_cameras  # noqa: E402
import placement_templates  # noqa: E402
import plan_general  # noqa: E402  (v1.2: the 2-D half of the general-polygon path, D-WQ-28)
import general_furnish  # noqa: E402  (v1.5: the 2-D half of furnishing a general plan, D-WQ-36)

VERSION = "1.5.0"

REPO_360 = os.path.dirname(os.path.dirname(SCRIPT_PATH))     # .../360walkaround
DEFAULT_STYLE = os.path.join(REPO_360, "catalog", "style-habait-modern.json")
HARNESS_ROOT = os.path.dirname(REPO_360)                       # v1.4: the material boards live under it

# ----------------------------------------------------------------------------------------------
# Architectural constants. Since v1.1 (T12) every FURNISHING and LIGHTING number lives in the style
# lock (`catalog/style-habait-modern.json`), not here: a style change is a release, and a release is
# a new version of a data file, never an edit of this script (root CLAUDE.md §2).
# ----------------------------------------------------------------------------------------------

MM = 0.001                 # the acceptance tolerance for plan-vs-mesh geometry checks: 1 mm
CAMERA_MIN_CLEARANCE_CM = 40.0   # the task's own bar: no camera within this of a wall face/furniture
CUT_MARGIN_CM = 8.0        # boolean cutters overshoot the wall thickness by this much per side
GLASS_THICK_CM = 0.8       # a real pane, so refraction enters AND exits (no net image shift)
DOOR_LEAF_THICK_CM = 4.5   # T13: the entrance door's SOLID leaf -- an open hole in the envelope let
                           # cp-entry see 200 m of terrain and open sky out of the flat's front door
FRAME_W_CM = 6.0           # glazing frame face width
FRAME_D_CM = 7.0           # glazing frame depth (through the wall)
CAP_THICK_CM = 10.0        # probe-only cap placed OUTSIDE a virtual boundary (single-room mode only)
SKIRT_H_CM = 7.0           # skirting board height
SKIRT_D_CM = 1.6           # skirting board projection from the wall face
OPTS = {"skirting": True}  # --skirting off (Habait studio, Eliran 2026-11-01): the floor meets the wall with no board

# Sun: a plausible Israeli late-morning sun, stated as a plan bearing so it reads off the drawing.
SUN_AZIMUTH_PLAN_DEG = 165.0    # bearing you look along to SEE the sun (165 = SSE -> south glazing)
SUN_ELEVATION_DEG = 52.0
SUN_ENERGY = 4.0                # W/m^2 on top of the HDRI's own (EV-capped) sun
SUN_ANGLE_DEG = 0.526           # real solar disc

HDRI_STRENGTH = 1.0
HDRI_ROT_Z_DEG = 145.0          # rotates the environment so its own sun roughly agrees with SUN_*

# The terrain plane: exists ONLY so a window ray that escapes the building lands on something
# plausible instead of the void below the horizon. NOT a claim about the real site (there is no
# survey/site plan in this pipeline) -- an assumption, logged as one, same discipline as
# plan_meta.assumptions[] (F-360-114) even though it is a build-time choice, not a trace one.
TERRAIN_SIZE_CM = 20000.0       # 200 m square -- always far bigger than this apartment's footprint
TERRAIN_Z_CM = -300.0           # ASSUMED ~1 floor below this unit (apt 6 is floor 2) -- ~3 m/floor
TERRAIN_EDGE_BELOW_HORIZON_DEG = 2.0   # v1.2: with plan_meta.ground_offset_cm, the plane's edge sits this low

# ⭐ THE T07 CEILING-CLIP FIX, in one place (the numbers themselves live in the style lock's
# `lighting.ceiling_luminaire`). T06 hung a bare POINT light 15 cm under the ceiling at each
# windowless room's DEEPEST POINT -- which is exactly where `place_cameras.py` puts that room's
# camera. Illuminance on the ceiling goes as 1/d^2, and at d = 0.15 m it blew out: T07 measured the
# zenith polar row of `cp-wc` and `cp-master-lobby` as pure white 255, one unique colour, and had to
# replace an over-eager "a constant polar row is a defect" assertion because of it.
# The fix is not a smaller number, it is a different EMITTER: a Cycles AREA light emits from its
# FRONT FACE only, so a disc mounted flush against the ceiling and facing straight DOWN puts NO
# direct light on the ceiling at any position or power. The visible fixture is a separate thin disc
# with a mild emission, so the zenith still reads as a luminaire instead of as a hot spot. Rooms
# that get a real pendant MODEL keep a point bulb inside the shade instead -- 70+ cm of hang, which
# T06/T04 already rendered without clipping in r-living.
LUMINAIRE_FALLBACK = {          # used only if the style lock carries no `lighting` block
    "kind": "AREA", "shape": "DISK", "size_cm": 34.0, "hang_below_ceiling_cm": 2.0,
    "energy_w": "40 + 6 * area_m2", "color": [1.0, 0.88, 0.74], "visible_camera": False,
    "fixture_disc": {"diameter_cm": 36.0, "thickness_cm": 1.2, "emission_strength": 0.8,
                     "material": "lamp_shade"},
}
DAYLIGHT_PANEL_MIN_APERTURE_CM = 200.0   # a soft panel only where the glazing is genuinely wide


def luminaire_energy_w(expr, area_m2: float) -> float:
    """Evaluate the lock's own energy rule. Deliberately NOT `eval`: two shapes are supported, a
    bare number and the `a + b * area_m2` form the lock uses, and anything else is a data error."""
    if isinstance(expr, (int, float)):
        return round(float(expr), 1)
    txt = str(expr).replace(" ", "")
    if "+" in txt and "*area_m2" in txt:
        a, rest = txt.split("+", 1)
        b = rest.replace("*area_m2", "")
        return round(float(a) + float(b) * area_m2, 1)
    raise SystemExit(f"style lock: cannot read the luminaire energy rule {expr!r}")


# ----------------------------------------------------------------------------------------------
# plan-frame -> world helpers. Everything geometric in this file goes through these four.
# ----------------------------------------------------------------------------------------------

def wx(x_cm: float) -> float:
    return x_cm / 100.0


def wy(y_cm: float) -> float:
    return -y_cm / 100.0


def wz(z_cm: float) -> float:
    return z_cm / 100.0


def plan_yaw_to_rz(yaw_deg: float, front_local: str = "-Y") -> float:
    """World Z-rotation (radians) that makes `front_local` point along the plan bearing `yaw_deg`."""
    y = math.radians(yaw_deg)
    if front_local == "-Y":
        return math.pi - y
    if front_local == "+Y":
        return -y
    if front_local == "+X":
        return math.pi / 2.0 - y
    if front_local == "-X":
        return -(math.pi / 2.0 + y)
    raise ValueError(f"front_local must be one of +X -X +Y -Y, got {front_local!r}")


# ----------------------------------------------------------------------------------------------
# tiny mesh factory
# ----------------------------------------------------------------------------------------------

def new_box(name, x0, y0, x1, y1, z0, z1, material=None, collection=None):
    """An axis-aligned box from PLAN cm (x0<x1, y0<y1, z0<z1). Object origin at the world origin,
    so mesh-local coordinates ARE world coordinates -> every later measurement is direct."""
    X0, X1 = wx(x0), wx(x1)
    Y0, Y1 = wy(y1), wy(y0)          # note the swap: plan y grows down, world Y grows up
    Z0, Z1 = wz(z0), wz(z1)
    verts = [
        (X0, Y0, Z0), (X1, Y0, Z0), (X1, Y1, Z0), (X0, Y1, Z0),
        (X0, Y0, Z1), (X1, Y0, Z1), (X1, Y1, Z1), (X0, Y1, Z1),
    ]
    faces = [
        (0, 3, 2, 1),  # bottom (-Z)
        (4, 5, 6, 7),  # top    (+Z)
        (0, 1, 5, 4),  # -Y
        (1, 2, 6, 5),  # +X
        (2, 3, 7, 6),  # +Y
        (3, 0, 4, 7),  # -X
    ]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    if material is not None:
        ob.data.materials.append(material)
    (collection or bpy.context.scene.collection).objects.link(ob)
    return ob


def new_slab_face(name, loop_cm, z_cm, normal_up, material=None):
    """A single flat n-gon at height z from a plan polygon (a room's interior-face loop, or an
    arbitrary quad for the terrain plane)."""
    verts = [(wx(px), wy(py), wz(z_cm)) for px, py in loop_cm]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], [list(range(len(verts)))])
    me.validate()
    me.update()
    me.calc_loop_triangles()
    poly = me.polygons[0]
    want = 1.0 if normal_up else -1.0
    if poly.normal.z * want < 0:                      # deterministic: flip only if wrong
        me.flip_normals()
    ob = bpy.data.objects.new(name, me)
    if material is not None:
        ob.data.materials.append(material)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def loop_inward_sign(loop_cm):
    """+1 if the interior lies to the LEFT of each directed edge, -1 if to the right.

    SCHEMA 4 promises simple, rectilinear, positively-oriented loops, so one shoelace sign settles
    the inward direction for every edge at once -- no centroid test (which breaks on the L-shaped
    and 14-vertex rooms this plan actually contains)."""
    a = 0.0
    n = len(loop_cm)
    for i in range(n):
        x0, y0 = loop_cm[i]
        x1, y1 = loop_cm[(i + 1) % n]
        a += x0 * y1 - x1 * y0
    return 1.0 if a > 0 else -1.0


def build_skirting(loop_cm, material, tag):
    """One box per loop edge, inset into the room. Openings that reach the floor are cut out of
    these by the same boolean cutters that cut the walls."""
    s = loop_inward_sign(loop_cm)
    out = []
    n = len(loop_cm)
    for i in range(n):
        x0, y0 = loop_cm[i]
        x1, y1 = loop_cm[(i + 1) % n]
        dx, dy = x1 - x0, y1 - y0
        nx, ny = (-dy, dx) if s > 0 else (dy, -dx)      # inward normal, unnormalised
        if abs(dx) < 1e-9 and abs(dy) < 1e-9:
            continue
        if abs(dx) < 1e-9:                              # vertical edge: x constant
            d = SKIRT_D_CM * (1.0 if nx > 0 else -1.0)
            ax0, ax1 = sorted((x0, x0 + d))
            ay0, ay1 = sorted((y0, y1))
        else:                                           # horizontal edge: y constant
            d = SKIRT_D_CM * (1.0 if ny > 0 else -1.0)
            ay0, ay1 = sorted((y0, y0 + d))
            ax0, ax1 = sorted((x0, x1))
        out.append(new_box(f"SKIRT_{tag}_{i}", ax0, ay0, ax1, ay1, 0.0, SKIRT_H_CM, material))
    return out


def bake_modifiers(ob):
    """Apply every modifier by evaluating the depsgraph (no operator context, no selection state)."""
    if not ob.modifiers:
        return
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    new_me = bpy.data.meshes.new_from_object(ev)
    new_me.name = ob.data.name + "_baked"
    old = ob.data
    ob.modifiers.clear()
    ob.data = new_me
    bpy.data.meshes.remove(old)


def mesh_bbox(ob):
    """(min, max) Vectors of the object's mesh in world space (objects here sit at the origin)."""
    mn = Vector((1e18, 1e18, 1e18))
    mx = Vector((-1e18, -1e18, -1e18))
    mw = ob.matrix_world
    for v in ob.data.vertices:
        w = mw @ v.co
        for i in range(3):
            mn[i] = min(mn[i], w[i])
            mx[i] = max(mx[i], w[i])
    return mn, mx


def mesh_bvh(ob):
    """A BVHTree over the object's mesh, IN WORLD SPACE. Returns None for a fully boolean-consumed
    object (0 polygons left).

    ⛔ v1.1 fix. Every object this file BUILDS sits at the world origin, so `v.co` and world space
    coincide and the T03/T06 version simply read `ob.data.vertices` -- correct for walls, and
    silently WRONG for an imported model, whose vertices are placed by a scaled/rotated/translated
    parent empty. With one probe sofa nobody noticed; with 60-odd catalog pieces the camera-clearance
    check would have been measuring furniture at the origin, i.e. measuring nothing. `matrix_world`
    is applied here, once, and the caller runs `view_layer.update()` before verifying so the parent
    chain is evaluated rather than cached-stale."""
    polys = [list(p.vertices) for p in ob.data.polygons]
    if not polys:
        return None
    mw = ob.matrix_world
    verts = [mw @ v.co for v in ob.data.vertices]
    return BVHTree.FromPolygons(verts, polys)


# ----------------------------------------------------------------------------------------------
# furniture
# ----------------------------------------------------------------------------------------------

def load_style(path, log):
    """Read the style lock and state, in the log, what is being locked."""
    with open(path, "r", encoding="utf-8") as f:
        style = json.load(f)
    log(f"style     '{style['style_name']}' v{style['version']} ({os.path.basename(path)}) - "
        f"{len(style['models'])} model(s), {len(style['classes'])} class(es), "
        f"{len(style['palette'])} palette material(s)")
    log(f"  {style['ruling_state'].splitlines()[0]}")
    return style


def find_material_board(arg, plan, log):
    """v1.4 (OQ-2): the material board of the apartment (D-WQ-22, the words the skin is prompted with)
    sets the tile grid of the floor. `auto` = Habait/tour360/apartments/<apartment_id>/material-board.json
    under the harness root, when it exists (the pilot has none and builds its v1.3 floor); `none` = the
    style lock floor, the control; anything else is a path that must exist. Returns (record, board): the
    record goes into the report `inputs`, and render_tour.mjs re-reads its path, so an edited, added or
    removed board makes the scene stale. `words` (filled by build) holds the board values the floor read:
    render_tour.mjs compares those, so a prompt edit elsewhere in the board re-keys nothing."""
    if arg == "none":
        log("floor     --material-board none: the style lock floor (the v1.3 scene, kept as the control)")
        return {"mode": "none", "path": None, "sha256": None, "words": None}, None
    if arg == "auto":
        path = os.path.join(HARNESS_ROOT, "Habait", "tour360", "apartments", str(plan.get("apartment_id")),
                            "material-board.json")
    else:
        path = os.path.abspath(arg)
        if not os.path.exists(path):
            raise SystemExit(f"--material-board {arg}: no such file")
    try:
        rel = os.path.relpath(path, HARNESS_ROOT)
    except ValueError:                                  # another drive: the absolute path is the record
        rel = path
    if rel.startswith(".."):
        rel = path
    rec = {"mode": "auto" if arg == "auto" else "path", "path": rel.replace(os.sep, "/"), "sha256": None,
           "words": None}
    if not os.path.exists(path):
        log(f"floor     no material board at {rec['path']} - the style lock floor")
        return rec, None
    with open(path, "r", encoding="utf-8") as f:
        board = json.load(f)
    rec["sha256"] = sha256_file(path)
    return rec, board


def verify_model_hashes(style, model_ids, log):
    """⛔ RAIL 4, enforced at build time: every model the style locks is re-hashed off disk and must
    match the sha256 recorded in the lock. A mismatch is a BUILD FAILURE, not a warning -- a scene
    built from a silently-changed asset is not the scene the lock describes."""
    records, bad, missing = [], [], []
    for mid in sorted(model_ids):
        spec = style["models"][mid]
        path = os.path.join(REPO_360, spec["file"].replace("/", os.sep))
        rec = {"model": mid, "file": spec["file"], "expected_sha256": spec["sha256"]}
        if not os.path.exists(path):
            rec["state"] = "MISSING"
            missing.append(mid)
        else:
            got = sha256_file(path)
            rec["sha256"] = got
            rec["state"] = "verified" if got == spec["sha256"] else "MISMATCH"
            if got != spec["sha256"]:
                bad.append(mid)
        records.append(rec)
    log(f"catalog   {len(records) - len(bad) - len(missing)}/{len(records)} locked model(s) "
        f"hash-verified against {os.path.basename(DEFAULT_STYLE)}")
    if missing:
        raise SystemExit(f"catalog files missing ({', '.join(missing)}) - run "
                         f"`node 360walkaround/catalog/fetch.mjs`")
    if bad:
        raise SystemExit(f"catalog hash MISMATCH on {', '.join(bad)} - the file on disk is not the "
                         f"one this style version locks (rail 4)")
    return records


def import_glb(path, tag, log):
    """Import a .glb and parent every mesh object to one empty. glTF is Y-up; Blender's importer
    converts to Z-up, which is why every model in the lock faces local -Y (see the lock's own
    `front_axis_note`)."""
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=path)
    new = [bpy.data.objects[n] for n in sorted(set(bpy.data.objects.keys()) - before)]
    meshes = [o for o in new if o.type == "MESH" and o.data and len(o.data.vertices)]
    if not meshes:
        raise RuntimeError(f"{path}: no MESH object found")
    # bake each mesh's own transform into its vertices, then drop the importer's empties, so the
    # group is one flat set of objects whose local coords ARE world coords (the invariant every
    # measurement in this file relies on -- T03).
    dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(o.matrix_world)
        old = o.data
        o.data = me
        o.parent = None
        o.matrix_world.identity()
        if old.users == 0:
            bpy.data.meshes.remove(old)
    for o in new:
        if o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)
    empty = bpy.data.objects.new(f"FURN_{tag}", None)
    empty.empty_display_size = 0.2
    bpy.context.scene.collection.objects.link(empty)
    for o in meshes:
        if o.name not in bpy.context.scene.collection.objects:
            bpy.context.scene.collection.objects.link(o)
        o.parent = empty
        o.matrix_parent_inverse.identity()
    log(f"      imported {len(meshes)} mesh object(s) from glb: "
        f"{', '.join(sorted(o.name for o in meshes)[:6])}")
    return empty, meshes


def apply_style_materials(objs, spec, style, palette_mats, log):
    """Rebind a model's own material NAMES to the style palette (`material_policy: restyle`).

    ⭐ This is the whole answer to `catalog/RESEARCH.md` §8's coherence risk. The Kenney/Quaternius
    models carry no image textures at all -- just named materials (`carpet`, `wood`, `metal`,
    `carpetWhite`, ...) -- so binding those names to real PBR finishes turns a flat game-asset into
    a matte-fabric sofa standing next to a photoreal Poly Haven armchair. It is the reference's
    "style is a model-name suffix" idea one layer down (REPORT §2.5). Poly Haven rows are
    `keep_source`: their own 2K PBR maps ARE the style there.

    ⭐ T13 — `keep_source` is now PARTIALLY overridable, and it had to be. The policy was all-or-
    nothing, so a Poly Haven model with one bad slot could only be fixed by restyling ALL of it and
    throwing its good PBR maps away. `hanging_picture_frame_01` is exactly that case: its frame and
    glass are correct, and its `_artwork` slot ships a PLACEHOLDER print reading
    *"Ray Hopes / Photo: 76cm x 51cm / Frame: 84cm x 59cm"* — legible at 1:1 in six rooms of a
    delivered tour (found by eye on the T13 finals, and only visible at all because F-360-159 had
    just lowered the frame to eye level). So: under `keep_source`, a non-empty `material_overrides`
    rebinds **only the slots it names** and every other slot stays exactly as the CC0 author made it.
    ⛔ Under `keep_source` an override key that matches nothing is an ERROR, not a shrug — a silent
    no-op is how a "fixed" placeholder ships anyway."""
    policy = spec.get("material_policy")
    overrides = spec.get("material_overrides", {})
    if policy != "restyle" and not overrides:
        return []
    mapping = style["material_map"] if policy == "restyle" else {}
    swapped = []
    for ob in sorted(objs, key=lambda o: o.name):
        for i, mat in enumerate(ob.data.materials):
            src = mat.name if mat else "_defaultMat"
            base = src.split(".")[0]                       # Blender's ".001" duplicate suffix
            target = overrides.get(base) or mapping.get(base)
            if target is None:
                if policy == "restyle":
                    log(f"      WARN material '{src}' has no style mapping - left as authored")
                continue
            ob.data.materials[i] = palette_mats[target]
            swapped.append((base, target))
    if policy != "restyle":
        hit = {b for b, _ in swapped}
        missed = sorted(set(overrides) - hit)
        if missed:
            raise SystemExit(
                f"style lock: model {spec.get('catalog_row')} is `keep_source` and names "
                f"material_overrides {missed} that no material slot on the imported model carries. "
                f"A partial override that matches nothing is a silent no-op — fix the name.")
    return swapped


def append_model(blend_path, tag, log):
    """Append every MESH object from a CC0 .blend, parent them to one empty, return (empty, objs).

    Blender rewrites the library's `//textures/...` image paths to absolute on append (measured on
    4.5.10) -- the caller re-relativises them against the OUTPUT .blend before saving."""
    before = set(bpy.data.objects.keys())
    with bpy.data.libraries.load(blend_path, link=False) as (df, dt):
        dt.objects = sorted(df.objects)
    new = [bpy.data.objects[n] for n in sorted(set(bpy.data.objects.keys()) - before)]
    meshes = [o for o in new if o.type == "MESH"]
    for o in new:
        if o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)
    if not meshes:
        raise RuntimeError(f"{blend_path}: no MESH object found")

    empty = bpy.data.objects.new(f"FURN_{tag}", None)
    empty.empty_display_size = 0.2
    bpy.context.scene.collection.objects.link(empty)
    for o in meshes:
        if o.name not in bpy.context.scene.collection.objects:
            bpy.context.scene.collection.objects.link(o)
        o.parent = empty
        o.matrix_parent_inverse.identity()
    log(f"      appended {len(meshes)} mesh object(s): {', '.join(o.name for o in meshes)}")
    return empty, meshes


def group_bbox(objs):
    mn = Vector((1e18, 1e18, 1e18))
    mx = Vector((-1e18, -1e18, -1e18))
    for o in objs:
        mw = o.matrix_world
        for v in o.data.vertices:
            w = mw @ v.co
            for i in range(3):
                mn[i] = min(mn[i], w[i])
                mx[i] = max(mx[i], w[i])
    return mn, mx


def place_model(empty, objs, x_cm, y_cm, yaw_deg, anchor, front_local, ceiling_cm,
                scale_xyz=(1.0, 1.0, 1.0), z_cm=None):
    """Scale, rotate and position a model group: footprint centre at (x,y), and its bottom (or top,
    for a ceiling anchor) at the anchor height.

    The empty's transform is T·R·S, so a child point p lands at T + R·(S·p). The group's bbox is
    measured RAW (every child is at identity by construction, T03's invariant) and scaled
    arithmetically -- never by reading `matrix_world` back after setting the parent's scale, which
    would need a depsgraph round-trip and is exactly the kind of implicit state a deterministic
    builder must not depend on."""
    mn, mx = group_bbox(objs)                       # measured BEFORE any transform (identity so far)
    sx, sy, sz = scale_xyz
    smn = Vector((mn.x * sx, mn.y * sy, mn.z * sz))
    smx = Vector((mx.x * sx, mx.y * sy, mx.z * sz))
    cx, cy = (smn.x + smx.x) / 2.0, (smn.y + smx.y) / 2.0
    if anchor == "ceiling":
        target_z, az = wz(ceiling_cm), smx.z
    elif anchor in ("wall", "on_top"):
        target_z, az = wz(z_cm or 0.0), smn.z
    else:
        target_z, az = 0.0, smn.z
    rz = plan_yaw_to_rz(yaw_deg, front_local)
    c, s = math.cos(rz), math.sin(rz)
    target = Vector((wx(x_cm), wy(y_cm), target_z))
    empty.scale = (sx, sy, sz)
    empty.rotation_euler = (0.0, 0.0, rz)
    empty.location = Vector((target.x - (c * cx - s * cy),
                             target.y - (s * cx + c * cy),
                             target.z - az))
    return {"raw_bbox_size_m": [round(mx[i] - mn[i], 6) for i in range(3)],
            "scaled_bbox_size_m": [round(smx[i] - smn[i], 6) for i in range(3)],
            "scale_xyz": [round(v, 6) for v in scale_xyz],
            "rot_z_deg": round(math.degrees(rz), 6),
            "location_m": [round(v, 6) for v in empty.location]}


def add_t06_point_light(room, ceiling_cm, x_cm, y_cm, log):
    """⛔ SUPERSEDED — T06's bare point light, 15 cm under the ceiling, kept ONLY behind
    `--luminaire t06-point` as the CONTROL for the T12 fix. Keeping the defect reproducible is what
    turns "we fixed the ceiling clip" from a claim into a measurement: same scene, same camera, same
    encoder, one variable. Never the default; the report records which one built the scene."""
    tag = room["id"]
    energy = round(40.0 + float(room["area_m2"]) * 4.0, 1)
    z = ceiling_cm - 15.0
    ld = bpy.data.lights.new(f"L_cov_{tag}", type="POINT")
    ld.energy = energy
    ld.color = (1.00, 0.86, 0.70)
    ld.shadow_soft_size = 0.12
    ob = bpy.data.objects.new(f"L_cov_{tag}", ld)
    ob.location = (wx(x_cm), wy(y_cm), wz(z))
    ob.visible_camera = False
    bpy.context.scene.collection.objects.link(ob)
    log(f"light     L_cov_{tag:17s} POINT {energy:6.1f} W at plan ({x_cm:7.1f}, {y_cm:7.1f}, "
        f"{z:6.1f}) cm  [⛔ T06 CONTROL - the emitter whose ceiling clip T12 fixed]")
    return {"room_id": tag, "kind": "POINT_T06_CONTROL", "energy_w": energy,
            "plan_xyz_cm": [round(x_cm, 1), round(y_cm, 1), round(z, 1)],
            "why": "--luminaire t06-point: the superseded emitter, for the A/B"}


def add_ceiling_luminaire(room, spec, ceiling_cm, x_cm, y_cm, palette_mats, log):
    """A flush, DOWNWARD-FACING area disc plus a visible fixture disc. See the LUMINAIRE_FALLBACK
    comment for why this shape and not T06's point light: a Cycles area light emits from its front
    face only, and a Blender area light's front face is its local -Z, so an unrotated one mounted at
    the ceiling lights the room and CANNOT light the ceiling above it."""
    tag = room["id"]
    energy = luminaire_energy_w(spec.get("energy_w", "40 + 6 * area_m2"), float(room["area_m2"]))
    z = ceiling_cm - float(spec.get("hang_below_ceiling_cm", 2.0))
    ld = bpy.data.lights.new(f"L_ceil_{tag}", type="AREA")
    ld.shape = "DISK"
    ld.size = float(spec.get("size_cm", 34.0)) / 100.0
    ld.energy = energy
    ld.color = tuple(spec.get("color", (1.0, 0.88, 0.74)))
    ob = bpy.data.objects.new(f"L_ceil_{tag}", ld)
    ob.location = (wx(x_cm), wy(y_cm), wz(z))
    ob.rotation_euler = (0.0, 0.0, 0.0)              # emits straight down; nothing reaches the ceiling
    ob.visible_camera = bool(spec.get("visible_camera", False))
    bpy.context.scene.collection.objects.link(ob)

    disc = spec.get("fixture_disc") or {}
    disc_ob = None
    if disc:
        d = float(disc.get("diameter_cm", 36.0))
        t = float(disc.get("thickness_cm", 1.2))
        me = bpy.data.meshes.new(f"FIXTURE_{tag}")
        verts, faces = [], []
        n = 24                                        # fixed segment count -> deterministic mesh
        for k in range(n):
            a = 2.0 * math.pi * k / n
            px, py = math.cos(a) * d / 200.0, math.sin(a) * d / 200.0
            verts.append((wx(x_cm) + px, wy(y_cm) + py, wz(ceiling_cm - t)))
        for k in range(n):
            a = 2.0 * math.pi * k / n
            px, py = math.cos(a) * d / 200.0, math.sin(a) * d / 200.0
            verts.append((wx(x_cm) + px, wy(y_cm) + py, wz(ceiling_cm)))
        faces.append(list(range(n))[::-1])
        faces.append(list(range(n, 2 * n)))
        for k in range(n):
            faces.append([k, (k + 1) % n, n + (k + 1) % n, n + k])
        me.from_pydata(verts, [], faces)
        me.validate()
        me.update()
        disc_ob = bpy.data.objects.new(f"FIXTURE_{tag}", me)
        mat = palette_mats.get(disc.get("material", "lamp_shade"))
        if mat is not None:
            disc_ob.data.materials.append(mat)
        bpy.context.scene.collection.objects.link(disc_ob)
    log(f"light     L_ceil_{tag:16s} AREA/DISK {energy:6.1f} W facing DOWN at plan "
        f"({x_cm:7.1f}, {y_cm:7.1f}, {z:6.1f}) cm  [T12: flush, so the ceiling cannot clip]")
    return {"room_id": tag, "kind": "AREA_DISK_DOWN", "energy_w": energy,
            "plan_xyz_cm": [round(x_cm, 1), round(y_cm, 1), round(z, 1)],
            "fixture_object": disc_ob.name if disc_ob else None,
            "why": "flush downward luminaire (T07 ceiling-clip fix)"}


def add_pendant_bulb(room, spec, x_cm, y_cm, bulb_z_cm, log):
    """The point bulb inside a pendant shade. Safe where a bare ceiling point light is not, because
    the shade hangs 70+ cm below the slab (T04/T06 rendered exactly this in r-living without a clip)."""
    tag = room["id"]
    ld = bpy.data.lights.new(f"L_bulb_{tag}", type="POINT")
    # ⭐ T13: the pendant bulb reads the SAME `a + b * area_m2` rule the ceiling luminaire already
    #    used. It was a bare 30.0 W for every room, so the four LARGEST rooms in the pilot (living
    #    15.9, dining 15.8, master 11.8, bed-2 9.1 m² — the ones a buyer looks at longest) were the
    #    only ones NOT area-scaled, and rendered at mean luma 76-123 while the seven small
    #    ceiling-disk rooms sat at 138-198. The law was inverted, not the wattage merely low.
    #    `luminaire_energy_w` accepts a bare number unchanged, so an old lock still builds.
    ld.energy = luminaire_energy_w(spec.get("energy_w", 30.0), float(room["area_m2"]))
    ld.color = tuple(spec.get("color", (1.0, 0.86, 0.70)))
    ld.shadow_soft_size = float(spec.get("shadow_soft_size_cm", 10.0)) / 100.0
    ob = bpy.data.objects.new(f"L_bulb_{tag}", ld)
    ob.location = (wx(x_cm), wy(y_cm), wz(bulb_z_cm))
    ob.visible_camera = bool(spec.get("visible_camera", False))
    bpy.context.scene.collection.objects.link(ob)
    log(f"light     L_bulb_{tag:16s} POINT {ld.energy:6.1f} W inside the pendant at plan "
        f"({x_cm:7.1f}, {y_cm:7.1f}, {bulb_z_cm:6.1f}) cm")
    return {"room_id": tag, "kind": "POINT_IN_SHADE", "energy_w": ld.energy,
            "plan_xyz_cm": [round(x_cm, 1), round(y_cm, 1), round(bulb_z_cm, 1)],
            "why": "the pendant model's own bulb"}


def add_daylight_panels(plan, rooms, spec, log):
    """A soft area panel just inside any aperture wider than DAYLIGHT_PANEL_MIN_APERTURE_CM.

    Cycles has had no light portals since 3.0, so a room lit through one wide opening keeps a noisy
    interior at draft sample counts (T03). Generalised from T06's hand-authored r-living entry: the
    rule now reads the plan instead of naming a room."""
    out = []
    byroom = {r["id"]: r for r in rooms}
    for op in plan["openings"]:                       # plan order -> deterministic
        if op["kind"] not in ("window", "sliding_door", "glazed_door"):
            continue
        if float(op["width_cm"]) < DAYLIGHT_PANEL_MIN_APERTURE_CM:
            continue
        inside = [rid for rid in op.get("rooms", []) if rid in byroom and not byroom[rid]["is_outdoor"]]
        if not inside:
            continue
        rid = sorted(inside)[0]
        room = byroom[rid]
        wall = next(w for w in plan["walls"] if w["id"] == op["wall_id"])
        wx0, wy0, wx1, wy1 = wall["rect_cm"]
        cx0, cy0, cx1, cy1 = room["bbox_cm"]
        if op["axis"] == "x":
            px = (op["start_cm"] + op["end_cm"]) / 2.0
            wall_y = (wy0 + wy1) / 2.0
            inward = 1.0 if (cy0 + cy1) / 2.0 > wall_y else -1.0
            py = wall_y + inward * 25.0
            yaw = 0.0 if inward > 0 else 180.0
        else:
            py = (op["start_cm"] + op["end_cm"]) / 2.0
            wall_x = (wx0 + wx1) / 2.0
            inward = 1.0 if (cx0 + cx1) / 2.0 > wall_x else -1.0
            px = wall_x + inward * 25.0
            yaw = 90.0 if inward > 0 else 270.0
        ld = bpy.data.lights.new(f"L_day_{op['id']}", type="AREA")
        ld.shape = "SQUARE"
        ld.size = float(spec.get("size_cm", 220.0)) / 100.0
        ld.energy = float(spec.get("energy_w", 35.0))
        ld.color = tuple(spec.get("color", (0.86, 0.92, 1.0)))
        ob = bpy.data.objects.new(f"L_day_{op['id']}", ld)
        ob.location = (wx(px), wy(py), wz((float(op["sill_cm"]) + float(op["head_cm"])) / 2.0))
        ob.rotation_euler = (math.radians(90.0), 0.0, math.radians(-yaw))
        ob.visible_camera = bool(spec.get("visible_camera", False))
        bpy.context.scene.collection.objects.link(ob)
        log(f"light     {ob.name:22s} AREA {ld.energy:5.1f} W inside {op['id']} "
            f"({op['width_cm']:.0f} cm wide) for {rid}")
        out.append({"opening": op["id"], "room_id": rid, "energy_w": ld.energy,
                    "plan_xyz_cm": [round(px, 1), round(py, 1)],
                    "why": f"aperture {op['width_cm']:.0f} cm >= "
                           f"{DAYLIGHT_PANEL_MIN_APERTURE_CM:.0f} cm (no portals in Cycles)"})
    return out


def build_wall_floor_fillers(walls, wall_objs, kit, log):
    """A floor-coloured filler slab under EVERY built wall's own footprint, at z=0.

    ⭐ Found by eye (T06, the cp-wc smoke render): a room's floor slab is exactly the room's own
    `loop` (its interior wall face) -- it never extends INTO the wall's footprint. Two adjacent
    rooms' floors therefore meet only at the wall's near/far faces, with the wall's own thickness
    as a gap between them. Normally that gap is filled by the opaque wall solid; but a door is cut
    all the way down to `sill_cm == 0`, so at a doorway's exact span there is NO floor (neither
    room's slab reaches it) and NO wall (the cut removed it) -- a ray straight down through the
    threshold fell all the way to the terrain plane 3 m below (a green sliver in the render). The
    general fix is on the WALL, not on any one room's floor polygon (which SCHEMA guarantees is
    rectilinear but not necessarily convex, so "just extend the loop" is not a trivial op for every
    room shape): one thin slab per wall, sized to that wall's own `rect_cm`, sitting under it. A
    wall's opaque solid covers this filler everywhere except exactly where a door is cut -- which is
    exactly where it is needed."""
    n = 0
    for wid in wall_objs:
        x0, y0, x1, y1 = walls[wid]["rect_cm"]
        new_slab_face(f"FLOORFILL_{wid}", [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], 0.0, True,
                      kit["floor"])
        n += 1
    log(f"built     {n} wall-footprint floor filler(s) at z=0 cm - closes the threshold gap a "
        f"floor-level door cut would otherwise leave between two rooms' own floor slabs")
    return n


def rooms_with_daylight_opening(plan):
    lit = set()
    for op in plan["openings"]:
        if op["kind"] in ("window", "sliding_door", "glazed_door"):
            lit.update(op.get("rooms", []))
    return lit


def build_terrain(plan, kit, log):
    """A single large flat ground plane well below the apartment, so a ray that escapes through a
    window lands on something plausible instead of the void. Assumption, logged as one (§ header)."""
    x0 = min(r["bbox_cm"][0] for r in plan["rooms"])
    y0 = min(r["bbox_cm"][1] for r in plan["rooms"])
    x1 = max(r["bbox_cm"][2] for r in plan["rooms"])
    y1 = max(r["bbox_cm"][3] for r in plan["rooms"])
    ccx, ccy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    ground = (plan.get("plan_meta") or {}).get("ground_offset_cm")
    if ground is not None:
        # v1.2 (OQ-G3): the plan says where the street is. A tower floor's ground is far below, so the
        # plane grows until its edge sits TERRAIN_EDGE_BELOW_HORIZON_DEG under the horizon, and the camera's
        # clip distance follows it (a plane cut at 200 m would show the bare HDRI below the horizon).
        z = float(ground)
        half = max(TERRAIN_SIZE_CM / 2.0, abs(z) / math.tan(math.radians(TERRAIN_EDGE_BELOW_HORIZON_DEG)))
        loop = [(ccx - half, ccy - half), (ccx + half, ccy - half),
                (ccx + half, ccy + half), (ccx - half, ccy + half)]
        ob = new_slab_face("TERRAIN_ground", loop, z, True, kit["terrain"])
        clip_m = math.ceil(half * 1.5 / 100.0 + 100.0)
        log(f"built     {ob.name:20s} {2 * half / 100:.0f} x {2 * half / 100:.0f} m at z={z:.0f} cm  "
            f"<- plan_meta.ground_offset_cm (the unit's own height above the street); camera clip {clip_m} m")
        return ob, {"size_cm": round(2 * half, 1), "z_cm": z, "centre_plan_cm": [ccx, ccy],
                    "z_source": "plan_meta.ground_offset_cm", "clip_end_m": clip_m,
                    "edge_below_horizon_deg": TERRAIN_EDGE_BELOW_HORIZON_DEG,
                    "assumption": "a flat ground at the plan's ground offset; the site itself (streets, "
                                  "neighbours) is not modelled"}
    half = TERRAIN_SIZE_CM / 2.0
    loop = [(ccx - half, ccy - half), (ccx + half, ccy - half),
            (ccx + half, ccy + half), (ccx - half, ccy + half)]
    ob = new_slab_face("TERRAIN_ground", loop, TERRAIN_Z_CM, True, kit["terrain"])
    log(f"built     {ob.name:20s} {TERRAIN_SIZE_CM / 100:.0f} x {TERRAIN_SIZE_CM / 100:.0f} m "
        f"at z={TERRAIN_Z_CM:.0f} cm  [ASSUMED offset - one floor below apt {ccx:.0f},{ccy:.0f}]")
    return ob, {"size_cm": TERRAIN_SIZE_CM, "z_cm": TERRAIN_Z_CM, "centre_plan_cm": [ccx, ccy],
                "assumption": "z offset is an assumed ~1 floor below this unit (apt 6 is floor 2); "
                               "no site/section data exists to derive it"}


# ==============================================================================================
# THE GENERAL-POLYGON PATH (v1.2, D-WQ-28 / WALKAROUND-QUALITY-PLAN Q01b)
# Every 2-D decision is plan_general.py's (read its docstring first: the stroke band, the facings, the
# infills, the fill); this block only turns those decisions into meshes, in plan order, with the same
# materials, the same CUT_MARGIN_CM and the same EXACT-boolean cutter law as the rectilinear path.
# ==============================================================================================

def world_ring(points_cm):
    """A plan-cm ring as a world-XY ring, counter-clockwise seen from +Z (so `new_prism` faces point out).
    The plan frame is y-DOWN, so a positive plan loop arrives clockwise and is reversed here."""
    ring = [(wx(float(x)), wy(float(y))) for x, y in points_cm]
    n = len(ring)
    a = 0.0
    for i in range(n):
        a += ring[i][0] * ring[(i + 1) % n][1] - ring[(i + 1) % n][0] * ring[i][1]
    if a < 0:
        ring.reverse()
    return ring


def new_prism(name, points_cm, z0_cm, z1_cm, material=None):
    """A closed, outward-facing prism: any simple plan polygon (concave and curved included) extruded
    from z0 to z1. Bottom and top are single n-gons (Blender's polyfill triangulates a simple polygon
    correctly -- `verify_general` proves it per room by area); the sides are quads. World origin, so
    mesh coordinates ARE world coordinates (T03's invariant)."""
    ring = world_ring(points_cm)
    n = len(ring)
    verts = [(x, y, wz(z0_cm)) for x, y in ring] + [(x, y, wz(z1_cm)) for x, y in ring]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    if material is not None:
        ob.data.materials.append(material)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def new_rect_slab(name, rects_cm, z_cm, normal_up, material=None):
    """One mesh of axis-aligned quads (the fill's rectangles, plan cm) at height z."""
    verts, faces = [], []
    zz = wz(z_cm)
    for x0, y0, x1, y1 in rects_cm:
        k = len(verts)
        X0, X1, Y0, Y1 = wx(x0), wx(x1), wy(y1), wy(y0)          # plan y grows down, world Y up
        verts += [(X0, Y0, zz), (X1, Y0, zz), (X1, Y1, zz), (X0, Y1, zz)]
        faces.append([k, k + 1, k + 2, k + 3] if normal_up else [k + 3, k + 2, k + 1, k])
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    if material is not None:
        ob.data.materials.append(material)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def floor_class_of(room, surfaces):
    """v1.4: the floor class the style lock gives a room (floor | floor_wet | floor_outdoor) -- the rule of
    the FLOOR_<room> lookup in build() and of `floor_key_for`, readable before the kit exists."""
    want = ((surfaces or {}).get("floor_by_room_type") or {}).get(room["type"])
    return want if want is not None else ("floor_outdoor" if room["is_outdoor"] else "floor")


def floor_key_for(room, surfaces, kit):
    """The per-room floor finish key -- the same lookup the FLOOR_<room> slabs use."""
    want = ((surfaces or {}).get("floor_by_room_type") or {}).get(room["type"])
    if want is None:
        want = "floor_outdoor" if room["is_outdoor"] else "floor"
    return want if kit.get(want) is not None else "floor"


# Q02b (2026-10-28): the plan's own furniture as plain masses. The skin lane got an EMPTY kitchen back
# because the CG had no fixtures and the prompt forbids inventing; `fixtures[]` (traced by hand from the
# sales plan's drawn furniture) gives it masses to dress. Placeholders, never catalog models.
FIXTURE_KINDS = ("counter", "tall_unit", "table", "sofa", "tv_unit", "bed", "bedside", "wardrobe",
                 "vanity", "shower", "wc", "lounger")
FIXTURE_COLOR = (0.26, 0.26, 0.26)   # a matte neutral grey (linear). MEASURED on the first Q02b kitchen draft: at
                                     # 0.62 the fixture faces rendered 174-194/255 against walls at 179-192 (AgX +
                                     # up-facing tops catch more light), i.e. NOT distinguishable from the plaster
FIXTURE_ROUGHNESS = 0.85


def build_fixtures(plan, ceiling_cm, log):
    """`fixtures[]` -> one plain prism per fixture, FIXTURE_<id>, in one placeholder material; no booleans,
    no catalog, plan order. `height_cm` is the EXTENT above `z_cm`: top = z_cm + height_cm (the
    coordinator's ruling OQ-G6, 2026-10-28; the validator checks z_cm + height_cm <= the ceiling)."""
    fx = plan.get("fixtures") or []
    out = {"material": None, "built": [], "objects": [], "warnings": []}
    if not fx:
        log("fixtures  none in the plan (fixtures[] absent or empty)")
        return out
    mat = materials_kit.simple("M_fixture_placeholder", FIXTURE_COLOR, FIXTURE_ROUGHNESS)
    out["material"] = mat.name
    rooms = {r["id"] for r in plan["rooms"]}
    for f in fx:                                                     # plan order
        poly = plan_general.clean_ring(f.get("polygon_cm") or [])
        if len(poly) < 3:
            out["warnings"].append(f"{f.get('id')}: polygon_cm has fewer than 3 distinct points - not built")
            continue
        z0 = float(f.get("z_cm") or 0.0)
        z1, reading = z0 + float(f["height_cm"]), "extent above z_cm (OQ-G6)"
        if f.get("room_id") not in rooms:
            out["warnings"].append(f"{f['id']}: room_id {f.get('room_id')!r} is not a room")
        if f.get("kind") not in FIXTURE_KINDS:
            out["warnings"].append(f"{f['id']}: kind {f.get('kind')!r} is not in {FIXTURE_KINDS}")
        if z1 > float(ceiling_cm) + 1e-6:
            out["warnings"].append(f"{f['id']}: top {z1} cm above the ceiling {ceiling_cm} cm")
        ob = new_prism(f"FIXTURE_{f['id']}", poly, z0, z1, mat)
        bb = plan_general.bbox(poly)
        out["objects"].append(ob)
        out["built"].append({"id": f["id"], "room_id": f.get("room_id"), "kind": f.get("kind"),
                             "object": ob.name, "vertices": len(poly),
                             "area_cm2": round(abs(plan_general.shoelace(poly)), 2),
                             "box_cm": {"x": [round(bb[0], 2), round(bb[2], 2)],
                                        "y": [round(bb[1], 2), round(bb[3], 2)], "z": [z0, z1]},
                             "height_read_as": reading})
    for w in out["warnings"]:
        log(f"WARN      fixture {w}")
    kinds = sorted({b["kind"] for b in out["built"]})
    log(f"built     {len(out['built'])} fixture mass(es) FIXTURE_<id> in {mat.name} (matte light grey "
        f"placeholders, no booleans): {', '.join(str(k) for k in kinds)}")
    return out


def build_general_architecture(plan, kit, ceiling_cm, indoor_rooms, surfaces, log, fixture_masses=True):
    """Walls, facings, skirting, panes, door infills + cutters (+ leaves), the booleans, then the fill.
    Returns the context `verify_general` and the report read."""
    pg = plan_general
    g = {"wall_objs": {}, "facing_runs": [], "facing_objs": [], "skirting_objs": [], "pane_objs": {},
         "infills": [], "infill_objs": {}, "leaf_objs": {}, "glazing": [], "cut_records": [],
         "virtual_openings": [], "plan_warnings": [], "cut_to_top": [], "fill": None,
         "facing_coverage": {}, "dropped": [], "post_objs": [], "pane_joints": [],
         "frame_objs": [], "door_frames": []}
    targets = []                     # (object, plan bbox, z0, z1, role) -- creation order = cut order

    for w in plan["walls"]:                                          # plan order
        poly = pg.clean_ring(w["polygon_cm"])
        h = float(w["height_cm"])
        ob = new_prism(f"WALL_{w['id']}", poly, 0.0, h, kit["wall"])
        g["wall_objs"][w["id"]] = ob
        targets.append((ob, pg.bbox(poly), 0.0, h, "wall"))
        log(f"built     {ob.name:26s} {len(poly):3d}-gon prism  {abs(pg.shoelace(poly)):9.1f} cm2 x "
            f"{h:5.1f} cm  {w.get('kind', '?')}")

    runs = pg.facings(plan, note=log)
    g["facing_runs"] = runs
    for f in runs:
        ob = new_prism(f"FACING_{f['id']}", f["rect"], 0.0, float(f["height_cm"]), kit["wall"])
        g["facing_objs"].append(ob)
        targets.append((ob, pg.bbox(f["rect"]), 0.0, float(f["height_cm"]), "facing"))
    g["facing_coverage"] = pg.facing_coverage(plan, runs)
    bands = [f["band_cm"][1] for f in runs]
    log(f"built     {len(runs)} facing(s) at the traced faces (band to the wall "
        f"{min(bands) if bands else 0:.1f}-{max(bands) if bands else 0:.1f} cm, buried "
        f"{pg.FACING_OVERLAP_CM:.0f} cm into the wall; no facing where the band exceeds "
        f"{pg.FACING_MAX_BAND_CM:.0f} cm)")
    for rid, c in g["facing_coverage"].items():
        log(f"          {rid:20s} {c['faced_cm']:7.1f} of {c['wall_edge_cm']:7.1f} cm of 'wall' edges faced "
            f"({100.0 * (c['share'] or 0):5.1f} %)")

    indoor_ids = {r["id"] for r in indoor_rooms}
    for f in runs:
        if f["room_id"] not in indoor_ids or not OPTS["skirting"]:
            continue
        (x0, y0), (x1, y1) = f["p0"], f["p1"]
        nx, ny = f["outward"]
        rect = [(x0, y0), (x1, y1), (x1 - nx * SKIRT_D_CM, y1 - ny * SKIRT_D_CM),
                (x0 - nx * SKIRT_D_CM, y0 - ny * SKIRT_D_CM)]
        ob = new_prism(f"SKIRT_{f['id']}", rect, 0.0, SKIRT_H_CM, kit["skirting"])
        g["skirting_objs"].append(ob)
        targets.append((ob, pg.bbox(rect), 0.0, SKIRT_H_CM, "skirting"))
    log(f"built     {len(g['skirting_objs'])} skirting board(s) along the facings of {len(indoor_ids)} "
        f"indoor room(s), {SKIRT_H_CM} x {SKIRT_D_CM} cm (only where a facing stands)")

    for p in plan.get("panes", []):                                  # plan order
        poly = pg.clean_ring(p["polygon_cm"])
        z0, z1 = float(p.get("sill_cm", 0.0)), float(p["head_cm"])
        ob = new_prism(f"GLASS_{p['id']}", poly, z0, z1, kit["glass"])
        g["pane_objs"][p["id"]] = ob
        targets.append((ob, pg.bbox(poly), z0, z1, "pane"))
        log(f"built     {ob.name:26s} {len(poly):3d}-gon glass  {z0:5.1f}-{z1:5.1f} cm  {p['kind']}")

    cutters, extra_solids = [], [list(f["rect"]) for f in runs]
    # 2b: a pane that stops short of the wall or pane it meets leaves a full-height slit -- a frame post
    for j in pg.pane_joints(plan):                                   # plan order
        ob = new_prism(f"POST_{j['id']}", j["poly"], j["z_cm"][0], j["z_cm"][1], kit["frame"])
        g["post_objs"].append(ob)
        g["pane_joints"].append({k: j[k] for k in ("id", "pane", "to", "gap_cm", "z_cm")})
        targets.append((ob, pg.bbox(j["poly"]), j["z_cm"][0], j["z_cm"][1], "post"))
        extra_solids.append(list(j["poly"]))
        if j["z_cm"][1] >= float(ceiling_cm) - 0.5:
            g.setdefault("_post_polys", []).append(list(j["poly"]))
    if g["post_objs"]:
        gaps = [j["gap_cm"] for j in g["pane_joints"]]
        log(f"built     {len(g['post_objs'])} frame post(s) closing pane joints the trace left open "
            f"({min(gaps):.2f}-{max(gaps):.2f} cm): " + ", ".join(f"{j['id']}->{j['to']}" for j in g["pane_joints"]))
    for op in plan["openings"]:                                      # plan order
        if pg.is_virtual_opening(op, ceiling_cm):
            g["virtual_openings"].append(op["id"])
            log(f"skipped   opening {op['id']} ({op['kind']}, head {op['head_cm']} = ceiling, rooms "
                f"{op['rooms']}): a virtual boundary - nothing cut, nothing built")
            continue
        if op["kind"] not in pg.CUT_KINDS and op["kind"] != "opening":
            log(f"skipped   opening {op['id']}: kind {op['kind']!r} is not one this builder cuts")
            continue
        inf = pg.door_infill(plan, op, ceiling_cm)
        iob = new_prism(f"INFILL_{op['id']}", inf["rect"], inf["z_cm"][0], inf["z_cm"][1], kit["wall"])
        g["infill_objs"][op["id"]] = iob
        g["infills"].append({"opening": op["id"], "object": iob.name, "u_range_cm": inf["u_range_cm"],
                             "n_range_cm": inf["n_range_cm"], "measure": inf["measure"]})
        targets.append((iob, pg.bbox(inf["rect"]), inf["z_cm"][0], inf["z_cm"][1], "infill"))
        extra_solids.append(list(inf["rect"]))
        g.setdefault("_infill_rects", []).append(list(inf["rect"]))
        cut = pg.door_cutter(op, CUT_MARGIN_CM, ceiling_cm)
        cob = new_prism(f"CUT_{op['id']}", cut["rect"], cut["z_cm"][0], cut["z_cm"][1])
        span = pg.door_span_on_walls(plan, op)
        cutters.append((op, cob, cut, span))
        if span > pg.DOOR_SPAN_WALL_WARN:
            g["plan_warnings"].append({
                "opening": op["id"], "kind": op["kind"], "span_on_wall_polygons": round(span, 3),
                "warn_above": pg.DOOR_SPAN_WALL_WARN,
                "meaning": "the plan puts this opening across solid wall; a door drawn as a gap in the "
                           "grey fill reads ~0. Built as the plan says: the cutter opens the plan's span "
                           "and the infill closes the drawn gap beside it."})
            log(f"WARN      {op['id']}: {100.0 * span:.0f} % of its {op['width_cm']} cm span lies on wall "
                f"polygons - the plan's door is not in the drawing's gap (plan data, reported)")
        leaf_kind = op["kind"] == "entrance_door"
        glass_kind = op["kind"] in ("window", "sliding_door", "glazed_door")
        if leaf_kind or glass_kind:
            leaf = pg.door_leaf(op, DOOR_LEAF_THICK_CM if leaf_kind else GLASS_THICK_CM)
            lob = new_prism(f"{'LEAF' if leaf_kind else 'GLASS'}_{op['id']}", leaf["rect"],
                            leaf["z_cm"][0], leaf["z_cm"][1], kit["skirting"] if leaf_kind else kit["glass"])
            g["leaf_objs"][op["id"]] = lob
            g["glazing"].append(lob.name)
            extra_solids.append(list(leaf["rect"]))

    for op, cob, cut, span in cutters:                               # the booleans, plan order
        cbb = plan_general.bbox(cut["rect"])
        cz0, cz1 = cut["z_cm"]
        hits = []
        for ob, bb, z0, z1, role in targets:
            if not plan_general.bbox_overlap(bb, cbb) or z1 <= cz0 or z0 >= cz1:
                continue
            if role == "skirting" and float(op["sill_cm"]) > 1e-9:
                continue
            mod = ob.modifiers.new(f"BOOL_{op['id']}", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.solver = "EXACT"
            mod.object = cob
            hits.append(ob.name)
            if role in ("wall", "pane", "infill", "facing") and cz1 >= z1 - 1e-6 and ob.name not in g["cut_to_top"]:
                g["cut_to_top"].append(ob.name)
        g["cut_records"].append({
            "opening": op["id"], "kind": op["kind"], "rooms": op["rooms"],
            "centre_cm": op["centre_cm"], "angle_deg": op["angle_deg"], "width_cm": op["width_cm"],
            "sill_cm": op["sill_cm"], "head_cm": op["head_cm"],
            "cutter": {"length_cm": round(2 * cut["half_width_cm"], 3),
                       "depth_cm": round(2 * cut["half_depth_cm"], 3), "z_cm": cut["z_cm"],
                       "rect_cm": [[round(x, 3), round(y, 3)] for x, y in cut["rect"]]},
            "targets": hits, "span_on_wall_polygons": round(span, 3)})
        log(f"cut       {op['id']:8s} {op['kind']:14s} {float(op['width_cm']):6.1f} cm at "
            f"{float(op['angle_deg']):7.2f} deg, {op['sill_cm']}-{op['head_cm']} cm, through {len(hits)} "
            f"object(s): {', '.join(hits)}")
    for ob, _bb, _z0, _z1, _role in targets:
        bake_modifiers(ob)
    for _op, cob, _cut, _span in cutters:
        me = cob.data
        bpy.data.objects.remove(cob, do_unlink=True)
        bpy.data.meshes.remove(me)
    for coll in ("skirting_objs", "facing_objs", "post_objs"):        # consumed whole by a cutter
        kept = []
        for ob in g[coll]:
            if len(ob.data.polygons):
                kept.append(ob)
                continue
            name, me = ob.name, ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            bpy.data.meshes.remove(me)
            g["dropped"].append(name)
            log(f"dropped   {name} (consumed whole by a cutter)")
        g[coll] = kept
    for pid in list(g["pane_objs"]):
        ob = g["pane_objs"][pid]
        if not len(ob.data.polygons):
            name, me = ob.name, ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            bpy.data.meshes.remove(me)
            del g["pane_objs"][pid]
            g["dropped"].append(name)
            log(f"dropped   {name} (consumed whole by a cutter)")

    # 2c (Q05, the skin lane, 2026-10-29): a door cut THROUGH a pane is a bare gap in the glass, and an image
    # model reads the whole glass run as the door (o-13: 190 cm painted for 132). Such a gap gets a frame in
    # the WALL material, in the pane's own line -- plan_general.door_glass_frames() decides where. Built after
    # the cuts, so no cutter touches it; no glazed leaf. Not one of the fill's solids: it stands where the
    # fill already is, and the fill stays as it was.
    for rec in g["cut_records"]:                                     # cut order = plan order
        op = next(o for o in plan["openings"] if o["id"] == rec["opening"])
        for fr in pg.door_glass_frames(plan, op, FRAME_W_CM, FRAME_D_CM, CUT_MARGIN_CM, ceiling_cm):
            entry = {k: fr[k] for k in ("opening", "pane", "cut_cm2", "framed", "reason", "continues")}
            if not fr["framed"]:
                g["door_frames"].append(entry)
                log(f"skipped   door frame {op['id']} x {fr['pane']} ({fr['cut_cm2']} cm2 of it cut): {fr['reason']}")
                continue
            made = []
            for part in fr["parts"]:
                ob = new_prism(f"DOORFRAME_{op['id']}_{fr['pane']}_{part['tag']}", part["rect"],
                               part["z_cm"][0], part["z_cm"][1], kit["wall"])
                g["frame_objs"].append(ob)
                made.append({"object": ob.name, "tag": part["tag"], "s_cm": part["s_cm"], "z_cm": part["z_cm"],
                             "rect_cm": [[round(x, 3), round(y, 3)] for x, y in part["rect"]]})
            entry.update({k: fr[k] for k in ("line", "face_cm", "depth_cm", "clear_width_cm", "clear_height_cm",
                                             "enclosure")})
            entry.update({"material": kit["wall"].name, "parts": made})
            g["door_frames"].append(entry)
            log(f"built     door frame {op['id']} x {fr['pane']} ({fr['cut_cm2']} cm2 of glass cut): "
                f"{', '.join(q['object'] for q in made)} - {fr['face_cm']:.0f} x {fr['depth_cm']:.2f} cm in the "
                f"pane's line ({fr['line']['angle_to_door_deg']:.2f} deg to the door line, "
                f"{fr['line']['n_at_left_cm']:.1f} / {fr['line']['n_at_right_cm']:.1f} cm off it), clear "
                f"{fr['clear_width_cm']:.1f} x {fr['clear_height_cm']:.1f} cm, enclosure {fr['enclosure']}")

    # the footprints that stand to the ceiling stop the sky (plan_general's docstring, answer 3)
    top = float(ceiling_cm) - 0.5
    barriers = [pg.clean_ring(w["polygon_cm"]) for w in plan["walls"] if float(w["height_cm"]) >= top]
    barriers += [f["rect"] for f in runs if float(f["height_cm"]) >= top]
    barriers += [list(i_rect) for i_rect in g.setdefault("_infill_rects", [])]
    barriers += [pg.clean_ring(p["polygon_cm"]) for p in plan.get("panes", []) if float(p["head_cm"]) >= top]
    barriers += [list(j_poly) for j_poly in g.setdefault("_post_polys", [])]
    fr = plan_general.fill_regions(plan, extra_solids, lambda room: floor_key_for(room, surfaces, kit),
                                   ceiling_barriers=barriers)
    for cls in sorted(fr["floor_rects"]):
        if fr["floor_rects"][cls]:
            new_rect_slab(f"FLOORFILL_{cls}", fr["floor_rects"][cls], -plan_general.FILL_FLOOR_Z_OFFSET_CM,
                          True, kit[cls])
    if fr["ceiling_rects"]:
        new_rect_slab("CEILFILL", fr["ceiling_rects"], ceiling_cm + plan_general.FILL_CEILING_Z_OFFSET_CM,
                      False, kit["ceiling"])
    g.pop("_infill_rects", None)
    g.pop("_post_polys", None)
    g["fill"] = {k: v for k, v in fr.items() if k not in ("floor_rects", "ceiling_rects")}
    g["fill"]["floor_quads"] = {cls: len(r) for cls, r in sorted(fr["floor_rects"].items())}
    g["fill"]["ceiling_quads"] = len(fr["ceiling_rects"])
    g["fill"]["z_offset_cm"] = {"floor": -plan_general.FILL_FLOOR_Z_OFFSET_CM,
                                "ceiling": plan_general.FILL_CEILING_Z_OFFSET_CM}
    if fixture_masses:
        g["fixtures"] = build_fixtures(plan, ceiling_cm, log)
    else:                                                            # v1.5: real models replace them
        g["fixtures"] = {"material": None, "built": [], "objects": [], "warnings": [],
                         "replaced_by": "general_furnish (v1.5, D-WQ-36)"}
        log(f"fixtures  {len(plan.get('fixtures') or [])} plan fixture(s) are FURNISHED with catalog models "
            f"and procedural assemblies below - no placeholder mass is built")
    log(f"built     floor/ceiling fill at {fr['res_cm']:.0f} cm: {fr['cells']['fill']:,} cells "
        f"({fr['cells']['holes_filled']:,} in enclosed holes - bays, niche, thresholds), closing "
        f"{fr['close_cells']} cells; floor quads {g['fill']['floor_quads']}, ceiling quads "
        f"{g['fill']['ceiling_quads']} ({fr['cells']['sky']:,} sky cells over the outdoor rooms); the fill sits "
        f"{plan_general.FILL_FLOOR_Z_OFFSET_CM} cm under the floors and {plan_general.FILL_CEILING_Z_OFFSET_CM} cm "
        f"over the ceilings - never coplanar with a room slab")
    return g


def general_furnishing_on(args, style):
    return bool(style) and not args.no_furniture and args.general_furnish == "on"


def furnish_general(plan, rooms_to_build, indoor_rooms, lighting, ceiling_cm, palette_mats, args, log,
                    furnished=False):
    """Each indoor room gets the lock's flush luminaire. No placement TEMPLATE runs on a general room (the
    templates are rectilinear); since v1.5 `build_general_furniture` furnishes it from the plan instead."""
    spec = (lighting or {}).get("ceiling_luminaire", LUMINAIRE_FALLBACK)
    lights = []
    for room in indoor_rooms:                                        # plan order
        cams = [(float(cp["x"]), float(cp["y"])) for cp in plan["camera_points"]
                if cp["room_id"] == room["id"]]
        x, y, clear, rule = plan_general.luminaire_point(room["loop"], cams)
        rec = (add_t06_point_light(room, ceiling_cm, x, y, log) if args.luminaire == "t06-point" else
               add_ceiling_luminaire(room, spec, ceiling_cm, x, y, palette_mats, log))
        rec["placement_rule"] = rule
        rec["loop_clearance_cm"] = round(clear, 1)
        lights.append(rec)
    unfurnished, with_fixtures = [], {}
    for f in plan.get("fixtures") or []:
        with_fixtures[f.get("room_id")] = with_fixtures.get(f.get("room_id"), 0) + 1
    for room in rooms_to_build:
        if furnished:
            continue
        if with_fixtures.get(room["id"]):
            log(f"furniture {room['id']:20s} {with_fixtures[room['id']]} plan fixture mass(es) (placeholders, "
                f"Q02b); no template runs on a general room")
            continue
        unfurnished.append(room["id"])
        log(f"furniture {room['id']:20s} UNFURNISHED - general plan: the templates run in each room's "
            f"dominant-wall frame in a follow-up card (Q01b)")
    if furnished:
        return lights, {"general": True, "templates_run": False, "unfurnished_rooms": [],
                        "rooms_with_plan_fixtures": with_fixtures, "violations": [],
                        "why": "D-WQ-36 (v1.5): the templates are rectilinear; general_furnish.py furnishes a "
                               "general plan from its fixtures[] + furnishing extension"}
    return lights, {"general": True, "templates_run": False, "unfurnished_rooms": unfurnished,
                    "rooms_with_plan_fixtures": with_fixtures,
                    "violations": [],
                    "why": "D-WQ-28 / Q01b: the furniture templates are rectilinear; a general room is "
                           "built empty in this version and lit by one flush luminaire"}


def build_general_furniture(plan, style, ceiling_cm, palette_mats, kit, log):
    """v1.5 (D-WQ-36): execute general_furnish.plan_furnishing() -- catalog models (hash-verified against the
    lock first, imported in the plan's order, restyled, fitted by per-axis scale), the procedural closets and
    showers, and the interior door assemblies, all as prisms in palette materials. Returns
    (furniture records, model hashes, material swaps, the planner's report, every built object)."""
    res = general_furnish.plan_furnishing(plan, style, ceiling_cm)
    used = sorted({p["model"] for p in res["placements"]})
    model_hashes = verify_model_hashes(style, used, log)
    furn, swaps_all, objs = [], {}, []

    def mat_of(name):
        if name == "glass_clear":
            return palette_mats.get("glass_clear") or kit["glass"]
        m = palette_mats.get(name)
        if m is None:
            raise SystemExit(f"general_furnish: palette material {name!r} is not in the style lock")
        return m

    for p in res["placements"]:                                     # the planner's order = plan order
        spec = style["models"][p["model"]]
        path = os.path.join(REPO_360, spec["file"].replace("/", os.sep))
        tag = f"{p['room_id']}_{p['id']}"
        log(f"furniture {p['model']:44s} -> {p['room_id']}/{p['id']} at ({p['x_cm']:.0f}, {p['y_cm']:.0f}) cm, "
            f"facing {p['yaw_deg']:.0f} deg, {p['layer']}, {p['source']}")
        if spec["format"] == "glb":
            empty, mobjs = import_glb(path, tag, log)
        else:
            empty, mobjs = append_model(path, tag, log)
        for a, b in apply_style_materials(mobjs, spec, style, palette_mats, log):
            swaps_all[a] = b
        anchor = p["anchor"] if p["anchor"] in ("wall", "on_top") else "floor"
        rec = place_model(empty, mobjs, p["x_cm"], p["y_cm"], p["yaw_deg"], anchor,
                          spec.get("front_local", "-Y"), ceiling_cm, scale_xyz=tuple(p["scale_xyz"]),
                          z_cm=p.get("z_cm"))
        rec.update({"model": p["model"], "room_id": p["room_id"], "slot": p["id"], "class": p["class"],
                    "source": p["source"], "source_file": spec["file"], "x_cm": p["x_cm"], "y_cm": p["y_cm"],
                    "yaw_deg": p["yaw_deg"], "anchor": anchor, "z_cm": p.get("z_cm"), "layer": p["layer"],
                    "front_local": spec.get("front_local", "-Y"), "rule": p["source"],
                    "objects": sorted(o.name for o in mobjs)})
        bpy.context.view_layer.update()
        furn.append(rec)
        objs += mobjs
    n_parts = 0
    for q in res["procedural"]:
        for part in q["parts"]:
            ob = new_prism(part["name"], [tuple(v) for v in part["poly_cm"]], part["z_cm"][0], part["z_cm"][1],
                           mat_of(part["material"]))
            objs.append(ob)
            n_parts += 1
    n_door = 0
    for d in res["doors"]:
        for part in d["parts"]:
            ob = new_prism(part["name"], [tuple(v) for v in part["poly_cm"]], part["z_cm"][0], part["z_cm"][1],
                           mat_of(part["material"]))
            objs.append(ob)
            n_door += 1
        log(f"door      {d['opening']:6s} leaf {d['leaf_cm'][0]:.1f} x {d['leaf_cm'][2]:.1f} cm into {d['swing_room']}, "
            f"hinge {d['hinge']}, open {d['open_deg']:g} deg ({d['open_rule']}), {len(d['parts'])} parts")
    for e in res.get("entrance", []):
        leaf = bpy.data.objects.get(e["leaf_object"])
        if leaf is not None and leaf.data.materials:
            leaf.data.materials[0] = mat_of(e["leaf_material"])
        for part in e["parts"]:
            ob = new_prism(part["name"], [tuple(v) for v in part["poly_cm"]], part["z_cm"][0], part["z_cm"][1],
                           mat_of(part["material"]))
            objs.append(ob)
            n_door += 1
        log(f"door      {e['opening']:6s} entrance leaf {e['leaf_object']} -> {e['leaf_material']}"
            f"{'' if leaf is not None else ' (NOT FOUND)'}, hinge {e['hinge']}, {len(e['parts'])} parts")
    for dr in res["dropped"]:
        log(f"dropped   {dr['id']}: {'; '.join(dr['why'])}")
    for w in res["warnings"]:
        log(f"NOTE      furnishing {w}")
    for m in sorted(bpy.data.materials, key=lambda m: m.name):
        if m.users == 0:
            bpy.data.materials.remove(m)
    log(f"furnished {len(furn)} catalog placement(s) of {len(used)} distinct model(s), {len(res['procedural'])} "
        f"procedural assemblies ({n_parts} parts), {len(res['doors'])} interior door(s) ({n_door} parts) - "
        f"general_furnish v{general_furnish.VERSION}")
    report = {k: v for k, v in res.items() if k not in ("placements",)}
    report["placements"] = [{k: v for k, v in p.items() if k != "footprint_cm"} for p in res["placements"]]
    report["door_parts_total"] = n_door
    report["procedural_parts_total"] = n_parts
    return furn, model_hashes, swaps_all, report, objs


def verify_general(ctx, log):
    """The general path's checks, measured off the BUILT meshes (the v1 law):
      * every wall: its height, its top face's area against the polygon's shoelace area (the 1 mm bar
        expressed as a uniform boundary offset: |dA| / perimeter), every plan vertex on the extruded top;
      * every room: the floor's bbox against clear_dims_cm (as v1), the floor's TRIANGULATED area against
        the loop's shoelace area (proves a concave or curved n-gon triangulates right), floor-to-ceiling;
      * every pane: its height and its top area; every facing: its height;
      * every cut opening: rays straight through the opening are clear, rays just above the head hit
        the head (the infill did its job);
      * camera clearance against every architectural mesh -- REPORTED on this path (authored points)."""
    from mathutils.kdtree import KDTree
    bpy.context.view_layer.update()
    pg = plan_general
    g = ctx["general_ctx"]
    plan = ctx["plan"]
    checks = []

    def chk(label, measured_cm, expected_cm, source):
        err_mm = abs(measured_cm - expected_cm) * 10.0
        ok = err_mm <= 1.0
        checks.append({"check": label, "measured_cm": round(measured_cm, 6), "expected_cm": expected_cm,
                       "error_mm": round(err_mm, 6), "pass": ok, "source": source})
        log(f"  [{'PASS' if ok else 'FAIL'}] {label:<58s} measured {measured_cm:11.4f} cm  "
            f"expected {expected_cm:11.4f} cm  err {err_mm:8.5f} mm   <- {source}")
        return ok

    def chk_area(label, measured_cm2, expected_cm2, perim_cm, source):
        err_mm = abs(measured_cm2 - expected_cm2) / max(perim_cm, 1e-9) * 10.0
        ok = err_mm <= 1.0
        checks.append({"check": label, "measured_cm2": round(measured_cm2, 4),
                       "expected_cm2": round(expected_cm2, 4), "error_mm": round(err_mm, 6),
                       "error_note": "|dA| / perimeter - the uniform boundary offset that explains the area "
                                     "difference, held to the same 1 mm bar", "pass": ok, "source": source})
        log(f"  [{'PASS' if ok else 'FAIL'}] {label:<58s} measured {measured_cm2:11.2f} cm2 "
            f"expected {expected_cm2:11.2f} cm2 eq. {err_mm:8.5f} mm   <- {source}")
        return ok

    def chk_count(label, measured, expected, source):
        ok = measured == expected
        checks.append({"check": label, "measured": measured, "expected": expected, "pass": ok,
                       "source": source})
        log(f"  [{'PASS' if ok else 'FAIL'}] {label:<58s} {measured} / {expected}   <- {source}")
        return ok

    def top_area_cm2(ob, z_cm):
        a = 0.0
        for p in ob.data.polygons:
            if p.normal.z > 0.999 and abs(p.center.z * 100.0 - z_cm) < 1e-3:
                a += p.area
        return a * 1e4

    log("")
    log(f"GEOMETRY CHECKS  (general plan: {len(g['wall_objs'])} wall pieces, {len(g['facing_objs'])} facings, "
        f"{len(g['pane_objs'])} panes, {len(g['cut_records'])} cut openings, {len(ctx['rooms_built'])} rooms; "
        f"tolerance 1.000 mm)")
    for w in plan["walls"]:
        ob = g["wall_objs"][w["id"]]
        poly = pg.clean_ring(w["polygon_cm"])
        h = float(w["height_cm"])
        mn, mx = mesh_bbox(ob)
        chk(f"wall {w['id']} height", (mx.z - mn.z) * 100.0, h, f"walls[{w['id']}].height_cm")
        if ob.name in g["cut_to_top"]:
            log(f"  [SKIP] wall {w['id']} top area - an opening reaches its top")
            continue
        chk_area(f"wall {w['id']} polygon extruded (top face area)", top_area_cm2(ob, h),
                 abs(pg.shoelace(poly)), pg.perimeter(poly), f"walls[{w['id']}].polygon_cm (shoelace)")
        kd = KDTree(len(ob.data.vertices))
        for i, v in enumerate(ob.data.vertices):
            kd.insert(v.co, i)
        kd.balance()
        found = sum(1 for x, y in poly if kd.find(Vector((wx(x), wy(y), wz(h))))[2] <= 1e-5)
        chk_count(f"wall {w['id']} plan vertices on the extruded top", found, len(poly),
                  f"walls[{w['id']}].polygon_cm")

    for room in ctx["rooms_built"]:
        rid = room["id"]
        fl = ctx["floors"][rid]
        mn, mx = mesh_bbox(fl)
        chk(f"room {rid} clear width (floor bbox, x)", (mx.x - mn.x) * 100.0, room["clear_dims_cm"][0],
            f"rooms[{rid}].clear_dims_cm[0]")
        chk(f"room {rid} clear depth (floor bbox, y)", (mx.y - mn.y) * 100.0, room["clear_dims_cm"][1],
            f"rooms[{rid}].clear_dims_cm[1]")
        fl.data.calc_loop_triangles()
        tri = sum(t.area for t in fl.data.loop_triangles) * 1e4
        loop = pg.clean_ring(room["loop"])
        chk_area(f"room {rid} floor triangulation area ({len(loop)}-gon)", tri, abs(pg.shoelace(loop)),
                 pg.perimeter(loop), f"rooms[{rid}].loop (shoelace)")
        if rid in ctx["ceilings"]:
            mnc, _mxc = mesh_bbox(ctx["ceilings"][rid])
            chk(f"room {rid} floor-to-ceiling height", (mnc.z - mn.z) * 100.0, ctx["ceiling_cm"],
                "plan_meta.ceiling_height_cm [ASSUMED]")

    panes = {p["id"]: p for p in plan.get("panes", [])}
    for pid, ob in g["pane_objs"].items():
        p = panes[pid]
        poly = pg.clean_ring(p["polygon_cm"])
        z0, z1 = float(p.get("sill_cm", 0.0)), float(p["head_cm"])
        mn, mx = mesh_bbox(ob)
        chk(f"pane {pid} height", (mx.z - mn.z) * 100.0, z1 - z0, f"panes[{pid}].sill_cm/head_cm")
        if ob.name not in g["cut_to_top"]:
            chk_area(f"pane {pid} polygon extruded (top face area)", top_area_cm2(ob, z1),
                     abs(pg.shoelace(poly)), pg.perimeter(poly), f"panes[{pid}].polygon_cm (shoelace)")
    # a facing inside a door's span keeps only its part above the head (it becomes the head's face), so
    # the invariant is its TOP: every facing still reaches the height of the wall its band reached.
    tops_ok = 0
    by_name = {f"FACING_{f['id']}": f for f in g["facing_runs"]}
    for ob in g["facing_objs"]:
        _mn, mx = mesh_bbox(ob)
        if abs(mx.z * 100.0 - float(by_name[ob.name]["height_cm"])) * 10.0 <= 1.0:
            tops_ok += 1
    chk_count("facings reaching their wall's height (top face)", tops_ok, len(g["facing_objs"]),
              "plan_general.facings() -> the wall each band reached")
    for fr in g.get("door_frames", []):
        if not fr.get("framed"):
            continue
        for part in fr["parts"]:
            ob = bpy.data.objects.get(part["object"])
            mn, mx = mesh_bbox(ob)
            chk(f"door frame {part['object']} height", (mx.z - mn.z) * 100.0, part["z_cm"][1] - part["z_cm"][0],
                f"openings[{fr['opening']}] sill/head + FRAME_W_CM (plan_general answer 2c)")
            rect = [tuple(q) for q in part["rect_cm"]]
            chk_area(f"door frame {part['object']} footprint (top face area)", top_area_cm2(ob, part["z_cm"][1]),
                     abs(pg.shoelace(rect)), pg.perimeter(rect), "plan_general.door_glass_frames() rect")
        enc = fr["enclosure"]
        want = [k for k in ("left_glass_edge", "right_glass_edge") if enc.get(k) is not None]
        got = [k for k in want if enc[k] is True]
        if "head_cells" in enc:
            want.append("head_cells")
            if enc["head_cells"][0] == enc["head_cells"][1]:
                got.append("head_cells")
        chk_count(f"door frame {fr['opening']} x {fr['pane']}: bare glass faces inside the frame", len(got),
                  len(want), "plan_general.door_glass_frames() enclosure, 2-D")
    joints = {f"POST_{j['id']}": j for j in g["pane_joints"]}
    posts_ok = 0
    for ob in g["post_objs"]:
        mn, mx = mesh_bbox(ob)
        j = joints[ob.name]
        if abs((mx.z - mn.z) * 100.0 - (j["z_cm"][1] - j["z_cm"][0])) * 10.0 <= 1.0:
            posts_ok += 1
    chk_count("pane joint posts at their pane's height", posts_ok, len(g["post_objs"]),
              "plan_general.pane_joints() -> panes[].sill_cm/head_cm")

    for b, ob in zip(g.get("fixtures", {}).get("built", []), g.get("fixtures", {}).get("objects", [])):
        mn, mx = mesh_bbox(ob)
        z0, z1 = b["box_cm"]["z"]
        chk(f"fixture {b['id']} height", (mx.z - mn.z) * 100.0, z1 - z0, f"fixtures[{b['id']}].z_cm/height_cm")
        poly = pg.clean_ring(next(f for f in plan["fixtures"] if f["id"] == b["id"])["polygon_cm"])
        chk_area(f"fixture {b['id']} polygon extruded (top face area)", top_area_cm2(ob, z1),
                 abs(pg.shoelace(poly)), pg.perimeter(poly), f"fixtures[{b['id']}].polygon_cm (shoelace)")

    # ---- the openings, functionally: through is clear, above the head is wall -------------------------
    arch = list(g["wall_objs"].values()) + g["facing_objs"] + list(g["infill_objs"].values()) \
        + list(g["pane_objs"].values()) + g["skirting_objs"] + g["post_objs"] + g.get("frame_objs", [])
    bvhs = [(ob.name, mesh_bvh(ob)) for ob in arch]
    bvhs = [(n, b) for n, b in bvhs if b is not None]
    log("")
    log("OPENING CHECKS  (rays across each cut opening: clear between sill and head, blocked just above "
        "the head)")
    door_checks = []
    for rec in g["cut_records"]:
        op = next(o for o in plan["openings"] if o["id"] == rec["opening"])
        cx, cy, ux, uy, nx, ny = pg.door_frame(op)
        w = float(op["width_cm"])
        sill, head = float(op["sill_cm"]), float(op["head_cm"])
        own = {f"LEAF_{op['id']}", f"GLASS_{op['id']}"}
        half = pg.CUTTER_DEPTH_CM / 2.0 + CUT_MARGIN_CM - 1.0

        def cast(f, z_cm):
            ox, oy = cx + ux * w * f - nx * half, cy + uy * w * f - ny * half
            o = Vector((wx(ox), wy(oy), wz(z_cm)))
            d = Vector((wx(cx + ux * w * f + nx * half) - o.x, wy(cy + uy * w * f + ny * half) - o.y, 0.0))
            dist = d.length
            d.normalize()
            hit = None
            for name, b in bvhs:
                if name in own:
                    continue
                loc, _n, _i, dd = b.ray_cast(o, d, dist)
                if loc is not None and (hit is None or dd < hit[1]):
                    hit = (name, dd)
            return hit

        clear_rays = [(f, z) for f in (-0.35, 0.0, 0.35) for z in (sill + 10.0, (sill + head) / 2.0, head - 10.0)]
        blocked = [(f, z, cast(f, z)) for f, z in clear_rays]
        n_clear = sum(1 for _f, _z, h in blocked if h is None)
        ok_clear = n_clear == len(clear_rays)
        head_rays, n_head, ok_head = [], None, None
        if head < ctx["ceiling_cm"] - 6.0:
            head_rays = [(f, head + 4.0, cast(f, head + 4.0)) for f in (-0.35, 0.0, 0.35)]
            n_head = sum(1 for _f, _z, h in head_rays if h is not None)
            ok_head = n_head == len(head_rays)
        ok = ok_clear and (ok_head is not False)
        door_checks.append({"opening": op["id"], "kind": op["kind"],
                            "through_clear": f"{n_clear}/{len(clear_rays)}",
                            "first_blocker": next((h[0] for _f, _z, h in blocked if h), None),
                            "head_blocked": None if n_head is None else f"{n_head}/{len(head_rays)}",
                            "head_by": sorted({h[0] for _f, _z, h in head_rays if h}), "pass": ok})
        checks.append({"check": f"opening {op['id']} open between sill and head, closed above",
                       "measured": {"through_clear": n_clear, "head_blocked": n_head},
                       "expected": {"through_clear": len(clear_rays),
                                    "head_blocked": len(head_rays) if head_rays else None},
                       "pass": ok, "source": f"openings[{op['id']}] (cutter + infill)"})
        log(f"  [{'PASS' if ok else 'FAIL'}] opening {op['id']:6s} through {n_clear}/{len(clear_rays)} clear"
            + (f", above the head {n_head}/{len(head_rays)} blocked by {sorted({h[0] for _f, _z, h in head_rays if h})}"
               if head_rays else ", head at the ceiling")
            + ("" if ok_clear else f"  first blocker {door_checks[-1]['first_blocker']}"))
    g["door_checks"] = door_checks

    # ---- camera clearance against every architectural mesh -- reported, never failed, on this path ------
    log("")
    log(f"CAMERA CLEARANCE  (bar {CAMERA_MIN_CLEARANCE_CM:.0f} cm from any architectural mesh, measured on the "
        f"built mesh; general plan: REPORTED - the points are authored and taken as given)")
    camera_checks = []
    fixture_bvhs = [(ob.name, mesh_bvh(ob)) for ob in g.get("fixtures", {}).get("objects", [])
                    + g.get("furniture_objs", [])]
    for cp in plan["camera_points"]:
        if cp["room_id"] not in ctx["built_room_ids"]:
            continue
        p = Vector((wx(cp["x"]), wy(cp["y"]), wz(cp["z"])))
        best = None
        for name, b in bvhs + [fb for fb in fixture_bvhs if fb[1] is not None]:
            _loc, _nrm, _idx, dist = b.find_nearest(p)
            if dist is not None and (best is None or dist < best[0]):
                best = (dist, name)
        if best is None:
            continue
        dcm = best[0] * 100.0
        ok = dcm >= CAMERA_MIN_CLEARANCE_CM
        kind = best[1].split("_", 1)[0].lower()
        camera_checks.append({"camera": cp["id"], "room_id": cp["room_id"], "clearance_cm": round(dcm, 2),
                              "nearest": best[1], "nearest_kind": kind, "pass": bool(ok)})
        log(f"  [{'PASS' if ok else 'UNDER'}] camera {cp['id']:<18s} room {cp['room_id']:<18s} clearance "
            f"{dcm:7.2f} cm from {best[1]}")
    return checks, camera_checks


def general_walls_built(ctx):
    out = []
    for w in ctx["plan"]["walls"]:
        poly = plan_general.clean_ring(w["polygon_cm"])
        out.append({"id": w["id"], "kind": w.get("kind"), "height_cm": w["height_cm"],
                    "vertices": len(poly), "area_cm2_shoelace": round(abs(plan_general.shoelace(poly)), 2),
                    "bbox_cm": [round(v, 2) for v in plan_general.bbox(poly)]})
    return out


def general_report(ctx):
    g = ctx["general_ctx"]
    return {
        "plan_general_version": plan_general.VERSION,
        "facings": {"count": len(g["facing_objs"]), "coverage_by_room": g["facing_coverage"],
                    "rule": f"a box whose front is the loop edge, buried {plan_general.FACING_OVERLAP_CM} cm "
                            f"into the wall, wherever a wall stands within {plan_general.FACING_MAX_BAND_CM} cm",
                    "runs": [{k: f[k] for k in ("id", "room_id", "edge", "length_cm", "depth_cm", "band_cm",
                                                "height_cm", "walls", "clamped_by_wall_thickness")}
                             for f in g["facing_runs"]]},
        "door_infills": g["infills"],
        "openings_virtual": g["virtual_openings"],
        "openings_cut": g["cut_records"],
        "opening_checks": g.get("door_checks", []),
        "roofed_rooms": [r["id"] for r in ctx["plan"]["rooms"] if r.get("is_outdoor") and r.get("roofed")],
        "fixtures_built": g.get("fixtures", {}).get("built", []),
        "fixtures_material": g.get("fixtures", {}).get("material"),
        "fixture_warnings": g.get("fixtures", {}).get("warnings", []),
        "panes_built": sorted(g["pane_objs"]),
        "pane_joint_posts": g["pane_joints"],
        "door_glass_frames": g.get("door_frames", []),
        "objects_consumed_by_cutters": g["dropped"],
        "fill": g["fill"],
        "plan_warnings": g["plan_warnings"],
        "not_built_in_this_version": [
            ("furniture is general_furnish's (v1.5): catalog models + procedural closets/showers + interior "
             "door assemblies" if g.get("furniture_objs") else
             "furniture models (templates are rectilinear; plan fixtures[] are built as placeholder masses, "
             "Q02b)"),
            "window frames and mullions on panes (the drawing's double lines carry none); a door frame is "
            "built only where a door is cut through a pane (answer 2c, door_glass_frames)",
            "the top view (render_pano.py's --top-view reads rect walls)"],
    }


# ----------------------------------------------------------------------------------------------
# room/seed selection
# ----------------------------------------------------------------------------------------------

def pick_room(plan, requested):
    """Single-room DEBUG mode only (v0's original path, kept for T03/T04/T05-style probing)."""
    seeded = {cp["room_id"] for cp in plan["camera_points"]}
    indoor = [r for r in plan["rooms"] if not r["is_outdoor"] and r["id"] in seeded]
    if requested and requested not in ("auto", "all"):
        for r in plan["rooms"]:
            if r["id"] == requested:
                if r["is_outdoor"]:
                    raise SystemExit(f"{requested} is_outdoor:true - SCHEMA 7 gives it no camera point")
                if r["id"] not in seeded:
                    raise SystemExit(f"{requested} has no camera seed")
                return r
        raise SystemExit(f"room {requested!r} not in plan.json")
    if not indoor:
        raise SystemExit("no indoor room with a camera seed")
    return sorted(indoor, key=lambda r: (-r["area_m2"], r["id"]))[0]        # largest, id tie-break


def pick_seed_for_room(plan, room_id):
    seeds = [cp for cp in plan["camera_points"] if cp["room_id"] == room_id]
    if not seeds:
        raise SystemExit(f"room {room_id!r} has no camera seed")
    return sorted(seeds, key=lambda c: c["id"])[0]                          # lowest id, deterministic


# ----------------------------------------------------------------------------------------------
# the build
# ----------------------------------------------------------------------------------------------

def build(args, log):
    plan = json.load(open(args.plan, encoding="utf-8"))
    if plan.get("units") != "cm":
        raise SystemExit(f"plan.units must be 'cm', got {plan.get('units')!r}")

    all_mode = (args.room == "all")
    general = plan_general.is_general(plan)
    if general and not all_mode:
        raise SystemExit("--room: the single-room debug mode reads walls[].sides and rect_cm (rectilinear "
                         "only); a general plan builds --room all")
    if all_mode:
        rooms_to_build = list(plan["rooms"])                       # file order -> deterministic
        indoor_rooms = [r for r in rooms_to_build if not r["is_outdoor"]]
        single_rid = None
    else:
        room = pick_room(plan, args.room)
        rooms_to_build = [room]
        indoor_rooms = [] if room["is_outdoor"] else [room]
        single_rid = room["id"]

    ceiling_cm = float(plan["plan_meta"]["ceiling_height_cm"])
    walls = {w["id"]: w for w in plan["walls"]}

    log(f"plan      {args.plan}")
    log(f"schema    {plan['schema_version']}   apartment {plan['apartment_id']}")
    if general:
        log(f"geometry  GENERAL (D-WQ-28): polygon walls, oriented openings, panes[] - plan_general.py "
            f"v{plan_general.VERSION} decides, this file builds")
    log(f"mode      {'ALL ROOMS (v1)' if all_mode else f'single room {single_rid!r} (debug/v0 mode)'}")
    log(f"rooms     {len(rooms_to_build)} to build ({len(indoor_rooms)} indoor)")
    log(f"ceiling   {ceiling_cm} cm  <- plan_meta.ceiling_height_cm  [ASSUMED, see assumptions[]]")
    for a in plan["plan_meta"]["assumptions"]:
        log(f"  ASSUMPTION  {a}")

    # ---- empty scene -------------------------------------------------------------------------
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"

    # ---- the style lock (T12) ------------------------------------------------------------------
    style = None if args.no_style else load_style(args.style, log)
    surfaces = (style or {}).get("surfaces")
    floor_slug = ((surfaces or {}).get("floor") or {}).get("slug", "laminate_floor_02")

    # ---- v1.4 (OQ-2, D-WQ-33): the floor carries the REAL tile grid when the apartment has a material
    # board, so the AI skin traces joints instead of inventing them; `--material-board none` = v1.3 -----
    board_rec, board = find_material_board(args.material_board, plan, log)
    floor_tiles, grid_deg, floor_finish = None, 0.0, {"mode": "style-lock", "board": None}
    if board is not None:
        floor_tiles, board_rec["words"] = materials_kit.floor_tiles_from_board(
            board, plan["rooms"], lambda r: floor_class_of(r, surfaces))
        board_rec["version"] = board.get("version")
        grid_deg, grid_info = materials_kit.floor_grid_deg(plan["rooms"])
        if args.floor_grid_deg is not None:
            grid_deg, grid_info = float(args.floor_grid_deg), {"rule": "--floor-grid-deg (an override)"}
        floor_finish = {
            "mode": "tile-grid",
            "board": {"path": board_rec["path"], "id": board.get("id"), "version": board.get("version"),
                      "floor_words": (board.get("surfaces") or {}).get("floor")},
            "grid": {"deg_plan": grid_deg, "deg_world": -grid_deg + 0.0, "estimate": grid_info,
                     "origin": "the plan origin (0, 0) = world (0, 0): a joint crosses there"},
            "joint_mm": materials_kit.GROUT_MM, "joint_linear_rgb": list(materials_kit.COL_GROUT),
            "classes": floor_tiles}
        log(f"floor     TILE GRID from the material board {board.get('id')} v{board.get('version')} "
            f"({board_rec['path']}): {materials_kit.GROUT_MM:g} mm joints, turned {grid_deg:.2f} deg "
            f"(plan frame) about the plan origin - {grid_info.get('rule')}")
        for cls, t in floor_tiles.items():
            log(f"floor       {cls:14s} {t['tile_cm'][0]:g} x {t['tile_cm'][1]:g} cm  {t['state']:8s} <- "
                f"{t['source']}  [{', '.join(t['rooms']) or 'no room'}]")
            for msg in t["ignored"]:
                log(f"WARN      floor tile size not applied (one material per class): {msg}")

    # ---- materials kit (materials_kit.py -- T06 plumbing, T12 numbers) -------------------------
    tex_dir = os.path.join(args.assets, "textures", floor_slug)
    kit = materials_kit.build_kit(tex_dir, log, floor_slug=floor_slug, surfaces=surfaces,
                                  floor_tiles=floor_tiles, grid_deg=grid_deg)
    for cls in (floor_tiles or {}):
        floor_tiles[cls]["material"] = kit[cls].name
    log(f"kit       materials_kit v{materials_kit.VERSION}: {', '.join(sorted(kit))}")
    palette_mats = (materials_kit.build_style_materials(style["palette"], log, glass_mat=kit["glass"])
                    if style else {})

    # ---- floor + ceiling, per room --------------------------------------------------------------
    floors, ceilings = {}, {}
    for room in rooms_to_build:
        rid = room["id"]
        loop = room["loop"] if not general else plan_general.clean_ring(room["loop"])
        # the floor finish is a per-room-type LOOKUP in the style lock, not an if-tree here (v1.4: with
        # a material board each class -- floor, floor_wet, floor_outdoor -- is the tile grid of its size)
        want = ((surfaces or {}).get("floor_by_room_type") or {}).get(room["type"])
        if want is None:
            want = "floor_outdoor" if room["is_outdoor"] else "floor"
        floor_mat = kit.get(want) or kit["floor"]
        floors[rid] = new_slab_face(f"FLOOR_{rid}", loop, 0.0, True, floor_mat)
        # v1.2 (OQ-G4): a ROOFED outdoor room -- a tower terrace under the deck of the floor above -- gets
        # the ceiling slab like an indoor room, and nothing else of an indoor room (no walls, no skirting,
        # no luminaire). Absent on every v0.1 plan, so the rectilinear path runs the same statements.
        if not room["is_outdoor"] or room.get("roofed"):
            ceilings[rid] = new_slab_face(f"CEIL_{rid}", loop, ceiling_cm, False, kit["ceiling"])
            log(f"built     {floors[rid].name:22s} + {ceilings[rid].name:22s}  ({len(loop)}-gon)"
                + ("  roofed outdoor: the deck above" if room["is_outdoor"] else ""))
        else:
            log(f"built     {floors[rid].name:22s}  ({len(loop)}-gon, floor only - outdoor, open "
                f"to the sky above the parapet)")

    # ---- wall solids: EVERY real wall, exactly once (v1 -- no per-room filtering) ----------------
    wall_objs, caps, skipped_virtual = {}, [], []
    for w in (plan["walls"] if not general else []):           # plan order; general: see below
        if w["kind"] == "virtual":
            skipped_virtual.append(w["id"])
            continue
        if not all_mode and single_rid not in w["sides"]:
            continue                                            # debug mode: only this room's walls
        x0, y0, x1, y1 = w["rect_cm"]
        ob = new_box(f"WALL_{w['id']}", x0, y0, x1, y1, 0.0, w["height_cm"], kit["wall"])
        wall_objs[w["id"]] = ob
        log(f"built     {ob.name:26s} {x1-x0:8.1f} x {y1-y0:6.1f} x {w['height_cm']:6.1f} cm  "
            f"{w['kind']:8s} sides={w['sides']}")

    # ---- single-room DEBUG MODE ONLY: probe-only caps over VIRTUAL boundaries -------------------
    # SCHEMA 5: a virtual wall has NO geometry and the scene builder must skip it. In "all" mode
    # every virtual boundary now has the REAL neighbouring room built on its far side -- this is
    # the whole point of T06 -- so no cap is ever built there. The cap survives ONLY for the
    # single-room debug path (T03's original probe use case), where a lone room would otherwise be
    # open to the void.
    if not all_mode and args.cap_virtual == "on":
        room = rooms_to_build[0]
        for wid in skipped_virtual:
            w = walls[wid]
            if single_rid not in w["sides"]:
                continue
            x0, y0, x1, y1 = w["rect_cm"]
            bb = room["bbox_cm"]
            if abs(x1 - x0) < 1e-9:                            # degenerate in x -> a N-S boundary
                outside_west = abs(x0 - bb[0]) < 1e-6
                cx0, cx1 = ((x0 - CAP_THICK_CM, x0) if outside_west else (x1, x1 + CAP_THICK_CM))
                cy0, cy1 = y0, y1
            else:                                              # degenerate in y -> an E-W boundary
                outside_north = abs(y0 - bb[1]) < 1e-6
                cy0, cy1 = ((y0 - CAP_THICK_CM, y0) if outside_north else (y1, y1 + CAP_THICK_CM))
                cx0, cx1 = x0, x1
            ob = new_box(f"PROBECAP_{wid}", cx0, cy0, cx1, cy1, 0.0, ceiling_cm, kit["wall"])
            caps.append(ob.name)
            log(f"PROBE-CAP {ob.name:26s} <- virtual boundary {wid} capped OUTSIDE the room "
                f"(single-room debug mode only)")
    for wid in skipped_virtual:
        log(f"skipped   virtual wall {wid} (SCHEMA 5: no geometry"
            + ("" if all_mode else " - single-room mode) - the real neighbour is not built here")
            + (" - the real neighbouring room IS built, so this stays genuinely open)" if all_mode else ")"))

    # ---- floor fillers under every wall's own footprint (v1 -- fixes the threshold-gap defect) ---
    if not general:                                            # general: the raster fill below
        build_wall_floor_fillers(walls, wall_objs, kit, log)

    # ---- skirting, per INDOOR room -----------------------------------------------------------
    skirt_objs = []
    if not general and OPTS["skirting"]:                       # general: along the facings, below
        for room in indoor_rooms:
            objs = build_skirting(room["loop"], kit["skirting"], room["id"])
            skirt_objs.extend(objs)
        log(f"built     {len(skirt_objs)} skirting board(s) across {len(indoor_rooms)} indoor room(s), "
            f"{SKIRT_H_CM} x {SKIRT_D_CM} cm")

    # ---- openings: boolean cuts + glazing ------------------------------------------------------
    cutters, glazing, cut_records = [], [], []
    for op in (plan["openings"] if not general else []):       # plan order; general: see below
        wid = op["wall_id"]
        if wid not in wall_objs:
            reason = ("virtual wall - no solid to cut, open by construction" if wid in walls
                      and walls[wid]["kind"] == "virtual" else "wall not built in this mode")
            log(f"skipped   opening {op['id']} on {wid} ({reason})")
            continue
        if not all_mode and single_rid not in op["rooms"]:
            log(f"skipped   opening {op['id']} on {wid} (rooms={op['rooms']}, not {single_rid})")
            continue
        w = walls[wid]
        wx0, wy0, wx1, wy1 = w["rect_cm"]
        sill, head = op["sill_cm"], op["head_cm"]
        z0 = sill - CUT_MARGIN_CM if sill <= 1e-9 else sill
        z1 = head + CUT_MARGIN_CM if head >= w["height_cm"] - 1e-9 else head
        if op["axis"] == "x":
            a0 = op["start_cm"] - (CUT_MARGIN_CM if abs(op["start_cm"] - wx0) < 1e-9 else 0.0)
            a1 = op["end_cm"] + (CUT_MARGIN_CM if abs(op["end_cm"] - wx1) < 1e-9 else 0.0)
            cx0, cx1 = a0, a1
            cy0, cy1 = wy0 - CUT_MARGIN_CM, wy1 + CUT_MARGIN_CM
            gx0, gx1, gy0, gy1 = op["start_cm"], op["end_cm"], None, None
        else:
            a0 = op["start_cm"] - (CUT_MARGIN_CM if abs(op["start_cm"] - wy0) < 1e-9 else 0.0)
            a1 = op["end_cm"] + (CUT_MARGIN_CM if abs(op["end_cm"] - wy1) < 1e-9 else 0.0)
            cy0, cy1 = a0, a1
            cx0, cx1 = wx0 - CUT_MARGIN_CM, wx1 + CUT_MARGIN_CM
            gx0, gx1, gy0, gy1 = None, None, op["start_cm"], op["end_cm"]

        cut = new_box(f"CUT_{op['id']}", cx0, cy0, cx1, cy1, z0, z1)
        cutters.append(cut)
        # the same cutter cuts the wall AND every skirting board (a non-intersecting boolean is a
        # no-op, so no coincidence test is needed and the result stays order-independent) -- v1:
        # `skirt_objs` is now the WHOLE apartment's skirting, so a doorway that sits on a shared
        # wall correctly clips skirting on BOTH sides of it, not just one room's.
        for target in [wall_objs[wid]] + (skirt_objs if sill <= 1e-9 else []):
            mod = target.modifiers.new(f"BOOL_{op['id']}", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.solver = "EXACT"
            mod.object = cut
        cut_records.append({"opening": op["id"], "wall": wid, "kind": op["kind"],
                            "axis": op["axis"], "width_cm": op["width_cm"],
                            "start_cm": op["start_cm"], "end_cm": op["end_cm"],
                            "sill_cm": sill, "head_cm": head, "rooms": op["rooms"]})
        log(f"cut       {op['id']:20s} {op['kind']:14s} on {wid:14s} "
            f"{op['width_cm']:7.1f} cm wide, {sill:5.1f}-{head:5.1f} cm high  rooms={op['rooms']}")

        # glazing: a real pane + a frame, on the wall's centre plane.
        # ⭐ T13: `entrance_door` joins the list with a SOLID leaf instead of a pane. Measured on the
        #    first full draft: the flat's front door was cut as an open hole whose other side is
        #    "outside", so `cp-entry` looked straight out of the building at 200 m of terrain and open
        #    sky — an envelope hole where a real unit has a door. It is not a texture question and not
        #    an exterior question: the LEAF is the faithful geometry. Exactly one opening in the pilot
        #    has this kind, and balcony doors (`sliding_door`/`glazed_door`) are untouched.
        leaf_kind = op["kind"] == "entrance_door"
        if op["kind"] in ("window", "sliding_door", "glazed_door") or leaf_kind:
            thick = DOOR_LEAF_THICK_CM if leaf_kind else GLASS_THICK_CM
            if op["axis"] == "x":
                mid = (wy0 + wy1) / 2.0
                pane = (gx0, mid - thick / 2, gx1, mid + thick / 2)
                fr = [(gx0, mid - FRAME_D_CM / 2, gx1, mid + FRAME_D_CM / 2, sill, sill + FRAME_W_CM),
                      (gx0, mid - FRAME_D_CM / 2, gx1, mid + FRAME_D_CM / 2, head - FRAME_W_CM, head),
                      (gx0, mid - FRAME_D_CM / 2, gx0 + FRAME_W_CM, mid + FRAME_D_CM / 2, sill, head),
                      (gx1 - FRAME_W_CM, mid - FRAME_D_CM / 2, gx1, mid + FRAME_D_CM / 2, sill, head)]
            else:
                mid = (wx0 + wx1) / 2.0
                pane = (mid - thick / 2, gy0, mid + thick / 2, gy1)
                fr = [(mid - FRAME_D_CM / 2, gy0, mid + FRAME_D_CM / 2, gy1, sill, sill + FRAME_W_CM),
                      (mid - FRAME_D_CM / 2, gy0, mid + FRAME_D_CM / 2, gy1, head - FRAME_W_CM, head),
                      (mid - FRAME_D_CM / 2, gy0, mid + FRAME_D_CM / 2, gy0 + FRAME_W_CM, sill, head),
                      (mid - FRAME_D_CM / 2, gy1 - FRAME_W_CM, mid + FRAME_D_CM / 2, gy1, sill, head)]
            glazing.append(new_box(f"{'LEAF' if leaf_kind else 'GLASS'}_{op['id']}",
                                   pane[0], pane[1], pane[2], pane[3], sill, head,
                                   kit["skirting"] if leaf_kind else kit["glass"]).name)
            for i, f in enumerate(fr):
                glazing.append(new_box(f"FRAME_{op['id']}_{i}", f[0], f[1], f[2], f[3], f[4], f[5],
                                       kit["frame"]).name)

    for wid, ob in wall_objs.items():                          # dict preserves insertion order
        bake_modifiers(ob)
    for ob in skirt_objs:
        bake_modifiers(ob)
    skirt_objs = [o for o in skirt_objs if len(o.data.vertices)]   # a fully-cut board is empty
    for c in cutters:
        me = c.data
        bpy.data.objects.remove(c, do_unlink=True)
        bpy.data.meshes.remove(me)

    # ---- the GENERAL-polygon architecture (v1.2, D-WQ-28): walls, facings, skirting, panes, openings,
    #      the floor/ceiling fill -- it replaces the four blocks above, which ran empty for this plan ------
    general_ctx = None
    if general:
        general_ctx = build_general_architecture(plan, kit, ceiling_cm, indoor_rooms, surfaces, log,
                                                 fixture_masses=not general_furnishing_on(args, style))
        wall_objs = general_ctx["wall_objs"]
        skirt_objs = general_ctx["skirting_objs"]
        glazing = general_ctx["glazing"]
        cut_records = general_ctx["cut_records"]

    # ---- terrain (v1, "all" mode only -- pointless under a single lonely room) -------------------
    terrain_info = None
    if all_mode:
        _terrain_ob, terrain_info = build_terrain(plan, kit, log)

    # ---- world (environment) -------------------------------------------------------------------
    # CONTRACT §17.3 / A9-7 / C-360-91: the environment is selected BY RECORDED IDENTITY -- the style
    # lock's surfaces.hdri {slug, file, sha256, exterior_class} -- and NEVER by a directory scan.
    # (Superseded code took `sorted(os.listdir(<assets>/hdri))[0]` from a GITIGNORED directory while
    # the lock's slug+hash went unread: a replacement whose filename sorted after `clarens_midday…`
    # was silently ignored and the log stayed green.  A9 caught it; this is the fix.)
    hdri_path, hdri_ident = resolve_environment(style, args.assets, log)
    world = bpy.data.worlds.new("W_env")
    world.use_nodes = True
    scene.world = world
    nt = world.node_tree
    bg = nt.nodes["Background"]
    strength = hdri_ident["strength"] if hdri_ident else HDRI_STRENGTH
    rot_z = hdri_ident["rot_z_deg"] if hdri_ident else HDRI_ROT_Z_DEG
    bg.inputs["Strength"].default_value = strength
    if hdri_path:
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(hdri_path, check_existing=True)
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Rotation"].default_value = (0.0, 0.0, math.radians(rot_z))
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
        log(f"world     HDRI slug {hdri_ident['slug']} ({os.path.basename(hdri_path)}) "
            f"sha256 {hdri_ident['sha256'][:16]}... exterior_class {hdri_ident['exterior_class']} "
            f"strength {strength} rot_z {rot_z} deg")
    else:
        # A9-5's named zero-risk fallback: A8-18's "neutral wash".  Reachable only with --no-style
        # (or a style lock carrying no environment row) -- NEVER as a fallback from a failed
        # identity check, which refuses instead.
        bg.inputs["Color"].default_value = (0.55, 0.68, 0.85, 1.0)
        log("world     flat sky wash (no environment row in the style lock) - "
            "non-locating by construction")

    # ---- sun -----------------------------------------------------------------------------------
    sun_data = bpy.data.lights.new("L_sun", type="SUN")
    sun_data.energy = SUN_ENERGY
    sun_data.angle = math.radians(SUN_ANGLE_DEG)
    sun = bpy.data.objects.new("L_sun", sun_data)
    # +Z of a sun lamp points AT the sun; -Z is the direction the light travels.
    sun.rotation_euler = (math.radians(90.0 - SUN_ELEVATION_DEG), 0.0,
                          math.radians(180.0 - SUN_AZIMUTH_PLAN_DEG))
    scene.collection.objects.link(sun)
    log(f"light     L_sun  azimuth {SUN_AZIMUTH_PLAN_DEG} deg (plan bearing), elevation "
        f"{SUN_ELEVATION_DEG} deg, {SUN_ENERGY} W/m2")

    # ---- daylight panels (T12: the rule reads the plan; T06 hand-authored one for r-living) ------
    lighting = (style or {}).get("lighting", {})
    daylit = rooms_with_daylight_opening(plan)
    daylight_panels = []
    if style and lighting.get("daylight_panel") and not general:
        daylight_panels = add_daylight_panels(plan, rooms_to_build, lighting["daylight_panel"], log)
    if general:
        log("light     daylight panels SKIPPED - general plan: the rule keys on window/sliding_door openings "
            "in rect walls; the facade panes light the rooms directly")

    # ================================================================================================
    # FURNISHING (T12) -- placement_templates.py decides WHERE, the style lock decides WHICH MODEL,
    # this block only executes the result. Every piece is placed in the templates' own deterministic
    # order, and every model file is hash-verified against the lock before a single one is imported.
    # ================================================================================================
    furn, coverage_lights, placement_report, model_hashes, style_swaps = [], [], {}, [], {}
    if style and not args.no_furniture and not general:
        st = placement_templates.Style(style)
        furnished, _placers = placement_templates.furnish_plan(plan, st, seed=args.furnish_seed,
                                                               log=log)
        violations = placement_templates.check_placements(plan, st, furnished)
        placement_report = {"seed": args.furnish_seed,
                            "templates_version": placement_templates.VERSION,
                            "bars_cm": {"walkway": placement_templates.WALKWAY_CM,
                                        "camera_bubble": placement_templates.CAMERA_BUBBLE_CM,
                                        "door_swing_min": placement_templates.DOOR_SWING_MIN_CM,
                                        "door_swing_max": placement_templates.DOOR_SWING_MAX_CM,
                                        "sliding_clear": placement_templates.SLIDING_CLEAR_CM,
                                        "wall_art_centre": placement_templates.WALL_ART_CENTRE_CM,
                                        "wall_art_min_bottom":
                                            placement_templates.WALL_ART_MIN_BOTTOM_CM,
                                        "wall_art_clear_over":
                                            placement_templates.WALL_ART_CLEAR_OVER_CM},
                            "violations": violations,
                            "rooms": {rid: {"template": rec["template"],
                                            "placements": rec["placements"]}
                                      for rid, rec in furnished.items()}}
        if violations:
            for v in violations:
                log(f"VIOLATION {v['rule']} {v['room']}/{v['slot']}: {v['detail']}")
            raise SystemExit(f"{len(violations)} placement rule violation(s) - refusing to build a "
                             f"scene the templates' own checker rejects")

        used_ids = sorted({p["model"] for rec in furnished.values() for p in rec["placements"]
                           if p["model"]})
        model_hashes = verify_model_hashes(style, used_ids, log)

        cache_dirs = {}
        for room in rooms_to_build:                        # plan order -> deterministic
            rid = room["id"]
            rec = furnished.get(rid)
            if not rec:
                continue
            for p in rec["placements"]:
                mid = p["model"]
                if p["class"] == "ceiling_light" and mid is None:
                    coverage_lights.append(
                        add_t06_point_light(room, ceiling_cm, p["x_cm"], p["y_cm"], log)
                        if args.luminaire == "t06-point" else
                        add_ceiling_luminaire(
                            room, lighting.get("ceiling_luminaire", LUMINAIRE_FALLBACK), ceiling_cm,
                            p["x_cm"], p["y_cm"], palette_mats, log))
                    continue
                spec = style["models"][mid]
                path = os.path.join(REPO_360, spec["file"].replace("/", os.sep))
                tag = f"{rid}_{p['slot']}"
                log(f"furniture {mid:44s} -> {rid}/{p['slot']} at ({p['x_cm']:.0f}, {p['y_cm']:.0f}) "
                    f"cm, facing {p['yaw_deg']:.0f} deg, anchor {p['anchor']}")
                if spec["format"] == "glb":
                    empty, objs = import_glb(path, tag, log)
                else:
                    empty, objs = append_model(path, tag, log)
                swaps = apply_style_materials(objs, spec, style, palette_mats, log)
                for a, b in swaps:
                    style_swaps[a] = b
                rec2 = place_model(empty, objs, p["x_cm"], p["y_cm"], p["yaw_deg"], p["anchor"],
                                   spec.get("front_local", "-Y"), ceiling_cm,
                                   scale_xyz=tuple(spec.get("scale_xyz") or [spec.get("scale", 1.0)] * 3),
                                   z_cm=p.get("z_cm"))
                rec2.update({"model": mid, "room_id": rid, "slot": p["slot"], "class": p["class"],
                             "source_file": spec["file"], "x_cm": p["x_cm"], "y_cm": p["y_cm"],
                             "yaw_deg": p["yaw_deg"], "anchor": p["anchor"], "layer": p["layer"],
                             "front_local": spec.get("front_local", "-Y"), "rule": p["rule"],
                             "objects": sorted(o.name for o in objs)})
                bpy.context.view_layer.update()      # evaluate the new parent chain NOW, so any
                #                                      later matrix_world read is the real transform
                furn.append(rec2)
                cache_dirs[mid] = cache_dirs.get(mid, 0) + 1
                # a pendant model carries its own bulb, inside the shade
                if p["class"] == "pendant" and lighting.get("pendant_bulb"):
                    hang = float(lighting["pendant_bulb"].get("hang_below_fixture_cm", 8.0))
                    bulb_z = ceiling_cm - spec["height_cm"] + hang
                    coverage_lights.append(add_pendant_bulb(room, lighting["pendant_bulb"],
                                                            p["x_cm"], p["y_cm"], bulb_z, log))
        log(f"furnished {len(furn)} model placement(s) + {len(coverage_lights)} luminaire(s) across "
            f"{sum(1 for r in furnished.values() if r['placements'])} room(s); "
            f"{len(set(cache_dirs))} distinct catalog model(s) used")
        # imported materials that nothing references any more (every slot was restyled)
        for m in sorted(bpy.data.materials, key=lambda m: m.name):
            if m.users == 0:
                bpy.data.materials.remove(m)
    elif general:
        coverage_lights, placement_report = furnish_general(plan, rooms_to_build, indoor_rooms, lighting,
                                                            ceiling_cm, palette_mats, args, log,
                                                            furnished=general_furnishing_on(args, style))
        if general_furnishing_on(args, style):
            furn, model_hashes, style_swaps, gf_report, objs = build_general_furniture(
                plan, style, ceiling_cm, palette_mats, kit, log)
            placement_report["furnishing"] = gf_report
            general_ctx["furniture_objs"] = objs
    elif not style:
        log("style     --no-style: no furniture, no style palette, architecture only")

    # ---- camera: ONE object, positioned at a deterministic default seed --------------------------
    default_room_id = (single_rid if not all_mode else
                       sorted(indoor_rooms, key=lambda r: (-r["area_m2"], r["id"]))[0]["id"])
    seed = pick_seed_for_room(plan, default_room_id)
    cam_data = bpy.data.cameras.new(f"CAM_{seed['id']}")
    cam_data.type = "PANO"
    pano_api = "camera.panorama_type (4.3+)"
    if hasattr(cam_data, "panorama_type"):
        cam_data.panorama_type = "EQUIRECTANGULAR"
    else:                                                       # <= 4.2 kept it on the add-on
        cam_data.cycles.panorama_type = "EQUIRECTANGULAR"
        pano_api = "camera.cycles.panorama_type (<=4.2)"
    cam_data.clip_start = 0.01
    cam_data.clip_end = float((terrain_info or {}).get("clip_end_m", 200.0))   # v1.2: a deep ground clips further
    cam = bpy.data.objects.new(f"CAM_{seed['id']}", cam_data)
    cam.location = (wx(seed["x"]), wy(seed["y"]), wz(seed["z"]))
    cam.rotation_euler = (math.radians(90.0), 0.0, math.radians(-seed["yaw_deg"]))
    scene.collection.objects.link(cam)
    scene.camera = cam
    log(f"camera    {cam.name} (default) at plan ({seed['x']}, {seed['y']}, {seed['z']}) cm, "
        f"yaw {seed['yaw_deg']} deg -> world {tuple(round(v, 4) for v in cam.location)}, "
        f"euler_z {round(-seed['yaw_deg'], 4)} deg  [{pano_api}]  "
        f"-- render_pano.py re-points this ONE object per camera_points[] entry at render time")

    # ---- render settings (T04/T07 own the final numbers; these are sane draft defaults) ------------
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.seed = args.seed
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 12
    scene.cycles.transmission_bounces = 12
    scene.cycles.transparent_max_bounces = 16          # potted_plant_02 uses an alpha leaf mask
    scene.render.resolution_x = 4096                   # V2-PLAN 5.3 draft; final = 8192x4096
    scene.render.resolution_y = 2048
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_layers[0].use_pass_z = True             # the depth pass, same projection
    scene.view_settings.exposure = 0.0
    view_look = "None"
    try:
        scene.view_settings.view_transform = "AgX"
        for cand in ("AgX - Punchy", "Punchy"):
            try:
                scene.view_settings.look = cand
                view_look = cand
                break
            except TypeError:
                continue
    except TypeError:
        pass
    log(f"render    CYCLES/GPU seed {args.seed}, {scene.render.resolution_x}x"
        f"{scene.render.resolution_y} draft, view_transform "
        f"{scene.view_settings.view_transform} look {view_look}")

    return {"plan": plan, "all_mode": all_mode, "single_rid": single_rid, "general": general,
            "general_ctx": general_ctx,
            "rooms_built": rooms_to_build, "indoor_rooms": indoor_rooms,
            "built_room_ids": {r["id"] for r in rooms_to_build},
            "ceiling_cm": ceiling_cm, "walls": walls,
            "wall_objs": wall_objs, "floors": floors, "ceilings": ceilings, "caps": caps,
            "skirting": [o.name for o in skirt_objs],
            "glazing": glazing, "cut_records": cut_records, "furniture": furn,
            "coverage_lights": coverage_lights, "terrain": terrain_info,
            "style": style, "placement": placement_report, "model_hashes": model_hashes,
            "daylight_panels": daylight_panels, "style_material_swaps": style_swaps,
            "seed_point": seed, "skipped_virtual": skipped_virtual, "hdri": hdri_path,
            "hdri_ident": hdri_ident,
            "pano_api": pano_api, "view_look": view_look, "kit": kit,
            "material_board": board_rec, "floor_finish": floor_finish}


# ----------------------------------------------------------------------------------------------
# geometry + camera-clearance verification -- measured off the BUILT MESH, never off the inputs
# ----------------------------------------------------------------------------------------------

def verify(ctx, log):
    if ctx.get("general"):
        return verify_general(ctx, log)
    bpy.context.view_layer.update()   # ⛔ every furniture mesh is positioned by a PARENT empty; a
    #                                   stale matrix_world would measure it at the world origin
    checks = []

    def chk(label, measured_cm, expected_cm, source):
        err_mm = abs(measured_cm - expected_cm) * 10.0
        ok = err_mm <= 1.0
        checks.append({"check": label, "measured_cm": round(measured_cm, 6),
                       "expected_cm": expected_cm, "error_mm": round(err_mm, 6),
                       "pass": ok, "source": source})
        log(f"  [{'PASS' if ok else 'FAIL'}] {label:<58s} measured {measured_cm:11.4f} cm  "
            f"expected {expected_cm:11.4f} cm  err {err_mm:8.5f} mm   <- {source}")
        return ok

    walls = ctx["walls"]
    log("")
    log(f"GEOMETRY CHECKS  ({len(ctx['wall_objs'])} walls, {len(ctx['rooms_built'])} rooms, "
        f"tolerance 1.000 mm)")

    # --- every wall's own length/thickness/height (a superset of "three cross-room walls") -----
    for wid, ob in ctx["wall_objs"].items():
        w = walls[wid]
        mn, mx = mesh_bbox(ob)
        x0, y0, x1, y1 = w["rect_cm"]
        chk(f"wall {wid} length along x", (mx.x - mn.x) * 100.0, x1 - x0, f"walls[{wid}].rect_cm")
        chk(f"wall {wid} thickness along y", (mx.y - mn.y) * 100.0, y1 - y0, f"walls[{wid}].rect_cm")
        chk(f"wall {wid} height", (mx.z - mn.z) * 100.0, w["height_cm"], f"walls[{wid}].height_cm")

    # --- every room's own clear dimensions + (indoor) ceiling height ---------------------------
    for room in ctx["rooms_built"]:
        rid = room["id"]
        mn, mx = mesh_bbox(ctx["floors"][rid])
        chk(f"room {rid} clear width (floor bbox, x)", (mx.x - mn.x) * 100.0,
            room["clear_dims_cm"][0], f"rooms[{rid}].clear_dims_cm[0]")
        chk(f"room {rid} clear depth (floor bbox, y)", (mx.y - mn.y) * 100.0,
            room["clear_dims_cm"][1], f"rooms[{rid}].clear_dims_cm[1]")
        if rid in ctx["ceilings"]:
            mnc, mxc = mesh_bbox(ctx["ceilings"][rid])
            chk(f"room {rid} floor-to-ceiling height", (mnc.z - mn.z) * 100.0, ctx["ceiling_cm"],
                "plan_meta.ceiling_height_cm [ASSUMED]")

    # --- the apertures the booleans actually produced -------------------------------------------
    # ⚠ v1 found a real bug here (not present in T03's single-room probe, which never built a wall
    # carrying TWO cuts): scoping the vertex search to the WALL's own extent conflates every
    # aperture on a multi-opening wall (w-south-glaz carries both win-kitchen-s and
    # d-balcony-south; w-ext-s carries both win-master-s and win-ensuite-s) into one bogus span.
    # ⚠ A second, related bug surfaced fixing the first: a tight window around ONE opening can
    # still reach PAST the wall's own physical end when that opening sits close to it (d-bed-2 ends
    # 10.1 cm short of w-bed2-e's far corner -- inside the naive +13 cm margin), so it must ALSO be
    # clamped to the wall's own extent (excluding the wall's own corner vertices, `+/-1e-3`, exactly
    # as the original v0 single-opening check already did -- v1 needs BOTH properties at once, not
    # a trade of one bug for the other).
    aperture_margin_cm = CUT_MARGIN_CM + 5.0
    for rec in ctx["cut_records"]:
        ob = ctx["wall_objs"][rec["wall"]]
        w = walls[rec["wall"]]
        axis = 0 if rec["axis"] == "x" else 1
        wall_lo, wall_hi = (w["rect_cm"][0], w["rect_cm"][2]) if axis == 0 else (w["rect_cm"][1], w["rect_cm"][3])
        lo = max(wall_lo, rec["start_cm"] - aperture_margin_cm)
        hi = min(wall_hi, rec["end_cm"] + aperture_margin_cm)
        vals = set()
        for v in ob.data.vertices:
            c = v.co[axis] * 100.0 * (1.0 if axis == 0 else -1.0)
            if lo + 1e-3 < c < hi - 1e-3:
                vals.add(round(c, 4))
        if len(vals) >= 2:
            chk(f"aperture {rec['opening']} width in the cut wall", max(vals) - min(vals),
                rec["width_cm"], f"openings[{rec['opening']}].width_cm")
        zs = {round(v.co.z * 100.0, 4) for v in ob.data.vertices}
        cands = [z for z in zs if abs(z - rec["head_cm"]) < 0.5]
        if cands:
            chk(f"aperture {rec['opening']} head height", cands[0], rec["head_cm"],
                f"openings[{rec['opening']}].head_cm")

    # --- camera clearance: every camera point in a built room, against the BUILT (post-boolean)
    # wall meshes and any furniture mesh -- a 2-D distance to plan.json's loop would over-count
    # closeness at a doorway (place_cameras.py's own docstring explains why); this is the real,
    # authoritative check the task's acceptance criterion asks for. ---------------------------
    log("")
    log(f"CAMERA CLEARANCE CHECKS  (bar {CAMERA_MIN_CLEARANCE_CM:.0f} cm from any wall face or "
        f"furniture mesh, measured on the built mesh)")
    wall_bvhs = []
    for wid, ob in ctx["wall_objs"].items():
        b = mesh_bvh(ob)
        if b is not None:
            wall_bvhs.append((ob.name, b))
    for name in ctx["caps"]:
        ob = bpy.data.objects.get(name)
        if ob is not None:
            b = mesh_bvh(ob)
            if b is not None:
                wall_bvhs.append((ob.name, b))
    furn_bvhs = []
    for rec in ctx["furniture"]:
        for name in rec["objects"]:
            ob = bpy.data.objects.get(name)
            if ob is not None and ob.type == "MESH":
                b = mesh_bvh(ob)
                if b is not None:
                    furn_bvhs.append((ob.name, b))

    camera_checks = []
    for cp in ctx["plan"]["camera_points"]:
        if cp["room_id"] not in ctx["built_room_ids"]:
            continue                          # not part of THIS build (relevant in debug mode only)
        p = Vector((wx(cp["x"]), wy(cp["y"]), wz(cp["z"])))
        candidates = []
        for name, b in wall_bvhs:
            _loc, _nrm, _idx, dist = b.find_nearest(p)
            if dist is not None:
                candidates.append((dist, name, "wall"))
        for name, b in furn_bvhs:
            _loc, _nrm, _idx, dist = b.find_nearest(p)
            if dist is not None:
                candidates.append((dist, name, "furniture"))
        if not candidates:
            log(f"  WARN  camera {cp['id']}: no nearby mesh found to measure clearance against")
            continue
        dist_m, nearest_name, nearest_kind = min(candidates, key=lambda t: t[0])
        dist_cm = dist_m * 100.0
        ok = dist_cm >= CAMERA_MIN_CLEARANCE_CM
        camera_checks.append({"camera": cp["id"], "room_id": cp["room_id"],
                              "clearance_cm": round(dist_cm, 2), "nearest": nearest_name,
                              "nearest_kind": nearest_kind, "pass": bool(ok)})
        log(f"  [{'PASS' if ok else 'FAIL'}] camera {cp['id']:<18s} room {cp['room_id']:<18s} "
            f"clearance {dist_cm:7.2f} cm from {nearest_kind} {nearest_name}")

    return checks, camera_checks


# ----------------------------------------------------------------------------------------------
# save + report
# ----------------------------------------------------------------------------------------------

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


TRACK_ROOT = os.path.dirname(os.path.dirname(SCRIPT_PATH))     # .../360walkaround
LEGAL_EXTERIOR_CLASSES = ("non-locating", "locating")


def resolve_environment(style, assets_dir, log):
    """CONTRACT A9-7 / C-360-91 -- select the world environment BY RECORDED IDENTITY.

    Returns (abs_path, ident) or (None, None) when the style lock records no environment at all
    (--no-style, or a lock that deliberately ships A8-18's neutral wash).

    ⛔ REFUSES (SystemExit -> exit 1) on: a malformed row · a missing file · a sha256 mismatch ·
    more than one candidate file for the recorded slug · an exterior_class that is not exactly
    `non-locating`.  ⛔ It never falls back to another file and never "picks the first one" --
    a fallback is what made the old directory scan a silent, multi-hour mistake.
    """
    row = ((style or {}).get("surfaces") or {}).get("hdri")
    if not row:
        return None, None

    def refuse(msg):
        raise SystemExit(
            "environment REFUSED (CONTRACT A9-7 / C-360-91): " + msg +
            "\n  the style lock's surfaces.hdri row is the ONLY selector; fix the row or the file, "
            "\n  ⛔ do not drop a replacement into the assets directory and expect it to be picked up."
        )

    for key in ("slug", "file", "sha256", "exterior_class"):
        if not row.get(key):
            refuse(f"surfaces.hdri has no {key!r} (an environment row needs slug + file + sha256 + "
                   f"exterior_class; the last is A9-8's required field)")
    slug, want = row["slug"], row["sha256"].lower()
    cls = row["exterior_class"]
    if cls not in LEGAL_EXTERIOR_CLASSES:
        refuse(f"exterior_class {cls!r} is not one of {LEGAL_EXTERIOR_CLASSES} "
               f"(⚠ the canonical spelling is hyphenated: 'non-locating', not 'non_locating')")
    if cls != "non-locating":
        refuse(f"exterior_class is {cls!r} -- C-360-90 makes only 'non-locating' legal for a tour "
               f"render. {slug!r} may not appear in a delivered frame.")

    # candidates: the lock's own track-root-relative path, and the same basename under --assets.
    base = os.path.basename(row["file"])
    cands = [os.path.abspath(os.path.join(TRACK_ROOT, row["file"].replace("/", os.sep))),
             os.path.abspath(os.path.join(assets_dir, "hdri", base))]
    # ...plus anything else in those directories that claims the same slug -- an ambiguity, not a choice.
    for d in {os.path.dirname(c) for c in cands}:
        if os.path.isdir(d):
            for n in sorted(os.listdir(d)):
                if n.lower().startswith(slug.lower()) and n.lower().endswith((".hdr", ".exr")):
                    cands.append(os.path.abspath(os.path.join(d, n)))
    present, seen = [], set()
    for c in cands:
        key = os.path.normcase(os.path.realpath(c))
        if os.path.isfile(c) and key not in seen:
            seen.add(key)
            present.append(c)
    if not present:
        refuse(f"no file on disk for slug {slug!r}. Looked at:\n    " + "\n    ".join(cands) +
               "\n  re-fetch: PYTHONIOENCODING=utf-8 python "
               "360walkaround/pipeline/probe/probe-assets/fetch-assets.py")
    if len(present) > 1:
        refuse(f"{len(present)} candidate files for slug {slug!r} -- ambiguous, so the build stops "
               f"rather than guess:\n    " + "\n    ".join(present))

    path = present[0]
    got = sha256_file(path)
    if got != want:
        refuse(f"sha256 MISMATCH on {path}\n    recorded {want}\n    on disk  {got}\n"
               "  the file on disk is not the file the style lock pins.")

    # ⚠ every OTHER environment file in that directory is ignored BY DESIGN -- say so out loud, because
    # being silently ignored is the exact failure A9 caught.
    d = os.path.dirname(path)
    strays = [n for n in sorted(os.listdir(d))
              if n.lower().endswith((".hdr", ".exr")) and n != os.path.basename(path)]
    if strays:
        log(f"world     NOTE {len(strays)} other environment file(s) in {os.path.relpath(d, TRACK_ROOT)}"
            f" IGNORED BY DESIGN (selection is by recorded identity, not by directory order): "
            + ", ".join(strays))

    ident = {
        "slug": slug,
        "file": os.path.relpath(path, TRACK_ROOT).replace("\\", "/"),
        "sha256": got,
        "exterior_class": cls,
        "strength": float(row.get("strength", HDRI_STRENGTH)),
        "rot_z_deg": float(row.get("rot_z_deg", HDRI_ROT_Z_DEG)),
        "provenance_row": row.get("provenance_row"),
        "selected_by": "recorded identity (style lock surfaces.hdri slug + sha256) -- C-360-91",
    }
    return path, ident


def relativise_images(out_blend, log):
    """Point every image at a path relative to the OUTPUT .blend, so the scene survives a repo move.
    (Blender absolutises library image paths on append -- measured on 4.5.10.)

    ⚠ On Windows `os.path.relpath` RAISES when the two paths are on different drives -- which is
    exactly what happens when the .blend goes to a `C:\\...\\Temp` scratch dir while the CC0 assets
    live on `D:`. Caught here: the image keeps its absolute path, which still renders."""
    base = os.path.dirname(os.path.abspath(out_blend))
    broken = []
    for img in sorted(bpy.data.images, key=lambda i: i.name):
        if img.packed_file or not img.filepath:
            continue
        ab = bpy.path.abspath(img.filepath)
        if not os.path.exists(ab):
            broken.append((img.name, img.filepath))
            continue
        try:
            img.filepath = "//" + os.path.relpath(ab, base).replace(os.sep, "/")
        except ValueError:
            img.filepath = ab.replace(os.sep, "/")      # different drive: absolute is the only path
    for name, fp in broken:
        log(f"WARN      image {name} unresolved: {fp}")
    return broken


def main(argv):
    ap = argparse.ArgumentParser(prog="build_scene.py", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan", help="path to plan.json")
    ap.add_argument("--room", default="all",
                    help="'all' (v1 default: build the whole apartment), 'auto' (single-room debug "
                         "mode: the largest indoor room with a camera seed), or a specific room id")
    ap.add_argument("--out", required=True, help="output .blend")
    ap.add_argument("--assets", default=os.path.join(os.path.dirname(SCRIPT_PATH),
                                                     "probe", "probe-assets"))
    ap.add_argument("--report", default=None, help="output report json (default: <out>.report.json)")
    ap.add_argument("--seed", type=int, default=0, help="the CYCLES sampling seed (not furnishing)")
    ap.add_argument("--style", default=DEFAULT_STYLE,
                    help="the style lock json (T12). A style change is a NEW FILE, never an edit.")
    ap.add_argument("--no-style", action="store_true",
                    help="build the architecture only: no style palette, no catalog, no furniture")
    ap.add_argument("--furnish-seed", type=int, default=0,
                    help="the placement seed: same seed => byte-identical transforms; a different "
                         "seed => a different but equally rule-legal layout")
    ap.add_argument("--no-furniture", action="store_true")
    ap.add_argument("--general-furnish", choices=["on", "off"], default="on",
                    help="v1.5: a general plan is furnished with catalog models (on) or built with the v1.4 "
                         "grey fixture masses (off, the control)")
    ap.add_argument("--luminaire", default="style", choices=["style", "t06-point"],
                    help="'style' (default) = the lock's flush downward area disc; 't06-point' "
                         "rebuilds T06's superseded bare point light 15 cm under the ceiling, as "
                         "the CONTROL for the ceiling-clip fix. Recorded in the report either way.")
    ap.add_argument("--cap-virtual", choices=["on", "off"], default="on",
                    help="single-room debug mode ONLY: close a virtual boundary from OUTSIDE so a "
                         "lone room is sealed. Ignored in --room all (the real neighbour is built).")
    ap.add_argument("--material-board", default="auto",
                    help="v1.4 (OQ-2): 'auto' (default) = Habait/tour360/apartments/<apartment_id>/"
                         "material-board.json under the harness root - when it exists every floor is a "
                         "procedural tile grid with the sizes it states; 'none' = the style lock floor "
                         "(the v1.3 scene, the control); or a path to a board")
    ap.add_argument("--floor-grid-deg", type=float, default=None,
                    help="v1.4: the tile grid direction, plan frame (deg from +x toward +y). Default: "
                         "the length-weighted mode of the room walls (materials_kit.floor_grid_deg)")
    ap.add_argument("--door-style", choices=["cased", "zero-line"], default="cased",
                    help="interior doors: 'cased' (lining + architraves, the default) or 'zero-line' (frameless, flush: "
                         "the lining only, no architrave on either face)")
    ap.add_argument("--skirting", choices=["on", "off"], default="on",
                    help="'off' builds no skirting board: the floor meets the wall in a clean line")
    ap.add_argument("--pack", action="store_true", help="pack textures into the .blend")
    ap.add_argument("--no-strict", action="store_true", help="do not exit 1 on a failed check")
    args = ap.parse_args(argv)
    general_furnish.DOOR_STYLE = args.door_style
    OPTS["skirting"] = args.skirting == "on"

    args.plan = os.path.abspath(args.plan)
    args.out = os.path.abspath(args.out)
    args.assets = os.path.abspath(args.assets)
    args.style = os.path.abspath(args.style)
    if args.no_style:
        args.no_furniture = True
    if args.report is None:
        args.report = os.path.splitext(args.out)[0] + ".report.json"

    lines = []

    def log(msg=""):
        print(msg, flush=True)
        lines.append(msg)

    log("=" * 96)
    log(f"build_scene.py v{VERSION}   (board 360-v2 T06 - whole-apartment builder)")
    log(f"blender   {bpy.app.version_string}   python {sys.version.split()[0]}")
    log("=" * 96)

    ctx = build(args, log)
    checks, camera_checks = verify(ctx, log)
    failed = [c for c in checks if not c["pass"]]
    failed_cam = [c for c in camera_checks if not c["pass"]]

    broken = relativise_images(args.out, log)
    if args.pack:
        bpy.ops.file.pack_all()
        log("packed    all external files into the .blend")

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=args.out, compress=True)
    size = os.path.getsize(args.out)
    log(f"saved     {args.out}  ({size:,} bytes)")

    report = {
        "generator": {"script": "pipeline/build_scene.py", "version": VERSION,
                      "script_sha256": sha256_file(SCRIPT_PATH),
                      "materials_kit_version": materials_kit.VERSION,
                      "place_cameras_version": place_cameras.VERSION,
                      "placement_templates_version": placement_templates.VERSION,
                      "placement_templates_sha256": sha256_file(
                          os.path.join(os.path.dirname(SCRIPT_PATH), "placement_templates.py")),
                      "materials_kit_sha256": sha256_file(
                          os.path.join(os.path.dirname(SCRIPT_PATH), "materials_kit.py")),
                      "blender": bpy.app.version_string,
                      "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds")},
        # ⛔ RAIL 2: every one of these is part of the rerun-skip key. A scene is CLEAN only while
        # the plan, the style lock, the material board (v1.4) AND the generator scripts all hash the same
        # (render_tour.mjs reads exactly these fields -- see its `sceneFreshness()`).
        "inputs": {"plan": args.plan.replace("\\", "/"),
                   "plan_sha256": sha256_file(args.plan),
                   "assets_dir": args.assets.replace("\\", "/"),
                   "style": args.style.replace("\\", "/"),
                   "style_sha256": sha256_file(args.style) if not args.no_style else None,
                   "furnish_seed": args.furnish_seed,
                   "seed": args.seed, "room_mode": args.room, "cap_virtual": args.cap_virtual,
                   "furniture": not args.no_furniture,
                   "material_board": ctx["material_board"]},
        "frame": {
            "plan_units": "cm", "world_units": "m",
            "mapping": "world_X = +x_cm/100 ; world_Y = -y_cm/100 ; world_Z = +z_cm/100",
            "yaw": "plan yaw_deg 0 -> world +Y (plan-north), 90 -> world +X; "
                   "dir_world = (sin yaw, cos yaw, 0)",
            "camera_euler_xyz_deg": "(90, 0, -yaw_deg)",
            "panorama_api": ctx["pano_api"],
        },
        "rooms_built": [{"id": r["id"], "name_en": r["name_en"], "type": r["type"],
                         "is_outdoor": r["is_outdoor"], "area_m2": r["area_m2"]}
                        for r in ctx["rooms_built"]],
        "assumptions_carried": ctx["plan"]["plan_meta"]["assumptions"],
        "ceiling_height_cm": ctx["ceiling_cm"],
        "ceiling_height_state": "ASSUMED (plan_meta.assumptions[0]; F-360-114) - not on the drawing",
        "rights_state": ctx["plan"]["plan_meta"]["rights_state"],
        "walls_built": ([{"id": k, "kind": ctx["walls"][k]["kind"],
                          "rect_cm": ctx["walls"][k]["rect_cm"],
                          "height_cm": ctx["walls"][k]["height_cm"]} for k in ctx["wall_objs"]]
                        if not ctx.get("general") else general_walls_built(ctx)),
        "virtual_walls_skipped": ctx["skipped_virtual"],
        "probe_only_caps": [{"object": c, "why": "single-room DEBUG mode only; --room all builds "
                                                 "the real neighbouring room instead"}
                            for c in ctx["caps"]],
        "openings_cut": ctx["cut_records"],
        "skirting_objects": ctx["skirting"],
        "glazing_objects": ctx["glazing"],
        "furniture": ctx["furniture"],
        "coverage_lights": ctx["coverage_lights"],
        "terrain": ctx["terrain"],
        "materials_kit": {"version": materials_kit.VERSION, "presets": sorted(ctx["kit"])},
        "floor_finish": ctx["floor_finish"],
        "style": ({"name": ctx["style"]["style_name"], "version": ctx["style"]["version"],
                   "slug": ctx["style"]["style_slug"], "file": args.style.replace("\\", "/"),
                   "file_sha256": sha256_file(args.style),
                   "ruling_state": ctx["style"]["ruling_state"],
                   "material_swaps": ctx["style_material_swaps"]} if ctx["style"] else None),
        "catalog_models_verified": ctx["model_hashes"],
        "placement": ctx["placement"],
        "daylight_panels": ctx["daylight_panels"],
        "camera": {"seed_id": ctx["seed_point"]["id"], "plan_x_cm": ctx["seed_point"]["x"],
                   "plan_y_cm": ctx["seed_point"]["y"], "plan_z_cm": ctx["seed_point"]["z"],
                   "plan_yaw_deg": ctx["seed_point"]["yaw_deg"],
                   "world_m": [round(v, 6) for v in bpy.context.scene.camera.location],
                   "euler_xyz_deg": [round(math.degrees(v), 6)
                                     for v in bpy.context.scene.camera.rotation_euler],
                   "note": "the .blend's ONE scene camera, at a deterministic default seed; "
                           "render_pano.py re-points it per camera_points[] entry"},
        "camera_points_in_plan": len(ctx["plan"]["camera_points"]),
        # A9-7: the report records the SLUG AND THE SHA256 ACTUALLY LOADED, not just a basename.
        "lighting": {"hdri": os.path.basename(ctx["hdri"]) if ctx["hdri"] else None,
                     "environment": ctx.get("hdri_ident"),
                     "hdri_strength": (ctx.get("hdri_ident") or {}).get("strength", HDRI_STRENGTH),
                     "hdri_rot_z_deg": (ctx.get("hdri_ident") or {}).get("rot_z_deg", HDRI_ROT_Z_DEG),
                     "sun_azimuth_plan_deg": SUN_AZIMUTH_PLAN_DEG,
                     "sun_elevation_deg": SUN_ELEVATION_DEG, "sun_energy_w_m2": SUN_ENERGY,
                     "daylight_panels": len(ctx["daylight_panels"]),
                     "luminaires": len(ctx["coverage_lights"]),
                     "luminaire_kinds": sorted({c["kind"] for c in ctx["coverage_lights"]}),
                     "luminaire_mode": args.luminaire},
        "render_defaults": {"engine": "CYCLES", "device": "GPU", "samples": 128,
                            "resolution": [4096, 2048], "view_transform": "AgX",
                            "look": ctx["view_look"],
                            "note": "T04/T07 own the final 8192x4096 settings (ENV.md 5.1)"},
        "checks": checks,
        "checks_passed": len(checks) - len(failed),
        "checks_failed": len(failed),
        "tolerance_mm": 1.0,
        "camera_clearance_checks": camera_checks,
        "camera_clearance_checks_passed": len(camera_checks) - len(failed_cam),
        "camera_clearance_checks_failed": len(failed_cam),
        "camera_clearance_min_cm": CAMERA_MIN_CLEARANCE_CM,
        "output": {"blend": args.out.replace("\\", "/"), "bytes": size,
                   "packed": bool(args.pack),
                   "note": "the .blend is gitignored and regenerated by this script; "
                           "hash decoded DATA, never .blend bytes (ENV.md 4.3)"},
        "unresolved_images": [{"image": n, "filepath": p} for n, p in broken],
        "log": lines,
    }
    if ctx.get("general"):
        report["generator"]["plan_general_version"] = plan_general.VERSION
        report["generator"]["plan_general_sha256"] = sha256_file(
            os.path.join(os.path.dirname(SCRIPT_PATH), "plan_general.py"))
        report["generator"]["general_furnish_version"] = general_furnish.VERSION
        report["generator"]["general_furnish_sha256"] = sha256_file(
            os.path.join(os.path.dirname(SCRIPT_PATH), "general_furnish.py"))
        report["inputs"]["general_furnish"] = args.general_furnish
        report["geometry"] = "general"
        report["camera_clearance_mode"] = ("report - a general plan's camera_points[] are authored and taken "
                                           "as given (Q01b); a point under the bar is listed, never moved")
        report["general"] = general_report(ctx)
    with open(args.report, "w", encoding="utf-8", newline="\n") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"report    {args.report}")
    print(f"CHECKS    {len(checks) - len(failed)}/{len(checks)} geometry passed (tol 1 mm), "
          f"{len(camera_checks) - len(failed_cam)}/{len(camera_checks)} camera clearance passed "
          f"(bar {CAMERA_MIN_CLEARANCE_CM:.0f} cm)")

    total_failed = len(failed) + (len(failed_cam) if not ctx.get("general") else 0)
    if ctx.get("general"):
        for c in failed_cam:
            print(f"REPORT    camera clearance: {c['camera']} {c['clearance_cm']} cm from {c['nearest_kind']} "
                  f"{c['nearest']} - under the {CAMERA_MIN_CLEARANCE_CM:.0f} cm bar; a general plan's points "
                  f"are authored, so this is reported, not failed")
    if total_failed and not args.no_strict:
        for c in failed:
            print(f"FAIL      geometry: {c['check']}")
        for c in (failed_cam if not ctx.get("general") else []):
            print(f"FAIL      camera clearance: {c['camera']} only {c['clearance_cm']} cm from "
                  f"{c['nearest_kind']} {c['nearest']}")
        print(f"FAIL      {total_failed} check(s) outside tolerance")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    # ⛔ MEASURED (Blender 4.5.10, board 360-v2 T03): an UNCAUGHT EXCEPTION in a
    # `blender -b -P script.py` run prints its traceback to stderr and Blender STILL EXITS 0.
    # `sys.exit(1)` does propagate (verified: sys.exit(1)->1, raise->0, os._exit(1)->1). So every
    # headless pipeline stage must convert a crash into an explicit non-zero exit itself, or a
    # caller that checks the return code will read a crash as a success. See ENV.md §8.
    _argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    try:
        _code = main(_argv)
    except SystemExit as e:                       # argparse --help / our own SystemExit
        # ⛔⭐ T13: this handler USED TO SWALLOW THE MESSAGE. Every `raise SystemExit("...")` in this
        #    file — the catalog hash mismatch, a placement violation, a bad plan, and now the
        #    environment identity check — exited 1 with a completely silent log. A refusal whose
        #    reason is not printed is only half a fail-closed. Print it, then exit.
        if e.code is not None and not isinstance(e.code, int):
            print(f"FAIL      {e.code}", flush=True)
        _code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
    except BaseException:
        import traceback
        traceback.print_exc()
        print("FAIL      build_scene.py raised — see the traceback above", flush=True)
        _code = 1
    sys.stdout.flush()
    sys.stderr.flush()
    sys.exit(_code)

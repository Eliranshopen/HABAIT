#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""materials_kit.py -- board 360-v2 T06 (v0.1) / T12 (v0.2). The PBR preset kit build_scene.py needs
to build a WHOLE apartment: wall / ceiling / skirting / metal / glass / fabric / floor -- plus, since
v0.2, the STYLE palette (`build_style_materials`), which is data from `catalog/style-habait-modern.json`
rather than constants in this file.

Split out of `build_scene.py` v0 (T03), which had these as private functions grown for ONE probe
room. This file is deliberately plain -- the numbers below are placeholders, not a chosen look.
**The style kit proper (named finishes, a real palette, a locked catalogue) is T12's** (V2-PLAN
Phase 3); this module is the plumbing T12 will keep re-using with different numbers, so the split
matters more than the values do.

v0.3 (2026-10-29, WALKAROUND-QUALITY-PLAN OQ-2, D-WQ-33): `floor_tile()`, a porcelain floor as a
procedural TILE GRID in world space, fed from the material board of an apartment
(`floor_tiles_from_board` for the sizes, `floor_grid_deg` for the direction). The AI skin re-renders
this CG as a photograph; over an oak-plank CG with a tiled spec it invented every grout line freehand
in equirect space, where a straight line must follow an exact curve, and the lines came out bent in
the viewer. A CG floor that already carries the real joints gives it straight lines to trace.

Determinism (rail 1): every function here is a pure function of its arguments -- same name + same
numeric inputs => the same node graph, same links, same values, every time. No randomness, no
session state, no file paths baked in beyond what the caller passes.

    import materials_kit
    kit = materials_kit.build_kit(tex_dir, log)
    kit["wall"], kit["ceiling"], kit["frame"], kit["glass"], kit["skirting"], kit["fabric"], kit["floor"]
"""
from __future__ import annotations

import math
import os
import re

import bpy  # noqa: E402  (Blender-provided)

VERSION = "0.3.0"

# ---- v0 defaults (linear sRGB triples, [0,1]). A style swap (T12) changes these numbers and adds
# named variants; it does not need to change the node wiring below.
COL_PLASTER = (0.878, 0.867, 0.847)
COL_CEILING = (0.930, 0.930, 0.925)
COL_METAL = (0.075, 0.075, 0.078)
COL_SKIRTING = (0.900, 0.895, 0.882)
COL_FABRIC = (0.322, 0.294, 0.267)
COL_FLOOR_FALLBACK = (0.36, 0.24, 0.14)
FLOOR_TEXTURE_TILE_M = 2.0

# ---- v0.3 (OQ-2): the procedural porcelain floor (`floor_tile`). The material board reads "large-format
# pale limestone-look porcelain floor tiles (120 by 120 cm, matte, light sand, thin grout lines)": the
# face is a plain matte light sand (about sRGB 203/193/172), the joint a real one -- 3 mm of warm mid
# grey at about a third of the face (luminance 0.18 against 0.54), dark enough to read like a grout line
# in a photograph, not a drawn black grid. From a 160 cm camera a 3 mm joint is ~2.4 px wide straight
# down at 8K and ~1 px at 2 m (half that at the 4K draft); further out it shades the pixel it crosses.
COL_TILE_SAND = (0.60, 0.53, 0.41)
TILE_ROUGHNESS = 0.60
COL_GROUT = (0.20, 0.18, 0.15)
GROUT_MM = 6.0   # 2026-10-29: 3 mm read as a faint dashed line at the size an image model sees (about 2048 px across); 6 mm stays a thin joint to the eye and a line the model can follow
# a class whose rooms the board names no tile size for: 120 x 120 indoors, 60 x 60 in the wet rooms and
# on the terraces -- ASSUMED, and reported as such (`floor_tiles_from_board`)
TILE_DEFAULT_CM = {"floor": (120.0, 120.0), "floor_wet": (60.0, 60.0), "floor_outdoor": (60.0, 60.0)}
TILE_SIZE_RE = re.compile(r"([0-9]+(?:[.][0-9]+)?) *(?:by|x|\u00d7) *([0-9]+(?:[.][0-9]+)?) *cm", re.IGNORECASE)


def _principled(mat):
    return mat.node_tree.nodes["Principled BSDF"]


def simple(name, base_color, roughness, metallic=0.0):
    """The one-node preset every flat-colour finish (plaster, paint, skirting, ...) reduces to."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    p = _principled(mat)
    p.inputs["Base Color"].default_value = (*base_color, 1.0)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = metallic
    return mat


def wall_plaster(name="M_wall_plaster", base_color=COL_PLASTER, roughness=0.82):
    return simple(name, base_color, roughness)


def ceiling_paint(name="M_ceiling_paint", base_color=COL_CEILING, roughness=0.90):
    return simple(name, base_color, roughness)


def skirting(name="M_skirting", base_color=COL_SKIRTING, roughness=0.32):
    return simple(name, base_color, roughness)


def metal(name="M_metal", base_color=COL_METAL, roughness=0.35, metallic=0.85):
    """Brushed-ish generic metal. Glazing frames use it as-is today; door/fixture hardware is a
    trivial reuse once T12 needs it -- one preset, several callers."""
    return simple(name, base_color, roughness, metallic=metallic)


def fabric(name="M_fabric", base_color=COL_FABRIC, roughness=0.75):
    """Generic upholstery/soft-furnishing preset. Not used by any T06 object (no new furniture
    ships this task) -- present because the task names the kit as wall/floor/ceiling/glass/metal/
    fabric; T12's catalog is the first real caller. Sheen sockets are probed by name AND by
    expected type, because Blender's Principled BSDF has both renamed them and changed a socket's
    TYPE across versions (measured on 4.5.10: "Sheen Tint" is a Color input, not a float -- a plain
    float assignment raises `ValueError: sequence expected`). Degrade quietly to a plain rough
    diffuse if a build's sockets differ from all of these guesses -- a decorative touch is never
    worth a crashed build."""
    mat = simple(name, base_color, roughness)
    p = _principled(mat)
    for key, val in (("Sheen Weight", 0.25), ("Sheen", 0.25)):          # float sockets
        if key in p.inputs:
            try:
                p.inputs[key].default_value = val
            except (TypeError, ValueError):
                pass
    for key in ("Sheen Tint",):                                        # colour sockets (RGBA)
        if key in p.inputs:
            try:
                p.inputs[key].default_value = (1.0, 1.0, 1.0, 1.0)
            except (TypeError, ValueError):
                pass
    return mat


def glass(name="M_glass"):
    """Architectural glazing that LETS DAYLIGHT IN.

    Measured on this track (T03, board 360-v2): a plain refractive pane makes Cycles drop the sun
    completely -- sun -> refractive surface -> diffuse floor is a caustic path (L S D) that Cycles
    cannot sample with MIS, so the direct-light shadow ray is simply blocked. The first probe render
    had a bright sky outside the door and NO sun patch on the floor -- the giveaway.

    Fix (the standard archviz one, physically defensible for a thin clear pane): swap in a
    Transparent BSDF for SHADOW RAYS ONLY (`Light Path > Is Shadow Ray`). Camera and reflection
    rays still see real glass (Fresnel, reflection, refraction); light sampling passes straight
    through, as it would through an unrefracted pane.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    p = _principled(mat)
    p.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    p.inputs["Roughness"].default_value = 0.02
    p.inputs["Metallic"].default_value = 0.0
    p.inputs["IOR"].default_value = 1.45
    for key in ("Transmission Weight", "Transmission"):
        if key in p.inputs:
            p.inputs[key].default_value = 1.0
            break

    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Shadow Ray"], mix.inputs["Fac"])
    nt.links.new(p.outputs["BSDF"], mix.inputs[1])       # Fac = 0 -> real glass
    nt.links.new(transp.outputs["BSDF"], mix.inputs[2])  # Fac = 1 -> transparent to light
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def floor_wood(name, tex_dir, log=print, tile_m=FLOOR_TEXTURE_TILE_M):
    """PBR floor from a CC0 Poly Haven texture set (Diffuse/Rough/nor_gl in `tex_dir`). Falls back
    to a flat wood colour if a map is missing -- the caller must still get a usable material back,
    never `None`."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    p = _principled(mat)
    p.inputs["Roughness"].default_value = 0.35
    p.inputs["Base Color"].default_value = (*COL_FLOOR_FALLBACK, 1.0)

    def find(map_name):
        if not tex_dir or not os.path.isdir(tex_dir):
            return None
        for fn in sorted(os.listdir(tex_dir)):
            if f"_{map_name}_" in fn:
                return os.path.join(tex_dir, fn)
        return None

    diff, rough, nor = find("Diffuse"), find("Rough"), find("nor_gl")
    if not diff:
        log(f"WARN  floor texture not found in {tex_dir} - using flat wood colour")
        return mat

    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    s = 1.0 / tile_m
    mapping.inputs["Scale"].default_value = (s, s, s)
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])

    def image_node(path, non_color):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(path, check_existing=True)
        n.image.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
        n.extension = "REPEAT"
        nt.links.new(mapping.outputs["Vector"], n.inputs["Vector"])
        return n

    nt.links.new(image_node(diff, False).outputs["Color"], p.inputs["Base Color"])
    if rough:
        nt.links.new(image_node(rough, True).outputs["Color"], p.inputs["Roughness"])
    if nor:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 0.6
        nt.links.new(image_node(nor, True).outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    return mat


def floor_tile(name, tile_cm, base_color=COL_TILE_SAND, roughness=TILE_ROUGHNESS, grid_deg=0.0,
               grout_mm=GROUT_MM, grout_color=COL_GROUT):
    """A tiled floor as a procedural GRID IN WORLD SPACE (v0.3, OQ-2) -- no image, exact at any size.

    The Brick Texture with no row offset IS a square grid (a stack bond): Color1 = Color2 = the face, so
    no tile is tinted, and Mortar = the grout. It reads the WORLD position (Geometry > Position), never a
    UV: every slab build_scene.py makes sits at the world origin with world = plan / 100 (y flipped), so
    the grid origin is the plan origin and ONE grid runs through every floor slab, fill strip and
    threshold -- a joint continues straight through every opening. The Mapping node (POINT) turns the
    position by +grid_deg about that origin, which lays the joints along a wall drawn at grid_deg in the
    plan frame (world angle -grid_deg). `tile_cm` = (along the first grid axis, along the second).
    Mortar Size is HALF the joint -- the node lays mortar on both sides of every edge -- in metres,
    because Scale is 1. Roughness is one value: a 3 mm joint needs no sheen of its own."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    p = _principled(mat)
    p.inputs["Roughness"].default_value = roughness
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    turn = nt.nodes.new("ShaderNodeMapping")                       # vector type POINT (the default)
    turn.inputs["Rotation"].default_value = (0.0, 0.0, math.radians(grid_deg))
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.0                                             # no running bond: a square grid
    brick.squash = 1.0
    brick.inputs["Scale"].default_value = 1.0                      # metres in, metres out
    brick.inputs["Brick Width"].default_value = tile_cm[0] / 100.0
    brick.inputs["Row Height"].default_value = tile_cm[1] / 100.0
    brick.inputs["Mortar Size"].default_value = grout_mm / 2000.0  # half the joint, in metres
    brick.inputs["Mortar Smooth"].default_value = 0.0
    brick.inputs["Bias"].default_value = 0.0
    brick.inputs["Color1"].default_value = (*base_color, 1.0)
    brick.inputs["Color2"].default_value = (*base_color, 1.0)
    brick.inputs["Mortar"].default_value = (*grout_color, 1.0)
    nt.links.new(geo.outputs["Position"], turn.inputs["Vector"])
    nt.links.new(turn.outputs["Vector"], brick.inputs["Vector"])
    nt.links.new(brick.outputs["Color"], p.inputs["Base Color"])
    return mat


def tile_cm_from_text(text):
    """The tile size a material-board sentence STATES: the first "<w> by <h> cm" ("x" or the times sign
    also read) in a sentence that names tiles, as (w, h) in cm; None when it names no tiles or no size."""
    if not isinstance(text, str) or "tile" not in text.lower():
        return None
    m = TILE_SIZE_RE.search(text)
    return (float(m.group(1)), float(m.group(2))) if m else None


def floor_tiles_from_board(board, rooms, class_of):
    """Per floor class (floor | floor_wet | floor_outdoor), the tile size the material board STATES, else
    TILE_DEFAULT_CM marked ASSUMED -- and the exact words that decided it. The main floor reads
    `surfaces.floor`; the wet rooms and the terraces read their own override, `surfaces[room_surfaces
    [type]]`; the first stated size wins and a differing one is reported, not applied (one material per
    class). `class_of(room)` is the floor-class rule of the builder. Pure: the same board and rooms give
    the same (specs, words); `words` = every board value read (absent = None), so render_tour.mjs can
    tell a floor edit from a prompt edit elsewhere in the board."""
    surfaces = board.get("surfaces") or {}
    by_type = board.get("room_surfaces") or {}
    words = {"room_surfaces": {}, "surfaces": {"floor": surfaces.get("floor")}}
    out = {}
    for cls, default in TILE_DEFAULT_CM.items():
        mine = [r for r in rooms if class_of(r) == cls]                  # plan order
        refs = [("surfaces.floor", surfaces.get("floor"))] if cls == "floor" else []
        for r in (mine if cls != "floor" else []):                       # the per-room overrides
            rtype = r["type"]
            key = by_type.get(rtype)
            words["room_surfaces"][rtype] = key
            if key is not None:
                words["surfaces"][key] = surfaces.get(key)
                ref = f"surfaces.{key} (room_surfaces.{rtype})"
                if ref not in [x for x, _ in refs]:
                    refs.append((ref, surfaces.get(key)))
        stated = [(ref, tile_cm_from_text(text)) for ref, text in refs]
        stated = [(ref, s) for ref, s in stated if s]
        size, source = (stated[0][1], stated[0][0]) if stated else (None, None)
        named = [ref for ref, text in refs if isinstance(text, str) and "tile" in text.lower()]
        out[cls] = {"tile_cm": list(size or default), "state": "STATED" if size else "ASSUMED",
                    "source": source or ("no size stated in " + (", ".join(named) or "the board")
                                         + f"; the default {default[0]:g} x {default[1]:g} cm"),
                    "rooms": [r["id"] for r in mine],
                    "ignored": [f"{ref} states {s[0]:g} x {s[1]:g} cm" for ref, s in stated[1:] if s != size]}
    return out, words


def floor_grid_deg(rooms, step_deg=0.25, window_deg=1.5):
    """The direction the tiles are laid, in the PLAN frame (degrees from +x toward +y, folded into
    (-45, 45] -- a square grid repeats every 90): the length-weighted mode of the STRUCTURE edges of the
    room loops, i.e. every edge but an `open` zone bar (`edge_kinds`; all edges when a plan has none).
    Tiles are laid along the walls, and a traced plan need not be square to its raster (846: the main
    wing runs at ~18.5 deg), so an axis-aligned grid would cross every wall on the slant. A fixed sweep
    with a triangular window (ties keep the smaller angle), then the length-weighted circular mean of
    the edges inside the winning window, rounded to 0.01 deg: deterministic; 0.0 on a rectilinear plan.
    Returns (deg, info)."""
    edges = []
    for room in rooms:
        loop, kinds = room["loop"], room.get("edge_kinds")
        n = len(loop)
        for i in range(n):
            if kinds and i < len(kinds) and kinds[i] == "open":
                continue
            (x0, y0), (x1, y1) = loop[i], loop[(i + 1) % n]
            d = math.hypot(x1 - x0, y1 - y0)
            if d > 1e-9:
                edges.append((math.degrees(math.atan2(y1 - y0, x1 - x0)) % 90.0, d))
    if not edges:
        return 0.0, {"edges": 0, "note": "no structure edge - the grid stays square to the plan"}

    def off(a, c):                                                   # distance on the 90-degree circle
        t = abs(a - c) % 90.0
        return min(t, 90.0 - t)

    peak, best = 0.0, -1.0
    for k in range(int(round(90.0 / step_deg))):
        c = k * step_deg
        score = sum(d * (1.0 - off(a, c) / window_deg) for a, d in edges if off(a, c) < window_deg)
        if score > best + 1e-9:
            peak, best = c, score
    near = [(a, d) for a, d in edges if off(a, peak) < window_deg]
    sx = sum(d * math.cos(math.radians(4.0 * a)) for a, d in near)
    sy = sum(d * math.sin(math.radians(4.0 * a)) for a, d in near)
    deg = (math.degrees(math.atan2(sy, sx)) / 4.0) % 90.0
    deg = round(deg - 90.0 if deg > 45.0 else deg, 2) + 0.0
    total = sum(d for _, d in edges)
    return deg, {"edges": len(edges), "edge_length_m": round(total / 100.0, 2), "peak_deg": peak,
                 "window_deg": window_deg, "share_in_window": round(sum(d for _, d in near) / total, 3),
                 "rule": "length-weighted mode of the room-loop edges mod 90, open zone bars excluded"}


def terrain_ground(name="M_terrain", base_color=(0.302, 0.345, 0.204), roughness=0.95):
    """A neutral, muted ground-plane material -- exists only so a window ray that escapes the
    building has something plausible to land on (build_scene.py's terrain plane). Not a finish
    any interior surface uses; not part of the wall/floor/ceiling/glass/metal/fabric six."""
    return simple(name, base_color, roughness)


def style_pbr(name, spec, glass_mat=None):
    """One PBR material from a style-lock palette entry (T12).

    A palette entry is a plain dict -- `base_color` + `roughness` (+ optional `metallic`, `sheen`,
    `emission_strength`/`emission_color`, or `shared: "materials_kit.glass()"` to reuse the
    architectural glazing). Every socket write is guarded by name AND wrapped: Blender has both
    renamed Principled sockets and changed a socket's TYPE across versions (T06 lost a build to
    "Sheen Tint" being a Color, not a float), and a decorative touch is never worth a crashed build.
    """
    if spec.get("shared") == "materials_kit.glass()":
        return glass_mat if glass_mat is not None else glass(name)
    mat = simple(name, tuple(spec.get("base_color", (0.8, 0.8, 0.8))),
                 float(spec.get("roughness", 0.5)), metallic=float(spec.get("metallic", 0.0)))
    p = _principled(mat)
    for key, val in (("Sheen Weight", spec.get("sheen")), ("Sheen", spec.get("sheen")),
                     ("Emission Strength", spec.get("emission_strength"))):
        if val is None or key not in p.inputs:
            continue
        try:
            p.inputs[key].default_value = float(val)
        except (TypeError, ValueError):
            pass
    ec = spec.get("emission_color")
    if ec is not None:
        for key in ("Emission Color", "Emission"):
            if key in p.inputs:
                try:
                    p.inputs[key].default_value = (*ec, 1.0)
                    break
                except (TypeError, ValueError):
                    pass
    return mat


def build_style_materials(palette, log=print, glass_mat=None):
    """Every named finish in the style lock's `palette`, built once per scene, in sorted name order
    (determinism: a dict's insertion order must not depend on the caller)."""
    out = {}
    for name in sorted(palette):
        out[name] = style_pbr(f"M_{name}", palette[name], glass_mat=glass_mat)
    log(f"style     {len(out)} palette material(s): {', '.join(sorted(out))}")
    return out


def build_kit(tex_dir, log=print, floor_slug="floor", surfaces=None, floor_tiles=None, grid_deg=0.0):
    """The kit build: same `tex_dir` + `floor_slug` (+ the same `surfaces` block) -> the same
    materials, always. One call per scene build.

    `surfaces` is the style lock's own `surfaces` object (T12): it overrides the module-level v0
    defaults so the architectural finishes are LOCKED DATA, not constants in this file. Absent, the
    v0 numbers stand, so the T03/T06 probe path keeps working unchanged.

    v0.3 (OQ-2): `floor_tiles` (from `floor_tiles_from_board`) makes the three floor classes the
    procedural tile grid, turned by `grid_deg` about the plan origin; the oak texture set is then not
    loaded at all. The wet and outdoor classes keep their locked tone and roughness and gain joints.
    Absent (no material board), every floor is built exactly as in v0.2."""
    s = surfaces or {}

    def col(key, default):
        return tuple((s.get(key) or {}).get("base_color", default))

    def rough(key, default):
        return float((s.get(key) or {}).get("roughness", default))

    floor_spec = s.get("floor") or {}

    def tiles(cls, base_color, roughness):
        w, h = floor_tiles[cls]["tile_cm"]
        return floor_tile(f"M_{cls}_tiles_{w:g}x{h:g}", (w, h), base_color=base_color,
                          roughness=roughness, grid_deg=grid_deg)

    return {
        "wall": wall_plaster(base_color=col("wall_plaster", COL_PLASTER),
                             roughness=rough("wall_plaster", 0.82)),
        "ceiling": ceiling_paint(base_color=col("ceiling_paint", COL_CEILING),
                                 roughness=rough("ceiling_paint", 0.90)),
        "frame": metal(base_color=col("frame_metal", COL_METAL), roughness=rough("frame_metal", 0.35),
                       metallic=float((s.get("frame_metal") or {}).get("metallic", 0.85))),
        "glass": glass(),
        "skirting": skirting(base_color=col("skirting", COL_SKIRTING), roughness=rough("skirting", 0.32)),
        "fabric": fabric(),
        "floor": (tiles("floor", COL_TILE_SAND, TILE_ROUGHNESS) if floor_tiles else
                  floor_wood(f"M_floor_{floor_slug}", tex_dir, log,
                             tile_m=float(floor_spec.get("tile_m", FLOOR_TEXTURE_TILE_M)))),
        # a balcony slab is not the living room's oak -- the glazing should read as a boundary
        # between two materials. Falls back to the same wood when the style has no outdoor entry.
        "floor_outdoor": (tiles("floor_outdoor", col("floor_outdoor", (0.66, 0.63, 0.58)),
                                rough("floor_outdoor", 0.75)) if floor_tiles else
                          simple("M_floor_outdoor", col("floor_outdoor", (0.66, 0.63, 0.58)),
                                 rough("floor_outdoor", 0.75))
                          if s.get("floor_outdoor") else None),
        "floor_wet": (tiles("floor_wet", col("floor_wet", (0.80, 0.78, 0.75)), rough("floor_wet", 0.22))
                      if floor_tiles else
                      simple("M_floor_wet", col("floor_wet", (0.80, 0.78, 0.75)),
                             rough("floor_wet", 0.22))
                      if s.get("floor_wet") else None),
        "terrain": terrain_ground(base_color=col("terrain", (0.302, 0.345, 0.204)),
                                  roughness=rough("terrain", 0.95)),
    }

#!/usr/bin/env python3
"""export_dollhouse.py -- the web "dollhouse" GLB of a built apartment scene (task 09, B4a).

Runs headless in Blender AFTER build_scene.py, on the .blend it wrote. It never saves the .blend.

    "$BLENDER" -b <scene.blend> --factory-startup -P 360walkaround/pipeline/export_dollhouse.py -- \
        --out Habait/engine/_local/apt846/dollhouse [--floor parquet|concrete|marble] [--cut-height 1.2]

What it writes into --out:
    apt846.glb    (name from --name) Draco-compressed GLB, no textures, no UVs, flat materials only
    top.png       orthographic top view, 2048 x 2048, transparent background (input for the "from above" skin)
    report.json   size, nodes, materials, triangles, timings, what was dropped and why, the top.png pixel <-> plan
                  mapping (for the minimap, task 10)

What the GLB is:
- Walls, facings, door infills, posts, built-ins (closets, shower screens) and glazing are cut at --cut-height
  (default 1.20 m). Opaque cuts get a dark cap face ("web_cap"); glass is cut but not capped.
- Ceilings, cameras, lights, luminaires, terrain, helper objects and anything wholly above the cut are dropped.
- Eliran's design rules are enforced in the export, whatever the scene was built with: skirting (SKIRT_*) and door
  casings / architraves (DOOR_*_casing_*, ENTRY_*_casing_*) are dropped (zero-line, no skirting); every floor is
  ONE flat colour (no tile grid, no grout); every door leaf is cream.
- Every material is replaced by a flat one from a fixed set: web_wall, web_cap, web_floor_<parquet|concrete|marble>,
  web_floor_wet, web_floor_outdoor, glass (alpha 0.15, BLEND), web_frame, web_door, web_metal, oak, web_walnut,
  web_ceramic, web_mirror, fabric_light, fabric_dark, fabric_rug, web_lamp, web_art, web_plant, web_furniture.
- Nodes: walls, glass, frames, doors, floor_<room-id> (extras: room id, name, type, area), built_<room-id>,
  furn_<room-id>. Coordinates: build_scene's world frame (metres, origin = plan origin; world X = x_cm/100,
  world Y = -y_cm/100), which glTF turns Y-up (glTF X = world X, glTF Y = world Z, glTF Z = -world Y = y_cm/100).
- Size control: architecture is limit-dissolved (planar, per material); furniture is decimated (collapse) to fit
  --max-tris, and if the GLB is still over --target-bytes the furniture ratio steps down and it re-exports
  (at most --attempts times).

$0-checks without Blender (the venv python is enough):
    python export_dollhouse.py --selftest              # the name / material classifiers
    python export_dollhouse.py --plan-only <scene.report.json>   # what the report says the scene holds
"""

import argparse
import hashlib
import json
import math
import os
import re
import sys
import time

VERSION = "0.1.0"

# ----------------------------------------------------------------------------------------------------------------
# Pure-python part: classifiers (selftest-able without bpy)
# ----------------------------------------------------------------------------------------------------------------

# category -> (cut at the cut height?, cap the cut?)
CATEGORIES = {
    "wall": (True, True),        # WALL_, FACING_, INFILL_, POST_, PROBECAP_, door jambs/heads (zero-line = wall)
    "glass": (True, False),      # GLASS_ (facade panes, door glass), LEAF_ glass leaves
    "frame": (True, True),       # FRAME_, DOORFRAME_
    "door": (True, True),        # DOOR_<o>_leaf, LEAF_ (non-glass), ENTRY_ leaf parts
    "door_metal": (False, False),  # levers, roses, necks
    "floor": (False, False),     # FLOOR_<room>
    "floorfill": (False, False),  # FLOORFILL_<class> (thresholds, bays)
    "builtin": (True, True),     # CLOSET_, SHOWER_ (built-in, wall-like)
    "furniture": (False, False),  # catalog + everything unnamed
}

DROP_PREFIXES = (
    ("CEIL_", "ceiling"),
    ("CAM_", "camera"),
    ("FIXTURE_", "luminaire"),
    ("TERRAIN_", "terrain"),
    ("BOOL_", "helper"),
    ("CUT_", "helper"),
    ("SKIRT_", "design rule: no skirting"),
    ("POINT_", "light"),
    ("AREA_", "light"),
)

def classify_object(name):
    """name -> (category, drop_reason). drop_reason is None when kept."""
    for pre, why in DROP_PREFIXES:
        if name.startswith(pre):
            return "drop", why
    if name.startswith(("DOOR_", "ENTRY_")) and "_casing_" in name:
        return "drop", "design rule: zero-line doors (no casing / architrave)"
    if name.startswith(("WALL_", "FACING_", "INFILL_", "POST_", "PROBECAP_")):
        return "wall", None
    if name.startswith("DOORFRAME_") or name.startswith("FRAME_"):
        return "frame", None
    if name.startswith("GLASS_"):
        return "glass", None
    if name.startswith("DOOR_") or name.startswith("ENTRY_"):
        if re.search(r"_(lever|rose|neck)_", name + "_"):
            return "door_metal", None
        if re.search(r"_(jamb_[pm]|head)$", name):
            return "wall", None          # zero-line: the lining is plaster, flush with the wall
        return "door", None
    if name.startswith("LEAF_"):
        return "door", None
    if name.startswith("FLOORFILL_"):
        return "floorfill", None
    if name.startswith("FLOOR_"):
        return "floor", None
    if name.startswith(("CLOSET_", "SHOWER_")):
        return "builtin", None
    return "furniture", None


FLOOR_COLORS = {  # linear RGB, roughness
    "parquet": ((0.40, 0.25, 0.13), 0.55),
    "concrete": ((0.46, 0.45, 0.42), 0.70),
    "marble": ((0.80, 0.78, 0.74), 0.25),
}

# web material set: name -> (linear rgb, roughness, metallic, alpha)
def web_palette(floor):
    rgb, rough = FLOOR_COLORS[floor]
    return {
        "web_wall": ((0.80, 0.78, 0.74), 0.85, 0.0, 1.0),
        "web_cap": ((0.035, 0.035, 0.04), 0.9, 0.0, 1.0),
        f"web_floor_{floor}": (rgb, rough, 0.0, 1.0),
        "web_floor_wet": ((0.70, 0.68, 0.64), 0.35, 0.0, 1.0),
        "web_floor_outdoor": ((0.55, 0.52, 0.47), 0.8, 0.0, 1.0),
        "glass": ((0.75, 0.85, 0.90), 0.05, 0.0, 0.15),
        "web_frame": ((0.06, 0.06, 0.065), 0.4, 0.6, 1.0),
        "web_door": ((0.82, 0.78, 0.68), 0.6, 0.0, 1.0),        # cream zero-line leaf
        "web_metal": ((0.55, 0.55, 0.56), 0.35, 0.9, 1.0),
        "oak": ((0.45, 0.30, 0.17), 0.6, 0.0, 1.0),
        "web_walnut": ((0.18, 0.10, 0.06), 0.6, 0.0, 1.0),
        "web_ceramic": ((0.88, 0.88, 0.87), 0.2, 0.0, 1.0),
        "web_mirror": ((0.70, 0.72, 0.74), 0.05, 1.0, 1.0),
        "fabric_light": ((0.72, 0.68, 0.60), 0.9, 0.0, 1.0),   # cream boucle
        "fabric_dark": ((0.16, 0.15, 0.14), 0.9, 0.0, 1.0),
        "fabric_rug": ((0.50, 0.46, 0.40), 0.95, 0.0, 1.0),
        "web_lamp": ((0.90, 0.86, 0.78), 0.7, 0.0, 1.0),
        "web_art": ((0.35, 0.33, 0.30), 0.7, 0.0, 1.0),
        "web_plant": ((0.10, 0.22, 0.08), 0.8, 0.0, 1.0),
        "web_furniture": ((0.55, 0.52, 0.48), 0.7, 0.0, 1.0),
    }


MAT_KEYWORDS = (  # (regex on the lower-case source material name, web material); first match wins
    (r"mirror", "web_mirror"),
    (r"glass|screen", "glass"),
    (r"walnut|wooddark", "web_walnut"),
    (r"oak|wood|veneer|timber", "oak"),
    (r"rug|carpet", "fabric_rug"),
    (r"fabric_dark|fabricdark|leather|dark", "fabric_dark"),
    (r"fabric|boucle|cushion|sofa|cloth|textile|linen|uphol", "fabric_light"),
    (r"metal|steel|chrome|brass|alumin|handle", "web_metal"),
    (r"ceramic|porcelain|marble|stone|sink|toilet|basin", "web_ceramic"),
    (r"lamp|shade", "web_lamp"),
    (r"art|picture|canvas|frame_artwork", "web_art"),
    (r"leaf|leaves|plant|foliage|grass", "web_plant"),
)


def web_material_for(category, mat_name, floor_key, floor):
    """(object category, source material name, floor class of the room) -> web material name."""
    if category == "wall":
        return "web_wall"
    if category == "glass":
        return "glass"
    if category == "frame":
        return "web_frame"
    if category == "door":
        n = (mat_name or "").lower()
        return "glass" if "glass" in n else "web_door"
    if category == "door_metal":
        return "web_metal"
    if category in ("floor", "floorfill"):
        if floor_key == "floor_wet":
            return "web_floor_wet"
        if floor_key == "floor_outdoor":
            return "web_floor_outdoor"
        return f"web_floor_{floor}"
    n = (mat_name or "").lower()
    for rx, web in MAT_KEYWORDS:
        if re.search(rx, n):
            return web
    return None   # caller falls back to the source colour (furniture) or web_furniture


def floor_class_from_material(mat_name, room=None):
    """The floor class of a FLOOR_<room> slab: from its build material name, else from the room (outdoor)."""
    n = (mat_name or "").lower()
    if "wet" in n:
        return "floor_wet"
    if "outdoor" in n or "terrace" in n:
        return "floor_outdoor"
    if room and room.get("is_outdoor"):
        return "floor_outdoor"
    return "floor"


# ---- --bake-light (board apartment-3d card 07): a light-only Cycles bake in the tour's palette ----
# The bake's albedo per web material, from the tour's material board (habait-tel-aviv-luxury-v1): warm white plaster
# walls, doors painted the wall colour, sand-grey lacquer fronts, ivory boucle; floors neutral (the bake is light-only:
# the floor colour stays a material factor in the GLB, so the three floor variants share one lightmap). Linear RGB.
BAKE_PALETTE_SOURCE = "Habait/tour360/apartments/apt846/material-board.json (habait-tel-aviv-luxury-v1)"
BAKE_ALBEDO = {
    "plaster": (0.80, 0.77, 0.72),       # walls, doors, built-in carcasses
    "ceiling": (0.82, 0.79, 0.74),       # flat warm white ceiling
    "sand": (0.52, 0.49, 0.44),          # kitchen / wardrobe / vanity fronts (matte sand-grey lacquer)
    "ivory": (0.78, 0.74, 0.66),         # ivory / cream boucle
    "floor": (0.50, 0.50, 0.50),         # neutral: light-only
    "frame": (0.06, 0.06, 0.065),        # slim black frames
}


def bake_albedo(web_name):
    """web material name -> BAKE_ALBEDO key (None = keep the palette colour)."""
    n = web_name or ""
    if n in ("web_wall", "web_door"):
        return "plaster"
    if n.startswith("web_floor_"):
        return "floor"
    if n in ("oak", "web_walnut", "web_furniture") or n.startswith("web_furn_"):
        return "sand"
    if n in ("fabric_light", "fabric_rug"):
        return "ivory"
    if n == "web_frame":
        return "frame"
    return None


def bake_role(cat, why):
    """How an ORIGINAL scene object takes part in the bake: 'keep' (lights it or shades it as built), 'ceiling',
    'hide' (not in the bake), or 'split' (exported: the part above the cut stays as an occluder, the part below is
    the web copy that receives the light)."""
    if cat == "drop":
        if why == "ceiling":
            return "ceiling"
        if why in ("luminaire", "terrain", "light"):
            return "keep"
        return "hide"
    return "split"


def glb_bin_sha256(data):
    """sha256 of a GLB's BIN chunk (the geometry: the floor variants must share it)."""
    import struct
    if data[:4] != b"glTF":
        raise ValueError("not a GLB")
    off = 12
    while off + 8 <= len(data):
        n, typ = struct.unpack_from("<II", data, off)
        if typ == 0x004E4942:
            return hashlib.sha256(data[off + 8:off + 8 + n]).hexdigest()
        off += 8 + n
    return None


def selftest():
    cases = {
        "WALL_w-1": "wall", "FACING_r-living_e30_r0": "wall", "INFILL_o-6": "wall", "POST_facade-1_end0": "wall",
        "GLASS_facade-4": "glass", "DOORFRAME_o-13_facade-11_L": "frame", "FRAME_o-5_0": "frame",
        "DOOR_o-6_leaf": "door", "DOOR_o-6_jamb_p": "wall", "DOOR_o-6_head": "wall",
        "DOOR_o-6_lever_p": "door_metal", "ENTRY_o-12_rose_p": "door_metal", "LEAF_o-12": "door",
        "FLOOR_r-living": "floor", "FLOORFILL_floor_wet": "floorfill", "CLOSET_w-closet-1_carcass": "builtin",
        "SHOWER_bg-shower_screen": "builtin", "kitchenFridge(Clone)": "furniture", "door.004": "furniture",
        "modern_arm_chair_01": "furniture",
    }
    drops = ["CEIL_r-living", "CAM_cp-living", "FIXTURE_r-entrance", "TERRAIN_ground", "SKIRT_r-living_0",
             "DOOR_o-6_casing_p_m", "DOOR_o-6_casing_m_head", "ENTRY_o-12_casing_p_p"]
    bad = []
    for n, want in cases.items():
        got = classify_object(n)[0]
        if got != want:
            bad.append(f"{n}: {got} != {want}")
    for n in drops:
        if classify_object(n)[0] != "drop":
            bad.append(f"{n}: not dropped")
    mats = {("furniture", "M_wood_oak"): "oak", ("furniture", "M_fabric_dark"): "fabric_dark",
            ("furniture", "M_glass_clear"): "glass", ("furniture", "M_mirror_glass"): "web_mirror",
            ("furniture", "M_fabric_rug_border"): "fabric_rug", ("furniture", "M_metal_black"): "web_metal",
            ("furniture", "M_ceramic_white"): "web_ceramic", ("door", "M_wood_walnut"): "web_door",
            ("floor", "M_floor_tiles_120x120"): "web_floor_parquet", ("furniture", "xyz"): None}
    for (cat, m), want in mats.items():
        got = web_material_for(cat, m, "floor", "parquet")
        if got != want:
            bad.append(f"mat {cat}/{m}: {got} != {want}")
    if web_material_for("floor", "M_floor_wet", "floor_wet", "marble") != "web_floor_wet":
        bad.append("wet floor")
    pal = web_palette("parquet")
    if pal["glass"][3] != 0.15:
        bad.append("glass alpha")
    # --bake-light (card 07): albedo classes, bake roles, the BIN-chunk hash, the flags
    albedo = {"web_wall": "plaster", "web_door": "plaster", "web_floor_marble": "floor", "web_floor_wet": "floor",
              "oak": "sand", "web_furn_123": "sand", "web_furniture": "sand", "fabric_light": "ivory",
              "web_frame": "frame", "glass": None, "web_cap": None, "web_metal": None}
    for n, want in albedo.items():
        if bake_albedo(n) != want:
            bad.append(f"bake_albedo {n}: {bake_albedo(n)} != {want}")
    roles = {("drop", "ceiling"): "ceiling", ("drop", "luminaire"): "keep", ("drop", "terrain"): "keep",
             ("drop", "camera"): "hide", ("drop", "design rule: no skirting"): "hide", ("wall", None): "split",
             ("furniture", None): "split", ("glass", None): "split"}
    for (c, w), want in roles.items():
        if bake_role(c, w) != want:
            bad.append(f"bake_role {c}/{w}: {bake_role(c, w)} != {want}")
    import struct
    js = b'{"asset":{"version":"2.0"}}  '
    binc = bytes(range(8))
    glb = (b"glTF" + struct.pack("<II", 2, 12 + 8 + len(js) + 8 + len(binc)) + struct.pack("<II", len(js), 0x4E4F534A)
           + js + struct.pack("<II", len(binc), 0x004E4942) + binc)
    if glb_bin_sha256(glb) != hashlib.sha256(binc).hexdigest():
        bad.append("glb_bin_sha256")
    import numpy as np
    img = np.ones((6, 6, 3), np.float32)
    img[2, 3] = 0.05                                   # one dark texel inside a lit patch -> fixed
    msk = np.ones((6, 6), bool)
    fixed, n = _leak_fix(img, msk)
    if n != 1 or abs(float(fixed[2, 3, 0]) - 1.0) > 1e-6:
        bad.append(f"leak_fix {n}")
    img2 = np.ones((12, 12, 3), np.float32)
    img2[5, 2:9] = 0.01                                # a 1-px dark dash under a "wall" -> lifted to its lit neighbours
    fixed2, n2 = _occluded_fix(img2, np.ones((12, 12), bool))
    if n2 != 7 or float(fixed2[5, 2:9].min()) < 0.99:
        bad.append(f"occluded_fix {n2}")
    a0 = parse(["--out", "x"])
    a1 = parse(["--out", "x", "--bake-light", "--bake-res", "1024", "--floor-variants", "parquet,marble"])
    if a0.bake_light or not a1.bake_light or a1.bake_res != 1024 or a1.bake_samples != 128 or a1.floor_variants != "parquet,marble":
        bad.append("bake flags")
    n_bake = len(albedo) + len(roles) + 4
    print(f"selftest: {len(cases) + len(drops) + len(mats) + 2 + n_bake} cases, {len(bad)} failed")
    for b in bad:
        print("  FAIL", b)
    return 0 if not bad else 1


def plan_only(report_path):
    """What the build report says the scene holds, and what this exporter will do with each named group."""
    r = json.load(open(report_path, encoding="utf-8"))
    names = set()

    def walk(x):
        if isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
        elif isinstance(x, str) and re.fullmatch(r"[A-Z][A-Z0-9]+_[\w\-.()]+", x):
            names.add(x)
    walk({k: v for k, v in r.items() if k not in ("log", "checks")})
    for f in r.get("furniture", []):
        names.update(f.get("objects", []))
    by = {}
    for n in sorted(names):
        cat, why = classify_object(n)
        by.setdefault(why and f"drop ({why})" or cat, []).append(n)
    out = {
        "report": report_path,
        "built_utc": r.get("generator", {}).get("generated_utc"),
        "floor_finish": (r.get("floor_finish") or {}).get("mode"),
        "skirting_objects": len(r.get("skirting_objects", [])),
        "material_board": (r.get("inputs", {}).get("material_board") or {}).get("mode"),
        "furniture_placements": len(r.get("furniture", [])),
        "rooms": [x["id"] for x in r.get("rooms_built", [])],
        "groups": {k: len(v) for k, v in sorted(by.items())},
        "examples": {k: v[:4] for k, v in sorted(by.items())},
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


# ----------------------------------------------------------------------------------------------------------------
# Blender part
# ----------------------------------------------------------------------------------------------------------------

def log(msg):
    print(f"[dollhouse] {msg}", flush=True)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def blender_main(args):
    import bpy
    import bmesh
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree

    t0 = time.time()
    timings = {}
    if args.blend:
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(args.blend))
    blend_path = bpy.data.filepath
    if not blend_path:
        raise SystemExit("export_dollhouse: no .blend loaded (pass it before -P, or --blend)")
    out_dir = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)
    glb_path = os.path.join(out_dir, f"{args.name}.glb")
    top_path = os.path.join(out_dir, "top.png")
    rep_path = os.path.join(out_dir, "report.json")

    # the build report beside the .blend: <stem>.report.json
    report_in = args.report_in or os.path.splitext(blend_path)[0] + ".report.json"
    build_rep = None
    if os.path.isfile(report_in):
        try:
            build_rep = json.load(open(report_in, encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            log(f"build report unreadable ({e}); continuing without it")
    rooms_meta = {}
    if build_rep:
        for rm in build_rep.get("rooms_built", []):
            rooms_meta[rm["id"]] = {k: rm.get(k) for k in ("id", "name_en", "type", "is_outdoor", "area_m2")}
    log(f"blend {blend_path}")
    log(f"build report {'found' if build_rep else 'absent'}: {report_in}")

    cut_z = float(args.cut_height)
    palette = web_palette(args.floor)
    dg = bpy.context.evaluated_depsgraph_get()

    # ---- web materials ----
    web_mats = {}

    def web_mat(name, rgb=None):
        if name in web_mats:
            return web_mats[name]
        spec = palette.get(name)
        if spec is None:
            spec = (rgb or (0.55, 0.52, 0.48), 0.7, 0.0, 1.0)
        col, rough, metal, alpha = spec
        claim_name(bpy.data.materials, name)       # a Kenney "glass" must not turn ours into "glass.001"
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        p = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        p.inputs["Base Color"].default_value = (col[0], col[1], col[2], 1.0)
        p.inputs["Roughness"].default_value = rough
        p.inputs["Metallic"].default_value = metal
        p.inputs["Alpha"].default_value = alpha
        m.diffuse_color = (col[0], col[1], col[2], alpha)
        if alpha < 1.0:
            for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
                try:
                    setattr(m, attr, val)
                except Exception:  # noqa: BLE001
                    pass
            m.use_backface_culling = False
        web_mats[name] = m
        return m

    # ---- source colour for unmatched furniture materials (flat value or the mean of its base-colour image) ----
    colour_cache = {}

    def source_colour(mat):
        if mat is None:
            return None
        if mat.name in colour_cache:
            return colour_cache[mat.name]
        col = tuple(mat.diffuse_color[:3])
        try:
            if mat.use_nodes:
                p = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
                if p is not None:
                    sock = p.inputs["Base Color"]
                    if sock.is_linked:
                        node = sock.links[0].from_node
                        if node.type == "TEX_IMAGE" and node.image is not None:
                            img = node.image.copy()
                            img.scale(8, 8)
                            px = list(img.pixels)
                            bpy.data.images.remove(img)
                            n = len(px) // 4
                            if n:
                                col = tuple(sum(px[i::4][:n]) / n for i in range(3))
                                # image pixels are sRGB-encoded for colour images; linearise roughly
                                col = tuple(c ** 2.2 for c in col)
                    else:
                        col = tuple(sock.default_value[:3])
        except Exception as e:  # noqa: BLE001
            log(f"  colour of {mat.name}: {e}; using diffuse_color")
        colour_cache[mat.name] = col
        return col

    def quant_name(col):
        q = tuple(min(3, int(max(0.0, min(1.0, c)) ** (1 / 2.2) * 4)) for c in col)   # 4 levels per channel, sRGB-ish
        return "web_furn_" + "".join(str(v) for v in q), tuple(((v + 0.5) / 4) ** 2.2 for v in q)

    # ---- pass 1: classify + bake every object to a world-space bmesh ----
    t = time.time()
    dropped = {}
    floors = {}          # room id -> (bm, floor_key)
    groups = {}          # group name -> list of (bm, category)
    floor_objs = []
    pending_furn = []    # (bm, name) assigned to a room after the floors exist
    tri_in = 0
    for ob in list(bpy.context.scene.objects):
        name = ob.name
        if ob.type not in ("MESH", "CURVE", "SURFACE", "META", "FONT"):
            dropped.setdefault(f"type {ob.type}", []).append(name)
            continue
        if ob.hide_render:
            dropped.setdefault("hidden in render", []).append(name)
            continue
        cat, why = classify_object(name)
        if cat == "drop":
            dropped.setdefault(why, []).append(name)
            continue
        ev = ob.evaluated_get(dg)
        try:
            me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
        except Exception as e:  # noqa: BLE001
            dropped.setdefault(f"no mesh ({e.__class__.__name__})", []).append(name)
            continue
        if not len(me.polygons):
            bpy.data.meshes.remove(me)
            dropped.setdefault("empty mesh", []).append(name)
            continue
        bm = bmesh.new()
        bm.from_mesh(me)
        mw = ob.matrix_world.copy()
        bm.transform(mw)
        if mw.determinant() < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        zs = [v.co.z for v in bm.verts]
        zmin, zmax = min(zs), max(zs)
        # source material per face -> web material name (stored as a string layer is not possible: keep a map)
        slots = [s.material for s in ob.material_slots] or list(me.materials)
        floor_key = None
        if cat == "floor" or cat == "floorfill":
            src = slots[0].name if slots and slots[0] else ""
            room = rooms_meta.get(name[len("FLOOR_"):]) if cat == "floor" else None
            floor_key = floor_class_from_material(src, room)
            if cat == "floorfill":
                tail = name[len("FLOORFILL_"):]
                floor_key = tail if tail in ("floor", "floor_wet", "floor_outdoor") else floor_key
        slot_web = []                                   # one lookup per slot, not per face
        for src in (slots or [None]):
            wname = web_material_for(cat, src.name if src else "", floor_key, args.floor)
            if wname is None:
                if args.furniture_colours == "source":
                    wname, qcol = quant_name(source_colour(src) or palette["web_furniture"][0])
                    web_mat(wname, qcol)
                else:
                    wname = "web_furniture"
            slot_web.append(web_index(wname))
        nslot = len(slot_web)
        face_web = [slot_web[f.material_index if f.material_index < nslot else 0] for f in bm.faces]
        bpy.data.meshes.remove(me)
        tri_in += sum(len(f.verts) - 2 for f in bm.faces)
        # wholly above the cut: hanging cabinets, wall art, pendant lamps -> they would float
        if zmin > cut_z - 0.02 and cat != "floor":
            bm.free()
            dropped.setdefault("wholly above the cut", []).append(name)
            continue
        # material_index = index into the global web-name table (survives to_mesh / from_mesh)
        for f, wi in zip(bm.faces, face_web):
            f.material_index = wi
        do_cut, do_cap = CATEGORIES[cat]
        if do_cut and zmax > cut_z + 1e-4:
            cut_mesh(bm, cut_z, cap_index=web_index("web_cap") if do_cap else None, bmesh=bmesh)
            if not len(bm.faces):
                bm.free()
                dropped.setdefault("empty after the cut", []).append(name)
                continue
        if cat == "floor":
            rid = name[len("FLOOR_"):]
            floors[rid] = bm
            floor_objs.append((rid, bm))
        elif cat == "floorfill":
            groups.setdefault("floorfill", []).append((bm, cat))
        elif cat == "furniture" or cat == "builtin":
            pending_furn.append((bm, cat, name))
        else:
            gname = {"wall": "walls", "glass": "glass", "frame": "frames", "door": "doors",
                     "door_metal": "doors"}[cat]
            groups.setdefault(gname, []).append((bm, cat))
    timings["bake_s"] = round(time.time() - t, 2)
    log(f"baked: {len(floor_objs)} floors, {sum(len(v) for v in groups.values())} architecture parts, "
        f"{len(pending_furn)} furniture/built-in parts; dropped {sum(len(v) for v in dropped.values())} "
        f"({', '.join(f'{k}: {len(v)}' for k, v in dropped.items())}) in {timings['bake_s']} s")

    # ---- furniture -> room by casting down onto the floors ----
    trees = {}
    for rid, bm in floor_objs:
        trees[rid] = BVHTree.FromBMesh(bm)
    room_of = {}
    for bm, cat, name in pending_furn:
        c = Vector((0, 0, 0))
        for v in bm.verts:
            c += v.co
        c /= max(1, len(bm.verts))
        best, best_d = None, 1e9
        for rid, tree in trees.items():
            hit = tree.ray_cast(Vector((c.x, c.y, 50.0)), Vector((0, 0, -1)))
            if hit[0] is not None and hit[3] < best_d:
                best, best_d = rid, hit[3]
        if best is None:   # the nearest floor in plan
            for rid, tree in trees.items():
                loc = tree.find_nearest(Vector((c.x, c.y, 0.0)))
                if loc[0] is not None and loc[3] < best_d:
                    best, best_d = rid, loc[3]
        rid = best or "misc"
        room_of[name] = rid
        prefix = "built" if cat == "builtin" else "furn"
        groups.setdefault(f"{prefix}_{rid}", []).append((bm, cat))

    # ---- merge each group into one mesh object ----
    t = time.time()
    names_table = WEB_NAMES

    def bm_to_object(oname, parts):
        out = bmesh.new()
        for bm, _cat in parts:          # append each part (material_index = global web index)
            tmp = bpy.data.meshes.new("_tmp")
            bm.to_mesh(tmp)
            out.from_mesh(tmp)
            bpy.data.meshes.remove(tmp)
        used = sorted({f.material_index for f in out.faces})
        remap = {u: i for i, u in enumerate(used)}
        for f in out.faces:
            f.material_index = remap[f.material_index]
        bmesh.ops.remove_doubles(out, verts=out.verts[:], dist=1e-5)
        me = bpy.data.meshes.new(oname)
        out.to_mesh(me)
        out.free()
        for u in used:
            me.materials.append(web_mat(names_table[u]))
        claim_name(bpy.data.objects, oname)
        return bpy.data.objects.new(oname, me)

    # build output objects
    out_objs = {}
    for rid, bm in floor_objs:
        out_objs[f"floor_{rid}"] = (bm_to_object(f"floor_{rid}", [(bm, "floor")]), "floor", rid)
    for gname, parts in sorted(groups.items()):
        kind = ("furniture" if gname.startswith("furn_") else "builtin" if gname.startswith("built_")
                else "architecture")
        out_objs[gname] = (bm_to_object(gname, parts), kind, None)
    for rid, bm in floor_objs:
        bm.free()
    for parts in groups.values():
        for bm, _ in parts:
            bm.free()

    # remove every original object from the scene; link the output (--bake-light: the originals first become the
    # bake's light; bake_light() removes them after the bake)
    if args.bake_light:
        args._bake_scene = prepare_bake_scene(bpy, bmesh, cut_z)
    else:
        for ob in list(bpy.context.scene.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
    coll = bpy.context.scene.collection
    for oname, (ob, kind, rid) in out_objs.items():
        coll.objects.link(ob)
        ob["habait_kind"] = kind
        if rid:
            ob["room_id"] = rid
            for k, v in (rooms_meta.get(rid) or {}).items():
                if v is not None and k != "id":
                    ob[f"room_{k}"] = v
    timings["merge_s"] = round(time.time() - t, 2)

    # ---- simplify: architecture limit-dissolve; furniture decimate to the budget ----
    t = time.time()

    def tris(me):
        return sum(len(p.vertices) - 2 for p in me.polygons)

    for oname, (ob, kind, rid) in out_objs.items():
        if kind in ("architecture", "floor", "builtin"):
            bm = bmesh.new()
            bm.from_mesh(ob.data)
            bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.0), use_dissolve_boundaries=False,
                                     verts=bm.verts[:], edges=bm.edges[:], delimit={"MATERIAL", "NORMAL"})
            bm.to_mesh(ob.data)
            bm.free()
    bpy.context.view_layer.update()
    arch_tris = sum(tris(ob.data) for ob, kind, _ in out_objs.values() if kind != "furniture")
    furn_full = {o: tris(ob.data) for o, (ob, kind, _) in out_objs.items() if kind == "furniture"}
    furn_tris = sum(furn_full.values())
    budget_furn = max(5000, int(args.max_tris) - arch_tris)
    ratio = min(1.0, budget_furn / max(1, furn_tris))
    timings["simplify_s"] = round(time.time() - t, 2)
    log(f"triangles in {tri_in:,}; architecture {arch_tris:,}; furniture {furn_tris:,} -> ratio {ratio:.3f} "
        f"(max {int(args.max_tris):,})")

    # --bake-light: on the simplified geometry (the triangle count stays Phase 1's), before the furniture copies
    if args.bake_light:
        t = time.time()
        args._bake = bake_light(bpy, bmesh, Vector, args, out_objs, out_dir, blend_path)
        args._bake["scene"] = getattr(args, "_bake_scene", None)
        timings["bake_light_s"] = round(time.time() - t, 2)

    furn_src = {o: ob.data.copy() for o, (ob, kind, _) in out_objs.items() if kind == "furniture"}

    def apply_ratio(r):
        for o, (ob, kind, _) in out_objs.items():
            if kind != "furniture":
                continue
            old = ob.data
            ob.data = furn_src[o].copy()
            if old.users == 0:
                bpy.data.meshes.remove(old)
            if r < 0.999:
                mod = ob.modifiers.new("dec", "DECIMATE")
                mod.decimate_type = "COLLAPSE"
                mod.ratio = r
                mod.use_collapse_triangulate = True
                bpy.context.view_layer.update()
                dgx = bpy.context.evaluated_depsgraph_get()
                new = bpy.data.meshes.new_from_object(ob.evaluated_get(dgx), preserve_all_data_layers=False,
                                                      depsgraph=dgx)
                ob.modifiers.remove(mod)
                prev = ob.data
                ob.data = new
                if prev.users == 0:
                    bpy.data.meshes.remove(prev)

    # ---- export (re-export with a smaller furniture ratio while over the byte target) ----
    attempts = []
    for k in range(int(args.attempts)):
        t = time.time()
        apply_ratio(ratio)
        for ob in bpy.context.scene.objects:
            ob.select_set(ob.name in out_objs)
        kw = dict(filepath=glb_path, export_format="GLB", use_selection=True,
                  export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                  export_draco_position_quantization=int(args.qpos), export_draco_normal_quantization=8,
                  export_draco_texcoord_quantization=12 if args.bake_light else 10, export_draco_color_quantization=8,
                  export_draco_generic_quantization=12,
                  export_texcoords=bool(args.bake_light), export_normals=True, export_tangents=False,
                  export_materials="EXPORT", export_cameras=False, export_lights=False, export_extras=True,
                  export_yup=True, export_apply=True, export_animations=False, export_skins=False,
                  export_morph=False, export_vertex_color="NONE")
        try:
            bpy.ops.export_scene.gltf(**kw)
        except TypeError as e:   # an exporter without one of the kwargs: drop the unknown ones and retry
            log(f"exporter kwargs: {e}; retrying with the minimal set")
            for drop in ("export_vertex_color", "export_texcoords", "export_tangents"):
                kw.pop(drop, None)
            bpy.ops.export_scene.gltf(**kw)
        size = os.path.getsize(glb_path)
        tri_out = sum(tris(ob.data) for ob, _k, _r in out_objs.values())
        attempts.append({"furniture_ratio": round(ratio, 4), "triangles": tri_out, "bytes": size,
                         "export_s": round(time.time() - t, 2)})
        log(f"export {k + 1}: ratio {ratio:.3f}, {tri_out:,} triangles, {size:,} bytes "
            f"({attempts[-1]['export_s']} s)")
        if size <= int(args.target_bytes):
            break
        ratio *= max(0.3, min(0.85, (int(args.target_bytes) / size) ** 1.3))
    timings["export_s"] = round(sum(a["export_s"] for a in attempts), 2)
    if args.bake_light and args.floor_variants:
        t = time.time()
        v = export_variants(bpy, args, kw, out_dir)
        main = open(glb_path, "rb").read()
        bins = {x["bin_sha256"] for x in v.values()} | {glb_bin_sha256(main)}
        args._bake["variants"] = v
        args._bake["main_bin_sha256"] = glb_bin_sha256(main)
        args._bake["one_bin_chunk"] = len(bins) == 1
        timings["variants_s"] = round(time.time() - t, 2)
        if len(bins) != 1:
            log(f"FAIL floor variants: {len(bins)} BIN chunks")

    # ---- top.png: orthographic, from above, plan north up (report written first: a killed render keeps it) ----
    top = None
    write_report(bpy, args, out_objs, glb_path, rep_path, blend_path, report_in, build_rep, rooms_meta, cut_z,
                 attempts, room_of, dropped, top, timings, t0)
    if args.top_engine != "none":
        t = time.time()
        try:
            top = render_top(bpy, Vector, out_objs, top_path, int(args.top_res), args.top_engine)
        except Exception as e:  # noqa: BLE001
            log(f"top.png failed: {e.__class__.__name__}: {e}")
            top = {"error": f"{e.__class__.__name__}: {e}"}
        timings["top_s"] = round(time.time() - t, 2)

    size = write_report(bpy, args, out_objs, glb_path, rep_path, blend_path, report_in, build_rep, rooms_meta,
                        cut_z, attempts, room_of, dropped, top, timings, t0)
    if args.bake_light and getattr(args, "_bake", {}).get("one_bin_chunk") is False:
        return 4
    return 0 if size <= int(args.target_bytes) or size <= 1048576 else 3


# ----------------------------------------------------------------------------------------------------------------
# --bake-light (board apartment-3d card 07): the originals light the bake, the web copies receive it
# ----------------------------------------------------------------------------------------------------------------

def prepare_bake_scene(bpy, bmesh, cut_z):
    """Turn the ORIGINAL scene into the bake's light, before the originals are removed: ceilings (warm white),
    lights, luminaires, terrain and the world stay; every exported object is hidden, and the part of it ABOVE the
    cut stays as an occluder in the tour's palette (the web copy below the cut is what receives the light), so the
    apartment is lit as if whole and nothing is coincident with a receiver."""
    from mathutils import Vector
    sc = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    mats = {}

    def flat(key):
        if key not in mats:
            m = bpy.data.materials.new(f"_bake_{key}")
            m.use_nodes = True
            p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            p.inputs["Base Color"].default_value = (*BAKE_ALBEDO[key], 1.0)
            p.inputs["Roughness"].default_value = 0.9
            mats[key] = m
        return mats[key]

    def recolour(ob, key):
        if not ob.material_slots:
            ob.data.materials.append(flat(key))
        for slot in ob.material_slots:
            slot.material = flat(key)

    st = {"lights": 0, "kept": 0, "ceilings": 0, "hidden": 0, "upper_parts": 0}
    for ob in list(sc.objects):
        if ob.type == "LIGHT":
            st["lights"] += int(not ob.hide_render)
            continue
        if ob.type not in ("MESH", "CURVE", "SURFACE", "META", "FONT") or ob.hide_render:
            continue
        cat, why = classify_object(ob.name)
        role = bake_role(cat, why)
        if ob.name.startswith("CEILFILL"):          # the ceiling filler (classified furniture for the export): a ceiling
            role = "ceiling"
        if role == "hide":
            ob.hide_render = True
            st["hidden"] += 1
            continue
        if role == "keep":
            st["kept"] += 1
            continue
        if role == "ceiling":
            recolour(ob, "ceiling")
            st["ceilings"] += 1
            continue
        # split: the web copy stands in below the cut; above it, only what the export cut away stays
        ob.hide_render = True
        try:
            me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=False, depsgraph=dg)
        except Exception:  # noqa: BLE001
            st["hidden"] += 1
            continue
        bm = bmesh.new()
        bm.from_mesh(me)
        mw = ob.matrix_world.copy()
        bm.transform(mw)
        if mw.determinant() < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        zs = [v.co.z for v in bm.verts] or [0.0]
        cut, _cap = CATEGORIES[cat]
        whole_above = min(zs) > cut_z - 0.02 and cat != "floor"      # the export dropped it ("wholly above the cut")
        # gate 3 (D1): furniture / built-ins wholly above the cut (shelves, wall cabinets, art) are not in the
        # dollhouse, so their shadow on the floor would be a shadow of nothing (slatted dashes): not an occluder either
        if whole_above and cat in ("furniture", "builtin", "door_metal"):
            bm.free()
            bpy.data.meshes.remove(me)
            st["hidden"] += 1
            continue
        if (not cut and not whole_above) or max(zs) <= cut_z + 1e-4:
            bm.free()
            bpy.data.meshes.remove(me)
            st["hidden"] += 1
            continue
        if not whole_above:
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5,
                                   plane_co=Vector((0, 0, cut_z)), plane_no=Vector((0, 0, 1)),
                                   clear_inner=True, clear_outer=False)
        if not len(bm.faces):
            bm.free()
            bpy.data.meshes.remove(me)
            st["hidden"] += 1
            continue
        bm.to_mesh(me)
        bm.free()
        key = {"wall": "plaster", "door": "plaster", "builtin": "sand", "furniture": "sand", "frame": "frame",
               "door_metal": "frame"}.get(cat)
        if key:                                   # glass keeps its own (transparent) material
            me.materials.clear()
            me.materials.append(flat(key))
        up = bpy.data.objects.new("_bake_up_" + ob.name, me)
        sc.collection.objects.link(up)
        st["upper_parts"] += 1
    log(f"bake scene: {st}")
    return st


def _srgb(x):
    import numpy as np
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.maximum(x, 0), 1 / 2.4) - 0.055)


def _denoise_oidn(bpy, img, res, path):
    """OIDN through the compositor of a throwaway scene (Image -> Denoise -> Composite, 32-bit EXR)."""
    import numpy as np
    scn = bpy.data.scenes.new("_bake_dn")
    scn.use_nodes = True
    nt = scn.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    a = nt.nodes.new("CompositorNodeImage")
    a.image = img
    d = nt.nodes.new("CompositorNodeDenoise")
    for k, v in (("prefilter", "ACCURATE"), ("use_hdr", True), ("quality", "HIGH")):
        try:
            setattr(d, k, v)
        except Exception:  # noqa: BLE001
            pass
    c = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(a.outputs["Image"], d.inputs["Image"])
    nt.links.new(d.outputs["Image"], c.inputs["Image"])
    r = scn.render
    r.engine = "BLENDER_WORKBENCH"
    r.resolution_x = r.resolution_y = res
    r.resolution_percentage = 100
    r.image_settings.file_format = "OPEN_EXR"
    r.image_settings.color_depth = "32"
    r.image_settings.color_mode = "RGBA"
    try:
        scn.view_settings.view_transform = "Standard"
    except Exception:  # noqa: BLE001
        pass
    r.filepath = path
    bpy.ops.render.render(write_still=True, scene=scn.name)
    out = bpy.data.images.load(path)
    buf = np.empty(res * res * 4, np.float32)
    out.pixels.foreach_get(buf)
    bpy.data.images.remove(out)
    bpy.data.scenes.remove(scn)
    try:
        os.remove(path)
    except OSError:
        pass
    return buf.reshape(res, res, 4)


def _occluded_fix(rgb, valid, ratio=0.25, rounds=4, win=7):
    """gate 3 D1: floor texels whose centre lies under a wall bake near-black and, along a wall base, read as dark dashes.
    A used texel darker than ratio x the mean of the used texels in its win x win window is occluded: it takes
    the brightest used neighbour (3x3), round after round (dashes up to `rounds` px thick). Gradual shadows stay."""
    import numpy as np
    out = rgb.astype(np.float32).copy()
    h, w = valid.shape
    lum = 0.2126 * out[..., 0] + 0.7152 * out[..., 1] + 0.0722 * out[..., 2]
    # the reference: the mean of the used texels in the win x win window (running sums; thin dashes barely move it)
    r = win // 2
    vm = valid.astype(np.float32)
    num = np.zeros((h, w), np.float32)
    den = np.zeros((h, w), np.float32)
    lv = lum * vm
    for dy in range(-r, r + 1):
        a1 = np.roll(lv, dy, axis=0)
        a2 = np.roll(vm, dy, axis=0)
        for dx in range(-r, r + 1):
            num += np.roll(a1, dx, axis=1)
            den += np.roll(a2, dx, axis=1)
    ref = np.where(den > 0, num / np.maximum(den, 1), 0)
    bad = valid & (ref > 0) & (lum < ratio * ref)
    total = int(bad.sum())
    good = valid & ~bad
    for _ in range(rounds):
        if not bad.any():
            break
        G = np.where(good, lum, -1.0)
        Pg = np.pad(G, 1, constant_values=-1.0)
        Pc = np.pad(out, ((1, 1), (1, 1), (0, 0)))
        best = np.full((h, w), -1.0, np.float32)
        col = np.zeros_like(out)
        for dy in range(3):
            for dx in range(3):
                v = Pg[dy:dy + h, dx:dx + w]
                take = v > best
                best = np.where(take, v, best)
                col = np.where(take[..., None], Pc[dy:dy + h, dx:dx + w], col)
        fixed = bad & (best >= 0)
        out[fixed] = col[fixed]
        lum = np.where(fixed, 0.2126 * out[..., 0] + 0.7152 * out[..., 1] + 0.0722 * out[..., 2], lum)
        good = good | fixed
        bad = bad & ~fixed
    return out, total


def _collapse_thin_islands(bmesh, recv, skip, res, min_texels=2.0, scale=0.98):
    """A UV island narrower than ~1 texel holds no texel centre: it never bakes and, on screen, samples its neighbours
    (thin 'barcode' dashes along 2-5 cm slab sides). Islands under min_texels wide (2 x area / perimeter, in texels)
    are collapsed onto one point of a strip kept free of islands (everything else is scaled into `scale` of the
    square); that texel stays unbaked, so it carries the atlas mean."""
    spot = (scale + 1) / 2
    st = {"islands": 0, "faces": 0, "min_texels": min_texels, "scale": scale}
    for ob in recv:
        me = ob.data
        bm = bmesh.new()
        bm.from_mesh(me)
        uvl = bm.loops.layers.uv.active
        names = [m.name if m else "" for m in me.materials]
        faces = [f for f in bm.faces if (names[f.material_index] if f.material_index < len(names) else "") not in skip]
        idx = {f: i for i, f in enumerate(faces)}
        parent = list(range(len(faces)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        def uv_of(f, v):
            for lp in f.loops:
                if lp.vert == v:
                    return lp[uvl].uv
            return None
        seam = set()
        for e in bm.edges:
            lf = [f for f in e.link_faces if f in idx]
            if len(lf) != 2:
                seam.add(e)
                continue
            same = all((uv_of(lf[0], v) - uv_of(lf[1], v)).length < 1e-6 for v in e.verts)
            if same:
                a, b = find(idx[lf[0]]), find(idx[lf[1]])
                if a != b:
                    parent[a] = b
            else:
                seam.add(e)
        groups = {}
        for f in faces:
            groups.setdefault(find(idx[f]), []).append(f)
        for fs in groups.values():
            area = 0.0
            per = 0.0
            fset = set(fs)
            for f in fs:
                pts = [lp[uvl].uv for lp in f.loops]
                area += abs(sum(pts[i].x * pts[i - 1].y - pts[i - 1].x * pts[i].y for i in range(len(pts)))) / 2
                for lp in f.loops:
                    e = lp.edge
                    if e in seam or not all(g in fset for g in e.link_faces if g in idx):
                        per += (lp[uvl].uv - lp.link_loop_next[uvl].uv).length
            width = (2 * area / per * res) if per > 0 else 0.0
            if width < min_texels:
                st["islands"] += 1
                st["faces"] += len(fs)
                for f in fs:
                    for lp in f.loops:
                        lp[uvl].uv = (spot, spot)
        for f in faces:                       # everything else into [0, scale]: the strip above stays free
            for lp in f.loops:
                if tuple(lp[uvl].uv) != (spot, spot):
                    lp[uvl].uv = (lp[uvl].uv.x * scale, lp[uvl].uv.y * scale)
        bm.to_mesh(me)
        bm.free()
    return st


def _leak_fix(rgb, valid, ratio=0.6, passes=2):
    """masked 3x3 median: a used texel darker than ratio x its used neighbours' median takes that median (per channel).
    Returns (rgb, texels replaced). Deterministic, numpy only."""
    import numpy as np
    out = rgb.astype(np.float32).copy()
    total = 0
    h, w = valid.shape
    for _ in range(passes):
        lum = 0.2126 * out[..., 0] + 0.7152 * out[..., 1] + 0.0722 * out[..., 2]
        L = np.where(valid, lum, np.nan)
        P = np.pad(L, 1, constant_values=np.nan)
        stack = np.stack([P[dy:dy + h, dx:dx + w] for dy in range(3) for dx in range(3)])
        med = np.nanmedian(stack, axis=0)
        bad = valid & np.isfinite(med) & (lum < ratio * med)
        n = int(bad.sum())
        if not n:
            break
        for c in range(3):
            C = np.pad(np.where(valid, out[..., c], np.nan), 1, constant_values=np.nan)
            mc = np.nanmedian(np.stack([C[dy:dy + h, dx:dx + w] for dy in range(3) for dx in range(3)]), axis=0)
            out[..., c] = np.where(bad, mc, out[..., c])
        total += n
    return out, total


def _masked_blur(rgb, valid, sigma=1.5):
    """fallback denoise: a gaussian over valid texels only (blur(v*m)/blur(m)), separable, numpy only"""
    import numpy as np
    k = int(3 * sigma)
    w = np.exp(-0.5 * (np.arange(-k, k + 1) / sigma) ** 2)
    w /= w.sum()

    def blur(a):
        for ax in (0, 1):
            pad = [(k, k) if i == ax else (0, 0) for i in range(a.ndim)]
            p = np.pad(a, pad, mode="edge")
            a = sum(w[i] * np.take(p, range(i, i + a.shape[ax]), axis=ax) for i in range(2 * k + 1))
        return a
    m = valid.astype(np.float32)
    num = blur(rgb * m[..., None])
    den = blur(m)[..., None]
    return np.where(den > 1e-6, num / np.maximum(den, 1e-6), rgb)


def bake_light(bpy, bmesh, Vector, args, out_objs, out_dir, blend_path):
    """UVs (one atlas over every receiver), a light-only Cycles bake (Diffuse, direct + indirect, colour off), OIDN,
    the encode (sRGB of irradiance x scale, scale in the report) to light.webp + light-1024.webp, an optional
    Workbench preview; then the originals are removed and the web materials restored (export sees UVs only)."""
    import numpy as np
    t0 = time.time()
    sc = bpy.context.scene
    res = int(args.bake_res)
    skip = {"glass", "web_cap"}
    outs = [ob for ob, _k, _r in out_objs.values()]
    recv = [ob for ob in outs if any(m and m.name not in skip for m in ob.data.materials)]

    # ---- 1. UVs: smart project over all receivers at once (one shared atlas); caps and glass faces stay out ----
    t = time.time()
    bpy.ops.object.select_all(action="DESELECT")
    for ob in recv:
        ob.data.uv_layers.new(name="UVMap")
        ob.select_set(True)
    bpy.context.view_layer.objects.active = recv[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="FACE")
    for ob in recv:
        bm = bmesh.from_edit_mesh(ob.data)
        uvl = bm.loops.layers.uv.active
        names = [m.name if m else "" for m in ob.data.materials]
        for f in bm.faces:
            keep = (names[f.material_index] if f.material_index < len(names) else "") not in skip
            f.select_set(keep)
            if not keep:
                for lp in f.loops:
                    lp[uvl].uv = (0.0, 0.0)
        bmesh.update_edit_mesh(ob.data)
    sc.tool_settings.use_uv_select_sync = True       # the UV ops act on the selected faces, no UV editor needed
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), margin_method="FRACTION",
                             island_margin=float(args.bake_margin), area_weight=0.0, correct_aspect=True,
                             scale_to_bounds=False)
    # one pack over every receiver's islands (rotations allowed): smart project alone filled ~16 % of the square
    try:
        bpy.ops.uv.pack_islands(rotate=True, margin_method="FRACTION", margin=float(args.bake_margin),
                                shape_method="CONCAVE")
    except TypeError:
        bpy.ops.uv.pack_islands(rotate=True, margin=float(args.bake_margin))
    bpy.ops.object.mode_set(mode="OBJECT")
    # gate 3 (D1): the floorfill lies coplanar under every floor; as an occluder it striped the floors' light
    for ob in recv:
        if ob.name.startswith("floorfill"):
            ob.visible_shadow = False
    uv_s = round(time.time() - t, 2)
    # per receiver: UV area vs surface area (a receiver with no UV area would bake nothing)
    uv_area, empty = 0.0, []
    for ob in recv:
        me = ob.data
        uvd = me.uv_layers.active.data
        names = [m.name if m else "" for m in me.materials]
        a = 0.0
        for poly in me.polygons:
            if (names[poly.material_index] if poly.material_index < len(names) else "") in skip:
                continue
            pts = [uvd[i].uv for i in poly.loop_indices]
            a += abs(sum(pts[i].x * pts[i - 1].y - pts[i - 1].x * pts[i].y for i in range(len(pts)))) / 2
        uv_area += a
        if a <= 1e-9:
            empty.append(ob.name)
    log(f"bake UVs: {len(recv)} receivers, one atlas, margin {args.bake_margin}, UV fill {uv_area:.1%}"
        f"{', no UV area: ' + ', '.join(empty) if empty else ''} ({uv_s} s)")
    thin = _collapse_thin_islands(bmesh, recv, skip, res)
    log(f"bake UVs: {thin['islands']} islands under {thin['min_texels']} texels wide ({thin['faces']} faces: slab "
        f"sides, trims) -> one unbaked texel (the atlas mean); the rest scaled into {thin['scale']:.0%} of the square")

    # ---- 2. the bake's materials: an image node per material (atlas, or a throwaway for caps/glass), albedo ----
    atlas = bpy.data.images.new("_bake_light", res, res, alpha=True, float_buffer=True)
    atlas.colorspace_settings.name = "Non-Color"
    atlas.pixels.foreach_set(np.zeros(res * res * 4, np.float32))
    dummy = bpy.data.images.new("_bake_dummy", 8, 8, alpha=True, float_buffer=True)
    mats = sorted({m for ob in recv for m in ob.data.materials if m}, key=lambda m: m.name)
    saved, added = {}, []
    for m in mats:
        m.use_nodes = True
        nt = m.node_tree
        p = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if p is not None:
            saved[m.name] = (p, tuple(p.inputs["Base Color"].default_value))
            key = bake_albedo(m.name)
            if key:
                p.inputs["Base Color"].default_value = (*BAKE_ALBEDO[key], 1.0)
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = dummy if m.name in skip else atlas
        nt.nodes.active = node
        added.append((m, node))

    # ---- 3. the bake: Cycles CPU, seed 0, light only ----
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = int(args.bake_samples)
    sc.cycles.seed = 0
    sc.cycles.use_animated_seed = False
    sc.cycles.use_adaptive_sampling = False
    sc.cycles.use_denoising = False
    sc.render.bake.use_pass_direct = True
    sc.render.bake.use_pass_indirect = True
    sc.render.bake.use_pass_color = False
    margin_px = max(2, int(round(float(args.bake_margin) * res / 2)))
    bpy.ops.object.select_all(action="DESELECT")
    for ob in recv:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = recv[0]
    log(f"bake: {res}x{res}, {args.bake_samples} samples, bounces {sc.cycles.max_bounces}/diffuse "
        f"{sc.cycles.diffuse_bounces}, margin {margin_px} px ...")
    t = time.time()
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=margin_px, margin_type="EXTEND",
                        use_clear=False, target="IMAGE_TEXTURES", use_selected_to_active=False)
    bake_s = round(time.time() - t, 2)
    log(f"bake done in {bake_s} s")
    buf = np.empty(res * res * 4, np.float32)
    atlas.pixels.foreach_get(buf)
    img = buf.reshape(res, res, 4)
    valid = img[..., 3] > 0.5
    if not valid.any():
        valid = img[..., :3].max(axis=2) > 0
    rgb = img[..., :3].copy()

    # ---- 4. denoise (OIDN; masked blur if the compositor route fails) ----
    t = time.time()
    try:
        den = _denoise_oidn(bpy, atlas, res, os.path.join(out_dir, "_bake_dn.exr"))[..., :3]
        method = "oidn (compositor Denoise)"
        if not np.isfinite(den).all() or float(den[valid].max(initial=0)) <= 0:
            raise RuntimeError("empty denoise output")
    except Exception as e:  # noqa: BLE001
        log(f"OIDN route failed ({e.__class__.__name__}: {e}); masked blur instead")
        den = _masked_blur(rgb, valid)
        method = "masked gaussian sigma 1.5 px"
    den = np.where(valid[..., None], np.maximum(den, 0), 0)
    # the edge leak fix: a texel whose centre fell inside touching geometry (a floor edge under a wall, a 5 cm slab side)
    # bakes dark and, along a thin edge, alternates with lit ones ("barcode" dashes on screen). A masked 3x3 median over
    # used texels replaces texels far darker than their neighbourhood; a real shadow is smooth and stays
    den, leak_n = _leak_fix(den, valid)
    den, occl_n = _occluded_fix(den, valid)
    dn_s = round(time.time() - t, 2)

    # ---- 5. encode: irradiance x scale (p99 -> 0.92), sRGB, empty texels = the mean (no black bleed in mips) ----
    lum = 0.2126 * den[..., 0] + 0.7152 * den[..., 1] + 0.0722 * den[..., 2]
    lv = lum[valid]
    p99 = float(np.percentile(lv, 99)) if lv.size else 1.0
    scale = 0.92 / max(p99, 1e-6)
    enc = np.clip(den * scale, 0, 1)
    mean = enc[valid].mean(axis=0) if valid.any() else np.array([0.5, 0.5, 0.5])
    enc[~valid] = mean
    med = float(np.median(lv)) if lv.size else 0.0
    dark = float((lv < 0.03 * med).mean()) if lv.size else 0.0
    px = np.ones((res, res, 4), np.float32)
    px[..., :3] = _srgb(enc)
    lm = bpy.data.images.new("_bake_light_srgb", res, res, alpha=False, float_buffer=False)
    lm.colorspace_settings.name = "sRGB"
    lm.pixels.foreach_set(px.ravel())
    files = {}
    for fname, size in (("light.webp", res), ("light-1024.webp", min(1024, res))):
        im = lm if size == res else lm.copy()
        if size != res:
            im.scale(size, size)
        path = os.path.join(out_dir, fname)
        try:
            im.file_format = "WEBP"
            im.filepath_raw = path
            im.save(filepath=path, quality=85)
        except Exception as e:  # noqa: BLE001
            path = os.path.splitext(path)[0] + ".png"
            log(f"WEBP save failed ({e}); PNG {path}")
            im.file_format = "PNG"
            im.filepath_raw = path
            im.save(filepath=path)
        files[fname] = {"path": path.replace("\\", "/"), "px": size, "bytes": os.path.getsize(path),
                        "sha256": sha256_file(path)}
    log(f"light atlas: {files['light.webp']['bytes']:,} B; scale {scale:.4f}; dark texels {dark:.4%}; {method}; "
        f"edge leak fix {leak_n:,} texels; occluded fix {occl_n:,} texels")

    # ---- 6. the originals go (as without --bake-light); optional Workbench preview of the atlas on the GLB ----
    names = {ob.name for ob in outs}
    for ob in list(sc.objects):
        if ob.name not in names:
            bpy.data.objects.remove(ob, do_unlink=True)
    preview = None
    if args.preview:
        try:
            for m, node in added:
                if node.image == atlas:
                    node.image = lm
            preview = _bake_preview(bpy, Vector, outs, args.preview)
        except Exception as e:  # noqa: BLE001
            log(f"preview failed: {e}")
            preview = {"error": str(e)}

    # ---- 7. restore: no image node, the palette colours (the GLB carries UVs only; the atlas ships beside it) ----
    for m, node in added:
        m.node_tree.nodes.remove(node)
    for _name, (p, col) in saved.items():
        p.inputs["Base Color"].default_value = col
    return {"res": res, "samples": int(args.bake_samples), "seconds": bake_s, "uv_seconds": uv_s,
            "denoise": method, "denoise_seconds": dn_s, "leak_fix_texels": leak_n, "occluded_fix_texels": occl_n, "total_seconds": round(time.time() - t0, 2),
            "atlas_bytes": files["light.webp"]["bytes"], "files": files, "scale": round(scale, 6),
            "encode": "sRGB(irradiance * scale), p99 -> 0.92; lightMapIntensity ~ 1/scale",
            "dark_texel_fraction": round(dark, 6), "valid_texel_fraction": round(float(valid.mean()), 4),
            "receivers": len(recv), "uv_margin": float(args.bake_margin), "margin_px": margin_px,
            "scene_sha256": sha256_file(blend_path), "palette_source": BAKE_PALETTE_SOURCE,
            "albedo": {k: list(v) for k, v in BAKE_ALBEDO.items()}, "pass": "DIFFUSE direct+indirect, colour off",
            "device": "CPU", "seed": 0, "preview": preview}


def _bake_preview(bpy, Vector, outs, path):
    """Workbench, flat light, texture colour: the atlas alone on the cut model, a 3/4 view (like the 3D preset)."""
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for ob in outs:
        for v in ob.data.vertices:
            for i in range(3):
                lo[i] = min(lo[i], v.co[i])
                hi[i] = max(hi[i], v.co[i])
    c = (lo + hi) / 2
    span = (hi - lo).length
    scn = bpy.context.scene
    cd = bpy.data.cameras.new("_PREV")
    cd.lens = 50
    cam = bpy.data.objects.new("_PREV", cd)
    d = Vector((1.25, -1.65, 1.7)).normalized()
    cam.location = c + d * span * 1.45
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    scn.collection.objects.link(cam)
    scn.camera = cam
    r = scn.render
    r.engine = "BLENDER_WORKBENCH"
    r.resolution_x, r.resolution_y, r.resolution_percentage = 1600, 1000, 100
    r.film_transparent = False
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    sh = scn.display.shading
    sh.light = "FLAT"
    sh.color_type = "TEXTURE"
    try:
        scn.view_settings.view_transform = "Standard"
    except Exception:  # noqa: BLE001
        pass
    r.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    return {"path": path.replace("\\", "/"), "engine": "BLENDER_WORKBENCH", "shading": "FLAT, TEXTURE (atlas only)"}


def export_variants(bpy, args, kw, out_dir):
    """--floor-variants: the same mesh (one BIN chunk), only the interior floor material renamed and recoloured,
    exactly as a separate --floor run names and colours it."""
    base = f"web_floor_{args.floor}"
    m = bpy.data.materials.get(base)
    out = {}
    if m is None:
        log(f"floor variants: no {base} material")
        return out
    p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    keep = (m.name, tuple(p.inputs["Base Color"].default_value), p.inputs["Roughness"].default_value,
            tuple(m.diffuse_color))
    for fl in [f.strip() for f in args.floor_variants.split(",") if f.strip()]:
        rgb, rough = FLOOR_COLORS[fl]
        if fl != args.floor:
            claim_name(bpy.data.materials, f"web_floor_{fl}")
        m.name = f"web_floor_{fl}"
        p.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        p.inputs["Roughness"].default_value = rough
        m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0)
        path = os.path.join(out_dir, f"{args.name}-{fl}.glb")
        bpy.ops.export_scene.gltf(**dict(kw, filepath=path))
        data = open(path, "rb").read()
        out[fl] = {"path": path.replace("\\", "/"), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                   "bin_sha256": glb_bin_sha256(data)}
        log(f"variant {fl}: {len(data):,} B, BIN {out[fl]['bin_sha256'][:12]}")
    m.name = keep[0]
    p.inputs["Base Color"].default_value = keep[1]
    p.inputs["Roughness"].default_value = keep[2]
    m.diffuse_color = keep[3]
    return out


def write_report(bpy, args, out_objs, glb_path, rep_path, blend_path, report_in, build_rep, rooms_meta, cut_z,
                 attempts, room_of, dropped, top, timings, t0):
    def tris(me):
        return sum(len(p.vertices) - 2 for p in me.polygons)
    mats_out = sorted({m.name for ob, _k, _r in out_objs.values() for m in ob.data.materials if m})
    gltf_ver = None
    try:
        import addon_utils
        for mod in addon_utils.modules():
            if mod.__name__.endswith("io_scene_gltf2"):
                gltf_ver = ".".join(str(x) for x in mod.bl_info.get("version", ()))
    except Exception:  # noqa: BLE001
        pass
    timings["total_s"] = round(time.time() - t0, 2)
    size = os.path.getsize(glb_path)
    rep = {
        "tool": "360walkaround/pipeline/export_dollhouse.py", "version": VERSION,
        "blender": bpy.app.version_string, "gltf_exporter": gltf_ver,
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "input": {"blend": blend_path.replace("\\", "/"), "blend_sha256": sha256_file(blend_path),
                  "build_report": report_in.replace("\\", "/") if build_rep else None,
                  "built_utc": (build_rep or {}).get("generator", {}).get("generated_utc"),
                  "build_floor_finish": ((build_rep or {}).get("floor_finish") or {}).get("mode"),
                  "build_skirting_objects": len((build_rep or {}).get("skirting_objects", [])),
                  "build_material_board": (((build_rep or {}).get("inputs") or {}).get("material_board")
                                           or {}).get("mode")},
        "settings": {"cut_height_m": cut_z, "floor": args.floor, "max_tris": int(args.max_tris),
                     "target_bytes": int(args.target_bytes), "draco_level": 6,
                     "draco_q": {"position": int(args.qpos), "normal": 8},
                     "texcoords": bool(getattr(args, "bake_light", False)),
                     "furniture_colours": args.furniture_colours},
        "glb": {"path": glb_path.replace("\\", "/"), "bytes": size, "le_1MiB": size <= 1048576,
                "nodes": len(out_objs), "materials": mats_out, "material_count": len(mats_out),
                "triangles": attempts[-1]["triangles"] if attempts else None,
                "attempts": attempts},
        "nodes": {o: {"kind": k, "room_id": r, "triangles": tris(ob.data),
                      "materials": [m.name for m in ob.data.materials if m]}
                  for o, (ob, k, r) in out_objs.items()},
        "furniture_room": room_of,
        "dropped": {k: sorted(v) for k, v in dropped.items()},
        "rooms": rooms_meta,
        "frames": {"world": "build_scene: metres, world X = x_cm/100, world Y = -y_cm/100, Z up",
                   "gltf": "Y up: glTF X = x_cm/100, glTF Y = height, glTF Z = y_cm/100"},
        "top": top,
        "timings_s": timings,
        "design_rules": "skirting + door casings dropped, one flat colour per floor class, cream door leaves",
    }
    if getattr(args, "_bake", None):
        rep["bake"] = args._bake
    with open(rep_path, "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=2, ensure_ascii=False)
    log(f"wrote {glb_path} ({size:,} bytes, {len(out_objs)} nodes, {len(mats_out)} materials), "
        f"{rep_path}; total {timings['total_s']} s")
    return size


def claim_name(coll, name):
    """Free `name` in a bpy ID collection by renaming the scene's own datablock out of the way."""
    old = coll.get(name)
    if old is not None:
        old.name = name + "__src"


# the global web-name table (index stored per face while parts are merged)
WEB_NAMES = []


def web_index(name):
    if name not in WEB_NAMES:
        WEB_NAMES.append(name)
    return WEB_NAMES.index(name)


def cut_mesh(bm, z, cap_index=None, bmesh=None):
    """Remove everything above z; cap the open cut with faces tagged `cap_index` (when given)."""
    from mathutils import Vector
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=Vector((0, 0, z)),
                                 plane_no=Vector((0, 0, 1)), clear_outer=True, clear_inner=False)
    if cap_index is None:
        return
    cut_edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge) and e.is_valid]
    boundary = [e for e in cut_edges if e.is_boundary]
    if not boundary:
        boundary = [e for e in bm.edges if e.is_boundary and all(abs(v.co.z - z) < 1e-4 for v in e.verts)]
    if not boundary:
        return
    before = set(bm.faces)
    try:
        bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    except Exception:  # noqa: BLE001
        try:
            bmesh.ops.edgeloop_fill(bm, edges=boundary)
        except Exception:  # noqa: BLE001
            return
    for f in bm.faces:
        if f not in before:
            f.material_index = cap_index
            f.normal_update()
            if f.normal.z < 0:
                f.normal_flip()


def render_top(bpy, Vector, out_objs, path, res, engine_pref):
    """Orthographic top view: world +Y (plan north of the drawing) up, transparent background."""
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for ob, _k, _r in out_objs.values():
        for v in ob.data.vertices:
            for i in range(3):
                lo[i] = min(lo[i], v.co[i])
                hi[i] = max(hi[i], v.co[i])
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    span = max(hi.x - lo.x, hi.y - lo.y) * 1.06
    scn = bpy.context.scene
    cam_data = bpy.data.cameras.new("TOP")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = span
    cam_data.clip_start = 0.1
    cam_data.clip_end = 200
    cam = bpy.data.objects.new("TOP", cam_data)
    cam.location = (cx, cy, hi.z + 20)
    cam.rotation_euler = (0, 0, 0)
    scn.collection.objects.link(cam)
    scn.camera = cam
    sun_d = bpy.data.lights.new("SUN", "SUN")
    sun_d.energy = 3.0
    sun_d.angle = math.radians(8)
    sun = bpy.data.objects.new("SUN", sun_d)
    sun.rotation_euler = (math.radians(25), math.radians(10), math.radians(30))
    scn.collection.objects.link(sun)
    if scn.world is None:
        scn.world = bpy.data.worlds.new("W")
    scn.world.use_nodes = True
    bg = next((n for n in scn.world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg is not None:
        bg.inputs[0].default_value = (1, 1, 1, 1)
        bg.inputs[1].default_value = 0.8
    r = scn.render
    r.resolution_x = r.resolution_y = res
    r.resolution_percentage = 100
    r.film_transparent = True
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA"
    try:
        scn.view_settings.view_transform = "Standard"
        scn.view_settings.look = "None"
    except Exception:  # noqa: BLE001
        pass
    engines = [e.identifier for e in type(r).bl_rna.properties["engine"].enum_items]
    eevee = next((e for e in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE") if e in engines), None)
    order = ([eevee, "BLENDER_WORKBENCH"] if engine_pref == "eevee" else ["BLENDER_WORKBENCH"])
    used, err = None, None
    for eng in [e for e in order if e]:
        try:
            r.engine = eng
            if eng == "BLENDER_WORKBENCH":
                scn.display.shading.light = "STUDIO"
                scn.display.shading.color_type = "MATERIAL"
            else:
                try:
                    scn.eevee.taa_render_samples = 16
                except Exception:  # noqa: BLE001
                    pass
            r.filepath = path
            bpy.ops.render.render(write_still=True)
            used = eng
            break
        except Exception as e:  # noqa: BLE001
            err = f"{eng}: {e}"
            log(f"top.png with {eng} failed: {e}")
    if used is None:
        raise RuntimeError(err or "no engine")
    log(f"top.png {res}x{res} with {used}")
    return {"path": path.replace("\\", "/"), "engine": used, "res_px": [res, res],
            "ortho_scale_m": round(span, 4), "centre_world_m": [round(cx, 4), round(cy, 4)],
            "pixel_to_plan_cm": "x_cm = 100*(cx + (u/W - 0.5)*s) ; y_cm = -100*(cy - (v/H - 0.5)*s) "
                                "(u right, v down, s = ortho_scale_m)"}


def parse(argv):
    ap = argparse.ArgumentParser(prog="export_dollhouse.py")
    ap.add_argument("--out", help="output directory")
    ap.add_argument("--name", default="apt846", help="GLB file stem (default apt846)")
    ap.add_argument("--blend", default=None, help="open this .blend (default: the one Blender was started with)")
    ap.add_argument("--report-in", default=None, help="build_scene report (default <blend stem>.report.json)")
    ap.add_argument("--cut-height", type=float, default=1.2, help="metres (default 1.2)")
    ap.add_argument("--floor", choices=sorted(FLOOR_COLORS), default="parquet")
    ap.add_argument("--max-tris", type=int, default=150000)
    ap.add_argument("--target-bytes", type=int, default=1000000)
    ap.add_argument("--attempts", type=int, default=4)
    ap.add_argument("--qpos", type=int, default=14, help="Draco position quantization bits")
    ap.add_argument("--furniture-colours", choices=["source", "neutral"], default="source",
                    help="unmatched furniture materials: quantised source colour (default) or one neutral")
    ap.add_argument("--top-res", type=int, default=2048)
    ap.add_argument("--top-engine", choices=["eevee", "workbench", "none"], default="eevee")
    # board apartment-3d card 07: rendered light in the tour's palette (light-only Cycles bake into one UV atlas)
    ap.add_argument("--bake-light", action="store_true", help="bake light.webp (+ light-1024.webp) and export UVs")
    ap.add_argument("--bake-res", type=int, default=2048)
    ap.add_argument("--bake-samples", type=int, default=128)
    ap.add_argument("--bake-margin", type=float, default=0.001, help="UV island margin, fraction of the atlas (0.001 = 2 px at 2048; thousands of furniture islands)")
    ap.add_argument("--floor-variants", default="", help="with --bake-light: also write <name>-<floor>.glb for "
                    "these floors (comma list), same BIN chunk")
    ap.add_argument("--preview", default=None, help="with --bake-light: a Workbench preview PNG of the atlas")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--plan-only", default=None, metavar="REPORT_JSON")
    return ap.parse_args(argv)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = parse(argv)
    if a.selftest:
        sys.exit(selftest())
    if a.plan_only:
        sys.exit(plan_only(a.plan_only))
    try:
        import bpy  # noqa: F401
    except ImportError:
        sys.exit("export_dollhouse.py: run inside Blender (-P), or use --selftest / --plan-only")
    if not a.out:
        sys.exit("export_dollhouse.py: --out is required")
    sys.exit(blender_main(a))

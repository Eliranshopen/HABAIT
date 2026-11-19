"""Step 05 ($0) - geometry.json -> an editable Blender scene (Cycles, PBR materials, daylight), saved as scene/apartment.blend.

Run:  blender -b --factory-startup --python 05_build_scene.py -- <job root>
Collections: 01_Architecture (walls, lintels, sills, floors, ceiling, glazing, doors) - 02_Fixtures (kitchen, bath) -
03_Furniture (decor, from the sheet's drawing) - 04_Exterior (balcony, light well, ground) - 05_Lights - 06_Cameras.
Deterministic: no random numbers except a fixed seed. Frame: x east, y north, z up, metres; floor at z 0.
"""
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

root = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
G = json.loads((root / "geometry" / "geometry.json").read_text(encoding="utf-8"))
A = root / "assets" / "polyhaven"
H = G["meta"]["ceiling_m"]

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene


def coll(name):
    c = bpy.data.collections.new(name)
    scn.collection.children.link(c)
    return c


C_ARCH, C_FIX, C_FURN, C_EXT, C_LIGHT, C_CAM = [coll(n) for n in (
    "01_Architecture", "02_Fixtures", "03_Furniture", "04_Exterior", "05_Lights", "06_Cameras")]


# ------------------------------------------------------------------------------------------------ materials
def img(path, non_color=False):
    im = bpy.data.images.load(str(path), check_existing=True)
    if non_color:
        im.colorspace_settings.name = "Non-Color"
    return im


def pbr(name, tex, scale=1.0, tint=None, rough_mul=1.0, bump=0.4, base=None, spec=0.5, proj="BOX", color=None, var=0.35):
    """image PBR set from assets/polyhaven/textures/<tex>/<tex>_{Diffuse,Rough,nor_gl}.jpg, box-projected in object space."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Specular IOR Level"].default_value = spec
    tc = nodes.new("ShaderNodeTexCoord")
    mp = nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    links.new(tc.outputs["Object"], mp.inputs["Vector"])
    d = A / "textures" / tex

    def tnode(f, nc):
        t = nodes.new("ShaderNodeTexImage")
        t.image = img(d / f, nc)
        t.projection = proj
        t.projection_blend = 0.15
        links.new(mp.outputs["Vector"], t.inputs["Vector"])
        return t
    diff = d / f"{tex}_Diffuse.jpg"
    if diff.exists():
        td = tnode(diff.name, False)
        if color:
            # the texture's own colour is dropped: its light/dark pattern only, times the chosen colour
            bw = nodes.new("ShaderNodeRGBToBW")
            links.new(td.outputs["Color"], bw.inputs["Color"])
            ma = nodes.new("ShaderNodeMath")
            ma.operation = "MULTIPLY_ADD"
            ma.inputs[1].default_value = var
            ma.inputs[2].default_value = 1.0 - var * 0.5
            links.new(bw.outputs["Val"], ma.inputs[0])
            mix = nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs[6].default_value = (*color, 1)
            links.new(ma.outputs[0], mix.inputs[7])
            links.new(mix.outputs[2], bsdf.inputs["Base Color"])
        elif tint:
            mix = nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            links.new(td.outputs["Color"], mix.inputs[6])
            mix.inputs[7].default_value = (*tint, 1)
            links.new(mix.outputs[2], bsdf.inputs["Base Color"])
        else:
            links.new(td.outputs["Color"], bsdf.inputs["Base Color"])
    elif base:
        bsdf.inputs["Base Color"].default_value = (*base, 1)
    if (d / f"{tex}_Rough.jpg").exists():
        tr = tnode(f"{tex}_Rough.jpg", True)
        mr = nodes.new("ShaderNodeMath")
        mr.operation = "MULTIPLY"
        mr.inputs[1].default_value = rough_mul
        links.new(tr.outputs["Color"], mr.inputs[0])
        links.new(mr.outputs[0], bsdf.inputs["Roughness"])
    if (d / f"{tex}_nor_gl.jpg").exists() and bump > 0:
        tn = tnode(f"{tex}_nor_gl.jpg", True)
        nm = nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = bump
        links.new(tn.outputs["Color"], nm.inputs["Color"])
        links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def flat(name, rgb, rough=0.5, metal=0.0, trans=0.0, ior=1.45, emit=None, emit_w=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["IOR"].default_value = ior
    b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_w
    return m


def tiles(name, tex, size, grout_rgb=(0.62, 0.61, 0.58), tint=None, rough=0.35):
    """floor tiles size x size m: the stone image per tile + 2 mm grout lines (procedural brick texture, world space)."""
    m = pbr(name, tex, scale=1.0 / 1.6, tint=tint, rough_mul=0.6, bump=0.15, proj="FLAT")
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes["Principled BSDF"]
    tc = nodes.new("ShaderNodeTexCoord")
    br = nodes.new("ShaderNodeTexBrick")
    br.offset = 0.0
    br.squash = 1.0
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.0035
    br.inputs["Mortar Smooth"].default_value = 0.2
    br.inputs["Brick Width"].default_value = size
    br.inputs["Row Height"].default_value = size
    br.inputs["Color1"].default_value = (1, 1, 1, 1)
    br.inputs["Color2"].default_value = (0.97, 0.97, 0.97, 1)
    br.inputs["Mortar"].default_value = (0, 0, 0, 1)
    links.new(tc.outputs["Object"], br.inputs["Vector"])
    src = bsdf.inputs["Base Color"].links[0].from_socket
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    links.new(br.outputs["Fac"], mix.inputs["Factor"])
    mix.inputs[6].default_value = (*grout_rgb, 1)
    links.new(src, mix.inputs[7])
    links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    return m


M = {
    "wall": pbr("wall_paint_warmwhite", "white_plaster_02", scale=0.6, color=(0.86, 0.85, 0.82), var=0.08, rough_mul=1.0, bump=0.03),
    "ceiling": flat("ceiling_white", (0.88, 0.88, 0.86), rough=0.9),
    "tile80": tiles("floor_porcelain_80", "marble_01", 0.80, tint=(0.93, 0.92, 0.89)),
    "bathtile": tiles("floor_porcelain_60", "marble_01", 0.60, tint=(0.78, 0.77, 0.75)),
    "parquet": pbr("floor_parquet_look", "laminate_floor_02", scale=0.55, color=(0.60, 0.50, 0.40), var=0.6, rough_mul=0.8, bump=0.25, proj="FLAT"),
    "bathwall": pbr("bath_wall_tile", "long_white_tiles", scale=0.5, rough_mul=0.5, bump=0.3),
    "deck": pbr("balcony_deck", "wood_floor_deck", scale=0.45, rough_mul=1.0, bump=0.4, proj="FLAT"),
    "glass": flat("glass_clear", (1, 1, 1), rough=0.0, trans=1.0, ior=1.45),
    "alu": flat("aluminium_dark_grey", (0.08, 0.085, 0.09), rough=0.35, metal=0.8),
    "door": flat("door_lacquer_white", (0.82, 0.81, 0.78), rough=0.35),
    "steel_door": flat("mamad_door_steel_paint", (0.70, 0.70, 0.68), rough=0.4, metal=0.2),
    "entrance": pbr("entrance_door_wood", "fine_grained_wood", scale=0.8, tint=(0.55, 0.45, 0.36), rough_mul=0.7, bump=0.2),
    "handle": flat("handle_brushed_steel", (0.7, 0.7, 0.7), rough=0.25, metal=1.0),
    "quartz": pbr("worktop_kaiser_stone", "marble_01", scale=0.7, tint=(0.97, 0.96, 0.94), rough_mul=0.25, bump=0.05),
    "front": flat("cabinet_front_matte_greige", (0.62, 0.59, 0.54), rough=0.45),
    "oak": pbr("oak_veneer", "oak_veneer_01", scale=1.0, rough_mul=0.8, bump=0.2),
    "black_glass": flat("hob_black_glass", (0.01, 0.01, 0.01), rough=0.05, coat=1.0),
    "steel": flat("stainless_steel", (0.6, 0.6, 0.6), rough=0.3, metal=1.0),
    "sink": flat("granite_sink_black", (0.03, 0.03, 0.03), rough=0.5),
    "ceramic": flat("sanitary_ceramic", (0.92, 0.92, 0.9), rough=0.08, coat=0.5),
    "sofa": pbr("sofa_linen_stone_grey", "rough_linen", scale=2.0, color=(0.50, 0.49, 0.46), rough_mul=1.0, bump=0.3),
    "boucle": pbr("cushion_boucle_ivory", "wool_boucle", scale=2.5, color=(0.80, 0.77, 0.70), bump=0.5),
    "rug": pbr("rug_wool_sand", "wool_boucle", scale=1.5, color=(0.66, 0.62, 0.55), var=0.25, bump=0.6),
    "linen_white": pbr("bed_linen_white", "cotton_jersey", scale=2.0, color=(0.85, 0.85, 0.83), var=0.15, bump=0.3),
    "linen_grey": pbr("bed_throw_grey", "rough_linen", scale=2.0, color=(0.38, 0.38, 0.37), bump=0.3),
    "chair_fabric": pbr("chair_fabric_taupe", "velour_velvet", scale=2.0, color=(0.42, 0.39, 0.35), var=0.2, bump=0.2),
    "blackmetal": flat("black_metal", (0.02, 0.02, 0.02), rough=0.4, metal=0.9),
    "parapet": pbr("parapet_plaster", "white_plaster_02", scale=0.6, color=(0.80, 0.79, 0.76), var=0.15, bump=0.1),
    "screen": flat("tv_screen", (0.005, 0.005, 0.005), rough=0.05, coat=1.0),
    "louvre": flat("louvre_white", (0.85, 0.85, 0.83), rough=0.5),
}


# ------------------------------------------------------------------------------------------------ mesh helpers
def link(o, c):
    for cc in o.users_collection:
        cc.objects.unlink(o)
    c.objects.link(o)
    return o


def box(name, x0, y0, z0, x1, y1, z1, mat, c, bevel=0.0):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    o.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    o.data.materials.append(mat)
    c.objects.link(o)
    if bevel > 0:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
        o.select_set(False)
    return o


def cyl(name, x, y, z0, z1, r, mat, c, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=z1 - z0, location=(x, y, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return link(o, c)


def prism(name, rings, z0, z1, mat, c):
    """extrude polygon(s) with holes (first ring = outer) via a filled curve -> mesh"""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = (z1 - z0) / 2
    for ring in rings:
        sp = cu.splines.new("POLY")
        sp.points.add(len(ring) - 1)
        for i, (x, y) in enumerate(ring):
            sp.points[i].co = (x, y, 0, 1)
        sp.use_cyclic_u = True
    o = bpy.data.objects.new(name, cu)
    o.location.z = (z0 + z1) / 2
    c.objects.link(o)
    bpy.context.view_layer.objects.active = o
    for ob in bpy.context.selected_objects:
        ob.select_set(False)
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    o.data.materials.clear()
    o.data.materials.append(mat)
    o.select_set(False)
    return o


def flat_poly(name, pts, z, mat, c):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x, y, z) for x, y in pts], [], [list(range(len(pts)))])
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(mat)
    c.objects.link(o)
    return o


def import_gltf(mid, target_xy, x, y, z=0.0, yaw_deg=0.0, c=None, fit="max"):
    """import a Poly Haven glTF, group under an empty, scale so its footprint fits target_xy (m), place on the floor."""
    f = A / "models" / mid / f"{mid}.gltf"
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(f))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mxv = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    size = mxv - mn
    if target_xy:
        k = min(target_xy[0] / max(size.x, 1e-6), target_xy[1] / max(size.y, 1e-6)) if fit == "max" else target_xy[0] / max(size.z, 1e-6)
    else:
        k = 1.0
    e = bpy.data.objects.new(f"{mid}_grp", None)
    (c or C_FURN).objects.link(e)
    centre = Vector(((mn.x + mxv.x) / 2, (mn.y + mxv.y) / 2, mn.z))
    for o in new:
        if o.parent is None:
            o.parent = e
            o.location -= centre
    e.scale = (k, k, k)
    e.rotation_euler.z = math.radians(yaw_deg)
    e.location = (x, y, z)
    for o in new:
        link(o, c or C_FURN)
    return e


# ------------------------------------------------------------------------------------------------ architecture
for i, w in enumerate(G["walls"]):
    prism(f"wall_{i:02d}", [w["exterior"], *w["holes"]], 0.0, H, M["wall"], C_ARCH)

FRAME = 0.06
for o in G["openings"]:
    x0, y0, x1, y1 = o["r"]
    ax = o["axis"]
    if o["sill"] > 0:
        box(f"{o['id']}_sill", x0, y0, 0, x1, y1, o["sill"], M["wall"], C_ARCH)
    box(f"{o['id']}_lintel", x0, y0, o["head"], x1, y1, H, M["wall"], C_ARCH)
    if o["kind"] in ("window", "sliding_door"):
        # aluminium frame + glass sashes on the wall's centre line (rail 5 cm)
        if ax == "x":
            yc = (y0 + y1) / 2
            L, s0 = x1 - x0, x0
            mk = lambda n, a, b, z0, z1, d, mat: box(n, s0 + a, yc - d, z0, s0 + b, yc + d, z1, mat, C_ARCH)
        else:
            xc = (x0 + x1) / 2
            L, s0 = y1 - y0, y0
            mk = lambda n, a, b, z0, z1, d, mat: box(n, xc - d, s0 + a, z0, xc + d, s0 + b, z1, mat, C_ARCH)
        zb, zt = o["sill"], o["head"]
        mk(f"{o['id']}_fr_b", 0, L, zb, zb + FRAME, 0.035, M["alu"])
        mk(f"{o['id']}_fr_t", 0, L, zt - FRAME, zt, 0.035, M["alu"])
        mk(f"{o['id']}_fr_l", 0, FRAME, zb, zt, 0.035, M["alu"])
        mk(f"{o['id']}_fr_r", L - FRAME, L, zb, zt, 0.035, M["alu"])
        n = o.get("sashes", 1)
        for k in range(1, n):
            a = k * L / n
            mk(f"{o['id']}_mull{k}", a - 0.025, a + 0.025, zb, zt, 0.03, M["alu"])
        mk(f"{o['id']}_glass", FRAME, L - FRAME, zb + FRAME, zt - FRAME, 0.004, M["glass"])
        if o["kind"] == "window" and o["sill"] > 0:   # inner stone sill board
            if ax == "x":
                box(f"{o['id']}_board", x0, y0 - 0.02, o["sill"] - 0.02, x1, y1 + 0.02, o["sill"], M["quartz"], C_ARCH)
            else:
                box(f"{o['id']}_board", x0 - 0.02, y0, o["sill"] - 0.02, x1 + 0.02, y1, o["sill"], M["quartz"], C_ARCH)
    else:
        # door: leaf at the swing-side face, rotated about the hinge by open_deg
        wdt = o["width_m"]
        th = 0.045 if o["kind"] in ("entrance_door", "mamad_door") else 0.04
        mat = {"entrance_door": M["entrance"], "mamad_door": M["steel_door"]}.get(o["kind"], M["door"])
        if ax == "x":
            hx = x0 if o["hinge"] == "W" else x1
            hy = y1 if o["swing"] == "N" else y0
            d0 = Vector((1 if o["hinge"] == "W" else -1, 0))
            s = Vector((0, 1 if o["swing"] == "N" else -1))
        else:
            hy = y0 if o["hinge"] == "S" else y1
            hx = x1 if o["swing"] == "E" else x0
            d0 = Vector((0, 1 if o["hinge"] == "S" else -1))
            s = Vector((1 if o["swing"] == "E" else -1, 0))
        cross = d0.x * s.y - d0.y * s.x
        ang = math.atan2(d0.y, d0.x) + math.copysign(math.radians(o["open_deg"]), cross)
        leaf = box(f"{o['id']}_leaf", 0, -th / 2 - 0.0, 0.01, wdt - 0.01, th / 2, o["head"] - 0.01, mat, C_ARCH)
        piv = bpy.data.objects.new(f"{o['id']}_hinge", None)
        C_ARCH.objects.link(piv)
        piv.location = (hx + s.x * th / 2, hy + s.y * th / 2, 0)
        piv.rotation_euler.z = ang
        leaf.parent = piv
        hd = box(f"{o['id']}_handle", wdt - 0.12, -th / 2 - 0.06, 1.0, wdt - 0.06, th / 2 + 0.06, 1.03, M["handle"], C_ARCH)
        hd.parent = piv
        # frame (casing) around the door gap, both faces
        if ax == "x":
            box(f"{o['id']}_case_t", x0, y0 - 0.012, o["head"], x1, y1 + 0.012, o["head"] + 0.06, M["door"], C_ARCH)
        else:
            box(f"{o['id']}_case_t", x0 - 0.012, y0, o["head"], x1 + 0.012, y1, o["head"] + 0.06, M["door"], C_ARCH)

# floors (one slab under everything + finish overlays 2 mm up), ceiling
fp = G["footprint"]
flat_poly("floor_base", fp, 0.0, M["tile80"], C_ARCH)
for r in G["rooms"]:
    if r["floor"] in ("parquet", "bathtile"):
        for k, a in enumerate(r["rects"]):
            box(f"floor_{r['id']}_{k}", a[0], a[1], 0.0, a[2], a[3], 0.003, M[r["floor"]], C_ARCH)
ceil = flat_poly("ceiling", list(reversed(fp)), H, M["ceiling"], C_ARCH)
box("slab_above", min(p[0] for p in fp) - 0.3, min(p[1] for p in fp) - 0.3, H + 0.001, max(p[0] for p in fp) + 0.3,
    max(p[1] for p in fp) + 0.3, H + 0.25, M["parapet"], C_ARCH)

# wet-room wall tiles: 6 mm cladding on each room rect side, cut where an opening meets it
for r in G["rooms"]:
    if r["floor"] != "bathtile":
        continue
    a = r["rects"][0]
    sides = [("S", a[0], a[1], a[2], a[1] + 0.006), ("N", a[0], a[3] - 0.006, a[2], a[3]),
             ("W", a[0], a[1], a[0] + 0.006, a[3]), ("E", a[2] - 0.006, a[1], a[2], a[3])]
    for sid, bx0, by0, bx1, by1 in sides:
        segs = [(bx0, by0, bx1, by1)]
        for o in G["openings"]:
            ox0, oy0, ox1, oy1 = o["r"]
            hit = not (ox1 < bx0 - 0.01 or ox0 > bx1 + 0.01 or oy1 < by0 - 0.01 or oy0 > by1 + 0.01)
            if not hit:
                continue
            nxt = []
            for s0 in segs:
                if sid in ("S", "N"):
                    if ox0 > s0[0]:
                        nxt.append((s0[0], s0[1], min(ox0, s0[2]), s0[3]))
                    if ox1 < s0[2]:
                        nxt.append((max(ox1, s0[0]), s0[1], s0[2], s0[3]))
                else:
                    if oy0 > s0[1]:
                        nxt.append((s0[0], s0[1], s0[2], min(oy0, s0[3])))
                    if oy1 < s0[3]:
                        nxt.append((s0[0], max(oy1, s0[1]), s0[2], s0[3]))
            segs = nxt
        for k, s0 in enumerate(segs):
            if (s0[2] - s0[0]) > 0.01 and (s0[3] - s0[1]) > 0.005:
                box(f"tiles_{r['id']}_{sid}{k}", *s0[:2], 0.003, *s0[2:], H - 0.002, M["bathwall"], C_ARCH)

# ------------------------------------------------------------------------------------------------ exterior
bal = G["balcony"]
flat_poly("balcony_deck", bal["deck"], 0.0, M["deck"], C_EXT)
po, pi = bal["parapet_outer"], bal["parapet_inner"]
for k in range(len(pi) - 1):
    # parapet = low wall 0.45 m between the inner and outer lines + dark bar railing to 1.05 m
    ring = [pi[k], pi[k + 1], po[k + 1], po[k]]
    prism(f"parapet_{k}", [ring], -0.25, 0.45, M["parapet"], C_EXT)
    a, b = Vector((*pi[k], 0)), Vector((*pi[k + 1], 0))
    ao, bo = Vector((*po[k], 0)), Vector((*po[k + 1], 0))
    ma, mb = (a + ao) / 2, (b + bo) / 2
    L = (mb - ma).length
    n = max(2, int(L / 0.11))
    for j in range(n + 1):
        p = ma.lerp(mb, j / n)
        box(f"rail_{k}_{j}", p.x - 0.008, p.y - 0.008, 0.45, p.x + 0.008, p.y + 0.008, 1.05, M["blackmetal"], C_EXT)
    d = (mb - ma).normalized()
    nrm = Vector((-d.y, d.x, 0)) * 0.02
    for z0 in (1.03,):
        me = bpy.data.meshes.new(f"handrail_{k}")
        v = [ma - nrm, mb - nrm, mb + nrm, ma + nrm]
        me.from_pydata([(q.x, q.y, z0) for q in v] + [(q.x, q.y, z0 + 0.03) for q in v], [],
                       [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]])
        ob = bpy.data.objects.new(f"handrail_{k}", me)
        ob.data.materials.append(M["blackmetal"])
        C_EXT.objects.link(ob)
lw = G["lightwell"]["r"]
box("lightwell_floor", lw[0], lw[1], -0.02, lw[2], lw[3], 0.0, M["parapet"], C_EXT)
la = G["laundry"]["r"]
box("laundry_floor", la[0], la[1], -0.02, la[2], la[3], 0.0, M["parapet"], C_EXT)
for j in range(9):
    x = la[0] + 0.03 + j * (la[2] - la[0] - 0.06) / 8
    box(f"louvre_{j}", x - 0.01, la[1], 0.0, x + 0.01, la[3], H, M["louvre"], C_EXT)
nl = G["north_ledge"]["r"]
box("north_ledge", nl[0], nl[1], -0.25, nl[2], nl[3], 0.35, M["parapet"], C_EXT)
# ground far below: first floor above the entrance floor (ASSUMED 3.2 m)
gm = pbr("ground_grass", "leafy_grass", scale=0.3, bump=0.5, proj="FLAT")
box("ground", -40, -40, -3.25, 60, 60, -3.2, gm, C_EXT)
for k, (gx, gy) in enumerate([(-6, 4), (-7, 9), (14, 12), (16, 2), (5, 15), (-4, -6), (12, -5)]):
    import_gltf("tree_small_02" if k % 2 else "island_tree_02", None, gx, gy, -3.2, yaw_deg=40 * k, c=C_EXT)

# ------------------------------------------------------------------------------------------------ fixtures
F = {f["id"]: f for f in G["fixtures"]}


def r_of(fid):
    return F[fid]["r"]


TOP, CNT = 0.03, 0.87   # worktop thickness; base cabinet height under the top
for fid in ("k-counter-N", "k-counter-W", "k-counter-S"):
    x0, y0, x1, y1 = r_of(fid)
    box(f"{fid}_plinth", x0 + 0.05, y0 + 0.05, 0, x1 - 0.05, y1 - 0.05, 0.10, M["blackmetal"], C_FIX)
    box(f"{fid}_carcass", x0, y0, 0.10, x1, y1, CNT, M["front"], C_FIX)
    box(f"{fid}_top", x0 - 0.005, y0 - 0.005, CNT, x1 + 0.005, y1 + 0.005, CNT + TOP, M["quartz"], C_FIX, bevel=0.003)
# front gaps: thin dark grooves every 60 cm on the room-facing faces
for fid, face in (("k-counter-N", "S"), ("k-counter-W", "E"), ("k-counter-S", "N")):
    x0, y0, x1, y1 = r_of(fid)
    if face in ("S", "N"):
        yy = y0 if face == "S" else y1
        n = max(1, round((x1 - x0) / 0.6))
        for j in range(1, n):
            x = x0 + j * (x1 - x0) / n
            box(f"{fid}_gap{j}", x - 0.002, yy - 0.002, 0.11, x + 0.002, yy + 0.002, CNT - 0.01, M["blackmetal"], C_FIX)
        box(f"{fid}_drawer", x0, yy - 0.002, CNT - 0.17, x1, yy + 0.002, CNT - 0.166, M["blackmetal"], C_FIX)
    else:
        xx = x1
        n = max(1, round((y1 - y0) / 0.6))
        for j in range(1, n):
            y = y0 + j * (y1 - y0) / n
            box(f"{fid}_gap{j}", xx - 0.002, y - 0.002, 0.11, xx + 0.002, y + 0.002, CNT - 0.01, M["blackmetal"], C_FIX)
        box(f"{fid}_drawer", xx - 0.002, y0, CNT - 0.17, xx + 0.002, y1, CNT - 0.166, M["blackmetal"], C_FIX)
x0, y0, x1, y1 = r_of("k-hob")
box("hob", x0 + 0.02, y0 + 0.02, CNT + TOP, x1 - 0.02, y1 - 0.02, CNT + TOP + 0.006, M["black_glass"], C_FIX)
for j, (u, v) in enumerate(((0.3, 0.3), (0.7, 0.3), (0.3, 0.7), (0.7, 0.7))):
    cyl(f"hob_burner{j}", x0 + u * (x1 - x0), y0 + v * (y1 - y0), CNT + TOP + 0.006, CNT + TOP + 0.02, 0.04, M["blackmetal"], C_FIX, 24)
box("hood", x0 + 0.05, y0 + 0.02, 1.55, x1 - 0.05, y0 + 0.45, 1.70, M["steel"], C_FIX)
for fid in ("k-sink-1", "k-sink-2"):
    x0, y0, x1, y1 = r_of(fid)
    box(f"{fid}_bowl", x0 + 0.01, y0 + 0.01, CNT + TOP - 0.004, x1 - 0.01, y1 - 0.01, CNT + TOP + 0.001, M["sink"], C_FIX)
    cyl(f"{fid}_tap", x0 + 0.03, (y0 + y1) / 2, CNT + TOP, CNT + TOP + 0.32, 0.014, M["blackmetal"], C_FIX, 16)
    box(f"{fid}_spout", x0 + 0.03, (y0 + y1) / 2 - 0.012, CNT + TOP + 0.30, x0 + 0.20, (y0 + y1) / 2 + 0.012, CNT + TOP + 0.325, M["blackmetal"], C_FIX)
x0, y0, x1, y1 = r_of("k-fridge")
box("fridge", x0 + 0.02, y0 + 0.02, 0, x1 - 0.02, y1 - 0.01, 2.0, M["steel"], C_FIX, bevel=0.01)
box("fridge_split", x0 + 0.02, y1 - 0.012, 0.02, (x0 + x1) / 2 + 0.002, y1 - 0.008, 1.99, M["blackmetal"], C_FIX)
box("fridge_tall_unit", x0, y0, 2.0, x1, y1, H - 0.02, M["front"], C_FIX)
x0, y0, x1, y1 = r_of("k-uppers-W")
box("uppers_W", x0, y0, 1.50, x1 + 0.02, y1, 2.25, M["front"], C_FIX)
box("uppers_W_under", x0, y0, 1.495, x1 + 0.02, y1, 1.50, M["blackmetal"], C_FIX)

# bathrooms


def wc(fid, front, c=C_FIX):
    x0, y0, x1, y1 = r_of(fid)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    d = {"S": (0, -1), "N": (0, 1), "E": (1, 0), "W": (-1, 0)}[front]
    back = (cx - d[0] * ((x1 - x0) / 2 - 0.02), cy - d[1] * ((y1 - y0) / 2 - 0.02))
    # wall-hung pan + concealed cistern panel (spec: hung toilets, concealed cisterns)
    if d[0] == 0:
        box(f"{fid}_panel", x0, back[1] - 0.06 if d[1] > 0 else back[1] - 0.06, 0, x1, back[1] + 0.06, 1.15, M["bathwall"], c)
        box(f"{fid}_pan", cx - 0.18, min(back[1], back[1] + d[1] * 0.55), 0.20, cx + 0.18, max(back[1], back[1] + d[1] * 0.55), 0.40, M["ceramic"], c, bevel=0.06)
        box(f"{fid}_seat", cx - 0.18, min(back[1], back[1] + d[1] * 0.55), 0.40, cx + 0.18, max(back[1], back[1] + d[1] * 0.55), 0.42, M["ceramic"], c, bevel=0.01)
        box(f"{fid}_button", cx - 0.1, back[1] + d[1] * 0.06 - 0.004, 0.98, cx + 0.1, back[1] + d[1] * 0.06 + 0.004, 1.08, M["handle"], c)
    else:
        box(f"{fid}_panel", back[0] - 0.06, y0, 0, back[0] + 0.06, y1, 1.15, M["bathwall"], c)
        box(f"{fid}_pan", min(back[0], back[0] + d[0] * 0.55), cy - 0.18, 0.20, max(back[0], back[0] + d[0] * 0.55), cy + 0.18, 0.40, M["ceramic"], c, bevel=0.06)
        box(f"{fid}_seat", min(back[0], back[0] + d[0] * 0.55), cy - 0.18, 0.40, max(back[0], back[0] + d[0] * 0.55), cy + 0.18, 0.42, M["ceramic"], c, bevel=0.01)


wc("pb-wc", "S")
wc("b-wc", "S")
wc("wc-wc", "W")
x0, y0, x1, y1 = r_of("pb-shower")
box("shower_tray", x0, y0, 0, x1, y1, 0.04, M["ceramic"], C_FIX)
box("shower_glass", x1 - 0.005, y0, 0.04, x1 + 0.005, y1, 2.0, M["glass"], C_FIX)
box("shower_glass_profile", x1 - 0.01, y0, 2.0, x1 + 0.01, y1, 2.02, M["blackmetal"], C_FIX)
cyl("shower_head", x0 + 0.2, y0 + 0.2, 2.05, 2.06, 0.12, M["blackmetal"], C_FIX)
for fid, front in (("pb-vanity", "E"), ("b-vanity", "N")):
    x0, y0, x1, y1 = r_of(fid)
    box(f"{fid}_cab", x0, y0, 0.30, x1, y1, 0.80, M["oak"], C_FIX)
    box(f"{fid}_top", x0, y0, 0.80, x1, y1, 0.86, M["ceramic"], C_FIX, bevel=0.01)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    box(f"{fid}_basin", cx - 0.2 if front == "N" else cx - 0.15, cy - 0.15 if front == "N" else cy - 0.2, 0.855,
        cx + 0.2 if front == "N" else cx + 0.15, cy + 0.15 if front == "N" else cy + 0.2, 0.862, M["sink"], C_FIX)
    if front == "N":
        box(f"{fid}_mirror", x0 + 0.05, y0 + 0.005, 1.05, x1 - 0.05, y0 + 0.015, 1.85, flat("mirror", (0.9, 0.9, 0.9), 0.02, 1.0), C_FIX)
    else:
        box(f"{fid}_mirror", x0 + 0.005, y0 + 0.02, 1.05, x0 + 0.015, y1 - 0.02, 1.85, bpy.data.materials["mirror"] if "mirror" in bpy.data.materials else flat("mirror", (0.9, 0.9, 0.9), 0.02, 1.0), C_FIX)
x0, y0, x1, y1 = r_of("b-tub")
box("tub_body", x0, y0, 0, x1, y1, 0.55, M["bathwall"], C_FIX)
box("tub_rim", x0, y0, 0.55, x1, y1, 0.58, M["ceramic"], C_FIX, bevel=0.01)
box("tub_inside", x0 + 0.08, y0 + 0.08, 0.15, x1 - 0.08, y1 - 0.08, 0.581, M["ceramic"], C_FIX, bevel=0.08)
box("tub_screen", x0 + 0.05, y0 - 0.005, 0.58, x0 + 0.85, y0 + 0.005, 2.0, M["glass"], C_FIX)
x0, y0, x1, y1 = r_of("b-washer")
box("washer", x0 + 0.02, y0, 0, x1 - 0.02, y1, 0.85, flat("appliance_white", (0.9, 0.9, 0.9), 0.3), C_FIX, bevel=0.01)
cyl("washer_door", (x0 + x1) / 2, y0 - 0.005, 0.30, 0.31, 0.16, M["blackmetal"], C_FIX)
bpy.context.active_object.rotation_euler.x = math.radians(90)
bpy.context.active_object.location = ((x0 + x1) / 2, y0 - 0.005, 0.45)
x0, y0, x1, y1 = r_of("lobby-basin")
box("guest_basin", x0, y0, 0.80, x1, y1, 0.86, M["ceramic"], C_FIX, bevel=0.01)
box("guest_basin_mirror", x1 - 0.015, y0, 1.0, x1 - 0.005, y1, 1.7, bpy.data.materials["mirror"], C_FIX)
x0, y0, x1, y1 = r_of("el-board")
box("electric_board_door", x0, y0 - 0.002, 1.3, x1, y1 + 0.002, 2.0, M["wall"], C_FIX)
x0, y0, x1, y1 = r_of("dining-ledge")
box("dining_sideboard", x0, y0, 0.0, x1, y1, 0.45, M["oak"], C_FIX)
box("dining_sideboard_top", x0, y0, 0.45, x1, y1, 0.47, M["oak"], C_FIX)

# ------------------------------------------------------------------------------------------------ furniture (decor layer)
for f in G["furniture"]:
    k = f["kind"]
    if "r" in f:
        x0, y0, x1, y1 = f["r"]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    else:
        cx, cy = f["c"]
    if k == "sofa":
        fr = f["front"]
        box(f"{f['id']}_base", x0 + 0.02, y0 + 0.02, 0.08, x1 - 0.02, y1 - 0.02, 0.42, M["sofa"], C_FURN, bevel=0.02)
        if fr in ("S", "N"):
            by = (y1 - 0.2, y1) if fr == "S" else (y0, y0 + 0.2)
            box(f"{f['id']}_back", x0 + 0.02, by[0], 0.42, x1 - 0.02, by[1], 0.80, M["sofa"], C_FURN, bevel=0.04)
            for s, xa in (("l", x0), ("r", x1 - 0.18)):
                box(f"{f['id']}_arm{s}", xa + 0.01, y0 + 0.02, 0.42, xa + 0.17, y1 - 0.02, 0.62, M["sofa"], C_FURN, bevel=0.04)
            n = 2
            for j in range(n):
                a = x0 + 0.18 + j * (x1 - x0 - 0.36) / n
                b = a + (x1 - x0 - 0.36) / n
                yy = (y0 + 0.02, y1 - 0.2) if fr == "S" else (y0 + 0.2, y1 - 0.02)
                box(f"{f['id']}_seat{j}", a + 0.005, yy[0], 0.42, b - 0.005, yy[1], 0.50, M["sofa"], C_FURN, bevel=0.035)
        else:
            bx = (x1 - 0.2, x1) if fr == "W" else (x0, x0 + 0.2)
            box(f"{f['id']}_back", bx[0], y0 + 0.02, 0.42, bx[1], y1 - 0.02, 0.80, M["sofa"], C_FURN, bevel=0.04)
            for s, ya in (("b", y0), ("t", y1 - 0.18)):
                box(f"{f['id']}_arm{s}", x0 + 0.02, ya + 0.01, 0.42, x1 - 0.02, ya + 0.17, 0.62, M["sofa"], C_FURN, bevel=0.04)
            n = 2
            for j in range(n):
                a = y0 + 0.18 + j * (y1 - y0 - 0.36) / n
                b = a + (y1 - y0 - 0.36) / n
                xx = (x0 + 0.02, x1 - 0.2) if fr == "W" else (x0 + 0.2, x1 - 0.02)
                box(f"{f['id']}_seat{j}", xx[0], a + 0.005, 0.42, xx[1], b - 0.005, 0.50, M["sofa"], C_FURN, bevel=0.035)
        for j, (u, v) in enumerate(((0.25, 0.5), (0.7, 0.5))):
            px = x0 + u * (x1 - x0) if fr in ("S", "N") else (x1 - 0.28 if fr == "W" else x0 + 0.28)
            py = (y1 - 0.28 if fr == "S" else y0 + 0.28) if fr in ("S", "N") else y0 + u * (y1 - y0)
            box(f"{f['id']}_cushion{j}", px - 0.2, py - 0.07, 0.50, px + 0.2, py + 0.07, 0.88, M["boucle"], C_FURN, bevel=0.06).rotation_euler.z = 0 if fr in ("S", "N") else math.radians(90)
    elif k == "rug":
        box(f["id"], x0, y0, 0.003, x1, y1, 0.015, M["rug"], C_FURN, bevel=0.004)
    elif k == "round_table":
        cyl(f"{f['id']}_top", cx, cy, 0.36, 0.40, f["radius"], M["oak"], C_FURN)
        cyl(f"{f['id']}_base", cx, cy, 0.015, 0.36, f["radius"] * 0.55, M["oak"], C_FURN)
    elif k == "dining_table":
        box(f"{f['id']}_top", x0, y0, 0.72, x1, y1, 0.76, M["oak"], C_FURN, bevel=0.004)
        for u, v in ((0.08, 0.15), (0.92, 0.15), (0.08, 0.85), (0.92, 0.85)):
            box(f"{f['id']}_leg", x0 + u * (x1 - x0) - 0.025, y0 + v * (y1 - y0) - 0.025, 0, x0 + u * (x1 - x0) + 0.025, y0 + v * (y1 - y0) + 0.025, 0.72, M["blackmetal"], C_FURN)
    elif k == "dining_chair":
        d = 1 if f["front"] == "S" else -1   # chair at the north side faces south
        box(f"{f['id']}_seat", cx - 0.22, cy - 0.22, 0.44, cx + 0.22, cy + 0.22, 0.50, M["chair_fabric"], C_FURN, bevel=0.03)
        box(f"{f['id']}_back", cx - 0.22, cy + d * 0.18, 0.50, cx + 0.22, cy + d * 0.23, 0.90, M["chair_fabric"], C_FURN, bevel=0.025)
        for u, v in ((-0.18, -0.18), (0.18, -0.18), (-0.18, 0.18), (0.18, 0.18)):
            cyl(f"{f['id']}_leg", cx + u, cy + v, 0, 0.44, 0.012, M["blackmetal"], C_FURN, 12)
    elif k == "wardrobe":
        box(f"{f['id']}", x0, y0, 0, x1, y1, 2.40, M["oak"], C_FURN)
        box(f"{f['id']}_cornice", x0, y0, 2.40, x1, y1, H, M["wall"], C_FURN)
        fr = f["front"]
        if fr in ("E", "W"):
            xx = x1 if fr == "E" else x0
            n = max(2, round((y1 - y0) / 0.5))
            for j in range(1, n):
                y = y0 + j * (y1 - y0) / n
                box(f"{f['id']}_gap{j}", xx - 0.003, y - 0.002, 0.02, xx + 0.003, y + 0.002, 2.38, M["blackmetal"], C_FURN)
        else:
            yy = y0 if fr == "S" else y1
            n = max(2, round((x1 - x0) / 0.5))
            for j in range(1, n):
                x = x0 + j * (x1 - x0) / n
                box(f"{f['id']}_gap{j}", x - 0.002, yy - 0.003, 0.02, x + 0.002, yy + 0.003, 2.38, M["blackmetal"], C_FURN)
    elif k in ("bed_double", "bed_single"):
        hd = f["head"]
        box(f"{f['id']}_frame", x0, y0, 0.05, x1, y1, 0.30, M["sofa"], C_FURN, bevel=0.01)
        box(f"{f['id']}_mattress", x0 + 0.02, y0 + 0.02, 0.30, x1 - 0.02, y1 - 0.02, 0.52, M["linen_white"], C_FURN, bevel=0.04)
        if hd in ("E", "W"):
            hx = (x1 - 0.06, x1 + 0.0) if hd == "E" else (x0, x0 + 0.06)
            box(f"{f['id']}_headboard", hx[0], y0 - 0.02, 0.05, hx[1], y1 + 0.02, 1.10 if k == "bed_double" else 0.90, M["sofa"], C_FURN, bevel=0.02)
            tx = (x0 + 0.0, x0 + (x1 - x0) * 0.42) if hd == "E" else (x1 - (x1 - x0) * 0.42, x1)
            box(f"{f['id']}_throw", tx[0], y0 + 0.0, 0.50, tx[1], y1, 0.56, M["linen_grey"], C_FURN, bevel=0.03)
            n = 2 if k == "bed_double" else 1
            for j in range(n):
                py0 = y0 + 0.08 + j * (y1 - y0 - 0.16) / n
                py1 = py0 + (y1 - y0 - 0.16) / n - 0.04
                px = (x1 - 0.48, x1 - 0.10) if hd == "E" else (x0 + 0.10, x0 + 0.48)
                box(f"{f['id']}_pillow{j}", px[0], py0, 0.52, px[1], py1, 0.66, M["linen_white"], C_FURN, bevel=0.06)
        else:
            hy = (y0, y0 + 0.06) if hd == "S" else (y1 - 0.06, y1)
            box(f"{f['id']}_headboard", x0 - 0.02, hy[0], 0.05, x1 + 0.02, hy[1], 0.90, M["sofa"], C_FURN, bevel=0.02)
            ty = (y1 - (y1 - y0) * 0.42, y1) if hd == "S" else (y0, y0 + (y1 - y0) * 0.42)
            box(f"{f['id']}_throw", x0, ty[0], 0.50, x1, ty[1], 0.56, M["linen_grey"], C_FURN, bevel=0.03)
            py = (y0 + 0.10, y0 + 0.48) if hd == "S" else (y1 - 0.48, y1 - 0.10)
            box(f"{f['id']}_pillow", x0 + 0.08, py[0], 0.52, x1 - 0.08, py[1], 0.66, M["linen_white"], C_FURN, bevel=0.06)
    elif k == "nightstand":
        box(f["id"], x0 + 0.02, y0 + 0.02, 0.0, x1 - 0.02, y1 - 0.02, 0.50, M["oak"], C_FURN, bevel=0.005)
        cyl(f"{f['id']}_lamp", cx, cy, 0.50, 0.80, 0.07, flat("lamp_shade", (0.95, 0.92, 0.85), 0.8, emit=(1.0, 0.85, 0.6), emit_w=2.0), C_FURN)
    elif k == "plant":
        import_gltf("pachira_aquatica_01" if f["room"] != "balcony" else "potted_plant_04", (0.55, 0.55) if f["room"] != "balcony" else (0.6, 0.6), cx, cy)
    elif k == "outdoor_table":
        cyl(f"{f['id']}_top", cx, cy, 0.70, 0.72, f["radius"], M["glass"], C_FURN)
        cyl(f"{f['id']}_base", cx, cy, 0.0, 0.70, 0.03, M["blackmetal"], C_FURN, 16)
    elif k == "outdoor_chair":
        e = bpy.data.objects.new(f["id"], None)
        C_FURN.objects.link(e)
        e.location = (cx, cy, 0)
        e.rotation_euler.z = math.radians(f.get("yaw_deg", 0))
        for o in (box(f"{f['id']}_seat", -0.25, -0.25, 0.40, 0.25, 0.25, 0.46, M["linen_white"], C_FURN, bevel=0.03),
                  box(f"{f['id']}_back", -0.25, 0.20, 0.46, 0.25, 0.26, 0.80, M["linen_white"], C_FURN, bevel=0.03)):
            o.parent = e
        for u, v in ((-0.22, -0.22), (0.22, -0.22), (-0.22, 0.22), (0.22, 0.22)):
            o = box(f"{f['id']}_leg", u - 0.012, v - 0.012, 0, u + 0.012, v + 0.012, 0.40, M["blackmetal"], C_FURN)
            o.parent = e

# TV + low unit on the east living wall (between the two sofa backs? no - opposite the north sofa: the sheet draws none;
# the north sofa faces south toward the dining area, so a TV is NOT added: nothing beyond the sheet).
# ceiling lights: one pendant over the dining table, flush discs elsewhere
dt = next(f for f in G["furniture"] if f["id"] == "dining-table")["r"]
lamp = import_gltf("modern_ceiling_lamp_01", (0.5, 0.5), (dt[0] + dt[2]) / 2, (dt[1] + dt[3]) / 2, 0, c=C_FURN)
bpy.context.view_layer.update()
mesh_children = [o for o in lamp.children_recursive if o.type == "MESH"]
zmin = min((o.matrix_world @ Vector(v)).z for o in mesh_children for v in o.bound_box)
zmax = max((o.matrix_world @ Vector(v)).z for o in mesh_children for v in o.bound_box)
lamp.location.z = H - (zmax - zmin) - 0.0
for k, (gx, gy, rr) in enumerate([(0.0, 0.0, 0.0)]):
    pass

# a few objects on surfaces (decor, kept minimal)
ct = next(f for f in G["furniture"] if f["id"] == "coffee")
import_gltf("ceramic_vase_01", (0.14, 0.14), ct["c"][0] + 0.12, ct["c"][1] - 0.05, 0.40)
import_gltf("wooden_bowl_01", (0.30, 0.30), (dt[0] + dt[2]) / 2, (dt[1] + dt[3]) / 2, 0.76)
import_gltf("ceramic_vase_03", (0.16, 0.16), r_of("k-counter-N")[0] + 1.2, (r_of("k-counter-N")[1] + r_of("k-counter-N")[3]) / 2, CNT + TOP)
import_gltf("potted_plant_02", (0.35, 0.35), r_of("dining-ledge")[0] + 0.3, (r_of("dining-ledge")[1] + r_of("dining-ledge")[3]) / 2, 0.47)

# ------------------------------------------------------------------------------------------------ light
w = bpy.data.worlds.new("world")
scn.world = w
w.use_nodes = True
nt = w.node_tree
bg = nt.nodes["Background"]
env = nt.nodes.new("ShaderNodeTexEnvironment")
env.image = img(A / "hdri" / "golden_gate_hills_4k.hdr")
mp = nt.nodes.new("ShaderNodeMapping")
tc = nt.nodes.new("ShaderNodeTexCoord")
mp.inputs["Rotation"].default_value = (0, 0, math.radians(110))
nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
nt.links.new(env.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 1.0
sun_d = bpy.data.lights.new("sun", "SUN")
sun_d.energy = 3.5
sun_d.angle = math.radians(0.6)
sun_d.color = (1.0, 0.96, 0.9)
sun = bpy.data.objects.new("sun", sun_d)
C_LIGHT.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(200))   # from the north-west in the afternoon (north ASSUMED = sheet up)
# window portals: guide sampling through every glazed opening (big noise cut on CPU)
for o in G["openings"]:
    if o["kind"] not in ("window", "sliding_door"):
        continue
    x0, y0, x1, y1 = o["r"]
    L = (x1 - x0) if o["axis"] == "x" else (y1 - y0)
    hgt = o["head"] - o["sill"]
    ld = bpy.data.lights.new(f"portal_{o['id']}", "AREA")
    ld.shape = "RECTANGLE"
    ld.size, ld.size_y = L, hgt
    ld.cycles.is_portal = True
    lo = bpy.data.objects.new(f"portal_{o['id']}", ld)
    C_LIGHT.objects.link(lo)
    # area light faces -Z locally; rotate so it faces into the apartment (inward = toward the room it opens)
    cxo, cyo = (x0 + x1) / 2, (y0 + y1) / 2
    lo.location = (cxo, cyo, (o["sill"] + o["head"]) / 2)
    inward = {"W-kitchen-N": "S", "SD-living-N": "S", "W-parentsbath-N": "S", "W-parents-N": "S", "W-mamad-E": "W",
              "W-bath-E": "W", "W-bath-S": "N", "W-bedB-E": "W", "W-bedA-W": "E", "W-wc-S": "N"}[o["id"]]
    rot = {"S": (math.radians(-90), 0, 0), "N": (math.radians(90), 0, 0), "E": (0, math.radians(90), 0), "W": (0, math.radians(-90), 0)}[inward]
    lo.rotation_euler = rot
    if o["axis"] == "y":
        ld.size, ld.size_y = hgt, L
# soft warm ceiling fill in every room (the house rule: rooms are lit, never dark), low so daylight leads
for r in G["rooms"]:
    a = r["rects"][0]
    ld = bpy.data.lights.new(f"fill_{r['id']}", "AREA")
    ld.shape = "RECTANGLE"
    ld.size, ld.size_y = (a[2] - a[0]) * 0.6, (a[3] - a[1]) * 0.6
    ld.energy = 25 + 6 * r["area_m2"]
    ld.color = (1.0, 0.88, 0.74)
    lo = bpy.data.objects.new(f"fill_{r['id']}", ld)
    lo.location = ((a[0] + a[2]) / 2, (a[1] + a[3]) / 2, H - 0.02)
    C_LIGHT.objects.link(lo)

# ------------------------------------------------------------------------------------------------ render settings
scn.render.engine = "CYCLES"
cy = scn.cycles
cy.device = "CPU"
cy.samples = 64
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.02
cy.use_denoising = True
cy.denoiser = "OPENIMAGEDENOISE"
cy.seed = 0
cy.max_bounces = 8
cy.diffuse_bounces = 4
cy.glossy_bounces = 3
cy.transmission_bounces = 8
cy.transparent_max_bounces = 8
cy.caustics_reflective = False
cy.caustics_refractive = False
cy.sample_clamp_indirect = 8.0
cy.blur_glossy = 1.0
scn.render.use_persistent_data = True
scn.view_settings.view_transform = "AgX"
scn.view_settings.look = "AgX - Medium High Contrast"
scn.view_settings.exposure = 0.6
scn.render.image_settings.file_format = "PNG"
scn.render.image_settings.color_depth = "8"

# ------------------------------------------------------------------------------------------------ cameras (eye level 1.60 m)
CAMS = json.loads((root / "geometry" / "cameras.json").read_text(encoding="utf-8"))
for cam in CAMS["panoramas"]:
    cd = bpy.data.cameras.new(cam["id"])
    cd.type = "PANO"
    cd.panorama_type = "EQUIRECTANGULAR"
    cd.clip_start = 0.05
    co = bpy.data.objects.new(cam["id"], cd)
    co.location = (cam["x"], cam["y"], cam["z"])
    # yaw 0 = the panorama's centre looks along +y (sheet up); camera points -Z locally
    co.rotation_euler = (math.radians(90), 0, math.radians(cam.get("yaw_deg", 0)))
    C_CAM.objects.link(co)
for cam in CAMS["stills"]:
    cd = bpy.data.cameras.new(cam["id"])
    cd.lens = cam.get("lens_mm", 18)
    cd.sensor_width = 36
    cd.clip_start = 0.05
    cd.shift_y = cam.get("shift_y", 0.0)
    co = bpy.data.objects.new(cam["id"], cd)
    co.location = (cam["x"], cam["y"], cam["z"])
    co.rotation_euler = (math.radians(90 + cam.get("pitch_deg", 0)), 0, math.radians(cam["yaw_deg"]))
    C_CAM.objects.link(co)

bpy.ops.wm.save_as_mainfile(filepath=str(root / "scene" / "apartment.blend"), compress=True)
n = {c.name: len(c.all_objects) for c in (C_ARCH, C_FIX, C_FURN, C_EXT, C_LIGHT, C_CAM)}
print("SCENE SAVED", root / "scene" / "apartment.blend", n)

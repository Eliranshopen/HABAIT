"""Helpers for the Hatzav scene: units, collections, clean meshes, UVs, materials, model import.

Frame: plan u,v in cm -> X = u/100, Y = -v/100 (m). Every mesh is built in world coordinates with an
identity transform unless a function says otherwise. No two visible faces are coplanar: unions are built
on one grid (voxel_mesh), never as overlapping boxes.
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector

ASSETS = None  # set by the build script


def V(u, v, z=0.0):
    return Vector((u / 100.0, -v / 100.0, z / 100.0))


# ------------------------------------------------------------------ collections
def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def link(obj, c):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    c.objects.link(obj)
    return obj


# ------------------------------------------------------------------ meshes
def uv_box(me, scale=1.0):
    """box projection in world metres: 1 UV unit = `scale` metres"""
    uv = me.uv_layers.active or me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 2:
                p = (co.x, co.y)
            elif ax == 0:
                p = (co.y, co.z)
            else:
                p = (co.x, co.z)
            uv.data[li].uv = (p[0] / scale, p[1] / scale)


def obj_from_bm(name, bm, c, mats=(), smooth=False, weighted=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    uv_box(me)
    ob = bpy.data.objects.new(name, me)
    c.objects.link(ob)
    if weighted:
        mod = ob.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
        mod.keep_sharp = False
    return ob


def box(name, u0, v0, u1, v1, z0, z1, c, mat=None, bevel=0.0, seg=2, smooth=None):
    """axis-aligned box from plan cm bounds; bevel in cm"""
    bm = bmesh.new()
    a, b = V(min(u0, u1), max(v0, v1), min(z0, z1)), V(max(u0, u1), min(v0, v1), max(z0, z1))
    vs = [bm.verts.new((x, y, z)) for z in (a.z, b.z) for y in (a.y, b.y) for x in (a.x, b.x)]
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        bm.faces.new([vs[i] for i in f])
    if bevel > 0:
        bevel = min(bevel, 0.49 * min(abs(u1 - u0), abs(v1 - v0), abs(z1 - z0)))
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel / 100.0, segments=seg, profile=0.5, affect="EDGES")
    sm = (bevel > 0 and seg >= 3) if smooth is None else smooth
    return obj_from_bm(name, bm, c, [mat] if mat else [], smooth=sm, weighted=sm)


def cyl(name, u, v, z0, z1, r, c, mat=None, segs=40, bevel=0.0, axis="z", length=None):
    """cylinder; axis 'z' = vertical from z0..z1 at plan (u,v); axis 'u'/'v' = horizontal, centred at height z0, running `length` cm"""
    bm = bmesh.new()
    if axis == "z":
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r / 100, radius2=r / 100, depth=(z1 - z0) / 100)
        bmesh.ops.translate(bm, verts=bm.verts, vec=V(u, v, (z0 + z1) / 2))
    else:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r / 100, radius2=r / 100, depth=length / 100)
        from mathutils import Matrix
        rot = Matrix.Rotation(math.pi / 2, 4, "Y" if axis == "u" else "X")
        bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
        bmesh.ops.translate(bm, verts=bm.verts, vec=V(u, v, z0))
    if bevel > 0:
        edges = [e for e in bm.edges if len(e.link_faces) == 2 and abs(e.link_faces[0].normal.dot(e.link_faces[1].normal)) < 0.3]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel / 100, segments=2, profile=0.5, affect="EDGES")
    return obj_from_bm(name, bm, c, [mat] if mat else [], smooth=True, weighted=True)


def prism(name, poly_uv, z0, z1, c, mats=(), face_mat=None):
    """extrude a plan polygon (list of [u,v]) from z0 to z1. face_mat(normal) -> material index"""
    bm = bmesh.new()
    bot = [bm.verts.new(V(u, v, z0)) for u, v in poly_uv]
    top = [bm.verts.new(V(u, v, z1)) for u, v in poly_uv]
    n = len(poly_uv)
    faces = [bm.faces.new(bot), bm.faces.new(list(reversed(top)))]
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new([bot[i], bot[j], top[j], top[i]]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if face_mat:
        bm.normal_update()
        for f in bm.faces:
            f.material_index = face_mat(f.normal)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    return obj_from_bm(name, bm, c, list(mats))


def inside_poly(u, v, poly):
    """ray casting, plan frame"""
    hit = False
    n = len(poly)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        if (y1 > v) != (y2 > v) and u < (x2 - x1) * (v - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def voxel_mesh(name, solids, voids, c, mats, classify=None):
    """One clean closed mesh for a union of boxes minus boxes, built on the grid of all their planes.

    solids / voids: lists of (u0, v0, u1, v1, z0, z1) in cm. classify(centre_uvz_of_empty_neighbour, axis, sign)
    returns the material index of a face. Faces exist only between a solid and an empty cell, so there are
    no inner faces, no overlaps and all normals point out.
    """
    us = sorted({b[i] for b in solids + voids for i in (0, 2)})
    vs = sorted({b[i] for b in solids + voids for i in (1, 3)})
    zs = sorted({b[i] for b in solids + voids for i in (4, 5)})

    def filled(i, j, k):
        if not (0 <= i < len(us) - 1 and 0 <= j < len(vs) - 1 and 0 <= k < len(zs) - 1):
            return False
        cu, cv, cz = (us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2, (zs[k] + zs[k + 1]) / 2
        if not any(b[0] < cu < b[2] and b[1] < cv < b[3] and b[4] < cz < b[5] for b in solids):
            return False
        return not any(b[0] < cu < b[2] and b[1] < cv < b[3] and b[4] < cz < b[5] for b in voids)

    grid = {(i, j, k): filled(i, j, k) for i in range(len(us) - 1) for j in range(len(vs) - 1) for k in range(len(zs) - 1)}
    bm = bmesh.new()
    cache = {}

    def vert(i, j, k):
        key = (i, j, k)
        if key not in cache:
            cache[key] = bm.verts.new(V(us[i], vs[j], zs[k]))
        return cache[key]

    for (i, j, k), s in grid.items():
        if not s:
            continue
        quads = (
            ((i - 1, j, k), 0, -1, [(i, j, k), (i, j, k + 1), (i, j + 1, k + 1), (i, j + 1, k)]),
            ((i + 1, j, k), 0, +1, [(i + 1, j, k), (i + 1, j + 1, k), (i + 1, j + 1, k + 1), (i + 1, j, k + 1)]),
            ((i, j - 1, k), 1, -1, [(i, j, k), (i + 1, j, k), (i + 1, j, k + 1), (i, j, k + 1)]),
            ((i, j + 1, k), 1, +1, [(i, j + 1, k), (i, j + 1, k + 1), (i + 1, j + 1, k + 1), (i + 1, j + 1, k)]),
            ((i, j, k - 1), 2, -1, [(i, j, k), (i, j + 1, k), (i + 1, j + 1, k), (i + 1, j, k)]),
            ((i, j, k + 1), 2, +1, [(i, j, k + 1), (i + 1, j, k + 1), (i + 1, j + 1, k + 1), (i, j + 1, k + 1)]),
        )
        for nb, axis, sign, q in quads:
            if grid.get(nb, False):
                continue
            f = bm.faces.new([vert(*p) for p in q])
            if classify:
                ni, nj, nk = nb
                cu = (us[i] + us[i + 1]) / 2 if axis != 0 else (us[i] - 0.5 if sign < 0 else us[i + 1] + 0.5)
                cv = (vs[j] + vs[j + 1]) / 2 if axis != 1 else (vs[j] - 0.5 if sign < 0 else vs[j + 1] + 0.5)
                cz = (zs[k] + zs[k + 1]) / 2 if axis != 2 else (zs[k] - 0.5 if sign < 0 else zs[k + 1] + 0.5)
                f.material_index = classify((cu, cv, cz), axis, sign)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.001, verts=list(bm.verts), edges=list(bm.edges), delimit={"MATERIAL"})
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    return obj_from_bm(name, bm, c, list(mats))


def rotate_about(objs, u, v, yaw_deg):
    """rotate world-built objects about a vertical axis at plan (u,v); yaw is counter-clockwise seen from above"""
    from mathutils import Matrix
    piv = V(u, v, 0)
    m = Matrix.Translation(piv) @ Matrix.Rotation(math.radians(yaw_deg), 4, "Z") @ Matrix.Translation(-piv)
    for o in objs:
        o.matrix_world = m @ o.matrix_world


# ------------------------------------------------------------------ materials
def _bsdf(mat):
    return mat.node_tree.nodes["Principled BSDF"]


def flat(name, color, rough=0.5, metal=0.0, **kw):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = _bsdf(m)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    for k, val in kw.items():
        b.inputs[k].default_value = val
    m.diffuse_color = (*color, 1)
    return m


def _tex(nt, path, colorspace="sRGB"):
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = bpy.data.images.load(path, check_existing=True)
    n.image.colorspace_settings.name = colorspace
    return n


def pbr(name, tex_id, scale=1.0, tint=None, rough_mul=1.0, bump=1.0, rot_deg=0.0, gray=False, gain=2.0, **kw):
    """image-textured Principled material from assets/polyhaven/textures/<tex_id>; `scale` = metres per tile"""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    d = os.path.join(ASSETS, "polyhaven", "textures", tex_id)

    def find(kind):
        for ext in ("jpg", "png"):
            p = os.path.join(d, f"{tex_id}_{kind}.{ext}")
            if os.path.exists(p):
                return p
        return None

    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / scale, 1 / scale, 1 / scale)
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(rot_deg))
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
    col = _tex(nt, find("Diffuse"))
    nt.links.new(mp.outputs["Vector"], col.inputs["Vector"])
    if gray:  # keep only the texture's light and shade; the colour comes from `tint`
        bw = nt.nodes.new("ShaderNodeRGBToBW")
        nt.links.new(col.outputs["Color"], bw.inputs["Color"])
        g = nt.nodes.new("ShaderNodeMath")
        g.operation = "MULTIPLY"
        g.use_clamp = True
        g.inputs[1].default_value = gain
        nt.links.new(bw.outputs["Val"], g.inputs[0])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["A"].default_value = (*(tint or (0.8, 0.8, 0.8)), 1)
        nt.links.new(g.outputs["Value"], mix.inputs["B"])
        nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    elif tint:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["B"].default_value = (*tint, 1)
        nt.links.new(col.outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    else:
        nt.links.new(col.outputs["Color"], b.inputs["Base Color"])
    rp = find("Rough")
    if rp:
        r = _tex(nt, rp, "Non-Color")
        nt.links.new(mp.outputs["Vector"], r.inputs["Vector"])
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.use_clamp = True
        mul.inputs[1].default_value = rough_mul
        nt.links.new(r.outputs["Color"], mul.inputs[0])
        nt.links.new(mul.outputs["Value"], b.inputs["Roughness"])
    np_ = find("nor_gl")
    if np_ and bump > 0:
        n = _tex(nt, np_, "Non-Color")
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = bump
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    for k, val in kw.items():
        b.inputs[k].default_value = val
    m.diffuse_color = (*(tint or (0.7, 0.7, 0.7)), 1)
    return m


def tiles(name, size_u, size_v, base, grout=(0.55, 0.54, 0.52), rough=0.3, vary=0.035, gap=0.004, offset=0.0, veins=0.0):
    """procedural tile grid in UV metres: tile size_u x size_v m, thin grout, slight tile-to-tile tone variation"""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.offset = offset
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = gap
    br.inputs["Mortar Smooth"].default_value = 0.0
    br.inputs["Bias"].default_value = 0.0
    br.inputs["Brick Width"].default_value = size_u
    br.inputs["Row Height"].default_value = size_v
    lo = tuple(max(0.0, c - vary) for c in base)
    hi = tuple(min(1.0, c + vary) for c in base)
    br.inputs["Color1"].default_value = (*lo, 1)
    br.inputs["Color2"].default_value = (*hi, 1)
    br.inputs["Mortar"].default_value = (*grout, 1)
    nt.links.new(tc.outputs["UV"], br.inputs["Vector"])
    col_out = br.outputs["Color"]
    if veins > 0:
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 2.2
        nz.inputs["Detail"].default_value = 8.0
        nz.inputs["Roughness"].default_value = 0.62
        nz.inputs["Distortion"].default_value = 1.6
        nt.links.new(tc.outputs["UV"], nz.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.46
        ramp.color_ramp.elements[0].color = (1 - veins, 1 - veins, 1 - veins, 1)
        ramp.color_ramp.elements[1].position = 0.56
        ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(br.outputs["Color"], mix.inputs["A"])
        nt.links.new(ramp.outputs["Color"], mix.inputs["B"])
        col_out = mix.outputs["Result"]
    nt.links.new(col_out, b.inputs["Base Color"])
    # grout: rougher and slightly recessed
    rr = nt.nodes.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value = rough
    rr.inputs["To Max"].default_value = 0.85
    nt.links.new(br.outputs["Fac"], rr.inputs["Value"])
    nt.links.new(rr.outputs["Result"], b.inputs["Roughness"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.35
    bp.inputs["Distance"].default_value = 0.002
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(br.outputs["Fac"], inv.inputs[1])
    nt.links.new(inv.outputs["Value"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    m.diffuse_color = (*base, 1)
    return m


def paint(name, color, rough=0.9, grain=0.12):
    """wall paint: flat colour with a fine roller texture in the normal"""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = flat(name, color, rough)
    nt = m.node_tree
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 900.0
    nz.inputs["Detail"].default_value = 3.0
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = grain
    bp.inputs["Distance"].default_value = 0.001
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], _bsdf(m).inputs["Normal"])
    return m


def glass(name="glass"):
    """architectural glass: reflective to the camera, clear to shadow and diffuse rays (no caustic noise, sun passes)"""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    gl = nt.nodes.new("ShaderNodeBsdfGlass")
    gl.inputs["Roughness"].default_value = 0.0
    gl.inputs["IOR"].default_value = 1.0  # thin pane: no refraction shift, reflection from the glossy mix below
    gl.inputs["Color"].default_value = (0.96, 0.985, 0.975, 1)
    gs = nt.nodes.new("ShaderNodeBsdfGlossy")
    gs.inputs["Roughness"].default_value = 0.0
    fr = nt.nodes.new("ShaderNodeFresnel")
    fr.inputs["IOR"].default_value = 1.5
    mixr = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fr.outputs["Fac"], mixr.inputs["Fac"])
    nt.links.new(gl.outputs["BSDF"], mixr.inputs[1])
    nt.links.new(gs.outputs["BSDF"], mixr.inputs[2])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (0.93, 0.96, 0.95, 1)
    lp = nt.nodes.new("ShaderNodeLightPath")
    mx = nt.nodes.new("ShaderNodeMath")
    mx.operation = "MAXIMUM"
    nt.links.new(lp.outputs["Is Shadow Ray"], mx.inputs[0])
    nt.links.new(lp.outputs["Is Diffuse Ray"], mx.inputs[1])
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(mx.outputs["Value"], mix.inputs["Fac"])
    nt.links.new(mixr.outputs["Shader"], mix.inputs[1])
    nt.links.new(tr.outputs["BSDF"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    m.diffuse_color = (0.8, 0.9, 0.9, 0.3)
    return m


def sheer(name="sheer"):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    df = nt.nodes.new("ShaderNodeBsdfDiffuse")
    df.inputs["Color"].default_value = (0.93, 0.92, 0.89, 1)
    tl = nt.nodes.new("ShaderNodeBsdfTranslucent")
    tl.inputs["Color"].default_value = (0.93, 0.92, 0.89, 1)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    m1 = nt.nodes.new("ShaderNodeMixShader")
    m1.inputs["Fac"].default_value = 0.55
    nt.links.new(df.outputs["BSDF"], m1.inputs[1])
    nt.links.new(tl.outputs["BSDF"], m1.inputs[2])
    m2 = nt.nodes.new("ShaderNodeMixShader")
    m2.inputs["Fac"].default_value = 0.32
    nt.links.new(m1.outputs["Shader"], m2.inputs[1])
    nt.links.new(tr.outputs["BSDF"], m2.inputs[2])
    nt.links.new(m2.outputs["Shader"], out.inputs["Surface"])
    m.diffuse_color = (0.93, 0.92, 0.89, 0.7)
    return m


def emit(name, color, strength):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = _bsdf(m)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Emission Color"].default_value = (*color, 1)
    b.inputs["Emission Strength"].default_value = strength
    return m


# ------------------------------------------------------------------ imported models
def import_model(model_id, c, name=None):
    """import a Poly Haven glTF; returns (root empty at the model's bottom centre, size xyz in m)"""
    path = os.path.join(ASSETS, "polyhaven", "models", model_id, f"{model_id}.gltf")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in new:
        if o.type != "MESH":
            continue
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    root = bpy.data.objects.new(name or model_id, None)
    root.empty_display_size = 0.1
    c.objects.link(root)
    root.location = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)
    bpy.context.view_layer.update()
    for o in new:
        link(o, c)
        if o.parent is None:
            mw = o.matrix_world.copy()
            o.parent = root
            o.matrix_parent_inverse = root.matrix_world.inverted()
            o.matrix_world = mw
    return root, hi - lo


def place(root, size, u, v, z=0.0, yaw_deg=0.0, fit=None, uniform=True):
    """move an imported model's root to plan (u,v), floor height z cm; fit=(w_cm, d_cm, h_cm or None) scales it"""
    s = Vector((1, 1, 1))
    if fit:
        fx = (fit[0] / 100) / size.x if fit[0] else None
        fy = (fit[1] / 100) / size.y if fit[1] else None
        fz = (fit[2] / 100) / size.z if len(fit) > 2 and fit[2] else None
        if uniform:
            k = min(f for f in (fx, fy, fz) if f)
            s = Vector((k, k, k))
        else:
            s = Vector((fx or 1, fy or 1, fz or (fx or 1)))
    root.scale = s
    root.rotation_euler = (0, 0, math.radians(yaw_deg))
    root.location = V(u, v, z)
    return root

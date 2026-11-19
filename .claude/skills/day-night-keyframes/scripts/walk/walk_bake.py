"""The 3D walkaround's model: the Hatzav scene with its daylight and lamps BAKED into texture atlases, exported as glTF for three.js.
Adapted from the apt846 walk3d (360walkaround/pipeline/walk3d_bake.py, branch blender-walk, 2026-11-12): same three stages.

  blender -b scene/hatzav.blend --factory-startup -P walk_bake.py -- --stage prep   --dir <work> [--groups 6] [--size 4096]
  blender -b <work>/prep.blend  --factory-startup -P walk_bake.py -- --stage bake   --dir <work> --group K [--samples 64]
  blender -b <work>/prep.blend  --factory-startup -P walk_bake.py -- --stage export --dir <work>

prep: site planting and lights' fixtures sorted out; glass, curtains and leafy models set apart (not baked: drawn live in the browser);
      the lawn is 'env' (not baked, textured live); every other mesh joined per group with a `bake` UV map, one atlas per group.
bake: Cycles DIFFUSE (direct + indirect + colour) of group K, glass and curtains hidden so the daylight comes in.
export: atlases denoised (OIDN) and saved through the scene's view transform as display JPEG (full size + 2048 for phones);
      one glTF for three.js (+Y up). Geometry is never edited. $0, deterministic for the same inputs.
"""
import argparse
import json
import math
import os
import sys

import bpy

ap = argparse.ArgumentParser()
ap.add_argument("--stage", required=True, choices=("prep", "bake", "export"))
ap.add_argument("--dir", required=True)
ap.add_argument("--groups", type=int, default=6)
ap.add_argument("--size", type=int, default=4096)
ap.add_argument("--group", type=int, default=-1)
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--exposure", type=float, default=None, help="export: display exposure (default: the scene's)")
ap.add_argument("--look", default=None, help="export: an AgX look (default: the scene's)")
a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:])
W = os.path.abspath(a.dir)
os.makedirs(W, exist_ok=True)


def log(*x):
    print("[walk]", *x, flush=True)


def mat_names(o):
    return " ".join((s.material.name.lower() if s.material else "") for s in o.material_slots)


def kind(o):
    n = o.name
    if o.get("walk_live"):
        return "live"  # an AI-made piece (place_items.py): in the bake for its shadow and bounce, loaded live by items.js
    top = o
    while top.parent:
        top = top.parent
    root = top.name
    if "glass" in mat_names(o) and "black_glass" not in mat_names(o):
        return "glass"
    if "curtain" in n.lower() or "sheer" in mat_names(o) or "curtain_linen" in mat_names(o):
        return "glass"  # see-through: drawn live, not baked
    if root.startswith(("Tree_", "Shrub_")):
        return "drop"  # the orchard is the panoramic backdrop in the browser
    if n == "Lawn":
        return "env"
    if root.startswith(("L_plant", "K_herb", "T_plant", "X_pot_plant", "L_plant_low", "L_plant_tall")):
        return "plant"
    if n.startswith(("Spot_",)) and n.endswith("_lens"):
        return "lamp"
    if "lamp_shade" in mat_names(o) and "D_pendant" not in n and "B_lamp" not in n:
        return "lamp"
    return "bake"


def cycles(samples):
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = samples
    s.cycles.use_denoising = False
    s.render.use_persistent_data = True
    s.cycles.max_bounces = 6
    s.cycles.diffuse_bounces = 4
    s.cycles.glossy_bounces = 2
    s.cycles.transmission_bounces = 6
    s.cycles.transparent_max_bounces = 8
    s.cycles.sample_clamp_indirect = 8.0


if a.stage == "prep":
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.hide_render:
            bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    counts = {}
    for o in meshes:
        o["walk"] = kind(o)
        counts[o["walk"]] = counts.get(o["walk"], 0) + 1
    log("kinds", counts)
    # the dropped site planting is removed from the walk model; it stays in hatzav.blend
    for o in [o for o in meshes if o["walk"] == "drop"]:
        bpy.data.objects.remove(o, do_unlink=True)
    for o in [o for o in bpy.data.objects if o.type == "EMPTY" and o.name.startswith(("Tree_", "Shrub_"))]:
        bpy.data.objects.remove(o, do_unlink=True)
    bake = [o for o in bpy.data.objects if o.type == "MESH" and o.get("walk") == "bake"]
    grey = bpy.data.materials.new("M_walk_grey")
    grey.use_nodes = True
    for o in bake:
        if o.data.users > 1:
            o.data = o.data.copy()
        if not o.material_slots or not any(s.material for s in o.material_slots):
            o.data.materials.clear()
            o.data.materials.append(grey)
    # a DIFFUSE bake of a metal is black: every baked material is made non-metallic, keeping its colour
    for m in {s.material for o in bake for s in o.material_slots if s.material and s.material.use_nodes}:
        for n in m.node_tree.nodes:
            if n.bl_idname == "ShaderNodeBsdfPrincipled":
                for ln in list(n.inputs["Metallic"].links):
                    m.node_tree.links.remove(ln)
                if n.inputs["Metallic"].default_value > 0:
                    n.inputs["Metallic"].default_value = 0.0
                    c = n.inputs["Base Color"].default_value
                    n.inputs["Base Color"].default_value = (min(1, c[0] * 0.8 + 0.06), min(1, c[1] * 0.8 + 0.06), min(1, c[2] * 0.8 + 0.06), 1)

    def area(o):
        sc = o.matrix_world.to_scale()
        k = abs(sc.x * sc.y * sc.z) ** (2 / 3)
        return sum(p.area for p in o.data.polygons) * k

    FLOORS = ("Floor_public", "Floor_hall", "Floor_bedroom", "Floor_saferoom")
    floors = [o for o in bake if o.name in FLOORS]
    bake = [o for o in bake if o.name not in FLOORS]
    # the big shell (walls, floors, ceilings, roof) gets its own groups; small objects share the rest
    ar = sorted(((area(o), o) for o in bake), key=lambda t: -t[0])
    G = [[0.0, []] for _ in range(a.groups)]
    for s_, o in ar:
        g = min(G, key=lambda t: t[0])
        g[0] += s_
        g[1].append(o)
    log("groups (m2, objects):", [(round(g[0], 1), len(g[1])) for g in G])
    def make_group(k, objs, name):
        for o in objs:
            if not o.data.uv_layers:
                o.data.uv_layers.new(name="UVMap")
            ren = next((u for u in o.data.uv_layers if u.active_render), o.data.uv_layers[0])
            for u in o.data.uv_layers:
                if u != ren and u.name == "UVMap":
                    u.name = "UVMap_other"
            ren.name = "UVMap"
            for u in [u for u in o.data.uv_layers if u.name != "UVMap"]:
                o.data.uv_layers.remove(u)
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.hide_viewport = False
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.convert(target="MESH")
        for o in objs:  # world transform kept, parents (imported models' empties) dropped
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
        bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active
        j.name = name
        j["walk"] = "bake"
        j["walk_group"] = k
        j.data.uv_layers.new(name="bake")
        j.data.uv_layers["UVMap"].active_render = True
        j.data.uv_layers.active = j.data.uv_layers["bake"]
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=True)
        bpy.ops.object.mode_set(mode="OBJECT")
        img = bpy.data.images.new("bake_%d" % k, a.size, a.size, float_buffer=True, alpha=False)
        mats = {s.material for s in j.material_slots if s.material}
        for m in mats:
            m.use_nodes = True
            n = m.node_tree.nodes.new("ShaderNodeTexImage")
            n.name = "WALK_BAKE_%d" % k
            n.image = img
        log("group", k, "faces", len(j.data.polygons), "materials", len(mats))

    for k, (s_, objs) in enumerate(G):
        make_group(k, objs, "WALK_group_%d" % k)
    if floors:  # the floor of the dry rooms: its own atlas, so the walk can swap the finish and keep the baked light
        make_group(a.groups, floors, "WALK_floor")
        bpy.context.view_layer.objects.active["walk_floor"] = True
    json.dump({"groups": a.groups, "size": a.size, "floor": bool(floors)}, open(os.path.join(W, "prep.json"), "w"))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(W, "prep.blend"))
    print("WALK_PREP_OK")

elif a.stage == "bake":
    k = a.group
    cycles(a.samples)
    for o in bpy.data.objects:
        if o.get("walk") == "glass":
            o.hide_render = True
    objs = [o for o in bpy.data.objects if o.type == "MESH" and o.get("walk_group") == k]
    for m in bpy.data.materials:
        if m.node_tree and ("WALK_BAKE_%d" % k) in m.node_tree.nodes:
            m.node_tree.nodes.active = m.node_tree.nodes["WALK_BAKE_%d" % k]
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers["bake"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    b = bpy.context.scene.render.bake
    b.margin = 6
    b.use_clear = True
    b.target = "IMAGE_TEXTURES"
    import time
    t = time.time()
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT", "COLOR"}, margin=6, use_clear=True)
    img = bpy.data.images["bake_%d" % k]
    img.filepath_raw = os.path.join(W, "bake_%d.exr" % k)
    img.file_format = "OPEN_EXR"
    img.save()
    log("baked group", k, "in", round(time.time() - t), "s")
    if objs[0].get("walk_floor"):  # the floor's colour alone (cheap): export divides the full bake by it → a shading map
        col = bpy.data.images.new("bake_%d_col" % k, img.size[0], img.size[1], float_buffer=True, alpha=False)
        for m in bpy.data.materials:
            if m.node_tree and ("WALK_BAKE_%d" % k) in m.node_tree.nodes:
                m.node_tree.nodes["WALK_BAKE_%d" % k].image = col
        bpy.context.scene.cycles.samples = 1
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=6, use_clear=True)
        col.filepath_raw = os.path.join(W, "bake_%d_col.exr" % k)
        col.file_format = "OPEN_EXR"
        col.save()
        log("baked floor colour", k)
    print("WALK_BAKE_OK")

else:  # export
    cfg = json.load(open(os.path.join(W, "prep.json")))
    s = bpy.context.scene
    dn = bpy.data.scenes.new("walk_denoise")
    dn.use_nodes = True
    nt = dn.node_tree
    dn.view_settings.view_transform = s.view_settings.view_transform
    dn.view_settings.look = s.view_settings.look
    dn.view_settings.exposure = s.view_settings.exposure if a.exposure is None else a.exposure
    if a.look:
        dn.view_settings.look = a.look
    log("display", dn.view_settings.view_transform, dn.view_settings.look, dn.view_settings.exposure)
    dn.render.image_settings.file_format = "JPEG"
    dn.render.image_settings.quality = 90
    gl = os.path.join(W, "gl")
    os.makedirs(gl, exist_ok=True)
    NG = cfg["groups"] + (1 if cfg.get("floor") else 0)
    for k in range(NG):
        src = bpy.data.images.load(os.path.join(W, "bake_%d.exr" % k), check_existing=False)
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        i = nt.nodes.new("CompositorNodeImage")
        i.image = src
        d = nt.nodes.new("CompositorNodeDenoise")
        d.prefilter = "ACCURATE"
        c = nt.nodes.new("CompositorNodeComposite")
        nt.links.new(i.outputs["Image"], d.inputs["Image"])
        nt.links.new(d.outputs["Image"], c.inputs["Image"])
        dn.render.resolution_x, dn.render.resolution_y = src.size
        dn.render.resolution_percentage = 100
        dn.render.filepath = os.path.join(gl, "bake_%d.jpg" % k)
        bpy.ops.render.render(write_still=True, scene=dn.name)
        small = bpy.data.images.load(dn.render.filepath, check_existing=False)
        small.scale(2048, 2048)
        small.filepath_raw = os.path.join(gl, "bake_%d_2k.jpg" % k)
        small.file_format = "JPEG"
        small.save()
        log("atlas", k, "denoised")
        if os.path.exists(os.path.join(W, "bake_%d_col.exr" % k)):
            import numpy as np
            full = bpy.data.images.load(dn.render.filepath, check_existing=False)
            colr = bpy.data.images.load(os.path.join(W, "bake_%d_col.exr" % k), check_existing=False)
            w_, h_ = full.size
            if tuple(colr.size) != (w_, h_):
                colr.scale(w_, h_)
            F = np.array(full.pixels[:], dtype=np.float32).reshape(h_, w_, 4)[..., :3]
            A = np.array(colr.pixels[:], dtype=np.float32).reshape(h_, w_, 4)[..., :3]
            A = np.where(A <= 0.0031308, A * 12.92, 1.055 * np.power(np.clip(A, 0, None), 1 / 2.4) - 0.055)  # linear → sRGB
            shade = np.clip(F.mean(-1) / np.clip(A.mean(-1), 0.04, None), 0, 2.2)
            v = np.clip(np.power(shade, 2.2) / 5.0, 0, 1)  # three.js multiplies in linear: store shade^2.2, scaled by 1/5
            out_ = bpy.data.images.new("shade_%d" % k, w_, h_, alpha=False)
            px = np.ones((h_, w_, 4), dtype=np.float32)
            px[..., 0] = px[..., 1] = px[..., 2] = v
            out_.pixels = px.ravel()
            out_.filepath_raw = os.path.join(gl, "bake_%d_shade.png" % k)
            out_.file_format = "PNG"
            out_.save()
            json.dump({"lightMapIntensity": 5.0, "group": k}, open(os.path.join(gl, "floor.json"), "w"))
            log("floor shading map", k)
    for k in range(NG):
        m = bpy.data.materials.new("WALK_baked_%d" % k)
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        t = m.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(os.path.join(gl, "bake_%d.jpg" % k), check_existing=True)
        m.node_tree.links.new(t.outputs["Color"], b.inputs["Base Color"])
        b.inputs["Roughness"].default_value = 1.0
        for o in [o for o in bpy.data.objects if o.type == "MESH" and o.get("walk_group") == k]:
            for uv in [u for u in o.data.uv_layers if u.name != "bake"]:
                o.data.uv_layers.remove(uv)
            o.data.materials.clear()
            o.data.materials.append(m)
    gm = bpy.data.materials.new("WALK_glass")
    for o in bpy.data.objects:
        if o.get("walk") == "glass" and "curtain" not in o.name.lower():
            o.data.materials.clear()
            o.data.materials.append(gm)
            o.hide_render = False
        elif o.get("walk") == "glass":
            o.hide_render = False
    keep = [o for o in bpy.data.objects if o.type == "MESH" and o.get("walk") in ("bake", "glass", "plant", "env", "lamp")]
    for o in bpy.data.objects:
        o.select_set(o in keep)
    out = os.path.join(gl, "walk.gltf")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLTF_SEPARATE", use_selection=True, export_image_format="JPEG",
                              export_jpeg_quality=88, export_apply=True, export_yup=True, export_texcoords=True,
                              export_normals=True, export_materials="EXPORT", export_extras=True)
    log("exported", out)
    print("WALK_EXPORT_OK")

"""Step 12 ($0) - bake the light of the apartment into lightmaps for the walkthrough (CPU Cycles, under the Blender lock).

Adapted from Rainbow's walk3d_bake.py (360walkaround/pipeline, branch blender-walk), with one change: it bakes LIGHT ONLY
(Cycles DIFFUSE, direct + indirect, no colour), so the browser keeps every texture at full sharpness and multiplies it by
the baked light: sun patches, sky light through the windows, bounce between walls, soft contact shadows.

Stages, each one bounded Blender run:
  blender -b --factory-startup -P 12_bake_lightmaps.py -- --stage prep   --job <job> [--groups 4] [--size 2048]
  blender -b <job>/work/bake/prep.blend --factory-startup -P 12_bake_lightmaps.py -- --stage bake --job <job> --group K [--samples 64]
  blender -b <job>/work/bake/prep.blend --factory-startup -P 12_bake_lightmaps.py -- --stage export --job <job>
Input  scene/apartment-walk.glb (the walkthrough's own scene, exported by scripts/11_export_glb.mjs)
Output walk/baked/apartment-lm.glb (geometry + textures + a second UV set), walk/baked/lm_K.jpg (+ _1k.jpg), walk/baked/manifest.json
Light: the sky picture alone (golden_gate_hills 4k HDR, its own sun), so the sun seen through a window and the shadows on the floor agree.
"""
import argparse
import json
import math
import os
import sys

import bpy

ap = argparse.ArgumentParser()
ap.add_argument("--stage", required=True, choices=("prep", "bake", "export"))
ap.add_argument("--job", required=True)
ap.add_argument("--groups", type=int, default=4)
ap.add_argument("--size", type=int, default=2048)
ap.add_argument("--group", type=int, default=-1)
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--scale", type=float, default=2.0, help="export: stored value = light / scale (8-bit headroom)")
ap.add_argument("--sky-rot", type=float, default=-70.0, help="degrees about up; matches the walkthrough's sky rotation (110) minus 180")
a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:])
JOB = os.path.abspath(a.job)
W = os.path.join(JOB, "work", "bake")
OUT = os.path.join(JOB, "walk", "baked")
os.makedirs(W, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
log = lambda *x: print("[bake]", *x, flush=True)


def top(o):
    while o.parent:
        o = o.parent
    return o


def kind(o):
    n = top(o).name
    if n.startswith("GLASS_") or any(s.material and s.material.name.startswith("glass") for s in o.material_slots):
        return "glass"
    if n.startswith("PLANT_"):
        return "plant"
    if any(s.material and s.material.name.startswith("slab") for s in o.material_slots):
        return "skip"
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
    s.cycles.glossy_bounces = 1
    s.cycles.transmission_bounces = 4
    s.cycles.sample_clamp_indirect = 6.0
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    # bounced light by the fast-GI approximation (AO-based, one exact bounce): interiors lit only through windows stay noisy
    # at hundreds of samples with full path tracing; this keeps the light's shape and removes the mottling
    s.cycles.use_fast_gi = True
    s.cycles.fast_gi_method = "ADD"
    s.world.light_settings.distance = 1.2
    s.cycles.ao_bounces = 2
    s.cycles.ao_bounces_render = 2


if a.stage == "prep":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(JOB, "scene", "apartment-walk.glb"))
    # the world: the sky picture alone
    w = bpy.data.worlds.new("sky")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(JOB, "assets", "polyhaven", "hdri", "golden_gate_hills_4k.hdr"))
    mp = nt.nodes.new("ShaderNodeMapping")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(a.sky_rot))
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], nt.nodes["Background"].inputs["Color"])
    nt.nodes["Background"].inputs["Strength"].default_value = 1.0
    # light portals in every glazed opening: Cycles then aims its sky samples through the windows instead of finding them by
    # chance (without them the interior bake stays noisy at 512 samples and the denoiser smears it into stains)
    geo = json.load(open(os.path.join(JOB, "geometry", "geometry.json"), encoding="utf-8"))
    inward = {"W-kitchen-N": "S", "SD-living-N": "S", "W-parentsbath-N": "S", "W-parents-N": "S", "W-mamad-E": "W",
              "W-bath-E": "W", "W-bath-S": "N", "W-bedB-E": "W", "W-bedA-W": "E", "W-wc-S": "N"}
    for op in geo["openings"]:
        if op["kind"] not in ("window", "sliding_door"):
            continue
        x0, y0, x1, y1 = op["r"]
        L = (x1 - x0) if op["axis"] == "x" else (y1 - y0)
        hgt = op["head"] - op["sill"]
        ld = bpy.data.lights.new("portal_" + op["id"], "AREA")
        ld.shape = "RECTANGLE"
        ld.cycles.is_portal = True
        lo = bpy.data.objects.new("portal_" + op["id"], ld)
        bpy.context.scene.collection.objects.link(lo)
        lo.location = ((x0 + x1) / 2, (y0 + y1) / 2, (op["sill"] + op["head"]) / 2)
        d = inward[op["id"]]
        lo.rotation_euler = {"S": (math.radians(-90), 0, 0), "N": (math.radians(90), 0, 0), "E": (0, math.radians(-90), 0), "W": (0, math.radians(90), 0)}[d]
        ld.size, ld.size_y = (L, hgt) if op["axis"] == "x" else (hgt, L)
    log("portals:", sum(1 for o in bpy.data.objects if o.name.startswith("portal_")))
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    for o in meshes:
        o["lm"] = kind(o)
    bake = [o for o in meshes if o["lm"] == "bake"]
    log("objects: bake", len(bake), "glass", sum(o["lm"] == "glass" for o in meshes), "plant", sum(o["lm"] == "plant" for o in meshes))
    # metals bake black in a diffuse pass: non-metallic for the bake (the browser keeps no metals on baked surfaces either)
    for m in {s.material for o in bake for s in o.material_slots if s.material and s.material.use_nodes}:
        for n in m.node_tree.nodes:
            if n.bl_idname == "ShaderNodeBsdfPrincipled":
                for l in list(n.inputs["Metallic"].links):
                    m.node_tree.links.remove(l)
                n.inputs["Metallic"].default_value = 0.0
                n.inputs["Alpha"].default_value = 1.0

    def area(o):
        sc = o.matrix_world.to_scale()
        return sum(p.area for p in o.data.polygons) * abs(sc.x * sc.y * sc.z) ** (2 / 3)
    for o in bake:
        if o.data.users > 1:
            o.data = o.data.copy()
    # split the big merged surfaces so the groups can balance: every bake object goes whole into the lightest group
    ar = sorted(((area(o), o) for o in bake), key=lambda t: -t[0])
    G = [[0.0, []] for _ in range(a.groups)]
    for s_, o in ar:
        g = min(G, key=lambda t: t[0])
        g[0] += s_
        g[1].append(o)
    log("groups (m2, objects):", [(round(g[0], 1), len(g[1])) for g in G])
    for k, (s_, objs) in enumerate(G):
        for o in objs:
            if not o.data.uv_layers:
                o.data.uv_layers.new(name="UVMap")
            ren = next((u for u in o.data.uv_layers if u.active_render), o.data.uv_layers[0])
            ren.name = "UVMap"
            for u in [u for u in o.data.uv_layers if u.name != "UVMap"]:
                o.data.uv_layers.remove(u)
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.hide_viewport = False
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
        bpy.ops.object.convert(target="MESH")
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active
        j.name = "LM_group_%d" % k
        j["lm"] = "bake"
        j["lm_group"] = k
        j.data.uv_layers.new(name="lm")
        j.data.uv_layers["UVMap"].active_render = True
        j.data.uv_layers.active = j.data.uv_layers["lm"]
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        # the browser exports every triangle on its own: weld coincident corners so a wall or a floor unwraps as ONE island
        bpy.ops.mesh.remove_doubles(threshold=0.0008)
        bpy.ops.object.mode_set(mode="OBJECT")
        try:
            bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
        except Exception as e:
            log("auto smooth skipped:", e)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        try:   # axis-aligned islands waste less of the square atlas than the 45-degree packs of the default
            bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=0.0, correct_aspect=True, scale_to_bounds=True, rotate_method="AXIS_ALIGNED")
        except TypeError:
            bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=0.0, correct_aspect=True, scale_to_bounds=True)
        bpy.ops.object.mode_set(mode="OBJECT")
        img = bpy.data.images.new("lm_%d" % k, a.size, a.size, float_buffer=True, alpha=False)
        for m in {s.material for s in j.material_slots if s.material}:
            m.use_nodes = True
            n = m.node_tree.nodes.new("ShaderNodeTexImage")
            n.name = "LM_BAKE_%d" % k
            n.image = img
        log("group", k, "faces", len(j.data.polygons), "materials", len(j.material_slots))
    json.dump({"groups": a.groups, "size": a.size}, open(os.path.join(W, "prep.json"), "w"))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(W, "prep.blend"))
    print("LM_PREP_OK")

elif a.stage == "bake":
    k = a.group
    cycles(a.samples)
    for o in bpy.data.objects:
        if o.get("lm") == "glass":
            o.hide_render = True   # daylight comes in through the openings
    j = bpy.data.objects["LM_group_%d" % k]
    for m in bpy.data.materials:
        if m.node_tree and ("LM_BAKE_%d" % k) in m.node_tree.nodes:
            m.node_tree.nodes.active = m.node_tree.nodes["LM_BAKE_%d" % k]
    j.data.uv_layers.active = j.data.uv_layers["lm"]
    bpy.ops.object.select_all(action="DESELECT")
    j.select_set(True)
    bpy.context.view_layer.objects.active = j
    b = bpy.context.scene.render.bake
    b.margin = 16
    b.use_clear = True
    b.target = "IMAGE_TEXTURES"
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=16, use_clear=True)
    img = bpy.data.images["lm_%d" % k]
    img.filepath_raw = os.path.join(W, "lm_%d.exr" % k)
    img.file_format = "OPEN_EXR"
    img.save()
    log("baked group", k, "->", img.filepath_raw)
    print("LM_BAKE_OK")

else:  # export
    cfg = json.load(open(os.path.join(W, "prep.json")))
    dn = bpy.data.scenes.new("lm_denoise")
    dn.use_nodes = True
    nt = dn.node_tree
    dn.view_settings.view_transform = "Standard"   # plain sRGB encode: the browser decodes it back to linear light
    dn.view_settings.look = "None"
    dn.view_settings.exposure = 0.0
    dn.render.image_settings.file_format = "JPEG"
    dn.render.image_settings.quality = 92
    groups = []
    # the storage scale from the light itself: 99.5th percentile of the lit texels of every atlas (8-bit precision where it matters)
    import numpy as np
    vals = []
    for k in range(cfg["groups"]):
        im = bpy.data.images.load(os.path.join(W, "lm_%d.exr" % k), check_existing=False)
        px = np.empty(im.size[0] * im.size[1] * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        lum = px.reshape(-1, 4)[:, :3].max(axis=1)
        vals.append(lum[lum > 1e-4][::7])
        bpy.data.images.remove(im)
    allv = np.concatenate(vals)
    a.scale = float(np.percentile(allv, 99.5)) if allv.size else a.scale
    log("light range: median", round(float(np.median(allv)), 4), "p99.5", round(a.scale, 4))
    for k in range(cfg["groups"]):
        src = bpy.data.images.load(os.path.join(W, "lm_%d.exr" % k), check_existing=False)
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        i = nt.nodes.new("CompositorNodeImage")
        i.image = src
        d = nt.nodes.new("CompositorNodeDenoise")
        d.prefilter = "ACCURATE"
        mul = nt.nodes.new("CompositorNodeMixRGB")
        mul.blend_type = "MULTIPLY"
        mul.inputs[0].default_value = 1.0
        mul.inputs[2].default_value = (1.0 / a.scale, 1.0 / a.scale, 1.0 / a.scale, 1.0)
        c = nt.nodes.new("CompositorNodeComposite")
        nt.links.new(i.outputs["Image"], d.inputs["Image"])
        nt.links.new(d.outputs["Image"], mul.inputs[1])
        nt.links.new(mul.outputs["Image"], c.inputs["Image"])
        dn.render.resolution_x, dn.render.resolution_y = src.size
        dn.render.resolution_percentage = 100
        dn.render.filepath = os.path.join(OUT, "lm_%d.jpg" % k)
        bpy.ops.render.render(write_still=True, scene=dn.name)
        small = bpy.data.images.load(dn.render.filepath, check_existing=False)
        small.scale(src.size[0] // 2, src.size[1] // 2)
        small.filepath_raw = os.path.join(OUT, "lm_%d_small.jpg" % k)
        small.file_format = "JPEG"
        small.save()
        groups.append({"group": k, "file": "lm_%d.jpg" % k, "small": "lm_%d_small.jpg" % k})
        log("lightmap", k, "->", dn.render.filepath)
    # the baked geometry with BOTH uv sets (textures on UVMap, light on lm); bake image nodes are left unlinked (not exported)
    for m in bpy.data.materials:
        if m.node_tree:
            for n in [n for n in m.node_tree.nodes if n.name.startswith("LM_BAKE_")]:
                m.node_tree.nodes.remove(n)
    keep = [o for o in bpy.data.objects if o.type == "MESH" and o.get("lm") == "bake"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in keep:
        o.select_set(True)
    out = os.path.join(OUT, "apartment-lm.glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_image_format="JPEG", export_jpeg_quality=85,
                              export_apply=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT")
    json.dump({"model": "apartment-lm.glb", "scale": a.scale, "groups": groups, "sky": "golden_gate_hills_4k", "sky_rot_deg": a.sky_rot,
               "note": "light-only Cycles DIFFUSE bake (direct + indirect), OIDN denoised, stored as light/scale in sRGB JPEG"},
              open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
    log("exported", out)
    print("LM_EXPORT_OK")

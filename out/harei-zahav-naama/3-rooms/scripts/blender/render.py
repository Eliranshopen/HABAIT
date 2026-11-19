"""Render one camera of scene/hatzav.blend, whole or one vertical strip (for bounded CPU chunks).

Run: blender -b scene/hatzav.blend --python-exit-code 1 -P scripts/blender/render.py -- --cam <name> --res WxH
       --samples N --out <png> [--strip i/n --pad 48] [--exposure 0.0] [--threshold 0.03] [--hide a,b]
       [--top-plan]   (orthographic view from above with the roof hidden, for the plan check)
A strip i of n renders columns [i/n, (i+1)/n] plus `pad` pixels on each side; the stitcher feathers the pads.
Writes the image and a sidecar <png>.json (camera, size, samples, seconds, strip window).
"""
import json
import math
import sys
import time

import bpy

a = sys.argv[sys.argv.index("--") + 1:]


def opt(name, default=None):
    return a[a.index(name) + 1] if name in a else default


scene = bpy.context.scene
W, Hh = [int(x) for x in opt("--res", "2048x1024").split("x")]
scene.render.resolution_x, scene.render.resolution_y = W, Hh
scene.render.resolution_percentage = 100
scene.cycles.samples = int(opt("--samples", "64"))
scene.cycles.adaptive_threshold = float(opt("--threshold", "0.03"))
scene.cycles.device = "CPU"
scene.render.threads_mode = "AUTO"
scene.cycles.use_denoising = True   # OIDN on the CPU: a clean frame at a modest sample count
if opt("--exposure") is not None:
    scene.view_settings.exposure = float(opt("--exposure"))
if opt("--look"):
    scene.view_settings.look = opt("--look")
for name in (opt("--hide", "") or "").split(","):
    if name and name in bpy.data.objects:
        bpy.data.objects[name].hide_render = True
    elif name and name in bpy.data.collections:
        bpy.data.collections[name].hide_render = True

info = {"res": [W, Hh], "samples": scene.cycles.samples, "threshold": scene.cycles.adaptive_threshold}
if "--top-plan" in a:
    for n in ("Roof_Slab", "Roof_Parapet"):
        bpy.data.objects[n].hide_render = True
    for cname in ("01b_Derived_Pergola", "04_Lighting", "06_Site"):
        if cname in bpy.data.collections:
            bpy.data.collections[cname].hide_render = True
    cd = bpy.data.cameras.new("top_plan")
    cd.type = "ORTHO"
    # frame: plan u -80..1180, v -80..1100  (cm) -> centre and scale in metres
    u0, u1, v0, v1 = -80, 1180, -80, 1100
    cd.ortho_scale = max((u1 - u0), (v1 - v0) * W / Hh) / 100.0
    ob = bpy.data.objects.new("top_plan", cd)
    ob.location = ((u0 + u1) / 200.0, -(v0 + v1) / 200.0, 30.0)
    scene.collection.objects.link(ob)
    scene.camera = ob
    cd.clip_end = 100
    info["top_plan"] = {"u0": u0, "u1": u1, "v0": v0, "v1": v1, "ortho_scale_m": cd.ortho_scale}
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
else:
    cam = opt("--cam")
    scene.camera = bpy.data.objects[cam]
    info["camera"] = cam
    if opt("--at"):   # 2026-11-18 (the 360 of the plan layout): stand the camera at plan u,v (cm), eye 155 cm; frame x = u/100, y = -v/100
        u_, v_ = [float(x) for x in opt("--at").split(",")]
        scene.camera.location = (u_ / 100.0, -v_ / 100.0, float(opt("--eye", "155")) / 100.0)
        info["at_uv_cm"] = [u_, v_]
    info["location_m"] = [round(v, 4) for v in scene.camera.location]

strip = opt("--strip")
if strip:
    i, n = [int(x) for x in strip.split("/")]
    pad = int(opt("--pad", "48"))
    x0 = max(0, round(i * W / n) - pad)
    x1 = min(W, round((i + 1) * W / n) + pad)
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.border_min_x, scene.render.border_max_x = x0 / W, x1 / W
    scene.render.border_min_y, scene.render.border_max_y = 0.0, 1.0
    info["strip"] = {"i": i, "n": n, "x0": x0, "x1": x1, "pad": pad}

import os  # noqa: E402

out = os.path.abspath(opt("--out"))  # Blender resolves a relative path against the drive root, not the cwd
scene.render.filepath = out
scene.render.image_settings.file_format = "PNG"
t = time.time()
bpy.ops.render.render(write_still=True)
info["seconds"] = round(time.time() - t, 1)
json.dump(info, open(out + ".json", "w", encoding="utf-8"), indent=1)
print("RENDER OK", json.dumps(info))

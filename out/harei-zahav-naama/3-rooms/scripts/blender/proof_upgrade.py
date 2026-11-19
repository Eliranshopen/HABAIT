"""Proof ($0): the same model, upgraded materials + bevelled edges + light, rendered from the developer's TV-wall angle (render 0060000).

Run: blender -b scene/hatzav.blend --factory-startup -P scripts/blender/proof_upgrade.py -- --out <png> [--upgrade] [--res 900] [--samples 128]
Without --upgrade it renders the model as it is (the "before"). Never saves the .blend.
"""
import json
import math
import os
import sys
import time

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]


def opt(n, d=None):
    return a[a.index(n) + 1] if n in a else d


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEX = os.path.join(ROOT, "assets", "polyhaven", "textures")
scene = bpy.context.scene


def V(u, v, z):
    return Vector((u / 100.0, -v / 100.0, z / 100.0))


# --- camera: behind the sofa, looking north at the TV wall (render 0060000)
cd = bpy.data.cameras.new("proof_tv")
cd.lens = float(opt("--lens", "21"))
cd.sensor_width = 36
cd.clip_start = 0.05
ob = bpy.data.objects.new("proof_tv", cd)
ob.location = V(1040, float(opt("--v", "1105")), 128)
ob.rotation_euler = (V(1040, 700, 112) - ob.location).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(ob)
scene.camera = ob


sys.path.insert(0, os.path.dirname(__file__))
from upgrade_lib import apply_upgrade  # noqa: E402

info = {"upgrade": "--upgrade" in a}
if "--upgrade" in a:
    apply_upgrade(scene, float(opt("--exposure", "-0.1")))

if "--items" in a:
    sys.path.insert(0, os.path.dirname(__file__))
    import place_items  # noqa: E402
    yo = {k: float(v) for k, v in (p.split("=") for p in (opt("--yaw", "") or "").split(",") if p)}
    info["items"] = place_items.place(ROOT, yaw_override=yo)
if opt("--cam"):
    c = opt("--cam").split(",")  # u,v,z,tu,tv,tz,lens
    u, v, z, tu, tv, tz, ln = [float(x) for x in c]
    ob.location = V(u, v, z)
    ob.rotation_euler = (V(tu, tv, tz) - ob.location).to_track_quat("-Z", "Y").to_euler()
    cd.lens = ln

R = int(opt("--res", "900"))
scene.render.resolution_x = scene.render.resolution_y = R
scene.render.resolution_percentage = 100
scene.cycles.samples = int(opt("--samples", "128"))
scene.cycles.use_denoising = True
scene.cycles.device = "CPU"
out = os.path.abspath(opt("--out"))
scene.render.filepath = out
scene.render.image_settings.file_format = "PNG"
t = time.time()
bpy.ops.render.render(write_still=True)
info.update({"seconds": round(time.time() - t, 1), "res": R, "samples": scene.cycles.samples,
             "look": scene.view_settings.look, "exposure": scene.view_settings.exposure})
json.dump(info, open(out + ".json", "w", encoding="utf-8"), indent=1)
print("PROOF OK", json.dumps(info))

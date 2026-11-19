"""Proof stills for the 2026-11-18 render fixes (qa/360/RENDER-AUDIT.md): aimed perspective cameras, one Blender run.

Run: blender -b scene/hatzav_v2.blend --factory-startup -P scripts/blender/fix_stills.py -- <out_dir> [--samples 32] [--res 1280x720]
     [--only name,name] [--pano u,v]   (--pano also renders a low equirect from plan u,v at eye 155)
Shots are plan cm (u right, v down, z up): from -> to, lens mm. Writes <out_dir>/<name>.png + <name>.png.json.
"""
import json
import math
import os
import sys
import time

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(a[0])
os.makedirs(OUT, exist_ok=True)


def opt(n, d=None):
    return a[a.index(n) + 1] if n in a else d


def V(u, v, z):
    return Vector((u / 100.0, -v / 100.0, z / 100.0))


SHOTS = {
    "kitchen-south-wall": ((345, 905, 150), (215, 1026, 172), 15),
    "bath-wc-shower": ((196, 362, 168), (40, 430, 140), 14),
    "bath-vanity": ((160, 360, 150), (160, 514, 125), 16),
    "saferoom-window": ((255, 285, 150), (205, 34, 150), 15),
}
only = [s for s in (opt("--only", "") or "").split(",") if s]
sc = bpy.context.scene
W, Hh = [int(x) for x in opt("--res", "1280x720").split("x")]
sc.cycles.device = "CPU"
sc.cycles.samples = int(opt("--samples", "32"))
sc.cycles.use_denoising = True
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
jobs = [(n, s) for n, s in SHOTS.items() if not only or n in only]
if opt("--pano"):
    jobs.append(("pano-" + opt("--pano").replace(",", "_"), "pano"))
for name, s in jobs:
    if s == "pano":
        u, v = [float(x) for x in opt("--pano").split(",")]
        cd = bpy.data.cameras.new("fix_pano")
        cd.type = "PANO"
        cd.panorama_type = "EQUIRECTANGULAR"
        cd.clip_start = 0.05
        ob = bpy.data.objects.new("fix_pano", cd)
        ob.location = V(u, v, 155)
        ob.rotation_euler = (math.radians(90), 0, math.radians(-90))
        sc.render.resolution_x, sc.render.resolution_y = 1024, 512
        sc.cycles.samples = int(opt("--pano-samples", "16"))
    else:
        (fu, fv, fz), (tu, tv, tz), lens = s
        cd = bpy.data.cameras.new("fix_" + name)
        cd.lens, cd.sensor_width, cd.clip_start = lens, 36, 0.05
        ob = bpy.data.objects.new("fix_" + name, cd)
        ob.location = V(fu, fv, fz)
        ob.rotation_euler = (V(tu, tv, tz) - ob.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.resolution_x, sc.render.resolution_y = W, Hh
        sc.cycles.samples = int(opt("--samples", "32"))
    sc.collection.objects.link(ob)
    sc.camera = ob
    p = os.path.join(OUT, name + ".png")
    sc.render.filepath = p
    t = time.time()
    bpy.ops.render.render(write_still=True)
    info = {"shot": name, "spec": s if s != "pano" else opt("--pano"), "res": [sc.render.resolution_x, sc.render.resolution_y],
            "samples": sc.cycles.samples, "seconds": round(time.time() - t, 1), "blend": bpy.data.filepath}
    json.dump(info, open(p + ".json", "w", encoding="utf-8"), indent=1)
    print("STILL OK", json.dumps(info))

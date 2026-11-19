"""Step 30 ($0, CPU) - the 360 version: Cycles equirectangular panoramas of the final model (sales-sheet walls, the Hunyuan furniture
made from Eliran's pictures, the noon light of the day-night-keyframes presets) at the standpoints of work/pano_points.json.
Eliran 2026-11-18: «תייצר לי 2 גרסאות … 3D 360 … חובה שיהיה ריאליסטיות». Plan development/plans/2026-11-18-ahk-b10-two-versions.md.
Run: blender -b <noon.blend> --factory-startup -P 30_render_panos.py -- <points.json> <out dir> [--res 3072] [--samples 48] [--only id,id]
Per point: <out>/<id>.png (equirect, 2:1, +depth <id>_depth.exr for the measure tool). A point whose PNG exists is skipped (re-run safe)."""
import json, math, os, sys
import bpy
from mathutils import Euler, Vector

a = sys.argv[sys.argv.index("--") + 1:]
P, out = json.load(open(a[0], encoding="utf-8")), os.path.abspath(a[1])
res = int(a[a.index("--res") + 1]) if "--res" in a else 3072
spp = int(a[a.index("--samples") + 1]) if "--samples" in a else 48
only = a[a.index("--only") + 1].split(",") if "--only" in a else None
ev = float(a[a.index("--ev") + 1]) if "--ev" in a else 0.0   # added to the scene exposure (the noon preset is tuned for the bake export)
os.makedirs(out, exist_ok=True)
sc = bpy.context.scene
for o in bpy.data.objects:
    if o.type == "MESH":
        o.hide_render = False
cd = bpy.data.cameras.new("pano"); cd.type = "PANO"
try:
    cd.panorama_type = "EQUIRECTANGULAR"
except AttributeError:
    cd.cycles.panorama_type = "EQUIRECTANGULAR"
ob = bpy.data.objects.new("pano", cd); sc.collection.objects.link(ob); sc.camera = ob
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = spp; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 8; sc.cycles.diffuse_bounces = 4; sc.cycles.glossy_bounces = 4; sc.cycles.transparent_max_bounces = 8
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = res, res // 2, 100
sc.render.image_settings.file_format = "PNG"
vl = sc.view_layers[0]; vl.use_pass_z = True
sc.view_settings.exposure += ev; print("exposure", sc.view_settings.exposure, sc.view_settings.view_transform)
for p in P["points"]:
    if only and p["id"] not in only:
        continue
    f = os.path.join(out, p["id"] + ".png")
    if os.path.exists(f):
        print("SKIP", p["id"]); continue
    # Blender: plan x east, plan y north, z up. The panorama's centre (yaw 0) looks along the point's yaw_deg (0 = north, + turns left)
    ob.location = Vector((p["x"], p["y"], P["eye_m"]))
    ob.rotation_euler = Euler((math.pi / 2, 0, math.radians(p["yaw_deg"])), "XYZ")
    sc.render.filepath = f
    bpy.ops.render.render(write_still=True)
    print("PANO_OK", p["id"], flush=True)
print("PANOS_DONE")

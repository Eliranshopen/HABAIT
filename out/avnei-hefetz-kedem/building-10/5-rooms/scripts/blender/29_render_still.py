"""Step 29 ($0, CPU) - one full Cycles render of the walk's own model from a skin standpoint: the look a Gaussian-Splatting walk would
carry (it is trained on renders like this). Eliran 2026-11-18: «איך התוצאה תראה עם Gaussian Splatting ובלי».
Run: blender -b <out>/<key>/prep_<key>.blend --factory-startup -P 29_render_still.py -- <cams.json> <view name> <out.png> [--samples 96]
The camera comes from cams.json (three.js position + yaw/pitch, fov_v), converted to Blender (x, -z, y). Never saves the .blend."""
import json, math, sys
import bpy
from mathutils import Matrix, Vector

a = sys.argv[sys.argv.index("--") + 1:]
import os
cams, name, out = a[0], a[1], os.path.abspath(a[2])
S = int(a[a.index("--samples") + 1]) if "--samples" in a else 96
v = next(c for c in json.load(open(cams, encoding="utf-8")) if c["name"] == name)
sc = bpy.context.scene
# the baked-atlas image nodes were added by the prep for baking: unplugged ones are harmless; nothing else is changed
for o in bpy.data.objects:
    if o.type == "MESH":
        o.hide_render = False
t = lambda p: Vector((p[0], -p[2], p[1]))
psi, th = v["yaw"], v["pitch"]
fwd = t((-math.sin(psi) * math.cos(th), math.sin(th), -math.cos(psi) * math.cos(th))).normalized()
up = t((math.sin(psi) * math.sin(th), math.cos(th), math.cos(psi) * math.sin(th))).normalized()
R = fwd.cross(up).normalized()
cd = bpy.data.cameras.new("still"); cd.sensor_fit = "VERTICAL"; cd.angle_y = math.radians(v["fov_v"]); cd.clip_start = 0.05
ob = bpy.data.objects.new("still", cd); sc.collection.objects.link(ob)
m = Matrix((R, up, -fwd)).transposed().to_4x4(); m.translation = t(v["pos"]); ob.matrix_world = m
sc.camera = ob
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = S; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 8; sc.cycles.diffuse_bounces = 4; sc.cycles.glossy_bounces = 4; sc.cycles.transparent_max_bounces = 8
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = v["w"], v["h"], 75
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("STILL_OK", out)

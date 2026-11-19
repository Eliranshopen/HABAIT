"""Make the AI-made GLB (items/glb/<id>.glb, ~500k faces, 4K PNG maps, ~50-70 MB) light enough for the web walk, and preview it.

Run: blender -b --factory-startup -P scripts/blender/optimize_glb.py -- <job_dir> <id> [--faces 90000] [--tex 2048]
Writes walkaround/items/glb/<id>.glb (decimated, JPEG maps) and items/preview/<id>.png (a 3/4 view on white, Cycles),
plus a sidecar json with faces before/after, size in metres as made, bytes.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
JOB, IID = os.path.abspath(a[0]), a[1]
opt = lambda n, d: a[a.index(n) + 1] if n in a else d  # noqa: E731
FACES = int(opt("--faces", "90000"))
TEX = int(opt("--tex", "2048"))
SUF = opt("--suffix", "")   # "_m" = the phone copy (fewer faces, smaller maps)
src = os.path.join(JOB, "items", "glb", IID + ".glb")
out = os.path.join(JOB, "walkaround", "items", "glb", IID + SUF + ".glb")
prev = os.path.join(JOB, "items", "preview", IID + ".png")
os.makedirs(os.path.dirname(out), exist_ok=True)
os.makedirs(os.path.dirname(prev), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
before = sum(len(o.data.polygons) for o in meshes)
for o in meshes:
    n = len(o.data.polygons)
    share = n / before
    want = max(2000, int(FACES * share))
    if n > want:
        md = o.modifiers.new("dec", "DECIMATE")
        md.ratio = want / n
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=md.name)
    for p in o.data.polygons:
        p.use_smooth = True
after = sum(len(o.data.polygons) for o in meshes)
for im in bpy.data.images:
    if im.size[0] > TEX:
        im.scale(TEX, TEX * im.size[1] // im.size[0])
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_image_format="JPEG",
                          export_jpeg_quality=int(opt("--q", "90")), export_yup=True, export_apply=True)
if "--nopreview" in a:
    print("OPT OK", json.dumps({"id": IID + SUF, "faces_before": before, "faces_after": sum(len(o.data.polygons) for o in meshes), "bytes_out": os.path.getsize(out)}))
    raise SystemExit(0)

# preview: 3/4 view, white backdrop, soft light
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
c, r = (lo + hi) / 2, (hi - lo).length / 2
sc = bpy.context.scene
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
yaw = math.radians(float(opt("--view", "-35")))
cam.location = c + Vector((math.sin(yaw) * r * 2.6, -math.cos(yaw) * r * 2.6, r * 1.0))
cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 50
sc.camera = cam
w = bpy.data.worlds.new("w")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
sc.world = w
for k, (az, el, e) in enumerate(((-50, 50, 600), (120, 35, 200))):
    ld = bpy.data.lights.new(f"l{k}", "AREA")
    ld.energy = e * r * r * 4
    ld.size = r * 2
    lo_ = bpy.data.objects.new(f"l{k}", ld)
    A, E = math.radians(az), math.radians(el)
    lo_.location = c + Vector((math.cos(E) * math.sin(A), -math.cos(E) * math.cos(A), math.sin(E))) * r * 3
    lo_.rotation_euler = (c - lo_.location).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(lo_)
sc.render.engine = "CYCLES"
sc.cycles.samples = 48
sc.cycles.use_denoising = True
sc.cycles.device = "CPU"
sc.render.resolution_x = sc.render.resolution_y = 768
sc.view_settings.view_transform = "AgX"
sc.render.filepath = prev
bpy.ops.render.render(write_still=True)
info = {"id": IID, "faces_before": before, "faces_after": after, "size_m_as_made": [round(v, 3) for v in (hi - lo)],
        "bytes_in": os.path.getsize(src), "bytes_out": os.path.getsize(out), "tex": TEX}
json.dump(info, open(prev + ".json", "w"), indent=1)
print("OPT OK", json.dumps(info))

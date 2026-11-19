"""Render one image-to-3D result as made (no decimation) in a fixed studio: the same camera angle, light and backdrop for every model.

Run: blender -b --factory-startup -P scripts/blender/compare_render.py -- <glb> <out.png> [--view -35] [--res 900]
Prints CMP OK with the face count, the texture sizes and the bounding box.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
GLB, OUT = os.path.abspath(a[0]), os.path.abspath(a[1])
opt = lambda n, d: a[a.index(n) + 1] if n in a else d  # noqa: E731
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
faces = sum(len(o.data.polygons) for o in meshes)
texs = sorted({tuple(im.size) for im in bpy.data.images if im.size[0]})
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
c, r = (lo + hi) / 2, (hi - lo).length / 2
sc = bpy.context.scene
# a floor that catches the shadow, light warm-grey backdrop
bpy.ops.mesh.primitive_plane_add(size=r * 40, location=(c.x, c.y, lo.z))
fl = bpy.context.active_object
fm = bpy.data.materials.new("floor"); fm.use_nodes = True
fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.78, 0.76, 0.73, 1)
fm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
fl.data.materials.append(fm)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
yaw = math.radians(float(opt("--view", "-35")))
cam.location = c + Vector((math.sin(yaw) * r * 2.7, -math.cos(yaw) * r * 2.7, r * 0.9))
cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 50
sc.camera = cam
w = bpy.data.worlds.new("w"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.85, 0.84, 0.82, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
sc.world = w
for k, (az, el, e, size) in enumerate(((-55, 45, 260, 2.2), (110, 30, 80, 3.0))):   # soft key from the front-left, a fill behind
    ld = bpy.data.lights.new(f"l{k}", "AREA"); ld.energy = e * r * r; ld.size = r * size
    lo_ = bpy.data.objects.new(f"l{k}", ld)
    A, E = math.radians(az), math.radians(el)
    lo_.location = c + Vector((math.cos(E) * math.sin(A), -math.cos(E) * math.cos(A), math.sin(E))) * r * 3
    lo_.rotation_euler = (c - lo_.location).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(lo_)
sc.render.engine = "CYCLES"
sc.cycles.samples = 64
sc.cycles.use_denoising = True
sc.cycles.device = "CPU"
sc.render.resolution_x = sc.render.resolution_y = int(opt("--res", "900"))
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
info = {"glb": GLB, "faces": faces, "textures": texs, "size_m": [round(v, 3) for v in (hi - lo)], "bytes": os.path.getsize(GLB)}
json.dump(info, open(OUT + ".json", "w"), indent=1)
print("CMP OK", json.dumps(info))

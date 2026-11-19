"""Step 21 ($0) - the generated models (19_fal_3d.py) made light for the browser: decimated to ~--faces triangles,
textures <= 1024, re-exported as <id>.web.glb (geometry simplified, look kept). Blender, CPU.
Usage: blender -b --factory-startup -P 21_decimate.py -- <in.glb> <out.glb> [--faces 40000]"""
import sys, bpy
a = sys.argv[sys.argv.index("--") + 1:]; src, dst = a[0], a[1]; F = int(a[a.index("--faces") + 1]) if "--faces" in a else 40000
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
ms = [o for o in bpy.data.objects if o.type == "MESH"]; n = sum(len(o.data.polygons) for o in ms)
for o in ms:
    if n > F:
        d = o.modifiers.new("dec", "DECIMATE"); d.ratio = max(0.02, F / n)
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier="dec")
for im in bpy.data.images:
    if im.size[0] > 1024: im.scale(1024, int(1024 * im.size[1] / im.size[0]))
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=86)
print("DECIMATE_OK", n, "->", sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"))

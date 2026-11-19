"""Export the house (architecture, furniture, decor; no site planting, no lights, no cameras) to GLB.

Run: blender -b scene/hatzav.blend --python-exit-code 1 -P scripts/blender/export_glb.py -- <out.glb>
Procedural materials (tiles, paint) export as their base colour; image textures export as images.
"""
import os
import sys

import bpy

out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
keep = {"01_Architecture", "01b_Derived_Pergola", "02_Furniture", "03_Decor"}
bpy.ops.object.select_all(action="DESELECT")
n = 0
for c in bpy.data.collections:
    if c.name in keep:
        for o in c.all_objects:
            if o.type in ("MESH", "EMPTY"):
                o.select_set(True)
                n += 1
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_apply=True,
                          export_lights=False, export_cameras=False, export_yup=True, export_image_format="JPEG",
                          export_jpeg_quality=85)
print("GLB OK", out, n, "objects", os.path.getsize(out), "bytes")

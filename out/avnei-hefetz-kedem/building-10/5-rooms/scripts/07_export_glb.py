"""Step 07 ($0) - export the scene to glTF binary: scene/apartment.glb (architecture + fixtures + furniture + balcony; no ground, trees, lights).
Run: blender -b scene/apartment.blend --python 07_export_glb.py -- <job root>"""
import sys
from pathlib import Path
import bpy
root = Path(sys.argv[sys.argv.index("--") + 1])
keep = {"01_Architecture", "02_Fixtures", "03_Furniture"}
for o in bpy.data.objects:
    o.select_set(False)
for c in bpy.data.collections:
    if c.name in keep:
        for o in c.all_objects:
            o.select_set(True)
for n in ("balcony_deck",) + tuple(o.name for o in bpy.data.objects if o.name.startswith(("parapet_", "rail_", "handrail_"))):
    if n in bpy.data.objects:
        bpy.data.objects[n].select_set(True)
out = root / "scene" / "apartment.glb"
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", use_selection=True, export_apply=True,
                          export_image_format="JPEG", export_jpeg_quality=80, export_yup=True)
print("GLB", out, out.stat().st_size)

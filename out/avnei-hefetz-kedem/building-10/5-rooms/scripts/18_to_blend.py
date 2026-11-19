"""Step 18 ($0) - the walk's own scene (scene/apartment-look.glb, exported by 11_export_glb.mjs from the browser, with the
look of Eliran's pictures) as a .blend for the day-night-keyframes skill's walk bake (mode B, walk_bake.py --stage prep).

- furniture and accessories carry walk_live (glTF extras on their group): every mesh under them gets walk_live, so the
  skill keeps their shadows in the bake but draws them live in the browser (the swap circles keep working);
- the floors (marble main floor, wet-room tiles) are named Floor_public / Floor_hall ...: the skill bakes them into their
  own light-only atlas, so the browser keeps the marble's gloss and can swap the finish under the baked light;
- display: Khronos PBR Neutral (his pictures are clean white; AgX greys them). Geometry and materials untouched.
Usage: blender -b --factory-startup -P 18_to_blend.py -- <in.glb> <out.blend>
"""
import sys

import bpy

src, out = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

live = 0
for o in bpy.data.objects:
    p, flag = o, False
    while p is not None:
        if p.get("walk_live"):
            flag = True
            break
        p = p.parent
    if flag and o.type == "MESH":
        o["walk_live"] = 1
        live += 1

FLOORS = ["Floor_public", "Floor_hall", "Floor_bedroom", "Floor_saferoom"]
floors = [o for o in bpy.data.objects if o.type == "MESH" and not o.get("walk_live")
          and any(s.material and s.material.name.split(".")[0] in ("tile80", "tile60", "parquet") for s in o.material_slots)]
for o, n in zip(floors, FLOORS):
    o.name = n

s = bpy.context.scene
if s.world is None:   # the imported glTF brings no world; the skill's relight.py sets its sky on the scene's world
    s.world = bpy.data.worlds.new("World")
# the concrete slabs above and below the apartment are never seen from inside: not worth atlas space
gone = [o for o in bpy.data.objects if o.type == "MESH" and any(sl.material and sl.material.name.split(".")[0] == "slab" for sl in o.material_slots)]
for o in gone:
    bpy.data.objects.remove(o, do_unlink=True)
print("TO_BLEND dropped slabs", len(gone))

# the browser builds every surface from separate triangles: welded here, or the bake's UV unwrap makes one island per
# triangle (seams and smears on every wall). Ceilings face down (in the browser they are two-sided planes facing up).
import bmesh
welded = flipped = 0
for o in [o for o in bpy.data.objects if o.type == "MESH" and not o.get("walk_live")]:
    if o.data.users > 1:
        o.data = o.data.copy()
    bm = bmesh.new(); bm.from_mesh(o.data)
    n0 = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005); welded += n0 - len(bm.verts)
    mats = {sl.material.name.split(".")[0] for sl in o.material_slots if sl.material}
    if "ceiling" in mats:   # the ceiling plane faces up in the browser (two-sided there); its room side must face down here
        up = [f for f in bm.faces if f.normal.z > 0.5]
        if up: bmesh.ops.reverse_faces(bm, faces=up); flipped += len(up)
    bm.to_mesh(o.data); bm.free(); o.data.update()
print("TO_BLEND welded verts", welded, "ceilings turned down", flipped)
# the ceiling spots of his pictures, as one soft area lamp per room rectangle (relight.py scales them by the key's `interior`)
import json as _j, os as _o
G = _j.load(open(_o.path.join(_o.path.dirname(_o.path.abspath(src)), "..", "geometry", "geometry.json"), encoding="utf-8"))
H = G["meta"]["ceiling_m"]; nl = 0
for r in G["rooms"]:
    for a_ in r["rects"]:
        w_, d_ = a_[2] - a_[0], a_[3] - a_[1]
        if w_ < 0.6 or d_ < 0.6: continue
        L = bpy.data.lights.new("Lamp_%s_%d" % (r["id"], nl), "AREA"); L.shape = "RECTANGLE"; L.size, L.size_y = w_ * 0.6, d_ * 0.6
        L.energy = 45.0 * w_ * d_; L.color = (1.0, 0.95, 0.88)
        ob = bpy.data.objects.new(L.name, L); ob.location = ((a_[0] + a_[2]) / 2, -((a_[1] + a_[3]) / 2) * -1, H - 0.03)
        bpy.context.scene.collection.objects.link(ob); nl += 1
print("TO_BLEND room lamps", nl)
s.render.engine = "CYCLES"
try:
    s.view_settings.view_transform = "Khronos PBR Neutral"
except TypeError:
    s.view_settings.view_transform = "Standard"
s.view_settings.look = "None"
print("TO_BLEND live meshes", live, "floors", [o.name for o in floors[:4]], "objects", len(bpy.data.objects))
bpy.ops.wm.save_as_mainfile(filepath=out)
print("TO_BLEND_OK")

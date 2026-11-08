# Read-only probe (board apartment-3d, realism step): what materials does the live scene.blend carry? Per material:
# users, whether it has image textures (and whether those files exist), base colour. Never saves the .blend.
import bpy, os, json
out = []
for m in bpy.data.materials:
    if m.users == 0:
        continue
    imgs = []
    col = None
    if m.use_nodes and m.node_tree:
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                fp = bpy.path.abspath(n.image.filepath) if n.image.filepath else ""
                imgs.append({"name": n.image.name, "file": fp, "exists": (os.path.isfile(fp) if fp else n.image.packed_file is not None), "packed": n.image.packed_file is not None, "size": list(n.image.size)})
            if n.type == "BSDF_PRINCIPLED":
                col = [round(c, 3) for c in n.inputs["Base Color"].default_value[:3]]
    out.append({"material": m.name, "users": m.users, "images": imgs, "base": col})
obs = {}
for ob in bpy.data.objects:
    if ob.type == "MESH":
        for s in ob.material_slots:
            if s.material:
                obs.setdefault(s.material.name, []).append(ob.name)
for o in out:
    o["objects_sample"] = sorted(obs.get(o["material"], []))[:4]
    o["objects"] = len(obs.get(o["material"], []))
rep = {"blend": bpy.data.filepath, "materials": len(out), "with_images": sum(1 for o in out if o["images"]),
       "missing_images": sorted({i["file"] for o in out for i in o["images"] if not i["exists"]}), "list": sorted(out, key=lambda o: -o["objects"])}
json.dump(rep, open(r"C:\RnD\development\tasks\apartment-3d\logs\probe-blend-materials.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("PROBE materials", rep["materials"], "with images", rep["with_images"], "missing", len(rep["missing_images"]))

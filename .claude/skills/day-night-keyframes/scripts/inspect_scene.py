"""List the lighting of a .blend (read-only: never saves). Run:
blender -b --factory-startup <scene.blend> -P inspect_scene.py -- <out.json>"""
import bpy, json, sys

out = sys.argv[sys.argv.index('--') + 1]
sc = bpy.context.scene
r = {"engine": sc.render.engine, "view": sc.view_settings.view_transform, "look": sc.view_settings.look,
     "exposure": sc.view_settings.exposure, "samples": getattr(sc.cycles, 'samples', None), "lights": [], "world": [], "emissive": []}
for o in sc.objects:
    if o.type == 'LIGHT':
        L = o.data
        r["lights"].append({"name": o.name, "type": L.type, "energy": L.energy, "color": list(L.color),
                            "rot_deg": [round(a * 57.2958, 2) for a in o.rotation_euler], "loc": [round(v, 2) for v in o.location],
                            "angle": getattr(L, 'angle', None), "collections": [c.name for c in o.users_collection]})
w = sc.world
if w and w.use_nodes:
    for n in w.node_tree.nodes:
        d = {"name": n.name, "type": n.bl_idname}
        if n.bl_idname == 'ShaderNodeBackground':
            d["strength"] = n.inputs['Strength'].default_value
        if n.bl_idname == 'ShaderNodeTexEnvironment' and n.image:
            d["image"] = n.image.filepath
        r["world"].append(d)
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.bl_idname == 'ShaderNodeEmission' or (n.bl_idname == 'ShaderNodeBsdfPrincipled' and n.inputs['Emission Strength'].default_value > 0):
            s = n.inputs['Strength'].default_value if n.bl_idname == 'ShaderNodeEmission' else n.inputs['Emission Strength'].default_value
            r["emissive"].append({"material": m.name, "node": n.name, "strength": s, "users": m.users})
json.dump(r, open(out, 'w'), indent=1)
print("INSPECT_OK", len(r["lights"]), "lights")

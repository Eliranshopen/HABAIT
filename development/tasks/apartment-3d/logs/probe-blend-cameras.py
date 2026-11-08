# Read-only probe (realism spike): the scene's pano cameras (CAM_*), type, panorama mode, location, rotation, resolution.
import bpy, json, math
out = []
for ob in bpy.data.objects:
    if ob.type == "CAMERA":
        c = ob.data
        out.append({"name": ob.name, "type": c.type, "pano": getattr(c, "panorama_type", None) or getattr(getattr(c, "cycles", None), "panorama_type", None),
                    "loc": [round(v, 4) for v in ob.matrix_world.translation], "rot_deg": [round(math.degrees(v), 2) for v in ob.matrix_world.to_euler()],
                    "forward": [round(v, 4) for v in (ob.matrix_world.to_3x3() @ __import__("mathutils").Vector((0, 0, -1)))]})
sc = bpy.context.scene
rep = {"cameras": out, "res": [sc.render.resolution_x, sc.render.resolution_y], "engine": sc.render.engine}
json.dump(rep, open(r"C:\RnD\development\tasks\apartment-3d\logs\probe-blend-cameras.json", "w"), indent=1)
print("PROBE cameras", len(out))

"""Put the AI-made GLB pieces (step 16) in the scene in place of the box-built ones, and record where they went.

Each piece is scaled uniformly to the old piece's footprint ('long') or height ('height'), stood on the old piece's floor level
(or hung from its top, `hang`), centred on it and turned by `yaw` degrees about Z — or turned to FACE a point (a chair toward its
table). The model's front is -Y as imported (verified on the sofa, 2026-11-17). The old objects are hidden, never deleted.
Writes items/placements.json (Blender metres and the three.js frame) so the web walk places each piece exactly the same.
"""
import json
import math
import os

import bpy
from mathutils import Vector


def P(prefixes, fit="long", yaw=0.0, each=False, hang=False, face=None, category=None, room=None, he=None, en=None):
    return dict(prefixes=prefixes, fit=fit, yaw=yaw, each=each, hang=hang, face=face, category=category, room=room, he=he, en=en)


CH = ["D_d-chair-n1_", "D_d-chair-n2_", "D_d-chair-s1_", "D_d-chair-s2_", "D_d-chair-w_", "D_d-chair-e_"]
ST = ["K_k-stool-1_", "K_k-stool-2_", "K_k-stool-3_", "K_k-stool-4_"]
PLACE = {
    "sofa_modular": P(["L_sofa_", "L_pillow_", "L_throw"], yaw=180.0, category="sofa", room="living", he="ספה מודולרית מפשתן", en="modular linen sofa"),
    "lounge_chair": P(["L_rattan_"], category="armchair", room="living", he="כורסת חבל קלועה", en="woven cord lounge chair", face="L_table_top"),
    "rattan_pendant": P(["D_rattan_0", "D_rattan_1"], fit="height", each=True, hang=True, category="pendant", room="dining", he="מנורת ראטן תלויה", en="rattan pendant"),
    "dining_chair": P(CH, each=True, face="D_table_top", category="dining_chair", room="dining", he="כיסא אוכל מרופד", en="upholstered dining chair"),
    "dining_table": P(["D_table_"], category="dining_table", room="dining", he="שולחן אוכל מאלון", en="oak dining table"),
    "bar_stool": P(ST, each=True, face="K_island_top", category="bar_stool", room="kitchen", he="כיסא בר", en="counter stool"),
    "coffee_table": P(["L_table_"], category="coffee_table", room="living", he="שולחן קפה עגול", en="round coffee table"),
    "mushroom_lamp": P(["L_lamp_base", "L_lamp_globe"], fit="height", category="lamp", room="living", he="מנורת שולחן", en="table lamp"),
    "wall_sconce": P(["L_sconce_disc", "L_sconce_globe"], yaw=-90.0, category="sconce", room="living", he="מנורת קיר", en="wall sconce"),
    "vase_branches": P(["L_console_vase", "L_console_branch"], fit="height", category="decor", room="living", he="אגרטל עם ענפים", en="vase with branches"),
    "ribbed_vase": P(["D_shelf_vase_0"], fit="height", category="decor", room="dining", he="אגרטל קרמיקה", en="ribbed vase"),
    "globe_lamp": P(["D_shelf_vase_1"], fit="height", category="lamp", room="dining", he="מנורת כדור", en="globe lamp"),
    "stone_bowl": P(["D_bowl", "D_apple"], category="decor", room="dining", he="קערת אבן", en="stone bowl"),
    "paper_pendant": P(["K_pendant_0", "K_pendant_1"], fit="height", each=True, hang=True, category="pendant", room="kitchen", he="מנורת נייר", en="paper pendant"),
    "kitchen_props": P(["K_jug"], fit="height", category="decor", room="kitchen", he="קרשי חיתוך וקנקן", en="boards and carafe"),
    "kids_bed": P(["S_bed_base", "S_bed_foot", "S_headboard", "S_mattress", "S_duvet", "S_pillow"], category="bed", room="saferoom", he="מיטת ילדים מרופדת", en="upholstered single bed"),
    "nightstand": P(["B_night_0", "B_night_1"], each=True, yaw=-90.0, category="nightstand", room="bedroom", he="שידת לילה", en="nightstand"),
    "paper_lantern": P(["S_paper_lantern"], hang=True, category="pendant", room="saferoom", he="מנורת נייר אובלית", en="paper lantern"),
    "kids_rug": P(["S_rug"], category="rug", room="saferoom", he="שטיח צמר", en="wool rug"),
}


def world_bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def import_glb(path, coll):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(os.path.basename(path) + "_root", None)
    coll.objects.link(root)
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
        if o.parent is None:
            o.parent = root
    return root, [o for o in new if o.type == "MESH"]


def fit(root, meshes, lo, hi, yaw, how, hang):
    root.rotation_euler = (0, 0, math.radians(yaw))
    bpy.context.view_layer.update()
    a, b = world_bbox(meshes)
    size, target = b - a, hi - lo
    s = target.z / size.z if how == "height" else max(target.x, target.y) / max(size.x, size.y)
    root.scale = (s, s, s)
    bpy.context.view_layer.update()
    a, b = world_bbox(meshes)
    c_new, c_old = (a + b) / 2, (lo + hi) / 2
    dz = (hi.z - b.z) if hang else (lo.z - a.z)
    root.location += Vector((c_old.x - c_new.x, c_old.y - c_new.y, dz))
    bpy.context.view_layer.update()
    return s, *world_bbox(meshes)


def place(root_dir, only=None, yaw_override=None):
    coll = bpy.data.collections.get("02b_AI_Items") or bpy.data.collections.new("02b_AI_Items")
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    done, rec = [], []
    for iid, spec in PLACE.items():
        if only and iid not in only:
            continue
        web = os.path.join(root_dir, "walkaround", "items", "glb", iid + ".glb")   # the slimmed copy (optimize_glb.py)
        glb = web if os.path.exists(web) else os.path.join(root_dir, "items", "glb", iid + ".glb")
        if not os.path.exists(glb):
            print("PLACE skip (no glb)", iid)
            continue
        prefixes = spec["prefixes"]
        old = [o for o in bpy.data.objects if o.name.startswith(tuple(prefixes))]
        groups = [[o for o in old if o.name.startswith(p)] for p in prefixes] if spec["each"] else [old]
        for n, g in enumerate(groups):
            g = list({o.name: o for o in g + [c for o in g for c in o.children_recursive]}.values())   # imported models: an empty with meshes under it
            g_m = [o for o in g if o.type == "MESH"]
            if not g_m:
                continue
            lo, hi = world_bbox(g_m)
            yaw = (yaw_override or {}).get(iid, spec["yaw"])
            if spec["face"] and spec["face"] in bpy.data.objects:   # turn the front (-Y) toward the target
                t_lo, t_hi = world_bbox([bpy.data.objects[spec["face"]]])
                d = (t_lo + t_hi) / 2 - (lo + hi) / 2
                yaw = math.degrees(math.atan2(d.x, -d.y))
            root, meshes = import_glb(glb, coll)
            root["walk_live"] = iid
            for m_ in meshes:
                m_["walk_live"] = iid   # walk_bake: casts light and shadow in the bake, drawn live in the walk
            s, a, b = fit(root, meshes, lo, hi, yaw, spec["fit"], spec["hang"])
            for o in g:
                o.hide_render = True
                o.hide_viewport = True
            uid = iid if len(groups) == 1 else f"{iid}_{n}"
            c = (a + b) / 2
            rec.append({"id": uid, "src": iid, "category": spec["category"], "room": spec["room"], "name_he": spec["he"], "name_en": spec["en"],
                        "yaw": round(yaw, 2), "fit": spec["fit"], "hang": spec["hang"], "scale": round(s, 5),
                        # three.js frame: x = X, y = Z, z = -Y (metres); pos = footprint centre on the floor, or the top for a hanging piece
                        "pos": [round(c.x, 4), round(b.z if spec["hang"] else a.z, 4), round(-c.y, 4)],
                        "size": [round(b.x - a.x, 4), round(b.z - a.z, 4), round(b.y - a.y, 4)]})
            print("PLACE", uid, "scale %.3f" % s, "yaw %.0f" % yaw, "size_cm", [round((b - a)[k] * 100) for k in range(3)],
                  "old_cm", [round((hi - lo)[k] * 100) for k in range(3)])
            done.append(uid)
    json.dump({"note": "written by place_items.py while building scene/hatzav_v2.blend; read by 18_items_registry.py", "pieces": rec},
              open(os.path.join(root_dir, "items", "placements.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    return done

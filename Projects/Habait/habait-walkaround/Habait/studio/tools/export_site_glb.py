"""export_site_glb.py — the built site (tower mass, OSM neighbours, orthophoto quad, the floor-16 apartment shell) as ONE glb
plus nodes.json for a real-time flyover (habait-89's three.js draft, 2026-11-02). Run inside Blender:
  blender -b --factory-startup -P tools/export_site_glb.py -- --project <dir> --out <dir>/renders/site3d [--hide STUDIO_sea]
Axes: Blender's plan-world is X right / Y up-the-plan / Z up, metres, the unit's floor at z 0 (ground at ground_offset_cm);
glTF export converts to Y-up (glTF x = X, y = Z, z = -Y). nodes.json keeps BOTH frames for every node."""
import bpy, sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_shots as rs

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(n, d=None):
    return argv[argv.index(n) + 1] if n in argv else d
P = arg("--project"); OUT = arg("--out", os.path.join(P, "renders", "site3d")); HIDE = (arg("--hide", "") or "").split(",")
os.makedirs(OUT, exist_ok=True)
J = lambda *p: json.load(open(os.path.join(P, *p), encoding="utf8"))

bpy.ops.wm.open_mainfile(filepath=os.path.join(P, "renders", "scene.blend"))
site = J("derived", "site.json"); shots = J("derived", "shots.pano-nodes.json"); plan = J("derived", "plan.json")
tf = J("derived", "tower-footprint.json"); site.setdefault("tower", {})["footprint_plan_cm"] = tf.get("polygon_cm") or tf.get("tower_footprint_cm")
site["_tower_mass_obj"] = os.path.join(P, "derived", "tower-mass.obj")
site["site_key_buildings"] = J("derived", "site-key.json").get("buildings") or []
ortho = os.path.join(P, "derived", "orthophoto.png")
if os.path.exists(ortho):
    site["_orthophoto"] = ortho
ground_m = float(shots.get("ground_offset_cm") or site.get("ground_offset_cm") or -5120) / 100.0
ceiling_m = float(plan.get("plan_meta", {}).get("ceiling_height_cm", 290)) / 100.0
rs.build_site(site, shots, plan, ground_m, ceiling_m)
rs.design_massing()

# what goes out: everything STUDIO_* (site + tower mass) and the apartment's meshes (walls, floors, glazing, doors, furniture
# masses), minus the 160 km ground slab (the orthophoto quad is the ground), minus --hide names
keep = []
for ob in bpy.data.objects:
    if ob.type != "MESH":
        continue
    n = ob.name
    if n == "STUDIO_ground" or any(h and h.lower() in n.lower() for h in HIDE):
        ob.hide_render = True; ob.hide_set(True)
        continue
    if not n.startswith(("STUDIO_", "TERRAIN_")):  # the apartment shell (walls, floors, glazing, doors, furniture masses from scene.blend)
        ob.name = "APT846_" + n  # habait-89 (2026-11-02): a recognizable prefix to highlight the unit on the facade
    keep.append(ob)
bpy.ops.object.select_all(action="DESELECT")
for ob in keep:
    ob.select_set(True)
glb = os.path.join(OUT, "site.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_image_format="JPEG", export_jpeg_quality=85, export_materials="EXPORT", export_texcoords=True, export_normals=True, export_cameras=False, export_lights=False)

# the nodes: exterior 360 points (shots.pano-nodes.json) and the interior pano cameras (tour cameras.json, plan px -> world metres)
to_glb = lambda p: [round(p[0], 3), round(p[2], 3), round(-p[1], 3)]
nodes = []
for s in shots["shots"]:
    pos, look = s["pos"], s["look"]
    yaw_world = math.degrees(math.atan2(look[0] - pos[0], look[1] - pos[1])) % 360  # bearing of u=0.5, clockwise from +Y (plan up)
    nodes.append({"id": s["id"], "kind": "exterior", "pos_world": pos, "pos_glb": to_glb(pos), "centre_yaw_deg_from_plus_y_cw": round(yaw_world, 2),
                  "pano_clay": f"renders/clay-pano-ortho/{s['id']}.png", "pano": f"../../../../../tour360/apartments/apt846/_local/panos-ext/{s['id']}.webp"})
HABAIT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(P)))))  # <P>/../../.. = Habait/studio → Habait
cams_path = os.path.join(HABAIT, "tour360", "apartments", "apt846", "cameras.json")
if os.path.exists(cams_path):
    cams = json.load(open(cams_path, encoding="utf8"))
    ppc = float(cams["plan"]["pxPerCm"])
    for c in cams["scenes"]:
        x, y = c["at"]; lx, ly = c["lookAt"]
        pos = [x / ppc / 100.0, -y / ppc / 100.0, float(cams.get("eye_m", 1.6))]
        yaw = math.degrees(math.atan2(lx - x, -(ly - y))) % 360
        nodes.append({"id": c["id"], "kind": "interior", "pos_world": [round(v, 3) for v in pos], "pos_glb": to_glb(pos), "centre_yaw_deg_from_plus_y_cw": round(yaw, 2),
                      "pano": f"../../../../../tour360/apartments/apt846/panos/balanced/{c['asset']}.webp"})
entry = shots.get("entry") or (J("derived", "shots.json").get("entry") if os.path.exists(os.path.join(P, "derived", "shots.json")) else None) or {}  # the terrace opening lives in the flight shots file
hot = None
if entry.get("centre_cm"):
    hot = [entry["centre_cm"][0] / 100.0, -entry["centre_cm"][1] / 100.0, 1.0]
json.dump({"frames": {"world": "plan-world: X right, Y up the plan sheet, Z up, metres, the unit's floor at z 0; ground at %.2f" % ground_m,
                      "glb": "glTF Y-up: x = X, y = Z, z = -Y (Blender exporter)", "yaw": "bearing of the equirect centre column (u = 0.5), degrees clockwise from +Y (plan up); north is at plan bearing %s" % site.get("north_deg")},
           "origin": site.get("origin"), "unit_centre_world": shots.get("unit_centre_m"), "apartment_hotspot_world": hot, "apartment_hotspot_glb": to_glb(hot) if hot else None,
           "glb": "site.glb", "nodes": nodes}, open(os.path.join(OUT, "nodes.json"), "w", encoding="utf8"), indent=1)
print(f"exported {glb} ({os.path.getsize(glb) // 1048576} MB, {len(keep)} meshes) + nodes.json ({len(nodes)} nodes)")

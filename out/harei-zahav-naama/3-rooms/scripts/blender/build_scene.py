"""Build the Hatzav house as an editable Blender scene from geometry/geometry.json.

Run:  blender -b --factory-startup -P scripts/blender/build_scene.py -- <job root> [--no-furniture] [--no-site]
Writes scene/hatzav.blend (collections: 01_Architecture, 02_Furniture, 03_Decor, 04_Lighting, 05_Cameras, 06_Site)
and scene/build-report.json. Deterministic: same geometry.json -> same scene.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hz_lib as L  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
ROOT = os.path.abspath(argv[0])
NO_FURN = "--no-furniture" in argv
NO_SITE = "--no-site" in argv
L.ASSETS = os.path.join(ROOT, "assets")
geo = json.load(open(os.path.join(ROOT, "geometry", "geometry.json"), encoding="utf-8"))
HT = {k: v["v"] for k, v in geo["heights"].items()}
H = HT["ceiling_cm"]
FOOT = geo["footprint"]
ROOMS = {r["id"]: r for r in geo["rooms"]}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
C_ARCH = L.coll("01_Architecture")
C_FURN = L.coll("02_Furniture")
C_DECO = L.coll("03_Decor")
C_LIGHT = L.coll("04_Lighting")
C_CAM = L.coll("05_Cameras")
C_SITE = L.coll("06_Site")
C_DERIVED = L.coll("01b_Derived_Pergola", C_ARCH)

# ------------------------------------------------------------------ materials
M = {}
M["paint"] = L.paint("wall_limewash_greige", (0.75, 0.71, 0.65), 0.92, grain=0.2)  # renders: warm greige limewash
M["ceiling"] = L.paint("ceiling_white", (0.84, 0.84, 0.82), 0.95, grain=0.05)
M["plaster"] = L.pbr("exterior_plaster_white", "painted_plaster_wall", scale=2.0, tint=(0.93, 0.92, 0.89), bump=0.6)
M["floor"] = L.tiles("floor_stone_120", 1.2, 1.2, (0.80, 0.77, 0.71), grout=(0.70, 0.67, 0.62), rough=0.35, vary=0.008, gap=0.002, veins=0.04)  # renders: large cream stone-look tiles
M["bath_tile"] = L.tiles("bath_stone_60x120", 0.6, 1.2, (0.80, 0.74, 0.64), grout=(0.70, 0.65, 0.57), rough=0.4, vary=0.012, gap=0.002, veins=0.06)  # renders: beige stone
M["sill"] = L.flat("sill_stone", (0.72, 0.70, 0.66), 0.35)
M["alu"] = L.flat("aluminium_anthracite", (0.045, 0.048, 0.052), 0.42, 0.85)
M["glass"] = L.glass()
M["door_white"] = L.flat("door_white_lacquer", (0.80, 0.79, 0.76), 0.38)
M["door_steel"] = L.flat("safe_room_door_steel", (0.74, 0.74, 0.71), 0.45, 0.3)
M["door_entrance"] = L.flat("entrance_door_anthracite", (0.06, 0.065, 0.07), 0.35, 0.6)
M["black_metal"] = L.flat("black_metal", (0.02, 0.02, 0.022), 0.38, 1.0)
M["steel"] = L.flat("brushed_steel", (0.62, 0.62, 0.63), 0.28, 1.0)
M["white_metal"] = L.flat("white_powder_coat", (0.86, 0.86, 0.84), 0.5, 0.1)
M["deck"] = L.pbr("deck_timber", "fine_grained_wood", scale=1.4, tint=(0.95, 0.86, 0.72), rough_mul=1.15)
M["deck_dark"] = L.flat("deck_substructure", (0.05, 0.045, 0.04), 0.8)
M["grass"] = L.pbr("lawn", "leafy_grass", scale=2.2, tint=(0.80, 0.95, 0.70), bump=1.0)
M["paving"] = L.flat("paving_concrete", (0.55, 0.54, 0.51), 0.8)
M["concrete"] = L.flat("foundation_concrete", (0.48, 0.47, 0.45), 0.85)
M["roof"] = L.flat("roof_membrane", (0.70, 0.70, 0.68), 0.8)
M["spot"] = L.emit("downlight_glow", (1.0, 0.86, 0.68), 6.0)
MATS = M


def inside_room(u, v, rid):
    return L.inside_poly(u, v, ROOMS[rid]["poly"])


# ------------------------------------------------------------------ walls: one clean mesh on the grid
WALL_SILL_DROP = 3  # the stone sill slab sits in the opening, its top at the sill height
solids = [(*w["box"], -1, H) for w in geo["walls"]]
voids = []
for o in geo["openings"]:
    z0 = o["sill_cm"] - (WALL_SILL_DROP if o["kind"] == "window" else 0)
    voids.append((*o["box"], z0, o["head_cm"]))


def wall_class(c, axis, sign):
    u, v, z = c
    if axis == 2:
        if z > H or z < -1:
            return None  # top under the roof slab, bottom on the foundation: no face
        if sign > 0 and z < 6:
            return 3  # threshold under a door: floor finish
        return 0
    if not L.inside_poly(u, v, FOOT):
        return 1
    if inside_room(u, v, "bath"):
        return 2
    return 0


def voxel(name, solids_, voids_, coll_, mats, classify):
    """voxel_mesh with face skipping (classify -> None)"""
    import bmesh
    ob = L.voxel_mesh(name, solids_, voids_, coll_, mats + [M["paving"]], lambda c, a, s: (len(mats) if classify(c, a, s) is None else classify(c, a, s)))
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    kill = [f for f in bm.faces if f.material_index == len(mats)]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.materials.pop(index=len(mats))
    L.uv_box(ob.data)
    return ob


walls = voxel("Walls", solids, voids, C_ARCH, [M["paint"], M["plaster"], M["bath_tile"], M["floor"]], wall_class)

# ------------------------------------------------------------------ floors, foundation, roof
for r in geo["rooms"]:
    L.prism(f"Floor_{r['id']}", r["poly"], -1, 0, C_ARCH, [M["bath_tile"] if r["id"] == "bath" else M["floor"]])
L.prism("Foundation", FOOT, -45, -1.2, C_ARCH, [M["concrete"]])
L.prism("Roof_Slab", FOOT, H, H + HT["roof_slab_cm"], C_ARCH, [M["ceiling"], M["plaster"], M["roof"]],
        face_mat=lambda n: 0 if n.z < -0.5 else (2 if n.z > 0.5 else 1))
PT = 15
edges = []
n = len(FOOT)
cx = sum(p[0] for p in FOOT) / n
for i in range(n):
    (u0, v0), (u1, v1) = FOOT[i], FOOT[(i + 1) % n]
    if u0 == u1:  # edge along v: thicken toward the inside
        mid = ((u0 + 1), (v0 + v1) / 2)
        s = 1 if L.inside_poly(*mid, FOOT) else -1
        edges.append((min(u0, u0 + s * PT), min(v0, v1), max(u0, u0 + s * PT), max(v0, v1), H + HT["roof_slab_cm"], HT["parapet_top_cm"]))
    else:
        mid = ((u0 + u1) / 2, v0 + 1)
        s = 1 if L.inside_poly(*mid, FOOT) else -1
        edges.append((min(u0, u1), min(v0, v0 + s * PT), max(u0, u1), max(v0, v0 + s * PT), H + HT["roof_slab_cm"], HT["parapet_top_cm"]))
voxel("Roof_Parapet", edges, [], C_ARCH, [M["plaster"]],
      lambda c, a, s: None if (a == 2 and s < 0) else 0)


# ------------------------------------------------------------------ openings
def opening_frame(o):
    u0, v0, u1, v1 = o["box"]
    along_u = (u1 - u0) > (v1 - v0)
    a0, a1 = (u0, u1) if along_u else (v0, v1)
    t0, t1 = (v0, v1) if along_u else (u0, u1)
    probe = ((u0 + u1) / 2, v0 - 3) if along_u else (u0 - 3, (v0 + v1) / 2)
    out_low = not L.inside_poly(*probe, FOOT)  # the outside is on the low-coordinate side
    return along_u, a0, a1, t0, t1, out_low


def bx(name, along_u, a0, a1, t0, t1, z0, z1, coll_, mat, **kw):
    if along_u:
        return L.box(name, a0, t0, a1, t1, z0, z1, coll_, mat, **kw)
    return L.box(name, t0, a0, t1, a1, z0, z1, coll_, mat, **kw)


def make_glazing(o):
    along_u, a0, a1, t0, t1, out_low = opening_frame(o)
    sill, head = o["sill_cm"], o["head_cm"]
    slider = o["kind"] == "sliding_door"
    d = 1 if out_low else -1  # direction from outside to inside along t
    t_out = t0 if out_low else t1
    t_in = t1 if out_low else t0
    tc = t_out + d * 9.0
    F = 4.5
    fb = 2.0 if slider else F
    nm = o["id"]
    lo, hi = sorted((tc - 3.2, tc + 3.2))
    if not slider:  # stone sill through the wall, projecting outside and a little inside
        s0, s1 = sorted((t_out - d * 4.0, t_in + d * 2.0))
        bx(f"{nm}_sill", along_u, a0, a1, s0, s1, sill - WALL_SILL_DROP, sill, C_ARCH, M["sill"], bevel=0.3)
    bx(f"{nm}_frame_a", along_u, a0, a0 + F, lo, hi, sill, head, C_ARCH, M["alu"])
    bx(f"{nm}_frame_b", along_u, a1 - F, a1, lo, hi, sill, head, C_ARCH, M["alu"])
    bx(f"{nm}_frame_top", along_u, a0 + F, a1 - F, lo, hi, head - F, head, C_ARCH, M["alu"])
    bx(f"{nm}_frame_bot", along_u, a0 + F, a1 - F, lo, hi, sill, sill + fb, C_ARCH, M["alu"])
    mid = (a0 + a1) / 2
    S = 4.0
    for i, (s0, s1, off) in enumerate(((a0 + F, mid + 2.5, -1.6), (mid - 2.5, a1 - F, 1.6))):
        p0, p1 = sorted((tc + off - 1.3, tc + off + 1.3))
        zb, zt = sill + fb, head - F
        bx(f"{nm}_sash{i}_l", along_u, s0, s0 + S, p0, p1, zb, zt, C_ARCH, M["alu"])
        bx(f"{nm}_sash{i}_r", along_u, s1 - S, s1, p0, p1, zb, zt, C_ARCH, M["alu"])
        bx(f"{nm}_sash{i}_t", along_u, s0 + S, s1 - S, p0, p1, zt - S, zt, C_ARCH, M["alu"])
        bx(f"{nm}_sash{i}_b", along_u, s0 + S, s1 - S, p0, p1, zb, zb + S, C_ARCH, M["alu"])
        g0, g1 = sorted((tc + off - 0.4, tc + off + 0.4))
        bx(f"{nm}_glass{i}", along_u, s0 + S, s1 - S, g0, g1, zb + S, zt - S, C_ARCH, M["glass"])


DIRS = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}  # plan frame (u, v)


def make_door(o):
    along_u, a0, a1, t0, t1, _ = opening_frame(o)
    head = o["head_cm"]
    nm = o["id"]
    leaf_mat = {"door-saferoom": M["door_steel"], "door-entrance": M["door_entrance"]}.get(nm, M["door_white"])
    frame_mat = M["alu"] if nm == "door-entrance" else leaf_mat
    J = 2.5
    bx(f"{nm}_jamb_a", along_u, a0, a0 + J, t0 - 1.0, t1 + 1.0, 0, head, C_ARCH, frame_mat)
    bx(f"{nm}_jamb_b", along_u, a1 - J, a1, t0 - 1.0, t1 + 1.0, 0, head, C_ARCH, frame_mat)
    bx(f"{nm}_head", along_u, a0 + J, a1 - J, t0 - 1.0, t1 + 1.0, head - J, head, C_ARCH, frame_mat)
    su, sv = DIRS[o["swing_dir"]]
    swing_high = (sv if along_u else su) > 0  # the leaf opens toward the high-t side
    tf = t1 if swing_high else t0  # the wall face on the swing side
    T = 4.0
    l0, l1 = (tf - T, tf) if swing_high else (tf, tf + T)
    hinge_low = o["hinge"] in ("n", "w")  # the hinge jamb is at the low along-coordinate
    ah = (a0 + J) if hinge_low else (a1 - J)
    af = (a1 - J - 0.4) if hinge_low else (a0 + J + 0.4)
    parts = [bx(f"{nm}_leaf", along_u, min(ah, af), max(ah, af), l0, l1, 0.8, head - J - 0.3, C_ARCH, leaf_mat, bevel=0.25)]
    hs = -1 if hinge_low else 1  # from the free edge back toward the hinge
    for side, tt in (("in", l1), ("out", l0)):
        k = 1 if side == "in" else -1
        r0, r1 = sorted((tt, tt + k * 1.0))
        parts.append(bx(f"{nm}_rose_{side}", along_u, af + hs * 9.0, af + hs * 4.0, r0, r1, 97.5, 102.5, C_ARCH, M["black_metal"], bevel=0.3))
        h0, h1 = sorted((tt + k * 3.0, tt + k * 4.6))
        parts.append(bx(f"{nm}_lever_{side}", along_u, min(af + hs * 18.0, af + hs * 5.0), max(af + hs * 18.0, af + hs * 5.0), h0, h1, 99.2, 100.8, C_ARCH, M["black_metal"], bevel=0.4))
        n0, n1 = sorted((tt, tt + k * 4.6))
        parts.append(bx(f"{nm}_neck_{side}", along_u, min(af + hs * 7.3, af + hs * 5.7), max(af + hs * 7.3, af + hs * 5.7), n0, n1, 99.2, 100.8, C_ARCH, M["black_metal"]))
    ang = o.get("open_deg", 0)
    if ang:
        # closed direction from the hinge toward the free edge, and the swing direction, in the model XY frame
        cd = ((1 if hinge_low else -1), 0) if along_u else (0, (1 if hinge_low else -1))
        cd_m = Vector((cd[0], -cd[1]))
        sw_m = Vector((su, -sv))
        sign = 1 if (cd_m.x * sw_m.y - cd_m.y * sw_m.x) > 0 else -1
        hu, hv = (ah, tf) if along_u else (tf, ah)
        L.rotate_about(parts, hu, hv, sign * ang)


for o in geo["openings"]:
    if o["kind"] in ("window", "sliding_door"):
        make_glazing(o)
    else:
        make_door(o)

# ------------------------------------------------------------------ deck and pergola
deck = [e for e in geo["outside"] if e["id"] == "deck"][0]["box"]
du0, dv0, du1, dv1 = deck
BW, GAP = 12.0, 0.5
u = du0 + 0.5
i = 0
while u + BW <= du1 + 0.01:
    L.box(f"Deck_board_{i:02d}", u, dv0, u + BW, dv1, HT["deck_top_cm"] - 2.8, HT["deck_top_cm"], C_ARCH, M["deck"], bevel=0.25)
    u += BW + GAP
    i += 1
L.box("Deck_substructure", du0 + 1, dv0 + 1, du1 - 1, dv1 - 1, HT["ground_cm"], HT["deck_top_cm"] - 3.0, C_ARCH, M["deck_dark"])
# pergola: in the developer's render, not on the plan -> its own collection, can be hidden
pz0, pz1 = H - 2, H + HT["roof_slab_cm"]
L.box("Pergola_beam_out", du1 - 12, dv0, du1, dv1, pz0, pz1, C_DERIVED, M["white_metal"], bevel=0.3)
L.box("Pergola_beam_n", du0, dv0, du1 - 12, dv0 + 12, pz0, pz1, C_DERIVED, M["white_metal"], bevel=0.3)
L.box("Pergola_beam_s", du0, dv1 - 12, du1 - 12, dv1, pz0, pz1, C_DERIVED, M["white_metal"], bevel=0.3)
v = dv0 + 12 + 10
i = 0
while v + 4 < dv1 - 12 - 6:
    L.box(f"Pergola_slat_{i:02d}", du0, v, du1 - 12, v + 4, pz0 + 6, pz1 - 2, C_DERIVED, M["white_metal"])
    v += 15
    i += 1

# entrance paving (drawn)
pav = [e for e in geo["outside"] if e["id"] == "entrance-step"][0]["box"]
L.box("Entrance_paving", pav[0] - 120, pav[1], pav[2], pav[3], HT["ground_cm"] - 5, -3, C_SITE, M["paving"], bevel=0.5)

# ------------------------------------------------------------------ site
if not NO_SITE:
    L.box("Lawn", -6000, -6000, 6800, 7000, HT["ground_cm"] - 30, HT["ground_cm"], C_SITE, M["grass"])
    try:
        tree, size = L.import_model("island_tree_02", C_SITE, "Tree_SE")
        L.place(tree, size, 1150, 1090, HT["ground_cm"], 20, fit=(None, None, 520))
        tree2, size2 = L.import_model("island_tree_02", C_SITE, "Tree_W")
        L.place(tree2, size2, -340, 420, HT["ground_cm"], 140, fit=(None, None, 600))
        for k, (su_, sv_, yaw, hgt, mid) in enumerate((
                (1480, 520, 0, 150, "shrub_02"), (1560, 760, 70, 170, "shrub_04"), (1500, 980, 140, 140, "shrub_02"),
                (1380, 1240, 30, 160, "shrub_04"), (760, 1330, 200, 150, "shrub_02"), (420, 1380, 90, 170, "shrub_04"),
                (120, 1340, 10, 140, "shrub_02"), (560, -260, 60, 160, "shrub_04"), (220, -240, 130, 150, "shrub_02"),
                (860, -230, 250, 170, "shrub_04"), (1040, 250, 300, 150, "shrub_02"))):
            sh, ssz = L.import_model(mid, C_SITE, f"Shrub_{k:02d}")
            L.place(sh, ssz, su_, sv_, HT["ground_cm"], yaw, fit=(None, None, hgt))
    except Exception as exc:  # the site planting is decoration: never fail the build on it
        print("SITE WARNING:", exc)

# ------------------------------------------------------------------ furniture and decor
report = {"furniture": "skipped"}
if not NO_FURN:
    import hz_furniture
    report["furniture"] = hz_furniture.build(geo, MATS, C_FURN, C_DECO, C_LIGHT)

# ------------------------------------------------------------------ lighting
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
out = nt.nodes.new("ShaderNodeOutputWorld")
bg = nt.nodes.new("ShaderNodeBackground")
env = nt.nodes.new("ShaderNodeTexEnvironment")
hdr_path = os.path.join(L.ASSETS, "polyhaven", "hdri", "dry_orchard_meadow_4k.hdr")
env.image = bpy.data.images.load(hdr_path)
mp = nt.nodes.new("ShaderNodeMapping")
tcn = nt.nodes.new("ShaderNodeTexCoord")
nt.links.new(tcn.outputs["Generated"], mp.inputs["Vector"])
nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
nt.links.new(env.outputs["Color"], bg.inputs["Color"])
nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
bg.inputs["Strength"].default_value = 1.0
# find the sun in the HDRI and turn it to the wanted azimuth
import numpy as np  # noqa: E402

w_, h_ = env.image.size
px = np.empty(w_ * h_ * 4, dtype=np.float32)
env.image.pixels.foreach_get(px)
lum = px.reshape(h_, w_, 4)[..., :3].sum(axis=2)
iy, ix = np.unravel_index(int(lum.argmax()), lum.shape)
phi = (ix + 0.5) / w_ * 2 * math.pi - math.pi
elev = ((iy + 0.5) / h_ - 0.5) * 180.0  # image row 0 is the bottom in Blender's pixel order
az_img = math.degrees(-phi)  # Cycles: u = 0.5 - atan2(y, x) / 2pi, so the image column's world azimuth is -phi (corrected 2026-11-17)
SUN_AZ = 142.0  # sun azimuth in the model frame (deg from +X toward +Y = plan up-left): the value every render and bake of 2026-11-17 used (an earlier formula wrote -38 here while the scene really got 142)
mp.inputs["Rotation"].default_value = (0, 0, math.radians(az_img - SUN_AZ))
report["hdri"] = {"file": os.path.basename(hdr_path), "sun_elevation_deg": round(float(elev), 1), "sun_azimuth_image_deg": round(az_img, 1),
                  "sun_azimuth_model_deg": SUN_AZ, "note": "the sheet has no north arrow: the sun direction is ASSUMED"}


def downlight(name, u, v, watts=9.0, z=None):
    z = (H - 0.3) if z is None else z
    L.cyl(f"{name}_trim", u, v, z - 0.6, z + 0.3, 5.2, C_LIGHT, M["white_metal"], segs=28)
    L.cyl(f"{name}_lens", u, v, z - 0.75, z - 0.6, 3.9, C_LIGHT, M["spot"], segs=28)
    ld = bpy.data.lights.new(name, "AREA")
    ld.shape = "DISK"
    ld.size = 0.08
    ld.energy = watts
    ld.color = (1.0, 0.84, 0.66)
    ld.spread = math.radians(130)
    lo = bpy.data.objects.new(name, ld)
    lo.location = L.V(u, v, z - 1.2)
    C_LIGHT.objects.link(lo)
    return lo


SPOTS = {
    "public": [(140, 610), (280, 610), (140, 760), (140, 900), (300, 990), (470, 990), (640, 990), (470, 560), (640, 560),
               (770, 620), (470, 780), (640, 780), (770, 900)],
    "hall": [(270, 380), (270, 480)],
    "bedroom": [(470, 130), (470, 330), (620, 330)],
    "saferoom": [(150, 250), (250, 120)],
    "bath": [(110, 380), (150, 470)],
}
for rid, pts in SPOTS.items():
    for k, (u_, v_) in enumerate(pts):
        downlight(f"Spot_{rid}_{k:02d}", u_, v_, 7.0 if rid != "bath" else 6.0)

# ------------------------------------------------------------------ cameras
EYE = 155


def pano_cam(name, u, v, z=EYE):
    cd = bpy.data.cameras.new(name)
    cd.type = "PANO"
    cd.panorama_type = "EQUIRECTANGULAR"
    cd.clip_start = 0.05
    cd.clip_end = 500
    ob = bpy.data.objects.new(name, cd)
    ob.location = L.V(u, v, z)
    ob.rotation_euler = (math.radians(90), 0, math.radians(-90))  # level; image centre looks along +X (toward the deck)
    C_CAM.objects.link(ob)
    return ob


def still_cam(name, u, v, z, tu, tv, tz, lens=20.0):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = 36
    cd.clip_start = 0.05
    cd.clip_end = 500
    ob = bpy.data.objects.new(name, cd)
    ob.location = L.V(u, v, z)
    d = L.V(tu, tv, tz) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    C_CAM.objects.link(ob)
    return ob


PANOS = {
    "pano_living": (640, 890), "pano_kitchen": (192, 890), "pano_entrance": (178, 598), "pano_bedroom": (462, 322),
    "pano_saferoom": (190, 215), "pano_bath": (128, 398), "pano_deck": (985, 760), "pano_hall": (268, 400),
}
for nm, (u_, v_) in PANOS.items():
    pano_cam(nm, u_, v_)
STILLS = {
    "still_hero_living": (196, 1000, 140, 720, 640, 92, 18),
    "still_kitchen_dining": (720, 905, 135, 180, 800, 95, 19),
    "still_living_to_deck": (440, 600, 135, 800, 860, 90, 20),
    "still_bedroom": (424, 404, 135, 640, 150, 85, 18),
    "still_saferoom": (268, 286, 135, 60, 110, 85, 17),
    "still_bath": (262, 372, 150, 40, 430, 92, 13),
    "still_exterior": (1900, 180, 160, 820, 760, 140, 24),
}
for nm, (u_, v_, z_, tu, tv, tz, lens) in STILLS.items():
    still_cam(nm, u_, v_, z_, tu, tv, tz, lens)
scene.camera = bpy.data.objects["pano_living"]

# ------------------------------------------------------------------ render settings (CPU, bounded)
scene.render.engine = "CYCLES"
cy = scene.cycles
cy.device = "CPU"
cy.samples = 96
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.03
cy.adaptive_min_samples = 24
cy.use_denoising = True
cy.denoiser = "OPENIMAGEDENOISE"
cy.denoising_input_passes = "RGB_ALBEDO_NORMAL"
cy.max_bounces = 7
cy.diffuse_bounces = 4
cy.glossy_bounces = 4
cy.transmission_bounces = 8
cy.transparent_max_bounces = 12
cy.sample_clamp_indirect = 8.0
cy.caustics_reflective = False
cy.caustics_refractive = False
cy.seed = 0
scene.render.resolution_x, scene.render.resolution_y = 4096, 2048
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.0
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_depth = "8"

# ------------------------------------------------------------------ save
os.makedirs(os.path.join(ROOT, "scene"), exist_ok=True)
blend = os.path.join(ROOT, "scene", "hatzav.blend")
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
report.update({
    "blend": blend, "objects": len(bpy.data.objects), "meshes": len(bpy.data.meshes),
    "tris": int(sum(len(o.data.loop_triangles) or 0 for o in bpy.data.objects if o.type == "MESH")),
    "collections": {c.name: len(c.all_objects) for c in scene.collection.children},
    "panos": {k: list(v) for k, v in PANOS.items()}, "stills": list(STILLS),
    "blender": bpy.app.version_string,
})
json.dump(report, open(os.path.join(ROOT, "scene", "build-report.json"), "w", encoding="utf-8"), indent=1)
print("BUILD OK", json.dumps(report["collections"]))

"""The public space (kitchen, dining, living) after the developer's interior renders (Projects/Harey_zahav_Naama/Corona-*.jpg;
Eliran 2026-11-17: "layout + look from the renders, walls by the sales plan"). Pieces stand in their geometry.json boxes.

Look, read from the renders: warm medium oak (tall kitchen column, bookshelves, TV console), light oak (wall units on the hob side,
island, stools, table), white stone worktops, cream rounded sofa, terracotta and ochre cushions, rattan egg pendants over the table,
white cylinder pendants over the island, black taps and oven glass.
"""
import math

import bmesh
import bpy
from mathutils import Matrix

import hz_lib as L

H = 270


def build(geo, M, X, C_FURN, C_DECO, C_LIGHT, made):
    """X: the shared helpers and materials from hz_furniture (bx, soft, union, pillow, model, mats)."""
    IT = {i["id"]: i["box"] for i in geo["items"]}
    ITEMS = geo["items"]
    bx, soft, union, pillow, model = X["bx"], X["soft"], X["union"], X["pillow"], X["model"]
    oak_d, oak_l, stone, linen, rug, black, dark, blackglass, steel = (X[k] for k in ("oak_dark", "oak_light", "stone", "linen", "rug", "black", "dark", "blackglass", "steel"))
    terra, ochre, blush, boucle = X["terra"], X["ochre"], X["blush"], X["boucle"]
    paper = L.emit("paper_shade", (1.0, 0.93, 0.82), 3.0)
    rattan = L.pbr("rattan", "rough_linen", scale=0.07, tint=(0.80, 0.62, 0.40), rough_mul=1.3, bump=2.5, rot_deg=35, gray=True, gain=1.7)
    weave = L.pbr("woven_cord", "rough_linen", scale=0.12, tint=(0.88, 0.85, 0.78), bump=2.0, gray=True)
    uph = L.pbr("chair_upholstery", "rough_linen", scale=0.3, tint=(0.72, 0.68, 0.62), bump=1.0, gray=True)

    def light(name, u, v, z, watts, kind="POINT", size=0.08):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = watts
        ld.color = (1.0, 0.82, 0.62)
        ld.shadow_soft_size = size
        lo = bpy.data.objects.new(name, ld)
        lo.location = L.V(u, v, z)
        C_LIGHT.objects.link(lo)

    def lathe(name, u, v, z0, profile, mat, segs=48, c=C_DECO, smooth=True):
        """a body of revolution around the vertical at (u,v): profile = [(radius_cm, height_cm)...] bottom to top"""
        bm = bmesh.new()
        rings = []
        for r, z in profile:
            ring = [bm.verts.new(L.V(u + r * math.cos(2 * math.pi * k / segs), v + r * math.sin(2 * math.pi * k / segs), z0 + z)) for k in range(segs)]
            rings.append(ring)
        for a, b in zip(rings, rings[1:]):
            for k in range(segs):
                bm.faces.new([a[k], a[(k + 1) % segs], b[(k + 1) % segs], b[k]])
        made.append(name)
        return L.obj_from_bm(name, bm, c, [mat], smooth=smooth)

    # ================================================================ KITCHEN
    fr, tall, rw, rs, ts = IT["k-fridge"], IT["k-tall"], IT["k-run-w"], IT["k-run-s"], IT["k-tall-s"]
    WALL_W, WF = rw[0], rw[2]
    SF, WALL_S = rs[1], rs[3]
    TOP = H - 1
    # west wall: two tall light-oak columns (integrated fridge, larder) where the sheet draws the fridge and the tall unit
    for nm, b in (("fridge", fr), ("larder", tall)):
        bx(f"K_{nm}_carcass", WALL_W, b[1], b[2] - 2, b[3], 0, TOP, dark)
        bx(f"K_{nm}_door_low", b[2] - 2, b[1] + 0.3, b[2], b[3] - 0.3, 1, 150, oak_l, bevel=0.15)
        bx(f"K_{nm}_door_top", b[2] - 2, b[1] + 0.3, b[2], b[3] - 0.3, 150.5, TOP, oak_l, bevel=0.15)
    bx("K_fridge_side", fr[0], fr[1] - 2, fr[2], fr[1], 0, TOP, oak_l)
    # south wall: the tall dark-oak column with two ovens (render 1_CShading / 0020000)
    bx("K_tallS_carcass", ts[0], ts[1] + 2, ts[2], ts[3], 0, TOP, dark)
    w = ts[2] - ts[0]
    for k in range(2):
        a0 = ts[0] + w * k / 2 + 0.25
        a1 = ts[0] + w * (k + 1) / 2 - 0.25
        if k == 1:  # the oven column (right half in the render = east half here)
            bx(f"K_tallS_door_low_{k}", a0, ts[1], a1, ts[1] + 2, 1, 82, oak_d, bevel=0.15)
            bx(f"K_tallS_oven_{k}", a0, ts[1] + 0.5, a1, ts[1] + 2.2, 82.5, 141, blackglass, bevel=0.2)
            bx(f"K_tallS_micro_{k}", a0, ts[1] + 0.5, a1, ts[1] + 2.2, 141.5, 186, blackglass, bevel=0.2)
            bx(f"K_tallS_oven_handle_{k}", a0 + 6, ts[1] - 2.6, a1 - 6, ts[1] - 1.2, 133, 134.5, steel, bevel=0.3)
            bx(f"K_tallS_micro_handle_{k}", a0 + 6, ts[1] - 2.6, a1 - 6, ts[1] - 1.2, 178, 179.5, steel, bevel=0.3)
            bx(f"K_tallS_door_top_{k}", a0, ts[1], a1, ts[1] + 2, 186.5, TOP, oak_d, bevel=0.15)
        else:
            for j, (z0, z1) in enumerate(((1, 92), (92.5, 182), (182.5, TOP))):
                bx(f"K_tallS_door_{k}_{j}", a0, ts[1], a1, ts[1] + 2, z0, z1, oak_d, bevel=0.15)
    # base runs: light oak fronts on a dark plinth, white stone worktop
    bx("K_base_w_carcass", WALL_W, rw[1], WF - 2, SF, 10, 86, dark)
    bx("K_base_s_carcass", WALL_W, SF + 2, rs[2], WALL_S, 10, 86, dark)
    bx("K_plinth_w", WALL_W, rw[1], WF - 7, SF, 0, 10, dark)
    bx("K_plinth_s", WALL_W, SF + 7, rs[2], WALL_S, 0, 10, dark)
    hob = IT["k-hob"]
    for k, (a, b) in enumerate(((rw[1], hob[1] - 2), (hob[1] - 2, hob[3] + 2), (hob[3] + 2, SF))):
        if k == 1:
            for j, (z0, z1) in enumerate(((10.4, 34.5), (35, 59), (59.5, 83.5))):
                bx(f"K_front_w{k}_{j}", WF - 2, a + 0.25, WF, b - 0.25, z0, z1, oak_l, bevel=0.15)
        else:
            bx(f"K_front_w{k}", WF - 2, a + 0.25, WF, b - 0.25, 10.4, 83.5, oak_l, bevel=0.15)
    sink = IT["k-sink"]
    for k, (a, b) in enumerate(((WF, sink[0] - 8), (sink[0] - 8, sink[2] + 8), (sink[2] + 8, rs[2]))):
        bx(f"K_front_s{k}", a + 0.25, SF, b - 0.25, SF + 2, 10.4, 83.5, oak_l, bevel=0.15)
    sb = (sink[0] + 4, sink[1] + 4, sink[2] - 4, sink[3] - 6)
    union("K_worktop", [(WALL_W, rw[1], WF + 2, WALL_S, 86, 90), (WALL_W, SF - 2, rs[2], WALL_S, 86, 90)], stone,
          voids=[(sb[0], sb[1], sb[2], sb[3], 85, 91)])
    union("K_sink_bowl", [(sb[0] - 0.8, sb[1] - 0.8, sb[2] + 0.8, sb[3] + 0.8, 66, 86)], steel, voids=[(sb[0], sb[1], sb[2], sb[3], 66.8, 87)])
    tu, tv = (sink[0] + sink[2]) / 2, sink[3] - 3
    L.cyl("K_tap_body", tu, tv, 90, 124, 1.3, C_FURN, steel, segs=20)
    L.cyl("K_tap_spout", tu, tv - 9, 124, 0, 1.1, C_FURN, steel, segs=16, axis="v", length=19)
    L.cyl("K_tap_nozzle", tu, tv - 18, 118, 124.5, 1.1, C_FURN, steel, segs=16)
    hu0, hu1 = WALL_W + 5, WF - 3
    bx("K_hob", hu0, hob[1], hu1, hob[3], 90, 90.7, blackglass, bevel=0.2)
    # stone splashback to the wall units, wall units in light oak to the ceiling (render: upper right)
    bx("K_splash_w", WALL_W, rw[1], WALL_W + 1.5, WALL_S - 1.5, 90, 150, stone)
    bx("K_splash_s", WALL_W, WALL_S - 1.5, rs[2], WALL_S, 90, 150, stone)
    UD = 36
    bx("K_upper_carcass", WALL_W + 1.5, rw[1], WALL_W + UD - 2, SF + 20, 150, TOP, dark)
    cuts = [rw[1], rw[1] + (SF + 20 - rw[1]) / 3, rw[1] + 2 * (SF + 20 - rw[1]) / 3, SF + 20]
    for k in range(3):
        for j, (z0, z1) in enumerate(((150.4, 205), (205.5, TOP))):
            bx(f"K_upper_front_{k}_{j}", WALL_W + UD - 2, cuts[k] + 0.25, WALL_W + UD, cuts[k + 1] - 0.25, z0, z1, oak_l, bevel=0.15)
    # open oak shelves on the south wall between the window and the tall column (render: three floating shelves)
    win = [o for o in geo["openings"] if o["id"] == "win-kitchen"][0]["box"]
    for k, z in enumerate((150, 178, 206)):
        bx(f"K_shelf_{k}", win[2] + 4, WALL_S - 24, ts[0] - 1, WALL_S - 1.5, z, z + 3, oak_d, bevel=0.3)
    light("K_under_cabinet", WALL_W + 18, (rw[1] + SF) / 2, 148, 12, "AREA", 0.1)
    # island: light-oak body, white stone top with an overhang on the north side for the stools
    isl = IT["k-island"]
    bx("K_island_body", isl[0] + 2, isl[1] + 28, isl[2] - 2, isl[3], 0, 87, oak_l, bevel=0.3)
    for k in range(1, 4):
        cu = isl[0] + (isl[2] - isl[0]) * k / 4
        bx(f"K_island_groove_{k}", cu - 0.2, isl[1] + 27.6, cu + 0.2, isl[1] + 28.1, 2, 86, dark)
    bx("K_island_top", isl[0], isl[1], isl[2], isl[3], 87, 91, stone, bevel=0.4)
    for i in ITEMS:
        if i["kind"] != "bar_stool":
            continue
        b = i["box"]
        cu, cv = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        for j, (du, dv) in enumerate(((-17, -17), (17, -17), (-17, 17), (17, 17))):
            bx(f"K_{i['id']}_leg{j}", cu + du - 1.6, cv + dv - 1.6, cu + du + 1.6, cv + dv + 1.6, 0, 64, oak_l, bevel=0.6)
        bx(f"K_{i['id']}_rail_n", cu - 16, cv - 17.5, cu + 16, cv - 16.5, 22, 24, oak_l)
        bx(f"K_{i['id']}_rail_s", cu - 16, cv + 16.5, cu + 16, cv + 17.5, 22, 24, oak_l)
        soft(f"K_{i['id']}_seat", cu - 20, cv - 20, cu + 20, cv + 20, 64, 68, weave, r=1.2)
        # curved back on the north side (away from the island)
        union(f"K_{i['id']}_back", [(cu - 19, cv - 21, cu + 19, cv - 18, 78, 86)], oak_l, bevel=1.0)
        for s_ in (-1, 1):
            bx(f"K_{i['id']}_post{s_}", cu + s_ * 17 - 1.4, cv - 20.5, cu + s_ * 17 + 1.4, cv - 18, 64, 79, oak_l, bevel=0.4)
    for k, cu in enumerate((isl[0] + 75, isl[0] + 145)):
        cv = (isl[1] + isl[3]) / 2
        L.cyl(f"K_pendant_cord_{k}", cu, cv, 186, H, 0.3, C_DECO, black, segs=8)
        L.cyl(f"K_pendant_rose_{k}", cu, cv, H - 1.5, H, 6, C_DECO, black, segs=24)
        L.cyl(f"K_pendant_{k}", cu, cv, 158, 188, 8.5, C_DECO, paper, segs=40)
        light(f"K_pendant_light_{k}", cu, cv, 155, 14)
    model("wooden_bowl_01", "K_bowl", isl[0] + 160, isl[1] + 60, 91, c=C_DECO, fit=(30, None, None))
    for k, (du, dv) in enumerate(((-5, -2), (4, 3), (1, -6))):
        model("food_apple_01", f"K_apple_{k}", isl[0] + 160 + du, isl[1] + 60 + dv, 94.5, yaw=40 * k, c=C_DECO)
    model("ceramic_vase_03", "K_jug", isl[0] + 40, isl[1] + 55, 91, c=C_DECO, fit=(None, None, 24))
    model("potted_plant_04", "K_herb", sink[0] - 30, WALL_S - 18, 90, c=C_DECO, fit=(None, None, 38))

    # ================================================================ DINING
    dt = IT["d-table"]
    bx("D_table_top", dt[0], dt[1], dt[2], dt[3], 71, 76, oak_l, bevel=0.6)
    for k, (lu, lv) in enumerate(((dt[0] + 4, dt[1] + 4), (dt[2] - 12, dt[1] + 4), (dt[0] + 4, dt[3] - 12), (dt[2] - 12, dt[3] - 12))):
        bx(f"D_table_leg_{k}", lu, lv, lu + 8, lv + 8, 0, 71, oak_l, bevel=0.5)
    for i in ITEMS:
        if i["kind"] != "dining_chair":
            continue
        b = i["box"]
        cu, cv = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        f = i["face"]   # the direction the sitter looks
        du, dv = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}[f]
        objs = []
        for j, (a, c_) in enumerate(((-19, -19), (19, -19), (-19, 19), (19, 19))):
            objs.append(bx(f"D_{i['id']}_leg{j}", cu + a - 1.8, cv + c_ - 1.8, cu + a + 1.8, cv + c_ + 1.8, 0, 44, oak_l, bevel=0.6))
        objs.append(soft(f"D_{i['id']}_seat", cu - 23, cv - 22, cu + 23, cv + 22, 42, 48, uph, r=2.0))
        # the curved upholstered back on the side away from the table
        bu, bv = cu - du * 21, cv - dv * 21
        if du == 0:
            objs.append(soft(f"D_{i['id']}_back", cu - 24, bv - 3, cu + 24, bv + 3, 62, 80, uph, r=2.5))
        else:
            objs.append(soft(f"D_{i['id']}_back", bu - 3, cv - 24, bu + 3, cv + 24, 62, 80, uph, r=2.5))
        made.extend(o.name for o in objs)
    tcu, tcv = (dt[0] + dt[2]) / 2, (dt[1] + dt[3]) / 2
    model("wooden_bowl_01", "D_bowl", tcu, tcv, 76, c=C_DECO, fit=(36, None, None))
    model("food_apple_01", "D_apple", tcu + 14, tcv + 6, 76, c=C_DECO)
    # two rattan egg pendants over the table
    egg = [(3, 0), (12, 2), (19, 8), (23, 17), (24, 27), (22, 37), (17, 46), (10, 52), (3, 55), (0.8, 55.5)]
    for k, cu in enumerate((tcu - 32, tcu + 32)):
        lathe(f"D_rattan_{k}", cu, tcv, 150, egg, rattan)
        L.cyl(f"D_rattan_cord_{k}", cu, tcv, 205, H, 0.3, C_DECO, black, segs=8)
        light(f"D_rattan_light_{k}", cu, tcv, 162, 26, size=0.1)
    sh = IT["d-shelf"]
    shelving("D_shelf", sh, 230, oak_d, bx, irregular=True)
    for k, (fu, z, s_) in enumerate(((0.18, 128, 22), (0.55, 92, 26), (0.78, 168, 20), (0.35, 54, 28))):
        model("ceramic_vase_03", f"D_shelf_vase_{k}", sh[0] + (sh[2] - sh[0]) * fu, (sh[1] + sh[3]) / 2, z, c=C_DECO, fit=(None, None, s_))
    books(sh, bx, X)

    # ================================================================ LIVING
    rg = IT["l-rug"]
    bx("L_rug", rg[0], rg[1], rg[2], rg[3], 0, 1.3, rug, bevel=0.4)
    s = IT["l-sofa"]  # back on the south side, seat facing north
    BK, AW = 24, 22
    soft("L_sofa_base", s[0] + 2, s[1] + 6, s[2] - 2, s[3] - 2, 4, 40, linen, r=8)
    n = 3
    for k in range(n):
        a0 = s[0] + AW + (s[2] - s[0] - 2 * AW) * k / n
        a1 = s[0] + AW + (s[2] - s[0] - 2 * AW) * (k + 1) / n
        soft(f"L_sofa_seat_{k}", a0 + 0.6, s[1] + 2, a1 - 0.6, s[3] - BK + 4, 38, 50, linen, r=8)
        soft(f"L_sofa_back_{k}", a0 + 0.6, s[3] - BK, a1 - 0.6, s[3] - 1, 38, 80, linen, r=10)
    soft("L_sofa_arm_w", s[0], s[1] + 4, s[0] + AW, s[3], 4, 64, linen, r=10)
    soft("L_sofa_arm_e", s[2] - AW, s[1] + 4, s[2], s[3], 4, 64, linen, r=10)
    pillow("L_pillow_0", s[0] + AW + 30, s[3] - BK - 8, 49, terra, w=44, h=40, t=12, lean=72, yaw=180)
    pillow("L_pillow_1", s[0] + AW + 72, s[3] - BK - 7, 49, blush, w=46, h=42, t=12, lean=72, yaw=176)
    pillow("L_pillow_2", s[2] - AW - 32, s[3] - BK - 8, 49, ochre, w=44, h=40, t=12, lean=72, yaw=184)
    pillow("L_pillow_3", s[2] - AW - 74, s[3] - BK - 7, 49, boucle, w=42, h=38, t=12, lean=72, yaw=180)
    soft("L_throw", (s[0] + s[2]) / 2 - 24, s[3] - 1.5, (s[0] + s[2]) / 2 + 24, s[3] + 1.2, 42, 81, X["throw"], r=0.9, c=C_DECO)
    ct = IT["l-table-round"]
    cu, cv, r = (ct[0] + ct[2]) / 2, (ct[1] + ct[3]) / 2, (ct[2] - ct[0]) / 2
    L.cyl("L_table_top", cu, cv, 36, 40, r, C_FURN, oak_l, segs=64, bevel=0.6)
    L.cyl("L_table_base", cu, cv, 1.3, 36, r * 0.55, C_FURN, oak_l, segs=48)
    bx("L_book_0", cu - 16, cv - 12, cu + 10, cv + 8, 40, 43, X["book_a"], c=C_DECO, bevel=0.2)
    lathe("L_lamp_base", cu + 18, cv + 10, 40, [(3.5, 0), (3.5, 1), (2.2, 2), (1.6, 14), (2.0, 15)], X["brass"], segs=32)
    lathe("L_lamp_globe", cu + 18, cv + 10, 54, [(0.5, 0), (6, 1.5), (8.5, 5), (8.5, 7), (6, 10.5), (0.5, 12)], L.emit("lamp_globe", (1.0, 0.9, 0.78), 2.0), segs=32)
    light("L_lamp_light", cu + 18, cv + 10, 60, 4, size=0.05)
    # rattan lounge chair
    rc = IT["l-chair-rattan"]
    i_rc = [i for i in ITEMS if i["id"] == "l-chair-rattan"][0]
    ru, rv = (rc[0] + rc[2]) / 2, (rc[1] + rc[3]) / 2
    parts = []
    for j, (a, c_) in enumerate(((-27, -30), (27, -30), (-27, 22), (27, 22))):
        parts.append(bx(f"L_rattan_leg{j}", ru + a - 1.6, rv + c_ - 1.6, ru + a + 1.6, rv + c_ + 1.6, 0, 30 if c_ < 0 else 40, oak_d, bevel=0.5))
    parts.append(bx("L_rattan_rail_l", ru - 28.6, rv - 31, ru - 25.4, rv + 24, 28, 31.5, oak_d, bevel=0.5))
    parts.append(bx("L_rattan_rail_r", ru + 25.4, rv - 31, ru + 28.6, rv + 24, 28, 31.5, oak_d, bevel=0.5))
    parts.append(bx("L_rattan_seat", ru - 25, rv - 28, ru + 25, rv + 18, 30, 32, rattan))
    back = bx("L_rattan_back", ru - 25, rv + 16, ru + 25, rv + 19, 32, 78, rattan)
    L.rotate_about([back], ru, rv + 18, 0)
    back.rotation_euler.x = math.radians(-18)
    parts.append(back)
    L.rotate_about(parts, ru, rv, i_rc.get("rot_deg", 0) + 180)
    # TV wall: low oak console, television; tall double bookcase in the set-back corner
    co = IT["l-console"]
    bx("L_console", co[0], co[1], co[2], co[3], 0, 45, oak_l, bevel=0.3)
    for k in range(1, 4):
        cx = co[0] + (co[2] - co[0]) * k / 4
        bx(f"L_console_gap_{k}", cx - 0.2, co[3] - 0.1, cx + 0.2, co[3] + 0.3, 2, 44, dark)
    tvb = IT["l-tv"]
    bx("L_tv", tvb[0], co[1] + 1.4, tvb[2], co[1] + 4.6, 105, 179, X["tvmat"], bevel=0.3)
    model("ceramic_vase_03", "L_console_vase", co[0] + 30, co[1] + 22, 45, c=C_DECO, fit=(None, None, 30))
    model("potted_plant_04", "L_console_branch", co[0] + 30, co[1] + 22, 70, c=C_DECO, fit=(None, None, 45))
    bx("L_console_books", co[0] + 80, co[1] + 8, co[0] + 110, co[1] + 30, 45, 49, X["book_a"], c=C_DECO, bevel=0.2)
    st = IT["l-shelf-tall"]
    shelving("L_shelf_tall", st, H - 1, oak_d, bx, columns=2, rows=7, closed_mid=True, wall_lo=True)
    books(st, bx, X, z_rows=(45, 82, 119, 156, 193), wall_lo=True)
    # wall sconce on the east wall beside the bookcase (render 0060000)
    sl = [o for o in geo["openings"] if o["id"] == "door-sliding"][0]["box"]
    sc_v = (st[3] + sl[1]) / 2 + 20
    L.cyl("L_sconce_disc", sl[0] - 1.2, sc_v, 175, 0, 11, C_DECO, oak_l, segs=40, axis="u", length=2.4)
    L.cyl("L_sconce_globe", sl[0] - 6.5, sc_v, 175, 0, 5.5, C_DECO, L.emit("sconce_glow", (1.0, 0.86, 0.66), 4.0), segs=24, axis="u", length=8)
    light("L_sconce_light", sl[0] - 12, sc_v, 175, 5)


def shelving(name, b, top, mat, bx, columns=None, rows=None, irregular=False, closed_mid=False, wall_lo=False):
    """open shelving in the box b (plan cm), from the floor to `top`. irregular = staggered dividers (render 0040000)."""
    u0, v0, u1, v1 = b
    along_u = (u1 - u0) >= (v1 - v0)
    T = 2.4
    a0, a1 = (u0, u1) if along_u else (v0, v1)
    t0, t1 = (v0, v1) if along_u else (u0, u1)

    def B(nm, aa0, aa1, z0, z1, tt0=None, tt1=None, m=None):
        tt0 = t0 if tt0 is None else tt0
        tt1 = t1 if tt1 is None else tt1
        if along_u:
            return bx(nm, aa0, tt0, aa1, tt1, z0, z1, m or mat)
        return bx(nm, tt0, aa0, tt1, aa1, z0, z1, m or mat)

    if wall_lo:
        B(f"{name}_back", a0, a1, 0, top, t0, t0 + 1.2)
    else:
        B(f"{name}_back", a0, a1, 0, top, t1 - 1.2, t1)
    B(f"{name}_side_a", a0, a0 + T, 0, top)
    B(f"{name}_side_b", a1 - T, a1, 0, top)
    B(f"{name}_top", a0, a1, top - T, top)
    B(f"{name}_plinth", a0, a1, 0, 8)
    if irregular:
        rows_z = [8, 46, 84, 122, 160, 198, top - T]
        width = a1 - a0
        for r in range(len(rows_z) - 1):
            z0 = rows_z[r]
            B(f"{name}_shelf_{r}", a0 + T, a1 - T, z0, z0 + T)
            offs = (0.17, 0.43, 0.71) if r % 2 == 0 else (0.29, 0.58, 0.84)
            for k, f in enumerate(offs):
                a = a0 + width * f
                B(f"{name}_div_{r}_{k}", a - T / 2, a + T / 2, z0 + T, rows_z[r + 1])
    else:
        cols = columns or 2
        rws = rows or 6
        width = a1 - a0
        for k in range(1, cols):
            a = a0 + width * k / cols
            if closed_mid:
                B(f"{name}_mid", a - 10, a + 10, 0, top)
            else:
                B(f"{name}_div_{k}", a - T / 2, a + T / 2, 0, top)
        for r in range(1, rws):
            z = 8 + (top - 8) * r / rws
            B(f"{name}_shelf_{r}", a0 + T, a1 - T, z, z + T)


def books(b, bx, X, z_rows=(46, 84, 122, 160), wall_lo=False):
    """a few rows of books on shelving b, deterministic"""
    u0, v0, u1, v1 = b
    along_u = (u1 - u0) >= (v1 - v0)
    a0, a1 = (u0, u1) if along_u else (v0, v1)
    t0, t1 = (v0, v1) if along_u else (u0, u1)
    mats = [X["book_a"], X["book_b"], X["book_c"], X["book_d"]]
    k = 0
    for r, z in enumerate(z_rows):
        a = a0 + 8 + (r * 37) % 60
        for j in range(4 + r % 3):
            th = 2.2 + ((k * 7) % 5) * 0.6
            hh = 21 + (k * 11) % 9
            if a + th > a1 - 6:
                break
            m = mats[k % 4]
            d0, d1 = (t0 + 4, t0 + 24) if wall_lo else (t1 - 24, t1 - 4)
            if along_u:
                bx(f"Book_{b[0]}_{r}_{j}", a, d0, a + th, d1, z + 2.4, z + 2.4 + hh, m, c=X["C_DECO"])
            else:
                bx(f"Book_{b[0]}_{r}_{j}", d0, a, d1, a + th, z + 2.4, z + 2.4 + hh, m, c=X["C_DECO"])
            a += th + 0.2
            k += 1

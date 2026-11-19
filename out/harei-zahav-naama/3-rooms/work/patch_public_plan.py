"""One-off patch (2026-11-18): hz_public.py's public space from the renders' layout back to the sales sheet's furniture.
The previous file is kept as work/hz_public.renders-layout-2026-11-17.py."""
import shutil

P = "scripts/blender/hz_public.py"
shutil.copy(P, "work/hz_public.renders-layout-2026-11-17.py")
s = open(P, encoding="utf-8").read()
a = s.index("    # ================================================================ KITCHEN")
b = s.index("\ndef shelving(")
NEW = '''    # ================================================================ KITCHEN (the sales sheet's L: west run + south run, no island; 2026-11-18)
    fr, tall, rw, rs = IT["k-fridge"], IT["k-tall"], IT["k-run-w"], IT["k-run-s"]
    WALL_W, WF = rw[0], rw[2]
    SF, WALL_S = rs[1], rs[3]
    TOP = H - 1
    # west wall: the light-oak fridge column where the sheet draws the fridge, then the renders' dark-oak oven column where the
    # sheet draws its tall unit ("read as an oven tower")
    bx("K_fridge_carcass", WALL_W, fr[1], fr[2] - 2, fr[3], 0, TOP, dark)
    bx("K_fridge_door_low", fr[2] - 2, fr[1] + 0.3, fr[2], fr[3] - 0.3, 1, 150, oak_l, bevel=0.15)
    bx("K_fridge_door_top", fr[2] - 2, fr[1] + 0.3, fr[2], fr[3] - 0.3, 150.5, TOP, oak_l, bevel=0.15)
    bx("K_fridge_side", fr[0], fr[1] - 2, fr[2], fr[1], 0, TOP, oak_l)
    ts = tall
    bx("K_tallS_carcass", WALL_W, ts[1], ts[2] - 2, ts[3], 0, TOP, dark)
    a0, a1, F_ = ts[1] + 0.25, ts[3] - 0.25, ts[2]
    bx("K_tallS_door_low_1", F_ - 2, a0, F_, a1, 1, 82, oak_d, bevel=0.15)
    bx("K_tallS_oven_1", F_ - 2.2, a0, F_ - 0.5, a1, 82.5, 141, blackglass, bevel=0.2)
    bx("K_tallS_micro_1", F_ - 2.2, a0, F_ - 0.5, a1, 141.5, 186, blackglass, bevel=0.2)
    bx("K_tallS_oven_handle_1", F_ + 1.2, a0 + 6, F_ + 2.6, a1 - 6, 133, 134.5, steel, bevel=0.3)
    bx("K_tallS_micro_handle_1", F_ + 1.2, a0 + 6, F_ + 2.6, a1 - 6, 178, 179.5, steel, bevel=0.3)
    bx("K_tallS_door_top_1", F_ - 2, a0, F_, a1, 186.5, TOP, oak_d, bevel=0.15)
    # base runs: light oak fronts on a dark plinth, white stone worktop
    bx("K_base_w_carcass", WALL_W, rw[1], WF - 2, SF, 10, 86, dark)
    bx("K_base_s_carcass", WALL_W, SF + 2, rs[2], WALL_S, 10, 86, dark)
    bx("K_plinth_w", WALL_W, rw[1], WF - 7, SF, 0, 10, dark)
    bx("K_plinth_s", WALL_W, SF + 7, rs[2], WALL_S, 0, 10, dark)
    bx("K_end_panel_s", rs[2] - 2, SF, rs[2], WALL_S, 0, 90, oak_l, bevel=0.2)
    hob = IT["k-hob"]
    for k, (a, b) in enumerate(((rw[1], hob[1] - 2), (hob[1] - 2, hob[3] + 2), (hob[3] + 2, SF))):
        if k == 1:
            for j, (z0, z1) in enumerate(((10.4, 34.5), (35, 59), (59.5, 83.5))):
                bx(f"K_front_w{k}_{j}", WF - 2, a + 0.25, WF, b - 0.25, z0, z1, oak_l, bevel=0.15)
        else:
            bx(f"K_front_w{k}", WF - 2, a + 0.25, WF, b - 0.25, 10.4, 83.5, oak_l, bevel=0.15)
    sink = IT["k-sink"]
    cuts_s = [WF, sink[0] - 8, sink[2] + 8, (sink[2] + 8 + rs[2] - 2) / 2, rs[2] - 2]
    for k in range(len(cuts_s) - 1):
        bx(f"K_front_s{k}", cuts_s[k] + 0.25, SF, cuts_s[k + 1] - 0.25, SF + 2, 10.4, 83.5, oak_l, bevel=0.15)
    sb = (sink[0] + 4, sink[1] + 4, sink[2] - 4, sink[3] - 6)
    union("K_worktop", [(WALL_W, rw[1], WF + 2, WALL_S, 86, 90), (WALL_W, SF - 2, rs[2], WALL_S, 86, 90)], stone,
          voids=[(sb[0], sb[1], sb[2], sb[3], 85, 91)])
    union("K_sink_bowl", [(sb[0] - 0.8, sb[1] - 0.8, sb[2] + 0.8, sb[3] + 0.8, 66, 86)], steel, voids=[(sb[0], sb[1], sb[2], sb[3], 66.8, 87)])
    tu, tv = (sink[0] + sink[2]) / 2, sink[3] - 3
    L.cyl("K_tap_body", tu, tv, 90, 124, 1.3, C_FURN, steel, segs=20)
    L.cyl("K_tap_spout", tu, tv - 9, 124, 0, 1.1, C_FURN, steel, segs=16, axis="v", length=19)
    L.cyl("K_tap_nozzle", tu, tv - 18, 118, 124.5, 1.1, C_FURN, steel, segs=16)
    bx("K_hob", WALL_W + 5, hob[1], WF - 3, hob[3], 90, 90.7, blackglass, bevel=0.2)
    bx("K_splash_w", WALL_W, rw[1], WALL_W + 1.5, WALL_S - 1.5, 90, 150, stone)
    bx("K_splash_s", WALL_W, WALL_S - 1.5, rs[2], WALL_S, 90, 150, stone)
    UD = 36
    bx("K_upper_carcass", WALL_W + 1.5, rw[1], WALL_W + UD - 2, SF + 20, 150, TOP, dark)
    cuts = [rw[1], rw[1] + (SF + 20 - rw[1]) / 3, rw[1] + 2 * (SF + 20 - rw[1]) / 3, SF + 20]
    for k in range(3):
        for j, (z0, z1) in enumerate(((150.4, 205), (205.5, TOP))):
            bx(f"K_upper_front_{k}_{j}", WALL_W + UD - 2, cuts[k] + 0.25, WALL_W + UD, cuts[k + 1] - 0.25, z0, z1, oak_l, bevel=0.15)
    # open oak shelves on the south wall east of the window (render: three floating shelves)
    win = [o for o in geo["openings"] if o["id"] == "win-kitchen"][0]["box"]
    for k, z in enumerate((150, 178, 206)):
        bx(f"K_shelf_{k}", win[2] + 4, WALL_S - 24, rs[2] - 3, WALL_S - 1.5, z, z + 3, oak_d, bevel=0.3)
    light("K_under_cabinet", WALL_W + 18, (rw[1] + SF) / 2, 148, 12, "AREA", 0.1)
    bu_, bv_ = WALL_W + 30, (hob[3] + SF) / 2 + 10
    model("wooden_bowl_01", "K_bowl", bu_, bv_, 90, c=C_DECO, fit=(30, None, None))
    for k, (du, dv) in enumerate(((-5, -2), (4, 3), (1, -6))):
        model("food_apple_01", f"K_apple_{k}", bu_ + du, bv_ + dv, 93.5, yaw=40 * k, c=C_DECO)
    model("ceramic_vase_03", "K_jug", rs[2] - 40, WALL_S - 20, 90, c=C_DECO, fit=(None, None, 24))
    model("potted_plant_04", "K_herb", sink[0] - 30, WALL_S - 18, 90, c=C_DECO, fit=(None, None, 38))

    # ================================================================ DINING (the sheet's table, long side north-south)
    dt = IT["d-table"]
    bx("D_table_top", dt[0], dt[1], dt[2], dt[3], 71, 76, oak_l, bevel=0.6)
    for k, (lu, lv) in enumerate(((dt[0] + 4, dt[1] + 4), (dt[2] - 12, dt[1] + 4), (dt[0] + 4, dt[3] - 12), (dt[2] - 12, dt[3] - 12))):
        bx(f"D_table_leg_{k}", lu, lv, lu + 8, lv + 8, 0, 71, oak_l, bevel=0.5)
    for i in ITEMS:
        if i["kind"] != "dining_chair":
            continue
        b = i["box"]
        cu, cv = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        du, dv = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}[i["face"]]
        objs = []
        for j, (a, c_) in enumerate(((-19, -19), (19, -19), (-19, 19), (19, 19))):
            objs.append(bx(f"D_{i['id']}_leg{j}", cu + a - 1.8, cv + c_ - 1.8, cu + a + 1.8, cv + c_ + 1.8, 0, 44, oak_l, bevel=0.6))
        objs.append(soft(f"D_{i['id']}_seat", cu - 23, cv - 22, cu + 23, cv + 22, 42, 48, uph, r=2.0))
        bu, bv = cu - du * 21, cv - dv * 21
        if du == 0:
            objs.append(soft(f"D_{i['id']}_back", cu - 24, bv - 3, cu + 24, bv + 3, 62, 80, uph, r=2.5))
        else:
            objs.append(soft(f"D_{i['id']}_back", bu - 3, cv - 24, bu + 3, cv + 24, 62, 80, uph, r=2.5))
        made.extend(o.name for o in objs)
    tcu, tcv = (dt[0] + dt[2]) / 2, (dt[1] + dt[3]) / 2
    model("wooden_bowl_01", "D_bowl", tcu, tcv, 76, c=C_DECO, fit=(36, None, None))
    model("food_apple_01", "D_apple", tcu + 6, tcv + 14, 76, c=C_DECO)
    # two rattan pendants over the table, along its length (render 0040000)
    egg = [(3, 0), (12, 2), (19, 8), (23, 17), (24, 27), (22, 37), (17, 46), (10, 52), (3, 55), (0.8, 55.5)]
    for k, pv in enumerate((tcv - 40, tcv + 40)):
        lathe(f"D_rattan_{k}", tcu, pv, 150, egg, rattan)
        L.cyl(f"D_rattan_cord_{k}", tcu, pv, 205, H, 0.3, C_DECO, black, segs=8)
        light(f"D_rattan_light_{k}", tcu, pv, 162, 26, size=0.1)

    # ================================================================ LIVING (the sheet: corner sofa N + E, TV on the south wall)
    rg = IT["l-rug"]
    bx("L_rug", rg[0], rg[1], rg[2], rg[3], 0, 1.3, rug, bevel=0.4)
    s, ch = IT["l-sofa"], IT["l-chaise"]
    BK, AW = 24, 22
    # the run along the north wall: back on the north, seats facing south, an arm at the west end
    soft("L_sofa_base", s[0] + 2, s[1] + 2, s[2] - 2, s[3] - 2, 4, 40, linen, r=8)
    soft("L_sofa_arm_w", s[0], s[1] + 2, s[0] + AW, s[3], 4, 64, linen, r=10)
    soft("L_sofa_back_n", s[0] + AW, s[1] + 1, s[2] - BK, s[1] + BK, 38, 80, linen, r=10)
    for k in range(2):
        a0 = s[0] + AW + (ch[0] - s[0] - AW) * k / 2
        a1 = s[0] + AW + (ch[0] - s[0] - AW) * (k + 1) / 2
        soft(f"L_sofa_seat_{k}", a0 + 0.6, s[1] + BK - 4, a1 - 0.6, s[3] - 2, 38, 50, linen, r=8)
    # the chaise along the east wall: back on the east, seat facing west, from the corner to its end
    soft("L_chaise_base", ch[0] + 2, s[1] + 2, ch[2] - 2, ch[3] - 2, 4, 40, linen, r=8)
    soft("L_chaise_back_e", ch[2] - BK, s[1] + 1, ch[2] - 1, ch[3] - 2, 38, 80, linen, r=10)
    soft("L_chaise_seat", ch[0] + 0.6, s[1] + BK - 4, ch[2] - BK + 4, ch[3] - 2.6, 38, 50, linen, r=8)
    pillow("L_pillow_0", s[0] + AW + 40, s[1] + BK + 8, 49, terra, w=44, h=40, t=12, lean=72, yaw=0)
    pillow("L_pillow_1", s[0] + AW + 84, s[1] + BK + 7, 49, blush, w=46, h=42, t=12, lean=72, yaw=4)
    pillow("L_pillow_2", ch[2] - BK - 8, s[1] + 60, 49, ochre, w=44, h=40, t=12, lean=72, yaw=90)
    soft("L_throw", ch[0] + 10, ch[3] - 70, ch[2] - BK, ch[3] - 20, 50, 52.5, X["throw"], r=0.9, c=C_DECO)
    # two nested coffee tables (the sheet: 61 x 60 and 40 x 41)
    nt_ = IT["l-table-nest"]
    bx("L_nest_big", nt_[2] - 61, nt_[3] - 60, nt_[2], nt_[3], 36, 40, oak_l, bevel=0.5)
    bx("L_nest_big_base", nt_[2] - 55, nt_[3] - 54, nt_[2] - 6, nt_[3] - 6, 0, 36, oak_l, bevel=0.5)
    bx("L_nest_small", nt_[0], nt_[1] + 10, nt_[0] + 40, nt_[1] + 51, 30, 33, oak_d, bevel=0.5)
    cu, cv = nt_[2] - 30, nt_[3] - 30
    bx("L_book_0", cu - 16, cv - 12, cu + 10, cv + 8, 40, 43, X["book_a"], c=C_DECO, bevel=0.2)
    lathe("L_lamp_base", cu + 14, cv + 12, 40, [(3.5, 0), (3.5, 1), (2.2, 2), (1.6, 14), (2.0, 15)], X["brass"], segs=32)
    lathe("L_lamp_globe", cu + 14, cv + 12, 54, [(0.5, 0), (6, 1.5), (8.5, 5), (8.5, 7), (6, 10.5), (0.5, 12)], L.emit("lamp_globe", (1.0, 0.9, 0.78), 2.0), segs=32)
    light("L_lamp_light", cu + 14, cv + 12, 60, 4, size=0.05)
    # the armchair at 45 degrees (the renders' woven lounge chair)
    rc = IT["l-armchair"]
    ru, rv = (rc[0] + rc[2]) / 2, (rc[1] + rc[3]) / 2
    parts = []
    for j, (a, c_) in enumerate(((-27, -30), (27, -30), (-27, 22), (27, 22))):
        parts.append(bx(f"L_rattan_leg{j}", ru + a - 1.6, rv + c_ - 1.6, ru + a + 1.6, rv + c_ + 1.6, 0, 30 if c_ < 0 else 40, oak_d, bevel=0.5))
    parts.append(bx("L_rattan_seat", ru - 25, rv - 28, ru + 25, rv + 18, 30, 32, rattan))
    parts.append(bx("L_rattan_back", ru - 25, rv + 16, ru + 25, rv + 19, 32, 78, rattan))
    L.rotate_about(parts, ru, rv, 45 + 180)
    # TV wall = the south wall: low oak console and the television above it
    co, tvb = IT["l-console"], IT["l-tv"]
    bx("L_console", co[0], co[1], co[2], co[3], 0, 45, oak_l, bevel=0.3)
    for k in range(1, 4):
        cx = co[0] + (co[2] - co[0]) * k / 4
        bx(f"L_console_gap_{k}", cx - 0.2, co[1] - 0.3, cx + 0.2, co[1] + 0.1, 2, 44, dark)
    bx("L_tv", tvb[0], tvb[1] - 0.6, tvb[2], tvb[3] - 0.4, 105, 179, X["tvmat"], bevel=0.3)
    model("ceramic_vase_03", "L_console_vase", co[0] + 30, co[1] + 20, 45, c=C_DECO, fit=(None, None, 30))
    model("potted_plant_04", "L_console_branch", co[0] + 30, co[1] + 20, 70, c=C_DECO, fit=(None, None, 45))
    model("ceramic_vase_03", "L_console_deco_0", co[2] - 30, co[1] + 20, 45, c=C_DECO, fit=(None, None, 26))
    model("ceramic_vase_03", "L_console_deco_1", co[2] - 70, co[1] + 22, 45, c=C_DECO, fit=(None, None, 24))
    bx("L_console_books", co[0] + 90, co[1] + 8, co[0] + 120, co[1] + 30, 45, 49, X["book_a"], c=C_DECO, bevel=0.2)
    # wall sconce on the north wall above the sofa's west end (render 0060000)
    sc_u = s[0] + 50
    L.cyl("L_sconce_disc", sc_u, s[1] - 0.2, 175, 0, 11, C_DECO, oak_l, segs=40, axis="v", length=2.4)
    L.cyl("L_sconce_globe", sc_u, s[1] + 4, 175, 0, 5.5, C_DECO, L.emit("sconce_glow", (1.0, 0.86, 0.66), 4.0), segs=24, axis="v", length=8)
    light("L_sconce_light", sc_u, s[1] + 12, 175, 5)

'''
s = s[:a] + NEW + s[b:]
open(P, "w", encoding="utf-8").write(s)
print("patched")

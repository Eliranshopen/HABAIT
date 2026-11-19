"""Furniture and decor of the Hatzav house. Every drawn piece stands in the box the sheet draws
(geometry.json `items`); heights, finishes and small decor are ASSUMED design choices.
All sizes in cm, plan frame (u right, v down).
"""
import math

import bmesh
import bpy
from mathutils import Matrix

import hz_lib as L

H = 270


def build(geo, M, C_FURN, C_DECO, C_LIGHT):
    IT = {i["id"]: i["box"] for i in geo["items"]}
    made = []

    # ---------------- materials
    oak = L.pbr("oak_light", "oak_veneer_01", scale=1.1, tint=(1.0, 0.86, 0.66), rough_mul=1.05, bump=0.5)
    oak_d = L.pbr("oak_warm", "oak_veneer_01", scale=1.1, tint=(0.66, 0.43, 0.27), rough_mul=1.0, bump=0.5)
    white = L.flat("cabinet_white_matt", (0.80, 0.78, 0.74), 0.42)
    dark = L.flat("carcass_dark", (0.05, 0.04, 0.035), 0.6)
    marble = L.pbr("worktop_stone", "marble_01", scale=2.2, tint=(0.97, 0.95, 0.91), rough_mul=0.6, bump=0.1, gray=True, gain=1.25)
    linen = L.pbr("sofa_linen", "rough_linen", scale=0.45, tint=(0.80, 0.74, 0.65), bump=1.0, gray=True)
    boucle = L.pbr("boucle_cream", "rough_linen", scale=0.22, tint=(0.92, 0.89, 0.83), bump=1.6, gray=True)
    rug = L.pbr("rug_wool", "rough_linen", scale=0.9, tint=(0.82, 0.76, 0.66), bump=1.5, gray=True)
    bedding = L.pbr("bedding_linen", "cotton_jersey", scale=0.4, tint=(0.90, 0.87, 0.81), bump=0.7, gray=True)
    sage = L.pbr("bedding_clay", "cotton_jersey", scale=0.4, tint=(0.70, 0.52, 0.42), bump=0.7, gray=True)
    terra = L.pbr("pillow_terracotta", "rough_linen", scale=0.3, tint=(0.70, 0.40, 0.28), bump=1.0, gray=True)
    olive = L.pbr("pillow_ochre", "rough_linen", scale=0.3, tint=(0.80, 0.58, 0.32), bump=1.0, gray=True)
    ochre = olive
    blush = L.pbr("pillow_blush", "rough_linen", scale=0.3, tint=(0.74, 0.55, 0.50), bump=1.0, gray=True)
    throw = L.pbr("throw_white", "cotton_jersey", scale=0.25, tint=(0.93, 0.91, 0.87), bump=1.4, gray=True)
    brass = L.flat("brass", (0.62, 0.48, 0.30), 0.35, 0.9)
    books_m = [L.flat(f"book_{k}", c, 0.6) for k, c in enumerate(((0.86, 0.83, 0.77), (0.55, 0.50, 0.44), (0.70, 0.38, 0.30), (0.30, 0.32, 0.30)))]
    steel = M["steel"]
    black = M["black_metal"]
    blackglass = L.flat("black_glass", (0.006, 0.006, 0.007), 0.06, 0.0)
    ceramic = L.flat("ceramic_white", (0.86, 0.86, 0.85), 0.07)
    mirror = L.flat("mirror", (0.9, 0.9, 0.9), 0.02, 1.0)
    tvmat = L.flat("tv_screen", (0.004, 0.004, 0.005), 0.12)
    shade = L.emit("lamp_shade", (1.0, 0.80, 0.58), 2.2)
    art_mats = []
    for k, (c1, c2) in enumerate((((0.70, 0.52, 0.38), (0.88, 0.84, 0.76)), ((0.36, 0.44, 0.40), (0.86, 0.82, 0.74)),
                                  ((0.78, 0.66, 0.50), (0.30, 0.34, 0.36)))):
        m = bpy.data.materials.new(f"art_{k}")
        m.use_nodes = True
        nt = m.node_tree
        b = nt.nodes["Principled BSDF"]
        wv = nt.nodes.new("ShaderNodeTexNoise")
        wv.inputs["Scale"].default_value = 1.3 + k
        wv.inputs["Detail"].default_value = 1.5
        wv.inputs["Distortion"].default_value = 2.5
        rp = nt.nodes.new("ShaderNodeValToRGB")
        rp.color_ramp.elements[0].position = 0.42
        rp.color_ramp.elements[0].color = (*c1, 1)
        rp.color_ramp.elements[1].position = 0.58
        rp.color_ramp.elements[1].color = (*c2, 1)
        nt.links.new(wv.outputs["Fac"], rp.inputs["Fac"])
        nt.links.new(rp.outputs["Color"], b.inputs["Base Color"])
        b.inputs["Roughness"].default_value = 0.7
        art_mats.append(m)

    def bx(name, u0, v0, u1, v1, z0, z1, mat, c=C_FURN, **kw):
        made.append(name)
        return L.box(name, u0, v0, u1, v1, z0, z1, c, mat, **kw)

    def soft(name, u0, v0, u1, v1, z0, z1, mat, r=3.5, c=C_FURN):
        return bx(name, u0, v0, u1, v1, z0, z1, mat, c=c, bevel=r, seg=5, smooth=True)

    def union(name, solids, mat, c=C_FURN, bevel=0.0, voids=()):
        ob = L.voxel_mesh(name, list(solids), list(voids), c, [mat])
        if bevel:
            md = ob.modifiers.new("Bevel", "BEVEL")
            md.width = bevel / 100
            md.segments = 3
            md.limit_method = "ANGLE"
            for p in ob.data.polygons:
                p.use_smooth = True
            wn = ob.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
            wn.keep_sharp = False
        made.append(name)
        return ob

    def pillow(name, u, v, z, mat, w=46, h=46, t=13, lean=68, yaw=0, c=C_DECO):
        """a cushion standing on its edge at plan (u,v), bottom at z, leaning back by (90-lean) degrees; yaw = facing direction"""
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(w / 100, t / 100, h / 100), verts=bm.verts)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(t, w, h) * 0.42 / 100, segments=5, profile=0.5, affect="EDGES")
        mat4 = (Matrix.Translation(L.V(u, v, z)) @ Matrix.Rotation(math.radians(yaw), 4, "Z")
                @ Matrix.Rotation(math.radians(90 - lean), 4, "X") @ Matrix.Translation((0, 0, h / 200)))
        bmesh.ops.transform(bm, matrix=mat4, verts=bm.verts)
        made.append(name)
        return L.obj_from_bm(name, bm, c, [mat], smooth=True, weighted=True)

    def curtain(name, along_u, a0, a1, t, z0, z1, mat, waves=None, amp=3.2, c=C_DECO):
        """gathered curtain stack: a ribbon that waves across its plane"""
        n = waves or max(3, int((a1 - a0) / 5.5))
        steps = n * 10
        bm = bmesh.new()
        lo, hi = [], []
        for i in range(steps + 1):
            a = a0 + (a1 - a0) * i / steps
            off = amp * math.sin(2 * math.pi * n * i / steps)
            p = (a, t + off) if along_u else (t + off, a)
            lo.append(bm.verts.new(L.V(p[0], p[1], z0)))
            hi.append(bm.verts.new(L.V(p[0], p[1], z1)))
        for i in range(steps):
            bm.faces.new([lo[i], lo[i + 1], hi[i + 1], hi[i]])
        made.append(name)
        return L.obj_from_bm(name, bm, c, [mat], smooth=True)

    def frame(name, wall, pos, a0, a1, z0, z1, art, c=C_DECO):
        """picture on a wall face. wall 'u+': the wall face is at u=pos and the room is on the +u side; etc."""
        d = 1 if wall.endswith("+") else -1
        t0, t1 = sorted((pos, pos + d * 2.4))
        g0, g1 = sorted((pos + d * 0.9, pos + d * 1.5))
        if wall[0] == "u":
            L.box(name + "_frame", t0, a0, t1, a1, z0, z1, c, oak, bevel=0.3)
            L.box(name + "_art", g1 if d > 0 else g0 - 0.01, a0 + 4, (g1 if d > 0 else g0) + d * 1.0, a1 - 4, z0 + 4, z1 - 4, c, art)
        else:
            L.box(name + "_frame", a0, t0, a1, t1, z0, z1, c, oak, bevel=0.3)
            L.box(name + "_art", a0 + 4, g1 if d > 0 else g0 - 0.01, a1 - 4, (g1 if d > 0 else g0) + d * 1.0, z0 + 4, z1 - 4, c, art)
        made.append(name)

    def lamp(name, u, v, z, watts=4.0, c=C_DECO):
        L.cyl(name + "_base", u, v, z, z + 2.5, 6.5, c, black, segs=28)
        L.cyl(name + "_stem", u, v, z + 2.5, z + 24, 0.8, c, black, segs=12)
        L.cyl(name + "_shade", u, v, z + 22, z + 42, 10.5, c, shade, segs=36)
        ld = bpy.data.lights.new(name, "POINT")
        ld.energy = watts
        ld.color = (1.0, 0.78, 0.55)
        ld.shadow_soft_size = 0.06
        lo = bpy.data.objects.new(name, ld)
        lo.location = L.V(u, v, z + 32)
        C_LIGHT.objects.link(lo)
        made.append(name)

    FRONT = {"e": 90, "w": -90, "n": 180, "s": 0}  # imported models face -Y (plan south) by default
    yaw_fix = {}

    def model(mid, name, u, v, z=0, face="s", yaw=None, fit=None, c=C_FURN, uniform=True):
        try:
            root, size = L.import_model(mid, c, name)
        except Exception as exc:  # a missing decoration model never fails the build
            print("MODEL WARNING", mid, exc)
            return None, None
        y = (FRONT[face] if yaw is None else yaw) + yaw_fix.get(mid, 0)
        L.place(root, size, u, v, z, y, fit=fit, uniform=uniform)
        made.append(name)
        return root, size

    # =================================================================== PUBLIC SPACE (developer interior renders)
    import hz_public
    X = {"bx": bx, "soft": soft, "union": union, "pillow": pillow, "model": model, "oak_dark": oak_d, "oak_light": oak,
         "stone": marble, "linen": linen, "rug": rug, "black": black, "dark": dark, "blackglass": blackglass, "steel": steel,
         "terra": terra, "ochre": ochre, "blush": blush, "boucle": boucle, "throw": throw, "tvmat": tvmat, "brass": brass,
         "book_a": books_m[0], "book_b": books_m[1], "book_c": books_m[2], "book_d": books_m[3], "C_DECO": C_DECO}
    hz_public.build(geo, M, X, C_FURN, C_DECO, C_LIGHT, made)

    # =================================================================== BEDROOM
    bd = IT["b-bed"]
    hb_u = bd[2]
    bx("B_bed_base", bd[0] + 1, bd[1] + 1, hb_u - 6, bd[3] - 1, 10, 30, linen, bevel=1.2, seg=3)
    for k, (lu, lv) in enumerate(((bd[0] + 6, bd[1] + 6), (bd[0] + 6, bd[3] - 11), (hb_u - 16, bd[1] + 6), (hb_u - 16, bd[3] - 11))):
        bx(f"B_bed_foot_{k}", lu, lv, lu + 5, lv + 5, 0, 10, black)
    bx("B_headboard", hb_u - 6, bd[1] - 8, hb_u, bd[3] + 8, 10, 112, linen, bevel=1.8, seg=4)
    soft("B_mattress", bd[0] + 2, bd[1] + 2, hb_u - 6.5, bd[3] - 2, 30, 53, bedding, r=4)
    soft("B_duvet", bd[0] + 1, bd[1] - 1, hb_u - 62, bd[3] + 1, 50, 60, bedding, r=4.5)
    soft("B_duvet_fold", hb_u - 78, bd[1] - 1, hb_u - 58, bd[3] + 1, 57, 64, bedding, r=3)
    soft("B_throw", bd[0] + 1.5, bd[1] - 2, bd[0] + 52, bd[3] + 2, 58, 63, sage, r=2.4, c=C_DECO)
    pc = (bd[1] + bd[3]) / 2
    for k, vc in enumerate((pc - 38, pc + 38)):
        pillow(f"B_pillow_{k}", hb_u - 20, vc, 53, bedding, w=68, h=46, t=15, lean=58, yaw=90)
        pillow(f"B_pillow_front_{k}", hb_u - 37, vc + (4 if k else -4), 53, boucle if k else terra, w=46, h=44, t=13, lean=62, yaw=90)
    for k, key in enumerate(("b-night-n", "b-night-s")):
        nb = IT[key]
        bx(f"B_night_{k}", nb[0] + 1, nb[1] + 1, nb[2] - 1, nb[3] - 1, 14, 48, oak, bevel=0.4)
        bx(f"B_night_{k}_gap", nb[0] + 0.7, nb[1] + 2, nb[0] + 1.1, nb[3] - 2, 30.6, 31.4, dark)
        for j, (lu, lv) in enumerate(((nb[0] + 3, nb[1] + 3), (nb[2] - 6, nb[1] + 3), (nb[0] + 3, nb[3] - 6), (nb[2] - 6, nb[3] - 6))):
            bx(f"B_night_{k}_leg_{j}", lu, lv, lu + 3, lv + 3, 0, 14, black)
        lamp(f"B_lamp_{k}", (nb[0] + nb[2]) / 2 + 3, (nb[1] + nb[3]) / 2, 48)
    wd = IT["b-wardrobe"]
    bx("B_wardrobe_carcass", wd[0], wd[1] + 2, wd[2], wd[3], 0, 240, white)
    n3 = 3
    for k in range(n3):
        d0 = wd[0] + (wd[2] - wd[0]) * k / n3 + 0.25
        d1 = wd[0] + (wd[2] - wd[0]) * (k + 1) / n3 - 0.25
        bx(f"B_wardrobe_door_{k}", d0, wd[1], d1, wd[1] + 2, 8, 239.5, white, bevel=0.15)
        hx = d1 - 5 if k != 1 else d0 + 3
        bx(f"B_wardrobe_handle_{k}", hx, wd[1] - 2.6, hx + 1.4, wd[1] - 1.2, 96, 126, black, bevel=0.3)
        for j, zz in enumerate((98, 123)):
            bx(f"B_wardrobe_handle_{k}_{j}", hx + 0.2, wd[1] - 1.2, hx + 1.2, wd[1], zz, zz + 1.2, black)
    bn = IT["b-band"]
    bx("B_wall_panel", bn[0], bn[1], bn[0] + 2.2, bn[3], 0, H - 0.2, oak)
    bx("B_wall_shelf", bn[0] + 2.2, bn[1] + 14, bn[2], bn[3] - 14, 42, 47, oak, bevel=0.3)
    tb = IT["b-tv"]
    bx("B_tv", bn[0] + 4.2, tb[1], bn[0] + 7.2, tb[3], 88, 157, tvmat, bevel=0.3)
    bx("B_tv_mount", bn[0] + 2.2, (tb[1] + tb[3]) / 2 - 12, bn[0] + 4.2, (tb[1] + tb[3]) / 2 + 12, 108, 136, dark)
    model("ceramic_vase_03", "B_shelf_vase", bn[0] + 12, bn[1] + 32, 47, c=C_DECO, fit=(None, None, 26))
    bx("B_shelf_books", bn[0] + 4, bn[3] - 52, bn[0] + 18, bn[3] - 28, 47, 53, L.flat("book_d", (0.58, 0.60, 0.55), 0.6), c=C_DECO, bevel=0.2)
    wn = [o for o in geo["openings"] if o["id"] == "win-bedroom"][0]["box"]
    face_n = wn[3]
    L.cyl("B_curtain_rail", (wn[0] + wn[2]) / 2, face_n + 6, 228, 0, 0.9, C_DECO, black, segs=12, axis="u", length=(wn[2] - wn[0]) + 70)
    curtain("B_curtain_w", True, wn[0] - 30, wn[0] + 4, face_n + 6, 1.5, 227, L.sheer("curtain_linen"))
    curtain("B_curtain_e", True, wn[2] - 4, wn[2] + 30, face_n + 6, 1.5, 227, L.sheer("curtain_linen"))
    frame("B_art", "u-", hb_u + 0.0, pc - 45, pc + 45, 128, 192, art_mats[1])

    # =================================================================== SAFE ROOM
    sb_ = IT["s-bed"]
    bx("S_bed_base", sb_[0] + 1, sb_[1] + 7, sb_[2] - 1, sb_[3] - 1, 10, 30, boucle, bevel=2.0, seg=4, smooth=True)
    for k, (lu, lv) in enumerate(((sb_[0] + 5, sb_[1] + 10), (sb_[2] - 10, sb_[1] + 10), (sb_[0] + 5, sb_[3] - 10), (sb_[2] - 10, sb_[3] - 10))):
        bx(f"S_bed_foot_{k}", lu, lv, lu + 5, lv + 5, 0, 10, black)
    bx("S_headboard", sb_[0], sb_[1], sb_[2], sb_[1] + 7, 10, 100, boucle, bevel=3.4, seg=6, smooth=True)  # renders: rounded upholstered headboard
    soft("S_mattress", sb_[0] + 2, sb_[1] + 5.5, sb_[2] - 2, sb_[3] - 2, 30, 50, bedding, r=4)
    soft("S_duvet", sb_[0] + 0.5, sb_[1] + 62, sb_[2] + 0.5, sb_[3] - 1, 47, 56, sage, r=4)
    pillow("S_pillow", (sb_[0] + sb_[2]) / 2, sb_[1] + 22, 50, bedding, w=62, h=42, t=14, lean=55, yaw=0)
    pillow("S_pillow_front", (sb_[0] + sb_[2]) / 2 + 3, sb_[1] + 38, 50, terra, w=40, h=40, t=12, lean=60, yaw=0)
    dk = IT["s-desk"]
    bx("S_desk_top", dk[0], dk[1], dk[2], dk[3], 72, 75, oak, bevel=0.3)
    bx("S_desk_side", dk[0] + 2, dk[1], dk[2], dk[1] + 2.5, 0, 72, white)
    bx("S_desk_drawers", dk[0] + 2, dk[3] - 44, dk[2], dk[3] - 0.5, 0, 72, white, bevel=0.2)
    for k, (z0, z1) in enumerate(((2, 24.5), (25, 47.5), (48, 71))):
        bx(f"S_desk_drawer_{k}", dk[0], dk[3] - 43.7, dk[0] + 2, dk[3] - 0.8, z0, z1, white, bevel=0.15)
    ch = IT["s-chair"]
    model("dining_chair_02", "S_chair", (ch[0] + ch[2]) / 2 + 8, (ch[1] + ch[3]) / 2, 0, face="e")
    mv = (ch[1] + ch[3]) / 2
    L.cyl("S_monitor_foot", dk[2] - 16, mv, 75, 76.2, 9, C_FURN, black, segs=32)
    bx("S_monitor_neck", dk[2] - 14.5, mv - 2, dk[2] - 13, mv + 2, 76, 100, black)
    bx("S_monitor", dk[2] - 16, mv - 30, dk[2] - 14.2, mv + 30, 86, 122, tvmat, bevel=0.3)
    bx("S_keyboard", dk[0] + 12, mv - 21, dk[0] + 26, mv + 21, 75, 76.6, L.flat("keyboard", (0.10, 0.10, 0.11), 0.5), bevel=0.3)
    model("desk_lamp_arm_01", "S_desk_lamp", dk[2] - 18, dk[1] + 20, 75, yaw=200, c=C_DECO)
    cl = IT["s-closet"]
    # renders (Corona-Camera0030000): an open oak bookcase where the sheet draws the closet (DERIVED)
    import hz_public
    hz_public.shelving("S_bookcase", cl, 240, oak, bx, columns=2, rows=6, wall_lo=False)
    for k, (fv, z) in enumerate(((0.25, 49), (0.75, 129), (0.3, 169), (0.7, 89))):
        model("ceramic_vase_03", f"S_toy_{k}", (cl[0] + cl[2]) / 2 - 4, cl[1] + (cl[3] - cl[1]) * fv, z, c=C_DECO, fit=(None, None, 18))
    # paper pendant (render: a large white paper lantern)
    lan = [(1, 0), (12, 2), (22, 6), (28, 12), (28, 16), (22, 22), (12, 26), (1, 28)]
    from hz_public import H as _H
    pu, pv = (sb_[2] + cl[0]) / 2, (sb_[1] + sb_[3]) / 2
    bm = bmesh.new()
    rings = []
    for r, z in lan:
        rings.append([bm.verts.new(L.V(pu + r * math.cos(2 * math.pi * k / 48), pv + r * math.sin(2 * math.pi * k / 48), 205 + z)) for k in range(48)])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(48):
            bm.faces.new([r0[k], r0[(k + 1) % 48], r1[(k + 1) % 48], r1[k]])
    L.obj_from_bm("S_paper_lantern", bm, C_DECO, [L.emit("paper_shade", (1.0, 0.93, 0.82), 3.0)], smooth=True)
    L.cyl("S_lantern_cord", pu, pv, 233, H, 0.3, C_DECO, black, segs=8)
    pl = bpy.data.lights.new("S_lantern", "POINT")
    pl.energy = 18
    pl.color = (1.0, 0.84, 0.64)
    po = bpy.data.objects.new("S_lantern", pl)
    po.location = L.V(pu, pv, 215)
    C_LIGHT.objects.link(po)
    bx("S_rug", sb_[2] + 10, sb_[1] + 70, sb_[2] + 105, sb_[1] + 200, 0, 1.2, boucle, bevel=0.4, c=C_DECO)
    frame("S_art", "u+", sb_[0] - 0.0, sb_[1] + 85, sb_[1] + 155, 122, 172, art_mats[2])
    # 2026-11-18 render fix (RENDER-AUDIT row 13): full-height sheer on a ceiling track, stacked both sides (the bedroom's build)
    ws = [o for o in geo["openings"] if o["id"] == "win-saferoom"][0]["box"]
    face_s = ws[3]
    bx("S_curtain_track", ws[0] - 34, face_s + 3, ws[2] + 34, face_s + 9, H - 3, H, white, c=C_DECO)
    curtain("S_curtain_w", True, ws[0] - 32, ws[0] + 6, face_s + 6, 1.5, H - 3.5, L.sheer("curtain_linen"))
    curtain("S_curtain_e", True, ws[2] - 6, ws[2] + 32, face_s + 6, 1.5, H - 3.5, L.sheer("curtain_linen"))

    # =================================================================== BATHROOM
    tile = M["bath_tile"]
    bo = IT["t-wc-wall"]
    bx("T_build_out", bo[0], bo[1], bo[2], bo[3], 0, 118, tile)
    bx("T_build_out_cap", bo[0], bo[1], bo[2] + 1, bo[3], 118, 120, marble, bevel=0.3)
    wc = IT["t-wc"]
    wcv = (wc[1] + wc[3]) / 2
    bx("T_flush_plate", bo[2], wcv - 12, bo[2] + 0.7, wcv + 12, 98, 114, steel, bevel=0.2)
    soft("T_wc_bowl", bo[2], wcv - 18, bo[2] + 53, wcv + 18, 20, 41, ceramic, r=8)
    soft("T_wc_seat", bo[2] + 1.5, wcv - 18.5, bo[2] + 53.5, wcv + 18.5, 41.2, 44.4, ceramic, r=1.4)
    # 2026-11-18 render fix (RENDER-AUDIT row 17): full-height warm-oak wall cabinet over the WC build-out, open oak niche below it
    cf = bo[2] + 2  # the doors stand 2 cm proud of the build-out face
    bx("T_niche_back", bo[0], bo[1], bo[0] + 1.5, bo[3], 120, 150, oak_d)
    bx("T_niche_shelf", bo[0], bo[1], cf, bo[3], 120, 122.5, oak_d, bevel=0.2)
    bx("T_niche_side_n", bo[0], bo[1], cf, bo[1] + 2, 122.5, 150, oak_d)
    bx("T_niche_side_s", bo[0], bo[3] - 2, cf, bo[3], 122.5, 150, oak_d)
    bx("T_wallcab_carcass", bo[0], bo[1], bo[2], bo[3], 150, H - 1, oak_d)
    vm = (bo[1] + bo[3]) / 2
    for k, (a0, a1) in enumerate(((bo[1], vm), (vm, bo[3]))):
        bx(f"T_wallcab_door_{k}", bo[2], a0 + 0.25, cf, a1 - 0.25, 150.0, H - 1, oak_d, bevel=0.15)
    for k, (dv, h_, r_) in enumerate(((-12, 11, 5.0), (2, 8, 4.4))):  # two lidded ceramic jars in the niche (render)
        jv = vm + dv
        L.cyl(f"T_jar_{k}", bo[0] + 11, jv, 122.5, 122.5 + h_, r_, C_DECO, ceramic, segs=32, bevel=0.6)
        L.cyl(f"T_jar_{k}_lid", bo[0] + 11, jv, 122.5 + h_, 122.5 + h_ + 2, r_ - 0.6, C_DECO, ceramic, segs=32, bevel=0.5)
        made.append(f"T_jar_{k}")
    sh = IT["t-shower"]
    # 2026-11-18 render fix (row 18): linen-white shower curtain on a slim black ceiling rail instead of the smoked glass
    sc_m = L.pbr("shower_curtain_linen", "rough_linen", scale=0.3, tint=(0.92, 0.89, 0.84), bump=0.8, gray=True)
    rz, rv = 214, sh[1] + 4
    ru1 = sh[2] - 4
    L.cyl("T_curtain_rail_n", (sh[0] + ru1) / 2, rv, rz, 0, 0.8, C_FURN, black, segs=12, axis="u", length=ru1 - sh[0])
    L.cyl("T_curtain_rail_e", ru1, (rv + sh[3]) / 2, rz, 0, 0.8, C_FURN, black, segs=12, axis="v", length=sh[3] - rv)
    L.cyl("T_curtain_rail_drop", ru1, rv, rz, H, 0.6, C_FURN, black, segs=12)
    made.extend(["T_curtain_rail_n", "T_curtain_rail_e", "T_curtain_rail_drop"])
    curtain("T_shower_curtain_n", True, sh[0] + 1, sh[0] + 46, rv, 3, rz - 1, sc_m, amp=2.6)
    curtain("T_shower_curtain_e", False, rv + 1, sh[3] - 1, ru1, 3, rz - 1, sc_m, amp=2.6)
    scu, scv = sh[0] + 34, (sh[1] + sh[3]) / 2
    L.cyl("T_shower_arm", sh[0] + 17, scv, 208, 0, 1.0, C_FURN, black, segs=12, axis="u", length=34)
    L.cyl("T_shower_head", scu, scv, 205.5, 207.2, 11, C_FURN, black, segs=40)
    bx("T_shower_mixer", sh[0], scv - 8, sh[0] + 2.2, scv + 8, 105, 121, black, bevel=0.4)
    L.cyl("T_shower_knob", sh[0] + 3.6, scv, 113, 0, 2.6, C_FURN, black, segs=24, axis="u", length=3)
    vn = IT["t-vanity"]
    # 2026-11-18 render fix (row 19): wall-hung warm-oak drawer unit (one drawer over two), the basin cut into a white stone top,
    # black taps on the wall; the open oak shelf with towels below is kept
    fv0 = vn[1]  # drawer fronts face the room (north)
    bx("T_vanity_drawer_top", vn[0] + 1.75, fv0, vn[2] - 0.25, fv0 + 2, 61.5, 80, oak_d, bevel=0.15)
    vmid = (vn[0] + 1.5 + vn[2]) / 2
    bx("T_vanity_drawer_0", vn[0] + 1.75, fv0, vmid - 0.25, fv0 + 2, 40, 61, oak_d, bevel=0.15)
    bx("T_vanity_drawer_1", vmid + 0.25, fv0, vn[2] - 0.25, fv0 + 2, 40, 61, oak_d, bevel=0.15)
    bx("T_vanity_shelf", vn[0] + 1.5, vn[1] + 4, vn[2], vn[3], 20, 23, oak_d, bevel=0.3)
    soft("T_towels", vn[0] + 20, vn[1] + 10, vn[0] + 50, vn[3] - 8, 23, 33, bedding, r=2.5, c=C_DECO)
    bcu = (vn[0] + vn[2]) / 2
    bvoid = (bcu - 22, vn[1] + 7, bcu + 22, vn[3] - 9)
    union("T_vanity_body", [(vn[0] + 1.5, fv0 + 2, vn[2], vn[3], 40, 80)], oak_d,
          voids=[(bvoid[0] - 1, bvoid[1] - 1, bvoid[2] + 1, bvoid[3] + 1, 67.9, 81)])
    solid_w = L.flat("solid_surface_white", (0.86, 0.85, 0.82), 0.22)  # render: a white integrated top and basin
    union("T_vanity_top", [(vn[0], vn[1], vn[2], vn[3], 80, 83.5)], solid_w, voids=[(*bvoid, 79, 84.5)])
    union("T_basin", [(bvoid[0] - 1, bvoid[1] - 1, bvoid[2] + 1, bvoid[3] + 1, 68, 80)], solid_w,
          voids=[(bvoid[0], bvoid[1], bvoid[2], bvoid[3], 70, 81)])
    tz = 96  # wall taps under the mirror
    L.cyl("T_tap_plate", bcu, vn[3] - 0.4, tz, 0, 3.0, C_FURN, black, segs=28, axis="v", length=0.8)
    L.cyl("T_tap_spout", bcu, vn[3] - 8.5, tz, 0, 1.0, C_FURN, black, segs=16, axis="v", length=16)
    L.cyl("T_tap_nozzle", bcu, vn[3] - 15.5, tz - 3, tz + 0.8, 1.0, C_FURN, black, segs=16)
    for k, du in enumerate((-11, 11)):
        L.cyl(f"T_tap_lever_base_{k}", bcu + du, vn[3] - 2, tz, 0, 1.6, C_FURN, black, segs=20, axis="v", length=4)
        bx(f"T_tap_lever_{k}", bcu + du - 0.6, vn[3] - 4.6, bcu + du + 0.6, vn[3] - 3.2, tz - 0.6, tz + 7, black, bevel=0.2)
    made.extend(["T_tap_plate", "T_tap_spout", "T_tap_nozzle"])
    bx("T_mirror_frame", vn[0] + 2, vn[3] - 1.8, vn[2] - 2, vn[3], 110, 190, black)
    bx("T_mirror", vn[0] + 3.2, vn[3] - 2.4, vn[2] - 3.2, vn[3] - 1.8, 111.2, 188.8, mirror)
    # 2026-11-18 render fix (row 20): two pairs of small white glass globe wall lights at the mirror's sides, warm, modest
    globe = L.emit("globe_opal", (1.0, 0.90, 0.76), 1.2)
    for k, gu in enumerate((vn[0] + 8, vn[2] - 8)):
        for j, gz in enumerate((138, 153)):
            L.cyl(f"T_sconce_{k}_{j}_plate", gu, vn[3] - 3.0, gz, 0, 2.2, C_DECO, black, segs=20, axis="v", length=1.0)
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=0.05)
            bmesh.ops.translate(bm, verts=bm.verts, vec=L.V(gu, vn[3] - 3.5 - 4.8, gz))
            L.obj_from_bm(f"T_sconce_{k}_{j}", bm, C_DECO, [globe], smooth=True)
            made.append(f"T_sconce_{k}_{j}")
        sl = bpy.data.lights.new(f"T_sconce_{k}", "POINT")
        sl.energy = 2.5
        sl.color = (1.0, 0.82, 0.62)
        sl.shadow_soft_size = 0.06
        so = bpy.data.objects.new(f"T_sconce_{k}", sl)
        so.location = L.V(gu, vn[3] - 12, 145.5)
        C_LIGHT.objects.link(so)
    soft("T_towel", vn[0] + 8, vn[1] + 8, vn[0] + 22, vn[1] + 36, 83.5, 88, bedding, r=1.8, c=C_DECO)

    # =================================================================== DECK
    dk_ = [e for e in geo["outside"] if e["id"] == "deck"][0]["box"]
    model("outdoor_table_chair_set_01", "X_bistro", dk_[0] + 175, dk_[1] + 170, -2, yaw=25, c=C_DECO)
    model("planter_pot_clay", "X_pot", dk_[0] + 40, dk_[3] - 45, -2, c=C_DECO, fit=(None, None, 55))
    model("potted_plant_02", "X_pot_plant", dk_[0] + 40, dk_[3] - 45, 30, c=C_DECO, fit=(None, None, 80))

    return {"objects": len(made), "note": "drawn pieces stand in their sheet boxes; heights, finishes, decor are ASSUMED"}

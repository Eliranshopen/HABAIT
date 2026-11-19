"""One-off patch (2026-11-18): place_items.PLACE for the sales-sheet layout (no island; corner sofa; table north-south)."""
P = "scripts/blender/place_items.py"
s = open(P, encoding="utf-8").read()
a = s.index('CH = [')
b = s.index('\n}\n', a) + 3
NEW = '''CH = ["D_d-chair-w1_", "D_d-chair-w2_", "D_d-chair-w3_", "D_d-chair-e1_", "D_d-chair-e2_", "D_d-chair-e3_"]
# 2026-11-18, the sales sheet's layout (Eliran: «there is no island in the plan … create the 3d walk around by the plan»):
# no island and no bar stools or island pendants; the corner sofa; the table north-south; nested coffee tables; the armchair at 45 degrees
PLACE = {
    "sofa_corner": P(["L_sofa_", "L_chaise_", "L_pillow_", "L_throw"], fit="inside", category="sofa", room="living", he="ספה פינתית מפשתן", en="linen corner sofa"),
    "lounge_chair": P(["L_rattan_"], face="L_nest_big", category="armchair", room="living", he="כורסת חבל קלועה", en="woven cord lounge chair"),
    "rattan_pendant": P(["D_rattan_0", "D_rattan_1"], fit="height", each=True, hang=True, category="pendant", room="dining", he="מנורת ראטן תלויה", en="rattan pendant"),
    "dining_chair": P(CH, each=True, face="D_table_top", category="dining_chair", room="dining", he="כיסא אוכל מרופד", en="upholstered dining chair"),
    "dining_table": P(["D_table_"], yaw=90.0, category="dining_table", room="dining", he="שולחן אוכל מאלון", en="oak dining table"),
    "coffee_nest": P(["L_nest_"], src="alt_ctable_nesting", fit="inside", category="coffee_table", room="living", he="שולחנות קפה מקוננים", en="nested oak coffee tables"),
    "mushroom_lamp": P(["L_lamp_base", "L_lamp_globe"], fit="height", category="lamp", room="living", he="מנורת שולחן", en="table lamp"),
    "wall_sconce": P(["L_sconce_disc", "L_sconce_globe"], yaw=0.0, category="sconce", room="living", he="מנורת קיר", en="wall sconce"),
    "vase_branches": P(["L_console_vase", "L_console_branch"], fit="height", category="decor", room="living", he="אגרטל עם ענפים", en="vase with branches"),
    "ribbed_vase": P(["L_console_deco_0"], fit="height", category="decor", room="living", he="אגרטל קרמיקה", en="ribbed vase"),
    "globe_lamp": P(["L_console_deco_1"], fit="height", category="lamp", room="living", he="מנורת כדור", en="globe lamp"),
    "stone_bowl": P(["D_bowl", "D_apple"], category="decor", room="dining", he="קערת אבן", en="stone bowl"),
    "kitchen_props": P(["K_jug"], fit="height", category="decor", room="kitchen", he="קרשי חיתוך וקנקן", en="boards and carafe"),
    "kids_bed": P(["S_bed_base", "S_bed_foot", "S_headboard", "S_mattress", "S_duvet", "S_pillow"], fit="inside", category="bed", room="saferoom", he="מיטת ילדים מרופדת", en="upholstered single bed"),
    "nightstand": P(["B_night_0", "B_night_1"], each=True, yaw=-90.0, category="nightstand", room="bedroom", he="שידת לילה", en="nightstand"),
    "paper_lantern": P(["S_paper_lantern"], hang=True, category="pendant", room="saferoom", he="מנורת נייר אובלית", en="paper lantern"),
    "kids_rug": P(["S_rug"], fit="inside", category="rug", room="saferoom", he="שטיח צמר", en="wool rug"),
}
'''
s = s[:a] + NEW + s[b:]
# P(...) takes the GLB's source id (src) besides the piece id
s = s.replace('def P(prefixes, fit="long", yaw=0.0, each=False, hang=False, face=None, category=None, room=None, he=None, en=None):\n    return dict(prefixes=prefixes, fit=fit, yaw=yaw, each=each, hang=hang, face=face, category=category, room=room, he=he, en=en)',
              'def P(prefixes, fit="long", yaw=0.0, each=False, hang=False, face=None, category=None, room=None, he=None, en=None, src=None):\n    return dict(prefixes=prefixes, fit=fit, yaw=yaw, each=each, hang=hang, face=face, category=category, room=room, he=he, en=en, src=src)')
# fit "inside": the largest uniform scale that keeps the whole footprint inside the old piece's (the kids' bed came out 30 cm wide)
s = s.replace('    s = target.z / size.z if how == "height" else max(target.x, target.y) / max(size.x, size.y)',
              '    if how == "height":\n        s = target.z / size.z\n    elif how == "inside":\n        s = min(target.x / size.x, target.y / size.y)\n    else:\n        s = max(target.x, target.y) / max(size.x, size.y)')
s = s.replace('        web = os.path.join(root_dir, "walkaround", "items", "glb", iid + ".glb")   # the slimmed copy (optimize_glb.py)\n        glb = web if os.path.exists(web) else os.path.join(root_dir, "items", "glb", iid + ".glb")',
              '        gid = spec.get("src") or iid\n        web = os.path.join(root_dir, "walkaround", "items", "glb", gid + ".glb")   # the slimmed copy (optimize_glb.py)\n        glb = web if os.path.exists(web) else os.path.join(root_dir, "items", "glb", gid + ".glb")')
s = s.replace('rec.append({"id": uid, "src": iid,', 'rec.append({"id": uid, "src": spec.get("src") or iid,')
open(P, "w", encoding="utf-8").write(s)
print("patched", s.count('"src"'))

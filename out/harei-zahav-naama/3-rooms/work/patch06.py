p = "scripts/06_fetch_assets.py"
s = open(p, encoding="utf-8").read()
old = '    "island_tree_02": "1k",\n}'
new = '    "island_tree_02": "1k", "modern_arm_chair_01": "1k", "modern_ceiling_lamp_01": "1k", "modern_coffee_table_01": "1k",\n    "potted_plant_02": "1k", "outdoor_table_chair_set_01": "1k", "hanging_picture_frame_01": "1k", "sofa_03": "1k",\n}'
assert old in s
open(p, "w", encoding="utf-8", newline="\n").write(s.replace(old, new))

import re, sys
p = "scripts/04_geometry.py"
s = open(p, encoding="utf-8").read()
a = s.index('wall("ext-n-saferoom"'); b = s.index("# ---------------------------------------------------------------- openings")
walls = '''# Interior faces are set so that every PRINTED room dimension is met exactly (the print wins over the drawn
# pixels); they sit 0-2 cm from the drawn wall edges, inside the sheet's anti-aliasing. The eight overall
# dimensions are exact as drawn.
wall("ext-n-saferoom", (480, 267, 864, 301), note="34 cm, north wall of the safe room")
wall("ext-n-bedroom", (864, 267, 1205, 291), note="24 cm")
wall("ext-w-saferoom", (480, 267, 509, 591), note="29 cm")
wall("ext-w-bath", (480, 591, 504, 807), note="24 cm")
wall("ext-e-bedroom", (1179, 267, 1205, 703), note="26 cm")
wall("int-saferoom-bedroom", (844, 267, 864, 572), note="20 cm, safe room east wall")
wall("int-saferoom-s", (480, 571, 884, 591), note="20 cm, safe room south wall, with the safe-room door")
wall("int-hall-bedroom", (874, 591, 884, 703), note="10 cm partition with the bedroom door")
wall("int-bath-e", (684, 591, 692, 793), note="8 cm partition with the bathroom door")
wall("int-bath-s", (504, 781, 692, 793), note="12 cm partition bathroom | public space")
wall("ext-sw-corner", (480, 781, 554, 807), note="outer wall step at the entrance")
wall("ext-w-public", (530, 807, 554, 1317), note="24 cm, west wall of the public space, with the entrance door")
wall("int-kitchen-nib", (554, 925, 612, 933), note="8 cm nib beside the entrance, 58 cm long")
wall("ext-s", (530, 1293, 1310, 1317), note="24 cm south wall")
wall("ext-e-public", (1284, 703, 1310, 1317), note="26 cm east wall with the sliding door")
wall("ext-n-public-east", (1179, 703, 1310, 728), note="25 cm, north wall of the living room's east part (the bedroom block is set back 105 cm)")
wall("int-bedroom-living", (884, 701, 1179, 711), note="10 cm partition bedroom | living room")
wall("shaft", (805, 703, 884, 793), note="closed service shaft 79 x 90 cm, drawn with a crossed circle; modelled as a solid block")

'''
s = s[:a] + walls + s[b:]
rep = [
 ('opening("win-saferoom", "window", (639, 267, 742, 300)', 'opening("win-saferoom", "window", (639, 267, 742, 301)'),
 ('opening("win-bedroom", "window", (990, 267, 1112, 290)', 'opening("win-bedroom", "window", (990, 267, 1112, 291)'),
 ('opening("door-sliding", "sliding_door", (1286, 973, 1310, 1275)', 'opening("door-sliding", "sliding_door", (1284, 973, 1310, 1275)'),
 ('opening("door-entrance", "door", (530, 816, 553, 918)', 'opening("door-entrance", "door", (530, 816, 554, 918)'),
 ('opening("door-saferoom", "door", (702, 571, 785, 590), "int-saferoom-s-west"', 'opening("door-saferoom", "door", (702, 571, 785, 591), "int-saferoom-s"'),
 ('opening("door-bedroom", "door", (874, 605, 884, 686)', 'opening("door-bedroom", "door", (874, 605, 884, 686)'),
 ('opening("door-bath", "door", (685, 600, 692, 681)', 'opening("door-bath", "door", (684, 600, 692, 681)'),
 ('"poly_px": [(553, 792), (692, 792), (805, 792), (884, 792), (884, 711), (1181, 711), (1181, 726), (1286, 726),\n                 (1286, 1293), (553, 1293)]', '"poly_px": [(554, 793), (884, 793), (884, 711), (1179, 711), (1179, 728), (1284, 728), (1284, 1293), (554, 1293)]'),
 ('"poly_px": [(692, 590), (874, 590), (874, 703), (805, 703), (805, 792), (692, 792)]', '"poly_px": [(692, 591), (874, 591), (874, 703), (805, 703), (805, 793), (692, 793)]'),
 ('"poly_px": [(508, 300), (845, 300), (845, 571), (508, 571)]', '"poly_px": [(509, 301), (844, 301), (844, 571), (509, 571)]'),
 ('"poly_px": [(863, 290), (1181, 290), (1181, 703), (884, 703), (884, 590), (883, 590), (883, 572), (863, 572)]', '"poly_px": [(864, 291), (1179, 291), (1179, 701), (884, 701), (884, 572), (864, 572)]'),
 ('"poly_px": [(503, 590), (685, 590), (685, 783), (503, 783)]', '"poly_px": [(504, 591), (684, 591), (684, 781), (504, 781)]'),
 ('("safe room width", 335, "x", 508, 845)', '("safe room width", 335, "x", 509, 844)'),
 ('("safe room depth", 270, "y", 300, 571)', '("safe room depth", 270, "y", 301, 571)'),
 ('("bedroom width (wall to wall)", 315, "x", 863, 1181)', '("bedroom width (wall to wall)", 315, "x", 864, 1179)'),
 ('("bedroom depth", 410, "y", 290, 703)', '("bedroom depth", 410, "y", 291, 701)'),
 ('("bedroom clear width (to the 20 cm band)", 295, "x", 883, 1181)', '("bedroom clear width (to the 20 cm band)", 295, "x", 884, 1179)'),
 ('("bathroom width", 180, "x", 503, 685)', '("bathroom width", 180, "x", 504, 684)'),
 ('("bathroom depth", 190, "y", 590, 783)', '("bathroom depth", 190, "y", 591, 781)'),
 ('("public space width", 730, "x", 553, 1286)', '("public space width", 730, "x", 554, 1284)'),
 ('("public space depth, kitchen side", 500, "y", 792, 1293)', '("public space depth, kitchen side", 500, "y", 793, 1293)'),
 ('("public space depth, living side", 565, "y", 726, 1293)', '("public space depth, living side", 565, "y", 728, 1293)'),
 ('("living width east of the shaft", 400, "x", 884, 1286)', '("living width east of the shaft", 400, "x", 884, 1284)'),
 ('(555, 935, 620, 1023)', '(554, 935, 620, 1023)'), ('(555, 1028, 612, 1090)', '(554, 1028, 612, 1090)'),
 ('(553, 1090, 612, 1293)', '(554, 1090, 612, 1293)'),
 ('"double_bed", "bedroom", (980, 358, 1181, 518)', '"double_bed", "bedroom", (979, 358, 1179, 518)'),
 ('(1140, 318, 1181, 358)', '(1139, 318, 1179, 358)'), ('(1140, 518, 1181, 558)', '(1139, 518, 1179, 558)'),
 ('"wardrobe", "bedroom", (980, 643, 1181, 703)', '"wardrobe", "bedroom", (979, 641, 1179, 701)'),
 ('"wall_unit", "bedroom", (863, 291, 883, 572)', '"wall_unit", "bedroom", (864, 291, 884, 572)'),
 ('"tv", "bedroom", (866, 356, 874, 478)', '"tv", "bedroom", (868, 356, 876, 478)'),
 ('"single_bed", "saferoom", (508, 300, 598, 500)', '"single_bed", "saferoom", (509, 301, 599, 501)'),
 ('"desk", "saferoom", (783, 300, 845, 440)', '"desk", "saferoom", (782, 301, 844, 441)'),
 ('"wardrobe", "saferoom", (783, 440, 845, 571)', '"wardrobe", "saferoom", (782, 441, 844, 571)'),
 ('"build_out", "bath", (503, 592, 523, 700)', '"build_out", "bath", (504, 591, 523, 700)'),
 ('"shower", "bath", (503, 703, 595, 783)', '"shower", "bath", (504, 703, 595, 781)'),
 ('"vanity", "bath", (595, 735, 685, 783)', '"vanity", "bath", (595, 735, 684, 781)'),
]
for old, new in rep:
    if old not in s:
        print("MISSING:", old[:70]); sys.exit(1)
    s = s.replace(old, new)
open(p, "w", encoding="utf-8", newline="\n").write(s)
print("patched")

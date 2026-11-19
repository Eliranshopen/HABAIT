p = "scripts/blender/build_scene.py"
s = open(p, encoding="utf-8").read()
rep = [
 ('"still_hero_living": (318, 940, 135, 700, 660, 95, 19),', '"still_hero_living": (196, 1000, 140, 720, 640, 92, 18),'),
 ('"still_bath": (188, 352, 140, 60, 470, 95, 16),', '"still_bath": (262, 372, 150, 40, 430, 92, 13),'),
 ('"still_exterior": (1560, 1560, 150, 620, 700, 150, 26),', '"still_exterior": (1900, 180, 160, 820, 760, 140, 24),'),
]
for a, b in rep:
    assert a in s, a
    s = s.replace(a, b)
open(p, "w", encoding="utf-8", newline="\n").write(s)
p = "scripts/blender/hz_furniture.py"
s = open(p, encoding="utf-8").read()
for a, b in [('bx("B_wardrobe_carcass", wd[0], wd[1] + 2, wd[2], wd[3], 0, 240, dark)', 'bx("B_wardrobe_carcass", wd[0], wd[1] + 2, wd[2], wd[3], 0, 240, white)'),
             ('bx("S_closet_carcass", cl[0] + 2, cl[1] + 0.5, cl[2], cl[3], 0, 240, dark)', 'bx("S_closet_carcass", cl[0] + 2, cl[1] + 0.5, cl[2], cl[3], 0, 240, white)')]:
    assert a in s, a
    s = s.replace(a, b)
open(p, "w", encoding="utf-8", newline="\n").write(s)
print("ok")

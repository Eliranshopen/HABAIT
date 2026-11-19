p = 'scripts/16_item_3d.mjs'
s = open(p, encoding='utf-8').read()
old = "  // round 2 (Eliran 2026-11-17:"
new = """  // 2026-11-18 (Eliran: «by the plan»): the sheet draws a CORNER sofa, 300 along the north wall + a 300 chaise along the east wall
  sofa_corner: { crops: ['sofa_modular', 'sofa_front'], size: 'L-shaped corner sofa: a 300 cm run plus a chaise 100 cm wide and 300 cm long at its right end, 75 cm high',
    include: 'the whole L: the low rounded modules, the back and arm cushions, the blush and ochre cushions and the white pleated throw on the chaise',
    view: 'three-quarter front view from slightly above, the whole L in frame, the chaise on the RIGHT end coming toward the camera' },
""" + old
assert old in s
s = s.replace(old, new, 1)
open(p, 'w', encoding='utf-8').write(s)
print('ok')

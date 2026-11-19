p = 'scripts/16_item_3d.mjs'
s = open(p, encoding='utf-8').read()
a = s.index("  sofa_corner: {")
b = s.index("\n", s.index("view:", a)) + 1
new = """  sofa_corner: { crops: ['sofa_modular', 'sofa_front'], size: 'a SYMMETRICAL L-shaped corner sectional: two equal sides, each 300 cm long and 100 cm deep, made of the same rounded seat modules (two seat modules on each side plus one square corner module), back cushions along both outer sides, one arm at each free end; 75 cm high; seen from above it is an L of 300 x 300 cm',
    include: 'the whole L with both equal sides, the blush and ochre cushions in the corner and the white pleated throw on one side',
    view: 'view from high above the open inner side of the L, at about 45 degrees, so both equal sides are fully visible, the corner at the back' },
"""
s = s[:a] + new + s[b:]
open(p, 'w', encoding='utf-8').write(s)
print('ok')

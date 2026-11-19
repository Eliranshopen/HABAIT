p = 'scripts/16_item_3d.mjs'
s = open(p, encoding='utf-8').read()
old = "size: 'L-shaped corner sofa: a 300 cm run plus a chaise 100 cm wide and 300 cm long at its right end, 75 cm high',"
new = "size: 'L-shaped corner sofa with EQUAL arms, as in the sales plan: the main run is 300 cm long and 100 cm deep, and the chaise at its right end is also 300 cm long (measured from the back) and 100 cm wide, so seen from above the sofa is an L of 300 x 300 cm; 75 cm high',"
assert old in s
s = s.replace(old, new)
s = s.replace("view: 'three-quarter front view from slightly above, the whole L in frame, the chaise on the RIGHT end coming toward the camera' },",
              "view: 'high three-quarter view from above the front-left corner, the whole L in frame: the long run across the back and the equally long chaise running toward the camera on the RIGHT' },")
open(p, 'w', encoding='utf-8').write(s)
print('ok')

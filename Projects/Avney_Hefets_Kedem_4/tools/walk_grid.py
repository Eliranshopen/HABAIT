"""walk_grid.py - the free floor for the 3D walk, from plan/plan.json.  $0, deterministic.
usage: python -I walk_grid.py <project> <out_dir>
Free = inside a room or a doorway, at least CLEAR cm from every wall and every piece of furniture (rugs excepted).
Writes walk3d-grid.png (white = free, 5 cm cells, plan frame) + walk3d-grid.json (x0, y0, cell, w, h, start, rooms).
Frame = the plan's (cm, y down) = three.js (x = X m * 100, z = Z m * 100) for a +Y-up glTF export of the Blender scene.
"""
import sys, os, json
import numpy as np
from PIL import Image

proj, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
plan = json.load(open(os.path.join(proj, 'plan', 'plan.json'), encoding='utf-8'))
CELL, CLEAR_WALL, CLEAR_FURN = 5.0, 22.0, 14.0
xs, ys = plan['grid']['xs_cm'], plan['grid']['ys_cm']
x0, y0 = xs[0] - 50, ys[0] - 50
w, h = int((xs[-1] + 50 - x0) / CELL), int((ys[-1] + 50 - y0) / CELL)
cx = x0 + (np.arange(w) + 0.5) * CELL
cy = y0 + (np.arange(h) + 0.5) * CELL
X, Y = np.meshgrid(cx, cy)


def rect_mask(r, pad=0.0):
    return (X >= r[0] - pad) & (X <= r[2] + pad) & (Y >= r[1] - pad) & (Y <= r[3] + pad)


free = np.zeros((h, w), bool)
for r in plan['rooms']:
    for q in r['rects_cm']:
        free |= rect_mask(q)
for o in plan['openings']:
    if o['kind'] in ('door', 'mamad_door', 'passage', 'sliding_door'):
        free |= rect_mask(o['rect_cm'])
for wl in plan['walls']:
    free &= ~rect_mask(wl['rect_cm'], CLEAR_WALL)
for f in plan['fixtures']:
    if f['kind'] in ('rug', 'upper_cabinet', 'sink_bowl', 'hob') or f['id'] in ('l-armchair', 'l-tv'):   # no armchair, a wall TV (his pictures)
        continue
    free &= ~rect_mask(f['rect_cm'], 4.0 if f['kind'] in ('plant', 'planter') else CLEAR_FURN)   # a pot: the body clears it by itself
# the balcony railing
rail = plan['balcony']['rail_cm']
free &= ~rect_mask([rail[0], rail[1], rail[2], rail[3]], 30)
Image.fromarray((free * 255).astype(np.uint8)).save(os.path.join(out, 'walk3d-grid.png'))
foyer = next(c for c in plan['cameras'] if c['id'] == 'foyer')
rooms = [dict(id=r['id'], he=r['he'], loop=[[q[0], q[1]], [q[2], q[1]], [q[2], q[3]], [q[0], q[3]]]) for r in plan['rooms'] for q in r['rects_cm']]
grid = dict(x0=x0, y0=y0, cell=CELL, w=w, h=h, start=dict(x=foyer['x'], y=foyer['y'], yaw_deg=90), rooms=rooms,
            cameras=[dict(id=c['id'], he=c['he'], x=c['x'], y=c['y']) for c in plan['cameras']])
json.dump(grid, open(os.path.join(out, 'walk3d-grid.json'), 'w', encoding='utf-8'), ensure_ascii=False)
ix, iy = int((foyer['x'] - x0) / CELL), int((foyer['y'] - y0) / CELL)
print('grid', w, 'x', h, 'free cells', int(free.sum()), '| start free:', bool(free[iy, ix]))
# reachability from the start (every room must be reachable on foot)
from scipy import ndimage as ndi
lab, n = ndi.label(free)
main = lab[iy, ix]
for c in plan['cameras']:
    jx, jy = int((c['x'] - x0) / CELL), int((c['y'] - y0) / CELL)
    print('  reach %-9s %s' % (c['id'], 'YES' if lab[jy, jx] == main else 'NO (label %d)' % lab[jy, jx]))

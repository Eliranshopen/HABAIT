"""walk_footprints.py — the floor footprint of every piece that stands in a walker's way, from a built scene (2026-11-12, walk proof).

  blender -b <tour>/scene-full.blend --factory-startup -P pipeline/walk_footprints.py -- --out <file.json>

For each rendered mesh that is not structure (walls, panes, floors, ceilings, skirting — the plan has those) and not a door part
(an opening must stay walkable), the 2-D convex hull of its vertices between 5 cm and 150 cm above the floor, in plan centimetres
(x right, y down). Pure read: the scene is not changed or saved.
"""
import bpy, sys, json, argparse
ap = argparse.ArgumentParser(); ap.add_argument('--out', required=True)
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])
SKIP = ('WALL', 'FACING', 'INFILL', 'POST', 'GLASS', 'FLOOR', 'CEIL', 'TERRAIN', 'SKIRT', 'DOOR', 'ENTRY', 'LEAF', 'rug', 'L_')

def hull(pts):
    pts = sorted(set(pts))
    if len(pts) < 3: return pts
    cross = lambda o, p, q: (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

dg = bpy.context.evaluated_depsgraph_get(); rows = []
for o in bpy.data.objects:
    if o.type != 'MESH' or o.hide_render or o.name.startswith(SKIP): continue
    m = o.evaluated_get(dg).to_mesh(); M = o.matrix_world
    pts = []
    for v in m.vertices:
        w = M @ v.co
        if 0.05 <= w.z <= 1.5: pts.append((round(w.x * 100, 1), round(-w.y * 100, 1)))
    o.evaluated_get(dg).to_mesh_clear()
    if len(pts) >= 3: rows.append({'n': o.name, 'poly': hull(pts)})
json.dump({'schema': 'walk-footprints/1', 'units': 'plan cm, x right, y down', 'pieces': rows}, open(a.out, 'w'), indent=0)
print('WALK_FOOTPRINTS_OK', len(rows))

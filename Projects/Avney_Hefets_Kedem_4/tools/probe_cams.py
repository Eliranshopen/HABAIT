"""probe_cams.py - QA: from every camera cast rays in 6 directions; a camera inside a solid reports a very near hit."""
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for o in bpy.data.collections['CAM'].all_objects:
    if o is None:
        continue
    res = []
    for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
        hit, loc, nrm, idx, ob, mtx = sc.ray_cast(dg, o.location, Vector(d))
        res.append('%s:%.2f%s' % (ob.name[:18] if ob else '-', (loc - o.location).length if hit else -1, '' if not hit else ('<' if nrm.dot(Vector(d)) > 0 else '')))
    print('CAM', o.name, ' | '.join(res))

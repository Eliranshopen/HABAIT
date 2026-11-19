"""depth_pano.py - per-viewpoint radial depth of the plan-true scene, in the panorama's own frame ($0, no render).

  blender -b scene/apartment.blend -P tools/tour360/depth_pano.py -- <proj> <out_dir> [width=1024] [ids...]

For every pano camera `pano_<id>` (build_scene.py: centre of the panorama = plan up = +Y world, u increases clockwise seen from
above), one ray per pixel is cast from the camera origin against one BVH of every render-visible mesh; the hit distance (metres, radial) is written as
<out_dir>/<id>.npy (float32, H x W, 0 = no hit). The RAINBOW ruler's frame: u = 0.5 + yaw/360, v = 0.5 - pitch/180.
tools/tour360/make_apartment.py encodes it to rgb24-be centimetres for the viewer's measure tool.
"""
import bpy, sys, os, math, time
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

a = sys.argv[sys.argv.index('--') + 1:]
PROJ, OUT = a[0], a[1]
W = int(a[2]) if len(a) > 2 else 1024
ONLY = a[3:]
H = W // 2
os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene
dg = bpy.context.evaluated_depsgraph_get()
# one BVH of every render-visible mesh in world space (scene.ray_cast costs ~0.7 ms a ray here; a BVH a few microseconds)
verts, polys = [], []
for ob in bpy.data.objects:
    if ob.type != 'MESH' or ob.hide_render:
        continue
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ev.matrix_world
    base = len(verts)
    verts.extend(mw @ v.co for v in me.vertices)
    polys.extend([base + i for i in p.vertices] for p in me.polygons)
    ev.to_mesh_clear()
bvh = BVHTree.FromPolygons(verts, polys, epsilon=0.0)
print('BVH', len(verts), 'verts', len(polys), 'polys', flush=True)
cams = sorted(o.name[5:] for o in bpy.data.objects if o.name.startswith('pano_') and o.type == 'CAMERA')
yaw = ((np.arange(W) + 0.5) / W - 0.5) * 2 * math.pi          # radians, 0 = centre = plan up, + = clockwise (right)
pitch = (0.5 - (np.arange(H) + 0.5) / H) * math.pi
for cid in cams:
    if ONLY and cid not in ONLY:
        continue
    o = bpy.data.objects['pano_' + cid]
    org = o.matrix_world.translation.copy()
    t0 = time.time()
    d = np.zeros((H, W), np.float32)
    for r in range(H):
        cp, sp = math.cos(pitch[r]), math.sin(pitch[r])
        for c in range(W):
            # plan bearing b clockwise from plan up: plan (sin b, -cos b) -> world (X = sin b, Y = cos b)
            v = Vector((cp * math.sin(yaw[c]), cp * math.cos(yaw[c]), sp))
            loc, _n, _i, dist = bvh.ray_cast(org, v)
            if loc is not None:
                d[r, c] = (loc - org).length
    np.save(os.path.join(OUT, cid + '.npy'), d)
    print('DEPTH', cid, f'{time.time() - t0:.1f}s', 'hit', f'{(d > 0).mean():.3f}', 'median_m', f'{np.median(d[d > 0]):.2f}', flush=True)

"""optimize_item.py - make a generated catalog GLB (Hunyuan 3D, ~200k faces, 4K maps) light and NORMALISED for the walk (2026-11-17).
Adapted from the Hatzav optimize_glb.py. blender -b --factory-startup -P optimize_item.py -- <project> <id> [--faces 60000] [--tex 1024]
- decimated to --faces, maps down to --tex JPEG;
- normalised: the longest horizontal side along X, the front (the low side of a seat; for a table either side) towards Blender -Y
  (three.js +Z after the +Y-up export), centred on the origin, standing on z = 0, real metres from catalog.json size_cm (width);
- writes work/catalog/web/<id>.glb + work/catalog/preview/<id>.png (3/4 view on white) + a sidecar json.  $0.
"""
import bpy, json, math, os, sys
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
P, IID = os.path.abspath(a[0]), a[1]
opt = lambda n, d: a[a.index(n) + 1] if n in a else d
FACES, TEX = int(opt('--faces', '60000')), int(opt('--tex', '1024'))
cat = json.load(open(os.path.join(P, 'tools', 'catalog', 'catalog.json'), encoding='utf-8'))['items'] + json.load(open(os.path.join(P, 'tools', 'catalog', 'base.json'), encoding='utf-8'))['items']
item = next(i for i in cat if i['id'] == IID)
src = os.path.join(P, 'work', 'catalog', 'glb', IID + '.glb')
out = os.path.join(P, 'work', 'catalog', 'web', IID + '.glb'); prev = os.path.join(P, 'work', 'catalog', 'preview', IID + '.png')
os.makedirs(os.path.dirname(out), exist_ok=True); os.makedirs(os.path.dirname(prev), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
before = sum(len(o.data.polygons) for o in meshes)
for o in meshes:
    n = len(o.data.polygons); want = max(2000, int(FACES * n / before))
    if n > want:
        md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = want / n
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=md.name)
    for p in o.data.polygons: p.use_smooth = True
after = sum(len(o.data.polygons) for o in meshes)
for im in bpy.data.images:
    if im.size[0] > TEX: im.scale(TEX, TEX * im.size[1] // im.size[0])
# Hunyuan leaves near-black blots where the photo did not show the surface (the bed's duvet, the leather sofa's seat, 2026-11-18):
# on an item whose design has no black, every near-black texel of a colour map takes the map's median colour
import numpy as np
if 'black' not in item.get('desc', '').lower():
    for im in bpy.data.images:
        if im.size[0] == 0 or im.colorspace_settings.name != 'sRGB': continue
        px = np.empty(im.size[0] * im.size[1] * 4, dtype=np.float32); im.pixels.foreach_get(px); px = px.reshape(-1, 4)
        lum = px[:, :3] @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
        dark = lum < 0.07
        if dark.mean() > 0.0005 and dark.mean() < 0.25:
            px[dark, :3] = np.median(px[~dark, :3], axis=0); im.pixels.foreach_set(px.ravel()); im.update()
            print('dark texels filled:', im.name, round(float(dark.mean()) * 100, 2), '%')
# one object, transforms applied (world-space vertices)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
for e in [o for o in bpy.context.scene.objects if o.type != 'MESH']: bpy.data.objects.remove(e, do_unlink=True)
ob.parent = None; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# Hunyuan sometimes adds the studio photo's contact shadow as a loose flat sheet (seen 2026-11-17 on coffee_travertine): every loose part
# thinner than 2.5 % of the item's height is dropped
dropped = 0
if '--clean' in a:
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
    parts_ = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    zs = [(o, min((o.matrix_world @ v.co).z for v in o.data.vertices), max((o.matrix_world @ v.co).z for v in o.data.vertices)) for o in parts_]
    Hh = max(z1 for _, _, z1 in zs) - min(z0 for _, z0, _ in zs); dropped = 0
    def xyb(o):
        pts = [o.matrix_world @ v.co for v in o.data.vertices]; return min(p.x for p in pts), min(p.y for p in pts), max(p.x for p in pts), max(p.y for p in pts)
    B_ = {o.name: xyb(o) for o, _, _ in zs}
    drop_ = []
    for o, z0, z1 in zs:
        bx = B_[o.name]; flat = (z1 - z0) < 0.12 * max(bx[2] - bx[0], bx[3] - bx[1])
        below = [q1 for q, q0, q1 in zs if q is not o and q1 <= z0 + 1e-4 and not (B_[q.name][2] < bx[0] or B_[q.name][0] > bx[2] or B_[q.name][3] < bx[1] or B_[q.name][1] > bx[3])]
        gap = z0 - (max(below) if below else min(z for _, z, _ in zs))
        if flat and gap > 0.12 * Hh and (z1 - z0) < 0.02 * Hh and '--clean' in a:   # a flat sheet floating over the piece = the photo's shadow, not furniture
            drop_.append(o)
    for o in drop_:
        bpy.data.objects.remove(o, do_unlink=True); dropped += 1
    parts_ = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts_: o.select_set(True)
    bpy.context.view_layer.objects.active = parts_[0]
    if len(parts_) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active

print('loose flat parts dropped:', dropped)
V = lambda: [ob.matrix_world @ v.co for v in ob.data.vertices]
def bbox():
    pts = V(); return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
lo, hi = bbox()
# up axis: Hunyuan's glTF comes in Y-up and the importer makes it Z-up already; keep z as up
want_long_y = item['size_cm'][1] > item['size_cm'][0] * 1.05   # a bed is longer than it is wide: its long side goes to Y (2026-11-18 fix)
if ((hi.y - lo.y) > (hi.x - lo.x) * 1.05) != want_long_y and abs((hi.y - lo.y) - (hi.x - lo.x)) > 0.05 * max(hi.x - lo.x, hi.y - lo.y):   # the long side where the design puts it
    ob.data.transform(Matrix.Rotation(math.radians(90), 4, 'Z')); lo, hi = bbox()
# the front: for a seat the back is the high side; the front goes to -Y
pts = V(); mid = (lo.y + hi.y) / 2; zt = lo.z + (hi.z - lo.z) * 0.75
hiN = sum(1 for p in pts if p.z > zt and p.y > mid); hiS = sum(1 for p in pts if p.z > zt and p.y <= mid)
flipped = False
if item['slot'] in ('sofa', 'armchair', 'chairs', 'bedm') and hiS > hiN * 1.2:   # the tall back is at -Y: turn it round
    ob.data.transform(Matrix.Rotation(math.radians(180), 4, 'Z')); flipped = True
lo, hi = bbox()
s = (item['size_cm'][0] / 100.0) / max(1e-6, hi.x - lo.x)
ob.data.transform(Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))
ob.data.transform(Matrix.Scale(s, 4)); ob.matrix_world = Matrix.Identity(4)
if item.get('fit_h'):   # a piece whose height matters more than its width proportion (a table, a tall planter): z to the design height
    lo2, hi2 = bbox(); ob.data.transform(Matrix.Diagonal((1, 1, (item['size_cm'][2] / 100.0) / max(1e-6, hi2.z - lo2.z), 1)))
# nothing of a piece floats above its design height: loose parts that START above size_cm[2] * 1.05 are the photo's shadow / noise
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT')
import bmesh as _bm
bm_ = _bm.from_edit_mesh(ob.data); topH = item['size_cm'][2] / 100.0 * 1.3
seen_, isl_ = set(), []
for v0 in bm_.verts:
    if v0.index in seen_: continue
    stack, comp = [v0], []
    seen_.add(v0.index)
    while stack:
        v = stack.pop(); comp.append(v)
        for e in v.link_edges:
            w = e.other_vert(v)
            if w.index not in seen_: seen_.add(w.index); stack.append(w)
    isl_.append(comp)
n_hi = 0
for comp in isl_:
    if min(v.co.z for v in comp) > topH and '--clean' in a:
        for v in comp: v.select = True
        n_hi += 1
_bm.update_edit_mesh(ob.data); bpy.ops.mesh.delete(type='VERT'); bpy.ops.object.mode_set(mode='OBJECT')
dropped += n_hi
lo, hi = bbox(); ob.name = 'CAT_' + IID
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_image_format='JPEG', export_jpeg_quality=86, export_yup=True, export_apply=True)
# preview: 3/4 front view on white
sc = bpy.context.scene; c = (lo + hi) / 2; r = (hi - lo).length / 2
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
cam.location = c + Vector((r * 1.6, -r * 2.2, r * 1.0)); cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler(); sc.camera = cam
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0; sc.world = w
ld = bpy.data.lights.new('l', 'AREA'); ld.energy = 500 * r * r; ld.size = r * 2; lo_ = bpy.data.objects.new('l', ld); lo_.location = c + Vector((-r * 2, -r * 2, r * 3)); lo_.rotation_euler = (c - lo_.location).to_track_quat('-Z', 'Y').to_euler(); sc.collection.objects.link(lo_)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
sc.render.resolution_x = sc.render.resolution_y = 512; sc.view_settings.view_transform = 'AgX'; sc.render.filepath = prev
bpy.ops.render.render(write_still=True)
info = {'id': IID, 'flat_parts_dropped': dropped, 'faces_before': before, 'faces_after': after, 'size_m': [round(v, 3) for v in (hi - lo)], 'turned_round': flipped, 'bytes_out': os.path.getsize(out), 'tex': TEX}
json.dump(info, open(prev + '.json', 'w'), indent=1)
print('OPT_OK', json.dumps(info))

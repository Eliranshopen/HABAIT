"""walk_look.py — the WALK PROOF's look pass over a built, furnished scene (2026-11-12, Eliran: «אפשר לשפר את הדמיית הדירה ע"י שימוש בבלנדר»).

  blender -b <tour>/scene-full.blend --factory-startup -P pipeline/walk_look.py -- --out <proof>/scene-full.blend --assets <360walkaround root> [--open-door o-6] [--sofa on|off]

It changes LOOK only, never the plan's geometry (sales-plan fidelity): the indoor floor becomes a wood plank floor from the CC0
laminate texture (the shipped tour's parquet finish), the skirting boards are hidden (Eliran 2026-11-10: no skirting boards), the
flat wood colours get a wood grain, the low-poly sofa is replaced by the CC0 fabric sofa at the same place and size, and one door
leaf may be swung open on its own hinge so a visitor can walk through it. $0, deterministic: same inputs, same scene.
"""
import bpy, sys, math, os, argparse
from mathutils import Vector, Matrix

ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True); ap.add_argument('--assets', required=True)
ap.add_argument('--open-door', default=''); ap.add_argument('--sofa', default='on'); ap.add_argument('--exposure', type=float, default=0.0)
ap.add_argument('--lamps', type=float, default=1.0); ap.add_argument('--sky', type=float, default=1.0)
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])
A = os.path.abspath(a.assets); TEX = os.path.join(A, 'pipeline', 'probe', 'probe-assets', 'textures', 'laminate_floor_02')
log = lambda *x: print('[walk_look]', *x)

def img(name, colorspace):
    i = bpy.data.images.load(os.path.join(TEX, name), check_existing=True); i.colorspace_settings.name = colorspace; return i

def principled(m):
    return next(n for n in m.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')

# 1. no skirting boards
n = 0
for o in bpy.data.objects:
    if o.name.startswith('SKIRT'): o.hide_render = True; o.hide_viewport = True; n += 1
log('skirting pieces hidden:', n)

# 2. the indoor floor: wood planks, mapped in world metres so every room's floor is one continuous deck
def wood_floor(m, metres=2.4, value=1.18, sat=0.82, rough_gain=0.9):
    nt = m.node_tree; b = principled(m)
    for nd in [x for x in nt.nodes if x.bl_idname not in ('ShaderNodeBsdfPrincipled', 'ShaderNodeOutputMaterial')]: nt.nodes.remove(nd)
    geo = nt.nodes.new('ShaderNodeNewGeometry'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / metres, 1 / metres, 1)
    nt.links.new(geo.outputs['Position'], mp.inputs['Vector'])
    d = nt.nodes.new('ShaderNodeTexImage'); d.image = img('laminate_floor_02_Diffuse_2k.jpg', 'sRGB')
    r = nt.nodes.new('ShaderNodeTexImage'); r.image = img('laminate_floor_02_Rough_2k.jpg', 'Non-Color')
    nm = nt.nodes.new('ShaderNodeTexImage'); nm.image = img('laminate_floor_02_nor_gl_2k.jpg', 'Non-Color')
    for t in (d, r, nm): nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
    hs = nt.nodes.new('ShaderNodeHueSaturation'); hs.inputs['Saturation'].default_value = sat; hs.inputs['Value'].default_value = value
    nt.links.new(d.outputs['Color'], hs.inputs['Color']); nt.links.new(hs.outputs['Color'], b.inputs['Base Color'])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = rough_gain
    nt.links.new(r.outputs['Color'], mul.inputs[0]); nt.links.new(mul.outputs['Value'], b.inputs['Roughness'])
    nmap = nt.nodes.new('ShaderNodeNormalMap'); nmap.inputs['Strength'].default_value = 0.6
    nt.links.new(nm.outputs['Color'], nmap.inputs['Color']); nt.links.new(nmap.outputs['Normal'], b.inputs['Normal'])
m = bpy.data.materials.get('M_floor_tiles_120x120')
if m: wood_floor(m); log('indoor floor -> wood planks')

# 3. the flat wood colours get a grain (box-projected in object space)
def wood_grain(m, scale, value, sat):
    nt = m.node_tree; b = principled(m)
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    d = nt.nodes.new('ShaderNodeTexImage'); d.image = img('laminate_floor_02_Diffuse_2k.jpg', 'sRGB'); d.projection = 'BOX'; d.projection_blend = 0.2
    nt.links.new(mp.outputs['Vector'], d.inputs['Vector'])
    hs = nt.nodes.new('ShaderNodeHueSaturation'); hs.inputs['Saturation'].default_value = sat; hs.inputs['Value'].default_value = value
    nt.links.new(d.outputs['Color'], hs.inputs['Color']); nt.links.new(hs.outputs['Color'], b.inputs['Base Color'])
for name, val, sat in (('M_wood_oak', 1.0, 0.9), ('M_wood_walnut', 0.42, 0.9)):
    m = bpy.data.materials.get(name)
    if m: wood_grain(m, 0.9, val, sat); log(name, '-> grain')

# 4. softer, lighter cloth for the sofa, the dining chairs and the rug (the shipped pictures' palette)
for name, col in (('M_fabric_dark', (0.5, 0.45, 0.39, 1)), ('M_terrain', (0.5, 0.52, 0.55, 1)), ('M_fabric_rug', (0.5, 0.46, 0.4, 1)), ('M_fabric_rug_border', (0.42, 0.38, 0.33, 1))):
    m = bpy.data.materials.get(name)
    if m: principled(m).inputs['Base Color'].default_value = col

# 4b. every door white (Eliran 2026-11-10: the front door white, zero line; the shipped pictures' interior doors are white)
dm = bpy.data.materials.new('M_door_white'); dm.use_nodes = True
principled(dm).inputs['Base Color'].default_value = (0.86, 0.86, 0.84, 1); principled(dm).inputs['Roughness'].default_value = 0.38
n = 0
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name.startswith(('DOOR_', 'ENTRY_', 'DOORFRAME', 'LEAF_')):
        for sl in o.material_slots:
            if sl.material and sl.material.name.startswith('M_wood'): sl.material = dm; n += 1
log('door parts made white:', n)

# 4c. daylight instead of lamp light: the ceiling lamps down, the sky and the exposure up
for o in bpy.data.objects:
    if o.type == 'LIGHT' and o.data.type == 'AREA': o.data.energy *= a.lamps
w = bpy.context.scene.world
for nd in w.node_tree.nodes:
    if nd.bl_idname == 'ShaderNodeBackground': nd.inputs['Strength'].default_value *= a.sky

# 5. the sofa: the CC0 fabric sofa at the old one's place, length and facing
def world_xy(o): return [(o.matrix_world @ v.co) for v in o.data.vertices]
old = bpy.data.objects.get('loungeDesignSofa(Clone)')
if a.sofa == 'on' and old:
    pts = world_xy(old); cx = sum(p.x for p in pts) / len(pts); cy = sum(p.y for p in pts) / len(pts)
    sxx = sum((p.x - cx) ** 2 for p in pts); syy = sum((p.y - cy) ** 2 for p in pts); sxy = sum((p.x - cx) * (p.y - cy) for p in pts)
    ang = 0.5 * math.atan2(2 * sxy, sxx - syy); ax = Vector((math.cos(ang), math.sin(ang), 0)); ay = Vector((-ax.y, ax.x, 0))
    ext = lambda v: (min((Vector((p.x - cx, p.y - cy, 0))).dot(v) for p in pts), max((Vector((p.x - cx, p.y - cy, 0))).dot(v) for p in pts))
    lo, hi = ext(ax); length = hi - lo; mid = Vector((cx, cy, 0)) + ax * (lo + hi) / 2; lo2, hi2 = ext(ay); mid += ay * (lo2 + hi2) / 2
    tbl = bpy.data.objects.get('modern_coffee_table_01'); tp = world_xy(tbl); tc = Vector((sum(p.x for p in tp) / len(tp), sum(p.y for p in tp) / len(tp), 0))
    front = ay if (tc - mid).dot(ay) > 0 else -ay
    src = os.path.join(A, 'pipeline', 'probe', 'probe-assets', 'models', 'sofa_02', 'sofa_02_2k.blend')
    with bpy.data.libraries.load(src, link=False) as (df, dt): dt.objects = list(df.objects)
    new = [o for o in dt.objects if o and o.type == 'MESH']
    for o in new: bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.update()
    allp = [o.matrix_world @ Vector(c) for o in new for c in o.bound_box]
    nx0, nx1 = min(p.x for p in allp), max(p.x for p in allp); ny0, ny1 = min(p.y for p in allp), max(p.y for p in allp); nz0 = min(p.z for p in allp)
    s = min(length / (nx1 - nx0), 1.25); ncen = Vector(((nx0 + nx1) / 2, (ny0 + ny1) / 2, nz0))
    # the asset's front is -Y, its length +X: rotate -Y onto `front`
    rot = math.atan2(front.y, front.x) + math.pi / 2
    M = Matrix.Translation(Vector((mid.x, mid.y, 0))) @ Matrix.Rotation(rot, 4, 'Z') @ Matrix.Scale(s, 4) @ Matrix.Translation(-ncen)
    for o in new:
        if o.parent is None or o.parent not in new: o.matrix_world = M @ o.matrix_world
    old.hide_render = True; old.hide_viewport = True
    log('sofa swapped: length %.2f m, scale %.2f, front (%.2f, %.2f), %d meshes' % (length, s, front.x, front.y, len(new)))

# 6. one door swung open on its hinge (the leaf's far end from its lever), into the side the leaf already stands on
if a.open_door:
    pre = 'DOOR_%s_' % a.open_door; leaf = bpy.data.objects.get(pre + 'leaf'); lev = bpy.data.objects.get(pre + 'lever_a')
    parts = [o for o in bpy.data.objects if o.name.startswith(pre) and o.name[len(pre):].split('_')[0] in ('leaf', 'lever', 'neck', 'rose')]
    lp = world_xy(leaf); lc = Vector((sum(p.x for p in lp) / len(lp), sum(p.y for p in lp) / len(lp), 0))
    vp = world_xy(lev); vc = Vector((sum(p.x for p in vp) / len(vp), sum(p.y for p in vp) / len(vp), 0))
    far = max(lp, key=lambda p: (Vector((p.x, p.y, 0)) - vc).length); hinge = Vector((far.x, far.y, 0))
    wall = bpy.data.objects.get(pre + 'head'); wp = world_xy(wall); wc = Vector((sum(p.x for p in wp) / len(wp), sum(p.y for p in wp) / len(wp), 0))
    side = lc - wc   # from the wall's line to the leaf: the side the leaf opens into
    best = None
    for deg in (92, -92):
        R = Matrix.Translation(hinge) @ Matrix.Rotation(math.radians(deg), 4, 'Z') @ Matrix.Translation(-hinge)
        c2 = R @ lc
        sc = (c2 - wc).dot(side.normalized())
        if best is None or sc > best[0]: best = (sc, R, deg)
    for o in parts: o.matrix_world = best[1] @ o.matrix_world
    log('door', a.open_door, 'opened', best[2], 'deg on hinge (%.2f, %.2f), %d parts' % (hinge.x, hinge.y, len(parts)))

s = bpy.context.scene
if a.exposure: s.view_settings.exposure = a.exposure
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.out), relative_remap=True)
log('saved', a.out)
print('WALK_LOOK_OK')

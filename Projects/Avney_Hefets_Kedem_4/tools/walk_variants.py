"""walk_variants.py - the swap-in furniture and accessories of the 3D walk (2026-11-17, Eliran: «שינוי ריהוט או אביזרים ע"י לחיצה על העיגול»).
usage: blender -b --factory-startup -P walk_variants.py -- <project> <out.glb>
Builds every alternative piece from plan/plan.json in the SAME world frame as scene/apartment.blend (x = cm/100, y = -cm/100), each one
on the footprint the sales plan gives its slot (never bigger, so the free floor of the walk stays true), and exports ONE glb. Each
variant is an empty 'VAR_<slot>_<variant>' with its meshes under it; the page lights them from the baked light around the slot (no bake).
Materials are flat colours named after the channel the page repaints ('main' = the recolourable fabric or wood). $0, deterministic.
"""
import bpy, bmesh, sys, os, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
P, OUT = argv[0], argv[1]
plan = json.load(open(os.path.join(P, 'plan', 'plan.json'), encoding='utf-8'))
FX = {f['id']: f for f in plan['fixtures']}
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
W = lambda x, y, z=0.0: Vector((x / 100.0, -y / 100.0, z))
FRONT_YAW = {'+x': 0.0, '-x': 180.0, '+y': -90.0, '-y': 90.0}
MATS = {}


def mat(name, rgb, rough=0.6, metal=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    MATS[name] = m
    return m


def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def bev(o, w):
    if w > 0:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = w; m.segments = 3; m.limit_method = 'ANGLE'
    return o


def box(root, name, cx, cy, sx, sy, z0, z1, m, b=0.004):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, z1 - z0), verts=bm.verts); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); o.location = (cx, cy, (z0 + z1) / 2); o.data.materials.append(m)
    bpy.context.scene.collection.objects.link(o); o.parent = root
    return bev(o, b)


def cyl(root, name, cx, cy, r, z0, z1, m, verts=40, b=0.003, rx=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=z1 - z0)
    if rx:
        bmesh.ops.scale(bm, vec=(rx / r, 1, 1), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); o.location = (cx, cy, (z0 + z1) / 2); o.data.materials.append(m)
    bpy.context.scene.collection.objects.link(o); o.parent = root
    return bev(o, b)


def sphere(root, name, cx, cy, cz, r, m, sz=1.0):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r)
    bmesh.ops.scale(bm, vec=(1, 1, sz), verts=bm.verts); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); o.location = (cx, cy, cz); o.data.materials.append(m)
    for p in me.polygons: p.use_smooth = True
    bpy.context.scene.collection.objects.link(o); o.parent = root
    return o


def slot_root(slot, var, f, yaw_from_front=True, extra=None):
    """an empty at the footprint centre, turned so local +y faces the piece's front; children are built in local metres"""
    x0, y0, x1, y1 = f['rect_cm']
    r = bpy.data.objects.new('VAR_%s_%s' % (slot, var), None); bpy.context.scene.collection.objects.link(r)
    c = W((x0 + x1) / 2, (y0 + y1) / 2); r.location = (c.x, c.y, 0)
    if yaw_from_front and f.get('front'):
        r.rotation_euler = (0, 0, math.radians(FRONT_YAW[f['front']] - 90.0))
    r['slot'] = slot; r['variant'] = var
    if extra:
        for k, v in extra.items(): r[k] = v
    w_, d_ = (x1 - x0) / 100, (y1 - y0) / 100
    if f.get('front') in ('+x', '-x'):
        w_, d_ = d_, w_
    return r, w_, d_


M = dict(
    main_fabric=lambda h: mat('main', lin(h), 0.9),
    wood=mat('wood_oak', lin('#a8875f'), 0.55), wood_dark=mat('wood_walnut', lin('#5e4130'), 0.5),
    black=mat('metal_black', lin('#1f1e1d'), 0.4), white=mat('lacquer_white', lin('#ebe8e3'), 0.3), marble=mat('marble', lin('#e7e3dc'), 0.2),
    brass=mat('metal_brass', lin('#b08d4a'), 0.3), glass=mat('glass_globe', lin('#f4efe2'), 0.1), cushion=mat('accent', lin('#d8d1c4'), 0.9),
    canvas=mat('art_canvas', lin('#d9cbb3'), 0.8), art2=mat('art_paint', lin('#9a5b3d'), 0.8), art3=mat('art_paint2', lin('#3d4f63'), 0.8),
    mirror=mat('mirror', lin('#c9ced0'), 0.05), clay=mat('vase_clay', lin('#b98a69'), 0.7), leaf=mat('leaf', lin('#5b7047'), 0.8),
)
fab = lambda: mat('main', lin('#8a847c'), 0.9)
wmain = lambda h: mat('main_wood_' + h, lin(h), 0.55)

# ---- sofa (footprint of l-sofa; local: x = width, y = depth, front = +y)
f = FX['l-sofa']
r, wd, dp = slot_root('sofa', 'v1', f)
for m_ in [fab()]:
    box(r, 'seat', 0, 0.04, wd - 0.04, dp - 0.12, 0.20, 0.44, m_, 0.03)
    box(r, 'back', 0, -dp / 2 + 0.10, wd - 0.04, 0.16, 0.44, 0.84, m_, 0.04)
    for s in (-1, 1):
        box(r, 'arm', s * (wd / 2 - 0.06), 0.0, 0.10, dp - 0.04, 0.20, 0.62, m_, 0.02)
    for k in range(3):
        x = -wd / 2 + 0.14 + (wd - 0.28) * (k + 0.5) / 3
        box(r, 'cush', x, 0.08, (wd - 0.28) / 3 - 0.01, dp - 0.32, 0.44, 0.56, m_, 0.04)
for s in (-1, 1):
    for t in (-1, 1):
        cyl(r, 'leg', s * (wd / 2 - 0.09), t * (dp / 2 - 0.10), 0.022, 0.0, 0.20, M['wood'], 16)
box(r, 'pillow', -wd / 2 + 0.45, -dp / 2 + 0.30, 0.42, 0.12, 0.56, 0.94, M['cushion'], 0.05)
r, wd, dp = slot_root('sofa', 'v2', f)
m_ = fab()   # the rounded sofa: soft deep bevels, bolster arms lying along the depth, a low black plinth (no faces share a plane)
box(r, 'plinth', 0, 0.02, wd - 0.24, dp - 0.24, 0.0, 0.07, M['black'], 0.0)
box(r, 'seat', 0, 0.05, wd - 0.34, dp - 0.20, 0.07, 0.43, m_, 0.10)
box(r, 'back', 0, -dp / 2 + 0.13, wd - 0.10, 0.24, 0.07, 0.80, m_, 0.11)
for s_ in (-1, 1):
    o = cyl(r, 'arm', s_ * (wd / 2 - 0.13), 0.01, 0.15, -(dp - 0.08) / 2, (dp - 0.08) / 2, m_, 40, 0.03)
    o.rotation_euler = (math.pi / 2, 0, 0); o.location = (s_ * (wd / 2 - 0.13), 0.01, 0.46)
    box(r, 'armbase', s_ * (wd / 2 - 0.13), 0.01, 0.26, dp - 0.08, 0.07, 0.46, m_, 0.06)
box(r, 'pillow', wd / 2 - 0.55, -dp / 2 + 0.36, 0.40, 0.13, 0.46, 0.84, M['cushion'], 0.05)

# ---- armchair
f = FX['l-armchair']
r, wd, dp = slot_root('armchair', 'v1', f)
m_ = fab()
box(r, 'base', 0, 0, wd - 0.04, dp - 0.04, 0.12, 0.42, m_, 0.03); box(r, 'back', 0, -dp / 2 + 0.10, wd - 0.04, 0.16, 0.42, 0.82, m_, 0.04)
for s in (-1, 1): box(r, 'arm', s * (wd / 2 - 0.08), 0, 0.12, dp - 0.04, 0.42, 0.62, m_, 0.03)
box(r, 'cush', 0, 0.06, wd - 0.30, dp - 0.30, 0.42, 0.52, m_, 0.04)
for s in (-1, 1):
    for t in (-1, 1): cyl(r, 'leg', s * (wd / 2 - 0.08), t * (dp / 2 - 0.08), 0.02, 0.0, 0.12, M['black'], 12)
r, wd, dp = slot_root('armchair', 'v2', f)
for s in (-1, 1):
    box(r, 'side', s * (wd / 2 - 0.04), 0, 0.05, dp - 0.06, 0.0, 0.58, M['wood'], 0.01)
box(r, 'seat', 0, 0.04, wd - 0.12, dp - 0.18, 0.30, 0.44, fab(), 0.04)
box(r, 'back', 0, -dp / 2 + 0.12, wd - 0.12, 0.14, 0.40, 0.86, fab(), 0.05)
box(r, 'rail', 0, -dp / 2 + 0.05, wd - 0.1, 0.04, 0.24, 0.30, M['wood'], 0.005)

# ---- coffee table (footprint of l-coffee, no front)
f = FX['l-coffee']
r, wd, dp = slot_root('coffee', 'v1', f, False)
box(r, 'top', 0, 0, wd * 0.95, dp * 0.62, 0.36, 0.40, mat('main_stone', lin('#e7e3dc'), 0.2), 0.006)
for s in (-1, 1): box(r, 'foot', s * (wd * 0.32), 0, 0.10, dp * 0.5, 0.0, 0.36, mat('main_stone', lin('#e7e3dc'), 0.2), 0.004)
r, wd, dp = slot_root('coffee', 'v2', f, False)
mw = wmain('#2a2827')
cyl(r, 'top1', -wd * 0.18, -dp * 0.08, wd * 0.30, 0.38, 0.41, mw, 56); cyl(r, 'stem1', -wd * 0.18, -dp * 0.08, 0.03, 0.0, 0.38, M['black'], 16)
cyl(r, 'top2', wd * 0.22, dp * 0.16, wd * 0.22, 0.30, 0.33, mw, 56); cyl(r, 'stem2', wd * 0.22, dp * 0.16, 0.025, 0.0, 0.30, M['black'], 16)
for nm_, rr_ in (('foot1', (-wd * 0.18, -dp * 0.08, 0.14)), ('foot2', (wd * 0.22, dp * 0.16, 0.11))):
    cyl(r, nm_, rr_[0], rr_[1], rr_[2], 0.0, 0.012, M['black'], 32)

# ---- dining table (footprint of l-dining; the model's top is 70 % of the depth: the chairs sit in the rest)
f = FX['l-dining']
r, wd, dp = slot_root('dining', 'v1', f, False)
td = dp * 0.70
box(r, 'top', 0, 0, wd, td, 0.73, 0.76, mat('main_tw', lin('#ebe8e3'), 0.3), 0.004)
for s in (-1, 1):
    for t in (-1, 1):
        o = cyl(r, 'leg', s * (wd / 2 - 0.12), t * (td / 2 - 0.10), 0.03, 0.0, 0.73, M['wood'], 16)
r, wd, dp = slot_root('dining', 'v2', f, False)
box(r, 'top', 0, 0, wd, td, 0.71, 0.76, wmain('#5e4130'), 0.004)
for s in (-1, 1): box(r, 'slab', s * (wd / 2 - 0.20), 0, 0.08, td - 0.2, 0.0, 0.71, wmain('#5e4130'), 0.004)
box(r, 'stretcher', 0, 0, wd - 0.4, 0.06, 0.12, 0.18, wmain('#5e4130'), 0.003)

# ---- chairs (6, same places as the model's)
f = FX['l-dining']; x0, y0, x1, y1 = f['rect_cm']
c = W((x0 + x1) / 2, (y0 + y1) / 2); sx, sy = (x1 - x0) / 100, (y1 - y0) / 100
for var in ('v1', 'v2'):
    r = bpy.data.objects.new('VAR_chairs_%s' % var, None); bpy.context.scene.collection.objects.link(r); r['slot'] = 'chairs'; r['variant'] = var
    for k in range(3):
        x = c.x - sx / 2 + sx * (k + 0.5) / 3
        for t in (-1, 1):
            cy_ = c.y + t * (sy * 0.35 + 0.16)
            if var == 'v1':
                mm = wmain('#a8875f')
                box(r, 'seat', x, cy_, 0.44, 0.42, 0.43, 0.47, mm, 0.01); box(r, 'back', x, cy_ + t * 0.20, 0.42, 0.03, 0.62, 0.84, mm, 0.008)
                for s in (-1, 1):
                    for u in (-1, 1): cyl(r, 'leg', x + s * 0.18, cy_ + u * 0.17, 0.016, 0.0, 0.43 if u != t else 0.84, mm, 12)
            else:
                mm = wmain('#2a2827')
                box(r, 'seat', x, cy_, 0.44, 0.42, 0.44, 0.47, mm, 0.01)
                box(r, 'back', x, cy_ + t * 0.20, 0.42, 0.10, 0.66, 0.80, mm, 0.02)
                for s in (-1, 1):
                    for u in (-1, 1): box(r, 'leg', x + s * 0.19, cy_ + u * 0.18, 0.02, 0.02, 0.0, 0.44 if u != t else 0.80, M['black'], 0.0)

# ---- pendant (over the table)
H = plan['plan_meta']['heights']['ceiling_cm'] / 100.0
r = bpy.data.objects.new('VAR_pendant_v1', None); bpy.context.scene.collection.objects.link(r); r['slot'] = 'pendant'; r['variant'] = 'v1'
cyl(r, 'cord', c.x, c.y, 0.004, 1.62, H, M['black'], 8, 0.0); sphere(r, 'globe', c.x, c.y, 1.48, 0.17, mat('main_glow', lin('#f6efe0'), 0.2))
r = bpy.data.objects.new('VAR_pendant_v2', None); bpy.context.scene.collection.objects.link(r); r['slot'] = 'pendant'; r['variant'] = 'v2'
for s in (-1, 1): cyl(r, 'cord', c.x + s * 0.55, c.y, 0.003, 1.55, H, M['black'], 8, 0.0)
box(r, 'bar', c.x, c.y, 1.30, 0.05, 1.50, 1.56, mat('main_lin', lin('#1f1e1d'), 0.4), 0.004)

# ---- accessories, add-only décor
# floor lamp: just west of the sofa's back corner, outside the sofa and the armchair footprints and 15 cm off the wall behind
fs = FX['l-sofa']['rect_cm']; fa = FX['l-armchair']['rect_cm']
r = bpy.data.objects.new('VAR_floorlamp_v1', None); bpy.context.scene.collection.objects.link(r); r['slot'] = 'floorlamp'; r['variant'] = 'v1'
lp = W(fs[0] - 18, max(fs[3] - 16, fa[3] + 18))
cyl(r, 'base', lp.x, lp.y, 0.13, 0.0, 0.02, M['black'], 32); cyl(r, 'pole', lp.x, lp.y, 0.012, 0.02, 1.45, M['black'], 12)
cyl(r, 'shade', lp.x, lp.y, 0.20, 1.40, 1.70, mat('main_shade', lin('#efe9dc'), 0.7), 48, 0.0)
print('floor lamp at plan cm', round(fs[0] - 18, 1), round(max(fs[3] - 16, fa[3] + 18), 1))
# wall art / a round mirror: on the living room's longest wall run that has NO opening and no tall piece against it (add-only: a window,
# a door or a passage is never covered). A wall face = a side of a living-room rect with a wall rect just behind it.
walls = [w['rect_cm'] for w in plan['walls']]
ops = [o['rect_cm'] for o in plan['openings']]
tall = [FX[k]['rect_cm'] for k in FX if FX[k]['kind'] in ('tv_unit', 'wardrobe', 'fridge', 'plant')]
inside = lambda x, y, R, pad=0: R[0] - pad <= x <= R[2] + pad and R[1] - pad <= y <= R[3] + pad
best = None
for q in next(rr for rr in plan['rooms'] if rr['id'] == 'living')['rects_cm']:
    for side, (ax, ay, bx, by, nx, ny) in {'n': (q[0], q[1], q[2], q[1], 0, -1), 's': (q[0], q[3], q[2], q[3], 0, 1), 'w': (q[0], q[1], q[0], q[3], -1, 0), 'e': (q[2], q[1], q[2], q[3], 1, 0)}.items():
        L = int(max(abs(bx - ax), abs(by - ay))); run = []
        for k in range(L + 1):
            x, y = ax + (bx - ax) * k / max(1, L), ay + (by - ay) * k / max(1, L)
            good = any(inside(x + nx * 6, y + ny * 6, w) for w in walls) and not any(inside(x, y, o, 25) for o in ops) and not any(inside(x - nx * 20, y - ny * 20, t, 10) for t in tall)
            if good:
                run.append((x, y))
            if (not good or k == L) and run:
                if len(run) >= 140 and (best is None or len(run) > best[0]):
                    best = (len(run), run[len(run) // 2], (nx, ny), side)
                run = []
print('art wall', best and (best[0], best[3], [round(v, 1) for v in best[1]]))
if best:
    (cx_, cy_), (nx, ny) = best[1], best[2]
    mid = W(cx_ - nx * 1.5, cy_ - ny * 1.5)
    along_x = ny != 0   # the face runs along x when its normal is along y
    def flat(root, nm, w_, h_, z0, z1, m_, off):
        o = box(root, nm, mid.x - (nx * off / 100 if not along_x else 0), mid.y + (ny * off / 100 if along_x else 0), w_ if along_x else 0.03, 0.03 if along_x else w_, z0, z1, m_, 0.002)
        return o
    r = bpy.data.objects.new('VAR_art_v1', None); bpy.context.scene.collection.objects.link(r); r['slot'] = 'art'; r['variant'] = 'v1'
    flat(r, 'frame', 1.10, 0, 1.15, 1.85, M['black'], 0.0); flat(r, 'canvas', 1.04, 0, 1.18, 1.82, M['canvas'], 0.6)
    r2 = bpy.data.objects.new('VAR_art_v2', None); bpy.context.scene.collection.objects.link(r2); r2['slot'] = 'art'; r2['variant'] = 'v2'
    for nm, rad, m_, off in (('ring', 0.42, M['brass'], 0.0), ('glass', 0.40, M['mirror'], 0.6)):
        o = cyl(r2, nm, 0, 0, rad, -0.012, 0.012, m_, 64, 0.0)
        o.rotation_euler = (math.pi / 2, 0, 0 if along_x else math.pi / 2)
        o.location = (mid.x - (0 if along_x else nx * off / 100), mid.y + (ny * off / 100 if along_x else 0), 1.45)
    # two colour fields on the canvas
    for nm, m_, dx, w_, z0, z1 in (('paint1', M['art2'], -0.18, 0.42, 1.30, 1.66), ('paint2', M['art3'], 0.20, 0.30, 1.42, 1.74)):
        o = box(r, nm, mid.x + (dx if along_x else -nx * 0.012), mid.y + (0 if along_x else dx) + (ny * 0.012 if along_x else 0), w_ if along_x else 0.03, 0.03 if along_x else w_, z0, z1, m_, 0.0)
# vase on the dining table
r = bpy.data.objects.new('VAR_vase_v1', None); bpy.context.scene.collection.objects.link(r); r['slot'] = 'vase'; r['variant'] = 'v1'
sphere(r, 'vase', c.x + 0.25, c.y, 0.86, 0.09, M['clay'], 1.2)
for k in range(5):
    a_ = k * 2 * math.pi / 5
    sphere(r, 'leaf', c.x + 0.25 + 0.07 * math.cos(a_), c.y + 0.07 * math.sin(a_), 1.04, 0.06, M['leaf'], 1.8)

# bevels applied, every variant root and its meshes selected, one glb (+Y up, the same as walk3d.gltf)
for o in bpy.data.objects:
    if o.type == 'MESH':
        bpy.context.view_layer.objects.active = o
        for m_ in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m_.name)
roots = [o for o in bpy.data.objects if o.name.startswith('VAR_')]
print('variants', sorted(o.name for o in roots))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_extras=True, export_apply=True, export_materials='EXPORT')
print('WALK_VARIANTS_OK', OUT)

"""build_scene.py - plan/plan.json -> an editable, render-ready Blender scene.  $0, deterministic.

Run:  blender -b --factory-startup -P build_scene.py -- <project_dir> [--out scene.blend]

Collections: ARCH (walls, floors, ceilings, openings), FURN (fixtures + furniture), LIGHT, CAM.
World: Poly Haven `qwantani_noon_puresky_4k.hdr` (CC0, the Habait house sky) + a sun.
Lessons carried over from Rainbow / Kedma (docs/knowledge-reuse.md):
  * walls are footprints (thickness = the drawn grey), one box per grid run, never centre lines
  * glass is transparent to SHADOW rays only (sun reaches the floor) - materials_kit.glass()
  * NO skirting boards (Eliran 2026-11-10);  zero-line white doors (house style, Rainbow round 4)
  * floors are one world-space tile grid, so joints run straight through every doorway
  * no coplanar faces: floors at z=0, base slab top at -2 mm, ceilings at H, lintels stop 1 mm short
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
PROJ = argv[0]
OUT = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(PROJ, 'scene', 'apartment.blend')
plan = json.load(open(os.path.join(PROJ, 'plan', 'plan.json'), encoding='utf-8'))
ASSETS = os.path.join(PROJ, 'assets')
CAT = 'C:/RnD/Projects/3Dengine/pipeline/360walkaround/catalog/models'
HDRI = 'C:/RnD/Projects/3Dengine/pipeline/360walkaround/pipeline/probe/probe-assets/hdri/qwantani_noon_puresky_4k.hdr'

H = plan['plan_meta']['heights']['ceiling_cm'] / 100.0
SLAB = 0.25


def W(x_cm, y_cm, z_m=0.0):
    return Vector((x_cm / 100.0, -y_cm / 100.0, z_m))


# ------------------------------------------------------------------ reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
COLS = {}
for name in ('ARCH', 'FURN', 'LIGHT', 'CAM'):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    COLS[name] = c


def link(obj, col):
    COLS[col].objects.link(obj)
    return obj


# ------------------------------------------------------------------ materials
def principled(name, color, rough=0.5, metal=0.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if 'Specular IOR Level' in p.inputs:
        p.inputs['Specular IOR Level'].default_value = spec
    return m


def add_noise_color(m, c1, c2, scale=8.0, detail=6.0):
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
    r = nt.nodes.new('ShaderNodeValToRGB')
    r.color_ramp.elements[0].color = (*c1, 1); r.color_ramp.elements[1].color = (*c2, 1)
    nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
    return m


def glass(name, frosted=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (0.96, 0.98, 0.98, 1)
    p.inputs['Roughness'].default_value = 0.35 if frosted else 0.0
    p.inputs['IOR'].default_value = 1.45
    p.inputs['Transmission Weight'].default_value = 1.0
    out = nt.nodes['Material Output']
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Shadow Ray'], mix.inputs['Fac'])
    nt.links.new(p.outputs['BSDF'], mix.inputs[1])
    nt.links.new(tr.outputs['BSDF'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return m


def tile_floor(name, size_cm, color, grout, rough=0.22, var=0.03):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = rough
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    b = nt.nodes.new('ShaderNodeTexBrick')
    b.offset = 0.0; b.squash = 1.0
    b.inputs['Scale'].default_value = 1.0
    b.inputs['Brick Width'].default_value = size_cm / 100.0
    b.inputs['Row Height'].default_value = size_cm / 100.0
    b.inputs['Mortar Size'].default_value = 0.0022
    b.inputs['Mortar Smooth'].default_value = 0.1
    b.inputs['Bias'].default_value = 0.0
    c2 = tuple(max(0, v - var) for v in color)
    b.inputs['Color1'].default_value = (*color, 1)
    b.inputs['Color2'].default_value = (*c2, 1)
    b.inputs['Mortar'].default_value = (*grout, 1)
    # soft marble-like veining on top of the tile colour
    n = nt.nodes.new('ShaderNodeTexWave'); n.wave_type = 'BANDS'
    n.inputs['Scale'].default_value = 1.6; n.inputs['Distortion'].default_value = 9.0; n.inputs['Detail'].default_value = 6
    mix = nt.nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; mix.inputs['Fac'].default_value = 0.045
    nt.links.new(geo.outputs['Position'], b.inputs['Vector'])
    nt.links.new(geo.outputs['Position'], n.inputs['Vector'])
    nt.links.new(b.outputs['Color'], mix.inputs['Color1'])
    nt.links.new(n.outputs['Color'], mix.inputs['Color2'])
    nt.links.new(mix.outputs['Color'], p.inputs['Base Color'])
    # grout slightly rougher and lower
    rm = nt.nodes.new('ShaderNodeMapRange')
    rm.inputs['To Min'].default_value = rough; rm.inputs['To Max'].default_value = 0.8
    nt.links.new(b.outputs['Fac'], rm.inputs['Value'])
    nt.links.new(rm.outputs['Result'], p.inputs['Roughness'])
    return m


def wood_floor(name, tex_dir):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.5, 0.5, 0.5)  # one 2 m texture tile
    nt.links.new(geo.outputs['Position'], mp.inputs['Vector'])

    def img(fn, noncolor):
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(os.path.join(tex_dir, fn))
        if noncolor:
            t.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
        return t
    files = os.listdir(tex_dir) if os.path.isdir(tex_dir) else []
    dif = [f for f in files if 'Diffuse' in f or '_diff' in f]
    if not dif:
        p.inputs['Base Color'].default_value = (0.42, 0.30, 0.20, 1)
        return m
    d = img(dif[0], False)
    hsv = nt.nodes.new('ShaderNodeHueSaturation')
    hsv.inputs['Saturation'].default_value = 0.85; hsv.inputs['Value'].default_value = 1.05
    nt.links.new(d.outputs['Color'], hsv.inputs['Color'])
    nt.links.new(hsv.outputs['Color'], p.inputs['Base Color'])
    ro = [f for f in files if 'Rough' in f]
    if ro:
        r = img(ro[0], True)
        rm = nt.nodes.new('ShaderNodeMapRange'); rm.inputs['To Min'].default_value = 0.25; rm.inputs['To Max'].default_value = 0.6
        nt.links.new(r.outputs['Color'], rm.inputs['Value']); nt.links.new(rm.outputs['Result'], p.inputs['Roughness'])
    no = [f for f in files if 'nor_gl' in f]
    if no:
        nn = img(no[0], True)
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.4
        nt.links.new(nn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    return m


def travertine(name):
    # large-format travertine (Eliran's bathroom pictures): 120 x 60 cm, wall-aligned coordinates (u = x + y, v = z), streaky veins + pores
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = 0.42
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); ad = nt.nodes.new('ShaderNodeMath'); cb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(geo.outputs['Position'], sp.inputs['Vector']); nt.links.new(sp.outputs['X'], ad.inputs[0]); nt.links.new(sp.outputs['Y'], ad.inputs[1])
    nt.links.new(ad.outputs['Value'], cb.inputs['X']); nt.links.new(sp.outputs['Z'], cb.inputs['Y'])
    b = nt.nodes.new('ShaderNodeTexBrick'); b.offset = 0.5; b.squash = 1.0
    for k, v in (('Scale', 1.0), ('Brick Width', 1.2), ('Row Height', 0.6), ('Mortar Size', 0.0018), ('Mortar Smooth', 0.1), ('Bias', 0.0)): b.inputs[k].default_value = v
    b.inputs['Color1'].default_value = (0.58, 0.46, 0.33, 1); b.inputs['Color2'].default_value = (0.54, 0.43, 0.31, 1); b.inputs['Mortar'].default_value = (0.55, 0.47, 0.37, 1)
    nt.links.new(cb.outputs['Vector'], b.inputs['Vector'])
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.6, 9.0, 1.0); nt.links.new(cb.outputs['Vector'], mp.inputs['Vector'])
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 3.0; n.inputs['Detail'].default_value = 9; n.inputs['Distortion'].default_value = 0.6
    nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color = (0.80, 0.80, 0.80, 1); r.color_ramp.elements[1].color = (1.12, 1.10, 1.06, 1)
    nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
    mix = nt.nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; mix.inputs['Fac'].default_value = 1.0
    nt.links.new(b.outputs['Color'], mix.inputs['Color1']); nt.links.new(r.outputs['Color'], mix.inputs['Color2'])
    nt.links.new(mix.outputs['Color'], p.inputs['Base Color'])
    return m


def marble(name, base=(0.90, 0.88, 0.85), vein=(0.70, 0.69, 0.67)):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = 0.25
    geo = nt.nodes.new('ShaderNodeNewGeometry'); w = nt.nodes.new('ShaderNodeTexWave'); w.wave_type = 'BANDS'
    w.inputs['Scale'].default_value = 2.2; w.inputs['Distortion'].default_value = 14.0; w.inputs['Detail'].default_value = 8
    nt.links.new(geo.outputs['Position'], w.inputs['Vector'])
    r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].position = 0.0; r.color_ramp.elements[0].color = (*vein, 1)
    r.color_ramp.elements[1].position = 0.18; r.color_ramp.elements[1].color = (*base, 1)
    nt.links.new(w.outputs['Fac'], r.inputs['Fac']); nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
    return m


def pbr_tiled(name, tex_dir, tile_m, wall=False, rot_deg=0.0, rough=(0.3, 0.7), grout=None):
    """a seamless PBR material made from a crop of Eliran's pictures (fal patina, tools/catalog/gen_material.mjs), tiled in WORLD metres:
    floors use (x, y); walls use (x + y, z). grout = (tile_w, tile_h, colour) draws thin joints over it"""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; p = nt.nodes['Principled BSDF']
    geo = nt.nodes.new('ShaderNodeNewGeometry'); vec = geo.outputs['Position']
    if wall:
        sp = nt.nodes.new('ShaderNodeSeparateXYZ'); ad = nt.nodes.new('ShaderNodeMath'); cb = nt.nodes.new('ShaderNodeCombineXYZ')
        nt.links.new(vec, sp.inputs['Vector']); nt.links.new(sp.outputs['X'], ad.inputs[0]); nt.links.new(sp.outputs['Y'], ad.inputs[1])
        nt.links.new(ad.outputs['Value'], cb.inputs['X']); nt.links.new(sp.outputs['Z'], cb.inputs['Y']); vec = cb.outputs['Vector']
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / tile_m, 1 / tile_m, 1); mp.inputs['Rotation'].default_value = (0, 0, math.radians(rot_deg))
    nt.links.new(vec, mp.inputs['Vector'])
    def img(tag, noncolor):
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(tex_dir, f'{os.path.basename(tex_dir)}_{tag}.jpg'))
        if noncolor: t.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(mp.outputs['Vector'], t.inputs['Vector']); return t
    col = img('basecolor', False).outputs['Color']
    if grout:
        b = nt.nodes.new('ShaderNodeTexBrick'); b.offset = 0.5; b.squash = 1.0
        for k_, v_ in (('Scale', 1.0), ('Brick Width', grout[0]), ('Row Height', grout[1]), ('Mortar Size', 0.0018), ('Mortar Smooth', 0.1), ('Bias', 0.0)): b.inputs[k_].default_value = v_
        b.inputs['Color1'].default_value = (1, 1, 1, 1); b.inputs['Color2'].default_value = (1, 1, 1, 1); b.inputs['Mortar'].default_value = (*grout[2], 1)
        nt.links.new(vec, b.inputs['Vector'])
        mx = nt.nodes.new('ShaderNodeMixRGB'); mx.blend_type = 'MULTIPLY'; mx.inputs['Fac'].default_value = 1.0
        nt.links.new(col, mx.inputs['Color1']); nt.links.new(b.outputs['Color'], mx.inputs['Color2']); col = mx.outputs['Color']
    nt.links.new(col, p.inputs['Base Color'])
    rm = nt.nodes.new('ShaderNodeMapRange'); rm.inputs['To Min'].default_value = rough[0]; rm.inputs['To Max'].default_value = rough[1]
    nt.links.new(img('roughness', True).outputs['Color'], rm.inputs['Value']); nt.links.new(rm.outputs['Result'], p.inputs['Roughness'])
    nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.5
    nt.links.new(img('normal', True).outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    return m


def emission(name, strength, temp_rgb=(1.0, 0.92, 0.82)):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*temp_rgb, 1)
    e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
    return m


M = dict(
    wall=principled('wall_paint', (0.85, 0.82, 0.77), 0.85, spec=0.3),   # warm white (Eliran's pictures)
    ceiling=principled('ceiling_paint', (0.86, 0.86, 0.85), 0.92, spec=0.2),
    exterior=principled('exterior_stone', (0.78, 0.74, 0.66), 0.9),
    tile80=tile_floor('floor_porcelain_80', 80, (0.80, 0.79, 0.76), (0.66, 0.65, 0.62)),
    bathtile=tile_floor('floor_bath_60', 60, (0.62, 0.61, 0.59), (0.48, 0.47, 0.45), rough=0.45),
    bathwall=(pbr_tiled('wall_bath_travertine', os.path.join(ASSETS, 'textures', 'his_travertine'), 1.2, wall=True, rot_deg=-22, rough=(0.35, 0.6), grout=(1.2, 0.6, (0.62, 0.55, 0.45)))
              if os.path.isdir(os.path.join(ASSETS, 'textures', 'his_travertine')) else travertine('wall_bath_travertine')),   # his travertine (patina from his picture)
    parquet=(pbr_tiled('floor_parquet', os.path.join(ASSETS, 'textures', 'his_oak'), 0.62, rough=(0.3, 0.55))
             if os.path.isdir(os.path.join(ASSETS, 'textures', 'his_oak')) else wood_floor('floor_parquet', os.path.join(ASSETS, 'textures', 'laminate_floor_02'))),   # his oak planks (patina from his picture)
    deck=add_noise_color(principled('deck_wood', (0.42, 0.25, 0.14), 0.6), (0.36, 0.21, 0.11), (0.50, 0.31, 0.18), 3.0),   # teak (his picture)
    slab=principled('concrete_slab', (0.55, 0.55, 0.53), 0.85),
    ground=add_noise_color(principled('ground', (0.33, 0.36, 0.25), 0.95), (0.28, 0.33, 0.20), (0.45, 0.43, 0.32), 0.5),
    glass=glass('glass_clear'),
    frosted=glass('glass_frosted', True),
    alu=principled('aluminium_frame', (0.40, 0.40, 0.40), 0.35, 0.6),   # mid-grey frames (his pictures)
    door=principled('door_white_flush', (0.88, 0.88, 0.86), 0.35),
    door_ent=principled('door_entrance_grey', (0.22, 0.22, 0.23), 0.45, 0.3),
    steel=principled('mamad_steel', (0.80, 0.80, 0.79), 0.4, 0.2),
    handle=principled('brass_brushed', (0.78, 0.58, 0.30), 0.3, 1.0),   # brass handles, taps and plates (his pictures)
    oak=add_noise_color(principled('oak_veneer', (0.58, 0.44, 0.30), 0.5), (0.52, 0.39, 0.26), (0.66, 0.51, 0.36), 18.0),
    white_lacq=principled('white_lacquer', (0.90, 0.90, 0.88), 0.25),
    quartz=marble('quartz_caesarstone'),   # light marble-look worktop (his kitchen picture)
    sage=principled('kitchen_sage', (0.30, 0.37, 0.30), 0.45, spec=0.35),
    boucle=add_noise_color(principled('fabric_boucle', (0.70, 0.64, 0.55), 0.95, spec=0.15), (0.60, 0.55, 0.47), (0.76, 0.70, 0.61), 260.0),
    linen_beige=add_noise_color(principled('fabric_linen_beige', (0.62, 0.55, 0.46), 0.9, spec=0.15), (0.57, 0.50, 0.42), (0.67, 0.60, 0.51), 90.0),
    sheet=principled('fabric_sheet_white', (0.88, 0.87, 0.85), 0.85, spec=0.15),
    oak_light=add_noise_color(principled('oak_light', (0.66, 0.52, 0.37), 0.5), (0.60, 0.47, 0.33), (0.72, 0.58, 0.42), 30.0),
    trav=travertine('travertine_table'),
    cream=principled('cream_lacquer', (0.84, 0.80, 0.74), 0.4),
    ceramic=principled('ceramic_white', (0.88, 0.86, 0.82), 0.2),
    teak=add_noise_color(principled('teak', (0.42, 0.26, 0.14), 0.5), (0.37, 0.22, 0.12), (0.48, 0.31, 0.17), 25.0),
    stone_planter=add_noise_color(principled('stone_planter', (0.62, 0.56, 0.47), 0.9), (0.56, 0.50, 0.42), (0.68, 0.62, 0.53), 18.0),
    cream_fabric=add_noise_color(principled('fabric_cream_chair', (0.74, 0.69, 0.61), 0.85, spec=0.2), (0.70, 0.65, 0.57), (0.78, 0.73, 0.65), 160.0),
    steel_app=principled('stainless', (0.72, 0.72, 0.72), 0.25, 1.0),
    black_glass=principled('black_ceramic_hob', (0.02, 0.02, 0.02), 0.08),
    sink=principled('sink_granite_black', (0.06, 0.06, 0.06), 0.4),
    concrete_sink=principled('sink_stone_light', (0.74, 0.71, 0.66), 0.5),
    porcelain=principled('sanitary_porcelain', (0.93, 0.93, 0.92), 0.08),
    fabric_grey=add_noise_color(principled('fabric_warm_grey', (0.55, 0.53, 0.50), 0.9, spec=0.2), (0.50, 0.48, 0.45), (0.58, 0.56, 0.53), 120.0),
    fabric_light=add_noise_color(principled('fabric_linen', (0.86, 0.84, 0.80), 0.9, spec=0.2), (0.82, 0.80, 0.76), (0.88, 0.86, 0.82), 140.0),
    fabric_accent=principled('fabric_sage', (0.42, 0.47, 0.40), 0.9, spec=0.2),
    rug=add_noise_color(principled('rug_wool', (0.72, 0.68, 0.61), 0.98, spec=0.1), (0.66, 0.62, 0.55), (0.78, 0.74, 0.67), 120.0),
    walnut=add_noise_color(principled('walnut', (0.30, 0.20, 0.13), 0.45), (0.26, 0.17, 0.11), (0.36, 0.25, 0.17), 20.0),
    black_metal=principled('black_metal', (0.03, 0.03, 0.03), 0.4, 0.9),
    tv=principled('tv_screen', (0.01, 0.01, 0.012), 0.05),
    mirror=principled('mirror', (0.95, 0.95, 0.95), 0.0, 1.0),
    lamp=emission('lamp_warm', 3.0),
    shade=principled('lamp_shade', (0.92, 0.90, 0.86), 0.6),
)


# ------------------------------------------------------------------ mesh helpers
def box(name, x0, y0, x1, y1, z0, z1, mat, col='ARCH', bevel=0.0):
    """axis-aligned box from plan cm (x0..x1, y0..y1) and world metres z0..z1"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    a, b = W(min(x0, x1), max(y0, y1)), W(max(x0, x1), min(y0, y1))
    ob.location = ((a.x + b.x) / 2, (a.y + b.y) / 2, (z0 + z1) / 2)
    ob.scale = (abs(b.x - a.x), abs(b.y - a.y), abs(z1 - z0))
    ob.data.materials.append(mat)
    link(ob, col)
    if bevel > 0:
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        ob.select_set(False)
        mod = ob.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 3; mod.limit_method = 'ANGLE'
    return ob


def wbox(name, cx, cy, sx, sy, z0, z1, mat, rot_deg=0.0, col='FURN', bevel=0.004):
    """box centred at world (cx, cy) metres, size sx, sy metres, rotated about z"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, z1 - z0), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.location = (cx, cy, (z0 + z1) / 2)
    ob.rotation_euler = (0, 0, math.radians(rot_deg))
    ob.data.materials.append(mat)
    link(ob, col)
    if bevel > 0:
        mod = ob.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 3; mod.limit_method = 'ANGLE'
    return ob


def cyl(name, cx, cy, r, z0, z1, mat, col='FURN', verts=48, bevel=0.003):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=z1 - z0, location=(cx, cy, (z0 + z1) / 2))
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(mat)
    for c in ob.users_collection:
        c.objects.unlink(ob)
    link(ob, col)
    bpy.ops.object.shade_smooth()
    if bevel > 0:
        mod = ob.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 2; mod.limit_method = 'ANGLE'
    return ob


def plane(name, x0, y0, x1, y1, z, mat, col='ARCH', down=False):
    me = bpy.data.meshes.new(name)
    a, b = W(x0, y1, z), W(x1, y0, z)
    vs = [(a.x, a.y, z), (b.x, a.y, z), (b.x, b.y, z), (a.x, b.y, z)]
    fs = [(3, 2, 1, 0)] if down else [(0, 1, 2, 3)]
    me.from_pydata(vs, [], fs)
    me.update()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    link(ob, col)
    return ob


def frame_rect(r):
    x0, y0, x1, y1 = r
    return W((x0 + x1) / 2, (y0 + y1) / 2), (x1 - x0) / 100.0, (y1 - y0) / 100.0


# ------------------------------------------------------------------ grid, inside cells
G = plan['grid']
XS, YS, CELLS = G['xs_cm'], G['ys_cm'], G['cells']
NJ, NI = len(YS) - 1, len(XS) - 1


def overlaps(r, x0, y0, x1, y1, eps=0.5):
    return r[0] < x1 - eps and r[2] > x0 + eps and r[1] < y1 - eps and r[3] > y0 + eps


blocked = [[bool(CELLS[j][i]) for i in range(NI)] for j in range(NJ)]
for o in plan['openings']:
    for j in range(NJ):
        for i in range(NI):
            if overlaps(o['rect_cm'], XS[i], YS[j], XS[i + 1], YS[j + 1]):
                blocked[j][i] = True
outside = [[False] * NI for _ in range(NJ)]
stack = [(j, i) for j in range(NJ) for i in range(NI) if (j in (0, NJ - 1) or i in (0, NI - 1)) and not blocked[j][i]]
while stack:
    j, i = stack.pop()
    if outside[j][i] or blocked[j][i]:
        continue
    outside[j][i] = True
    for dj, di in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        a, b = j + dj, i + di
        if 0 <= a < NJ and 0 <= b < NI and not outside[a][b] and not blocked[a][b]:
            stack.append((a, b))
inside = [[(not outside[j][i]) and not CELLS[j][i] for i in range(NI)] for j in range(NJ)]


def room_of(x, y):
    for r in plan['rooms']:
        for q in r['rects_cm']:
            if q[0] - 1 <= x <= q[2] + 1 and q[1] - 1 <= y <= q[3] + 1:
                return r
    return None


def opening_at(x, y):
    for o in plan['openings']:
        q = o['rect_cm']
        if q[0] <= x <= q[2] and q[1] <= y <= q[3]:
            return o
    return None


# ------------------------------------------------------------------ walls (one box per merged grid run)
for k, w in enumerate(plan['walls']):
    x0, y0, x1, y1 = w['rect_cm']
    box('wall_%03d' % k, x0, y0, x1, y1, 0.0, H, M['wall'])

# ------------------------------------------------------------------ floors and ceilings per inside cell, merged per material
by_mat = {}
for j in range(NJ):
    for i in range(NI):
        x0, x1, y0, y1 = XS[i], XS[i + 1], YS[j], YS[j + 1]
        xc, yc = (x0 + x1) / 2, (y0 + y1) / 2
        o = opening_at(xc, yc)
        if inside[j][i]:
            r = room_of(xc, yc)
            fm = 'parquet'   # Eliran's pictures: light oak planks in every room, the bathrooms too (2026-11-17)
            by_mat.setdefault(fm, []).append((x0, y0, x1, y1))
            by_mat.setdefault('_ceiling', []).append((x0, y0, x1, y1))
        elif o and o['kind'] in ('door', 'mamad_door', 'passage', 'entrance_door', 'sliding_door'):
            by_mat.setdefault('parquet', []).append((x0, y0, x1, y1))


def merged_plane(name, rects, z, mat, down=False):
    me = bpy.data.meshes.new(name)
    vs, fs = [], []
    for (x0, y0, x1, y1) in rects:
        a, b = W(x0, y1, z), W(x1, y0, z)
        n = len(vs)
        vs += [(a.x, a.y, z), (b.x, a.y, z), (b.x, b.y, z), (a.x, b.y, z)]
        fs.append((n + 3, n + 2, n + 1, n) if down else (n, n + 1, n + 2, n + 3))
    me.from_pydata(vs, [], fs)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)   # one welded surface: one light-bake island, no stripes
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.0), verts=bm.verts, edges=bm.edges)
    bm.to_mesh(me); bm.free()
    me.update()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    link(ob, 'ARCH')
    bpy.context.view_layer.objects.active = ob
    return ob


for k, rects in by_mat.items():
    if k == '_ceiling':
        merged_plane('ceiling', rects, H, M['ceiling'], down=True)
    else:
        key = k if k in M else next((r['floor'] for r in plan['rooms'] if r['id'] == k), 'tile80')
        merged_plane('floor_' + k, rects, 0.0, M[key])

# building slab below the apartment and above (the floor above), slightly larger than the walls
ax0, ax1 = XS[0], XS[-1]
ay0, ay1 = YS[0], YS[-1]
box('slab_below', ax0 - 40, ay0 - 40, ax1 + 40, ay1 + 40, -SLAB, -0.002, M['slab'])
box('slab_above', ax0 - 10, ay0 - 10, ax1 + 10, ay1 + 10, H + 0.001, H + SLAB, M['slab'])
# ground three metres below (first floor) and far away
plane('ground', ax0 - 6000, ay0 - 6000, ax1 + 6000, ay1 + 6000, -3.3, M['ground'])

# balcony: deck, railing, roof part
bal = next(r for r in plan['rooms'] if r['id'] == 'balcony')
bc = plan['balcony']['clear_rect_cm']
for q in bal['rects_cm']:
    plane('floor_balcony', q[0], q[1], q[2], q[3], 0.0, M['deck'])
rx0, ry0, rx1, ry1 = plan['balcony']['rail_cm']
rh = plan['plan_meta']['heights']['rail_cm'] / 100.0
box('balcony_parapet', rx0, ry0 - 2, rx1, ry1 + 2, 0.0, rh, M['wall'], bevel=0.004)   # solid plastered parapet (his balcony picture)
box('balcony_roof', bc[0], plan['balcony']['roof_from_y_cm'], bc[2], bc[3], H + 0.001, H + SLAB, M['slab'])
plane('balcony_soffit', bc[0], plan['balcony']['roof_from_y_cm'], bc[2], bc[3], H, M['ceiling'], down=True)

# laundry niche: outside service space (drying rack drawn) - floor slab only



# ------------------------------------------------------------------ openings: sills, lintels, frames, glass, doors
def wall_band(o):
    """the wall thickness range (cm) perpendicular to the opening, from the walls touching its ends"""
    r = o['rect_cm']
    lo, hi = None, None
    for w in plan['walls']:
        q = w['rect_cm']
        if o['axis'] == 'x':
            touch = abs(q[2] - r[0]) < 3 or abs(q[0] - r[2]) < 3
            if touch and q[1] >= r[1] - 3 and q[3] <= r[3] + 3:
                lo = q[1] if lo is None else min(lo, q[1]); hi = q[3] if hi is None else max(hi, q[3])
        else:
            touch = abs(q[3] - r[1]) < 3 or abs(q[1] - r[3]) < 3
            if touch and q[0] >= r[0] - 3 and q[2] <= r[2] + 3:
                lo = q[0] if lo is None else min(lo, q[0]); hi = q[2] if hi is None else max(hi, q[2])
    if lo is None:
        lo, hi = (r[1], r[3]) if o['axis'] == 'x' else (r[0], r[2])
    return lo, hi


def span(o):
    r = o['rect_cm']
    return (r[0], r[2]) if o['axis'] == 'x' else (r[1], r[3])


def rect_from(o, a0, a1, b0, b1):
    return (a0, b0, a1, b1) if o['axis'] == 'x' else (b0, a0, b1, a1)


for o in plan['openings']:
    a0, a1 = span(o)
    b0, b1 = wall_band(o)
    sill, head = o['sill_cm'] / 100.0, o['head_cm'] / 100.0
    if head < H - 0.005:
        box('lintel_' + o['id'], *rect_from(o, a0, a1, b0, b1)[:2], *rect_from(o, a0, a1, b0, b1)[2:], head, H, M['wall'])
    if sill > 0.005:
        box('sill_' + o['id'], *rect_from(o, a0, a1, b0, b1)[:2], *rect_from(o, a0, a1, b0, b1)[2:], 0.0, sill, M['wall'])
        # stone window board on the inside face is not on the plan: leave the sill plain (no invention)
    mid = (b0 + b1) / 2
    fr = 4.0  # frame depth cm
    if o['kind'] in ('window', 'sliding_door'):
        gmat = M['frosted'] if o.get('frosted') else M['glass']
        n_pan = 2 if (a1 - a0) > 70 else 1
        if o['kind'] == 'sliding_door':
            n_pan = 2 if (a1 - a0) < 250 else 4
        # outer frame
        t = 5.0
        for (p0, p1, z0, z1) in ((a0, a0 + t, sill, head), (a1 - t, a1, sill, head), (a0, a1, sill, sill + 0.05), (a0, a1, head - 0.05, head)):
            box('frame_' + o['id'], *rect_from(o, p0, p1, mid - fr, mid + fr)[:2], *rect_from(o, p0, p1, mid - fr, mid + fr)[2:], z0, z1, M['alu'], bevel=0.002)
        step = (a1 - a0) / n_pan
        for k in range(n_pan):
            p0, p1 = a0 + k * step, a0 + (k + 1) * step
            off = -1.5 if k % 2 == 0 else 1.5
            box('glass_%s_%d' % (o['id'], k), *rect_from(o, p0 + 2, p1 - 2, mid + off - 0.4, mid + off + 0.4)[:2],
                *rect_from(o, p0 + 2, p1 - 2, mid + off - 0.4, mid + off + 0.4)[2:], sill + 0.05, head - 0.05, gmat)
            # sash stiles
            for (s0, s1) in ((p0 + 1, p0 + 4), (p1 - 4, p1 - 1)):
                box('sash_%s_%d' % (o['id'], k), *rect_from(o, s0, s1, mid + off - 1.6, mid + off + 1.6)[:2],
                    *rect_from(o, s0, s1, mid + off - 1.6, mid + off + 1.6)[2:], sill + 0.05, head - 0.05, M['alu'], bevel=0.002)
        # roller-shutter box on the outside face (Israeli standard; the spec lists electric shutters)
        bo = b0 if o['axis'] == 'x' and b0 < mid else b0
    elif o['kind'] in ('door', 'mamad_door', 'entrance_door'):
        width = a1 - a0
        leaf_t = 4.5 if o['kind'] != 'mamad_door' else 7.0
        mat = {'door': M['door'], 'mamad_door': M['steel'], 'entrance_door': M['door_ent']}[o['kind']]
        # zero-line frame: a thin flush jamb liner only
        for (p0, p1) in ((a0, a0 + 1.0), (a1 - 1.0, a1)):
            box('jamb_' + o['id'], *rect_from(o, p0, p1, b0, b1)[:2], *rect_from(o, p0, p1, b0, b1)[2:], 0.0, head, mat)
        # leaf, opened ~ 95 degrees toward the swing side, hinge at the given end
        hinge_a = a0 + 1.0 if o['hinge'] in ('x0', 'y0') else a1 - 1.0
        sgn_open = 1 if o['swing'][0] == '+' else -1
        leaf_len = (width - 2.0) / 100.0
        hz = head - 0.01
        hinge_w = W(hinge_a, mid) if o['axis'] == 'x' else W(mid, hinge_a)
        # closed direction (unit vector from hinge along the opening) in world
        if o['axis'] == 'x':
            closed = Vector((1, 0, 0)) if hinge_a < (a0 + a1) / 2 else Vector((-1, 0, 0))
            normal = Vector((0, -sgn_open, 0))  # plan +y = world -y
        else:
            closed = Vector((0, -1, 0)) if hinge_a < (a0 + a1) / 2 else Vector((0, 1, 0))
            normal = Vector((sgn_open, 0, 0))
        ang = math.radians(92)
        d = (closed * math.cos(ang) + normal * math.sin(ang)).normalized()
        c = hinge_w + d * (leaf_len / 2) + normal * 0.0
        yaw = math.degrees(math.atan2(d.y, d.x))
        leaf = wbox('leaf_' + o['id'], c.x, c.y, leaf_len, leaf_t / 100.0, 0.005, hz, mat, rot_deg=yaw, col='ARCH', bevel=0.002)
        # lever handle on both faces near the free edge
        tip = hinge_w + d * (leaf_len - 0.07)
        perp = Vector((-d.y, d.x, 0))
        for s in (1, -1):
            hp = tip + perp * s * (leaf_t / 200.0 + 0.03)
            wbox('handle_' + o['id'], hp.x, hp.y, 0.13, 0.018, 1.03, 1.05, M['handle'], rot_deg=yaw, col='ARCH', bevel=0.004)

# ------------------------------------------------------------------ furniture and fixtures
FX = {f['id']: f for f in plan['fixtures']}


def fx_box(f, z0, z1, mat, inset=0.0, bevel=0.006, name=None):
    x0, y0, x1, y1 = f['rect_cm']
    return box(name or f['id'], x0 + inset, y0 + inset, x1 - inset, y1 - inset, z0, z1, mat, col='FURN', bevel=bevel)


def centre(f):
    x0, y0, x1, y1 = f['rect_cm']
    return W((x0 + x1) / 2, (y0 + y1) / 2), (x1 - x0) / 100.0, (y1 - y0) / 100.0


def append_blend(path, name, loc, target_xy=None, rot_deg=0.0, keep_aspect=True):
    """append every object of a Poly Haven .blend as one parented group, scaled to the footprint"""
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = list(src.objects)
    objs = [o for o in dst.objects if o is not None and o.type in ('MESH', 'EMPTY')]
    root = bpy.data.objects.new(name, None)
    link(root, 'FURN')
    for o in objs:
        link(o, 'FURN')
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    pts = []
    for o in objs:
        if o.type == 'MESH':
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    s = 1.0
    if target_xy:
        sx, sy = target_xy[0] / max(1e-6, mx.x - mn.x), target_xy[1] / max(1e-6, mx.y - mn.y)
        s = min(sx, sy) if keep_aspect else (sx + sy) / 2
    root.scale = (s, s, s)
    root.location = (loc.x - s * (mn.x + mx.x) / 2, loc.y - s * (mn.y + mx.y) / 2, -s * mn.z)
    if rot_deg:
        piv = bpy.data.objects.new(name + '_pivot', None)
        link(piv, 'FURN')
        piv.location = (loc.x, loc.y, 0)
        root.parent = piv
        root.location = (-s * (mn.x + mx.x) / 2, -s * (mn.y + mx.y) / 2, -s * mn.z)
        piv.rotation_euler = (0, 0, math.radians(rot_deg))
    return root


def import_glb(path, name, loc, size_xyz, rot_deg=0.0):
    bpy.ops.import_scene.gltf(filepath=path)
    objs = list(bpy.context.selected_objects)
    root = bpy.data.objects.new(name, None)
    link(root, 'FURN')
    for o in objs:
        for c in o.users_collection:
            c.objects.unlink(o)
        link(o, 'FURN')
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    pts = []
    for o in objs:
        if o.type == 'MESH':
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ext = mx - mn
    root.scale = (size_xyz[0] / ext.x, size_xyz[1] / ext.y, size_xyz[2] / ext.z)
    piv = bpy.data.objects.new(name + '_pivot', None)
    link(piv, 'FURN')
    piv.location = (loc.x, loc.y, 0)
    root.parent = piv
    root.location = (-root.scale.x * (mn.x + mx.x) / 2, -root.scale.y * (mn.y + mx.y) / 2, -root.scale.z * mn.z)
    piv.rotation_euler = (0, 0, math.radians(rot_deg))
    return root


FRONT_YAW = {'+x': 0.0, '-x': 180.0, '+y': -90.0, '-y': 90.0}
BASE_GLB = os.path.join(PROJ, 'work', 'catalog', 'web')
_GLB_CACHE = {}
WFRONT = {'+x': (1, 0), '-x': (-1, 0), '+y': (0, -1), '-y': (0, 1)}


def base_glb(item, name, rect, front, depth_share=1.0, centre=None, z0=0.0):
    """import work/catalog/web/<item>.glb as a piece named `name` on the plan rect (cm), facing `front`; None when not generated yet"""
    path = os.path.join(BASE_GLB, item + '.glb')
    if not os.path.exists(path):
        return None
    if item in _GLB_CACHE:   # a repeated piece shares its mesh and textures (one copy in the glTF)
        objs = []
        for src in _GLB_CACHE[item]:
            o = src.copy(); o.parent = None; o.matrix_world = src.matrix_basis.copy() if src.parent else src.matrix_world.copy(); objs.append(o)
            for c in o.users_collection: c.objects.unlink(o)
            bpy.context.scene.collection.objects.link(o)
    else:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        objs = [o for o in bpy.data.objects if o not in before]
        objs = [o for o in objs if o.type == 'MESH'] + [o for o in objs if o.type != 'MESH']
        for o in [o for o in objs if o.type != 'MESH']:
            for ch in list(o.children): ch.parent = None
        for o in [o for o in objs if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
        objs = [o for o in objs if o.name in bpy.data.objects]
        bpy.context.view_layer.update()
        for o in objs: o.matrix_world = o.matrix_world.copy()
        _GLB_CACHE[item] = list(objs)
    root = bpy.data.objects.new(name, None); link(root, 'FURN'); root['base_glb'] = item
    for o in objs:
        for c in o.users_collection:
            c.objects.unlink(o)
        link(o, 'FURN')
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    w = max(p.x for p in pts) - min(p.x for p in pts); d = max(p.y for p in pts) - min(p.y for p in pts)
    x0, y0, x1, y1 = rect
    wx, wy = WFRONT[front or '+y']
    W_, D_ = (x1 - x0) / 100.0, (y1 - y0) / 100.0 * depth_share
    if wx != 0:
        W_, D_ = D_, W_
    sc = min(1.0, W_ / max(1e-3, w), D_ / max(1e-3, d))
    c = centre or W((x0 + x1) / 2, (y0 + y1) / 2)
    root.scale = (sc, sc, sc); root.location = (c.x, c.y, z0)
    root.rotation_euler = (0, 0, math.atan2(wx, -wy))
    for o in bpy.context.selected_objects: o.select_set(False)   # later helpers apply transforms to the selection
    return root  # world yaw of the facing direction (plan +y = world -y)

# kitchen ----------------------------------------------------------
CT, CTH = 0.87, 0.03
for fid in ('k-counter-n', 'k-counter-w'):
    f = FX[fid]
    fx_box(f, 0.10, CT, M['sage'], bevel=0.003, name=fid + '_carcass')
    fx_box(f, 0.0, 0.10, M['sage'], inset=4, bevel=0.0, name=fid + '_plinth')
    x0, y0, x1, y1 = f['rect_cm']
    pad = 1.5
    box(fid + '_top', x0, y0, x1 + (pad if fid.endswith('w') else 0), y1 + (pad if fid.endswith('n') else 0), CT, CT + CTH, M['quartz'], col='FURN', bevel=0.002)
# drawer/door gaps on the fronts: thin dark lines every 60 cm
for fid, axis in (('k-counter-n', 'x'), ('k-counter-w', 'y')):
    x0, y0, x1, y1 = FX[fid]['rect_cm']
    if axis == 'x':
        x = x0 + 60 * 2.2681 / 2.2681
        while x < x1 - 20:
            box(fid + '_gap', x - 0.15, y1 - 0.2, x + 0.15, y1 + 0.05, 0.12, CT - 0.01, M['black_metal'], col='FURN')
            x += 60
        dx_ = x0
        while dx_ < x1 - 10:   # shaker doors (his kitchen picture): a 6 cm frame standing 6 mm proud of every 60 cm door
            e_ = min(x1, dx_ + 60)
            for (ax0, ax1, z0_, z1_) in ((dx_ + 0.6, dx_ + 6.0, 0.13, CT - 0.02), (e_ - 6.0, e_ - 0.6, 0.13, CT - 0.02), (dx_ + 6.0, e_ - 6.0, 0.13, 0.19), (dx_ + 6.0, e_ - 6.0, CT - 0.08, CT - 0.02)):
                box(fid + '_frame', ax0, y1, ax1, y1 + 0.6, z0_, z1_, M['sage'], col='FURN', bevel=0.0015)
            dx_ += 60
        xx = x0 + 30
        while xx < x1 - 10:   # a brass bar handle at the top of every 60 cm door (his kitchen picture)
            box(fid + '_pull', xx - 8, y1 + 0.6, xx + 8, y1 + 2.4, CT - 0.12, CT - 0.105, M['handle'], col='FURN', bevel=0.002)
            xx += 60
    else:
        y = y0 + 60
        while y < y1 - 20:
            box(fid + '_gap', x1 - 0.2, y - 0.15, x1 + 0.05, y + 0.15, 0.12, CT - 0.01, M['black_metal'], col='FURN')
            y += 60
        dy_ = y0
        while dy_ < y1 - 10:
            e_ = min(y1, dy_ + 60)
            for (ay0, ay1, z0_, z1_) in ((dy_ + 0.6, dy_ + 6.0, 0.13, CT - 0.02), (e_ - 6.0, e_ - 0.6, 0.13, CT - 0.02), (dy_ + 6.0, e_ - 6.0, 0.13, 0.19), (dy_ + 6.0, e_ - 6.0, CT - 0.08, CT - 0.02)):
                box(fid + '_frame', x1, ay0, x1 + 0.6, ay1, z0_, z1_, M['sage'], col='FURN', bevel=0.0015)
            dy_ += 60
        yy = y0 + 30
        while yy < y1 - 10:
            box(fid + '_pull', x1 + 0.6, yy - 8, x1 + 2.4, yy + 8, CT - 0.12, CT - 0.105, M['handle'], col='FURN', bevel=0.002)
            yy += 60
# backsplash (quartz, 60 cm) on both counter walls
x0, y0, x1, y1 = FX['k-counter-n']['rect_cm']
wk = next(o for o in plan['openings'] if o['id'] == 'w-kitchen')['rect_cm']
# (no backsplash: Eliran's kitchen picture shows the painted wall above the worktop)
# hob
f = FX['k-hob']
c, sx, sy = centre(f)
wbox('k-hob', c.x, c.y, min(sx, 0.60), min(sy, 0.52), CT + CTH, CT + CTH + 0.006, M['black_glass'], bevel=0.002)
for dx in (-0.14, 0.14):
    for dy in (-0.12, 0.12):
        cyl('k-burner', c.x + dx, c.y + dy, 0.045, CT + CTH + 0.006, CT + CTH + 0.02, M['black_metal'], verts=24)
# sinks (undermount black granite bowls; the counter is flat - "כיור בהתקנה שטוחה")
for fid in ('k-sink-1', 'k-sink-2'):
    f = FX[fid]
    c, sx, sy = centre(f)
    wbox(fid, c.x, c.y, sx * 0.80, sy * 0.80, CT + CTH, CT + CTH + 0.0012, M['concrete_sink'], bevel=0.0)   # integrated stone sinks (his picture)
c1, _, _ = centre(FX['k-sink-1']); c2, _, _ = centre(FX['k-sink-2'])
tapx = W(FX['k-counter-w']['rect_cm'][0] + 8, 0).x
tapy = (c1.y + c2.y) / 2
for ty in (c1.y, c2.y):   # one brass tap per sink (his picture)
    cyl('k-tap', tapx, ty, 0.016, CT + CTH, CT + CTH + 0.30, M['handle'], verts=24)
    wbox('k-tap-spout', tapx + 0.09, ty, 0.18, 0.02, CT + CTH + 0.27, CT + CTH + 0.29, M['handle'])
# fridge (stainless, full height 185) + tall cabinet above
f = FX['k-fridge']
fx_box(f, 0.0, 1.85, M['steel_app'], inset=1.5, bevel=0.008)
# (no upper cabinets and no cabinet over the fridge: Eliran's kitchen picture shows none; the plan's uppers were ASSUMED)

# living -----------------------------------------------------------
f = FX['l-sofa']; c, sx, sy = centre(f)
yaw = FRONT_YAW[f['front']]
# build the sofa in local frame (x = width, y = depth, facing -y local -> rotate so front faces f['front'])
sofa_parts = []
dpt, wid = sy, sx
# the sofa of Eliran's living-room picture: cream boucle blocks on a thin light-oak base frame (2026-11-17)
sofa_parts.append(wbox('sofa_base', 0, 0, wid, dpt, 0.04, 0.16, M['oak_light'], bevel=0.006))
sofa_parts.append(wbox('sofa_seatbase', 0, 0.01, wid - 0.04, dpt - 0.04, 0.16, 0.36, M['boucle'], bevel=0.03))
sofa_parts.append(wbox('sofa_back', 0, -dpt / 2 + 0.11, wid - 0.02, 0.20, 0.36, 0.80, M['boucle'], bevel=0.06))
for s_ in (-1, 1):
    sofa_parts.append(wbox('sofa_arm', s_ * (wid / 2 - 0.09), 0.0, 0.18, dpt - 0.02, 0.16, 0.60, M['boucle'], bevel=0.07))
n_seat = 2
sw = (wid - 0.36) / n_seat
for k in range(n_seat):
    x = -wid / 2 + 0.18 + sw * (k + 0.5)
    sofa_parts.append(wbox('sofa_cushion', x, 0.06, sw - 0.012, dpt - 0.30, 0.36, 0.50, M['boucle'], bevel=0.05))
    sofa_parts.append(wbox('sofa_backcushion', x, -dpt / 2 + 0.28, sw - 0.02, 0.16, 0.48, 0.82, M['boucle'], bevel=0.06))
sofa = bpy.data.objects.new('l-sofa-procedural', None); link(sofa, 'FURN')
for p_ in sofa_parts:
    p_.parent = sofa
sofa.location = (c.x, c.y, 0)
sofa.rotation_euler = (0, 0, math.radians(yaw - 90.0))
if base_glb('base_sofa', 'l-sofa', f['rect_cm'], f['front']):   # the sofa of his picture, generated: the procedural one goes
    for p_ in sofa_parts: bpy.data.objects.remove(p_, do_unlink=True)
    bpy.data.objects.remove(sofa, do_unlink=True)
else:
    sofa.name = 'l-sofa'
# no armchair: Eliran's living-room pictures show the sofa, the round table, the rug and a wall TV only
f = FX['l-rug']; x0, y0, x1, y1 = f['rect_cm']
box('l-rug', x0, y0, x1, y1, 0.0005, 0.012, M['rug'], col='FURN', bevel=0.004)
f = FX['l-coffee']; c, sx, sy = centre(f)
r_ = min(sx, sy) / 2 * 0.86   # the travertine round table on a crossed light-oak base (his picture)
if not base_glb('base_coffee', 'l-coffee', [f['rect_cm'][0] + 8, f['rect_cm'][1] + 8, f['rect_cm'][2] - 8, f['rect_cm'][3] - 8], '-y'):
    cyl('l-coffee-top', c.x, c.y, r_, 0.36, 0.40, M['trav'], verts=72, bevel=0.006)
    wbox('l-coffee-leg', c.x, c.y, r_ * 1.15, 0.07, 0.0, 0.36, M['oak_light'], rot_deg=35, bevel=0.004)
    wbox('l-coffee-leg', c.x, c.y, r_ * 1.15, 0.07, 0.0, 0.36, M['oak_light'], rot_deg=125, bevel=0.004)
f = FX['l-tv']; x0, y0, x1, y1 = f['rect_cm']
cx_ = W(x1 - 0.5, (y0 + y1) / 2)
wbox('l-tv', cx_.x - 0.025, cx_.y, 0.035, 1.22, 1.10, 1.80, M['tv'], col='FURN', bevel=0.003)   # wall-mounted, no unit (his picture)
# dining table + 6 chairs
f = FX['l-dining']; c, sx, sy = centre(f)
if not base_glb('base_dining', 'l-dining', f['rect_cm'], '+y', depth_share=0.70):
    wbox('l-dining-top', c.x, c.y, sx, sy * 0.70, 0.72, 0.76, M['oak_light'], bevel=0.004)
    for s_ in (-1, 1):   # two solid oak block legs (his dining picture)
        wbox('l-dining-leg', c.x + s_ * (sx / 2 - 0.30), c.y, 0.10, sy * 0.48, 0.0, 0.72, M['oak_light'], bevel=0.004)
for k in range(3):
    x = c.x - sx / 2 + sx * (k + 0.5) / 3
    for t in (-1, 1):
        cy_ = c.y + t * (sy * 0.35 + 0.16)
        pc_ = Vector((x, cy_, 0)); cx_cm, cy_cm = x * 100, -cy_ * 100
        if base_glb('base_chair', 'chair_%d_%d' % (k, t + 1), [cx_cm - 26, cy_cm - 28, cx_cm + 26, cy_cm + 28], '+y' if t > 0 else '-y', centre=pc_):
            continue   # his chair, generated, facing the table
        wbox('chair_seat', x, cy_, 0.46, 0.44, 0.42, 0.50, M['cream_fabric'], bevel=0.03)
        wbox('chair_back', x, cy_ + t * 0.20, 0.44, 0.07, 0.50, 0.90, M['cream_fabric'], bevel=0.03)
        for s_ in (-1, 1):
            for u in (-1, 1):
                cyl('chair_leg', x + s_ * 0.18, cy_ + u * 0.17, 0.017, 0.0, 0.42, M['oak_light'], verts=12, bevel=0.0)
f = FX['l-plant']; c, sx, sy = centre(f)
append_blend(os.path.join(CAT, 'polyhaven-potted_plant_02', 'potted_plant_02_2k.blend'), 'l-plant', c, (0.55, 0.55))

# bedrooms ---------------------------------------------------------
def wardrobe(f):
    x0, y0, x1, y1 = f['rect_cm']
    fluted = f['id'] == 'm-wardrobe'
    fx_box(f, 0.0, 2.40, M['cream'] if fluted else M['white_lacq'], bevel=0.002)
    long_x = (x1 - x0) > (y1 - y0)
    L0, L1 = (x0, x1) if long_x else (y0, y1)
    if fluted:   # vertical flutes every 4 cm on the front (his master-bedroom picture)
        k = L0 + 2
        while k < L1 - 2:
            if long_x:
                fy = y1 if f['front'] == '+y' else y0
                box(f['id'] + '_flute', k - 0.9, fy - 0.25 if f['front'] == '-y' else fy, k + 0.9, fy if f['front'] == '-y' else fy + 0.25, 0.03, 2.37, M['cream'], col='FURN', bevel=0.002)   # shallow 2.5 mm ribs
            else:
                fx = x1 if f['front'] == '+x' else x0
                box(f['id'] + '_flute', fx - 0.25 if f['front'] == '-x' else fx, k - 0.9, fx if f['front'] == '-x' else fx + 0.25, k + 0.9, 0.03, 2.37, M['cream'], col='FURN', bevel=0.002)
            k += 4
    nd = max(2, round((L1 - L0) / 50))
    for d_ in range(nd):   # a long vertical bar handle on every door (brass on the fluted one)
        m_ = L0 + (L1 - L0) * (d_ + 0.5) / nd + (8 if d_ % 2 == 0 else -8)
        mat = M['handle'] if fluted else M['alu']
        if long_x:
            fy = (y1 + 1.6) if f['front'] == '+y' else (y0 - 1.6)
            box(f['id'] + '_bar', m_ - 0.8, fy - 0.8, m_ + 0.8, fy + 0.8, 0.70, 1.70, mat, col='FURN', bevel=0.002)
        else:
            fx = (x1 + 1.6) if f['front'] == '+x' else (x0 - 1.6)
            box(f['id'] + '_bar', fx - 0.8, m_ - 0.8, fx + 0.8, m_ + 0.8, 0.70, 1.70, mat, col='FURN', bevel=0.002)
    return
    # door gaps every ~50 cm along the long side
    long_x = (x1 - x0) > (y1 - y0)
    n = max(2, round(((x1 - x0) if long_x else (y1 - y0)) / 50))
    for k in range(1, n):
        if long_x:
            x = x0 + (x1 - x0) * k / n
            fy = y1 if f['front'] == '+y' else y0
            box(f['id'] + '_gap', x - 0.2, fy - 0.3, x + 0.2, fy + 0.3, 0.02, 2.38, M['walnut'], col='FURN')
        else:
            y = y0 + (y1 - y0) * k / n
            fx = x1 if f['front'] == '+x' else x0
            box(f['id'] + '_gap', fx - 0.3, y - 0.2, fx + 0.3, y + 0.2, 0.02, 2.38, M['walnut'], col='FURN')


def bed(f, double):
    x0, y0, x1, y1 = f['rect_cm']
    c, sx, sy = centre(f)
    head_side = {'-x': '+x'}.get(f['front'], '+x')  # headboard sits at +x (east walls) for every bed on this sheet
    hx = W(x1, 0).x
    # frame + mattress + duvet
    # his pictures: the double bed = boucle base + a tall boucle wingback headboard; the singles = a white box base; beige duvets, white sheets
    box(f['id'] + '_frame', x0, y0, x1 - 8, y1, 0.04, 0.30, M['boucle'] if double else M['white_lacq'], col='FURN', bevel=0.02 if double else 0.006)
    box(f['id'] + '_mattress', x0 + 1, y0 + 1, x1 - 9, y1 - 1, 0.30, 0.50, M['sheet'], col='FURN', bevel=0.04)
    box(f['id'] + '_duvet', x0 - 1.5, y0 - 1.5, x1 - 48, y1 + 1.5, 0.48, 0.56, M['linen_beige'], col='FURN', bevel=0.05)
    box(f['id'] + '_fold', x1 - 60, y0 - 1, x1 - 40, y1 + 1, 0.50, 0.565, M['sheet'], col='FURN', bevel=0.03)
    if double:
        box(f['id'] + '_head', x1 - 9, y0 - 6, x1, y1 + 6, 0.04, 1.25, M['boucle'], col='FURN', bevel=0.04)
        for s_ in (y0 - 6, y1 - 3):   # the wings
            box(f['id'] + '_wing', x1 - 18, s_, x1, s_ + 9, 0.30, 1.25, M['boucle'], col='FURN', bevel=0.035)
    npil = 2 if double else 1
    for k in range(npil):
        yy0 = y0 + (y1 - y0) * k / npil + 4
        yy1 = y0 + (y1 - y0) * (k + 1) / npil - 4
        box(f['id'] + '_pillow', x1 - 42, yy0, x1 - 10, yy1, 0.50, 0.65, M['sheet'], col='FURN', bevel=0.05)


for fid in ('m-wardrobe', 's-wardrobe', 'r-wardrobe'):
    wardrobe(FX[fid])
if not base_glb('base_bed', 'm-bed', FX['m-bed']['rect_cm'], FX['m-bed']['front']):
    bed(FX['m-bed'], True)
for fid in ('s-bed-1', 's-bed-2', 'r-bed-1', 'r-bed-2'):
    if not base_glb('base_single_bed', fid, FX[fid]['rect_cm'], FX[fid]['front']):
        bed(FX[fid], False)
for fid in ('m-night-1', 'm-night-2'):
    c, sx, sy = centre(FX[fid])
    if base_glb('base_night', fid, FX[fid]['rect_cm'], '-x'):
        continue   # his nightstand with its lamp, generated
    wbox(fid, c.x, c.y, sx * 0.95, sy * 0.95, 0.0, 0.55, M['oak_light'], bevel=0.004)   # oak nightstand + ceramic lamp (his picture)
    wbox(fid + '_drawer', c.x - sx * 0.48, c.y, 0.004, sy * 0.85, 0.40, 0.41, M['oak'], bevel=0.0)
    cyl(fid + '_lampbase', c.x, c.y, 0.07, 0.55, 0.80, M['ceramic'], verts=32, bevel=0.02)
    cyl(fid + '_lamp', c.x, c.y, 0.13, 0.80, 1.00, M['shade'], verts=40, bevel=0.0)

# bathrooms --------------------------------------------------------
def wall_hung_toilet(f):
    c, sx, sy = centre(f)
    d = FRONT_YAW[f['front']]
    v = Vector((math.cos(math.radians(d)), math.sin(math.radians(d)), 0))
    back = c - v * (sy if f['front'] in ('+y', '-y') else sx) / 2
    # concealed cistern box (spec: "ניאגרות סמויות") as a tiled ledge against the wall
    wbox(f['id'] + '_cistern', back.x + v.x * 0.10, back.y + v.y * 0.10, 0.20 if abs(v.x) > 0.5 else 0.60, 0.60 if abs(v.x) > 0.5 else 0.20, 0.0, 1.10, M['bathwall'], bevel=0.003)
    bowl_c = back + v * 0.45
    x0_, y0_, x1_, y1_ = f['rect_cm']
    if base_glb('base_toilet', f['id'] + '_gen', [x0_, y0_, x1_, y1_], f['front'], centre=W((x0_ + x1_) / 2, (y0_ + y1_) / 2) + v * 0.08, z0=0.10):
        pl = back + v * 0.205
        wbox(f['id'] + '_flush', pl.x, pl.y, 0.18 if abs(v.y) > 0.5 else 0.01, 0.01 if abs(v.y) > 0.5 else 0.18, 0.95, 1.05, M['handle'], bevel=0.002)
        return
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.5, location=(bowl_c.x, bowl_c.y, 0.33))
    b = bpy.context.active_object; b.name = f['id'] + '_bowl'
    b.scale = (0.36 / 1.0 if abs(v.y) > 0.5 else 0.54, 0.54 if abs(v.y) > 0.5 else 0.36, 0.24)
    b.data.materials.append(M['porcelain']); bpy.ops.object.shade_smooth()
    for cc in b.users_collection:
        cc.objects.unlink(b)
    link(b, 'FURN')
    wbox(f['id'] + '_seat', bowl_c.x, bowl_c.y, 0.37 if abs(v.y) > 0.5 else 0.50, 0.50 if abs(v.y) > 0.5 else 0.37, 0.40, 0.43, M['porcelain'], bevel=0.02)
    pl = back + v * 0.205
    wbox(f['id'] + '_flush', pl.x, pl.y, 0.18 if abs(v.y) > 0.5 else 0.01, 0.01 if abs(v.y) > 0.5 else 0.18, 0.95, 1.05, M['handle'], bevel=0.002)


def vanity(f):
    x0, y0, x1, y1 = f['rect_cm']
    if base_glb('base_vanity', f['id'] + '_gen', f['rect_cm'], f['front'], z0=0.32):   # wall-hung: its top at about 0.87 m
        c, sx, sy = centre(f); d = FRONT_YAW[f['front']]; v = Vector((math.cos(math.radians(d)), math.sin(math.radians(d)), 0))
        back = c - v * ((sx if abs(v.x) > 0.5 else sy) / 2)
        wbox(f['id'] + '_mirror', back.x + v.x * 0.012, back.y + v.y * 0.012, 0.012 if abs(v.x) > 0.5 else sx * 0.95, sy * 0.95 if abs(v.x) > 0.5 else 0.012, 1.05, 1.85, M['mirror'], bevel=0.0)
        return
    fx_box(f, 0.45, 0.85, M['oak_light'], bevel=0.003)
    fx_box(f, 0.85, 0.87, M['porcelain'], bevel=0.003, name=f['id'] + '_top')
    c, sx, sy = centre(f)
    wbox(f['id'] + '_basin', c.x, c.y, sx * 0.6, sy * 0.55, 0.869, 0.872, M['porcelain'], bevel=0.02)
    # mirror on the wall behind
    d = FRONT_YAW[f['front']]
    v = Vector((math.cos(math.radians(d)), math.sin(math.radians(d)), 0))
    back = c - v * ((sx if abs(v.x) > 0.5 else sy) / 2)
    wbox(f['id'] + '_mirror', back.x + v.x * 0.012, back.y + v.y * 0.012, 0.012 if abs(v.x) > 0.5 else sx * 0.95, sy * 0.95 if abs(v.x) > 0.5 else 0.012, 1.05, 1.85, M['mirror'], bevel=0.0)
    tap = back + v * 0.06
    cyl(f['id'] + '_tap', tap.x, tap.y, 0.014, 0.87, 1.10, M['handle'], verts=20)
    wbox(f['id'] + '_spout', tap.x + v.x * 0.07, tap.y + v.y * 0.07, 0.14 if abs(v.x) > 0.5 else 0.02, 0.02 if abs(v.x) > 0.5 else 0.14, 1.06, 1.08, M['handle'])


wall_hung_toilet(FX['e-toilet']); wall_hung_toilet(FX['b-toilet'])
vanity(FX['e-vanity']); vanity(FX['b-vanity'])
f = FX['e-shower']; x0, y0, x1, y1 = f['rect_cm']
box('e-shower-tray', x0, y0, x1, y1, 0.0, 0.03, M['porcelain'], col='FURN', bevel=0.004)
box('e-shower-glass', x1 - 1, y0 + 25, x1, y1, 0.03, 2.00, M['glass'], col='FURN')
box('e-shower-bar', x1 - 1.4, y0 + 25, x1 + 0.4, y1, 1.99, 2.01, M['handle'], col='FURN')
box('e-shower-post', x1 - 1.4, y0 + 24, x1 + 0.4, y0 + 26, 0.03, 2.01, M['handle'], col='FURN')   # the brass frame (his picture)
cs = W(x0 + 10, (y0 + y1) / 2)
cyl('e-shower-head', cs.x + 0.20, cs.y, 0.12, 2.10, 2.115, M['handle'], verts=32)
wbox('e-shower-arm', cs.x + 0.07, cs.y, 0.30, 0.02, 2.12, 2.14, M['handle'])
f = FX['b-tub']; x0, y0, x1, y1 = f['rect_cm']
tub_gen = base_glb('base_tub', 'b-tub-gen', f['rect_cm'], f['front'])
box('b-tub-apron', x0, y0, x1, y1, 0.0, 0.55, M['porcelain'], col='FURN', bevel=0.01)
box('b-tub-skirt', x0 - 0.3, y1 - 0.2, x1 + 0.3, y1 + 0.6, 0.0, 0.54, M['bathwall'], col='FURN')   # the travertine bath front (his picture)
inner = box('b-tub-inner', x0 + 7, y0 + 6, x1 - 7, y1 - 6, 0.12, 0.60, M['porcelain'], col='FURN')
apr = bpy.data.objects['b-tub-apron']
mod = apr.modifiers.new('cut', 'BOOLEAN'); mod.object = inner; mod.operation = 'DIFFERENCE'
bpy.context.view_layer.objects.active = apr
bpy.ops.object.modifier_apply(modifier='cut')   # apply now: the bake prep deletes hidden objects, so a live cutter left a flat tub (2026-11-17)
bpy.data.objects.remove(inner, do_unlink=True)
if tub_gen:   # his tub (generated) replaces the procedural one
    for nm in ('b-tub-apron', 'b-tub-skirt'):
        if nm in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[nm], do_unlink=True)
f = FX['b-washer']; x0, y0, x1, y1 = f['rect_cm']
box('b-washer', x0 + 2, y0, x1 - 2, y1, 0.0, 0.85, M['white_lacq'], col='FURN', bevel=0.012)
cw = W((x0 + x1) / 2, y1 + 0.1)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.16, depth=0.02, location=(cw.x, cw.y, 0.48), rotation=(math.pi / 2, 0, 0))
dr = bpy.context.active_object; dr.name = 'b-washer-door'; dr.data.materials.append(M['black_glass'])
for cc in dr.users_collection:
    cc.objects.unlink(dr)
link(dr, 'FURN')
# bathroom wall tiles: a 2 mm skin of tile on every wall face inside the two bathrooms, to 2.40 (ASSUMED height)
for rid in ('bath', 'ensuite'):
    r = next(rr for rr in plan['rooms'] if rr['id'] == rid)
    for q in r['rects_cm']:
        x0, y0, x1, y1 = q
        t = 0.25
        for (a, b, c_, d) in ((x0, y0, x1, y0 + t), (x0, y1 - t, x1, y1), (x0, y0, x0 + t, y1), (x1 - t, y0, x1, y1)):
            box('tile_' + rid, a, b, c_, d, 0.0, 2.40, M['bathwall'], col='ARCH')

# balcony ----------------------------------------------------------
f = FX['o-table']; c, sx, sy = centre(f)
bal_gen = base_glb('base_bal_table', 'o-table', FX['o-table']['rect_cm'], '-y')
cyl('o-table-top', c.x, c.y, 0.33, 0.70, 0.74, M['trav'], verts=64, bevel=0.005)
cyl('o-table-stem', c.x, c.y, 0.025, 0.04, 0.70, M['black_metal'], verts=16, bevel=0.0)
cyl('o-table-foot', c.x, c.y, 0.22, 0.0, 0.04, M['black_metal'], verts=40, bevel=0.003)
if bal_gen:
    for nm in ('o-table-top', 'o-table-stem', 'o-table-foot'):
        if nm in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[nm], do_unlink=True)
for fid in ('o-chair-1', 'o-chair-2'):   # teak frame + cream cushions, facing the table
    cc_, _, _ = centre(FX[fid]); d_ = (c - cc_); d_.z = 0; d_.normalize(); yaw_ = math.degrees(math.atan2(d_.y, d_.x)) - 90
    fr_ = ('+x' if d_.x > 0 else '-x') if abs(d_.x) > abs(d_.y) else ('-y' if d_.y > 0 else '+y')   # world +y = plan -y
    if base_glb('base_bal_chair', fid, FX[fid]['rect_cm'], fr_):
        continue
    ch = bpy.data.objects.new(fid, None); link(ch, 'FURN'); ch.location = (cc_.x, cc_.y, 0); ch.rotation_euler = (0, 0, math.radians(yaw_))
    parts_ = [wbox(fid + '_seat', 0, 0, 0.50, 0.48, 0.38, 0.46, M['cream_fabric'], bevel=0.03), wbox(fid + '_back', 0, -0.22, 0.50, 0.05, 0.46, 0.80, M['teak'], bevel=0.01)]
    for sx_ in (-1, 1):
        parts_.append(wbox(fid + '_arm', sx_ * 0.27, 0.0, 0.04, 0.50, 0.55, 0.59, M['teak'], bevel=0.008))
        for sy_ in (-1, 1):
            parts_.append(wbox(fid + '_leg', sx_ * 0.25, sy_ * 0.22, 0.04, 0.04, 0.0, 0.57 if sy_ > 0 else 0.80, M['teak'], bevel=0.004))
    for q_ in parts_: q_.parent = ch
f = FX['o-plants']; c, sx, sy = centre(f)
pl_gen = []
for k_, (item_, dx_) in enumerate((('base_planter_agave', -0.40), ('base_planter_yucca', 0.35))):
    cw_ = c + Vector((dx_, 0, 0)); cx_cm, cy_cm = cw_.x * 100, -cw_.y * 100
    pl_gen.append(base_glb(item_, 'o-planter-gen-%d' % k_, [cx_cm - 26, cy_cm - 26, cx_cm + 26, cy_cm + 26], '-y', centre=cw_))
for k_, (dx_, h_, r_) in enumerate(((-0.40, 0.62, 0.21), (0.35, 0.78, 0.19))):   # two tall stone planters with agaves
    if pl_gen[k_]:
        continue
    cyl('o-planter-%d' % k_, c.x + dx_, c.y, r_, 0.0, h_, M['stone_planter'], verts=40, bevel=0.01)
    append_blend(os.path.join(CAT, 'polyhaven-potted_plant_02', 'potted_plant_02_2k.blend'), 'o-plant-%d' % k_, c + Vector((dx_, 0, 0)), (0.75, 0.75))
    bpy.data.objects['o-plant-%d' % k_].location.z += h_ - 0.12
    for q_ in [q for q in bpy.data.objects['o-plant-%d' % k_].children_recursive if 'pot' in q.name.lower() and 'plant' in q.name.lower() and 'leaves' not in q.name.lower()]:
        if q_.type == 'MESH' and any('pot' in (sl.material.name.lower() if sl.material else '') for sl in q_.material_slots): bpy.data.objects.remove(q_, do_unlink=True)   # the planter is the pot
# hide the plan's own chairs (the set brings its own chairs)

# sheer curtains at the living-room windows and the master window (decor, add-only)
M['sheer'] = principled('sheer_curtain', (0.93, 0.92, 0.89), 0.8, spec=0.2)
M['sheer'].node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = 0.0
M['sheer'].node_tree.nodes['Principled BSDF'].inputs['Subsurface Weight'].default_value = 0.0
# (curtains removed 2026-11-17: in the render they read as wall piers - an invented-geometry risk)

# ------------------------------------------------------------------ lights
world = bpy.data.worlds.new('World'); scene.world = world
world.use_nodes = True
nt = world.node_tree
bg = nt.nodes['Background']
env = nt.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(HDRI)
mp = nt.nodes.new('ShaderNodeMapping'); tc = nt.nodes.new('ShaderNodeTexCoord')
mp.inputs['Rotation'].default_value = (0, 0, math.radians(38.9))
nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
nt.links.new(env.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 1.0
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 4.5; sun.angle = math.radians(0.6)
sun_o = bpy.data.objects.new('sun', sun); link(sun_o, 'LIGHT')
sun_o.rotation_euler = (math.radians(90 - 50), 0, math.radians(200))
# one ceiling light per indoor room (warm, soft) + recessed downlights in the corridor and kitchen
for r in plan['rooms']:
    if r['outdoor']:
        continue
    q = max(r['rects_cm'], key=lambda q: (q[2] - q[0]) * (q[3] - q[1]))
    cc = W((q[0] + q[2]) / 2, (q[1] + q[3]) / 2, H - 0.045)  # BELOW the fixture disc (inside it the light was blocked - 2026-11-17)
    a = (q[2] - q[0]) * (q[3] - q[1]) / 1e4
    L = bpy.data.lights.new('light_' + r['id'], 'AREA'); L.shape = 'DISK'; L.size = 0.35
    L.energy = 25 + 6 * a; L.color = (1.0, 0.93, 0.84)
    lo = bpy.data.objects.new('light_' + r['id'], L); lo.location = cc; link(lo, 'LIGHT')
    nx_, ny_ = max(1, round((q[2] - q[0]) / 170)), max(1, round((q[3] - q[1]) / 170))
    for ix in range(nx_):
        for iy in range(ny_):
            sp = W(q[0] + (q[2] - q[0]) * (ix + 0.5) / nx_, q[1] + (q[3] - q[1]) * (iy + 0.5) / ny_, H)
            cyl('fixture_' + r['id'], sp.x, sp.y, 0.045, H - 0.004, H - 0.001, M['lamp'], col='LIGHT', verts=24, bevel=0.0)
# pendant over the dining table
c, sx, sy = centre(FX['l-dining'])
# (no pendant: his dining picture has recessed spots only)

# ------------------------------------------------------------------ cameras (one per viewpoint, equirect) + stills
for cp in plan['cameras']:
    cd = bpy.data.cameras.new('pano_' + cp['id'])
    cd.type = 'PANO'
    cd.panorama_type = 'EQUIRECTANGULAR'
    co = bpy.data.objects.new('pano_' + cp['id'], cd)
    co.location = W(cp['x'], cp['y'], cp['z'] / 100.0)
    co.rotation_euler = (math.radians(90), 0, 0)  # centre of the panorama = plan up (+Y world)
    link(co, 'CAM')
for st in plan.get('stills', []):
    cd = bpy.data.cameras.new('still_' + st['id'])
    cd.lens = st['lens_mm']; cd.sensor_width = 36
    co = bpy.data.objects.new('still_' + st['id'], cd)
    p0 = W(st['x'], st['y'], st['z'] / 100.0)
    p1 = W(st['look'][0], st['look'][1], st['z'] / 100.0 - 0.15)
    co.location = p0
    co.rotation_euler = (p1 - p0).to_track_quat('-Z', 'Y').to_euler()
    link(co, 'CAM')

# ------------------------------------------------------------------ render defaults (CPU machine)
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 64
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.cycles.max_bounces = 8
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 4
scene.cycles.transmission_bounces = 8
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.cycles.blur_glossy = 1.0
scene.cycles.seed = 0
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.0   # 2026-11-17: his pictures are warmer and less washed out
scene.render.film_transparent = False

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
n = {k: len(v.all_objects) for k, v in COLS.items()}
print('SAVED', OUT, n)

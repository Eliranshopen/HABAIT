"""walk3d_bake.py  (copied 2026-11-17 from .wt/blender-walk, Rainbow walk3d; only the NICHE list changed)
 — the 3D WALK's scene: the look-pass apartment with its daylight BAKED into texture atlases, exported for the browser
(2026-11-12, Eliran: «אני רוצה תחושה אמיתית של הליכה בדירה לפי החיצים שאני אזיז» → path 1, the plan-exact model, $0).

Three stages, each one bounded Blender run (CPU Cycles; root §12):
  blender -b <look.blend> --factory-startup -P walk3d_bake.py -- --stage prep   --dir <work> [--groups 6] [--size 4096]
  blender -b <work>/prep.blend --factory-startup -P walk3d_bake.py -- --stage bake --dir <work> --group K [--samples 128]
  blender -b <work>/prep.blend --factory-startup -P walk3d_bake.py -- --stage export --dir <work>

prep: the laundry niche EMPTY with no door (Eliran 2026-11-12: the closet box `CLOSET_l-laundry_*` and the fixture prism under it go),
      every hidden object (skirting boards, swapped pieces) deleted, glass and plants set apart (they are not baked), every other mesh
      given a `bake` UV map, packed per group so a group shares ONE atlas; an image node per group in every material.
bake: Cycles DIFFUSE (direct + indirect + colour) of group K into `<work>/bake_K.exr`; glass hidden so the daylight comes in.
export: each atlas denoised (compositor, OIDN) and saved through the scene's view transform (AgX, the look's exposure) as display
      colour JPEG at full size and at 2048; the baked meshes get one unlit-ready material per group on the `bake` UV only; plants keep
      their own materials; glass gets a light tint; one glTF (`walk3d.gltf` + bin + jpgs) for three.js (+Y up).
Geometry is never edited except the two removals the ruling names (sales-plan fidelity). $0, deterministic for the same inputs.
"""
import bpy, bmesh, sys, os, json, math, argparse
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument('--stage', required=True, choices=('prep', 'bake', 'geom', 'export', 'export-light')); ap.add_argument('--dir', required=True)
ap.add_argument('--groups', type=int, default=6); ap.add_argument('--size', type=int, default=4096)
ap.add_argument('--group', type=int, default=-1); ap.add_argument('--samples', type=int, default=128)
ap.add_argument('--exposure', type=float, default=None, help='export: the display exposure (default: the look pass exposure)'); ap.add_argument('--look', default=None, help='export: an AgX look (default: the scene look)'); ap.add_argument('--view', default=None, help='export: a view transform (Standard keeps colour where AgX washes out a bright bake)')
ap.add_argument('--design', default=None, help='prep: tools/walk/design.json - the pieces a visitor can change (a part id per face)')
ap.add_argument('--pass', dest='bpass', default='full', choices=('full', 'light', 'albedo'), help='bake: full = light x colour (the old atlas); light = irradiance only; albedo = colour only')
ap.add_argument('--bake-size', type=int, default=0, help='bake: rescale the group atlas first (the day/night keys bake at 1024)')
ap.add_argument('--ev', type=float, default=-1.0, help='export-light: the EV the light atlas is saved at')
ap.add_argument('--atlas-from', default=None, help='export: take <dir>/bake_K.jpg as the atlases (the tour-picture projection, walk3d-project.py) instead of denoising the light bake')
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])
W = os.path.abspath(a.dir); os.makedirs(W, exist_ok=True)
log = lambda *x: print('[walk3d]', *x, flush=True)
GLASS = lambda o: o.name.startswith('GLASS') or any(s.material and 'glass' in s.material.name.lower() and 'mirror' not in s.material.name.lower() for s in o.material_slots)
PLANT = lambda o: o.name.startswith('potted')
# the laundry niche (plan cm, raster frame) -> world metres (x/100, -y/100)
NICHE = []   # Avnei Hefetz apt 7: nothing to remove (the Rainbow laundry-niche cut does not apply here)

def inside(pt, poly, pad=0.06):
    cx = sum(p[0] for p in poly) / len(poly); cy = sum(p[1] for p in poly) / len(poly)
    poly = [(cx + (x - cx) * (1 + pad / max(0.01, math.hypot(x - cx, y - cy))), cy + (y - cy) * (1 + pad / max(0.01, math.hypot(x - cx, y - cy)))) for x, y in poly]
    c = False; j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > pt[1]) != (yj > pt[1]) and pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi + 1e-12) + xi: c = not c
        j = i
    return c

def cycles(samples):
    s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = samples
    s.cycles.use_denoising = False; s.render.use_persistent_data = True
    s.cycles.max_bounces = 6; s.cycles.diffuse_bounces = 4; s.cycles.glossy_bounces = 2; s.cycles.transmission_bounces = 4
    s.cycles.sample_clamp_indirect = 8.0

def live_light(W, kind):
    # the light a live piece stands in: the mean baked light of the faces within 1.1 m of its box centre and below 2 m (the room around it)
    import numpy as np
    roots = {}
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.get('walk3d') == 'live':
            r = roots.setdefault(o['walk3d_live'], [])
            r += [o.matrix_world @ Vector(c) for c in o.bound_box]
    cfg = json.load(open(os.path.join(W, 'prep.json'))); out = {}
    imgs = {}
    for k in range(cfg['groups']):
        im = bpy.data.images.load(os.path.join(W, '%s_%d.exr' % (kind, k)), check_existing=False); w_, h_ = im.size
        px = np.empty(w_ * h_ * 4, dtype=np.float32); im.pixels.foreach_get(px); imgs[k] = (px.reshape(h_, w_, 4), w_, h_)
    for name, pts in roots.items():
        c = Vector((sum(p.x for p in pts) / len(pts), sum(p.y for p in pts) / len(pts), 0)); acc = [0, 0, 0, 0]
        for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d_group') is not None]:
            px, w_, h_ = imgs[o['walk3d_group']]; me = o.data; bu = me.uv_layers['bake'].data; mw = o.matrix_world
            for poly in me.polygons:
                ctr = mw @ poly.center
                if ctr.z > 2.0 or (Vector((ctr.x, ctr.y, 0)) - c).length > 1.1: continue
                li = poly.loop_indices; u = sum(bu[j].uv.x for j in li) / len(li); v = sum(bu[j].uv.y for j in li) / len(li)
                y_, x_ = min(h_ - 1, int(v * h_)), min(w_ - 1, int(u * w_)); ar = poly.area
                acc[0] += px[y_, x_, 0] * ar; acc[1] += px[y_, x_, 1] * ar; acc[2] += px[y_, x_, 2] * ar; acc[3] += ar
        out[name] = [round(acc[i] / acc[3], 4) for i in range(3)] if acc[3] > 0 else [0.6, 0.58, 0.55]
    return out


if a.stage == 'prep':
    gone = 0
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and (o.hide_render or o.name.startswith('CLOSET_l-laundry')):
            bpy.data.objects.remove(o, do_unlink=True); gone += 1
    log('deleted hidden + laundry closet objects:', gone)
    world_niche = [(x / 100, -y / 100) for x, y in NICHE]
    for o in ([o for o in bpy.data.objects if o.name.startswith('FIXTURE_')] if NICHE else []):
        bm = bmesh.new(); bm.from_mesh(o.data); mw = o.matrix_world
        kill = [f for f in bm.faces if inside(((mw @ f.calc_center_median()).x, (mw @ f.calc_center_median()).y), world_niche)]
        if kill:
            bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(o.data); log('niche faces removed from', o.name, len(kill))
        bm.free()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    def area(o):
        sc = o.matrix_world.to_scale(); k = abs(sc.x * sc.y * sc.z) ** (2 / 3)
        return sum(p.area for p in o.data.polygons) * k
    ENV = lambda o: area(o) > 1500   # the ground far below the 16th floor: not baked, lit in the browser
    def live_root(o):
        q = o
        while q is not None:
            if q.get('base_glb'): return q
            q = q.parent
        return None
    for o in meshes:
        lr = live_root(o)
        o['walk3d'] = 'glass' if GLASS(o) else 'plant' if PLANT(o) else 'env' if ENV(o) else 'live' if lr else 'bake'
        if lr: o['walk3d_live'] = lr.name
        if o['walk3d'] == 'env': log('environment (not baked):', o.name, round(area(o)))
    bake = [o for o in meshes if o['walk3d'] == 'bake']
    # single-user data, so a UV map on one object never lands on another; an object with no material gets a plain grey one
    grey = bpy.data.materials.new('M_walk3d_grey'); grey.use_nodes = True
    for o in bake:
        if o.data.users > 1: o.data = o.data.copy()
        if not o.material_slots or not any(s.material for s in o.material_slots): o.data.materials.clear(); o.data.materials.append(grey)
    # a DIFFUSE bake of a metal is black (a metal has no diffuse colour: the fridge came out a black slab, 2026-11-12): every baked
    # material is made non-metallic, keeping its colour; the reflections a metal would show are not in a diffuse bake anyway
    nm = 0
    for m in {s.material for o in bake for s in o.material_slots if s.material and s.material.use_nodes}:
        for n in m.node_tree.nodes:
            if n.bl_idname == 'ShaderNodeBsdfPrincipled':
                for l in list(n.inputs['Metallic'].links): m.node_tree.links.remove(l)
                if n.inputs['Metallic'].default_value > 0: nm += 1
                n.inputs['Metallic'].default_value = 0.0
    log('materials made non-metallic for the bake:', nm)
    # 2026-11-17 the design layer: every face carries its PART (piece x material) in a 'part' UV map (u = id + 0.5), so the page can
    # repaint or hide one piece or one material of it over the baked light; the table and every piece's box go to parts.json
    import re
    rules = [(p['id'], re.compile(p['match'])) for p in json.load(open(a.design, encoding='utf-8'))['pieces']] if a.design else []
    def piece_of(o):
        chain = []; q = o
        while q is not None: chain.append(q.name); q = q.parent
        for pid, rx in rules:
            if any(rx.search(n) for n in chain): return pid
        return 'static'
    parts, boxes, pidx = [], {}, {}
    def part_id(piece, mat):
        key = (piece, mat)
        if key not in pidx: pidx[key] = len(parts); parts.append(dict(id=len(parts), piece=piece, mat=mat))
        return pidx[key]
    part_id('static', '')
    for o in bake:
        pc = piece_of(o); o['walk3d_piece'] = pc
        pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
        b = boxes.setdefault(pc, [1e9, 1e9, 1e9, -1e9, -1e9, -1e9])
        for v in pts: b[:] = [min(b[0], v.x), min(b[1], v.y), min(b[2], v.z), max(b[3], v.x), max(b[4], v.y), max(b[5], v.z)]
    # surface area per object -> greedy groups of similar area (one atlas each)
    ar = sorted(((area(o), o) for o in bake), key=lambda t: -t[0])
    G = [[0.0, []] for _ in range(a.groups)]
    for s_, o in ar:
        g = min(G, key=lambda t: t[0]); g[0] += s_; g[1].append(o)
    log('groups (m2, objects):', [(round(g[0], 1), len(g[1])) for g in G])
    for k, (s_, objs) in enumerate(G):
        # ONE object per group (Cycles re-syncs the scene for every baked object: 67 objects = minutes even at 512 px). Before the join
        # each mesh's render UV map is named 'UVMap', so the join keeps every textured piece on its own texture coordinates.
        for o in objs:
            if not o.data.uv_layers: o.data.uv_layers.new(name='UVMap')
            ren = next((u for u in o.data.uv_layers if u.active_render), o.data.uv_layers[0])
            for u in o.data.uv_layers:
                if u != ren and u.name == 'UVMap': u.name = 'UVMap_other'
            ren.name = 'UVMap'
            for u in [u for u in o.data.uv_layers if u.name != 'UVMap']: o.data.uv_layers.remove(u)
            pu = o.data.uv_layers.new(name='part'); pc = o.get('walk3d_piece', 'static')
            for poly in o.data.polygons:
                sl = o.material_slots[poly.material_index] if poly.material_index < len(o.material_slots) else None
                pid = part_id(pc, sl.material.name if sl and sl.material else '')
                for li in poly.loop_indices: pu.data[li].uv = (pid + 0.5, 0.5)
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.hide_viewport = False; o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.convert(target='MESH')   # modifiers applied
        bpy.ops.object.join(); j = bpy.context.view_layer.objects.active; j.name = 'WALK3D_group_%d' % k; j.parent = None
        j['walk3d'] = 'bake'; j['walk3d_group'] = k; objs = [j]
        j.data.uv_layers.new(name='bake'); j.data.uv_layers['UVMap'].active_render = True; j.data.uv_layers.active = j.data.uv_layers['bake']
        assert 'part' in j.data.uv_layers or not rules, 'the part map did not survive the join'
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        # island_margin 0 + scale_to_bounds: measured 2026-11-12 on group 0 (9,669 faces): margin 0 -> 59 % of the atlas used,
        # 0.0005 -> 26 %, 0.001 -> 15 %, 0.002 -> 9 % (every island pays the margin); pack_islands is a no-op in a background run.
        bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=True)
        bpy.ops.object.mode_set(mode='OBJECT')
        img = bpy.data.images.new('bake_%d' % k, a.size, a.size, float_buffer=True, alpha=False)
        mats = {s.material for o in objs for s in o.material_slots if s.material}
        for m in mats:
            m.use_nodes = True
            n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.name = 'WALK3D_BAKE_%d' % k; n.image = img; n.label = n.name
        log('group', k, 'objects', len(objs), 'materials', len(mats))
    json.dump({'groups': a.groups, 'size': a.size}, open(os.path.join(W, 'prep.json'), 'w'))
    json.dump({'parts': parts, 'boxes': boxes}, open(os.path.join(W, 'parts.json'), 'w', encoding='utf-8'), indent=1)
    log('parts', len(parts), 'pieces', len(boxes))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(W, 'prep.blend')); log('saved prep.blend'); print('WALK3D_PREP_OK')

elif a.stage == 'bake':
    k = a.group; cycles(1 if a.bpass == 'albedo' else a.samples)
    for o in bpy.data.objects:
        if o.get('walk3d') == 'glass': o.hide_render = True   # the daylight comes in through the openings
    objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d_group') == k]
    for m in bpy.data.materials:
        if m.node_tree and ('WALK3D_BAKE_%d' % k) in m.node_tree.nodes: m.node_tree.nodes.active = m.node_tree.nodes['WALK3D_BAKE_%d' % k]
    for o in objs: o.data.uv_layers.active = o.data.uv_layers['bake']
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    b = bpy.context.scene.render.bake; b.margin = 8; b.use_clear = True; b.target = 'IMAGE_TEXTURES'
    flt = {'full': {'DIRECT', 'INDIRECT', 'COLOR'}, 'light': {'DIRECT', 'INDIRECT'}, 'albedo': {'COLOR'}}[a.bpass]
    if a.bake_size:
        bpy.data.images['bake_%d' % k].scale(a.bake_size, a.bake_size)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter=flt, margin=8, use_clear=True)
    img = bpy.data.images['bake_%d' % k]
    img.filepath_raw = os.path.join(W, ('bake_%d.exr' if a.bpass == 'full' else 'light_%d.exr' if a.bpass == 'light' else 'albedo_%d.exr') % k)
    img.file_format = 'OPEN_EXR'; img.save()
    log('baked group', k, len(objs), 'objects ->', img.filepath_raw); print('WALK3D_BAKE_OK')

elif a.stage == 'geom':
    # 2026-11-12 (Eliran: the walk in the TOUR'S OWN look): per atlas texel its world position and normal, for walk3d-project.py to
    # colour from the tour pictures. Position / normal bakes need one sample; dumped as float32 .npy (rows bottom-up, Blender order).
    import numpy as np
    k = a.group; cycles(1)
    objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d_group') == k]
    for o in objs: o.data.uv_layers.active = o.data.uv_layers['bake']
    img = bpy.data.images['bake_%d' % k]
    for m in bpy.data.materials:
        if m.node_tree and ('WALK3D_BAKE_%d' % k) in m.node_tree.nodes: m.node_tree.nodes.active = m.node_tree.nodes['WALK3D_BAKE_%d' % k]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for kind in ('POSITION', 'NORMAL'):
        b = bpy.context.scene.render.bake; b.margin = 4; b.use_clear = True; b.target = 'IMAGE_TEXTURES'
        if kind == 'NORMAL': b.normal_space = 'OBJECT'   # joined groups carry an identity transform: object space = world space
        img.pixels.foreach_set(np.zeros(img.size[0] * img.size[1] * 4, dtype=np.float32))
        bpy.ops.object.bake(type=kind, margin=4, use_clear=True)
        px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32); img.pixels.foreach_get(px)
        np.save(os.path.join(W, 'geom_%s_%d.npy' % (kind.lower(), k)), px.reshape(img.size[1], img.size[0], 4))
        log('geom', kind, 'group', k, 'saved')
    print('WALK3D_GEOM_OK')

elif a.stage == 'export-light':
    # a day/night key: only the light atlases (denoised, Standard view at --ev), same UVs as the walk's own export
    cfg = json.load(open(os.path.join(W, 'prep.json')))
    os.makedirs(os.path.join(W, 'gl'), exist_ok=True)
    dn = bpy.data.scenes.new('walk3d_denoise'); dn.use_nodes = True; nt = dn.node_tree
    dn.view_settings.view_transform = 'Standard'; dn.view_settings.look = 'None'; dn.view_settings.exposure = a.ev
    dn.render.image_settings.file_format = 'JPEG'; dn.render.image_settings.quality = 92
    acc = {}
    for k in range(cfg['groups']):
        src = bpy.data.images.load(os.path.join(W, 'light_%d.exr' % k), check_existing=False)
        for n in list(nt.nodes): nt.nodes.remove(n)
        i = nt.nodes.new('CompositorNodeImage'); i.image = src; d = nt.nodes.new('CompositorNodeDenoise'); d.prefilter = 'ACCURATE'; c = nt.nodes.new('CompositorNodeComposite')
        nt.links.new(i.outputs['Image'], d.inputs['Image']); nt.links.new(d.outputs['Image'], c.inputs['Image'])
        dn.render.resolution_x, dn.render.resolution_y = src.size; dn.render.resolution_percentage = 100
        dn.render.filepath = os.path.join(W, 'gl', 'light_%d.jpg' % k)
        bpy.ops.render.render(write_still=True, scene=dn.name)
        import numpy as np
        w_, h_ = src.size; px = np.empty(w_ * h_ * 4, dtype=np.float32); src.pixels.foreach_get(px); px = px.reshape(h_, w_, 4)
        for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d_group') == k]:
            me = o.data; bu, pu = me.uv_layers['bake'].data, me.uv_layers['part'].data
            for poly in me.polygons:
                li = poly.loop_indices; u = sum(bu[j].uv.x for j in li) / len(li); v = sum(bu[j].uv.y for j in li) / len(li)
                q = acc.setdefault(int(pu[li[0]].uv.x), [0, 0, 0, 0]); ar = poly.area; y_, x_ = min(h_ - 1, int(v * h_)), min(w_ - 1, int(u * w_))
                q[0] += px[y_, x_, 0] * ar; q[1] += px[y_, x_, 1] * ar; q[2] += px[y_, x_, 2] * ar; q[3] += ar
        log('key light', k, 'saved at EV', a.ev)
    pl = {str(pid): [round(q[c] / q[3], 4) for c in range(3)] for pid, q in acc.items() if q[3] > 0}
    pl['live'] = live_light(W, 'light')
    json.dump(pl, open(os.path.join(W, 'gl', 'parts_light.json'), 'w'))
    print('WALK3D_EXPORT_LIGHT_OK')

elif a.stage == 'export' and os.path.exists(os.path.join(W, 'light_0.exr')):
    # 2026-11-17 the design layer: TWO atlases per group - the light (irradiance, denoised) and the colour (albedo) - so the page draws
    # light x colour and can swap the colour of one part live. Light is saved through Standard at -1 EV (2x headroom, the page multiplies
    # back), colour at 0 EV. Every part's mean light and mean colour (linear) go into parts.json for the swapped-in pieces.
    import numpy as np
    cfg = json.load(open(os.path.join(W, 'prep.json'))); s = bpy.context.scene
    os.makedirs(os.path.join(W, 'gl'), exist_ok=True)
    dn = bpy.data.scenes.new('walk3d_denoise'); dn.use_nodes = True; nt = dn.node_tree
    dn.view_settings.view_transform = 'Standard'; dn.view_settings.look = 'None'; dn.view_settings.gamma = 1.0
    dn.render.image_settings.file_format = 'JPEG'; dn.render.image_settings.quality = 92
    acc = {}
    for k in range(cfg['groups']):
        for kind, ev, den in (('light', -1.0, True), ('albedo', 0.0, False)):
            src = bpy.data.images.load(os.path.join(W, '%s_%d.exr' % (kind, k)), check_existing=False)
            for n in list(nt.nodes): nt.nodes.remove(n)
            i = nt.nodes.new('CompositorNodeImage'); i.image = src; c = nt.nodes.new('CompositorNodeComposite')
            if den:
                d = nt.nodes.new('CompositorNodeDenoise'); d.prefilter = 'ACCURATE'
                nt.links.new(i.outputs['Image'], d.inputs['Image']); nt.links.new(d.outputs['Image'], c.inputs['Image'])
            else:
                nt.links.new(i.outputs['Image'], c.inputs['Image'])
            dn.view_settings.exposure = ev
            dn.render.resolution_x, dn.render.resolution_y = src.size; dn.render.resolution_percentage = 100
            dn.render.filepath = os.path.join(W, 'gl', '%s_%d.jpg' % (kind, k))
            bpy.ops.render.render(write_still=True, scene=dn.name)
            sm = bpy.data.images.load(dn.render.filepath, check_existing=False); sm.scale(1024, 1024)
            sm.filepath_raw = os.path.join(W, 'gl', '%s_%d_1k.jpg' % (kind, k)); sm.file_format = 'JPEG'; sm.save()
            # per-part means from the linear EXR (light is denoised only in the JPEG; the mean of a noisy bake is still the mean)
            w_, h_ = src.size; px = np.empty(w_ * h_ * 4, dtype=np.float32); src.pixels.foreach_get(px); px = px.reshape(h_, w_, 4)
            for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d_group') == k]:
                me = o.data; bu, pu = me.uv_layers['bake'].data, me.uv_layers['part'].data
                for poly in me.polygons:
                    li = poly.loop_indices; u = sum(bu[j].uv.x for j in li) / len(li); v = sum(bu[j].uv.y for j in li) / len(li)
                    pid = int(pu[li[0]].uv.x); x_ = min(w_ - 1, max(0, int(u * w_))); y_ = min(h_ - 1, max(0, int(v * h_)))
                    a_ = acc.setdefault(pid, {'light': [0, 0, 0, 0], 'albedo': [0, 0, 0, 0]})[kind]; ar = poly.area
                    a_[0] += px[y_, x_, 0] * ar; a_[1] += px[y_, x_, 1] * ar; a_[2] += px[y_, x_, 2] * ar; a_[3] += ar
            log(kind, k, 'saved')
    pj = json.load(open(os.path.join(W, 'parts.json'), encoding='utf-8'))
    for prt in pj['parts']:
        q = acc.get(prt['id'])
        for kind in ('light', 'albedo'):
            prt[kind] = [round(q[kind][c] / q[kind][3], 4) for c in range(3)] if q and q[kind][3] > 0 else None
        prt['area'] = round(q['albedo'][3], 3) if q else 0
    json.dump(pj, open(os.path.join(W, 'gl', 'parts.json'), 'w', encoding='utf-8'), indent=1)
    for k in range(cfg['groups']):
        m = bpy.data.materials.new('WALK3D_baked_%d' % k); m.use_nodes = True; nt2 = m.node_tree
        b = next(n for n in nt2.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
        t = nt2.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(W, 'gl', 'light_%d_1k.jpg' % k), check_existing=True)
        uvn = nt2.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'bake'; nt2.links.new(uvn.outputs['UV'], t.inputs['Vector'])
        nt2.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 1.0
        for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d_group') == k]:
            for uv in [u for u in o.data.uv_layers if u.name not in ('bake', 'part')]: o.data.uv_layers.remove(uv)
            o.data.uv_layers.active = o.data.uv_layers['bake']
            o.data.materials.clear(); o.data.materials.append(m)
    gm = bpy.data.materials.new('WALK3D_glass'); gm.use_nodes = True
    for o in bpy.data.objects:
        if o.get('walk3d') == 'glass': o.data.materials.clear(); o.data.materials.append(gm); o.hide_render = False
    json.dump(live_light(W, 'light'), open(os.path.join(W, 'gl', 'live.json'), 'w'), indent=1)
    keep = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d') in ('bake', 'glass', 'plant', 'live')]
    for o in bpy.data.objects: o.select_set(o in keep)
    out = os.path.join(W, 'gl', 'walk3d.gltf')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLTF_SEPARATE', use_selection=True, export_image_format='JPEG', export_jpeg_quality=88,
                              export_apply=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_extras=True)
    log('exported', out); print('WALK3D_EXPORT_OK')

else:  # export
    cfg = json.load(open(os.path.join(W, 'prep.json'))); s = bpy.context.scene
    # denoise each atlas in a compositor-only scene, then save through the look's view transform as display colour
    dn = bpy.data.scenes.new('walk3d_denoise'); dn.use_nodes = True; nt = dn.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    dn.view_settings.view_transform = s.view_settings.view_transform; dn.view_settings.look = s.view_settings.look
    dn.view_settings.exposure = s.view_settings.exposure if a.exposure is None else a.exposure; dn.view_settings.gamma = s.view_settings.gamma
    if a.view: dn.view_settings.view_transform = a.view
    if a.look: dn.view_settings.look = a.look
    log('display: view', dn.view_settings.view_transform, 'look', dn.view_settings.look, 'exposure', dn.view_settings.exposure)
    dn.render.image_settings.file_format = 'JPEG'; dn.render.image_settings.quality = 90
    for k in range(cfg['groups'] if not a.atlas_from else 0):
        src = bpy.data.images.load(os.path.join(W, 'bake_%d.exr' % k), check_existing=False)
        for n in list(nt.nodes): nt.nodes.remove(n)
        i = nt.nodes.new('CompositorNodeImage'); i.image = src
        d = nt.nodes.new('CompositorNodeDenoise'); d.prefilter = 'ACCURATE'
        c = nt.nodes.new('CompositorNodeComposite')
        nt.links.new(i.outputs['Image'], d.inputs['Image']); nt.links.new(d.outputs['Image'], c.inputs['Image'])
        dn.render.resolution_x, dn.render.resolution_y = src.size; dn.render.resolution_percentage = 100
        dn.render.filepath = os.path.join(W, 'gl', 'bake_%d.jpg' % k); os.makedirs(os.path.join(W, 'gl'), exist_ok=True)
        bpy.ops.render.render(write_still=True, scene=dn.name)
        small = bpy.data.images.load(dn.render.filepath, check_existing=False); small.scale(2048, 2048)
        small.filepath_raw = os.path.join(W, 'gl', 'bake_%d_2k.jpg' % k); small.file_format = 'JPEG'; small.save()
        log('atlas', k, 'denoised ->', dn.render.filepath)
    # the baked meshes: one material per group (base colour = the atlas on the bake UV), no other UV map
    for k in range(cfg['groups']):
        m = bpy.data.materials.new('WALK3D_baked_%d' % k); m.use_nodes = True; nt2 = m.node_tree
        b = next(n for n in nt2.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
        if a.atlas_from:
            os.makedirs(os.path.join(W, 'gl'), exist_ok=True); import shutil; shutil.copy(os.path.join(a.atlas_from, 'bake_%d.jpg' % k), os.path.join(W, 'gl', 'bake_%d.jpg' % k))
        t = nt2.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(W, 'gl', 'bake_%d.jpg' % k), check_existing=True)
        nt2.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 1.0
        for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d_group') == k]:
            for uv in [u for u in o.data.uv_layers if u.name != 'bake']: o.data.uv_layers.remove(uv)
            o.data.materials.clear(); o.data.materials.append(m)
    gm = bpy.data.materials.new('WALK3D_glass'); gm.use_nodes = True
    gb = next(n for n in gm.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'); gb.inputs['Base Color'].default_value = (0.85, 0.9, 0.92, 1); gb.inputs['Alpha'].default_value = 0.12
    for o in bpy.data.objects:
        if o.get('walk3d') == 'glass': o.data.materials.clear(); o.data.materials.append(gm); o.hide_render = False
    # the ground far below is left out: it would cover the city backdrop below the horizon (the backdrop carries the city)
    keep = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d') in ('bake', 'glass', 'plant')]
    for o in bpy.data.objects: o.select_set(o in keep)
    out = os.path.join(W, 'gl', 'walk3d.gltf')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLTF_SEPARATE', use_selection=True, export_image_format='JPEG', export_jpeg_quality=88,
                              export_apply=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_extras=True)
    log('exported', out); print('WALK3D_EXPORT_OK')

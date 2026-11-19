"""Apply ONE lighting keyframe to a scene and save it as a NEW .blend (the source file is never written).
Only light changes: the world, the sun lamp, interior lamp energy, emissive strength, exposure. Geometry, materials,
cameras and the render seed are untouched — so every keyframe is pixel-aligned by construction.

blender -b --factory-startup <source.blend> -P relight.py -- --presets lighting_presets.json --key night --out <variant.blend>
Prints RELIGHT_OK <json> on success; exits non-zero on failure.
"""
import bpy, json, math, sys, os, hashlib

argv = sys.argv[sys.argv.index('--') + 1:]
a = dict(zip(argv[0::2], argv[1::2]))
presets = json.load(open(a['--presets'], encoding='utf-8'))
key = next((k for k in presets['keyframes'] if k['name'] == a['--key']), None)
if key is None:
    print(f"RELIGHT_FAIL unknown key {a['--key']}", file=sys.stderr); sys.exit(2)
out = os.path.abspath(a['--out'])
src = bpy.data.filepath
bpy.ops.file.make_paths_absolute()  # the copy lives elsewhere; keep textures/HDRI resolvable

sc = bpy.context.scene
report = {"key": key['name'], "source": src, "changed": []}

# 1. world
w = sc.world; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
bg = nt.nodes.new('ShaderNodeBackground'); outn = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(bg.outputs[0], outn.inputs[0])
sk = key['sky']
if sk['type'] == 'nishita':
    sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_disc = False
    sky.sun_elevation = math.radians(sk['el']); sky.sun_rotation = math.radians(sk['az'])
    sky.dust_density = sk.get('dust', 1.0); sky.air_density = sk.get('air', 1.0)
    nt.links.new(sky.outputs[0], bg.inputs[0])
else:
    bg.inputs['Color'].default_value = (*sk['color'], 1.0)
bg.inputs['Strength'].default_value = sk['strength']
report["changed"].append(f"world={sk['type']}")

# 2. sun
suns = [o for o in sc.objects if o.type == 'LIGHT' and o.data.type == 'SUN']
if not suns and key['sun'] is not None:  # a scene lit only by its HDRI gets one sun (2026-11-17, the Hatzav walk)
    ld = bpy.data.lights.new('DN_sun', 'SUN'); so = bpy.data.objects.new('DN_sun', ld)
    sc.collection.objects.link(so); suns = [so]; report["changed"].append("sun created")
for s in suns:
    if key['sun'] is None:
        s.hide_render = True
    else:
        k = key['sun']; s.hide_render = False
        s.rotation_euler = (math.radians(90 - k['el']), 0.0, math.radians(180 - k['az']))
        s.data.energy = k['energy']; s.data.color = k['color']; s.data.angle = math.radians(k['angle_deg'])
report["changed"].append(f"sun={'off' if key['sun'] is None else 'az%s/el%s' % (key['sun']['az'], key['sun']['el'])} x{len(suns)}")

# 3. interior lamps (area/point/spot) and emissive materials, scaled by `interior` (0 = switched off)
f = float(key['interior']); n_l = 0
rules = key.get('lights', [])   # optional [{match: name prefix, factor}] — the first match scales that lamp further
warm = key.get('lamp_color')     # optional [r,g,b] for every interior lamp (base colour kept in dn_base_color)
for o in sc.objects:
    if o.type == 'LIGHT' and o.data.type != 'SUN':
        base = o.data.get('dn_base_energy', o.data.energy); o.data['dn_base_energy'] = base
        r = next((x['factor'] for x in rules if o.name.startswith(x['match'])), 1.0)
        o.data.energy = base * f * r; o.hide_render = (f * r == 0.0); n_l += 1
        bc = list(o.data.get('dn_base_color', list(o.data.color))); o.data['dn_base_color'] = bc
        o.data.color = warm if warm else bc
if rules or warm:
    report["changed"].append(f"lamp rules {rules} colour {warm}")
n_e = 0
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    for nd in m.node_tree.nodes:
        sock = None
        if nd.bl_idname == 'ShaderNodeEmission':
            sock = nd.inputs['Strength']
        elif nd.bl_idname == 'ShaderNodeBsdfPrincipled':
            c = nd.inputs['Emission Color'].default_value
            if nd.inputs['Emission Strength'].default_value > 0 and (c[0] + c[1] + c[2]) > 0.01:
                sock = nd.inputs['Emission Strength']
        if sock is not None:
            base = m.get('dn_base_' + nd.name, sock.default_value); m['dn_base_' + nd.name] = base
            sock.default_value = base * f; n_e += 1
report["changed"].append(f"interior x{f}: {n_l} lamps, {n_e} emissive nodes")

# 4. exposure (the view transform and look stay as the style lock set them)
sc.view_settings.exposure = key['exposure']
report["changed"].append(f"exposure={key['exposure']} view={sc.view_settings.view_transform}/{sc.view_settings.look}")

os.makedirs(os.path.dirname(out), exist_ok=True)
if os.path.abspath(out) == os.path.abspath(src):
    print('RELIGHT_FAIL refusing to overwrite the source', file=sys.stderr); sys.exit(3)
bpy.ops.wm.save_as_mainfile(filepath=out, copy=True, compress=False)
report["out"] = out
report["preset_sha256"] = hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()[:16]
print('RELIGHT_OK ' + json.dumps(report, ensure_ascii=False))

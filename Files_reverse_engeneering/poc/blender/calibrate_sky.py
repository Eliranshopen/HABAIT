"""Find the world direction of the Nishita sky's sun for a given sun_rotation (no scene file touched).
Renders a 256x128 equirect of an empty world, camera at origin looking +Y, and reports the brightest pixel's bearing.
blender -b --factory-startup -P calibrate_sky.py -- <out.json>"""
import bpy, json, math, sys
import numpy as np

out = sys.argv[sys.argv.index('--') + 1]
sc = bpy.context.scene
for o in list(sc.objects):
    bpy.data.objects.remove(o, do_unlink=True)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 4; sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y = 256, 128
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'PANO'; cam.data.panorama_type = 'EQUIRECTANGULAR'
cam.rotation_euler = (math.radians(90), 0, 0)  # looks +Y (render_pano convention with yaw 0)
w = sc.world or bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
nt = w.node_tree; nt.nodes.clear()
sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_disc = True; sky.sun_elevation = math.radians(20)
bg = nt.nodes.new('ShaderNodeBackground'); outn = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(sky.outputs[0], bg.inputs[0]); nt.links.new(bg.outputs[0], outn.inputs[0])
sc.render.image_settings.file_format = 'OPEN_EXR'
res = []
for rot in (0, 90):
    sky.sun_rotation = math.radians(rot)
    sc.render.filepath = bpy.app.tempdir + f'sky_{rot}.exr'
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(sc.render.filepath)
    px = np.array(im.pixels[:]).reshape(128, 256, 4)[..., :3].sum(-1)
    r, c = np.unravel_index(np.argmax(px), px.shape)
    u = (c + 0.5) / 256  # 0.5 = camera forward (+Y), increases to the right
    bearing = ((u - 0.5) * 360) % 360  # clockwise from +Y when viewed from above
    res.append({"sun_rotation_deg": rot, "row_from_bottom": int(r), "bearing_deg_cw_from_+Y": round(bearing, 1)})
json.dump(res, open(out, 'w'), indent=1)
print('CAL_OK', res)

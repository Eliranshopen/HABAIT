"""render.py - one render from scene/apartment.blend.  $0 (local CPU).  Resumable: skips an existing output unless --force.

  blender -b scene/apartment.blend -P render.py -- <project> pano <cam_id> <width> <samples> [--force]
  blender -b scene/apartment.blend -P render.py -- <project> still <still_id> <width> <samples> [--force]
  blender -b scene/apartment.blend -P render.py -- <project> top <width> <samples>

pano: equirectangular 2:1 with the WRAP PAD (Rainbow F-360-118 fix): render W+2N columns over
360*(W+2N)/W degrees, denoise the wide frame, crop N columns each side -> the left and right edges meet.
Writes out/.../renders/<kind>/<id>.png + <id>.render.json (settings, seconds, sha256).
"""
import bpy, sys, os, json, math, time, hashlib

a = sys.argv[sys.argv.index('--') + 1:]
PROJ, KIND = a[0], a[1]
FORCE = '--force' in a
OUTROOT = os.path.join(PROJ, 'out', 'avnei-hefetz-kedem', 'buildings-1-2', '4-rooms', 'renders')
scene = bpy.context.scene
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_depth = '8'
scene.render.threads_mode = 'AUTO'

if KIND == 'top':
    width, samples = int(a[2]), int(a[3])
    cid = 'top'
    cd = bpy.data.cameras.new('top'); cd.type = 'ORTHO'
    xs = [o.location.x for o in bpy.data.collections['ARCH'].all_objects if o.name.startswith('wall_')]
    ys = [o.location.y for o in bpy.data.collections['ARCH'].all_objects if o.name.startswith('wall_')]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    span = max(max(xs) - min(xs), max(ys) - min(ys)) + 1.5
    cd.ortho_scale = span
    co = bpy.data.objects.new('top', cd); scene.collection.objects.link(co)
    co.location = (cx, cy, 2.55)  # just under the ceiling: cut view
    cd.clip_start = 0.01; cd.clip_end = 10
    for nm in ('ceiling', 'slab_above', 'balcony_roof', 'balcony_soffit'):
        if nm in bpy.data.objects:
            bpy.data.objects[nm].hide_render = True
    for o in bpy.data.objects:
        if o is not None and o.type == 'MESH' and o.name.startswith(('fixture_', 'pendant')):
            o.hide_render = True
    scene.camera = co
    scene.render.resolution_x = width; scene.render.resolution_y = width
    out = os.path.join(OUTROOT, 'top', 'top.png')
else:
    cid, width, samples = a[2], int(a[3]), int(a[4])
    name = ('pano_' if KIND == 'pano' else 'still_') + cid
    cam = bpy.data.objects[name]
    scene.camera = cam
    out = os.path.join(OUTROOT, KIND, cid + '.png')
    if KIND == 'pano':
        pad = max(32, width // 32)
        span = math.pi * (width + 2 * pad) / width
        cam.data.longitude_min = -span; cam.data.longitude_max = span
        cam.data.latitude_min = -math.pi / 2; cam.data.latitude_max = math.pi / 2
        scene.render.resolution_x = width + 2 * pad
        scene.render.resolution_y = width // 2
        # crop the pad in the compositor-free way: render to a temp file, crop with Blender's image API
    else:
        scene.render.resolution_x = width
        scene.render.resolution_y = int(width * 2 / 3)
scene.render.resolution_percentage = 100
scene.cycles.samples = samples

if os.path.exists(out) and not FORCE:
    print('SKIP exists', out)
    sys.exit(0)
os.makedirs(os.path.dirname(out), exist_ok=True)
tmp = out + '.wide.png' if KIND == 'pano' else out
scene.render.filepath = tmp
t0 = time.time()
bpy.ops.render.render(write_still=True)
secs = round(time.time() - t0, 1)
if KIND == 'pano':
    import numpy as np
    img = bpy.data.images.load(tmp)
    wpx, hpx = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(hpx, wpx, 4)
    pad = (wpx - width) // 2
    crop = px[:, pad:pad + width, :].copy()
    o = bpy.data.images.new('crop', width, hpx, alpha=False)
    o.pixels.foreach_set(crop.ravel())
    o.filepath_raw = out; o.file_format = 'PNG'; o.save()
    os.remove(tmp)
    seam = float(np.abs(crop[:, 0, :3] - crop[:, -1, :3]).mean())
else:
    seam = None
sha = hashlib.sha256(open(out, 'rb').read()).hexdigest()
meta = dict(kind=KIND, id=cid, file=os.path.basename(out), width=scene.render.resolution_x if KIND != 'pano' else width,
            height=scene.render.resolution_y, samples=samples, seconds=secs, engine='CYCLES', device='CPU',
            denoiser='OpenImageDenoise', view='AgX Medium High Contrast', seam_edge_mean_abs=seam, sha256=sha,
            blend=bpy.data.filepath)
json.dump(meta, open(out.replace('.png', '.render.json'), 'w'), indent=1)
print('DONE', json.dumps(meta))

"""Render one camera of scene/apartment.blend ($0, CPU Cycles).
Run: blender -b scene/apartment.blend --python 06_render.py -- <job root> <camera> <width> <samples> <out.png> [y0 y1]
Equirect cameras render at width x width/2 (2:1). Optional y0,y1 (0..1) render only that horizontal band (border),
so a large panorama is made in chunks that each fit the 9-minute bound; 07_stitch joins them. Writes <out>.json sidecar."""
import bpy, sys, json, time
from pathlib import Path
a = sys.argv[sys.argv.index("--") + 1:]
root, cam, W, spp, out = Path(a[0]), a[1], int(a[2]), int(a[3]), a[4]
s = bpy.context.scene
s.camera = bpy.data.objects[cam]
pano = s.camera.data.type == "PANO"
s.render.resolution_x = W
s.render.resolution_y = W // 2 if pano else int(W * 2 / 3)
s.render.resolution_percentage = 100
s.cycles.samples = spp
s.render.threads_mode = "AUTO"
if len(a) >= 7:
    s.render.use_border = True; s.render.use_crop_to_border = False
    s.render.border_min_x, s.render.border_max_x = 0.0, 1.0
    s.render.border_min_y, s.render.border_max_y = float(a[5]), float(a[6])
s.render.filepath = str(Path(out).resolve())
t = time.time()
bpy.ops.render.render(write_still=True)
dt = round(time.time() - t, 1)
Path(out + ".json").write_text(json.dumps({"camera": cam, "w": s.render.resolution_x, "h": s.render.resolution_y, "samples": spp,
    "band": a[5:7], "seconds": dt, "device": "CPU", "cost_usd": 0}), encoding="utf-8")
print("RENDERED", out, dt, "s")

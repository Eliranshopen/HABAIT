"""orbit_look.py - the baked COLOUR (not just coverage) around the tower: render_check.py's orbB/orbA cameras (node-b / node-a
rotated about TOWER_C, look at the tower centre, lens 30 / 35 mm) rendered with the baked emission materials, 960x540, Cycles
16 spp, + a strip sheet. Opens a baked.blend read-only (never saves it). $0.

  "$BLENDER" -b "$F/renders/baked-v5/baked.blend" -P "$F/skins-extra/orbit_look.py" -- --out "$F/renders/baked-check-v5/orbit_look" [--n 12]
"""
import bpy, sys, os, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[argv.index("--out") + 1]
N = int(argv[argv.index("--n") + 1]) if "--n" in argv else 12
TOWER_C = (-5.9, -13.0, 14.0)
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
nodes = json.loads(sc["nodes"])
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 16
sc.cycles.max_bounces = 0
sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 960, 540, 100
sc.render.image_settings.file_format = "PNG"
sc.view_settings.view_transform = "Standard"
cd = bpy.data.cameras.new("LOOK")
cam = bpy.data.objects.new("LOOK", cd)
sc.collection.objects.link(cam)
sc.camera = cam
cd.sensor_width = 36
cd.clip_start, cd.clip_end = 0.1, 20000
cam.rotation_mode = "QUATERNION"
for ring, idx, lens in (("orbB", 1, 30), ("orbA", 0, 35)):
    b = nodes[idx]["O"]
    dx, dy = b[0] - TOWER_C[0], b[1] - TOWER_C[1]
    for k in range(N):
        az = 360.0 * k / N
        a = math.radians(az)
        pos = Vector((TOWER_C[0] + dx * math.cos(a) - dy * math.sin(a), TOWER_C[1] + dx * math.sin(a) + dy * math.cos(a), b[2]))
        cam.location = pos
        cam.rotation_quaternion = (Vector(TOWER_C) - pos).to_track_quat("-Z", "Y")
        cd.lens = lens
        sc.render.filepath = f"{OUT}/{ring}_{az:03.0f}.png"
        bpy.ops.render.render(write_still=True)
        print("[look]", ring, az, flush=True)

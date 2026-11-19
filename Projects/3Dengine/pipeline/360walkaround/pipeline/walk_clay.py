"""walk_clay.py — a grey "clay" guide film of a person walking one route through the plan-true model (2026-11-12, walk films).

  blender -b <tour>/scene-full.blend --factory-startup -P pipeline/walk_clay.py -- --route <route.json> --out <clay.mp4>
          [--seconds 5] [--fps 24] [--size 1280x720] [--hfov 85] [--pitch -4] [--eye 160]

route.json = {"path": [[x_cm, y_cm], ...]} in plan centimetres (x right, y down) — a route of walk.json. The camera walks it at eye
height with an eased start and stop; it looks where the route leads 1.2 m ahead (a person's gaze), so the turns are smooth.
Workbench, one flat grey, shadows + cavity: geometry only, for Kling v2v to re-dress. No skirting boards (Eliran 2026-11-10).
Writes the H.264 film and <out>.camera.json (per frame: plan x, y, bearing) so the page can land in the 360 at the film's last view.
"""
import bpy, sys, json, math, argparse, os
ap = argparse.ArgumentParser()
ap.add_argument('--route', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--seconds', type=float, default=5.0); ap.add_argument('--fps', type=int, default=24); ap.add_argument('--size', default='1280x720')
ap.add_argument('--hfov', type=float, default=85.0); ap.add_argument('--pitch', type=float, default=-4.0); ap.add_argument('--eye', type=float, default=160.0)
ap.add_argument("--keep-furniture", action="store_true", help="keep the loose furniture of the model (default: hidden; the furniture in the pictures differs, the film takes its look from them)")
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])
pts = json.load(open(a.route, encoding='utf-8'))['path']
cum = [0.0]
for k in range(1, len(pts)): cum.append(cum[-1] + math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]))
L = cum[-1]
def at(d):
    d = max(0.0, min(L, d)); k = 1
    while k < len(pts) - 1 and cum[k] < d: k += 1
    f = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) or 1)
    return (pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f)
def look(d, ahead=120.0):
    p, q = at(d), at(min(L, d + ahead))
    if math.hypot(q[0] - p[0], q[1] - p[1]) < 1:   # at the end: the last run's heading
        p, q = pts[-2], pts[-1]
    return math.atan2(q[0] - p[0], -(q[1] - p[1]))
s = bpy.context.scene
LOOSE = ('lounge', 'modern_arm_chair', 'modern_coffee', 'chairModern', 'table(Clone)', 'rug', 'lampRound', 'potted_plant', 'pillow', 'outdoor_table', 'bedDouble', 'cabinetBedDrawer', 'hanging_picture', 'FIXTURE')
hidden = 0
for o in bpy.data.objects:
    n = o.name
    if n.startswith(('SKIRT', 'GLASS')) or (not a.keep_furniture and n.startswith(LOOSE)): o.hide_render = True; hidden += 1   # glass: see through the openings
print('hidden', hidden)
s.render.engine = 'BLENDER_WORKBENCH'
sh = s.display.shading; sh.light = 'FLAT'; sh.color_type = 'SINGLE'; sh.single_color = (0.80, 0.80, 0.78)
sh.show_shadows = False; sh.show_cavity = True; sh.cavity_type = 'BOTH'; sh.cavity_ridge_factor = 1.0; sh.cavity_valley_factor = 1.0
sh.curvature_ridge_factor = 1.0; sh.curvature_valley_factor = 1.0; sh.show_object_outline = True; sh.object_outline_color = (0.25, 0.25, 0.25)
sh.background_type = 'VIEWPORT'; sh.background_color = (0.93, 0.93, 0.93)
s.display.shadow_focus = 0.4
if s.world: s.world.color = (0.86, 0.89, 0.93)   # a light sky through the openings (Workbench renders the world colour)
W, H = (int(v) for v in a.size.split('x')); s.render.resolution_x = W; s.render.resolution_y = H; s.render.resolution_percentage = 100
s.render.fps = a.fps; N = int(round(a.seconds * a.fps)); s.frame_start = 1; s.frame_end = N + 1
cam = bpy.data.cameras.new('WalkCam'); cam.sensor_fit = 'HORIZONTAL'; cam.angle = math.radians(a.hfov); cam.clip_start = 0.05
co = bpy.data.objects.new('WalkCam', cam); s.collection.objects.link(co); s.camera = co
rows = []; prev = None
for i in range(N + 1):
    t = i / N; e = t * t * (3 - 2 * t)                 # eased: a person starts and stops gently
    d = e * L; x, y = at(d); b = look(d)
    if prev is not None:                              # keep the yaw continuous for the keyframe interpolation
        while b - prev > math.pi: b -= 2 * math.pi
        while b - prev < -math.pi: b += 2 * math.pi
    prev = b
    co.location = (x / 100, -y / 100, a.eye / 100); co.rotation_euler = (math.radians(90 + a.pitch), 0, -b)
    co.keyframe_insert('location', frame=i + 1); co.keyframe_insert('rotation_euler', frame=i + 1)
    rows.append({'f': i, 'x': round(x, 1), 'y': round(y, 1), 'bearing_deg': round(math.degrees(b) % 360, 2)})
for fc in co.animation_data.action.fcurves:
    for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
s.render.image_settings.file_format = 'FFMPEG'; s.render.ffmpeg.format = 'MPEG4'; s.render.ffmpeg.codec = 'H264'
s.render.ffmpeg.constant_rate_factor = 'HIGH'; s.render.ffmpeg.ffmpeg_preset = 'GOOD'
s.render.filepath = os.path.abspath(a.out); s.render.use_file_extension = False
bpy.ops.render.render(animation=True)
json.dump({'route_len_cm': round(L, 1), 'seconds': a.seconds, 'fps': a.fps, 'frames': N + 1, 'hfov_deg': a.hfov, 'pitch_deg': a.pitch, 'eye_cm': a.eye, 'size': [W, H], 'frames_at': rows},
          open(a.out + '.camera.json', 'w'), indent=0)
print('WALK_CLAY_OK', a.out, N + 1, 'frames, route', round(L), 'cm')

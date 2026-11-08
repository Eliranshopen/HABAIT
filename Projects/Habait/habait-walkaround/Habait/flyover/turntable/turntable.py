"""turntable.py - the 72-frame availability spinner of the tower (card 21, C6a; residence.tech style, 5 deg per frame).

Three modes, one file:

  1. plan (plain Python, no Blender): 72 orbital camera poses -> _local/camera.json (Studio form + perspective intrinsics)
       $PY Habait/flyover/turntable/turntable.py --plan [--radius 150 --cam-z 60 --fill 0.86]
  2. render (Blender, reads camera.json, never saves the .blend): EEVEE 1280x720 -> raw/_local/NNN.png, and writes the
     Blender camera back into camera.json with world_to_camera_view probes (project_units_perspective.py --selftest uses them)
       timeout 900 "$BLENDER" -b Habait/flyover/renders/baked-v5/baked.blend -P Habait/flyover/turntable/turntable.py -- \
           --render [--frames 0-71] [--res 1280x720] [--samples 8]
  3. pack (plain Python, Pillow): raw/_local/NNN.png -> _local/NNN.webp, the highest quality <= --cap-kb (default 125)
       $PY Habait/flyover/turntable/turntable.py --pack

Then: $PY Habait/flyover/turntable/project_units_perspective.py --debug 0,18,36,54 --debug-src Habait/flyover/turntable/raw/_local

Camera: a circle of --radius m (default 150: inside the 164 m ring where the OSM neighbour masses start, so no neighbour
ever stands between the camera and the tower) around the plate's bbox centre, at --cam-z m (plan-world, floor 16 = 0;
ground -51.2), always aimed at the tower axis. Frame i: camera plan bearing = bearing0 + 5 i (clockwise seen from above),
bearing0 = the bearing of ab's orbit hold pose (68.4477, -47.2597) = the side of unit 846's balcony, so frame 0 faces 846.
One pitch and one focal length for all 72 frames, fitted so the whole prism (plate hull, ground to crown) fills --fill of the
frame height in the worst frame, centred vertically.
Background: the baked scene's world (node-a skin equirect) is replaced by a soft vertical gradient; BK_tower_hidden is hidden.
The baked skins carry no developer lettering (D-WQ-18); check the debug frames anyway.
Frames: plan-world metres, X right, Y up the plan sheet, Z up (Habait/flyover/renders/baked/BAKED-README.md).
"""
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT = os.path.join(HERE, "_local")
RAW = os.path.join(HERE, "raw", "_local")                    # raw PNG renders; outside _local/ so du -sm counts deliverables only
CAMERA = os.path.join(OUT, "camera.json")
FOOT = os.path.join(REPO, "Habait", "studio", "_local", "projects", "apt846-rainbow-tlv", "derived", "tower-footprint.json")
MASS = os.path.join(REPO, "Habait", "engine", "_local", "rainbow", "mass-plan-world", "tower-mass.json")
UNITS = os.path.join(REPO, "Habait", "engine", "_local", "rainbow", "units.json")
HOLD_POSE_XY = (68.4477, -47.2597)       # ab's orbit end pose = node-b-tower = the hold in front of 846 (memory.md section 4)
SENSOR_W = 36.0
N_FRAMES, STEP = 72, 5


def log(m):
    print("[turntable] " + m, flush=True)


def parse(argv):
    import argparse
    ap = argparse.ArgumentParser(prog="turntable.py")
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--pack", action="store_true")
    ap.add_argument("--radius", type=float, default=150.0)
    ap.add_argument("--cam-z", type=float, default=60.0)
    ap.add_argument("--fill", type=float, default=0.86, help="tower height share of the frame height (worst frame)")
    ap.add_argument("--res", default="1280x720")
    ap.add_argument("--frames", default="0-71")
    ap.add_argument("--samples", type=int, default=8)
    ap.add_argument("--engine", default="eevee", choices=["eevee", "cycles"],
                    help="cycles = for a GPU farm (Kaggle OptiX); the scene is emission-only, so 16 spp and 0 bounces are enough")
    ap.add_argument("--glb", default="", help="import this site_baked.glb into an empty scene (portable: textures embedded; "
                                              "baked.blend points at absolute C:/ texture paths)")
    ap.add_argument("--camera", default=CAMERA)
    ap.add_argument("--raw", default=RAW)
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--cap-kb", type=int, default=125)
    return ap.parse_args(argv)


# ================================================================================================ plan (numpy only)
def plan(a):
    import numpy as np
    sys.path.insert(0, HERE)
    sys.dont_write_bytecode = True
    import project_units_perspective as pp
    W, H = [int(v) for v in a.res.lower().split("x")]
    plate, _ = pp.load_plate(FOOT)
    hull = pp.convex_ccw(plate)
    fl = pp.load_floors(MASS)
    zg, zt = fl["z_ground"], fl["z_top"]
    cx, cy = (plate[:, 0].min() + plate[:, 0].max()) / 2.0, (plate[:, 1].min() + plate[:, 1].max()) / 2.0
    b0 = pp.bearing_deg(HOLD_POSE_XY[0] - cx, HOLD_POSE_XY[1] - cy)
    pts = np.array([(x, y, z) for x, y in hull for z in (zg, zt)], float)
    poses = []
    for i in range(N_FRAMES):
        b = math.radians(b0 + STEP * i)
        poses.append((np.array([cx + a.radius * math.sin(b), cy + a.radius * math.cos(b), a.cam_z]), (b0 + STEP * i) % 360.0))

    def mats(pitch):
        out = []
        for pos, _ in poses:
            d = np.array([cx - pos[0], cy - pos[1]])
            d /= np.linalg.norm(d)
            tgt = pos + np.array([d[0] * math.cos(pitch), d[1] * math.cos(pitch), math.sin(pitch)]) * 100.0
            out.append(pp.look_matrix(pos, tgt))
        return out

    def tans(pitch):
        tu, tr = [], []
        for M in mats(pitch):
            q = (pts - M[:3, 3]) @ M[:3, :3]
            tu.append(q[:, 1] / -q[:, 2])
            tr.append(q[:, 0] / -q[:, 2])
        return np.concatenate(tu), np.concatenate(tr)

    lo, hi = math.radians(-60), math.radians(10)                # bisection: top and bottom equally far from the centre
    for _ in range(60):
        mid = (lo + hi) / 2.0
        tu, _ = tans(mid)
        if tu.max() + tu.min() > 0:
            lo = mid
        else:
            hi = mid
    pitch = (lo + hi) / 2.0
    tu, tr = tans(pitch)
    fy = a.fill * (H / 2.0) / np.abs(tu).max()
    fx_w = 0.94 * (W / 2.0) / np.abs(tr).max()
    f = min(fy, fx_w)
    lens = f * SENSOR_W / W
    K = pp.intrinsics(lens, SENSOR_W, W, H)
    hfov = math.degrees(2 * math.atan(W / 2.0 / f))
    vfov = math.degrees(2 * math.atan(H / 2.0 / f))
    frames = []
    for i, (M, (pos, bear)) in enumerate(zip(mats(pitch), poses)):
        fwd = -M[:3, 2]
        yaw = pp.bearing_deg(fwd[0], fwd[1])
        frames.append({
            "frame": i + 1, "index": i, "angle": STEP * i, "camera_bearing_deg": round(bear, 4),
            "pos": [round(float(v), 4) for v in pos], "look_dir": [round(float(v), 6) for v in fwd],
            "yaw_deg_from_plus_y_cw": round(yaw, 4), "pitch_deg": round(math.degrees(pitch), 4), "roll_deg": 0.0,
            "rotation_euler_deg": [round(90.0 + math.degrees(pitch), 4), 0.0, round(-yaw % 360.0, 4)],
            "projection": "perspective", "hfov_deg": round(hfov, 4), "vfov_deg": round(vfov, 4), "res": [W, H],
            "lens_mm": round(lens, 4), "sensor_width_mm": SENSOR_W, "sensor_fit": "HORIZONTAL", "intrinsics": K,
            "matrix_world": [[round(float(v), 6) for v in row] for row in M],
            "pos_glb": [round(float(pos[0]), 4), round(float(pos[2]), 4), round(float(-pos[1]), 4)]})
    cam = {"shot": "turntable", "schema": "habait-flyover/turntable-camera.v1",
           "frame_world": "X = x_cm/100, Y = -y_cm/100, Z up, unit floor 16 at 0 (plan-world metres; ground -51.2; north at plan bearing 304.4)",
           "camera_convention": "Blender camera, local -Z = look_dir, local +Y = up, no roll; matrix_world = camera to world",
           "projection": "perspective pinhole: x = cx + fx*right/fwd, y = cy - fy*up/fwd (pixels, origin top-left); sensor_fit HORIZONTAL, no shift",
           "files": {"rgb": "raw/_local/NNN.png (0-based index), packed to _local/NNN.webp"},
           "centre_xy": [round(cx, 4), round(cy, 4)], "radius_m": a.radius, "cam_z": a.cam_z,
           "bearing0_deg": round(b0, 4), "bearing0_source": "ab's orbit hold pose %s (node-b-tower)" % (HOLD_POSE_XY,),
           "step_deg": STEP, "fill": a.fill, "tower_z": [zg, zt], "blender": None, "frames": frames}
    os.makedirs(os.path.dirname(os.path.abspath(a.camera)), exist_ok=True)
    json.dump(cam, open(a.camera, "w", encoding="utf-8"), indent=1)
    log("plan: centre (%.2f, %.2f), R %.0f m, cam z %.1f, bearing0 %.2f, pitch %.2f deg, lens %.2f mm (hfov %.1f, vfov %.1f)"
        " -> %s" % (cx, cy, a.radius, a.cam_z, b0, math.degrees(pitch), lens, hfov, vfov, a.camera))
    # frame check: every prism point inside the frame on every pose
    worst = 0.0
    for fr in frames:
        x, y, _ = pp.project_px(pts, fr["matrix_world"], K)
        worst = max(worst, float(np.max(np.abs(y - H / 2) / (H / 2))), float(np.max(np.abs(x - W / 2) / (W / 2))))
    log("plan: worst prism extent %.3f of the half-frame (<= 1 = whole tower in frame)" % worst)
    return 0 if worst <= 1.0 else 1


# ================================================================================================ pack (Pillow)
def pack(a):
    from PIL import Image
    os.makedirs(a.out, exist_ok=True)
    lo, hi = [int(v) for v in a.frames.split("-")]
    total, sizes, qs = 0, [], []
    for i in range(lo, hi + 1):
        src = os.path.join(a.raw, "%03d.png" % i)
        if not os.path.exists(src):
            log("pack: missing %s" % src)
            return 1
        im = Image.open(src).convert("RGB")
        dst = os.path.join(a.out, "%03d.webp" % i)
        for q in range(92, 19, -4):                               # highest quality under the cap
            im.save(dst, "WEBP", quality=q, method=6)
            if os.path.getsize(dst) <= a.cap_kb * 1024:
                break
        sizes.append(os.path.getsize(dst))
        qs.append(q)
        total += sizes[-1]
    log("pack: %d webp, %d..%d KB (mean %d), quality %d..%d, total %.2f MB" % (
        len(sizes), min(sizes) // 1024, max(sizes) // 1024, sum(sizes) // len(sizes) // 1024, min(qs), max(qs), total / 2 ** 20))
    return 0 if max(sizes) <= 150 * 1024 and total <= 10 * 2 ** 20 else 1


# ================================================================================================ render (Blender)
def render(a):
    import bpy
    from mathutils import Matrix, Vector
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    W, H = [int(v) for v in a.res.lower().split("x")]
    cam_doc = json.load(open(a.camera, encoding="utf-8"))
    blend = bpy.data.filepath
    if a.glb:
        # glTF Y-up -> Blender Z-up: the importer maps (x, y, z)_glb -> (x, -z, y) = plan-world (X, Y, Z) (BAKED-README.md)
        bpy.ops.import_scene.gltf(filepath=a.glb)
        blend = a.glb
    if "BK_tower" not in bpy.data.objects:
        log("no BK_tower in the scene: open baked.blend or pass --glb site_baked.glb")
        return 2
    if a.engine == "cycles":
        sc.render.engine = "CYCLES"
        sc.cycles.samples = a.samples
        sc.cycles.max_bounces = 0
        sc.cycles.seed = 0
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            for dev in ("OPTIX", "CUDA"):
                try:
                    prefs.compute_device_type = dev
                    prefs.get_devices()
                    if any(d.type == dev for d in prefs.devices):
                        for d in prefs.devices:
                            d.use = d.type == dev
                        sc.cycles.device = "GPU"
                        break
                except TypeError:
                    continue
        except Exception as e:
            log("cycles: CPU (%s)" % e)
    else:
        for ident in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
            try:
                sc.render.engine = ident
                break
            except TypeError:
                continue
        sc.eevee.taa_render_samples = a.samples
        for attr, val in (("use_shadows", False), ("use_raytracing", False), ("use_gtao", False), ("use_bloom", False)):
            try:
                setattr(sc.eevee, attr, val)
            except Exception:
                pass
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
    sc.render.use_motion_blur = False
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"           # emission skins in = pixels out (render_check.py / life.py)
    sc.view_settings.look = "None"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.color_depth = "8"
    for o in bpy.data.objects:
        if o.name == "BK_tower_hidden":
            o.hide_render = True
    # soft background: vertical gradient by view direction (replaces the node-a skin environment)
    w = bpy.data.worlds.new("TT_soft")
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sp = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    bg = nt.nodes.new("ShaderNodeBackground")
    outn = nt.nodes.new("ShaderNodeOutputWorld")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.84, 0.86, 0.88, 1.0)   # pale haze at the horizon
    ramp.color_ramp.elements[1].position = 0.6
    ramp.color_ramp.elements[1].color = (0.50, 0.62, 0.78, 1.0)   # soft blue overhead
    nt.links.new(tc.outputs["Generated"], sp.inputs["Vector"])
    nt.links.new(sp.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    nt.links.new(bg.outputs["Background"], outn.inputs["Surface"])
    sc.world = w
    cd = bpy.data.cameras.new("TT_cam")
    cd.sensor_fit = "HORIZONTAL"
    cd.sensor_width = SENSOR_W
    cd.lens = cam_doc["frames"][0]["lens_mm"]
    cd.clip_start, cd.clip_end = 1.0, 12000.0
    cam = bpy.data.objects.new("TT_cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    os.makedirs(a.raw, exist_ok=True)
    if os.path.exists(UNITS):                                     # probes: the hero box corners
        units = json.load(open(UNITS, encoding="utf-8"))["units"]
        hero = next(u for u in units if u["id"] == "apt846")["box_world"]
    else:                                                         # a farm without units.json: the 846 box as of 2026-11-02
        hero = [0.738, -16.031, 0.0, 14.431, -0.378, 2.9]
    corners = [(x, y, z) for x in (hero[0], hero[3]) for y in (hero[1], hero[4]) for z in (hero[2], hero[5])]
    lo, hi = [int(v) for v in a.frames.split("-")]
    times = []
    for fr in cam_doc["frames"]:
        i = fr["index"]
        cam.matrix_world = Matrix(fr["matrix_world"])
        cd.lens = fr["lens_mm"]
        bpy.context.view_layer.update()
        mw = [[round(cam.matrix_world[r][c], 6) for c in range(4)] for r in range(4)]
        fr["matrix_world_blender"] = mw
        fr["probe"] = []
        for p in corners:
            v = world_to_camera_view(sc, cam, Vector(p))
            fr["probe"].append({"world": list(p), "px": [round(v.x * W, 4), round((1.0 - v.y) * H, 4)]})
        if lo <= i <= hi:
            t = time.time()
            sc.render.filepath = os.path.join(a.raw, "%03d.png" % i)
            bpy.ops.render.render(write_still=True)
            times.append(time.time() - t)
            log("frame %03d angle %3d  %.1f s" % (i, fr["angle"], times[-1]))
    try:
        blend_rel = os.path.relpath(blend, REPO).replace("\\", "/")
    except ValueError:
        blend_rel = blend                                        # another drive / a Kaggle input path
    cam_doc["blender"] = {"version": bpy.app.version_string, "blend": blend_rel,
                          "engine": sc.render.engine, "samples": a.samples, "res": [W, H], "frames": a.frames,
                          "seconds_per_frame": round(sum(times) / max(len(times), 1), 2), "seconds_total": round(sum(times), 1)}
    json.dump(cam_doc, open(a.camera, "w", encoding="utf-8"), indent=1)
    log("render: %d frames, %.1f s total -> %s (blend not saved)" % (len(times), sum(times), a.raw))
    return 0


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = parse(argv)
    try:
        import bpy  # noqa: F401
        in_blender = True
    except ImportError:
        in_blender = False
    if a.render or (in_blender and not (a.plan or a.pack)):
        if not in_blender:
            log("--render runs inside Blender: \"$BLENDER\" -b <baked.blend> -P turntable.py -- --render")
            return 2
        return render(a)
    if a.pack:
        return pack(a)
    return plan(a)


if __name__ == "__main__":
    rc = main()
    try:
        import bpy  # noqa: F401
    except ImportError:
        sys.exit(rc)

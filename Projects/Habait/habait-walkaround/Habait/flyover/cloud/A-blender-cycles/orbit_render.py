"""Habait route A: deterministic orbit of the Rainbow tower in Blender Cycles (runs headless on a Kaggle T4).

blender -b --factory-startup -P orbit_render.py -- --glb site.glb --out OUT --frames 1,43,85 --samples 128 --look dev

World frame of site.glb after the glTF import = plan world: X right, Y up the plan sheet, Z up, metres.
Tower centre (-5.9, -13.0), ground z -52.4, tower top z 79.8; north = plan bearing 304.4 deg (clockwise from +Y).
"""
import argparse
import json
import math
import os
import sys
import time

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--glb", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--look", default="dev", choices=["dev", "clay"])
ap.add_argument("--frames", default="1")             # "1,43,85" or "1-252"
ap.add_argument("--nframes", type=int, default=252)   # frames per full turn (252 = 10.5 s at 24 fps)
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--res", default="1280x720")
ap.add_argument("--radius", type=float, default=240.0)
ap.add_argument("--height", type=float, default=55.0)
ap.add_argument("--target_z", type=float, default=0.0)
ap.add_argument("--lens", type=float, default=26.0)
ap.add_argument("--start_bearing", type=float, default=121.0)  # plan bearing of the camera seen from the tower (node-a side)
ap.add_argument("--device", default="auto")          # auto | OPTIX | CUDA | CPU
ap.add_argument("--exposure", type=float, default=None)
ap.add_argument("--sun_elev", type=float, default=30.0)
ap.add_argument("--sun_az", type=float, default=140.0)  # compass azimuth, deg from north clockwise (~09:30 early Nov, TLV)
ap.add_argument("--fmt", default="PNG", choices=["PNG", "JPEG"])
ap.add_argument("--camera-json", default=None)  # habait-flyover/orbit-camera.v1 (flyover/orbit/camera.json): per-frame matrix_world
ap.add_argument("--sun_plan_bearing", type=float, default=None)  # overrides --sun_az (plan bearing, clockwise from +Y)
a = ap.parse_args(argv)

TOWER = Vector((-5.9, -13.0, 0.0))
NORTH_BEARING = 304.4
os.makedirs(a.out, exist_ok=True)
log = {"args": vars(a)}
t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.glb)
log["import_s"] = round(time.time() - t0, 2)
scene = bpy.context.scene

# ---------- device: OptiX, else CUDA, else CPU ----------
prefs = bpy.context.preferences.addons["cycles"].preferences
used = None
order = ["OPTIX", "CUDA"] if a.device == "auto" else [a.device]
for kind in order:
    if kind == "CPU":
        break
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
    except Exception as e:  # noqa: BLE001
        print("[dev] no", kind, e)
        continue
    devs = [d for d in prefs.devices if d.type == kind]
    for d in prefs.devices:
        d.use = d.type == kind
    if devs:
        used = kind
        log["devices"] = [d.name for d in devs]
        break
scene.render.engine = "CYCLES"
scene.cycles.device = "GPU" if used else "CPU"
log["compute"] = used or "CPU"
print("[dev]", log["compute"], log.get("devices"), flush=True)

# ---------- render settings ----------
W, H = map(int, a.res.split("x"))
r = scene.render
r.resolution_x, r.resolution_y, r.resolution_percentage = W, H, 100
r.image_settings.file_format = a.fmt
r.image_settings.color_mode = "RGB"
if a.fmt == "JPEG":
    r.image_settings.quality = 95
r.use_persistent_data = True
c = scene.cycles
c.samples = a.samples
c.use_adaptive_sampling = True
c.adaptive_threshold = 0.02
c.use_denoising = True
# Kaggle's driver exposes OptiX for rendering but "Failed to create OptiX denoiser" (run 1): use OIDN, GPU first.
DENOISE_CHAIN = [("OPENIMAGEDENOISE", True), ("OPENIMAGEDENOISE", False)]
c.denoiser, c.denoising_use_gpu = DENOISE_CHAIN[0]
log["denoiser"] = list(DENOISE_CHAIN[0])


def render_still():
    """bpy.ops.render.render with a fallback down the denoiser chain if the denoiser cannot be created"""
    while True:
        try:
            bpy.ops.render.render(write_still=True)
            return
        except RuntimeError as e:
            if "denois" not in str(e).lower() or len(DENOISE_CHAIN) < 2:
                raise
            DENOISE_CHAIN.pop(0)
            c.denoiser, c.denoising_use_gpu = DENOISE_CHAIN[0]
            log["denoiser"] = list(DENOISE_CHAIN[0])
            print("[denoise] fallback to", DENOISE_CHAIN[0], flush=True)
c.max_bounces = 6
c.transparent_max_bounces = 8
c.caustics_reflective = False
c.caustics_refractive = False
scene.view_settings.view_transform = "AgX"
try:
    scene.view_settings.look = "AgX - Medium High Contrast"
except Exception:  # noqa: BLE001
    pass


# ---------- look-dev materials (deterministic stand-in until the baked skins cover the whole tower) ----------
def mat(name, base, rough, metal=0.0, trans=0.0, ior=1.5, coat=0.0, noise=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["IOR"].default_value = ior
    b.inputs["Coat Weight"].default_value = coat
    if noise:  # (scale, second colour): large-scale variation so the repeated blocks do not look cloned
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = noise[0]
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*base, 1.0)
        ramp.color_ramp.elements[1].color = (*noise[1], 1.0)
        nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
        nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


LOOK = {
    "STUDIO_clay_tower": dict(base=(0.86, 0.85, 0.82), rough=0.45),
    "STUDIO_clay_glazing": dict(base=(0.012, 0.016, 0.02), rough=0.03, ior=1.52),
    "M_glass": dict(base=(0.012, 0.016, 0.02), rough=0.03, ior=1.52),
    "STUDIO_clay_railglass": dict(base=(0.85, 0.92, 0.92), rough=0.02, trans=1.0, ior=1.5),
    "STUDIO_clay_mullion": dict(base=(0.03, 0.03, 0.035), rough=0.35, metal=0.9),
    "STUDIO_clay_bush": dict(base=(0.04, 0.10, 0.025), rough=0.85, noise=(0.8, (0.11, 0.17, 0.04))),
    "STUDIO_clay_neighbour": dict(base=(0.74, 0.72, 0.67), rough=0.8, noise=(0.05, (0.88, 0.86, 0.81))),
    "STUDIO_clay_podium": dict(base=(0.80, 0.78, 0.73), rough=0.7),
}
replaced = {}
if a.look == "dev":
    cache = {}
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        for slot in ob.material_slots:
            if not slot.material:
                continue
            key = next((k for k in LOOK if slot.material.name.startswith(k)), None)
            if key:
                if key not in cache:
                    cache[key] = mat("LOOK_" + key, **LOOK[key])
                slot.material = cache[key]
                replaced[key] = replaced.get(key, 0) + 1
    for m in bpy.data.materials:  # the orthophoto ground: matte
        if m.name.startswith("STUDIO_ortho") and m.use_nodes:
            b = m.node_tree.nodes.get("Principled BSDF")
            if b:
                b.inputs["Roughness"].default_value = 0.9
log["replaced_slots"] = replaced

# ---------- sky + sun: Nishita with sun disc. Cycles: sun direction in XY = (-sin rot, cos rot) ----------
world = bpy.data.worlds.new("SKY")
scene.world = world
world.use_nodes = True
wnt = world.node_tree
bg = wnt.nodes["Background"]
sky = wnt.nodes.new("ShaderNodeTexSky")
sky.sky_type = "NISHITA"
sky.sun_disc = True
sky.sun_elevation = math.radians(a.sun_elev)
sun_bearing = a.sun_plan_bearing if a.sun_plan_bearing is not None else (NORTH_BEARING + a.sun_az) % 360.0
sky.sun_rotation = math.radians(-sun_bearing)
sky.altitude = 50.0
sky.air_density = 1.0
sky.dust_density = 1.5
wnt.links.new(sky.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 1.0
log["sun_plan_bearing"] = sun_bearing

# ---------- camera orbit ----------
cam_data = bpy.data.cameras.new("CAM")
cam_data.lens = a.lens
cam_data.sensor_width = 36.0
cam_data.clip_start = 1.0
cam_data.clip_end = 6000.0
cam = bpy.data.objects.new("CAM", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
target = Vector((TOWER.x, TOWER.y, a.target_z))


CAMS = None
if a.camera_json:
    from mathutils import Matrix
    _cj = json.load(open(a.camera_json))
    CAMS = {fr["frame"]: fr for fr in _cj["frames"]}
    log["camera_json"] = {"schema": _cj.get("schema"), "n_frames": _cj.get("n_frames"), "segments": _cj.get("segments")}


def place(f):
    """frame f (1-based): from camera.json if given, else one full turn of a.nframes frames, counter-clockwise"""
    if CAMS is not None:
        fr = CAMS[f]
        cam.data.sensor_fit = "HORIZONTAL"
        cam.data.sensor_width = fr.get("sensor_mm", 36.0)
        cam.data.lens = fr["lens_mm"]
        cam.matrix_world = Matrix(fr["matrix_world"])
        return [round(v, 3) for v in fr["pos"]]
    ang = math.radians(a.start_bearing) - 2 * math.pi * (f - 1) / a.nframes
    pos = Vector((TOWER.x + a.radius * math.sin(ang), TOWER.y + a.radius * math.cos(ang), a.height))
    cam.location = pos
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (target - pos).to_track_quat("-Z", "Y")
    return [round(v, 3) for v in pos]


def frames_list(s):
    out = []
    for part in s.split(","):
        if "-" in part:
            x, y = part.split("-")
            out += list(range(int(x), int(y) + 1))
        elif part:
            out.append(int(part))
    return out


def mean_srgb(path):
    img = bpy.data.images.load(path)
    px = img.pixels[:]
    bpy.data.images.remove(img)
    tot, n = 0.0, 0
    for i in range(0, len(px), 4 * 7):  # sparse sample of the saved (display-referred) PNG
        tot += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
        n += 1
    return tot / max(1, n)


# ---------- auto exposure: Nishita is absolute, so calibrate once on a 320x180 preview of frame 1 ----------
if a.exposure is None:
    place(1)
    r.resolution_x, r.resolution_y = 320, 180
    c.samples = 16
    exp = 0.0
    for it in range(4):
        scene.view_settings.exposure = exp
        r.filepath = os.path.join(a.out, f"_calib{it}.png")
        render_still()
        m = mean_srgb(r.filepath)
        print(f"[calib] exposure {exp:.2f} mean {m:.3f}", flush=True)
        if 0.40 <= m <= 0.52:
            break
        exp += max(-6.0, min(6.0, 2.2 * math.log2(0.46 / max(m, 1e-3))))
    a.exposure = exp
    r.resolution_x, r.resolution_y = W, H
    c.samples = a.samples
scene.view_settings.exposure = a.exposure
log["exposure"] = round(a.exposure, 3)

# ---------- render ----------
times = []
ext = ".png" if a.fmt == "PNG" else ".jpg"
for f in frames_list(a.frames):
    pos = place(f)
    scene.frame_set(f)
    r.filepath = os.path.join(a.out, f"f{f:04d}{ext}")
    t = time.time()
    render_still()
    dt = time.time() - t
    times.append({"frame": f, "s": round(dt, 2), "cam": pos})
    print(f"[frame] {f} {dt:.2f}s", flush=True)
log["frames"] = times
if times:
    steady = [x["s"] for x in times[1:]] or [times[0]["s"]]
    log["first_frame_s"] = times[0]["s"]
    log["steady_s_per_frame"] = round(sum(steady) / len(steady), 2)
log["total_s"] = round(time.time() - t0, 1)
json.dump(log, open(os.path.join(a.out, "render_log.json"), "w"), indent=1)
print("[done]", json.dumps({k: log[k] for k in ("compute", "denoiser", "exposure", "steady_s_per_frame", "total_s") if k in log}), flush=True)

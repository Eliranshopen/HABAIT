"""
hello-render.py — T01 plumbing smoke for the 360walkaround V2 render pipeline.

Proves, in one headless Blender run, the two render modes V2 lives on:
  1. a Cycles EQUIRECTANGULAR panorama (2:1) rendered on the GPU, and
  2. the Z/depth pass of the SAME frame, in the SAME projection, in real metres.

This is a PLUMBING test, not a quality test: 512x256 @ 32 samples by default.
The real 8K settings, the packed 24-bit depth PNG and the VRAM tuning are T04's job.

Invocation (from any cwd; paths resolve off __file__):
    blender -b --factory-startup -P <this file>
    blender -b --factory-startup -P <this file> -- --res 2048x1024 --samples 64 --hybrid

Outputs, written beside this script:
    hello.png                 the equirect pano (512x256, 2:1)
    hello-depth.exr           the depth pass, 32-bit float, METRES (lossless; T04 packs it)
    hello-depth-preview.png   normalised 8-bit view of the same depth, for eyeballing only
    hello-render.json         machine-readable result record (versions, device, timings, checks)
"""

import argparse
import json
import math
import os
import platform
import sys
import time
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent

# The camera sits at V2's measured reference height: 140 cm (V2-PLAN.md 5.3).
# The nadir pixel of the depth pass must therefore read ~1.40 m off the ground
# plane -- that single number is what proves the depth pass is (a) in metres and
# (b) radial-per-ray in the equirect projection, which is what the ruler needs.
CAM_HEIGHT_M = 1.40


# --------------------------------------------------------------------------- args
def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser(prog="hello-render.py")
    p.add_argument("--res", default="512x256", help="WxH, must be 2:1 for equirect (default 512x256)")
    p.add_argument("--samples", type=int, default=32)
    p.add_argument("--device", default="AUTO", choices=["AUTO", "OPTIX", "CUDA", "CPU"])
    p.add_argument("--hybrid", action="store_true", help="also enable the CPU alongside the GPU")
    p.add_argument("--denoise", action="store_true", help="off by default: keeps the smoke pure")
    p.add_argument("--seed", type=int, default=0)
    a = p.parse_args(argv)
    w, _, h = a.res.partition("x")
    a.width, a.height = int(w), int(h)
    return a


# ------------------------------------------------------------------------- device
def select_device(scene, preference, hybrid):
    """Enable a Cycles compute backend. Returns (backend, [device names], note).

    GOTCHA (measured 2026-09-01, Blender 4.5.10): `prefs.devices` is the UNION of
    every backend's entries -- the same A2000 shows up once as type 'CUDA' and once
    as type 'OPTIX', and CPU is always in the list -- regardless of what
    `compute_device_type` is set to. So you must filter by `d.type == backend`;
    enumerating `prefs.devices` tells you nothing about which backend is active.
    """
    prefs = bpy.context.preferences.addons["cycles"].preferences
    available = [t[0] for t in prefs.get_device_types(bpy.context)]

    if preference == "CPU":
        scene.cycles.device = "CPU"
        return "CPU", [platform.processor() or "CPU"], "CPU forced by --device CPU"

    order = ["OPTIX", "CUDA"] if preference == "AUTO" else [preference]
    for backend in order:
        if backend not in available:
            continue
        prefs.compute_device_type = backend
        prefs.refresh_devices()
        gpus = [d for d in prefs.devices if d.type == backend]
        if not gpus:
            continue
        for d in prefs.devices:
            d.use = (d.type == backend) or (hybrid and d.type == "CPU")
        scene.cycles.device = "GPU"
        note = "GPU+CPU hybrid" if hybrid else "GPU only"
        return backend, [d.name for d in gpus], note

    scene.cycles.device = "CPU"
    return "CPU", [], "no GPU backend available -- fell back to CPU"


# -------------------------------------------------------------------------- scene
def new_material(name, rgba, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def build_scene():
    """A default cube plus a ground plane, built from an EMPTY file so the result
    does not depend on the operator's startup .blend."""
    bpy.ops.wm.read_homefile(use_empty=True)
    scene = bpy.context.scene

    world = bpy.data.worlds.new("ProbeWorld")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.10, 0.20, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=20.0, location=(0.0, 0.0, 0.0))
    ground = bpy.context.active_object
    ground.name = "Ground"
    ground.data.materials.append(new_material("GroundMat", (0.55, 0.53, 0.50, 1.0), 0.8))

    # 2 m cube resting on the ground, 3 m out along +X.
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(3.0, 0.0, 1.0))
    cube = bpy.context.active_object
    cube.name = "Cube"
    cube.data.materials.append(new_material("CubeMat", (0.80, 0.20, 0.15, 1.0), 0.4))

    bpy.ops.object.light_add(type="SUN", location=(2.0, -3.0, 6.0))
    sun = bpy.context.active_object
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(50.0), 0.0, math.radians(35.0))

    # Equirect camera. Blender 4.3 moved the panorama settings OUT of the Cycles
    # addon and onto the Camera datablock itself; keep the old path as a fallback.
    cam_data = bpy.data.cameras.new("ProbeCam")
    cam_data.type = "PANO"
    pano_api = None
    if hasattr(cam_data, "panorama_type"):
        cam_data.panorama_type = "EQUIRECTANGULAR"
        pano_api = "camera.panorama_type (4.3+)"
    elif hasattr(cam_data, "cycles"):
        cam_data.cycles.panorama_type = "EQUIRECTANGULAR"
        pano_api = "camera.cycles.panorama_type (<=4.2)"
    else:
        raise RuntimeError("no equirectangular panorama API found on this Blender build")

    cam = bpy.data.objects.new("ProbeCam", cam_data)
    scene.collection.objects.link(cam)
    # Blender's panoramic camera looks along -Z by default; rotate X by 90 deg so the
    # sphere is upright (the equator is the horizon, +Y is forward).
    cam.location = (0.0, 0.0, CAM_HEIGHT_M)
    cam.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    scene.camera = cam

    return scene, pano_api


def configure_render(scene, args):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = args.samples
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = bool(args.denoise)
    scene.cycles.seed = args.seed
    scene.cycles.use_animated_seed = False

    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.filepath = str(HERE / "hello.png")

    scene.view_layers[0].use_pass_z = True

    # Compositor: Image -> Composite (the PNG), Depth -> File Output (the EXR).
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()
    rl = tree.nodes.new("CompositorNodeRLayers")
    comp = tree.nodes.new("CompositorNodeComposite")
    tree.links.new(rl.outputs["Image"], comp.inputs["Image"])

    fout = tree.nodes.new("CompositorNodeOutputFile")
    fout.base_path = str(HERE)
    fout.format.file_format = "OPEN_EXR"
    fout.format.color_mode = "BW"
    fout.format.color_depth = "32"
    fout.format.exr_codec = "ZIP"
    fout.file_slots[0].path = "hello-depth-"
    tree.links.new(rl.outputs["Depth"], fout.inputs[0])
    return fout


# -------------------------------------------------------------------------- depth
def settle_depth_file(scene):
    """The File Output node stamps a frame number; give it the stable name."""
    stamped = HERE / f"hello-depth-{scene.frame_current:04d}.exr"
    final = HERE / "hello-depth.exr"
    if stamped.exists():
        if final.exists():
            final.unlink()
        stamped.rename(final)
    if not final.exists():
        raise RuntimeError(f"depth EXR missing: neither {stamped.name} nor {final.name} was written")
    return final


def depth_stats_and_preview(exr_path, width, height):
    """Read the depth EXR back and (a) report real-metre statistics, (b) write a
    normalised 8-bit PNG preview. Reading a FILE-BACKED image is reliable in
    background mode; reading passes off 'Render Result' is not."""
    img = bpy.data.images.load(str(exr_path))
    n = len(img.pixels)
    buf = [0.0] * n
    img.pixels.foreach_get(buf)
    ch = img.channels
    depth = buf[0::ch]

    # Rays that escape to the world come back as a huge sentinel (1e10-ish).
    SKY = 1e7
    finite = [d for d in depth if 0.0 < d < SKY]
    dmin = min(finite) if finite else float("nan")
    dmax = max(finite) if finite else float("nan")

    # Nadir check: row 0 is the BOTTOM row of the image in Blender's pixel buffer,
    # i.e. straight down. Its value must be the camera height, in metres.
    row0 = depth[0:width]
    nadir = sorted(row0)[len(row0) // 2]

    preview_path = HERE / "hello-depth-preview.png"
    span = (dmax - dmin) or 1.0
    out = [0.0] * (width * height * 4)
    for i, d in enumerate(depth):
        v = 0.0 if d >= SKY else max(0.0, min(1.0, (d - dmin) / span))
        j = i * 4
        out[j] = out[j + 1] = out[j + 2] = v
        out[j + 3] = 1.0
    prev = bpy.data.images.new("depth_preview", width=width, height=height, alpha=True, float_buffer=False)
    prev.pixels.foreach_set(out)
    prev.file_format = "PNG"
    prev.filepath_raw = str(preview_path)
    prev.save()

    return {
        "exr_size": [img.size[0], img.size[1]],
        "min_m": round(dmin, 6),
        "max_m": round(dmax, 6),
        "sky_pixels": sum(1 for d in depth if d >= SKY),
        "nadir_m": round(nadir, 6),
        "nadir_expected_m": CAM_HEIGHT_M,
        "nadir_error_pct": round(abs(nadir - CAM_HEIGHT_M) / CAM_HEIGHT_M * 100.0, 4),
        "preview_png": preview_path.name,
    }


# --------------------------------------------------------------------------- main
def main():
    args = parse_args()
    if args.width != args.height * 2:
        raise SystemExit(f"equirect needs a 2:1 frame; got {args.width}x{args.height}")

    HERE.mkdir(parents=True, exist_ok=True)
    for stale in ("hello.png", "hello-depth.exr", "hello-depth-preview.png"):
        p = HERE / stale
        if p.exists():
            p.unlink()

    scene, pano_api = build_scene()
    backend, device_names, device_note = select_device(scene, args.device, args.hybrid)
    configure_render(scene, args)

    print(f"[hello-render] blender      : {bpy.app.version_string}")
    print(f"[hello-render] python       : {sys.version.split()[0]}")
    print(f"[hello-render] pano api     : {pano_api}")
    print(f"[hello-render] backend      : {backend} ({device_note})")
    print(f"[hello-render] devices      : {device_names}")
    print(f"[hello-render] resolution   : {args.width}x{args.height} @ {args.samples} samples, seed {args.seed}")

    t0 = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    wall = time.perf_counter() - t0

    png = HERE / "hello.png"
    if not png.exists():
        cands = sorted(HERE.glob("hello*.png"))
        raise RuntimeError(f"hello.png missing after render; found {[c.name for c in cands]}")
    shot = bpy.data.images.load(str(png))
    png_size = [shot.size[0], shot.size[1]]

    exr = settle_depth_file(scene)
    depth = depth_stats_and_preview(exr, args.width, args.height)

    ok_png = png_size == [args.width, args.height]
    ok_ratio = png_size[0] == png_size[1] * 2
    ok_depth_metres = depth["nadir_error_pct"] < 1.0

    record = {
        "probe": "T01 hello-render",
        "date": time.strftime("%Y-%m-%d"),
        "blender": bpy.app.version_string,
        "blender_hash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else str(bpy.app.build_hash),
        "python": sys.version.split()[0],
        "panorama_api": pano_api,
        "backend": backend,
        "devices": device_names,
        "device_note": device_note,
        "resolution": png_size,
        "samples": args.samples,
        "seed": args.seed,
        "denoise": bool(args.denoise),
        "wall_clock_s": round(wall, 3),
        "outputs": {
            "pano_png": png.name,
            "pano_bytes": png.stat().st_size,
            "depth_exr": exr.name,
            "depth_exr_bytes": exr.stat().st_size,
        },
        "depth": depth,
        "checks": {
            "png_is_requested_size": ok_png,
            "png_is_2to1_equirect": ok_ratio,
            "depth_is_metres_at_nadir": ok_depth_metres,
        },
    }
    (HERE / "hello-render.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")

    print(f"[hello-render] wall clock   : {wall:.3f} s")
    print(f"[hello-render] pano         : {png.name} {png_size[0]}x{png_size[1]} ({png.stat().st_size} B)")
    print(f"[hello-render] depth        : {exr.name} min={depth['min_m']} m max={depth['max_m']} m "
          f"nadir={depth['nadir_m']} m (expected {CAM_HEIGHT_M}, err {depth['nadir_error_pct']}%)")
    print(f"[hello-render] checks       : {record['checks']}")

    if not (ok_png and ok_ratio and ok_depth_metres):
        raise SystemExit("[hello-render] FAILED one or more checks")
    print("[hello-render] OK")


if __name__ == "__main__":
    main()

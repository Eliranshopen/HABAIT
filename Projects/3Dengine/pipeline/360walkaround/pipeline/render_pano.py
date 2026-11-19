#!/usr/bin/env python
"""
render_pano.py — the V2 render stage: one .blend + camera points -> equirect panos + their depth.

Board `360-v2` T04 (v0.1.0) + T07 (v0.2.0) · render-pipeline-engineer · Blender 4.5.10 LTS ·
CONTRACT §16.5 (C-360-82/83).

WHAT T07 ADDED (v0.2.0), in one place so a reader does not have to diff:
  1. ⭐ **THE WRAP PAD** (`--wrap-pad N`, default 128) — the fix for F-360-118. An equirectangular
     frame wraps left<->right, but OpenImageDenoise and the WebP encoder are both 2-D operators that
     do NOT know that: at columns 0 and W-1 their neighbourhood is truncated, so they smooth the
     interior harder than the two edge columns and the wrap-column discontinuity survives as
     *denoiser residue*. The fix is to give them the missing neighbourhood: render
     `W + 2N` columns over `360 * (W+2N)/W` degrees of longitude — i.e. N columns of REAL azimuthal
     overlap on each side — denoise the wide frame, then CROP the pad off in the compositor so the
     written file is exactly W x H on exactly the same angular grid as an unpadded render.
     ⭐ The pad angle is `N * 360/W` degrees, which makes the surviving columns' pixel centres
     *identical* to the unpadded ones: azimuth(col) = -180 + (col+0.5)*360/W either way. Proven by
     rendering the same point with and without the pad and differencing the DEPTH maps (deterministic
     geometry, so a one-pixel misalignment is loud) — see `--wrap-pad-selftest`.
  2. **Batch mode** (`--points a,b,c` + `--out-root`) — every point in ONE Blender process, so the
     scene sync is paid once, each point keeping its own skip check, sidecar and manifest row (so a
     crash mid-batch resumes losslessly).
  3. **The top view** (`--top-view`) — one orthographic straight-down render of the whole floor plus a
     flat-colour room-id mask on the SAME grid and a registration sidecar (T08's minimap).
  4. `build_check_set()`'s log labels are no longer hardcoded to `r-living` (T06 gotcha), the room
     checks are skipped for a non-rectangular room instead of being wrong, and `--check-mode report`
     records the numbers without failing the batch.

WHAT v0.3.0 ADDED (2026-10-28, WALKAROUND-QUALITY Q01b/Q02, ruling OQ-G4):
  5. A camera in an UNROOFED outdoor room (`rooms[].is_outdoor` and not `roofed`) looks straight up at the
     sky, so the zenith-hole verdict is waived for it and logged as a NOTE; a roofed one (the deck above a
     tower terrace) keeps the bar, like every indoor point.
  6. The top view reads `walls[].rect_cm`, so a GENERAL plan (`geometry: "general"`) skips it with a NOTE.
     (Both edits re-key every existing render: this file's sha256 is in the input key, by law.)

WHAT IT PRODUCES, per point (one camera point, one resolution):
  <out-dir>/<pano-name>     the equirectangular colour pano   (WEBP by default, PNG on request)
  <out-dir>/<depth-name>    the depth pass, SAME projection and SAME pixel grid, packed as
                            **metres x 100, big-endian 24-bit RGB, lossless PNG** — decode with
                            `(R<<16 | G<<8 | B) / 100  =>  metres`   (CONTRACT §16.5 / C-360-82)
  <out-dir>/<stem>.render.json   the per-point sidecar: settings, timings, VRAM, input hashes and
                            the RECORDED `depth_encoding` / `depth_scale` (C-360-83 — an unknown
                            encoding must make a decoder REFUSE, so the value always travels)
  <out-dir>/<stem>.render.log    Blender's own render log (Cycles' `Mem:…, Peak:…` lives here)
  <tour>/manifest.json      the checkpoint row for this point (rerun-skip keys on INPUT hashes)

DEPTH PACKING — the exact arithmetic, so a decoder never has to guess:
    cm  = round_half_even(metres * 100)            # 1 cm quantisation, the reference's precision=2
    cm  = clip(cm, 1, 16777215)                    # 24-bit range => 0.01 m … 167772.15 m
    R   = (cm >> 16) & 0xFF                        # big-endian: R is the MOST significant byte
    G   = (cm >>  8) & 0xFF
    B   =  cm        & 0xFF
    invalid (sky/background/non-finite)  ->  R=G=B=0
  ⚠ 0 therefore means NO SURFACE, not "zero metres" — the sidecar records this as
    `depth_invalid_value: 0`. A decoder must test for 0 before using a reading.
  The PNG is written by this file's own encoder (colour type 2, 8-bit, filter Sub, zlib level 6) so
  that no colour management can ever touch a depth byte. Blender's own libpng reads it back as part
  of the self-check, which is what proves the file is spec-valid.

DEPTH GEOMETRY (measured in T01, ENV.md §4.1 — do not re-derive):
  * the Cycles Z pass under a PANO camera is the RADIAL distance from the camera origin along each
    ray, in metres. No conversion. `point = origin + dir * depth`.
  * rows: `lat = -90 + (row + 0.5)/H * 180`, **row 0 = BOTTOM = nadir** in Blender's pixel buffer.
    A PNG's first scanline is the TOP row, so this file flips vertically on write — the nadir/zenith
    pair in the self-check is what catches a flip.
  * columns: u = (col + 0.5)/W ; u = 0.5 is the camera's forward direction, u increases toward the
    camera's RIGHT (= forward x up). With the pinned yaw convention (ENV.md §9) forward is
    `(sin yaw, cos yaw, 0)` in world axes.

INVOCATION (Blender is not on PATH — ENV.md §2):
    PYTHONIOENCODING=utf-8 "/c/Program Files/Blender Foundation/Blender 4.5/blender.exe" \
      -b --factory-startup -P 360walkaround/pipeline/render_pano.py -- \
      --blend 360walkaround/tours/pilot-karnei/scene-probe.blend \
      --out-dir 360walkaround/tours/pilot-karnei/renders/probe \
      --res 8192x4096 --samples 256 --pano-name pano-8k.webp --depth-name depth.png --depth-check

⛔ EXIT CODES (measured, ENV.md §8): an uncaught exception under `blender -b -P` still exits 0.
   The footer of this file converts any crash into `sys.exit(1)`, and every caller must ALSO assert
   the output files exist — exit 0 is necessary, not sufficient.
"""

import argparse
import hashlib
import json
import math
import os
import platform
import re
import struct
import sys
import time
import zlib
from pathlib import Path

import bpy
import numpy as np

VERSION = "0.3.0"

# ---- the wrap pad (T07, F-360-118) -------------------------------------------------------------
# ⭐ MEASURED (T07, 4096x2048 @ 64 spp, cp-living, the SAME instrument T05 used — one call of
# `server/seam.mjs::boundaryDiscontinuity` per column). Wrap-column MAD against the interior median,
# lossless PNG (the denoiser's own contribution, no encoder in the way):
#     pad   0 -> 2.174 (2.35x)   pad 128 -> 1.577 (1.70x)
#     pad 256 -> 1.523 (1.64x)   pad 512 -> 1.431 (1.55x)
# and on the SHIPPED WebP q90 encode: 3.50x / 3.02x / 3.01x / **2.87x**. 512 is the smallest pad that
# clears T05's 3x bar at the shipped encode, so it is the default; the knee is at 128 (80 % of the
# whole 0->512 gain for a quarter of the extra pixels), which is the setting to fall back to if a
# render budget ever bites. The cost is pure pixels: (W + 2*pad)/W = +12.5 % at 8192 wide.
WRAP_PAD_DEFAULT = 512          # columns of real azimuthal overlap rendered on EACH side, then cropped

# ---- the top view (T07) --------------------------------------------------------------------------
TOPVIEW_PX_PER_M_DEFAULT = 80.0
TOPVIEW_MARGIN_CM_DEFAULT = 30.0
TOPVIEW_CAM_ABOVE_CEILING_M = 5.0
# A fixed, deterministic palette: room i gets PALETTE[i % len]. (0,0,0) is RESERVED for "no room"
# (walls, thresholds, outside), so the mask decodes with one rule and never guesses.
ROOM_MASK_PALETTE = [
    (230, 25, 75), (60, 180, 75), (255, 225, 25), (0, 130, 200), (245, 130, 48),
    (145, 30, 180), (70, 240, 240), (240, 50, 230), (210, 245, 60), (250, 190, 212),
    (0, 128, 128), (220, 190, 255), (170, 110, 40), (255, 250, 200), (128, 0, 0),
    (170, 255, 195), (128, 128, 0), (255, 215, 180), (0, 0, 128), (128, 128, 128),
    (255, 255, 255), (100, 200, 150), (200, 100, 50), (50, 100, 200),
]

# ---- the depth contract, as constants so the packer and the sidecar cannot disagree -------------
DEPTH_ENCODING = "rgb24-be"     # CONTRACT §16.5 / C-360-82
DEPTH_SCALE = 100               # units per metre => centimetres
DEPTH_MAX_UNITS = (1 << 24) - 1
DEPTH_INVALID = 0               # R=G=B=0 means "no surface here"
SKY_SENTINEL_M = 1.0e7          # Cycles returns ~1e10 for a ray that escapes (ENV.md §7)

# ---- build_scene.py constants this file needs for the analytic depth check ----------------------
GLASS_THICK_CM = 0.8            # build_scene.GLASS_THICK_CM — pane centred on the wall's mid-plane
CAM_DEFAULT_Z_CM = 140.0


# ================================================================================== args
def parse_args(argv):
    p = argparse.ArgumentParser(prog="render_pano.py", description="equirect pano + packed depth")
    p.add_argument("--blend", required=True, help="the scene .blend to render")
    p.add_argument("--out-dir", default=None, help="output directory (default <blend dir>/renders/<point>)")
    p.add_argument("--plan", default=None, help="plan.json (needed for --point and --depth-check)")
    p.add_argument("--point", default=None, help="camera_points[].id to render from (default: the .blend's camera)")
    p.add_argument("--points", default=None,
                   help="comma-separated camera_points[].id list — ONE Blender process for all of them; "
                        "each point writes into <out-root>/<id>/ with its own skip check + manifest row")
    p.add_argument("--out-root", default=None,
                   help="parent directory for --points (default <tour>/renders)")
    p.add_argument("--res", default="8192x4096", help="WxH, must be 2:1")
    p.add_argument("--wrap-pad", type=int, default=WRAP_PAD_DEFAULT,
                   help="columns of azimuthal OVERLAP rendered on each side and cropped off (F-360-118's "
                        "fix; 0 = the v0.1.0 behaviour). The written file is always exactly --res")
    p.add_argument("--wrap-pad-selftest", action="store_true",
                   help="also render the SAME point with --wrap-pad 0 and difference the two depth maps "
                        "(the alignment oracle: depth is deterministic geometry, a 1-px shift is loud)")
    p.add_argument("--samples", type=int, default=256)
    p.add_argument("--adaptive", default="on", choices=["on", "off"])
    p.add_argument("--adaptive-threshold", type=float, default=0.01)
    p.add_argument("--denoise", default="on", choices=["on", "off"])
    p.add_argument("--denoise-device", default="cpu", choices=["cpu", "gpu"])
    p.add_argument("--device", default="AUTO", choices=["AUTO", "OPTIX", "CUDA", "CPU"])
    p.add_argument("--hybrid", action="store_true", help="enable the CPU alongside the GPU (measured SLOWER, ENV.md §4.2)")
    p.add_argument("--tile-size", type=int, default=0, help="0 = leave Blender's default (2048)")
    p.add_argument("--texture-limit", default="OFF",
                   choices=["OFF", "128", "256", "512", "1024", "2048", "4096", "8192"])
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--pano-name", default="pano.webp")
    p.add_argument("--also-png", action="store_true", help="write the PNG master beside the WebP")
    p.add_argument("--webp-quality", type=int, default=90)
    p.add_argument("--depth-name", default="depth.png")
    p.add_argument("--depth", default="on", choices=["on", "off"])
    p.add_argument("--keep-exr", action="store_true", help="keep the intermediate 32-bit depth EXR")
    p.add_argument("--depth-check", action="store_true", help="run the analytic depth check (needs --plan)")
    p.add_argument("--check-mode", default="assert", choices=["assert", "report"],
                   help="assert = a failed analytic check exits 1; report = record the numbers only "
                        "(a batch must not be aborted by a check whose ray met a lamp)")
    p.add_argument("--check-tolerance-cm", type=float, default=2.0)
    # ---- the top view (minimap substrate, T07 step 3) -------------------------------------------
    p.add_argument("--top-view", action="store_true",
                   help="render the orthographic straight-down floor view + the room-id mask + the "
                        "registration sidecar (needs --plan)")
    p.add_argument("--top-view-only", action="store_true", help="render ONLY the top view, no panos")
    p.add_argument("--top-view-px-per-m", type=float, default=TOPVIEW_PX_PER_M_DEFAULT)
    p.add_argument("--top-view-margin-cm", type=float, default=TOPVIEW_MARGIN_CM_DEFAULT)
    p.add_argument("--top-view-samples", type=int, default=64)
    p.add_argument("--top-view-name", default="topview.png")
    p.add_argument("--top-view-mask-name", default="topview-roomids.png")
    p.add_argument("--top-view-depth-name", default="topview-depth.png")
    p.add_argument("--repeat", type=int, default=1, help="render N times in-process (cold vs warm)")
    p.add_argument("--manifest", default=None, help="manifest.json to checkpoint into (default <tour>/manifest.json)")
    p.add_argument("--manifest-key", default=None, help="the point key in the manifest (default: the point id)")
    p.add_argument("--skip-if-clean", action="store_true",
                   help="skip the render when the manifest already has this input key AND the outputs exist")
    p.add_argument("--no-capture", action="store_true", help="do not redirect the render log to a file")
    a = p.parse_args(argv)
    w, _, h = a.res.partition("x")
    a.width, a.height = int(w), int(h)
    return a


# ================================================================================ device
def select_device(scene, preference, hybrid):
    """Enable a Cycles compute backend. Returns (backend, [device names], note).

    Copied from probe/hello-render.py (T01, the reference implementation). GOTCHA: `prefs.devices`
    is the UNION of every backend's entries regardless of `compute_device_type` — the same A2000
    appears as both 'CUDA' and 'OPTIX' and the CPU is always listed. Filter by `d.type == backend`;
    enumerating the list proves nothing about which backend is active (the render LOG does).
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
        return backend, [d.name for d in gpus], ("GPU+CPU hybrid" if hybrid else "GPU only")

    scene.cycles.device = "CPU"
    return "CPU", [], "no GPU backend available -- fell back to CPU"


# ================================================================================= scene
def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_plan(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def point_camera(scene, plan, point_id):
    """Re-point the scene camera at a plan camera point, using the PINNED frame (ENV.md §9):
       world = (+x/100, -y/100, +z/100); euler XYZ = (90deg, 0, -yaw)."""
    pt = next((p for p in plan["camera_points"] if p["id"] == point_id), None)
    if pt is None:
        raise RuntimeError(f"camera point '{point_id}' is not in the plan")
    cam = scene.camera
    if cam is None:
        raise RuntimeError("the .blend has no scene camera to re-point")
    cam.location = (pt["x"] / 100.0, -pt["y"] / 100.0, pt["z"] / 100.0)
    cam.rotation_mode = "XYZ"
    cam.rotation_euler = (math.radians(90.0), 0.0, math.radians(-float(pt["yaw_deg"])))
    return pt


def ensure_equirect(cam_data, longitude_scale=1.0):
    """Blender 4.3 moved the panorama settings onto the Camera datablock (ENV.md §7).

    `longitude_scale` > 1 widens the rendered azimuth range symmetrically — THE WRAP PAD (T07):
    a frame `W + 2N` px wide covering `360 * (W+2N)/W` degrees keeps the SAME degrees-per-pixel, so
    the middle W columns land on exactly the unpadded angular grid and the extra N columns on each
    side are a real, rendered duplicate of the opposite edge's content. The latitude range is left
    alone — a pano is only cyclic in azimuth.
    """
    cam_data.type = "PANO"
    span = math.pi * float(longitude_scale)
    holder, api = None, None
    if hasattr(cam_data, "panorama_type"):
        cam_data.panorama_type = "EQUIRECTANGULAR"
        holder, api = cam_data, "camera.panorama_type (4.3+)"
    elif hasattr(cam_data, "cycles"):
        cam_data.cycles.panorama_type = "EQUIRECTANGULAR"
        holder, api = cam_data.cycles, "camera.cycles.panorama_type (<=4.2)"
    else:
        raise RuntimeError("no equirectangular panorama API on this Blender build")
    # set the range EXPLICITLY even at scale 1.0 — a .blend that carries a stale range would
    # otherwise silently render a partial panorama (determinism, rail 1).
    if not hasattr(holder, "longitude_min"):
        if longitude_scale != 1.0:
            raise RuntimeError("this Blender build exposes no longitude_min/max — the wrap pad "
                               "cannot be rendered; re-run with --wrap-pad 0")
        return api, None
    holder.longitude_min = -span
    holder.longitude_max = span
    holder.latitude_min = -math.pi / 2.0
    holder.latitude_max = math.pi / 2.0
    return api, {"longitude_min_deg": round(math.degrees(-span), 6),
                 "longitude_max_deg": round(math.degrees(span), 6),
                 "latitude_deg": [-90.0, 90.0]}


def add_crop(tree, pad, width, height):
    """The wrap-pad crop: keep columns [pad, pad+width) of a (width + 2*pad) frame, all rows.

    Two MEASURED gotchas (Blender 4.5.10, both cost a run):
      ⛔ the max is EXCLUSIVE — the node's output is `max_x - min_x` wide, so cropping W columns needs
         `max_x = min_x + W`, not `min_x + W - 1` (setting the inclusive form produced 1023 px).
      ⛔⭐ the Y pair is INVERTED relative to the X pair, and two of the four setters MOVE the window
         instead of resizing it. Measured on a fresh node — whose defaults are
         `min_x=0 max_x=1920 min_y=1080 max_y=0`, i.e. **min_y > max_y by design**:
             width  = max_x - min_x        (min_x = left, max_x = right)
             height = **min_y - max_y**    (min_y = the far edge, max_y = the near one)
             `min_x = 64`  ⇒ max_x 1088 -> **1152**   (a TRANSLATION: width preserved)
             `max_y = 512` ⇒ min_y 1080 -> **1592**   (a TRANSLATION: height preserved)
             `max_x` and `min_y` are the RESIZE setters (the other edge stays put)
         So the landing order is **position first, size second, per axis**: `min_x` then `max_x`;
         `max_y` then `min_y`. Getting the Y pair the "obvious" way round (`min_y=0, max_y=H`) reads
         back correctly through RNA and still renders a **1-pixel-tall** buffer — twice, here, until
         `pack_depth`'s size assertion named it. ⭐ *The RNA read-back is not the crop.*
    The pano and the depth pass are cropped by two identical nodes rather than by one numpy slice
    each: one definition, no chance of the colour and the depth disagreeing by a pixel.
    """
    crop = tree.nodes.new("CompositorNodeCrop")
    crop.use_crop_size = True
    crop.relative = False
    crop.min_x = pad              # position…
    crop.max_x = pad + width      # …then size
    crop.max_y = 0                # position…
    crop.min_y = height           # …then size (min_y is the FAR edge — see the gotcha above)
    if (crop.max_x - crop.min_x, crop.min_y - crop.max_y) != (width, height):
        raise RuntimeError(
            f"the Crop node did not accept the window: got x[{crop.min_x},{crop.max_x}) "
            f"y[{crop.max_y},{crop.min_y}), wanted {width}x{height} — see this function's gotchas")
    return crop


def configure_render(scene, args, out_dir, stem, pad=0, pano_name=None, depth_name=None,
                     samples=None, width=None, height=None):
    """Wire the scene for ONE frame. Returns an output plan dict.

    With `pad` > 0 the frame is rendered `width + 2*pad` wide and EVERY output goes through a Crop
    node into a File Output node — the main `render.filepath` path is not used at all
    (`write_still=False`), because the Composite result is forced to the scene's own resolution and
    would therefore be written padded.
    """
    width = width or args.width
    height = height or args.height
    pano_name = pano_name or args.pano_name
    depth_name = depth_name or args.depth_name
    samples = args.samples if samples is None else samples
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = (args.adaptive == "on")
    scene.cycles.adaptive_threshold = args.adaptive_threshold
    scene.cycles.use_denoising = (args.denoise == "on")
    if args.denoise == "on":
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
        scene.cycles.denoising_use_gpu = (args.denoise_device == "gpu")
    scene.cycles.seed = args.seed
    scene.cycles.use_animated_seed = False
    scene.cycles.texture_limit_render = args.texture_limit
    if args.tile_size:
        scene.cycles.use_auto_tile = True
        scene.cycles.tile_size = args.tile_size

    scene.render.resolution_x = width + 2 * pad
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.use_file_extension = False

    pano_ext = Path(pano_name).suffix.lower()
    want_webp = pano_ext == ".webp"
    png_path = out_dir / (Path(pano_name).stem + ".png")
    want_png_master = want_webp and args.also_png

    def png_settings(im):
        im.file_format = "PNG"
        im.color_mode = "RGB"
        im.color_depth = "8"
        im.compression = 15

    def webp_settings(im):
        im.file_format = "WEBP"
        im.color_mode = "RGB"
        im.quality = args.webp_quality

    scene.view_layers[0].use_pass_z = (args.depth == "on")
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()
    rl = tree.nodes.new("CompositorNodeRLayers")
    comp = tree.nodes.new("CompositorNodeComposite")
    img_src = rl.outputs["Image"]
    depth_src = rl.outputs["Depth"]
    if pad:
        c_img = add_crop(tree, pad, width, height)
        tree.links.new(img_src, c_img.inputs["Image"])
        img_src = c_img.outputs["Image"]
        if args.depth == "on":
            c_depth = add_crop(tree, pad, width, height)
            tree.links.new(depth_src, c_depth.inputs["Image"])
            depth_src = c_depth.outputs["Image"]
    tree.links.new(img_src, comp.inputs["Image"])

    def file_output(fmt_fn, prefix):
        fo = tree.nodes.new("CompositorNodeOutputFile")
        fo.base_path = str(out_dir)
        fmt_fn(fo.format)
        fo.file_slots[0].path = prefix
        return fo

    plan = {"pad": pad, "width": width, "height": height, "write_still": not pad,
            "pano": {"path": out_dir / pano_name, "prefix": None,
                     "ext": pano_ext, "via": "composite"},
            "png_master": None, "depth": None}

    if pad:
        # every output through a File Output node — it writes the buffer it is GIVEN (the cropped
        # one), while the Composite result is forced back to the scene resolution.
        pref = f"{stem}-pano-"
        tree.links.new(img_src, file_output(webp_settings if want_webp else png_settings, pref).inputs[0])
        plan["pano"] = {"path": out_dir / pano_name, "prefix": pref, "ext": pano_ext, "via": "file_output"}
        if want_png_master:
            pref2 = f"{stem}-master-"
            tree.links.new(img_src, file_output(png_settings, pref2).inputs[0])
            plan["png_master"] = {"path": png_path, "prefix": pref2, "ext": ".png", "via": "file_output"}
    else:
        # the v0.1.0 path, unchanged: the main render writes the pano (or the PNG master, with a
        # second File Output node adding the WebP from the same render).
        if want_webp and not want_png_master:
            webp_settings(scene.render.image_settings)
            scene.render.filepath = str(out_dir / pano_name)
        elif want_png_master:
            png_settings(scene.render.image_settings)
            scene.render.filepath = str(png_path)
            plan["png_master"] = {"path": png_path, "prefix": None, "ext": ".png", "via": "composite"}
            pref = f"{stem}-webp-"
            tree.links.new(img_src, file_output(webp_settings, pref).inputs[0])
            plan["pano"] = {"path": out_dir / pano_name, "prefix": pref, "ext": ".webp",
                            "via": "file_output"}
        else:
            png_settings(scene.render.image_settings)
            scene.render.filepath = str(out_dir / pano_name)

    if args.depth == "on":
        def exr_settings(im):
            im.file_format = "OPEN_EXR"
            im.color_mode = "BW"
            im.color_depth = "32"
            im.exr_codec = "ZIP"
        pref = f"{stem}-depth-"
        tree.links.new(depth_src, file_output(exr_settings, pref).inputs[0])
        plan["depth"] = {"path": out_dir / f"{stem}-depth.exr", "prefix": pref, "ext": ".exr",
                         "packed": out_dir / depth_name}
    return plan


def settle(out_dir, prefix, frame, ext, final_name):
    """The File Output node stamps a frame number (ENV.md §7); give it the stable name.

    ⚠ MEASURED (T04): `scene.render.use_file_extension = False` suppresses the extension on
    **File Output nodes too**, not just on the main render path — the node then writes
    `<prefix>0001` with no suffix at all. Look for both spellings."""
    final = out_dir / final_name
    for stamped in (out_dir / f"{prefix}{frame:04d}{ext}", out_dir / f"{prefix}{frame:04d}"):
        if stamped.exists():
            if final.exists():
                final.unlink()
            stamped.rename(final)
            break
    if not final.exists():
        raise RuntimeError(f"expected output missing: no {prefix}{frame:04d}[{ext}] and no {final.name}")
    return final


# ============================================================================== log capture
class CaptureFD:
    """Redirect the C-level stdout/stderr (which is where Cycles prints `Mem:…, Peak:…`) into a
    file for the duration of the render, then restore. Python-level prints are redirected too."""

    def __init__(self, path, enabled=True):
        self.path, self.enabled, self.saved = path, enabled, None

    def __enter__(self):
        if not self.enabled:
            return self
        sys.stdout.flush()
        sys.stderr.flush()
        self.f = open(self.path, "a", buffering=1, encoding="utf-8", errors="replace")
        self.saved = (os.dup(1), os.dup(2))
        os.dup2(self.f.fileno(), 1)
        os.dup2(self.f.fileno(), 2)
        return self

    def __exit__(self, *exc):
        if not self.enabled:
            return False
        try:
            sys.stdout.flush()
            sys.stderr.flush()
        except Exception:
            pass
        os.dup2(self.saved[0], 1)
        os.dup2(self.saved[1], 2)
        os.close(self.saved[0])
        os.close(self.saved[1])
        self.f.close()
        return False


RE_DEV_PEAK = re.compile(r"Mem:([\d.]+)M, Peak:([\d.]+)M")
RE_HOST_PEAK = re.compile(r"Mem:([\d.]+)M \(Peak ([\d.]+)M\)")
RE_TIME = re.compile(r"\| Time:(\d+):(\d+)\.(\d+)")
# ⚠ MEASURED (T04, 8K): the second `Mem:…, Peak:…` field is the DEVICE figure only while a render
# session is alive. Once Cycles reaches `Finishing` / `Compositing` the session is gone and the same
# slot reports HOST result buffers — an 8K frame logged `Peak:3524.18M` there while the true device
# peak throughout the eight tiles was 1369.48M. Taking a naive max over the log overstates VRAM by
# 2.6x. (T01 found the sibling trap: in a HYBRID run the peak is the host figure all along.)
POST_RENDER_PHASES = ("Finishing", "Compositing")


def parse_render_log(path):
    """Cycles' own accounting is the number of record — `nvidia-smi --query-compute-apps` returns
    [N/A] for Blender on this WDDM laptop GPU (ENV.md §5). VRAM is only measured GPU-only."""
    dev_peak = host_peak = post_peak = 0.0
    cycles_time = None
    if not Path(path).exists():
        return {"device_peak_mb": None, "host_peak_mb": None, "post_render_peak_mb": None,
                "cycles_time_s": None, "note": "no render log captured"}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            m = RE_DEV_PEAK.search(line)
            if m:
                if any(p in line for p in POST_RENDER_PHASES):
                    post_peak = max(post_peak, float(m.group(2)))
                else:
                    dev_peak = max(dev_peak, float(m.group(2)))
            m = RE_HOST_PEAK.search(line)
            if m:
                host_peak = max(host_peak, float(m.group(2)))
            m = RE_TIME.search(line)
            if m:
                cycles_time = int(m.group(1)) * 60 + int(m.group(2)) + int(m.group(3)) / 100.0
    return {
        "device_peak_mb": round(dev_peak, 2) if dev_peak else None,
        "host_peak_mb": round(host_peak, 2) if host_peak else None,
        "post_render_peak_mb": round(post_peak, 2) if post_peak else None,
        "cycles_time_s": cycles_time,
        "note": ("device_peak_mb = Cycles' `Mem:…, Peak:…` during the render phases only; "
                 "post_render_peak_mb is the same field during Finishing/Compositing, where it "
                 "reports HOST buffers, not VRAM; host_peak_mb is Blender's own `(Peak …)`"),
    }


# ================================================================================== PNG
def write_png_rgb8(path, rgb, level=6):
    """Minimal, dependency-free 8-bit RGB PNG writer (colour type 2, filter Sub).

    Hand-rolled on purpose: the depth bytes must not pass through ANY colour-managed encoder.
    Row 0 of `rgb` is the TOP scanline (PNG order) — the caller does the vertical flip.
    """
    h, w, c = rgb.shape
    assert c == 3 and rgb.dtype == np.uint8
    raw = np.ascontiguousarray(rgb).reshape(h, w * 3)
    prev = np.zeros_like(raw)
    prev[:, 3:] = raw[:, :-3]
    filtered = ((raw.astype(np.uint16) - prev.astype(np.uint16)) & 0xFF).astype(np.uint8)
    lines = np.concatenate([np.full((h, 1), 1, np.uint8), filtered], axis=1)  # 1 = Sub filter
    idat = zlib.compress(lines.tobytes(), level)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))
    return Path(path).stat().st_size


def load_image_array(path, non_color=False):
    """Read an image back through Blender's own loaders (libpng / libwebp) — an INDEPENDENT decoder
    from this file's writer, which is what makes the round-trip check meaningful.
    Returns (H, W, channels) float32, row 0 = BOTTOM (Blender's buffer order)."""
    img = bpy.data.images.load(str(path))
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    ch = img.channels
    buf = np.empty(w * h * ch, dtype=np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    return buf.reshape(h, w, ch)


# ================================================================================ depth pack
def pack_depth(exr_path, png_path, width, height):
    """EXR (radial metres, row 0 = bottom) -> packed 24-bit RGB PNG (row 0 = top)."""
    t0 = time.perf_counter()
    img = bpy.data.images.load(str(exr_path))
    img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    ch = img.channels
    if (w, h) != (width, height):
        raise RuntimeError(f"depth EXR is {w}x{h}, expected {width}x{height}")
    buf = np.empty(w * h * ch, dtype=np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    depth = buf.reshape(h, w, ch)[:, :, 0]           # row 0 = BOTTOM
    del buf

    finite = np.isfinite(depth) & (depth > 0.0) & (depth < SKY_SENTINEL_M)
    units = np.zeros((h, w), dtype=np.int32)
    vals = np.rint(depth[finite].astype(np.float64) * DEPTH_SCALE)   # round-half-to-even -> cm
    clipped_hi = int(np.count_nonzero(vals > DEPTH_MAX_UNITS))
    clipped_lo = int(np.count_nonzero(vals < 1))
    units[finite] = np.clip(vals, 1, DEPTH_MAX_UNITS).astype(np.int32)
    del vals

    rgb = np.empty((h, w, 3), dtype=np.uint8)
    rgb[:, :, 0] = ((units >> 16) & 0xFF).astype(np.uint8)
    rgb[:, :, 1] = ((units >> 8) & 0xFF).astype(np.uint8)
    rgb[:, :, 2] = (units & 0xFF).astype(np.uint8)
    rgb_png = rgb[::-1, :, :]                        # flip: PNG scanline 0 is the TOP row
    size = write_png_rgb8(png_path, rgb_png)
    pack_s = time.perf_counter() - t0

    valid = depth[finite]
    stats = {
        "png_bytes": size,
        "pack_seconds": round(pack_s, 3),
        "pixels": int(w * h),
        "valid_pixels": int(finite.sum()),
        "sky_pixels": int((~finite).sum()),
        "min_m": float(np.min(valid)) if valid.size else None,
        "max_m": float(np.max(valid)) if valid.size else None,
        "clipped_above_24bit": clipped_hi,
        "clipped_below_1cm": clipped_lo,
        "packed_data_sha256": hashlib.sha256(rgb.tobytes()).hexdigest(),
    }
    return depth, rgb, stats


def decode_pixel(rgb_bottom_up, row, col):
    """The reference decode at ONE pixel: (R<<16|G<<8|B)/100 => metres. Deliberately per-pixel —
    a whole-frame int64 decode of an 8K map costs ~800 MB for five readings."""
    r, g, b = (int(v) for v in rgb_bottom_up[row, col])
    units = (r << 16) | (g << 8) | b
    return units / float(DEPTH_SCALE), units


# ============================================================================== depth check
def dir_for_pixel(col, row, width, height, forward, right):
    """The world direction of a pixel centre. lat = -90 + (row+0.5)/H*180 (row 0 = BOTTOM);
    u = (col+0.5)/W, u=0.5 = forward, u increasing toward `right`."""
    lat = math.radians(-90.0 + (row + 0.5) / height * 180.0)
    az = ((col + 0.5) / width - 0.5) * 2.0 * math.pi
    hor = math.cos(lat)
    return (
        hor * (math.cos(az) * forward[0] + math.sin(az) * right[0]),
        hor * (math.cos(az) * forward[1] + math.sin(az) * right[1]),
        math.sin(lat),
    )


def pixel_for_dir(az_deg, lat_deg, width, height):
    """Nearest pixel centre to a (azimuth-from-forward, latitude) direction."""
    col = int(round((az_deg / 360.0 + 0.5) * width - 0.5)) % width
    row = int(round(((lat_deg + 90.0) / 180.0) * height - 0.5))
    row = max(0, min(height - 1, row))
    return col, row


def build_check_set(plan, point, width, height):
    """Analytic ground truth from plan.json + build_scene.py's own constants.

    Each check names the plane it expects to hit and the perpendicular distance to it; the expected
    RADIAL distance is `perp / |dir . n|`. Universal checks (floor, ceiling) work for any room; the
    room-specific wall/glass checks are added when the geometry is available in the plan.
    """
    room = next((r for r in plan["rooms"] if r["id"] == point["room_id"]), None)
    ceiling_cm = float(plan["plan_meta"]["ceiling_height_cm"])
    cx, cy, cz = float(point["x"]), float(point["y"]), float(point["z"])
    yaw = math.radians(float(point["yaw_deg"]))
    forward = (math.sin(yaw), math.cos(yaw), 0.0)                    # ENV.md §9
    right = (forward[1] * 1.0 - 0.0, 0.0 - forward[0] * 1.0, 0.0)    # forward x up = (fy, -fx, 0)

    checks = []

    def add(name, az, lat, normal, perp_cm, surface, note=""):
        col, row = pixel_for_dir(az, lat, width, height)
        d = dir_for_pixel(col, row, width, height, forward, right)
        denom = abs(d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2])
        if denom < 1e-9:
            return
        checks.append({
            "name": name, "surface": surface, "note": note,
            "azimuth_from_forward_deg": round(az, 4), "latitude_deg": round(lat, 4),
            "col": col, "row_from_bottom": row,
            "dir_world": [round(v, 8) for v in d],
            "expected_m": round((perp_cm / 100.0) / denom, 6),
        })

    rid = point.get("room_id") or "?"

    # --- universal: the floor under the camera and the ceiling above it -------------------------
    add("nadir (floor)", 0.0, -90.0, (0.0, 0.0, 1.0), cz, f"{rid} floor z=0",
        "the single number that proves metres AND the row order")
    add("zenith (ceiling)", 0.0, +90.0, (0.0, 0.0, 1.0), ceiling_cm - cz,
        f"{rid} ceiling z={ceiling_cm:g} cm",
        "⚠ a pendant/emitter hanging over THIS point would read short — see --check-mode report")

    if room is None:
        return checks, forward, right

    # ⚠ T06/T07: the four checks below assume the room's own loop IS its bbox. For an L-shaped or
    # notched room (the pilot has four: r-balcony-north, r-master-lobby, r-corridor, r-dining) a
    # bbox face is not a wall, so the "expected" distance would be an invented number and the check
    # would fail on correct geometry. Skip them rather than be confidently wrong.
    loop = [(round(float(a), 4), round(float(b), 4)) for a, b in room["loop"]]
    x0, y0, x1, y1 = room["bbox_cm"]              # interior faces of the room's clear box
    rect_corners = {(round(x0, 4), round(y0, 4)), (round(x1, 4), round(y0, 4)),
                    (round(x1, 4), round(y1, 4)), (round(x0, 4), round(y1, 4))}
    if len(loop) != 4 or set(loop) != rect_corners:
        checks.append({"name": f"room {rid} is not rectangular — the 4 wall checks are SKIPPED",
                       "surface": "n/a", "note": "a bbox face is not a wall on a non-rectangular loop",
                       "skipped": True})
        return checks, forward, right

    # --- room-specific: the four interior faces of this rectangular room ------------------------
    # plan bearings: 0 = plan-north (-y), 90 = plan-east (+x), clockwise. Azimuth from forward is
    # (bearing - yaw_deg), which is exactly the u-axis angle under the pinned convention.
    yaw_deg = float(point["yaw_deg"])

    def az_of(bearing_deg):
        return ((bearing_deg - yaw_deg + 180.0) % 360.0) - 180.0

    # ⚠ T06 gotcha, fixed here: these labels used to be hardcoded to r-living's own wall names
    # (`w-living-e interior face…`) while the NUMBERS were already generic — so a batch over other
    # rooms printed a truthful verdict under a false description. The surface is now named off the
    # room actually being checked.
    # ⚠ ALL FOUR assume an UNOBSTRUCTED ray to a bare wall face. A door or window on that bearing
    # lets the ray through to the next room (reads long), furniture stops it early (reads short) —
    # both are correct renders failing an over-simple expectation, which is why a batch runs these
    # with `--check-mode report`. The per-point bar that IS safe for every room is the nadir
    # (`render_tour.mjs` asserts it: floor distance == camera height, 12/12 at 0.00 cm).
    add("equator, plan-north face", az_of(0.0), 0.0, (0.0, 1.0, 0.0), cy - y0,
        f"{rid} interior face y={y0:g} cm", "⚠ an opening or furniture on this bearing is not a defect")
    add("equator, plan-east face", az_of(90.0), 0.0, (1.0, 0.0, 0.0), x1 - cx,
        f"{rid} interior face x={x1:g} cm", "")
    add("equator, plan-west face", az_of(270.0), 0.0, (1.0, 0.0, 0.0), cx - x0,
        f"{rid} interior face x={x0:g} cm", "")
    add("-30 deg down, plan-east face", az_of(90.0), -30.0, (1.0, 0.0, 0.0), x1 - cx,
        f"{rid} interior face x={x1:g} cm", "an off-equator ray: tests the radial conversion")
    add("+20 deg up, plan-east face", az_of(90.0), 20.0, (1.0, 0.0, 0.0), x1 - cx,
        f"{rid} interior face x={x1:g} cm", "an up-ray: clears floor furniture, below the ceiling")

    # --- the sliding door: the glass PANE, not the landscape -------------------------------------
    glaz = next((o for o in plan["openings"]
                 if o["kind"] in ("sliding_door", "window") and point["room_id"] in o.get("rooms", [])
                 and o["axis"] == "x"), None)
    if glaz is not None:
        wall = next(w for w in plan["walls"] if w["id"] == glaz["wall_id"])
        wx0, wy0, wx1, wy1 = wall["rect_cm"]
        mid = (wy0 + wy1) / 2.0
        pane_near = mid - GLASS_THICK_CM / 2.0          # build_scene: pane on the wall's mid-plane
        # due-south through the clear glass
        add("equator, sliding-door GLASS", az_of(180.0), 0.0, (0.0, 1.0, 0.0), pane_near - cy,
            f"GLASS_{glaz['id']} near face y={pane_near:g} cm",
            "the Z pass returns the PANE (correct for a ruler) — NOT the landscape behind it")
        # the aperture is NOT centred on the camera, so a symmetric pair of rays hits two different
        # surfaces — the check that would catch a mirrored azimuth axis.
        # ⭐ The handedness pair. The aperture (x 862…1099.4) is NOT centred on this camera
        # (x 990), so two mirror-image rays hit two DIFFERENT surfaces 12.7 cm apart — which is what
        # makes a flipped azimuth axis visible instead of self-cancelling. Plan bearings:
        # 180-θ = south-EAST (+x), 180+θ = south-WEST (-x).
        east_edge, west_edge = float(glaz["end_cm"]), float(glaz["start_cm"])
        wall_perp = wy0 - cy                                 # to the wall's interior face
        th_e = math.degrees(math.atan2(east_edge - cx, wall_perp))   # aperture edge, at the WALL face
        th_w = math.degrees(math.atan2(cx - west_edge, pane_near - cy))
        a_out = th_e + 4.0                                   # clears the aperture by ~13 cm
        a_in = th_w - 4.0                                    # clears the west frame stile by ~14 cm
        add("%.1f deg EAST of south -> wall beside the door" % a_out,
            az_of(180.0 - a_out), 0.0, (0.0, 1.0, 0.0), wall_perp,
            f"{wall['id']} interior face y={wy0:g} cm",
            "handedness probe: this ray misses the off-centre aperture and lands on masonry")
        add("%.1f deg WEST of south -> GLASS" % a_in,
            az_of(180.0 + a_in), 0.0, (0.0, 1.0, 0.0), pane_near - cy,
            f"GLASS_{glaz['id']} near face y={pane_near:g} cm",
            "handedness probe: the mirror ray passes through the aperture and stops on the pane")
    return checks, forward, right


def run_depth_check(checks, rgb_bottom_up, tol_cm):
    out, worst = [], 0.0
    for c in checks:
        if c.get("skipped"):
            out.append({**c, "pass": True})
            continue
        got, u = decode_pixel(rgb_bottom_up, c["row_from_bottom"], c["col"])
        err_cm = (got - c["expected_m"]) * 100.0
        ok = (u != DEPTH_INVALID) and abs(err_cm) <= tol_cm
        worst = max(worst, abs(err_cm))
        out.append({**c, "decoded_m": round(got, 4), "packed_units": u,
                    "error_cm": round(err_cm, 3), "pass": bool(ok)})
    return out, worst


# ============================================================================== assertions
def pole_row_stats(arr, rows=15):
    """`arr` is (H, W, C) float, row 0 = BOTTOM. Report the polar rows as NUMBERS, and assert only
    what is decisive.

    ⛔ T04 asserted `std > 0` on the polar rows ("a cap or a hole would make them constant"). T07
    measured that bar firing on **correct** renders: `cp-wc` and `cp-master-lobby` are windowless
    rooms whose coverage light hangs 15 cm under the ceiling at the same `deepest_point` the camera
    stands on, so the ceiling straight overhead is clipped to a uniform **255** — mean luma 255,
    `all_black` false, one unique colour. A flat evenly-lit ceiling is genuinely constant, and the
    same bar would have said nothing about a *grey* cap. ⭐ *An assertion that fires on correct work
    and stays silent on the defect it names is not a bar, it is a coin.* (T05's own
    `g0-seam-poles.mjs` had already written this down for the colour pano; this brings the render
    stage into line.)

    What replaces it: a HOLE is an all-black polar row here **and** an INVALID zenith/nadir pixel in
    the depth map (0 = no surface — the depth check in `main` owns that half, and it is the rigorous
    one: a hole cannot fake a finite distance).
    """
    lum = arr[:, :, 0] if arr.shape[2] == 1 else arr[:, :, :3].mean(axis=2)

    def side(idx):
        rws = [lum[i] for i in idx]
        blk = [bool(np.all(arr[i, :, :3] == 0.0)) for i in idx]
        return {"min_std": round(float(min(float(r.std()) for r in rws)), 6),
                "mean_luma_255": round(float(rws[0].mean()) * 255.0, 4),
                "unique_row0": int(np.unique(np.rint(arr[idx[0], :, :3] * 255.0)
                                             .astype(np.int32) @ np.array([65536, 256, 1])).size),
                "all_black_rows": int(sum(blk)), "any_all_black": bool(any(blk))}

    h = arr.shape[0]
    return {"zenith": side([h - 1 - r for r in range(rows)]),   # row H-1 = TOP of the image
            "nadir": side([r for r in range(rows)]),            # row 0 = BOTTOM (Blender buffer)
            "rows_examined": rows,
            "note": ("a polar row is one point of the sphere smeared across W px, so near-constant "
                     "is CORRECT; only an ALL-BLACK row (plus an invalid depth zenith/nadir) is a hole")}


# =============================================================== manifest + input key (T07)
def read_manifest(manifest_path, tour_dir):
    man = {"schema": "render-manifest/0.1.0", "tour_id": tour_dir.name, "points": {}}
    if Path(manifest_path).exists():
        with open(manifest_path, "r", encoding="utf-8") as f:
            man = json.load(f)
        man.setdefault("points", {})
    return man


def write_manifest_row(manifest_path, tour_dir, key, row, updated_utc):
    """Read-modify-write ONE row. Deliberately re-read per point so a crash mid-batch leaves every
    finished point checkpointed (rail 2: a rerun skips clean work, a crash costs one point)."""
    man = read_manifest(manifest_path, tour_dir)
    man["schema"] = "render-manifest/0.1.0"
    man["tour_id"] = tour_dir.name
    man["updated_utc"] = updated_utc
    man["depth_contract"] = {
        "encoding": DEPTH_ENCODING, "scale": DEPTH_SCALE,
        "decode": "(R<<16 | G<<8 | B) / 100 => metres (radial distance from the camera origin)",
        "invalid_value": DEPTH_INVALID}
    man["points"][key] = row
    with open(manifest_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(man, f, indent=2, ensure_ascii=False)
        f.write("\n")


def read_scene_meta(tour_dir, blend):
    scene_report = tour_dir / (blend.stem + ".report.json")
    if not scene_report.exists():
        return {}
    with open(scene_report, "r", encoding="utf-8") as f:
        r = json.load(f)
    return {"generator": r.get("generator", {}), "inputs": r.get("inputs", {})}


def make_input_key(args, scene_meta, subject, extra=None):
    """The rerun-skip key. ⛔ INPUTS ONLY (ENV.md §4.3 / T01's law): plan.json's hash and
    build_scene.py's version come in through `scene_meta`, the render settings and this script's own
    sha256 through `settings`. An OUTPUT hash would drift on every identical re-render and re-trigger
    an expensive render — the exact bug root CLAUDE.md §7 forbids."""
    settings = {
        "res": [args.width, args.height], "samples": args.samples,
        "adaptive": args.adaptive, "adaptive_threshold": args.adaptive_threshold,
        "denoise": args.denoise, "denoise_device": args.denoise_device,
        "device": args.device, "hybrid": bool(args.hybrid),
        "tile_size": args.tile_size, "texture_limit": args.texture_limit, "seed": args.seed,
        "pano": args.pano_name, "webp_quality": args.webp_quality, "depth": args.depth,
        "wrap_pad": int(args.wrap_pad),
        "script": VERSION, "script_sha256": sha256_file(__file__),
        "depth_encoding": DEPTH_ENCODING, "depth_scale": DEPTH_SCALE,
    }
    if extra:
        settings.update(extra)
    src = {"point": subject, "scene": scene_meta, "settings": settings}
    key = hashlib.sha256(
        json.dumps(src, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    return src, key, settings


def point_under_open_sky(plan, point):
    """v0.3.0: True when the point stands in an UNROOFED outdoor room -- its zenith is the sky by design."""
    if not plan or not point:
        return False
    room = next((r for r in plan.get("rooms", []) if r.get("id") == point.get("room_id")), None)
    return bool(room and room.get("is_outdoor") and not room.get("roofed"))


# ================================================================================== main
def render_one_point(scene, args, plan, point, tour_dir, blend, scene_meta, out_dir,
                     manifest_path, mkey, device_info):
    """Render ONE camera point into `out_dir`. Returns (exit_code, summary)."""
    backend, devices, device_note = device_info
    point_id = (point or {}).get("id") or "camera"
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(args.pano_name).stem
    log_path = out_dir / f"{stem}.render.log"
    sidecar_path = out_dir / f"{stem}.render.json"
    pano_final = out_dir / args.pano_name
    depth_final = out_dir / args.depth_name
    pad = max(0, int(args.wrap_pad))

    input_key_src, input_key, settings_for_key = make_input_key(args, scene_meta, point_id)

    if args.skip_if_clean:
        row = read_manifest(manifest_path, tour_dir).get("points", {}).get(mkey)
        if (row and row.get("input_key") == input_key and pano_final.exists()
                and (args.depth == "off" or depth_final.exists())):
            print(f"SKIP      {mkey}: manifest input_key matches and outputs exist")
            print(f"          {pano_final}")
            return 0, {"point": point_id, "status": "skipped", "pano": str(pano_final),
                       "input_key": input_key}

    if point is not None:
        point_camera(scene, plan, point_id)
    pano_api, lon_range = ensure_equirect(
        scene.camera.data, longitude_scale=(args.width + 2 * pad) / args.width)
    plan_out = configure_render(scene, args, out_dir, stem, pad=pad)

    print(f"[render_pano] v{VERSION}  blender {bpy.app.version_string}")
    print(f"[render_pano] blend      : {blend}")
    print(f"[render_pano] point      : {point_id}"
          + (f"  plan ({point['x']},{point['y']},{point['z']}) yaw {point['yaw_deg']}" if point else ""))
    print(f"[render_pano] camera     : {tuple(round(v, 4) for v in scene.camera.location)} m  "
          f"euler {tuple(round(math.degrees(v), 3) for v in scene.camera.rotation_euler)} deg  [{pano_api}]")
    print(f"[render_pano] device     : {backend} ({device_note}) {devices}")
    print(f"[render_pano] settings   : {args.width}x{args.height} @ {args.samples} spp"
          f"  adaptive={args.adaptive}({args.adaptive_threshold}) denoise={args.denoise}/{args.denoise_device}"
          f"  tile={scene.cycles.tile_size} texlimit={args.texture_limit} seed={args.seed}")
    print(f"[render_pano] wrap pad   : {pad} px each side"
          + (f"  -> rendered {args.width + 2 * pad}x{args.height} over "
             f"{lon_range['longitude_min_deg']:.4f}..{lon_range['longitude_max_deg']:.4f} deg, cropped back"
             if pad and lon_range else "  (none — v0.1.0 behaviour)"))
    print(f"[render_pano] out        : {out_dir}")
    print(f"[render_pano] input_key  : {input_key[:16]}…")

    if log_path.exists():
        log_path.unlink()

    # -- render ------------------------------------------------------------------------------------
    timings, log_stats = [], []
    for i in range(max(1, args.repeat)):
        with CaptureFD(log_path, enabled=not args.no_capture):
            t0 = time.perf_counter()
            bpy.ops.render.render(write_still=plan_out["write_still"])
            wall = time.perf_counter() - t0
        timings.append(round(wall, 3))
        st = parse_render_log(log_path)
        log_stats.append(st)
        print(f"[render_pano] render {i + 1}/{args.repeat}: {wall:.3f} s wall  "
              f"(cycles {st['cycles_time_s']}s, device peak {st['device_peak_mb']} MB, "
              f"host peak {st['host_peak_mb']} MB)")

    outputs = {}
    frame = scene.frame_current
    if plan_out["png_master"]:
        m = plan_out["png_master"]
        if m["prefix"]:
            settle(out_dir, m["prefix"], frame, ".png", m["path"].name)
        outputs["pano_png"] = m["path"]
    if plan_out["pano"]["prefix"]:
        settle(out_dir, plan_out["pano"]["prefix"], frame, plan_out["pano"]["ext"], args.pano_name)
    if not pano_final.exists():
        raise RuntimeError(f"the pano output is missing: {pano_final}")
    outputs["pano"] = pano_final

    # -- depth: pack, then verify through an independent decoder -----------------------------------
    depth_stats, checks_out, worst_cm, exr_path = None, [], None, None
    if args.depth == "on":
        exr_path = settle(out_dir, plan_out["depth"]["prefix"], frame, ".exr", f"{stem}-depth.exr")
        depth_m, rgb_bottom_up, depth_stats = pack_depth(exr_path, depth_final, args.width, args.height)
        outputs["depth"] = depth_final
        print(f"[render_pano] depth      : {depth_final.name} {depth_stats['png_bytes']:,} B  "
              f"valid {depth_stats['valid_pixels']:,} / {depth_stats['pixels']:,}  "
              f"sky {depth_stats['sky_pixels']:,}  "
              f"range {depth_stats['min_m']:.3f}..{depth_stats['max_m']:.3f} m  "
              f"({depth_stats['pack_seconds']} s)")

        # round-trip through Blender's own libpng: proves the file is spec-valid AND byte-exact
        back = load_image_array(depth_final, non_color=True)
        back_u8 = np.rint(back[:, :, :3] * 255.0).astype(np.uint8)
        rt_max = int(np.max(np.abs(back_u8.astype(np.int16) - rgb_bottom_up.astype(np.int16))))
        depth_stats["roundtrip_max_byte_diff"] = rt_max
        del back, back_u8
        # ⚠ the polar ROWS of a depth map are legitimately CONSTANT (a flat floor at a fixed
        # latitude is equidistant all the way round) — the "non-constant poles" assertion belongs to
        # the PANO only. Record the two polar rows as numbers instead of as a pass/fail.
        depth_stats["nadir_row_m"] = [round(float(depth_m[0].min()), 4), round(float(depth_m[0].max()), 4)]
        depth_stats["zenith_row_m"] = [round(float(depth_m[-1].min()), 4), round(float(depth_m[-1].max()), 4)]

        if args.depth_check:
            if plan is None or point is None:
                raise RuntimeError("--depth-check needs --plan and a resolvable camera point")
            checks, _f, _r = build_check_set(plan, point, args.width, args.height)
            checks_out, worst_cm = run_depth_check(checks, rgb_bottom_up, args.check_tolerance_cm)
            npass = sum(1 for c in checks_out if c["pass"])
            print(f"[render_pano] depth check: {npass}/{len(checks_out)} within "
                  f"{args.check_tolerance_cm} cm, worst {worst_cm:.2f} cm  [{args.check_mode}]")
            for c in checks_out:
                if c.get("skipped"):
                    print(f"              SKIP  {c['name']}")
                    continue
                print(f"              {'PASS' if c['pass'] else 'FAIL'}  {c['name']:44s} "
                      f"expected {c['expected_m']:.4f} m  decoded {c['decoded_m']:.4f} m  "
                      f"err {c['error_cm']:+.2f} cm   [{c['surface']}]")
        del depth_m, rgb_bottom_up
        if not args.keep_exr:
            exr_path.unlink()
            exr_path = None

    # -- pano assertions ---------------------------------------------------------------------------
    pano_arr = load_image_array(outputs["pano"])
    ph, pw = pano_arr.shape[0], pano_arr.shape[1]
    poles = pole_row_stats(pano_arr)
    del pano_arr
    pano_checks = {
        "size": [pw, ph],
        "is_requested_size": [pw, ph] == [args.width, args.height],
        "is_2to1": pw == ph * 2,
        "poles": poles,
        "no_polar_hole": not (poles["zenith"]["any_all_black"] or poles["nadir"]["any_all_black"]),
    }
    print(f"[render_pano] pano       : {outputs['pano'].name} {pw}x{ph} "
          f"{outputs['pano'].stat().st_size:,} B  "
          f"zenith mean {poles['zenith']['mean_luma_255']:.1f}/255 "
          f"({poles['zenith']['unique_row0']} colours) · "
          f"nadir mean {poles['nadir']['mean_luma_255']:.1f}/255 "
          f"({poles['nadir']['unique_row0']} colours) · no_hole={pano_checks['no_polar_hole']}")

    # -- records -------------------------------------------------------------------------------------
    file_rows = {}
    for k, p in outputs.items():
        file_rows[k] = {"file": p.name, "bytes": p.stat().st_size, "sha256": sha256_file(p)}
    record = {
        "generator": {"script": "pipeline/render_pano.py", "version": VERSION,
                      "script_sha256": settings_for_key["script_sha256"],
                      "blender": bpy.app.version_string,
                      "rendered_utc": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime())},
        "point": {"id": point_id, "room_id": (point or {}).get("room_id"),
                  "plan_cm": [point["x"], point["y"], point["z"]] if point else None,
                  "yaw_deg": (point or {}).get("yaw_deg"),
                  "world_m": [round(v, 6) for v in scene.camera.location],
                  "euler_xyz_deg": [round(math.degrees(v), 6) for v in scene.camera.rotation_euler]},
        "projection": {"type": "equirectangular", "api": pano_api, "fov": "360x180",
                       "resolution": [args.width, args.height],
                       "row_mapping": "lat = -90 + (row+0.5)/H*180 ; row 0 = BOTTOM (Blender buffer)",
                       "col_mapping": "u = (col+0.5)/W ; u=0.5 = camera forward ; u increases to the right",
                       "png_scanline_order": "top row first (this file flips the Blender buffer)"},
        "wrap_pad": {
            "pad_px_each_side": pad,
            "rendered_resolution": [args.width + 2 * pad, args.height],
            "longitude_range_deg": lon_range,
            "cropped_to": [args.width, args.height],
            "why": ("F-360-118: OIDN and the WebP encoder are wrap-blind 2-D operators, so the two "
                    "edge columns of an equirect frame keep denoiser residue the interior loses. "
                    "The pad renders real azimuthal overlap, is denoised and encoded WITH it, and is "
                    "cropped off in the compositor — same angular grid, same file size."),
            "grid_identity": ("pad angle = pad_px * 360/W, so azimuth(col) = -180 + (col+0.5)*360/W "
                              "for the surviving columns, exactly as with pad 0"),
        },
        "depth_encoding": DEPTH_ENCODING,
        "depth_scale": DEPTH_SCALE,
        "depth_units": "metres",
        "depth_decode": "(R<<16 | G<<8 | B) / 100 => metres (radial distance from the camera origin)",
        "depth_invalid_value": DEPTH_INVALID,
        "depth_quantisation": "round-half-to-even to the nearest centimetre",
        "depth_note": ("radial per-ray distance, NOT planar depth (ENV.md §4.1). Through glazing the "
                       "value is the distance to the PANE, which is what a ruler should measure."),
        "render": {"engine": "CYCLES", "backend": backend, "devices": devices,
                   "device_note": device_note, "samples": args.samples,
                   "adaptive_sampling": args.adaptive == "on",
                   "adaptive_threshold": args.adaptive_threshold,
                   "denoise": args.denoise == "on", "denoiser": "OPENIMAGEDENOISE",
                   "denoising_use_gpu": args.denoise_device == "gpu",
                   "use_auto_tile": bool(scene.cycles.use_auto_tile),
                   "tile_size": int(scene.cycles.tile_size),
                   "texture_limit_render": args.texture_limit, "seed": args.seed,
                   "view_transform": scene.view_settings.view_transform,
                   "look": scene.view_settings.look,
                   "film_exposure": round(scene.view_settings.exposure, 4)},
        "encode": {"pano_format": Path(args.pano_name).suffix.lstrip(".").upper(),
                   "webp_quality": args.webp_quality if args.pano_name.endswith(".webp") else None,
                   "png_compression": 15,
                   "depth_png": "hand-rolled, colour type 2, 8-bit, filter Sub, zlib level 6 "
                                "(no colour management touches a depth byte)"},
        "timings_s": {"render_wall_clock": timings,
                      "cycles_time": [s["cycles_time_s"] for s in log_stats],
                      "depth_pack": (depth_stats or {}).get("pack_seconds")},
        "memory": {"device_peak_mb": max([s["device_peak_mb"] or 0 for s in log_stats]) or None,
                   "host_peak_mb": max([s["host_peak_mb"] or 0 for s in log_stats]) or None,
                   "post_render_peak_mb": max([s.get("post_render_peak_mb") or 0 for s in log_stats]) or None,
                   "source": "Cycles' own status field; nvidia-smi per-process is N/A on this WDDM GPU",
                   "note": log_stats[-1].get("note") if log_stats else None,
                   "hybrid_masks_device_figure": bool(args.hybrid)},
        "outputs": file_rows,
        "depth_stats": depth_stats,
        "pano_checks": pano_checks,
        "depth_checks": checks_out,
        "depth_check_worst_cm": round(worst_cm, 3) if worst_cm is not None else None,
        "inputs": input_key_src,
        "input_key": input_key,
        "cost_usd": 0.0,
        "machine": "local — RTX A2000 Laptop 4 GB (ENV.md §1); $0, see RENDER-LEDGER.md",
    }
    with open(sidecar_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(record, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # -- manifest checkpoint ---------------------------------------------------------------------
    write_manifest_row(manifest_path, tour_dir, mkey, {
        "kind": "pano",
        "point_id": point_id,
        "room_id": (point or {}).get("room_id"),
        "dir": os.path.relpath(out_dir, manifest_path.parent).replace("\\", "/")
        if out_dir.drive == manifest_path.drive else str(out_dir),
        "outputs": file_rows,
        "depth_encoding": DEPTH_ENCODING, "depth_scale": DEPTH_SCALE,
        "depth_invalid_value": DEPTH_INVALID,
        "resolution": [args.width, args.height],
        "wrap_pad_px": pad,
        "render": {k: record["render"][k] for k in
                   ("backend", "samples", "adaptive_sampling", "denoise", "tile_size",
                    "texture_limit_render", "seed")},
        "timings_s": record["timings_s"],
        "memory": record["memory"],
        "input_key": input_key,
        "inputs": input_key_src,
        "cost_usd": 0.0,
        "sidecar": sidecar_path.name,
        "rendered_utc": record["generator"]["rendered_utc"],
        "note": ("rerun-skip keys on INPUT hashes only — an output hash drifts on every identical "
                 "re-render (ENV.md §4.3) and would re-trigger an expensive render."),
    }, record["generator"]["rendered_utc"])

    # -- verdict ------------------------------------------------------------------------------------
    problems = []
    if not pano_checks["is_requested_size"]:
        problems.append(f"pano is {pano_checks['size']}, expected {[args.width, args.height]}")
    if not pano_checks["is_2to1"]:
        problems.append("pano is not 2:1")
    if not pano_checks["no_polar_hole"]:
        problems.append("an ALL-BLACK polar row — a hole in the sphere "
                        f"(zenith {pano_checks['poles']['zenith']['all_black_rows']}, "
                        f"nadir {pano_checks['poles']['nadir']['all_black_rows']} rows)")
    if depth_stats:
        # ⭐ the rigorous half of the hole test: a hole returns the world background, which the Z pass
        # reports as ~1e10 (ENV.md §7) and the packer stores as INVALID. A finite distance straight
        # up and straight down cannot be faked. ⚠ the row's MIN is the test (not its max): a room
        # with a skylight legitimately has sky in part of its zenith row, but a HOLE has nothing else.
        open_sky = point_under_open_sky(plan, point)
        for label, row in (("zenith", "zenith_row_m"), ("nadir", "nadir_row_m")):
            lo = depth_stats[row][0]
            if lo <= 0.0 or lo >= SKY_SENTINEL_M:
                if label == "zenith" and open_sky:
                    print(f"NOTE      the depth zenith row has no surface: {point.get('room_id')} is an "
                          f"unroofed outdoor room, the sky above it is the geometry (v0.3.0), not a hole")
                    continue
                problems.append(f"the depth {label} row has no surface anywhere (min {lo} m) — a hole")
    if depth_stats and depth_stats.get("roundtrip_max_byte_diff", 0) != 0:
        problems.append(f"depth PNG round-trip differs by {depth_stats['roundtrip_max_byte_diff']} byte(s)")
    if checks_out:
        bad = [c["name"] for c in checks_out if not c["pass"]]
        if bad:
            msg = f"{len(bad)} depth check(s) outside {args.check_tolerance_cm} cm: {bad}"
            if args.check_mode == "assert":
                problems.append(msg)
            else:
                print(f"REPORT    {msg}  (--check-mode report: not a failure)")

    print(f"[render_pano] sidecar    : {sidecar_path}")
    print(f"[render_pano] manifest   : {manifest_path} (key '{mkey}')")
    summary = {"point": point_id, "status": "rendered", "seconds": timings[-1],
               "device_peak_mb": record["memory"]["device_peak_mb"],
               "pano": str(pano_final), "depth": str(depth_final) if args.depth == "on" else None,
               "input_key": input_key,
               "depth_checks_failed": len([c for c in checks_out if not c["pass"]]) if checks_out else 0,
               "depth_check_worst_cm": record["depth_check_worst_cm"]}
    if problems:
        for p in problems:
            print(f"FAIL      {p}")
        summary["status"] = "failed"
        summary["problems"] = problems
        return 1, summary
    print("OK")
    return 0, summary


# ============================================================================ the top view
def plan_bounds_cm(plan, margin_cm):
    xs, ys = [], []
    for r in plan["rooms"]:
        for (x, y) in r["loop"]:
            xs.append(float(x))
            ys.append(float(y))
    for w in plan["walls"]:
        x0, y0, x1, y1 = w["rect_cm"]
        xs += [float(x0), float(x1)]
        ys += [float(y0), float(y1)]
    return (min(xs) - margin_cm, min(ys) - margin_cm, max(xs) + margin_cm, max(ys) + margin_cm)


def point_in_polygon_mask(poly_cm, x_cm, y_cm):
    """Even-odd crossing test, vectorised over a (rows, cols) grid of pixel-centre coordinates.
    `x_cm` is (cols,) and `y_cm` is (rows,) — the outer product is built inside."""
    xs = x_cm[None, :]
    ys = y_cm[:, None]
    inside = np.zeros((len(y_cm), len(x_cm)), dtype=bool)
    n = len(poly_cm)
    for i in range(n):
        x1, y1 = poly_cm[i]
        x2, y2 = poly_cm[(i + 1) % n]
        if y1 == y2:
            continue
        crosses = ((y1 > ys) != (y2 > ys))
        xint = x1 + (ys - y1) * (x2 - x1) / (y2 - y1)
        inside ^= crosses & (xs < xint)
    return inside


def rasterise_room_mask(plan, reg):
    """The room-id mask: flat colour per room on the SAME grid as the top view, NO anti-aliasing.

    ⭐ Deliberately rasterised from plan.json rather than rendered: a renderer would need a
    colour-managed emission material per room (any view transform silently shifts the bytes), would
    anti-alias two rooms into a third colour that decodes to nothing, and would still have to be
    proven aligned. Rasterising against the SAME world<->image affine the camera was built from makes
    alignment true by construction — and the alignment is then MEASURED anyway, against the top
    view's own depth pass (`verify_topview_alignment`).
    """
    w, h = reg["image"]["width"], reg["image"]["height"]
    cmx, cmy = reg["cm_per_px"]["x"], reg["cm_per_px"]["y"]
    x0, y0 = reg["plan_cm"]["x0"], reg["plan_cm"]["y0"]
    x_cm = x0 + (np.arange(w, dtype=np.float64) + 0.5) * cmx
    y_cm = y0 + (np.arange(h, dtype=np.float64) + 0.5) * cmy
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    legend = []
    for i, room in enumerate(plan["rooms"]):
        colour = ROOM_MASK_PALETTE[i % len(ROOM_MASK_PALETTE)]
        poly = [(float(a), float(b)) for a, b in room["loop"]]
        m = point_in_polygon_mask(poly, x_cm, y_cm)
        rgb[m] = colour
        legend.append({
            "room_id": room["id"], "name_en": room.get("name_en"), "type": room.get("type"),
            "is_outdoor": bool(room.get("is_outdoor")), "area_m2": room.get("area_m2"),
            "rgb": list(colour), "hex": "#%02X%02X%02X" % colour,
            "mask_pixels": int(m.sum()),
            "polygon_px": [[round((float(a) - x0) / cmx - 0.5, 3), round((float(b) - y0) / cmy - 0.5, 3)]
                           for a, b in room["loop"]],
        })
    return rgb, legend


def verify_topview_alignment(reg, plan, depth_m, cam_z_m, max_shift=3):
    """⭐ Prove the mask and the render share one grid, do not assert it.

    The top view's own DEPTH pass is the oracle: a straight-down ray hits a WALL TOP at
    `cam_z - wall_height` and the floor at `cam_z`. Rasterise the walls from plan.json through the
    SAME affine, then score IoU against the depth-derived wall mask over every integer shift in
    [-max_shift, +max_shift]^2. If the affine is right, the best shift is (0, 0) — and a wrong one is
    caught by name, not by eye. (`depth_m` is row 0 = BOTTOM, the Blender buffer; flipped here.)
    """
    w, h = reg["image"]["width"], reg["image"]["height"]
    cmx, cmy = reg["cm_per_px"]["x"], reg["cm_per_px"]["y"]
    x0, y0 = reg["plan_cm"]["x0"], reg["plan_cm"]["y0"]
    x_cm = x0 + (np.arange(w, dtype=np.float64) + 0.5) * cmx
    y_cm = y0 + (np.arange(h, dtype=np.float64) + 0.5) * cmy
    # ⚠ only the walls of ONE height can be scored against one depth plane — take the modal height
    # (a balcony parapet is a different plane and would score as a miss on correct geometry).
    heights = {}
    for wall in plan["walls"]:
        heights.setdefault(round(float(wall["height_cm"]), 3), []).append(wall)
    modal_h_cm = max(heights, key=lambda k: len(heights[k]))
    wall_h_m = modal_h_cm / 100.0
    want = np.zeros((h, w), dtype=bool)
    for wall in heights[modal_h_cm]:
        wx0, wy0, wx1, wy1 = (float(v) for v in wall["rect_cm"])
        want |= ((x_cm[None, :] >= min(wx0, wx1)) & (x_cm[None, :] <= max(wx0, wx1))
                 & (y_cm[:, None] >= min(wy0, wy1)) & (y_cm[:, None] <= max(wy0, wy1)))
    got = np.abs(depth_m[::-1, :] - (cam_z_m - wall_h_m)) < 0.05      # top-row-first, like the mask
    best = None
    scores = []
    for dy in range(-max_shift, max_shift + 1):
        for dx in range(-max_shift, max_shift + 1):
            a = want[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)]
            b = got[max(0, -dy):h + min(0, -dy), max(0, -dx):w + min(0, -dx)]
            inter = int(np.count_nonzero(a & b))
            union = int(np.count_nonzero(a | b))
            iou = inter / union if union else 0.0
            scores.append({"dx": dx, "dy": dy, "iou": round(iou, 6)})
            if best is None or iou > best["iou"]:
                best = {"dx": dx, "dy": dy, "iou": round(iou, 6)}
    return {
        "oracle": ("the top view's own depth pass: a straight-down ray reaches a wall top at "
                   f"cam_z - wall_height = {cam_z_m - wall_h_m:.3f} m (tolerance 5 cm)"),
        "walls_scored": {"height_cm": modal_h_cm, "count": len(heights[modal_h_cm]),
                         "of_total": len(plan["walls"])},
        "wall_px_expected": int(np.count_nonzero(want)),
        "wall_px_measured": int(np.count_nonzero(got)),
        "best_shift": best,
        "zero_shift_iou": next(s["iou"] for s in scores if s["dx"] == 0 and s["dy"] == 0),
        "aligned": bool(best["dx"] == 0 and best["dy"] == 0),
        "shift_scores": scores,
    }


def render_top_view(scene, args, plan, tour_dir, blend, scene_meta, out_root, manifest_path,
                    device_info):
    """One orthographic straight-down render of the whole floor + the room-id mask + registration."""
    backend, devices, device_note = device_info
    out_root.mkdir(parents=True, exist_ok=True)
    stem = Path(args.top_view_name).stem
    log_path = out_root / f"{stem}.render.log"
    sidecar_path = out_root / f"{stem}.registration.json"
    img_path = out_root / args.top_view_name
    mask_path = out_root / args.top_view_mask_name
    depth_path = out_root / args.top_view_depth_name

    x0, y0, x1, y1 = plan_bounds_cm(plan, args.top_view_margin_cm)
    width_m, height_m = (x1 - x0) / 100.0, (y1 - y0) / 100.0
    res_x = int(round(width_m * args.top_view_px_per_m))
    res_y = int(round(height_m * args.top_view_px_per_m))
    res_x += res_x % 2
    res_y += res_y % 2
    ortho = width_m                                   # sensor_fit HORIZONTAL: ortho_scale = frame width
    # the frame's true vertical extent follows the pixel aspect, NOT the wish — square pixels
    covered_h_m = ortho * res_y / res_x
    cx = (x0 + x1) / 200.0                            # world X (m) = +x_cm/100
    cy = -(y0 + y1) / 200.0                           # world Y (m) = -y_cm/100
    ceiling_m = float(plan["plan_meta"]["ceiling_height_cm"]) / 100.0
    cam_z = ceiling_m + TOPVIEW_CAM_ABOVE_CEILING_M
    cm_px_x = width_m * 100.0 / res_x
    cm_px_y = covered_h_m * 100.0 / res_y
    # the image's own plan-cm extents (top-left pixel corner -> bottom-right pixel corner)
    px0 = cx * 100.0 - width_m * 50.0
    py0 = -(cy * 100.0 + covered_h_m * 50.0)          # image ROW 0 = max world Y = min plan y

    subject = {"top_view": True, "px_per_m": args.top_view_px_per_m,
               "margin_cm": args.top_view_margin_cm, "res": [res_x, res_y]}
    input_key_src, input_key, _s = make_input_key(
        args, scene_meta, subject,
        extra={"top_view_samples": args.top_view_samples, "res": [res_x, res_y],
               "pano": args.top_view_name, "wrap_pad": 0})
    if args.skip_if_clean:
        row = read_manifest(manifest_path, tour_dir).get("points", {}).get("topview")
        if (row and row.get("input_key") == input_key and img_path.exists() and mask_path.exists()
                and sidecar_path.exists()):
            print(f"SKIP      topview: manifest input_key matches and outputs exist\n          {img_path}")
            return 0, {"point": "topview", "status": "skipped", "input_key": input_key}

    # --- the camera: a NEW object, so the pano camera is never disturbed -------------------------
    cam_data = bpy.data.cameras.new("TOPVIEW_CAM")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.clip_start = 0.05
    cam_data.clip_end = cam_z + 20.0
    cam_ob = bpy.data.objects.new("TOPVIEW_CAM", cam_data)
    scene.collection.objects.link(cam_ob)
    cam_ob.location = (cx, cy, cam_z)
    cam_ob.rotation_mode = "XYZ"
    cam_ob.rotation_euler = (0.0, 0.0, 0.0)           # a camera looks along -Z: straight down
    prev_cam = scene.camera
    scene.camera = cam_ob

    # --- hide the ceilings, or the "floor plan" is a view of ceiling slabs -----------------------
    hidden = []
    for ob in scene.objects:
        if ob.name.startswith("CEIL_"):
            hidden.append((ob, ob.hide_render))
            ob.hide_render = True

    args_tv = argparse.Namespace(**vars(args))
    args_tv.pano_name = args.top_view_name
    args_tv.depth_name = args.top_view_depth_name
    args_tv.also_png = False
    plan_out = configure_render(scene, args_tv, out_root, stem, pad=0,
                                samples=args.top_view_samples, width=res_x, height=res_y)
    print(f"[render_pano] TOP VIEW   : {res_x}x{res_y} @ {args.top_view_samples} spp  "
          f"ortho {ortho:.4f} m wide x {covered_h_m:.4f} m tall  cam z={cam_z:.3f} m")
    print(f"[render_pano] plan extent: x {px0:.2f}..{px0 + res_x * cm_px_x:.2f} cm  "
          f"y {py0:.2f}..{py0 + res_y * cm_px_y:.2f} cm  ({cm_px_x:.4f} x {cm_px_y:.4f} cm/px)")
    if log_path.exists():
        log_path.unlink()
    with CaptureFD(log_path, enabled=not args.no_capture):
        t0 = time.perf_counter()
        bpy.ops.render.render(write_still=plan_out["write_still"])
        wall = time.perf_counter() - t0
    log_stat = parse_render_log(log_path)

    frame = scene.frame_current
    if plan_out["pano"]["prefix"]:
        settle(out_root, plan_out["pano"]["prefix"], frame, plan_out["pano"]["ext"], args.top_view_name)
    if not img_path.exists():
        raise RuntimeError(f"the top view is missing: {img_path}")
    exr_path = settle(out_root, plan_out["depth"]["prefix"], frame, ".exr", f"{stem}-depth.exr")
    depth_m, _rgb, depth_stats = pack_depth(exr_path, depth_path, res_x, res_y)
    if not args.keep_exr:
        exr_path.unlink()

    # --- restore the scene BEFORE anything can raise on the way out ------------------------------
    for ob, prev in hidden:
        ob.hide_render = prev
    scene.camera = prev_cam

    reg = {
        "generator": {"script": "pipeline/render_pano.py", "version": VERSION,
                      "blender": bpy.app.version_string,
                      "rendered_utc": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime())},
        "image": {"file": img_path.name, "mask_file": mask_path.name, "depth_file": depth_path.name,
                  "width": res_x, "height": res_y},
        "projection": {
            "type": "orthographic",
            "direction": "straight down (-Z); image +x = plan +x (east), image +y (downward) = plan +y (south)",
            "camera_world_m": [round(cx, 6), round(cy, 6), round(cam_z, 6)],
            "ortho_scale_m": round(ortho, 6),
            "covered_m": [round(width_m, 6), round(covered_h_m, 6)],
            "sensor_fit": "HORIZONTAL",
            "ceilings_hidden": [ob.name for ob, _ in hidden],
        },
        "plan_cm": {"x0": round(px0, 6), "y0": round(py0, 6),
                    "x1": round(px0 + res_x * cm_px_x, 6), "y1": round(py0 + res_y * cm_px_y, 6)},
        "cm_per_px": {"x": round(cm_px_x, 9), "y": round(cm_px_y, 9)},
        "map": {
            "plan_to_image": "col = (x_cm - plan_cm.x0)/cm_per_px.x - 0.5 ; row = (y_cm - plan_cm.y0)/cm_per_px.y - 0.5",
            "image_to_plan": "x_cm = plan_cm.x0 + (col + 0.5)*cm_per_px.x ; y_cm = plan_cm.y0 + (row + 0.5)*cm_per_px.y",
            "note": ("row 0 is the image's TOP scanline and the SMALLEST plan y (plan y grows "
                     "downward on the drawing, SCHEMA §1) — the affine has no flip in either axis."),
        },
        "world_m_to_plan_cm": "x_cm = 100*world_X ; y_cm = -100*world_Y (ENV.md §9)",
        "render": {"backend": backend, "devices": devices, "samples": args.top_view_samples,
                   "seconds": round(wall, 3), "device_peak_mb": log_stat["device_peak_mb"],
                   "host_peak_mb": log_stat["host_peak_mb"]},
        "depth_encoding": DEPTH_ENCODING, "depth_scale": DEPTH_SCALE,
        "depth_invalid_value": DEPTH_INVALID,
        "depth_stats": depth_stats,
        "inputs": input_key_src,
        "input_key": input_key,
        "cost_usd": 0.0,
    }
    mask_rgb, legend = rasterise_room_mask(plan, reg)
    mask_bytes = write_png_rgb8(mask_path, mask_rgb)
    reg["rooms"] = legend
    reg["mask"] = {
        "file": mask_path.name, "bytes": mask_bytes,
        "background_rgb": [0, 0, 0],
        "anti_aliasing": "NONE — rasterised from plan.json's room loops at pixel centres, even-odd rule",
        "background_means": "no room here (a wall, a threshold, or outside the flat)",
        "decode": "match the pixel's exact RGB triple against rooms[].rgb; (0,0,0) = no room",
        "sha256_pixels": hashlib.sha256(mask_rgb.tobytes()).hexdigest(),
    }
    reg["alignment"] = verify_topview_alignment(reg, plan, depth_m, cam_z)
    del depth_m, mask_rgb

    outputs = {"topview": img_path, "roomids": mask_path, "topview_depth": depth_path}
    file_rows = {k: {"file": p.name, "bytes": p.stat().st_size, "sha256": sha256_file(p)}
                 for k, p in outputs.items()}
    reg["outputs"] = file_rows
    with open(sidecar_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(reg, f, indent=2, ensure_ascii=False)
        f.write("\n")

    a = reg["alignment"]
    print(f"[render_pano] top view   : {img_path.name} {res_x}x{res_y} "
          f"{img_path.stat().st_size:,} B in {wall:.2f} s")
    print(f"[render_pano] room mask  : {mask_path.name} {mask_bytes:,} B, {len(legend)} rooms, no AA")
    print(f"[render_pano] alignment  : best shift ({a['best_shift']['dx']},{a['best_shift']['dy']}) "
          f"IoU {a['best_shift']['iou']:.4f}  (zero-shift IoU {a['zero_shift_iou']:.4f}) "
          f"-> {'ALIGNED' if a['aligned'] else 'MISALIGNED'}")

    write_manifest_row(manifest_path, tour_dir, "topview", {
        "kind": "topview",
        "dir": os.path.relpath(out_root, manifest_path.parent).replace("\\", "/")
        if out_root.drive == manifest_path.drive else str(out_root),
        "outputs": file_rows,
        "resolution": [res_x, res_y],
        "registration": {"file": sidecar_path.name, "plan_cm": reg["plan_cm"],
                         "cm_per_px": reg["cm_per_px"], "map": reg["map"]},
        "alignment": {"best_shift": a["best_shift"], "aligned": a["aligned"],
                      "zero_shift_iou": a["zero_shift_iou"]},
        "depth_encoding": DEPTH_ENCODING, "depth_scale": DEPTH_SCALE,
        "depth_invalid_value": DEPTH_INVALID,
        "input_key": input_key, "inputs": input_key_src,
        "cost_usd": 0.0, "sidecar": sidecar_path.name,
        "rendered_utc": reg["generator"]["rendered_utc"],
    }, reg["generator"]["rendered_utc"])

    ok = a["aligned"] and img_path.exists() and mask_path.exists()
    if not ok:
        print(f"FAIL      top view / mask alignment: best shift {a['best_shift']}")
        return 1, {"point": "topview", "status": "failed", "alignment": a}
    print("OK")
    return 0, {"point": "topview", "status": "rendered", "seconds": round(wall, 3),
               "alignment": a["best_shift"], "input_key": input_key}


def main(argv):
    args = parse_args(argv)
    if args.width != args.height * 2:
        raise SystemExit(f"equirect needs a 2:1 frame; got {args.width}x{args.height}")
    if args.wrap_pad < 0 or args.wrap_pad > args.width // 2:
        raise SystemExit(f"--wrap-pad {args.wrap_pad} is out of range for width {args.width}")

    blend = Path(args.blend).resolve()
    if not blend.exists():
        raise SystemExit(f"blend not found: {blend}")
    tour_dir = blend.parent
    plan = load_plan(args.plan) if args.plan else None
    manifest_path = Path(args.manifest).resolve() if args.manifest else (tour_dir / "manifest.json")
    out_root = Path(args.out_root).resolve() if args.out_root else (tour_dir / "renders")

    # -- open the scene ONCE (T04 gotcha: scene sync is the fixed cost a batch should pay once) ----
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    scene = bpy.context.scene
    if scene.camera is None:
        raise SystemExit("the .blend carries no scene camera")
    scene_meta = read_scene_meta(tour_dir, blend)
    device_info = select_device(scene, args.device, args.hybrid)

    # -- resolve the point list -------------------------------------------------------------------
    ids = []
    if args.points:
        ids = [s.strip() for s in args.points.split(",") if s.strip()]
    elif args.point:
        ids = [args.point.strip()]
    if ids and plan is None:
        raise SystemExit("--point/--points needs --plan")

    codes, summaries = [], []
    if not args.top_view_only:
        if ids:
            for pid in ids:
                point = next((p for p in plan["camera_points"] if p["id"] == pid), None)
                if point is None:
                    raise SystemExit(f"camera point '{pid}' is not in the plan")
                out_dir = (Path(args.out_dir).resolve() if (args.out_dir and len(ids) == 1)
                           else out_root / pid)
                mkey = args.manifest_key if (args.manifest_key and len(ids) == 1) else pid
                print(f"\n=== [{len(summaries) + 1}/{len(ids)}] {pid} "
                      f"{'=' * max(0, 48 - len(pid))}")
                code, summary = render_one_point(scene, args, plan, point, tour_dir, blend,
                                                 scene_meta, out_dir, manifest_path, mkey,
                                                 device_info)
                codes.append(code)
                summaries.append(summary)
        else:
            # no plan point named: render whatever camera the .blend carries (T04's original mode)
            point = None
            if plan is not None:
                loc = scene.camera.location
                for p in plan["camera_points"]:
                    if (abs(p["x"] / 100.0 - loc[0]) < 1e-4 and abs(-p["y"] / 100.0 - loc[1]) < 1e-4
                            and abs(p["z"] / 100.0 - loc[2]) < 1e-4):
                        point = p
                        break
            pid = (point or {}).get("id") or "camera"
            out_dir = Path(args.out_dir).resolve() if args.out_dir else (out_root / pid)
            code, summary = render_one_point(scene, args, plan, point, tour_dir, blend, scene_meta,
                                             out_dir, manifest_path, args.manifest_key or pid,
                                             device_info)
            codes.append(code)
            summaries.append(summary)

    if args.top_view or args.top_view_only:
        if plan is None:
            raise SystemExit("--top-view needs --plan")
        if plan.get("geometry") == "general" or (plan.get("plan_meta") or {}).get("geometry") == "general":
            print("\nNOTE      top view SKIPPED - a general plan: plan_bounds_cm and the registration check "
                  "read walls[].rect_cm (v0.3.0; the polygon version is a follow-up)")
        else:
            print(f"\n=== topview {'=' * 48}")
            code, summary = render_top_view(scene, args, plan, tour_dir, blend, scene_meta, out_root,
                                            manifest_path, device_info)
            codes.append(code)
            summaries.append(summary)

    if len(summaries) > 1:
        print("\n[render_pano] batch summary")
        for s in summaries:
            print(f"              {s['status']:9s} {s['point']:16s} "
                  f"{('%.2f s' % s['seconds']) if s.get('seconds') else ''}")
    return max(codes) if codes else 0


if __name__ == "__main__":
    # ⛔ MEASURED (ENV.md §8): an uncaught exception under `blender -b -P` prints its traceback and
    # Blender STILL EXITS 0. Convert every crash into an explicit non-zero exit here, and make the
    # caller assert the output files too — exit 0 is necessary, not sufficient.
    _argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    try:
        _code = main(_argv)
    except SystemExit as e:
        _code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
    except BaseException:
        import traceback
        traceback.print_exc()
        print("FAIL      render_pano.py raised — see the traceback above", flush=True)
        _code = 1
    sys.stdout.flush()
    sys.stderr.flush()
    sys.exit(_code)

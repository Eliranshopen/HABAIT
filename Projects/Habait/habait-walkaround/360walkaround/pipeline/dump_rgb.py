#!/usr/bin/env python
"""
dump_rgb.py — decode an image to a raw RGB8 dump, byte-exactly, through Blender's own loaders.

Board `360-v2` T07 · render-pipeline-engineer · $0, local, reads files and writes files.

WHY IT EXISTS. The seam instrument of record is `scripts/g0-seam-poles.mjs`, which reads a raw
`W*H*3` RGB8 buffer (T05 built it that way so the V1 `server/seam.mjs` metric could run unmodified on
whatever the pipeline actually ships). A WebP has no dependency-free reader on this machine — there is
no ffmpeg, no sharp, and `fixtures/check-depth-golden.mjs`'s PNG reader is PNG-only. Blender itself is
the decoder we already trust (it is the same libpng/libwebp that wrote the file).

⛔ THE ONE THING THAT MAKES THIS EXACT: `image.colorspace_settings.name = "Non-Color"` BEFORE reading
`pixels`. With the default "sRGB" colorspace Blender converts every byte to scene-linear float on
load, and converting back costs rounding — the dump would then be a measurement of the OETF, not of
the file. Under Non-Color the float buffer is exactly `byte / 255`, which this file asserts (max
distance from an integer after x255) instead of assuming. T04 proved the same path byte-exact for the
depth PNG (`roundtrip_max_byte_diff == 0`).

⚠ ROW ORDER: Blender's pixel buffer is BOTTOM-row-first; a PNG/WebP scanline 0 is the TOP row.
`g0-seam-poles.mjs` documents its rows as "row 0 = the PNG/WebP top scanline = the zenith", so this
file flips on write. (Column order is untouched, and the seam metric is per-column anyway.)

    PYTHONIOENCODING=utf-8 blender -b --factory-startup -P pipeline/dump_rgb.py -- \
        --img a.webp --img b.png --out-dir <dir>
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np

VERSION = "0.1.0"


def dump_one(path, out_dir):
    img = bpy.data.images.load(str(path))
    img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    ch = img.channels
    buf = np.empty(w * h * ch, dtype=np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    arr = buf.reshape(h, w, ch)[:, :, :3] * 255.0
    del buf
    max_off_integer = float(np.max(np.abs(arr - np.rint(arr))))
    rgb = np.rint(arr).astype(np.uint8)[::-1, :, :]        # flip to top-scanline-first
    del arr
    # ⚠ the dump's name carries the PARENT DIR *and* the source EXTENSION: the four variants of one
    # frame (pad0/pano.png, pad0/pano.webp, pad128/pano.png, pad128/pano.webp) share a stem, and the
    # first version of this line silently overwrote three of the four measurements — twice, because
    # adding only the parent still left the .png/.webp pair colliding. ⭐ A comparison of four things
    # that quietly becomes one file is a comparison that agrees with itself.
    src = Path(path)
    out = Path(out_dir) / f"{src.parent.name}-{src.stem}-{src.suffix.lstrip('.')}.rgb"
    out.write_bytes(rgb.tobytes())
    rec = {
        "source": str(path), "dump": str(out), "width": w, "height": h,
        "bytes": out.stat().st_size,
        "max_distance_from_integer_byte": round(max_off_integer, 9),
        "exact": bool(max_off_integer < 1e-3),
        "row_order": "top scanline first (Blender's buffer is bottom-first; flipped here)",
        "sha256_rgb": hashlib.sha256(rgb.tobytes()).hexdigest(),
    }
    print(f"[dump_rgb] {Path(path).name}: {w}x{h} -> {out.name} ({rec['bytes']:,} B), "
          f"exact={rec['exact']} (max |x255 - round| = {max_off_integer:.2e})")
    if not rec["exact"]:
        raise RuntimeError(f"{path}: the Non-Color read was not byte-exact — do not measure this dump")
    return rec


def encode_webp(src, out_dir, qualities):
    """Re-encode a LOSSLESS master to WebP at several qualities, in one pass, no re-render.

    T07 uses this to separate the two halves of F-360-118: the wrap pad fixes the DENOISER's
    contribution at render time, and this measures what the ENCODER still adds on top — the same
    pixels through the same libwebp, only the quality knob moving. ⚠ The image is read and written
    with colorspace `Non-Color`, so no view transform touches a byte on the way through: the control
    (re-encoding the pad-0 master at the same q90 the render used) reproduces the rendered WebP's
    seam numbers, which is what makes the sweep trustworthy.
    """
    out = []
    src = Path(src).resolve()
    for q in qualities:
        img = bpy.data.images.load(str(src))
        img.colorspace_settings.name = "Non-Color"
        img.file_format = "WEBP"
        s = bpy.context.scene
        s.render.image_settings.file_format = "WEBP"
        s.render.image_settings.color_mode = "RGB"
        s.render.image_settings.quality = q
        dst = Path(out_dir) / f"{src.parent.name}-{src.stem}-q{q}.webp"
        img.save_render(filepath=str(dst), scene=s)
        bpy.data.images.remove(img)
        rec = {"source": str(src), "quality": q, "file": str(dst), "bytes": dst.stat().st_size}
        print(f"[dump_rgb] encode q{q}: {dst.name} {rec['bytes']:,} B")
        out.append(rec)
    return out


def main(argv):
    p = argparse.ArgumentParser(prog="dump_rgb.py")
    p.add_argument("--img", action="append", default=[])
    p.add_argument("--encode", default=None, help="a lossless master to re-encode to WebP")
    p.add_argument("--qualities", default="80,90,95,100")
    p.add_argument("--out-dir", required=True)
    p.add_argument("--report", default=None)
    a = p.parse_args(argv)
    Path(a.out_dir).mkdir(parents=True, exist_ok=True)
    if a.encode:
        enc = encode_webp(a.encode, a.out_dir, [int(q) for q in a.qualities.split(",")])
        a.img = list(a.img) + [e["file"] for e in enc]
    if not a.img:
        raise SystemExit("nothing to do: pass --img and/or --encode")
    recs = [dump_one(Path(i).resolve(), a.out_dir) for i in a.img]
    if a.report:
        with open(a.report, "w", encoding="utf-8", newline="\n") as f:
            json.dump({"generator": {"script": "pipeline/dump_rgb.py", "version": VERSION,
                                     "blender": bpy.app.version_string}, "dumps": recs},
                      f, indent=2, ensure_ascii=False)
            f.write("\n")
    print("OK")
    return 0


if __name__ == "__main__":
    # ⛔ ENV.md §8: an uncaught exception under `blender -b -P` still exits 0.
    _argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    try:
        _code = main(_argv)
    except SystemExit as e:
        _code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
    except BaseException:
        import traceback
        traceback.print_exc()
        print("FAIL      dump_rgb.py raised — see the traceback above", flush=True)
        _code = 1
    sys.stdout.flush()
    sys.exit(_code)

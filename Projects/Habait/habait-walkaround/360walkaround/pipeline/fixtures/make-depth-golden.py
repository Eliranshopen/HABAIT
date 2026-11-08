#!/usr/bin/env python
"""make-depth-golden.py — the committed golden fixture for the depth format (CONTRACT §16.5).

Writes an 8x4 packed depth PNG plus the JSON of what every pixel must decode to, using **the very
packer that renders the real thing** (`render_pano.write_png_rgb8`, imported, not re-implemented) —
so the fixture cannot drift from the pipeline while still looking correct.

    PYTHONIOENCODING=utf-8 blender -b --factory-startup -P pipeline/fixtures/make-depth-golden.py

Both ecosystems test against this file (C-360-82): the Python side re-decodes it here, the viewer's
TypeScript decode util loads it in its own suite. The pixel set is chosen to catch the four ways a
decoder goes silently wrong:
  * a byte-order flip            -> the 1.00 m / 655.36 m pair swaps
  * a wrong scale (x10 / x1000)  -> every value is off by a decade
  * a vertical flip              -> row 0 (TOP) and row 3 (BOTTOM) swap; they differ by design
  * treating 0 as a distance     -> the invalid pixel reads 0.00 m instead of "no surface"
"""

import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from render_pano import (DEPTH_ENCODING, DEPTH_INVALID, DEPTH_SCALE,  # noqa: E402
                         write_png_rgb8)

W, H = 8, 4
# metres; row 0 is the TOP scanline of the PNG. -1 marks the invalid (no-surface) pixel.
VALUES = [
    [0.01, 1.00, 2.00, 2.56, 3.00, 10.00, 100.00, 167772.15],   # top row: the range extremes
    [655.36, 0.50, 1.40, 1.20, 2.256, 65.536, 655.35, 1.23],    # byte-order traps
    [-1.0, 5.00, 5.01, 5.02, 5.03, 5.04, 5.05, 5.06],           # the invalid pixel + a 1 cm ramp
    [9.99, 8.88, 7.77, 6.66, 5.55, 4.44, 3.33, 2.22],           # bottom row: distinct from the top
]


def main():
    rgb = np.zeros((H, W, 3), dtype=np.uint8)
    expect = []
    for r in range(H):
        row = []
        for c in range(W):
            v = VALUES[r][c]
            if v < 0:
                units = DEPTH_INVALID
                row.append(None)
            else:
                units = int(round(v * DEPTH_SCALE))
                row.append(units / float(DEPTH_SCALE))
            rgb[r, c] = [(units >> 16) & 0xFF, (units >> 8) & 0xFF, units & 0xFF]
        expect.append(row)

    png = HERE / "depth-golden-8x4.png"
    size = write_png_rgb8(png, rgb)

    doc = {
        "fixture": "depth-golden-8x4",
        "purpose": "the one file both the Python packer and the TypeScript decoder test against "
                   "(CONTRACT §16.5 / C-360-82)",
        "generator": "pipeline/fixtures/make-depth-golden.py (imports pipeline/render_pano.py's own writer)",
        "width": W, "height": H,
        "depth_encoding": DEPTH_ENCODING,
        "depth_scale": DEPTH_SCALE,
        "depth_units": "metres",
        "decode": "(R<<16 | G<<8 | B) / 100 => metres",
        "invalid_value": DEPTH_INVALID,
        "invalid_means": "no surface (sky/background) — NOT zero metres; a decoder must test for it",
        "row_order": "row 0 of `expected_metres` is the PNG's FIRST (top) scanline",
        "expected_metres": expect,
        "expected_rgb": rgb.tolist(),
        "png_bytes": size,
    }
    out = HERE / "depth-golden-8x4.json"
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # re-decode what we just wrote, straight off disk, through Blender's own libpng
    import bpy
    img = bpy.data.images.load(str(png))
    img.colorspace_settings.name = "Non-Color"
    buf = np.empty(W * H * img.channels, dtype=np.float32)
    img.pixels.foreach_get(buf)
    back = np.rint(buf.reshape(H, W, img.channels)[::-1, :, :3] * 255.0).astype(np.uint8)
    bad = 0
    for r in range(H):
        for c in range(W):
            u = (int(back[r, c, 0]) << 16) | (int(back[r, c, 1]) << 8) | int(back[r, c, 2])
            want = expect[r][c]
            got = None if u == DEPTH_INVALID else u / float(DEPTH_SCALE)
            if got != want:
                bad += 1
                print(f"FAIL      ({r},{c}) decoded {got} expected {want}")
    print(f"wrote     {png.name} ({size} B) + {out.name}")
    print(f"verified  {W * H - bad}/{W * H} pixels round-trip through libpng")
    return 1 if bad else 0


if __name__ == "__main__":
    try:
        _code = main()
    except SystemExit as e:
        _code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
    except BaseException:
        import traceback
        traceback.print_exc()
        print("FAIL      make-depth-golden.py raised", flush=True)
        _code = 1
    sys.stdout.flush()
    sys.exit(_code)

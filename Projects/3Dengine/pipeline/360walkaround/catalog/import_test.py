#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""import_test.py -- open every fetched catalog model in Blender headless and MEASURE it.

Board `360-v2` T12 · called by `catalog/fetch.mjs` (never by hand, though it runs standalone fine):

    blender -b --factory-startup -P catalog/import_test.py -- --job <job.json> --out <out.json>

WHY IT EXISTS. A catalog row is a promise ("this URL is a CC0 sofa"). Three things can be wrong with
it that a download cannot see: the file may not import at all, it may import with no mesh data, and
it may import at the wrong SCALE. All three are settled here, once, in ONE Blender process for the
whole catalog -- 57 separate `blender -b` invocations would re-pay ~3 s of boot each for nothing.

WHAT IT MEASURES per asset (all in the FILE's own units, unscaled -- the style lock owns the scale
decision, this file owns the measurement):
  * `ok` / `error`                     -- did it import, and with mesh data?
  * `bbox_cm` [dx, dy, dz]             -- world-space size after the importer's own axis conversion
  * `origin_offset_cm`                 -- where the bbox sits relative to the object origin(s)
  * `tris`, `objects`, `materials`     -- what lands in the scene
  * `image_textures`                   -- whether the model carries its own maps (Poly Haven does;
                                          Kenney ships ONE shared palette atlas; Quaternius varies)
  * `tall_mass` + `front_axis_guess`   -- the "which way does it face" measurement. For a sofa/bed/
                                          desk the BACK is the tall half (T06 measured `sofa_02` this
                                          way by hand); so the fraction of upper-half vertices in each
                                          of the four half-spaces is reported, and the axis whose half
                                          carries the LEAST tall mass is the front. ⚠ It is a
                                          measurement, not an oracle: a symmetric piece (table, rug,
                                          plant) has no meaningful front, and the style lock records
                                          the value a human then confirms by eye on a draft render.

⛔ ENV.md §8: an uncaught exception under `blender -b -P` still exits 0. Every asset is wrapped, and
the footer converts a crash into a real non-zero exit.
"""
from __future__ import annotations

import json
import os
import sys

import bpy
from mathutils import Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH" and o.data and len(o.data.vertices)]


def import_blend(path):
    """Append every MESH object -- the same path `build_scene.py::append_model` uses in production."""
    before = set(bpy.data.objects.keys())
    with bpy.data.libraries.load(path, link=False) as (df, dt):
        dt.objects = sorted(df.objects)
    new = [bpy.data.objects[n] for n in sorted(set(bpy.data.objects.keys()) - before)]
    for o in new:
        if o.name not in bpy.context.scene.collection.objects:
            bpy.context.scene.collection.objects.link(o)
    return new


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path)
    return list(bpy.context.scene.objects)


def tall_mass(objs, mn, mx):
    """Fraction of the model's UPPER-half vertices sitting in each of the four horizontal half-spaces.

    The back of a sofa/bed/desk/toilet is its tall half; the front is the opposite one. Reported as
    four numbers plus the argmin, so a caller can see how lopsided (i.e. how trustworthy) the guess
    is instead of getting a bare label."""
    z_mid = (mn.z + mx.z) / 2.0
    x_mid = (mn.x + mx.x) / 2.0
    y_mid = (mn.y + mx.y) / 2.0
    counts = {"+X": 0, "-X": 0, "+Y": 0, "-Y": 0}
    total = 0
    for o in objs:
        mw = o.matrix_world
        for v in o.data.vertices:
            w = mw @ v.co
            if w.z <= z_mid:
                continue
            total += 1
            counts["+X" if w.x >= x_mid else "-X"] += 1
            counts["+Y" if w.y >= y_mid else "-Y"] += 1
    if not total:
        return {"upper_vertices": 0, "fractions": None, "front_axis_guess": None, "confidence": 0.0}
    fr = {k: round(v / total, 4) for k, v in counts.items()}
    # the front is opposite the heaviest tall half, on whichever AXIS is the more lopsided
    x_split = abs(fr["+X"] - fr["-X"])
    y_split = abs(fr["+Y"] - fr["-Y"])
    if max(x_split, y_split) < 0.10:
        return {"upper_vertices": total, "fractions": fr, "front_axis_guess": None,
                "confidence": round(max(x_split, y_split), 4)}
    if x_split >= y_split:
        guess = "-X" if fr["+X"] > fr["-X"] else "+X"
        conf = x_split
    else:
        guess = "-Y" if fr["+Y"] > fr["-Y"] else "+Y"
        conf = y_split
    return {"upper_vertices": total, "fractions": fr, "front_axis_guess": guess,
            "confidence": round(conf, 4)}


def measure():
    objs = mesh_objects()
    if not objs:
        return None
    mn = Vector((1e18, 1e18, 1e18))
    mx = Vector((-1e18, -1e18, -1e18))
    tris = 0
    mats, images = set(), set()
    for o in objs:
        mw = o.matrix_world
        for v in o.data.vertices:
            w = mw @ v.co
            for i in range(3):
                mn[i] = min(mn[i], w[i])
                mx[i] = max(mx[i], w[i])
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
        for m in o.data.materials:
            if m is None:
                continue
            mats.add(m.name)
            if m.use_nodes:
                for n in m.node_tree.nodes:
                    if n.type == "TEX_IMAGE" and n.image is not None:
                        images.add(n.image.name)
    return {
        "objects": len(objs),
        "tris": tris,
        "bbox_cm": [round((mx[i] - mn[i]) * 100.0, 3) for i in range(3)],
        "bbox_min_cm": [round(mn[i] * 100.0, 3) for i in range(3)],
        "bbox_max_cm": [round(mx[i] * 100.0, 3) for i in range(3)],
        "materials": sorted(mats),
        "image_textures": sorted(images),
        "object_names": sorted(o.name for o in objs)[:12],
        "tall_mass": tall_mass(objs, mn, mx),
    }


def main(argv):
    job_path = argv[argv.index("--job") + 1]
    out_path = argv[argv.index("--out") + 1]
    job = json.load(open(job_path, encoding="utf-8"))

    out = {"blender": bpy.app.version_string, "assets": []}
    for a in job["assets"]:
        rec = {"id": a["id"], "ok": False, "error": None}
        try:
            reset()
            path = a["path"]
            if not os.path.exists(path):
                raise RuntimeError(f"file not on disk: {path}")
            low = path.lower()
            if low.endswith(".blend"):
                import_blend(path)
            elif low.endswith((".glb", ".gltf")):
                import_glb(path)
            else:
                raise RuntimeError(f"unknown extension for {path}")
            m = measure()
            if m is None:
                raise RuntimeError("imported with zero mesh data")
            rec.update(m)
            rec["ok"] = True
            print(f"  ok    {a['id']:<50s} {m['objects']:3d} obj  {m['tris']:7d} tri  "
                  f"{m['bbox_cm'][0]:8.1f} x {m['bbox_cm'][1]:8.1f} x {m['bbox_cm'][2]:8.1f} cm  "
                  f"{len(m['image_textures'])} image(s)", flush=True)
        except BaseException as e:            # noqa: BLE001 -- a broken row is DATA, not a crash
            rec["error"] = f"{type(e).__name__}: {e}"
            print(f"  FAIL  {a['id']:<50s} {rec['error']}", flush=True)
        out["assets"].append(rec)

    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    ok = sum(1 for a in out["assets"] if a["ok"])
    print(f"IMPORT-TEST  {ok}/{len(out['assets'])} ok  -> {out_path}")
    return 0


if __name__ == "__main__":
    _argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    try:
        _code = main(_argv)
    except BaseException:                      # noqa: BLE001
        import traceback
        traceback.print_exc()
        print("FAIL      import_test.py raised — see the traceback above", flush=True)
        _code = 1
    sys.stdout.flush()
    sys.exit(_code)

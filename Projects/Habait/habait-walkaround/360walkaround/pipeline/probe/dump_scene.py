#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dump_scene.py — a canonical, byte-comparable dump of a .blend's SCENE DATA.

Board `360-v2` T03. This is the determinism instrument: it exists because T01 measured that a
Blender output file is **not** byte-stable even when the data inside it is identical (ENV.md §4.3:
an EXR whose 62,908 depth pixels matched bit-for-bit still hashed differently — one byte, the
`Date` header). So we never hash a container. We hash the DECODED data:

  * every object's `matrix_world`, as exact float repr — the acceptance criterion's "transforms"
  * every mesh's raw float32 vertex-coordinate buffer and polygon index buffer, sha256'd
  * lights (type/energy/colour/size), the camera (pano type, clip), materials, world nodes
  * the render settings that would change a render

Nothing time-, path- or session-dependent goes in, so two runs of a deterministic builder must
produce two byte-identical dumps.

    blender -b <scene.blend> -P dump_scene.py -- --out <dump.json>
"""
from __future__ import annotations

import hashlib
import json
import os
import sys

import bpy
import numpy as np


def h(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def f(x) -> str:
    """Exact, round-trippable, locale-free float text."""
    return repr(float(x))


def mat(m):
    return [f(v) for row in m for v in row]


def mesh_record(me):
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    npoly = len(me.polygons)
    ploop = np.empty(npoly, dtype=np.int32)
    me.polygons.foreach_get("loop_total", ploop)
    nloop = len(me.loops)
    vidx = np.empty(nloop, dtype=np.int32)
    me.loops.foreach_get("vertex_index", vidx)
    return {
        "vertices": n,
        "polygons": npoly,
        "loops": nloop,
        # the raw single-precision buffers — the actual geometry, not a rounded view of it
        "co_sha256": h(co.tobytes()),
        "loop_total_sha256": h(ploop.tobytes()),
        "loop_vertex_sha256": h(vidx.tobytes()),
        "co_sum": f(float(co.astype(np.float64).sum())),
        "bbox": [f(v) for v in (co.reshape(-1, 3).min(axis=0).tolist()
                                + co.reshape(-1, 3).max(axis=0).tolist())] if n else [],
        "materials": [m.name if m else None for m in me.materials],
    }


def node_tree_record(nt):
    if nt is None:
        return None
    nodes = []
    for n in sorted(nt.nodes, key=lambda n: (n.bl_idname, n.name)):
        inp = {}
        for s in n.inputs:
            if getattr(s, "is_linked", False):
                continue
            v = getattr(s, "default_value", None)
            if v is None:
                continue
            try:
                inp[s.name] = [f(x) for x in v]
            except TypeError:
                inp[s.name] = f(v) if isinstance(v, (int, float)) else str(v)
        rec = {"idname": n.bl_idname, "name": n.name, "inputs": inp}
        img = getattr(n, "image", None)
        if img is not None:
            rec["image"] = img.name
            rec["colorspace"] = img.colorspace_settings.name
        nodes.append(rec)
    links = sorted(f"{l.from_node.name}.{l.from_socket.name} -> {l.to_node.name}.{l.to_socket.name}"
                   for l in nt.links)
    return {"nodes": nodes, "links": links}


def main(argv):
    out = None
    if "--out" in argv:
        out = argv[argv.index("--out") + 1]

    scene = bpy.context.scene
    objects = []
    for ob in sorted(bpy.data.objects, key=lambda o: o.name):
        rec = {
            "name": ob.name,
            "type": ob.type,
            "parent": ob.parent.name if ob.parent else None,
            "matrix_world": mat(ob.matrix_world),
            "matrix_parent_inverse": mat(ob.matrix_parent_inverse),
            "visible_camera": bool(getattr(ob, "visible_camera", True)),
            "modifiers": [(m.name, m.type) for m in ob.modifiers],
        }
        if ob.type == "MESH":
            rec["mesh"] = mesh_record(ob.data)
        elif ob.type == "LIGHT":
            ld = ob.data
            rec["light"] = {"type": ld.type, "energy": f(ld.energy),
                            "color": [f(c) for c in ld.color],
                            "size": f(getattr(ld, "size", 0.0)),
                            "shadow_soft_size": f(getattr(ld, "shadow_soft_size", 0.0)),
                            "angle": f(getattr(ld, "angle", 0.0))}
        elif ob.type == "CAMERA":
            cd = ob.data
            rec["camera"] = {"type": cd.type,
                             "panorama_type": getattr(cd, "panorama_type", None),
                             "clip_start": f(cd.clip_start), "clip_end": f(cd.clip_end),
                             "lens": f(cd.lens)}
        objects.append(rec)

    materials = []
    for m in sorted(bpy.data.materials, key=lambda m: m.name):
        materials.append({"name": m.name, "use_nodes": m.use_nodes,
                          "node_tree": node_tree_record(m.node_tree)})

    images = [{"name": i.name,
               "filepath": i.filepath.replace("\\", "/"),
               "colorspace": i.colorspace_settings.name,
               "packed": bool(i.packed_file)}
              for i in sorted(bpy.data.images, key=lambda i: i.name)]

    cy = scene.cycles
    dump = {
        "_note": "canonical scene DATA dump; contains no time, no session and no container bytes",
        "blender": bpy.app.version_string,
        "scene": {
            "name": scene.name,
            "camera": scene.camera.name if scene.camera else None,
            "engine": scene.render.engine,
            "resolution": [scene.render.resolution_x, scene.render.resolution_y,
                           scene.render.resolution_percentage],
            "film_transparent": scene.render.film_transparent,
            "view_transform": scene.view_settings.view_transform,
            "look": scene.view_settings.look,
            "exposure": f(scene.view_settings.exposure),
            "cycles": {"device": cy.device, "seed": cy.seed, "samples": cy.samples,
                       "use_denoising": cy.use_denoising,
                       "max_bounces": cy.max_bounces,
                       "transmission_bounces": cy.transmission_bounces,
                       "transparent_max_bounces": cy.transparent_max_bounces,
                       "use_auto_tile": cy.use_auto_tile, "tile_size": cy.tile_size},
            "use_pass_z": scene.view_layers[0].use_pass_z,
        },
        "counts": {"objects": len(objects), "meshes": len(bpy.data.meshes),
                   "materials": len(materials), "images": len(images),
                   "lights": len(bpy.data.lights)},
        "objects": objects,
        "materials": materials,
        "images": images,
        "world": {"name": scene.world.name if scene.world else None,
                  "node_tree": node_tree_record(scene.world.node_tree if scene.world else None)},
    }

    text = json.dumps(dump, indent=1, ensure_ascii=False, sort_keys=False)
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if out:
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        with open(out, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
            fh.write("\n")
    print(f"DUMP_SHA256 {digest}")
    print(f"DUMP_OBJECTS {len(objects)}")
    if out:
        print(f"DUMP_PATH {out}")
    return 0


if __name__ == "__main__":
    # see build_scene.py's footer: an uncaught exception under `blender -b -P` still exits 0
    _argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    try:
        _code = main(_argv)
    except SystemExit as e:
        _code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
    except BaseException:
        import traceback
        traceback.print_exc()
        _code = 1
    sys.stdout.flush()
    sys.exit(_code)

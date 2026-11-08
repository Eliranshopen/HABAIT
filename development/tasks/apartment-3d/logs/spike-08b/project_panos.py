#!/usr/bin/env python3
"""project_panos.py -- bake the tour's panoramas onto the dollhouse GLB's UVs, per camera (board apartment-3d, 08b).

Stage 1 of 2 (Blender, headless, the build scene read-only and never saved). Writes a CACHE; stage 2
(`compose_panos.py`, plain python) turns the cache into the colour atlases the viewer shows.

    "$BLENDER" -b <scene.blend> --factory-startup -P 360walkaround/pipeline/project_panos.py -- \
        --dollhouse <dir: apt846.glb + report.json> --tour <tour360/apartments/apt846> --cache <dir> \
        [--cams living,kitchen,...] [--sets parquet,concrete,marble] [--res 2048]

The cache (one .npz per item; an item whose manifest row matches its inputs is never redone):
  base.npz        albedo (web colours, colour pass) + class (receiver kind per texel: floor / wall / door / other,
                  room index for floors) + covered mask
  vis-<cam>.npz   visibility from that camera's eye (a point light there, the full-height scene as occluder,
                  glass see-through): the direct-light value (also the "best camera" score: cos / d^2)
  col-<cam>-<set>.npz  the pano colour (sRGB bytes) the texel shows from that camera (equirect lookup)
  manifest.json   one row per item: inputs + sha256 + seconds
Cameras: the scene's CAM_cp-<id> when it exists (living), else rebuilt from scenes.json + cameras.json (plan point /
planScale / pxPerCm -> metres, eye_m, rotation (90, 0, -centreBearingDeg)) -- living rebuilt this way lands within
5 mm and the same rotation as CAM_cp-living. $0, local CPU only.
"""

import argparse
import hashlib
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export_dollhouse as ED  # noqa: E402

KIND = {"other": 0, "floor": 1, "wall": 2, "door": 3}


def log(m):
    print(f"[project] {m}", flush=True)


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def parse(argv):
    ap = argparse.ArgumentParser(prog="project_panos.py")
    ap.add_argument("--dollhouse", required=True)
    ap.add_argument("--name", default="apt846")
    ap.add_argument("--tour", required=True, help="tour360/apartments/<apt> (scenes.json, cameras.json, _local/panos-<set>)")
    ap.add_argument("--cache", required=True)
    ap.add_argument("--cams", default="", help="scene ids (default: every interior scene with a plan point)")
    ap.add_argument("--sets", default="parquet")
    ap.add_argument("--res", type=int, default=2048)
    ap.add_argument("--cut-height", type=float, default=1.2)
    ap.add_argument("--max-seconds", type=float, default=470, help="stop starting new items after this (timeout 540)")
    return ap.parse_args(argv)


def tour_cameras(tour):
    s = json.load(open(os.path.join(tour, "scenes.json"), encoding="utf-8"))
    c = json.load(open(os.path.join(tour, "cameras.json"), encoding="utf-8"))
    ps, ppc, eye = c["plan"]["planScale"], c["plan"]["pxPerCm"], c["eye_m"]
    out = {}
    for sc in s["scenes"]:
        p = sc.get("plan") or {}
        if sc.get("exterior") or "x" not in p:
            continue
        out[sc["id"]] = {"asset": sc["asset"], "loc": (p["x"] / ps / ppc / 100, -(p["y"] / ps / ppc / 100), eye),
                         "bearing": float(sc.get("centreBearingDeg", 0.0))}
    return out


def main(args):
    import bpy
    import bmesh
    import math
    import numpy as np
    from mathutils import Euler, Matrix, Vector
    t0 = time.time()
    res = int(args.res)
    os.makedirs(args.cache, exist_ok=True)
    mpath = os.path.join(args.cache, "manifest.json")
    man = json.load(open(mpath, encoding="utf-8")) if os.path.isfile(mpath) else {"items": {}}
    glb = os.path.join(args.dollhouse, f"{args.name}.glb")
    common = {"glb_sha256": sha(glb), "scene_sha256": sha(bpy.data.filepath), "res": res, "script": "project_panos.py 2"}

    def done(key, extra):
        row = man["items"].get(key)
        return row and all(row.get(k) == v for k, v in {**common, **extra}.items()) and os.path.isfile(os.path.join(args.cache, row["file"]))

    def record(key, extra, fname, secs):
        man["items"][key] = {**common, **extra, "file": fname, "sha256": sha(os.path.join(args.cache, fname)), "seconds": secs}
        json.dump(man, open(mpath, "w", encoding="utf-8"), indent=1)

    cams = tour_cameras(args.tour)
    want = [c for c in (args.cams.split(",") if args.cams else cams) if c]
    sets = [s for s in args.sets.split(",") if s]
    sc = bpy.context.scene

    # ---- the scene = occluder (parts above the cut, ceilings), the GLB = receiver ----
    ED.prepare_bake_scene(bpy, bmesh, float(args.cut_height))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    imported = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    skip = {"glass", "web_cap"}
    base = lambda n: n.split(".")[0]  # noqa: E731
    recv = [o for o in imported if o.data.uv_layers and any(m and base(m.name) not in skip for m in o.data.materials)]
    lights = [o for o in sc.objects if o.type == "LIGHT"]
    world = sc.world
    bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None) if world and world.use_nodes else None
    bg_strength = bg.inputs[1].default_value if bg else None
    log(f"{len(recv)} receivers; cameras {', '.join(want)}; sets {', '.join(sets)}")

    def img(name):
        im = bpy.data.images.new(name, res, res, alpha=True, float_buffer=True)
        im.colorspace_settings.name = "Non-Color"
        im.pixels.foreach_set(np.zeros(res * res * 4, np.float32))
        return im
    dummy = bpy.data.images.new("_pp_dummy", 8, 8, alpha=True, float_buffer=True)
    mats = sorted({m for o in recv for m in o.data.materials if m}, key=lambda m: m.name)
    nodes = {}
    for m in mats:
        m.use_nodes = True
        n = m.node_tree.nodes.new("ShaderNodeTexImage")
        n.image = dummy
        m.node_tree.nodes.active = n
        nodes[m] = n

    def target(im):
        for m, n in nodes.items():
            n.image = dummy if base(m.name) in skip else im
            m.node_tree.nodes.active = n

    def bake(kind, passes, samples):
        sc.render.engine = "CYCLES"
        sc.cycles.device = "CPU"
        sc.cycles.samples = samples
        sc.cycles.seed = 0
        sc.cycles.use_adaptive_sampling = False
        sc.cycles.use_denoising = False
        bpy.ops.object.select_all(action="DESELECT")
        for o in recv:
            o.select_set(True)
        bpy.context.view_layer.objects.active = recv[0]
        t = time.time()
        bpy.ops.object.bake(type=kind, pass_filter=passes, margin=2, margin_type="EXTEND", use_clear=False,
                            target="IMAGE_TEXTURES", use_selected_to_active=False)
        return round(time.time() - t, 2)

    def pixels(im):
        b = np.empty(res * res * 4, np.float32)
        im.pixels.foreach_get(b)
        return b.reshape(res, res, 4)

    def emission_override(make):
        """swap every receiver material's surface for Emission(make(node_tree)); returns an undo()"""
        undo = []
        for m in mats:
            nt = m.node_tree
            outn = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
            old = [(l.from_socket, l.to_socket) for l in nt.links if l.to_node == outn]
            for l in [l for l in nt.links if l.to_node == outn]:
                nt.links.remove(l)
            added, colour = make(m, nt)
            em = nt.nodes.new("ShaderNodeEmission")
            added.append(em)
            nt.links.new(colour, em.inputs["Color"])
            nt.links.new(em.outputs[0], outn.inputs["Surface"])
            undo.append((nt, outn, old, added))

        def restore():
            for nt, outn, old, added in undo:
                for l in [l for l in nt.links if l.to_node == outn]:
                    nt.links.remove(l)
                for fs, ts in old:
                    nt.links.new(fs, ts)
                for n in added:
                    nt.nodes.remove(n)
        return restore

    # ---- base: albedo + class ----
    if not done("base", {}) and time.time() - t0 < args.max_seconds:
        t = time.time()
        ai = img("_pp_alb")
        target(ai)
        sc.render.bake.use_pass_direct = False
        sc.render.bake.use_pass_indirect = False
        sc.render.bake.use_pass_color = True
        bake("DIFFUSE", {"COLOR"}, 1)
        alb = pixels(ai)
        rooms = sorted({o.name.split(".")[0][len("floor_"):] for o in recv if o.name.startswith("floor_")})
        def cls(o):
            n = o.name.split(".")[0]
            if n.startswith("floor_") or n.startswith("floorfill"):
                rid = n[len("floor_"):] if n.startswith("floor_") else ""
                return KIND["floor"], (rooms.index(rid) + 1) if rid in rooms else 0
            if n == "walls":
                return KIND["wall"], 0
            if n == "doors":
                return KIND["door"], 0
            return KIND["other"], 0
        # class pass: each receiver OBJECT gets its own emission colour -> per-object materials are needed, so the
        # material is copied per object for this pass only
        orig = {}
        for o in recv:
            k, r = cls(o)
            orig[o] = [s.material for s in o.material_slots]
            for s in o.material_slots:
                if s.material is None:
                    continue
                mc = s.material.copy()
                nt = mc.node_tree
                outn = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
                for l in [l for l in nt.links if l.to_node == outn]:
                    nt.links.remove(l)
                em = nt.nodes.new("ShaderNodeEmission")
                em.inputs["Color"].default_value = (k / 4.0, r / 32.0, 1.0, 1.0)
                nt.links.new(em.outputs[0], outn.inputs["Surface"])
                tn = nt.nodes.new("ShaderNodeTexImage")
                nt.nodes.active = tn
                s.link = "OBJECT"
                s.material = mc
        ci = img("_pp_cls")
        for o in recv:
            for s in o.material_slots:
                if s.material is None:
                    continue
                tn = s.material.node_tree.nodes.active
                tn.image = dummy if base(s.material.name) in skip else ci
        bake("EMIT", set(), 1)
        cl = pixels(ci)
        for o in recv:
            for s, m0 in zip(o.material_slots, orig[o]):
                mc = s.material
                s.link = "DATA"
                if mc is not None and mc is not m0:
                    bpy.data.materials.remove(mc)
        kind = np.rint(cl[..., 0] * 4).astype(np.uint8)
        room = np.rint(cl[..., 1] * 32).astype(np.uint8)
        covered = alb[..., 3] > 0.5
        np.savez_compressed(os.path.join(args.cache, "base.npz"), albedo=(np.clip(alb[..., :3], 0, 1) * 65535).astype(np.uint16),
                            kind=kind, room=room, covered=covered, rooms=np.array(rooms))
        record("base", {}, "base.npz", round(time.time() - t, 2))
        log(f"base: albedo + class ({len(rooms)} floors) in {round(time.time() - t, 1)} s")

    for cid in want:
        cam = cams[cid]
        ob = bpy.data.objects.get(f"CAM_cp-{cid}")
        if ob is not None and ob.type == "CAMERA":
            mw = ob.matrix_world.copy()
            src = f"scene camera {ob.name}"
        else:
            mw = Matrix.Translation(Vector(cam["loc"])) @ Euler((math.radians(90), 0, math.radians(-cam["bearing"]))).to_matrix().to_4x4()
            src = "rebuilt from scenes.json + cameras.json"
        C = mw.translation.copy()
        R = mw.to_3x3().normalized()
        rows = (-R.col[2], -R.col[0], R.col[1])     # world dir -> env vector: camera forward = the pano's centre
        # ---- visibility ----
        vk = f"vis-{cid}"
        vextra = {"camera": [round(v, 4) for v in C] + [cam["bearing"]]}
        if not done(vk, vextra) and time.time() - t0 < args.max_seconds:
            t = time.time()
            for L in lights:
                L.hide_render = True
            glassy = [o for o in sc.objects if o.type == "MESH" and not o.hide_render and (
                "GLASS" in o.name.upper() or all(mm and base(mm.name) in ("glass", "M_glass") for mm in o.data.materials))]
            for o in glassy:
                o.hide_render = True
            if bg:
                bg.inputs[1].default_value = 0.0
            ld = bpy.data.lights.new("_pp_eye", "POINT")
            ld.energy = 2.0e5
            ld.shadow_soft_size = 0.0
            lo = bpy.data.objects.new("_pp_eye", ld)
            lo.location = C
            sc.collection.objects.link(lo)
            vi = img(f"_pp_vis_{cid}")
            target(vi)
            sc.render.bake.use_pass_direct = True
            sc.render.bake.use_pass_indirect = False
            sc.render.bake.use_pass_color = False
            bake("DIFFUSE", {"DIRECT"}, 4)
            vis = pixels(vi)[..., :3].max(axis=2)
            bpy.data.objects.remove(lo, do_unlink=True)
            for L in lights:
                L.hide_render = False
            for o in glassy:
                o.hide_render = False
            if bg is not None:
                bg.inputs[1].default_value = bg_strength
            np.savez_compressed(os.path.join(args.cache, f"{vk}.npz"), vis=vis.astype(np.float32))
            record(vk, vextra, f"{vk}.npz", round(time.time() - t, 2))
            log(f"{cid}: visibility ({src}), {(vis > 1e-4).sum():,} texels seen, {round(time.time() - t, 1)} s")
        # ---- colour per set ----
        for st in sets:
            pano = os.path.join(args.tour, "_local", f"panos-{st}", f"{cam['asset']}.webp")
            if not os.path.isfile(pano):
                log(f"{cid}/{st}: no pano {pano}")
                continue
            ck = f"col-{cid}-{st}"
            cextra = {"camera": vextra["camera"], "pano_sha256": sha(pano)}
            if done(ck, cextra) or time.time() - t0 >= args.max_seconds:
                continue
            t = time.time()
            pim = bpy.data.images.load(pano)
            pim.colorspace_settings.name = "Non-Color"     # the bytes as they are: the atlas stores sRGB bytes

            def make(m, nt):
                geo = nt.nodes.new("ShaderNodeNewGeometry")
                sub = nt.nodes.new("ShaderNodeVectorMath")
                sub.operation = "SUBTRACT"
                sub.inputs[1].default_value = C
                nt.links.new(geo.outputs["Position"], sub.inputs[0])
                comb = nt.nodes.new("ShaderNodeCombineXYZ")
                added = [geo, sub, comb]
                for i, r in enumerate(rows):
                    dot = nt.nodes.new("ShaderNodeVectorMath")
                    dot.operation = "DOT_PRODUCT"
                    dot.inputs[1].default_value = r
                    nt.links.new(sub.outputs[0], dot.inputs[0])
                    nt.links.new(dot.outputs["Value"], comb.inputs[i])
                    added.append(dot)
                env = nt.nodes.new("ShaderNodeTexEnvironment")
                env.image = pim
                env.interpolation = "Cubic"
                nt.links.new(comb.outputs[0], env.inputs["Vector"])
                added.append(env)
                return added, env.outputs["Color"]
            restore = emission_override(make)
            co = img(f"_pp_col_{cid}_{st}")
            target(co)
            bake("EMIT", set(), 1)
            restore()
            col = (np.clip(pixels(co)[..., :3], 0, 1) * 255 + 0.5).astype(np.uint8)
            bpy.data.images.remove(pim)
            np.savez_compressed(os.path.join(args.cache, f"{ck}.npz"), col=col)
            record(ck, cextra, f"{ck}.npz", round(time.time() - t, 2))
            log(f"{cid}/{st}: colour from {os.path.basename(pano)} in {round(time.time() - t, 1)} s")
    left = [k for k in [f"vis-{c}" for c in want] + [f"col-{c}-{s}" for c in want for s in sets] if k not in man["items"]]
    log(f"run done in {round(time.time() - t0, 1)} s; items still owed: {len(left)}")
    return 0 if not left else 5      # 5 = run again (the manifest skips what is done)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    sys.exit(main(parse(argv)))

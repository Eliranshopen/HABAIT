# Copied 2026-11-18 from the Hatzav job (harei-zahav-naama scripts/blender/project_photos.py) for Avnei Hefetz Kedem B10 apt 3; unchanged logic.
"""The photo skin (Eliran 2026-11-17: «I WANT THAT THE RESULT WILL BE 3D WALK AROUND WITH THE PHOTOS I GAVE YOU AND I WANT IT REALISTIC»):
the realistic photos of the walk (step 22, the developer's renders as the look) are projected back onto the baked atlases of the
walk model, so walking shows their materials and light everywhere a photo saw.

Run: blender -b <walk>/prep.blend --factory-startup -P scripts/blender/project_photos.py -- --walk <walk dir> --views <views.json> --out <dir>
views.json: [{"name", "photo", "pos": [x,y,z] (three.js metres), "yaw", "pitch" (three.js camera radians, order YXZ), "fov_v", "w", "h"}]
Per atlas group k: bakes world position + normal (EMIT, 1 sample), renders each view's depth from the same camera (shell AND the live
pieces, so nothing projects through a sofa), then for every texel: project into each photo, keep it if the depth agrees (±3 cm) and the
surface faces the camera, weight = facing^2 / distance, blend the photos' colours; atlas = mix(baked, photos, coverage).
Writes <out>/bake_<k>.jpg (+ coverage_<k>.png) and <out>/project.json. Never saves the .blend. $0.
"""
import argparse
import json
import math
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument("--walk", required=True)
ap.add_argument("--views", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=2048)
ap.add_argument("--groups", default="")
a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:])
a.walk, a.out = os.path.abspath(a.walk), os.path.abspath(a.out)
os.makedirs(a.out, exist_ok=True)
V = json.load(open(a.views, encoding="utf-8"))
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 1
sc.cycles.use_denoising = False
t0 = time.time()
log = lambda *x: print("[proj]", *x, flush=True)  # noqa: E731


def three_to_blender(v):
    return Vector((v[0], -v[2], v[1]))


def camera_for(v):
    psi, th = v["yaw"], v["pitch"]
    fwd = (-math.sin(psi) * math.cos(th), math.sin(th), -math.cos(psi) * math.cos(th))
    up = (math.sin(psi) * math.sin(th), math.cos(th), math.cos(psi) * math.sin(th))
    F, U = three_to_blender(fwd).normalized(), three_to_blender(up).normalized()
    R = F.cross(U).normalized()
    cd = bpy.data.cameras.new("proj_" + v["name"])
    cd.sensor_fit = "VERTICAL"
    cd.angle_y = math.radians(v["fov_v"])
    cd.clip_start = 0.05
    cd.clip_end = 100
    ob = bpy.data.objects.new("proj_" + v["name"], cd)
    sc.collection.objects.link(ob)
    m = Matrix((R, U, -F)).transposed().to_4x4()
    m.translation = three_to_blender(v["pos"])
    ob.matrix_world = m
    return ob, three_to_blender(v["pos"]), F, U, R


# ---- 1. depth of every view (z along the view axis) by ray casts through the full scene: shell + live pieces (glass skipped)
for o in bpy.data.objects:
    if o.type == "MESH" and o.get("walk") == "glass":
        o.hide_viewport = True   # glass and curtains: the photos see through them
dg = bpy.context.evaluated_depsgraph_get()
DW, DH = 1152, 768
views = []
for v in V:
    cam, C, F, U, R = camera_for(v)
    tan = math.tan(math.radians(v["fov_v"]) / 2)
    asp = v["w"] / v["h"]
    depth = np.full((DH, DW), 1e3, np.float32)   # rows bottom-up, like the photo's pixels
    for j in range(DH):
        yy = ((j + 0.5) / DH * 2 - 1) * tan
        for i in range(DW):
            xx = ((i + 0.5) / DW * 2 - 1) * tan * asp
            d = (F + R * xx + U * yy).normalized()
            hit, loc, *_ = sc.ray_cast(dg, C, d)
            if hit:
                depth[j, i] = (loc - C).dot(F)
    ph = bpy.data.images.load(os.path.abspath(v["photo"]), check_existing=False)
    pw, phh = ph.size
    pp = np.empty(pw * phh * 4, dtype=np.float32)
    ph.pixels.foreach_get(pp)
    photo = pp.reshape(phh, pw, 4)[..., :3]       # rows bottom-up
    pad = np.pad(depth, 2, mode="edge")
    win = np.stack([pad[dy:dy + DH, dx:dx + DW] for dy in range(5) for dx in range(5)])
    edge = (win.max(0) - win.min(0)) > 0.2 + 0.03 * depth   # near a silhouette: the AI photo may be a few pixels off
    views.append(dict(name=v["name"], C=np.array(C), F=np.array(F), U=np.array(U), R=np.array(R), depth=depth, edge=edge,
                      tan=tan, aspect=asp, photo=photo))
    log("view", v["name"], "depth", DW, DH, "photo", pw, phh, "%.0fs" % (time.time() - t0))

# one exposure for every photo: each is scaled so its mean matches the mean of all (the photos stay consistent with one another)
means = [vv["photo"].reshape(-1, 3).mean(0) for vv in views]
target = np.mean(means, axis=0)
for vv, m in zip(views, means):
    vv["photo"] = vv["photo"] * (target / np.maximum(m, 1e-4))

# ---- 2. per atlas group: world position + normal, then the projection
groups = sorted({o["walk_group"] for o in bpy.data.objects if o.type == "MESH" and "walk_group" in o})
if a.groups:
    groups = [g for g in groups if str(g) in a.groups.split(",")]
emit = bpy.data.materials.new("PROJ_EMIT")
emit.use_nodes = True
en = emit.node_tree
for n in list(en.nodes):
    en.nodes.remove(n)
geo = en.nodes.new("ShaderNodeNewGeometry")
em = en.nodes.new("ShaderNodeEmission")
out = en.nodes.new("ShaderNodeOutputMaterial")
en.links.new(em.outputs["Emission"], out.inputs["Surface"])
tex = en.nodes.new("ShaderNodeTexImage")
en.nodes.active = tex
report = {"views": [v["name"] for v in V], "groups": {}}
for k in groups:
    objs = [o for o in bpy.data.objects if o.type == "MESH" and o.get("walk_group") == k]
    o = objs[0]
    o.data.uv_layers.active = o.data.uv_layers["bake"]
    saved = [s.material for s in o.material_slots]
    for s in o.material_slots:
        s.material = emit
    maps = {}
    for what in ("Position", "Normal"):
        im = bpy.data.images.new(f"proj_{what}_{k}", a.res, a.res, float_buffer=True, alpha=False)
        tex.image = im
        for l in list(en.links):
            if l.to_node == em:
                en.links.remove(l)
        en.links.new(geo.outputs[what], em.inputs["Color"])
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.bake(type="EMIT", margin=2, use_clear=True)
        p = np.empty(a.res * a.res * 4, dtype=np.float32)
        im.pixels.foreach_get(p)
        maps[what] = p.reshape(a.res, a.res, 4)[..., :3]
    for s, m in zip(o.material_slots, saved):
        s.material = m
    P, N = maps["Position"].reshape(-1, 3), maps["Normal"].reshape(-1, 3)
    valid = np.linalg.norm(N, axis=1) > 0.5
    acc = np.zeros((P.shape[0], 3), np.float32)
    wsum = np.zeros(P.shape[0], np.float32)
    for vv in views:
        d = P - vv["C"]
        z = d @ vv["F"]
        ok = valid & (z > 0.1)
        n0 = int(ok.sum())
        x = (d @ vv["R"]) / np.maximum(z, 1e-3) / (vv["tan"] * vv["aspect"])
        y = (d @ vv["U"]) / np.maximum(z, 1e-3) / vv["tan"]
        ok &= (np.abs(x) < 0.98) & (np.abs(y) < 0.98)
        n1 = int(ok.sum())
        H, Wd = vv["depth"].shape
        cx = np.clip(((x + 1) / 2 * Wd).astype(int), 0, Wd - 1)
        cy = np.clip(((y + 1) / 2 * H).astype(int), 0, H - 1)
        dd = vv["depth"][cy, cx] - z
        n1b = int((ok & (np.abs(dd) < 0.5)).sum())
        if k == groups[-1] or k == groups[0]:
            sel = ok.nonzero()[0][:: max(1, n1 // 6)][:6]
            log("debug", k, vv["name"], "z", np.round(z[sel], 2).tolist(), "depth", np.round(vv["depth"][cy[sel], cx[sel]], 2).tolist(), "P", np.round(P[sel], 2).tolist())
        ok &= np.abs(dd) < 0.04 + 0.015 * z
        ok &= ~vv["edge"][cy, cx]
        n2 = int(ok.sum())
        dist = np.linalg.norm(d, axis=1)
        facing = np.clip(-(N * d).sum(1) / np.maximum(dist, 1e-3), 0, 1)
        ok &= facing > 0.15
        log("filter", k, vv["name"], "in front", n0, "in frame", n1, "depth<0.5m", n1b, "depth ok", n2, "facing", int(ok.sum()))
        r = np.maximum(np.abs(x), np.abs(y))
        fall = np.clip((0.97 - r) / 0.25, 0, 1) ** 2      # fades toward the photo's border, so two photos meet without a line
        w = np.where(ok, fall * facing ** 2 / np.maximum(dist, 0.5), 0).astype(np.float32)
        PH, PW = vv["photo"].shape[:2]
        px_ = np.clip(((x + 1) / 2 * PW).astype(int), 0, PW - 1)
        py_ = np.clip(((y + 1) / 2 * PH).astype(int), 0, PH - 1)
        acc += vv["photo"][py_, px_] * w[:, None]
        wsum += w
        report.setdefault("cover", {})[f"{k}:{vv['name']}"] = int(ok.sum())
    proj = acc / np.maximum(wsum, 1e-6)[:, None]
    cov = np.clip(wsum / 0.015, 0, 1)   # any clear view covers a texel (the floor is always seen at a slant from eye height); the edge of a view fades in
    # the baked atlas of this group (display-referred JPEG → linear, the photos are linear too)
    src = os.path.join(a.walk, "gl", "bake_%d.jpg" % k)
    bimg = bpy.data.images.load(src, check_existing=False)
    if tuple(bimg.size) != (a.res, a.res):
        bimg.scale(a.res, a.res)
    bp = np.empty(a.res * a.res * 4, dtype=np.float32)
    bimg.pixels.foreach_get(bp)
    base = bp.reshape(-1, 4)[:, :3]
    # the texels no photo saw take the photos' tone: one gain per channel from the covered texels (photos / bake)
    sel = cov > 0.5
    gain = (proj[sel].mean(0) / np.maximum(base[sel].mean(0), 1e-3)) if sel.sum() > 1000 else np.ones(3)
    gain = np.clip(gain, 0.9, 1.1)
    outc = (base * gain) * (1 - cov[:, None]) + proj * cov[:, None]
    report.setdefault("gain", {})[str(k)] = np.round(gain, 3).tolist()
    res = bpy.data.images.new(f"skin_{k}", a.res, a.res, alpha=False)
    res.pixels.foreach_set(np.concatenate([outc, np.ones((outc.shape[0], 1), np.float32)], 1).ravel())
    res.filepath_raw = os.path.join(a.out, "bake_%d.jpg" % k)
    res.file_format = "JPEG"
    sc.render.image_settings.quality = 90
    res.save()
    cv = bpy.data.images.new(f"cov_{k}", a.res, a.res, alpha=False)
    cv.pixels.foreach_set(np.repeat(cov[:, None], 4, 1).ravel())
    cv.filepath_raw = os.path.join(a.out, "coverage_%d.png" % k)
    cv.file_format = "PNG"
    cv.save()
    report["groups"][str(k)] = {"texels": int(valid.sum()), "covered_share": round(float((cov[valid] > 0.5).mean()) if valid.any() else 0, 3)}
    log("group", k, report["groups"][str(k)], "%.0fs" % (time.time() - t0))
json.dump(report, open(os.path.join(a.out, "project.json"), "w"), indent=1)
print("PROJECT_OK", json.dumps(report["groups"]))

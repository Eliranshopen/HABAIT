"""render_check.py - lane C1: render the baked site (bake_skins.py -> renders/baked/baked.blend) from NEW camera positions along a
plausible flight a -> b -> c -> d, measure coverage / blur per view and temporal stability, and build a contact sheet.

  "$BLENDER" -b "$F/renders/baked/baked.blend" -P "$F/render_check.py" -- --out "$F/renders/baked-check" [--samples 16]
        [--views p1_ab30,e1_ab60,...] [--variants baked,clay,cov] [--seq 6] [--no-contact]
  the Blender run ends by calling the venv python on this file with --contact-only (PIL + cv2): contact.jpg + temporal metrics.

Cycles CPU, emission-only materials (the skins already carry the light), max_bounces 0, view transform Standard (texture colour
in = pixel colour out). Variants: baked (the baked skins), clay (geometry reference: normal-shaded grey), cov (EXR, 1 spp, no
filter: R = coverage code of the texel the pixel sees, G = projector footprint code, B = camera distance / 1000).
Coverage codes (bake_skins.py): tower 1 sharp, 2 soft, 3 smeared, 4 hole, 5 unbaked; surroundings 7..10 the same, 12 = raw
orthophoto outside the baked ground patch. "blurry in view" = covered tower pixels whose projector footprint is more than two
screen pixels (fp / (distance * pixel angle) > 2).
Camera path: uniform Catmull-Rom through the node positions (t 0 = a, 1 = b, 2 = c, 3 = d) + a lateral offset, so no camera is
at a node. Look target: tower centre (-5.9, -13.0, 14) until b, blending to the 846 hotspot (10.33, -11.15, 1.0) by c.
"""
import sys, os, json, math, time, subprocess

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
PY = "C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe"
TOWER_C = (-5.9, -13.0, 14.0)
HOT = (10.325, -11.148, 1.0)
VIEWS = [  # id, kind, t on the a->b->c->d path, lateral offset m (+ = right of travel), lens mm, look mode, note
    ("p1_ab30", "persp", 0.30, 25.0, 30, "tower", "a->b 30%, 25 m right of the line"),
    ("e1_ab60", "equi", 0.60, -20.0, 0, "tower", "a->b 60%, 20 m left (360 equirect)"),
    ("p2_bc35", "persp", 1.35, 0.0, 28, "path", "b->c 35%"),
    ("p3_orbit75", "persp", None, 0.0, 30, "tower", "intro orbit: node-b turned 75 deg"),
    ("p4_bc75", "persp", 1.75, 6.0, 24, "path", "b->c 75%, 6 m right"),
    ("e2_cd50", "equi", 2.50, 0.0, 0, "hot", "c->d 50% (360, ~9 m from facade)"),
]
SANITY = ("s_nodeb", "equi", 1.0, 0.0, 0, "nodec", "AT node-b: must reproduce the skin")
SEQ_T = (1.40, 1.65)
COLORS = {1: (60, 200, 80), 2: (240, 220, 60), 3: (250, 140, 40), 4: (230, 40, 40), 5: (220, 60, 220)}


# =================================================================== Blender side
def blender_main():
    import bpy
    import numpy as np
    from mathutils import Vector

    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=HERE + "/renders/baked-check")
    ap.add_argument("--samples", type=int, default=16)
    ap.add_argument("--views", default="")
    ap.add_argument("--variants", default="baked,clay,cov")
    ap.add_argument("--seq", type=int, default=6)
    ap.add_argument("--no-contact", action="store_true")
    ap.add_argument("--orbit", type=int, default=12, help="coverage-only sweep: N azimuths on node-b's ring and on node-a's ring (480x270)")
    a = ap.parse_args(argv)
    out = a.out.replace("\\", "/")
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    nodes = json.loads(sc["nodes"])
    P = [np.array(n["O"], float) for n in nodes]
    log = lambda *x: print("[check]", *x, flush=True)

    def cr(t):
        i = min(int(math.floor(t)), 2)
        u = t - i
        p0 = P[max(i - 1, 0)]; p1 = P[i]; p2 = P[i + 1]; p3 = P[min(i + 2, 3)]
        return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)

    def look_at_t(t):
        s = min(max(t - 1.0, 0.0), 1.0)
        s = s * s * (3 - 2 * s)
        return np.array(TOWER_C) * (1 - s) + np.array(HOT) * s

    def cam_pose(v):
        vid, kind, t, lat, lens, mode, note = v
        if t is None:  # orbit: node-b (or node-a for ring "a") rotated about the tower axis
            b = P[0] if vid.startswith("orbA") else P[1]
            ang = math.radians(float(vid.split("_")[1]) if vid.startswith("orb") else 75)
            dx, dy = b[0] - TOWER_C[0], b[1] - TOWER_C[1]
            pos = np.array([TOWER_C[0] + dx * math.cos(ang) - dy * math.sin(ang), TOWER_C[1] + dx * math.sin(ang) + dy * math.cos(ang), b[2]])
        else:
            pos = cr(t)
            tan = cr(min(t + 0.01, 3)) - cr(max(t - 0.01, 0))
            tan[2] = 0
            tan /= np.linalg.norm(tan)
            right = np.array([tan[1], -tan[0], 0.0])
            pos = pos + right * lat
        look = {"tower": np.array(TOWER_C), "hot": np.array(HOT), "path": look_at_t(t if t is not None else 0), "nodec": None}[mode]
        if mode == "nodec":
            look = pos + np.array(nodes[1]["c"])
        return pos, look

    cam_data = bpy.data.cameras.new("CHK")
    cam = bpy.data.objects.new("CHK", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam

    def place(v):
        pos, look = cam_pose(v)
        kind, lens = v[1], v[4]
        cam.location = Vector(pos.tolist())
        d = look - pos
        if kind == "equi":
            d[2] = 0
            cam_data.type = "PANO"
            try:
                cam_data.panorama_type = "EQUIRECTANGULAR"
            except Exception:
                cam_data.cycles.panorama_type = "EQUIRECTANGULAR"
            sc.render.resolution_x, sc.render.resolution_y = 1280, 640
        else:
            cam_data.type = "PERSP"
            cam_data.lens = lens
            cam_data.sensor_width = 36
            sc.render.resolution_x, sc.render.resolution_y = 960, 540
        cam_data.clip_start = 0.1
        cam_data.clip_end = 20000
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = Vector(d.tolist()).to_track_quat("-Z", "Y")
        return pos, look

    # ---------------- materials per variant
    bk = [o for o in bpy.data.objects if o.type == "MESH"]
    orig = {o.name: [m for m in o.data.materials] for o in bk}

    def mk(name, fn):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        o = nt.nodes.new("ShaderNodeOutputMaterial")
        e = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(e.outputs[0], o.inputs["Surface"])
        nt.links.new(fn(nt), e.inputs["Color"])
        return m

    def clay_fn(albedo):
        def f(nt):
            g = nt.nodes.new("ShaderNodeNewGeometry")
            dp = nt.nodes.new("ShaderNodeVectorMath"); dp.operation = "DOT_PRODUCT"
            L = Vector((0.35, -0.45, 0.82)).normalized()
            dp.inputs[1].default_value = L
            nt.links.new(g.outputs["Normal"], dp.inputs[0])
            mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MAXIMUM"; mx.inputs[1].default_value = 0.0
            nt.links.new(dp.outputs["Value"], mx.inputs[0])
            ma = nt.nodes.new("ShaderNodeMath"); ma.operation = "MULTIPLY_ADD"; ma.inputs[1].default_value = 0.65; ma.inputs[2].default_value = 0.35
            nt.links.new(mx.outputs[0], ma.inputs[0])
            mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"
            mul.inputs["Factor"].default_value = 1.0
            mul.inputs[6].default_value = (*albedo, 1)
            cmb = nt.nodes.new("ShaderNodeCombineColor")
            for k in range(3):
                nt.links.new(ma.outputs[0], cmb.inputs[k])
            nt.links.new(cmb.outputs[0], mul.inputs[7])
            return mul.outputs[2]
        return f

    def cov_fn(ob):
        def f(nt):
            cd = nt.nodes.new("ShaderNodeCameraData")
            dv = nt.nodes.new("ShaderNodeMath"); dv.operation = "DIVIDE"; dv.inputs[1].default_value = 1000.0
            nt.links.new(cd.outputs["View Distance"], dv.inputs[0])
            cmb = nt.nodes.new("ShaderNodeCombineColor")
            nt.links.new(dv.outputs[0], cmb.inputs[2])
            g = ob.get("group", "")
            if "cov_png" in ob:
                t = nt.nodes.new("ShaderNodeTexImage")
                t.image = bpy.data.images.load(ob["cov_png"], check_existing=True)
                t.image.colorspace_settings.name = "Non-Color"
                t.interpolation = "Closest"
                uv = nt.nodes.new("ShaderNodeUVMap"); uv.uv_map = "bake"
                nt.links.new(uv.outputs["UV"], t.inputs["Vector"])
                sep = nt.nodes.new("ShaderNodeSeparateColor")
                nt.links.new(t.outputs["Color"], sep.inputs[0])
                nt.links.new(sep.outputs[0], cmb.inputs[0]); nt.links.new(sep.outputs[1], cmb.inputs[1])
            elif g == "tower_detail":
                at = nt.nodes.new("ShaderNodeVertexColor"); at.layer_name = "cov"
                sep = nt.nodes.new("ShaderNodeSeparateColor")
                nt.links.new(at.outputs["Color"], sep.inputs[0])
                nt.links.new(sep.outputs[0], cmb.inputs[0]); nt.links.new(sep.outputs[1], cmb.inputs[1])
            else:
                cmb.inputs[0].default_value = {"tower_hidden": 5, "ortho": 12}.get(g, 0) * 20 / 255.0
            return cmb.outputs[0]
        return f

    clay_alb = {"tower": (0.62, 0.62, 0.60), "tower_detail": (0.45, 0.47, 0.45), "tower_hidden": (0.62, 0.62, 0.60), "podium": (0.80, 0.79, 0.76),
                "nb": (0.70, 0.69, 0.66), "apt": (0.78, 0.76, 0.72)}
    mats = {"clay": {}, "cov": {}}
    for o in bk:
        g = o.get("group", "")
        if g == "ortho":
            mats["clay"][o.name] = None
        elif g.startswith("ground"):
            def gfn(nt):
                t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images["orthophoto"]
                uv = nt.nodes.new("ShaderNodeUVMap"); uv.uv_map = "ortho"
                nt.links.new(uv.outputs["UV"], t.inputs["Vector"])
                return t.outputs["Color"]
            mats["clay"][o.name] = mk("CL_" + o.name, gfn)
        else:
            mats["clay"][o.name] = mk("CL_" + o.name, clay_fn(clay_alb.get(g, (0.7, 0.7, 0.7))))
        mats["cov"][o.name] = mk("CV_" + o.name, cov_fn(o))
    world_nt = sc.world.node_tree
    bg = [n for n in world_nt.nodes if n.type == "BACKGROUND"][0]

    def use_variant(var):
        for o in bk:
            m = orig[o.name] if var == "baked" or (var == "clay" and mats["clay"][o.name] is None) else [mats[var][o.name]]
            o.data.materials.clear()
            for mm in m:
                o.data.materials.append(mm)
        bg.inputs["Strength"].default_value = 0.0 if var == "cov" else 1.0
        cy = sc.cycles
        cy.device = "CPU"
        cy.use_denoising = False
        cy.max_bounces = 0
        cy.use_adaptive_sampling = False
        cy.caustics_reflective = cy.caustics_refractive = False
        if var == "cov":
            cy.samples = 1
            cy.filter_width = 0.01
            sc.render.image_settings.file_format = "OPEN_EXR"
            sc.render.image_settings.color_depth = "32"
            sc.render.image_settings.color_mode = "RGB"
        else:
            cy.samples = a.samples if var == "baked" else max(4, a.samples // 2)
            cy.filter_width = 1.5
            sc.render.image_settings.file_format = "PNG"
            sc.render.image_settings.color_depth = "8"
            sc.render.image_settings.color_mode = "RGB"

    sc.render.engine = "CYCLES"
    sc.render.use_persistent_data = True
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.resolution_percentage = 100
    try:
        sc.render.threads_mode = "AUTO"
    except Exception:
        pass

    sel = [v for v in VIEWS if not a.views or v[0] in a.views.split(",")]
    jobs = [(v, var) for var in a.variants.split(",") for v in sel + [SANITY]]
    if a.seq:
        for k in range(a.seq):
            t = SEQ_T[0] + (SEQ_T[1] - SEQ_T[0]) * k / max(a.seq - 1, 1)
            v = (f"seq{k:02d}", "persp", t, 0.0, 28, "path", f"sequence frame {k} t={t:.3f}")
            jobs.append((v, "baked"))
            jobs.append((v, "clay"))
    orbit_jobs = []
    for ring in ("orbB", "orbA"):
        for k in range(a.orbit):
            az = 360.0 * k / a.orbit
            orbit_jobs.append(((f"{ring}_{az:.0f}", "persp", None, 0.0, 30 if ring == "orbB" else 35, "tower", f"{ring} az {az:.0f}"), "cov"))
    timings, poses = [], {}
    cur = None
    for v, var in jobs + orbit_jobs:
        if var != cur:
            use_variant(var)
            cur = var
        pos, look = place(v)
        poses[v[0]] = {"kind": v[1], "t": v[2], "lateral_m": v[3], "lens_mm": v[4], "pos": [round(x, 2) for x in pos], "look": [round(x, 2) for x in look], "note": v[6]}
        ext = "exr" if var == "cov" else "png"
        if v[0].startswith("orb"):
            sc.render.resolution_x, sc.render.resolution_y = 480, 270
            os.makedirs(f"{out}/orbit", exist_ok=True)
            sc.render.filepath = f"{out}/orbit/{v[0]}__{var}.{ext}"
        else:
            sc.render.filepath = f"{out}/{v[0]}__{var}.{ext}"
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        dt = time.time() - t0
        timings.append({"view": v[0], "variant": var, "res": [sc.render.resolution_x, sc.render.resolution_y], "samples": sc.cycles.samples, "s": round(dt, 2)})
        log(v[0], var, f"{dt:.1f}s")

    # ---------------- coverage stats + overlay pngs
    import zlib, struct

    def write_png(path, arr):
        arr = np.ascontiguousarray(arr)
        h, w, c = arr.shape
        raw = np.empty((h, 1 + w * c), np.uint8); raw[:, 0] = 0; raw[:, 1:] = arr.reshape(h, w * c)
        ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
        open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw.tobytes(), 6)) + ch(b"IEND", b""))

    def load(path):
        im = bpy.data.images.load(path, check_existing=False)
        w, h = im.size
        buf = np.empty(w * h * 4, np.float32)
        im.pixels.foreach_get(buf)
        bpy.data.images.remove(im)
        return buf.reshape(h, w, 4)[::-1]

    stats = {}
    for v in sel + [SANITY]:
        p = f"{out}/{v[0]}__cov.exr"
        if not os.path.exists(p):
            continue
        x = load(p)
        code = np.rint(x[..., 0] * 255 / 20).astype(np.int32)
        fp = np.rint(x[..., 1] * 255) / 50.0
        dist = x[..., 2] * 1000.0
        H, W = code.shape
        pix = (2 * math.pi / W) if v[1] == "equi" else (2 * math.atan(18.0 / v[4]) / W)
        tw = (code >= 1) & (code <= 5)
        n = int(tw.sum())
        s = {"tower_px": n, "tower_share_of_frame": round(n / code.size, 4)}
        for c, k in ((1, "sharp"), (2, "soft"), (3, "smeared"), (4, "hole"), (5, "unbaked")):
            s[k] = round(float((code == c).sum()) / max(n, 1), 4)
        s["uncovered"] = round(s["hole"] + s["unbaked"], 4)
        cov_t = tw & (code <= 3)
        mag = fp / np.maximum(dist * pix, 1e-6)
        s["blurry_in_view"] = round(float((cov_t & (mag > 2)).sum()) / max(int(cov_t.sum()), 1), 4)
        s["median_magnification"] = round(float(np.median(mag[cov_t])), 2) if cov_t.any() else None
        s["surface_px_not_coded"] = int(((code == 0) & (dist > 0)).sum())
        su = (code >= 7)
        m = int(su.sum())
        s["surround_px"] = m
        for c, k in ((7, "sharp"), (8, "soft"), (9, "smeared"), (10, "hole"), (11, "unbaked"), (12, "raw_ortho")):
            s["surround_" + k] = round(float((code == c).sum()) / max(m, 1), 4)
        sc_ = su & (code <= 9)
        s["surround_blurry_in_view"] = round(float((sc_ & (mag > 2)).sum()) / max(int(sc_.sum()), 1), 4)
        stats[v[0]] = s
        bp = f"{out}/{v[0]}__baked.png"
        if os.path.exists(bp):
            base = load(bp)[..., :3]
            ov = (base * 0.35 * 255).astype(np.uint8)
            for c, col in COLORS.items():
                ov[code == c] = col
            write_png(f"{out}/{v[0]}__covviz.png", ov)
        log("stats", v[0], json.dumps(s))
    orbit = {}
    for (v, _var) in orbit_jobs:
        p = f"{out}/orbit/{v[0]}__cov.exr"
        if not os.path.exists(p):
            continue
        x = load(p)
        code = np.rint(x[..., 0] * 255 / 20).astype(np.int32)
        tw = (code >= 1) & (code <= 5)
        n = max(int(tw.sum()), 1)
        ring, az = v[0].split("_")
        orbit.setdefault(ring, {})[az] = {"uncovered": round(float(((code == 4) | (code == 5)).sum()) / n, 4),
                                          "smeared": round(float((code == 3).sum()) / n, 4),
                                          "sharp_or_soft": round(float(((code == 1) | (code == 2)).sum()) / n, 4)}
        ov = np.zeros(code.shape + (3,), np.uint8)
        for c, col in COLORS.items():
            ov[code == c] = col
        write_png(f"{out}/orbit/{v[0]}__covviz.png", ov)
    log("orbit", json.dumps(orbit))
    rt = {}
    for t in timings:
        rt.setdefault(t["variant"], []).append(t["s"])
    json.dump({"views": {k: v for k, v in poses.items() if not k.startswith("orb")}, "orbit": orbit,
               "orbit_rings": {"orbB": "node-b radius/height, az 0 = node-b, + = counter-clockwise seen from above",
                               "orbA": "node-a radius/height, az 0 = node-a"},
               "coverage": stats, "timings": [t for t in timings if not t["view"].startswith("orb")], "sanity_skin": nodes[1]["skin"], "n_nodes": len(nodes),
               "render_s_mean": {k: round(sum(x) / len(x), 2) for k, x in rt.items()}}, open(f"{out}/stats.json", "w", encoding="utf8"), indent=1)
    if not a.no_contact:
        env = dict(os.environ, PYTHONIOENCODING="utf-8")
        subprocess.run([PY, "-I", os.path.abspath(__file__).replace("\\", "/"), "--contact-only", "--out", out], env=env, check=False)


# =================================================================== venv side: temporal metric + contact sheet
def contact_main():
    import argparse
    import numpy as np
    import cv2
    from PIL import Image, ImageDraw, ImageFont
    ap = argparse.ArgumentParser()
    ap.add_argument("--contact-only", action="store_true")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = a.out
    st = json.load(open(f"{out}/stats.json", encoding="utf8"))
    # temporal stability on the 6-frame sequence: Farneback flow k -> k+1, warp, residual (baked vs clay baseline)
    temporal = {}
    for var in ("baked", "clay"):
        fr = sorted(f for f in os.listdir(out) if f.startswith("seq") and f.endswith(f"__{var}.png"))
        res, raw = [], []
        for f0, f1 in zip(fr, fr[1:]):
            A = cv2.imread(f"{out}/{f0}"); B = cv2.imread(f"{out}/{f1}")
            ga = cv2.cvtColor(A, cv2.COLOR_BGR2GRAY); gb = cv2.cvtColor(B, cv2.COLOR_BGR2GRAY)
            flow = cv2.calcOpticalFlowFarneback(ga, gb, None, 0.5, 4, 21, 3, 5, 1.2, 0)
            h, w = ga.shape
            gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
            Bw = cv2.remap(B, gx + flow[..., 0], gy + flow[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            m = np.zeros((h, w), bool); m[16:-16, 16:-16] = True
            res.append(float(np.abs(Bw.astype(np.float32) - A.astype(np.float32)).mean(-1)[m].mean()))
            raw.append(float(np.abs(B.astype(np.float32) - A.astype(np.float32)).mean()))
        temporal[var] = {"pairs": len(res), "warped_residual_mae": [round(x, 2) for x in res], "raw_frame_diff_mae": [round(x, 2) for x in raw],
                         "warped_residual_mean": round(float(np.mean(res)), 2) if res else None}
    st["temporal"] = temporal
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 15); small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 12)
        big = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 18)
    except Exception:
        font = small = big = ImageFont.load_default()
    TW = 480
    LW = 250
    ids = [v[0] for v in VIEWS] + [SANITY[0]]
    rows = []
    def tile(path, h):
        if not os.path.exists(path):
            return Image.new("RGB", (TW, h), (60, 0, 0))
        return Image.open(path).convert("RGB").resize((TW, h), Image.LANCZOS)
    for vid in ids:
        if vid not in st["views"]:
            continue
        kind = st["views"][vid]["kind"]
        h = 240 if kind == "equi" else 270
        row = Image.new("RGB", (LW + 3 * TW + 8, h + 4), (24, 24, 24))
        if vid == SANITY[0]:
            # the skin itself | the baked scene re-rendered from the same spot | |difference| x3
            bk = cv2.imread(f"{out}/{vid}__baked.png")
            sk = cv2.resize(cv2.imread(st["sanity_skin"]), (bk.shape[1], bk.shape[0]), interpolation=cv2.INTER_AREA)
            df = np.abs(sk.astype(np.float32) - bk.astype(np.float32))
            st["sanity"] = {"mae_all": round(float(df.mean()), 2), "mae_lower_half": round(float(df[df.shape[0] // 2:].mean()), 2)}
            cv2.imwrite(f"{out}/{vid}__skin.png", sk)
            cv2.imwrite(f"{out}/{vid}__covviz.png", np.clip(df * 3, 0, 255).astype(np.uint8))
            row.paste(tile(f"{out}/{vid}__skin.png", h), (LW, 2))
        else:
            row.paste(tile(f"{out}/{vid}__clay.png", h), (LW, 2))
        row.paste(tile(f"{out}/{vid}__baked.png", h), (LW + TW + 4, 2))
        row.paste(tile(f"{out}/{vid}__covviz.png", h), (LW + 2 * TW + 8, 2))
        if vid == SANITY[0]:
            ImageDraw.Draw(row).text((LW + 6, h - 20), "skin (GPT, node-b)", fill=(255, 255, 0), font=small)
            ImageDraw.Draw(row).text((LW + 2 * TW + 14, h - 20), f"|skin - re-render| x3, MAE {st['sanity']['mae_all']}", fill=(255, 255, 0), font=small)
        d = ImageDraw.Draw(row)
        d.text((8, 6), vid, fill=(255, 255, 255), font=big)
        d.text((8, 30), st["views"][vid]["note"], fill=(200, 200, 200), font=small)
        p = st["views"][vid]["pos"]
        d.text((8, 46), f"pos {p[0]:.0f}, {p[1]:.0f}, {p[2]:.0f}  ({kind})", fill=(200, 200, 200), font=small)
        c = st["coverage"].get(vid)
        if c:
            lines = [f"tower px {c['tower_share_of_frame']*100:.0f}% of frame",
                     f"uncovered {c['uncovered']*100:.1f}%  (hole {c['hole']*100:.1f}, unbaked {c['unbaked']*100:.1f})",
                     f"smeared {c['smeared']*100:.1f}%  soft {c['soft']*100:.1f}%  sharp {c['sharp']*100:.1f}%",
                     f"blurry in view {c['blurry_in_view']*100:.0f}%  (mag x{c['median_magnification']})",
                     f"surround: hole {c['surround_hole']*100:.0f}%  smeared {c['surround_smeared']*100:.0f}%",
                     f"  raw ortho {c['surround_raw_ortho']*100:.0f}%  blurry {c['surround_blurry_in_view']*100:.0f}%"]
            for i, l in enumerate(lines):
                d.text((8, 70 + 17 * i), l, fill=(255, 230, 150) if i == 1 else (230, 230, 230), font=small)
        tb = [t["s"] for t in st["timings"] if t["view"] == vid and t["variant"] == "baked"]
        if tb:
            d.text((8, h - 22), f"render {tb[0]:.1f} s (CPU, {[t for t in st['timings'] if t['view'] == vid and t['variant'] == 'baked'][0]['samples']} spp)", fill=(180, 180, 255), font=small)
        rows.append(row)
    seq = sorted(f for f in os.listdir(out) if f.startswith("seq") and f.endswith("__baked.png"))
    sh = 0
    if seq:
        sw = (3 * TW + 8) // len(seq)
        shh = int(sw * 9 / 16)
        srow = Image.new("RGB", (LW + 3 * TW + 8, shh + 4), (24, 24, 24))
        for i, f in enumerate(seq):
            srow.paste(Image.open(f"{out}/{f}").convert("RGB").resize((sw - 2, shh), Image.LANCZOS), (LW + i * sw, 2))
        d = ImageDraw.Draw(srow)
        d.text((8, 6), "seq (6 frames, b->c)", fill=(255, 255, 255), font=big)
        tb, tc = temporal["baked"], temporal["clay"]
        d.text((8, 32), f"flow-warped residual MAE", fill=(230, 230, 230), font=small)
        d.text((8, 48), f"baked {tb['warped_residual_mean']}  clay {tc['warped_residual_mean']}", fill=(255, 230, 150), font=small)
        d.text((8, 64), "(0-255; baked ~ clay = stable)", fill=(200, 200, 200), font=small)
        rows.append(srow)
    for ring in ("orbB", "orbA"):
        ob = st.get("orbit", {}).get(ring)
        if not ob:
            continue
        azs = sorted(ob, key=lambda z: float(z))
        sw = (3 * TW + 8) // len(azs)
        shh = int(sw * 9 / 16)
        orow = Image.new("RGB", (LW + 3 * TW + 8, shh + 20), (24, 24, 24))
        d = ImageDraw.Draw(orow)
        d.text((8, 6), f"orbit {ring[-1]} (coverage)", fill=(255, 255, 255), font=big)
        d.text((8, 32), "node-" + ("b" if ring == "orbB" else "a") + " ring, az 0 = the node", fill=(200, 200, 200), font=small)
        for i, az in enumerate(azs):
            f = f"{out}/orbit/{ring}_{az}__covviz.png"
            if os.path.exists(f):
                orow.paste(Image.open(f).convert("RGB").resize((sw - 2, shh), Image.NEAREST), (LW + i * sw, 2))
            d.text((LW + i * sw + 4, shh + 3), f"{az}: {ob[az]['uncovered']*100:.0f}% unc", fill=(255, 230, 150), font=small)
        rows.append(orow)
    head = Image.new("RGB", (LW + 3 * TW + 8, 30), (10, 10, 10))
    d = ImageDraw.Draw(head)
    d.text((LW + 4, 6), "clay (geometry)", fill=(255, 255, 255), font=font)
    d.text((LW + TW + 8, 6), f"baked GPT skins ({st.get('n_nodes', 4)} nodes)", fill=(255, 255, 255), font=font)
    d.text((LW + 2 * TW + 12, 6), "tower coverage", fill=(255, 255, 255), font=font)
    x = LW + 2 * TW + 130
    for c, (lab) in ((1, "sharp"), (2, "soft"), (3, "smeared"), (4, "hole"), (5, "unbaked")):
        d.rectangle([x, 9, x + 12, 21], fill=COLORS[c]); d.text((x + 15, 8), lab, fill=(220, 220, 220), font=small); x += 62
    H = head.height + sum(r.height for r in rows)
    sheet = Image.new("RGB", (head.width, H), (24, 24, 24))
    sheet.paste(head, (0, 0))
    y = head.height
    for r in rows:
        sheet.paste(r, (0, y)); y += r.height
    sheet.save(f"{out}/contact.jpg", quality=88)
    json.dump(st, open(f"{out}/stats.json", "w", encoding="utf8"), indent=1)
    print("[contact]", f"{out}/contact.jpg", json.dumps(temporal))


if __name__ == "__main__" and "--contact-only" in sys.argv:
    contact_main()
else:
    blender_main()

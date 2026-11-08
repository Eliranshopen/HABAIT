"""life.py - lane C2 (board card 16): animated "life" layers on top of habait-ab's baked flyover scene, without moving
any static geometry. Birds (boids particle flock, billboard sprites), cars (low-poly boxes on OSM road paths), people
(animated walk-cycle billboards on sidewalks / podium roofs / plaza), trees (wind on procedural foliage), sea (shader
waves; only on an existing sea plane unless life.json asks for the OSM coast). Two presets: morning, evening.

Scene of record (READ-ONLY, card 15): Habait/flyover/renders/baked/baked.blend. life.py never saves over it and never
edits a BK_* / STUDIO_* object; everything it adds lives in the collection LIFE (names LIFE_*). The only writes are under
Habait/flyover/life/_local/.

Two run modes.

  Plain python (venv, no Blender):
    $PY Habait/flyover/life/life.py --make-roads      # site.json (OSM roads + coast, local metres) -> plan-world, into life.json
    $PY Habait/flyover/life/life.py --print-commands  # the preview / check commands for habait-98 or Kaggle

  Inside Blender (the .blend is opened read-only by Blender itself, no --factory-startup needed for the scene):
    "$BLENDER" -b Habait/flyover/renders/baked/baked.blend -P Habait/flyover/life/life.py -- --selftest [--preset morning,evening]
        builds every layer in memory, bakes the boids, checks that no static object moved between the first and the last
        frame (evaluated vertex hashes), projects every life element through the preview camera, writes the sprite
        atlases + _local/selftest-<preset>.json. NO render, NO save.
    "$BLENDER" -b Habait/flyover/renders/baked/baked.blend -P Habait/flyover/life/life.py -- --preset morning --pass preview
        renders 240 frames (render.frames in life.json = 121..360: 10 s @ 24 fps after a 120-frame boids pre-warm; 480x270,
        EEVEE) to _local/<preset>/frames/, then three stills for the static
        check (tower-mask.png, matte_first.png, matte_last.png), then encodes _local/<preset>/preview-<preset>.mp4.
    "$BLENDER" -b --factory-startup -P Habait/flyover/life/life.py -- --encode-only _local/<preset>/frames --mp4 <file>

Frames: Blender plan-world (X right, Y up the plan sheet, Z up, metres; unit 846 floor at z 0, ground at about -52.35).
Sun azimuths in life.json are TRUE bearings; plan bearing = true + north_deg (304.4, plot 111), as in render_shots.py.
Assets: all procedural (numpy-drawn sprite atlases, bmesh cars and trees). No downloaded asset, no Mixamo. See assets/LICENSES.md.
"""
import sys, os, json, math, hashlib, time

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
REPO = os.path.abspath(os.path.join(HERE, "..", "..", "..")).replace("\\", "/")
CFG_PATH = HERE + "/life.json"
LOCAL = HERE + "/_local"
PY = "C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe"
BLENDER = "C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe"


def load_cfg():
    with open(CFG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def log(*a):
    print("[life]", *a, flush=True)


# =============================================================================================== plain-python side
def site_to_world_fn(north_deg, ucx, ucy):
    """local metres (+X east, +Y north) -> plan-world metres (copy of render_shots.site_to_world, read-only reuse)."""
    def f(e, n):
        r = math.hypot(e, n)
        if r < 1e-9:
            return (ucx, ucy)
        b = math.degrees(math.atan2(e, n))
        th = math.radians(b + north_deg)
        return (ucx + r * math.sin(th), ucy + r * math.cos(th))
    return f


def make_roads():
    """site.json (habait-98's studio project, read-only) -> life.json roads.lines / coast.line_world (plan-world metres)."""
    cfg = load_cfg()
    src = cfg["roads"]["source"]
    site_p = os.path.join(REPO, src["site_json"])
    shots_p = os.path.join(REPO, src["shots_json"])
    site = json.load(open(site_p, encoding="utf-8"))
    shots = json.load(open(shots_p, encoding="utf-8"))
    north = float(site["north_deg"])
    ucx, ucy = shots["unit_centre_m"][:2]
    f = site_to_world_fn(north, ucx, ucy)
    tc = cfg["scene"]["tower_centre"]
    R = float(cfg["roads"]["keep_radius_m"])
    hw = cfg["roads"]["half_width_m"]
    lines = []
    for i, rd in enumerate(site["context"]["roads"]):
        pts = [f(e, n) for e, n in rd["line_m"]]
        if min(math.hypot(x - tc[0], y - tc[1]) for x, y in pts) > R:
            continue
        lines.append({"id": "osm-road-%02d" % i, "kind": rd.get("kind", "road"), "half_width_m": hw.get(rd.get("kind"), hw["default"]),
                      "pts": [[round(x, 2), round(y, 2)] for x, y in pts]})
    cfg["roads"]["lines"] = lines
    cfg["roads"]["north_deg"] = north
    cfg["roads"]["unit_centre_m"] = [ucx, ucy]
    # the coast: keep the OSM way order (never sort by latitude), trim to a contiguous run near the site
    coast = (site["context"].get("coast") or [])
    if coast:
        line = max(coast, key=len)
        line = list(line) if line[0][1] >= line[-1][1] else list(line)[::-1]
        w = [f(e, n) for e, n in line]
        CR = float(cfg["coast"]["keep_radius_m"])
        idx = [k for k, (x, y) in enumerate(w) if math.hypot(x - tc[0], y - tc[1]) <= CR]
        if idx:
            run = w[max(idx[0] - 1, 0): min(idx[-1] + 2, len(w))]
            cfg["coast"]["line_world"] = [[round(x, 2), round(y, 2)] for x, y in run]
            # which side is the sea: west in true bearings = plan bearing 270 + north
            b = math.radians(270.0 + north)
            cfg["coast"]["sea_dir_world"] = [round(math.sin(b), 4), round(math.cos(b), 4)]
            cfg["coast"]["min_dist_m"] = round(min(math.hypot(x - tc[0], y - tc[1]) for x, y in w), 1)
    with open(CFG_PATH, "w", encoding="utf-8") as fo:
        json.dump(cfg, fo, ensure_ascii=False, indent=1)
    print("roads kept: %d (of %d) within %.0f m; coast run: %d pts, nearest %.0f m" % (
        len(lines), len(site["context"]["roads"]), R, len(cfg["coast"].get("line_world") or []), cfg["coast"].get("min_dist_m") or -1))


def commands():
    cfg = load_cfg()
    blend = cfg["scene"]["blend"]
    out = []
    out.append('export BLENDER="%s"; cd %s; export PYTHONIOENCODING=utf-8; PY=%s' % (BLENDER.replace("C:/", "/c/"), REPO, PY.replace("C:/", "/c/")))
    for p in cfg["presets"]:
        out.append('timeout 3600 "$BLENDER" -b %s -P Habait/flyover/life/life.py -- --preset %s --pass preview' % (blend, p))
        out.append('$PY Habait/flyover/life/check_static.py Habait/flyover/life/_local/%s/frames --mask Habait/flyover/life/_local/%s/tower-mask.png '
                   '--matte Habait/flyover/life/_local/%s/matte_first.png,Habait/flyover/life/_local/%s/matte_last.png' % (p, p, p, p))
    return out


# =============================================================================================== Blender side
def blender_main():
    import bpy, bmesh
    import numpy as np
    from mathutils import Vector, Matrix
    from bpy_extras.object_utils import world_to_camera_view

    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    import argparse
    ap = argparse.ArgumentParser(prog="life.py")
    ap.add_argument("--preset", default="morning")
    ap.add_argument("--pass", dest="pas", default="", choices=["", "preview"])
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--out", default="")
    ap.add_argument("--frames", default="", help="override a..b")
    ap.add_argument("--res", default="", help="override WxH")
    ap.add_argument("--engine", default="", help="override: eevee | cycles")
    ap.add_argument("--encode-only", default="")
    ap.add_argument("--mp4", default="")
    ap.add_argument("--sea-mode", default="", help="override presets.*.sea.mode: existing-only | osm-coast | off")
    a = ap.parse_args(argv)

    if a.encode_only:
        encode_mp4(bpy, a.encode_only, a.mp4 or (a.encode_only.rstrip("/") + ".mp4"), 24)
        return

    cfg = load_cfg()
    sc = bpy.context.scene
    blend_path = bpy.data.filepath.replace("\\", "/")
    rcfg = cfg["render"]
    f0, f1 = rcfg["frames"]
    if a.frames:
        f0, f1 = [int(v) for v in a.frames.split("..")]
    resx, resy = rcfg["res"]
    if a.res:
        resx, resy = [int(v) for v in a.res.lower().split("x")]
    S = cfg["scene"]
    TOWER_SET = set(S["tower_objects"])
    STATIC_PREFIX = tuple(S["static_prefixes"])
    GROUND_SET = set(S["ground_objects"])
    ROOF_SET = set(S["roof_objects"])
    GZ = float(S["ground_z"])

    def is_static(ob):
        return ob.name.startswith(STATIC_PREFIX)

    statics = [o for o in bpy.data.objects if is_static(o)]
    missing = [n for n in TOWER_SET if n not in bpy.data.objects]
    log("scene", blend_path, "| static objects:", len(statics), "| tower objects missing:", missing or "none")

    # ------------------------------------------------------------------ helpers
    def coll_life():
        c = bpy.data.collections.get("LIFE")
        if c is None:
            c = bpy.data.collections.new("LIFE")
            sc.collection.children.link(c)
        return c

    def link(ob):
        coll_life().objects.link(ob)
        return ob

    def drv(owner, path, expr, index=-1):
        fc = owner.driver_add(path, index) if index >= 0 else owner.driver_add(path)
        fc.driver.type = "SCRIPTED"
        fc.driver.expression = expr
        return fc

    def ray_down(x, y, z0=400.0):
        dg = bpy.context.evaluated_depsgraph_get()
        hit, loc, nrm, idx, ob, mw = sc.ray_cast(dg, Vector((x, y, z0)), Vector((0, 0, -1)))
        if not hit:
            return None, None, None
        return ob.name if ob else None, loc, nrm

    rng = np.random.default_rng(int(cfg.get("seed", 846)))

    # ------------------------------------------------------------------ static snapshot (proves nothing static moves)
    def static_snapshot(frame):
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        snap = {}
        for o in statics:
            h = hashlib.sha1()
            h.update(np.array(o.matrix_world, dtype=np.float64).tobytes())
            if o.type == "MESH":
                oe = o.evaluated_get(dg)
                me = oe.to_mesh()
                co = np.empty(len(me.vertices) * 3, dtype=np.float32)
                me.vertices.foreach_get("co", co)
                h.update(co.tobytes())
                oe.to_mesh_clear()
            h.update(("|".join(s.material.name if s.material else "-" for s in o.material_slots)).encode())
            snap[o.name] = h.hexdigest()[:16]
        return snap

    def static_untouched():
        bad = []
        for o in statics:
            if o.modifiers or o.constraints or (o.animation_data and (o.animation_data.action or o.animation_data.drivers)):
                bad.append(o.name)
        return bad

    # ------------------------------------------------------------------ camera
    def make_camera():
        C = cfg["camera"]
        cd = bpy.data.cameras.new("LIFE_cam")
        cd.lens = float(C["lens_mm"])
        cd.sensor_width = 36.0
        cd.sensor_fit = "HORIZONTAL"
        cd.clip_start = float(C.get("clip_start", 1.0))
        cd.clip_end = float(C.get("clip_end", 12000.0))
        cam = link(bpy.data.objects.new("LIFE_cam", cd))
        p = Vector(C["location"])
        t = Vector(C["look_at"])
        cam.location = p
        cam.rotation_euler = (t - p).to_track_quat("-Z", "Y").to_euler()
        sc.camera = cam
        return cam

    # ------------------------------------------------------------------ sprite atlases (numpy, procedural, CC0 own work)
    def capsule(xx, yy, a0, a1, r):
        ax, ay = a0; bx, by = a1
        vx, vy = bx - ax, by - ay
        L2 = vx * vx + vy * vy + 1e-9
        t = np.clip(((xx - ax) * vx + (yy - ay) * vy) / L2, 0, 1)
        dx = xx - (ax + t * vx); dy = yy - (ay + t * vy)
        return (dx * dx + dy * dy) <= r * r

    def poly_in(xx, yy, poly):
        inside = np.zeros(xx.shape, bool)
        n = len(poly)
        for i in range(n):
            x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % n]
            cond = ((y0 > yy) != (y1 > yy))
            xint = (x1 - x0) * (yy - y0) / ((y1 - y0) if y1 != y0 else 1e-9) + x0
            inside ^= cond & (xx < xint)
        return inside

    def person_atlas(nf=8, variants=None, W=48, H=96, ss=3):
        """walk cycle, side view facing +u (screen right); rows = clothing variants. RGBA float, top-down rows."""
        variants = variants or cfg["sprites"]["people_variants"]
        V = len(variants)
        atlas = np.zeros((V * H, nf * W, 4), np.float32)
        ys, xs = np.mgrid[0:H * ss, 0:W * ss].astype(np.float32) / ss
        for vi, v in enumerate(variants):
            top = np.array(v["top"], np.float32); low = np.array(v["legs"], np.float32)
            skin = np.array(v["skin"], np.float32); hair = np.array(v["hair"], np.float32); shoe = np.array([0.08, 0.08, 0.09], np.float32)
            for fi in range(nf):
                ph = 2 * math.pi * fi / nf
                bob = 1.2 * abs(math.sin(ph))
                hip = (W / 2, 54 - bob); sh = (W / 2, 27 - bob); head = (W / 2 + 1, 15 - bob)
                img = np.zeros((H * ss, W * ss, 4), np.float32)

                def paint(mask, col, a=1.0):
                    img[mask, 0:3] = col; img[mask, 3] = a
                legL = 40.0
                for side, shade in ((1, 0.72), (-1, 1.0)):   # far limb first (darker), near limb on top
                    ang = side * 0.42 * math.sin(ph)
                    knee = (hip[0] + math.sin(ang) * legL * 0.5, hip[1] + math.cos(ang) * legL * 0.5)
                    kang = ang + max(0.0, -side * math.sin(ph)) * 0.5 * side * -1
                    foot = (knee[0] + math.sin(ang - 0.15 * abs(math.sin(ph))) * legL * 0.5, min(H - 3, knee[1] + math.cos(kang) * legL * 0.5))
                    paint(capsule(xs, ys, hip, knee, 3.6), low * shade)
                    paint(capsule(xs, ys, knee, foot, 3.2), low * shade)
                    paint(capsule(xs, ys, foot, (foot[0] + 4.5, foot[1] + 0.5), 2.2), shoe)
                    aang = -side * 0.38 * math.sin(ph)
                    elbow = (sh[0] + math.sin(aang) * 12, sh[1] + 3 + math.cos(aang) * 12)
                    hand = (elbow[0] + math.sin(aang + 0.3) * 11, elbow[1] + math.cos(aang + 0.3) * 11)
                    if side == 1:
                        paint(capsule(xs, ys, (sh[0], sh[1] + 3), elbow, 2.8), top * shade * 0.9)
                        paint(capsule(xs, ys, elbow, hand, 2.4), skin * shade)
                    else:
                        arm_after = (elbow, hand)
                paint(capsule(xs, ys, (sh[0], sh[1] + 2), (hip[0], hip[1] - 2), 7.0), top)
                paint(capsule(xs, ys, (hip[0] - 0.5, hip[1] - 3), (hip[0] + 0.5, hip[1] + 1), 6.0), low)
                paint(capsule(xs, ys, (sh[0], sh[1] - 2), (head[0], head[1] + 4), 2.6), skin)
                paint(((xs - head[0]) ** 2 + (ys - head[1]) ** 2) <= 6.2 ** 2, skin)
                paint((((xs - head[0] + 0.8) ** 2 + (ys - head[1] + 1.6) ** 2) <= 6.0 ** 2) & (ys < head[1] - 0.5 + (xs - head[0]) * -0.2), hair)
                e, h2 = arm_after
                paint(capsule(xs, ys, (sh[0], sh[1] + 3), e, 3.0), top)
                paint(capsule(xs, ys, e, h2, 2.5), skin)
                small = img.reshape(H, ss, W, ss, 4).mean(axis=(1, 3))
                rgb = np.where(small[..., 3:4] > 1e-4, small[..., 0:3] / np.maximum(small[..., 3:4], 1e-4), 0)
                small[..., 0:3] = rgb
                atlas[vi * H:(vi + 1) * H, fi * W:(fi + 1) * W] = small
        return atlas

    def bird_atlas(nf=4, S_=64, ss=3):
        """row 0 = top/bottom view (wings spread, flap = span foreshortening), row 1 = side view (V wings). gull colours."""
        atlas = np.zeros((2 * S_, nf * S_, 4), np.float32)
        ys, xs = np.mgrid[0:S_ * ss, 0:S_ * ss].astype(np.float32) / ss
        c = S_ / 2
        body = np.array(cfg["sprites"]["bird_body"], np.float32); wing = np.array(cfg["sprites"]["bird_wing"], np.float32)
        tip = np.array(cfg["sprites"]["bird_tip"], np.float32)
        for fi in range(nf):
            ph = 2 * math.pi * fi / nf
            span = 0.55 + 0.45 * math.cos(ph)
            for row in (0, 1):
                img = np.zeros((S_ * ss, S_ * ss, 4), np.float32)
                if row == 0:  # body along +x (u), wings along y (v)
                    for sgn in (1, -1):
                        w = [(c - 3, c), (c + 6, c), (c + 1, c + sgn * 30 * span), (c - 8, c + sgn * 28 * span)]
                        m = poly_in(xs, ys, w); img[m, 0:3] = wing; img[m, 3] = 1
                        t = [(c - 1, c + sgn * 22 * span), (c + 3, c + sgn * 30 * span), (c - 8, c + sgn * 28 * span), (c - 6, c + sgn * 22 * span)]
                        m = poly_in(xs, ys, t); img[m, 0:3] = tip; img[m, 3] = 1
                    m = ((xs - c) / 13.0) ** 2 + ((ys - c) / 3.6) ** 2 <= 1; img[m, 0:3] = body; img[m, 3] = 1
                else:          # side: body along +x, wings up/down in v
                    lift = 26 * math.sin(ph)
                    for off in (-2.5, 2.5):
                        m = capsule(xs, ys, (c + off, c), (c - 4 + off, c - lift), 2.0); img[m, 0:3] = wing * 0.9; img[m, 3] = 1
                    m = ((xs - c) / 13.0) ** 2 + ((ys - c) / 3.4) ** 2 <= 1; img[m, 0:3] = body; img[m, 3] = 1
                    m = capsule(xs, ys, (c + 12, c - 1), (c + 16, c - 0.5), 1.4); img[m, 0:3] = np.array([0.85, 0.65, 0.2], np.float32); img[m, 3] = 1
                small = img.reshape(S_, ss, S_, ss, 4).mean(axis=(1, 3))
                rgb = np.where(small[..., 3:4] > 1e-4, small[..., 0:3] / np.maximum(small[..., 3:4], 1e-4), 0)
                small[..., 0:3] = rgb
                atlas[row * S_:(row + 1) * S_, fi * S_:(fi + 1) * S_] = small
        return atlas

    def to_image(name, arr, save_dir=None):
        h, w = arr.shape[:2]
        img = bpy.data.images.get(name) or bpy.data.images.new(name, w, h, alpha=True)
        img.colorspace_settings.name = "sRGB"
        img.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).ravel())
        img.pack()
        if save_dir:
            os.makedirs(save_dir, exist_ok=True)
            img2 = img.copy()
            img2.filepath_raw = save_dir + "/" + name + ".png"
            img2.file_format = "PNG"
            img2.save()
            bpy.data.images.remove(img2)
        return img

    # ------------------------------------------------------------------ materials
    def principled(name, rgb, rough=0.6, emit=0.0, alpha=None):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value = (*rgb, 1)
        b.inputs["Roughness"].default_value = rough
        if emit:
            b.inputs["Emission Color"].default_value = (*rgb, 1)
            b.inputs["Emission Strength"].default_value = emit
        return m

    def frame_value(nt, label="frame"):
        v = nt.nodes.new("ShaderNodeValue"); v.label = label
        drv(v.outputs[0], "default_value", "frame")
        return v

    def math_node(nt, op, a, b=None, c=None):
        n = nt.nodes.new("ShaderNodeMath"); n.operation = op
        for i, x in enumerate((a, b, c)):
            if x is None:
                continue
            if isinstance(x, (int, float)):
                n.inputs[i].default_value = float(x)
            else:
                nt.links.new(x, n.inputs[i])
        return n.outputs[0]

    def sprite_material(name, image, nframes, fps_anim, nrows_random=0, flip_attr=False, emit=0.25):
        """UV atlas animation: u' = (u_eff + idx)/nframes; idx = floor(fmod(frame*fps/24 + rand*nframes, nframes)).
        nrows_random > 0: v' = (v + floor(rand2*rows))/rows (variant per object). flip_attr: object prop 'flip' mirrors u."""
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree; L = nt.links
        for n in list(nt.nodes):
            if n.type not in ("OUTPUT_MATERIAL", "BSDF_PRINCIPLED"):
                nt.nodes.remove(n)
        bsdf = nt.nodes.get("Principled BSDF")
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L.new(tc.outputs["UV"], sep.inputs[0])
        oi = nt.nodes.new("ShaderNodeObjectInfo")
        u = sep.outputs[0]; v = sep.outputs[1]
        if flip_attr:
            at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_type = "OBJECT"; at.attribute_name = "flip"
            # u_eff = u + flip*(1-2u)
            one_m_2u = math_node(nt, "MULTIPLY_ADD", u, -2.0, 1.0)
            u = math_node(nt, "MULTIPLY_ADD", at.outputs["Fac"], one_m_2u, sep.outputs[0])
        fr = frame_value(nt).outputs[0]
        t = math_node(nt, "MULTIPLY", fr, fps_anim / 24.0)
        rnd = math_node(nt, "MULTIPLY", oi.outputs["Random"], float(nframes))
        t = math_node(nt, "ADD", t, rnd)
        idx = math_node(nt, "FLOOR", math_node(nt, "FLOORED_MODULO", t, float(nframes)))
        uu = math_node(nt, "DIVIDE", math_node(nt, "ADD", u, idx), float(nframes))
        vv = v
        if nrows_random:
            r2 = math_node(nt, "FRACT", math_node(nt, "MULTIPLY", oi.outputs["Random"], 7.31))
            row = math_node(nt, "FLOOR", math_node(nt, "MULTIPLY", r2, float(nrows_random) - 1e-3))
            vv = math_node(nt, "DIVIDE", math_node(nt, "ADD", v, row), float(nrows_random))
        comb = nt.nodes.new("ShaderNodeCombineXYZ"); L.new(uu, comb.inputs[0]); L.new(vv, comb.inputs[1])
        tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = image; tex.interpolation = "Linear"; tex.extension = "CLIP"
        L.new(comb.outputs[0], tex.inputs[0])
        L.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        L.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        L.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emit
        bsdf.inputs["Roughness"].default_value = 0.85
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "DITHERED"
        else:
            m.blend_method = "HASHED"
        return m

    def blob_material():
        m = bpy.data.materials.get("LIFE_contact_shadow")
        if m:
            return m
        m = bpy.data.materials.new("LIFE_contact_shadow")
        m.use_nodes = True
        nt = m.node_tree; L = nt.links
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        tc = nt.nodes.new("ShaderNodeTexCoord")
        g = nt.nodes.new("ShaderNodeTexGradient"); g.gradient_type = "SPHERICAL"
        mp = nt.nodes.new("ShaderNodeMapping")   # generated 0..1 -> -1..1 so the sphere centres on the quad
        mp.inputs["Location"].default_value = (-1, -1, 0); mp.inputs["Scale"].default_value = (2, 2, 1)
        L.new(tc.outputs["Generated"], mp.inputs[0]); L.new(mp.outputs[0], g.inputs[0])
        a = math_node(nt, "POWER", g.outputs["Fac"], 1.6)
        a = math_node(nt, "MULTIPLY", a, float(cfg["contact_shadow_alpha"]))
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        bl = nt.nodes.new("ShaderNodeEmission"); bl.inputs["Color"].default_value = (0, 0, 0, 1)
        mix = nt.nodes.new("ShaderNodeMixShader")
        L.new(a, mix.inputs[0]); L.new(tr.outputs[0], mix.inputs[1]); L.new(bl.outputs[0], mix.inputs[2])
        L.new(mix.outputs[0], out.inputs[0])
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "DITHERED"
        return m

    def add_blob(parent_name, x, y, z, sx, sy, rot=0.0, follow=None):
        me = bpy.data.meshes.get("LIFE_blob_mesh")
        if me is None:
            me = bpy.data.meshes.new("LIFE_blob_mesh")
            me.from_pydata([(-0.5, -0.5, 0), (0.5, -0.5, 0), (0.5, 0.5, 0), (-0.5, 0.5, 0)], [], [(0, 1, 2, 3)])
            me.materials.append(blob_material())
        ob = link(bpy.data.objects.new("LIFE_shadow_" + parent_name, me))
        ob.scale = (sx, sy, 1)
        ob.location = (x, y, z + float(cfg["contact_shadow_lift_m"]))
        ob.rotation_euler = (0, 0, rot)
        ob.visible_shadow = False
        if follow is not None:
            ob.location = (0, 0, float(cfg["contact_shadow_lift_m"]))
            ob.parent = follow
        return ob

    # ------------------------------------------------------------------ paths
    def poly_len(pts):
        return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))

    def offset_poly(pts, d):
        """offset a 2D polyline to its RIGHT by d (left if d < 0), miter-averaged normals."""
        out = []
        n = len(pts)
        for i in range(n):
            if i == 0:
                tx, ty = pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]
            elif i == n - 1:
                tx, ty = pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1]
            else:
                ax, ay = pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]
                bx, by = pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]
                la = math.hypot(ax, ay) or 1; lb = math.hypot(bx, by) or 1
                tx, ty = ax / la + bx / lb, ay / la + by / lb
            L = math.hypot(tx, ty) or 1
            out.append((pts[i][0] + ty / L * d, pts[i][1] - tx / L * d))
        return out

    def make_path(name, pts2, z):
        cu = bpy.data.curves.new(name, "CURVE")
        cu.dimensions = "3D"
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts2) - 1)
        for i, (x, y) in enumerate(pts2):
            sp.points[i].co = (x, y, z, 1)
        cu.use_path = True
        cu.path_duration = 100
        ob = link(bpy.data.objects.new(name, cu))
        ob.hide_render = True
        return ob

    def follow(ob, path_ob, L, s0, v, curve_follow=True):
        c = ob.constraints.new("FOLLOW_PATH")
        c.target = path_ob
        c.use_fixed_location = True
        c.use_curve_follow = curve_follow
        c.forward_axis = "FORWARD_X"
        c.up_axis = "UP_Z"
        drv(c, "offset_factor", "min(max((%.4f + %.5f*(frame-%d))/%.4f, 0.0), 1.0)" % (s0, v, f0, L))

    def ground_z_at(x, y):
        name, loc, nrm = ray_down(x, y)
        if name in GROUND_SET and loc is not None:
            return loc.z, name
        return None, name

    # ------------------------------------------------------------------ layers
    report = {"layers": {}}

    def layer_cars(P):
        C = P["cars"]
        R = cfg["roads"]
        if not C.get("enabled", True):
            return []
        T = (f1 - f0 + 1) / float(rcfg["fps"])
        # meshes: sedan + suv; body material colour by object random through a constant colour ramp
        body = bpy.data.materials.new("LIFE_car_body")
        body.use_nodes = True
        nt = body.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        oi = nt.nodes.new("ShaderNodeObjectInfo")
        cr = nt.nodes.new("ShaderNodeValToRGB"); cr.color_ramp.interpolation = "CONSTANT"
        pal = cfg["cars_palette"]
        acc = 0.0
        els = cr.color_ramp.elements
        while len(els) > 1:
            els.remove(els[-1])
        for i, (w, col) in enumerate(pal):
            e = els[0] if i == 0 else els.new(acc)
            e.position = acc
            e.color = (*col, 1)
            acc += w / sum(p[0] for p in pal)
        nt.links.new(oi.outputs["Random"], cr.inputs[0])
        nt.links.new(cr.outputs[0], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.25
        bsdf.inputs["Metallic"].default_value = 0.4
        glass = principled("LIFE_car_glass", (0.03, 0.04, 0.05), 0.1)
        tyre = principled("LIFE_car_tyre", (0.02, 0.02, 0.02), 0.9)
        head = principled("LIFE_car_head", (1.0, 0.95, 0.85), 0.3, emit=float(C["head_emit"]))
        tail = principled("LIFE_car_tail", (0.8, 0.05, 0.03), 0.3, emit=float(C["tail_emit"]))

        def car_mesh(name, Lb, Wb, Hb, Lc, Hc, cab_off):
            bm = bmesh.new()

            def box(x0, x1, y0, y1, z0, z1, mi):
                r = bmesh.ops.create_cube(bm, size=1.0)
                vs = r["verts"]
                for vtx in vs:
                    vtx.co.x = x0 + (vtx.co.x + 0.5) * (x1 - x0)
                    vtx.co.y = y0 + (vtx.co.y + 0.5) * (y1 - y0)
                    vtx.co.z = z0 + (vtx.co.z + 0.5) * (z1 - z0)
                for f in {f for vtx in vs for f in vtx.link_faces}:
                    f.material_index = mi
            box(-Lb / 2, Lb / 2, -Wb / 2, Wb / 2, 0.32, 0.32 + Hb, 0)
            box(-Lc / 2 + cab_off, Lc / 2 + cab_off, -Wb / 2 + 0.08, Wb / 2 - 0.08, 0.32 + Hb, 0.32 + Hb + Hc, 1)
            for sx in (1, -1):
                for sy in (1, -1):
                    box(sx * Lb * 0.33 - 0.33, sx * Lb * 0.33 + 0.33, sy * Wb / 2 - 0.12 * sy - 0.11, sy * Wb / 2 - 0.12 * sy + 0.11, 0.0, 0.64, 2)
            box(Lb / 2 - 0.02, Lb / 2 + 0.03, -Wb / 2 + 0.15, -Wb / 2 + 0.45, 0.32 + Hb * 0.55, 0.32 + Hb * 0.8, 3)
            box(Lb / 2 - 0.02, Lb / 2 + 0.03, Wb / 2 - 0.45, Wb / 2 - 0.15, 0.32 + Hb * 0.55, 0.32 + Hb * 0.8, 3)
            box(-Lb / 2 - 0.03, -Lb / 2 + 0.02, -Wb / 2 + 0.1, -Wb / 2 + 0.4, 0.32 + Hb * 0.6, 0.32 + Hb * 0.85, 4)
            box(-Lb / 2 - 0.03, -Lb / 2 + 0.02, Wb / 2 - 0.4, Wb / 2 - 0.1, 0.32 + Hb * 0.6, 0.32 + Hb * 0.85, 4)
            me = bpy.data.meshes.new(name)
            bm.to_mesh(me); bm.free()
            for m in (body, glass, tyre, head, tail):
                me.materials.append(m)
            return me
        meshes = [car_mesh("LIFE_car_sedan", 4.5, 1.8, 0.75, 2.3, 0.55, -0.2), car_mesh("LIFE_car_suv", 4.7, 1.9, 0.95, 2.9, 0.6, -0.3),
                  car_mesh("LIFE_car_small", 3.8, 1.7, 0.75, 2.1, 0.6, -0.1)]
        cars = []
        for rd in R["lines"]:
            pts = [tuple(p) for p in rd["pts"]]
            tc = cfg["scene"]["tower_centre"]
            if min(math.hypot(x - tc[0], y - tc[1]) for x, y in pts) > float(C["radius_m"]):
                continue
            L = poly_len(pts)
            lane_v = float(C["speed_ms"].get(rd["kind"], C["speed_ms"]["default"]))
            for direction in (1, -1):
                lp = pts if direction == 1 else pts[::-1]
                travel = lane_v * T
                if L < travel + 15:
                    continue
                n = int(round(float(C["per_km_per_lane"]) * L / 1000.0))
                if n <= 0:
                    continue
                path = make_path("LIFE_lane_%s_%s" % (rd["id"], "f" if direction == 1 else "b"), lp, GZ)
                # same speed per lane, min gap -> no car drives through another
                slots = np.sort(rng.uniform(0, L - travel - 5, size=n * 3))
                chosen = []
                for s in slots:
                    if all(abs(s - c) > float(C["min_gap_m"]) for c in chosen):
                        chosen.append(float(s))
                    if len(chosen) >= n:
                        break
                for k, s0 in enumerate(chosen):
                    me = meshes[int(rng.integers(0, len(meshes)))]
                    ob = link(bpy.data.objects.new("LIFE_car_%s_%s%02d" % (rd["id"], "f" if direction == 1 else "b", k), me))
                    ob.location = (0, -float(C["lane_offset_m"]), 0)   # right-hand traffic: lane to the right of travel
                    follow(ob, path, L, s0, lane_v / rcfg["fps"])
                    add_blob(ob.name, 0, 0, 0, 5.2, 2.3, follow=ob)
                    cars.append({"ob": ob.name, "size": 4.5})
        report["layers"]["cars"] = {"count": len(cars)}
        return cars

    def layer_people(P, cam):
        C = P["people"]
        if not C.get("enabled", True):
            return []
        img = to_image("LIFE_people_atlas", person_atlas(), save_dir=LOCAL + "/sprites" if a.selftest else None)
        nf = 8
        rows = len(cfg["sprites"]["people_variants"])
        mat = sprite_material("LIFE_people", img, nf, float(C["cycle_fps"]), nrows_random=rows, flip_attr=True)
        H = float(C["height_m"]); Wd = H * 0.5
        me = bpy.data.meshes.new("LIFE_person_card")
        me.from_pydata([(-Wd / 2, 0, 0), (Wd / 2, 0, 0), (Wd / 2, 0, H), (-Wd / 2, 0, H)], [], [(0, 1, 2, 3)])
        uv = me.uv_layers.new(name="UVMap")
        for li, lp in enumerate(me.loops):
            uv.data[li].uv = [(0, 0), (1, 0), (1, 1), (0, 1)][lp.vertex_index]
        me.materials.append(mat)
        cam_right = (cam.matrix_world.to_3x3() @ Vector((1, 0, 0)))
        T = (f1 - f0 + 1) / float(rcfg["fps"])
        people = []

        def spawn(name, path_pts, z, speed):
            L = poly_len(path_pts)
            travel = speed * T
            if L < travel + 2:
                return None
            path = make_path("LIFE_walk_" + name, path_pts, z)
            s0 = float(rng.uniform(0, L - travel - 1))
            ob = link(bpy.data.objects.new("LIFE_person_" + name, me))
            follow(ob, path, L, s0, speed / rcfg["fps"], curve_follow=False)
            c = ob.constraints.new("LOCKED_TRACK")
            c.target = cam; c.track_axis = "TRACK_NEGATIVE_Y"; c.lock_axis = "LOCK_Z"
            # direction on screen at the start: sprite walks toward +u; mirror when moving screen-left
            k = 0
            acc = 0.0
            while k < len(path_pts) - 2 and acc + math.dist(path_pts[k], path_pts[k + 1]) < s0:
                acc += math.dist(path_pts[k], path_pts[k + 1]); k += 1
            d = Vector((path_pts[k + 1][0] - path_pts[k][0], path_pts[k + 1][1] - path_pts[k][1], 0))
            ob["flip"] = 1.0 if d.dot(cam_right) < 0 else 0.0
            ob.visible_shadow = True
            add_blob(ob.name, 0, 0, 0, 0.9, 0.9, follow=ob)
            people.append({"ob": ob.name, "size": H})
            return ob

        # (1) sidewalks of the OSM roads near the tower
        cand = []
        for rd in cfg["roads"]["lines"]:
            pts = [tuple(p) for p in rd["pts"]]
            tc = cfg["scene"]["tower_centre"]
            if min(math.hypot(x - tc[0], y - tc[1]) for x, y in pts) > float(C["radius_m"]) or len(pts) < 2:
                continue
            for side in (1, -1):
                sw = offset_poly(pts, side * (rd["half_width_m"] + float(C["sidewalk_offset_m"])))
                cand.append((rd["id"], side, sw))
        n_sw = int(C["sidewalk_count"])
        for i in range(n_sw if cand else 0):
            rid, side, sw = cand[int(rng.integers(0, len(cand)))]
            pts = sw if rng.random() < 0.5 else sw[::-1]
            spawn("sw%02d" % i, pts, GZ, float(rng.uniform(*C["speed_ms"])))
        # (2) podium roofs ("גג הבוטיק") and (3) the plaza at the tower foot: short straight strolls found by ray casts
        tc = cfg["scene"]["tower_centre"]

        def strolls(count, accept, box, prefix, speed_rng):
            made = 0; tries = 0
            while made < count and tries < count * 60:
                tries += 1
                x = float(rng.uniform(box[0], box[1])); y = float(rng.uniform(box[2], box[3]))
                ang = float(rng.uniform(0, 2 * math.pi)); Ls = float(C["stroll_len_m"])
                x2, y2 = x + math.cos(ang) * Ls, y + math.sin(ang) * Ls
                ok = True; zs = []
                for t in np.linspace(0, 1, 5):
                    nm, loc, nrm = ray_down(x + (x2 - x) * t, y + (y2 - y) * t)
                    if nm is None or not accept(nm, loc, nrm):
                        ok = False; break
                    zs.append(loc.z)
                if not ok or max(zs) - min(zs) > 0.3:
                    continue
                spawn("%s%02d" % (prefix, made), [(x, y), (x2, y2)], max(zs) + 0.02, float(rng.uniform(*speed_rng)))
                made += 1
            return made
        pb = cfg["scene"]["podium_box"]
        nroof = strolls(int(C["roof_count"]), lambda nm, loc, nrm: nm in ROOF_SET and nrm.z > 0.95, pb, "roof", C["stroll_speed_ms"])
        R0 = float(C["plaza_radius_m"])
        nplaza = strolls(int(C["plaza_count"]), lambda nm, loc, nrm: nm in GROUND_SET and math.hypot(loc.x - tc[0], loc.y - tc[1]) > 32,
                         (tc[0] - R0, tc[0] + R0, tc[1] - R0, tc[1] + R0), "plaza", C["stroll_speed_ms"])
        report["layers"]["people"] = {"count": len(people), "roof": nroof, "plaza": nplaza}
        return people

    def layer_trees(P):
        C = P["trees"]
        if not C.get("enabled", True):
            return []
        wind = link(bpy.data.objects.new("LIFE_wind", None))
        ws = float(C["wind_ms"]) / rcfg["fps"]
        drv(wind, "location", "frame*%.5f" % ws, 0)
        drv(wind, "location", "frame*%.5f" % (ws * 0.37), 1)
        drv(wind, "location", "sin(frame*0.05)*0.4", 2)
        tex = bpy.data.textures.new("LIFE_wind_noise", "CLOUDS")
        tex.noise_scale = float(C["gust_scale_m"])
        trunk_m = principled("LIFE_trunk", (0.18, 0.13, 0.09), 0.9)
        leaf = bpy.data.materials.new("LIFE_leaf")
        leaf.use_nodes = True
        nt = leaf.node_tree
        b = nt.nodes.get("Principled BSDF")
        oi = nt.nodes.new("ShaderNodeObjectInfo")
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
        mix.inputs["A"].default_value = (*C["leaf_a"], 1); mix.inputs["B"].default_value = (*C["leaf_b"], 1)
        nt.links.new(oi.outputs["Random"], mix.inputs["Factor"])
        nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
        b.inputs["Roughness"].default_value = 0.8
        trees = []
        cand = []
        tc = cfg["scene"]["tower_centre"]
        for rd in cfg["roads"]["lines"]:
            pts = [tuple(p) for p in rd["pts"]]
            if min(math.hypot(x - tc[0], y - tc[1]) for x, y in pts) > float(C["radius_m"]):
                continue
            for side in (1, -1):
                sw = offset_poly(pts, side * (rd["half_width_m"] + float(C["kerb_offset_m"])))
                L = poly_len(sw); s = float(rng.uniform(0, C["spacing_m"]))
                k = 0; acc = 0.0
                while s < L:
                    while k < len(sw) - 2 and acc + math.dist(sw[k], sw[k + 1]) < s:
                        acc += math.dist(sw[k], sw[k + 1]); k += 1
                    seg = math.dist(sw[k], sw[k + 1]) or 1
                    t = (s - acc) / seg
                    cand.append((sw[k][0] + (sw[k + 1][0] - sw[k][0]) * t, sw[k][1] + (sw[k + 1][1] - sw[k][1]) * t))
                    s += float(C["spacing_m"]) * float(rng.uniform(0.8, 1.25))
        for i, (x, y) in enumerate(cand[: int(C["max_count"])]):
            if math.hypot(x - tc[0], y - tc[1]) > float(C["radius_m"]):
                continue
            z, nm = ground_z_at(x, y)
            if z is None:
                continue
            h = float(rng.uniform(*C["height_m"])); r = h * float(rng.uniform(0.28, 0.36))
            bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.18, radius2=0.12, depth=h * 0.55,
                                  matrix=Matrix.Translation((0, 0, h * 0.275)))
            for f in bm.faces:
                f.material_index = 0
            nv0 = len(bm.verts)
            blobs = [(0, 0, h - r * 0.9, r), (r * 0.45, 0.2 * r, h - r * 1.35, r * 0.75), (-r * 0.4, -0.25 * r, h - r * 1.3, r * 0.7)]
            for (bx, by, bz, br) in blobs:
                res = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=br, matrix=Matrix.Translation((bx, by, bz)))
                for f in {f for vtx in res["verts"] for f in vtx.link_faces}:
                    f.material_index = 1
            me = bpy.data.meshes.new("LIFE_tree_%02d" % i)
            bm.to_mesh(me); bm.free()
            me.materials.append(trunk_m); me.materials.append(leaf)
            ob = link(bpy.data.objects.new("LIFE_tree_%02d" % i, me))
            vg = ob.vertex_groups.new(name="canopy")
            vg.add(list(range(nv0, len(me.vertices))), 1.0, "REPLACE")
            md = ob.modifiers.new("wind", "DISPLACE")
            md.texture = tex; md.texture_coords = "OBJECT"; md.texture_coords_object = wind
            md.vertex_group = "canopy"; md.strength = float(C["leaf_amp_m"]); md.mid_level = 0.5
            ob.location = (x, y, z)
            ph = float(rng.uniform(0, 6.28))
            amp = float(C["sway_rad"])
            drv(ob, "rotation_euler", "sin(frame*%.4f+%.3f)*%.4f" % (0.18 + 0.05 * rng.random(), ph, amp), 0)
            drv(ob, "rotation_euler", "sin(frame*%.4f+%.3f)*%.4f" % (0.13 + 0.05 * rng.random(), ph * 1.7, amp * 0.7), 1)
            add_blob(ob.name, x, y, z, r * 2.6, r * 2.6)
            trees.append({"ob": ob.name, "size": h})
        report["layers"]["trees"] = {"count": len(trees), "candidates": len(cand)}
        return trees

    def layer_birds(P, cam):
        C = P["birds"]
        if not C.get("enabled", True):
            return []
        img = to_image("LIFE_bird_atlas", bird_atlas(), save_dir=LOCAL + "/sprites" if a.selftest else None)
        mat = sprite_material("LIFE_bird", img, 4, float(C["flap_fps"]), emit=float(C["emit"]))
        s = float(C["wingspan_m"])
        me = bpy.data.meshes.new("LIFE_bird_card")
        # quad 0: horizontal (top/bottom view, atlas row 0 = v 0.5..1), quad 1: vertical along the body (side view, row 1 = v 0..0.5)
        vs = [(-s / 2, -s / 2, 0), (s / 2, -s / 2, 0), (s / 2, s / 2, 0), (-s / 2, s / 2, 0),
              (-s / 2, 0, -s / 2), (s / 2, 0, -s / 2), (s / 2, 0, s / 2), (-s / 2, 0, s / 2)]
        me.from_pydata(vs, [], [(0, 1, 2, 3), (4, 5, 6, 7)])
        uv = me.uv_layers.new(name="UVMap")
        uvs = {0: (0, 0.5), 1: (1, 0.5), 2: (1, 1.0), 3: (0, 1.0), 4: (0, 0.0), 5: (1, 0.0), 6: (1, 0.5), 7: (0, 0.5)}
        for li, lp in enumerate(me.loops):
            uv.data[li].uv = uvs[lp.vertex_index]
        me.materials.append(mat)
        bird = link(bpy.data.objects.new("LIFE_bird_proto", me))
        bird.location = (0, 0, -500)          # the prototype itself is hidden below the ground
        bird.hide_render = True
        cm = cam.matrix_world
        fwd = (cm.to_3x3() @ Vector((0, 0, -1))); fwd.z = 0; fwd.normalize()
        right = (cm.to_3x3() @ Vector((1, 0, 0))); right.z = 0; right.normalize()
        flocks = []
        for fi, F in enumerate(C["flocks"]):
            c0 = cm.translation + fwd * float(F["along_m"]) + right * float(F["right_m"])
            c0.z = GZ + float(F["height_above_ground_m"])
            goal = link(bpy.data.objects.new("LIFE_flock_goal_%d" % fi, None))
            A = F["wander_m"]; w = float(F["wander_rate"])
            drv(goal, "location", "%.3f + %.2f*sin(frame*%.4f)" % (c0.x, A[0], w), 0)
            drv(goal, "location", "%.3f + %.2f*sin(frame*%.4f + 1.3)" % (c0.y, A[1], w * 0.77), 1)
            drv(goal, "location", "%.3f + %.2f*sin(frame*%.4f + 0.4)" % (c0.z, A[2], w * 1.31), 2)
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=c0)
            em = bpy.context.active_object
            for cl in list(em.users_collection):
                cl.objects.unlink(em)
            link(em)
            em.name = "LIFE_flock_emitter_%d" % fi
            em.scale = (F["spread_m"], F["spread_m"], F["spread_m"] * 0.4)
            em.show_instancer_for_render = False
            em.show_instancer_for_viewport = False
            em.visible_camera = False
            mod = em.modifiers.new("flock", "PARTICLE_SYSTEM")
            ps = mod.particle_system
            pt = ps.settings
            pt.name = "LIFE_flock_%d" % fi
            pt.count = int(F["count"])
            pt.frame_start = float(cfg["birds_prewarm_start"])
            pt.frame_end = float(cfg["birds_prewarm_start"]) + 1
            pt.lifetime = 5000
            pt.emit_from = "VOLUME"
            pt.physics_type = "BOIDS"
            pt.render_type = "OBJECT"
            pt.instance_object = bird
            pt.particle_size = 1.0
            pt.size_random = 0.25
            pt.normal_factor = 0.0
            pt.object_align_factor = (2.0, 0.0, 0.0)
            pt.effector_weights.gravity = 0.0
            pt.use_rotations = True
            pt.rotation_mode = "VEL"
            ps.seed = 17 + fi
            bo = pt.boids
            bo.use_flight = True; bo.use_land = False; bo.use_climb = False
            bo.air_speed_max = float(F["speed_max"]); bo.air_speed_min = float(F["speed_min"])
            bo.air_acc_max = 0.4; bo.air_ave_max = 0.35; bo.air_personal_space = 1.5
            bo.bank = 0.6; bo.pitch = 0.6
            st = bo.states[0]
            rule_note = []
            try:
                with bpy.context.temp_override(object=em, particle_system=ps, particle_settings=pt):
                    bpy.ops.boid.rule_add(type="GOAL")
                g = [r for r in st.rules if r.type == "GOAL"]
                if g:
                    g[-1].object = goal
                    rule_note.append("goal")
                    # goal first so it wins over the default flocking rules
                    while st.rules.find(g[-1].name) > 0:
                        st.active_boid_rule_index = st.rules.find(g[-1].name)
                        with bpy.context.temp_override(object=em, particle_system=ps, particle_settings=pt):
                            bpy.ops.boid.rule_move_up()
            except Exception as e:
                rule_note.append("goal-rule-failed: %s" % e)
            st.ruleset_type = "AVERAGE"
            ps.point_cache.frame_start = int(cfg["birds_prewarm_start"])
            ps.point_cache.frame_end = int(f1) + 2
            flocks.append({"emitter": em.name, "goal": goal.name, "count": pt.count, "rules": [r.type for r in st.rules], "note": rule_note,
                           "centre": [round(c0.x, 1), round(c0.y, 1), round(c0.z, 1)]})
        report["layers"]["birds"] = {"flocks": flocks}
        return flocks

    def layer_sea(P):
        C = P["sea"]
        mode = a.sea_mode or C.get("mode", "existing-only")
        if mode == "off":
            report["layers"]["sea"] = {"mode": mode, "built": False}
            return []
        existing = [o for o in bpy.data.objects if o.type == "MESH" and ("SEA" in o.name.upper() or any(
            s.material and "SEA" in s.material.name.upper() for s in o.material_slots)) and not o.name.startswith("LIFE_")]
        info = {"mode": mode, "existing_sea_objects": [o.name for o in existing], "built": False}
        src_me = None
        if existing:
            src_me = existing[0].data.copy()
            mw = existing[0].matrix_world.copy()
        elif mode == "osm-coast" and cfg["coast"].get("line_world"):
            line = [tuple(p) for p in cfg["coast"]["line_world"]]
            sd = cfg["coast"]["sea_dir_world"]
            ext = float(cfg["coast"]["extend_m"])
            ring = line + [(line[-1][0] + sd[0] * ext, line[-1][1] + sd[1] * ext), (line[0][0] + sd[0] * ext, line[0][1] + sd[1] * ext)]
            src_me = bpy.data.meshes.new("LIFE_sea_mesh")
            src_me.from_pydata([(x, y, 0) for x, y in ring], [], [tuple(range(len(ring)))])
            mw = Matrix.Identity(4)
        else:
            info["skipped"] = "no sea plane in the scene (mode %s)" % mode
            report["layers"]["sea"] = info
            return []
        m = bpy.data.materials.new("LIFE_sea_waves")
        m.use_nodes = True
        nt = m.node_tree; Ls = nt.links
        b = nt.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value = (*C["colour"], 1)
        b.inputs["Roughness"].default_value = 0.08
        b.inputs["Alpha"].default_value = float(C["alpha"])
        tc_ = nt.nodes.new("ShaderNodeTexCoord")
        nz = nt.nodes.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"
        nz.inputs["Scale"].default_value = float(C["wave_scale"])
        mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.05, 0.12, 0.05)
        Ls.new(tc_.outputs["Object"], mp.inputs[0]); Ls.new(mp.outputs[0], nz.inputs["Vector"])
        fv = frame_value(nt)
        Ls.new(math_node(nt, "MULTIPLY", fv.outputs[0], float(C["wave_speed"])), nz.inputs["W"])
        bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35
        Ls.new(nz.outputs["Fac"], bump.inputs["Height"]); Ls.new(bump.outputs[0], b.inputs["Normal"])
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "DITHERED"
        src_me.materials.clear(); src_me.materials.append(m)
        ob = link(bpy.data.objects.new("LIFE_sea", src_me))
        ob.matrix_world = mw
        ob.location.z += float(C["lift_m"])
        if not existing:
            ob.location.z = GZ + float(C["lift_m"])
        info["built"] = True
        report["layers"]["sea"] = info
        return [{"ob": ob.name, "size": 100}]

    # ------------------------------------------------------------------ preset (sun, world, grade)
    def apply_preset(P):
        north = float(cfg["roads"].get("north_deg", 304.4))
        su = P["sun"]
        b = math.radians(float(su["azimuth_true_deg"]) + north)
        el = math.radians(float(su["elevation_deg"]))
        to_sun = Vector((math.sin(b) * math.cos(el), math.cos(b) * math.cos(el), math.sin(el)))
        ld = bpy.data.lights.new("LIFE_sun", "SUN")
        ld.energy = float(su["strength"]); ld.color = su["colour"]; ld.angle = math.radians(float(su.get("angle_deg", 1.0)))
        sun = link(bpy.data.objects.new("LIFE_sun", ld))
        sun.rotation_euler = to_sun.to_track_quat("Z", "Y").to_euler()
        W = P["world"]
        w = sc.world
        if w and w.use_nodes:
            bg = [n for n in w.node_tree.nodes if n.type == "BACKGROUND"]
            if bg:
                bg[0].inputs["Strength"].default_value *= float(W["strength_mul"])
        G = P.get("grade") or {}
        if G.get("enabled"):
            sc.use_nodes = True
            nt = sc.node_tree
            for n in list(nt.nodes):
                nt.nodes.remove(n)
            rl = nt.nodes.new("CompositorNodeRLayers")
            cb = nt.nodes.new("CompositorNodeColorBalance")
            cb.correction_method = "LIFT_GAMMA_GAIN"
            try:
                cb.lift = G["lift"]; cb.gamma = G["gamma"]; cb.gain = G["gain"]
            except Exception:
                for k in ("Lift", "Gamma", "Gain"):
                    if k in cb.inputs:
                        cb.inputs[k].default_value = (*G[k.lower()], 1)
            comp = nt.nodes.new("CompositorNodeComposite")
            nt.links.new(rl.outputs["Image"], cb.inputs["Image"])
            nt.links.new(cb.outputs["Image"], comp.inputs["Image"])
        return {"sun_plan_bearing_deg": round((float(su["azimuth_true_deg"]) + north) % 360, 1), "sun_dir": [round(v, 3) for v in to_sun]}

    def configure_render():
        eng = (a.engine or rcfg["engine"]).lower()
        if eng == "cycles":
            sc.render.engine = "CYCLES"
            sc.cycles.samples = int(rcfg["samples"]); sc.cycles.seed = 0; sc.cycles.use_animated_seed = False
            sc.cycles.max_bounces = 1
        else:
            for ident in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
                try:
                    sc.render.engine = ident
                    break
                except TypeError:
                    continue
            sc.eevee.taa_render_samples = int(rcfg["samples"])
            sc.render.use_motion_blur = False
        sc.render.resolution_x = resx; sc.render.resolution_y = resy; sc.render.resolution_percentage = 100
        sc.render.fps = int(rcfg["fps"]); sc.frame_start = f0; sc.frame_end = f1
        sc.view_settings.view_transform = "Standard"   # skins in = pixels out, as render_check.py
        sc.view_settings.look = "None"
        sc.render.film_transparent = False
        sc.render.image_settings.file_format = "PNG"
        sc.render.image_settings.color_mode = "RGB"
        sc.render.image_settings.color_depth = "8"
        return sc.render.engine

    def bake_particles():
        t = time.time()
        how = "none"
        if not any(o.particle_systems for o in coll_life().objects if o.type == "MESH"):
            return how, 0.0
        # bake_all starts at max(cache start, scene start): open the scene range to the pre-warm start for the bake only, so the
        # flock is already flying (not still in its emitter box) at the first rendered frame
        sc.frame_start = int(cfg["birds_prewarm_start"])
        try:
            with bpy.context.temp_override(scene=sc):
                r = bpy.ops.ptcache.bake_all(bake=True)
            how = "bake_all:" + ",".join(r) + " from %d" % sc.frame_start
        except Exception as e:
            how = "stepped (%s)" % e
            for fr in range(int(cfg["birds_prewarm_start"]), f1 + 1):
                sc.frame_set(fr)
        sc.frame_start = f0
        sc.frame_set(f0)
        return how, round(time.time() - t, 1)

    # ------------------------------------------------------------------ projections (selftest)
    def project(cam, co, size_m):
        p = world_to_camera_view(sc, cam, co)
        inside = 0 <= p.x <= 1 and 0 <= p.y <= 1 and p.z > 0
        focal_px = cam.data.lens / cam.data.sensor_width * resx
        px = size_m * focal_px / max(p.z, 1e-3)
        return inside, px, p

    def layer_stats(cam, objs, frame):
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        n_in = 0; sizes = []
        for e in objs:
            ob = bpy.data.objects[e["ob"]].evaluated_get(dg)
            ins, px, p = project(cam, ob.matrix_world.translation, e["size"])
            if ins:
                n_in += 1; sizes.append(px)
        return {"in_frame": n_in, "of": len(objs), "median_px": round(float(np.median(sizes)), 1) if sizes else 0.0}

    def bird_stats(cam, flocks, frame, size):
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        out = []
        for F in flocks:
            em = bpy.data.objects[F["emitter"]].evaluated_get(dg)
            ps = em.particle_systems[0]
            alive = [p for p in ps.particles if p.alive_state == "ALIVE"]
            ins = 0; sizes = []; zs = []
            for p in alive:
                i, px, pr = project(cam, p.location, size)
                zs.append(p.location.z - GZ)
                if i:
                    ins += 1; sizes.append(px)
            ctr = [round(float(np.mean([p.location[k] for p in alive])), 1) for k in range(3)] if alive else None
            out.append({"alive": len(alive), "in_frame": ins, "centre": ctr, "median_px": round(float(np.median(sizes)), 1) if sizes else 0.0,
                        "height_above_ground_m": [round(min(zs), 1), round(max(zs), 1)] if zs else None})
        return out

    def tower_frame_stats(cam):
        sc.frame_set(f0)
        tot = 0; ins = 0; xs = []; ys = []
        for n in ("BK_tower",):
            o = bpy.data.objects.get(n)
            if not o:
                continue
            me = o.data
            co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co)
            co = co.reshape(-1, 3)[::50]
            for v in co:
                i, px, p = project(cam, o.matrix_world @ Vector(v), 1)
                tot += 1
                if i:
                    ins += 1; xs.append(p.x); ys.append(p.y)
        return {"tower_vertices_in_frame": round(ins / max(tot, 1), 3),
                "tower_bbox_in_frame_uv": [round(min(xs), 3), round(min(ys), 3), round(max(xs), 3), round(max(ys), 3)] if xs else None}

    # ------------------------------------------------------------------ build / clear
    def clear_life():
        c = bpy.data.collections.get("LIFE")
        if c:
            for o in list(c.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
        for blk in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.textures,
                    bpy.data.particles, bpy.data.images):
            for d in list(blk):
                if d.name.startswith("LIFE_") and d.users == 0:
                    blk.remove(d)

    def build(preset):
        P = cfg["presets"][preset]
        report.clear(); report["layers"] = {}
        report["preset"] = preset
        cam = make_camera()
        report["engine"] = configure_render()
        report["sun"] = apply_preset(P)
        cars = layer_cars(P)
        people = layer_people(P, cam)
        trees = layer_trees(P)
        sea = layer_sea(P)
        flocks = layer_birds(P, cam)
        report["bake"] = bake_particles()
        return cam, cars, people, trees, sea, flocks

    # ------------------------------------------------------------------ selftest
    if a.selftest:
        os.makedirs(LOCAL, exist_ok=True)
        t0 = time.time()
        h_before = sha256_file(blend_path)
        snap0 = static_snapshot(f0)
        results = {}
        world_strength0 = None
        if sc.world and sc.world.use_nodes:
            bg = [n for n in sc.world.node_tree.nodes if n.type == "BACKGROUND"]
            world_strength0 = bg[0].inputs["Strength"].default_value if bg else None
        for preset in a.preset.split(","):
            if world_strength0 is not None:
                [n for n in sc.world.node_tree.nodes if n.type == "BACKGROUND"][0].inputs["Strength"].default_value = world_strength0
            tp = time.time()
            cam, cars, people, trees, sea, flocks = build(preset)
            r = dict(report)
            r["static_objects_with_mods_or_anim"] = static_untouched()
            s_first = static_snapshot(f0)
            s_last = static_snapshot(f1)
            r["static_first_vs_last_changed"] = [k for k in s_first if s_first[k] != s_last[k]]
            r["static_vs_before_build_changed"] = [k for k in snap0 if snap0[k] != s_first.get(k)]
            r["tower"] = tower_frame_stats(cam)
            r["frames"] = {}
            for fr in (f0, f1):
                r["frames"][fr] = {"cars": layer_stats(cam, cars, fr), "people": layer_stats(cam, people, fr), "trees": layer_stats(cam, trees, fr),
                                   "birds": bird_stats(cam, flocks, fr, float(cfg["presets"][preset]["birds"]["wingspan_m"]))}
            r["life_objects"] = len(coll_life().objects)
            r["build_s"] = round(time.time() - tp, 1)
            results[preset] = r
            with open(LOCAL + "/selftest-%s.json" % preset, "w", encoding="utf-8") as fo:
                json.dump(r, fo, ensure_ascii=False, indent=1, default=str)
            clear_life()
        h_after = sha256_file(blend_path)
        ok = True
        lines = []
        for p, r in results.items():
            fr0 = r["frames"][f0]; fr1 = r["frames"][f1]
            birds_in = sum(b["in_frame"] for b in fr0["birds"]) + sum(b["in_frame"] for b in fr1["birds"])
            kinds = {"cars": fr0["cars"]["in_frame"] > 0, "people": fr0["people"]["in_frame"] > 0, "trees": fr0["trees"]["in_frame"] > 0,
                     "birds": birds_in > 0, "sea": bool((r["layers"].get("sea") or {}).get("built"))}
            pok = (not r["static_first_vs_last_changed"]) and (not r["static_vs_before_build_changed"]) and (not r["static_objects_with_mods_or_anim"]) \
                and r["tower"]["tower_vertices_in_frame"] > 0.2 and sum(kinds.values()) >= 4
            ok &= pok
            lines.append("[selftest] %s: %s | static moved first->last: %d | static changed by build: %d | tower verts in frame %.0f%% | visible kinds %s | "
                         "cars %d/%d (%.0f px) people %d/%d (%.0f px) trees %d/%d (%.0f px) birds in frame f%d %s f%d %s | bake %s | build %.0f s" % (
                             p, "PASS" if pok else "FAIL", len(r["static_first_vs_last_changed"]), len(r["static_vs_before_build_changed"]),
                             100 * r["tower"]["tower_vertices_in_frame"], ",".join(k for k, v in kinds.items() if v) + " (missing: " + (",".join(k for k, v in kinds.items() if not v) or "none") + ")",
                             fr0["cars"]["in_frame"], fr0["cars"]["of"], fr0["cars"]["median_px"], fr0["people"]["in_frame"], fr0["people"]["of"], fr0["people"]["median_px"],
                             fr0["trees"]["in_frame"], fr0["trees"]["of"], fr0["trees"]["median_px"],
                             f0, [b["in_frame"] for b in fr0["birds"]], f1, [b["in_frame"] for b in fr1["birds"]], r["bake"], r["build_s"]))
        same = h_before == h_after
        ok &= same
        for l in lines:
            print(l, flush=True)
        print("[selftest] baked.blend sha256 before == after: %s (%s)" % (same, h_before[:16]), flush=True)
        print("[selftest] renders: 0, saves: 0, total %.0f s" % (time.time() - t0), flush=True)
        print("[selftest] RESULT", "PASS" if ok else "FAIL", flush=True)
        print("[selftest] preview command (habait-98 / Kaggle):", flush=True)
        for c in commands():
            print("   ", c, flush=True)
        return

    # ------------------------------------------------------------------ preview pass
    if a.pas == "preview":
        preset = a.preset
        out = (a.out or LOCAL + "/" + preset).replace("\\", "/")
        os.makedirs(out + "/frames", exist_ok=True)
        t0 = time.time()
        cam, cars, people, trees, sea, flocks = build(preset)
        log("built", json.dumps(report, default=str)[:1500])
        # 1) the preview frames
        sc.render.filepath = out + "/frames/f_####"
        bpy.ops.render.render(animation=True)
        log("frames rendered %d..%d in %.0f s" % (f0, f1, time.time() - t0))
        # 2) static-check stills, no compositor: tower mask (tower group only, everything else holdout, life hidden) and the life
        #    matte at the first and the last frame (life only, every static object holdout = occlusion kept)
        sc.render.use_compositing = False
        sc.render.film_transparent = True
        sc.render.image_settings.color_mode = "RGBA"
        life_objs = list(coll_life().objects)
        hide0 = {o.name: o.hide_render for o in life_objs}
        for o in statics:
            o.is_holdout = o.name not in TOWER_SET
        for o in life_objs:
            o.hide_render = True
        sc.frame_set(f0)
        sc.render.filepath = out + "/tower-mask.png"
        bpy.ops.render.render(write_still=True)
        for o in life_objs:
            o.hide_render = hide0[o.name]
        for o in statics:
            o.is_holdout = True
        for tag, fr in (("first", f0), ("last", f1)):
            sc.frame_set(fr)
            sc.render.filepath = out + "/matte_%s.png" % tag
            bpy.ops.render.render(write_still=True)
        for o in statics:
            o.is_holdout = False
        # 3) the mp4 (H.264, for eyes; the static check reads the lossless PNG frames)
        mp4 = out + "/preview-%s.mp4" % preset
        encode_mp4(bpy, out + "/frames", mp4, int(rcfg["fps"]))
        with open(out + "/preview.json", "w", encoding="utf-8") as fo:
            json.dump({"preset": preset, "blend": blend_path, "frames": [f0, f1], "res": [resx, resy], "report": report,
                       "seconds": round(time.time() - t0, 1), "mp4": mp4}, fo, ensure_ascii=False, indent=1, default=str)
        log("done in %.0f s ->" % (time.time() - t0), mp4)
        return

    log("nothing to do: pass --selftest or --pass preview (see the header)")


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 22), b""):
            h.update(b)
    return h.hexdigest()


def encode_mp4(bpy, frames_dir, mp4, fps):
    """PNG sequence -> H.264 mp4 through Blender's own sequencer (no external ffmpeg needed on Kaggle)."""
    frames_dir = os.path.abspath(frames_dir); mp4 = os.path.abspath(mp4)
    files = sorted(f for f in os.listdir(frames_dir) if f.lower().endswith(".png"))
    if not files:
        log("encode: no frames in", frames_dir)
        return
    s2 = bpy.data.scenes.new("LIFE_encode")
    se = s2.sequence_editor_create()
    coll = getattr(se, "strips", None) or se.sequences
    st = coll.new_image(name="frames", filepath=os.path.join(frames_dir, files[0]), channel=1, frame_start=1)
    for f in files[1:]:
        st.elements.append(f)
    first = bpy.data.images.load(os.path.join(frames_dir, files[0]))
    s2.render.resolution_x, s2.render.resolution_y = first.size[0], first.size[1]
    bpy.data.images.remove(first)
    s2.render.resolution_percentage = 100
    s2.render.fps = fps
    s2.frame_start = 1; s2.frame_end = len(files)
    s2.view_settings.view_transform = "Standard"
    s2.render.image_settings.file_format = "FFMPEG"
    s2.render.ffmpeg.format = "MPEG4"
    s2.render.ffmpeg.codec = "H264"
    s2.render.ffmpeg.constant_rate_factor = "HIGH"
    s2.render.ffmpeg.ffmpeg_preset = "GOOD"
    s2.render.use_sequencer = True
    s2.render.filepath = mp4
    bpy.ops.render.render(animation=True, scene=s2.name)
    log("mp4:", mp4, "(%d frames)" % len(files))


if __name__ == "__main__":
    try:
        import bpy  # noqa: F401
        IN_BLENDER = True
    except ImportError:
        IN_BLENDER = False
    if IN_BLENDER:
        blender_main()
    else:
        if "--make-roads" in sys.argv:
            make_roads()
        elif "--print-commands" in sys.argv or len(sys.argv) == 1:
            for c in commands():
                print(c)
        else:
            print(__doc__)

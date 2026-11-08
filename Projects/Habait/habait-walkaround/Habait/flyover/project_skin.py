"""project_skin.py - camera-projection ("baking") experiment for the Habait flyover (lane C).

Blender 4.5 headless:
  "$BLENDER" -b --factory-startup -P project_skin.py -- --projectors projectors.json --out renders [--res 960x540] [--samples 16]
        [--variants clay,proj1,proj2,cov] [--views orig,az-30,az+30,az+60,low] [--depth-res 1920x1080] [--save-blend]

What it does
  * imports tower-mass.obj (world frame = OBJ frame: X = x_cm/100, Y = -y_cm/100, Z up, unit floor at 0; ground at -51.2)
  * lays the Esri orthophoto(s) on the ground (north_deg 304.4, unit centre, as render_shots.py does)
  * for every projector (a skinned keyframe + the camera it was made from) it builds a camera, renders a depth map from it
    (material override: emission = camera-space depth) and a shader block that re-projects the keyframe onto the mass:
    uv = 0.5 + (x, y * W/H) / (-z) * f / sensor, masked by frustum (CLIP), depth test (shadow map) and weighted by
    |N.L|^2 * texel density, so several projectors blend where they overlap. Unseen surface -> flat clay grey.
  * renders the requested views x variants (clay / proj1 = first projector / proj2 = all projectors / cov = coverage mask)
  * measures surface coverage (area-weighted BVH ray casts on the bare mass) and writes coverage.json + timings.json
"""
import bpy, bmesh, json, math, os, sys, time
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = "C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv"
OBJ_FULL = PROJ + "/derived/tower-mass.obj"
OBJ_BARE = PROJ + "/derived/tower-mass.bare.obj"
ORTHOS = [PROJ + "/derived/orthophoto.png", PROJ + "/derived/orthophoto-far.png"]
NORTH_DEG = 304.4                 # site.json north_deg
UNIT_CENTRE = (6.487, -8.2045)    # shots.json unit_centre_m
GROUND_Z = -51.2                  # tower-mass.json z_ground_m
LOOK0 = (6.487, -8.2045, 30.0)    # ext-approach frame 1 look point
CAM0 = (196.3212, -134.5492, 90.0)
UNSEEN = (0.55, 0.55, 0.53)


def log(*a):
    print("[project_skin]", *a, flush=True)


def args():
    import argparse
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--projectors", default=os.path.join(HERE, "projectors.json"))
    p.add_argument("--out", default=os.path.join(HERE, "renders"))
    p.add_argument("--res", default="960x540")
    p.add_argument("--depth-res", default="1920x1080")
    p.add_argument("--samples", type=int, default=16)
    p.add_argument("--variants", default="clay,proj1,proj2,cov")
    p.add_argument("--views", default="orig,az-30,az+30,az+60,low")
    p.add_argument("--orbit", type=int, default=0, help="also render N coverage views around the tower (480x270)")
    p.add_argument("--no-ortho", action="store_true")
    p.add_argument("--bare", action="store_true", help="project onto the bare mass only (no railings/mullions/bushes)")
    p.add_argument("--save-blend", action="store_true")
    p.add_argument("--no-coverage", action="store_true")
    return p.parse_args(argv)


# ---------------------------------------------------------------- scene
def site_to_world(e, n):
    r = math.hypot(e, n)
    if r < 1e-9:
        return UNIT_CENTRE
    b = math.degrees(math.atan2(e, n))
    th = math.radians(b + NORTH_DEG)
    return (UNIT_CENTRE[0] + r * math.sin(th), UNIT_CENTRE[1] + r * math.cos(th))


def emission_image_material(name, img):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


def add_ortho(path, z, coll):
    with open(path + ".json", "r", encoding="utf-8") as f:
        om = json.load(f)
    ex = om["local_extent_m"]
    corners = [site_to_world(ex["west"], ex["north"]), site_to_world(ex["east"], ex["north"]),
               site_to_world(ex["east"], ex["south"]), site_to_world(ex["west"], ex["south"])]
    uvs = [(0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.0, 0.0)]
    me = bpy.data.meshes.new("ORTHO_" + os.path.basename(path))
    me.from_pydata([(x, y, z) for x, y in corners], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name="UVMap")
    for li, loop in enumerate(me.loops):
        uv.data[li].uv = uvs[loop.vertex_index]
    img = bpy.data.images.load(path)
    me.materials.append(emission_image_material("ORTHO_" + os.path.basename(path), img))
    ob = bpy.data.objects.new(me.name, me)
    coll.objects.link(ob)
    log(f"orthophoto {os.path.basename(path)} {om['size_px']} at z {z}")
    return ob


def import_tower(path, coll):
    before = set(bpy.data.objects)
    bpy.ops.wm.obj_import(filepath=path, forward_axis="Y", up_axis="Z")
    new = [o for o in set(bpy.data.objects) - before if o.type == "MESH"]
    for ob in new:
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        coll.objects.link(ob)
        me = ob.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        me.polygons.foreach_set("material_index", [0] * len(me.polygons))
        me.update()
    log(f"imported {os.path.basename(path)}: {[o.name for o in new]}")
    return new


def aim(cam, pos, look):
    cam.location = Vector(pos)
    d = Vector(look) - Vector(pos)
    cam.rotation_mode = "XYZ"
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def make_camera(name, p):
    cd = bpy.data.cameras.new(name)
    cd.sensor_fit = "HORIZONTAL"
    cd.sensor_width = float(p.get("sensor_mm", 36.0))
    cd.lens = float(p["lens_mm"])
    cd.clip_start = 0.5
    cd.clip_end = 20000.0
    cam = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(cam)
    if p.get("matrix_world"):
        cam.matrix_world = Matrix([list(r) for r in p["matrix_world"]])
    else:
        aim(cam, p["pos"], p["look"])
    return cam


# ---------------------------------------------------------------- node helpers
class NT:
    def __init__(self, nt):
        self.nt = nt
        self.n = 0

    def node(self, typ, **props):
        n = self.nt.nodes.new(typ)
        for k, v in props.items():
            setattr(n, k, v)
        self.n += 1
        n.location = ((self.n % 12) * 220, -(self.n // 12) * 260)
        return n

    def put(self, sock, val):
        if isinstance(val, bpy.types.NodeSocket):
            self.nt.links.new(val, sock)
        else:
            sock.default_value = val

    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.node("ShaderNodeMath", operation=op, use_clamp=clamp)
        self.put(n.inputs[0], a)
        if b is not None:
            self.put(n.inputs[1], b)
        if c is not None:
            self.put(n.inputs[2], c)
        return n.outputs[0]

    def vmath(self, op, a, b=None, scale=None):
        n = self.node("ShaderNodeVectorMath", operation=op)
        self.put(n.inputs[0], a)
        if b is not None:
            self.put(n.inputs[1], b)
        if scale is not None:
            self.put(n.inputs["Scale"], scale)
        return n.outputs["Value"] if op in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else n.outputs["Vector"]

    def combine(self, x, y, z):
        n = self.node("ShaderNodeCombineXYZ")
        self.put(n.inputs[0], x)
        self.put(n.inputs[1], y)
        self.put(n.inputs[2], z)
        return n.outputs[0]


def projector_block(h, pr, with_facing=True):
    """returns (color socket, mask socket, weight socket) of one projector in the node tree h"""
    cam = pr["cam"]
    f, sw = float(pr["lens_mm"]), float(pr.get("sensor_mm", 36.0))
    W, H = pr["res"]
    tc = h.node("ShaderNodeTexCoord")
    tc.object = cam
    sep = h.node("ShaderNodeSeparateXYZ")
    h.put(sep.inputs[0], tc.outputs["Object"])
    d = h.math("MULTIPLY", sep.outputs["Z"], -1.0)
    dsafe = h.math("MAXIMUM", d, 0.01)
    k = f / sw
    u = h.math("MULTIPLY_ADD", h.math("DIVIDE", sep.outputs["X"], dsafe), k, 0.5)
    v = h.math("MULTIPLY_ADD", h.math("DIVIDE", sep.outputs["Y"], dsafe), k * (W / H), 0.5)
    uv = h.combine(u, v, 0.0)
    tex = h.node("ShaderNodeTexImage", extension="CLIP", interpolation="Linear")
    tex.image = pr["image"]
    h.put(tex.inputs["Vector"], uv)
    dep = h.node("ShaderNodeTexImage", extension="CLIP", interpolation="Closest")
    dep.image = pr["depth"]
    h.put(dep.inputs["Vector"], uv)
    sc = h.node("ShaderNodeSeparateColor")
    h.put(sc.inputs[0], dep.outputs["Color"])
    D = sc.outputs["Red"]
    # depth test: point visible from the projector when its depth <= shadow-map depth (+ tolerance)
    vis = h.math("LESS_THAN", d, h.math("MULTIPLY_ADD", D, 1.0 + pr.get("tol_rel", 0.004), pr.get("tol_abs", 0.35)))
    front = h.math("GREATER_THAN", d, 0.5)
    mask = h.math("MULTIPLY", h.math("MULTIPLY", tex.outputs["Alpha"], vis), front)
    pr["_dbg"] = {"u": u, "v": v, "D": D, "d": d, "alpha": tex.outputs["Alpha"], "vis": vis}
    if not with_facing:
        return tex.outputs["Color"], mask, mask
    geo = h.node("ShaderNodeNewGeometry")
    campos = h.combine(*[float(x) for x in cam.matrix_world.translation])
    L = h.vmath("NORMALIZE", h.vmath("SUBTRACT", campos, geo.outputs["Position"]))
    ndl = h.math("ABSOLUTE", h.vmath("DOT_PRODUCT", geo.outputs["Normal"], L))
    facing = h.math("POWER", ndl, 2.0)
    # texel density (pixels per metre) so the close projector wins where both see the surface
    dens = h.math("DIVIDE", W * k, dsafe)
    w = h.math("MULTIPLY", h.math("MULTIPLY", mask, facing), dens)
    return tex.outputs["Color"], mask, w


def projected_material(name, projectors, unseen=UNSEEN):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    h = NT(nt)
    acc_c, acc_w = None, None
    for pr in projectors:
        c, m, w = projector_block(h, pr)
        cw = h.vmath("SCALE", c, scale=w)
        acc_c = cw if acc_c is None else h.vmath("ADD", acc_c, cw)
        acc_w = w if acc_w is None else h.math("ADD", acc_w, w)
    inv = h.math("DIVIDE", 1.0, h.math("MAXIMUM", acc_w, 1e-6))
    col = h.vmath("SCALE", acc_c, scale=inv)
    has = h.math("GREATER_THAN", acc_w, 1e-5)
    mix = h.node("ShaderNodeMix", data_type="RGBA", blend_type="MIX")
    h.put(mix.inputs["Factor"], has)
    mix.inputs[6].default_value = (*unseen, 1.0)
    h.put(mix.inputs[7], col)
    em = h.node("ShaderNodeEmission")
    h.put(em.inputs["Color"], mix.outputs[2])
    out = h.node("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


def coverage_material(name, projectors):
    """R = seen by projector 1, G = seen by any other projector, B = 1 (tower pixel)"""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    h = NT(nt)
    m1 = None
    mo = None
    g1 = group_of(projectors[0])
    for i, pr in enumerate(projectors):
        _, m, _ = projector_block(h, pr, with_facing=False)
        if group_of(pr) == g1:
            m1 = m if m1 is None else h.math("MAXIMUM", m1, m)
        else:
            mo = m if mo is None else h.math("MAXIMUM", mo, m)
    em = h.node("ShaderNodeEmission")
    h.put(em.inputs["Color"], h.combine(m1, mo if mo is not None else 0.0, 1.0))
    out = h.node("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


def debug_material(name, pr, keys, scale=(1.0, 1.0, 1.0)):
    """emission = the three named intermediate values of projector pr (u, v, D, d, alpha, vis)"""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    h = NT(nt)
    projector_block(h, pr, with_facing=False)
    dbg = pr["_dbg"]
    vals = [h.math("MULTIPLY", dbg[k], sc) for k, sc in zip(keys, scale)]
    em = h.node("ShaderNodeEmission")
    h.put(em.inputs["Color"], h.combine(*vals))
    out = h.node("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


def depth_material(cam):
    mat = bpy.data.materials.new("DEPTH_" + cam.name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    h = NT(nt)
    tc = h.node("ShaderNodeTexCoord")
    tc.object = cam
    sep = h.node("ShaderNodeSeparateXYZ")
    h.put(sep.inputs[0], tc.outputs["Object"])
    d = h.math("MULTIPLY", sep.outputs["Z"], -1.0)
    em = h.node("ShaderNodeEmission")
    h.put(em.inputs["Color"], h.combine(d, d, d))
    out = h.node("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


def clay_material():
    mat = bpy.data.materials.new("CLAY")
    mat.use_nodes = True
    b = mat.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (0.62, 0.62, 0.60, 1.0)
    b.inputs["Roughness"].default_value = 0.8
    return mat


def group_of(pr):
    """projectors that belong together (the six faces of one 360 node) share a group; a lone keyframe is its own group"""
    return pr.get("group", pr["name"])


def set_material(obs, mat):
    for ob in obs:
        ob.data.materials.clear()
        ob.data.materials.append(mat)


# ---------------------------------------------------------------- views
def view_defs(names):
    cx, cy = LOOK0[0], LOOK0[1]
    dx, dy = CAM0[0] - cx, CAM0[1] - cy
    R, az0 = math.hypot(dx, dy), math.atan2(dy, dx)
    out = []
    for nm in names:
        if nm == "orig":
            out.append({"name": "orig", "pos": list(CAM0), "look": list(LOOK0), "lens_mm": 32.0})
        elif nm.startswith("az"):
            a = float(nm[2:])
            th = az0 + math.radians(a)  # + = counter-clockwise seen from above
            out.append({"name": nm, "pos": [cx + R * math.cos(th), cy + R * math.sin(th), CAM0[2]], "look": list(LOOK0), "lens_mm": 32.0,
                        "azimuth_offset_deg": a})
        elif nm == "low":
            th = az0 + math.radians(15.0)
            out.append({"name": "low", "pos": [cx + 110 * math.cos(th), cy + 110 * math.sin(th), 40.0], "look": [cx, cy, 20.0], "lens_mm": 32.0,
                        "azimuth_offset_deg": 15.0, "note": "lower and closer: 110 m out, 40 m up"})
        elif nm.startswith("at;"):
            # a free view: at;x;y;z;lx;ly;lz;lens[;label]
            q = nm.split(";")
            out.append({"name": q[8] if len(q) > 8 else "at" + str(len(out)), "pos": [float(x) for x in q[1:4]], "look": [float(x) for x in q[4:7]], "lens_mm": float(q[7])})
        elif nm.startswith("orbit"):
            n = int(nm[5:])
            for i in range(n):
                th = az0 + 2 * math.pi * i / n
                out.append({"name": f"orbit{i:02d}", "pos": [cx + R * math.cos(th), cy + R * math.sin(th), CAM0[2]], "look": list(LOOK0), "lens_mm": 32.0,
                            "azimuth_offset_deg": 360.0 * i / n})
    return out


# ---------------------------------------------------------------- coverage (geometry)
def surface_samples(obs, density_m2=4.0, stride=1, cap=24):
    """(point, normal, area) samples over the mesh surface: one per small face, several per big face (balcony slabs are
    ~1000 m2 n-gons whose centre is deep inside the building)"""
    out = []
    for ob in obs:
        me = ob.data
        me.calc_loop_triangles()
        tris = me.loop_triangles
        M = ob.matrix_world
        for ti in range(0, len(tris), stride):
            t = tris[ti]
            a = t.area * stride
            if a <= 1e-6:
                continue
            v = [M @ me.vertices[i].co for i in t.vertices]
            n = (v[1] - v[0]).cross(v[2] - v[0]).normalized()
            k = max(1, min(cap, int(a / density_m2)))
            if k == 1:
                out.append(((v[0] + v[1] + v[2]) / 3.0, n, a))
                continue
            # k barycentric samples on a jittered lattice
            m = int(math.ceil(math.sqrt(k)))
            pts = []
            for i in range(m):
                for j in range(m - i):
                    b0 = (i + 0.5) / (m + 0.5)
                    b1 = (j + 0.5) / (m + 0.5)
                    b2 = 1.0 - b0 - b1
                    if b2 < 0:
                        continue
                    pts.append(v[0] * b0 + v[1] * b1 + v[2] * b2)
            for q in pts:
                out.append((q, n, a / len(pts)))
    return out


def coverage_geometry(target_obs, occluder_obs, projectors, stride=1, label="", n_orbit_az=8):
    """area-weighted coverage. Denominator = surface that an outside orbit can see at all (visible from any of
    n_orbit_az x 2 virtual viewpoints: the aerial ring at 228 m / 90 m up and a low ring at 110 m / 15 m up);
    numerators = area painted by projector group 1 alone and by all groups; plus the share of painted area hit
    at > 70 deg incidence (smeared texels)."""
    verts, polys = [], []
    for ob in occluder_obs:
        me = ob.data
        base = len(verts)
        verts.extend([tuple(ob.matrix_world @ v.co) for v in me.vertices])
        polys.extend([tuple(base + i for i in p.vertices) for p in me.polygons])
    bvh = BVHTree.FromPolygons(verts, polys)
    groups = []
    for pr in projectors:
        if group_of(pr) not in groups:
            groups.append(group_of(pr))
    cams = []
    for pr in projectors:
        cam = pr["cam"]
        cams.append((groups.index(group_of(pr)), cam.matrix_world.translation.copy(), cam.matrix_world.inverted(),
                     float(pr["lens_mm"]) / float(pr.get("sensor_mm", 36.0)), pr["res"][0] / pr["res"][1]))
    cx, cy = LOOK0[0], LOOK0[1]
    orbit = []
    for i in range(n_orbit_az):
        th = 2 * math.pi * i / n_orbit_az
        orbit.append(Vector((cx + 228 * math.cos(th), cy + 228 * math.sin(th), 90.0)))
        orbit.append(Vector((cx + 110 * math.cos(th + math.pi / n_orbit_az), cy + 110 * math.sin(th + math.pi / n_orbit_az), 15.0)))

    def visible_from(C, q):
        L = C - q
        dist = L.length
        L.normalize()
        return bvh.ray_cast(C, -L, dist - 0.05)[0] is None

    t0 = time.time()
    samples = surface_samples(target_obs, 4.0, stride)
    total = sum(a for _, _, a in samples)
    ext = 0.0
    seen_g = [0.0] * len(groups)
    graz_g = [0.0] * len(groups)
    seen_any = 0.0
    seen_any_ext = 0.0
    for q, n, a in samples:
        is_ext = any(visible_from(C, q) for C in orbit)
        if is_ext:
            ext += a
        hit_groups = set()
        graz_groups = set()
        for gi, C, Minv, k, asp in cams:
            if gi in hit_groups:
                continue
            pc = Minv @ q
            d = -pc.z
            if d <= 0.5:
                continue
            u = 0.5 + pc.x / d * k
            v = 0.5 + pc.y / d * k * asp
            if not (0 <= u <= 1 and 0 <= v <= 1):
                continue
            if not visible_from(C, q):
                continue
            hit_groups.add(gi)
            if abs(n.dot((C - q).normalized())) < math.cos(math.radians(70)):
                graz_groups.add(gi)
        for gi in hit_groups:
            if is_ext:
                seen_g[gi] += a
        for gi in graz_groups:
            graz_g[gi] += a
        if hit_groups:
            seen_any += a
            if is_ext:
                seen_any_ext += a
    log(f"geometry coverage [{label}] {len(samples)} samples in {time.time() - t0:.1f}s; total {total:.0f} m2, externally visible {ext:.0f} m2")
    return {"target": label, "samples": len(samples), "total_area_m2": round(total), "externally_visible_area_m2": round(ext),
            "externally_visible_share_of_total": round(ext / total, 3),
            "groups": [{"group": g, "painted_share_of_external": round(seen_g[i] / max(ext, 1e-9), 3),
                        "grazing_gt70_share_of_painted": round(graz_g[i] / max(seen_g[i], 1e-9), 3)} for i, g in enumerate(groups)],
            "painted_by_first_group_share_of_external": round(seen_g[0] / max(ext, 1e-9), 3),
            "painted_by_all_share_of_external": round(seen_any_ext / max(ext, 1e-9), 3)}


# ---------------------------------------------------------------- main
def main():
    a = args()
    os.makedirs(a.out, exist_ok=True)
    W, H = [int(x) for x in a.res.lower().split("x")]
    DW, DH = [int(x) for x in a.depth_res.lower().split("x")]
    with open(a.projectors, "r", encoding="utf-8") as f:
        pconf = json.load(f)
    projectors = pconf["projectors"]
    timings = {"renders": [], "setup_s": None}
    t_setup = time.time()

    scene = bpy.context.scene
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.eevee.taa_render_samples = a.samples
    scene.eevee.use_shadows = True
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    SKY = (0.52, 0.68, 0.90, 1.0)
    bg.inputs[0].default_value = SKY
    bg.inputs[1].default_value = 1.0
    sun = bpy.data.lights.new("SUN", "SUN")
    sun.energy = 3.5
    sun.angle = math.radians(1.0)
    sun_ob = bpy.data.objects.new("SUN", sun)
    scene.collection.objects.link(sun_ob)
    sun_ob.rotation_euler = (math.radians(50), 0.0, math.radians(-15))  # sun from the camera side (south-ish), raking

    coll = bpy.data.collections.new("TOWER")
    scene.collection.children.link(coll)
    full = import_tower(OBJ_BARE if a.bare else OBJ_FULL, coll)
    coll_b = bpy.data.collections.new("BARE")
    scene.collection.children.link(coll_b)
    bare = import_tower(OBJ_BARE, coll_b)
    for ob in bare:
        ob.hide_render = True
    grounds = []
    if not a.no_ortho:
        gc = bpy.data.collections.new("GROUND")
        scene.collection.children.link(gc)
        for i, pth in enumerate(ORTHOS):
            if os.path.exists(pth) and os.path.exists(pth + ".json"):
                grounds.append(add_ortho(pth, GROUND_Z - 0.3 - 0.5 * i, gc))

    # projector cameras + depth maps
    for i, pr in enumerate(projectors):
        pr["cam"] = make_camera(f"PROJ_{i}_{pr['name']}", pr)
        img = bpy.data.images.load(pr["image"])
        pr["res"] = list(img.size) if not pr.get("res") else pr["res"]
        pr["image"] = img
        dpath = os.path.join(a.out, f"depth_{pr['name']}.exr")
        if not os.path.exists(dpath):
            t0 = time.time()
            scene.camera = pr["cam"]
            square = pr["res"][0] == pr["res"][1]
            scene.render.resolution_x, scene.render.resolution_y = (max(DW, DH), max(DW, DH)) if square else (DW, DH)
            scene.render.image_settings.file_format = "OPEN_EXR"
            scene.render.image_settings.color_mode = "RGB"
            scene.render.image_settings.exr_codec = "ZIP"
            scene.render.image_settings.color_depth = "32"
            scene.render.filter_size = 0.01
            scene.eevee.taa_render_samples = 1
            bg.inputs[0].default_value = (1e5, 1e5, 1e5, 1.0)
            # (view_layer.material_override is ignored by EEVEE Next: assign the depth material directly)
            dmat = depth_material(pr["cam"])
            set_material(full, dmat)
            for g in grounds:
                g.hide_render = True
            scene.render.filepath = dpath
            bpy.ops.render.render(write_still=True)
            for g in grounds:
                g.hide_render = False
            bg.inputs[0].default_value = SKY
            scene.eevee.taa_render_samples = a.samples
            scene.render.filter_size = 1.5
            scene.render.image_settings.file_format = "PNG"
            scene.render.image_settings.color_depth = "8"
            timings["renders"].append({"what": f"depth_{pr['name']}", "res": [scene.render.resolution_x, scene.render.resolution_y], "s": round(time.time() - t0, 1)})
            log(f"depth map {pr['name']} in {time.time() - t0:.1f}s")
        dimg = bpy.data.images.load(dpath)
        dimg.colorspace_settings.name = "Non-Color"
        pr["depth"] = dimg

    g1 = group_of(projectors[0])
    first = [pr for pr in projectors if group_of(pr) == g1]
    mats = {"clay": clay_material(), "proj1": projected_material("PROJ1", first),
            "proj2": projected_material("PROJ2", projectors), "cov": coverage_material("COV", projectors),
            "dbgA": debug_material("DBG_A", projectors[0], ("u", "v", "alpha")),
            "dbgB": debug_material("DBG_B", projectors[0], ("d", "D", "vis"), (1 / 400.0, 1 / 400.0, 1.0))}
    timings["setup_s"] = round(time.time() - t_setup, 1)
    log(f"setup {timings['setup_s']}s")

    # the render camera
    cd = bpy.data.cameras.new("VIEW")
    cd.sensor_fit = "HORIZONTAL"
    cd.sensor_width = 36.0
    cd.clip_start = 0.5
    cd.clip_end = 20000.0
    cam = bpy.data.objects.new("VIEW", cd)
    scene.collection.objects.link(cam)
    scene.camera = cam

    views = view_defs(a.views.split(","))
    with open(os.path.join(a.out, "views.json"), "w", encoding="utf-8") as f:
        json.dump({"frame": "X = x_cm/100, Y = -y_cm/100, Z up, unit floor at 0", "azimuth": "+ = counter-clockwise seen from above, about the look point",
                   "views": views + (view_defs([f"orbit{a.orbit}"]) if a.orbit else []), "projectors": [{k: v for k, v in pr.items() if k not in ("cam", "image", "depth", "_dbg")} for pr in projectors]}, f, indent=1)
    variants = a.variants.split(",")

    def render_view(v, variant, w, h):
        aim(cam, v["pos"], v["look"])
        cd.lens = float(v["lens_mm"])
        scene.render.resolution_x, scene.render.resolution_y = w, h
        set_material(full, mats[variant])
        for g in grounds:
            g.hide_render = variant == "cov"
        bg.inputs[0].default_value = (0, 0, 0, 1) if variant == "cov" else SKY
        scene.eevee.taa_render_samples = 1 if variant == "cov" else a.samples
        scene.render.filter_size = 0.01 if variant == "cov" else 1.5
        scene.render.filepath = os.path.join(a.out, f"{v['name']}__{variant}.png")
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        dt = time.time() - t0
        timings["renders"].append({"what": f"{v['name']}__{variant}", "res": [w, h], "s": round(dt, 1)})
        log(f"render {v['name']} {variant} {w}x{h}: {dt:.1f}s")

    for v in views:
        for variant in variants:
            render_view(v, variant, W, H)
    if a.orbit:
        for v in view_defs([f"orbit{a.orbit}"]):
            render_view(v, "cov", 480, 270)

    if not a.no_coverage:
        cov = {"envelope": coverage_geometry(bare, bare, projectors, 1, "bare envelope (slabs, glass, crown), bare occluders"),
               "full": coverage_geometry(full, full, projectors, 6, "full mass incl. railings/planters/bushes (every 6th triangle)")}
        with open(os.path.join(a.out, "coverage.json"), "w", encoding="utf-8") as f:
            json.dump(cov, f, indent=1)
        log("coverage " + json.dumps(cov))
    with open(os.path.join(a.out, "timings.json"), "w", encoding="utf-8") as f:
        json.dump(timings, f, indent=1)
    if a.save_blend:
        set_material(full, mats["proj2"])
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "project_skin.blend"))
    log("done")


main()

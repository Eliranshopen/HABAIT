"""bake_skins.py - lane C1 (offline flyover route): bake the GPT skins of the four exterior 360 nodes onto the real site geometry.

Run (Git Bash, headless Blender 4.5, CPU):
  "$BLENDER" -b --factory-startup -P bake_skins.py -- --out "C:/Habait/habait-walkaround/Habait/flyover/renders/baked"
        [--tower-res 4096] [--other-res 2048] [--from-prep] [--skip-bake] [--no-gain] [--k 4]
  --from-prep  reuse <out>/_cache/prep.blend (joined meshes + UVs) instead of re-importing and re-unwrapping
  --skip-bake  reuse the cached bakes in <out>/_cache/*.npy (implies --from-prep); only the composite runs again
Writes <out>/<group>.png (skin), <out>/<group>_cov.png (coverage code), <out>/<group>_src.png (which node won),
<out>/bake_meta.json (timings, texel sizes, calibration, per-group coverage) and <out>/baked.blend (emission materials on the
baked textures, the scene render_check.py opens). Inputs are read in place; nothing outside Habait/flyover is written.

Geometry (site.glb of habait-16, imported untransformed: Blender frame = plan-world X right, Y up the plan, Z up, metres,
unit floor z 0, orthophoto quad at z -52.4):
  tower         = STUDIO_mass crown + slab_edges + mass_glass + railing_glass, joined, Smart UV Project -> 4096 atlas
                  (the horizontal caps of mass_glass are hidden inside the slab sandwich: split off as tower_hidden,
                  never baked, rendered flat grey and counted as "unbaked" if a view ever sees them)
  tower_detail  = handrail, mullions, planters, bushes (240k tiny triangles) + every atlas face under 0.1 m2 (the 2 cm edges
                  of the glass-panel boxes: 30k+ one-texel islands that collapse the packing): per-VERTEX projection into a
                  colour attribute; visibility by BVH ray casts node -> vertex
  UVs: Smart UV Project 66 deg, margin_method FRACTION 1.2 texels (the default SCALED margin packed the tower at 0.3% fill)
  podium        = STUDIO_podium_*  -> 2048 ; nb = 150 OSM neighbour masses STUDIO_nb_* -> 2048
  apt           = APT846_* (the unit shell on floor 16) -> 2048
  ground        = a new 440 m square patch centred on the tower, 5 cm above the orthophoto quad -> 2048 (21 cm texels)
  ground_far    = a 4 km square patch, 3 cm above the quad -> 2048 (2 m texels), its last 150 m feathered into the orthophoto;
                  holes on both fall back to the Esri orthophoto (baked into the same UV); beyond 2 km the raw quad stays

Node -> camera mapping (each skinned equirect is a 360 camera at its node position; spherical mapping, not a pinhole):
  node position O and centre look L come from studio renders/clay-nodes-ortho/<node>/faces.json (pos, centre_look), the same
  cameras cube2equi.py used to build the clay pano that GPT Image 2.5 painted over.
    c = normalize((L - O) with z = 0)   the direction of the equirect centre column u = 0.5
    r = c x Z = (c.y, -c.x, 0)          u grows clockwise seen from above
  per baked texel (world position P, shading normal N):
    d = (P - O) / |P - O|
    lon = atan2(d.r, d.c) ; lat = asin(d.z) ; u = 0.5 + lon / 2pi ; v = 0.5 - lat / pi   (v 0 = zenith, image row 0)
    colour = bilinear(equirect, u * W - 0.5 (wraps), v * H - 0.5), from a 4-level mip pyramid chosen by texel/pano-pixel size
  nodes (plan-world metres)              skin used (first existing of .v2.seam, .v2, .seam, plain)
    node-a-aerial  (196.32, -134.55, 90.00)  panos-ext/node-a-aerial.seam.png      centre yaw 303.65 deg cw from +Y
    node-b-tower   ( 68.45,  -47.26, 17.79)  panos-ext/node-b-tower.seam.png       302.01
    node-c-facade  ( 23.31,  -20.89,  3.19)  panos-ext/node-c-facade.v2.seam.png   306.87
    node-d-terrace ( 14.85,  -14.11,  2.02)  panos-ext-parquet/node-d-terrace.v2.seam.png 300.02
Visibility = Blender's own ray tracing, not the depth PNGs: for every node a point light (radius 0) is put at O and Cycles bakes
DIFFUSE/DIRECT (no colour) into the atlas; the bake equals K * cos(theta) / r^2 where the shadow ray from the texel to O is free,
0 where the site geometry occludes it. vis = bake * r^2 / (K cos), K calibrated per group/node (the mode of the ratio).
Per-vertex groups use BVH ray casts from O instead. Weights: w = vis_soft * ramp(cos, 0.08..0.25) * (30 cos / r)^k (k 4: the
sharpest view wins, overlaps feather), vis_soft = vis * normalised 7x7 box blur (feathers occlusion edges inside islands).
Optional per-node colour gain (median ratio to node-b on texels both see well, clipped 0.7..1.4) against the "wrong colours".
Edge guard (--edge-guard 4): a Cycles equirect distance map per node (1920x960); a texel whose direction lies within 4 pano px
(at 3840) of a depth jump (behind: r > 1.06 min + 0.5 m; in front: max > 1.25 r + 2 m) gets weight 1e-3 from that node (0 on the
ground, which then falls back to the orthophoto; ground texels are tested against a buildings-only depth map, because grazing
ground has a steep smooth depth gradient that is not a silhouette): GPT silhouettes never match the clay to the pixel, and without the guard the
tower outline is painted onto the ground behind it and the sky onto the tower edges.
Coverage classes per texel (footprint fp = r * (2pi/3840) / max(cos, .05) of the winning node): 1 sharp fp <= .12 m,
2 soft <= .35 m, 3 smeared > .35 m, 4 hole (no node sees it), 5 unbaked (tower_hidden). Surroundings use 7..12 (+6).
"""
import bpy, bmesh, sys, os, json, math, time, zlib, struct
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
PROJ = "C:/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv"
SITE_GLB = PROJ + "/renders/site3d/site.glb"
FACES = PROJ + "/renders/clay-nodes-ortho/{}/faces.json"
TLOC = "C:/Habait/habait-walkaround/Habait/tour360/apartments/apt846/_local"
NODES = ["node-a-aerial", "node-b-tower", "node-c-facade", "node-d-terrace"]
REF_NODE = "node-b-tower"
ORTHO_Z = -52.4
TOWER_C = (-5.9, -13.0)
PATCH_R = 220.0
FAR_R = 2000.0
FEATHER_M = 25.0
GROUNDS = {"ground": (PATCH_R, 0.05, 0.0), "ground_far": (FAR_R, 0.03, 150.0)}   # half size m, z above the ortho quad, feather m
PANO_W = 3840
DELTA = 2 * math.pi / PANO_W
CLAY = {"tower": (0.62, 0.62, 0.60), "podium": (0.80, 0.79, 0.76), "nb": (0.70, 0.69, 0.66), "apt": (0.78, 0.76, 0.72),
        "ground": (0.55, 0.52, 0.45), "ground_far": (0.55, 0.52, 0.45), "tower_detail": (0.5, 0.5, 0.5)}
ATLAS = ["tower", "podium", "nb", "apt", "ground", "ground_far"]
DETAIL_KEYS = ("handrail", "mullions", "planters", "bushes")
DETAIL_OBJS = DETAIL_KEYS + ("small",)       # "small" = atlas faces under SMALL_M2, split off before the unwrap
SMALL_M2 = 0.1
GUARD_W = {"tower": 1e-3, "apt": 1e-3, "podium": 1e-3, "nb": 1e-3, "ground": 0.0, "ground_far": 0.0}   # ground falls back to the orthophoto
GAIN_CLIP = (0.7, 1.4)
NODE_RGB = {"node-a-aerial": (60, 110, 255), "node-b-tower": (60, 220, 90), "node-c-facade": (230, 70, 220), "node-d-terrace": (40, 220, 230)}


def log(*a):
    print("[bake]", *a, flush=True)


def get_args():
    import argparse
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=HERE + "/renders/baked")
    p.add_argument("--tower-res", type=int, default=4096)
    p.add_argument("--other-res", type=int, default=2048)
    p.add_argument("--samples", type=int, default=1)
    p.add_argument("--margin", type=int, default=3)
    p.add_argument("--k", type=float, default=4.0)
    p.add_argument("--from-prep", action="store_true")
    p.add_argument("--skip-bake", action="store_true")
    p.add_argument("--no-gain", action="store_true")
    p.add_argument("--chunk", type=int, default=512)
    p.add_argument("--edge-guard", type=int, default=4, help="pano px (at 3840) around depth jumps where a node is distrusted; 0 = off")
    return p.parse_args(argv)


# ------------------------------------------------------------------ small utils
def write_png(path, arr):
    """arr (H, W, 3|4) uint8, row 0 = top"""
    arr = np.ascontiguousarray(arr)
    h, w, c = arr.shape
    raw = np.empty((h, 1 + w * c), np.uint8)
    raw[:, 0] = 0
    raw[:, 1:] = arr.reshape(h, w * c)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, {3: 2, 4: 6}[c], 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw.tobytes(), 6)) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


S2L = ((np.arange(256) / 255.0) ** 2.2).astype(np.float32)          # sRGB-ish -> linear LUT


def lin2u8(x):
    return (np.clip(x, 0, 1) ** (1 / 2.2) * 255 + 0.5).astype(np.uint8)


def box_blur(a, r):
    """separable box blur (2r+1), edge-clamped, float32"""
    out = a.astype(np.float32)
    for ax in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[ax] = (r + 1, r)
        cs = np.cumsum(np.pad(out, pad, mode="edge"), axis=ax, dtype=np.float64)
        n = out.shape[ax]
        hi = np.take(cs, np.arange(2 * r + 1, 2 * r + 1 + n), axis=ax)
        lo = np.take(cs, np.arange(0, n), axis=ax)
        out = ((hi - lo) / (2 * r + 1)).astype(np.float32)
    return out


def pick_skin(node):
    dirs = [TLOC + "/panos-ext", TLOC + "/panos-ext-parquet"]
    for suf in (".v2.seam.png", ".v2.png", ".seam.png", ".png"):
        for d in dirs:
            p = f"{d}/{node}{suf}"
            if os.path.exists(p):
                return p
    raise FileNotFoundError(node)


def node_frames():
    out = []
    for n in NODES:
        m = json.load(open(FACES.format(n), encoding="utf8"))
        O = np.array(m["pos"], np.float64)
        L = np.array(m["centre_look"], np.float64)
        c = L - O
        c[2] = 0
        c /= np.linalg.norm(c)
        r = np.array([c[1], -c[0], 0.0])
        out.append({"id": n, "O": O, "c": c, "r": r, "skin": pick_skin(n),
                    "yaw_deg": round(math.degrees(math.atan2(c[0], c[1])) % 360, 2)})
    return out


# ------------------------------------------------------------------ pano pyramid + sampling
def load_pano(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    buf = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    a = (buf.reshape(h, w, 4)[::-1, :, :3] * 255 + 0.5).astype(np.uint8)   # row 0 = top
    del buf
    pyr = [a]
    for _ in range(3):
        p = S2L[pyr[-1]]
        h2, w2 = p.shape[0] // 2, p.shape[1] // 2
        p = p[:h2 * 2, :w2 * 2].reshape(h2, 2, w2, 2, 3).mean(axis=(1, 3))
        pyr.append(lin2u8(p))
    return pyr


def bilinear(img, u, v):
    H, W = img.shape[:2]
    x = u * W - 0.5
    y = v * H - 0.5
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    fx = (x - x0).astype(np.float32)[:, None]
    fy = (y - y0).astype(np.float32)[:, None]
    x0m = x0 % W
    x1m = (x0 + 1) % W
    y0c = np.clip(y0, 0, H - 1)
    y1c = np.clip(y0 + 1, 0, H - 1)
    c00 = S2L[img[y0c, x0m]]
    c10 = S2L[img[y0c, x1m]]
    c01 = S2L[img[y1c, x0m]]
    c11 = S2L[img[y1c, x1m]]
    return (c00 * (1 - fx) + c10 * fx) * (1 - fy) + (c01 * (1 - fx) + c11 * fx) * fy


def sample_node(nd, pyr, d, ppt):
    """d (M,3) unit world directions from the node; ppt = pano pixels (level 0) per texel -> linear RGB (M,3)"""
    lon = np.arctan2(d @ nd["r"], d @ nd["c"])
    lat = np.arcsin(np.clip(d[:, 2], -1, 1))
    u = 0.5 + lon / (2 * np.pi)
    v = 0.5 - lat / np.pi
    lvl = np.clip(np.log2(np.maximum(ppt, 1.0)), 0, len(pyr) - 1.001)
    l0 = np.floor(lvl).astype(np.int32)
    f = (lvl - l0).astype(np.float32)[:, None]
    out = np.zeros((len(d), 3), np.float32)
    for L in np.unique(l0):
        s = l0 == L
        a = bilinear(pyr[L], u[s], v[s])
        b = bilinear(pyr[L + 1], u[s], v[s])
        out[s] = a * (1 - f[s]) + b * f[s]
    return out


# ------------------------------------------------------------------ scene prep
def objs(pred):
    return [o for o in bpy.data.objects if o.type == "MESH" and pred(o.name)]


def join(obs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
        if o.data.users > 1:
            o.data = o.data.copy()
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.data.materials.clear()
    while ob.data.uv_layers:
        ob.data.uv_layers.remove(ob.data.uv_layers[0])
    for a in [a for a in ob.data.color_attributes]:
        ob.data.color_attributes.remove(a)
    return ob


def smart_uv(ob, margin):
    """margin = FRACTION of the UV square (Blender 4.x 'SCALED' margins collapse the fill to <1% with 30k islands)"""
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    ob.data.uv_layers.new(name="bake")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    t = time.time()
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), margin_method="FRACTION", island_margin=margin, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return time.time() - t


def uv_stats(ob, res):
    me = ob.data
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    vi = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("vertices", vi)
    li = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("loops", li)
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers["bake"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
    P = co[vi].reshape(-1, 3, 3)
    U = uv[li].reshape(-1, 3, 2)
    a3 = 0.5 * np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1).sum()
    e1 = U[:, 1] - U[:, 0]; e2 = U[:, 2] - U[:, 0]
    a2 = 0.5 * np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]).sum()
    return {"tris": int(nt), "area_m2": round(float(a3)), "uv_fill": round(float(a2), 3),
            "texel_m": round(float(math.sqrt(a3 / max(a2 * res * res, 1))), 4)}


def make_ground(name="ground"):
    x0, y0 = TOWER_C
    R, dz, _ = GROUNDS[name]
    me = bpy.data.meshes.new(name)
    z = ORTHO_Z + dz
    me.from_pydata([(x0 - R, y0 - R, z), (x0 + R, y0 - R, z), (x0 + R, y0 + R, z), (x0 - R, y0 + R, z)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new("BK_" + name, me)
    bpy.context.scene.collection.objects.link(ob)
    uvb = me.uv_layers.new(name="bake")
    for li, l in enumerate(me.loops):
        v = me.vertices[l.vertex_index].co
        uvb.data[li].uv = ((v.x - (x0 - R)) / (2 * R), (v.y - (y0 - R)) / (2 * R))
    # the orthophoto quad's own mapping (affine from three of its corners) as a second UV layer
    orth = bpy.data.objects["STUDIO_ortho"]
    om = orth.data
    pts = []
    for li, l in enumerate(om.loops):
        v = orth.matrix_world @ om.vertices[l.vertex_index].co
        pts.append((v.x, v.y, *om.uv_layers.active.data[li].uv))
    uniq = []
    for p in pts:
        if all(abs(p[0] - q[0]) > 1e-3 or abs(p[1] - q[1]) > 1e-3 for q in uniq):
            uniq.append(p)
    A = np.array([[p[0], p[1], 1.0] for p in uniq[:3]])
    Bu = np.linalg.solve(A, np.array([p[2] for p in uniq[:3]]))
    Bv = np.linalg.solve(A, np.array([p[3] for p in uniq[:3]]))
    uvo = me.uv_layers.new(name="ortho")
    for li, l in enumerate(me.loops):
        v = me.vertices[l.vertex_index].co
        q = np.array([v.x, v.y, 1.0])
        uvo.data[li].uv = (float(Bu @ q), float(Bv @ q))
    me.uv_layers.active = uvb
    uvb.active_render = True
    return ob


def prep(args, cache):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    t = time.time()
    bpy.ops.import_scene.gltf(filepath=SITE_GLB)
    log("import", round(time.time() - t, 1), "s")
    for im in list(bpy.data.images):
        if im.name != "orthophoto":
            bpy.data.images.remove(im)
    meta = {}
    # glass caps -> tower_hidden
    glass = bpy.data.objects["STUDIO_mass_006_mass_glass"]
    bpy.ops.object.select_all(action="DESELECT")
    glass.select_set(True)
    bpy.context.view_layer.objects.active = glass
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(glass.data)
    ncap = 0
    for f in bm.faces:
        f.select = abs(f.normal.z) > 0.98
        ncap += f.select
    bmesh.update_edit_mesh(glass.data)
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    caps = [o for o in bpy.context.selected_objects if o != glass][0]
    hid = join([caps], "BK_tower_hidden")
    meta["tower_hidden"] = {"faces": ncap, "area_m2": round(sum(p.area for p in hid.data.polygons))}
    groups = {
        "tower": objs(lambda n: n.startswith("STUDIO_mass_") and any(k in n for k in ("crown", "slab_edges", "mass_glass", "railing_glass"))),
        "podium": objs(lambda n: n.startswith("STUDIO_podium_")),
        "nb": objs(lambda n: n.startswith("STUDIO_nb_")),
        "apt": objs(lambda n: n.startswith("APT846_")),
    }
    details = {k: objs(lambda n, k=k: n.startswith("STUDIO_mass_") and k in n) for k in DETAIL_KEYS}
    for g, obs in groups.items():
        log(g, len(obs), "objects")
        ob = join(obs, "BK_" + g)
        res = args.tower_res if g == "tower" else args.other_res
        if g == "tower":
            # the 2 cm edges of the glass-panel boxes etc. become 1-texel islands: move faces < SMALL_M2 to the per-vertex group
            bpy.ops.object.mode_set(mode="EDIT")
            bm = bmesh.from_edit_mesh(ob.data)
            nsm, asm = 0, 0.0
            for f in bm.faces:
                a_ = f.calc_area()
                f.select = a_ < SMALL_M2
                if f.select:
                    nsm += 1; asm += a_
            bmesh.update_edit_mesh(ob.data)
            bpy.ops.mesh.separate(type="SELECTED")
            bpy.ops.object.mode_set(mode="OBJECT")
            sm = [o for o in bpy.context.selected_objects if o != ob][0]
            sm.name = "BK_detail_small"; sm.data.name = "BK_detail_small"
            meta["tower_small_faces"] = {"faces": nsm, "area_m2": round(asm), "threshold_m2": SMALL_M2}
        dt = smart_uv(ob, 1.2 / res)
        meta[g] = dict(uv_stats(ob, res), res=res, unwrap_s=round(dt, 1))
        log(g, meta[g])
    for k, obs in details.items():
        join(obs, "BK_detail_" + k)
    for gname in GROUNDS:
        g = make_ground(gname)
        meta[gname] = dict(uv_stats(g, args.other_res), res=args.other_res, unwrap_s=0, patch_m=2 * GROUNDS[gname][0])
    bpy.ops.wm.save_as_mainfile(filepath=cache + "/prep.blend")
    return meta


# ------------------------------------------------------------------ baking
def bake_material():
    mat = bpy.data.materials.get("BAKE") or bpy.data.materials.new("BAKE")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    n = {k: nt.nodes.new(t) for k, t in (("geo", "ShaderNodeNewGeometry"), ("em", "ShaderNodeEmission"), ("dif", "ShaderNodeBsdfDiffuse"),
                                           ("out", "ShaderNodeOutputMaterial"), ("tgt", "ShaderNodeTexImage"), ("orth", "ShaderNodeTexImage"),
                                           ("uvo", "ShaderNodeUVMap"))}
    n["dif"].inputs["Color"].default_value = (1, 1, 1, 1)
    n["uvo"].uv_map = "ortho"
    if "orthophoto" in bpy.data.images:
        n["orth"].image = bpy.data.images["orthophoto"]
    nt.links.new(n["uvo"].outputs["UV"], n["orth"].inputs["Vector"])
    return mat, n


def set_mode(mat, n, mode):
    nt = mat.node_tree
    for l in list(nt.links):
        if l.to_node in (n["out"], n["em"]):
            nt.links.remove(l)
    if mode == "diff":
        nt.links.new(n["dif"].outputs[0], n["out"].inputs["Surface"])
        return
    src = {"pos": n["geo"].outputs["Position"], "nrm": n["geo"].outputs["Normal"], "ortho": n["orth"].outputs["Color"]}[mode]
    nt.links.new(src, n["em"].inputs["Color"])
    n["em"].inputs["Strength"].default_value = 1.0
    nt.links.new(n["em"].outputs[0], n["out"].inputs["Surface"])


def setup_cycles(args):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = args.samples
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 0
    sc.cycles.light_sampling_threshold = 0.0
    sc.cycles.use_adaptive_sampling = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0, 0, 0, 1)
        bg.inputs["Strength"].default_value = 0.0
    sc.render.bake.use_pass_direct = True
    sc.render.bake.use_pass_indirect = False
    sc.render.bake.use_pass_color = False
    sc.render.bake.margin = args.margin
    sc.render.bake.margin_type = "EXTEND"


def do_bake(ob, mat, n, mode, res, args):
    img = bpy.data.images.new(f"bk_{ob.name}_{mode}", res, res, alpha=True, float_buffer=True)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(np.zeros(res * res * 4, np.float32))
    set_mode(mat, n, mode)
    n["tgt"].image = img
    mat.node_tree.nodes.active = n["tgt"]
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    t = time.time()
    if mode == "diff":
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT"}, margin=args.margin, margin_type="EXTEND", use_clear=False, target="IMAGE_TEXTURES")
    else:
        bpy.ops.object.bake(type="EMIT", margin=args.margin, margin_type="EXTEND", use_clear=False, target="IMAGE_TEXTURES")
    dt = time.time() - t
    buf = np.empty(res * res * 4, np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    return buf.reshape(res, res, 4), dt


def bake_all(args, cache, meta, nodes):
    setup_cycles(args)
    mat, n = bake_material()
    lights = {}
    for nd in nodes:
        L = bpy.data.lights.new("VIS_" + nd["id"], "POINT")
        L.energy = 1.0e6
        L.shadow_soft_size = 0.0
        try:
            L.use_soft_falloff = False
        except Exception:
            pass
        lo = bpy.data.objects.new("VIS_" + nd["id"], L)
        lo.location = Vector(nd["O"].tolist())
        bpy.context.scene.collection.objects.link(lo)
        lo.hide_render = True
        lights[nd["id"]] = lo
    for g in ATLAS:
        ob = bpy.data.objects["BK_" + g]
        ob.data.materials.clear()
        ob.data.materials.append(mat)
    for g in ATLAS:
        ob = bpy.data.objects["BK_" + g]
        res = meta[g]["res"]
        need = [f"{cache}/{g}_pos.npy", f"{cache}/{g}_nrm.npy"] + [f"{cache}/{g}_raw_{nd['id']}.npy" for nd in nodes]
        if args.from_prep and all(os.path.exists(x) for x in need):
            log("bake cached", g)
            continue
        tm = {}
        px, tm["pos"] = do_bake(ob, mat, n, "pos", res, args)
        valid = px[..., 3] > 0.5
        if not valid.any():
            valid = np.abs(px[..., :3]).sum(-1) > 0
        np.save(f"{cache}/{g}_pos.npy", px[..., :3].copy())
        np.save(f"{cache}/{g}_valid.npy", valid)
        del px
        px, tm["nrm"] = do_bake(ob, mat, n, "nrm", res, args)
        np.save(f"{cache}/{g}_nrm.npy", px[..., :3].astype(np.float16))
        del px
        if g.startswith("ground"):
            px, tm["ortho"] = do_bake(ob, mat, n, "ortho", res, args)
            np.save(f"{cache}/{g}_ortho.npy", lin2u8(px[..., :3]))   # linear -> 8-bit sRGB
            del px
        for nd in nodes:
            for lo in lights.values():
                lo.hide_render = True
            lights[nd["id"]].hide_render = False
            px, tm["vis_" + nd["id"]] = do_bake(ob, mat, n, "diff", res, args)
            np.save(f"{cache}/{g}_raw_{nd['id']}.npy", px[..., 0].copy())
            del px
        meta[g]["bake_s"] = {k: round(v, 1) for k, v in tm.items()}
        meta[g]["valid_texels"] = int(valid.sum())
        log("baked", g, meta[g]["bake_s"])
    for lo in lights.values():
        bpy.data.objects.remove(lo)


# ------------------------------------------------------------------ per-vertex detail visibility (BVH ray casts)
def scene_bvh():
    V, T, off = [], [], 0
    for ob in bpy.data.objects:
        if ob.type != "MESH" or not (ob.name.startswith("BK_") or ob.name == "STUDIO_ortho"):
            continue
        me = ob.data
        me.calc_loop_triangles()
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        M = np.array(ob.matrix_world)
        co = co @ M[:3, :3].T + M[:3, 3]
        tri = np.empty(len(me.loop_triangles) * 3, np.int32); me.loop_triangles.foreach_get("vertices", tri)
        V.append(co); T.append(tri.reshape(-1, 3) + off); off += len(co)
    V = np.concatenate(V); T = np.concatenate(T)
    t = time.time()
    bvh = BVHTree.FromPolygons(V.tolist(), T.tolist(), all_triangles=True)
    log("bvh", len(T), "tris", round(time.time() - t, 1), "s")
    return bvh


def detail_vis(args, cache, meta, nodes):
    if args.from_prep and all(os.path.exists(f"{cache}/detail_{k}_vis.npy") for k in DETAIL_OBJS):
        log("detail vis cached")
        return
    bvh = scene_bvh()
    out = {}
    for k in DETAIL_OBJS:
        ob = bpy.data.objects["BK_detail_" + k]
        me = ob.data
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        nr = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("normal", nr); nr = nr.reshape(-1, 3)
        vis = np.zeros((len(nodes), len(co)), np.uint8)
        t = time.time()
        for i, nd in enumerate(nodes):
            O = Vector(nd["O"].tolist())
            d = co - nd["O"][None, :].astype(np.float32)
            dist = np.linalg.norm(d, axis=1)
            d /= dist[:, None]
            cos = -(d * nr).sum(1)
            cand = np.nonzero(cos > 0.0)[0]
            for j in cand:
                dj = dist[j]
                hit = bvh.ray_cast(O, Vector(d[j]), float(dj - (0.05 + 0.003 * dj)))
                if hit[0] is None:
                    vis[i, j] = 1
        np.save(f"{cache}/detail_{k}_vis.npy", vis)
        meta.setdefault("tower_detail", {})[k] = {"verts": len(co), "raycast_s": round(time.time() - t, 1)}
        log("detail", k, len(co), "verts", round(time.time() - t, 1), "s")


# ------------------------------------------------------------------ occlusion-edge guard (silhouette misregistration)
DEPTH_W = 1920


def node_depths(cache, nodes):
    """equirect distance map per node (Cycles, emission = View Distance), the same camera convention as the skins"""
    todo = [nd for nd in nodes if not (os.path.exists(f"{cache}/depth_{nd['id']}.npy") and os.path.exists(f"{cache}/depthocc_{nd['id']}.npy"))]
    if not todo:
        return
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 1
    sc.cycles.max_bounces = 0
    sc.cycles.filter_width = 0.01
    sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = DEPTH_W, DEPTH_W // 2, 100
    sc.render.image_settings.file_format = "OPEN_EXR"
    sc.render.image_settings.color_depth = "32"
    sc.render.image_settings.color_mode = "RGB"
    if sc.world is None:
        sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    for n in sc.world.node_tree.nodes:
        if n.type == "BACKGROUND":
            n.inputs["Strength"].default_value = 0.0
    m = bpy.data.materials.new("DEPTH")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial"); e = nt.nodes.new("ShaderNodeEmission"); cd = nt.nodes.new("ShaderNodeCameraData")
    dv = nt.nodes.new("ShaderNodeMath"); dv.operation = "DIVIDE"; dv.inputs[1].default_value = 1000.0
    nt.links.new(cd.outputs["View Distance"], dv.inputs[0]); nt.links.new(dv.outputs[0], e.inputs["Color"]); nt.links.new(e.outputs[0], o.inputs["Surface"])
    saved = {}
    for ob in bpy.data.objects:
        if ob.type == "MESH":
            saved[ob.name] = list(ob.data.materials)
            ob.data.materials.clear(); ob.data.materials.append(m)
    cam = bpy.data.objects.new("DCAM", bpy.data.cameras.new("DCAM"))
    sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "PANO"
    try:
        cam.data.panorama_type = "EQUIRECTANGULAR"
    except Exception:
        cam.data.cycles.panorama_type = "EQUIRECTANGULAR"
    cam.data.clip_start = 0.05; cam.data.clip_end = 20000
    cam.rotation_mode = "QUATERNION"
    grounds = [o for o in bpy.data.objects if o.name.startswith("BK_ground") or o.name == "STUDIO_ortho"]
    for nd in todo:
        cam.location = Vector(nd["O"].tolist())
        cam.rotation_quaternion = Vector(nd["c"].tolist()).to_track_quat("-Z", "Y")
        for kind in ("depth", "depthocc"):          # depthocc = buildings only (the ground hidden)
            for o in grounds:
                o.hide_render = kind == "depthocc"
            path = f"{cache}/{kind}_{nd['id']}.exr"
            sc.render.filepath = path
            t = time.time()
            bpy.ops.render.render(write_still=True)
            im = bpy.data.images.load(path, check_existing=False)
            buf = np.empty(DEPTH_W * DEPTH_W // 2 * 4, np.float32); im.pixels.foreach_get(buf); bpy.data.images.remove(im)
            d = buf.reshape(DEPTH_W // 2, DEPTH_W, 4)[::-1, :, 0] * 1000.0
            np.save(f"{cache}/{kind}_{nd['id']}.npy", np.where(d > 0, d, 1e6).astype(np.float32))   # sky = 1e6 m
            log(kind, nd["id"], round(time.time() - t, 1), "s")
        for o in grounds:
            o.hide_render = False
    for ob in bpy.data.objects:
        if ob.name in saved:
            ob.data.materials.clear()
            for mm in saved[ob.name]:
                ob.data.materials.append(mm)
    bpy.data.objects.remove(cam)


def minmax_filter(d, n):
    lo = d.copy(); hi = d.copy()
    pad = np.pad(d, ((n, n), (0, 0)), mode="edge")
    for dy in range(-n, n + 1):
        sh = pad[n + dy:n + dy + d.shape[0]]
        for dx in range(-n, n + 1):
            s_ = np.roll(sh, dx, axis=1)
            np.minimum(lo, s_, out=lo); np.maximum(hi, s_, out=hi)
    return lo, hi


def guard_maps(cache, nodes, n_px):
    out = {}
    if n_px <= 0:
        return out
    n = max(1, int(round(n_px * DEPTH_W / PANO_W)))
    for nd in nodes:
        lo, hi = minmax_filter(np.load(f"{cache}/depth_{nd['id']}.npy"), n)
        lo_occ, _ = minmax_filter(np.load(f"{cache}/depthocc_{nd['id']}.npy"), n)
        out[nd["id"]] = (lo, hi, lo_occ)
    return out


def guard_lookup(maps, nd, d_unit, r, ground=False):
    """True where the texel sits within the guard band of a depth jump in this node's view (either side of a silhouette).
    Ground texels are only tested against the buildings-only map: grazing ground has a steep but smooth depth gradient."""
    lo, hi, lo_occ = maps[nd["id"]]
    H, W = lo.shape
    lon = np.arctan2(d_unit @ nd["r"], d_unit @ nd["c"]); lat = np.arcsin(np.clip(d_unit[:, 2], -1, 1))
    x = ((0.5 + lon / (2 * np.pi)) * W).astype(np.int64) % W
    y = np.clip(((0.5 - lat / np.pi) * H).astype(np.int64), 0, H - 1)
    if ground:
        return r > lo_occ[y, x] * 1.06 + 0.5
    mn = lo[y, x]; mx = hi[y, x]
    behind = r > mn * 1.06 + 0.5          # background next to a closer silhouette: the GPT outline bleeds onto it
    front = mx > r * 1.25 + 2.0           # foreground edge next to far stuff or sky: background colour bleeds onto it
    return behind | front


# ------------------------------------------------------------------ composite
def calibrate(raw, pos, nrm, valid, O):
    sub = (slice(None, None, 4), slice(None, None, 4))
    P = pos[sub][valid[sub]].astype(np.float64)
    Nn = nrm[sub][valid[sub]].astype(np.float64)
    R = raw[sub][valid[sub]].astype(np.float64)
    d = P - O
    r2 = (d * d).sum(1)
    cos = -(d * Nn).sum(1) / np.sqrt(r2)
    ok = (cos > 0.3) & (R > 0)
    if ok.sum() < 200:
        return None, int(ok.sum())
    ratio = R[ok] * r2[ok] / cos[ok]
    top = ratio[ratio > 0.2 * np.percentile(ratio, 99)]
    return float(np.median(top)), int(ok.sum())


def visibility(g, cache, nodes, Kglob, meta, gmaps=None):
    pos = np.load(f"{cache}/{g}_pos.npy", mmap_mode="r")
    nrm = np.load(f"{cache}/{g}_nrm.npy", mmap_mode="r")
    valid = np.load(f"{cache}/{g}_valid.npy")
    N = valid.shape[0]
    validf = box_blur(valid.astype(np.float32), 3)
    cal = {}
    for nd in nodes:
        raw = np.load(f"{cache}/{g}_raw_{nd['id']}.npy", mmap_mode="r")
        K, nok = calibrate(raw, pos, nrm, valid, nd["O"])
        Kuse = K if K is not None else Kglob
        cal[nd["id"]] = {"K": None if K is None else round(K, 2), "samples": nok}
        vis = np.zeros((N, N), np.float32)
        guarded = 0
        seen_pre = 0
        for r0 in range(0, N, 512):
            P = pos[r0:r0 + 512].astype(np.float32)
            Nn = nrm[r0:r0 + 512].astype(np.float32)
            d = P - nd["O"].astype(np.float32)
            r2 = (d * d).sum(-1)
            cos = -(d * Nn).sum(-1) / np.sqrt(np.maximum(r2, 1e-6))
            v = raw[r0:r0 + 512] * r2 / (Kuse * np.maximum(cos, 1e-3))
            vv = np.where((cos > 0.02) & valid[r0:r0 + 512], np.clip(v, 0, 1), 0)
            vv = np.where(vv > 0.5, 1.0, 0.0)                 # binary (1 spp bake)
            if gmaps:
                h_, w_ = vv.shape
                rr = np.sqrt(np.maximum(r2, 1e-6))
                gd = guard_lookup(gmaps, nd, (d / rr[..., None]).reshape(-1, 3), rr.reshape(-1), g.startswith("ground")).reshape(h_, w_)
                guarded += int(((vv > 0.5) & gd).sum())
                seen_pre += int((vv > 0.5).sum())
                vv = np.where(gd & (vv > 0.5), GUARD_W[g], vv)
            vis[r0:r0 + 512] = vv
        soft = box_blur(vis, 3) / np.maximum(validf, 1e-3)
        np.save(f"{cache}/{g}_vis_{nd['id']}.npy", (vis * np.clip(soft, 0, 1)).astype(np.float32))   # float16 underflows the guard weights
        cal[nd["id"]]["seen_share_of_valid"] = round(float((vis[valid] > 0).mean()), 4)
        cal[nd["id"]]["guarded_share_of_seen"] = round(guarded / max(seen_pre, 1), 4)
    meta[g]["calib"] = cal
    log("vis", g, json.dumps(cal))


def node_terms(P, Nn, nd):
    d = P - nd["O"].astype(np.float32)
    r = np.sqrt((d * d).sum(-1))
    d /= np.maximum(r, 1e-6)[:, None]
    cos = -(d * Nn).sum(-1)
    return d, r, cos


def gain_stats(g, cache, nodes, pyrs, texel_m, acc):
    pos = np.load(f"{cache}/{g}_pos.npy", mmap_mode="r")
    nrm = np.load(f"{cache}/{g}_nrm.npy", mmap_mode="r")
    valid = np.load(f"{cache}/{g}_valid.npy")
    sub = (slice(None, None, 3), slice(None, None, 3))
    m = valid[sub]
    P = pos[sub][m].astype(np.float32)
    Nn = nrm[sub][m].astype(np.float32)
    ref = [i for i, nd in enumerate(nodes) if nd["id"] == REF_NODE][0]
    vis = [np.load(f"{cache}/{g}_vis_{nd['id']}.npy", mmap_mode="r")[sub][m].astype(np.float32) for nd in nodes]
    terms = [node_terms(P, Nn, nd) for nd in nodes]
    for i, nd in enumerate(nodes):
        if i == ref:
            continue
        both = (vis[i] > 0.9) & (vis[ref] > 0.9) & (terms[i][2] > 0.3) & (terms[ref][2] > 0.3)
        if both.sum() < 50:
            continue
        ci = sample_node(nd, pyrs[i], terms[i][0][both], texel_m * np.sqrt(terms[i][2][both]) / (terms[i][1][both] * DELTA))
        cr = sample_node(nodes[ref], pyrs[ref], terms[ref][0][both], texel_m * np.sqrt(terms[ref][2][both]) / (terms[ref][1][both] * DELTA))
        acc.setdefault(nd["id"], ([], []))
        acc[nd["id"]][0].append(ci)
        acc[nd["id"]][1].append(cr)


def blend(P, Nn, V, nodes, pyrs, gains, texel_m, k, visrows):
    M = len(P)
    acc = np.zeros((M, 3), np.float32)
    wsum = np.zeros(M, np.float32)
    best_w = np.zeros(M, np.float32)
    best_i = np.full(M, -1, np.int8)
    best_fp = np.zeros(M, np.float32)
    for i, nd in enumerate(nodes):
        d, r, cos = node_terms(P, Nn, nd)
        ramp = np.clip((cos - 0.08) / 0.17, 0, 1)
        w = visrows[i] * ramp * np.maximum(30.0 * cos / np.maximum(r, 1e-3), 0) ** k
        w = np.where(V, w, 0).astype(np.float32)
        s = w > 1e-30
        if s.any():
            col = sample_node(nd, pyrs[i], d[s], texel_m * np.sqrt(np.maximum(cos[s], 0.05)) / (r[s] * DELTA))
            acc[s] += w[s, None] * col * gains[i][None, :]
            wsum[s] += w[s]
        better = w > best_w
        best_w = np.where(better, w, best_w)
        best_i = np.where(better, i, best_i).astype(np.int8)
        best_fp = np.where(better, r * DELTA / np.maximum(cos, 0.05), best_fp)
    has = wsum > 1e-30
    col = np.zeros((M, 3), np.float32)
    col[has] = acc[has] / wsum[has, None]
    cls = np.where(~has, 4, np.where(best_fp <= 0.12, 1, np.where(best_fp <= 0.35, 2, 3))).astype(np.uint8)
    return col, has, cls, best_i, best_fp


def composite_group(g, cache, out, nodes, pyrs, gains, meta, args):
    pos = np.load(f"{cache}/{g}_pos.npy", mmap_mode="r")
    nrm = np.load(f"{cache}/{g}_nrm.npy", mmap_mode="r")
    valid = np.load(f"{cache}/{g}_valid.npy")
    vis = [np.load(f"{cache}/{g}_vis_{nd['id']}.npy", mmap_mode="r") for nd in nodes]
    ortho = np.load(f"{cache}/{g}_ortho.npy", mmap_mode="r") if g.startswith("ground") else None
    N = valid.shape[0]
    texel_m = meta[g]["texel_m"]
    skin = np.zeros((N, N, 3), np.uint8)
    cov = np.zeros((N, N, 3), np.uint8)
    src = np.zeros((N, N, 3), np.uint8)
    clay = np.array(CLAY[g], np.float32)
    off = 0 if g in ("tower", "apt") else 6          # the unit shell is part of the tower
    counts = np.zeros(6, np.int64)
    t = time.time()
    for r0 in range(0, N, args.chunk):
        r1 = min(N, r0 + args.chunk)
        P = pos[r0:r1].reshape(-1, 3).astype(np.float32)
        Nn = nrm[r0:r1].reshape(-1, 3).astype(np.float32)
        Nn /= np.maximum(np.linalg.norm(Nn, axis=1), 1e-6)[:, None]
        V = valid[r0:r1].reshape(-1)
        vr = [v[r0:r1].reshape(-1).astype(np.float32) for v in vis]
        col, has, cls, bi, bfp = blend(P, Nn, V, nodes, pyrs, gains, texel_m, args.k, vr)
        if g.startswith("ground"):
            oc = S2L[np.asarray(ortho[r0:r1]).reshape(-1, 3)]
            R_, _, fe = GROUNDS[g]
            edge = np.minimum.reduce([P[:, 0] - (TOWER_C[0] - R_), (TOWER_C[0] + R_) - P[:, 0],
                                      P[:, 1] - (TOWER_C[1] - R_), (TOWER_C[1] + R_) - P[:, 1]])
            f = (np.clip(edge / fe, 0, 1) if fe > 0 else np.ones_like(edge))[:, None] * has[:, None]
            col = col * f + oc * (1 - f)
        else:
            col[~has] = clay
        cls = np.where(V, cls, 5)       # texels the bake never wrote (faces too small/thin for the atlas) = unbaked
        counts += np.bincount(np.where(V, cls, 0), minlength=6)[:6]
        h = r1 - r0
        skin[r0:r1] = lin2u8(col).reshape(h, N, 3)
        c = np.zeros((len(cls), 3), np.uint8)
        c[:, 0] = (cls + off) * 20
        c[:, 1] = np.clip(bfp * 50.0, 0, 255).astype(np.uint8)          # footprint, 2 cm steps
        c[:, 2] = np.where(bi >= 0, bi + 1, 0) * 50
        cov[r0:r1] = c.reshape(h, N, 3)
        sc = np.zeros((len(cls), 3), np.uint8)
        for i, nd in enumerate(nodes):
            sc[bi == i] = NODE_RGB[nd["id"]]
        sc[(cls == 4)] = (200, 30, 30)
        src[r0:r1] = sc.reshape(h, N, 3)
    tv = max(int(counts[1:].sum()), 1)
    meta[g]["classes_share"] = {"sharp": round(counts[1] / tv, 4), "soft": round(counts[2] / tv, 4), "smeared": round(counts[3] / tv, 4), "hole": round(counts[4] / tv, 4)}
    meta[g]["composite_s"] = round(time.time() - t, 1)
    # dilate the skin a few texels into empty UV space (mip/bilinear bleed guard)
    for _ in range(4):
        empty = ~valid
        if not empty.any():
            break
        sh = [np.roll(skin, s, axis=a) for a in (0, 1) for s in (1, -1)]
        vh = [np.roll(valid, s, axis=a) for a in (0, 1) for s in (1, -1)]
        for s_img, s_v in zip(sh, vh):
            take = empty & s_v
            skin[take] = s_img[take]
            valid = valid | take
            empty = ~valid
    write_png(f"{out}/{g}.png", skin[::-1])
    write_png(f"{out}/{g}_cov.png", cov[::-1])
    write_png(f"{out}/{g}_src.png", src[::-1])
    log("composite", g, meta[g]["classes_share"], meta[g]["composite_s"], "s")


def composite_detail(cache, nodes, pyrs, gains, meta, args):
    out = {}
    tot = np.zeros(6, np.int64)
    for k in DETAIL_OBJS:
        ob = bpy.data.objects["BK_detail_" + k]
        me = ob.data
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        nr = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("normal", nr); nr = nr.reshape(-1, 3)
        vis = np.load(f"{cache}/detail_{k}_vis.npy").astype(np.float32)
        col, has, cls, bi, bfp = blend(co, nr, np.ones(len(co), bool), nodes, pyrs, gains, 0.15, args.k, list(vis))
        fill = np.median(col[has], axis=0) if has.any() else np.array(CLAY["tower_detail"], np.float32)
        col[~has] = fill
        tot += np.bincount(cls, minlength=6)[:6]
        for name in ("skin", "cov"):
            if name in me.color_attributes:
                me.color_attributes.remove(me.color_attributes[name])
        a = me.color_attributes.new("skin", "FLOAT_COLOR", "POINT")
        a.data.foreach_set("color", np.concatenate([col, np.ones((len(col), 1), np.float32)], 1).ravel())
        c = np.zeros((len(cls), 4), np.float32)
        c[:, 0] = cls * 20 / 255.0
        c[:, 1] = np.clip(bfp * 50.0, 0, 255).astype(np.uint8) / 255.0
        c[:, 2] = np.where(bi >= 0, bi + 1, 0) * 50 / 255.0
        c[:, 3] = 1
        b = me.color_attributes.new("cov", "FLOAT_COLOR", "POINT")
        b.data.foreach_set("color", c.ravel())
        me.color_attributes.active_color = a
    tv = max(int(tot[1:].sum()), 1)
    meta["tower_detail"]["classes_share"] = {"sharp": round(tot[1] / tv, 4), "soft": round(tot[2] / tv, 4), "smeared": round(tot[3] / tv, 4), "hole": round(tot[4] / tv, 4)}
    log("detail composite", meta["tower_detail"]["classes_share"])


# ------------------------------------------------------------------ render materials + save
def emission_mat(name, build):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    nt.links.new(build(nt), em.inputs["Color"])
    return mat


def finalize(out, meta, nodes):
    def tex(path, uv="bake"):
        def b(nt):
            t = nt.nodes.new("ShaderNodeTexImage")
            t.image = bpy.data.images.load(path, check_existing=True)
            t.interpolation = "Linear"
            u = nt.nodes.new("ShaderNodeUVMap")
            u.uv_map = uv
            nt.links.new(u.outputs["UV"], t.inputs["Vector"])
            return t.outputs["Color"]
        return b
    for g in ATLAS:
        ob = bpy.data.objects["BK_" + g]
        ob.data.materials.clear()
        ob.data.materials.append(emission_mat("R_" + g, tex(f"{out}/{g}.png")))
        ob["skin_png"] = f"{out}/{g}.png"
        ob["cov_png"] = f"{out}/{g}_cov.png"
        ob["group"] = g
    def attr(nt):
        a = nt.nodes.new("ShaderNodeVertexColor")
        a.layer_name = "skin"
        return a.outputs["Color"]
    dm = emission_mat("R_tower_detail", attr)
    for k in DETAIL_OBJS:
        ob = bpy.data.objects["BK_detail_" + k]
        ob.data.materials.clear()
        ob.data.materials.append(dm)
        ob["group"] = "tower_detail"
    hid = bpy.data.objects["BK_tower_hidden"]
    hid.data.materials.clear()
    def grey(nt):
        r = nt.nodes.new("ShaderNodeRGB")
        r.outputs[0].default_value = (*CLAY["tower"], 1)
        return r.outputs[0]
    hid.data.materials.append(emission_mat("R_tower_hidden", grey))
    hid["group"] = "tower_hidden"
    orth = bpy.data.objects["STUDIO_ortho"]
    oimg = bpy.data.images["orthophoto"]
    def ortho(nt):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = oimg
        return t.outputs["Color"]
    orth.data.materials.clear()
    orth.data.materials.append(emission_mat("R_ortho", ortho))
    orth["group"] = "ortho"
    # world = node-a sky (equirect centre faces node-a's centre direction; Blender's u 0.5 faces +X)
    a = [nd for nd in nodes if nd["id"] == "node-a-aerial"][0]
    w = bpy.context.scene.world
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(a["skin"], check_existing=True)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.vector_type = "VECTOR"
    mp.inputs["Rotation"].default_value = (0, 0, -math.atan2(a["c"][1], a["c"][0]))
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs[0], o.inputs["Surface"])
    sc = bpy.context.scene
    sc["nodes"] = json.dumps([{"id": nd["id"], "O": nd["O"].tolist(), "c": nd["c"].tolist(), "skin": nd["skin"]} for nd in nodes])
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    for m in list(bpy.data.materials):
        if m.users == 0:
            bpy.data.materials.remove(m)
    bpy.ops.wm.save_as_mainfile(filepath=f"{out}/baked.blend")
    log("saved", f"{out}/baked.blend")


# ------------------------------------------------------------------ main
def main():
    args = get_args()
    out = args.out.replace("\\", "/")
    cache = out + "/_cache"
    os.makedirs(cache, exist_ok=True)
    T0 = time.time()
    meta_path = f"{out}/bake_meta.json"
    nodes = node_frames()
    for nd in nodes:
        log(nd["id"], nd["O"].round(2).tolist(), "yaw", nd["yaw_deg"], os.path.basename(nd["skin"]))
    if args.skip_bake or args.from_prep:
        bpy.ops.wm.open_mainfile(filepath=cache + "/prep.blend")
        meta = json.load(open(meta_path, encoding="utf8")) if os.path.exists(meta_path) else {}
        added = False
        for gname in GROUNDS:
            if "BK_" + gname not in bpy.data.objects:
                g = make_ground(gname)
                meta[gname] = dict(uv_stats(g, args.other_res), res=args.other_res, unwrap_s=0, patch_m=2 * GROUNDS[gname][0])
                added = True
        if added:
            bpy.ops.wm.save_as_mainfile(filepath=cache + "/prep.blend")
    else:
        meta = prep(args, cache)
    meta["args"] = vars(args)
    meta["nodes"] = [{"id": nd["id"], "pos": nd["O"].tolist(), "yaw_deg": nd["yaw_deg"], "skin": nd["skin"]} for nd in nodes]
    if not args.skip_bake:
        t = time.time()
        bake_all(args, cache, meta, nodes)
        detail_vis(args, cache, meta, nodes)
        meta["bake_total_s"] = round(time.time() - t, 1)
    json.dump(meta, open(meta_path, "w", encoding="utf8"), indent=1)
    t = time.time()
    # one K for all: the light is the same, so the calibrations must agree; per-group K is used when it has samples
    Ks = []
    for g in ATLAS:
        raw = np.load(f"{cache}/{g}_raw_{REF_NODE}.npy", mmap_mode="r")
        K, n = calibrate(raw, np.load(f"{cache}/{g}_pos.npy", mmap_mode="r"), np.load(f"{cache}/{g}_nrm.npy", mmap_mode="r"),
                         np.load(f"{cache}/{g}_valid.npy"), [nd for nd in nodes if nd["id"] == REF_NODE][0]["O"])
        if K:
            Ks.append(K)
    Kglob = float(np.median(Ks))
    meta["K_global"] = round(Kglob, 2)
    gmaps = None
    if args.edge_guard > 0:
        node_depths(cache, nodes)
        gmaps = guard_maps(cache, nodes, args.edge_guard)
    meta["edge_guard_px"] = args.edge_guard
    for g in ATLAS:
        visibility(g, cache, nodes, Kglob, meta, gmaps)
    pyrs = []
    for nd in nodes:
        pyrs.append(load_pano(nd["skin"]))
    gains = [np.ones(3, np.float32) for _ in nodes]
    if not args.no_gain:
        acc = {}
        for g in ("tower", "ground", "podium"):
            gain_stats(g, cache, nodes, pyrs, meta[g]["texel_m"], acc)
        meta["gains"] = {}
        for i, nd in enumerate(nodes):
            if nd["id"] in acc:
                ci = np.concatenate(acc[nd["id"]][0]); cr = np.concatenate(acc[nd["id"]][1])
                gch = np.clip(np.median(cr, axis=0) / np.maximum(np.median(ci, axis=0), 1e-4), *GAIN_CLIP).astype(np.float32)
                gains[i] = gch
                meta["gains"][nd["id"]] = {"gain_rgb": gch.round(3).tolist(), "overlap_samples": int(len(ci)),
                                           "raw_ratio_rgb": (np.median(cr, axis=0) / np.maximum(np.median(ci, axis=0), 1e-4)).round(3).tolist()}
        log("gains", json.dumps(meta["gains"]))
    for g in ATLAS:
        composite_group(g, cache, out, nodes, pyrs, gains, meta, args)
    composite_detail(cache, nodes, pyrs, gains, meta, args)
    meta["composite_total_s"] = round(time.time() - t, 1)
    finalize(out, meta, nodes)
    meta["total_s"] = round(time.time() - T0, 1)
    json.dump(meta, open(meta_path, "w", encoding="utf8"), indent=1)
    log("done", meta["total_s"], "s")


main()

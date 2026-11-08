"""export_glb.py - hand-off of the baked site to a real-time viewer (habait-89's three.js flyover on :8899). No rendering.

  "$BLENDER" -b "$F/renders/baked/baked.blend" -P "$F/export_glb.py" -- --out "$F/renders/baked/site_baked.glb"

Opens bake_skins.py's baked.blend and writes ONE glb: every baked mesh with an UNLIT material (KHR_materials_unlit: the
texture or the vertex colour goes straight to the material output, the skins already carry the light), textures embedded as
JPEG q90 (the PNG masters stay in renders/baked/). Frame: glTF Y-up, x = X, y = Z, z = -Y of plan-world (the same as site.glb
and nodes.json pos_glb). WebGL fixes vs the .blend: BK_ground_far becomes a square ring around BK_ground (no coplanar
overlap) and the raw orthophoto quad is lowered 2 m under the baked ground (exported as BK_ortho_raw). BK_tower_hidden (glass
caps inside the slabs, never visible) is left out.
"""
import bpy, bmesh, sys, os, json, math

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[argv.index("--out") + 1] if "--out" in argv else os.path.join(os.path.dirname(bpy.data.filepath), "site_baked.glb")
TOWER_C = (-5.9, -13.0)
NEAR_R, FAR_R = 220.0, 2000.0


def unlit(name, color_socket_builder):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(color_socket_builder(nt), o.inputs["Surface"])
    return m


def tex_builder(img, uv="bake"):
    def b(nt):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = img
        u = nt.nodes.new("ShaderNodeUVMap")
        u.uv_map = uv
        nt.links.new(u.outputs["UV"], t.inputs["Vector"])
        return t.outputs["Color"]
    return b


def ring_far(ob):
    """replace the far quad by 4 quads around the near patch, planar UVs of the original +/-FAR_R square"""
    z = ob.data.vertices[0].co.z
    x0, y0 = TOWER_C
    R, r = FAR_R, NEAR_R
    xs = [x0 - R, x0 - r, x0 + r, x0 + R]
    ys = [y0 - R, y0 - r, y0 + r, y0 + R]
    verts, faces = [], []
    idx = {}
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            idx[(i, j)] = len(verts)
            verts.append((x, y, z))
    for i in range(3):
        for j in range(3):
            if i == 1 and j == 1:
                continue
            faces.append((idx[(i, j)], idx[(i + 1, j)], idx[(i + 1, j + 1)], idx[(i, j + 1)]))
    me = bpy.data.meshes.new("BK_ground_far")
    me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(name="bake")
    for li, l in enumerate(me.loops):
        v = me.vertices[l.vertex_index].co
        uvl.data[li].uv = ((v.x - (x0 - R)) / (2 * R), (v.y - (y0 - R)) / (2 * R))
    old = ob.data
    ob.data = me
    bpy.data.meshes.remove(old)


def main():
    keep = []
    for ob in list(bpy.data.objects):
        if ob.type != "MESH":
            continue
        g = ob.get("group", "")
        if ob.name == "BK_tower_hidden":
            bpy.data.objects.remove(ob)
            continue
        if ob.name == "STUDIO_ortho":
            ob.name = "BK_ortho_raw"
            ob.location.z -= 2.0
            img = bpy.data.images["orthophoto"]
            ob.data.materials.clear()
            ob.data.materials.append(unlit("U_ortho_raw", tex_builder(img, ob.data.uv_layers.active.name)))
            keep.append(ob)
            continue
        if ob.name == "BK_ground_far":
            ring_far(ob)
        me = ob.data
        if "skin_png" in ob:
            # drop the helper UV layer of the ground (ortho) so TEXCOORD_0 is the bake atlas
            for uvn in [u.name for u in me.uv_layers if u.name != "bake"]:
                me.uv_layers.remove(me.uv_layers[uvn])
            me.uv_layers.active = me.uv_layers["bake"]
            img = bpy.data.images.load(ob["skin_png"], check_existing=True)
            me.materials.clear()
            me.materials.append(unlit("U_" + ob.name, tex_builder(img)))
        elif g == "tower_detail":
            def vc(nt):
                a = nt.nodes.new("ShaderNodeVertexColor")
                a.layer_name = "skin"
                return a.outputs["Color"]
            me.color_attributes.active_color = me.color_attributes["skin"]
            me.materials.clear()
            me.materials.append(unlit("U_" + ob.name, vc))
        else:
            continue
        keep.append(ob)
    bpy.ops.object.select_all(action="DESELECT")
    for ob in keep:
        ob.select_set(True)
    kw = dict(filepath=OUT, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
              export_image_format="JPEG", export_jpeg_quality=90, export_materials="EXPORT", export_texcoords=True,
              export_normals=False, export_cameras=False, export_lights=False)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color="MATERIAL", export_all_vertex_colors=True)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    info = {"glb": OUT, "bytes": os.path.getsize(OUT), "meshes": {}}
    for ob in keep:
        me = ob.data
        me.calc_loop_triangles()
        info["meshes"][ob.name] = {"tris": len(me.loop_triangles), "verts": len(me.vertices), "uv": [u.name for u in me.uv_layers],
                                   "color_attributes": [c.name for c in me.color_attributes], "texture": ob.get("skin_png", ""),
                                   "coverage": ob.get("cov_png", "")}
    json.dump(info, open(os.path.splitext(OUT)[0] + ".json", "w", encoding="utf8"), indent=1)
    print("[export]", OUT, info["bytes"] // 1048576, "MB", len(keep), "meshes")


main()

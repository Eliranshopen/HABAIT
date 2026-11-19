"""The $0 look upgrade shared by proof_upgrade.py and build_v2.py (Eliran 2026-11-17: «כרגע זה נראה מאוד מאוד זול»).
Box-projected Poly Haven PBR in object space (no UV dependence), tinted to the developer's renders; bevelled box edges."""
import math
import os

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEX = os.path.join(ROOT, "assets", "polyhaven", "textures")


def img(nt, tex, kind, noncolor):
    p = None
    for ext in ("jpg", "png"):
        q = os.path.join(TEX, tex, f"{tex}_{kind}.{ext}")
        if os.path.exists(q):
            p = q
    if not p:
        return None
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = bpy.data.images.load(p, check_existing=True)
    n.image.colorspace_settings.name = "Non-Color" if noncolor else "sRGB"
    n.projection = "BOX"
    n.projection_blend = 0.25
    return n


def remat(name, tex, tint, scale_m, rough=None, rough_mul=1.0, bump=0.3, gray=True, gain=1.6,
          coat=0.0, sheen=0.0, spec=0.5, rot=0.0, contrast=1.0, mean=0.0):
    """rebuild material `name` in place: box-projected PBR texture in object space, tinted, with bump"""
    m = bpy.data.materials.get(name)
    if not m:
        print("PROOF no material", name)
        return
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / scale_m,) * 3
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(rot))
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    col = img(nt, tex, "Diffuse", False)
    nt.links.new(mp.outputs["Vector"], col.inputs["Vector"])
    if gray:
        bw = nt.nodes.new("ShaderNodeRGBToBW")
        nt.links.new(col.outputs["Color"], bw.inputs["Color"])
        src_v = bw.outputs["Val"]
        if contrast != 1.0:  # v = mean + (bw - mean) * contrast: a calmer surface (trowelled plaster, not blotches)
            ma = nt.nodes.new("ShaderNodeMath")
            ma.operation = "MULTIPLY_ADD"
            ma.inputs[1].default_value = contrast
            ma.inputs[2].default_value = mean * (1 - contrast)
            nt.links.new(bw.outputs["Val"], ma.inputs[0])
            src_v = ma.outputs["Value"]
        g = nt.nodes.new("ShaderNodeMath")
        g.operation = "MULTIPLY"
        g.use_clamp = False
        g.inputs[1].default_value = gain
        nt.links.new(src_v, g.inputs[0])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["A"].default_value = (*tint, 1)
        nt.links.new(g.outputs["Value"], mix.inputs["B"])
        nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    else:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["B"].default_value = (*tint, 1)
        nt.links.new(col.outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    if rough is not None:
        b.inputs["Roughness"].default_value = rough
    else:
        r = img(nt, tex, "Rough", True)
        nt.links.new(mp.outputs["Vector"], r.inputs["Vector"])
        rm = nt.nodes.new("ShaderNodeMath")
        rm.operation = "MULTIPLY"
        rm.use_clamp = True
        rm.inputs[1].default_value = rough_mul
        nt.links.new(r.outputs["Color"], rm.inputs[0])
        nt.links.new(rm.outputs["Value"], b.inputs["Roughness"])
    h = img(nt, tex, "Displacement", True) or img(nt, tex, "Rough", True)
    nt.links.new(mp.outputs["Vector"], h.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    bp.inputs["Distance"].default_value = 0.002
    nt.links.new(h.outputs["Color"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.25
    b.inputs["Sheen Weight"].default_value = sheen
    b.inputs["Sheen Roughness"].default_value = 0.6
    print("PROOF remat", name, tex)


def bevel_all(prefixes=("L_", "D_", "K_", "B_", "S_", "T_")):
    n = 0
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.name.startswith(prefixes):
            continue
        if any(md.type == "BEVEL" for md in o.modifiers):
            continue
        if len(o.data.vertices) > 64:  # already rounded pieces (pillows, sofa, lathes) keep their shape
            continue
        dims = sorted(o.dimensions)
        w = min(0.004, dims[0] * 0.3) if dims[0] > 0 else 0.002
        md = o.modifiers.new("proof_bevel", "BEVEL")
        md.width = w
        md.segments = 3
        md.limit_method = "ANGLE"
        md.harden_normals = True
        for p in o.data.polygons:
            p.use_smooth = True
        n += 1
    print("PROOF bevelled", n)



def apply_upgrade(scene, exposure=-0.1):
    """the $0 look upgrade: limewash plaster walls, real-scale oak, linen and boucle with sheen, bevelled edges, warm light"""
    # walls: greige limewash with a real trowelled-plaster surface (render 0060000)
    # gains = 1 / the texture's mean linear brightness, so the tint IS the albedo (linear), read off the developer's renders
    remat("wall_limewash_greige", "painted_plaster_wall", (0.60, 0.55, 0.47), 2.4, rough_mul=1.15, bump=0.3, gain=2.6, contrast=0.35, mean=0.38)
    remat("ceiling_white", "painted_plaster_wall", (0.70, 0.67, 0.62), 2.4, rough=0.95, bump=0.12, gain=2.6, contrast=0.25, mean=0.38)
    remat("oak_warm", "oak_veneer_01", (0.27, 0.13, 0.06), 0.55, rough_mul=0.8, bump=0.08, gain=4.0, coat=0.12, rot=90)
    remat("oak_light", "oak_veneer_01", (0.55, 0.33, 0.16), 0.55, rough_mul=0.8, bump=0.08, gain=4.0, coat=0.10, rot=90)
    remat("sofa_linen", "rough_linen", (0.56, 0.52, 0.46), 0.18, rough=0.92, bump=0.25, gain=2.5, sheen=0.7, spec=0.3)
    remat("rug_wool", "wool_boucle", (0.60, 0.55, 0.47), 0.25, rough=0.95, bump=0.4, gain=5.0, sheen=0.5, spec=0.2)
    remat("boucle_cream", "wool_boucle", (0.75, 0.70, 0.62), 0.12, rough=0.95, bump=0.4, gain=5.0, sheen=0.6, spec=0.2)
    bevel_all()
    # light: the developer's renders are soft, warm and low-contrast-high-depth
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = exposure
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.data.type in ("POINT", "SPOT", "AREA"):
            o.data.color = (1.0, 0.86, 0.70)


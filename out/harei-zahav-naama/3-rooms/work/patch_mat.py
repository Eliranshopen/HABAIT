p = "scripts/blender/hz_lib.py"
s = open(p, encoding="utf-8").read()
s = s.replace('def pbr(name, tex_id, scale=1.0, tint=None, rough_mul=1.0, bump=1.0, rot_deg=0.0, **kw):',
              'def pbr(name, tex_id, scale=1.0, tint=None, rough_mul=1.0, bump=1.0, rot_deg=0.0, gray=False, gain=2.0, **kw):')
old = '''    if tint:
        mix = nt.nodes.new("ShaderNodeMix")'''
new = '''    if gray:  # keep only the texture's light and shade; the colour comes from `tint`
        bw = nt.nodes.new("ShaderNodeRGBToBW")
        nt.links.new(col.outputs["Color"], bw.inputs["Color"])
        g = nt.nodes.new("ShaderNodeMath")
        g.operation = "MULTIPLY"
        g.use_clamp = True
        g.inputs[1].default_value = gain
        nt.links.new(bw.outputs["Val"], g.inputs[0])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["A"].default_value = (*(tint or (0.8, 0.8, 0.8)), 1)
        nt.links.new(g.outputs["Value"], mix.inputs["B"])
        nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    elif tint:
        mix = nt.nodes.new("ShaderNodeMix")'''
assert old in s
s = s.replace(old, new, 1)
open(p, "w", encoding="utf-8", newline="\n").write(s)
p = "scripts/blender/hz_furniture.py"
s = open(p, encoding="utf-8").read()
for nm in ("sofa_linen", "boucle_cream", "rug_wool", "bedding_white", "bedding_sage", "pillow_terracotta", "pillow_olive"):
    i = s.index(f'L.pbr("{nm}"'); j = s.index(")", s.index("bump=", i))
    s = s[:j] + ", gray=True" + s[j:]
s = s.replace('model("pachira_aquatica_01", "L_plant_tall", a[0] - 48, N - 2, 0, c=C_DECO, fit=(None, None, 165))',
              'model("potted_plant_02", "L_plant_tall", a[0] - 40, N + 30, 0, c=C_DECO, fit=(None, None, 120))')
open(p, "w", encoding="utf-8", newline="\n").write(s)
print("ok")

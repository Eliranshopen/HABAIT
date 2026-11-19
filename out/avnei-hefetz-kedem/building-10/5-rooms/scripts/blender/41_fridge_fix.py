# Eliran 2026-11-19: the sales plan has a refrigerator at k-fridge (x 1.70-2.70, y 6.02-6.83, front N); the stone column + TV
# (taken from his picture) is replaced: a tall white unit, a stainless double-door fridge in its north face, a cabinet above.
import bpy, bmesh, sys
from mathutils import Vector
out = sys.argv[sys.argv.index('--') + 1]
X0, X1, Y0, Y1, H = 1.70, 2.70, 6.02, 6.83, 2.60
st = bpy.data.objects['BAKE_stone_21']; bpy.data.objects.remove(st, do_unlink=True)
bg = bpy.data.objects['BAKE_black_glass_19']; me = bg.data; bm = bmesh.new(); bm.from_mesh(me)
kill = [v for v in bm.verts if (lambda w: 2.69 <= w.x <= 2.76 and Y0 <= w.y <= Y1 and w.z > 0.95)(bg.matrix_world @ v.co)]
print('TV verts', len(kill)); bmesh.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(me); bm.free()
def mat(name, col, metal, rough):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough; return m
WHITE = bpy.data.materials.get('front'); GAP = bpy.data.materials.get('gap'); HANDLE = bpy.data.materials.get('blackmetal.005')
STEEL = mat('fridge_steel', (0.62, 0.62, 0.61), 1.0, 0.32)
def box(name, a, b, m):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); r = bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector(((a[0] + b[0]) / 2 + v.co.x * (b[0] - a[0]), (a[1] + b[1]) / 2 + v.co.y * (b[1] - a[1]), (a[2] + b[2]) / 2 + v.co.z * (b[2] - a[2])))
    bm.to_mesh(me); bm.free(); me.materials.append(m); o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o
box('FRIDGE_carcass', (X0, Y0, 0), (X1, Y1 - 0.02, H - 0.005), WHITE)                  # tall white unit, plain sides (the side toward the living room is a white panel)
FT = 1.90; xa, xb = X0 + 0.05, X1 - 0.05; mid = (xa + xb) / 2
box('FRIDGE_door_L', (xa, Y1 - 0.02, 0.06), (mid - 0.004, Y1 + 0.01, FT), STEEL)     # two stainless doors, 4 mm gap
box('FRIDGE_door_R', (mid + 0.004, Y1 - 0.02, 0.06), (xb, Y1 + 0.01, FT), STEEL)
box('FRIDGE_gap', (mid - 0.004, Y1 - 0.02, 0.06), (mid + 0.004, Y1 + 0.005, FT), GAP)
for x in (mid - 0.05, mid + 0.04): box('FRIDGE_handle', (x, Y1 + 0.01, 0.85), (x + 0.012, Y1 + 0.035, 1.55), HANDLE)
box('FRIDGE_top_cab', (xa, Y1 - 0.02, FT + 0.02), (xb, Y1 + 0.005, H - 0.02), WHITE)  # cabinet above the fridge
box('FRIDGE_top_gap', (xa, Y1 - 0.02, FT), (xb, Y1 + 0.004, FT + 0.02), GAP)
bpy.ops.wm.save_as_mainfile(filepath=out); print('FRIDGE_OK', out)

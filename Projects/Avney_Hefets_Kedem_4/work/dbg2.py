import bpy
from mathutils import Vector
sc = bpy.context.scene
dg = bpy.context.evaluated_depsgraph_get()
for name in ('still_mamad', 'still_bath', 'pano_bath'):
    cam = bpy.data.objects[name]
    f = cam.matrix_world.to_3x3() @ Vector((0, 0, -1))
    hit, loc, nrm, idx, ob, m = sc.ray_cast(dg, cam.location, f)
    print('FWD', name, ob.name if ob else None, round((loc - cam.location).length, 3) if hit else None)
for L in ('light_mamad', 'light_bath'):
    o = bpy.data.objects.get(L)
    print('LIGHT', L, o and tuple(round(v, 2) for v in o.location), o and o.data.energy, o and o.hide_render)
sc.render.resolution_x, sc.render.resolution_y = 360, 240
sc.cycles.samples = 8
sc.camera = bpy.data.objects['still_mamad']
sc.render.filepath = r'C:/RnD/.wt/avnei-hefetz-kedem-4/Projects/Avney_Hefets_Kedem_4/work/dbg_mamad.png'
bpy.ops.render.render(write_still=True)

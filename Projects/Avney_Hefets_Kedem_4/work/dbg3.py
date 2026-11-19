import bpy
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 360, 240
sc.cycles.samples = 8
for n in ('mamad', 'bath', 'master'):
    sc.camera = bpy.data.objects['still_' + n]
    sc.render.filepath = r'C:/RnD/.wt/avnei-hefetz-kedem-4/Projects/Avney_Hefets_Kedem_4/work/dbg_%s.png' % n
    bpy.ops.render.render(write_still=True)

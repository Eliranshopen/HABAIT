import bpy, os, sys, math
sys.path.insert(0, os.path.abspath("scripts/blender"))
import hz_lib as L
root = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 560, 700
sc.cycles.samples = 20
VIEWS = {  # name: camera u, v, z, target u, v, z, lens   (like the Corona renders)
 "d_kitchen": (560, 760, 150, 230, 990, 120, 22),     # 1_CShading: from the sofa toward the island and kitchen
 "d_tvwall": (560, 940, 140, 560, 444, 120, 22),      # 0060000: behind the sofa toward the TV wall
 "d_dining": (430, 820, 150, 800, 900, 110, 22),      # 0070000: toward the glazing, shelf on the right
}
for nm, (u, v, z, tu, tv, tz, lens) in VIEWS.items():
    cd = bpy.data.cameras.new(nm); cd.lens = lens; cd.sensor_width = 36; cd.sensor_fit = "VERTICAL"; cd.sensor_height = 30
    ob = bpy.data.objects.new(nm, cd); sc.collection.objects.link(ob)
    ob.location = L.V(u, v, z); d = L.V(tu, tv, tz) - ob.location; ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sc.camera = ob; sc.render.filepath = os.path.join(root, "work", "test", f"{nm}.png")
    bpy.ops.render.render(write_still=True); print("Q", nm)

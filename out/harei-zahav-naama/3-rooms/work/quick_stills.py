import bpy, os, sys
root = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 640, 400
sc.cycles.samples = 16
for o in [o for o in bpy.data.objects if o.name.startswith("still_")]:
    sc.camera = o
    sc.render.filepath = os.path.join(root, "work", "test", f"q_{o.name}.png")
    bpy.ops.render.render(write_still=True)
    print("Q", o.name)

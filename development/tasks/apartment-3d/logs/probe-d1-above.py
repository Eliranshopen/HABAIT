# Read-only (gate 3 D1): every scene object whose world bounding box covers the stripe strip on the entrance floor
# (x 3.0..5.7, y -8.5..-7.9), with its z range, type, classification and render visibility. Never saves.
import bpy, sys, os
sys.path.insert(0, r"C:\RnD\.wt\apartment-3d\files\Projects\Habait\habait-walkaround\360walkaround\pipeline")
import export_dollhouse as ED
from mathutils import Vector
X0, X1, Y0, Y1 = 3.0, 5.7, -8.5, -7.9
for ob in bpy.context.scene.objects:
    if ob.type not in ("MESH", "LIGHT", "CURVE"):
        continue
    bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box] if ob.type != "LIGHT" else [ob.matrix_world.translation]
    xs, ys, zs = [p.x for p in bb], [p.y for p in bb], [p.z for p in bb]
    if max(xs) < X0 or min(xs) > X1 or max(ys) < Y0 or min(ys) > Y1:
        continue
    cat, why = ED.classify_object(ob.name)
    print(f"PROBE {ob.name:40s} {ob.type:6s} z {min(zs):5.2f}..{max(zs):5.2f}  x {min(xs):5.2f}..{max(xs):5.2f} y {min(ys):6.2f}..{max(ys):6.2f}  {cat}/{why}  hide_render={ob.hide_render}")

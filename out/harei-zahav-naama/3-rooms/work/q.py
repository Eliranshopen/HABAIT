import bpy
from mathutils import Vector
for o in bpy.data.objects:
    if o.type=='EMPTY' and o.parent is None:
        u,v = o.location.x*100, -o.location.y*100
        print("ROOT", o.name, round(u), round(v), round(o.location.z*100), [round(s,2) for s in o.scale])

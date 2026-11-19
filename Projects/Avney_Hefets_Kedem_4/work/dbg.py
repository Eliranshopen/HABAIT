import bpy, math
sc = bpy.context.scene
cam = bpy.data.objects['still_mamad']
print('loc', tuple(round(v, 3) for v in cam.location), 'rot', tuple(round(math.degrees(v), 1) for v in cam.rotation_euler), 'lens', cam.data.lens, 'clip', cam.data.clip_start, cam.data.clip_end)
print('front', tuple(round(v, 3) for v in (cam.matrix_world.to_3x3() @ __import__('mathutils').Vector((0, 0, -1)))))

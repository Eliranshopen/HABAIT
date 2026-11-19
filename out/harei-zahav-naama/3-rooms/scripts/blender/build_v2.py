"""scene/hatzav.blend → scene/hatzav_v2.blend: the $0 look upgrade + the AI-made pieces in place of the box-built ones.

Run: blender -b scene/hatzav.blend --factory-startup -P scripts/blender/build_v2.py -- <job_dir> [--yaw id=deg,...]
The source .blend is never overwritten. Prints the PLACE lines (fitted sizes) and V2 OK.
"""
import os
import sys

import bpy

a = sys.argv[sys.argv.index("--") + 1:]
JOB = os.path.abspath(a[0])
sys.path.insert(0, os.path.dirname(__file__))
from upgrade_lib import apply_upgrade  # noqa: E402
import place_items  # noqa: E402

yo = {}
if "--yaw" in a:
    yo = {k: float(v) for k, v in (p.split("=") for p in a[a.index("--yaw") + 1].split(",") if p)}
apply_upgrade(bpy.context.scene)
done = place_items.place(JOB, yaw_override=yo)
out = os.path.join(JOB, "scene", "hatzav_v2.blend")
bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
print("V2 OK", done, out)

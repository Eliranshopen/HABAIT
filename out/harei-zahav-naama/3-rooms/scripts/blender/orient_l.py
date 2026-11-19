"""Find the yaw that sets an L-shaped piece square to the axes with its corner at a chosen side (the corner sofa, 2026-11-18).

Run: blender -b --factory-startup -P scripts/blender/orient_l.py -- <glb> [--corner NE]
1. the yaw (0..89, 0.5 deg steps) whose footprint bounding box is smallest = the L's arms along the axes;
2. then the quarter turn that puts the EMPTY quadrant (the inside of the L) opposite the wanted corner.
Blender frame: north = +Y, east = +X. Prints ORIENT {"yaw": deg, ...}; the yaw is what place_items' P(yaw=...) takes.
"""
import json
import math
import sys

import bpy
import numpy as np

a = sys.argv[sys.argv.index("--") + 1:]
GLB = a[0]
corner = a[a.index("--corner") + 1] if "--corner" in a else "NE"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
pts = []
for o in bpy.context.scene.objects:
    if o.type == "MESH":
        m = np.array([list(o.matrix_world @ v.co) for v in o.data.vertices])
        pts.append(m[:, :2])
P = np.concatenate(pts)
P = P - P.mean(0)
best = None
for yaw in np.arange(0, 90, 0.5):
    t = math.radians(yaw)
    R = np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]])
    Q = P @ R.T
    area = np.ptp(Q[:, 0]) * np.ptp(Q[:, 1])
    if best is None or area < best[0]:
        best = (area, yaw)
yaw0 = best[1]
want_empty = {"NE": (-1, -1), "NW": (1, -1), "SE": (-1, 1), "SW": (1, 1)}[corner]   # the inside of the L sits opposite the corner
res = None
for q in range(4):
    yaw = yaw0 + 90 * q
    t = math.radians(yaw)
    R = np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]])
    Q = P @ R.T
    cx, cy = (Q[:, 0].min() + Q[:, 0].max()) / 2, (Q[:, 1].min() + Q[:, 1].max()) / 2
    counts = {}
    for sx in (-1, 1):
        for sy in (-1, 1):
            counts[(sx, sy)] = int((((Q[:, 0] - cx) * sx > 0) & ((Q[:, 1] - cy) * sy > 0)).sum())
    empty = min(counts, key=counts.get)
    if empty == want_empty:
        res = {"yaw": round(float(yaw % 360), 1), "axis_yaw": float(yaw0), "quadrants": {str(k): v for k, v in counts.items()},
               "size_m": [round(float(np.ptp(Q[:, 0])), 3), round(float(np.ptp(Q[:, 1])), 3)]}
print("ORIENT", json.dumps(res))

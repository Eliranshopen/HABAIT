"""make_nodes.py - the extra exterior 360 nodes for full-orbit bake coverage (lane C, 2026-11-02, REPORT.md "המלצה" item 2).

  python -X utf8 -I make_nodes.py      -> nodes-extra.json (ids, positions, bearings) + shots.extra.json (render_shots.py input)

Frame: plan-world metres, X right, Y up the plan, Z up, unit floor 16 = z 0, ground -51.2. Bearings are plan bearings,
clockwise from +Y (atan2(dx, dy)), the convention of REPORT.md and bake_skins.py.

Ring B: 7 new nodes at node-b-tower's radius and height, every 45 deg starting 45 deg from node-b (node-b's own slot skipped).
  The ring is centred on the TOWER centroid (-5.9, -13.0) = bake_skins.py / render_check.py TOWER_C (footprint centroid
  (-5.85, -12.50) from derived/tower-footprint.json), not on (6.487, -8.2045): that point is shots.pano-nodes.json
  "unit_centre_m", the centre of apartment 846, 13 m east of the tower axis. Centred on the tower, node-b sits on the ring
  (r 81.9 m) and every ring-B node is on render_check.py's orbB coverage ring (node-b rotated about TOWER_C).
Ring A: the two slots +120 / +240 deg from node-a on node-a's ring are ALREADY skinned: node-o2-orbit and node-o4-orbit
  (habait-16, 2026-11-02 12:15-12:21, GPT Image 2.5, apt846 ledger), part of a 6-node ring (node-a + o1..o5, 60 deg steps,
  r 228 m about the unit centre, z 90). They are reused, not re-bought; recorded here with status "existing".
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
TOWER_C = (-5.9, -13.0)
UNIT_C = (6.487, -8.2045)
NODE_B = (68.4477, -47.2597, 17.7875)
NODE_A = (196.3212, -134.5492, 90.0)
STUDIO = "C:/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv"


def bearing(p, c):
    return math.degrees(math.atan2(p[0] - c[0], p[1] - c[1])) % 360


def at(c, r, brg, z):
    return [round(c[0] + r * math.sin(math.radians(brg)), 4), round(c[1] + r * math.cos(math.radians(brg)), 4), z]


rb = math.hypot(NODE_B[0] - TOWER_C[0], NODE_B[1] - TOWER_C[1])
bb = bearing(NODE_B, TOWER_C)
nodes = []
for k in range(1, 8):
    off = 45 * k
    brg = (bb + off) % 360
    nodes.append({"id": f"node-rb{off:03d}", "ring": "B", "status": "new", "pos": at(TOWER_C, rb, brg, NODE_B[2]),
                  "look": [TOWER_C[0], TOWER_C[1], 14.0], "bearing_deg": round(brg, 2), "offset_from_node_b_deg": off,
                  "radius_m": round(rb, 2), "centre": list(TOWER_C)})
ra = math.hypot(NODE_A[0] - UNIT_C[0], NODE_A[1] - UNIT_C[1])
ba = bearing(NODE_A, UNIT_C)
for off, existing in ((120, "node-o2-orbit"), (240, "node-o4-orbit")):
    brg = (ba + off) % 360
    f = json.load(open(f"{STUDIO}/renders/clay-nodes-ortho/{existing}/faces.json", encoding="utf8"))
    nodes.append({"id": existing, "ring": "A", "status": "existing", "pos": f["pos"], "look": f["centre_look"],
                  "bearing_deg": round(bearing(f["pos"], UNIT_C), 2), "offset_from_node_a_deg": off,
                  "radius_m": round(math.hypot(f["pos"][0] - UNIT_C[0], f["pos"][1] - UNIT_C[1]), 2), "centre": list(UNIT_C),
                  "requested": {"pos": at(UNIT_C, 240.0, brg, 90.0), "radius_m": 240.0, "bearing_deg": round(brg, 2)},
                  "note": "slot already skinned (12 m inside the requested 240 m radius): reused at $0"})
out = {"schema": "habait-flyover/nodes-extra.v1", "frame": "plan-world m, X right, Y up-plan, Z up, floor 16 = z 0, ground -51.2",
       "bearing": "plan bearing, clockwise from +Y, from the ring centre", "node_b": {"pos": list(NODE_B), "bearing_deg": round(bb, 2), "radius_m": round(rb, 2), "centre": list(TOWER_C)},
       "node_a": {"pos": list(NODE_A), "bearing_deg": round(ba, 2), "radius_m": round(ra, 2), "centre": list(UNIT_C)}, "nodes": nodes}
json.dump(out, open(f"{HERE}/nodes-extra.json", "w", encoding="utf8"), indent=1)

src = json.load(open(f"{STUDIO}/derived/shots.pano-nodes.json", encoding="utf8"))
b = [s for s in src["shots"] if s["id"] == "node-b-tower"][0]
shots = [{"id": n["id"], "kind": "pano", "pos": n["pos"], "look": n["look"], "face_res": b["face_res"], "far": b["far"]}
         for n in nodes if n["status"] == "new"]
# control: node-b again under another id; its equirect must match studio clay-pano-ortho/node-b-tower.png (same scene check)
shots.append(dict(b, id="node-b-control"))
json.dump({"schema": src["schema"], "fps": src["fps"], "apartment_id": src["apartment_id"],
           "note": "lane C extra ring-B nodes (skins-extra/make_nodes.py) + node-b-control (scene parity check)",
           "unit_centre_m": src["unit_centre_m"], "ground_offset_cm": src["ground_offset_cm"], "shots": shots},
          open(f"{HERE}/shots.extra.json", "w", encoding="utf8"), indent=1)
for n in nodes:
    print(n["id"], n["status"], n["pos"], n["bearing_deg"], n["radius_m"])
print("node-b bearing", round(bb, 2), "r", round(rb, 2), "| node-a bearing", round(ba, 2), "r", round(ra, 2))

# bake list for bake_skins.py --nodes (v5): the 4 v4 nodes (same skins as v4: bake_skins.pick_skin order), the 5 ring-A orbit
# nodes (existing skins, panos-ext/<id>.seam.png), the 7 ring-B nodes (skins-extra/<id>.seam.png, seam_feather.py output)
TLOC = "C:/Habait/habait-walkaround/Habait/tour360/apartments/apt846/_local"
FACES = STUDIO + "/renders/clay-nodes-ortho/{}/faces.json"
# the new skins (ring A orbit, ring B) paint the sea and the Reading chimney behind the tower from EVERY side, i.e. on land on
# half of them: they do not paint the 4 km far-ground ring (v4's nodes a-d + the orthophoto keep it); tower, podium, nb, apt and
# the 440 m ground patch take them
SKIP = ["ground_far"]
# no_gain: the bake's colour gain (median ratio to node-b on co-visible texels) is driven by what GPT painted on the ground, not by
# the grade, for views 45-180 deg apart (0.4-1.8 measured, gain_probe.py); their image-level grade is within ~15% (grade_probe.py)
bake = [{"id": "node-a-aerial", "faces": FACES.format("node-a-aerial"), "skin": TLOC + "/panos-ext/node-a-aerial.seam.png"},
        {"id": "node-b-tower", "faces": FACES.format("node-b-tower"), "skin": TLOC + "/panos-ext/node-b-tower.seam.png"},
        {"id": "node-c-facade", "faces": FACES.format("node-c-facade"), "skin": TLOC + "/panos-ext/node-c-facade.v2.seam.png"},
        {"id": "node-d-terrace", "faces": FACES.format("node-d-terrace"), "skin": TLOC + "/panos-ext-parquet/node-d-terrace.v2.seam.png"}]
bake += [{"id": f"node-o{k}-orbit", "faces": FACES.format(f"node-o{k}-orbit"), "skin": TLOC + f"/panos-ext/node-o{k}-orbit.seam.png", "skip_groups": SKIP, "no_gain": True} for k in range(1, 6)]
bake += [{"id": n["id"], "faces": f"{HERE}/clay-nodes/{n['id']}/faces.json", "skin": f"{HERE}/{n['id']}.seam.png", "skip_groups": SKIP, "no_gain": True} for n in nodes if n["status"] == "new"]
json.dump({"schema": "habait-flyover/bake-nodes.v1", "note": "bake_skins.py --nodes list, v5 (4 v4 + 5 ring-A orbit + 7 ring-B)", "nodes": bake},
          open(f"{HERE}/bake-nodes-v5.json", "w", encoding="utf8"), indent=1)
print("bake-nodes-v5.json:", len(bake), "nodes; missing:", [b["id"] for b in bake if not (os.path.exists(b["faces"]) and os.path.exists(b["skin"]))])

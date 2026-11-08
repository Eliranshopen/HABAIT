"""world2equi.py — where a world point (or a box) lands on a rendered 360 node's equirect: u/v for a tour hotspot (2026-11-02).
  python -X utf8 -I tools/world2equi.py --faces <renders/clay-nodes-ortho/<node>/faces.json> --point x,y,z [--point ...]
  python -X utf8 -I tools/world2equi.py --faces ... --box x0,y0,z0,x1,y1,z1        (a unit's 3D box → its centre u/v + the u/v extent)
  python -X utf8 -I tools/world2equi.py --faces ... --units <units.json> [--out hotspots.json]   (every unit's box → u/v on this node)
Same convention as tools/cube2equi.py: the image centre (u 0.5) faces faces.json centre_look on the horizon, u grows clockwise
seen from above (the tour's yaw = (u-0.5)*360), v 0 = zenith. Plan-world metres: X right, Y up the plan, Z up, unit floor z 0.
units.json (lane A, card 03): [{"id", "box_world": [x0,y0,z0,x1,y1,z1], ...}] — any other shape is reported, not guessed."""
import sys, json, math, argparse

ap = argparse.ArgumentParser()
ap.add_argument("--faces", required=True)
ap.add_argument("--point", action="append", default=[])
ap.add_argument("--box", action="append", default=[])
ap.add_argument("--units", default=None)
ap.add_argument("--out", default=None)
a = ap.parse_args()
meta = json.load(open(a.faces, encoding="utf8"))
pos = meta["pos"]
look = meta.get("centre_look") or [pos[0], pos[1] + 1, pos[2]]
cx, cy = look[0] - pos[0], look[1] - pos[1]
n = math.hypot(cx, cy) or 1.0
c = (cx / n, cy / n)
r = (c[1], -c[0])  # right when facing c (clockwise from above)

def uv(p):
    dx, dy, dz = p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]
    fwd = dx * c[0] + dy * c[1]
    rgt = dx * r[0] + dy * r[1]
    lon = math.atan2(rgt, fwd)                       # + = right = clockwise
    lat = math.atan2(dz, math.hypot(dx, dy))         # + = up
    return (0.5 + lon / (2 * math.pi)) % 1.0, 0.5 - lat / math.pi

def box_uv(b):
    corners = [(x, y, z) for x in (b[0], b[3]) for y in (b[1], b[4]) for z in (b[2], b[5])]
    us, vs = zip(*(uv(p) for p in corners))
    centre = uv([(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2])
    # a box straddling the wrap seam would need unwrapping; flag it instead of lying
    wrap = max(us) - min(us) > 0.5
    return {"u": round(centre[0], 4), "v": round(centre[1], 4), "u_min": round(min(us), 4), "u_max": round(max(us), 4), "v_min": round(min(vs), 4), "v_max": round(max(vs), 4), "wraps_seam": wrap}

out = {"node": meta.get("shot"), "pos": pos, "centre_look": look, "points": [], "boxes": [], "units": []}
for s in a.point:
    p = [float(x) for x in s.split(",")]; u, v = uv(p)
    out["points"].append({"point": p, "u": round(u, 4), "v": round(v, 4), "yaw_deg": round((u - 0.5) * 360, 1), "pitch_deg": round((0.5 - v) * 180, 1)})
for s in a.box:
    b = [float(x) for x in s.split(",")]; out["boxes"].append({"box": b, **box_uv(b)})
if a.units:
    units = json.load(open(a.units, encoding="utf8"))
    units = units.get("units", units) if isinstance(units, dict) else units
    for un in units:
        b = un.get("box_world")
        if not (isinstance(b, list) and len(b) == 6):
            out["units"].append({"id": un.get("id"), "error": "no box_world [x0,y0,z0,x1,y1,z1]"}); continue
        out["units"].append({"id": un.get("id"), "floor": un.get("floor"), **box_uv(b)})
txt = json.dumps(out, indent=1, ensure_ascii=False)
if a.out:
    open(a.out, "w", encoding="utf8").write(txt); print(f"wrote {a.out}")
else:
    print(txt)

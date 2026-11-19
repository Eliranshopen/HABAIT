#!/usr/bin/env python3
r"""Rainbow apartment-journey page media (was the v2 test page; relocated 2026-11-09 round 2) (plan development/plans/2026-11-09-rainbow-v2.md). $0: local ffmpeg + headless Chrome only, no paid call.

Writes platform/apartment-journey/media/ from media already on disk, every output with a manifest row (input, sha256, args, cost 0):
  * tower-16-{1920,960}.jpg, tower-16-portrait.jpg  the hold's stop pose = frame 91 of its Kling arc track (research/.../flyover3d/data/
        holdarc/jpg_hi/frame_0091.jpg, camera.json centre_frame 91 = the orbit clip's end pose). Re-encode / 2:3 crop only, no edit.
        Apartment 846's terrace point (site_nodes.json apartment_hotspot_world) projects through that frame's camera to
        (0.4979, 0.7883) of the frame, floor band ±1.6 m = y 0.7565 … 0.8201 (FLOOR16 below; the page reads it from media/manifest.json).
  * room-<id>-{wide,tall}.webp, room-<id>-thumb.webp  flat straight-ahead views (ffmpeg v360 reprojection, no edit) of the GATED tour
        panoramas tour360/dist/apt846/panos/*.webp (2048x1024). Yaw per room picked by eye from an 8-yaw contact sheet.
  * dollhouse.webp  a still of the live apartment dollhouse (tour360/dist/apt846/3d/dollhouse.html, preset 3d), captured in headless
        Chrome with its own UI and labels hidden and a transparent background (tools/capture_v2_dollhouse.mjs), trimmed.
Every output is AI-made property imagery (Kling film frames, AI-skinned panoramas, the AI-assisted dollhouse): the page shows
«הדמיה · AI-generated» on each (root §6).

usage: python tools/make_journey_media.py          dry run: prints what it would run
       python tools/make_journey_media.py --go     runs it (idempotent: a step whose output, input hash and args match its row is skipped)
Exit non-zero with the reason on stderr on any failure (root §5).
"""
import datetime, hashlib, json, math, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLATFORM = os.path.dirname(HERE)
OUT = os.path.join(PLATFORM, "apartment-journey", "media")
HABAIT = os.path.normpath(os.path.join(PLATFORM, "..", "..", ".."))     # Projects/Habait
MAIN = r"C:\RnD\Projects\Habait"                                      # media outside git (research/, tour dist) is read from the main checkout

def src(rel):
    for base in (HABAIT, MAIN):
        p = os.path.join(base, *rel.split("/"))
        if os.path.isfile(p): return p
    sys.exit(f"make_journey_media: input missing: {rel}")

HOLD_REL = "research/fal-bench-2026-11-02/flyover3d/data/holdarc/jpg_hi/frame_0091.jpg"
DOLL_REL = "habait-walkaround/Habait/tour360/dist/apt846/3d/dollhouse.html"
PANOS = "habait-walkaround/Habait/tour360/dist/apt846/panos/"
# grounded in the hold's own camera (holdarc/camera.json frame 91) and the 3D site anchor (site_nodes.json apartment_hotspot_world)
FLOOR16 = {"anchor": [0.4979, 0.7883], "band": [0.7565, 0.8201], "frame": HOLD_REL, "floor_to_floor_m": 3.2,
           "source": "projection of site_nodes.json apartment_hotspot_world (10.325, -11.148, 1.0) and ±1.6 m through holdarc/camera.json frame 91"}
# portrait crop of the 1920x1080 frame: 720 px wide around the tower (x 0.18-0.58 of the frame), anchor x 956 falls inside
PORTRAIT_X = 367

# tour room id, pano, yaw, pitch (picked by eye, scratch contact sheet of 8 yaws per room, 2026-11-09)
ROOMS = [
    ("entrance", "01-entrance", 0, -4),
    ("living", "04-living", -40, -4),
    ("kitchen", "02-kitchen", -150, -6),
    ("dining", "03-dining", -30, -6),
    ("terraceLiving", "05-terrace-living", 30, -4),
    ("bedroomMain", "07-bedroom-main", -135, -6),
    ("bathMain", "09-bath-main", -15, 2),
    ("bedroom2", "10-bedroom-2", -60, -6),
]

def vfov(h, w_px, h_px):   # rectilinear: tan(v/2) = tan(h/2) * H / W
    return round(math.degrees(2 * math.atan(math.tan(math.radians(h / 2)) * h_px / w_px)), 2)

def flat(yaw, pitch, hf, w, h):
    return f"v360=input=e:output=flat:h_fov={hf}:v_fov={vfov(hf, w, h)}:yaw={yaw}:pitch={pitch}:w={w}:h={h}:interp=lanczos"

WEBP = ["-c:v", "libwebp", "-quality", "80", "-compression_level", "6", "-map_metadata", "-1"]
STEPS = [
    ("tower-16-1920.jpg", HOLD_REL, ["-q:v", "3", "-map_metadata", "-1"]),
    ("tower-16-960.jpg", HOLD_REL, ["-vf", "scale=960:-2:flags=lanczos", "-q:v", "3", "-map_metadata", "-1"]),
    ("tower-16-portrait.jpg", HOLD_REL, ["-vf", f"crop=720:1080:{PORTRAIT_X}:0", "-q:v", "3", "-map_metadata", "-1"]),
]
for rid, pano, yaw, pitch in ROOMS:
    STEPS += [
        (f"room-{rid}-wide.webp", PANOS + pano + ".webp", ["-frames:v", "1", "-vf", flat(yaw, pitch, 84, 1600, 900), *WEBP]),
        (f"room-{rid}-tall.webp", PANOS + pano + ".webp", ["-frames:v", "1", "-vf", flat(yaw, pitch, 62, 900, 1350), *WEBP]),
        (f"room-{rid}-thumb.webp", PANOS + pano + ".webp", ["-frames:v", "1", "-vf", flat(yaw, pitch, 84, 320, 180), *WEBP]),
    ]
STEPS.append(("dollhouse.webp", DOLL_REL, ["@capture", "viewport=1600x1000", "dpr=1.5", "preset=3d", "ui+labels hidden", "alpha", "trim", "webp q86"]))

# ---- round 2 (2026-11-09): THE WALK — the fly-in and room-to-room as one shot, geometry-true, no new renders -------------------------------
# The rooms and the hold camera share one world frame (site_nodes.json: pos_world, centre_yaw_deg_from_plus_y_cw = the tour's centreBearingDeg).
# A pano column u looks along bearing = centre + (u - 0.5) * 360 (checked: living -> kitchen hotspot 20.9 deg vs the positions 20.7 deg); a flat
# yaw Y in room R looks along centre_R + Y. Each room: it LANDS looking along the bearing it was entered on (room 1: the hold camera's own
# bearing at frame 91, the fly-in), TURNS in 5-deg steps until the next room's doorway (the tour hotspot u) is in the centre, and the page then
# pushes straight toward that doorway into the next room, which lands looking the same way. Order = the tour's adjacency end to end; the main
# bedroom -> bath step goes through the wardrobe (its hotspot bearing 285.1 = the bath's 285.5). Frames: walk/<n>-<room>/{w,t}-NN.webp.
SITE_REL = "research/fal-bench-2026-11-02/flyover3d/data/site_nodes.json"
CAM_REL = "research/fal-bench-2026-11-02/flyover3d/data/holdarc/camera.json"
TOUR_REL = "habait-walkaround/Habait/tour360/dist/apt846/index.html"
WALK = [  # room, pano, pitch — the order follows the tour's doorways end to end
    ("terraceLiving", "05-terrace-living", -4), ("living", "04-living", -4), ("dining", "03-dining", -5), ("kitchen", "02-kitchen", -5),
    ("bedroom2", "10-bedroom-2", -5), ("entrance", "01-entrance", -4), ("bedroomMain", "07-bedroom-main", -5), ("bathMain", "09-bath-main", 0),
]
# a doorway through a room the walk does not stop in: leave a toward VIA, arrive in b looking along VIA's doorway to b
VIA = {("entrance", "bedroomMain"): "living", ("bedroomMain", "bathMain"): "wardrobe"}
# the last room ends turned to its view picked by eye (ROOMS yaw), so the walk does not stop on a wall
END_YAW = {"bathMain": -15}
STEP_DEG = 6
def walk_plan():
    import json as _j
    nodes = {n["id"]: n for n in _j.load(open(src(SITE_REL)))["nodes"]}
    f91 = [f for f in _j.load(open(src(CAM_REL)))["frames"] if f["frame"] == 91][0]
    t = open(src(TOUR_REL), encoding="utf-8").read(); dec = _j.JSONDecoder()
    def scene(rid):
        i = t.find('{"id":"%s","name"' % rid); return dec.raw_decode(t, i)[0] if i >= 0 else {"hotspots": []}
    wrap = lambda a: (a + 180) % 360 - 180
    def hot(a, b):   # bearing of the doorway from a toward b: a's hotspot, else b's hotspot reversed
        hs = [h for h in scene(a).get("hotspots", []) if h.get("to") == b]
        if hs: return (nodes[a]["centre_yaw_deg_from_plus_y_cw"] + (hs[0]["u"] - 0.5) * 360) % 360, f"hotspot {a}->{b}"
        hs = [h for h in scene(b).get("hotspots", []) if h.get("to") == a]
        if hs: return (nodes[b]["centre_yaw_deg_from_plus_y_cw"] + (hs[0]["u"] - 0.5) * 360 + 180) % 360, f"hotspot {b}->{a} reversed"
        raise SystemExit(f"make_journey_media: no doorway between {a} and {b}")
    def door(a, b):  # (leave bearing in a, arrive bearing in b, how)
        v = VIA.get((a, b))
        if not v: x, how = hot(a, b); return x, x, how
        x1, h1 = hot(a, v); x2, h2 = hot(v, b); return x1, x2, f"{h1}, then {h2}"
    plan, arrive, how_in = [], f91["yaw_deg_from_plus_y_cw"], "the hold camera, frame 91 (the fly-in)"
    for i, (rid, pano, pitch) in enumerate(WALK):
        c = nodes[rid]["centre_yaw_deg_from_plus_y_cw"]
        y0 = wrap(arrive - c)
        if i + 1 < len(WALK):
            out_b, next_in, how_out = door(rid, WALK[i + 1][0])
        else:
            out_b, next_in, how_out = (c + END_YAW[rid]) % 360 if rid in END_YAW else arrive, None, "end of the walk (the view picked by eye)"
        turn = wrap(out_b - arrive)
        n = max(1, math.ceil(abs(turn) / STEP_DEG))
        yaws = [round(wrap(y0 + turn * k / n), 2) for k in range(n + 1)] if abs(turn) > 0.5 else [round(y0, 2)]
        plan.append({"id": rid, "pano": pano, "pitch": pitch, "centre": c, "arrive_bearing": round(arrive % 360, 2), "arrive_from": how_in,
                     "leave_bearing": round(out_b % 360, 2), "leave_via": how_out, "turn_deg": round(turn, 2), "yaws": yaws, "dir": f"walk/{i + 1}-{rid}"})
        arrive, how_in = next_in, how_out
    return plan
WALK_PLAN = walk_plan()
for r in WALK_PLAN:
    for k, y in enumerate(r["yaws"]):
        STEPS += [
            (f"{r['dir']}/w-{k:02d}.webp", PANOS + r["pano"] + ".webp", ["-frames:v", "1", "-vf", flat(y, r["pitch"], 84, 1280, 720), "-c:v", "libwebp", "-quality", "72", "-compression_level", "6", "-map_metadata", "-1"]),
            (f"{r['dir']}/t-{k:02d}.webp", PANOS + r["pano"] + ".webp", ["-frames:v", "1", "-vf", flat(y, r["pitch"], 62, 720, 1080), "-c:v", "libwebp", "-quality", "72", "-compression_level", "6", "-map_metadata", "-1"]),
        ]

def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    return h.hexdigest()

def main():
    go = "--go" in sys.argv
    ff = shutil.which("ffmpeg") or sys.exit("make_journey_media: ffmpeg not on PATH")
    if go: os.makedirs(OUT, exist_ok=True)
    mpath = os.path.join(OUT, "manifest.json")
    man = json.load(open(mpath, encoding="utf-8")) if os.path.isfile(mpath) else {"schema": "habait.media-manifest.v0", "plan": "development/plans/2026-11-09-rainbow-v2.md", "rows": []}
    man["floor16"] = FLOOR16
    man["rooms"] = [{"id": r, "pano": p, "yaw": y, "pitch": pt} for r, p, y, pt in ROOMS]
    man["walk"] = WALK_PLAN
    done = {r["output"]: r for r in man["rows"]}
    for name, rel, args in STEPS:
        inp, dst = src(rel), os.path.join(OUT, *name.split("/"))
        if go: os.makedirs(os.path.dirname(dst), exist_ok=True)
        in_sha = sha(inp)
        prev = done.get(name)
        if prev and os.path.isfile(dst) and prev.get("sha256") == sha(dst) and prev.get("input_sha256") == in_sha and prev.get("args") == args:
            print("skip (checkpoint):", name); continue
        if args[0] == "@capture":
            cmd = ["node", os.path.join(HERE, "capture_v2_dollhouse.mjs"), inp, dst]
            tool = "headless Chrome (playwright-core, appdeps) + sharp"
        else:
            cmd = [ff, "-v", "error", "-y", "-i", inp, *args, dst]
            tool = "ffmpeg " + subprocess.run([ff, "-version"], capture_output=True, text=True).stdout.split()[2]
        print(("run: " if go else "dry: ") + " ".join(f'"{c}"' if " " in c or ";" in c else c for c in cmd))
        if not go: continue
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=540)
        if r.returncode != 0 or not os.path.isfile(dst):
            sys.stderr.write(f"make_journey_media: failed on {name}: {(r.stderr or r.stdout)[-800:]}\n"); sys.exit(1)
        done[name] = {"output": name, "bytes": os.path.getsize(dst), "sha256": sha(dst), "input": rel, "input_sha256": in_sha,
                      "args": args, "tool": tool, "cost_usd": 0, "ai_generated": True,
                      "disclosure": "הדמיה · AI-generated (root §6)", "at": datetime.datetime.now().isoformat(timespec="seconds")}
        print(f"  {name}: {done[name]['bytes'] / 1024:.0f} KB sha256 {done[name]['sha256'][:12]}")
    if go:
        man["rows"] = [done[n] for n, _, _ in STEPS if n in done]
        json.dump(man, open(mpath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        # what the page reads (journey.js): per room its frame folder, frame count and turn; the fly-in bearing
        page = {"fly_bearing": WALK_PLAN[0]["arrive_bearing"], "step_deg": STEP_DEG,
                "rooms": [{"id": r["id"], "dir": r["dir"], "frames": len(r["yaws"]), "turn_deg": r["turn_deg"], "leave_via": r["leave_via"]} for r in WALK_PLAN]}
        json.dump(page, open(os.path.join(OUT, "walk.json"), "w", encoding="utf-8"), indent=1)
        print("manifest:", mpath, "| walk.json:", len(page["rooms"]), "rooms,", sum(x["frames"] for x in page["rooms"]), "frames per orientation")

if __name__ == "__main__":
    main()

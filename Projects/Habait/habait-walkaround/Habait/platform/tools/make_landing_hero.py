#!/usr/bin/env python3
r"""Rainbow landing media (plan development/plans/2026-11-08-rainbow-landing.md). $0: local ffmpeg only, no paid call.

Cuts the hero loop and the section stills for the root landing page (index.html) from media already on disk:
  * hero-1080.mp4 / hero-720.mp4  the exterior ORBIT of the approved building film (Kling v2v + Topaz Starlight, board
                                  exterior-film A2) 0 → 14.4 s only — before its facade arc, the dip to black and the descent into
                                  the apartment (the old interior). Loop seam: the last 0.8 s dip through black into the clip's own first
                                  0.8 s (a plain dissolve ghosted: two poses of the orbit; lesson exterior-film A), so the native
                                  <video loop> restarts on the identical frame. No geometry change, trim + encode only.
  * hero-poster-1920.jpg / -960.jpg  frame 0 of the loop (the LCP image; the video fades in over it once it plays)
  * facade.jpg                   an exterior frame of the same film (step card 02)
  * interior-entrance.jpg, finish-parquet/marble.jpg  flat views (v360 reprojection, no edit) of the CURRENT gated tour panoramas
                                  (tour360/dist/apt846/panos/04-living.webp), not the older apartment-page stills.
  * renders/the-{1,2,3,6}-{1056,640}.{webp,jpg}  web derivatives of the four project renders Eliran added and cleared for the
                                  page (C:\RnD\screenshots\THE-*.{jpg,png}, 1056x696, read-only originals): scale + re-encode only.
                                  Their provenance is not known (architect or AI), so the page labels them «הדמיה» / «Render».
Every film/tour output is AI-generated property imagery: the page shows «הדמיה · AI-generated» on each (root §6).

usage: python tools/make_landing_hero.py            dry run: prints the commands and the manifest row it would write
       python tools/make_landing_hero.py --go       runs them (idempotent: a step whose output hash is in the manifest is skipped)
Exit non-zero with the reason on stderr on any failure (root §5).
"""
import hashlib, json, os, shutil, subprocess, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
PLATFORM = os.path.dirname(HERE)
WALK = os.path.normpath(os.path.join(PLATFORM, "..", ".."))          # habait-walkaround
HABAIT = os.path.normpath(os.path.join(WALK, ".."))                  # Projects/Habait
OUT = os.path.join(PLATFORM, "fixtures", "rainbow", "landing")
# the media lives outside git in places (research/, _local/): read it from the main checkout when run inside a worktree
MAIN = r"C:\RnD\Projects\Habait"
def src(rel_from_habait):
    if rel_from_habait.startswith("@shots/"):
        p = os.path.join(SHOTS, rel_from_habait[7:])
        return p if os.path.isfile(p) else sys.exit(f"make_landing_hero: input missing: {p}")
    for base in (HABAIT, MAIN):
        p = os.path.join(base, *rel_from_habait.split("/"))
        if os.path.isfile(p): return p
    sys.exit(f"make_landing_hero: input missing: {rel_from_habait}")

FILM_REL = "research/fal-bench-2026-11-02/flyover3d/data/video/building-film-1080.mp4"
LIVING_REL = "habait-walkaround/Habait/tour360/dist/apt846/panos/04-living.webp"
PARQUET_REL = "habait-walkaround/Habait/tour360/dist/apt846/panos-parquet/04-living.webp"
ENTRANCE_REL = "habait-walkaround/Habait/tour360/dist/apt846/panos/01-entrance.webp"
ORBIT_REL = "habait-walkaround/Habait/platform/fixtures/rainbow/orbit_real.mp4"   # 17.04 s, 24 fps, 409 frames: orbit + descent to the hold pose
FINISH = "v360=input=e:output=flat:h_fov=52:v_fov=74:yaw=-100:pitch=-30:w=540:h=810:interp=lanczos"
MARBLE_REL = "habait-walkaround/Habait/tour360/dist/apt846/panos-marble/04-living.webp"   # the same view in the tour's marble finish
ORBIT_END, SEAM = 14.4, 0.8   # orbit ends ~14.5 s (frames checked by eye); the facade arc starts ~15 s; black dip 20.5 s
X264 = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p", "-g", "48", "-threads", "4",
        "-movflags", "+faststart", "-an", "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact"]
LOOP = (f"[0:v]trim=0:{ORBIT_END},setpts=PTS-STARTPTS,{{scale}}split[a][b];"
        f"[a]trim={SEAM}:{ORBIT_END},setpts=PTS-STARTPTS[body];[b]trim=0:{SEAM},setpts=PTS-STARTPTS[head];"
        f"[body][head]xfade=transition=fadeblack:duration={SEAM}:offset={ORBIT_END - 2 * SEAM:.2f},format=yuv420p[v]")

SHOTS = r"C:\RnD\screenshots"
def render_steps():
    out = []
    for n, ext in (("1", "jpg"), ("2", "jpg"), ("3", "png"), ("6", "jpg")):
        for w in (1056, 640):
            sc = [] if w == 1056 else ["-vf", f"scale={w}:-2:flags=lanczos"]
            out.append((f"renders/the-{n}-{w}.webp", f"@shots/THE-{n}.{ext}", [*sc, "-c:v", "libwebp", "-quality", "82", "-compression_level", "6", "-map_metadata", "-1"]))
            out.append((f"renders/the-{n}-{w}.jpg", f"@shots/THE-{n}.{ext}", [*sc, "-q:v", "3", "-map_metadata", "-1"]))
    return out

def flat(yaw, pitch=-3):
    return f"v360=input=e:output=flat:h_fov=80:v_fov=56:yaw={yaw}:pitch={pitch}:w=1080:h=756:interp=lanczos"

STEPS = [
    ("hero-1080.mp4", FILM_REL, ["-filter_complex", LOOP.format(scale=""), "-map", "[v]", "-crf", "23", "-maxrate", "4.2M", "-bufsize", "8.4M", *X264]),
    ("hero-720.mp4", FILM_REL, ["-filter_complex", LOOP.format(scale="scale=1280:720:flags=lanczos,"), "-map", "[v]", "-crf", "24", "-maxrate", "1.9M", "-bufsize", "3.8M", *X264]),
    # phones (portrait screens): a 2:3 CROP of the 1080 source around the tower (x 485-1205 of 1920; the tower stays inside it for the
    # whole orbit, checked frame by frame), so a 390-wide phone gets full-resolution pixels instead of a 2.3x upscale of the 720p
    ("hero-portrait.mp4", FILM_REL, ["-filter_complex", LOOP.format(scale="crop=720:1080:485:0,"), "-map", "[v]", "-crf", "25", "-maxrate", "2.0M", "-bufsize", "4.0M", *X264]),
    ("hero-poster-portrait.jpg", FILM_REL, ["-ss", f"{SEAM}", "-frames:v", "1", "-vf", "crop=720:1080:485:0", "-q:v", "4", "-map_metadata", "-1"]),
    # poster = frame 0 of the loop = the film at SEAM seconds (the loop starts there)
    ("hero-poster-1920.jpg", FILM_REL, ["-ss", f"{SEAM}", "-frames:v", "1", "-q:v", "4", "-map_metadata", "-1"]),
    ("hero-poster-960.jpg", FILM_REL, ["-ss", f"{SEAM}", "-frames:v", "1", "-vf", "scale=960:-2:flags=lanczos", "-q:v", "4", "-map_metadata", "-1"]),
    ("facade.jpg", FILM_REL, ["-ss", "16.0", "-frames:v", "1", "-vf", "scale=1080:-2:flags=lanczos", "-q:v", "4", "-map_metadata", "-1"]),
    ("interior-entrance.jpg", ENTRANCE_REL, ["-frames:v", "1", "-vf", flat(0), "-q:v", "3", "-map_metadata", "-1"]),
    # «שינוי עיצוב»: the same floor view in two of the tour's finishes, shown side by side in HTML (two pictures, no compositing)
    ("finish-parquet.jpg", PARQUET_REL, ["-frames:v", "1", "-vf", FINISH, "-q:v", "3", "-map_metadata", "-1"]),
    ("finish-marble.jpg", MARBLE_REL, ["-frames:v", "1", "-vf", FINISH, "-q:v", "3", "-map_metadata", "-1"]),
    # the /hold/ intro (project.json exterior.intro.clip), 2x faster (Eliran 2026-11-09: «הסיבוב סביב הבניין … מאוד איטי»): every frame of
    # orbit_real.mp4 kept, timestamps halved, 24 -> 48 fps, so nothing is dropped or blended and the LAST frame is still the hold's stop pose.
    # The original stays beside it; its muted audio is dropped (the clip plays muted; the ambience is its own <audio>).
    ("../orbit_fast.mp4", ORBIT_REL, ["-vf", "setpts=PTS/2", "-r", "48", "-fps_mode", "cfr", "-crf", "19", "-maxrate", "6M", "-bufsize", "12M", *X264]),
] + render_steps()

def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    return h.hexdigest()

def main():
    go = "--go" in sys.argv
    ff = shutil.which("ffmpeg") or sys.exit("make_landing_hero: ffmpeg not on PATH")
    os.makedirs(OUT, exist_ok=True) if go else None
    mpath = os.path.join(OUT, "manifest.json")
    man = json.load(open(mpath, encoding="utf-8")) if os.path.isfile(mpath) else {"schema": "habait.media-manifest.v0", "plan": "development/plans/2026-11-08-rainbow-landing.md", "rows": []}
    done = {r["output"]: r for r in man["rows"]}
    for name, rel, args in STEPS:
        inp, dst = src(rel), os.path.join(OUT, *name.split("/"))
        if go: os.makedirs(os.path.dirname(dst), exist_ok=True)
        in_sha = sha(inp)
        cmd = [ff, "-v", "error", "-y", *(args[:2] if args[0] == "-ss" else []), "-i", inp, *(args[2:] if args[0] == "-ss" else args), dst]
        prev = done.get(name)
        if prev and os.path.isfile(dst) and prev.get("sha256") == sha(dst) and prev.get("input_sha256") == in_sha and prev.get("args") == args:
            print("skip (checkpoint):", name); continue
        print(("run: " if go else "dry: ") + " ".join(f'"{c}"' if " " in c or ";" in c else c for c in cmd))
        if not go: continue
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=540)
        if r.returncode != 0 or not os.path.isfile(dst):
            sys.stderr.write(f"make_landing_hero: ffmpeg failed on {name}: {r.stderr[-800:]}\n"); sys.exit(1)
        done[name] = {"output": name, "bytes": os.path.getsize(dst), "sha256": sha(dst), "input": rel, "input_sha256": in_sha,
                      "args": args, "tool": "ffmpeg " + subprocess.run([ff, "-version"], capture_output=True, text=True).stdout.split()[2],
                      "cost_usd": 0, "ai_generated": not rel.startswith("@shots/"),
                      "disclosure": "הדמיה / Render (provenance unknown; wording = Eliran's open call)" if rel.startswith("@shots/") else "הדמיה · AI-generated (root §6)",
                      "at": datetime.datetime.now().isoformat(timespec="seconds")}
        print(f"  {name}: {done[name]['bytes'] / 1048576:.2f} MB sha256 {done[name]['sha256'][:12]}")
    if go:
        man["rows"] = [done[n] for n, _, _ in STEPS if n in done]
        json.dump(man, open(mpath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("manifest:", mpath)

if __name__ == "__main__":
    main()

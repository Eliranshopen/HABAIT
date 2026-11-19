#!/usr/bin/env python
"""Rainbow project film — $0 draft cut, built only from media already on disk.

Dry-run by default (prints the plan). `--go` builds. Idempotent: a clip or overlay
whose recipe hash is unchanged is not rebuilt. No network, no paid call.
Recipe: .claude/skills/project-film/SKILL.md · storyboard: STORYBOARD.md (same folder).
Run from Git Bash:  timeout 540 python video/projects/rainbow-project-film/build.py --go
"""
import argparse, hashlib, json, os, subprocess, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
HAB = os.path.join(ROOT, "Projects", "Habait", "habait-walkaround", "Habait")
FIX = os.path.join(HAB, "platform", "fixtures", "rainbow")
PANO = os.path.join(HAB, "tour360", "apartments", "apt846", "_local", "panos-parquet")
FONTS = os.path.join(HAB, "platform", "fonts")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
W, H, FPS = 1280, 720, 24

AI = "ai"        # badge «הדמיה · AI-generated»
RENDER = "render"  # badge «הדמיה» (project renders, provenance unknown — as on the landing page)

# id, kind, source, seconds, params, badge, subject, captions[(in, out, text)] relative to the shot
SHOTS = [
    ("01-hero-open", "video", f"{FIX}/landing/hero-1080.mp4", 4.5, {"ss": 0.5}, AI, "property",
     [(0.3, 2.2, "תל אביב, מול הים"), (2.3, 4.5, "מגדל מגורים על קו הים")]),
    ("02-location", "still", f"{ROOT}/screenshots/THE-1.jpg", 5.0, {"z": (1.0, 1.14), "x": (0.5, 0.62), "y": (0.5, 0.62)}, RENDER, "property",
     [(0.2, 2.6, "נמל תל אביב, פארק רידינג,"), (2.7, 5.0, "המרינה וחוף הים")]),
    ("03-street", "still", f"{ROOT}/screenshots/THE-3.png", 3.5, {"z": (1.16, 1.16), "x": (0.0, 1.0), "y": (0.5, 0.5)}, RENDER, "property",
     [(0.2, 3.5, "כולם מסביב לבית")]),
    ("04-dusk", "still", f"{ROOT}/screenshots/THE-2.jpg", 3.5, {"z": (1.18, 1.18), "x": (0.75, 0.75), "y": (1.0, 0.1)}, RENDER, "property",
     [(0.3, 3.5, "Rainbow תל אביב")]),
    ("05-pool", "still", f"{ROOT}/screenshots/THE-6.jpg", 3.0, {"z": (1.0, 1.12), "x": (0.5, 0.5), "y": (0.5, 0.7)}, RENDER, "property", []),
    ("06-orbit", "video", f"{FIX}/orbit_real.mp4", 4.0, {"ss": 5.0}, AI, "property",
     [(0.3, 4.0, "ובתוכו, דירה אחת")]),
    ("07-descend", "video", f"{HAB}/platform/_local/segments/rainbow-cine/descend-846.mp4", 4.4, {"ss": 0.0}, AI, "property",
     [(0.3, 4.2, "קומה 16")]),
    ("08-enter", "video", f"{HAB}/platform/_local/segments/rainbow-cine/enter-846.mp4", 8.6, {"ss": 0.0}, AI, "unit",
     [(0.3, 2.8, "3 חדרים,"), (2.9, 5.6, "106.72 מ״ר,"), (5.7, 8.4, "ומרפסת שמש של 26.15 מ״ר")]),
    ("09-living", "pano", f"{PANO}/04-living.webp", 4.0, {"yaw": (-60, 5), "pitch": -4}, AI, "unit",
     [(0.2, 4.0, "הסלון,")]),
    ("10-kitchen", "pano", f"{PANO}/02-kitchen.webp", 3.5, {"yaw": (-105, -30), "pitch": -5}, AI, "unit",
     [(0.2, 3.5, "המטבח ופינת האוכל,")]),
    ("11-bedroom", "pano", f"{PANO}/07-bedroom-main.webp", 3.0, {"yaw": (-150, -112), "pitch": -5}, AI, "unit",
     [(0.2, 3.0, "חדר השינה,")]),
    ("12-bath", "pano", f"{PANO}/09-bath-main.webp", 2.5, {"yaw": (-32, -6), "pitch": -4}, AI, "unit",
     [(0.2, 2.5, "חדר הרחצה,")]),
    ("13-terrace", "pano", f"{PANO}/05-terrace-living.webp", 6.0, {"yaw": (-5, 68), "pitch": -6}, AI, "unit",
     [(0.2, 1.8, "והמרפסת."), (2.0, 3.9, "לא רק לראות דירה,"), (4.0, 6.0, "להיכנס אליה.")]),
    ("14-hero-close", "video", f"{FIX}/landing/hero-1080.mp4", 4.5, {"ss": 8.0}, AI, "property",
     [(0.2, 2.2, "תל אביב, מול הים,"), (2.3, 4.5, "Rainbow תל אביב")]),
    ("15-developer", "video", f"{HAB}/engine/_local/apt846-project/video/hold-ring/real.mp4", 4.0, {"ss": 2.0}, AI, "property",
     [(0.3, 4.0, "פרויקט של ישראל קנדה")]),
    ("16-card", "card", f"{FIX}/logo.svg", 2.2, {}, None, "brand", []),
]
MUSIC = f"{HAB}/studio/_local/projects/apt846-rainbow-tlv/renders/audio/track-a.mp3"

CSS = f"""
@font-face{{font-family:Heebo;src:url('file:///{FONTS.replace(os.sep,'/')}/heebo-hebrew-wght-normal.woff2') format('woff2');font-weight:100 900;unicode-range:U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}}
@font-face{{font-family:Heebo;src:url('file:///{FONTS.replace(os.sep,'/')}/heebo-latin-wght-normal.woff2') format('woff2');font-weight:100 900;unicode-range:U+0000-00FF,U+2000-206F}}
html,body{{margin:0;width:{W}px;height:{H}px;background:transparent;overflow:hidden;font-family:Heebo,Arial,sans-serif}}
.cap{{position:absolute;left:5%;right:5%;bottom:6.5%;text-align:center;color:#fff;font-size:40px;font-weight:400;line-height:1.15;
 text-shadow:0 2px 10px rgba(0,0,0,.75),0 0 3px rgba(0,0,0,.6);white-space:nowrap}}
.badge{{position:absolute;top:28px;right:32px;background:#f2a900;color:#1a1300;font-size:19px;font-weight:600;padding:6px 14px;border-radius:999px;
 box-shadow:0 2px 8px rgba(0,0,0,.35)}}
.card{{position:absolute;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:26px}}
.card svg{{width:520px;height:auto;color:#fff}}
.card p{{margin:0;font-size:26px;font-weight:300;opacity:.8}}
"""


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def run(cmd, cwd=HERE):
    r = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        sys.stderr.write("FAILED: " + " ".join(map(str, cmd))[:600] + "\n" + r.stderr.decode("utf-8", "replace")[-1500:] + "\n")
        sys.exit(1)
    return r


def stamp_ok(out, recipe):
    s = out + ".recipe"
    return os.path.exists(out) and os.path.exists(s) and open(s).read() == recipe


def stamp(out, recipe):
    open(out + ".recipe", "w").write(recipe)


def overlay_png(name, body):
    out = os.path.join(HERE, "overlays", name + ".png")
    html = f"<!doctype html><html lang='he' dir='rtl'><meta charset='utf-8'><style>{CSS}</style><body>{body}</body></html>"
    recipe = hashlib.sha256(html.encode("utf-8")).hexdigest()
    if stamp_ok(out, recipe):
        return out
    hp = os.path.join(HERE, "overlays", name + ".html")
    open(hp, "w", encoding="utf-8").write(html)
    run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--window-size={W},{H}",
         "--default-background-color=00000000", "--virtual-time-budget=3000",
         f"--screenshot={out}", "file:///" + hp.replace(os.sep, "/")])
    stamp(out, recipe)
    return out


def ff(args):
    run(["ffmpeg", "-v", "error", "-y"] + args)


ENC = ["-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-an"]


def build_clip(shot):
    sid, kind, src, dur, p, badge, subject, caps = shot
    out = os.path.join(HERE, "clips", sid + ".mp4")
    recipe = json.dumps([sid, kind, src, dur, p, sha(src) if kind != "card" else "card-v3", "v4"], sort_keys=True)
    if stamp_ok(out, recipe):
        return out
    n = int(round(dur * FPS))
    fit = f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},setsar=1,format=yuv420p,scale=out_range=tv:out_color_matrix=bt709,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709"
    if kind == "video":
        ff(["-ss", str(p["ss"]), "-i", src, "-frames:v", str(n), "-vf", f"fps={FPS},{fit}"] + ENC + [out])
    elif kind == "still":
        (z0, z1), (x0, x1), (y0, y1) = p["z"], p["x"], p["y"]
        big = f"scale={W*3}:{H*3}:force_original_aspect_ratio=increase:flags=lanczos,crop={W*3}:{H*3}"
        zp = (f"zoompan=z='{z0}+({z1}-{z0})*on/{n}':x='(iw-iw/zoom)*({x0}+({x1}-{x0})*on/{n})':"
              f"y='(ih-ih/zoom)*({y0}+({y1}-{y0})*on/{n})':d={n}:s={W}x{H}:fps={FPS}")
        ff(["-i", src, "-frames:v", str(n), "-vf", f"{big},{zp},setsar=1,format=yuv420p,scale=out_range=tv:out_color_matrix=bt709,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709"] + ENC + [out])
    elif kind == "pano":
        y0, y1 = p["yaw"]
        cmdf = "clips/" + sid + ".cmd"  # forward slash: a backslash is an escape inside an ffmpeg filter
        with open(os.path.join(HERE, cmdf), "w") as f:
            for i in range(n):
                f.write(f"{i / FPS:.5f} v360 yaw {y0 + (y1 - y0) * i / (n - 1):.4f};\n")
        vf = (f"sendcmd=f={cmdf},v360=e:flat:h_fov=86:v_fov=55.4:yaw={y0}:pitch={p['pitch']}:w={W}:h={H}:interp=lanczos:reset_rot=1,"
              f"unsharp=5:5:0.6,setsar=1,format=yuv420p,scale=out_range=tv:out_color_matrix=bt709,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709")
        ff(["-loop", "1", "-framerate", str(FPS), "-i", src, "-frames:v", str(n), "-vf", vf] + ENC + [out])
    elif kind == "card":
        svg = open(src, encoding="utf-8").read().replace('width="170" height="40"', 'width="600" height="141"')
        png = overlay_png("card", f"<div class='card' dir='ltr'>{svg}<p dir='rtl'>הדמיה להמחשה בלבד</p></div>")
        ff(["-loop", "1", "-framerate", str(FPS), "-i", png, "-frames:v", str(n), "-vf", f"{fit},format=yuv420p"] + ENC + [out])
    stamp(out, recipe)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true")
    a = ap.parse_args()

    t = 0.0
    plan = []
    for s in SHOTS:
        plan.append((s, t))
        t += int(round(s[3] * FPS)) / FPS
    total = t
    print(f"plan: {len(SHOTS)} shots, {total:.2f} s, {W}x{H}@{FPS}, cost $0")
    for s, t0 in plan:
        missing = "" if os.path.exists(s[2]) else "  !! MISSING SOURCE"
        print(f"  {t0:6.2f}  {s[3]:4.1f}s  {s[0]:16s} {s[1]:5s} {os.path.relpath(s[2], ROOT)}{missing}")
        if missing and a.go:
            sys.stderr.write("missing source: " + s[2] + "\n"); sys.exit(1)
    if not a.go:
        print("dry-run (no --go): nothing built"); return

    for d in ("clips", "overlays", "out", "qa"):
        os.makedirs(os.path.join(HERE, d), exist_ok=True)

    badges = {AI: overlay_png("badge-ai", "<div class='badge'>הדמיה · <span dir='ltr'>AI-generated</span></div>"),
              RENDER: overlay_png("badge-render", "<div class='badge'>הדמיה</div>")}
    # overlays are burned per shot (1-4 layers over a few seconds): one 23-layer pass over the whole film took > 8 min
    clips = []
    for (s, t0) in plan:
        raw = build_clip(s)
        layers = [(badges[s[5]], 0.0, s[3])] if s[5] else []
        for i, (ci, co, text) in enumerate(s[7]):
            layers.append((overlay_png(f"cap-{s[0]}-{i+1}", f"<div class='cap'><bdi>{text}</bdi></div>"), ci, co))
        if not layers:
            clips.append(raw); continue
        out = os.path.join(HERE, "clips", s[0] + ".ov.mp4")
        recipe = json.dumps([open(raw + ".recipe").read(), [(sha(l[0]), l[1], l[2]) for l in layers]])
        if not stamp_ok(out, recipe):
            n = int(round(s[3] * FPS))
            inputs, fc, last = ["-i", raw], [], "0:v"
            for i, (png, ti, to) in enumerate(layers, start=1):
                inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{s[3]:.3f}", "-i", png]
                fc.append(f"[{last}][{i}:v]overlay=0:0:enable='between(t,{ti:.3f},{to:.3f})'[v{i}]")
                last = f"v{i}"
            ff(inputs + ["-filter_complex", ";".join(fc), "-map", f"[{last}]", "-frames:v", str(n),
                         "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-an", out])
            stamp(out, recipe)
        clips.append(out)
    with open(os.path.join(HERE, "clips", "concat.txt"), "w") as f:
        for c in clips:
            f.write(f"file '{os.path.basename(c)}'\n")
    base = os.path.join(HERE, "out", "picture.mp4")
    ff(["-f", "concat", "-safe", "0", "-i", os.path.join("clips", "concat.txt"), "-c", "copy", base])
    music = os.path.join(HERE, "out", "music.wav")
    ff(["-i", MUSIC, "-i", MUSIC, "-i", MUSIC, "-filter_complex",
        f"[0:a][1:a]acrossfade=d=2[a1];[a1][2:a]acrossfade=d=2,atrim=0:{total:.3f},"
        f"afade=t=in:st=0:d=0.8,afade=t=out:st={total-2.5:.3f}:d=2.5,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]",
        "-map", "[a]", "-t", f"{total:.3f}", music])
    final = os.path.join(HERE, "out", "rainbow-project-film-draft-16x9.mp4")
    ff(["-i", base, "-i", music, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
        "-t", f"{total:.3f}", "-movflags", "+faststart", final])

    rows = []
    for (s, t0) in plan:
        rows.append({"shot": s[0], "in": round(t0, 3), "seconds": s[3], "kind": s[1],
                     "input": os.path.relpath(s[2], ROOT).replace(os.sep, "/"), "input_sha256": sha(s[2]),
                     "params": s[4], "subject": s[6],
                     "disclosure": {AI: "badge: הדמיה · AI-generated", RENDER: "badge: הדמיה", None: "none (logo card)"}[s[5]],
                     "captions": [c[2] for c in s[7]], "cost_usd": 0})
    manifest = {"schema": "habait.media-manifest.v0", "project": "rainbow-project-film", "status": "DRAFT — not approved, not published",
                "skill": ".claude/skills/project-film/SKILL.md", "tool": "ffmpeg + headless Chrome (overlays)",
                "output": os.path.relpath(final, ROOT).replace(os.sep, "/"), "output_sha256": sha(final),
                "bytes": os.path.getsize(final), "seconds": round(total, 3), "cost_usd_total": 0,
                "music": {"input": os.path.relpath(MUSIC, ROOT).replace(os.sep, "/"), "input_sha256": sha(MUSIC), "cost_usd": 0,
                          "note": "existing track, looped x3 with 2 s crossfades"},
                "at": datetime.datetime.now().isoformat(timespec="seconds"), "rows": rows}
    json.dump(manifest, open(os.path.join(HERE, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("built:", final)


if __name__ == "__main__":
    main()

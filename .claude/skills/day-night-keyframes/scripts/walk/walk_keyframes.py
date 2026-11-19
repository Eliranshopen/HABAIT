"""Day/Night for a FREE 3D WALK: one baked-light atlas set per lighting keyframe, on the SAME prepared model (same UVs),
so the browser can cross-fade atlases by the clock exactly as the panorama viewer cross-fades pictures.

Per key:  relight.py  prep.blend -> <out>/<key>/prep_<key>.blend      (light only; the prepared model is never written)
          walk_bake.py --stage bake   --group g   (for every group)    -> <out>/<key>/bake_<g>.exr
          walk_bake.py --stage export --exposure X                     -> <out>/<key>/gl/bake_<g>.jpg (+ walk.gltf)
Dry by default; --run executes. Idempotent: a step whose output exists and whose manifest row is there prints SKIP.
--budget-s stops cleanly between steps (exit 0, PARTIAL) so every call fits the machine's 540 s rule; re-run to continue.
--export-only re-exports with the presets' exposure (cheap: the EXR bakes are kept). $0, CPU.

python -I walk_keyframes.py --prep <prep.blend> --presets <json> --out <dir> [--keys a,b] [--samples 16] [--run]
"""
import argparse, hashlib, json, os, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("--prep", required=True)
ap.add_argument("--walk-bake", default=os.path.join(HERE, "walk_bake.py"))
ap.add_argument("--presets", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--relight", default=os.path.join(HERE, "..", "relight.py"))
ap.add_argument("--blender", default=r"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe")
ap.add_argument("--keys", default="")
ap.add_argument("--samples", type=int, default=16)
ap.add_argument("--timeout", type=int, default=480, help="per Blender call")
ap.add_argument("--budget-s", type=int, default=0, help="stop between steps after this many seconds (0 = no limit)")
ap.add_argument("--export-only", action="store_true")
ap.add_argument("--run", action="store_true")
a = ap.parse_args()

P = json.load(open(a.presets, encoding="utf-8"))
keys = [k for k in P["keyframes"] if not a.keys or k["name"] in a.keys.split(",")]
prep_dir = os.path.dirname(os.path.abspath(a.prep))
cfg = json.load(open(os.path.join(prep_dir, "prep.json")))
G = cfg["groups"] + (1 if cfg.get("floor") else 0)  # + the floor atlas (walk_bake.py: the floor in its own group)
os.makedirs(a.out, exist_ok=True)
MF = os.path.join(a.out, "manifest.json")
man = json.load(open(MF, encoding="utf-8")) if os.path.exists(MF) else {"rows": []}
T0 = time.time()


def sha16(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()[:16]


def done(step, key, extra=None):
    return any(r["step"] == step and r["key"] == key and r.get("group") == extra for r in man["rows"])


def row(**r):
    r["cost_usd"] = 0
    man["rows"].append(r)
    json.dump(man, open(MF, "w", encoding="utf-8"), indent=1, ensure_ascii=False)


def blender(args, ok_tag):
    t = time.time()
    p = subprocess.Popen([a.blender, "-b", "--factory-startup"] + args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace")
    try:
        out, _ = p.communicate(timeout=a.timeout)
    except subprocess.TimeoutExpired:
        p.kill(); p.communicate()
        sys.exit(f"TIMEOUT after {a.timeout}s: {' '.join(args[:3])}")
    if ok_tag not in out:
        sys.stderr.write(out[-3000:])
        sys.exit(f"FAIL ({ok_tag} missing) exit {p.returncode}")
    return round(time.time() - t, 1), out


def over_budget():
    if a.budget_s and time.time() - T0 > a.budget_s:
        print("PARTIAL: budget reached; re-run to continue")
        sys.exit(0)


plan = []
for k in keys:
    d = os.path.join(a.out, k["name"])
    v = os.path.join(d, "prep_%s.blend" % k["name"])
    if not a.export_only:
        plan.append(("relight", k, None, v))
        for g in range(G):
            plan.append(("bake", k, g, os.path.join(d, "bake_%d.exr" % g)))
    plan.append(("export", k, None, os.path.join(d, "gl", "bake_%d.jpg" % (G - 1))))

for step, k, g, target in plan:
    d = os.path.join(a.out, k["name"])
    v = os.path.join(d, "prep_%s.blend" % k["name"])
    skip = os.path.exists(target) and done(step, k["name"], g) and not (a.export_only and step == "export")
    tag = "%s %s%s" % (step, k["name"], "" if g is None else " g%d" % g)
    if skip:
        print("SKIP", tag); continue
    if not a.run:
        print("DRY ", tag, "->", target); continue
    over_budget()
    os.makedirs(d, exist_ok=True)
    if step == "relight":
        shutil.copy(os.path.join(prep_dir, "prep.json"), os.path.join(d, "prep.json"))
        s, out = blender([a.prep, "-P", a.relight, "--", "--presets", a.presets, "--key", k["name"], "--out", v], "RELIGHT_OK")
        rep = next(l for l in out.splitlines() if l.startswith("RELIGHT_OK"))[11:]
        row(step=step, key=k["name"], group=None, seconds=s, out=v, report=json.loads(rep))
    elif step == "bake":
        s, _ = blender([v, "-P", a.walk_bake, "--", "--stage", "bake", "--dir", d, "--group", str(g), "--samples", str(a.samples)], "WALK_BAKE_OK")
        row(step=step, key=k["name"], group=g, seconds=s, samples=a.samples, exr_sha16=sha16(target))
    else:
        s, _ = blender([v, "-P", a.walk_bake, "--", "--stage", "export", "--dir", d, "--exposure", str(k["exposure"])], "WALK_EXPORT_OK")
        man["rows"] = [r for r in man["rows"] if not (r["step"] == "export" and r["key"] == k["name"])]
        row(step=step, key=k["name"], group=None, seconds=s, exposure=k["exposure"],
            atlases={str(i): sha16(os.path.join(d, "gl", "bake_%d.jpg" % i)) for i in range(G)})
    print("DONE", tag, "%.0fs" % s, flush=True)
print("ALL_DONE" if a.run else "DRY_DONE")

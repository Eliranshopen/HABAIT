"""Step 35 ($0) - stage the 360 version for Vercel (project ahk-b10-apt3-360): a clean copy of walk/ with window.HAB_MODE = '360',
the panoramas (walk/pano), the live-change function (walk/api/edit.mjs ), noindex headers.
Left out: the walk's own media (skill/, stops/, baked*/, sky/), raw model files (*.glb that are not .web.glb), trial pages.
Usage: python scripts/35_stage_360.py <job root> <stage dir>     (the stage dir keeps its .vercel link; everything else is replaced)"""
import json, os, shutil, sys

root, stage = sys.argv[1], sys.argv[2]
W = os.path.join(root, "walk")
os.makedirs(stage, exist_ok=True)
for n in os.listdir(stage):
    if n in (".vercel",):
        continue
    p = os.path.join(stage, n); shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
SKIP_DIRS = {"skill", "stops", "sky", "baked", "baked-try1", "baked-try3", "baked-try4", "baked-try5"}
for n in os.listdir(W):
    s = os.path.join(W, n)
    if n in SKIP_DIRS or n.startswith("gen_view") or n == "CLAUDE.md":
        continue
    d = os.path.join(stage, n)
    if os.path.isdir(s):
        def ign(dirp, names):
            return [x for x in names if x == "CLAUDE.md" or (x.endswith(".glb") and not x.endswith(".web.glb")) or x.endswith(".blend") or x.endswith(".blend1")]
        shutil.copytree(s, d, ignore=ign)
    else:
        shutil.copy2(s, d)
idx = os.path.join(stage, "index.html"); h = open(idx, encoding="utf-8").read()
h = h.replace("<title>אבני חפץ · קדם — הליכה בדירה</title>", "<title>אבני חפץ · קדם — סיור 360°</title>\n<script>window.HAB_MODE = '360';</script>", 1)
assert "HAB_MODE" in h, "title not found"
open(idx, "w", encoding="utf-8").write(h)
json.dump({"name": "ahk-b10-apt3-360", "private": True, "type": "module"}, open(os.path.join(stage, "package.json"), "w"), indent=1)
json.dump({"headers": [{"source": "/(.*)", "headers": [{"key": "X-Robots-Tag", "value": "noindex, nofollow"}]}],
           "functions": {"api/edit.mjs": {"maxDuration": 60}}}, open(os.path.join(stage, "vercel.json"), "w"), indent=1)
open(os.path.join(stage, ".gitignore"), "w").write(".vercel\nnode_modules\n")
os.makedirs(os.path.join(stage, "sky"), exist_ok=True); shutil.copy2(os.path.join(W, "sky", "env_1k.hdr"), os.path.join(stage, "sky"))   # the dollhouse light only
for f in os.listdir(os.path.join(W, "pano", "thumbs")):   # the room cards show the 360 pictures, not the walk's
    shutil.copy2(os.path.join(W, "pano", "thumbs", f), os.path.join(stage, "thumbs", f))
shutil.rmtree(os.path.join(stage, "pano", "thumbs"), ignore_errors=True)
size = sum(os.path.getsize(os.path.join(a, f)) for a, _, fs in os.walk(stage) for f in fs)
print("STAGED", stage, round(size / 1e6, 1), "MB")

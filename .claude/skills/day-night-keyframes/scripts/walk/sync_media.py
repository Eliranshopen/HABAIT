"""Copy the baked atlases into the viewer: out/<key>/gl/bake_<g>.jpg -> viewer/media/<key>/bake_<g>.jpg (+ a 1024 _1k for phones),
and the model (glTF, bin, live textures) once from the first key -> viewer/model/. Every key's walk.bin must be identical
(same geometry and UVs) or it stops. Writes viewer/media/manifest.json with hashes. $0.
python -I sync_media.py <out dir> <viewer dir> <presets.json>"""
import hashlib, json, os, shutil, sys
from PIL import Image

out, viewer, presets = sys.argv[1:4]
keys = [k["name"] for k in json.load(open(presets, encoding="utf-8"))["keyframes"]]
h = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()[:16]
bins = {k: h(os.path.join(out, k, "gl", "walk.bin")) for k in keys}
if len(set(bins.values())) != 1:
    sys.exit(f"FAIL: geometry differs between keys {bins}")
m = {"walk_bin_sha16": bins[keys[0]], "atlases": {}}
src = os.path.join(out, keys[0], "gl")
os.makedirs(os.path.join(viewer, "model"), exist_ok=True)
for f in os.listdir(src):
    if not f.startswith("bake_"):
        shutil.copy(os.path.join(src, f), os.path.join(viewer, "model", f))
for f in os.listdir(src):   # the glTF's own atlas references are satisfied with the first key (replaced at run time)
    if f.startswith("bake_") and not f.endswith("_2k.jpg"):
        shutil.copy(os.path.join(src, f), os.path.join(viewer, "model", f))
        Image.open(os.path.join(src, f)).resize((1024, 1024), Image.LANCZOS).save(os.path.join(viewer, "model", f[:-4] + "_1k.jpg"), quality=88)
for k in keys:
    d = os.path.join(viewer, "media", k)
    os.makedirs(d, exist_ok=True)
    g = 0
    while os.path.exists(os.path.join(out, k, "gl", "bake_%d.jpg" % g)):
        s = os.path.join(out, k, "gl", "bake_%d.jpg" % g)
        shutil.copy(s, os.path.join(d, "bake_%d.jpg" % g))
        Image.open(s).resize((1024, 1024), Image.LANCZOS).save(os.path.join(d, "bake_%d_1k.jpg" % g), quality=88)
        m["atlases"]["%s/%d" % (k, g)] = h(s)
        g += 1
json.dump(m, open(os.path.join(viewer, "media", "manifest.json"), "w"), indent=1)
print("SYNC_OK", len(m["atlases"]), "atlases, geometry", m["walk_bin_sha16"])

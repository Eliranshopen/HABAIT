"""Step 06 - fetch free CC0 assets from Poly Haven (models as glTF, textures as JPG maps, one HDRI).

Dry-run by default: prints what would be downloaded and its size. --go downloads.
Idempotent: a file already on disk with the size the API states is not downloaded again.
Writes assets/polyhaven/<kind>/<id>/... and assets/manifest.json (url, bytes, sha256, licence CC0).
No key, no account; nothing about this project is sent (a generic User-Agent only).
Usage: python 06_fetch_assets.py <job root> [--go]
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

root = Path(sys.argv[1])
GO = "--go" in sys.argv
UA = {"User-Agent": "asset-fetch/1.0"}
API = "https://api.polyhaven.com"
dest = root / "assets" / "polyhaven"

MODELS = {  # id: texture resolution
    "dining_chair_02": "1k", "throw_pillows_01": "1k", "potted_plant_01": "1k", "potted_plant_04": "1k",
    "pachira_aquatica_01": "1k", "ceramic_vase_03": "1k", "hanging_picture_frame_02": "1k",
    "decorative_book_set_01": "1k", "wooden_bowl_01": "1k", "desk_lamp_arm_01": "1k", "wicker_basket_01": "1k",
    "tree_small_02": "1k", "shrub_02": "1k", "shrub_04": "1k", "planter_pot_clay": "1k", "food_apple_01": "1k",
    "island_tree_02": "1k", "modern_arm_chair_01": "1k", "modern_ceiling_lamp_01": "1k", "modern_coffee_table_01": "1k",
    "potted_plant_02": "1k", "outdoor_table_chair_set_01": "1k", "hanging_picture_frame_01": "1k", "sofa_03": "1k",
}
TEXTURES = {  # id: resolution
    "oak_veneer_01": "2k", "rough_linen": "2k", "wool_boucle": "2k", "marble_01": "2k", "painted_plaster_wall": "2k",
    "leafy_grass": "2k", "fine_grained_wood": "2k", "cotton_jersey": "1k",
}
TEX_MAPS = ("Diffuse", "nor_gl", "Rough", "arm", "AO", "Displacement")
HDRIS = {"dry_orchard_meadow": "4k"}
if len(sys.argv) > 2 and sys.argv[-1].startswith("hdri="):
    HDRIS = {sys.argv[-1].split("=")[1]: "4k"}


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch(url, path, size):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and (size is None or path.stat().st_size == size):
        return "kept"
    if not GO:
        return "would download"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        data = r.read()
    path.write_bytes(data)
    return "downloaded"


rows, total = [], 0
MAX = 120 * 1024 * 1024
for mid, res in MODELS.items():
    f = get_json(f"{API}/files/{mid}")
    if "gltf" not in f or res not in f["gltf"]:
        print(f"SKIP model {mid}: no glTF at {res}")
        continue
    g = f["gltf"][res]["gltf"]
    files = [(g["url"], f"{mid}.gltf", g.get("size"))] + [(v["url"], k, v.get("size")) for k, v in g.get("include", {}).items()]
    size = sum(s or 0 for _, _, s in files)
    if size > MAX:
        print(f"SKIP model {mid}: {size/1e6:.0f} MB over the cap")
        continue
    for url, rel, s in files:
        st = fetch(url, dest / "models" / mid / rel, s)
        rows.append({"kind": "model", "id": mid, "file": f"models/{mid}/{rel}", "url": url, "bytes": s, "state": st})
    total += size
    print(f"model   {mid:<28} {size/1e6:6.1f} MB  {len(files)} files")
for tid, res in TEXTURES.items():
    f = get_json(f"{API}/files/{tid}")
    size = 0
    for m in TEX_MAPS:
        if m not in f or res not in f[m]:
            continue
        j = f[m][res].get("jpg") or f[m][res].get("png")
        ext = j["url"].rsplit(".", 1)[-1]
        st = fetch(j["url"], dest / "textures" / tid / f"{tid}_{m}.{ext}", j.get("size"))
        rows.append({"kind": "texture", "id": tid, "file": f"textures/{tid}/{tid}_{m}.{ext}", "url": j["url"], "bytes": j.get("size"), "state": st})
        size += j.get("size") or 0
    total += size
    print(f"texture {tid:<28} {size/1e6:6.1f} MB")
for hid, res in HDRIS.items():
    f = get_json(f"{API}/files/{hid}")
    j = f["hdri"][res]["hdr"]
    st = fetch(j["url"], dest / "hdri" / f"{hid}_{res}.hdr", j.get("size"))
    rows.append({"kind": "hdri", "id": hid, "file": f"hdri/{hid}_{res}.hdr", "url": j["url"], "bytes": j.get("size"), "state": st})
    total += j.get("size") or 0
    print(f"hdri    {hid:<28} {(j.get('size') or 0)/1e6:6.1f} MB")

print(f"total {total/1e6:.0f} MB; mode: {'GO' if GO else 'dry-run'}")
if GO:
    for r in rows:
        p = dest / r["file"]
        r["sha256"] = hashlib.sha256(p.read_bytes()).hexdigest()
    man = {"source": "polyhaven.com", "licence": "CC0 1.0", "cost_usd": 0, "files": rows}
    (root / "assets" / "manifest.json").write_text(json.dumps(man, indent=1), encoding="utf-8")
    print("manifest written:", len(rows), "files")

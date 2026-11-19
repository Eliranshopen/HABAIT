"""Step 15 - fetch CC0 furniture models from Poly Haven for the swap circles (root CLAUDE.md §8.10).

Not from RAINBOW (Eliran 2026-11-17: only RAINBOW's interface, never its furniture or items).
Dry-run by default; --go downloads. Idempotent (a file with the API's size is kept). glTF at 1k textures.
Writes walk/models/<id>/ and work/furniture-manifest.json (url, bytes, sha256, licence CC0, cost 0).
No key, no account; a generic User-Agent only.
Usage: python 15_fetch_furniture.py <job root> [--go]
"""
import hashlib, json, sys, urllib.request
from pathlib import Path

root = Path(sys.argv[1]); GO = "--go" in sys.argv
UA = {"User-Agent": "asset-fetch/1.0"}; API = "https://api.polyhaven.com"
dest = root / "walk" / "models"
IDS = ["sofa_02", "sofa_03", "Sofa_01", "coffee_table_round_01", "modern_coffee_table_01", "modern_coffee_table_02",
       "dining_table", "gallinera_table", "round_wooden_table_01", "dining_chair_02", "gallinera_chair", "painted_wooden_chair_02",
       "ClassicNightstand_01", "painted_wooden_nightstand", "side_table_01",
       "ceramic_vase_02", "ceramic_vase_04", "brass_vase_03", "potted_plant_01", "planter_pot_clay", "hanging_industrial_lamp"]
MAX = 40 * 1024 * 1024


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


rows, total = [], 0
for mid in IDS:
    f = get_json(f"{API}/files/{mid}")
    if "gltf" not in f or "1k" not in f["gltf"]:
        print(f"SKIP {mid}: no 1k glTF"); continue
    g = f["gltf"]["1k"]["gltf"]
    files = [(g["url"], f"{mid}.gltf", g.get("size"))] + [(v["url"], k, v.get("size")) for k, v in g.get("include", {}).items()]
    size = sum(s or 0 for _, _, s in files)
    if size > MAX:
        print(f"SKIP {mid}: {size/1e6:.0f} MB over the cap"); continue
    for url, rel, s in files:
        p = dest / mid / rel; st = "kept" if p.exists() and (s is None or p.stat().st_size == s) else ("would download" if not GO else "downloaded")
        if st == "downloaded":
            p.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r: p.write_bytes(r.read())
        rows.append({"id": mid, "file": f"walk/models/{mid}/{rel}", "url": url, "bytes": s, "state": st})
    total += size; print(f"{mid:<28} {size/1e6:6.1f} MB {len(files)} files")
print(f"total {total/1e6:.0f} MB; mode {'GO' if GO else 'dry-run'}")
if GO:
    for r in rows: r["sha256"] = hashlib.sha256((root / r["file"]).read_bytes()).hexdigest()
    (root / "work" / "furniture-manifest.json").write_text(json.dumps({"source": "polyhaven.com", "licence": "CC0 1.0", "cost_usd": 0, "files": rows}, indent=1), encoding="utf-8")

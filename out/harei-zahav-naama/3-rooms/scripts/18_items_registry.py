"""Write walkaround/items/registry.json: the movable pieces the walk shows as separate models with a ring ($0).

Run: python scripts/18_items_registry.py <job_dir>
Positions and sizes come from the geometry of record (geometry/geometry.json, u,v in cm; three.js x = u/100, z = v/100).
A piece is listed only when its web GLB exists (walkaround/items/glb/<id>.glb, from optimize_glb.py).
Also copies the sales plan for the you-are-here map and a thumbnail of each studio photo.
"""
import json
import os
import sys

from PIL import Image

JOB = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
G = json.load(open(os.path.join(JOB, "geometry", "geometry.json"), encoding="utf-8"))
IT = {i["id"]: i["box"] for i in G["items"]}
WK = os.path.join(JOB, "walkaround", "items")


def box(b, z0, h, hang=False):
    u0, v0, u1, v1 = b
    return {"pos": [round((u0 + u1) / 200, 4), round((z0 + h) / 100 if hang else z0 / 100, 4), round((v0 + v1) / 200, 4)],
            "size": [round((u1 - u0) / 100, 4), round(h / 100, 4), round((v1 - v0) / 100, 4)]}


# the pieces and where they stand: written by place_items.py when it built scene/hatzav_v2.blend (one source for Blender and the web)
PL = json.load(open(os.path.join(JOB, "items", "placements.json"), encoding="utf-8"))["pieces"]
os.makedirs(os.path.join(WK, "thumbs"), exist_ok=True)


def thumb(src):
    th = os.path.join(WK, "thumbs", src + ".jpg")
    st = os.path.join(JOB, "items", "studio", src + ".png")
    if os.path.exists(st) and (not os.path.exists(th) or os.path.getmtime(th) < os.path.getmtime(st)):
        im = Image.open(st).convert("RGB")
        im.thumbnail((256, 256))
        im.save(th, quality=86)
    return f"./items/thumbs/{src}.jpg"


items = []
for p in PL:
    if not os.path.exists(os.path.join(WK, "glb", p["src"] + ".glb")):
        print("skip (no web glb)", p["id"])
        continue
    d = dict(p, glb=f"./items/glb/{p['src']}.glb", thumb=thumb(p["src"]))
    if os.path.exists(os.path.join(WK, "glb", p["src"] + "_m.glb")):
        d["glb_m"] = f"./items/glb/{p['src']}_m.glb"   # the phone copy (30k faces, 1024 maps)
    if p["hang"]:
        d["ring_y"] = round(p["pos"][1] - p["size"][1] * 0.5, 3)
    items.append(d)

# the alternatives behind the rings (items/catalog-spec.json, made by 16_item_3d.mjs alt mode); only those with a web GLB
CS = json.load(open(os.path.join(JOB, "items", "catalog-spec.json"), encoding="utf-8"))["categories"]
catalog = {}
for cat, c in CS.items():
    xs = [{"id": x["id"], "name_he": x["name_he"], "name_en": x["name_en"], "colour": x["colour"], "material": x["material"],
           "glb": f"./items/glb/{x['id']}.glb", "thumb": thumb(x["id"])}
          for x in c["items"] if os.path.exists(os.path.join(WK, "glb", x["id"] + ".glb"))]
    if xs:
        catalog[cat] = xs
json.dump(catalog, open(os.path.join(WK, "catalog.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("CATALOG", {k: len(v) for k, v in catalog.items()})

plan_src = os.path.join(JOB, "input", "plan-hatzav-colour.png")
plan = None
if os.path.exists(plan_src):
    im = Image.open(plan_src).convert("RGB")
    im.thumbnail((900, 900))
    k = im.width / Image.open(plan_src).width
    im.save(os.path.join(JOB, "walkaround", "plan.jpg"), quality=84)
    ox, oy = G["source"].get("origin_px", [480, 267]) if isinstance(G.get("source"), dict) else (480, 267)
    plan = {"src": "./plan.jpg", "scale": 0.5, "ox": ox * k, "oy": oy * k, "px_per_cm": k}
FIN = [("stone", "אבן קרם · כמו בהדמיה", "cream stone, as designed", None, None),
       ("parquet", "פרקט אלון הרינגבון", "oak herringbone parquet", "herringbone_parquet", 1.6),
       ("concrete", "בטון מוחלק", "smooth concrete", "concrete_floor_02", 2.2),
       ("marble", "שיש בהיר", "light marble", "marble_01", 1.4)]
finishes = []
for fid, he, en, tex, tile in FIN:
    if tex is None:
        finishes.append({"id": fid, "name_he": he, "name_en": en, "baked": True, "thumb": "./items/thumbs/fin_stone.jpg"})
    elif os.path.exists(os.path.join(WK, "finishes", tex + ".jpg")):  # Poly Haven, CC0
        finishes.append({"id": fid, "name_he": he, "name_en": en, "tex": f"./items/finishes/{tex}.jpg", "tile_m": tile,
                         "thumb": f"./items/thumbs/fin_{tex}.jpg"})
stone = os.path.join(JOB, "assets", "polyhaven", "textures", "marble_01", "marble_01_Diffuse.jpg")
if not os.path.exists(os.path.join(WK, "thumbs", "fin_stone.jpg")):
    im = Image.new("RGB", (256, 256), (226, 219, 206))
    im.save(os.path.join(WK, "thumbs", "fin_stone.jpg"), quality=85)
reg = {"note": "movable pieces shown as separate models (AI-made from the developer's renders, step 16); written by 18_items_registry.py",
       "items": items, "finishes": finishes if len(finishes) > 1 else [], "plan": plan}
json.dump(reg, open(os.path.join(WK, "registry.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("REGISTRY OK", [i["id"] for i in items], "plan", bool(plan))

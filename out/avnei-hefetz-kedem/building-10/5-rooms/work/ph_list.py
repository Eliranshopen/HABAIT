import json, urllib.request, sys, re
UA = {"User-Agent": "asset-fetch/1.0"}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
        return json.loads(r.read().decode())
for t, pat in (("models", r"sofa|bed|chair|table|lamp|cabinet|rug|carpet|tv|television|plant|curtain|pillow|vase|book|shelf|stool|mirror|towel|wardrobe|desk|bench|nightstand|side"),
               ("textures", r"plank|deck|wood_floor|laminate|parquet|tile|marble|terrazzo|fabric|linen|rug|carpet|plaster|concrete|quartz|granite|leather|velvet|wool|cotton"),
               ("hdris", r".")):
    a = get(f"https://api.polyhaven.com/assets?t={t}")
    names = sorted(k for k, v in a.items() if re.search(pat, k, re.I) or (t == "hdris" and any(c in v.get("categories", []) for c in ("nature",)) and "outdoor" in v.get("categories", [])))
    if t == "hdris":
        names = sorted(k for k, v in a.items() if set(v.get("categories", [])) & {"hills", "rural", "field", "mountains"} or re.search(r"hill|meadow|field|valley|rural|country", k))
    print(f"== {t}: {len(a)} total, {len(names)} match")
    print(" ".join(names))

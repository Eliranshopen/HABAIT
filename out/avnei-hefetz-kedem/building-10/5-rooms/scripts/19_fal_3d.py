"""Step 19 (PAID, fal.ai) - the furniture of Eliran's pictures as real 3D models: a piece cut out of his picture
(input/supplied/*.png) -> an image-to-3D model on fal -> a textured GLB in walk/models/gen_<id>/.

Eliran 2026-11-18: «יש קרדיט בFAL אם אתה צריך» — the same furniture as his pictures, made real (his own pictures as input,
nothing invented). Dry-run by default: prints the plan and the price; --go calls. Every call is written to
ledger/fal-3d.json BEFORE it runs (reserved) and settled after; a piece whose GLB exists is never re-billed.
The key is read by the existing tool (edit_bench.key_from: environment, then C:\\RnD\\.env) and never printed.
Usage: python 19_fal_3d.py <job root> [--pieces bed_parents] [--model trellis] [--cap 1.0] [--go]
"""
import argparse, base64, io, json, sys, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("root")
ap.add_argument("--pieces", default="bed_parents")
ap.add_argument("--model", default="trellis")
ap.add_argument("--cap", type=float, default=1.0, help="hard stop for this run (USD)")
ap.add_argument("--go", action="store_true")
a = ap.parse_args()
R = Path(a.root)
MODELS = {"trellis": ("fal-ai/trellis", 0.02), "tripo": ("tripo3d/tripo/v2.5/image-to-3d", 0.40)}   # HD textures + PBR (fal page 2026-11-18: $0.30 standard, $0.40 HD)
# piece: (picture number, crop box in the 1100 px preview of work/look/<nn>.jpg -> scaled to the original)
PIECES = {   # boxes read off a 100 px grid drawn on the previews (work/look/grids.jpg)
    "bed_parents": ("05", (170, 255, 740, 614)),
    "bed_single": ("07", (570, 315, 895, 555)),
    "sofa": ("01", (825, 300, 1100, 614)),
    "dining_chair": ("03", (295, 335, 395, 480)),
    "coffee_table": ("03", (0, 495, 290, 614)),
    "nightstand_lamp": ("05", (10, 390, 245, 600)),
    "balcony_chair": ("12", (565, 470, 870, 614)),
    "balcony_table": ("12", (580, 385, 720, 545)),
}
SUP = sorted((R / "input" / "supplied").glob("*.png"))
pic = lambda nn: next(p for p in SUP if f" - {nn} " in p.name)
LED = R / "ledger" / "fal-3d.json"
led = json.loads(LED.read_text(encoding="utf-8")) if LED.exists() else {"currency": "USD", "rows": []}
ep, price = MODELS[a.model]
todo = [p for p in a.pieces.split(",") if p in PIECES]
spent = sum(r.get("usd", 0) for r in led["rows"] if r.get("state") in ("settled", "unknown"))
plan = [(p, ep, price) for p in todo if not (R / "walk" / "models" / f"gen_{p}_{a.model}" / f"gen_{p}_{a.model}.glb").exists()]
print(f"model {ep} ${price}/call · {len(plan)} call(s) · ${len(plan) * price:.2f} · spent before ${spent:.2f} · cap ${a.cap}")
if spent + len(plan) * price > a.cap:
    sys.exit("over the cap: refused")
if not a.go:
    print("DRY: nothing called"); sys.exit(0)
sys.path.insert(0, str(Path("C:/RnD/.wt/avnei-hefetz-kedem-5/Projects/Habait/habait-walkaround/Habait/tour360/tools")))
from edit_bench import key_from   # noqa: E402  the established key loader (never prints)
key, where = key_from(None)
if not key:
    sys.exit("no FAL_KEY")


def upload(jpeg, name):
    """fal's own storage (the documented two-step upload): some endpoints take only a URL, not a data URI"""
    req = urllib.request.Request("https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
                                 data=json.dumps({"file_name": name, "content_type": "image/jpeg"}).encode(), method="POST",
                                 headers={"Authorization": "Key " + key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read().decode("utf-8"))
    put = urllib.request.Request(d["upload_url"], data=jpeg, method="PUT", headers={"Content-Type": "image/jpeg"})
    with urllib.request.urlopen(put, timeout=120):
        pass
    return d["file_url"]


def save():
    LED.write_text(json.dumps(led, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


for p, ep, price in plan:
    nn, box = PIECES[p]
    im = Image.open(pic(nn)).convert("RGB"); k = im.width / 1100
    cut = im.crop(tuple(int(v * k) for v in box)); buf = io.BytesIO(); cut.save(buf, "JPEG", quality=92)
    out = R / "walk" / "models" / f"gen_{p}_{a.model}"; out.mkdir(parents=True, exist_ok=True); cut.save(out / "source-cut.jpg", quality=92)
    row = {"piece": p, "endpoint": ep, "usd": price, "state": "reserved", "source": pic(nn).name, "box_preview": box,
           "at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    led["rows"].append(row); save()
    body = {"image_url": upload(buf.getvalue(), f"{p}.jpg") if a.model == "tripo" else "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")}
    if a.model == "tripo": body.update(texture="HD", pbr=True, auto_size=True)
    req = urllib.request.Request("https://fal.run/" + ep, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": "Key " + key, "Content-Type": "application/json"})
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=400) as r:
            doc = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        row.update(state="failed", error=f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:300]}"); save()
        print(p, row["error"]); continue
    url = (doc.get("model_mesh") or doc.get("model_glb") or doc.get("pbr_model") or doc.get("base_model") or {}).get("url")
    if not url:
        row.update(state="failed", error="no mesh url: " + ",".join(doc.keys())); save(); print(p, row["error"]); continue
    with urllib.request.urlopen(url, timeout=300) as r2:
        (out / f"gen_{p}_{a.model}.glb").write_bytes(r2.read())
    row.update(state="settled", seconds=round(time.monotonic() - t0, 1), bytes=(out / f"gen_{p}_{a.model}.glb").stat().st_size); save()
    print(p, "OK", row["seconds"], "s", row["bytes"], "bytes")

"""train.py - card 12 (B2): the "project look" LoRA for apt846 / Rainbow TLV.

The training set (13 images, short captions, trigger "hbt846 style"):
  7 crops of the developer's PUBLIC renders (rainbowtlv.com/image/, downloaded 2026-11-01; Israel Canada's copyright):
    the exterior look (white twisting tower, curved white balconies, perforated white screens, palms, sea light).
    Used to train the look ONLY: they never enter a frame (D-WQ-18), are never published or committed (they live
    under _local), and the dataset zip is uploaded to fal's storage for the training run only.
    Left out on purpose: THE-6's left half (the RAINBOW lettering in the pool), THE-1's label boxes (cropped around
    them), THE-7 + fb2-* + fb3-* (the developer's INTERIOR looks: Eliran chose the existing tour style over them on
    2026-11-01 16:40, memory.md section 6), the fb-* reel crops (blurred video frames teach blur), kling-* (our outputs).
  6 rectilinear crops of 3 of the tour's own panoramas (02-kitchen, 04-living, 07-bedroom-main; Habait's GPT Image 2.5
    output on Habait's clay): the INTERIOR look Eliran chose (limestone, cream boucle, travertine, bulthaup-like
    sand-grey lacquer).

The trainer: fal-ai/qwen-image-2512-trainer ($0.0015 / step, 2026-11-02 pricing API), 1000 steps = $1.50. Why not
the card's Flux.2 Klein trainer (fal-ai/flux-2-klein-9b-base-trainer, $0.0043 / step): the A/B model of candidate C is
Qwen-Image-Edit-2511, a Klein LoRA cannot load into Qwen, and fal's Qwen-Image-Edit-2511 trainer is deprecated (its
edit trainers also need before/after PAIRS, which do not exist for the developer renders). A Qwen-Image LoRA shares
the MMDiT layer names with Qwen-Image-Edit, so fal-ai/qwen-image-edit-2511/lora loads it.

  train.py --dataset          build images + captions + manifest.json (rights per file) + dataset.zip; no network
  train.py --train [--cap 40] upload the zip and train (ledgered before/after in ledger-B2.json; skips when lora.json exists)
"""
import argparse
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ab  # noqa: E402

REF = ab.ROOT / "Habait/studio/_local/projects/apt846-rainbow-tlv/intake/reference-site"
TRAIN = ab.OUT / "train"
IMGS = TRAIN / "images"
ENDPOINT = "fal-ai/qwen-image-2512-trainer"
STEPS = 1000
USD_PER_STEP = 0.0015
DEV_RIGHTS = ("Israel Canada (developer), public marketing render from rainbowtlv.com, all rights reserved; "
              "internal look training only, never in a frame, never published (D-WQ-18)")
TOUR_RIGHTS = "Habait (own output: GPT Image 2.5 on Habait's clay, fal/OpenAI terms assign outputs to the user)"

# (file, crop box x0,y0,x1,y1 in the 1056x696 original or None, caption body)
DEV = [
    ("THE-1.jpg", (440, 90, 840, 696), "aerial architectural render of a tall twisting white residential tower with "
     "curved white balconies and hanging plants, the sea and a striped power-station chimney behind, clear blue sky"),
    ("THE-2.jpg", None, "architectural render of a twisting white residential tower at sunset over the sea, warm light "
     "on its curved balconies, a rooftop pool on the podium in front"),
    ("THE-3.png", (0, 0, 640, 696), "street-level architectural render of white boutique residential buildings with "
     "curved white balcony slabs, glass railings, planted terraces and palm trees, soft daylight"),
    ("THE-3.png", (520, 0, 1056, 696), "street-level architectural render of the base of a twisting white residential "
     "tower behind white boutique buildings with planted balconies and palm trees, soft daylight"),
    ("THE-8.png", None, "close architectural render of white curved balconies with perforated white organic-pattern "
     "screens, floor-to-ceiling glazing and planters, pale blue sky"),
    ("THE-6.jpg", (520, 280, 1056, 696), "architectural render of a rooftop terrace with a turquoise pool, white "
     "loungers, a bar and perforated white balcony screens, palm planters, soft daylight"),
    ("THE-6.jpg", (430, 0, 1056, 300), "architectural render of planted white podium roofs with palm trees and a "
     "glass pavilion, a white city skyline beyond, soft daylight"),
]
ROOM = {"02-kitchen": "an open kitchen and dining area", "04-living": "a living room",
        "07-bedroom-main": "a main bedroom"}
TOUR_CAPTION = ("interior photograph of {room} in a luxury apartment, large pale limestone floor slabs, warm off-white "
                "plaster walls, cream boucle upholstery, travertine and sand-grey matte lacquer, slim black window "
                "frames, sheer linen curtains, soft natural daylight")


def build_dataset():
    IMGS.mkdir(parents=True, exist_ok=True)
    rows = []
    for i, (name, box, cap) in enumerate(DEV):
        src = REF / name
        f = IMGS / f"dev-{i + 1:02d}-{Path(name).stem}.png"
        if not f.exists():
            im = Image.open(src).convert("RGB")
            if box:
                im = im.crop(box)
            im.save(f)
        rows.append({"file": f.name, "source": f"intake/reference-site/{name}" + (f" crop {list(box)}" if box else ""),
                     "source_sha256": ab.sha_file(src), "rights": DEV_RIGHTS, "kind": "developer render (exterior)",
                     "caption": f"{ab.TRIGGER}, {cap}"})
    for spec in ab.TOUR_CROPS:
        f = ab.tour_crop(spec, IMGS)
        name, uc, brel, pitch, hfov = spec
        rows.append({"file": f.name, "source": f"Habait/tour360/apartments/apt846/panos/balanced/{name}.webp "
                     f"rectilinear u {uc} pitch {pitch} hfov {hfov}",
                     "source_sha256": ab.sha_file(ab.TOUR / f"{name}.webp"), "rights": TOUR_RIGHTS,
                     "kind": "tour panorama crop (interior)",
                     "caption": f"{ab.TRIGGER}, " + TOUR_CAPTION.format(room=ROOM[name])})
    for r in rows:
        (IMGS / (Path(r["file"]).stem + ".txt")).write_text(r["caption"], encoding="utf-8")
        im = Image.open(IMGS / r["file"])
        r["size"] = list(im.size)
        r["sha256"] = ab.sha_file(IMGS / r["file"])
    z = TRAIN / "dataset.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for r in rows:
            zf.write(IMGS / r["file"], r["file"])
            zf.write(IMGS / (Path(r["file"]).stem + ".txt"), Path(r["file"]).stem + ".txt")
    man = {"card": 12, "trigger": ab.TRIGGER, "images": rows, "zip": str(z), "zip_sha256": ab.sha_file(z),
           "left_out": {
               "THE-6.jpg left half": "RAINBOW lettering in the pool (reference-site/README: never copy)",
               "THE-1.jpg outside the crop": "Hebrew label boxes burned into the render",
               "THE-7.png, fb2-*, fb3-*": "the developer's interior looks; Eliran chose the tour style over them (2026-11-01 16:40)",
               "fb-*-mid/low": "blurred frames of a contractor reel",
               "kling-*, web-*": "our own outputs / third-party Commons photos, not the developer's look"}}
    (TRAIN / "manifest.json").write_text(json.dumps(man, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"[dataset] {len(rows)} images ({sum(1 for r in rows if r['kind'].startswith('developer'))} developer, "
          f"{sum(1 for r in rows if r['kind'].startswith('tour'))} tour) -> {z} ({z.stat().st_size // 1024} KB)")
    return z


def train(cap):
    lj = TRAIN / "lora.json"
    if lj.exists():
        print(f"[train] skip (exists): {lj}")
        return True
    z = TRAIN / "dataset.zip"
    if not z.exists():
        build_dataset()
    if not ab.probe():
        return False
    usd = round(STEPS * USD_PER_STEP, 4)
    args = {"image_data_url": "@zip", "steps": STEPS, "learning_rate": 0.0005}

    def on_result(res):
        url = (res.get("diffusers_lora_file") or {}).get("url")
        if not url:
            return None
        data = ab.download(url)
        local = TRAIN / "lora.safetensors"
        if data:
            local.write_bytes(data)
        out = {"endpoint": ENDPOINT, "steps": STEPS, "learning_rate": 0.0005, "cost": usd,
               "diffusers_lora_file": res.get("diffusers_lora_file"), "config_file": res.get("config_file"),
               "local_file": str(local) if data else None, "local_sha256": ab.sha_file(local) if data else None,
               "dataset_zip_sha256": ab.sha_file(z), "trigger": ab.TRIGGER}
        lj.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
        return {"output_sha256": out["local_sha256"], "lora_url": url}

    res = ab.fal_run("train", ENDPOINT, args, {"@zip": z}, usd, f"card 12 LoRA training ({STEPS} steps, 13 images)",
                     cap=cap, timeout_s=5400, on_result=on_result, out_file=TRAIN / "lora.safetensors")
    return res is not None and lj.exists()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", action="store_true")
    ap.add_argument("--train", action="store_true")
    ap.add_argument("--cap", type=float, default=ab.CAP_USD)
    a = ap.parse_args()
    if a.cap > ab.CAP_USD:
        sys.exit(f"cap {a.cap} is above the card's ${ab.CAP_USD:.0f}")
    if a.dataset:
        build_dataset()
        sys.exit(0)
    if a.train:
        try:
            sys.exit(0 if train(a.cap) else 1)
        except ab.Exhausted as e:
            print(f"fal balance exhausted: {e}")
            sys.exit(3)
    ap.print_help()
    sys.exit(2)


if __name__ == "__main__":
    main()

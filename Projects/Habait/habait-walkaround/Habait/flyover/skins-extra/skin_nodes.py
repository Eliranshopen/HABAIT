"""skin_nodes.py - GPT Image 2.5 skins for the extra ring-B exterior nodes (lane C, 2026-11-02). PAID: $1.20 per call.

  python -X utf8 -I skin_nodes.py [--only node-rb045,...] [--cap 10.80] [--dry] [--no-redo]

A Python port of studio/_local/ext_nodes.mjs for ONE node type: the endpoint, prompt template, `where` text, reference images,
size, quality, --fit crop and the edge-retention rule (upper half < 0.85 -> one strict redo) are copied from the call that made
tour360/apartments/apt846/_local/panos-ext/node-b-tower.png (ext_nodes.mjs, node-b-tower, --clay renders/clay-pano-ortho).
One addition (REPORT.md "colours": colour mismatch between nodes): the node-b skin is passed as a look reference, with one
sentence asking for its colour grade; everything else in the prompt is the node-b prompt verbatim.
  prompt v1 (first call, node-rb045): the WHOLE node-b equirect as image 2 -> GPT copied node-b's framing (podium, tower position,
  horizon), upper-half edge retention 0.643: FAILED, kept as node-rb045.first.png. A full panorama of a neighbouring node must
  never be a reference.
  prompt v2 (all later calls): a 1000x1200 crop of node-b-tower.png around the tower (refs/node-b-tower.crop.png: tower, sky,
  sea, ground colours; no 360 layout to copy) as the LAST image, and the strict wording of ext_nodes.mjs on every call.

Input  skins-extra/clay-pano/<node>.png (4096x2048, render_shots.py kind pano + cube2equi.py, same scene/flags as the studio nodes)
Output skins-extra/<node>.png (3840x1920) + .raw.png (as returned) + .url + .json (request, scores). Existing outputs are skipped.
Ledger skins-extra/ledger.json, append-only: a "before" row (est_usd counted) BEFORE each submit, a "submitted" row with the
fal request_id, an "after" row with the outcome. The running total is the sum of est_usd over "before" rows (a failed call
counts as spent); a call that would take it past --cap is not made. FAL_KEY is read from habait-walkaround/.env by name.
"""
import argparse, json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
LEDGER = HERE + "/ledger.json"
ENDPOINT = "openai/gpt-image-2.5/sunburst/edit"
PRICE = 1.20
SIZE = (3840, 1920)
REFS_DIR = "C:/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/intake/reference-site"
NODE_B_SKIN = "C:/Habait/habait-walkaround/Habait/tour360/apartments/apt846/_local/panos-ext/node-b-tower.png"
# node-b-tower's refs in ext_nodes.mjs: [REF_TOWER, THE1, ...WEB.slice(0, 1)]
REFS = [REFS_DIR + "/kling-tower.png", REFS_DIR + "/THE-1.jpg", REFS_DIR + "/web-sdedov_reading_cc0.jpg"]
# ext_nodes.mjs NODES['node-b-tower'].where, verbatim
WHERE = ("in the air a few dozen metres from the Rainbow tower, which fills a large part of the view: a stack of white, softly "
         "undulating curved balcony slabs with planters and frameless glass railings, floor-to-ceiling glazing with slim dark "
         "mullions; the sea, the chimney and the city around")
NODE_B_CROP = HERE + "/refs/node-b-tower.crop.png"   # node-b-tower.png[250:1450, 1450:2450]
PROMPT_V = 2
COLOUR_REF = (" The last image is a crop of the finished panorama of this same flight, taken from another point around the tower: "
              "match exactly its colour grade, white balance, exposure, sky and sea colour and the tower's materials.")
STRICT = " \u2014 a strict in-place re-texturing, not a new picture"


def prompt(strict):
    # ext_nodes.mjs prompt(node, strict) for perFloor false, life false; COLOUR_REF inserted after the materials sentence
    return ("Image 1 is a plain grey computer render (clay) of a 360-degree equirectangular panorama (2:1; its left and right edges "
            "meet behind the camera and must continue into each other seamlessly) taken " + WHERE + ". Return the SAME equirectangular "
            "panorama as a photograph taken from EXACTLY this camera: the same projection, horizon and framing, every building, "
            "slab edge, railing, window line and the horizon exactly where image 1 draws them; the tower keeps its exact shape, "
            "height, floor count and position, nothing of it added, removed, moved or resized"
            + (STRICT if strict else "") + ". The plain grey ground of image 1 is only "
            "a placeholder: fill it with the real surroundings seen in the photographs (the sea and beach where the horizon shows "
            "water, streets, low white buildings, palms and trees, parked cars), at the same scale and perspective, without hiding "
            "or altering any building image 1 draws. The other images are photographs and renders of this very tower and place "
            "(the tower from the air and up close, aerial photographs of the coast with the Reading power station): copy their "
            "materials, colours, sky, sea, light and the look of the surroundings exactly (white curved balcony slabs with planters "
            "and small trees, frameless glass railings, floor-to-ceiling glazing with slim dark mullions, the sea, the beach, the "
            "chimney, the low white city, palms and trees). Take the tower's materials from them, never their framing."
            + COLOUR_REF + " Soft bright morning light, clear pale-blue sky, photoreal, sharp. No people, no text, no logos, no watermark.")


def ledger_rows():
    return json.load(open(LEDGER, encoding="utf-8")) if os.path.exists(LEDGER) else []


def ledger_add(row):
    rows = ledger_rows()
    rows.append(row)
    tmp = LEDGER + ".tmp"
    json.dump(rows, open(tmp, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    os.replace(tmp, LEDGER)


def spent():
    return round(sum(r.get("est_usd", 0) for r in ledger_rows() if r.get("phase") == "before"), 2)


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def scores(clay, img):
    """ext_nodes.mjs scores(): Canny edges of the clay kept in the skin (7x7 dilation), per half; an all-sky half (< 2000 edge
    px) scores 1.0; wrap seam = mean |left 4 px - right 4 px|"""
    import cv2, numpy as np
    a = cv2.imread(clay); b = cv2.imread(img); b = cv2.resize(b, (a.shape[1], a.shape[0]))
    e = lambda im: cv2.Canny(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), 60, 160)
    ea, eb = e(a), e(b); H = a.shape[0]; k = np.ones((7, 7), np.uint8)
    h = lambda e1, e2: 1.0 if (e1 > 0).sum() < 2000 else float(((e1 > 0) & (cv2.dilate(e2, k) > 0)).sum()) / max(1, float((e1 > 0).sum()))
    seam = float(np.abs(b[:, :4].astype(int) - b[:, -4:].astype(int)).mean())
    return round(h(ea[:H // 2], eb[:H // 2]), 3), round(h(ea[H // 2:], eb[H // 2:]), 3), round(seam, 1)


def fit(raw_bytes, out):
    """fal_image.py --fit: centre-crop to 2:1 and resize to exactly SIZE"""
    import cv2, numpy as np
    W, H = SIZE
    im = cv2.imdecode(np.frombuffer(raw_bytes, np.uint8), cv2.IMREAD_COLOR)
    h, w = im.shape[:2]
    if w / h > W / H:
        cw = round(h * W / H); im = im[:, (w - cw) // 2:(w - cw) // 2 + cw]
    else:
        ch = round(w * H / W); im = im[(h - ch) // 2:(h - ch) // 2 + ch]
    im = cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA)
    cv2.imencode(".png", im)[1].tofile(out)
    return f"{w}x{h} -> {W}x{H}"


def call(node, strict, cap, dry):
    clay = f"{HERE}/clay-pano/{node}.png"
    out = f"{HERE}/{node}.png"
    for p in [clay, NODE_B_CROP] + REFS:
        if not os.path.exists(p):
            sys.exit(f"missing input {p}")
    if spent() + PRICE > cap + 1e-9:
        print(f"{node}: STOP, ${spent():.2f} spent + ${PRICE:.2f} would pass the cap ${cap:.2f}")
        return None
    if dry:
        print(f"dry: {node} strict={strict} ${PRICE} images: clay + {[os.path.basename(x) for x in REFS + [NODE_B_CROP]]}")
        return None
    import fal_client, requests
    if not os.environ.get("FAL_KEY"):
        for line in open("C:/Habait/habait-walkaround/.env", encoding="utf-8"):
            if line.startswith("FAL_KEY="):
                os.environ["FAL_KEY"] = line.split("=", 1)[1].strip().strip('"')
    ledger_add({"time": now(), "phase": "before", "endpoint": ENDPOINT, "node": node, "est_usd": PRICE, "request_id": None,
                "strict": strict, "prompt_v": PROMPT_V, "running_total_usd": round(spent() + PRICE, 2), "cap_usd": cap})
    t0 = time.time()
    rid = None
    try:
        urls = [fal_client.upload_file(clay)] + [fal_client.upload_file(r) for r in REFS] + [fal_client.upload_file(NODE_B_CROP)]
        args = {"prompt": prompt(strict), "image_urls": urls, "num_images": 1, "output_format": "png",
                "image_size": {"width": SIZE[0], "height": SIZE[1]}, "quality": "high"}
        h = fal_client.submit(ENDPOINT, arguments=args)
        rid = h.request_id
        ledger_add({"time": now(), "phase": "submitted", "endpoint": ENDPOINT, "node": node, "request_id": rid})
        print(f"{node}: request {rid}", flush=True)
        result = h.get()
        url = (result.get("images") or [{}])[0].get("url")
        if not url:
            raise RuntimeError("no image url: " + json.dumps(result)[:300])
        r = None
        for attempt in range(4):
            try:
                r = requests.get(url, timeout=300)
                r.raise_for_status()
                break
            except Exception as e:  # noqa: BLE001
                print(f"download attempt {attempt + 1} failed: {e}", flush=True)
                if attempt == 3:
                    raise
                time.sleep(5 * (attempt + 1))
        open(out + ".raw.png", "wb").write(r.content)
        open(out + ".url", "w", encoding="utf-8").write(url)
        how = fit(r.content, out)
        up, lo, seam = scores(clay, out)
        secs = round(time.time() - t0)
        json.dump({"node": node, "endpoint": ENDPOINT, "request_id": rid, "strict": strict, "prompt_v": PROMPT_V, "prompt": prompt(strict),
                   "inputs": {"clay": clay, "refs": REFS, "last_ref_colour": NODE_B_CROP, "colour_ref_source": NODE_B_SKIN},
                   "settings": {"image_size": {"width": SIZE[0], "height": SIZE[1]}, "quality": "high", "fit": how},
                   "scores": {"edges_kept_upper": up, "edges_kept_lower": lo, "wrap_seam_diff": seam}, "secs": secs},
                  open(out + ".json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        ledger_add({"time": now(), "phase": "after", "endpoint": ENDPOINT, "node": node, "request_id": rid, "status": "ok",
                    "out": out, "secs": secs, "edges_kept_upper": up, "edges_kept_lower": lo, "wrap_seam": seam})
        print(f"{node}: edges kept upper {up} lower {lo}, wrap seam diff {seam}{' (strict)' if strict else ''}, {secs}s; "
              f"spent ${spent():.2f}", flush=True)
        return up
    except Exception as e:  # noqa: BLE001
        ledger_add({"time": now(), "phase": "after", "endpoint": ENDPOINT, "node": node, "request_id": rid, "status": "failed",
                    "error": str(e)[:400], "secs": round(time.time() - t0)})
        print(f"{node}: FAILED {str(e)[:400]}", flush=True)
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None)
    ap.add_argument("--cap", type=float, default=10.80)
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--no-redo", action="store_true", help="never spend a strict redo")
    ap.add_argument("--plain", action="store_true", help="first pass without the strict wording (ext_nodes.mjs default); v2 uses strict")
    a = ap.parse_args()
    nodes = [n["id"] for n in json.load(open(HERE + "/nodes-extra.json", encoding="utf-8"))["nodes"] if n["status"] == "new"]
    if a.only:
        nodes = [n for n in nodes if n in a.only.split(",")]
    # pass 1: every node once (so the cap never starves a node for another node's redo)
    for node in nodes:
        if os.path.exists(f"{HERE}/{node}.png"):
            print(f"{node}: exists, skipped")
            continue
        if call(node, not a.plain, a.cap, a.dry) is None and not a.dry and spent() + PRICE > a.cap + 1e-9:
            break
    # pass 2: ext_nodes.mjs rule, upper-half edge retention < 0.85 -> one strict redo, while the cap allows
    for node in ([] if a.no_redo or a.dry else nodes):
        meta = f"{HERE}/{node}.png.json"
        if not os.path.exists(meta) or os.path.exists(f"{HERE}/{node}.first.png"):
            continue
        up = json.load(open(meta, encoding="utf-8"))["scores"]["edges_kept_upper"]
        if up >= 0.85:
            continue
        if spent() + PRICE > a.cap + 1e-9:
            print(f"{node}: upper {up} < 0.85 but no budget for a strict redo")
            continue
        print(f"{node}: upper {up} < 0.85, strict redo (the first kept as {node}.first.png)")
        for s in ("", ".raw.png", ".url", ".json"):
            if os.path.exists(f"{HERE}/{node}.png{s}"):
                os.replace(f"{HERE}/{node}.png{s}", f"{HERE}/{node}.first.png{s}")
        if call(node, True, a.cap, a.dry) is None:     # the redo failed: keep the first
            for s in ("", ".raw.png", ".url", ".json"):
                if os.path.exists(f"{HERE}/{node}.first.png{s}"):
                    os.replace(f"{HERE}/{node}.first.png{s}", f"{HERE}/{node}.png{s}")
    print(f"done; ledger total ${spent():.2f} of cap ${a.cap:.2f}")


if __name__ == "__main__":
    main()

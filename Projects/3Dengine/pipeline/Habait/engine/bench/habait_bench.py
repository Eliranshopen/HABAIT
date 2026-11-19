"""habait_bench.py - the live model bench (card 29, E2): a new fal endpoint -> the same fixed 846 inputs on three tracks
-> the $0 gates -> a comparison page. Wraps habait-89's bench (research/fal-bench-2026-11-02, read-only) as a service.

  habait_bench.py <fal-endpoint> --tracks keyframe,flyover,pano --dry-run      what it would send and what it costs; no network
  habait_bench.py <fal-endpoint> --tracks ... --cap <usd> --i-approve          the paid run (cap <= $10 per run, card 29)
  habait_bench.py <fal-endpoint> --gates-only [--tracks ...]                   recompute the metrics of the outputs on disk ($0)
  habait_bench.py --rebuild-page --from <89's folder> --out <html>             the Hebrew comparison page from existing results ($0)
  habait_bench.py --selftest [--tracks ...]                                    the gates on clay-as-output (must PASS; $0)
  habait_bench.py --init-ledger | --list

Tracks (the fixed inputs never change, so a new model is comparable with every earlier one):
  keyframe  the Studio's clay ext-enter frame 1 (1280x720, with its id / depth passes) + 3 tour crops as look refs
            -> kf_check.py (per class: walls / glazing / doors >= 0.9) + openings_gate.py (kept >= 0.60, shift <= 2 deg)
  flyover   N clay equirect frames of the approach flight (Kaggle, card 18), one call each -> kf_check.py per frame on the
            director's view (view_hint crop, clay vs output) + temporal consistency = mean |out_t - out_t+1| over
            mean |clay_t - clay_t+1| (1.0 = the output changes exactly as much as the geometry; >> 1 = flicker)
  pano      the clay equirect of cp-living (2048x1024) -> openings_gate.py pano mode + the 360 seam metric of 89:
            score_e.py seam() (mean abs diff of the 8 leftmost vs 8 rightmost columns), loaded from 89's file

Money (card 29): a paid call needs ALL of --cap <usd> (<= the card's $10 per run), --i-approve, a run estimate within the
cap, a fal storage-token probe, and a ledger row (Habait/engine/_local/ledger-E2.json) written BEFORE the call. Without
them the run stops with exit 3 before any key is read or any file is written. The network is closed (socket guard) for
everything except an authorised run. Existing outputs are skipped (a rerun resumes). FAL_KEY is read by name from
C:/RnD/Projects/Habait/habait-walkaround/.env, never printed, and never read in --dry-run.

Exit: 0 ok, 1 a gate / call failed, 2 usage / missing input / unknown endpoint, 3 refused by the money guard.
"""
import argparse
import ast
import hashlib
import json
import math
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True                      # no __pycache__ in folders this card does not own

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import adapters  # noqa: E402

ROOT = Path("C:/RnD/Projects/Habait/habait-walkaround")
ENGINE = ROOT / "Habait" / "engine"
LOCAL = ENGINE / "_local"
BENCH_LOCAL = LOCAL / "bench"
LEDGER = LOCAL / "ledger-E2.json"
REGISTRY = HERE / "registry.json"
GATES = Path("C:/RnD/Projects/Habait/tools/bench")
B89 = Path("C:/RnD/Projects/Habait/research/fal-bench-2026-11-02")
PY = sys.executable
CARD = 29
CARD_CAP = 10.0

# ---------------------------------------------------------------- the fixed 846 inputs (read-only; hashed per run)
STUDIO = ROOT / "Habait/studio/_local/projects/apt846-rainbow-tlv"
KF_SHOT = STUDIO / "renders/clay/ext-enter"
KF_PLAN = STUDIO / "derived/plan.json"
KF_FILES = ["frame_0001.png", "camera.json", "depth_0001.exr", "depthcm_0001.png", "id_0001.png"]
TOUR_REFS = [B89 / "inputs" / f"tour-living-{y}.png" for y in ("yaw0", "yaw70", "yaw-70")]
CP = ROOT / "360walkaround/tours/apt846-furnished/renders/cp-living"
PANO_CLAY, PANO_DEPTH = CP / "pano.webp", CP / "depth.png"
PANO_PLAN = ROOT / "360walkaround/tours/apt846-furnished/plan.json"
PANO_CAMERA = "cp-living"
FLY = ROOT / "Habait/flyover/equirect/_local/segments/approach"
FLY_REFS = [B89 / "inputs" / "E_ref_aerial_f1.png", B89 / "inputs" / "E_ref_tower_f83.png"]
CROP_W, CROP_H = 1280, 720

# the 846 interior look = the existing tour style (Eliran 2026-11-01 16:40): limestone, cream boucle, travertine, bulthaup
FINISHES = (
    "large pale limestone floor slabs with no visible grout lines, matte; warm off-white plaster walls and ceiling; "
    "every plain sofa block becomes a cream boucle sofa on its own footprint, a round pale travertine coffee table, a "
    "cream boucle armchair; the kitchen is a bulthaup kitchen with handleless matte sand-grey lacquer fronts; every "
    "door is a zero-line flush door in cream, frameless, no architrave; no skirting; slim black frames on the glass, "
    "sheer linen curtains; outside the glass a sunlit terrace and a hazy Tel Aviv skyline. Soft natural daylight, "
    "photoreal, a very high-end finish. No people, no text, no logos, no watermark.")
EXTERIOR = (
    "the 39-floor tower wrapped in white undulating curved balcony slabs with planters and slim black glazing, white "
    "low buildings, the Reading power-station chimney, the Mediterranean sea and beach, palm trees, roads, bright clear "
    "morning daylight, blue sky. Photoreal, sharp, natural colours. No people, no text, no logos, no watermark.")
KEEP = ("Keep image 1 exactly as framed, change only the grey materials: every wall, ceiling line, column, glass pane, "
        "glass slider, frame and piece of furniture stays at exactly the same pixel position, size and perspective; "
        "nothing is added, removed or moved. ")
WRAP = ("It is a 360-degree equirectangular panorama (2:1): keep the same projection, the horizon at the same height, "
        "and the left and right edges must continue each other seamlessly (it wraps around). ")
PROMPTS = {
    "keyframe": {
        "edit_refs": "Image 1 is a plain computer render (a clay render) of the living room of a real apartment. " + KEEP +
                     "Images 2 to 4 are crops of this apartment's finished 360 tour: take ONLY their materials, colours "
                     "and light, never their layout. The finishes: " + FINISHES,
        "edit_text": "This is a plain computer render (a clay render) of the living room of a real apartment. " +
                     KEEP.replace("image 1", "the image") + "The finishes: " + FINISHES,
        "t2i": "Eye-level photograph of a luxury apartment living room with a full-height glass wall and sliders onto a "
               "terrace, " + FINISHES,
    },
    "pano": {
        "edit_refs": "Image 1 is a plain computer render (a clay render) of the living room of a real apartment. " + WRAP +
                     KEEP + "Images 2 to 4 are crops of this apartment's finished 360 tour: take ONLY their materials, "
                     "colours and light, never their layout. The finishes: " + FINISHES,
        "edit_text": "This is a plain computer render (a clay render) of the living room of a real apartment. " + WRAP +
                     KEEP.replace("image 1", "the image") + "The finishes: " + FINISHES,
        "t2i": "A 360-degree equirectangular panorama (2:1) of a luxury apartment living room, " + FINISHES,
    },
    "flyover": {
        "edit_refs": "Image 1 is a plain grey clay render seen from a drone approaching the Rainbow tower site on the Tel "
                     "Aviv coast. " + WRAP + "Keep image 1 exactly as framed, change only the grey materials: every drawn "
                     "building, the tower's outline and every balcony slab stay at exactly the same pixel position; "
                     "nothing is added, removed, moved or resized. Images 2 and 3 are photographs of the same tower and "
                     "site: take ONLY their materials, colours and light, never their framing. The look: " + EXTERIOR,
        "edit_text": "This is a plain grey clay render seen from a drone approaching a residential tower on the Tel Aviv "
                     "coast. " + WRAP + "Keep the image exactly as framed, change only the grey materials: every drawn "
                     "building, the tower's outline and every balcony slab stay at exactly the same pixel position. "
                     "The look: " + EXTERIOR,
        "t2i": "A 360-degree equirectangular aerial drone panorama (2:1) of a residential tower on the Tel Aviv coast: " +
               EXTERIOR,
    },
}
TRACKS = ("keyframe", "flyover", "pano")


# ---------------------------------------------------------------- the network is closed unless a spend is authorised
_REAL_CONNECT = socket.socket.connect
_REAL_CREATE = socket.create_connection
_SPEND = {"authorised": False, "run_id": None, "cap": None}


def _blocked(*a, **k):
    raise RuntimeError("habait_bench: network is closed (dry-run / gates / page / refused run)")


def network_closed():
    socket.socket.connect = _blocked
    socket.create_connection = _blocked


def network_open():
    socket.socket.connect = _REAL_CONNECT
    socket.create_connection = _REAL_CREATE


network_closed()


# ---------------------------------------------------------------- helpers
def now():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def sha_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def slug(endpoint):
    return endpoint.replace("/", "__")


def registry():
    return json.loads(REGISTRY.read_text(encoding="utf-8"))


def from_89(file, func, extra=None):
    """the function `func` of 89's script, compiled alone (89's scripts do their work at import time, so they are not
    imported). The bench reuses 89's measures verbatim instead of re-implementing them."""
    import cv2
    import numpy as np
    src = (B89 / file).read_text(encoding="utf-8")
    node = next(n for n in ast.parse(src).body if isinstance(n, ast.FunctionDef) and n.name == func)
    ns = {"np": np, "cv2": cv2, **(extra or {})}
    exec(compile(ast.Module(body=[node], type_ignores=[]), f"{B89 / file}::{func}", "exec"), ns)
    return ns[func]


SEAM_SOURCE = "research/fal-bench-2026-11-02/score_e.py::seam (mean abs diff of the 8 left vs 8 right columns)"


# ---------------------------------------------------------------- the jobs of a track
def fly_frames(n):
    cam = json.loads((FLY / "camera.json").read_text(encoding="utf-8"))
    have = sorted(int(p.stem[6:10]) for p in (FLY / "frames").glob("frame_*.png"))
    if not have:
        return [], cam
    n = max(2, min(n, len(have)))
    idx = sorted({have[round(i * (len(have) - 1) / (n - 1))] for i in range(n)})
    return idx, cam


def track_jobs(track, n_frames=6, samples=1):
    """[(job, input files {label: Path})]: the fixed inputs of a track, independent of the endpoint."""
    jobs = []
    if track == "keyframe":
        for s in range(1, samples + 1):
            job = {"track": track, "name": f"kf-s{s}", "kind": "perspective", "image": KF_SHOT / "frame_0001.png",
                   "refs": list(TOUR_REFS), "size": (1280, 720), "seed": s, "prompts": PROMPTS[track],
                   "control": {"kind": "depthcm_png", "source": KF_SHOT / "depthcm_0001.png"}}
            ins = {**{f"shot/{f}": KF_SHOT / f for f in KF_FILES}, "plan": KF_PLAN,
                   **{f"ref{i + 2}": r for i, r in enumerate(TOUR_REFS)}}
            jobs.append((job, ins))
    elif track == "pano":
        for s in range(1, samples + 1):
            job = {"track": track, "name": f"pano-s{s}", "kind": "equirect", "image": PANO_CLAY, "refs": list(TOUR_REFS),
                   "size": (2048, 1024), "seed": s, "prompts": PROMPTS[track],
                   "control": {"kind": "pano_depth24", "source": PANO_DEPTH}}
            ins = {"clay": PANO_CLAY, "depth": PANO_DEPTH, "plan": PANO_PLAN, **{f"ref{i + 2}": r for i, r in enumerate(TOUR_REFS)}}
            jobs.append((job, ins))
    elif track == "flyover":
        idx, _ = fly_frames(n_frames)
        for f in idx:
            fr = FLY / "frames" / f"frame_{f:04d}.png"
            job = {"track": track, "name": f"fly-f{f:04d}", "kind": "equirect", "image": fr, "refs": list(FLY_REFS),
                   "size": (2048, 1024), "seed": 1, "prompts": PROMPTS[track], "frame": f,
                   "control": {"kind": "clay_rgb", "source": fr}}
            ins = {"clay": fr, "camera": FLY / "camera.json", **{f"ref{i + 2}": r for i, r in enumerate(FLY_REFS)}}
            jobs.append((job, ins))
    return jobs


def run_dir(endpoint, track):
    return BENCH_LOCAL / slug(endpoint) / track


def out_path(endpoint, track, name):
    # a digit-free basename: openings_gate reads --out with cv2.VideoCapture, which turns x1.png into a SEQUENCE
    return run_dir(endpoint, track) / "out" / name / "out.png"


# ---------------------------------------------------------------- the ledger
def ledger_load():
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return None


def ledger_save(d):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(d, indent=1, ensure_ascii=True), encoding="ascii")   # ASCII: the console is cp1255


def ledger_init():
    if LEDGER.exists():
        print(f"[ledger] exists: {LEDGER} (${ledger_spent(ledger_load()):.2f} booked in {len(ledger_load()['calls'])} calls)")
        return 0
    ledger_save({"owner": "habait-4b", "card": CARD, "cap_usd": CARD_CAP, "cap_scope": "per run (--cap <= cap_usd)",
                 "approval": "a paid run needs Eliran's approval in the board session's chat (habait-1d today; see SESSIONS.md) for THAT run, then --cap --i-approve",
                 "created": now(), "calls": []})
    print(f"[ledger] created {LEDGER} cap ${CARD_CAP:.2f} per run, 0 calls")
    return 0


def ledger_spent(d, run_id=None):
    return round(sum(float(c.get("cost", 0)) for c in (d or {}).get("calls", []) if run_id is None or c.get("run_id") == run_id), 4)


def ledger_book(row):
    d = ledger_load()
    if d is None:
        raise RuntimeError("ledger missing: run --init-ledger")
    d["calls"].append(row)
    ledger_save(d)
    return len(d["calls"]) - 1


def ledger_settle(idx, **kw):
    d = ledger_load()
    d["calls"][idx].update(kw)
    ledger_save(d)


# ---------------------------------------------------------------- the one paid call (the only code that imports fal_client)
def load_key():
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("FAL_KEY="):
            os.environ["FAL_KEY"] = line.split("=", 1)[1].strip().strip('"')
            return os.environ["FAL_KEY"]
    raise SystemExit("FAL_KEY missing in .env")


def probe():
    import requests
    key = load_key()
    r = requests.post("https://rest.fal.ai/storage/auth/token?storage_type=fal-cdn-v3",
                      headers={"Authorization": f"Key {key}", "Content-Type": "application/json"}, json={}, timeout=60)
    txt = r.text[:200].replace(key, "***")
    print(f"[probe] fal storage token: HTTP {r.status_code} {'OK' if r.status_code == 200 else txt}")
    return r.status_code == 200


def fal_call(endpoint, args, files, ledger_idx, timeout_s=900):
    """refuses unless an authorised run booked THIS call's row (status started) in the ledger first."""
    if not (_SPEND["authorised"] and _SPEND["cap"] is not None):
        raise RuntimeError("fal_call without an authorised run (--cap + --i-approve + probe)")
    row = (ledger_load() or {}).get("calls", [])[ledger_idx]
    if row.get("status") != "started" or row.get("run_id") != _SPEND["run_id"]:
        raise RuntimeError("fal_call: no booked ledger row for this call")
    import fal_client

    def subst(x, urls):
        if isinstance(x, str):
            return urls.get(x, x)
        if isinstance(x, list):
            return [subst(v, urls) for v in x]
        if isinstance(x, dict):
            return {k: subst(v, urls) for k, v in x.items()}
        return x

    stage, t0 = "upload", time.time()
    urls = {k: fal_client.upload_file(str(v)) for k, v in files.items()}
    real = subst(json.loads(json.dumps(args)), urls)
    stage = "submit"
    h = fal_client.submit(endpoint, arguments=real)
    print(f"  request {h.request_id}", flush=True)
    while time.time() - t0 < timeout_s:
        st = fal_client.status(endpoint, h.request_id)
        if isinstance(st, fal_client.Completed):
            return fal_client.result(endpoint, h.request_id), h.request_id, stage
        time.sleep(5)
    raise TimeoutError(f"no result after {timeout_s} s")


def first_url(res):
    for k in ("images",):
        v = res.get(k)
        if isinstance(v, list) and v and isinstance(v[0], dict) and v[0].get("url"):
            return v[0]["url"]
    v = res.get("image")
    return v.get("url") if isinstance(v, dict) else None


def download(url):
    import base64
    import requests
    for _ in range(4):
        try:
            if url.startswith("data:"):
                return base64.b64decode(url.split(",", 1)[1])
            r = requests.get(url, timeout=300)
            r.raise_for_status()
            return r.content
        except Exception:  # noqa: BLE001
            time.sleep(5)
    return None


# ---------------------------------------------------------------- the plan: what a run would do
def plan_run(endpoint, tracks, n_frames, samples):
    reg = registry()["endpoints"]
    if endpoint not in reg:
        print(f"unknown endpoint {endpoint}: add an entry to {REGISTRY} (input keys from "
              f"https://fal.ai/api/openapi/queue/openapi.json?endpoint_id={endpoint})")
        return None
    entry = reg[endpoint]
    ad = adapters.load(endpoint, entry)
    plan = []
    for t in tracks:
        if not ad.supports(t):
            plan.append({"track": t, "skip": f"{endpoint} does not support the {t} track (registry)"})
            continue
        rows = []
        for job, ins in track_jobs(t, n_frames, samples):
            out = out_path(endpoint, t, job["name"])
            rows.append({"job": job, "inputs": ins, "out": out, "exists": out.exists(), "usd": ad.price(job),
                         "request": ad.describe(job)})
        plan.append({"track": t, "rows": rows})
    return {"endpoint": endpoint, "entry": entry, "adapter": ad, "tracks": plan}


def print_plan(p):
    ok, why = p["adapter"].available()
    pr = p["entry"]["price"]
    print(f"habait-bench DRY-RUN  endpoint {p['endpoint']}  ({p['entry']['label']}; adapter {p['entry']['adapter']})")
    print(f"price model: {json.dumps({k: v for k, v in pr.items() if k not in ('source',)})}  source: {pr.get('source')}")
    if not ok:
        print(f"adapter NOT available for a real run: {why}")
    total, missing, seen = 0.0, [], {}
    for t in p["tracks"]:
        print(f"\n== track {t['track']}")
        if t.get("skip"):
            print(f"   skipped: {t['skip']}")
            continue
        sub = 0.0
        for r in t["rows"]:
            for label, f in r["inputs"].items():
                if f not in seen:
                    seen[f] = sha_file(f) if Path(f).exists() else None
                if seen[f] is None:
                    missing.append(str(f))
            state = "EXISTS -> skip, $0" if r["exists"] else f"est ${r['usd']:.3f}"
            print(f"   call {r['job']['name']}: POST {p['endpoint']}  -> {r['out'].relative_to(ROOT).as_posix()}  [{state}]")
            print(f"      request: {json.dumps(r['request'], ensure_ascii=False, default=str)}")
            for label, f in r["inputs"].items():
                h = seen[f]
                print(f"      input {label:22s} {Path(f).as_posix()}  sha256 {h[:16] if h else 'MISSING'}")
            sub += 0 if r["exists"] else r["usd"]
        gates = {"keyframe": "kf_check.py (walls/glazing/doors >= 0.9) + openings_gate.py (kept >= 0.60, shift <= 2 deg)",
                 "flyover": "kf_check.py per frame on the view_hint crop + temporal consistency (out diff / clay diff)",
                 "pano": f"openings_gate.py --pano-cg (camera {PANO_CAMERA}) + seam: {SEAM_SOURCE}"}[t["track"]]
        print(f"   gates after the calls ($0): {gates}")
        print(f"   track {t['track']}: {sum(1 for r in t['rows'] if not r['exists'])} calls, estimated_cost ${sub:.2f}")
        total += sub
    d = ledger_load()
    print(f"\nestimated_cost_total ${total:.2f}  (card 29 cap ${CARD_CAP:.2f} per run; "
          f"{'within' if total <= CARD_CAP + 1e-9 else 'ABOVE'} the cap)")
    print(f"ledger {LEDGER.relative_to(ROOT).as_posix()}: "
          + (f"cap ${d['cap_usd']:.2f}/run, {len(d['calls'])} calls, ${ledger_spent(d):.2f} booked" if d else "not created (--init-ledger)"))
    print("network: none (socket closed); FAL_KEY: not read; spent $0")
    print(f"a real run: habait_bench.py {p['endpoint']} --tracks {','.join(t['track'] for t in p['tracks'])} "
          f"--cap <usd <= {CARD_CAP:.0f}> --i-approve   (after Eliran approves THAT run in the board session's chat (habait-1d today; see SESSIONS.md))")
    if missing:
        print(f"MISSING inputs: {sorted(set(missing))}")
        return 2
    return 0


# ---------------------------------------------------------------- the paid run
def refuse(msg):
    print(f"REFUSED (exit 3, nothing sent, ledger untouched): {msg}")
    return 3


def real_run(a, endpoint, tracks):
    # every check before any key, upload, ledger write or network
    if a.cap is None:
        return refuse("no --cap <usd>. A paid run needs --cap (<= $10, card 29) AND --i-approve; use --dry-run to see the plan")
    if not a.i_approve:
        return refuse("no --i-approve (Eliran's approval for THIS run, given in the board session's chat (habait-1d today; see SESSIONS.md))")
    if not (0 < a.cap <= CARD_CAP):
        return refuse(f"--cap {a.cap} is outside (0, {CARD_CAP}] (card 29 caps a run at ${CARD_CAP:.0f})")
    d = ledger_load()
    if d is None:
        return refuse(f"no ledger {LEDGER} (run --init-ledger first)")
    p = plan_run(endpoint, tracks, a.frames, a.samples)
    if p is None:
        return 2
    ok, why = p["adapter"].available()
    if not ok:
        return refuse(why)
    todo = [r for t in p["tracks"] if not t.get("skip") for r in t["rows"] if not r["exists"]]
    est = round(sum(r["usd"] for r in todo), 4)
    if est > a.cap + 1e-9:
        return refuse(f"the run is estimated at ${est:.2f}, above --cap ${a.cap:.2f}; drop a track or lower --frames")
    missing = [str(f) for r in todo for f in r["inputs"].values() if not Path(f).exists()]
    if missing:
        print(f"missing inputs: {sorted(set(missing))}")
        return 2
    if not todo:
        print("every output exists: no call, $0; recomputing the gates")
        return gates(endpoint, tracks, a.frames, a.samples)
    run_id = f"e2-{time.strftime('%Y%m%d-%H%M%S')}"
    _SPEND.update({"authorised": True, "run_id": run_id, "cap": float(a.cap)})
    network_open()
    if not probe():
        _SPEND["authorised"] = False
        network_closed()
        return refuse("the fal probe failed (balance locked or key refused)")
    print(f"[run {run_id}] {endpoint}: {len(todo)} calls, estimated ${est:.2f}, cap ${a.cap:.2f}")
    failed = 0
    for r in todo:
        job, out = r["job"], r["out"]
        rd = run_dir(endpoint, job["track"])
        snap = snapshot_inputs(job, r["inputs"], rd)
        files = {**p["adapter"].files(snap), **p["adapter"].prepare(snap, rd)}
        args = p["adapter"].args(snap)
        spent = ledger_spent(ledger_load(), run_id)
        if spent + r["usd"] > a.cap + 1e-9:
            print(f"[{job['name']}] REFUSED: ${spent:.2f} spent in this run + ${r['usd']:.2f} would pass --cap ${a.cap:.2f}")
            break
        ih = hashlib.sha256(json.dumps({"endpoint": endpoint, "args": args, "files": {k: sha_file(v) for k, v in files.items()}},
                                       sort_keys=True).encode()).hexdigest()
        idx = ledger_book({"ts": now(), "run_id": run_id, "model": endpoint, "track": job["track"],
                           "purpose": f"card 29 E2 bench {job['track']} {job['name']}", "cost": r["usd"], "booked_usd": r["usd"],
                           "inputs_hash": ih, "output": str(out), "status": "started"})
        t0, stage = time.time(), "upload"
        try:
            res, req_id, stage = fal_call(endpoint, args, files, idx)
        except Exception as e:  # noqa: BLE001
            msg = str(e)[:500].replace(os.environ.get("FAL_KEY", "\0"), "***")
            billed = 0.0 if stage in ("upload", "submit") or "422" in msg or "400" in msg or "xhausted" in msg else r["usd"]
            ledger_settle(idx, cost=billed, status=f"error-{stage}", error=msg, secs=round(time.time() - t0))
            print(f"[{job['name']}] FAILED at {stage}: {msg}")
            failed += 1
            if "xhausted" in msg:
                break
            continue
        url = first_url(res)
        data = download(url) if url else None
        if data is None:
            ledger_settle(idx, status="billed-no-output", secs=round(time.time() - t0), request_id=req_id)
            failed += 1
            continue
        save_png(data, out)
        sha = sha_file(out)
        (out.parent / "call.json").write_text(json.dumps({
            "endpoint": endpoint, "run_id": run_id, "args": args,
            "files": {k: {"path": str(v), "sha256": sha_file(v)} for k, v in files.items()},
            "output_sha256": sha, "result_meta": {k: v for k, v in res.items() if k not in ("images", "image")}},
            indent=1, ensure_ascii=False, default=str), encoding="utf-8")
        ledger_settle(idx, status="ok", secs=round(time.time() - t0), request_id=req_id, output_sha256=sha)
        print(f"[{job['name']}] OK {round(time.time() - t0)} s, booked ${r['usd']:.3f}; run ${ledger_spent(ledger_load(), run_id):.2f} of ${a.cap:.2f}")
    _SPEND["authorised"] = False
    network_closed()
    rc = gates(endpoint, tracks, a.frames, a.samples)
    return 1 if failed else rc


def save_png(data, out):
    from io import BytesIO

    from PIL import Image
    out.parent.mkdir(parents=True, exist_ok=True)
    Image.open(BytesIO(data)).convert("RGB").save(out)


def snapshot_inputs(job, ins, rd):
    """copy the fixed inputs of this call into the run folder (the Studio / tour may re-render later) and point the job
    at the copies; webp -> png (what every endpoint accepts)."""
    from PIL import Image
    inp = rd / "inputs"
    inp.mkdir(parents=True, exist_ok=True)
    snap = dict(job)

    def cp(src, name):
        dst = inp / name
        if not dst.exists():
            if Path(src).suffix.lower() == ".webp":
                dst = dst.with_suffix(".png")
                Image.open(src).convert("RGB").save(dst)
            else:
                shutil.copy2(src, dst)
        return dst

    if job["track"] == "keyframe":
        shot = inp / "shot"
        shot.mkdir(exist_ok=True)
        for f in KF_FILES:
            if not (shot / f).exists():
                shutil.copy2(KF_SHOT / f, shot / f)
        snap["image"] = shot / "frame_0001.png"
        snap["control"] = {"kind": "depthcm_png", "source": shot / "depthcm_0001.png"}
    elif job["track"] == "pano":
        snap["image"] = cp(PANO_CLAY, "clay.png") if not (inp / "clay.png").exists() else inp / "clay.png"
        snap["control"] = {"kind": "pano_depth24", "source": cp(PANO_DEPTH, "depth.png")}
    else:
        snap["image"] = cp(job["image"], f"clay-{job['name']}.png")
        snap["control"] = {"kind": "clay_rgb", "source": snap["image"]}
    snap["refs"] = [cp(r, f"ref{i + 2}{Path(r).suffix}") for i, r in enumerate(job["refs"])]
    return snap


# ---------------------------------------------------------------- the $0 gates
def gate_proc(args):
    return subprocess.run([PY, "-B", "-X", "utf8", *[str(x) for x in args]], capture_output=True, text=True,
                          encoding="utf-8", errors="replace", env={**os.environ, "PYTHONIOENCODING": "utf-8"})


def read_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8")) if Path(p).exists() else None


def openings_summary(rep):
    if not rep:
        return None
    items = rep.get("items") or {}
    # the bench rule on top of the gate's verdict: every door / window kept >= 0.60 AND shift <= 2 deg (the gate itself
    # also lets kept >= 0.75 pass at any shift); facade / railing keep the gate's own bounds (its fail flag)
    doorish = [s for s in items.values() if s["kind"] not in ("facade", "railing", "passage")]
    rule_ok = all(s["kept_min"] >= 0.60 and s["shift_max"] <= 2.0 for s in doorish) and         all(s["fails"] == 0 for s in items.values() if s["kind"] in ("facade", "railing"))
    return {"verdict": rep["summary"]["verdict"], "rule_doors_060_2deg": rule_ok, "judged": rep["summary"]["item_frames_judged"],
            "failed": rep["summary"]["item_frames_failed"],
            "kept_min": round(min(s["kept_min"] for s in items.values()), 3) if items else None,
            "shift_max_deg": round(max(s["shift_max"] for s in items.values()), 2) if items else None,
            "per_item": {i: {"kind": s["kind"], "kept": s["kept_min"], "shift_deg": s["shift_max"], "fail": s["fails"] > 0}
                         for i, s in items.items()}}


def kf_summary(kf):
    if not kf:
        return None
    bc = {k: v.get("clay_edges_in_keyframe") for k, v in (kf.get("by_class") or {}).items()}
    lock = [k for k in ("walls", "glazing", "doors") if k in bc]
    return {"verdict": kf["verdict"], "by_class": bc, "clay_in_out": kf["edges"]["clay_in_keyframe"],
            "out_in_clay": kf["edges"]["keyframe_in_clay"], "best_shift_deg": kf["best_shift"]["deg"],
            "classes_ge_090": bool(lock) and all((bc[k] or 0) >= 0.9 for k in lock), "reasons": kf.get("reasons")}


def gate_keyframe(base, outs, shot, plan):
    g = base / "gate"
    g.mkdir(parents=True, exist_ok=True)
    rows = {}
    for name, p in outs.items():
        kj, gj = g / f"{name}.kf.json", g / f"{name}.openings.json"
        for f in (kj, gj):
            if f.exists():
                f.unlink()                          # never read a previous run's numbers
        k = gate_proc([GATES / "kf_check.py", "--plan", plan, "--shot-dir", shot, "--keyframe", p, "--aspect-tol", "0.1",
                       "--json", kj, "--sheet", g / f"{name}.kf.png"])
        o = gate_proc([GATES / "openings_gate.py", "--plan", plan, "--shot-dir", shot, "--out", p, "--json", gj,
                       "--sheet", g / f"{name}.openings.png"])
        kf, op = kf_summary(read_json(kj)), openings_summary(read_json(gj))
        rows[name] = {"file": str(p), "sha256": sha_file(p), "kf_check": kf, "kf_exit": k.returncode,
                      "openings_gate": op, "openings_exit": o.returncode,
                      "pass": bool(kf and kf["classes_ge_090"] and op and op["verdict"] == "PASS" and op["rule_doors_060_2deg"])}
        print(f"   [keyframe {name}] kf_check {kf and kf['verdict']} by class {kf and kf['by_class']} shift "
              f"{kf and kf['best_shift_deg']} deg | openings_gate {op and op['verdict']} kept_min {op and op['kept_min']} "
              f"shift_max {op and op['shift_max_deg']} deg -> {'PASS' if rows[name]['pass'] else 'FAIL'}")
    return rows


def equi_crop(img_bgr, frame, w=CROP_W, h=CROP_H):
    """the director's view (view_hint) of one equirect flight frame as a pinhole image + its world camera."""
    import cv2
    import numpy as np
    vh = frame["view_hint"]
    rel = (vh["yaw_deg_from_plus_y_cw"] - frame["yaw_deg_from_plus_y_cw"] + 540) % 360 - 180
    hfov, pitch = float(vh["hfov_deg"]), float(vh["pitch_deg"])
    lens = 36.0 / (2 * math.tan(math.radians(hfov) / 2))
    b, p = math.radians(rel), math.radians(pitch)
    fwd = np.array([math.sin(b) * math.cos(p), math.cos(b) * math.cos(p), math.sin(p)])
    right = np.cross(fwd, [0, 0, 1.0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    f = lens / 36.0 * w
    X, Y = np.meshgrid((np.arange(w) + 0.5 - w / 2) / f, -(np.arange(h) + 0.5 - h / 2) / f)
    D = X[..., None] * right + Y[..., None] * up + fwd
    br = np.degrees(np.arctan2(D[..., 0], D[..., 1]))
    el = np.degrees(np.arctan2(D[..., 2], np.hypot(D[..., 0], D[..., 1])))
    PH, PW = img_bgr.shape[:2]
    mx = (((0.5 + br / 360.0) % 1.0) * PW - 0.5).astype(np.float32)
    my = np.clip((0.5 - el / 180.0) * PH - 0.5, 0, PH - 1).astype(np.float32)
    crop = cv2.remap(img_bgr, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_WRAP)
    Yw = math.radians(vh["yaw_deg_from_plus_y_cw"])
    pos = frame["pos"]
    look = [pos[0] + math.sin(Yw) * math.cos(p), pos[1] + math.cos(Yw) * math.cos(p), pos[2] + math.sin(p)]
    cam = {"frame": 1, "pos": pos, "look": look, "lens_mm": round(lens, 6), "sensor_mm": 36, "res": [w, h]}
    return crop, cam


def gate_flyover(base, outs, clays, cams):
    """outs / clays: {name: Path}; cams: {name: camera.json frame}."""
    import cv2
    import numpy as np
    g = base / "gate"
    g.mkdir(parents=True, exist_ok=True)
    empty = g / "no-openings.plan.json"
    # the flight is 200-500 m from the tower: one apartment's openings are sub-pixel, so kf_check judges edges + shift only
    empty.write_text(json.dumps({"note": "card 29: flyover kf_check without openings", "openings": [], "panes": []}), encoding="utf-8")
    rows, eq_o, eq_c = {}, [], []
    for name in sorted(outs):
        o = cv2.imread(str(outs[name]))
        c = cv2.imread(str(clays[name]))
        o = cv2.resize(o, (c.shape[1], c.shape[0]), interpolation=cv2.INTER_AREA)
        shot = g / name / "shot"
        shot.mkdir(parents=True, exist_ok=True)
        cc, cam = equi_crop(c, cams[name])
        oc, _ = equi_crop(o, cams[name])
        cv2.imwrite(str(shot / "frame_0001.png"), cc)
        (shot / "camera.json").write_text(json.dumps({"frames": [cam], "made_by": "habait_bench.py equi_crop (view_hint)"}), encoding="utf-8")
        kp = g / name / "out-crop.png"
        cv2.imwrite(str(kp), oc)
        kj = g / name / "kf.json"
        if kj.exists():
            kj.unlink()
        k = gate_proc([GATES / "kf_check.py", "--plan", empty, "--shot-dir", shot, "--keyframe", kp, "--aspect-tol", "0.1",
                       "--json", kj, "--sheet", g / name / "kf.png"])
        kf = kf_summary(read_json(kj))
        rows[name] = {"file": str(outs[name]), "sha256": sha_file(outs[name]), "kf_check": kf, "kf_exit": k.returncode,
                      "pass": bool(kf and kf["verdict"] == "PASS")}
        print(f"   [flyover {name}] kf_check {kf and kf['verdict']} clay->out {kf and kf['clay_in_out']} out->clay "
              f"{kf and kf['out_in_clay']} shift {kf and kf['best_shift_deg']} deg (no id pass: no per-class numbers)")
        eq_o.append(cv2.resize(o, (1024, 512), interpolation=cv2.INTER_AREA).astype(np.float32))
        eq_c.append(cv2.resize(c, (1024, 512), interpolation=cv2.INTER_AREA).astype(np.float32))
    temporal = None
    if len(eq_o) >= 2:
        do = [float(np.abs(eq_o[i + 1] - eq_o[i]).mean()) for i in range(len(eq_o) - 1)]
        dc = [float(np.abs(eq_c[i + 1] - eq_c[i]).mean()) for i in range(len(eq_c) - 1)]
        temporal = {"pairs": [sorted(outs)[i] + ">" + sorted(outs)[i + 1] for i in range(len(do))],
                    "out_mad": [round(x, 3) for x in do], "clay_mad": [round(x, 3) for x in dc],
                    "ratio": round(float(np.mean(do)) / max(1e-6, float(np.mean(dc))), 3),
                    "definition": "mean |out_t+1 - out_t| / mean |clay_t+1 - clay_t| on the equirects at 1024x512 (RGB 0-255)"}
        print(f"   [flyover] temporal consistency ratio {temporal['ratio']} (1.0 = changes as much as the clay)")
    return rows, temporal


def gate_pano(base, outs, clay_png):
    import cv2
    seam = from_89("score_e.py", "seam")
    edge_share = from_89("score.py", "edge_share")
    g = base / "gate"
    g.mkdir(parents=True, exist_ok=True)
    clay = cv2.imread(str(clay_png))
    H, W = clay.shape[:2]
    rows = {"_clay": {"seam": seam(clay)}}
    for name, p in outs.items():
        o = cv2.resize(cv2.imread(str(p)), (W, H), interpolation=cv2.INTER_AREA)
        rs = g / f"{name}.2048.png"
        cv2.imwrite(str(rs), o)
        gj = g / f"{name}.openings.json"
        if gj.exists():
            gj.unlink()
        r = gate_proc([GATES / "openings_gate.py", "--plan", PANO_PLAN, "--pano-cg", clay_png, "--pano-out", rs,
                       "--camera", PANO_CAMERA, "--json", gj, "--sheet", g / f"{name}.openings.png"])
        op = openings_summary(read_json(gj))
        s = seam(o)
        seam_ok = s <= 1.5 * max(rows["_clay"]["seam"], 1.0)
        rows[name] = {"file": str(p), "sha256": sha_file(p), "openings_gate": op, "openings_exit": r.returncode,
                      "seam": s, "seam_clay": rows["_clay"]["seam"], "seam_ok": seam_ok, "seam_source": SEAM_SOURCE,
                      "edges_kept_upper": round(edge_share(clay[:H // 2], o[:H // 2]), 3),
                      "edges_kept_lower": round(edge_share(clay[H // 2:], o[H // 2:]), 3),
                      "pass": bool(op and op["verdict"] == "PASS" and op["rule_doors_060_2deg"] and seam_ok)}
        print(f"   [pano {name}] openings_gate {op and op['verdict']} kept_min {op and op['kept_min']} shift_max "
              f"{op and op['shift_max_deg']} deg | seam {s} (clay {rows['_clay']['seam']}; ok <= 1.5x) | edges kept "
              f"{rows[name]['edges_kept_upper']}/{rows[name]['edges_kept_lower']} -> {'PASS' if rows[name]['pass'] else 'FAIL'}")
    return rows


def gates(endpoint, tracks, n_frames, samples, root=None, label=None):
    """the metrics of the outputs on disk under <root>/<track>/out/<name>/out.png -> <root>/<track>/metrics.json."""
    import cv2  # noqa: F401
    root = root or (BENCH_LOCAL / slug(endpoint))
    allok, any_out = True, False
    for t in tracks:
        base = root / t
        jobs = track_jobs(t, n_frames, samples)
        outs = {j["name"]: base / "out" / j["name"] / "out.png" for j, _ in jobs if (base / "out" / j["name"] / "out.png").exists()}
        print(f"== gates {t}: {len(outs)}/{len(jobs)} outputs on disk under {base.relative_to(ROOT).as_posix()}")
        if not outs:
            continue
        any_out = True
        m = {"endpoint": label or endpoint, "track": t, "made": now(), "fixed_inputs": {}, "rows": None}
        if t == "keyframe":
            # a ONE-frame shot dir: openings_gate compares every frame_*.png of --shot-dir with the output, and the
            # Studio's ext-enter holds 137 frames (clay frame 50 vs a keyframe of frame 1 = a false FAIL)
            shot = base / "inputs" / "shot"
            shot.mkdir(parents=True, exist_ok=True)
            for f in KF_FILES:
                if not (shot / f).exists():
                    shutil.copy2(KF_SHOT / f, shot / f)
            m["fixed_inputs"] = {"shot": str(shot), "frame_sha256": sha_file(shot / "frame_0001.png"), "plan": str(KF_PLAN)}
            m["rows"] = gate_keyframe(base, outs, shot, KF_PLAN)
        elif t == "flyover":
            cam = json.loads((FLY / "camera.json").read_text(encoding="utf-8"))
            byf = {fr["frame"]: fr for fr in cam["frames"]}
            clays = {j["name"]: j["image"] for j, _ in jobs if j["name"] in outs}
            cams = {j["name"]: byf[j["frame"]] for j, _ in jobs if j["name"] in outs}
            m["fixed_inputs"] = {n: {"clay": str(p), "sha256": sha_file(p)} for n, p in clays.items()}
            m["rows"], m["temporal"] = gate_flyover(base, outs, clays, cams)
        else:
            clay_png = base / "inputs" / "clay.png"
            if not clay_png.exists():
                from PIL import Image
                clay_png.parent.mkdir(parents=True, exist_ok=True)
                Image.open(PANO_CLAY).convert("RGB").save(clay_png)
            m["fixed_inputs"] = {"clay": str(PANO_CLAY), "clay_sha256": sha_file(PANO_CLAY), "plan": str(PANO_PLAN)}
            m["rows"] = gate_pano(base, outs, clay_png)
        rows = {k: v for k, v in m["rows"].items() if not k.startswith("_")}
        m["pass"] = all(r["pass"] for r in rows.values())
        allok &= m["pass"]
        (base / "metrics.json").write_text(json.dumps(m, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"   track {t}: {'PASS' if m['pass'] else 'FAIL'} -> {(base / 'metrics.json').relative_to(ROOT).as_posix()}")
    if not any_out:
        print("no outputs on disk: nothing to gate")
        return 2
    return 0 if allok else 1


def selftest(tracks, n_frames):
    """$0: every track with output := its own clay. The gates must PASS, the temporal ratio must be 1.0 and the pano seam
    must equal the clay's. Proves the wiring (inputs, crops, gate flags) before any money."""
    from PIL import Image
    root = BENCH_LOCAL / "_selftest"
    for t in tracks:
        for job, _ in track_jobs(t, n_frames, 1):
            o = root / t / "out" / job["name"] / "out.png"
            o.parent.mkdir(parents=True, exist_ok=True)
            if not o.exists():
                Image.open(job["image"]).convert("RGB").save(o)
    rc = gates("selftest", tracks, n_frames, 1, root=root, label="selftest: clay as output")
    bad = []
    for t in tracks:
        m = read_json(root / t / "metrics.json") or {}
        if not m.get("pass"):
            bad.append(f"{t} did not PASS")
        if t == "flyover" and abs(((m.get("temporal") or {}).get("ratio") or 0) - 1.0) > 1e-6:
            bad.append("flyover temporal ratio != 1.0")
        if t == "pano":
            r = next((v for k, v in (m.get("rows") or {}).items() if not k.startswith("_")), {})
            if r.get("seam") != r.get("seam_clay"):
                bad.append("pano seam != clay seam")
    print(f"SELFTEST {'PASS' if not bad and rc == 0 else 'FAIL'} {bad or ''}")
    return 0 if not bad and rc == 0 else 1


# ---------------------------------------------------------------- main
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("endpoint", nargs="?", help="a fal endpoint id from registry.json")
    ap.add_argument("--tracks", default="keyframe,flyover,pano")
    ap.add_argument("--dry-run", action="store_true", help="print the calls, inputs + hashes and the estimate; no network")
    ap.add_argument("--cap", type=float, default=None, help="USD cap of THIS run (<= $10, card 29); required for a paid run")
    ap.add_argument("--i-approve", action="store_true", help="Eliran approved THIS run in the board session's chat (habait-1d today; see SESSIONS.md)")
    ap.add_argument("--frames", type=int, default=6, help="flyover: clay flight frames (evenly spaced, default 6)")
    ap.add_argument("--samples", type=int, default=1, help="keyframe / pano: samples per endpoint (default 1)")
    ap.add_argument("--gates-only", action="store_true", help="recompute the metrics of the outputs on disk ($0)")
    ap.add_argument("--rebuild-page", action="store_true", help="build the comparison page from existing results ($0)")
    ap.add_argument("--from", dest="src", default=str(B89), help="89's bench folder (read-only)")
    ap.add_argument("--out", default=str(BENCH_LOCAL / "page.html"))
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--init-ledger", action="store_true")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args(argv)
    tracks = [t.strip() for t in a.tracks.split(",") if t.strip()]
    bad = [t for t in tracks if t not in TRACKS]
    if bad:
        print(f"unknown track(s) {bad}; tracks: {', '.join(TRACKS)}")
        return 2
    if a.init_ledger:
        return ledger_init()
    if a.list:
        for ep, e in registry()["endpoints"].items():
            print(f"{ep:40s} {e['label']:40s} tracks {','.join(e['tracks'])}  price {e['price']['type']} (checked {e['price']['checked']})")
        return 0
    if a.rebuild_page:
        import page
        return page.build(Path(a.src), Path(a.out), BENCH_LOCAL, from_89, SEAM_SOURCE)
    if a.selftest:
        return selftest(tracks, min(a.frames, 3))
    if not a.endpoint:
        ap.print_help()
        return 2
    if a.gates_only:
        return gates(a.endpoint, tracks, a.frames, a.samples)
    if a.dry_run:
        p = plan_run(a.endpoint, tracks, a.frames, a.samples)
        return 2 if p is None else print_plan(p)
    return real_run(a, a.endpoint, tracks)


if __name__ == "__main__":
    sys.exit(main())

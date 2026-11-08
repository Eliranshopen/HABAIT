#!/usr/bin/env python
"""Card 35: the engine's video stage, $0 (fal is faked; no network, no money, no Blender).

  python Habait/engine/test/test_video_stage.py          exit 0 = every check passed

Checks:
  map      camera 420 -> 409: the middle real frame maps to the middle clay frame (+-1), the ends to the ends;
           anchors pass through; the camera.json of a real clip has one entry per real frame
  limits   Kling's clay limits and the price estimate ($0.094/s in+out at 720p: 7 s -> $1.32, 17 s -> $3.20)
  refuse   no HABAIT_ALLOW_SPEND -> exit 3, zero calls, a 'refused' ledger row with cost 0; over the cap -> exit 3
  spend    allowed under the cap -> exactly one call; the ledger row exists on disk ('started') WHILE the call runs and
           carries the request id; after it: status ok, cost = the estimate
  rerun    the same run again -> zero calls (stamp)
  cache    a second segment with the same (clay, refs, prompt) -> adopted from the Kling cache, zero calls
  adopt    an existing real clip -> copied at $0, frames/ + frames_lo/ for a hold track
  need     a segment without clay -> NEED in the dry-run, exit 2 (blocked) in a real run, zero calls
  manifest valid on the produced manifest; INVALID on four known-bad mutations (camera frames, role, JPEG count,
           no provenance)
  rest     rest_anchor on a synthetic pan finds the true frame (+-0.6) and FAILS a camera map that is 15 frames off;
           an unrelated reference is 'no-confident-match'
"""
from __future__ import annotations

import copy
import io
import json
import math
import os
import shutil
import sys
import tempfile
from contextlib import redirect_stdout
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE))
sys.dont_write_bytecode = True

import cv2  # noqa: E402
import numpy as np  # noqa: E402

import cli  # noqa: E402
from video import camera_map, kling_v2v, media, rest_anchor  # noqa: E402
from video import manifest as vman  # noqa: E402

FIXTURE = ENGINE / "fixtures" / "rainbow-846.project.json"
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok)))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))


# ------------------------------------------------------------------------------------------------- the fake fal
class FakeFal:
    name = "fake"

    def __init__(self, ledger_path: Path):
        self.calls, self.uploads, self.ledger_path, self.seen_started = 0, 0, ledger_path, []
        self.clay = None

    def upload(self, path):
        self.uploads += 1
        if str(path).endswith(".mp4"):
            self.clay = Path(path)
        return f"fake://{Path(path).name}"

    def submit(self, endpoint, args):
        self.calls += 1
        led = json.loads(self.ledger_path.read_text(encoding="utf-8"))       # the row must be on disk BEFORE the call
        self.seen_started.append([e for e in led["entries"] if e["status"] == "started" and e["stage"] == "video"])
        return f"req-fake-{self.calls}"

    def wait(self, endpoint, rid):
        return {"video": {"url": f"fake://out/{rid}.mp4", "file_size": 1}}

    def download(self, url, dst):
        n = media.probe(self.clay)["n_frames"] + 1                          # Kling returns N+1 frames
        media.make_test_video(dst, n, size=(704, 704), pattern="testsrc2")


def run_cli(args, env=None):
    old = {k: os.environ.get(k) for k in ("HABAIT_ALLOW_SPEND", "HABAIT_CAP_USD")}
    for k in old:
        os.environ.pop(k, None)
    os.environ.update(env or {})
    buf = io.StringIO()
    try:
        with redirect_stdout(buf):
            code = cli.main(args)
    finally:
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    return code, buf.getvalue()


def synth_camera(n, path):
    frames = [{"frame": i, "pos": [10.0 + 0.5 * i, -20.0, 15.0], "look_dir": [0.0, 1.0, -0.05], "lens_mm": 28.0,
               "sensor_mm": 36.0, "res": [704, 704]} for i in range(1, n + 1)]
    path.write_text(json.dumps({"frames": frames}), encoding="utf-8")


# ------------------------------------------------------------------------------------------------------- checks
def test_map():
    mid = camera_map.lin_map(205, 409, 1, 420)
    check("map 420->409: real 205 -> clay %.2f, within 1 of 210.5" % mid, abs(mid - 210.5) <= 1)
    check("map 420->409: ends", camera_map.lin_map(1, 409, 1, 420) == 1 and camera_map.lin_map(409, 409, 1, 420) == 420)
    check("map: anchored map passes through its anchor",
          abs(camera_map.anchored_map(66, 169, 1, 168, [(66, 91)]) - 91) < 1e-9)
    cam = {"frames": [{"frame": i, "pos": [float(i), 0.0, 10.0], "look_dir": [0.0, 1.0, 0.0], "lens_mm": 27.9841,
                       "sensor_mm": 36.0, "res": [1280, 720]} for i in range(1, 421)]}
    rc = camera_map.real_camera(cam, 409, 24.0)
    f = rc["frames"]
    check("map: real camera.json has one entry per real frame (409)", rc["n_frames"] == 409 and len(f) == 409)
    check("map: real 205 sits at clay x %.2f (+-1 of 210.5)" % f[204]["pos"][0], abs(f[204]["pos"][0] - 210.5) <= 1)
    check("map: matrix_world + fov per frame", len(f[0]["matrix_world"]) == 4 and abs(f[0]["hfov_deg"] - 65.5) < 0.01)
    m = np.array(f[100]["matrix_world"])
    check("map: matrix_world looks along local -Z (col 2 = -look_dir)", np.allclose(m[:3, 2], [0, -1, 0], atol=1e-6))


def test_limits():
    ok = kling_v2v.check_clay({"duration_s": 7.0, "fps": 24, "width": 1280, "height": 720, "bytes": 3_000_000}) == []
    bad = kling_v2v.check_clay({"duration_s": 2.0, "fps": 24, "width": 640, "height": 360, "bytes": 1})
    check("limits: 1280x720 7 s ok; 640x360 2 s refused (2 problems)", ok and len(bad) == 2, "; ".join(bad))
    e7, e17 = kling_v2v.estimate_usd(7.0), kling_v2v.estimate_usd(17.0)
    check(f"limits: estimate 7 s ${e7} / 17 s ${e17} (fal billed $1.32 / $3.20)", e7 == 1.32 and e17 == 3.20)


def test_rest():
    rng = np.random.default_rng(7)
    big = np.full((720, 3200), 128, np.uint8)
    for _ in range(900):
        x, y = int(rng.integers(0, 3150)), int(rng.integers(0, 690))
        w, h = int(rng.integers(8, 60)), int(rng.integers(8, 60))
        cv2.rectangle(big, (x, y), (x + w, y + h), int(rng.integers(0, 255)), -1)
    big = cv2.GaussianBlur(big, (3, 3), 0)
    frames = [big[:, 40 * k: 40 * k + 1280] for k in range(41)]          # a pan: frame k+1 = offset 40 k
    ref = big[:, 40 * 25 + 12: 40 * 25 + 12 + 1280]                        # the true pose: frame 26.3
    found = rest_anchor.find_rest(ref, frames)
    check(f"rest: synthetic pan, true frame 26.30, found {found['rest_real']}",
          found["confident"] and abs(found["rest_real"] - 26.3) <= 0.6)
    check("rest: gate PASSES the right map", rest_anchor.gate(found, 26)["pass"])
    bad = rest_anchor.gate(found, 11)
    check(f"rest: gate FAILS a map 15 frames off (offset {bad['offset_frames']})", not bad["pass"])
    other = np.full((720, 1280), 90, np.uint8)
    cv2.circle(other, (640, 360), 200, 200, -1)
    nf = rest_anchor.find_rest(other, frames)
    check("rest: an unrelated reference is not a confident match", not nf["confident"]
          and rest_anchor.gate(nf, 26)["status"] == "no-confident-match")


def test_stage(tmp: Path):
    proj = tmp / "proj"
    code, out = run_cli(["init", str(proj), "--from", str(FIXTURE)])
    check("stage: init a project from the Rainbow fixture", code == 0, out.strip()[:120])
    media_dir = tmp / "media"
    media_dir.mkdir()
    clay = media_dir / "clay_orbit.mp4"
    media.make_test_video(clay, 72, size=(704, 704), pattern="testsrc")     # 3.0 s, the Kling minimum
    synth_camera(72, media_dir / "camera.json")
    ref = media_dir / "ref.png"
    cv2.imwrite(str(ref), np.full((64, 64, 3), 200, np.uint8))
    real_hold = media_dir / "hold_real.mp4"
    media.make_test_video(real_hold, 73, size=(704, 704), pattern="testsrc2")
    seg = lambda sid, role, **kw: {"id": sid, "role": role, "unit": None,  # noqa: E731
                                   "clay": {"video": str(clay), "camera": str(media_dir / "camera.json")},
                                   "refs": [{"file": str(ref), "note": "the look"}], "prompt": "TEST PROMPT", **kw}
    spec = {"schema": "habait-engine/video-segments.v1", "resolution": "720p", "fps": 24, "look": {},
            "segments": [seg("orbit", "orbit"),
                         seg("hold-arc", "hold-arc", default=True, rest={"clay_frame": 36},
                             adopt={"video": str(real_hold), "cost_usd": 1.5, "by": "test"})]}
    vdir = proj / "video"
    vdir.mkdir(exist_ok=True)
    (vdir / "segments.json").write_text(json.dumps(spec), encoding="utf-8")
    ledger = proj / "ledger.json"
    fake = FakeFal(ledger)
    kling_v2v.BACKEND_FACTORY = lambda: fake
    est = kling_v2v.estimate_usd(3.0, None, "720p")

    code, out = run_cli(["run", str(proj), "--stage", "video", "--dry-run"])
    check("dry-run: exit 0, CALL with the estimate for the new clip, ADOPT for the existing one",
          code == 0 and "CALL" in out and f"${est:.2f}" in out and "ADOPT" in out and fake.calls == 0)

    code, out = run_cli(["run", str(proj), "--stage", "video"])
    led = json.loads(ledger.read_text(encoding="utf-8"))
    refused = [e for e in led["entries"] if e["unit"] == "orbit" and e["status"] == "refused"]
    check("refuse: no HABAIT_ALLOW_SPEND -> exit 3, zero calls, a refused row at $0",
          code == 3 and fake.calls == 0 and refused and refused[-1]["cost_usd"] == 0, f"exit {code}")
    check("refuse: nothing written for the refused segment", not (vdir / "orbit" / "real.mp4").exists())

    code, out = run_cli(["run", str(proj), "--stage", "video"], {"HABAIT_ALLOW_SPEND": "1", "HABAIT_CAP_USD": "0.01"})
    check("refuse: over the cap -> exit 3, zero calls", code == 3 and fake.calls == 0 and "over the cap" in out)

    code, out = run_cli(["run", str(proj), "--stage", "video"], {"HABAIT_ALLOW_SPEND": "1", "HABAIT_CAP_USD": "5"})
    led = json.loads(ledger.read_text(encoding="utf-8"))
    row = [e for e in led["entries"] if e["unit"] == "orbit"][-1]
    check("spend: allowed under the cap -> exit 0, exactly one call", code == 0 and fake.calls == 1, f"exit {code}")
    check("spend: the ledger row was on disk ('started', paid) while the call ran",
          fake.seen_started and any(e["unit"] == "orbit" and e["paid"] for e in fake.seen_started[0]))
    check(f"spend: after the call the row is ok, cost ${row['cost_usd']} = estimate ${est}, request id kept",
          row["status"] == "ok" and abs(row["cost_usd"] - est) < 1e-9 and row.get("request_id") == "req-fake-1")
    cam = json.loads((vdir / "orbit" / "camera.json").read_text(encoding="utf-8"))
    check("spend: camera.json maps the 72 clay frames onto the 73 real ones",
          cam["n_frames"] == 73 and len(cam["frames"]) == 73 and cam["frames"][-1]["clay_frame"] == 72)
    check("adopt: the existing hold clip copied at $0 with jpg/ + jpg_lo/ (73 + 73)",
          len(list((vdir / "hold-arc" / "jpg").glob("frame_*.jpg"))) == 73
          and len(list((vdir / "hold-arc" / "jpg_lo").glob("frame_*.jpg"))) == 73)
    man_path = vdir / "manifest.json"
    man = json.loads(man_path.read_text(encoding="utf-8"))
    probs = vman.validate(man, vdir)
    check("manifest: valid, roles orbit + hold-arc, hold_default hold-arc",
          not probs and [s["role"] for s in man["segments"]] == ["orbit", "hold-arc"]
          and man["hold_default"] == "hold-arc", "; ".join(probs))

    code, out = run_cli(["run", str(proj), "--stage", "video"], {"HABAIT_ALLOW_SPEND": "1", "HABAIT_CAP_USD": "5"})
    check("rerun: exit 0, zero new calls (stamps)", code == 0 and fake.calls == 1 and "SKIP" in out)

    spec["segments"].insert(1, seg("approach", "approach"))
    (vdir / "segments.json").write_text(json.dumps(spec), encoding="utf-8")
    code, out = run_cli(["run", str(proj), "--stage", "video"], {"HABAIT_ALLOW_SPEND": "1", "HABAIT_CAP_USD": "5"})
    check("cache: same (clay, refs, prompt) under another segment -> adopted from the cache, zero calls",
          code == 0 and fake.calls == 1 and "cache hit" in out and (vdir / "approach" / "real.mp4").exists())

    # known-bad manifests
    bads = []
    m1 = copy.deepcopy(man)
    m1["segments"][0]["n_frames"] += 1
    bads.append(("camera frames != n_frames", m1))
    m2 = copy.deepcopy(man)
    m2["segments"][0]["role"] = "flyby"
    bads.append(("unknown role", m2))
    m3 = copy.deepcopy(man)
    m3["segments"][1]["frames_lo"] = m3["segments"][0]["src"].rsplit("/", 1)[0] + "/"
    bads.append(("hold frames_lo without the JPEGs", m3))
    m4 = copy.deepcopy(man)
    m4["segments"][0]["source"].pop("request_id", None)
    m4["segments"][0]["source"].pop("adopted_from", None)
    bads.append(("no provenance", m4))
    for what, m in bads:
        p = vman.validate(m, vdir)
        check(f"manifest: INVALID on a known-bad input ({what})", bool(p), p[0] if p else "accepted!")

    spec["segments"].append({"id": "descend-x", "role": "descend-x", "unit": None,
                             "clay": {"video": str(media_dir / "missing.mp4"), "camera": str(media_dir / "camera.json")},
                             "refs": []})
    (vdir / "segments.json").write_text(json.dumps(spec), encoding="utf-8")
    code_d, out_d = run_cli(["run", str(proj), "--stage", "video", "--dry-run"])
    code, out = run_cli(["run", str(proj), "--stage", "video"], {"HABAIT_ALLOW_SPEND": "1", "HABAIT_CAP_USD": "5"})
    check("need: missing clay -> NEED in the dry-run, blocked (exit 2) in a real run, zero calls",
          code_d == 0 and "NEED" in out_d and "need: clay descend-x" in out_d and code == 2 and fake.calls == 1,
          f"dry {code_d}, run {code}")
    man = json.loads(man_path.read_text(encoding="utf-8"))
    check("need: the manifest lists the missing segment", any(x["id"] == "descend-x" for x in man["missing"]))
    led = json.loads(ledger.read_text(encoding="utf-8"))
    check("ledger: total spent = one call", abs(led["spent_usd"] - est) < 1e-9, f"${led['spent_usd']}")


def main():
    test_map()
    test_limits()
    test_rest()
    tmp = Path(tempfile.mkdtemp(prefix="habait-video-test-"))
    try:
        test_stage(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    n_ok = sum(ok for _, ok in RESULTS)
    print(f"test_video_stage: {n_ok}/{len(RESULTS)} ok")
    return 0 if n_ok == len(RESULTS) else 1


if __name__ == "__main__":
    sys.exit(main())

"""push_pull.py - the free Kaggle render farm for the equirect 360 flight (card 18, lane C3b, 2026-11-02).

One command renders frames of one segment of Habait/flyover/equirect/path.json with render_segments.py (card 17):

  --local      CPU Cycles here, through the portable Blender (512x256 by default; refuses if a blender.exe is running
               and falls back to --dry-run, because Blender belongs to habait-98 and one heavy run at a time)
  (default)    Kaggle: stage the private input dataset, push it (create or new version), build + push the GPU kernel,
               poll it, pull the output, unpack the frames into Habait/flyover/equirect/_local/segments/<seg>/frames/
  --pull-only  pull + unpack the output of the last pushed kernel (resume after a timeout)
  --dry-run    stage + build only (dataset folder, kernel file, the exact commands); no network, no Blender
  --batch-spec <json> | --script <py> [--blend <file>] --script-args "..." --out <frames dir>
               (card 22, additive) several Blender processes with their own embedded script and scene file in ONE GPU
               session, on a separate kernel (habait-batch-render) and an extra private dataset (habait-batch-scenes);
               card 18's dataset is reused as pushed when the files the batch reads are unchanged. Used by
               Habait/flyover/batch/batch_units.py. The default path below is unchanged.

Frames: --frames A-B is segment-local; a range that starts at 0 is read as 0-based ("0-3" = frames 1..4).

Credentials: the Kaggle CLI reads %USERPROFILE%/.kaggle/kaggle.json by itself. If KAGGLE_USERNAME/KAGGLE_KEY exist in
habait-walkaround/.env they are passed to the CLI through the child environment only. Nothing here prints, logs or writes
a credential; the dataset and the kernel carry inputs and code only.

Every run appends one line to Habait/flyover/kaggle/_local/kaggle-log.jsonl: device, frames, sec/frame, quota hours used
(the kernel's wall time), the 480-frame 4K estimate and where the frames landed.
"""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
FLY = os.path.dirname(HERE)                                 # Habait/flyover
REPO = os.path.dirname(os.path.dirname(FLY))                # habait-walkaround
LOCAL = os.path.join(HERE, "_local")
LOG = os.path.join(LOCAL, "kaggle-log.jsonl")
RENDER = os.path.join(FLY, "equirect", "render_segments.py")
PATH_JSON = os.path.join(FLY, "equirect", "path.json")
SEG_OUT = os.path.join(FLY, "equirect", "_local", "segments")
LOCAL_TEST_OUT = os.path.join(LOCAL, "local-test", "segments")
PROJ = os.path.join(REPO, "Habait", "studio", "_local", "projects", "apt846-rainbow-tlv")
BLENDER = os.environ.get("BLENDER", r"C:\RnD\Projects\Habait\tools\blender-4.5.10\blender-4.5.10-windows-x64\blender.exe")
VENV_PY = r"C:\RnD\Projects\Habait\tools\habait-venv\Scripts\python.exe"
DATASET_SLUG = "habait-equirect-inputs"
KERNEL_SLUG = "habait-equirect-render"
SEGMENTS = ("approach", "orbit", "hold-facade", "descend-846")

# what the render needs, nothing else (no developer branding / marketing refs: D-WQ-18)
INPUTS = {
    "site.glb": os.path.join(PROJ, "renders", "site3d", "site.glb"),
    "nodes.json": os.path.join(PROJ, "renders", "site3d", "nodes.json"),
    "path.json": PATH_JSON,
    "camera.json": os.path.join(FLY, "orbit", "camera.json"),
    "orbit_clay.py": os.path.join(FLY, "orbit", "orbit_clay.py"),
    "qwantani_noon_puresky_4k.hdr": os.path.join(REPO, "360walkaround", "pipeline", "probe", "probe-assets", "hdri",
                                                 "qwantani_noon_puresky_4k.hdr"),
    "orthophoto-far.png": os.path.join(PROJ, "derived", "orthophoto-far.png"),
    "orthophoto-far.png.json": os.path.join(PROJ, "derived", "orthophoto-far.png.json"),
}
REQUIRED = ("site.glb", "path.json", "camera.json", "orbit_clay.py", "qwantani_noon_puresky_4k.hdr")


def say(msg):
    print(f"[push_pull] {msg}", flush=True)


def now():
    return dt.datetime.now().isoformat(timespec="seconds")


def append_log(rec):
    os.makedirs(LOCAL, exist_ok=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    say(f"logged -> {LOG}")


def sha(path, n=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(n)
            if not b:
                break
            h.update(b)
    return h.hexdigest()[:16]


def parse_frames(spec):
    a, _, b = spec.partition("-")
    a, b = int(a), int(b or a)
    if a == 0:
        a, b = a + 1, b + 1
    if a < 1 or b < a:
        raise SystemExit(f"bad --frames {spec}")
    return a, b


# ------------------------------------------------------------------------------------------------ credentials (never shown)
def read_env_file():
    out = {}
    p = os.path.join(REPO, ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8", errors="replace"):
            m = re.match(r"\s*(KAGGLE_USERNAME|KAGGLE_KEY)\s*=\s*(.+?)\s*$", line)
            if m:
                out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return out


def kaggle_env_and_user():
    """the child env for the CLI and the account name; the key itself never leaves the env dict"""
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    dot = read_env_file()
    if dot.get("KAGGLE_USERNAME") and dot.get("KAGGLE_KEY"):
        env.update(dot)
        return env, dot["KAGGLE_USERNAME"], ".env"
    kj = os.path.join(os.path.expanduser("~"), ".kaggle", "kaggle.json")
    if os.path.exists(kj):
        user = json.load(open(kj, encoding="utf-8")).get("username")
        if user:
            return env, user, "~/.kaggle/kaggle.json"
    return None, None, None


def kaggle_cli():
    for c in (os.environ.get("KAGGLE_CLI"), shutil.which("kaggle"), r"C:\Users\elira\anaconda3\Scripts\kaggle.exe"):
        if c and os.path.exists(c):
            return [c]
    return [sys.executable, "-m", "kaggle"]


def run_cli(args, env, check=True, quiet=False):
    p = subprocess.run(kaggle_cli() + args, capture_output=True, text=True, env=env, encoding="utf-8", errors="replace")
    out = (p.stdout or "") + (p.stderr or "")
    if not quiet:
        say(f"kaggle {' '.join(args[:3])} -> rc {p.returncode}: {out.strip()[-600:]}")
    if check and p.returncode:
        raise SystemExit(f"kaggle {' '.join(args)} failed (rc {p.returncode})")
    return p.returncode, out


# ------------------------------------------------------------------------------------------------ staging
def stage_dataset(user):
    d = os.path.join(LOCAL, "dataset")
    os.makedirs(d, exist_ok=True)
    manifest = {}
    for name, src in INPUTS.items():
        if not os.path.exists(src):
            if name in REQUIRED:
                raise SystemExit(f"input missing: {src}")
            say(f"optional input missing, left out: {name}")
            continue
        dst = os.path.join(d, name)
        if os.path.exists(dst) and (os.path.getsize(dst) != os.path.getsize(src) or sha(dst) != sha(src)):
            os.remove(dst)
        if not os.path.exists(dst):
            try:
                if os.path.getsize(src) < 5_000_000:
                    raise OSError("small file: copy, so nothing here is a link into another lane's file")
                os.link(src, dst)  # big read-only assets only (glb, hdri, orthophoto)
            except OSError:
                shutil.copy2(src, dst)
        manifest[name] = {"bytes": os.path.getsize(src), "sha256_16": sha(src), "src": os.path.relpath(src, REPO)}
    meta = {"title": DATASET_SLUG, "id": f"{user}/{DATASET_SLUG}", "licenses": [{"name": "other"}],
            "description": "Habait card 18: inputs for the equirect flight render (site clay glb, camera path, HDRI CC0, far orthophoto Esri). Private."}
    json.dump(meta, open(os.path.join(d, "dataset-metadata.json"), "w", encoding="utf-8"), indent=1)
    return d, manifest


def build_kernel(user, job):
    d = os.path.join(LOCAL, "kernel")
    os.makedirs(d, exist_ok=True)
    src = open(os.path.join(HERE, "kernel_driver.py"), encoding="utf-8").read()
    src = src.replace('"__BPY_B64__"', repr(base64.b64encode(open(RENDER, "rb").read()).decode()))
    src = src.replace("__JOB__", json.dumps(job))
    open(os.path.join(d, "kernel_equirect.py"), "w", encoding="utf-8").write(src)
    meta = {"id": f"{user}/{KERNEL_SLUG}", "title": KERNEL_SLUG, "code_file": "kernel_equirect.py", "language": "python",
            "kernel_type": "script", "is_private": True, "enable_gpu": True, "enable_internet": True,
            "dataset_sources": [f"{user}/{DATASET_SLUG}"], "competition_sources": [], "kernel_sources": []}
    json.dump(meta, open(os.path.join(d, "kernel-metadata.json"), "w", encoding="utf-8"), indent=1)
    return d


# ------------------------------------------------------------------------------------------------ secret scan (counts only)
def secret_values():
    """the real credential values of this machine, for the byte scan; never printed"""
    vals = set()
    kj = os.path.join(os.path.expanduser("~"), ".kaggle", "kaggle.json")
    if os.path.exists(kj):
        k = json.load(open(kj, encoding="utf-8")).get("key")
        if k:
            vals.add(k)
    p = os.path.join(REPO, ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8", errors="replace"):
            m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$", line)
            if m and re.search(r"KEY|TOKEN|SECRET|PASSWORD", m.group(1)):
                v = m.group(2).strip().strip('"').strip("'")
                if len(v) >= 12:
                    vals.add(v)
    return vals


def scan_secrets(root=HERE):
    vals = [v.encode() for v in secret_values()]
    files = hits = 0
    for dp, _, fs in os.walk(root):
        for f in fs:
            files += 1
            data = open(os.path.join(dp, f), "rb").read()
            if any(v in data for v in vals):
                hits += 1
                say(f"SECRET VALUE FOUND in {os.path.relpath(os.path.join(dp, f), REPO)}")
    say(f"secret scan: {files} files under {os.path.relpath(root, REPO)}, {len(vals)} known secret values, {hits} hits")
    return hits


# ------------------------------------------------------------------------------------------------ local (CPU)
def blender_busy():
    try:
        p = subprocess.run(["tasklist", "/FI", "IMAGENAME eq blender.exe", "/FO", "CSV", "/NH"], capture_output=True, text=True)
        return "blender.exe" in (p.stdout or "").lower()
    except OSError:
        return False


def run_local(a):
    f0, f1 = parse_frames(a.frames)
    res = a.res or "512x256"
    out = a.out or LOCAL_TEST_OUT
    rec = {"ts": now(), "mode": "local", "segment": a.seg, "frames": f"{f0}-{f1}", "res": res, "samples": a.samples}
    if blender_busy() or a.dry_run:
        why = "blender.exe busy (habait-98 / ab run in progress)" if not a.dry_run else "--dry-run"
        say(f"local render skipped: {why}; running render_segments.py --dry-run instead")
        p = subprocess.run([VENV_PY if os.path.exists(VENV_PY) else sys.executable, RENDER, "--path", PATH_JSON,
                            "--segments", a.seg, "--frames", f"{a.seg}:{f0}-{f1}", "--res", res, "--dry-run"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        print(p.stdout[-4000:], p.stderr[-1500:], flush=True)
        m = re.search(r"checks: (\d+)/(\d+) pass", p.stdout or "")
        rec.update({"mode": "local-dry-run", "why": why, "rc": p.returncode, "checks": m.group(0) if m else None,
                    "device": None, "n_frames": 0, "sec_per_frame": None, "quota_h_used": 0.0, "frames_dir": None})
        append_log(rec)
        return p.returncode
    cmd = [BLENDER, "-b", "--factory-startup", "-P", RENDER, "--", "--glb", INPUTS["site.glb"], "--hdri",
           INPUTS["qwantani_noon_puresky_4k.hdr"], "--scene-blend", "", "--path", PATH_JSON, "--out", out,
           "--segments", a.seg, "--frames", f"{a.seg}:{f0}-{f1}", "--res", res, "--samples", str(a.samples), "--device", "CPU"]
    say("local CPU render: " + " ".join(cmd[:6]) + " ...")
    t = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    keep = [ln for ln in (p.stdout or "").splitlines() if ln.startswith(("[dev]", "[frame]", "[done]", "[segments]", "checks:", "Error", "Traceback"))]
    print("\n".join(keep[-40:]), p.stderr[-1500:], flush=True)
    log_p = os.path.join(out, "render_log.json")
    info = json.load(open(log_p, encoding="utf-8")) if os.path.exists(log_p) else {}
    fdir = os.path.join(out, a.seg, "frames")
    n = len([f for f in os.listdir(fdir) if f.startswith("frame_")]) if os.path.isdir(fdir) else 0
    rec.update({"rc": p.returncode, "device": info.get("compute", "CPU"), "n_frames_rendered": len(info.get("frames") or []),
                "n_frames": n, "first_frame_s": info.get("first_frame_s"), "sec_per_frame": info.get("steady_s_per_frame"),
                "import_s": info.get("import_s"), "wall_s": round(time.time() - t, 1), "quota_h_used": 0.0,
                "frames_dir": os.path.relpath(fdir, REPO)})
    append_log(rec)
    return p.returncode


# ------------------------------------------------------------------------------------------------ Kaggle
def wait_dataset(env, ref, timeout=1800):
    t = time.time()
    while time.time() - t < timeout:
        rc, out = run_cli(["datasets", "status", ref], env, check=False, quiet=True)
        s = out.strip().lower()
        say(f"dataset status: {s[-80:]}")
        if "ready" in s:
            return True
        if "error" in s and rc:
            return False
        time.sleep(20)
    return False


def push_dataset(env, user, d, manifest):
    ref = f"{user}/{DATASET_SLUG}"
    state = os.path.join(LOCAL, "dataset-pushed.json")
    prev = json.load(open(state, encoding="utf-8")) if os.path.exists(state) else {}
    if prev.get("manifest") == manifest:
        say(f"dataset {ref} unchanged since {prev.get('ts')}; not re-uploaded")
        return ref, prev.get("version_note", "unchanged")
    rc, out = run_cli(["datasets", "status", ref], env, check=False, quiet=True)
    if rc == 0 and "ready" in out.lower():
        run_cli(["datasets", "version", "-p", d, "-m", f"card 18 inputs {now()}", "-q"], env)
        note = "new version"
    else:
        run_cli(["datasets", "create", "-p", d, "-q"], env)
        note = "created (private)"
    if not wait_dataset(env, ref):
        raise SystemExit(f"dataset {ref} not ready")
    json.dump({"ts": now(), "ref": ref, "manifest": manifest, "version_note": note}, open(state, "w", encoding="utf-8"), indent=1)
    return ref, note


def kernel_status(env, ref):
    rc, out = run_cli(["kernels", "status", ref], env, check=False, quiet=True)
    m = re.search(r"KernelWorkerStatus\.([A-Z_]+)", out)
    if not m:
        return ("missing" if "not found" in out.lower() else "unknown"), out.strip()[-200:]
    s = m.group(1).lower()
    for k in ("complete", "error", "cancel", "running", "queued"):
        if k in s:
            return k, s
    return s, s


def push_kernel(env, kd, slot_wait):
    """kaggle kernels push exits 0 even when it refuses ("Kernel push error: ..."): read the text. When the account's
    GPU batch slots are all taken (2 per account; habait-ab's route-B kernels use the same account), wait for one."""
    t = time.time()
    while True:
        rc, out = run_cli(["kernels", "push", "-p", kd], env, check=False)
        low = out.lower()
        if rc == 0 and "error" not in low:
            return True, "pushed", round(time.time() - t)
        if "session count" in low and time.time() - t < slot_wait:
            say(f"no free GPU batch slot (other kernels of this account are running); retry in 120 s "
                f"({time.time() - t:.0f}/{slot_wait} s)")
            time.sleep(120)
            continue
        return False, out.strip()[-300:], round(time.time() - t)


def pull(env, ref, seg, run_dir):
    os.makedirs(run_dir, exist_ok=True)
    run_cli(["kernels", "output", ref, "-p", run_dir, "-o"], env)
    tars = [f for f in os.listdir(run_dir) if f == f"frames_{seg}.tar"]
    fdir = os.path.join(SEG_OUT, seg, "frames")
    n_new = 0
    if tars:
        os.makedirs(fdir, exist_ok=True)
        with tarfile.open(os.path.join(run_dir, tars[0])) as tf:
            for m in tf.getmembers():
                name = os.path.basename(m.name)
                if not m.isfile() or not re.fullmatch(r"frame_\d{4}\.(png|jpg)", name):
                    continue  # only plain frame files: never trust paths inside a downloaded archive
                with tf.extractfile(m) as src, open(os.path.join(fdir, name), "wb") as dst:
                    shutil.copyfileobj(src, dst)
                n_new += 1
    cj = os.path.join(run_dir, f"camera_{seg}.json")
    if os.path.exists(cj):
        shutil.copy(cj, os.path.join(SEG_OUT, seg, "camera.json"))
    summ_p = os.path.join(run_dir, "summary_eq.json")
    summ = json.load(open(summ_p, encoding="utf-8")) if os.path.exists(summ_p) else {}
    return fdir, n_new, summ


def estimate(spf, res, n=480, target="4096x2048"):
    if not spf:
        return None
    w, h = [int(v) for v in res.split("x")]
    tw, th = [int(v) for v in target.split("x")]
    s = spf * (tw * th) / (w * h) * n
    return {"frames": n, "res": target, "hours": round(s / 3600, 2), "assumes": "sec/frame scales with pixel count at the same spp"}


def run_kaggle(a):
    env, user, src = kaggle_env_and_user()
    if not user and not a.dry_run:
        raise SystemExit("no Kaggle credential (neither ~/.kaggle/kaggle.json nor KAGGLE_USERNAME/KAGGLE_KEY in .env): "
                         "Eliran's hand, see README-he.md; meanwhile use --local")
    user = user or "<kaggle-user>"
    f0, f1 = parse_frames(a.frames)
    res = a.res or "2048x1024"
    job = {"segment": a.seg, "frames": f"{f0}-{f1}", "res": res, "samples": a.samples, "fmt": a.fmt, "device": a.device,
           "render_timeout_s": a.render_timeout}
    d, manifest = stage_dataset(user)
    kd = build_kernel(user, job)
    kref = f"{user}/{KERNEL_SLUG}"
    say(f"dataset staged: {d} ({sum(v['bytes'] for v in manifest.values()) / 1e6:.1f} MB, {len(manifest)} files)")
    say(f"kernel built: {kd} (job {json.dumps(job)})")
    if scan_secrets(d) or scan_secrets(kd):
        raise SystemExit("refusing to push: a credential value is inside the dataset or the kernel")
    if a.dry_run:
        say(f"dry-run: would run kaggle datasets create|version -p {d}; kaggle kernels push -p {kd}; poll {kref}; pull")
        append_log({"ts": now(), "mode": "kaggle-dry-run", "segment": a.seg, "frames": job["frames"], "res": res,
                    "samples": a.samples, "inputs": manifest, "quota_h_used": 0.0})
        return 0
    say(f"credential source: {src} (account {user})")
    run_dir = os.path.join(LOCAL, "runs", f"{a.seg}_{f0}-{f1}_{res}_{dt.datetime.now():%Y%m%d-%H%M%S}")
    t_push = time.time()
    if not a.pull_only:
        ds_ref, ds_note = push_dataset(env, user, d, manifest)
        ok, why, waited = push_kernel(env, kd, a.slot_wait)
        if not ok:
            say(f"kernel not pushed: {why}")
            append_log({"ts": now(), "mode": "kaggle", "kernel": kref, "state": "not-pushed", "why": why,
                        "slot_wait_s": waited, "job": job, "quota_h_used": 0.0, "frames_dir": None})
            return 3
        say(f"kernel pushed (waited {waited} s for a GPU slot)")
        t_push = time.time()
        time.sleep(15)
        state, last = "queued", ""
        while time.time() - t_push < a.wait:
            state, last = kernel_status(env, kref)
            say(f"{time.time() - t_push:6.0f}s kernel {state}")
            if state in ("complete", "error", "cancel"):
                break
            time.sleep(30)
        if state not in ("complete", "error", "cancel"):
            say(f"still {state} after {a.wait}s; rerun with --pull-only later")
            append_log({"ts": now(), "mode": "kaggle", "kernel": kref, "state": state, "job": job, "wall_s_waited": round(time.time() - t_push)})
            return 2
    else:
        ds_ref, ds_note = f"{user}/{DATASET_SLUG}", "pull-only"
        state, last = kernel_status(env, kref)
    fdir, n_new, summ = pull(env, kref, a.seg, run_dir)
    r = (summ.get("phases") or {}).get("render") or {}
    spf = r.get("steady_s_per_frame")
    n_total = len([f for f in os.listdir(fdir) if f.startswith("frame_")]) if os.path.isdir(fdir) else 0
    wall = summ.get("wall_s")
    rec = {"ts": now(), "mode": "kaggle", "kernel": kref, "dataset": ds_ref, "dataset_note": ds_note, "state": state,
           "job": job, "gpus": summ.get("gpus"), "device": r.get("compute"), "devices": r.get("devices"),
           "denoiser": r.get("denoiser"), "import_s": r.get("import_s"), "first_frame_s": r.get("first_frame_s"),
           "sec_per_frame": spf, "render_total_s": r.get("total_s"), "n_frames_rendered": r.get("n_frames"),
           "frames_pulled": n_new, "frames_in_dir": n_total, "kernel_wall_s": wall,
           "download_extract_s": (summ.get("phases") or {}).get("download_extract_s"),
           "quota_h_used": round((wall or 0) / 3600, 3), "quota_note": "kernel script wall time; Kaggle bills the whole GPU session (boot + this)",
           "est_480_frames_4k": estimate(spf, res), "est_792_frames_4k": estimate(spf, res, 792),
           "frames_dir": os.path.relpath(fdir, REPO), "run_dir": os.path.relpath(run_dir, REPO),
           "inputs_sha256_16": {k: v["sha256_16"] for k, v in manifest.items()}}
    append_log(rec)
    say(f"{state}: {n_new} frames pulled -> {fdir}; device {r.get('compute')} {r.get('devices')}; {spf} s/frame; "
        f"kernel wall {wall} s")
    return 0 if state == "complete" and n_new else 1


# ------------------------------------------------------------------------------------------------ batch mode (card 22, additive)
# Several Blender processes in ONE Kaggle GPU session, each with its own embedded script and optional scene file (.blend
# opened with -b, or any file the args name). The default path above (one render_segments.py job) is unchanged.
# A batch spec (dict / JSON file):
#   {"kernel_slug": "habait-batch-render",
#    "scripts": {"render_cameras.py": <local path>, ...},          embedded base64 in the kernel
#    "files": {"cam_descend-836.json": <local path>, ...},         embedded gzip+base64 (small: camera rows)
#    "base_needed": ["site.glb", ...],                             files of the card 18 dataset this batch reads
#    "extra_dataset": {"slug": "habait-batch-scenes", "files": {"enter846.packed.blend": <local path>, ...}},
#    "procs": [{"name": "site-clay", "script": "render_cameras.py", "blend": "" | "{IN:<name>}", "args": [...],
#               "timeout_s": 14400, "jobs": [{"id": "descend-836", "seg_dir": "descend-836"}]}],
#    "dest": {"descend-836": <local frames dir>, ...},              where each job's frames land
#    "wait_s": 10800, "slot_wait_s": 3600, "note": "..."}
# Placeholders in "args"/"blend", resolved in the kernel: {IN:<name>} = a mounted dataset file, {SCRIPT:<name>},
# {FILE:<name>} = an embedded file written to /tmp, {OUT} = /kaggle/working/out/<proc name>, {CLAY} = orbit_clay.py
# relocated next to its far orthophoto (as the default driver does).
BATCH_KERNEL_SLUG = "habait-batch-render"
FRAME_RE = re.compile(r"frame_\d{4}\.(png|jpg)")


def png_size(path):
    """(w, h) of a PNG from its IHDR, or None"""
    try:
        with open(path, "rb") as f:
            head = f.read(24)
        if head[:8] != b"\x89PNG\r\n\x1a\n":
            return None
        return int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")
    except OSError:
        return None


def stage_named_dataset(user, slug, files, description):
    d = os.path.join(LOCAL, f"dataset-{slug}")
    os.makedirs(d, exist_ok=True)
    manifest = {}
    for name, src in files.items():
        if not os.path.exists(src):
            raise SystemExit(f"input missing: {src}")
        dst = os.path.join(d, name)
        if os.path.exists(dst) and (os.path.getsize(dst) != os.path.getsize(src) or sha(dst) != sha(src)):
            os.remove(dst)
        if not os.path.exists(dst):
            try:
                if os.path.getsize(src) < 5_000_000:
                    raise OSError("small file: copy")
                os.link(src, dst)
            except OSError:
                shutil.copy2(src, dst)
        manifest[name] = {"bytes": os.path.getsize(src), "sha256_16": sha(src), "src": os.path.relpath(src, REPO)}
    for f in os.listdir(d):
        if f not in files and f != "dataset-metadata.json":
            os.remove(os.path.join(d, f))  # only what this batch needs goes up
    meta = {"title": slug, "id": f"{user}/{slug}", "licenses": [{"name": "other"}], "description": description}
    json.dump(meta, open(os.path.join(d, "dataset-metadata.json"), "w", encoding="utf-8"), indent=1)
    return d, manifest


def push_named_dataset(env, user, slug, d, manifest):
    ref = f"{user}/{slug}"
    state = os.path.join(LOCAL, f"dataset-pushed-{slug}.json")
    prev = json.load(open(state, encoding="utf-8")) if os.path.exists(state) else {}
    if prev.get("manifest") == manifest:
        say(f"dataset {ref} unchanged since {prev.get('ts')}; not re-uploaded")
        return ref, "unchanged"
    rc, out = run_cli(["datasets", "status", ref], env, check=False, quiet=True)
    if rc == 0 and "ready" in out.lower():
        run_cli(["datasets", "version", "-p", d, "-m", f"card 22 batch inputs {now()}", "-q"], env)
        note = "new version"
    else:
        run_cli(["datasets", "create", "-p", d, "-q"], env)
        note = "created (private)"
    if not wait_dataset(env, ref):
        raise SystemExit(f"dataset {ref} not ready")
    json.dump({"ts": now(), "ref": ref, "manifest": manifest, "version_note": note}, open(state, "w", encoding="utf-8"), indent=1)
    return ref, note


def ensure_base_dataset(env, user, needed, dry_run=False):
    """card 18's dataset, reused as pushed when every file this batch reads is unchanged (path.json etc. may differ)"""
    d, manifest = stage_dataset(user)
    state = os.path.join(LOCAL, "dataset-pushed.json")
    prev = (json.load(open(state, encoding="utf-8")) if os.path.exists(state) else {}).get("manifest") or {}
    stale = [k for k in needed if k not in manifest or (prev.get(k) or {}).get("sha256_16") != manifest[k]["sha256_16"]]
    ref = f"{user}/{DATASET_SLUG}"
    if not stale:
        return ref, "reused (every batch input unchanged since the last push)", manifest
    if dry_run:
        return ref, f"would push a new version (changed: {stale})", manifest
    ref, note = push_dataset(env, user, d, manifest)
    return ref, note, manifest


def build_batch_kernel(user, spec, datasets):
    import gzip
    slug = spec.get("kernel_slug") or BATCH_KERNEL_SLUG
    d = os.path.join(LOCAL, f"kernel-{slug}")
    os.makedirs(d, exist_ok=True)
    scripts = {n: base64.b64encode(open(p, "rb").read()).decode() for n, p in (spec.get("scripts") or {}).items()}
    files = {n: base64.b64encode(gzip.compress(open(p, "rb").read(), 9)).decode() for n, p in (spec.get("files") or {}).items()}
    job = {"mode": "batch", "card": 22, "procs": spec["procs"], "note": spec.get("note", "")}
    src = open(os.path.join(HERE, "kernel_driver.py"), encoding="utf-8").read()
    src = src.replace('"__BPY_B64__"', repr(""))
    src = src.replace("__JOB__", json.dumps(job))
    src = src.replace('"__SCRIPTS_B64__"', repr(json.dumps(scripts)))
    src = src.replace('"__FILES_B64__"', repr(json.dumps(files)))
    code = os.path.join(d, "kernel_batch.py")
    open(code, "w", encoding="utf-8").write(src)
    meta = {"id": f"{user}/{slug}", "title": slug, "code_file": "kernel_batch.py", "language": "python",
            "kernel_type": "script", "is_private": True, "enable_gpu": True, "enable_internet": True,
            "dataset_sources": datasets, "competition_sources": [], "kernel_sources": []}
    json.dump(meta, open(os.path.join(d, "kernel-metadata.json"), "w", encoding="utf-8"), indent=1)
    return d, os.path.getsize(code)


def pull_batch(env, ref, run_dir, spec):
    """download the kernel output, then unpack_batch"""
    os.makedirs(run_dir, exist_ok=True)
    run_cli(["kernels", "output", ref, "-p", run_dir, "-o"], env)
    return unpack_batch(run_dir, spec)


def unpack_batch(run_dir, spec):
    """unpack frames_<job>.tar of run_dir into spec['dest'][job]. A local frame of another resolution is moved aside to
    <frames dir>-<w>x<h>/ first (never overwritten silently); only plain frame names are trusted."""
    summ_p = os.path.join(run_dir, "summary_eq.json")
    summ = json.load(open(summ_p, encoding="utf-8")) if os.path.exists(summ_p) else {}
    got = {}
    for job_id, fdir in (spec.get("dest") or {}).items():
        tar_p = os.path.join(run_dir, f"frames_{job_id}.tar")
        n_new = moved = 0
        if os.path.exists(tar_p):
            os.makedirs(fdir, exist_ok=True)
            with tarfile.open(tar_p) as tf:
                for m in tf.getmembers():
                    name = os.path.basename(m.name)
                    if not m.isfile() or not FRAME_RE.fullmatch(name):
                        continue
                    dst = os.path.join(fdir, name)
                    tmp = dst + ".pull"
                    with tf.extractfile(m) as src, open(tmp, "wb") as out:
                        shutil.copyfileobj(src, out)
                    old, new = png_size(dst) if os.path.exists(dst) else None, png_size(tmp)
                    if old and new and old != new:
                        aside = f"{fdir.rstrip(os.sep)}-{old[0]}x{old[1]}"
                        os.makedirs(aside, exist_ok=True)
                        os.replace(dst, os.path.join(aside, name))
                        moved += 1
                    os.replace(tmp, dst)
                    n_new += 1
        got[job_id] = {"frames_pulled": n_new, "moved_aside": moved, "frames_dir": os.path.relpath(fdir, REPO)}
    return summ, got


def gpu_quota_used_h(env):
    """the account's weekly GPU hours used (kaggle quota, CLI >= 2.2.5); None if unavailable. 0.01 h resolution"""
    rc, out = run_cli(["quota"], env, check=False, quiet=True)
    m = re.search(r"^GPU\s+([0-9.]+)h\s+([0-9.]+)h\s+([0-9.]+)h", out, re.M)
    return (float(m.group(1)), float(m.group(2)), float(m.group(3))) if m else None


def run_batch(spec, dry_run=False):
    """push (datasets if changed, the batch kernel), poll, pull; returns a result dict (also one line in kaggle-log.jsonl)"""
    env, user, src = kaggle_env_and_user()
    if not user and not dry_run:
        raise SystemExit("no Kaggle credential: see README-he.md")
    user = user or "<kaggle-user>"
    slug = spec.get("kernel_slug") or BATCH_KERNEL_SLUG
    kref = f"{user}/{slug}"
    base_ref, base_note, base_manifest = ensure_base_dataset(env, user, spec.get("base_needed") or [], dry_run=dry_run)
    datasets = [base_ref]
    extra = spec.get("extra_dataset") or {}
    extra_ref, extra_note = None, None
    if extra.get("files"):
        ed, emanifest = stage_named_dataset(user, extra["slug"], extra["files"],
                                            "Habait card 22: scene files for the batch render (enter846 packed scene, the 846 "
                                            "ceiling lights). Private. No developer branding.")
        if scan_secrets(ed):
            raise SystemExit("refusing to push: a credential value is inside the batch dataset")
        extra_ref = f"{user}/{extra['slug']}"
        datasets.append(extra_ref)
    kd, code_bytes = build_batch_kernel(user, spec, datasets)
    if scan_secrets(kd):
        raise SystemExit("refusing to push: a credential value is inside the batch kernel")
    n_jobs = sum(len(p.get("jobs") or []) for p in spec["procs"])
    say(f"batch kernel built: {kd} ({code_bytes / 1e3:.0f} kB, {len(spec['procs'])} Blender processes, {n_jobs} jobs; "
        f"datasets {datasets})")
    if dry_run:
        say(f"dry-run: base dataset {base_note}; would push {extra_ref or '(no extra dataset)'}, kaggle kernels push -p {kd}; "
            f"poll {kref}; pull")
        return {"state": "dry-run", "kernel": kref, "kernel_dir": kd, "datasets": datasets, "base_dataset": base_note}
    say(f"credential source: {src} (account {user})")
    if extra_ref:
        extra_ref, extra_note = push_named_dataset(env, user, extra["slug"], ed, emanifest)
    run_dir = os.path.join(LOCAL, "runs", f"batch_{dt.datetime.now():%Y%m%d-%H%M%S}")
    q0 = gpu_quota_used_h(env)
    say(f"GPU quota before: {q0} (used, remaining, total h)")
    ok, why, waited = push_kernel(env, kd, spec.get("slot_wait_s", 3600))
    if not ok:
        say(f"batch kernel not pushed: {why}")
        rec = {"ts": now(), "mode": "kaggle-batch", "kernel": kref, "state": "not-pushed", "why": why, "slot_wait_s": waited,
               "quota_h_used": 0.0, "frames_dir": None}
        append_log(rec)
        return rec
    t_push = time.time()
    time.sleep(15)
    state = "queued"
    while time.time() - t_push < spec.get("wait_s", 3 * 3600):
        state, _ = kernel_status(env, kref)
        say(f"{time.time() - t_push:6.0f}s batch kernel {state} ({now()})")
        if state in ("complete", "error", "cancel"):
            break
        time.sleep(20)
    elapsed = round(time.time() - t_push)
    if state not in ("complete", "error", "cancel"):
        say(f"still {state} after {elapsed}s; rerun later (frames on disk are skipped, the pull resumes)")
        rec = {"ts": now(), "mode": "kaggle-batch", "kernel": kref, "state": state, "elapsed_s": elapsed, "quota_h_used": None}
        append_log(rec)
        return rec
    summ, got = pull_batch(env, kref, run_dir, spec)
    procs = summ.get("procs") or []
    wall = summ.get("wall_s")
    q1 = gpu_quota_used_h(env)
    say(f"GPU quota after: {q1}")
    rec = {"ts": now(), "mode": "kaggle-batch", "kernel": kref, "datasets": datasets, "base_dataset": base_note,
           "extra_dataset": extra_note, "state": state, "gpus": summ.get("gpus"),
           "download_extract_s": (summ.get("phases") or {}).get("download_extract_s"),
           "procs": [{k: p.get(k) for k in ("name", "rc", "wall_s", "compute", "devices", "denoiser", "import_s", "first_frame_s",
                                             "steady_s_per_frame", "total_s", "n_frames", "res", "samples")} for p in procs],
           "jobs": got, "kernel_wall_s": wall, "push_to_complete_s": elapsed,
           "quota_h_used": round((wall if wall is not None else elapsed) / 3600, 3),
           "quota_note": "kernel script wall time (push_to_complete_s when the run left no summary, e.g. cancelled); Kaggle bills "
                         "the whole GPU session; quota_before/after = kaggle quota (used, remaining, total h; 0.01 h resolution)",
           "quota_before": q0, "quota_after": q1, "ended_at": now(),
           "run_dir": os.path.relpath(run_dir, REPO),
           "inputs_sha256_16": {k: v["sha256_16"] for k, v in base_manifest.items() if k in (spec.get("base_needed") or [])}}
    append_log(rec)
    say(f"batch {state}: " + ", ".join(f"{k} {v['frames_pulled']}" for k, v in got.items()) + f"; kernel wall {wall} s")
    return rec


def spec_from_cli(a):
    """--script/--blend sugar: one Blender process with an embedded script and a scene file (card 20's enter command)"""
    if not a.script or not a.out:
        raise SystemExit("--script needs --out <local frames dir> (and usually --blend, --script-args, --job-id)")
    sname = os.path.basename(a.script)
    extra = {}
    blend_tok = ""
    if a.blend:
        bname = os.path.basename(a.blend)
        extra = {"slug": a.extra_dataset, "files": {bname: os.path.abspath(a.blend)}}
        blend_tok = "{IN:%s}" % bname if bname.endswith(".blend") else ""
    files, args = {}, []
    for tok in (a.script_args or "").split():
        if tok.startswith("@file:"):
            p = os.path.abspath(tok[6:])
            files[os.path.basename(p)] = p
            args.append("{FILE:%s}" % os.path.basename(p))
        else:
            args.append(tok)
    job_id = a.job_id or os.path.splitext(sname)[0]
    return {"kernel_slug": a.kernel_slug or BATCH_KERNEL_SLUG, "scripts": {sname: os.path.abspath(a.script)}, "files": files,
            "base_needed": [], "extra_dataset": extra,
            "procs": [{"name": job_id, "script": sname, "blend": blend_tok, "args": args, "timeout_s": a.render_timeout,
                       "jobs": [{"id": job_id, "seg_dir": a.seg_dir or job_id}]}],
            "dest": {job_id: os.path.abspath(a.out)}, "wait_s": a.wait, "slot_wait_s": a.slot_wait}


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--seg", default="approach", choices=SEGMENTS)
    p.add_argument("--frames", default="1-48", help="segment-local A-B; a range starting at 0 is 0-based")
    p.add_argument("--res", default="", help="default 512x256 with --local, 2048x1024 on Kaggle")
    p.add_argument("--samples", type=int, default=128)
    p.add_argument("--fmt", default="PNG", choices=["PNG", "JPEG"])
    p.add_argument("--device", default="auto", help="auto = OptiX then CUDA then CPU")
    p.add_argument("--local", action="store_true")
    p.add_argument("--out", default="", help="--local output root (default Habait/flyover/kaggle/_local/local-test/segments)")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--pull-only", action="store_true")
    p.add_argument("--wait", type=int, default=3 * 3600, help="max seconds to poll the kernel")
    p.add_argument("--render-timeout", type=int, default=4 * 3600)
    p.add_argument("--slot-wait", type=int, default=3600, help="max seconds to wait for a free Kaggle GPU batch slot")
    p.add_argument("--scan-secrets", action="store_true", help="byte-scan Habait/flyover/kaggle for this machine's real key values")
    # card 22 (additive): batch mode / another script and scene in the same farm
    p.add_argument("--batch-spec", default="", help="JSON batch spec (see 'batch mode' above): several jobs in one GPU session")
    p.add_argument("--script", default="", help="embed this Blender script instead of render_segments.py (batch mode, one process)")
    p.add_argument("--blend", default="", help="scene file uploaded in --extra-dataset; a .blend is opened with -b")
    p.add_argument("--script-args", default="", help="args after '--'; placeholders {IN:x} {OUT} {CLAY}; @file:<path> embeds a file")
    p.add_argument("--job-id", default="")
    p.add_argument("--seg-dir", default="", help="the folder under {OUT} whose frames/ the job writes (default = job id)")
    p.add_argument("--kernel-slug", default="", help=f"batch kernel slug (default {BATCH_KERNEL_SLUG}; card 18's kernel is untouched)")
    p.add_argument("--extra-dataset", default="habait-batch-scenes")
    a = p.parse_args()
    if a.scan_secrets:
        sys.exit(1 if scan_secrets() else 0)
    if a.batch_spec or a.script:
        spec = json.load(open(a.batch_spec, encoding="utf-8")) if a.batch_spec else spec_from_cli(a)
        rec = run_batch(spec, dry_run=a.dry_run)
        sys.exit(0 if rec.get("state") in ("complete", "dry-run") else 1)
    if a.local and a.samples == 128:
        a.samples = 16
    sys.exit(run_local(a) if a.local else run_kaggle(a))


if __name__ == "__main__":
    main()

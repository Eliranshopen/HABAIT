# Kaggle kernel (GPU T4 x2 / P100, internet on) for the equirect 360 flight (card 18, lane C3b).
# Built into _local/kernel/kernel_equirect.py by ../push_pull.py: render_segments.py (Habait/flyover/equirect, card 17) is
# inlined as base64 below and the job (segment, frames, resolution, samples) as JSON. No credential is ever written here:
# the kernel reads only its private input dataset and writes only /kaggle/working.
#
# Pattern reused from habait-ab's route A driver (Habait/flyover/cloud/A-blender-cycles/kernel_a_driver.py, read-only):
# the same Blender 4.5.10 linux tarball, the same live echo of the [dev]/[frame]/[done] lines (Kaggle keeps no
# /kaggle/working output for a cancelled run, only the log) and the same summary json. The renderer differs:
# render_segments.py takes --path/--orbit-camera/--orbit-clay/--hdri and not orbit_render.py's --camera-json/--sun_*.
import base64, glob, json, os, shutil, subprocess, tarfile, time

T0 = time.time()
JOB = json.loads(r'''__JOB__''')
BPY_B64 = "__BPY_B64__"
WORK = "/kaggle/working"
TMP = "/tmp/habait_eq"
BLENDER_URL = "https://download.blender.org/release/Blender4.5/blender-4.5.10-linux-x64.tar.xz"
SUMMARY = {"card": 18, "job": JOB, "phases": {}}
os.makedirs(TMP, exist_ok=True)
# card 22 (additive): batch mode payloads, filled by push_pull.py build_batch_kernel; unused by the default path
SCRIPTS_B64 = "__SCRIPTS_B64__"
FILES_B64 = "__FILES_B64__"


def save_summary():
    SUMMARY["wall_s"] = round(time.time() - T0, 1)
    json.dump(SUMMARY, open(os.path.join(WORK, "summary_eq.json"), "w"), indent=1)


def sh(cmd, check=True):
    print(f"$ {cmd[:300]}", flush=True)
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(p.stdout[-1500:], p.stderr[-1500:], flush=True)
    if check and p.returncode:
        save_summary()
        raise SystemExit(f"failed: {cmd}")
    return p


def stream(cmd, timeout):
    """run and echo the [tagged] lines live, so a cancelled session still shows how far it got"""
    print(f"$ {cmd[:400]}", flush=True)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    tail = []
    t = time.time()
    for line in p.stdout:
        tail = (tail + [line])[-80:]
        if line.startswith(("[dev]", "[frame]", "[done]", "[denoise]", "[segments]", "  [PASS]", "  [FAIL]", "checks:",
                            "Error", "Traceback", "RuntimeError", "SystemExit")):
            print(f"{time.time() - T0:7.1f}s {line.rstrip()}", flush=True)
        if time.time() - t > timeout:
            p.kill()
            print("TIMEOUT", flush=True)
            break
    rc = p.wait()
    if rc:
        print("".join(tail), flush=True)
    return rc


def find(name):
    hits = sorted(glob.glob(f"/kaggle/input/**/{name}", recursive=True))
    return hits[0] if hits else None


def run_batch_mode():
    """card 22: several Blender processes in this one GPU session. Each process = an embedded script + an optional scene
    (-b <file.blend>) + args with placeholders; each of its jobs leaves frames_<job id>.tar in /kaggle/working."""
    import gzip, re, shlex
    SUMMARY["card"] = 22
    sh("nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv; nproc; free -g | head -2", check=False)
    SUMMARY["gpus"] = sh("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader", check=False).stdout.strip().splitlines()
    scripts, files = json.loads(SCRIPTS_B64), json.loads(FILES_B64)
    spath, fpath = {}, {}
    os.makedirs(f"{TMP}/scripts", exist_ok=True)
    os.makedirs(f"{TMP}/files", exist_ok=True)
    for n, b in scripts.items():
        spath[n] = f"{TMP}/scripts/{n}"
        open(spath[n], "wb").write(base64.b64decode(b))
    for n, b in files.items():
        fpath[n] = f"{TMP}/files/{n}"
        open(fpath[n], "wb").write(gzip.decompress(base64.b64decode(b)))
    print("batch scripts:", sorted(spath), "files:", sorted(fpath), flush=True)
    # orbit_clay.py next to its far orthophoto, as the default path does
    clay = None
    src_clay = find("orbit_clay.py")
    if src_clay:
        root = f"{TMP}/repo/Habait"
        os.makedirs(f"{root}/flyover/orbit", exist_ok=True)
        clay = f"{root}/flyover/orbit/orbit_clay.py"
        shutil.copy(src_clay, clay)
        ortho, ortho_meta = find("orthophoto-far.png"), find("orthophoto-far.png.json")
        if ortho and ortho_meta:
            d = f"{root}/studio/_local/projects/apt846-rainbow-tlv/derived"
            os.makedirs(d, exist_ok=True)
            for src in (ortho, ortho_meta):
                dst = os.path.join(d, os.path.basename(src))
                if not os.path.exists(dst):
                    os.symlink(src, dst)
    t = time.time()
    sh(f"cd {TMP} && wget -q {BLENDER_URL} -O b.tar.xz && tar -xf b.tar.xz && rm b.tar.xz")
    bl = glob.glob(f"{TMP}/blender-4.5*/blender")[0]
    SUMMARY["phases"]["download_extract_s"] = round(time.time() - t, 1)
    if sh(f"{bl} -b --factory-startup --version | head -1", check=False).returncode:
        sh("apt-get -qq update && apt-get -qq install -y libxrender1 libxi6 libxkbcommon0 libsm6 libxxf86vm1 libxfixes3 libgl1 libegl1 >/dev/null", check=False)

    def resolve(tok, out):
        def one(m):
            kind, _, name = m.group(1).partition(":")
            if kind == "OUT":
                return out
            if kind == "CLAY":
                if not clay:
                    raise KeyError("orbit_clay.py not mounted")
                return clay
            if kind == "IN":
                p = find(name)
                if not p:
                    raise KeyError(f"dataset file not mounted: {name}")
                return p
            if kind == "SCRIPT":
                return spath[name]
            if kind == "FILE":
                return fpath[name]
            return m.group(0)
        return re.sub(r"\{(OUT|CLAY|IN:[^}]+|SCRIPT:[^}]+|FILE:[^}]+)\}", one, tok)

    frame_re = re.compile(r"frame_\d{4}\.(png|jpg)$")
    SUMMARY["procs"] = []
    for proc in JOB["procs"]:
        out = f"{WORK}/out/{proc['name']}"
        os.makedirs(out, exist_ok=True)
        rec = {"name": proc["name"], "script": proc["script"]}
        try:
            args = [resolve(x, out) for x in proc.get("args", [])]
            blend = resolve(proc.get("blend", ""), out)
            script = spath[proc["script"]]
        except KeyError as e:
            rec.update({"rc": -1, "error": str(e)})
            SUMMARY["procs"].append(rec)
            save_summary()
            print("PROC SKIPPED", proc["name"], e, flush=True)
            continue
        cmd = (f"{bl} -b {shlex.quote(blend) + ' ' if blend else ''}--factory-startup -P {shlex.quote(script)} -- "
               + " ".join(shlex.quote(x) for x in args))
        t = time.time()
        rc = stream(cmd, proc.get("timeout_s", 4 * 3600))
        rec.update({"rc": rc, "wall_s": round(time.time() - t, 1)})
        jobs = proc.get("jobs") or []
        logp = os.path.join(out, "render_log.json")
        if not os.path.exists(logp) and jobs:
            logp = os.path.join(out, jobs[0]["seg_dir"], "render_log.json")
        info = json.load(open(logp)) if os.path.exists(logp) else {}
        for k in ("compute", "devices", "denoiser", "first_frame_s", "steady_s_per_frame", "import_s", "total_s", "res", "samples"):
            rec[k] = info.get(k)
        rec["n_frames"] = len(info.get("frames") or [])
        rec["jobs"] = {}
        for j in jobs:
            fdir = os.path.join(out, j["seg_dir"], "frames")
            frames = sorted(f for f in glob.glob(os.path.join(fdir, "frame_*")) if frame_re.search(os.path.basename(f)))
            if frames:
                with tarfile.open(f"{WORK}/frames_{j['id']}.tar", "w") as tf:
                    for f in frames:
                        tf.add(f, arcname=os.path.basename(f))
                shutil.rmtree(fdir, ignore_errors=True)
            jl = os.path.join(out, j["seg_dir"], "render_log.json")
            if os.path.exists(jl):
                shutil.copy(jl, f"{WORK}/render_log_{j['id']}.json")
            rec["jobs"][j["id"]] = {"frames_out": len(frames)}
        if os.path.exists(os.path.join(out, "render_log.json")):
            shutil.copy(os.path.join(out, "render_log.json"), f"{WORK}/render_log_{proc['name']}.json")
        shutil.rmtree(out, ignore_errors=True)
        SUMMARY["procs"].append(rec)
        save_summary()
        print("PROC", json.dumps(rec), flush=True)
    save_summary()
    print("SUMMARY", json.dumps(SUMMARY), flush=True)


if JOB.get("mode") == "batch":
    run_batch_mode()
    raise SystemExit(0)


sh("nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv; nproc; free -g | head -2", check=False)
gpu = sh("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader", check=False).stdout.strip().splitlines()
SUMMARY["gpus"] = gpu
IN = {k: find(v) for k, v in {"glb": "site.glb", "path": "path.json", "camera": "camera.json", "clay": "orbit_clay.py",
                               "hdri": "qwantani_noon_puresky_4k.hdr", "nodes": "nodes.json",
                               "ortho": "orthophoto-far.png", "ortho_meta": "orthophoto-far.png.json"}.items()}
print("inputs:", json.dumps(IN), flush=True)
SUMMARY["inputs"] = IN
missing = [k for k in ("glb", "path", "camera", "clay", "hdri") if not IN[k]]
if missing:
    save_summary()
    raise SystemExit(f"inputs not mounted: {missing}")

# orbit_clay.py finds its far orthophoto relative to its own file (Habait/studio/_local/projects/apt846-rainbow-tlv/
# derived/orthophoto-far.png): rebuild that layout under /tmp so the far ground matches the local clay
ROOT = f"{TMP}/repo/Habait"
os.makedirs(f"{ROOT}/flyover/orbit", exist_ok=True)
CLAY = f"{ROOT}/flyover/orbit/orbit_clay.py"
shutil.copy(IN["clay"], CLAY)
if IN["ortho"] and IN["ortho_meta"]:
    d = f"{ROOT}/studio/_local/projects/apt846-rainbow-tlv/derived"
    os.makedirs(d, exist_ok=True)
    for k in ("ortho", "ortho_meta"):
        dst = os.path.join(d, os.path.basename(IN[k]))
        if not os.path.exists(dst):
            os.symlink(IN[k], dst)

t = time.time()
sh(f"cd {TMP} && wget -q {BLENDER_URL} -O b.tar.xz && tar -xf b.tar.xz && rm b.tar.xz")
BL = glob.glob(f"{TMP}/blender-4.5*/blender")[0]
SUMMARY["phases"]["download_extract_s"] = round(time.time() - t, 1)
if sh(f"{BL} -b --factory-startup --version | head -1", check=False).returncode:
    sh("apt-get -qq update && apt-get -qq install -y libxrender1 libxi6 libxkbcommon0 libsm6 libxxf86vm1 libxfixes3 libgl1 libegl1 >/dev/null", check=False)
SCRIPT = f"{TMP}/render_segments.py"
open(SCRIPT, "w").write(base64.b64decode(BPY_B64).decode())

OUT = f"{WORK}/segments"
seg = JOB["segment"]
extra = f"--nodes-json {IN['nodes']}" if IN["nodes"] else "--no-far-ortho"
cmd = (f"{BL} -b --factory-startup -P {SCRIPT} -- --glb {IN['glb']} --out {OUT} --path {IN['path']} "
       f"--orbit-camera {IN['camera']} --orbit-clay {CLAY} --hdri {IN['hdri']} --scene-blend '' {extra} "
       f"--segments {seg} --frames {seg}:{JOB['frames']} --res {JOB['res']} --samples {JOB['samples']} "
       f"--fmt {JOB['fmt']} --device {JOB['device']}")
t = time.time()
rc = stream(cmd, JOB.get("render_timeout_s", 4 * 3600))
log = os.path.join(OUT, "render_log.json")
info = json.load(open(log)) if os.path.exists(log) else {"error": rc}
info["wall_s"] = round(time.time() - t, 1)
SUMMARY["phases"]["render"] = {k: info.get(k) for k in ("compute", "devices", "denoiser", "first_frame_s", "steady_s_per_frame",
                                                         "import_s", "total_s", "wall_s", "error", "res", "samples")}
SUMMARY["phases"]["render"]["n_frames"] = len(info.get("frames") or [])
SUMMARY["rc"] = rc

# one tar for the pull (one download instead of one per frame); camera.json + render_log.json stay loose too
frames_dir = os.path.join(OUT, seg, "frames")
frames = sorted(glob.glob(os.path.join(frames_dir, "frame_*")))
SUMMARY["frames_out"] = len(frames)
if frames:
    with tarfile.open(f"{WORK}/frames_{seg}.tar", "w") as tf:
        for f in frames:
            tf.add(f, arcname=os.path.basename(f))
    shutil.rmtree(frames_dir)
    shutil.copy(os.path.join(OUT, seg, "camera.json"), f"{WORK}/camera_{seg}.json")
    if os.path.exists(log):
        shutil.copy(log, f"{WORK}/render_log.json")
for other in glob.glob(os.path.join(OUT, "*")):
    if os.path.isdir(other):
        shutil.rmtree(other, ignore_errors=True)
save_summary()
print("SUMMARY", json.dumps(SUMMARY), flush=True)

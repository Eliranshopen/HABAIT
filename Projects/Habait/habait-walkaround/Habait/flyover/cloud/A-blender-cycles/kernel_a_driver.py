# Kaggle kernel (GPU T4 x2, internet on) for route A: Blender 4.5 LTS Cycles on the orbit camera path.
# Built into kaggle/kernel_a.py by ../build_kernels.py (the bpy script is inlined as base64 below).
# v4: Blender output is streamed live into the kernel log (runs 2 and 3 were cancelled mid-render and Kaggle keeps no
# /kaggle/working output for a cancelled run, only the log), and the job is kept short: 6 GPU proof frames from
# flyover/orbit/camera.json + 1 CPU frame for the GPU-vs-CPU number. MODE=full renders all 252 frames instead.
import base64, glob, json, os, shutil, subprocess, sys, time

T0 = time.time()
MODE = "__MODE__"
WORK = "/kaggle/working"
TMP = "/tmp/habait_a"
os.makedirs(TMP, exist_ok=True)
BPY_B64 = "__BPY_B64__"
BLENDER_URL = "https://download.blender.org/release/Blender4.5/blender-4.5.10-linux-x64.tar.xz"
SUMMARY = {"route": "A-blender-cycles", "mode": MODE, "phases": {}}


def save_summary():
    SUMMARY["wall_s"] = round(time.time() - T0, 1)
    json.dump(SUMMARY, open(os.path.join(WORK, "summary_a.json"), "w"), indent=1)


def sh(cmd, check=True):
    print(f"$ {cmd[:300]}", flush=True)
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(p.stdout[-1500:], p.stderr[-1500:], flush=True)
    if check and p.returncode:
        raise SystemExit(f"failed: {cmd}")
    return p


def stream(cmd, timeout):
    """run and echo the [tagged] lines live, so a cancelled session still shows how far it got"""
    print(f"$ {cmd[:300]}", flush=True)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    tail = []
    t = time.time()
    for line in p.stdout:
        tail = (tail + [line])[-60:]
        if line.startswith(("[dev]", "[calib]", "[frame]", "[done]", "[denoise]", "Error", "Traceback", "RuntimeError")):
            print(f"{time.time() - T0:7.1f}s {line.rstrip()}", flush=True)
        if time.time() - t > timeout:
            p.kill()
            print("TIMEOUT", flush=True)
            break
    rc = p.wait()
    if rc:
        print("".join(tail), flush=True)
    return rc


sh("nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv; nproc; free -g | head -2")
glb = (glob.glob("/kaggle/input/**/site.glb", recursive=True) or [None])[0]
camj = (glob.glob("/kaggle/input/**/camera.json", recursive=True) or [None])[0]
print("glb:", glb, "camera:", camj, flush=True)
if not glb or not camj:
    raise SystemExit("inputs not mounted")

t = time.time()
sh(f"cd {TMP} && wget -q {BLENDER_URL} -O b.tar.xz && tar -xf b.tar.xz && rm b.tar.xz")
BL = glob.glob(f"{TMP}/blender-4.5*/blender")[0]
SUMMARY["phases"]["download_extract_s"] = round(time.time() - t, 1)
if sh(f"{BL} -b --factory-startup --version | head -1", check=False).returncode:
    sh("apt-get -qq update && apt-get -qq install -y libxrender1 libxi6 libxkbcommon0 libsm6 libxxf86vm1 libxfixes3 libgl1 libegl1 >/dev/null", check=False)
open(f"{TMP}/orbit_render.py", "w").write(base64.b64decode(BPY_B64).decode())
LIGHT = "--sun_elev 30 --sun_az 140"  # morning: ~09:30 early November, Tel Aviv


def render(out, extra, label, timeout):
    t = time.time()
    rc = stream(f"{BL} -b --factory-startup -P {TMP}/orbit_render.py -- --glb {glb} --camera-json {camj} --out {out} {LIGHT} {extra}", timeout)
    log = os.path.join(out, "render_log.json")
    info = json.load(open(log)) if os.path.exists(log) else {"error": rc}
    info["wall_s"] = round(time.time() - t, 1)
    SUMMARY["phases"][label] = {k: info.get(k) for k in ("compute", "devices", "denoiser", "exposure", "first_frame_s", "steady_s_per_frame", "import_s", "total_s", "wall_s", "error", "replaced_slots", "frames")}
    save_summary()
    return info


if MODE == "proof":
    # 1. GPU: 6 frames spread over the orbit segment (1..168 of 252), 1280x720, 128 spp, adaptive, OIDN denoise
    proof = f"{WORK}/proof"
    info = render(proof, "--look dev --samples 128 --frames 1,34,68,101,135,168", "gpu_proof_128spp", 1800)
    for f in glob.glob(f"{proof}/_calib*.png"):
        os.remove(f)
    exposure = info.get("exposure")
    # 2. CPU (4 vCPU Kaggle): the same frame 1, same exposure, for the GPU-vs-CPU number
    if exposure is not None:
        render(f"{TMP}/cpu", f"--look dev --samples 128 --frames 1 --device CPU --exposure {exposure}", "cpu_frame1_128spp", 1500)
        if os.path.exists(f"{TMP}/cpu/f0001.png"):
            shutil.copy(f"{TMP}/cpu/f0001.png", f"{WORK}/cpu_f0001.png")
else:
    # full path: 252 frames at 128 spp -> mp4 (+ the clay at 16 spp as the control video for routes B/C)
    FF = shutil.which("ffmpeg")
    if not FF:
        sh("pip -q install imageio-ffmpeg", check=False)
        import imageio_ffmpeg
        FF = imageio_ffmpeg.get_ffmpeg_exe()
    full = f"{TMP}/full"
    info = render(full, "--look dev --samples 128 --frames 1-252 --fmt JPEG", "gpu_full_252_128spp", 3 * 3600)
    if glob.glob(f"{full}/f*.jpg"):
        sh(f"{FF} -y -v error -framerate 24 -pattern_type glob -i '{full}/f*.jpg' -c:v libx264 -pix_fmt yuv420p -crf 16 {WORK}/orbit_cycles_128spp.mp4")
        os.makedirs(f"{WORK}/samples", exist_ok=True)
        for f in (1, 64, 127, 190, 252):
            if os.path.exists(f"{full}/f{f:04d}.jpg"):
                shutil.copy(f"{full}/f{f:04d}.jpg", f"{WORK}/samples/")
save_summary()
print("SUMMARY", json.dumps(SUMMARY), flush=True)

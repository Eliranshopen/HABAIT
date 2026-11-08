# Kaggle kernel (GPU T4 x2, internet on) for route B2: Wan2.1-VACE-1.3B depth-controlled video on the clay cut.
# Built into kaggle/kernel_b2.py by ../build_kernels.py (helper scripts inlined as base64).
import base64, glob, json, os, shutil, subprocess, time

T0 = time.time()
WORK = "/kaggle/working"
TMP = "/tmp/habait_b2"
os.makedirs(TMP, exist_ok=True)
FILES = __FILES__  # name -> base64
for name, b64 in FILES.items():
    open(os.path.join(TMP, name), "w").write(base64.b64decode(b64).decode())
SUMMARY = {"route": "B2-wan21-vace13b", "phases": {}}
PROMPTS = __PROMPTS__
json.dump(PROMPTS, open(os.path.join(TMP, "prompts.json"), "w"), indent=1)


def save():
    SUMMARY["wall_s"] = round(time.time() - T0, 1)
    json.dump(SUMMARY, open(os.path.join(WORK, "summary_b2.json"), "w"), indent=1)


def sh(cmd, check=True, label=None, tail=4000):
    t = time.time()
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    dt = time.time() - t
    print(f"$ {cmd[:300]}  [{dt:.0f}s rc={p.returncode}]\n{p.stdout[-tail:]}{p.stderr[-tail:]}", flush=True)
    if label:
        SUMMARY["phases"][label] = round(dt, 1)
        save()
    if check and p.returncode:
        save()
        raise SystemExit(f"failed: {cmd[:200]}")
    return p


sh("nvidia-smi --query-gpu=name,memory.total --format=csv; free -g | head -2")
inp = {k: (glob.glob(f"/kaggle/input/**/{k}", recursive=True) or [None])[0] for k in ("clay_5s.mp4", "kf_first.png", "ref_aerial.png")}
print("inputs", inp, flush=True)
sh("pip -q install -U diffusers transformers accelerate huggingface_hub hf_transfer ftfy sentencepiece imageio imageio-ffmpeg 2>&1 | tail -3",
   check=False, label="pip_s")
sh("python -c 'import torch,diffusers,transformers;print(torch.__version__,diffusers.__version__,transformers.__version__);"
   "from diffusers import WanVACEPipeline;print(\"imports ok\")'", label="import_s")
sh("HF_HUB_ENABLE_HF_TRANSFER=1 python -c \"from huggingface_hub import snapshot_download as s; "
   "print(s('Wan-AI/Wan2.1-VACE-1.3B-diffusers'))\"", label="download_s")
PREP = f"{TMP}/prep"
sh(f"python {TMP}/prep_control.py --clay {inp['clay_5s.mp4']} --kf {inp['kf_first.png']} --ref {inp['ref_aerial.png']} "
   f"--size 848x480 --frames 81 --out {PREP}", label="prep_s")
OUT = f"{TMP}/out"
sh(f"timeout 20000 python {TMP}/run_vace.py --prep {PREP} --prompts {TMP}/prompts.json --out {OUT} --variants v1,v2",
   check=False, label="infer_s", tail=12000)
os.makedirs(f"{WORK}/b2", exist_ok=True)
for f in glob.glob(f"{OUT}/*.mp4") + glob.glob(f"{OUT}/*.json"):
    shutil.copy(f, f"{WORK}/b2/")
for f in ("clay.mp4", "depth.mp4", "prep.json", "kf.png", "ref.png"):
    if os.path.exists(f"{PREP}/{f}"):
        shutil.copy(f"{PREP}/{f}", f"{WORK}/b2/ctrl_{f}")
try:
    import cv2
    for mp4 in glob.glob(f"{WORK}/b2/v*.mp4"):
        cap = cv2.VideoCapture(mp4)
        n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        for t in (0, n // 3, 2 * n // 3, n - 1):
            cap.set(cv2.CAP_PROP_POS_FRAMES, t)
            ok, fr = cap.read()
            if ok:
                cv2.imwrite(mp4[:-4] + f"_f{t:03d}.jpg", fr, [cv2.IMWRITE_JPEG_QUALITY, 92])
except Exception as e:  # noqa: BLE001
    print("sample frames failed", e)
if os.path.exists(f"{OUT}/run_log.json"):
    SUMMARY["runs"] = json.load(open(f"{OUT}/run_log.json")).get("runs")
save()
print("SUMMARY", json.dumps(SUMMARY), flush=True)

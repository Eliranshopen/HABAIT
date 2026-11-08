# Kaggle kernel (GPU T4 x2, internet on) for route B1: Wan2.2-Fun-5B-Control video-to-video on the 5 s clay cut.
# Built into kaggle/kernel_b1.py by ../build_kernels.py (helper scripts inlined as base64).
import base64, glob, json, os, shutil, subprocess, sys, time

T0 = time.time()
WORK = "/kaggle/working"
TMP = "/tmp/habait_b1"
os.makedirs(TMP, exist_ok=True)
FILES = __FILES__  # name -> base64
for name, b64 in FILES.items():
    open(os.path.join(TMP, name), "w").write(base64.b64decode(b64).decode())
REPO = "/tmp/VideoX-Fun"
MODEL = "/tmp/models/Wan2.2-Fun-5B-Control"
SUMMARY = {"route": "B1-wan22-fun5b-control", "phases": {}}
PROMPTS = __PROMPTS__
json.dump(PROMPTS, open(os.path.join(TMP, "prompts.json"), "w"), indent=1)


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


def save():
    SUMMARY["wall_s"] = round(time.time() - T0, 1)
    json.dump(SUMMARY, open(os.path.join(WORK, "summary_b1.json"), "w"), indent=1)


sh("nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv; df -h /tmp /kaggle/working | tail -2; free -g | head -2")
sh("python -c 'import torch,diffusers,transformers;print(torch.__version__,torch.version.cuda,diffusers.__version__,transformers.__version__)'", check=False)
inp = {k: (glob.glob(f"/kaggle/input/**/{k}", recursive=True) or [None])[0] for k in ("clay_5s.mp4", "kf_first.png", "ref_aerial.png")}
print("inputs", inp, flush=True)

# 1. code + deps (keep Kaggle's torch)
sh(f"git clone -q --depth 1 https://github.com/aigc-apps/VideoX-Fun {REPO} && cd {REPO} && git log -1 --format='%H %cI'", label="clone_s")
sh("pip -q install -U diffusers transformers accelerate huggingface_hub hf_transfer 2>&1 | tail -3", check=False, label="pip_s")
sh("pip -q install omegaconf einops ftfy sentencepiece safetensors timm tomesd torchdiffeq torchsde func_timeout librosa "
   "'imageio[ffmpeg]' imageio-ffmpeg av 2>&1 | tail -3", check=False, label="pip2_s")
sh(f"cd {REPO} && python -c 'import torch,diffusers,transformers;print(torch.__version__,diffusers.__version__,transformers.__version__);"
   "from videox_fun.models import Wan2_2Transformer3DModel, WanT5EncoderModel, AutoencoderKLWan3_8;"
   "from videox_fun.pipeline import Wan2_2FunControlPipeline;print(\"imports ok\")'", label="import_s")

# 2. weights (Apache-2.0): 10 GB DiT + 11 GB umT5 + 2.8 GB VAE
sh("HF_HUB_ENABLE_HF_TRANSFER=1 python -c \"from huggingface_hub import snapshot_download as s; "
   f"s('alibaba-pai/Wan2.2-Fun-5B-Control', local_dir='{MODEL}')\" && du -sh {MODEL}", label="download_s")

# 3. control inputs at 1280x704, 121 frames
PREP = f"{TMP}/prep"
sh(f"python {TMP}/prep_control.py --clay {inp['clay_5s.mp4']} --kf {inp['kf_first.png']} --ref {inp['ref_aerial.png']} "
   f"--size 1280x704 --frames 121 --out {PREP}", label="prep_s")

# 4. stage 1: prompt embeddings (umT5 fp16 on the second T4), then the process exits and frees 11 GB of RAM
sh(f"python {TMP}/t5_embed.py --repo {REPO} --model {MODEL} --prompts {TMP}/prompts.json --out {TMP}/embeds.pt", label="t5_s")

# 5. stage 2: the three variants
OUT = f"{TMP}/out"
p = sh(f"cd {REPO} && timeout 25000 python {TMP}/run_fun5b.py --repo {REPO} --model {MODEL} --embeds {TMP}/embeds.pt "
       f"--prep {PREP} --out {OUT} --variants v1,v3,v2 --steps 30", check=False, label="infer_s", tail=12000)

# 6. collect: mp4s, 4 sample frames each, control previews, logs
os.makedirs(f"{WORK}/b1", exist_ok=True)
for f in glob.glob(f"{OUT}/*.mp4") + glob.glob(f"{OUT}/*.json"):
    shutil.copy(f, f"{WORK}/b1/")
for f in ("clay.mp4", "depth.mp4", "canny.mp4", "prep.json", "kf.png", "ref.png"):
    if os.path.exists(f"{PREP}/{f}"):
        shutil.copy(f"{PREP}/{f}", f"{WORK}/b1/ctrl_{f}")
try:
    import cv2
    for mp4 in glob.glob(f"{WORK}/b1/v*.mp4"):
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

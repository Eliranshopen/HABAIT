"""Route B2: Wan2.1-VACE-1.3B (Apache-2.0) via diffusers WanVACEPipeline, fp16 on one T4.

python run_vace.py --prep PREPDIR --prompts prompts.json --out OUT --variants v1,v2
Native 480p: 848x480, 81 frames = clay frames 0..80 at 24 fps (3.4 s), seed 43, 30 steps, UniPC flow_shift 3.
  v1_depth_kf0   frame 0 = GPT keyframe (mask black = keep), frames 1..80 = depth control (mask white = generate)
  v2_depth_ref   all frames = depth control, reference_images = crop of the skinned aerial 360 pano (zero new spend)
"""
import argparse, gc, json, os, time

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import cv2
import numpy as np
import torch
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--prep", required=True)
ap.add_argument("--prompts", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--variants", default="v1,v2")
ap.add_argument("--steps", type=int, default=30)
ap.add_argument("--cfg", type=float, default=5.0)
ap.add_argument("--frames", type=int, default=81)
ap.add_argument("--model", default="Wan-AI/Wan2.1-VACE-1.3B-diffusers")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
from diffusers import AutoencoderKLWan, UniPCMultistepScheduler, WanVACEPipeline  # noqa: E402
from diffusers.utils import export_to_video  # noqa: E402

T0 = time.time()
log = {"args": vars(a), "runs": {}}
vae = AutoencoderKLWan.from_pretrained(a.model, subfolder="vae", torch_dtype=torch.float32)
pipe = WanVACEPipeline.from_pretrained(a.model, vae=vae, torch_dtype=torch.float16)
pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config, flow_shift=3.0)
P = json.load(open(a.prompts))
# Run 1 OOMed: with model offload the 11 GB umT5 was still on GPU 0 when the VAE encoded the control video.
# So: umT5 encodes the prompt pair on GPU 1, is dropped, and the DiT + VAE (~4 GB) sit on GPU 0 for the whole run.
te_dev = "cuda:1" if torch.cuda.device_count() > 1 else "cuda:0"
pipe.text_encoder.to(te_dev)
with torch.no_grad():
    pe, ne = pipe.encode_prompt(prompt=P["prompt"], negative_prompt=P["negative_prompt"], do_classifier_free_guidance=True,
                                num_videos_per_prompt=1, max_sequence_length=512, device=torch.device(te_dev))
pe, ne = pe.to("cuda:0", torch.float16), ne.to("cuda:0", torch.float16)
pipe.text_encoder = None
gc.collect()
torch.cuda.empty_cache()
pipe.to("cuda:0")
try:
    pipe.vae.enable_tiling()
    log["vae_tiling"] = True
except Exception as e:  # noqa: BLE001
    log["vae_tiling"] = repr(e)[:200]
log["load_s"] = round(time.time() - T0, 1)
print("loaded", log["load_s"], "s; embeds", tuple(pe.shape), bool(torch.isfinite(pe).all()), flush=True)


def read(path, n):
    cap = cv2.VideoCapture(path)
    out = []
    while len(out) < n:
        ok, f = cap.read()
        if not ok:
            break
        out.append(Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB)))
    return out


depth = read(os.path.join(a.prep, "depth.mp4"), a.frames)
n = (len(depth) - 1) // 4 * 4 + 1
depth = depth[:n]
Wd, Hd = depth[0].size
black = Image.new("L", (Wd, Hd), 0)
white = Image.new("L", (Wd, Hd), 255)
kf = Image.open(os.path.join(a.prep, "kf.png")).convert("RGB")
ref = Image.open(os.path.join(a.prep, "ref.png")).convert("RGB")
step_t = []


def on_step(p, i, t, kw):
    step_t.append(time.time())
    if i % 5 == 0:
        print(f"  step {i} {step_t[-1] - step_t[0]:.0f}s", flush=True)
    return kw


N_TRY = [n] + ([49] if n > 49 else [])  # fall back to 49 frames (2 s) if 81 does not fit
jobs = [(v, nn) for v in a.variants.split(",") for nn in N_TRY[:1]]
while jobs:
    v, n = jobs.pop(0)
    if v == "v1":
        name, video, mask, refs = "v1_depth_kf0", [kf] + depth[1:n], [black] + [white] * (n - 1), None
    else:
        name, video, mask, refs = "v2_depth_ref", depth[:n], [white] * n, [ref]
    mp4 = os.path.join(a.out, name + ".mp4")
    if os.path.exists(mp4):
        continue
    t = time.time()
    step_t.clear()
    step_t.append(time.time())
    try:
        torch.cuda.reset_peak_memory_stats()
        frames = pipe(prompt=None, negative_prompt=None, prompt_embeds=pe, negative_prompt_embeds=ne, video=video, mask=mask,
                      reference_images=refs, height=Hd, width=Wd, num_frames=n, num_inference_steps=a.steps,
                      guidance_scale=a.cfg, generator=torch.Generator().manual_seed(43),
                      callback_on_step_end=on_step).frames[0]
        export_to_video(frames, mp4, fps=24)
        dt = time.time() - t
        arr = np.asarray(frames, dtype=np.float32)
        log["runs"][name] = {"s": round(dt, 1), "s_per_step": round((step_t[-1] - step_t[0]) / max(1, len(step_t) - 1), 2),
                             "frames": n, "size": [Wd, Hd], "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 2**30, 2),
                             "s_per_video_second": round(dt / (n / 24), 1), "finite": bool(np.isfinite(arr).all()),
                             "mean": float(arr.mean())}
    except Exception as e:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        log["runs"][name] = {"error": repr(e)[:500], "s": round(time.time() - t, 1), "frames": n}
        if "out of memory" in repr(e).lower() and n > 49:
            jobs.insert(0, (v, 49))
            print(f"{name}: OOM at {n} frames, retrying at 49", flush=True)
    print(name, json.dumps(log["runs"][name]), flush=True)
    json.dump(log, open(os.path.join(a.out, "run_log.json"), "w"), indent=1)
    gc.collect()
    torch.cuda.empty_cache()
log["total_s"] = round(time.time() - T0, 1)
json.dump(log, open(os.path.join(a.out, "run_log.json"), "w"), indent=1)
print("done", log["total_s"], flush=True)

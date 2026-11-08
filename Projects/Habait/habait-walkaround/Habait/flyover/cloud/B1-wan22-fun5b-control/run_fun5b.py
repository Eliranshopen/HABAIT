"""Stage 2 of route B1: Wan2.2-Fun-5B-Control (Apache-2.0) video-to-video on the clay, fp16 on one T4.

python run_fun5b.py --repo /tmp/VideoX-Fun --model DIR --embeds embeds.pt --prep PREPDIR --out OUT --variants v1,v2,v3
Variants (all 1280x704, 121 frames @ 24 fps, seed 43):
  v1_depth_kf   control = depth of the clay, start image = GPT keyframe of clay frame 1, ref = same keyframe
  v2_canny_kf   control = canny of the clay, start image + ref = keyframe
  v3_depth_ref  control = depth, NO start image, ref = crop of the skinned aerial 360 pano (the zero-new-spend case)
"""
import argparse, gc, json, os, sys, time

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import numpy as np
import torch

ap = argparse.ArgumentParser()
ap.add_argument("--repo", required=True)
ap.add_argument("--model", required=True)
ap.add_argument("--embeds", required=True)
ap.add_argument("--prep", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--variants", default="v1,v2,v3")
ap.add_argument("--steps", type=int, default=30)
ap.add_argument("--cfg", type=float, default=6.0)
ap.add_argument("--size", default="704x1280")  # H x W
ap.add_argument("--frames", type=int, default=121)
ap.add_argument("--mode", default="model_cpu_offload_and_qfloat8")  # run 2: fp16 weights (10 GB) + 1280x704x121 OOMed
ap.add_argument("--teacache", type=float, default=0.10)
a = ap.parse_args()
sys.path.insert(0, a.repo)
os.chdir(a.repo)
from diffusers import FlowMatchEulerDiscreteScheduler  # noqa: E402
from omegaconf import OmegaConf  # noqa: E402
from transformers import AutoTokenizer  # noqa: E402
from videox_fun.models import AutoencoderKLWan3_8, Wan2_2Transformer3DModel  # noqa: E402
from videox_fun.models.cache_utils import get_teacache_coefficients  # noqa: E402
from videox_fun.pipeline import Wan2_2FunControlPipeline  # noqa: E402
from videox_fun.utils import (apply_gpu_memory_mode, filter_kwargs, get_image_latent,  # noqa: E402
                              get_image_to_video_latent, get_video_to_video_latent, save_videos_grid)

dtype = torch.float16  # T4 (sm_75) has no bf16
device = torch.device("cuda:0")
H, W = map(int, a.size.split("x"))
os.makedirs(a.out, exist_ok=True)
T0 = time.time()
log = {"args": vars(a), "runs": {}}


class StubTE(torch.nn.Module):
    """Stands in for the 11 GB umT5 (prompt embeddings are precomputed); the pipeline reads .dtype from it."""

    def __init__(self):
        super().__init__()
        self.p = torch.nn.Parameter(torch.zeros(1, dtype=dtype), requires_grad=False)

    @property
    def dtype(self):
        return dtype

    def forward(self, *x, **k):
        raise RuntimeError("text encoder stub called")


cfg = OmegaConf.load("config/wan2.2/wan_civitai_5b.yaml")
t = time.time()
transformer = Wan2_2Transformer3DModel.from_pretrained(
    os.path.join(a.model, cfg["transformer_additional_kwargs"].get("transformer_low_noise_model_subpath", "transformer")),
    transformer_additional_kwargs=OmegaConf.to_container(cfg["transformer_additional_kwargs"]),
    low_cpu_mem_usage=True, torch_dtype=dtype,
)
vae = AutoencoderKLWan3_8.from_pretrained(
    os.path.join(a.model, cfg["vae_kwargs"].get("vae_subpath", "vae")),
    additional_kwargs=OmegaConf.to_container(cfg["vae_kwargs"]),
).to(dtype)
tokenizer = AutoTokenizer.from_pretrained(os.path.join(a.model, cfg["text_encoder_kwargs"].get("tokenizer_subpath", "tokenizer")))
scheduler = FlowMatchEulerDiscreteScheduler(**filter_kwargs(FlowMatchEulerDiscreteScheduler, OmegaConf.to_container(cfg["scheduler_kwargs"])))
pipe = Wan2_2FunControlPipeline(transformer=transformer, transformer_2=None, vae=vae, tokenizer=tokenizer,
                                text_encoder=StubTE(), scheduler=scheduler)
apply_gpu_memory_mode(pipe, a.mode, device, dtype)
log["load_s"] = round(time.time() - t, 1)
coeff = get_teacache_coefficients(a.model) if a.teacache > 0 else None
if coeff is not None:
    pipe.transformer.enable_teacache(coeff, a.steps, a.teacache, num_skip_start_steps=5, offload=False)
log["teacache"] = coeff is not None
print("loaded", log["load_s"], "s; teacache", log["teacache"], flush=True)

class EmbList(list):
    """The pipeline takes the umT5 output as a list of [tokens, 4096] tensors but reads .shape[0] for the batch size
    when no prompt string is passed (passing both is rejected), so give the list a shape."""
    shape = (1, 0, 4096)


E = torch.load(a.embeds)
pe = EmbList([E["prompt"].to(device, dtype)])
ne = EmbList([E["negative_prompt"].to(device, dtype)])
P = json.load(open(os.path.join(os.path.dirname(a.embeds), "prompts.json")))
VARIANTS = {
    "v1": ("v1_depth_kf", "depth.mp4", "kf.png", "kf.png"),
    "v2": ("v2_canny_kf", "canny.mp4", "kf.png", "kf.png"),
    "v3": ("v3_depth_ref", "depth.mp4", None, "ref.png"),
}
n = int((a.frames - 1) // 4 * 4) + 1
step_t = []


def on_step(p, i, ts, kw):
    step_t.append(time.time())
    if i % 5 == 0:
        print(f"  step {i} {step_t[-1] - step_t[0]:.0f}s", flush=True)
    return kw


# memory ladder: native 1280x704x121 first, then 960x544x121, then 960x544x81 (OOM -> next rung, same variant)
LADDER = [(H, W, n), (544, 960, n), (544, 960, 81)]
jobs = [(v, 0) for v in a.variants.split(",")]
while jobs:
    v, rung = jobs.pop(0)
    H, W, n = LADDER[rung]
    name, ctrl, start, ref = VARIANTS[v]
    mp4 = os.path.join(a.out, name + ".mp4")
    if os.path.exists(mp4):
        continue
    t = time.time()
    step_t.clear()
    step_t.append(time.time())
    try:
        with torch.no_grad():
            iv, im, _ = get_image_to_video_latent(os.path.join(a.prep, start) if start else None, None, video_length=n, sample_size=[H, W])
            rf = get_image_latent(os.path.join(a.prep, ref), sample_size=[H, W]) if ref else None
            cv, _, _, _ = get_video_to_video_latent(os.path.join(a.prep, ctrl), video_length=n, sample_size=[H, W], fps=24, ref_image=None)
            torch.cuda.reset_peak_memory_stats()
            out = pipe(None, num_frames=n, negative_prompt=None, height=H, width=W,
                       generator=torch.Generator(device=device).manual_seed(43), guidance_scale=a.cfg,
                       num_inference_steps=a.steps, video=iv, mask_video=im, control_video=cv, ref_image=rf,
                       prompt_embeds=pe, negative_prompt_embeds=ne, shift=5,
                       callback_on_step_end=on_step).videos
        save_videos_grid(out, mp4, fps=24)
        dt = time.time() - t
        log["runs"][name] = {"s": round(dt, 1), "s_per_step": round((step_t[-1] - step_t[0]) / max(1, len(step_t) - 1), 2),
                             "frames": n, "size": [W, H], "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 2**30, 2),
                             "s_per_video_second": round(dt / (n / 24), 1)}
        arr = out[0].float().numpy()
        log["runs"][name]["finite"] = bool(np.isfinite(arr).all())
        log["runs"][name]["mean"] = float(arr.mean())
    except Exception as e:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        log["runs"][name] = {"error": repr(e)[:500], "s": round(time.time() - t, 1), "size": [W, H], "frames": n}
        if "out of memory" in repr(e).lower() and rung + 1 < len(LADDER):
            jobs.insert(0, (v, rung + 1))
            print(f"{name}: OOM at {W}x{H}x{n}, next rung {LADDER[rung + 1]}", flush=True)
    print(name, json.dumps(log["runs"][name]), flush=True)
    json.dump(log, open(os.path.join(a.out, "run_log.json"), "w"), indent=1)
    gc.collect()
    torch.cuda.empty_cache()
log["total_s"] = round(time.time() - T0, 1)
json.dump(log, open(os.path.join(a.out, "run_log.json"), "w"), indent=1)
print("done", log["total_s"], flush=True)

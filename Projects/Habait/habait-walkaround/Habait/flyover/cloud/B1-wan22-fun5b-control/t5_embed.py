"""Stage 1 of route B1: encode the prompt pair with umT5-XXL once, on the second T4, then exit so its 11 GB leave RAM.

python t5_embed.py --repo /tmp/VideoX-Fun --model /tmp/models/Wan2.2-Fun-5B-Control --prompts prompts.json --out embeds.pt
"""
import argparse, json, os, sys, time

import torch

ap = argparse.ArgumentParser()
ap.add_argument("--repo", required=True)
ap.add_argument("--model", required=True)
ap.add_argument("--prompts", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--device", default="cuda:1" if torch.cuda.device_count() > 1 else "cuda:0")
a = ap.parse_args()
sys.path.insert(0, a.repo)
from omegaconf import OmegaConf  # noqa: E402
from transformers import AutoTokenizer  # noqa: E402
from videox_fun.models import WanT5EncoderModel  # noqa: E402

t0 = time.time()
cfg = OmegaConf.load(os.path.join(a.repo, "config/wan2.2/wan_civitai_5b.yaml"))
tk = cfg["text_encoder_kwargs"]
tok = AutoTokenizer.from_pretrained(os.path.join(a.model, tk.get("tokenizer_subpath", "tokenizer")))
enc = WanT5EncoderModel.from_pretrained(
    os.path.join(a.model, tk.get("text_encoder_subpath", "text_encoder")),
    additional_kwargs=OmegaConf.to_container(tk), low_cpu_mem_usage=True, torch_dtype=torch.float16,
).eval().to(a.device)
P = json.load(open(a.prompts))
out = {}
with torch.no_grad():
    for key in ("prompt", "negative_prompt"):
        ti = tok([P[key]], padding="max_length", max_length=512, truncation=True, add_special_tokens=True, return_tensors="pt")
        e = enc(ti.input_ids.to(a.device), attention_mask=ti.attention_mask.to(a.device))[0]
        n = int(ti.attention_mask.gt(0).sum())
        e = e[0, :n].float()
        bad = int((~torch.isfinite(e)).sum())
        print(key, "tokens", n, "nonfinite", bad, "absmax", float(e.abs().max()), flush=True)
        if bad:
            raise SystemExit("fp16 T5 overflow")
        out[key] = e.cpu()
torch.save(out, a.out)
print("t5 done", round(time.time() - t0, 1), "s", flush=True)

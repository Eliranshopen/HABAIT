"""fal-ai/flux-pro/v1/depth: text-to-image under a depth control, no look image (card 12's B).

The control is drawn the way card 12 found works: near = bright, LINEAR in metres between the 0.5 / 99.5
percentiles (an inverse ramp left the glass wall black). Sources: the Studio shot's depthcm_0001.png (keyframe), the
clay pano's 24-bit depth.png (pano), or, with no depth (the Kaggle flight frames), the clay RGB itself so fal
estimates the depth (card 12 ctrl-B-claycontrol). Price $0.05/MP + $0.005 (card 12)."""
from pathlib import Path

from .base import Adapter


class FluxProDepth(Adapter):
    prompt_mode = "t2i"

    def files(self, job):
        c = job["control"]
        if c["kind"] == "clay_rgb":
            return {"@control": Path(c["source"])}
        return {"@control": Path(job["_control_png"]) if job.get("_control_png") else Path(c["source"])}

    def args(self, job):
        w, h = self.out_size(job)
        return {"prompt": job["prompts"]["t2i"], "control_image_url": "@control", "image_size": {"width": w, "height": h},
                "num_inference_steps": 28, "guidance_scale": 3.5, "seed": int(job["seed"]), "output_format": "png",
                "safety_tolerance": "2"}

    def prepare(self, job, run_dir):
        c = job["control"]
        if c["kind"] == "clay_rgb":
            return {}
        import cv2
        import numpy as np
        from PIL import Image
        src = Path(c["source"])
        if c["kind"] == "depthcm_png":
            z16 = cv2.imread(str(src), cv2.IMREAD_UNCHANGED)
            z16 = z16[..., 0] if z16.ndim == 3 else z16
            z = z16.astype(np.float32) / 100.0
            z[z16 >= 65535] = np.nan
        elif c["kind"] == "pano_depth24":
            d = np.asarray(Image.open(src).convert("RGB")).astype(np.uint32)
            z = ((d[..., 0] << 16) | (d[..., 1] << 8) | d[..., 2]).astype(np.float32) / 100.0
        else:
            raise ValueError(f"control kind {c['kind']}")
        lo, hi = np.nanpercentile(z, 0.5), np.nanpercentile(z, 99.5)
        g = (np.clip((hi - np.nan_to_num(z, nan=hi)) / max(1e-6, hi - lo), 0, 1) * 255).round().astype(np.uint8)
        out = Path(run_dir) / "inputs" / f"{job['name']}.control.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(out), cv2.merge([g, g, g]))
        job["_control_png"] = out
        return {"@control": out}

    def describe(self, job):
        d = super().describe(job)
        d["control_image_url"] = f"@control = {job['control']['kind']} of {Path(job['control']['source']).name}"
        return d


ADAPTER = FluxProDepth

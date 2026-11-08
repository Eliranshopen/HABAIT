"""fal-ai/qwen-image-edit-2511 and .../lora: image 1 = the clay only (no look image; card 12), the edit prompt with the
finishes in words. The /lora entry adds the project LoRA trained by card 12 (trigger "hbt846 style"), its URL read
from the lora.json the registry names; without that file the adapter is unavailable. Price per MP (card 12)."""
import json
from pathlib import Path

from .base import Adapter

ROOT = Path("C:/RnD/Projects/Habait/habait-walkaround")


class QwenEdit2511(Adapter):
    prompt_mode = "edit_text"

    def lora(self):
        spec = self.entry.get("lora")
        if not spec:
            return None
        p = ROOT / spec["json"]
        if not p.exists():
            return None
        d = json.loads(p.read_text(encoding="utf-8"))
        for k in spec["url_key"].split("."):
            d = d.get(k) if isinstance(d, dict) else None
        return d

    def available(self):
        if self.entry.get("lora") and not self.lora():
            return False, f"no LoRA url in {self.entry['lora']['json']} (run card 12 train.py first)"
        return True, ""

    def prompt(self, job):
        p = job["prompts"]["edit_text"]
        if self.entry.get("lora"):
            p = self.entry["lora"]["trigger"] + " interior. " + p
        return p

    def files(self, job):
        return {"@clay": job["image"]}

    def args(self, job):
        w, h = self.out_size(job)
        a = {"prompt": self.prompt(job), "image_urls": ["@clay"], "image_size": {"width": w, "height": h},
             "num_inference_steps": 28, "guidance_scale": 4.5, "seed": int(job["seed"]), "output_format": "png",
             "num_images": 1}
        if self.entry.get("lora"):
            a["loras"] = [{"path": self.lora() or "<lora url missing>", "scale": float(self.entry["lora"].get("scale", 1.0))}]
        return a

    def describe(self, job):
        d = super().describe(job)
        if "loras" in d:
            d["loras"] = [{"path": "<card 12 LoRA url>" if self.lora() else "<missing>", "scale": d["loras"][0]["scale"]}]
        return d


ADAPTER = QwenEdit2511

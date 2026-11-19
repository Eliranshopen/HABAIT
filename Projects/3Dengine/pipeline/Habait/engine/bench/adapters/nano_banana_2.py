"""fal-ai/nano-banana-2/edit: image 1 = clay, images 2..4 = look crops. resolution 1K for a keyframe ($0.08), 2K for
an equirect ($0.12). aspect_ratio "auto" for an equirect: "2:1" is rejected (89's bench); the 2K answer is 2912x1440
and the gates resize it."""
from .base import Adapter


class NanoBanana2(Adapter):
    prompt_mode = "edit_refs"

    def out_size(self, job):
        return (2912, 1440) if self.resolution(job) == "2K" else (1376, 768)

    def args(self, job):
        w, h = job["size"]
        aspect = "auto" if job["kind"] == "equirect" else ("16:9" if abs(w / h - 16 / 9) < 0.02 else "auto")
        return {"prompt": self.prompt(job), "image_urls": list(self.files(job)), "resolution": self.resolution(job),
                "aspect_ratio": aspect, "output_format": "png"}


ADAPTER = NanoBanana2

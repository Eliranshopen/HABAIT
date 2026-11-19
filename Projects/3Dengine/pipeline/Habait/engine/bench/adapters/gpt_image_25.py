"""openai/gpt-image-2.5/sunburst/edit: the model of record. image 1 = clay, images 2..4 = look crops, flat $1.20
(quality high). The keyframe asks 1920x1080 like 89's bench (kf_check runs with --aspect-tol 0.1); an equirect asks
2048x1024. No seed parameter: seed n = an independent sample."""
from .base import Adapter


class GptImage25(Adapter):
    prompt_mode = "edit_refs"

    def out_size(self, job):
        if job["kind"] == "equirect":
            return (2048, 1024)
        w, h = job["size"]
        return (1920, 1080) if abs(w / h - 16 / 9) < 0.02 else (w, h)

    def args(self, job):
        w, h = self.out_size(job)
        return {"prompt": self.prompt(job), "image_urls": list(self.files(job)), "image_size": {"width": w, "height": h},
                "quality": "high", "num_images": 1}


ADAPTER = GptImage25

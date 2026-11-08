"""The generic adapter: prompt + image_urls (image 1 = the clay, then the look references), a size, a price.

A job (built by habait_bench.track_jobs) is a dict:
  track     keyframe | flyover | pano
  name      the output's stem (out/<name>.png)
  kind      perspective | equirect
  image     Path of the clay image (image 1)
  refs      [Path] look references (images 2..n), used only when the endpoint takes reference images
  size      (w, h) of the clay
  seed      int (endpoints without a seed parameter take it as "sample n")
  prompts   {"edit_refs": ..., "edit_text": ..., "t2i": ...}
  control   {"kind": "depthcm_png" | "pano_depth24" | "clay_rgb", "source": Path} (depth models)

A new endpoint whose request is the standard prompt + image_urls + image_size needs only a registry.json entry with
"adapter": "base"; anything else gets its own file here.
"""


class Adapter:
    prompt_mode = "edit_refs"          # which of job["prompts"] this endpoint gets

    def __init__(self, endpoint, entry):
        self.endpoint = endpoint
        self.entry = entry

    # ------------------------------------------------------------------ availability / price
    def available(self):
        return True, ""

    def supports(self, track):
        return track in self.entry.get("tracks", [])

    def out_size(self, job):
        return tuple(job["size"])

    def resolution(self, job):
        return "2K" if job["kind"] == "equirect" or max(job["size"]) > 1400 else "1K"

    def price(self, job):
        p = self.entry["price"]
        if p["type"] == "flat":
            return round(float(p["usd"]), 4)
        if p["type"] == "per_mp":
            w, h = self.out_size(job)
            return round(float(p["usd_per_mp"]) * w * h / 1e6 + float(p.get("plus", 0.0)), 4)
        if p["type"] == "by_resolution":
            return round(float(p["usd"][self.resolution(job)]), 4)
        raise ValueError(f"{self.endpoint}: unknown price type {p['type']}")

    # ------------------------------------------------------------------ the request
    def files(self, job):
        """{placeholder: Path} uploaded by fal_call(); the placeholders appear verbatim in the args."""
        f = {"@clay": job["image"]}
        if self.entry.get("takes_reference_images"):
            for i, r in enumerate(job["refs"]):
                f[f"@ref{i + 2}"] = r
        return f

    def prompt(self, job):
        mode = self.prompt_mode
        if mode == "edit_refs" and not self.entry.get("takes_reference_images"):
            mode = "edit_text"
        return job["prompts"][mode]

    def args(self, job):
        w, h = self.out_size(job)
        return {"prompt": self.prompt(job), "image_urls": list(self.files(job)), "image_size": {"width": w, "height": h},
                "output_format": "png"}

    def prepare(self, job, run_dir):
        """$0 local preprocessing at real-run time (a control image ...). Returns extra {placeholder: Path}."""
        return {}

    def describe(self, job):
        """dry-run text: the request without the prompt body."""
        a = self.args(job)
        return {k: (f"<{len(v)} chars>" if k == "prompt" else v) for k, v in a.items()}


ADAPTER = Adapter

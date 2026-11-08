"""prep_image.py — downscale a large upload for the LLM (max side --max px, JPEG q88)."""
import argparse

from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("dst")
ap.add_argument("--max", type=int, default=2000)
a = ap.parse_args()
im = Image.open(a.src).convert("RGB")
im.thumbnail((a.max, a.max))
im.save(a.dst, "JPEG", quality=88)
print(f"prep_image: {a.src} -> {a.dst} {im.size}")

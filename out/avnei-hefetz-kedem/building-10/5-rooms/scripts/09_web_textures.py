"""Step 09 ($0) - web textures for the real-time walkthrough: walk/tex/*.jpg + walk/sky/*.

Usage: python 09_web_textures.py <job root> [--go]   (--go downloads the 1k HDR + the tonemapped sky JPG from Poly Haven, CC0)
Colour decisions are baked into the JPGs here (the texture's light/dark pattern times the chosen colour), so the browser
loads finished materials: same look as the Blender scene (05_build_scene.py), one place per material.
"""
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

root = Path(sys.argv[1])
GO = "--go" in sys.argv
T = root / "assets" / "polyhaven" / "textures"
out = root / "walk" / "tex"
out.mkdir(parents=True, exist_ok=True)
SZ = 1024


def load(tex, m="Diffuse", size=SZ):
    return Image.open(T / tex / f"{tex}_{m}.jpg").convert("RGB").resize((size, size), Image.LANCZOS)


def colourise(tex, rgb, var, name, size=SZ):
    a = np.asarray(load(tex, size=size)).astype(np.float32) / 255.0
    bw = a @ np.array([0.299, 0.587, 0.114], np.float32)
    k = bw * var + (1.0 - var * 0.5)
    o = np.clip(k[..., None] * np.array(rgb, np.float32)[None, None, :], 0, 1)
    Image.fromarray((o * 255).astype(np.uint8)).save(out / f"{name}.jpg", quality=88)


def tinted(tex, rgb, name, size=SZ):
    a = np.asarray(load(tex, size=size)).astype(np.float32) / 255.0
    o = np.clip(a * np.array(rgb, np.float32), 0, 1)
    Image.fromarray((o * 255).astype(np.uint8)).save(out / f"{name}.jpg", quality=88)


def normal(tex, name, size=SZ):
    load(tex, "nor_gl", size).save(out / f"{name}_n.jpg", quality=90)


def tile(tex, rgb, grout, name, size=SZ, gpx=4):
    """one square tile with its grout on the edge: repeat it once per tile size in the browser"""
    a = np.asarray(load(tex, size=size)).astype(np.float32) / 255.0
    a = np.clip(a * np.array(rgb, np.float32), 0, 1)
    a[:gpx, :] = grout
    a[:, :gpx] = grout
    Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)).save(out / f"{name}.jpg", quality=90)
    n = np.full((size, size, 3), (128, 128, 255), np.uint8)
    n[:gpx, :] = (128, 100, 230)
    n[:, :gpx] = (100, 128, 230)
    Image.fromarray(n).save(out / f"{name}_n.jpg", quality=92)


colourise("white_plaster_02", (0.86, 0.85, 0.82), 0.08, "wall")
normal("white_plaster_02", "wall")
colourise("white_plaster_02", (0.80, 0.79, 0.76), 0.15, "parapet")
tile("marble_01", (0.93, 0.92, 0.89), (0.62, 0.61, 0.58), "tile80")
tile("marble_01", (0.78, 0.77, 0.75), (0.55, 0.54, 0.52), "tile60")
colourise("laminate_floor_02", (0.60, 0.50, 0.40), 0.6, "parquet")
normal("laminate_floor_02", "parquet")
tinted("long_white_tiles", (1, 1, 1), "bathwall")
normal("long_white_tiles", "bathwall")
tinted("wood_floor_deck", (1, 1, 1), "deck")
normal("wood_floor_deck", "deck")
tinted("marble_01", (0.97, 0.96, 0.94), "quartz")
tinted("oak_veneer_01", (1, 1, 1), "oak")
normal("oak_veneer_01", "oak")
tinted("fine_grained_wood", (0.55, 0.45, 0.36), "entrance")
colourise("rough_linen", (0.50, 0.49, 0.46), 0.35, "sofa", 512)
normal("rough_linen", "sofa", 512)
colourise("cotton_jersey", (0.82, 0.79, 0.72), 0.3, "boucle", 512)
normal("cotton_jersey", "boucle", 512)
colourise("rough_linen", (0.66, 0.62, 0.55), 0.3, "rug", 512)
colourise("cotton_jersey", (0.85, 0.85, 0.83), 0.15, "linen_white", 512)
colourise("rough_linen", (0.38, 0.38, 0.37), 0.35, "linen_grey", 512)
colourise("velour_velvet", (0.42, 0.39, 0.35), 0.2, "chair", 512)
tinted("leafy_grass", (1, 1, 1), "grass", 512)
print("textures:", len(list(out.glob("*.jpg"))), "in", out)

sky = root / "walk" / "sky"
sky.mkdir(exist_ok=True)
UA = {"User-Agent": "asset-fetch/1.0"}
for url, f, conv in (("https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/golden_gate_hills_1k.hdr", "env_1k.hdr", None),
                     ("https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/golden_gate_hills.jpg", "_tonemapped_8k.jpg", "bg")):
    p = sky / f
    if not p.exists():
        if not GO:
            print("would download", url)
            continue
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
            p.write_bytes(r.read())
    if conv == "bg":
        Image.MAX_IMAGE_PIXELS = None
        im = Image.open(p).convert("RGB")
        im.resize((4096, 2048), Image.LANCZOS).save(sky / "bg_4k.jpg", quality=86)
        im.resize((2048, 1024), Image.LANCZOS).save(sky / "bg_2k.jpg", quality=86)
        p.unlink()
print("sky:", sorted(x.name for x in sky.iterdir()))

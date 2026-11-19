"""Step 16 ($0) - the apartment's look from Eliran's interior pictures (input/supplied/*.png, 2026-11-17 22:10).

Colours sampled from the pictures (work/look/, 1100 px previews): floor ~206 grey-white polished marble in large tiles in
every room, white walls, sofa ~150 grey velvet, light oak ~(202,183,158), dining chairs ~134 dark-grey velvet, white
handleless kitchen with a black plinth, white marble counter, bathrooms in grey marble 60x120 wall tiles, oak slatted
wardrobes and nightstands, grey channel-tufted headboards, grey duvets on white sheets.
Writes walk/tex/*.jpg over step 09's set (09 regenerates the earlier look). CC0 sources: assets/polyhaven/textures.
Usage: python 16_look_from_renders.py <job root>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

root = Path(sys.argv[1])
T = root / "assets" / "polyhaven" / "textures"
out = root / "walk" / "tex"


def load(tex, m="Diffuse", size=1024):
    return np.asarray(Image.open(T / tex / f"{tex}_{m}.jpg").convert("RGB").resize((size, size), Image.LANCZOS)).astype(np.float32) / 255.0


def save(a, name, q=88):
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(out / f"{name}.jpg", quality=q)


def colourise(tex, rgb, var, name, size=1024, normal=True):
    a = load(tex, size=size); bw = a @ np.array([0.299, 0.587, 0.114], np.float32)
    save((bw * var + (1.0 - var * 0.5))[..., None] * np.array(rgb, np.float32), name)
    if normal and (T / tex / f"{tex}_nor_gl.jpg").exists():
        Image.open(T / tex / f"{tex}_nor_gl.jpg").convert("RGB").resize((size, size), Image.LANCZOS).save(out / f"{name}_n.jpg", quality=90)


def fbm(size, seed, octaves=6, base=3):
    rng = np.random.default_rng(seed); o = np.zeros((size, size), np.float32); amp = 1.0; tot = 0
    for k in range(octaves):
        n = base * 2 ** k; g = rng.random((n, n)).astype(np.float32)
        o += amp * np.asarray(Image.fromarray(g).resize((size, size), Image.BICUBIC)); tot += amp; amp *= 0.5
    return o / tot


def marble(level, contrast, size, seed=3):
    """veined marble, procedural (the Poly Haven 'marble_01' is limestone tiles, not the pictures' veined stone):
    a grey-white ground, long thin grey veins along a diagonal, softer cloudy variation"""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size
    t = (x * 0.8 + y * 0.6) * 2.2 * np.pi + 7.0 * fbm(size, seed)
    v1 = (1 - np.abs(np.sin(t))) ** 18
    t2 = (x * -0.5 + y * 0.9) * 5.0 * np.pi + 9.0 * fbm(size, seed + 1)
    v2 = (1 - np.abs(np.sin(t2))) ** 40
    cloud = fbm(size, seed + 2, 5, 4) - 0.5
    v1 = np.asarray(Image.fromarray((v1 * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(size / 900))).astype(np.float32) / 255
    g = level + cloud * 0.08 * contrast - v1 * 0.13 * contrast - v2 * 0.07 * contrast
    return np.repeat(g[..., None], 3, 2) * np.array([1.0, 1.0, 1.015], np.float32)


def tiles(name, level, contrast, cols, rows, grout, size=2048, gpx=3):
    """an atlas of cols x rows tiles, each cut from a different place and turn of the marble, grout on the edges"""
    big = marble(level, contrast, size)
    tw, th = size // cols, size // rows
    o = np.zeros((size, size, 3), np.float32)
    rng = np.random.default_rng(7)
    for j in range(rows):
        for i in range(cols):
            y0, x0 = rng.integers(0, size - th + 1), rng.integers(0, size - tw + 1)
            patch = big[y0:y0 + th, x0:x0 + tw]
            if rng.random() < 0.5: patch = patch[::-1, ::-1]
            o[j * th:(j + 1) * th, i * tw:(i + 1) * tw] = patch
    for i in range(cols): o[:, i * tw:i * tw + gpx] = grout
    for j in range(rows): o[j * th:j * th + gpx, :] = grout
    Image.fromarray((np.clip(o, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)).save(out / f"{name}.jpg", quality=90)
    n = np.full((size, size, 3), (128, 128, 255), np.uint8)
    for i in range(cols): n[:, i * tw:i * tw + gpx] = (100, 128, 230)
    for j in range(rows): n[j * th:j * th + gpx, :] = (128, 100, 230)
    Image.fromarray(n).save(out / f"{name}_n.jpg", quality=92)


def slats(name, base_rgb, n=10, size=1024):
    """oak with vertical grooves: n slats across the texture (the browser repeats it every 0.4 m -> 4 cm slats)"""
    a = load("oak_veneer_01", size=size); a = a / a.reshape(-1, 3).mean(0) * np.array(base_rgb, np.float32)   # mean = the pictures' oak
    a = np.transpose(a, (1, 0, 2))   # grain runs up the slats
    w = size // n; x = np.arange(size) % w
    shade = 1.0 - 0.45 * np.exp(-((x - 0) ** 2) / 18.0) - 0.12 * np.exp(-((x - w) ** 2) / 40.0)
    save(a * shade[None, :, None], name)
    nx = np.where(x < 4, 90, np.where(x > w - 6, 165, 128)).astype(np.uint8)
    nm = np.stack([np.broadcast_to(nx[None, :], (size, size)), np.full((size, size), 128, np.uint8), np.full((size, size), 240, np.uint8)], 2)
    Image.fromarray(nm).save(out / f"{name}_n.jpg", quality=92)


# floors: one polished grey-white marble everywhere (the pictures show it in bedrooms and baths too), tiles 120 x 120
tiles("tile80", 0.82, 0.55, 2, 2, 0.66)        # 2 x 2 tiles = 2.4 m atlas
tiles("tile60", 0.80, 0.55, 2, 2, 0.64)        # wet rooms: 2 x 2 tiles of 60 = 1.2 m atlas
tiles("bathwall", 0.76, 0.75, 2, 1, 0.62)       # 60 x 120 wall tiles, grey marble: 1.2 m atlas, 2 across 1 up
colourise("white_plaster_02", (0.93, 0.93, 0.92), 0.04, "wall")
save(marble(0.94, 0.7, 1024, 11), "quartz")      # white marble counter and sills
colourise("velour_velvet", (0.60, 0.59, 0.58), 0.30, "sofa", 512)
colourise("velour_velvet", (0.40, 0.40, 0.42), 0.30, "chair", 512)
colourise("rough_linen", (0.50, 0.50, 0.51), 0.30, "linen_grey", 512)
colourise("cotton_jersey", (0.95, 0.95, 0.94), 0.10, "linen_white", 512)
colourise("rough_linen", (0.82, 0.81, 0.79), 0.20, "rug", 512)
colourise("cotton_jersey", (0.90, 0.89, 0.87), 0.20, "boucle", 512)
colourise("white_plaster_02", (0.90, 0.90, 0.89), 0.10, "stone")   # the TV column's light stone
slats("oak_slat", (0.80, 0.70, 0.58))
a = load("oak_veneer_01"); save(a / a.reshape(-1, 3).mean(0) * np.array([0.80, 0.71, 0.60], np.float32), "oak")   # light oak (202,183,158)
# balcony (picture 12): dark grey composite deck, white rendered parapet wall, light-grey woven rope chairs
colourise("wood_floor_deck", (0.36, 0.36, 0.37), 0.45, "deck")
colourise("white_plaster_02", (0.93, 0.93, 0.92), 0.06, "parapet")
colourise("rough_linen", (0.74, 0.74, 0.73), 0.45, "rope", 512)
print("look textures written to", out)

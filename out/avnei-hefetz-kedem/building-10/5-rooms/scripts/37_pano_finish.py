"""Step 37 ($0) - the GPT Image 2.5 panoramas (step 36) → the viewer's walk/pano/<id>.jpg: resized to 4096x2048 and the 360 seam
closed (the answer's left and right edges do not join exactly: the two edge bands are cross-faded toward their common average,
recipe of the Hatzav session's 28_pano_seam.py). Prints the seam before/after (mean |first column - last column|).
Usage: python scripts/37_pano_finish.py <job root> <id[,id]> [--band 96] [--src work/pano/gpt25] [--ext png] [--w 4096]
With --w 8192 also writes <id>_4k.jpg (phones: max texture 4096)."""
import os, sys
import numpy as np
from PIL import Image

root, ids = sys.argv[1], sys.argv[2].split(",")
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
band = int(arg("--band", 96)); SRC = arg("--src", "work/pano/gpt25"); EXT = arg("--ext", "png"); WO = int(arg("--w", 4096))
for pid in ids:
    src = os.path.join(root, SRC, pid + "." + EXT)
    im = np.asarray(Image.open(src).convert("RGB").resize((WO, WO // 2), Image.LANCZOS)).astype(np.float32)
    W = im.shape[1]
    s0 = float(np.abs(im[:, 0] - im[:, -1]).mean())
    L = im[:, :band].copy(); R = im[:, W - band:][:, ::-1].copy(); avg = (L + R) / 2
    w = (1 - np.arange(band, dtype=np.float32) / band)[None, :, None] ** 1.5
    im[:, :band] = L * (1 - w) + avg * w
    im[:, W - band:] = (R * (1 - w) + avg * w)[:, ::-1]
    s1 = float(np.abs(im[:, 0] - im[:, -1]).mean())
    out = os.path.join(root, "walk/pano", pid + ".jpg")
    img = Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)); img.save(out, quality=88)
    if WO > 4096: img.resize((4096, 2048), Image.LANCZOS).save(out.replace(".jpg", "_4k.jpg"), quality=88)
    print("FINISH", pid, f"seam {s0:.1f} -> {s1:.1f}", out)

"""PDF -> greyscale raster (pymupdf) and the auto-crop of the apartment drawing (OpenCV).

The sales sheet carries several drawings: the unit plan (large), a floor key, a site key, logos, a
title block, the areas table, notes. The unit plan is the largest connected line drawing once the
ink is morphologically closed; the frame around the sheet is excluded because it touches the page
border. The crop is padded so the dimension strings just outside the walls stay inside it.
"""
from __future__ import annotations

import json
import os
import warnings

import cv2
import numpy as np

warnings.filterwarnings("ignore", category=FutureWarning)


def rasterize(pdf_path: str, out_png: str, dpi: int = 288, page: int = 0) -> dict:
    import pymupdf

    doc = pymupdf.open(pdf_path)
    pg = doc[page]
    pix = pg.get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY)
    pix.save(out_png)
    n_draw = len(pg.get_drawings())
    text = pg.get_text().strip()
    info = {
        "pdf": pdf_path,
        "page": page,
        "dpi": dpi,
        "width_px": pix.width,
        "height_px": pix.height,
        "page_pt": [pg.rect.width, pg.rect.height],
        "page_mm": [round(pg.rect.width / 72 * 25.4, 1), round(pg.rect.height / 72 * 25.4, 1)],
        "vector_paths": n_draw,
        "has_text_layer": bool(text),
        "embedded_images": len(pg.get_images()),
        "note": ("vector paths present: the drawing is vector art flattened to raster here; a vector tracer "
                 "(A3) could read the wall fills directly" if n_draw > 500 else "raster-only sheet"),
    }
    return info


def autocrop(sheet_png: str, out_png: str, dpi: int = 288, pad_frac: float = 0.035) -> dict:
    """Find the apartment drawing on the sheet and write the crop. Returns the crop box in sheet px."""
    img = cv2.imread(sheet_png, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise FileNotFoundError(sheet_png)
    H, W = img.shape
    ink = (img < 200).astype(np.uint8)
    # 1. drop the sheet frame and the title-block rules: axis-aligned ink runs longer than 40 % of the page
    lh = cv2.getStructuringElement(cv2.MORPH_RECT, (int(0.4 * W), 1))
    lv = cv2.getStructuringElement(cv2.MORPH_RECT, (1, int(0.4 * H)))
    long_lines = cv2.morphologyEx(ink, cv2.MORPH_OPEN, lh) | cv2.morphologyEx(ink, cv2.MORPH_OPEN, lv)
    long_lines = cv2.dilate(long_lines, cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7)))
    ink_nf = ink & (1 - long_lines)
    # 2. close gaps between strokes so a drawing becomes one blob; 12 px at 288 dpi ~ 1 mm on paper
    k = max(3, int(round(12 * dpi / 288)))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k, k))
    closed = cv2.morphologyEx(ink_nf, cv2.MORPH_CLOSE, kernel)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)
    cands = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if w * h > 0.9 * W * H:
            continue
        # the real ink inside this blob (the closed blob over-counts); the unit plan has the most ink by far
        ink_px = int(np.count_nonzero(ink_nf[y:y + h, x:x + w][labels[y:y + h, x:x + w] == i]))
        cands.append({"i": int(i), "bbox": [int(x), int(y), int(x + w), int(y + h)], "bbox_area": int(w * h),
                      "ink_px": ink_px, "density": round(ink_px / float(w * h), 3)})
    if not cands:
        raise RuntimeError("autocrop: no drawing found")
    cands.sort(key=lambda c: c["ink_px"], reverse=True)
    best = cands[0]
    x0, y0, x1, y1 = best["bbox"]
    # 3. tighten to the wall fill: the unit plan is the only drawing with a mid-grey wall fill of any size;
    #    the blob itself may have swallowed the dashed plot line or a dimension that runs far out
    sub = img[y0:y1, x0:x1]
    greyfill = ((sub >= 70) & (sub <= 150)).astype(np.uint8)
    greyfill = cv2.morphologyEx(greyfill, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    ys, xs = np.nonzero(greyfill)
    basis = "blob"
    if len(xs) > 2000:
        gx0, gy0, gx1, gy1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        gw, gh = gx1 - gx0, gy1 - gy0
        # dimension strings sit up to ~22 % of the plan size outside the walls
        m = 0.22
        tx0, ty0 = max(x0, x0 + gx0 - int(gw * m)), max(y0, y0 + gy0 - int(gh * m))
        tx1, ty1 = min(x1, x0 + gx1 + int(gw * m)), min(y1, y0 + gy1 + int(gh * m))
        x0, y0, x1, y1 = tx0, ty0, tx1, ty1
        basis = "wall-fill bbox + 22 % margin"
        pad_frac = 0.0
    pw, ph = int((x1 - x0) * pad_frac), int((y1 - y0) * pad_frac)
    x0, y0 = max(0, x0 - pw), max(0, y0 - ph)
    x1, y1 = min(W, x1 + pw), min(H, y1 + ph)
    crop = img[y0:y1, x0:x1]
    cv2.imwrite(out_png, crop)
    return {
        "sheet": sheet_png,
        "crop": out_png,
        "crop_box_px": [int(x0), int(y0), int(x1), int(y1)],
        "crop_size_px": [int(x1 - x0), int(y1 - y0)],
        "pad_frac": pad_frac,
        "crop_basis": basis,
        "close_kernel_px": k,
        "candidates_top5": cands[:5],
        "method": "ink<200 minus axis-aligned runs >40% of the page (frame, table rules); morphological close; the 8-connected blob with the most ink",
    }


def downscale(src_png: str, out_png: str, max_side: int = 2000) -> dict:
    img = cv2.imread(src_png, cv2.IMREAD_GRAYSCALE)
    h, w = img.shape
    s = min(1.0, max_side / float(max(h, w)))
    if s < 1.0:
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(out_png, img)
    return {"src": src_png, "out": out_png, "scale": s, "size_px": [img.shape[1], img.shape[0]]}


def tiles(src_png: str, out_dir: str, grid: int = 2, overlap: float = 0.12, max_side: int = 1600) -> list:
    """Overlapping grid tiles of the crop, each resized to max_side, for the VLM to read small numbers."""
    img = cv2.imread(src_png, cv2.IMREAD_GRAYSCALE)
    h, w = img.shape
    out = []
    names = {(0, 0): "top-left", (1, 0): "top-right", (0, 1): "bottom-left", (1, 1): "bottom-right"}
    for gy in range(grid):
        for gx in range(grid):
            tw, th = w / grid, h / grid
            x0 = int(max(0, gx * tw - overlap * tw)); x1 = int(min(w, (gx + 1) * tw + overlap * tw))
            y0 = int(max(0, gy * th - overlap * th)); y1 = int(min(h, (gy + 1) * th + overlap * th))
            t = img[y0:y1, x0:x1]
            s = min(1.0, max_side / float(max(t.shape)))
            if s < 1.0:
                t = cv2.resize(t, (int(t.shape[1] * s), int(t.shape[0] * s)), interpolation=cv2.INTER_AREA)
            name = names.get((gx, gy), f"tile-{gx}-{gy}")
            path = os.path.join(out_dir, f"tile-{name}.png")
            cv2.imwrite(path, t)
            out.append({"name": name, "file": path, "box_px": [x0, y0, x1, y1], "scale": s})
    return out


if __name__ == "__main__":  # quick manual test
    import sys

    pdf, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    print(json.dumps(rasterize(pdf, os.path.join(out, "sheet.png")), ensure_ascii=False, indent=1))
    print(json.dumps(autocrop(os.path.join(out, "sheet.png"), os.path.join(out, "plan-crop.png")), ensure_ascii=False, indent=1))

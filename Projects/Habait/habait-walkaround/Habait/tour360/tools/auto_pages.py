#!/usr/bin/env python
"""auto_pages.py — the PDF leg of auto-trace (plan development/plans/2026-11-04-developer-platform.md P3).
The PDF is the developer's upload: untrusted data, read with -I, never executed.

  auto_pages.py scan <pdf> <out_dir> [--min-side 1000]
      every page: its text, its embedded images (xref, px size, rect on the page), its drawing count; every image with
      min(px) >= min-side gets a 640-px thumb <out_dir>/thumb-p<page>-x<xref>.jpg. Writes <out_dir>/pages.json.
      A single-page sheet (a plain sales plan) is reported with "sheet": true.
  auto_pages.py extract <pdf> <xref> <out.png>
      the embedded image at full resolution, RGB.
  auto_pages.py raster <pdf> <out_dir> [--page 1] [--dpi 288]
      a plain sheet: the page rendered at dpi, the apartment drawing auto-cropped (engine/intake/rasterize.py) -> crop.png
"""
import json
import os
import sys

import pymupdf


def scan(pdf, out, min_side):
    os.makedirs(out, exist_ok=True)
    d = pymupdf.open(pdf)
    pages = []
    for i, p in enumerate(d):
        rows = []
        for im in p.get_images(full=True):
            xref = im[0]
            try:
                info = d.extract_image(xref)
            except Exception:
                continue
            w, h = info["width"], info["height"]
            rects = [[round(r.x0), round(r.y0), round(r.x1), round(r.y1)] for r in p.get_image_rects(xref)]
            row = {"xref": xref, "px": [w, h], "rects_pt": rects, "large": min(w, h) >= min_side}
            if row["large"]:
                pix = pymupdf.Pixmap(d, xref)
                if pix.n - pix.alpha >= 4 or pix.alpha:
                    pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                s = 640 / max(w, h)
                thumb = os.path.join(out, f"thumb-p{i + 1}-x{xref}.jpg")
                # pymupdf has no resize on Pixmap; shrink through a page
                tmp = pymupdf.open()
                pg = tmp.new_page(width=w * s, height=h * s)
                pg.insert_image(pg.rect, pixmap=pix)
                pg.get_pixmap(dpi=72).save(thumb)
                row["thumb"] = thumb
            rows.append(row)
        pages.append({"page": i + 1, "size_pt": [p.rect.width, p.rect.height], "text": p.get_text(), "drawings": len(p.get_drawings()), "images": rows})
    doc = {"pdf": os.path.abspath(pdf), "pages": len(pages), "sheet": len(pages) == 1, "page_rows": pages}
    json.dump(doc, open(os.path.join(out, "pages.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"auto_pages: {len(pages)} pages, {sum(1 for p in pages for r in p['images'] if r['large'])} large images")


def extract(pdf, xref, out_png):
    d = pymupdf.open(pdf)
    pix = pymupdf.Pixmap(d, int(xref))
    if pix.n - pix.alpha >= 4 or pix.alpha:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    pix.save(out_png)
    print(f"auto_pages: extracted xref {xref} -> {out_png} ({pix.width}x{pix.height})")


def raster(pdf, out, page, dpi):
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.path.join(here, "..", "..", "engine", "intake"))
    import rasterize as rz
    os.makedirs(out, exist_ok=True)
    a = rz.rasterize(pdf, os.path.join(out, "sheet.png"), dpi=dpi, page=page - 1)
    b = rz.autocrop(os.path.join(out, "sheet.png"), os.path.join(out, "crop.png"), dpi=dpi)
    json.dump({"sheet": a, "crop": b}, open(os.path.join(out, "raster.json"), "w"), default=str)
    print("auto_pages: rendered and cropped")


if __name__ == "__main__":
    cmd = sys.argv[1]
    opt = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    if cmd == "scan":
        scan(sys.argv[2], sys.argv[3], int(opt("--min-side", 1000)))
    elif cmd == "extract":
        extract(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "raster":
        raster(sys.argv[2], sys.argv[3], int(opt("--page", 1)), int(opt("--dpi", 288)))
    else:
        sys.exit("usage: auto_pages.py scan|extract|raster ...")

"""prep_pdf.py — render a sales-plan PDF into images the LLM can actually read.

  python -I tools/prep_pdf.py plan.pdf out_dir [--dpi 150] [--tile-dpi 300] [--grid 3x2] [--max-side 2000]

A sales plan is usually a RASTER page (no text layer): read as a whole at low resolution, the small print
(areas table, dimensions, dates) is guessed. So for every page we write
  page-<n>.png                 the whole page at --dpi (overview: layout, keys, north arrow)
  page-<n>-r<i>c<j>.png        a --grid of overlapping tiles at --tile-dpi, each resized to <= --max-side px
and print a JSON list of the files. Tiles overlap by 10 % so a number on a seam is whole in one of them.
"""
import argparse
import json
import os
import sys

import pymupdf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("out")
    ap.add_argument("--dpi", type=int, default=150)
    ap.add_argument("--tile-dpi", type=int, default=300)
    ap.add_argument("--grid", default="3x2")
    ap.add_argument("--max-side", type=int, default=2000)
    a = ap.parse_args()
    cols, rows = [int(v) for v in a.grid.lower().split("x")]
    os.makedirs(a.out, exist_ok=True)
    doc = pymupdf.open(a.pdf)
    files = []
    for pno, page in enumerate(doc, start=1):
        if pno > 6:
            break
        r = page.rect
        overview = os.path.join(a.out, f"page-{pno}.png")
        pix = page.get_pixmap(dpi=a.dpi)
        if max(pix.width, pix.height) > a.max_side * 1.6:
            scale = a.max_side * 1.6 / max(pix.width, pix.height)
            pix = page.get_pixmap(matrix=pymupdf.Matrix(a.dpi / 72 * scale, a.dpi / 72 * scale))
        pix.save(overview)
        files.append({"file": overview, "kind": "overview", "page": pno, "px": [pix.width, pix.height]})
        tw, th = r.width / cols, r.height / rows
        ox, oy = tw * 0.1, th * 0.1
        for i in range(rows):
            for j in range(cols):
                clip = pymupdf.Rect(max(r.x0, r.x0 + j * tw - ox), max(r.y0, r.y0 + i * th - oy),
                                    min(r.x1, r.x0 + (j + 1) * tw + ox), min(r.y1, r.y0 + (i + 1) * th + oy))
                zoom = a.tile_dpi / 72
                est = max(clip.width, clip.height) * zoom
                if est > a.max_side:
                    zoom *= a.max_side / est
                tp = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip)
                name = os.path.join(a.out, f"page-{pno}-r{i + 1}c{j + 1}.png")
                tp.save(name)
                files.append({"file": name, "kind": "tile", "page": pno, "row": i + 1, "col": j + 1, "px": [tp.width, tp.height],
                              "region": "top" if i == 0 else "bottom" if i == rows - 1 else "middle",
                              "side": "left" if j == 0 else "right" if j == cols - 1 else "centre"})
    with open(os.path.join(a.out, "index.json"), "w", encoding="utf-8") as f:
        json.dump(files, f, indent=1)
    print(json.dumps(files))
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Audit helper: page count, text and a small preview of every page of the brochure (read-only)."""
import sys
from pathlib import Path
import pymupdf
here = Path(__file__).resolve().parent
root = here.parent.parent
doc = pymupdf.open(str(root / "input" / "brochure-naama.pdf"))
print("pages", doc.page_count)
for i, page in enumerate(doc):
    t = page.get_text().strip().replace("\n", " | ")
    print(i + 1, page.rect, "text:", t[:600])
    if len(sys.argv) > 1 and sys.argv[1] == "png":
        pix = page.get_pixmap(dpi=int(sys.argv[2]) if len(sys.argv) > 2 else 50)
        pix.save(str(here / f"brochure-p{i + 1:02d}.png"))

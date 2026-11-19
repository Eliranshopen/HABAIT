# File inventory — Harei Zahav, Moshav Na'ama

Scanned 2026-11-17, recursively, under `C:\RnD\Projects\Harey_zahav_Naama\`. The originals are read-only. They were copied to ASCII names in `input/` and their hashes recorded. No original was changed.

| # | Original path (under `נעמה/`) | Copy in `input/` | Kind | Size | sha256 |
|---|---|---|---|---|---|
| 1 | `תוכנית צבעונית/00 (1).png` | `plan-hatzav-colour.png` | Raster colour sales plan, 2083×1531 px, 150 dpi, RGB, no vectors, no text layer | 277,297 B | `f2262e24…6d987aee` |
| 2 | `ספר פרויקט וסרטון/חוברת נעמה קל.pdf` | `brochure-naama.pdf` | Project brochure, 11 pages, InDesign → PDF 1.5, images plus a few vector frames, no live text | 2,610,040 B | `daad3e6a…7a6fd5` |

Derived inputs:
- `brochure-p05-exterior-render.png`: the embedded 1606×830 image from p.5, xref 149. This is the developer's exterior render of model Hatzav.
- `brochure-p05-plan-rotated.png`: p.5's plan region at 5×, rotated 90° to the PNG's orientation.

## Added during the job: the developer's interior renders (2026-11-17, 14:37–14:39)
I scanned the folder at 14:14 and did not scan it again until Eliran asked about these renders. The first model was built without them. Since Eliran's ruling ("layout + look from the renders, walls by the sales plan"), they are the source of the furniture layout of the public space and of the whole look. All nine are 1200–1500 px JPEG still renders (Corona) in the project root:

| File | Bytes | sha256 (first 16) | Shows |
|---|---|---|---|
| `1_CShading_LightMix.jpg` | 133327 | 5b8eee07f8ff37a4… | kitchen: tall oak column with two ovens, sink under the window, light-oak wall units, island with 4 stools |
| `Corona-Camera0020000_Post-3.jpg` | 107399 | f316d07db4b9bb99… | bathroom: oak vanity, black mirror and taps, beige stone |
| `Corona-Camera0020000_Post_LightMix-Interactive.jpg` | 121725 | af475f4012f55bf5… | living → dining shelf and kitchen |
| `Corona-Camera0030000_Post.jpg` | 110588 | d897af283a7c6d1e… | the safe room as a child's room (Eliran: "yes, it is the safe room") |
| `Corona-Camera0040000_Post.jpg` | 127357 | 3729a4edbc86a970… | dining table, open oak shelving, rattan pendants |
| `Corona-Camera0050000_Post_LightMix-Interactive.jpg` | 150154 | bb0d946d6693cbf2… | rattan lounge chair, round table, tall shelves |
| `Corona-Camera0060000_Post_LightMix-Interactive.jpg` | 112449 | 8ca24759cd9d0be3… | TV wall with console, tall double bookcase, sofa from behind |
| `Corona-Camera0070000_Post.jpg` | 101300 | f7cd7d8c06012104… | child's room shelving (detail) |
| `Corona-Camera0070000_Post_LightMix-Interactive.jpg` | 117933 | 935696747a33a157… | dining by the glazing, shelving wall |

## The brochure page by page

| Page | Content | Relevant to the house? |
|---|---|---|
| 1 | Cover: moshav logo, lifestyle photo collage, הרי זהב logo | no |
| 2 | Aerial photo of the moshav. Text: founded 1982, ~70 families, pool, club, library; 45 min from Jerusalem | context only |
| 3 | Regional map and site plan of the lots (stage A / for sale now / public). No north arrow per house, but a north arrow on the site plan | context; the lot is not identified |
| 4 | Landscape photo (green hills) | context: the view outside |
| **5** | **Model Hatzav (דגם חצב): 3 rooms, 80 m², garden. Exterior render + plan.** The plan equals file #1. | **YES: the selected model** |
| 6 | Model Ela (דגם אלה): 4 rooms, 100 m², garden | no (4 rooms) |
| 7 | Model Eshel (דגם אשל): 5 rooms, 133 m², garden | no (5 rooms) |
| 8 | Model Rotem (דגם רותם): 7 rooms, 200 m², garden, two storeys (render) | no |
| 9 | Model Rotem plans (ground and upper floor) | no |
| 10 | Other projects of the developer | no |
| 11 | Back cover | no |

Every plan page carries the developer's caveat: "הדמיות ותכניות אלו מהוות העמדה ראשונית ועשויות להשתנות בעתיד". The renders and plans are a preliminary presentation and may change.

## What the sources do NOT contain
- No CAD, DXF, IFC or vector plan. The only plan is a raster.
- No sections, elevations or heights.
- No specification or finishes list (מפרט), and no price list.
- No north arrow on the house plan, and the lot is not identified.

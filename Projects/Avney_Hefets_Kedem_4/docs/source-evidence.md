# Sources, verification and apartment selection (2026-11-17)

Covers the four reports the brief asked for: file inventory, source verification, apartment selection and source evidence.

## 1. File inventory (`C:\RnD\Projects\Avney_Hefets_Kedem_4`, read-only)
| When | File | Kind | Notes |
|---|---|---|---|
| 14:33 (first look) | `אבני חפץ - קדם/ספר פרויקט וסרטון/חוברת קדם חדשה 280125 03 (1).pdf` | brochure, 23 pages, InDesign, mixed (raster plans + vector text) | building plans pp. 6–21, spec p. 4 |
| 14:33 | `אבני חפץ - קדם/תוכנית צבעונית/בניין 4/*.jpg` | 10 coloured sales sheets, Building 4, 300 dpi raster | 7 sheets are 4-room types (104–121 m²) |
| **15:01 (Eliran's replacement)** | `בניין 1-2 דגם יורד קומה א דירות 7-8.jpg` (5613×3148, 300 dpi, sha256 `eabcb844…3225`) | one coloured sales sheet, raster | **the only file in the folder since 15:01, the authoritative source** |

No DWG/DXF/IFC exists in the project. No section or elevation exists.

## 2. Scope ruling
- The brief said "Building 4 + 4 rooms only".
- At 15:01 Eliran replaced the folder content with the sheet above and wrote: «לך שוב לתיקייה … יש לך את התכנית מכר של הדירה הרלוונטית». After that he wrote «תתעלם מההוראה המקורית שצריך להתייחס רק לבניין מספר 4».
- **The apartment is therefore the one on that sheet.** The Building 4 sheets (see 14:33) were inventoried only and are not used for geometry.

## 3. The selected apartment (VERIFIED from the sheet's title block)
| Field | Value | Evidence |
|---|---|---|
| Project | אבני חפץ – קדם | folder; brochure p. 1 |
| Model | דגם יורד | sheet title |
| Buildings | 1–2 | sheet title |
| Floor | א׳ | sheet title |
| Apartment | 7 (8 = mirror image) | key plan + caption «דירה 8 היא תמונת ראי של דירה 7» |
| Rooms | 4 rooms + balcony | sheet title |
| Area | 94 m², balcony 7.39 m² | sheet title; brochure p. 7 lists building 1 floor 1, 4 rooms, 94 m², balcony 7.39 m² (consistent) |

## 4. Geometry evidence
Every printed room dimension was checked wall-face to wall-face on the traced model. The scale is 2.2681 px/cm (least squares through the origin over 14 values).

| Room | Printed (w/d cm) | Model | Max deviation |
|---|---|---|---|
| Kitchen | 238/337 | 238.1/336.8 | 0.05 % |
| Living | 415/492 | 416.2/493.4 | 0.29 % |
| En-suite bath | 155/185 | 153.9/183.4 | 0.86 % |
| Master bedroom | 340/325 | 340.4/325.4 | 0.12 % |
| Bedroom / safe room | 325/270 | 322.7/271.2 | 0.70 % |
| Bathroom | 342/187 | 339.9/184.7 | **1.21 %** |
| Bedroom | 335/270 | 336.0/271.2 | 0.43 % |

- 13 of 14 values are within 1 %; all 14 are within 2 % (the hard cap).
- Balcony measured 7.35 m² against 7.39 m² printed.
- Wall tracing: the flat grey fill (RGB 121) was segmented and turned into an axis-aligned grid. The grid matches the wall mask with IoU 0.987.
- Overlay of the model on the sheet: `out/…/qa/plan_overlay.jpg`.

**Classification** (full list in `plan/plan.json`):
- VERIFIED: walls, openings (position and width), room layout, sanitary fixtures, kitchen run, wardrobes, beds.
- DERIVED: scale, areas.
- ASSUMED (`plan_meta.assumptions`):
  - ceiling 260 cm
  - door heads 210 cm, safe-room door 205 cm
  - window sills
  - railing 105 cm
  - balcony roof line
  - upper kitchen cabinets
  - finishes the spec does not name
  - sun direction

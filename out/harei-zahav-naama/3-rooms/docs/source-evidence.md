# Source evidence — what the model rests on

The geometry of record is `geometry/geometry.json`. It is written by `scripts/04_geometry.py` and checked by `scripts/05_check_geometry.py`, whose result is `qa/geometry-check.json`. Every element carries a class:
- **VERIFIED:** drawn or printed on the sheet.
- **DERIVED:** computed from the sheet, or read from the developer's render.
- **ASSUMED:** needed for 3D but in no source.

## Scale
- **Scale: 1.000 px per cm**, fitted on the eight overall dimension lines of the PNG.
- The lines measure 832–833 px (830 printed) and 1052–1053 px (1050 printed), which includes the tick marks.
- From wall face to wall face the outline measures 830 × 1050 px exactly.
- Every printed overall dimension (830, 725, 105, 1050, 540, 510, 50, 780) is met to 0 cm.

## Printed dimensions against the model

| Printed | Span | Model | Δ |
|---|---|---|---|
| 830 / 725 / 105 | overall width / north block / set-back | 830 / 725 / 105 | 0 |
| 1050 / 540 / 510 | overall depth / north block / south block | 1050 / 540 / 510 | 0 |
| 50 / 780 | offset of the south block / its width | 50 / 780 | 0 |
| 335 × 270 | safe room, wall to wall | 335 × 270 | 0 |
| 315 × 410 | bedroom, wall to wall | 315 × 410 | 0 |
| 295 | bedroom, clear of the 20 cm wall band | 295 | 0 |
| 180 × 190 | bathroom | 180 × 190 | 0 |
| 730 | public space width | 730 | 0 |
| 500 / 565 | public space depth, kitchen / living side | 500 / 565 | 0 |
| 400 | living width east of the shaft | 400 | 0 |
| 300 | deck depth | 300 | 0 |

- **Interior faces were placed so that every printed room dimension is met exactly (the print wins).** They sit 0–2 cm from the drawn wall edges, inside the sheet's anti-aliasing.
- **Wall agreement:** of 89,323 grey wall pixels on the sheet, 0.54 % lie further than 2 cm from the model's walls (bar: 1 %). The visual check is `qa/wall-diff.png`.

## Areas
- **Gross footprint: 80.02 m²** (printed 80).
- **Public space: 39.6 m²** (printed 39). The difference is the 0.6 m² of the hall mouth counted in it.
- **Safe room: 9.04 m²** (printed 9).
- **Bedroom: 12.66 m²** wall to wall, **12.10 m²** without the 20 cm band (printed 12).

## Conflicts and how they were resolved

| # | Conflict | Resolution |
|---|---|---|
| C1 | The deck prints "-300-" and "-380-". The drawn deck is 300 × 614. | The drawing is modelled (300 × 614). "380" matches neither side of the deck; it may be a leftover from the Ela/Eshel sheets, whose decks are 380 × 300. Flagged, not used. |
| C2 | A pergola appears in the developer's render (brochure p.5) but not on the plan. | Modelled as DERIVED in its own collection `01b_Derived_Pergola`, which can be hidden. |
| C3 | The exterior render shows one window on the side wall, the plan two windows on the south wall. | The render is a marketing image ("preliminary, may change"). The plan wins: the model follows the plan. |
| C4 | The dashed 825 × 433 outline east of the bedroom. | Read as an optional extension envelope (725 + 825 = 1550 = model Eshel's length). Not built, not modelled. |

## The interior renders and where they depart from the sheet (DERIVED)
Since Eliran's ruling on 2026-11-17, the public space's furniture follows the developer's Corona renders (`file-inventory.md`). The sheet's own furniture of that space is kept for the record in `geometry.json` → `plan_furniture_public`. Walls, windows and doors stay by the sheet.

| Element | Sheet | Renders, as modelled | Note |
|---|---|---|---|
| Kitchen | L-shaped (west and south runs), fridge and tall unit on the west wall | same runs. On the south wall, a tall dark-oak column with two ovens (where the sheet's south run ends). Light-oak wall units on the west wall; the fridge and the tall unit become integrated tall light-oak columns | |
| Island | not on the colour sheet; a pale rectangle on the brochure's copy of the plan | island 190 × 95 with 4 stools on the north side | the render's island looks ~220 long; shortened to keep a 70 cm passage to the sofa |
| Dining | table at the plan's centre, by the kitchen | table 180 × 90 by the glazing, in front of an oak shelving wall on the south wall | |
| Shelving wall | none | 240 wide on the south wall | the render's shelving runs into the corner over the living-room window; the sheet's window is kept, so the shelving stops before it |
| Living | corner sofa along the north and east walls, TV on the south wall | sofa facing north to the TV on the bedroom partition, tall double bookcase in the set-back corner, rattan chair, round table | turned around compared with the sheet |
| Safe room | bed, desk, closet | a child's room: upholstered bed, desk, open oak bookcase where the closet is drawn, paper lantern | |

## ASSUMED (no source)
- **Heights:**
  - ceiling 270
  - doors 210, the safe-room door 200
  - window sills 100–105 and heads 210
  - sliding door head 220
  - roof slab 20, parapet top 330
  - deck at −2, ground at −15
- **Finishes:** porcelain floor 80 × 80, white walls, oak cabinetry, marble-look worktop, anthracite aluminium frames.
- **Loose furniture styling** and all decor. Every drawn piece stands in its drawn box; only its look is a choice.
- **Sun direction and view:** no north arrow. The HDRI is "dry_orchard_meadow" (Poly Haven, CC0), chosen to match the brochure's landscape and the render's orchard garden.
- **Readings of ambiguous symbols:**
  - 65 × 88 box = fridge (DERIVED)
  - 60 × 62 box = oven tower (DERIVED)
  - 20 cm band in the bedroom = shallow TV wall unit (DERIVED)
  - crossed circle in a square = closed service shaft (DERIVED)

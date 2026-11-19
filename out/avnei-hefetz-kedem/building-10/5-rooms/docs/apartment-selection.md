# Apartment selection and source verification

## Selected: Building 10, floor 1, apartment 3 — 5 rooms, 108 m², balcony 8.8 m²

| Check | Evidence | Result |
|---|---|---|
| Building number | sheet title "בניין 10"; brochure p. 41 title "בניין 10" | VERIFIED |
| Floor | sheet "קומה 1"; brochure p. 41 floor strip, the "1" highlighted | VERIFIED |
| Apartment | key plan on the sheet: unit 3 shaded; caption "apartment 4 is the mirror image of apartment 3" | VERIFIED: the drawing is apartment 3 |
| Room count | sheet "5 חדרים + מרפסת"; brochure p. 41 "5 חדרים". Counted on the plan: living room, parents' bedroom, safe room / bedroom, bedroom 265/380, bedroom 325/270 | VERIFIED, 5 = 4 bedrooms + living room |
| Area | sheet 108 m² / 8.8 m²; brochure the same; the model's outer outline is 107.2 m² | VERIFIED (−0.7 %) |
| Same drawing as the brochure | the layout on p. 41 matches the sheet room for room | VERIFIED |

**Why this one.** At 15:03 Eliran put this single sheet in the project folder and named it the relevant apartment. At 15:25 he cancelled the Building 4 restriction. The earlier Building 4 reading, which found that the only 5-room plan in Building 4 is floor −2, apartment 7, is kept in `../../building-4/5-rooms/` and marked SUPERSEDED.

**Variants that were not used.** Building 9, floor 2 (brochure p. 39) has the same plan with a 10 m² balcony and a garden; it is a different unit. Apartment 4 is the mirror image. Other 5-room types are 104, 123 and 124 m².

## Every element and where it comes from
`geometry/geometry.json` holds each element with its class. The sources are the sheet (`input/b10-floor1-apts-3-4.jpg`) and the brochure p. 41 for the area figures.

| Element | Class | How it was read |
|---|---|---|
| Walls and their thickness | VERIFIED | wall fill extracted by colour (grey 121 ± 14, 9 px opening). The model's walls match the sheet's wall pixels at IoU 0.945 |
| Scale | DERIVED | 2.2965 px/cm, least squares over the 18 printed room dimensions. 17 of 18 are within max(2 %, 5 cm); the WC depth (79 printed, 84.5 measured) is the one outlier |
| Doors: position, width, hinge side, swing | VERIFIED | drawn arcs, read on gridded zooms (`work/zoom-*.jpg`) |
| Window positions and widths | VERIFIED | blue glazing on the sheet |
| Ceiling 2.60 m, sills, door and window heads | ASSUMED | the documents have no section or elevation |
| North | ASSUMED | sheet up; the sheet has no north arrow |
| Kitchen runs, sinks, hob, fridge, bathtub, toilets, vanities, shower, washer | VERIFIED plan position, ASSUMED height | |
| Upper kitchen cabinets, cooker hood | ASSUMED | not drawn |
| Furniture | VERIFIED position, decor | drawn on the sheet. The parents' bed symbol is drawn at 148×157 cm; it is modelled at 160×200 on the same wall and centre line |
| Light well beside bedroom A and the WC | DERIVED | white void with two windows facing it; open to the sky ASSUMED |
| Balcony outline | VERIFIED | railing type ASSUMED: low parapet with dark bars, as in the brochure renders |
| View outside | ASSUMED | green hills HDRI (the brochure says the site has open views) |

# Architectural QA — Building 10, floor 1, apartment 3

Date: 2026-11-17. Evidence for every row is in `qa/`.

| Check | Result | Evidence |
|---|---|---|
| Correct building / floor / apartment | PASS — Building 10, floor 1, apt 3 (sheet title, key plan, brochure p. 41) | `docs/apartment-selection.md` |
| Room count | PASS — 5 (living + 4 bedrooms incl. the safe room), 2 bathrooms + guest WC, balcony | sheet |
| Apartment area | PASS — model outline 107.2 m² vs printed 108 (−0.7 %) | `geometry-check.json` |
| Printed room dimensions | 17/18 within max(2 %, 5 cm); WC depth 79 printed vs 84.5 drawn (+5.5 cm) — the sheet's drawing is kept | `work/scale-fit.json` |
| Wall positions and thickness | PASS — model walls vs sheet wall fill: IoU 0.945; 1.8 % of sheet wall pixels missing, 3.8 % extra (edge antialiasing, 3 hand-closed pieces listed in `geometry.json`) | `geometry-overlay.jpg` |
| Doors: position, width, hinge, swing | PASS — 8 doors read on gridded zooms; entrance shown closed, the rest open | `model-only.jpg`, walk screenshots |
| Windows: position, width | PASS — 9 windows + the 3-sash balcony slider | same |
| Window sills / heads, ceiling 2.60 m | ASSUMED — no section or elevation exists | `geometry.json` meta |
| Fixtures (kitchen U-run, 2 sinks, hob, fridge, bathtub, 3 toilets, 2 vanities, shower, washer, guest basin) | PASS on plan position; heights ASSUMED; upper kitchen cabinets and cooker hood ASSUMED (not drawn) | overlay |
| Furniture | as drawn on the sheet; parents' bed modelled 160×200 (sheet symbol 148×157); nothing added that the sheet does not draw (no TV) | overlay |
| No skirting boards | PASS (Eliran 2026-11-10) | walk screenshots |
| Walkthrough loads, no errors | PASS at 1440×900 and 390×844, 0 console errors, 0 failed requests | `qa/walk/check.json` |
| Walking works and stays on free floor | PASS — 2.15 m in 2 s of ↑ on both sizes, still on free floor; 15,780 free 5 cm cells | `check.json` |
| Every room reachable | PASS — 8 room stops (living, kitchen, parents, safe room, 2 bedrooms, bath, balcony) screenshotted at both sizes | `qa/walk/*.png` |
| Frame rate | headless software rendering: 60 fps phone setting, 17 fps desktop setting (with the ambient-occlusion pass, no GPU in the check). A real GPU will be faster; not measured on a device | `check.json` |
| Disclosure | «הדמיה» badge + "simulation from a 3D model by the sales plan; furniture and finishes illustrative; ceiling height, sills and view assumed" on every screen (the text hides on phones under 600 px wide; the badge stays) | screenshots |

## Known limits (not fixed)
1. Lighting is real-time (sun with shadows, sky light, ambient occlusion, a warm fill per room): clean and correct in direction, but not photoreal global illumination. The road to photoreal is either a light bake in Blender (needs the machine's Blender lock for about 1–2 hours) or pictures Eliran supplies, as he asked (no generation).
2. The view outside is a CC0 landscape sky, not the real site.
3. Mirrors are a satin grey, not a live reflection.
4. Furniture is modelled in simple shapes with real fabric and wood textures; only plants, vases and the pendant are scanned models.
5. North is assumed to be up on the sheet; the sun direction follows that assumption.

## RAINBOW baseline features (studio.js) — 2026-11-17
Rule: root CLAUDE.md §8.10; checklist C:\RnD\docs\rainbow-baseline-features.md. Check: `scripts/13_studio_check.mjs` → `qa/studio/` (1440×900 and 390×844), 0 page errors both.
| # | Feature | Here | Evidence |
|---|---|---|---|
| 1 | Swap circles → finishes / other model / remove, item card | built, $0: the 3D piece itself changes (RAINBOW pays for an image edit) — 15 furniture targets + 8 accessories | `*-1-rings`, `*-2-pick-sofa`, sofa → navy, vase → wooden bowl |
| 2 | Free-text design line | built, $0: read locally (Hebrew + English: target + colour/material); structure changes and unclear text refused | "קירות בירוק מרווה ורצפת פרקט ושולחן אוכל שחור" → 3 ops |
| 3 | Undo · show original · reset · list | built | ops 4 → 3 after undo; original restores the wall |
| 4 | «שינוי שלכם» tag + «הדמיה» badge + note | built | all shots |
| 5 | Finish sets: floor (5), walls (6), kitchen fronts (8), countertop (4) | built | `*-4-design-sheet` |
| 6–7 | Original look / prepared examples | built as "show original" + 3 presets | `*-6-preset-dark` |
| 8–10 | Room navigation, click-to-move, plan with view cone | existing walk | `qa/walk/` |
| 11 | 3D dollhouse | built (ceiling lifted, drag turns, zoom) | `*-8-dollhouse` |
| 12 | View-modes menu | built as the «כלים» menu | `*-7-tools-menu` |
| 13 | Measure | built (two points on the model) | 3.35 m / 1.91 m |
| 15 | Button walkthrough | built (5 cards) | `*-11-coach` |
| 16 | Zoom, slow turn, reset view, full screen | built | — |
| 17 | Hide controls | built as a menu item (a tap here means walk) | — |
| 18 | Language | he / en (no fr) | `*-10-english` |
| 21 | Share link | built: changes + position in the URL; reopened with the same 4 changes | `*-12-shared-link` |
| 14 | Voice tour | left out: needs a recorded script/voice (Eliran's material) | — |
| 19–20 | Back to building, room/intro video | left out: no exterior model or film for this building | — |
| — | Item price / IKEA link | left out: no real product catalog here (RAINBOW's IKEA photos await IKEA's permission) | — |
Swaps are real-time only; the baked-light mode (`?baked=1`, still mottled after run 6) hides them.

## Interface, real model swaps, time of day, the look of Eliran's pictures — 2026-11-17 (late)
- Interface: RAINBOW's interface only (Eliran: never its furniture or items) — house tokens, Heebo, place card, toolbar with menus (views / tools / change design / help / language), zoom rail, numbered room cards from this model (`scripts/14_room_thumbs.mjs`), pager, floor labels to rooms, pick bar with picture cards.
- Real model swaps ($0, CC0 Poly Haven, `scripts/15_fetch_furniture.py` → `work/furniture-manifest.json`, 21 models 35 MB): sofa ×3, coffee table ×3, dining table ×3, chairs ×3, nightstands ×3, plants ×5, vases ×6, pendant ×2; placed on the drawn rectangle, facing the drawn front.
- Time of day: the `day-night-keyframes` skill's four keys and clock (7:30 / 12:30 / 17:30 / 21:30, 6–22, start 14:00, ▶), mixed live as light parameters (`walk/daynight.js`) instead of baked atlases (the swap needs live light; the bake is still mottled). Gate: midpoint 15:00 → noon/golden weight 0.50.
- Look from `input/supplied/*.png` (Eliran 22:10): `scripts/16_look_from_renders.py` (colours sampled from the pictures; procedural veined marble — Poly Haven's marble_01 is limestone tiles), build.js dressing (white doors + black handles, silver frames, white handleless kitchen with black plinth, no uppers/hood, stone TV column, glass dining table, tufted headboards, slatted oak, mushroom lamps, sheer curtain, ceiling spots, marble to 1.2 m with full height at shower/bath), neutral tone mapping. Side by side: `qa/compare/sheet.jpg` (camera spots by eye).
- Furniture from the pictures over the sheet: bedroom 265/380 has one double bed (picture 09) where the sheet draws two singles (walk.js, class ASSUMED from picture 09).
- Kept from the brochure against the pictures: wall-hung toilets (pictures show close-coupled). No skirting (Eliran's rule 2026-11-10), though the pictures show one.
- Checks: `13_studio_check.mjs` 0 errors 1440/390, no overflow, link round trip 5 ops; `10_walk_check.mjs` 0 errors; `work/reach.mjs` every room reachable. Desktop measure blank in the scripted run only (a sequence artefact; direct run `work/measure.mjs` → 4.41 m).
- Balcony from picture 12 (Eliran, after 22:10): solid white parapet to 1.05 m (no balusters), covered by the balcony above, dark grey composite deck, marble bistro table, woven rope armchairs with grey cushions, tall black planters with succulents. Side by side `qa/compare/12.jpg`. Open: the view outside (picture: suburban red roofs; ours: the HDRI hills) and the kitchen (picture 12 shows wall cabinets and a steel fridge, picture 02 shows neither).

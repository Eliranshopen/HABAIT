# Avnei Hefetz apt 7: the Rainbow tour features in the 3D walk (2026-11-17)

**Ask (Eliran, 2026-11-17 evening):** «אני רוצה את כל הפיצ'רים ששקיימים בפרויקט של RAINBOW כמו שינוי ריהוט או אביזרים ע"י לחיצה על העיגול שיש עליהם וגם שורת טקסט חופשי לעיצוב … בנתיים אתה יכול לעבוד על זה»
- **Reference:** `C:\RnD\Projects\Habait`, read only.
- **Standing rulings:** a walk, not 360; no AI generation for this apartment.

**Where:** worktree `.wt/avnei-hefetz-kedem-4`, project `Projects/Avney_Hefets_Kedem_4/`. Nothing committed.

## The Rainbow features, and the walk's equivalent
| Rainbow tour360 (`viewer/tour.js`) | The walk (`tools/walk/walk3d.js`) |
|---|---|
| A ring on every replaceable piece → a paid replace turn (Nano Banana + catalog photo) | A ring per piece per room; tap → model (2–3 per slot) + colour + accessories, instant, $0 |
| Free-text change bar → OpenRouter + fal editor (paid image edit) | Free-text bar read in the page (Hebrew/English words → colours, finishes, models, styles, accessories); structural asks refused; $0, nothing generated |
| «שינוי עיצוב» panel: look, floor finishes, the bar | The same panel: styles (5), floor (9 finishes), wall colour, kitchen fronts and worktop, day/evening tone |
| Undo, compare with the original, reset | Undo, before/after, reset, and a link that carries the design (`#d=`) |
| Plan sheet, 3D dollhouse, ruler | Plan with "you are here" (tap to go), view from above (tap the floor to enter), tape measure |
| Not carried | Guided coach with music, room videos, languages fr/en |

## How (a re-bake, no generation)
- **Bake:** `walk3d_bake.py`.
  - Every face carries its part (piece × material) in a `part` UV map.
  - Two atlases per group: the light (`--pass light`) and the colour (`--pass albedo`).
  - The page draws light × colour, so a colour or floor change repaints over the true baked light.
- **Swap-in pieces:** `walk_variants.py`.
  - Each is built on its slot's sales-plan footprint.
  - Each is lit from its slot's mean baked light.
- **Wall art:** goes only on a living-room wall run with no opening (the add-only rule).
- **Design data:** `tools/walk/design.json`, holding the pieces, palettes, floors, variants and styles.

## Evidence
- `out/…/qa/walk3d-design/design-check.json`: PASS, 23 steps, desktop 1440 and phone 390, no errors, no page overflow. Screenshots d01–d12 and p01–p04.
- `out/…/qa/walk3d-design/walk/walk-check.json`: walking unchanged (4 m, wall stop, 14 views).

## Open (Eliran's)
- His inspiration pictures will set the default look. It is now a design-data change at most; no re-bake is needed for colours and floors.
- Deployment: his go.
- An offline three.js copy: an install, his go.

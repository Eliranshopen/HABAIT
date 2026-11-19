# Blender walk proof — continuous walking through apt846 (2026-11-12)
**State:** BUILT (round 2) — the walk on the tour's own pictures, on the test link, waiting for Eliran's look. $0.

## Why
Eliran 2026-11-12: «אני לא רוצה לוותר על אופציית התנועה בדירה כאילו מישהו הולך בה ואני חושב שאפשר לשפר את הדמיית הדירה ע"י שימוש בבלנדר». The tour's 11 fixed pictures can only jump; the Blender model can be rendered from anywhere, with exact depth. He said yes to a small proof before deciding.

## What
1. Look pass on the furnished scene (`360walkaround/pipeline/walk_look.py`): wood floor, no skirting boards, white doors, daylight, the suite door open. Geometry untouched.
2. Ten walk points, about 1 m apart: entrance → living room (5) and entrance → the suite door → the wardrobe corner (5 more), each a Cycles 360 picture + depth map (`360walkaround/tours/apt846-walk-proof/`).
3. A page (`Habait/tour360/walk-proof/`) that draws each picture as a 3D shell from its depth and moves the camera through space, cross-fading two shells between points: a step stops anywhere. Desktop: hold ↑ ↓, ← → turn, click the floor. Phone: drag, tap the floor (no arrow buttons).
4. At the entrance and living-room points a button shows the shipped tour picture from the same spot, for comparison.
5. QA: `walk-check.mjs` at 1440 and 390, local then live. Test link only.

## Open (Eliran's calls)
- Is the walking right? Is the Blender look good enough, or must the realism come closer to the shipped pictures (better furniture models, materials, a city view outside, 4K–8K renders)?
- If yes: the whole apartment (about 60–80 points, hours of rendering at $0), and whether it replaces the tour's movement or sits beside it.

## Changed 2026-11-12 — the walk on the shipped pictures (Eliran: the look as realistic as the tour, with walking)
- The tour's own 11 pictures + the model's depth from the same spots; routes on the plan along every tour door link (kitchen, corridors, terraces). BUILT: `/walk/` on the test link `dpl_2gWGKMtwxKMeChz3VuLUhZyM8nJx` (stage `test-r39`); the Blender proof at `/walk-blender/`.
- Limit found: mid-way between two viewpoints the pictures' furniture smears (it is not the model's furniture). Options for Eliran: as is ($0); depth from each picture (~$0.1); in-between realistic viewpoints (~$1–2 each).

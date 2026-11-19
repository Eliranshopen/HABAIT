# Kedma D/1 — the tour redone on true geometry
<!-- last-updated: 2026-11-17 -->

**State: APPROVED by Eliran 2026-11-17 («אני מאשר תתקדם») — a hard ceiling of $45 for the whole project; the kitchen first, his look, then the other rooms. Step 7 DONE the same day: the kitchen is redone and stands in the local tour (`http://127.0.0.1:8890/p/kedma-d1/tour/?room=kitchen`); his look and his two calls came the same day (the house look stays; hills in front, sky and soft green elsewhere), with a rule for the viewer (eye level, zoomed-out first look). **Step 8 (the other 12 viewpoints) is OPEN.** Spent $29.20 of $45.** The page he reads for this gate (private, three browser pictures of the new kitchen, what was fixed, what is not perfect, the money, the two calls): https://claude.ai/artifact/CCfE3GPDeK4c4YH9ASQhpD — the developer's renders are not on it (not published without his word). Owner of every ruling: Eliran. Work: git worktree `C:\RnD\.wt\kedma-d1` (branch `kedma-d1`, nothing committed), job files `Projects/3Dengine/jobs/kedma-d1/`.


**Ceiling raised 2026-11-19 (Eliran, question dialog):** $45 → $48 for the whole project (ledger cap 47.9), for a GPT Image 2.5 attempt on the balcony panorama ($0.60 a try, up to 3).
**Resume point 2026-11-18:** step 8 at 10 of 13 (bath in progress, mamad and balcony left); deployed on Eliran's go to https://kedma-d1.vercel.app; $40.18 of $45. Next steps in order: repo memory `memory/project/2026-11-16-kedma-d1-simulation.md`, last section.

## Why this plan exists
On 2026-11-17 Eliran looked at the tour and rejected it, with screenshots: the kitchen island crooked, the view like a fish eye, furniture and doors blurred, the passage to the rooms missing, the corridor arrows on the wrong doors. His ruling: *the visitor must feel he sees a real apartment; go over the sales plan and match directions and proportions; ask questions; no more paying for one fix after another — work on everything properly from the start.*

What was found, at $0, against the sales-plan sheet and the CG:

| What he saw | The cause |
|---|---|
| island crooked | the island is rotated 28° **in the 3D model** (a furnish rule aimed an island at the nearest counter's centre); the picture copied it |
| arrows on the wrong doors | the arrows are on the plan's true door bearings; the AI picture draws the corridor's end door ~7° right and ~8° up of the CG |
| no passage to the rooms | beside the entrance door the CG shows the family room through the corridor mouth; the AI picture painted a wall with a console and a mirror |
| blur | skinned at 2048×1024; Rainbow was generated at 3840×1920 |
| fish eye | first look ~94° across, and the shifts above break the perspective |
| (found in the audit) | the bathtub, the washer, the dryer and the two loungers of the sheet were **never built** in the 3D model (no rule for those kinds); a template bistro set stands where the loungers are drawn; a few chairs and bedside tables were dropped; the shower camera stands 19 cm from the vanity |

One root: a whole-panorama AI picture per room is not geometry-true, and the 1 % gate compares wall depth only, so it passed all of it.

## The method
1. **The 3D model equals the sales plan** ($0). Every fixed fixture and every drawn piece of furniture is checked on an overlay of the sheet and built where and as it is drawn (Eliran, 2026-11-17: «בדיוק כמו בתוכנית»).
2. **Every picture is painted on the model's own view** (paid, once). Each room is cut into straight-line views; the image model receives the CG view alone and turns it into a photograph; nothing of the old pictures is shown to it.
3. **Every answer is checked before it is accepted** ($0): its edges against the CG view's edges (a shift or a zoom is put back; an edge with no source in the model — an invented door — is a refusal), and what is seen through each opening against the next room.
4. **The panorama is assembled at 4K** from the accepted views; ceilings and the floor under the camera come from the model.
5. **The viewer**: a natural first-look angle; the arrows are checked on the final pictures; the 3D view is re-exported from the corrected model.
6. **Switchable flooring** as in Rainbow (Eliran, 2026-11-17; the look itself stays the current house look).

## Steps and status
| # | Step | Cost | Status |
|---|---|---|---|
| 1 | Island: front snapped to its own axis (`furnish_from_plan.py`, `PORT-CHANGES.md`) | $0 | DONE 2026-11-17: applied to the tour plan, kitchen CG re-rendered, the island stands parallel to the walls (`jobs/kedma-d1/review/flat/kitchen-island-cg-before-after.jpg`) |
| 2 | Bathtub, washer, dryer, loungers built as drawn; undrawn template pieces removed; stools as bar stools, the pouf as a pouf, tall units as cabinet columns | $0 | DONE 2026-11-17 (`pipeline/PORT-CHANGES.md`, 7 rows; `hand/fix_fixtures_1117.py`): 81 items, 0 dropped |
| 3 | Overlay of every fixture and piece on the sheet, room by room | $0 | DONE 2026-11-17: `review/flat/sheet-room-*.jpg`, `built-all.jpg` — the built model stands on the sheet in every room |
| 4 | Camera points: clear of large furniture, no point within 60 cm of a fixture | $0 | DONE for the rule set of 2026-11-17 (`jobs/kedma-d1/cameras-1117/`); the tour runs a MIXED set until each room is redone (`hand/mixed_cameras.py`) |
| 5 | CG re-rendered from the corrected model | $0 | the kitchen DONE (3072×1536, 461 s); the other 12 with step 8. Rendered from the render base (`hand/render_base.py`), never through the runner's `furnish` step |
| 6 | The per-view acceptance check | $0 | in use: registration + refusal of a re-framed answer (`hand/room_paint.py accept`), seam tone matching, edge sheet (`hand/flatcheck.py`), look sheets level / down / up (`hand/look_sheet.py`). NOT yet automatic: an invented piece on the floor was found by eye only (see the lessons) |
| 7 | One viewpoint end to end (the kitchen), shown to Eliran before the rest | $1.90 | DONE 2026-11-17: 23 view calls ($1.84; 9 of them repeats or repairs), gate PASS 0.51 % (bar 1 %), 4096×2048 in the tour, QA 1440/390 PASS, seen in a real browser at 1920 (`review/browser/kitchen-1117-*.png`) |
| 8 | The other 12 viewpoints | ≈ $10–12 | RUNNING (look B, 2K, carry-over). Pantry DONE 2026-11-17: gate PASS 0.51 % (pick `02-pantry__redo__v7.png`) after Eliran ruled to fix the gate's calibration (`pipeline/PORT-CHANGES.md`; control: the invented-niche picture still FAILS 2.26 %). Living: 4 level + 2 tilted views painted, $0 finish running. Then dining → … → balcony |
| 9 | Switchable flooring, 3 finishes | ≈ $0–3 | waits for 8. The floor tool (`hand/near_floor.py --whole`) lays a plan-true floor at $0; real material pictures are still to be chosen |
| 10 | Rings re-scanned, gates, 3D view, build, package, QA in a real browser at his framing, every arrow followed | ≈ $1.5 | waits for 9 |

## Day / night (Eliran 2026-11-17 evening: «תשתמש גם בסקיל הזה C:\RnD\.claude\skills\day-night-keyframes ותטמיע אותו כפיצ'ר»)
His three answers (question dialog): (1) the Blender light keyframes are used as LIGHT MAPS over the painted look-B pictures
(painted × keyframe ÷ base render, pixel for pixel; geometry and materials stay), not shown as plain renders; (2) 3 keyframes:
day (the painted picture itself), sunset, night; (3) built AFTER all 13 viewpoints are finished: a proof on the living room
first, then the rest. $0 (Cycles on this CPU), about 2 h of machine time; a clock slider in the tour viewer cross-fades the
two keyframes around the chosen hour. Skill rails kept: light only, the «הדמיה» badge on every picture, pixel-aligned keys
(equal depth hash) checked before use.

## Known leftovers (to clear before the tour is shown)
- Dining (pick `04-dining__redo__v2.png`, gate PASS 0.19 %): pale grey ghosts of the render's larger chairs on the floor beside the painted chairs, and a glossier floor strip under them — seen when looking down at the table. A $0 inpaint did not change them (`review/flat/dining-ghostfix.jpg`).
- Kitchen: two black handles on base fronts in steep down views; the terrace seen from the kitchen to be checked for the same blocks the living room had.

## Money
**2026-11-17 evening: $32.57 of $45** on the apartment ledger after the pantry and six living-room views (plus the $0.10 trace ledger). Three paid answers were rejected in the pantry and the living room (a plain wall given to the image model invented an opening; a tilted view toward a near jamb re-framed; a living view put a door on a corridor wall) — $0.36. Rule since: a close plain wall is filled at $0 (`hand/wall_fill.py`), the skirting the model adds is removed at $0 (`hand/no_skirting.py`), and two answers are combined at $0 rather than paying a third.

**2026-11-17, after the kitchen: $29.20 of $45** (apartment ledger $29.10 + trace ledger $0.10); $15.80 left. The kitchen cost $1.90. **$0.66 was spent by mistake**: `skin-project.mjs --keep-picks` was run without a dry run to make the picture sets; it re-gated the living room's old picture against today's corrected plan (FAIL 14.47 %), sent one whole-panorama call for it ($0.60) and replaced its pick. The pick was put back, the new file is kept, and the sets are made with `make-sets.mjs` ($0) from now on. The estimate for the other 12 viewpoints at the kitchen's rate is $10–12, inside what is left; the margin is thin.

Before the redo: **$26.66 of $30** (apartment ledger $26.56 + trace ledger $0.10). Of it about $22 bought whole-panorama pictures and their repairs, which this plan replaces.

| Item | Reckoning | USD |
|---|---|---|
| rooms | ~100 views × $0.08 (Nano Banana, fal's pricing API: $0.08 per image) | 8.0 |
| repeats | 30 % | 2.4 |
| flooring | 3 finishes × 13 rooms | ≈ 3 |
| rings and gates | | ≈ 1.5 |
| **total new** | | **≈ 15** |

Asked of Eliran: a hard ceiling of **$45 for the whole project** (the $30 he set plus $15). The first estimate, with gpt-image at $0.20 a view, was $35–40 new; he asked what lowers the cost without lowering quality.

**The model test behind the estimate** (2026-11-17, $0.47, one living-room view and one corridor view, `jobs/kedma-d1/review/flat/bakeoff-*.jpg`, `out-06-corridor-e1.jpg`):
- Nano Banana ($0.08): the look equals gpt-image high ($0.60) on the living room and it sat on the CG frame without registration. With the CG view **alone** as input the corridor's doors came out on the plan's lines; with the old picture beside it, it copied the old picture's wrong doors. It also **invented a door** on a pale blank wall: every view needs the plan's list of what it contains and the invented-edge check.
- gpt-image low ($0.06): geometry holds after registration, the furniture is plainer.
- Seedream 4.5 ($0.04) and FLUX.2 pro ($0.13): both copied the old picture's bends. Refused.

## Decisions
| Question | Eliran's answer (2026-11-17) |
|---|---|
| furniture | exactly as the sales plan draws it |
| finishes | keep the current house look; add the switchable flooring of Rainbow |
| scope | the whole apartment, the best look |
| budget | $40 more "is a lot"; on the $15 estimate and the order of spending (kitchen first, his look, then the rest) he approved: **ceiling $45 for the whole project** |

Still his calls from before: the developer's name on the page; the disclosure number (the tree prints «עד 1%», his fixed wording is 2 %).

**Two calls put to him with the kitchen (2026-11-17), after he pointed at the developer's own renders** (`Projects/Pesel_yazamot/עץ אפרים חו_ל/הדמיות-….zip`: two interiors, one balcony, three exteriors, one drone picture; copies in `jobs/kedma-d1/input/dev-renders/`):
| Call | What the developer's renders show | Today |
|---|---|---|
| the look | a cream handleless kitchen wall, an island in pale wood, a pale grey floor, oak shelving, dark sliding window frames | the house look he chose to keep: sand-grey fronts, stainless tops, beige stone |
| the view outside | open hills and sky (the drone picture: the buildings stand on a slope over open land; behind them a retaining wall) | soft green treetops, out of focus |

Read off the same renders, no call needed: the balcony is roofed by the balcony above, with a glass railing and wood-look cladding on the wall; window frames are dark aluminium, sliding.

**His answers, 2026-11-17 («אני הולך עם ההמלצות שלך»):** the look = the house look, as it is; the view outside = the developer's hills in the balcony and in the windows that face the front, sky and soft green in the others (each window's facing is read off the sheet's north arrow and site key before it is painted).

**His two remarks on the viewer the same hour, now a rule for every viewpoint of the apartment:**
| He said | What it was | What was done ($0) |
|---|---|---|
| «נראה כאילו ממצלמת אבטחה … כמו FISH EYE»; «מבט בגובה העיניים», for the whole apartment | a look tilted DOWN (a drag) from standing height at a wide angle; the same in the old pictures and in the new kitchen (`review/browser/his-*-p-32.png`) | `apartment.json` `view.tiltDeg` = 10: the look stays within 10° of eye level, in every viewpoint, desktop and phone; the first look is also the widest zoom (`viewer/tour.js` `tiltBounds`, `PORT-CHANGES.md`) |
| «כל חדר מתחיל מרמת זום מאוד גדולה, אני רוצה יותר ZOOMOUT», with a picture of the view he wants | my own narrowing of the first look (62°, then 50° tall) as a cure for "fish eye" — the wrong cure | `view.vfovDeg` removed: the template's wide first look (85° tall, at most 118° across), which is the view in his picture |

| «כשאני זז ימינה שמאלה יש מריחה … הריהוט לא יתעוות במציאות» | the ordinary projection stretches whatever is near the edge of a wide view | `view.pannini` = 1: the picture is drawn in the wide architectural (Pannini) projection, the tilt as a shift — nothing stretches at the edges, verticals stay vertical at any tilt; arrows, rings and clicks follow (`viewer/tour.js` `PAN_D`, two hooks in the viewer library, `PORT-CHANGES.md`); seen in a real browser (`review/browser/final-kitchen-*.png`, `proj-*.png`) |

**His word on money the same hour («יש מלא טעויות שעולות לי כסף בגללך»): no paid call until he has seen the kitchen in the corrected viewer and said it is right.** Work at $0 goes on (model, renders, tools).

**His three remarks the same afternoon, and what was done (all $0):**
| He said | Done |
|---|---|
| «אין עקביות … כל חדר אמור להיראות אותו דבר מכל נקודת תצפית» | `hand/carry_over.py`: the painted surfaces of a finished viewpoint are carried into the next by the model's depth; the image model finishes only what no finished viewpoint sees. Tried on the pantry (16 % of its picture came from the kitchen). Old viewpoints are named «תמונה ישנה, תוחלף» in the tour (`hand/mark_old.py`) |
| «הכל נראה מאוד זול, חייב להרים את הדירה רמה מעל» | the kitchen's look is NOT approved. A look test is prepared and not run: one kitchen view, two variants at 2K (A = the developer's renders, B = oak, veined stone, marble-look floor), $0.24 (`jobs/kedma-d1/look-test-A.txt`, `-B.txt`); `flatfix-call.mjs` now books the true price of a sharper answer |
| «אתה חייב להשתמש בכלים שיודעים לקרוא יותר טוב את תכנית המכר» | `hand/plan_audit.py` + an independent second reading (`review/audit/second-read.md`: 1 high, 11 medium, 22 low; openings and 22 printed dimensions match). The model was corrected; the page he reads is `review/audit/plan-vs-model.html` (local: the sheet is the developer's). Open questions to him are on that page: the lighter grey bar between the island and the television wall (full wall or low), the crossed square beside the fridge |

**Eliran's answers to the sixteen open items (question dialog, 2026-11-17 afternoon) — these are the rulings the rest of the work follows:**
| Item | His answer |
|---|---|
| the lighter grey bar between the island and the television wall | a full wall to the ceiling (as modelled) |
| the viewer (eye level, zoomed-out first look, no stretch at the edges) | yes, it is right — «אבל עדיין אין עקביות» (the old pictures; the carry-over method answers it) |
| the look | after the look test (two variants of one kitchen view at 2K, $0.24, `jobs/kedma-d1/review/look/`): **B — quiet luxury**: rift-cut oak fronts, veined ivory quartzite on worktops, splashback and island, matte black tap, white marble-look floor as the sales plan draws |
| sharpness | double resolution (2K per view, $0.12); estimate for the whole apartment $11–14 more, total $40–43; stop and report near $45 |
| above the kitchen's north worktop | closed upper cabinets |
| the crossed square beside the fridge | a tall cabinet (as modelled) |
| furniture colours | by the chosen look, no pink |
| the disclosure number | the truth: «עד 1%» only if every viewpoint really meets 1 % |
| the developer's name on the page | not shown |
| switchable flooring | parquet, concrete, marble (as Rainbow) |
| a link that opens anywhere | stay local for now |
| the small symbols of the sheet (white squares with a circle, the slatted block in the laundry recess, the box by the entrance) | ignore all |

Renders already made from the model before this reading (living, dining, family, corridor, master, shower, bed1, pantry) are stale where they see a corrected piece; ALL cameras are rendered once more after his answers.

What this changes for the painting: with the tilt limit the screen never shows below about −52° on a desktop and −63° on a phone, nor above +48° / +59°. The straight-up view is not needed (the ceiling cap is carried from the level views); tilted-down views are needed only where furniture stands in the band between the level views and −63°.

## What the kitchen taught (2026-11-17) — the rules for the other 12
1. **Look down, not only level.** The first check sheets were level; looking down showed one stool painted twice, a floor in three stones and an unpainted patch. Every viewpoint gets three sheets: level, down (−38°), up.
2. **A piece the model shows wrongly is painted wrongly twice.** The stools were dining chairs squeezed to size: the level views drew bar stools, the tilted views drew the low seat. Fix the model (procedural bar stool, pouf), render again, then repaint only that piece (`hand/regraft.py`: the piece's plan box, nothing in front of it, a soft meeting line).
3. **A prompt names only what the view contains.** "The armchair" in a view where the model's armchair is hidden behind the partition gave an invented armchair in the middle of the floor. It was found only because the floor tool painted floor over it.
4. **The floor near the camera comes from the model** (`hand/near_floor.py`): the model's own joints (the 120 cm grid, 99.4 % of joint pixels on the grid), the painted floor's colour carried inward, the model's shadows. Beyond the camera's foot the painted floor stays.
5. **A repaint inside a finished picture is tone-matched and cross-faded** (`room_paint.py accept`), or it leaves a pale outline.
6. **No tool that can pay is run without a dry run**, also a "keep" mode (the $0.66 above).
7. **Old pictures do not pass the gate against the corrected plan** (the living room: 14.47 %). The tour carries them on their morning PASS rows until each viewpoint is redone; nothing is deployed in this state.

## Done means
Every room, opened in a real browser at his framing: straight, the proportions of the sheet, every arrow on its door, every opening showing the next room, sharp on a wide desktop, the 3D view matching; the spend inside the ceiling he rules; nothing deployed without his own go.

# Maale Efraim «דגם שור» — what the real portal job found (for fork B)
<!-- written 2026-11-05 by fork C of rnd-67 (project runner), from the real run of job jmw296xof74ed6e (project pmw28yq6b52b7ed) through run-job.mjs against the real store; auto-trace = fork B round 8 (9f38b3d), 2 self-correction rounds + the judge; both runs FAIL → the job sits in state 'review' -->

Evidence: `Habait/tour360/out/pmw28yq6b52b7ed/in/trace/` in `.wt/project-runner` (index.json, plan-1/, plan-2/, each with
plan.general.json, overlay.png, trace-check.json, report.md); the two floors' trace-check JSONs are also in the store under the
project prefix as `trace/trace-check-1.json` and `trace/trace-check-2.json`. Spend: $0.104 over two runs (5 vision calls per run).

## The dwelling is TWO plan drawings
The brochure page 7 carries «דגם שור» on two floors: `plan-1` = קומה א' (first floor, 10 rooms traced vs 7 labels), `plan-2` =
קומת קרקע (ground floor, 7 rooms). `auto_pages` found both; the executor now checks every floor and the dwelling passes only when
every floor passes. A duplex needs the two plans joined (the stairs «עליה לקומה 1» on the ground floor, the stair void on the first).

## plan-1 — קומה א' — FAIL 57/71 (round 2; corrections force_rect bedroom, bedroom-2, master-bedroom did not converge)
| # | Check | Room | Printed | Traced | What it looks like on the overlay |
|---|---|---|---|---|---|
| 1 | dims | חדר שינה (r-bedroom) | 330 × 280 | 284 × 264 | the room stops short on both sides (−14 %, −6 %); shape_iou 0.812 |
| 2 | dims | חדר שינה (r-bedroom-2) | 330 × 300 | 321 × 303 | 9 cm short; shape_iou 0.746 — the red loop overlaps the neighbour |
| 3 | dims | חדר שינה הורים (r-master-bedroom) | 390 × 345 | 356 × 349 | **split**: a green seam line runs through the room; the shower/basin block of the bath is cut into it |
| 4 | room_count | — | 7 labels | 10 rooms | three unlabelled «מעבר» regions: r-corridor-1 (3.37 m²), r-corridor-7 (**11.91 m²** — that is the hall/stair area «מבואה» whose label got no region), r-corridor-8 |
| 5 | door_arc #1 | hinge (516, 481) cm | an opening between two rooms | both sides in the same room | the door between the two bedrooms' corridor and a bedroom lies inside one region → the split missed a wall there |
| 6 | orthogonal + label_in_room | פטיו בקומת קרקע (r-patio) | — | non-axis edges 45/40/65/144/97 cm; label 74 cm outside | **the ground-floor patio was traced as a first-floor indoor room** (brown loop on the overlay). It is a void seen from above: must be outside / not a room on this floor |
| 7 | could_not_read | מבואה (r-hall-auto-11) | — | no closed region | the hall label sits on the stair; the flood leaked |
| 8 | could_not_read | חדר כביסה (r-laundry) | 170 × 125 | 172 × 121 | within tolerance (−3.2 %) but listed |
| 9 | unlabelled_room | r-corridor-1, r-corridor-7 | ≤ 3 m² | 3.37, 11.91 | see #4 |

## plan-2 — קומת קרקע — FAIL 50/56 (round 2; corrections force_rect kitchen, living-room, safe-room-mamad did not converge)
| # | Check | Room | Printed | Traced | Note |
|---|---|---|---|---|---|
| 1 | dims | מטבח | 485 × 310 | 514 × 310 | +6 % on the long side: the kitchen takes the open-plan strip next to it |
| 2 | dims | חדר מגורים | 735 × 450 | 741 × 473 | +5 % on the short side (the same open-plan boundary, from the other side) |
| 3 | dims | ממ"ד | 375 × 300 | 375 × 289 | −3.7 %: the mamad's thick wall eats 11 cm |
| 4 | door_arc #14 | hinge (817, 1886) cm | an opening between two rooms | neither side in a traced room | a door on the outside edge (garden/patio door) — both sides outside the envelope |
| 5 | label_in_room | כניסה (r-entrance) | ≤ 50 cm | 57 cm away | the entrance label is on the threshold; round 7's "door-band entrance" puts the room 57 cm off |
| 6 | orthogonal | פטיו בהתאם לתכנית הפיתוח | — | non-axis edges 41/31/38/34/37 | the patio loop follows paving, not walls |
| 7 | could_not_read | עליה לקומה 1 (r-stairs-to-floor-1), כניסה, the patio | no printed dims | — | sized from the drawing only |

## What the judge added (vision, $0.006–0.008 per floor)
2 mismatches per floor on run 1 (in `plan-*/trace-check.json` → `judge`); the executor folds them into `review.mismatches` (34 in all
with the mechanical rows of both floors).

## Facts the executor relies on (so a change on your side is visible to it)
- `index.json` → `plans[]` with `dir, page, floor_label, dwelling_label, status, rounds, rooms, could_not_read`; each `dir` holds
  `plan.general.json, overlay.png, crop.png, trace-check.json, report.md/.json`. Exit 0 PASS · 5 FAIL · 3 no plan · 4 budget.
- `trace-check.json` → `status, round, checks[{check, room?, name?, expected, got, pass}], failures?, corrections{force_rect}`.
  The executor maps `checks[]` to the portal's table (`label = name · check`, `printed_cm = expected`, `traced_cm = got`).
- `--ledger <file>` is passed (outside `--out`, which the executor clears on every run).

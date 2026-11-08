# Board — exterior-film
<!-- created: 2026-11-04 · plan: development/plans/2026-11-04-exterior-realistic-video-3d.md · coordinator: main session rnd-23 · owner: Eliran Shopen -->

**Goal:** the "הדמיית הבניין והסביבה" button on `/hold/` plays a realistic film of at least 1080p (Phase A), and later opens a free 3D view if the spike looks real (Phase B). It replaces the 360 stills chain.
**State:** `EXECUTING`. Eliran 2026-11-04: "תענה על השאלות של עצמך שהתשובות יניבו את התוצאה הטובה ביותר ותמשיך". The main session answered: A yes ≤ $10 · B spike yes ≤ $15, shipped only on Eliran's eye · the stills chain leaves the button.
**Working folder:** `.wt/exterior-film` (flyover3d `index.html`, `app.js`, plus the new film file). rnd-1f handed the button over (hold-building-tour CLOSED; `openBuilding()` / `closeBuilding()` / `buildingUrl()` in `app.js`).
**Ledger:** `logs/spend-ledger.txt`. Each call is written there BEFORE it runs, and `run_fal.py` adds a row to `logs/ledger.json` after it.

## Cards
| # | Card | Who | State |
|---|---|---|---|
| A1 | Cut the film from the approved clips: orbit → facade arc (eased ping-pong around rest frame 65) → descent. Local, $0 | main session | DONE: 28.4 s, sha256 c46aa6ab… |
| A2 | Upscale to 1080p on fal Topaz: a 4 s model test (Proteus vs Starlight), then the full film | main session | DONE: Starlight Precise 2.5 chosen; $0.73 in total; flicker +5 % only |
| A3 | The button plays the film: overlay player, ✕/Esc, "המשיכו אל הדירה" at the end, AI badge; the stills chain is removed | main session | DONE: 1080/720 by width, the legal text = #clipLegal, bottom gradient |
| A4 | Checks: the building check rows rewritten for the film; regression; a fresh reviewer refutes | main session + fresh Sonnet | check-film.cjs 76/76 (iPhone row Z flaked once, rerun 19/19); gate RUNNING |
| A5 | Copy back; deploy on Eliran's go | main session | TODO |
| A6 | QA on the live files | fresh Sonnet | TODO |
| A7 | QA on the deployed site | `habait-deploy-qa` | BLOCKED (deploy go) |
| B1 | Splat spike (≤ $15): posed Blender views → photoreal skins → splat → Spark viewer; Eliran's eye decides | main session | TODO (after A) |

Rails: root §6 (add-only, disclosure on every frame), §7 (ledger before each call, caps), §8.7 (work only in `.wt/exterior-film`), §12 (timeouts, one heavy run at a time).

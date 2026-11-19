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
| A4 | Checks: the building check rows rewritten for the film; regression; a fresh reviewer refutes | main session + fresh Sonnet | DONE: gate PASS-WITH-NOTES, all notes fixed (v2 cut, focus trap, fade, race, src per open); + Eliran's hold-glide bug fixed (glide-*.json); 76/76 |
| A5 | Copy back; deploy on Eliran's go | main session | DONE: closed + commit c7a3677; deployed dpl_Em7YappX… (Eliran's go), overwritten 1 min later by rnd-db's n49hczc10 (unaware), promoted back after A6 |
| A6 | QA on the live files | fresh Sonnet | DONE: PASS (`logs/qa-live.md`) |
| A7 | QA on the deployed site | `habait-deploy-qa` | TODO: deployed; main-session prod check 38/38 + site 14/14 (`logs/check-prod.txt`) |
| B1 | Splat spike (≤ $15): posed Blender views → photoreal skins → splat → Spark viewer; Eliran's eye decides | main session | TODO (after A) |

Rails: root §6 (add-only, disclosure on every frame), §7 (ledger before each call, caps), §8.7 (work only in `.wt/exterior-film`), §12 (timeouts, one heavy run at a time).

## Handoff — Phase B (B1 splat spike) to the session Eliran keeps (rnd-32 closes after A7)
Eliran 2026-11-04: B approved ("מאשר"), and "אני רוצה שהסשן הזה יסתיים … כדי שאדבר רק עם סשן אחד". So rnd-32 hands B1 over and closes.
- **Goal:** a free, realistic 3D view of the tower and its block, opened from the film's end screen (a 4th action "לתלת-ממד", hidden until B passes). It ships **only if Eliran looks at it and says it looks real** (ruling 2026-11-02, "ריאליזם מההתחלה עד הסוף").
- **Budget:** ≤ $15 (soft $10). Ledger BEFORE every call in `logs/spend-ledger.txt` (Phase A spent $1.23).
- **Inputs on disk:**
  - the Blender clay scene and camera paths of the hold/orbit (habait-16; `research/fal-bench-2026-11-02/` README §B, `flyover3d/HANDOFF.md`);
  - `flyover3d/data/site.glb` (geometry only);
  - the approved look = the Kling clips in `habait-walkaround/Habait/platform/_local/segments/rainbow-cine/` (orbit, hold-arc frames 1–169), used as references.
- **Route** (`research/product-research-2026-11-02/SUMMARY-he.md` §3D):
  1. 12–16 posed views (RGB + depth, Cycles, $0).
  2. Photoreal skin per view with the geometry locked (FLUX Depth / Kling look as reference).
  3. Splat: Marble `posedImages2Splats` (≈ $5; the World API is "selective access", so check access first) or AnySplat / own training ($0, Kaggle GPU).
  4. Spark 2.0 viewer (MIT) in the browser; measure size, FPS on iPhone 13 / Pixel 7, multi-view consistency.
- **Main risk:** the AI skins disagree between views, so the splat smears. Show Eliran frames early.
- **Code hook:** `flyover3d/app.js`, section "board exterior-film"; `#buildingEnd` gets a 4th button. Open a NEW git worktree for it (root §8.7: `git -C C:/RnD worktree add C:/RnD/.wt/<feature> -b <feature>`). `.wt/exterior-film` is a closed plain-copy folder.
- **Deploys:** HOT "DEPLOY HOLD" line. One session deploys habait-flow, after Eliran's own go for that build, staged from live main, with a SHIP-LEDGER row.

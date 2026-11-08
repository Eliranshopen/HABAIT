# Board — apartment-3d
<!-- created: 2026-11-03 · plan: development/plans/2026-11-03-apartment-3d-ux.md · coordinator: main session rnd-23 · owner: Eliran Shopen -->

**Source:** `development/plans/2026-11-03-apartment-3d-ux.md`. Read it first: this README is the execution order, the plan is the why. Research: `C:\RnD\Projects\Habait\research\apartment-3d-ux-2026-11-03\README.md`.
**Goal:** the apartment page's תלת-ממד tab becomes useful and premium:
- room names and areas;
- tap a room to enter its 360, then back;
- a look that matches the tour, with Cycles-baked light;
- a correct phone layout.
All of it is built in the work tree `C:\RnD\.wt\apartment-3d\` and copied back only on Eliran's "good".
**State:** `CLOSED` 2026-11-03 ~19:40 (Eliran: "good – להעתיק"; 27 files copied back; deploy NOT done — a separate go). Was EXECUTING from 14:50.

## Key state (update before every burst)
- 2026-11-03 14:50: board filed. No work tree yet; no product file changed. Live site = today's flat dollhouse (`current/*.png` in the research folder).
- Who executes:
  - The project agents (`platform-dev`, `blender-scene`, `qa-reviewer`, defined in `C:\RnD\Projects\Habait\.claude\agents\`) load only in a session started from `C:\RnD\Projects\Habait`.
  - Session rnd-23 started at `C:\RnD`, so today the main session runs each card itself, as `copy-habait-2026-11-03` did.
  - The fresh-context gates (06, 09) still go to a fresh Sonnet reviewer that never saw the implementation.
- Blender owner (SESSIONS.md rule 4): `habait-da` holds Blender. Card 07 needs Eliran's ruling or a hand-over before any Blender run.
- 14:51 card 01 DONE: `C:/RnD/.wt/apartment-3d/` opened under the CURRENT rule (`files/<path relative to C:/RnD>`, not the flat mirror the plan proposed; the other session finalised that rule meanwhile, so §8.7 was not edited). 235 files, `manifest.json`, `wt.py` (open/changes/drift), `CHANGES.md` = 0 changed. `npm ci` in the work-tree platform folder (three 0.170.0, 1 package). Baseline: `smoke.mjs` all green; `build_zip.mjs` to scratch OK (27 files, 4.47 MB, 5.2 s).
- 15:03 cards 03+04 DONE: check-03 39/40, check-04 47/47 (iPhone 13, Pixel 7, desktop). `CHANGES.md` 11 changed, live drift 0. Next: card 05 look pass.
- 15:15–15:41 card 05 DONE: check-05 22/22 (desktop 3D 77 % width, glass 0 stripes, idle 0 frames, Top 11/11 labels on desktop and phone), check-03 re-run 40/40, check-04 47/47; smoke/minimap/apartment green (`logs/c05-*.txt`). CHANGES 11 changed, live drift 0.
- 15:20 Eliran's calls (AskUserQuestion): 02c rnd-23 takes Blender for one local bake; 02d disclosure caption unchanged; one look at the end (A/B) before copy-back — the gates still run.
- 15:45 the board is now run by session **rnd-fd** (ListAgents name; it picked the board up from disk at card 05; rnd-a8 asked and was told). Card 06 gate 1 is with a fresh Sonnet reviewer; card 07's `--bake-light` code is written in the work tree (selftest 62/62), Blender waits until the gate's runs finish (one heavy run at a time).
- 16:10 rnd-ed reported a LIVE bug (habait-flow.vercel.app apartment page: "Failed to construct 'URL': Invalid URL", every tab empty; evidence `Projects/Habait/research/platform-ui-ux-2026-11-03/current/desk_05_apartment.png`). Confirmed in the work tree: `js/apartment.js:112` `new URL(ext.url)` and `:128` `new URL(base)` have no base, and a relative `/hold` throws. Navigator ruling (rnd-fd): it rides this board, applied with card 08 after gate 1 (base = `location.href`), checked by gate 2; live only at card 10, deploy is Eliran's own go.
- Eliran 16:08: keep one heavy run at a time — the bake waits for gate 1.
- 16:12 card 06 gate 1: FAIL with 1 low defect (Pixel 7 embedded Top 10/11 labels; everything else PASS, `logs/gate1-report.md`). Fixed in card 08's pass (ring of compact-label spots near the anchor): Pixel 7 + iPhone 13 embedded 11/11 (`logs/probe-labels-embedded.txt`); gate 2 re-checks it.
- 16:15–16:47 card 07 DONE: `--bake-light` in `export_dollhouse.py`; no-flag GLB byte-identical (`1259daf0…`); final bake 2048 px / 128 spp, 263 s CPU, atlas 143 KB, 3 floor GLBs on one BIN `51d18730…`, live `scene.blend` hash unchanged; three full bakes were needed (thin-edge barcode → leak fix → thin-island collapse), all logged in `logs/c07-bake-manifest.json`; $0.
- 16:30 card 08 DONE: lightmap applied (15 materials), gain π×0.45 tuned on screen, no mipmaps, live lights lowered; page +388 KB (≤ 600, incl. the 1024 phone atlas), fallback without atlas = Phase 1 (`check-08-fallback.txt`), CPU×4 cold 3D open 3466 ms (baseline 3.7 s; Phase 1 2768); check-08 8/8, checks 03/04/05 + smoke/minimap/apartment green. The live URL bug fix (rnd-ed) is in (`check-urlfix.txt`). CHANGES: 20 changed + 2 new, live drift 0.
- 17:10 card 09 gate 2: FAIL (D1 medium: dark dashes on floors near wall bases with the 2048 atlas = the phone path; D2 low: Pixel 7 bath-main label 2.98 label-heights from its anchor); everything else PASS (geometry = Phase 1, one BIN, legal identical, live drift 0, both riders PASS) → `logs/gate2-report.md`, A/B `after/compare.png`.
- 17:15 **Eliran (AskUserQuestion, in Hebrew): the flat 'architect's model' look is not what he wants — "אני רוצה שזה יראה כמשהו ריאליסטי".** Probe: the scene.blend is mostly flat colours (8 of 26 materials textured, `logs/probe-blend-materials.json`); the tour's realism comes from AI-skinned panoramas. His rulings: (1) **project the tour's panoramas onto the dollhouse** (spike on one room first, shown to him before continuing); (2) **stay on this board** — everything copies back together after his "good" on the realistic look. D1 is re-judged inside the projection step (new atlas).
- New card 08b (projection): spike = the living room (the scene's only pano camera `CAM_cp-living`, rot −111.3° = scenes.json centreBearingDeg 111.3); per-floor pano sets exist (`tour360/apartments/apt846/_local/panos-{parquet,concrete,marble}`).
- 17:14 on rnd-23's request (board platform-ui-ux, Eliran's go there): 37 UNCHANGED platform paths moved from `manifest.json files[]` to its `released[]` (index/landing/flow.html, serve.mjs, package.json, css/style|landing|dashboard|flow-real, js/i18n|landing|picker, test/*, fixtures/rainbow/*), each verified sha = open; `wt.py` skips released paths (CHANGES still 20 changed + 2 new, drift 0). **Card 10 must rebuild `_local/dist/rainbow/846` from the LIVE files after the copy-back** (the dist embeds style.css etc., which rnd-23 may change), not copy the work-tree dist.
- 17:20–18:20 card 08b (realism): spike = project the tour panos onto the model (`logs/spike-08b/project_panos.py`, `compose_panos.py`; alignment proven exact with the CG pano, `after/phase3/spike_living_compare.png`) — the AI skins redrew the furniture, so painted floors smeared (`after/phase3/closeups_clean_vs_painted.png`). Eliran chose **"רצפה אמיתית בלי מריחות"**: `360walkaround/pipeline/floor_textures.py` rectifies a clean floor square from the tour's own pano per finish (parquet/concrete/marble, entrance camera), de-lit + tileable → `floor-<finish>.webp` + `floor-textures.json`; the viewer repeats it in world metres (uv1) under the baked light; the floor switch swaps it. Spike code moved out of the product to `logs/spike-08b/` (with the painted atlas). Eliran 18:20: **"כן, לבדיקה הסופית"** on `after/phase3/closeups_clean_vs_floortex.png`.
- Gate-2 D2 fixed (compact spots ≤ 2.5 label heights + a name-only third form): Pixel 7 + iPhone 13 embedded Top 11/11. checks 03 40/40, 04 47/47, 05 22/22, 08 8/8, fallback ok.
- 18:45 gate 3: FAIL (D1 medium: dark stripe blocks on floors in the embedded tab; D3: minimap.test floor colour; D4: floor-switch race) → `logs/gate3-report.md`.
- 18:50–19:15 fixes: D1 cause isolated (`logs/probe-d1-*.cjs`, `after/gate3/d1_iso.png`, `d1_fixed.png`): the export's FLOORFILL lies coplanar under every floor — in the bake it striped the floors' light, on screen it z-fought; now it casts no shadow in the bake and is pushed back in depth in the viewer; also CEILFILL counts as a ceiling, furniture wholly above the cut no longer occludes, an occluded-texel fix, lightmap mipmaps back on. D3: `floorColor` reports the finish colour under a texture. D4: the last floor request wins. Final bake = bake6 (`logs/c07-bake-manifest.json`), BIN unchanged `51d18730…`. All green: smoke/minimap/apartment, checks 03/04/05/08/fallback/urlfix, labels 11/11, race ok, CPU×4 3268 ms.
- 19:30 gate 4: **PASS, 0 defects** (`logs/gate4-report.md`; one low pre-existing observation: thin diagonal room-boundary lines in Top).
- 19:35 Eliran: **"good – להעתיק"** on `after/FINAL_before_after.png` → card 10: 27 files copied back and verified (`.wt/apartment-3d/close.py`, manifest `closed`), context files regenerated (0 missing, 0 stale), `after/` copied to the research folder. **CLOSED.** Owed: deploy (Eliran's own go), removing `.wt/apartment-3d` (Eliran's act), the dollhouse-in-the-tour board (his "1 then 3").

## The cards (execution order; one worker at a time, all sequential)
| Burst | # | Card | Agent | status / track | model | tier | State |
|---|---|---|---|---|---|---|---|
| 1 | [01](task-01-open-work-tree.md) | open `.wt\apartment-3d\`: runnable copy, `manifest.json`, `README.md`, `CHANGES.md`; §8.7 text to the mirror layout | main session | — | — | T0 | DONE 14:51 (`.wt/apartment-3d/manifest.json`) |
| 1 | [02](task-02-eliran-calls.md) | Eliran's calls: plan approval, `npm ci` in the work tree, Blender for card 07, disclosure wording at card 09 | main session → Eliran | — | — | T1 | DONE — a+b "go"; c rnd-23 takes Blender; d wording unchanged |
| 2 | [03](task-03-rooms-labels-tap.md) | room data in `dollhouse.html`, labels, tap → focus + highlight + sheet, `habait:enter-room` | `platform-dev` | live / habait | opus | T0 | DONE — check-03 39/40 (desktop Top 10/11 labels → card 05) |
| 3 | [04](task-04-handoff-and-page.md) | page side: enter-room → 360 at that room, "חזרה לתלת-ממד", deep-link fix, phone layout, fixture badge, caption pill | `platform-dev` | live / habait | opus | T0 | DONE 15:03 — check-04 47/47 (logs/check-04.txt) |
| 4 | [05](task-05-look-pass.md) | the real-time look pass: backdrop, tone map, IBL, caps, glass stripes, framing, DPR, render on demand | `platform-dev` | live / habait | opus | T0 | DONE 15:41 — check-05 22/22 (logs/check-05.txt) |
| 5 | [06](task-06-phase1-gate.md) | **Phase 1 gate:** tests + screenshots + refute | `qa-reviewer` (fresh) | live / harness-ops | sonnet | T0 | DONE 16:12 — FAIL 1 low (Pixel 7 embedded 10/11 labels) → fixed with card 08 (logs/gate1-report.md) |
| 6 | [07](task-07-bake-light.md) | `export_dollhouse.py --bake-light`: tour palette override, UVs, light-only Cycles bake, `light.webp` | `blender-scene` | live / habait | opus | T1 | DONE 16:47 — atlas 143 KB, one BIN, no-flag identical (logs/c07-bake-manifest.json) |
| 7 | [08](task-08-lightmap-viewer.md) | viewer + `build_zip.mjs`: inline the atlas, `lightMap`, poster frame | `platform-dev` | live / habait | opus | T0 | DONE 17:00 — check-08 8/8, +388 KB, CPU×4 3466 ms (logs/check-08.txt) |
| 8 | [09](task-09-phase2-gate.md) | **Phase 2 gate:** A/B, size, open time, refute; disclosure wording to Eliran | `qa-reviewer` (fresh) | live / harness-ops | sonnet | T1 | DONE — gate 2 FAIL → gate 3 FAIL → fixes → **gate 4 PASS** (logs/gate4-report.md) |
| 9 | [10](task-10-close.md) | close: Eliran's "good" → hash check → copy back → memory | main session | — | — | T1 | DONE 19:40 — 27 files back, verified; CLOSED |

Burst rule: at most 5 workers in parallel (root §10.2). This board never needs more than one at once, because cards 03, 04, 05 and 08 touch the same files. Every card is resumable: it states what it has already written before it continues.

## Gates
- **06 (Phase 1)** and **09 (Phase 2).** Each gate has `Check:` and `Reviewer scope:` lines in its card.
- The reviewer is a fresh Sonnet sub-agent that never ran the card under review and is prompted to refute.
- No card after a gate starts until the gate reports PASS **and** Eliran has looked at the work-tree preview (`http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846`).

## Standing rails (inherited verbatim into every card — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live repo `C:\RnD\Projects\Habait\habait-walkaround\` is read-only to every card until card 10.** Every write goes into `C:\RnD\.wt\apartment-3d\` (same relative paths as the repo) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the work tree is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or render runs as `timeout N <cmd>`, one heavy run at a time, foreground; kill what you start by PID. The work-tree server is `PORT=8851`. Never use :8850 (another session's port).
8. ⛔ **Blender only by its owner** (`Projects\Habait\SESSIONS.md` rule 4); no paid call on this board ($0 plan). Deploying is a separate explicit go from Eliran (root §9).

## Records
- Evidence: `development/tasks/apartment-3d/logs/` (test output, timings) and `.wt\apartment-3d\after\` (screenshots, copied to the research folder at close).
- Memory: one `memory/runs/` entry at close by the main session; `Projects\Habait\memory.md` point edit; the rnd-23 row in `Projects\Habait\SESSIONS.md`.

---
date: 2026-11-10
layer: project
author: main session (the simulation-fixes session), written at Eliran's «אני מחליף חשבון קלוד» (~12:40)
second-reader: the next main session (read this first); habait-deploy-qa (the test-link publish)
---
# Handoff: Rainbow simulation fixes — round 1 built in `.wt/rainbow-sim-fixes`, NOT merged, NOT published

**Rulings in force:** `project/2026-11-10-fal-70-consistency-first.md` (FAL credit $70, consistency audit of ALL tabs before any paint call, the sink as the dining tab shows it; round-1 go «כן» up to $15).

**Done (worktree `.wt/rainbow-sim-fixes`, branch `rainbow-sim-fixes`, commits bd9b1d1 + the markers commit after it):**
- Audit of all 11 tabs × 4 sets; door groups added to `consistency-check.mjs` (`door-<opening id>`). Findings + plan: `Projects/Habait/habait-walkaround/qa-evidence/tour360/sim-fixes-2026-11-10/AUDIT.md`.
- Fixed: o-12 entrance door taupe in 03 (shipped geometry kept, oak recoloured to 01's measured taupe; the parquet/concrete finishes had lost the door's lower half — restored); o-6 (01, 02) and o-11/o-10 (04) recoloured to the wall-colour zero-line door 07–11 show; 02 sink beside the tall column (as 03; band c619794e22e9, sink box only); 03 and 04 hob + oven moved toward the facade end (03 hob↔sink 141 → 190–196 cm, plan 219; 04 view too oblique to measure, tol ∞).
- Checks: 16/16 shipped pictures of 01–04 (balanced + parquet/concrete/marble) PASS the 1 % gate; kitchen judge 3/3 PASS on parquet; markers 27/27; scan rerun ($0.08); tiles re-cut; `build-tour apt846 --catalog=ai` OK in the worktree; QA shots 1440/390, 0 page errors, 0 overflow: `qa-evidence/.../sim-fixes-2026-11-10/shots/`.
- Money: apt846 ledger $314.82 → **$324.77** (≈ $10 of the $15 round cap; stop at $329.82). Spend-ledger row 2026-11-10 in `development/tasks/studio-agent-fal/logs/spend-ledger.txt`.

**⚠ Main's media already changed (by design: `_local` in the worktree is a junction to the main checkout):** `apartments/apt846/_local/picks.json` (01–04 new picks), `_local/panos-{parquet,concrete,marble}/{01..04}.webp` + `.source.json`, `_local/full/{01..04}.webp`, scan + tiles. Backups to revert: `qa-evidence/tour360/sim-fixes-2026-11-10/finish-backup/` (12 finish webps, 12 source.json, 4 full webps, `picks.before-2026-11-10.json`). Main's TRACKED `panos/balanced` is unchanged until the merge, so a main build now mixes old balanced with new finishes — merge before anyone builds main's tour.

**Next (in order):**
1. Check the QA shots: the local shots showed the TILE floor although the chip says «פרקט» — verify the viewer switches to `panos-parquet` after load (6 s wait may be too short) before calling the parquet set done.
2. Merge `rainbow-sim-fixes` into main (stage own paths only), rebuild, copy dist to live as fork A did, publish to the **test link** rainbow-v2-test only; habait-flow only on Eliran's word.
3. Open for Eliran: (a) 03's entrance hall is drawn closer/larger than the render (door top 52 px high, door 23 px left of the plan; pre-existing, the 1 % gate does not see it) — a paid hall regeneration, his call; (b) 04 shows the entrance door as two leaves, 01 as one; (c) rounds 2 (07/10 raw finishes that add/move doors, bathrooms' finish) and 3 (3840 full set) need estimates; (d) entrance video stays his call.
- Tools added (all $0, v3 object-paste sidecars that band-lineage reads): `region_paste.py`, `recolour_region.py`, `paste_object.py`, `refit_element.py`, `transplant.py`. Lesson: a gpt25 band asked to restyle a door widened it 45 % (the transplant guard warned 1.5×); paid bands that "move a fixture" moved it wrong or erased it — move the fixture's own pixels at $0, then a row-limited band only to repaint the old place.

## Update ~13:50 (same session, after the account switch)
- **Merged** (`1b56fd4`, then `fd0bef0`) and **published to the test link** rainbow-v2-test `dpl_GzBT6aqMTKH8ocyXKes1RmP4vcxc` (stage `test-r15`, SHIP-LEDGER row). habait-flow untouched. Main's tour dist and the apartment page dist (`build_zip`) are rebuilt; their panos match (sha).
- **Eliran changed the sink ruling (13:10):** he wants the gap between the sink and the column (the ORIGINAL 02), not adjacent → the sink move is reverted; the cabinet joint under the basin is removed (one front). 03/04 still show the sink close to the column: the judge reads 02 110 / 03 141 / 04 100 cm (plan 126, all inside tolerance) — if he wants them to look like 02, that is a new band, his call.
- **02 left of the fridge** («חלק עמום שקוף»): the shipped parquet/marble finishes of 02 had translucent blocks there (old raw answers). Fixed with fresh gpt25-high finishes composited floor-only + the hallway floor polygon. Left: a thin tile wedge under the curved plinth at the far right in parquet/marble.
- The parquet set loads only with `?floor=parquet` in the URL locally; the default view is the balanced (tile) set unless the page passes the floor — check what the platform's links pass.
- Ledger: $326.23 (round 1 spent $11.41 of $15).

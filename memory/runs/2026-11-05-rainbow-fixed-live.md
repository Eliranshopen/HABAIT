---
date: 2026-11-05
layer: runs
author: main session rnd-9d
second_reader: fork F (portal acceptance uses the same rules R16–R24)
---
# 2026-11-05 — Rainbow apt846 fixed to the sales plan, LIVE (dpl_HDPAjZw…)

- **What:** fork A's `fix-846-fidelity` merged to main `fc23b88`; habait-flow serves the new tour since ~20:55. Every shipped picture (11 rooms + 33 finishes) ≤ 1 % vs the plan; 9/9 consistency groups; «עד 1%» disclosure; prod responsive gate 32/32.
- **Rules born today (parity rows, the portal runs them):** R16 one printed-dimension measurement (`tools/printed_dimensions.py`), R17 trace cleanup, R18 face bias 1.0 cm, R19 fit-edges, R20 snap-fixtures, R21 casework from the PDF layer, R22 camera clearance ≥100 cm (jambs, casework; keep-outs fixtures 35 / bed 50 / furniture 60; terraceBedroom exception 60.7 cm), R23 walkable hotspots + start view, R24 judge = majority of 3 runs.
- **Lessons:** (1) a render driver must pass `--res 2048x1024` (the default 4096 made renders 3×slower); (2) regenerate a point only after its render committed; (3) a prod deploy can build Ready while the alias stays put: verify served sha256 and `vercel promote` if needed; (4) Git Bash rewrites `/path` args: run the responsive gate with `MSYS_NO_PATHCONV=1`; (5) `stage_flow.py --help` is taken as the output folder.
- **Spend:** fork A ledger $234.72 (ceiling $249.89, raised twice under Eliran's free budget).
- **Owed:** consistency-check `--runs 3` in code; fork B/F measure_line switch (fork F done in project-runner); merge project-runner + studio-supabase into main; the portal acceptance run (fork F, started ~20:55, $60 cap).
- **MISS found by Eliran (~21:05):** the apartment page reached from the home page loads its own copy `_local/dist/rainbow/846/` (apartment.json, media/panos, stills, top, plan, GLB/dollhouse, built by build_zip.mjs). It was NOT rebuilt, so it still served the old pictures (02-kitchen dist dc3d04ab ≠ tour a40bc389). Lesson: a Rainbow change must regenerate EVERY surface that carries apt846 media (tour + build_zip dist + any fixture); the predeploy check should compare dist panos to tour panos. Fix: fork A rebuilds the dist; Eliran's go «כן, תעלה כשעובר» for that deploy.

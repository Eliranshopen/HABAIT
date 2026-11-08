# 2026-11-05 · fork F (rnd-9d) · project-runner — every step after a passing trace, autonomous

## 2026-11-05 · fork F · the designed look, consistency for every element, the publish route, the portal autonomy fixes
- **Did:** In `.wt/project-runner` (commits ab7e266, 2a69274, 8ef5584, 4c730a7, fe48d4e) — `tools/skin-project.mjs` runs the Rainbow recipe for a new apartment with no human step: make-skin-prompts → gen-pano gpt25 → close-seam --lite (only when the seam steps) → fidelity-gate at fidelity.json's bar → the fix loop (regenerate, then CG-guided band repairs; never drop a room; a trace/CG deviation stops the room) → cross-scene consistency for EVERY group seen from 2+ scenes (consistency-check --all-groups, groups = rooms with fixtures + the railing; the home scene's passed picture is a reference for the others; judge list must be empty) → make-sets + the gate on the shipped bytes → the 3 floor finishes, each gated. run-project step `skin`; `gate` packages only when skin-report says PASS. run-job: skin by default, `publishPackage()` + pointer `studio/pub/<pid>.json`; `api/studio-pub.mjs` serves `/p/<pid>/…` read-only from the private store (rewrites in stage_flow.py --studio). Portal: review card «ממשיכים לדייק / המערכת ממשיכה לתקן לבד»; Hebrew-only reading (prompt + a translation guard); the engine-version stamp + one automatic requeue per newer engine (sweep), `studio/engine.json`.
- **Evidence:** proof on apt846-auto (rebuilt from the corrected hand plan, CG 2048 in 881 s): living FAIL 9.05% → regenerated → PASS 0.58% (bar 1%), balanced PASS, parquet/concrete/marble PASS 0.58%, 9 rings, $3.11 — `.wt/project-runner/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846-auto/_local/fidelity/04-living__picks__d20a9d296a97.gate.jpg`, scratchpad `forkF/proof1-skin-report.json`; publish route on preview `habait-flow-g3xxv1gz8` (302 to landing, data/tour/panos 200, unknown project and tour/api source 404); fake-store test of the engine retry (requeued once, not twice).
- **Learned:** finish-pano did not create its output folder (paid answers saved, the webp write failed; fixed, re-run from cache $0). build-tour wants a gate row for every shipped picture, so a CG-only set is gated too. Rainbow-only words lived in consistency-check (id-prefix groups, the L-kitchen judge): now data-driven by room, same groups for apt846.
- **Owed / open:** the proof re-run on main after fork A merges, then the full 11-scene run (est. $35–40, ceiling $60, report at $40); a prod deploy of the publish route + portal fixes needs Eliran's go; the building film needs inputs a sales plan lacks (no building mass) — a new project ships film:false; a browser paint check of /p/<pid>/ on the protected preview was not run (HTTP only).
- **Second reader:** `habait-deploy-qa` — the next habait-flow deploy ships the /p/ rewrites, api/studio-pub.mjs and the portal text changes.

## 2026-11-05 (evening) · fork F · the responsive gate in code, parity, the portal on production, one measurement
- **Did:** project-runner commits ef02ade, ceab0ac, bcbc7df, 1cdd84d, e3e82ba, 541c8e4, 56beb0b, 8d5a64c, 4c01009, 70463a9 (+ studio-supabase 00d2512, 2589077): `Habait/tools/qa/responsive-gate.mjs` (1440 + 390: page errors, 4xx, overflow both sides, 44 px HIT areas, cover > 15 %) used by the runner's step `qa` (a failing project is not published; screenshots go with the job) and by `Habait/tools/deploy/predeploy.mjs` (stage_flow.py exits 1 on FAIL); every 44 px finding fixed (home, landing, hold pins + HUD, tour header at 390, portal, Clerk); the parity registry + `run-project --parity` (13 rows, PASS); the apartment page and an empty cine flow in every package; Blob-quota-safe executor (no list() to find a job, ops counted); plan_gate measures with printed_dimensions.measure_line.
- **Evidence:** predeploy on deploy-H-1 32/32 → LIVE dpl_G55ZUBqZ; production portal e2e on Supabase PASS (scratchpad forkF/prod-e2e/report.json: upload 16 PUTs 200, real Hebrew reading, sandbox claim 67 s); H-2 preview 32/32 → LIVE dpl_4PxPsAxt; production gate 32/32 (scratchpad forkF/prod-gate-H2/verdict.json).
- **Learned:** a closed fixed drawer and a clipping container hid a cut control (the gate now fails any control cut by the edge, carousels and panorama rings excepted); a stopped background run kept writing into a stage being rebuilt (a false FAIL) — never rebuild a stage under a running gate; the store quota counts every list().
- **Owed / open:** fix-846-fidelity not merged into main by 19:41, so: merge main into project-runner, re-run --parity + the gate, rebuild apt846-auto from the final plan and re-render (fork A first), CG-vs-plan must pass in every room, then the full 11-scene paid run (est. $35–40, cap $60). The test project «fork F prod e2e · 846 (test)» stays in the store (deletion is Eliran's).
- **Second reader:** `habait-deploy-qa` — every habait-flow stage now passes predeploy.mjs before a deploy.

## 2026-11-05 (night) · fork F · the apt846-auto acceptance run on the final plan — stopped at the $60 ceiling, not accepted yet
- **Did:** apt846-auto rebuilt from the final apt846 plan (fc23b88) + re-rendered; CG-vs-plan 11/11 PASS (≤ 0.85 %); skin-project ran to the $60 ceiling ($39.80 + $20.10). Shared behaviour added on the way (516c8e0): R24 judge majority of 3, an unreadable judge asked again (never regenerated on), the automatic ref repair after the first consistency FAIL, fidelity.json max_attempts 5; the furnisher keeps a plan-drawn piece's size (4e697e5).
- **Evidence:** `.wt/project-runner/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846-auto/_local/skin-report.json`; rooms 10/11 PASS (bedroom-main FAIL 5.38 % after 5 attempts: an invented opening at 319–329°, band repairs did not move it); consistency 7/8 (living fixed by the ref repair; kitchen FAIL: hob and sink reversed in one view); finishes incomplete at the cap; no human step in the run.
- **Owed / open:** bedroom-main (why band repairs do not remove the finding), the kitchen view with the hob/sink reversed, the remaining finishes — a new budget ruling; fork A's band-edge rule R25 (83b057f) to merge once it is on main, run on every picture before acceptance.
- **Second reader:** none.

## 2026-11-06 ~09:30 — acceptance run resume 4 (fork F)
- What: skin-project apt846-auto resume 4 inside the $90 ceiling — kitchen consistency round, bath-main parquet finish, mirror-rule re-gates.
- Result: rooms 11/11 PASS (balanced, worst entrance 0.85 %); finishes 33/33 PASS; consistency 7/8 — kitchen FAIL x3 (photo 4: upper wall cabinets + different sink/hob layout vs photos 2,3,5) after ref repair and regen; bath-guest mirror exemption 208-224° crop `_local/fidelity/11-bath-guest__mirror__216__32db08757595.jpg`.
- Spend: $5.29 this resume; total $84.77 of $90 (~$5.23 left). Human steps: only Eliran's fal top-up.
- Open: kitchen decision (coordinator); R25 (83b057f) still only on fix-846-fidelity, not main.
- Evidence: .wt/project-runner/.../apartments/apt846-auto/_local/skin-report.json; spend-ledger 2026-11-06 07:55 row.
- Second reader: main session (coordinator).

## 2026-11-06 ~10:05 — kitchen repair (a), two tries, both rejected (fork F)
- What: close-seam 04-living --ref current 02-kitchen pick (s22): try 1 band 100° at u 0.3278; try 2 band 25° at u 0.25 (the far kitchen only), extra words "same small size, no upper cabinets".
- Result: both REJECTED by eye; the 04-living pick is back to gpt25 s22 (a92fe83e2197); kitchen consistency stays FAIL.
- Finding: the ref repair transplants the ref's close-up view. Try 1 replaced the dining, column and windows with a close-up kitchen and the depth gate FAILED it (7.65 %). Try 2 enlarged the far kitchen, removed the oven column and left hard band edges, and the depth gate PASSED it (0.19 %). So the depth gate does not catch a transplant inside a small band.
- Also: the earlier ref repair used the s7 kitchen, which was replaced by s22 later, so it was a stale ref. The entrance pick is a seam from a living ref repair (52529cfa2ab3) and looks like the living area was brought closer; it should be audited with R27.
- Spend: $1.24 (2 seams $1.20 + 4 depth $0.04); total $86.01 of $90.
- Evidence: _local/generated/04-living__seam__s7__c38a20d89bd7.png and 04-living__seam__s7__ee350e030a69.png; gate rows 04-living__picks__a4950932f063 (FAIL) and 145f07185131 (PASS).
- Second reader: main session (coordinator); fork A (owner of R27).

## 2026-11-06 ~11:15 — R25/R27 merged, audit, kitchen position control (fork F)
- What: main (R25/R25b, R26, R27) merged into project-runner 24a20e7 and studio-supabase c0bb281; parity PASS (17 and 12 rows). The judge's JSON fix is b5f60ea: max_tokens 8000, response_format json_object, JSON-only words, finish_reason kept.
- R25 gate on 44 shipped apt846-auto pictures: 40 PASS. 01-entrance fails in all 4 sets because its pick is a v1 seam (52529cfa2ab3) with no readable cut; its .raw.png exists, so a $0 v3 re-composite is possible.
- R27 judge ×3: 7/8 groups PASS; the kitchen FAILS. 01-entrance and 04-living show upper cabinets; 02, 03 and 05 show stainless with shelves.
- Control: Rainbow apt846 kitchen with renders is 3/3 PASS; 02 positions are hob 1°, sink 9°, tall 6° off. Without renders (gitignored, not in the worktree) it dropped silently to photos-only.
- Root cause found: apt846-auto's fixture_hints are rule-guessed (hob at the "centre of the second run" (951,385), sink at (766,468)) and sit about 1.3 m from the drawn symbols, which Rainbow uses (hob (821,395), sink (689,570)).
- Spend: about $0.28; total about $86.29 of $110 (the coordinator raised the ceiling).
- Evidence: scratchpad audit-r25-gates.json, audit-r25-r27.json; apt846/_local/fidelity/consistency.json.
- Second reader: main session; fork A (the judge fix); fork B (auto-trace fixture hints).

## 2026-11-06 ~11:45 — (2a) hob/sink from the drawing, (2b) 02 re-skin, HARD STOP on paid calls (fork F)
- What: casework_symbols.py reads the hob (a burner square) and the sink (drain/tap holes) from the casework layer and registers them into the plan's frame. On apt846-auto: hob 4 cm and sink 11 cm from Rainbow's hand-checked hints. The furnisher uses them; the run-centre guess stays only as a labelled FALLBACK. The board's open-shelf wall becomes uppers "shelves". New runner step `casework`. R27 never falls back silently: judge exit 4 names the file, the runner's ensureRenders builds the renders. skin-project: the home first (a home off the plan is regenerated) and --context. Parity rows 18–21; parity is 21 rows PASS.
- Result: the 5 kitchen views re-rendered ($0). 02 was re-skinned; seed 8 swapped hob and sink and the depth gate PASSED it, so the home-first rule was added. 02 is now s7 d89004bcff86 (0.33 %). Kitchen consistency still FAILS: 01/04 have upper cabinets, 02's sink is 16° off.
- HARD STOP 12:36 local (coordinator): Eliran loaded $50 on fal at 09:00. Fork F spent $25.68 of it: apt846-auto $25.63 (resumes 3+4 $20.93, which really ran after 09:00 — the spend-ledger lines say 01:10/07:55), plus the Rainbow control $0.05. One gen row (02 seed 31, $0.60) is still "reserved" but its answer file exists, so it was billed.
- Commits on project-runner: e98ea47, ceaebf0, 1945937, 358026f, 1ae22f6.
- Second reader: main session; fork B (fixed the hob classification with casework_symbols, auto-trace 612b87c).

## 2026-11-06 ~13:50 — entrance v3, --keep-picks, the tall-unit rule (fork F, $0.02)
- Entrance: the living-ref band was re-composited as v3 from its raw answer onto its parent, gpt25 s22 0868c6d15448. At --cut-search 140 both cuts score 0.86 (at 40, one cut was 8.0 and failed). Gate PASS 0.85 %, R25 PASS, $0.02.
- skin-project --keep-picks: parity row 22.
- Tall-unit rule: parity row 23, d5cccc2. Eliran saw the column painted as an oven tower. Cause: the board's tall_unit words ("oven and fridge") plus k-counter's inherited words_en ("tall oven column"); the CG was already a fridge. Now the type comes from the drawing's words, else fridge by size (55–95 × 55–90), else storage. Prompts name it, the judge checks `tall_is`. The 846 PDF has no text layer.
- Registration now refuses a fit off scale 1 ± 0.05 (fork B's re-drawn trace fitted at 1.13).
- Paid repaints held until the coordinator's go; $12 cap, $0.02 spent.
- Second reader: main session; fork A (the new house-board keys reach Rainbow on the next merge).

## 2026-11-06 ~15:45 — step (1): R28 taken, rows 24–26, kitchen still FAIL, waiting on the bake-off (fork F)
- Taken byte-identical from fork A: R28 (e5c75cc: ref-scale-check, close-seam, band-lineage, same blob hashes; fidelity.json ref_scale hunk) and floor_composite.py --whole (c8cead2).
- Row 24: the fix loop's cut-search retry (80 then 140, $0). Row 25: prompts name every fixture the camera sees (sight lines; 01/05 now name the fridge column). Row 26: a floor-only composite only where the pick grew from the finish's source.
- Paid pass ($6.41): 02 home re-skinned twice (s32 passes, plan positions OK); 03 regenerated and shows the FRIDGE. 01/04/05 still paint an oven tower. 03's R28-guarded ref repair failed the gate at 14.74 % (a transplant, caught). Kitchen still FAIL.
- The 6 floor composites for 02/03 passed the gate and R25 but failed by eye (tile patch / smears at the counter base) → fresh finishes needed.
- Spend for step (1): $6.59 of $20. Holding $0.60 calls until fork A's cheap-model table arrives.
- Commits on project-runner: 38d78ed, c444d5c, 86c562d, b555d9e, bb75e01, ad170f0.
- Second reader: main session; fork A (86c562d to take for Rainbow's 01).

## 2026-11-06 ~12:30 local — step (1) final table, merges, the runner's trace step (fork F)
- Step (1): $18.97 of $20 (apt846-auto ledger since 08:35Z). 11/11 rooms ≤ 1 %, 44/44 pictures PASS gate + R25. Judges ×3: dining, bedroom-main, wardrobe, bedroom-2 and terrace-railing PASS; kitchen (05's column side, 03's fridge reads as stainless), living (armchair/sofa) and bath-guest (shower door) FAIL. Open by eye: 03 finishes ×3 and 02 concrete/marble (plinth stubs). The spend-ledger rows' local times for step (1) are wrong: the calls ran 08:39–10:07Z.
- Shared fixes from step (1): band-edge FAIL regenerates (it is not a trace fault); finish price from the model table; composite-first finishes with FLOOR_SLACK 50; --no-finish-composite; panel-ready fridge words; the judge accepts storage for a fridge.
- Merged main (auto-trace T1–T17) into project-runner 882963d and studio-supabase 918a181.
- Trace step: run-project --steps trace (dc12e2a, parity row 27).
  - The 846 PDF FAILS on a fresh reading (73/78, and 73/79 with the spec). It PASSES 85/85 only with fork B's saved vlm.json.
  - dims_gate against apt846: closed 6/6, rows 17/17, casework 3/3 in both; open-plan outline 4.35 % (saved reading) vs 62 % (fresh).
  - Tall typing fixed: fridge only in a kitchen or at a counter run (c96aa0c).
  - Trace spend: $0.094.
- Eliran: no more paid spend.
- Second reader: main session; fork B (reading variance; the duplicate laundry tall units).

## 2026-11-06 ~14:30 local — 846 fresh readings exit 0 through the runner; portal stage deploy-P-2 ready (fork F, $0)
- Merged main 19cae62 into project-runner and studio-supabase. Took aaed3d1 (R23b hotspots, R31/R32) into project-runner as b4b1cec: tour.js keeps the runner's returnUrl, fidelity.json keeps max_attempts 5. The scenes step runs hotspot-check (parity 28, row 29 for R31/R32); apt846-auto hotspots 24/24.
- Trace step: --vlm-file / --no-judge pass through (70691d7). Fork B's fresh readings A and B both exit 0, 85/85. dims_gate vs apt846: closed 6/6, rows 17/17, rooms 10/10, area +0.44/+0.33 %, outline 4.29/4.28 %, openings 7/8, fixed 3/3. Tall units: fridge (kitchen) and storage (laundry).
- Portal stage: worktree .wt/portal-stage (studio-supabase + project-runner + sandbox-worker). Stage .wt/deploy-P-2 passes predeploy 32/32; deploy-P-1, the raw stage without the overlay, fails 27/32 and is kept. NOT deployed.
- Plan: development/plans/2026-11-06-portal-stage-and-worker-snapshot.md (784eee3).
- Second reader: main session (asks Eliran for the deploy go); fork E (snapshot rebuild into Supabase).

## 2026-11-06 ~15:30 local — the $0 portal run on Eliran's «כל מה שלא דורש עוד כסף» (fork F)
- npm i (sandbox SDK). Preview deploy habait-flow-p7hrio5dm (deploy-P-3 with --edit-api; P-2's preview lacked the tour edit API): deployed QA 32/32. No prod.
- Worker snapshot snap_MNAYvvf4… built in 158.9 s (Blender, Chromium, 377 files), pointer in the preview's Supabase store.
- Test job jtmw4xx9p8 (no_paid): the cloud trace PASSES in 2.4 min at $0 (saved reading, --no-judge). The build stopped at furnish:
  - a crash on a roomless vision-box vanity (fixed, 8eb4f8d);
  - then the furnish audit refuses the auto plan: vision boxes block 2 bath doors, 2 drawn fixtures cut walls — a trace finding for fork B.
  - My approval helper bug (no queue pointer, a string log line) cost one idle 44-min Hobby session.
- Main: portal-stage merged a26192e + 215c2b6; parity 29 PASS. fal/OpenRouter $0.
- Second reader: main session; fork B (vision-box duplicates, wall cuts); fork E (snapshot, worker).

## 2026-11-07 — local build proof of the auto-traced 846; parity rows 30–33 (fork F, $0)
- Row 30: a stage failure goes to Habait's review with one Hebrew line (job.error empty).
- Row 31: open-plan boundary links. Row 32: room loops wound positive, and the ground below the floor (floor × 320 cm, never 0 — ground_offset_cm 0 had put the terrain in the floor plane: black floors).
- Row 33: CG-only gate occluders — plan and TEMPLATE fixtures ≥ 100 cm and showers, no R25 on a CG render. apt846-auto CG-only now 11/11 PASS (fork E had 8/11).
- Local build from fresh reading A: trace → furnish PASS → render 11 rooms in 859 s → hotspots 23/24 → CG-only gate 5/11 PASS (bedrooms fixed by row 33). Still FAIL: kitchen 1.14, entrance 1.12, guest bath 1.87, corridor 2.23, terrace 2.49, wardrobe area 69.39 % (walls vs boundary on the corridor side). No package.
- Render assets (HDRI, catalog models) are gitignored; copied from live into portal-stage. Main: d3b149a, 5551641; parity 33 PASS.
- Trace findings to fork B: o-arc-8 on a wall, o-3 bedroom→outside, the corridor marker on a wall, the wardrobe/corridor walls.
- Second reader: main session; fork B; fork E (cg-only mode).

## 2026-11-07 — parity row 34 with a negative control; the auto 846 at 5/10 (fork F, $0)
- Row 34 (--cg-only): a loop 'wall' hit with no wall face at the hit point is not judged; only the camera room's own faces are judged. The first, broader version (40 cm from glass/open) broke the hand plan's wardrobe (1.10 %) and was narrowed. Hand plan apt846-auto: 11/11 PASS.
- Negative control: a bedroom wall moved 10 cm in a plan copy goes 0.81 → FAIL 1.21 %, the same with or without the exclusions. A living-room wall moved 10 cm stays under 1 % with or without them — the CG-only metric's limit (p90 against the 914 cm long side).
- The apartment step recomputes room bbox / clear dims / area from the loop (fork B's merged rooms kept stale ones).
- Auto 846 after fork B 301d326: PASS bedroom, kitchen, dining, living, master bath; FAIL entrance 1.37, master bedroom 1.23, wardrobe 2.04, terrace 2.49 (the builder sees past the plan's terrace walls), guest bath 2.20 (loop offset → fork B). No package. Main 75bce37, parity 34.
- Second reader: main session; fork B (loop offsets); fork E (cg-only metric limits).

## 2026-11-07 — rows 35–36: the print rows into the plan, the per-wall CG check (fork F, $0)
- Row 35: the casework step carries the sheet's printed dimension lines into plan_meta.printed_dimensions (30 lines on the auto 846). A bedroom wall moved 10 cm fails print row pdf-25 at 3.97 %. The living room's only print row doesn't measure the moved wall, and a moved end re-ties to the nearest feature (option ii, deferred).
- Row 36 (--cg-only): per-wall-face check (median signed error over ≥ 10 columns vs max(1 % of distance, 5 cm)), and (a″): a loop hit counts only if a physical wall face meets the same ray within 14 cm.
  - Hand plan 11/11. Bedroom control FAILS 2.09 %. Living control (whole w-6 translated 10 cm) FAILS 1.19 %; the room p90 alone gave 0.77 %.
- Terrace: the builder builds the plan's w-5 (a 290 cm prism); the fail was a loop corner 7.7 cm past w-5's end → (a″).
- Auto 846: PASS bedroom, kitchen, dining, wardrobe, master bath. FAIL guest bath, living, terrace, entrance on loop-vs-wall-face offsets of 5.5–6.8 cm (fork B); master bedroom on spread error (room p90 1.23). No package. Main 20e5aee, parity 36.
- Second reader: main session; fork B (loop offsets per face id).

## 2026-11-07 late — final local auto-846 build after fork B's snap rule: 7/10, no package (fork F, $0)
- portal-stage de46c91, parity 36. Render 637 s.
- PASS: bedroom 0.79, kitchen 0.21, dining 0.53, living 0.64 (the snap fixed its 6 cm faces), wardrobe 0.58, master bath 0.73, entrance 0.58.
- FAIL:
  - guest bath 1.48 % — a steady +3 cm loop-inside-face offset in a 2.75 m room;
  - master bedroom 1.23 % — face loop#4 +4.3 cm;
  - terrace 1.30 % — face loop#160 5.5 cm at the glass/parapet corner, not snapped by the parallel-wall rule.
  All → fork B. No package, so deploy-P was not re-staged.
- For the final go: re-stage deploy-P (--studio --edit-api + overlay), predeploy, refresh-snapshot, a preview on the go.
- Second reader: main session; fork B.

## 2026-11-08 — the auto-traced 846 packages: 10/10, hotspots 22/22, qa PASS; deploy-P re-staged; snapshot refresh blocked by the Hobby 402 (fork F, $0)
- After fork B's edge_kinds fix (main f2cf9b2) plus parity row 37 (a camera stands outside every door swing + 30 cm; stepRender carries the plan's camera points into the furnished plan). Main d81a7a7, parity 37 PASS.
- CG-only gate 10/10: bedroom 0.21, guest bath 0.83, kitchen 0.15, dining 0.16, living 0.33, terrace 0.08, master bedroom 0.25, wardrobe 0.58, master bath 0.73, entrance 0.96 %. No wall face fails. Print rows ≤ 0.83 %. Packaged 99 files / 7.2 MB.
- deploy-P-4base re-staged (stage_flow --studio --edit-api, new code): PREDEPLOY GATE PASS 32/32, no overlay needed. Not deployed; the preview waits for Eliran's go.
- refresh-snapshot --go → HTTP 402 "Hobby plan usage limit exceeded for Snapshots Storage", reset 2026-12-01.
  - A read-only list shows 8 live snapshots, ≈ 18.7 GB: kXiRFKpe (11-06 14:01, 3.2 GB), MNAYvvf4 (the preview pointer, 3f36551 code, 3.2 GB), B6JlGlUf, PH845feN, 3zqDV281, DXWv2R1b, EPT6W3rT, g1GxIMK8 (11-05, 1.6–2.8 GB).
  - So a cloud job still runs the 3f36551 runner.
  - The way out is Eliran's call: delete old snapshots, or move to Pro.
- Second reader: main session (Eliran's go on the preview + the snapshot call).

## 2026-11-08 — snapshots cleaned, preview up, studio boot fix, first cloud $0 job: gate stop at the entrance → parity row 38 (fork F)
- On Eliran's words (via the coordinator): «כן, תמחק» and «כן תעלה לניסיון».
- Snapshots:
  - The 6 old 11-05 snapshots were deleted after a pointer check: the store pointer in preview AND production = MNAYvvf4.
  - MNAYvvf4 and kXiRFKpe were kept.
  - refresh-snapshot → snap_PkPtEh1fqPXGKZi3EANZwplZdYtM (portal-stage 3449849, 55 s); studio/worker/snapshot.json repointed.
- Preview 1: deploy-P-4base → habait-flow-l8nunvvgn (dpl_2P7TR3tw). QA 32/32 PASS, past SSO via the OIDC header (`--header-env x-vercel-trusted-oidc-idp-token=VERCEL_OIDC_TOKEN` under `vercel env run`).
- Eliran's browser hung on «טוען…» at /studio/. I could not reproduce it headless: config, Clerk and heIL all 200, sign-in at about 1 s.
  - The defect was in the code: boot() awaited the network with no deadline.
  - Fix, portal-stage b2b07ab: deadlines (config 10 s, Clerk script 20 s, clerk.load 20 s, heIL optional 6 s), a 30 s watchdog, and a Hebrew error naming the step with «נסו שוב».
  - Brand: an inline-flex item trimmed the space, so it rendered "StudioHabait"; fixed with gap.
  - Simulated stalls show the error at 10 or 20 s.
  - Preview 2: deploy-P-5 → habait-flow-hhoy82mut (dpl_xv8rANmM). Only the studio.js/css hashes changed. QA 32/32 PASS.
- Cloud $0 job jtmw7efe4x (forkf-test/pcloud846, vlm-fresh-a, no_paid):
  - Trace PASS in 2 min 16 s, plan equal to the local one. The build reached the gate.
  - Gate 9/10: entrance FAIL 1.88 (loop:r-entrance#5 −9.4 cm, local −4.8).
  - Cause: run-job never uploaded pdf-vectors.json, so the build's casework ran without vectors: 0 print rows, hob/sink on the fallback (wrong run).
  - Fix: row 38 (portal-stage 461e6b6, parity 38 PASS). Not yet proven in the cloud; it needs a refresh plus one more job (asked).
- A store read can be stale for about 1 min after a write (the approval read 'waiting'); retry worked.
- Second reader: main session (the go for refresh + rerun; the review wording; deleting PkPtEh1f later is Eliran's act).

## 2026-11-08 later — rows 38–39 proven in the cloud; the entrance FAIL is the cloud's 1024 draft render (fork F, $0 fal)
- Row 39 (portal-stage ec8dbb7): a post-trace review logs «הבדיקה של ההדמיה מול תכנית המכר לא עברה עדיין — המערכת ממשיכה לתקן». studio.js treats every review with stage ≠ trace as a build review. Parity 39 PASS.
- Refresh → snap_WekUfQAXKGEAS20FrLX6Ldd2ACMn (ec8dbb7). No snapshot was deleted.
- Cloud job 2, jtmw7fsv1y (pcloud846b):
  - Trace PASS. Casework now reads the vectors: hob (747,527) and sink (610,695) as drawn, 30 print rows.
  - Gate 9/10: entrance FAIL 1.88 again (loop:r-entrance#5 −9.4 cm, n11).
- Cause, proven locally:
  - The cloud build is dispatched with --draft (_dispatch STAGES.build.draft), which means 1024×512@16. Local renders 2048×1024@16.
  - Re-rendering only the local cp-entrance at 1024×512 gives exactly 1.88 / −9.4 cm / n11. Re-rendered at 2048, it is back to 0.96. Local ptrace846 is restored to 10/10.
- Open, and the coordinator's call: render the cloud build at 2048×1024@16 (about 40 min on 4 vCPU), or leave the gate as it is. Making the gate resolution-aware would weaken it; not recommended.
- Second reader: main session.

## 2026-11-08 end — row 40 (cloud build renders at 2048x1024@16); deploy-P-6 staged; snapshot refresh blocked again (fork F)
- The coordinator's ruling (a): portal-stage 3cfe714. _dispatch STAGES.build.render = '2048x1024@16' replaces --draft; a named --render still wins. Parity 40 PASS.
  - Cost recorded in plan §6 (development/plans/2026-11-06-portal-stage-and-worker-snapshot.md, main b85f325): one 2048 build ≈ 3 CPU-h ≈ most of Hobby's monthly 5.
  - Not re-proven in the cloud, on the coordinator's word.
- refresh-snapshot → 402 again (Hobby snapshot storage). Live snapshots: 1XgZpGdu (06:36, job 2's persistent build sandbox), WekUfQAX (the pointer), PkPtEh1f, kXiRFKpe, MNAYvvf4, ≈ 3.2–3.4 GB each.
  - Nothing deleted, on the coordinator's word.
  - No functional loss: since ec8dbb7 only _dispatch.mjs changed, and it runs in the portal's function (deployed with the stage), not on the VM. The VM code in WekUfQAX equals 3cfe714.
- deploy-P-6 staged from the final code (studio fix + row 39 portal + row 40): PREDEPLOY 32/32 PASS. vs P-5, only api/_dispatch.mjs and studio/studio.js changed. Linked; not deployed.
- Second reader: main session (the production go to Eliran; the snapshot cleanup call).

## 2026-11-08 — row 41, the build lock (Eliran «כן, ועם נעילת בנייה»); deploy-P-7 staged, lock proven on preview (fork F, $0)
- portal-stage d1b8fdd:
  - _dispatch.dispatch refuses a build unless studio/approvals/<uid>/<pid>.json has build_approved:true. That path is outside the developer's prefix; no portal API writes there.
  - Exempt: job.no_paid and --no-paid test jobs.
  - Error code build_approval, message «הבנייה ממתינה לאישור צוות Habait — נעדכן כאן».
  - studio-projects approveTrace keeps the trace approval, then parks the job waiting/build_approval: no queue pointer, no sandbox.
  - A page-load retry that hits the lock parks the job too.
  - studio.js labels the stage.
  - Admin CLI tour360/tools/approve-build.mjs <uid> <pid> [--by] [--revoke] [--go] | --show. Dry-run by default, history kept. Approving requeues a parked job.
  - Parity 41 PASS.
- Proof:
  - Unit test (in-memory store, stub Sandbox): refused with no flag, with another user's flag, and when revoked; allowed when approved, for the trace stage, and for a $0 job.
  - Preview habait-flow-b88g3kacy (P-7), with a Clerk +clerk_test user and a backend-API session (revoked after): approveTrace → 200 {waiting:'build_approval', Hebrew message}, job waiting, sandbox null, no queue pointer. The poll did not dispatch.
  - The real dispatch against the real store with a stub Sandbox: REFUSED before the flag, ALLOWED after `approve-build --go` (stopped at the stub: no VM, no fal), REFUSED after --revoke.
- Test data left in the store (deleting it is Eliran's act): studio/u/<clerk_test uid>/p/plocktest846/ (job parked waiting), studio/approvals/<uid>/plocktest846.json (revoked), studio/queue/jlockmw7hvsrm.json, studio/jobs/jlockmw7hvsrm.json.
- The store's read-after-write is stale for about 10–20 s (seen three times). Code that writes then reads (the CLI read-back) can mis-report; noted, not fixed.
- deploy-P-7 = P-6 + the lock (3 files changed: api/studio-projects.mjs, api/_dispatch.mjs, studio/studio.js). PREDEPLOY 32/32 PASS. Production deploy = the coordinator, on Eliran's go.
- Second reader: main session (prod deploy; whoever approves builds runs approve-build under `vercel env run -e production`).

## 2026-11-08 — cleanup on Eliran's «תמחק» (via the coordinator), exactly the named list (fork F)
- Checked first: the worker pointer studio/worker/snapshot.json = snap_WekUfQAX (preview and production read one Supabase store).
  - kXiRFKpe was proven to be the currentSnapshotId of the test sandbox job-jtmw4xx9p8-build (forkf-test ptmw4xx9p8), unreferenced.
  - 1XgZpGdu is job-jtmw7efe4x-build's.
  - WekUfQAX's parentId was PkPtEh1f, but kXiRFKpe had survived its own parent's deletion.
- Deleted:
  - Vercel snapshots: PkPtEh1f, MNAYvvf4, 1XgZpGdu, kXiRFKpe.
    - After the deletion, WekUfQAX status "created", and a 2-vCPU boot check passed: run-job/run-project syntax OK, Blender present, BOOT-OK in 3.4 s, stopped.
  - Store, 123 objects by exact prefix:
    - forkf-test/p/{pcloud846 11, pcloud846b 12, ptmw4xx9p8 11};
    - the +clerk_test user's p/plocktest846 (2), plus studio/approvals/…/plocktest846.json, studio/queue/jlockmw7hvsrm.json and studio/jobs/jlockmw7hvsrm.json;
    - p/pmw3lzgvbb021a6 (23, «fork F prod e2e · 846 (test)»);
    - fork G's +clerk_test «Supabase e2e · 846» projects: pmw3l88sha5f2de (19), pmw3lamkbb2714b (19), pmw3ldaou24c1be (23).
    - Re-listed afterwards: 0 of 123 remain.
  - Local: Habait/tour360/apartments/ptrace846neg, negb … negi (9, untracked) in portal-stage, and .wt/deploy-P-1 (416 MB, ignored).
- Kept on purpose:
  - Rainbow pmw3lvq2z559959 (user_3Le1HV…, NOT a +clerk_test user, created 11-04 = a real account);
  - studio/engine.json and the worker pointer;
  - outside the list: the job/queue index files of the deleted jobs (jobs/jtmw4xx9p8, jtmw7efe4x, jtmw7fsv1y, jmw3leksd6be461, jmw3m1vbm02f985; queue/jmw3leksd6be461, jmw3m1vbm02f985) and the 4 test users' projects.json (they list the deleted projects);
  - snapshot snap_v2BtaUo2 (job-jtmw7fsv1y-build's, created 07:03, after the list was made);
  - .wt/deploy-P-1.predeploy, and apartments/ptrace846 and ptrace846links.
- Only 3 of fork G's "4" Supabase test projects exist in the store; no 4th test-user project was found, so none was guessed.
- Second reader: main session (the leftovers above need their own go).

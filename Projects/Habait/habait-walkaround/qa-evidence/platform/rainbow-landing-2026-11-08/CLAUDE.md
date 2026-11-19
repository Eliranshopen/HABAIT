# qa-evidence/platform/rainbow-landing-2026-11-08/ — context file
<!-- last-updated: 2026-11-08 -->

## Purpose
Evidence for the Rainbow landing page (plan `development/plans/2026-11-08-rainbow-landing.md`), on a local stage of the worktree (`stage_flow.py` variant: platform from `.wt/rainbow-landing`, `_local` media from live main, `--edit-api --studio`).

## Subfolders
| Folder | What |
|---|---|
| `check/` | `Habait/platform/test/rainbow-landing.check.mjs` at 1440 and 390 (round 2, project-level page): poster first paint, film playing, paused, sections, EN, no 846 shortcut, one CTA target, CTA → /hold/, reduced motion; `result.json` PASS |
| `flow/` | `Habait/platform/test/rainbow-flow.check.mjs`: landing → CTA → film → stop → all apartments → pick → enter; `flow.json` PASS |
| `hold-chrome/` | round 3: the hold's top chrome at the stop, 360/390/430/1440, bounding-box overlap check PASS |
| `hold-chrome-before/` | the same check on live main before the fix: FAIL (the before picture) |
| `no-price/` | price round: no price text anywhere at 360/390/1440, no /studio/ link on the landing; prod dev-only items hidden — PASS |
| `no-price-before/` | the same check on live main before: FAIL (the before picture) |
| `timing-before/` · `timing-after/` | round 6b: click → picker interactive, 17.4 s with the old intro → 8.8 s with the 2x intro (390 + 1440) |
| `motion/` | round 7: the scroll story at 1440 and 390, hero + each chapter mid-animation and at rest, reduced motion static; `motion.json` PASS |
| `r8-directions/` | round 8: three luxury-palette direction mocks (A/B/C) + contact sheet, waiting for Eliran's pick |
| `brand/` | the Habait brand: pixel-identical diff of the optimised SVG, variants, placements at 1440/390 — PASS |
| `r9-reference/` | round 9: the rainbowtlv.com teardown — `DESIGN.md`, scroll sequences, reanimate captures of the reference and our clone, compare sheets, side-by-sides |
| `r9-check/` | round 9: `rainbow-landing.check.mjs` on the worktree stage — poster LCP (heroPoster) and CLS 0 at 1440/390, film, pause, badges, one CTA → /hold/, EN, reduced motion — PASS |
| `r9-motion/` | round 9: `landing-motion.shots.mjs` — every section mid-animation and at rest, Lenis desktop only, no pins, reduced motion static — PASS |
| `r9-brand/` · `r9-no-price/` · `r9-hold-chrome/` · `r9-flow/` | round 9: the brand placements (apartment header with the developer, tour card credit), no price, the hold chrome, the full flow — all PASS |
| `r9-main/` | round 9 on a fresh stage of main after the merge: predeploy 32/32, landing, flow, no-price, hold chrome, brand, gate 10/10 — PASS |
| `r10-main/` | round 10 on a fresh stage of main: predeploy 32/32, gate 10/10, landing, motion, no-price, brand, flow — PASS |
| `r10/` | round 10: the project landing in our identity — live-now vs round-10 side-by-sides, our shots, check + motion PASS |
| `r10-references/` · `r10-mpbavli/` | round 10: six tower sites read once for inspiration (sheets, probe, scroll frames) |
| `r10-live-now/` | prod as live now (round 8 + brand), for the side-by-side |
| `r9-roles/` | round 9: /hold/ with the developer's name (clip title and under the stop title) |
| `gate/` | `Habait/tools/qa/responsive-gate.mjs` on `/`, `/landing.html`, `/apartment.html`, `/hold/`: PASS 8/8 |
| `predeploy-worktree/` | `Habait/tools/deploy/predeploy.mjs` on the worktree stage: PASS 32 page×size |
| `predeploy-main/` | the same gate on a stage built by the real `stage_flow.py` from live main after the merge |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Plan: `development/plans/2026-11-08-rainbow-landing.md`

# fix-disclosure-badge-evidence/ — context file
<!-- last-updated: 2026-11-04 -->

## Purpose
Evidence for the first feature worktree `fix-disclosure-badge` (F01/F03/F20), copied out of session rnd-db's scratchpad so it survives the session: tour in buyer mode (ui=min) before deploy (worktree build) and on production, the stage and production site checks, the stage log and the deploy output (`dpl_eDQTT7o6o2S6hprXnaCGkP1VJwTc`).

## What's here
| File | What |
|---|---|
| `tour-uimin-desktop.png`, `tour-uimin-phone.png`, `tour-check.json` | worktree build, ui=min: badge, concept, AI note, tools visible |
| `prod-tour-uimin-*.png`, `prod-tour-check.json` | the same on https://habait-flow.vercel.app/tour/ after the deploy |
| `stage-check.json`, `prod-check.json` | site_check 14/14 on the stage (:8879) and on production |
| `deploy-fdb-1.stage.log`, `deploy-fdb-1.out` | stage_flow.py output and the Vercel deploy output |
| `fdb-tour-check.mjs` | the tour check script |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · memory `memory/project/2026-11-04-feature-worktrees-plan.md`

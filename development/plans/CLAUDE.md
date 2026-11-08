# development/plans/ — the plans
<!-- last-updated: 2026-11-04 -->

## What's here
One Markdown file per plan, named `YYYY-MM-DD-<slug>.md`: the ask, what the research found (measured, dated), the decision, the mechanism, the questions Eliran rules, the phases, the risks, the done-when. A plan becomes a board through `/plan-to-tasks <plan-path>`, which writes `../tasks/<slug>/`.

| Plan | Date | Board | State |
|---|---|---|---|
| `2026-11-06-portal-stage-and-worker-snapshot.md` | 2026-11-06 | none (worktree `.wt/portal-stage`; stage `.wt/deploy-P-2`) | READY 2026-11-06 (fork F) — stage built, predeploy 32/32; waits for Eliran's deploy go and the snapshot build |
| `2026-11-04-sandbox-worker.md` | 2026-11-04 | (board: not filed yet; worktree `.wt/sandbox-worker`) | BUILT + PROVEN for the trace stage 2026-11-05 (fork E of rnd-9d): api/_dispatch.mjs boots a Vercel Sandbox per job from the worker snapshot (Blob studio/worker/snapshot.json) on build / trace approval / correction / page-load retry; proven on PREVIEW habait-flow-omt28skwt; LIVE since 2026-11-05 13:15 (dpl_AGynF5S9, Eliran's go); build stage (Blender) + approve trigger not yet run in a sandbox; evidence tools/sandbox-worker/evidence/2026-11-05-snapshot/ |
| `2026-11-04-owed-cleanup.md` | 2026-11-04 | none (harness, main session + 4 workers) | DONE 2026-11-04 — 007, 009, 018, 019 resolved; 003 authored, waits for Eliran's paste → `memory/runs/2026-11-04-owed-cleanup.md` |
| `2026-11-03-copy-habait-to-projects.md` | 2026-11-03 | `../tasks/copy-habait-2026-11-03/` | CLOSED — copied, verified twice, re-pointed, cut over; `C:\Habait` archived |
| `2026-11-03-harness-focus.md` | 2026-11-03 | none (harness, main session) | OPEN — phases 1–3 done (2026-11-03); left: OWED-018 frontmatter pass, OWED-009 paths of 2 kept agents, Eliran installs the HOT hook |
| `2026-11-03-harness-focus-phase4-prompt.md` | 2026-11-03 | none (prompt for a fresh session) | READY — Eliran pastes it into a new session in `C:\RnD` |
| `2026-11-03-apartment-3d-ux.md` | 2026-11-03 | `../tasks/apartment-3d/` | CLOSED 2026-11-03 — executed + copied back (labels, tap→360, look pass, Cycles light, real floors from the tour, live URL fix); in production since 2026-11-04 (staged from live with the platform-ui-ux deploys) |
| `2026-11-03-dollhouse-in-tour.md` | 2026-11-03 | `../tasks/dollhouse-in-tour/` | CLOSED 2026-11-03 23:25 — option 1 in the repo (live 48/48), in production since 2026-11-04 (staged from live); option-3 spike proven (logs/spike-07/REPORT.md), productizing = Eliran's call |
| `2026-11-04-hold-building-tour.md` | 2026-11-04 | `../tasks/hold-building-tour/` | CLOSED 2026-11-04 — shipped to habait-flow prod (dpl_3avVrzv8…), QA PASS: "הדמיית הבניין והסביבה" button on /hold/ opens the tour's exterior chain as an overlay (one URL), continues into the apartment; /tour/ unchanged |
| `2026-11-04-transition-rise.md` | 2026-11-04 | `../tasks/transition-rise/` | CLOSED 2026-11-04 — rise + dive, re-gate PASS, live check 36/0; DEPLOYED 2026-11-04 on Eliran's go (dpl_HprzbAudnPdUCLididJWbhB9Cm8X, with platform-ui-ux) |
| `2026-11-04-exterior-realistic-video-3d.md` | 2026-11-04 | `../tasks/exterior-film/` | EXECUTING 2026-11-04 — approved (Eliran: "תענה על השאלות של עצמך … ותמשיך"): the building button becomes a ≥1080p realistic film (A), then a free 3D splat after a spike (B) |
| `2026-11-04-feature-worktrees.md` | 2026-11-04 | (boards per phase via `/plan-to-tasks`, none yet) | READY for Phase 0 — 3 tracks, 26 live fixes; Eliran answered all 6 calls; spine decided (Studio front + engine runner, §9); one worktree per room, clear names (§10); `.wt` archived |
| `2026-11-04-one-git-repo.md` | 2026-11-04 | none (harness, main session rnd-a2) | DONE 2026-11-04 — commit `de560da`: `Projects/Habait` tracked in `C:\RnD` (habait-walkaround = its 935 files); tools and media stay out; the old `.git` archived at `C:\Habait-git-archive-2026-11-04` |
| `2026-11-04-workflow-cleanup.md` | 2026-11-04 | none (harness, main session) | DONE 2026-11-04 (Eliran: "מאושר") — stale git text fixed, one state source (`scripts/board_state.py`, Check 18), `plan-to-tasks` 91 / `sync-context` 66 lines, explicit-only; not committed |
| `2026-11-04-developer-platform.md` | 2026-11-04 | (none yet) | DRAFT 2026-11-04 (rnd-67): the developer portal on habait-flow (upload → AI builds → link), 7 phases P0–P6; waits for Eliran's 4 calls (worker hosting, login, cost per project, legal) |
| `2026-11-04-apt-furniture-swap.md` | 2026-11-04 | (board: not filed yet; worktree `.wt/apt-furniture-swap`) | SHIPPED 2026-11-04 (rnd-67): on habait-flow for every visitor: 49 rings → 18 AI catalog items + typed bar; 4 deploys, last dpl_6wv13ZNo…; ≈ $3 |
| `2026-11-04-tour-exterior-floors.md` | 2026-11-04 | `../tasks/tour-exterior-floors/` | CLOSED 2026-11-04 — live QA PASS, deployed, prod QA PASS |
| `2026-11-03-platform-ui-ux.md` | 2026-11-03 | `../tasks/platform-ui-ux/` | CLOSED 2026-11-04 — shipped to habait-flow prod (dpl_HprzbAudnPdUCLididJWbhB9Cm8X), deployed-site QA 22 PASS; open: the a11y statement draft (OWED-024) |
| `2026-11-03-studio-agent-fal.md` | 2026-11-03 | (board: none; steps in the plan, after platform-ui-ux card 20) | DONE 2026-11-03 23:37: copied back, live tests 14/14 + 9/9, paid check $0.17; records `../tasks/studio-agent-fal/` — the Studio agent chat + intake through a fal LLM (`openrouter/router/vision`) |

## Conventions / gotchas
- **Every plan lives here** (Eliran, 2026-11-03, root §8.8): from the main session, a sub-agent or a skill, for the harness or any project. Add its row to the table above in the same change. Plan mode writes here through `plansDirectory` in `.claude/settings.json` under a random name — rename it to `YYYY-MM-DD-<slug>.md` when the plan is saved or approved.
- Numbers in a plan are measured and dated, never estimated without saying so.
- **State has one source** (plan `2026-11-04-workflow-cleanup.md`): once a plan has a board, the board README's `**State:** \`WORD\`` line is the truth and this table's State cell starts with the same word; a plan with no board keeps its state here. `python scripts/board_state.py` checks it (dry-run; `--go` rewrites only a leading state word).
- The plan is the why; the board README is the execution order. Change the plan, then re-run `/plan-to-tasks` rather than editing cards by hand to a different plan.

## Rule §8.8 detail
(Moved from root `CLAUDE.md` on 2026-11-04, wording unchanged.)
- **Plan mode** writes straight into this folder (`plansDirectory` in `.claude/settings.json`); its file gets a random name, so rename it to `YYYY-MM-DD-<slug>.md` when the plan is saved or approved. If plan mode can't write here, say so to Eliran and offer "save the plan only" before asking for approval.
- A plan is a plan file, not a working-folder copy: it is written to the live folder directly, never through `.wt\`. A board is made from it with `/plan-to-tasks development/plans/<file>`. The track plan-of-record files that inherited agents name (`Habait/MVP/PLAN.md`, `3D/MVP-PLAN.md`, `video/DIVISION-PLAN.md`, `360walkaround/V2-PLAN.md`) are not created yet; when one is needed it is created here, and the agent that names it is re-pointed in the same change.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Boards: [../tasks/CLAUDE.md](../tasks/CLAUDE.md)

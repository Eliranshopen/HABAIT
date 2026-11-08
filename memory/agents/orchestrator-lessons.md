# orchestrator-lessons — the orchestrator's memory file (`memory/agents/_about.md`)

- 2026-11-03 · pointer · Eliran's ruling: one worktree per new thing under `C:\RnD\.wt\<name>` (root §8.7, WORKTREES.md rule 8) — open the worktree before routing any board; blocked until git exists → `memory/project/2026-11-03-worktree-for-every-new-thing.md`
- 2026-11-03 · pointer · worktree rule LIVE: harness repo `e6c2596`, first worktree `.wt/worktree-setup` merged + `archive/worktree-setup`, `worktrees.json` holds 3 entries, check 16 PASS → `memory/runs/2026-11-03-worktree-rule-live.md`
- 2026-11-03 · pointer · no old git: harness repo has no identity and no remote; no commits until Eliran configures the new git; `.wt/new-git-pending` stays uncommitted → `memory/runs/2026-11-03-old-git-dropped.md`
- 2026-11-03 · pointer · NO GIT (Eliran): `.wt/<name>` are plain working folders with a sha256 manifest (root §8.7); git inventory and `/worktree-ops` suspended → `memory/project/2026-11-03-no-git.md`
- 2026-11-03 · pointer · cleanup: no git in any route; rulings OWED-014…021 are Eliran's before any Habait board → `memory/runs/2026-11-03-cleanup.md`
- 2026-11-03 · pointer · Eliran (option A): ONE working folder per board — every worker's follow-up fix adds an entry to that board's manifest, never a sibling folder; `.wt` is hidden in VS Code → `memory/runs/2026-11-03-one-folder-per-task.md`
- 2026-11-03 · pointer · correction: `.wt` is visible again in the VS Code Explorer (Eliran); one folder per board stands → `memory/project/2026-11-03-worktree-for-every-new-thing.md` (5th entry)
- 2026-11-03 · pointer · Eliran: a working folder only for a NEW TASK he opens, not for every action (root §8.7) → `memory/project/2026-11-03-worktree-for-every-new-thing.md`
- 2026-11-03 · pointer · Eliran: `.wt` only for project changes (never harness work); 8 harness folders removed, `apartment-3d` kept → `memory/runs/2026-11-03-wt-cleared.md`

- 2026-11-04 · second-reader pointer only: Eliran ruled ".wt" — `.wt\<name>` plain working folders stay, no git worktrees → memory/project/2026-11-04-git-back.md
- 2026-11-04 · second-reader pointer only: CORRECTION — a feature now opens a git worktree `.wt\<feature>` from habait-walkaround `main` (baseline 35cc0f6), replacing the ".wt plain folders" line above → memory/project/2026-11-04-git-back.md
- 2026-11-04 · second-reader pointer only: plan development/plans/2026-11-04-feature-worktrees.md (DRAFT) — boards per phase will come from it after Eliran's 7 calls → memory/project/2026-11-04-feature-worktrees-plan.md
- 2026-11-04 · second-reader pointer only: worktree names = plan development/plans/2026-11-04-feature-worktrees.md §10 (apt846-room-NN-*, film-NN-*, platform-NN-*, base-*) → memory/project/2026-11-04-feature-worktrees-plan.md

# workspace-steward — memory

## 2026-11-03 — verify copy C:\Habait -> C:\RnD\Projects\Habait (board copy-habait-2026-11-03 task 04)
- **Did:** five read-only checks; all PASS. Strict verify_walk run FAILed only because exclude.txt is corrupted (literal TAB in the three `C:\Habait\tools\...` lines); fixed copy in logs/ gave only live-session deltas (platform/test/shots, flow.js, events.jsonl).
- **Evidence:** `development/tasks/copy-habait-2026-11-03/logs/verify-report.md`. HEAD 506f63d both sides; status 145 vs 146 (`.claude/worktrees` excluded); .env has FAL_KEY and MYARCHITECTAI_API_KEY only.
- **Learned:** exclude.txt written via shell loses `\t`; use forward slashes or fix before reuse. Live session keeps changing shots, so re-verify at cut-over.
- **Owed:** fix exclude.txt; final re-run of check 1 at cut-over.
- **Second reader:** habait-asset-wrangler.

## 2026-11-03 — verify 2 after cut-over re-sync (board copy-habait-2026-11-03 task 09 step 4)
- **Did:** five read-only checks, all PASS. robocopy /XO /L Copied 0 (only extra REPOINTED.md); walk diffs (158 size, 44 hash) all inside REPOINTED.md; fsck clean, HEAD 506f63d; status diff = 21 re-pointed files + `.claude/`; .env has the two expected keys.
- **Evidence:** `development/tasks/copy-habait-2026-11-03/logs/verify-report-2.md`.
- **Learned:** .env lives at habait-walkaround/.env; verify_walk prints FAIL on expected re-pointed files, classify against REPOINTED.md table rows.
- **Second reader:** habait-asset-wrangler.
- 2026-11-03 · pointer · Eliran's ruling: one worktree per new thing under `C:\RnD\.wt\<name>` (root §8.7, WORKTREES.md rule 8); blocked until git exists → `memory/project/2026-11-03-worktree-for-every-new-thing.md`
- 2026-11-03 · pointer · worktree rule LIVE: harness repo `e6c2596`, first worktree `.wt/worktree-setup` merged + `archive/worktree-setup`, `worktrees.json` holds 3 entries, check 16 PASS → `memory/runs/2026-11-03-worktree-rule-live.md`
- 2026-11-03 · pointer · no old git: harness repo has no identity and no remote; no commits until Eliran configures the new git; `.wt/new-git-pending` stays uncommitted → `memory/runs/2026-11-03-old-git-dropped.md`
- 2026-11-03 · pointer · NO GIT (Eliran): `.wt/<name>` are plain working folders with a sha256 manifest (root §8.7); git inventory and `/worktree-ops` suspended → `memory/project/2026-11-03-no-git.md`
- 2026-11-03 · pointer · cleanup: your git mandate is suspended (banner in your definition); inventories are `ls .wt` plus manifests → `memory/runs/2026-11-03-cleanup.md`
- 2026-11-03 · pointer · one folder per task, never per fix (Eliran, option A); `.wt` hidden in VS Code by `.vscode/settings.json`, so inventory with `ls C:/RnD/.wt`, not the Explorer; the two old copies hold 0 unique files (OWED-012) → `memory/runs/2026-11-03-one-folder-per-task.md`
- 2026-11-03 · pointer · correction: `.wt` is visible again in the VS Code Explorer (Eliran); only VS Code search skips it → `memory/runs/2026-11-03-one-folder-per-task.md` (3rd entry)
- 2026-11-03 · pointer · Eliran: a working folder only for a NEW TASK he opens, not for every action (root §8.7) → `memory/project/2026-11-03-worktree-for-every-new-thing.md`
- 2026-11-03 · pointer · Eliran: `.wt` only for project changes (never harness work); 8 harness folders removed, `apartment-3d` kept → `memory/runs/2026-11-03-wt-cleared.md`
- 2026-11-03 · pointer · harness `.git` removed (OWED-012 resolved); nothing git-shaped left in the harness → `memory/runs/2026-11-03-git-removed.md`

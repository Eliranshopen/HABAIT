## 2026-11-03 · main session · the harness git folder removed (OWED-012)
- **Did:** on Eliran's "run" (his reply to the removal command in the cleanup summary) removed `C:\RnD\.git` (1,398 files, 0 reparse points), `C:\RnD\.gitignore` and the empty `memory\listings\.gitkeep`, `memory\project\.gitkeep`, `memory\runs\.gitkeep`. The two git worktree folders in the same command were already gone: another session cleared `.wt` on Eliran's go (`runs/2026-11-03-wt-cleared.md`). `Projects\Habait\habait-walkaround\.git` was not touched (data from before, Eliran's ruling).
- **Evidence:** PowerShell `Test-Path` after removal → False for all five; product `.git` → True.
- **Learned:** check the target list right before a removal — half of a command written an hour earlier had already been done by a parallel session.
- **Owed / open:** none for git. With no `.git`, editors no longer honour the old ignore rules; VS Code's own `search.exclude` in `.vscode/settings.json` is now the only search filter.
- **Second reader:** `workspace-steward` (nothing git-shaped left in the harness).

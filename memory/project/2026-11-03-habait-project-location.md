## 2026-11-03 · main session · where the Habait product lives
- **Did:** copied `C:\Habait` → `C:\RnD\Projects\Habait` (robocopy, 12:14–12:19; 29,552 files / 30.4 GB; tier-0 junk and the non-relocatable venv excluded); a fresh verifier passed 5/5 (`development/tasks/copy-habait-2026-11-03/logs/verify-report.md`); paths re-pointed in the copy (`Projects/Habait/REPOINTED.md`); venv re-created at the new path.
- **Evidence:** the board folder `development/tasks/copy-habait-2026-11-03/` (logs, summaries, report).
- **Learned:** the project is a lab workspace, not a repo; only `habait-walkaround/` is git (HEAD `506f63d`, dirty by design, remote still the previous CTO's). Every `_local/` holds paid outputs. Two `.env` copies exist until cut-over. Habait sessions start from `C:\RnD\Projects\Habait` (Q5).
- **Owed / open:** cut-over on Eliran's word (task 09: re-sync, re-verify, archive-rename of `C:\Habait`); `OWED-009` the harness's 12 `habait-*` agents still point at `Habait/MVP/app`.
- **Second reader:** `habait-agent-smith` (OWED-009 is its board) · `codebase-cartographer` (the project's cards are now in the Context map).
- **Correction 2026-11-03 (cut-over done):** `C:\Habait` is now `C:\Habait-archive-2026-11-03` (frozen); `C:\RnD\Projects\Habait` is the only live copy and the only live `.env`. Evidence: `memory/runs/2026-11-03-copy-habait-cutover.md`.

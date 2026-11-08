# Task 09 — cut-over: re-sync, re-verify, hand over the archive command
**Agent:** `habait-asset-wrangler` for the sync; `workspace-steward` (fresh) for the re-verify; Eliran for the archive · **Model:** sonnet · **Ruling tier:** T1 · **Burst:** 6 · **Depends on:** 08 and Eliran's word "cut over"
**Memory file:** `memory/agents/habait-asset-wrangler.md`

## What to do
1. Precondition: Eliran says cut over; no `habait-*` session is active in `ListAgents`; no local server from `SESSIONS.md` answers (`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/` → connection refused for each).
2. Re-sync: task 03's robocopy commands again (same `exclude.txt`, no `/L`), which copies only files newer in the source; logs to `logs/resync-*.log`; summary with the count of files that changed since the snapshot.
3. Re-run task 06's count-first grep on any file the re-sync brought in (a file written after the snapshot carries the old root); re-point those too, append to `REPOINTED.md`.
4. Re-verify: task 04's five checks by a fresh `workspace-steward`; `logs/verify-report-2.md`.
5. Hand Eliran the archive command, `!`-prefixed, and stop (root §8.2 — a rename of the source is Eliran's act):
   ```
   ! powershell -NoProfile -Command "Rename-Item -LiteralPath 'C:\Habait' -NewName 'Habait-archive-2026-11-03'"
   ```
   (a rename, not a delete: reversible; nothing is deleted on this board, ever.)
6. After Eliran runs it: `secrets-steward` closes the two-copies note in `SECRETS-LEDGER.md` §3; the main session writes the board's `memory/runs/` entry and sets the README state to `CLOSED`.

## Acceptance
`verify-report-2.md` five PASS; the archive command is quoted verbatim in the board README with the time Eliran ran it (or "not yet run"); `SESSIONS.md` in the copy carries one appended line "moved to `C:\RnD\Projects\Habait` on <date>" (the only edit to that file).

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The source `C:\Habait` is read-only to every task on this board.** Nothing is edited, moved or deleted there. Every write goes to `C:\RnD\Projects\Habait` or to this board folder.
6. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every heavy command under `timeout N`, one at a time, foreground; robocopy runs from PowerShell or `cmd //c`, never bare in Git Bash (it rewrites `/E`-style flags into paths).

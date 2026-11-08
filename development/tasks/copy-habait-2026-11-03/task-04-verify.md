# Task 04 — verification (the board's gate)
**Agent:** `workspace-steward` in a FRESH context (never ran task 03; prompted to refute) · **Model:** sonnet · **Ruling tier:** T0 · **Burst:** 3 · **Depends on:** 03
**Memory file:** `memory/agents/workspace-steward.md`
**Reviewer scope:** copy completeness and integrity only — not the project's code, not its design.

## Check (all five must PASS; one FAIL = the gate fails and task 03 re-runs the failing entry)
1. **Nothing left to copy:** the task-03 dry-run commands re-run with `/L` list 0 files to copy per entry (`Files: ... Copied 0 ... Extras 0` in the summary; "Newer"/"Older" counts 0). Record the summary lines in `logs/verify-robocopy.md`.
2. **Counts and bytes:** a Python walk (`python -I logs/verify_walk.py C:/Habait C:/RnD/Projects/Habait exclude.txt`) with the same exclusion predicate reports equal file counts and equal byte totals; it prints both and the difference. Write the script into `logs/` first; it uses `\\?\` prefixed paths and `os.walk`.
3. **Hashes:** the same script hashes 300 randomly chosen files (seeded, seed recorded) plus every file ≤ 64 KB under `development/` and `docs/`; all sha256 match. Mismatches are listed by path.
4. **The repo:** in the copy, `git fsck --full` prints no errors; `git rev-parse --short HEAD` equals the anchor; `git status --porcelain | wc -l` equals the source's count recorded by task 03 (a difference is explained by a file the source changed after the snapshot, named).
5. **Secrets file:** `C:\RnD\Projects\Habait\habait-walkaround\.env` exists; `sed -E 's/=.*/=…/' .env | grep -v '^#'` prints exactly the two names task 01 recorded. Values are never printed.

## Files
- creates: `logs/verify-robocopy.md`, `logs/verify_walk.py`, `logs/verify-report.md` (PASS/FAIL per check with the evidence lines)
- never touches: `C:\Habait`, and nothing in the copy either (read-only)

## Acceptance
`verify-report.md` has five rows, each PASS with its evidence; the board README's gate line is updated to PASS with the date; task 03's agent is named as the second reader.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The source `C:\Habait` is read-only to every task on this board.** Nothing is edited, moved or deleted there. Every write goes to `C:\RnD\Projects\Habait` or to this board folder.
6. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every heavy command under `timeout N`, one at a time, foreground; robocopy runs from PowerShell or `cmd //c`, never bare in Git Bash (it rewrites `/E`-style flags into paths).

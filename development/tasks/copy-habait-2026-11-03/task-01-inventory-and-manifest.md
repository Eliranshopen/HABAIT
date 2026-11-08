# Task 01 — inventory, exclusion manifest, snapshot anchors
**Agent:** `workspace-steward` (status live, track harness-ops) · **Model:** sonnet · **Ruling tier:** T0 · **Burst:** 1 · **Depends on:** none
**Memory file:** `memory/agents/workspace-steward.md` (standing agent)

## What to do
Reporting only — this card writes nothing outside the board folder.
1. Produce `development/tasks/copy-habait-2026-11-03/inventory.md`: the tier-0/1/2 table of the plan §3 with **re-measured** sizes (`du -sk`) and file counts per entry, the free space on C:, and the absence of junctions (`cmd //c "dir /S /AL C:\Habait"` filtered to JUNCTION/SYMLINK, outside `node_modules`).
2. Write `development/tasks/copy-habait-2026-11-03/exclude.txt`: one line per tier-0 exclusion, as robocopy will take it — directory names (`node_modules`, `__pycache__`, `.cache`, `worktrees`) and absolute paths (`C:\Habait\tools\habait-venv`, `C:\Habait\tools\ghidra_12.1.4_PUBLIC`, `C:\Habait\tools\downloads\blender`, `C:\Habait\tools\js-sandbox\node_modules`), plus the `/XF` list (`*.pyc`). Tier-2 paths go in a second block, commented, for task 02's answer.
3. Record the snapshot anchors in `inventory.md`: `git -C C:\Habait\habait-walkaround rev-parse --short HEAD`, `git status --porcelain | wc -l`, `git ls-files | wc -l`, `git ls-files --others --exclude-standard | wc -l`, the `memory.md` byte size, the `SESSIONS.md` last-modified time.
4. `C:\Habait\tools\habait-venv\Scripts\python.exe -m pip freeze > development/tasks/copy-habait-2026-11-03/logs/pip-freeze.txt` (read-only toward the venv; this is the input for task 07).
5. Note in `inventory.md` which local servers `SESSIONS.md` lists as running and which session is active today (names only).

## Files
- creates: `development/tasks/copy-habait-2026-11-03/inventory.md`, `exclude.txt`, `logs/pip-freeze.txt`
- reads: `C:\Habait\**` (read-only), `development/plans/2026-11-03-copy-habait-to-projects.md`

## Acceptance
- `inventory.md` has every tier-0/1/2 row from the plan with a measured size and count, and the free-space line.
- `exclude.txt` parses: every line is a directory name, an absolute path that exists, or an `/XF` pattern.
- `pip-freeze.txt` is non-empty and lists `numpy`, `Pillow`, `opencv-python`, `shapely`, `ezdxf`.
- No write outside the board folder; `git -C C:\Habait\habait-walkaround status --porcelain | wc -l` is the same before and after this task.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The source `C:\Habait` is read-only to every task on this board.** Nothing is edited, moved or deleted there. Every write goes to `C:\RnD\Projects\Habait` or to this board folder.
6. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every heavy command under `timeout N`, one at a time, foreground; robocopy runs from PowerShell or `cmd //c`, never bare in Git Bash (it rewrites `/E`-style flags into paths).

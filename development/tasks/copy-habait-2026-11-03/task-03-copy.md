# Task 03 — the copy
**Agent:** `habait-asset-wrangler` (status live, track habait; "strictly read-only toward originals") · **Model:** sonnet · **Ruling tier:** T0 (the rulings were taken in 02) · **Burst:** 2 · **Depends on:** 01, 02
**Memory file:** `memory/agents/habait-asset-wrangler.md`

## What to do
1. Read `exclude.txt` and build the robocopy argument list: `/XD <each dir line> /XF <each pattern>`.
2. **Dry run:** for each top-level entry of `C:\Habait` (`habait-walkaround`, `tools`, `research`, `mix`, `development`, `data`, `.claude`, `.vscode`, `docs`) and for the three root files (`CLAUDE.md`, `SESSIONS.md`, `memory.md`), run from PowerShell:
   ```
   robocopy "C:\Habait\<entry>" "C:\RnD\Projects\Habait\<entry>" /E /L /COPY:DAT /DCOPY:DAT /XJ /R:2 /W:2 /NP /NFL /NDL /TEE /LOG+:"C:\RnD\development\tasks\copy-habait-2026-11-03\logs\dry-<entry>.log" /XD ... /XF *.pyc
   ```
   (root files: `robocopy "C:\Habait" "C:\RnD\Projects\Habait" CLAUDE.md SESSIONS.md memory.md /L ...`). Sum the "Bytes: Total" lines into `logs/dry-run-summary.md` with the planned total. Stop and show Eliran the total if it differs from the plan's estimate by more than 20 %.
3. **Real pass:** the same commands without `/L`, each under `timeout 3000` from Git Bash via `powershell -NoProfile -Command`, one at a time, foreground. Record each exit code; 0–3 is success, ≥ 8 stops the card.
4. Snapshot time: write the start and end timestamps and the source anchors (`git rev-parse --short HEAD`, `git status --porcelain | wc -l` on the SOURCE, read-only) into `logs/copy-summary.md`.
5. Never open, print or cat `.env`; it is copied as bytes like any other file.

## Files
- creates: `C:\RnD\Projects\Habait\**` (the copy), `logs/dry-*.log`, `logs/copy-*.log`, `logs/dry-run-summary.md`, `logs/copy-summary.md`
- never touches: anything under `C:\Habait`

## Acceptance
- Every robocopy exit code ≤ 3; `copy-summary.md` lists all entries with bytes and the snapshot timestamps.
- `C:\RnD\Projects\Habait\habait-walkaround\.git` exists and `git -C C:\RnD\Projects\Habait\habait-walkaround rev-parse --short HEAD` prints `506f63d` (or the anchor task 01 recorded).
- No `node_modules`, `__pycache__` or `.pyc` anywhere under the copy: `find C:/RnD/Projects/Habait -name node_modules -o -name __pycache__ -o -name "*.pyc" | wc -l` = 0.
- The source's `git status --porcelain | wc -l` is unchanged.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The source `C:\Habait` is read-only to every task on this board.** Nothing is edited, moved or deleted there. Every write goes to `C:\RnD\Projects\Habait` or to this board folder.
6. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every heavy command under `timeout N`, one at a time, foreground; robocopy runs from PowerShell or `cmd //c`, never bare in Git Bash (it rewrites `/E`-style flags into paths).

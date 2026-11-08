# Task 06 — re-point the copy's paths
**Agent:** `codebase-cartographer` (status live, track harness-ops) · **Model:** sonnet · **Ruling tier:** T0 · **Burst:** 4 · **Depends on:** 04 PASS
**Memory file:** `memory/agents/codebase-cartographer.md`

## What to do
In the COPY only (`C:\RnD\Projects\Habait`), never in `C:\Habait`:
1. Count first: `grep -rIl --exclude-dir=.git --exclude-dir=_local -E "C:\\\\Habait|C:/Habait|/c/Habait" C:/RnD/Projects/Habait` → the file list, and per-file counts. Expected hits: `CLAUDE.md`, `memory.md`, `SESSIONS.md`, `tools/README.md`, `development/tasks/habait-workplan-2026-11-02/**`, `research/**/HANDOFF.md`, `.claude/agents/*.md`, `docs/*.md`, `research/product-research-2026-11-02/*.md`. Text files only (`-I`); binaries and `_local/` are never edited.
2. Replace, form for form: `C:\Habait` → `C:\RnD\Projects\Habait`; `C:/Habait` → `C:/RnD/Projects/Habait`; `/c/Habait` → `/c/RnD/Projects/Habait`. Use a Python script with explicit per-file counts (write it to `logs/repoint.py`), never a blind `sed -i` over the tree.
3. Write `C:\RnD\Projects\Habait\REPOINTED.md`: the date, the three forms, one row per file with its replacement count, and the note that `habait-walkaround/.env` and every `_local/` were not touched.
4. In the copied `CLAUDE.md`, add one line under the title: "Copied from `C:\Habait` on 2026-11-03 (board `C:\RnD\development\tasks\copy-habait-2026-11-03`); paths re-pointed, see `REPOINTED.md`." Do not rewrite the Hebrew memory protocol — Q5 decides its future (task 08).

## Files
- edits: text files under `C:\RnD\Projects\Habait` that contain the old root; creates `REPOINTED.md`, `logs/repoint.py`
- never touches: `C:\Habait`, `.git/`, `_local/`, `.env`, binaries

## Acceptance
After the run the count-first grep returns 0 files; `REPOINTED.md` rows sum to the number of replacements the script reported; `git -C C:/RnD/Projects/Habait/habait-walkaround status --porcelain | wc -l` changed only by the tracked text files you edited (list them).

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The source `C:\Habait` is read-only to every task on this board.** Nothing is edited, moved or deleted there. Every write goes to `C:\RnD\Projects\Habait` or to this board folder.
6. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every heavy command under `timeout N`, one at a time, foreground; robocopy runs from PowerShell or `cmd //c`, never bare in Git Bash (it rewrites `/E`-style flags into paths).

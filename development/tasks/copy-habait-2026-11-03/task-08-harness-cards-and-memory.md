# Task 08 — the harness: cards, Context map, memory, debts
**Agent:** `codebase-cartographer` for the cards; the main session for memory and OWED · **Model:** sonnet · **Ruling tier:** T1 (Q5 from task 02) · **Burst:** 5 · **Depends on:** 06
**Memory file:** `memory/agents/codebase-cartographer.md`

## What to do
1. `C:\RnD\Projects\CLAUDE.md` (exists as a stub from board creation): refresh it — one row for `Habait/`, its purpose, the sessions-start-here rule per Q5, the marker on line 2.
2. Root `C:\RnD\CLAUDE.md` Context map: a row for `Projects/Habait/` pointing at the project's own `CLAUDE.md` (Hebrew, kept as-is) and a row for each nested card the project already has (`habait-walkaround/Habait/tour360/CLAUDE.md`, `habait-walkaround/360walkaround/pipeline/CLAUDE.md`, `.claude/agents/CLAUDE.md` of the project) — list them from `find C:/RnD/Projects/Habait -name CLAUDE.md -not -path "*/node_modules/*"`. Parity both directions.
3. Root `C:\RnD\CLAUDE.md` §1 "What's here": change the `Habait/MVP/` row — the product now lives at `Projects/Habait/habait-walkaround/`; the `habait-*` agents' paths are a known mismatch recorded in `OWED-009` (re-pointing 12 agent definitions is its own later board, never done silently here).
4. **Q5 = keep the project's own layer (default):** add to `Projects/CLAUDE.md` the rule "Habait sessions start from `C:\RnD\Projects\Habait`; its `.claude/agents` (7) and `memory.md` are the project's own; the root contract (§0–§12) still applies above them". **Q5 = merge:** file a separate board; do not merge in this task.
5. Main session: `memory/project/2026-11-03-habait-project-location.md` (where the project is, the snapshot time, the re-point, the two-`.env` note), one INDEX line, a HOT line; `OWED-008` (board untracked, no git) and `OWED-009` (agent paths) in `docs/governance/OWED.md`.

## Files
- edits: `C:\RnD\Projects\CLAUDE.md`, `C:\RnD\CLAUDE.md` (Context map + §1 row), `docs/governance/OWED.md`, `memory/INDEX.md`, `memory/HOT.md`; creates `memory/project/2026-11-03-habait-project-location.md`

## Acceptance
`find C:/RnD -name CLAUDE.md -not -path "*/node_modules/*" -not -path "*/.git/*"` and the Context map rows agree both ways; every card touched has the dated marker on line 2; OWED-008/009 present with owners; the memory entry and INDEX line exist.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The source `C:\Habait` is read-only to every task on this board.** Nothing is edited, moved or deleted there. Every write goes to `C:\RnD\Projects\Habait` or to this board folder.
6. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every heavy command under `timeout N`, one at a time, foreground; robocopy runs from PowerShell or `cmd //c`, never bare in Git Bash (it rewrites `/E`-style flags into paths).

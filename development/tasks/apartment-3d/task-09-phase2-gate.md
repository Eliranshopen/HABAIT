# Task 09 — Phase 2 gate (fresh reviewer, refute) and the disclosure call
**Agent:** `qa-reviewer` (status live, track harness-ops), FRESH context; never the author of 07–08 · **Model:** sonnet · **Ruling tier:** T1 (the disclosure wording goes to Eliran, card 02d) · **Burst:** 8 · **Depends on:** 08
**Memory file:** `memory/agents/qa-reviewer.md` (standing agent)

## Gate lines
- **`Check:`** every Check of card 06 again (exit 0 each), plus `timeout 300 python 360walkaround/pipeline/export_dollhouse.py --selftest` (exit 0) and the size/BIN asserts of cards 07 and 08.
- **`Reviewer scope:`**
  - the baked build does what 07–08 claim;
  - the geometry is unchanged from Phase 1 (same triangle count per node, same bounds);
  - the legal text is unchanged;
  - the live repo is untouched.
  Correctness only.

## What to do
1. Run the Check; logs go to `development/tasks/apartment-3d/logs/gate2-*.txt`.
2. A/B: Phase 1 and Phase 2 screenshots at the same 3 presets (desktop + iPhone 13), side by side in `after/compare.png`.
3. Refute the acceptance lines of 07 and 08. Probe the floor switch, the atlas fallback and the open time under CPU×4.
4. Write `logs/gate2-report.md`.
5. The main session then asks Eliran card 02d (the disclosure wording, with the A/B in front of him), plus his overall look.

## Acceptance
- A report with PASS on every line, or defects sent back to 07/08.
- Eliran's 02d answer recorded.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live repo `C:\RnD\Projects\Habait\habait-walkaround\` is read-only to every card until card 10.** Every write goes into `C:\RnD\.wt\apartment-3d\` (same relative paths as the repo) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the work tree is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or render runs as `timeout N <cmd>`, one heavy run at a time, foreground; kill what you start by PID. The work-tree server is `PORT=8851`. Never use :8850 (another session's port).
8. ⛔ **Blender only by its owner** (`Projects\Habait\SESSIONS.md` rule 4); no paid call on this board ($0 plan). Deploying is a separate explicit go from Eliran (root §9).

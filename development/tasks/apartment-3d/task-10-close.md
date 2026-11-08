# Task 10 — close: copy back on Eliran's "good"
**Agent:** main session · **Model:** — · **Ruling tier:** T1 (Eliran's "good" is the trigger; nothing is copied back without it) · **Burst:** 9 · **Depends on:** 09 PASS + Eliran's "good"
**Memory file:** `memory/runs/2026-11-03-apartment-3d-close.md` (or the close date)

## Eliran's "good"
- **2026-11-03 ~19:35, Eliran (AskUserQuestion, after `after/FINAL_before_after.png` and gate 4 PASS): "good – להעתיק".**

## Close record
- 27 files copied back (20 changed, 7 new) by `.wt/apartment-3d/close.py --go`, each live sha256 checked against `sha256_at_open` first and verified equal to the work tree after; `manifest.json` carries `sha256_at_close` per file and `closed`. Live drift after = exactly those 20 changed files.
- The dist was copied, not rebuilt live: the live platform has no `node_modules` (installs are Eliran's act); every build input is identical live (drift 0, the 37 released files unchanged), so the work-tree dist is what a live build gives.
- `Projects/Habait/memory.md` is frozen since 2026-11-03: its point edit is replaced by the repo memory (`memory/runs/2026-11-03-apartment-3d-close.md`).

## What to do
1. Quote Eliran's "good" (his words, date) in this card.
2. For each file `CHANGES.md` lists:
   - The live sha256 must equal `sha256_at_open`. If it doesn't, stop: show Eliran the file and both versions, and reconcile by hand.
   - Then copy the work-tree file over the live one and record `sha256_at_close`.
   - New files are copied to their mirror path.
3. Copy the rebuilt dist (`Habait/platform/_local/dist/rainbow/846/`) and the new dollhouse outputs back the same way. Copy `after/` to the research folder's `after/`.
4. Write `closed` into `manifest.json`. Update the board State to `CLOSED` here and in `development/tasks/CLAUDE.md`, and the plan row in `development/plans/CLAUDE.md`.
5. Memory:
   - `memory/runs/` entry plus its INDEX line;
   - `Projects\Habait\memory.md` point edit;
   - the rnd-23 row in `SESSIONS.md` → done;
   - HOT line updated.
6. Deploying to habait-platform is **not** part of this card. Offer it; it needs Eliran's own explicit go (root §9).
7. Removing `.wt\apartment-3d\` is Eliran's act: hand him the command, never run it.

## Acceptance
- Every copied-back file's live sha256 equals its work-tree sha256.
- No live file outside `CHANGES.md` changed.
- Memory rows written; board and plan rows say CLOSED.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live repo `C:\RnD\Projects\Habait\habait-walkaround\` is read-only to every card until card 10.** Every write goes into `C:\RnD\.wt\apartment-3d\` (same relative paths as the repo) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the work tree is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or render runs as `timeout N <cmd>`, one heavy run at a time, foreground; kill what you start by PID. The work-tree server is `PORT=8851`. Never use :8850 (another session's port).
8. ⛔ **Blender only by its owner** (`Projects\Habait\SESSIONS.md` rule 4); no paid call on this board ($0 plan). Deploying is a separate explicit go from Eliran (root §9).

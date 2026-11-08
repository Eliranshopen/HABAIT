# Task 06 — Phase 1 gate (fresh reviewer, refute)
**Agent:** `qa-reviewer` (status live, track harness-ops), FRESH context; never the author of 03–05 · **Model:** sonnet · **Ruling tier:** T0 · **Burst:** 5 · **Depends on:** 05
**Memory file:** `memory/agents/qa-reviewer.md` (standing agent)

## Gate lines
- **`Check:`** from `C:\RnD\.wt\apartment-3d\Habait\platform`, with `HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`. Expected: exit 0 on each.
  - `timeout 540 node tools/build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846`
  - `timeout 300 node test/smoke.mjs`
  - `timeout 300 node test/minimap.test.mjs`
  - `timeout 300 node test/apartment.test.mjs`
  - plus the card 03/04/05 acceptance scripts in `development/tasks/apartment-3d/logs/`
- **`Reviewer scope:`** does the build do what cards 03–05 claim? Also: the legal text is unchanged and the live repo is untouched. Correctness only, not taste.

## What to do
1. Run the Check under `timeout`, one at a time; save the output to `development/tasks/apartment-3d/logs/gate1-*.txt`.
2. Try to refute each acceptance line of cards 03, 04 and 05 with your own headless run (iPhone 13, Pixel 7, desktop 1440). Use the `cap3d.cjs` recipe against :8851 (start `PORT=8851 node serve.mjs` from the work tree; kill it by PID).
3. Verify the live repo: every manifest file's live sha256 equals `sha256_at_open`.
4. Verify that the ZIP's `3d/dollhouse.html` opens from `file://` with 0 network requests.
5. Write `development/tasks/apartment-3d/logs/gate1-report.md`: PASS/FAIL per line, defects with screenshots in `.wt\apartment-3d\after\phase1\`.

## Acceptance
- A report with every line PASS, or the defects listed. A FAIL sends the card back to its author (03/04/05).
- After PASS, the main session sends Eliran the preview link and waits for his look before card 07.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live repo `C:\RnD\Projects\Habait\habait-walkaround\` is read-only to every card until card 10.** Every write goes into `C:\RnD\.wt\apartment-3d\` (same relative paths as the repo) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the work tree is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or render runs as `timeout N <cmd>`, one heavy run at a time, foreground; kill what you start by PID. The work-tree server is `PORT=8851`. Never use :8850 (another session's port).
8. ⛔ **Blender only by its owner** (`Projects\Habait\SESSIONS.md` rule 4); no paid call on this board ($0 plan). Deploying is a separate explicit go from Eliran (root §9).

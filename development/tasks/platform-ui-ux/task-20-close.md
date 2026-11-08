# Task 20 — copy back: Eliran's "good", hash check, copy back, memory
Not the last card: the QA cards 21 (live repo) and 22 (deployed site) come after it (root §8.9). The board closes only when the last QA card passes.
**Agent:** main session · **Ruling tier:** T1 · **Burst:** 18 · **Depends on:** 18 PASS, 19 PASS or PASS-WITH-NOTES, and Eliran's "good"
⛔ Nothing is copied back before Eliran says "good" in his own words, after looking at the after set and the preview.

## What to do
1. Send Eliran the after set (`research\…\after\`), `logs/phase4-report.md`, `logs/ux-review.md`, `CHANGES.md` and the preview links (:8852, and :8853 if the Studio ran). Then wait.
2. On "good":
   - run `python scripts/wt.py status platform-ui-ux`. If any live file drifted since open, stop and reconcile by hand with its owner. Never overwrite.
   - run `python scripts/wt.py close platform-ui-ux` as a dry run, then `--go`. Only changed and new files go back. Verify the live sha256 of each one equals its copy.
3. **Deploy is not part of this board** (root §9). Write the deploy note for Eliran's separate go:
   - this board's changed files;
   - apartment-3d's, if they are not deployed yet;
   - that `stage_flow.py` now stages `_local/dist/<project>/<unit>/`;
   - that the preflight is `habait-deploy-qa`'s.
4. **Memory and records:**
   - one `memory/runs/2026-11-03-platform-ui-ux.md` entry (or the close date) via `python scripts/mem_entry.py … --go`;
   - the board row → `IN-PROGRESS (copied back; QA 21 next)` in `development/tasks/CLAUDE.md`. `CLOSED` waits for card 21's PASS, and HOT is regenerated then;
   - `docs/governance/OWED.md` rows for anything owed (the deploy go; the accessibility-statement text; a commercial Hebrew face if raised).
5. Retirement (Step 7): this board minted no agent. Say "none" in the run entry.
6. Removing `.wt\platform-ui-ux\` is Eliran's act (D11). Leave it.

## Acceptance
- `manifest.json` records the close: every changed file has `sha256_at_close` equal to the live file's.
- The run entry and its INDEX line exist; the board row reads `IN-PROGRESS (copied back; QA 21 next)`.
- The deploy note is with Eliran; no deploy was run.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live files under `C:\RnD\Projects\Habait\habait-walkaround\` and `C:\RnD\Projects\Habait\tools\deploy-vercel\` are read-only to every card until card 20.** Every write goes into `C:\RnD\.wt\platform-ui-ux\files\<path relative to C:\RnD>`, into `.wt\platform-ui-ux\tools\` (dev scaffolding that is never copied back) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the working folder is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or install runs as `timeout N <cmd>`, one heavy run at a time, in the foreground; kill what you start by PID. This board's ports: **:8852** (platform preview) and **:8853** (Studio, fixture or real). Never :8850, :8851 or :8820 (other sessions).
8. ⛔ **$0 board:** no paid call, no paid Studio stage, no Blender, Kling or fal. `npm ci` runs only on Eliran's go (card 01c). Deploying is a separate explicit go from Eliran (root §9).
9. ⛔ **Out of scope, never edited:** `/hold/` (flyover3d), `/tour/` (tour360), every clip and render, `js/apartment-3d.js`, `tools/build_zip.mjs`, the behaviour of `flow.js`, `viewer360.js` and `cine.js`, and the Studio server, pipeline and API. Legal and accessibility **wording** is Eliran's (§6). Every AI image keeps its "הדמיה · AI-generated" badge.
10. ⛔ **A path held by another open working folder is never copied in.** `wt.py` refuses it; never route around the refusal (no plain copy, no manifest edit, no second folder). Wait, or take Eliran's ruling (card 01b).

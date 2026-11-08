# Task 21 — QA on the live repo after the copy-back
**Agent:** `qa-reviewer` (status live, track harness-ops), FRESH context, never an author on this board · **Model:** sonnet · **Ruling tier:** T0 · **Burst:** 19 · **Depends on:** 20
**Memory file:** `memory/agents/qa-reviewer.md` (standing agent)
A final QA card (root §8.9). Cards 18–19 checked the working copy; this card checks the result where it now lives. From a session started at `C:\RnD`, it is a fresh Sonnet sub-agent briefed with `qa-reviewer.md`'s charter and boundary.

## Gate lines
- **`Check:`** from the **live** `C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\`, with `HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`. Expected: exit 0 on each, or the same red as the card 09 baseline, each failure explained.
  - `timeout 300 node test/smoke.mjs`, `landing.test.mjs`, `apartment.test.mjs`, `card-overflow.test.mjs`, `flow-real.test.mjs`, `tokens-sync.test.mjs`
  - `timeout 540 node test/browser.mjs`
  - `timeout 60 node tools/contrast.mjs`
  - Studio (live, only if card 08 ran): `timeout 300 node test/run.mjs`
- **`Reviewer scope:`** is the live repo exactly what the working folder approved, and does it run? Correctness only.

## What to do
1. **Hashes:** for every manifest file with a `sha256_at_close`, check that the live sha256 equals it. List any mismatch.
2. **Nothing else changed:** no out-of-scope file differs from its `sha256_at_open`: `js/apartment-3d.js`, `tools/build_zip.mjs`, `flow.js`, `viewer360.js`, `cine.js`, the Studio server and pipeline.
3. **The live preview:** `PORT=8852 timeout 540 node serve.mjs` from the live platform (killed by PID). One headless pass at 1440×900 and 390×844 over home, `landing.html?project=rainbow` and `apartment.html?project=rainbow&unit=846`. Require:
   - 0 console errors, 0 × 4xx;
   - fonts loaded, with 0 Google Fonts requests;
   - 0 dev labels in the buyer view;
   - the chosen theme as the default.
4. Run the Check, one command at a time; save to `logs/qa-live-*.txt`.
5. Write `logs/qa-live-report.md` with PASS/FAIL per line. A FAIL goes back to the authoring card, fixed in the same working folder (`wt.py add`) and copied back again through card 20. Never fix it here.

## Acceptance
- `logs/qa-live-report.md` with every line PASS, or the defects listed.
- On PASS, the main session closes the board's records:
  - the board row → `CLOSED (QA 21 PASS; deploy QA 22 waits for Eliran's deploy go)`;
  - the plan's state line → done;
  - `memory/HOT.md` regenerated.

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

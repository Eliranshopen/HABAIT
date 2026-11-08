# Task 09 — open phase B: the platform, after apartment-3d's copy-back
**Agent:** main session · **Ruling tier:** T0 · **Burst:** 8 (first of session 2) · **Depends on:** apartment-3d's manifest `closed` (or card 01 (b) = release)
⛔ **Precondition:** `python scripts/wt.py status apartment-3d` reports it closed, so its card 10 copy-back is live. Otherwise this card stays BLOCKED. Never route around the refusal (rail 10).

## What to do
1. Build the list: every file under `Projects/Habait/habait-walkaround/Habait/platform/`, except:
   - `node_modules/`, `fixtures/rainbow/orbit_real.mp4` and `_local/segments/`;
   - everything else in `_local/`, apart from `_local/dist/rainbow/846/` (read-only media, never edited);
   - the paths card 02 and card 05 already added.
   Write the list to `logs/c09-paths.txt`.
2. Run `python scripts/wt.py add platform-ui-ux $(cat …) ` as a dry run, then `--go`. The hashes are taken now, so they include apartment-3d's work.
3. **Baseline before any edit:** in the working-copy platform, run `timeout 300 node test/smoke.mjs`, `landing.test.mjs`, `apartment.test.mjs`, `card-overflow.test.mjs` and `timeout 540 node test/browser.mjs`, with `HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`.
   - If a test needs a local `node_modules` (`three`), stop and use card 01 (c)'s second go.
   - Record every result: a failing baseline test is not this board's failure, but it must be named.
4. Start `PORT=8852 timeout 540 node serve.mjs` from the working copy, check that `/`, `landing.html?project=rainbow` and `apartment.html?project=rainbow&unit=846` answer 200, and kill it by PID.

## Files
- creates: `logs/c09-paths.txt`, `logs/c09-baseline.txt`
- modifies: `manifest.json` (via `wt.py`), `CHANGES.md`

## Acceptance
- `wt.py status platform-ui-ux` lists the platform set with live-equal hashes and 0 refusals.
- The baseline results are recorded, with each red test named.
- The :8852 preview answers 200 on the three pages; no process is left on :8852.

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

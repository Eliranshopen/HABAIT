# Task 15 — chrome over the visualization: tokens only
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 13 (parallel with 14, disjoint files) · **Depends on:** 13
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
Paths are inside the working-copy `Habait\platform\`: `js/picker.js` (the unit card and legend), `css/flow-real.css`. Plan Phase 2 step 4 and default 4.

## What to do
1. Change **colour, font and radius only** in the picker's unit card and legend and in `flow-real.css`, through the tokens (`var(--…)`).
   - ⛔ No change to positions, sizes, timing, event handling or any non-style line of `picker.js`.
   - If the styles are inline strings in `picker.js`, change only the values inside them.
2. Before/after frames of the picker over the visualization at the same camera position and time, at 1440 and 390. Read the before frame from the card 09 copy before editing.
3. `/hold/` (flyover3d) itself is out of scope: only the picker's chrome drawn over it changes.

## Files
- modifies: `js/picker.js` (style values only), `css/flow-real.css`, `CHANGES.md`
- creates: `logs/c15-chrome.txt`, frames in `.wt\platform-ui-ux\after\c15\`

## Acceptance
- `CHANGES.md` shows that every changed `picker.js` line is a style value. List them in `logs/c15-chrome.txt`; any other changed line is a FAIL.
- Screenshot diff: the unit card's and legend's anchor positions are identical (±1 px); size differences come only from the font's text metrics, each listed.
- `timeout 300 node test/flow-real.test.mjs` and `flow-cine.test.mjs` are as green as the baseline or greener.

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

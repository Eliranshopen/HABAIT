# Task 10 — Phase 0 on the pages: dev gates, fonts, developer mark
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 9 · **Depends on:** 09
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
Paths are inside `.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\platform\`.

## What to do
1. **Dev labels.**
   - Read `index.html:35` for the existing `DEV` definition (laptop or `?dev=1`) and reuse it exactly. Do not write a second definition: if it is inline, move it to one shared helper that both pages import.
   - Gate the landing's "תצוגת פיתוח" badge (`js/landing.js:64`, shown on `meta.fixture` at `:147`) behind `DEV`.
   - Gate `flow.html:50` `#fixtureNote` ("placeholders (clay)") the same way.
2. **Fonts.** In the `<head>` of `index.html`, `landing.html`, `apartment.html` and `flow.html`:
   - `<link rel="stylesheet" href="css/tokens.css">` before every other stylesheet;
   - `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the Heebo Hebrew file only.
3. **Developer mark on the cards.** Use the logo's light variant from `project.json` if one exists. Otherwise put a light plate behind the logo. Measure the contrast of mark against its backing (pixel sample of the rendered mark vs plate), target ≥ 3:1. Measured, not eyeballed.

## Files
- modifies: `index.html`, `landing.html`, `apartment.html`, `flow.html`, `js/landing.js` (+ the shared `DEV` helper if extracted), `CHANGES.md`
- creates: `logs/c10-phase0.txt`, frames in `.wt\platform-ui-ux\after\c10\`

## Acceptance
- **Buyer view** (390×844 phone UA, no `?dev`): 0 elements whose text contains "תצוגת פיתוח" or "placeholders" on home, landing and flow. With `?dev=1` both appear.
- On every page, `document.fonts.check('16px Heebo')` is true, with 0 requests to Google Fonts.
- The developer mark's contrast is ≥ 3:1, measured and logged with the sample coordinates.
- `landing.test.mjs` and `card-overflow.test.mjs` are as green as the card 09 baseline or greener.

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

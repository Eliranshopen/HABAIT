# Task 14 — the project landing
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 (the legal display is Eliran's check at card 17) · **Burst:** 13 (parallel with 15, disjoint files) · **Depends on:** 13, and card 03 for the real stills
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
Paths are inside the working-copy `Habait\platform\`: `landing.html`, `js/landing.js`, `css/landing.css`. Plan Phase 2 step 2.

## What to do
1. **Media first:** the flight's poster with a play affordance that opens the **existing** flight (link or call only; no change to `flow.js`, `cine.js` or `/hold/`).
2. **Three highlights** from `project.json`.
3. **Availability:** a list or grid of apartments, with a status chip (colour + text) + rooms + area + floor, numbers in `<bdi>`. Each row links to its apartment page. This is the non-visual alternative to the picker.
4. **The lead block** (existing `js/lead.js`; behaviour unchanged).
5. **Legal:** the one-line summary plus "לנוסח המלא", which expands the full text in place (`<details>` or `aria-expanded`). ⛔ **The wording is unchanged, byte for byte** (§6). The summary line is a display of the existing first sentence, not new text; if no sentence works as a summary, use the existing title and say so in `CHANGES.md` for Eliran.
6. **Gallery:** the real `_local/dist/<project>/<unit>/` stills (staged by card 03 on the next deploy; read locally from the read-only copy). ⛔ Clay is never shown to buyers. If there are no real stills, hide the gallery and never fall back to clay (replace the fixture fallback at `landing.js:107-118`). Every AI-made still carries the "הדמיה · AI-generated" badge.

## Files
- modifies: `landing.html`, `js/landing.js`, `css/landing.css`, `CHANGES.md`
- creates: `logs/c14-landing.txt`, frames in `.wt\platform-ui-ux\after\c14\` (1440×900, 390×844, full page)

## Acceptance
- The legal text's `textContent` (expanded) equals the before page's legal `textContent`, compared as a string and logged.
- A buyer view with real stills shows 0 images whose URL contains `clay` or `fixtures/`; a buyer view without them shows no gallery.
- Every AI still has the badge (count of stills = count of badges).
- Every availability row has text status + a link that answers 200 on :8852.
- `landing.test.mjs` and `card-overflow.test.mjs` are as green as the baseline or greener; 0 console errors.

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

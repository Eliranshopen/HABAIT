# Task 16 — the apartment page frame
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 14 · **Depends on:** 13 (and 09, so apartment-3d's copy-back is already in the hashes)
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
Paths are inside the working-copy `Habait\platform\`: `apartment.html`, `css/apartment.css`, the page-level parts of `js/apartment.js`. Plan Phase 2 step 3.

## What to do
1. **Title row:** unit number, rooms, area and floor, each in `<bdi>`.
2. **Tabs** restyled on the tokens. ⛔ The 3D tab's content and `js/apartment-3d.js` are untouched (board apartment-3d's work). The `new URL` fix that apartment-3d shipped stays as it landed.
3. **Spec grid** (component from card 05).
4. **Phone (≤ 600 px): a sticky CTA bar** (WhatsApp, call, ZIP), using the existing link targets. It must never cover the media: reserve its height as bottom padding on the page.
5. **"חזרה לבניין"**: back to the project landing.

## Files
- modifies: `apartment.html`, `css/apartment.css`, `js/apartment.js` (page level only), `CHANGES.md`
- creates: `logs/c16-apartment.txt`, frames in `.wt\platform-ui-ux\after\c16\` (every tab, 1440×900 + 390×844)

## Acceptance
- `js/apartment-3d.js`'s sha256 in the working copy still equals `sha256_at_open`.
- At 390×844, with every tab and with the media scrolled fully into view, the CTA bar's rect does not intersect the media element's rect (measured, logged).
- `timeout 300 node test/apartment.test.mjs` is as green as the baseline or greener; 0 console errors, including no `Failed to construct 'URL'`.

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

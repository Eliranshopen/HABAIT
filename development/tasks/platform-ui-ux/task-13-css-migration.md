# Task 13 — the existing CSS onto the tokens
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 12 · **Depends on:** 12 (theme picked)
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
Plan Phase 1, last bullet. Each file keeps only its layout; colour, radius, font and shadow come from the tokens.

## What to do
1. Migrate these files (working copy): `Habait/platform/css/style.css`, `landing.css`, `apartment.css`, `dashboard.css`, and `Habait/studio/dashboard/style.css`.
   - Replace every colour, radius, font-family, font-size and shadow literal with a token.
   - Where no token fits, add one to `tokens.css` and re-sync the Studio copy (`tools/sync-tokens.mjs`).
2. ⛔ Not these: `cine.css`, `transition.css` (visualization behaviour, out of scope) and `flow-real.css` (card 15).
3. Physical properties in the lines you touch become logical ones (`margin-inline-start`, `inset-inline-end`, `text-align: start`).
4. The apartment page's 3D tab content is untouched. `apartment.css` rules scoped to the 3D tab keep their values unless they are pure colour or type; list each one you changed.
5. Capture before/after frames of every page at the same sizes (before = the card 09 copy, still identical in `files/` until this card; capture it first).

## Files
- modifies: the five CSS files above, `css/tokens.css` (only if a token is added), `studio/dashboard/tokens.css` (re-synced), `CHANGES.md`
- creates: `logs/c13-literals.txt`, `logs/c13-layout.txt`, frames in `.wt\platform-ui-ux\after\c13\`

## Acceptance
- `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|font-family|border-radius:\s*[0-9]' <the five files>` → 0 hits (`logs/c13-literals.txt`).
- Layout unchanged: for each page at 1440 and 390, the bounding boxes of the page's main landmarks (header, main sections, cards, tab bar) are within ±2 px, before vs after, or differ only by the font's text metrics (each difference listed in `logs/c13-layout.txt`).
- `landing.test.mjs`, `apartment.test.mjs`, `card-overflow.test.mjs` and `tokens-sync.test.mjs` are as green as the baseline or greener.

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

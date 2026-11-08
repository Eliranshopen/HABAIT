# Task 11 — the home page on the tokens, both themes
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 10 · **Depends on:** 05, 10
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
Paths are inside the working-copy `Habait\platform\`. Plan Phase 2 step 1. This is the page Eliran sees at Gate 1.

## What to do (`index.html` + a new `css/home.css`; `style.css` is migrated in card 13, not here)
1. **Header:** the Habait wordmark plus the language toggle (existing `js/i18n.js`).
2. **Hero:** one line saying what Habait is, over the project's own cover still. The copy is a draft in the house tone; it is listed in `CHANGES.md` for Eliran.
3. **Project gallery:** large media cards with a reserved aspect ratio, each with the developer mark (card 10), city, a status summary computed from the data (e.g. "12 דירות · 4 פנויות", numbers in `<bdi>`, never hard-coded) and one CTA "לסיור בפרויקט".
4. **Footer** with an accessibility-statement link **slot**: the link target and the text are Eliran's (§6). Leave a visible TODO marker in dev view only.
5. **Empty state** (no projects): the research's three parts.
6. **Theme preview:** `?theme=dark|light` sets `data-theme` on `<html>`. This is for the gate only, read from the URL and never stored; the default is light until Gate 1.

## Files
- modifies: `index.html`, `CHANGES.md`
- creates: `css/home.css` (`wt.py add` → new), `logs/c11-home.txt`, frames in `.wt\platform-ui-ux\after\c11\` (light + dark × 1440×900 + 390×844, + empty state)

## Acceptance
- 8 frames + the empty state; 0 console errors; 0 horizontal scroll at 390.
- The status summary matches the counts in `projects.json` / the project data (computed values listed in the log).
- `grep` for colour, radius or font-family literals in `css/home.css` → 0 (tokens only).
- The keyboard path (Tab order: toggle → cards → CTA → footer) is recorded with visible focus rings.

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

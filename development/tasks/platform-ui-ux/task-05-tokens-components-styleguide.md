# Task 05 — one design system: tokens, fonts, components, style guide
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 4 · **Depends on:** 02
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
All paths are inside `.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\platform\`. Every file here is **new**, so no other folder holds it. Read the research first: `C:\RnD\Projects\Habait\research\platform-ui-ux-2026-11-03\README.md` §4 and `raw-B-patterns.md` (the 15 principles, the 30-item checklist).

## What to do
1. **Fonts (`fonts/`)**, self-hosted, OFL, no runtime call to Google Fonts.
   - Heebo variable (wght 300–800), Hebrew + Latin subsets, woff2.
   - Frank Ruhl Libre 500 and 700, Hebrew + Latin, woff2.
   - **Source:** first check whether `Habait/tour360/viewer/fonts/heebo-*.woff2` (read-only) is the variable face with the full wght range. Otherwise download the `@fontsource-variable/heebo` and `@fontsource/frank-ruhl-libre` woff2 files from `cdn.jsdelivr.net` with `curl` (public OFL files, $0; no npm install).
   - Write `fonts/OFL.txt` (one per family if they differ) and `fonts/SOURCES.md` (each file's URL, version and sha256).
   - Add each font file to the manifest with `python scripts/wt.py add platform-ui-ux <path> --go` (new → null).
   - Budget: the fonts the first paint needs ≤ 120 KB. Log the actual sizes.
2. **`css/tokens.css`** (plan Phase 1):
   - `@font-face` for both families with `font-display: swap`.
   - Colour: one neutral ramp (LCH-derived; write the LCH source values in a comment), brand primary, one accent, status (available, reserved, sold), each status paired with a text label in the components.
   - Two themes on `[data-theme="light"]` (the default) and `[data-theme="dark"]`. White-label: only `--brand-*` may be overridden by `project.json`.
   - Type scale of six steps: display in Frank Ruhl Libre, text in Heebo, Hebrew body line-height ≈ 1.6, no letter-spacing on Hebrew.
   - A 4 px spacing grid, three radii, two shadows, motion tokens (150/250/400 ms, one ease). `@media (prefers-reduced-motion: reduce)` sets every duration to 0.
3. **`css/components.css`**, plain CSS classes and no framework, logical properties only: button (primary, secondary, ghost, WhatsApp), card, media card with a reserved `aspect-ratio`, status chip (colour + text), file row, step timeline (waiting / running / needs you / done / failed), result card (empty / in progress / ready), sticky CTA bar, spec grid (numbers in `<bdi>`), the disclosure badge "הדמיה · AI-generated", and the legal summary with expand ("לנוסח המלא").
4. **`styleguide.html`**: every token and component in **both themes side by side** (two columns, each with its own `data-theme`), `dir="rtl" lang="he"`. It must work at 1440 and at 390, where the columns stack.
5. **`tools/contrast.mjs`** (new, dev tool in the platform): reads `tokens.css` and prints every text-on-surface and UI-on-surface pair with its contrast ratio, in both themes. It also checks the brand-on-surface pairs using the brand colour from `fixtures/rainbow/project.json` (read-only live copy if the fixture is held).
6. Preview: `timeout 540 python -m http.server 8852 --bind 127.0.0.1` from the working-copy `platform\` folder (`serve.mjs` is held by apartment-3d). Kill it by PID after each check.

## Files
- creates: `css/tokens.css`, `css/components.css`, `styleguide.html`, `fonts/*.woff2`, `fonts/OFL.txt`, `fonts/SOURCES.md`, `tools/contrast.mjs`; `development/tasks/platform-ui-ux/logs/c05-contrast.txt`, `logs/c05-styleguide.txt`; frames in `.wt\platform-ui-ux\after\c05\`
- modifies: `.wt\platform-ui-ux\manifest.json` (via `wt.py add`), `CHANGES.md`

## Acceptance
- Headless frames of `styleguide.html` at 1440×900 and 390×844 (`after/c05/`); 0 console errors; 0 horizontal scroll at 390.
- `document.fonts.check('16px Heebo')` and `('32px "Frank Ruhl Libre"')` are true. The network shows the woff2 files served 200 from the same origin, and 0 requests to `fonts.googleapis.com` / `fonts.gstatic.com` (`logs/c05-styleguide.txt`).
- `node tools/contrast.mjs` exits 0: every text pair ≥ 4.5:1 and every UI pair ≥ 3:1 in both themes. Any failing brand pair is named with a fallback rule (`logs/c05-contrast.txt`).
- `grep -nE '(^|[^-])\b(left|right)\s*:|margin-(left|right)|padding-(left|right)|text-align:\s*(left|right)' css/tokens.css css/components.css` returns nothing.
- With `prefers-reduced-motion: reduce` emulated, the computed `transition-duration` of a button is `0s`.

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

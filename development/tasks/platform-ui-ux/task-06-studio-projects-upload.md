# Task 06 — Studio A: fixture API, my projects, new project, upload
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 5 · **Depends on:** 04, 05
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
Product paths are inside `.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\`. The plan's Phase 3 steps 1–3 run **before** Gate 1 by navigator call (1) in the README; they use the tokens, not a theme pick.

## What to do
1. **Fixture API** at `.wt\platform-ui-ux\tools\studio-fixture-api.cjs` (scaffolding, never copied back), extending `C:\RnD\Projects\Habait\research\platform-ui-ux-2026-11-03\current\cap_studio.cjs`:
   - Read the live `Habait/studio/server.mjs` **read-only** to learn the exact routes.
   - Serve the working copy's `studio/dashboard/` statics.
   - Answer the GETs from the live `Habait/studio/_local/projects/apt846-rainbow-tlv` (read-only).
   - Refuse every POST/PUT/DELETE with `405 {"error":"fixture: read-only"}`.
   - Port **:8853**, under `timeout 540`, killed by PID.
2. **Tokens in the Studio.** The Studio server serves only `dashboard/`, and changing the server is out of scope. So:
   - `studio/dashboard/tokens.css` and `components.css` are **generated copies** of the platform files, each with a header line `/* generated from Habait/platform/css/<file> by platform/tools/sync-tokens.mjs — do not edit */`.
   - Write `platform/tools/sync-tokens.mjs` (new) and `platform/test/tokens-sync.test.mjs` (new), which asserts that the copies equal their source after the header.
   - This keeps one source for the tokens. T0, logged.
3. **Screens** (`index.html`, `app.js`, `style.css`), the plan Phase 3 steps 1–3, `dir="rtl"`:
   - **הפרויקטים שלי:** project cards (cover, state, last run's cost through `fmtCost`), and a three-part empty state (what this is, why it is empty, "פרויקט חדש").
   - **New project:** a two-field wizard (name, address), then straight to upload.
   - **Upload:**
     - One large drop zone with a click fallback, keyboard reachable (Enter/Space opens the picker), accepted types stated up front.
     - One row per file: name, size, progress, remove.
     - A role chip (תכנית מכר / הדמיה / חזית / אחר), suggested client-side from the extension, name and PDF page count, and editable. It is stored in the existing `notes` field; a tooltip says it is UI only until the API carries a role.
   - **Fixture mode** shows one honest banner ("מצב תצוגה — שמירה כבויה") only when the API answers 405. A refused upload shows on its row; it never fakes success.
4. Add every new product file to the manifest with `wt.py add … --go`.

## Files
- creates: `.wt\…\tools\studio-fixture-api.cjs`, `studio/dashboard/tokens.css`, `studio/dashboard/components.css`, `platform/tools/sync-tokens.mjs`, `platform/test/tokens-sync.test.mjs`; frames in `.wt\platform-ui-ux\after\studio\`; `logs/c06-studio.txt`
- modifies: `studio/dashboard/index.html`, `app.js`, `style.css`, `manifest.json` (via `wt.py`), `CHANGES.md`

## Acceptance
- Frames of the three screens + the empty state at 1440×900 and 390×844 (`after/studio/`); 0 console errors; 0 horizontal scroll at 390.
- The keyboard path is recorded in `logs/c06-studio.txt`: Tab reaches the drop zone, and Enter opens the file chooser (headless `filechooser` event).
- No raw float duration or cost appears in any frame's text (a regex over `innerText` for `\d+\.\d{3,}`: 0 hits).
- `timeout 60 node platform/test/tokens-sync.test.mjs` passes.
- A POST against the fixture returns 405, and the UI shows the banner, not a success.

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

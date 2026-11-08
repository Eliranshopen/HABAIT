# Task 02 — open phase A: the files no other folder holds
**Agent:** main session · **Ruling tier:** T0 · **Burst:** 2 · **Depends on:** 01 (a)
Run from `C:\RnD` in Git Bash. The folder `.wt\platform-ui-ux\` already exists (empty manifest), so this card uses `add`, never `open`.

## What to do
1. Dry run, read the output, then `--go`:
   ```
   python scripts/wt.py add platform-ui-ux \
     Projects/Habait/habait-walkaround/Habait/studio/dashboard/index.html \
     Projects/Habait/habait-walkaround/Habait/studio/dashboard/app.js \
     Projects/Habait/habait-walkaround/Habait/studio/dashboard/style.css \
     Projects/Habait/habait-walkaround/Habait/studio/styles/presets.json \
     Projects/Habait/tools/deploy-vercel/stage_flow.py \
     Projects/Habait/habait-walkaround/Habait/platform/css/tokens.css \
     Projects/Habait/habait-walkaround/Habait/platform/css/components.css \
     Projects/Habait/habait-walkaround/Habait/platform/styleguide.html
   ```
   The last three are new (`sha256_at_open: null`). The dry run of 2026-11-03 16:21 showed the first five as `copy` with no refusal.
2. If `wt.py` refuses any path (held elsewhere), stop and record which. Never route around it (rail 10).
3. Create `.wt\platform-ui-ux\tools\` for dev scaffolding (the Studio fixture API, capture scripts). It lies outside `files\`, so it is never copied back.
4. Write `.wt\platform-ui-ux\CHANGES.md`: one section per manifest file, `## changed:` / `## new:` / `## unchanged:`, with a readable before/after summary. Every later card regenerates it.

## Files
- creates: `.wt\platform-ui-ux\files\…` (the copies), `.wt\platform-ui-ux\tools\`, `.wt\platform-ui-ux\CHANGES.md`
- modifies: `.wt\platform-ui-ux\manifest.json` (via `wt.py` only)

## Acceptance
- `python scripts/wt.py status platform-ui-ux` lists 8 entries: 5 with a sha256 that equals the live file's, and 3 marked new.
- No live file changed: the live sha256 of all 5 copied files still equals `sha256_at_open`.
- `CHANGES.md` exists and lists 0 changed.

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

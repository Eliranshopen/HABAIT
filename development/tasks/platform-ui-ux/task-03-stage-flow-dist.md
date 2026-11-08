# Task 03 — `stage_flow.py` stages the real apartment media
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 3 (parallel with 04, disjoint files) · **Depends on:** 02
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
The file is `.wt\platform-ui-ux\files\Projects\Habait\tools\deploy-vercel\stage_flow.py`. It sits outside `habait-walkaround`, a level above it.

## Why
The landing gallery shows clay because `stage_flow.py:11` excludes `_local`. `_local/dist/rainbow/846/apartment.json` 404s on habait-flow.vercel.app, so `landing.js` falls back to the fixture stills (`:107-118`). Plan Phase 0 step 5.

## What to do
1. Read the whole script first (the source and output arguments, the exclusion at `:11`).
2. Add one explicit staging step for `Habait/platform/_local/dist/<project>/<unit>/`, for each project and unit the site already stages. Copy the unit's manifest (`apartment.json`), stills, plan and media. Never copy `_local` as a whole, never `_local/segments`, never `_local/projects`.
3. The unit ZIP: include it only if the apartment page links it from that folder (read `js/apartment.js` read-only for the link). Log the decision and the file size in the card.
4. No other behaviour change. The script stays deterministic: the same inputs produce the same file list, in sorted order.

## Check (the builder's own; card 18 re-runs it fresh)
- Stage **from the live platform (read-only) into a scratch folder** with the working-copy script, never into a deploy folder:
  `timeout 300 python <wt>/…/stage_flow.py <args to a scratch out dir>`
- Serve the scratch output on :8852 (`timeout 540 python -m http.server 8852 --bind 127.0.0.1`, killed by PID). Run one headless pass over `landing.html?project=rainbow` and `apartment.html?project=rainbow&unit=846` at 1440, recording every network response.
- Expected: 0 responses ≥ 400 for the `_local/dist/` requests. The apartment page's `new URL` throw belongs to apartment-3d, not this card; record it if seen, but do not fix it.

## Files
- modifies: `.wt\platform-ui-ux\files\Projects\Habait\tools\deploy-vercel\stage_flow.py`, `.wt\platform-ui-ux\CHANGES.md`
- creates: `development/tasks/platform-ui-ux/logs/c03-stage.txt` (file list + 4xx count; create `logs/CLAUDE.md` with it, root §8.6)

## Acceptance
- The staged file list contains `Habait/platform/_local/dist/rainbow/846/apartment.json` plus its stills and media, and nothing else from `_local`.
- 0 × 4xx on `_local/dist/` in the headless pass (`logs/c03-stage.txt`).
- Two runs of the script give byte-identical file lists.
- Takes effect only on the next deploy, with its own go from Eliran (root §9). Say so in `CHANGES.md`.

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

# Task 04 — Studio: formatted durations and costs
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 3 (parallel with 03, disjoint files) · **Depends on:** 02
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
All paths are inside `.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\studio\dashboard\`.

## Why
The Studio prints raw float durations and raw costs (research `current/desk_11_studio_project.png`). Plan Phase 0 step 4.

## What to do
1. In `app.js`, find every place that renders a duration or a cost (grep `toFixed`, `duration`, `dur`, `cost`, `usd`, `$`).
2. Add two pure helpers:
   - `fmtDuration(seconds)` returns `m:ss` (`h:mm:ss` from one hour up; `—` for null or NaN);
   - `fmtCost(usd)` returns `$0.00`.
   Route every render site through them.
3. Every number shown inside Hebrew text is wrapped in `<bdi>` (costs and durations as `<bdi dir="ltr">`).
4. No change to the API calls, state handling or layout.

## Files
- modifies: `app.js` (and `index.html` only if a static number lives there), `.wt\platform-ui-ux\CHANGES.md`
- creates: `development/tasks/platform-ui-ux/logs/c04-format.txt`

## Acceptance
- A bounded node assertion run on the two helpers (`timeout 60 node -e …`, output in `logs/c04-format.txt`): `fmtDuration(5.041666)` → `0:05`, `fmtDuration(65)` → `1:05`, `fmtDuration(3725)` → `1:02:05`, `fmtDuration(null)` → `—`, `fmtCost(0.1)` → `$0.10`, `fmtCost(12.345)` → `$12.35` (rounding stated).
- A grep of `app.js` shows no duration or cost rendered without a helper. List each site and its line in the log.
- The visual check on real data comes with card 06's fixture API (the Studio does not start without `zod`).

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

# Task 07 — Studio B: review, create, results, advanced
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 6 · **Depends on:** 06
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
Paths are inside `.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\studio\dashboard\`, against card 06's fixture API on :8853. This is UI on the **existing** API only (plan Phase 3 steps 4–7).

## What to do
1. **"מה המערכת הבינה":** the existing `intake` as a review card (rooms, areas, floors, units).
   - The intake's own `confidence` (0.82 on apt846) is shown **once**, at the top.
   - Each entry of its `uncertainties` list is flagged on the field it names, with colour + text. **Nothing else is flagged.**
   - "אישור" calls the existing `approve-plan` (refused in fixture mode; the banner shows).
2. **Create:**
   - The estimate from the existing `create-hint` sits on the button (through `fmtCost`).
   - A step timeline mapped from the existing stage list and `state.json`: waiting / running / needs you / done / failed, with elapsed time through `fmtDuration`. **Never a percentage.**
   - Leaving and returning restores the state from disk, which already holds; verify it.
3. **Results:** three deliverable cards, in the order of Eliran's vision.
   - (a) The exterior video, (b) the building with clickable apartments, (c) the apartment visualization.
   - Each card is empty, in progress or ready.
   - The per-room clips sit inside (c) as a collapsed list with formatted durations.
   - Where this Studio pipeline does not produce a deliverable, its card says "עוד לא בשרשרת הזו". Never hide it, and never fake it.
4. **הגדרות מתקדמות:** styles (from `studio/styles/presets.json`), variants, lat/lon, panos. One level deep, collapsed by default.

## Files
- modifies: `index.html`, `app.js`, `style.css`, `CHANGES.md`
- creates: frames in `.wt\platform-ui-ux\after\studio\`, `logs/c07-studio.txt`

## Acceptance
- On apt846: "0.82" appears exactly once. The number of flagged fields equals `uncertainties.length`, and each flag sits on the field its entry names. List them in `logs/c07-studio.txt`.
- The timeline's `innerText` contains no `%`.
- The three result cards appear in the order a, b, c, each in one of its three states. Every card the pipeline cannot fill says "עוד לא בשרשרת הזו".
- Frames of each step at 1440×900 and 390×844; 0 console errors; keyboard path through review → create recorded.

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

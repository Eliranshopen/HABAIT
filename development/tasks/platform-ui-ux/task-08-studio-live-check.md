# Task 08 — Studio live check on the real server
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T1 (the install go) · **Burst:** 7 (alone; heavy run) · **Depends on:** 07 and Eliran's go in card 01 (c)
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
⛔ **No go recorded in card 01 (c) means this card does not start.** Session 1 then ends at card 07, and this card is listed as owed in the run entry.

## What to do
1. Add the Studio's runnable set to the manifest (it is not held elsewhere). Dry run first, then `--go`: `python scripts/wt.py add platform-ui-ux <each file under Habait/studio/ except node_modules/ and _local/>`. Unchanged files stay unchanged; close copies back only what changed.
2. `timeout 540 npm ci` in the working copy's `Habait/studio`. Log the package count and the time.
3. Start the real server from the working copy on **:8853**, with `timeout 540` and the PID recorded.
   - If the port cannot be set without editing the server (out of scope), stop and report.
   - If the server wants credentials to start, stop and report. ⛔ **Never open, print or copy any `.env*` file** (root §8.1).
4. In a headless browser:
   - create a throwaway project "ui-check" in the **working copy's** `_local`;
   - upload one small image (`research\platform-ui-ux-2026-11-03\current\desk_01_home.png`);
   - check that the row shows name, size, progress → done, and its role chip;
   - go back to הפרויקטים שלי and see the project card.
5. ⛔ **Never press "אישור" or create, and never call any stage endpoint. No paid stage runs** (rail 8). Kill the server by PID.
6. `timeout 300 node test/run.mjs` in the working copy's Studio.

## Files
- creates: `logs/c08-live.txt` (install, server, upload, test output), frames in `.wt\platform-ui-ux\after\studio-live\`
- modifies: `manifest.json` (via `wt.py`), `CHANGES.md`

## Acceptance
- The upload round-trip works on the real API: the row reaches done, and the file exists in the working copy's `_local/projects/ui-check*/`.
- The Studio's stage log and ledger for `ui-check` show 0 stages started and $0.
- `node test/run.mjs` is green, or every failure is explained.
- The server and browser are killed by PID; no process is left on :8853.

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

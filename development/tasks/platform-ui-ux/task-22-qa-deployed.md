# Task 22 — QA on the deployed site
**Agent:** `habait-deploy-qa` (status live, track habait) · **Model:** sonnet · **Ruling tier:** T1 (runs only after Eliran's own deploy go) · **Burst:** 20 · **Depends on:** 21 PASS, and a deploy that Eliran authorised separately (root §9)
**Memory file:** `memory/agents/habait-deploy-qa.md` (standing agent)
The last QA card (root §8.9). ⛔ **This card never deploys and never asks for a deploy.** It starts only after Eliran has given his own go and the deploy has run. Until then it stays `BLOCKED (deploy go)`. The board may already be `CLOSED` by then; this card then appends its own run entry.

## Gate lines
- **`Check:`** the browser paint proof (headless Chrome + the real network requests, not a curl 200) on `https://habait-flow.vercel.app/` and on each host alias the deploy note names (root §11). For `/`, `landing.html?project=rainbow` and `apartment.html?project=rainbow&unit=846`, at 1440×900 and 390×844, require:
  - 0 console errors;
  - 0 responses ≥ 400, including every `_local/dist/` request (card 03's staging);
  - `document.fonts.check('16px Heebo')` true, with 0 Google Fonts requests;
  - 0 elements with "תצוגת פיתוח" or "placeholders" in the buyer view;
  - no clay image in the landing gallery;
  - every AI still carries "הדמיה · AI-generated".
- **`Reviewer scope:`** does the deployed site paint what card 21 passed locally? Deployed behaviour only, not taste.

## What to do
1. Read the deploy note from card 20 (which files, and which board's work, went out).
2. Run the Check; save frames and the network log to `logs/qa-deployed/`, with its context file (root §8.6).
3. Write `logs/qa-deployed-report.md` with PASS/FAIL per line, per alias. A FAIL is reported to Eliran with the frame. A rollback is his call, never this card's.

## Acceptance
- `logs/qa-deployed-report.md` with every line PASS, or the defects listed per alias.
- A `memory/runs/` entry for the deployed QA, and the board row's State updated to `SHIPPED (QA 22 PASS)` or to the defect.

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

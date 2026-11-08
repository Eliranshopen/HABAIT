# Task 19 — Phase 4 frames review, refute-first
**Agent:** `habait-ux-judge` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 17 · **Depends on:** 18
**Memory file:** `memory/agents/habait-ux-judge.md` (standing agent)
Plan Phase 4.4 names `qa-reviewer`. This card goes to `habait-ux-judge` by navigator call (2) in the README, because judging captured frames against a design of record is that agent's charter. `qa-reviewer` keeps the runnable Check (card 18). The judge never captures its own evidence: the frames are card 18's and card 17's.

## Gate lines
- **`Check:`** every page of the plan's scope has a before frame (`research\…\current\`) and an after frame (`research\…\after\`) at the same name and size. The review table has one row per page × width, and none is blank.
- **`Reviewer scope:`** the built shell against the plan (Phase 2 and Phase 3 page lists, the five defaults) and the research's 15 principles. Does one thing to do read as obvious on each page? Does the chrome compete with the media? Is the Studio's progress honest? Is the hierarchy legible in Hebrew RTL? Experience only; correctness is card 18's.

## What to do
1. Read the plan, the research `README.md` §4 and `raw-B-patterns.md` (the principles), then the before and after frames, pair by pair.
2. Refute first: for each page, try to show that the after is not better than the before, or that it breaks a principle or a plan line.
3. Write `development/tasks/platform-ui-ux/logs/ux-review.md`. Give one finding per row (severity, page, width, what the plan says, what the frame shows, the rule it breaks), then your own verdict line.
4. A design divergence that needs a product decision is escalated to Eliran, never re-invented. A defect goes back to `platform-dev` as a named card follow-up in the same working folder (never a sibling folder).

## Result (2026-11-03 ~23:20)
- `habait-ux-judge`: **FAIL**: 4 × S1 (F1, F2, F3, F5), 10 × S2, 9 × S3 (`logs/ux-review.md`).
- **Fixed in the same working folder** (`tools/ux_fix.py`):
  - F1: clay deliverables show "טיוטה" with the photoreal count.
  - F2: a hero CTA on the home page.
  - F3: arm B has one voice above the fold.
  - F4: the spec grid no longer repeats the summary.
  - F5: the review marker shows only when the files were read.
  - F6: the chevron uses the bidi-mirrored ›.
  - F7: notes are isolated LTR under a Hebrew lead.
  - F7b: video poster frames (#t=0.5).
  - F9: the duplicate eyebrow is gone.
  - F11: the tab strip shows that it scrolls.
  - F13–F15: the after set is re-captured by card 18's reviewer.
- **Not fixed tonight:**
  - F8 (same still in hero and card: one cover only) and F10 (per-card action in the Studio list): S2, logged.
  - F21/F22: out of scope (apartment-3d.js, flow.js).
- **Judge's questions, decided under Eliran's blanket approval (recommended defaults):**
  - Q1 = (a) "טיוטה" state.
  - Q2 = (a) the flight speaks on arm B.
  - Q3 = (b) isolate English notes now; Hebrew notes from the model go into plan `2026-11-03-studio-agent-fal.md`.
  - Q6 = (a) no highlights; the plan line is annotated.
- **Left for Eliran (product/legal):**
  - Q4: "יזם (השם מוסתר עד אישור)" shown to buyers, and the RAINBOW mark.
  - Q5: the disclosure shown three times on landing B / the hold.
  - Q7: the accessibility-statement text and link.

## Acceptance
- `logs/ux-review.md` exists with the full table and a verdict: PASS / PASS-WITH-NOTES / FAIL.
- A FAIL lists the cards to re-open; the main session re-runs them in `.wt\platform-ui-ux\` before card 20.

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

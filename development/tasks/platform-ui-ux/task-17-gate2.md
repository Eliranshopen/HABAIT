# Task 17 — Gate 2: refute the buyer pages; Eliran checks the legal display
**Agent:** `qa-reviewer` (status live, track harness-ops), FRESH context, never the author of 13–16 → then Eliran · **Model:** sonnet · **Ruling tier:** T1 · **Burst:** 15 · **Depends on:** 14, 15, 16
**Memory file:** `memory/agents/qa-reviewer.md` (standing agent)
Fresh Sonnet sub-agent briefed with `qa-reviewer.md`'s charter and boundary (see card 12).

## Gate lines
- **`Check:`** from the working-copy `Habait\platform\`, with `HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`. Expected: exit 0 on each, or the same red as the card 09 baseline.
  - `timeout 300 node test/landing.test.mjs`, `apartment.test.mjs`, `card-overflow.test.mjs`, `flow-real.test.mjs`, `tokens-sync.test.mjs`
  - `timeout 540 node test/browser.mjs`
  - the acceptance probes of cards 13–16 re-run on your own headless run against `PORT=8852 node serve.mjs`
- **`Reviewer scope:`** do cards 13–16 do what they claim, with no layout change on the chrome over the visualization, the legal text byte-identical, and the live repo untouched? Correctness only, not taste.

## What to do
1. Run the Check; save the output to `logs/gate2-*.txt`.
2. Capture the before/after pairs of every page (home, landing ×2, apartment ×4 tabs, flow, Studio). Use `research\…\current\cap_shell.cjs` / `cap_studio.cjs` with the same URLs and names, at desktop and phone, into `.wt\platform-ui-ux\after\gate2\`.
3. Try to refute each acceptance line of 13–16.
4. Write `logs/gate2-report.md`. A FAIL sends the card back to its author.
5. **After PASS (main session):** show Eliran the landing's legal summary, collapsed and expanded, at both widths, then one AskUserQuestion: **the summary + "לנוסח המלא" as built (recommended, default 5)** / always show the full text / other. If he picks another display, the change goes back to card 14.

## Acceptance
- `logs/gate2-report.md` has every line PASS, or the defects listed.
- Eliran's ruling on the legal display is recorded here with its time and his words.

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

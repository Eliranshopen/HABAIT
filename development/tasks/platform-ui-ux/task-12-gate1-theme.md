# Task 12 — Gate 1: refute, then Eliran picks the theme
**Agent:** `qa-reviewer` (status live, track harness-ops), FRESH context, never the author of 05/10/11 → then Eliran · **Model:** sonnet · **Ruling tier:** T1 · **Burst:** 11 · **Depends on:** 11
**Memory file:** `memory/agents/qa-reviewer.md` (standing agent)
In a session started at `C:\RnD`, the project agent does not load. Spawn a fresh Sonnet sub-agent and give it `Projects\Habait\.claude\agents\qa-reviewer.md`'s charter and boundary in the brief.

## Gate lines
- **`Check:`** from the working-copy `Habait\platform\`, with `HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`. Expected: exit 0 on each, or the same red as the card 09 baseline.
  - `timeout 60 node tools/contrast.mjs`
  - `timeout 300 node test/landing.test.mjs`
  - `timeout 300 node test/card-overflow.test.mjs`
  - `timeout 540 node test/browser.mjs`
  - the acceptance probes of cards 05, 10 and 11 re-run on your own headless run against `PORT=8852 node serve.mjs` (killed by PID)
- **`Reviewer scope:`** do cards 05, 10 and 11 do what their acceptance lines claim, and is the live repo untouched? Correctness only, not taste.

## What to do
1. Run the Check under `timeout`, one at a time; save the output to `logs/gate1-*.txt`.
2. Try to refute every acceptance line of 05, 10 and 11, with its own probe, at 1440 and 390.
3. Verify the live repo: every manifest file's live sha256 equals `sha256_at_open` (`wt.py status platform-ui-ux`).
4. Write `logs/gate1-report.md` with PASS/FAIL per line. A FAIL sends the card back to its author.
5. **After PASS (main session):** send Eliran `http://127.0.0.1:8852/styleguide.html`, `/?theme=light`, `/?theme=dark` and the frames, then one AskUserQuestion: **light editorial (recommended; the research leans light outside, dark only inside the media)** / refined dark. The default if silent is light.
6. Record the pick in this card and set it as the default `data-theme` in `tokens.css` (one line, logged in `CHANGES.md`).

## Result (2026-11-03)
- Fresh Sonnet reviewer: first pass **FAIL** (C5: `test/browser.mjs` 16/25 — card 11 changed the home markup; the author had not re-run it). Fixed (selectors follow the redesign, intent unchanged; Hebrew singular; deeper hero scrim). Re-check: **PASS** — browser 25/25, card target = the v0 target, hero subtitle 7.68:1 at its brightest. Declared gap kept: `apartment.html` fonts → card 16. Report: `logs/gate1-report.md`.
- **Theme: light** — Eliran's "תעשה מה שצריך בשביל להגיע לתוצאה ושנתקדם" read as the card's default-if-silent. One comment line in `tokens.css`; light was already the default, no token changed. Eliran can switch to dark with one word.

## Acceptance
- `logs/gate1-report.md` exists with every line PASS, or the defects listed.
- Eliran's pick is recorded with its time and his words. No buyer-page card (13–16) starts before it.

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

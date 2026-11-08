# Task 18 — Phase 4 gate: tests, the after set, the 30-item audit
**Agent:** `qa-reviewer` (status live, track harness-ops), FRESH context, never an author on this board · **Model:** sonnet · **Ruling tier:** T0 · **Burst:** 16 · **Depends on:** 17
**Memory file:** `memory/agents/qa-reviewer.md` (standing agent)
Fresh Sonnet sub-agent briefed with `qa-reviewer.md`'s charter and boundary.

## Gate lines
- **`Check:`** expected exit 0 on each, or the same red as the card 09 baseline, each failure explained.
  - Platform (working copy, `HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`): `timeout 300 npm test`, `timeout 300 node test/landing.test.mjs`, `apartment.test.mjs`, `card-overflow.test.mjs`, `tokens-sync.test.mjs`, `timeout 540 node test/browser.mjs`, `timeout 60 node tools/contrast.mjs`.
  - Studio (working copy): `timeout 300 node test/run.mjs`. This needs card 08's install; without it, write "not run: no install go".
  - Card 03's staged-copy check, re-run: 0 × 4xx on `_local/dist/`.
- **`Reviewer scope:`** the plan's "Done when" list and the research's 30-item checklist, measured. Correctness and accessibility only, not taste.

## What to do
1. Run the Check, one at a time; save the output to `logs/phase4-*.txt`.
2. **The after set:** the same capture scripts, URLs and sizes as `research\platform-ui-ux-2026-11-03\current\`, plus 1280×720. Save into `C:\RnD\Projects\Habait\research\platform-ui-ux-2026-11-03\after\`, with its `CLAUDE.md` in the same change (`python .claude/skills/sync-context/generate-cards.py --apply`, root §8.6). The research folder is evidence, not product, so rail 5 does not cover it.
3. **The 30-item audit** from `raw-B-patterns.md`: one row per item with PASS / FAIL / named exception plus the evidence. At least:
   - contrast measured (4.5:1 text, 3:1 UI);
   - the keyboard path on every page and in the Studio;
   - `prefers-reduced-motion` honoured;
   - status never conveyed by colour alone;
   - no physical `left`/`right` in any CSS that `CHANGES.md` lists as changed;
   - 0 dev labels in the buyer view;
   - fonts loaded with 0 Google Fonts requests.
4. Verify the live repo is untouched (`wt.py status platform-ui-ux`: 0 drift).
5. Write `logs/phase4-report.md`.

## Acceptance
- `logs/phase4-report.md`: every Check line with its result, and all 30 audit rows filled, none blank.
- The after set exists in `research\…\after\` with the same names as `current\` (+ the 1280×720 frames) and its context file.

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

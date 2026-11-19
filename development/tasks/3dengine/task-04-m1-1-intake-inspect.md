# Card 04 — milestone 1.1 · Intake and a first look at the PDF
<!-- board: 3dengine · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 1.1 · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`; definition: `Projects/Habait/.claude/agents/engine-builder.md` in the working folder).
**Stage:** 1 · פענוח ה-PDF · **Kind:** לכתוב (new code) · **Closes in build phase:** E3 · **Cost:** $0
**Depends on:** card 03 (milestone 0.3) is closed.
**State:** `DONE` — closed 2026-11-17 on `b7790fd`: closing test 13 of 13, 367 tests, line coverage 99.72 %, end to end 51/51, the fifth fresh reviewer PASS (the 4 before it FAILED and were answered), sync-context run. The gate ran on a machine at 100 % load: `logs/1.1/r5-gate-summary.txt`. Task cards, the rounds and the findings: `m1.1/README.md`; contract and what is not in 1.1: `Projects/3Dengine/contracts/CONTRACT-1.1.md` §9, §10; evidence: `logs/1.1/`.

## The milestone (plan §7.1, word for word)
- **אבן דרך:** קליטה והצצה
- **מה עושים:** העתקת ה-PDF ל-`input/` לקריאה בלבד, sha256, בדיקת גודל ותיקיות מותרות; `inspect_plan`: עמודים, גיליון או חוברת, מועמדים
- **מוכן כאשר:** ה-PDF של 846 מזוהה כגיליון אחד עם שרטוט אחד; אותו PDF פעמיים נותן אותו `job_id`; קובץ מחוץ לתיקיות המותרות נדחה
- **נשען על:** `auto_pages.py scan` ($0)

## Files it creates or changes
In the working folder `C:\RnD\.wt\3dengine\`, under `Projects/3Dengine/` (expected; a change of this list is logged in the card when the work starts):
- `engine/stages/intake.mjs`, `engine/inspect.mjs`
- `tests/unit/intake.*.test.mjs`, `tests/milestones/m1.1.test.mjs`

## Instructions
Write the engine's own code (`engine/`, `mcp/`, `contracts/`) with unit tests. Wrap the ported pipeline tools, never fork them. CLI entry points follow the script contract (root §5): dry-run by default, `--go` only inside the estimate, idempotent, non-zero exit with a reason code.

## Carried into this card (from milestone 0.3, QA round 8, observation O-4)
The first task of this card, before the intake: `manifest.json` and `job.json` are read only when they are the files of THIS job, the way `ledger.json` is since contract 0.3 §16 item 2 (`checkLedger`). Today a hand-edited `manifest.json` or `job.json` that names another job, or none, makes a runner write into that other job's file or create a folder `jobs/undefined/` (reproduced 2 times of 2 by the eighth reviewer: `logs/0.3/qa-live-r8.md`, O-4; contract 0.3 §17 item 2). Done when: a runner started on such a file stops with the job named in its message, writes nothing outside its own job folder, and `jobs/undefined/` is never created; with unit tests and a part in the closing test.

## Acceptance criteria (the gate, plan §7.2)
1. **The closing test passes:** the «מוכן כאשר» line above, written as the runnable test `tests/milestones/m1.1.test.mjs`.
2. **Unit tests** exist for every function this card adds or changes.
3. **Every earlier card still passes:** `npm test` runs the whole suite.
4. **Test coverage is at least 80 %** of the lines of the engine's own code that this card adds or changes; the run fails under the bar. The summary is saved in `development/tasks/3dengine/logs/1.1/`.
5. **Closed properly:** commit on the branch `3dengine`, merge into the local `main`, a sync-context pass, the memory entry, the milestone log row in plan §7.2, the progress line on the plan page, and this card's State set to `DONE`.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 node --test tests/milestones/m1.1.test.mjs && timeout 300 npm test` → both commands exit 0, and `npm test` reports line coverage of at least 80 %.

## Standing rails
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block), then `memory/listings/<id>.md` only if the task names a listing. ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** at write time, name which OTHER actor must know this; append ONE pointer line into each named actor's `memory/agents/<name>.md` — `→ see <entry> — why it binds you`. No affected actor = say "none".
4. **An action is not done until its memory is written.**
5. **Ruling tier** — every brief carries its own `T0` / `T1` / `T2`.
6. Root `CLAUDE.md` §2, §8.7, §12: work only in the board's working folder; `timeout` on every run, one heavy run at a time, foreground; never open a `.env`; the plan's budget or $0; no deploy without Eliran's own go for that deploy (§9).
7. **The gate (Eliran, 2026-11-16):** no card starts before the previous card is closed. A card closes only after its closing test, its unit tests, every earlier card's tests, test coverage of at least 80 %, and a sync-context pass (plan §7.2).
8. **Git:** stage only your own paths; ⛔ never `git add -A` (the deletion of `Projects/Habait` in the main tree is unstaged and must stay so); never push.
9. **Secrets by NAME only:** never print a value, never name a `.env` path in a command; check a key's presence as a yes/no.
10. **Paid calls:** ledger row BEFORE the call, dry-run first, inside the cap, and only after Eliran answered the card's question.

Full contract: `memory/README.md` and root `CLAUDE.md` §0.

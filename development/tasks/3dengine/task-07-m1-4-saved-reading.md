# Card 07 — milestone 1.4 · A saved reading
<!-- board: 3dengine · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 1.4 · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`; definition: `Projects/Habait/.claude/agents/engine-builder.md` in the working folder).
**Stage:** 1 · פענוח ה-PDF · **Kind:** לכתוב (new code) · **Closes in build phase:** E3 · **Cost:** $0
**Depends on:** card 06 (milestone 1.3) is closed.
**State:** `DONE` — closed 2026-11-19 on `2f249804`: the closing test on real processes at $0 (a first run paid against a scripted model keeps its reading; a second run, a real job of the same PDF, makes no request, books $0 and gives the plan byte for byte), `npm test` 434 of 434 at 99.81 % of lines, the stage tier 14 of 14, end to end 51 of 51, the soak with 0 violations, a fresh reviewer's PASS in the third round (the first two failed, each on one defect of the engine's file lock, both fixed), sync-context run. Task cards and findings: `m1.4/README.md`; contract: `Projects/3Dengine/contracts/CONTRACT-1.4.md` §9, §10; evidence: `logs/1.4/`.

## The milestone (plan §7.1, word for word)
- **אבן דרך:** קריאה שמורה
- **מה עושים:** מטמון לקריאת הראייה לפי sha256 של ה-PDF וגרסת המנוע
- **מוכן כאשר:** ריצה שנייה על אותו PDF רושמת $0 ומחזירה `plan.general.json` זהה
- **נשען על:** הדגל `--vlm-file`; ‏`ENGINE.version` ב-`run-job.mjs`

## Files it creates or changes
In the working folder `C:\RnD\.wt\3dengine\`, under `Projects/3Dengine/` (expected; a change of this list is logged in the card when the work starts):
- `engine/cache/` — the reading kept by the hash of the PDF
- `tests/unit/cache.*.test.mjs`, `tests/milestones/m1.4.test.mjs`

**Changed when the work started (2026-11-18, main session; reasons in `m1.4/README.md`):** the store is the module that already holds the saved reading since 1.3, `engine/readings.mjs`, with `tests/unit/readings.test.mjs`; the closing test is `tests/stages/m1.4.test.mjs`, run with `npm run test:stages` (it runs the real tool); ONE line of the brought-in reading tool changes (the date it writes into the plan can be given), listed in `pipeline/PORT-CHANGES.md`. **The key is not «the PDF and the engine version»:** on Eliran's decision of 2026-11-18 a kept reading stays valid across engine versions and stops being valid when the reading tool or the model changes.

## Instructions
Write the engine's own code (`engine/`, `mcp/`, `contracts/`) with unit tests. Wrap the ported pipeline tools, never fork them. CLI entry points follow the script contract (root §5): dry-run by default, `--go` only inside the estimate, idempotent, non-zero exit with a reason code.

## Acceptance criteria (the gate, plan §7.2)
1. **The closing test passes:** the «מוכן כאשר» line above, written as the runnable test `tests/milestones/m1.4.test.mjs`.
2. **Unit tests** exist for every function this card adds or changes.
3. **Every earlier card still passes:** `npm test` runs the whole suite.
4. **Test coverage is at least 80 %** of the lines of the engine's own code that this card adds or changes; the run fails under the bar. The summary is saved in `development/tasks/3dengine/logs/1.4/`.
5. **Closed properly:** commit on the branch `3dengine`, merge into the local `main`, a sync-context pass, the memory entry, the milestone log row in plan §7.2, the progress line on the plan page, and this card's State set to `DONE`.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 npm run test:stages && timeout 300 npm test` → both commands exit 0, and `npm test` reports line coverage of at least 80 %.

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

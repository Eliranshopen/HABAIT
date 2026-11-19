# Card 03 — milestone 0.3 · A job on the disk
<!-- board: 3dengine · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 0.3 · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`; definition: `Projects/Habait/.claude/agents/engine-builder.md` in the working folder).
**Stage:** 0 · בסיס, לפני השלבים · **Kind:** לכתוב (new code) · **Closes in build phase:** E3 · **Cost:** $0
**Depends on:** card 02 (milestone 0.2) is closed.
**State:** `DONE` — closed 2026-11-17: closing test 17/17, 267 tests, line coverage 99.71 %, end-to-end 51/51, the eighth fresh reviewer PASS (rounds 1 to 7 FAILED and were answered), sync-context run. Task cards, the rounds and the findings: `m0.3/README.md`; contract and open items: `Projects/3Dengine/contracts/CONTRACT-0.3.md` §17; evidence: `logs/0.3/`.

## The milestone (plan §7.1, word for word)
- **אבן דרך:** עבודה על הדיסק
- **מה עושים:** `job.json`, ‏`manifest.json`, ‏`ledger.json` לכל עבודה; runner מנותק עם heartbeat, נעילה לעבודה כבדה אחת ו-resume
- **מוכן כאשר:** הורגים את ה-runner באמצע שלב, מפעילים שוב, והעבודה ממשיכה מאותה נקודה בלי חיוב כפול
- **נשען על:** `run-job.mjs` (מודל המצבים, heartbeat), ‏`run-project.mjs` (`job()`, ‏`manifestRow()`), ‏`file-ledger.mjs`

## Files it creates or changes
In the working folder `C:\RnD\.wt\3dengine\`, under `Projects/3Dengine/` (expected; a change of this list is logged in the card when the work starts):
- `engine/jobs/` — the job store, the detached runner, the heartbeat, the one-heavy-job lock, the ledger
- `contracts/job.schema.json`, `manifest-row.schema.json`, `ledger-row.schema.json`
- `tests/unit/jobs.*.test.mjs`, `tests/milestones/m0.3.test.mjs` (the kill test)

## Instructions
Write the engine's own code (`engine/`, `mcp/`, `contracts/`) with unit tests. Wrap the ported pipeline tools, never fork them. CLI entry points follow the script contract (root §5): dry-run by default, `--go` only inside the estimate, idempotent, non-zero exit with a reason code.

The state model, the heartbeat and the ledger already exist in the ported `run-job.mjs`, `run-project.mjs` (`job()`, `manifestRow()`) and `file-ledger.mjs`: reuse their shapes.

## Acceptance criteria (the gate, plan §7.2)
1. **The closing test passes:** the «מוכן כאשר» line above, written as the runnable test `tests/milestones/m0.3.test.mjs`.
2. **Unit tests** exist for every function this card adds or changes.
3. **Every earlier card still passes:** `npm test` runs the whole suite.
4. **Test coverage is at least 80 %** of the lines of the engine's own code that this card adds or changes; the run fails under the bar. The summary is saved in `development/tasks/3dengine/logs/0.3/`.
5. **Closed properly:** commit on the branch `3dengine`, merge into the local `main`, a sync-context pass, the memory entry, the milestone log row in plan §7.2, the progress line on the plan page, and this card's State set to `DONE`.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 node --test tests/milestones/m0.3.test.mjs && timeout 300 npm test` → both commands exit 0, and `npm test` reports line coverage of at least 80 %.
**Reviewer scope:** Only the kill-and-resume claim: kill the runner mid-stage, restart, and try to make the job lose a stage, repeat a finished stage, or write a second ledger row for a call that already succeeded. The reviewer is fresh (Sonnet), never the author, and is prompted to refute; a FAIL reopens this card in the same working folder.

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

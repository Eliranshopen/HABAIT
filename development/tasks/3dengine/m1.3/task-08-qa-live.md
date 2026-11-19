# Milestone 1.3 · task 08 — QA on the live main: the trace gate
<!-- board: 3dengine · milestone 1.3 (card 06 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** qa-reviewer · **Model:** sonnet · **Ruling tier:** T0
**Runs as:** a FRESH `general-purpose` spawn pinned to `sonnet`, carrying the `qa-reviewer` definition; never an author of this milestone; prompted to refute.
**Wave:** 6 · **Depends on:** task 07
**State:** `DONE` — 2026-11-18: one QA round by a fresh reviewer: PASS, with no defect (`../logs/1.3/qa-live.md`, on `ef2d2dc`).

## Files it creates or changes
- `development/tasks/3dengine/logs/1.3/qa-live.md` (the report, its first line `VERDICT: PASS` or `VERDICT: FAIL`) and its evidence files `qa-*`

## Instructions
On the live `main`, try to make each binding line of `Projects/3Dengine/contracts/CONTRACT-1.3.md` false. Work in temp engine homes only; never the real `jobs/` folder, never port 8891. ⛔ Never pay: never pass `--go`, never open or name an env file. The verdict is PASS only when no line was broken; a thing seen outside those lines is an observation, with the milestone it belongs to. The machine is shared and other sessions may hold it at 100 %: a run that is cut by its limit, or a failed WAIT, is time and is written as such, not as a defect.

## Acceptance criteria
1. A reading that fails its own check never reaches a later stage: the job is in `review` with `TRACE_GATE_FAIL`, on the real tool.
2. A job never pays for a reading: no configuration of a job, a setting or a saved reading starts a paid run.
3. No text of a PDF or of a reading reaches a job file, a tool answer, the runner's log or an error.
4. A cancel, a kill and a resume during a reading leave no process and no half-written row; the job layer of 0.3 still holds (no double bill, one runner).
5. The earlier tests still pass, and the tracked files are as they were.

**Check:** `cd C:/RnD/Projects/3Dengine && timeout 540 npm run test:stages && timeout 300 npm test` → exit 0, and the reviewer's own attempts in `logs/1.3/qa-*`.

**Reviewer scope:** the binding lines of contract 1.3 only: the mode of a job, the stage and its outcome table, the `review` state, what the wrapper changed. The reading tool itself (`pipeline/`) is out of scope.

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

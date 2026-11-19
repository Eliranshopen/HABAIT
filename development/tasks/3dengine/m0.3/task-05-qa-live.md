# Milestone 0.3 · task 05 — QA on the live main: the kill test
<!-- board: 3dengine · milestone 0.3 (card 03 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** qa-reviewer · **Model:** sonnet · **Ruling tier:** T0
**Runs as:** a fresh `general-purpose` spawn (sonnet) carrying the `qa-reviewer` definition; never an author here; prompted to refute.
**Wave:** 4 · **Depends on:** task 04
**State:** `DONE` — 2026-11-17: the eighth fresh reviewer's verdict is PASS (`../logs/0.3/qa-live-r8.md`); rounds 1 to 7 FAILED (`qa-live.md`, `qa-live-r2.md` … `qa-live-r7.md`).

## Files it creates or changes
- evidence: `development/tasks/3dengine/logs/0.3/qa-live.md`

## Instructions
Run the Check on the live `main` and try to refute the kill-and-resume claim with kills of its own, at moments the closing test does not use.

## Acceptance criteria
1. PASS or FAIL, each with evidence, for: no stage lost, no finished stage repeated, no second settled ledger row for a call that already succeeded, an interrupted reservation shown as orphaned, the heavy lock never held by two jobs, nothing left running.

**Check:** `cd C:/RnD/Projects/3Dengine && timeout 540 node --test tests/milestones/m0.3.test.mjs && timeout 300 npm test` → both exit 0; coverage at least 80 %.
**Reviewer scope:** Only the kill-and-resume claim: kill the runner mid-stage, restart, and try to make the job lose a stage, repeat a finished stage, or write a second settled ledger row for a call that already succeeded.

## Result
**Round 1: FAIL** 2026-11-16 (`../logs/0.3/qa-live.md`; a fresh Sonnet reviewer, about 85 real kills). No stage lost, none repeated, no `call_key` settled twice, files never corrupt. Broken: `spent_usd` can stay below the settled sum after a kill between the settle and the update (D1); a hard kill left an empty `job.lock` that blocked a resume for 10 seconds, 1 kill in 60 (D2); a job that hits the cap after an orphaned reservation can never get a larger cap (D3); a cancel during a paid call still writes the manifest row (D4, now the rule). Observations: a kill after the cache write and before the settle sends the call again (double billing); liveness trusts the pid alone. A NEW fresh reviewer runs after round 2.

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

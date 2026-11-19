# Milestone 1.1 · task 07 — Commit and merge into the local main
<!-- board: 3dengine · milestone 1.1 (card 04 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session.
**Wave:** 4 · **Depends on:** task 06
**State:** `DONE`

## Files it creates or changes
- git: branch `3dengine` → local `main` (fast-forward); never pushed

## Instructions
Commit on the branch with a path-limited add (`Projects/3Dengine`), merge into the local `main`, run the whole suite once in the live engine home, and check the readiness command there.

## Acceptance criteria
1. `main` holds the milestone; `git status --short Projects/3Dengine` on `main` shows no tracked file modified by the tests.
2. The whole suite passes in the live home.

**Check:** `cd C:/RnD/Projects/3Dengine && timeout 300 npm test && node engine/cli.mjs doctor` → exit 0, `READY`.

## Result
2026-11-17: commits `4d5924f` and `ac717c5` on `3dengine`, fast-forwarded into the local `main`. In the live home: `npm test` 330 of 330, line coverage 99.70 %; the readiness command prints `READY`, both keys present by name; no tracked file changed by the tests (`../logs/1.1/live-npm-test.txt`, `live-doctor.txt`).

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

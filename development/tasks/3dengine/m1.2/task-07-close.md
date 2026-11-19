# Milestone 1.2 · task 07 — Commit and merge into the local main
<!-- board: 3dengine · milestone 1.2 (card 05 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session
**Wave:** 5 · **Depends on:** task 06
**State:** `DONE`

## Files it creates or changes
- git: one commit on the branch `3dengine`, a fast-forward of the local `main`
- the live home `C:\RnD\Projects\3Dengine` (checked after the merge)

## Instructions
Commit the engine home on the branch (`git -C C:/RnD/.wt/3dengine add Projects/3Dengine`, never `git add -A`), fast-forward the local `main` to it, never push. Then, in the live home: the fast suite once, the closing test once, the readiness command. The live home has its own Python environment, so this is where the merged result is proven to run.

## Acceptance criteria
1. `main` and the branch name the same commit.
2. In the live home: `npm test` exit 0, `npm run test:stages` exit 0, the readiness command prints READY.
3. No tracked file of the engine is changed by the runs.

**Check:** `git -C C:/RnD log --oneline -1` and `git -C C:/RnD/.wt/3dengine log --oneline -1` print the same commit; `cd C:/RnD/Projects/3Dengine && timeout 300 npm test` → exit 0.

## Result
2026-11-18: branch commits `8437270` (the $0 half) and `1d06f07` (the paid half, the one-line change, the gate); the branch took `main` in (`6d006c1`, a merge commit: `main` had moved by the session's own records commit) and the local `main` was fast-forwarded to it. Not pushed. In the live home, at 97 to 100 % load: `npm test` 390 of 390, line coverage 99.74 % (190 s); `npm run test:stages` 3 of 3 (95 s); the readiness command READY; no tracked file of the engine changed (`../logs/1.2/live-*.txt`).

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

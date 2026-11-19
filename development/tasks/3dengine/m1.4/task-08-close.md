# Milestone 1.4 · task 08 — Commit and merge into the local main
<!-- board: 3dengine · milestone 1.4 (card 07 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session
**Wave:** 5 · **Depends on:** task 07
**State:** `DONE`

## Files it creates or changes
- git: commits on the branch `3dengine`, a fast-forward of the local `main`
- the live home `C:\RnD\Projects\3Dengine` (the readiness command after the merge)

## Instructions
Commit the engine home on the branch (`git -C C:/RnD/.wt/3dengine add Projects/3Dengine`, never `git add -A`), take `main` into the branch if it moved, fast-forward the local `main`, never push. Then, in the live home: the readiness command only (Eliran, 2026-11-18: the suite is not run a second time on the same commit).

## Acceptance criteria
1. `main` and the branch name the same commit.
2. In the live home the readiness command prints READY and the version is `1.4.0`.
3. No tracked file of the engine is changed in the live tree.

**Check:** `git -C C:/RnD log --oneline -1` and `git -C C:/RnD/.wt/3dengine log --oneline -1` print the same commit; `cd C:/RnD/Projects/3Dengine && node engine/cli.mjs doctor` → READY.

## Result
2026-11-18: the gate was committed on the branch as `a7b833f` and merged into the local `main` as `e0aee0cb` (a merge commit: `main` had moved by the session's own memory commits); the branch was brought level; both name the same commit; never pushed. In the live home the readiness command prints READY, the version is `1.4.0`, the mode `stub`, and the store keeps nothing yet (`reading show` answers none). No tracked file of the engine changed in the live tree (`../logs/1.4/live-doctor.txt`).

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

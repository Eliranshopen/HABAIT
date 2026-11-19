# Milestone 1.3 · task 07 — Commit and merge into the local main
<!-- board: 3dengine · milestone 1.3 (card 06 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session
**Wave:** 5 · **Depends on:** task 06
**State:** `DONE`

## Files it creates or changes
- git: commits on the branch `3dengine`, a fast-forward of the local `main`
- the live home `C:\RnD\Projects\3Dengine` (checked after the merge)

## Instructions
Commit the engine home on the branch (`git -C C:/RnD/.wt/3dengine add Projects/3Dengine`, never `git add -A`), take `main` into the branch if it moved, fast-forward the local `main`, never push. Then, in the live home: both tiers once and the readiness command.

## Acceptance criteria
1. `main` and the branch name the same commit.
2. In the live home: `npm test` exit 0, `npm run test:stages` exit 0, the readiness command prints READY.
3. No tracked file of the engine is changed by the runs.

**Check:** `git -C C:/RnD log --oneline -1` and `git -C C:/RnD/.wt/3dengine log --oneline -1` print the same commit; `cd C:/RnD/Projects/3Dengine && timeout 300 npm test` → exit 0.

## Result
2026-11-18: committed on the branch as `ef2d2dc` (61 files: the engine home, the task cards, the gate's evidence), fast-forwarded into the local `main`; both name the same commit; never pushed. In the live home the readiness command prints READY (version `1.3.0`, mode `stub`). **Acceptance criterion 2 changed by Eliran's decision of 2026-11-18** («בדיקות פעם אחת»): the live home is not given the whole suite a second time. The one try of `npm test` there was cut at 300 s by a render of another session and was not repeated; its six left-over static servers were stopped by pid. No tracked file of the engine changed in the live tree (`../logs/1.3/gate-summary.txt`).

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

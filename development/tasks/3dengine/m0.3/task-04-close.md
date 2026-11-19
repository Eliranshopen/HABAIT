# Milestone 0.3 · task 04 — Commit and merge into the local main
<!-- board: 3dengine · milestone 0.3 (card 03 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session.
**Wave:** 3 · **Depends on:** task 03
**State:** `DONE`

## Files it creates or changes
- a commit on the branch `3dengine` (only `Projects/3Dengine/`)
- the merge into the local `main`

## Instructions
Stage only `Projects/3Dengine`; never `git add -A`; never push. Then run `npm test` in the live home.

## Acceptance criteria
1. `git log` on `main` shows the commit; the live home passes `npm test`; `pi mcp list` still shows eight tools.

## Result
Round 1 done 2026-11-16: branch commit `cdc4e1e` (rebased on the main of that hour), merged into the local `main`; the live home passed `npm test` (188), the readiness command and `pi mcp list` (8 tools). Repeats after round 2.

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

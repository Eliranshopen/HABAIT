# Milestone 0.2 · task 09 — Commit and merge, three repos, all local
<!-- board: 3dengine · milestone 0.2 (card 02 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session.
**Wave:** 4 · **Depends on:** tasks 07 and 08
**State:** `DONE`

## Files it creates or changes
- a commit on `3dengine` merged into the local `main` of `C:\RnD`
- a commit on `engine-mcp` merged into the local `main` of `C:\HABAIT-Agent-UI` and of `C:\pi-main\habait`

## Instructions
Stage only this milestone's paths; never `git add -A`; never push. The two agent repos have no remote.

## Acceptance criteria
1. Each repo's `main` holds the milestone; each working copy is clean; the live engine home passes `npm test`.

## Result
Done 2026-11-16, all local, nothing pushed: `C:/RnD` main `902bdfe` (engine commits `3e9e753` and `902bdfe`); `C:/HABAIT-Agent-UI` main `309802f`; `C:/pi-main/habait` main `89751a0`. The live engine home passes `npm test` (144 tests).

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

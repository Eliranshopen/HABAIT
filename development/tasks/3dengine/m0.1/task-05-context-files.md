# Milestone 0.1 · task 05 — Context files for the new folders
<!-- board: 3dengine · milestone 0.1 (card 01 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session.
**Wave:** 2 · **Depends on:** tasks 01–04
**State:** `DONE`

## Files it creates or changes
- `CLAUDE.md` in `Projects/3Dengine/`, `engine/`, `tests/`, `pipeline/`, `house/`, `appdeps/` (hand-written, `last-updated` on line 2)
- the area row for `Projects/3Dengine/` in the root `CLAUDE.md` Context map and in `Projects/CLAUDE.md` (live files, at the sync-context pass)

## Instructions
Root §8.6: a new folder gets its context file in the same change. `pipeline/CLAUDE.md` says where the code came from and that it is not edited here.

## Acceptance criteria
1. Every new folder that is not vendor or build output has a `CLAUDE.md`.

## Result
Done 2026-11-16: 12 hand-written context files in the engine home (`Projects/3Dengine/`, `engine/` + 2, `tests/` + 3, `pipeline/`, `pipeline/Habait/`, `house/`, `appdeps/`); the project row in `Projects/CLAUDE.md`. The area row in the root `CLAUDE.md` Context map is NOT added: that file is 20.3 KB, over its 20 KB cap, from another session's uncommitted edit (sync-context Check 6).

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

# Milestone 1.2 · task 01 — The contract of the reading proof
<!-- board: 3dengine · milestone 1.2 (card 05 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session
**Wave:** 0 · **Depends on:** card 04 of the board (milestone 1.1) is closed
**State:** `DONE`

## Files it creates or changes
- `Projects/3Dengine/contracts/CONTRACT-1.2.md` (new)
- `Projects/3Dengine/contracts/CLAUDE.md` (its row)

## Instructions
Write what milestone 1.2 binds, before any code: how the engine starts the existing reading tool (`pipeline/Habait/tour360/tools/auto-trace.mjs`, unchanged), what it passes, when a run may cost money, what it reads back, what it returns, the settings, the tests and their two tiers, and what is NOT in 1.2. Every later task is written from this file, and the reviewer of task 08 tries to break its lines.

## Acceptance criteria
1. The arguments and the environment the engine gives the tool are written out, and they are the ones the pipeline's own runner gives it (`stepTrace` in `run-project.mjs`), with the differences named.
2. The rule of the paid path is one sentence at one place: a run that can call the vision model starts only with an explicit go AND a cap; otherwise nothing is started.
3. What the engine returns from a reading is listed field by field, and no field can carry text taken from the PDF.
4. The closing test is written as numbered parts, each a thing that can be run; the two tiers of tests are named with their commands.
5. What is not in 1.2 is listed with the milestone that owns it (the reading as a job stage and the exit codes as job states: 1.3; the cache of a reading: 1.4).

**Check:** the file exists, and `grep -c "^## " Projects/3Dengine/contracts/CONTRACT-1.2.md` prints at least 7.

## Result
2026-11-17, by the main session: `Projects/3Dengine/contracts/CONTRACT-1.2.md`, ten sections. Written after the hand run, so section 10 opens with what was measured.

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

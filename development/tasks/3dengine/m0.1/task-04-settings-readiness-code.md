# Milestone 0.1 · task 04 — The settings file, the readiness command, the set-up scripts and their tests
<!-- board: 3dengine · milestone 0.1 (card 01 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** a fresh `general-purpose` spawn (opus) with a self-contained brief.
**Wave:** 1 · **Depends on:** task 01 (reads `engine.config.json`, `requirements.lock.txt`)
**State:** `DONE`

## Files it creates or changes
- `package.json`
- `engine/config.mjs`, `engine/doctor.mjs`, `engine/cli.mjs`, `engine/setup/env.mjs`, `engine/setup/assets.mjs`, `engine/lib/*.mjs`
- `tests/unit/*.test.mjs`, `tests/milestones/m0.1.test.mjs`

## Instructions
Node ESM, built-ins only. One settings file feeds every environment pointer the brought-in tools read, so none falls back to a path under the folder that left the disk. The readiness command checks the runtime, the pipeline (parity), the assets and the two keys by name. The set-up scripts follow the script contract (root §5).

## Acceptance criteria
1. Unit tests pass with line coverage of at least 80 % on `engine/**`.
2. `tests/unit/env-pointers.test.mjs`: every environment name that falls back to a machine path in the tools is fed by the settings file.
3. A key's value never appears in any output.

## Result
Done 2026-11-16 by a fresh worker (opus), checked by the main session: 11 engine files, 62 tests, line coverage 99.74 % of `engine/**` (branches 95.84 %). The readiness command prints `READY EXCEPT KEYS (FAL_KEY, OPENROUTER_API_KEY)`. Added on the way: the pack zip as a third render asset (`assets-packs` check, `bring-assets` copies it).

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

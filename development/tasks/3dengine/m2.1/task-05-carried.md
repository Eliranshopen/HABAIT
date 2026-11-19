# Milestone 2.1 · task 05 — What the board carried to this card: the lock's release, and the gate on a machine the engine itself holds
<!-- board: 3dengine · milestone 2.1 (card 08 of the board) · created: 2026-11-19 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role; the scene and render chain is the `blender-scene` role's ground (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 2 (beside task 03) · **Depends on:** task 02
**State:** `PLANNED`

## Files it creates or changes
- `engine/lib/atomic.mjs` (a release that fails after `fn` ran: the third review of 1.4, O-3)
- `package.json` (`test:stages`: how many files run side by side), `tests/stages/*.test.mjs` and the waits of the older closing tests, where a wait was set on a quiet machine
- `engine/inspect.mjs` or its settings (the first look's 30 s limit on a saturated machine), only if a measurement says so
- `tests/unit/lib.test.mjs`, `resilience.test.mjs`

## Instructions
Five items wait for the milestone in which the engine holds the machine itself (the board's «Carried items»): (1) a release of the lock that cannot move its entry throws after `fn` ran and hides its result: the result or the error of `fn` stays the caller's, and the failed release is said apart; (2) the stage tier no longer ends surely inside 540 s (five files side by side, two readings in a row): make it end in ONE invocation, by running fewer files side by side or by another split, and MEASURE it; with the render test in it the tier needs a rule of its own, written in `run-tasks.md`; (3) the fixed waits of the 0.2 and 1.1 closing tests that fail at 100 % load and pass alone: wait for the event, not for a time; (4) a tool that meets a job lock held longer than 2 s answers «lock busy»: decide, on a measurement taken while a render runs, whether the wait is right; (5) the first look that passes its 30 s limit on a saturated machine: the same. An item that a measurement shows is not worth a change is written down as such, with the numbers, and stays on the board with its owner.

## Acceptance criteria
1. The result and the error of `fn` survive a failed release, in a test that makes the release fail.
2. `npm run test:stages` ends in one invocation on a quiet machine, with the measured seconds in the evidence.
3. Each of the five items is either changed with a test, or written down with its numbers and the card that owns it.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 300 npm test` → exit 0.

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

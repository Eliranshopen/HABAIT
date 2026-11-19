# Milestone 1.3 · task 02 — A stage can hand a job to a person (`review`); the mode of a new job comes from the settings
<!-- board: 3dengine · milestone 1.3 (card 06 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 1 (beside task 03) · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- `engine/runner.mjs` (a stage's `ReviewNeeded` ends the job in `review`)
- `engine/jobs.mjs` (the error class; the `review` field of a job file)
- `engine/config.mjs`, `engine.config.json` (the setting `mode`)
- `mcp/stub-engine.mjs` (a new job takes the settings' mode)
- `contracts/job.schema.json` (the `review` field)
- `tests/unit/runner.test.mjs`, `tests/unit/stub-engine.test.mjs`, `tests/unit/config.test.mjs` (new cases)

## Instructions
Sections 1 and 4 of `CONTRACT-1.3.md`. Until now a stage could only end a job as `failed` (it throws) or send it back for a larger approval. A stage that throws `ReviewNeeded(code, message, files)` now ends the job in `review`: the reason, and a `review` record `{ stage, attempt, files }` whose paths are relative to the job folder. No manifest row is written for that attempt, and no later stage runs. The rule sits where the runner already turns a thrown error into a state, so every stage gets it. The mode of a NEW job is the settings' `mode` (`stub` by default, so every older test and the real home behave as before); `real` means every stage must have a real implementation, and a stage that has none still ends the job `failed` / `STAGE_FAILED` as contract 0.3 says.

## Acceptance criteria
1. A stage that throws `ReviewNeeded` leaves the job in `review` with the reason code and the `review` record; the manifest has no row for that attempt; the stage after it never starts; nothing is billed.
2. A job in `review` is restarted by `start_simulation` and by `engine resume` exactly as before (contract 0.3 §6), and the old `review` record does not survive into the new run.
3. A `review` record whose paths leave the job folder, or that carries a field the contract does not name, is refused where the job file is written.
4. With `mode` absent from the settings a new job is `stub` (an older settings file still loads); with `real` the job id differs from the stub job of the same PDF.
5. Every test of milestones 0.1 to 1.2 passes with no assertion changed.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 300 npm test` → exit 0, coverage at least 80 %.

## Result
2026-11-18: `ReviewNeeded` and the `review` record (`engine/jobs.mjs`: `checkReview` inside `checkJob`; `setState` drops the record outside `review`), the runner's path to `review` (`engine/runner.mjs`), the mode of a new job from the settings (`engine/config.mjs` `modeFrom`, `mcp/stub-engine.mjs`), `contracts/job.schema.json` (`review`). Unit tests: `tests/unit/review.test.mjs`, 8 tests. The settings file states `"mode": "stub"`.

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

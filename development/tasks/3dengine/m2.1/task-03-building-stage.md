# Milestone 2.1 · task 03 — The build as a real stage: the job's workspace, the wrapper, the stage
<!-- board: 3dengine · milestone 2.1 (card 08 of the board) · created: 2026-11-19 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role; the scene and render chain is the `blender-scene` role's ground (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 2 (beside task 05) · **Depends on:** task 02
**State:** `EXECUTING` — 2026-11-19: written and unit-tested (`tests/unit/build.test.mjs`, 13 of 13); the first run against the real tool is the closing test of task 06.

## Files it creates or changes
- `engine/workspace.mjs` (new: the job's place for what the tools write, as the contract settles it)
- `engine/build.mjs` (new: the ONE way the engine starts the build steps of `run-project.mjs`; asynchronous, a time limit, the whole tree stopped)
- `engine/stages/building.mjs` (the `real` implementation), `engine/stages/tracing.mjs` (the crop as an output, if the contract says so)
- `engine/config.mjs`, `engine.config.json` (a `build` block: time limit)
- `tests/unit/build.test.mjs`, `workspace.test.mjs`, `building-stage.test.mjs` (a FAKE tool; no Blender)

## Instructions
Wrap, never fork: the stage starts `run-project.mjs <id> --plan … --crop … --steps apartment,casework,cameras,furnish` through one wrapper, the way `engine/trace.mjs` starts the reading tool: every value handed to the tool is an absolute path, a checked id or a number; the run is asynchronous (the runner's heartbeat goes on), bounded by a time limit, and a stop kills the whole process tree; nothing the tool printed reaches an answer (its output goes to a log in the attempt's folder); a path with a character outside printable ASCII is refused first. Free: the tool gets a fixed word in place of a key and an env root with no keys file. A room `type` the build does not know is refused before anything starts (the contract names the list and where it comes from). The stage returns the outputs the contract lists, and the same input gives the same bytes of each (prove it in a unit test with the fake tool, and in the closing test with the real one).

## Acceptance criteria
1. A real job passes `tracing` and `building` and reaches `rendering`; the build's files are where the contract says, and nowhere else.
2. A second attempt of `building` on the same input gives the same bytes of every hashed output.
3. A stop while the tool runs leaves no process of it, and the job is restartable.
4. An unknown room type ends the job with a fixed reason code before any tool starts; no text of the plan is in the answer.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 300 npm test` → exit 0 (the new unit tests in it).

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

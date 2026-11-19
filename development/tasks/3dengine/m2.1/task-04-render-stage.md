# Milestone 2.1 · task 04 — The render as a real stage: the Blender lock, a row per room, resume from the next room
<!-- board: 3dengine · milestone 2.1 (card 08 of the board) · created: 2026-11-19 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role; the scene and render chain is the `blender-scene` role's ground (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 3 · **Depends on:** task 03
**State:** `EXECUTING` — 2026-11-19: written and unit-tested (`tests/unit/render.test.mjs`, 10 of 10); its first run on real Blender worked through a kill and a resume (`../logs/2.1/dev-m21-1.txt`); DONE when the closing test of task 06 passes.

## Files it creates or changes
- `engine/blender-lock.mjs` (new: the tools' lock FILE, held by the engine around a Blender run)
- `engine/render.mjs` (new: the ONE way the engine starts a render of points; asynchronous, the whole tree stopped)
- `engine/stages/rendering.mjs` (the `real` implementation: room after room)
- `engine/config.mjs`, `engine.config.json` (a `render` block: resolution, samples, time limit per room, the points to render)
- `tests/unit/blender-lock.test.mjs`, `render.test.mjs`, `rendering-stage.test.mjs` (a FAKE renderer; no Blender)

## Instructions
One room at a time. For each camera point the stage: skips it when the job already holds that room's record with the same input hash and its files re-hash intact; else takes the machine-wide Blender lock, starts the render of that ONE point, and when the tool ends writes the room's record (its three files, their hashes, the hash of its inputs, the seconds) BEFORE it goes to the next room. A kill in the middle of a room leaves the rooms before it recorded and that room unrecorded: the next runner renders from that room on. The lock is the tools' own: a FILE made by an exclusive create, holding the owner and the pid; the engine waits for another holder (the job shows what it waits for), never takes a lock that is held, and removes only a lock that names the engine as owner and a pid that is dead. The tool the stage starts takes a lock too: it is handed a lock path of the job's own, so that a killed run cannot leave the machine's lock behind. The engine's heavy lock (one heavy stage at a time) stays as it is: `rendering` is the heavy stage. A stop kills the whole process tree (Blender is a grandchild) and gives the lock back. The scene build (a Blender run inside the first render) falls inside the same lock.

## Acceptance criteria
1. Killed in the middle of the second of two rooms and resumed: the first room is not rendered again (its files are the same bytes, its record untouched), the second is.
2. A second run on the same input renders nothing.
3. While another process holds the Blender lock the job waits and says so; it starts within seconds of the release; a lock left by a dead engine runner does not block the next one; a lock of anybody else is never removed.
4. No Blender, no tool and no lock of the job is left after a stop, a failure or a kill of the runner followed by a resume.

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

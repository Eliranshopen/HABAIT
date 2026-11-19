# Milestone 2.1 · task 06 — The closing test: two rooms, a kill, a resume, a second run, the same picture
<!-- board: 3dengine · milestone 2.1 (card 08 of the board) · created: 2026-11-19 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role; the scene and render chain is the `blender-scene` role's ground (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 4 · **Depends on:** tasks 04 and 05
**State:** `EXECUTING` — 2026-11-19: written; its first real run showed the stages working and a mistake of the test, fixed; the second run was stopped in the middle on Eliran's word. Run it again.

## Files it creates or changes
- `tests/stages/m2.1.test.mjs` (new; the stage tier: it runs real Blender)
- `tests/stages/real-home.mjs` (what a real job needs for the build and the render)
- `tests/stages/CLAUDE.md`, `tests/CLAUDE.md`

## Instructions
The line «מוכן כאשר» of the plan, on real processes, at $0, on a temp home: a real job of the golden 846 PDF from the kept fixture reading, with the render limited to TWO points. (1) The living room: `pano.webp`, `depth.png` and `pano.render.json` are in the job, and its row says so. (2) The runner is killed in the middle of the second room; a resume does not render the first room again (same bytes, same record, one render of it in the tool's own log) and renders the second. (3) A second run on the same input skips everything: no tool starts. (4) One room rendered again, elsewhere, gives the same picture, as the contract defines it. One Blender at a time on this machine, under the lock file named by `HABAIT_BLENDER_LOCK` (root §12). Other sessions render too: when the lock is held, WAIT; never remove a lock that is not this run's own. The test waits for the lock like the stage does; a wait for another session's render is time, not a failure, and the test says what it waited for. It cleans up: no process, no lock of its own, no folder of its own in the pipeline tree.

## Acceptance criteria
1. The four parts pass on a real Blender, and the evidence names the seconds of each.
2. After the test `git status --short -- Projects/3Dengine` shows nothing it left, and no process of it is alive.
3. No name the reading took from the drawing is in an answer of a tool, a job file or a log line (the rule of 1.2 and 1.3).

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 1500 node --test tests/stages/m2.1.test.mjs` → exit 0 (the limit is the tier's own, settled in task 05).

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

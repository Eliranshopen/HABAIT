# Milestone 2.1 · task 09 — QA on the live main: the render as an engine stage
<!-- board: 3dengine · milestone 2.1 (card 08 of the board) · created: 2026-11-19 · owner: Eliran Shopen -->

**Agent:** qa-reviewer · **Model:** sonnet · **Ruling tier:** T0
**Runs as:** a FRESH `general-purpose` spawn pinned to `sonnet`, carrying the `qa-reviewer` definition; never an author of this milestone; prompted to refute.
**Wave:** 7 · **Depends on:** task 08
**State:** `PLANNED`

## Files it creates or changes
- `development/tasks/3dengine/logs/2.1/qa-live.md` (the report, its first line `VERDICT: PASS` or `VERDICT: FAIL`; written from the start as `VERDICT: PENDING` and saved as it goes) and its evidence files `qa-*`

## Instructions
On the live `main`, try to make each binding line of `Projects/3Dengine/contracts/CONTRACT-2.1.md` false. Work in temp engine homes only; never the real `jobs/` folder, never port 8891, never the real home's readings folder. ⛔ Never pay; never open or name an env file. ⛔ Never print an environment VALUE: names only. ⛔ Never remove or take the machine's Blender lock when anybody else holds it, and never stop a Blender you did not start: other sessions render on this machine. A claim that two things cannot happen at the same moment is checked with REAL processes that are already waiting when the event comes, and with a fixed sequence (the lesson of 1.4). Each tier of tests runs once. The verdict is PASS only when no line was broken; a thing seen outside those lines is an observation, with the milestone it belongs to. A run that is cut by its limit, a failed WAIT, or a wait for another session's render is time and is written as such.

## Acceptance criteria
1. A room the job holds is never rendered again: no kill, stop, restart, second run or planted file makes the stage render it twice, and no later stage sees other bytes of it.
2. Never two Blenders of the engine at once, never a lock of another holder removed, never a lock of the engine left behind.
3. The build and the render write only where the contract says; nothing of a job is left in the pipeline tree when it ends; the tracked files are as they were.
4. Free: no key and no keys file reaches the tools; no text of the drawing reaches an answer, a record, a file name, a log line or an error.
5. The earlier tests still pass.

**Check:** the gate of task 07 once in the live home, and the reviewer's own attempts in `logs/2.1/qa-*`.

**Reviewer scope:** the binding lines of contract 2.1 only: the workspace, the build and render stages, the Blender lock, the per-room record and resume, and the change of the lock's release. The brought-in tools (`pipeline/`) are out of scope, except what `pipeline/PORT-CHANGES.md` lists for this milestone (nothing, unless the proof failed).

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

# Milestone 1.2 · task 08 — QA on the live main: the reading of 846 inside the engine
<!-- board: 3dengine · milestone 1.2 (card 05 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** qa-reviewer · **Model:** sonnet · **Ruling tier:** T0
**Runs as:** a FRESH `general-purpose` spawn pinned to `sonnet`, carrying the `qa-reviewer` definition; never an author of this milestone; prompted to refute.
**Wave:** 6 · **Depends on:** task 07
**State:** `DONE` — 2026-11-18: one QA round by a fresh reviewer, on `6d006c1`: PASS with no defect (the closing commit adds a test pin and documents, no engine code) (`../logs/1.2/qa-live.md`, on `c9caca6`).

## Files it creates or changes
- `development/tasks/3dengine/logs/1.2/qa-live.md` (the report, its first line `VERDICT: PASS` or `VERDICT: FAIL`) and its evidence files `qa-*`

## Instructions
On the live `main`, try to make each binding line of `Projects/3Dengine/contracts/CONTRACT-1.2.md` false. Work in temp folders only; never the real `jobs/` folder, never port 8891. ⛔ Never start a paid run: never pass `--go`, never run the tool without a saved reading or with the judge on, never open or name an env file. The verdict is PASS only when no line was broken; a thing seen outside those lines is an observation, with the milestone it belongs to, not a FAIL. The machine is shared and other sessions may hold it at 100 %: a run that is cut by its limit, or a failed WAIT, is time and is written as such, not as a defect.

## Acceptance criteria
1. The plan's «מוכן כאשר» line holds on the real 846 PDF from the saved reading: exit 0, 10 of 10 rooms, every printed dimension within 1 % (0.83 % at most).
2. No configuration that can cost money starts the tool without a go and a cap (the reviewer proves it with a fake tool or by counting processes, never by paying).
3. No text of the PDF reaches the command's output, an error or a returned value.
4. A stopped run leaves no process behind; a result is never read from a folder of another run.
5. The evidence of the fresh reading (task 05) says what the card says: the ledger rows, the total inside the cap, no key value anywhere.
6. The earlier tests still pass, and the tracked files are as they were.

**Check:** `cd C:/RnD/Projects/3Dengine && timeout 540 npm run test:stages && timeout 300 npm test` → exit 0, and the reviewer's own attempts in `logs/1.2/qa-*`.

**Reviewer scope:** the binding lines of contract 1.2 only: how the tool is started, the rule of the paid path, what is read back and returned, a stopped run, the closing test. The reading tool itself (`pipeline/`) is code brought as it is and is out of scope, and so are the job layer of 0.3 and the intake of 1.1, unless one of these lines breaks them.

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

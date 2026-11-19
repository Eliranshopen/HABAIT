# Milestone 1.4 · task 09 — QA on the live main: a saved reading
<!-- board: 3dengine · milestone 1.4 (card 07 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** qa-reviewer · **Model:** sonnet · **Ruling tier:** T0
**Runs as:** a FRESH `general-purpose` spawn pinned to `sonnet`, carrying the `qa-reviewer` definition; never an author of this milestone; prompted to refute.
**Wave:** 6 · **Depends on:** task 08
**State:** `DONE` — 2026-11-19: a fresh reviewer's PASS in the third round (the first two failed, each on one defect of the engine's file lock, both fixed) (`../logs/1.4/qa-live-r3.md`, on `2f249804`).

## Files it creates or changes
- `development/tasks/3dengine/logs/1.4/qa-live.md` (the report, its first line `VERDICT: PASS` or `VERDICT: FAIL`) and its evidence files `qa-*`

## Instructions
On the live `main`, try to make each binding line of `Projects/3Dengine/contracts/CONTRACT-1.4.md` false. Work in temp engine homes only; never the real `jobs/` folder, never port 8891, never the real home's readings folder. ⛔ Never pay: never pass `--go` in the real home, never open or name an env file; a paid path only on a temp home with no keys file, a planted fake key and a scripted or recording `fetch`. ⛔ Never print an environment VALUE: names only, also when proving that a value is absent (the review of 1.3 printed a harness token into its evidence). Each tier of tests runs once. The verdict is PASS only when no line was broken; a thing seen outside those lines is an observation, with the milestone it belongs to. The machine is shared: a run that is cut by its limit, or a failed WAIT, is time and is written as such.

## Acceptance criteria
1. A second run of the same PDF never pays for the reading: no setting, flag, record or planted file makes a run with a valid kept reading call the model for it.
2. A kept reading is used only when it is this PDF's, adds up with its record, and was made by today's reader; a forged or mismatched one is never `found`.
3. The same reading gives the same bytes of `plan.general.json`, whatever the day, the engine version or the job; the pinned hash holds.
4. A reading that was paid for is never destroyed by a later save, and nothing of a reading's text reaches an answer, a record's name, a log line or an error.
5. The earlier tests still pass, and the tracked files are as they were.

**Check:** `cd C:/RnD/Projects/3Dengine && timeout 540 npm run test:stages && timeout 300 npm test` → exit 0, and the reviewer's own attempts in `logs/1.4/qa-*`.

**Reviewer scope:** the binding lines of contract 1.4 only: the store, the reader's identity, the date and the id, the command and the stage. The reading tool itself (`pipeline/`) is out of scope, except the ONE line this milestone changed.

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

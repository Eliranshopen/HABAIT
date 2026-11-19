# Milestone 1.1 · task 08 — QA on the live main: the intake and the first look
<!-- board: 3dengine · milestone 1.1 (card 04 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** qa-reviewer · **Model:** sonnet · **Ruling tier:** T0
**Runs as:** a FRESH `general-purpose` spawn pinned to `sonnet`, carrying the `qa-reviewer` definition; never an author of this milestone; prompted to refute.
**Wave:** 5 · **Depends on:** task 07
**State:** `DONE` — 2026-11-17: the fifth fresh reviewer's verdict is PASS, with no defect (`../logs/1.1/qa-live-r5.md`, on `b7790fd`); the four rounds before it FAILED (`qa-live.md`, `qa-live-r2.md`, `qa-live-r3.md`, `qa-live-r4.md`) and were answered in rounds 2 to 5.

## Files it creates or changes
- `development/tasks/3dengine/logs/1.1/qa-live.md` (the report) and its evidence files `qa-*`

## Instructions
On the live `main`, in a temp engine home (never the real `jobs/` folder, never port 8891), try to make each binding line of `Projects/3Dengine/contracts/CONTRACT-1.1.md` false. The verdict is PASS only when no line was broken; a thing seen outside those lines is an observation, with the milestone it belongs to, not a FAIL.

## Acceptance criteria
1. The three lines of the plan's «מוכן כאשר» hold on the real 846 PDF.
2. No text of a PDF reaches a tool answer, an error or a log (a PDF made for the test carries a marker sentence).
3. A stored input that was changed is never used; a job file that names another job is never written through.
4. The earlier tests still pass, and the tracked files are as they were.

**Check:** `cd C:/RnD/Projects/3Dengine && timeout 300 node --test tests/milestones/m1.1.test.mjs && timeout 300 npm test` → exit 0, and the reviewer's own attempts in `logs/1.1/qa-*`.

**Reviewer scope:** the binding lines of contract 1.1 only (sections 1 to 5 and 8): the first look, the candidate choice, the intake, the check of the stored input, the identity of `job.json` and `manifest.json`. The job layer of 0.3 is out of scope unless one of these lines breaks it.

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

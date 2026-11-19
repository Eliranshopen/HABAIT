# Milestone 1.3 · task 01 — The contract of the trace gate
<!-- board: 3dengine · milestone 1.3 (card 06 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session
**Wave:** 0 · **Depends on:** card 05 of the board (milestone 1.2) is closed
**State:** `DONE`

## Files it creates or changes
- `Projects/3Dengine/contracts/CONTRACT-1.3.md` (new)
- `Projects/3Dengine/contracts/CLAUDE.md` (its row)

## Instructions
Write what milestone 1.3 binds, before any code: which jobs run the reading for real (the job mode), where the stage takes its reading from, what it gives the tool, what each outcome of a reading becomes for a job (the state and the reason code), what a job that needs a person carries (`review`), what the stage leaves on the disk, what it never does (pay), and what is NOT in 1.3. The three observations of 1.2's review that this card owes are answered in it by name (O-1, O-5, O-6).

## Acceptance criteria
1. Every outcome of `runTrace` has one line: the job state, the reason code, whether a later stage may run.
2. The rule «a failed reading never reaches the build» is one sentence at one place, and the test that proves it is named.
3. The rule «a job never pays for a reading in 1.3» is written with what the job answers instead and which milestone brings the paid reading.
4. No text of a PDF can reach a job file, a tool answer, a log line of the runner or an error: the contract says which fields a `review` carries and that each is a number, a fixed word or a path.
5. What is not in 1.3 is listed with the milestone that owns it.

**Check:** the file exists, and `grep -c "^## " Projects/3Dengine/contracts/CONTRACT-1.3.md` prints at least 8.

## Result
2026-11-18: `Projects/3Dengine/contracts/CONTRACT-1.3.md`, nine sections. Section 7 was corrected during the build: it names the test files that exist (`review.test.mjs`, `tracing-stage.test.mjs`) and every change of an earlier test with its reason, the soak's check among them.

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

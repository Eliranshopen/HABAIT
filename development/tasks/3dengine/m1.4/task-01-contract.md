# Milestone 1.4 · task 01 — The contract of the saved reading
<!-- board: 3dengine · milestone 1.4 (card 07 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session
**Wave:** 0 · **Depends on:** card 06 of the board (milestone 1.3) is closed
**State:** `DONE`

## Files it creates or changes
- `Projects/3Dengine/contracts/CONTRACT-1.4.md` (new)
- `Projects/3Dengine/contracts/CLAUDE.md` (its row)

## Instructions
Write what milestone 1.4 binds, before any code: what a kept reading is (the reading and its record), what binds it to a PDF and to the reader that made it, when it is used and when it is not (Eliran's decision of 2026-11-18: valid across engine versions, invalid when the reading tool or the model changes), how a reading gets into the store (a paid run that passed; a hand's import), what a second run costs and what it returns, why the same reading gives the same bytes of the plan (the date and the id), what changes in the stage and in the command, and what is NOT in 1.4. The two items the board carried to this card are answered by name (the day's date in the plan; O-3 of 1.3's review).

## Acceptance criteria
1. The rule «a second run of the same PDF pays nothing for the reading» is one sentence, with what it does NOT cover (the judge's calls on a paid run).
2. The rule «the same reading gives the same bytes of `plan.general.json`» names both things that made the bytes differ (the day, the id) and what each is now.
3. When a kept reading is NOT used is one list: none, not a reading, not this PDF's, made by another reader; each with what the job and the command answer.
4. What changes in a binding line of contract 1.3 is listed (the id handed to the tool; where a reading lives).
5. What is not in 1.4 is listed with the milestone that owns it.

**Check:** the file exists, and `grep -c "^## " Projects/3Dengine/contracts/CONTRACT-1.4.md` prints at least 8.

## Result
2026-11-18: `Projects/3Dengine/contracts/CONTRACT-1.4.md`, ten sections. Added during the build: the record's `plan_date` (section 3): the day of the plan is decided by the command before a paid run starts and kept in the record, so a run that crosses midnight cannot give a later run another date.

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

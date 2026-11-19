# Milestone 1.1 · task 01 — The contract of the intake and the first look
<!-- board: 3dengine · milestone 1.1 (card 04 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session.
**Wave:** 0 · **Depends on:** card 03 of the board (milestone 0.3) is closed
**State:** `DONE`

## Files it creates or changes
- `Projects/3Dengine/contracts/CONTRACT-1.1.md` (in the working folder `C:\RnD\.wt\3dengine`)

## Instructions
Fix, before any worker starts, what crosses a boundary in this milestone: what `inspect_plan` answers, what a candidate is and how a job chooses one, how the PDF is copied into the job, how the stored copy is checked, how a job's own files are told from another job's, the settings, the engine version, and the tests (the six parts of the closing test, and the lines of earlier tests that change). Measured first: the scanner on the 846 PDF (1 page, 8,515 vector paths, 2.2 s), a read-only file on this machine (an overwrite is refused, the folder can still be removed).

## Acceptance criteria
1. The contract answers, for each of the three lines of the plan's «מוכן כאשר», which function makes it true and which part of the closing test proves it.
2. Every failure is given one of the fixed reason codes of contract 0.2; no new code.
3. What 1.1 does not do is written down (a booklet of vector pages, a preview of a sheet, the Pi wrapper's text, the apartment's own name).

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

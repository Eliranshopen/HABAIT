# Milestone 0.2 · task 08 — One real conversation through Pi's model
<!-- board: 3dengine · milestone 0.2 (card 02 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T1
**Runs as:** the main session, or Eliran himself in the UI.
**Wave:** 3 · **Depends on:** task 06
**State:** `DONE`

## Files it creates or changes
- evidence: `development/tasks/3dengine/logs/0.2/live.md`

## Instructions
The last link the scripted run cannot prove: that the model, given a PDF and the eight tools, calls them in a sensible order. **Question for Eliran:** a real conversation spends a few cents of model tokens through Pi's own provider login. Default: he uploads the 846 PDF in the UI himself and looks; or he says yes to a cap of $1 and the session runs it.

## Acceptance criteria
1. One recorded conversation in which the agent calls `inspect_plan`, `start_simulation`, later `approve_paid_stage` after the user's approval, and `get_result`.

## Result
PASS 2026-11-16 on Eliran's «מאשר» (cap $1; the ledger row was written before the run: `../logs/0.2/live.md`). One conversation, 160 seconds, 6 tool calls: with no tool named in the user's message, the real model chose `inspect_plan`, `start_simulation` and, after the approve button's message, `approve_paid_stage`; the guard asked before the approval reached the job file; the link opened the 846 tour; the agent said on its own that the engine is a stub and the result a replay. The amount spent is not readable by the script (a few cents expected).

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

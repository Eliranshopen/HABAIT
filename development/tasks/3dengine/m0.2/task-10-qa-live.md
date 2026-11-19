# Milestone 0.2 · task 10 — QA on the merged state
<!-- board: 3dengine · milestone 0.2 (card 02 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** qa-reviewer · **Model:** sonnet · **Ruling tier:** T0
**Runs as:** a fresh `general-purpose` spawn (sonnet) carrying the `qa-reviewer` definition; never an author here; prompted to refute.
**Wave:** 5 · **Depends on:** task 09
**State:** `DONE`

## Files it creates or changes
- evidence: `development/tasks/3dengine/logs/0.2/qa-live.md`

## Instructions
Run the Check on the merged state and try to refute the claim that milestone 0.2 is closed.

## Acceptance criteria
1. PASS or FAIL, each with evidence, for: the eight tools and their contract, the same-PDF rule, the money gate (no approval without the guard's question), the stub badge on every card, the local link, coverage, no key value anywhere.

**Check:** `cd C:/RnD/Projects/3Dengine && timeout 540 node --test tests/milestones/m0.2.test.mjs && timeout 300 npm test` → both exit 0; coverage at least 80 %.
**Reviewer scope:** Only milestone 0.2 on the merged state: do the eight tools keep the contract, can a paid stage be approved without the guard's question, can a stub result be mistaken for a real one, does the local link open the tour.

## Result
PASS 2026-11-16, no defects (`../logs/0.2/qa-live.md`; a fresh Sonnet reviewer, with its own JSON-RPC probe and path-traversal attempts). Its observations are in contract §10 as known limits owned by later milestones: the money gate lives in Pi's guard only (4.2), the local link trusts its port (3.3), the gate was run with `direct` exposure only.

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

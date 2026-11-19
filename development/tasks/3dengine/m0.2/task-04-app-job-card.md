# Milestone 0.2 · task 04 — The app: the job card (progress, quote, result)
<!-- board: 3dengine · milestone 0.2 (card 02 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** platform-dev · **Model:** opus · **Ruling tier:** T0
**Runs as:** a fresh `general-purpose` spawn (opus) with a self-contained brief.
**Wave:** 1 · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- in `C:\HABAIT-Agent-UI\.wt\engine-mcp\app\src`: the `job` event in `agent/types.ts` and `agent/piBridgeAdapter.ts`, the store, a job card component, `agent/resultUrl.ts`, a mock scenario; pure-logic modules as `.ts` files with `*.test.ts` beside them

## Instructions
Contract §7. Hebrew, RTL, in the design language of the existing cards; no new dependency. Logic that can be tested without a browser lives in plain `.ts` modules run by `node --test`.

## Acceptance criteria
1. `npm run typecheck` and `npm run build` pass.
2. The logic tests pass with line coverage of at least 80 % on the new logic modules.
3. The mock scenario plays a job from `queued` to `done` with an approval in the middle; the badge «שחזור הדגמה» shows for a stub job; a loopback link is accepted for a job result only.

## Result
Done 2026-11-16 by a fresh worker (opus), checked by the main session in headless Chrome at 1440 and 390 (`../logs/0.2/shots/`): typecheck and build pass; 35 of 35 logic tests; line coverage 100 % of the new logic modules; no horizontal overflow on either side, no console error, the badge «שחזור הדגמה» on the card. Two defects found in the browser and fixed: the quote range was drawn reversed (a `<bdi>` with no strong character takes its parent's direction), and the engine's approval card was half English. Mock scenario: `/?play=job&fast=1`.

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

# Milestone 0.2 · task 05 — Pi: registration by the installer and the guard rule
<!-- board: 3dengine · milestone 0.2 (card 02 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** a fresh `general-purpose` spawn (opus) with a self-contained brief.
**Wave:** 1 · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- in `C:\pi-main\habait\.wt\engine-mcp`: `install-global.py` (the MCP entry: idempotent, with a backup, removed by `--uninstall`), `extensions/habait-guard/index.ts` (the rule for `approve_paid_stage`), `extensions/habait-guard/guard-test.mjs` (new cases)

## Instructions
Contract §8. The installer is exercised against a temporary folder only; the real run on the user's Pi folder is task 06, by the main session.

## Acceptance criteria
1. The guard asks before `mcp__habait_engine__approve_paid_stage`, blocks it with no UI, and lets the other seven engine tools pass.
2. The installer writes the entry once, keeps a backup, and `--uninstall` removes only its own entry.

## Result
Done 2026-11-16 by a fresh worker (opus), checked by the main session: `GUARD TEST: PASS (39 cases)`, `INSTALL TEST: PASS (8 cases)`. The installer already had `--agent-dir`, so the tests ran against a temp folder. Stale paths of the wrapper were listed, not fixed (later work).

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

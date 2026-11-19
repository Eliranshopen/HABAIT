# Card 30 — final QA on the live `main`
<!-- board: 3dengine · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §11 · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** qa-reviewer · **Model:** sonnet · **Ruling tier:** T0
**Runs as:** a fresh `general-purpose` spawn (sonnet) that carries `Projects/Habait/.claude/agents/qa-reviewer.md` as its brief; never an author on this board, and prompted to refute.
**Depends on:** card 29 (milestone 7.5) is closed and merged.
**State:** `PLANNED`

## What it checks
The engine where it now lives: `C:\RnD\Projects\3Dengine` on the local `main`, after the last merge.
1. The whole test suite passes there, with line coverage of at least 80 % of the engine's own code.
2. The parity registry passes 41/41 and the readiness command reports ready.
3. Plan §11, items 1–9, each one against its evidence path from card 29; any item without evidence is a FAIL.
4. Nothing outside `Projects/3Dengine/` changed on `main` because of this board, except the board's own files, the plan and the memory.

## Acceptance criteria
- The four checks above, each with PASS or FAIL and its evidence path, in `development/tasks/3dengine/logs/qa-live.md`.
- A FAIL reopens the card that owns the defect, in the same working folder; this card then runs again with a fresh reviewer.

**Check:** `cd C:/RnD/Projects/3Dengine && timeout 300 npm test && timeout 120 node pipeline/Habait/tour360/tools/run-project.mjs --parity && timeout 120 node engine/cli.mjs doctor` → all three exit 0; coverage at least 80 %; `parity: 41 rows · PASS`.
**Reviewer scope:** Only the live `main` after the last merge: does the engine that was merged pass its own tests and plan §11, with evidence for every item.

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

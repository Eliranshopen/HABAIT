# Milestone 0.1 · task 01 — Bring the pipeline code from git, as it is
<!-- board: 3dengine · milestone 0.1 (card 01 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role.
**Wave:** 1 · **Depends on:** the working folder `.wt/3dengine` (open)
**State:** `DONE`

## Files it creates or changes
- `Projects/3Dengine/pipeline/**` — 1,124 files in the layout of the old `habait-walkaround/` root: `360walkaround/` (220), `Habait/tour360/` (592), `Habait/tools/` (5), `Habait/studio-web/` (15), `Habait/engine/` (100), `Habait/platform/` without `tools/_unused/` (192), plus `.gitignore` and `.gitattributes`
- `Projects/3Dengine/house/legal/` — the 6 legal data files from `Projects/Habait/data/sales-plans/legal/`

## Instructions
Copy the tracked files from the working folder's own checkout of `Projects/Habait/habait-walkaround/` (commit `a63494a`) into `pipeline/`, keeping every relative path, so no tool has to change. Nothing is edited.

## Acceptance criteria
1. The file count of every copied folder equals `git ls-tree -r` at `a63494a`.
2. Every copied file has the git blob id of its source (checked by the closing test).

## Result
Done 2026-11-16: 220 / 592 / 5 / 15 / 100 / 192 copied = tracked. `Habait/studio-web` and `Habait/engine/gates/plan_gate.py` are needed by the parity registry; `Habait/platform` by the dollhouse build and the local publish.

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

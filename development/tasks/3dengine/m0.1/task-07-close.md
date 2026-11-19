# Milestone 0.1 · task 07 — Commit, merge into the local main, set up the live home
<!-- board: 3dengine · milestone 0.1 (card 01 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session.
**Wave:** 4 · **Depends on:** task 06
**State:** `DONE`

## Files it creates or changes
- a commit on the branch `3dengine` (only `Projects/3Dengine/`)
- the merge into the local `main`
- untracked, in the live home `C:\RnD\Projects\3Dengine`: `.venv/`, `appdeps/node_modules/`, the render assets — produced by the set-up scripts

## Instructions
Stage only `Projects/3Dengine`; never `git add -A`; never push. After the merge run `node engine/cli.mjs setup-env --go` and `node engine/cli.mjs bring-assets --go` in the live home: this is the real run of the set-up scripts.

## Acceptance criteria
1. `git log` on `main` shows the merge; `git status` shows nothing staged that is not this card's.
2. The readiness command in the live home reports ready except the keys.

## Result
Done 2026-11-16: branch commits `4f97ec5` and `5844920`, merged into the local `main` by fast-forward. In the live home the set-up scripts ran for real (`../logs/0.1/live-setup-env.txt`, `live-bring-assets.txt`): venv + pip + npm, then 59 asset entries copied (295.8 MB); a second run of each did nothing. `live-doctor.txt`: READY EXCEPT KEYS. A fix on the way: a shell command is sent as one string, so the npm step raises no deprecation warning.

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

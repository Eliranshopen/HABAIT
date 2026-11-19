# Milestone 0.1 · task 08 — QA on the live main
<!-- board: 3dengine · milestone 0.1 (card 01 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** qa-reviewer · **Model:** sonnet · **Ruling tier:** T0
**Runs as:** a fresh `general-purpose` spawn (sonnet) carrying the `qa-reviewer` definition; never an author here; prompted to refute.
**Wave:** 5 · **Depends on:** task 07
**State:** `DONE`

## Files it creates or changes
- evidence: `development/tasks/3dengine/logs/0.1/qa-live.md`

## Instructions
Run the Check on the live `main` and try to refute the claim that milestone 0.1 is closed.

## Acceptance criteria
1. PASS or FAIL for each of: parity 41/41, catalog 57/57, readiness, port identity, coverage, no key value in any output — each with its evidence.
2. A FAIL reopens the task that owns the defect, in the same working folder.

**Check:** `cd C:/RnD/Projects/3Dengine && timeout 540 node --test tests/milestones/m0.1.test.mjs && timeout 300 npm test` → both exit 0; coverage at least 80 %.
**Reviewer scope:** Only the engine home on the live `main`: is it what card 01 says (41/41, 57/57, ready except the keys, the code identical to git `a63494a`, coverage at least 80 %), and does any output show a key's value.

## Result
PASS 2026-11-16, no defects (`../logs/0.1/qa-live.md`, a fresh Sonnet reviewer). Two low observations: the port test skips folders named `models`, `hdri`, `.cache` (the readiness command's sha256 checks cover them); the closing test runs `fetch.mjs` with `--no-import-test` (the full run with the Blender import of 57/57 models is in `fetch-verify-only.txt`).

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

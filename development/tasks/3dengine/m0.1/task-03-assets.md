# Milestone 0.1 · task 03 — The render assets
<!-- board: 3dengine · milestone 0.1 (card 01 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role.
**Wave:** 1 · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- untracked: `pipeline/360walkaround/catalog/models/` (57 model folders, 180 files, 275 MB)
- untracked: `pipeline/360walkaround/pipeline/probe/probe-assets/hdri/qwantani_noon_puresky_4k.hdr` (17.9 MB)
- untracked: `pipeline/360walkaround/catalog/.cache/kenney-furniture-kit.zip` (5.1 MB)
- evidence: `development/tasks/3dengine/logs/0.1/fetch-verify-only.txt`, `fetch.report.verify-only.json`, `fetch-verify-full.txt`

## Instructions
Copy the models and the HDRI from the 2026-11-04 backup and the pack zip from the 2026-11-03 archive, then verify with the pipeline's own tool. Nothing is downloaded into the result.

## Acceptance criteria
1. `fetch.mjs --verify-only` prints `57/57 rows OK` and exits 0.
2. Blender 4.5.10 imports 57 of 57 models.

## Result
Done 2026-11-16: `pack kenney-furniture-kit … manifest-match=true`, `57/57 imported OK in 3.5 s (Blender 4.5.10 LTS)`, `fetched 57/57 rows OK`. See the finding in Key state: the pack URL is dead.

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

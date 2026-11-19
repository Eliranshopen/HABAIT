# Milestone 1.2 · task 05 — One fresh reading (paid, inside Eliran's cap): the closing test, part 2
<!-- board: 3dengine · milestone 1.2 (card 05 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T1
**Runs as:** the main session
**Wave:** 3 · **Depends on:** task 04, and Eliran's answer to the question below
**State:** `DONE`

## Files it creates or changes
- `development/tasks/3dengine/logs/1.2/fresh/` (the run's evidence: the command, the dry run, `index.json`, `trace-check.json`, `report.json`, `ledger.json`, the log)
- `tests/fixtures/apt846/fresh-reading/` (new: the small JSON files of the fresh run, pinned)
- `tests/stages/m1.2.test.mjs` (part 2: asserts from that evidence)

## Instructions
First the dry run: `node engine/cli.mjs trace tests/fixtures/apt846/source.pdf --out <new folder> --id apt846` with no go prints what would be called, the cap rule, and whether the two key names are present (yes or no, never a value); nothing is started. Then, only after Eliran's answer: the same command with `--budget <his cap> --go`. The tool books every vision call in its own ledger file BEFORE the call and stops when the cap would be passed (exit 4). A row of the spend is written in `logs/1.2/fresh/spend.txt` before the call. One reading only: if the reading does not give a passing trace, STOP and report what failed; a second reading is a new question.

## Acceptance criteria
1. The dry run started nothing and booked nothing (its folder holds no ledger file).
2. The fresh run: exit 0, PASS, room count 10 of 10, every printed-dimension check within 1 %; the largest percent is recorded beside the plan's 0.83 %.
3. The ledger: every row was reserved before its call and settled after it; the total is inside the cap and equals `spent_usd` of the result.
4. No key value is in any file of the evidence (a search by the key names finds names only).
5. Part 2 of the closing test passes from the pinned evidence, with no call.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 npm run test:stages` → exit 0, both parts.

## Progress
2026-11-17: the dry run is done and kept (`../logs/1.2/fresh/dry-run.txt`): it started nothing, created nothing, and says what a paid run would call (1 reading and up to 3 runs of the judge, about $0.08) and that both key names are present. The question below was put to Eliran the same day.

## Result
2026-11-18. **Eliran's answer, in the session's question dialog: «$0.50 (מומלץ)».** The spend file has a row before every call and the actual after it (`../logs/1.2/fresh/spend.txt`).
- **Attempt 1 was refused by the provider** (HTTP 401) 11 s into the run, before any reading was made, and billed nothing: the tool's ledger shows the call reserved at $0.02 and settled at $0 (`../logs/1.2/fresh/attempt-1/`). The cause was in the tool, not in a key: it sent its vision call to OpenRouter without the key's header. Every other caller of the transport sends it; until 2026-11-17 the keys file held only the fal key, so the measured runs went through fal's router and never met it.
- **ONE line of the brought-in tool was changed** (the card of the board allows it when the proof fails): `Projects/3Dengine/pipeline/Habait/tour360/tools/auto-trace.mjs`, listed in `pipeline/PORT-CHANGES.md`. A new part 3 of the closing test walks the paid path without paying (planted keys, `fetch` replaced by a recorder) and fails on the tool as it was brought.
- **Attempt 2 passed:** exit 0, 10 of 10 rooms, 82 checks with 0 failed, printed dimensions 0.82 % at most, the judge with no agreed mismatch, 180 s, **$0.0404** of the $0.50 cap (the reading $0.0124, three judge runs $0.0280; `../logs/1.2/fresh/attempt-2/`). One reading was made.
- The run's small files are pinned in `Projects/3Dengine/tests/fixtures/apt846/fresh-reading/`; part 2 of the closing test asserts the milestone's line from them, with no call.
- **Changed against the card:** part 2 is in `tests/stages/m1.2.test.mjs`; part 3 is a file of its own, `tests/stages/m1.2-paid-path.test.mjs`, so the two real runs go side by side.

## Question for Eliran (T1)
The fresh reading costs about $0.09 (one reading of the drawing and three runs of the judge, the same vision model, through OpenRouter; both keys are present by name). Which cap? Recommended: $0.50 (about five times the estimate, so one reading can never pass it; the tool refuses a call that would). Other options: $1 (the tool's own default), or no fresh reading now (the milestone then stays open at its $0 half, and no later card starts: plan §7.2). Default while there is no answer: STOP after the $0 half and report.

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

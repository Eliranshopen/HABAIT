# Card 15 — milestone 4.2 · No payment without an approval
<!-- board: 3dengine · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 4.2 · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T2
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`; definition: `Projects/Habait/.claude/agents/engine-builder.md` in the working folder).
**Stage:** 4 · אישור תקציב · **Kind:** לכתוב (new code) · **Closes in build phase:** E3, E4 · **Cost:** $0
**Depends on:** card 14 (milestone 4.1) is closed.
**State:** `PLANNED`

## The milestone (plan §7.1, word for word)
- **אבן דרך:** אין תשלום בלי אישור
- **מה עושים:** רשומת אישור בתיקיית העבודה (תקרה, מתי); ה-runner בודק אותה לפני השלב בתשלום; ה-guard של Pi מציג כרטיס עם ההצעה
- **מוכן כאשר:** הפעלת השלב בתשלום בלי רשומה נדחית בקוד; עם רשומה הוא מתחיל; בלי ממשק הכלי חסום
- **נשען על:** התקדים: נעילת הבנייה (`approve-build.mjs`, שורת parity ‏41)

## Files it creates or changes
In the working folder `C:\RnD\.wt\3dengine\`, under `Projects/3Dengine/` (expected; a change of this list is logged in the card when the work starts):
- `engine/approval.mjs`, the wiring of `approve_paid_stage`
- `tests/unit/approval.*.test.mjs`, `tests/milestones/m4.2.test.mjs`

## Instructions
Write the engine's own code (`engine/`, `mcp/`, `contracts/`) with unit tests. Wrap the ported pipeline tools, never fork them. CLI entry points follow the script contract (root §5): dry-run by default, `--go` only inside the estimate, idempotent, non-zero exit with a reason code.

## Acceptance criteria (the gate, plan §7.2)
1. **The closing test passes:** the «מוכן כאשר» line above, written as the runnable test `tests/milestones/m4.2.test.mjs`.
2. **Unit tests** exist for every function this card adds or changes.
3. **Every earlier card still passes:** `npm test` runs the whole suite.
4. **Test coverage is at least 80 %** of the lines of the engine's own code that this card adds or changes; the run fails under the bar. The summary is saved in `development/tasks/3dengine/logs/4.2/`.
5. **Closed properly:** commit on the branch `3dengine`, merge into the local `main`, a sync-context pass, the memory entry, the milestone log row in plan §7.2, the progress line on the plan page, and this card's State set to `DONE`.
6. **Eliran answered the question below** before the part it guards started.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 node --test tests/milestones/m4.2.test.mjs && timeout 300 npm test` → both commands exit 0, and `npm test` reports line coverage of at least 80 %.
**Reviewer scope:** Only the claim "no paid call can start before `approve_paid_stage`": try every path (CLI flags, a resumed job, a second approval, a stale approval for another quote) to make one paid step run unapproved. The reviewer is fresh (Sonnet), never the author, and is prompted to refute; a FAIL reopens this card in the same working folder.

## Question for Eliran (T2)
One stop only, the money stop after the free preview (plan §10 question 5, the default the plan was written to). Say otherwise before the card starts.

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

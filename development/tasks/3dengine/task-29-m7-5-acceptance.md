# Card 29 — milestone 7.5 · Acceptance against the reference
<!-- board: 3dengine · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 7.5 · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** main session, with `habait-ux-judge` and `compliance-warden` · **Model:** opus · **Ruling tier:** T1
**Runs as:** the main session runs the flow; the two reviewers are fresh spawns.
**Stage:** 7 · הסיור · **Kind:** קבלה (acceptance) · **Closes in build phase:** E6 · **Cost:** בתקרה שתאושר
**Depends on:** card 28 (milestone 7.4) is closed.
**State:** `PLANNED`

## The milestone (plan §7.1, word for word)
- **אבן דרך:** קבלה מול הרפרנס
- **מה עושים:** ה-PDF של 846 דרך ממשק הסוכן, מקצה לקצה; שיפוט מול הרפרנס ובדיקת ציות
- **מוכן כאשר:** §11 מתקיים במלואו
- **נשען על:** `habait-ux-judge`, ‏`compliance-warden`

## Files it creates or changes
In the working folder `C:\RnD\.wt\3dengine\`, under `Projects/3Dengine/` (expected; a change of this list is logged in the card when the work starts):
- evidence only: `development/tasks/3dengine/logs/7.5/`

## Instructions
No new code is expected. Run the whole flow from the agent's UI and judge the result against the reference; every defect reopens the card that owns it, in the same working folder.

Plan §11, items 1–9, each with its evidence path.

## Acceptance criteria (the gate, plan §7.2)
1. **The closing test passes:** the «מוכן כאשר» line above, written as the runnable test `tests/milestones/m7.5.test.mjs`.
2. **Unit tests** exist for every function this card adds or changes.
3. **Every earlier card still passes:** `npm test` runs the whole suite.
4. **Test coverage is at least 80 %** of the lines of the engine's own code that this card adds or changes; the run fails under the bar. The summary is saved in `development/tasks/3dengine/logs/7.5/`.
5. **Closed properly:** commit on the branch `3dengine`, merge into the local `main`, a sync-context pass, the memory entry, the milestone log row in plan §7.2, the progress line on the plan page, and this card's State set to `DONE`.
6. **Eliran answered the question below** before the part it guards started.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 node --test tests/milestones/m7.5.test.mjs && timeout 300 npm test` → both commands exit 0, and `npm test` reports line coverage of at least 80 %.
**Reviewer scope:** Two fresh reviewers, each prompted to refute: `habait-ux-judge` on the frames against the reference tour (same rooms, same viewpoints, no gap a buyer would notice), `compliance-warden` on the originals, the disclosure and the source row of every picture. The reviewer is fresh (Sonnet), never the author, and is prompted to refute; a FAIL reopens this card in the same working folder.

## Question for Eliran (T1)
A full paid run from the agent's UI, inside the cap approved at card 16. Needs both keys.

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

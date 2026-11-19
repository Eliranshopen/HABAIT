# Card 17 — milestone 5.1 · One room in the AI look
<!-- board: 3dengine · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 5.1 · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** genai-look · **Model:** opus · **Ruling tier:** T1
**Runs as:** the main session, in the `genai-look` role (the project agents do not load in a session started at `C:\RnD`; definition: `Projects/Habait/.claude/agents/genai-look.md` in the working folder).
**Stage:** 5 · מראה AI · **Kind:** קיים (prove existing code) · **Closes in build phase:** E2 · **Cost:** מ-$0.61
**Depends on:** card 16 (milestone 4.3) is closed.
**State:** `PLANNED`

## The milestone (plan §7.1, word for word)
- **אבן דרך:** חדר אחד
- **מה עושים:** החדר הראשי: prompt מלוח החומרים ומהתכנית, ה-CG כתמונה 1, תמונת הסגנון; יצירה ושער
- **מוכן כאשר:** תמונה אחת PASS עד 1%, עם שורות ב-ledger
- **נשען על:** `make-skin-prompts.mjs`, ‏`gen-pano.mjs`, ‏`close-seam.mjs`, ‏`fidelity-gate.mjs`

## Files it creates or changes
In the working folder `C:\RnD\.wt\3dengine\`, under `Projects/3Dengine/` (expected; a change of this list is logged in the card when the work starts):
- `engine/proofs/skin-one-room.mjs`
- `tests/milestones/m5.1.test.mjs`

## Instructions
Run the EXISTING tool, unchanged, inside the engine home on apartment 846. Record the measured number and compare it with the number in the plan row. Leave behind a repeatable proof script and a test that asserts the result from the evidence the run wrote. Change a ported file only if the proof fails: every such change is listed in `pipeline/PORT-CHANGES.md` and enters the coverage scope.

Ledger row BEFORE the call, dry-run first (root §7).

## Acceptance criteria (the gate, plan §7.2)
1. **The closing test passes:** the «מוכן כאשר» line above, written as the runnable test `tests/milestones/m5.1.test.mjs`.
2. **Unit tests** exist for every function this card adds or changes.
3. **Every earlier card still passes:** `npm test` runs the whole suite.
4. **Test coverage is at least 80 %** of the lines of the engine's own code that this card adds or changes; the run fails under the bar. The summary is saved in `development/tasks/3dengine/logs/5.1/`.
5. **Closed properly:** commit on the branch `3dengine`, merge into the local `main`, a sync-context pass, the memory entry, the milestone log row in plan §7.2, the progress line on the plan page, and this card's State set to `DONE`.
6. **Eliran answered the question below** before the part it guards started.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 node --test tests/milestones/m5.1.test.mjs && timeout 300 npm test` → both commands exit 0, and `npm test` reports line coverage of at least 80 %.

## Question for Eliran (T1)
A paid call: from $0.61 for one room. Needs the key `FAL_KEY` (by name) and your cap for this card. Default: stop and ask.

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

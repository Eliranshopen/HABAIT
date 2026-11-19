# Card 08 — milestone 2.1 · Render as an engine stage (one room checked first, tested on two)
<!-- board: 3dengine · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 2.1 · created: 2026-11-16 · merged 2026-11-17 with cards 09 and 10 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role; the scene and render chain is the `blender-scene` role's ground, named here as the second role of one card (the project agents do not load in a session started at `C:\RnD`; definitions: `Projects/Habait/.claude/agents/engine-builder.md` and `blender-scene.md` in the working folder).
**Stage:** 2 · Blender: בנייה ורינדור · **Kind:** לכתוב (new code), with a proof of the existing chain on one room first · **Closes in build phase:** E3 · **Cost:** $0
**Depends on:** card 07 (milestone 1.4) is closed.
**State:** `EXECUTING` — since 2026-11-19: task cards in `m2.1/` (nine tasks); the contract will be `Projects/3Dengine/contracts/CONTRACT-2.1.md`.

**Merged card.** Eliran, 2026-11-17: he asked whether rendering apartment 846 is needed while the goal is to build the engine («זה יגזול ממך זמן ומשאבים»), proposed one room instead of the whole apartment, and answered «כן» to making the three render milestones one. This card is what cards 08 (one room rendered), 09 (the whole apartment) and 10 (render as an engine stage) were. The hand run of the whole apartment is dropped; what it measured (11 rooms, the furnishing audit, the time against 859 s) is measured at card 11 (milestone 3.1), where the engine renders the apartment itself. The file name keeps its first slug so that older pointers still land here.

## The milestone (plan §7.1, word for word)
- **אבן דרך:** רינדור כשלב במנוע
- **מה עושים:** **קודם בדיקה על חדר אחד:** מהתכנית של 846, ‏`apartment` → `casework` → `cameras` → `furnish` → `render` לנקודה אחת (`--render-points`), בבית המנוע. **אחר כך השלב עצמו:** Blender אחד בכל רגע (נעילה), שורת manifest לכל חדר עם hash הקלט, המשך מהחדר הבא; נבדק על שני חדרים
- **מוכן כאשר:** `pano.webp`, ‏`depth.png` ו-`pano.render.json` לסלון; הריגה באמצע רינדור של שני חדרים ואז המשך לא מרנדרת שוב את החדר שהסתיים; ריצה חוזרת על אותו קלט מדלגת על הכול; רינדור חוזר של חדר אחד נותן אותה תמונה
- **נשען על:** `run-project.mjs` (`stepApartment` עד `stepRender`), ‏`render_tour.mjs`; ‏`withLock` ו-`HABAIT_BLENDER_LOCK`; ה-resume לפי נקודה של `render_tour.mjs`; ‏`probe/check-determinism.py`

## Files it creates or changes
In the working folder `C:\RnD\.wt\3dengine\`, under `Projects/3Dengine/` (expected; a change of this list is logged in the card when the work starts):
- `engine/proofs/render-one-room.mjs` — the one-room check of the existing chain
- `engine/stages/scene.mjs`, `engine/stages/render.mjs` — the stage
- `tests/unit/render.*.test.mjs`, `tests/milestones/m2.1.test.mjs`

**Changed when the work started (2026-11-19, main session; reasons in `m2.1/README.md`):** the closing test is `tests/stages/m2.1.test.mjs` (the stage tier: it runs real Blender), not `tests/milestones/m2.1.test.mjs`; the stage files are the existing `engine/stages/building.mjs` and `rendering.mjs` (not `scene.mjs` / `render.mjs`), with the wrappers `engine/build.mjs`, `engine/render.mjs`, `engine/workspace.mjs` and `engine/blender-lock.mjs`; the Check below is the gate of `m2.1/task-07-gate.md`.

## Instructions
First run the EXISTING chain, unchanged, inside the engine home on ONE room of apartment 846, and keep the proof script and its evidence: this is the check that the new home renders at all. Then write the engine's own stage around the ported tools (wrap them, never fork them): one Blender at a time, a manifest row per room with the hash of its inputs, resume from the next room. Test the stage on TWO rooms: one that finished and one that was killed. Do not render the whole apartment in this card. Change a ported file only if the proof fails: every such change is listed in `pipeline/PORT-CHANGES.md`. CLI entry points follow the script contract (root §5).

One Blender at a time, under the lock named by `HABAIT_BLENDER_LOCK` (root §12). Another session may hold it: wait, never take it.

## Acceptance criteria (the gate, plan §7.2)
1. **The closing test passes:** the «מוכן כאשר» line above, written as the runnable test `tests/milestones/m2.1.test.mjs`.
2. **Unit tests** exist for every function this card adds or changes.
3. **Every earlier card still passes:** `npm test` runs the whole suite.
4. **Test coverage is at least 80 %** of the lines of the engine's own code that this card adds or changes; the run fails under the bar. The summary is saved in `development/tasks/3dengine/logs/2.1/`.
5. **Closed properly:** commit on the branch `3dengine`, merge into the local `main`, a sync-context pass, the memory entry, the milestone log row in plan §7.2, the progress line on the plan page, and this card's State set to `DONE`.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 node --test tests/milestones/m2.1.test.mjs && timeout 300 npm test` → both commands exit 0, and `npm test` reports line coverage of at least 80 %.

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

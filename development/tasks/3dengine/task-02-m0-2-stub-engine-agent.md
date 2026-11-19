# Card 02 — milestone 0.2 · A stub engine connected to the agent
<!-- board: 3dengine · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 0.2 · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T1
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`; definition: `Projects/Habait/.claude/agents/engine-builder.md` in the working folder).
**Stage:** 0 · בסיס, לפני השלבים · **Kind:** לכתוב (new code) · **Closes in build phase:** E1 · **Cost:** $0
**Depends on:** card 01 (milestone 0.1) is closed.
**State:** `DONE` — closed 2026-11-16: the gate passed in three repos, end-to-end 51 assertions, one real conversation through Pi's model, fresh reviewer PASS, sync-context run. Task cards and findings: `m0.2/README.md`; contract: `Projects/3Dengine/contracts/CONTRACT-0.2.md`; evidence: `logs/0.2/`.

## The milestone (plan §7.1, word for word)
- **אבן דרך:** מנוע דמה מחובר לסוכן
- **מה עושים:** 8 כלי ה-MCP על מנוע שמחזיר את הסיור הקיים של 846 אחרי התקדמות מדומה; רישום ב-Pi; הגשר מפיק `progress`, כרטיס אישור וכרטיס תוצאה
- **מוכן כאשר:** מעלים PDF בממשק ורואים התקדמות, אישור, וכרטיס תוצאה שפותח את סיור 846
- **נשען על:** `.wt\deploy-P-7\tour`

## Files it creates or changes
In the working folder `C:\RnD\.wt\3dengine\`, under `Projects/3Dengine/` (expected; a change of this list is logged in the card when the work starts):
- `mcp/` — the MCP server (stdio), the 8 tools, the stub engine that returns the existing 846 tour
- `contracts/` — the job and result shapes the tools return
- `tests/unit/mcp.*.test.mjs`, `tests/milestones/m0.2.test.mjs`
- outside `C:\RnD`: the Pi registration in `C:\pi-main\habait`, and the bridge + the three cards (progress, approval, result) in `C:\HABAIT-Agent-UI` — this part runs in the `platform-dev` role

## Instructions
Write the engine's own code (`engine/`, `mcp/`, `contracts/`) with unit tests. Wrap the ported pipeline tools, never fork them. CLI entry points follow the script contract (root §5): dry-run by default, `--go` only inside the estimate, idempotent, non-zero exit with a reason code.

Kept as one card on purpose (see the README): the engine side is `engine-builder`, the agent side is `platform-dev`. Never open `.env`, `auth.json`, `bridge\state` or `bridge\sessions` in the agent repos.

## Acceptance criteria (the gate, plan §7.2)
1. **The closing test passes:** the «מוכן כאשר» line above, written as the runnable test `tests/milestones/m0.2.test.mjs`.
2. **Unit tests** exist for every function this card adds or changes.
3. **Every earlier card still passes:** `npm test` runs the whole suite.
4. **Test coverage is at least 80 %** of the lines of the engine's own code that this card adds or changes; the run fails under the bar. The summary is saved in `development/tasks/3dengine/logs/0.2/`.
5. **Closed properly:** commit on the branch `3dengine`, merge into the local `main`, a sync-context pass, the memory entry, the milestone log row in plan §7.2, the progress line on the plan page, and this card's State set to `DONE`.
6. **Eliran answered the question below** before the part it guards started.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 node --test tests/milestones/m0.2.test.mjs && timeout 300 npm test` → both commands exit 0, and `npm test` reports line coverage of at least 80 %.

## Question for Eliran (T1)
This card edits two repos outside `C:\RnD` (`C:\HABAIT-Agent-UI`, `C:\pi-main\habait`). Default: a branch in each repo, no push. Say otherwise before the card starts.

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

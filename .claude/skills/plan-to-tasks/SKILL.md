---
name: plan-to-tasks
description: "Turn one APPROVED plan in development/plans/ into a board under development/tasks/<slug>/: cards matched to the right agents (harness or project), standing rails, ruling tiers, gates, final QA cards, the table rows, the local commit. Explicit only: /plan-to-tasks <plan-path>."
argument-hint: <path-to-plan-file>
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

# /plan-to-tasks — one approved plan → one board

Lean contract (2026-11-04, plan `development/plans/2026-11-04-workflow-cleanup.md`). Step numbers are kept stable because other files point at them. The full previous text, with the history of every step, is [references/full-spec-2026-11-04.md](references/full-spec-2026-11-04.md).

**Inputs:** the plan path `$ARGUMENTS` · agents (Step 1) · output `development/tasks/<slug>/`.

## Step 1 — Discover the agents, by the board's target
- **Harness board** (the work is in `C:\RnD` outside `Projects\`): `.claude/agents/*.md`.
- **Product board** (the work changes `Projects\Habait\`): the 7 project agents in `Projects/Habait/.claude/agents/*.md` (engine-builder, platform-dev, blender-scene, genai-look, cloud-render, qa-reviewer, corpus-and-docs), plus the root's `habait-deploy-qa`, `habait-ux-judge` and `compliance-warden` for deploy QA, UX review and the disclosure gate. The project agents do not load in a session started at `C:\RnD`, so the card says how each one runs: either **the main session in that role**, or **a fresh `general-purpose` spawn given the definition file as its brief** (the practice of boards transition-rise and hold-building-tour).
- Read every definition's frontmatter: `name`, `description`, `model`, `tools`, `status`, `charter`, `boundary`. `status: live` is the pool. `dormant` only with one line in the card naming the missing capability. Agents under `C:\RnD\archive\agents\` are never assigned: a plan that needs one is reviving a retired capability, so ask Eliran.
- A definition whose frontmatter does not parse does not exist to the Agent tool. Report it, never route around it.

## Step 2 — Read the plan
The plan must be **APPROVED**: its row in `development/plans/CLAUDE.md` or its header comment carries Eliran's words. If not, stop and say so. Extract the goal, phases, steps and dependencies, the done-when, the risks, the budget ($0 unless the plan names one, root §7).

## Step 3 — Match tasks to agents
One card = one agent = one domain; split multi-domain steps. Match on `charter:` and `boundary:` first, `description:` second.

## Step 4 — Create a missing agent (conservatively)
Only when no existing agent covers the charter (check `docs/agent-team-org-chart.md`). The file follows `.claude/agents/_TEMPLATE.md`: nine frontmatter keys (`name`, a double-quoted `description`, `model` sonnet|opus, `tools`, `color`, `status: live`, `owner-track`, `charter`, `boundary`), the memory contract pasted from `.claude/agents/_MEMORY_PREAMBLE.md`, and ⛔ never `Agent` in `tools:` (root §10.2). A product capability goes to `Projects/Habait/.claude/agents/`, not the root.

## Step 5 — Write the board
`development/tasks/<slug>/`:
- `README.md`: header comment (`created · plan · coordinator · owner`), **Goal**, `**State:** \`PLANNED\`` (the one state source: `scripts/board_state.py` checks both tables against this line), **Working folder**, **Key state** (resume point, filled as work runs), **Cards** table (`# · File · Card · Agent · model · tier · State`), **Waves**, **Gates**, **Standing rails** (Step 8, verbatim).
- `task-NN-<slug>.md`: agent · model · tier, the files it creates or changes, self-contained instructions, testable acceptance criteria, a `Check:` and `Reviewer scope:` for any gate (Step 11), and the standing rails.
- `run-tasks.md`: the order, how to resume, the post-card checklist (`/close-task`).
- **Working folder (root §8.7):** a product board's first card opens the feature worktree `git -C C:/RnD worktree add C:/RnD/.wt/<slug> -b <slug>` (one repo since 2026-11-04) (procedure: `.wt/CLAUDE.md`). Its last build card merges `<slug>` into `main`, on Eliran's word when the plan says so. A harness board has no folder. Never push.

## Step 6 — Report
What was created; every card's agent, `status`, track, model pin and tier; any dormant assignment and why; any agent minted; the wave plan; that the board is committed (Step 12).

## Step 7 — Retire what you minted (at board close, not now)
An agent minted for this board that will not be reused: set `status: archived` (the file never moves), shelve `memory/agents/<name>.md` into `memory/agents/_ephemeral/` (create the folder on first use; never delete a memory file), and repoint its INDEX lines in the same change. Before archiving, grep the name across `.claude/`, `development/tasks/`, `docs/` and `memory/`. Dormant is not retired.

## Step 8 — Standing rails (paste verbatim into the README and every card)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block), then `memory/listings/<id>.md` only if the task names a listing. ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** at write time, name which OTHER actor must know this; append ONE pointer line into each named actor's `memory/agents/<name>.md` — `→ see <entry> — why it binds you`. No affected actor = say "none".
4. **An action is not done until its memory is written.**
5. **Ruling tier** — every brief carries its own `T0` / `T1` / `T2`.
6. Root `CLAUDE.md` §2, §8.7, §12: work only in the board's working folder; `timeout` on every run, one heavy run at a time, foreground; never open a `.env`; the plan's budget or $0; no deploy without Eliran's own go for that deploy (§9).

The contract is root `CLAUDE.md` §0 and `memory/README.md`: quote them, never restate them.

## Step 9 — A ruling tier on every card
`**Ruling tier:** T0 | T1 | T2`, set when the card is written.
- **T0:** the agent decides and logs it. Reversible, one lane, no money, nothing a buyer sees.
- **T1:** one question to Eliran, the options named, a default stated. For a choice that binds another lane, changes a record's shape, or spends money.
- **T2:** the question plus a fresh-context refuting check (Step 11). For payments, auth, migrations, legal.
Raising a tier mid-task is logged; silently lowering one is not allowed.

## Step 10 — WIP check, before Step 5 writes anything
Count rows, never folders, in `development/tasks/CLAUDE.md`'s board table whose State cell starts with `EXECUTING`, `IN-PROGRESS` or `LIVE`, and name them. **At 3, stop** and ask Eliran which closes first. Only his explicit override in the request lifts it, and the README records that.

## Step 11 — Gates: a runnable check and a narrow reviewer
Every gate card has `Check:`, one runnable pass/fail command with its expected result (never "looks right"), and `Reviewer scope:`, one narrow line. The reviewer is a **fresh Sonnet sub-agent prompted to refute**, never the author. The check runs in Git Bash as `timeout N <cmd>` (root §12). A FAIL reopens the authoring card in the same working folder, never a sibling.

## Step 12 — Register and commit the board
1. Add the board's row to `development/tasks/CLAUDE.md` (State = the README's word). Point the plan's row in `development/plans/CLAUDE.md` at `../tasks/<slug>/`, with its State cell starting with the same word.
2. `python scripts/board_state.py` must print `CLEAN`.
3. `git add development/tasks/<slug>/ development/tasks/CLAUDE.md development/plans/CLAUDE.md`, then one commit naming the slug (local `main`, root §8.7). ⛔ Never `git add -A`; never push. Prove it: `git ls-files development/tasks/<slug>/` lists the files.
4. A blocked commit → an OWED row in `docs/governance/OWED.md` in the same turn (Owner never blank), and the exact command handed to Eliran.

## Step 13 — One-board personas write to `_ephemeral/` from their first entry
An agent minted for this board only names `memory/agents/_ephemeral/<name>.md` as its memory file from its first write, and its INDEX lines point there. The card says which it is; silence means `_ephemeral/`. A standing agent is never demoted here; only Step 7 retires.

## Step 14 — Model pins
Every card and every minted definition names its model. `sonnet` reads, verifies, counts and refutes; `opus` drafts, authors and judges. ⛔ Never `inherit`.

## Step 15 — Five workers per burst (D-AUD-36)
At most five workers run in parallel from one session. Larger waves run in bursts, each one launched after the previous returns. A board past one session is filed as two, with the resume point in Key state first. Every brief says what it has already written, so a dead worker is resumed (`SendMessage`) or relaunched with the same brief. Until `agent-model-guard.ps1` is installed, this step is the only bound: say so in the report.

## Step 16 — Every board ends with QA cards (Eliran 2026-11-03, root §8.9)
- After the last build or merge card comes nothing but QA; a "close" card is never last.
- **QA on the result where it lives:** after the merge, the live `main` (the project's tests, the live preview, nothing outside scope changed). A harness board checks the finished artifact. Reviewer: a fresh `qa-reviewer` (sonnet), never an author on the board.
- **QA on the deployed site** when the work reaches a deploy: `habait-deploy-qa` (sonnet), the headless-Chrome paint proof on every alias. Filed `BLOCKED (deploy go)`; it never deploys and never asks for the deploy.
- Every QA card carries Step 11's lines and the standing rails. The board becomes `CLOSED` only when the last QA card passes. Its run entry, HOT and both table rows are written then (`/close-board`).
- ⛔ A board without final QA cards is not filed.

## Rules
1. Discover the agents first, by target (Step 1). 2. Match by `charter:`/`boundary:`. 3. One card = one agent = one domain. 4. Mark dependencies and waves. 5. Mint agents only when nothing fits (Step 4). 6. Every card is self-contained, lists its files, and has testable acceptance criteria. 7. Prefer `live`; never assign an archived agent. 8. Retire what you minted (Step 7). 9. Five workers per burst (Step 15). 10. QA cards come last (Step 16). 11. One state source: the README's `**State:**` line; the tables mirror it (`scripts/board_state.py`).

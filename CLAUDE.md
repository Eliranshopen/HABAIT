# C:\RnD — the Habait R&D harness
<!-- last-updated: 2026-11-04 -->

**Owner and single authority: Eliran Shopen, head of R&D.** Every go, ruling, paid call, deletion, deploy and install in this repo is Eliran's act. The harness (inherited as 28 sub-agents and 54 skills, focused on 2026-11-03 to 10 agents and 33 skills for habait-walkaround + Video — `development/plans/2026-11-03-harness-focus.md`; the context files and lints) was inherited from
the previous CTO's setup on 2026-11-03, re-attributed to Eliran and started clean: no product code, no memory, no boards yet. The rulings that were baked into the prompts are collected once in `docs/INHERITED-DECISIONS.md` — they stay in force until Eliran changes them.

Operator language toward Eliran: the language he writes in (main session on Eliran's delegation, 2026-11-03; OWED-015). Product language: Hebrew (RTL) first, English second.

## §0 Collective memory — read first, write last (the contract)
The memory is the department's only durable record between sessions; the chat transcript is not. It lives in `memory/` and is **updated as development progresses** — not at the end of a project, but at the end of every task, every decision and every board.

### 0.1 The memory folder
The layer table (path · holds · written by · when) lives in `memory/README.md`, section "Layer table with the When column" (moved from here 2026-11-04, word for word). `memory/HOT.md` is regenerated at every `/close-board` and `/sync-context`.

### 0.2 The rules — every session and every sub-agent
1. **Before acting** read `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` plus its archive-index block, and `memory/listings/<id>.md` only when the task names a listing. This read is **bounded read-first**: never `memory/INDEX.md` whole, never a whole layer — grep.
2. **Before returning** append ONE entry (`memory/_TEMPLATE.md`) to the layer that owns the fact, plus ONE ≤ 400-char pointer line in `memory/INDEX.md` under that layer's existing header (never add a header). Name the **second reader** — the other actor who must know this — and add one pointer line to their file, or say "none".
3. **An action is not done until its memory is written.** A sub-agent's return message without a memory entry is an unfinished task; the main session sends it back.
4. **Update as development progresses.** The main session writes to memory at these moments, not later: a decision by Eliran (→ `project/`, and `docs/INHERITED-DECISIONS.md` if it changes an inherited row); a fact proven by evidence (→ `project/`); a task finished (→ `agents/<name>.md` by the agent); a board closed or a build shipped (→ `runs/`); anything every actor must know next session (→ `HOT.md`, regenerated). At the end of every session the main session re-reads `HOT.md` and makes it true.
5. **Never invent.** Every memory line is grounded in a file, a screenshot, a manifest row or a register row that exists. Prune, relink and correct are allowed; fabricating a fact is not.
6. **Secrets never enter memory** — names only (§8.1).
7. **Size discipline.** `HOT.md` ≤ 60 lines; INDEX lines ≤ 400 chars; a live `agents/<name>.md` over 200 KB rotates onto its month shelf (`agents/<name>.<YYYY-MM>.md`) with an archive-index block left in the live file and the INDEX lines repointed in the same change. ⛔ Never delete a memory file.
8. **Two memory systems, both kept true.** The repo memory above is the team's. Claude Code's own auto-memory (`~/.claude/projects/C--RnD/memory/`, index `MEMORY.md`) holds what Claude needs about Eliran and this project across sessions; `/sync-context` reconciles both.

Layer table and rotation procedure: `memory/README.md`; this §0 is the contract and every other copy points here. The ≤ 12-line block every agent definition carries is `.claude/agents/_MEMORY_PREAMBLE.md`; `memory/CLAUDE.md` is the folder's own context file.

## §1 What's here
The root layout table (path · what · state as of 2026-11-03: `CLAUDE.md`, `.claude/`, `scripts/`, `archive/`, `docs/`, `memory/`, `development/`, `Projects/`, `Habait/MVP/`, `video/`, `listings/<id>/`, `3D/`, `360walkaround/`, `.wt/`, `.vscode/`, `.claude/hooks/`, `screenshots/`) lives in `docs/CLAUDE.md`, section "Root layout table (root §1)" (moved from here 2026-11-04, word for word).

A folder marked "not created yet" is where an agent will build it. The agents' paths were kept on purpose, so the layout is already decided; an agent that finds its folder missing says so and stops instead of guessing.

## §2 Hard rules — deterministic or it doesn't ship
- Same inputs → same outputs. Every pipeline step writes its artifact to disk plus a `manifest.json` row (inputs, content hash, cost) before it reports done.
- Verify, then trust: a claim without its evidence path is not done. A curl 200 does not prove a browser will paint — headless Chrome plus the real network request is the proof (`habait-deploy-qa`).
- Bounded everything: one heavy process at a time under `timeout` (§12), under budget (§7), under the memory read limits (§0).
- Nothing is deleted to make a number look better: relocate with a stub, or report and stop.

## §3 Hand-prove before you automate
A new flow is run by hand once — the main session, step by step, evidence on disk — before a skill or an orchestrator wraps it. The orchestrator skills (`studio`, `studio-v2`) were built last for this reason. A skill's existence is not licence to skip the proof.

## §4 Listing folder convention
One listing = `listings/<id>/` with `manifest.json`, `originals/` (read-only, never altered), `staged/`, `clips/`, `components/`, `output/`, `qa/`. `/new-listing` scaffolds it; every worker writes only inside its own listing.

## §5 Script contract
Every script under `scripts/` or a track's `toolkit/`: dry-run by default; the paid path only behind an explicit `--go`; idempotent on retry (a manifest checkpoint means a clean step is never redone or re-billed); writes its outputs plus a manifest row; exits non-zero on any failure with the reason on stderr.

## §6 Honesty and legal — add-only, disclosure, escalate
- **Add-only on real property footage.** Décor only; never alter walls, windows, views or geometry; never hide damage; never invent rooms. Originals are retained untouched.
- **Disclosure is structural.** Every AI-made or AI-altered image of a property, unit or person carries the bilingual *הדמיה · AI-generated* badge; generated brand atmosphere is never captioned as a real project, address or unit.
- **Grounded agent.** The product agent answers only from tool data; replay theater always shows the "שחזור הדגמה" badge.
- **Eliran's calls, never a sub-decision:** cost, legal and disclosure wording, the locked style, anything liability-sensitive. Present the options, flag it, wait.
- **Navigator-mode** for everything else inside your mandate: pick the recommended path, log it for Eliran's audit, keep moving.

## §7 Spend gating
- Every paid call (fal.ai, Veo, Gemini, OpenRouter, HeyGen, Apify, cloud GPU) is ledgered BEFORE it runs; dry-run first; `--go` only inside the brief's estimate.
- Manifest checkpoints: a retry never re-bills a step that already succeeded.
- Soft cap = stop and tell Eliran. Hard cap = never crossed without Eliran's new ruling. Defaults: $10 soft / $20 hard per video (D-VID-2); $10 soft / $15 hard per render batch; evals always with `--budget`.

## §8 Conventions
1. **Secrets.** Values live only in `.env*` files and the vendor consoles; names live in `docs/governance/SECRETS-LEDGER.md`. A value that reaches a chat transcript, a task file, a commit or `memory/` is **burned**: file it with `secrets-steward` and rotate. Never print, echo or paste a value. (`secrets-steward` holds no Bash by construction.)
2. **The classifier law.** A delete-shaped command that trips the auto-mode safety classifier is correct behaviour, not an obstacle: hand the exact command to Eliran (the `!` prefix runs it in-session) and stop. Never split, alias or route around it.
   **Deploys (Eliran, 2026-11-04):** after his own go for that deploy (§9) the main session runs it itself; procedure `memory/project/2026-11-04-deploy-run-by-session.md`.
3. **House voice.** Terse, navigational, honest. Say what was done, what was verified, what is owed. Hebrew microcopy in the product keeps the house tone.
4. **Skills.** The register is `docs/skill-taxonomy.md`; the map is `.claude/skills/CLAUDE.md`. Model-invocable skills keep `SKILL.md` ≤ 150 lines (detail in `references/`); anything that writes a register or runs a heavy command is explicit-only (`disable-model-invocation: true`). Never extend `skills-lock.json` by hand.
5. **Registers.** `docs/governance/` holds the registers: secrets, owed and ships are live; worktrees frozen until re-pointed to `C:\RnD`'s git worktrees (§8.7). A register row is a fact with its evidence path; it is never permission to act.
6. **A context file in every folder (Eliran, 2026-11-03).** Every folder under `C:\RnD` — the harness and every project, present and future — carries a `CLAUDE.md`. The only folders without one are vendor and build output: `node_modules/`, `.git/`, `__pycache__/`, venvs, the portable Blender bundle, `dist/`, `build/`, `.next/`, `.cache/` — and the working folders under `.wt/`, whose copies carry the live files' context files, and dated backup/archive copies (`*-backup-YYYY-MM-DD`, `*-archive-YYYY-MM-DD`; 2026-11-04). A new folder gets its file in the same change that creates it.
   Generator, `--check` / `--apply` and the generated-file rules: `.claude/skills/CLAUDE.md`, section "Context-file generator (root §8.6 detail)" (moved from here 2026-11-04).
7. **A working folder only for project changes — not for the harness, not for every action; local git on `main` (Eliran, 2026-11-03 / 2026-11-04).** When Eliran opens a change or update to a project under `Projects\` (a board in `development/tasks/`, or work he names and hands over to be carried out), that task runs in its own folder `C:\RnD\.wt\<name>` (flat, named after the board or task slug), never directly in the live project files.
   **Nothing else gets a folder** (Eliran, 2026-11-03: "i dont need wt for code only wt for changes or updates i do for the peoject"). Harness work (this file, `.claude/`, `docs/`, scripts, context files, `/sync-context`), questions, reads, reviews and checks are done straight in the live files with no `.wt\` folder. If it is unclear whether a request changes the project, ask Eliran; don't open a folder by default.
   **One folder per task, not per fix** (Eliran, 2026-11-03): fixes and follow-ups go into the task's own folder, never a sibling — detail in `.wt/CLAUDE.md`.
   Procedure (use `scripts/wt.py`, Open, Close, memory and register rows, VS Code): `.wt/CLAUDE.md`, section "Rule §8.7 procedure" (moved from here 2026-11-04, word for word).
   **Local git on `main` (Eliran, 2026-11-04; replaces the 2026-11-03 "no git").** Identity set (§11). **One repo**, `Projects/Habait` included (`de560da`). **A new feature = a git worktree off `main`** (Eliran: "כל מה שרציתי זה שתהיה האפשרות לWORKTREE ככה שאוכל לעבוד על פיצרים בנפרד ולא על הMAIN"): `git -C C:/RnD worktree add C:/RnD/.wt/<feature> -b <feature>`, merged into `main` when done. Never push. Procedure, `.gitignore`, the older plain-copy folders and what stays suspended: `.wt/CLAUDE.md`.
8. **Every plan lives in `C:\RnD\development\plans\` (Eliran, 2026-11-03: "every plan that we are creating has to be in the plans folder in the development folder").** Every new plan — written by the main session, a sub-agent or a skill, for the harness or for any project under `Projects\` — is a file `development/plans/YYYY-MM-DD-<slug>.md`, and its row is added to the table in `development/plans/CLAUDE.md` in the same change. A plan that exists only in a chat, in Claude Code's private plan file (`~/.claude/plans/`), in a project folder or in a working folder does not count as written.
   Plan mode, plan-vs-working-folder and the plan-of-record files: `development/plans/CLAUDE.md`, section "Rule §8.8 detail" (moved from here 2026-11-04).
9. **Every board ends with QA cards (Eliran, 2026-11-03: "אני רוצה שהTASKS האחרונים יהיו TASK של QA … שכל פעם שיש פירוק תכנית למשימות אז יהיה בסוף גם משימות של QA").** Every board that `/plan-to-tasks` writes ends with QA cards, and nothing but QA comes after the last build or copy-back card:
   The four QA-card requirements: `development/tasks/CLAUDE.md`, section "Rule §8.9 — the QA cards" (moved from here 2026-11-04). In short: QA on the live result, then QA on the deployed site (blocked on Eliran's own deploy go); the board is `CLOSED` only when its last QA card passes.

## §9 Standing rails (verbatim — these lines are grep targets, do not reflow)
> **Standing rule reinforced: every prod deploy needs its OWN explicit go (a bug report ≠ deploy authorization — the auto-mode classifier correctly blocked a push made without asking).**

> **eval-golden.mjs run bare = full multi-model matrix (≈$2.5)** — always pass `--models/--runs/--budget` (it once drained the balance to −$0.13 mid-ship; topped up, gate re-run PASS, ≈$9.8 left)

> Standing: eval-buyer.mjs requires `--agent` + $0.50 wall

Inherited 2026-07-10 / 07-13 / 07-15, now Eliran's. A new rail is added here as one quoted line with its date.

## §10 Sub-agents
- **10.1** The roster is `docs/agent-team-org-chart.md`; the files are `.claude/agents/`; a new definition follows `.claude/agents/_TEMPLATE.md` and passes its lints.
- **10.2 The agent tree is exactly one level deep.** Sub-agents never spawn sub-agents; `orchestrator` alone holds the `Agent` tool. At most five workers run in parallel from one session (D-AUD-36).
- **10.3 Artifacts on disk are the handoff.** A sub-agent returns free text; the real result is the file it wrote plus its `manifest.json` row. The main session reads the manifest after every step.
- **10.4 Models.** `sonnet` for reading, verifying and mechanical legs; `opus` for drafting and judging; never `inherit`. A board may pin a model at the spawn.

## §11 Fill in when ready (Eliran's hand only)
| Item | Value today | Used by |
|---|---|---|
| Pinned git identity — author AND committer, GitHub noreply form with the numeric id | **`Eliran Shopen <eliran@habait.ai>`** — repo-local (`git config`, not global), set on Eliran's word 2026-11-04; first commit `8237f16`. A GitHub noreply form is decided only when a remote is named | `/ship`, `/worktree-ops`, `habait-deploy-qa`, `check-context.mjs` (`RND_GIT_IDENTITY`) — all suspended |
| `<github-org>/<harness-repo>` | **none** — local only by Eliran's word (2026-11-04: "כרגע אני עובד רק מקומי"); no remote, no push | `check-versions.mjs`, `habait-deploy-qa` |
| `<github-org>/<app-repo>` | **none** — no remote yet | `/ship`, `/run-eval`, `/worktree-ops`, `/close-board` |
| `<github-org>/habait-walkaround` | **none** — one repo since 2026-11-04 (`de560da`); the old product `.git` is archived at `C:\Habait-git-archive-2026-11-04` (`.wt/CLAUDE.md`) | `walkaround-porter` |
| Vercel project and the four host aliases | `habait.ai` · `www.habait.ai` · `app.habait.ai` · `<project>.vercel.app` | `habait-deploy-qa`, `/ship` |
| MCP servers (21st, refero, HeyGen, fal) | **opentakeoff** (`npx -y opentakeoff-mcp`, local config, Eliran 2026-11-04 — plan PDF takeoff: scale, `measure_polygon`, counts); 21st, refero, HeyGen, fal: none registered | `docs/OWNER-PASTE.md` |
| Hooks (`subagent-context.ps1`, `test-guard`, `agent-model-guard.ps1`) | not installed | `docs/OWNER-PASTE.md` |

The remote rows stay "none" until Eliran names a remote (git is local-only since 2026-11-04, §8.7). Until any other row is filled, the skill that depends on it reports the gap by name and stops; nothing guesses.

## §12 Machine resource rules
Every test, build, server, browser or render command runs in Git Bash as `timeout N <cmd>` (tests 300 s, build/typecheck 540, servers/sweeps/renders 540 per chunk, 1800 once `BASH_MAX_TIMEOUT_MS` is raised) with the tool timeout above N; one heavy run at a time; foreground only; kill what you start by PID; never sleep-poll a backgrounded run — stop it, kill its tree, re-run bounded once. Backed by the `test-guard` hook once installed; until then this line is the only rule.

## Context map
Every folder has a context file (§8.6). This table lists the **areas** — the hand-written context files of the harness and the project roots; the full list, one row per `CLAUDE.md` on disk, is the generated `docs/context-map.generated.md`. **Both directions hold** there: every context file on disk has a row (`.wt/` working folders excepted), every row points at a context file that exists; `/sync-context` runs `generate-cards.py --check` and refreshes both. Every context file carries the dated marker comment on line 2 (same form as line 2 of this file).

| Area | Folder | Context file | Purpose |
|---|---|---|---|
| Root | `/` | [`CLAUDE.md`](CLAUDE.md) | the contract every session and sub-agent inherits (this file) |
| Harness | `.claude/` | [`.claude/CLAUDE.md`](.claude/CLAUDE.md) | the Claude Code configuration tree: agents, skills, local settings, hooks |
| Harness | `.claude/agents/` | [`.claude/agents/CLAUDE.md`](.claude/agents/CLAUDE.md) | the 10 sub-agent definitions, the header standard and its lints |
| Harness | `.claude/skills/` | [`.claude/skills/CLAUDE.md`](.claude/skills/CLAUDE.md) | the 36 skills by group, the frontmatter standard |
| Harness | `.claude/hooks/` | [`.claude/hooks/CLAUDE.md`](.claude/hooks/CLAUDE.md) | guard hooks, not installed |
| Docs | `docs/` | [`docs/CLAUDE.md`](docs/CLAUDE.md) | the department's reference documents: inherited decisions, roster, skill register, owner paste |
| Docs | `docs/governance/` | [`docs/governance/CLAUDE.md`](docs/governance/CLAUDE.md) | the registers: secrets, owed and ships live; worktrees frozen |
| Memory | `memory/` | [`memory/CLAUDE.md`](memory/CLAUDE.md) | the collective memory (§0): layers, rules, size discipline |
| Work | `development/` | [`development/CLAUDE.md`](development/CLAUDE.md) | plans and boards |
| Work | `development/plans/` | [`development/plans/CLAUDE.md`](development/plans/CLAUDE.md) | one plan file per plan, `YYYY-MM-DD-<slug>.md` |
| Work | `development/tasks/` | [`development/tasks/CLAUDE.md`](development/tasks/CLAUDE.md) | the boards and the one board table (WIP authority) |
| Projects | `Projects/` | [`Projects/CLAUDE.md`](Projects/CLAUDE.md) | the product projects; how a Habait session starts (Q5) |
| Projects | `Projects/Habait/` | [`Projects/Habait/CLAUDE.md`](Projects/Habait/CLAUDE.md) | the Habait project's own context file: memory protocol, repo layout, commands |
| Projects | `Projects/Habait/.claude/agents/` | [`Projects/Habait/.claude/agents/CLAUDE.md`](Projects/Habait/.claude/agents/CLAUDE.md) | the project's 7 agents |
| Projects | `…/habait-walkaround/360walkaround/pipeline/` | [context file](Projects/Habait/habait-walkaround/360walkaround/pipeline/CLAUDE.md) | the deterministic Blender plan → pano pipeline |
| Projects | `…/habait-walkaround/Habait/tour360/` | [context file](Projects/Habait/habait-walkaround/Habait/tour360/CLAUDE.md) | the 360° apartment-tour system |
| Archive | `archive/` | [`archive/CLAUDE.md`](archive/CLAUDE.md) | out-of-scope agents and skills, moved not deleted; restore = move back |
| Scripts | `scripts/` | [`scripts/CLAUDE.md`](scripts/CLAUDE.md) | `wt.py` and `mem_entry.py`, the harness procedures as commands |
| Worktrees | `.wt/` | [`.wt/CLAUDE.md`](.wt/CLAUDE.md) | one working folder per project change Eliran opens (§8.7), never for harness work; a new feature = a git worktree of `C:\RnD` |

Folders not in this table still have a context file — generated (`generated-by` on line 3): the memory leaves, every `.claude/skills/<name>/` and its sub-folders, the board folders, and every folder of `Projects/Habait/` below its four hand-written context files. Only vendor and build output have none (§8.6). When `Habait/MVP/`, `video/`, `listings/`, `3D/`, or `360walkaround/` are created, their context files and area rows are added in the same change.

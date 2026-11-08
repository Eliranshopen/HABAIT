# Workflow cleanup — one state source, no stale git text, lean harness skills
<!-- filed: 2026-11-04 · main session · state: APPROVED 2026-11-04 (Eliran: "מאושר") · harness work, no board, no working folder except the one project file in step 3 -->

## The ask
Eliran asked for an architect's read of the workflow (research → plan → `/plan-to-tasks` → execution in `.wt` → close → `/sync-context`), the problems, a recommended workflow and the first three steps. Report given in the chat 2026-11-04; Eliran: "מאושר".

## What the read found (measured 2026-11-04)
- Git text contradicts itself: `memory/HOT.md` says settings deny git (removed 2026-11-04); `.wt/CLAUDE.md` says "No git" and `git.enabled: false` (`.vscode/settings.json` has `true`); `development/tasks/CLAUDE.md` says nothing is committed until an identity is set (it is set); `Projects/Habait/CLAUDE.md` opens with "No git… overrides every git instruction".
- One board's state lives in five places (plans table, board table, board README, HOT, runs) and they already disagree (plans table: platform-ui-ux EXECUTING vs board SHIPPED; transition-rise / apartment-3d / dollhouse-in-tour "not deployed" vs HOT "in production").
- `plan-to-tasks` exists twice (root 219 lines, `Projects/Habait/` 207 lines, the project copy still says "no git" and lacks Step 16); it names nine paths that do not exist (`orchestrator`, `docs/harness-upgrade-plan.md`, `qa-evidence/`, `MODEL-PINS.md`, `_ephemeral/README.md`, `_probe`, `studio-v2`, `Habait/MVP`, the dormant visualizer track) and discovers only the root's 10 agents while product work goes to the 7 project agents.
- `sync-context` is 473 lines and points at `docs/CONTEXT-FILE-STANDARD.md` and `GATE-NUMBER-REGISTER.md` (both missing), `Habait/MVP/app`, `Habait CRM`, `qa-evidence/`, `.claude/hooks/lint-bom.ps1`; its 1c contradicts root §8.6.
- Both skills write registers but are model-invocable and over 150 lines (root §8.4).

## Steps
1. **Stale-text sweep** (live files, harness work): fix the git lines above; bring the plans table and board table in line with the board READMEs; refresh the `.wt/` inventory; HOT line on deploys.
2. **One state source**: the board README's `**State:** \`WORD\`` is the source. `scripts/board_state.py` (dry-run / `--go`, root §5) checks both tables against it, lists boards with no row, rows with no board, plans with no row; `--go` rewrites only a leading state word. Hand-proven first: step 1 fixes the tables by hand, then the script must print 0 drift. Wired into `/sync-context` as Check 18 and into the two tables' conventions.
3. **Lean skills**: `plan-to-tasks` and `sync-context` rewritten to ≤ 150 lines, explicit-only, dead paths dropped; the full previous text kept verbatim in each skill's `references/` (never deleted). `plan-to-tasks` discovers agents by target (product board → `Projects/Habait/.claude/agents/`). The project copy becomes a pointer to the root skill (one project file → working folder `.wt/workflow-cleanup`, root §8.7). Registers updated: `.claude/skills/CLAUDE.md`, `docs/skill-taxonomy.md`.

## Not in this plan (Eliran's call)
- ~~Version control for the product code~~ — **ruled 2026-11-04 in a parallel session** while this plan ran: the product `.git` is live (baseline `35cc0f6`) and a new feature is a git worktree under `.wt\` (root §8.7, `.wt/CLAUDE.md`, `memory/project/2026-11-04-git-back.md`).
- Removing the closed `.wt/` folders (D11, his act).

## Progress (2026-11-04)
- Step 1 — **done in part:** both tables brought in line with the READMEs (platform-ui-ux, transition-rise, apartment-3d, dollhouse-in-tour, hold-building-tour); platform-ui-ux README `SHIPPED` → `CLOSED`; tasks/CLAUDE.md git line and the SHIPPED/CLOSED meaning. **Paused:** `.wt/CLAUDE.md`, `memory/HOT.md`, `Projects/Habait/CLAUDE.md` and root `CLAUDE.md` — a parallel session is rewriting their git text under the new worktree ruling (staged edits in the index); editing them now would collide.
- Step 2 — **done:** `scripts/board_state.py` (scratch test: injected drift → `--go` fixed → byte-equal to live). Live dry-run: 1 finding — board `exterior-film` (rnd-23) has no board-table row; rnd-23 told. Wiring into `/sync-context` as Check 18 waits with step 3.
- Step 3 — **paused**, then resumed once the worktree session committed (`cf40a4c`, `f707b30`, `9e3bca7`).
- **Finished (later 2026-11-04):** step 1 rest: `Projects/Habait/CLAUDE.md` git banner and rule 3 now match root §8.7; `.wt/CLAUDE.md` VS Code line. Step 3: `plan-to-tasks` 219 → 91 lines and `sync-context` 473 → 66, both explicit-only, step and check numbers kept, full old text in each `references/full-spec-2026-11-04.md`. `plan-to-tasks` discovers agents by target and uses the feature worktree. `sync-context` Check 18 = `board_state.py`. The Habait copy of `plan-to-tasks` is a pointer (working folder `.wt/workflow-cleanup`, closed; old text in `references/habait-copy-2026-11-04.md`). Registers: `.claude/skills/CLAUDE.md`, `docs/skill-taxonomy.md`. Checks: `board_state.py` CLEAN, `generate-cards.py --check` 0/0, `check-context.mjs` PASS (6 checks).
- **State: DONE.** Open: the commit (Eliran's word); removing `.wt/workflow-cleanup` (his act); re-pointing Check 16 to the product worktrees.

## Done when
`python scripts/board_state.py` exits 0; `generate-cards.py --check` prints 0 missing; both SKILL.md files ≤ 150 lines with `disable-model-invocation: true`; no live context file says "no git" for the harness; memory entry + INDEX line written.

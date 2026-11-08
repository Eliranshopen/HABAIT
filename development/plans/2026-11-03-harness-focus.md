# Harness focus — fit the harness to habait-walkaround + Video
<!-- created: 2026-11-03 · main session · Eliran: "אני רוצה שתחשוב ותקבל את ההחלטה הטובה ביותר עבור הHARNESS" -->

## Ask
Eliran asked for improvements to the harness, skills and workflows, set the scope ("habait-walkaround + וידאו"), then handed the remaining calls to the main session ("think and make the best decision for the harness"). Navigator mode: every pick below is logged here for his audit and is reversible (moves, never deletes, D11).

## What was found (measured 2026-11-03)
- 28 agents in `.claude/agents/`: 12 `habait-*` describe a chat+canvas MVP at `Habait/MVP/app`, which does not exist (OWED-009); 11 are dormant visualizer/agency/research. The real product is served by the 7 project agents in `Projects/Habait/.claude/agents/` (blender-scene, cloud-render, corpus-and-docs, engine-builder, genai-look, platform-dev, qa-reviewer), which overlap `render-pipeline-engineer` and `walkthrough-engineer`.
- 54 skills; 22 serve out-of-scope tracks, need git, or are off-stack (`docs/skill-taxonomy.md`).
- "No git" and "never open `.env`" are prose only; nothing enforces them (OWED-003, OWED-013 shows the cost).
- Two memories with no precedence (OWED-014); `Projects/Habait/memory.md` is 200 KB and its rule says read it whole every session.

## Decisions (main session, on Eliran's delegation)
| # | Decision | Why |
|---|---|---|
| H1 | **Archive, never delete**: out-of-scope agents and skills move to `C:\RnD\archive\{agents,skills}\` (outside `.claude/`, so Claude Code stops loading them). Restoring one = move it back. | smaller session context, no stale agents picked for real work; D11 respected |
| H2 | Agents kept (10): `capability-scout`, `codebase-cartographer`, `compliance-warden`, `secrets-steward`, `habait-brand-media`, `habait-deploy-qa`, `habait-ux-judge`, `video-producer`, `video-editor`, `video-qa`. Archived (18): `habait-agent-smith`, `habait-architect`, `habait-asset-wrangler`, `habait-be`, `habait-fe`, `walkaround-porter`, `workspace-steward`, `scraper`, `orchestrator`, `router`, `stager`, `video`, `visual-qa`, `viz`, `dashboard-composer`, `market-researcher`, `render-pipeline-engineer`, `walkthrough-engineer`. | product work belongs to the 7 project agents; Video Division keeps its three; ops and QA keep theirs |
| H3 | Skills archived (22): group A (`make-report`, `make-tour`, `new-listing`, `studio`, `studio-v2`), group B (`match-deal`, `source-deals`, `underwrite-deal`), `analyze-plan`, `worktree-ops`, `run-eval`, `test-bounded` (both target the chat-MVP app), the seven `21st-*`, `write-swift`, `animate-expo`, `grill-me` (duplicate of `grilling`). Resolves OWED-006 and the `grill-me` part of OWED-017. | out of scope, no git, off-stack, duplicate |
| H4 | **Enforce in settings**: `.claude/settings.json` `permissions.deny` for `Bash(git:*)`, `Read(**/.env)`, `Read(**/.env.*)`. | a rule a tool blocks beats a rule a prompt repeats |
| H5 | **Memory precedence (OWED-014)**: the department memory `C:\RnD\memory\` binds every session, Habait included. `Projects/Habait/memory.md` becomes reference: grep it, never read it whole; new facts go to `memory/project/`. The project `CLAUDE.md` protocol is changed in phase 2 through a `.wt` folder (root §8.7). | one source of truth; ends the 200 KB read per session |
| H6 | **Operator language (OWED-015)**: answer Eliran in the language he writes in (he writes Hebrew); product language unchanged. | he writes Hebrew; two files disagreed |
| H7 | Design-skill duplicates with user plugins (OWED-007): the repo copy wins inside `C:\RnD` (D6: `.claude/skills/` is the sole copy); disabling plugin copies is Eliran's own setting. | no change on disk |

## Phases
1. **Harness (this session, live files):** H4 settings; H1–H3 moves + `archive/` context files; roster, register, `INHERITED-DECISIONS.md` (D1, D2, D-AUD-29, D-AUD-30, B-15), root `CLAUDE.md` counts and H6; `generate-cards.py --apply`/`--check`; memory, INDEX, HOT, OWED.
2. **Project (`.wt\harness-focus`):** `Projects/Habait/CLAUDE.md` memory protocol per H5 and its language line per H6.
3. **Owed later:** `/close-task` and `wt.py open|close` scripts (hand-proven first, root §3); OWED-018 frontmatter pass; SessionStart HOT hook drafted into `docs/OWNER-PASTE.md` (Eliran installs).

## Risks
- A kept skill cites an archived one (`ship`, `close-board`, `plan-to-tasks`, `rotate-secrets`): those lines are in already-suspended git/MVP steps; they now point at `archive/`.
- `Bash(git:*)` deny also blocks harmless `git --version`; acceptable under the no-git ruling.

## Done when
Phase 1: `.claude/agents/` holds 10 definitions, `.claude/skills/` 32 skills; settings deny in place; `generate-cards.py --check` prints 0 missing; memory written.

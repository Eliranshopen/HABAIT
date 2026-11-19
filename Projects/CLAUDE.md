# Projects/ — the product projects
<!-- last-updated: 2026-11-19 -->

## What's here
Each product project in its own folder, with its own `CLAUDE.md`, memory and (when it has one) `.claude/` layer. The root contract (`C:\RnD\CLAUDE.md` §0–§12) applies above every project; a project's own card wins inside it on anything it states.

| Project | Folder | Card | State 2026-11-03 |
|---|---|---|---|
| Habait — developer sales plan → 360 tour / flyover / clickable building | `Habait/` | [`Habait/CLAUDE.md`](Habait/CLAUDE.md) (Hebrew, the project's own) | **copied 2026-11-03 12:19** from `C:\Habait` by board `development/tasks/copy-habait-2026-11-03/` — 29,552 files, 30.4 GB, verified 5/5; paths re-pointed (`Habait/REPOINTED.md`). cut over 2026-11-03: `C:\Habait` is archived as `C:\Habait-archive-2026-11-03`; this folder is the only live copy |
| 3Dengine — the engine: sales-plan PDF → full 360 tour, driven by the agent through MCP | `3Dengine/` | [`3Dengine/CLAUDE.md`](3Dengine/CLAUDE.md) | **2026-11-18:** built on Eliran's word, one milestone at a time (board `development/tasks/3dengine/`, plan `development/plans/2026-11-16-pdf-to-360-engine-mcp.md`). 7 of 27 milestones closed: 0.1 the engine home, 0.2 a stub engine behind the agent, 0.3 a job on the disk, 1.1 intake and a first look, 1.2 the reading tool in the engine, 1.3 the reading as a job's stage, 1.4 a kept reading. The readiness command prints READY |
| Pesel_yazamot — the developer's source files for Kedma, Etz Efraim (sales-plan sheets, price list, exterior renders) | `Pesel_yazamot/` | [`Pesel_yazamot/CLAUDE.md`](Pesel_yazamot/CLAUDE.md) | **2026-11-16:** put here by Eliran as the input of apartment simulations; originals, read-only. First job: building ד apartment 1, worktree `.wt/kedma-d1` → `memory/project/2026-11-16-kedma-d1-simulation.md` |
| Kedma_D1 — Kedma, Etz Efraim, building ד apt 1: the 360 tour (look B) | `Kedma_D1/` | [`Kedma_D1/CLAUDE.md`](Kedma_D1/CLAUDE.md) | **2026-11-19:** 13 of 13 viewpoints PASS, live at kedma-d1.vercel.app; this folder is a COPY of the deliverables (dist = the built tour, 13 panoramas, job, plan) on Eliran's word; the work runs in `.wt/kedma-d1` |
| Harey_zahav_Naama — the developer's source files for Harei Zahav, Moshav Na'ama (sales plan, brochure, interior renders) | `Harey_zahav_Naama/` | [`Harey_zahav_Naama/CLAUDE.md`](Harey_zahav_Naama/CLAUDE.md) | **2026-11-17:** model Hatzav (3 rooms, 80 m²) built as an interactive 3D walkaround in `.wt/harei-zahav-naama`. QA PASS, $0, not committed |

**2026-11-16:** `Habait/` was off the disk from about 13:22 and is BACK since that evening (`git restore -- Projects/Habait` on Eliran's word: the 2,719 tracked files; what git does not track — `tools/`, `_local/`, the old secrets file — is still not there) → `memory/project/2026-11-16-projects-habait-off-disk.md`.

## How a Habait session works (Eliran's ruling Q5, 2026-11-03)
- **Start Habait sessions from `C:\RnD\Projects\Habait`.** Its `.claude/agents/` (7 definitions) and `.claude/skills/plan-to-tasks` load only from there; its `CLAUDE.md` and `SESSIONS.md` stay the project's own; since 2026-11-03 the binding memory is the department's `C:\RnD\memory\` and `memory.md` is frozen, grep-only reference (plan `development/plans/2026-11-03-harness-focus.md`, OWED-014).
- The root harness (10 agents, 32 skills, `memory/`) loads from `C:\RnD`; since 2026-11-03 product build work goes to the 7 project agents, and the chat-MVP `habait-*` agents are in `C:\RnD\archive\agents\` (OWED-009 partly).
- **One git repo** (Eliran, 2026-11-04): `Habait/` is tracked by `C:\RnD`'s git (commit `de560da`); the old `habait-walkaround/.git` (HEAD `35cc0f6`, remote the previous CTO's) is archived at `C:\Habait-git-archive-2026-11-04`. A feature runs in a worktree `C:\RnD\.wt\<feature>` (root §8.7). Never push `main`; the only remote is the HABAIT snapshot mirror (root §11, 2026-11-08).
- Secrets: `Habait/habait-walkaround/.env` (names in `docs/governance/SECRETS-LEDGER.md`; the archive folder holds the same values, so a rotation invalidates both).
- Toolchain from the new root: `tools/habait-venv` was re-created here (not copied — a venv is not relocatable); Blender is the portable folder under `tools/`; env lines in `development/tasks/copy-habait-2026-11-03/logs/toolchain-report.md`.

## Subfolders
| Folder | Card | Purpose |
|---|---|---|
| `Kedma_D1/` | [`Kedma_D1/CLAUDE.md`](Kedma_D1/CLAUDE.md) | Kedma D/1 deliverables (copy): dist (the tour), panoramas, job, plan |
| `3Dengine/` | [`3Dengine/CLAUDE.md`](3Dengine/CLAUDE.md) | the engine home: settings file, readiness command, set-up scripts, the brought-in pipeline, tests |
| `Habait/` | [`Habait/CLAUDE.md`](Habait/CLAUDE.md) | the project root: instructions, memory protocol, repo layout, commands (Hebrew-first) |
| `Habait/.claude/agents/` | [`Habait/.claude/agents/CLAUDE.md`](Habait/.claude/agents/CLAUDE.md) | the project's 7 agents (engine-builder, platform-dev, blender-scene, genai-look, cloud-render, qa-reviewer, corpus-and-docs) |
| `Habait/habait-walkaround/360walkaround/pipeline/` | [card](Habait/habait-walkaround/360walkaround/pipeline/CLAUDE.md) | the deterministic Blender/Cycles plan → pano pipeline |
| `Habait/habait-walkaround/Habait/tour360/` | [card](Habait/habait-walkaround/Habait/tour360/CLAUDE.md) | the 360° apartment-tour system |

## Conventions / gotchas
- A project arrives by a board, never by hand: counts, hashes and git integrity are verified before anything points at it.
- Every folder of a project carries a `CLAUDE.md` (root §8.6): the project's own hand-written ones stay as they are; the rest are generated (`generated-by` on line 3), with the Purpose line filled by `codebase-cartographer` from the folder's contents. Inside `Habait/habait-walkaround/` they show as untracked files in `git status` — expected, never committed by an agent.
- `C:\Habait-archive-2026-11-03` is frozen history: never edited, never served from, deleted only by Eliran.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Board: [../development/tasks/copy-habait-2026-11-03/README.md](../development/tasks/copy-habait-2026-11-03/README.md)

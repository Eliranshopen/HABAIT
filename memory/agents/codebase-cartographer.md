
## 2026-11-03 — Purpose lines for generated cards in Projects/Habait (outside habait-walkaround)
- **Did:** replaced the _Not written yet placeholder with one grounded sentence in 44 generated CLAUDE.md files (depth 1-3); wrote 3 Gotchas (deploy-vercel, fal-bench, sales-plans/eval).
- **Evidence:** grep for _Not written yet in scope now returns none; sources were folder listings and READMEs (tools, fal-bench, sales-plans, deploy-vercel, site846, workplan board, HANDOFF).
- **Learned:** data/sales-plans/_inbox is empty (purpose inferred from name, flagged in the line); tools/deploy-vercel README says the live demo is habait-flow.
- **Owed:** none; deeper-than-3 cards untouched.
- **Second reader:** main session.

## 2026-11-03 · codebase-cartographer · fill Purpose lines in habait-walkaround generated cards
- **Did:** replaced the `_Not written yet` Purpose placeholder with one factual sentence in 72 generated CLAUDE.md files at depth 0-3 of `Projects/Habait/habait-walkaround/` (`.claude/` was already filled by another agent); `_local` folders got a Gotchas line (gitignored, treat as paid-run output). No git state change, hand-written cards untouched.
- **Evidence:** `grep -rl "^_Not written yet"` at depth <=3 returns none; sources were folder listings and READMEs (engine, flyover, studio, platform, tour360).
- **Learned:** the project card does NOT literally say `_local` holds paid outputs (only that `_local/projects/` is gitignored); the Gotcha wording is therefore a cautious inference. `/tmp/fill.py` is shared between agents (another agent's script lived there): use unique temp names.
- **Owed / open:** none; empty folders (research_tmp) carry "empty" as purpose; every purpose was established from the files.
- **Second reader:** main session — verify the `_local` Gotcha wording and the depth-4+ cards remain unfilled.
- 2026-11-03 · pointer · cleanup: your selection rule is now root §8.6 (every folder, generator writes facts, you write Purpose/Gotchas); say "context file" → `memory/runs/2026-11-03-cleanup.md`
- 2026-11-03 · pointer · new skill folder `.claude/skills/improve-codebase-architecture/` (+ `agents/`): both context files generated, Purpose and Gotchas written by the main session → `memory/project/2026-11-03-skill-improve-codebase-architecture.md`
- 2026-11-03 · pointer · new skill folders `.claude/skills/codebase-design/` and `domain-modeling/` (+ `agents/` each): four context files generated, Purpose and Gotchas written by the main session → `memory/project/2026-11-03-skill-improve-codebase-architecture.md` (2nd entry)
- 2026-11-03 · pointer · Eliran ruled every plan lives in `development/plans/` (root §8.8): keep that folder's plan table current; plan mode writes there via `.claude/settings.json` → `memory/project/2026-11-03-plans-in-development-plans.md`

## 2026-11-03 · main session → second-reader pointer
- Harness focused: 18 agents + 22 skills moved to `archive/`; roster and register reshaped; refresh `docs/context-map.generated.md` on the next `/sync-context` → `memory/project/2026-11-03-harness-scope.md`

## 2026-11-03 · main session → second-reader pointer
- harness focus phase 3: scripts/wt.py + scripts/mem_entry.py + /close-task; HOT SessionStart hook drafted for Eliran (OWNER-PASTE §b) → `memory/runs/2026-11-03-harness-focus.md`

## 2026-11-03 · main session → second-reader pointer
- new skill folder `.claude/skills/real-estate-content-production/` + its context file; add its row to `docs/context-map.generated.md` on the next `/sync-context` → `memory/project/2026-11-03-skill-real-estate-content-production.md`

## 2026-11-04 · codebase-cartographer · sync-context check [6] v1.3: card size and line ceilings
- **Did:** Reflowed 11 lines over 600 chars in Projects/Habait/CLAUDE.md (70,92), .claude/skills/CLAUDE.md (5,29), tour360/CLAUDE.md (bullets 71,74,77), pipeline/CLAUDE.md; table rows over 600 split into short row + Notes bullets (tour360 x3, pipeline x1). Moves out of root (word for word, stubs left): §0.1 layer table -> memory/README.md; §1 root layout table -> docs/CLAUDE.md; §8.6 generator detail -> .claude/skills/CLAUDE.md; §8.7 procedure (use wt.py/Open/Close/memory rows/VS Code) -> .wt/CLAUDE.md; §8.8 plan mode + plan-of-record -> development/plans/CLAUDE.md; §8.9 four QA bullets -> development/tasks/CLAUDE.md; tour360 Subfolders notes (apartments/, tools/) -> tour360/README.md. Root line 4 reflowed; §9 untouched. Result: check [6] FAIL -> PASS, checks 1,5-9 PASS, root 19929 bytes, generate-cards --check 0 missing. Second reader: main session (none file).
- **Evidence:** `CLAUDE.md`
- **Learned:** Check 9 greps 'regenerated at every /close-board and /sync-context' in root, so the stub for the moved layer table must keep that phrase. Size is bytes, not chars (Hebrew). Row-overflow Notes alone can keep a card over 20 KB.
- **Owed / open:** generate-cards --check reports 2 stale generated cards (.claude/skills/sync-context, development/tasks/tour-exterior-floors): not in scope, run --apply
- **Second reader:** none

## 2026-11-04 · main-session → second-reader pointer
- runs/2026-11-04-context-sync-3.md — /sync-context 3: check-context PASS 6/6 (root 19.9 KB, detail relocated with stubs), verify-memory CLEAN (parser fixed), HOT corrected, OWED-022 resolved; incident: --apply wrote 414 cards into an in-flight backup copy → `memory/runs/2026-11-04-context-sync-3.md`

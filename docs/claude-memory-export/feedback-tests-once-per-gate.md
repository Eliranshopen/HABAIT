---
name: feedback-tests-once-per-gate
description: Eliran 2026-11-18 — in a milestone gate each test tier runs ONCE; rerun only on a failure or a cut; live home after merge = readiness check only
metadata:
  node_type: memory
  type: feedback
  originSessionId: 40c3c5f2-e1ea-4dd3-baf1-ad71447227fd
  modified: 2026-11-18T10:23:42.126Z
---

In the engine's milestone gate (Projects/3Dengine, board development/tasks/3dengine) every tier of tests runs ONE time: `npm test` once, `npm run test:stages` once. A run is repeated only when it failed or was cut by its time limit, and the gate summary says so. After the merge into local `main`, the live home gets `node engine/cli.mjs doctor` only, not the whole suite again. A fresh QA reviewer's own gate run is also once per tier.

**Why:** On 2026-11-18, during the gate of milestone 1.3, Eliran asked «יכול להיות שיש דברים בתהליך שהם לא קריטיים ומאטים את התהליך?». I showed him four time costs that are not critical and he picked ONE in the question dialog: «בדיקות פעם אחת». "Three runs in a row" and the full rerun in the live home were my own habit, not his rule; that day they cost about 35 minutes (five full runs and three cut ones on a machine other sessions held at 100 %).

**How to apply:** Do not run a suite several times "to be sure". Do NOT trim the other three things I offered — he did not choose them: a fresh QA reviewer per milestone, the whole sync-context pass per milestone, plan-to-tasks (task cards) per milestone all stay. My interpretation: the same spirit applies to other projects' gates (run a check once, rerun on failure), but he said it about the engine's milestones. Written in development/tasks/3dengine/run-tasks.md step 3 and memory/project/2026-11-18-engine-gate-tests-once.md. Related: [[project-engine-mcp-plan]], [[feedback-test-on-the-smallest-thing]], [[feedback-status-against-the-plan]].

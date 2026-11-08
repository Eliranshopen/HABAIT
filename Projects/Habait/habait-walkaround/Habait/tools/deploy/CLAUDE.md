# Habait/tools/deploy/ — the habait-flow predeploy gate
<!-- created: 2026-11-05 · fork F (rnd-9d), project-runner · authority: Eliran -->

| File | Purpose |
|---|---|
| `predeploy.mjs` | runs `../qa/responsive-gate.mjs` on a stage folder (served locally with its vercel.json rewrites) over /, /landing, /apartment, /hold/, /studio/ and /tour/?room=<every room>; FAIL writes `<stage>/PREDEPLOY-FAIL.json` and exits 1 |

Called by `Projects/Habait/tools/deploy-vercel/stage_flow.py` (gitignored) at the end of every stage; `--gate-root <worktree>/Projects/Habait/habait-walkaround` uses a worktree's copy before it is merged. Never deploy a stage that failed.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)

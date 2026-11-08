# Habait/tools/ — shared gates for every surface
<!-- created: 2026-11-05 · fork F (rnd-9d), project-runner · authority: Eliran -->

## What's here
Checks that every Habait surface must pass, used by more than one caller (the project runner, the habait-flow deploy).

| Folder | Purpose |
|---|---|
| `qa/` | `responsive-gate.mjs`: desktop 1440 + phone 390, page errors, 4xx, overflow on both sides, 44 px targets, controls over the panorama |
| `deploy/` | `predeploy.mjs`: runs the responsive gate on a habait-flow stage; `stage_flow.py` calls it and refuses on FAIL |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)

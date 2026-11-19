---
name: feedback-engine-stage-tests-long-run
description: Eliran 2026-11-18 — on a loaded machine the engine's stage tests may run once as a bounded background run of up to 25 minutes
metadata:
  type: feedback
---

For the ENGINE's stage tests only (`npm run test:stages` in Projects/3Dengine: tests that run the real reading tool, later the render), when other sessions hold the machine at 100 %: ONE bounded run of up to 25 minutes in the background (`timeout 1500 npm run test:stages`, Bash `run_in_background: true`), instead of the 540 s foreground limit of root §12. The harness notifies when it ends; never poll it. Everything else keeps §12 (tests 300 s, 540 s per chunk, foreground, one heavy run at a time).

**Why:** On 2026-11-18, at the gate of engine milestone 1.4, renders of other sessions (Hatzav panoramas) held the machine at 100 % and ONE reading of a drawing took up to 558 s (71 s when quiet). Five tries of the closing test were cut by the 540 s limit; a cut also kills the reading tool mid-run, and the test then reports a failed step (exit code 124 is the tell). I asked him in a question dialog with three options (one long bounded run; wait; he pauses the renders) and he chose the long run. The other renders are not stopped.

**How to apply:** Check the load first (`(Get-CimInstance Win32_Processor).LoadPercentage`). Quiet machine: the normal foreground run under `timeout 540`. Loaded: the one long background run, recorded in the gate summary with the load. It is a scoped exception: do not stretch it to other commands or projects without asking him. Related: [[feedback-tests-once-per-gate]], [[project-engine-mcp-plan]].

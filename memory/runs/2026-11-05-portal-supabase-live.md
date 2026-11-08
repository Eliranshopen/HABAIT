---
date: 2026-11-05
layer: runs
author: main session rnd-9d
second_reader: fork F (portal), fork A (Rainbow merge)
---
# 2026-11-05 — portal restored on Supabase, live (dpl_G55ZUBqZ…)

- **What:** the developer portal is live again after the Vercel Blob store `habait-studio` was suspended (Hobby operations quota, 11:40Z). Storage = Supabase Storage via `api/_store.mjs` (fork G, worktree `.wt/studio-supabase`). Combined with fork F's project-runner template overlay: 44 px targets on /hold/, the /tour/ header (the 390 language button no longer cut by the edge), home, landing.
- **Go:** Eliran «Yes, deploy once it passes» (AskUserQuestion, before the gate re-run); the gate passed 32/32, then the session deployed.
- **Evidence:** stage `scratchpad/deploy-H-1`; gate `deploy-H-1.predeploy/` + `forkF/predeploy-H1-run2.log`; served sha256 = stage on 5 files; `/api/studio-config` store supabase; projects 401 without login.
- **Lesson:** the first gate FAIL (13:46Z: 404 dollhouse, 38 px buttons) was a stopped gate process still reading a half-rebuilt stage. Kill a stopped gate by PID before rebuilding its stage (root §12).
- **Owed:** the live portal e2e (upload → read → build → sandbox claim) at 1440/390 by fork F; the merges of studio-supabase and project-runner into main after fork A's Rainbow merge.
- **Follow-up deploy dpl_4PxPsAxt (~16:20):** the production gate on dpl_G55ZUBqZ was 28/32. /studio/ failed for real: Clerk's controls were 30 px, and the local stage never mounts Clerk. The /tour/ 390 failures were swap rings at the panorama edge, now exempt from the edge rule only. Fixed in studio.css; preview gate 32/32 with Clerk mounted; Eliran «כן תעלה». Lesson: run the responsive gate on a protected preview (`--header-env`) before prod, since a local stage misses third-party widgets. Live e2e PASS on dpl_G55ZUBqZ: project pmw3lzgvbb021a6 (test, kept: deleting it is Eliran's call).

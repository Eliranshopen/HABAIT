---
name: project-rainbow-test-link-and-handoff
description: "Rainbow test link rainbow-v2-test.vercel.app (separate Vercel project, $0) vs prod habait-flow; the 2026-11-10 handoff of the simulation fixes to a new session; FAL ceiling $25"
metadata:
  node_type: memory
  type: project
  originSessionId: bf387f38-6eee-4def-a2b7-39554f497b4b
  modified: 2026-11-10T08:51:28.805Z
---

Since 2026-11-09 Rainbow changes go first to a separate Vercel project **rainbow-v2-test** (https://rainbow-v2-test.vercel.app/, project id in SHIP-LEDGER), built as a fresh `stage_flow.py … --edit-api --studio` stage + that project's `.vercel/` + a `.vercelignore` with `.env*`; prod habait-flow.vercel.app changes only on Eliran's explicit word after he checks the test link (he rolled back a copied landing on 2026-11-09, see [[feedback-inspiration-not-copy]]). On 2026-11-10 Eliran split the work: the running session finished the deletion of the 28 GB `Projects/Habait-backup-2026-11-04` (his option 2), and **all simulation fixes move to a new session** — handoff file `C:\RnD\memory\project\2026-11-10-handoff-simulation-fixes.md`, read it with `memory/HOT.md` first. FAL spend ceiling **$25** on the live key (`Projects/Habait/habait-walkaround/.env` is the only secrets file; never read it, probe by behaviour).

**Why:** Eliran wants one source of truth for secrets, prod untouched until he approves on his iPhone, and a clean session boundary for the paid fixes.

**How to apply:** new session → read HOT + the handoff → ask which simulation fix first → ledger before any paid call → test link first, prod on his word.

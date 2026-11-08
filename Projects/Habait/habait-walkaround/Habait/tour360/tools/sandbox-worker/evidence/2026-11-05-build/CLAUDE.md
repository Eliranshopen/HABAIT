# evidence/2026-11-05-build/ — context file
<!-- last-updated: 2026-11-05 -->

## Purpose
The BUILD stage of the project runner, run in Vercel Sandbox (fork E of rnd-9d, 2026-11-05), without the Blob store (suspended that
day on Hobby's operations quota) and without fal (locked). Test project `pbuild846` = the hand plan of apt846-auto. Sandbox
`proof-build-mw3k9cmc` (4 vCPU / 8 GB, persistent, from snapshot `snap_3zqDV281SaPj37nQ9vXndwNOQjuj`), two sessions, deleted after.

## Key files
| File | What it proves |
|---|---|
| `proof/timings.tsv` | every phase: seconds, exit code, end time. Session 1 (cap 20 min) ended mid-render; session 2 resumed the same disk and skipped the finished phases |
| `proof/time-render2048.txt`, `proof/time-renderRest.txt` | `/usr/bin/time -v`: 3 points at 2048x1024 @ 16 spp = 761.7 s wall, 2,980 CPU-s (391 % of 4 vCPU), max RSS 3.98 GB; 3 points at 1024x512 @ 16 in session 2 = 312 s |
| `proof/mem.log` | VM memory used every 5 s (peak 4,166 MB of 8,404) and load |
| `proof/renders/*.webp`, `*.render.json` | the 11 CG renders made in the VM and their records |
| `proof/gate.json`, `proof/gate.log` | the $0 CG-only fidelity gate (`fidelity-gate.mjs --cg-only`): the real verdict, FAIL on 8 of 11 rooms at the 1 % bar — identical numbers to the laptop renders of the same plan |
| `proof/run.log`, `proof/*.log` | the phase logs |
| `proof/diag-*.log`, `proof/qa/` | **DIAGNOSTIC ONLY**: to time build / package / qa on Linux after the gate refused, the VM-local fidelity bar was raised to 60 % (and the VM-local disclosure line carried it). The qa screenshots therefore show «עד 60%»: they are a timing proof, never a product, never shown to a developer or buyer |
| `diag-ship.sh`, `diag-ship2.mjs`, `vm-script.mjs`, `vm-exec.mjs` | the diagnostic scripts as they ran |
| `proof-state.json` | the sandbox name, sessions, deletion time |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)

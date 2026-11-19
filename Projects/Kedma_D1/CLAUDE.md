# Projects/Kedma_D1/ — Kedma, Etz Efraim, building ד apartment 1: the 360 tour
<!-- last-updated: 2026-11-19 -->

## What's here
The deliverables of the Kedma D/1 simulation, copied here on Eliran's word (2026-11-19, question dialog: «תיקיית פרויקט עם התוצרים»).
The 13-viewpoint 360 tour in look B ("quiet luxury"), every viewpoint PASS at the 1 % fidelity gate, live at https://kedma-d1.vercel.app
(deployed 2026-11-19 on his go). Sources (the developer's sheets and renders, read-only): `../Pesel_yazamot/`.

**This is a copy.** The work itself still runs in the git worktree `C:\RnD\.wt\kedma-d1` (branch `kedma-d1`, nothing committed):
engine tools under `Projects/3Dengine/pipeline/`, the apartment's working canvases (8.4 GB) under
`pipeline/Habait/tour360/apartments/kedma-d1/`, the job under `Projects/3Dengine/jobs/kedma-d1/`. After a change there, copy it here again.

## Folders
| Folder | What |
|---|---|
| `dist/` | the built tour as deployed (`build-tour.mjs --catalog=ai --dollhouse --full`); build output, so no context files inside (root §8.6); open `dist/index.html` through a local server |
| `panoramas/` | the 13 final panoramas, 8192×4096 PNG, named by viewpoint (from `_local/picks.json`) |
| `job/` | the job folder: hand tools (`hand/`), prompts, review pictures, logs, deploy logs, ledger copy |
| `plan/` | the plan of record (copy of `development/plans/2026-11-17-kedma-d1-true-geometry-redo.md`) |

## Continuing on another computer (2026-11-19)
GitHub (Eliranshopen/HABAIT) holds the code and text of this folder, and the worktree's changes under `worktree/` (copy them back to
`.wt/kedma-d1/Projects/3Dengine/` at the same paths). It holds NO media: the 13 panoramas, the built tour's images and the working
canvases (8.4 GB, worktree `apartments/kedma-d1/_local/`) and renders (`tours/kedma-d1/renders/`) must be brought by hand.
The keys file `C:\RnD\.env` is never in the repo. Resume point: last section of `memory/project/2026-11-16-kedma-d1-simulation.md`.

## Facts
- Money: $45.79 of a $48 ceiling (Eliran raised it from $45 on 2026-11-19 for the balcony); ledger in the worktree `_local/ledger.json`.
- The balcony was painted with GPT Image 2.5 after nano-banana invented a second terrace six times.
- Open: day/night (living-room proof first), small leftovers, RAINBOW baseline rows, cost/time report → `memory/project/2026-11-16-kedma-d1-simulation.md`.
- Every AI picture carries the «הדמיה» badge; the disclosure line «עד 1%» holds because all 13 pass.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)

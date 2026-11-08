# fidelity-audit-2026-11-04/ — context file
<!-- last-updated: 2026-11-04 -->

## Purpose
Read-and-judge audit of the apt846 360° simulation against the developer's sales plan (תכנית מכר, `habait-walkaround/דירה 846- 16.pdf`), on Eliran's 2026-11-04 fidelity rule (`memory/project/2026-11-04-sales-plan-fidelity.md`). No product file changed, $0, no deploy.

## Key files
| File | Purpose |
|---|---|
| `REPORT.md` | verdict + one row per finding + per-room table (text returned by the auditing sub-agent; the main session saves it here) |
| `manifest.json` | inputs and outputs with sha256, cost $0 |
| `plan/` | the PDF page rendered (x2, x5), zooms, and the trace drawn over the plan crop |
| `views/` | per room: `-strip` (designed over CG), `-expected` (traced geometry ray-cast onto both), `-bNNN` 90° cuts at plan bearings |
| `scripts/` | `render_pdf.py`, `crop.py`, `overlay.py`, `strip.py`, `raycast.py`, `cut.py` — re-run with `python -I` |

## Gotchas
- ⛔ `plan/` holds renders of a partner-supplied drawing (rights_state "partner-supplied"): never publish; the folder is git-ignored via `Projects/Habait/research/**`.
- Bearings are plan-image bearings (0 = up on the plan sheet, clockwise); pano u = 0.5 faces `scenes.json` `centreBearingDeg`.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §6, §8.6

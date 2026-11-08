# platform-ui-ux-2026-11-03/ — context file
<!-- last-updated: 2026-11-03 -->

## Purpose
Research only (no product code): how to improve the look and UX of the Habait platform shell itself (home and project pick, project landing, apartment page, the developer upload → generate → results area) WITHOUT touching the video or the visualizations (`/hold/`, `/tour/`, clips, Kling, Blender, `apartment-3d.js`). Asked by Eliran 2026-11-03 in session rnd-ed. Implementation follows in the working folder `C:\RnD\.wt\platform-ui-ux` (root `CLAUDE.md` §8.7) after Eliran's calls in `README.md` §4.

## What's here
| File | What |
|---|---|
| `README.md` | the synthesis in Hebrew: current state with measured defects, research findings, recommended direction and phases, open calls for Eliran |
| `raw-A-platforms.md` | sub-agent survey of 21 platforms (AI viz tools, developer unit pickers, AI job-queue apps), cited, confidence-flagged |
| `raw-B-patterns.md` | sub-agent survey of UX patterns in 8 areas, 15 ranked principles, a 30-item audit checklist, cited, confidence-flagged |
| `current/` | screenshots of the live habait-flow shell (desktop 1440×900, phone 390×844) and of the local Studio rendered from its files; `capture-report.json` |

## Gotchas
- The Studio screenshots were rendered with a read-only mock API (no server: Studio lacks its `zod` dependency). Blank video players and "NaN KB" in them are the mock, not the product; the raw-float durations are real.
- The live apartment-page error is real: `js/apartment.js:110` `new URL(ext.url)` without a base, after `stage_flow.py` rewrites the hold URL to `/hold`.

## Links
Parent: [../](../) · Sibling research: [../apartment-3d-ux-2026-11-03/README.md](../apartment-3d-ux-2026-11-03/README.md) · Working folder: `C:\RnD\.wt\platform-ui-ux\manifest.json`

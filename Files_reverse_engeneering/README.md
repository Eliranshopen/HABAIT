# Reverse engineering: architectural walkthrough + Day/Night (2026-11-17)

**Answer in one line:** the reference is a set of per-room 360° panoramas (most likely AI-generated) in a custom web viewer. Its "Explore the light" slider is a linear cross-fade between 3–4 pre-made lighting images of the same view (measured). We rebuilt the feature on our own deterministic Blender pipeline, with geometry identical across all lighting states, and it works in the browser on desktop and phone. The reference's *look* is not matched yet (see 06).

| # | Deliverable | File |
|---|---|---|
| 1 | Video forensic analysis | `research/01-video-forensics.md` |
| 2 | Annotated frames | `research/ann_ui_elements.png`, `ann_day_sunset_night.png`, `ann_detail_crops.png`, `sheet_slider.jpg`, `sheet_keyframes.jpg`, `sheet_transitions.jpg`, `contact_2fps.jpg` |
| 3 | Observed vs inferred matrix | `research/01-video-forensics.md` §1–6 (every row labelled) |
| 4 | Day/Night technical analysis | `research/02-day-night-analysis.md` |
| 5 | Tool and library comparison | `research/03-tools-research.md` (sourced) |
| 6 | Recommended architecture | `research/05-architecture.md` |
| 7 | Reuse from earlier projects | `research/04-reuse-report.md` |
| 8 | Working Day/Night PoC | `poc/viewer/` (run: `poc/README.md`) |
| 9 | Source code + setup | `poc/README.md`, `poc/blender/`, `poc/qa/` |
| 10 | Visual comparison + QA | `research/06-qa-and-comparison.md`, `research/07-compare-reference-vs-poc.jpg`, `poc/qa/shots/` |
| 11 | Reusable workflows | `research/08-workflows.md`, installed skill `.claude/skills/day-night-keyframes/` (mode A 360, mode B walk) |
| 12 | Roadmap | `research/09-roadmap.md` |

**Added 2026-11-17: Day/Night in a free 3D walk**: `poc-walk/` (Hatzav walk, 4 baked keys, slider, QA PASS; night look still flat).

Spend: $0 (local Blender, no API calls). Nothing committed. Reference projects untouched.

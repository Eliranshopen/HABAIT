# apartment-journey/media/ — context file
<!-- last-updated: 2026-11-10 -->

## Purpose
The media of the apartment journey (round 4), made at $0 by `../../tools/make_journey_media.py`. Every file has a row (input, sha256, args, cost 0) in `manifest.json`; `manifest.json` › `floor16` says where floor 16 sits in the hold frame.

## What's here
| File | What |
|---|---|
| `tower-16-1920.jpg`, `tower-16-960.jpg` | the hold's stop pose: Kling frame 91 of `research/…/flyover3d/data/holdarc/jpg_hi/` (re-encode only) |
| `fly-846-1280.mp4`, `fly-846-854.mp4` | the bird flight (Eliran 2026-11-10), 6.2 s, no sound: the descent to 846 (×1.25) + the entry through the glass (×1.35), BOTH re-made by Kling v2v on the 11-02 clay path with the tour's own living room as the look ($4.23 for the evening's five takes). Inputs, scripts and the paid takes: `qa-evidence/platform/bird-flight-2026-11-10/matching/`. The 854 file is for slow / data-saving lines |
| `manifest.json` | the rows above + `floor16` |

## Gotchas
- The living-room landing is NOT a file here. `journey.js` draws it at run time from the tour's own panorama (`/tour/panos-parquet/04-living.webp`), so it is always the tour's current picture.
- Round 3's room views, walk frames and dollhouse still moved to `../../tools/_unused/apartment-journey-r3/media/`, with their manifest (`manifest-r3.json`).
- **The film ends looking INTO the room** (front door, console), so the tour opens at yaw 180 (the hold's `JOURNEY_YAW`, `journey.js` `LIVING_YAW`).
- **The film's room must look like the tour's room** (Eliran 2026-11-10: «הסרטון ממש שונה מאיך שהסלון נראה בהדמיה … זה בולט»). If the living-room pictures change, re-make both takes (`fly3.py`, `fly4.py`: the look comes from views of `panos-parquet/04-living.webp`). The old terrace frame is used with the room behind its glass MASKED — unmasked it pulled the 11-02 sofa and rug back in. Still not identical: the film shows the parquet floor only (the tour has three floors) and small props differ.
- All of it is AI-made property imagery: the page shows «הדמיה · AI-generated».

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6

# tools/_unused/apartment-journey-r3/ — context file
<!-- last-updated: 2026-11-10 -->

## Purpose
The round-3 apartment journey (2026-11-09), relocated here on 2026-11-10 (round 4). Nothing was deleted. In round 3 it was a SCROLL page:
- floor 16, the isolated floor and the fly-in;
- one walk through 8 rooms on the tour's own doorway bearings, with a filmstrip;
- the cutaway and the live 3D dialog.

Eliran then asked for one automatic flight straight into the 360 tour, which `../../../apartment-journey/` now is. The stage never deploys `tools/`.

## What's here
| Path | What |
|---|---|
| `index.html`, `journey.css`, `journey.js` | the round-3 page as it was (paths inside it are relative to `apartment-journey/`) |
| `media/` | its room views, walk frames (`walk/`), `walk.json`, the dollhouse still, the 2:3 hold crop, `manifest-r3.json` (every row with its inputs and args) |
| `make_journey_media_r3.py` | the round-3 media script (the walk geometry: `site_nodes.json` bearings + the tour's doorway hotspots) |

## Gotchas
- Restore = move back to `apartment-journey/` and re-point the hold's «המשיכו אל הדירה» (round-3 hold code is in git history, merge `91ed932`).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Plan: `development/plans/2026-11-09-rainbow-v2.md` §8–§9

# fixtures/rainbow/landing/ — context file
<!-- last-updated: 2026-11-08 -->

## Purpose
The media of the Rainbow landing page at the site root (`index.html`): the hero film loop, its posters, the step-card and apartment stills, and (in `renders/`) the four project renders Eliran cleared. Made at $0 by `../../../tools/make_landing_hero.py`; every file has a row (input, sha256, args, cost 0) in `manifest.json`.

## What's here
| File | What |
|---|---|
| `hero-1080.mp4` / `hero-720.mp4` / `hero-portrait.mp4` | the exterior orbit of `building-film-1080.mp4` (AI: Kling v2v + Topaz Starlight), 0–14.4 s only, loop seam = dip through black; desktop / small landscape / phone 2:3 crop |
| `hero-poster-1920.jpg`, `-960.jpg`, `-portrait.jpg` | frame 0 of the loop (the first paint) |
| `facade.jpg` | a film frame (step card 02) |
| `interior-entrance.jpg`, `finish-parquet.jpg`, `finish-marble.jpg` | flat views (v360, no edit) of the current tour panoramas `tour360/dist/apt846/panos*/` |
| `manifest.json` | one row per output; deployed with the folder (relative paths only) |

## Gotchas
- Every picture here is AI-made property imagery: the page shows «הדמיה · AI-generated» on each (root §6).
- Re-run = `python tools/make_landing_hero.py --go` from `Habait/platform`; a step whose output hash, input hash and args match its row is skipped.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Plan: `development/plans/2026-11-08-rainbow-landing.md`

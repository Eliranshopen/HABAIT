# apartment-journey/media/walk/ — context file
<!-- last-updated: 2026-11-09 -->

## Purpose
The apartment walk of 846 (round 2, plan `development/plans/2026-11-09-rainbow-v2.md` §8): one folder per room in walk order, each a frame sequence of flat views of the GATED tour panorama — the room lands looking the way the visitor came in, then turns in 6° steps until the next doorway is ahead. `w-NN.webp` = 1280×720 (h_fov 84, desktop), `t-NN.webp` = 720×1080 (h_fov 62, phones). Made at $0 by `../../../tools/make_journey_media.py`; every frame has a manifest row in `../manifest.json`, the whole plan (bearings, sources) is `manifest.json` › `walk`, and the page reads `../walk.json`.

## What's here
| Folder | Room · arrives on · leaves toward |
|---|---|
| `1-terraceLiving/` | terraceLiving · 302.01° (the hold camera, frame 91 (the fly-in)) · 241.79° (hotspot terraceLiving->living), 12 frames |
| `2-living/` | living · 241.79° (hotspot terraceLiving->living) · 68.43° (hotspot living->dining), 30 frames |
| `3-dining/` | dining · 68.43° (hotspot living->dining) · 339.44° (hotspot dining->kitchen), 16 frames |
| `4-kitchen/` | kitchen · 339.44° (hotspot dining->kitchen) · 7.09° (hotspot bedroom2->kitchen reversed), 6 frames |
| `5-bedroom2/` | bedroom2 · 7.09° (hotspot bedroom2->kitchen reversed) · 209.77° (hotspot bedroom2->entrance), 28 frames |
| `6-entrance/` | entrance · 209.77° (hotspot bedroom2->entrance) · 108.11° (hotspot entrance->living, then hotspot living->bedroomMain), 18 frames |
| `7-bedroomMain/` | bedroomMain · 133.95° (hotspot entrance->living, then hotspot living->bedroomMain) · 285.15° (hotspot bedroomMain->wardrobe, then hotspot wardrobe->bathMain), 27 frames |
| `8-bathMain/` | bathMain · 235.61° (hotspot bedroomMain->wardrobe, then hotspot wardrobe->bathMain) · 21.81° (end of the walk (the view picked by eye)), 26 frames |

## Gotchas
- Bearings are the tour's own (site_nodes.json `pos_world`, `centre_yaw_deg_from_plus_y_cw`, the tour doorway hotspots): never re-aim a room by eye here — change `WALK` in the script and re-run.
- AI-made property imagery (the AI-skinned panoramas): the page shows «הדמיה · AI-generated» on every room.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6

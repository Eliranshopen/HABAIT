# Lighting rules (measured or verified 2026-11-17, Kedma D/1 cp-living)

| Rule | Value | Source |
|---|---|---|
| Plan bearing | 0 = plan up = world +Y, clockwise (plan x right, y down; world = x/100, −y/100) | `build_scene.py`, `plan.json` axes |
| Sun lamp rotation | Euler XYZ = (90−el, 0, 180−az) in degrees | verified: `build_scene.py` az 165, el 52 → (38, 0, 15) |
| Nishita sky `sun_rotation` | = the same bearing (radians) | `scripts/calibrate_sky.py`: rot 0 → 0.7°, rot 90 → 90.7° |
| Sun disc in the sky | off (`sun_disc=False`); the sun lamp gives direct light | avoids a double sun |
| Day, one exterior opening | lamps OFF, sky strength 1.0, exposure +1.5…+2.5 | previews: +0 left the room ~7.5 EV too dark |
| Sunset | sun el 5–9°, warm colour (1, .58, .32), lamps 0.35, exposure ~1.5 | |
| Dusk | sun lamp hidden, Nishita el −2.5°, strength ~4, lamps 0.7, exposure −0.4 | |
| Night | world colour (0.006, 0.010, 0.022), lamps 0.55, exposure −0.9 | 1.0 lamps + exposure 0 read as day |
| Direct sun reaches the floor only when | the sun bearing is within ~±60° of the opening's outward normal and low enough for the head height | cp-living door faces 270°: 15:00 az 252 el 17 → visible patch |
| Same across keyframes | resolution, samples, seed 0, `use_animated_seed` off, camera, view transform/look | `render_pano.py` |
| Timing on this CPU | 2048×1024 / 16 spp ≈ 160–400 s per key; 1024×512 / 16 ≈ 100–220 s | `out/final/manifest.json` |
Six keyframes used: 07:30 morning · 12:30 noon · 15:00 afternoon · 17:00 sunset · 18:30 dusk · 21:30 night.

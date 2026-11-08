# Spike — option 3: rise out of the 360 into the dollhouse (board dollhouse-in-tour, card 07)
<!-- 2026-11-03 night · main session rnd-fd · nothing shipped: a prototype page + frames, for Eliran's decision -->

## Question
Can the move from the tour's 360 view to the dollhouse be one continuous camera move (Matterport-style), starting from exactly the
frame the buyer sees in the tour?

## What was built (prototype only, not in the product)
`spike-rise.html` + `spike-run.cjs` in this folder. The living room's tour panorama (`apartments/apt846/_local/panos-parquet/04-living.webp`,
the AI-skinned picture the tour shows) is laid on that room's depth mesh (`Habait/platform/js/depthmesh.js`, from the per-scene depth
maps the tour's ruler already uses), placed in the dollhouse's own frame at the scene camera point (plan cm → GLB metres − the model's
centring shift; the same frame the "you are here" marker proved to 0.1 cm). The camera starts at that point looking where the tour
looks, then climbs and pulls back to the dollhouse's 3D preset while the room fades out and the cut model (baked light, real floor)
remains. `__spike.at(t)` renders any moment of the move deterministically.

## Result (frames: `frames/`, `frames-v2/`; sheets: `contact-v1-v2.png`, `contact-phone-v2.png`)
- **t = 0 matches the tour** (`frames*/desktop-tour-view.png` vs `desktop-t0.png`): same room, same direction, same picture — the hand-off
  can be seamless (align the field of view to the tour's current hfov; the prototype takes `?hfov=`).
- **v1** (room fades over 12–55 % of the move, climb over 60 %): the middle frames (t ≈ 0.3–0.45) show the depth mesh from far above,
  stretched and smeared — not acceptable.
- **v2** (`?fadeA=0.03&fadeB=0.28&liftB=0.85`: the room fades while the camera is still near it, the climb is slower): clean on desktop
  and iPhone 13 — the panorama dissolves into the model seen from above, then a smooth pull-back to the whole apartment. **Recommended.**
- Speed: ~3 fps under headless SwiftShader (no GPU) — not representative; a phone GPU renders this scene in real time (the dollhouse
  alone is ~28 k triangles + a 128×64 mesh). The platform's `transition360.js` already measures the frame rate and falls back to a
  plain cross-fade under 15 fps — the same guard belongs here.

## What productizing needs (a next board, Eliran's call)
1. The tour's 3D button plays the rise (tour → layer) and "צפו ב-360°" plays it in reverse (a dive into the chosen room) before the
   tour switches scene — the dive must end on that room's opening view (its `heading`, the tour's hfov).
2. The dollhouse page needs the scene's panorama + depth map: same-origin inside the tour (`panos/`, `depth/` already ship in the
   tour's dist), so no size added to the dollhouse file; inside the apartment page, only the plain cross-fade (no panos there).
3. The fps guard (reuse `transition360.js`'s FpsMeter), reduced-motion = a plain fade, and the acceptance + paint checks of this board
   extended to the transition (frame t=0 vs the tour's frame by a pixel difference).
Estimate: one board, a few hours, $0. Disclosure unchanged (the dollhouse's הדמיה caption; the prototype carries the badge too).

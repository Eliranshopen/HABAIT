# Shot recipes — how each shot type of a project film is made

Read with `video-division` §3 (the Galia lessons), §6 (rules) and §7 (commands). Every paid step goes through
`video/toolkit/bin/fal-gen.mjs`: dry-run first, a ledger row, `--go` only inside the storyboard estimate.
Endpoints and prices are taken from the toolkit's price notes at the time of the run — none is fixed here,
because none has been proven with this recipe yet (root §3).

Shared rules for every generated clip:
- Start from a real asset (the developer's render, a real photograph). The source is copied into the
  project's `assets/`; originals stay untouched.
- One slow move in one direction, 3–5 s of usable footage per clip; generate 5 s, cut the best 2–4 s.
- Prompt = the move + what may move (people, cars, leaves, water, light) + what must not change (the
  building: storeys, openings, balconies, façade pattern). Negative prompt carries
  `cables, hoses, cords, wires, pipes, extra objects appearing, extra floors, changed windows, warped lines`.
- Open every take. Count storeys and balconies against the source. A take that invents or loses geometry
  is re-rolled or trimmed to its honest part.
- `manifest.json` row per asset: inputs, hash, cost, `subject`, `disclosure`.

## R1 — Transformation hook (old site → empty plot → the project)

⛔ Only on Eliran's word (SKILL.md §6): it removes real buildings from real footage.

1. Frame A: a real drone still of the site, high oblique, the landmark (river, sea, park) in the top third.
2. Frame B: the same frame with the plot cleared to grass/earth — an image edit limited to the plot's mask.
3. Frame C: the same frame with the project placed on the plot — composite the developer's aerial render,
   matched for sun direction and scale against the neighbours; storeys counted.
4. Two image-to-video legs with first + last frame: A→B ("the buildings sink into the trees"), B→C ("the
   building rises from the ground floor by floor"). The second leg starts from the first leg's last frame.
5. Speed each leg to ≈ 1.5–2 s; the whole shot ≈ 4 s. Surroundings must be identical in A, B and C — diff
   the three frames outside the plot mask before paying.
6. Disclosure: property, AI-altered → badge for the whole shot.

Alternative when Eliran says no, or no drone frame exists: open on R2 and place the hook line there.

## R2 — Location map

1. Base: a tilted aerial of the area with the plot near the centre. Use a source whose licence allows
   marketing video; record the source and licence in the manifest. Grade it warm, slightly stylised.
2. Move: a slow push toward the plot over ≈ 5 s (scale 1.00 → 1.08 on a still is enough).
3. Overlays, built as HTML in the composition (`dir="rtl"`, Heebo):
   - the plot: a white 3 px outline with a soft glow;
   - the project pill: black, white bold text, the address;
   - 3–5 place pills: white, dark text, two lines — the place name, then «N דקות הליכה».
4. Minutes are measured on a map route from the plot's entrance, rounded up; the route source goes in the
   manifest. Never guessed.
5. No badge: a map is not a simulated property. The outline must match the real plot.

## R3 — Building shots from renders

| Variant | Source | Move |
|---|---|---|
| From the air | aerial render | lateral drift or pull-back and rise |
| Street corner | eye-level corner render | crane up + slight push; cars and pedestrians move |
| Dusk reveal | dusk render, windows lit | slow rise, front-on |
| Long façade | daylight elevation | lateral track along the street |
| Low angle | render looking up the balconies | crane up + tilt, sky grows |
| Insert | any tight detail (roof pool, corner) | orbit, ≤ 1.7 s on screen |

- One render gives one clip plus, at most, one tighter crop used as a second short shot (the reference's
  0.7 s and 1.0 s shots are such crops).
- Keep one dusk pair for the address; everything else in the same warm daylight.
- Disclosure: a render is a simulation of the property → badge.

## R4 — Lifestyle shots

Purpose: what life near the project feels like — one "calm" set (park, water), one "city" set
(promenade, boulevard, culture).

- First choice: **real footage or photographs of the real place**, animated gently. Then the place may be
  named in the caption and no badge is needed for atmosphere from a real photo (D-VID-3).
- Generated atmosphere (text-to-image → image-to-video) is allowed only as generic mood: the caption stays
  generic, people are AI-made → badge, and nothing in the frame may read as a specific real place.
- Composition that works: people walking toward the lens, camera retreating; low sun; a deep vanishing
  line (path, boardwalk, avenue, gallery).
- 1.8–3.3 s each; three in a row for the city set.

## R5 — Arrival (entrance and lobby)

- Source: the lobby/entrance render. Move: push in. Two people walk out toward the camera.
- Cut once to a tighter crop of the same clip (a jump-in) after ≈ 1.6 s.
- People are AI-made, the lobby is a simulation → badge.

## R6 — Interiors

- Source: the developer's interior renders only, checked against the sales plan (fidelity gate: openings,
  room proportions, what the windows look onto). No invented furniture, no changed view.
- Move: slow push toward the window, or a lateral slide. 1.75 s for a "category" shot (apartments,
  penthouses), longer when it leads into R7.
- Disclosure: unit → badge.

## R7 — The object wipe (inside → outside without a visible cut)

1. Pick two renders of adjoining spaces (living room + its terrace).
2. Clip 1: lateral slide in render A until a foreground vertical (curtain, column, plant, pillar) fills
   the frame. Clip 2: starts on a matching plain surface filling the frame, slides the same direction and
   clears onto render B.
3. Join on the frames where the occluder covers ≥ 90 % of the picture; match its colour and blur. If the
   model supports first + last frame, generate each clip toward/from a flat frame of the occluder colour.
4. The join takes ≈ 1.2 s; the whole shot 6–9 s. At most two per film.
5. The occluder must exist in the render or be a neutral surface — never a new architectural element.

## R8 — Captions

- HTML layer, `dir="rtl"`, Heebo regular, white, `text-shadow` soft dark, centred, baseline at ≈ 92 %.
- Size so the longest phrase fits the **narrowest** delivered ratio with a 5 % margin; if it does not,
  split the phrase — do not shrink the type.
- Timing table in `SCRIPT.md`: phrase, in, out. In/out land on a cut or ≥ 0.4 s away from one.
- Address ranges and numbers bidi-isolated.

## R9 — Badge, logo card, sound

- Badge: the division's amber «הדמיה · AI-generated» component, on for the whole length of every flagged
  shot, clear of the caption line.
- Logo card: black, the developer's logo centred at ≈ 60 % of the width, 2 s, hard cut in, no animation.
  The logo file comes from the developer; it is never redrawn.
- Music: one bed for the whole film (`fal-gen.mjs --kind music`, ledgered, or a licensed track with its
  licence in the manifest); calm, warm, no drop; end on the card.
- Voice: none until Eliran rules on AI narration; a human recording is transcribed, corrected, and the
  captions are timed to it.

## R10 — Formats

Compose a 16:9 master with every caption, pill and badge inside the centre 1:1 safe area, then export
9:16 and 1:1. The reference was cropped after the fact and lost text at both edges.

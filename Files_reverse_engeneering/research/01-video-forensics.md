# 01 — Video forensic analysis (Phases 1–2)

Reference: `../AQP6CrvT….mp4` (the only file in `Files_reverse_engeneering/`).
Labels: **OBSERVED** = visible in the video · **MEASURED** = computed from its pixels by a script in `tools/` (re-runnable) · **INFERRED** = plausible from the evidence · **VERIFIED** = confirmed by source code, metadata or docs · **UNKNOWN**.

## 1. The file
| Fact | Value | Label |
|---|---|---|
| Container | MP4 (isom), H.264 720×1280, 30 fps, 31.6 s, 948 frames; AAC audio 31.7 s | VERIFIED (ffprobe) |
| Encoder tag | `AVC Coding` (generic, a social-app re-encode); no creation software, no GPS, no project metadata | VERIFIED |
| Format | vertical reel; a 16:9 screen recording sits in a band at rows 438–842 (720×404); white captions above/below | MEASURED |
| Captions | "Claude can now build interactive real estate walkthroughs 🔥" / "Comment "property" for the free workflow" | OBSERVED |
| Audio | continuous, mean −14.3 dB, no silence ≥ 0.5 s; content not transcribed (no local speech model) | MEASURED / UNKNOWN |

**What it is:** a creator's social reel showing a screen recording of a web page (a walkthrough built with an AI assistant, per the caption). The caption is a marketing claim; it is not evidence of which tools made the imagery. **The tools behind the pictures are UNKNOWN; everything below about them is INFERRED.**

## 2. Timeline (frames in `keyframes/`, `frames/`, `contact_2fps.jpg`)
| t (s) | What happens | Label |
|---|---|---|
| 0–3.5 | Aerial still of a tower in a Dubai-Marina-like skyline, slow push | OBSERVED |
| 3.5–6.5 | Continuous fly-in to the tower's facade and through a balcony window into the unit (real camera translation: parallax) | OBSERVED, MEASURED (single-homography inliers only 0.55–0.66 at 2–5 px shifts) |
| 6.5–7.4 | Hand-off to the interior viewer (fast cross-dissolve / swing) | OBSERVED |
| 7.5–10.5 | Living room: user drags, hotspot "Dining area" | OBSERVED |
| 10.5–14.4 | User drags the **Explore the light** slider: 14:00 → 16:31 → 22:00 (night) → 20:21 → 17:33 → 14:28 | OBSERVED |
| 14.4–15.4 | Tab "Marina outlook": the view **rotates** to the window (same room) | OBSERVED, MEASURED |
| 15.4–22.9 | Balcony node ("WRAPAROUND BALCONY / DRAG TO EXPLORE"), drag around, hotspot "Return to living room" | OBSERVED |
| 23–28.5 | Back in the living room, more drags | OBSERVED |
| 28.5–31.6 | "Floor plan" tab → modal "Explore your residence · Illustrative layout" (Bedroom, Bath, Living room ↗, Balcony ↗) over a blurred, slowly rotating backdrop; click → balcony | OBSERVED |

## 3. UI inventory (`ann_ui_elements.png`)
1 brand "MEC RESIDENCES / DUBAI" + room label + "DRAG TO EXPLORE" · 2 "← Back" / "Building" · 3 **Explore the light**: slider with Morning · Day · Sunset · Night ticks + a live clock (HH:MM) · 4 tabs Living room · Dining area · Marina outlook · Balcony · Floor plan · 5 custom circular drag cursor · 6 hotspot pills with ↗ · 7 "360° · Drag to look around" hint · floor-plan modal labelled "Illustrative layout". All OBSERVED. Only two room nodes are ever entered (living/dining, balcony); Bedroom and Bath are on the plan but never shown — whether they exist is UNKNOWN.

## 4. Navigation: panorama, not free 3D (MEASURED → INFERRED, high confidence)
`tools/motion_model.py` (ORB features, UI masked, RANSAC homography, fixed seed) → `motion.csv`.
- Inside a room, frame-to-frame motion of **50–180 px** is explained by ONE homography with 70–94 % inliers and ~0.6 px error, i.e. a **pure rotation about a fixed eye point**, exactly what a 360° panorama viewer produces. The aerial fly-in (real camera travel) scores worse at 2–5 px.
- No parallax between near objects (column, island) and far ones (window) during drags. OBSERVED.
- Strong rectilinear stretch at the frame edges on the balcony (wide FOV, ~100°+). OBSERVED.
- Tabs = animated yaw/pitch tweens inside the same panorama (14.4–15.4 s). OBSERVED.
- Room change = a different panorama node (balcony is its own eye point).
- **Conclusion:** per-room equirectangular (or cube) panoramas in a web viewer; no free movement; no real-time 3D. Which library (three.js sphere, Pannellum, Marzipano, PSV) is UNKNOWN — the viewer chrome is custom.

## 5. The Day/Night feature (HIGH PRIORITY)
### 5.1 What the slider does (MEASURED, `dense/`, fit script inline in this report's commands)
Each frame during the slider drag was fitted by least squares as a mix of three fixed frames: day (t=10.0, 14:00), sunset (t=12.93, ~17:3x), night (t=11.6, 22:00):
| t | day | sunset | night | residual /255 |
|---|---|---|---|---|
| 11.07 | 0.15 | 0.86 | 0 | 2.8 |
| 11.20 | 0.02 | 0.61 | 0.35 | 3.1 |
| 12.53 | 0 | 0.45 | 0.55 | 2.3 |
| 13.33 | 0.42 | 0.58 | 0 | 2.1 |
| 13.60 | 0.73 | 0.27 | 0 | 2.2 |
- At every instant **at most two adjacent keyframes** are non-zero and the weights sum ≈ 1 → a **piecewise-linear opacity cross-fade between pre-made images**, keyed by the clock. Residual ≈ 2/255 = compression + cursor.
- The sun patch does **not slide** across the floor between 14:00 and 17:33; it fades out in one place and fades in at another (double, ghosted patches at mid-weights). A real-time sun would move continuously. → **Not real-time relighting.**
- The three states are registered to each other at **0.05–0.1 px** (phase correlation on edges): same camera, same framing.
- "Morning" is never reached in the video; whether a morning keyframe exists is UNKNOWN (likely, from the tick).
- The camera is static while the slider moves; whether the cross-fade covers the whole panorama or only the current view is UNKNOWN (only one direction is seen), but a per-node set of N equirects with a shader mix is the simplest consistent design (INFERRED).

### 5.2 How the night look was made
`ann_day_sunset_night.png`, `ann_detail_crops.png`:
- Night: blue-hour sky, lit city windows, interior cove LEDs on (ceiling slot, under-cabinet, toe-kick), pendant glowing, glass shows interior reflections faintly, exposure lifted on the interior. OBSERVED.
- Sunset: low warm sun streak on the upper cabinets and column; deeper shadows. OBSERVED.
- **Small objects change between states while the architecture stays pixel-aligned**: the jars and pot on the kitchen counter differ in number and shape between day and night. OBSERVED. This is the typical signature of a **geometry-preserving AI image edit** ("relight this image to night") applied to one base image, not of three renders from one 3D scene (a renderer would keep every object). **INFERRED, medium-high confidence.**
- The base imagery itself (generic Dubai Marina towers, a fictional "MEC Residences", a floor plan labelled "Illustrative layout", the balcony's curved glass that doesn't match the room's straight walls) reads as **AI-generated 360 panoramas**, not as a model of a real plan. INFERRED, medium confidence.
- The aerial intro reads as an **image-to-video** clip (smooth dolly with plausible but soft facade detail). INFERRED, medium confidence.

### 5.3 The four architectures, judged against this evidence
| Option | Consistent with the video? | Why |
|---|---|---|
| A Real-time 3D | **No** | no parallax, sun patch fades instead of sliding, details hallucinate |
| B Pre-rendered panoramas + cross-fade | **Yes** (the mechanism) | linear 2-keyframe blend measured |
| C Hybrid (precomputed lighting + live control) | Yes, as B with a clock → weight mapping | the clock is continuous, the images are discrete |
| D AI-generated variants inside B | **Yes** (the most likely source of the images) | object drift between states |
**Most plausible reconstruction: D feeding B** — AI 360 panoramas per room → AI relight to sunset/night (and probably morning) → a custom web panorama viewer that maps the clock to a cross-fade between the two nearest keyframes. INFERRED.

## 6. Quality observations
| Aspect | Observation | Label |
|---|---|---|
| Geometry | plausible, consistent within one node; across nodes not checkable against a real plan (the plan is "illustrative") | OBSERVED |
| Materials | travertine walls/floor, wood veneer, fabric — convincing at video resolution; textures soft (AI/encode) | OBSERVED |
| Lighting | warm GI look, soft contact shadows, sun patches with soft edges; night interior "designer" lighting | OBSERVED |
| Glass | reflections weak/absent in day; faint interior reflections at night | OBSERVED |
| Tone | warm grade, highlights rolled off (filmic-like), no clipping in windows | OBSERVED |
| Resolution | viewer at ~1440 px wide on screen; source pano resolution UNKNOWN | — |

## 7. What this means for Habait
The reference's **look** comes from AI imagery; its **feature** (the light slider) is a simple, cheap cross-fade. Our hard rules (fidelity to the sales plan, add-only, disclosure) forbid AI-hallucinated geometry, but nothing stops us from producing the same keyframes **deterministically** in Blender (same scene, same camera, 4 lighting rigs) — which also removes the object drift seen here. See `05-architecture.md` and the PoC in `../poc/`.

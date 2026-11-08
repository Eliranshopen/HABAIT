# HANDOFF — flyover3d (:8899), habait-89 → habait-98 · 2026-11-02 ~20:00

The hold stage of the buyer flow (Eliran's ruling 13:15: step 2 = this viewer, condition: realism; 13:20: the apartment picker is a must;
~18:30: "ריאליזם מההתחלה עד הסוף" → no real-time 3D of the tower in the buyer flow). Source of truth for the product flow: C:\RnD\Projects\Habait\memory.md §4.
Benchmark history + decisions: ../README.md (sections A–F). Spend by this session today: $22.82 (../ledger-*.json). No open fal jobs.

## Run

```
cd C:\RnD\Projects\Habait\research\fal-bench-2026-11-02\flyover3d
python -m http.server 8899 --bind 127.0.0.1          # ThreadingHTTPServer; plain GETs only, no Range needed
```
Dependencies at runtime (must be up): :8850 (habait-ab's platform: css/style.css, js/picker.js, js/i18n.js, js/analytics.js, js/lead.js,
fixtures/rainbow/{units,project}.json) and :8848 (the apartment tour, hand-off target). Without :8850 the picker import fails → page error.
Screenshots for QA: `python shot.py <url> <out.png> [wait_s]` (CDP; waits, prints console/exceptions + the status line, saves PNG).

## Files the page loads

index.html, app.js, picker.js (ONLY loadUnits + placeUnits now; pills/card come from :8850/js/picker.js), lib/{three.module.js,
three.core.js, OrbitControls.js, GLTFLoader.js, BufferGeometryUtils.js, SkeletonUtils.js} (three r17x from C:\RnD\Projects\Habait\tools\js-sandbox,
imports rewritten to relative), data/nodes.json, data/site_nodes.json (16's export), data/units_real.json (engine box_world), data/units_fixture.json
(fallback), data/site.glb (50 MB, habait-16's export, APT846_* meshes tagged), data/site_baked.glb (ab's bake, only with ?glb=baked),
data/<node>.jpg + data/<node>.depth8.png for a,b,c,d,e,f,o1..o5, data/video/descent-846.mp4.
Intermediates, safe to delete: data/*.depth.png, data_d/, data_ring/, server.log, glbtest.html.

## v3 of the hold (habait-98, 2026-11-02 evening, after Eliran's feedback on the live link)

Eliran: a black "טוען פנורמת סביבה node-o5-orbit…" screen after the orbit video "יכול לגרום לנטישה של לקוחות, צריך שהכל יהיה בפלואו זורם";
the picker "נתקע". What changed (app.js + index.html):
- **Load order:** the hold needs only node-b + the picker, so only those load before the hold opens (~1.3 MB; panos decoded with
  createImageBitmap off the main thread, uploaded with renderer.initTexture). Nodes a/c/d load in the background (d first: the terrace
  landing). The 50 MB site.glb, the sun/shadows and the ring nodes o1…o5/e/f load ONLY for the debug flights (`?t=`, `?fly=3d`,
  `?intro=1`, the "חזרה למעוף" button) via ensureSite()/loadExtras(). The deploy (tools/deploy-vercel/stage_flow.py) no longer ships
  the glb, the 16-bit depth PNGs or the backups.
- **`?orbit=<clip>` (ab's shell links here with it, project.json exterior.intro.mode = "inline"):** index.html starts the clip inline,
  full-screen, BEFORE the module is fetched (no overlay, no text; "דלג" button). The cut happens when the clip is over AND the hold has
  rendered its first frame (`window.__hold.ready`); otherwise the clip's last frame (= the hold pose) stays with a 3 px progress line.
  The ease onto the units starts only after the clip is gone. `?ease=0` keeps the video's end pose (for cut alignment checks).
- **Cut alignment:** camera.json end_pose == our hold pose (node-b, pitch -2°, HFOV 65.5) — measured horizon rows 335–370 on both. The
  remaining step was colour: data/node-b-tower.jpg is now colour-matched (LAB mean/std, 80 %) to the clip's last frame; the original is
  data/node-b-tower.orig.jpg (not deployed).
- **Picker:** `#pickerStage > * { pointer-events: auto }` in index.html overrode ab's `.picker-chrome { pointer-events: none }` and the
  full-screen chrome swallowed every click → removed; only .sheet/.drawer are forced to auto. ab's resolveOverlaps() measured compact
  pills and flipped them 52↔151 px every frame → reported to habait-4b with the fix (cache the full width); stage_flow.py patches the
  STAGED copy until the source is fixed. Units behind the facade (837/847/857, ≥4 m farther and within 14 px of a nearer pill) are hidden
  at the hold (they stay in the drawer). Clicking a pill → card → "המשיכו אל הדירה" → descent clip → terrace → tour: verified by
  tools/deploy-vercel/qa/qa_chain.cjs and qa_orbit_inline.cjs (desktop + mobile).
- **Sound (Eliran 2.11 evening: "סאונד רקע של ציפורים מצייצות וגלים"):** data/audio/ambience.m4a (24 s loop, README there) plays from
  the first frame of the clip through the hold, fades out on "להיכנס לדירה"; speaker button top-right; if autoplay with sound is refused
  the page starts it on the first tap. `window.__sound` for QA.
- **Debug surface:** `window.__hold` {ready, siteLoaded, clipShowing, nodesReady(), units}. Console: "orbit clip -> hold after N ms".

## v4 (habait-ba = 98, 2026-11-02 ~19:30, after LOOKING at the live flow frame by frame — qa/qa_visual.cjs)

What the screenshots showed: the cut video → hold was a visible jump (89's ease pitched the camera 12° down, the 2048 pano is ~4× blurrier
than the 1280×720 clip, the painted horizon bows); the descent clip ended ON the terrace but the hold then showed node-d (outside the
railing, warm tint) and asked for another click. Fixes, all $0:
- **No ease by default** (`?ease=1` restores it): the hold stays on the clip's end pose; the pills sit in the lower half (floors 14–19 are
  ~12° below the camera), 826 may touch the legend row.
- **node-b pano = 4096×2048 with the clip's last frame pasted in** (perspective → equirect, HFOV 65.5, pitch −2°, lon ±33°, lat −22..+18,
  48 px feather; `data/node-b-tower.jpg` 1.4 MB; recipe in habait-ba's RESUME entry): the hold's centre is pixel-identical to the video;
  dragging reveals the (blurrier) pano around it. Original 2048 pano: `node-b-tower.orig.jpg`.
- **Descent clip → the apartment tour directly:** on "המשיכו אל הדירה" the tour (tourUrl()) loads in a full-screen iframe `#tourFrame`
  behind the clip; when the clip ends the iframe fades in (z 4 < clip z 5), the hold's render loop halts, ambience fades. The tour's
  "חזרה לבניין" has target=_top → the top page returns to the hold URL (without ?orbit). `?stop=terrace` = the old node-d stop + "להיכנס
  לדירה" button. node-d colour-matched to the clip's last frame (orig kept) for that path.
- Platform index.html (1d/4b): "fixture" tag, backup link and "תצוגת פיתוח" footer only with `?dev=1` or on localhost.

## v5 — the LIVING HOLD (habait-ba, 2026-11-02 evening; Eliran on the static 360: "סטטי ולא דינאמי ולא ריאליסטי")

**v8 (deploys 29–31, 2026-11-03 11:00–):** the hold is THREE frame tracks of the same Kling look (Eliran: zoom-out and rotation must stay on
the same rendering, never the GPT sphere): `data/holdarc` (idle glide, ±45° orbit), `data/holdpan` (drag = a 360° turn in place, loop;
clay from `Habait/studio/tools/hold_pan_clay.py`, Kling v2v 7 s), `data/holdpull` (wheel/pinch out = the orbit video's last 6 s reversed,
frames 265..409 of orbit_real.mp4, camera from orbit/camera.json). Each track = manifest.json (+ `lo` tier, `loop`) + camera.json with
matrix_world per frame; every switch eases through the hold pose (each track's centre / pull index 0 = the orbit clip's end frame).
holdarc.js `openTrack/loadTrack/toHoldPose/switchTo`; app.js only calls createArcHold({canvas}); the v7 sphere hand-off code is unused.
stage_flow.py ships a DISABLED manifest for a track without Kling frames (the viewer degrades: no pan → drag scrubs the arc; no pull →
wheel is a digital zoom). To redo a track: clay → mp4 (ffmpeg 24 fps) → run_fal.py with its kling_args.json → the post script
(frames → jpg + jpg_lo, manifest dir=jpg, ORB check of the centre frame vs qa/_out/orbit_last.png).

**v6 (deploy 22, 2026-11-03 08:05):** the idle drift became a continuous glide along the arc (`GLIDE_FPS`, `GLIDE_ACCEL` in holdarc.js; `arc.glide = true` only once the clip is gone), `manifest.lo` = a 640×360 tier loaded first (`data/holdarc/jpg_lo`, made with `ffmpeg -i arc_real.mp4 -vf scale=640:360 -q:v 5`), `manifest.hi` optional for big screens (unused: the 1080p Kling run did not track the camera — check ORB per frame before using any new run), `#dragHint` chip in index.html/app.js.

**Live since deploy 18 (2026-11-03 06:00).** Kling 4.0 v2v (`kling/v4/video-to-video/edit`, 7 s, 720p, $1.50; the first request died in fal's
`generation_timeout` after >75 min, the retry took 97 s) → `data/holdarc/jpg/frame_0001..0169.jpg`, manifest `dir: "jpg"`. Continuity of the
centre frame (91) vs the orbit clip's last frame: ORB scale 0.999, 4 px. holdarc.js: drag velocity capped at ±1.6 frames per 16 ms (a touch flick
threw the arc to its end), throws early on a manifest with `disabled`/`frames: 0` (stage_flow writes that when the local manifest still points at
clay) so app.js falls back to the sphere with no 404. QA: `tools/deploy-vercel/qa/qa_arc.cjs <base> <out> [mobile]`. To re-render the arc with a
different look: regenerate `arc_clay.mp4` from `frames/` (168 frames = 7 s), edit `kling_args.json`, run `run_fal.py`, then the post script
(frames → jpg, manifest, ORB check) — the one in this session's scratchpad is 20 lines; rewrite it from this paragraph if lost.

- `holdarc.js` + `data/holdarc/`: the hold is a scrubbable, pre-rendered ARC of frames around the facade. Clay: `Habait/studio/tools/
  hold_arc_clay.py` (imports ab's orbit_clay.py without its main(); same scene/lens/light) → 181 frames, ±45° around the tower axis at
  node-b's radius/height, frame 91 = exactly the orbit clip's end pose → `frames/`, `camera.json` (matrix_world per frame), `arc_clay.mp4`
  (frames 1–168 = 7.0 s for Kling). Real: `arc_real.mp4` = Kling 4.0 v2v (kling_args.json: @Image1 = the orbit's last frame for continuity,
  @Image2 = ab's node-b ref) → `jpg/frame_%04d.jpg` (1280×720) + `manifest.json` (`dir: "jpg"`; with `dir: "jpg_clay"` the deploy skips it).
- Player: canvas cover-fit (same geometry as the <video>), centre frame first then every 6th then the rest; drag = scrub (right = camera
  moves right), inertia, idle drift ±4° / 9 s around where the buyer left it; pills projected per frame from camera.json (Blender camera:
  -Z forward, +Y up; fx = lens/(sensor/2)); `goCentre()` before the descent clip so the clip starts from its own first frame. `?hold=360`
  = the v4 sphere. `window.__hold.arc` = {active, index, loaded, N}.
- `birds.js`: a few flapping silhouettes crossing the upper sky over the clip and the hold (Eliran: "לראות גם ציפורים עפות"); off during
  the descent clip and the tour.
- Sound v3: `data/audio/ambience.m4a` = garden birds with gaps (README there); v2 read as crickets.
- Caption: `data/sales-plans/legal/caption-v1.json` short_project on the clip (#clipLegal); the picker chrome carries its line at the hold.
- Tour hand-off adds `ui=min` (tour.js/tour.css quiet chrome). The picker's legend row sits at the inline-start edge on wide screens.

## URL params

| param | effect |
|---|---|
| (none) | start at the HOLD (node-b pose), picker visible, 2 s ease of the view onto the units (stops at first drag) |
| `t=0..1` | start at that path parameter (debug). Node parameters: a 0.000, b 0.723, c 0.954, d 1.000 (NODE_T, see lessons) |
| `intro=1` | 3D orbit intro (ring nodes o1..o5 as sky) → descent → hold. Experimental; the product orbit is ab's VIDEO |
| `orbit=<mp4>` | play the clip full-screen from the first frame while the hold loads behind it; cut when both are ready (v3; the shell links with it) |
| `hold=360` | v5: the 360 sphere instead of the living arc |
| `ease=1` | v4: restore 89's ease onto the units after the cut (default = stay on the clip's end pose) |
| `stop=terrace` | v4: stop at node-d (outside the terrace) after the descent clip instead of going straight into the tour |
| `fly=3d` | after the click: the PBR 3D flight instead of the clip (debug; rejected by Eliran for the product) |
| `glb=baked` | load site_baked.glb (ab's UV bake) with its own unlit textures |
| `mode=project` | old pure-projection look (rejected) |
| `tour=<url>` | hand-off target override (default http://127.0.0.1:8848/?scope=apartment&room=terraceLiving&floor=parquet&video=0) |
| `return=<url>` | passed to the tour as `return=` (default: this page's URL) |
| `sid=`, `project=` | passed through (sid → tour; project → :8850/fixtures/<project>/project.json) |
| `units=<url>` | units.json source (default :8850/fixtures/rainbow/units.json); `boxes=<url>` = engine units.json with box_world (default ./data/units_real.json) |
| `auto=fly` / `auto=select` | test hooks: click 846 at 1.5 s / open 846's card at 3.5 s |

Hand-off URL built by `tourUrl()`: tour + `scope=apartment&from=flight` + sid + return. The tour lands at yaw −114 (slider + living room) by itself.

## Constants / poses (plan-world: X right, Y up the sheet, Z up, metres; unit floor z 0, ground −51.2)

- HOLD = node-b-tower (68.4477, −47.2597, 17.7875), horizontal look toward (8.765, −9.9516), pitch −2°, HFOV 65.5° at 16:9 (camera vfov
  computed from that). This is where ab's orbit video ends (last 12 frames static). T_HOLD = NODE_T[1].
- Apartment hotspot / flight end look: site_nodes.json `apartment_hotspot_world` = (10.325, −11.148, 1.0) (846 slider centre).
- Flight spline: CatmullRomCurve3 through node positions a→b→c→d (centripetal, 0.5). Node c = facade (23.31, −20.89, 3.19), d = terrace (14.85, −14.11, 2.02).
- Units without box_world: anchor = hotspot, bays {…5: −9 m, …6: 0, …7: +9 m} along the facade tangent, floors (f−16)×3.2 m (floor pitch 3.2; 2.9 is the room height).
- Sun for the PBR debug mode: from node-a pano u≈0.11, v≈0.17.

## Data pipeline

1. `stitch_depth.py --project <apt846 project> --out data --width 2048 [--node …] --rgb-dir <skins dir>`: per node, equirect DEPTH from the six
   `depthcm_000N.png` faces in `renders/clay-nodes-ortho/<node>/` (falls back to clay-nodes/), EXACT mapping of tools/cube2equi.py
   (centre u=0.5 = centre_look, u clockwise from above, v 0 = zenith; planar depth / cos → ray distance). Writes `<node>.depth.png`
   (16-bit cm, 65535 sky), `<node>.jpg` (RGB from `<rgb-dir>/<node>.{webp,png,jpg}`, fallback clay-pano-ortho) and nodes.json.
   Skins: tour360/apartments/apt846/_local/panos-ext/<node>.webp (c = .v2), terrace per floor panos-ext-<floor>/node-d-terrace.webp.
2. depth8 encode (inline python in the session, re-create as a script if needed): `enc[...,2]=(d>>8)&255; enc[...,1]=d&255;`
   `enc[...,0]=near-mask` where near = (d<60000) → MORPH_CLOSE 31×31 → dilate 17×17. The shader reads R*256+G = cm, B<0.5 = "sky-ish".
3. Ring/extra nodes went through `--out data_ring` then copied into data/ and appended as `nodes.json.extra`.
4. Descent clip: `ffmpeg -i ../B-flyover/kling-4-full-flight.mp4 -vf "select='between(n,95,200)',setpts=N/24/TB,scale=1280:720" -an … data/video/descent-846.mp4`
   (frame 96 ≈ node-b view, frame ~200 = at the slider). Per-unit clips: clay descent (render_shots flight shot node-b → unit terrace, ~240 fr)
   → kling/v4/video-to-video/edit with the node skins as @Image refs (../bench.py has the call shape) → cut. Needs Eliran's word per batch.

## Rendering (app.js)

- Hold and landing = the node's skinned 360 as a FULL sphere (sky shell with `full=1`, renderOrder 50, depthTest off); between nodes the
  sphere of each path node fades in within ±0.02 of its NODE_T (landing window 0.06).
- Sky shell otherwise = the AERIAL node (a) only: fragment shows the pano where `full || v<0.5 || nearMask==0`, else `discard` (the glb shows through).
  Ring nodes are used as sky only during `?intro=1` (pickSky by azimuth).
- HYBRID (default): STUDIO_mass*/APT846_* → PBR materials (white slabs, glass, mullions, bushes), STUDIO_ortho keeps its texture, everything else
  (OSM nb, podiums) → projective ShaderMaterial sampling the 4 main nodes with depth visibility. Only visible in `?fly=3d` / `?t=` now.
- Picker: `createPicker({units, container:#pickerStage, i18n, analytics, project, canEnter: id==='846', onEnter→flyToApartment})`,
  `picker.update(projectUnit)` every frame; projectUnit returns null off the hold / during the clip. `--picker-bottom: 16px`.
- Click: `playClip(descent)`; landing scene is set at 1.2 s regardless, clip ends on ended/error/stalled+3 s/9 s timeout.

## Lessons only I knew (now written)

1. `CatmullRomCurve3.getPointAt` is arc-length parametrised: node i is NOT at i/(N−1). NODE_T is found by nearest spaced point (4000 samples). The first
   version put the "hold" at 1/3 → 160 m from the tower (pills tiny, bottom of frame).
2. depth8.png channels: R = high byte, G = low byte (centimetres), B = dilated near-object mask. Sky = 65535 → R=255,G=255.
3. Headless Chrome runs requestAnimationFrame ONCE unless started with `--disable-renderer-backgrounding --disable-background-timer-throttling
   --disable-backgrounding-occluded-windows` and `Page.bringToFront` (shot.py does); otherwise every screenshot is frame 1 and eases/animations look broken.
4. The sky shell must come from the aerial node only and be transparent where the pano is near/below horizon; mixing nodes gave flat blue columns
   and ghost towers (what Eliran saw at 15:xx).
5. GPT paints the tower taller than the clay, so depth-based masks miss its top; hence the dilated near-mask (and, earlier, a tower-direction band).
6. Pure projection of 4 panos onto the tower smears off-node and mismatches colours (rejected); baked UV (ab) is fine far, soft near.

## Open

- box_world for the 11 non-846 units (engine card 03; file Habait/engine/_local/rainbow/units.json, ids apt846-style) → pills exact.
- Descent clips per unit (see pipeline 4). Orbit video = ab (Habait/flyover/orbit/orbit_real.mp4, ends at the hold pose).
- he/en: the picker handles its own strings; my HUD (top-left buttons, status) is Hebrew only.
- Mobile untested. Two Vercel copies (98: habait-flow.vercel.app/hold/, 5a: habait-flyover-rainbow.vercel.app) — Eliran to pick one.
- `data/units_fixture.json` is ab's fixture with 11 invented units (placeholders).

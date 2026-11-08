# C — the film (track 2) and the apartment (track 3): code map for git-worktree features
<!-- 2026-11-04 · read-only research · repo `C:\RnD\Projects\Habait\habait-walkaround`, baseline 35cc0f6 · paths below are relative to that repo unless they start with C:\ -->

## 0. The five facts that decide the split
1. **Almost none of the film media is in git.** `.gitignore:8` ignores every `_local/`. `flow.cine.json` points every clip, poster, camera and hold frame at `Habait/platform/_local/segments/rainbow-cine/` (`flow.cine.json:240,277,363,395`); `git ls-files | grep _local/` = 0 files. A fresh worktree has the JSON and no film. Only the OLD flow's 4 mp4 are tracked (`Habait/platform/fixtures/rainbow/{approach,descend-846,orbit_real,intro-approach-interim}.mp4`).
2. **The ACTIVE `exterior-film` board is outside this repo.** Its files are `C:\RnD\Projects\Habait\research\fal-bench-2026-11-02\flyover3d\{index.html,app.js,data/video/building-film-*.mp4}` (`.wt/exterior-film/manifest.json`), not under `habait-walkaround`. `openBuilding()` lives in that `app.js`. It cannot be a worktree feature of the product repo until those files move in.
3. **`flow.cine.json` is generated** ("do not edit by hand", line 2) by `Habait/platform/tools/build_segments.mjs` from an untracked engine manifest `Habait/engine/_local/apt846-project/video/manifest.json` (lines 7-11). One file = all segments = the film's conflict point.
4. **Apartment scene data is generated from one table.** `cameras.json` (11 scenes) → `tools/make-scenes.mjs` → `scenes.json` (11 interior + 11 exterior scenes, hotspots computed, not hand-placed). `guide/guide.json`, `prompts.json`, `skin-prompts.json`, `polish-prompts.json`, `plan.general.json` are also one-file-for-all-rooms.
5. **Per-floor-finish panoramas, floor-plan, built tour, cine clips are all untracked** (`dist/` via `Habait/tour360/.gitignore:2`, `_local/`, `floorplan.webp` via `.gitignore:17-18`, `360walkaround/.gitignore:51` `tours/apt846*/renders/cp-*/pano.webp`). Tracked per room: `panos/{balanced,original,thumb}/<NN-room>.webp`, `depth/<room>.png`, `guide/he/<NN-room>.{mp3,mp4,mp4.json}`, and the cp-room `pano.render.json` + log.

## 1. Track 2 — the film

### 1.1 What "the film" is today: four layers that overlap
| Layer | Where | State |
|---|---|---|
| **A. Cine flight** (the default of `flow.html` / landing arm B, prod habait-flow) | `Habait/platform/fixtures/rainbow/flow.cine.json` + `js/cine.js` (573 lines) + `js/flow.js` (cine boot `flow.js:59-92`) | LIVE |
| **B. 360-stills chain** (tour's exterior scenes; what the `/hold/` button opens today) | `Habait/tour360/apartments/apt846/exterior.json` + the exterior entries of `scenes.json` + `panos/balanced/node-*.webp` (11 tracked equirects) | LIVE, being replaced by C |
| **C. Building film** (the exterior-film board: orbit → facade arc → descent, 28.4 s, 720p → Topaz 1080p) | `research/fal-bench-2026-11-02/flyover3d/` (outside repo), working copy `C:\RnD\.wt\exterior-film\work\building-film-720.mp4` | EXECUTING (A2 paid test $0.16 done; full upscale planned $0.57; ledger `C:\RnD\development\tasks\exterior-film\logs\spend-ledger.txt`) |
| **D. Blender source config** (how the clay flight is defined, input of the Kling pass) | `Habait/flyover/equirect/path.json` + `render_segments.py`, `Habait/flyover/orbit/{camera.json,orbit_clay.py,kling_args.json}`, `Habait/flyover/enter.py` | tracked scripts; renders/frames ignored (`.gitignore:30-38`) |

### 1.2 The segments in order (layer A, what the buyer sees) — `flow.cine.json:230-end`
| # | Segment id | What it is | Defined by | Made how (vendor, cost) | Evidence |
|---|---|---|---|---|---|
| 1 | `orbit` ("סביב המגדל"), 409 f / 17.04 s, 1280x720 | clockwise drone orbit around the tower, ends descending toward the facade (the approach from Sde Dov is the first third of it) | JSON entry `kind: flat-video`, `src …/rainbow-cine/orbit.mp4`, `camera: orbit.camera.json`, `junction → hold-facade` 0.5 s crossfade (`flow.cine.json:232-266`); camera path = Blender clay `flyover/orbit/orbit_clay.py` + `orbit/camera.json` | **GENERATED**: Kling 4.0 v2v edit (`fal-ai/kling/v4/video-to-video/edit`) over the clay render `orbit_clay_17s.mp4`, 2 reference stills; $3.30 (`manifest.dev.json`, `orbit_real.mp4.json`; plan text says $3.20) | `Habait/flyover/orbit/kling_args.json` (prompt), `rainbow-cine/manifest.dev.json` |
| 2 | `hold-facade` ("מול החזית · בחרו דירה") — **the stop in front of the building** | 169 JPEG frames of a camera arc, rest frame 65 (frame index of the orbit's end pose); the buyer drags the arc, 12 unit pills projected per frame from `units.json` boxes; unit card = `js/picker.js` | JSON entry `kind: frames`, `dir …/rainbow-cine/hold-arc`, `pattern frame_%04d.jpg`, `rest_frame 65`, `units_at_rest` (12 units), `junction → descend-846` 0.6 s (`flow.cine.json:267-352`); behaviour in `cine.js:122-275` (drag, glide, rubber band, zoom) | **GENERATED**: Kling v2v on a clay arc, $1.50 (`manifest.dev.json`: `rest_frame 91` there vs 65 in flow.cine.json = re-measured, card 35) | `manifest.dev.json`, `flow.cine.json:288` |
| 3 | `descend-846` ("rise to the floor / descent"), 106 f / 4.42 s | camera glides from the facade to 1.5 m outside opening o-5 of unit 846 (floor 16) | `kind: flat-video` `flow.cine.json:354-385`; Blender path in `flyover/equirect/path.json` segment `descend-846` (anchors node-b → e → f → c → d → o-5+1.5 m) | **GENERATED**: Kling v2v, $3.20 for the WHOLE flight (frames 95..200 of `kling-4-full-flight.mp4`); `-9°` pitch junction from the hold | `manifest.dev.json`, `path.json` |
| 4 | `enter-846` ("hand-off into the apartment"), 208 f / 8.67 s | walk through o-5 into the living room, ending on the tour's own living pano | `kind: flat-video`, `handoff` block (`room: living`, pano `handoff-living.webp` from `tour360/dist/apt846/panos-parquet/04-living.webp`, `hfov 65.47`, `turn_s 3`, `crossfade_s 0.5`, `tour_params`, `registration`) `flow.cine.json:386-end`; code `cine.js` bridge + `flow.js` `prepareTour/revealTour` | `manifest.dev.json` says frames 201..408 of the same Kling flight ($0 extra); the repo also has the $0 Blender projection-mapping alternative `flyover/enter.py` (no generative calls). Which one produced the shipped `enter-846.mp4` is **not proven here** — check `rainbow-cine/dev/` | `manifest.dev.json`, `flyover/enter.py:1-25` |
| 5 | tour hand-off (not a clip) | the tour iframe opens at the living room at the same yaw; "return to this hold" | `handoff.tour_params`; the tour viewer `tour360/viewer/tour.js` (1472 lines) | real tour panos (apartment track) | `cine.js` header lines 1-13 |
Not in the shipped cine JSON: `hold-ring` (240 f, `preview: true`, Kling 360 ring "failed as a product", $1.88) — only in `manifest.dev.json`.
Cross-cutting, in the same JSON: `start`, `hold`, `defaults`, `focus_x 0.47` (cover-fit crop shared by all clips), `caption` (ai-visualization-v1 disclosure he/en), `units{12 boxes}` (`flow.cine.json:12-229`). Also: birds layer `cine.js:277+`, title overlay, junction crossfades.

Layer B order (`scenes.json` / `exterior.json`): `aerial → orbit1 → orbit2 → orbit3 → orbit4 → orbit5 → tower` (hold: the buyer takes control, `scenes.json` tower hotspots `approach45, aerial`) `→ approach45 → approach25 → facade → terraceOut → (terraceLiving, interior)`. Each = one tracked equirect + `autoNext/autoDwellMs 1500`. Paid GPT-skin per node (`flyover/skins-extra/skin_nodes.py`, ledger `skins-extra/ledger.json`).

Layer D (render config, `flyover/equirect/path.json`, 624 frames @24 fps): `approach` 192 f polar spiral (r 520 m, z 230 → orbit first), `orbit` 240 f (reuses `orbit/camera.json`), `hold-facade` 72 f seamless loop at node-b, `descend-846` 120 f Catmull-Rom. Cycles panoramic equirect, local CPU or Kaggle (`render_segments.py`, `cloud/`). **The segment names match layer A and C**, so a segment is a stable unit across all layers.

### 1.3 Can it be split per segment? Yes, with one shared file split
| Item | Per-segment (owned) | Shared (conflict point) |
|---|---|---|
| orbit | `flyover/orbit/**`, `rainbow-cine/orbit.*`, `path.json` segment `orbit`/`approach` | |
| hold-facade | `rainbow-cine/hold-arc/**`, `hold` code `cine.js:122-275`, `fixtures/rainbow/units.json` pills | `flow.cine.json` entry, `cine.js` (one 573-line file mixes hold, birds, junctions, bridge) |
| descend-846 | `rainbow-cine/descend-846.*`, `path.json` segment | |
| enter-846 / hand-off | `flyover/enter.py` (+`enter/_local`), `rainbow-cine/enter-846.*`, `handoff-living.webp` | `flow.cine.json` `handoff`; tour viewer `tour.js` entry params |
| **all of it** | | `flow.cine.json` (generated, 1 file), `tools/build_segments.mjs`, `path.json` (anchors for 4 segments), `cine.js`, `css/cine.css`, `test/flow-cine.test.mjs` |

**Proposed film features (kebab-case).** Base layout rule: *one tracked JSON fragment per segment + one sequence file*, so two segment features never edit the same file.

| Feature | Owns (only these) | Shared files it must NOT touch | Depends on |
|---|---|---|---|
| `film-shell` | the new `fixtures/rainbow/film/sequence.json` (order, start, hold, defaults, focus_x, caption, units), `tools/build_segments.mjs` (concatenates fragments into `flow.cine.json`), `js/cine.js` core (player, junction engine), `css/cine.css`, `test/flow-cine.test.mjs` | segment fragments | none; **merge first** |
| `film-seg-orbit` ("the approach and orbit") | `fixtures/rainbow/film/segments/orbit.json`, `flyover/orbit/**`, `flyover/equirect/segments/orbit.json`, its clip folder | everything else | film-shell |
| `film-seg-stop-facade` ("the stop in front of the building" = hold-facade) | `film/segments/hold-facade.json`, `rainbow-cine/hold-arc/**`, hold code split out of `cine.js` to `js/cine-hold.js`, `units_at_rest` | `sequence.json` | film-shell |
| `film-seg-rise-descend` | `film/segments/descend-846.json`, its clip, the descend part of `path.json` (as `equirect/segments/descend-846.json`) | | film-shell |
| `film-seg-enter-handoff` | `film/segments/enter-846.json` (incl. `handoff`), `flyover/enter.py`, `handoff-living.webp`, bridge code split to `js/cine-handoff.js` | `tour.js` core | film-shell; `apartment-shell` for the living pano |
| `film-building-video` (the exterior-film board) | the one-clip variant: `building-film-{720,1080}.mp4`, overlay player in `flyover3d/app.js` | segment features | see 1.4 |

**Smallest refactor that removes the conflict** (≈ 1 session, $0): (a) make `build_segments.mjs` write `flow.cine.json` from `film/sequence.json` + `film/segments/*.json` (each fragment is exactly today's entry); keep `flow.cine.json` as a generated, **not-hand-merged** output (add a `.gitattributes` `merge=ours`/regenerate note, or stop tracking and generate in the staging step `tools/deploy-vercel/stage_flow.py`); (b) split `path.json` `segments[]` into `equirect/segments/<id>.json` with `path.json` keeping only global fields (`fps`, `projection`, `sources`, `end`, order). `cine.js` split is optional; without it `film-seg-stop-facade` and `film-seg-enter-handoff` both edit `cine.js` (different regions, 3-way merge usually clean, but flag it).

### 1.4 The active `exterior-film` board
- Goal (`C:\RnD\development\tasks\exterior-film\README.md`): the `/hold/` "הדמיית הבניין והסביבה" button plays a ≥1080p film (Phase A), later a free 3D splat spike (Phase B ≤ $15). Plan `C:\RnD\development\plans\2026-11-04-exterior-realistic-video-3d.md`. Cards A1 cut, A2 Topaz, A3 overlay player, A4 checks, A5 copy back, A6/A7 QA, B1 splat spike.
- Its film = **orbit → facade arc (eased ping-pong around rest frame 65) → descent** = segments 1+2+3 of layer A, re-cut as ONE mp4 and upscaled. It does NOT touch `flow.cine.json`.
- **Recommendation: finish A (cards A1-A7) first in its own working folder, then fold it in as `film-building-video`, after `film-shell`.** Reasons: (1) it is executing right now with paid calls ledgered ($0.73 of $10); (2) its files are outside the product repo so no worktree can host it today; (3) it consumes the segment clips, so it should land after the segment features stabilise, or just re-cut from them. Phase B (splat) is a separate future feature `film-3d-splat` (new viewer, no overlap with the segment files). Decision for Eliran: move `research/fal-bench-2026-11-02/flyover3d/` into the product repo (e.g. `Habait/flyover3d/`) or leave it out of the worktree plan.

### 1.5 What a fresh worktree needs (film features)
| Feature | Tracked-only worktree runs? | Missing, must be provided | How (by name) |
|---|---|---|---|
| `film-shell`, all `film-seg-*` (JSON/code work) | validate only: `cd Habait/platform && npm ci && node contracts/validate.mjs fixtures/rainbow` | `Habait/platform/_local/segments/rainbow-cine/` (≈ 60 MB: mp4, jpg, 169 hold frames, camera.json), `Habait/engine/_local/apt846-project/video/manifest.json` (for `build_segments.mjs`), `Habait/platform/_local/dist/rainbow` | copy or junction from the main checkout (`C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\_local`). **No `media-pull` script exists in the repo** (only named in `.gitignore:4`); `WALK_MEDIA_DIR` is likewise only a comment there. Until it exists, a read-only junction is the practical path |
| browser test `test/flow-cine.test.mjs` | no | `HABAIT_APP_DIR` (playwright-core + sharp: use `C:\RnD\Projects\Habait\tools\appdeps`), `CHROME_PATH` (H.264 Chrome), built tour `Habait/tour360/dist/apt846` | env var NAMES only: `HABAIT_APP_DIR`, `CHROME_PATH`, optional `PORT`, `HOST`, `FFMPEG` |
| `film-seg-orbit/-descend/-enter` re-render | no | Blender 4.5.10 at `C:\RnD\Projects\Habait\tools\blender-4.5.10\...\blender.exe`, venv `C:\RnD\Projects\Habait\tools\habait-venv`, `studio/_local/projects/apt846-rainbow-tlv/renders/site3d/site.glb` (untracked), HDRI `360walkaround/pipeline/probe/probe-assets/hdri/qwantani_noon_puresky_4k.hdr` (fetch via `probe-assets/fetch-assets.py`), CPU only on this laptop (draft 1024x512 per `equirect/README-he.md`) | `BLENDER` env (default in scripts is a Program Files path, wrong here) |
| paid steps (Kling/Topaz/GPT skins) | no | fal key by NAME `FAL_KEY` in the repo-root `.env` (gitignored, never copied into a worktree by git) | ledger first, dry-run, `--go` (root §7) |
| `film-building-video` | no (outside repo) | the `research\...\flyover3d` folder | see 1.4 |
Ignored output of the film stays ignored: `flyover/renders*/`, `flyover/orbit/` (671 MB), `flyover/equirect/_local`, `flyover/cloud/**/out_*/`. Deploy staging lives outside the repo: `C:\RnD\Projects\Habait\tools\deploy-vercel\stage_flow.py` (stages cine clips, step 1c); prod deploy only on Eliran's own go.

## 2. Track 3 — the apartment (apt846, "rainbow")

### 2.1 The rooms as the code defines them (`apartments/apt846/scenes.json`, `cameras.json`; 11 interior + 11 exterior scenes; `apartment.json:sceneCount 11`)
| scene id (scenes.json) | Hebrew | asset (pano file) | plan room (`plan.general.json`) | render folder (`360walkaround/tours/apt846*/renders/`) | doors/hotspots to |
|---|---|---|---|---|---|
| `entrance` | כניסה | `01-entrance` | `r-entrance` | `cp-entrance` | living, kitchen, bathguest |
| `kitchen` | מטבח | `02-kitchen` | `r-kitchen` | `cp-kitchen` | dining, living, entrance, bedroom2 |
| `dining` | פינת אוכל | `03-dining` | `r-dining` | `cp-dining` | kitchen, living, terraceLiving |
| `living` | סלון | `04-living` | `r-living` | `cp-living` | terraceLiving, dining, kitchen, entrance, bedroomMain |
| `terraceLiving` | מרפסת שמש | `05-terrace-living` | `r-terrace-living` | `cp-terraceLiving` | living, dining, terraceBedroom, terraceOut |
| `terraceBedroom` | מרפסת · קצה החדרים | `06-terrace-bedroom` | `r-terrace-bedroom` | `cp-terraceBedroom` | terraceLiving |
| `bedroomMain` | חדר שינה הורים | `07-bedroom-main` | `r-bedroom-main` | `cp-bedroomMain` | living, wardrobe |
| `wardrobe` | פינת ארונות | `08-wardrobe` | `r-wardrobe` | `cp-wardrobe` | bedroomMain, bathMain |
| `bathMain` | חדר רחצה הורים | `09-bath-main` | `r-bath-main` | `cp-bathMain` | wardrobe |
| `bedroom2` | חדר שינה | `10-bedroom-2` | `r-bedroom-2` | `cp-bedroom2` | kitchen |
| `bathguest` | חדר רחצה כללי | `11-bath-guest` | `r-bath-guest` | `cp-bathguest` | entrance |
Four id spellings per room (camelCase scene, NN-kebab asset, `r-` plan, `cp-` render): a mapping table is part of the shell. The tour's `defaultScene` is the exterior `aerial`; the film hand-off lands on `living`.

### 2.2 How one room's pano is produced (pipeline)
`360walkaround/tours/apt846-furnished/plan.json` (+ `manifest.json`) → `pipeline/render_tour.mjs --points cp-<room>` (Blender Cycles via `build_scene.py` / `render_pano.py`; draft ~2-3 min/point CPU, final ~23 min) → `renders/cp-<room>/pano.webp + depth.png + pano.render.json` (webp ignored) → GPT Image 2.5 skin via `tour360/tools/gen-pano.mjs`/`skin-frame.mjs` (PAID, ledger `apartments/apt846/_local/ledger.json`, answers in `_local/generated/`) → `tools/make-sets.mjs apt846` → `panos/{balanced,thumb,original}/<asset>.webp` (tracked) and `_local/full` → floor-finish sets `_local/panos-{parquet,concrete,marble}/<asset>.webp` (untracked; per room × 3 finishes) → guide video `guide/he/<asset>.mp4` (edge-tts + minimax lip-sync, `guide.json`) → `tools/build-tour.mjs apt846` → `dist/apt846/index.html` (ignored).

### 2.3 Room-specific vs shared
| Room-specific (can be owned by one room feature) | Path pattern |
|---|---|
| tracked pano sets | `Habait/tour360/apartments/apt846/panos/{balanced,original,thumb}/<NN-room>.webp` |
| depth | `apartments/apt846/depth/<NN-room>.png` (+ `depth.json` shared) |
| guide audio/video | `apartments/apt846/guide/he/<NN-room>.{mp3,mp4,mp4.json}` |
| CG render folder | `360walkaround/tours/apt846{,-furnished}/renders/cp-<room>/` (`pano.render.json`, `.log`, ignored `pano.webp`) |
| untracked per-room media | `_local/generated/<NN-room>__*.png`, `_local/panos-<finish>/<NN-room>.webp`, `_local/panos-tiles/<NN-room>/` |

| Shared (one file for all rooms) | Why it conflicts |
|---|---|
| `apartments/apt846/scenes.json` (generated, 17 KB) | every room's hotspots + name + zone in one array; every door link is two-way, so room A's link edits room B's entry |
| `cameras.json` (source of `scenes.json`), `plan.general.json` (80 KB, rooms+walls+openings+fixtures), `prompts.json`, `skin-prompts.json`, `polish-prompts.json`, `material-board.json`, `trace-config.json` | all rooms in one JSON; one room's prompt/camera/fixture edit touches the shared file |
| `guide/guide.json` | `he.steps[]` one entry per room (text, audio, seconds, video) |
| `apartment.json`, `videos.json` (floor finishes), `exterior.json`, `plan/floorplan.webp` (ignored) | tour config, floors, minimap image |
| `360walkaround/tours/apt846-furnished/{plan.json,manifest.json,scene-full.blend}` | one render manifest + one Blender scene for the whole unit; the `.blend` is a binary (not mergeable, and ignored: not in a fresh worktree) |
| dollhouse: `apartments/apt846/dollhouse/apt846-{parquet,concrete,marble}.glb`, `Habait/platform/js/apartment-3d.js` (990 lines), platform `tools/build_zip.mjs` | one GLB holds every room's floor+walls; room labels come from GLB node `room_id` |
| minimap: `platform/js/minimap.js`, built from `cameras.json` + `scenes.json` | |
| tour viewer: `tour360/viewer/{template.html,tour.js,tour.css}`, `tools/build-tour.mjs` | |
| floor finishes: `videos.json` + `build-tour.mjs:194-228` **fails the build if a finish set does not have exactly one pano per scene** (`floor X: n panoramas, the tour has m`) | a room feature cannot ship a new finish alone |

### 2.4 Proposed layout
**`apartment-shell`** (merge first; owns every shared file above): `scenes.json`, `cameras.json`, `apartment.json`, `videos.json`, `plan.general.json`, `material-board.json`, `trace-config.json`, `exterior.json`, dollhouse glb + `apartment-3d.js`, `minimap.js`, `viewer/*`, `tools/build-tour.mjs`, `tools/make-scenes.mjs`, `tools/make-sets.mjs`, the `cp-`/`asset`/`r-`/scene id map, and the per-room test harness (see below).
**One feature per room, `apt-room-<id>`** (11): `apt-room-entrance`, `apt-room-kitchen`, `apt-room-dining`, `apt-room-living`, `apt-room-terrace-living`, `apt-room-terrace-bedroom`, `apt-room-bedroom-main`, `apt-room-wardrobe`, `apt-room-bath-main`, `apt-room-bedroom-2`, `apt-room-bath-guest`. Each owns ONLY the row of §2.3 "room-specific": its `panos/*/<NN-room>.webp`, `depth/<NN-room>.png`, `guide/he/<NN-room>.*`, `cp-<room>/` render folder, its `_local` files. Natural pairs that share a boundary and may be one feature if Eliran prefers fewer worktrees: bedroom-main + wardrobe + bath-main (a chain), living + terrace-living.
Optional: `apt-floor-finishes` (parquet/concrete/marble sets for all rooms), `apt-guide` (voice/presenter policy), `apt-dollhouse`, `apt-minimap` — cross-room, so not per-room.

**Where the code forces conflicts, and the smallest fix**
1. **`scenes.json` / `cameras.json` / `guide.json` / prompts JSONs (one array for all rooms).** Fix: shard per room, `apartments/apt846/rooms/<id>/{camera.json,scene.json,guide.json,prompts.json}` + a tiny `rooms/index.json` (list of ids, order); make `make-scenes.mjs` and `build-tour.mjs` read the shards and emit the same `scenes.json` (generated, untracked or `merge=ours`). Hotspot links stay in the *source* room's shard only; the reverse door link is derived by the generator (today both sides are written). The same one-line-per-room trick for `guide/guide.json` and `prompts.json`.
2. **Two-way door links.** Even after sharding, "room A door to B" lives in A's shard; adding a door means the shell, not a room feature, unless the generator mirrors it.
3. **`scene-full.blend` + `plan.json` for the whole unit.** A room cannot re-render without the whole-unit plan; treat the plan and the blend as `apartment-shell` assets; a room feature changes only `furnishing` of its own room id in a shard if `plan.general.json` is split by `rooms[].id` (rooms, openings, fixtures per room). Without that split, furniture changes in two rooms collide in `plan.general.json`.
4. **Dollhouse GLB** — one binary per finish; any room-visible change that alters 3D means re-export by the shell after all rooms merged.
5. **`make-sets.mjs`/`build-tour.mjs` assume the full set** (counts equal). Fix: let `build-tour.mjs --rooms entrance,living` build a subset tour (a flag, ≈ 20 lines) so one room can be built alone.

**Testing one room alone in its worktree** (after the shell feature adds `--rooms`): `node Habait/tour360/tools/build-tour.mjs apt846 --rooms <id> --out <scratch>` then `node Habait/tour360/tools/smoke.mjs apt846` and `node Habait/tour360/tools/serve-dist.mjs` with `HABAIT_APP_DIR` set; for a render change `node 360walkaround/pipeline/render_tour.mjs --tour apt846-furnished --points cp-<room> --mode draft --dry-run` first. Two rooms merge cleanly when each touches only its own `<NN-room>`/`cp-<room>` paths and the shell's shard index; collisions are possible only on the files in the "Shared" table, which is why the shell goes first and room features branch from it.

### 2.5 What a fresh worktree needs (apartment features), by name
- **Tracked and enough for data/code work:** the 11 `panos/balanced|original|thumb` per room, depth, guide mp3/mp4 (56.9 MB tracked), scenes/cameras/plan JSON, cp-room render JSON, all tools, viewer, `dollhouse/*.glb`.
- **Ignored, missing in a fresh worktree:**
  - `Habait/tour360/apartments/apt846/plan/floorplan.webp` (`.gitignore:17`, the "drive inputs" rule) — needed by `build-tour.mjs:83` (`copyFileSync` of the plan image: the build throws without it) and the minimap.
  - `Habait/tour360/apartments/apt846/_local/` (1.8 GB: `panos-{parquet,concrete,marble}`, `full`, `generated`, `videos`, `panos-ext*`, `ledger.json`, `picks.json`) — required for floor-finish sets (build fails on count mismatch) and any re-skin.
  - `Habait/tour360/dist/` (rebuilt by `build-tour.mjs`), `360walkaround/tours/apt846*/renders/cp-*/pano.webp` and `depth.png`, `scene-full.blend` (4 MB, ignored by `360walkaround/.gitignore:25` `tours/*/*.blend`: a fresh worktree has no Blender scene and must rebuild it with `build_scene.py`), `Habait/platform/_local/{dist,segments}`, `Habait/platform/test/shots/`, `media/cache/`, `qa-evidence/**/*.png|jpg|webp|mp4`, `node_modules/`.
- **Restore:** the repo's `.gitignore:4` says `media-pull` restores media from the shared drive via `WALK_MEDIA_DIR`; **neither exists in this tree** (grep: only `.gitignore` mentions them). Today the only restore path is copying/junctioning from the main checkout `C:\RnD\Projects\Habait\habait-walkaround`. Recommended owner action: write `scripts/media-pull` (dry-run default, junction or copy, hash check) as part of `apartment-shell`, before any room worktree opens.
- **Install:** `cd Habait/platform && npm ci` (three 0.170.0); `cd Habait/tour360/engine && npm ci` only if touching the 3D engine; tour tools use `playwright-core` + `sharp` from `HABAIT_APP_DIR` (the old fallback `D:/AgentTeams/RealEstateTeam/Habait/MVP/app` does not exist on this machine; `Habait/MVP/` is not in the repo) → set `HABAIT_APP_DIR=C:\RnD\Projects\Habait\tools\appdeps`.
- **Blender** (render features only): portable 4.5.10 at `C:\RnD\Projects\Habait\tools\blender-4.5.10\blender-4.5.10-windows-x64\blender.exe`; `render_tour.mjs:44` default is `C:/Program Files/Blender Foundation/Blender 4.5/blender.exe` (not installed here) → pass `--blender` or set `BLENDER`; Python `C:\RnD\Projects\Habait\tools\habait-venv\Scripts\python.exe` (`PYTHONIOENCODING=utf-8`); CPU only on this laptop; HDRI via `pipeline/probe/probe-assets/fetch-assets.py`.
- **Env var NAMES seen in scripts:** `HABAIT_APP_DIR`, `BLENDER`, `CHROME_PATH`, `FFMPEG`, `PORT`, `HOST`, `HABAIT_LEGAL_DIR`, `LOCALAPPDATA`; keys by name only: `FAL_KEY`, `MYARCHITECTAI_API_KEY` (HOT) in the root `.env` (a worktree does not inherit it; copy only by Eliran's decision, never print). `.env` was not opened.
- **Rails inside every worktree:** paid calls (GPT skin, Kling, Topaz, guide lip-sync) ledgered first, dry-run, `--go` under the brief estimate; originals never altered (`panos/original`); every AI image keeps the `הדמיה · AI-generated` badge.

## 3. Cross-track notes
- The two tracks meet at **one pano**: the film's last frame is the living pano (`handoff-living.webp` ← `dist/apt846/panos-parquet/04-living.webp`) and `flow.cine.json` `handoff.pano_from`. Changing `apt-room-living`'s pano silently desyncs `film-seg-enter-handoff` (registration `edge_ncc 0.382`). Rule: a living-room pano change re-runs the enter registration (owner: enter-handoff feature).
- Merge order: `apartment-shell` and `film-shell` first (parallel, no overlap), then rooms/segments in any order, then `film-building-video`.
- Verify-before-trust gaps (not proven here): which pipeline made the shipped `enter-846.mp4`; the `rest_frame` 91 vs 65 mismatch between `manifest.dev.json` and `flow.cine.json` (65 is the one the shipped JSON and `flow-cine.test.mjs` use); (resolved: `scene-full.blend` is ignored, 4 MB).

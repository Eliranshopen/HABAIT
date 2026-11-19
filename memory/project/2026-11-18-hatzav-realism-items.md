
## 2026-11-18 · main session · Hatzav walk: render items as fal 3D, RAINBOW features, hours, photo skin
- **Did:** Eliran: box furniture looked cheap and game-like. Made every movable piece of his renders as a 3D model on fal (crop, gemini spec, nano-banana-pro studio photo, hunyuan 3.1 GLB): 19 items plus 24 swap alternatives. Walk got RAINBOW-style UI (rings, swap strip, free text via local server, floor finish, undo/compare, plan, measure), the day-night-keyframes skill (4 hours), the garden opened for walking, and a photo skin: AI-realistic frames of the walk projected onto the baked atlases.
- **Evidence:** `development/plans/2026-11-17-hatzav-realism-and-rainbow-features.md`
- **Learned:** His renders differ 15-20 cm from the sales-plan model, so projecting them directly ghosts; frames of the walk restyled by them fit exactly. fal results are big: every fetch needs a timeout; one ledger per item; fal balance can run out mid-batch (403 Exhausted balance, unbilled). The skill sync gate failed on float noise only.
- **Owed / open:** Eliran's look at the skinned walk; README/QA update; not committed
- **Second reader:** none

## 2026-11-18 · main session · Hatzav walk: Vercel hatzav-walk + public GitHub repo
- **Did:** On Eliran's word: deployed the walk (renders layout, hours off) to a new Vercel project hatzav-walk (dpl_H3qWZEP3x1Qj6eH3fmaCy1ZEkNsa, https://hatzav-walk.vercel.app); then a new PUBLIC repo Eliranshopen/hatzav-walk (his choice) with walk, scripts, docs, QA, ledgers, no developer renders or plan copies, secret scan clean.
- **Evidence:** `.wt/harei-zahav-naama/out/harei-zahav-naama/3-rooms/qa/deploy-check/features-check.json`
- **Learned:** vercel link writes .env.local into the folder: add .vercelignore BEFORE the first deploy; the first deployment r5cr5rmrm may hold it (protected, removal is Eliran's). Item GLBs (~160 MB) are too heavy for phones.
- **Owed / open:** plan-layout build, model comparison pick, phone-light GLBs, redeploy on his go; vercel rm of r5cr5rmrm
- **Second reader:** none

## 2026-11-18 · main session · Hatzav: two versions (walk + 360), ceiling $90, FAL_KEY on Vercel the RAINBOW way
- **Did:** Eliran asked for two versions with a Vercel link each (the current 3D walk + a 360 tour), realistic, items from his renders, all features. Ceiling raised $81 → $90 (his choice in the dialog). On his word («עשינו את זה בפרויקט של RAINBOW») FAL_KEY was set on Vercel project hatzav-walk by `scripts/24_vercel_key.mjs` (value by name on stdin, never printed; `vercel env ls` shows FAL_KEY Production).
- **Evidence:** job `.wt/harei-zahav-naama/out/harei-zahav-naama/3-rooms/scripts/24_vercel_key.mjs`; caps in scripts 16/23 = 90
- **Owed / open:** the same step for the 360 project once it is linked; port /api/design to a Vercel function; booked $77.35 of $90
- **Second reader:** `secrets-steward`

## 2026-11-18 · main session · Hatzav walk: phone controls fixed and deployed on Eliran's «תעלה»
- **Did:** his report «בטלפון כל הכפתורים מופיעים על המסך ואין יכולת של תזוזה … התזוזה לא יציבה זה קופץ»: arrow pad (joystick) bottom-left, finger drag = look, eased speed/turn/bob, clean phone screen (icons only, undo rail only after a change, map + help in «כלי עזר», ring names on tap). Deployed hatzav-walk dpl_6ZTkH73uWA7Rz3J8KKaPwRXsoKiM (only walk.js/ui.css/index.html/items.js changed).
- **Evidence:** live check at 390 touch: pad moved 1.46 m, speed steady 1.28–1.31 m/s, no spikes; `qa/phone/live-after.png` in the job
- **Second reader:** `habait-deploy-qa`

## 2026-11-18 · main session · Hatzav walk still stutters on the phone (Eliran «ההליכה עדיין זזה בתקיעות») — cause and fix
- **Learned:** the live link loads 30 desktop pieces on phones (no glb_m in its registry): ≈150 MB, ≈90k faces each (≈2.7 M triangles), decoded during the walk; textures are only ~12 % of the weight, geometry is the rest.
- **Did:** phone: pieces load one at a time nearest-first only while standing still, textures + shader prepared at load, MSAA off, resolution adapts (1.5× → down to 0.9×); textures-only phone copies (scripts/26_glb_phone_tex.mjs) for the live set. Staged in deploy-hatzav, NOT deployed (own go needed). The full cure = the 30k-face phone copies of the new build.
- **Evidence:** scripts/_dbg_fps.mjs on the same machine: live 5 fps, worst 1.4 s; fix 12 fps, worst 0.5 s (Blender held the GPU, so absolute numbers are not a phone's)
- **Second reader:** none

- **Ruling 2026-11-18 (360):** Eliran raised the project ceiling to $95 for all 10 rooms of the 360 (GPT Image 2.5 realism, $1.20 a room, + the ~$1.50 model comparison). Walkaround work stopped on his word; the 360 only.

## 2026-11-18 · main session · Hatzav 360: the realism model = GPT Image 2.5 (comparison on the kitchen pano)
- **Did:** one Blender 360 (plan layout, Hitem pieces) through three fal models with his kitchen render as the look reference: Seedream 4.5 ($0.04) changed the floor to stone tiles + harsh sun; nano-banana-pro ($0.30) added objects (boards, dishes, plant); GPT Image 2.5 ($1.20, 3840×1920) kept every object and position, most real light — chosen (RAINBOW's model of record too). Its seam is weaker (5.8 vs 2.5) → scripts/28_pano_seam.py closes it. All 10 rooms run through it (run_360_real.sh). Living re-rendered from (700,880): the walk view stood 0.6–0.9 m from the TV.
- **Evidence:** job `qa/360-compare-kitchen.jpg`, `qa/360-compare-kitchen-detail.jpg`, `work/pano360/ledger.json`
- **Second reader:** none

## 2026-11-18 · tour360 sub-agent · Hatzav 360 tour on the RAINBOW system (final build = the realistic set)
- **Did:** new apartment `tour360/apartments/hatzav` (worktree harei-zahav-naama), generated at $0 by its `prep.mjs` from the job: 10 rooms, 26 doors from geometry.json openings, 27 swap rings projected from items/placements.json (no paid scan), our own 24-item catalog, ruler depth ray-cast from geometry.json, written guide; one switch `source.json panoSource` (blender | real). Tools: `tools/apartment-overrides.mjs` (own copy.json + catalog), catalog-check `file`, build-tour `fidelity.mode` (cg-render / ai-over-cg needs `--ungated-ok`). Built `--catalog --full --ungated-ok`; staged once to scratch, not deployed.
- **Evidence:** job `qa/360/FEATURES.md` (12 built · 4 differently · 5 left out), `qa/360/REBUILD.md`, `qa/360/real/shots.json` (20 shots, 0 errors), smoke PASS 15.5 MB
- **Learned:** the Blender pano frame = yaw 0 at plan +u, + toward +v; hung pieces hang DOWN from pos.y; a re-render writes strips/<room>2_0.png.json (the camera of record); GPT Image 2.5 kept every piece where the render had it (rings fit unchanged).
- **Owed / open:** shipping the AI set without RAINBOW's per-picture fidelity gate is Eliran's call (`--ungated-ok`); dollhouse, floor sets, prepared examples, intro passage, videos left out; deploy + key names on the new Vercel project = main session on his go.
- **Second reader:** `habait-deploy-qa` — the staged folder carries api/edit + catalog.json; FAL_KEY/OPENROUTER_API_KEY/TOUR_EDIT_CODE names needed.

## 2026-11-18 · main session · Hatzav 360 DEPLOYED on Eliran's go («תביא לי בסוף לינק לVERCEL לכל גרסה») — https://hatzav-360.vercel.app
- **Did:** RAINBOW tour360 system, apartment `hatzav` (worktree), 10 realistic GPT Image 2.5 rooms (seam closed), 26 doors, 27 swap rings (projected from placements, $0), our own 24-item catalog, bilingual badge. New Vercel project hatzav-360, dpl_AMz4mgJWZ8J8Fam4M4aotMZmiTB4; FAL_KEY by name on stdin + TOUR_EDIT_OPEN=1 (handler: IP limit + $5/day cap, structure:false). Built with --ungated-ok (RAINBOW fidelity gate not run); $0 structural check instead: 86–100 % of the model's straight lines kept per room (qa/360/structure-kept.json).
- **Evidence:** live: room tap living→dining at 1440 and 390 touch after «דלג»; /api/edit configured:true open:true; paint-proof 6/6 FAIL only on (c) the tool compares RAINBOW's default badge text (ours is the bilingual override) and (d) the first-visit coach covers the doors (by design) — both explained, not product faults. Spend $90.89 of $95.
- **Owed / open:** paint-proof.mjs should read apartment-overrides and dismiss the coach; the living room's warm/dark tone on desktop to look at; dollhouse / floor finishes / room videos left out (FEATURES.md)
- **Second reader:** `habait-deploy-qa`

## 2026-11-18 · main session · Eliran caught a sales-plan / render mismatch in the live 360 kitchen
- **Did:** «לפי התכנית מכר במטבח החלק הזה אמור להיות המשך של ארון ופה יש מדפים — אתה בדקת שהכל תואם לתכנית מכר?» Checked: the plan (top view) matches the model (south run to 410 cm, sink under the window); the miss is a wall element the plan does not show — his kitchen render has full-height oak upper cabinets right of the window, the model has open shelves there. My checks covered the floor layout and the AI step's structure, NOT wall elements vs his renders. Started a $0 audit of every room vs his renders (qa/360/RENDER-AUDIT.md) to fix all in one pass.
- **Learned:** a plan-only fidelity check misses wall-mounted elements (upper cabinets, shelves, wardrobes); every room must also be checked against the developer's render of it before rendering the panoramas.
- **Second reader:** none

## 2026-11-18 · audit sub-agent · Hatzav 360 wall/vertical elements vs the developer's renders ($0, read-only)
- **Did:** 25-row audit: 8 clear mismatches. Kitchen: east of the window, shelves → full-height light-oak uppers; the shelves belong west of the window; roman blind. Safe room: sheer curtain. Bath: oak cabinet over the WC, curtain not smoked glass, drawer vanity with an integrated basin, globe sconces. Re-render 7 panos (kitchen, dining, living, entrance, hall, saferoom, bath), deck advised, garden optional.
- **Evidence:** job `qa/360/RENDER-AUDIT.md`, `qa/360/audit/01…06-*.jpg`, `work/audit/projections.json`
- **Learned:** the renders are MIRRORED vs the sales plan (render-right = plan east); render 0050000 is the living TV wall, not the bedroom; there is no bedroom render. The renders' dining and living bookcases have no wall in the plan (entrance door / living window).
- **Owed / open:** fix the 8 items in hz_public.py / hz_furniture.py, then Blender + GPT Image 2.5 re-render ≈ $8.40–10.80 vs $4.11 left under $95 = Eliran's call
- **Second reader:** none

- **Ruling 2026-11-18 (360 fixes):** Eliran: fix all 8 render mismatches of qa/360/RENDER-AUDIT.md in one pass; ceiling raised to $102 (8 rooms re-rendered + realism, ~$9.60).

## 2026-11-18 · model-fix sub-agent · Hatzav: the 8 render mismatches fixed in the Blender model ($0)
- **Did:** fixed all 8 clear mismatches of `qa/360/RENDER-AUDIT.md` in the model scripts and rebuilt `scene/hatzav.blend` + `scene/hatzav_v2.blend` (24 PLACE lines, unchanged); old scenes renamed `*-before-render-fixes-2026-11-18.blend`. Kitchen: `K_shelf_*` east → `K_upperS_*` light-oak uppers (2 doors × 2 tiers, 150→ceiling, split 222, oak end panels); shelves moved west of the window (u 112–159) + ceramics `K_cer_*`; roman blind `K_blind_*`. Safe room: `S_curtain_track` + `S_curtain_w/e` (sheer, ceiling track). Bath: `T_wallcab_*` + `T_niche_*` + `T_jar_*` over the WC (`T_plant` removed); `T_shower_glass_*`/`T_shower_handle` → `T_curtain_rail_*` + `T_shower_curtain_n/e`; `T_vanity_*` drawer unit (oak_warm), white `T_vanity_top` with cut-in `T_basin`, wall taps `T_tap_*`; four globes `T_sconce_*` + 2 point lights.
- **Evidence:** `.wt/harei-zahav-naama/out/harei-zahav-naama/3-rooms/qa/360/fixes/` (cmp-kitchen.jpg, cmp-bath-wc.jpg, cmp-bath-vanity.jpg, cmp-saferoom.jpg, pano-172_890.png); scripts `scripts/blender/hz_public.py`, `hz_furniture.py`, new `fix_stills.py`; `work/build_v2-render-fixes-2026-11-18.log`.
- **Learned:** the vanity top is a white solid surface, not `worktop_stone` (the marble texture read as grey tiles at bath scale); a basin cut into a body needs the body to carry the same void, or the body's top face hides the bowl.
- **Owed / open:** re-render the 7–9 panoramas + the realism step (main session; cost is Eliran's call). Not changed (minor rows): steel flush plate, fridge door tone, single basin (the plan's vanity is 89 cm, the render's is a double).
- **Second reader:** main session — renders the panoramas from the rebuilt `scene/hatzav_v2.blend`.

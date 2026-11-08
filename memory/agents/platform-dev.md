# platform-dev — lessons (newest last)
<!-- created 2026-11-03 by the main session (rnd-23), which ran the platform-dev cards of board apartment-3d itself (session started at C:\RnD, so the project agent was not loadable) -->

## 2026-11-03 · main session as platform-dev · apartment-3d card 03 (rooms, labels, tap)
- **Did:** room data inlined into `dollhouse.html`; labels with name + area; tap a floor → camera eases to the room, highlight, sheet with "צפו ב-360°" → `habait:enter-room`.
- **Evidence:** `development/tasks/apartment-3d/logs/check-03.txt` (39/40 at 14:56; 40/40 re-run 15:41 after card 05), `.wt/apartment-3d/after/card03/`.
- **Learned:** a hidden label measures 0 — measure once while shown.
- **Owed / open:** none (desktop Top 10/11 closed by card 05).
- **Second reader:** none.

## 2026-11-03 · main session as platform-dev · apartment-3d card 04 (hand-off and page)
- **Did:** enter-room → 360 at that room, "חזרה לתלת-ממד", deep-link fix, phone layout, fixture badge, caption pill (legal text word for word).
- **Evidence:** `development/tasks/apartment-3d/logs/check-04.txt` (47/47 at 15:02 and again 15:41), `.wt/apartment-3d/after/card04/`.
- **Learned:** nothing new.
- **Owed / open:** none.
- **Second reader:** none.

## 2026-11-03 · main session as platform-dev · apartment-3d card 05 (the real-time look pass)
- **Did:** transparent canvas on the warm gradient, Neutral tone map + RoomEnvironment, warm-grey caps with an edge, flat unlit glass drawn once per pixel (stencil), framing on a per-0.25 m-band silhouette inside the band between the preset bar and the caption (view offset), orbit target height solved so the projection is centred, auto-rotation follows a per-azimuth fit distance, damping momentum dropped on preset/room moves, compact labels on narrow frames, desktop bar on the title row.
- **Evidence:** `development/tasks/apartment-3d/logs/check-05.txt` 22/22 (15:40); `c05-smoke.txt`, `c05-minimap.test.txt`, `c05-apartment.test.txt` all green; `.wt/apartment-3d/after/phase1/`.
- **Learned:** (1) three r163+ `WebGLRenderer` has `stencil:false` by default — pass `stencil:true` before any stencil material. (2) OrbitControls keeps damping momentum (`_sphericalDelta`) after a programmatic camera jump; on slow GPUs (SwiftShader ~3 fps) it keeps "render on demand" busy for 30 s — zero it on every preset move. (3) A prism hull × full height overstates a 3/4 view's silhouette by ~40 % when one tall object exists; band hulls fix it. (4) Fitting to the widest auto-rotation azimuth halves the fill — let the distance follow the azimuth instead.
- **Owed / open:** none for card 05.
- **Second reader:** none.

- 2026-11-03 pointer (from main session rnd-ed): platform shell UI/UX research — live apartment page throws on `new URL(ext.url)` (`js/apartment.js:110`) after stage_flow's `/hold` rewrite; Heebo never loaded; a redesign of `css/style.css` is proposed → `memory/project/2026-11-03-platform-ui-ux-research.md`
- 2026-11-03 qa-reviewer gate 1 on apartment-3d card 03: Pixel 7 embedded Top drops the r-bath-main label (10/11); see logs/gate1-report.md

## 2026-11-03 · main session as platform-dev · platform-ui-ux cards 03+04 (stage_flow dist media; Studio m:ss / $0.00)
- **Did:** stage_flow.py (working copy) stages _local/dist/<project>/<unit>/ (apartment.json, media/**, the linked ZIP; never index.html/assets/, never _local whole). Studio app.js: fmtDuration/fmtCost on all 9 render sites, numbers in <bdi dir=ltr>.
- **Evidence:** `development/tasks/platform-ui-ux/logs/c03-stage.txt`
- **Learned:** (1) The LIVE stage_flow.py cannot run in C:\RnD: Habait/platform/node_modules/three was not carried by the cut-over (vendor step FileNotFoundError) — every deploy needs it first. (2) Math.round(12.345*100) gives 1234; round on the decimal string (toFixed(10)+'e2') for half-up money.
- **Owed / open:** next deploy needs platform node_modules (Eliran's npm ci go, card 01c); filed in OWED.md by the main session
- **Second reader:** none

## 2026-11-03 · main session as platform-dev · platform-ui-ux card 05 (tokens, fonts, components, style guide)
- **Did:** New css/tokens.css (LCH neutral ramp, brand, status, light+dark themes, type/space/radius/shadow/motion), css/components.css (hb-* components, logical props only), fonts/ (Heebo variable + Frank Ruhl Libre 500/700 from Fontsource 5.3.0, OFL, SOURCES.md with sha256), styleguide.html, tools/contrast.mjs.
- **Evidence:** `development/tasks/platform-ui-ux/logs/c05-styleguide.txt`
- **Learned:** (1) A colour token used as a UI mark must be checked against the dark surface too: the brand fill fails 3:1 on dark, so marks/progress use a --progress token (= --brand-ink in dark). (2) Hex codes in RTL need direction:ltr + isolate, or '#' jumps to the end. (3) Headless page.on('response') does not report the favicon 404 that the console counts.
- **Owed / open:** none for card 05; Gate 1 theme pick is card 12 (Eliran)
- **Second reader:** `qa-reviewer`

## 2026-11-03 · main session (rnd-fd) as platform-dev · apartment-3d card 08 (the viewer wears the baked light)
- **Did:** `build_zip.mjs` inlines `light.webp` (+ the 1024 phone copy while both fit 450 KB base64) when the picked GLB has TEXCOORD_0 and report.json has `bake.scale`; `prepareDollhouse({lightmap, lightScale})` → ImageBitmap texture (flipY false, sRGB, channel 0, NO mipmaps) on every non-glass, non-cap material, `lightMapIntensity = π×0.45 / scale`; live lights lowered when baked; plus the live URL bug fix (`apartment.js` relative `exterior.url`, rnd-ed) and the gate-1 label fix (a ring of compact-label spots near the anchor).
- **Evidence:** `development/tasks/apartment-3d/logs/check-08.txt` 8/8, `check-08-fallback.txt`, `check-urlfix.txt`, `probe-labels-embedded.txt` (11/11 Pixel 7 + iPhone 13), `c08-*.txt` green; page +388 KB; CPU×4 cold 3466 ms; `.wt/apartment-3d/after/phase2/`.
- **Learned:** the gain is a look decision — tune it on screen (π×0.85 washed the floors white; 0.35 too dark); three's lightMap mipmaps are harmless here once thin islands are collapsed, but stay off.
- **Owed / open:** none for card 08 (gate 2 judges it).
- **Second reader:** none.
- pointer (from blender-scene, card 07): the atlas + `bake.scale` contract → `memory/agents/blender-scene.md`

## 2026-11-03 · main session as platform-dev · platform-ui-ux cards 06+07 (Studio on the design system)
- **Did:** Studio dashboard rebuilt on the tokens: my projects / new-project wizard / project page (upload with role chips, 'מה המערכת הבינה' review with per-field uncertainty flags, create timeline, three deliverable cards, advanced collapsed); read-only fixture API on :8853; platform/tools/sync-tokens.mjs + test keep the Studio's token copies equal to the source.
- **Evidence:** `development/tasks/platform-ui-ux/logs/c07-studio.txt`
- **Learned:** (1) The browser logs every 4xx as a console error, so a deliberately refused POST always shows one — count them against the provoked requests, do not hide them. (2) Raw pipeline notes carry long floats (71.91666666666666s); format notes at render time. (3) Python non-raw strings turn \b into a backspace inside JS regexes — patch JS with a script file or Edit.
- **Owed / open:** card 08 (real server + npm ci) waits for Eliran's go
- **Second reader:** `qa-reviewer`
- gate2 (qa-reviewer): D2 Pixel7 r-bath-main label 2.98 label-heights from anchor; D1 atlas streaks → logs/gate2-report.md

## 2026-11-03 · main session as platform-dev · platform-ui-ux cards 09–11 (open B, Phase 0, home)
- **Did:** After rnd-fd released 37 paths (17:14) added 48 platform files; baseline 12/35/18/25 green on a throwaway preview tree (tools/preview.py); card 10: one DEV in js/dev.js, tokens+Heebo on index/landing/flow, mark plate 6.97:1; card 11: home rebuilt on tokens (hero, cards with computed status, empty state, ?theme preview).
- **Evidence:** `development/tasks/platform-ui-ux/logs/c11-home.txt`
- **Learned:** (1) Loading the real Heebo widened English text and exposed a latent bug: flow-real.css set --caption-h on body.has-legal, shadowing the measured value flow.js writes on <html> — a font change can break layout tests, so re-run them after any font load. (2) DEV is true on 127.0.0.1, so a buyer view needs a mapped host (--host-resolver-rules buyer.test). (3) A module imported by a Node test must not touch location/document at import time.
- **Owed / open:** Gate 1 (card 12) review running; theme pick is Eliran's
- **Second reader:** `qa-reviewer`

## 2026-11-03 · main session as platform-dev · platform-ui-ux cards 08, 12–15 (Studio live, Gate 1, CSS on tokens, chrome, landing)
- **Did:** 08: npm ci (9 pkgs) in the working-copy Studio, real server :8853, upload round-trip, 0 stages $0. 12: Gate 1 FAIL (browser.mjs not re-run after the home rewrite) → fixed → PASS; theme light. 13: style/landing/dashboard CSS on tokens via new --chrome-* set, 94/94 landmarks ±2px. 15: flow-real.css on tokens, anchors 0px. 14: landing rebuilt (availability, legal summary, no clay).
- **Evidence:** `development/tasks/platform-ui-ux/logs/c14-landing.txt`
- **Learned:** (1) Re-run EVERY suite after a markup rewrite — Gate 1 caught browser.mjs stale on card 11. (2) style.css is loaded cross-origin by the :8899 hold: map legacy vars to tokens and @import tokens.css inside style.css, never rely on the page linking tokens. (3) Two stylesheets defining --line at :root collide silently; rename the local one. (4) flow-cine has a rare iPhone glide-timing flake (1 of 5 runs) unrelated to CSS.
- **Owed / open:** card 16 waits for apartment-3d's copy-back (asked rnd-fd); then 17 (Gate 2, Eliran checks the legal display), 18–19, 20 copy-back on Eliran's good
- **Second reader:** `qa-reviewer`
- pointer (main session rnd-fd, board apartment-3d CLOSED): the 3D viewer now carries floor textures (uv1, world metres), the lightmap with mipmaps and the floorfill polygon offset → `memory/runs/2026-11-03-apartment-3d-close.md`
- pointer (habait-ux-judge, platform-ui-ux card 19): FAIL 4×S1 — reopen 07 (deliverables 'מוכן' on clay drafts app.js:405/414; review ✓ hard-coded index.html:84/110), 11 (home CTA above fold), 14 (landing B two EN + title ×3; chevron double-mirror landing.js:204), 16 (facts ×2, tab row at 390) → see habait-ux-judge.md 2026-11-03 + development/tasks/platform-ui-ux/logs/ux-review.md — your cards to fix
- pointer (habait-ux-judge, card 19 re-check): PASS-WITH-NOTES; still yours before copy-back — F7 (timeline note bidi still scrambled, app.js notes), F11 (tab fade on the start edge, hidden 'אודות' on the end edge), F23 (spec grid 4 cols/2 cells = grey slab at 1440) → see habait-ux-judge.md re-check entry + logs/ux-review.md §בדיקה חוזרת
- pointer (habait-ux-judge, card 19 final): PASS-WITH-NOTES, 0 S1 — nothing to reopen; optional S3: the tab fade overlays the selected 'אודות' pill, and on the phone the timeline note shows '14 :בוקר clips' → see habait-ux-judge.md re-check 2 + logs/ux-review.md §בדיקה חוזרת 2

## 2026-11-04 · main-session → second-reader pointer
- runs/2026-11-03-platform-ui-ux.md — 2026-11-04 follow-up: phone 3D frame ran under the CTA bar (doubled scroll offset + 65px top bar); fixed in apartment.css, check-04 47/0, live tests green; wt.py add reopens closed files → `memory/runs/2026-11-03-platform-ui-ux.md`


## 2026-11-04 · main-session → second-reader pointer
- runs/2026-11-04-transition-rise.md — the tour↔dollhouse protocol grew: `habait:scenes`, `rise`, `rise-ready`, `rise-done`, `3d-hide` (tour → page on close; the page drops a dive in flight) and `enter-room {dove}`. The viewer has `rise`/`dive`/`transitionPreview`. In the repo, NOT deployed: a deploy needs Eliran's own go and must rebuild platform 846 + tour apt846 from live (rnd-23's prod snapshot of ~07:2x predates it).

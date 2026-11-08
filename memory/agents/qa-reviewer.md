# qa-reviewer — lessons (newest last)


## 2026-11-03 · qa-reviewer · apartment-3d gate 1
- **Did:** Refuted cards 03-05 in a fresh context: build, smoke, minimap, apartment tests and check-03/04/05 re-run (all exit 0); own probes on iPhone 13, Pixel 7 and desktop; live drift 0; legal text diffed against the live dist; ZIP opened from file:// (0 non-file requests).
- **Evidence:** `development/tasks/apartment-3d/logs/gate1-report.md`, `gate1-*.txt`, `gate1-probe*.cjs`; screenshots in `.wt/apartment-3d/after/phase1/gate1/`.
- **Learned:** Verdict FAIL with 1 minor defect: embedded Pixel 7 Top shows 10 of 11 labels (r-bath-main culled), while the author's check only asserts >= 7 on phones. Under SwiftShader (1-2 fps) the orbit-distance easing needs >10 s to converge, so short waits give false clipping; wait for the distance to settle. `setPreset('3d')` turns autoRotate off, so an orbit test needs a fresh open.
- **Owed / open:** the main session rules on defect 1 (waive, or card 03 reworks label culling). Real tour (:8848) was never run, only stubbed.
- **Second reader:** platform-dev (card 03 label culling).

## 2026-11-03 · main session as platform-dev → second-reader pointer
- platform-ui-ux c05: tokens.css + components.css (hb-*) + self-hosted Heebo/Frank Ruhl Libre (49 KB first paint) + styleguide.html + tools/contrast.mjs; 0 contrast fails both themes; 0 errors, no h-scroll, 0 Google requests → logs/c05-styleguide.txt, c05-contrast.txt → `memory/agents/platform-dev.md`

## 2026-11-03 · main session as platform-dev → second-reader pointer
- platform-ui-ux c06+c07: Studio on tokens (projects, wizard, upload+roles, review with 10/10 flags, timeline no %, results a/b/c with 'עוד לא בשרשרת הזו'); fixture API :8853 read-only; tokens-sync test PASS → logs/c06-studio.txt, c07-studio.txt → `memory/agents/platform-dev.md`

## 2026-11-03 · qa-reviewer · apartment-3d gate 2
- **Did:** Refuted cards 07-08 plus two riders in a fresh context: build, smoke, minimap, apartment, check-03/04/05/08/08-fallback and selftest all exit 0; 3 floor GLBs one BIN; +388 KB; CPUx4 cold 3.1-3.3 s; geometry equal to Phase 1 (27 nodes, triangles, bounds); legal identical; live drift 0; URL fix proven in a real browser with the live file as control; Top labels 11/11 on both phones.
- **Evidence:** `development/tasks/apartment-3d/logs/gate2-report.md`, `gate2-*.txt/.cjs`; frames in `.wt/apartment-3d/after/gate2/`; `after/compare.png`.
- **Learned:** Verdict FAIL (2). D1: horizontal barcode dashes on parquet in Top with the 2048 atlas (iPhone 13, DPR 2); clean at 1024; the author's own frame had them. D2: Pixel 7 r-bath-main label 2.98 label-heights from anchor. Re-running an author's check overwrites its screenshots: `after/phase1/*_preset_*` were already the baked build, so a true Phase 1 A/B needs the no-atlas fallback build. Zoom at 3x on floors, not just walls.
- **Owed / open:** main session rules on D1 (card 07/08 rework: collapse thin floor islands at 2048 or cap atlas at 1024) and D2 (waive?). Card 02d with Eliran after the A/B. Real tour never run (stubbed).
- **Second reader:** blender-scene (D1 atlas packing); platform-dev (D2 label ring).

## 2026-11-03 · main session as platform-dev → second-reader pointer
- platform-ui-ux c09–c11: 48 platform files added after rnd-fd's release; baseline green; js/dev.js single DEV; Heebo on pages; caption-h shadowing bug fixed in flow-real.css; home on tokens, status computed → logs/c09-baseline.txt, c10-phase0.txt, c11-home.txt → `memory/agents/platform-dev.md`

## 2026-11-03 · main session as platform-dev → second-reader pointer
- platform-ui-ux c08,c12–c15: Studio live (npm ci, :8853, $0); Gate 1 FAIL→PASS, theme light; CSS on tokens (--chrome-*), landmarks ±2px; chrome anchors 0px; landing rebuilt (availability, legal summary, no clay); 16 waits for apartment-3d → logs/c08-live.txt, gate1-report.md, c13-*, c14-landing.txt, c15-chrome.txt → `memory/agents/platform-dev.md`

## 2026-11-03 · qa-reviewer · apartment-3d gate 3
- **Did:** Refuted cards 07/08/08b + D2 fix in a fresh context: build, smoke, apartment, check-03/04/05/08/08-fallback/urlfix, labels probe, selftest all exit 0; floor_textures.py re-run byte-identical; 3 GLBs one BIN; geometry = Phase 1; +422,573 B; legal word-for-word; live drift 0; spike code absent from product.
- **Evidence:** `development/tasks/apartment-3d/logs/gate3-report.md`, `gate3-*.txt/.cjs/.json`; frames and crops in `.wt/apartment-3d/after/gate3/`.
- **Learned:** Verdict FAIL (3). D1 barcode dashes persist (lightmap-caused, proven by removing the lightmap in-page; now visible at DPR1 too). D3: `minimap.test.mjs` exit 1 because `floorColor` is now white under the texture (the author's run list skipped it). D4: lazy texture decode races on fast finish switches (floor state != texture shown). Run ALL Check tests, not only the author's cks; in-page material toggles isolate which layer causes an artefact.
- **Owed / open:** main session routes D1 (blender-scene: floor islands in the atlas), D3/D4 (platform-dev). Real tour never run (stubbed). Floor texture reads smooth, no plank joints: Eliran's look call.
- **Second reader:** platform-dev (D3, D4); blender-scene (D1).

## 2026-11-03 · qa-reviewer · apartment-3d gate 4
- **Did:** Re-judged the gate-3 fixes in a fresh context: build, smoke, minimap, apartment, check-03/04/05/08/08-fallback/urlfix, labels probe (11/11) and selftest (64/0) all exit 0; D1 repro on desktop DPR1+2, iPhone 13, Pixel 7 x 3 presets x 3 finishes (36 frames); D3/D4 probes; floorfill threshold test; geometry, legal, size, drift.
- **Evidence:** `development/tasks/apartment-3d/logs/gate4-report.md`, `gate4-*.txt/.cjs/.py`; frames and crops in `.wt/apartment-3d/after/gate4/`.
- **Learned:** Verdict PASS (0 defects). D1 dashes gone everywhere (before-crops from gate 2/3 show them, gate 4 crops of the same spots are clean); D3 floorColor = finish colour; D4 holds under chained and 30 ms-staggered switches; floorfill alone covers the whole footprint so the polygon offset hides no threshold; +446,857 B (budget 600 KB); one BIN 51d18730. Author checks overwrite after/phase1|2 frames: copy the script with the OUT dir redirected. A pixel-count dash metric is useless on frames (edges dominate); judge zoomed crops. Pre-existing 1 px diagonal seams on large floors (gate 2 had them too).
- **Owed / open:** Eliran's "good" on the look, then card 10 (rebuild dist from the LIVE files after copy-back). Real tour never run (stubbed); no real GPU tested. Diagonal floor seams are his look call.
- **Second reader:** main session (card 10 close); platform-dev (seam observation).

## 2026-11-03 · qa-reviewer · dollhouse-in-tour gate
- **Did:** Refuted card 02-04 in a fresh context: rebuilt platform and tour from the working-folder files, re-ran check-dit (39/39), reg-check-03/04/05/08/08-fallback and labels probe, smoke/minimap/apartment tests and paint-proof (6/6), all exit 0; wrote 4 probes (marker direction/position on all 11 interior scenes, 11 exteriors, 40x open/close, keyboard, he/en/fr, 4 phones, floor, apartment-page 3D tab, malformed messages, no-dollhouse build); built tree vs live dist (only index.html + 3d/ differ); wt.py drift 0.
- **Evidence:** `development/tasks/dollhouse-in-tour/logs/gate-report.md`, `gate-probe1..4.cjs/.txt`, `gate-*.txt`, `gate-open-*.png`, `gate-lang-*.png`.
- **Learned:** Verdict FAIL (2). D1 medium: Esc does not close the 3D layer once focus is inside the dollhouse iframe (real click on the canvas, then Esc: layer stays; dollhouse has no key handler). D2 low: working-copy `build_zip.mjs` is CRLF but live is LF (whole-file diff, shebang `\r`); other five files keep CRLF. The marker's bearing, wedge geometry and cameras.json position all agree (0.1 deg, 0.1 cm). The dollhouse accepts postMessage only from its parent (self-posted test messages are silently ignored: send from the parent). Re-running an author's check overwrites its logs/frames. Bash heredocs eat backslashes in Python: write a file.
- **Owed / open:** main session routes D1 (dollhouse or tour: forward Esc / refocus) and D2 (re-save LF) before the card-06 copy-back; a gate re-run on those two only. Real GPU and iOS Safari untested; the layer does not pause tour audio/video.
- **Second reader:** main session (card 06 close; D1/D2 fixes); platform-dev (the dollhouse template Esc forward).

## 2026-11-03 · qa-reviewer · dollhouse-in-tour re-gate
- **Did:** Re-gated D1/D2 in a fresh context: rebuilt platform and tour from the working-folder files; line endings of all six files vs live and the frozen archive; D1 with real input (mouse, touchscreen taps, CDP touch drag, keyboard) on desktop, iPhone 13, Pixel 7: open, focus, drag, presets, Esc, label then go, inert tour behind, close, tour live again; check-dit, reg-check-03/04/05/08, paint-proof, apartment.test, wt status.
- **Evidence:** `development/tasks/dollhouse-in-tour/logs/regate-report.md`, `regate-probe1.cjs/.txt` (75 ok, 0 FAIL), `regate-probe2/2c/3`, `regate-check-dit.txt` (48/0), `regate-*.txt`.
- **Learned:** Verdict PASS (0 defects). D1: Esc posts habait:escape, closes in one press after a tap/drag in the 3D; with a room sheet open the 1st Esc closes the sheet, the 2nd the layer; inert lands on the 15 siblings in main#t-root only. D2: build_zip.mjs LF = live = archive. A touch that starts on a label button or the preset bar never orbits (also true top-level): start probe drags on the canvas, and re-read label coordinates after any view change.
- **Owed / open:** card-06 copy-back by the main session. Real GPU, real touch devices, iOS Safari iframe focus and the deployed site untested.
- **Second reader:** main session (card 06 copy-back and close).


## 2026-11-04 · qa-reviewer · transition-rise gate
- **Did:** Refuted cards 02-04 in a fresh context: rebuilt platform + tour from the shipping files; re-ran check-rise 36/36, check-dit 48/48, check-03/05/08, labels, smoke/minimap/apartment, paint-proof 6/6 (as gate-* copies); own probes: first frame vs tour on all 11 interior scenes (desktop, turned views, 2 phones), dive final frame vs arrival, 7 rapid-sequence scenarios, reduced motion, slow-device, memory over 10+5 cycles, apartment-page 3D tab; line endings; wt status.
- **Evidence:** `development/tasks/transition-rise/logs/gate-report.md`, `gate-probe1..5.cjs/.txt`, `gate-check-*.out`, `gate-frames/`.
- **Learned:** Verdict FAIL (1 low-medium). D1: Esc or x during the dive does not cancel it; the page's async `onEnterRoom` still posts `enter-room {dove}` and the tour navigates with the layer closed (desktop + iPhone). Notes: ~2 CSS px sideways offset on phones (pixel7 living 17.8); same-room dive closes on the tour's old yaw; wardrobe has no depth map so no move. The author's "check-04 fails without my files" is true only for the stale 23:09 apartment.css in the test build; live fixed it at 07:14, run build + live css = 47/0, live baseline = 47/0. Author's reg-check-03 points at the closed apartment-3d folder (still 40/0 on the run build). paint-proof needs HABAIT_APP_DIR. wt status shows DRIFT on 3 live output rows (live dist rebuilt 07:14).
- **Owed / open:** main session routes D1 (tour/dollhouse cancel on close) and decides N1/N2; card 06 must re-snapshot the three drifted outputs before close. Real GPU / iOS / deployed site untested.
- **Second reader:** main session (card 06; D1 fix in tour.js + build_zip.mjs); platform-dev (D1 dive cancel in the dollhouse page).

## 2026-11-04 - transition-rise regate (D1 Esc-cancels-dive, N2 same-room dive view)
- **Did:** Fresh refute-first re-gate of the fix (tour.js closeDh posts 3d-hide + !dh.open guard + same-room end view; build_zip.mjs hideGen). Read the code paths, ran probe3 on pixel7 (22/22) and my own race probes R1-R7 (close+reopen mid-dive, plain enter-room open/closed, apartment-style embed, Esc in frame, reduced motion, two rooms fast, same-room dive from two yaws). Verdict REGATE: PASS, no defects; one pre-existing observation (two rooms within ~150 ms ends in the first room).
- **Evidence:** development/tasks/transition-rise/logs/regate-report.md, regate-races.cjs, regate-races-desktop-R1-R4.txt, regate-races-desktop-R5-R7.txt, regate-races-pixel7.txt, regate-probe3-pixel7.txt
- **Learned:** a generation counter captured before the await plus a receiver-side open-guard covers close, close+reopen and stale posts; the apartment page is safe because it never sends 3d-hide. Backgrounded pipelines with `tail|tee` write nothing until the end; pgrep does not exist in this Git Bash (a Monitor with pgrep ends at once) - wait on a marker line in the output file instead.
- **Owed:** iphone13 not run for my race probes; author results (check-rise, reg-checks) taken on trust, not re-run.
- **Second reader:** main session (board close, transition-rise).

## 2026-11-04 - tour-exterior-floors QA
- **Did:** Fresh refute-first review of the exterior-scene floor-button fix (tour.js renderVideoBar). Read the code paths (renderRoom -> renderVideoBar on every load; setFloor never un-hides). Served the live dist on :8851, re-ran probe-floors (PASS) and probe-hop (PASS), wrote qa-routes.cjs: 11 exterior ids x plain/?floor=concrete/?floor=marble, scope=apartment, desktop + iPhone 13, plus a mutated served copy with room clips + intro (clip requests held open) for bar/overlay/floor-switch/hop/next-walk. Verdict QA: PASS, no defects.
- **Evidence:** development/tasks/tour-exterior-floors/qa-report.md, qa-routes.cjs, qa-run-floors.txt, qa-run-hop.txt, qa-run-routes.txt
- **Learned:** the live build has no room clips and no intro ("rooms":{}), so clip routes need a mutated served copy (page.route on index.html). The player's own #t-video-floors strip stays visible during an exterior clip or the intro: not covered by the fix, cannot occur in this build.
- **Owed:** main session / Eliran to decide whether the overlay strip (N1) should also hide for exterior clips and the intro in builds that carry them. Real clip playback untested.
- **Second reader:** main session (board close, tour-exterior-floors).

## 2026-11-04 · qa-reviewer · hold-building-tour gate
- **Did:** Fresh refute of card 04: rebuilt hb-run, Check 80/80 PASS, diff read, 2 own probe files (double-click, close before load, during orbit, room then close then 846 chain, Esc in frame, button in clip/descent, reduced motion, iPhone/Pixel landscape, sound). Verdict FAIL: 1 low-medium defect.
- **Evidence:** `development/tasks/hold-building-tour/logs/gate-report.md`
- **Learned:** Closing the overlay within 600 ms of opening leaves the ambience paused at volume 0 with sound.on true: fadeAmbience loop is never cancelled by closeBuilding. Author checks sleep too long to hit such windows; use in-page setTimeout to time races.
- **Owed / open:** main session reopens card 02 in the same wt folder to cancel the fade; narrow re-gate on Q1
- **Second reader:** none

## 2026-11-04 · qa-reviewer · hold-building-tour regate D1 fade
- **Did:** Re-gated fadeGen fix: Check 79/80 then tablet rerun 20/20, probe1/2 rerun, own fade probes (close at 0-1500ms, fast sequences, mute, 846 hand-off). Verdict PASS.
- **Evidence:** `development/tasks/hold-building-tour/logs/regate-report.md`
- **Learned:** A rAF-rate baseline probe is load-sensitive (5 vs 33/s); judge by state lines. C3 tablet 60s chain is tight under software GL.
- **Owed / open:** none
- **Second reader:** none

## 2026-11-04 · qa-reviewer · hold-building-tour card 06 QA live
- **Did:** Verified live=approved=manifest sha, stage vs prod-6 differs only hold/app.js+index.html and equals live after rewrite, Check 80/80 first run, own probe (X at 200ms ambience, 846 scope=apartment). Verdict PASS.
- **Evidence:** `development/tasks/hold-building-tour/logs/qa-live.md`
- **Learned:** Staged hold files can be byte-verified against live by replaying stage_flow.py subs; tablet C3 at 90 s passed first run.
- **Owed / open:** none
- **Second reader:** none

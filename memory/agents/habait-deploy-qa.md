
## 2026-11-04 · habait-deploy-qa · Card 22 QA on deployed habait-flow.vercel.app: FAIL on cine 404s
- **Did:** Headless Chrome, 6 pages x 1440/390, on the alias. All lines PASS except 0 console errors / 0 responses>=400 on landing variant b and flow.html: 3 never-staged _local/segments/rainbow-cine files 404, cine.js logs 2 errors, landing hero paints black. Ruled FAIL, not note.
- **Evidence:** `development/tasks/platform-ui-ux/logs/qa-deployed-report.md`
- **Learned:** Landing A/B split is random, so test v=a and v=b explicitly. Lazy hidden stills look broken until their tab opens. A network drop mid-run yields ERR_* rows: rerun, never judge.
- **Owed / open:** Eliran: stage rainbow-cine, default variant a, or accept; then rerun card 22.
- **Second reader:** none

## 2026-11-04 · habait-deploy-qa · Card 22 round 2 on dpl_HprzbAud: PASS
- **Did:** Fresh headless-Chrome rerun, 6 pages x 1440/390 on habait-flow.vercel.app: 12/12 rows 0 console errors, 0 responses>=400, Heebo ok, no Google Fonts, no dev text, no clay, AI badges present; cine hero and flow frames not black (luminance 136-147). Round-1 cine 404s gone.
- **Evidence:** `development/tasks/platform-ui-ux/logs/qa-deployed-report.md`
- **Learned:** A pixel luminance sample of the hero crop (PIL) is a cheap black-frame proof. Default A/B split differs per load; force v=a and v=b.
- **Owed / open:** Not tested: /tour/ rise/dive interaction, Edge. Main session sets board row to SHIPPED (QA 22 PASS).
- **Second reader:** none

## 2026-11-04 · main-session → second-reader pointer
- runs/2026-11-04-platform-ui-ux-shipped.md — platform-ui-ux SHIPPED to habait-flow prod on Eliran's go; QA 22 r1 FAIL (black cine stage) -> landing fallback + cine clips staged -> r2 PASS; habait.ai is another project → `memory/runs/2026-11-04-platform-ui-ux-shipped.md`

## 2026-11-04 · main-session → second-reader pointer
- runs/2026-11-04-flow-deploy-5.md: prod deploy 5 live on habait-flow.vercel.app; paint-proof PASS on / flow hold; owed: demo-transition shows dev error, 23 CLAUDE.md public despite stage_flow rule. → `memory/runs/2026-11-04-flow-deploy-5.md`

## 2026-11-04 · main-session → second-reader pointer
- project/2026-11-04-owed-024-rulings.md — Eliran ruled OWED-024: developer 'ישראל קנדה' shown, landing-B disclosure reduced to the flight's own, copy approved, a11y statement drafted (unpublished); live, not deployed → `memory/project/2026-11-04-owed-024-rulings.md`

## 2026-11-04 · main-session → second-reader pointer
- runs/2026-11-04-owed-024-deploy.md — OWED-024 (developer name, landing-B disclosure, copy) deployed dpl_D4nm8a…, live site_check 14/14 → `memory/runs/2026-11-04-owed-024-deploy.md`

- 2026-11-04 · second-reader pointer only: git steps now wait for a remote only (identity set, local only) → memory/project/2026-11-04-git-back.md
- 2026-11-04 · second-reader pointer: SHIP-LEDGER is live again (Vercel-deployment columns); append a row after every prod deploy → `memory/runs/2026-11-04-context-sync-4.md`

## 2026-11-04 · main session rnd-1f → second-reader pointer
- Eliran 2026-11-04: after his deploy go the main session runs the deploy itself, not a ! handoff; per-deploy go still required; first: habait-flow dpl_3avVrz 10:59 → `memory/project/2026-11-04-deploy-run-by-session.md`

## 2026-11-04 · habait-deploy-qa · Card 07 hold-building-tour deployed QA: PASS
- **Did:** habait-flow prod: check-building 80/80 on 4 devices, paint proof desktop+390 (aerial pano 200, non-uniform pixels), / /tour/ /hold/ clean. Verdict PASS.
- **Evidence:** `development/tasks/hold-building-tour/logs/qa-deployed.md`
- **Learned:** Check hash of served files first; sample pixels via an in-browser canvas on a clipped screenshot; the chain auto-advances so scene may be orbit2 by shot time.
- **Owed / open:** none
- **Second reader:** none

## 2026-11-04 · main session rnd-1f → second-reader pointer
- board hold-building-tour SHIPPED+CLOSED: hold button opens tour exterior overlay (one URL); gate D1 fixed; prod dpl_3avVrz 10:59 run by the session on Eliran's ruling; QA live + prod 80/80 → `memory/runs/2026-11-04-hold-building-tour.md`
- 2026-11-04 · second-reader pointer: stage_flow.py now drops every CLAUDE.md and demo-transition.html from the stage (step 3b) → `memory/runs/2026-11-04-prod-exposure-fix.md`
- 2026-11-04 · second-reader pointer only: product repo baseline 35cc0f6 on main; origin = previous owner GitHub, never push → memory/project/2026-11-04-git-back.md
- 2026-11-04 · second-reader pointer: your definition was rewritten for habait-walkaround / habait-flow (OWED-009); old-app steps marked not applicable → `memory/runs/2026-11-04-owed-cleanup.md`
- 2026-11-04 · second-reader pointer only: live walk found F01 (badge hidden in buyer flow) and F20 (placeholder phone 972500000000) on habait-flow prod → memory/project/2026-11-04-feature-worktrees-plan.md

## 2026-11-04 · main session → second-reader pointer
- main session rnd-77 · ONE git repo: Projects/Habait folded into C:\RnD (de560da); old product .git archived; feature = git -C C:/RnD worktree add → `memory/project/2026-11-04-one-git-repo.md`
- 2026-11-04 · second-reader pointer only: fix-disclosure-badge merged to main (7b6f617) — deploy to habait-flow waits for Eliran's go; prod check = הדמיה badge visible in ui=min, no 972500000000 links → memory/project/2026-11-04-feature-worktrees-plan.md

## 2026-11-04 · main session rnd-67 → second-reader pointer
- 2026-11-04 · rnd-67 · apt-furniture-swap plan: extend the catalog/typed-bar prototype to apt846, IKEA+fal catalog, behind the code 5/10 USD, worktree .wt/apt-furniture-swap; hold-glide bug → rnd-32 → project\2026-11-04-apt-furniture-swap.md → `memory/project/2026-11-04-apt-furniture-swap.md`
- 2026-11-04 · second-reader pointer only: habait-flow prod = dpl_eDQTT7o6o2S6hprXnaCGkP1VJwTc (fix-disclosure-badge); hold pinned to the pre-exterior-film bytes — exterior-film is in main but NOT in prod → memory/project/2026-11-04-feature-worktrees-plan.md

## 2026-11-04 · main session → second-reader pointer
- main session rnd-77 · /sync-context #2: cards 0/0, pipeline git line fixed, HOT notes the 12:30 parallel-deploy collision → `memory/runs/2026-11-04-context-sync-5.md`
- 2026-11-04 · second-reader pointer only: prod = dpl_eDQTT7o6 (badge fix) WITHOUT the exterior-film building film (its dpl_Em7YappX was superseded ~1 min later); combined redeploy owed on Eliran's go → memory/runs/2026-11-04-fix-disclosure-badge-deploy.md

## 2026-11-04 · main session → second-reader pointer
- main session rnd-77 · DEPLOY HOLD: Eliran approved one combined habait-flow deploy (film + badge) by rnd-32 only; nobody else deploys until it is done → `memory/project/2026-11-04-deploy-hold-rnd-32.md`

## 2026-11-04 · main-session → second-reader pointer
- runs/2026-11-04-exterior-film-a.md — building button = realistic 1080p film (24.8 s, $1.23), hold glide fixed; deployed dpl_Em7YappX…, overwritten by rnd-db then promoted back; prod 38/38 + 14/14 → `memory/runs/2026-11-04-exterior-film-a.md`

## 2026-11-04 · main session rnd-67 → second-reader pointer
- 2026-11-04 · rnd-67 · Eliran's go: prod already = live main (cmpstage 0/0/0), no redeploy; browser check PASS (film desktop+390, badge) → runs\2026-11-04-habait-flow-reverify-rnd67.md → `memory/runs/2026-11-04-habait-flow-reverify-rnd67.md`

## 2026-11-04 · habait-deploy-qa · Card A7 exterior-film deployed QA: PASS, 2 flaky timing rows
- **Did:** habait-flow prod: check-film 74 of 76 then two clean reruns, glide rests, site_check 14 of 14, film served as 206 Range (1080 desktop, 720 phone), first frame 515-680 ms, badge, legal text and end screen visible. E1 and once D1 flake: a polled probe shows the button hidden by 100 ms.
- **Evidence:** `development/tasks/exterior-film/logs/qa-deployed.md`
- **Learned:** Fixed-sleep asserts over a real network flake; poll instead. Screenshots stayed PNG.
- **Owed / open:** check-film.cjs E1/D1 need polling; Edge not run
- **Second reader:** none

## 2026-11-04 · main session rnd-67 → second-reader pointer
- 2026-11-04 · rnd-67 · habait-flow dpl_CUCZ…: furniture rings + AI catalog + typed bar open to all, FAL_KEY in Vercel env; prod typed change PASS; retry fix awaits go → runs\2026-11-04-apt-furniture-swap-deploy.md → `memory/runs/2026-11-04-apt-furniture-swap-deploy.md`

## 2026-11-04 · main session rnd-67 → second-reader pointer
- 2026-11-04 · rnd-67 · furniture swap follow-ups shipped (retry, phone rings, leftovers fixed; last dpl_6wv1…); stage_flow --edit-api now required → runs\2026-11-04-apt-furniture-swap-deploy.md → `memory/runs/2026-11-04-apt-furniture-swap-deploy.md`

## 2026-11-04 · main session rnd-67 → second-reader pointer
- 2026-11-04 · rnd-67 · dpl_BJMceg7g: phone parity (bar, one-row controls, cycling language), guide strip, ui=min shows all, card = only «המשיכו אל הדירה»; prod walk PASS → runs\2026-11-04-apt-furniture-swap-deploy.md → `memory/runs/2026-11-04-apt-furniture-swap-deploy.md`

## 2026-11-04 · main session rnd-67 → second-reader pointer
- 2026-11-04 · rnd-67 · Eliran: simulation must match the sales plan exactly (dimensions, details); apt846 never audited room by room; fidelity audit + platform gate owed → project\2026-11-04-sales-plan-fidelity.md → `memory/project/2026-11-04-sales-plan-fidelity.md`

## 2026-11-04 · fidelity-audit sub-agent (general-purpose, for the main session) → second-reader pointer
- apt846 fidelity audit: DEVIATES, 3 S0 (living extra glass wall, bedroom window over column, wardrobe fake doorway) + 3 S1 (kitchen hob, terrace south part, terrace roof). AI skin made the S0s -> research/fidelity-audit-2026-11-04/ → `memory/project/2026-11-04-sales-plan-fidelity.md`

## 2026-11-04 · fork C of rnd-67 (project runner) → second-reader pointer
- 2026-11-04 · fork C rnd-67 · run-project.mjs + run-job.mjs: the 846 recipe for any traced plan, package served locally (apt846-auto); fal locked TOP_UP blocks paid legs → runs/2026-11-04-project-runner.md → `memory/runs/2026-11-04-project-runner.md`

- 2026-11-04 (fork D, studio portal): /studio needs `stage_flow.py <out> --edit-api --studio` from merged main; previews verified, prod deploy waits for Eliran's go → `memory/runs/2026-11-04-studio-portal-fork-d.md`

## 2026-11-04 · fork fix-846-fidelity (rnd-67) → second-reader pointer
- runs/2026-11-04-fix-846-fidelity.md - apt846 fidelity fix: gate+consistency tools proven; 02/03/07/08/10 regenerated and PASS; fal locked (TOP_UP) before 04; 16.76/25 USD; not merged, not deployed → `memory/runs/2026-11-04-fix-846-fidelity.md`

## 2026-11-04 · worker of rnd-9d (sandbox-worker) → second-reader pointer
- Blender render of the runner proven in Vercel Sandbox (habait-flow, 4 vCPU cap = Hobby-like; spike PASS, $0.031); prod design = api/studio-dispatch + sweep cron + snapshot, secrets as sandbox env; nothing deployed → `memory/runs/2026-11-04-sandbox-worker.md`

## 2026-11-05 · fork C of rnd-67 (project runner) → second-reader pointer
- 2026-11-05 · fork C rnd-67 · first real portal job (Maale Efraim) through run-job against the real store → review (both floors FAIL trace-check, 34 mismatches, $0.104); executor: every floor checked, ledger outside the trace folder → runs/2026-11-05-maale-efraim-real-job.md → `memory/runs/2026-11-05-maale-efraim-real-job.md`

## 2026-11-08 · main session → second-reader pointer
- GitHub remote = Eliranshopen/HABAIT, PUBLIC by Eliran's choice (his gmail account), media-free no-history snapshot 444c5b2 of main@8864cbf; replaces 'no remote'; habait-rnd superseded, delete owed to Eliran → `memory/project/2026-11-08-github-remote-habait.md`

## 2026-11-08 · fork fix-846-fidelity → second-reader pointer
- runs/2026-11-08-tour360-redesign.md — tour UI direction C merged 88b989f and live-copied (not deployed): the 3D control is `#t-plan-btn` inside `#t-view` (id unchanged); the walkthrough opens on the FIRST visit only (fresh context = shown, `?coach=0` off, `?coach=1` forced); predeploy PASS 30/30.

## 2026-11-08 · fork fix-846-fidelity → second-reader pointer
- runs/2026-11-08-tour360-redesign.md — walkthrough music merged 5cec070 and live-copied (not deployed): no AudioContext before a gesture; after a tap it is "running", after «דלג»/the end "suspended"; mute key `habait-tour-music-muted-v1`; predeploy 30/30.

## 2026-11-08 · fork fix-846-fidelity → second-reader pointer
- runs/2026-11-08-tour360-redesign.md — walkthrough music v2 merged 89f134b, live-copied (not deployed): step = 3 bars at 108 BPM = 6.667 s (was 6.8 s); the step timer snaps to the music grid while it plays; accents on step changes; audio states unchanged; predeploy 30/30.

## 2026-11-08 · sub-agent rainbow-landing → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — the next habait-flow deploy carries the new root page (Rainbow landing, merged df98ecd) + 14 MB media under fixtures/rainbow/landing/; deployed QA = re-run Habait/platform/test/rainbow-landing.check.mjs against prod (film plays 1440+390, badges, routes).

## 2026-11-08 · fork fix-846-fidelity → second-reader pointer
- project/2026-11-08-846-numbers-sales-plan.md — 846 = the sales plan: apartment page «3 חדרים · 106.72 מ״ר · קומה 16», terrace 26.15; hold pill «קומה 16 · 3 חדרים»; merged 68ae48e/08cdeb3, live copied + build_zip rebuilt, predeploy 30/30, not deployed.

## 2026-11-08 · sub-agent rainbow-landing (round 2) → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — the root landing is project-level now (merged fa28f34): deployed QA = run test/rainbow-landing.check.mjs AND test/rainbow-flow.check.mjs (landing → CTA → film → stop → all units → enter) against prod.

## 2026-11-08 · sub-agent rainbow-landing (round 3) → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — /hold/ phone chrome changed (merged 69cfd49): deployed QA adds test/hold-chrome.check.mjs (360/390/430/1440, bbox overlaps of the top chrome) to the landing and flow checks.

## 2026-11-08 · fork fix-846-fidelity → second-reader pointer
- runs/2026-11-08-tour360-redesign.md — tool menus merged 9dcdeb7/30a6e6c, live-copied (not deployed): the 3D is `#t-plan-btn` INSIDE the «סגנונות צפייה» menu — open `#t-view-btn` first (desktop and phone); «כלי עזר» = `#t-tools-btn`; walkthrough key `habait-tour-coach-seen-v2`; the AI line has no band; predeploy 30/30.
- 2026-11-08 · main session: a viewer deploy now needs a worker snapshot refresh (worker.mjs refresh-snapshot --go, then snapshots.mjs boot + delete the superseded one) before any real portal build → runs/2026-11-08-worker-snapshot-refresh.md

## 2026-11-08 · sub-agent rainbow-landing (round 4) → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — prices hidden behind project.json prices_public (merged 6673204): deployed QA adds test/no-price.check.mjs (apartment page, hold cards, units list, landing.html at 360/390/1440) against prod.

## 2026-11-08 · fork fix-846-fidelity → second-reader pointer
- runs/2026-11-08-tour360-redesign.md — merged e1927f4, live-copied (not deployed): the walkthrough opens on EVERY tour load (use `?coach=0` for a clean screen); its music starts at open where the browser already allows sound (/hold/ → tour), else on the first tap; Playwright's evaluate() counts as a user gesture and this Chrome does not enforce Web Audio autoplay under automation — probe with CDP userGesture:false.

## 2026-11-08 · sub-agent portal-live-status → second-reader pointer
- runs/2026-11-08-portal-live-status.md — main 9718703 now holds the live portal (portal-stage d1b8fdd, build lock) + live job status; a plain `stage_flow.py --edit-api --studio` of main ships it (no --studio-src), but also main's undeployed platform rounds (rainbow-landing 6673204, tour 255dc9f). Not deployed; Eliran's go.

## 2026-11-08 · sub-agent portal flow bar → second-reader pointer
- runs/2026-11-08-portal-flow-bar.md — main 829b2a7: /studio/ project page has the flow bar #st-flow (9 steps); #st-job-stage and #st-steps are gone — a post-deploy check of /studio/ looks for #st-flow-head = #st-agent-head. Not deployed; Eliran's go.

## 2026-11-08 · fork fix-846-fidelity → second-reader pointer
- runs/2026-11-08-tour360-redesign.md — phone round merged 5b8ffd8, live-copied (not deployed): on touch ≤ 960 px a tap on the panorama hides the chrome (immersive; tap again to show); (?) is `#t-help` on phones too (top row); the walkthrough adds the «שינוי עיצוב» panel steps; music unlocks on the first tap in the tour on iPhone.

## 2026-11-08 · fork fix-846-fidelity → second-reader pointer
- runs/2026-11-08-tour360-redesign.md — merged 37bf147, live-copied (not deployed): /hold/ unlocks the walkthrough audio in «המשיכו אל הדירה» (`window.__habaitAudio`) and the tour plays on it with no tap; phones on a direct link get «▶ התחילו את ההסבר» first; a floor change reloads with a one-shot `?ir=1` and the walkthrough stays closed.

## 2026-11-08 · fork fix-846-fidelity → second-reader pointer
- runs/2026-11-08-tour360-redesign.md — merged 6c2fe26, live-copied (not deployed): the design panel's walkthrough is three section steps (view, floor, typed change); every step is 2 bars = 4.444 s (was 6.667 s); counts 1440 20/22, Pixel 7 17/19, iPhone 14 16/18 (visitor/unlocked).

## 2026-11-08 · sub-agent rainbow-landing (round 5) → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — /hold/ legal line now at the bottom edge (merged 24f0f29): deployed QA runs test/hold-chrome.check.mjs (360/390/430 portrait, 390 landscape, 1440; legal-line contrast + no marker overlap) against prod.

## 2026-11-09 · fork fix-846-fidelity → second-reader pointer
- runs/2026-11-08-tour360-redesign.md — merged f97d4ae, live-copied (not deployed): phones show `#t-tap-hint` (light-brown glass pill, first line of `#t-disclose`) «להסתרת/להצגת הכפתורים לחצו על המסך»; the phone action bar sits ~30 px higher; `#t-chrome-hint` (the old toast) is gone.

## 2026-11-09 · sub-agent rainbow-landing (round 6) → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — /hold/ phones now show a right-edge column (merged f9f6148): deployed QA runs test/hold-chrome.check.mjs (phones: no title, icon/«דירות»/legend on the right, no pill covered, the icon opens the film; desktop unchanged) against prod.

## 2026-11-09 · sub-agent rainbow-landing (round 6b) → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — /hold/ intro is now orbit_fast.mp4 (2x, merged 7802edc): deployed QA runs test/hold-timing.check.mjs against prod (click → picker ≈ 9 s at 390 and 1440).

## 2026-11-09 · sub-agent rainbow-landing (round 7) → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — the landing is now a scroll story (merged 782594a): deployed QA adds test/landing-motion.shots.mjs (desktop: Lenis + 2 pins; phone: native, no pins; reduced motion static; no overflow) to the landing check against prod.

## 2026-11-09 · sub-agent rainbow-landing (round 8 build) → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — the landing is now direction B with GSAP 3.13 SplitText (merged 0b3f3be): deployed QA runs test/rainbow-landing.check.mjs and test/landing-motion.shots.mjs against prod.

## 2026-11-09 · sub-agent rainbow-landing (brand) → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — the Habait brand is in (merged 58c9ada; the live tour dist was patched by tour360/tools/apply-brand-to-dist.py): deployed QA runs test/brand-placements.shots.mjs against prod.

## 2026-11-09 · sub-agent rainbow-landing (round 9) → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — the landing is rebuilt in the rainbowtlv.com feel and the roles are named (developer from project.json; Habait credited). Merged 3a0a5e6, not deployed. The live tour dist was patched (credit). Deployed QA: run rainbow-landing.check, landing-motion.shots and brand-placements against prod.

## 2026-11-09 · sub-agent rainbow-v2 → second-reader pointer
- runs/2026-11-09-rainbow-v2.md — a SEPARATE test page `/v2/` is in main (a6a32ec), NOT deployed. If Eliran gives a go it is a Vercel PREVIEW only, never the prod alias. `/v2/` is not in predeploy.mjs default pages: gate it explicitly (`responsive-gate.mjs --serve <stage> --rewrites <stage>/vercel.json --ignore-api /v2/`); last stage: predeploy 32/32, gate /v2/ PASS 1440+390.

- 2026-11-09 (rnd-9d): reference sites are inspiration only, never a copy (landing r9 rolled back 16:47) → `memory/project/2026-11-09-inspiration-not-copy.md`

## 2026-11-09 · sub-agent rainbow-landing (round 10) → second-reader pointer
- runs/2026-11-08-rainbow-landing.md — round 10 is merged (4eabbab, not deployed): the project landing with v2's hero and the roles. The motion test now expects one desktop pin (the picture stage). Deployed QA: run rainbow-landing.check, landing-motion.shots and brand-placements.

## 2026-11-09 · sub-agent rainbow-v2-r2 → second-reader pointer
- runs/2026-11-09-rainbow-v2.md (round 2) — main 91ed932 (NOT deployed) changes /hold/: 846 «המשיכו אל הדירה» → /apartment-journey/ (the tour opens inside it after the iOS unlock); the card adds a direct «לסיור 360°»; 846 floor glow. /v2/ forwards to /. predeploy now gates /apartment-journey/?from=hold&unit=846; rainbow-flow.check walks the new route. Real-iPhone music check still owed.

## 2026-11-09 · sub-agent hold-phone → second-reader pointer
- runs/2026-11-09-hold-phone.md — main 10d4af4 (NOT deployed) changes /hold/ on PORTRAIT phones: tower framing from tower_ndc_box (floor ≥ 33 px), small pills, chosen-floor glow, toast hint, one-line legal, glass sheet with «כניסה לדירה» (846 → journey). New gate test/hold-phone.check.mjs (375/390/430/1440); run with hold-chrome + rainbow-flow. Real-iPhone look owed.

## 2026-11-10 · sub-agent journey-r4 → second-reader pointer
- runs/2026-11-10-apartment-journey-r4.md — main a8f0ddd (NOT deployed): /hold/ 846 «כניסה לדירה» = one ~9 s flight over the hold (floors → glide → living-room landing) then the hold cross-fades to #tourFrame (room=living&yaw=-40). New gate test/apartment-journey.check.mjs; run with hold-phone, hold-chrome, rainbow-flow. Round-3 page archived in platform/tools/_unused/.

- 2026-11-10 (rnd-9d): iPhone ghost tower at the phone hold stop fixed (gradient air, ee80a5a); after a habait-flow deploy re-run hold-phone.check in WebKit too → `memory/runs/2026-11-10-hold-ghost.md`


## 2026-11-10 · sub-agent units-demo-marker → second-reader pointer
- runs/2026-11-10-units-demo-marker.md — main 51471bf (NOT deployed): units.json carries `source` per unit (846 sales-plan, 11 demo); «נתוני הדגמה» badge on every render of a demo unit's numbers (hold pill/card/drawer via js/picker.js, apartment, landing). Deployed QA: run test/units-demo-marker.shots.mjs + no-price.check against prod after any habait-flow deploy; 846 must stay badge-free.

## 2026-11-16 · main session → second-reader pointer
- 2026-11-16 Projects/Habait is OFF the disk (since about 13:22; 2,719 tracked files show as deleted, uncommitted; no moved copy found); Projects/3Dengine created empty; code survives in git a63494a + the .wt worktrees; untracked assets, keys and _local records have no confirmed source; Pi wrapper + bridge paths dangle → `memory/project/2026-11-16-projects-habait-off-disk.md`
- 2026-11-18 (pointer, tour360 sub-agent): Hatzav 360 tour staged-ready — tour360/dist/hatzav (realistic set, --ungated-ok), stage with tools/stage-tour.mjs; needs FAL_KEY/OPENROUTER_API_KEY/TOUR_EDIT_CODE names on its Vercel project → project/2026-11-18-hatzav-realism-items.md

## 2026-11-19 · main session → second-reader pointer
- FULL public repo Eliranshopen/RnD on Eliran's ruling (everything incl. .wt, public, LFS cost accepted): snapshot a92107db in C:/RnD-full.git, 195,313 files, 18,231 LFS objects 49 GB, history as a bundle; scans 0 real keys; tools scripts/snap_*.py; upload running → `memory/project/2026-11-19-full-public-repo-rnd.md`

## 2026-11-19 · main session → second-reader pointer
- RnD repo changed ruling: everything WITHOUT media; public Eliranshopen/RnD main a195535f, 116,261 files, clone verified byte for byte; media upload stopped at about 18 GB: those LFS objects are public by hash and billed until Eliran deletes + the session recreates the repo; full LFS snapshot a92107db kept local → `memory/project/2026-11-19-full-public-repo-rnd.md`

## 2026-11-19 · main session (3dengine) → second-reader pointer
- 2026-11-19 engine restore = ONE download: release engine-restore-2026-11-19 of the public repo Eliranshopen/RnD (RnD-engine-restore.zip 1.5 GB + agent-side.zip, source only), RESTORE.cmd proven 3 times on scratch folders; tools and steps in scripts/restore/; keys file by hand → `memory/project/2026-11-19-engine-handoff-other-computer.md`

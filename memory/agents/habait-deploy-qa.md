
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

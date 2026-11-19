# Habait/tour360/ — the 360° apartment-tour system (generator + viewer + one folder per apartment)
<!-- last-updated: 2026-11-04 -->

> ⚠ **History (2026-11-03):** the states and Slava-era approvals below are history; current state: `C:\RnD\Projects\Habait\memory.md`.

## What's here
The product-side 360° tour system, opened 2026-10-04 on Slava's "fast build … like a mock MVP, minimum
evals" order: a plan-driven **generator** (fal.ai panoramas → 2:1 pad → seam check → local Real-ESRGAN
upscale → web sets → hotspot calibration) and a **viewer** (one self-contained Pannellum page per
apartment with a room strip, a floor-plan sheet and the permanent הדמיה disclosure), governed by
[`PLAN.md`](PLAN.md). The first apartment, `apartments/demo-01/`, is the 13-panorama tour ported from
`D:\RealEstate3D` (a 2026-09-07 ChatGPT "Sites" project) — its generator stage is already done, so it
shipped viewer-first for the 2026-10-05 presentation. **State (2026-10-13): the board `development/tasks/habait-tour360/` is CLOSED — the R&D phase concluded on Slava's word
(D-T360-29); what it proved is `memory/project/2026-10-13-tour360-rnd-capability-record.md`.** `demo-01` stays LIVE on two
public noindex links, unchanged since 2026-10-05 — `https://habait-tour.vercel.app` (tag `deploy/tour360-demo-01-2026-10-04`)
and `https://habait-tour-design.vercel.app` (the prepared changes, the typed change behind `?key=`, the widened scope, the
real-person refusal; tag `deploy/tour360-design-07-2026-10-05`); whether the second link's paid function stays up is OWED-432.
The laptop-only work stays in the tree, off by default: the IKEA catalog and point-to-replace ([`CATALOG-PLAN.md`](CATALOG-PLAN.md),
`build-tour --catalog`; **IKEA parked**, the permission letter never sent), the test wave ([`TEST-PLAN.md`](TEST-PLAN.md),
`qa-evidence/tour360/T17/REPORT.md`) and the fix wave T18. **The next round — the live walkaround** (D-T360-30…32: one engine
for buyers in Habait and a developer's link; finishes & colours, furniture & style, free text, light & time of day; everything
generated live, as fast as models allow) starts from `research/live-walkaround/` (five lanes, 2026-10-13) → a new plan → a new
board; the unbuilt generator cards T02–T04b and the Ziv-canvas embedding (T06) are carried into it.

## Key files
| File | Purpose |
|---|---|
| `PLAN.md` | TOUR360-PLAN v0.9 — scope, the intake table, decisions D-T360-1…28, architecture, the 2026-10-05 delivery, the tasks, rails, open questions, §9 changing the room by text (§9.5 the widened scope, §9.6 the catalog pointer) |
| `CATALOG-PLAN.md` | the IKEA catalog prototype and point-to-replace (document control v0.5) — §2 how it works, §3 decisions D-CAT-1…28, §4 the catalog contract, §5 the file plan, §6 the cards, §8 open questions OQ-C1…C20, §10 point-to-replace |
| `TEST-PLAN.md` | the A-to-Z test of the tour, the typed change and the catalog (document control v0.2) — §2 the surfaces A–K, §4 the matrix, §5 the C-numbered checks, §6 the instruments, §10 the cards T17a–f; the report is `qa-evidence/tour360/T17/REPORT.md` |
| `WALKAROUND-PLAN.md` | **the next round, v0.4 (2026-10-13) — board `development/tasks/habait-walkaround/` FILED and EXECUTING, its own Vercel project `habait-walkaround` (D-T360-37…40, $20 hard, changes behind a code)**; before that v0.3 — the live walkaround: one engine for buyers in Habait and a developer link, four kinds of change, his D-T360-29…36, §4.1 the probe MEASURED ($2.78 of $3), §6 phases (P0 the mock LIVE privately at claude.ai/artifact/7XNAAPLe4MhKdmk85J52Rv, `mock/walkaround/`), §8 open questions |
| `WALKAROUND-QUALITY-PLAN.md` | **v0.1, 2026-10-28** — the improvement plan after the grilling, three research lanes, six REA captures and eight probes (D-WQ-1…24): the production lane becomes CG geometry from the plan + an AI skin (GPT Image 2.5 finals, Muse drafts), the two-tier walk, tiles from a 2× seamless upscale, the change bar patching now and re-skinning behind; nineteen cards in five phases to the pitch; evidence `qa-evidence/tour360/walkaround-quality/` |
| `README.md` | how to build a tour, run the one smoke, deploy the static site, add an apartment |
| `copy/tour360-copy.json` | every user-facing string ×3 locales; `badge` bytes are the app's asset-card bytes (he הדמיה · en Rendering · fr Simulation); `conceptLine` he is Slava's pick, en/fr drafts (OQ-2) |
| `viewer/vendor/pannellum-2.5.6.{js,css}` | Pannellum, extracted verbatim from the app's own `public/artifacts/_pano360.html` — offline, no CDN |
| `apartments/demo-01/scenes.json` | the viewpoint graph: 13 scenes, 24 links, the calibrated marker u/v from the source tour, `initialU`, plan x/y; the yaw/pitch formulas sit in its `coordinateNotes` |
| `apartments/demo-01/apartment.json` | title ×3, plan + viewBox, the sets (what is tracked, what stays local), disclosure keys, provenance, `project: null` |
| `apartments/demo-01/prompts.json` | the exact per-room generation prompts with plan x/y — 15 entries (the 13 rooms + the two `-v2` revisions, bedroom 4 and utility) — the generator's recipe |
| `apartments/demo-01/provenance/` | the enhancement manifests (hashes, model, pad/crop, GPU), `validation.json`, the web-set manifest, the generation manifest |
| `apartments/demo-01/edits.json` | the prepared text changes (T08): per scene, each change's patch file, its box in balanced-panorama pixels, its look direction, its draw order, its labels ×3 and its provenance (endpoint, prompt, price, hashes); written only by `tools/edit-pano.py publish` |
| `apartments/demo-01/markers.json` | the build-time scan: the tappable pieces as directions on the sphere — **16 markers in 5 scenes** (19 before T18c dropped three terrace rings on living-room pieces seen through the glass), chair sets whole, `identities` linking one piece across scenes (T18d); carried by `build-tour --catalog` only |
| `catalog/` | `items.json`: the five IKEA Israel pieces (KIVIK sofa · STRANDMON armchair · KRAGSTA coffee table · SKANSNÄS dining table · ODGER chair) with dated prices, the photo's SHA-256 and the proven view; `README.md`; `IKEA-PERMISSION-REQUEST.md` (the letter, v2). `catalog/_local/` = the photos, **gitignored, laptop-only (D-CAT-21)** |
| `apartments/demo-01/panos/patches/*.webp` | the RGBA patches the page draws over a panorama (14–86 KB each); the base panoramas are never modified |
| `tools/edit-pano.py` | the operator-side text edit: `crop` a flat view from the master · `run` a fal instruction editor (ledgered, capped) · `paste` back only the changed region as a patch · `preview` · `publish` · `selftest` |
| `tools/build-tour.mjs` · `tools/smoke.mjs` · `tools/paint-proof.mjs` | `apartments/<id>/` → ONE self-contained `dist/<id>/index.html` + media + the noindex `vercel.json`, zero dependencies · the ONE eval of a built tour (data, assets, every panorama 2:1, the disclosure ×3 locales, the size budget, the prepared changes) · the T05b gate, a fresh headless-Chrome paint proof of a LIVE url (phone/desktop × he/en/fr) |
| `tools/change-shots.mjs` | the change panel driven in a real browser (phone + desktop, 11 steps a cell); takes `--url` for a live link |
| `server/handler.mjs` · `server/vercel-edit.mjs` | the live typed change, one turn, zero dependencies: the unlock code (constant-time compare), the text step with the scope rule (OpenRouter, JSON mode), one fal instruction editor, reserve-and-settle, the day cap; the function wrapper the build copies to `dist/<id>/api/{edit,_handler}.mjs` |
| `tools/edit-server.mjs` · `tools/live-check.mjs` | the laptop host (serves `dist/` + `/api/edit`, keys by name from the root `.env`, the exact file ledger, prints the `?key=` link; … (Notes) |
| `tools/scan-pieces.mjs` · `tools/pano-geometry.mjs` | the build-time scan: four views a scene, one vision call a view → `markers.json` (a rerun by panorama hash is $0; `--drop` and `--same a=b` need a recorded `--why`; `--sheet` redraws the eye's sheet); the shared sphere maths |
| `tools/catalog-check.mjs` · `tools/catalog-probe.mjs` | the catalog's one check (`--write` records the photo SHA-256 the handler binds a request to, D-CAT-9) · the catalog turn proven vendor-free (`--selftest`: a no-item request takes the pre-wave path, byte for byte against the handler at `1b04ba65`), then with one |
| `tools/replace-probe.mjs` · `replace-matrix.mjs` · `turn-sheet.mjs` · `coverage-probe.mjs` · `sharpness-probe.mjs` | the proof kit: the T14c probe of two engines · every marker × item in a real browser, each a PAID turn (≈ $0.09–0.18) · the eye's sheet of recorded turns · the permanent-lines coverage probe ($0) · the balanced-vs-7K blur numbers ($0); `stub-host.mjs` is a vendor-free host and `file-ledger.mjs` the laptop's exact ledger |
| `viewer/edit-live.js` | the browser half: the current view cut out of the room's look (gnomonic), sent with the words; the result resize-aligned, colour-fitted, a cleaned difference mask, pasted back only where it changed; then `tour.js`'s live stack |
| `research/` | `2026-10-04-text-edit-research.md` (the method and the options) · `2026-10-04-edit-models-survey.md` (the fal edit models and prices, docs only) · `live-walkaround/01`–`05` (2026-10-13, the next round's five research lanes: fast edit models · finishes everywhere · restyle and relight · the UX benchmark · the engine audit) |

Notes (row overflow):
- `tools/edit-server.mjs` · `tools/live-check.mjs` (continued): since T17a it records every paid turn as files under `_local/turns/`, `--lan` serves a phone on the same Wi-Fi, `--ledger <file>` gives a test host its own ledger) · the browser proof of the live loop (a refusal + one paid change + undo) against any host; `--look pitch,yaw,hfov` aims first; `--force-first
  reframe\|rescale` answers the first attempt with a wrong picture so a guard must refuse it and a real later attempt must land; the record carries the page's own account of every attempt (`lastTurn`)

## Subfolders
| Folder | Purpose |
|---|---|
| `apartments/` | one uniform folder per apartment — `demo-01/` (the ported 13-room tour), `apt37/` (2026-10-15, a private apartment, 9 GPT Image 2 rooms, view-only link) … (Notes) |
| `viewer/` | the page: `template.html` · `tour.css` · `tour.js` (T01) · `edit-live.js` (the live change, T09) · `fonts/` (Heebo + Assistant woff2 subsets) · `vendor/` (Pannellum). The `?edit=1` calibration mode is T02 — **not built yet** |
| `tools/` | on disk: `build-tour.mjs` · `smoke.mjs` · `paint-proof.mjs` · `shots.mjs` (T01/T05b) · `edit-pano.py` · `change-shots.mjs` (T08) … (Notes) |
| `server/` | the live typed change's function — `handler.mjs` + `vercel-edit.mjs` (Key files above) |
| `research/` | the 2026-10-04 text-edit research round — two docs (Key files above) |
| `catalog/` | the IKEA prototype's items — `items.json` · `README.md` · `IKEA-PERMISSION-REQUEST.md` tracked; `_local/` (the five photos) gitignored (Key files above, gotchas below) |
| `copy/` | the copy pack (above) |

Notes for the `apartments/` and `tools/` rows: `README.md`, section "Subfolder-row overflow notes (from CLAUDE.md)" (moved there 2026-11-04, word for word).

## Conventions / gotchas
- **Disclosure is structural (root `CLAUDE.md` §6):** the badge, the concept line and the AI note render on every scene in every build target, permanently; wording is Slava's (`PLAN.md` OQ-2), never a build edit. `demo-01` is attributed to **no project** until he names the plan's project (OQ-1).
- **Originals are read-only and never in git:** `_local/` is gitignored; the PNG masters (472 MB) and the 7K WebP set (150 MB) stay at `D:\RealEstate3D` (`apartments/demo-01/_local/SOURCES.md`; T18g copied the 7K set into `_local/full/`, untracked); only `balanced` + `thumb` + the T08 `patches` (+ a lossy phone set) are tracked, ≤ 10 MB per apartment.
- **Heavy steps are bounded:** build/encode/upscale/paint-proof under Git Bash `timeout` (300 tests · 540 builds, encodes, renders), one heavy run at a time, one upscale image per call (~4 min on the A2000).
- **fal spend is ledgered and capped** (`FAL_KEY` by name; soft $5 / hard $10 per apartment, reserve-and-settle in `_local/ledger.json`); `fal-ai/nano-banana-pro/edit` has no 2:1 aspect — the pad recipe from `360walkaround/server/pano.mjs` is PORT-AS-IS, and the true-2:1 model is the T4 probe's question (OQ-3).
- **The vendor's account balance is the real cap (2026-10-05):** the page's $5-a-day counter and the laptop's $3 ledger bound only what is SENT — fal.ai locks the whole account on an empty balance (`403 User is locked. Reason: TOP_UP`) and the page then shows only «השינוי לא נטען. נסו שוב.» (`ui.changeFailed`, "did not load, try again"), which reads as a tour bug; before a demo
  of the typed change run one canary request (`tools/live-check.mjs` against the live link), and read the vendor's own text on the laptop host (`tools/edit-server.mjs`), whose ledger row keeps it — the hosted wrapper hides it by design (a reason of its own for a locked vendor is not built; it needs his word and a redeploy). **OpenRouter's balance is the same kind of cap:** from
  2026-10-09 00:25 every text call answered `402 insufficient credits`, which stops every paid turn, judge, likeness, scan and piece-read until the account is topped up (his console).
- **Deploys:** the demo is a separate public static Vercel project (`habait-tour`, noindex) built from a staged scratchpad copy of `dist/demo-01/`; the second link is its own project, `habait-tour-design` (noindex too; it carries the `api/` function); the Habait production project is never touched here; every deploy needs his own go.
- **The catalog is laptop-only; its photos are IKEA's (D-CAT-21):** `catalog/_local/` is gitignored and an evidence sheet LINKS a photo, never copies it; `build-tour --catalog` (explicit, off by default) copies the photos into `dist/<id>/catalog/` — a build for the laptop host only. A public deploy needs IKEA Israel's written permission (`catalog/IKEA-PERMISSION-REQUEST.md`) and his own go; T15a (the warden) is a BLOCK for T15b until then. A price is a dated read, never scraped.
- **A replace turn is one zoomed editor call, judged:** tap a ring (a scan marker) → the view cut zoomed onto the piece → Nano Banana 2 with the product photo as a second image → `op: 'replace_judge'` → a paste only inside the piece's region; the likeness score is reported, never gating; one swap re-runs in every scene that sees the piece (T18d — stub host only). **The T17 test
  found the old piece left behind on every big piece (S0)**; T18a/b re-ran the five leftover pairs 17 times, 11 runs clean by the eye — his look at the redrawn scan sheet (`qa-evidence/tour360/T16/scan/index.html`) gates any `--catalog` build going anywhere.
- **The 7K set on desktops (D-CAT-28):** `build-tour --full` carries it (`_local/full/`, untracked) beside the balanced set; the page picks it once at load on a wide non-touch screen whose GPU holds it. The `--full` dist is 158 MB — the hosted project takes it only on his deploy go (`qa-evidence/tour360/T18/SHARP.md`).
- Coordinates: u/v are on the FULL equirect image (u 0.5 = yaw 0); plan x/y are in the 1200×1200 pixel space of `floorplan.webp` with the sheet's viewBox `40 280 1085 665`.
- **Text changes (PLAN §9):** everything inside the view may change, people and pets included — the apartment's structure, a named real person (D-T360-26: a politician, a celebrity, a nickname, "looks like" — refused with its own message; describe the people instead) and unsafe content are refused (D-T360-24, which superseded D-T360-19's furniture-only scope on 2026-10-04 late
  night; `SCOPE.view` must be off for a real project's tour); people and pets route to Nano Banana 2, size to FLUX 3, the rest to Kontext; a surface change (a wall, the light) ends at the edge of the edited view (OQ-11); aim at the object first or the model invents one; **a result is pasted only on evidence that the composition held** — both editors sometimes redraw the scene
  (the people editor keeps the photo's edges and redraws the middle larger; Kontext re-frames), so the page tests the border ring, accepts a small pixel-exact people change at once, sends every other people result to the furniture judge (`op: 'judge'`: the same piece boxed in both views, compared in code) and retries a refused one, up to three attempts; ⛔ a `live-check` that
  exits 0 is not a picture that is right — open `change-<lang>` before calling a proof good; a change is a patch over a panorama that is never rewritten; every vendor call is reserved and settled in `_local/ledger.json` under the $3 cap and `publish` refuses an unledgered result; the instruction is English and names what must stay; the live typed version is team-only and its
  keys are Slava's paste (D-T360-18). Kontext re-frames instead of resizing an object — "bigger" needs FLUX 3, whose rights chain is not in the licence register (OQ-8).
- **Keys on the tour's project (D-T360-23):** `FAL_KEY`, `OPENROUTER_API_KEY` and `TOUR_EDIT_CODE` live on `habait-tour-design` (Production, Secret), set by `vercel env add` on standard input on his ask — never displayed; a new value needs a redeploy. The hosted day cap is counted in memory per instance (best effort) — the laptop ledger is the exact one.
- **The page and a scene swap:** `viewer.loadScene` is ignored while a scene is loading, so every change waits for `isLoaded()`; a room with changes is the scene `<room>~<ids>`, and a door marker's `sceneId` is retargeted to it so the changes stay on when the visitor returns.

## Links
- Parent: [../CLAUDE.md](../CLAUDE.md) · Plan: [`PLAN.md`](PLAN.md) · Research: `memory/runs/2026-10-04-realestate3d-tour-research.md` · Opening: `memory/runs/2026-10-04-tour360-track-opened.md` · The vendor lock: `memory/runs/2026-10-05-tour360-fal-lock.md` · The catalog wave: `memory/runs/2026-10-07-tour360-catalog-plan.md` → `memory/runs/2026-10-07-tour360-point-to-replace.md` · The test wave: `memory/runs/2026-10-08-tour360-t17-test-wave.md` + `qa-evidence/tour360/T17/REPORT.md`; the fix wave: `qa-evidence/tour360/T18/`
- Precedents reused: the app's `public/artifacts/_pano360.html` (Pannellum), `lib/buyer-team/video-tools.ts` + `components/buyer-team/windows/AreaDossierWindow.tsx` (the T6 embedding shape), `360walkaround/server/{fal,pano}.mjs` (fal lane + 2:1 pad), the office-mock static deploy (`memory/runs/2026-10-03-developer-office-import-and-talk.md`)

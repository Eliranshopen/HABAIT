# TOUR360-PLAN — Habait Tour360, the 360° apartment-tour system

**v0.8 · 2026-10-07 (FILED as v0.2 on 2026-10-04; the versions are in the document control) · track `Habait/tour360/` · board [`development/tasks/habait-tour360/`](../../development/tasks/habait-tour360/README.md)** — Slava's order the same evening: *"take everything we can take from the files we have and make a fast build of the 3D system that will go with us from now to the end … fast and quick, like a mock MVP, no a lot of evals, use the assets we have."* His four planning rulings and his four filing answers came through the question tool (§3, D-T360-1…4 and D-T360-11…14). He broke this plan into tasks himself (`/plan-to-tasks`, minimum evals); the board is EXECUTING, T01 first. **Presentation to a development company: 2026-10-05.**

---

## 0. What this is

A **system** that turns an apartment floor plan into a walkable 360° tour, plus the **first tour** built from assets we already own. Two halves: (a) the **viewer** — one self-contained HTML page per apartment, Pannellum multi-scene, room strip, floor-plan sheet, permanent disclosure; (b) the **generator** — plan → per-room prompts → fal.ai panoramas → 2:1 pad → seam check → local Real-ESRGAN upscale → web sets → hotspot calibration → build → deploy. The first apartment (`demo-01`) skips the generator: its 13 panoramas, prompts and upscaled masters exist already (§2).

Not the internal `360walkaround/` track (a ledgered server + edit pipeline + Blender renderer, internal only) and not a port of the OpenAI "Sites" app the assets came from (vinext + Cloudflare Workers + R2 — a different runtime). We take its **data and recipe**, not its code, except the Pannellum library the Habait app already vendors.

## 1. Scope

| In v1 (this plan) | Later (named, not built) | Out |
|---|---|---|
| `demo-01` tour page he/en/fr, phone + desktop | Ziv's canvas: `/artifacts/_tour_<id>.html` + table/tool/window on the area-dossier precedent (T6) | the source project's geometric 3D model page |
| static public Vercel site for 2026-10-05 (T5) | the 7K "full" set behind Vercel Blob for desktop | any live generation inside the Habait app |
| the generator lane (fal) + upscale + sets + calibration tools (T2–T4) | an OpenAI Images lane (`OPENAI_API_KEY`, none exists today) | judge rounds, gate memos for the static demo site |

## 2. What we take from `D:\RealEstate3D` (intake done 2026-10-04, T0)

| Source | Landed at | Use |
|---|---|---|
| `enhanced-panoramas/web/balanced/*.webp` (13 × 3548×1774, 7.6 MB) | `apartments/demo-01/panos/balanced/` (tracked) | the tour's default image set — loads fast, fits every GPU texture limit ≥ 4096 |
| `enhanced-panoramas/web/thumb/*.webp` (13 × 640×320) | `apartments/demo-01/panos/thumb/` (tracked) | room-strip cards |
| `floorplan-1.webp` | `apartments/demo-01/plan/floorplan.webp` | the floor-plan sheet with 13 numbered viewpoints |
| `apartment-tour/lib/panoramas.ts` (scene graph + calibrated marker u/v) + `image-generation/manifest.md` (best initial u) | `apartments/demo-01/scenes.json` | the viewpoint graph the viewer renders; formulas in the file's `coordinateNotes` |
| `image-generation/prompts.json` (13 exact per-room prompts with plan coordinates) | `apartments/demo-01/prompts.json` | **the generation recipe** the fal lane adapts |
| 13 `*-manifest.json` + `validation.json` + `web/manifest.json` + `image-generation/manifest.*` | `apartments/demo-01/provenance/` | hashes, model, GPU, pad/crop recipe — the upscale tool reproduces exactly this |
| `apartment-tour/public/panoramas/*.png` (originals, 23 MB) | `apartments/demo-01/_local/originals/` (gitignored) | comparison + regeneration baseline |
| PNG masters (472 MB) + full WebP set (150 MB) | **stay in place**; `_local/SOURCES.md` points at them | never in git; Blob later if the 7K set is wanted |
| Pannellum 2.5.6 | `viewer/vendor/` — extracted from the app's own `public/artifacts/_pano360.html` | offline, no CDN, same library the app already ships |
| Real-ESRGAN ncnn-vulkan + `realesrgan-x4plus` model (51 MB, `C:\Users\Admin\Documents\Codex\2026-09-07\…\work\quality-tools\realesrgan\`) | copied by T3 to `tools/realesrgan/` (gitignored) | the upscale step, the recorded recipe (64 px circular pad, ×4, 256 px crop, TTA) |
| the hosted tour `apartment-four-spatial-tour.slava1223.chatgpt.site` | not used — behind a ChatGPT login (401 to guests) | archive only |

## 3. Decisions

| # | Decision | Who / when |
|---|---|---|
| D-T360-1 | The system lives at **`Habait/tour360/`** (product track, beside `MVP/` and `marketing/`) | Slava 2026-10-04 (question tool) |
| D-T360-2 | **Generation lane = fal.ai via the existing `FAL_KEY`** (name only). Model picked by ONE bounded probe (T4, ≤ $1, 3 candidates × 1 image); default candidate `fal-ai/nano-banana-pro/edit` at 21:9/2K + the 2:1 pad the 360 track proved | Slava 2026-10-04 |
| D-T360-3 | **Tomorrow = a public static Vercel project** (`habait-tour`, noindex, like `habait-office-mock`); the deploy itself needs his explicit go at task time | Slava 2026-10-04 |
| D-T360-4 | **Disclosure = the permanent bilingual הדמיה badge + the concept line** (`copy/tour360-copy.json`: badge he הדמיה · en Rendering · fr Simulation = the app's asset-card bytes; the concept line and the AI note ×3 locales) + the footer AI note. On every scene, no time gating, no dismiss | Slava 2026-10-04; en/fr wording approved D-T360-13 |
| D-T360-5 | Viewer = **Pannellum 2.5.6**, vendored from the app's artifact, inlined into one HTML per apartment; no PSV, no three.js port | main session (speed; same lib as the app) |
| D-T360-6 | **Assets policy:** track `balanced` + `thumb` (+ a lossy phone set once T3 makes it, ≤ 10 MB per apartment); originals/masters/full never in git (`_local/`, hashes in `provenance/`) | main session |
| D-T360-7 | `demo-01` is **a sample, attributed to no project** until Slava names the plan's project/unit (OQ-1) | main session (honesty rail) |
| D-T360-8 | **Evals = one smoke script + one look by Slava** per apartment; a headless paint proof before a deploy; no judge rounds, no gate memo for the static site. The compliance gate comes when the tour enters the app (T6) | his "minimum evals" |
| D-T360-9 | Nothing in `D:\RealEstate3D` is deleted or edited; it is the archive | main session (§6 originals rule) |
| D-T360-10 | Cost caps: **$0 tonight**; a new apartment soft **$5** / hard **$10** of fal spend, reserve-and-settle in `apartments/<id>/_local/ledger.json` | **confirmed by Slava** in D-T360-12 |
| D-T360-11 | **File the board over the WIP ceiling** — 14 boards in flight at filing (EXECUTING 5 · IN-PROGRESS 8 · LIVE 1) against a ceiling of 3; recorded as the R-13 override in the board README | Slava 2026-10-04, «File it now» |
| D-T360-12 | **Spend:** **$2 on this board** — the model probe ≤ $1 (T04a) + a two-room end-to-end proof ≤ $1 (T04b); each future apartment soft **$5** / hard **$10** | Slava 2026-10-04 |
| D-T360-13 | **The en and fr disclosure lines are approved** exactly as in `copy/tour360-copy.json` (the concept line and the AI note); OQ-2 closed | Slava 2026-10-04 |
| D-T360-14 | **Build T01 now** — the execution go for the viewer, the build and the smoke; the deploy (T05) still needs its own go | Slava 2026-10-04 |
| D-T360-15 | **Owners:** no live agent's `boundary:` covers `Habait/tour360/**` (`walkthrough-engineer` = `3D/mvp/**` + `360walkaround/**`; `habait-fe` = the app repo; `render-pipeline-engineer` = the 360 pipeline), so the build tasks sit with the **main session** (R-3); `capability-scout` runs the probe, `habait-deploy-qa` the paint proof; no agent minted (skill rule 5) | main session (tier T0) |
| D-T360-16 | **Start view per room = the scene's `heading` at pitch −2°**, as the source tour did on every entry (`panorama-viewer.ts` `visit()`); `initialU` (the generation manifest's estimate) stays as data only | main session (tier T0, measured in the source) |
| D-T360-17 | **Text changes, tonight = prepared examples on a second link** — two or three changes made offline and shown as instant one-tap changes; no live generation in the 2026-10-05 meeting; the proven `habait-tour.vercel.app` stays untouched as the fallback | Slava 2026-10-04 night (question tool; not the recommended "after the meeting") |
| D-T360-18 | **The live typed version is team-only, behind an unlock code**; the public tour stays read-only; it needs his one-time paste of the fal and OpenRouter keys into the tour's Vercel project | Slava 2026-10-04 night (question tool) |
| D-T360-19 | **Change scope = furniture and décor only**; walls, windows, doors, room size and the view outside always stay as the plan has them | Slava 2026-10-04 night (question tool) |
| D-T360-20 | **Change budget = $3 before live** (about $1 the model test, $2 building and proving), **then a hard cap of $5 a day live** — beside D-T360-12's $2 for generation, not inside it | Slava 2026-10-04 night (question tool) |
| D-T360-21 | **Change method = crop the view → a fal instruction editor → paste back only the changed region, shipped as an RGBA patch** the page draws over a panorama that is never modified; whole-panorama editing and the `360walkaround` mask-and-fill lane are rejected (§9.1, research §2) | main session (T0; his veto open) |
| D-T360-22 | **Model per example, by result:** the sofa and the coffee table from `fal-ai/flux-pro/kontext` (licence chain SUPPORTED in the estate's register); the bigger TV from `blackforestlabs/flux-3/edit-image` — Kontext and Kontext Max missed "bigger" three times out of three; FLUX 3's rights chain is not in the register, so that example ships on his word (OQ-8) | main session (T0; his call at the deploy go) |
| D-T360-23 | **The two vendor keys may be copied by the agent from the harness root `.env` into the tour's own Vercel project** (`habait-tour-design`) through the CLI's standard input, never displayed — on his *"we have the key in other places, can you use them?"*; the unlock code is minted fresh and set the same way. The app's own project is untouched (its `FAL_KEY` stays Slava's console act, S-4) | Slava 2026-10-04 late night |
| D-T360-24 | **Change scope = everything the method can change inside the view, people and pets included** — furniture, décor, what is on a table, people seated at the table or on the chairs, a dog, the colour or material of a wall, floor or ceiling, the light, what is seen through the windows; **refused: the apartment's structure** (walls, windows, doors, ceiling height, room size or layout — the one change the paste-back cannot carry) **and unsafe content** (sexual, violent, hateful, illegal, a real person by name or likeness). Supersedes the scope half of D-T360-19; its "stay as the plan has them" survives for structure. The view-outside lane is a switch (`SCOPE.view`) to turn off for a real project's tour (root `CLAUDE.md` §6). People and pets go to Nano Banana 2 (the A/B on the dining table), size to FLUX 3, the rest to Kontext | Slava 2026-10-04 late night (*"give the option not only to change furniture but to change everything that we can change. For example if I want to sit people at the table or on the chairs"*) |
| D-T360-25 | **A standing go for fixes to the test link `habait-tour-design` for the night of 2026-10-04/05 only** — after two asked redeploys in an hour; the first link and the Habait production project are outside it; it does not carry to another night or another surface (standing law 2 stays) | Slava 2026-10-05 00:17 («Redeploy, and fix freely tonight (Recommended)») |
| D-T360-26 | **A named real person stays refused, with a message that says so** — a politician, a celebrity, anyone named or nicknamed, or "someone who looks like" them; people described without a name are fine. The reason put to him: a photoreal picture of real people on a page that sells apartments can read as their endorsement, and the image vendors restrict it | Slava 2026-10-05 00:33 («Keep refusing, clearer message (Recommended)», after *"bibi and trump sit on the cauch … not wirked"*) |
| D-T360-27 | **The catalog prototype runs on the laptop host first** — IKEA's product photos stay reference-only on this machine (`catalog/_local/`, ignored); the test link gets the catalog only after his ruling on their licence (OQ-14) and a deploy go; the first link never (`CATALOG-PLAN.md` D-CAT-3) | Slava, 2026-10-07, «Laptop host first (Recommended)» |
| D-T360-28 | **The laptop change ledger's cap rises $3 → $5** for the catalog prototype (≈ $1.20 of paid calls on top of the $1.64 used; `CATALOG-PLAN.md` D-CAT-6); D-T360-20's $5-a-day cap on the live function is unchanged | Slava, 2026-10-07, «Raise to $5 (Recommended)» · raised to $7 on 2026-10-08 for his test session (CATALOG D-CAT-23) · raised to $15 on 2026-10-08 evening for the test wave T17, whose own cap is $10 (CATALOG D-CAT-24, `TEST-PLAN.md`) |

## 4. Architecture

### 4.1 Folder

```
Habait/tour360/
  CLAUDE.md · PLAN.md · README.md · .gitignore
  copy/tour360-copy.json          every string ×3 locales (badge, concept line, AI note, UI)
  viewer/
    vendor/pannellum-2.5.6.{js,css}   vendored (T0)
    template.html · tour.js · tour.css (T1) the page; ?edit=1 calibration mode (T2)
  tools/
    build-tour.mjs (T1)   apartments/<id> → dist/<id>/ (self-contained index.html + panos/ + plan + vercel.json); --target artifact → the app's /artifacts/ shape
    smoke.mjs (T1)        the ONE eval (§6)
    make-sets.py (T3)     masters → full/balanced/phone/thumb WebP, hashes → provenance/sets.json
    upscale.py (T3)       the Real-ESRGAN recipe, one image per bounded call, manifest per image
    generate-panos.mjs (T4) the fal lane: prompts.json → fal → pad 2:1 → _local/generated/, ledger + caps
    pano-pad.mjs (T4)     PORT-AS-IS of 360walkaround/server/pano.mjs padToPano2x1 (zero deps)
    seam-check.py (T4)    wrap-seam + pole sanity, numbers only
  apartments/<id>/
    apartment.json · scenes.json · prompts.json · plan/floorplan.webp
    panos/balanced/ · panos/thumb/ · (panos/phone/)      tracked
    provenance/*.json                                     tracked
    _local/ originals/ masters/ full/ generated/ work/ ledger.json   gitignored
  dist/<id>/                                              gitignored build output
```

### 4.2 The apartment contract
`apartment.json` (title ×3, plan image + viewBox, sets, disclosure keys, provenance, `project: null|<id>`) and `scenes.json` (scene id, names ×3, zone, plan x/y, heading, `initialU`, hotspots `{to, u, v, source}`) are the only inputs the viewer reads. Formulas: yaw = (u − 0.5)·360; pitch = −12 − min(5, (v − 0.6)·35) (the placement the source tour validated), geometric alternative (0.5 − v)·180; a link without a marker uses the plan bearing. One folder per apartment, uniform, no per-apartment variations (the `listings/` rule).

### 4.3 The viewer page (T1)
One HTML file: vendored Pannellum inlined; `scenes.json` + copy inlined as JSON; scene switch with the hotspots as Pannellum `scene` hot spots; a room strip (thumbs, visited ticks); the floor-plan sheet (SVG over `floorplan.webp`, numbered circles at plan x/y); controls (prev/next, zoom, reset, slow rotation, fullscreen); the **permanent badge** top-start, the **concept line** under the title, the **AI note** in the footer; he default + en/fr switch (`dir` follows the language); phone-first (360 px, no horizontal scroll, the 16 px input floor, `prefers-reduced-motion` honoured for auto-rotate). Design: the Habait platform ground (navy `#0A1330`, the app's type), not the source's cream brand — a picked mock ports its composition, the theme is the platform's.

### 4.4 The pipeline for a NEW apartment (T2–T4)
1. Intake: plan image + room list + plan coordinates → `apartment.json`, `scenes.json` skeleton (by hand, 20 min).
2. Prompts: `prompts.json` from the demo-01 template (room geometry sentences swapped) — the recipe is the asset.
3. Generate (`generate-panos.mjs`, fal, bounded `timeout 540` per chunk): the probe-picked model; if it cannot emit true 2:1, `pano-pad.mjs` lands 2560×1280 (the 360 track's working recipe; the nadir bar is then covered by the badge-nadir patch idea, DS-5). Cache by inputs hash; retries never re-bill.
4. `seam-check.py`: wrap seam Δ and pole sanity → numbers in `provenance/`; a bad room is regenerated once, then flagged.
5. `upscale.py`: Real-ESRGAN x4plus, 64 px circular pad, exact crop, TTA; ~4 min per image on the A2000; **one image per bounded call**.
6. `make-sets.py`: full / balanced / phone / thumb + hashes.
7. Calibrate: open the built tour with `?edit=1`, click each opening, pick the target room, export `scenes.json`.
8. `build-tour.mjs` + `smoke.mjs` → deploy (his go) → optional `--target artifact` for the app.

## 5. Tomorrow (2026-10-05) — the delivery

- `dist/demo-01/` built by T1 → a staged copy in the session scratchpad → **`vercel deploy --prod`** as a new project **`habait-tour`** under his team, `vercel.json` with `X-Robots-Tag: noindex`; the Habait production project untouched (the office-mock recipe, 2026-10-03). **His explicit go before the command.** The auto-mode classifier blocked the office deploy once; if it does again, he runs the command in-session.
- Paint proof: one bounded headless Chrome pass (phone 390 + desktop), first scene painted, badge visible, a hotspot navigates — recorded under `qa-evidence/tour360/`.
- Fallback: the hosted ChatGPT tour on his signed-in laptop, or `dist/demo-01/index.html` opened locally.
- What he says: "a 360° concept tour generated from a floor plan in a day; this is the capability; furnishings and views are imagined" — never plan-exact, never a photograph.

## 6. Tasks (for `/plan-to-tasks`; evals = minimum)

Filed as board [`habait-tour360`](../../development/tasks/habait-tour360/README.md) on 2026-10-04 — the card numbers below are the board's.

| # | Task | Owner (`status` · model) | Produces | Acceptance (the whole eval) | Tier | Cost · bound |
|---|---|---|---|---|---|---|
| T00 | Intake ✅ 2026-10-04 | main session | this folder, assets, `scenes.json`, copy pack, vendor lib, card | files present, 13+13 WebP, 13 scenes / 24 hotspots | T0 | $0 |
| T01 | Viewer + build + smoke + two screenshots | main session | `viewer/{template.html,tour.js,tour.css}`, `tools/{build-tour,smoke,shots}.mjs`, `dist/demo-01/` | smoke green (scenes valid, assets present, 2:1 panoramas, the disclosure ×3 locales, self-contained); both screenshots painted; no horizontal scroll at 390; his one look | T1 | $0 · build ≤ 540 s |
| T05 | Deploy demo-01 | main session + **his go** | `habait-tour.vercel.app`, the harness tag `deploy/tour360-demo-01-<date>` | 200 + the noindex header; URL recorded | T2 | $0 |
| T05b | Paint proof on the live URL — the board's gate | `habait-deploy-qa` (live · sonnet, fresh) | `tools/paint-proof.mjs`, `qa-evidence/tour360/T05b/` | 6/6 cells (phone + desktop × he/en/fr): painted, disclosure in frame ≥ 12 px, one hotspot navigates, no horizontal scroll, noindex | T0 | $0 · 540 s |
| T08 | Prepared text changes ✅ built 2026-10-04 night (§9.2) | main session | `tools/{edit-pano.py,change-shots.mjs}`, `apartments/demo-01/{edits.json,panos/patches/}`, the change panel in the viewer, `research/` | `selftest` round trip ≤ 2.5/255; every vendor call a settled ledger row; smoke green; the browser run PASS on phone + desktop × he/en/fr; then his deploy go for a second link and a fresh paint proof on it | **T2** | $0.368 of $3 |
| T02 | Calibration mode | main session | `?edit=1` in `tour.js`, `viewer/calib-math.js` + its test | the math round-trips; an untouched export is byte-identical | T0 | $0 |
| T03 | Media tools | main session | `tools/{upscale,make-sets}.py`, `tools/realesrgan/` (gitignored) | hashes of the binary match; one upscale of `01-living` = 7096×3548 with its difference from the recorded master reported; sets at the recorded sizes | T0 | $0 · 540 s per image |
| T04a | The fal model probe | `capability-scout` (live · sonnet) | `tools/GENERATOR.md`, `apartments/fal-probe/` | ≤ 3 calls, ≤ $1, ids and prices verified live, one pick or BLOCKED with evidence | T1 (pre-ruled) | ≤ $1 · 540 s chunks |
| T04b | Generator lane + two-room proof | main session | `tools/{generate-panos.mjs,pano-pad.mjs,seam-check.py}`, `apartments/fal-test-01/` | ledger ≤ $1, a re-run makes no vendor call, the two-room tour builds and smokes green, a side-by-side for his look | T1 | ≤ $1 · 540 s chunks |
| T09 | The live typed change ✅ 2026-10-04 late night (§9.3) — pulled forward on his ask | main session | `server/{handler,vercel-edit}.mjs`, `tools/{edit-server,live-check}.mjs`, `viewer/edit-live.js`, the live stack in `tour.js`; keys on the tour's project by D-T360-23 | the code refused (403); a wall request refused with the scope message; a furniture request lands in 12–16 s; the laptop ledger exact; `live-check` PASS on the laptop and on the live link | **T2** | $0.046 of $3 so far |
| T10 | ~~The crop and the paste-back in the browser~~ — folded into T09 (`viewer/edit-live.js`) | — | — | — | — | — |
| T11 | The wider model test, his pick, the pick's rights chain | main session + `capability-scout` | a contact sheet of before and after views; a licence row for the pick | his pick, quoted; the row filed | T1 | inside $3 |
| T12 | The scope widens ✅ 2026-10-05 00:20 (§9.5, D-T360-24/25) — live on the second link after three deploys | main session | `server/handler.mjs` (reach · living · `SCOPE` · `routeModel` · nb2 · the furniture judge), `viewer/edit-live.js` (the acceptance rule), the copy (25 `change*` keys), `tools/live-check.mjs --look --force-first` | the probe 12/12; people at the real table at the right scale, laptop and live; both forced-failure proofs; the furniture lane unchanged | T09 · his redeploy go ✓ | **T2** |
| T13 | A named real person is refused with its own message ✅ 2026-10-05 00:45 (D-T360-26) — live on the second link | main session | `server/handler.mjs` (`real_person`), `viewer/edit-live.js`, one copy key ×3 | his wording refused with the new text, the generic request lands, laptop and live | T12 · his pick | T1 |
| T14a–T15c | The catalog wave — a catalog item instead of words, nine cards (`CATALOG-PLAN.md` §6); T14a–T14e ✅ 2026-10-07 | main session · `capability-scout` (sonnet) · `habait-deploy-qa` (sonnet) · `compliance-warden` (sonnet) | the catalog, the catalog turn, the probe sheet, the strip and the card, the test-link deploy on his go | per card; the wave's gate T14f (folded into T16e); his verdict D-CAT-11 after T14c (answered 5/5) | T0–T2 per card | ≈ $1.45 · the change ledger $5 (D-T360-28) |
| T16a–T16e | Point-to-replace — the scan at build time, the handler's piece and replace judge, the copy, the page by marker, the gate (`CATALOG-PLAN.md` §10.5, index T16); T14f folded into T16e; **T16a–T16g ✅ 2026-10-07 night** — the gate PASS 3/3, T16f the hardening re-checked PASS, T16g the likeness 3/3 on both pieces (D-CAT-20/22; CATALOG OQ-C14 open) | main session · `habait-deploy-qa` (sonnet) | markers for every replaceable piece, a tap that shows only the matching items, the product in the piece's place, accepted by the replace judge | per card; the gate T16e | T0 per card | $0.518 of ≤ $0.87 · the change ledger $4.08 of $5 (D-T360-28) |
| T17a–T17f | **The test wave — RUN 2026-10-08 night, $4.14: sixteen findings, the report `qa-evidence/tour360/T17/REPORT.md`, the judge's FAIL (2 S0 · 4 S1 · 20 S2 · 12 S3 · 3 Q); the fix wave T18a–T18m filed for his ruling** (`TEST-PLAN.md` v0.1, 2026-10-08 evening, on his «plan full testing, A to Z» after his own session): the recording host and the matrix driver, the $0 sweeps, the typed-change sweep, the full replace matrix with every picture opened, a fresh judge, the report with the fixes as T18 cards | main session · `habait-ux-judge` (opus) | every surface A–K measured or eyed; a ranked fix list with budgets | per card (TEST-PLAN §5) | T0 per card, T1 at T17f | ≤ $10 of the ledger's $15 (D-CAT-24) |
| T06 | Into Ziv's canvas — **its own small board, after the meeting** | `habait-fe` / `habait-be` + `compliance-warden` | `_tour_<id>.html` + media under `/artifacts/`, table + `show_project_tour` + window on the dossier precedent, the compliance assertion, the drive-ladder step | the app's compliance suite + registry drift-lock green; gate memo | — | $0 |
| T07 | Records and the close | main session | cards, SHIP-LEDGER + OWED rows, `/close-board` | the strict memory verifier exits 0 | T0 | $0 |

Tonight: **T01 → (his look) → T05 (his go) → T05b.** After the meeting: **T02 ∥ T03 ∥ T04a → T04b → T07**, then the T06 board.

## 7. Rails

- **§6 legal:** the badge, concept line and AI note are permanent on every scene and in every build target; wording changes are Slava's (OQ-2), never a build edit. Originals are read-only; nothing in the archive is touched.
- **Machine rules:** every build, smoke, upscale, encode and paint proof runs in Git Bash under `timeout` (tests 300, build/encodes/renders 540), foreground, one heavy run at a time; an upscale is one image per call.
- **Secrets:** `FAL_KEY` by name only, read from the root `.env`; never in a prompt, log, manifest or report. No OpenAI key exists; adding one is Slava's paste.
- **Cost:** reserve-and-settle before every fal call; the soft/hard caps in D-T360-10 stop the run.
- **Deploy:** one explicit go per deploy; the Habait production project is never touched by this track.
- **Git:** this folder commits to the harness repo (private); `_local/` and `dist/` are ignored; the app-side files of T6 commit to the app repo only under the exact app identity, by his go.

## 8. Open questions

| # | Question | Owner |
|---|---|---|
| OQ-1 | Which project and unit is the floor plan from? (Not the Grofit "דירה 1"; unidentified.) Until named, the tour is a sample | Slava |
| ~~OQ-2~~ | ~~Sign-off on the en/fr concept line and AI note~~ — **CLOSED 2026-10-04**, approved as drafted (D-T360-13); the B1 lawyer pass stays the app's general debt (OWED-003) | Slava |
| OQ-3 | Which fal model gives a TRUE 2:1 full sphere? `nano-banana-pro` has no 2:1 (pad recipe, smeared nadir); candidates with custom sizes exist — the T4 probe decides | T4 |
| OQ-4 | Host the 7K full set (150 MB) behind Vercel Blob for desktop? Not for the demo | later |
| OQ-5 | Does the public demo site stay up after the meeting, or come down? | Slava |
| OQ-6 | Mint a standing `tour360-engineer` agent (opus, write scope `Habait/tour360/**`) once apartments arrive in batches? Not needed for one apartment (D-T360-15) | Slava, when it matters |
| OQ-7 | The wording of an "edited view" tag for the live typed version, he/en/fr (the panel's present wording is UI copy, `change*` keys, his veto open) | Slava |
| OQ-8 | The rights chain of FLUX 3 — and of whichever model the live version uses — for a public page; until it is filed the TV example ships only on his word | Slava · research |
| OQ-9 | Keeping a change consistent across viewpoints (multi-reference editing, or the `360-v2` render track) | later |
| OQ-10 | Is a change ever saved for a visitor, or published as an apartment's official look? | Slava |
| OQ-11 | A surface change (a wall, the floor, the room's light) ends at the edge of the edited view and shows a seam when the visitor turns; the fix is a wider or a second view, or a whole-panorama pass for surfaces | later |
| OQ-12 | `SCOPE.view` — the view out of the windows may change on the demo (D-T360-24); for a real project's tour it must be off (root `CLAUDE.md` §6). Per project, his call | Slava |
| OQ-13 | The furniture judge anchors on the largest piece of furniture: a request that changes that very piece together with people can be refused wrongly, and it is proven on one view of one room — a wider test (other rooms, a sofa, a bed, a close view) belongs to T11 | after the meeting |
| OQ-14 | A catalog item instead of words — [`CATALOG-PLAN.md`](CATALOG-PLAN.md) v0.2 (2026-10-07): IKEA's product photos on any public host need IKEA's permission (its terms), so the prototype runs on the laptop host until ruled; the catalog source for the product (a partnership, a licensed feed, our own photographs) is the same ruling's second half (CATALOG OQ-C1/C2) — **ruled 2026-10-07 night, CATALOG D-CAT-21: laptop only until IKEA Israel's written permission (the request drafted, `catalog/IKEA-PERMISSION-REQUEST.md`); the catalog source beyond that stays his** | Slava — ruled |

## 9. Changing the room by text (added 2026-10-04 night)

His ask after the first deploy: type what should change — the sofa, the television — and see it change inside the tour. Research:
[`research/2026-10-04-text-edit-research.md`](research/2026-10-04-text-edit-research.md) (the method) and
[`research/2026-10-04-edit-models-survey.md`](research/2026-10-04-edit-models-survey.md) (models and prices, docs only). Rulings
D-T360-17…20; decisions D-T360-21…22.

### 9.1 The method (D-T360-21)

1. **Crop** the view as a flat photo from the lossless master (gnomonic, 1264×848, supersampled). The editor sees a sofa that looks like a sofa.
2. **One call** to a fal instruction editor, with an English instruction that names what must stay unchanged.
3. **Align** the result to the crop, match its colour on the untouched area, keep only the changed region inside an operator box, feather its edge.
4. **Project** that region back and save it as an RGBA patch in balanced-panorama pixels (`panos/patches/<asset>~<edit>.webp`). Its entry in `apartments/<id>/edits.json` carries the box, the look direction, the draw order and the provenance (endpoint, prompt, price, hashes).
5. **The page** draws the chosen patches over the panorama on a canvas and adds the result to the viewer as one more scene. The base panorama is never modified; the original is one tap away.

The tool is `tools/edit-pano.py` (`crop` · `run` · `paste` · `preview` · `publish` · `selftest`). Whole-panorama editing and the
old mask-and-fill lane are both rejected (research §2).

### 9.2 Tonight: prepared examples (T08, D-T360-17)

Three changes in `demo-01`'s living room, shown as one-tap examples in a panel that also carries a disabled "soon: type any
change" field and the scope note. A second static Vercel project carries this build — **`https://habait-tour-design.vercel.app`** (`habait-tour-design`, his «Deploy, all three», 2026-10-04 late night, tag `deploy/tour360-design-01-2026-10-04`); `habait-tour.vercel.app` stays as proven. Spend: $0.368 of $3.

| Example | Editor | Price | Note |
|---|---|---|---|
| a dark grey corner sofa | `fal-ai/flux-pro/kontext` | $0.04 | licence chain SUPPORTED in the estate's register |
| a black marble coffee table | `fal-ai/flux-pro/kontext` | $0.04 | same |
| a bigger TV | `blackforestlabs/flux-3/edit-image` | $0.024 | Kontext and Kontext Max missed three times; FLUX 3's rights chain is not in the register (OQ-8) |

### 9.3 The live typed version (D-T360-18…20, 23) — LIVE 2026-10-04 late night

Pulled forward on his ask. The page cuts the current view as a flat photo in the browser and sends it with the words to
`/api/edit`; the text step (OpenRouter, `google/gemini-3.7-flash`, JSON mode) translates to English, names the object and the
change, and applies the scope rule — a refusal is a product message in he/en/fr; one fal instruction editor (Kontext; FLUX 3 when
the request is about size) edits the view, reserved before and settled after; the page pastes back only the changed region and
keeps the result as a live change of the session (undo, original, reset). The team reaches the typed box through `?key=<code>`;
without the code the page is the read-only one. Hosts: the laptop (`tools/edit-server.mjs`, keys by name from the root `.env`,
the exact file ledger) and the Vercel function `api/edit.mjs` on `habait-tour-design` (keys set by D-T360-23; the day cap counted
per instance until a store exists). A turn is 12–16 s and about $0.045. T11 (the wider model test and the rights row) stays.

### 9.4 Rails specific to changes

- **Scope (D-T360-24, was D-T360-19):** everything inside the view may change, people and pets included; the apartment's structure, a named real person (D-T360-26) and unsafe content are refused. Every instruction ends with a keep-clause chosen by the change's reach (an object: the walls, windows, view, floor, ceiling and camera stay; a surface: the geometry, furniture, windows and camera stay; the view: everything inside the room stays), and only the changed region is pasted back. `SCOPE.view` is `true` for the demo and must be `false` for a real project's tour (the view out of a window is a material fact for a buyer, root `CLAUDE.md` §6).
- **Disclosure:** the badge, the concept line and the AI note stay on every changed view. The panel says the examples are prepared and that a change shows from one viewpoint only.
- **Spend:** reserve before send, settle after, in `_local/ledger.json`; `publish` refuses a result with no settled ledger row.
- **Text only:** a visitor never uploads an image.
- **One viewpoint:** the 13 panoramas are independent images; a change does not appear from another room's viewpoint (OQ-9).


### 9.5 The scope widens (T12, D-T360-24) — LIVE 2026-10-05

His ask after the main-screen box: *"change everything that we can change … sit people at the table or on the chairs"*. The text step
now returns a **reach** for every request — `object` (a thing, a person or an animal inside the view), `surface` (a wall, floor or
ceiling colour or material, or the light of the whole room), `view` (what is outside the windows), `structure` (refused) — and a
**living** flag. The handler routes living changes to `fal-ai/nano-banana-2/edit` ($0.08; on the dining-table crop it seated exactly
the four asked with food and natural poses where Kontext seated six), size changes to FLUX 3, everything else to Kontext; it appends
the keep-clause for the reach; the browser skips the colour fit for a surface change (the border ring legitimately changed). Proven
on the laptop: twelve probe requests in three languages answered as intended; "ארבעה אנשים יושבים לאכול ליד שולחן האוכל" seated four
people at the real table in 19.9 s; "קיר ירוק כהה מאחורי הטלוויזיה" in 17.9 s; the two structure requests refused with the new message
(`changeRefusedScope` reworded, `changeRefusedUnsafe` added). Limits stated, not hidden: a surface change ends at the edge of the
edited view (OQ-11); when the named object is not in the view the model invents one — aim first (the first proof asked for the
dining table while looking at the sofa and got a new round table with four diners); `SCOPE.view` per project (OQ-12).

**The acceptance rule (T12b–d, 2026-10-05).** The first live proof exited 0 on a wrong picture: the people editor had redrawn the
table and the diners at about twice their size and the page pasted it. A border-ring guard (T12b) missed it — the editor keeps the
photo's edges and redraws the middle. What holds, measured on this apartment's stored pairs: anything but a living change is accepted
when under 15 % of the border ring differs (held results 0–12 %, re-framed ones 16–59 %), else one retry on nb2; a living change is
refused at ring ≥ 30 %, accepted at once when the people editor left the ring alone and touched ≤ 22 % of the view (it keeps untouched
pixels exact), and otherwise goes to **the furniture judge**: one vision call (`op: 'judge'`, the text model, about 4 s and $0.0025)
boxes the largest piece of furniture in both views and the handler compares the boxes (overlap ≥ 0.5, area ×0.6–1.6) — 12 of 12 stored
pairs, where a yes/no question to the same model missed one of the two bad ones. A refused result is never pasted; a living change gets
up to three attempts (nb2 · nb2 · Kontext). `live-check --force-first reframe|rescale` proves both paths with a real later attempt.

### 9.6 A catalog item instead of words — planned 2026-10-07; the catalog wave filed, T14a–T14e done; point-to-replace ruled and probed the same evening (CATALOG-PLAN v0.3 §10)

His ask: *"lets say i want to replace the furniture from ikea catalog ... how can we do that?"* The answer is a second reference
image on the rail above: the visitor picks an item from a small catalog, the handler sends the view **and** the product photo to
the people editor (the one that takes several images) with *replace the sofa in the first image with the product in the second*,
the page pastes back the likeness under the same acceptance rule, and the item's card (name, price, link, its own AI-likeness
line) sits on the result. The catalog, not the picture, is the hard part: IKEA has no public API and no image licence, so the
prototype's five IKEA items stay reference-only on the laptop until he rules (OQ-14). The whole plan — method, decisions D-CAT-1…11,
the catalog contract, the file-by-file plan, the wave's cards (T14a–T14f on the laptop, T15a–T15c for the test link), the open questions and the spend (≈ $1.45) — is
[`CATALOG-PLAN.md`](CATALOG-PLAN.md) v0.2.

| Document control | |
|---|---|
| Author | Main session (Fable 5.1 for v0.1 and v0.3–v0.7, Opus 5.5 for v0.2), 2026-10-04 evening to 2026-10-05 |
| Version | v0.9 (2026-10-07 night, later: OQ-14 ruled — CATALOG D-CAT-21, laptop only until IKEA Israel's written permission; T16f/T16g, D-CAT-20/22) · v0.9 (2026-10-07 night: §6 row T16a–T16e ✅ — built and gated PASS 3/3; CATALOG-PLAN §8 OQ-C11…C13 from the gate's notes) · v0.9 (2026-10-07 evening: §9.6 → CATALOG-PLAN v0.3 §10, point-to-replace — markers from a build-time scan, a tap shows only the matching items, one zoomed editor call, the replace judge instead of §9.5's size rule for catalog turns; D-CAT-12…19 his; §6 row T16a–T16e filed by `/plan-to-tasks` the same evening) · v0.8 (2026-10-07: §9.6 + OQ-14 point at `CATALOG-PLAN.md` — a catalog item instead of words, the IKEA prototype; D-T360-27/28 his; the catalog wave T14a–T15c filed on the board, T14a done) · v0.7 (2026-10-05 00:45: T13, D-T360-26 a named real person stays refused) · v0.6 (2026-10-05 00:20: T12 LIVE with the acceptance rule and the furniture judge, D-T360-25, OQ-13) · v0.5 (2026-10-04 late night, later: §9.5 the scope widens, D-T360-24, T12, OQ-11/12) · v0.4 (2026-10-04 late night: T09 the live typed change LIVE, D-T360-23, T10 folded into T09) · v0.3 (§9, D-T360-17…22, T08) · v0.2 FILED — board `habait-tour360` EXECUTING (his `/plan-to-tasks` + four answers, D-T360-11…14); v0.1 DRAFT earlier the same evening |
| Inputs | His order and four question-tool rulings (2026-10-04); `D:\RealEstate3D` (research entry `memory/runs/2026-10-04-realestate3d-tour-research.md`); the app's `_pano360.html`, `disclosures.ts`, asset-card badge bytes; `360walkaround/server/{fal,pano,pricing}.mjs`; the office-mock deploy entry (2026-10-03) |
| Checked | Hosted tour probed live (401 login wall); tooling probed (Node 24, ffmpeg 9, Pillow 12.3, Real-ESRGAN exe + model present) |
| Next | the catalog track per `CATALOG-PLAN.md` (T16f → T16g → T15a on the laptop build → T15b/T15c on IKEA Israel's written permission and his deploy go); the tour's own open cards (§6: T02 ∥ T03 ∥ T04a → T04b), then T07 the close |

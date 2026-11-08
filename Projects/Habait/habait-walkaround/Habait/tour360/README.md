# Habait Tour360 — how to run

The 360° apartment-tour system: one folder per apartment under `apartments/`, one self-contained tour
page per apartment in `dist/`, a generator lane for new apartments. Governing plan: [`PLAN.md`](PLAN.md).
Current state and gotchas: [`CLAUDE.md`](CLAUDE.md).

## Build the demo tour (T1 delivers the tools)

```bash
# from the harness root, Git Bash, one heavy run at a time
timeout 540 node Habait/tour360/tools/build-tour.mjs demo-01            # → Habait/tour360/dist/demo-01/
timeout 300 node Habait/tour360/tools/smoke.mjs demo-01                 # the one eval
```

Open `dist/demo-01/index.html` from a local static server (a `file://` open works for the page but some
browsers block WebGL textures from `file://`; `npx serve dist/demo-01` is the usual fallback). Append
`?lang=en` / `?lang=fr` to switch language; `?edit=1` opens the calibration mode (T2).

## Deploy the public demo (T5 — needs Slava's go)

```bash
# stage the runtime files (never the repo) and deploy as a SEPARATE static project
cp -r Habait/tour360/dist/demo-01 "$SCRATCH/habait-tour" && cd "$SCRATCH/habait-tour"
timeout 540 vercel deploy --prod --yes          # project: habait-tour · noindex via vercel.json
```

The Habait production project is never touched by this track. Record the URL here and in memory.

**Live:** `demo-01` → **https://habait-tour.vercel.app** (`dpl_F1BAKwpFAHcvGW67YvB2KKtRyxJF`, 2026-10-04, harness tag
`deploy/tour360-demo-01-2026-10-04`). Share only that URL: the per-deployment `habait-tour-<hash>-….vercel.app` URLs sit behind
Vercel Authentication. A redeploy reuses the staged folder's `.vercel/` link, or re-creates it with the same `--scope`.

**Live, the second link:** `demo-01` with the prepared text changes (T08) → **https://habait-tour-design.vercel.app** (project `habait-tour-design`, `habait-tour-design-f5f5e3s0o-slavas-projects-bc553f3f.vercel.app`, 2026-10-04, harness tag `deploy/tour360-design-01-2026-10-04`, built from `5acf39c5`). Same rules: share only the production URL. A shared link with a change on: `https://habait-tour-design.vercel.app/?room=living&change=sofa,table`.

## Add an apartment — the recipe that built `apt846` (2026-10-28; `apt37` was its first run by hand on 2026-10-15)

The planned T2–T4 tools (`generate-panos`, `seam-check`, `upscale`, `make-sets.py`) were never built; these replaced them.

1. **The plan.** Render the architect's PDF at 288 dpi (pdf.js in headless Chrome, see `memory/local-voice-and-pdf-tools`), crop the apartment to `apartments/<id>/_local/plan/plan-crop.png` (≈ 2.25 px/cm at 1:50). The PDF and the crop stay in `_local/` (gitignored).
2. **`apartments/<id>/cameras.json`** — one row per scene: `at` and `lookAt` in crop pixels, `links` with the opening (`via`) the visitor walks through, the names ×3 and the zones. Pick the camera off columns and furniture; look at every crop the next step draws.
3. `node tools/make-refs.mjs <id>` — a 1700 px plan crop per scene with the red camera dot and the centre arrow (`_local/refs/plan-<asset>.png`) + the viewer's plan sheet `plan/floorplan.webp` (the crop × `planScale`). `node tools/make-scenes.mjs <id>` — `scenes.json` with every door marker by the plan bearing (u = 0.5 + Δ/360, v = 0.68); it warns on a link with no way back.
4. **`prompts.src.mjs` → `prompts.json`** — one prompt per room on the apt846 pattern (the projection block, CENTRE/LEFT/RIGHT/BEHIND from the bearings, one style block, the window rule, the refusals); the living room carries only the plan reference, every other room also `_local/refs/style-living.png` (the approved living answer at 2048×1024).
5. `timeout 300 node tools/gen-pano.mjs <id> <scene> gpt25x --cap <usd>` — **the lane: `openai/gpt-image-2.5/sunburst/edit` at 4096×2048 (answers 3840×1920), quality high** (`qa-evidence/tour360/apt846/MODEL-PROBE.md`: xhigh buys a seam, Seedream draws a photo, FLUX.2 ignores the plan, Nano Banana has no 2:1). Ledgered, cached by inputs hash, the living room first. Open every answer; measure the edge join (first vs last column) before trusting a sphere.
6. `node tools/make-sets.mjs <id>` — balanced 2048 q92 (tracked) · thumb 640 · full 3840 q90 (`_local/full/`, declared in `apartment.json` `sets.full`).
7. `timeout 540 node tools/build-tour.mjs <id> --engine --full` → `timeout 300 node tools/smoke.mjs <id> --full` → `node tools/stage-tour.mjs <id> <scratch>/<project-name>` (`--no-api` for a view-only link) → from the staged folder `npx --yes vercel@65.1.0 link --yes --scope <scope>` (creates the project named after the folder), `env add FAL_KEY|OPENROUTER_API_KEY|TOUR_EDIT_CODE production --sensitive` on stdin from the root `.env`, `deploy --prod --yes` — on his go → `timeout 540 node tools/paint-proof.mjs <url> --apt <id>` and `tools/live-check.mjs --base <url> --key … --look …` on the live link.

## Make a text change (T08 — the prepared examples; PLAN §9)

```bash
# 1. cut the view (free). u/v point at the object on the full panorama; widen --hfov until the whole object has margin
timeout 300 python Habait/tour360/tools/edit-pano.py crop demo-01 living sofa --u 0.216 --v 0.63 --hfov 114
# 2. one paid call, reserved and settled in apartments/demo-01/_local/ledger.json (cap $3). English; name what must stay
timeout 540 python Habait/tour360/tools/edit-pano.py run demo-01 living sofa --model kontext --prompt "Replace the sofa with … Keep everything else exactly as it is: …"
# 3. paste back only the changed region (free). --box = where the object is, in crop pixels; look at view-pair.jpg
timeout 300 python Habait/tour360/tools/edit-pano.py paste demo-01 living sofa --result result-kontext-1.png --box 150,290,1190,730 --close 45
# 4. publish the entry (labels.json = {he, en, fr}: the request as a visitor would type it), then build and check
timeout 120 python Habait/tour360/tools/edit-pano.py publish demo-01 living sofa --order 1 --labels <labels.json>
timeout 540 node Habait/tour360/tools/build-tour.mjs demo-01 && timeout 300 node Habait/tour360/tools/smoke.mjs demo-01
timeout 540 node Habait/tour360/tools/change-shots.mjs demo-01 --lang he      # add --url <link> for a live site
```

Models: `kontext` ($0.04, about 10 s, a clean licence chain, cannot make an object bigger) · `flux3` ($0.024 until 2026-10-08,
about a minute, did "bigger") · `nb2` ($0.08, re-upholsters a sofa in place but seats people exactly as asked) · `kontext-max` ($0.08).
The prepared examples are furniture and décor. A shared link opens with a change on: `?room=living&change=sofa,table`.


## Type a change live (T09)

```bash
# the laptop host — keys by name from the root .env; prints the link with the unlock code; Ctrl-C stops it
node Habait/tour360/tools/edit-server.mjs demo-01            # optional: TOUR_EDIT_CODE=<8+ chars> for a stable code
# the proof of the loop against any host (one refusal at the text step's price + one paid change, about $0.05)
timeout 540 node Habait/tour360/tools/live-check.mjs --base http://127.0.0.1:8720 --key <code> --lang he
```

Hosted: `https://habait-tour-design.vercel.app/?key=<TOUR_EDIT_CODE>` — the keys sit on that Vercel project (D-T360-23); a new
value needs a redeploy. Without the code the page is the read-only one. Scope (D-T360-24): everything inside the view may change —
furniture, décor, what is on the table, people and pets ("ארבעה אנשים ליד שולחן האוכל"), a wall or floor colour, the light, the view
outside; the apartment's structure (walls, windows, doors, room size), a named real person (D-T360-26 — describe the people instead:
"two men in suits on the sofa") and unsafe content are refused, each with its own message. Aim at what you
want to change first — an object that is not in the view gets invented. People and pets route to Nano Banana 2 (about 15–20 s,
$0.08); a size change ("bigger") routes to FLUX 3 and takes about a minute; everything else is Kontext (about 15 s). A wall or
light change ends at the edge of the edited view (plan OQ-11). Prove a host: `timeout 540 node Habait/tour360/tools/live-check.mjs
--base <host> --key <code> --lang he --look -13,0,80 --text "ארבעה אנשים יושבים לאכול ליד שולחן האוכל"`.
Then open `change-he` in the output folder: exit 0 is not a right picture (the first live run passed on giant diners). The same
command with `--force-first rescale` (or `reframe`) answers the first attempt with a wrong picture inside the browser — the furniture
judge (or the border ring) must refuse it and a real later attempt must land. A people result is pasted only when the furniture kept
its size; a refused one is retried, up to three attempts, about 15–20 s each.

## Where the big files are

Masters and the 7K set stay outside git — see `apartments/demo-01/_local/SOURCES.md`. Only `balanced`
and `thumb` (and later a lossy phone set) are tracked, ≤ 10 MB per apartment.

## The catalog (T14, `CATALOG-PLAN.md`) — a product photo instead of words

The visitor picks an item from a small catalog and the people editor puts that product into the room: the item's photo rides
with the view as a second image, the handler binds it to the catalog by its hash, the page pastes back the likeness under the
same acceptance rule plus the furniture judge on every catalog turn, and the item's card (name, price with its date, the product
page, its own AI-likeness line) sits on the result. The photos are reference-only on this laptop (`catalog/_local/`, ignored;
PLAN.md OQ-14) — a `--catalog` build is for the laptop host until that is ruled.

```
timeout 300 node Habait/tour360/tools/catalog-check.mjs [--write]          # every row and photo of catalog/items.json; --write records the hashes
timeout 300 node Habait/tour360/tools/catalog-probe.mjs --selftest         # $0: a request without an item equals the pre-wave handler; a forged photo is refused
timeout 540 node Habait/tour360/tools/build-tour.mjs demo-01 --catalog     # the page with the strip; the photos into dist/demo-01/catalog/, api/catalog.json
timeout 300 node Habait/tour360/tools/smoke.mjs demo-01 --catalog          # the plain build (no flag) must carry none of it
node Habait/tour360/tools/edit-server.mjs demo-01                          # YOUR terminal: the laptop host reads catalog/items.json at start
timeout 540 node Habait/tour360/tools/live-check.mjs --base http://127.0.0.1:8720 --key <code> --item strandmon --out qa-evidence/tour360/T14/laptop
timeout 540 node Habait/tour360/tools/catalog-probe.mjs --item kivik-3 --crop qa-evidence/tour360/T14/probe/crop-living.jpg   # PAID, no browser, no server
timeout 60 node Habait/tour360/tools/catalog-probe.mjs --report qa-evidence/tour360/T14/probe
```

A catalog turn costs about $0.09 (the text step, Nano Banana 2 with two images, the judge, the likeness) from the change
ledger's $5 cap. On the page: open the change sheet or the main screen, tap an item in the strip, the field fills with
«להחליף את הספה ב-KIVIK» (edit the words if you like — say where), send. Aim at the piece first: the sofa look or the dining look.

## The point-to-replace probe (T14c, `CATALOG-PLAN.md` §10) — which engine replaces a piece best

Three bounded steps on the laptop ledger (rows `probe: "replace"`; the probe budget in `qa-evidence/tour360/T14/replace-probe/spend.json`):

```
timeout 540 node Habait/tour360/tools/replace-probe.mjs --scan [--scenes living,kitchen] [--dry]
timeout 540 node Habait/tour360/tools/replace-probe.mjs --piece sofa|armchair|coffee_table|dining_table|chair|all [--engines erase,erase-bria,direct] [--force]
timeout 60  node Habait/tour360/tools/replace-probe.mjs --report
```

`--scan` renders four views per room and asks the vision model for every piece — the marker build in miniature (`--dry` renders only,
$0). `--piece` zooms a crop onto the largest piece of the category (chairs: the set at the dining table), outlines it (every outline
checked against its box, else the box), and runs the engines on the same crop and product photo; each result gets the border ring, the
collateral share outside the mask, the replace judge and the likeness. `--report` prints the table and refreshes `index.html` (the
product photos linked from `catalog/_local/`, never copied). Open the pictures: the verdict of 2026-10-07 was ONE zoomed editor call
(D-CAT-14) — the erasers re-render the whole frame.

## The scan before a `--catalog` build (T16a, `CATALOG-PLAN.md` §10.3) — the markers a visitor taps

```
timeout 540 node Habait/tour360/tools/scan-pieces.mjs demo-01                 # every scene whose panorama is new or changed; ≈ $0.01 a scene
timeout 60  node Habait/tour360/tools/scan-pieces.mjs demo-01 --refinish      # the dedupe, the sets and the flags recomputed from the stored pieces, $0
timeout 60  node Habait/tour360/tools/scan-pieces.mjs demo-01 --drop <id> --why "<what the sheet showed>"
timeout 60  node Habait/tour360/tools/scan-pieces.mjs demo-01 --sheet         # qa-evidence/tour360/T16/scan/index.html redrawn
```

The scan cuts four views per scene from the balanced panorama (yaw = heading + 0/90/180/270, pitch −15, hfov 90) with the page's own
maths (`tools/pano-geometry.mjs`), asks the vision model for every piece (label, category, box, outline), checks each outline against
its box (else the box), keeps a piece seen from two views once, and gathers the chairs at a dining table into one set. It writes
`apartments/<id>/markers.json` — directions on the sphere, never view pixels — with a marker on every piece of a catalog category that is
at least 12° across (a sofa seen through a doorway is no target). A scene is skipped while its panorama hashes as stored, so a rerun on
an unchanged apartment settles $0. **Open the sheet before the build ships:** every marker on its piece, the kitchen's set whole.
`build-tour --catalog` refuses to build without the file or with a scene whose panorama changed since its scan; `smoke --catalog` checks
every marker and prints `markers N in M scenes`. The plain build carries none.

**The page (T16c).** With the catalog in the build and the live change unlocked, a ring sits on every marker (hidden while the view moves);
the first visit shows the hint once. A ring tapped opens the pick bar — the piece's name and only the matching items — and a tap on an
item sends the turn: the crop is cut around the piece, the product photo rides as the second image, `op: 'replace_judge'` accepts (the
old piece gone, the product in its place), the paste-back stays inside the piece's region, and the ring moves onto the product with the
item's name; undo puts it back. The typed change is untouched. Proofs:

```
timeout 540 node Habait/tour360/tools/change-shots.mjs demo-01 --catalog --lang he --out qa-evidence/tour360/T16/page   # $0: the rings, the hint, the pick bar
timeout 540 node Habait/tour360/tools/live-check.mjs --base http://127.0.0.1:8720 --key <code> --item kivik-3 [--marker <id>] --out <dir>
```

`live-check --item` taps the item's ring (the named marker, else the largest of its category), picks the item, waits for the live
scene, and passes only when the replace judge held, the paste stayed inside the piece, the ring took the item and undo gave it back.

**T18c (2026-10-08 night, `qa-evidence/tour360/T18/SCAN.md`).** The prompt names each piece's placement — in the room, or seen through a
window, a glass door, a doorway or a pass-through — and a through-opening piece gets no ring (the terrace saw the living room's sofa,
coffee table and dining table through the glass, and a swap landed inside the glass). The ring sits on the piece's visible top, not the
box's centre (the hall table's ring sat on the island's edge). `--probe <scene>-<k>` runs the prompt on one stored view and prints
the answer without touching the file (≈ $0.005) — the way to read a prompt change before a re-scan. **The sheet goes to him before every
`--catalog` build**; the three terrace pieces are dropped with their reason until the next full scan confirms the rule.

```
timeout 120 node Habait/tour360/tools/scan-pieces.mjs demo-01 --probe terrace-0      # what the prompt answers on one view, nothing written
timeout 60  node Habait/tour360/tools/scan-pieces.mjs demo-01 --drop <pieceId> --why "<reason>"   # a piece the sheet showed wrong
```

## The hardening (T16f, `CATALOG-PLAN.md` D-CAT-20) — what bounds the paste

The gate of the point-to-replace wave (T16e) held all three claims and left two notes on the add-only rail; T16f closes them.

- **The paste region is capped.** The replace judge's `product_box` is clipped to the piece's neighbourhood — the old box grown by
  25 % of its span on each side (`REPLACE_JUDGE_RULE.grow`) — and a box that keeps under half its area inside it is not «in place»
  (`REPLACE_JUDGE_RULE.keep`). The answer carries the clipped `product_box`, the raw `product_box_raw` and `box_kept`; the page clips
  again with the same rule (`BOX_GROW` in `viewer/edit-live.js`) before it builds the paste region and moves the ring, so an older host
  cannot widen the paste.
- **The vendor gets the verified bytes.** `referenceOk` returns the canonical data URL of the bytes it hashed; the editor and the
  likeness call get that string, never the client's.
- **The page branches on its own item.** The judge path is the page's `item` and `piece`, not the host's `catalog: true` echo; an item
  turn answered without that echo fails (`changeFailed`) instead of pasting on the ring test alone.

Proof: `timeout 300 node Habait/tour360/tools/catalog-probe.mjs --selftest` (the clip cases and the mangled reference are in it), then
one laptop turn `live-check --item kivik-3` with the host started inside the command and killed by PID.

## The likeness (T16g, `CATALOG-PLAN.md` D-CAT-22) — the photo is the authority for the product's look

The catalog prompt the editor gets now says, after the request and before the keep-clause, that the second image is the product itself
and the only authority for how the new piece looks (shape, proportions, colour, upholstery, legs, details), that nothing of the old piece
remains, and that the first image sets only where the product stands, its scale, perspective and light. Measured 2026-10-07 night: likeness
3/3 on the kitchen's chairs (a page turn held) and the living sofa (one in-process call, the judge held), from 1/3 before. The selftest's
catalog golden is compared but for the prompt text; the no-item golden `1b04ba65` is untouched. Open question OQ-C14: a piece that fills the
crop's edge (the living sofa) can fail the border ring test although the product is right — the sheet is `qa-evidence/tour360/T16/likeness/index.html`.

## The test wave (T17, `TEST-PLAN.md`) — every turn recorded, the matrix driven, the eye as the gate

After his own session («the furniture doesn't show well, the images don't show well»), the laptop host records every paid turn as
files and the page posts its own account of each turn, so a complaint is a folder, not a memory. The host's flags (T17a):

```
node Habait/tour360/tools/edit-server.mjs demo-01                 # YOUR terminal: records to apartments/demo-01/_local/turns/ (gitignored)
node Habait/tour360/tools/edit-server.mjs demo-01 --lan           # also listens on the Wi-Fi and prints the phone link (the code gates it)
node Habait/tour360/tools/edit-server.mjs demo-01 --no-record     # the old behaviour
node Habait/tour360/tools/edit-server.mjs demo-01 --port 8741 --ledger <scratch file>   # a test host on another ledger (the cap test)
timeout 60 node Habait/tour360/tools/turn-sheet.mjs --turns Habait/tour360/apartments/demo-01/_local/turns   # the sheet of what you tried
```

Per turn the host writes `<seq>-edit/` (the crop, the editor's result, the request and the answer without images), `<seq>-replace_judge/`,
`<seq>-likeness/`, and `<seq>-page/` — the page's view before and after the paste, the same two at 100° (the seams), its attempts
and the message it showed. The product photo is never written. A host without the layer (the hosted function) gets no account:
the page posts it only when `GET api/edit` says `record: true`.

The matrix (T17d), one scene per bounded call against a host started inside the command, the key in a scratch file, never printed:

```
timeout 540 node Habait/tour360/tools/replace-matrix.mjs demo-01 --scene living --lang he --base http://127.0.0.1:<port> --key-file <file> --out qa-evidence/tour360/T17/matrix
timeout 900 node Habait/tour360/tools/replace-matrix.mjs demo-01 --scene terrace …                 # 8 pairs
timeout 540 node Habait/tour360/tools/replace-matrix.mjs demo-01 --pairs living-0-7:kragsta,living-270-1:kivik-3 --repeat 2 …   # the worst, again
timeout 540 node Habait/tour360/tools/replace-matrix.mjs demo-01 --pairs … --phone …                # the phone cell (390×844, touch)
timeout 540 node Habait/tour360/tools/replace-matrix.mjs demo-01 --scene all --rings-only …          # $0: every ring at rest, the bar opened, nothing sent
timeout 60  node Habait/tour360/tools/turn-sheet.mjs --matrix qa-evidence/tour360/T17/matrix/he      # the sheet for the eye and the judge
timeout 540 node Habait/tour360/tools/sharpness-probe.mjs demo-01                                    # $0: balanced vs the 7K set, three devices, the GPU limit
```

Per pair: `rings`, `pick`, `page-after`, `after-zoom` (45°), `after-wide` (100°), the original at the same fields, a second tap on the
ring, undo; the host's files copied in (`crop`, `result-<attempt>`, `judge-<n>`, `likeness`, `before/after/before-wide/after-wide`,
`account.json`) and `turn.json`. A held judge is not a right picture: open the sheet. The first recorded pair (2026-10-08, KRAGSTA on
the living coffee table, held on attempt 1) showed the old oval table top left around the new table — the paste region (the scan's
outline ∪ the judge's box clipped by T16f) was smaller than the old piece.

## The fix wave T18 — T18a the paste region, T18b the ring outside the piece (`qa-evidence/tour360/T18/REGION.md`)

The test wave's F1: the page pasted inside the scan's outline (drawn in another view and cut by its edge) and the old piece survived
around the product. Since 2026-10-08 night the host reads the tapped piece on the zoomed crop before the edit — `pieceSeen` in
`server/handler.mjs`, one vision call ($0.004, two tries, fail-soft), its answer carried into attempt 2 as `piece.seen` and recorded
in the turn's ledger row (`seen_found`, `seen_box`, `seen_usd`) — and the page takes that box when it sits over the scan's box. The
region is then the scan's outline ∪ the seen silhouette and box ∪ the judge's product box clipped to the fuller box's neighbourhood
∪ a pad under the box for the legs and the shadow; the crop's border is pasted on the sides the piece runs past (`lift`); a piece over
85° of span gets a 110° crop. The ring test (F2, OQ-C14) counts only the ring outside the piece's neighbourhood (`ring_band`
`outside` · `top` · `skipped` in the record). Twelve runs of the five leftover pairs: eleven clean, the one leftover a parse miss
fixed by the second try. The selftest's goldens hold (`1b04ba65`, `974f0c8f`).

```
timeout 300 node Habait/tour360/tools/catalog-probe.mjs --selftest      # the piece located on the crop first, a carried answer never re-read
timeout 60  node Habait/tour360/tools/turn-sheet.mjs --matrix qa-evidence/tour360/T18/region/he    # the twelve runs for the eye
```

## The page after the test (T18f · T18i · T18j · T18k · T18l · T18m, `qa-evidence/tour360/T18/PAGE.md`)

The item card never covers the piece just changed: a compact strip with a close on phones, the bottom-start corner on a wide screen,
and after a swap the view re-aims so the product's new ring sits above the bottom stack (the second tap). The page's GET carries the
code (`X-Tour-Code`) and the host says `configured` only for the right one — a wrong link never shows the unlocked page. The pill
names the step (applying → checking → placing → the swap) and the attempt, and a final message shows no spinner. The rings stay on
through the auto-rotate and are the first keyboard stop once unlocked. A catalog refusal records what refused it (the ring or the
judge's finding) and reads `catalogRefused` when his words land — `changeFailed` until then, never «a different camera angle». While a
dialog is open the badge, the concept line and the AI note stand above the backdrop (D-CAT-26); the coverage probe's state **F panel**
measures it (`coverage-probe.mjs`, six states).

## One swap, every scene (T18d, D-CAT-27, `qa-evidence/tour360/T18/IDENTITY.md`)

Two markers in two scenes can be one piece: `scan-pieces.mjs demo-01 --same living-270-1=kitchen-270-11 --why "…"` records the identity
(`identities` in `markers.json`, `piece` on both markers). After a swap lands, the page runs one follow-up turn per other scene that sees the
piece and pushes it onto that room's stack quietly — the visitor stays put, the pill names the room, a failed follow-up says so for its room,
undo takes the linked entries with it. `tools/stub-host.mjs <port>` answers the host's calls without a vendor (a dark block over the piece) —
the $0 way to prove the page's mechanics with the matrix driver when the vendor is down.

```
timeout 60  node Habait/tour360/tools/scan-pieces.mjs demo-01 --same <idA>=<idB> --why "<reason>"   # one piece seen from two scenes
node Habait/tour360/tools/stub-host.mjs 8770      # then replace-matrix.mjs … --base http://127.0.0.1:8770 — no vendor, no ledger
```

## The 7K set on desktops (T18g, D-CAT-28, `qa-evidence/tour360/T18/SHARP.md`)

`build-tour demo-01 --catalog --full` carries the full set (`_local/full`, 7096 px wide, copied by hand from the enhanced panoramas — not
tracked) to `dist/panos-full/` beside the balanced one; the page picks the full set once at load on a wide, tall, non-touch screen whose
GPU holds the width, the balanced set everywhere else; every panorama read — the scenes and the live-change compose — goes through that
one choice. The `--full` dist is about 158 MB: the laptop host serves it; the hosted project takes it only on his go. `smoke --full`
carries the matching budget and checks the set both ways.

```
timeout 540 node Habait/tour360/tools/build-tour.mjs demo-01 --catalog --full && timeout 300 node Habait/tour360/tools/smoke.mjs demo-01 --catalog --full
```

## The layout proof (T16i) — the permanent lines never lose a line

The warden's read of the catalog card (T15a, 2026-10-07) found the item card covering the concept line on small and short screens.
Since T16i (2026-10-08) the item card and the pick bar take the thumbnail strip's slot on short viewports, landscape phones drop the
strip, and the smallest phones compact the card and the action pills (`viewer/tour.css`, the three T16i blocks). The proof is a tool:

```
timeout 540 node Habait/tour360/tools/build-tour.mjs demo-01 --catalog
timeout 540 node Habait/tour360/tools/coverage-probe.mjs demo-01 --lang he [--out <json>] [--shots <dir>]   # then en, fr — one language per run
```

It serves the build on 127.0.0.1, stubs `GET api/edit` (nothing is posted), and for 17 viewports × 5 states (locked · unlocked · the pick
bar · a placed product with its card · both) counts the text lines of the הדמיה badge, the concept line, the AI note and the card's own
line that anything else covers. PASS is 0 in every cell. Measured 2026-10-08: 0 in 255 cells across he, en and fr
(`qa-evidence/tour360/T16/layout/`).

## Subfolder-row overflow notes (from CLAUDE.md)
(Moved from `CLAUDE.md` on 2026-11-04, wording unchanged; each bullet continues the row of the same name in the CLAUDE.md Subfolders table.)

- `apartments/` (continued): and **`apt846/` (2026-10-28, Rainbow Tel Aviv floor 16 for a developer pitch, 11 GPT Image 2.5 rooms at 3840×1920, the change bar live at `habait-tour-846.vercel.app`; its `cameras.json` + `prompts.src.mjs` are the recipe, `README.md` § Add an apartment)**: `apartment.json` · `scenes.json` · `prompts.json` · `edits.json` · `markers.json` · `plan/` ·
  `panos/{balanced,thumb,patches}` (tracked) · `provenance/` · `_local/` (gitignored; on disk: `originals/` · `edits/` · `generated/` (the generator's answers) · `refs/` (the plan crops + the style reference) · `full/` (the full set, for `build-tour --full`) · `turns/` (the recording host's files) · `ledger.json` · `SOURCES.md`, which points at the masters and the full set that
  stay at `D:\RealEstate3D`)
- `tools/` (continued): · `edit-server.mjs` · `live-check.mjs` (T09) · `catalog-check.mjs` · `catalog-probe.mjs` · `file-ledger.mjs` (T14) · `replace-probe.mjs` (T14c) · `scan-pieces.mjs` · `pano-geometry.mjs` (T16a) · `coverage-probe.mjs` (T16i) · `replace-matrix.mjs` · `turn-sheet.mjs` · `sharpness-probe.mjs` (T17) · `stub-host.mjs` (T18d) · the walkaround branch's
  `app-require.mjs` · `parity-shots.mjs` · `stage-walkaround.mjs` · `cut-tiles.py` (T11–T19) · **the generator lane (2026-10-15/28): `gen-pano.mjs` (fal, ledgered, `--cap`, the `gpt25x` lane) · `make-refs.mjs` · `make-scenes.mjs` · `make-sets.mjs` · `stage-tour.mjs`** · **the quality lane (2026-10-29/30, WALKAROUND-QUALITY-PLAN.md): `make-skin-prompts.mjs` (--roll auto, the
  seam park) · `openings-test.mjs` (doors/facade/railing kept + shift, the seam) · `make-polish-prompts.mjs` (the locked polish over the furnished CG, D-WQ-36) · `make-depth-map.mjs` · `cg-lock-test.mjs` (advisory) · `make-tiles.mjs`** — these replaced the planned T02–T04b tools (`generate-panos`, `seam-check.py`, `upscale.py`, `make-sets.py` were never built; no Real-ESRGAN on
  this machine, the 3840×1920 answer made it unnecessary)

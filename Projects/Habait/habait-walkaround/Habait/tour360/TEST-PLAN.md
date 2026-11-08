# TOUR360 TEST-PLAN — the A-to-Z test of the tour, the typed change and the catalog replacement

**v0.1 · 2026-10-08 (his «I have issues with that … plan full testing, A to Z»; his four answers through the question tool: what failed = leftovers/seams/patch · blurry or low-res images · controls misbehave; where = laptop browser · phone · the public links; shape = «Instrument, then full matrix»; budget = «$10, cap raised to $15») · track `Habait/tour360/` · parent plans [`PLAN.md`](PLAN.md) v0.9 and [`CATALOG-PLAN.md`](CATALOG-PLAN.md) v0.4 · board [`habait-tour360`](../../development/tasks/habait-tour360/README.md), the test wave T17a–T17f (index card [T17](../../development/tasks/habait-tour360/task-17-test.md))**

---

## 0. What this is

The system of 2026-10-04 → 2026-10-08 — the 13-panorama tour (T01), the prepared text changes (T08), the typed change behind the unlock code (T09, T12, T13) and the IKEA catalog with point-to-replace (T14, T16) — was built fast, with the minimum evals he ordered: one smoke, one paint proof, a gate per wave, and a machine judge on every paid turn. He tested it himself on 2026-10-08 and found gaps: *"The furniture doesn't show well, the images don't show well, and nothing is working as I wanted."* This plan is the testing operation he asked for: every surface, from the first paint to the last undo, measured by tools where a tool can measure and by a human eye where it cannot — his, mine, and a fresh-context judge's — with every turn recorded so a complaint is reproducible, and a ranked fix list at the end.

It is a **test plan**, not a fix plan: the fixes it finds are filed as the next wave (T18) with their own budgets and his rulings. One exception, ruled in §6: the recording layer and the LAN host option are built first ($0), because without them nothing he sees can be examined.

## 1. What he saw, and what the record says

| What he reported | What the record shows | What follows for the test |
|---|---|---|
| **Leftovers, seams, a pasted-looking patch** | The ledger (rows 247–253, 2026-10-08 10:53–10:55 UTC) holds his two turns: KIVIK on the living sofa (attempt 1 refused by the page's ring test, attempt 2 **held** by the replace judge, likeness 2) and KRAGSTA on the coffee table (**held**, likeness 3). The machine accepted both pictures; his eye did not. The judge sees the editor's result, never the pasted panorama; the paste (a difference mask at half resolution, threshold 22, cleaned and feathered, intersected with the old outline ∪ the judged product box) is tested by no one but the eye | Every turn must be recorded as four pictures — the crop, the editor's result, the view after the paste, the same view wider — and judged by eyes on those, not by the judge's verdict. The sweep looks for the four paste failures: the old piece's remnants, a seam at the region's edge, the crop's unpasted 10-px border (OQ-C13), and a patch that reads as pasted (colour, grain, sharpness mismatch) |
| **Blurry or low-res images** | The page serves the `balanced` set, 3548 × 1774 px, chosen for phone GPUs; a desktop at 1440 px wide and the fit field of view shows about 1.3 panorama px per screen px, and a zoom to 40° shows 0.4 — a 2.5× upsample (OQ-C8). The editor's crop is 1264 × 848 px over 45–90°, so the pasted region is downsampled into the panorama and then upsampled again on screen. The product thumbnails are 44–68 px tiles of white-background product photos. The 7K set (7096 px, 150 MB) exists on this laptop and is not served (PLAN §4, T03) | A sharpness probe per device: panorama px per screen px at the fit field of view and at the deepest zoom, the same region photographed at both, and the 7K set on one scene for comparison, with the GPU's texture limit read on each device (the one number that decides whether a phone can show it at all) |
| **Controls misbehave** | On the **phone** he could reach only the public links: the laptop host listens on 127.0.0.1 and the catalog build is laptop-only (D-CAT-21), so the phone showed the typed change without rings, and the landscape layout fix (T16i) is not deployed. On the **laptop**, the rings sit where the scan put them (19 markers in 5 scenes; the scan's outlines were checked against their boxes, never against the pixels by an eye), a tap is a paid turn of 15–45 s, a refused result shows one of six messages, and the pick bar shows only the category's items (one item per category today) | A `--lan` option so his phone reaches the catalog build; a rings sheet (every ring at rest on its piece, every scene); every control state driven by a script on phone, desktop and landscape; every message provoked on purpose in the three languages; a timing table |
| *(the picture is not the product)* | His turns scored likeness 2 and 3; the T16g sheet shows the sofa right in the editor's result. He did **not** pick «the product looks wrong» | The likeness stays measured and reported, not the focus |

Two facts bind the whole plan: **a held judge is not a right picture**, and **nothing was saved**. The first makes the human eye the gate of this operation (the wave rail «open the picture» becomes a step with a name on it); the second makes the recording layer the first task.

## 2. The system under test — the surfaces, A to Z

| # | Surface | Built by | Tested today by | The gap this plan closes |
|---|---|---|---|---|
| A | The tour: 13 scenes, doors, the strip, the plan sheet, prev/next, zoom, auto-rotate, reset, fullscreen, the language switch, the shared `?room=` link | T01 | `smoke.mjs` (data, assets, 2:1, disclosure ×3), `paint-proof.mjs` on the live link (6 cells, one door tap) | no eye on every scene's painted frame since 2026-10-04; landscape cells never proven (OQ-C16) |
| B | Image quality: the balanced set at the fit view and at zoom, the thumbnails, the plan image | T01, T03 (not built) | nothing | the sharpness probe (§5 C7–C9) |
| C | The disclosure: the badge, the concept line, the AI note on every scene and state | T01, T16i | `paint-proof` (c), `coverage-probe.mjs` (17 viewports × 5 states × 3 languages) | keep it green after every page change (C6) |
| D | The prepared changes: three examples, combinations, the original toggle, reset, leave-and-return, the `?change=` link | T08 | `change-shots.mjs` (phone + desktop, 11 steps) | re-run on the current page ×3 languages (C10) |
| E | The typed change: the field, the refusals (structure, real person, unsafe, unclear, the catalog, the cap, the lock), the accepted reaches (object, surface, view, living, size), the retries, the busy and error pills, undo | T09, T12, T13 | `live-check.mjs` (one refusal + one change per run), the guard runs of T12 | every message provoked ×3 languages; every reach once; the cap and the lock on a test host (C11–C16) |
| F | The host: the unlock code, the limits, the ledger (reserve, settle, the cap), the vendor's errors, the hosted wrapper | T09, T14b | `catalog-probe --selftest` (goldens, forgeries), the T16e gate's differential | the recording layer; the cap refusal on a tiny test ledger; the fal-lock message (C14–C16, C33) |
| G | The catalog: 5 items, the hashes, the photos' posture, the card (name, price with its date, the link, the AI line) | T14a, T14d, T14e | `catalog-check`, `smoke --catalog`, the warden's read T15a | the card in every language and state on the sheet (C27) |
| H | Point-to-replace: the scan's 19 markers, the rings at rest, the hint, the pick bar, the tap, the zoomed crop, the replace judge, the paste inside the piece, the ring on the product, undo, a second swap | T16a–T16g | the gate T16e (3 claims), T16f's re-check, T16g's two pieces, `live-check --item` (one pair) | **the full matrix: 19 marker × item pairs, every picture opened, a fresh judge, repeats of the worst, a phone pass** (C17–C26) |
| I | The layout on phones, landscape phones, tablets and desktops; RTL; the 16-px input floor; keyboard and focus | T01, T16i | `coverage-probe` (coverage only) | the states on the devices with an eye (C28–C30) |
| J | Performance: the first paint, a scene change, a turn's time (text step, editor, judge, likeness, the paste's JavaScript on a phone), memory on the phone | — | the ledger's `seconds` | the timing table per cell; the paste's JS time on the phone cell (C31–C32) |
| K | The two public links: `habait-tour` and `habait-tour-design` (the typed change behind the code; no catalog) | T05, T08, T09 | `paint-proof` 6 cells | the same six cells plus two landscape cells, read-only, $0; the catalog is NOT there by ruling (C34) |

Not under test: the generator lane (T02–T04b, not built); the tour inside Ziv's canvas (T06, its own board); the IKEA permission (his); the hosted function's day ledger (nothing deployed with a catalog).

## 3. The method

Five steps, in order; each step's output is a file under `qa-evidence/tour360/T17/` and a row in this plan's §10 table.

1. **Instrument ($0, T17a).** The laptop host records every paid turn as files — the request without its images, the crop, the editor's result, the judge's two views, the answer — under `apartments/demo-01/_local/turns/` (gitignored). The page, when the host says it records, posts the page's own account of the turn after the paste: the view before, the same view after, the same view wider, the attempts, the ring and judge numbers, the message shown. The host gains `--lan` (listen on the Wi-Fi so his phone reaches the catalog build), `--ledger <file>` (a test ledger for the cap test) and `--port` as today. A sheet tool turns a turns folder into a contact sheet. The page reads the GPU's texture limit into its test hook. Nothing about acceptance, pasting or spending changes.
2. **The $0 sweeps (T17b).** The smokes, the selftest, the coverage probe ×3, the prepared changes ×3, the catalog page shots ×3, the paint proof on both live links with two landscape cells added, the rings sheet (every scene at rest, every ring drawn over its piece), the sharpness probe (balanced vs 7K on one scene, three device cells), the state sweep on phone / landscape / tablet / desktop with the eye.
3. **The paid sweeps (T17c the typed change, T17d the matrix; ≤ $6 of the $10).** The typed change: every refusal provoked (text step only, $0.003 each), every reach once, the cap and the lock on a test host. The matrix: every marker × matching item on the laptop host, one scene per bounded call, the eye on every picture, the worst five repeated twice, five pairs on the phone cell.
4. **The judge and the eye (T17e).** A fresh-context judge (`habait-ux-judge`, opus) reads the sheets and the frames and rules one finding per row, severity S0–S3, refute-first; the main session opens every picture itself (the wave rail); his own look at the sheet is the third eye.
5. **The report and the fix wave (T17f).** `REPORT.md`: the findings ranked, each with its evidence file, its root cause where the code shows it, and its proposed fix with a budget; the fixes filed as T18 cards for his ruling; the records (this plan §10, the board, the memory, the ledger).

**Pass rules.** A tool check passes on its own printed `PASS` and exit 0. A picture passes only when an eye has looked at it and the judge's row says clean; a held judge, a likeness 3 or a green `live-check` proves nothing about the paste. A finding needs a named file. The operation does not fix what it finds, except T17a's instruments and anything that blocks the test itself (logged in the card).

**Evidence.** `qa-evidence/tour360/T17/` — `record/`, `sweeps/`, `typed/`, `matrix/<lang>/`, `judge/`, `REPORT.md`. New captures as lossless WebP (`qa-evidence/_tools/webp-lossless.mjs --verify`); the host's JPEG files copied as they are (the capture is the JPEG). IKEA's five photo files are never copied into the tree — the sheets link them from `catalog/_local/` (D-T360-27, D-CAT-21); a page frame that shows the 44-px thumbnail on the card stays inside the private repo as the T16 frames do.

## 4. The matrix

**The pairs (H).** Every marker of `apartments/demo-01/markers.json` with the one item of its category:

| # | Scene | Marker | Category | Span (° yaw × pitch) | Item | Note |
|---|---|---|---|---|---|---|
| 1 | living | `living-270-1` | sofa | 100 × 30 | KIVIK `kivik-3` | wider than the 90° crop (OQ-C13); the ring confound (OQ-C14) |
| 2 | living | `living-0-7` | coffee_table | 41 × 25 | KRAGSTA `kragsta` | his second turn today |
| 3 | living | `living-0-1` | dining_table | 49 × 13 | SKANSNÄS `skansnaes` | five chairs hide most of it (§10.1) |
| 4 | living | `living-set-1` | chair ×5 | 60 × 19 | ODGER `odger` | a set: one turn, five chairs |
| 5 | kitchen | `kitchen-270-11` | sofa | 25 × 15 | KIVIK | **the living sofa seen from the kitchen** — a swap in one scene does not reach the other |
| 6 | kitchen | `kitchen-270-1` | dining_table | 82 × 34 | SKANSNÄS | |
| 7 | kitchen | `kitchen-set-1` | chair ×7 | 88 × 40 | ODGER | T16g's 3/3 piece |
| 8 | hall | `hall-90-2` | dining_table | 16 × 9 | SKANSNÄS | small, seen through an opening |
| 9 | terrace | `terrace-0-4` | coffee_table | 14 × 4 | KRAGSTA | small |
| 10 | terrace | `terrace-0-5` | sofa | 16 × 12 | KIVIK | an outdoor sofa |
| 11 | terrace | `terrace-270-4` | armchair | 25 × 14 | STRANDMON `strandmon` | an indoor wing chair outdoors |
| 12 | terrace | `terrace-0-1` | coffee_table | 40 × 16 | KRAGSTA | |
| 13 | terrace | `terrace-270-3` | armchair | 21 × 21 | STRANDMON | |
| 14 | terrace | `terrace-270-1` | armchair | 32 × 32 | STRANDMON | |
| 15 | terrace | `terrace-90-1` | armchair | 30 × 30 | STRANDMON | |
| 16 | terrace | `terrace-0-10` | dining_table | 19 × 7 | SKANSNÄS | small |
| 17 | garden | `garden-0-2` | armchair | 16 × 18 | STRANDMON | |
| 18 | garden | `garden-0-1` | dining_table | 19 × 17 | SKANSNÄS | |
| 19 | garden | `garden-0-3` | armchair | 21 × 21 | STRANDMON | |

Nineteen turns ≈ $2.6 at $0.09–0.18 each (a retry doubles the editor's $0.083). STRANDMON has no indoor armchair to land on — the apartment's only armchairs are on the terrace and in the garden — which is itself a finding for the catalog (§9 OQ-T4).

**The cells.** Desktop 1440 × 900 (the full matrix, Hebrew) · phone 390 × 844 touch, device scale 2 (five pairs: 1, 2, 4, 7, 14) · the worst five of the desktop pass, twice more (repeatability) · English and French: the messages and the card, not the pictures (the editor gets English either way).

**Per turn, the record** (T17a's layer plus the driver): `request.json` (no images) · `crop.jpg` · `result-<attempt>.jpg` · `judge-<attempt>.json` · `likeness.json` · `before.jpg` / `after.jpg` (the marker's view, the fit field) · `after-zoom.jpg` (45°) · `after-wide.jpg` (100°, the seams) · `page-after.webp` (the screen with the card) · `page-original.webp` (the original toggled) · `turn.json` (the page's `lastTurn`: attempts, ring, fraction, judge, likeness, region and pasted fractions, the marker before and after, the message) · the ledger rows' sequence numbers.

**The typed-change sweep (E, T17c).** On the laptop host, Hebrew unless noted:

| Row | Words (the sense) | Expected | Cost |
|---|---|---|---|
| R1–R3 | a wall removed · a window added · the room enlarged | `changeRefusedScope` (structure) | $0.003 each |
| R4 | a named celebrity on the sofa | `changeRefusedRealPerson` | $0.003 |
| R5 | an unsafe scene | `changeRefusedUnsafe` | $0.003 |
| R6 | a nonsense string | `changeRefusedUnclear` | $0.003 |
| R7 | one letter · 301 characters | 400 `bad_request`, the pill `changeFailed` | $0 |
| R8 | a wrong code | 403 `changeLocked` | $0 |
| R9 | a test host with a $0.01 ledger | 429 `changeCapReached` | $0 |
| R10 | R1 and R4 in English, then French | the same messages in that language | $0.012 |
| A1 | blue cushions on the sofa (object, Kontext) | pasted, the ring under 15 % | ≈ $0.045 |
| A2 | the wall a warm grey (surface, Kontext) | pasted to the view's edge, no colour fit | ≈ $0.045 |
| A3 | a sunset outside the window (view, Kontext) | pasted, the ring under 35 % | ≈ $0.045 |
| A4 | four people at the dining table (living, NB2 + the judge) | pasted on a held judge, at most three attempts | ≈ $0.10–0.27 |
| A5 | the coffee table bigger (size, FLUX 3, about a minute) | pasted, `changeApplyingSlow` shown | ≈ $0.03 |

## 5. The checks

Each check names its command and its pass rule; a check without a command is an eye check and names who looks.

| # | Surface | Check | How | Pass |
|---|---|---|---|---|
| C1 | F | the selftest | `timeout 300 node Habait/tour360/tools/catalog-probe.mjs --selftest` | `selftest: PASS`, exit 0 |
| C2 | A, G | the smokes | `timeout 300 node …/smoke.mjs demo-01` on a plain build, then `--catalog` on the catalog build | exit 0 both; the plain build carries no catalog |
| C3 | K | the paint proof, both links | `timeout 540 node …/paint-proof.mjs https://habait-tour.vercel.app`, then `…-design` | 6/6 each |
| C4 | K, I | the landscape cells on both links | the sweep's own 844 × 390 and 667 × 375 frames ×3 | the three permanent lines visible; the known failure (OQ-C16) stated, not hidden |
| C5 | H | the catalog page shots | `timeout 540 node …/change-shots.mjs demo-01 --catalog --lang he` then en, fr | the rings, the hint, the pick bar on phone and desktop; the eye |
| C6 | C | the coverage probe | `timeout 540 node …/coverage-probe.mjs demo-01 --lang he` then en, fr | 0 covered lines in 255 cells |
| C7 | B | the sharpness numbers | `sharpness-probe.mjs`: panorama px per CSS px and per device px at the fit field and at 40°, for 390 × 844 @2, 1440 × 900, 1920 × 1080 | the table filed; the 7K ratio beside it |
| C8 | B | the same region at two zooms | the probe's frames of the living sofa at the fit field and at 40°, balanced vs the 7K file on one scene, a Laplacian sharpness per frame | the frames filed and opened; the judge rules |
| C9 | B | the GPU texture limit | `window.__tour.maxTexture` on each device the plan reaches (the laptop's Chrome, headless Chrome, his phone through `--lan`) | the number filed per device; a 7096-px panorama needs ≥ 8192 |
| C10 | D | the prepared changes | `timeout 540 node …/change-shots.mjs demo-01 --lang he` then en, fr | the 11 steps green per cell; the eye on the frames |
| C11 | E | the refusals R1–R6, R10 | `live-check.mjs --refuse "…"` per row (the accept of the same run is A1 once; the other rows run with `--text` reused) or the sweep driver | the right message per row, in the row's language; one ledger row each at $0.003 |
| C12 | E, F | R7 the limits | `curl` the host with a one-letter and a 301-character instruction | 400 `bad_request`, no ledger row |
| C13 | E, F | R8 the lock | the page with a wrong `?key=` | the field stays «soon», the rings hidden, no POST |
| C14 | E, F | R9 the cap | a second host on another port with `--ledger <scratch file>` holding `cap_usd: 0.01` | 429, `changeCapReached`, nothing sent to a vendor |
| C15 | E | the accepted reaches A1–A5 | `live-check.mjs --text "…"` per row, the frames opened | pasted; the message, the model and the attempts as the row expects |
| C16 | E, F | the vendor's own refusal and the lock | read from the T12/T13 evidence and the fal-lock run of 2026-10-05; not provoked | the message mapping stated in the report |
| C17 | H | the rings sheet | the matrix driver's `rings-<scene>.webp` per scene at rest, the ring boxes listed beside the scan's outlines | every ring on its piece — the eye and the judge |
| C18 | H | the hint, once | a fresh context shows it; the second visit does not; a ring tap hides it | the driver's record |
| C19 | H | the pick bar | the chip names the piece; only the category's items; close by ×, Escape and a room change | the driver's record ×3 languages |
| C20 | H | **the matrix, 19 pairs** | `timeout 540 node …/replace-matrix.mjs demo-01 --scene <s> --lang he` per scene (terrace under 900) | every turn ends in a live scene or a named message; `turn.json` and the pictures filed; **every picture opened** |
| C21 | H | the paste's leftovers | the eye and the judge on `after.jpg` vs `before.jpg` and `result.jpg`: anything of the old piece left | per pair: clean / remnant (where) |
| C22 | H | the seams | the eye and the judge on `after-wide.jpg`: the region's edge, the crop's unpasted border, the colour step | per pair: clean / seam (where) |
| C23 | H | the patch look | the eye and the judge on `after-zoom.jpg` against the untouched surroundings: grain, sharpness, colour | per pair: invisible / visible |
| C24 | H | placement, scale, perspective, light | the judge's row per pair; the likeness score beside it | per pair |
| C25 | H | the ring after the swap, undo, a second swap | the driver: the ring's new position on the product, its name, undo restores, a second tap on the same ring opens the bar with the item selected | per pair |
| C26 | H | repeatability | the worst five pairs twice more (`--pairs … --repeat 2`) | the failure repeats or not — stated |
| C27 | G | the card | name, price with its date, the link, the AI line, in he/en/fr, on the desktop and phone frames | the eye |
| C28 | I | the states on the devices | the driver's phone cell frames + the sweep's 844 × 390 and 768 × 1024 frames of the card, the bar and the pill | the eye and the judge |
| C29 | I | RTL and the input floor | the phone cell: `#t-bar-input` computes ≥ 16 px; the Hebrew page `dir=rtl`; numbers isolated LTR | measured by the driver |
| C30 | I | keyboard and focus | Tab to a ring, Enter opens the bar, Escape closes, the sheets return focus | the driver's record, desktop |
| C31 | J | the timing table | from the ledger's `seconds` and the driver's `ms` per step: the text step, the editor, the judge, the likeness, the paste's JS | the table filed; the phone cell's paste time named |
| C32 | J | the phone's memory | the phone cell's page errors and the paste's JS time; the GPU limit (C9) | no crash; the numbers filed |
| C33 | F | the recording layer | one turn on the laptop host writes the files §4 names; the hosted wrapper never sees the record op (the page sends it only when the host says `record: true`) | the files exist; the selftest's goldens untouched |
| C34 | K | the public links carry no catalog | `curl` both links' `api/catalog.json` → 404; the page data holds no `catalog` | by ruling D-CAT-21; stated |
| C35 | H | the cross-scene sofa | pair 5 after pair 1: the living sofa swapped in `living`, then the kitchen scene opened | the old sofa shows from the kitchen — a finding, not a defect of the paste (§9 OQ-T3) |

## 6. The instruments to build (T17a, $0)

| Tool | Change | Why |
|---|---|---|
| `tools/edit-server.mjs` | records every paid turn under `apartments/<id>/_local/turns/<seq>-<op>/` (the request without images, the images as JPEG files, the answer without the image); `--no-record` turns it off; `--lan` listens on `0.0.0.0` and prints the LAN link beside the local one (in HIS terminal only); `--ledger <file>` names another ledger file (test hosts); answers `op: 'record'` by writing the page's account beside the turn; GET `api/edit` carries `record: true` | the complaint becomes files |
| `viewer/edit-live.js` | after the paste (and after a refused turn), when the host answered `record: true`: cut the view before and after at the turn's view and at 100°, post them with `lastTurn` and the message as `op: 'record'`; never on a host without the flag (the hosted wrapper would answer 400 to it anyway, with no ledger row) | the page's own account |
| `viewer/tour.js` | `state.maxTexture` from a throwaway WebGL context | C9 |
| `tools/turn-sheet.mjs` | a turns folder (or a matrix folder) → `index.html` with the pictures in a row per turn and the numbers beside them; links the product photo from `catalog/_local/`, never copies it | the eye's sheet |
| `tools/replace-matrix.mjs` | the driver of §4: one scene per call, every marker × item, the frames and `turn.json` per pair, `--pairs`, `--repeat`, `--phone`, `--lang`; the key read from a file named by `--key-file`, never printed; the host started by the operator or inside the bounded command and killed by PID | C17–C26 |
| `tools/sharpness-probe.mjs` | the numbers and the frames of C7–C8 on a served copy of the build whose living panorama is the 7K file (a scratch copy, never `dist/`) | C7–C9 |

The acceptance, the paste, the prompts, the judge and the handler's goldens do not change in T17a; `catalog-probe --selftest` proves it (C1).

## 7. Budget and schedule

| Step | Calls | Spend | Time |
|---|---|---|---|
| T17a the instruments | — | $0 | 3 h |
| T17b the $0 sweeps | — | $0 | 2 h (the heavy runs one at a time, 540 s each) |
| T17c the typed change | 10 refusals · 5 changes · ≤ 3 judges | ≈ $0.6 | 1 h |
| T17d the matrix | 19 turns + the worst 5 twice + 5 on the phone cell, each with its judge and likeness | ≈ $4.5 (≤ $6 hard) | 3 h |
| T17e the judge | one opus sub-agent, fresh | $0 (tokens) | 1 h |
| T17f the report, the records | — | $0 | 1 h |
| **Total** | | **≈ $5.1 of the $10 he gave; the ledger cap $15 (D-CAT-24)** | one working day |

## 8. Rails

The board's and the catalog wave's rails hold (CATALOG-PLAN §7), plus:

- **Spend:** the operation's cap is **$10**, inside the laptop ledger's cap of **$15** (D-CAT-24); every call reserved and settled in `apartments/demo-01/_local/ledger.json`; a card's own bound is a hard stop; the cap test runs on a separate scratch ledger, never the real one.
- **The eye is the gate:** no picture is called good until the main session has opened it and the judge's row says clean; a held judge is not a pass.
- **Nothing is fixed during the test** except T17a's instruments and a blocker that stops the test itself (named in the card); every other defect goes to the report and T18.
- **The host:** an agent run starts its own host inside the bounded command on another port and kills it by PID; his own host (port 8720) is never killed; the unlock code lives in a scratch file and is never printed; a host log that carries the `?key=` link is never printed (`grep -v "key="`).
- **One heavy run at a time**, `timeout N` first, 540 a chunk (900 for the terrace scene, under the raised `BASH_MAX_TIMEOUT_MS`), foreground; a backgrounded call is a runaway.
- **IKEA's photos:** never copied into `qa-evidence/`; sheets link `catalog/_local/`; frames with the 44-px thumbnail stay in the private repo; no artifact, no public host (D-CAT-21).
- **The public links:** read-only in this plan (the paint proof); the catalog is not deployed; no deploy without his own go (law 2).
- **The originals:** nothing under `D:\RealEstate3D\` or `apartments/demo-01/panos/` is edited; the 7K experiment serves a scratch copy.

## 9. Open questions

| # | Question | Owner |
|---|---|---|
| OQ-T1 | **The eye's bar for a paste:** is a visible seam at the region's edge a defect in every case, or only when a visitor at the fit field of view sees it? The report proposes a bar (invisible at the fit field, tolerable at 2× zoom, never a remnant of the old piece) for his ruling | Slava, after the sheet |
| OQ-T2 | **The 7K set on desktops:** if the probe shows the balanced set is the blur he saw, serving the 7K set on desktops (and keeping balanced on phones) is a build change with a size cost (13 MB a scene); whether that is the fix, and whether a multi-resolution tiling is worth building instead, is his call after C7–C9 | Slava, after C7–C9 — **ruled D-CAT-28 (2026-10-08 night): the 7K set on desktops, the balanced set on phones (T18g)** |
| OQ-T3 | **A piece seen from two scenes:** the living sofa is a marker in `living` and in `kitchen`; a swap lives in one scene's live stack only. Is a per-piece identity across scenes (one swap, every scene that sees it) the product's answer, or is the demo fine with per-scene swaps? | Slava — **ruled D-CAT-27 (2026-10-08 night): one swap changes the piece in every scene that sees it (T18d)** |
| OQ-T4 | **STRANDMON has no indoor seat:** the apartment's armchair markers are all on the terrace and in the garden; the wing chair lands outdoors or not at all. Either the catalog gains a piece the rooms have (a bed, a lamp, a rug — the scan already lists them), or the room gains an armchair | Slava (the catalog's picks, D-CAT-2) |
| OQ-T5 | **The phone as a device:** the matrix's phone cell is headless Chrome in a phone's shape; the real phone (its GPU limit, its memory, its touch) is reached only through `--lan` by his hand, with the sheet reading what his turns recorded | Slava (one session on his Wi-Fi after T17a) |
| OQ-T6 | **The recording layer's data:** the turns folder holds crops of the rendered apartment and the editor's results, never the product photo file; it is gitignored and on the laptop only. Whether a hosted function should ever record (it has no disk) is not asked | main session (T0): laptop only |

## 10. Tasks — the test wave on the board

| # | Task | Owner · model | Tier | Depends on | Budget |
|---|---|---|---|---|---|
| T17a ✅ (2026-10-08, `b74e432b`) | The instruments: the recording host, `--lan`, `--ledger`, the page's record post, `maxTexture`, `turn-sheet`, `replace-matrix`, `sharpness-probe`; the selftest and the smokes green after | main session | T0 | — | $0 (one recorded turn ≈ $0.09 counts in T17d) |
| T17b ✅ (`e9100754`) | The $0 sweeps C1–C10, C17 (the rings sheet), C28–C30 (the device states), C34 | main session | T0 | T17a | $0 |
| T17c ✅ (`e9100754`, $0.435) | The typed-change sweep C11–C16 | main session | T0 | T17a | ≤ $1 |
| T17d ✅ (`d31540b3`, $3.615) | The matrix C20–C26, C31–C33, C35 | main session | T0 | T17a | ≤ $6 |
| T17e ✅ (`qa-evidence/tour360/T17/judge/REVIEW.md`) | The judge's read of every sheet and frame: one finding per row, refute-first | `habait-ux-judge` · opus, fresh | T0 | T17b–T17d | $0 |
| T17f ✅ (`qa-evidence/tour360/T17/REPORT.md`; T18a–T18m filed, his ruling pending) | The report, the fix list as T18 cards, the records | main session | **T1** (the fixes are his to rank and fund) | T17e | $0 |

| Document control | |
|---|---|
| Owner | main session, for Slava |
| Version | v0.2 (2026-10-08 night: the wave run end to end — T17a–T17e done, $4.14 spent; the report `qa-evidence/tour360/T17/REPORT.md` with sixteen findings, F1 the leftovers of the old piece on every big piece (S0 on the living room's sofa and coffee table), F2 right sofas refused by the ring, F3 three terrace markers on living-room pieces seen through the glass — the hall table is real, the judge corrected my eye; the judge's verdict «VERDICT: FAIL — 2 S0 · 4 S1 · 20 S2 · 12 S3 · 3 Q»; the fix wave T18a–T18m filed for his ruling) · v0.1 (2026-10-08: drafted from his «plan full testing, A to Z» and his four answers; the ledger cap $15 as D-CAT-24) |
| Next | his ruling on T18 (the order; the T1 cards T18d · T18e · T18g · T18l's words · T18m); T18a → T18b → T18c first; his own phone session through `--lan` |

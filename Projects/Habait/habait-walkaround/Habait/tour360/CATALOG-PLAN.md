# TOUR360 CATALOG-PLAN — replacing a piece with a catalog item (the IKEA prototype)

**v0.4 · 2026-10-07 night (D-CAT-20…22, his three answers after the T16e gate: T16f the hardening before the warden, IKEA's photos laptop-only until written permission, T16g the likeness card) · v0.3 · 2026-10-07 evening (§10 point-to-replace: his eight rulings D-CAT-12…19, the probe of both engines on his «Go now», the design to build; §10.5 filed as T16a–T16e the same evening) · v0.2 · 2026-10-07 (v0.1 a DRAFT until his three answers the same day: «Laptop host first», «Raise to $5», «File and start P0») · track `Habait/tour360/` · parent plan [`PLAN.md`](PLAN.md) v0.8 §9.6 (the typed change) · board [`habait-tour360`](../../development/tasks/habait-tour360/README.md) (the catalog wave: index cards [T14](../../development/tasks/habait-tour360/task-14-catalog.md) and [T15](../../development/tasks/habait-tour360/task-15-catalog-live.md) over nine task cards T14a–T14f and T15a–T15c, filed by `/plan-to-tasks` 2026-10-07)** — Slava's ask of 2026-10-07: *"lets say i want to replace the furniture from ikea catalog ... how can we do that?"* → the short answer (a second reference image on the rail we have; the catalog source is the hard part) → *"ok lets plan this prototype ... create full file plan for that"*.

---

## 0. What this is

Today the visitor changes the room **by words** («כריות כחולות על הספה»). This plan adds a change **by product**: the visitor picks an item from a small catalog, the editor gets the current view *and* the product photo, pastes back a likeness of the product in the place of the old piece, and the item's card (name, price, link) sits on the result. A **prototype**, built to measure one thing — how recognisable the product is in the room — on five IKEA items in `demo-01`, on the laptop host first. The test link gets it only after two rulings of his (the images' licence, the deploy go). Nothing here touches the first link or the Habait app.

## 1. Scope

| In (the prototype) | Later (named, not built) | Out |
|---|---|---|
| five IKEA Israel items with distinct silhouettes, two proven views (the sofa look, the dining look) | a real catalog source: a partnership with IKEA Israel, a retailer's licensed feed, or our own photographs | the first link `habait-tour.vercel.app` and the Habait production project |
| a picker strip beside the text box; picking an item fills the text; free text keeps working | the 3D route — IKEA's GLB model placed in the panorama with true perspective, movable and rotatable, then harmonised by the editor (the `360walkaround/` track has the placement machinery) | scraping IKEA's site or an unofficial IKEA API as a product dependency |
| the handler sends two images to the people editor (Nano Banana 2) with a catalog instruction; the acceptance rule we have, plus a likeness score that is measured, not gating | a shopping list of the apartment's changes; saving a changed look (PLAN OQ-10) | affiliate links (IKEA runs them through networks in Germany, the Netherlands and Spain — none in Israel) |
| the item card on the result with its own AI-likeness line beside the permanent badge | Kontext Max multi or FLUX.2 as a second editor if the likeness bar is not met | prices as a promise; any client-facing use of IKEA's images before OQ-C1 is ruled |
| the laptop host end to end; `live-check --item` on the test link on his go | | |

## 2. How it works

**2.1 The request.** The browser sends what it sends today (`code`, `apartment`, `scene`, `instruction`, `lang`, `crop`, `view`, `attempt`) plus `item` (the catalog id) and `reference` (the product photo as a data URL, fetched once from `catalog/<id>.jpg` in the built site). The handler validates the reference like the crop (JPEG/PNG/WebP, `LIMITS.referenceBytes` 600 KB) and **binds it to the catalog**: the SHA-256 of its bytes must equal the hash recorded for that id in the function's own catalog copy, else `reason: 'catalog'`. A visitor with the code cannot make the tour copy an arbitrary picture into the room.

**2.2 The text step.** `prepare()` gets the item (name, category, one-sentence description from `items.json`). The system prompt gains a CATALOG block: the second image is the product; the target is the piece the visitor named, or the item's category when the text is empty («להחליף את הספה ב-KIVIK»); the body is an imperative instruction — *replace the sofa in the first image with the product shown in the second image, a three-seat sofa with …; put it exactly where the sofa stands, resting on the floor, at the same scale and perspective* — and the usual rules decide the rest (`reach: object`, `living: false`, structure still refused, a named real person irrelevant). The keep-clause is appended as today.

**2.3 The editor.** `routeModel()` answers `nb2` for every catalog turn (the one editor we run that takes several `image_urls`; the vendor's page allows up to fourteen). `edit()` sends `image_urls: [crop, reference]`. Attempt 2 is nb2 again with the FRAME line; `MAX_ATTEMPTS.catalog = 2`. Kontext Max multi (`fal-ai/flux-pro/kontext/max/multi`) and FLUX.2's multi-reference edit are the named fallbacks if nb2 misses the bar — not wired in v0.1.

**2.4 Acceptance.** The browser keeps the rule of PLAN §9.5: a catalog turn is not a living change, so the border ring must stay under 15 %; then **the furniture judge always runs** (it is cheap, about $0.0025): the largest piece boxed in both views, overlap ≥ 0.5, area ×0.6–1.6 — which is exactly "the new piece stands where the old one stood". A refused result is never pasted.

**2.5 The likeness score (new, report-only).** One more vision call, `op: 'likeness'` (the text model, same price class as the judge): the reference and the result crop, *is the <category> in image 2 the product in image 1?* — 0 a different piece · 1 the same type, a different look · 2 close in shape and colour · 3 the product. It lands in `state.lastTurn`, the live meta and the evidence record. In the prototype it is measured against his eye, never a gate; the bar that ships is OQ-C4.

**2.6 The card.** On the pasted result the strip shows the chosen item: thumbnail · name · price with its read-on date · «לצפייה ב-IKEA» (the IKEA Israel product page, new tab) · one line beside the permanent badge: *an AI likeness of the product; the real product may differ*. Undo clears it.

**2.7 Cost per turn.** text $0.003 + nb2 $0.08 + judge $0.004 + likeness $0.004 ≈ **$0.09** (the first laptop turn, 2026-10-07: $0.091 settled). `LIMITS.perTurnUsd` stays 0.083 (the judge and the likeness are their own ops). **Still unverified:** whether fal bills nb2 more for two input images — our ledger settles our own assumed price, so only fal's usage page (his console) can confirm it; a line for T14c's report.

## 3. Decisions

| # | Decision | Tier · owner | State |
|---|---|---|---|
| D-CAT-1 | **Method = a second reference image on the rail we have** (crop → text step → editor → paste-back), the people editor doing the two-image edit; no new pipeline | T0 · main session | taken 2026-10-07 |
| D-CAT-2 | **The prototype catalog = five IKEA Israel items with distinct silhouettes**, three for the sofa look (a KIVIK three-seat sofa in beige/grey, a STRANDMON wing chair in dark brown leather, a KRAGSTA round white coffee table) and two for the dining look (a SKANSNÄS extendable table in brown beech, ODGER chairs in anthracite); metadata tracked in `catalog/items.json`, the photos in `catalog/_local/` — never committed. A plain grey sofa would prove nothing; the picks are mine and swap at will | T0 · main session | taken; the picks revised the same day to what IKEA Israel sells today (the LISABO coffee table, the EKEDALEN table, the yellow STRANDMON and the blue ODGER are not on its site any more); numbers, sizes and prices read one page each from the site on 2026-10-07 |
| D-CAT-3 | **Where it runs first = the laptop host.** The test link gets the catalog only after OQ-C1 (the images' licence on a public host) and a deploy go; the first link never | T1 · Slava | **ruled 2026-10-07 «Laptop host first (Recommended)»** (= D-T360-27) |
| D-CAT-4 | **The picker = a strip of thumbnails** in the change sheet and in the bar when the catalog is present; picking an item prefills «להחליף את הספה ב-<item>» (editable, so the visitor can say where); free text without an item works as today | T0 · main session | taken |
| D-CAT-5 | **Acceptance = the rule we have** (ring + the furniture judge on every catalog turn) **plus a likeness score that is measured, not gating**, in the prototype | T0 · main session | taken; the shipping bar is OQ-C4 |
| D-CAT-6 | **Spend ≈ $1.20 on the laptop and ≈ $0.30 live** (§9). The laptop ledger stands at $1.64 of $3 — the prototype fits with $0.18 of room and no retries. **Raise `cap_usd` to $5** in `apartments/demo-01/_local/ledger.json` (a hand edit, not code) or run with no retries | T1 · Slava (cost policy) | **ruled 2026-10-07 «Raise to $5 (Recommended)»** (= D-T360-28); `cap_usd` 3 → 5 done the same hour |
| D-CAT-7 | **The card = thumbnail · name · price with its read-on date · a link to the product page**; no affiliate link exists for Israel | T0 · main session | taken; whether a price shows at all is OQ-C3 |
| D-CAT-8 | **The card carries its own disclosure line** — an AI likeness of the product, the real product may differ — beside the permanent badge; the prototype's wording is a draft | T2 · Slava (the wording; root `CLAUDE.md` §6) + the warden's read before T15 | draft wording in §5 (copy keys) |
| D-CAT-9 | **The reference is bound to the catalog by hash**; the function keeps its own catalog copy (`api/catalog.json`) and trusts nothing the browser says about the item but its id | T0 · main session | taken |
| D-CAT-10 | **Out of scope:** the 3D/GLB route, scraping IKEA, an unofficial IKEA API — the unofficial model downloaders exist and are not a foundation | T0 · main session | taken; OQ-C5 keeps the 3D door |
| D-CAT-11 | **Go/no-go after P1 = at least three of five items recognisable by his eye** (and a likeness ≥ 2 as the second opinion) → P2; fewer → stop, report, and the 3D route is the next question | T1 · Slava (his verdict on the probe sheet) | pending P1 |
| D-CAT-12 | **The visitor picks the piece by tapping a MARKER built ahead:** every scene is scanned once at build time (one vision call per view), and a marker sits on each replaceable piece; the strip of items is hidden until a marker is tapped (§10.3) | T1 · Slava («Markers built ahead (Recommended)», 2026-10-07 evening) | taken |
| D-CAT-13 | **After the tap: a name chip on the piece and a strip of only the matching items; one tap on an item sends the replacement; no text box** (undo as today) | T1 · Slava («Name chip + matching strip (Recommended)») | taken |
| D-CAT-14 | **The engine is chosen from the pictures of a probe that runs both** — «erase, then place» and «one zoomed editor call» on the same pieces (§10.4). **Verdict 2026-10-07 evening: ONE zoomed editor call** — 5 of 5 PASS, the least collateral; the erasers re-render the whole frame and twice failed to clear the piece | T1 · Slava («Probe both, pick by the pictures (Recommended)»); the verdict T0 on the evidence | taken |
| D-CAT-15 | **Only pieces with a catalog match are tappable** (sofa, armchair, coffee table, dining table, dining chair today); other furniture gets no marker, so no dead end | T1 · Slava («Only pieces with a catalog match (Recommended)») | taken |
| D-CAT-16 | **A chair set is one marker and one edit:** tapping a chair replaces every chair at that table | T1 · Slava («All chairs of the set (Recommended)») | taken |
| D-CAT-17 | **Markers are subtle rings, shown when the view rests and hidden while dragging, plus a one-time hint line** («tap a piece to replace it») | T1 · Slava («Subtle rings, hidden while turning (Recommended)») | taken |
| D-CAT-18 | **The typed change stays exactly as it is;** the catalog moves out of the text sheet into the tap mode (nothing of T13 changes) | T1 · Slava («Yes, unchanged (Recommended)») | taken |
| D-CAT-19 | **The probe runs now, up to $2 inside the $5 laptop cap**, before any page work; the sheet and the pictures come back to him first | T1 · Slava («Go now, up to $2 inside today's $5 cap (Recommended)») | done — $1.49 settled (§10.4) |
| D-CAT-20 | **The hardening T16f before the warden's read** (the gate's OQ-C11/C12): the judge's `product_box` is clipped to the old box grown by 25 % of its span on each side — the paste never leaves that neighbourhood — and a box mostly outside it (under 50 % kept) is not «in place»; the vendor gets the verified bytes, never the client's string; the page branches on its own item and treats an item answer without the host's `catalog: true` as a failure; one sofa re-proof and a fresh re-check of the gate's claim 3, up to $0.35 | T1 · Slava («Build T16f now, up to $0.35 (Recommended)», 2026-10-07 night) | done — T16f 2026-10-07 night, $0.0923, the re-check PASS · **T18a (2026-10-08 night):** the neighbourhood grows from the piece as read on the crop ∪ the scan's box, a pad below, the border lifted on the sides the piece runs past; the ring outside the piece (T18b); 11 of 17 runs clean — `qa-evidence/tour360/T18/REGION.md` |
| D-CAT-21 | **IKEA's photos stay on the laptop until IKEA Israel's written permission** (OQ-14 / OQ-C1 ruled): no `--catalog` deploy before it; a permission request is drafted for him to send (`catalog/IKEA-PERMISSION-REQUEST.md`); the typed change stays live as today; T15a (the warden's read) runs on the laptop build, T15b and T15c wait for the permission | T2 · Slava («Laptop only until IKEA's written permission (Recommended)», 2026-10-07 night) | taken — the draft written, the sending his |
| D-CAT-22 | **A likeness card after the hardening (T16g, ≤ $0.40):** a prompt weight on the product photo, probed on the sofa and the chairs (today 1/3: the room's style wins over the photo), the pictures opened and judged before anything else changes | T1 · Slava («Yes, after the hardening (Recommended)», 2026-10-07 night) | done — T16g 2026-10-07 night, $0.3517, likeness 3/3 on both pieces |
| D-CAT-23 | **The laptop change ledger's cap is $7** (from $5, D-T360-28) for his own test session of the catalog page on 2026-10-08: about twenty turns at today's prices; the cap stays the hard stop the host enforces; the hosted function's $5-a-day cap is untouched | T1 · Slava («Raise to $7 (Recommended)», 2026-10-08, after «can we test») | taken — `cap_usd` 7 in `apartments/demo-01/_local/ledger.json` (local, never committed) |
| D-CAT-24 | **The laptop change ledger's cap is $15 and the test wave T17 may spend $10 of it** ([`TEST-PLAN.md`](TEST-PLAN.md) v0.1): the A-to-Z test he asked for after his own session — the recording layer first, then the $0 sweeps, the typed-change sweep, the full replace matrix (19 marker × item pairs, the worst five twice, five on the phone cell), a fresh judge, the report; the hosted cap untouched | T1 · Slava («$10, cap raised to $15 (Recommended)» and «Instrument, then full matrix (Recommended)», 2026-10-08 evening) | taken — `cap_usd` 15 in the local ledger; the wave filed as T17a–T17f |
| D-CAT-25 | **The fix wave's order: T18a → T18b → T18c first (≈ $2.20), then the $0 page cards** — the paste region, the ring test outside the piece, the scan's filters; T18e (the likeness bar) and T18h (the reaches) wait for a later round; T18l's mapping is built, its words wait for his Hebrew line (the judge's Q-1) | T1 · Slava («T18a → T18b → T18c first, about $2.20 (Recommended)», 2026-10-08 night, after the judge's FAIL) | taken — built in that order |
| D-CAT-26 | **The disclosure stays legible above the backdrop while any dialog is open** (the judge's Q-3, F16: the badge, the concept line and the AI note blurred under the prepared-changes panel) — option (b), the rail's reading: no clean view ever hides them; T18m builds it, $0; the coverage probe gains a panel-open state | T1 · Slava («Keep the badge and the AI note legible above the blur (Recommended)», 2026-10-08 night) — a disclosure ruling, his | taken — T18m |
| D-CAT-27 | **One swap changes the piece in every scene that sees it** (OQ-T3, F4): a piece id across scenes in `markers.json`; a swap re-runs in each scene that sees the piece, one paid turn per scene (≈ $0.09 each; the living sofa three turns instead of one) | T1 · Slava («One swap changes the piece in every scene that sees it (Recommended)», 2026-10-08 night) | taken — T18d built 2026-10-09 (`--same`, the quiet follow-up per linked scene, the linked undo), proven on a stub host; the paid proof waits for OpenRouter credits (402 on 2026-10-09) |
| D-CAT-28 | **The 7K set on desktops, the balanced set on phones** (OQ-T2, F7, C7–C9): the build carries both sets, the viewer picks by device; crisper at the fit field on every desktop cell measured, both soft at deep zoom (the source is an AI upscale); phones keep the lighter set until his phone's texture limit is known (C9) | T1 · Slava («The 7K set on desktops, the balanced set on phones (Recommended)», 2026-10-08 night) | taken — T18g built 2026-10-09: `build-tour --full`, the page's choice at load, the smoke's budget; the 1440 desktop reads 9.4 at the fit field against 5.5 on the balanced set; the hosted deploy of the 158 MB build on his go |

## 4. The catalog contract

`catalog/items.json` (tracked):

```
{ "$schema": "tour360/catalog.v1",
  "source": { "retailer": "IKEA Israel", "site": "https://www.ikea.co.il", "read_on": "2026-10-07",
              "licence": "reference-only for an internal prototype; not for any public host until OQ-C1 (CATALOG-PLAN.md) is ruled" },
  "items": [ { "id": "kivik-3", "brand": "IKEA", "name": "KIVIK", "article": "<from the product page>", "category": "sofa",
               "colour": "<as sold>", "size_cm": { "w": 0, "d": 0, "h": 0 }, "price": { "ils": 0, "read_on": "2026-10-07" },
               "url": "<the product page>", "image": "kivik-3.jpg", "image_sha256": "<catalog-check writes it>",
               "view": "living", "description_en": "a three-seat sofa with deep seats, wide armrests and a light grey fabric cover" } ] }
```

`catalog/_local/<id>.jpg` (ignored): the product alone on white, ≤ 1024 px on the long side, ≤ 400 KB. `catalog-check.mjs` verifies every field, every image, writes the hashes, and exits 1 on a miss. `category` drives the default target («sofa» → *the sofa*); `view` names the look `live-check` and the probe use (`living` = `-18,-100,95`, `dining` = `-13,0,80`).

## 5. Files — the full plan

| # | Path | Action | What | Task |
|---|---|---|---|---|
| 1 | `Habait/tour360/CATALOG-PLAN.md` | create | this plan | filed 2026-10-07 |
| 2 | `Habait/tour360/catalog/items.json` | create | the five items (§4) | T14a |
| 3 | `Habait/tour360/catalog/_local/<id>.jpg` ×5 | create (ignored) | the product photos, reference-only | T14a |
| 4 | `Habait/tour360/catalog/README.md` | create | the contract, the licence line, how to add an item, what never commits | T14a |
| 5 | `Habait/tour360/.gitignore` | edit | `catalog/_local/` | T14a |
| 6 | `Habait/tour360/tools/catalog-check.mjs` | create | validates `items.json` against the images (fields, pixels, bytes), writes `image_sha256`, prints the table; exit 1 on a miss | T14a |
| 7 | `Habait/tour360/server/handler.mjs` | edit | `LIMITS.referenceBytes`; `MAX_ATTEMPTS.catalog = 2`; `handleEdit` reads `item` + `reference`, hash-binds the reference (`reason: 'catalog'`); `prepare(env, instruction, lang, fetchImpl, item)` with the CATALOG block; `assemble()` adds the product sentence; `routeModel()` → `nb2` for a catalog turn; `edit()` sends `image_urls: [crop, reference]`; `handleLikeness` (`op: 'likeness'`, reserve $0.004); the ledger row gains `item`; `describe()` gains `catalog: { items }`; `perTurnUsd` recomputed | T14b |
| 8 | `Habait/tour360/server/vercel-edit.mjs` | edit | loads `./catalog.json` when present and passes it to the handler | T14b |
| 9 | `Habait/tour360/tools/edit-server.mjs` | edit | builds its catalog from `catalog/items.json` (the laptop needs no build step for it) and prints the count at start; imports the ledger from `tools/file-ledger.mjs`; the 4.4 MB body bound already covers crop + reference | T14b |
| 10 | `Habait/tour360/tools/catalog-probe.mjs` | create | three modes: `--selftest` ($0, a stubbed `fetch`: requests without an item must equal the pre-wave handler at `1b04ba65` — editor, prompt, payload; a forged photo refused with `catalog`; the catalog payload carries two images) · `--item <id> --crop <jpg>` (PAID: the handler in-process with the file ledger and a run-made unlock code — no server, no secret; one catalog turn, then the judge and the likeness; crop, result and record per item under `qa-evidence/tour360/T14/probe/`, and a contact sheet that links the product photo from `catalog/_local/` and never copies it) · `--report <dir>`. The two crops come from `tools/edit-pano.py preview` over the balanced panorama, with the page's crop rule | T14b (run in T14c) |
| 10b | `Habait/tour360/tools/file-ledger.mjs` | create | the laptop's file ledger, moved out of `edit-server.mjs` unchanged, so the server and the probe share one implementation | T14b |
| 11 | `Habait/tour360/viewer/template.html` | edit | `#t-catalog` (the strip, in the sheet and the bar) · `#t-item-card` (the result card) | T14e |
| 12 | `Habait/tour360/viewer/tour.css` | edit | the strip (horizontal scroll, 64 px thumbs, logical properties, the 16 px floor) and the card; nothing on the first link's build changes | T14e |
| 13 | `Habait/tour360/viewer/edit-live.js` | edit | renders the strip from `tourData.catalog`; `state.item`; the prefilled text; fetches and caches the reference; the request body gains `item` + `reference`; a catalog turn runs ring → judge → likeness; `pushLive` meta gains `item` + `likeness`; the card shows on paste and clears on undo; `state.lastTurn.item`; `changeRefusedCatalog` mapping | T14e |
| 14 | `Habait/tour360/viewer/tour.js` | edit | `window.__tour.catalog` for the checks; `liveMeta` already keeps whatever meta `pushLive` is given | T14e |
| 15 | `Habait/tour360/copy/tour360-copy.json` | edit | `ui.catalogTitle` «או בחרו פריט מהקטלוג» · `catalogReplaceWith` «להחליף את {target} ב-{item}» · `catalogSee` «לצפייה ב-IKEA» · `catalogPriceAsOf` «מחיר נכון ל-{date}» · `catalogNote` «הדמיה של המוצר בבינה מלאכותית. המוצר האמיתי עשוי להיראות אחרת.» · `changeRefusedCatalog` «הפריט אינו מהקטלוג» — he/en/fr, the smoke checks all three | T14e |
| 16 | `Habait/tour360/tools/build-tour.mjs` | edit | `--catalog` (explicit, default off): runs the catalog check, copies `catalog/_local/<id>.jpg` → `dist/<id>/catalog/`, inlines the items (no bytes) into the tour data, writes `dist/<id>/api/catalog.json` (ids, names, categories, descriptions, hashes) beside `_handler.mjs`; fails on a missing photo. Without the flag the build carries no catalog data, photos or `api/catalog.json` | T14d |
| 17 | `Habait/tour360/tools/smoke.mjs` | edit | with `--catalog`: five photos hashed equal to `items.json`, a valid `api/catalog.json`, five inlined rows (T14d); the six copy keys ×3 and the two markup ids (T14e); without the flag: no catalog anywhere in `dist/<id>/` | T14d · T14e |
| 18 | `Habait/tour360/tools/live-check.mjs` | edit | `--item <id>`: picks the item in the strip, submits, waits for the live scene, records `item` + `likeness` from `__tour.liveMeta`, saves the picture; PASS = pasted + held + the card shown; `--look` defaults from the item's `view` | T14e |
| 18b | `Habait/tour360/tools/change-shots.mjs` | edit | `--catalog`: the strip open and the item card, phone 390 and desktop 1440, he and en, no submit ($0) | T14e |
| 19 | `qa-evidence/tour360/T14/{probe,laptop,gate}/`, `T15/live/` | create | pictures as the vendor returned them and frames as lossless WebP (`qa-evidence/_tools/webp-lossless.mjs`), records, the likeness table, the two reviews; never an IKEA photo file (D-T360-27) | T14b · T14c · T14e · T14f · T15c |
| 20 | `development/tasks/habait-tour360/task-14*.md` · `task-15*.md` · the board `README.md` | create / edit | the wave's nine task cards (T14a–T14f, T15a–T15c) and two index cards (T14, T15) in the T13 shape — brief, files, acceptance, gate `Check:` + `Reviewer scope:`, the rails verbatim, result | filed by `/plan-to-tasks` 2026-10-07 |
| 21 | `Habait/tour360/PLAN.md` | edit | §3 D-T360-27/28 · §6 one row for the wave · §8 OQ-14 (the licence) · §9.6 pointer to this plan · document control v0.8 | landed 2026-10-07 |
| 22 | `Habait/tour360/README.md` | edit | run guide: the `--catalog` build, `catalog-check`, `catalog-probe`, `live-check --item` | T14e |
| 23 | `Habait/tour360/CLAUDE.md` | edit | one line for the catalog — by the cartographer at the next `/sync-context`, never by hand here | sync |
| 24 | `docs/governance/OWED.md` | edit | OQ-C1 (the licence ruling), OQ-C6 (the card wording to the lawyer) as rows, owner Slava | at filing |
| 25 | `memory/runs/2026-10-07-tour360-catalog-plan.md` + `INDEX.md` line · `memory/project/2026-10-04-tour360-change-rulings.md` (D-T360-27… when he rules) · the T14/T15 run entries | create / append | the memory (root `CLAUDE.md` §0) | now · at ruling · per task |

## 6. Tasks — filed on the existing board as the catalog wave

`/plan-to-tasks`, 2026-10-07 afternoon: nine one-agent cards and two index cards ([T14](../../development/tasks/habait-tour360/task-14-catalog.md), [T15](../../development/tasks/habait-tour360/task-15-catalog-live.md)) on `habait-tour360`, which was already in flight. No new board was filed, so the work-in-progress ceiling was not touched (15 boards in flight when counted: EXECUTING 6 · IN-PROGRESS 8 · LIVE 1).

| # | Task | Owner (`status` · model) | Tier | Depends on | Cost · bound |
|---|---|---|---|---|---|
| T14a ✅ | the catalog items (files 2–6) | main session | T0 | his D-CAT-3 | $0 |
| T14b ✅ | the handler's catalog turn, `catalog-probe`, `file-ledger`, the two view crops (7–10b) — done 2026-10-07, selftest PASS | main session | T0 | T14a | $0 |
| T14c ✅ | the probe — re-scoped 2026-10-07 evening to point-to-replace (§10.4): 13 rooms scanned, five pieces by two engines, the verdict one zoomed editor call (D-CAT-14), D-CAT-11 answered 5/5 | main session (on his «Go now») | **T1** — his go given | T14b | $1.49 of $2 |
| T14d ✅ | the build carries the catalog (16–17) — done 2026-10-07, before T14c on his «Build it now, I test on the laptop» | main session | T0 | T14b | $0 |
| T14e ✅ | the page: the strip, the card, the copy; `live-check --item`, the run guide (11–15, 17–18, 22; `change-shots --catalog` not built, the frames came from `live-check`) — done 2026-10-07: one laptop turn PASS, likeness 3/3, the picture opened | main session | T0, inside D-T360-28 | T14d | $0.091 |
| T14f ↪ | the wave's gate — folded into T16e on 2026-10-07 evening (§10.5), not run | `habait-deploy-qa` (live · sonnet) | T0 | — | $0 |
| T15a ✅ | the warden's read (BLOCK, 2026-10-07 night; the verdict verbatim in the card): the card's line ×3, the photos' posture under D-CAT-21, the card's claims | `compliance-warden` (live · sonnet) | **T2** | T16f ✅ · OQ-14 ruled (D-CAT-21) | $0 |
| T15b | the deploy of the `--catalog` build to `habait-tour-design`, its own tag | main session | **T1** — his go | T15a | $0 |
| T15c | the live proof: a canary, two catalog turns, the card ×3, the first link unchanged | `habait-deploy-qa` (live · sonnet) | T0 | T15b | ≤ $0.40 |

**Agents.** All `live`; none minted, none dormant. The build stays with the main session: no live agent's boundary covers `Habait/tour360/**` (the board's logged choice of 2026-10-04). `capability-scout` runs the paid probe because live probes into evidence are its charter; `habait-deploy-qa` takes the two refute checks; `compliance-warden` reads disclosure and licence before anything is public.

**The wave's gate (T14f, folded into T16e on 2026-10-07 evening — §10.5).** **Check:** `timeout 300 node Habait/tour360/tools/catalog-probe.mjs --selftest` → `selftest: PASS`, then the plain and the `--catalog` build-and-smoke pairs → exit 0. **Reviewer scope:** (1) a request without `item` takes exactly the pre-wave path (the handler at `1b04ba65`); (2) a catalog photo with one byte changed is refused with `catalog`. Nothing else. *v0.1 asked for the plain build to stay byte-identical. That cannot hold: the catalog code shares `server/handler.mjs` and `viewer/edit-live.js` with the typed change, so the plain build's bytes change while its behaviour must not. The first link is never rebuilt by this wave either way.*

## 7. Rails

- Everything in PLAN §7 holds (legal badge, machine rules, secrets by name, reserve-and-settle, one go per deploy, `_local/` and `dist/` ignored).
- **IKEA's photos stay reference-only (D-T360-27):** the files live in `catalog/_local/` on this laptop, never committed and never copied into `qa-evidence/` (the probe's sheet links them by path); frames that show them on screen stay inside the private repo, with no artifact and no public host, until OQ-C1 is ruled; the first link never carries a catalog and is never rebuilt by this wave.
- **The reference is bound by hash** (D-CAT-9); the strip is behind the same unlock code as the typed change.
- **Every paid call is one bounded foreground command**; the server a run needs starts inside it and dies by PID; one heavy run at a time on this machine.
- **Open the picture.** A probe or a live run is not done until someone has looked at the result (the T12 lesson: two proofs exited 0 on a wrong picture).
- **No scraping:** the five items' facts are read by hand from the product pages and dated; a changed price is a stale row, not a bug.

## 8. Open questions

| # | Question | Owner |
|---|---|---|
| OQ-C1 | IKEA's product photos on any public host, the test link included: IKEA's terms require permission for third-party use. A partnership with IKEA Israel, a licence, or our own photographs — which, and when? Until ruled, the laptop only. **Ruled 2026-10-07 night, D-CAT-21: laptop only until IKEA Israel's written permission; the request drafted (`catalog/IKEA-PERMISSION-REQUEST.md`); the source for the product beyond that stays OQ-C2** | Slava (legal, never a sub-decision) — ruled |
| OQ-C2 | The catalog source for the product: IKEA Israel, another retailer with a licensed feed, or Habait's own catalog of photographed or rendered pieces? The method is the same for any of them | Slava |
| OQ-C3 | Does the card show a price at all (it changes; the read-on date keeps it honest), or only name and link? | Slava |
| OQ-C4 | The likeness bar that ships: a score of 2 (close in shape and colour) or 3 (the product)? Measured first (D-CAT-11) | Slava after P1 |
| OQ-C5 | The 3D route (IKEA's GLB models placed in the panorama, movable) — only if the likeness disappoints, or as the product's real answer anyway? | Slava |
| OQ-C6 | The card's disclosure wording («הדמיה של המוצר בבינה מלאכותית…») — the lawyer's pass, like the badge wording (PLAN OQ-2) | Slava |
| OQ-C7 | **Precise outlines:** the vision model's polygon was right in every scan view and wrong once on a zoomed crop (the box right, the outline over the painting); the build keeps the box check (§10.4) — is SAM 2 on fal (box prompt → silhouette; its page says «$0 per compute second») the product's outline source? Probed when T16a is built | main session (T0) |
| OQ-C8 | **Zoom and softness:** the balanced panoramas are 3548 px wide, so a crop zoomed to 45° upsamples 2.5×; the editor returns crisp pixels that the paste-back downsamples again — fine on the laptop; a 7K set (PLAN §4) would remove the question | Slava (with T03) |
| OQ-C9 | **A set the scan sees but the zoomed crop does not:** the kitchen's six chairs were six in the scan view and four in the zoomed re-detection; the build carries the SET from the scan (its outlines projected into the crop) rather than re-detecting | main session (T0) |
| OQ-C10 | **After a replacement** the marker stays where the piece was, now named after the item (the product's box from the judge); tapping it again swaps for another item. The old outline is gone — the paste region of the next turn is the product's box | main session (T0) |
| OQ-C11 | **The paste region is as tight as the judge's `product_box`** (the gate's note N1, 2026-10-07): the region is the old outlines ∪ the judge's box, and the server bounds that box only by its centre (inside the old box ±15 %; the size rule was dropped on purpose, D-CAT-16) — in a stubbed run a whole-frame box was held and a change 327 px from the sofa was pasted. The add-only rail (root `CLAUDE.md` §6) leans on this confinement. Proposed: intersect the product box with the old box widened by a fixed margin (or cap its area ratio), and forward the verified bytes to the vendor rather than the client's base64 string (N3). A small card (T16f) before T15a. **Ruled 2026-10-07 night, D-CAT-20: built as T16f (≤ $0.35 with the re-check)** | Slava (T1) — ruled; the main session builds |
| OQ-C12 | **The page's judge gate keys on the host's echo** (`catalog: true`), not on its own `item` (N2): a catalog page behind an older function would paste on the ring test alone (still inside the old outlines). Today's handler always echoes and no `--catalog` page is deployed. Proposed: branch on the page's own `item`/`piece`, and treat an item answer without the echo as a refusal — in the same card as OQ-C11. **Ruled with D-CAT-20: in T16f** | main session (T0, with OQ-C11) — ruled |
| OQ-C15 | **The item card and the pick bar cover the permanent concept line on small and short viewports** (T15a F2, S1 — the BLOCK's second ground): the card alone at 375×667, 360×640, 320×568, 360×740 and 1024×600; the card with the pick bar also at 360×800 and 1280×720 and, in French, at 390×844 and 393×852; the pick bar alone at 320×568, 360×640 (en/fr) and 1024×600; clear at 412×915 and up, 768×1024, 1366×768, 1440×900. The pages without the card are clear from 360×640 up, so the card (T14e/T16c) is the cause. The concept line is the only text saying the furnishings are imagined while the card shows a branded product with a price. **Fix owed before T15b (T16i, main session, T0): the card and the pick bar never cover the badge, the concept line or the AI note at any viewport; proof = the warden's matrix at 0 covered lines ×3 languages in the card, card+pick and pick-only states on a rebuilt dist; `habait-deploy-qa` re-proves at T15c**. **Closed 2026-10-08 (T16i): `tools/coverage-probe.mjs` reads 0 covered lines in 255 cells (17 viewports × 5 states × 3 languages) on the laptop build** | main session (T0) — done; `habait-deploy-qa` the re-proof at T15c |
| OQ-C16 | **The live links' concept line is overdrawn at landscape phone sizes** (T15a F3, S2; not the catalog wave's doing): `habait-tour` 844×390 covers 1 of 2 lines and 667×375 covers 2 of 2; `habait-tour-design` 2 of 2 at both; all three languages; portrait 390×844 clear; T05b's paint proof covered portrait and desktop only. The fix rides the same layout change as OQ-C15; it reaches the public pages only with a deploy on his own go (law 2); `habait-deploy-qa` extends the paint proof to 844×390 and 667×375 ×3. **The fix is in `viewer/tour.css` since T16i (2026-10-08); it reaches the live links only with a deploy on his go** | main session (the fix — done); Slava (the deploy go, informed: public pages); `habait-deploy-qa` (the proof) |
| OQ-C17 | **«Laptop only» is a hosting posture, not a data-flow one** (T15a F7, S2): every catalog turn sends IKEA's photo to fal.ai (nano-banana-2) as the second image and the likeness call sends it to OpenRouter's vision model — before any permission (the method of D-CAT-1; D-CAT-21 and the letter read as if the photo never left the laptop). His knowing ruling, not a Navigator sub-decision: continue on the laptop as is, or pause catalog turns until the permission; the vendors' retention and training terms to be read (OWED-047 names the missing output-rights row) | Slava (+ the lawyer) |
| OQ-C18 | **The permission letter's gaps** (T15a F9, S2): name the vendors and the data flow (retention, training); ask for the display of the AI depiction itself, not only the photos, names and prices; correct «every rendered room carries the real-product line» (only the card says it); ask for the trademarks (IKEA, the product names) and name the attribution; a takedown path that respects law 2 and a named price-refresh owner; territory, duration, hosting sub-processors, internal use to date; whether IKEA Israel's marketing team can grant photo, trademark and design rights; a Hebrew version. **v2 of `catalog/IKEA-PERMISSION-REQUEST.md` is the main session's; the rights chain is his and the lawyer's**. **v2 written 2026-10-08 (T16i)**: the vendors and the data flow named, the AI depiction asked for, the lines described as shown, the trademarks and the attribution, the takedown and the refresh with an owner and a cadence to fill, territory, duration, hosting, the use to date, the rights-chain question | main session (the redraft — done); Slava + the lawyer (the rights chain, the sending) |
| OQ-C19 | **Three holes in the laptop posture** (T15a F8, S3): (a) an outside demo of the `--catalog` build, a screen share included, shows the photos and the likenesses to third parties — D-CAT-21 is silent; (b) the unlock code is a UI gate only: a `--catalog` deploy publishes the five photos and rows as static files to anyone; (c) `dist/demo-01` must be rebuilt from HEAD after every handler change (the T15a read found an intermediate T16g prompt order in `dist/demo-01/api/_handler.mjs`), and his own laptop host (pid 39340, since 16:11) predates T16b, T16f and T16g — a restart is his. T16g has had no fresh-context review | Slava (a, b: a rule for demos; the deploy posture); main session (c: the rebuild; the T16g review or his waiver) |
| OQ-C20 | **The card's claims, three small ones** (T15a F10, S3): the pick-bar button's tooltip shows the price without its date (`edit-live.js`, **fixed 2026-10-08, T16i**); «See it at IKEA» implies the product is sold, and four of the first picks were off IKEA's site on the read date — the link's words are his; a later typed change hides the card and its line while the product stays in the picture (the permanent three remain) — whether the card's line must persist for a placed product is the lawyer's (OQ-C6); the price-refresh cadence is OQ-C3 | Slava (the words, OQ-C3, OQ-C6); main session (the tooltip) |
| OQ-C14 | **The border ring test is confounded when the piece touches the crop's edge** (T16g, 2026-10-07 night): the living sofa fills the left and bottom borders of its crop, so a faithful product in a different colour changes those borders legitimately (left 0.95, bottom 0.25, top 0.13) and the page refuses a result the judge and the eye accept (`changeReframed`). Proposed: for a catalog turn by marker, measure the ring only outside the piece's neighbourhood (`pieceNeighbourhood`, the same 25 %), else fall back to the top band; one sofa re-proof (≤ $0.20). A small card (T16h) on his word; until then a frame-filling piece may fail on the page although the product is right | Slava (T1: it changes the acceptance of PLAN §9.5 for catalog turns); the main session builds |
| OQ-C13 | **A piece wider than the crop** (N4): the living sofa spans 100° of yaw against the crop's 90° ceiling, so two outline vertices fall left of the crop and the crop's 10-px border is never pasted; whether a seam shows when the visitor pans left of the changed view is unverified. Options: a wider ceiling for one piece (softness, OQ-C8), two crops, or the marker's span capped at the scan | main session (T0), checked with T03's 7K set |

## 9. Schedule and spend

| Step | Time | Calls | Spend |
|---|---|---|---|
| T14a the catalog ✅ | 1 h | — | $0 |
| T14b ✅ + T14c the handler, the probe tool, the probe | 2 h | ≤ 10 nb2 (five items, one retry each) + 10 judge + 10 likeness + 10 text | ≈ $0.91 |
| T14d ✅ + T14e ✅ the build, the page, the laptop run | 3 h | 3 turns end to end | ≈ $0.27 |
| T14f the gate, records | 1 h | — | $0 |
| T15a–T15c the test link (on his rulings) | 1 h | 2 live runs + 1 canary | ≈ $0.27 |
| T14c re-scoped: the point-to-replace probe (§10.4, 2026-10-07 evening, done) | 3 h | 58 scans · 7 erasures · 12 editor calls · 24 checks | **$1.49** (settled; his «Go now, up to $2») |
| T16a–T16e point-to-replace: the scan, the handler, the copy, the page, the gate (§10.5; built and gated 2026-10-07 night) | 1 day (done in one night) | 52 scans · 4 turns · the checks | **$0.518 settled** of ≤ $0.87 (a sofa turn that needs its retry ≈ $0.18 — the next sofa card carries $0.20) |
| T16f the hardening (D-CAT-20) · T16g the likeness (D-CAT-22) | half a day | one sofa re-proof + the re-check · two turns by marker | ≤ $0.35 · ≤ $0.40 |
| **Total** | **two working days + 4 h** | | **≈ $3.81** ($3.54 on the laptop ledger, $0.27 hosted), **+ ≤ $0.75** for T16f/T16g — the ledger had $0.92 left at D-CAT-20 |

## 10. Point-to-replace — the second round (2026-10-07 evening)

### 10.1 What he saw, and why

His words after testing: *"we are having hard time to replace the stuff like tables etc … now I have all the furniture on the
screen, maybe we have to keep it hidden, and when I point at some furniture asset maybe I need only see what I need to replace."*
The laptop ledger explains the first half. His two «replace the sofa with KIVIK» runs never produced an accepted picture:

| Run · attempt | What happened | The cause |
|---|---|---|
| 1 · 1 | the editor replaced the sofa; **our judge rejected it on size** — the new box 55 % of the old, under the 0.6 floor | KIVIK is a three-seater; the room's sofa is a corner sectional. The ×0.6–1.6 rule (PLAN §9.5) was written for the people feature, where the sofa must stay as it is. In a replacement the product decides the size — the rule itself was the bug |
| 1 · 2 | the judge found no sofa in the result | the editor removed it or redrew the scene |
| 2 · 1 and 2 | both rejected by the border ring | the editor reframed the whole picture |
| the dining table | not tried in the ledger; by the picture: six chairs hide most of it, and SKANSNÄS looks like the table already there (light wood, rectangular) | even a perfect replacement would be nearly invisible; the ODGER chairs would show, but that is six objects in one edit |

The common cause: the editor got the whole view and a sentence naming the piece — nothing told it which pixels to change — and
the acceptance rule then asked for the wrong thing.

### 10.2 What the research said (2026-10-07, web pass)

- **The field:** IKEA Kreativ is exactly his idea — scan the room, erase the existing furniture, place products, swap alternatives
  (in 3D from a phone scan). The virtual-staging tools (Collov, REimagineHome, Virtual Staging AI) all run «remove the furniture,
  then stage» as the base flow. Nobody replaces by text alone.
- **Our stack:** Pannellum (the viewer) maps a tap to a direction (`mouseEventToCoords`) and draws hotspots on the sphere — both in
  the vendored 2.5.6. The judge's own vision model returns boxes **and** outlines for every piece in a view in one call (Gemini's
  `box_2d` [ymin, xmin, ymax, xmax] on a 0–1000 scale, the outline as a polygon; the docs name gemini-3.8-flash). SAM 2 on fal
  returns a mask from a point or a box. fal has mask erasers that remove a piece with its shadow: Finegrain (express $0.04, standard
  $0.13, premium $0.22), Bria ($0.04, «trained exclusively on licensed data»), object-removal ($0.006–$0.024).
- **Nano Banana 2 takes no mask** — its fal API page has no such field, and Google's own prompting guide says targeting is by words
  («semantic masking»). Precision has to come from the crop and from what we check, not from the editor.

Sources: Gemini image understanding (ai.google.dev) · fal pages for `sam2/image`, `finegrain-eraser/mask`, `bria/eraser`,
`object-removal/mask`, `nano-banana-2/edit` · Google Cloud «Ultimate prompting guide for Nano Banana» · IKEA newsroom (Kreativ) ·
HousingWire «Virtual staging apps 2026».

### 10.3 The design he ruled (D-CAT-12…19)

> **Amended 2026-10-08 night by the fix wave (D-CAT-25, the test report's F1–F3):** item 1 — a piece the scan places *through an opening* (a window, a glass door, a doorway, a pass-through) gets no marker, and the ring sits on the piece's visible top, not the box's centre (T18c, `qa-evidence/tour360/T18/SCAN.md`); item 3 — the crop's ceiling is 110° for a piece over 85° of span, the host reads the tapped piece on the crop before the edit, and the paste region grows to it with a pad below and the border on the sides the piece runs past (T18a, `qa-evidence/tour360/T18/REGION.md`); item 4 — the border ring is measured outside the piece's neighbourhood, the top band when the piece fills it (T18b).


1. **Build time — the scan.** `build-tour --catalog` renders four views per scene (yaw = heading + 0/90/180/270, pitch −15,
   hfov 90, 1264×848) and asks the vision model for every piece (label, category, box, outline). Pieces of a catalog category
   become markers: direction on the sphere, angular size, the outline, the category (a chair set = the chairs at one table, one
   marker). A contact sheet with the boxes drawn is opened before the build ships; the scan of `demo-01` is 52 calls, $0.13,
   about 2.5 min. Everything else found (beds, lamps, shelves) is kept in the file for later catalogs, with no marker.
2. **The page.** The strip is hidden. A subtle ring sits on each marker, shown when the view rests and hidden while dragging; a
   one-time hint line. A tap on a ring: a chip with the piece's name (the `catalogTarget*` words) and, under the view, a strip of
   only that category's items. A tap on an item sends the turn — no text box; undo as today. The typed change (the text sheet)
   is untouched.
3. **The turn.** The page cuts the crop **zoomed onto the piece**: centred on its direction, hfov = its angular span × 2.2 (× 1.5
   for a set, with the table in frame), floor 45°, ceiling 90°. The request carries `item` + `reference` as now, plus the piece:
   its box and outline in crop coordinates and its category. The handler runs the catalog turn as T14b built it (the text step,
   nb2 with the product photo) — **one editor call**, the engine the probe chose.
4. **Acceptance — the size rule goes.** A catalog turn is accepted on (a) the border ring under 15 % and (b) the **replace
   judge**: one vision call that answers «is the ORIGINAL piece still there? is the product there? where?» — held when the old
   piece is gone, the product is present and its centre lies inside the old box widened by 15 %. The likeness score stays
   report-only. A refused result is retried once with the FRAME sentence (as today).
5. **Paste-back only where the piece was:** the changed-region mask is intersected with (the old outline ∪ the product's box from
   the judge), dilated — so an editor's collateral (a re-rendered painting, a rug turned into floor, three invented cushions) never
   reaches the panorama. The marker stays, now named after the item; a second tap swaps.
6. **Cost:** ≈ $0.09 a replacement (text $0.003 · nb2 $0.083 · the replace judge ≈ $0.003 · likeness $0.004) and 23–26 s;
   the scan ≈ $0.13 an apartment, once.

### 10.4 The probe (T14c re-scoped; `tools/replace-probe.mjs`; evidence `qa-evidence/tour360/T14/replace-probe/`)

Three bounded steps, every call reserved and settled in the laptop ledger (rows `probe: "replace"`) under the probe's own $2
(`spend.json`): `--scan` (13 scenes, 52 views, 151 pieces, 138 after dedupe), `--piece <category>` (the largest piece of the
category from the scan — the chairs: every chair at the largest dining table, as one set — a zoomed crop, a second detection on
it for the outline, the mask, then the engines), `--report` (the table and the sheet `index.html`, the product photos LINKED from
`catalog/_local/`, never copied). Engines on the same crop and product photo: **erase** = Finegrain express clears the outline,
then nb2 places the product in the cleared spot; **erase-bria** = the same with Bria; **direct** = the handler's own catalog turn.
Each result: the ring, the **collateral** (the share of the picture outside the widened mask that changed — free), the replace
judge, the likeness.

| piece → item | engine | verdict | ring | collateral | likeness | what the eye saw |
|---|---|---|---|---|---|---|
| sofa → KIVIK (living) | direct | **PASS** | 7 % | 0 % | 2/3 | a clean KIVIK three-seater where the sectional stood; painting, rug, coffee table untouched |
| | erase (Finegrain) | FAIL | 20 % | 19 % | 2/3 | the eraser hallucinated a draped couch in the hole and re-rendered the frame; nb2 then drew KIVIK but the window view, the painting and the cushions changed |
| | erase-bria | PASS by the judge | 7 % | **39 %** | 2/3 | Bria cleared more of the sofa; nb2 then turned the rug into wood floor |
| coffee table → KRAGSTA (living) | direct | **PASS** | 1 % | 1 % | **3/3** | KRAGSTA with its cross-stretcher base, the books, bowl and plant kept on top |
| | erase | PASS | 4 % | 3 % | 2/3 | a round white table with a solid shelf, the décor gone |
| dining table → SKANSNÄS (kitchen) | direct | **PASS** | 0 % | 1 % | 2/3 | the product's wood and tapered legs at the old table's size, rounded ends; the chairs untouched |
| | erase | PASS | 1 % | 2 % | 3/3 | the true 150 cm table, but the far chairs and the sofa corner redrawn (rest 2/3) |
| chair set → ODGER (kitchen, 7 chairs) | direct | **PASS** | 8 % | 9 % | 1/3 | every chair replaced; anthracite shells on light wooden legs |
| | erase | PASS | 12 % | 10 % | 3/3 | every chair replaced, all-dark as the photo — truer |
| armchair → STRANDMON (terrace — the only armchairs in demo-01) | direct | **PASS** | 0 % | 8 % | 3/3 | the wing chair, with three invented cushions |
| | erase | PASS | 1 % | 6 % | 3/3 | the wing chair, clean |

**Verdict (D-CAT-14): one zoomed editor call.** Five of five PASS, the least collateral, no second vendor, $0.04 and 6–15 s
cheaper. The erasers re-render the whole frame (Finegrain express changed the painting and the curtain outside its mask; Bria
the rug) and twice failed to clear the piece — a hole is an invitation to hallucinate. Where erase was truer (the all-dark chairs,
the armchair without cushions) the difference is the product photo's weight in the prompt, not the hole; and the mask-aware
paste-back (§10.3 step 5) takes the collateral out of both. Bria is the eraser if one is ever needed (licensed data). Measured:
the vision calls settle at ≈ $0.0025 each (OpenRouter's reported cost), the judge/likeness at $0.004 assumed; nb2 with two images
settled at $0.083 with the text step — fal's own bill for two input images still unverified (§2.7).

**The outlines.** In every scan view the polygons sat on the pieces (the sectional in 16 points). On the sofa's zoomed crop the
model's box was right and its outline was not (over the painting), which sent the first erase at the cushions and the painting.
The tool now checks every outline against its own box (both axis orders) and uses the box when the fit is under 0.6 — the build
keeps that check (OQ-C7).

### 10.5 The cards — filed 2026-10-07 evening by `/plan-to-tasks` (index [T16](../../development/tasks/habait-tour360/task-16-point.md))

| # | Card | Owner (`status` · model) | Tier | Depends on | Cost · bound |
|---|---|---|---|---|---|
| T16a ✅ | the scan at build time (done 2026-10-07 night: 19 markers in 5 scenes, $0.155): `tools/scan-pieces.mjs` → `apartments/<id>/markers.json` (pieces on the sphere, chair sets whole, every outline checked against its box), the sheet opened; `build-tour --catalog` carries the markers; the geometry into `tools/pano-geometry.mjs` | main session | T0 | T14d · T14c | ≤ $0.25 |
| T16b ✅ | the handler (done 2026-10-07 night, $0.0027): the tapped piece in the request, `op: 'replace_judge'` (the probe's judge, moved) instead of the size rule for catalog turns; the selftest's second golden `a413f17c` | main session | T0 | T14b | ≤ $0.02 |
| T16d ✅ | the copy ×3 (done 2026-10-07 night): `catalogHint`, `catalogMarker`, `catalogChip` | main session | T0 | — | $0 |
| T16c ✅ | the page (done 2026-10-07 night, $0.268; two laptop turns held by marker): rings as Pannellum hotspots (hidden while turning, the hint), the chip and the filtered strip, the zoomed crop, the replace judge, the paste-back only inside the piece, the marker after a swap; `live-check --item` by marker, `change-shots --catalog` | main session | T0 (inside D-T360-28) | T16a · T16b · T16d | ≤ $0.45 |
| T16e ✅ | the gate (PASS 3/3, 2026-10-07 night, $0.0925; `qa-evidence/tour360/T16/gate/REVIEW.md`): a fresh reviewer tried to refute three claims — T14f's two (folded in) and the paste only on the replace judge's hold, only inside the piece — with its own inputs (a 920-scenario differential and three mutants, 24 forgeries, one paid sofa turn); six notes, none turning the verdict → §8 OQ-C11…C13 | `habait-deploy-qa` (live · sonnet) | T0 | T16c | ≤ $0.15 |
| T16f ✅ | **the hardening** (D-CAT-20; done 2026-10-07 night, $0.0923, the re-check PASS): the judge's product box clipped to the piece's neighbourhood on the host and the page, a box mostly outside it refused, the verified bytes forwarded, the page branching on its own item; one sofa re-proof, then a fresh re-check of the gate's claim 3 | main session · `habait-deploy-qa` (the re-check, live · sonnet) | T0 (ruled) | T16e | ≤ $0.35 |
| T16i ✅ | **the layout** (2026-10-08, after the warden's read, $0): the card and the pick bar never cover the badge, the concept line or the AI note — on short viewports they take the strip's slot, landscape phones drop the strip; `tools/coverage-probe.mjs` (the warden's method as a tool) 0 covered lines in 255 cells; the tooltip price dated; the IKEA letter v2 | main session | T0 | T15a ✅ | $0 |
| T16g ✅ | **the likeness** (D-CAT-22; done 2026-10-07 night, $0.3517): the text step says nothing of the old piece remains and names the product's features; the editor's prompt names the photo the only authority for the product's look — likeness 3/3 on the chairs (a page turn held) and the sofa (one in-process call, the judge held), from 1/3; the sofa's ring test confounded by a frame-filling piece → OQ-C14; sheet `qa-evidence/tour360/T16/likeness/index.html` | main session | T0 (ruled) | T16f | ≤ $0.40 |
| T15a–T15c | T15a's dependency is now T16f (the warden reads the hardened page, on the laptop build — D-CAT-21); T15b and T15c wait for IKEA Israel's written permission and his deploy go | as filed | T2 / T1 / T0 | | |

**Agents.** All `live`; none minted, none dormant (the board's logged reason keeps the build with the main session). **Order**
T16a → T16b → T16d → T16c → T16e → **T16f → T16g** (added 2026-10-07 night, D-CAT-20/22) → T15a. **T14f folds into T16e** (T0): T16b and T16c rewrite the two files it would review.

**The gate (T16e).** **Check:** `timeout 300 node Habait/tour360/tools/catalog-probe.mjs --selftest` → `selftest: PASS`; the plain
and the `--catalog` build-and-smoke pairs → exit 0; `live-check --item kivik-3` on the laptop host → exit 0. **Reviewer scope:** (1) a
request without `item` takes the pre-wave path (`1b04ba65`); (2) a photo with one byte changed is refused with `catalog`; (3) a
catalog turn by marker is pasted only on the replace judge's hold, and only inside the piece's region.



| Document control | |
|---|---|
| Author | Main session, 2026-10-07 — Fable 5.1 for v0.1 and v0.3, Opus 5.5 for v0.2 |
| Version | v0.5 (2026-10-08 night: the test wave RUN — 34 replacement turns, every picture opened, the report `qa-evidence/tour360/T17/REPORT.md`: the paste leaves the old piece behind on every big piece (the scan's outline clipped by its view, the T16f clip cutting a third of the judge's box), the ring refuses right sofas, three terrace markers point at living-room pieces seen through the glass; the judge (T17e, opus, fresh) rules FAIL 2 S0 · 4 S1 · 20 S2 · 12 S3 · 3 Q; the fix wave T18a–T18m filed, OQ-C14 → T18b, OQ-C4 → T18e, the judge's Q-1 → T18l, Q-3 → T18m; $4.14 spent) · v0.5 (2026-10-08 evening: the test wave — his «plan full testing, A to Z» after his own session; `TEST-PLAN.md` v0.1 with its six cards T17a–T17f; D-CAT-24 the ledger cap $15, the wave's cap $10) · v0.4 (2026-10-08 night: T15a the warden's read filed — BLOCK for T15b, OQ-C15…C20; T16i the layout fix with its tool and proof; the IKEA letter v2) · v0.4 (2026-10-07 night, latest: T16f and T16g done — the hardening re-checked PASS, the likeness 3/3 on both pieces; §8 OQ-C14 the border test on a frame-filling piece) · v0.4 (2026-10-07 night, later: D-CAT-20…22 his after the gate — T16f the hardening, OQ-14/OQ-C1 ruled laptop-only until IKEA Israel's written permission with the request drafted, T16g the likeness card; §10.5 and §9 extended) · v0.3 (2026-10-07 night: T16a–T16e built and gated — the gate PASS 3/3 by the fresh reviewer, §10.5 rows ✅, §9 settled $0.518 of ≤ $0.87; §8 OQ-C11…C13 from the gate's six notes) · v0.3 (2026-10-07 evening, later: §10.5 filed as T16a–T16e and the index card T16 by `/plan-to-tasks`; T14f folded into T16e; the §6 and §9 rows re-pointed) · v0.3 (2026-10-07 evening: §10 the point-to-replace round — his eight rulings D-CAT-12…19 through the question tool, the probe on his «Go now» ($1.49 of $2: 13 rooms scanned, five pieces by two engines, every picture opened), the verdict «one zoomed editor call», the design and the cards to file; §3, §8, §9 extended) · v0.2 (2026-10-07 afternoon, later: T14b/T14d/T14e built on his «Build it now, I test on the laptop» — the order re-cut, the page before the probe; one laptop turn PASS) · v0.2 (2026-10-07 afternoon: §6 filed as nine cards by `/plan-to-tasks`; the gate made behavioural — the byte-identity claim could not hold; the probe in-process with no server and no secret; IKEA's photo files never copied into evidence; rows 10b and 18b) · v0.1 (2026-10-07) — drafted and ruled the same day: D-CAT-3 «Laptop host first», D-CAT-6 «Raise to $5», T14/T15 filed on his «File and start P0»; the D-CAT-2 picks revised to what IKEA Israel sells today; D-CAT-11 after P1 |
| Inputs | His two messages of 2026-10-07; the tree as read the same day (`server/handler.mjs`, `viewer/edit-live.js`, `tools/{build-tour,edit-server,live-check,smoke}.mjs`, `copy/tour360-copy.json`, the laptop ledger $1.64 of $3); the web pass of 2026-10-07 — fal's Nano Banana 2 edit page (several reference images), `fal-ai/flux-pro/kontext/max/multi`, Black Forest Labs' FLUX.2 editing docs (multi-reference), the unofficial IKEA GLB downloaders, IKEA's terms and conditions, the affiliate-program regions |
| Checked | The five items' facts read 2026-10-07 (T14a). Not yet run: nb2's price with two input images (§2.7, T14c). Committed by path with the wave's filing |
| Next | T15a done (BLOCK); T15b and T15c on IKEA Israel's written permission (D-CAT-21, the request his to send) and his deploy go; OQ-C14 (T16h) on his word. Was: T16g (D-CAT-22) → T15a (`compliance-warden`, T2, on the laptop build) → T15b and T15c on IKEA Israel's written permission and his deploy go. D-CAT-11 stands answered by §10.4: five of five recognisable by the eye (likeness 2–3 on the direct engine except the chairs' legs); the page's own turns read likeness 1/3 on sofas and chairs (the room's style wins over the photo — a prompt weight is a later card) |

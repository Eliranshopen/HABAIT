# T11 — CC0 catalog research: sources, verdicts, coverage, rejects

**Board:** `development/tasks/360-v2/` · **Task:** T11 · **Assignee:** capability-scout · **Cap:** $0 spent
**Date:** 2026-09-01 · **Deliverable:** [`catalog.manifest.json`](./catalog.manifest.json) — **57 rows**, every
row licence-verified CC0, zero `unverified` rows in the manifest proper.

All probes below are keyless, courteous (custom `User-Agent`, no repeated hammering, no accounts
created, no payment), and cached to this session's scratchpad. **No binaries were mirrored into this
repo** — one exception is disclosed honestly in §6 (methodology), stays out of the repo, and T12 refetches
fresh per board rail 4.

---

## 1. Verdict table — every source swept

| # | Source | Verdict | Why |
|---|---|---|---|
| 1 | **Poly Haven** (models) | **WORKS-TODAY** | Site-wide CC0 1.0, keyless `api.polyhaven.com` + `dl.polyhaven.org`, 521 models. Strong on photoreal PBR seating/tables/lighting/plants. **Confirmed (again, independently of T03) that it has zero modern sofas, zero bathroom fixtures, zero wardrobes, zero rugs** — see §2–§3. |
| 2 | **Kenney — Furniture Kit** | **WORKS-TODAY** | CC0 (quoted on its own page), one 5.13 MB zip, keyless, 140 named single-file `.glb` models. The single strongest source found — covers every one of the 6 required room types including the two categories Poly Haven has zero of (bathroom fixtures, rugs) and **three separate modern-sofa options**. |
| 3 | **Quaternius**, via **Poly Pizza** mirror | **WORKS-TODAY** | Origin (quaternius.com) states CC0 for all packs; Quaternius's own site only offers a bulk Google Drive folder (no stable per-file URL). Poly Pizza mirrors individual Quaternius files with stable, HEAD-verified `static.poly.pizza` direct URLs and independently redisplays "CC0 1.0" + the CC0 deed link per asset. Used for the two best modern-sofa candidates found in this whole sweep. |
| 4 | **ambientCG** | **DEAD** (for this catalog) | Keyless API (`ambientcg.com/api/v2/full_json`) confirmed CC0 1.0 site-wide, but its 8 asset types are Material/Atlas/Decal/Photo-Texture/Substance/HDRI/**3D Model**(terrain-scale)/Terrain — searching the live API for `q=sofa` returns 7 hits, all Leather **materials** + one HDRI, zero furniture; `q=furniture` returns 2 Wood materials, zero furniture. Its "Atlas" type (60 assets checked in full) is foliage/food/screw/tape clusters for scatter systems, not single named furniture. **No furniture models exist on this site at any query.** |
| 5 | **BlenderKit** | **BLOCKED** | The vendor rebranded mid-2026: `blenderkit.com` now 301-redirects (confirmed live, Cloudflare-served, not a caching artifact) to `www.blendkit.com`. Regardless of domain, WebSearch of the vendor's own docs/FAQ confirms: downloading **any** asset — CC0 included — requires a free BlenderKit/Blendkit account **and** the Blender add-on. Account creation is explicitly against this board's $0/no-accounts rail. |
| 6 | **Sketchfab**, CC0 filter | **BLOCKED** | Sketchfab's own "Download API Guidelines" (developers.sketchfab.com via WebSearch-surfaced vendor docs) and multiple independent how-to sources confirm downloading **any** model — including CC0-licensed ones — requires being signed into a Sketchfab account. Browsing/search is keyless; the actual file transfer is not. |
| 7 | **Objaverse / Objaverse-XL** | **BLOCKED — impractical at $0** | The dataset's own card (huggingface.co/datasets/allenai/objaverse-xl) states "Individual objects... are licensed under different licenses" (i.e. NOT a CC0-only registry — CC0 is a per-object subset of a much larger mixed-licence pool) and confirms there is **no curated search UI** for categories like "modern sofa" — only bulk metadata files + a Colab download tutorial, some subsets (Polycam) explicitly non-commercial-only. Finding one specific, style-appropriate, CC0-tagged modern sofa would mean downloading and filtering a multi-GB metadata index — disproportionate to a $0 hand-curation task, and out of place next to sources that just work. |
| 8 | **Smithsonian 3D** (3d.si.edu / si.edu/openaccess) | **NOT-PROBED — fetcher blocked** | Both endpoints returned HTTP 403 to WebFetch (twice, different hosts) — recorded honestly rather than guessed. Even if reachable, editorial note: the collection is museum artifacts (fossils, spacecraft, historical costume, sculpture) — a poor category match for "modern warm-neutral apartment furniture" even in the best case, so it was not pursued further after the second 403. |
| 9 | **Poly Pizza** (the aggregator site itself, beyond the Quaternius mirror above) | **WORKS-TODAY, mixed licences — used selectively** | 10,600+ models, keyless browsing and keyless per-file `.glb` downloads from `static.poly.pizza` (HEAD-verified 200, `gltf-binary`), each asset page shows its own licence badge (CC0 1.0, CC-BY 3.0, etc.) plus a link to the matching Creative Commons deed. **Its own bulk API requires a key** (`api.poly.pizza` → `"You need an API key to do that"`) — only the public website's per-page HTML was used, which needs no key. Every row actually placed in the manifest from this site is individually confirmed CC0 (not CC-BY) on that asset's own page. |

**Candidates named in the task brief and swept:** Poly Haven ✓, BlenderKit ✓, ambientCG ✓, Sketchfab ✓,
Objaverse/Objaverse-XL ✓, Smithsonian ✓, Kenney ✓, Quaternius ✓. **One extra CC0-only registry found and
verified beyond the named list:** Poly Pizza (used as the practical download vector for Quaternius, and
independently as a mirror confirming Kenney's own files).

---

## 2. The Poly-Haven-has-no-modern-sofa finding, re-confirmed and extended

T03 flagged this from one asset (`sofa_02`). This task pulled **every** Poly Haven asset whose id or name
contains "sofa"/"couch" (5 total, out of 521 models, via the keyless `assets?type=models` bulk endpoint)
and read each one's own `description` field — the site's own words, not a guess from the name:

| Asset id | Poly Haven's own description |
|---|---|
| `Sofa_01` | "Free 4K **vintage Victorian** wooden sofa - decorative **gothic-style** upholstered couch with carved frame, elegant seating prop for **period interiors**." |
| `sofa_02` | "Free 4K model of a **tufted leather sofa** with carved wood frame - elegant **vintage** couch/prop with realistic leather and fabric cushions." (T03's find) |
| `sofa_03` | "Free 8K model of a **vintage Victorian leather sofa** with carved wooden frame, scrolled arms, patterned fringe cushions and rich **antique** brown finish." |
| `chinese_sofa` | "Free 8K model of a **vintage Chinese** wooden sofa, **antique** and ornate traditional seating with elegant carved legs and a warm lacquered finish." |
| `painted_wooden_sofa` | "Free 4K model of a **painted wooden sofa** - **vintage** outdoor bench-style couch with **distressed aged paint**, carved details and a simple cushion." |

**All five, zero exceptions, are vintage/antique/gothic/distressed by the source's own words.** This is not
a naming quirk — Poly Haven simply has not modeled a contemporary sofa. A Poly-Haven-only catalog would
have made every living room look like a period drawing room, exactly the accidental-style-shaping risk
the task brief named.

**Gap closed two ways**, both in the manifest:
- **Kenney Furniture Kit** ships **three** modern sofa/sectional pieces by name: `loungeDesignSofa`,
  `loungeSofaCorner`, `loungeDesignSofaCorner` (plus `loungeChairRelax`, `loungeSofaOttoman` for the set).
  Low-poly, flat-shaded, clean rectangular silhouettes with tapered block legs — genuinely modern in
  outline (thumbnails reviewed directly, see §6).
- **Quaternius**, individually mirrored on Poly Pizza with a working direct `.glb` URL: `Sofa`
  (`polypizza:X5kQPKzAWp`) and `L Couch` (`polypizza:1kwsjhpY84`) — both proper L-shaped modern sectionals
  with distinct back/seat cushions and tapered legs, visually confirmed via downloaded thumbnails to be
  clearly modern (not vintage), noticeably higher-fidelity modeling than Kenney's blockier set.

That is **4 real modern-sofa options** across 2 sources for T12 to pick from — the gap is over-closed,
not just patched.

---

## 3. Room-type coverage mapping

Required standard set (task brief): **living, bedroom, kids, kitchen, bathroom, dining.**

| Room type | Rows in manifest | Minimum set covered? |
|---|---|---|
| **living** | 26 | Sofa (×4 modern options) · armchair ×2 · coffee table ×2 · TV unit + TV · bookcase ×2 · side table · floor + table lamp · pendant lamp · rug · plant · wall art · steel shelf · pillow · books |
| **bedroom** | 12 | Bed double + single · nightstand · wardrobe-substitute (see §5) · lamp · rug · pillow · side table · pendant lamp · plant · wall art |
| **kids** | 8 | Bunk bed · desk + desk chair · low bookcase · display shelf · rug · books |
| **kitchen** | 11 | Base + upper + corner cabinets · sink · electric stove · fridge · range hood · microwave · coffee machine · plant · shelf |
| **bathroom** | 8 | **Toilet · sink ×2 (incl. a square/modern option for the en-suite) · shower · bathtub · vanity cabinet · mirror · bath-mat rug** — the one category Poly Haven contributes zero rows to; Kenney alone closes it completely |
| **dining** | 8 | Table · modern dining chair ×2 · pendant lamp · rug · plant · coffee table (deco-style, dual-use) · outdoor table+chair set (balcony bonus) |

(Rows sum to more than 57 because most decor items — rugs, lamps, plants, wall art, side tables — are
legitimately multi-room and tagged with more than one `room_types` entry.)

**Mapping onto the ACTUAL pilot apartment's schema types** (`tours/pilot-karnei/plan.json`, for T12's
convenience — the pilot uses a finer type vocabulary than the task's 6):

| Pilot `room.type` | Count in `apt-6` | Nearest manifest room_types tag |
|---|---|---|
| `living` | 1 (r-living) | `living` |
| `bedroom` | 2 (r-bed-2, r-master) | `bedroom` (r-master) / `bedroom`+`kids` option available (r-bed-2, if a future apartment wants it dressed as a kids room) |
| `kitchen` | 1 | `kitchen` |
| `bathroom` | 2 (r-bath-main, r-ensuite) | `bathroom` (both — the manifest's `showerRound` is tagged for the en-suite, `bathtub` for the main bathroom, matching GROUND-TRUTH.md's own room-by-room read) |
| `toilet` | 1 (r-wc, guest WC) | `bathroom` rows apply (toilet + a compact sink) |
| `safe_room` | 1 (r-mamad, ממ"ד) | not furnished by convention (a mamad is a reinforced safe room, typically left bare or lightly used) — **no manifest row targets this on purpose**, flagged here rather than silently absent |
| `hall` | 2 (r-master-lobby, r-dining) | r-dining is where the **dining** rows land (it is literally named "מבואה ופינת אוכל" = lobby **+ dining corner** in GROUND-TRUTH.md) |
| `corridor` | 1 (r-corridor) | no dedicated furniture; a `living`-tagged wall-art or console row could dress it, T12's call |
| `service_balcony`, `balcony` ×2 | 3 | `outdoor_table_chair_set_01` (dining-tagged, balcony bonus) is the only outdoor-appropriate row; balconies carry no camera point per `plan_meta.assumptions` so dressing them is optional |

---

## 4. Manifest stats

- **57 total rows** (task floor was ≥40): Poly Haven 10 · Kenney Furniture Kit 45 · Quaternius-via-Poly-Pizza 2.
- **Zero `unverified` rows** — every row's `licence.status` is `CC0-verified` (machine-checked, see §6).
- **Zero duplicate ids** (machine-checked).
- Every row has a non-null `direct_download_url`.
- Every row carries `"sha256": null` **by design** — per the task's shared-file-contract instruction, the
  shape is ready for T12's `fetch.mjs --seal` mode to fill without reshaping the schema.
- Formats: Poly Haven rows are `.blend` at 2k resolution (matching T03's own convention, and Blender's most
  native import path); Kenney and Quaternius rows are self-contained `.glb` (Blender's glTF importer
  handles these natively — no conversion needed for any row in the manifest).

---

## 5. Rejects that matter

### 5a. Licence/access rejects (sources, not individual assets)
| Source | Reason rejected |
|---|---|
| BlenderKit / Blendkit | Account + add-on required for every download, even CC0 (§1.5) |
| Sketchfab | Account required for every download, even CC0 (§1.6) |
| ambientCG | Not a licence failure — simply has no furniture models of any licence (§1.4) |
| Objaverse/Objaverse-XL | Not CC0-only (mixed per-object licences) and no curated search — impractical at $0 (§1.7) |
| Poly Pizza's own bulk API | Requires an API key (`api.poly.pizza`); the **website's HTML pages** need no key and were used instead |

### 5b. Style rejects (individual CC0-verified assets, rejected on look, not licence)
These are worth recording because their **names** would have passed a careless keyword-only sweep — the
lesson is in §6.

| Asset | Source | Its own description | Why rejected |
|---|---|---|---|
| `dining_table` | Poly Haven | "**rustic** wooden dining table with **worn grain**... draped in a **blue-beige gingham cloth**" | Farmhouse/rustic, not warm-neutral modern — Kenney's `table` used instead |
| `dining_chair_02` | Poly Haven | "modern dining chair with **tufted brown leather**... **fancy**... **elegant**" | "Modern" in the id, but the actual material/style is traditional-fancy leather — Kenney's `chairModernCushion`/`chairModernFrameCushion` used instead |
| `hanging_picture_frame_02` | Poly Haven | "**vintage** wooden... **distressed** white finish... faded painted artwork... **period interiors**" | Vintage |
| `hanging_picture_frame_03` | Poly Haven | "**ornate** oval... varnished **vintage** finish... carved floral details... **antique** photo insert" | Ornate/antique |
| `ornate_mirror_01` | Poly Haven | "**Victorian**-style arched mirror with gilded floral crest... **aged, speckled glass**" | Victorian |
| `brass_vase_02` | Poly Haven | "**ornate** brass vase... polished **antique** gold finish... light **patina**" | Ornate/antique |
| `plastic_monobloc_chair_01` | Poly Haven | "**weathered** white plastic... **scuffs, dirt and faded finish**... showing age and wear" | Explicitly distressed — wrong for a new-build listing |
| `Large Wardrobe` / `Medium Wardrobe` / `Wardrobe` / `Wide Dresser` (several authors) | Poly Pizza | Licence badge reads **CC-BY 3.0**, not CC0 | Out of scope for a CC0-only catalog (see §5c) — flagged as a possible future loosen, not decided here |

### 5c. The wardrobe gap — honestly unresolved for strict CC0
No purpose-built wardrobe/closet model was found under a verified CC0 licence in any of the eight sources
swept:
- Poly Haven: zero hits for `wardrobe|closet|dresser|armoire` across all 521 model names.
- Kenney Furniture Kit: no wardrobe/closet among its 140 files (confirmed against the full extracted file
  list, §6).
- Poly Pizza: real wardrobe/dresser results exist (`Large Wardrobe`, `Medium Wardrobe`, `Wardrobe`,
  `Wide Dresser`, several `Dresser`s) but **every one checked is CC-BY 3.0**, not CC0.

**Two CC0 workarounds are in the manifest instead**, both flagged in their own `notes` field:
`polyhaven-modern_wooden_cabinet` (a genuinely "minimalist contemporary" wide cabinet with doors) and
`kenney-furniture-kit-bookcaseClosedWide` (a wide closed-door cabinet from the same coherent kit as the
rest of the bedroom set). Neither is a true wardrobe. **If a real wardrobe silhouette matters for the
pilot, the CC-BY 3.0 Poly Pizza options are the fastest real fix** — that is a licence-posture call
(attribution requirement, however light) outside this task's $0/CC0-only mandate, so it is reported here
rather than decided.

---

## 6. Methodology, gotchas, and one disclosed judgment call

- **Bulk metadata over one-by-one API calls.** `api.polyhaven.com/assets?type=models` (keyless) returns
  all 521 models' names/categories/tags/descriptions/polycount/dimensions in one call — every Poly Haven
  claim in this file (the sofa-gap table, the style-reject table, the zero-bathroom/zero-wardrobe/zero-rug
  findings) came from **reading that one cached response**, not from guessing at names. `/files/<id>`
  (also keyless) was called twice to confirm the exact `dl.polyhaven.org` URL pattern generalizes; five
  freshly-constructed URLs for NEW ids (not already proven by T03) were then HEAD-checked live (all 200)
  as the "sample per source" liveness probe.
- ⭐ **A Poly Haven asset's NAME is not a style signal — its `description` field is.** `dining_table`,
  `dining_chair_02`, `hanging_picture_frame_02/03`, `brass_vase_02` all sound plausibly modern/neutral by
  name; every one of them turned out to be rustic/vintage/ornate/antique **in the source's own
  description**. Every row that made it into the manifest was individually description-checked, not
  name-pattern-matched. This is the single most important gotcha for the next runner extending this
  catalog.
- **Thumbnails were downloaded and visually inspected, not assumed from names**, for the load-bearing
  modern-sofa claim specifically (six candidate thumbnails fetched: 3 Kenney, 2 Quaternius, cross-checked
  against Poly Haven's `sofa_02` for contrast) — the Kenney and Quaternius pieces read as clean rectangular
  modern silhouettes; Poly Haven's read as an ornate carved Victorian frame. This is a stronger evidentiary
  bar than trusting either source's own category tag.
- **One disclosed judgment call — the only "more than tiny" GET in this task.** Kenney's own site
  publishes no per-item file listing anywhere reachable (its asset page is a single pack download button,
  no manifest). To catalog **which of the 140 files genuinely exist and under what exact name** — rather
  than guessing filenames from two preview screenshots — the 5.13 MB pack zip was downloaded **once**, to
  this session's scratchpad only (never this repo), listed with `unzip -Z1` (no extraction of binary
  content), and its own sha256 computed for the `sources[].pack_zip_sha256` provenance field. This is a
  single, one-time, non-repeated fetch of a free public file, done for cataloguing accuracy; it is **not**
  a mirror committed anywhere, and T12's own `fetch.mjs --seal` step re-fetches it fresh per rail 4 (no
  reliance on the scratchpad copy). Flagged here rather than silently done, per the operating rule to
  record decisions honestly.
- **`poly.pizza`'s bulk API is keyed; its plain HTML is not.** `api.poly.pizza/v1.1/search/...` answers
  "You need an API key to do that" — but the ordinary website search/model pages (`poly.pizza/search/...`,
  `poly.pizza/m/<id>`) are server-rendered HTML, fully keyless, and carry the same licence badge + CC deed
  link + direct `static.poly.pizza` file URL a logged-in user would see. All Poly Pizza probing in this
  task used the plain HTML path only.
- **A vendor can rename itself mid-track.** `blenderkit.com` → `www.blendkit.com` is a real, live,
  Cloudflare-served 301 (verified directly, not inferred) — confirmed via WebSearch that this is a
  rebrand, not a domain squat, but it changes nothing about the account-gate verdict.

---

## 7. NOT-PROBED (honest gaps, for a future pass)

- **Smithsonian 3D / Open Access API** — two clean 403s (different hosts), no content read either way.
  Not asserted CC0-or-not; not asserted furniture-relevant-or-not beyond the editorial note in §1 row 8.
- **Poly Haven textures used as rugs** — only one carpet-tagged texture exists site-wide
  (`dirty_carpet`, explicitly "dirty" — style-rejected on sight, not included). A plane + a nicer CC0
  fabric/wool PBR texture (Poly Haven has several plain fabric textures untried this pass) is a viable
  T12-side alternative to a modeled rug and was not fully explored — flagged, not resolved.
- **Kenney's other packs** (beyond Furniture Kit) and **Quaternius's other packs** (`Ultimate House
  Interior Pack`, `Ultimate Furniture Pack` proper) were not swept item-by-item once Furniture Kit alone
  proved to cover every required room type — there is likely more useful stock here if 57 rows ever feels
  thin for a second pilot apartment.

---

## 8. Note for T12 — the one integration risk worth flagging loudly

**Style coherence.** Poly Haven rows are photoreal PBR (2K/4K/8K texture maps, high poly). Kenney and
Quaternius rows are low-poly, flat-shaded "game asset" style with a simple colour texture, no PBR
roughness/normal maps. Rendered side by side in the same Cycles scene with no further work, the Poly
Haven armchair would look photoreal and the Kenney sofa two metres away would look like a mobile-game
prop — not the "one coherent warm-neutral modern look" the task asked the catalog to be biased toward.
This is not a licence or research problem, so it is out of this task's scope to fix, but it is the single
highest-leverage thing for T12 to know going in: the clean, boxy, low-poly Kenney/Quaternius geometry is
genuinely well-suited to a "modern minimalist" render **once it carries a proper PBR material** (a flat
colour swapped for a fabric/wood/metal material, e.g. reusing Poly Haven's own texture library, which is
free and already in the catalog for other purposes) — this is a normal, well-trodden technique (simple
geometry + good materials + good lighting), not a workaround.

---

## Links
- Manifest: [`catalog.manifest.json`](./catalog.manifest.json)
- Board: [`development/tasks/360-v2/README.md`](../../development/tasks/360-v2/README.md) ·
  Task file: [`development/tasks/360-v2/task-11-catalog-research.md`](../../development/tasks/360-v2/task-11-catalog-research.md)
- Prior art this task builds on: [`pipeline/probe/probe-assets/PROVENANCE.md`](../pipeline/probe/probe-assets/PROVENANCE.md)
  (T03's probe-only picks, which first surfaced the sofa gap on one asset)
- Reference architecture this catalog is patterned on:
  [`research/walkaround-reference/REPORT.md`](../research/walkaround-reference/REPORT.md) §2.5 (146
  placements / 60 catalog models / style-as-suffix)

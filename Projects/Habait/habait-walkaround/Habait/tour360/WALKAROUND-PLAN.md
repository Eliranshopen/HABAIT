# WALKAROUND-PLAN — the live walkaround: one 360° engine, changed live, for buyers and developers

**v0.5 · 2026-10-13 · track `Habait/tour360/` · board [`habait-walkaround`](../../development/tasks/habait-walkaround/README.md) FILED and EXECUTING · his D-T360-33…40 in §0 · the probe MEASURED (§4.1) · its own Vercel project `habait-walkaround` (§3, D-T360-38)** — Slava's order the same day: *"lets
proceed develop the best walkaround for our users"*, after he closed the R&D board `habait-tour360` (D-T360-29) and ruled the
round's shape (D-T360-30…32). Research of record: [`research/live-walkaround/01`–`05`](research/live-walkaround/) (five
lanes, 2026-10-13, $0, docs and web only). What the R&D proved: harness
`memory/project/2026-10-13-tour360-rnd-capability-record.md`.

---

## 0. What this is

The walkaround a buyer actually wants: open an apartment, walk it, and change it — the floor, the walls, the kitchen fronts,
the sofa, the whole room's style, the light of the day — and see the change land in place, the same in every room, fast.
**One engine** serves two frames: a buyer inside Habait (opened from Ziv's chat and the project page) and a developer's
shareable link (WhatsApp, QR, the developer's own site). The existing tour (`demo-01`, 13 AI panoramas, Pannellum) is the
starting asset and the proof that the walk itself works; its change machinery is the R&D we now rebuild.

**His four rulings (2026-10-13, `memory/project/2026-10-13-tour360-close-and-live-walkaround-rulings.md`):**

| # | Ruling |
|---|---|
| D-T360-29 | The R&D board closed whole; IKEA parked; nothing deleted |
| D-T360-30 | **One engine, both places** — buyers inside Habait and a developer's link |
| D-T360-31 | **Four kinds of change:** finishes & colours (the same in every room) · furniture & style · free text · light & time of day |
| D-T360-32 | **Generate everything live**, and push the speed down from today's wait as far as the models allow |
| **D-T360-33** | **Live, then instant** — anything new is generated live (a material, a style, a light); a finish is applied to every room by masks in the browser, instant and the same everywhere; a preset look made once is reused for the next visitor of that apartment; free text is always fresh (OQ-W1, OQ-W2) |
| **D-T360-34** | **Permanent features may change, framed as an option** — walls, floors, fronts, tiles, and the light and sky through windows; a visible "illustrative option, not the delivered unit" line on changed views, he/en/fr wording drafted for his sign-off; the window view changes only under a sunset or night light (OQ-W3; "empty the room" still unasked) |
| **D-T360-35** | **The shared probe: lean, cap $3**, on a new ledger (OQ-W4) |
| **D-T360-36** | **The mock and the probe together**; his look at both, then the build board |
| **D-T360-37** | **File the build board over the WIP ceiling** — «File it now» (his *"lets build it , /plan-to-tasks"*) |
| **D-T360-38** | **Its own Vercel project, `habait-walkaround`** (`habait-walkaround.vercel.app`) with its own functions, ledger and storage — both frames (the developer's link and the buyer view) live there; putting it inside Ziv's canvas on habait.ai is a later step on his go (board T40 ⏸) — his *"i want it on other vercel url"* |
| **D-T360-39** | **$20 hard cap** on the board's paid calls — room scans, ready-made looks, live tests, the replace-matrix re-run, the follow-up probe; the hosted lane after the deploy draws on what remains |
| **D-T360-40** | **The view open, paid changes behind an unlock code, $5 a day** — walking, library finishes and ready-made looks cost nothing at view time; anything generated needs the code, until he opens it up |
| **D-T360-46** | **Parity first** (his «Yes, build it this way», after «the last version was much much better» on the lab): he likes everything on the design link — the look and feel, the prepared changes, typing any change, the picture quality; so step 1 is that link unchanged to his eye on the new viewer (a Pannellum-compatible adapter), step 2 the fast typed change, step 3 new features one at a time, each shown only when it beats the design link |

## 1. Where we start — three facts the R&D measured

| Fact | Number | Consequence for this plan |
|---|---|---|
| **The live change is slow because its steps run in series.** Text step → piece read → editor → judge → likeness → paste | **35.0 s median** tap-to-scene after T18a (26.7–44.9, n=17; 27.2 s before T18a added the piece read) — `qa-evidence/tour360/T18/REGION.md`, lane 01 §2 | at least 16 s is pipeline, not model: rebuild the pipeline before buying a faster model |
| **A change lives in one view.** A wall or floor ends at the edge of the edited crop; the same sofa is old again from the kitchen | per-view finishes would cost 78–156 crops, $3–14 and 35–70 min per apartment (lane 02 §3) | finishes, style and light need a whole-room method, not more crops |
| **Quality fails in the paste and the gate, not the editor** | 17 of 31 landed catalog runs left the old piece behind (T17 F1, S0); a judge HOLD is not a right picture | server-side acceptance with goldens; a person looks at the pictures |

## 2. The experience (lane 04)

### 2.1 Design rules

1. **The picture is the product.** At rest: a top band (badge + concept line), one bottom pill ("Change the design"), the
   bottom rail (AI note). Everything else on demand.
2. **The disclosure rails are untouchable** — no sheet, card, ring label or dialog covers or blurs them (D-CAT-26 carried).
3. **Tap the thing, pick from a short list, see it land** — chips first, text second (Pinterest Restyle, Zillow, IKEA
   Kreativ converge on this; a free-text box alone is the weakest door).
4. **A change never hides its own result** — a half-sheet ≤ 45% of the height, the target re-aimed above it.
5. **Every wait has a name, a size and an exit** — acknowledge in < 100 ms, four named steps (sending · drawing · checking ·
   placing) with "about N s", the room stays draggable, a queue of up to three, **never a fake percent**.
6. **Offered and imagined never share a row** — the developer's real options with prices vs AI ideas (wording his).
7. **Compare is one gesture** (hold to peek; a wipe that is also a range input); **"my version" is an object** — saved,
   shared, sent.

### 2.2 The two frames

| | Buyer inside Habait | Developer's link |
|---|---|---|
| Entry | Ziv's card → "Walk through"; the tour as a canvas window | cold open from WhatsApp/QR: ≤ 1.5 s branded splash over the blurred first room |
| Identity | known user; Ziv carries the context; the chat is a text box | anonymous visitor; a lead door that gates **save/send only, never the view** |
| Menu | Surfaces · Furniture · Light · Say it | **Offered** leads (the developer's priced options), Ideas follows; free text off or quota'd |
| Save / send | to the account and the shortlist; "send to the developer" posts into the chat | a short link; send = name + phone or a WhatsApp deep link |
| Cost | per-user daily budget | per-link budget (who pays is his — OQ-W5) |

The full screen list (B0–B12 phone in-app, D0–D7 developer link, X1–X6 desktop) and the second-by-second wait ladder are lane
04 §6–§7; the mock (§6, P0) draws them.

## 3. The engine and the architecture (lane 05)

| Decision | Choice | Why |
|---|---|---|
| Viewer | **Photo Sphere Viewer 5.15.1 (pinned)** as the camera/tiles/transitions shell + our own **`LiveLayer`** GPU module (patch · decal · mask-tint · light crossfade) + our own chrome ported from `tour.js` | Pannellum takes only an image URL — every change re-encodes the whole panorama as a JPEG; PSV is MIT, maintained, has Overlays and an `addObject` door; Marzipano archived; krpano closed and paid. **Gated by five spikes E1–E5** with kill criteria; a thin three.js viewer is the stated exit |
| Where pixels are processed | **the server** — server-made crops, server-side acceptance and bake; the browser only draws | today any code holder can send any picture ≤ 2 MB to a paid editor (`handler.mjs:616-617`); saved/shared versions need server-owned truth |
| Jobs | **v0.4 (D-T360-38): Vercel functions in the project `habait-walkaround`** (`walkaround/api/`) + a job row in the project's own store (his pick, board T02; Neon recommended) + persisted events + **SSE with resume**; fal queue + webhook as v2. ~~a Next route in the app repo~~ | resumable without Redis; nothing in the Habait app repo |
| Storage | content-addressed patches, versions and ready-made looks in **the project's own Blob store** + a small variant JSON per "my version" | shareable `/<tourId>/?v=<variantId>` |
| Caps | **the project's own ledger** in its store, reserve-and-settle in one transaction; `WALK_DAY_CAP_USD` 5 (D-T360-40) and `WALK_TOTAL_CAP_USD` (what remains of the board's $20, D-T360-39); a kill switch; per-code and per-IP limits. ~~the app's `media_ledger`~~ | the in-memory hosted day cap is not a cap |
| Hosts | **v0.4: one multi-tenant project `habait-walkaround`** (`/<tourId>/`) serving both frames — the developer's link and the buyer view (`?frame=embed`); the iframe inside Ziv's canvas (T06) comes later, on his go (board T40 ⏸) | one engine, two frames (D-T360-30), its own URL (D-T360-38) |

## 4. Making it fast (lane 01) — the latency plan

**Stage A — the pipeline, no model change (≈ 16–18 s):** the likeness off the critical path (−3.9 s; it never gates) · the
piece read in parallel or replaced by build-time masks (−5.9 s) · the text step templated for chip and tap turns (−2.1 s) · the
judge concurrent, then an optimistic labelled preview that `done` confirms or `failed` withdraws (−4 s perceived) · a URL
instead of a base64 hop · server crops.

**Stage B — the engine:** **Nano Banana 2.1** (released 2026-10-06; AA editing Elo 1141 vs NB2's 1113; about half NB2's
price) at `thinking_level: minimal` — its default `medium` costs seconds → **≈ 12–15 s** [U]. **Nano Banana 2 Lite** (Google:
"sub-2 s"; Elo 1049) for the easy intents → **≈ 6–10 s** [U]. FLUX.2 klein / P-Image-Edit (1–3 s, Elo 950–1013) only where the
eye accepts them.

**Stage C — never wait twice:** canonical frames + a result cache (two buyers painting the living-room wall white share one
generation) · parallel fan-out across rooms instead of the browser's serial loop · a hedged second request instead of the
doubled retry tail (+50% editor spend — his).

| Change | Today | After A | After B | With caches / masks |
|---|---|---|---|---|
| Swap a piece (tap) | 35 s | 16–18 s | 12–15 s (NB2.1) · 6–10 s (Lite, if quality holds) | a repeat < 1 s |
| Free text, this view | ≈ 27 s | 17–19 s | 13–16 s | never shared |
| A finish, whole home | not possible (per-view) | — | — | **swatch 5–15 s once, then < 1 s per room** (hybrid, §5.1) |
| Restyle a room | not possible | — | draft 2–8 s → final 12–25 s per room [U] | a preset < 1 s for the next visitor (OQ-W2) |
| Light / time of day | not possible | — | 12–25 s per room [U] | browser grade < 0.1 s (option) · a cached preset < 1 s |

All After-figures above were derived estimates; §4.1 has what the probe measured. No published number puts a
top-quality **whole-panorama** edit under 10 s, and the probe found none either.

### 4.1 Measured on 2026-10-13 — the lean shared probe (D-T360-35)

`qa-evidence/tour360/walkaround-probe/PROBE.md` · 177 paid calls · **$2.78 of the $3 cap** · every picture opened. Client
wall-clock, send to last byte; the visitor's network and Vercel's region are not in these numbers.

| Change | Engine | p50 (p90) | $ a call | Held by eye | Reading |
|---|---|---|---|---|---|
| Swap a piece, change a view | **Nano Banana 2 Lite** | **5.4 s** (5.9) | 0.042 | 10 / 12 (a rug ghost under a swapped table) | the fast lane for taps and one-view words |
| Same | Nano Banana 2.1, thinking minimal | 14.5 s (16.3) | 0.042 | 12 / 12 | the quality lane — half today's price, **not faster** than today's NB 2 (13.3 s); minimal thinking saves ≈ 3 s over the default |
| Same | FLUX.2 klein 9B | 3.0 s (3.3) | 0.022 | 8 / 12 | keeps the old sofa's shape, invents lamps under a light change — colours and finishes only |
| Restyle a whole room | **NB 2.1 on the whole panorama, 21:9 circular pad + cross-fade** | 25.7 s | 0.062 | structure 0.82, wrap seam 3.95 (the original's 4.50), openings, window view and wall art kept | the restyle engine; Muse with the same pad is $0.01 at 23 s but replaced the wall art |
| Relight (sunset, night) | NB 2.1 whole panorama | 22.6–23.3 s | 0.062 | held | Muse holds too; Bria weak |
| Finishes by masks | SAM 3 on 8 tangent views, fused | ≈ $0.24–0.36 a room, once | — | walls, floor, ceiling good; cabinets and countertops 2 of 8 views; window and lamp nothing | the **same** sage reads ΔE00 0.44 apart in the living room and the kitchen (2.68 before); leaks: the terrace deck as floor, the backsplash as wall, a stone panel; a colour, not yet a plank texture |

**What this changes in the plan:** stage B is two lanes, not one engine — Lite (≈ 6 s with placing) for taps and one-view
words, NB 2.1 for the cases Lite refuses or smudges; a whole-room look is ≈ 25 s the first time and instant for the next
visitor (D-T360-33); finishes are instant once a room is scanned, and the scan needs a person's QA pass (the leaks above).
Not run: hand-labelled mask IoU, three-room style consistency, browser recolour speed on a phone, Hebrew/French input, a
material swatch generator (Patina) — the first cards of P2.

## 5. The four kinds of change — how each is made

### 5.1 Finishes & colours (lane 02)

| Option | Speed | Same in every room | Per change | Verdict |
|---|---|---|---|---|
| A. per-view generative, linked (today) | 27–35 s × 6–12 views a room | weak | $0.24–1.08 a room | no |
| B. whole-panorama generative, one call a room | 20–60 s a room [U] | weak–medium [U] | $0.06–0.12 a room | the fallback; probe |
| **C. hybrid — the material generated live, applied by masks** | swatch 5–15 s, then ms–1 s a room [U] | **strong by construction** | library $0 · free text ≈ $0.08 | **recommended, needs his ruling (OQ-W1)** |
| D. Blender pre-rendered / recomposited | instant | perfect | $0 | CG tours only (OQ-W9) |

C means: at build time each panorama gets surface masks (walls, floor, ceiling, cabinets, worktops — SAM 3 on fal, $0.005 a
request), an albedo/shading split and its planes; at run time a finish is a shader uniform and a texture, applied to all 13
rooms at once. **It is unproven on AI panoramas** — the probe decides. Three things bite whatever the option: the acceptance
ring fights surface edits; a live US patent reads like luminance-preserving recolour (US 9,190,016 B2 — lawyer before a US
launch); and root `CLAUDE.md` §6 forbids altering permanent features — finishes **are** permanent features, so the framing
("an option for a unit not yet built") and its wording are his (OQ-W3).

### 5.2 Furniture & style (lanes 01, 03)

- **Swap a piece:** the proven point-to-replace flow (rings from a build-time scan → one zoomed editor call → paste inside the
  piece), rebuilt server-side, with **generic** pieces (no IKEA, D-T360-29) and build-time piece masks so the paste owns the
  right pixels (attacks F1 at its root, $0 and 0 s a visit).
- **Restyle a room:** **one whole-equirect edit at ≈ 2K**, from the room's canonical-day panorama, never chained:
  co-primaries **Meta Muse Image Edit** (2:1 direct, $0.01, Elo 1123) and **Nano Banana 2.1** (a 21:9 circular pad, ≈ $0.06);
  a seam-safe wrapper, the window view composited back from the original, a **structure gate** (≥ 22 of 24 door markers
  still on an opening), one automatic retry on the next model, an honest failure. One shared style brief + the first room as
  an anchor reference keep the rooms one designer's work. A labelled **draft → final → sharpen** ladder, never a silent swap.

### 5.3 Free text

The long-tail door, second to the chips: one view, the scope rule kept (structure, a named real person and unsafe content
refused — D-T360-24/26), the text step on a fast no-reasoning model, Hebrew and French translated to English until a probe
shows the editor reads them directly. Never cached across visitors; quota'd or off on a public link (OQ-W6).

### 5.4 Light & time of day (lane 03)

The same whole-equirect engine with a light template per stop (morning · noon = canonical · sunset · night): lamps on or off,
window light, shadows. No dedicated relighter fits a whole room (IC-Light and LBM are foreground tools; LBM is
non-commercial); Bria FIBO Relight is one probe arm. **Options for his ruling, never silent substitutes:** an in-browser grade
from build-time window/lamp masks (< 0.1 s, $0, cannot move shadows — as a labelled instant placeholder or a "quick light"
mode, OQ-W8), and a per-apartment cache of the closed set (≈ $2.5 an apartment a style at NB 2.1, then instant — OQ-W2). A
night relight changes the sky through the windows — a disclosure ruling (OQ-W3).

## 6. Phases

| Phase | What | Owner (proposed) | Spend | Gate |
|---|---|---|---|---|
| **P0 — the mock** · ✅ **LIVE 2026-10-13** at `https://claude.ai/artifact/7XNAAPLe4MhKdmk85J52Rv` (private; his look pending) | a clickable static mock in `mock/walkaround/` (a small WebGL layer engine: original · your version · the incoming change, a wipe from the piece, hold-to-peek, split compare, finishes by masks in one shader pass; every change a recorded AI result played on its measured time; *Next visitor* shows a preset reused): phone buyer-in-app (B0–B12), developer link (D0–D5), desktop (X1–X6); the real `demo-01` panoramas; recorded results played on honest timers (12 · 27 · 45 s); the disclosure rails, the offered/ideas split, refusals, compare, the version tray. The mock may fake the model, prices and the queue — never the honesty of the wait or the disclosure | main session; `habait-ux-judge` (opus, fresh) | $0 | **his look** — design is a picture first |
| **P1 — the shared probe** · ✅ **DONE 2026-10-13, $2.78 of $3** (§4.1) | one recorded input set, one new ledger: lane 01's engine race (NB2.1 · Lite · klein · P-Image) + the Stage-A pipeline proof on the current code; lane 02's masks/albedo/swatch arms + whole-pano comparators; lane 03's restyle and relight bake-offs + the structure gate; every picture opened, contact sheets for his eye | `capability-scout` (sonnet) + main session | **his cap (OQ-W4)** — full ≈ $9 before overlaps, lean ≈ $2.40 | his eye on the sheets; the pass bars in lanes 01 §10 · 02 §9 · 03 §10 |
| P2 — spikes | E1 PSV mount + RTL markers · E2 patch Overlays vs today's composite (≤ 2.5/255) · E3 decal mesh · E4 mask-tint at ≥ 45 fps on his phone · E5 8K tiles on real phones | main session / `walkthrough-engineer` | $0 | kill criteria → PSV or the custom exit |
| P3 — the engine | E6–E13 + H1: the package, the chrome port, the layer/variant model, `LiveLayer`, one projection reference, transitions, the static export, the proof port, accessibility | main session / `walkthrough-engineer` | $0 | parity with today's links + paint proofs |
| P4 — server (v0.4: on `habait-walkaround`, not the app) | S1–S5 job API, server crops, acceptance + bake, budgets — as functions of the walkaround's own project; Q1 env/store checklist (his console); ~~T06a–d the tour inside Ziv's canvas~~ → board T40 ⏸ on his go (D-T360-38) | main session · `habait-deploy-qa` (the server gate) | dev tests inside the $20 | the server gate (fresh refute) |
| P5 — the looks | the build-time surface scan + finish layer (if OQ-W1 = C); the restyle/relight wrapper; variants, share, caches, fan-out, the optimistic preview | main session · `habait-be` | per the ledger | the T17 replace matrix as the regression set |
| P6 — test + ship | the device lab, the replace matrix re-run, a fresh judge, his phone walk; then **his own deploy go** per surface | `habait-deploy-qa` · `habait-ux-judge` | small | his go |

**Re-cut 2026-10-13 evening (D-T360-46) — the order of record:** **step 1 PARITY** (T10 → T11 the adapter → T15 today's page on it →
T17 → T18 → T19b deploy on his go → T19c the side-by-side + his phone) · **step 2 the fast typed change** (T12–T14, T20–T25, T32,
T36, T37) · **step 3 new features one at a time** (T16, T19, T26–T31, T33–T35), each shown only when it beats the design link.
The mock is the reference for step 3 only.

**Filed 2026-10-13 as board [`habait-walkaround`](../../development/tasks/habait-walkaround/README.md)** (42 cards, $20 hard,
D-T360-37…40): W0 prepare T00–T04 (the follow-up probe — masks IoU, he/fr, swatches, three-room style; provisioning; the
wording) · W1 = P2 T05–T10 (the spikes, the lab at `habait-walkaround.vercel.app/lab/` for his phone) · W2 = P3 T11–T19 ·
W3 = P4 T20–T25 · W4 = P5 T26–T32 · W5 = P6 T33–T39 (the deploy on his go, the old link OWED-432) · T40 ⏸ the Habait embed.

**Carried in from the closed board:** T02 (calibration `?edit=1`), T03 (upscale + web sets), T04a/T04b (the generator for a
new apartment) and T06 (the tour inside Ziv's canvas) — T06 is the board's T40 ⏸; T02–T04b stay out of this board (one
apartment, OQ-W9); the IKEA catalog code stays in the tree, off.
**Sized by lane 05:** ≈ 30 cards for P2–P5 (17 needed whatever the viewer), plus the mock, the probe and the looks.

## 7. Rails

- **Disclosure (root `CLAUDE.md` §6):** the הדמיה badge, the concept line and the AI note on every scene, every variant, every
  shared image; wording is his. Finishes, a night sky through a window and "empty the room" touch the add-only rule — his
  rulings (OQ-W3), never sub-decisions.
- **Spend:** every paid call reserved and settled in a ledger with a hard cap; the probe gets its own cap; budgets per user and
  per link before any public traffic. The vendor's balance is the real cap — a canary before any demo.
- **Keys:** names only (`FAL_KEY`, `OPENROUTER_API_KEY`, Blob, proposed `TOUR_*` budgets and the share-token secret); env and
  store acts are his console.
- **Machine:** every heavy run under `timeout`, foreground, one at a time; never touch a running tour host without reading its
  parent process.
- **Deploys:** only the project `habait-walkaround` (D-T360-38), from a staged scratchpad copy, his own go per deploy (board
  T09 the lab, T36 the site); the Habait production project untouched; the two existing public links stay as they are until
  OWED-432 (board T39).
- **Access (D-T360-40):** the view open; anything generated behind the unlock code `WALK_EDIT_CODE`, $5 a day, inside the $20.
- **Proof:** a generated picture is right only when a person has looked at it.

## 8. Open questions

| # | Question | Owner |
|---|---|---|
| ~~OQ-W1~~ | ~~May "live" mean the material generated live, its application deterministic?~~ — **RULED D-T360-33: yes** | Slava ✓ |
| OQ-W2 | ~~Reuse a preset look for the next visitor?~~ — **RULED D-T360-33: yes.** Still open: pre-filling the presets at publish time (not live) | Slava |
| OQ-W3 | ~~Finishes and the light through windows?~~ — **RULED D-T360-34: yes, framed as an option; the wording his.** Still open: the exact he/en/fr wording (drafted for his sign-off) and "empty the room" | Slava |
| ~~OQ-W4~~ | ~~The probe cap~~ — **RULED D-T360-35: lean, cap $3, a new ledger** | Slava ✓ |
| OQ-W5 | Who pays for live changes on a developer's link — the developer's credits, Habait, a per-link budget? — **for the build: Habait, inside the $20, behind the code (D-T360-39/40)**; real developer traffic still open | Slava |
| OQ-W6 | Free text on a public developer link: on, quota'd, or off? — **for now behind the code with every other paid change (D-T360-40)** | Slava |
| OQ-W7 | May Ziv trigger a paid change by tool call ("make the walls sage"), or only open the tour? — rides the Habait embed (board T40 ⏸) | Slava |
| OQ-W8 | The in-browser light grade: an instant labelled placeholder, a "quick light" mode, or not at all? | Slava |
| OQ-W9 | Which source makes developers' tours: AI panoramas like `demo-01`, the Blender CG pipeline, or the developer's own renders? | Slava |
| OQ-W10 | Does the developer supply real options and prices in v1 (the Offered layer), or ideas only? | Slava |
| OQ-W11 | Buyer sharing of a version (TU-56 "nothing sent to anyone") — in v1, or developer links only? | Slava |
| OQ-W12 | Model rights chains for every editor the live path may route to (Muse, NB2.1 through fal, klein, Pruna; the OWED-047 family) | research → Slava |
| OQ-W13 | The US patent (US 9,190,016 B2) and the non-commercial training data behind layout/segmentation weights — with the B1 lawyer pass (OWED-003) | Slava + counsel |
| OQ-W14 | Which project and unit `demo-01`'s plan belongs to (the old OQ-1) — the mock and any demo keep it an unattributed sample | Slava |

| Document control | |
|---|---|
| Author | main session (Opus 5.5), 2026-10-13, from the five research lanes (capability-scout ×3, general-purpose ×2, all sonnet) |
| Version | v0.1 DRAFT (2026-10-13) · v0.2 (2026-10-13): his D-T360-33…36 — live then instant, permanent features as an option, the lean probe at $3, the mock and the probe together · v0.3 (2026-10-13): §4.1 the probe measured ($2.78 of $3); P0 the mock LIVE for his look, P1 done · v0.4 (2026-10-13): his D-T360-37…40 — the board filed over the WIP ceiling, its own Vercel project `habait-walkaround` (§3 Jobs · Storage · Caps · Hosts rewritten; the Habait embed deferred), $20 hard, the view open and changes by code; §6 the board map; §7 deploy + access; OQ-W5/W6/W7 narrowed · **v0.5 (2026-10-13 evening): D-T360-46 parity first — the board re-cut into three steps** |
| Inputs | D-T360-29…36; `research/live-walkaround/01`–`05`; the capability record; `qa-evidence/tour360/T17/REPORT.md`, `T18/REGION.md` |
| Next | the board `habait-walkaround`: T01 the follow-up probe ∥ his two questions (T02 the store, T04 the wording) → the spikes T05–T08 → the lab on his phone (T09, his deploy go) → the verdict T10 → the engine and the server |

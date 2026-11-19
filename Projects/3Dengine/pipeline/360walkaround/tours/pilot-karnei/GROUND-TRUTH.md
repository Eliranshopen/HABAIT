# `pilot-karnei` — GROUND TRUTH

**What this file is.** The measurement targets T14 asserts the finished tour's ruler against, each with
its **true value in centimetres** and **where that number came from**. It is written **before** anything
is rendered, by the same task that produced the trace, so nobody can later choose the targets that
happen to pass.

⛔ **CONTRACT C-360-88 governs how this is reported.** The ±2 % bar validates the chain
**render → depth-pack → decode → ruler against the traced plan**. It is **blind to the trace itself**
for every `FITTED` row, because the trace and those rows share one source. That is why this table has a
**`class`** column and **9 `HELD-OUT` rows** — numbers the scale was *not* fitted to and no wall was
placed from. ⛔ *Wherever the bar is reported, its population is named as "the render/depth/ruler chain
against the traced plan" — never as "measurement accuracy" unqualified.*

⛔ **Nothing in this file is a statement about a built unit.** These are the dimensions of a **drawing**.
A disagreement between the drawing and the flat somebody eventually stands in is **outside this bar
entirely** and is DS-9's job, not T14's (C-360-88 (c), CONTRACT §16.8).

---

## 1. The pilot, and why this plan

**OQ-V2-5's default is "the smallest fully-dimensioned Karnei plan, and T02 records which and why."**

| File | Unit | Floor | Marketed | Every enclosed room printed W/D? |
|---|---|---|---|---|
| `apt-1.jpg` | Apartment 1 | entrance | 129 m² | yes |
| `apt-2.jpg` | Apartment 2 | entrance | 122 m² | yes |
| `apt-3.jpg` | Apartment 3 | 1 | 134 m² | yes |
| `apt-4.jpg` | Apartment 4 | 1 | 123 m² | yes |
| `apt-5.jpg` | Apartment 5 | 2 | 132 m² | yes |
| **`apt-6.jpg`** | **Apartment 6 (דירה 6, "דגם עולה")** | **2** | **111 m²** | **yes — CHOSEN** |
| `apt-7-*.jpg` | Apartment 7 (duplex) | 3 + 4 | 97 + 65 m² | yes, per floor |
| `apt-8-*.jpg` | Apartment 8 (duplex) | 3 + 4 | 97* + 65 m² | yes, per floor |
| `semi-detached-*.jpg` | semi-detached house | 3 levels | 318 m² | different drawing style (English labels, dimension ticks) |

**Chosen: `apt-6.jpg` — the smallest *self-contained, single-floor, fully-dimensioned* apartment.**

⚠ **The runner-up is numerically smaller and was rejected on purpose, so the reasoning is on the record.**
Apartment 7/8 **floor 4** is **65 m²** — but it is *half of a duplex*: it has an **open stair void**
(an unbounded hole in the floor plate the scene build would have to invent a rule for), only **three
interior spaces**, and exactly **one interior door**, so a tour of it could not exercise the derived
room graph, the minimap or the door-to-door walk that S-V2-1 defines as parity. **A smaller number is
not a smaller pilot.**

`apt-6.jpg` is also the **larger raster** of the two available versions — 1600 × 1600 vs `apt-6-en.jpg`'s
1600 × 900 — i.e. ~2.8× the plan area in pixels. Only the left-hand title block differs between them;
the room labels are Hebrew in both. **The trace is from `apt-6.jpg`**, sha256
`532e9dc53ce101fbdae45f8d7310220120f476e121180f35e1efce1e7a1360c9`.

⛔ **The drawing is a read-only partner-supplied input** under `Habait/MVP/app/public/projects/karnei-plans/`.
Nothing in this board writes to that tree. `plan_meta.rights_state` = **`partner-supplied`**; what a CG
tour derived from it may be shown to is **OQ-360-11**, Slava's (CONTRACT A8-13).

## 2. How the metric scale was obtained

Every wall face was measured by **subpixel luminance-crossing edge detection** on the source raster
(threshold 166 = midway between the wall fill's 108 and the floor's ~225), not by eye. The scale is a
**least-squares fit through the origin on FOUR printed dimensions only**:

| Fitted number | printed cm | measured px | px/cm |
|---|---|---|---|
| ממ"ד width | 280 | 292.25 | 1.04375 |
| ממ"ד depth | 330 | 344.50 | 1.04394 |
| שירותים width | 125 | 131.20 | 1.04960 |
| שירותים depth | 165 | 173.00 | 1.04848 |
| **fit** | | | **1.04480 px/cm** (0.957 cm/px) |

Two rooms, both axes, opposite ends of the plan. ⛔ **Every other printed number on the drawing was
withheld from the fit** — that is what makes the rest of this table evidence rather than tautology.

**Global sanity check, independent of every row below:** the traced indoor rooms sum to **94.14 m²** of
clear floor and the traced indoor wall footprints to **19.14 m²**, i.e. a gross **113.3 m²** against the
drawing's own marketed **111 m²** — **+2.1 %**. ⚠ Israeli marketed area conventions vary in how much of
an external wall they count, so this is a *sanity* check on the scale and the envelope, not a fifth
fitted number.

## 3. The measurement targets

`class`: **FITTED** = the scale was fitted to it (C-360-88: the bar is blind to a tracing error here) ·
**HELD-OUT** = printed on the drawing, withheld from the fit, no wall placed from it — a tracing error
shows up here · **CIRCULAR** = the geometry was placed *from* this number, so it can never disagree ·
**DRAWN** = no printed number exists; the truth is the trace itself at the fitted scale (a check that the
render/ruler reproduces the model, not that the model is right) · **CONFLICT** = printed and drawn
disagree by more than the tolerance; ⛔ **excluded from the ±2 % population**.

| # | Segment | True cm | Source | class | Traced cm | Δ |
|---|---|---|---|---|---|---|
| GT-01 | ממ"ד, interior width (E–W) | **280** | printed on the drawing | FITTED | 279.7 | −0.3 (0.11 %) |
| GT-02 | ממ"ד, interior depth (N–S) | **330** | printed on the drawing | FITTED | 329.6 | −0.4 (0.12 %) |
| GT-03 | שירותים (toilet), interior width | **125** | printed | FITTED | 125.5 | +0.5 (0.40 %) |
| GT-04 | שירותים, interior depth | **165** | printed | FITTED | 165.6 | +0.6 (0.36 %) |
| GT-05 | חדר שינה (bedroom), interior width | **297** | printed | **HELD-OUT** | 297.0 | +0.0 (0.00 %) |
| GT-06 | חדר שינה, interior depth | **305** | printed | **HELD-OUT** | 305.6 | +0.6 (0.20 %) |
| GT-07 | חדר שינה הורים (master), interior width | **299** | printed | **HELD-OUT** | 299.5 | +0.5 (0.17 %) |
| GT-08 | חדר שינה הורים, interior depth | **395** | printed | **HELD-OUT** | 394.7 | −0.3 (0.08 %) |
| GT-09 | חדר רחצה הורים (en-suite), interior width | **135** | printed | **HELD-OUT** | 136.3 | +1.3 (0.96 %) |
| GT-10 | חדר רחצה הורים, interior depth | **235** | printed | **HELD-OUT** | 235.6 | +0.6 (0.26 %) |
| GT-11 | חדר רחצה (main bathroom), interior width | **345** | printed | **HELD-OUT** | 345.9 | +0.9 (0.26 %) |
| GT-12 | מטבח (kitchen), zone width (E–W) | **278** | printed | **HELD-OUT** | 277.4 | −0.6 (0.22 %) |
| GT-13 | **master bedroom interior DIAGONAL** | **495.4** | √(299² + 395²), both printed and both held out — **non-axis-aligned**, so it exercises the depth chain off-grid | **HELD-OUT** | 495.5 | +0.1 (0.01 %) |
| GT-14 | **cross-room span: ממ"ד north face → bedroom south face** (two rooms + one wall) | **657.9** | 330 (printed, held out) + 22.9 (traced wall thickness — the only trace-derived term, 3.5 % of the total) + 305 (printed, held out) | **HELD-OUT** | 658.1 | +0.2 (0.03 %) |
| GT-15 | North balcony, floor **area** (L-shaped) | **9.0 m²** | printed in the drawing's legend | **HELD-OUT** | 9.223 m² | +0.223 (2.5 %) |
| GT-16 | South balcony, floor **area** | **8.0 m²** | printed in the drawing's legend | **HELD-OUT** | 8.172 m² | +0.172 (2.1 %) |
| GT-17 | חדר מגורים (living), zone depth (N–S) | **428** | printed | **HELD-OUT** | 428.9 | +0.9 (0.21 %) |
| GT-18 | מטבח, zone depth (N–S) | 362 | printed — ⛔ **the kitchen's north boundary was PLACED from this number** (no drawn line exists) | **CIRCULAR** | 362.0 | 0.0 by construction |
| GT-19 | חדר מגורים, zone width (E–W) | 368 | printed; the west boundary is the hall east wall's face extended south — a **drawn** line, not this number | **HELD-OUT** | 370.6 | +2.6 (0.71 %) |
| GT-20 | Entrance door, clear width | 96.7 | drawing only (no printed dimension) | DRAWN | 96.7 | — |
| GT-21 | ממ"ד door, clear width | 77.2 | drawing only | DRAWN | 77.2 | — |
| GT-22 | North-balcony door, clear width | 96.5 | drawing only | DRAWN | 96.5 | — |
| GT-23 | South-balcony sliding door, clear width | 237.4 | drawing only | DRAWN | 237.4 | — |
| **GT-24** | **חדר רחצה (main bathroom), interior depth** | **printed 185 · drawn 175.6** | printed | ⛔ **CONFLICT** | 175.6 | **−9.4 (5.08 %)** |

**Suggested T14 population:** GT-05 … GT-17 and GT-19 (**14 rows, all HELD-OUT**) against the ±2 % bar,
with GT-13 and GT-14 called out separately as the **non-axis-aligned** and the **cross-room** targets
C-360-88 (b) requires. GT-01…GT-04 are reported as FITTED (blind by construction), GT-18 as CIRCULAR,
GT-20…GT-23 as DRAWN, and GT-24 is **excluded** with the reason quoted.

## 4. GT-24 — the one conflict, and why the drawing was kept

The drawing prints **345/185** for the main bathroom. At the fitted scale the width measures **345.9 cm**
(0.26 % — one of the better agreements on the plan) and the depth measures **175.6 cm** — **9.4 cm short**.

The bathroom's south wall **is** the ממ"ד's north wall. The whole west N–S chain reads, at the fitted
scale: north wall inner face → bathroom **175.6** → wall 32.7 → ממ"ד **329.6** (printed 330) → wall 22.9 →
bedroom **305.6** (printed 305) → wall 12.7 → master **394.7** (printed 395) → south wall inner face.
⇒ **Honouring the printed 185 means moving one wall 9.4 cm, and that wall is shared with three rooms whose
printed dimensions the drawing already satisfies to within 0.6 cm.** One printed number cannot be honoured
without falsifying three others.

⇒ **Resolution: the drawing's geometry is kept; the printed number is recorded, in `plan.json` at
`plan_meta.disagreements[0]` and here.** ⛔ The validator will not accept the file unless that entry
exists — remove it and `validate-plan.mjs` exits non-zero (mutant M16). ⭐ *A conflict that is averaged
away is a conflict nobody can find later.*

⚠ **Not ruled out and not investigated further:** the printed pair `345/185` is repeated verbatim on
`apt-5.jpg`, so it may be a module label carried between units rather than a measurement of this room.
That is a question for the developer, not for this trace.

## 5. What is NOT from the drawing at all

⛔ These are **assumptions**, carried in `plan_meta.assumptions[]` so no downstream reader mistakes them
for traced facts. A plan drawing has no section and no heights.

| Assumed | Value | Why |
|---|---|---|
| Ceiling height | **260 cm** | not printed anywhere; a common Israeli new-build gross height. ⚠ T03/T06 should confirm before it becomes a rendered vertical dimension a ruler can measure |
| Balcony/service parapet height | **110 cm** | not printed |
| Window sill and head heights | per opening | not printed — a plan shows a window's *width*, never its height |
| Camera eye height | **140 cm** | ported from the reference product (`research/walkaround-reference/REPORT.md` §2.1), not from this drawing |
| Outdoor rooms carry **no** camera point | — | the same reference's product rule (REPORT §2.1), enforced by the validator |

## 6. Reproducing the trace

```
node pipeline/validate-plan.mjs tours/pilot-karnei/plan.json      # exit 0
```

The instrument that produced `plan.json` (the subpixel edge detector, the wall-face table, the overlay
paint proof) and the validator's falsification battery are committed as evidence under
`qa-evidence/360-v2/t02/`, not under `pipeline/` — they are this task's record, not pipeline tooling
(CONTRACT §16.4 keeps `pipeline/*.py` with `render-pipeline-engineer`).

**Look at `qa-evidence/360-v2/t02/trace-overlay.png` before trusting any number here.** It is the traced
model painted back over the source drawing at 2×: every room polygon filled, every wall rectangle
outlined, every opening marked, every camera point dotted. A trace that has drifted is visible in one
glance; a table of deltas is not.

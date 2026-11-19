# `plan.json` — the traced vector floor plan (schema v0.1.0)

**Status:** NORMATIVE for board `360-v2`. **Owner of this file:** `walkthrough-engineer`
(CONTRACT §16.4 / **C-360-80**). **Contract class:** one of the four **shared file contracts**
(**C-360-81**) — it crosses the boundary trace → scene build → assembly. It may be **EXTENDED** by its
owner (a new optional field, a new enum member added at the end); it may **not be RESHAPED** (a renamed
or retyped existing field, a moved path, a changed unit) except on-board, with a written note in both
affected task files, or by amendment if those tasks are closed. **⛔ Never silently.**
**Enforcement point:** [`validate-plan.mjs`](validate-plan.mjs) (this task, T02).
**RED mutant:** rename one required field in a fixture ⇒ the validator exits non-zero.

**Units are part of the shape (C-360-81).** `plan.json` is **centimetres**, everywhere, always. Angles
are degrees. Areas in `area_m2` are **square metres** (the one deliberate exception, named here so it
cannot surprise anyone; the validator checks it against the cm geometry). Depth PNGs decode to **metres**
(CONTRACT §16.5 / C-360-82) — a different file, a different unit, and the two never mix.

---

## 1. Frame of reference

```
   +x  ──────────────►   right on the drawing
 (0,0) ┌───────────────
   │   │
   │   │
   ▼   │
  +y   ▼  down on the drawing
```

- **Origin `(0,0)`** = the **outer NW corner of the building envelope** on the source drawing.
- **`x`** grows to the right, **`y`** grows **downward** — i.e. the raster convention, so a reader can
  put `plan.json` and the source JPEG side by side without a sign flip. `axes` is a required string
  field that says this in the file itself.
- **`yaw_deg`** is a bearing in this same frame: **0° looks toward −y** (up on the drawing), **90°
  toward +x** (right), increasing **clockwise**, range `[0, 360)`.
- ⚠ **This is a left-handed 2-D frame.** A scene builder mapping it into a Z-up right-handed 3-D world
  must flip: the recommended mapping is `world_x = x/100`, `world_y = −y/100`, `world_z = height/100`
  (metres), which turns +y-down into +Y-north and preserves handedness. ⛔ **The actual transform is
  `render-pipeline-engineer`'s to own and to state in T03**; this note is informative, not a claim
  about their file. The one thing this schema does bind is that **`plan.json` itself never carries a
  3-D coordinate.**

## 2. Top-level shape

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | `"MAJOR.MINOR.PATCH"` | ✔ | `0.1.0` today. An EXTEND bumps MINOR, a RESHAPE bumps MAJOR and needs the on-board note |
| `units` | `"cm"` | ✔ | the only legal value in v0 |
| `axes` | string | ✔ | the §1 sentence, carried in-band |
| `apartment_id` | lowercase-kebab | ✔ | stable; ⚠ a rename invalidates every downstream manifest input hash (**C-360-77**) |
| `plan_meta` | object | ✔ | §3 |
| `rooms[]` | array | ✔ | §4 |
| `walls[]` | array | ✔ | §5 |
| `openings[]` | array | ✔ | §6 |
| `camera_points[]` | array | ✔ | §7 |
| `fixtures[]` (new, card Q02b) | – | the furniture the sales plan DRAWS, as plain placeholder masses: `id`, `room_id`, `kind` (`counter` | `tall_unit` | `island` | `table` | `sofa` | `tv_unit` | `bed` | `bedside` | `wardrobe` | `vanity` | `shower` | `wc` | `lounger`), `polygon_cm` (a simple loop, positively oriented), `z_cm` (base, default 0), `height_cm` (the EXTENT above `z_cm`: top = z + height); the tracer keeps the hand-read box (`centre_cm`, `angle_deg`, `size_cm`) beside the loop. The builder extrudes each as a prism in a matte light-grey placeholder material distinct from the walls (no catalog model, no boolean); the skin lane names each block by kind and bearing. Validator V13: kind in the enum, room known, corners inside the room (warn), 0 <= z, z + height <= ceiling |

All `id` values are unique **across the whole file**, not merely within their array.

## 3. `plan_meta` — provenance, and the fields that are contract terms

**A8-13 / C-360-85** makes five of these binding: `source_file`, `tracer`, `trace_date`,
`scale_basis`, `rights_state`. The validator requires all five non-empty and `rights_state` in the
closed set — **delete `plan_meta.rights_state` from a fixture and the validator exits non-zero.**

| Field | Type | Required | Notes |
|---|---|---|---|
| `source_file` | repo-relative path | ✔ | the drawing the whole tour is derived from |
| `source_sha256` | hex64 | ✔ | pins the exact raster; a re-issued drawing is a new trace |
| `source_label_he` / `project` / `unit_label` | string | – | what the drawing says about itself |
| `tracer` | string | ✔ | who/what produced the trace |
| `trace_date` | `YYYY-MM-DD` | ✔ | |
| `trace_method` | string | ✔ | how the numbers were obtained, in one sentence |
| `scale_basis` | string | ✔ | ⛔ must name **which printed dimensions the scale was fitted to** — see §8 |
| `scale_px_per_cm` | number > 0 | ✔ | |
| `raster_origin_px` | `[x, y]` | ✔ | the source-pixel coordinates of plan `(0,0)` — makes the trace re-checkable against the JPEG |
| `rights_state` | `own` \| `licensed` \| `partner-supplied` \| `unrecorded` | ✔ | **closed set.** ⛔ A tour whose `rights_state` reads `unrecorded` is **never exposed to anyone** and is flagged at the gate (A8-13) |
| `rights_note` | string | – | what the state means downstream, and who holds the open question |
| `ceiling_height_cm` | number > 0 | ✔ | see `assumptions` — a plan drawing has no section |
| `assumptions[]` | string[] | ✔ | every number in the file that is **not** on the drawing. ⛔ May be empty only if there are genuinely none |
| `disagreements[]` | object[] | ✔ | §8. May be empty |
| `virtual_boundaries[]` | string[] | – | prose: which room boundaries are not drawn lines |

## 4. `rooms[]`

| Field | Type | Notes |
|---|---|---|
| `id` | `r-…` | |
| `name_he`, `name_en` | string | Hebrew is the drawing's own label |
| `type` | enum | `living` `kitchen` `bedroom` `safe_room` `bathroom` `toilet` `hall` `corridor` `balcony` `service_balcony` `storage` `other` |
| `is_outdoor` | bool | balconies and the service balcony are `true` |
| `loop` | `[[x,y], …]` | the **interior-face** polygon, ≥ 4 points, **rectilinear** (every edge horizontal or vertical), simple, **not** repeating the first point at the end |
| `printed_dims_cm` | `[w, d]` or `null` | ⛔ **exactly as printed on the drawing**, never a measured value |
| `clear_dims_cm` | `[w, d]` | the loop's bounding box — for a rectangular room this *is* the clear dimension |
| `bbox_cm` | `[x0,y0,x1,y1]` | derived, carried so a consumer needn't recompute |
| `area_m2` | number | the loop's shoelace area. The validator recomputes it **twice**, by shoelace and by rectilinear band decomposition, and both must agree with this field to **5 %** |
| `note` | string | – |

⛔ **Room polygons do not overlap.** The validator proves this exactly (band decomposition, not
sampling). Rooms need not tile the envelope — walls occupy the gaps.

## 5. `walls[]`

A wall is an **axis-aligned rectangle footprint**, not a centreline. That choice is deliberate: this
plan has five different wall thicknesses (a 33 cm reinforced MAMAD wall next to a 13 cm partition), and
a centreline model would need a mitring rule at every junction of unequal thickness to recover the
interior face — which is the one number the ruler measures.

| Field | Type | Notes |
|---|---|---|
| `id` | `w-…` (real) or `v-…` (virtual) | |
| `rect_cm` | `[x0,y0,x1,y1]`, `x0 ≤ x1`, `y0 ≤ y1` | the footprint |
| `kind` | `exterior` \| `interior` \| `parapet` \| `virtual` | |
| `height_cm` | number ≥ 0 | `parapet` ≈ 110, `virtual` = 0 |
| `sides[]` | room ids and/or the literal `"outside"` | every room this wall bounds, in any order |

- A **`virtual`** wall is a zero-thickness boundary between two open-plan zones. It has **no geometry**:
  ⛔ the scene builder must skip it, and the tour graph treats it as a permanently-open edge.
  A virtual wall is degenerate in exactly one axis (`x0 == x1` or `y0 == y1`).
- A **`parapet`** is a balcony railing/screen: real geometry, `height_cm` well below the ceiling.
- `sides[]` may list **more than two** rooms for a long wall that runs past several of them. It is a
  containment list, not a pair. ⛔ **The room graph is NOT derived from it** — see §6.
- ⭐ **A wall rectangle has FOUR faces and any of them can bound a room** — its two long faces *and* its
  two **end** faces. This plan's free-standing corridor partition, the kitchen wall's north cap and the
  ממ"ד south wall's east end are all room boundaries made of wall **end grain**. The validator's V9
  coverage check tests all four; the first version tested only the two long faces and threw fifteen
  false FAILs on a correct trace.
- ⚠ **Wall footprints may overlap each other at a corner junction** (e.g. the north exterior wall and the
  north balcony's west wall share a 3.1 × 25.4 cm corner). That is normal in a footprint model and is
  **not** checked. Room polygons, by contrast, may **never** overlap.

## 6. `openings[]` — doors, cased openings and windows

⭐ **The room graph is derived from `openings[].rooms`, explicitly — not by reverse-indexing walls.**
The reference product reverse-indexes `doors[].Walls[]` against `rooms[].Walls[]` at runtime
(`research/walkaround-reference/REPORT.md` §2.3). That works there because every wall separates exactly
two rooms. It does **not** work here, because §5's walls are footprints that can run past three or four
rooms. Recording the pair on the opening is one field instead of an inference, and it cannot be wrong
in a way a test can't see.

| Field | Type | Notes |
|---|---|---|
| `id` | `d-…` (door) / `o-…` (opening) / `win-…` (window) | |
| `kind` | `door` \| `entrance_door` \| `sliding_door` \| `glazed_door` \| `opening` \| `window` | |
| `wall_id` | wall id | the wall it pierces |
| `axis` | `"x"` \| `"y"` | which coordinate `start_cm`/`end_cm` are measured along; must match the wall's long axis (for a virtual wall, its non-degenerate axis) |
| `start_cm`, `end_cm`, `width_cm` | numbers | `end > start`, `width == end − start`, and the span lies **within** the wall's extent |
| `sill_cm`, `head_cm` | numbers | above finished floor; `0 ≤ sill < head ≤ wall.height_cm` |
| `rooms` | exactly **2** entries, room ids and/or `"outside"` | ⛔ **this pair IS the graph edge.** Both entries must appear in the wall's `sides[]` |
| `note` | string | – |

**Graph rule for T08:** an edge exists between rooms `A` and `B` iff some opening lists exactly
`{A, B}` in `rooms`. An opening whose `rooms` contains `"outside"` is the front door or a window —
⛔ it is never a tour edge. `kind: "window"` is never a tour edge either, even between two rooms.

## 7. `camera_points[]`

| Field | Type | Notes |
|---|---|---|
| `id` | `cp-…` | |
| `room_id` | room id | ⛔ the point must lie **inside** that room's polygon (validator-enforced) |
| `x`, `y` | cm | plan frame |
| `z` | cm | eye height above finished floor; `0 < z < ceiling_height_cm` |
| `yaw_deg` | `[0,360)` | §1's bearing; the **seed** yaw for the first pano only — the viewer preserves the user's pose across a swap (M-360-5 / REPORT §2.3) |
| `note` | string | – |

⛔ **A room with `is_outdoor: true` carries no camera point.** That is a product rule ported verbatim
from the reference (REPORT §2.1: balconies and terraces get zero points, reproduced identically on both
of its units) — look-only outdoor spaces. The validator enforces it.

⚠ **T06 may replace this array wholesale** with auto-placed points. That is an EXTEND of the *data*,
not a reshape of the *schema*: the fields do not change. If T06 needs a new field (a coverage score,
a room-relative index) it appends one and says so in its task file.

## 8. Scale, printed numbers, and the two ways they can disagree

The trace is metric because of one number, `scale_px_per_cm`, and that number must be **fitted to a
named subset of the drawing's printed dimensions**, never to all of them. `scale_basis` records which.
Everything not in the fit is then an **independent check** on the trace, which is the only reason the
±2 % bar at T14 can catch a tracing error at all (**C-360-88**).

Two failure shapes, handled differently and both visible:

1. **`|clear − printed| ≤ 5 %`** → the traced geometry stands as measured. The residual is reported by
   the validator and by `GROUND-TRUTH.md`; nothing is snapped, because snapping a room to its printed
   number moves a wall that a *neighbouring* room's printed number also depends on.
2. **`|clear − printed| > 5 %`** → the validator **FAILS** unless the room appears in
   `plan_meta.disagreements[]` with `printed_cm`, `traced_cm`, `delta_cm`, `axis`, `resolution` and
   `why`. ⭐ *The printed number wins in the record; the drawing wins in the geometry only where
   honouring the printed number would contradict another printed number the drawing already satisfies —
   and that argument has to be written down before the file will validate.*
   ⛔ A room listed in `disagreements[]` is **excluded from the T14 measurement-accuracy population**
   and the exclusion is stated wherever the bar is reported (C-360-88 (a)).

⛔ **An open-plan zone whose boundary is set FROM a printed dimension can never be used as ruler ground
truth** — its clear dimension equals the printed one by construction, so the comparison is circular.
`plan_meta.virtual_boundaries[]` names every such boundary and `GROUND-TRUTH.md` marks those rows
`CIRCULAR`.

## 9. What the validator checks (and what it deliberately does not)

`node pipeline/validate-plan.mjs <plan.json> [--json]` — exit **0** clean, **1** on any FAIL, **2** on a
usage/parse error. Warnings never change the exit code.

Checked: required fields and types · `units == "cm"` · id uniqueness · `rights_state` in the closed set
and the five A8-13 fields non-empty · rectilinear, simple, non-self-intersecting, positively-oriented
room loops · `area_m2` against **two independent** area computations · `clear_dims_cm`/`bbox_cm` against
the loop · printed-vs-clear deltas with the `disagreements[]` escape · **no room–room overlap**
(exact, by band decomposition) · every room loop edge **covered by a face of a wall that lists that
room** · wall rectangles ordered, non-degenerate (except `virtual`), enum-legal · opening axis/extent/
sill/head/rooms against its wall · camera points inside their room, below the ceiling, and **never in an
outdoor room**.

⛔ **Not checked, on purpose:** whether the trace matches the *drawing* (no computer vision here — that
is what `GROUND-TRUTH.md` and T14 are for), whether the ceiling height is right (it is an assumption,
§3), and whether the room graph is connected (T08's job — a plan may legitimately be validated before
its graph is derived).

## 9a. General geometry — the v0.2.0 EXTEND (`geometry: "general"`, ruled D-WQ-28 on 2026-10-28)

A plan that declares a top-level `"geometry": "general"` (or `plan_meta.geometry`) is validated by
`validate-plan-general.mjs` (reached through `validate-plan.mjs`, which delegates and otherwise runs the
v0.1.0 path unchanged). The occasion: apartment 846 (Rainbow Tel Aviv) is a fan-shaped tower unit whose
two wall families meet at about 96°, with a curved glass façade and two diagonal walls — nothing in §4–§6
can hold it. This is an EXTEND (new optional shapes behind a flag), not a RESHAPE: every v0.1.0 file
validates and builds exactly as before. The first consumer is `Habait/tour360/apartments/apt846/plan.general.json`,
produced by `Habait/tour360/tools/trace-plan.mjs` from the drawing's raster.

What changes under the flag:

| Field | v0.1.0 | general |
|---|---|---|
| `rooms[].loop` | rectilinear, ≥ 4 points | **any simple polygon**, ≥ 3 points, positively oriented (shoelace > 0 in the y-down frame), no repeated first point; `area_m2` against the shoelace only (no band decomposition); `bbox_cm` derived |
| `rooms[].edge_kinds[]` | – | optional, one entry per loop edge: `wall` \| `line` \| `open` — `open` marks a virtual zone boundary (no structure there); informative for the builder's skirting and the coverage check |
| `rooms[].printed_dims_cm` | the printed w×d against the bbox | the bbox of a skewed room is not its clear size — a > 5 % difference needs a `disagreements[]` row, as in §8 |
| `walls[]` | `rect_cm` | **`polygon_cm`** (a simple polygon the builder extrudes to `height_cm`); pieces may abut or overlap by a few cm at joints (a raster trace cuts the fill along the drawn outlines); `kind` and `sides[]` are optional |
| `openings[]` | `wall_id` + `axis` + `start_cm`/`end_cm` | an **oriented segment**: `a_cm`, `b_cm`, `centre_cm`, `angle_deg` (degrees from +x in the raster frame), `width_cm` = \|b − a\| ± 2, `sill_cm`, `head_cm`, `rooms[2]` (ids or `"outside"`), `kind` from the same enum. A `kind: "opening"` whose head is the ceiling is a **virtual boundary** between open-plan zones: nothing is built and nothing is cut. A door is snapped onto the wall line by the tracer; the builder cuts it with an oriented box |
| `panes[]` (new) | – | thin glazing polygons: `kind` `facade` (floor to ceiling) \| `railing` (`head_cm` ≈ 110), `polygon_cm`, `sill_cm`, `head_cm`; a pane inside a door's cutter is cut away |
| `camera_points[]` | never in an outdoor room | **may sit in an outdoor room** (a roofed terrace on a tower floor); the validator notes it instead of failing |
| coverage (V9) | every loop edge covered by a wall face | every loop edge (its mid and quarter points) within **15 cm** of a wall polygon, a pane or an opening segment, unless its `edge_kinds` entry is `open`; a miss is a warning (a raster trace follows the barrier, so a miss means a drawing gap, not a schema error) |
| overlap (V7) | exact band decomposition | triangulated clipping (ear clipping + Sutherland–Hodgman): > 0.10 m² warns, > 0.50 m² fails |

The frame, the units, `plan_meta`'s five binding fields, the id rules and the exit codes are unchanged.
`raster_origin_px` is `[0, 0]` when the trace frame is the crop itself. The graph rule of §6 still holds:
an edge exists between two rooms iff an opening lists exactly that pair; a virtual boundary is a
permanently-open edge.

## 10. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-01 | First issue. Board `360-v2` T02, over `tours/pilot-karnei/plan.json`. |
| 0.2.0 (draft) | 2026-10-28 | §9a: the general-geometry EXTEND behind `geometry: "general"` — general loops, `walls[].polygon_cm`, oriented `openings[]`, `panes[]`, outdoor camera points; `validate-plan-general.mjs`. Ruled D-WQ-28 (`docs/governance/DECISIONS.md`); the contract amendment to `../CONTRACT.md` §16 is OWED-659. First consumer: apartment 846 (`Habait/tour360/apartments/apt846/plan.general.json`). Same day, card Q02b: `fixtures[]` (the drawn furniture as placeholder prisms) and validator V13. |

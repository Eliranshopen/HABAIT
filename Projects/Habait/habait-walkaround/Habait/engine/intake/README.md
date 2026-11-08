> Restored 2026-11-02 ~16:10 by habait-ab from the card 01 agent transcript: this was `Habait/engine/README.md` (written ~14:30) until card 04 overwrote that file with the CLI README. Paths below are relative to `Habait/engine/`.

# Habait engine (lane A)

Generic code that turns a developer's project files into the contracts the other lanes consume. Nothing in
here names Rainbow or 846 except the fixtures. Python: `C:\RnD\Projects\Habait\tools\habait-venv\Scripts\python.exe -I`
with `PYTHONIOENCODING=utf-8`. No paid API: the VLM steps run on the Claude Code subscription CLI.

## Files

| path | what |
|---|---|
| `schema/project.schema.json` | project.json v0 (JSON Schema 2020-12): developer, project, site (origin, plot, north_deg, bbox, OSM), building (floors, floor_to_floor_cm, ceiling, roof_top_cm, floor key, footprint, elevations), units[] (id, type, floor, files, status, price, placement), style (material board, presets, reference renders), legal (disclaimer id, rights), provenance |
| `validate_project.py` | hand-rolled validator (no `jsonschema` in the venv; used if installed) + semantic checks (unit needs a plan file, floor <= floors_total, rights). `--check-files` warns on missing paths. Exit 0/1/2 |
| `fixtures/rainbow-846.project.json` | the real project built from the real files (paths relative to `fixtures/`) |
| `fixtures/demo-simple.project.json` | an invented 3-unit project; proves the schema is not Rainbow-shaped |
| `intake/intake_raster.py` | A1: sales-plan PDF -> `plan.json` + `report.json` / `report.md` (see below) |
| `intake/rasterize.py` | pymupdf 288 dpi raster, auto-crop of the unit drawing, VLM-size copies and 2x2 zoom tiles |
| `intake/vlm.py`, `intake/vlm_prompt.md` | VLM pass 1: room names/types, printed dimensions, unit table, notes (strict JSON). Backends: `claude` (default, `claude -p --model opus --allowedTools Read`), `file:<reply>` (replay), `none` |
| `intake/assign_prompt.md` | VLM pass 2: names the traced regions on the numbered overlay, lists rooms the tracer missed |
| `intake/tracer_cv.py` | OpenCV port of the studio's `trace-rooms.mjs`: walls from the grey fill, glazing from double strokes, rooms by distance-transform watershed, label-seeded zone splits, openings from basin contacts, dimension lines by the digits at their midpoint |
| `intake/intake_pdf_vector.py` | A3 (card 06): a VECTOR sales-plan PDF -> the same `plan.json` + `report.json` / `report.md` + `plan-crop.png`, no VLM, no raster tracing (section "Vector intake" below). Its `assemble()` is the geometry half shared by the DXF and IFC readers |
| `intake/vector_common.py` | shared vector core: pymupdf primitives with the clip stack and OCG layers, the layer map, the dimension parser (lines + ticks + stroke-font digits decoded by glyph-shape clustering), the outlined-label decoder |
| `intake/intake_dwg.py` | A3: DXF (ezdxf; DWG through the ODA File Converter when installed) -> the same outputs. TEXT/MTEXT labels, DIMENSION entities, door blocks, room-boundary polylines |
| `intake/intake_ifc.py` | A3: IFC (IfcOpenShell 0.9.0.post1, installed in habait-venv 2026-11-02) -> the same outputs. IfcSpace rooms, IfcWall/IfcColumn poche, IfcWindow/IfcRailing/IfcDoor |
| `intake/layer_maps/dblk.json` | layer map of one architect office (CAD layer regex -> wall_fill / wall_line / window / door / railing / dimension / text / ...), AIA fallbacks; one map serves PDF OCG names and DXF layer names |
| `intake/lexicon_he.json` | Hebrew room names of Israeli sales sheets (he / en / type); the vector readers name rooms against it, no VLM |
| `intake/fixtures/sample.dxf`, `sample.ifc`, `sample.layers.json`, `make_sample_dxf.py`, `make_sample_ifc.py` | SYNTHETIC test models generated from the 846 ground-truth plan (no licensed public apartment DXF/IFC was fetchable without a browser); AIA layer names, so the layer map is really exercised |
| `building.py` | A4 (card 03): building mass + a 3D box per unit from project.json -> `_local/rainbow/units.json`, `units-geometry.json` |
| `stack_units.py` | interim boxes for every unit of the platform fixture by stacking the hero footprint (floor pitch 3.2 m, ceiling 2.9 m, bays of +-9 m along the facade); marks them `stacked-approx` |
| `correct/`, `gates/` | cards 02 and 05 (other sessions): the correction screen and the gates; read their READMEs |
| `_local/` | outputs (not committed): `apt846/` intake run, `rainbow/` units |

## Run

```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/engine
PY="C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe -I"
export PYTHONIOENCODING=utf-8

# A0
$PY validate_project.py fixtures/rainbow-846.project.json fixtures/demo-simple.project.json --check-files

# A1 on the 846 sheet (two subscription VLM calls, ~1-2 min each; replay them with --vlm file:... --assign file:...)
$PY intake/intake_raster.py "../../דירה 846- 16.pdf" --out _local/apt846 --apartment-id apt846 \
    --known-dims ../studio/fixtures/apt846.intake.json --ground-truth ../../360walkaround/tours/apt846/plan.json \
    --tour-crop-box-px "[1750,380,5500,4280]" --rights-note "..."
# -> _local/apt846/v1/{plan.json, report.json, report.md, plan-crop.png}
node ../../360walkaround/pipeline/validate-plan.mjs _local/apt846/v1/plan.json        # schema / consistency
$PY gates/plan_gate.py _local/apt846/v1/plan.json --report _local/apt846/v1/report.json \
    --intake ../studio/fixtures/apt846.intake.json                                     # geometry gate
node correct/serve.mjs --plan _local/apt846/v1/plan.json --selftest                    # correction screen contract

# interim unit boxes
$PY stack_units.py            # reads ../platform/fixtures/rainbow/units.json + _local/rainbow/units.json, rewrites the latter
```

## What intake_raster does, step by step

1. **rasterize** the PDF page at 288 dpi (grey). The 846 sheet is actually vector art (8.5k paths, text as
   outlines); it is flattened here on purpose so the same code serves true raster sheets.
2. **auto-crop**: ink minus the sheet frame/table rules, closed, the blob with the most ink, tightened to the
   wall-fill bbox + 22 % margin. 846: sheet px `[1917, 83, 5073, 4340]` -> 3156x4257.
3. **VLM pass 1** (`vlm/vlm.json`): the crop, the whole sheet (small) and 4 zoom tiles. Strict JSON parsed out
   of the reply, normalised.
4. **trace A** (`trace-a/`): no labels; `overlay.png` numbers the regions.
5. **VLM pass 2** (`assign/assign.json`): which region holds which room(s); rooms the tracer missed, with the
   region they are next to and on which side.
6. **trace B** (`trace/`): regions with several rooms are split by geodesic Voronoi of the label positions
   (snapped into the region); missed rooms are seeded in the leftover free space next to their neighbour;
   an entrance hall is seeded at the entrance-door contact.
7. **calibrate**: nominal `dpi / 2.54 / scale`; fitted from the rooms whose min-rect sides match a printed
   pair; when a pair matches on one side only, the other printed value is flagged suspect (846: the VLM read
   225 where the sheet prints 275; the trace says 273.6).
8. **emit** `plan.json` (schema 0.2.0-draft, `geometry: general`, cm, y down, origin = crop top-left;
   rooms with `edge_kinds`, walls as polygons, oriented openings, panes, camera points, `disagreements[]` for
   every printed-vs-bbox gap > 5 %, `fixtures: []`) and `report.json` (evaluation blocks `*_eval`, the
   correction-screen contract `habait.intake-report/0.1` with `raster.cm_to_px`, `dimensions[]` in the
   plan frame for `plan_gate`, `frames` with the measured mapping from the ground-truth frame).

Frames: plan.json cm = `plan-crop.png` px / `report.raster.px_per_cm`. The ground truth
(`360walkaround/tours/apt846/plan.json`) lives in the tour360 crop (2.25 px/cm); on the sheet that crop is
at `[1750, 380]` and the engine crop at `[1917, 83]` (template-matched, corr 1.000), so
`engine_px = 2.25 * gt_cm + (-167, +297)` — written to `report.frames.ground_truth_frame`.

Tolerance: 3 % as the work plan says, 4 % for rooms under 5 m2 (the ground truth's main bathroom traces at
218x218 against printed 212x210 = 3.6 %, a raster residual, not an error). Recorded in `report.summary`.

## 846 result (2026-11-02, replayed VLM calls, `_local/apt846/v1/`)

| what | number |
|---|---|
| printed dims (VLM, Opus) | 14/16 both runs; misread 99 -> 199, 275 -> 225 (run 1: 99 -> 299, 474 -> 471) |
| unit table | number, area 106.72, rooms 3, type L correct; terrace 26.16 (sheet 26.15); floor read 18, is 16 (both runs) |
| rooms named by the VLM | 11/11 of the ground truth matched by name/type (12 rows incl. the shaft) |
| rooms traced and named | 8/11; wardrobe and main bathroom not traced, guest bathroom 0.44 m2 (fixtures), 2 unnamed regions (a terrace piece, the strip behind the kitchen counter); 6 zones cut by virtual Voronoi boundaries |
| scale | fitted 2.2494 px/cm vs nominal 2.2677 (-0.81 %); the ground truth assumed 2.25 |
| printed vs measured | bedroom min-rect 342.4 x 273.6 (sheet 342 x 275: 0.1 % / -0.5 %); living/master bedroom not comparable (virtual zones); 0/2 comparable rooms pass against the VLM's values |
| walls | 10 fill components (ground truth: 37 pieces), 14.6 m2 vs 11.75 |
| openings | 9 (3 virtual); 1 of 13 ground-truth room pairs matched |
| area sanity | indoor rooms 97.3 + walls 14.6 = 112 m2 vs sheet 106.72 (+4.9 %); outdoor 15.1 vs 26.16 |
| edit cost | 30 (2 unnamed, 3 untraced, 6 zone lines, 2 dims, 12+5 openings) + 19 fixtures |
| validate-plan.mjs | CLEAN, 6 warnings |
| correct/serve.mjs --selftest | OK (16/16) |
| gates/plan_gate.py | FAIL, score 0.000: worst room r-bedroom (VLM 225 vs traced 279.9), walls kept 0.0 (guest bath) .. 0.92; `dimensions[]` 11 of 16 values located as lines |
| time | VLM 60-100 s per call; trace ~40-60 s per pass (skimage watershed on 13 Mpx) |

## Known limits

- The VLM's label coordinates are unreliable (hundreds of px off); region membership (pass 2) is reliable.
  Open-plan zones are therefore cut by Voronoi of bad seeds: the living/kitchen/dining/entrance shapes
  need the correction screen. A text-blob detector snapping labels to printed Hebrew words is the fix.
- Rooms full of fixtures (bathrooms, wardrobe) have no distance-transform core; the seeding from the VLM's
  "next to region X on side Y" hint works for the guest bath only. Fixture outlines are the double-stroke
  rule's false positives.
- Terraces are bounded by thin slab-edge lines; the far-polyline rule keeps the curved rim but the south
  passage leaks, so the terrace splits into pieces and loses area (15.1 vs 26.2 m2).
- Door widths come from basin contacts, not from the drawn leaf: widths are approximate and wide openings
  (> 115 cm) are never doors.
- Walls are fill networks, not the studio's 37 cut pieces; `edge_kinds` are derived by distance.
- `fixtures[]` is empty (TODO: the drawn kitchen run, island, beds, wardrobes, tub, WC).
- The VLM misreads small digits (99, 275) even with zoom tiles and reads the floor wrong; the trace
  contradicts one value per room and flags it, but cannot read the right one.
- `stack_units.py`: every box except the hero's is the hero's footprint moved; K/M/PH footprints are
  unknown until their plans are traced. The platform validator's folder cross-check fails on project id
  (`rainbow-tlv` vs the flow's `rainbow`) and the hero id (`apt846` vs `846`): both inherited from
  `building.py`; the units.schema.json validation itself passes.

## Vector intake (card 06, 2026-11-02): vector PDF, DXF, IFC

The 846 sheet is CAD vector art (8.5k drawings, 46 optional-content groups = the architect's CAD layers, the
neighbours hidden behind a polygon viewport clip, all text outlined: 0 text spans). Reading the vectors replaces
the rasterise + VLM + CV chain for such sheets. The three readers emit the SAME contract as `intake_raster.py`:
`plan.json` (schema 0.2.0-draft, `geometry: general`, cm, +y down, origin = the crop's top-left) and
`report.json` with `schema: habait.intake-report/0.1`, `raster.cm_to_px` onto `plan-crop.png`, `frames`,
`dimensions[]` in the plan frame for `plan_gate`, `summary` with the 3 % / 4 % tolerance, plus card 01's
evaluation blocks (`printed_dims`, `rooms_eval`, `openings_eval`, `walls`, `area_sanity`, `edit_cost`). They do
this by calling card 01's own emitters (`emit_plan`, `make_report`, `add_edge_kinds`, `write_report_md`, imported,
unchanged) and then adding: `dimensions[]` from the real dimension entities (`a_cm`/`b_cm` = the ticks,
`chord_cm`), `area_pairs`, `dims_chord_check` (room chord along each printed room-clear line vs the printed
value) and a `vector` block (layers, glyph classes, decoded labels, doors).

| path | input | names from | printed dimensions from | rooms from |
|---|---|---|---|---|
| raster (`intake_raster.py`) | any PDF / image | VLM (`claude -p`) | VLM | CV trace + VLM region names |
| vector PDF (`intake_pdf_vector.py`) | CAD-exported PDF | outlined glyphs decoded against `lexicon_he.json` (+ `--vlm-json` names, $0 replay) | dimension entities: ticks + digits decoded by glyph-shape clustering | free space between walls / glazing / railings / door closures; open plan split by a geodesic Voronoi of the labels |
| DXF (`intake_dwg.py`) | `.dxf` (`.dwg` via ODA) | TEXT / MTEXT vs the lexicon | DIMENSION entities | room-boundary polylines when the layer exists, else as the PDF path |
| IFC (`intake_ifc.py`) | `.ifc` | IfcSpace LongName / Name vs the lexicon | none in IFC (scale is exact) | IfcSpace footprints |

How the vector PDF reader works: (1) `get_drawings(extended=True)`, every path clipped by the active clip stack
and tagged with its OCG layer; (2) layers -> classes by `layer_maps/<office>.json` (grey-fill style fallback
for a PDF without layers); (3) dimension lines = long single segments, their ends = the ticks crossing them,
the text next to each line split into glyphs, glyphs shape-clustered (one CAD font = identical geometry), clusters
-> digits by maximising agreement of value vs span at the nominal scale over ALL dimensions at once (robust:
an override cannot steer the alphabet), then every value is READ from its own glyphs; (4) scale = median
span / value; (5) labels: the same glyph clustering on the text layer, each label block takes the lexicon name
whose word lengths match under one global shape -> letter function, unanchored readings dropped; (6) walls = poche
fills + thin faces of the wall outlines; rooms = labelled free-space components (a piece cut off only by a slab or
beam line joins its outdoor room); an unprinted entrance hall is seeded 60 cm inside the unit door; (7) openings =
swing arcs (hinge = arc centre, closed end = the arc end away from the drawn leaf), the widest glazed unit between an
indoor and an outdoor room (assumed the sliding door), virtual zone cuts; (8) `room_clear` dimensions = lines whose
room chord equals their own tick span (+-1.5 % / 6 cm; drawing vs drawing, so the printed-vs-room check stays real).

### Run (846 and the samples)

```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/engine
PY="C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe -I"; export PYTHONIOENCODING=utf-8

# vector PDF, ~25 s, $0, no network
$PY intake/intake_pdf_vector.py "../../דירה 846- 16.pdf" --out _local/apt846/vector --apartment-id apt846 \
    --known-dims ../studio/fixtures/apt846.intake.json --ground-truth ../../360walkaround/tours/apt846/plan.json \
    --tour-crop-box-px "[1750,380,5500,4280]"          # [--layer-map intake/layer_maps/dblk.json] [--vlm-json <vlm.json>]
node ../../360walkaround/pipeline/validate-plan.mjs _local/apt846/vector/plan.json
$PY gates/plan_gate.py _local/apt846/vector/plan.json --report _local/apt846/vector/report.json --intake ../studio/fixtures/apt846.intake.json

# DXF (the card's Check) and IFC, on the synthetic samples
$PY intake/intake_dwg.py intake/fixtures/sample.dxf --out _local/dwg-sample     # layer map: <stem>.layers.json next to the file
$PY intake/intake_ifc.py intake/fixtures/sample.ifc --out _local/dwg-sample/ifc
# regenerate the samples from a plan.json:
$PY intake/fixtures/make_sample_dxf.py ../../360walkaround/tours/apt846/plan.json intake/fixtures/sample.dxf
$PY intake/fixtures/make_sample_ifc.py ../../360walkaround/tours/apt846/plan.json intake/fixtures/sample.ifc
```

A new architect office = a new `layer_maps/<office>.json` (copy `dblk.json`, change the regexes; the report's
`vector.classes` lists every layer and its class, `unmapped` ones included). A new room name = one line in
`lexicon_he.json`.

### 846 result, vector PDF (2026-11-02, `_local/apt846/vector/`, no VLM)

| what | raster v1 (card 01) | vector (card 06) |
|---|---|---|
| printed dims read | 14/16 (VLM) | 16/16 texts, 49 glyphs in 10 shape classes = the 10 digits; vs the fixture 15/16, because the fixture's `99` is printed `199` (checked at 600 dpi: the "1" overlaps the WC symbol; span 199.1 cm) |
| scale | 2.2494 px/cm (-0.81 %) | 2.2681 px/cm (+0.015 % vs 1:50 at 288 dpi), 16/16 dimensions within 0.25 %; the ground truth's 2.25 is -0.8 % (its cm are 0.8 % long) |
| room names | VLM 11/11, traced 8/11 | 9 printed labels decoded from glyphs + Entrance seeded = 10/11 (the GT's "terrace, bedroom end" is not printed) |
| walls | 10 components (GT 37 pieces) | 9 poche components, 15.3 m2 (GT 11.75: terrace columns and shaft walls included) |
| openings (GT room pairs) | 1/13 | 6/13 by card 01's metric (it skips virtual cuts); 11/13 counting the zone cuts; both misses involve the unprinted terrace piece |
| room chord vs printed | 0/2 comparable | 11/11 room-clear lines within tolerance (max 0.64 %); 4/4 room pairs pass |
| edit cost | 30 | 16 (1 room, 6 zone lines, 7 openings by the strict metric, 2 extra) |
| validate-plan.mjs | CLEAN | CLEAN, 4 warnings |
| plan_gate.py | FAIL 0.000 | FAIL 0.500: 9/10 rooms pass; the guest bath 199 measures 205.5 (+3.3 %) by the gate's offset chord through the door recess (on-line chord 198.1, -0.45 %). The same plan with the bedroom moved 10 cm: FAIL 0.229 |
| time | VLM 2 x 60-100 s + trace ~100 s | ~25 s |

Samples: DXF and IFC each 11/11 rooms named, 37/37 walls, edit cost 0 without a ground truth (the Check) and 6
with it (the 6 open-plan pairs exist as virtual contacts; card 01's metric skips virtual openings, 13/13 counting
them); plan_gate PASS 0.873 on the DXF output.

### Known gaps (vector paths)

- Open-plan zone boundaries are not drawn on a sales sheet: kitchen / dining / living / entrance areas are a
  geodesic Voronoi of the label positions (846: kitchen 12.8 vs GT 10.4 m2, entrance 15.1 vs 6.3) and stay on the
  correction screen's list (`zone_boundary`).
- The unit table (area, terrace, floor) is outlined text in the title block and is not read: `unit_fields` and the
  area sanity have no sheet values unless `--vlm-json` supplies them ($0 replay) or project.json does.
- Labels: horizontal room labels only (rotated text is not decoded); a label in a font seen nowhere else on the
  sheet is dropped as unanchored (846: the shaft's "אוורור"). A name missing from `lexicon_he.json` is not read.
- Glazed doors are an assumption (the widest glazed unit between an indoor room and a balcony). Sliding sashes are
  not told from fixed panes.
- Walls are poche components, not the studio's cut pieces; `fixtures[]` stays empty (the furniture and plumbing
  layers are classified but not emitted yet).
- PDFs without optional-content layers fall back to style rules (grey fill = poche, widths) that are untested on a
  second office; no second vector sheet was available.
- DWG needs the ODA File Converter (not installed here); DXF and IFC were tested on synthetic samples only. The DXF
  sample's dimensions run through room centres, which is not where an architect draws them.

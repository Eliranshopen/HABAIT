# auto-trace: sales plan → plan.general.json with no hand drawing (developer-platform P3)
<!-- 2026-11-04 · fork B of session rnd-67 · worktree .wt/auto-trace, branch auto-trace, commit 96ed30b (NOT merged, NOT deployed) -->

**What exists.** `Habait/tour360/tools/auto-trace.mjs <pdf|png> --out <dir> [--spec] [--type] [--budget] [--ledger] [--env-root]`
→ `<out>/index.json` + `plan-<k>/{plan.general.json, overlay.png, report.json, report.md}`. It is a callable step for the portal's
job executor (fork C). Helpers: `auto_pages.py` (PDF scan / sheet raster / brochure image extract), `auto_prep.py` (colour gate),
`auto_split.py` (geodesic Voronoi replaces 846's hand zone bars), `auto_finalize.py` (cameras, fixtures, scale fit from printed dims,
overlay, report), `trace_score.py`; `trace-plan.mjs` gained a barrier dump, walls-from-grey-fill and a geodesic fallback for leaks.

**Proven (evidence `Projects/Habait/research/auto-trace-2026-11-04/`, git-ignored):**
- 846, fully automatic (one Gemini read, $0.01; `run-auto-final/plan-1/score.json`): walled rooms within 2 % area / ≤ 4 cm mean
  edge (bedroom-2 +0.4 %, bath-main +1.7 %, bedroom-main −2.0 %, wardrobe +6 %). Open plan NOT at target: the entrance and
  terrace-bedroom labels were lost (entrance merged into living), kitchen +13 %, dining +25 %, guest bath +64 %; openings 2/13 by
  room pair; fixtures 6/19. With the hand seeds (`run-handseeds/`) the terrace union is exact (0.0 %) and the open-plan union −1.1 %,
  so the remaining gap is where the open-plan boundaries fall and which labels the read finds.
- Maale Efraim brochure (`maale-efraim-158/`, $0.04): found the plan pages itself (6 floor plans on 16 pages), picked type 158 m²
  (page 7, two floors). Ground floor: 6/7 rooms, walls right, the open kitchen/living split wrong (kitchen 28.8 m² vs printed
  3.10×4.85), the entrance label sits outside the door and was dropped. First floor: 4/6 rooms (two bedrooms' floods were degenerate).
  Brochures print no scale: the scale is fitted from the printed room dims, so a bad split also bends the scale.

**Spend:** $0.049 total in `research/auto-trace-2026-11-04/ledger.json` (cap $5).

**Incident (fixed):** a PNG input wrote its outputs beside the input; one run put 21 files into the live
`apt846/_local/plan/` through the worktree junction. Nothing was overwritten; the files were moved to `run-auto-final/plan-1/`; the
tool now always writes inside `--out`.

**Round 2 + the mandatory gate (later 2026-11-04, commits 7e5bec8 and 7f59755 on branch auto-trace).** Eliran (hard rule):
the AI checks the trace, not the developer. `trace_check.py` (printed dims within max(2 %, 5 cm), labels ↔ rooms, door arcs →
openings, entrance, windows, wet-room fixtures) + an independent vision judge; correction rounds re-seed rooms from their printed
rectangles; FAIL = exit 5, queued in `research/auto-trace-2026-11-04/review-queue.jsonl`, never shown to the developer.
Round 2 added walls by the wall colour (brochure (107,107,107)), the open-plan partition by printed W/L rectangles, door arcs.
Results: 846 FAIL (25/31 mechanical; 5 door arcs between no traced rooms; the cached reading has no per-room dims);
brochure first floor FAIL (22/31: bedroom −3 %, bedroom-2 +3/+11 %, laundry ±2.4 %, the en-suite/master split wrong);
ground floor FAIL (16/39: kitchen, living and entrance lost — the open space leaks into the garden). No plan PASSES yet.
**fal is locked ("User is locked. Reason: TOP_UP", HTTP 403)**: the judge cannot run until Eliran tops up; no judge = no PASS.
Spend $0.0968 total (13 ledger rows).

**Round 3 ($0, commit ce87f1f).** The building envelope (wall band closed adaptively 120–400 cm and filled; its gaps become
barriers), outdoor labels kept outside, door arcs attached to the nearest rooms (arcs outside the envelope ignored), `--no-judge`.
Ground floor: kitchen +0.2/+0.3 %, living +0.5/+1.6 %, ממ"ד 0.0/−0.7 % (26/30 mechanical; bathroom −34 %, entrance opening not
found). First floor 21/31 (bedroom 1 lost, 3 automatic halls). **846 passes 26/26 mechanical checks while the hand-trace score shows
its open plan off (dining +25 %, guest bath +64 %, entrance not found): its cached reading has no per-room dims and no entrance
label, so the mechanical gate cannot see the errors — only the judge (or a fresh reading with dims) can.** All three FAIL (no judge).

**Round 4 ($0).** `auto_rooms.py` rebuilds rooms orthogonally: printed rectangles snapped to the walls (walls-only mask; the
tracer's barrier holds diagonal door bars), smallest first without overlaps; rooms without dims keep the flood. Six new mandatory
checks (shape IoU ≥ 0.85, orthogonality, unlabelled ≤ 3 m², inside the envelope, bath ≥ 1.5 m², the room where its label is).
The coordinator caught that the old dims check (bounding box) passed wrong shapes; the new checks catch them, and the label check
catches a stairs room traced 459 cm from its label. Results (all FAIL): ground floor 40/51, first floor 38/54, 846 46/56.

**Round 5 ($0).** Printed rectangles placed to hold their own fixtures (kitchen 4/4) and never cover another label; no-dims
rooms from their reading box; outdoor clipped to paving; the envelope must hold every indoor label (fixed the lost bedroom);
`--spec` fills printed dims by exact name (846 from the audit: `research/auto-trace-2026-11-04/spec-846-from-audit.json`).
Ground floor 43/51 (kitchen at its counter, living −2.2/0.0 %, bath 0.0/+1.2 %; stairs and entrance corridor merged), first floor
42/55 (bedroom 1 swallows the corridor), 846 53/62 (main bath and main bedroom within 1 %; the north wing has its own wall axis;
terrace floods wrong). All FAIL. Open: per-wing axes, the entrance corridor as its own room, leftover never into a bedroom.

**Round 6 ($0).** Per-wing local axis (846 bedroom 2 now +0.3/−1.1 %), size-keeping snap, entrance strip rule, leftover never
into a bedroom/bath/laundry (its own «מעבר» for review), baths from their fixtures, one terrace. First floor 53/63 (master
+0.5/+0.3, en-suite +0.7/0, bedroom 2 +0.9/+0.7, laundry 0/−4, bath 0/−3 %); ground floor 45/55; 846 52/58. Still open: the
ground-floor entrance strip, automatic «מעבר» pieces outside the walls (the envelope admits a yard-stairs strip and a roof strip),
846 terrace/dining, first-floor bedroom 1 (−15 %).

**Round 7 ($0).** Wall-enclosed interiors, door-band entrance, open-plan slabs inside walls + glazing, wall-crossing
penalty, closed railing. First floor 56/63 (all six labelled rooms within 0–5 %, bedroom 1 fixed: placed sideways before);
ground floor 42/51 (entrance still inside the stairs room); 846 48/58 (bedroom 2 exact, open plan as slabs; the terrace region
takes the walk-in closet's label, guest bath collapsed onto the vent shaft, a roof strip on the first floor still outside).

**Round 8 ($0).** Ground-floor entrance traced as its own room (front door = the tracer's wall gap nearest the label; the
walk follows the free pixels across the door span). Regression table `research/auto-trace-2026-11-04/rounds.md` (per room, per run,
⚠ on a regression; it caught a bath growing to 99 % and the rule was fixed). Not fixed: 846 closet/terrace (the closet label takes
the terrace region), first-floor roof strip, stairs from the tread pattern (rule in, did not fire). Ground 47/55, first 56/63,
846 51/58, all FAIL (no judge).

**2026-11-05, judged rounds 9–10 + opentakeoff (commit cc1df3a on branch auto-trace).** fal back (new key): fresh 846 reading
with per-room dims ($0.009), judge on every plan ($0.005–0.012 each). Judge-driven fixes: rejected rectangles that span rooms,
openings from adjacency, outdoor-label-inside-envelope = this floor's terrace or a void, one unlabelled corridor per floor.
Fork C's real run of Eliran's own portal project (`pmw25zqqf4bb478`, the 846 PDF through the portal) = the third fixture.
**opentakeoff MCP verdict** (`research/auto-trace-2026-11-04/opentakeoff-probe/VERDICT.md`): WORKS on the 846 PDF, which is
vector CAD with its layer table (25,217 segments; `H-CONC-1` wall fills, `W-CONC/W-BLOCK`, `S-COLS`, `O-WIN`, `05door_m`,
`24dimension_m`, `P-PLUMBING`; the numbers are glyph outlines, no text). BLOCKED on the Maale Efraim brochure (its plans are
raster images; the 373 vectors are the page frame). `detect_rooms`/`one_click` are gated on the server, so its measuring needs our
vertices; the lever is the layers, read with pymupdf by `auto_walls_pdf.py` (walls, windows, doors exact, raster prep the fallback).
The brochure stays raster. **Measured:** the vector leg did NOT beat the raster trace on 846 (lost bedroom and living, master bath −39.5 %, terrace +71 %, rectangles off-axis; 62/79), so it is opt-in (`--vector-walls`, commit after cc1df3a). Judged raster results: 846 56/64, ground floor 48/55, first floor 56/63 — all FAIL; spend $0.22 of $5. Second reader: fork C / the main session (the executor passes the PDF, so the vector leg runs for it).

**Round 11 (2026-11-05, commit cb0204d) — Eliran's acceptance gate: the portal's auto trace of the 846 PDF must equal the hand
trace** (fork A's fixed one, `.wt/fix-846-fidelity` 12c3571; the live tree's copy is the 11-01 one). `trace_vs_hand.py` registers
both on the 288 dpi sheet (template match, corr 1.000) and compares per room at a 1 % bar. The 846 PDF's dimension lines, chained
and measured tick to tick (`dim_chains.py`), give every printed value exactly and the scale (2.2677 px/cm) — a reading-less run
had guessed 3.25 from room boxes, 43 % off. Anchored on both axes: bedroom, guest bath, closet, master bath, master bedroom.
Gate: 0/11 at 1 %; bedroom-2 +1.8 %, bath-main −0.1 % (sides −1.9/−2.0), bedroom-main −1.4 %; terrace untraced; openings 3/13.
Brochure (generalisation only): its closed rooms' wall-to-wall spans differ from their printed dims by ±3–5 % even at the
fitted scale — the render is not drawn to its own dims, so a 2 % bar there can fail on the drawing. Spend $0.26 of $5.

**Stopped at a definitional wall (2026-11-05).** The hand trace is itself >1 % off the printed dims in every printed room
(bedroom-2 area −2.5 %, bath-main +1.5/+1.3 %, bedroom-main side +11.6 %, bath-guest +19 %, wardrobe zone includes the passage;
open-plan zones cut by hand-placed virtual bars) — `research/auto-trace-2026-11-04/hand-vs-printed.md` with three options; under
Eliran's ruling «printed numbers are the authority» the auto trace cannot also equal the hand at 1 %. Bug found and fixed:
trace-plan reused a stale `walls.json` from a run at another scale (846 walls IoU 0.014 -> 0.824); fork C's builds consumed
those walls. Spend $0.26.

**Option-2 gate, 2026-11-05 (coordinator's ruling: print = authority for closed rooms, hand = topology/openings/open plan
as one region; commits 0e9050d..16894de).** `dims_gate.py` measures each closed room across its own printed dimension line.
846 PDF, full pipeline, judge off (fal locked): closed rooms **6/6 within 1 % of the print** (terrace via faces moved onto
the dimension extension lines), rooms 10/10, gated openings 5/7 within 5 cm (doors from the PDF door layer snapped to their
wall gaps), open plan area +4.3 % / outline 9.2 %, fixed elements 0/3. Fork A's HEAD hand trace on the same gate: 1/6 closed
rooms (guest bath +27 % on 199, closet zone includes the passage, master bath/bedroom −1.5 %) — routed to fork A. Remaining:
the beam strip outside the north windows (joins the kitchen as a 12 m² leftover mixed with interior), the sliding door
living→terrace (no arc), the master bath door (arc 56 cm from the hand's door line), fixed elements from drawing lines.

**Rounds 14b–16 (2026-11-05, commits 16894de..round 16, branch auto-trace).** 846 PDF, option-2 gate, full pipeline WITH the
judge (fal back): closed rooms 6/6 within 1 % of the print, rooms 10/10, gated openings 7/7 (master bath door from the arc end
on the jamb, sliding door = the glass panel beside the exit arrow on the symbol layer 08siman_m), fixed elements 2/3 from the
plumbing layer (the third: the drawing's short return sits 95 cm from the hand's k-counter-2 — hand discrepancy, fork A),
open plan +4.3 % / outline 9.2 % (the beam strip outside the north windows; facade-ring and window-line cuts regressed, reverted).
Judge: 846 — 3 mismatches (guest bath door line, terrace sliding doors, terrace narrow passage); Maale ground 2, first 2.
trace_check's old min-rectangle dims check still fails the L-shaped terrace that dims_gate passes — switch it to the
dimension-line sections for PDF runs. Spend $0.31 of $10.

**Round 17 (2026-11-05, commits 6bc0d16, 4d89783, e3bf3e4, branch auto-trace).** (1) The judge's "missing guest bath door /
sliding door" was the OVERLAY: openings were drawn 3 px thin under room outlines; now drawn last, thick, with end dots; opening
rooms re-derived from the final rooms, duplicates merged, same-room doors listed in `plan_meta.internal_doors`. Re-judged: both
door complaints gone. (2) ONE measurement: `printed_dimensions.py` copied byte-identical from fork A b066848; `dims_gate.py`
and `trace_check.py` (PDF runs) call `measure()`; the old band `section()` is deleted. Gate truth = fork A b066848's plan
(`research/auto-trace-2026-11-04/hand-846-plan.general.b066848.json`). (3) The beam strip «קורה דקורטיבית» is outlined on
layer V25 outside the O-WIN glass line; the curved glass wall is on V40 (pen weight), not O-WIN. Beam strip now outside,
glass band to the terrace joins the open plan. 846 (run r24, judge on): closed rooms 6/6, gated rows 13/17 (misses = 4
fixture rows: shower trays, closet runs — auto fixtures are vision boxes), rooms 10/10, openings 7/7, fixed 2/3, open plan
−2.48 % / 9.20 % (bar 1 % not met: kitchen NE corner cut by the 110 cm slab opening, the hand's casework notches). Judge 846:
4 (kitchen fixture boxes misplaced, 3 windows "missing a green line" — panes are not drawn on the overlay). Spend $0.33.
Learned: an outside strip that touches an interior corner through a window-line gap cannot be cut by the window mask alone;
removing it shifted the leftover partition (the entrance lost its corridor) until the entrance rule used its largest piece.
(4, commit c723c42) Maale: a labelled stair room is the flight rectangle grown from its label, the rest a hallway (ground:
stairs 4.7 + hallway 3.8 m², bath / ממ"ד / entrance open onto it); a tracer AUTO wall gap (60–100 cm, on axis) inside one
hall splits it at the drawn door (first floor: master-suite door gap-5 -> lobby 1.3 m²). A non-JSON judge answer no longer
crashes the run. Final judges (r26 / r36): 846 3, Maale first 3, ground 2 — and the judge contradicts itself between runs
(Maale corridor split asked for, then called unnecessary; 846 guest bath at 0.3 % of the print called wrong). Spend $0.386.
Table: `research/auto-trace-2026-11-04/round17-report.md`.

**Round 18 (2026-11-05, commits 9320014, 350a307, WIP 5b30205).** (1) Gate FLOOR DEFINITION, both sides: the room loop minus
the drawn built-in appliance squares (closed 4-sided shapes 45–75 cm on the plumbing/casework layer in the open plan; 846:
hob + sink units, 1.08 m², which the hand cuts out). 846 open plan −0.40 % area (≤ 1 % met) / 8.81 % outline (FAIL): the
kitchen NE corner (1.08 m²) is still lost — the window component's fitted line runs through the room, so the corner reads
as beyond it. (2) Shower trays (plumbing cluster, clipped to the room, wall to wall) and closet runs (furniture-layer hatch
under a printed dimension) from the drawing + fork A's `snap_fixtures`: 846 dimension rows **17/17**. (3) Windows drawn
as blue bars (indoor room edges only). (4, 5 — WIP, unverified) judge ×3 with 2-of-3 agreement as a report, not a gate;
courtyards / gardens traced as outdoor rooms. NEXT: read `maale-efraim-158-r37.log` / `run-pdf-846-r30.log` (judged,
ledgered) for the agreement rates; the Maale ground garden was never read by the vision model. Open: a 5 m² label-less
"corridor-1" outside 846's master bedroom (trace_check inside_envelope fails). Spend before r37/r30: $0.386.
Judged Maale run r37 (6 judge calls, ledger rows 53–58): 2-of-3 agreement first floor 0.57 (agreed: bath door, en-suite
door, the exterior door corridor -> courtyard, the courtyard outline), ground floor 0.13 (agreed: a false line stairs/kitchen).
The first-floor courtyard is traced (r-private-terrace 11.4 m², outdoor) but its outline is arbitrary and it has no door.
846 judged run NOT done: r30 was cut by the account switch, r31 stopped at 11 s by the coordinator's hold (no paid call);
a stray r30 node process (PID 27620) was still alive and was killed. Spend $0.4382.
Item 4 done (846 run r32, 3 judge calls, ledger to $0.4598): 2-of-3 agreement **0.67**; agreed: green opening lines
drawn across glass (the curved glass wall, bedroom 2's top window, the dining and master-bedroom glass to the terrace) —
adjacency openings to outside through glazing, not real openings. Agreement per plan: 846 0.67, Maale first 0.57, ground 0.13.
Item 5 (WIP commit a9cfac9): the Maale courtyard is built from its paving inside its reading box (11.4 -> 29.6 m²);
glass blocks adjacency contacts (846's agreed "green line across glass"); no corridor -> courtyard door exists on the
drawing (solid wall) — the judge's agreed mismatch is false; the ground-floor garden was never read by the vision model.
Resume (commits dec7a89, the follow-up after it): item 1's glass-line facade test (windows-glass.png) made the kitchen
swallow the beam strip (rooms 9/10, open plan −24 %): reverted; the NE corner (1.08 m²) is still lost, outline 8.81 %.
Entrance doors 'outside|outside' were caused by round 17's largest-piece entrance rule (not the adjacency change); a door
with no room on either side now takes the indoor room within 60 cm. Judged pass (3×): 2-of-3 agreement 846 0.50, Maale
first 0.67, ground 0.50; 846's agreed items (bedroom-2 window as a green line, the curved facade as straight chords)
fixed on the overlay. Maale agreed: bath door, the corridor -> courtyard door (none on the drawing: solid wall), bedroom
doors at the vestibule; ground: a false stairs/kitchen line, the entrance strip. Spend $0.5355.

**Round 19 (2026-11-05, branch auto-trace; c25bd4a + the next commit).** (1) The V25 "beam polygon" premise does not hold:
on 846 the V25 layer is OPEN polylines (352,-3)->(859,375)->(1019,495)->(992,531) cm, the beam's outer edge only; the strip is
the space between it and the O-WIN glass. Crop for the coordinator before a third approach:
`research/auto-trace-2026-11-04/round19/ne-corner-crop.png` (red auto, blue hand, orange V25, green glass): the hand kitchen
runs up to the glass; the auto kitchen stops ~60 cm short at the partition-wall end. (2) The 5 m² unlabelled "room" outside
the master bedroom was a band < 40 cm wide outside the east glass (51 % of its edge on the outside/terrace): no room now;
846 trace_check 76/85, gate unchanged. (3) The Maale ground-floor garden: two readings with the room names as hints
($0.0084 not-JSON + $0.0106) still return no «גינה פרטית» label — the vision model does not read it; the paid answer is
now kept on disk when it is not JSON. The stairs/kitchen "solid wall" the judges agree on is real: a wall hatched in two
greys (108/89 stripes) that the brochure wall rule drops; widening the colour (14->20) or healing stripes first fixes it
but regresses the first floor (bedroom dims/shapes, 61->57/66) — reverted. Spend $0.5546.
Round 19 go-on (11fd6dc): the beam strip is now a polygon from the V25 edge + the nearest parallel window line (7 pairs,
the whole beam) removed before rooms are built — 846 gate unchanged (outline 8.81 %). Crop
`round19/ne-corner-crop-beam.png`: the strip is removed exactly; the kitchen corner is still lost because it is one leftover
piece with the ledge around the curved glass (bounded by V20, not V25) and the beyond-window rule removes the whole piece;
sparing it lets the kitchen swallow the ledge (rooms 9/10, −24 %). Maale: the two-grey hatch wall class (between two room
labels, 0.17 m²) keeps the first floor at 61/66 (accepted), ground 50 -> 51/59; the stairs/kitchen false line persists —
it moved to the top of the U recess, which is open to the kitchen and now joins the stairs room. Spend $0.5546.
Round 19 last (67ccdae): the V20 ledge cut (each V20 edge paired with its nearest parallel window / V20 / V25 line, 11
pairs) did not free the corner while the old beyond-window rule ran, and without that rule the kitchen took the ledge
again (rooms 9/10) — reverted per the instruction. The 846 corner stays lost (outline 8.81 %): the corner and the ledge
remain one leftover piece through gaps in the window line. Maale: a recess past the stair flight (< 1 m²) joins the room
on its open side — the U recess joins the kitchen and the false kitchen | stairs line is gone (first floor 61/66 held,
ground 51/59). All round-19 runs $0; spend $0.5546.
Round 20 (f3376e7, $0): collinear window segments with gaps ≤ 15 cm joined (103 on 846) — kept (rooms 10/10, area −0.40 %)
but no gain (outline 8.81 %). The leak crop `round19/ne-corner-leak-r20.png` shows the cause is not a window gap: the removed
1.2 m² piece is the corner + the interior band under the NE window + the frame band, cut off from the kitchen slab by its
110 cm opening; the side test's line (fitted to a frame component's mass) runs ~30 cm inside the room. Fitted O-WIN glass
lines keep the band but let the kitchen take the ledge round the curve (rooms 9/10): not kept.
Round 20 give-back (parked as `git stash@{0}` in the auto-trace worktree, not committed): a piece the 110 cm open-plan split
cut off its own region goes back to the nearest slab before the window side test. The corner comes back exactly
(`round19/ne-corner-crop-r20-giveback.png`: auto follows the hand up to the glass), rooms 10/10, outline 8.81 -> 7.34 %, but
area +1.18 % (the glass-band overshoot at the living's sliding door and the column shows once the corner is back); with
the band on the curved glass only: area −1.20 %, outline 6.96 %. Both just outside the 1 % area bar: not kept per the rule.
Round 20 accepted (9695a1f on WIP a104c85; the stash a5055dc was applied by SHA and that entry dropped — the stash stack is
shared): give-back + the glass band ends at the drawn glass line (geodesic grow from the open plan, glass lines as walls).
846: closed 6/6, rows 17/17, rooms 10/10, openings 7/7, area +0.37 %, outline 8.81 -> 7.02 %, trace_check 77/85. Crop
`round19/ne-corner-crop-r20-final.png`. Remaining outline: entrance zone 0.79 m² (hand-only), NE frame band 0.40, glass band
by the column 0.35 + 0.27 (auto-only), laundry niche 0.31, kitchen bottom-left at the partition 0.28.

**Round 21 (65fe618, 86e65a5, $0).** The five open-plan outline items judged from the drawing (crops `round21/`):
entrance zone 0.79 — auto wrong (a stray piece of the entrance's claim dropped by its polygon): fixed; glass band at the
terrace column 0.62 — auto wrong (the door jamb / pocket beside the column): fixed (band keeps 20 cm off walls); laundry
niche 0.31 — auto wrong (an electrical cabinet box on 08siman/V40 set into the wall): fixed (0.15 remains);
NE frame band 0.40 — auto wrong (stops ~10 cm short of the window's inner face): NOT fixed — adding it takes the area to
~+1.6 % because of the next item; kitchen bottom-left 0.28 + 0.20 — HAND DISCREPANCY / definition: the hand cuts the
counter-run end and the sink unit out of its kitchen loop, the gate's floor definition only subtracts appliance squares.
846: closed 6/6, rows 17/17, rooms 10/10, openings 7/7, area +0.93 %, outline 7.02 -> 5.42 %, trace_check 77/85.

**Round 22 (379acf8, then the window-face commit).** Ruling option 1: the gate's floor rule subtracts ALL drawn counters
and casework (appliance squares + the casework auto_finalize reads from the plumbing/casework layer) from both sides —
written to dims-gate.json `floor_definition` and `research/auto-trace-2026-11-04/parity-floor-rule.md`. 846: area −0.10 %,
outline 5.42 -> 4.59 %. Then open-plan rooms reach the window's inner face (≤ 10 cm into the window mask, never past the
glass): rooms 10/10, area +0.60 %, outline 4.66 % (NE band 0.23 -> 0.18 m², a little added at other windows). Kept.
Round 22 end (80755b7): glass band only at a glass wall (V40) or within 1.5 m of an exit arrow. Remaining pieces judged:
living edge at the sliding door 0.38 (auto: claim reaches the wall, outline drops it), column band remnant 0.19, laundry
recess 0.18, NE corner triangle 0.18 — all auto-side, not fixed. Final table of the day (judged 3×, $0.6352 total):
846 closed 6/6, rows 17/17, rooms 10/10, openings 7/7, area +0.35 %, outline 4.43 %, trace_check 77/85, judge agreement
0.20; Maale first 61/66 (0.50), ground 51/59 (0.33). `research/auto-trace-2026-11-04/final-2026-11-05.md`.

**Round 23 (2026-11-06, 612b87c, $0).** Fork F's bug: fx-drawn-7 (60×60, four burners) was a tall unit -> a column on
the portal. Now the hob and the sink come from fork F's `casework_symbols.py` (project-runner e98ea47, copied
byte-identical — one reader): hob squares are classed before the tall units; `plan_meta.casework_symbols` records them.
846 gate unchanged; fixed elements 2/3 — k-counter 45.7 cm off: the auto run stops 70 cm short of the facade and runs on
past the tall unit, which sits beside the counter band (not on it), so the band test never ends the run. Next for it:
end the run at a tall unit beside its band and extend it to the facade wall within 80 cm.
Round 23b (9f8eea1, reverted by 627eff3 — pending ruling): the counter run ends at a tall unit beside it and runs on to a
wall ≤ 80 cm only where the casework layer draws it (coverage ≥ 60 % of the gap). 846: k-counter 425×70, 0.1 cm from the
hand — fixed elements 3/3 — but the open-plan outline 4.43 -> 4.68 % (the strip beside the tall unit is no longer
subtracted as casework; the hand loop excludes it). Reverted under "nothing else regresses"; the SHA keeps it.
Ruling: keep 9f8eea1 (reapplied 2eb3161). The strip beside the tall unit is a thin casework panel (two parallel P-PLUMBING
lines along the partition wall) -> casework on both sides (b63d23a). 846: fixed elements 3/3, area +0.34 %, outline 4.48 %.
Tightened: the gate's loose line-pair panel rule (52 shapes) replaced by one 'panel' fixture written by auto_finalize — the
run's band alongside the tall unit that ends it. 846: 3 squares + 8 casework shapes, fixed 3/3, area +0.43 %, outline 4.55 %.

**Merge-ready (2026-11-06; 913ea8d merge of main, 4821227 parity rows; NOT merged into main — the coordinator merges after
Rainbow ships).** main merged in without conflicts; printed_dimensions.py == main (b066848 blob); casework_symbols.py ==
fork F e98ea47 (main has none yet). Post-merge $0 reruns: 846 closed 6/6, rows 17/17, rooms 10/10, openings 7/7, fixed 3/3,
area +0.43 %, outline 4.55 %, trace_check 77/85; Maale 61/66, 51/59 — unchanged. PROJECT-PACKAGE.md rows R28-R34 → renamed T1-T7 2026-11-06 (the
trace step). Runner wiring: one call `node tools/auto-trace.mjs <pdf> --out <job>/trace --id <job> --ledger <job ledger>
--budget <cap> --review-queue <queue> [--spec] [--type] [--judge-runs 3]`, env HABAIT_APP_DIR (sharp) + HABAIT_PY (venv:
pymupdf, opencv, shapely, scikit-image) + the FAL/OpenRouter key by name (--env-root); read index.json -> plans[k].plan;
exit 5 = review queue. Caveat: 846's mechanical status is FAIL (77/85: orthogonal edges on the 17.5° wing, the auto corridor
label), so every job queues for review until those checks are tuned.

**846 exits 0 honestly (2026-11-06; branch auto-trace f2c183f..ce46727, $0, NOT merged).** Rows renamed T1-T7
(fork A's branch holds R28). The 8 failing checks judged from the drawing: orthogonal on the 35° wing (entrance passage,
bedroom, guest bath) = check bug -> T8 per-room axes from wall-backed edges + the plan axis; kitchen/terrace edges on the
curved glass and curved parapet = false flags -> T8b an edge within 5 cm of a drawn line all along passes; the terrace
31 cm chamfer = REAL (mask_poly snapped the 6°-off parapet face onto the axis) -> T11 keeps a drawn direction; the
master-suite lobby (158 cm, door from the living, open to closet corner + bedroom, nothing printed) -> T9 walkable
connector (the hand folds it into the closet corner, no line on the drawing); entrance label 209 cm = REAL (the hall took
the passage 2 m from the front door) -> T10 door-width strip door->passage, label now 15 cm. T12 squares rounded corners
only where it adds free floor. Thresholds unchanged. Results: 846 auto-trace exit 0, trace_check 85/85; gate unchanged
(6/6, 17/17, 10/10, 7/7, 3/3, area +0.43 %, outline 4.55 % still over 1 %). Maale exit 5: first floor 64/66 (bathroom
dims, unlabelled 11 m² hallway), ground 53/59 (4 printed dims, a door split, one patio corner chamfer) — all real.

**Maale exits 0 (2026-11-06; auto-trace 83e58d3, 11ce99e, 0e1ba87; $0; NOT merged — the coordinator merges).**
First floor 69/69: the 11 m² hall holds a U-stair drawn as treads -> T14 stair block 3.4 m² + 2.1 m² landing; the
rest is a 130 cm landing hall = T9 connector, T9b (connector <= 180 cm passes the unlabelled check, else 3 m² stays).
Bath drawn 262×184 for 275/190 -> T17 stretched to the print. Ground 58/58: T16 the "door" was an arc through three
dining-chair backs (hinge 171 cm from a wall; drawn doors 0-23 cm); T17 living 719->734, bath 164->169, ממ"ד 284->300;
T17b kitchen 527 (ran into the stair recess) cut to 485 from its walled end; T15 the recess under the upper flight
(walled 3 sides, open only to the kitchen) = kitchen niche 1.48 m² outside the printed size (rooms.json niches). Tried
and dropped: cutting window reveals (T18) — the print counts the reveals (bedrooms 330/300/390 fail without them).
Bounds of the print-wins rules (6 %/25 cm stretch, 12 %/60 cm cut) are new rule parameters, not check thresholds.
846 still exit 0, 85/85, gate unchanged (outline 4.55 %).

**846 robust to reading variance (2026-11-06; auto-trace 5f96bf4, 24029f7, 96c7449, 7ea6619; $0, no paid call).**
Fork F found 846 passed only on the saved reading; its two fresh readings failed (no entrance label, dining box over the
terrace +60 %, terrace without dims kept a partial flood, unlabelled corridor, front door unmatched, a tall unit twice).
Fixtures: research/auto-trace-2026-11-04/fixtures-846/ (vlm-saved-ee096255, vlm-fresh-a-58eeb927 no spec,
vlm-fresh-b-dd78423a + spec-apt846-auto). Fixes: T18 PDF rooms never from the reading's room boxes; T19 PDF outdoor rooms
always from the drawing (no tracer flood, no 6 m cap inside the outline); T20 the drawn entry arrow seeds a missing
entrance; T21 same-kind casework duplicates dropped; T22 an arc door takes the tracer's wall gap at its hinge. Result, all
three readings: exit 0, 85/85, gate 6/6 / 17/17 / 10/10 / openings 7/7 / fixed 3/3, area +0.33..+0.44 %, outline
4.28-4.29 % (the outline bar of 1 % still unmet). Maale still exit 0 (69/69, 58/58). Tried and reverted: openings
for open L-contacts (made a bedroom-living opening through a wall); o-8 stays a reported zone split, same on all three.
Caveat found: run846.sh read a stale dims-gate.txt; earlier "gate unchanged" lines were re-verified on fresh stdout today.

**o-8 and the washer (2026-11-06; auto-trace 5e7872a, 31c6035, on top of main 19cae62; $0; NOT merged).** T23: a drawn
wall end whose line meets another wall within 60-200 cm over free floor = an opening between the rooms either side (never
where no wall is drawn / a door sits / two open-plan zones meet) -> 846 o-gap-1 161 cm master bedroom <-> closet lobby on
all 3 readings (hand o-8 159.8); the gate still lists o-8 unmatched (zone split, not gated) because the hand folds the
lobby into the wardrobe, so the room pair differs. T24: a 45-75 cm square + one centred circle in a niche walled on 3
sides = washer (the laundry niche 156,1207; was tall unit + sink). No regression: 846 x 3 exit 0, 85/85, gate 6/6 17/17
10/10 7/7 3/3; Maale exit 0, 69/69, 58/58 (no gap, no washer added there).

**Furnish audit accepts 846 (2026-11-06; auto-trace bc42179, on main e0b89e8; $0; NOT merged).** Fork F's cloud furnish
audit refused the auto plan (vision boxes doubling drawn plumbing and blocking o-arc-6 / o-arc-7, counter m4 271 cm² and
a closet in walls, fx-3-vanity room None). T25: the drawing wins — a vision box on a drawn fixture is dropped (a drawn
bowl in a bath takes its name, wc), a box over a drawn 4-gon / drawn plumbing strokes becomes that shape, a box with
nothing under it survives only outside drawn door swings, rooms by largest overlap. T26: the real cause of the wall hits
and o-arc-6 — drawn fixtures were written with angle_deg 0, so the furnisher built the 35° counter / 17.5° shower square
to the page; angle and size now from each outline. Result: furnish_from_plan.py rc 0 on all 3 readings (blocked [], wall
hits []); 846 x 3 exit 0, 85/85, gate unchanged; Maale exit 0. A first wall-clip pass on plan walls was dropped (wrong
wall model: it shrank the closet off its printed 185).

**T27 ground offset (2026-11-06; auto-trace, $0).** ground_offset_cm was 0 (in the floor plane -> black ground, fork F).
Now floor number (spec building.floor_of_unit, else the floor label) x floor-to-floor (spec, else 320); unknown / ground
floor -> -300; never 0. 846 -5120 (floor 16; -300 on the no-spec reading), Maale -320 / -300. All runs still exit 0.

**T28-T30 (2026-11-07; auto-trace, on main f96337c; $0).** Fork F's build of fresh A: T28 drops a door that runs along a
wall (o-arc-8, the front door's open leaf) and a 'door' with no room beyond it and glass within 60 cm (the bedroom's
120 cm glazed corner); T29 merges the unlabelled closet lobby into «פינת ארונות» (one space on the drawing, as the hand)
— removes the fake boundary behind the master-bath door frame and the lobby hotspot; o-arc-3 is on the drawn gap
(hand o-6 4.6 cm); T30 joins the guest-bath basin niche (+0.42 m²) to the finished loop (PDF). 846 x 3 exit 0 81/81, gate
unchanged, furnish rc 0 x 3; Maale exit 0. Not re-measured: fork F's own wall-vs-loop metric (no copy here).

**T31 loops on wall faces (2026-11-07; auto-trace 67e5e71 + check commit; $0).** Every loop edge within 14 cm of a
parallel face of plan.walls (what the builder builds) moves onto it, tilted edges turn onto a straight face; vector PDFs
only (on Maale's raster it broke the kitchen's print and dropped the lobby — reverted to PDF-only). 846 x 3 exit 0,
81/81, printed dims 17/17 worst 0.82 %, open plan area +0.7-0.8 % (was +0.3-0.4), outline 4.37 %; furnish rc 0 x 3;
Maale exit 0. Left >5 cm: faces > 14 cm away (living 19, terrace 21.5), glass/open edges, the bath niche's bent edge.

**T32/T33 (2026-11-08; auto-trace dde9601; $0).** Root cause of fork F's render-gate offsets: the auto plan wrote no
rooms[].edge_kinds, so the builder built no facings and rendered the raw wall polygons behind the loops (the hand has
edge_kinds and passes 11/11). T32 writes wall/open/line per edge ('wall' = a wall polygon within the builder's 12 cm band),
so the built face IS the loop; T33 slides 'wall' edges 0.4-3 cm onto their printed ticks (fork A's fit_edges); T31 now only
for outdoor rooms (onto railings). 846 x 3 exit 0 82/82, dims 18/18 worst 0.82 %, gate unchanged, furnish rc 0; Maale exit 0.

**Next:** Eliran's choice of the gate's truth (hand re-traced to print / printed for size + hand for topology / hand as is). → the judge on all three + a fresh 846 reading (~$0.03); then first-floor bedroom 1 and the
auto halls, the ground-floor bathroom and entrance; then merge on Eliran's word. The developer never sees a FAIL trace.

Second reader: the portal's job runner (fork C / the main session) — it consumes `index.json`.

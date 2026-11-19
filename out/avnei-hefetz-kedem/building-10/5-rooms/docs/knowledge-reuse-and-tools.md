# Knowledge reuse and PDF-to-3D tool choice

## Reused from earlier projects (RAINBOW apt846, Pesel_yazamot / Kedma D-1). Read-only: nothing in them was changed.
The full survey of both projects was written today by the sibling job (Harei Zahav Na'ama) at `C:\RnD\.wt\harei-zahav-naama\out\harei-zahav-naama\3-rooms\docs\knowledge-reuse.md`. It covers the same machine, the same pipeline and the same rules, and was read in full here. The fal model survey beside it (`fal-model-research.md`, keyless, $0) was also read.

| Taken | From | How it was used here |
|---|---|---|
| Wall fill by colour + a small morphological opening | Kedma `hand/wall_probe.py`, `wall_polys.py` | `scripts/01_probe_plan.py`, `02_wall_polygons.py` |
| Scale fitted from the printed room dimensions, rule max(2 %, 5 cm) | Kedma (24 dimensions), Rainbow `printed_dimensions.py` | `scripts/03_geometry.py`, `work/scale-fit.json` |
| Gridded zooms, positions read by number, never by eye | Kedma `hand/zoom.py` | `scripts/zoom.py`, `work/zoom-A…G.jpg` |
| Model drawn back on the sheet before any render | Kedma `plan_audit.py` lesson | `scripts/04_check_geometry.py`, `qa/geometry-overlay.jpg` |
| Walls are the extracted fill polygons, never an assumed thickness; nothing coplanar (finish overlays sit 2–3 mm up) | Rainbow `build_scene.py` general branch | `scripts/05_build_scene.py` |
| Glass: a 0.8 cm pane in an aluminium frame; window portals | Rainbow materials kit, glass lessons | same |
| One Blender on the machine at a time: the `C:/RnD/.wt/_blender.lock` protocol | `run-project.mjs` | `scripts/blender_run.py` |
| CPU budget: OIDN denoiser, adaptive sampling, band (strip) rendering so each call fits the time bound | Kedma timings (3072 px wide at 20–32 samples: 150–500 s) | `scripts/06_render.py` |
| Viewer rules: eye level (tilt ≤ 10°), opens wide (118°), no walking arrows on the phone | Eliran 2026-11-11 and 2026-11-17 | `viewer/index.html` |
| No skirting boards | Eliran 2026-11-10 | none are modelled |
| Sales-plan fidelity: furniture as drawn, nothing invented | Eliran 2026-11-04 and 2026-11-17 | furniture placed on the drawn rectangles; no TV and no items that are not on the sheet |
| No whole-panorama AI skin: it is not geometry-true (doors 7–8° off, invented walls) | Kedma 2026-11-17 | the Blender panorama is the authority |
| CC0 Poly Haven assets already downloaded on this machine | Harei Zahav job cache | copied to `assets/`, plus 8 textures and 1 sky fetched (`assets/manifest.fetched.json`, $0) |

Not reused: any wall, room, camera, height or material board of apt846 or Kedma (another building); `auto-trace.mjs` and `trace-plan.mjs` (they fail on furnished raster sheets); the Kenney low-poly furniture (stand-ins that the AI paints wrongly).

## PDF-to-3D tools: what the documents allow
| Document | Type | Finding |
|---|---|---|
| Building 10 sheet (JPG) | raster, 300 dpi, furnished marketing render | no vectors and no text layer: OCR and vector tools have nothing to read. The wall fill is one flat grey (121), so colour extraction works |
| Brochure PDF | mixed: InDesign vector text over embedded raster plans | PyMuPDF reads the titles, floors, room counts and areas as text (used to verify building, floor and area). The plans are images, about 10× lower resolution than the JPG |

| Tool | Verdict |
|---|---|
| PyMuPDF | used: page text and block positions, page renders |
| OpenCV + numpy + shapely | used: wall mask, components, polygons, unions, footprints |
| pdfplumber | not needed: PyMuPDF already gives text with positions |
| ezdxf / IfcOpenShell | not applicable: no DXF or IFC exists |
| Blender 4.5 Python API (Cycles, CPU) | used: scene, materials, cameras, renders, GLB export |
| Rainbow `auto-trace.mjs` | rejected: failed 116/139 on Kedma's furnished raster |

Limits: no heights in any document; no north arrow; one dimension (the WC depth) disagrees with its drawing by 5.5 cm.

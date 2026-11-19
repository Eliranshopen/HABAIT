# PDF → 3D: extraction research and the chosen pipeline

## What the sources really are
| File | Probe result (PyMuPDF / Pillow) | Consequence |
|---|---|---|
| `plan-hatzav-colour.png` | raster, 2083×1531, 150 dpi; flat colours: wall fill grey 188, floor white, garden 224/236/228, deck stripes | the only usable plan; colour separation is reliable |
| `brochure-naama.pdf` p.5 | the plan is an embedded raster, rotated 90° on the page; `get_text()` returns no usable text; 36 vector paths are page frames, not walls | no vector walls, no OCR-able text: the PDF adds nothing over the PNG except the exterior render |

So the job is **raster → geometry**. Vector paths (PyMuPDF `get_drawings`, ezdxf) and BIM (IfcOpenShell) have nothing to read.

## Tools compared (on these files)
| Tool | Role it could play | Verdict here |
|---|---|---|
| PyMuPDF 1.2x | page scan, embedded image extraction, vector paths, text | **used**: extracting p.5's plan and render; proved there are no vectors or text |
| pdfplumber | text/line extraction from vector PDFs | not applicable: no text layer, no vector lines |
| OpenCV | colour masks, morphology, contours, connected components | **used**: wall mask by colour (grey 150–220, neutral), 5×5 open, contours → polygons; dimension lines read as dark runs |
| Shapely | union/difference, areas, containment checks | **used**: wall-vs-sheet IoU, room areas, items-inside-room checks |
| ezdxf | DXF read/write | not applicable (no DXF in the sources); could export the plan later |
| IfcOpenShell | IFC BIM | not applicable (no IFC) |
| Blender Python (bpy/bmesh) | scene build, clean meshes, Cycles render, GLB export | **used** for everything 3D |
| engine `auto-trace.mjs` (RAINBOW pipeline) | automatic plan trace | **not used**: it failed on the Kedma furnished rasters (116/139 checks); this sheet is the same kind (furnished, raster) |

## The pipeline that was run (and tested before reconstruction)
1. `01_probe_plan.py` — colour histogram, wall mask, wall groups.
2. `02_wall_polygons.py` — wall polygons and gridded zoom crops for reading by eye.
3. `03_scale_and_edges.py` — dimension lines as dark runs → **1.000 px/cm**; refined wall polygons.
4. `04_geometry.py` — the geometry of record (walls, openings with hinge and swing, rooms, items, outside), every element VERIFIED / DERIVED / ASSUMED; interior faces snapped so every printed room dimension is met.
5. `05_check_geometry.py` — overlay, wall diff, printed dimensions, areas, containment. **Gate: PASS** (0.54 % wall pixels beyond 2 cm; 20/20 printed dimensions at 0 cm; 80.02 m² vs 80).
6. `blender/build_scene.py` + `hz_lib.py` + `hz_furniture.py` — the scene. Walls are ONE closed mesh built on the grid of all wall and opening planes (`voxel_mesh`): no overlapping boxes, no coplanar faces, outward normals by construction; the opening voids are cut in the same pass.
7. `blender/render.py` + `run_blender.py` + `render_queue.sh` + `07_stitch.py` — bounded CPU renders in strips under the machine-wide Blender lock.

## Limits and assumptions
- Heights are not in any source (all ASSUMED, `source-evidence.md`).
- The sheet's furniture symbols give plan boxes only; heights and styling are design choices.
- A raster at 1 px/cm limits reading to about ±1 cm; the printed dimensions decide where the drawing is ambiguous.

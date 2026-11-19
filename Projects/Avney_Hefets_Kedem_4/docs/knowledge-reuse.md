# Knowledge reuse and the PDF-to-3D method (2026-11-17)

## Reference projects
The reference projects were read only, through two read-only surveys. Nothing in them was modified and no apartment geometry was copied.

### What was reused, and from where
| Reused | From | How |
|---|---|---|
| Wall tracing by the sheet's flat grey fill (auto-trace fails on furnished raster sheets) | Kedma D/1 `jobs/kedma-d1/hand/wall_probe.py` | Method only; new code in `tools/trace_walls.py` |
| Printed-dimension scale fit | Kedma `geometry.json scale_basis`, Rainbow R6/R16 | `tools/make_plan.py` |
| Glass transparent to shadow rays only | `360walkaround/pipeline/materials_kit.py glass()` | `tools/build_scene.py` |
| World-space tile grid | `materials_kit.floor_tile` | `tools/build_scene.py` |
| Equirect camera orientation and the wrap pad | `render_pano.py` (F-360-118) | `tools/render.py` |
| Real-time 3D walk: light bake into atlases, glTF, three.js page, free-floor grid | Rainbow walk3d, `.wt/blender-walk` (2026-11-12) | `tools/walk3d_bake.py` (copy; only the Rainbow niche cut removed), `tools/walk/*` (adapted) |
| CC0 assets: HDRI qwantani_noon_puresky, laminate_floor_02, Poly Haven armchair / plant / outdoor set | 3Dengine catalog, HABAIT-Archive | Referenced or copied into `assets/` |

### Rules applied
- No skirting boards.
- Zero-line white doors.
- Eye height 160 cm.
- Furniture is illustrative.
- Fidelity: every room within 2 %, with a 1 % bar.

### Lessons that hit again in this job
- **A light inside its own fixture is blocked.** It turned rooms black. The light now sits below the disc.
- **Stacked thin wall boxes give one bake island each**, which shows as vertical stripes. Walls are now merged vertically and floors and ceilings welded.
- **A material named "*glass*" is treated as glass by the bake.** The hob material was renamed (the Rainbow walk3d lesson).
- **A diffuse bake comes out too bright under AgX.** Export through Standard at −1.6 with a colour lift (the Rainbow lesson).
- **The Python test server dropped connections under the glTF load.** Node is used instead.

## PDF-to-3D research (tools on this machine)
| Tool | Verdict here |
|---|---|
| PyMuPDF 1.26 | Read the brochure: raster plans with vector text. No vector walls exist, so the PDF gives no geometry. |
| pdfplumber 0.11 | Installed, but not needed: the same text is available and there are no vector paths of walls. |
| OpenCV / scikit-image / scipy | Colour segmentation plus morphology. This is the method used, with IoU 0.987 against the mask. |
| ezdxf / IfcOpenShell | No DWG, DXF or IFC exists in the sources. Not applicable. |
| Blender 4.5.10 LTS (Cycles CPU) | Scene, renders and the light bake. |
| Rainbow auto-trace | Documented failure on furnished raster sheets (Kedma 116/139). Not used. |

## fal.ai research (free, from the public schemas, 2026-11-17)
- `fal-ai/nano-banana-2/edit`: aspect ratios run 21:9 … 1:8 with no 2:1, so it cannot produce an equirectangular panorama. Resolution goes up to 4K.
- `openai/gpt-image-2.5/sunburst/edit`: fixed preset sizes, also no 2:1.
- Earlier bench results (Rainbow 2026-11-02, -11-06; Kedma 2026-11-17): nano-banana-2 holds geometry on flat views.

One test call was made: hero-living, nano-banana-2, $0.12. Geometry held. One defect: wood strips painted on the tiled floor at the bottom left.

Eliran then ruled: no generation, he supplies the images. **The work stops at that stage.**

# Projects/Pesel_yazamot/ — the developer's source files: Kedma, Etz Efraim (קדמא עץ אפרים)
<!-- last-updated: 2026-11-16 -->

## What's here
The files Eliran received from the developer (פסל יזמות) for the project "נופי קדמא / קדמא עץ אפרים", put here by him on 2026-11-16 as the input for apartment simulations. **These are originals: read-only, never altered, never moved** (root §4, §6). Work on them happens in a copy inside the job folder of a working folder under `C:\RnD\.wt\`.

Scanned 2026-11-16 (28 files, 2 folders):

| Folder | Files | What |
|---|---|---|
| `תוכניות דירה, דירות אחרונות- קדמא עץ אפרים/` | 11 PDF + 14 PNG | one sales-plan sheet per apartment still for sale. Buildings ד and ה are PDF (one page, 600×420 mm, a single Photoshop raster 7087×4961 px, no vectors, no text layer); buildings א, ב, ג are PNG |
| `עץ אפרים חו_ל/` | 3 | `מחירון רגיל מעודכן 23.10.pdf` (the price list), `Nofey Kedma Golden Stone Logo.png`, `הדמיות-…zip` (123 MB: 7 exterior renders of the project as JPG and one print PDF of the renders) |

Apartments on file: א/3 · ב/3, 4, 5, 6 · ג/1, 2, 3, 4, 5, 6, 7, 9, 11 · ד/1, 2, 7, 8, 9, 12 · ה/3, 4, 6, 7, 8.

## What the sheets are like (read from building ד apartment 1)
- A furnished marketing plan: dark-grey wall fill (grey 85), marble floor texture, drawn furniture, room names in Hebrew, printed room dimensions in cm with no extension lines, no printed scale, a north arrow, the building's place on the site and the unit's place on the floor.
- The scale is fitted from the printed dimensions: 3.3506 px/cm on ד/1 (24 printed dimensions, all within max(2 %, 5 cm) of the drawn wall faces).
- The automatic trace (`auto-trace.mjs`) FAILS on these sheets (116/139 checks on ד/1: the open space and the balcony are assigned wrongly, no window is read). The walls themselves extract cleanly by colour.

## Work in progress
| Apartment | Working folder | State |
|---|---|---|
| building ד, apartment 1 (type C1, floor 1, 5 rooms, 134 m² + 22 m² balcony) | `C:\RnD\.wt\kedma-d1` (git worktree, branch `kedma-d1`); job files in `Projects/3Dengine/jobs/kedma-d1/` there | 2026-11-16: BUILT, not deployed: hand trace → CG → designed look, 13 rooms, every one PASS the 1 % fidelity gate (0.13–0.85 %), tour packaged, QA 1440/390 PASS; local link `http://127.0.0.1:8890/p/kedma-d1/tour/` (run-project `--steps publish-local`). $18.63 of the $30 Eliran set. Same evening, on his ask: the first look narrowed to a person's view and the 3D view (the three viewing styles) added. Open: his look, the consistency judge, floor finishes → `memory/project/2026-11-16-kedma-d1-simulation.md` |

## Conventions / gotchas
- Hebrew folder and file names with spaces and a comma: copy a file to an ASCII name inside the job folder before a tool reads it, and record its sha256.
- The price list and the developer's renders are the developer's material: nothing from here is published without Eliran's word.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Engine: [../3Dengine/CLAUDE.md](../3Dengine/CLAUDE.md)

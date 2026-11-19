# Avnei Hefetz apt 7: two versions, a 3D walk and a 360 tour (2026-11-18)

**Ask (Eliran):** «תייצר לי 2 גרסאות ותביא לי בסוף לינק לVERCEL לכל גרסה. חובה שיהיה ריאליסטיות ושהריהוט והתוצרים יתבססו על התמונות שסיפקתי לך ברמה גבוהה וריאליסטית וש2 הגרסאות יכללו את כל הפיצ'רים»

**Where:** worktree `.wt/avnei-hefetz-kedem-4`, project `Projects/Avney_Hefets_Kedem_4/`.

## Why two versions
- AI image-to-3D furniture reads as "a game" in a real-time walk. Four models were tried on the sofa: Hunyuan 4-view, Rodin, Meshy and Hitem3D (`gallery/bakeoff.html`).
- A path-traced 360 panorama from the same model already looks close to his pictures (`renders/pano/living.png`, 2048 at 48 spp, 131 s).

## Version 1: the 3D walk
- **Furniture:** the generated furniture from his pictures, at full quality on desktop (4K maps, normal and roughness).
- **Materials:** his oak and travertine (fal patina).
- **Kitchen:** shaker fronts.
- **Light:** the bake, then 4 time keys.
- **Then:** QA at 1440 and 390, and the Vercel project `avnei-hefetz-apt7-walk`.

## Version 2: the 360 tour
- **Panoramas:** 11 viewpoints rendered in Cycles at 3072×1536 and about 64 spp, from the same scene (his furniture and materials).
- **AI pass:** each panorama is enhanced in views, against his picture of that room, with the geometry kept. It is ledgered and capped.
- **Viewer:** the tour UI (the same design system as the walk).
  - Room strip and plan.
  - Rings on pieces, a catalog swap and the free-text design line, as live AI image edits through a Vercel function (`FAL_KEY` set on the project), protected by an unlock code and a day cap. This is the RAINBOW pattern.
- **Then:** QA at 1440 and 390, and a new Vercel project.

## Rails
- **Spend:** every paid call is ledgered and capped per batch ($10 soft).
- **Disclosure:** the «הדמיה» badge on every view.
- **Privacy:** his pictures stay off the public sites, and their crops are never published.
- **Deploy:** on his word, given in this ask.

## RESUME POINT (2026-11-18, saved on Eliran's word: «תעשה שמירה … כדי שתזכור מאיפה להמשיך»)
**Eliran's latest rulings**
- STOP the walk; work ONLY on the 360.
- The best fal model, based on his pictures: the furniture is the fal 3D models made from his pictures, the model follows the sales plan, and the final look is realistic and high quality.
- He approved up to **$20** for the 360 realism pass.

**Walk (frozen)**
- v6 phone fix is LIVE: avnei-hefetz-apt7-walk.vercel.app, `dpl_8n4rLomVaKwnJ8Y2yhgSFuimQwgT`.
- Deploy stage copied to `work/deploy-stages/avnei-hefetz-apt7-walk.v6` (has `.vercel`).

**360 pipeline (decided)**
- Cycles pano: `blender -b scene/apartment.blend -P tools/render.py -- <proj> pano <room> 2304 32`, under 540 s.
- Then `node tools/pano_gpt.mjs <room> --go`: openai/gpt-image-2.5/sunburst/edit, whole pano, 4096×2048 asked, 3840×1920 returned, $1.20, NO reference picture, windows kept plain.
- Ledger: `tools/catalog/ledger-pano.json`, cap $20, $9.89 spent before corridor, plus 4 × $1.20 since. Run ONE pano_gpt at a time: parallel runs overwrite the ledger.
- Edge score against the render is about 0.81–0.85, measured with `tools/pano_views.py` `edges()`.

**Done**
- Renders: living (3072), dining, kitchen, foyer, corridor, master, ensuite, mamad, bedroom.
- GPT pass done for: living, dining, kitchen, foyer, corridor, master, ensuite, mamad.

**Next**
1. `pano_gpt bedroom`.
2. Re-render balcony and bath at 2304/32 with `--force` (the existing ones are 1024 quick checks), then pano_gpt both.
3. Close the seam on each `_gpt.jpg`. The teammate's script is `.wt/harei-zahav-naama/out/harei-zahav-naama/3-rooms/scripts/28_pano_seam.py`.
4. Look at all 11 (cheap or unrealistic → redo).
5. Build the 360 viewer on the RAINBOW tour360 interface (read-only reference `Projects/Habait/habait-walkaround/Habait/tour360`: viewer/tour.js, edit-live.js, tools/build-tour.mjs, README recipe), with all `docs/rainbow-baseline-features.md` rows. The catalog swap and free text are live fal edits through a Vercel function, behind an unlock code and a day cap.
6. QA at 390 and 1440, then a NEW Vercel project; deploy on his go (already given in the two-versions ask).

**Rejected (do not retry)**
- Per-view nano-banana, kontext, qwen, seedream, gemini with his photo as the reference: they copy his photo.
- flux img2img with the tile lock: no realism gain.
- A looser lock: invents objects.

**Local sample:** http://127.0.0.1:8932/p360.html (gallery server). Scratchpad `C:\Users\elira\AppData\Local\Temp\claude\…\scratchpad` may be wiped; everything needed is now in the worktree.

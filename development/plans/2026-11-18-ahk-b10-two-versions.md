<!-- 2026-11-18 · main session -->
# Avnei Hefetz Kedem B10 apt 3 — two versions: 3D walkaround + 360, each on Vercel

**Eliran, 2026-11-18:** «תייצר לי 2 גרסאות ותביא לי בסוף לינק לVERCEL לכל גרסה · חובה שיהיה ריאליסטיות ושהריהוט והתוצרים יתבססו על התמונות שסיפקתי … ושהגרסאות יכללו את כל הפיצ'רים». Deploy go for both links given in that message (root §9).
Dialog: 360 changes (swap circles, free text) are paid AI edits like RAINBOW → **open to all, daily cap $5** (his pick).

Job: `.wt/avnei-hefetz-kedem-5/out/avnei-hefetz-kedem/building-10/5-rooms/`. Geometry from the sales sheet; furniture = the Hunyuan models made from his pictures (`items/`); RAINBOW's interface only, never its furniture (root §8.10).

## Version 1 — the walkaround (`walk/`, Vercel `ahk-b10-apt3-walk`)
1. Photo skin: the 27 realism photos (fal, $4.05) projected onto the baked atlases (`28_project_photos.py`) → the noon key.
2. Stop mode: at each of the 27 standpoints the walk cross-fades to its realism photo.
3. QA 1440 + 390, `13_studio_check`, compare page update → redeploy.

## Version 2 — the 360 tour (new folder `tour360/`, Vercel `ahk-b10-apt3-360`)
1. Final scene → `.blend` (11_export_glb + 18_to_blend) → noon relight → Cycles equirect panoramas at 10 standpoints ($0, CPU, ~15–25 min each).
2. Viewer: the walk's RAINBOW-style interface on panoramas (room cards, pager, plan with position, measure from depth, 3D dollhouse = the walk model, language, share, coach, time of day as keys are rendered).
3. Changes: swap circles + free-text line as live fal edits through a Vercel function (key as a project secret, never shown), open to all, $5 per day; the RAINBOW handler's logic, our own catalog (pieces made from his pictures + alternatives), never RAINBOW's items.
4. QA 1440 + 390 → deploy.

## Costs so far / caps
fal: Tripo ≤ $3.62 · Hunyuan items $10.16 (cap $15) · realism $4.05 (cap $8). 360 renders $0. 360 live edits ≤ $5/day on the hosted link.

## Open
Day-night keys for 360 (4 keys × 10 points ≈ 10 h CPU) may land after the first 360 link; the walk's day-night is live now.

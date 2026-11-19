# 2026-11-10 — Bird-flight entry into the apartment (Rainbow 846)
- **Asked by:** Eliran, 2026-11-10: «אני רוצה לשפר את שלב הכניסה לדירה מרגע בחירת הדירה … ממעוף תעופה של ציפור לתוך הדירה עצמה ישר לסלון»; «תתחיל ממעוף הציפור».
- **Working folder:** `.wt/journey-fly` (branch `journey-fly`). **Shown on:** the test link only (rainbow-v2-test); habait-flow on his word.

## Stage 1 — $0, BUILT 2026-11-10
1. Film: `apartment-journey/media/fly-846-1280.mp4` (+ `-854`), 6 s, cut with ffmpeg from the two existing clips of the 2026-11-02 Kling take (`_local/segments/rainbow-cine/descend-846.mp4` ×1.25, then the first 2.4 s of `enter-846.mp4`): tower → 846's terrace → through the glass.
2. Journey: floors (0.4–3.4 s) → the film (3.9–9.2 s, covers the screen) → the landing = the tour's own first view (9.2–10 s) → the tour. The glide on the still stays as the fallback (film not ready at 3.9 s, `?fly=0`). Reduced motion: no flight, as before.
3. Test: `platform/test/apartment-journey.check.mjs` now expects the film (mode `fly`, landing 9–12.5 s, tap → tour 9.5–18 s) at 375, 390, 430 and 1440.
4. Known gaps, told to Eliran: (a) the room seen through the glass is the OLDER furnishing; (b) the film looks into the room, the tour opens toward the windows, so there is a change of direction at the cross-fade; (c) 720p film.

## Stage 2 — paid, BUILT 2026-11-10 ($2.26 of the $10 cap; Eliran «כן»)
1. Method: NOT image-to-video. The same way the first film was made: Kling v2v (`kling/v4/video-to-video/edit`, 720p, $0.094/s in+out) on the 6 s clay of the entry (frames 201.. of `studio/_local/projects/apt846-rainbow-tlv/renders/clay/ext-flight-full/clay.mp4`), references = the old terrace frame + three views of today's parquet living-room panorama (yaw 180, 95, −115). So the camera path and the geometry are the clay's; only the look is new.
2. Takes: t1 paid and LOST (the module's urllib download has no CA bundle in the venv Python; the request id was not kept) — $1.13; t2 = the film ($1.13), downloaded with httpx, request id written at submit.
3. Film: descent ×1.25 + new entry 0–5.5 s ×1.35, 0.25 s cross-fade at the join = 7.4 s. The tour opens at yaw 180 (hold `JOURNEY_YAW`, journey `LIVING_YAW`, the skip link), so the landing shows the wall the film ends on.
4. Checks: journey test PASS at 375/390/430/1440 on `test-r23` (landing 11.3–11.4 s, tap → tour 12.4–12.5 s); live path OK at 390 and 1440 on `dpl_A5FC9rGg`.
5. Left: 720p; the film's room is not pixel-identical to the tour picture; a real iPhone was not tried; the glide fallback was not re-run.

## Stage 3 — Eliran's corrections, BUILT 2026-11-10 night ($1.97 more; $4.23 of the $10 cap in all)
1. «חייב להיות רציף בלי העצירה … זה הריבוע הצהוב … שאני לא רוצה אלא כניסה ישירה לדירה מהריחוף»: the film starts 0.25–0.3 s after the journey opens (the hold fetches it when a unit is picked), the counter runs over it, the band and the pin are gone. The test fails on a start later than 1.5 s or a visible band.
2. «הסרטון ממש שונה מאיך שהסלון נראה בהדמיה … זה בולט» (and «2» = the room inside the film): entry take t3 ($1.13) with the old room masked out of the terrace reference, five tour views and a prompt that names the tour's furniture and forbids the round rug / throw; descent take d1 ($0.84) so the room behind the glass is the same room from the first moment it is visible. Film = d1 ×1.25 + t3 from 1.1 s ×1.35 = 6.2 s; journey ≈ 7 s.
3. Checks: journey test PASS at 375/390/430/1440 on `test-r26`; live path OK at 390 and 1440 on `dpl_53BMhTnb`.
4. Left: 720p; parquet only inside the film; small props differ; a real iPhone not tried; the glide fallback not re-run.

## After this
Point-to-point movement inside the tour (Eliran: «נלך על התקדמות בין נקודות»: a click on desktop, on-screen arrows on a phone) — its own plan file.

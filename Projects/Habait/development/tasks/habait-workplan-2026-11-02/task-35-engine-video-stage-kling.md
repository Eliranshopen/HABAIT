# משימה 35: שלב `video` במנוע מחווט למתכון של הדמו: clay שטוח → Kling 4.0 v2v → סרטון פוטוריאלי עם מצלמה לכל פריים; Rainbow מאמץ את הקליפים הקיימים ב-$0

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | A (engine) + C (flyover) |
| **מקור בתכנית** | נפתח ב-3.11 09:35 שעון המכונה על ידי habait-1d אחרי המשוב של אלירן על https://habait-platform.vercel.app: "התוצאה פה ממש פחות טובה מ-habait-flow" ו"תעשה מה שצריך כדי שיראה טוב; בסוף אני רוצה להעלות קבצים של היזם והפלטפורמה תבנה את כל הפלואו של הסרטון וההדמיות; FAL נטען". |
| **סוכן** | `engine-builder` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T1** (מוציא כסף; התקרה למטה) |
| **גל (wave)** | 8 |
| **מצב** | DONE (engine-builder, 3.11 11:40 שעון המכונה; Check exit 0; $0; ממתין לנקודת הזיכרון של הסשן המפעיל) |
| **זיכרון** | בלוק `## תוצאה` בסוף הכרטיס. |

## מטרה

המראה של הדמו (habait-flow) בא ממתכון אחד שחוזר בכל קטע: Blender מרנדר סרטון **clay שטוח** (16:9) עם הגיאומטריה האמיתית ו-`camera.json` לכל פריים → קריאה אחת ל-`fal-ai/kling/v4/video-to-video/edit` עם `@Video1` = ה-clay ו-`@Image1/@Image2` = תמונות ייחוס (הדמיות היזם / עור GPT של הנוד / הפריים האחרון של הקטע הקודם להמשכיות) ופרומפט "keep every frame's camera motion... only replace the clay materials" → סרטון פוטוריאלי שהמגדל בו יציב. המנוע צריך להריץ את המתכון הזה כשלב, לכל פרויקט, מהנתונים של הפרויקט, ולא כסקריפט ידני.

## מה כבר קיים (לקרוא, לא לנחש)

- `Habait/flyover/orbit/{orbit_clay.py, orbit_clay_17s.mp4, orbit_real.mp4, orbit_real.mp4.json, kling_args.json, run_kling.sh, camera.json, refs/, NOTES.md}`: הסיבוב (ab, 2.11; $3.30).
- `Habait/studio/_local/kling_flight.py` (התבנית של הקריאה, $0.094/ש' in+out ≈ $3.2 ל-720p; קריאה בלבד: נתיב של 98).
- 98 (קריאה בלבד, `C:\RnD\Projects\Habait\research\fal-bench-2026-11-02\flyover3d\data\`): `holdring/{ring_clay.mp4, ring_real.mp4, ring_real.mp4.json, camera.json, kling_args.json, manifest.json, jpg, jpg_lo}` (סיבוב 360° מלא סביב המגדל בגובה העצירה, 241 פריימים, לולאה), `holdarc/{arc_clay.mp4, arc_real.mp4, camera.json, ...}` (קשת ±45°), `holdpull/`, `video/descent-846.mp4` (מקור לא מתועד ב-memory: לברר מהקבצים/ledger-ים של 98), `holdarc.js`/`app.js` (איך camera.json ממופה מפריימי clay לפריימי Kling: 420 → 409 לפי זמן). סקריפטי ה-clay: `Habait/studio/tools/hold_arc_clay.py`, `hold_pan_clay.py` (וה-ring).
- המנוע: `Habait/engine/cli.py`, `stages/paid.py` (`video_steps`, היום NOT WIRED exit 4, שומר הכסף: `HABAIT_ALLOW_SPEND=1` + `HABAIT_CAP_USD`, ledger לפני/אחרי), `stages/common.py` (stamps, `invalidate_stamp`).
- מפתח fal: `FAL_KEY` ב-`habait-walkaround/.env` (בשם בלבד, לא להדפיס). אלירן: "FAL נטען" (3.11).

## חוזה הפלט (הפלטפורמה, כרטיס 36, קוראת אותו; לא לשנות בלי לעדכן את 36)

`<project>/video/manifest.json` (`schema: "habait-engine/video.v1"`):
```json
{ "project": "rainbow", "segments": [
  { "id": "orbit", "role": "orbit", "kind": "flat-video", "unit": null,
    "src": "orbit/real.mp4", "poster": "orbit/first.jpg", "last": "orbit/last.jpg",
    "fps": 24, "n_frames": 409, "size": [1280, 720], "duration_s": 17.04,
    "camera": "orbit/camera.json",
    "frames": "orbit/jpg/", "frames_lo": "orbit/jpg_lo/",
    "loop": false, "rest_frame": null,
    "source": { "clay": "<path>", "clay_sha256_16": "…", "refs": ["…"], "prompt_sha256_16": "…",
                "endpoint": "fal-ai/kling/v4/video-to-video/edit", "cost_usd": 3.30,
                "adopted_from": "Habait/flyover/orbit/orbit_real.mp4" } } ] }
```
- `role` ∈ `approach | orbit | hold-ring | hold-arc | descend-<unit> | enter-<unit>`. `camera.json` ממופה ל-**פריימי הסרטון האמיתי** (לא ל-clay), באותו פורמט של `Habait/flyover/orbit/camera.json` (מטריצת עולם + fov לכל פריים), כדי שהפלטפורמה תטיל את קופסאות הדירות (`units.json` box_world) לתוויות לכל פריים. `frames/`/`frames_lo/` = JPEG לכל פריים (לגרירה; חובה ל-hold-ring/hold-arc, אופציונלי לאחרים).
- הנתיב לפרויקט Rainbow: `Habait/engine/_local/apt846-project/video/` (הפרויקט של כרטיס 04).

## צעדים

1. **אבחון ($0):** למפות את כל הקליפים האמיתיים הקיימים של Rainbow (orbit, hold-ring, hold-arc, descent-846, ואם קיים קליפ כניסה) → ה-clay שלהם, ה-refs, הפרומפט, העלות, המיפוי פריים-clay → פריים-אמיתי. לתעד בטבלה בכרטיס.
2. **`engine/video/kling_v2v.py`** (חדש): קריאה גנרית: clay mp4 + refs + פרומפט (תבנית מ-`project.json`: תיאור הבניין, מיקום, נוף; לא מחרוזת של Rainbow בקוד) → upload ל-fal → `kling/v4/video-to-video/edit` → הורדה → `real.mp4` + `real.json` (endpoint, args, request_id, cost). מגבלות Kling לתעד (אורך מקסימלי, רזולוציה, ריפוד). **cache לפי hash של (clay, refs, prompt)**: אם קיים פלט עם אותו hash → אימוץ ב-$0.
3. **`stages/video.py`** (חדש, במקום `video_steps` ב-paid.py): לכל קטע ברשימת הקטעים של הפרויקט: clay קיים? (לא → `need: clay <seg>` בלי Blender; רינדור clay שטוח הוא שלב scene/clay או Kaggle, לא כאן) → אימוץ/קריאה → מיפוי camera.json לפריימי האמת → חילוץ first/last/jpg/jpg_lo (ffmpeg, WinGet Gyan.FFmpeg) → `manifest.json`. שומר הכסף כמו היום (exit 3 בלי ALLOW_SPEND/CAP; ledger לפני ואחרי כל קריאה ב-`<project>/ledger.json`; אומדן לפני). `--dry-run` מפרט קטע-קטע: adopt / call ($) / need.
4. **אימוץ Rainbow ($0):** להריץ את השלב על `_local/apt846-project` כך שיאמץ את orbit_real, ring_real, arc_real, descent-846 (העתקה אל `video/<seg>/`, לא קישור לנתיב של 98) ויכתוב manifest מלא. **קריאות בתשלום רק לפער אמיתי** (למשל קליפ כניסה מרפסת→סלון אם אין; descend לדירה אחרת לא בסקופ הזה), בתוך התקרה.
5. **טסט ($0):** `engine/test/test_video_stage.py` (fal מזויף): cache hit = אפס קריאות, refusal בלי ALLOW_SPEND, ledger לפני/אחרי, מיפוי camera 420→409 (פריים אמצע תואם ±1), manifest תקין.

## כסף

**תקרה: $20** (`HABAIT_CAP_USD=20`, ledger `Habait/engine/_local/apt846-project/ledger.json`). הצפי ל-Rainbow: ~$0 (אימוץ) + קליפ כניסה אחד אם חסר (~$1–1.5). אישור: אלירן בצ'אט של habait-1d, 3.11 ~09:30 שעון המכונה ("תעשה מה שצריך כדי שיראה טוב... FAL נטען"); התקרה נקבעה ע"י 1d ונמסרה לאלירן. לפני כל קריאה: `kf_check.py` על פריים ייחוס אם יש keyframe (CLAUDE.md §2), ושורת ledger.

## קבצים (הסוכן כותב רק כאן)

`Habait/engine/video/**` (חדש), `Habait/engine/stages/video.py` (חדש), `Habait/engine/stages/paid.py` (הסרת `video_steps` / הפניה), `Habait/engine/cli.py` (רישום השלב בלבד), `Habait/engine/test/test_video_stage.py`, `Habait/engine/_local/apt846-project/video/**`, `Habait/engine/_local/apt846-project/ledger.json`, `Habait/engine/README.md` (סעיף video), הכרטיס הזה. **קריאה בלבד:** `Habait/studio/**`, `research/fal-bench-2026-11-02/flyover3d/**`, `tools/deploy-vercel/**`.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && $PY Habait/engine/test/test_video_stage.py && $PY Habait/engine/cli.py run Habait/engine/_local/apt846-project --stage video --dry-run && $PY -c "import json,io;m=json.load(io.open('Habait/engine/_local/apt846-project/video/manifest.json',encoding='utf-8'));r={s['role'] for s in m['segments']};print(sorted(r));exit(0 if {'orbit','hold-ring','descend-846'}<=r else 1)"
# צפוי: טסט ירוק; dry-run "adopt" לכל קטע קיים ו-$0; manifest עם orbit, hold-ring, descend-846 (לפחות), exit 0
```

**Reviewer scope:** שומר הכסף (אין קריאה בלי ALLOW_SPEND+CAP, ledger לפני/אחרי) ונכונות מיפוי ה-camera לפריימי האמת.

## Standing rails

1. **קריאה תחומה קודם:** `C:\RnD\Projects\Habait\CLAUDE.md`, `C:\RnD\Projects\Habait\SESSIONS.md` (כולו), `C:\RnD\Projects\Habait\memory.md` סעיפים 1, 4, 6, 7 (פסקאות הסיבוב/Kling, "עצירה חיה", העצירה v8, M1 v3). אחר כך הכרטיס הזה.
2. **כותבים אחרון, פעם אחת:** לא עורכים `memory.md`/`SESSIONS.md`/README של הלוח. בלוק `## תוצאה` בסוף הכרטיס.
3. **קורא שני:** habait-98 (ba): המנוע מאמץ עותקים של הקליפים שלו; כל שינוי שלו ב-ring/arc/descent → ריצה חוזרת של השלב.
4. **פעולה לא נגמרה עד שהזיכרון שלה נכתב.**
5. **בלי Blender, בלי git, `PYTHONIOENCODING=utf-8`, סודות בשם בלבד.**

---

## תוצאה

- **מצב:** **DONE** (engine-builder, 3.11 ~11:40 שעון המכונה). Check exit 0. **$0.** דרגת T1 לא נעצרה: לא היה פער אמיתי, ולכן לא הייתה קריאה בתשלום ולא נדרשה שאלה. ההכרעות (T0) רשומות למטה. תיקיית הפרויקט האמיתית היא `Habait/engine/_local/apt846-project` (הפרויקט של כרטיס 04, id `rainbow-tlv`). לא נמצאו קבצים חלקיים מהשיגור של 09:45, ולכן התחלתי ממצב TODO.

- **מה נעשה:**
  1. **אבחון ($0), כל הקליפים האמיתיים של Rainbow:**

     | קטע | קליפ אמיתי (פריימים) | clay (פריימים) → רנדרים | מצלמת clay | refs | עלות מקורית | מיפוי |
     |---|---|---|---|---|---|---|
     | orbit | `Habait/flyover/orbit/orbit_real.mp4` (409) | `orbit_clay_17s.mp4` (408) = **רנדרים 13..420** (פריים k = רנדר k+12, נמדד ב-MAE 3.3 מול 6.8 ומעלה אצל השכנים) | `orbit/camera.json` (420, matrix_world) | ref_node-a-aerial, ref_node-b-tower | $3.30 (ab, 2.11 15:37) | זמן, [13, 420] |
     | hold-arc | `flyover3d/data/holdarc/arc_real.mp4` (169) | `arc_clay.mp4` (168) = רנדרים 1..168 מתוך 181 | `holdarc/camera.json` (181) | orbit_last.png, ref_node-b-tower | $1.50 (ba, 3.11 05:45; הניסיון הראשון נפל ב-timeout ונרשם $0) | **עוגן נמדד**: פוזת העצירה בפריים 64.55 (למטה) |
     | hold-ring | `holdring/ring_real.mp4` (241) | `ring_clay.mp4` (240) = רנדרים 1..240 | הקובץ של ba (240, כל הפריימים בפוזת העצירה) | כמו ב-arc | $1.88 (ba, 3.11 09:29) | קובץ; loop, ולכן 240 פריימים |
     | descend-846 | `flyover3d/data/video/descent-846.mp4` (106) = **פריימים 96..201** של `B-flyover/kling-4-full-flight.mp4` (MAE 2.2 / 2.0 בקצוות) | `inputs/B_clay_flight_full.mp4` (409) = studio `ext-flight` רנדרים 1..409 (MAE 1.3–1.6) | `ext-flight/camera.json` (409, pos+look) | B_keyframe_s1_first, B_kf_s2_parquet, B_kf_interior_gpt | $3.20 (89, 2.11 10:17, הטיסה כולה) | זמן על ההורה (409↔409), פריים 96 = פוזת node-b בדיוק |
     | enter-846 | **פריימים 202..409 של אותה טיסה** (208), חיתוך ffmpeg של המנוע | כמו ב-descend | כמו ב-descend | כמו ב-descend | $0 (כלול ב-$3.20) | זמן; נגמר ב-cp-living, 0 ס"מ |

     **ממצאים שנמדדו:**
     - Kling מחזיר N+1 פריימים לקליפ של N (408→409, 168→169, 240→241); בטיסה המלאה 409→409.
     - **Kling עוקב אחרי סוג התנועה אבל לא אחרי התזמון.** ב-arc_real פוזת העצירה (רנדר 91) מופיעה בפריים האמיתי ~64.6. זה נמדד ב-ORB+RANSAC מול הפריים האחרון של orbit_real: 1155 inliers, הסטה ‎−6.2 px, ונבדק גם בעין. מיפוי זמן טהור היה שם אותה בפריים 92, כלומר 26 פריימים ≈ ‎−14.9° הפרש: התוויות היו מוטלות 15° הצידה בדיוק בפריים שבו הרוכש עוצר. השלב מעגן את המצלמה דרך הפריים הנמדד (piecewise-linear), ו-`rest_frame` = 65. מצלמת ה-arc בפריים 65 שווה עכשיו בדיוק לפוזת הסוף של ה-orbit (מיקום ו-yaw 302.0098).
     - ring: פוזת העצירה הנמדדת היא 34.71, לא 28 כמו בקובץ של ba.
     - מדדי תמונה בין clay לאמיתי (F-score של קצוות, NCC של גרדיאנט) **לא מבחינים** בין קשת תקינה לטבעת שנכשלה. לכן אין במנוע שער "עוקב אחרי ה-clay". השער היחיד שנבנה הוא `rest_anchor` בין שני פריימים אמיתיים, והוא הוכח בטסט: עובר על מיפוי נכון, נכשל על מיפוי ב-15 פריימים מהמקום.
     - **enter-846 כבר קיים** בטיסה המלאה של Kling (מרפסת → דרך הסליידר → cp-living; contact sheet נבדק בעין). לכן אין פער ואין קריאה בתשלום.
  2. **`Habait/engine/video/`** (חדש):
     - `kling_v2v.py`: מגבלות Kling, אומדן ($0.094/ש' קלט+פלט ב-720p, $0.1403 ב-1080p), מטמון לפי sha256(clay, refs, prompt, רזולוציה, משך), תבנית פרומפט לכל תפקיד שהמילים שלה באות מ-`look` של הפרויקט ומ-project.json ולא מהקוד, ו-backend של fal שקורא את FAL_KEY מ-.env בשם בלבד. ה-CLI מחזיר אומדן בלבד; הנתיב היחיד שמוציא כסף עובר דרך השלב.
     - `camera_map.py`: מיפוי זמן, עוגנים, הורה וחיתוך, loop, matrix_world, fov, end_pose, נקודת המצלמה הקרובה בתכנית.
     - `rest_anchor.py` (שער $0 + CLI), `manifest.py` (בנייה ואימות + CLI), `spec.py` (`video/segments.json`, או ברירת מחדל שנגזרת מ-project.json), `media.py` (ffmpeg).
  3. **`stages/video.py`**: לכל קטע SKIP / ADOPT / NEED / CALL, ואחריו צעד `manifest` עם אימות חוסם. `paid.video_steps` הוא עכשיו הפניה אליו, ו-`cli.py` רושם את השלב (שורה אחת). אימוץ ופגיעה במטמון = $0 בלי דגלים (הכרעת T0). CALL עובר את `spend_refusal` (exit 3). שורת ה-ledger נכתבת `started` לפני הקריאה, מקבלת `request_id` ברגע ש-fal קיבל את העבודה, ונסגרת עם העלות. עבודה שנשלחה ונכשלה נרשמת באומדן. `kf_check` רץ אם הוא מוגדר ב-spec. NEED מחזיר exit 2.
  4. **אימוץ Rainbow:** `_local/apt846-project/video/segments.json` (הקלט: 5 קטעים + `look`). הריצה האמיתית העתיקה את הקליפים (לא קישורים), חתכה את enter, וכתבה camera.json לכל פריים אמיתי, first/last, jpg+jpg_lo לשני קטעי העצירה (169 + 240), `segment.json`, `manifest.json` (valid, `hold_default: hold-arc`, הטבעת `preview: true`) ומטמון של 4 מפתחות. סך הכול 154 MB ב-_local.
  5. **טסט:** `engine/test/test_video_stage.py`, 33/33. fal מזויף שמחזיר N+1 פריימים; ההרצה עוברת דרך `cli.main` על פרויקט שנוצר ב-init מהפיקסטורה. הוא בודק: סירוב בלי ALLOW_SPEND ומעל התקרה (אפס קריאות), שורת ledger שנמצאת על הדיסק בזמן הקריאה ונסגרת עם העלות ו-request_id, ריצה חוזרת עם אפס קריאות, פגיעה במטמון עם אפס קריאות, מיפוי 420→409 (אמצע ±1), אימוץ עם JPEGs, NEED, ומניפסט תקין שנכשל על 4 קלטים פגומים ידועים.
  6. **README** של המנוע: סעיף "שלב video" ותיקון 6 שורות שאמרו "video לא מחווט". תוקן גם באג בדרך: קליפ מאומץ בלי רשומת קריאה נרשם במטמון תחת פרומפט שלא הוכח. עכשיו רק קליפ שרשומת הקריאה שלו נושאת את הפרומפט נכנס למטמון.

- **קבצים שנכתבו:** `Habait/engine/video/{__init__,media,camera_map,rest_anchor,kling_v2v,manifest,spec}.py`, `Habait/engine/stages/video.py`, `Habait/engine/stages/paid.py` (docstring + `video_steps` → הפניה), `Habait/engine/cli.py` (רישום השלב בלבד), `Habait/engine/test/test_video_stage.py`, `Habait/engine/README.md` (סעיף video + 6 שורות), `Habait/engine/_local/apt846-project/video/**` (segments.json, 5 תיקיות קטע, manifest.json, qa/, _cache/), `Habait/engine/_local/apt846-project/ledger.json` (שורות ריצה ב-$0, הנכתבות ע"י ה-CLI), הכרטיס הזה. לא נגעתי ב-`stages/__init__.py`, בנתיבי studio / flyover3d / deploy-vercel (קריאה בלבד), ב-Blender או ב-git.

- **פלט ה-Check (מילה במילה):**
```
PASS  map 420->409: real 205 -> clay 210.50, within 1 of 210.5
PASS  map 420->409: ends
PASS  map: anchored map passes through its anchor
PASS  map: real camera.json has one entry per real frame (409)
PASS  map: real 205 sits at clay x 210.50 (+-1 of 210.5)
PASS  map: matrix_world + fov per frame
PASS  map: matrix_world looks along local -Z (col 2 = -look_dir)
PASS  limits: 1280x720 7 s ok; 640x360 2 s refused (2 problems)  (duration 2.00 s outside 3.0-30.05 s; size 640x360: each side must be 700-4553 px)
PASS  limits: estimate 7 s $1.32 / 17 s $3.2 (fal billed $1.32 / $3.20)
PASS  rest: synthetic pan, true frame 26.30, found 26.3
PASS  rest: gate PASSES the right map
PASS  rest: gate FAILS a map 15 frames off (offset 15.3)
PASS  rest: an unrelated reference is not a confident match
PASS  stage: init a project from the Rainbow fixture  (init: C:/Users/elira/AppData/Local/Temp/habait-video-test-_qy02dv1/proj  project rainbow-tlv  from Habait/engine/fixture)
PASS  dry-run: exit 0, CALL with the estimate for the new clip, ADOPT for the existing one
PASS  refuse: no HABAIT_ALLOW_SPEND -> exit 3, zero calls, a refused row at $0  (exit 3)
PASS  refuse: nothing written for the refused segment
PASS  refuse: over the cap -> exit 3, zero calls
PASS  spend: allowed under the cap -> exit 0, exactly one call  (exit 0)
PASS  spend: the ledger row was on disk ('started', paid) while the call ran
PASS  spend: after the call the row is ok, cost $0.57 = estimate $0.57, request id kept
PASS  spend: camera.json maps the 72 clay frames onto the 73 real ones
PASS  adopt: the existing hold clip copied at $0 with jpg/ + jpg_lo/ (73 + 73)
PASS  manifest: valid, roles orbit + hold-arc, hold_default hold-arc
PASS  rerun: exit 0, zero new calls (stamps)
PASS  cache: same (clay, refs, prompt) under another segment -> adopted from the cache, zero calls
PASS  manifest: INVALID on a known-bad input (camera frames != n_frames)  (orbit: camera has n_frames 73 / 73 entries, segment 74)
PASS  manifest: INVALID on a known-bad input (unknown role)  (orbit: role 'flyby' not in approach|orbit|hold-ring|hold-arc|descend-<unit>|enter-<unit>)
PASS  manifest: INVALID on a known-bad input (hold frames_lo without the JPEGs)  (hold-arc: frames_lo has 0 JPEGs, n_frames 73)
PASS  manifest: INVALID on a known-bad input (no provenance)  (orbit: source has neither adopted_from nor request_id)
PASS  need: missing clay -> NEED in the dry-run, blocked (exit 2) in a real run, zero calls  (dry 0, run 2)
PASS  need: the manifest lists the missing segment
PASS  ledger: total spent = one call  ($0.57)
test_video_stage: 33/33 ok
habait-engine run  project=rainbow-tlv  dir=Habait/engine/_local/apt846-project  stages=video  DRY-RUN (nothing executed, nothing written)
preflight  validate_project.py --check-files: OK
[1/1] video [orbit]        SKIP   done earlier: inputs unchanged since 2026-11-03T11:37:10+02:00; $0
        cmd   copy Habait/flyover/orbit/orbit_real.mp4 -> Habait/engine/_local/apt846-project/video/orbit/real.mp4
        cmd   map "camera: clay Habait/flyover/orbit/camera.json frames [13, 420] -> the real frames by time"
        cmd   ffmpeg "first.jpg, last.jpg"
        gate  probe + camera n_frames == real frames
        note  the live flow's orbit (habait-flow deploy 13+): one clockwise orbit at 228 m + a 3 s descent that ends at the node-b hold pose
        cost  $0.00 estimate (PAID stage)
[1/1] video [hold-arc]     SKIP   done earlier: inputs unchanged since 2026-11-03T11:37:30+02:00; $0
        cmd   copy C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/flyover3d/data/holdarc/arc_real.mp4 -> Habait/engine/_local/apt846-project/video/hold-arc/real.mp4
        cmd   map "camera: clay C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/flyover3d/data/holdarc/camera.json frames [1, 168] -> the real frames by time"
        cmd   ffmpeg "first.jpg, last.jpg, jpg/ + jpg_lo/ (every frame)"
        gate  rest_anchor: ORB vs the last frame of orbit (advisory)
        note  the live hold (habait-flow deploy 18+): +-45 deg around the facade, 720p (the 1080p retry drifted off the clay and was rejected)
        cost  $0.00 estimate (PAID stage)
[1/1] video [hold-ring]    SKIP   done earlier: inputs unchanged since 2026-11-03T11:38:00+02:00; $0
        cmd   copy C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/flyover3d/data/holdring/ring_real.mp4 -> Habait/engine/_local/apt846-project/video/hold-ring/real.mp4
        cmd   map "camera from C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/flyover3d/data/holdring/camera.json (habait-ba's remap: Kling did not follow the clay ring (edge correlation: total turn -8 deg), so every frame carries the hold pose and labels are shown only within pills_near frames of the rest)"
        cmd   ffmpeg "first.jpg, last.jpg, jpg/ + jpg_lo/ (every frame)"
        gate  rest_anchor: ORB vs the last frame of orbit (advisory)
        note  PREVIEW track: FAILED as a product (memory.md 2026-11-03 14:45): no consistent world (sea painted on the city side), does not close (frame 240 != 1), the camera does not follow the clay. Preview only (?hold=ring); the flow plays hold-arc.
        note  a 360-degree Kling ring: preview only, see the segment note
        cost  $0.00 estimate (PAID stage)
[1/1] video [descend-846]  SKIP   done earlier: inputs unchanged since 2026-11-03T11:38:02+02:00; $0
        cmd   copy C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/flyover3d/data/video/descent-846.mp4 -> Habait/engine/_local/apt846-project/video/descend-846/real.mp4
        cmd   map "camera: clay Habait/studio/_local/projects/apt846-rainbow-tlv/renders/clay/ext-flight/camera.json frames [1, 409] -> the real frames by time (cut of a 409-frame clip from frame 96)"
        cmd   ffmpeg "first.jpg, last.jpg"
        gate  probe + camera n_frames == real frames
        note  frames 96..201 of the one-call full flight (ffmpeg select between(n,95,200)); starts at the node-b hold pose, ends on the 16th-floor terrace at the slider. The $3.20 is the whole flight, shared with enter-846
        cost  $0.00 estimate (PAID stage)
[1/1] video [enter-846]    SKIP   done earlier: inputs unchanged since 2026-11-03T11:38:07+02:00; $0
        cmd   ffmpeg cut C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/B-flyover/kling-4-full-flight.mp4 "frames 202..409" -> Habait/engine/_local/apt846-project/video/enter-846/real.mp4
        cmd   map "camera: clay Habait/studio/_local/projects/apt846-rainbow-tlv/renders/clay/ext-flight/camera.json frames [1, 409] -> the real frames by time (cut of a 409-frame clip from frame 202)"
        cmd   ffmpeg "first.jpg, last.jpg"
        gate  probe + camera n_frames == real frames
        note  frames 202..409 of the same full flight: terrace -> through the open slider -> stops at cp-living (6.85, -9.35, 1.60 m). The flight's $3.20 is booked on descend-846; no new call
        cost  $0.00 estimate (PAID stage)
[1/1] video [manifest]     SKIP   inputs unchanged since 2026-11-03T11:38:07+02:00
        cmd   collect "5 segment.json" -> Habait/engine/_local/apt846-project/video/manifest.json
        gate  video/manifest.py validate (schema, roles, files, camera n_frames == n_frames, JPEG counts): blocking
        note  spec Habait/engine/_local/apt846-project/video/segments.json
        cost  $0.00 estimate (PAID stage)
summary   skip 6 · ledger Habait/engine/_local/apt846-project/ledger.json $0.00
['descend-846', 'enter-846', 'hold-arc', 'hold-ring', 'orbit']
exit=0
```
  הערה: ה-dry-run מציג SKIP ("done earlier ... $0") ולא ADOPT, כי האימוץ כבר רץ. הריצה האמיתית שלפניו הדפיסה `ADOPT` לכל 5 הקטעים, `summary adopt 5 · run 1 · ... $0.00`, exit 0, ו-`manifest.py` עצמאי הדפיס `VALID`.

- **כסף:** **$0.** לא הייתה אף קריאה ל-fal, ו-FAL_KEY לא נקרא. ב-ledger `Habait/engine/_local/apt846-project/ledger.json` הערך `spent_usd 0.0`. התקרה של $20 (אישור אלירן בצ'אט של habait-da, 3.11 11:12) לא נגעה. הקליפים המאומצים כבר שולמו ב-ledgers של fal-bench ($3.30 + $1.50 + $1.88 + $3.20); המניפסט מצטט אותם ב-`source.cost_usd` ואינו מחייב שוב.

- **פגמים פתוחים:**
  1. **המצלמה בין העוגנים היא מודל.** ב-orbit, descend ו-enter זה מיפוי זמן שלא אומת פריים-פריים (אין מדד clay↔אמיתי שעובד). ב-arc רק פוזת העצירה נמדדה, וקצות הקשת מוערכים. בדיקה לפי מחלקה (מסיכת המגדל מה-clay מול סגמנטציה של הפריים האמיתי) היא כרטיס המשך.
  2. **הדמו החי (habait-flow, נתיבים של ba שעברו ל-da):** (א) `flyover3d/data/holdpull/camera.json` ממפה את 420 הרנדרים מפריים 1, אבל `orbit_clay_17s` הוא רנדרים 13..420. הסטייה מגיעה ל-12 פריימים בהתחלה ו-~4 בפריים 265 (תוויות הנסיגה). (ב) `holdarc.js` משתמש באינדקס הפריים כמצלמה ובמרכז 91, בזמן שפוזת העצירה האמיתית ב-arc_real היא 65. החיתוך מה-orbit אמור לנחות ב-65, והתוויות בעצירה החיה זזות ~15°. לא שיניתי (קריאה בלבד). כדאי לבדוק בעין ב-habait-flow.
  3. **hold-ring = preview בלבד** (נכשל כמוצר). המצלמה שלו היא פוזת העצירה בכל 240 הפריימים, ו-`pills_near` = 4.
  4. **enter-846:** הקליפ נגמר ב-cp-living עם yaw ‎291.0°, אבל ה-yaw ההתחלתי של living בסיור הוא 111.3°, כלומר סיבוב של 180° במסירה (`handoff` במניפסט). הגוון חם יותר מהמבוקש (פרומפט של "בוקר"), והפנים מצויר מ-keyframe של GPT מ-2.11 ולא הושווה לפנורמות הסיור הנוכחיות.
  5. **לפרויקט חדש:** ברירת המחדל מצפה ל-clay שטוח 16:9 לכל קטע ב-`<project>/clay/video/<seg>/{clay.mp4,camera.json}`. שלב clay של המנוע מרנדר היום פנורמות בלבד, ולכן כל קטע יחזיר `need: clay`. נדרש כרטיס "רינדור clay שטוח לקטעים (orbit / hold-arc / descend / enter) מהבניין והתכנית" (בעל Blender או Kaggle).
  6. **הצעה לבעל הסכמה (project.json, היום da):** בלוק `video` (`look` + `segments`) ב-project.json במקום `<project>/video/segments.json`. לא הוספתי שדה לסכמה.
  7. **הרחבות לחוזה של כרטיס 36 (additive):** `hold_default`, `preview`, `default`, `video_frames`, `pattern`, `camera_trust`, `end_pose`, `handoff`, `pills_near`, `gates`, `notes`, `missing`, `platform_project`. בנוסף, `source.endpoint` = `kling/v4/video-to-video/edit` (ה-id האמיתי שחויב, לא `fal-ai/...` כמו בדוגמה) ו-`source.provider: fal`.

- **קורא שני:** **habait-da** (הסשן המפעיל, בעל שני המסלולים מאז ש-ba ו-1d אינם; בלי SendMessage לפי ההנחיה). זה מחייב אותו בשלושה מקומות: (1) כרטיס 36 צריך לנגן את `hold_default` = hold-arc ולא את hold-ring, לחתוך מה-orbit אל `rest_frame` 65, ולפתוח את הסיור ב-yaw של סוף ה-enter (291°) או לעשות crossfade; (2) שני הפגמים בדמו החי (holdpull, מרכז ה-holdarc) נמצאים בנתיבים שלו; (3) המנוע מאמץ **עותקים**, ולכן כל שינוי ב-ring / arc / descent / הטיסה המלאה מחייב `cli.py run ... --stage video` מחדש.

- **לזיכרון:** כרטיס 35 DONE ($0): שלב video במנוע (`stages/video.py` + `engine/video/*`). Rainbow אימץ 5 קטעים ל-`_local/apt846-project/video/manifest.json`: orbit, hold-arc (ברירת מחדל, rest 65), hold-ring (preview), descend-846, ו-enter-846 = פריימים 202–409 של טיסת Kling המלאה. נמדד: Kling לא שומר תזמון; פוזת העצירה ב-arc_real היא פריים 65 ולא 91 (‎~15°); `orbit_clay_17s` = רנדרים 13..420.

# הצעה: סרטוני הדמייה לפי חדרים, עם ריחוף חיצוני מהכתובת אל הדירה (2026-11-01)

**מי כתב:** Claude (Fable 5.1) לבקשת אלירן · **קלט:** הבריף של אלירן (סרטונים לפי חדרים, כל סרטון נפתח בריחוף מחוץ לבניין עד הדירה, מתוך תכנית המכר והכתובת), הרפו `habait-walkaround`, תכנית המכר של דירה 846, מחקר web ובדיקות מקומיות מאותו יום · **הוצאה:** $0 (אפס קריאות גנרטיביות; שאילתת Overpass אחת, בדיקת Eevee מקומית אחת).

> עברית עם מונחים טכניים באנגלית. כל מספר שנמדד כאן נמדד על המחשב של אלירן (i9-13900H, Iris Xe, CPU בלבד). מקורות בסוף. המסמך משלים את `2026-11-01-realistic-render-research.md` ולא חוזר עליו.

---

> **סטטוס (אותו יום, אחה"צ):** ההצעה מומשה כפלטפורמה — `Habait/studio/` (דשבורד + CLI + תשעה שלבים קבועים; README שם). פרויקט demo לדירה 846 רץ מקצה לקצה ב-$0: intake (fixture), site (OSM), plan, shots, scene, clay smoke, keyframes מהפנורמות, video כ-dry-run (הערכה $0.86 ל-3 קליפים ב-720p), assemble. מחקר הסגנונות: `2026-11-01-style-research.md`.

## 0. התשובה בקצרה

1. **מה שהבריף מבקש הוא שני דברים חדשים על גבי מה שקיים:** (א) **וידאו** — ה-pipeline היום מייצר פנורמות 360° סטטיות (11 נקודות לדירה 846), לא קליפים; (ב) **חוץ** — הסצנה היום היא הדירה לבדה על מישור קרקע 200 מ' עם HDRI. אין מודל בניין, אין סביבה, אין כתובת.
2. **הבניין לא קיים.** Rainbow Tel Aviv של ישראל-קנדה הוא במתחם שדה דב (צפון ת"א, 7 בניינים, המגדל כ-40 קומות, אשטרום קבלן מבצע). לכן אין "לצלם את הבניין": אין Google 3D Tiles של המגדל, ו-OSM מכיר 449 בניינים בריבוע 1.5 ק"מ סביב האתר אבל **אפס בתוך המתחם** (נמדד היום). הריחוף החיצוני חייב להיבנות: **מסת מגדל מתוך "מפתח הקומה" שעל גיליון תכנית המכר** + הסביבה האמיתית (ים, חוף, השכונה) מ-OSM.
3. **ה-lane הנכון הוא אותו lane שכבר הוכרע לדירה (D-WQ-13), מורחב לזמן:** Blender בונה סצנה אחת (מגדל + סביבה + הדירה בקומה 16 עם זכוכית החזית האמיתית שלה), מצלמה אחת טסה מהאוויר, דרך דלת המרפסת (o-13 בפאנל `facade-11`), לסלון, ואז shot קצר בכל חדר. הרנדר הוא **"clay" מהיר ב-720p**; את הפוטוריאליזם נותן מודל **render-to-real** על fal.ai שמקבל את ה-clay כמסלול תנועה ופריים-מפתח "מולבש" כמראה. כך הגאומטריה נשארת של התכנית (D-WQ-10, D-WQ-17) והמראה נשאר "Habait designer look" (D-WQ-22).
4. **הפריים-המפתח של כל חדר כבר קיים בחינם:** חיתוך פרספקטיבי מהפנורמה המולבשת של אותה נקודת מצלמה. אותה גאומטריה, אותו material board, אפס קריאות GPT חדשות לחדרים. קריאות חדשות נדרשות רק ל-2–3 פריימים חיצוניים.
5. **עלות לדירה (הערכה):** 12 shots × 5–8 ש' → $10–13 וידאו (render-to-real 720p, 3 seeds) + $14 פריימים חיצוניים + $1–3 GPU שכור ל-clay = **≈ $40–45 final, ≈ $12 טיוטה**, הרבה מתחת לתקרת D-WQ-9 ($150). הזמן: חצי יום מכונה אחרי שהכלים קיימים.
6. **מה לעשות ראשון (אבן דרך M1, < $1):** `site.json` ל-846 (מרכז שדה דב, צפון 291.6° שכבר נמדד, קומה 16, מסת מגדל ממפתח הקומה), הרחבת `build_scene.py` במסת מגדל ובמסלול מצלמה, clay של 5 שניות ב-720p מקומית, פריים אחד, קריאה אחת ל-`fal-ai/ltx-2.3-quality/render-to-real` (≈ $0.27) — ואז שיפוט בעין ובמדד קצוות מול ה-clay.

---

## 1. מה הבריף דורש ומה כבר יש

| דרישה בבריף | מצב ברפו היום | הפער |
|---|---|---|
| "סרטונים מחולקים לפי חדרים" | 11 נקודות מצלמה לחדר/אזור ב-`plan.general.json` + פנורמות 8K מולבשות (GPT Image 2.5) | אין מסלול מצלמה בזמן, אין קליפים. `render_pano.py` מרנדר רק equirect מנקודה |
| "הכי מציאותי" | ה-lane CG + skin הוכיח (P03/P04) שקיר/פתח נשארים במקום והחדרים נקראים כדירה אחת | צריך את אותו דבר **לאורך זמן** (temporal consistency) — זה מה שמודל render-to-real נותן |
| "ריחוף מחוץ לבניין עד הדירה" | `build_scene.py` בונה דירה בלבד; `plan_meta.ground_offset_cm = -5120` (קומה 16, 3.2 מ' לקומה, הנחה) ומישור קרקע כדי שלקרן מהחלון יהיה במה לפגוע | אין מגדל, אין שכנים, אין ים. יש כבר: צפון מדוד (291.6°), גובה הקומה, קו המגרש ומפתח הקומה על הגיליון |
| "על סמך תכנית המכר והכתובת" | התכנית: traced (11 חדרים, 37 קירות, 13 פתחים, 12 פאנלים). הכתובת: לא מופיעה בגיליון; הפרויקט מזוהה (Rainbow TLV, TOWER-RED, ישראל-קנדה) | צריך שכבת **site intake**: פרויקט → קואורדינטות → סביבה |

**מה הגיליון עצמו נותן לחוץ** (נבדק על ה-PDF היום): לוגו הפרויקט, `TOWER-RED / קומה 16 / סימן L`, חץ צפון (291.6° — כבר נמדד ב-`apartment.json`), **מפתח קומה** (קו המתאר של הקומה הטיפוסית עם הדירה מקווקוות — זה ה-footprint של המגדל), **מפתח אתר** (שמונה בניינים: R, R², Y, G, B, O, I, P — הסידור במתחם), קו "גבול מגרש + קו בניין", והערה שהמגדל נושא "רשת עמודים בקומות גלויים". **כל אלה מספיקים למסת מגדל נאמנה-בקירוב** (footprint × 40 קומות × 3.2 מ'), לא לחזית אמיתית. את החזית נותן ה-skin.

---

## 2. הארכיטקטורה המוצעת — חמישה שלבים

### 2.1 Site intake: `site.json` (חדש, ליד `plan.json`)
- **קלט:** שם הפרויקט/כתובת, הגיליון. **פלט:** `site.json` — `latlon` של המגרש, `north_deg` (מהגיליון), `floor`, `floor_to_floor_cm`, `tower_footprint_cm[]` (מתוך מפתח הקומה, מיושר לפי `plan.json`: הדירה המקווקוות = ה-polygon של הדירה שכבר traced, וכך הסקייל והסיבוב נקבעים אוטומטית), `tower_floors`, `neighbours` (OSM), `coast` (OSM), `hdri`.
- **סביבה:** Overpass → בניינים עם `height`/`building:levels` (באזור: 89 מתוך 449 מתויגים; לשאר ברירת מחדל לפי `building=apartments` ≈ 3 מ'/קומה), חוף וים, כבישים ראשיים. נמוך-פוליגוני בכוונה — ה-skin מצייר אותם. **לא Google 3D Tiles:** המגדל לא קיים שם, ומדיניות ה-Map Tiles API אוסרת caching לרנדר offline.
- **מגדל:** אקסטרוזיה של ה-footprint, קומות חוזרות, "רשת עמודים" כמסות דקות בקומות הגלויות, מרפסות ה-L כמו בדירה (חזרה אנכית). קומה 16 = הדירה האמיתית מ-`plan.json` עם `panes[]` (facade/railing) — הזכוכית שהמצלמה תעבור דרכה.
- **כשהיזם ייתן DWG/מסה של האדריכל (DBLK)** — הוא מחליף את האקסטרוזיה 1:1 (אותו D-WQ-16: DXF importer ראשון).

### 2.2 Blender: סצנה אחת, מסלול מצלמה אחד, רנדר clay
- `build_scene.py` מקבל `--site site.json`: מוסיף את מסת המגדל והשכנים לסצנה הקיימת (הדירה כבר נבנית ב-world Z-up נכון; `ground_offset_cm` כבר שם). ה-HDRI והשמש הקיימים נשארים (style lock).
- **`camera_path.py` (חדש, Python טהור כמו `place_cameras.py`):** מייצר `shots[]` דטרמיניסטיים מ-`plan.json + site.json`:
  1. `ext-approach` — aerial מ-250 מ' מערבה (מעל הים), ירידה וסיבוב אל חזית ה-L; 6–8 ש'.
  2. `ext-facade` — orbit איטי מול המרפסת בקומה 16, המצלמה מתקרבת ל-o-13; 4–5 ש'.
  3. `ext-enter` — push-in דרך דלת המרפסת לסלון (הדלת נפתחת 12°→90° ב-animation); 3–4 ש'. **זה התפר** בין חוץ לפנים.
  4. `room-<id>` × 11 — לכל `camera_points[]`: dolly/arc של 1–1.5 מ' סביב הנקודה, 4–6 ש', ב-yaw שכבר נבחר לפנורמה. clearance ray-casts (כבר יש BVH ב-`build_scene.py`) מבטיחים שלא נכנסים לרהיט.
- **רנדר:** 1280×720, 24 fps, PNG sequence + depth. Cycles ב-16–32 spp עם denoise (ה-clay לא צריך להיות יפה, רק נכון), או Eevee. **נמדד היום על ה-Iris Xe:** Eevee Next headless עובד; פריים 720p ראשון עם 40 קוביות ב-16 samples = **98.8 ש'** (כולל קומפילציית shaders — הפריימים הבאים זולים יותר, לא נמדד). Cycles smoke 512×256@32spp = 3.0 ש'. **מסקנה:** 5 שניות clay (121 פריימים) אפשריות מקומית בלילה; 12 shots → GPU שכור (4090, $0.35–0.75 לשעה, שעה-שעתיים).
- **הפריים הראשון של כל shot נשמר כ-PNG** (כמו ב-pipeline של fal עצמם): הוא ה-"image 1" של ההלבשה.

### 2.3 Look: פריים-מפתח אחד לכל shot
- **חדרים (11):** חיתוך פרספקטיבי (אותו FOV כמו מצלמת ה-shot) מהפנורמה **המולבשת** הקיימת של אותה נקודה (`panos/balanced` או ה-8K finals). אותה גאומטריה → הקצוות של ה-clay והפריים מתלכדים כמעט במדויק. **$0.**
- **חוץ (3):** `openai/gpt-image-2.5/.../edit` על ה-clay frame (ה-lane הקיים), עם material board מורחב ב-"outdoor/facade" line, ורפרנסים: ההדמיות השיווקיות של היזם (3DVISION) — **רק אחרי הסכמת ישראל-קנדה (D-WQ-18)**; עד אז "מגדל זכוכית ניטרלי, בלי מיתוג". ≈ $2.40 לפריים × 3 × 1–2 seeds.
- **שער נאמנות:** edge-PSNR בין הפריים המולבש ל-clay (fal מדווחים שסף ≈ 17 טוב) + `openings-test.mjs` הקיים על פריימי הפנים. נכשל → seed אחר, לא prompt "חזק יותר"; אם חסר אלמנט — מזיזים מצלמה ב-Blender.

### 2.4 Video: clay + keyframe → render-to-real
| endpoint (fal.ai) | מה הוא | מחיר (עמוד המודל, 2026-11-01) | מתאים? |
|---|---|---|---|
| **`fal-ai/ltx-2.3-quality/render-to-real`** (3DREAL IC-LoRA, 26.6.2026) | `video_url` = ה-clay (תנועה/קומפוזיציה), `image_url` = פריים ראשון (מראה), `intensity` (light/strong-v2), `num_frames` = 8k+1, detail-refine ×2, אודיו אופציונלי | **$0.0024075/MP**: 121 פריימים 720p = 112 MP ≈ **$0.27**; עם refine 1440p ≈ $1.08 | **הבחירה.** זול, "preserves composition and camera motion", fal עצמם מראים pipeline Blender→clay→render-to-real עם 132 וידאו ו-0 כשלונות |
| `minimax/h3-max/3d-to-video` | אותו רעיון, עד 15 ש'/32 shots, 8 רפרנסים | $0.90 ל-5 ש' ראשונות ב-768p + $0.08/ש'; 1080p $1.30 + $0.16/ש' | אלטרנטיבה ל-A/B; העמוד עצמו אומר "close guidance: exact geometry and paths are not guaranteed" |
| image-to-video (Kling O1 $0.112/ש', Wan 3.0 ≈ $0.10/ש', Seedance 2.x $0.15–0.30/ש', Veo 3.1 $0.20/ש') | פריים מולבש → וידאו, תנועת מצלמה מהפרומפט או first/last frame | זול-בינוני | **לא כעיקר:** המודל ממציא גאומטריה כשהמצלמה זזה (סותר D-WQ-10). אולי ל-"נשימה" של 2–3 ש' בפריים סטטי |
| Decart Lucy Restyle / Kling O3 edit | restyle של וידאו קיים | $0.01/ש' | לבדיקה כ-fallback זול מאוד; לא מבטיח פוטוריאליזם מ-clay |

- **הליך לכל shot:** 3–4 seeds → בחירה לפי edge-PSNR מול ה-clay + עין (הביקורת של אלירן, D-WQ-12). ב-$0.27 ל-seed זה עדיין < $1.5 ל-shot.
- **תפר חוץ→פנים (`ext-enter`):** shot אחד רציף ב-clay, כך שהמודל לא צריך "לנחש" את המעבר; הפריים הראשון שלו חיצוני, והפריים האחרון צריך להתלכד עם הפריים הראשון של `room-living` (אותה גאומטריה, אז זו בעיית צבע בלבד; Kling O1 first/last-frame הוא fallback אם ה-grade לא מתיישב).

### 2.5 הרכבה ומסירה
- `assemble_video.mjs` (חדש, ליד `assemble_tour.mjs`): ffmpeg (כבר מותקן, 8.0.1) → `clips/<shot>.mp4` לכל חדר + `master.mp4` (חוץ → סלון → … לפי סדר ה-tour), כתוביות שם-חדר דו-לשוניות, color grade אחיד (LUT אחד), 16:9 ו-9:16 (crop מרכזי לרשתות). `-nostdin` בכל קריאת ffmpeg בלולאה (fal דיווחו על שלושה פריימים שנהרסו בלי זה).
- **בוויואר:** לשונית "סיור וידאו" ליד ה-360; כל קליפ-חדר מקושר לנקודת המצלמה שלו, כך שמהסרטון קופצים לפנורמה של אותו חדר. תווית AI כמו ב-D-WQ-17.
- **רישום:** שורת ledger לכל קריאה (RENDER-LEDGER.md §0), `shots.json` עם hash של ה-clay, ה-seed, ה-endpoint, המחיר.

---

## 3. תקציב וזמן לדירה (הערכה, 12 shots, 5–8 ש' כל אחד)

| פריט | כמות | עלות |
|---|---|---|
| clay render (GPU שכור, 4090) | 1–2 שעות | $1–3 |
| פריימי חוץ (GPT Image 2.5 edit) | 3 × 2 seeds | $14 (או $0.06 ב-Muse לטיוטות) |
| פריימי פנים | 11 | $0 (חיתוך מהפנורמות הקיימות) |
| render-to-real 720p | 12 shots × 3 seeds | $10–13 |
| detail-refine 1440p לנבחרים | 12 | $13 |
| **סה"כ** | | **≈ $40–45** final, **≈ $12** טיוטה |

זמן: אחרי שהכלים קיימים — חצי יום מכונה + שעתיים ביקורת. פיתוח הכלים (site intake, camera_path, assemble, שער הנאמנות): כ-3–5 ימי עבודה.

---

## 4. סיכונים ומה עושים איתם

1. **המגדל הוא הנחה.** footprint ממפתח קומה בקנ"מ קטן, 40 קומות × 3.2 מ', בלי החזית האמיתית. **טיפול:** לבקש מהיזם מסת אדריכל/DWG; עד אז להצהיר "הדמיית מסה" ולא להציג חזית כאמיתית. רק הדירה עצמה "נאמנה למדידה".
2. **זכויות.** תכנית המכר וההדמיות השיווקיות הן של ישראל-קנדה; D-WQ-18 מחייב pitch פרטי עד הסכמה. **טיפול:** שום מיתוג/רפרנס שיווקי בפריימים עד ההסכמה.
3. **render-to-real על גאומטריה דקה** (מעקות, זכוכית, עמודים גלויים): עלול "להמיס" אותם. **טיפול:** שער edge-PSNR, תנועות מצלמה פשוטות ואיטיות (ההמלצה המפורשת של fal), ו-intensity "light" לפנים.
4. **עקביות בין shots.** **טיפול:** אותו material board, אותה פסקת-סגנון מילה-במילה, אותם רפרנסים, פריימי פנים מהפנורמות שכבר אושרו.
5. **המכונה המקומית.** Cycles/Eevee על CPU/Iris Xe מספיקים ל-clay של shot אחד ללילה; סדרה מלאה דורשת GPU שכור (כבר בתכנית ל-finals). שום דיפוזיה מקומית — הכל על fal.
6. **OSM חסר במתחם עצמו** (0 בניינים, 0 under-construction). **טיפול:** מפתח האתר שעל הגיליון נותן את סידור שמונת הבניינים; מסות שכנים פשוטות מתוכו, הסביבה האמיתית מ-OSM מסביב.

---

## 5. אבני דרך

| # | מה | עלות | תוצר שמכריע |
|---|---|---|---|
| **M1 — הוכחת lane** | `site.json` ל-846 ידני; מסת מגדל + שכנים ב-`build_scene --site`; `camera_path.py` ל-`ext-enter` בלבד (5 ש'); clay 720p מקומי; פריים אחד (Muse $0.01 או חיתוך); קריאה אחת ל-render-to-real | ≈ $0.30 | האם המעבר דרך הזכוכית לסלון נראה אמיתי ושומר גאומטריה (edge-PSNR, עין) |
| **M2 — חדר אחד מקצה לקצה** | `room-living`: פריים מחיתוך הפנורמה המולבשת, 3 seeds, בחירה, grade | ≈ $1 | האם הקליפ של חדר נקרא כאותו חדר כמו הפנורמה (P04 בזמן) |
| **M3 — דירה שלמה** | 12 shots, GPU שכור, assemble, לשונית בוויואר | ≈ $40 | master.mp4 של 846 לביקורת אלירן |
| **M4 — הכללה** | site intake מכתובת (geocoding + Overpass אוטומטי), footprint ממפתח קומה ב-OpenCV, DXF importer למסה | $0 | דירה שנייה (pilot-karnei) עוברת את אותו מסלול בלי עבודת יד |

---

## 6. שאלות פתוחות לאלירן (לא חוסמות את M1)

1. יש גישה למסת האדריכל / DWG / הדמיות החוץ של Rainbow? זה מחליף את ההנחה בסעיף 4.1.
2. פורמט היעד: 16:9 לאתר/מצגת, 9:16 לרשתות, או שניהם? אורך master יעד (60–90 ש'?).
3. פסקול: קריינות/מוזיקה (Mirelo video-to-audio על fal קיים; Suno מחוץ ל-fal), או שקט עם כתוביות?
4. האם ה-pitch לישראל-קנדה (D-WQ-11, "תוך חודש") הוא היעד של M3?

---

## מקורות

**הפרויקט והאתר:** [Madlan — Rainbow, חלקה 15 שדה דב](https://www.madlan.co.il/projects/%D7%97%D7%9C%D7%A7%D7%94_15_%D7%A9%D7%93%D7%94_%D7%93%D7%91_%D7%AA%D7%9C_%D7%90%D7%91%D7%99%D7%91) · [Bizportal — הדמיית Rainbow (3DVISION)](https://www.bizportal.co.il/realestates/news/article/20025684) · [Nadlan Center — אשטרום קבלן מבצע, 736 מ' ₪](https://www.nadlancenter.co.il/article/13606) · [Yad2 — פרויקט 16158](https://www.yad2.co.il/yad1/project/16158) · [Calcalist](https://www.calcalist.co.il/article/ryt88u6ukl) · [Bizportal — מכירות 2024](https://www.bizportal.co.il/realestates/news/article/20017551)

**מודלי וידאו (fal.ai):** [LTX-2.3 render-to-real](https://fal.ai/models/fal-ai/ltx-2.3-quality/render-to-real) · [fal blog — from clay 3D render to a real short](https://blog.fal.ai/from-clay-3d-render-to-a-real-action-short-a-3d-to-ai-pipeline-with-total-control/) · [H3 Max 3D-to-video](https://fal.ai/h3-max-3d-to-video) · [LTX-2.3 3DREAL LoRA (ComfyUI wiki)](https://comfyui-wiki.com/zh/news/2026-06-29-ltx-2-3-3dreal-lora-render-to-real) · [Kling 3.0 motion control](https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control) · [Kling O1 image-to-video](https://fal.ai/models/fal-ai/kling-video/o1/image-to-video) · [fal — Seedance 2.0 vs Kling 3.0](https://fal.ai/learn/tools/seedance-2-0-vs-kling-3-0) · [fal — best image-to-video APIs 2026](https://fal.ai/learn/tools/best-image-to-video-apis-2026) · [Teamday — video models by price/second (Sep 2026)](https://www.teamday.ai/blog/best-ai-video-models-2026) · [Lucy Restyle](https://fal.ai/models/decart/lucy-restyle) · [fal video APIs](https://fal.ai/video)

**סביבה ומודלי עיר:** [Blosm — Import of Google 3D Cities](https://github.com/vvoovv/blosm/wiki/Import-of-Google-3D-Cities) · [Blosm issue #356 — caching Google tiles not allowed](https://github.com/vvoovv/blosm/issues/356) · [Blosm](https://github.com/vvoovv/blosm) · [TLV OpenData](https://opendatasource.tel-aviv.gov.il/en) · Overpass API (שאילתה 2026-11-01, bbox 32.105–32.120 / 34.775–34.795: 449 בניינים, 89 עם height/levels, 0 במתחם)

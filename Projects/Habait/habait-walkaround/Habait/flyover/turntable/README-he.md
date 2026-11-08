# turntable: תצוגת זמינות של המגדל (כרטיס 21, C6א)

ספינר בסגנון residence.tech: 72 פריימים של סיבוב 360° סביב המגדל, צעד 5°. לכל פריים יש פוליגון בפיקסלים לכל דירה גלויה ולכל קומה. הפוליגונים נגזרים אוטומטית מהגאומטריה (`units.json`) ולא מצוירים ביד. $0, בלי מודל גנרטיבי.

## קבצים

| קובץ | מה |
|---|---|
| `turntable.py` | 3 מצבים. `--plan` (Python רגיל): 72 פוזות → `_local/camera.json`. `--render` (בתוך Blender): EEVEE 1280×720 → `raw/_local/NNN.png`, ומחזיר ל-camera.json את מטריצת המצלמה של Blender + probes של `world_to_camera_view`. `--pack` (Pillow): PNG → `_local/NNN.webp`, באיכות הגבוהה ביותר שעדיין ≤ 125 KB |
| `project_units_perspective.py` | ההטלה הפרספקטיבית. מייבא את `../hotspots/project_units.py` של כרטיס 19 לקריאה בלבד (convex_hull, clip_x, Prism, visible_fraction, load_units) ולא משנה בו כלום. `--selftest`, `--validate`, `--debug` |
| `turntable.schema.json` | הסכמה הקטנה: 72 פריימים, `src`/`angle`, ולכל פוליגון לפחות 4 נקודות. בדיקת הגבולות (0..1280 × 0..720) נעשית בקוד של `--validate` |
| `_local/turntable.json` | הפלט. `{schema, width, height, step_deg, frames:[{src, angle, camera_bearing_deg, hotspots:[{unit, id, floor, type, status, points:"x,y x,y …", labelPoints, visible_frac}], floors:[{floor, points, labelPoints, units}]}], meta}` |
| `_local/camera.json` | 72 פוזות בצורת Studio (`matrix_world`, `pos`, `look_dir`, `yaw_deg_from_plus_y_cw`, `pitch_deg`, `rotation_euler_deg`, `pos_glb`) ועוד `intrinsics {fx, fy, cx, cy, width, height}`, `lens_mm`, `sensor_width_mm`, `hfov_deg`/`vfov_deg` |
| `_local/debug-000/018/036/054.png` (640×360) | הפוליגונים על הרנדר. כל עוד אין רנדר הם מצוירים על קנבס ריק עם קווי המתאר של המגדל. 846 בלבן, סטטוס בצבע: ירוק = for-sale, כתום = reserved, אדום = sold |
| `raw/_local/NNN.png` | הרנדרים הגולמיים. הם מחוץ ל-`_local/` כדי ש-`du -sm _local` יספור רק את מה שנמסר |

## פקודות (Git Bash)

```bash
cd /c/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8
PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe
BLENDER="/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe"

$PY -I Habait/flyover/turntable/turntable.py --plan                       # 72 פוזות, בלי Blender
# רק כש-Blender פנוי (SESSIONS.md כלל 4: 98 הבעלים). הקובץ נפתח לקריאה ולא נשמר:
timeout 900 "$BLENDER" -b Habait/flyover/renders/baked-v5/baked.blend -P Habait/flyover/turntable/turntable.py -- --render --frames 0-71 --res 1280x720 --samples 8
$PY -I Habait/flyover/turntable/turntable.py --pack                       # webp ≤ 125 KB
$PY -I Habait/flyover/turntable/project_units_perspective.py --debug 0,18,36,54 --debug-src Habait/flyover/turntable/raw/_local
$PY -I Habait/flyover/turntable/project_units_perspective.py --selftest   # כולל cross-check מול Blender אחרי --render
```

## מוסכמות והכרעות (T0)

- **סצנה:** `renders/baked-v5/baked.blend` (13 skins, כיסוי של 0.76–0.95 בכל כיווני המגדל). ה-`renders/baked` הישן (4 skins) ריק ב-87% מהצד האחורי, ולכן לא מתאים לסיבוב מלא. הנתיב ניתן כארגומנט, אז אפשר להחליף. העולם (skin של node-a) מוחלף בגרדיאנט רך, ו-`BK_tower_hidden` מוסתר.
- **מצלמה:** רדיוס 150 מ' סביב מרכז ה-bbox של הפלטה (-5.89, -12.97). ה-150 נבחר כדי להישאר בתוך טבעת ה-164 מ' שבה מתחילות מסות השכנים מ-OSM, כך ששום שכן לא נכנס בין המצלמה למגדל. גובה המצלמה z = 60 (‎111 מ' מעל הקרקע). pitch ‏-16.06°, ‏lens ‏18.83 מ"מ (hfov 87.4°, ‏vfov 56.5°). ה-pitch וה-lens משותפים לכל 72 הפריימים, ומותאמים כך שפריזמת המגדל (מהקרקע עד הכתר) תופסת 86% מגובה הפריים בפריים הגרוע.
- **זווית:** `angle` = ‏5 × i. כיוון המצלמה בתכנית הוא `bearing0 + angle`, עם כיוון השעון במבט מלמעלה. `bearing0` = ‏114.76° הוא הכיוון של פוזת העצירה של ab ‏(68.4477, -47.2597), כלומר צד המרפסת של 846: פריים 0 מסתכל על 846 מקדימה.
- **פוליגון:** הפאות האנכיות של הפריזמה של הדירה שפונות למצלמה, חתוכות לפריים. זה לא ה-convex hull של 8 הפינות: במבט מלמעלה ה-hull כולל גם את גג הקופסה, שיושב על הדירה שבקומה מעל, ואז דירות מוערמות חופפות. כך לשתי דירות מוערמות יש צלע משותפת וחפיפה אפס.
- **מתאר:** `outline_world` אם קיים (היום אין). אחרת, לערימה של 846 (‏826/836/846/856/866, אותו xy) משמש המתאר האמיתי `unit_cm` מ-tower-footprint.json, ולשאר הדירות המלבן של `box_world`. כל מתאר נחתך לקמור של הפלטה, כי פינת קופסה שיוצאת מהפלטה הייתה בולטת מצללית המגדל (K/M/PH נשארים עם 92–94% מהשטח).
- **הסתרה:** `visible_fraction` של כרטיס 19 (קרן אל פריזמת הפלטה, 23 קודקודים, מ-‎-51.2 עד 79.8). דירה עם ערך < 0.25 מוסתרת.
- **מזהה:** `unit` = המספר בלבד ("846" ולא "apt846"), כמו ב-residence. `id` = המזהה המקורי מ-units.json. `status` נלקח מ-units.json, ואם אין בו ערך אז "available".
- **קומות:** רצועה לכל קומה למגורים מ-1 עד 39 (‏`(f - 16) × 3.2`), על הקמור של הפלטה, עם רשימת הדירות שיש ל-units.json בקומה.

## נראות 846

- נורמל החזית של 846 (ממוצע משוקלל לפי אורך של צלעות המתאר שעל שפת הפלטה): 76.2° בתכנית.
- 846 מופיע ב-39 פריימים: זוויות 230–355 ו-0–60 (כיוון מצלמה 344.8° → 174.8°).
- בכל 36 הפריימים שבהם המצלמה בטווח ±90° מהנורמל, 846 מופיע.
- בצד האחורי (זוויות 65–225) 846 לא מופיע, וזה נכון: הוא מוסתר על ידי המגדל.

## פגמים ידועים

- פוליגון של דירה שמוסתרת חלקית (0.25 ≤ visible < 1) מכסה גם את החלק המוסתר. לא חותכים לפי צללית הבניין.
- K/M/PH הן עדיין קופסאות "stacked-approx" (כרטיס 03). רק הערימה של 846 עם מתאר אמיתי.
- ב-`baked.blend` הטקסטורות הן נתיבי `C:/…` מוחלטים ולא packed. לכן בחוות רנדר יש להשתמש ב-`--glb renders/baked-v5/site_baked.glb` (הטקסטורות בפנים), עם `--engine cycles`. מצבי `--glb` ו-`--engine cycles` עוד לא הורצו ב-Blender. הרינדור המקומי (EEVEE מתוך baked.blend) כן רץ.
- **רינדור מקומי (2.11 17:29):** EEVEE Next, 1280×720, 8 samples, 72 פריימים ב-44.9 ש' (‏0.62 ש'/פריים; פריים 0 לקח 9.5 ש' בגלל טעינת הטקסטורות). ה-hash של baked.blend זהה לפני הריצה ואחריה. cross-check מול `world_to_camera_view`: ‏576 probes, שגיאה מקסימלית 0.0007 px. webp: ‏106–124 KB, ובסך הכול 8.11 MB.
- רצועה כהה דקה בקו האופק, בקצה הקרקע הרחוקה/האורתופוטו (4 ק"מ), והשמיים מעליה. בכ-12 פריימים (זוויות ~10–55 ו-~305–310) יש פס לבן מפוספס על הקרקע: ארטיפקט של ה-skin האפוי. אין כיתוב של היזם (בדיקה בעין על contact sheet של 72 הפריימים).

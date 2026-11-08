# hotspots: דירות לחיצות על כל פריים של טיסת ה-360 (כרטיס 19, ערוץ C4)

`project_units.py` מטיל את הקופסה התלת-ממדית של כל דירה (`box_world` מ-units.json, כרטיס 03) על ה-equirect של כל פריים
בקטע טיסה (`camera.json` של כרטיס 17) ומוציא `hotspots.json` בפורמט החוזה של D
(`Habait/platform/contracts/units.schema.json`, `$defs.hotspot` עם `polygon`). numpy בלבד, בלי Blender, שניות לקטע.

## הרצה (Git Bash)

```bash
cd /c/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe
P=Habait/studio/_local/projects/apt846-rainbow-tlv
# 1. camera.json לכל קטע (הסקריפט של כרטיס 17, בלי Blender). כשרנדר אמיתי ירוץ הוא יכתוב אותו גם ליד הפריימים.
$PY -I Habait/flyover/equirect/render_segments.py --plan-only --res 2048x1024 --out Habait/flyover/hotspots/_local/cameras
rmdir Habait/flyover/hotspots/_local/cameras/*/frames
# 2. ההטלה (לכל קטע; הפלט ל-Habait/flyover/equirect/_local/segments/<seg>/)
for seg in approach orbit hold-facade descend-846; do
  timeout 300 $PY -I Habait/flyover/hotspots/project_units.py --units Habait/engine/_local/rainbow/units.json \
    --camera Habait/flyover/hotspots/_local/cameras/$seg/camera.json \
    --occluder $P/derived/tower-footprint.json --occluder-z Habait/engine/_local/rainbow/mass-plan-world/tower-mass.json \
    --debug 0 --selftest
done
```

פלט לכל קטע: `hotspots.json` (= units.json, וההוטספוטים של הקטע הזה מוחלפים; הוטספוטים של קטעים אחרים נשמרים),
`hotspots.meta.json` (מקור + sha256 של הקלטים, ולכל פריים ולכל דירה: u/v, `visible_frac`, סיבת סינון, `in_view_hint`),
ו-`debug-<index>.png` + `-view.png` (חיתוך של המסגור של הבמאי) + `-apt846.png` (חיתוך ×3 סביב הדירה, רק הקו שלה).

## המוסכמות (זהות ל-`studio/tools/world2equi.py` של habait-98 ול-`render_segments.py` של כרטיס 17)

- עולם: plan-world במטרים. X = x_cm/100 ימינה, Y = -y_cm/100 למעלה בתכנית, Z למעלה, רצפת קומה 16 = 0, צעד קומה 3.2.
- מצלמה: `matrix_world` = מצלמה לעולם, המבט לאורך ‎-Z המקומי, ‎+Y = למעלה.
- equirect: u 0.5 = כיוון המבט של המצלמה, u גדל עם כיוון השעון במבט מלמעלה (= ימין), v 0 = זנית.
  במצלמה מאוזנת זה בדיוק `u = 0.5 + (bearing − yaw)/360` של כרטיס 17.
- חוזה: `yaw_deg = (u − 0.5)·360` בטווח [‎-180, 180], `pitch_deg = (0.5 − v)·180`, `polygon = [[yaw, pitch], …]`.
  הוטספוט אחד לכל דירה בכל פריים. `t_start = (frame − 1)/fps`, `t_end = t_start + stride/fps`, בשניות מתחילת הקטע.
- `world2equi.py` לא מיובא, כי הוא מפרסר argv ופותח קבצים כבר בזמן import. ה-selftest מריץ אותו כתהליך נפרד בקריאה בלבד
  (`-I -B`) על הפוזה של פריים 0 ומשווה: מרכז ו-8 פינות של כל 12 הדירות, הפרש מרבי 0.016°.

## הגאומטריה

- **פוליגון:** קמור (convex hull) של 8 הפינות ועוד 4 נקודות על כל אחת מ-12 הצלעות (`--edge-samples`), כי ב-equirect קו
  ישר מתעקם. ה-hull נפרש סביב קו האורך של מרכז הקופסה ואז נחתך ל-[‎-180, 180].
- **תפר u=0/1:** קופסה שחוצה את התפר יוצאת כ-**שני הוטספוטים** לאותו פריים, עם אותו סמן (מרכז הקופסה). אף פוליגון לא
  חוצה את כל הרוחב (נבדק ב-Check על כל ארבעת הקטעים).
- **"מאחורי המצלמה":** ב-360 אין "מאחור", כל כיוון נמצא בתמונה. לכן הסינון הוא לפי מה שבאמת לא נראה:
  1. `camera-inside-box`: המצלמה בתוך הקופסה (סוף descend-846 על המרפסת של 846).
  2. `occluded`: הדירה מוסתרת על ידי הבניין. הבניין = פריזמה אנכית של פלטת הקומה (`--occluder`, 23 קודקודים) מהקרקע עד
     הגג. קו הראייה לכל אחת מ-96 נקודות על פני הקופסה חייב להיכנס לבניין בתוך הקופסה של הדירה (סובלנות 0.75 מ').
     פחות מ-10 % נראות (`--min-visible`) = מסונן.
  3. `camera-in-column`: המצלמה בדיוק מעל או מתחת לקופסה, כך שהדירה הייתה הופכת לרצועה ברוחב מלא עד הקוטב ו"אוכלת" כל
     לחיצה. `--keep-pole-bands` משאיר אותה.
- **בדיקת עין (debug):** הרקע הוא equirect של clay שהפוזה שלו תואמת לפריים (עד 1 מ' ו-0.5°). נמצא אוטומטית ב-
  `studio/_local/projects/*/renders/clay-pano-ortho/<node>.png` עם `clay-nodes-ortho/<node>/faces.json`. אם אין כזה, הרקע
  הוא גריד ריק עם קו המבט (u 0.5) ומסגרת ה-view_hint. ב-hold-facade פריים 0 = node-b-tower (הסטייה 0.00 מ').

## selftest (17 בדיקות)

- מרכז 846 בפריים 0 מחושב בשתי דרכים: דרך `matrix_world`, ודרך נוסחת ה-bearing של כרטיס 17 מ-pos + yaw בלבד. ההפרש
  חייב להיות ≤ 0.5°.
- 846 בתוך המסגור של הבמאי.
- שלושה קלטים פגומים חייבים להיתפס: u במראה, Y בלי היפוך, וקומה אחת למעלה (2.43°).
- השוואה ל-world2equi.
- ארבעה כיווני probe (אותם צבעים כמו ברנדר הבדיקה של כרטיס 17).
- `fixtures/synthetic.json`: פיצול בתפר, קופסה בלי פיצול, מצלמה בתוך קופסה, עמודה (ברירת מחדל ו-`--keep-pole-bands`),
  דירה בחזית הקרובה (נראית) ודירה בחזית הרחוקה (מוסתרת).

## מגבלות ידועות

- `box_world` הוא AABB בצירי התכנית. לכן לדירה בצורת L על פלטה מסובבת הפוליגון חורג מהחזית (ב-846 הוא חורג ימינה אל הרקע).
  `units-geometry.json` של כרטיס 03 כבר מחזיק prism אמיתי (ב-site-enu). השלב הבא: שדה `outline_world` בדירה, ואז ה-hull ייבנה
  ממנו.
- הקופסאות המוערמות של ab (`units-stacked.json`) לטיפוס M (837/847/857, bay ‎+9 מ') יושבות רק 26 % על הפלטה, ולכן "נראות"
  גם מהצד הרחוק. ב-meta יש `units_inside_plate`, והריצה מזהירה על כל קופסה מתחת ל-0.80.
- ה-occluder הוא הפלטה בלבד: בלי מרפסות (1.9 מ'), בלי בניינים שכנים ובלי מעקות.

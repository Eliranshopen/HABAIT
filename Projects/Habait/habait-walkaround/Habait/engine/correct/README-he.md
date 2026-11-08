# מסך תיקון התכנית (כרטיס 02, ערוץ A, שלב A2)

דף מקומי אחד: השרטוט של תכנית המכר, ומעליו החדרים, הדלתות והחלונות כפי שה-intake הבין אותם. מתקנים בלחיצות, בלי מקלדת, ולוחצים "אשר". נשמרים `plan.json` מתוקן ו-`corrections.json` (כל תיקון = דוגמה לאימון ה-intake).

אין תלות ברשת: הכול נטען מהשרת המקומי (בלי CDN, בלי פונטים מבחוץ). Chrome בדסקטופ וטאבלט (מגע: הקשה, גרירה, צביטה לזום).

## איך מפעילים

```bash
cd C:/RnD/Projects/Habait/habait-walkaround            # או שורש ה-worktree
node Habait/engine/correct/serve.mjs --plan Habait/engine/_local/apt846/v1/plan.json
# פותחים http://127.0.0.1:8870/
```

הניסוי עם שלוש שגיאות מכוונות (עד שכרטיס 01 מוציא פלט אמיתי):

```bash
node Habait/engine/correct/serve.mjs --plan Habait/engine/correct/fixtures/apt846-3errors.plan.json --report Habait/engine/correct/fixtures/apt846-3errors.report.json
```

## שלושת הצעדים

1. **מה לבדוק:** רשימה של מה שלא מתאים לשרטוט: מידה של חדר רחוקה מהמידה המודפסת (ירוק = עד 3%, אדום = יותר), שם חדר ששונה ממה שכתוב בשרטוט, חדר שאי אפשר להגיע אליו כי חסרה דלת. לחיצה על שורה מקרבת אל החדר.
2. **תיקון:**
   - חדר במקום הלא נכון: לוחצים על החדר וגוררים את הנקודות הכתומות לפינות שבשרטוט. הנקודה נצמדת לקירות ולפינות.
   - שם לא נכון: לוחצים על החדר ובוחרים שם מהרשימה.
   - חסרה דלת או חלון: לוחצים על הקיר (או על הרווח בקיר) ובוחרים "דלת" / "חלון" / "פתח". "צר יותר" / "רחב יותר" משנים רוחב ב-10 ס"מ.
   - דלת מיותרת: לוחצים עליה ובוחרים "למחוק".
   - "ביטול פעולה אחרונה" תמיד זמין. עבודה שלא נשמרה נשמרת בדפדפן וחוזרת בפתיחה הבאה.
3. **אישור:** "אשר ושמור". השרת בודק את התכנית (`validate-plan.mjs`); אם משהו לא תקין (למשל שני חדרים נכנסים זה בזה) הוא מסביר בעברית ולא דורס כלום.

"הגדרות מתקדמות" (סגור כברירת מחדל): הצמדה לקירות, הצגת הקירות שזוהו, פינות של כל החדרים, שקיפות השרטוט, נתיבי הקבצים. סוגי פתחים נוספים (דלת הזזה, דלת זכוכית, דלת כניסה) מתחת ל"סוגים נוספים".

## מה נשמר (בתיקיית `--out`, ברירת מחדל `Habait/engine/correct/_local/<apartment_id>/`)

| קובץ | מתי | מה |
|---|---|---|
| `plan.json` | רק אם `validate-plan` עבר ושום שדה לא נמחק או שינה צורה | התכנית המתוקנת. הקלט לא נדרס אף פעם |
| `plan.draft.json` | אם הבדיקה נכשלה | הטיוטה, כדי ששום עבודה לא תאבד |
| `corrections.json` | תמיד | מערך `[{type, target, before, after, t}]`, פעולה אחת לכל תיקון (גרירה אחת = רשומה אחת). פעולה שבוטלה נשארת עם `undone: true`. השרת מוסיף `auto_move_camera` אם פינה הוזזה ונקודת הצילום יצאה מהחדר |
| `session.json` | תמיד | הקלט וה-sha256 שלו, זמן העבודה בשניות, כמה תיקונים, מה נשאר פתוח, תוצאת הבדיקה |

סוגי הפעולות: `move_vertex` (target `r-id/loop/i`), `set_room` (שם, סוג, בחוץ/בפנים), `add_opening`, `delete_opening`, `set_opening` (סוג/רוחב), `auto_move_camera`. כל פעולה הפיכה: הרצת `corrections.json` על הקלט נותנת בדיוק את התכנית השמורה, והרצה הפוכה מחזירה את הקלט (נבדק ב-selftest).

השרת מחשב מחדש רק את השדות שנגזרים מהצורה ושהבודק משווה מולם: בחדר שהשתנה `area_m2`, `bbox_cm`, `clear_dims_cm`; בפתח שהשתנה `centre_cm`, `width_cm`, `angle_deg`. `plan_meta`, קירות, זיגוג וריהוט לא נגעים.

## ארגומנטים

| ארגומנט | ברירת מחדל |
|---|---|
| `--plan <plan.json>` | חובה |
| `--report <report.json>` | `report.json` ליד התכנית, אם קיים |
| `--image <png>` | `report.raster.image` (יחסית לדוח), אחרת `plan-crop.png` ליד התכנית |
| `--out <dir>` | `Habait/engine/correct/_local/<apartment_id>/` |
| `--port` / `--host` | `8870` / `127.0.0.1` |
| `--validator` | `360walkaround/pipeline/validate-plan.mjs` |
| `--selftest` | מריץ את הבדיקה העצמית ויוצא |

## פורמט `report.json` (החוזה מול כרטיס 01)

```jsonc
{
  "schema": "habait.intake-report/0.1",
  "apartment_id": "apt846",
  "title_he": "דירה 846 · Rainbow TLV, קומה 16",              // כותרת המסך (לא חובה)
  "source": { "pdf": "...", "unit": "846", "project_he": "Rainbow TLV", "plan_date": "15.10.2025", "sha256": "..." },
  "plan": "plan.json",
  "raster": {                                                   // ס"מ של plan.json -> פיקסלים בתמונה
    "image": "plan-crop.png",                                   // יחסית ל-report.json
    "cm_to_px": [2.25, 0, -167, 0, 2.25, 297]                   // px = a*x + b*y + c, py = d*x + e*y + f
    // או בקיצור: "px_per_cm": 2.25, "origin_px": [ox, oy], "rotation_deg": 0
  },
  "summary": { "rooms_total": 11, "rooms_named": 11, "dims_total": 16, "dims_read": 16,
               "dims_checked": 2, "dims_within_tol": 1, "max_dev_pct": 3.6, "tol_pct": 3, "edit_cost": 1 },
  "rooms": [{
    "room_id": "r-bedroom-2", "name_he": "חדר שינה", "name_en": "Bedroom", "type": "bedroom",
    "label_he": "חדר שינה",                 // מה כתוב בחדר בשרטוט (המסך משווה לשם בתכנית)
    "printed_dims_cm": [342, 275],          // המידה המודפסת, או null
    "printed_scope": "room",                // "room" | "part" (המידה מכסה רק חלק מהחלל: מוצג באפור, לא באדום)
    "measured_dims_cm": [351.4, 281.5],     // באותו סדר כמו המודפס
    "deviation_pct": 2.7, "status": "ok",   // ok | bad | part | no_print
    "openings": ["o-10"], "notes_he": null
  }],
  "openings": [{ "opening_id": "o-10", "kind": "door", "rooms": ["r-bedroom-2", "r-entrance"], "width_cm": 93.6 }],
  "mismatches": [{ "id": "m-1", "kind": "dims|label|reach|opening_missing|shape|other", "target": "r-...", "message_he": "...",
                   "rooms": ["r-a", "r-b"] }]   // rooms רק ל-opening_missing
}
```

המסך מחשב מחדש את בדיקות המידה, השם וההגעה בכל תיקון ("נמדד" = מידות החדר לאורך הקירות שלו, לא ה-bbox, כי התכנית מוטה). מ-`mismatches` הוא לוקח רק `opening_missing` (נפתר כשיש פתח בין שני החדרים) ו-`other` (מוצג כהערה).

**חשוב לכרטיס 01:** בלי `report.raster` המסך נופל ל-`plan_meta.scale_px_per_cm` + `raster_origin_px`, וזה נכון רק אם התמונה היא בדיוק החיתוך שעליו נעשה ה-trace. ה-selftest נכשל ("every room corner maps inside the image") אם המיפוי לא נכון.

## בדיקות

```bash
node Habait/engine/correct/serve.mjs --plan <plan.json> [--report <report.json>] --selftest   # "selftest OK", exit 0
node Habait/engine/correct/fixtures/make-fixtures.mjs            # בונה מחדש את הפיקסטורות מאמת המידה של 846
node Habait/engine/correct/fixtures/make-fixtures.mjs --verify   # מתקן את 3 השגיאות דרך אותן פעולות, "verify OK"
HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps node Habait/engine/correct/fixtures/ui-run.mjs   # דפדפן אמיתי, דסקטופ + טאבלט
```

## פיקסטורות (`fixtures/`)

- `apt846.report.json`: דוח בפורמט שלמעלה עבור אמת המידה `360walkaround/tours/apt846/plan.json`, על התמונה `Habait/engine/_local/apt846/plan-crop.png`. המיפוי נמדד: אמת המידה מצוירת בחיתוך של tour360 ב-2.25 px/cm; החיתוך של engine הוא אותו קנה מידה מוזז ב-(-167, +297) פיקסלים (התאמת תבנית, ציון 1.000 בארבעה מקומות).
- `apt846-3errors.plan.json` + `.report.json`: אמת המידה עם שלוש שגיאות מכוונות: פינה של חדר השינה נמשכה 80 ס"מ החוצה, חדר הרחצה הכללי נקרא "מחסן", הדלת של חדר הרחצה של ההורים נמחקה.

## מה המסך לא עושה (עדיין)

- לא מוסיף או מוחק פינות בחדר, ולא מוסיף או מפצל חדרים (רק מזיז פינות קיימות).
- לא עורך קירות, זיגוג או ריהוט. הקירות מגיעים מהשרטוט; הזזת פינה של חדר לא מזיזה קיר.
- ההצמדה יכולה לבחור פינת קיר שנמצאת כמה ס"מ מהפינה המצוירת (בניסוי: 6 ס"מ).

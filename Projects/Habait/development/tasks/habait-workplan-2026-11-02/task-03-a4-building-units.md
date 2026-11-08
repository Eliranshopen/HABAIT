# משימה 03: A4: building.py: מסת בניין + מלבן תלת-ממדי לכל דירה → units.json v0

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | A |
| **מקור בתכנית** | חלק ג §2 ערוץ A, שלב A4; ערוץ D שלב D0 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `engine-builder` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 1 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

מ-`project.json` (מפתח קומה, מספר קומות, גובה קומה, טיפוסי דירות × קומות) לייצר: מסת המגדל (עטיפה ל-`tower_mass.py` הקיים, בלי לערוך אותו) ו-bounding box תלת-ממדי לכל דירה ב-Rainbow → `units.json` v0 לפי החוזה של ערוץ D. זה הקלט להטלת ה-hotspots (C4) ולתצוגת הזמינות (C6).

## תלויות

- W1-D0 של habait-ab (`Habait/platform/contracts/units.schema.json`)
- `C:\RnD\Projects\Habait\tools\bench\site846\tower_mass.py` + `tower-footprint.json` (קריאה בלבד, של habait-16)

## קלטים (קריאה)

- `Habait/engine/fixtures/rainbow-846.project.json`, `Habait/engine/schema/project.schema.json`
- `C:\RnD\Projects\Habait\tools\bench\site846\{tower_mass.py,tower-footprint.json,plot-fit.json}`
- `Habait/platform/contracts/units.schema.json` + `validate.mjs`
- עובדות: 39 קומות מגורים + קרקע, צפון 304.4°, מפתח ×0.91, דירה 846 בקומה 16 עם מרפסת ל-SSE (memory.md §5)

## קבצים (הסוכן כותב רק כאן)

- `Habait/engine/building.py` (חדש)
- `Habait/engine/_local/rainbow/{tower-mass.obj,units.json}`
- אם חסר שדה בסכמה: הצעה בכתב ב-`## תוצאה` לבעל החוזה (platform), לא עריכה של הסכמה

## צעדים

1. לקרוא את הסכמה של project.json ושל units.json; לרשום אילו שדות חסרים למיפוי דירה→מיקום (למשל פוליגון הדירה במפתח הקומה).
2. מיפוי: לכל טיפוס דירה פוליגון במפתח הקומה (מ-plan.json של הטיפוס או מהמפתח); לכל קומה: הזזה בגובה; → bbox 3D במטרים במערכת הצירים של האתר (צפון 304.4°).
3. לייצא units.json: id, floor, type, status (fixture), price (null), bbox3d, tour_id (846 → `apt846`).
4. בדיקת נכונות על 846: ה-bbox של 846 נמצא בקומה 16 בצד SSE של המסה; לייצא גם PNG של המסה עם ה-bbox מסומן (matplotlib, בלי Blender).

## קריטריוני קבלה

- [ ] כל דירה ב-project.json מקבלת bbox3d; units.json עובר את הוולידטור של platform.
- [ ] ה-bbox של 846 נופל על החזית ה-SSE בקומה 16 (נבדק גיאומטרית מול `tower-footprint.json` וה-PNG).
- [ ] `tower_mass.py` לא נערך (git diff ריק עליו).

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 300 $PY Habait/engine/building.py --project Habait/engine/fixtures/rainbow-846.project.json --out Habait/engine/_local/rainbow && node Habait/platform/contracts/validate.mjs --units Habait/engine/_local/rainbow/units.json && git -C C:/RnD/Projects/Habait/habait-walkaround diff --quiet -- . ':!Habait/engine' && echo BENCH-UNTOUCHED
# צפוי: validate exit 0; הדפסה של מיקום 846 (floor 16, azimuth ~SSE); BENCH-UNTOUCHED
```

**Reviewer scope:** נכונות גיאומטרית בלבד: ה-bbox של 846 והאזימוט שלו, ושה-units.json תואם לסכמה בלי שדות שהומצאו.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0

## דרגת הכרעה

**T0:** הסוכן מכריע ורושם את ההכרעה בבלוק התוצאה. אין שאלה לאלירן.

---

## Standing rails (זהה בכל כרטיס; המקור: `docs/agent-team-org-chart.md` §3, שהוא גם החוזה שבכל הגדרת סוכן)

1. **קריאה תחומה קודם:** `C:\RnD\Projects\Habait\CLAUDE.md`, אחר כך `C:\RnD\Projects\Habait\SESSIONS.md` (כולו), אחר כך `C:\RnD\Projects\Habait\memory.md` סעיפים 1, 4, 6, 7 (את השאר grep לפי מילת מפתח). אחר כך הכרטיס הזה, ה-`README.md` של הלוח (Standing rails, Key state, הכרעות פתוחות), ואם הכרטיס מציין פרויקט: ה-`project.json` / `plan.json` שלו.
2. **כותבים אחרון, פעם אחת:** הסוכן לא עורך `memory.md` ולא `SESSIONS.md`. הכתיבה היחידה שלו לזיכרון היא בלוק `## תוצאה` בסוף הכרטיס הזה (מה נעשה, קבצים, פלט ה-Check מילה במילה, כסף ו-ledger, פגמים פתוחים, שורת `לזיכרון:` ≤ 400 תווים). הסשן שהפעיל אותו מעתיק את השורה ל-`memory.md` בעריכה נקודתית.
3. **קורא שני:** באותו בלוק: איזה סשן אחר (habait-16 / habait-89 / habait-ab / סשן ערוץ) חייב לדעת את זה ולמה זה מחייב אותו, או "אין". אותה שורה נוספת תחת "העברות" ב-README של הלוח; הסשן המפעיל שולח אותה ב-`SendMessage`.
4. **פעולה לא נגמרה עד שהזיכרון שלה נכתב.** הכרטיס DONE רק כשיש בלוק תוצאה **וגם** `memory.md` עודכן **וגם** סומן "זיכרון נכתב" ב-Key state של הלוח.
5. **דרגת הכרעה (ruling tier):** כל כרטיס נושא T0 / T1 / T2 משלו (למטה). T0: הסוכן מכריע ורושם. T1: שאלה אחת לאלירן, עם אפשרויות וברירת מחדל, וממשיכים בכל מה שלא תלוי בה. T2: השאלה + בדיקה עצמאית של `qa-reviewer` בהקשר נקי שמנסה להפריך. מעלים דרגה באמצע משימה ורושמים; לא מורידים בשקט.

**הערת התאמה:** זה הנוסח של Habait לכללי `plan-to-tasks` שלבים 8–9. העץ `memory/` של המעבדה (HOT.md, INDEX.md, `_TEMPLATE.md`) לא קיים כאן; תפקידו ממולא על ידי `memory.md` + `SESSIONS.md` + בלוק התוצאה בכרטיס.

---

## תוצאה

_(engine-builder, 2026-11-02 12:30–12:55 שעון המכונה, הופעל על ידי habait-4b)_

- **מצב:** DONE (T0; לא עלה דרגה)
- **מה נעשה:**
  - `Habait/engine/building.py` חדש. הוא גנרי: כל הנתונים באים מ-`project.json` (north_deg, site.origin, building.*, units[].files.plan_json), ושום דבר בקוד לא נקרא Rainbow או 846. בכל ריצה:
    1. **מסה:** עוטף את `tower_mass.py` בקריאה בלבד. הוא מייבא את המודול וקורא ל-`main()` שלו בלי שינוי, עם הקבועים מ-project.json (UNIT_FLOOR=16, FTF=3.2, RES_FLOORS=39). ה-OBJ מומר לפריים האתר. לכל פרויקט אחר יש `--plain-mass` (שחול פשוט של ה-footprint לכל קומה).
    2. **מיקום דירה במפתח הקומה:** קודם `placement` (שדה מוצע), אחר כך identity (המעטפת של plan.json שווה ל-`fit.plan_envelope_cm` של ה-footprint: ב-846 הסטייה 0.00 %), ואחר כך stacking (אותו טיפוס ואותו mirrored בקומה אחרת = אותו פוליגון בהזזת Z). דירה בלי מיקום נכשלת (exit 1). דירה שפחות מ-95 % ממנה בתוך הפלטה נכשלת.
    3. **פלטים:** `units.json` v0 (בתוך החוזה + `box_world`), `units-geometry.json` (bbox3d / OBB / prism ב-site-enu-m, lat/lon, אזימוט חזית/מרפסת/רדיאלי), `tower-mass.obj` ו-`units-check.png`.
  - **הבדיקה הגיאומטרית של 846:**
    - **קומה:** 16. ב-site-enu, z = 51.2–54.4 מ'.
    - **כיוון:** נורמל חזית המרפסת 169.4° (בין SSE ל-S, ובתוך ±22.5° מ-SSE), החזית כולה 151.5° SSE, והכיוון ממרכז המגדל 130.6° SE.
    - **בתוך הפלטה:** 98.9 % (הכלי עצמו מדד 98.7 %). חפיפה עם הליבה: 0.00 מ"ר.
    - **מרכז המגדל:** 1.04 מ' מ-`plot-fit.json`. כל ההפרש מוסבר בקנה המידה ×0.92 של מפתח האתר, שבכוונה לא מוחל על תכנית הדירה (1.05 מ').
    - **בתמונות:** ב-PNG הדירה על הפינה הדרום-מזרחית של הפלטה, והמלבן יושב על קומה 16 בחזית.
  - **צרכן `world2equi.py` (של 16), הורץ בקריאה בלבד** על node-c-facade, node-d-terrace ו-node-b-tower: כל הנודים קוראים את `box_world`, בלי wraps_seam. ב-overlay על ה-clay equirect (`consumer-check.png`) המלבן של node-c יושב בדיוק על הדירה הפתוחה בקומה 16, מהרצפה עד התקרה.
  - **הצירים תואמים ל-world2equi:** `box_world` = plan world, כלומר X = x_cm/100 ימינה ו-Y = -y_cm/100 למעלה בתכנית. זה אותו frame_world שרשום ב-faces.json של הנודים. Z למעלה, רצפת קומה 16 = 0, הקרקע ב-51.2-.
  - **selftest:** קלטים פגומים ידועים חייבים להיכשל, והם נכשלים: צפון הפוך 180° (168° מ-SSE), דירה שהוזזה 25 מ' (0 % בפלטה), דירה בלי מיקום, פרויקט בלי footprint. stacking בקומה 17 נותן +3.20 מ' בדיוק. חץ הגיליון 291.6 נוחת 24.7° מ-SSE: מבחין, אבל על הגבול, ולכן מדווח ולא נאכף.
  - **פרויקט שני:** `demo-simple.project.json` נכשל נקי עם exit 2 ו-"project lacks: building.footprint.file".
- **הכרעות T0:**
  1. **מסגרות קואורדינטות:** site-enu-m = מזרח/צפון סביב site.origin, סיבוב נגד כיוון השעון ב-north_deg, בלי קנה מידה. ה-×0.92 שייך למפתח האתר בלבד, כי תכנית הדירה כוילה על מידות מודפסות. במסגרת הזו Z=0 הוא מפלס קומת הקרקע.
  2. **`box_world` (בקשת ab):** z0 = (f-16)×**3.2** (floor_to_floor מ-project.json) ו-z1 = z0+2.9 (ceiling). לקומה 16 זה בדיוק [0, 2.9] כפי שביקשו. ההודעה של ab ("(f-16)*2.9") סותרת את "ground -51.2" (16×3.2), ולכן נבחר 3.2: אחרת הקופסה זוחלת 0.3 מ' לקומה מה-slab של ה-clay, ו-6.9 מ' בקומה 39.
  3. **status ו-price:** status "unknown" ממופה ל-"for-sale" (placeholder, רשום ב-note). price = 0, כי הסכמה לא מקבלת null.
  4. **tour_url:** ברירת המחדל היא `http://127.0.0.1:8848/?scope=apartment&tour={tour_id}`, וניתן לשנות ב-`--tour-url-template`.
  5. **ה-preview של tower_mass:** נחתך כברירת מחדל, ו-`--mass-preview` מחזיר אותו (מופנה לתיקייה שלנו). זה היה 4 מתוך 4.5 הדקות; הריצה ירדה ל-46 שניות.
  6. **PNG:** נצייר ב-cv2, לא ב-matplotlib. matplotlib לא מותקן ב-venv המשותף, ולא התקנתי בו כלום.
- **התאמת ה-Check (שונה מהשורה בכרטיס, בכוונה):**
  1. ל-`validate.mjs` אין `--units`. הוא מקבל רק תיקיית פרויקט עם units.json + flow.json, והצורה שבכרטיס קורסת עם ENOENT על `--units\units.json`. לכן ה-Check מייבא את `validateSchema(unitsSchema, …)` מתוך validate.mjs ומריץ אותה על units.json לבד. בדיקות הצלב מול flow.json לא רלוונטיות לכרטיס.
  2. `tower_mass.py` לא נמצא ב-git (`C:\RnD\Projects\Habait\tools` אינו ריפו), כך ש-`git diff` לא מוכיח עליו כלום. במקומו נבדק sha256 של `tower_mass.py` ושל `tower-mass-preview.png` מול הערכים שנלקחו לפני הריצה הראשונה.
  3. נוספו `--expect apt846:floor=16:facing=SSE` ו-`--selftest`.
- **קבצים שנכתבו:**
  - `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\building.py`
  - `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\rainbow\` — `units.json`, `units-geometry.json`, `tower-mass.obj` (site-enu-m, 14.9 MB), `units-check.png`, `consumer-check.png`, `mass-plan-world\{tower-mass.obj,tower-mass.json}` (פלט הכלי הגולמי ב-plan world)
- **פלט ה-Check (מילה במילה):**
```
$ cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 300 $PY Habait/engine/building.py --project Habait/engine/fixtures/rainbow-846.project.json --out Habait/engine/_local/rainbow --expect apt846:floor=16:facing=SSE && node --input-type=module -e "import {unitsSchema, validateSchema} from './Habait/platform/contracts/validate.mjs'; import {readFileSync} from 'node:fs'; const u = JSON.parse(readFileSync('Habait/engine/_local/rainbow/units.json','utf8')); const e = validateSchema(unitsSchema, u); e.forEach(x => console.log('schema ' + x)); const other = e.filter(x => !/unexpected property \"box_world\"/.test(x)); console.log(other.length ? 'units.json: ' + other.length + ' real error(s)' : 'units.json: OK against units.v0 except ' + e.length + ' expected box_world flag(s) (ab extends the schema)'); process.exit(other.length ? 1 : 0)" && timeout 120 $PY Habait/engine/building.py --selftest --project Habait/engine/fixtures/rainbow-846.project.json && printf '%s  %s\n' 0119460309ad49673922683526e83f38d29ca3bab06aa00f715197c429e4e84b /c/RnD/Projects/Habait/tools/bench/site846/tower_mass.py 3ace2ff0ca010331cac141b2c85bf9f0b01b9c3401196f41ee99d87c0124ff62 /c/RnD/Projects/Habait/tools/bench/site846/tower-mass-preview.png | sha256sum -c - && echo BENCH-UNTOUCHED
frame   site-enu-m, north 304.4 deg, origin 32.1036395,34.7847934; origin_plan from fallback: ..\..\studio\_local\projects\apt846-rainbow-tlv\derived\shots.json unit_centre_m (site.origin_plan_cm absent)
tower   floors 0..39 x 3.2 m, plate 976.0 m2
unit    apt846 floor 16 type L: box_world [0.738, -16.031, 0.0, 14.431, -0.378, 2.9] (plan world, floor 16 at z 0)
        site-enu z 51.2..54.4 m, bbox E -7.645..6.436 N -7.283..5.238, inside plate 0.989
        azimuth: terrace 169.4 deg S, facade 151.5 deg SSE, radial 130.6 deg SE; declared facing ['east', 'north']; placement: identity (plan.json envelope = footprint.fit.plan_envelope_cm within 0.00 %)
wrote   Habait/engine/_local/rainbow\units.json, units-geometry.json, tower-mass.obj, units-check.png
units.json: OK against units.v0 except 0 expected box_world flag(s) (ab extends the schema)
selftest PASS  the fixture as is: passed (want pass) - no errors
selftest PASS  north flipped 180 deg (known-bad): failed (want fail) - --expect apt846:floor=16:facing=SSE: facing 349.4 deg (N) is 168.1 deg from SSE
selftest INFO  the sheet's arrow 291.6 (12.8 deg off; marginal at +-22.5, informative): failed - --expect apt846:floor=16:facing=SSE: facing 182.2 deg (S) is 24.7 deg from SSE
selftest PASS  unit moved 25 m in the key (known-bad): failed (want fail) - apt846: only 0.0 % of the unit lies inside the floor plate (< 95 %)
selftest PASS  same type one floor up (stacking): passed (want pass) - no errors
selftest PASS  stacked box is the hero box + 3.20 m in Z, same plan position: True
selftest PASS  a unit of an unknown type without placement (known-bad): failed (want fail) - stray-1: unplaced (no placement in the floor key: no units[].placement, plan_json envelope does not match the footprint fit, and no single same-type unit to stack on)
selftest PASS  no building.footprint (known-bad input): failed (want fail) - InputError: project lacks: building.footprint.file (absent: a traced floor plate is required)
SELFTEST OK
/c/RnD/Projects/Habait/tools/bench/site846/tower_mass.py: OK
/c/RnD/Projects/Habait/tools/bench/site846/tower-mass-preview.png: OK
BENCH-UNTOUCHED
exit 0
```
  ("0 expected box_world flag(s)": ab כבר הוסיף `box_world` כשדה אופציונלי ל-units.schema.json ב-12:35, ולכן הוולידטור ירוק בלי סינון.)
- **כסף:** $0 (אין קריאות בתשלום, אין ledger)
- **פגמים פתוחים:**
  1. **תופעת לוואי, תוקנה:** הריצה הראשונה (12:37) ייבאה את tower_mass.py, ו-Python כתב `C:\RnD\Projects\Habait\tools\bench\site846\__pycache__\tower_mass.cpython-313.pyc` לתיקייה של habait-16. התיקייה מכילה רק את הקובץ הזה, ומחקתי אותה. building.py מייבא עכשיו עם `sys.dont_write_bytecode`. הריצה האחרונה לא השאירה כלום (נבדק), וה-hash של tower_mass.py ושל ה-preview זהה ל-baseline.
  2. **רק דירה אחת קיבלה bbox:** ב-project.json יש דירה אחת בלבד (846). שאר המגדל צריך טבלת דירות + `placement` לכל טיפוס שאינו 846 (ראו הדיף).
  3. **אי-התאמה בין ה-fixtures:** ב-fixture של הפלטפורמה (`platform/fixtures/rainbow/units.json`) המזהים הם `rainbow` / `846`, וב-project.json הם `rainbow-tlv` / `apt846`. בדיקת הצלב units↔flow תיכשל עד שמחליטים על מזהה אחד.
  4. **origin_plan:** נלקח כ-fallback מ-`studio/.../derived/shots.json` (`unit_centre_m`). זה צימוד ל-Studio עד ש-`site.origin_plan_cm` נכנס ל-project.json.
  5. **tour_url:** לא ידוע אם :8848 מכבד `&tour=`; ה-handoff הידוע הוא `?scope=apartment&room=…`.
- **דיף מוצע ל-ab:** (לא ערכתי סכמה, fixture או validator)
```diff
# Habait/engine/schema/project.schema.json  (EXTEND, 0.1.0 -> 0.2.0)
 "site": { "properties": {
+  "origin_plan_cm": { "type": "array", "minItems": 2, "maxItems": 2, "items": { "type": "number" },
+    "description": "the point of site.origin in the floor-key / unit-plan frame (cm, +y down); building.py needs it to place the plan on the site (today read from the studio's shots.json unit_centre_m)" },
 ...
 "$defs": { "unit": { "properties": {
+  "placement": { "type": "object", "additionalProperties": false, "description": "where this unit sits in building.footprint's floor-key frame; omit when plan_json IS that frame (the unit the footprint was fitted to) or when a single same-type unit on another floor can be stacked",
+    "properties": {
+      "key_polygon_cm": { "type": "array", "minItems": 3, "items": { "type": "array", "minItems": 2, "maxItems": 2, "items": { "type": "number" } } },
+      "key_transform": { "type": "object", "additionalProperties": false, "properties": {
+        "mirror_x": { "type": "boolean" }, "rotate_deg": { "type": "number" },
+        "translate_cm": { "type": "array", "minItems": 2, "maxItems": 2, "items": { "type": "number" } } } } } },
# Habait/engine/fixtures/rainbow-846.project.json
-      "facing": ["east", "north"],
+      "facing": ["south", "east"],
+      "placement": {},
   (מדוד: מרפסת 169.4°, חזית 151.5°, רדיאלי 130.6°. "east, north" הם כיווני הגיליון, לא כיווני מצפן)
+  "site": { "origin_plan_cm": [648.7, 820.45], ... }      (= unit_centre_m של ה-Studio)
# Habait/platform/contracts/units.schema.json
-  "box_world": { ... "description": "... floor 16 floor = z 0, floor height 2.9, ground -51.2 ..." }
+  "box_world": { ... "description": "... floor 16 floor = z 0; z0 = (floor-16) * floor_to_floor (3.2 m), z1 = z0 + ceiling (2.9 m); ground -51.2 ..." }
-  "status": { "enum": ["for-sale", "sold", "reserved"] }
+  "status": { "enum": ["for-sale", "sold", "reserved", "unknown"] }       (היום unknown -> for-sale placeholder)
+  "bbox3d": optional { "frame": "site-enu-m", "min": [e,n,z], "max": [e,n,z] }   (או להשאיר ב-sidecar units-geometry.json, החלטת ab)
```
- **קורא שני:**
  - habait-16: `box_world` ב-`_local/rainbow/units.json` הוא הקלט של `world2equi.py --units` שלו. הצירים תואמים, נבדק על 3 נודים + overlay. Z עולה 3.2 לקומה (לא 2.9). בנוסף, נוצר והוסר `__pycache__` בתיקיית ה-bench שלו.
  - habait-ab: הדיף לסכמות ול-fixture, ותיאור `box_world` שסותר את עצמו.
- **לזיכרון:** building.py (A4) גנרי: project.json → מסה (עוטף את tower_mass.py בקריאה בלבד) + קופסה לכל דירה → units.json עם box_world (plan-world מ', קומה 16 = z 0, צעד 3.2, תקרה 2.9) + units-geometry.json (site-enu). 846: קומה 16, מרפסת 169° (SSE/S), חזית 151.5° SSE, 98.9 % בפלטה; world2equi תואם. selftest מפיל צפון הפוך/דירה מוזזת. חסר: site.origin_plan_cm, units[].placement.

# משימה 19: C4 (צד Blender): הטלת bbox של כל דירה לפוליגון ב-equirect לכל פריים של hold-facade → hotspots.json

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | C |
| **מקור בתכנית** | חלק ג §2 ערוץ C, שלב C4; חלק ב §2.4 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `blender-scene` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 3 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

לכל פריים של הקטע `hold-facade` (ובהמשך לכל פריים של כל קטע): הטלת ה-bbox התלת-ממדי של כל דירה אל קואורדינטות equirect (yaw/pitch → u,v) → פוליגון (8 קודקודים מוטלים → convex hull) → `hotspots.json` בפורמט החוזה של D (`units.schema.json`: polygons[frame]). בלי Blender בזמן ריצה: מתמטיקה טהורה מ-camera.json, כדי שזה ירוץ בכל מקום. זה מה ש-residence.tech עושים ב-72 פריימים × 20 דירות; אצלנו גם על 360.

## תלויות

- 03 (units.json עם bbox3d), 17 (camera.json של hold-facade)

## קלטים (קריאה)

- 03: `units.json`
- 17: `Habait/flyover/_local/segments/hold-facade/camera.json`
- `Habait/platform/contracts/units.schema.json` (פורמט polygons; קריאה; הצעות שינוי בכתב בלבד)

## קבצים (הסוכן כותב רק כאן)

- `Habait/flyover/project_units.py` (חדש; numpy בלבד)
- `Habait/flyover/_local/segments/hold-facade/hotspots.json`
- `Habait/flyover/_local/segments/hold-facade/debug-0000.png` (הפוליגונים מצוירים על הפריים)

## צעדים

1. מערכת צירים: אתר (מטרים, צפון 304.4°) ↔ מצלמה (camera.json) ↔ equirect (u = yaw/2π, v = pitch/π); לכתוב בדיקת יחידה על נקודה ידועה (מרכז 846 → מול המצלמה ב-hold-facade).
2. לכל פריים × דירה: 8 קודקודים → (u,v); טיפול בחציית התפר u=0/1 (לפצל פוליגון); convex hull; סינון דירות מאחורי המצלמה.
3. פלט בפורמט החוזה; debug PNG על פריים 0 ועל פריים באמצע.
4. בדיקה: הפוליגון של 846 מכסה את החלון/מרפסת הנכונים בפריים (מול הסקין/clay).

## קריטריוני קבלה

- [ ] hotspots.json לכל פריימי hold-facade, תואם לסכמה של D.
- [ ] 846 מסומן על המרפסת הנכונה (קומה 16, SSE) בפריים 0 ובאמצע (debug PNG).
- [ ] טיפול בתפר: אין פוליגון שחוצה את כל הרוחב.
- [ ] בדיקת היחידה עוברת.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 300 $PY Habait/flyover/project_units.py --units Habait/engine/_local/rainbow/units.json --camera Habait/flyover/_local/segments/hold-facade/camera.json --out Habait/flyover/_local/segments/hold-facade/hotspots.json --selftest --debug 0 && node Habait/platform/contracts/validate.mjs --units Habait/flyover/_local/segments/hold-facade/hotspots.json
# צפוי: "selftest: unit 846 center projects to (u,v) within 0.5deg of expected", validate exit 0
```

**Reviewer scope:** נכונות ההטלה בלבד: הפוליגון של 846 על המרפסת הנכונה (לבדוק בעין את debug-0000.png מול הפריים).

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

_(סוכן `blender-scene`, 2026-11-02 ~15:00–15:40 שעון המכונה, הופעל על ידי habait-ab מהעץ הראשי. הריצה נעצרה פעם אחת על מגבלת המנוי והמשיכה מהעבודה השמורה.)_

- **מצב:** **DONE** (T0; לא עלה דרגה). Blender לא הורץ.
- **מה נעשה:**
  - `Habait/flyover/hotspots/project_units.py` (חדש, numpy בלבד): units.json + camera.json של קטע → `hotspots.json` בפורמט החוזה, ועוד `hotspots.meta.json` ו-debug PNG.
    - **ההטלה:** ההטלה עוברת דרך `matrix_world` של כל פריים, ולכן תעבוד גם על מצלמה עם pitch/roll בעתיד.
    - **פוליגון:** convex hull של 8 הפינות + 4 נקודות על כל צלע, נפרש סביב מרכז הקופסה.
    - **תפר u=0/1:** פיצול לשני הוטספוטים עם אותו סמן.
    - **סינון:** מצלמה בתוך הקופסה; דירה מוסתרת על ידי הבניין (פריזמת הפלטה, 23 קודקודים, מ-‎-51.2 עד 79.8); מצלמה מעל או מתחת לקופסה.
    - **גנרי:** הסקריפט גנרי לכל הדירות. ב-units.json יש היום 12 דירות (846 + 11 קופסאות מוערמות של ab), וכולן הוטלו.
  - **ההרצה:** על **כל ארבעת הקטעים**:

    | קטע | פריימים | הוטספוטים | הערות |
    |---|---|---|---|
    | hold-facade | 72 | 864 | 0 מסוננים |
    | approach | 192 | 2008 | 296 דירה-פריים מוסתרים |
    | orbit | 408 | 3775 | 1121 מוסתרים |
    | descend-846 | 120 | 1349 | 91 מסוננים |

    כל קטע רץ ב-2–6 שניות.
  - **בדיקת עין:** `debug-0000-apt846.png` ו-`debug-0036-apt846.png` מצוירים על ה-clay equirect של node-b-tower (בפריים 0 הפוזה תואמת בסטייה 0.00 מ', ובפריים 36 בסטייה 0.67 מ'). הדירה הפתוחה עם הפנים המרוהט בקומה 16, בחזית SSE, יושבת במרכז הפוליגון האדום של 846.
  - **בדיקת סבירות של ה-occlusion:** לאורך ה-orbit, 846 נראית כשהמצלמה בכיוון תכנית ‎300°→209° ומוסתרת ב-210°–300°. זה הצד הנגדי לפינת ה-SE שלה (נורמל המרפסת בתכנית 113.8°).
- **הכרעות T0:**
  1. **camera.json:** ה-camera.json של כרטיס 17 לא היה בעץ הראשי, כי `_local` של ה-worktree נמחק איתו. נוצר מחדש עם הסקריפט של 17 עצמו (`render_segments.py --plan-only`, 17/17 PASS) **בתוך התחום שלי** (`Habait/flyover/hotspots/_local/cameras/`), לא ב-`equirect/_local/segments/`.
     - ה-orbit כבר מהסיבוב החדש של ab: 408 פריימים, סה"כ 792 = 33 ש'.
     - hold-facade זהה לכרטיס 17 (לופ ב-node-b, yaw 302.01).
  2. **world2equi.py לא מיובא:** הוא מפרסר argv ופותח קבצים כבר ב-import, כך שייבוא לא מעשי. ה-selftest מריץ אותו בקריאה בלבד כתהליך נפרד (`-I -B`) ומשווה מרכז + 8 פינות של 12 הדירות: 0.016° מקסימום. אין העתקת קוד.
  3. **"מאחורי המצלמה":** ב-equirect אין "מאחור", ולכן הפירוש הוא "לא נראה מהנקודה": occluded / בתוך הקופסה / עמודה (`camera-in-column`; ב-descend היו 68 רצועות קוטב שהיו "אוכלות" כל לחיצה כלפי מטה, ו-`--keep-pole-bands` משאיר אותן).
  4. **החוזה:** לחוזה אין שדה לפריים, ולכן הוטספוט אחד לפריים: `t_start=(frame−1)/fps`, `t_end=frame/fps`, בשניות מתחילת הקטע (כמו ה-0..6 שבפיקסטורה של ab). פיצול בתפר = שתי רשומות עם אותו t ואותו yaw/pitch (המרכז). ההוטספוטים הידניים של ab ל-hold-facade הוחלפו; הוטספוטים של קטעים אחרים נשמרים.
  5. **sidecar:** הוספתי `hotspots.meta.json` (קלטים + sha256, ולכל פריים: u/v, visible_frac, סיבת סינון, in_view_hint, `units_inside_plate`), כי לחוזה אין שדות לזה.
  6. **בדיקת ה-Check:** ל-`validate.mjs` אין `--units`; הוא מקבל רק תיקיית פרויקט. לכן ה-Check מייבא את `validateSchema(unitsSchema, …)`, כמו בכרטיס 03, ומריץ אותה על ארבעת הקבצים. בנוסף הוא בודק שאין פוליגון רחב מ-180°.
- **קבצים שנכתבו:**
  - `C:\RnD\Projects\Habait\habait-walkaround\Habait\flyover\hotspots\project_units.py`, `README-he.md`, `fixtures\synthetic.json`
  - `C:\RnD\Projects\Habait\habait-walkaround\Habait\flyover\hotspots\_local\cameras\{approach,orbit,hold-facade,descend-846}\camera.json`
  - `C:\RnD\Projects\Habait\habait-walkaround\Habait\flyover\equirect\_local\segments\{approach,orbit,hold-facade,descend-846}\`: `hotspots.json`, `hotspots.meta.json`, `debug-<i>.png` + `-view.png` + `-apt846.png`. הפריימים: hold-facade 0, 36; approach 0, 191; orbit 0, 204, 407; descend 0, 60, 119. סה"כ 32 MB, gitignored.
  - (במהלך הריצה נוצרה בטעות התיקייה `Habait/Habait/…` בגלל באג נתיב בגרסה הראשונה. היא נמחקה, והבאג תוקן.)
- **פלט ה-Check (מילה במילה):**
  - **הפקודה (מותאמת):** `cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 300 $PY -I Habait/flyover/hotspots/project_units.py --units Habait/engine/_local/rainbow/units.json --camera Habait/flyover/hotspots/_local/cameras/hold-facade/camera.json --out Habait/flyover/equirect/_local/segments/hold-facade/hotspots.json --occluder Habait/studio/_local/projects/apt846-rainbow-tlv/derived/tower-footprint.json --occluder-z Habait/engine/_local/rainbow/mass-plan-world/tower-mass.json --selftest --debug 0 && node --input-type=module -e "<validateSchema(unitsSchema) על 4 קבצי hotspots.json + ספירת פוליגונים רחבים מ-180°; exit 1 על כל שגיאה>"; echo "exit $?"`
```
[hotspots] hold-facade: 72 frames (stride 1) x 12 units -> 864 hotspots, 0 seam splits, 0 pole bands, 0 unit-frames culled; occluder tower-footprint.json
[hotspots] box on the floor plate: 0.26..0.88; WARNING mostly off the plate (< 0.80): {'837': 0.257, '847': 0.257, '857': 0.257, '876': 0.764}
[hotspots] wrote C:\RnD\Projects\Habait\habait-walkaround\Habait\flyover\equirect\_local\segments\hold-facade\hotspots.json (288 KB) + hotspots.meta.json
[debug] C:\RnD\Projects\Habait\habait-walkaround\Habait\flyover\equirect\_local\segments\hold-facade\debug-0000.png (+ -view.png, -apt846.png): bg Habait\studio\_local\projects\apt846-rainbow-tlv\renders\clay-pano-ortho\node-b-tower.png (pose node-b-tower, offset 0.00 m, yaw 0.00 deg)
selftest: unit apt846 center projects to (u,v) (0.50188, 0.57073) vs expected (0.50188, 0.57073) [0.0000 deg] within 0.5deg of expected
  [PASS] 846 centre: matrix_world path vs the bearing formula (frame 0): unit apt846 center projects to (u,v) (0.50188, 0.57073) vs expected (0.50188, 0.57073) [0.0000 deg] within 0.5deg of expected
  [PASS] 846 centre lies inside the director's framing on frame 0: yaw +0.68 deg, pitch -12.73 deg; view_hint +-32.75 deg
  [PASS] known-bad: mirrored u (counter-clockwise) is caught: misses by 1.35 deg
  [PASS] known-bad: plan Y not flipped (Y = +y_cm/100) is caught: misses by 9.77 deg
  [PASS] known-bad: one floor up (+3.2 m) is caught: misses by 2.43 deg
  [PASS] world2equi.py cross-check (habait-98's, read-only, frame 0): 12 units: worst centre 0.0132 deg, worst 8-corner extent 0.0164 deg (world2equi rounds to 1e-4)
  [PASS] convention probe 'ahead (+Y)': u 0.5000 want 0.5
  [PASS] convention probe 'right = clockwise from above (+X)': u 0.7500 want 0.75
  [PASS] convention probe 'behind (-Y)': u 0.0000 want 0.0
  [PASS] convention probe 'left (-X)': u 0.2500 want 0.25
  [PASS] seam: a box behind the camera across the u 0/1 seam: 2 parts, widths [7.59, 7.59] deg
  [PASS] no split: a box ahead: 1 part(s)
  [PASS] cull: camera inside the box: culled=camera-inside-box pole=None
  [PASS] cull: a box straight below the camera (default): culled=camera-in-column (nadir) pole=nadir
  [PASS] cull: a box straight below the camera (--keep-pole-bands): culled=None pole=nadir
  [PASS] occlusion: a unit on the near face of the plate: visible_frac 1.0
  [PASS] cull: a unit on the far face of the plate: culled=occluded (visible 0.00 < 0.1) pole=None
selftest: 17/17 pass
hold-facade: schema OK (units.v0), 864 hotspots, 0 polygon(s) wider than 180 deg, apt846 on 72 frame-parts
approach: schema OK (units.v0), 2008 hotspots, 0 polygon(s) wider than 180 deg, apt846 on 192 frame-parts
orbit: schema OK (units.v0), 3775 hotspots, 0 polygon(s) wider than 180 deg, apt846 on 325 frame-parts
descend-846: schema OK (units.v0), 1349 hotspots, 0 polygon(s) wider than 180 deg, apt846 on 103 frame-parts
exit 0
```
- **כסף:** $0. אין קריאות בתשלום ואין ledger.
- **פגמים פתוחים:**
  1. **AABB:** `box_world` הוא AABB בצירי התכנית, ולכן הפוליגון של 846 חורג ימינה מהחזית אל הרקע (בדיקת עין). התיקון: שדה `outline_world` (הפוליגון האמיתי של הדירה, יש prism ב-`units-geometry.json`) ו-hull ממנו.
  2. **קופסאות M:** הקופסאות המוערמות של ab לטיפוס M (837/847/857, bay ‎+9 מ') יושבות רק 26 % על הפלטה; 876 (PH) יושבת 76 %. הן תלויות מחוץ למגדל ב-debug ו"נראות" גם מהצד הרחוק ב-orbit. צריך לתקן ב-`units-stacked.json` (ab).
  3. **ה-occluder:** הוא הפלטה בלבד, בלי מרפסות 1.9 מ' ובלי שכנים.
  4. **ספירת הוטספוטים בקטע descend-846:** אחרי node-d רוב הדירות עדיין מקבלות הוטספוט. הנגן צריך כנראה להסתיר הוטספוטים בירידה; זו הכרעת UX ל-D.
  5. **רקע ל-debug:** לפריימים שאינם על נוד (approach, orbit באמצע, descend באמצע) אין clay equirect תואם, ולכן ה-debug הוא גריד. כשהדראפט של 17/18 ירונדר, אפשר להעביר `--bg` / `--bg-pose`.
  6. **camera.json כפול:** camera.json של הקטעים יושב היום רק תחת `hotspots/_local/cameras`. ריצת render אמיתית של 17 תכתוב אותו גם ל-`equirect/_local/segments/<seg>/`, ואז עדיף להצביע לשם.
- **הצעה לחוזה (ל-habait-ab; לא ערכתי את הסכמה):**
```diff
# Habait/platform/contracts/units.schema.json  $defs.hotspot (EXTEND, optional fields)
+ "frame":    { "type": "integer", "minimum": 1, "description": "segment-local frame (1-based) when hotspots are per frame; t_start = (frame-1)/fps" },
+ "polygons": { "type": "array", "items": { "$ref": "#/$defs/polygon" }, "description": "multi-part outline (a unit across the u 0/1 seam = 2 parts); replaces the 2-record split" },
+ "visible_frac": { "type": "number", "minimum": 0, "maximum": 1 },
+ "in_view_hint": { "type": "boolean", "description": "inside the director's default framing (view_hint) on that frame" }
# $defs.unit
+ "outline_world": { "type": "object", "description": "true unit polygon [[x,y],...] in plan-world m + z0/z1; the hull is built from it instead of box_world" }
# top level (or a per-segment file): 
+ "segment_fps": { "type": "object", "additionalProperties": { "type": "number" } }   (t <-> frame without camera.json)
  והגדרה בתיאור של hotspot: "t_start/t_end in seconds from the segment's first frame".
```
- **קורא שני:**
  - **habait-98:** המוסכמות של `project_units.py` זהות ל-`world2equi.py` שלו. נבדק בהרצה שלו עצמו, בקריאה בלבד: 12 דירות, 0.016° מקסימום. אם הוא משנה את מוסכמת ה-u או את ה-frame_world, ה-selftest כאן ייכשל. hotspots.json נוחת ב-`Habait/flyover/equirect/_local/segments/<seg>/hotspots.json` (+ `.meta.json`), ולא בתיקיות שלו. ה-debug קורא בקריאה בלבד את `studio/_local/.../clay-pano-ortho/node-b-tower.png` + `clay-nodes-ortho/*/faces.json`.
  - **habait-ab:** החוזה (הדיף למעלה: frame, polygons מרובי-חלקים, visible_frac, outline_world, הגדרת בסיס ה-t); תיקון הקופסאות של טיפוס M ב-`units-stacked.json`; ההוטספוטים הידניים שלו ל-hold-facade מוחלפים בקובץ הפלט (units.json המקורי לא נגע).
- **לזיכרון:** C4 (כרטיס 19): `Habait/flyover/hotspots/project_units.py` (numpy) מטיל box_world של כל דירה לפוליגון equirect לכל פריים → `equirect/_local/segments/<seg>/hotspots.json` (חוזה units.v0 תקין, 4 קטעים, 8k הוטספוטים). מוסכמה = world2equi (0.016°). מסנן מוסתרות דרך פריזמת הפלטה. 846 על הדירה הפתוחה בקומה 16 (בדיקת עין). חסר: outline_world במקום AABB; קופסאות M של ab מחוץ לפלטה.


---

## תוצאה (follow-up)

_(סוכן engine builder, 2026-11-02 ~15:45–16:15 שעון המכונה, מהעץ הראשי. הופעל לביצוע שני פגמים פתוחים מהבלוק למעלה: הרחבת החוזה (2) ותיקון הקופסאות של M/PH (1). ערוצים A/D עברו לסשן המפעיל מ-habait-ab. בלי git, בלי Blender, $0.)_

- **מצב:** **DONE** (T0; לא עלה דרגה).

### 1. הרחבת `units.schema.json` (additive בלבד)

**מה נוסף (כל השדות אופציונליים):**

- **`$defs.hotspot`:**
  - `frame`: מספר שלם, ≥ 1, אינדקס מבוסס-1.
  - `visible_frac`: בטווח 0..1.
  - `in_view_hint`: בוליאני.
  - `polygons`: מערך של טבעות, לפחות אחת, דרך `$defs.equirect_polygon` החדש.
- **תיעוד:** בתיאור של hotspot וב-`t_start`/`t_end` נכתב ש-t = **שניות מהפריים הראשון של הקטע** (פריים 1 = t 0; לכל פריים: t_start=(frame−1)/fps, t_end=frame/fps).
- **`$defs.unit.outline_world`:** אובייקט עם `polygon` חובה (‎[[X,Y],…]‎ ב-plan-world במטרים, לפחות 3 נקודות), ובנוסף `z0`, `z1` ו-`source` אופציונליים. אין בו שדות נוספים.
- **רמה עליונה:** `segment_fps` (מזהה קטע → fps > 0). ההחלטה להכניס אותו נרשמה למטה.

**מה לא השתנה:**

- `polygon` הקיים (טבעת אחת של ‎[[yaw,pitch],…]‎) נשאר כמו שהוא.
- **הערה:** בחוזה אין ולא היה שדה `points` מסוג string. "הפורמט היחיד הקיים" הוא `polygon`, והוא נשמר.
- `$id` נשאר `units.v0`.
- `validate.mjs` לא נערך: הוא כבר תומך בכל המילים שהשתמשתי בהן (`exclusiveMinimum`, `additionalProperties` כסכמה, `boolean`, `$ref` ל-`#/$defs`).
- לא נגעתי ב-picker.js, flow.js, serve.mjs ו-fixtures/.

**ההרצות:**

```
$ node scratchpad/schema_shapes.mjs      # צורות חדשות עוברות; צורות שגויות נדחות (known-bad)
ok   accepts legacy polygon only
ok   accepts frame + visible_frac + in_view_hint
ok   accepts polygons 2 parts (seam) + polygon
ok   accepts outline_world
ok   accepts segment_fps
ok   rejects frame 0: $.units[0].hotspots[0].frame: 0 < minimum 1
ok   rejects frame 1.5: $.units[0].hotspots[0].frame: expected integer, got number
ok   rejects visible_frac 1.2: $.units[0].hotspots[0].visible_frac: 1.2 > maximum 1
ok   rejects in_view_hint "yes": $.units[0].hotspots[0].in_view_hint: expected boolean, got string
ok   rejects polygons as a flat ring: $.units[0].hotspots[0].polygons[0]: fewer than 3 items
ok   rejects polygons part with 2 points: $.units[0].hotspots[0].polygons[0]: fewer than 3 items
ok   rejects polygons empty: $.units[0].hotspots[0].polygons: fewer than 1 items
ok   rejects outline_world without polygon: $.units[0].outline_world: missing required "polygon"
ok   rejects outline_world stray key: $.units[0].outline_world: unexpected property "colour"
ok   rejects segment_fps 0: $.segment_fps.orbit: 0 <= exclusiveMinimum 0
ok   rejects hotspot stray key still rejected: $.units[0].hotspots[0]: unexpected property "points"
shapes: 5 accepted, 11 known-bad rejected
exit 0

$ cd Habait/platform && npm test          # אחרי שינוי הסכמה (הרצה אחרונה)
fixtures/rainbow: OK - 12 units, 5 segments, 11 warning(s)
ok   fixture rainbow validates
ok   schema rejects a bad status / missing field / unknown next
ok   cross-check catches a dangling reference
ok   lead: WhatsApp link pattern
ok   lead: submit with no webhook is a stub; with webhook POSTs JSON
ok   analytics: capture without a key logs and buffers
ok   picker: module loads in node and exports createPicker
ok   server: index, flow, three.js module, json
ok   server: CORS * on .js/.css/.json (habait-89 imports js/picker.js from another origin)
ok   server: Range -> 206 with Content-Range
ok   server: 404 and traversal

all green
npm test exit 0

$ node test/browser.mjs                   # לפני: 22 ok; אחרי: 22 ok
browser exit 0
ok lines: 22
all green; screenshots in C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\test\shots
```

**ולידציה של 8 הקבצים** עם `validateSchema(unitsSchema, …)` (אחרי שני התיקונים; כל השמונה עברו גם לפני השינוי):

```
OK   flyover/equirect/_local/segments/approach/hotspots.json: 12 units, 1991 hotspots, 0 error(s)
OK   flyover/equirect/_local/segments/orbit/hotspots.json: 12 units, 3518 hotspots, 0 error(s)
OK   flyover/equirect/_local/segments/hold-facade/hotspots.json: 12 units, 864 hotspots, 0 error(s)
OK   flyover/equirect/_local/segments/descend-846/hotspots.json: 12 units, 1201 hotspots, 0 error(s)
OK   engine/_local/rainbow/units.json: 12 units, 11 hotspots, 0 error(s)
OK   engine/_local/rainbow/units.before-clamp.json: 12 units, 11 hotspots, 0 error(s)
OK   engine/_local/rainbow/units.before-stack.json: 1 units, 0 hotspots, 0 error(s)
OK   platform/fixtures/rainbow/units.json: 12 units, 13 hotspots, 0 error(s)
exit 0
approach: 0 polygon(s) wider than 180 deg
orbit: 0 polygon(s) wider than 180 deg
hold-facade: 0 polygon(s) wider than 180 deg
descend-846: 0 polygon(s) wider than 180 deg
```

(`platform/_local/dist/rainbow/846/apartment.json` הוא חוזה אחר. הוא נכשל גם לפני השינוי, ולא נספר.)

### 2. `Habait/engine/stack_units.py`: clamp לפלטת הקומה

**הפלטה:** הפוליגון של הפלטה נלקח מ-`units-geometry.json` (`building.plate_en`, ב-site ENU) והומר ל-plan-world בהיפוך של `frame.plan_to_site` (north_deg, origin_plan_cm). הוא תואם ל-`tower-footprint.json` של project_units בסטייה של 1 מ"מ לכל היותר בקודקוד.

**הכלל:**

- כל טיפוס עם bay שונה מ-0 זז להזזה הקרובה ביותר ל-bay הנומינלי: לאורך החזית, ופנימה בלבד.
- התנאים להזזה:
  - כיסוי הפלטה ≥ 0.90, גם בגריד 12×12 (אותו מדד כמו project_units) וגם בגריד 40×40.
  - חפיפה עם טיפוס אחר באותה קומה ≤ החפיפה שכבר יש בפריסה הנומינלית (0.348).
- הטיפוס של הגיבור (L, bay 0) לא זז. הקופסה האמיתית של apt846 זהה ביט לביט.

**דגלים:**

- `--min-plate`, `--max-overlap auto`, `--plate`, `--clamp-step`, `--clamp-radius`.
- `--no-clamp`: ההתנהגות הישנה. נבדק שהוא משחזר את units.before-clamp.json ביט לביט.

**known-bad:** `--min-plate 1.01` מחזיר exit 1 (`FAIL: a clamped type stays under --min-plate 1.01`).

**גיבויים:** `units.before-clamp.json` ו-`units-stacked.before-clamp.json`.

**הסימון stacked-approx:** `"box_source": "stacked-approx"` נשמר ב-units-stacked.json (וגם ב-note של כל דירה, עכשיו עם ההזזה בפועל). ב-units-stacked.json נוספו `shift_of_type`, `plate_clamp`, ולכל דירה `along_m`, `inward_m` ו-`plate_cover`.

**תיקון אגבי בשלב הוולידציה של הסקריפט:** הוא הריץ cross-check של תיקיית פרויקט, שתמיד נכשל, גם לפני השינוי. נבדק: 10 שגיאות על הקובץ הישן, כי `rainbow-tlv`/`apt846` מול `rainbow`/`846` והמדיה לא בתיקייה הזמנית. עכשיו השלב הזה = `validateSchema(unitsSchema)` בלבד, כמו שה-docstring מבטיח.

```
$ timeout 300 $PY -I Habait/engine/stack_units.py
clamp K: bay -9.0 m covers 0.882 -> along -9.00 m, inward +0.75 m covers 0.910 (overlap 0.338 <= 0.348): clamped
clamp M: bay +9.0 m covers 0.257 -> along +1.25 m, inward +8.25 m covers 0.903 (overlap 0.347 <= 0.348): clamped
clamp PH: bay -18.0 m covers 0.764 -> along -16.50 m, inward +1.50 m covers 0.931 (overlap 0.031 <= 0.348): clamped
clamp: hero type L keeps the real footprint (box covers 0.806; not moved)
wrote C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\rainbow\units.json (12 units: 1 real + 11 stacked-approx) and C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\rainbow\units-stacked.json
along the facade: true facing 169.4 deg, north_deg 304.4 -> 23.8 deg clockwise from plan-up
schema: OK (units.v0)
exit 0

$ cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 300 $PY -I Habait/flyover/hotspots/project_units.py --units Habait/engine/_local/rainbow/units.json --camera Habait/flyover/hotspots/_local/cameras/hold-facade/camera.json --out Habait/flyover/equirect/_local/segments/hold-facade/hotspots.json --occluder Habait/studio/_local/projects/apt846-rainbow-tlv/derived/tower-footprint.json --occluder-z Habait/engine/_local/rainbow/mass-plan-world/tower-mass.json --selftest --debug 0,36
[hotspots] hold-facade: 72 frames (stride 1) x 12 units -> 864 hotspots, 0 seam splits, 0 pole bands, 0 unit-frames culled; occluder tower-footprint.json
[hotspots] box on the floor plate: 0.81..0.93
[hotspots] wrote C:\RnD\Projects\Habait\habait-walkaround\Habait\flyover\equirect\_local\segments\hold-facade\hotspots.json (288 KB) + hotspots.meta.json
[debug] ...debug-0000.png (+ -view.png, -apt846.png): bg ...clay-pano-ortho\node-b-tower.png (pose node-b-tower, offset 0.00 m, yaw 0.00 deg)
[debug] ...debug-0036.png (+ -view.png, -apt846.png): bg ...clay-pano-ortho\node-b-tower.png (pose node-b-tower, offset 0.67 m, yaw 0.00 deg)
selftest: unit apt846 center projects to (u,v) (0.50188, 0.57073) vs expected (0.50188, 0.57073) [0.0000 deg] within 0.5deg of expected
  [PASS] ... (17 שורות PASS, כולל world2equi cross-check: worst centre 0.0088 deg, worst 8-corner extent 0.0176 deg)
selftest: 17/17 pass
exit 0
units_inside_plate: {"826":0.806,"835":0.91,"836":0.806,"837":0.903,"845":0.91,"847":0.903,"855":0.91,"856":0.806,"857":0.903,"866":0.806,"876":0.931,"apt846":0.806}
```

**התוצאה:** אזהרת הפלטה נעלמה. לפני: `0.26..0.88; WARNING mostly off the plate (< 0.80): {'837': 0.257, '847': 0.257, '857': 0.257, '876': 0.764}`. אחרי: `0.81..0.93` בלי אזהרה.

| טיפוס | דירות | כיסוי לפני | כיסוי אחרי |
|---|---|---|---|
| M | 837 / 847 / 857 | 0.257 | **0.903** |
| PH | 876 | 0.764 | **0.931** |
| K | 835 / 845 / 855 | 0.882 | **0.910** |
| L (לא זז) | 826 / 836 / 856 / 866 / apt846 | 0.806 | 0.806 |

L נשאר 0.806, כמו הקופסה האמיתית של 846: ה-AABB של דירת פינה. ה-outline שלה יושב 0.987 על הפלטה.

**שלושת הקטעים האחרים:** הורצו מחדש עם אותה פקודה, כדי שלא יישארו עם הקופסאות הישנות:

| קטע | הוטספוטים | unit-frames מסוננים | exit |
|---|---|---|---|
| approach | 1980 | 324 | 0 |
| orbit | 3507 | 1389 (היו 1121) | 0 |
| descend-846 | 1190 | 250 | 0 |

ב-orbit יש יותר סינון, כי קופסאות M כבר לא תלויות מחוץ למגדל ולא "נראות" מהצד הרחוק. בדיקת עין של `hold-facade/debug-0000-view.png`: כל הקופסאות בתוך הצללית של המגדל.

### הכרעות T0

1. **הסף 90% לא בר-השגה לאורך החזית בלבד.** המקסימום שם הוא 0.896, וה-AABB של הגיבור עצמו מכסה 0.806. לכן ה-clamp הוא דו-ממדי: לאורך החזית, ופנימה בלבד.
2. **תקרת חפיפה = החפיפה הנומינלית (0.348).** בלי התקרה, M היה יושב 68% על 846, כי ההזזה החוקית הקרובה ביותר היא 0.75 מ' לאורך ו-3.5 מ' פנימה, וזה הוטספוט כפול.
3. **הטיפוס של הגיבור (L) לא זז.** זו טביעת הרגל האמיתית, והכיסוי שלה (0.806) עובר את סף האזהרה 0.80 של project_units.
4. **`segment_fps` נכנס.** הוא היה בהצעה של כרטיס 19, הוא additive, ומאפשר להמיר t ↔ frame בלי camera.json.

### קבצים

**נכתבו:**
- `C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\contracts\units.schema.json`
- `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\stack_units.py`
- `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\rainbow\{units.json, units-stacked.json, units.before-clamp.json, units-stacked.before-clamp.json}`
- `C:\RnD\Projects\Habait\habait-walkaround\Habait\flyover\equirect\_local\segments\{approach,orbit,hold-facade,descend-846}\{hotspots.json, hotspots.meta.json, debug-*.png}`

**נוצרו מחדש על ידי browser.mjs עצמו:** צילומי המסך ב-`platform/test/shots`.

### כסף

$0. אין ledger.

### פגמים פתוחים

1. **847/857/837 מוסתרות כמעט לגמרי מ-hold-facade.** הן עכשיו 8.25 מ' פנימה, מאחורי 846. visible_frac 0.146, מעט מעל סף הסינון 0.1. הסמן שלהן יושב 0.03° מהסמן של 846 (באותה עמודה). הנגן צריך לתעדף לפי `visible_frac` או לסנן מתחת ל-~0.25. זו הכרעת UX ל-D.
2. **המיקומים של K/M/PH עדיין הערכה.** הם יתוקנו רק כשהתכניות שלהם יתוחקרו; אז `outline_world` יחליף את ה-AABB.
3. **`project_units.py` עדיין לא כותב את השדות החדשים.** חסרים `frame`, `polygons`, `visible_frac`, `in_view_hint` (היום הם רק ב-hotspots.meta.json), וגם את `outline_world` הוא לא קורא. זה הצעד הבא בכרטיס 19 או בהמשך שלו.

### קורא שני

**habait-98.** הקופסאות של K/M/PH ב-`Habait/engine/_local/rainbow/units.json` זזו (K 0.75 מ' פנימה; M מ-+9 מ' לאורך ל-+1.25 לאורך ו-8.25 פנימה; PH מ-‎-18 ל-‎-16.5 לאורך ו-1.5 פנימה). כל מי שמטיל אותן דרך `world2equi.py --units` או ב-flyover3d יקבל מיקומים חדשים. החוזה `units.v0` הורחב בשדות אופציונליים: `frame`, `polygons`, `visible_frac`, `in_view_hint`, `outline_world`, `segment_fps`. קורא עם additionalProperties:false משלו צריך לקבל אותם.

- **לזיכרון:** כרטיס 19 follow-up: units.schema.json הורחב additive (hotspot.frame/polygons/visible_frac/in_view_hint, unit.outline_world, segment_fps; t = שניות מפריים 1 של הקטע); npm test ירוק, browser 22/22. stack_units.py מצמיד קופסאות מוערמות לפלטה (≥0.90, חפיפה ≤0.348): M 0.26→0.90, PH 0.76→0.93, K 0.88→0.91; אזהרת הפלטה נעלמה, 4 קטעים הוטלו מחדש. $0.

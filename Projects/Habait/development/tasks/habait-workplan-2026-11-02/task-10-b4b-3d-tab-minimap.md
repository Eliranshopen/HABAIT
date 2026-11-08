# משימה 10: B4ב: לשונית "3D" ב-model-viewer (3D/Top/Outdoor) + מיני-מפה בסיור 360 עם נקודת המצלמה

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | B |
| **מקור בתכנית** | חלק ג §2 ערוץ B, שלב B4; חלק ב §3 פריטים 1, 6 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `platform-dev` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 2 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

(א) קומפוננטת `<model-viewer>` עם ה-GLB: מצבי 3D / Top / Outdoor, Draco מקומי (לא gstatic), עברית; (ב) מיני-מפה: אותו GLB (או ה-top.png) בפינת הסיור 360, עם נקודת מיקום שזזה לפי הסצנה הנוכחית ו-yaw המצלמה. הרוכש תמיד יודע איפה הוא בדירה.

## תלויות

- 09 (ה-GLB); הסיור של 846 הוא של habait-16 → המיני-מפה נבנית כ-plugin ב-`Habait/platform/` ונמסרת ל-16 להטמעה

## קלטים (קריאה)

- 09: `apt846.glb`, `top.png`
- `Habait/tour360/apartments/apt846/{scenes.json,cameras.json}` (מיקום כל פנורמה בס"מ; קריאה בלבד)
- `Habait/tour360/engine/` (Photo Sphere Viewer adapter; API של אירועי yaw; קריאה)
- `Habait/platform/js/viewer360.js` (של ערוץ D, עריכה מותרת)

## קבצים (הסוכן כותב רק כאן)

- `Habait/platform/js/dollhouse.js`, `Habait/platform/js/minimap.js`, `Habait/platform/vendor/model-viewer/**` (גרסה נעוצה + draco)
- `Habait/platform/apartment.html` (לשונית 3D; משמש גם את 23)
- `Habait/platform/test/minimap.test.mjs`

## צעדים

1. לנעוץ model-viewer ו-Draco decoder מקומית (אין תלות ב-CDN בזמן ריצה).
2. לשונית 3D: שלושה כפתורים (3D/Top/Outdoor = camera-orbit presets), RTL, כיתוב משפטי מ-`disclaimer-he-en.md`.
3. minimap.js: ממפה (x,y בס"מ של plan.json) → פיקסל ב-top.png / קואורדינטת GLB; מאזין ל-`scene-change` ו-`yaw` של ה-viewer; חץ FOV.
4. בדיקה: Playwright על viewport iPhone 13 ו-Pixel 7: הלשונית נטענת, המיני-מפה זזה כשמחליפים סצנה.

## קריטריוני קבלה

- [ ] הלשונית נטענת במובייל < 2 ש' (עם ה-GLB של 09), בלי בקשות רשת חיצוניות.
- [ ] המיני-מפה מראה את המיקום הנכון ב-3 סצנות לפחות (living, kitchen, bedroomMain) מול cameras.json.
- [ ] הטסט עובר.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node test/minimap.test.mjs
# צפוי: "minimap: 3/3 scenes positioned within 20cm", "model-viewer loaded in <2000ms (4G)", exit 0
```

**Reviewer scope:** נכונות מיקום בלבד: הנקודה במיני-מפה תואמת את cameras.json ב-±20 ס"מ בכל סצנה.

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

_(platform-dev, 2026-11-02 ~13:50–14:45 שעון המכונה; הופעל על ידי habait-4b; worktree `board-habait-workplan`, ענף `board/habait-workplan`)_

- **מצב:** DONE (סוכן). הכרטיס נסגר סופית רק אחרי שהסשן המפעיל מעדכן את `memory.md` ומסמן "זיכרון נכתב".
- **מה נעשה:**
  - **מיני-מפה בסיור 360** (`js/minimap.js`): מבט-העל של כרטיס 09 (`top.png`, חתוך ומוקטן ל-`media/top.webp`, ‏564×640, ‏32 KB) בפינת ה-iframe של הסיור (למעלה-שמאל, inline-end ב-RTL, ‏117–124 px בטלפון; הקשה מגדילה). נקודה כתומה במיקום המצלמה של הסצנה, קונוס שמראה לאן מסתכלים (כיוון = `centreBearingDeg` של הסצנה + ה-yaw של הסיור, רוחב = ה-fov), נקודות קטנות לכל 11 החדרים. הקשה על חדר שולחת לסיור `habait:goto`. כל החלפת סצנה נרשמת כ-`room_view {tab:'tour', scene, prev, dwell_ms}`. המודול נטען lazy רק כשלשונית הסיור נפתחת. הודעה שמגיעה מהסיור לפני שהמודול נטען נשמרת ומוחלת אחרי הטעינה.
  - **לשונית 3D** (`js/apartment-3d.js`, הרחבה, three 0.170 + Draco, **בלי model-viewer** לפי הסשן המפעיל): שלושה כפתורים ב-RTL, "תלת-ממד / מלמעלה / מבחוץ", עם מעבר מונפש של המצלמה (750 ms). "מלמעלה" מסתכל ישר למטה כשראש התכנית למעלה, באותו כיוון כמו המיני-מפה ולשונית התכנית. "מבחוץ" נמוך (22°), מצד המרפסות: מחושב מה-extras של `floor_<room>` עם `room_is_outdoor`, כך שאין מספרים קשיחים לדירה.
  - **Lazy init + טעינה מוקדמת:** בטעינת הדף אין שום 3D. כשהדף פנוי (1.2 ש' אחרי `load` + `requestIdleCallback`, ולא כש-saveData פעיל), ה-iframe של ה-3D נטען מוסתר עם `#defer`: הוא מפענח את ה-GLB ואת Draco (decoder preload) בלי WebGL. בלחיצה על הלשונית נוצר רק ה-renderer. בכניסה ישירה ל-`#3d` הכול נטען מיד.
  - **סנכרון רצפה:** כשהסיור מדווח `floor`, הדף מעביר `habait:floor` ל-3D. ה-3D מתעדכן מיד, גם אם הוא עדיין רק preload. ההודעה `habait:3d-ready` מכסה הודעות שהלכו לאיבוד בזמן הפענוח.
  - **`tools/build_zip.mjs`** (קובץ של כרטיס 23): מעדיף את `apt846-<defaultFloor>.glb` (ריהוט neutral) על `apt846.glb`. מחשב את טבלת הרצפות מ-3 ה-GLBs ובודק שיש להם BIN chunk אחד. כותב בלוק `minimap` ל-`apartment.json`. ב-dollhouse.html: סרגל הכפתורים, מצב defer ופרוטוקול הודעות. הכיתוב המשפטי בתוך ה-iframe מקוצר לשתי שורות (הקשה פותחת), כי הדף מציג את הכיתוב המלא מתחת למסגרת. בלי זה הכיתוב כיסה שליש מהמודל בטלפון.
- **הכרעות T0:**
  1. **החלפת רצפה = החלפת חומר הרצפה, לא טעינת GLB אחר.** נבדק: ל-3 ה-GLBs של 09 יש BIN chunk זהה בבייטים (sha `de378daf51a3`) ו-JSON זהה חוץ מחומר הרצפה (`web_floor_parquet|concrete|marble`). המקדמים נקראים מכל GLB בזמן הבנייה, אז התוצאה זהה ל"טעינת ה-GLB המתאים", ב-0 בייטים נוספים. אם יום אחד הגאומטריה תשתנה בין הקבצים, הבונה מכבה את ההחלפה ומדפיס אזהרה.
  2. **ה-GLB בדף וב-ZIP הוא `apt846-parquet.glb`** (ריהוט neutral, 98 ב-13:10), לא `apt846.glb` הראשון (שולחן ורוד).
  3. **מיפוי top.png:** ב-`report.json` כתוב `top: null`, כי ריצת ה-marble דרסה אותו. לכן המיפוי נגזר מגבולות ה-GLB לפי הנוסחה של `export_dollhouse.py render_top()`. הוא מאומת מול ה-alpha bbox של top.png: סטייה של 0.96 px, כש-1 px = 0.81 ס"מ. אם 98 יכתוב שוב בלוק `top`, הבונה ישתמש בו.
  4. **המיני-מפה בכיוון התכנית** (ראש התכנית למעלה) והקונוס מסתובב. היא לא מסתובבת עם המבט, כדי שתתאים ללשונית התכנית ולמבט "מלמעלה".
  5. **בלשונית 3D אין בורר רצפה.** הרצפה נבחרת בסיור (מקום אחד) וה-3D עוקב אחריה (אלירן: ממשק פשוט). אפשר גם `?floor=` בדף.
  6. **שער "<2 ש'"** נמדד מהלחיצה על הלשונית עד הפריים הראשון, אחרי ה-preload (זה המסלול הרגיל, כי הסיור הוא לשונית הפתיחה). הכניסה הקרה ל-`#3d` נמדדת ומדווחת בנפרד (פגם 1).
- **מיפוי הקואורדינטות (בקשת המתאם; כרטיסים 13 ו-20 צריכים אותו):**
  - **cameras.json → ס"מ של התכנית: חלוקה בלבד.** `x_cm = at[0] / plan.pxPerCm`, `y_cm = at[1] / plan.pxPerCm` (pxPerCm = 2.25). **אין סיבוב.** "rotated ~20°" ב-cameras.json מתאר את השרטוט מול רשת הבניין, ו-plan.general.json נמצא באותה מסגרת בדיוק (`axes`: ראשית = פינה שמאלית-עליונה של ה-crop, x ימינה, y למטה, ס"מ; וגם `trace-config.json`: "crop frame = cameras.json px / 2.25"). אומת על כל 11 הסצנות מול `camera_points`: סטייה מקסימלית 0.063 ס"מ, וכל מצלמה בתוך ה-loop של החדר שלה.
  - **ס"מ של התכנית → GLB:** glTF `X = x_cm/100`, `Z = y_cm/100`, Y למעלה. אומת: גבולות 11 ה-`floor_<room>` ×100 זהים ל-loops של החדרים (0.00 ס"מ). Blender world: `X = x_cm/100`, `Y = -y_cm/100`.
  - **ס"מ של התכנית → פיקסל top.png:** `u = ((x_cm/100 - cx)/s + 0.5)·W`, `v = (0.5 + (y_cm/100 + cy)/s)·H`, עם `cx = 7.6110`, `cy = -8.2045`, `s = 16.5922 m`, `W = H = 2048` (apt846).
  - **כיוון (bearing):** 0 = למעלה בתכנית (−y), עם כיוון השעון. ה-yaw של Pannellum הוא 0 במרכז הפנורמה, שפונה ל-`centreBearingDeg` (scenes.json), וגדל ימינה. לכן `bearing = centreBearingDeg + yaw`. `northOffset` הוא של המצפן בלבד. צפון אמיתי = `apartment.json plan.northDeg` = 291.6° בתוך אותה מסגרת.
  - **ה-crop של ה-engine → ה-crop של הסיור (לכרטיסים שקוראים את `Habait/engine/_local/apt846/{labels.json, trace/trace.json}`):** הזזה בלבד, `tour_px = engine_px + (167, −297)`, בלי סיבוב ובלי שינוי קנה מידה. רישום ORB+RANSAC של שני ה-crops: 3989/4000 inliers, שארית 0.0 px, IoU של פיקסלים כהים 0.988 (אותו PDF ב-288 dpi, חלון חיתוך אחר: engine ‏3156×4257, סיור 3750×3900). אחר כך ס"מ = tour_px / 2.25. **שימו לב:** ה-engine מניח `px_per_cm_nominal = 2.2677` (288 dpi ב-1:50 בדיוק), והסיור 2.25. הפער הוא 0.8% (8 ס"מ ל-10 מ'). מי שמערבב ס"מ של engine עם ס"מ של הסיור חייב לעבור דרך הפיקסלים, לא דרך הס"מ.
- **חוזה ה-postMessage (habait-98 צריך לשדר אותו מ-`Habait/tour360/viewer/tour.js`; היום אין שם postMessage, ולכן הטסט משתמש ב-mock):**
  - סיור → דף (`window.parent.postMessage(msg, '*')` כש-`window.self !== window.top`): `{ type: 'habait:view', scene: '<id ב-scenes.json>', yaw: <מעלות, viewer.getYaw()>, fov: <מעלות, viewer.getHfov()>, floor?: 'parquet'|'concrete'|'marble', pitch?: <מעלות> }`. נשלח בטעינה, בכל `scenechange`, ובזמן סיבוב המבט (throttle של ~10 בשנייה מספיק).
  - דף → סיור (רשות): `{ type: 'habait:view-request' }` כשהמיני-מפה מוכנה (לענות ב-`habait:view`), ו-`{ type: 'habait:goto', scene }` כשהרוכש מקיש על חדר במיני-מפה.
  - הדף מקבל רק הודעות שה-`source` שלהן הוא ה-iframe של הסיור וה-origin שלהן הוא ה-origin של ה-src. הוא מאמת את השדות (`parseViewMessage`).
- **קבצים שנכתבו** (worktree, `Habait/platform/`): חדשים: `js/minimap.js`, `test/minimap.test.mjs`. של כרטיס 23: `js/apartment-3d.js`, `js/apartment.js` (המיני-מפה, ה-preload וממסר הרצפה; מחרוזת `apt.map.label`), `tools/build_zip.mjs`, `css/apartment.css` (תוספות בסוף בלבד). פלט הבנייה: `_local/dist/rainbow/846/**` (כולל `media/top.webp`; `_local` הוא junction לעץ הראשי). לא נגעתי ב-index.html, flow.html, flow.js, picker.js, style.css, i18n.js, fixtures, tour.js, cameras/scenes.json.
- **Check מותאם** (שמות הקבצים האמיתיים; הבנייה קודם, כי הטסט קורא את המניפסט; `--tour-apartment` מצביע על התיקייה בעץ הראשי, כי ב-worktree חסרה תיקיית `plan/` הלא-עקובה של apt846):
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/.claude/worktrees/board-habait-workplan/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node tools/build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846 --tour-apartment C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846 && timeout 600 node test/minimap.test.mjs
```
- **פלט ה-Check (מילה במילה):**
```
panos 11, stills 11, plan yes, glb card-09 (170 KB), floors parquet/concrete/marble (default parquet), minimap 564x640 32 KB, 11 scenes
zip: 27 files, 4.47 MB (<=25) -> C:/RnD/Projects/Habait/habait-walkaround/.claude/worktrees/board-habait-workplan/Habait/platform/_local/dist/rainbow/846/846.zip
page: C:/RnD/Projects/Habait/habait-walkaround/.claude/worktrees/board-habait-workplan/Habait/platform/_local/dist/rainbow/846/index.html  (16.4 s)
ok   manifest: minimap block with a point per interior scene  (11 scenes, 564x640 px, top from: GLB bounds + export_dollhouse.py render_top formula (report.json top is null))
ok   frame: cameras.json px / pxPerCm = plan.general.json camera_points (cm)  (11 cameras, worst 0.063 cm, each inside its room loop)
ok   frame: GLB floor_<room> bounds x100 = plan.general.json room loops (cm)  (11 floors, worst 0.00 cm)
ok   frame: top.png camera (GLB bounds, exporter formula) = top.png alpha bbox  (0.96 px off (1 px = 0.81 cm))
ok   frame: every camera dot falls on modelled floor in top.png (alpha > 0)  (11/11)
ok   presets: Top looks straight down plan-up, Outdoor from the terrace side, low  (top polar 0.06 deg, outdoor polar 68.0 deg)
ok   iphone: the minimap mounts in the tour corner with the top view, the first view message lands  (117 px wide)
ok   iphone: minimap dot vs cameras.json (screen read-back), living / kitchen / bedroomMain  (living 0.0 cm, kitchen 0.0 cm, bedroomMain 0.0 cm; all 11/11, worst 0.0 cm)
ok   iphone: yaw and fov turn the cone (bearing = centreBearingDeg + yaw)  (living yaw 90 -> 201.3 deg on the plan)
ok   iphone: tapping a room on the minimap asks the tour to go there (habait:goto)
ok   iphone: 3D tab preloaded at idle while hidden (GLB + Draco decoded, no WebGL yet)  (prepare 110 ms)
ok   iphone: 3D tab opens < 2000 ms after the tap (Fast 4G, preloaded)  (507 ms, 28820 triangles)
ok   iphone: the 3D floor follows the tour's floor switch (marble, then concrete live)  (parquet/concrete/marble from 3 GLBs (one BIN chunk))
ok   iphone: presets 3D / Top / Outdoor (RTL bar, animated)  (polar: 3d 50.61, top 0.06, outdoor 68 deg)
ok   iphone: no requests outside 127.0.0.1, no page errors  (14 requests, all local)
ok   pixel: the minimap mounts in the tour corner with the top view, the first view message lands  (124 px wide)
ok   pixel: minimap dot vs cameras.json (screen read-back), living / kitchen / bedroomMain  (living 0.0 cm, kitchen 0.0 cm, bedroomMain 0.0 cm; all 11/11, worst 0.0 cm)
ok   pixel: yaw and fov turn the cone (bearing = centreBearingDeg + yaw)  (living yaw 90 -> 201.3 deg on the plan)
ok   pixel: tapping a room on the minimap asks the tour to go there (habait:goto)
ok   pixel: 3D tab preloaded at idle while hidden (GLB + Draco decoded, no WebGL yet)  (prepare 146 ms)
ok   pixel: 3D tab opens < 2000 ms after the tap (Fast 4G, preloaded)  (336 ms, 28820 triangles)
ok   pixel: the 3D floor follows the tour's floor switch (marble, then concrete live)  (parquet/concrete/marble from 3 GLBs (one BIN chunk))
ok   pixel: presets 3D / Top / Outdoor (RTL bar, animated)  (polar: 3d 50.61, top 0.06, outdoor 68 deg)
ok   pixel: no requests outside 127.0.0.1, no page errors  (14 requests, all local)
ok   3D tab timings (ms; warm = tap after the idle preload, cold = page opened on #3d)  (iphone warm fast-4g 507; iphone warm fast-4g cpu4 1300; iphone cold #3d fast-4g cpu1 serve.mjs 3708; iphone cold #3d fast-4g cpu4 serve.mjs 5848; iphone cold #3d fast-4g cpu1 gzip 2295; iphone cold #3d fast-4g cpu4 gzip 4491; pixel warm fast-4g 336; pixel warm fast-4g cpu4 1206; pixel cold #3d fast-4g cpu1 serve.mjs 3454; pixel cold #3d fast-4g cpu4 serve.mjs 6013; pixel cold #3d fast-4g cpu1 gzip 2218; pixel cold #3d fast-4g cpu4 gzip 4082)
minimap: 3/3 scenes positioned within 20cm (all 11 scenes on 2 phones; worst 0.0 cm)
3d tab (three.js + Draco, not model-viewer) loaded in 507ms (4G) after the tap; cold #3d deep link 3708/3454ms on serve.mjs (no gzip), 2295/2218ms gzip-served

all green; screenshots in C:\Users\elira\AppData\Local\Temp\habait-minimap-shots
EXIT=0
```
- **רגרסיה:** `test/apartment.test.mjs` (כרטיס 23) על אותה בנייה: all green (5/5 לשוניות ב-3 viewports, ZIP של 4.47 MB, dollhouse.html offline). `npm test`: all green. `test/browser.mjs`: יש כשל אחד, `continue -> descend-846 -> enter-846 -> hand-off overlay`, כי ה-href של ה-hand-off ריק ב-`flow.html`. **הכשל לא מהכרטיס הזה:** flow.html, flow.js ו-picker.js לא טוענים אף קובץ ששיניתי (נבדק ב-grep), והוא שייך לקוד הזרימה של ab ב-snapshot של ה-worktree.
- **כסף:** $0. אין קריאות בתשלום ואין ledger. אין רשת חיצונית.
- **פגמים פתוחים:**
  1. **כניסה קרה ישירות ל-`#3d`** (קישור ששותף ללשונית): 3.5–3.7 ש' ב-Fast 4G דרך `serve.mjs`, שלא דוחס. עם שרת gzip (כמו כל אחסון סטטי או CDN) זה 2.2–2.3 ש', ועם CPU פי 4 עוד 4–6 ש'. dollhouse.html שוקל 1.77 MB, ב-gzip ‏0.59 ומ-brotli ‏0.47. מה שיקצר: gzip/brotli ב-`serve.mjs` (של ab), ו-`<link rel=preload>` ל-dollhouse.html בכניסה ל-`#3d` (שינוי ב-apartment.html). המסלול הרגיל, לחיצה מהסיור, עומד ביעד: 0.34–0.51 ש', ועם CPU פי 4 ‏1.2–1.3 ש'.
  2. **הסיור עוד לא משדר את `habait:view`.** עד ש-98 יוסיף את זה ל-tour.js, המיני-מפה נשארת בלי נקודה: מוצגות רק נקודות החדרים, בלי "אתם כאן".
  3. **top.png הוא מהייצוא הראשון:** פרקט, עם השולחן הוורוד. וב-`report.json` כתוב `top: null`. כדאי ש-98 ירנדר את top.png מחדש מ-`apt846-parquet.glb` (ריצה עם `--top-engine eevee` שלא נדרסת). המיני-מפה תיקח את התמונה ואת בלוק ה-top בבנייה הבאה.
  4. **הקריאה מהמסך** (0.0 ס"מ) עוברת דרך אותו affine. את נכונות ה-affine עצמו מוכיחות בדיקות המסגרת הבלתי-תלויות: cameras מול plan.general (0.063 ס"מ), GLB מול loops (0.00 ס"מ), top.png alpha מול גבולות ה-GLB (0.96 px), וכל מצלמה על רצפה מרונדרת.
  5. **ב-worktree חסרה התיקייה `Habait/tour360/apartments/apt846/plan/`** (לא עקובה ב-git), ולכן ה-Check מצביע עם `--tour-apartment` על העץ הראשי. בלי זה הבנייה יוצאת "plan no".
  6. החלפת שפה בדף אחרי שה-3D כבר נטען לא מחליפה את שפת הכפתורים בתוך ה-iframe. השפה נקבעת בטעינה.
  7. בניסיון עריכה דרך heredoc נשאר תהליך `python` של Windows שממתין (משימת רקע `bc0ntk1yq`). הוא לא נוגע בשום קובץ. לא הרגתי אותו, כי אי אפשר לזהות אותו בבטחה מבין תהליכי python של סשנים אחרים.
- **קורא שני:**
  - **habait-98** (tour360 ו-Blender): (א) לשדר את חוזה ה-postMessage שלמעלה מ-`viewer/tour.js` (`habait:view` בטעינה, ב-scenechange וב-yaw בקצב מוגבל, עם `floor`). רשות: לענות ל-`habait:view-request` ולכבד את `habait:goto`. בלי זה המיני-מפה בלי נקודה. (ב) לרנדר מחדש את top.png מה-GLB של הפרקט ולהשאיר את בלוק `top` ב-report.json (היום null). (ג) מיפוי הקואורדינטות למעלה: cameras px / 2.25 = ס"מ של plan.general = GLB×100, ו-engine px + (167, −297) = tour px.
  - **habait-ab** (platform ו-engine): (א) `serve.mjs` בלי gzip/brotli מוסיף ~1.2 ש' לכניסה קרה ל-3D. (ב) `test/browser.mjs` נכשל ב-hand-off של flow.html (href ריק), לא מהכרטיס הזה. (ג) שדות חדשים במניפסט `apartment.json`: `minimap`, `glb.floors` ו-`glb.default_floor`. `room_view` מקבל עכשיו `scene/prev/dwell_ms` מהסיור (שווה להכניס לסכמת האירועים). (ד) ה-engine מניח 2.2677 px/ס"מ והסיור 2.25, כך שס"מ של engine ≠ ס"מ של הסיור (פער 0.8%). המעבר הנכון הוא דרך הפיקסלים.
- **לזיכרון:** כרטיס 10 חי: מיני-מפה בפינת הסיור בדף הדירה (top.png של 09, נקודה + קונוס, ±0 ס"מ מ-cameras) ולשונית 3D ב-three עם תלת-ממד/מלמעלה/מבחוץ, preload במצב idle (0.3–0.5 ש' מהלחיצה ב-4G) ורצפה שעוקבת אחרי הסיור (החלפת חומר; ל-3 ה-GLBs יש BIN זהה). cameras px/2.25 = ס"מ של התכנית = GLB×100; engine px+(167,−297) = tour px. ממתין: 98 משדר `habait:view` מ-tour.js. $0.
- **עדכון 2.11 ~19:05 (engine-fix אחרי M1, פריט 5; habait-1d):** ה-Check נכשל רק על `manifest top.s`. אף קובץ לא stale: ה-GLBs של 98 מ-18:42 זהים בבייטים לאלה של 09, ובלוק `top` זהה (16.5922 [7.611, -8.2045]). הסיבה: `export_dollhouse.py` מעגל ל-4 ספרות (Δs = 1.98e-5 m = 0.0012 px), והטסט דורש 1e-6 מנוסחת ה-GLB. תוקן בלי Blender: בלוק `minimap` ב-`_local/dist/rainbow/846/apartment.json` חושב מגבולות ה-GLB בנוסחת render_top, בלי עיגול (`engine/_local/fix-846/logs-m1fix/fix_top.mjs`). ה-Check חזר ל-EXIT=0 (all green, 3/3 within 20cm). **שביר:** הבנייה הבאה של build_zip תחזיר את הכשל, עד שמתקנים את העיגול ב-exporter, ב-build_zip או בטולרנס של הטסט (פירוט בכרטיס 04, "תיקונים אחרי M1"). ה-top.png של 98 מ-18:42 הוא רינדור השיש ולא הועתק.

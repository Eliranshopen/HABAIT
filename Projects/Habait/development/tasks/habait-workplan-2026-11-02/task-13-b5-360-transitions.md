# משימה 13: B5: מעבר 360→360 בתוך הדירה (פנורמה על mesh נמוך + cross-fade) עם fallback fade

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | B |
| **מקור בתכנית** | חלק ג §2 ערוץ B, שלב B5; חלק א §3.4 (Matterport) ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `platform-dev` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 5 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

ניווט רציף בין נקודות בדירה בלי וידאו: הפנורמה הנוכחית מוטלת על mesh נמוך (מה-depth), המצלמה זזה לנקודה הבאה תוך ~0.8 ש' ו-cross-fade לפנורמה החדשה; ברשת/מכשיר חלש: fade פשוט. זה מה ש-3DVista/Matterport מוכרים כ-"3D transition".

## תלויות

- `Habait/tour360/engine/` (של habait-16): העבודה נעשית כ-plugin ב-`Habait/platform/js/` ונמסרת ל-16
- depth של הפנורמות (`360walkaround/tours/apt846-furnished/renders/*/depth.exr` → PNG מטרים)
- 10 (minimap: אותו מודל מיקומים)

## קלטים (קריאה)

- Photo Sphere Viewer engine ב-`Habait/tour360/engine/` (API; קריאה)
- depth PNG (מטרים) + cameras.json של 846
- three 0.170.0 כבר ב-`Habait/platform/package.json`

## קבצים (הסוכן כותב רק כאן)

- `Habait/platform/js/transition360.js`, `Habait/platform/js/depthmesh.js`
- `Habait/platform/test/transition.test.mjs`
- דף הדגמה: `Habait/platform/demo-transition.html` (שתי פנורמות של 846, balanced)

## צעדים

1. depth equirect → sphere mesh עם ורטקסים מוזזים (64×32 מספיק); טקסטורה = הפנורמה.
2. מעבר: tween של מיקום המצלמה מהנקודה A ל-B (מ-cameras.json) על mesh A, cross-fade ל-B כשמגיעים; סף FPS → fallback.
3. אינטגרציה כ-plugin לאירוע `hotspot-click` של ה-viewer (נקודת החיבור ש-16 מטמיע).
4. Playwright: מדידת FPS בזמן מעבר על viewport מובייל; צילום 3 פריימים.

## קריטריוני קבלה

- [ ] מעבר living→kitchen ו-living→terraceLiving רציף (≥ 24 fps בדסקטופ; fallback מופעל אוטומטית מתחת ל-15 fps).
- [ ] אין "קפיצה": ה-yaw נשמר בין הפנורמות.
- [ ] הטסט עובר; דף ההדגמה עובד ללא רשת.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node test/transition.test.mjs
# צפוי: "transitions: 2/2 ok, yaw drift <= 1deg, fps_desktop >= 24, fallback triggers at <15fps", exit 0
```

**Reviewer scope:** רציפות בלבד: yaw נשמר (≤ 1°) ו-FPS נמדד, לא מוערך.

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

- **מצב:** DONE (Check exit 0). הכרעות T0 רשומות למטה.
- **מה נעשה:**
  - `js/depthmesh.js`: מפענח את ה-depth של 360walkaround (rgb24-be, ס"מ, מרחק רדיאלי), מוריד רזולוציה ב-median לבלוקים, דוגם בילינארית עם wrap, ובונה sphere מוזז של 64×32 (65×33 ורטקסים; כל ורטקס על הקרן שלו בעומק שנמדד, שגיאה 2e-4).
    - **הכרעה T0:** טקסטורה **פרויקטיבית**: shader שמחשב u/v מהכיוון מנקודת המצלמה, במקום UV אפיני. UV אפיני על mesh מוזז מעוות את התמונה בתוך כל תא. נמדד: הפרש 6/255 בין הפנורמה למסגרת הראשונה, ועם ה-shader 0.08.
    - **הכרעה T0:** משולשים על קצה עומק (יחס עומקים > 1.5; בסלון 98 מתוך 4096) נדחפים לעומק הרחוק במקום להימתח כמו גומי. בלי זה ספה נמרחת על כל המסך באמצע המעבר.
  - `js/transition360.js`: `TransitionViewer` (דף ההדגמה), `runTransition`, `FpsMeter` (חותמות rAF) ו-`createTransitionPlugin().attach(viewer)` למנוע של tour360.
    - המצלמה נעה מ-A ל-B ב-800 ms (easeInOutCubic). המיקומים מ-cameras.json (px/2.25), גובה עין 1.6, בלי סיבוב; אותן מוסכמות כמו `minimap.js`.
    - **הכרעה T0:** ה-cross-fade ל-B (על ה-mesh של B) מתחיל ב-40% מהתנועה ונגמר בדיוק בהגעה, כדי להסתיר את המריחה באמצע. פריים ההגעה הוא פנורמה B מנקודה B.
    - ה-bearing וה-pitch נשמרים לכל אורך המעבר. ה-yaw בהגעה = bearing − centreBearingDeg של B. זו אותה מתמטיקה כמו arriveYaw של tour.js, אבל עם כיוון המבט ולא כיוון התנועה.
    - Fallback לפני המעבר: אם ה-rAF של 30 הפריימים האחרונים מתחת ל-15 fps, רץ fade פשוט (450 ms).
    - Fallback בזמן המעבר: אם 4 הפריימים האחרונים מתחת ל-15 fps לפני שה-fade התחיל, המיקום קופא והמעבר מסתיים ב-fade (`mesh->fade`).
    - ב-plugin: overlay canvas מעל ה-container של PSV, והמנוע מחליף ל-B מתחתיו (`loadScene(B, pitch, yawB, hfov, 0)`).
    - **הכרעה T0:** התנועה מחכה עד 400 ms להחלפה של המנוע (נמדד 58–88 ms). בלי ההמתנה, ה-decode של PSV בפריימים הראשונים הוריד את המעבר הראשון ל-fade.
  - `demo-transition.html` + `css/transition.css`:
    - עברית RTL (ואנגלית עם `?lang=en`), נקודות דלת על הפנורמה (u/v מ-scenes.json), צ'יפים של חדרים, "הגדרות מתקדמות" (fade בלבד + מדדים), והכיתוב המשפטי הקצר.
    - עובד בלי רשת: three נטען מ-node_modules והנכסים מ-`_local/transition`.
    - נבדק חי: `http://127.0.0.1:8850/demo-transition.html` מחזיר 200 (השרת לא הופעל מחדש).
  - `test/transition.test.mjs`:
    - prep: 11 מפות עומק 128×64, 3 פנורמות ו-`apt846.json`.
    - בדיקות node: מסגרות הקואורדינטות. cameras.json מול plan_cm של הרינדור: 0.06 ס"מ; centreBearingDeg מול yaw: 0.000°.
    - Chromium headless על SwiftShader, בשלושה viewports: desktop 1280×720, iPhone 13, Pixel 7.
    - כל מעבר רץ 3 פעמים. ה-fps הוא החציון, מחותמות rAF של הפריימים של המעבר עצמו.
    - ה-drift נקרא בכל פריים מהמצלמה שצוירה בפועל. רציפות הקצוות נמדדת כהפרש פיקסלים ממוצע.
    - ה-fallback נבדק עם עומס סינתטי על ה-main thread (busy-wait של 90 ms לפריים).
    - חלק 3 מריץ את ה-plugin על המנוע האמיתי, דרך walkTo ודרך לחיצה על marker. המנוע נארז ב-esbuild שלו עצמו, בקריאה בלבד, אל `_local/transition/engine`.
- **קבצים שנכתבו:**
  - קוד: `Habait/platform/js/depthmesh.js`, `Habait/platform/js/transition360.js`, `Habait/platform/test/transition.test.mjs`, `Habait/platform/demo-transition.html`, `Habait/platform/css/transition.css`.
  - נגזרים (gitignored): `Habait/platform/_local/transition/{apt846.json, <11 rooms>.depth.png, 04-living.webp, 02-kitchen.webp, 05-terrace-living.webp, engine/engine.js+css}`.
  - צילומים: `Habait/platform/test/shots/transition-{desktop,iphone13,pixel7}-living-{kitchen,terraceLiving}-{1,2,3}.png` (t = 0 / 0.5 / 1) ו-`transition-engine-kitchen-arrival.png`.
  - לא נגעתי ב-picker, flow, apartment*, analytics, serve.mjs, package.json, tour360 או 360walkaround.
- **פלט ה-Check (מילה במילה):** `cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node test/transition.test.mjs`
```
prep: 11 depth maps 128x64 + 3 panoramas -> C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\_local\transition
ok   frame: cameras.json px / 2.25 == the depth render plan_cm, centreBearingDeg == its yaw (11 rooms)  (worst 0.06 cm, 0.000 deg)
ok   depth: the derived maps decode inside the render's own min/max, floor below = eye height  (living 0.97-7.06 m, kitchen 0.89-8.43 m, terraceLiving 0.41-1377.20 m)
ok   mesh: 65 x 33 vertices, each on its own ray from the camera at the sampled depth  (worst ray/depth error 2.0e-4; depth-edge triangles pushed back at 1.5x: 98/4096)
ok   yaw: bearing <-> tour yaw round trip; arrival yaw = tour.js arriveYaw maths with the bearing held  (living yaw 20 -> bearing 131.3 -> kitchen yaw 5.8)
ok   fallback threshold: < 15 fps -> fade, 15+ or unknown -> mesh
ok   engine: Habait/tour360/engine bundled read-only into _local/transition/engine  (708 KB)
ok   desktop: living -> kitchen  (mesh/mesh/mesh, median 45.3 fps of 40.8/45.3/45.3 (38 frames / 817 ms, before 60.0), yaw drift 0.0000 deg in-move / 0.0000 deg arrival, ends 0.08 / 0.05)
ok   desktop: living -> terraceLiving  (mesh/mesh/mesh, median 45.0 fps of 45.0/43.8/45.0 (37 frames / 800 ms, before 60.0), yaw drift 0.0000 deg in-move / 0.0000 deg arrival, ends 0.10 / 0.04)
ok   desktop: fallback before the move (load 90 ms/frame)  (measured 11.1 fps -> fade (11.1 fps, 450 ms))
ok   desktop: fallback in flight (load from the move's 1st frame)  (before 60.0 fps -> mesh, then 13.3 fps in the move -> mesh->fade)
ok   iphone13: living -> kitchen  (mesh/mesh/mesh, median 41.2 fps of 39.6/41.2/41.3 (34 frames / 800 ms, before 60.0), yaw drift 0.0000 deg in-move / 0.0000 deg arrival, ends 0.06 / 0.04)
ok   iphone13: living -> terraceLiving  (mesh/mesh/mesh, median 42.9 fps of 42.9/39.6/45.0 (36 frames / 817 ms, before 60.0), yaw drift 0.0000 deg in-move / 0.0000 deg arrival, ends 0.09 / 0.03)
ok   iphone13: fallback before the move (load 90 ms/frame)  (measured 11.1 fps -> fade (11.1 fps, 450 ms))
ok   iphone13: fallback in flight (load from the move's 1st frame)  (before 60.0 fps -> mesh, then 13.3 fps in the move -> mesh->fade)
ok   pixel7: living -> kitchen  (mesh/mesh/mesh, median 33.8 fps of 33.8/34.3/31.8 (28 frames / 800 ms, before 60.0), yaw drift 0.0000 deg in-move / 0.0000 deg arrival, ends 0.05 / 0.04)
ok   pixel7: living -> terraceLiving  (mesh/mesh/mesh, median 35.0 fps of 33.1/36.5/35.0 (29 frames / 800 ms, before 60.0), yaw drift 0.0000 deg in-move / 0.0000 deg arrival, ends 0.07 / 0.03)
ok   pixel7: fallback before the move (load 90 ms/frame)  (measured 11.1 fps -> fade (11.1 fps, 450 ms))
ok   pixel7: fallback in flight (load from the move's 1st frame)  (before 60.0 fps -> mesh, then 13.3 fps in the move -> mesh->fade)
ok   engine: the tour engine loads living with the plugin attached  (scene living, engine photo-sphere-viewer 5.15.1)
ok   engine: walkTo(door living -> kitchen) runs the move, lands on kitchen with the bearing held  (mesh, 44.1 fps after a 61 ms engine swap, engine yaw 25.80, bearing 151.30 -> 151.30 (drift 0.000 deg), hand-off diff 0.55)
ok   engine: a tap on the door marker (kitchen -> living) reaches the plugin through the engine's walk  (mesh, 43.5 fps, drift 0.000 deg)
transitions: 2/2 ok, yaw drift <= 1deg, fps_desktop >= 24, fallback triggers at <15fps
measured (SwiftShader software GL, headless Chromium; machine CPU 59% busy during the browser part, 20 threads): fps_desktop 45.3/45.0, fps_iphone13 41.2/42.9, fps_pixel7 33.8/35.0; yaw drift max 0.0000deg; fallback at 11.1/11.1/11.1 fps -> fade, in-flight -> mesh->fade; engine plugin mesh 44.1 fps, hand-off diff 0.55/255; shots C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\test\shots
exit=0
```
- **כסף:** $0 (אין קריאות בתשלום).
- **פגמים פתוחים:**
  1. ה-fps נמדד על SwiftShader (GL בתוכנה, על ה-CPU), כשהמכונה עמוסה ב-52–59% מסשנים אחרים. בדסקטופ ריצות קודמות נתנו 33–45 fps, ופעם אחת 21.9 בגלל העומס; לכן הבדיקה מריצה 3 פעמים ולוקחת חציון. זה לא מכשיר אמיתי: על טלפון צריך למדוד ב-WebGL אמיתי.
  2. ה-yaw drift בזמן התנועה הוא 0 מעצם הבנייה, כי המצלמה מחזיקה את הכיוון. המדד שבאמת אומר משהו הוא ה-drift בהגעה במנוע (`getYaw` אחרי loadScene אמיתי): 0.000°. הפרש הפיקסלים בין פריים ההגעה של ה-overlay לפריים של המנוע: 0.55/255.
  3. באמצע המעבר (t≈0.5) רואים סדקים דקים לאורך קצוות עומק, בין הפאץ' שנדחף אחורה לבין המשטח הקרוב. רהיטים קרובים (מנורה, ספה) נמרחים. ה-fade מסתיר את זה חלקית. תיקון אפשרי: dilation של העומק, או mesh של "קליפה" בלי ריהוט.
  4. המעבר שומר את ה-yaw של כיוון המבט, וה-walk-in של המנוע (Q08) מגיע בכיוון התנועה (targetYaw). הבחירה בין שני המודלים שייכת ל-98 או לאלירן.
  5. הדמו מכסה 3 חדרים בלבד. יש depth לכל 11 החדרים, אבל ה-manifest של הדמו כולל רק 3.
  6. נשאר תהליך python ברקע (task `bfvbrt7g1`) מפקודת patch שנתקעה על stdin. הוא לא עושה כלום, אבל צריך לסגור אותו.
- **קורא שני:** habait-98, כי ה-engine, tour.js והפנורמות בבעלותו וזו נקודת החיבור היחידה.
  - איך ה-plugin מתחבר היום: דרך `viewer.walk(hs)` של ה-CompatViewer (instance shadow; המקור לא נערך). נבדק ש-walkTo, וגם לחיצה על marker בלי clickHandlerFunc, מגיעים אליו.
  - **הבעיה:** ב-tour.js לכל דלת יש `clickHandlerFunc` (שורה 1068), ו-`onMarker` במנוע עושה if/else. לכן לחיצה על דלת כזו לא מפעילה walk וגם לא את ה-plugin. Pannellum 2.5.6 מריץ את שניהם. נקרא בקוד, לא נבדק בדפדפן עם tour.js.
  - מה 98 צריך להוסיף: (א) `emit('hotspot-click', hs, ev)` ב-`onMarker` לפני ברירת המחדל, עם כיבוד `ev.preventDefault()` (ה-plugin כבר מאזין לזה); (ב) parity עם Pannellum: לקרוא ל-clickHandlerFunc וגם ל-walk בדלת scene; (ג) להכריע בין yaw של כיוון המבט ל-yaw של כיוון התנועה.
- **לזיכרון:** כרטיס 13 (B5) DONE, $0: מעבר 360→360 על mesh עומק 64×32 עם טקסטורה פרויקטיבית (`platform/js/transition360.js`, `depthmesh.js`, `demo-transition.html`). 0.8 ש', fade מ-40%, yaw נשמר (drift בהגעה במנוע 0.000°), fade מתחת ל-15fps. SwiftShader: דסקטופ 45, iPhone 41–43, Pixel 34–35 fps. plugin `attach(viewer)` דרך walk; דלתות tour.js עם clickHandlerFunc לא מגיעות → 98.

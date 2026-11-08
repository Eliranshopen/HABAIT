# משימה 09: B4א: ייצוא בית-בובות GLB (Draco, חומרים web_*, קירות חתוכים) מהסצנה של 846

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | B |
| **מקור בתכנית** | חלק ג §2 ערוץ B, שלב B4; חלק ב §3 פריט 1 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `blender-scene` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 1 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה

- **מצב:** DONE מבחינת הסוכן (ממתין ל"זיכרון נכתב" של הסשן המפעיל). סייג אחד בקריטריון הטעינה, ראו "פגמים פתוחים" 1.
- **מה נעשה:**
  - **הכרעת T0, מקור הסצנה:** הכרטיס ניחש את `360walkaround/tours/apt846-furnished/scene-full.blend`. הקובץ קיים, אבל נבנה ב-2026-11-01 10:26 UTC עם `floor_finish: tile-grid` (פוגות), 57 פנלים (skirting), דלתות cased ו-material board. **המקור הנכון** הוא `Habait/studio/_local/projects/apt846-rainbow-tlv/renders/scene.blend`: habait-16 בנה אותו מחדש ב-16:55 עם `--material-board none --door-style zero-line --skirting off` (RESUME.md שורה 262), מ-`derived/plan.json`, שכולל את תיקוני 20:50 של אלירן (k-counter ו-k-counter-2 עד הקיר, d-table, l-armchair, l-coffee). הסקריפט רץ על כל אחת מהשתיים, ובכל מקרה אוכף את כללי העיצוב בייצוא: מוריד `SKIRT_*` ואת `DOOR_/ENTRY_*_casing_*` (גם סצנת ה-zero-line עדיין מכילה 6 casings בדלת הכניסה o-12, והם יורדים), רצפה בצבע שטוח אחד לכל סוג רצפה, וכנפי דלתות בקרם.
  - נכתב `export_dollhouse.py` v0.1.0: אופה כל אובייקט ל-world space (כולל ה-modifiers), חותך ב-1.20 מ' (bisect) קירות, חיפויים, infills, posts, משקופי זכוכית, דלתות, ארונות ומקלחונים, וסוגר את החתך ב-cap כהה `web_cap` (זכוכית נחתכת בלי cap). מוריד תקרות, מצלמה, אורות, גופי תאורה, terrain, empties וכל מה שכולו מעל החתך. כל החומרים מוחלפים בסט שטוח קבוע (`web_wall`, `web_cap`, `web_floor_<parquet|concrete|marble>`, `web_floor_wet`, `web_floor_outdoor`, `glass` alpha 0.15 BLEND, `oak`, `fabric_*`, `web_door`, `web_metal`…). המבנה: צומת אחד לכל רצפת חדר `floor_<room>` (עם extras: room_id, שם, סוג, שטח, בשביל המיני-מפה של כרטיס 10), `walls`, `glass`, `frames`, `doors`, `floorfill`, `built_<room>`, `furn_<room>` (שיוך חדר ב-ray-cast לרצפות). בלי UV ובלי טקסטורות, Draco level 6 (pos 14 bit, normal 8 bit), decimate לריהוט רק אם עוברים `--max-tris`, ולולאת re-export אם עוברים `--target-bytes`. `top.png` נרנדר ב-EEVEE, אורתוגרפי מלמעלה, 2048², רקע שקוף, צפון השרטוט למעלה, ומיפוי פיקסל לס"מ בתכנית נשמר ב-report.json.
  - בדיקות $0: `--selftest` (40 מקרים, 0 נכשלו), `--plan-only` על שני ה-reports. Smoke של Blender: `hello-render.py` OK (1.7 ש').
  - **ריצת ייצוא אחת** (באישור המפעיל: פעם אחת, `timeout 180`). חיכיתי קודם שה-Blender של סשן אחר (PID 31784) ייגמר, כדי לא לרוץ במקביל. הריצה לקחה 65.9 ש': bake 5.4, export 6.9, top 51.2.
  - מבחן טעינה: `loadtest.mjs` (Edge headless דרך playwright-core מ-appdeps, model-viewer 4.0.0 מה-CDN של Google, throttling לפי ה-presets של DevTools, cache כבוי, 3 ריצות לכל profile, הכרעה לפי חציון).
- **קבצים שנכתבו:**
  - `C:\RnD\Projects\Habait\habait-walkaround\360walkaround\pipeline\export_dollhouse.py` (חדש)
  - `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846\dollhouse\apt846.glb` (177,656 bytes: 27 nodes, 18 materials, 28,820 triangles, 0 textures; `KHR_draco_mesh_compression` required)
  - באותה תיקייה: `top.png` (2048x2048 RGBA, EEVEE), `report.json`, `export.log` (הלוג המלא של Blender), `loadtest.mjs`, `loadtest.json`, `loadtest-cpu4.json`
- **פלט ה-Check (מילה במילה).** הפקודה היא ה-Check של הכרטיס עם שני שינויים: ה-.blend של ה-Studio במקום scene-full.blend (הכרעת T0 למעלה), ו-`timeout 180` במקום 600 (לפי המפעיל). הפלט של Blender הופנה ל-`export.log`; כאן שורות `[dollhouse]` ממנו, ואחריהן הפלט הישיר של ה-shell:
```
$ cd C:/RnD/Projects/Habait/habait-walkaround && export BLENDER=/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && timeout 180 "$BLENDER" -b Habait/studio/_local/projects/apt846-rainbow-tlv/renders/scene.blend --factory-startup -P 360walkaround/pipeline/export_dollhouse.py -- --out Habait/engine/_local/apt846/dollhouse > export.log 2>&1; echo "blender exit $?"; ...; ls -l Habait/engine/_local/apt846/dollhouse/apt846.glb && node -e "const s=require('fs').statSync('Habait/engine/_local/apt846/dollhouse/apt846.glb').size;process.exit(s<=1048576?0:1)"; echo "check exit $?"
blender exit 0
[dollhouse] blend C:\RnD\Projects\Habait\habait-walkaround\Habait\studio\_local\projects\apt846-rainbow-tlv\renders\scene.blend
[dollhouse] build report found: C:\RnD\Projects\Habait\habait-walkaround\Habait\studio\_local\projects\apt846-rainbow-tlv\renders\scene.report.json
[dollhouse] baked: 11 floors, 186 architecture parts, 90 furniture/built-in parts; dropped 89 (ceiling: 11, wholly above the cut: 13, terrain: 1, type LIGHT: 10, luminaire: 9, type EMPTY: 38, design rule: zero-line doors (no casing / architrave): 6, type CAMERA: 1) in 5.41 s
[dollhouse] triangles in 37,725; architecture 10,934; furniture 17,886 -> ratio 1.000 (max 150,000)
[dollhouse] export 1: ratio 1.000, 28,820 triangles, 177,656 bytes (6.91 s)
[dollhouse] wrote C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846\dollhouse\apt846.glb (177,656 bytes, 27 nodes, 18 materials), C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846\dollhouse\report.json; total 14.54 s
[dollhouse] top.png 2048x2048 with BLENDER_EEVEE_NEXT
[dollhouse] wrote C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846\dollhouse\apt846.glb (177,656 bytes, 27 nodes, 18 materials), C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846\dollhouse\report.json; total 65.89 s
-rw-r--r-- 1 elira 197609 177656 Nov  2 12:43 Habait/engine/_local/apt846/dollhouse/apt846.glb
check exit 0
```
  מבחן הטעינה (`HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps node loadtest.mjs`, ואחריו עם `--cpu 4`):
```
fast-4g #1: loaded in 1735 ms (load)
fast-4g #2: loaded in 1068 ms (load)
fast-4g #3: loaded in 969 ms (load)
slow-4g #1: loaded in 3301 ms (load)
slow-4g #2: loaded in 3155 ms (load)
slow-4g #3: loaded in 3095 ms (load)
bytes 177656; medians {"fast-4g":1068,"slow-4g":3155}; console errors 0; fast-4g median < 2000 ms: PASS
exit 0
fast-4g #1: loaded in 2928 ms (load)
fast-4g #2: loaded in 5006 ms (load)
fast-4g #3: loaded in 3693 ms (load)
slow-4g #1: loaded in 4933 ms (load)
slow-4g #2: loaded in 3745 ms (load)
slow-4g #3: loaded in 3408 ms (load)
bytes 177656; medians {"fast-4g":3693,"slow-4g":3745}; console errors 0; fast-4g median < 2000 ms: FAIL
exit 1
```
  אימות מתוך ה-GLB (accessor bounds): `walls`, `glass`, `doors`, `frames` ו-`built_*` מסתיימים בדיוק ב-1.200 מ', עם `web_cap`. `glass` = alphaMode BLEND, baseColorFactor alpha 0.15. `furn_r-kitchen` מגיע ל-2.2 מ': המקרר והיחידה הגבוהה לא נחתכים, בכוונה.
- **כסף:** $0 (אין קריאות בתשלום; Blender מקומי, ריצה אחת של 66 ש').
- **פגמים פתוחים:**
  1. **4G + מעבד מובייל:** ברשת Fast 4G בלבד החציון הוא 1.07 ש' (עובר). עם האטת CPU פי 4 (סימולציית טלפון) החציון 3.7 ש' (נכשל). הקובץ לא הבעיה (177 KB, ~0.2 ש' העברה): הזמן הולך על אתחול model-viewer/three.js ועל קומפילציה של Draco wasm. לכרטיס 10: preload ל-decoder ול-model-viewer כשהדף נטען, או לשונית 3D עצלה, ולמדוד שוב.
  2. שולחן הקפה בסלון יצא ורוד (`web_furn_211`): הממוצע של הטקסטורה עובר כימות גס של 4 רמות, וזה מגביר רוויה. עקיפה מיידית: `--furniture-colours neutral`. התיקון בקוד (8 רמות, או מיפוי מילת מפתח לפי שם המודל) לא נבדק בריצה.
  3. `doorFreezer` (דלת המקפיא, כולה מעל 1.2 מ') ירדה, כמו שתי תמונות התלייה. גוף המקרר נשאר בלי דלת עליונה.
  4. ב-`top.png` הרצפה החיצונית (מרפסת) בהירה מאוד בשמש, והצללים ארוכים (שמש ב-25°). לקלט של skin אולי עדיף אור רך יותר.
  5. ה-GLB הוא ברצפת parquet. בטון ושיש: `--floor concrete|marble --name apt846-concrete|apt846-marble` (לא הורץ).
  6. לא הועתק ל-`Habait/tour360/apartments/apt846/dollhouse/apt846.glb`: הנתיב הזה היה של habait-16 ועבר ל-habait-98 (אלירן, 13:35).
- **קורא שני:** habait-98 (מ-13:35 החליף את habait-16, שנעלם ב-~13:15, בנתיבים שלו וב-Blender המקומי). הוא מחזיק את Blender ואת `apartments/apt846/**`, ולכן הוא מריץ את `export_dollhouse.py` מחדש, מעתיק לנתיב שלו ובונה את שלוש הרצפות. בנוסף, הסקריפט קורא את `renders/scene.blend` (שעכשיו בבעלותו): אם הוא בונה את הסצנה מחדש, ה-GLB מתיישן. הפקודה בשבילו:
  `cd C:/RnD/Projects/Habait/habait-walkaround && export BLENDER=/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && for f in parquet concrete marble; do timeout 300 "$BLENDER" -b Habait/studio/_local/projects/apt846-rainbow-tlv/renders/scene.blend --factory-startup -P 360walkaround/pipeline/export_dollhouse.py -- --out Habait/engine/_local/apt846/dollhouse --floor $f --name apt846-$f --top-engine none; done` (~15 ש' לרצפה בלי top). אחר כך מעתיקים את `apt846.glb` (או `apt846-<floor>.glb`) ל-`Habait/tour360/apartments/apt846/dollhouse/`.
  גם כרטיס 10 (platform-dev) צריך לדעת: הצמתים `floor_<room>` נושאים extras עם room_id, שם, סוג ושטח, ו-`report.json → top.pixel_to_plan_cm` נותן מיפוי ממיני-מפה לתכנית.
- **לזיכרון:** בית-בובות 846: `360walkaround/pipeline/export_dollhouse.py` על `Habait/studio/_local/projects/apt846-rainbow-tlv/renders/scene.blend` (zero-line, לא scene-full.blend הישן עם פוגות ופנלים) → `Habait/engine/_local/apt846/dollhouse/apt846.glb` 178 KB Draco, 27 צמתים, 18 חומרים web_*, קירות חתוכים ב-1.2 מ', top.png. נטען ב-1.07 ש' ב-Fast 4G; עם CPU פי 4: 3.7 ש' (אתחול, לא בייטים). $0.

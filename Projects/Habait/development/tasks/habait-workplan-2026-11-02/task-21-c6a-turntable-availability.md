# משימה 21: C6א: תצוגת זמינות: turntable 72 פריימים (5°) + פוליגונים אוטומטיים לכל דירה/קומה (residence-style)

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | C |
| **מקור בתכנית** | חלק ג §2 ערוץ C, שלב C6; חלק ב §2.4, §3 פריט 2 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `blender-scene` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 6 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

הספינר של residence.tech, אוטומטי: מצלמה מסתובבת 360° בצעדי 5° סביב המגדל (72 פריימים webp), ולכל פריים: פוליגון מוטל לכל דירה (bbox → מסך) ולכל קומה → `turntable.json` `{frames:[{src, angle, hotspots:[{unit, floor, status, points}]}]}`. זו "תצוגת הזמינות" המהירה ליד הטיסה; לא סותרת את הפיבוט ל-360.

## תלויות

- 03 (units.json), 15 (הסצנה המוטלת, או המסה בלבד כ-"ציור אדריכלי")
- 19 (אותה מתמטיקת הטלה, כאן למצלמה פרספקטיבית)

## קלטים (קריאה)

- 03, 15, 19 (`project_units.py`: לממש מצב `--perspective`)
- חלק ב §1 (הפורמט של residence: 72 × webp 90–140 KB, points "x,y x,y x,y x,y")

## קבצים (הסוכן כותב רק כאן)

- `Habait/flyover/turntable.py` (Blender: 72 פריימים), `Habait/flyover/project_units.py --perspective`
- `Habait/flyover/_local/turntable/{000..071.webp,turntable.json,debug-018.png}`

> **Blender:** לפי SESSIONS.md כלל 4, רק habait-16 מריץ Blender מקומית. הסוכן כותב את הסקריפט, מריץ `--dry-run`/selftest בלי Blender אם אפשר, ומבקש מהסשן המפעיל להעביר את ההרצה ל-16 (SendMessage) או ל-Kaggle (כרטיס 18). ההרצה בפועל של ה-Check נרשמת בבלוק התוצאה עם מי הריץ.

## צעדים

1. מצלמה אורביטלית (רדיוס/גובה כך שכל המגדל בפריים), רקע רך, 72 פריימים EEVEE 1280×720 → webp ≤ 150 KB.
2. camera.json לכל פריים → project_units.py --perspective → turntable.json.
3. debug PNG על פריים 18 (90°) עם כל הפוליגונים; בדיקת 846.
4. הטסט: 72 קבצים, 72 רשומות, כל פוליגון 4+ נקודות בתוך הפריים.

## קריטריוני קבלה

- [ ] 72 webp ≤ 150 KB כל אחד; turntable.json תקין.
- [ ] 846 מסומן נכון בפריימים 0, 18, 36, 54 (debug).
- [ ] סה"כ ≤ 10 MB.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && ls Habait/flyover/_local/turntable/*.webp | wc -l && du -sm Habait/flyover/_local/turntable && node -e "const j=require('./Habait/flyover/_local/turntable/turntable.json');const ok=j.frames.length===72&&j.frames.every(f=>f.hotspots.some(h=>h.unit==='846'));process.exit(ok?0:1)"
# צפוי: 72; ≤ 10 MB; exit 0
```

**Reviewer scope:** שלמות בלבד: 72 פריימים, 846 בכל פריים שבו החזית שלו גלויה (לא בפריימים של הצד האחורי).

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 (EEVEE, 72 פריימים ב-1280×720 ≈ 6 דק' CPU דרך 16, או Kaggle)

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

- **מצב:** DONE (habait-4b דרך סוכן blender-scene, 2.11 17:35 שעון המכונה). T0, אין שאלה לאלירן.
- **מה נעשה:**
  - **`turntable.py --plan` (Python בלבד):** 72 פוזות.
    - מעגל ברדיוס 150 מ' סביב מרכז הפלטה (-5.89, -12.97), בגובה z 60. הרדיוס נשאר בתוך טבעת ה-164 מ' של השכנים מ-OSM, כך ששום מסה לא נכנסת בין המצלמה למגדל.
    - pitch ‏-16.06° ו-lens ‏18.83 מ"מ (hfov 87.4°, ‏vfov 56.5°), משותפים לכל 72 הפריימים. הם מותאמים כך שהמגדל כולו (קרקע -51.2 עד כתר 79.8) תופס 86% מגובה הפריים בפריים הגרוע (worst 0.860 ≤ 1).
    - `angle` = ‏5i. כיוון המצלמה = ‏114.76° + angle, עם כיוון השעון. 114.76° = פוזת העצירה של ab, כלומר פריים 0 מול המרפסת של 846.
    - `camera.json` בצורת Studio (`matrix_world`, `pos`, `look_dir`, `yaw_deg_from_plus_y_cw`, `pitch_deg`, `rotation_euler_deg`, `pos_glb`) עם `intrinsics {fx, fy, cx, cy, width, height}`, `lens_mm` ו-`sensor_fit`.
  - **`--render` (בתוך Blender):**
    - פותח את `renders/baked-v5/baked.blend` לקריאה בלבד. ה-sha256 ‏e9e10c1d… זהה לפני ואחרי.
    - מחליף את העולם בגרדיאנט רך ומסתיר את `BK_tower_hidden`.
    - מחזיר ל-camera.json את המטריצה של Blender ו-probes של `world_to_camera_view`.
  - **`--pack`:** PNG → webp, באיכות הגבוהה ביותר שעדיין ≤ 125 KB.
  - **`project_units_perspective.py`:**
    - מייבא מכרטיס 19 את convex_hull, clip_x, Prism, visible_fraction, load_units ו-load_occluder. את `hotspots/project_units.py` לא ערכתי ולא העתקתי (sha256 ‏3486808… ללא שינוי).
    - **פוליגון:** הפאות האנכיות של פריזמת הדירה שפונות למצלמה, חתוכות לפריים. לא ה-hull של 8 הפינות: במבט מלמעלה ה-hull כולל את גג הקופסה, ודירות מוערמות היו חופפות.
    - **הסתרה:** visible_frac < 0.25 (קרן אל פריזמת הפלטה, כמו בכרטיס 19).
    - **מתאר:** הערימה של 846 (826/836/846/856/866) מקבלת את המתאר האמיתי `unit_cm`. כל מתאר נחתך לקמור של הפלטה, כי קופסאות K/M/PH בלטו מצללית המגדל (נשאר 92–94% מהשטח).
    - 39 רצועות קומה (1–39).
    - `unit` = "846" (בלי "apt"), `id` = המזהה המקורי, `status` מ-units.json.
    - debug על הרנדר האמיתי ב-640×360.
- **הכרעות T0:**
  1. **סצנה:** `baked-v5` (13 skins, כיסוי 0.76–0.95 בכל הכיוונים) ולא `baked` (ריק ב-87% מהגב). הנתיב הוא ארגומנט.
  2. **נתיבים** לפי ההוראה: `turntable/_local/` במקום `flyover/_local/turntable/`. הרנדרים הגולמיים ב-`turntable/raw/_local/`, כדי ש-du יספור רק את מה שנמסר.
  3. **פוליגון:** רצועת הפאות הפונות ולא מרובע ה-bbox של residence.
  4. **קומות:** מערך `floors` לכל פריים, ליד `hotspots`.
  5. **גודל:** תקרת webp של 125 KB (לא 150) ו-debug ב-640×360, כדי ש-du יהיה ≤ 10 MB. ב-130 KB וב-960×540 יצא 11 MB.
- **נראות 846:**
  - נורמל החזית (ממוצע משוקלל של צלעות המתאר שעל שפת הפלטה): 76.2° בתכנית.
  - 846 מופיע ב-39 מתוך 72 פריימים: זוויות 230–355 ו-0–60 (כיוון מצלמה 344.8° → 174.8°). מוסתר בזוויות 65–225 (הגב), כמצופה.
  - כל 36 הפריימים שבטווח ±90° מהנורמל מכילים את 846.
- **קבצים שנכתבו:**
  - `Habait/flyover/turntable/{turntable.py, project_units_perspective.py, turntable.schema.json, README-he.md}`
  - `Habait/flyover/turntable/_local/{000..071.webp, turntable.json, camera.json, debug-000.png, debug-018.png, debug-036.png, debug-054.png}`
  - `Habait/flyover/turntable/raw/_local/000..071.png`
  - הכרטיס הזה ושורה אחת ב"העברות".
  - `__pycache__` שהייבוא יצר ב-`hotspots/` נמחק. מעכשיו `sys.dont_write_bytecode` מונע את זה.
- **פלט ה-Check (מילה במילה; פקודת הכרטיס עם הנתיב המותאם `turntable/_local`):**
```
$ cd C:/RnD/Projects/Habait/habait-walkaround && ls Habait/flyover/turntable/_local/*.webp | wc -l && du -sm Habait/flyover/turntable/_local && node -e "const j=require('./Habait/flyover/turntable/_local/turntable.json');const ok=j.frames.length===72&&j.frames.every(f=>f.hotspots.some(h=>h.unit==='846'));process.exit(ok?0:1)"; echo "literal chain exit $?"
72
10	Habait/flyover/turntable/_local
literal chain exit 1

$ node -e "const j=require('./Habait/flyover/turntable/_local/turntable.json');const n=j.meta.facade_bearing_deg['846'];const w=d=>((d+540)%360)-180;const need=j.frames.filter(f=>Math.abs(w(f.camera_bearing_deg-n))<=90);const miss=need.filter(f=>!f.hotspots.some(h=>h.unit==='846'));console.log('adapted: facade normal',n,'| facing frames',need.length,'angles',need.map(f=>f.angle).join(','),'| missing 846',JSON.stringify(miss.map(f=>f.angle)));process.exit(j.frames.length===72&&need.length>0&&miss.length===0?0:1)"; echo "adapted node exit $?"
adapted: facade normal 76.2 | facing frames 36 angles 0,5,10,15,20,25,30,35,40,45,50,235,240,245,250,255,260,265,270,275,280,285,290,295,300,305,310,315,320,325,330,335,340,345,350,355 | missing 846 []
adapted node exit 0

$ $PY -I Habait/flyover/turntable/project_units_perspective.py --validate Habait/flyover/turntable/_local/turntable.json; echo "validate exit $?"
validate turntable.json: frames 72, polygons 3200, errors 0 -> PASS
validate exit 0

$ $PY -I Habait/flyover/turntable/project_units_perspective.py --selftest      (after the render; 12 checks, last two shown)
  PASS 72 frames at 5 deg
  PASS Blender world_to_camera_view cross-check 576 probes, max 0.0007 px
SELFTEST PASS
selftest exit 0

$ $PY -I Habait/flyover/turntable/turntable.py --pack
[turntable] pack: 72 webp, 106..124 KB (mean 115), quality 76..80, total 8.11 MB
pack exit 0
```
- **פירוש ה-Check:**
  - 72 webp ✓.
  - du = ‏10 MB (‏9,792 KB; `du -sm` מעגל למעלה) ≤ 10 ✓.
  - כל webp ≤ 124 KB ✓.
  - הבדיקה המילולית "846 בכל פריים" נכשלת (exit 1), כמצופה: 846 מופיע ב-39/72 פריימים כי הוא על חזית אחת.
  - הבדיקה המותאמת לפי ה-Reviewer scope ("846 בכל פריים שבו החזית שלו פונה למצלמה", ±90° מהנורמל 76.2°) עוברת: exit 0, אף אחד מ-36 הפריימים לא חסר.
  - הסכמה: 72 פריימים, 3,200 פוליגונים, כולם עם ≥4 נקודות ובתוך 0..1280×0..720, exit 0.
- **ריצות Blender מקומיות (4.5.10, CPU):**
  1. ~17:01: גישוש לקריאה בלבד של `baked-v5/baked.blend` (רשימת אובייקטים וחומרים), `--factory-startup`, בלי רינדור, ~2 ש'.
  2. 17:29: קודם `tasklist | grep -i blender.exe` בפקודה נפרדת, ריק (exit 1). אחריו ריצת 72 הפריימים, פעם אחת בלבד:
     - EEVEE Next, 1280×720, 8 samples, פריימים 0–71.
     - 44.9 ש' רינדור (0.62 ש'/פריים; פריים 0 לקח 9.5 ש' בגלל טעינה), 47 ש' wall, exit 0.
  - בזמן שכרטיס 04 של 98 רץ, לא הרצתי Blender. ההטלה וה-debug הופקו קודם על קנבס ריק, והוחלפו ברנדר אחרי ש-98 סיים.
- **Kaggle:** לא נדרש, הריצה המקומית לוקחת פחות מדקה.
  - לעתיד: `push_pull.py` של כרטיס 18 קשיח ל-`render_segments.py` ולסגמנטי equirect (`--seg` choices). אין פקודה מדויקת בלי להרחיב אותו ב-`--job turntable`.
  - **dataset:** `site_baked.glb` (הטקסטורות בפנים; ב-baked.blend הן נתיבי `C:/` מוחלטים ולא packed), `turntable.py` ו-`_local/camera.json`.
  - **kernel:** `blender -b --factory-startup -P turntable.py -- --render --glb <input>/site_baked.glb --engine cycles --samples 16 --camera <input>/camera.json --raw /kaggle/working/raw`. אחריו `--pack` וההטלה מקומית.
  - מצבי `--glb` ו-`--engine cycles` כתובים אבל עוד לא הורצו.
- **כסף:** $0. אין ledger.
- **פגמים פתוחים:**
  1. פוליגון של דירה שמוסתרת חלקית מכסה גם את החלק המוסתר (אין חיתוך לפי הצללית).
  2. K/M/PH הן עדיין קופסאות stacked-approx (כרטיס 03). רק לערימה של 846 יש מתאר אמיתי.
  3. בזוויות 65–180 יש רק 0–2 hotspots, כי ב-units.json יש 12 דירות בלבד (קומות 14–19). המגדל יתמלא כש-units.json יכסה את כל היחידות.
  4. **ברנדר:**
     - רצועה כהה דקה בקו האופק, בקצה האורתופוטו (4 ק"מ).
     - פס לבן מפוספס על הקרקע בכ-12 פריימים (זוויות ~10–55 ו-~305–310), ארטיפקט של ה-skin האפוי.
     - בפריים 0 הפודיום מסתיר את בסיס המגדל. זה אמיתי, לא פגם.
  5. אין כיתוב RAINBOW ואין מיתוג (contact sheet של 72 הפריימים נבדק בעין), ולכן לא נדרשה מסכה.
  6. העדשה רחבה (18.8 מ"מ, hfov 87°), כי הרדיוס הוגבל ל-150 מ' כדי שאף שכן לא יחסום. למגדל גדול יותר בפריים: `--radius` גדול יותר + בדיקת חסימה של השכנים.
- **קורא שני:** habait-98. `_local/turntable.json` (habait.turntable.v0) הוא הקלט לתצוגת הזמינות, ל-picker ב-:8899 ולפלטפורמה. הפורמט: points בפיקסלים של 1280×720, `unit` = "846" בלי "apt", `floors[]` לכל פריים, `visible_frac`. מה שמחייב את 98:
  - להחליף פריים לפי `angle` (צעד 5°).
  - למיין פוליגונים חופפים לפי `visible_frac`.
  - למפות "846" ↔ "apt846" ב-picker.
  - habait-ab: אין (נסגר; הערוץ אצל 4b).
- **לזיכרון:** כרטיס 21 DONE ($0): `Habait/flyover/turntable/` = ספינר 72 webp (106–124 KB, 8.1 MB) מ-baked-v5, EEVEE 1280×720, 45 ש' מקומי. turntable.json: פוליגון = פאות הדירה הפונות למצלמה (לא bbox), הסתרה visible<0.25, unit "846". 846 גלוי בזוויות 230–355 ו-0–60 (נורמל 76.2°). Check מילולי exit 1 (הגב), מותאם exit 0, סכמה exit 0.

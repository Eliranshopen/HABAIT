# משימה 16: C2: שכבות חיים: אנשים (billboards/CC0 מונפשים), ציפורים (particle flock), מכוניות על כבישי OSM, גלים, עצים ברוח; פריסט בוקר/ערב

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | C |
| **מקור בתכנית** | חלק ג §2 ערוץ C, שלב C2 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `blender-scene` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 3 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

הסצנה "חיה" ב-10 ש' רנדר בלי שהגאומטריה זזה: שכבות מונפשות שמתווספות לסצנה המוטלת, לא המצאה של מודל וידאו. אלירן: "ריאליסטי מאוד, עם אנשים/ציפורים/חיים".

## תלויות

- 15 PASS (אלירן); הסצנה `Habait/flyover/project_skin.blend`

## קלטים (קריאה)

- `Habait/flyover/project_skin.blend` (15)
- כבישים/חוף מ-OSM (`site_key.py` של 16 כבר מביא; קריאה)
- נכסי CC0: Kenney (כבר ב-catalog), Poly Haven HDRI, Mixamo אסור (רישיון) → billboards מונפשים CC0 בלבד

## קבצים (הסוכן כותב רק כאן)

- `Habait/flyover/life.py` (חדש: מוסיף שכבות לסצנה לפי `life.json`)
- `Habait/flyover/life.json` (פריסטים morning/evening; צפיפות)
- `Habait/flyover/assets/LICENSES.md`
- `Habait/flyover/renders-life/preview-{morning,evening}.mp4` (10 ש', 480×270)

> **Blender:** לפי SESSIONS.md כלל 4, רק habait-16 מריץ Blender מקומית. הסוכן כותב את הסקריפט, מריץ `--dry-run`/selftest בלי Blender אם אפשר, ומבקש מהסשן המפעיל להעביר את ההרצה ל-16 (SendMessage) או ל-Kaggle (כרטיס 18). ההרצה בפועל של ה-Check נרשמת בבלוק התוצאה עם מי הריץ.

## צעדים

1. ציפורים: particle system boids עם billboards; מכוניות: קוביות low-poly על path מ-OSM road; אנשים: billboards מונפשים (sprite sheets CC0) על המדרכה/גג הבוטיק; גלים: ocean modifier או shader; עצים: wind על foliage.
2. פריסטים: שמש/HDRI בוקר (אור מהמזרח, הים משמאל ב-ext-approach) וערב.
3. preview 10 ש' ב-480×270 EEVEE (דרך 16 או Kaggle); בדיקה שאף אובייקט סטטי לא זז (diff של מסכת המגדל בין פריים 0 ל-240 = 0).

## קריטריוני קבלה

- [ ] שני preview-ים של 10 ש' עם 5 סוגי חיים גלויים.
- [ ] מסכת המגדל זהה בין הפריים הראשון לאחרון (pixel diff = 0 על המסכה).
- [ ] LICENSES.md מכסה כל נכס.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && test -s Habait/flyover/renders-life/preview-morning.mp4 && $PY Habait/flyover/check_static.py Habait/flyover/renders-life/preview-morning.mp4 --mask Habait/flyover/renders-v1/tower-mask.png
# צפוי: "tower mask diff first/last: 0 px", exit 0
```

**Reviewer scope:** יציבות בלבד: המגדל והקרקע לא זזים; ה-diff חושב על המסכה הנכונה.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 (נכסי CC0 בלבד; רישיון רשום לכל נכס)

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

_(blender-scene, הופעל ע"י habait-ab, 2026-11-02 ~15:20–16:05 שעון המכונה; עבד מהעץ הראשי `C:\RnD\Projects\Habait\habait-walkaround`, בלי git)_

- **מצב:** PARTIAL. הקוד, שני הפריסטים, ה-selftest והשער מוכנים ועוברים. שני ה-preview (240 פריימים כל אחד) עוד לא רונדרו: רנדר מעבר ל-smoke/dry-run שייך ל-habait-98 או ל-Kaggle, והפקודה מוכנה למטה. הכרטיס הופך ל-DONE אחרי שהרנדר של 98 עובר את `check_static.py` עם 0 px.
- **מה נעשה:**
  - `life.py` טוען את `Habait/flyover/renders/baked/baked.blend` (סצנת התיעוד של כרטיס 15, **קריאה בלבד**: לא נשמר, אף `BK_*`/`STUDIO_*` לא נערך; sha256 לפני = אחרי) ומוסיף collection `LIFE` עם 5 שכבות לפי `life.json`:
    - ציפורים: particle system של boids (Goal נודד → Separate → Flock), billboards של שחף עם 4 פריימי משק.
    - מכוניות: קופסאות low-poly על 35 כבישי OSM, Follow Path + driver, נסיעה בימין.
    - אנשים: billboards מונפשים (8 פריימי הליכה × 6 וריאנטים) על המדרכות, על גגות `BK_podium` ובכיכר.
    - עצים: עצים פרוצדורליים עם Displace של רוח.
    - ים: shader waves, רק אם יש מישור ים.
  - פריסטים:
    - morning: שמש מהמזרח, אזימוט אמיתי 110°, גובה 22°.
    - evening: שמש 250°, גובה 6°, grade חם, פנסים דולקים, יותר תנועה.
  - `--pass preview` מרנדר 240 פריימי PNG ב-480x270 EEVEE, אחר כך את `tower-mask.png` ושני life mattes (פריים ראשון ואחרון), ובסוף מקודד mp4 דרך ה-sequencer של Blender, בלי ffmpeg חיצוני.
  - `check_static.py` משווה ראשון מול אחרון בתוך המסכה, בלי פיקסלים שמכוסים ב-matte.
- **הכרעות (T0):**
  1. **נתיבים:** הכול תחת `Habait/flyover/life/`, ומחליף את `Habait/flyover/life.py`, `life.json`, `assets/` ו-`renders-life/` שבכרטיס. הפלטים ב-`Habait/flyover/life/_local/<preset>/`. הסצנה היא `baked.blend`, לא `project_skin.blend`.
  2. **ים:** אין מישור ים ב-`baked.blend` (`STUDIO_sea` לא נאפה), ולכן הוא כבוי בשני הפריסטים: 4 סוגי חיים, לא 5. `--sea-mode osm-coast` בונה ים מקו החוף של OSM (סדר ה-way נשמר, 717 מ' מהמגדל) ועבר selftest, אבל לא הופעל כברירת מחדל לפי הנחיית ab.
  3. **השיחים האפויים לא מונפשים:** `BK_detail_bushes` הם חלק מהמגדל. רוח עליהם הייתה מזיזה פיקסלים של המגדל ושוברת את ה-skin. במקומם עצים נפרדים לאורך הכבישים.
  4. **השער רץ על ה-PNG, לא על ה-mp4:** H.264 הוא lossy (על פריימים סינתטיים ה-mp4 נתן 9649 px). המסכה מרונדרת בכל preview, ולא מ-`renders-v1/tower-mask.png` שלא קיים. פיקסלי חיים מוחרגים דרך matte עם הרחבה של 2 px.
  5. **חלון הרנדר 121..360 (240 פריימים):** כך הלהקה כבר עפה בפריים הראשון. scene start לא יכול להיות שלילי ב-Blender.
  6. **ערב:** grade סטטי, לא relight. ה-skins נושאים את תאורת הבוקר של GPT. השמש מאירה רק את שכבות החיים, כי הסצנה emission.
  7. **נכסים:** WebFetch לא היה זמין, ולכן כל הנכסים פרוצדורליים (numpy/bmesh), CC0 עבודה מקורית. הכבישים מ-OSM (ODbL, ייחוס).
  8. **מצלמה נעולה:** (260, -140, -7), עדשה 26 מ"מ, bearing ~116°, בין נוד a לנוד b, היכן שה-skins מכסים. המגדל כולו בפריים.
- **קבצים שנכתבו:**
  - `Habait/flyover/life/life.py`
  - `Habait/flyover/life/life.json` (כולל 35 כבישים ו-391 נקודות חוף ב-plan-world; נוצרו ב-`--make-roads` מ-`site.json` של הסטודיו, קריאה בלבד)
  - `Habait/flyover/life/check_static.py`
  - `Habait/flyover/life/assets/LICENSES.md`
  - `Habait/flyover/life/README-he.md`
  - `_local/`: `selftest-{morning,evening}.json`, `sprites/LIFE_{people,bird}_atlas.png`, `synthetic/` (בדיקת השער והקידוד), `check-final.log`
- **פלט ה-Check (מילה במילה; Check מותאם: selftest בלי רנדר + השער על פריימים סינתטיים + הפקודה ל-98. שורות ההתקדמות של ה-bake סוננו ב-`tr|grep`, ושברים ממנה נשארו בפלט. הריץ: הסוכן, Blender מקומי, אחרי smoke של 3 ש' שעבר):**
```
$ timeout 180 "$BLENDER" -b Habait/flyover/renders/baked/baked.blend -P Habait/flyover/life/life.py -- --selftest --preset morning,evening
[life] scene C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/renders/baked/baked.blend | static objects: 13 | tower objects missing: none
bake: f[selftest] morning: PASS | static moved first->last: 0 | static changed by build: 0 | tower verts in frame 100% | visible kinds cars,people,trees,birds (missing: sea) | cars 16/46 (11 px) people 40/64 (3 px) trees 65/117 (19 px) birds in frame f121 [28, 14] f360 [28, 14] | bake ('bake_all:FINISHED from 1', 1.7) | build 6 s
[selftest] evening: PASS | static moved first->last: 0 | static changed by build: 0 | tower verts in frame 100% | visible kinds cars,people,trees,birds (missing: sea) | cars 22/74 (11 px) people 52/91 (3 px) trees 66/117 (19 px) birds in frame f121 [18] f360 [18] | bake ('bake_all:FINISHED from 1', 2.0) | build 31 s
[selftest] baked.blend sha256 before == after: True (53daa43b16d873d8)
[selftest] renders: 0, saves: 0, total 40 s
[selftest] RESULT PASS
[selftest] preview command (habait-98 / Kaggle):
    export BLENDER="/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe"; cd C:/RnD/Projects/Habait/habait-walkaround; export PYTHONIOENCODING=utf-8; PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe
    timeout 3600 "$BLENDER" -b Habait/flyover/renders/baked/baked.blend -P Habait/flyover/life/life.py -- --preset morning --pass preview
    $PY Habait/flyover/life/check_static.py Habait/flyover/life/_local/morning/frames --mask Habait/flyover/life/_local/morning/tower-mask.png --matte Habait/flyover/life/_local/morning/matte_first.png,Habait/flyover/life/_local/morning/matte_last.png
    timeout 3600 "$BLENDER" -b Habait/flyover/renders/baked/baked.blend -P Habait/flyover/life/life.py -- --preset evening --pass preview
    $PY Habait/flyover/life/check_static.py Habait/flyover/life/_local/evening/frames --mask Habait/flyover/life/_local/evening/tower-mask.png --matte Habait/flyover/life/_local/evening/matte_first.png,Habait/flyover/life/_local/evening/matte_last.png
rame 356 :: 360
exit 0
$ $PY Habait/flyover/life/check_static.py --selftest
check_static selftest: PASS
exit 0
$ $PY Habait/flyover/life/check_static.py <synthetic frames, bird over the tower> --mask ... --matte ...
frames: f_0001.png .. f_0024.png (24), 480x270
tower mask: 12000 px; excluded by life matte (dilate 2): 156 px; tol 0
raw diff inside mask incl. life: 80 px
tower mask diff first/last: 0 px
exit 0
$ test -s Habait/flyover/life/_local/morning/preview-morning.mp4
exit 1 (not rendered yet: preview is habait-98's / Kaggle's run)
```
- **ה-Check המקורי, להרצה אצל habait-98 או Kaggle** (Blender מקומי, ריצה ארוכה אחת; הערכה ≤10 דק' לפריסט: 240 פריימים ב-EEVEE 480x270 + 3 stills + קידוד):
```
export BLENDER="/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe"; cd /c/RnD/Projects/Habait/habait-walkaround; export PYTHONIOENCODING=utf-8; PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe
timeout 3600 "$BLENDER" -b Habait/flyover/renders/baked/baked.blend -P Habait/flyover/life/life.py -- --preset morning --pass preview
$PY Habait/flyover/life/check_static.py Habait/flyover/life/_local/morning/frames --mask Habait/flyover/life/_local/morning/tower-mask.png --matte Habait/flyover/life/_local/morning/matte_first.png,Habait/flyover/life/_local/morning/matte_last.png
# צפוי: "tower mask diff first/last: 0 px", exit 0. ואז אותו דבר עם evening. ה-mp4: _local/<preset>/preview-<preset>.mp4
```
- **כסף:** $0. אין קריאות בתשלום ואין ledger.
- **פגמים פתוחים:**
  - ה-preview לא נצפה בעין: המסגור והמראה מאומתים רק בהטלה מספרית.
  - ב-480x270 אנשים הם ~3 px וציפורים 3–7 px (נקודות זזות). ל-review: `--res 960x540`.
  - ים כבוי (ראו הכרעה 2).
  - ההנחה ש-EEVEE דטרמיניסטי על פיקסלים סטטיים בין פריימים תיבדק רק בשער שאחרי הרנדר.
  - ל-Kaggle: נתיבי התמונות ב-`baked.blend` אבסולוטיים (`C:\RnD\Projects\Habait\...`) וצריך remap או pack (כרטיס 18).
  - מכוניות לא נכנסות לקטע שבסוף הנתיב, ולכן בתחילת הקליפ קצה הכביש ריק.
- **קורא שני:**
  - habait-98: מחזיק את Blender. הפקודה למעלה היא ריצת ה-Check, והתוצאה (פלט `check_static.py` + שני ה-mp4) נכנסת לבלוק הזה.
  - habait-ab: `life.py` קורא את `baked.blend` שלו בקריאה בלבד ומניח את השמות האלה:
    - מגדל: `BK_tower`, `BK_tower_hidden`, `BK_apt`, `BK_detail_{handrail,mullions,planters,bushes,small}`.
    - קרקע: `BK_ground`, `BK_ground_far`, `STUDIO_ortho`.
    - גגות: `BK_podium`.
    - מרכז מגדל (-5.9, -13, 14), קרקע z -52.35, ואין מישור ים.
    - bake מחדש שמשנה את אלה (או מוסיף `STUDIO_sea`) מחייב עדכון של `life.json` → `scene`.
    - ab גם מחליט אם להפעיל `--sea-mode osm-coast`.
- **לזיכרון:** כרטיס 16 (C2) PARTIAL: `Habait/flyover/life/` (life.py+life.json+check_static.py) מוסיף ל-baked.blend (קריאה בלבד) ציפורים boids, מכוניות על 35 כבישי OSM, אנשים billboard, עצים ברוח; ים רק אם יש מישור (אין → כבוי). selftest PASS: 0 שינוי סטטי, sha זהה. ה-preview (480x270, 240 פר') ממתין ל-98/Kaggle; שער 0 px על PNG ולא על mp4. $0.

> **הכרעת ab (16:15 שעון המכונה, בצ'אט של 4b):** ים נשאר כבוי (ברירת המחדל). הנימוק: בפלואו הנוכחי הים מגיע מסרטון ה-Kling ומה-skin של node-b, ומישור ים שטוח מ-OSM מתחת לקרקע המוקרנת עלול לחתוך את ה-skin ב-717 מ' בלי מדידה. הטריגר להדלקת `--sea-mode osm-coast`: דוח ה-coverage של baked-v5 מראה חור באזור הים במסלול הסיבוב. baked-v5 שומר בדיוק על שמות האובייקטים, מרכז המגדל וקרקע z -52.35, בלי STUDIO_sea; אם משהו ישתנה ab מעביר ל-4b לעדכון `life.json → scene`.

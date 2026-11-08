# משימה 11: B3: פנורמות זולות: Seedream 5 Pro + close-seam מול GPT 2.5 על פנורמה אחת

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | B |
| **מקור בתכנית** | חלק ג §2 ערוץ B, שלב B3; memory.md §7 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `genai-look` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T1** |
| **גל (wave)** | 2 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

להכריע אם יש פנורמה ב-≤ $0.30 שעומדת ברף: Seedream 5 Pro ($0.15) + מעבר close-seam, ו/או Skybox `control_image` (אם יש גישה), על אותו clay equirect של הסלון, מול הפנורמה הקיימת של GPT 2.5 ($1.20). מדדים: תפר L/R, קצוות per-class, והעין של אלירן. חיסכון פי 8 על 33 × 3 פנורמות = $100+ לכל דירה.

## תלויות

- clay equirect של חדר אחד (`360walkaround/tours/apt846-furnished/renders/cp-living/`, של habait-16; קריאה)
- `Habait/tour360/tools/close-seam.mjs` (של 16; הרצה בלבד)

## קלטים (קריאה)

- הבנצ'מרק הקודם: `research/fal-bench-2026-11-02/C-pano/` + README (Seedream: 99/97% קצוות, תפר שבור, מטבח לא מורחב)
- `C:\RnD\Projects\Habait\tools\bench\kf_check.py` (per-class)
- הפנורמה הקיימת של GPT: `Habait/tour360/apartments/apt846/panos/balanced/cp-living*.jpg`

## קבצים (הסוכן כותב רק כאן)

- `Habait/engine/experiments/panos-cheap/{run.py,compare.html,REPORT-he.md}`
- `Habait/engine/_local/experiments/panos-cheap/**`
- `Habait/engine/_local/ledger-B3.json`

## צעדים

1. probe ל-fal (יתרה); לרשום תקרה בקוד (`--cap 5`).
2. Seedream על ה-clay equirect עם רפרנס הסגנון של הסיור (לא לוח גנרי); close-seam; מדידת L/R diff לעומת המקור ו-kf_check per-class.
3. אם יש מפתח Skybox: אותו דבר; אם אין: לרשום "לא נבדק" ולא לפתוח חשבון (T1).
4. דף השוואה (כמו של habait-89): clay / GPT / Seedream+seam / Skybox, עם המספרים; שאלה אחת לאלירן: "מספיק טוב לפנורמות?" ברירת מחדל: לא, נשארים ב-GPT.

## קריטריוני קבלה

- [ ] תפר 360 נקי: L/R diff ≤ של המקור (GPT); קצוות per-class ≥ 0.95 קירות/זיגוג.
- [ ] מחיר בפועל ≤ $0.30 לפנורמה כולל close-seam.
- [ ] דף השוואה + דוח עברית + ledger עם כל קריאה.
- [ ] סה"כ הוצאה ≤ $5.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && $PY -c "import json;l=json.load(open('Habait/engine/_local/ledger-B3.json'));t=sum(x['cost'] for x in l['calls']);print('spent',t);exit(0 if t<=5 else 1)" && $PY Habait/engine/experiments/panos-cheap/run.py --measure-only
# צפוי: spent ≤ 5; טבלת מדדים: seam_diff, edges_walls, edges_glazing לכל מועמד; exit 0
```

**Reviewer scope:** המדדים בלבד: seam_diff נמדד על הפנורמה אחרי close-seam, לא לפני; הקצוות per-class ולא גלובלי.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

**תקרה $5.** ledger: `Habait/engine/_local/ledger-B3.json`. אישור אלירן בצ'אט המפעיל לפני הקריאה הראשונה. הבסיס GPT 2.5 כבר קיים (לא לייצר מחדש).

## דרגת הכרעה

**T1:** שאלה אחת לאלירן (מנוסחת בבלוק התוצאה, עם האפשרויות וברירת מחדל). הסוכן ממשיך בכל מה שלא תלוי בתשובה.

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

_(genai-look, 2026-11-02 14:20–14:45 שעון המכונה, מה-worktree `board-habait-workplan`; הופעל על ידי habait-4b)_

- **מצב:** **PARTIAL.** הבנצ'מרק רץ עד הסוף והשאלה (T1) פתוחה אצל אלירן. חסר `REPORT-he.md`: ה-harness של הסוכן חוסם כתיבת קבצי דוח, ולכן תוכן הדוח נמצא בבלוק הזה. הסשן המפעיל יכול להעתיק אותו לקובץ.
- **בשורה אחת:** Seedream 5 Pro + close-seam v2 (חדש) = **$0.30 לפנורמה**. תפר 2.96 מול 3.24 של GPT בסיור, קירות 0.86 מול 0.63, זיגוג 0.98 מול 0.79. **הרף המחמיר לא עבר:** קירות 0.86 < 0.95, ו-lr_diff‏ 5.7 > 3.2 (גם GPT לא עובר את רף הקירות במדידה הזו). ברירת המחדל נשארת GPT.
- **מה נעשה:**
  1. probe ל-fal (`storage/auth/token`): HTTP 200 לפני כל סבב, אין 403.
  2. **יצירה:** Seedream 5 Pro edit, 2048×1024. Image 1 = ה-clay של הסלון. Images 2–4 = חיתוכים מהפנורמות של GPT בסיור (מטבח, פינת אוכל, סלון), לא לוח גנרי. הפרומפט: "Keep image 1 exactly as framed, change only the grey materials" + גימורי הסיור. שתי גרסאות: clay כפי שהוא, ו-clay מגולגל כמו ש-GPT קיבל (u_edge 0.0769). הגלגול **הזיק** ל-Seedream (קירות 0.72 מול 0.88).
  3. **close-seam:** `close-seam.mjs` לא הורץ (T0 למטה). האלגוריתם שלו הועתק ל-`run.py` עם Seedream כצייר. **v1** (העתקה ישירה, "צבע מחדש את הרצועה"): לא עובד. Seedream מעתיק את image 1 כולל קו החיבור (במגולגל 35.4 → 32.7), ובגרסה הרגילה הוסיף ברצועה דלת עץ עם משקוף. **v2** (חדש): רצועה של 20° מעל החיבור מוחלפת ב-clay אפור, אותו פרומפט "change only the grey", הדבקת הרצועה בלבד עם feather של 40 פיקסלים. **עובד:** 48.6 → 2.96, ונקי בעין.
  4. **מדדים ($0):** seam_diff = המדד של close-seam.mjs (הועתק), נמדד **אחרי** ה-close, בקו החיבור של המודל עצמו. lr_diff = המדד של הבנצ'מרק הקודם בקו החיבור. קצוות **לפי מחלקה** עם `edge_mask`/`agree` של `kf_check.py` (יובאו לקריאה בלבד, סובלנות 8 פיקסלים = 1.4°). המחלקות הוטלו מ-`plan.json` דרך `depth.png` של ה-clay, כי אין id pass לפנורמות פנים. המפה נבדקה בעין; בדיקת שפיות: clay מוזז ב-1° נותן 1.000, מוזז ב-3° נותן קירות 0.763.
  5. **Skybox: לא נבדק.** אין מפתח ב-`.env`, ולא נפתח חשבון.
  6. **קלטים מהעץ הראשי (קריאה בלבד, כי הם לא ב-worktree):** `360walkaround/tours/apt846-furnished/renders/cp-living/{pano.webp,depth.png}` ו-`plan.json`. ב-worktree יש רק `pano.render.json` ו-log.
- **הכרעות T0:**
  - **close-seam.mjs לא הורץ.** הוא קשיח ל-GPT Image 2.5 ‏($2.40), כותב ל-`apartments/apt846/_local/generated` ול-`picks.json` (של habait-98), ורושם ב-ledger של הסיור, שכבר מעל התקרה ($129.74 מתוך $120). גם אם היה רץ, Seedream + close-seam היה עולה $2.55, ונכשל ברף ה-$0.30 מעצם ההגדרה.
  - מחלקות מהתכנית במקום id pass, כי id pass דורש Blender.
  - נוסף v2 (2 קריאות, $0.30) אחרי ש-v1 נכשל מסיבה מבנית.
- **המדדים** (פלט `run.py --measure-only`; מחיר לפנורמה):

| מועמד | $ | seam_diff (שכנים) | lr_diff | קירות | זיגוג | דלתות |
|---|---|---|---|---|---|---|
| clay | 0 | 1.55 (5.84) | 1.3 | 1.000 | 1.000 | 1.000 |
| GPT 2.5 לפני close-seam | 2.40 | 7.29 (9.00) | 7.2 | 0.643 | 0.795 | 0.689 |
| **GPT 2.5 בסיור** (+close-seam ב-GPT +doorfix) | 4.80 | **3.24** | **3.2** | 0.627 | 0.794 | 0.701 |
| Seedream (clay) | 0.15 | 48.58 | 32.3 | 0.878 | 0.980 | 0.757 |
| Seedream + close v1 | 0.30 | 19.89 | 15.2 | 0.821 | 0.980 | 0.749 |
| **Seedream + close v2** | **0.30** | **2.96** | 5.7 | **0.859** | **0.980** | 0.797 |
| Seedream (מגולגל) | 0.15 | 35.41 | 27.0 | 0.724 | 0.900 | 0.835 |
| מגולגל + v1 | 0.30 | 32.68 | 25.8 | 0.730 | 0.900 | 0.835 |
| מגולגל + v2 | 0.30 | 3.83 | 5.3 | 0.745 | 0.900 | 0.643 |

  - לא להשוות למספרי ה-keyframe (GPT 0.96/0.99 ב-kf_check, פרספקטיבה עם id אמיתי). כאן ההשוואה יחסית, על אותו מדד.
  - **מול קריטריוני הקבלה:** תפר: seam_diff ‏2.96 ≤ 3.24 ✓, lr_diff‏ 5.7 > 3.2 ✗. קצוות: זיגוג 0.98 ✓, קירות 0.86 ✗. מחיר $0.30 ✓. דף + ledger ✓, דוח ✗ (נחסם, התוכן כאן). סה"כ $0.90 ≤ $5 ✓.
- **לעין של אלירן (D-WQ-12):** הדלתות של Seedream הן קרם עם משקוף דק, לא zero-line נקי (ל-GPT עבר doorfix של $0; אותו doorfix יידרש). המקרר נשאר עמוד פלדה בגאומטריית ה-clay. האור בהיר וקריר יותר מ-GPT. GPT מוסיף שטיח, עציצים ומנורה כי הוא מצייר מחדש, ולכן הקצוות שלו נמוכים יותר. נבדק רק הסלון.
- **קבצים שנכתבו:**
  - `Habait/engine/experiments/panos-cheap/run.py`: probe, `--gen`, `--close`, `--close2`, `--measure-only`. תקרה בקוד `--cap` ≤ 5, דילוג על פלטים קיימים, עצירה ב-403 Exhausted.
  - `Habait/engine/experiments/panos-cheap/compare.html`: clay / GPT בסיור / Seedream / Seedream+close-seam v2 (+ v1 והמגולגל), חיתוכי תפר, הטבלה. נכתב מאותו `metrics.json`.
  - `Habait/engine/_local/experiments/panos-cheap/`: `gen/` (6 פלטים + raw + `.call.json`), `inputs/`, `classmap.png`, `metrics.json`, `view/*.jpg`.
  - `Habait/engine/_local/ledger-B3.json`.
  - (כל הנתיבים יחסיים לשורש ה-worktree; `_local` הוא junction לעץ הראשי.)
- **פלט ה-Check (מילה במילה; מותאם ל-worktree: `cd C:/RnD/Projects/Habait/habait-walkaround/.claude/worktrees/board-habait-workplan`, כי `run.py` קיים רק שם; ה-ledger זהה דרך ה-junction):**
```
spent 0.8999999999999999
class share of frame (plan ray cast through the clay depth): {'0': 0.0, 'walls': 0.125, 'glazing': 0.055, 'doors': 0.009, 'furniture': 0.172, 'floors_ceilings': 0.639}; edge tol 8 px
candidate                usd seam_diff (nbrs) lr_diff edges_walls edges_glazing doors   all  verdict (seam/edges/cost)
clay                    0.00      1.55   5.84     1.3       1.000         1.000 1.000 1.000  -
gpt25-raw               2.40      7.29   9.00     7.2       0.643         0.795 0.689 0.698  -
gpt25-final             4.80      3.24   9.39     3.2       0.627         0.794 0.701 0.697  -
seedream-clay           0.15     48.58   7.96    32.3       0.878         0.980 0.757 0.871  FAIL x/x/ok
seedream-clay+seam      0.30     19.89   7.95    15.2       0.821         0.980 0.749 0.864  FAIL x/x/ok
seedream-clay+seam2     0.30      2.96   7.98     5.7       0.859         0.980 0.797 0.868  FAIL x/x/ok
seedream-rolled         0.15     35.41   8.17    27.0       0.724         0.900 0.835 0.808  FAIL x/x/ok
seedream-rolled+seam    0.30     32.68   8.16    25.8       0.730         0.900 0.835 0.807  FAIL x/x/ok
seedream-rolled+seam2   0.30      3.83   7.41     5.3       0.745         0.900 0.643 0.804  FAIL x/x/ok
ledger ledger-B3.json: $0.90 of $5.00
exit 0
```
- **כסף:** **$0.90** (6 × $0.15, Seedream 5 Pro edit; מחיר רשום לפי ledger-C של הבנצ'מרק, fal לא מחזיר מחיר בתשובה) ב-`Habait/engine/_local/ledger-B3.json`. תקרה $5. אישור: אלירן בצ'אט של habait-4b ‏(~13:55, "לאשר").
- **פגמים פתוחים:** `REPORT-he.md` לא נכתב (חסימת harness). דלתות עם משקוף ב-Seedream (צריך doorfix). נבדק חדר אחד. הסף 0.95 לקירות לקוח מה-keyframes, ולא מכויל לפנורמות (GPT עצמו 0.63 כאן). המחיר $0.15 הוא אומדן ולא חיוב שנקרא מ-fal.
- **שאלה לאלירן (T1): "מספיק טוב לפנורמות?"**
  - **א. לא, נשארים ב-GPT 2.5 (ברירת מחדל).**
  - ב. כן לפנורמות הפנים: Seedream + close-seam v2 ($0.30 במקום $1.20–$4.80), אחרי פיילוט על 3 חדרים נוספים (מטבח, רחצה, חדר שינה; ~$0.90, כרטיס נפרד). אחר כך habait-98 משלב את v2 + doorfix ב-gen-pano/close-seam.
  - ג. רק לסטי הרצפות (restyle של פנורמה קיימת), כשהבסיס נשאר GPT.
- **קורא שני:** habait-98. הוא מחזיק את הפנורמות של 846, את `close-seam.mjs` ואת ה-ledger של הסיור. שלושה דברים מחייבים אותו: (1) `close-seam.mjs` קשיח ל-GPT, ו-v1 לא עובד עם Seedream; (2) ל-Seedream צריך את v2 (רצועת clay של 20° + "change only the grey"); (3) אם אלירן בוחר ב', השילוב נעשה אצלו. habait-89 (מידע בלבד): הממצא "Seedream שובר את התפר" ב-README של הבנצ'מרק קיבל תיקון ב-$0.15.
- **לזיכרון:** כרטיס 11 (2.11): Seedream 5 Pro מ-clay הסלון + close-seam v2 (רצועת clay של 20° בתפר, "change only the grey", $0.15) = $0.30 לפנורמה. תפר 2.96 מול 3.24 של GPT, קירות/זיגוג .86/.98 מול .63/.79 (מחלקות מהתכנית דרך העומק). close-seam בגרסת v1 לא עובד עם Seedream (מעתיק את התפר). רף קירות .95 לא עבר. ממתין לאלירן. $0.90 ב-ledger-B3.

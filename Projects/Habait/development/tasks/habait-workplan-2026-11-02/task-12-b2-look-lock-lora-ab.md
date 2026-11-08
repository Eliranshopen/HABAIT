# משימה 12: B2: לוק נעול: LoRA על ההדמיות של היזם + A/B של GPT 2.5 / FLUX.1 Depth / Qwen-Edit+LoRA עם openings_gate

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | B |
| **מקור בתכנית** | חלק ג §2 ערוץ B, שלב B2; חלק א §5 M2 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `genai-look` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T1** |
| **גל (wave)** | 4 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

לנעול "לוק פרויקט": LoRA (Flux.2 Klein דרך fal, ≈ $4.30/1k צעדים) על ההדמיות הציבוריות של Rainbow + material board של הסיור; ואז A/B על רנדר מרוהט אחד: GPT 2.5 (הבסיס) / FLUX.1 Depth [pro] עם depth מ-Blender / Qwen-Image-Edit-2511 + LoRA. השופט: `openings_gate` ≥ 0.6 לכל פתח + העין של אלירן ("זה הלוק של ישראל-קנדה").

## תלויות

- B0: אלירן אמר "זה הלוק" על הסיור הנוכחי (habait-16; פתוח)
- 07 או רנדר מרוהט קיים של חדר אחד (clay + depth EXR)
- 05 (facade/openings gate בפקודה)

## קלטים (קריאה)

- הדמיות ייחוס: `Habait/studio/_local/projects/apt846-rainbow-tlv/intake/reference-site/` (README שם; קריאה)
- `Habait/tour360/apartments/apt846/material-board.json`
- clay + depth: `360walkaround/tours/apt846-furnished/renders/cp-living/`
- `C:\RnD\Projects\Habait\tools\bench\openings_gate.py`

## קבצים (הסוכן כותב רק כאן)

- `Habait/engine/experiments/look-lock/{train.py,ab.py,compare.html,REPORT-he.md}`
- `Habait/engine/_local/experiments/look-lock/**`
- `Habait/engine/_local/ledger-B2.json`

## צעדים

1. סט אימון: 10–20 תמונות (הדמיות היזם + 3 פנורמות של הסיור כ-crops), כיתובים קצרים; אימון LoRA עם תקרה.
2. A/B: אותו clay + אותו depth לשלושת המודלים, 2 seeds כל אחד; `openings_gate` על כל פלט; טבלה.
3. דף השוואה + שאלה אחת לאלירן (איזה לוק); ברירת מחדל אם שתיקה: GPT 2.5 בלי LoRA (המצב היום).
4. לרשום ב-ledger כל קריאה; לעצור ב-$40.

## קריטריוני קבלה

- [ ] LoRA אומן ונשמר (URL/קובץ) עם רשימת תמונות האימון ורישיונן.
- [ ] A/B: 6 פלטים, כולם עם ציון openings_gate; לפחות מועמד אחד ≥ 0.6 בכל פתח.
- [ ] דף השוואה בעברית; הוצאה ≤ $40; שאלת T1 מנוסחת.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && $PY -c "import json;l=json.load(open('Habait/engine/_local/ledger-B2.json'));t=sum(x['cost'] for x in l['calls']);print('spent',t);exit(0 if t<=40 else 1)" && $PY Habait/engine/experiments/look-lock/ab.py --gate-only
# צפוי: spent ≤ 40; טבלה 6 שורות עם openings_gate לכל פלט; exit 0
```

**Reviewer scope:** ה-gate בלבד: ציוני openings_gate חושבו על הפלטים בקובץ (hash תואם), לא הועתקו מריצה אחרת.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

**תקרה $40** (LoRA ≈ $5–10, A/B ≈ $10–20). ledger: `Habait/engine/_local/ledger-B2.json`. אישור אלירן בצ'אט המפעיל. D-WQ-18: הדמיות היזם משמשות לאימון look בלבד, לא נכנסות לפריימים.

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

_(genai-look, habait-4b, 2026-11-02 16:15–16:50 שעון המכונה)_

- **מצב:** DONE לפי קריטריוני הקבלה (LoRA נשמר + רשימה ורישיונות; 6 פלטים עם ציון; לפחות אחד ≥ 0.6; דף בעברית; $4.32 ≤ $40; שאלת T1 מנוסחת). **T1 פתוח אצל אלירן.** חסר: `REPORT-he.md` (ראו פגמים).
- **מה נעשה:**
  1. **המבט (אותו קלט לשלושה):** חיתוך פרספקטיבי מתוך ה-clay equirect של הסלון (`360walkaround/tours/apt846-furnished/renders/cp-living/pano.webp` + `depth.png`): מצלמה ב-(685.3, 935.1) ס"מ, 1.60 מ', כיוון 111.3° (ה-forward של הפנורמה), pitch 0, HFOV 90°, 1536×1024 (18 מ"מ על 36). העומק הרדיאלי נדגם באותו מיפוי והומר למישורי. נכתב כ-shot dir שהשער קורא (`frame_0001.png`, `depthcm_0001.png`, `camera.json` עם תיעוד החיתוך). הכיוון נבחר כי רק בו השער שופט פתחים אמיתיים: 5 לוחות החזית (facade-3/8/9/10/11). הדלת היחידה של החדר (o-6) לא מצוירת ב-clay הזה (קיר חלק), ולכן מבט אליה לא היה שופט כלום.
  2. **שערי $0 לפני כסף:** `kf_check.py` על ה-clay: PASS 1.0/1.0, הזזה 0.0°, 5 פתחים; `openings_gate.py` clay מול clay: PASS, 5 נשפטו. probe ל-fal: HTTP 200.
  3. **LoRA:** 13 תמונות עם כיתובים קצרים ומילת הדק `hbt846 style`: 7 חיתוכים מהדמיות החוץ הציבוריות של היזם (THE-1 סביב המגדל בלי תוויות הרחובות, THE-2, THE-3 ×2, THE-8, THE-6 ×2 בלי האותיות RAINBOW; זכויות: Israel Canada, rainbowtlv.com, לאימון לוק בלבד, D-WQ-18) + 6 חיתוכים מ-3 פנורמות של הסיור (02-kitchen, 04-living, 07-bedroom-main; שלנו). **בכוונה בחוץ:** THE-7/fb2/fb3 (מראות הפנים של היזם שאלירן דחה ב-1.11 16:40 לטובת סגנון הסיור), fb-* (פריימי וידאו מטושטשים). מאמן: `fal-ai/qwen-image-2512-trainer`, 1000 צעדים, lr 5e-4, $1.50 (מחיר חי $0.0015 לצעד), 1464 ש'. נשמר: `Habait/engine/_local/experiments/look-lock/train/lora.safetensors` (94.5 MB, sha256 `1602b2be…`) + URL ב-`train/lora.json`; רשימת התמונות עם hash ורישיון לכל קובץ: `train/manifest.json`.
  4. **A/B (2 דגימות לכל מודל):** A = GPT Image 2.5 `openai/gpt-image-2.5/sunburst/edit` (clay + 3 חיתוכי סיור, "Keep image 1 exactly as framed, change only the grey materials"; אין פרמטר seed, A1/A2 = שתי דגימות). B = FLUX.1 Depth [pro] `fal-ai/flux-pro/v1/depth` (עומק ה-Blender כ-control, ליניארי, קרוב = בהיר; פרומפט מתאר; seeds 1/2). C = `fal-ai/qwen-image-edit-2511/lora` + ה-LoRA (scale 1.0, clay בלבד, seeds 1/2). שתי בקרות מחוץ לטבלה: Qwen-Edit-2511 בלי LoRA, ו-FLUX Depth pro עם ה-clay כ-control.
  5. **תוצאה:** כל 6 עוברים את השער ואת כלל הכרטיס (kept_min: A1 .740, A2 .791, B1 .658, B2 .680, C1 .862, C2 .827). **בעין:** A הכי פוטוריאליסטי ושומר את הקיר, המנורה, הספה והמזנון (A2 הוסיף דלת zero-line בקיר הימני); B ממציא את קיר הזכוכית (קצב מליונים אחר, המרפסת נעלמת, B2 חלון אחד ענק והספה זזה), כי דרך זכוכית העומק של Blender הוא הלוח עצמו; עם ה-clay כ-control אותו מודל מגיע ל-.932, כלומר רוב החולשה מהעומק ולא מהמודל. C קרוב ללוק של הסיור ב-$0.06 (פי 20 זול מ-GPT) אבל פחות פוטוריאליסטי, מסגרות לבנות במקום שחורות, ו-C1 הוסיף דלת עם משקוף. ה-LoRA מחמם את הפלטה לכיוון הסיור; בלעדיו (הבקרה) Qwen הפך את לוח הזכוכית השמאלי לדלת כפולה ועדיין עבר את השער (.856).
  6. **הכרעות T0 (נרשמו):** (א) מאמן Qwen-Image-2512 במקום Flux.2 Klein: ה-LoRA של Klein לא נטען ב-Qwen, המאמן של Qwen-Edit-2511 ב-fal deprecated, ומאמני edit צריכים זוגות. (ב) אף endpoint של FLUX depth ב-fal לא מקבל מפת עומק גולמית; העומק נשלח כתמונה וה-preprocessor של fal רץ עליה. (ג) מבט פרספקטיבי ולא equirect (FLUX/Qwen מאומנים על פרספקטיבה). (ד) ה-ledger נכתב ב-ASCII (עברית escaped) כי ה-Check קורא אותו ב-cp1255.
- **קבצים שנכתבו:**
  - `Habait/engine/experiments/look-lock/ab.py` (`--probe / --inputs / --gen / --gate-only / --page`; `--gate-only` מריץ את `openings_gate.py` ו-`kf_check.py` של `tools/bench` כתהליכים על הקבצים בדיסק ובודק sha256 מול ה-ledger; נבדק שלילית: עותק עם פיקסל אחד שונה → `hash_ok False`)
  - `Habait/engine/experiments/look-lock/train.py` (`--dataset / --train`)
  - `Habait/engine/experiments/look-lock/compare.html` (עברית: טבלה, 10 תמונות, הערות עין, החלפות, מגבלות השער, השאלה; הדמיות היזם בשם בלבד)
  - `Habait/engine/_local/experiments/look-lock/**` (inputs/shot, inputs/depth-control.png, inputs/refs, train/{images, dataset.zip, manifest.json, lora.json, lora.safetensors, train.log}, gen/<id>/{out.png, call.json}, gate/<id>.{gate.json, kf.json, sheet.png}, gate-table.json, view/*.jpg)
  - `Habait/engine/_local/ledger-B2.json`
- **פלט ה-Check (מילה במילה):**
```
spent 4.324
openings_gate on the files on disk (shot shot: cp-living, bearing 111.3, HFOV 90.0, 1536x1024)
id   model                              seed sha256       hash  judged kept_min shift_max gate   >=0.60 kf clay->out
--------------------------------------------------------------------------------------------------------------------
A1   openai/gpt-image-2.5/sunburst/edit    1 e6daddf32cad ok         5     0.74      0.62 PASS   yes           0.946
A2   openai/gpt-image-2.5/sunburst/edit    2 e847e2c9774e ok         5    0.791      0.79 PASS   yes           0.932
B1   flux-pro/v1/depth                     1 1f758307fd51 ok         5    0.658      1.76 PASS   yes            0.76
B2   flux-pro/v1/depth                     2 35b3847214ba ok         5     0.68      2.75 PASS   yes           0.759
C1   qwen-image-edit-2511/lora             1 e593bc66184e ok         5    0.862       2.2 PASS   yes           0.938
C2   qwen-image-edit-2511/lora             2 11356cbbb321 ok         5    0.827      1.49 PASS   yes           0.926
control (not in the A/B) ctrl-C-nolora: C-nolora qwen-image-edit-2511                  1 caa985cd55f0 ok         5    0.856      2.05 PASS   yes           0.944
control (not in the A/B) ctrl-B-claycontrol: B-claycontrol flux-pro/v1/depth                     1 f01f6b15f8a0 ok         5    0.932      0.56 PASS   yes           0.955
  A1: facade-3 0.740/0.5deg  facade-8 0.987/0.6deg  facade-9 1.000/0.1deg  facade-10 0.999/0.1deg  facade-11 1.000/0.1deg
  A2: facade-3 0.791/0.7deg  facade-8 1.000/0.4deg  facade-9 0.986/0.1deg  facade-10 0.986/0.1deg  facade-11 1.000/0.8deg
  B1: facade-3 0.780/1.8deg  facade-8 0.865/0.9deg  facade-9 0.658/0.7deg  facade-10 0.718/0.8deg  facade-11 0.704/0.8deg
  B2: facade-3 0.680/2.8deg  facade-8 0.909/0.3deg  facade-9 0.786/0.4deg  facade-10 0.794/0.7deg  facade-11 0.683/0.1deg
  C1: facade-3 0.884/1.0deg  facade-8 0.880/0.4deg  facade-9 1.000/0.1deg  facade-10 0.996/0.1deg  facade-11 0.862/2.2deg
  C2: facade-3 0.900/0.3deg  facade-8 0.827/0.5deg  facade-9 0.941/0.6deg  facade-10 0.952/0.6deg  facade-11 0.965/1.5deg
rows 6/6  hash mismatches none  candidates keeping >= 0.60 on every judged opening: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
CHECK EXIT 0
```
  (הריצה הראשונה של ה-Check נפלה ב-`UnicodeDecodeError` cp1255 על העברית ב-ledger, exit 1; תוקן בכתיבת ה-ledger ב-ASCII, הערכים זהים. השורה `CHECK EXIT` היא `echo $?` שהוספתי אחרי הפקודה.)
- **כסף:** **$4.324 מתוך $40**, ledger `Habait/engine/_local/ledger-B2.json` (owner habait-4b, card 12). 9 קריאות, כולן ok: trainer `fal-ai/qwen-image-2512-trainer` $1.500 (16:15, 1000 צעדים); `fal-ai/flux-pro/v1/depth` B1 $0.084, B2 $0.084, בקרת clay $0.084; `openai/gpt-image-2.5/sunburst/edit` A1 $1.200, A2 $1.200; `fal-ai/qwen-image-edit-2511/lora` C1 $0.060, C2 $0.060; `fal-ai/qwen-image-edit-2511` בקרה $0.052. הסכומים הם אומדן לפי ה-pricing API החי של 2.11 (GPT $1 ליחידה, הוזמן $1.20 כמו ב-memory §7; FLUX Depth pro $0.05/MP; Qwen-Edit/lora $0.035/MP; edit $0.03/MP), לא חשבונית: fal לא מחזיר חיוב וה-usage API חסום למפתח הזה (403).
- **פגמים פתוחים / שאלה לאלירן (אם T1/T2):**
  - **`REPORT-he.md` לא נכתב:** ה-harness חוסם תתי-סוכנים מלכתוב קבצי דוח .md. כל התוכן שלו נמצא ב-`compare.html` (סעיפים: קלט, LoRA, החלפות, מגבלות השער, עין, שאלה) ובבלוק הזה; הסשן המפעיל יכול לכתוב אותו אם צריך.
  - **השער מקל מדי על החזית:** `openings_gate` בודק רק משקופים וראש של כל קופסה. B1 עבר עם קצב מליונים אחר, והבקרה בלי LoRA עברה (.856) אחרי שהפכה לוח זכוכית לדלת כפולה. העין של אלירן חובה (D-WQ-12); שיפור לשער (בדיקת מליונים פנימיים / ספירת אנכיים בתוך קופסה) הוא אצל 98 (`tools/bench`).
  - **לקח פרומפט:** המשפט "every door is a zero-line flush door" במבט שאין בו דלת גרם ל-A2, C1 ולבקרה להמציא דלת. להשמיט כשאין דלת במבט.
  - ה-clay ישן (אריחים עם פוגות, משקופים); חדר אחד, מבט אחד; לא נבדקו תפר 360 וחדרים אחרים. ה-LoRA מעורב חוץ+פנים; לא נבדק על נוד חוץ.
  - **שאלה לאלירן (T1):** "פתחתי דף השוואה (`Habait/engine/experiments/look-lock/compare.html`): אותו מבט מהסלון של 846 צבוע בשלושה מודלים. איזה לוק נועל את הפרויקט? **א.** GPT Image 2.5 כמו היום ($1.20 לתמונה, הכי ריאליסטי). **ב.** FLUX.1 Depth [pro] ($0.08, ממציא את קיר הזכוכית). **ג.** Qwen-Image-Edit-2511 + ה-LoRA שאימנו ($0.06, פי 20 זול, קרוב לסגנון הסיור אבל פחות ריאליסטי). ברירת מחדל אם אין תשובה: **א**, GPT 2.5 בלי LoRA נשאר המודל של הפרויקט."
- **קורא שני:** habait-98: מחזיק את `gen-pano.mjs` / צינור ה-skins ואת `tools/bench`. מחייב אותו: (1) אין שינוי במודל עד תשובת אלירן (ברירת מחדל GPT 2.5); (2) המשפט "every door is a zero-line flush door" ממציא דלתות במבט בלי דלת, רלוונטי לפרומפטים של gen-pano/skins; (3) `openings_gate` לא תופס לוח זכוכית שהפך לדלת (.856 PASS) ולא מליונים פנימיים; (4) אם אלירן בוחר ג: LoRA ב-`Habait/engine/_local/experiments/look-lock/train/lora.json`, endpoint `fal-ai/qwen-image-edit-2511/lora`, $0.06 לתמונה.
- **לזיכרון:** כרטיס 12 (2.11 16:50): LoRA ‏`hbt846 style` (qwen-image-2512-trainer, 1000 צעדים, $1.50; 7 הדמיות חוץ של היזם + 6 חיתוכי סיור) ו-A/B על מבט אחד מהסלון: כל 6 עברו openings_gate ‏(.66–.86). בעין GPT 2.5 הכי ריאליסטי; Qwen-Edit+LoRA ב-$0.06 קרוב ללוק; FLUX Depth עם עומק Blender ממציא את הזכוכית. "zero-line door" במבט בלי דלת ממציא דלתות. $4.32 ב-ledger-B2. ממתין לאלירן (ברירת מחדל GPT).

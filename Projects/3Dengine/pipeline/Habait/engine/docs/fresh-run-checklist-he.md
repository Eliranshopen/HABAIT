# הרצה טרייה: 846 מ-PDF עד dist, רק לפי התיעוד

רשימת הפקודות המדויקת לסוכן טרי (`qa-reviewer` בהקשר נקי) שלוקח את דירה 846 מ-`דירה 846- 16.pdf` עד `dist/apt846/index.html` + `846.zip`, בלי לשאול אף אחד. כל פקודה כאן רצה היום (2026-11-02, כרטיס 31) בתיקייה זמנית, והשורות הצפויות הועתקו מהפלט. הרקע לכל צעד: [`add-a-project-he.md`](add-a-project-he.md); המנוע: [`../README.md`](../README.md). גרסה 2 (18:45 שעון המכונה): תוקנה אחרי ההרצה הטרייה הראשונה (`fresh-run-report.md`), ורצה שוב כלשונה (19 בלוקים, 229 ש', `DIST-OK`, `STAMP-OK` ל-plan ול-building, $0).

## משתני הסביבה (נקבעים בראש כל בלוק)

| משתנה | ערך | למה |
|---|---|---|
| `PYTHONIOENCODING` | `utf-8` | הקונסולה ב-cp1255; בלי זה Python נופל על עברית |
| `HABAIT_APP_DIR` | `C:/RnD/Projects/Habait/tools/appdeps` | `sharp` של שלב export (`build_zip.mjs`) |
| `BLENDER` | `C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe` | הנתיב שהמנוע מדפיס בפקודות של scene/clay. **ההרצה הזו לא מפעילה Blender**; המשתנה רק מבטיח שהפקודות המודפסות נכונות |
| מבוטלים: `HABAIT_BLENDER_OK`, `HABAIT_ALLOW_SPEND`, `HABAIT_CAP_USD` | `unset` | כדי ש-scene/clay לא יפעילו Blender ושלבים בתשלום תמיד יסורבו, גם אם נשארו בסביבה מהרצה קודמת |

ההקדמה (כבר כלולה בכל בלוק למטה, כי ה-shell לא שומר `cd` ומשתנים בין קריאות):

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
```

## כללים להרצה

1. **$0 בלבד.** אין `claude -p`, אין fal, אין Kaggle, אין Blender. אם צעד מבקש אחד מהם: לא מריצים, רושמים בדוח, וממשיכים לפי ההוראה של הצעד.
2. **לא כותבים מחוץ לתיקיית הפרויקט** (`$P`), חוץ מהדוח `Habait/engine/docs/fresh-run-report.md`. לא עורכים שום קובץ קוד, פיקסטורה או תיעוד. אין `git` בכלל.
3. **מעתיקים כל בלוק כמו שהוא.** אם בצעד 1 יוצא `P-EXISTS`: מחליפים בכל הבלוקים `fresh-846` ב-`fresh-846-2` (ואם גם הוא קיים, `-3` וכן הלאה). לא מוחקים תיקייה קיימת. (`fresh-846` כבר קיימת מההרצה הראשונה של 18:20.)
4. **exit שונה מהצפוי, או שורה צפויה שלא הופיעה = פגם.** רושמים בדוח את הפקודה, את ה-exit ואת 5 השורות האחרונות, וממשיכים לצעד הבא. **כל שאלה שהייתם צריכים לשאול = פגם בתיעוד:** רושמים אותה בדוח.
5. **מספרים משתנים, מבנה לא.** זמנים, ספירות של intake ומספרי `qa_report` יכולים לזוז (המכונה עמוסה; פיקסטורות של סשן אחר משתנות). מה שקובע בכל צעד: ה-exit, ושהשורות והשדות שכתובים בצעד מופיעים. כשצעד נותן שני מצבים ("לפני התיקון" / "אחרי התיקון"), כל אחד מהם תקין; רושמים בדוח איזה מהם התקבל.
6. **הרצה לבד, בלי סשנים אחרים.** בפלט של המנוע מופיע `Blender is owned by another session (SESSIONS.md: habait-98)`. בשבילכם זה אומר רק: Blender לא שלכם, לא מריצים אותו, וממשיכים עם מה שבדיסק (צעד 11). לא צריך לקרוא את `SESSIONS.md` ולא לפנות לאף סשן.
7. **שעון:** כל השעות במסמכים האלה הן שעון המכונה כפי שהוא בחותמות הקבצים, ב-`ledger.json` וב-`.stage.json` (‎`+02:00`). `date` של Git Bash יכול להדפיס אזור זמן אחר; משווים לפי החותמות, לא לפי `date`.
8. זמן כולל צפוי: 3–5 דקות של מכונה (intake רסטר לבדו 60–146 ש'; ההרצה המלאה של הרשימה הזו לקחה היום 229 ש').

## 1. קלטים קיימים, תיקייה פנויה

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
ls "דירה 846- 16.pdf" Habait/engine/fixtures/rainbow-846.project.json Habait/engine/_local/apt846-project/intake/apt846.vlm-reply.txt Habait/engine/_local/apt846-project/intake/apt846.assign-reply.txt > /dev/null && echo INPUTS-OK; test -e $P && echo P-EXISTS || echo P-FREE
```

צפוי: `INPUTS-OK` ואז `P-FREE` (אם `P-EXISTS`: כלל 3).

## 2. בדיקת project.json

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
$PY -B Habait/engine/validate_project.py Habait/engine/fixtures/rainbow-846.project.json --check-files; echo "exit=$?"
```

צפוי: `[OK] Habait/engine/fixtures/rainbow-846.project.json` ו-`exit=0`.

## 3. יצירת תיקיית הפרויקט

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
$PY -B Habait/engine/cli.py init $P --from Habait/engine/fixtures/rainbow-846.project.json; echo "exit=$?"
```

צפוי: `init: Habait/engine/_local/fresh-846  project rainbow-tlv  from Habait/engine/fixtures/rainbow-846.project.json  (1 unit(s))` ו-`exit=0`.

## 4. intake וקטורי (הדרך הראשית)

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
timeout 300 $PY -I Habait/engine/intake/intake_pdf_vector.py "דירה 846- 16.pdf" --out $P/intake-vector/apt846 --apartment-id apt846 --known-dims Habait/studio/fixtures/apt846.intake.json --ground-truth 360walkaround/tours/apt846/plan.json --tour-crop-box-px "[1750,380,5500,4280]" > $P/intake-vector.log 2>&1; echo "exit=$?"; head -6 $P/intake-vector.log; grep -m1 "recall" $P/intake-vector.log; ls $P/intake-vector/apt846
```

צפוי: `exit=0`; השורה הראשונה `6667 primitives after clipping (8636 drawings, 46 OCG layers, 0 text spans)`; בין 6 השורות `rooms: 10 (10 named, 0 unnamed), 6 virtual zone cuts`; שורת recall: `recall **16/16**` (הפיקסטורה תוקנה ל-199 ב-18:23), או `recall **15/16**; missed [99]; false [199]` אם רצים מול פיקסטורה ישנה; בתיקייה `overlay.png  plan-crop.png  plan.json  report.json  report.md`. זמן: 11–45 ש' (41 ש' כשהמכונה עמוסה).

## 5. בדיקת הטיוטה הווקטורית

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
node 360walkaround/pipeline/validate-plan.mjs $P/intake-vector/apt846/plan.json > $P/intake-vector.validate.log 2>&1; echo "validate exit=$?"; tail -1 $P/intake-vector.validate.log
$PY -B Habait/engine/gates/plan_gate.py $P/intake-vector/apt846/plan.json --report $P/intake-vector/apt846/report.json --intake Habait/studio/fixtures/apt846.intake.json --out $P/intake-vector/apt846/plan_gate.json | head -1; echo "plan_gate exit=${PIPESTATUS[0]}"
```

צפוי: `validate exit=0` ו-`  note rooms 10 (indoor clear floor 91.75 m2, outdoor 24.16 m2) · walls 9 pieces · openings 14 · panes 8 · cameras 10`; אחר כך `plan_gate: FAIL  score=0.500  worst_room=r-guest-bathroom  worst_dim_dev=3.3%` ו-**`plan_gate exit=1`**. ה-FAIL וה-exit 1 **צפויים** (האמבטיה הכללית 199 נמדדת 205.5): הטיוטה הולכת למסך התיקון. זה לא פגם בהרצה.

## 6. מסך התיקון: בדיקת החוזה בלבד

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
timeout 60 node Habait/engine/correct/serve.mjs --plan $P/intake-vector/apt846/plan.json --selftest | tail -2; echo "exit=${PIPESTATUS[0]}"
```

צפוי: `ok   input plan untouched (sha256 unchanged)`, `selftest OK`, `exit=0`.

**התיקון עצמו (A2) צריך אדם (אלירן) ולכן לא רץ בהרצה הזו.** לא מפעילים את השרת האינטראקטיבי (הוא לא מסתיים לבד). בדוח רושמים: "A2 דולג: דורש אלירן". בלי פלט A2, שלב `plan` (צעד 10) לוקח את התכנית שנבדקה ביד מ-`project.json` (`units[].files.plan_json`), וזה הצפוי.

## 7. תשובות VLM שמורות (fallback רסטרי ב-$0)

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
cp Habait/engine/_local/apt846-project/intake/apt846.vlm-reply.txt Habait/engine/_local/apt846-project/intake/apt846.assign-reply.txt $P/intake/ && ls $P/intake
```

צפוי: `apt846.assign-reply.txt` ו-`apt846.vlm-reply.txt`. בלי הקבצים האלה שלב `intake` היה קורא ל-`claude -p` (אסור בהרצה הזו).

## 8. dry-run של כל השלבים

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
timeout 600 $PY -B Habait/engine/cli.py run $P --stage all --dry-run > $P/dryrun.log 2>&1; echo "exit=$?"; grep -E "^\[|^summary|vlm backend" $P/dryrun.log | cut -c1-160
```

צפוי `exit=0` והשורות (בסדר הזה; `cut` חותך כל שורה ב-160 תווים, ולכן שורת ה-`note` נקטעת אחרי `assign file:...`):

```
[1/8] intake [apt846]      RUN    no stamp: never completed here
        note  vlm backend file:Habait/engine/_local/fresh-846/intake/apt846.vlm-reply.txt, assign file:Habait/engine/_local/fresh-846/intake/apt846.assign-reply.txt ($0: ...
[2/8] plan [apt846]        RUN    no stamp: never completed here
[3/8] building             RUN    no stamp: never completed here
[4/8] scene [apt846]       DEFER  Blender is owned by another session (SESSIONS.md: habait-98); set HABAIT_BLENDER_OK=1 only in the session that owns it
[5/8] clay [apt846]        DRYRUN render_tour.mjs --dry-run only (Blender owned by habait-98; HABAIT_BLENDER_OK != 1)
[6/8] skin [apt846]        REFUSE REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $26.40, nothing was called
[7/8] video [apt846]       REFUSE REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $3.20, nothing was called
[8/8] export [apt846]      RUN    no stamp: never completed here
summary   run 4 · defer 1 · dry-run-only 1 · refuse 2 · ledger Habait/engine/_local/fresh-846/ledger.json $0.00
```

**אם בשורת `vlm backend` כתוב `claude` ולא `file:`: עוצרים כאן**, חוזרים לצעד 7, ולא ממשיכים לצעד 9 עד שהשורה אומרת `file:`. (שורות DEFER/DRYRUN: כלל 6.)

## 9. intake דרך ה-CLI (רסטר, תשובות שמורות)

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
timeout 900 $PY -B Habait/engine/cli.py run $P --stage intake --quiet; echo "exit=$?"
```

צפוי: `exit=0`, ושורת התוצאה בצורה הזו:

`-> ok  exit 0  gate FAIL (advisory)  $0.00  <N> s  | draft plan.json written; draft gate FAIL (advisory); report: rooms_total <a>, rooms_named <b>, dims_read <c>, dims_total 16, max_dev_pct <d>`

- **הכלל:** המספרים יכולים להשתנות. מה שקובע: `exit 0`, `-> ok`, `$0.00`, וחמשת השדות `rooms_total`, `rooms_named`, `dims_read`, `dims_total`, `max_dev_pct` מופיעים. ה-FAIL הוא advisory (טיוטה) ולא עוצר.
- מה נמדד היום: `rooms_total 10, rooms_named 8, dims_total 16`; `dims_read 14` מול הפיקסטורה הישנה (99) ו-**15** אחרי התיקון ל-199 ב-18:23 (`dims_read` נספר מול `apt846.intake.json`); `max_dev_pct 105.9`; זמן 60–146 ש' בארבע הרצות היום (עד 3 דקות זה תקין; 900 ש' = ה-timeout).

## 10. plan + building

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
timeout 900 $PY -B Habait/engine/cli.py run $P --stage plan,building --keep-going --quiet; echo "exit=$?"
```

`--keep-going` כדי ש-building ירוץ גם אם plan נכשל (בלעדיו: `not run: an earlier step failed`). שני מצבים תקינים, לפי הערך בשורה 222 של `Habait/engine/gates/fixtures/apt846.dims.json` (בודקים: `grep -n '"value_cm": 1\?99' Habait/engine/gates/fixtures/apt846.dims.json`):

**(ב) המפה אומרת 199: המצב הנוכחי (תוקן ב-2026-11-02 18:29:16), `exit=0`:**

```
        validate-plan.mjs exit 0
        plan_gate: PASS  score=0.784  worst_room=r-bath-guest  worst_dim_dev=41.0%
        negative control (r-living moved 10,10 cm): FAIL (as it must)  score=0.1
        -> ok  exit 0  gate PASS  $0.00  2.8 s  | plan of record from project.json units[].files.plan_json (hand-checked)
        building.py exit 0; units.json: OK against units.v0
        -> ok  exit 0  gate PASS  $0.00  15.1 s  | 1 unit box(es) in units.json
```

**(א) המפה אומרת 99 (כך היה עד 18:29; ההרצה הטרייה הראשונה נתקלה בזה), `exit=1`:**

```
        validate-plan.mjs exit 0
        plan_gate: FAIL  score=0.784  worst_room=r-bath-guest  worst_dim_dev=41.0%
        negative control (r-living moved 10,10 cm): FAIL (as it must)  score=0.1
        -> failed  exit 1  gate FAIL  $0.00  3.4 s  | plan of record from project.json units[].files.plan_json (hand-checked): plan_gate FAIL (worst room r-bath-guest)
        building.py exit 0; units.json: OK against units.v0
        -> ok  exit 0  gate PASS  $0.00  54.2 s  | 1 unit box(es) in units.json
```

הסיבה של (א): `plan_gate.py` משווה את הערכים המודפסים במפת המידות שלו, `Habait/engine/gates/fixtures/apt846.dims.json` (מפה שנקראה ביד בכרטיס 05), מול `printed_dimensions_cm` של `Habait/studio/fixtures/apt846.intake.json`, שתוקן ב-18:23 מ-99 ל-199. כל עוד המפה אמרה 99, אי-ההתאמה הכשילה את השער (`printed values match intake: False`) אף שכל החדרים עברו. **התכנית עצמה (`360walkaround/tours/apt846/plan.json`) לא אומרת 99 ולא צריכה תיקון.** אחרי התיקון: `printed values match intake: True`, ו-`199:sub_element` ברשימת ה-unchecked.

**מה עושים כש-plan נכשל (בכל פרויקט):**

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
$PY -c "import json,sys;g=json.load(open(sys.argv[1],encoding='utf-8'));print('pass',g['pass'],'| intake_note',g.get('intake_note','-')[:90]);print('BAD rooms:',[r['id'] for r in g['rooms'] if not r['pass']])" $P/plan/apt846/qa/plan_gate.json
```

1. מריצים עם `--keep-going` (כמו למעלה), כדי ש-building ושאר השלבים ירוצו ויתגלו גם הכשלים שלהם.
2. קוראים את דוח השער `$P/plan/apt846/qa/plan_gate.json` (הבלוק למעלה) ואת `report.json` של ה-intake (`$P/intake-vector/apt846/report.json`: מודפס מול נמדד לכל חדר).
   פלט צפוי: במצב (ב) `pass True | intake_note -` ו-`BAD rooms: []`; במצב (א) `pass False | intake_note map [99, 140, 160, ...] != in...` ו-`BAD rooms: []`.
3. מחליטים לפי השורה השנייה:
   - **`BAD rooms: []` ו-`intake_note` = `map [...] != intake [...]`** (מצב (א)): התכנית בסדר; הפער הוא בין שני קובצי עזר. רושמים בדוח "plan FAIL בגלל מפת המידות של השער, לא בגלל התכנית" וממשיכים.
   - **חדר ב-`BAD rooms`:** התכנית שגויה בחדר הזה. מתקנים במסך התיקון A2: `node Habait/engine/correct/serve.mjs --plan $P/intake-vector/apt846/plan.json --out $P/plan/apt846/corrected` ופותחים `http://127.0.0.1:8870/`. התיקון והאישור הם של אדם (אלירן); אחרי "אשר ושמור", שלב `plan` לוקח את `plan/apt846/corrected/plan.json` לבד. **סוכן לבד לא מפעיל את השרת** (הוא לא מסתיים): רושם בדוח "צריך A2 על <החדר>" וממשיך.

(השניות יכולות להשתנות: plan 1.5–7 ש', building 14–55 ש'.)

## 11. scene + clay בלי Blender

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
timeout 300 $PY -B Habait/engine/cli.py run $P --stage scene,clay --quiet; echo "exit=$?"
ls Habait/engine/_local/apt846-project/scene/apt846/renders/*/pano.webp | wc -l; grep -o '"verdict": *"[A-Z]*"' Habait/engine/_local/apt846-project/scene/apt846/renders/_render-tour.report.json | tail -1
```

צפוי: `scene [apt846]       DEFER ...`, `-> deferred  exit 0  $0.00  | plan staged; Blender build deferred to the Blender owner`, `clay [apt846]        DRYRUN ...`, `-> dry-run-only  exit 0  $0.00 ... | render_tour.mjs --dry-run exit 0 (nothing rendered)`, `exit=0`; ואז `11` ו-`"verdict": "PASS"`.

**Blender לא רץ כאן, וזה הצפוי** (כלל 6). אין למי לפנות ואין מה לחכות: הרנדר האמיתי של אותה תכנית כבר בדיסק, 11 פנורמות clay מהריצה של היום (17:15–17:27, exit 0, scene 20.3 ש', clay 699.4 ש'), ב-`Habait/engine/_local/apt846-project/scene/apt846/renders/`. בדוח רושמים: "scene/clay: נדחה (Blender לא בהרצה הזו); משתמשים בארטיפקטים שבדיסק (11 פנורמות, verdict PASS)".

## 12. skin: חייב לסרב

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
$PY -B Habait/engine/cli.py run $P --stage skin --quiet | grep -- "->"; echo "exit=${PIPESTATUS[0]}"
```

צפוי: `        -> refused  exit 3  $0.00  | REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $26.40, nothing was called`, אחריה שורת `qa        qa_report: <x>/<y> green -> ...qa.html` (גם בה יש `->`), ו-**`exit=3`**. זה הצפוי (שומר הכסף), לא פגם.

ספירת ה-`qa` כאן: **(ב) המפה 199 (נוכחי): `3/5 green`** (האדומים: שתי הטיוטות, advisory); **(א) המפה 99: `2/5 green`** (שתי הטיוטות + plan). אם צעד 10 רץ בלי `--keep-going` ו-building לא רץ: `1/4` במצב (א).

## 13. export: dist

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
timeout 600 $PY -B Habait/engine/cli.py run $P --stage export --quiet; echo "exit=$?"
```

צפוי: `-> ok  exit 0  gate PASS  $0.00  <6–14> s  | build_zip exit 0, zip 4.47 MB` ו-`exit=0`.

**export לא תלוי ב-plan או ב-building.** הוא אורז את פיקסטורת הפלטפורמה (`Habait/platform/fixtures/rainbow`) ואת הפנורמות המולבשות של הסיור הקיים, לא את התכנית או את ה-units.json של הריצה. לכן הוא עובר גם כש-plan נכשל, ו-dist שנוצר **לא מוכיח** ש-plan ו-building עברו. את זה בודק צעד 14 בנפרד.

## 14. בדיקת ה-dist, ובנפרד: plan ו-building

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
ls $P/dist/apt846; $PY -c "import zipfile,sys,os;z=zipfile.ZipFile(sys.argv[1]);print(len(z.namelist()),'entries',round(os.path.getsize(sys.argv[1])/1e6,2),'MB')" $P/dist/apt846/846.zip; test -s $P/dist/apt846/index.html && test -s $P/dist/apt846/apartment.json && echo DIST-OK
for s in plan/apt846 building; do test -s $P/$s/.stage.json && echo "STAMP-OK $s" || echo "NO-STAMP $s"; done
```

צפוי: `846.zip  apartment.json  assets  index.html  logs  media` (שורה אחת או כמה), `31 entries 4.69 MB`, `DIST-OK`; ואז שורות ה-stamp. stamp נכתב רק כשהשלב הסתיים `ok`:

- **(ב) המפה 199 (נוכחי):** `STAMP-OK plan/apt846` ו-`STAMP-OK building`.
- **(א) המפה 99:** `NO-STAMP plan/apt846` ו-`STAMP-OK building`.

`DIST-OK` עונה על "נוצר dist". שורות ה-stamp עונות על "plan ו-building עברו". בדוח מדווחים את שתיהן בנפרד.

## 15. ריצה חוזרת

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
timeout 900 $PY -B Habait/engine/cli.py run $P --stage intake,plan,building,scene,clay,export --keep-going --quiet | grep -E "^summary|^qa"; echo "exit=${PIPESTATUS[0]}"
```

- **(ב) המפה 199 (נוכחי):** `summary   skip 4 · defer 1 · dry-run-only 1 · ledger ...$0.00`, `qa        qa_report: 4/6 green -> ...`, `exit=0`. שני האדומים הם שתי הטיוטות (הווקטורית מצעד 5 והרסטרית מצעד 9), advisory.
- **(א) המפה 99:** `summary   skip 3 · run 1 · defer 1 · dry-run-only 1 · ledger ...$0.00`, `qa        qa_report: 3/6 green -> ...`, `exit=1`. plan לא כתב stamp, ולכן הוא רץ (ונכשל) שוב; כל השאר מדולג.
- אם `apt846.intake.json` השתנה בין צעד 9 לצעד 15, גם intake ירוץ שוב (`run 2`): הקובץ הוא קלט של ה-hash. זה תקין; רושמים בדוח.

## 16. ledger

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && P=Habait/engine/_local/fresh-846
$PY -B Habait/engine/cli.py status $P > $P/status.log 2>&1; echo "status exit=$?"; head -1 $P/status.log
```

צפוי: `status exit=0` (ה-exit של `cli.py status` עצמו) ו-`ledger Habait/engine/_local/fresh-846/ledger.json  project rainbow-tlv  spent $0.00  entries <N>`.

## 17. (רשות) הפלטפורמה המקומית

```bash
curl -s -o /dev/null -m 5 -w "%{http_code}\n" "http://127.0.0.1:8850/landing.html?project=rainbow&v=a"
```

צפוי: `200` אם השרת של הפלטפורמה רץ. `000` = השרת לא למעלה: **לא מרימים אותו**; רושמים "לא נבדק", וזה לא פגם בהרצה.

## 18. הדוח

כותבים את `Habait/engine/docs/fresh-run-report.md` (עברית, פקודות באנגלית):

- כותרת, תאריך ושעה (שעון המכונה, כלל 7), שם הסוכן, ותיקיית הפרויקט שבה רצתם.
- טבלה: צעד | exit בפועל | exit צפוי | השורה המרכזית מהפלט | מצב (א)/(ב) כשיש | תקין / פגם.
- שתי שורות נפרדות: "plan/building: <STAMP-OK/NO-STAMP לכל אחד, והסיבה מצעד 10>" ו-"dist: <DIST-OK או לא>".
- "דולג בכוונה": A2 (דורש אלירן), scene/clay (בלי Blender; ארטיפקטים מהדיסק), skin (שומר הכסף, exit 3).
- "שאלות שהייתי צריך לשאול": כל אחת = פגם בתיעוד, עם מספר הצעד. אם אין: "אין".
- "כסף": $0.
- **השורה האחרונה של הקובץ:** בדיוק `dist נוצר` אם צעד 14 הדפיס `DIST-OK`; אחרת `dist לא נוצר: <הסיבה>`.

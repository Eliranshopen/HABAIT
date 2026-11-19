# דוח הרצה טרייה: 846 מ-PDF עד dist

- תאריך: 2026-11-02, 18:20–18:25 (שעון המכונה). סוכן: runner בהקשר נקי (qa-reviewer), מורשה ל-$0 בלבד.
- תיקיית הפרויקט: `Habait/engine/_local/fresh-846` (לא היתה קיימת, `P-FREE`).
- נקראו רק: `CLAUDE.md`, `README.md` של המנוע, `add-a-project-he.md`, `fresh-run-checklist-he.md`, `swap-a-model-he.md` (קריאה בלבד). זמן כולל ~4 דקות (intake רסטר 117 ש' מתוכן).

## טבלת צעדים (בסדר ההרצה)

| צעד | פקודה (מקוצר) | exit בפועל | exit צפוי | שורה מרכזית / זמן | מצב |
|---|---|---|---|---|---|
| 1 | `ls` קלטים + `test -e $P` | 0 | 0 | `INPUTS-OK`, `P-FREE` | תקין |
| 2 | `validate_project.py ... --check-files` | 0 | 0 | `[OK] ...rainbow-846.project.json`, 0 ש' | תקין |
| 3 | `cli.py init $P --from ...` | 0 | 0 | `init: ... project rainbow-tlv ... (1 unit(s))`, 1 ש' | תקין |
| 4 | `intake_pdf_vector.py` | 0 | 0 | `6667 primitives after clipping (8636 drawings, 46 OCG layers, 0 text spans)`, `rooms: 10 (10 named, 0 unnamed), 6 virtual zone cuts`, 12 ש'; 5 הקבצים נוצרו | תקין |
| 5 | `validate-plan.mjs` | 0 | 0 | `note rooms 10 (indoor clear floor 91.75 m2 ...)` | תקין |
| 5 | `plan_gate.py --report ...` | 1 | 1 | `plan_gate: FAIL score=0.500 worst_room=r-guest-bathroom worst_dim_dev=3.3%`, 1 ש' | תקין (צפוי) |
| 6 | `correct/serve.mjs --selftest` | 0 | 0 | `ok input plan untouched (sha256 unchanged)`, `selftest OK`, 0 ש' | תקין |
| 7 | `cp` תשובות VLM ל-`$P/intake/` | 0 | 0 | שני הקבצים ב-`ls` | תקין |
| 8 | `cli.py run --stage all --dry-run` | 0 | 0 | שורות `file:` ב-vlm backend; `summary run 4 · defer 1 · dry-run-only 1 · refuse 2 ... $0.00`, 1 ש' | תקין |
| 9 | `cli.py run --stage intake` | 0 | 0 | `gate FAIL (advisory) ... 117.3 s ... dims_read 15, dims_total 16` | **סטייה**: 117 ש' (צפוי 60–81), `dims_read 15` (צפוי 14), ראו פגם 2 |
| 10 | `cli.py run --stage plan,building` | **1** | 0 | `plan_gate: FAIL score=0.784 worst_room=r-bath-guest` (צפוי `PASS`); `-> failed exit 1`; building: `not run: an earlier step failed` | **פגם 1** |
| 10ב | אותו דבר עם `--keep-going` (עקיפה שלי) | 1 | - | plan שוב `failed exit 1`; `building.py exit 0; units.json: OK against units.v0`, `-> ok exit 0 ... 27.9 s` | building עבר, plan נשאר אדום |
| 11 | `cli.py run --stage scene,clay` | 0 | 0 | `deferred exit 0`, `dry-run-only exit 0`; `11` פנורמות; `"verdict": "PASS"` | תקין |
| 12 | `cli.py run --stage skin` | 3 | 3 | `-> refused exit 3 ... estimate $26.40, nothing was called` | תקין (צפוי) |
| 13 | `cli.py run --stage export` | 0 | 0 | `-> ok exit 0 gate PASS $0.00 13.8 s \| build_zip exit 0, zip 4.47 MB` (רץ לפני 10ב, ראו פגם 3); בהרצה חוזרת אחרי 10ב: `SKIP` | תקין |
| 14 | `ls dist` + zip + `DIST-OK` | 0 | 0 | `846.zip apartment.json assets index.html logs media`, `31 entries 4.69 MB`, `DIST-OK` | תקין |
| 15 | הרצה חוזרת של כל השלבים | **1** | 0 | `summary skip 3 · run 1 · defer 1 · dry-run-only 1` (צפוי `skip 4`; plan הכושל ממשיך לרוץ); `qa_report: 3/6 green` (צפוי 4/6) | **פגם 1** (תוצאה שלו) |
| 16 | `cli.py status $P \| head -1` | 0 | 0 | `ledger ... project rainbow-tlv spent $0.00 entries 13` (ה-exit הוא של `head`, ראו פגם 5) | תקין |
| 17 | `curl :8850/landing.html?project=rainbow&v=a` | - | 200 | `200` | תקין |

## דולג בכוונה
- A2 (מסך התיקון האינטראקטיבי): דולג, דורש אלירן. נבדק רק החוזה (`--selftest`, צעד 6). שלב `plan` לקח את `units[].files.plan_json` (התכנית הבדוקה ביד), כמו שהצעד אמר.
- scene/clay: נדחו לבעל ה-Blender; נעשה שימוש בארטיפקטים שבדיסק ב-`apt846-project` (11 פנורמות, verdict PASS). לא הורץ Blender ולא Kaggle.
- skin/video: סורבו על ידי שומר הכסף (exit 3), כצפוי.

## פגמים בתיעוד / שאלות שהייתי צריך לשאול (ממוספר)

1. **checklist צעד 10 (וגם `add-a-project-he.md` סעיף 6, `README.md` "תיקיית פרויקט"/השערים)**: הצפוי `plan_gate: PASS score=0.784` + `-> ok exit 0` לא התקבל; בפועל `plan_gate: FAIL`, `-> failed exit 1`, ו-`building` לא רץ ("not run: an earlier step failed"). בלוג `plan/apt846/logs/plan_gate.log` מופיע `printed values match intake: False`, ובקוד `plan_gate.py` (שורות 290–295) אי-התאמה בין מפת המידות של התכנית לבין `printed_dimensions_cm` של `Habait/studio/fixtures/apt846.intake.json` מכשילה את השער. סיבה סבירה: קובץ הפיקסטורה הזה שונה (mtime 18:23:13, במהלך ההרצה שלי; ביקש ממנו תיקון 99→199 לפי `README.md` פגם 6), והתכנית הבדוקה ביד (`360walkaround/tours/apt846/plan.json`) עדיין מפיקה 99. שהתיעוד מתאר את הפיקסטורה כ"תוקנה חלקית" ולא מזהיר שתיקון מלא שובר את שלב `plan`. השאלה שהייתי צריך לשאול: האם לתקן את ה-GT, להחזיר את הפיקסטורה, או לעקוף? אין הנחיה. כל מי שמריץ את הצעד כתוב יתקע ב-exit 1 וב-`building` שלא רץ. (עקיפה שלי: `--keep-going`; `building` עבר.)
2. **checklist צעד 9**: `dims_read 15` במקום 14, וזמן 117.3 ש' במקום 60–81 (הטווח "עד 2 דקות" מכסה את הזמן, אבל לא כתוב שהמספר 14 תלוי בפיקסטורה). אותו מקור כמו פגם 1 (הפיקסטורה השתנתה). לא נכתב ב-checklist מה לעשות כשהמספר אחר.
3. **checklist, סדר צעדים 10 → 13**: `export` (צעד 13) רץ ועבר (`exit 0`, ZIP) בזמן ש-`plan` היה אדום ו-`building` לא רץ. השלב `export` לא תלוי בהצלחת השלבים הקודמים, ולכן ה-dist נוצר ו-`DIST-OK` מודפס גם כשצעד 10 נכשל. ה-checklist לא אומר שה-`DIST-OK` של צעד 14 לא מוכיח ש-plan/building עברו; הדוח הזה מדווח את שניהם בנפרד.
4. **checklist צעד 12**: ה-checklist מצפה שורת `qa` עם `->`; אחרי כשל צעד 10 ה-qa מציג `1/4 green`, ואין הסבר מה המספרים. פגם משני של פגם 1; גם הצפוי בצעד 15 (`qa 4/6`, `skip 4`) לא מתקבל (`3/6`, `skip 3 · run 1`, exit 1).
5. **checklist צעד 16**: `echo "exit=$?"` אחרי `| head -1` מדפיס את ה-exit של `head`, לא של `cli.py status`. (צעד 5 ו-6 משתמשים ב-`PIPESTATUS`; כאן לא.) מינורי.
6. **README.md "השלבים"/checklist כלל 3**: התיעוד מצטט את השורה `Blender is owned by another session (SESSIONS.md: habait-98)` ומפנה ל-`SESSIONS.md`, אותו הוריתי לא לקרוא. הסוכן הטרי לא יודע מה זה habait-98/SESSIONS.md. לא חוסם, אבל מפר את הטענה "בלי לשאול אף אחד" (מסמך שמפנה אל קובץ חיצוני לא מוגדר).
7. **add-a-project-he.md סעיף 0 מול checklist**: `HABAIT_BLENDER_OK` / `HABAIT_ALLOW_SPEND` / `HABAIT_CAP_USD` ו-`unset` מופיעים רק ב-checklist; ב-add-a-project אין אזהרה לבטל אותם. מי שיש לו אותם בסביבה (אחרי הרצה קודמת) ירוץ אחרת. מינורי.
8. **README.md (טבלת "זמנים") / שעון**: `date` של Git Bash מדפיס JST (18:20), בעוד חותמות הקבצים והלוגים הן +02:00 (18:23). אי-התאמה של 3 שעות פורמלית; לא משפיע, אבל כשהתיעוד אומר "17:15–17:27" אי אפשר להתאים לשעון המכונה.

## קבצים שנוצרו
- `Habait/engine/_local/fresh-846/` : `project.json`, `intake-vector/apt846/{overlay.png,plan-crop.png,plan.json,report.json,report.md,plan_gate.json}`, `intake-vector.log`, `intake-vector.validate.log`, `intake/` (גם פלט הרסטר + תשובות VLM), `plan/apt846/` (`plan.json`, `qa/`, `logs/`), `building/` (`units.json`), `scene/apt846/plan.json`, `dryrun.log`, `ledger.json`, `qa.html`, `dist/apt846/{index.html,apartment.json,846.zip (31 entries, 4.69 MB),assets,media,logs}`.
- הדוח הזה. לא נכתב דבר ב-`Habait/platform/_local/dist/` (ה-checklist לא ביקש).

## כסף
$0 (`ledger.json`: `spent $0.00`, 13 שורות). לא הורץ paid call, `claude -p`, Blender או Kaggle. לא נעשה שימוש ב-git.

## סיכום
dist נוצר והמבנה שלו תקין (`DIST-OK`), אבל הצעד המתועד כ"plan PASS" (צעד 10) נכשל ב-exit 1 בגלל שינוי בפיקסטורה של הקלט ב-18:23; השלמתי את `building` עם `--keep-going`. הטענה "הדוקס מספיקים בלי לשאול אף אחד" נתמכת חלקית: כל הצעדים רצו, אבל צעד 10 דורש החלטה שלא מתועדת.

dist נוצר

# habait-bench: בנצ'מרק חי למודלים חדשים (כרטיס 29, E2)

כשיוצא מודל חדש ב-fal (בערך כל חודשיים): פקודה אחת מריצה אותו על **אותם קלטים קבועים של דירה 846** בשלושה מסלולים, מודדת בשערים של $0, ובונה דף השוואה בעברית מול כל מה שנבדק לפניו. זה מה שהופך את המנוע לאגנוסטי למודל. העטיפה יושבת על הבנצ'מרק של habait-89 (`C:\RnD\Projects\Habait\research\fal-bench-2026-11-02`, קריאה בלבד) ולא משנה אותו.

## פקודות

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe
$PY Habait/engine/bench/habait_bench.py --list                                           # מה ה-registry מכיר
$PY Habait/engine/bench/habait_bench.py fal-ai/nano-banana-2/edit --tracks keyframe,flyover,pano --dry-run   # $0, בלי רשת
$PY Habait/engine/bench/habait_bench.py <endpoint> --tracks keyframe,flyover,pano --cap 10 --i-approve       # בתשלום, רק אחרי אישור של אלירן לריצה הזו
$PY Habait/engine/bench/habait_bench.py <endpoint> --gates-only                          # חישוב מחדש של המדדים על הפלטים שבדיסק ($0)
$PY Habait/engine/bench/habait_bench.py --rebuild-page --from /c/RnD/Projects/Habait/research/fal-bench-2026-11-02 --out Habait/engine/_local/bench/page.html
$PY Habait/engine/bench/habait_bench.py --selftest                                       # השערים על clay-כפלט: חייבים לעבור ($0)
```

קודי יציאה: 0 תקין, 1 שער או קריאה נכשלו, 2 שימוש שגוי / קלט חסר / endpoint לא מוכר, **3 נדחה ע"י שומר הכסף**.

## שלושת המסלולים (הקלטים לא משתנים, כדי שכל מודל יהיה בר-השוואה לקודמים)

| מסלול | קלט קבוע | קריאות | מדדים ($0) | עובר אם |
|---|---|---|---|---|
| keyframe | פריים 1 של ה-clay `ext-enter` של ה-Studio (1280×720, עם id/depth/camera) + 3 חיתוכי הסיור של 89 כרפרנס לוק | 1 | `kf_check.py` לפי מחלקה + `openings_gate.py` | קירות, זיגוג ודלתות ≥ 0.9 כל אחד, ו-openings_gate PASS, וכל דלת/חלון kept ≥ 0.60 ו-shift ≤ 2° |
| flyover | 6 פריימי equirect של טיסת ה-approach (Kaggle, כרטיס 18), פזורים שווה | 6 | `kf_check.py` לכל פריים על חיתוך ה-view_hint (clay מול פלט) + עקביות בזמן | kf_check PASS בכל פריים; יחס העקביות מדווח (1.0 = הפלט משתנה בדיוק כמו הגאומטריה; הרבה מעל 1 = ריצוד) |
| pano | פנורמת ה-clay של cp-living (2048×1024) + אותם 3 חיתוכי סיור | 1 | `openings_gate.py` במצב פנורמה + תפר 360 של 89 | openings_gate PASS + כלל הדלתות, ותפר ≤ פי 1.5 מתפר ה-clay |

- **מדד התפר** הוא בדיוק של 89: `seam()` מתוך `research/fal-bench-2026-11-02/score_e.py` (ממוצע ההפרש המוחלט בין 8 העמודות השמאליות ל-8 הימניות). הפונקציה נטענת מהקובץ של 89 עצמו (מקומפלת לבד, כי הסקריפטים של 89 עובדים בזמן import), ולכן הדף משחזר את המספרים שלו: מקור 11.0, GPT 10.7, Seedream 20.7.
- **עקביות בזמן** = ממוצע |פלט_t+1 − פלט_t| חלקי ממוצע |clay_t+1 − clay_t|, על ה-equirect ב-1024×512.
- **הפרומפטים**: "Keep image 1 exactly as framed, change only the grey materials" + חיתוכי הסיור (פרומפט שמתאר את הסצנה מדמיין אותה מחדש). לוק הפנים = סגנון הסיור (אבן גיר, בוקלה קרם, טרוורטין, bulthaup), הכרעת אלירן 1.11. בלי מיתוג של היזם (D-WQ-18).
- **הפלטים** נשמרים ב-`Habait/engine/_local/bench/<endpoint עם __ במקום />/<מסלול>/out/<שם>/out.png` (שם בלי ספרות: openings_gate קורא `--out` דרך VideoCapture), עם `call.json`, צילום של הקלטים (`inputs/`) ו-`metrics.json`. פלט קיים מדולג, כך שריצה חוזרת ממשיכה מאיפה שנעצרה.

## כסף (נאכף בקוד)

- ריצה בתשלום דורשת **את כולם**: `--cap <usd>` (עד $10 לריצה, תקרת הכרטיס), `--i-approve` (אלירן אישר **את הריצה הזו** בצ'אט של סשן הלוח, היום habait-1d; ראו SESSIONS.md), אומדן הריצה בתוך התקרה, probe של fal (`storage/auth/token`), ושורה ב-ledger **לפני** כל קריאה. חסר משהו: יציאה 3, לפני קריאת המפתח ולפני כתיבה כלשהי.
- ה-ledger: `Habait/engine/_local/ledger-E2.json` (`cap_usd` 10 לריצה, `calls[]` עם `run_id`, `model`, `cost`, `inputs_hash`, `status`, `output_sha256`). נכתב ב-ASCII (הקונסולה ב-cp1255).
- הרשת סגורה (שומר על `socket`) בכל מצב חוץ מריצה מורשית; `fal_call()` היא הקוד היחיד שמייבא את `fal_client`, והיא מסרבת בלי ריצה מורשית ובלי שורת ledger בסטטוס `started` של אותה ריצה.
- `FAL_KEY` נקרא לפי שם מ-`.env`, לא מודפס, ולא נקרא בכלל ב-`--dry-run`.

## הוספת מודל חדש

1. רשומה ב-`registry.json`: `input_keys`, `output_keys`, `price` (סוג: `flat` / `by_resolution` / `per_mp`, **עם התאריך שבו נבדק המחיר**), `tracks`, `takes_reference_images`. הסכמה של endpoint: `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>`.
2. אם הבקשה היא prompt + image_urls + image_size רגילים: `"adapter": "base"` ודי. אחרת קובץ ב-`adapters/` (דוגמאות: `flux_pro_depth.py` מצייר מפת עומק כ-control; `qwen_edit_2511.py` מוסיף את ה-LoRA של כרטיס 12).
3. `--dry-run`, אישור של אלירן, ריצה, `--rebuild-page`.

## מגבלות ידועות

- במסלול הריחוף אין מספרים לפי מחלקה: פריימי Kaggle בלי pass של id. kf_check שם שופט קצוות + best_shift בלבד, עם plan ריק, כי מ-200 עד 500 מ' הפתחים של דירה אחת קטנים מפיקסל.
- `openings_gate.py` במצב פנורמה לא תפס סיבוב של 3° בבקרה השלילית (shift של הדלת דווח כ-0.62°, ו-railing ב-2.99° עבר בגלל "kept ≥ 0.75"). מה שהכשיל את הפנורמה המסובבת היה התפר. במסלול ה-keyframe אותו שער העביר repaint של Qwen Image 3 (kept 0.897), ורק המספרים לפי מחלקה של kf_check הכשילו אותו. לכן שני המדדים יחד, והעין של אלירן נשארת חלק מהקבלה (D-WQ-12).
- המחירים הם מחירון fal מ-2.11.2026 (fal לא מחזיר חיוב). לבדוק מחדש לפני ריצה ולעדכן את `checked`.
- מסלולי וידאו (v2v) לא נתמכים: אין וידאו במוצר (פיבוט 2.11). המסלול הוא פריימים בודדים.

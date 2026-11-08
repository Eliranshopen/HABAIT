# איך מחליפים מודל (או בודקים מודל חדש)

המנוע אגנוסטי למודל: הגאומטריה מגיעה מהתכנית ומה-clay, והמודל רק צובע (D-WQ-10/17). כשיוצא מודל חדש ב-fal (בערך כל חודשיים), בודקים אותו על **אותם קלטים קבועים של 846** בשלושה מסלולים, מודדים בשערים של $0, משווים בדף מול כל מה שנבדק לפניו, ואלירן מכריע. רק אחרי הכרעה משנים את ההגדרה של מודל הרשומה, ורק בקבצים של הבעלים שלהם.

הכלי: `Habait/engine/bench/habait_bench.py` (כרטיס 29). הפרטים המלאים: [`../bench/README-he.md`](../bench/README-he.md). כל פקודה כאן רצה היום (2026-11-02), חוץ ממה שמסומן "לא הורץ עדיין".

**סימונים:** **[אלירן]** = צריך את אלירן. **[$]** = עולה כסף: תקרה כתובה + אישור של אלירן לריצה הזו, בצ'אט של הסשן שמריץ (אישור מצ'אט אחר לא תקף).

## 0. סביבה

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8
PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe
$PY -B Habait/engine/bench/habait_bench.py --list
```

צפוי: 5 שורות, אחת לכל endpoint שה-registry מכיר (`openai/gpt-image-2.5/sunburst/edit`, `fal-ai/nano-banana-2/edit`, `fal-ai/flux-pro/v1/depth`, `fal-ai/qwen-image-edit-2511`, `fal-ai/qwen-image-edit-2511/lora`), כל אחת עם `tracks keyframe,flyover,pano` ו-`price ... (checked 2026-11-02)`; exit 0.

## 1. רשומה ב-`registry.json`

קובץ: `Habait/engine/bench/registry.json` (`habait.bench-registry/0.1`). רשומה לכל endpoint:

| שדה | מה |
|---|---|
| `label`, `role` | שם לתצוגה, ולמה בודקים אותו |
| `adapter` | שם המודול ב-`adapters/` (`base` למודל עם בקשה רגילה) |
| `input_keys`, `output_keys` | המפתחות שהאדפטר ממלא; איפה ה-URL של התמונה בתשובה (למשל `images[0].url`) |
| `takes_reference_images` | האם המודל מקבל תמונות לוק (תמונות 2..n) |
| `price` | `flat` (`usd`) / `by_resolution` (`usd: {"1K":…, "2K":…}`) / `per_mp` (`usd_per_mp`, `plus`), **עם `checked` = התאריך שבו נבדק המחיר** ו-`source`. fal לא מחזיר חיוב, ולכן ה-ledger רושם את האומדן הזה |
| `tracks` | `keyframe`, `flyover`, `pano` |
| `quirks`, `evidence` | מגבלות ידועות; איפה ראינו שה-endpoint קיים |

הסכמה של endpoint ב-fal: `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>`. לבדוק את המחיר מחדש לפני כל ריצה ולעדכן `checked`.

## 2. אדפטר (רק אם הבקשה לא סטנדרטית)

- מודל שהבקשה שלו היא `prompt` + `image_urls` + `image_size`: מספיק `"adapter": "base"` ברשומה. שום קובץ חדש.
- אחרת: קובץ חדש `Habait/engine/bench/adapters/<name>.py`, מחלקה שיורשת מ-`Adapter` של `adapters/base.py`, ובסוף `ADAPTER = <Class>`. ה-registry טוען אותו לפי `"adapter": "<name>"` (`importlib`). מה דורסים:
  - `args(job)`: גוף הבקשה. תמונות מסומנות במחזיקי מקום (`@clay`, `@ref2`…) שמועלים ב-`fal_call()`.
  - `out_size(job)`: גודל הפלט, בשביל המחיר וכדי שהשערים יקטינו נכון.
  - `prepare(job, run_dir)`: עיבוד מקומי ב-$0 בזמן ריצה אמיתית, למשל control של עומק (ראו `flux_pro_depth.py`).
  - `prompt_mode`: איזה פרומפט המודל מקבל (`edit_refs` / `edit_text` / `t2i`).
  - `available()`: לסרב מראש כשחסר משהו (למשל LoRA שלא אומן; ראו `qwen_edit_2511.py`).
- דוגמאות קיימות: `nano_banana_2.py` (`aspect_ratio "auto"` ל-equirect, כי `"2:1"` נדחה), `flux_pro_depth.py` (מפת עומק כ-control), `qwen_edit_2511.py` (+ ה-LoRA של כרטיס 12), `gpt_image_25.py`.
- **הקלטים והפרומפטים לא משתנים בין מודלים** ("Keep image 1 exactly as framed, change only the grey materials" + חיתוכי הסיור כלוק), אחרת אי אפשר להשוות. בלי מיתוג של היזם בפרומפטים או בתמונות (D-WQ-18).

## 3. `--dry-run` ($0, בלי רשת)

```bash
timeout 300 $PY -B Habait/engine/bench/habait_bench.py fal-ai/nano-banana-2/edit --tracks keyframe,flyover,pano --dry-run
```

- צפוי: לכל מסלול רשימת קריאות עם הבקשה (בלי גוף הפרומפט), הקלטים עם sha256, והשערים שירוצו אחרי; ובסוף `estimated_cost_total $0.92  (card 29 cap $10.00 per run; within the cap)`, `network: none (socket closed); FAL_KEY: not read; spent $0`; exit 0. ה-ledger לא משתנה (sha256 של `Habait/engine/_local/ledger-E2.json` זהה לפני ואחרי; נבדק היום).
- אותו dry-run למודל הרשומה (GPT Image 2.5) = הבסיס שכל מודל נמדד מולו: `estimated_cost_total $9.60` (keyframe $1.20, ריחוף 6 × $1.20, פנורמה $1.20).

| מסלול | קלט קבוע | קריאות | עובר אם |
|---|---|---|---|
| keyframe | פריים 1 של ה-clay `ext-enter` של ה-Studio (עם id/depth/camera) + 3 חיתוכי סיור | 1 | `kf_check.py`: קירות, זיגוג ודלתות ≥ 0.9 כל אחד; `openings_gate.py` PASS; כל דלת/חלון kept ≥ 0.60 ו-shift ≤ 2° |
| flyover | 6 פריימי equirect של טיסת ה-approach (Kaggle, כרטיס 18) | 6 | kf_check PASS בכל פריים; יחס עקביות בזמן מדווח בלבד |
| pano | פנורמת ה-clay של cp-living + אותם חיתוכים | 1 | openings_gate + כלל הדלתות + תפר 360 ≤ פי 1.5 מתפר ה-clay |

## 4. שומר הכסף (נבדק היום)

ריצה בתשלום דורשת את **כולם**: `--cap <usd>` (עד $10 לריצה), `--i-approve`, אומדן בתוך התקרה, probe של fal, ושורת ledger בסטטוס `started` לפני כל קריאה. חסר משהו → exit 3, לפני קריאת המפתח ולפני כל כתיבה:

```bash
$PY -B Habait/engine/bench/habait_bench.py fal-ai/nano-banana-2/edit --tracks keyframe;        echo "exit=$?"
$PY -B Habait/engine/bench/habait_bench.py fal-ai/nano-banana-2/edit --tracks keyframe --cap 2; echo "exit=$?"
```

צפוי: `REFUSED (exit 3, nothing sent, ledger untouched): no --cap <usd>. ...` ואז `REFUSED (exit 3, nothing sent, ledger untouched): no --i-approve (...)`; exit 3 בשתיהן. (ההודעה אומרת "the board session's chat (habait-1d today; see SESSIONS.md)".)

## 5. ריצה מאושרת **[$] [אלירן]**: לא הורץ עדיין

1. אלירן מאשר **את הריצה הזו** (endpoint + סכום) בצ'אט של הסשן שמריץ. אישור מצ'אט אחר לא תקף.
2. חשבון fal הוא prepaid וננעל כשהיתרה נגמרת (HTTP 403 "Exhausted balance"). `habait_bench.py` עושה probe לפני הקריאה הראשונה, ופלט שכבר קיים מדולג, כך שריצה חוזרת ממשיכה מאיפה שנעצרה.
3. הפקודה (**לא הורץ עדיין**; ב-ledger-E2 אין אף קריאה):

   ```bash
   $PY -B Habait/engine/bench/habait_bench.py <endpoint> --tracks keyframe,flyover,pano --cap <usd <= 10> --i-approve
   ```

4. הפלטים: `Habait/engine/_local/bench/<endpoint עם __ במקום />/<track>/out/<name>/out.png` + `call.json` + `metrics.json` + `inputs/`. ה-ledger: `Habait/engine/_local/ledger-E2.json` (ASCII, כי הקונסולה ב-cp1255).
5. חישוב מחדש של השערים על פלטים שבדיסק, ב-$0: `$PY -B Habait/engine/bench/habait_bench.py <endpoint> --gates-only` (**לא הורץ עדיין**: אין פלטים).
6. בדיקה שהשערים עצמם עובדים, ב-$0: `$PY -B Habait/engine/bench/habait_bench.py --selftest` (רץ היום בכרטיס 29: clay כפלט → PASS; repaint של Qwen כ-keyframe → FAIL; פנורמה מסובבת ב-3° → FAIL. לא הורץ מחדש בכרטיס 31, כי הוא כותב ל-`Habait/engine/_local/bench/_selftest/`).

## 6. הדף

```bash
timeout 300 $PY -B Habait/engine/bench/habait_bench.py --rebuild-page --from /c/RnD/Projects/Habait/research/fal-bench-2026-11-02 --out Habait/engine/_local/bench/page.html
```

צפוי: `page: Habait/engine/_local/bench/page.html  cards A=11 B=11 C=10 E nodes=2  media 53 files 37.0 MB  pano seam (89's seam()): source 11.0, nano-banana-2 5.6, gpt-image-2.5__baseline 10.7, ...`, exit 0, 2 ש'. הדף בעברית: כרטיס לכל מודל בכל מסלול מתוצאות הבנצ'מרק של 2.11, ולשונית "ריצות habait-bench" שמתמלאת אחרי ריצה אמיתית. (בכרטיס 31 נבנה מחדש ל-`--out` זמני, אותה תוצאה.)

## 7. הכרעה **[אלירן]**

- המספרים לא מספיקים לבד: `openings_gate` לא תפס סיבוב של 3° בפנורמה והעביר repaint של Qwen (kept 0.897). מה שתפס: kf_check לפי מחלקה ותפר ה-360. לכן **העין של אלירן היא חלק מהקבלה** (D-WQ-12).
- ההחלטה היא שאלת T1 לאלירן: אפשרויות + ברירת מחדל. **ברירת המחדל היום: נשארים ב-GPT Image 2.5** (המודל היחיד ששמר על הגאומטריה האווירית בנודים החיצוניים; Seedream 5 Pro שובר את תפר ה-360 בלי close-seam).
- ההחלטה נרשמת כהחלטה ממוספרת בקובץ התכנית הרלוונטי, ושורת זיכרון עוברת לסשן המפעיל (רק הוא עורך את `C:\RnD\Projects\Habait\memory.md`).

## 8. איפה מוגדר מודל הרשומה (מה משנים אחרי הכרעה)

אין מקום אחד. כל כלי מחזיק את ה-endpoint והמחיר שלו. **לא עורכים קובץ של סשן אחר**: שולחים לבעלים (`SendMessage`) את ההחלטה + המחיר + השורה לשנות.

| איפה | מה מוגדר שם | בעלים |
|---|---|---|
| `Habait/tour360/tools/gen-pano.mjs`, הטבלה `MODELS` | פנורמות הסיור: `gpt25x` = `openai/gpt-image-2.5/sunburst/edit` 4096×2048, נרשם $2.40; גם `gpt25`, `gpt25xx`, `seedream5` ואחרים. מודל חדש = רשומה חדשה בטבלה (endpoint, usd, body) | habait-98 |
| `Habait/tour360/tools/skin-frame.mjs` (שורה 34) | `ENDPOINT = 'openai/gpt-image-2.5/sunburst/edit', USD = 1.2` (skin על clay) | habait-98 |
| `Habait/tour360/tools/close-seam.mjs` (שורה 41) | אותו endpoint, `USD = 2.4` (סגירת תפר 360) | habait-98 |
| `Habait/studio/pipeline/stages/keyframes.mjs` (שורות 53–54) | keyframes של ה-Studio: `gpt` (GPT 2.5, $1.20, 1920×1080) או `nano` (`fal-ai/nano-banana-2/edit`, $0.08) | habait-98 |
| `Habait/studio/pipeline/stages/video.mjs` (שורה 46) | ברירת מחדל `fal-ai/ltx-2.3-quality/render-to-real` (וידאו מושהה: אין וידאו במוצר) | habait-98 |
| `Habait/flyover/skins-extra/skin_nodes.py` (שורה 26) | skins של נודי החוץ לאפייה: `ENDPOINT = "openai/gpt-image-2.5/sunburst/edit"` | habait-1d |
| `Habait/engine/stages/paid.py` | שלבי `skin`/`video` של המנוע: `PANO_USD = 1.20`, `FLIGHT_USD = 3.20`, ותבנית `gen-pano.mjs ... gpt25x`. **אומדן בלבד; לא מחווט (exit 4).** האומדן ($1.20) לא תואם ל-`gpt25x` ($2.40) | habait-1d |
| `Habait/engine/experiments/panos-cheap/run.py` (שורה 57), `experiments/look-lock/ab.py` (שורות 107–110) | הניסויים של כרטיסים 11 ו-12 (Seedream; GPT / FLUX Depth / Qwen + LoRA) | habait-1d |
| `Habait/engine/bench/registry.json` | `"role": "model of record ..."` ברשומת GPT 2.5: תווית לדף בלבד; לעדכן אחרי הכרעה | habait-1d |

לפני כל הוצאה על keyframe עם המודל החדש, בכל אחד מהכלים האלה, מריצים את השער של $0: `C:\RnD\Projects\Habait\tools\bench\kf_check.py`. כל הוצאה נרשמת ב-ledger של הבעלים (גבולות ותקרות: `C:\RnD\Projects\Habait\SESSIONS.md`, טבלת "כסף").

## סיכום

| צעד | פקודה | עלות | מי | רץ היום? |
|---|---|---|---|---|
| רשימה | `habait_bench.py --list` | $0 | כל סשן | כן (כרטיס 31) |
| רשומה + אדפטר | עריכת `registry.json` / `adapters/<name>.py` | $0 | habait-1d | 5 רשומות + 4 אדפטרים נכתבו בכרטיס 29 |
| dry-run | `habait_bench.py <ep> --tracks keyframe,flyover,pano --dry-run` | $0 | כל סשן | כן ($0.92 ל-Nano Banana 2, $9.60 ל-GPT 2.5) |
| ריצה | `... --cap <usd> --i-approve` | ≤ $10 לריצה | **[אלירן]** | לא הורץ עדיין |
| שערים מחדש | `... --gates-only` | $0 | כל סשן | לא הורץ עדיין |
| דף | `habait_bench.py --rebuild-page --from ... --out ...` | $0 | כל סשן | כן |
| הכרעה | שאלת T1 | | **[אלירן]** | פתוחה (כרטיס 29: א לא להריץ עכשיו / ב Nano Banana 2 $0.92 / ג GPT 2.5 $9.60; ברירת מחדל א) |
| הגדרה | הטבלה בסעיף 8 | | הבעלים של כל קובץ | |

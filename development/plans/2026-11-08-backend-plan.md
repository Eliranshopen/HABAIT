# תכנית ה-backend של מערכת ההדמיות
<!-- 2026-11-08 · main session · research plan: 2026-11-08-backend-integrations-models-research.md · parent: 2026-11-08-visualization-stack-architecture.md -->

**למי:** אלירן, וכל מפתח שיצטרף.
**עמוד לקריאה:** https://claude.ai/artifact/6mZtm2ofVc91JKTQCkb4Wt#backend (לשונית Backend בעמוד המאוחד)
**היקף (אלירן, 2026-11-08):** מערכת ההדמיות בלבד. קונים צופים באופן אנונימי, בלי חשבון. אין חיוב. אין התממשקות למערכות של היזם (webhooks, CRM) בשלב הזה.
**עדכון אלירן (2026-11-08):**
- **מאפס:** ארכיטקטורה מאפס.
- **היקף יעד:** 10–100 פרויקטים בחודש.
- **בלי חשש מתלות:** התלות ב-Vercel לא רלוונטית.

**ההשלכות:**
- **מסלול B0–B8 (§13) הוא רק הפניה.** בונים ישר את מצב היעד: `ai_ledger` בטבלה מהיום הראשון, ו-Workflow עם webhooks של fal, בלי שלב ביניים של JSON jobs.
- **בהיקף הזה,** GPU לפי דרישה עולה בערך $50–300 לחודש. בודקים מחדש שרת GPU קבוע רק בהיקף גבוה יותר.

**מה זה לא:** החלטה. בחירת ספק בתשלום, שאלות משפטיות (רישוי מודלים) ומעבר בפועל מחכים להחלטה של אלירן ול-board נפרד (§6, §7).

**איך נאסף:** מיפוי כל הקריאות החיצוניות בקוד הקיים (Explore) ושני סוכני מחקר רשת, אחד למודלים ולספקים ואחד לשכבת האינטגרציה. מחירים נלקחו מדפי הספקים ב-2026-11-08. מה שלא אומת מסומן **(לא מאומת)**.

---

## 0. התשובה הקצרה

ה-backend הוא **שני מישורים וחוזה אחד ביניהם**, כפי שנקבע במסמך הסטאק. מה שנוסף כאן הוא איך כל חלק בנוי:

| חלק | הבחירה | למה, במשפט |
|---|---|---|
| **API** | REST ב-Next.js route handlers + zod, ו-server actions לטפסי הפורטל | שפה אחת עם ה-frontend. REST כי גם Python צריך לדבר איתו (לא tRPC) |
| **מסד נתונים** | Supabase Postgres. מיגרציות ב-SQL נקי (`supabase/migrations`). types נוצרים ל-TS ול-Python | SQL לא שייך לשפה אחת, ושני המישורים קוראים את אותן טבלאות |
| **תזמור** | Vercel Workflow: כל דירה היא run עם צעדים ועצירות לאישור | עצירה לאישור אנושי, בלי תקרת זמן, ו-hooks ל-webhooks של fal |
| **Workers** | Python ב-Docker. שני images: `pipeline-cpu` ו-`pipeline-gpu` (Blender 4.5 + CUDA) | Blender ו-PDF הם Python. כל worker הוא CLI שמקבל קלט וכותב artifact |
| **שכבת AI** | חבילה פנימית אחת, `@habait/ai` (TS), עם adapter לכל ספק, ledger ו-cache. ב-Python adapter דק רק כשאין ברירה | היום יש שלושה עותקים של `falLLM` וקריאות מפוזרות. כאן כל קריאה בתשלום עוברת בדלת אחת |
| **ספקי מודלים** | **שילוב:** fal לתמונה ולוידאו. **ישירות** ל-Anthropic ול-Google בשביל vision, LLM והסוכן | fal מנצח ברוחב ובתור משותף. ישירות זה זול יותר, בלי עמלה ובלי חסימת קרדיט |
| **שמירת גיאומטריה** | בנויה במבנה עצמו: מעבירים מ-Blender מפות depth, normal ו-mask, מחזירים את הפיקסלים המבניים כמו שהם, ואז fidelity gate | prompt לבד נותן הבטחה הסתברותית. compositing נותן הבטחה קשיחה |
| **עלויות** | טבלת `ai_ledger` ב-Postgres עם מפתח ייחודי לכל קריאה: reserve, אחר כך call, אחר כך settle | אף ספק לא נותן idempotency לחיוב, אז בונים אותו בעצמנו (§5, §7) |
| **אחסון** | שלושה buckets: `sources` (מקורות, לא משתנים), `work` (קבצי ביניים, נמחקים אוטומטית), `published` (CDN, לפי hash) | מקור לא נוגעים בו (§4), וסיור שפורסם לא משתנה |
| **ניטור** | Sentry לשגיאות, Langfuse Cloud (חינם) למעקב AI, ו-`job_steps` + `ai_ledger` כתיעוד ביקורת | מינימום תפעול למפתח יחיד |

**שלושה ממצאים שאפשר לפעול לפיהם מיד:**
1. **חסימת fal ‏(403 TOP_UP) נובעת משיטת החיוב, לא מהספק.** ב-fal יש חיוב בחשבונית ללקוחות בנפח גבוה, וחשבון כזה לא ננעל אוטומטית (fal FAQ, 2026-11-08). זה התיקון הזול ביותר לכאב שעצר עבודה ב-2026-11-05.
2. **קריאת התוכנית עוברת היום דרך fal → OpenRouter → Claude.** ישירות ל-Anthropic חוסכים עמלת ביניים, נמנעים מחסימת קרדיט ומשגיאת "Reasoning is mandatory", ומקבלים Batch בחצי מחיר.
3. **Nano Banana 2.1 ישירות מ-Google עולה $0.034 לתמונת 1K. ‏Nano Banana 2 דרך fal עולה $0.08.** אלה גרסאות שונות, אז צריך לבדוק איכות לפני מעבר.

---

## 1. מה ה-backend עושה (מסלול של דירה אחת)

```
העלאה → קריאת spec → [אישור יזם] → trace → [אישור יזם] → build (מצלמות, ריהוט)
      → render (GPU) → skin (AI restyle) → fidelity gate → package → publish → CDN
                                                         ↘ נכשל → תיקון / עצירה
צפייה: קונה אנונימי → CDN (סטטי) · שינוי עיצוב חי → /api/tour-edit (מוגבל ומתוקצב)
```

לכל צעד יש קלט עם hash, artifact, שורת manifest וסטטוס בטבלת `job_steps`. צעד שכבר הושלם עם אותו hash לא רץ שוב ולא מחויב שוב (§5).

---

## 2. המודולים

| מודול | שפה | איפה רץ | אחריות |
|---|---|---|---|
| `apps/web` → `app/api/*` | TS | Vercel | פרויקטים, דירות, העלאה, אישורים, סטטוס, פרסום, live edit |
| `apps/web` → `workflows/unit-pipeline.ts` | TS | Vercel Workflow | ה-state machine של הדירה, העצירות לאישור, ההפעלה של workers, קריאות AI |
| `packages/ai` (`@habait/ai`) | TS | בתוך web ו-workflow | adapters ל-fal, Anthropic, Google ו-OpenAI. ledger, cache, אימות webhooks, model registry |
| `packages/schemas` | JSON Schema | — | החוזים: plan, job, manifest-row, ledger-row, scenes, tour-package |
| `services/pipeline` (`habait_pipeline`) | Python | Docker על RunPod/Modal (GPU), Sandbox או Docker (CPU) | trace legs, build_scene, render_pano, tiles, package |
| `services/pipeline/habait_ai` | Python | בתוך ה-worker | adapter דק, **רק** אם צעד Python חייב קריאה בתשלום. אותה טבלת ledger |

**מי עושה מה:** TS מבצע את כל הקריאות בתשלום שמתחילות מ-job, כולל התור של fal, ה-LLM, ה-ledger וה-webhooks. Python מבצע את החישוב ומייצר artifacts. ל-workers אין מפתחות AI שהם לא צריכים. הם מקבלים signed URLs לאחסון.

---

## 3. מודל נתונים ומיגרציות

**הטבלאות** (מסמך הסטאק §4, עם תוספות):
- **ליבה:** `orgs` · `members` · `projects` · `buildings` · `units` · `source_files` · `plans` · `jobs` · `job_steps` · `artifacts` · `manifest_rows` · `tours` · `audit_log`
- **חדש:** `ai_ledger` (key ייחודי, vendor, model, estimate, actual, request_id, status reserved/settled/failed)
- **חדש:** `model_registry` (id, vendor, task, price source, license, enabled)
- **חדש:** `live_edits` (tour_id, session hash, model, cost, result_uri). בלי מידע אישי.

**מיגרציות:**
- SQL נקי ב-`supabase/migrations/` (Supabase CLI).
- `supabase gen types typescript` ל-TS. ב-Python, pydantic מתוך `packages/schemas`.
- למה לא ORM של שפה אחת (Prisma/Drizzle): שני מישורים כותבים לאותן טבלאות, ו-SQL הוא המכנה המשותף (המלצה שלי, לא נבדקה במחקר).

**הרשאות:**
- RLS לפי `org_id` מה-claim של Clerk.
- ה-workers ניגשים עם service role, כך שכל שאילתה חייבת לסנן לפי `job_id`.

---

## 4. API

| קבוצה | נתיבים (דוגמה) | מי | הערה |
|---|---|---|---|
| פרויקטים ודירות | `GET/POST /api/projects`, `/api/units/:id` | יזם (Clerk) | zod בכניסה וביציאה |
| העלאה | `POST /api/uploads` → signed upload URL | יזם | PDF בלבד, תקרת גודל, נכנס ל-`sources` ולא משתנה |
| אישורים | `POST /api/units/:id/approve-spec`, `/approve-trace` | יזם | `resumeHook` ל-Workflow |
| סטטוס | `GET /api/jobs/:id` (polling, ובהמשך SSE) | יזם | נקרא מ-`job_steps` |
| פרסום | `POST /api/units/:id/publish` | יזם | בודק disclosure (§6) לפני שהסיור עולה ל-`published` |
| webhooks נכנסים | `POST /api/hooks/fal`, `/api/hooks/worker` | fal / worker | אימות חתימה (fal: ED25519, ‏JWKS), ואחריו `resumeHook` |
| live edit | `POST /api/tour-edit` | קונה אנונימי | rate limit, תקרה יומית ב-`ai_ledger`, בלי מידע אישי |
| צפייה | **לא API**: חבילה סטטית מה-CDN | קונה אנונימי | `published/tours/<hash>/` |

**למה REST ולא tRPC:** ה-worker ב-Python מדבר עם ה-API (callbacks), ו-tRPC עובד רק ב-TS.

---

## 5. תזמור (Vercel Workflow)

- **run אחד לכל דירה.** הצעדים: `read_spec` → `hook: approve_spec` → `trace` → `hook: approve_trace` → `build` → `render` → `skin` → `fidelity_gate` → `package` → `publish`.
- **עצירה לאישור:** `createHook` עם token דטרמיניסטי (`approve:<unit>:<plan_version>`). הנתיב שלנו מאמת את היזם וקורא ל-`resumeHook`.
- **עבודה ארוכה** (render, ‏fal): הצעד **מפעיל** ומחכה ל-hook. הוא לא רץ בעצמו. Workflow לא מגביל את משך הריצה, אבל לכל צעד יש מגבלת function.
- **retries:**
  - צעד חינמי: retry עם backoff.
  - צעד בתשלום: **אף פעם לא נשלח מחדש.** אם יש `request_id` פתוח, ממשיכים לפי `request_id` (status/fetch).
  - שגיאת חיוב (402/403/429 של spend cap): לא עושים retry. ה-job נכשל בקול.
- **גיבוי אם Workflow לא בשל:** Trigger.dev (נייד, אפשר להריץ אצלנו).
- **עכשיו:** ה-JSON jobs + Sandbox ממשיכים לעבוד (‏`studio-web/api/_dispatch.mjs`). המעבר הוא B3.

---

## 6. Workers (Python)

- **ממשק אחד:** `habait-step <step> --job <id> --in <signed-url-manifest> --out <signed-url-prefix> --callback <url+token>`
- **כל ריצה:**
  1. מורידה את הקלט.
  2. מחשבת `inputs_hash`.
  3. אם יש artifact עם אותו hash, מדלגת.
  4. אחרת מריצה, מעלה, כותבת שורת manifest וקוראת ל-callback.
- **Images:**
  - `pipeline-cpu`: pymupdf, ezdxf, OpenCV, tiles.
  - `pipeline-gpu`: Blender 4.5, CUDA/OptiX, ‏`build_scene.py`, ‏`render_pano.py`.
- **פלט חדש מ-Blender** לטובת שמירת הגיאומטריה: depth, normal ו-mask סגמנטציה (קיר, חלון, דלת, רצפה, אזור מותר לריהוט) לכל מצלמה. Blender מייצר את כולם במדויק.
- **ספק GPU:** RunPod serverless או Modal (מסמך הסטאק §3.8). ‏L4 בכ-$0.75 לשעה, ‏4090 בכ-$1.34 לשעה ב-RunPod serverless (runpod.io/pricing, 2026-11-08).

---

## 7. מודלים וספקים: מה נכון לכל משימה

### 7.1 מה יש היום (מיפוי)
- **fal:** כמעט כל משימת תמונה (skin, finishes, seam, catalog, live edit), וידאו (Kling, ‏LTX), ‏depth ל-gate, ו-Claude דרך `openrouter/router/vision`. הקריאות הן raw fetch סינכרוני, בלי webhooks.
- **OpenRouter:** ‏Gemini 3.7 Flash לשופטים, ל-trace ולבדיקות (`chat-transport.mjs`).
- **Anthropic SDK:** ‏intake ב-`studio/lib/llm.mjs`, ‏`claude-opus-5-5` כברירת מחדל.
- **שונות:** MyArchitectAI (`studio/tools/maai.py`) ו-Kaggle לניסויים.
- **ledger:** קבצי `ledger.json` לפי דירה או פרויקט, עם reserve ו-settle. ‏cache לפי hash כבר קיים ב-gen-pano, ‏finish-pano, ‏close-seam ו-Kling.

### 7.2 שלוש דרכים להגיע למודל

| דרך | יתרון | חיסרון |
|---|---|---|
| **fal (aggregator)** | מפתח אחד, תור ו-webhooks, וידאו, החלפת מודל = שינוי מחרוזת. ‏FLUX 2 זול יותר שם ($0.012/MP מול $0.03 ב-BFL) | prepaid ננעל (פתרון: חשבונית). אין idempotency key. המחיר לא אחיד מול ישיר |
| **ישירות לספק** | בלי עמלה, Batch בחצי מחיר, בקרת הוצאה אצל הספק, מודלים חדשים מוקדם (NB 2.1) | מפתח וחשבון לכל ספק, וקוד adapter לכל אחד |
| **Gateway** | Vercel AI Gateway: ‏0% markup, ‏auto-reload, ‏fallbacks, תקציבים. ‏OpenRouter: ‏5.5% | התקציב ב-Gateway הוא soft cap: הבקשה שחוצה את הסף עדיין עוברת. לא מכסה את התור של fal |
| **מודל פתוח אצלנו (GPU)** | הבטחת גיאומטריה קשיחה (ControlNet + mask), ‏$0.01–0.02 לתמונה | תפעול. **רישוי:** משפחת FLUX dev/Kontext dev היא Non-Commercial ודורשת רישיון מ-BFL. ‏Qwen-Image-Edit ו-FLUX.2 klein 4B הם Apache 2.0 |

### 7.3 ההמלצה לכל משימה

| משימה | דרך | ראשי | גיבוי | עלות ליחידה |
|---|---|---|---|---|
| **קריאת תוכנית (vision)** | **ישירות ל-Anthropic** | Claude Sonnet 5.5 ($2/$10 ל-MTok) | Gemini Flash ישירות, כקורא שני | ~$0.01–0.05 לעמוד (הערכה) |
| **שופטים ובדיקות טקסט** | **ישירות ל-Google** (או AI Gateway) | Gemini Flash | Haiku 5.5 | זניח |
| **Restyle (skin)** | **fal עכשיו**, ובדיקת NB 2.1 ישירות | המודל שעובר את ה-gate (היום ב-`tour360/fidelity.json`) | GPT Image 2.5 | ~$0.03–0.08 לתמונה |
| **Restyle עם הבטחה קשיחה** | **מודל פתוח אצלנו, בהמשך** | Qwen-Image-Edit / FLUX.2 klein 4B עם depth/mask מ-Blender + composite | SDXL ControlNet | ~$0.01–0.02 (בלי זמן הקמה) |
| **קטלוג רהיטים** | fal | Seedream 4.5 / Nano Banana | — | ~$0.04 |
| **וידאו** | fal | Kling / Seedance / Veo / LTX, לפי brief | — | לפי דף המודל |
| **סוכן וצ'אט** | **ישירות ל-Anthropic** | Sonnet 5.5 | Haiku 5.5 לתורות זולות | $2/$10 ל-MTok |
| **live edit של קונה** | fal | ‏Kontext / NB edit (קיים) | ‏fallback מתועד ב-manifest | תקרה יומית |

**חשוב על fallback בתמונה:** מעבר למודל אחר משנה את התוצאה, וזה שובר דטרמיניזם ואת כלל ההתאמה לתוכנית המכר. fallback הוא החלטה שנרשמת ב-manifest, לא החלפה שקטה.

**קריאת תוכנית, מה ידוע:** ב-AECV-Bench (ינואר 2026) ספירת דלתות וחלונות עדיין לא פתורה (דיוק 0.40–0.55), וקריאת מידות מודפסות טובה יותר. מכאן: שני קוראים, בדיקה מול המידות המודפסות (זה מה שקיים היום), ו-eval על golden set ‏(846, Maale) עם `--budget`.

### 7.4 שמירת גיאומטריה כבר במבנה
1. Blender מייצא לכל מצלמה depth, normal, edges ו-mask סגמנטציה.
2. המודל מקבל conditioning (ControlNet depth/canny), או inpaint רק על אזור הריהוט.
3. **Composite:** הפיקסלים של קירות, חלונות, דלתות וגבול הרצפה חוזרים מהרינדור המקורי כמו שהם.
4. ה-fidelity gate הקיים (`tour360/tools/fidelity-gate.mjs`, ‏≤1–2% לחדר) מאמת.

זה עובד עם כל מודל, סגור או פתוח, והופך את כלל ה-add-only (§6) מבקשה ב-prompt להבטחה.

---

## 8. שכבת ה-AI: `@habait/ai`

**מה נכנס בה:**
- **model registry אחד** (`models.json` → טבלת `model_registry`) במקום `image-models.mjs`, ה-`MODELS` ב-`handler.mjs`, ‏`chatFetch` ושלושת העותקים של `falLLM`.
- **adapters:** ‏`fal` (queue + webhook + `X-Fal-Billable-Units`), ‏`anthropic`, ‏`google`, ‏`openai`. אופציה: Vercel AI SDK כבסיס ל-LLM, עם `wrapImageModel` middleware ל-ledger.
- **middleware:** redaction (אף פעם לא מפתחות, headers או תמונות בלוג; רק hashes), timeout, ו-retry רק על status/fetch.

**הזרימה של קריאה אחת בתשלום:**
1. `key = sha256(vendor, model, model_version, canonical inputs)`
2. חיפוש ב-cache או ב-manifest לפי `key`. אם נמצא, מחזירים את ה-artifact. **‎$0.**
3. הערכת עלות: ממחירון fal (`api.fal.ai/v1/models/pricing`), או מהערכת tokens.
4. טרנזקציה: `insert into ai_ledger (key, job_id, estimate, status='reserved') on conflict do nothing`, יחד עם בדיקת cap של ה-job.
   - soft cap: עצירה ודיווח לאלירן.
   - hard cap: סירוב.
5. conflict אומר שמישהו אחר כבר מבצע את הקריאה. מחכים לתוצאה שלו.
6. הקריאה עצמה.
   - fal: submit עם `webhook_url`. שומרים `request_id` מיד, ואז `await hook("fal:"+request_id)`.
   - LLM: קריאה סינכרונית עם timeout.
7. `/api/hooks/fal` מאמת ED25519, דוחה timestamp שסוטה ביותר מ-300 שניות, שומר את התוצאה ו-`resumeHook`. אותו `request_id` יכול להגיע פעמיים, אז זה idempotent.
8. הורדת התוצאה מיד (ה-CDN של fal שומר ≥7 ימים, וה-payload של ה-webhook פג תוקף מהר), שמירה תחת hash ושורת manifest.
9. עלות בפועל: `X-Fal-Billable-Units` × מחיר יחידה, או `usage.cost`. ‏`status='settled'`. התראה אם עברנו את ההערכה.
10. קריאה שנכשלה נסגרת על 0 או על הסכום שחויב. **אף פעם לא נשלחת מחדש** עם `request_id` פתוח.

**עוד:**
- **Gateway:** לא שירות שלנו. ‏Vercel AI Gateway רק כ-upstream אופציונלי ל-LLM, וה-cap האמיתי נשאר ב-`ai_ledger`.
- **Python:** אם צעד Python חייב קריאה בתשלום, `habait_ai` עושה אותה דרך אותה טבלה (פונקציית DB אחת). לא משכפלים את לוגיקת ה-cap.

---

## 9. אחסון

| Bucket | תוכן | גישה | חיים |
|---|---|---|---|
| `sources` | PDF/DXF מקוריים, לפי sha256 | פרטי | לעולם לא משתנה ולא נמחק (§4) |
| `work` | רינדורים, passes, skins, ניסיונות | פרטי, signed URLs ל-workers | נמחק אוטומטית אחרי N ימים (N הוא החלטה) |
| `published` | חבילת סיור: tiles, ‏`scenes.json`, ‏manifest | ציבורי דרך CDN, ‏`immutable` | גרסה שפורסמה לא משתנה. גרסה חדשה מקבלת hash חדש |

- **ספק:** Supabase Storage עכשיו (`studio-web/api/_store.mjs` כבר adapter). ‏R2 ל-`published` כשה-egress יגדל (מסמך הסטאק §3.10).

---

## 10. אבטחה ופרטיות

**איזה מידע יש לנו** (תשובה ל"נתונים של מה?"):
- **תוכניות מכר של יזמים:** מידע עסקי רגיש, לא מידע אישי.
- **חשבונות יזמים:** שם ומייל. מוחזקים ב-Clerk.
- **רינדורים וסיורים.**
- **קונים: אין מידע אישי** (צפייה אנונימית). ב-`live_edits` נשמר רק hash של session.

**מה זה אומר:** כמעט אין מידע אישי, אז מיקום הנתונים הוא העדפה ולא חובה. ההמלצה: אזור EU ל-Supabase, קרוב לישראל (לא נבדק משפטית). אם יזם ידרוש שהתוכניות שלו יישבו בישראל, חוזרים לשאלה.

**כללים:**
- סודות רק ב-env של כל פלטפורמה (Vercel, RunPod/Modal). שמות ב-`SECRETS-LEDGER.md`. אין מנהל סודות שלישי עד שיש 3 מקומות או יותר.
- webhook נכנס תמיד עם אימות חתימה. ה-token של Workflow הוא לא אימות.
- העלאה: PDF בלבד, תקרת גודל, ו-parse בתוך worker, לא ב-function של ה-API.
- live edit אנונימי: rate limit לפי IP/session, תקרה יומית, וקוד גישה (קיים: `TOUR_EDIT_CODE`).
- מפתחות שנשרפו (OWED-013, ‏OWED-027) נשארים לפי החלטת אלירן, ומסומנים כסיכון.

---

## 11. ניטור

- **Sentry:** שגיאות ב-TS וב-Python.
- **Langfuse Cloud Hobby:** חינם, 50K units לחודש. traces של prompts ותשובות, בלי תמונות, רק hashes. בהמשך Core ב-$29 לחודש.
- **`job_steps` + `ai_ledger`:** התיעוד המלא: מה רץ, כמה עלה ומה הוחזר.
- **התראות:** job תקוע מעבר לזמן הצפוי, הוצאה מעבר ל-soft cap, אחוז כשלון ב-fidelity gate, יתרה נמוכה אצל ספק.

---

## 12. סביבות, בדיקות וגיבוי

- **סביבות:**
  - **local:** עם mock ל-AI (קיים: `HABAIT_LLM_BACKEND=mock`, ‏`HABAIT_FAL_BASE`).
  - **preview:** פרויקט Supabase נפרד ל-dev.
  - **prod.**
- **בדיקות:**
  - unit.
  - contract: הקוד המיוצר תואם ל-`packages/schemas`.
  - golden eval לקריאת תוכנית ול-trace (‏`research/auto-trace-2026-11-04/fixtures-846/`, ‏Maale), תמיד עם `--budget`.
  - regression ל-fidelity gate.
- **CI:** אין remote (git מקומי בלבד, §11), אז סקריפט `pre-merge` מקומי מריץ את הכל לפני merge ל-`main`.
- **גיבוי:**
  - Supabase Pro: גיבוי יומי.
  - `sources` לא משתנה.
  - `published` מבוסס hash.
  - כל סיור אפשר לבנות מחדש מה-manifest.

---

## 13. מסלול המעבר של ה-backend

| שלב | מה | עלות | תלוי ב |
|---|---|---|---|
| **B0** | **חיוב בחשבונית ב-fal** (פנייה ל-sales), ובדיקת יתרה לפני כל קריאה | $0 | **החלטת אלירן** |
| **B1** | `packages/ai`: model registry אחד, ‏adapters, איחוד שלושת ה-`falLLM` ו-`chatFetch`. ה-ledger עדיין בקבצים | $0 | — |
| **B2** | Anthropic ו-Google ישירות לקריאת תוכנית, לשופטים ולסוכן, ו-golden eval מול המצב הקיים | ~$1–3 eval | **החלטת אלירן** (חשבונות) |
| **B3** | Postgres: ‏`jobs`, ‏`job_steps`, ‏`ai_ledger` ‏(unique key), ‏`model_registry`. ה-ledger עובר מקבצים לטבלה | Supabase Pro | מסמך הסטאק P2 |
| **B4** | Vercel Workflow + ‏webhooks של fal (במקום sync fetch) + עצירות לאישור | $0 | B3 |
| **B5** | Blender מייצא depth, normal ו-mask, ועוד composite של פיקסלים מבניים לפני ה-gate | $0 | — |
| **B6** | GPU worker ‏(`pipeline-gpu`), ‏benchmark של פנורמה אחת | $1–5 | **החלטת אלירן** |
| **B7** | ניסוי במודל פתוח (Qwen-Image-Edit / FLUX.2 klein) עם conditioning מ-B5, מול ה-gate | ~$5 | **החלטת אלירן** + B5, B6 |
| **B8** | שלושת ה-buckets ומחיקה אוטומטית של `work` | $0 | B3 |

כל שלב הוא board משלו, עם worktree ב-`.wt/` ו-QA cards בסוף (§8.7, §8.9).

---

## 14. שאלות להחלטת אלירן

1. **fal בחשבונית:** לפנות ל-sales? זה פותר את החסימה בלי להחליף ספק.
2. **חשבונות ישירים ל-Anthropic ול-Google:** לפתוח? (B2)
3. **Vercel AI Gateway ל-LLM:** כן או לא? הוא חוסך עמלות, אבל התקציב שלו soft, ולכן ה-cap שלנו נשאר הקובע.
4. **רישוי FLUX dev/Kontext dev** לשימוש מסחרי אצלנו: לבדוק מול BFL, או להישאר עם Apache (Qwen, klein)? זו שאלה משפטית.
5. **כמה זמן לשמור קבצי `work`** לפני מחיקה (30/90 יום)?
6. **אזור הנתונים:** EU כברירת מחדל, אלא אם יזם דורש ישראל.

---

## מקורות (נבדקו ב-2026-11-08)
- **fal:** https://fal.ai/pricing · https://fal.ai/docs/model-apis/faq · https://fal.ai/docs/model-endpoints/queue · https://fal.ai/docs/model-endpoints/webhooks
- **OpenAI:** https://developers.openai.com/api/docs/pricing
- **Google:** https://aistudio.google.com/docs/pricing
- **Anthropic:** https://platform.claude.com/docs/en/about-claude/pricing · https://platform.claude.com/docs/en/api/errors
- **BFL:** https://bfl.ai/pricing · https://help.bfl.ai/articles/3670520907-can-i-use-the-api-for-a-commercial-application · https://huggingface.co/black-forest-labs/FLUX.2-dev/blob/main/LICENSE.txt
- **Qwen:** https://huggingface.co/Qwen/Qwen-Image-Edit-2511
- **Gateways:** https://openrouter.ai/pricing · https://openrouter.ai/docs/guides/guides/usage-accounting · https://vercel.com/docs/ai-gateway · https://vercel.com/docs/ai-gateway/pricing · https://vercel.com/docs/ai-gateway/observability-and-spend/budgets
- **AI SDK:** https://ai-sdk.dev/docs/ai-sdk-core/image-generation
- **Workflow:** https://workflow-sdk.dev/docs/foundations/hooks
- **GPU:** https://replicate.com/pricing · https://www.runpod.io/pricing
- **ניטור:** https://langfuse.com/pricing
- **קריאת תוכניות:** https://arxiv.org/abs/2601.04819v1 (AECV-Bench, רק snippets נקראו)

**ראיות מהריפו** (תחת `Projects/Habait/habait-walkaround/Habait/`):
- **שכבות AI ותזמור:** `tour360/tools/image-models.mjs`, ‏`tour360/server/handler.mjs`, ‏`chat-transport.mjs`, ‏`studio/lib/llm.mjs`, ‏`studio-web/api/_studio.mjs`, ‏`_dispatch.mjs`.
- **עלויות ו-gate:** `tour360/tools/file-ledger.mjs`, ‏`engine/stages/paid.py`, ‏`tour360/tools/fidelity-gate.mjs`, ‏`tour360/fidelity.json`.
- **חסימת fal:** `tour360/CLAUDE.md:77`.

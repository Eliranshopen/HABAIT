# משימה 29: E2: bench חי: bench.py של habait-89 כשירות: endpoint חדש → 3 המסלולים (keyframe / ריחוף / פנורמה) → דף השוואה בפקודה אחת

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | E |
| **מקור בתכנית** | חלק ג §2 ערוץ E, שלב E2; עקרון 5 (אגנוסטי למודל) ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `genai-look` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T1** |
| **גל (wave)** | 6 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

כשיוצא מודל חדש (כל חודשיים): פקודה אחת `habait-bench <fal-endpoint> --tracks keyframe,flyover,pano` שמריצה את אותם קלטים קבועים של 846 (clay keyframe, clay flight, clay equirect), מודדת (kf_check per-class, openings_gate, seam diff), ובונה דף השוואה כמו של 89. זה מה שהופך את המנוע לאגנוסטי למודל.

## תלויות

- `C:\RnD\Projects\Habait\research\fal-bench-2026-11-02\{bench.py,run_fal.py,build_page.py}` (של habait-89: **קריאה בלבד**; העטיפה נכתבת ב-engine ומתואמת איתו ב-SendMessage)

## קלטים (קריאה)

- הבנצ'מרק של 89 (README: מה נמדד, איך נבנה הדף)
- קלטים קבועים: `research/fal-bench-2026-11-02/inputs/`
- gates ב-`C:\RnD\Projects\Habait\tools\bench\`

## קבצים (הסוכן כותב רק כאן)

- `Habait/engine/bench/{habait_bench.py,adapters/*.py,page.py,README-he.md}`
- `Habait/engine/_local/bench/<endpoint>/**`
- `Habait/engine/_local/ledger-E2.json`

## צעדים

1. אדפטר לכל endpoint (schema של fal: input keys, מחיר); registry JSON.
2. `--dry-run`: מראה את הקריאות והעלות המוערכת בלי לשלוח.
3. ריצה אמיתית רק עם `--cap` ואישור; תוצאות → מדדים → דף.
4. לתאם עם 89: הודעה שמודיעה על העטיפה ושואלת אם משהו ב-bench.py ישתנה.

## קריטריוני קבלה

- [ ] `--dry-run` על endpoint ידוע (Nano Banana 2) מפרט 3 מסלולים ועלות מוערכת.
- [ ] דף השוואה נבנה מתוצאות קיימות של 89 (בלי כסף) כהוכחה שהצינור עובד.
- [ ] ledger + תקרה נאכפים בקוד.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 300 $PY Habait/engine/bench/habait_bench.py fal-ai/nano-banana-2/edit --tracks keyframe,flyover,pano --dry-run && timeout 300 $PY Habait/engine/bench/habait_bench.py --rebuild-page --from /c/RnD/Projects/Habait/research/fal-bench-2026-11-02 --out Habait/engine/_local/bench/page.html
# צפוי: dry-run עם 3 מסלולים + estimated_cost; page.html נבנה; $0 הוצאו
```

**Reviewer scope:** אכיפת תקרה בלבד: אין נתיב קוד ששולח קריאה בלי --cap.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

**תקרה $10 לריצה**, ledger `Habait/engine/_local/ledger-E2.json`, אישור אלירן לכל ריצה; הכרטיס עצמו: ריצת dry-run בלבד ($0) אלא אם אלירן מאשר.

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

_(genai-look, habait-4b, 2026-11-02 ~17:50 שעון המכונה; dry-run בלבד, $0)_

- **מצב:** DONE (שלושת קריטריוני הקבלה מתקיימים; T1 פתוח: ריצה אמיתית ראשונה, ראו למטה).
- **מה נעשה:**
  - `habait_bench.py <endpoint> --tracks keyframe,flyover,pano [--dry-run] [--cap usd --i-approve]` + `--rebuild-page --from --out`, `--gates-only`, `--selftest`, `--init-ledger`, `--list`. קודי יציאה: 0 / 1 שער או קריאה נכשלו / 2 שימוש או קלט חסר / **3 נדחה ע"י שומר הכסף**.
  - **registry.json** עם 5 endpoints: לכל אחד input keys, output keys, מודל מחיר עם `checked: 2026-11-02` ומקור, והמסלולים הנתמכים. ה-endpoints: `openai/gpt-image-2.5/sunburst/edit` (flat $1.20), `fal-ai/nano-banana-2/edit` (1K $0.08 / 2K $0.12), `fal-ai/flux-pro/v1/depth` ($0.05/MP+$0.005), `fal-ai/qwen-image-edit-2511` ($0.03/MP+$0.005), `fal-ai/qwen-image-edit-2511/lora` ($0.035/MP+$0.005, ה-LoRA של כרטיס 12). ה-id `fal-ai/nano-banana-2/edit` קיים: 89 קרא לו ב-2.11 (`A-keyframe/nano-banana-2.png.json`, `C-pano/…`) וקיבל `images[0].url`, ולכן לא היה צורך ב-WebFetch. המחירים לקוחים מ-PRICES של 89 ומ-REPORT של כרטיס 12, ולא נבדקו מחדש ברשת ($0).
  - **אדפטרים** (`adapters/`): base (גנרי: prompt + image_urls + image_size; endpoint חדש עם סכמה רגילה צריך רק רשומה ב-registry), gpt_image_25, nano_banana_2 (`aspect_ratio "auto"` ל-equirect), flux_pro_depth (control = עומק near-bright ליניארי כמו בכרטיס 12, או ה-clay RGB לפריימי Kaggle שאין להם עומק), qwen_edit_2511 (+lora).
  - **המסלולים והקלטים הקבועים** (קריאה בלבד, נשמר sha256 לכל קלט, ובריצה אמיתית מועתקים ל-`inputs/` של הריצה):
    - keyframe: פריים 1 של `ext-enter` של ה-Studio, עם id/depth/camera, ו-3 חיתוכי הסיור של 89. **הכרעה (T0):** בחרתי בו ולא בחיתוך ה-90° של cp-living מכרטיס 12, כי רק ל-ext-enter יש pass של id. בלעדיו kf_check לא מוציא מספרים לפי מחלקה, וזה גם הקלט של מסלול A של 89.
    - flyover: 6 פריימי equirect מטיסת ה-approach (Kaggle, כרטיס 18). על כל פריים kf_check על חיתוך ה-view_hint (clay מול פלט), ובנוסף עקביות בזמן = mean|out_t+1−out_t| / mean|clay_t+1−clay_t|.
    - pano: `cp-living/pano.webp`. openings_gate במצב פנורמה + **מדד התפר של 89: `score_e.py::seam`**. הפונקציה נטענת מהקובץ של 89 עצמו דרך ast, כי הסקריפטים של 89 מבצעים עבודה בזמן import. משחזר את המספרים של 89 בדיוק: מקור 11.0, GPT 10.7, Seedream 20.7.
  - **כלל המעבר:** keyframe = קירות/זיגוג/דלתות ≥ 0.9 **וגם** openings_gate PASS **וגם** כל דלת/חלון kept ≥ 0.60 ו-shift ≤ 2°. pano = openings_gate + אותו כלל דלתות + תפר ≤ פי 1.5 מה-clay. flyover = kf_check PASS לכל פריים; יחס העקביות מדווח בלבד.
  - **אכיפת כסף בקוד:** ריצה אמיתית דורשת `--cap` (0 עד 10) **וגם** `--i-approve` **וגם** אומדן בתוך התקרה **וגם** probe של fal **וגם** שורת ledger בסטטוס `started` לפני כל קריאה. `fal_call()` היא הקוד היחיד שמייבא את fal_client, והיא מסרבת בלי ריצה מורשית ובלי השורה הזו. הרשת סגורה בכל מצב אחר (שומר על socket), ו-FAL_KEY לא נקרא ב-dry-run. נבדק: בלי --cap / בלי --i-approve / cap 25 / אומדן $9.60 מעל cap 2: כולם exit 3 וה-ledger זהה ב-sha. קריאה ישירה ל-`fal_call` נזרקת, ו-`socket.create_connection` נזרק.
  - **selftest ($0):** clay כפלט בשלושת המסלולים → PASS (kf 1.0, shift 0, temporal 1.0, seam = clay 1.3). **בקרה שלילית ($0):** ה-repaint של Qwen Image 3 מ-89 כ-keyframe → FAIL (kf_check: walls .876, glazing .725, doors .691). פנורמה מסובבת ב-3° → FAIL (תפר 4.9 מול 1.3, קצוות .45/.56).
  - **הדף** נבנה מתוצאות 89 ב-$0: 46 כרטיסים (A 11, C 10 + תפר מחושב, E 14 בשני נודים, B 11 לרשומה) + לשונית "ריצות habait-bench" (ריקה). `build_page.py` של 89 לא יובא כי הוא כותב ל-`site/` שלו בזמן import; `page.py` משלי קורא את ה-JSON ואת ה-previews שלו.
- **קבצים שנכתבו:** `Habait/engine/bench/{habait_bench.py,page.py,registry.json,README-he.md}`, `Habait/engine/bench/adapters/{__init__,base,gpt_image_25,nano_banana_2,flux_pro_depth,qwen_edit_2511}.py`, `Habait/engine/_local/ledger-E2.json` (cap_usd 10, calls []), `Habait/engine/_local/bench/{page.html,page-data.json,media/ (53 קבצים, 37 MB)}`, `Habait/engine/_local/bench/_selftest/**` (selftest + בקרה שלילית). לא נכתב כלום תחת `research/**` או `tools/bench/**` (נבדק עם find -newer). __pycache__ לא נוצר.
- **פלט ה-Check (מילה במילה):**
```
$ cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 300 $PY Habait/engine/bench/habait_bench.py fal-ai/nano-banana-2/edit --tracks keyframe,flyover,pano --dry-run && timeout 300 $PY Habait/engine/bench/habait_bench.py --rebuild-page --from /c/RnD/Projects/Habait/research/fal-bench-2026-11-02 --out Habait/engine/_local/bench/page.html
habait-bench DRY-RUN  endpoint fal-ai/nano-banana-2/edit  (Nano Banana 2 (Google) edit; adapter nano_banana_2)
price model: {"type": "by_resolution", "usd": {"1K": 0.08, "2K": 0.12}, "checked": "2026-11-02"}  source: 89: build_page.py PRICES '$0.08 (2K: $0.12)', ledger-A/C rows

== track keyframe
   call kf-s1: POST fal-ai/nano-banana-2/edit  -> Habait/engine/_local/bench/fal-ai__nano-banana-2__edit/keyframe/out/kf-s1/out.png  [est $0.080]
      request: {"prompt": "<1121 chars>", "image_urls": ["@clay", "@ref2", "@ref3", "@ref4"], "resolution": "1K", "aspect_ratio": "16:9", "output_format": "png"}
      input shot/frame_0001.png    C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/renders/clay/ext-enter/frame_0001.png  sha256 3397ae5da6f4b212
      input shot/camera.json       C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/renders/clay/ext-enter/camera.json  sha256 3bdc1971122199b3
      input shot/depth_0001.exr    C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/renders/clay/ext-enter/depth_0001.exr  sha256 1a0a9081d76d38b0
      input shot/depthcm_0001.png  C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/renders/clay/ext-enter/depthcm_0001.png  sha256 b34eb42127077ccf
      input shot/id_0001.png       C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/renders/clay/ext-enter/id_0001.png  sha256 cc8e44b1d827b6b5
      input plan                   C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/derived/plan.json  sha256 931eb9b3fccac80f
      input ref2                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/tour-living-yaw0.png  sha256 84e1437ba34d8d31
      input ref3                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/tour-living-yaw70.png  sha256 d65d426559f4b71f
      input ref4                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/tour-living-yaw-70.png  sha256 b407caf8e3b77530
   gates after the calls ($0): kf_check.py (walls/glazing/doors >= 0.9) + openings_gate.py (kept >= 0.60, shift <= 2 deg)
   track keyframe: 1 calls, estimated_cost $0.08

== track flyover
   call fly-f0001: POST fal-ai/nano-banana-2/edit  -> Habait/engine/_local/bench/fal-ai__nano-banana-2__edit/flyover/out/fly-f0001/out.png  [est $0.120]
      request: {"prompt": "<989 chars>", "image_urls": ["@clay", "@ref2", "@ref3"], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}
      input clay                   C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/frames/frame_0001.png  sha256 7009d9b426915f58
      input camera                 C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/camera.json  sha256 12bf1fe1d97492dd
      input ref2                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_aerial_f1.png  sha256 7474f86bbd4a279f
      input ref3                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_tower_f83.png  sha256 7a8487ebe8463e7e
   call fly-f0010: POST fal-ai/nano-banana-2/edit  -> Habait/engine/_local/bench/fal-ai__nano-banana-2__edit/flyover/out/fly-f0010/out.png  [est $0.120]
      request: {"prompt": "<989 chars>", "image_urls": ["@clay", "@ref2", "@ref3"], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}
      input clay                   C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/frames/frame_0010.png  sha256 81e9014eaf583316
      input camera                 C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/camera.json  sha256 12bf1fe1d97492dd
      input ref2                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_aerial_f1.png  sha256 7474f86bbd4a279f
      input ref3                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_tower_f83.png  sha256 7a8487ebe8463e7e
   call fly-f0020: POST fal-ai/nano-banana-2/edit  -> Habait/engine/_local/bench/fal-ai__nano-banana-2__edit/flyover/out/fly-f0020/out.png  [est $0.120]
      request: {"prompt": "<989 chars>", "image_urls": ["@clay", "@ref2", "@ref3"], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}
      input clay                   C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/frames/frame_0020.png  sha256 624c718f39cf2486
      input camera                 C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/camera.json  sha256 12bf1fe1d97492dd
      input ref2                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_aerial_f1.png  sha256 7474f86bbd4a279f
      input ref3                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_tower_f83.png  sha256 7a8487ebe8463e7e
   call fly-f0029: POST fal-ai/nano-banana-2/edit  -> Habait/engine/_local/bench/fal-ai__nano-banana-2__edit/flyover/out/fly-f0029/out.png  [est $0.120]
      request: {"prompt": "<989 chars>", "image_urls": ["@clay", "@ref2", "@ref3"], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}
      input clay                   C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/frames/frame_0029.png  sha256 1be94423a188b125
      input camera                 C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/camera.json  sha256 12bf1fe1d97492dd
      input ref2                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_aerial_f1.png  sha256 7474f86bbd4a279f
      input ref3                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_tower_f83.png  sha256 7a8487ebe8463e7e
   call fly-f0039: POST fal-ai/nano-banana-2/edit  -> Habait/engine/_local/bench/fal-ai__nano-banana-2__edit/flyover/out/fly-f0039/out.png  [est $0.120]
      request: {"prompt": "<989 chars>", "image_urls": ["@clay", "@ref2", "@ref3"], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}
      input clay                   C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/frames/frame_0039.png  sha256 33300c1a8d70a3cd
      input camera                 C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/camera.json  sha256 12bf1fe1d97492dd
      input ref2                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_aerial_f1.png  sha256 7474f86bbd4a279f
      input ref3                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_tower_f83.png  sha256 7a8487ebe8463e7e
   call fly-f0048: POST fal-ai/nano-banana-2/edit  -> Habait/engine/_local/bench/fal-ai__nano-banana-2__edit/flyover/out/fly-f0048/out.png  [est $0.120]
      request: {"prompt": "<989 chars>", "image_urls": ["@clay", "@ref2", "@ref3"], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}
      input clay                   C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/frames/frame_0048.png  sha256 7b1ea4a77cb91a09
      input camera                 C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover/equirect/_local/segments/approach/camera.json  sha256 12bf1fe1d97492dd
      input ref2                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_aerial_f1.png  sha256 7474f86bbd4a279f
      input ref3                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/E_ref_tower_f83.png  sha256 7a8487ebe8463e7e
   gates after the calls ($0): kf_check.py per frame on the view_hint crop + temporal consistency (out diff / clay diff)
   track flyover: 6 calls, estimated_cost $0.72

== track pano
   call pano-s1: POST fal-ai/nano-banana-2/edit  -> Habait/engine/_local/bench/fal-ai__nano-banana-2__edit/pano/out/pano-s1/out.png  [est $0.120]
      request: {"prompt": "<1314 chars>", "image_urls": ["@clay", "@ref2", "@ref3", "@ref4"], "resolution": "2K", "aspect_ratio": "auto", "output_format": "png"}
      input clay                   C:/RnD/Projects/Habait/habait-walkaround/360walkaround/tours/apt846-furnished/renders/cp-living/pano.webp  sha256 f1f2ba4d09e32ac8
      input depth                  C:/RnD/Projects/Habait/habait-walkaround/360walkaround/tours/apt846-furnished/renders/cp-living/depth.png  sha256 7592162d1baf28e2
      input plan                   C:/RnD/Projects/Habait/habait-walkaround/360walkaround/tours/apt846-furnished/plan.json  sha256 6e9b42d2e755d80d
      input ref2                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/tour-living-yaw0.png  sha256 84e1437ba34d8d31
      input ref3                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/tour-living-yaw70.png  sha256 d65d426559f4b71f
      input ref4                   C:/RnD/Projects/Habait/research/fal-bench-2026-11-02/inputs/tour-living-yaw-70.png  sha256 b407caf8e3b77530
   gates after the calls ($0): openings_gate.py --pano-cg (camera cp-living) + seam: research/fal-bench-2026-11-02/score_e.py::seam (mean abs diff of the 8 left vs 8 right columns)
   track pano: 1 calls, estimated_cost $0.12

estimated_cost_total $0.92  (card 29 cap $10.00 per run; within the cap)
ledger Habait/engine/_local/ledger-E2.json: cap $10.00/run, 0 calls, $0.00 booked
network: none (socket closed); FAL_KEY: not read; spent $0
a real run: habait_bench.py fal-ai/nano-banana-2/edit --tracks keyframe,flyover,pano --cap <usd <= 10> --i-approve   (after Eliran approves THAT run in the habait-4b chat)
page: Habait/engine/_local/bench/page.html  cards A=11 B=11 C=10 E nodes=2  media 53 files 37.0 MB  pano seam (89's seam()): source 11.0, nano-banana-2 5.6, gpt-image-2.5__baseline 10.7, nano-banana-pro 11.8, qwen-image-3 11.9, nano-banana-2.1 12.7, flux-3 14.7, krea-3 18.1, grok-imagine-quality 20.4, seedream-5-pro 20.7, flux-2-pro 25.8  spent $0
[exit code of the Check chain: 0]

$ habait_bench.py fal-ai/nano-banana-2/edit --tracks keyframe   (negative test: no --dry-run, no --cap)
ledger-E2.json sha256 before: 66737c8be3ed6e44
REFUSED (exit 3, nothing sent, ledger untouched): no --cap <usd>. A paid run needs --cap (<= $10, card 29) AND --i-approve; use --dry-run to see the plan
[exit code: 3]
ledger-E2.json sha256 after:  66737c8be3ed6e44
```
- **כסף:** $0. ledger `Habait/engine/_local/ledger-E2.json`: נוצר עם cap_usd 10 לריצה ו-0 קריאות.
- **פגמים פתוחים:**
  1. `openings_gate.py` מבחין חלקית. בפנורמה לא תפס סיבוב של 3°: ה-shift של הדלת דווח 0.62°, ו-railing ב-2.99° עבר בזכות "kept ≥ 0.75". ב-keyframe העביר את ה-repaint של Qwen (kept .897). מה שתפס בשני המקרים: kf_check לפי מחלקה והתפר. העין נשארת בקבלה (D-WQ-12).
  2. בריחוף אין מספרים לפי מחלקה (לפריימי Kaggle אין id pass). kf_check רץ שם עם plan ריק, כי פתחי דירה אחת קטנים מפיקסל מ-200 עד 500 מ'.
  3. ב-`scores-A.json` של 89 יש 21 רשומות זבל: `score.py` עבר על גיליונות ה-`.kfcheck.png` של עצמו, רקורסיבית. `page.py` מסנן אותן.
  4. המחירים הם מחירון 2.11, לא נבדקו ברשת. מסלולי v2v (וידאו) לא נתמכים, בכוונה (אין וידאו במוצר).
  5. תהליך `python -` שלי נתקע על stdin בבדיקה מוקדמת (PID 103937 של bash). הוא לא עושה כלום, ולא הורשיתי להרוג אותו. אפשר לסגור אותו.
- **שאלה לאלירן (T1):** להריץ עכשיו בנצ'מרק אמיתי ראשון על endpoint אחד (תקרה $10 לריצה, ledger-E2)?
  - **א (ברירת מחדל):** לא להריץ עכשיו. מריצים רק כשיוצא מודל חדש שכדאי לבדוק, אחרי dry-run ואישור לאותה ריצה.
  - **ב:** להריץ עכשיו את Nano Banana 2 על שלושת המסלולים. **אומדן dry-run: $0.92** (keyframe $0.08 + ריחוף 6×$0.12 + פנורמה $0.12). נותן בסיס זול ראשון לדף ובודק את הצינור מקצה לקצה.
  - **ג:** להריץ את GPT Image 2.5 (מודל הרשומה), $9.60, כבסיס שכל מודל חדש יימדד מולו על אותם קלטים.
  (האישור הגורף מ-16:45 לכרטיס 29, $10 לריצה, קיים, אבל המפעיל הגדיר את הכרטיס הזה כ-$0; לכן שואלים.)
- **קורא שני:** habait-89 נסגר (המסירה ל-98), ולכן ההודעה נכתבת כאן ולא נשלחה: "89: העטיפה `Habait/engine/bench` קוראת את `research/fal-bench-2026-11-02` בקריאה בלבד, ומקמפלת את `score_e.py::seam` ואת `score.py::edge_share` לבד דרך ast. שינוי שם או חתימה שלהן ישבור אותה. `build_page.py` לא ניתן ל-import כי הוא כותב ל-site/. `score.py` מריץ kf_check גם על גיליונות ה-`.kfcheck.png` של עצמו (21 רשומות זבל ב-scores-A, קבצים מקוננים 3 רמות ב-A-keyframe/). משהו ב-bench.py ישתנה?" **habait-98** (בעלים של `tools/bench/**` ושל ה-ledgers של 89): פגם 1 מחייב אותו כי זה השער שלו. פורמט הדף לא מחייב אותו.
- **לזיכרון:** כרטיס 29 (E2): `Habait/engine/bench/habait_bench.py` = בנצ'מרק חי. endpoint חדש → 3 מסלולים קבועים של 846 (keyframe ext-enter, 6 פריימי ריחוף, פנורמת cp-living) → kf_check/openings_gate/תפר 89 → דף. כסף: --cap≤10 + --i-approve + ledger-E2 לפני קריאה, אחרת exit 3. dry-run של Nano Banana 2 = $0.92. הדף מתוצאות 89 ב-$0. openings_gate לא תפס סיבוב 3°.

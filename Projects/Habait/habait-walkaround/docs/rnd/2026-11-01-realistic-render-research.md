# מחקר: הדמיות ריאליסטיות מתכניות מכר — מצב השוק, הטכנולוגיה והספריות (2026-11-01)

**מי כתב:** Claude (Fable 5.1) לבקשת אלירן · **הקלט:** הפרויקט `habait-walkaround` (ה-cut מהמעבדה, 2026-11-01), תכנית המכר של דירה 846 (Rainbow Tel Aviv, ישראל-קנדה), ומחקר web מאותו יום · **הוצאה:** $0 (שום קריאה גנרטיבית בתשלום; רק הורדות חינמיות ומאומתות-hash).

> המסמך כתוב בעברית עם מונחים טכניים באנגלית. מקורות ברשימה בסוף. כל מספר שנמדד כאן נמדד על המחשב של אלירן; מספרי המעבדה (A2000) מצוטטים כאלה.

---

## 0. התשובה בקצרה

1. **הגישה הכי ריאליסטית ונאמנה לתכנית, גם במחקר הזה וגם במה שהפרויקט כבר מדד, היא "גאומטריה קודם, צבע אחר כך": מודל CG מהתכנית (Blender/Cycles) ואז "skin" גנרטיבי** שמלביש את הרנדר בפוטוריאליזם בלי להזיז קיר, פתח או רהיט. הפרויקט כבר הוכיח את זה (P03/P04 ב-`WALKAROUND-QUALITY-PLAN.md`): GPT Image 2.5 שומר כל קיר ופתח במקומו והחדר השני נראה כאותה דירה. אף כלי "תכנית→תמונה" בשוק (FloorVis, Render a House, GetFloorPlan וכו') לא נותן את שני הדברים יחד: הם מהירים אבל לא עקביים בין חדרים ולא מדויקים במידות.
2. **אין היום מודל אחד שמייצר ישירות מתכנית מכר הדמיה "ברמת סטודיו" ונאמנה.** ה-benchmark היחיד שמצאתי (Ritn3D, יוני 2026, של מתחרה) מדווח 90–95% דיוק זיהוי על PDF וקטורי, ~80% על סריקות, ומתחת ל-30% על הדמיות. התכנית של 846 היא **PDF רסטרי** (4 תמונות מוטמעות, אפס טקסט וקטורי) — כלומר trace ידני/VLM, לא חילוץ וקטורים.
3. **המחשב הזה שונה ממכונת הרנדר שבתיעוד:** Intel Iris Xe בלבד, בלי NVIDIA. Cycles רץ **על CPU בלבד** (נמדד: `hello-render` מדווח "no GPU backend available"). טיוטות אפשריות מקומית; רנדר סופי 8K דורש GPU שכור (RTX 4090 בערך $0.35–0.75 לשעה; כל הדירה בפיינל ≈ 4–5 שעות GPU ≈ $2–4).
4. **מה הותקן היום** (סעיף 8): Blender 4.5.10 LTS portable (הגרסה שה-pipeline נעול עליה, hash מאומת), סביבת Python עם ספריות גיאומטריה/תכניות (shapely, ezdxf, OpenCV, PyMuPDF…), חבילות ה-npm של המנוע (Photo Sphere Viewer 5.15.1), קטלוג הרהיטים CC0 (57 דגמים) ונכסי ה-HDRI/טקסטורות (175 MB). הכל עובד: smoke render עבר, 15 בדיקות המנוע עברו.
5. **ההמלצה:** להישאר על ה-lane הקיים (CG + skin), להשקיע את המאמץ הבא בשני מקומות שבהם האיכות נקבעת: (א) **intake של התכנית** — טרייסר חצי-אוטומטי מבוסס VLM+OpenCV עם אימות מידות מהתכנית, (ב) **איכות ה-skin** — להוסיף ל-GPT Image 2.5 בדיקת A/B מול FLUX.2 [pro] edit ו-Nano Banana 2 על רנדר אחד, ולשקול ControlNet depth על FLUX.2 (פתוח) כשיהיה GPU. את ה-"world models" (HY-World 2.0, Marble) לעקוב, לא לאמץ עכשיו (ראו 2.4).

---

## 1. מה כבר קיים בפרויקט (כדי לא להמציא מחדש)

| רכיב | מצב | איפה |
|---|---|---|
| **V1 — גנרטיבי טהור** (fal.ai: פנורמות מתוך crop של התכנית, עריכות Kontext/FLUX/Nano Banana, GPT Image 2.5) | חי (`habait-tour-846.vercel.app`), אבל הוכרע כ-"נראה מצויר ב-AI, החדרים לא קוראים כדירה אחת" (D-WQ-2) | `Habait/tour360/` |
| **V2 — דטרמיניסטי** (`plan.json` בס"מ → Blender headless → Cycles פנורמות 8K + depth מדויק) | עובד; 846 רונדר מרוהט (53 placements) | `360walkaround/pipeline/` |
| **ה-lane המשולב: CG + AI skin** | נבחר (D-WQ-13), נמדד (P03/P04), ה-finals של 846 נבחרו ($85.61) | `WALKAROUND-QUALITY-PLAN.md` |
| ויואר | Photo Sphere Viewer 5.15.1 + אדפטר Pannellum, cube tiles, walk-in | `Habait/tour360/engine/` |
| קטלוג רהיטים CC0 | 57 שורות (Kenney 45, Poly Haven 10, Quaternius 2), hash-sealed | `360walkaround/catalog/` |
| החלטות שמחייבות | D-WQ-10 נאמנות מדידה לתכנית · D-WQ-16 trace ידני עכשיו, DXF importer אחר כך · D-WQ-17 skin גנרטיבי מותר, הגאומטריה לא · D-WQ-20 לדלג על World Labs | `WALKAROUND-QUALITY-PLAN.md` §1 |

**המסקנה החשובה מהעבר:** הפער באיכות לא היה בוויואר ולא במודל, אלא **במקור התמונה**. כל מודל שמצייר חדר "חופשי" מתוך תכנית דו-ממדית יסחף במידות ובסגנון בין חדרים. זה מה שהמחקר של היום מאשר גם על כלי השוק.

---

## 2. ארבע משפחות של פתרונות בשוק (נובמבר 2026)

### 2.1 "תמונה של תכנית → הדמיה" (image-to-render)
FloorVis, Render a House, Drafto, GetFloorPlan (שירות עם צוות אנושי), genroom, Floor-plan-to-render ב-Rendair/ArchiVinci.
- **איך זה עובד:** מודל דיפוזיה (לרוב FLUX/SDXL + ControlNet) מקבל את תמונת התכנית ומצייר "מבט ציפור" או חדר. 30 שניות עד 3 דקות.
- **איכות:** יפה כסטיל בודד; **לא עקבי בין חדרים, מידות משוערות**, חלונות ודלתות "נודדים". ה-benchmark של Ritn3D (יוני 2026): זיהוי 90–95% על CAD-PDF וקטורי, ~80% על סריקה, <30% על הדמיות.
- **GetFloorPlan:** Trustpilot 4.5/5 מ-30 ביקורות; ביקורת חוזרת: "אפשר לשנות רק דרך הצ'אט עם התמיכה". זה שירות B2C/סוכנים, לא API שאפשר לבנות עליו.
- **רלוונטיות לנו:** נמוכה. זה בדיוק ה-V1 שהוכרע כלא מספיק.

### 2.2 "floor-plan native" (עורכי 3D עם ייבוא תכנית)
Coohom, Planner 5D, Homestyler, Floorplanner, Maket, Space Designer 3D.
- **איכות:** נאמן לתכנית (המשתמש משרטט/מייבא), רנדר "קטלוגי" — מראה שנקרא כ-CGI משנות ה-2010, לא פוטוריאליזם ברמת סטודיו. 4K מאחורי תשלום. Planner 5D: ייבוא תכנית רק בתשלום.
- **רלוונטיות:** כ-benchmark למה שמפתחים קונים היום — לא ככלי. אין API פתוח ל-pipeline שלנו; הסגנון לא ניתן לנעילה ל-"מראה Habait".

### 2.3 CG גאומטריה + AI skin (ה-lane שלנו) — **הבחירה**
- **מי עוד עושה את זה:** זה בדיוק ה-workflow של סטודיואי archviz ב-2026: Blender/3ds Max → רנדר "clay"/draft → ControlNet depth/canny או עורך תמונה (Kontext, GPT Image, FLUX.2) לפוטוריאליזם. כלים כמו Veras, Rendair, ArchiVinci, PromeAI מוכרים את החלק השני בלבד (הם מצפים לרנדר/מודל כקלט).
- **למה זה הכי טוב:** הגאומטריה מגיעה מהתכנית (נאמנות מדידה, D-WQ-10), ה-depth מדויק וחינמי (המעבר התלת-ממדי בוויואר), והעקביות בין חדרים היא תכונה של ה-lane ולא של prompt (P04).
- **איפה האיכות נקבעת:** (1) דיוק ה-trace, (2) איכות הריהוט בקטלוג (Kenney הוא low-poly — ה-skin מכסה על זה אבל הצללים/הפרופורציות נשארים), (3) בחירת מודל ה-skin והפרומפט/material board, (4) החדות (upscale seam-safe + tiles).

### 2.4 World models: פנורמה → עולם תלת-ממדי (Gaussian splats)
- **HY-World 2.0 (Tencent, קוד פתוח בשלבים אפריל–מאי 2026):** HY-Pano 2.0 (פנורמה מתמונה/טקסט, ~80B פרמטרים) → WorldNav → WorldStereo 2.0 (~17B) → WorldMirror 2.0 (1.2B, 12–24 GB VRAM) → סצנת 3DGS/mesh ניתנת לניווט. רישיון קהילתי של Tencent (לא OSI). על fal.ai יש רק `fal-ai/hunyuan_world` (גרסה 1.0, $0.15/תמונה).
- **World Labs Marble (1.1):** API בקרדיטים ($1 = 1,250 קרדיטים; עולם ≈ $1.20; ייצוא mesh GLB ≈ $2.80; ייצוא splat PLY). Spark 2.4.0 (MIT, three.js ≥ r180) מרנדר splats בדפדפן.
- **המשמעות לנו:** זה הכיוון של "הליכה אמיתית" בעתיד, אבל: (א) D-WQ-20 כבר הכריע לדלג על Marble (ספק חדש, מפתח חדש), (ב) הדיוק הגיאומטרי של עולם שנוצר מפנורמה **לא נאמן לתכנית** — הוא ממציא את מה שלא רואים, (ג) ה-depth המדויק מ-Cycles כבר נותן לנו את המעבר התלת-ממדי (Tier 2 בתכנית). **לעקוב, לא לאמץ.**

---

## 3. מודלי ה-"skin" — מה נכון ל-2026 ומה מחירו

| מודל (fal.ai endpoint) | מה נמדד/ידוע | מחיר משוער | תפקיד מומלץ |
|---|---|---|---|
| **GPT Image 2.5** (`openai/gpt-image-2.5/sunburst/edit`, 4096×2048 → 3840×1920) | **P03: כל קיר/פתח/רהיט במקומו, פוטוריאלי; P04: חדר שני = אותה דירה.** GPT Image 2 היה #1 ב-LMArena לעריכה (יולי 2026) | ≈ $2.40 ל-final | **ה-final** (כבר ה-lane) |
| **Muse** (draft lane בפרויקט) | אותו דבר ברבע הפיקסלים | $0.01 | טיוטות וסקירה שלי |
| **FLUX.2 [pro] edit** (`fal-ai/flux-2-pro/edit`) | "הכי ליטרלי" ב-P03 אבל עדיין נראה רנדר; $0.03/MP; מולטי-רפרנס ללא קונפיגורציה | ≈ $0.25 ל-4K | אלטרנטיבה "מחמירה" כשה-GPT מזיז משהו |
| **Nano Banana 2 / Pro** (`fal-ai/nano-banana-2/edit`, `…pro/edit`) | Pro המציא קיר טלוויזיה בתפר ב-P03; עד 14 תמונות רפרנס; 2 זול ($0.08) | $0.08–0.15 | לבדיקת A/B חוזרת עם ה-seam-pad של הפרויקט |
| **Seedream 5 (pro edit)** | "יפה, צייר מחדש את ה-layout" (P03) | ≈ $0.035–0.1 | לא ל-skin; אולי ל-mood boards |
| **FLUX.2-dev Fun ControlNet Union** (Alibaba PAI, קוד פתוח; depth+canny; ~8.3 GB) | הדרך ה-"קלאסית" של archviz: depth מה-CG → תמונה. דורש GPU מקומי/שכור, ComfyUI | חומרה בלבד | **כשיהיה GPU:** שליטה גיאומטרית מוחלטת + LoRA לסגנון Habait |
| **TRELLIS.2 / Hunyuan3D 3.1 Pro** (fal) | image→3D GLB עם PBR; TRELLIS.2 ≈ $0.25–0.35 לדגם | לדגם | **לסגור חורים בקטלוג** (ספות מודרניות, מטבח) מתוך תמונת מוצר |

**המלצה:** ה-final נשאר GPT Image 2.5 עד שבדיקת A/B מדודה (אותו רנדר, אותו material board, מבחן הפתחים) מראה אחרת. מה שכן שווה להוסיף עכשיו: בדיקת FLUX.2 [pro] edit ו-Nano Banana 2 על **רנדר מרוהט** (ה-P03 נעשה על ריהוט placeholder/חלקי) — זה ניסוי של < $2.

---

## 4. קריאת תכנית המכר (intake) — החוליה שקובעת את הנאמנות

**מה התכנית של 846 מלמדת:** PDF של עמוד אחד, 1684×1191 pt, **4 תמונות מוטמעות ואפס טקסט** (`PyMuPDF`: `get_text()` ריק). כלומר: אין וקטורים לחלץ; המידות (822, 744, 530, 348…) הן פיקסלים שצריך OCR, קנ"מ 1:50, צפון וקו בניין מסומנים, ריהוט "מוצע" משורטט בקו דק, ממ"ד/מרפסת שמש/מעבר צר כמלל.

| גישה | מצב 2026 | הערכה |
|---|---|---|
| **Trace ידני** (מה שנעשה ל-846, 2.25 px/cm) | עובד, שעה-שעתיים לדירה | הבסיס עד שיש אוטומציה אמינה (D-WQ-16) |
| **DXF/DWG importer** (`ezdxf` 1.4.5, הותקן) | כשהיזם נותן DWG — מדויק ב-100% | לבנות ראשון (D-WQ-16) |
| **VLM → JSON** (Gemini 3.7 flash כבר ב-repo; Claude/GPT) + OpenCV ל-snapping | FloorplanVLM (פבר' 2026, Qwen2.5-VL, 92.5% IoU קירות) מראה שזה הכיוון, **אבל לא פורסם קוד/משקולות** — רק ה-benchmark FPBench-2K | לבנות "טרייסר חצי-אוטומטי": VLM מציע קירות/פתחים/חדרים ב-JSON של SCHEMA.md, OpenCV מיישר לקווים העבים, המידות המודפסות מאמתות את הסקייל |
| **CubiCasa5k U-Net** (`floorplan2blend-app`, ResNet-34 UNet → GLB) | פתוח, מאומן על תכניות פיניות; Blender 3.6–5.x | טוב ל-prototype של קירות, חלש על תכניות ישראליות (ממ"ד, מרפסת פתוחה, קירות אלכסוניים כמו ב-846) |
| **Gemini + potrace vectorizer** (GitHub) | SVG בשכבות (קירות/דלתות/חלונות) | רעיון טוב ל-"first pass" |
| **YOLOv8 FloorPlanAnalyzer** | AGPL-3.0 — בעייתי מסחרית | לא |

**מה הותקן לזה:** `shapely` (פוליגונים, חיתוכים, offset קירות), `opencv-python` (זיהוי קווים, morphology), `scikit-image`, `PyMuPDF`/`pdfplumber` (PDF: רסטר ווקטור), `ezdxf` (DXF), `svgpathtools`, `trimesh`/`pygltflib` (GLB), `fal-client`.

---

## 5. האקוסיסטם של Blender ל-archviz — מה רלוונטי ומה לא

| פריט | מצב | החלטה |
|---|---|---|
| **Blender 4.5.10 LTS** | הגרסה שה-pipeline נעול עליה (ENV.md); 5.2.3 היא ה-current ו-5.1 LTS-ish יצאה 17.3.2026 | **הותקנה 4.5.10 portable** — לא לשדרג בלי לבדוק `render_pano.py`/`build_scene.py` (Cycles 4.x: coplanar faces דולפים אור — כבר מתועד) |
| Cycles על Intel Iris Xe | oneAPI תומך רק Arc (Xe-HPG); Iris Xe (Xe-LP) לא מופיע ברשימת 5.1 | CPU בלבד כאן (נמדד) |
| **Archipack 2.x** (€49, תומך 3.x–5.x) | קירות/דלתות/חלונות פרמטריים | לא נחוץ: `build_scene.py` כבר בונה קירות/פתחים מה-JSON; אולי למדרגות/מעקות |
| **Infinigen Indoors** (Princeton, BSD-3) | ריהוט מבוסס אילוצים (DSL + solver), פוטוריאלי; **Windows ניסיוני, דורש Linux/WSL + CUDA** | רעיון טוב ל-`placement_templates.py` (אילוצים במקום rules), לא להריץ כאן |
| BlenderKit, Sketchfab, Objaverse | דורשים חשבון/רישיונות מעורבים (RESEARCH.md T11) | חסום לפי rail 4 |
| **Poly Haven + Kenney + Quaternius (CC0)** | הקטלוג הקיים; Poly Haven בלי ספות מודרניות | **ירד היום**; חורים → TRELLIS.2/Hunyuan3D מתמונת מוצר, או ambientCG לחומרים |
| HDRI | `qwantani_noon_puresky_4k.hdr` (non-locating) נדרש ע"י ה-style lock | ירד ואומת hash |

---

## 6. הוויואר והליכה

- **Photo Sphere Viewer 5.15.1** (MIT; `@photo-sphere-viewer/core`, `cubemap-tiles-adapter`, `markers-plugin`) — הגרסה הנעוצה בפרויקט היא גם ה-latest ב-npm (נבדק היום). three 0.185.1 ב-lock (0.187.0 latest).
- **Spark 2.4.0** (`@sparkjsdev/spark`, MIT, three ≥ r180) — רנדרר splats; רלוונטי רק אם נאמץ world models (2.4). `@mkkellogg/gaussian-splats-3d` 0.4.7 אלטרנטיבה.
- Pannellum 2.5.7 / Marzipano 0.10.2 — ישנים/ארכיון; נשארים רק כאדפטר תאימות.
- ה-benchmark: Matterport 22.8–45.5 px/°, אנחנו 5.7 בטלפון → tiles מ-7680×3840 (SeedVR2 2× seam-safe, P02) זו הדרך; כבר בתכנית (D-WQ-15).

---

## 7. חומרה ועלות: מה אפשר כאן ומה דורש ענן

| משימה | מעבדה (A2000, OptiX) | כאן (i9-13900H, CPU) | הערה |
|---|---|---|---|
| smoke 512×256, 32 spp | 1.7 s קר | **3.0 s** (נמדד היום) | CPU בלבד |
| `build_scene.py` — 846 מרוהט (53 placements, 192 בדיקות גאומטריה) | — | **7 s** (נמדד היום) | הבנייה זולה בכל מקום |
| טיוטה נמוכה 2048×1024, 32 spp (בפועל 3072×1024 עם wrap-pad 512) — `cp-living` מרוהט | — | **204 s** (נמדד היום; peak host 1.43 GB; verdict PASS, depth nadir −2 cm) | זה גודל הטיוטה שמעשי כאן: ~3.5 דק' לנקודה, ~40 דק' לדירה |
| טיוטה של ה-pipeline 4096×2048, 64 spp | 107 s | **≈ 27 דק' לנקודה** (אקסטרפולציה ×8 מהמדידה) | אפשרי אבל איטי: ~5 שעות ל-11 נקודות |
| final 8192×4096, 256 spp | 23.4 דק' לנקודה | **≈ 7 שעות לנקודה** (×128) | **לא מעשי מקומית** |
| דירה שלמה ב-final (11 נקודות) | ≈ 4.3 שעות GPU | — | RTX 4090 שכור $0.34–0.74/שעה (RunPod), $0.14+ (Vast) → **≈ $2–4 לדירה**; 5090 $0.69–0.99/שעה ומהיר יותר. שורת ledger לפני ההשכרה (C-360-79) |
| מודלי דיפוזיה מקומיים (FLUX.2 ControlNet) | — | בלתי אפשרי (אין CUDA) | כל הגנרטיבי נשאר על fal.ai |

---

## 8. מה הורד והותקן היום (הכל מאומת, $0)

| מה | גרסה | איפה | אימות |
|---|---|---|---|
| **Blender LTS portable** | 4.5.10 (build 2026-05-19) | `C:\RnD\Projects\Habait\tools\blender-4.5.10\blender-4.5.10-windows-x64\blender.exe` | zip מ-download.blender.org, sha256 `ef6d846b8015f47ade6df3f9322ce17419080a5d922fa562b6c966064fe30dce` = הקובץ הרשמי `blender-4.5.10.sha256`; `hello-render.py` → OK, depth 1.400026 m (0.0019% שגיאה) |
| **Python venv** | 3.13 | `C:\RnD\Projects\Habait\tools\habait-venv` | numpy, pillow, opencv-python, shapely, ezdxf, pymupdf, pdfplumber, scikit-image, trimesh, pygltflib, svgpathtools, fal-client, requests |
| **npm — המנוע** | PSV 5.15.1, three 0.185.1, vite 5.4.10, typescript 5.6.3 | `Habait/tour360/engine/node_modules` | `npm ci` מה-lockfile; `node test/run.mjs` → **15 passed, 0 failed** |
| **נכסי probe CC0 (Poly Haven)** | 36 קבצים, 175 MB | `360walkaround/pipeline/probe/probe-assets/{hdri,models,textures}` | `fetch-assets.py` → OK, כולל ה-HDRI של ה-style lock |
| **קטלוג רהיטים CC0** | 57 שורות | `360walkaround/catalog/models/**` | `fetch.mjs` במצב verify מול ה-sha256 החתומים + import test ב-Blender (ראו סעיף 8.1) |
| **JS sandbox — ספריות 3D/מפה/רחפן** (סעיף 10) | three 0.187.0, 3d-tiles-renderer 0.5.3, cesium 1.146.0, maplibre-gl 6.16.0, @sparkjsdev/spark 2.4.0, gaussian-splats-3d 0.4.7, PSV 5.15.1 (+virtual-tour, plan, cubemap-tiles), @fal-ai/client 1.10.1 | `C:\RnD\Projects\Habait\tools\js-sandbox` (מחוץ ל-repo, לא נוגע ב-lockfile של המנוע) | `npm install --save-exact`, 74 חבילות |

כל הבינארים האלה gitignored בכוונה (rail 4: הקוד וה-manifest הם האמת, הבינארים נמשכים מחדש). הוראות הפעלה: `C:\RnD\Projects\Habait\tools\README.md`.

### 8.1 תוצאת אימות הקטלוג — 57/57, אחרי תיקון מקור אחד
- **ריצה ראשונה:** 12 שורות OK (Poly Haven + Quaternius), **45 שורות Kenney "broken"** — ה-`pack_direct_zip_url` שבמניפסט (`…/440e0608a4-1677580847/kenney_furniture-kit.zip`) עושה היום 302 לעמוד ה-HTML של הנכס, לא ל-zip.
- **הסיבה:** Kenney עברו לקישורים חתומים: `GET https://kenney.nl/download-link/<hex("assets/furniture-kit")>` מחזיר `{url}` עם תוקף, והוא מוריד את ה-zip.
- **התיקון:** הורדתי דרך הקישור החתום; הקובץ **זהה בייט-לבייט למניפסט** (5,130,729 B, sha256 `e67652d0…d46b0`), הונח ב-`catalog/.cache/kenney-furniture-kit.zip` ש-`fetch.mjs` מקבל מה-cache כשה-hash תואם.
- **ריצה שנייה:** `fetched 57/57 rows OK · 112 files · 273.79 MB` · **import test: 57/57 imported OK ב-4.5 s ב-Blender 4.5.10**. `fetch.report.json` התעדכן (זה קובץ ראיות שמחויב ל-git — הדיף הוא חותמות זמן ונתיבים).
- **לא נגעתי במניפסט** (קובץ משותף, CONTRACT §16.4): הבעלים צריך לעדכן את `pack_direct_zip_url` או ללמד את `fetch.mjs` את מנגנון ה-download-link. עד אז הריצה הראשונה על מחשב חדש תדווח 45 broken.

---

## 9. המלצות — מה לעשות הלאה, לפי סדר

1. **A/B של ה-skin על רנדר מרוהט אמיתי** (< $2): אותו `cp-living` של 846 → GPT Image 2.5 מול FLUX.2 [pro] edit מול Nano Banana 2, אותו material board, מבחן הפתחים + seam. זה מכריע אם יש מודל זול יותר ל-finals.
2. **טרייסר חצי-אוטומטי לתכנית מכר** (VLM → `plan.json` → OpenCV snapping → אימות מול המידות המודפסות → `validate-plan.mjs`). זה החיסכון הגדול ביותר בזמן לדירה, והוא לא תלוי ב-GPU. הספריות כבר מותקנות.
3. **מסלול GPU שכור ל-finals** (RunPod/Vast, 4090/5090, Blender 4.5.10 headless, אותו `render_tour.mjs --mode final`) עם שורת ledger. מקומית — רק drafts.
4. **קטלוג:** להחליף את 4–6 הפריטים הבולטים ביותר (ספת סלון, שולחן אוכל, מיטה, ארונות מטבח) בדגמים באיכות גבוהה — TRELLIS.2 מתמונת מוצר ($0.30 לדגם) או Poly Haven כשיש — כי ה-skin משמר פרופורציות וצללים של מה שיש.
5. **לעקוב, לא לאמץ:** HY-World 2.0 (האם יגיע ל-fal כ-endpoint 2.0), FloorplanVLM (האם ישוחררו משקולות), Blender 5.x (לפני שדרוג לבדוק את דליפת האור בפאות משותפות).

---

## 10. ספריות 3D וספריות "רחפן" (לשאלת אלירן באמצע העבודה)

"רחפן" בהקשר של שיווק דירות חדשות אומר שני דברים שונים, ולכל אחד ספריות אחרות:
(א) **טיסת רחפן וירטואלית** מעל הפרויקט בסביבתו (ה-"stage" התלת-ממדי שראינו אצל NadLan בעמוד של Rainbow, capture C1), ו-(ב) **הנוף האמיתי מגובה הקומה** — צילום 360 ברחפן בגובה כל קומה, שמוצב מחוץ לחלון של ההדמיה. השני הוא זה שמעלה את הריאליזם של ההדמיה שלנו; הראשון הוא שכבת אוריינטציה.

### 10.1 ספריות 3D ל-web (הותקנו ב-`C:\RnD\Projects\Habait\tools\js-sandbox`)

| ספרייה | גרסה | רישיון | למה היא רלוונטית | הערכה |
|---|---|---|---|---|
| **three** | 0.187.0 (המנוע נעול על 0.185.1) | MIT | הבסיס של הכל: PSV, Spark, 3d-tiles-renderer | קיים |
| **@photo-sphere-viewer/core** + `virtual-tour-plugin` + `plan-plugin` + `cubemap-tiles-adapter` | 5.15.1 | MIT | הוויואר שלנו; ה-virtual-tour-plugin הוא ה-reference לגרף סיור + חיצים תלת-ממדיים; ה-plan-plugin = תכנית עם view cone (D-WQ: אוריינטציה) | להשוות מול ה-`tour.js` שלנו לפני שכותבים מחדש |
| **3d-tiles-renderer** (NASA-AMMOS, 3DTilesRendererJS) | 0.5.3 | Apache-2.0 | מרנדר **Google Photorealistic 3D Tiles** ישירות ב-three.js (`GoogleCloudAuthPlugin`) — "רחפן וירטואלי" מעל ת"א בלי Cesium | **הבחירה** לטיסה וירטואלית בתוך הוויואר שלנו (אותו three.js) |
| **cesium** | 1.146.0 | Apache-2.0 | גלובוס מלא, Cesium ion (ייבוא מודל BIM/GLB של הפרויקט לקואורדינטות אמיתיות), תומך גם ב-Google 3D Tiles | כבד (50+ MB); רק אם צריך גלובוס/מדידות גיאו |
| **maplibre-gl** | 6.16.0 | BSD-3 | מפה וקטורית חינמית, extrusion של בניינים מ-OSM; אין נתוני 3D פוטוריאליים משלה | מפת אתר/שכונה חינמית; לא "רחפן" |
| **mapbox-gl** (לא הותקן) | 3.34.1 | source-available | Standard style: בניינים 3D + תאורה דינמית, יפה; חינם עד ~50k טעינות/חודש | אלטרנטיבה מסחרית ל-MapLibre; NadLan משתמשים ב-Mapbox |
| **@sparkjsdev/spark** | 2.4.0 | MIT | רנדרר Gaussian splats ל-three.js (≥ r180) — להצגת סריקת רחפן/אתר או עולם מ-HY-World/Marble | מוכן לעתיד (2.4, 10.2) |
| **@mkkellogg/gaussian-splats-3d** | 0.4.7 | MIT | רנדרר splats ותיק יותר | גיבוי ל-Spark |
| deck.gl 9.4.1 · potree-core 2.0.17 (לא הותקנו) | — | MIT/BSD | שכבות נתונים / ענני נקודות | לא נחוץ עכשיו |

**Google Photorealistic 3D Tiles — העובדות שחשובות:** נמכר תחת Map Tiles API (קטגוריית Enterprise): 1,000 "root tile requests" חינם בחודש, אחר כך **$6 ל-1,000** (יורד ל-$2.40 בנפח). החיוב הוא לפי פתיחת session (עד 3 שעות), לא לפי אריח — כלומר כל פתיחת עמוד ≈ $0.006. כיסוי: "2,500+ ערים ב-49 מדינות"; **האם תל אביב בכיסוי ה-API לא אומת במחקר הזה** — לבדוק בשכבת ה-3D של Google Earth או בעמוד הכיסוי של Map Tiles לפני שמתחייבים. האיכות: פוטוגרמטריה עירונית — מצוינת למבט-על ולהבנת הנוף הכללי מקומה 16, **לא מספיקה כ-backplate בחלון של פנורמה פוטוריאלית** (רזולוציה וארטיפקטים).

### 10.2 "רחפן" אמיתי — הנוף מגובה הקומה

| שכבה | כלים/ספריות | מצב | הערכה לפרויקט |
|---|---|---|---|
| **פנורמות 360 בגובה כל קומה** (הסטנדרט בשיווק בנייה חדשה בעולם: כל 5–10 קומות, equirect, ממופה לגובה הקומה מהתכנית) | רחפנים DJI (Mavic 3 / Air 3) מצלמים spherical pano נייטיב (~8K); תפירה: PTGui (בתשלום) / Hugin (חינם); Python: `py360convert`, OpenCV stitching; HDR: bracketing + `enfuse` או Blender | **שירות של מפעיל מורשה, לא ספרייה** | **הצעד שהכי מעלה ריאליזם בזול:** הפנורמה האמיתית הופכת ל-Environment Texture ב-Blender → הנוף האמיתי דרך הזכוכית + כיוון שמש נכון בכל חדר. ב-`build_scene.py` ה-HDRI נעול ב-sha256 ועם `exterior_class: "non-locating"` (A9-7/8) — נוף אמיתי דורש **הסכמת היזם (D-WQ-18) והרחבת ה-style lock ל-"locating"** |
| **פוטוגרמטריה / splats של האתר והסביבה** | OpenDroneMap / **WebODM 3.6.2** (Docker; mesh, orthophoto, DSM) + **OpenSplat** (3DGS); **OpenReco** (MIT, GPU-agnostic, ענף 3DGS ניסיוני); **SkySplat** (add-on ל-Blender: COLMAP + Brush); nerfstudio/gsplat/fVDB (דורשים CUDA — לא על המחשב הזה) | פתוח, בשל | מודל "dollhouse" של הפרויקט בסביבה האמיתית; להצגה ב-Spark. ערך שיווקי גבוה, לא דחוף לאיכות ההדמיה הפנימית |
| **טיסה וירטואלית בלי רחפן** | 3d-tiles-renderer + Google 3D Tiles (10.1), או Cesium ion עם מודל הבניין | חינמי כמעט | ל-pitch מיידי: "כך נראה הפרויקט בסביבה ומה רואים מקומה 16" — בדיוק מה שיש ל-NadLan, בתוך הוויואר שלנו |
| **רגולציה בישראל** | היתר מרת"א (רשות התעופה האזרחית) + רישיון תדר ממשרד התקשורת; טיסה עירונית מעל ת"א = מפעיל מורשה בלבד; הגבלות טיסה זמניות (TFR) בזמן הסלמה; קנסות עד ~₪10,000 (מקור מסחרי יחיד) | לאמת מול רת"א | לא טסים בעצמנו; **שוכרים מפעיל מורשה לכל פרויקט** (טיסה אחת = פנורמות ב-3–4 גבהים) |

**המלצה (10):** (1) להכניס ל-pitch "נוף מהקומה" מצילום רחפן אמיתי כשורת תקציב לפרויקט, ולהכין את ה-style lock ל-HDRI "locating" בהסכמה; (2) לבנות ניסוי קטן ב-js-sandbox: 3d-tiles-renderer מעל המגרש של Rainbow (צריך מפתח Google Maps Platform — לא נוצר היום) כדי לבדוק כיסוי ואיכות של ת"א; (3) Spark/OpenSplat — לעקוב, לא לבנות עכשיו.

---

## מקורות

**כלי שוק ו-benchmarks:** [Render a House — 5 workflows compared](https://www.renderahouse.com/compare/best-ai-floor-plan-to-3d-render-tools) · [Ritn3D — 7 best AI floor plan to 3D tools (benchmark יוני 2026)](https://www.ritn3d.com/blog/best-ai-tools-floor-plan-to-3d/) · [FloorVis](https://floorvis.com/) · [TechDraw AI](https://techdrawai.com/blog/ai-floor-plan-to-render-tools) · [GetFloorPlan — Trustpilot](https://nl-be.trustpilot.com/review/getfloorplan.com) · [GetFloorPlan — Capterra](https://www.capterra.com/p/10008922/Getfloorplan/) · [Space Designer 3D — floor plan software 2026](https://www.spacedesigner3d.com/blog/best-online-floor-plan-software) · [RemodelAI — free AI 3D floor plan apps](https://www.remodelai.io/blog/best-free-ai-3d-floor-plan-apps)

**מודלי תמונה:** [fal.ai — best image-to-image APIs 2026](https://fal.ai/learn/tools/best-image-to-image-apis-2026) · [Atlas Cloud — image editing models 2026](https://www.atlascloud.ai/blog/guides/best-ai-image-editing-models-2026) · [teamday — image models ranked by job](https://www.teamday.ai/blog/best-ai-image-models-2026) · [FLUX.2 Fun ControlNet Union (ComfyUI)](https://github.com/bryanmcguire/comfyui-flux2fun-controlnet) · [ComfyUI docs — FLUX ControlNet](https://docs.comfy.org/tutorials/flux/flux-1-controlnet.md) · [Krea-2 360° ERP LoRAs](https://huggingface.co/mickmumpitz/Krea2-360-ERP-LoRAs)

**World models ו-3D:** [HY-World 2.0 (GitHub)](https://github.com/Tencent-Hunyuan/HY-World-2.0) · [HY-World 2.0 paper](https://www.alphaxiv.org/abs/2604.14268) · [HY-World 2.0 on Hugging Face](https://huggingface.co/tencent/HY-World-2.0) · [fal-ai/hunyuan_world](https://fal.ai/models/fal-ai/hunyuan_world) · [HunyuanWorld-Mirror](https://github.com/Tencent-Hunyuan/HunyuanWorld-Mirror) · [World Labs API pricing](https://docs.worldlabs.ai/api/pricing) · [Spark (sparkjsdev)](https://github.com/sparkjsdev/spark) · [fal.ai Hunyuan 3D](https://fal.ai/hunyuan-3d) · [TRELLIS.2 pricing](https://www.3daistudio.com/blog/is-trellis-2-free-pricing-how-to-get-started) · [Trellis 2 vs Hunyuan 3D](https://www.3daistudio.com/blog/trellis-2-vs-hunyuan-3d-differences-explained)

**קריאת תכניות:** [FloorplanVLM (arXiv 2602.06507)](https://arxiv.org/abs/2602.06507) · [Evidence-gated multimodal floor plan parsing (arXiv 2609.25615)](https://arxiv.org/pdf/2609.25615) · [floorplan2blend-app (CubiCasa5k U-Net → GLB)](https://github.com/ananthakrishnan754/floorplan2blend-app) · [FloorplanToBlender3d](https://github.com/grebtsew/FloorplanToBlender3d) · [fml2blender](https://github.com/daviddemeij/fml2blender) · [FloorPlanAnalyzer (YOLOv8, AGPL)](https://github.com/mageaustralia/FloorPlanAnalyzer) · [Floor Plan Vectorizer (Gemini + potrace)](https://github.com/babivillanova/vector)

**Blender:** [Blender 5.1 release](https://www.blender.org/releases/5-1/) · [Blender 5.1 manual — GPU rendering (oneAPI = Arc only)](https://docs.blender.org/manual/en/5.1/render/cycles/gpu_rendering.html) · [Intel Iris Xe support thread](https://blenderartists.org/t/intel-iris-xe-gpu-support-when/1543194) · [Blender 5.0 beta hardware floor](https://www.notebookcheck.net/Blender-5-0-Beta-Free-open-source-3D-modelling-and-animation-program-launches-with-slew-of-tweaks-and-performance-updates.1134249.0.html) · [Archipack](https://blender-addons.org/archipack-addon/) · [Fox Render Farm — architecture add-ons 2026](https://www.foxrenderfarm.com/news/top-blender-architecture-addons/) · [Infinigen Indoors (arXiv)](https://arxiv.org/html/2406.11824v1) · [Infinigen Indoors — CG Channel 2025](https://www.cgchannel.com/2025/06/open-source-tool-infinigen-indoors-generates-procedural-3d-interiors/)

**ענן GPU:** [RunPod pricing](https://www.runpod.io/gpu-cloud/pricing) · [RunPod pricing 2026 (diyai)](https://diyai.io/ai-tools/hosting/runpod-pricing/) · [Hostinger — cloud GPU prices 2026](https://www.hostinger.com/tutorials/?p=158956) · [RTX 5090 on RunPod](https://deploybase.ai/articles/rtx-5090-on-runpod-pricing-specs-how-to-rent)

**ויואר:** [@photo-sphere-viewer/core (npm/yarn)](https://classic.yarnpkg.com/en/package/@photo-sphere-viewer/core) · [Spark docs](https://sparkjs.dev/docs/overview/)

**3D ורחפן (סעיף 10):** [Google Maps Platform pricing (Map Tiles / Photorealistic 3D Tiles)](https://developers.google.com/maps/billing-and-pricing/pricing) · [Photorealistic 3D Tiles overview](https://developers.google.com/maps/documentation/tile/3d-tiles-overview) · [Google 3D Tiles cost — Cesium community](https://community.cesium.com/t/google-3d-tiles-cost/27625) · [3d-tiles-renderer v0.5.3 docs](https://gkjohnson.github.io/tools/docs/3d-tiles-renderer.md) · [GoogleCloudAuthPlugin](https://gkjohnson.github.io/tools/docs/3d-tiles-renderer/core/plugins/GoogleCloudAuthPlugin.md) · [Mapbox Standard style](https://docs.mapbox.com/map-styles/standard/guides) · [Mapbox GL JS v3 migration](https://docs.mapbox.com/mapbox-gl-js/guides/migrate) · [WebODM](https://webodm.org/) · [OpenDroneMap](https://en.wikipedia.org/wiki/OpenDroneMap) · [OpenReco](https://github.com/abhibagul/OpenReco) · [SkySplat](https://skysplat.org/about/) · [Open-source Gaussian splatting with a beginner drone](https://medium.com/@CVxTz/open-source-gaussian-splatting-with-a-beginner-drone-4728d17e9019) · [PanoDrone — floor-height 360 panoramas](http://panodrone.com/) · [Drone 360 panoramas for development visualisation (Perth)](https://droneimage.com.au/360-visualisation-perth) · [Drone 360 photos sell condos](https://www.nashvilledrone.co/blog/how-drone-360-degree-photos-sell-condos) · [Drone laws in Israel (dronesgator)](https://dronesgator.com/drone-laws-in-israel) · [Israel CAA — UTM connection ruling](https://www.unmannedairspace.info/uncategorized/israel-caa-rules-out-drone-flights-without-active-connection-to-a-utm-system/)

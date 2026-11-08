# משימה 06: A3: intake וקטורי: intake_dwg.py (ezdxf) ו-intake_ifc.py (IfcOpenShell) → אותו plan.json

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | A |
| **מקור בתכנית** | חלק ג §2 ערוץ A, שלב A3 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `engine-builder` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 7 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

שני קוראים וקטוריים שמוציאים את אותו `plan.json` + אותו דוח כמו המסלול הרסטרי: DXF/DWG דרך ezdxf (שכבות קירות/דלתות/חלונות/טקסט; DWG → DXF דרך ODA File Converter אם יש) ו-IFC דרך IfcOpenShell (IfcWall/IfcDoor/IfcWindow/IfcSpace). מתחיל כשיש קובץ; עד אז: DXF ציבורי לדוגמה.

## תלויות

- 01 (פורמט הדוח ו-plan.json); **חסום על קובץ DWG/IFC**: ציבורי או מפרויקט שני (אלירן מביא; אין פנייה לישראל קנדה)

## קלטים (קריאה)

- 01
- venv: ezdxf מותקן; IfcOpenShell להתקנה ב-venv (לרשום גרסה)
- `C:\RnD\Projects\Habait\data\sales-plans\_inbox\` (אם אלירן הביא DWG)

## קבצים (הסוכן כותב רק כאן)

- `Habait/engine/intake/intake_dwg.py`, `Habait/engine/intake/intake_ifc.py` (חדש)
- `Habait/engine/intake/fixtures/sample.dxf` (ציבורי, עם רישיון רשום)
- `Habait/engine/_local/dwg-sample/**`

## צעדים

1. למצוא DXF דירה ציבורי עם רישיון מותר (לרשום מקור); לבנות מיפוי שכבות → סוגי אובייקטים עם קובץ config לכל יזם.
2. DXF → קירות (polylines/lines עם עובי), פתחים (blocks/arcs), טקסט (שמות חדרים, מידות) → plan.json דרך אותו מודול כיול ודוח של 01.
3. IFC: אותו פלט מ-IfcOpenShell.
4. להריץ validate-plan ו-plan_gate (05).

## קריטריוני קבלה

- [ ] DXF לדוגמה → plan.json שעובר validate-plan בלי תיקונים ידניים.
- [ ] אותו דוח התאמה כמו ברסטר (אותו report.py).
- [ ] כשמגיע DWG אמיתי: מריצים ומדווחים edit-cost.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 300 $PY Habait/engine/intake/intake_dwg.py Habait/engine/intake/fixtures/sample.dxf --out Habait/engine/_local/dwg-sample && node 360walkaround/pipeline/validate-plan.mjs Habait/engine/_local/dwg-sample/plan.json
# צפוי: exit 0 בשתי הפקודות; הדוח מציין 0 תיקונים נדרשים
```

**Reviewer scope:** התאמה לסכמה בלבד: plan.json מה-DXF זהה במבנה לזה מהרסטר (אותם שדות, ס"מ, +y למטה).

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0

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

- **מצב:** DONE (T0; שינוי היקף מהמשגר: הקורא העיקרי הוא PDF וקטורי, DXF משני, IFC אמיתי ולא stub). habait-4b, engine-builder, 2.11.2026 ~16:55 שעון המכונה.
- **מה נעשה:**
  1. **קורא PDF וקטורי** (`intake_pdf_vector.py` + `vector_common.py`), $0, בלי VLM, ~25 ש' על 846. ממצאים על ה-PDF: 8,636 drawings, **46 שכבות CAD נשמרו כ-OCG** (`01wall beton_m`, `05door_m`, `24dimension_m`, `09text_m`, `O-WIN`, `W-CONC`...), הדירות השכנות מוסתרות ב-clip פוליגוני (קוראים רק מה שבתוך ה-clip), כל הטקסט outlined (0 text spans). לכן: שכבה → מחלקה דרך `layer_maps/dblk.json`; **ספרות המידות מפוענחות מצורות הגליפים** (49 גליפים → 10 מחלקות צורה = 10 הספרות, מיפוי מחלקה→ספרה לפי התאמה גלובלית ל-span, וכל ערך נקרא מהגליפים שלו); **שמות החדרים מפוענחים מהגליפים** מול `lexicon_he.json` (פונקציה אחת צורה→אות לכל הגיליון, בלי VLM); קירות = poche + פאות דקות של קווי הקיר; חדרים = רכיבי חלל פנוי עם תווית; דלתות = קשתות (ציר = מרכז הקשת, סגירה = קצה הקשת הרחוק מהכנף); חלל פתוח מפוצל ב-Voronoi גיאודזי של התוויות. הפלט נכתב דרך ה-emitters של כרטיס 01 (`emit_plan`, `make_report`, `add_edge_kinds`, `write_report_md`), מיובאים ולא משונים, כך שהפורמט זהה (`habait.intake-report/0.1`, `raster.cm_to_px`, `frames`, `dimensions[]`, `summary.tolerance`).
  2. **846, מול ה-GT** (`360walkaround/tours/apt846/plan.json`, דרך `project.json` → `units[].files.plan_json`):

     | מה | כרטיס 01 (רסטר + VLM) | כרטיס 06 (וקטורי) |
     |---|---|---|
     | מידות מודפסות | 14/16 | **16/16 נקראו**; מול הפיקסטורה 15/16, כי ב-`apt846.intake.json` כתוב 99 ועל הגיליון מודפס **199** (נבדק ב-600 dpi: ה-1 עולה על סמל האסלה; span 199.1 ס"מ) |
     | סקייל | 2.2494 px/cm (‎-0.81%) | **2.2681 px/cm** (‎+0.015% מול 1:50; 16/16 מידות בתוך 0.25%). ה-2.25 של ה-GT קטן ב-0.8%, כלומר ס"מ של ה-GT ארוכים ב-0.8% |
     | חדרים | 8/11 מתוחקרים | **10/11** (9 תוויות מפוענחות + כניסה שנזרעה ליד דלת הכניסה; "מרפסת · קצה החדרים" של ה-GT לא מודפסת) |
     | קירות | 10 רכיבים מול 37 | 9 רכיבי poche מול 37, ‏15.3 מ"ר מול 11.75 (כולל עמודי המרפסת וקירות הפיר) |
     | פתחים (זוגות חדרים של ה-GT) | 1/13 | **6/13** במדד של 01 (שמדלג על וירטואליים); **11/13** כולל חתכי האזורים; שני החסרים שייכים לחלק המרפסת הלא-מודפס |
     | חדר מול מודפס | 0/2 | **11/11** קווי מידה room_clear בתוך הסבולת (מקס' 0.64%); 4/4 זוגות |
     | edit-cost | 30 (מול 39 מאפס) | **16** (חדר 1, קווי אזור 6, פתחים 7 במדד הקשיח, עודפים 2) |
     | validate-plan | CLEAN | CLEAN, 4 אזהרות, exit 0 |
     | plan_gate | FAIL 0.000 | **FAIL 0.500, exit 1**: ‏9/10 חדרים עוברים; רק באמבטיה הכללית 199 נמדד 205.5 (‎+3.3% מול סף 3%) בחוט המוסט של השער שעובר בשקע הדלת (החוט על הקו עצמו 198.1, ‎-0.45%). אותה תכנית עם חדר השינה מוזז 10 ס"מ (`--make-bad`): FAIL 0.229 |
  3. **DXF** (`intake_dwg.py`, ezdxf 1.4.5): שכבות → layer map, פיצוץ INSERT (כולל מקוננים), TEXT/MTEXT מול הלקסיקון, ישויות DIMENSION (override או measurement, defpoint2/3), פוליליינים של גבולות חדרים כשיש שכבה כזו, היפוך y, יחידות מ-`$INSUNITS`; DWG דרך ODA File Converter אם מותקן (כאן לא). **הדגימה סינתטית**: לא נמצא DXF דירה ציבורי עם רישיון ברור שאפשר להוריד בלי דפדפן, לכן `fixtures/make_sample_dxf.py` מייצר את `sample.dxf` מתוכנית ה-GT של 846, בשמות שכבות AIA (`A-WALL`, `A-WALL-PATT`, `A-DOOR` כבלוק, `A-GLAZ`, `A-AREA-BDRY`, `A-ANNO-TEXT`, `A-ANNO-DIMS`...) ששונים בכוונה מאלה של ה-PDF, עם config בשם `fixtures/sample.layers.json`. רישיון: נוצר על ידי Habait מתוכנית שלה, אותו rights_state כמו ה-plan.json (partner-supplied). תוצאה: 11/11 חדרים בשם, 37/37 קירות, 0 תיקונים בלי GT; מול GT: 13/13 זוגות פתחים כולל וירטואליים (7/13 במדד הקשיח), plan_gate PASS 0.873.
  4. **IFC** (`intake_ifc.py`): **IfcOpenShell 0.9.0.post1 הותקן נקי ב-venv** (pip, פחות מדקה; נכנסו גם isodate 0.7.2, lark 1.3.1, python-dateutil 4.0.0, tzdata 2026.6). IfcSpace → חדרים, IfcWall/IfcColumn → poche, IfcWindow/IfcRailing → זיגוג/מעקה, IfcDoor → דלת. דגימה סינתטית `fixtures/sample.ifc` מ-`make_sample_ifc.py`: ‏11/11 חדרים, 37/37 קירות, validate-plan CLEAN.
  5. **README:** `Habait/engine/intake/README.md` (ש-ab שחזר) **הורחב, לא נכתב מחדש**: שורות בטבלת Files וסעיף "Vector intake" (טבלת שלושת המסלולים, איך זה עובד, הרצה על 846 ועל הדגימות, תוצאות, פערים ידועים); ב-`Habait/engine/README.md` נוספה שורת קישור אחת בלבד.
  6. **הכרעות T0:** דגימה סינתטית במקום ציבורית; IFC אמיתי (ההתקנה עברה); כניסה לא מודפסת נזרעת 60 ס"מ בתוך דלת הדירה; יחידת זיגוג בין חדר פנים למרפסת = דלת הזזה (הרחבה ביותר לכל זוג); room_clear = קו מידה שהחוט של החדר לאורכו שווה ל-span שלו (±1.5% / 6 ס"מ, ציור מול ציור, כדי שבדיקת מודפס-מול-חדר תישאר בדיקה אמיתית); תווית שהמחלקות שלה לא מאושרות בתווית אחרת נזרקת.
- **קבצים שנכתבו:** `Habait/engine/intake/{intake_pdf_vector.py, vector_common.py, intake_dwg.py, intake_ifc.py, lexicon_he.json, layer_maps/dblk.json, fixtures/sample.dxf, fixtures/sample.ifc, fixtures/sample.layers.json, fixtures/make_sample_dxf.py, fixtures/make_sample_ifc.py}`, `Habait/engine/intake/README.md` (הרחבה), `Habait/engine/README.md` (שורת קישור אחת); פלטים: `Habait/engine/_local/apt846/vector/` (plan.json, report.json, report.md, plan-crop.png, overlay.png, plan_gate.json, run.log, bad-plan-bedroom-dx10.json), `Habait/engine/_local/dwg-sample/` (פלט ה-Check + check.log, `scored/` מול GT, `ifc/`). לא נגעתי ב-`intake_raster.py`, `rasterize.py`, `vlm.py`, `tracer_cv.py`. מחוץ לנתיבי הכרטיס: חבילת ifcopenshell (והתלויות למעלה) נכנסה ל-`C:\RnD\Projects\Habait\tools\habait-venv` לפי הוראת הכרטיס ("IfcOpenShell להתקנה ב-venv").
- **פלט ה-Check (מילה במילה):** הפקודה כפי שכתובה בכרטיס; `intake_dwg.py` **exit 0**, `validate-plan.mjs` **exit 0**; הדוח: `total_edits: 0`.
```
144 entities ({'LWPOLYLINE': 79, 'HATCH': 37, 'TEXT': 12, 'DIMENSION': 4, 'LINE': 6, 'ARC': 6}), units 1.0 cm, 117 primitives, 11 texts, 4 dimensions, 11 room boundaries
doors: 6 swing doors from 6 arcs
walls: 37 solid pieces, 11.28 m2; free-space components >= 0.3 m2: 4
rooms: 11 (11 named, 0 unnamed), 12 virtual zone cuts
# Intake report: sample.dxf (2026-11-02)

VLM backend: `{'backend': 'vector (no VLM)', 'model': None}`; timings (s): {'read': 1.4, 'geometry': 3.9}

## Scale

fitted **2.2500 px/cm** vs nominal 2.2500 (+0.00 %). drawing units from the DXF header ($INSUNITS=5, 1.0 cm/unit); 4/4 DIMENSION values agree with their defpoint span within 3 %

## Rooms

- vlm_count: 11
- traced_count: 11

## Printed vs measured (±3 %): 2/2 comparable rooms pass; not comparable (virtual zone): []

| room | printed | measured (min-rect) | delta % | pass | zone |
|---|---|---|---|---|---|
| Entrance | None | [602.4, 199.5] |  |  |  |
| Kitchen | None | [533.7, 279.1] |  |  |  |
| Dining corner | None | [427.0, 256.4] |  |  |  |
| Living room | None | [839.5, 513.5] |  |  |  |
| Sun terrace | None | [792.2, 348.6] |  |  |  |
| Balcony | None | [220.1, 177.3] |  |  |  |
| Master bedroom | None | [391.2, 343.2] |  |  |  |
| Wardrobe | None | [342.5, 165.6] |  |  |  |
| Master bathroom | [215, 214] | [215.4, 214.3] | [0.2, 0.1] | True |  |
| Bedroom | [343, 273] | [342.9, 273.3] | [-0.0, 0.1] | True |  |
| Guest bathroom | None | [256.0, 152.6] |  |  |  |
## Walls

{'traced_count': 37, 'traced_area_m2': 11.3}

## Area sanity

indoor rooms 90.91 m2 + walls 11.3 m2 = 102.2 m2 vs sheet None m2 (gap None %); outdoor rooms 18.68 m2 vs sheet terrace None m2

## Edit cost

- rooms_missing: 0
- rooms_unlabeled: 0
- rooms_not_traced: 0
- zone_boundaries_to_place: 0
- dims_failing_3pct: 0
- openings_missing: 0
- openings_extra: 0
- fixtures_to_place: 0
- total_edits: 0
- note: one edit = one room to add/rename/split-line to move, one dimension pair out of 3 %, one opening to add/remove; fixtures counted separately

## Vector reader

- source DXF: drawings 144, primitives 117, layers 12, text spans 11
- dimensions: None texts, None glyphs in None classes; scale drawing units from the DXF header ($INSUNITS=5, 1.0 cm/unit); 4/4 DIMENSION values agree with their defpoint span within 3 %
- labels decoded: כניסה / Entrance, מטבח / Kitchen, פינת אוכל / Dining corner, סלון / Living room, מרפסת שמש / Sun terrace, מרפסת · קצה החדרים / Balcony, חדר שינה הורים / Master bedroom, פינת ארונות / Wardrobe, חדר רחצה הורים / Master bathroom, חדר שינה / Bedroom, חדר רחצה כללי / Guest bathroom
- doors: 6 swing arcs; openings emitted 16
- room chord vs printed: 4/4 within tolerance
  - 215 ['r-master-bathroom']: chord 215.4 (+0.19 %, tol 4.0 %) ok
  - 214 ['r-master-bathroom']: chord 214.3 (+0.14 %, tol 4.0 %) ok
  - 273 ['r-bedroom']: chord 273.3 (+0.11 %, tol 3.0 %) ok
  - 343 ['r-bedroom']: chord 342.9 (-0.03 %, tol 3.0 %) ok

validate-plan-general: CLEAN - 0 fail, 10 warn
  warn V8: walls[w-12]: polygon self-touches (edges 0, 2) - a raster piece; the builder extrudes it as drawn
  warn V10: openings[o-4]: a door whose end is 43 cm from any wall or pane (the ends of a door touch its jambs)
  warn V9: rooms[r-kitchen]: 17 of 36 edges have no wall, pane or opening within 15 cm (10 open edges)
  warn V9: rooms[r-dining-corner]: 9 of 25 edges have no wall, pane or opening within 15 cm (16 open edges)
  warn V9: rooms[r-living-room]: 3 of 45 edges have no wall, pane or opening within 15 cm (22 open edges)
  warn V9: rooms[r-sun-terrace]: 29 of 106 edges have no wall, pane or opening within 15 cm (6 open edges)
  warn V9: rooms[r-balcony]: 19 of 39 edges have no wall, pane or opening within 15 cm (8 open edges)
  warn V9: rooms[r-master-bedroom]: 2 of 13 edges have no wall, pane or opening within 15 cm (2 open edges)
  warn V9: rooms[r-wardrobe]: 3 of 17 edges have no wall, pane or opening within 15 cm (2 open edges)
  warn V9: rooms[r-bedroom]: 13 of 29 edges have no wall, pane or opening within 15 cm (1 open edges)
  note rooms[r-master-bathroom]: printed vs traced disagreement recorded
  note rooms[r-bedroom]: printed vs traced disagreement recorded
  note camera_points[cp-sun-terrace]: in the outdoor room r-sun-terrace (allowed for a general plan: a roofed terrace)
  note camera_points[cp-balcony]: in the outdoor room r-balcony (allowed for a general plan: a roofed terrace)
  note rooms 11 (indoor clear floor 90.90 m2, outdoor 18.68 m2) · walls 37 pieces · openings 16 · panes 6 · cameras 11
```
- **כסף:** $0. אין ledger: בלי קריאות בתשלום, בלי `claude -p`, בלי רשת חוץ מ-pip install של ifcopenshell.
- **פגמים פתוחים:**
  - plan_gate על 846 הווקטורי: FAIL 0.500 רק בגלל 199 באמבטיה הכללית (‎+3.3% בחוט המוסט של השער מול 3%). אפשרויות: לסווג את 199 כ-sub_element כמו בפיקסטורה של כרטיס 05, או ש-plan_gate יקבל 4% לחדרים מתחת ל-5 מ"ר כמו ה-report (הבעלים של השער: 4b/כרטיס 05).
  - אזורי חלל פתוח (מטבח/פינת אוכל/סלון/כניסה) לא מצוירים בגיליון: Voronoi גיאודזי, שטחים רחוקים מה-GT (כניסה 15.1 מול 6.3 מ"ר); נשארים לבדיקה במסך התיקון.
  - טבלת הדירה (שטח, מרפסת, קומה) היא טקסט outlined בכותרת ולא נקראת; `unit_fields` ו-area sanity ריקים בלי `--vlm-json`.
  - תוויות מסובבות לא מפוענחות; "אוורור" (גופן אחר) נזרק; דלתות זכוכית הן הנחה; `fixtures[]` ריק.
  - נבדק על גיליון וקטורי אחד ועל דגימות DXF/IFC סינתטיות בלבד; DWG דורש ODA (לא מותקן).
  - פגם בפיקסטורה של 98: ב-`Habait/studio/fixtures/apt846.intake.json` ‏99 צריך להיות 199.
  - ה-GT של 846 בסקייל 2.25 px/cm, האמיתי 2.2681: אורכי ה-GT ארוכים ב-0.8%.
  - ההתקנה של ifcopenshell משכה python-dateutil 4.0.0 ל-venv המשותף; כדאי לוודא שכלים שתלויים בו (pandas) עדיין רצים.
- **קורא שני:** habait-98: הפיקסטורה `Habait/studio/fixtures/apt846.intake.json` (שלו) רושמת 99 במקום 199 המודפס, ו-`360walkaround/tours/apt846/plan.json` בנוי על 2.25 px/cm כשהסקייל האמיתי מהמידות הווקטוריות הוא 2.2681 (אורכים ארוכים ב-0.8%). זה משפיע על כל שער ומידה שנשענים עליהם. ל-habait-ab: אין (נסגר; ערוץ A אצל 4b).
- **לזיכרון:** כרטיס 06: ה-PDF של 846 נקרא וקטורית ($0, בלי VLM, ~25 ש'): שכבות CAD כ-OCG, ספרות ותוויות מפוענחות מצורות הגליפים. 16/16 מידות, סקייל 2.2681 px/cm (ה-GT ב-2.25 ארוך ב-0.8%), 10/11 חדרים, פתחים 6/13 (11/13 עם וירטואליים), edit-cost 16 מול 30; plan_gate 0.500 (רק 199 באמבטיה). DXF/IFC על דגימות סינתטיות: Check exit 0, אפס תיקונים. בפיקסטורה 99 הוא 199.

# כיתוב אחיד להדמיות (Standard disclaimer) — טיוטה לאישור עו"ד

**סטטוס:** DRAFT v0 (2026-11-02). לא לפרסום לרוכשים לפני חוות דעת עו"ד (ראו `lawyer-checklist-he.md`). מופיע על **כל** פלט: וידאו (כתובית פתיחה + שורה קבועה), פנורמה/ויואר (שורה תחתונה קבועה + מסך "אודות"), דף נחיתה (footer), קובץ ZIP (README) ותמונות סטילס (שוליים).

**מילוי משתנים:** `{DEVELOPER}` היזם · `{PROJECT}` הפרויקט · `{UNIT}` דירה/טיפוס · `{PLAN_DATE}` תאריך תכנית המכר שעליה התבססנו · `{ARCHITECT}` משרד האדריכלים · `{GEN_DATE}` תאריך הפקת ההדמיה · `{VERSION}` גרסת ההדמיה.

**עיקרון (SUMMARY 3.5):** "להמחשה בלבד" לבדו לא מגן מפני הטעיה (חוק הגנת הצרכן ס' 2, ס' 36; פס"ד המעקות 2017). לכן הכיתוב לא מסתפק ב"להמחשה" אלא אומר **ממה נגזרה ההדמיה, מה מחייב, ומה לא נכלל**. ההגנה האמיתית היא הנאמנות לתכנית (gates מתועדים), והכיתוב רק משקף אותה.

---

## 1. גרסה קצרה (כתובית וידאו / שורה תחתונה בויואר / שולי תמונה)

**עברית**
> הדמיה להמחשה בלבד. הופקה בסיוע בינה מלאכותית מתכנית המכר של דירה {UNIT}, {PROJECT}, מיום {PLAN_DATE}. המסמכים המחייבים הם המפרט והתכניות החתומים. ריהוט, גימורים ונוף להמחשה.

**English**
> Illustration only. Generated with AI assistance from the sales plan of unit {UNIT}, {PROJECT}, dated {PLAN_DATE}. The binding documents are the signed specification and plans. Furniture, finishes and views are illustrative.

## 2. גרסה מלאה (דף נחיתה, מסך "אודות", README ב-ZIP)

**עברית**

> **הדמיה להמחשה בלבד.**
> ההדמיה הופקה על ידי Habait עבור {DEVELOPER} בסיוע כלי בינה מלאכותית, על בסיס תכנית המכר של דירה {UNIT} בפרויקט {PROJECT} מיום {PLAN_DATE} (אדריכל: {ARCHITECT}). הגאומטריה של הדירה (חדרים, קירות, פתחים) נגזרה מתכנית המכר; מראה החומרים, התאורה, הריהוט, האביזרים, הצמחייה, האנשים והנוף הם פרשנות חזותית ואינם חלק מהממכר.
> **המסמכים המחייבים** הם אך ורק המפרט הטכני (לפי חוק המכר (דירות), תשל"ג-1973, וצו מכר דירות (טופס של מפרט), תשל"ד-1974) והתכניות החתומות המצורפות לחוזה המכר. בכל סתירה בין ההדמיה לבין המפרט והתכניות, המפרט והתכניות גוברים.
> **ריהוט, גימורים, כלים סניטריים, מטבח, ארונות, תאורה ואביזרים אינם כלולים** בדירה אלא אם נאמר במפורש במפרט. גוונים, חומרים ופריטים שמופיעים בהדמיה עשויים להיות שונים מאלה שיסופקו בפועל.
> **שטחים ומידות** הם לפי תכניות היזם והמפרט; המידות בהדמיה מוצגות באופן מקורב ואינן מהוות מדידה. מיקום עמודים, קורות, פירים ומערכות עשוי להשתנות בהתאם לתכנון המפורט ולהוראות כל דין.
> **הסביבה, הבניינים השכנים, הנוף והתאורה הטבעית** מוצגים להמחשה בלבד ואינם מתחייבים.
> הופק: {GEN_DATE}, גרסה {VERSION}. גילוי: חלקים מההדמיה נוצרו או עובדו באמצעות בינה מלאכותית.

**English**

> **Illustration only.**
> This visualization was produced by Habait for {DEVELOPER} with the assistance of artificial-intelligence tools, based on the sales plan of unit {UNIT} in {PROJECT} dated {PLAN_DATE} (architect: {ARCHITECT}). The apartment geometry (rooms, walls, openings) is derived from the sales plan; materials, lighting, furniture, accessories, vegetation, people and views are a visual interpretation and are not part of the property sold.
> **The binding documents** are solely the technical specification (under the Sale (Apartments) Law, 5733-1973, and the Sale (Apartments) (Specification Form) Order, 5734-1974) and the signed plans attached to the sale agreement. In any discrepancy between this visualization and the specification and plans, the specification and plans prevail.
> **Furniture, finishes, sanitary fixtures, kitchen, closets, lighting and accessories are not included** unless expressly stated in the specification. Colours, materials and items shown may differ from those actually supplied.
> **Areas and dimensions** are per the developer's plans and specification; dimensions in the visualization are approximate and do not constitute a measurement. The location of columns, beams, shafts and building systems may change according to the detailed design and applicable law.
> **Surroundings, neighbouring buildings, views and natural light** are shown for illustration only and are not guaranteed.
> Produced {GEN_DATE}, version {VERSION}. Disclosure: parts of this visualization were created or processed using artificial intelligence.

## 3. איפה בדיוק זה מופיע (חוזה עם המנוע, ערוץ D/M7)

| פלט | מה | איך |
|---|---|---|
| וידאו ריחוף / dive / intro | גרסה קצרה: כתובית פתיחה 3 ש' + שורה קבועה בפינה (גודל ≥ 2.5 % מגובה הפריים) | נצרב בפריימים ב-assemble, לא כשכבת ויואר בלבד |
| פנורמות / ויואר 360 | גרסה קצרה בשורה תחתונה קבועה; גרסה מלאה בכפתור "אודות ההדמיה" | HTML של הויואר; גם בתוך ה-equirect (watermark קטן) כדי ששיתוף תמונה לא יאבד אותו |
| דף נחיתה / בוחר דירות | גרסה מלאה ב-footer של כל עמוד; גרסה קצרה ליד כל תמונה | |
| ZIP לדירה | `README-he-en.txt` עם הגרסה המלאה + `{PLAN_DATE}` + sha256 של תכנית המכר ששימשה | נוצר אוטומטית מ-`plan.json → plan_meta` |
| סטילס | גרסה קצרה בשוליים התחתונים; metadata (XMP/EXIF) עם תאריך התכנית וגילוי AI | |

**מקור האמת לתאריך התכנית:** `plan.json → plan_meta.source_label_he/trace_date` ו-`meta.json → drawing.date`. הכיתוב נבנה ממנו אוטומטית, לא מוקלד.

## 4. מה עוד לשקול (לעו"ד)

- האם להוסיף "ההדמיה אינה מהווה הצעה ו/או התחייבות ו/או מצג מטעם היזם" (נוסח מקובל בשוק).
- האם נדרש סימון מפורש "נוצר ב-AI" בגוף הוידאו (לא רק בטקסט) לצורכי רגולציית AI עתידית / EU AI Act אם משווקים בחו"ל.
- האם Habait (כמפיקה) צריכה להופיע בשמה או רק היזם.

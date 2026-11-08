# מחקר סגנונות: איך נראים סרטוני שיווק נדל"ן ב-2026, ומה הפכנו ל-presets (2026-11-01)

**מי כתב:** Claude (סוכן מחקר של הסשן, 86 קריאות web) לבקשת אלירן · **תוצר:** `Habait/studio/styles/presets.json` (8 סגנונות) · **הוצאה:** $0.

> סייג ראיות: שום וידאו לא נצפה ישירות (YouTube/Vimeo חסומים לסוכן; אתרי יזמים טוענים ב-JS). הנורמות של סרטוני יזמים ישראליים נגזרו מכיסוי עיתונאי, דפי סטודיו ופרקטיקת archviz. מה שמסומן **[הסקה]** הוא סינתזה, לא ציטוט.

## 1. מה הסטודיואים המובילים עושים (2025–26)
- **Mir** (ברגן): "natural visualization" — שמיים אפורים, פלטה דה-סטורטית ציורית, הנוף חשוב כמו הבניין; מזלזלים ב-"blue hour dusk" הקל.
- **Brick Visual**: שפה מציור קלאסי + צילום קולנועי; שכבות קדמה/רקע, קומפוזיציה מודעת.
- **Beauty and the Bit**: סרטי archviz נרטיביים, משטחים "לא מושלמים".
- **Luxigon**: היפר-ריאלי אבל עריכתי, רוויה גבוהה, צבעים משלימים.
- **The Boundary**: סרט ההשקה של Mercedes-Benz Places Miami — CGI + LED volume עם מגיש חי בתוך סביבות שלא נבנו.
- **Hayes Davidson**: מוצר ייעודי של reels אנכיים לרשתות; הגלריה מסוננת לפי Mood/Style — כלומר הם חושבים ב-presets.
- מגמות (Chaos, Maverick Frame, Golden Studio): ריאליזם "חי" (ספלים, ספה מקומטת, עצים זזים), צללים עמוקים + light leaks, time-lapse יום-לילה, מאקרו → pull-back, קליפים של 15–30 ש' לרשתות, לופים, ירק ביופילי; D5 Render ככלי האנימציה הנפוץ, offline render לסטילים.

## 2. ישראל
- סטודיואים פעילים על מגדלי ת"א: **3DVISION/3division** (PARK51), **Viewpoint** (Intro TLV), **Studio 84** (דובנוב של ישראל-קנדה), **Studio Aiko** (ASSEMBLY, 2026, "cinematic animation"), **ANDO Studio** ("3D + AI"), Studio Mod, The Craft, NOTA, Aristo. ("Shimon Maman", "Archiviz" — לא אומתו; לא להשתמש.)
- נורמות שיווק (עיתונות): סרטי מותג עם סלבס בקצה העליון (PORT TLV ≈ ₪500K; PARK51 עם גווינת' פאלטרו; Intro TLV ≈ ₪3M); הטקס: משרד מכירות מוחשך → סרט → דירה לדוגמה; שמות לועזיים, "יוקרתי" על הכל, ריהוט מוקטן בהדמיות (ביקורת TheMarker). **[הסקה]**: 60–120 ש', פתיחה אווירית/מהים ("ריחוף"), dusk כ-hero, סלוגן בעברית + שם פרויקט באנגלית, לוגו ימין-למטה, "התמונה להמחשה בלבד".
- פנים שמוכר בת"א 2026: טרוורטין + גווני אדמה, אלון/אגוז, ראטן, פשתן גס, צורות אורגניות, דלתות שחורות/מתכת שחורה, גרניט ירקרק, אלומיניום שמפניה, Arabescato, עצי זית בעציצים; בינלאומי: "warm minimalism", fluted wood עולה, bouclé בשיא.

## 3. איך כלים מתחרים קוראים ל-presets
Veras 1.9 (30 presets, "Cinematic"/"Film Photography"); Rendair (Realistic/Watercolor/Drawing; Motion presets "Dynamic Motion", "Cinematic Drone"); D5 Render (AI Atmosphere Match, Style Transfer); Lumion (Day/Evening/RT Blue hour + LUTs); Enscape (Photorealistic/White/Sketch); Runway (תנועות בשפה טבעית, "golden-hour conversion"). **אף כלי AI-video לא מספק קטלוג סגנונות ייעודי לנדל"ן** — שטח פתוח.

## 4. שמונת ה-presets (ב-`presets.json`)
| id | עברית | מתי | ברירת מחדל |
|---|---|---|---|
| tlv-golden-hour | שעת הזהב | מגדלים לים, מרפסות, פנטהאוזים | ★ חוץ + פנים |
| blue-hour-glow | השעה הכחולה | ה-hero והחזית; מגדלים עירוניים צפופים | ★ חזית |
| med-noon | צהריים ים-תיכוני | חזיתות לבנות/אבן, פרויקטי חוף | |
| soft-overcast | אור רך | פרויקטים אדריכליים, חומרים, קונים שחושדים בגלוס | |
| dark-cinematic | יוקרה קולנועית | פנטהאוזים, branded residences, מסך משרד מכירות | |
| lived-in-morning | בוקר ראשון | פרויקטים משפחתיים, מטבחים, רשתות | |
| vertical-reel | ריל אנכי | 9:16, 15–25 ש', נגזר מכל preset אחר | |
| painterly-concept | קונספט מצויר | פריסייל מוקדם, deck לאדריכל | |

לכל preset: שעה/שמיים, דקדוק מצלמה לארבעת סוגי ה-shot, FOV במ"מ, grade/LUT, פלטת חומרים, lifestyle, מוזיקה, טיפוגרפיה, ו-prompt fragment באנגלית למודל התמונה/וידאו.

## 5. נורמות מסירה 2026
16:9 ל-master (אתר, משרד מכירות, YouTube) ב-1080p לפחות, 4K ל-hero; 9:16 לרשתות (לתכנן אנכי, לא לחתוך); 24 fps ל-master "קולנועי", 30 לרשתות; H.264, H.265 ל-4K; קליפ חוץ 8–12 ש', קליפ חדר 8–15 ש', סרט מלא 60–90 ש' (עד 120 למשרד מכירות); טיזר 20–45 ש' עם hook ב-2 ש' ולופ; כתוביות sound-off בעברית, אזורים בטוחים 15% למעלה / 20% למטה ב-9:16; לוגו ≤ 1 ש' בפתיחה או רק באאוטרו; "התמונה להמחשה בלבד" + גילוי AI; תנועות מצלמה איטיות (מהירות מעוותת וידאו AI).

## מקורות
The Boundary (Mercedes-Benz Places film) · Architizer — Mir interview · ArchDaily — Brick Visual · CGPress — Beauty and the Bit "Landmark" · Hayes Davidson — Viceroy reels · Architizer — Binyan · Studio Aiko — ASSEMBLY · ANDO Studio · Maverick Frame — Israeli studios · Nadlan Center 514 (PORT TLV), 14677 (PARK51) · ice.co.il 1055028 (Intro TLV) · mako — TheMarker critique · Maariv 1315757 (living rooms 2026) · Homeworld — Gindi TLV apartment · EvolveLAB — Veras 1.9 · Rendair — 3D to cinematic video · D5 docs — AI features · Lumion — signature style · Runway — real estate · Segmind — Seedance 2.5 real-estate shots · Morphed — AI video for real estate · Chaos blog — archviz trends · Golden Studio — rendering styles · Autoreel — 2026 playbook · Studiomatrx — exporting video.

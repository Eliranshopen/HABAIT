# מחקר: אינטגרציות, קריאות חיצוניות ומודלי AI ב-backend
<!-- 2026-11-08 · main session · follows 2026-11-08-visualization-stack-architecture.md -->

## Context
אלירן (2026-11-08): "בוא נתמקד כרגע על מה שהצעת ב-BACKEND ותעשה מחקר על מה נכון לי להשתמש עבור אינטגרציות, קריאות, מודלים (אם FAL או מודלים עצמאיים אחרים)".
ההמשך של מחקר הסטאק, שהמליץ על backend בשני מישורים: TypeScript באתר ו-Python בחישוב.

**עדכון היקף (אלירן, 2026-11-08):** "אני רוצה שנתכנן את ה-Backend. תחשוב על כל מה שצריך לתכנן". המחקר הורחב לתכנית backend מלאה. מה שנקבע:
- קונים: צפייה אנונימית בלבד.
- חיוב: לא בשלב הזה.
- התממשקות ליזם: בצד, ההתמקדות היא במערכת ההדמיות.

הפלט: `2026-11-08-backend-plan.md`.

## השאלות
1. **גישה למודלים:** להמשיך עם aggregator כמו fal.ai, או לעבור ישירות לספקים (OpenAI, Google, Anthropic, BFL, ByteDance)? אולי gateway כמו OpenRouter, Vercel AI Gateway או Replicate? או מודלים פתוחים שרצים אצלנו על GPU (FLUX, ComfyUI עם ControlNet)?
2. **מודל לכל משימה:** קריאת תוכנית (vision), restyle של חדר בלי לשנות גיאומטריה (add-only, ‏2% fidelity), וידאו, ו-LLM לסוכן ולצ'אט.
3. **שכבת האינטגרציה:** abstraction מעל הספקים (AI SDK, LiteLLM), retries ו-idempotency, webhook מול polling, cache לפי content hash, ledger לפני כל קריאה, observability, ניהול סודות.
4. **אינטגרציות שאינן AI:** Clerk, Supabase, אחסון, email, תשלום (רק למפות, לא להחליט).

## הביצוע
1. **Explore:** מיפוי כל קריאה חיצונית בקוד הקיים, כולל ספק, מודל, קובץ, איך מחייבים ואיפה ה-ledger. בלי לפתוח `.env`.
2. **מחקר A, מודלים:** מחירים לתמונה, איכות, שמירת מבנה (depth/edge conditioning), seed ודטרמיניזם, תנאי שימוש מסחרי ופרטיות, ועלות self-hosting מול API.
3. **מחקר B, שכבת אינטגרציה:** abstraction, gateway, observability, תורים ו-webhooks, ניהול עלויות.
4. **פלט:**
   - `development/plans/2026-11-08-backend-integrations-models.md`
   - פרק חדש בעמוד ה-HTML הקיים (אותו קישור)
   - רשומת זיכרון

## מה לא נעשה
אין קריאות בתשלום, אין שינוי קוד, ואין בחירת ספק. בחירת ספק בתשלום היא החלטה של אלירן (§6, §7).

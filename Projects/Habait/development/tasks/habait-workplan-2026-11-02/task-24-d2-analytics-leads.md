# משימה 24: D2: מדידה: PostHog (אירועים unit_click/unit_enter/room_view/floor_switch/favorite/lead_click), קישורי קמפיין, WhatsApp עם session, טופס → Google Sheet, דשבורד "דירות חמות/קרות"

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | D |
| **מקור בתכנית** | חלק ג §2 ערוץ D, שלב D2; חלק א §6, §11.5 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `platform-dev` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T2** |
| **גל (wave)** | 3 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

כל סיור הוא מכשיר מדידה: שכבת אירועים אחידה (`analytics.js`) עם שני backends: JSONL מקומי (היום) ו-PostHog (כשיש מפתח ב-config); `?src=<campaign>` נשמר ב-session; ליד בוואטסאפ/טופס נושא את "הדירות שנצפו"; טופס → Google Sheet דרך Apps Script; דשבורד HTML פשוט מה-JSONL/PostHog: דירות חמות/קרות, קומות, רצפות.

## תלויות

- W1-D1 (`js/analytics.js` כבר קיים כ-sink מקומי), 23
- **T2:** חשבון PostHog + Google Sheet = היד של אלירן; שליחת אירועים ולידים (מידע אישי) לצד שלישי → השאלה לאלירן + בדיקת qa-reviewer עצמאית לפני שמפתח אמיתי נכנס

## קלטים (קריאה)

- `Habait/platform/js/{analytics.js,lead.js,config.js}`
- חלק א §6 (מה מודדים ולמה: A/B ברמת הליד, לא הפרויקט)
- PostHog JS SDK (נעוץ מקומית)

## קבצים (הסוכן כותב רק כאן)

- `Habait/platform/js/analytics.js` (הרחבה), `Habait/platform/js/posthog-adapter.js`
- `Habait/platform/apps-script/lead-to-sheet.gs` + `README-he.md` (אלירן מדביק ב-Sheet שלו)
- `Habait/platform/dashboard.html` + `js/dashboard.js`
- `Habait/platform/test/analytics.test.mjs`
- `Habait/platform/_local/events.jsonl`

## צעדים

1. סכמת אירוע אחת: {event, ts, session_id, project, unit?, room?, floor?, src, dwell_ms?}; לכתוב ל-JSONL תמיד; ל-PostHog רק אם `config.posthog_key` קיים.
2. lead.js: WhatsApp text + טופס כוללים את רשימת הדירות שנצפו ב-session; שליחה ל-Apps Script endpoint (מ-config) → Sheet.
3. dashboard.html: קורא JSONL (או PostHog API) → טבלת דירות לפי צפיות/כניסות/זמן; חם/קר.
4. T2: לנסח לאלירן את השאלה (לפתוח PostHog + Sheet; איזה מספר WhatsApp), ולבקש מהסשן המפעיל `qa-reviewer` על: מה בדיוק נשלח החוצה, ושאין PII מעבר למה שאלירן אישר.

## קריטריוני קבלה

- [ ] בלי מפתח: כל האירועים נכתבים ל-JSONL, אפס בקשות רשת לצד שלישי (נבדק ב-Playwright network log).
- [ ] עם מפתח (מדומה בטסט): אותם אירועים נשלחים ל-endpoint בפורמט PostHog capture.
- [ ] ליד כולל `units_viewed`; הדשבורד מציג חם/קר מה-JSONL.
- [ ] שאלת T2 מנוסחת; דוח ה-qa-reviewer מצורף לפני הפעלת מפתח אמיתי.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node test/analytics.test.mjs
# צפוי: "no-key mode: 0 external requests, 7 events in JSONL", "key mode: 7 capture calls to mock endpoint", "lead payload has units_viewed", exit 0
```

**Reviewer scope:** פרטיות בלבד: מה נשלח החוצה (שדות), מתי (רק עם מפתח), ושאין מזהה אישי מעבר ל-session_id ומה שאלירן אישר.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 (PostHog Cloud 1M אירועים/חודש חינם; Google Apps Script חינם)

## דרגת הכרעה

**T2:** השאלה לאלירן **וגם** בדיקה עצמאית של `qa-reviewer` (הקשר נקי, מנסה להפריך) לפני שהצעד הבלתי-הפיך (מפתח אמיתי / פריסה / שליחת מידע החוצה) מתבצע.

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

_(platform-dev, 2026-11-02 ~15:00–16:00 שעון המכונה; הופעל על ידי habait-4b; העץ הראשי `C:\RnD\Projects\Habait\habait-walkaround\Habait\platform`, אין worktree; ריצה אחת נעצרה באמצע על מגבלת הקצב והמשיכה מההקשר השמור)_

- **מצב:** DONE (סוכן) עם **T2 פתוח**: אין מפתח אמיתי ואין URL אמיתי. לפני שהם נכנסים צריך את התשובה של אלירן (למטה) ואת בדיקת `qa-reviewer` בהקשר נקי על רשימת השדות. לא יכולתי להפעיל את qa-reviewer מכאן (אין לי כלי Agent), אז הסשן המפעיל מריץ אותו. החיבור לדפים עצמם (2 שורות ב-serve.mjs ושורות קריאה ב-apartment.js/flow.js/picker.js) נמצא בנתיבים של ab, והוא מופיע תחת "קורא שני".
- **מה נעשה:**
  - **`js/analytics.js` (הרחבה בלבד):** כל ה-exports הקיימים נשארו עם אותן חתימות. `EVENTS` **לא שונה**, כי `test/smoke.mjs` נועץ `EVENTS.length === 11`. האירועים החדשים `room_view`, `floor_switch` ו-`favorite` נכנסו ל-`EVENTS_D2`, ו-`KNOWN_EVENTS` = שתי הרשימות יחד. מה נוסף:
    - רשומה שטוחה אחת לכל אירוע (`toRecord`): `{event, ts, session_id, project, unit?, room?, floor?, finish?, src, dwell_ms?, tab?, channel?, scene?, prev?, on?, page?, lang?, via?, mode?, status?, units_viewed?, stubbed?, path, test?}`. זו allowlist, כך ששדות הטופס (שם/טלפון/מייל) לא נכנסים אף פעם לאירוע.
    - `?src=` (וגם `utm_campaign`/`utm_source`) נשמר ב-sessionStorage לכל ה-session ונכנס לכל אירוע. בלי מקור הערך הוא `direct`.
    - הדירות שנצפו נשמרות ל-session (sessionStorage), כך ש-`unitsViewed()` רואה גם דירות מדפים קודמים באותה לשונית.
    - פונקציות עזר: `setFavorite/favorites/isFavorite` (המועדפים נשמרים ב-localStorage במכשיר בלבד), `floorSwitch({finish|floor, prev})`, `startDwell(room)` → `room_view{dwell_ms}`, `campaignSource/setCampaignSource`, `flushEvents`, `analyticsConfig`.
    - **שני backends:**
      - (1) sink מסוג JSONL: נשלח ב-batch, ב-sendBeacon בזמן `pagehide`, **רק לאותו origin**, ורק כשהשרת מכריז עליו (`Server-Timing: habait-sink`) או כש-`config.sink_url` קיים. דף שמוגש בלי ה-mount לא שולח כלום, ולכן אין 405 ואין שגיאות console. זה מה שמשאיר את browser.mjs ירוק.
      - (2) PostHog **רק כש-`posthog_key` קיים**: `posthog-adapter.js` נטען ב-import דינמי, ובלי מפתח הקובץ לא נטען בכלל.
    - הקונפיג נקרא מ-`window.HABAIT_CONFIG` ומ-`initAnalytics({config:{...}})`. הדרך הישנה (`window.POSTHOG_KEY`) עדיין עובדת.
    - **שינוי התנהגות אחד במצב מפתח, מכוון:** קודם הקוד שלח את כל ה-properties, כולל `$current_url` ו-`distinct_id` קבוע מ-localStorage. עכשיו הכול עובר דרך ה-allowlist, ו-`distinct_id` = session_id.
  - **`js/posthog-adapter.js` (חדש):** משתמש ב-posthog-js **1.444.2** שנעוץ מקומית. ה-build הוא `module.slim.no-external`, ESM, 170 KB. הקובץ זהה בבייטים ל-tarball של npm (ה-integrity של ה-tarball אומת), sha256 `f5f29337…485eb7`, והרישיון לידו.
    - כבוי: autocapture, pageview/pageleave, הקלטה, surveys, flags/decide, remote config, טעינת סקריפטים חיצוניים, persistence (memory בלבד).
    - `before_send` בונה מחדש את ה-properties מה-allowlist ומוחק `$set`/`$set_once`.
    - `$process_person_profile=false`.
    - יש transport חלופי בשם `http`: קריאת `/capture/` אחת לכל אירוע.
    - ה-SDK זורק תעבורה של `navigator.webdriver`, ולכן לטסט יש מתג `posthog_allow_bots`. ב-production הוא כבוי.
  - **`js/lead.js` (הרחבה בלבד):**
    - `buildWhatsAppLink({..., viewed})` מוסיף שורה `viewed:846,857`. בלי `viewed` הקישור זהה לקודם.
    - חדשים: `leadPayload()`, שממלא `units_viewed`, `src`, `session_id` ו-`ts`, ו-`sheetEndpoint(project)`, שמקבל רק https או 127.0.0.1.
    - `submitLead` משתמש בשניהם.
    - `renderLeadBlock` מרענן את קישור ה-WhatsApp בלחיצה, כדי שהקישור יכלול גם דירות שנצפו אחרי שהכרטיס נפתח.
  - **`tools/events-sink.mjs` (חדש):**
    - `POST /api/events`: מקבל NDJSON או מערך JSON. רק מאותו origin (אחרת 403), עד 256 KB, ועם allowlist גם בצד השרת. כותב שורה לכל אירוע ל-`_local/events.jsonl` ומחזיר 204.
    - לכל תגובה אחרת מוסיף את כותרת `Server-Timing` שמכריזה על ה-sink.
    - יש גם מצב standalone: `node tools/events-sink.mjs --port 8851` מריץ את serve.mjs יחד עם ה-sink. ה-mount עצמו ב-serve.mjs **לא בוצע** (הקובץ של ab).
  - **`apps-script/lead-to-sheet.gs`:**
    - `doPost` מוסיף שורה ללשונית `Leads` (15 עמודות), עם lock.
    - דוחה ליד בלי הסכמה, עם טלפון לא תקין, או מעל 5 לידים ל-session ב-10 דקות.
    - תא שמתחיל ב-`= + - @` מקבל `'` בהתחלה, כדי שלא תהיה הזרקת נוסחה.
    - `doGet` משמש כ-health.
  - **`apps-script/README-he.md`:** הצעדים לאלירן (PostHog, Sheet, WhatsApp, קישורי קמפיין) ורשימת השדות שיוצאים.
  - **`dashboard.html` + `js/dashboard.js` + `css/dashboard.css`:**
    - עברית RTL, עם כפתור EN.
    - 4 KPI: ביקורים, נכנסו לדירה, לידים, המרה.
    - טבלת דירות חם/פושר/קר. **כל** דירות `units.json` מופיעות, כולל דירות קרות בלי שום אירוע. הציון = לחיצה ×1, כניסה ×3, דקת צפייה ×1, לשונית ×0.5, מועדף ×4, session עם ליד ×8. השליש העליון של הדירות הפעילות = חם.
    - טבלאות: קומות (מ-units.json), חדרים (זמן צפייה), רצפות (`floor_switch.finish`), מקורות (`src` עם המרה).
    - "הגדרות מתקדמות": קובץ, תקופה, אירועי בדיקה (מוסתרים כברירת מחדל, `test:true` מ-webdriver), ו-PostHog query API (HogQL). ה-Personal key נשמר ב-localStorage בלבד.
    - ממפה אירועים ישנים: `room_view{tab}` → `apartment_tab`, ו-`lead_click{channel:'zip'}` → `zip_download`.
    - כיתוב משפטי קצר בפוטר.
  - **`test/analytics.test.mjs`:** בדיקות node (רשומה, sink, Apps Script ב-vm) ו-Playwright ב-iphone/pixel/desktop:
    - harness שנכתב ל-`_local/analytics-test/` ומוגש מהשרת האמיתי עם ה-sink.
    - `apartment.html` האמיתי.
    - mock של PostHog/Apps Script.
    - הדשבורד, כולל מסלול PostHog API מול ה-mock.
  - **הכרעות T0:**
    - (1) `distinct_id` = session_id ולא מזהה מכשיר קבוע, כלומר בלי מעקב בין ביקורים. אם אלירן ירצה "חוזרים", זו החלטה נפרדת.
    - (2) EVENTS לא גדל, כדי לא לשבור את smoke.mjs.
    - (3) ה-SDK ולא HTTP כברירת מחדל במצב מפתח, כי הכרטיס ביקש SDK נעוץ. שני ה-transports שולחים בדיוק את אותה allowlist (נבדק).
    - (4) הזיהוי של ה-sink נעשה דרך Server-Timing ולא דרך בקשת probe.
- **קבצים שנכתבו** (תחת `Habait/platform/`):
  - שונו: `js/analytics.js`, `js/lead.js` (תוספות בלבד).
  - חדשים: `js/posthog-adapter.js`, `js/vendor/posthog-js-1.444.2.module.slim.no-external.js`, `js/vendor/posthog-js-1.444.2.LICENSE.txt`, `tools/events-sink.mjs`, `apps-script/lead-to-sheet.gs`, `apps-script/README-he.md`, `dashboard.html`, `js/dashboard.js`, `css/dashboard.css`, `test/analytics.test.mjs`.
  - פלט הטסט: `_local/analytics-test/{events.jsonl, harness-*.html}`.
  - `_local/events.jsonl` עוד לא קיים. הוא נוצר באירוע הראשון אחרי ה-mount.
  - לא נגעתי ב: index.html, flow.html, js/flow.js, js/picker.js, js/apartment.js, css/style.css, js/i18n.js, fixtures/, serve.mjs.
- **Check מותאם** (9 סוגי אירועים, 11 אירועים, ולא "7"; גם sdk וגם http):
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node test/analytics.test.mjs
```
- **פלט ה-Check (מילה במילה):**
```
ok   node: every D2 event is known; EVENTS (pinned by smoke.mjs) unchanged
ok   node: toRecord = flat schema, allowlist only (form fields never enter an event)  (event,ts,session_id,project,src,unit,room,dwell_ms,scene)
ok   node: sink sanitizes forged records (unknown fields, bad event names dropped)
ok   node: Apps Script appends one row, refuses no-consent, defuses formulas  (columns 15)
ok   sink: POST from another origin is refused; GET is not allowed; pages announce the sink
ok   iphone: no-key mode: 0 external requests, 9/9 event types in JSONL, ?src kept for the session  (9 requests, all 127.0.0.1; 11 events)
ok   pixel: no-key mode: 0 external requests, 9/9 event types in JSONL, ?src kept for the session  (9 requests, all 127.0.0.1; 11 events)
ok   iphone: apartment.html (no key) writes unit_enter / room_view to the JSONL, 0 external requests  (3 events, 22 requests all local)
ok   pixel: key mode (sdk): same events reach the mock in PostHog capture format; allowlist only; lead -> Sheet  (11 events, POST /e/)
ok   desktop: key mode (http): same events reach the mock in PostHog capture format; allowlist only; lead -> Sheet  (11 events, POST /capture/)
ok   iphone: dashboard shows hot / cold units from the JSONL (Hebrew RTL, 0 external requests)  (826:cold 835:cold 836:cold 837:cold 845:cold 846:hot 847:cold 855:cold 856:cold 857:warm 866:cold 876:cold)
ok   desktop: dashboard shows hot / cold units from the JSONL (Hebrew RTL, 0 external requests)  (826:cold 835:cold 836:cold 837:cold 845:cold 846:hot 847:cold 855:cold 856:cold 857:warm 866:cold 876:cold)

no-key mode (iphone): 0 external requests, 9/9 event types (11 events) in JSONL
no-key mode (pixel): 0 external requests, 9/9 event types (11 events) in JSONL
key mode (sdk): 11 capture events to mock endpoint (11 HTTP calls: POST /e/)
lead payload has units_viewed (sdk): ["846","857"]
key mode (http): 11 capture events to mock endpoint (11 HTTP calls: POST /capture/)
lead payload has units_viewed (http): ["846","857"]
dashboard (iphone): 826:cold 835:cold 836:cold 837:cold 845:cold 846:hot 847:cold 855:cold 856:cold 857:warm 866:cold 876:cold
dashboard (desktop): 826:cold 835:cold 836:cold 837:cold 845:cold 846:hot 847:cold 855:cold 856:cold 857:warm 866:cold 876:cold
outbound (sdk) request body keys: api_key, batch, sent_at
outbound (sdk) event keys: event, properties, timestamp, uuid
outbound (sdk) properties: $lib, $process_person_profile, channel, distinct_id, dwell_ms, finish, floor, on, page, path, prev, project, room, session_id, src, status, stubbed, tab, test, token, unit, units_viewed, via
outbound (sdk) calls: POST /e/; query params: -
outbound (sdk) request headers: accept, accept-encoding, accept-language, connection, content-length, content-type, host, origin, referer, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, user-agent; Referer: http://127.0.0.1:54015/
outbound (sdk) lead fields: consent, floor, lang, name, phone, price, project, session_id, src, status, ts, unit, units_viewed, url
outbound (http) request body keys: api_key, event, properties, timestamp
outbound (http) event keys: api_key, event, properties, timestamp
outbound (http) properties: $lib, $process_person_profile, channel, distinct_id, dwell_ms, finish, floor, on, page, path, prev, project, room, session_id, src, status, stubbed, tab, test, unit, units_viewed, via
outbound (http) calls: POST /capture/; query params: -
outbound (http) request headers: accept, accept-encoding, accept-language, connection, content-length, content-type, host, origin, referer, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, user-agent; Referer: http://127.0.0.1:54015/
outbound (http) lead fields: consent, floor, lang, name, phone, price, project, session_id, src, status, ts, unit, units_viewed, url

all green; screenshots in C:\Users\elira\AppData\Local\Temp\habait-analytics-shots
EXIT=0
```
- **רגרסיה:**
  - `npm test` לפני ואחרי: all green, 11/11.
  - `node test/browser.mjs http://127.0.0.1:8850` לפני ואחרי: **22/22 all green**. הוא רץ מול :8850 החי של ab, בלי mount, ולכן גם בלי פוסטים ל-sink.
  - `test/apartment.test.mjs` אחרי: all green.
  - אחרי ה-Check היחיד נגעתי רק בדשבורד: זמן צפייה מתחת ל-10 ש' מוצג עם ספרה אחרי הנקודה, ונתיב הקובץ בכותרת מקבל LTR isolate.
- **כסף:** $0. אין ledger. רשת: רק `npm pack posthog-js@1.444.2` מה-registry.
- **מה יוצא מהמכשיר (רק במצב מפתח; לבדיקת qa-reviewer, כל שורה נבדקה בטסט מול mock):**
  - **ל-PostHog (`posthog_key`), transport `sdk`:**
    - גוף הבקשה: `api_key` (מפתח הפרויקט הציבורי), `batch[]`, `sent_at`.
    - לכל אירוע: `uuid` (אקראי לאירוע), `event`, `timestamp`.
    - `properties`: `token` (אותו מפתח), `distinct_id` (= session_id של הלשונית), `$lib`=`habait-platform`, `$process_person_profile`=false, ומתוך ה-allowlist רק השדות שקיימים באירוע: session_id, project, unit, room, floor, finish, src, dwell_ms, tab, channel, scene, prev, on, page, lang, via, mode, status (סטטוס הדירה), units_viewed (מזהי דירות), stubbed, path (pathname בלבד, בלי query), test.
  - **ל-PostHog, transport `http`:** אותו דבר, בלי `uuid`/`batch`/`sent_at`/`token`, ועם `api_key` ברמת האירוע.
  - **לא יוצאים ל-PostHog:** שם, טלפון, מייל, URL מלא, referrer של הדף, cookie, localStorage, מזהה מכשיר, `$browser`/`$os`/`$screen`/`$device_id`/`$current_url`/`$ip` כ-property.
  - **ברמת הרשת (כמו בכל בקשה):** כתובת IP (PostHog שומר אותה אלא אם מסמנים Discard client IP data), User-Agent, sec-ch-ua (מותג ודגם דפדפן, mobile, פלטפורמה), Accept-Language, ו-Origin/Referer **origin בלבד** (ברירת המחדל strict-origin-when-cross-origin; נבדק).
  - **ל-Google Sheet (`sheet_endpoint` / `leads.webhook_url`), רק בשליחת טופס עם סימון הסכמה:** name, phone, consent, project, unit, floor, price, status, units_viewed, src, session_id, lang, ts, ו-url (ה-`location.href` המלא, כולל `sid`/`src`/`project`/`unit`). ברמת הרשת: IP ו-User-Agent אל Google.
  - **ל-WhatsApp (רק בלחיצה, והרוכש שולח בעצמו):** הודעה + `project|unit|session_id` + `viewed:<דירות>`.
  - **הדשבורד:** פונה ל-PostHog API רק אם מקלידים בו Project ID ו-Personal key. אחרת הוא קורא רק את הקובץ המקומי.
  - **בלי מפתח (היום):** אפס בקשות ל-host שאינו 127.0.0.1. נבדק בשני טלפונים, ב-harness וגם ב-apartment.html האמיתי.
- **שאלה לאלירן (T2), אחת עם שלושה חלקים, ברירת מחדל = להישאר בלי מפתחות:**
  "כדי שהמדידה והלידים יגיעו אליך צריך שלושה דברים, כל אחד 5 דקות. כל הצעדים כתובים ב-`Habait/platform/apps-script/README-he.md`.
  (א) **PostHog:** posthog.com → Get started free עם office@habait.ai, US Cloud, פרויקט `habait-platform`, Skip בהתקנה. ב-Settings → Project: להעתיק את ה-Project API key (`phc_…`), לסמן **Discard client IP data**, ולוודא ש-Session replay כבוי. את ה-`phc_` לשלוח בצ'אט של ab (הוא ציבורי). רשות לדשבורד: Personal API key עם `query:read` (`phx_…`). המפתח הזה סודי ומודבק רק בדשבורד, לא בצ'אט.
  (ב) **Google Sheet:** sheets.new → Extensions → Apps Script → להדביק את `lead-to-sheet.gs` → Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone → לאשר הרשאות → לשלוח את ה-URL שמסתיים ב-`/exec`.
  (ג) **מספר WhatsApp** של מי שעונה ללידים, בפורמט 9725XXXXXXXX.
  מאשר שאלה השדות שיוצאים (הרשימה למעלה), ובמיוחד שם + טלפון ל-Sheet? ברירת מחדל: עד שתשלח, הכול נשאר מקומי."
- **פגמים פתוחים:**
  1. **ה-sink לא מחובר ב-:8850** עד ש-ab מוסיף את שתי השורות ל-serve.mjs. עד אז הדפים החיים לא כותבים JSONL, והדשבורד מציג "אין עדיין אירועים" (עם 404 ב-console על הקובץ החסר).
  2. **`floor_switch`, `favorite`, `apartment_tab` ו-`zip_download` עוד לא נורים מהדפים האמיתיים.** הקוד קיים ב-analytics.js, אבל נקודות הקריאה נמצאות ב-apartment.js/picker.js, שהם של ab. בינתיים הדשבורד ממפה את `room_view{tab}` ואת `lead_click{zip}`. ב-picker אין כפתור מועדפים.
  3. **המפתח לא מגיע לדפים** עד ש-ab מעביר `config` ל-`initAnalytics` (בלוק `analytics` ב-project.json, אין עדיין בסכמה).
  4. ה-dist העצמאי (`build_zip.mjs`) מעתיק את analytics.js בלי `posthog-adapter.js` ובלי ה-vendor. במצב מפתח ה-import הדינמי ייכשל, והאירועים יישארו מקומיים (warn ב-console). צריך להוסיף אותם להעתקה כשמדליקים מפתח.
  5. serve.mjs מגיש את `_local/events.jsonl` (וגם את `dashboard.html`) לכל מי שמגיע ל-:8850. אסור לפרוס את `_local` או את הדשבורד בכתובת ציבורית בלי הגנה. הדשבורד `noindex`, אבל אין לו התחברות.
  6. **תהליך תקוע שלי:** heredoc ששלחתי ל-`python -` של anaconda (‏PID 89623, וה-bash שלו 89622) ממתין ל-stdin. הוא לא נוגע בשום קובץ. בקשת ה-kill נחסמה על ידי ההרשאות, אז מי שיכול יכול לסגור אותו.
  7. ב-picker ה-WhatsApp מקבל עכשיו שורת `viewed:` נוספת. ה-regex של browser.mjs עדיין עובר, אבל זה שינוי בטקסט שהרוכש רואה.
- **קורא שני:**
  - **habait-ab** (בעלים של `Habait/platform`; מחייב אותו כי בלי זה המדידה לא עובדת בדפים החיים):
    - (א) mount ב-`serve.mjs`: `import { eventsSink } from './tools/events-sink.mjs';` ובשורה הראשונה של `handle()`, **לפני** בדיקת GET/HEAD: `if (await eventsSink(req, res)) return;`.
    - (ב) ב-`apartment.js`, שתי השורות הבאות כתוספת לקריאות `room_view{tab}`/`lead_click{zip}` הקיימות, לא במקומן (הדשבורד ממפה את הישנות):
      - ב-`onView`, כש-`v.floor` משתנה: `floorSwitch({ unit: U.id, finish: v.floor, prev: state.floor })`.
      - `capture('apartment_tab', {unit, tab, from})` ב-`showTab`, ו-`capture('zip_download', {unit, tab})` בכפתור ה-ZIP.
    - (ג) `initAnalytics({ base, config: P.analytics })` ב-apartment.js ו-flow.js, ובלוק `analytics {posthog_key, posthog_host}` ב-project.schema/fixture. `leads.sheet_endpoint` = alias ל-`webhook_url`.
    - (ד) picker: כפתור מועדף → `setFavorite(unit, on)`. בחירת קומה במגירה → `floorSwitch({ floor })`.
    - (ה) כשמכניסים את `EVENTS_D2` ל-`EVENTS`, לעדכן את `test/smoke.mjs` מ-11 ל-14.
    - (ו) `build_zip.mjs`: להעתיק את `posthog-adapter.js` ואת קובץ ה-vendor ל-dist כשמדליקים מפתח.
    - (ז) לא לפרסם את `_local/` ואת `dashboard.html` בציבור.
  - **habait-98** (Vercel habait-flow): אם הוא מעלה עותק של `js/analytics.js`, בלי mount אין פוסטים ואין שגיאות, והכול נשאר מקומי. אין פעולה נדרשת, רק לא לפרוס את `dashboard.html`/`_local`.
- **לזיכרון:** D2 חי בקוד: analytics.js כותב רשומה שטוחה ל-sink JSONL של אותו origin (`tools/events-sink.mjs`, דורש mount של 2 שורות ב-serve.mjs על ידי ab) ול-PostHog רק עם `posthog_key` (posthog-js 1.444.2 נעוץ, allowlist, distinct_id=session). ?src לכל session, units_viewed בליד וב-WhatsApp, Apps Script ל-Sheet, ו-dashboard.html (חם/קר). בלי מפתח: 0 בקשות חיצוניות. T2: qa-reviewer + אלירן. $0.

---

## תוצאה (חיווט + תיקוני T2)

_(platform-dev, 2026-11-02 ~16:20–17:05 שעון המכונה; הופעל על ידי habait-4b אחרי מסירת ערוצי A/C/D/E מ-ab; העץ הראשי `Habait/platform`, בלי git; $0, בלי API בתשלום ובלי `claude -p`)_

- **מצב:** החיווט (א)–(ז) בוצע. פגמי ה-T2 1, 2 ו-3 תוקנו. 4 תוקן בקוד, אבל דורש בדיקה ידנית של שורה אחת ב-Google. 5 תוקן חלקית. 6 ו-7 תועדו.
  - **:8850 עוד לא הופעל מחדש** (בהוראת 4b). עד ה-restart השרת החי מריץ את serve.mjs הישן מהזיכרון, בלי sink. קובצי ה-JS החדשים כבר מוגשים מהדיסק.
  - T2 נשאר פתוח מול אלירן: מפתח PostHog, Sheet, מספר WhatsApp, הכרעה על שורת `viewed:` ו-`LEAD_SECRET`.
- **Baseline (לפני כל שינוי):**
  - `npm test`: EXIT=0 (11 ok)
  - `analytics.test`: EXIT=0 (12 ok)
  - `browser.mjs` מול :8850: EXIT=0 (22/22)
  - `apartment.test`: EXIT=0 (36 ok)

### מה השתנה, לפי פריט

- **(א) mount:** `serve.mjs` מקבל import של `eventsSink`, ושורה ראשונה ב-`handle()` לפני בדיקת GET/HEAD.
  - ב-smoke נוסף טסט: הכרזת Server-Timing, POST בלי Origin = 403, POST עם Origin = 204, GET = 405.
  - **תופעת לוואי:** גם `smoke.mjs` ו-`apartment.test.mjs` מרימים את serve.mjs, ולכן אירועי הטסט שלהם נכתבים עכשיו ל-`_local/events.jsonl` האמיתי. כולם מסומנים `test:true`, והדשבורד מסתיר אותם כברירת מחדל. את 197 השורות שנוצרו בזמן העבודה מחקתי, והקובץ מתחיל נקי.
- **(ב) `js/apartment.js`:**
  - `floorSwitch({unit, finish: v.floor, prev})` נורה כשהרצפה בסיור מתחלפת, רק כשיש רצפה קודמת.
  - `capture('apartment_tab', …)` נורה ליד `room_view{tab}`, ו-`capture('zip_download', …)` ליד `lead_click{zip}`. השמות הישנים נשמרו.
  - `js/dashboard.js` מזהה את הכפילות: ב-session שיש בו את השם החדש, הישן מסומן `legacy_twin` ולא נספר פעמיים.
- **(ג) config:**
  - `initAnalytics({ base, config: P.analytics || {} })` ב-apartment.js, ו-`config: ctx.meta.analytics || {}` ב-flow.js.
  - **חדש: `contracts/project.schema.json`.** סכמה פתוחה: רק `id` חובה, השדות הקיימים לפי type בלבד, בלי reshape. בלוק `analytics` מחמיר: `posthog_key` = `phc_…` או ריק (לא `phx_`), `posthog_host` https, `posthog_transport`, `whatsapp_viewed_line` boolean, `lead_secret` 16–120 תווים או ריק, `note`.
  - `validate.mjs` בודק את project.json מול הסכמה (תוספת).
  - ב-fixture `fixtures/rainbow/project.json` נוסף בלוק `analytics` עם `posthog_key: ""`, `whatsapp_viewed_line: false`, `lead_secret: ""`.
  - analytics.js קורא גם `HABAIT_CONFIG.analytics`. חדש: `configValue(name)`.
- **(ד) picker.js** (נכתב רק אחרי "picker: go" של 4b. בזמן הפריסה של 98 הוא הוחזר למקור, בדיוק 19550 בתים, והטלאי חיכה ב-`_local/`):
  - כפתור ☆/★ `#unitFav` בכותרת כרטיס הדירה. הוא מפעיל `analytics.setFavorite(unit, on)`; host בלי setFavorite מקבל `storeFavorite` + `capture('favorite')`. `aria-pressed`, ותוויות עבריות ואנגליות.
  - `opts.favorites=false` מסתיר את הכפתור. `picker.toggleFavorite(id, on?)` חדש.
  - בחירת דירה מהמגירה בקומה אחרת → `floorSwitch({floor, prev, unit, via:'drawer'})`. host בלי floorSwitch מקבל `capture('floor_switch')`.
  - שורת `viewed:` נשלחת רק אם `project.analytics.whatsapp_viewed_line === true`. ברירת המחדל כבויה, כלומר ההודעה של היום לא השתנתה.
  - **תיקון הבאג של 98 ב-`resolveOverlaps()`:** רוחב מלא נמדד רק כשהתווית לא compact, ונשמר ב-`_fullW`.
    - 98 מדד הבהוב ב-:8899. שחזרתי אותו: עם השורה הישנה, 3 תוויות דסקטופ ב-120 פיקסלים זו מזו קופצות בכל פריים `52c → 151f → 52c → 151f`. עם התיקון: `52c` יציב.
    - טסט חדש ב-`browser.mjs` (1280 פיקסלים, 12 פריימים).
  - `css/style.css`: כלל `.unit-fav` (תוספת).
  - `browser.mjs`: 3 צעדים חדשים (floor_switch מהמגירה, מועדף on/off + אין `viewed:` כברירת מחדל, הבהוב) → 25 צעדים.
  - כל השינויים additive: אותם exports, ואותם selectors שהטסטים ו-:8899 משתמשים בהם.
- **(ה)** `EVENTS_D2` נכנס ל-`EVENTS` (14). `smoke.mjs` עודכן מ-11 ל-14. `EVENTS_D2` ו-`KNOWN_EVENTS` עדיין מיוצאים.
- **(ו) `tools/build_zip.mjs`:**
  - `posthog-adapter.js`, ה-vendor וה-LICENSE מועתקים **רק כשיש `posthog_key` (`phc_`)**.
  - אחרי ההעתקה, sha256 של כל קובץ JS ב-dist מושווה למקור. אי-התאמה = כשל הבנייה.
  - בלוק `analytics` (allowlist, בלי ערכים ריקים) נכנס ל-manifest.
  - **ה-dist של 846 נבנה מחדש** (`node tools/build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846`, EXIT=0, 13.6 ש'). `assets/js/analytics.js` sha256 `f187739bef07…` = `js/analytics.js`. אין adapter ואין posthog ב-vendor. בעותק אין יותר `$current_url`. `distinctId()` עדיין מיוצא, אבל אף אחד לא קורא לו.
  - נבדקה גם בנייה עם מפתח דמה (בתיקייה זמנית שנמחקה): adapter + SDK + LICENSE הועתקו, וה-hash של ה-adapter תואם.
- **(ז)** `build_zip.mjs` נכשל אם ב-dist או ב-ZIP יש `dashboard.*`, `_local` או `events*.jsonl`. בבנייה של 846 לא נמצא כלום כזה. אין מה לפרוס.

### תיקוני ה-T2

- **פגם 1 (ערכים): תוקן.** ב-`js/analytics.js` יש עכשיו `sanitizeRecord` משותף: אותה פונקציה רצה ב-`toRecord` וב-`tools/events-sink.mjs`, שמייבא אותה.
  - שדות טקסט חופשי חייבים להתאים ל-`^[A-Za-z0-9_.:-]{1,40}$`, אחרת הם מוחלפים ב-`"other"`. השדות: project, unit, room, finish, src, tab, channel, scene, prev, page, lang, via, mode, status.
  - נמחק לגמרי ערך שיש בו `@`, 7 ספרות ומעלה, או סכמה/`//`/`www.`/דומיין עם TLD מוכר.
  - `floor`: מספר עד ±500. בוליאנים: רק true/false. `units_viewed`: רק טוקנים. `path`: `^/[A-Za-z0-9_./-]` ואחרת `/other`. `session_id`: `^[A-Za-z0-9-]{6,80}$`.
  - `?src=` שנראה אישי לא נשמר ל-session ונופל ל-`direct`.
  - `$current_url` הוסר גם מה-buffer שבזיכרון.
  - **טסטים:**
    - node: אובייקט HOSTILE (טלפון ב-room וב-scene, מייל ב-via, URL ב-page, `tel:` ב-channel, markup, 300 תווים, עברית) עובר דרך toRecord ודרך ה-sink.
    - דפדפן במצב מפתח: `capture('room_view', HOSTILE)` מגיע ל-mock פעם אחת, נקי (`room/via/scene/page/prev/channel/floor` לא קיימים, `finish:"other"`), וגם ל-JSONL.
    - בדיקת ערכים (`personalValues`) על **כל** אירוע ב-mock וב-JSONL.
- **פגם 2 (dist ישן): תוקן.** ראו (ו).
- **פגם 3 (sink): תוקן** ב-`tools/events-sink.mjs`:
  - `Origin` חובה ושווה ל-Host. בלי Origin, `null` או origin זר → 403.
  - בקשה מעל 16 KB → 413 (גם לפי content-length). מעל 50 אירועים → 413.
  - token bucket של 60 אירועים לדקה לכל IP. העודף נזרק בשקט (204 + `X-Habait-Dropped: rate`), כדי שלא יופיעו שגיאות console אצל הרוכש.
  - הקובץ מפסיק לגדול ב-50 MB (`X-Habait-Dropped: file-cap` ואזהרה אחת בשרת).
  - הלקוח שולח עד 25 אירועים / כ-12 KB בבקשה.
  - הכול ניתן להגדרה ב-`createEventsSink`/`startWithSink`. טסט ייעודי על sink נפרד.
- **פגם 4 (Apps Script): תוקן בקוד, ולא אומת מול Google.**
  - מגבלות בצד השרת, ב-CacheService בתוך ה-lock: 10 לדקה ו-120 לשעה לכל הסקריפט, 3 לטלפון לשעה, 5 ל-session ל-10 דקות. session id חדש לא מאפס אותן (נבדק).
  - `LEAD_SECRET` ב-Script Properties ↔ `k` בגוף הבקשה או ב-`?k=`, מתוך `analytics.lead_secret`. `k` לא נכתב לגיליון.
  - הטלפון: ספרות ו-+ מוביל, עמודה ותא ב-`setNumberFormat('@')` ו-`setValue` כמחרוזת, בלי גרש. ב-mock: `0501234567` ו-`+972501234567` נשמרו כמו שהם.
  - `README-he.md` צעדים 7–8: הגדרת הסיסמה, ו**בדיקה ידנית חובה של שורה אחת** (אפס מוביל, `=1+1` כטקסט, units_viewed).
- **פגם 5 (טסט חלש): תוקן חלקית.** נוספו בדיקת ערכים על כל אירוע, קלט HOSTILE, ו-403 בלי Origin.
  - נשאר: רשימת המפתחות המותרים עדיין נגזרת מ-`adapter.OUTBOUND_FIELDS`. אין תצפית על pagehide/unload. מצב מפתח עדיין נבדק על harness ולא על apartment.html.
- **פגם 6 (מפתח `phx_` ב-localStorage של הדשבורד, אותו origin): לא טופל.** ההנחיה בעינה: לא לפרוס דשבורד או `_local` בציבור.
- **פגם 7 (`sid` ל-origin של הסיור) ו-`url` המלא בליד: תועדו** ב-README-he.md. היום הסיור על 127.0.0.1. בפרודקשן עם סיור בדומיין אחר זו בקשה חיצונית שנושאת session אקראי.

### פלט הבדיקות אחרי (מילה במילה)

**`timeout 300 npm test`**
```

> habait-platform@0.1.0 test
> node contracts/validate.mjs fixtures/rainbow && node test/smoke.mjs

warn  unit "845" uses the placeholder descend "descend-846"
warn  unit "847" uses the placeholder descend "descend-846"
warn  unit "856" uses the placeholder descend "descend-846"
warn  unit "855" uses the placeholder descend "descend-846"
warn  unit "857" uses the placeholder descend "descend-846"
warn  unit "836" uses the placeholder descend "descend-846"
warn  unit "835" uses the placeholder descend "descend-846"
warn  unit "837" uses the placeholder descend "descend-846"
warn  unit "866" uses the placeholder descend "descend-846"
warn  unit "826" uses the placeholder descend "descend-846"
warn  unit "876" uses the placeholder descend "descend-846"
fixtures/rainbow: OK - 12 units, 5 segments, 11 warning(s)
ok   fixture rainbow validates
ok   schema rejects a bad status / missing field / unknown next
ok   cross-check catches a dangling reference
ok   lead: WhatsApp link pattern
[lead] no webhook configured; lead = {
  unit: '846',
  units_viewed: [],
  src: 'direct',
  session_id: '5fb36c8d-24de-423e-98f7-bc435c7ef217',
  ts: '2026-11-02T14:44:58.822Z'
}
ok   lead: submit with no webhook is a stub; with webhook POSTs JSON
ok   analytics: capture without a key logs and buffers
ok   picker: module loads in node and exports createPicker
ok   server: index, flow, three.js module, json
ok   server: CORS * on .js/.css/.json (habait-89 imports js/picker.js from another origin)
ok   server: Range -> 206 with Content-Range
ok   server: 404 and traversal
ok   server: events sink mounted (card 24): announced, Origin required, empty batch writes nothing

all green
EXIT=0
```

**`timeout 300 node test/analytics.test.mjs`** (בתוך `export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`)
```
ok   node: every D2 event is in EVENTS (14, pinned by smoke.mjs)
ok   node: toRecord = flat schema, allowlist only (form fields never enter an event)  (event,ts,session_id,project,unit,room,src,scene,dwell_ms)
ok   node: sink sanitizes forged records (unknown fields, bad event names dropped)
ok   node: value-level sanitising in toRecord AND the sink (phone / e-mail / URL dropped, odd text -> "other")  (event,ts,session_id,project,unit,finish,tab,mode,status,units_viewed,src)
ok   node: Apps Script appends one row, refuses no-consent, defuses formulas, phone stays text  (columns 15)
ok   node: Apps Script limits are server-side (new session ids do not reset them); LEAD_SECRET enforced  (phone 3/5, burst 7/12 after the phone test, secret ok)
ok   sink: POST from another origin or without Origin is refused; GET is not allowed; pages announce the sink
[events-sink] C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\_local\analytics-test\limits.jsonl reached 6277 bytes; new events are dropped (rotate the file by hand)
ok   sink: <= 16 KB and <= 50 events per request, 60 events/min per IP, file cap; hostile values cleaned  (413 >16KB, 413 >50 events, 59/100 under the 60/min bucket, file cap holds at 6267 B)
ok   iphone: no-key mode: 0 external requests, 9/9 event types in JSONL, ?src kept for the session, WhatsApp viewed: line off (default)  (9 requests, all 127.0.0.1; 11 events)
ok   pixel: no-key mode: 0 external requests, 9/9 event types in JSONL, ?src kept for the session, WhatsApp viewed: line on  (9 requests, all 127.0.0.1; 11 events)
ok   iphone: apartment.html (no key) writes unit_enter / room_view to the JSONL, 0 external requests  (5 events, 22 requests all local)
ok   pixel: key mode (sdk): same events reach the mock in PostHog capture format; allowlist only; lead -> Sheet  (11 events, POST /e/)
ok   desktop: key mode (http): same events reach the mock in PostHog capture format; allowlist only; lead -> Sheet  (11 events, POST /capture/)
ok   iphone: dashboard shows hot / cold units from the JSONL (Hebrew RTL, 0 external requests)  (826:cold 835:cold 836:cold 837:cold 845:cold 846:hot 847:cold 855:cold 856:cold 857:warm 866:cold 876:cold)
ok   desktop: dashboard shows hot / cold units from the JSONL (Hebrew RTL, 0 external requests)  (826:cold 835:cold 836:cold 837:cold 845:cold 846:hot 847:cold 855:cold 856:cold 857:warm 866:cold 876:cold)

no-key mode (iphone): 0 external requests, 9/9 event types (11 events) in JSONL
no-key mode (pixel): 0 external requests, 9/9 event types (11 events) in JSONL
key mode (sdk): 11 capture events to mock endpoint (12 HTTP calls: POST /e/)
lead payload has units_viewed (sdk): ["846","857"]
key mode (http): 11 capture events to mock endpoint (12 HTTP calls: POST /capture/)
lead payload has units_viewed (http): ["846","857"]
dashboard (iphone): 826:cold 835:cold 836:cold 837:cold 845:cold 846:hot 847:cold 855:cold 856:cold 857:warm 866:cold 876:cold
dashboard (desktop): 826:cold 835:cold 836:cold 837:cold 845:cold 846:hot 847:cold 855:cold 856:cold 857:warm 866:cold 876:cold
outbound (sdk) request body keys: api_key, batch, sent_at
outbound (sdk) event keys: event, properties, timestamp, uuid
outbound (sdk) properties: $lib, $process_person_profile, channel, distinct_id, dwell_ms, finish, floor, on, page, path, prev, project, room, session_id, src, status, stubbed, tab, test, token, unit, units_viewed, via
outbound (sdk) calls: POST /e/; query params: -
outbound (sdk) request headers: accept, accept-encoding, accept-language, connection, content-length, content-type, host, origin, referer, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, user-agent; Referer: http://127.0.0.1:56171/
outbound (sdk) lead fields: consent, floor, k, lang, name, phone, price, project, session_id, src, status, ts, unit, units_viewed, url
outbound (http) request body keys: api_key, event, properties, timestamp
outbound (http) event keys: api_key, event, properties, timestamp
outbound (http) properties: $lib, $process_person_profile, channel, distinct_id, dwell_ms, finish, floor, on, page, path, prev, project, room, session_id, src, status, stubbed, tab, test, unit, units_viewed, via
outbound (http) calls: POST /capture/; query params: -
outbound (http) request headers: accept, accept-encoding, accept-language, connection, content-length, content-type, host, origin, referer, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, user-agent; Referer: http://127.0.0.1:56171/
outbound (http) lead fields: consent, floor, k, lang, name, phone, price, project, session_id, src, status, ts, unit, units_viewed, url

all green; screenshots in C:\Users\elira\AppData\Local\Temp\habait-analytics-shots
EXIT=0
```

**`timeout 300 node test/browser.mjs`** (מול :8850 החי, עם serve.mjs הישן בזיכרון והקבצים החדשים מהדיסק)
```
ok   index lists the rainbow project in Hebrew RTL
ok   language toggle flips to English LTR
ok   start overlay shows the project, start tap begins the approach video
ok   time-based hotspot: 846 appears on approach only after t=5
ok   segments chain approach -> orbit (still) -> hold-facade (loop)
ok   drag rotates the view and markers follow
ok   click 846 -> card with price/status/facts and WhatsApp link
ok   lead form submits (stubbed, no webhook) and fires lead events
ok   continue -> descend-846 (video) -> enter-846 (still) -> hand-off overlay
ok   no page errors during the flow
ok   desktop English: drawer lists 12 units by floor, picking one opens its card
ok   invented unit falls back to the placeholder descend and still reaches hand-off
ok   no page errors (desktop)
ok   picker (cross-origin, phone): 12 pills from units.json, :8850 CSS applied, visible=false hides one
ok   picker chrome: title, status legend, hint, units button, legal line (Hebrew RTL)
ok   picker: hover sends unit_hover once; select('846') highlights the pill and opens the card
ok   picker: apartment page link fires unit_click {channel: apartment_page}; lead form goes through the passed analytics
ok   picker: "continue" fires onEnter(846) + unit_enter and closes the card
ok   picker: drawer grouped by floor, a row selects (card opens) without calling onEnter
ok   picker (card 24): a drawer pick on another floor sends floor_switch {floor, prev}
ok   picker (card 24): favorite toggle (on/off, kept on the device); WhatsApp has no viewed: line by default
ok   picker: setLang('en') relabels pills, card, drawer and chrome and flips dir
ok   picker: close() closes card + drawer; destroy() removes its DOM
ok   picker (habait-98 fix): three desktop pills 120 px apart stay compact across frames (no compact/full flicker)
ok   no page errors (picker standalone)

all green; screenshots in C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\test\shots
EXIT=0
```

**`timeout 300 node test/apartment.test.mjs`**
```
ok   zip: <= 25 MB with panos, stills, plan, GLB, offline HTML, README  (zip: 27 files, 4.47 MB (<=25))
zip: 27 files, 4.47 MB (<=25)
ok   zip: README carries the full legal text (he + en), variables filled, plan date
ok   iphone: Hebrew RTL, title, price, status, white-label colour
ok   iphone: tab tour
ok   iphone: tab plan
ok   iphone: tab photos
ok   iphone: tab 3d
ok   iphone: tab about
ok   iphone: WhatsApp link = wa.me/<number>?text=<he message>\nrainbow|846|<session>
ok   iphone: "חזרה לבניין" goes to the project level (hold node), not inside the apartment strip
ok   iphone: no requests outside 127.0.0.1 before any tap on WhatsApp  (27 requests, all local)
ok   iphone: no page errors
ok   pixel: Hebrew RTL, title, price, status, white-label colour
ok   pixel: tab tour
ok   pixel: tab plan
ok   pixel: tab photos
ok   pixel: tab 3d
ok   pixel: tab about
ok   pixel: WhatsApp link = wa.me/<number>?text=<he message>\nrainbow|846|<session>
ok   pixel: "חזרה לבניין" goes to the project level (hold node), not inside the apartment strip
ok   pixel: no requests outside 127.0.0.1 before any tap on WhatsApp  (27 requests, all local)
ok   pixel: no page errors
ok   desktop: Hebrew RTL, title, price, status, white-label colour
ok   desktop: tab tour
ok   desktop: tab plan
ok   desktop: tab photos
ok   desktop: tab 3d
ok   desktop: tab about
ok   desktop: WhatsApp link = wa.me/<number>?text=<he message>\nrainbow|846|<session>
ok   desktop: "חזרה לבניין" goes to the project level (hold node), not inside the apartment strip
ok   desktop: no requests outside 127.0.0.1 before any tap on WhatsApp  (26 requests, all local)
ok   desktop: English LTR toggle re-renders tabs and caption
ok   desktop: tapping WhatsApp is the only way out (wa.me, new tab)
ok   desktop: no page errors
tabs 5/5 ok on 3 viewports
wa.me link contains rainbow|846|6d051519-94ca-4c95-bdcb-d979b4758366
ok   dist page (self-contained build): opens on #photos, carries the flight sid into WhatsApp and the tour
ok   zip: 3d/dollhouse.html opens offline from file:// and shows the GLB  (28820 triangles, 66 meshes, 249 colours, 0 network requests)

all green; screenshots in C:\Users\elira\AppData\Local\Temp\habait-apartment-shots
EXIT=0
```

- **סיכום exit codes:**
  - npm test: 0 → 0 (11 → 12 ok)
  - analytics: 0 → 0 (12 → 16 ok)
  - browser: 0 → 0 (22/22 → 25/25)
  - apartment: 0 → 0 (36 → 36)
- **הדמיה של אחרי ה-restart:** הרמתי serve.mjs החדש על :8857 והרצתי `browser.mjs http://127.0.0.1:8857`. Server-Timing הוכרז, ואירועים נכתבו ל-JSONL עם 204.
  - **פגם פתוח, סיבה לא מוכחת:** שתי הריצות הראשונות על :8857 (עם ה-picker הישן, המהבהב) נכשלו ב-21/22, בצעד "invented unit … reaches hand-off": ה-overlay לא הופיע תוך 15 ש'.
  - אותו קוד בלי הכרזת sink (:8858) עבר 22/22. בריצה בודדת (debug) על :8857 ה-hand-off הגיע אחרי כ-7 ש'.
  - אחרי החלת ה-picker החדש: 3/3 ריצות על :8857 = 25/25.
  - השערה, לא מוכחת: layout thrash של ההבהוב, יחד עם POSTים ל-sink, האט את הווידאו תחת swiftshader.
  - **אחרי ה-restart של :8850 צריך להריץ `node test/browser.mjs` שוב ולוודא 25/25.**
  - שני השרתים הזמניים (PID 33604, 2480) נסגרו. :8850 (PID 31440) לא נגעתי בו.
- **כסף:** $0. אין ledger.
- **קבצים שנכתבו** (כולם תחת `Habait/platform/`):
  - `serve.mjs`, `tools/events-sink.mjs`, `tools/build_zip.mjs`
  - `js/analytics.js`, `js/lead.js`, `js/apartment.js`, `js/flow.js`, `js/picker.js`, `js/dashboard.js`, `css/style.css`
  - `contracts/project.schema.json` (חדש), `contracts/validate.mjs`, `fixtures/rainbow/project.json`
  - `apps-script/lead-to-sheet.gs`, `apps-script/README-he.md`
  - `test/smoke.mjs`, `test/analytics.test.mjs`, `test/browser.mjs`
  - `_local/dist/rainbow/846/**` (נבנה מחדש), `_local/picker.patch` (diff לתיעוד)
  - לא נגעתי ב-tour360, studio, flyover, engine, SESSIONS.md, memory.md, ה-README של הלוח.
- **הערה ל-98, לגבי חלון של כ-5 דקות לפני הודעת ה-hold:** כ-16:19–16:24 שעון המכונה (ה-mtime של ההחזרה: 16:23:53) `js/picker.js` היה על הדיסק בגרסת D2. אם ה-staging של Vercel העתיק אותו בחלון הזה, בפריסה יש picker עם כפתור ☆ ובלי תיקון ה-`_fullW`.
  - לחיצה על ☆ מול `analytics.js` ישן תזרוק TypeError (`storeFavorite` חסר), אבל רק אם ה-host לא מעביר analytics עם setFavorite.
  - כדאי ש-98 יבדוק את ה-hash של ה-picker בפריסה, או יפרוס מחדש עכשיו, כש-picker.js הסופי (עם תיקון ההבהוב) על הדיסק.
- **פגמים פתוחים:**
  1. בדיקה ידנית של שורה ב-Sheet (פגם 4).
  2. כשל ה-hand-off על :8857, שלא חזר אחרי תיקון ה-picker.
  3. פגם 5 חלקי.
  4. פגם 6.
  5. `console.log` של ליד במצב stub מדפיס שם וטלפון לקונסולה המקומית (לא יוצא מהמכשיר).
  6. restart ל-:8850.

**restart ל-:8850** (ab הריץ אותו כ-`nohup node serve.mjs` מתוך תיקיית platform, PID 31440, הפלט ל-`_local_serve.log`):
```bash
cd /c/RnD/Projects/Habait/habait-walkaround/Habait/platform && taskkill //PID 31440 //F && (nohup node serve.mjs > _local_serve.log 2>&1 &)
curl -sI http://127.0.0.1:8850/flow.html | grep -i server-timing   # expected: habait-sink;desc="/api/events"
export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node test/browser.mjs   # expected 25/25
```

- **קורא שני:**
  - **habait-98:** `js/picker.js`, שנטען חי ב-:8899, השתנה (additive):
    - כפתור מועדף ☆ בכרטיס הדירה. `opts.favorites:false` מסתיר אותו.
    - `floor_switch` בבחירה מהמגירה.
    - שורת `viewed:` כבויה כברירת מחדל.
    - **תיקון ההבהוב של 98 ב-`resolveOverlaps` (`_fullW`).**
    - `css/style.css` קיבל `.unit-fav`.
    - **:8850 צריך restart** (פקודה למעלה) כדי שה-sink יעלה. picker.js וה-CSS כבר מוגשים חדשים בלי restart.
    - לבדוק אם ה-staging של Vercel תפס את picker.js בחלון 16:19–16:24, ואם כן לפרוס מחדש.
  - **habait-4b:** restart ל-:8850, ואחריו `browser.mjs` שוב. ארבעת הפריטים לאלירן (הכרעה 4 בלוח) + `LEAD_SECRET` + הכרעה על `whatsapp_viewed_line`.
  - (שורת "העברות" ב-README של הלוח: לא נכתבה, בהוראת 4b. הסשן המפעיל מוסיף.)
- **לזיכרון:** כרטיס 24 חווט: sink ב-serve.mjs (Origin חובה, 16KB/50 אירועים, 60 לדקה ל-IP, 50MB), סינון ערכים משותף (טלפון/מייל/URL נמחקים), EVENTS=14, picker: ☆ + floor_switch + תיקון `_fullW` של 98, `viewed:` כבוי, dist נבנה מחדש, Apps Script: מגבלות שרת + LEAD_SECRET + טלפון כטקסט. :8850 דורש restart.

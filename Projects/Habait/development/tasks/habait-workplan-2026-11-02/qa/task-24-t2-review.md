# בדיקת T2 (qa-reviewer, הקשר נקי) לכרטיס 24 (D2, analytics + leads)

תאריך: 2026-11-02. הבודק לא כתב את הקוד. נבדק ב-`C:\Habait\habait-walkaround\Habait\platform`, בלי git.

## פסק דין: HOLDS WITH DEFECTS

הטענות המרכזיות מחזיקות: אין הוכחה לדליפת PII בנתיב שמחובר היום, ו"להישאר בלי מפתחות" בטוח. יש 7 פגמים (4 בינוניים, 3 נמוכים), והחשוב שבהם ברמת **ערכי** השדות, לא שמותיהם.

- ה-Check רץ ירוק (exit 0), ו-`npm test` ירוק (exit 0).
- ניסיתי להפריך בבדיקה עצמאית (probe) שאיננה חלק מהטסט של הסוכן: Chromium אמיתי, `context.route('**/*')` שתופס **כל** בקשה לכל host שאינו 127.0.0.1 (ומחזיר 200), עם host ברירת המחדל `https://us.i.posthog.com`. תוצאה: במצב בלי מפתח 0 בקשות חיצוניות. במצב sdk וגם http רק `POST /e/` או `POST /capture/` ל-us.i.posthog.com, בלי flags, decide, config, array, surveys, replay, toolbar.
- החור שנמצא: ה-allowlist מגביל שמות שדות, לא תוכן (פגם 1).

## ה-Check, exit codes

```
cd C:/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/Habait/tools/appdeps
timeout 300 node test/analytics.test.mjs   -> 12 שלבי ok, "all green", EXIT=0
timeout 300 npm test                       -> "all green", EXIT=0
```
פלט הריצה שלי תאם את בלוק התוצאה: אותם 12 שלבים, 9/9 סוגי אירוע, 11 אירועים, `POST /e/` ב-sdk, `POST /capture/` ב-http, `query params: -`.

## טענה 1: בלי `posthog_key` אפס בקשות חיצוניות: HOLDS (עם הסתייגות על iframe)

מיפוי כל ה-sinks בקבצים הנטענים (grep על fetch / XMLHttpRequest / sendBeacon / Image / script / link / iframe / import / url()):

- `js/analytics.js:295` `navigator.sendBeacon(d2.sinkUrl, ...)` ו-`:298` `fetch(d2.sinkUrl, ...)`: רק ל-`d2.sinkUrl`, שעובר `sameOriginUrl()` (בודק `url.origin === location.origin` ו-http/https בלבד). גם `sink_url` מקונפיג עובר אותה בדיקה, לכן אי אפשר להפוך אותו לצד שלישי.
- `js/analytics.js:320` `import('./posthog-adapter.js')`: מתבצע רק מתוך `sendToPostHog`, שנקראת רק כש-`state.key` לא ריק. בלי מפתח ה-adapter וה-vendor לא נטענים בכלל.
- `js/posthog-adapter.js:105` `import(new URL('./vendor/...', import.meta.url))`: מקומי, same-origin.
- `js/lead.js`: ה-`fetch` היחיד ב-`submitLead`, רק אחרי submit, ל-`sheetEndpoint()` (https או 127.0.0.1 בלבד). בלי endpoint: `console.log` ו-`stubbed:true`.
- `js/dashboard.js:225,289,300`: `fetch('projects.json')`, `fetch('<dir>/units.json')`, `fetch(safeFilePath(...))`. `safeFilePath` (`dashboard.js:205`) = `/^[\w./-]+\.jsonl$/` בלי `..` ובלי `/` בהתחלה, כלומר אין `:` ואין `//`, ו-`?file=` לא יכול לכוון ל-host חיצוני. הקריאה החיצונית היחידה היא `fetchPostHog` (`:153`) ורק כשמקלידים Project ID + Personal key.
- `apartment.html`: רק `css/style.css`, `css/apartment.css`, `js/apartment.js`, favicon כ-data URI, ושני iframe (`tourFrame`, `dollFrame`). `dashboard.html`: `css/dashboard.css` + `js/dashboard.js` ו-`<meta name="referrer" content="no-referrer">`. ב-`css/dashboard.css` אין `url(` ואין `@import`.
- הסתייגות (מחוץ לכרטיס, אבל "0 חיצוניות ב-apartment.html" נכון רק לפיקסצ'רים): `apartment.js:347-348` מציב `tourFrame.src = apartmentTourUrl(m.tour.url, {sid, ...})`. בפיקסצ'ר `tour_url` הוא `http://127.0.0.1:8848/...`. בפרודקשן עם סיור ב-origin אחר, פתיחת לשונית הסיור תיצור בקשה לצד שלישי **ותשלח לו את `sid`** ב-URL (פגם 7).

ה-vendor `posthog-js-1.444.2.module.slim.no-external.js`: ה-sha256 `f5f29337...485eb7` תואם. ה-hosts הקשיחים היחידים: `https://us.i.posthog.com`, `https://app.posthog.com` (נורמליזציה ל-us.i), `https://us.posthog.com` (ui_host), `sentry.io/organizations/` (טקסט הודעה), `posthog.com/tutorials/...` (טקסט), `yandex.com/bots` (רשימת בוטים). בקוד קיימים נתיבי `/array/<token>/config` ו-`/flags` (נגזרים מ-`api_host`, ומושבתים ב-adapter). ה-probe עם host ברירת מחדל לא הוציא אף בקשה מלבד `/e/`.

## טענה 2: ב-key mode יוצאת רק ה-allowlist: HOLDS ברמת המפתחות, נשבר ברמת הערכים (פגם 1)

ה-probe: `capture('unit_click', {...})` עם שדות עוינים, בדף שנטען עם `?secret=NAME_ABC&utm_source=fb#frag`:

```
input: unit:'846', name:'Dan Cohen', phone:'0501234567', email:'d@x.co', url:location.href, $current_url:location.href,
       $set:{email:...}, $set_once:{x:1}, referrer:document.referrer, floor:16, distinct_id:'ATTACKER', $device_id:'d'
sdk out: {"api_key":"phc_x","batch":[{"uuid":..,"event":"unit_click","properties":{"token":"phc_x","distinct_id":"<sid>",
  "$lib":"habait-platform","$process_person_profile":false,"session_id":"<sid>","project":"rainbow","unit":"846","floor":16,
  "src":"fb","page":"probe","path":"/_local/qa-probe/sdk.html","test":true},"timestamp":..}],"sent_at":..}
http out: אותם properties, api_key ברמת האירוע.
Referer header = http://127.0.0.1:<port>/   (origin בלבד, בלי path/query)
```

- אין `$current_url`, `$pathname`, `$referrer`, `$screen_*`, `$browser`, `$os`, `$device_id`, `$set`, `$set_once`, name/phone/email/url/referrer. ה-`?secret=` וה-`#frag` לא יצאו (`toRecord`: `rec.path = location.pathname`).
- `distinct_id:'ATTACKER'` שהועבר ב-props נדחה: תמיד session id (`distinct_id` אינו ב-`OUTBOUND_FIELDS`, ו-`before_send` קובע אותו ל-`sessionId`).
- אחסון בצד הלקוח אחרי כל ה-flows: localStorage הכיל רק את מפתח הבדיקה שלי, sessionStorage: `habait.src|session|viewed`, `document.cookie` ריק. אין `habait.distinct` ואין `ph_*`: `distinctId()` עדיין מיוצא (`analytics.js:52`) אך אף אחד לא קורא לו (grep).
- אפשרויות ה-SDK ב-`posthog-adapter.js`: `autocapture:false`, `capture_pageview:false`, `capture_pageleave:false`, `disable_session_recording:true`, `disable_surveys:true`, `advanced_disable_flags/decide:true`, `disable_external_dependency_loading:true`, `persistence:'memory'`, `person_profiles:'identified_only'`, ובעיקר `before_send` שבונה מחדש את `properties` מה-allowlist ומחזיר `null` לכל אירוע שאינו ב-`OUTBOUND_EVENTS`. אין `ip`/`property_blacklist` בקונפיג, אבל `before_send` מכסה זאת בפועל (ה-probe הוכיח).
- בוט/webdriver: בלי `posthog_allow_bots` ה-SDK לא שולח כלום (ה-probe `sdk_nobots`: 0 בקשות). בטוח, ובפרודקשן לא רלוונטי.

## טענה 3: ה-sink: HOLDS נגד traversal, גודל, פורמט ו-origin מדפדפן; חלש לפריסה ציבורית (פגם 3)

ריצה עוינת מול `startWithSink`:

```
no Origin (curl-like)        -> 204 (1 אירוע נכתב)
same Origin                  -> 204
Origin null                  -> 403
foreign Origin               -> 403
Origin==Host spoof           -> 204 (זה ה-same-origin, כצפוי)
non-JSON / empty             -> 204, 0 אירועים
event "../../etc/passwd"     -> 204, 0 אירועים (נדחה ב-EVENT_RE)
{"__proto__":..,"name":..}   -> 204, נכתבו רק event/unit (שדות לא-מותרים נחתכו)
body 300 KB                  -> 413
/api/events/../../x, %2F, /  -> 405 (נופל ל-serve.mjs, לא נוגע ב-sink)
PUT                          -> 405
250 KB של {"event":"ab"}\n   -> 204, 17000 אירועים (קובץ 901,288 בתים)
```

- אין נתיב כתיבה שנגזר מהקלט: הקובץ קבוע (`DEFAULT_FILE`, או `--file` של המפעיל). אי אפשר לכתוב מחוץ ל-`_local/` דרך HTTP.
- `Server-Timing: habait-sink;desc="/api/events"` נוסף לכל תגובה, וה-sink פעיל רק כשמוסיפים אותו; אין בקשת probe, כנטען.

## טענה 4: ה-Sheet מקבל name/phone רק אחרי submit עם הסכמה: HOLDS בצד הלקוח

- ב-`js/lead.js` יש בדיוק 3 listeners: `click` על WhatsApp (שורה 91), `click` על toggle (116), `submit` (124). אין `input`/`keydown`/`keyup`/`blur`/`change`. `submitLead` נקרא רק מה-submit, אחרי `validateLead` (שם ≥2, טלפון 9-15 ספרות, `consent`). לפני ה-submit אין שום fetch.
- `lead_click`/`lead_submitted` מכילים רק `project, unit, channel, units_viewed, stubbed`. קישור WhatsApp: `project|unit|session` + `viewed:`, בלי name/phone.
- ה-JSONL וה-PostHog לא מקבלים name/phone (הטסט `!('name' in r)` וה-probe שלי).
- הסתייגויות: (א) ה-payload ל-Sheet כולל `url: location.href` המלא (כולל `sid`, `src`, ה-query). (ב) בצד ה-Sheet ההסכמה היא דגל שהלקוח קובע, אין אימות. (ג) במצב stub `console.log('[lead] ... lead =', payload)` מדפיס name/phone לקונסולה (מקומי, אין יציאה).

## טענה 5: האם הטסט תופס כל בקשה יוצאת? חלקית

- `page.on('request')` (`analytics.test.mjs:157`) הוא **משקיף**, לא interceptor: אין `route()`. בפועל Playwright מדווח על כל fetch/XHR/ping/iframe של העמוד, ולכן "0 חיצוניות" ב-no-key הוא ראיה אמיתית (ה-probe עם `route('**/*')` אישר זאת בנפרד).
- חולשות: (א) ב-key mode "חיצוני" הוא כל host שאינו 127.0.0.1, וה-mock הוא 127.0.0.1, לכן בקשה ל-mock נבדקת רק לפי הנתיב. (ב) רשימת ה-"מותר" נגזרת מ-`adapter.OUTBOUND_FIELDS`/`ENVELOPE_FIELDS` של המימוש עצמו (`:296`): אם מישהו מרחיב את הרשימה בקוד, הטסט ימשיך לעבור. רק `PII` (שמות מפתחות) עצמאי. (ג) אין assertion על **ערכים**. (ד) ההקשר נסגר מיד, כך שבקשות pagehide/unload לא נצפות. (ה) key mode נבדק על harness ולא על `apartment.html` האמיתי (מובן: המפתח עוד לא מגיע לדפים).

## טענה 6: $0: HOLDS

grep על `claude|anthropic|openai|fal|spawn|execSync|child_process` בקבצים החדשים (analytics.js, lead.js, posthog-adapter.js, dashboard.js, events-sink.mjs, lead-to-sheet.gs, analytics.test.mjs, dashboard.html): 0 התאמות. אין API בתשלום ואין `claude -p`.

## פגמים לפי חומרה

1. **בינוני: ה-allowlist הוא על מפתחות, לא על ערכים.** `cleanValue` (`analytics.js`) ו-`clean` (`events-sink.mjs`) מעבירים כל מחרוזת עד 120 תווים. הוכחה: `capture('lead_submitted', {room:'0501234567'})` יצא ל-us.i.posthog.com כ-`"room":"0501234567"`, ו-`scene` של 500 תווים נחתך ל-120 ויצא. תרחישים אמיתיים: (א) `via: params.get('from')` (`apartment.js:499`) הוא טקסט חופשי מה-URL. (ב) `src` מ-`?src=`/`utm_*` (regex `[\w.\-]{1,64}`) יכול להכיל מזהה אישי בקישור קמפיין ממותג (`?src=dan0501234567`). (ג) `scene` מגיע מ-postMessage של ה-iframe של הסיור ויוצא גם כ-`room`. כולם יוצאים ל-PostHog ונשמרים ב-JSONL. תיקון: אימות ערכים (`^[\w.:\-]{1,40}$` לשדות מחרוזת, דחיית רצף של 7 ספרות ומעלה) ב-`toRecord` וב-`sanitizeRecord`, ו-assertion ערכי בטסט.
2. **בינוני: עותק ישן ודולף של analytics.js ב-dist.** `_local/dist/rainbow/846/assets/js/analytics.js:64-90` הוא הקוד שלפני D2: במצב מפתח שולח `$current_url` (כל ה-URL), `distinct_id: distinctId()` קבוע מ-localStorage (`habait.distinct`, מעקב בין ביקורים), וכל ה-props. `build_zip.mjs:666` מעתיק `analytics.js` כמו שהוא. תרחיש: מדליקים `POSTHOG_KEY` על dist/Vercel ישן והדליפה חוזרת. dist חדש בלי ה-adapter, לעומת זאת, שותק (נשאר מקומי). תיקון: לבנות מחדש כל dist לפני הדלקת מפתח, להוסיף את ה-adapter וה-vendor להעתקה, ולבדוק sha של ה-dist מול `js/`.
3. **בינוני (כשה-sink עולה לכתובת ציבורית): אין הגנה מספאם ומדיסק.** בקשה בלי כותרת `Origin` (curl, סקריפט) עוברת (`sameOrigin`: `!origin` מחזיר true). אין rate limit ואין תקרה לקובץ: גוף של 250 KB נתן **17,000 שורות / 900 KB** בבקשה אחת. אפשר גם לזייף `lead_submitted` ולנפח את ה-KPI "המרה". Origin==Host עובר גם ב-DNS rebinding (מקומי בלבד). תיקון: תקרת אירועים לבקשה (≤50), רוטציה/תקרת קובץ, rate לפי IP, ודחיית בקשה בלי `Origin` כש-`Sec-Fetch-Site` חסר.
4. **בינוני: Apps Script ציבורי ו-rate limit שניתן לעקוף.** `rateOk_` מפתח על `session_id` שהלקוח קובע; session id אקראי בכל בקשה עוקף את ה-5 ל-10 דקות. כתובת `/exec` חשופה בקונפיג של הדף. תרחיש: מאות לידים מזויפים (`consent:true`, שם וטלפון בדויים) ממלאים את ה-Sheet ואת המכסה. **לא אומת** (אין לי runner של Apps Script; הטסט מריץ את ה-.gs ב-vm עם Sheet מדומה): `appendRow` מפרש מחרוזות כמו הקלדה, ולכן `0501234567` עלול להישמר כמספר `501234567` (אובדן ה-0), ו-`'+972...` (קידומת `'` של `safe_`) עלול להישמר עם גרש גלוי או לא. לבדוק ידנית שורה אחת לפני שאלירן מעתיק.
5. **נמוך: הטסט חלש** (ראו טענה 5): allowlist טאוטולוגי, בלי assertion על ערכים, בלי תצפית ב-unload.
6. **נמוך: מפתח Personal (`phx_`) של הדשבורד ב-localStorage של אותו origin כמו דפי הקונה** (`dashboard.js:218-221`). XSS עתידי בדף קונה על אותו origin גונב מפתח עם `query:read`. ה-escaping בדשבורד תקין (`esc` על כל ערך טקסטואלי; ערך `<img onerror>` שנכתב ל-sink נשמר כמחרוזת ולא נכנס כ-HTML). הדשבורד ו-`_local/events.jsonl` נגישים לכל מי שמגיע ל-:8850 (פגם 5 של הסוכן; מסכים). לא לפרוס ציבורית.
7. **נמוך: `sid` נשלח ל-origin של הסיור** (`apartment.js:347`). לפי העיצוב, אבל בסיור ב-origin אחר זה חושף את מזהה הסשן ויוצר בקשה חיצונית שלא נכללת ב-"0 חיצוניות".

## קבצים שנגעתי בהם

נכתב: קובץ זה בלבד. לצורך ה-probe יצרתי קבצים זמניים ב-scratchpad וקבצי `_local/qa-*` זמניים תחת `Habait/platform/_local/` שנמחקו בסיום. ה-Check עצמו כותב ל-`_local/analytics-test/` כרגיל. בלי git.

לזיכרון: T2 על כרטיס 24: HOLDS WITH DEFECTS. 0 חיצוניות בלי מפתח ו-allowlist מפתחות נאכף (נבדק עם route catch-all). פתוח: ערכים חופשיים (via/src/scene) יוצאים, dist ישן דולף, sink ו-Apps Script בלי rate-limit אמיתי.

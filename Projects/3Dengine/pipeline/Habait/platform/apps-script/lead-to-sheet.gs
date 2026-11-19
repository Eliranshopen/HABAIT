/**
 * Habait lead -> Google Sheet (card 24, D2). Paste into Extensions > Apps Script of the Sheet, deploy as a Web app
 * (Execute as: Me, Who has access: Anyone). Its /exec URL goes into the platform config as leads.webhook_url
 * (or sheet_endpoint). Instructions in Hebrew: README-he.md next to this file.
 *
 * Receives the JSON body js/lead.js sends (text/plain, no CORS preflight):
 *   { name, phone, consent, project, unit, floor, price, status, units_viewed[], src, session_id, lang, url, ts, k? }
 * Appends one row to the "Leads" tab. Refuses a lead:
 *   - without consent, with a bad phone (9-15 digits), without project / session;
 *   - with a wrong k when the Script Property LEAD_SECRET is set (Project Settings > Script properties; the same value
 *     goes into project.json analytics.lead_secret). k is never written to the Sheet;
 *   - over the SERVER-SIDE limits (T2 review defect 4; the client cannot reset them by changing its session id):
 *     MAX_PER_MINUTE / MAX_PER_HOUR leads for the whole script, MAX_PER_PHONE per phone per hour, MAX_PER_SESSION per
 *     session per 10 minutes. Counters live in CacheService and are read/written inside the script lock.
 * Cells that start with = + - @ are prefixed with ' (no formula injection from a form). The phone column is plain
 * text (number format '@') and the phone is written as a string, so a leading 0 or + is kept.
 * TEST ONE ROW BY HAND after every deployment (README-he.md, step 2.7): Sheets' parsing cannot be tested off-line.
 */
var SHEET_NAME = 'Leads';
var HEADERS = ['received_at', 'ts', 'project', 'unit', 'floor', 'name', 'phone', 'consent', 'units_viewed', 'src',
  'session_id', 'lang', 'price', 'status', 'url'];
var MAX_PER_SESSION = 5;   // per session_id, 10 minutes
var MAX_PER_PHONE = 3;     // per phone, 1 hour
var MAX_PER_MINUTE = 10;   // whole script
var MAX_PER_HOUR = 120;    // whole script

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var err = validateLead_(body);
    if (err) return json_({ ok: false, error: err });
    if (!secretOk_(body, e)) return json_({ ok: false, error: 'auth' });
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var limited = rateLimited_(body, new Date());
      if (limited) return json_({ ok: false, error: 'rate', scope: limited });
      var sheet = sheet_();
      sheet.appendRow(rowFor_(body, new Date()));
      forcePhoneText_(sheet, sheet.getLastRow(), phoneText_(body.phone));
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (x) {
    return json_({ ok: false, error: 'bad_request' });
  }
}

function doGet() {
  return json_({ ok: true, service: 'habait-lead-to-sheet', version: 2 });
}

function validateLead_(b) {
  if (!b || typeof b !== 'object') return 'body';
  if (b.consent !== true) return 'consent';
  if (!b.name || String(b.name).trim().length < 2) return 'name';
  var digits = String(b.phone || '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return 'phone';
  if (!b.project || !b.session_id) return 'context';
  return null;
}

// LEAD_SECRET (Script Properties) set -> the body's k (or ?k= on the URL) must match. Unset -> no check.
function secretOk_(b, e) {
  var secret = null;
  try {
    if (typeof PropertiesService !== 'undefined') secret = PropertiesService.getScriptProperties().getProperty('LEAD_SECRET');
  } catch (x) { secret = null; }
  if (!secret) return true;
  var k = (b && b.k) || (e && e.parameter && e.parameter.k) || '';
  return String(k) === String(secret);
}

// Counters keyed on server-side values (time bucket, phone, session); returns the exceeded scope or null.
function rateLimited_(b, now) {
  var cache = CacheService.getScriptCache();
  var minute = 'm:' + Math.floor(now.getTime() / 60000);
  var hour = 'h:' + Math.floor(now.getTime() / 3600000);
  var phone = 'p:' + String(b.phone || '').replace(/\D/g, '').slice(-12);
  var session = 's:' + String(b.session_id).slice(0, 80);
  var checks = [[minute, MAX_PER_MINUTE, 120, 'minute'], [hour, MAX_PER_HOUR, 7200, 'hour'],
    [phone, MAX_PER_PHONE, 3600, 'phone'], [session, MAX_PER_SESSION, 600, 'session']];
  var i;
  for (i = 0; i < checks.length; i++) {
    if (Number(cache.get(checks[i][0]) || 0) >= checks[i][1]) return checks[i][3];
  }
  for (i = 0; i < checks.length; i++) {
    cache.put(checks[i][0], String(Number(cache.get(checks[i][0]) || 0) + 1), checks[i][2]);
  }
  return null;
}

function safe_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Array]') v = v.join(', ');
  var s = String(v).slice(0, 500);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

// digits only, one leading + kept: never a formula, never a number
function phoneText_(v) {
  var s = String(v || '').trim();
  var plus = s.charAt(0) === '+' ? '+' : '';
  return plus + s.replace(/\D/g, '').slice(0, 15);
}

function rowFor_(b, now) {
  return HEADERS.map(function (h) {
    if (h === 'received_at') return now.toISOString();
    if (h === 'consent') return b.consent === true ? 'yes' : 'no';
    if (h === 'phone') return phoneText_(b.phone);
    return safe_(b[h]);
  });
}

// the phone cell as plain text (keeps 0501234567 and +972..., not 501234567 / 972...)
function forcePhoneText_(sh, row, phone) {
  var col = HEADERS.indexOf('phone') + 1;
  sh.getRange(row, col).setNumberFormat('@').setValue(phone);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, HEADERS.indexOf('phone') + 1, sh.getMaxRows(), 1).setNumberFormat('@');
  }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

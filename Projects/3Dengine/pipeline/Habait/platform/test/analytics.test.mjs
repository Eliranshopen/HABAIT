// Card 24 (D2) check: measurement layer, JSONL sink, PostHog adapter (mocked), leads, dashboard.
//   HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps node test/analytics.test.mjs [shotsDir]
// Starts its own servers on free ports: the platform + events sink (tools/events-sink.mjs startWithSink) and a mock
// PostHog / Apps Script host. Writes only under _local/analytics-test/ (JSONL + a generated harness page).
// "external" = any request whose host is not 127.0.0.1 / localhost.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import os from 'node:os';

const PLATFORM = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TMP = join(PLATFORM, '_local', 'analytics-test');
const JSONL = join(TMP, 'events.jsonl');
const shots = process.argv[2] || join(os.tmpdir(), 'habait-analytics-shots');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(shots, { recursive: true });

let failures = 0;
const summary = [];
const step = async (name, fn) => {
  try { const note = await fn(); console.log('ok   ' + name + (note ? `  (${note})` : '')); }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.stack || e.message || e).split('\n').slice(0, 3).join('\n     ')); }
};

const analytics = await import('../js/analytics.js');
const adapter = await import('../js/posthog-adapter.js');
const sinkMod = await import('../tools/events-sink.mjs');
const dash = await import('../js/dashboard.js');
const CANON = ['unit_click', 'unit_enter', 'room_view', 'floor_switch', 'favorite', 'lead_click', 'lead_submitted', 'apartment_tab', 'zip_download'];
const PII = ['name', 'phone', 'email', 'tel', '$ip', '$current_url', '$referrer', '$device_id', '$browser', '$os', '$screen_width', '$raw_user_agent'];
// value-level (T2 review defect 1/5): no string value may look like a phone, an e-mail or a URL. Ids are exempt.
const ID_KEYS = new Set(['session_id', 'distinct_id', 'token', 'uuid', 'api_key', 'ts', 'timestamp', 'received']);
function personalValues(obj) {
  const bad = [];
  for (const [k, v] of Object.entries(obj || {})) {
    if (ID_KEYS.has(k)) continue;
    for (const x of Array.isArray(v) ? v : [v]) {
      if (typeof x !== 'string' && typeof x !== 'number') continue;
      const t = String(x);
      if (t.includes('@') || (t.match(/\d/g) || []).length >= 7 || /https?:|\/\/|www\./i.test(t)) bad.push(`${k}=${t}`);
    }
  }
  return bad;
}
// what a careless or hostile caller might pass (phone in room, e-mail in via, a URL as page, markup, a long string)
const HOSTILE = { unit: '846', tab: 'hostile', room: '050-123-4567', via: 'dan@example.com', scene: '+972 50 123 4567', src: 'dan0501234567',
  page: 'https://evil.example/p?x=1', prev: 'www.evil.com', finish: '<img src=x onerror=alert(1)>', mode: 'a'.repeat(300), channel: 'tel:0501234567',
  status: 'מטבח', floor: 501234567, units_viewed: ['846', '0501234567', 'a@b.co'], name: 'Dan', phone: '0501234567' };

// ------------------------------------------------------------ node ------------------------------------------------------------
await step('node: every D2 event is in EVENTS (14, pinned by smoke.mjs)', () => {
  for (const e of CANON) assert.ok(analytics.EVENTS.includes(e) && analytics.KNOWN_EVENTS.includes(e), e);
  assert.equal(analytics.EVENTS.length, 14);
});
await step('node: toRecord = flat schema, allowlist only (form fields never enter an event)', () => {
  analytics.initAnalytics({ debug: false, base: { project: 'rainbow' } });
  const p = analytics.capture('room_view', { unit: '846', scene: 'living', dwell_ms: 1234.6, name: 'Dana', phone: '0501234567', email: 'a@b.c', nested: { x: 1 } });
  const r = analytics.toRecord(p);
  for (const k of ['event', 'ts', 'session_id', 'project', 'src']) assert.ok(k in r, k);
  assert.equal(r.room, 'living'); assert.equal(r.dwell_ms, 1235); assert.equal(r.src, 'direct');
  for (const k of Object.keys(r)) assert.ok(analytics.RECORD_FIELDS.includes(k), k);
  for (const k of ['name', 'phone', 'email', 'nested']) assert.ok(!(k in r), k);
  const body = adapter.captureBody(r, 'phc_x');
  assert.equal(body.api_key, 'phc_x'); assert.equal(body.event, 'room_view'); assert.equal(body.properties.distinct_id, r.session_id);
  return Object.keys(r).join(',');
});
await step('node: sink sanitizes forged records (unknown fields, bad event names dropped)', () => {
  const recs = sinkMod.parseBody('{"event":"unit_click","unit":"846","phone":"050"}\n{"event":"<script>"}\nnot json\n');
  const clean = recs.map(sinkMod.sanitizeRecord).filter(Boolean);
  assert.equal(clean.length, 1); assert.deepEqual(clean[0], { event: 'unit_click', unit: '846' });
});
await step('node: value-level sanitising in toRecord AND the sink (phone / e-mail / URL dropped, odd text -> "other")', () => {
  const r = analytics.toRecord(analytics.capture('room_view', HOSTILE));
  const s2 = sinkMod.sanitizeRecord({ event: 'room_view', ...HOSTILE, session_id: 'abc-123456', path: '/x/0501234567' });
  for (const rec of [r, s2]) {
    assert.deepEqual(personalValues(rec), [], JSON.stringify(rec));
    for (const k of ['room', 'via', 'scene', 'page', 'prev', 'channel', 'floor', 'name', 'phone']) assert.ok(!(k in rec), `${k} kept: ${JSON.stringify(rec)}`);
    assert.equal(rec.finish, 'other'); assert.equal(rec.mode, 'other'); assert.equal(rec.status, 'other');
    assert.deepEqual(rec.units_viewed, ['846']); assert.equal(rec.tab, 'hostile'); assert.equal(rec.unit, '846');
  }
  assert.equal(r.src, 'direct', 'a personal-looking src falls back to direct');
  assert.equal(s2.path, '/other');
  // the ordinary values survive unchanged
  const ok = analytics.toRecord(analytics.capture('floor_switch', { unit: '846', finish: 'marble', prev: 'parquet', floor: 16, via: 'drawer', scene: 'terraceLiving' }));
  assert.equal(ok.finish, 'marble'); assert.equal(ok.prev, 'parquet'); assert.equal(ok.floor, 16); assert.equal(ok.via, 'drawer'); assert.equal(ok.room, 'terraceLiving');
  // a campaign link that carries a phone is never stored as the session's src
  assert.equal(analytics.setCampaignSource('dan0501234567'), 'direct');
  return Object.keys(r).join(',');
});
function appsScript({ secret = null } = {}) {
  const rows = [];
  const formats = new Map(); // "row,col" or "col:<c>" -> number format
  const range = (r, c, n = 1) => ({
    setNumberFormat(f) { if (n > 1) formats.set(`col:${c}`, f); else formats.set(`${r},${c}`, f); return this; },
    setValue(v) { rows[r - 1][c - 1] = v; return this; },
  });
  const sheet = { getLastRow: () => rows.length, appendRow: (r) => rows.push(r.slice()), getMaxRows: () => 1000, getRange: range };
  const cache = new Map();
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => (rows.length ? sheet : null), insertSheet: () => sheet }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k), put: (k, v) => cache.set(k, v) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'LEAD_SECRET' ? secret : null) }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ s, setMimeType() { return this; } }) },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(PLATFORM, 'apps-script/lead-to-sheet.gs'), 'utf8'), ctx);
  const post = (b, parameter = {}) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(b) }, parameter }).s);
  return { rows, formats, cache, post };
}
await step('node: Apps Script appends one row, refuses no-consent, defuses formulas, phone stays text', () => {
  const { rows, formats, post } = appsScript();
  const lead = { name: '=HYPERLINK("x")', phone: '050-1234567', consent: true, project: 'rainbow', unit: '846', units_viewed: ['846', '857'], src: 'fb-oct', session_id: 's1', k: 'not-written' };
  assert.deepEqual(post(lead), { ok: true });
  assert.equal(post({ ...lead, consent: false }).error, 'consent');
  assert.equal(rows.length, 2); // header + one lead
  const H = rows[0];
  const P = H.indexOf('phone') + 1;
  assert.equal(rows[1][H.indexOf('name')], `'=HYPERLINK("x")`);
  assert.equal(rows[1][H.indexOf('units_viewed')], '846, 857');
  assert.equal(rows[1][P - 1], '0501234567', 'leading 0 kept, as a string');
  assert.equal(formats.get(`col:${P}`), '@', 'phone column formatted as text');
  assert.equal(formats.get(`2,${P}`), '@', 'phone cell formatted as text');
  assert.ok(!rows.flat().includes('not-written'), 'k never reaches the Sheet');
  assert.deepEqual(post({ ...lead, phone: '+972 50-123-4567', session_id: 's-plus' }), { ok: true });
  assert.equal(rows[2][P - 1], '+972501234567', '+ kept, no apostrophe');
  return `columns ${H.length}`;
});
await step('node: Apps Script limits are server-side (new session ids do not reset them); LEAD_SECRET enforced', () => {
  const a = appsScript();
  const lead = (i, phone = `05012345${String(i).padStart(2, '0')}`) => ({ name: 'Dana', phone, consent: true, project: 'rainbow', unit: '846', session_id: `s${i}` });
  // the same phone from a fresh session id each time: 3 per hour
  const samePhone = [0, 1, 2, 3, 4].map((i) => a.post(lead(i, '0501234567')));
  assert.deepEqual(samePhone.map((r) => r.ok), [true, true, true, false, false]);
  assert.equal(samePhone[3].scope, 'phone');
  // a burst of different phones and sessions: 10 per minute for the whole script
  const burst = Array.from({ length: 12 }, (_, i) => a.post(lead(100 + i)));
  assert.equal(a.rows.length - 1, 10, 'minute cap');
  assert.equal(burst.filter((r) => !r.ok).pop().scope, 'minute');
  // LEAD_SECRET
  const b = appsScript({ secret: 'habait-test-secret-1234' });
  assert.equal(b.post(lead(1)).error, 'auth');
  assert.equal(b.post({ ...lead(2), k: 'wrong' }).error, 'auth');
  assert.deepEqual(b.post({ ...lead(3), k: 'habait-test-secret-1234' }), { ok: true });
  assert.deepEqual(b.post(lead(4), { k: 'habait-test-secret-1234' }), { ok: true });
  return `phone ${samePhone.filter((r) => r.ok).length}/5, burst ${a.rows.length - 1 - 3}/12 after the phone test, secret ok`;
});

// ------------------------------------------------------------ servers ------------------------------------------------------------
// the shared test server gets a roomy rate (all browser contexts post from 127.0.0.1); the limits have their own sink below
const platform = await sinkMod.startWithSink({ port: 0, file: JSONL, ratePerMin: 2000 });
const base = `http://127.0.0.1:${platform.address().port}`;

const mock = { reqs: [], events: [], leads: [], phQueries: 0 };
const isSheet = (r) => r.path.startsWith('/macros/') || r.path === '/ok';
function decodeBody(req, buf) {
  let b = buf;
  const q = new URL(req.url, 'http://x').searchParams;
  if (req.headers['content-encoding'] === 'gzip' || q.get('compression') === 'gzip-js') { try { b = gunzipSync(b); } catch { /* not gzip */ } }
  let s = b.toString('utf8');
  if (/^data=/.test(s)) s = Buffer.from(decodeURIComponent(s.slice(5)), 'base64').toString('utf8');
  try { return JSON.parse(s); } catch { return s; }
}
const mockSrv = createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const cors = { 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Credentials': 'true' };
    const path = req.url.split('?')[0];
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const body = decodeBody(req, Buffer.concat(chunks));
    if (process.env.D2_DEBUG) console.log(`     [mock] ${req.method} ${req.url} ${JSON.stringify(body).slice(0, 200)}`);
    mock.reqs.push({ method: req.method, path, query: req.url.split('?')[1] || '', headers: { ...req.headers }, body });
    if (path === '/ok') { res.writeHead(200, cors); return res.end('ok'); } // the Apps Script redirect target
    if (path.startsWith('/macros/')) { mock.leads.push(body); res.writeHead(302, { ...cors, Location: '/ok' }); return res.end(); }
    if (path.startsWith('/api/projects/')) {
      mock.phQueries++;
      const cols = ['event', 'timestamp', 'session_id', 'project', 'unit', 'room', 'scene', 'floor', 'finish', 'src', 'dwell_ms', 'tab', 'channel', 'on', 'test'];
      const results = mock.events.map((e) => [e.event, e.timestamp || new Date().toISOString(), ...cols.slice(2).map((k) => e.properties[k] ?? null)]);
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ columns: cols, results }));
    }
    const list = Array.isArray(body) ? body : Array.isArray(body?.batch) ? body.batch : body && typeof body === 'object' && body.event ? [body] : [];
    for (const e of list) mock.events.push({ ...e, path });
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end('{"status":1}');
  });
});
await new Promise((ok) => mockSrv.listen(0, '127.0.0.1', ok));
const mockOrigin = `http://127.0.0.1:${mockSrv.address().port}`;

await step('sink: POST from another origin or without Origin is refused; GET is not allowed; pages announce the sink', async () => {
  const r1 = await fetch(`${base}/api/events`, { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{"event":"unit_click"}' });
  assert.equal(r1.status, 403);
  const r0 = await fetch(`${base}/api/events`, { method: 'POST', body: '{"event":"unit_click"}' }); // curl-like, no Origin
  assert.equal(r0.status, 403);
  const rn = await fetch(`${base}/api/events`, { method: 'POST', headers: { Origin: 'null' }, body: '{"event":"unit_click"}' });
  assert.equal(rn.status, 403);
  const r2 = await fetch(`${base}/api/events`);
  assert.equal(r2.status, 405);
  const r3 = await fetch(`${base}/apartment.html`);
  assert.match(r3.headers.get('server-timing') || '', /habait-sink;desc="\/api\/events"/);
});
await step('sink: <= 16 KB and <= 50 events per request, 60 events/min per IP, file cap; hostile values cleaned', async () => {
  const file = join(TMP, 'limits.jsonl');
  const srv = await sinkMod.startWithSink({ port: 0, file, ratePerMin: 60, maxFileBytes: 1000000 });
  const b = `http://127.0.0.1:${srv.address().port}`;
  const post = (body) => fetch(`${b}/api/events`, { method: 'POST', headers: { Origin: b, 'Content-Type': 'text/plain' }, body });
  const ev = (i) => JSON.stringify({ event: 'unit_click', unit: String(800 + (i % 90)), session_id: 'limits-test-1' });
  assert.equal((await post('x'.repeat(17 * 1024))).status, 413, '> 16 KB');
  assert.equal((await post(Array.from({ length: 51 }, (_, i) => ev(i)).join('\n'))).status, 413, '> 50 events');
  // hostile values through HTTP: stored cleaned
  const h = await post(JSON.stringify({ event: 'room_view', ...HOSTILE, session_id: 'limits-test-1' }));
  assert.equal(h.status, 204);
  await srv.sink.flushed();
  const stored = dash.parseJsonl(readFileSync(file, 'utf8'));
  assert.deepEqual(personalValues(stored[0]), [], JSON.stringify(stored[0]));
  assert.ok(!('room' in stored[0]) && !('via' in stored[0]) && stored[0].finish === 'other');
  // rate: 60 tokens per minute per IP; 1 used above; 2 x 50 more -> 59 written, the rest dropped silently (204)
  const r1 = await post(Array.from({ length: 50 }, (_, i) => ev(i)).join('\n'));
  const r2 = await post(Array.from({ length: 50 }, (_, i) => ev(i)).join('\n'));
  assert.equal(r1.status, 204); assert.equal(r2.status, 204);
  const written = Number(r1.headers.get('x-habait-events')) + Number(r2.headers.get('x-habait-events'));
  assert.ok(written >= 59 && written <= 60, `rate-limited writes ${written}`);
  assert.equal(r2.headers.get('x-habait-dropped'), 'rate');
  // file cap (50 MB by default; here the current size + 10 bytes): once reached, nothing more is appended
  await srv.sink.flushed();
  const size = readFileSync(file).length;
  srv.close();
  const capSrv = await sinkMod.startWithSink({ port: 0, file, ratePerMin: 1000, maxFileBytes: size + 10 });
  const cb = `http://127.0.0.1:${capSrv.address().port}`;
  const rc = await fetch(`${cb}/api/events`, { method: 'POST', headers: { Origin: cb }, body: ev(1) });
  assert.equal(rc.status, 204); assert.equal(rc.headers.get('x-habait-dropped'), 'file-cap');
  await capSrv.sink.flushed();
  assert.equal(readFileSync(file).length, size);
  capSrv.close();
  return `413 >16KB, 413 >50 events, ${written}/100 under the 60/min bucket, file cap holds at ${size} B`;
});

// ------------------------------------------------------------ browser ------------------------------------------------------------
const require = createRequire(import.meta.url);
function loadPlaywright() {
  const cands = [process.env.PLAYWRIGHT_CORE, process.env.HABAIT_APP_DIR && join(process.env.HABAIT_APP_DIR, 'node_modules/playwright-core'),
    'playwright-core', join(process.env.APPDATA || '', 'npm/node_modules/rea-agents/node_modules/playwright-core')].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch { /* next */ } }
  throw new Error('playwright-core not found; set HABAIT_APP_DIR');
}
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });

const VIEWPORTS = {
  iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  pixel: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' },
  desktop: { viewport: { width: 1280, height: 800 } },
};
async function newPage(vp) {
  const ctx = await browser.newContext({ ...VIEWPORTS[vp], locale: 'he-IL' });
  const page = await ctx.newPage();
  page.reqs = [];
  page.errors = [];
  page.on('request', (r) => page.reqs.push(r.url()));
  page.on('pageerror', (e) => page.errors.push(e.message));
  if (process.env.D2_DEBUG) page.on('console', (m) => console.log(`     [${vp} console.${m.type()}] ${m.text().slice(0, 300)}`));
  return page;
}
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return null; } };
const external = (urls) => urls.filter((u) => /^https?:/.test(u) && !['127.0.0.1', 'localhost'].includes(hostOf(u)));
const readJsonl = () => (existsSync(JSONL) ? dash.parseJsonl(readFileSync(JSONL, 'utf8')) : []);

// the harness page: real modules, served by the real server (so the sink announcement is real)
function writeHarness(name, cfg) {
  writeFileSync(join(TMP, name), `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"></head><body>
<div id="lead"></div>
<script>window.HABAIT_CONFIG = ${JSON.stringify(cfg)};</script>
<script type="module">
import * as a from '../../js/analytics.js';
import * as lead from '../../js/lead.js';
window.__a = a; window.__lead = lead;
a.initAnalytics({ base: { project: 'rainbow', page: 'harness' }, debug: false });
document.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); }, true);
window.__ready = true;
</script></body></html>`);
  return `${base}/_local/analytics-test/${name}`;
}

// fires the 9 D2 event types (11 events) the way the pages will
async function scenario(page) {
  await page.waitForFunction(() => window.__ready === true);
  const sid = await page.evaluate(async () => {
    const a = window.__a;
    a.capture('unit_click', { unit: '846', floor: 16, status: 'for-sale', price: 7950000 });
    a.capture('unit_click', { unit: '857', floor: 17 });
    a.capture('unit_enter', { unit: '846', via: 'flight' });
    const stop = a.startDwell('living', { unit: '846' });
    await new Promise((r) => setTimeout(r, 350));
    stop();
    a.floorSwitch({ finish: 'marble', prev: 'parquet', unit: '846' });
    a.setFavorite('846', true);
    a.capture('apartment_tab', { unit: '846', tab: 'plan' });
    a.capture('zip_download', { unit: '846' });
    window.__lead.renderLeadBlock(document.getElementById('lead'), {
      project: 'rainbow', projectName: 'Rainbow', unit: { id: '846', floor: 16, price: 7950000, status: 'for-sale' }, whatsappNumber: '972500000000', webhookUrl: '',
    });
    return a.sessionId();
  });
  await page.click('#lead a.btn-whatsapp');
  const wa = await page.getAttribute('#lead a.btn-whatsapp', 'href');
  await page.click('#lead .btn-ghost');
  await page.fill('#lead input[name=name]', 'בדיקה');
  await page.fill('#lead input[name=phone]', '0501234567');
  await page.check('#lead input[name=consent]');
  await page.click('#lead button[type=submit]');
  await page.waitForSelector('#lead .lead-status.ok');
  await page.evaluate(() => window.__a.flushEvents());
  return { sid, wa };
}

const outbound = { sdk: null, http: null };

// ---- 1. no key (today): JSONL only, zero external requests (iphone + pixel) ----
for (const vp of ['iphone', 'pixel']) {
  const viewedOn = vp === 'pixel'; // whatsapp_viewed_line: off by default (iphone), on when configured (pixel)
  await step(`${vp}: no-key mode: 0 external requests, 9/9 event types in JSONL, ?src kept for the session, WhatsApp viewed: line ${viewedOn ? 'on' : 'off (default)'}`, async () => {
    const page = await newPage(vp);
    const url = writeHarness(`harness-nokey-${vp}.html`, viewedOn ? { analytics: { whatsapp_viewed_line: true } } : {});
    await page.goto(`${url}?src=fb-oct`);
    await page.waitForFunction(() => window.__ready === true);
    await page.goto(url); // same tab, no ?src: the campaign must stick
    const { sid, wa } = await scenario(page);
    const cfg = await page.evaluate(() => window.__a.analyticsConfig());
    assert.equal(cfg.posthog, false); assert.match(cfg.sink_url, /\/api\/events$/);
    await platform.sink.flushed();
    const mine = readJsonl().filter((r) => r.session_id === sid);
    const types = new Set(mine.map((r) => r.event));
    for (const e of CANON) assert.ok(types.has(e), `missing ${e}`);
    assert.ok(mine.every((r) => r.src === 'fb-oct'), 'src per session');
    assert.ok(mine.some((r) => r.event === 'room_view' && r.room === 'living' && r.dwell_ms >= 300), 'dwell');
    assert.ok(mine.every((r) => !('name' in r) && !('phone' in r)));
    if (viewedOn) assert.match(decodeURIComponent(wa), /rainbow\|846\|[0-9a-f-]{8,}\nviewed:846,857$/);
    else { assert.match(decodeURIComponent(wa), /rainbow\|846\|[0-9a-f-]{8,}$/); assert.ok(!decodeURIComponent(wa).includes('viewed:'), 'viewed: line must be off by default'); }
    for (const r of mine) assert.deepEqual(personalValues(r), [], JSON.stringify(r));
    const ext = external(page.reqs);
    assert.equal(ext.length, 0, ext.join(' '));
    assert.equal(page.reqs.filter((u) => u.startsWith(mockOrigin)).length, 0, 'nothing to the mock host either');
    assert.deepEqual(page.errors, []);
    await page.screenshot({ path: join(shots, `nokey-${vp}.png`) });
    summary.push(`no-key mode (${vp}): 0 external requests, ${types.size}/9 event types (${mine.length} events) in JSONL`);
    await page.context().close();
    return `${page.reqs.length} requests, all 127.0.0.1; ${mine.length} events`;
  });
}

// ---- 2. the real apartment page, no key: its own events land in the JSONL ----
await step('iphone: apartment.html (no key) writes unit_enter / room_view to the JSONL, 0 external requests', async () => {
  const page = await newPage('iphone');
  await page.goto(`${base}/apartment.html?project=rainbow&unit=846&src=ig-story#plan`);
  await page.waitForFunction(() => (window.__habaitRecords || []).some((r) => r.event === 'unit_enter'), null, { timeout: 20000 });
  await page.click('#tab-photos');
  const sid = await page.evaluate(async () => { const a = await import('/js/analytics.js'); await a.flushEvents(); return a.sessionId(); });
  await platform.sink.flushed();
  const mine = readJsonl().filter((r) => r.session_id === sid);
  assert.ok(mine.some((r) => r.event === 'unit_enter' && r.unit === '846' && r.path === '/apartment.html'), JSON.stringify(mine));
  assert.ok(mine.some((r) => r.event === 'room_view' && r.tab === 'photos'));
  assert.ok(mine.some((r) => r.event === 'apartment_tab' && r.tab === 'photos'), 'apartment_tab (D2 name) fires with room_view{tab}');
  assert.ok(mine.every((r) => r.src === 'ig-story' && r.test === true));
  const ext = external(page.reqs);
  assert.equal(ext.length, 0, ext.join(' '));
  await page.context().close();
  return `${mine.length} events, ${page.reqs.length} requests all local`;
});

// ---- 3. key mode (mocked PostHog + Sheet) ----
for (const [vp, transport] of [['pixel', 'sdk'], ['desktop', 'http']]) {
  await step(`${vp}: key mode (${transport}): same events reach the mock in PostHog capture format; allowlist only; lead -> Sheet`, async () => {
    const before = mock.events.length;
    const leadsBefore = mock.leads.length;
    const reqsBefore = mock.reqs.length;
    const page = await newPage(vp);
    const url = writeHarness(`harness-key-${transport}.html`, {
      posthog_key: 'phc_test_habait_dummy', posthog_host: mockOrigin, posthog_transport: transport, sheet_endpoint: `${mockOrigin}/macros/s/TEST/exec`,
      posthog_allow_bots: true, // Playwright sets navigator.webdriver; the SDK drops such traffic by default
      lead_secret: 'habait-test-secret-1234',
    });
    await page.goto(`${url}?src=google-ads`);
    const { sid } = await scenario(page);
    // a careless / hostile caller: phone in room, e-mail in via, URL as page ... must not reach the mock (nor the JSONL)
    await page.evaluate((h) => { window.__a.capture('room_view', h); }, HOSTILE);
    const deadline = Date.now() + 15000;
    while (mock.events.length - before < 12 && Date.now() < deadline) {
      await page.evaluate(() => window.__a.flushEvents());
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 1500)); // anything late (flags, config, retries) shows up here
    const all = mock.events.slice(before);
    const hostile = all.filter((e) => e.properties?.tab === 'hostile');
    const got = all.filter((e) => e.properties?.tab !== 'hostile');
    const names = got.map((e) => e.event);
    assert.equal(hostile.length, 1, 'the hostile event arrives once, cleaned');
    assert.equal(got.length, 11, names.join(','));
    for (const e of all) assert.deepEqual(personalValues(e.properties), [], `value-level leak: ${JSON.stringify(e.properties)}`);
    for (const k of ['room', 'via', 'scene', 'page', 'prev', 'channel', 'floor']) assert.ok(!(k in hostile[0].properties), `hostile ${k} reached the mock`);
    assert.equal(hostile[0].properties.finish, 'other');
    for (const e of CANON) assert.ok(names.includes(e), `missing ${e}`);
    const props = new Set();
    const top = new Set();
    for (const e of got) {
      Object.keys(e).filter((k) => k !== 'path').forEach((k) => top.add(k));
      Object.keys(e.properties || {}).forEach((k) => props.add(k));
      assert.equal(e.properties.distinct_id, sid);
      assert.equal(e.properties.session_id, sid);
      assert.equal(e.properties.src, 'google-ads');
      if (transport === 'http') assert.equal(e.api_key, 'phc_test_habait_dummy'); else assert.equal(e.properties.token, 'phc_test_habait_dummy');
    }
    const allowed = new Set([...adapter.OUTBOUND_FIELDS, ...adapter.ENVELOPE_FIELDS]);
    for (const k of props) assert.ok(allowed.has(k), `property leaves the device but is not on the list: ${k}`);
    for (const k of PII) assert.ok(!props.has(k), `PII-ish property sent: ${k}`);
    const reqs = mock.reqs.slice(reqsBefore);
    const phPaths = [...new Set(reqs.filter((r) => !isSheet(r)).map((r) => `${r.method} ${r.path}`))];
    for (const p of phPaths) assert.ok(/^POST \/(capture|e|i\/v0\/e|batch)\/?$/.test(p), `unexpected PostHog call ${p}`);
    const queries = [...new Set(reqs.filter((r) => !isSheet(r)).flatMap((r) => [...new URLSearchParams(r.query).keys()]))];
    const headers = [...new Set(reqs.filter((r) => !isSheet(r)).flatMap((r) => Object.keys(r.headers)))].sort();
    const phReqs = reqs.filter((r) => !isSheet(r));
    const bodyKeys = [...new Set(phReqs.flatMap((r) => (r.body && typeof r.body === 'object' && !Array.isArray(r.body) ? Object.keys(r.body) : [])))].sort();
    const referers = [...new Set(phReqs.map((r) => r.headers.referer || '-'))];
    for (const ref of referers) assert.ok(ref === '-' || /^https?:\/\/[^/]+\/$/.test(ref), `Referer carries a path: ${ref}`);
    // the lead
    const lead = mock.leads.slice(leadsBefore).pop();
    assert.ok(lead, 'lead reached the Sheet endpoint');
    assert.deepEqual(lead.units_viewed, ['846', '857']);
    assert.equal(lead.name, 'בדיקה'); assert.equal(lead.consent, true); assert.equal(lead.src, 'google-ads'); assert.equal(lead.session_id, sid);
    assert.equal(lead.k, 'habait-test-secret-1234', 'the lead carries the shared secret k');
    // only the platform and the mock: no posthog.com, no CDN
    const ext = external(page.reqs);
    assert.equal(ext.length, 0, ext.join(' '));
    // the JSONL keeps everything in key mode too
    await page.evaluate(() => window.__a.flushEvents()); // the hostile event may still sit in the 2 s sink queue
    await platform.sink.flushed();
    const jsonl = readJsonl().filter((r) => r.session_id === sid);
    assert.equal(jsonl.length, 12, '11 + the cleaned hostile event');
    for (const r of jsonl) assert.deepEqual(personalValues(r), [], JSON.stringify(r));
    outbound[transport] = { body: bodyKeys, top: [...top].sort(), props: [...props].sort(), paths: phPaths, query: queries, headers, referers, lead: Object.keys(lead).sort() };
    summary.push(`key mode (${transport}): ${got.length} capture events to mock endpoint (${reqs.filter((r) => !isSheet(r)).length} HTTP calls: ${phPaths.join(', ')})`);
    summary.push(`lead payload has units_viewed (${transport}): ${JSON.stringify(lead.units_viewed)}`);
    assert.deepEqual(page.errors, []);
    await page.context().close();
    return `${got.length} events, ${phPaths.join(' ')}`;
  });
}

// ---- 4. dashboard (JSONL; then the PostHog query path against the mock) ----
for (const vp of ['iphone', 'desktop']) {
  await step(`${vp}: dashboard shows hot / cold units from the JSONL (Hebrew RTL, 0 external requests)`, async () => {
    const page = await newPage(vp);
    await page.goto(`${base}/dashboard.html?file=_local/analytics-test/events.jsonl&tests=1`);
    await page.waitForSelector('#unitsTable tbody tr');
    assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
    assert.match(await page.textContent('h1'), /דירות חמות וקרות/);
    const heat = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#unitsTable tbody tr')].map((tr) => [tr.dataset.unit, tr.dataset.heat])));
    assert.equal(heat['846'], 'hot', JSON.stringify(heat));
    assert.equal(heat['876'], 'cold');
    assert.equal(Object.keys(heat).length, 12, 'every unit of units.json is listed, cold ones included');
    assert.ok(await page.evaluate(() => document.querySelectorAll('#floorsTable tbody tr').length) >= 6);
    assert.match(await page.textContent('#roomsTable'), /living/);
    assert.match(await page.textContent('#finishTable'), /שיש/);
    assert.match(await page.textContent('#srcTable'), /fb-oct/);
    await page.screenshot({ path: join(shots, `dashboard-${vp}.png`), fullPage: true });
    const ext = external(page.reqs);
    assert.equal(ext.length, 0, ext.join(' '));
    if (vp === 'desktop') {
      await page.click('#langBtn');
      assert.equal(await page.getAttribute('html', 'dir'), 'ltr');
      assert.match(await page.textContent('h1'), /Hot and cold units/);
      await page.click('#langBtn');
      // PostHog query API path (only with a typed project id + personal key)
      await page.click('#advanced summary');
      await page.fill('#phHost', mockOrigin);
      await page.fill('#phProject', '1');
      await page.fill('#phKey', 'phx_test_dummy');
      const q0 = mock.phQueries;
      await page.click('#advForm button[type=submit]');
      await page.waitForFunction(() => /PostHog/.test(document.getElementById('sub').textContent));
      assert.equal(mock.phQueries, q0 + 1);
      const auth = mock.reqs.filter((r) => r.path.startsWith('/api/projects/')).pop().headers.authorization;
      assert.equal(auth, 'Bearer phx_test_dummy');
      const h846 = await page.evaluate(() => document.querySelector('#unitsTable tr[data-unit="846"]').dataset.heat);
      assert.equal(h846, 'hot');
    }
    assert.deepEqual(page.errors, []);
    await page.context().close();
    const rows = Object.entries(heat).map(([u, h]) => `${u}:${h}`).join(' ');
    summary.push(`dashboard (${vp}): ${rows}`);
    return rows;
  });
}

await browser.close();
platform.close();
mockSrv.close();

console.log('\n' + summary.join('\n'));
for (const t of ['sdk', 'http']) {
  const o = outbound[t];
  if (!o) continue;
  console.log(`outbound (${t}) request body keys: ${o.body.join(', ')}`);
  console.log(`outbound (${t}) event keys: ${o.top.join(', ')}`);
  console.log(`outbound (${t}) properties: ${o.props.join(', ')}`);
  console.log(`outbound (${t}) calls: ${o.paths.join(', ')}; query params: ${o.query.join(', ') || '-'}`);
  console.log(`outbound (${t}) request headers: ${o.headers.join(', ')}; Referer: ${o.referers.join(' ')}`);
  console.log(`outbound (${t}) lead fields: ${o.lead.join(', ')}`);
}
console.log(failures ? `\n${failures} failure(s); screenshots in ${shots}` : `\nall green; screenshots in ${shots}`);
process.exit(failures ? 1 : 0);

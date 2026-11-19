// Card 25 (D3): the landing page A/B test.
//   node test/landing.test.mjs           (HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps for playwright-core; Chrome or Edge)
// 1. assignment: 200 simulated sessions -> A and B each within 95..105; the hash is unbiased on 100,000 sessions;
//    ?v=a|b overrides; a tab keeps its arm.
// 2. report_weekly.mjs on a synthetic JSONL in _local/landing-test/ (known funnel -> the same numbers back; test events,
//    out-of-week events and no-variant sessions are left out; PostHog-export shape; missing input -> zeros, exit 0).
// 3. the legal caption copy inside landing.html equals C:\RnD\Projects\Habait\data\sales-plans\legal\disclaimer-he-en.md.
// 4. browser, 3 viewports (iPhone, Android, desktop) x both arms: RTL, the right arm only, the same lead form,
//    the caption, no horizontal overflow, no errors; every event (also the ones flow.html sends from the frame)
//    carries `variant`; the hash path without ?v. The page posts to its OWN sink file
//    (_local/landing-test/browser-events.jsonl), never to the real _local/events.jsonl; its events are test:true.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, '_local', 'landing-test');
mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);

let passed = 0;
let failures = 0;
const step = async (name, fn) => {
  try { const note = await fn(); passed++; console.log('ok   ' + name + (note ? `  (${note})` : '')); } catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.stack || e.message || e).split('\n').slice(0, 3).join('\n     ')); }
};

const landing = await import('../js/landing.js');
const report = await import('../report_weekly.mjs');

// deterministic session ids in the real format (UUID v4), from a fixed seed: the same 200 every run
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function uuids(n, seed) {
  const r = mulberry32(seed);
  const hex = (k) => Array.from({ length: k }, () => Math.floor(r() * 16).toString(16)).join('');
  return Array.from({ length: n }, () => `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(r() * 4)]}${hex(3)}-${hex(12)}`);
}
const SEED = 25; // the card number; fixed before the first run

// ---------------- 1. assignment ----------------
// Binomial(n, 1/2): the probability that a FAIR assignment of n independent sessions lands within 100 +- d.
function binomWithin(n, d) {
  const lg = [0];
  for (let i = 1; i <= n; i++) lg[i] = lg[i - 1] + Math.log(i);
  let s = 0;
  for (let k = Math.ceil(n / 2 - d); k <= Math.floor(n / 2 + d); k++) s += Math.exp(lg[n] - lg[k] - lg[n - k] - n * Math.LN2);
  return s;
}
// The card asks for 95..105 on 200 sessions. A per-session hash cannot promise that: for ANY fair assignment
// P(95..105) = 0.563 at n=200 (sd 7.1). Card 25 decision (T0): the seed is fixed (25, chosen before the first run, never
// re-picked); the 200-session line is printed as it comes out and asserted against the exact 99.9 % binomial band;
// the statistical gate is the 100,000-session check below (+-0.5 %, chi-square over the 100 buckets).
await step('assignment: 200 simulated sessions (fixed seed) inside the 99.9% binomial band; card band reported', () => {
  const ids = uuids(200, SEED);
  let a = 0;
  for (const id of ids) { if (landing.assignVariant(id) === 'a') a++; }
  const b = ids.length - a;
  let d = 0;
  while (1 - binomWithin(200, d) > 0.001) d++;
  const inCard = a >= 95 && a <= 105 && b >= 95 && b <= 105;
  console.log(`split 200 sessions: A=${a} B=${b}`);
  console.log(`     card band 95..105: ${inCard ? 'met' : 'NOT met'} (P(95..105) = ${binomWithin(200, 5).toFixed(3)} for any fair 50/50 hash at n=200); 99.9% band ${100 - d}..${100 + d}`);
  assert.ok(Math.abs(a - 100) <= d, `A=${a} B=${b} outside ${100 - d}..${100 + d}: the hash is biased`);
  return `seed ${SEED}`;
});
await step('assignment: deterministic (same id -> same arm) and unbiased on 100,000 sessions', () => {
  const ids = uuids(100000, 1);
  let a = 0;
  const buckets = new Array(100).fill(0);
  for (const id of ids) { if (landing.assignVariant(id) === 'a') a++; buckets[landing.bucketOf(id)]++; }
  for (const id of ids.slice(0, 50)) assert.equal(landing.assignVariant(id), landing.assignVariant(id));
  const pa = a / ids.length;
  assert.ok(Math.abs(pa - 0.5) < 0.005, `A share ${pa}`);
  // chi-square over the 100 buckets (99 df): the 99.9% critical value is ~148
  const exp = ids.length / 100;
  const chi = buckets.reduce((s, x) => s + (x - exp) ** 2 / exp, 0);
  assert.ok(chi < 148, `chi2=${chi.toFixed(1)}`);
  // sequential ids (sim-0..) must not fall into one arm
  let seq = 0;
  for (let i = 0; i < 10000; i++) if (landing.assignVariant(`sim-${i}`) === 'a') seq++;
  assert.ok(Math.abs(seq / 10000 - 0.5) < 0.02, `sequential A share ${seq / 10000}`);
  return `A=${(100 * pa).toFixed(2)}%, chi2(99)=${chi.toFixed(1)}, sequential A=${(seq / 100).toFixed(1)}%`;
});
await step('assignment: ?v=a|b overrides the hash; bad values fall back; the tab keeps its arm', () => {
  const [id] = uuids(1, SEED);
  const h = landing.assignVariant(id);
  const other = h === 'a' ? 'b' : 'a';
  assert.deepEqual(landing.resolveVariant({ search: `?v=${other}`, sessionId: id }), { variant: other, via: 'link' });
  assert.deepEqual(landing.resolveVariant({ search: `?project=rainbow&v=${other.toUpperCase()}`, sessionId: id }), { variant: other, via: 'link' });
  assert.deepEqual(landing.resolveVariant({ search: '?v=c', sessionId: id }), { variant: h, via: 'hash' });
  assert.deepEqual(landing.resolveVariant({ search: '', sessionId: id }), { variant: h, via: 'hash' });
  assert.deepEqual(landing.resolveVariant({ search: '', sessionId: id, registered: other }), { variant: other, via: 'session' });
  assert.deepEqual(landing.resolveVariant({ search: `?v=${h}`, sessionId: id, registered: other }), { variant: h, via: 'link' });
});

// ---------------- 2. the weekly report on a synthetic JSONL ----------------
const SYN = join(OUT, 'events.jsonl');
const SYN_PH = join(OUT, 'posthog-export.json');
const REPORTS = join(OUT, 'reports');
const expected = { a: { visit: 0, unit_enter: 0, lead_click: 0, lead_submitted: 0, meeting: 0, leads: 0 }, b: { visit: 0, unit_enter: 0, lead_click: 0, lead_submitted: 0, meeting: 0, leads: 0 } };
{
  rmSync(REPORTS, { recursive: true, force: true });
  const r = mulberry32(7);
  const lines = [];
  const t0 = Date.parse('2026-10-27T08:00:00Z');
  const rec = (sid, event, ms, extra = {}) => ({ event, ts: new Date(ms).toISOString(), session_id: sid, project: 'rainbow', src: 'direct', path: '/landing.html', ...extra });
  for (const sid of uuids(400, 99)) {
    const v = landing.assignVariant(sid);
    const E = expected[v];
    let ms = t0 + Math.floor(r() * 6.5 * 86400000);
    const push = (event, extra = {}, withVariant = true) => { ms += 1000 + Math.floor(r() * 60000); lines.push(rec(sid, event, ms, withVariant ? { variant: v, ...extra } : extra)); };
    push('project_open', { page: 'landing', unit: '846', via: 'hash' });
    E.visit++;
    let lead = false;
    if (v === 'b') {
      push('flight_start', { path: '/flow.html' }, false); // the frame's first event raced the field: the session still counts for B
      if (r() < 0.45) { push('unit_click', { unit: '846', path: '/flow.html' }); push('unit_enter', { unit: '846', path: '/flow.html' }); E.unit_enter++; }
    } else if (r() < 0.5) {
      push('room_view', { room: 'living', dwell_ms: 4200, page: 'landing' });
    }
    const pClick = v === 'b' ? 0.22 : 0.12;
    if (r() < pClick) {
      const ch = r() < 0.5 ? 'whatsapp' : 'form';
      push('lead_click', { unit: '846', channel: ch, page: 'landing' });
      E.lead_click++;
      if (ch === 'whatsapp') lead = true;
      if (ch === 'form' && r() < 0.6) { push('lead_submitted', { unit: '846', channel: 'form', stubbed: true, page: 'landing' }); E.lead_submitted++; lead = true; }
    }
    if (lead) { E.leads++; if (r() < 0.3) { push('meeting_booked', { unit: '846' }); E.meeting++; } }
    if (v === 'a' && r() < 0.05) push('lead_click', { unit: '846', channel: 'zip', page: 'apartment' }); // not a lead
  }
  // noise the report must leave out
  for (const sid of uuids(30, 5)) lines.push(rec(sid, 'project_open', t0 + 3600000, { page: 'landing', variant: 'a', test: true }));
  for (const sid of uuids(10, 6)) lines.push(rec(sid, 'project_open', Date.parse('2026-10-20T10:00:00Z'), { page: 'landing', variant: 'b' })); // the week before
  for (const sid of uuids(12, 8)) lines.push(rec(sid, 'project_open', t0 + 7200000, { path: '/flow.html' })); // flow.html opened directly: no arm
  writeFileSync(SYN, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  // the same vocabulary as a PostHog export (properties envelope)
  const ph = lines.slice(0, 40).map((l) => { const { event, ts, ...p } = l; return { event, timestamp: ts, distinct_id: p.session_id, properties: p }; });
  writeFileSync(SYN_PH, JSON.stringify(ph));
}
await step('report: the funnel per arm from the synthetic JSONL equals what was generated', async () => {
  const r = await report.buildReport({ from: [SYN], out: REPORTS, end: '2026-11-02' });
  for (const v of ['a', 'b']) {
    const got = r.funnel.arms[v];
    for (const k of ['visit', 'unit_enter', 'lead_click', 'lead_submitted', 'meeting']) assert.equal(got.steps[k], expected[v][k], `${v}.${k}`);
    assert.equal(got.leads, expected[v].leads, `${v}.leads`);
  }
  assert.equal(r.funnel.stats.excludedTest, 30);
  assert.equal(r.funnel.stats.noVariantSessions, 12);
  assert.ok(r.funnel.stats.outOfWindow >= 10);
  assert.equal(r.cumulative.arms.b.steps.visit, expected.b.visit + 10, 'cumulative includes the week before');
  assert.ok(existsSync(r.file));
  const md = readFileSync(r.file, 'utf8');
  for (const s of ['דוח שבועי', '2026-10-27 עד 2026-11-02', 'משפך לכל וריאנט', 'ביקור → ליד', 'ליד → פגישה', 'סף הוכחה', '1,000', '6–8 שבועות', 'מספרים גולמיים']) assert.ok(md.includes(s), s);
  assert.ok(md.includes(`| ביקור בדף | ${expected.a.visit} |`), 'visit row');
  const E = expected;
  return `A visit=${E.a.visit} enter=${E.a.unit_enter} click=${E.a.lead_click} submit=${E.a.lead_submitted} lead=${E.a.leads} meeting=${E.a.meeting} | B visit=${E.b.visit} enter=${E.b.unit_enter} click=${E.b.lead_click} submit=${E.b.lead_submitted} lead=${E.b.leads} meeting=${E.b.meeting}`;
});
await step('report: a PostHog-export file (properties envelope) reads like the JSONL', async () => {
  const a = await report.buildReport({ from: [SYN_PH], end: '2026-11-02' });
  const sub = report.parseText(readFileSync(SYN, 'utf8')).slice(0, 40);
  const b = report.computeFunnel(sub, { startMs: a.week.startMs, endMs: a.week.endMs });
  assert.deepEqual(a.funnel.arms, b.arms);
  assert.ok(a.funnel.stats.used === 40);
});
await step('report CLI: missing input -> report with zeros that says so, exit 0', () => {
  const missing = join(OUT, 'no-such-events.jsonl');
  const p = spawnSync(process.execPath, ['report_weekly.mjs', '--from', missing, '--out', REPORTS, '--name', 'weekly-empty.md'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  const md = readFileSync(join(REPORTS, 'weekly-empty.md'), 'utf8');
  assert.ok(md.includes('לא קיים') && md.includes('כל המספרים למטה 0'), 'says the input is missing');
  const bad = spawnSync(process.execPath, ['report_weekly.mjs', '--out', REPORTS], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(bad.status, 2, 'no --from = usage error');
  return p.stdout.trim().split('\n').pop();
});

// ---------------- 3. legal caption copy ----------------
await step('landing.html: the caption template equals disclaimer-he-en.md sections 1 + 2 (he + en)', async () => {
  const { parseDisclaimerMd } = await import('../tools/build_zip.mjs');
  const md = readFileSync(process.env.HABAIT_LEGAL_MD || 'C:/RnD/Projects/Habait/data/sales-plans/legal/disclaimer-he-en.md', 'utf8');
  const legal = parseDisclaimerMd(md);
  const html = readFileSync(join(ROOT, 'landing.html'), 'utf8');
  const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  for (const part of ['short', 'full']) for (const lang of ['he', 'en']) {
    const m = new RegExp(`<div data-part="${part}" data-lang="${lang}">(.*?)</div>`).exec(html);
    assert.ok(m, `${part}/${lang} block`);
    const text = [...m[1].matchAll(/<p>(.*?)<\/p>/g)].map((x) => unesc(x[1])).join('\n');
    assert.equal(text, legal[part][lang], `${part}/${lang} drifted from the md`);
  }
});

// ---------------- 4. browser ----------------
function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_CORE,
    process.env.HABAIT_APP_DIR && join(process.env.HABAIT_APP_DIR, 'node_modules', 'playwright-core'),
    'playwright-core', join(process.env.APPDATA || '', 'npm/node_modules/rea-agents/node_modules/playwright-core')].filter(Boolean);
  for (const c of candidates) { try { return require(c); } catch { /* next */ } }
  throw new Error('playwright-core not found (set HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps or PLAYWRIGHT_CORE)');
}
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

const VIEWPORTS = [
  { name: 'iphone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { name: 'android', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' },
  { name: 'desktop', viewport: { width: 1366, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];

const SINK_FILE = join(OUT, 'browser-events.jsonl');
const SHOTS = join(OUT, 'shots');
mkdirSync(SHOTS, { recursive: true });
rmSync(SINK_FILE, { force: true });
const realEvents = join(ROOT, '_local', 'events.jsonl');
const realBefore = existsSync(realEvents) ? readFileSync(realEvents, 'utf8').length : -1;

let browser = null;
let server = null;
try {
  const { chromium } = loadPlaywright();
  const { startWithSink } = await import('../tools/events-sink.mjs');
  server = await startWithSink({ port: 0, file: SINK_FILE, ratePerMin: 100000 });
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: chromePath, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });

  const openPage = async (vp, url, initSid = null) => {
    const { name, ...opts } = vp;
    const context = await browser.newContext({ ...opts, locale: 'he-IL' });
    if (initSid) await context.addInitScript((sid) => { try { if (!sessionStorage.getItem('habait.session')) sessionStorage.setItem('habait.session', sid); } catch { /* */ } }, initSid);
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
    await page.goto(base + url);
    await page.waitForSelector('body.ready', { timeout: 30000 });
    return { page, context };
  };
  const flush = (target) => target.evaluate(() => import('/js/analytics.js').then((m) => m.flushEvents())).catch(() => null);

  for (const vp of VIEWPORTS) {
    for (const arm of ['a', 'b']) {
      const label = `${vp.name} ${vp.viewport.width}x${vp.viewport.height} arm ${arm.toUpperCase()}`;
      const { page, context } = await openPage(vp, `/landing.html?project=rainbow&v=${arm}&src=landing-test`);
      await step(`browser ${label}: RTL, only arm ${arm.toUpperCase()} on the page, facts + caption`, async () => {
        assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
        const st = await page.evaluate(() => window.__landing);
        assert.equal(st.variant, arm);
        assert.equal(st.via, 'link');
        assert.equal(await page.isVisible('#variantA'), arm === 'a');
        assert.equal(await page.isVisible('#variantB'), arm === 'b');
        assert.equal(await page.locator('#flightIframe').count(), arm === 'b' ? 1 : 0, 'the frame exists only in B');
        assert.match(await page.textContent('#projectName'), /Rainbow/);
        assert.ok((await page.locator('#factsList .landing-fact').count()) >= 4, 'facts');
        const legal = await page.textContent('#legalFull');
        assert.ok(legal.includes('הדמיה להמחשה בלבד') && legal.includes('846') && legal.includes('המפרט'), 'full caption in the footer');
        assert.ok(!/\{[A-Z_]+\}/.test(legal), 'no unfilled {VAR}');
        if (arm === 'a') assert.ok((await page.textContent('[data-legal-short]:visible')).includes('הדמיה להמחשה בלבד'), 'short caption next to the media');
        // Q5 (Eliran 2026-11-04 "לצמצם"): arm B shows no landing copy of the disclosure (the flight carries it on the media),
        // and the legal block's summary is a label; the full wording above is still checked
        else {
          assert.equal(await page.locator('[data-legal-short]:visible').count(), 0, 'arm B: no second disclosure under the flight');
          assert.equal((await page.textContent('#legalSummary')).trim(), 'מידע משפטי', 'arm B: the legal summary is a label');
        }
        // against the DEVICE width: a too-wide element makes a mobile browser widen the layout viewport itself
        const w = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(w.inner <= vp.viewport.width && w.scroll <= vp.viewport.width + 1, `horizontal overflow: layout ${w.inner}px / content ${w.scroll}px on a ${vp.viewport.width}px screen`);
        return `media=${st.media}, stills=${st.stills}`;
      });
      if (arm === 'a') {
        await step(`browser ${label}: renders load; a tile opens the lightbox -> room_view with dwell + variant`, async () => {
          await page.waitForFunction(() => { const i = document.getElementById('heroImg'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 20000 });
          const tiles = await page.locator('#gallery .tile').count();
          assert.ok(tiles >= 4, `tiles ${tiles}`);
          await page.locator('#gallery .tile').first().scrollIntoViewIfNeeded();
          await page.waitForFunction(() => { const i = document.querySelector('#gallery .tile img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 20000 });
          await page.locator('#gallery .tile').first().click();
          assert.ok(await page.evaluate(() => document.getElementById('lightbox').open));
          await page.waitForTimeout(300);
          await page.click('#lightboxClose');
          const rv = await page.evaluate(() => window.__habaitRecords.filter((r) => r.event === 'room_view'));
          assert.equal(rv.length, 1);
          assert.equal(rv[0].variant, 'a');
          assert.ok(rv[0].dwell_ms >= 200, `dwell ${rv[0].dwell_ms}`);
          return `${tiles} tiles`;
        });
      } else {
        await step(`browser ${label}: flow.html runs in the frame and its events carry variant b`, async () => {
          const frame = await (await page.$('#flightIframe')).contentFrame();
          await frame.waitForSelector('#startBtn', { state: 'visible', timeout: 30000 });
          await frame.waitForFunction(() => (window.__habaitRecords || []).some((r) => r.event === 'project_open'), null, { timeout: 30000 });
          const recs = await frame.evaluate(() => window.__habaitRecords);
          const po = recs.find((r) => r.event === 'project_open');
          assert.equal(po.variant, 'b', 'frame project_open variant');
          assert.equal(po.path, '/flow.html');
          const outer = await page.evaluate(() => window.__landing.session_id);
          assert.equal(po.session_id, outer, 'one session across page and frame');
          assert.equal(po.src, 'landing-test', 'the campaign tag reaches the frame');
          const full = await page.getAttribute('#flightFull', 'href');
          assert.match(full, /flow\.html\?project=rainbow/);
          await flush(frame);
        });
      }
      await step(`browser ${label}: the same lead form: WhatsApp tag + form submit -> lead_click/lead_submitted with variant`, async () => {
        if (await page.evaluate(() => { const s = document.getElementById('leadSection'); return !s || s.hidden; })) return; // Eliran 2026-11-04: no lead form on the landing
        const wa = await page.getAttribute('#landingLead .btn-whatsapp', 'href');
        const sid = await page.evaluate(() => window.__landing.session_id);
        assert.ok(decodeURIComponent(wa).includes(`rainbow|846|${sid}`), wa);
        await page.locator('#landingLead .btn-ghost').scrollIntoViewIfNeeded();
        await page.click('#landingLead .btn-ghost');
        await page.fill('#landingLead input[name=name]', 'בדיקה');
        await page.fill('#landingLead input[name=phone]', '050-0000000');
        await page.check('#landingLead input[name=consent]');
        await page.click('#landingLead button[type=submit]');
        await page.waitForSelector('#landingLead .lead-status.ok', { timeout: 10000 });
        const recs = await page.evaluate(() => window.__habaitRecords);
        for (const ev of ['project_open', 'lead_click', 'lead_submitted']) {
          const r = recs.find((x) => x.event === ev);
          assert.ok(r, ev);
          assert.equal(r.variant, arm, `${ev}.variant`);
          assert.equal(r.page, 'landing', `${ev}.page`);
          assert.equal(r.test, true, `${ev}.test`);
          assert.ok(!JSON.stringify(r).includes('0000000'), 'no phone in an event');
        }
        assert.ok(recs.every((r) => r.variant === arm), 'every event of the page carries the arm');
      });
      await page.screenshot({ path: join(SHOTS, `${vp.name}-${arm}.png`), fullPage: true });
      await flush(page);
      await step(`browser ${label}: no page errors`, () => { assert.deepEqual(page.errors, [], page.errors.join('\n')); });
      await context.close();
    }
  }

  // the hash path (no ?v): two known session ids, one per arm
  const ids = uuids(200, SEED);
  for (const want of ['a', 'b']) {
    const sid = ids.find((x) => landing.assignVariant(x) === want);
    const { page, context } = await openPage(VIEWPORTS[2], '/landing.html?project=rainbow', sid);
    await step(`browser desktop, no ?v: session ${sid.slice(0, 8)} -> arm ${want.toUpperCase()} by hash (Node and browser agree)`, async () => {
      const st = await page.evaluate(() => window.__landing);
      assert.equal(st.session_id, sid);
      assert.equal(st.variant, want);
      assert.equal(st.via, 'hash');
      await page.reload();
      await page.waitForSelector('body.ready');
      const again = await page.evaluate(() => window.__landing);
      assert.equal(again.variant, want);
      assert.equal(again.via, 'session', 'a reload keeps the arm of the tab');
    });
    if (want === 'a') {
      await step('browser desktop: language toggle -> English LTR, caption in English', async () => {
        await page.click('#langToggle');
        assert.equal(await page.getAttribute('html', 'dir'), 'ltr');
        assert.match(await page.textContent('#factsTitle'), /Apartment 846/);
        assert.match(await page.textContent('#legalFull'), /Illustration only/);
        await page.click('#langToggle');
        assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
      });
    }
    await flush(page);
    await context.close();
  }

  await step('sink: the browser events went to the test file only, all test:true, every landing/frame event with variant', async () => {
    await new Promise((r) => setTimeout(r, 300));
    await server.sink.flushed();
    const lines = readFileSync(SINK_FILE, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.ok(lines.length >= 20, `lines ${lines.length}`);
    assert.ok(lines.every((l) => l.test === true), 'test:true');
    assert.ok(lines.every((l) => l.variant === 'a' || l.variant === 'b'), 'variant on every event');
    assert.ok(lines.some((l) => l.path === '/flow.html' && l.variant === 'b'), 'frame events reached the sink');
    const realAfter = existsSync(realEvents) ? readFileSync(realEvents, 'utf8').length : -1;
    assert.equal(realAfter, realBefore, 'the real _local/events.jsonl was not touched');
    const r = await report.buildReport({ from: [SINK_FILE], includeTest: true });
    assert.ok(r.funnel.arms.a.steps.visit >= 3 && r.funnel.arms.b.steps.visit >= 3, 'report reads the browser events');
    return `${lines.length} events; report --include-test: A visits=${r.funnel.arms.a.steps.visit} leads=${r.funnel.arms.a.leads}, B visits=${r.funnel.arms.b.steps.visit} leads=${r.funnel.arms.b.leads}`;
  });
} catch (e) {
  failures++;
  console.log('FAIL browser section\n     ' + String(e.stack || e).split('\n').slice(0, 3).join('\n     '));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await new Promise((r) => server.close(r));
}

console.log(`landing test: ${passed}/${passed + failures} ok${failures ? `, ${failures} FAILED` : ''}  (shots: ${SHOTS.replace(/\\/g, '/')})`);
process.exit(failures ? 1 : 0);

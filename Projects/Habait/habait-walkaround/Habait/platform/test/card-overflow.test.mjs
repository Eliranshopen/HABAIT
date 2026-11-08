// M1 v2 defect 5 (2026-11-03): the unit card must fit the phone once the lead form is open.
//   export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && node test/card-overflow.test.mjs [shotsDir]
// The bug: the lead form's two inputs kept their intrinsic width (~207 px each) inside the `1fr 1fr` row of css/style.css,
// so the card body grew to 422 px and #unitSheet (overflow:auto) scrolled sideways inside itself: cut on the left in
// Hebrew RTL, on the right in English. NOTE: document.documentElement.scrollWidth stays = innerWidth in that state (the
// sheet clips its own overflow), so this test also checks the sheet's own scrollWidth and every element of the card.
// Runs flow.html?project=rainbow&seg=hold-facade (the real flight's hold, the tour's return entry) on iPhone 13, Pixel 7
// and desktop, each in Hebrew and English: a real tap on 846 -> the card -> "leave details" -> the form, phone focused.
// Starts its own platform server on a free port (POST /api/events answered 204, _local/events.jsonl untouched).
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PLATFORM = resolve(here, '..');
const shots = process.argv[2] || join(PLATFORM, 'test/shots/card-overflow');
mkdirSync(shots, { recursive: true });

const req = createRequire(import.meta.url);
function fromAppDir(name) {
  const cands = [process.env.HABAIT_APP_DIR && join(process.env.HABAIT_APP_DIR, 'noop.js'), 'C:/RnD/Projects/Habait/tools/appdeps/noop.js', join(PLATFORM, 'noop.js')].filter(Boolean);
  for (const c of cands) { try { return createRequire(c)(name); } catch { /* next */ } }
  try { return req(name); } catch { throw new Error(`${name} not found; export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`); }
}
const pw = process.env.PLAYWRIGHT_CORE ? req(process.env.PLAYWRIGHT_CORE) : fromAppDir('playwright-core');
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

let ok = 0, failures = 0;
const step = async (name, fn) => {
  try { const r = await fn(); ok++; console.log('ok   ' + name + (r ? `  (${r})` : '')); return r; }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n').slice(0, 4).join('\n     ')); return null; }
};

// card 34 follow-up (2026-11-03 09:05): measure only once the card is at rest. Its entry is a CSS animation (sheet-in, .25 s, not
// a transition), which lags under SwiftShader load: a fixed 350 ms wait caught it 1-3 px low over the legal band (M1 v3 reviewer:
// 15/16, 9/12, 12/14). Wait for every finite animation of the sheet and the band to finish (3 s guard), then for both boxes to stay
// identical over 3 consecutive frames (5 s guard, else the step fails with the numbers).
async function settle(page) {
  const r = await page.evaluate(async () => {
    const els = ['unitSheet', 'legalBand'].map((id) => document.getElementById(id)).filter(Boolean);
    const anims = els.flatMap((e) => e.getAnimations({ subtree: true })).filter((a) => a.effect?.getComputedTiming?.().iterations !== Infinity);
    await Promise.race([Promise.all(anims.map((a) => a.finished.catch(() => null))), new Promise((ok) => setTimeout(ok, 3000))]);
    const key = () => els.map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => v.toFixed(2)).join(','); }).join('|');
    let prev = key(), same = 0, frames = 0;
    const t0 = performance.now();
    while (same < 3 && performance.now() - t0 < 5000) {
      await new Promise((ok) => requestAnimationFrame(() => ok()));
      frames++;
      const k = key();
      same = k === prev ? same + 1 : 0;
      prev = k;
    }
    return { anims: anims.length, frames, settled: same >= 3, ms: Math.round(performance.now() - t0) };
  });
  if (!r.settled) throw new Error(`the card did not come to rest in 5 s (${JSON.stringify(r)})`);
  return r;
}

const server = createServer((rq, rs) => {
  if ((rq.url || '').startsWith('/api/events')) { rs.writeHead(204); rs.end(); return; }
  handle(rq, rs).catch((e) => { console.error(e); if (!rs.headersSent) rs.writeHead(500); rs.end(); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ executablePath: chromePath, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });

const dev = (name) => { const d = { ...pw.devices[name] }; delete d.defaultBrowserType; return d; };
const devices = [
  { name: 'iphone13', opts: dev('iPhone 13') },
  { name: 'pixel7', opts: dev('Pixel 7') },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 800 } } },
];

// everything the card shows, measured in the page: the document, the sheet, every visible element of the card
const measure = () => {
  const s = document.getElementById('unitSheet');
  const r = s.getBoundingClientRect();
  const out = [];
  for (const e of s.querySelectorAll('*')) {
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height || getComputedStyle(e).visibility === 'hidden') continue;
    if (b.left < r.left - 0.5 || b.right > r.right + 0.5 || b.left < -0.5 || b.right > innerWidth + 0.5)
      out.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''} [${b.left.toFixed(0)}..${b.right.toFixed(0)}]`);
  }
  const band = document.getElementById('legalBand');
  const bb = band && !band.hidden ? band.getBoundingClientRect() : null;
  const bandTop = bb ? document.elementFromPoint(bb.left + bb.width / 2, bb.top + Math.min(bb.height / 2, 9)) : null;
  const legend = [...document.querySelectorAll('.picker-legend')].filter((l) => l.offsetParent && !l.closest('[hidden]'));
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const inp = (n) => { const i = s.querySelector(`.lead-form input[name=${n}]`); if (!i || i.closest('[hidden]')) return null; const q = i.getBoundingClientRect(); return { w: q.width, top: q.top, left: q.left, right: q.right }; };
  const facts = [...s.querySelectorAll('.unit-facts .fact')].map((f) => f.getBoundingClientRect());
  return {
    inner: innerWidth, innerH: innerHeight, docSW: document.documentElement.scrollWidth, bodySW: document.body.scrollWidth, scrollX,
    sheetSW: s.scrollWidth, sheetCW: s.clientWidth, sheetScrollLeft: s.scrollLeft, dir: s.dir,
    box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, outside: out,
    band: bb ? { top: bb.top, onTop: !!bandTop && (bandTop === band || band.contains(bandTop)) } : null,
    legendOverlap: legend.some((l) => hit(l.getBoundingClientRect(), r)), legends: legend.length,
    name: inp('name'), phone: inp('phone'), facts: facts.length, factsRow: facts.every((f) => Math.abs(f.top - facts[0].top) < 1),
  };
};

function assertFits(m, label) {
  const bad = [];
  if (m.docSW > m.inner) bad.push(`document scrollWidth ${m.docSW} > ${m.inner}`);
  if (m.bodySW > m.inner) bad.push(`body scrollWidth ${m.bodySW} > ${m.inner}`);
  if (m.scrollX !== 0) bad.push(`page scrolled sideways ${m.scrollX}`);
  if (m.sheetSW > m.sheetCW) bad.push(`card scrolls sideways inside itself: sheet scrollWidth ${m.sheetSW} > clientWidth ${m.sheetCW}`);
  if (m.sheetScrollLeft !== 0) bad.push(`card scrollLeft ${m.sheetScrollLeft}`);
  if (m.box.left < -0.5 || m.box.right > m.inner + 0.5 || m.box.top < -0.5 || m.box.bottom > m.innerH + 0.5) bad.push(`card box [${m.box.left.toFixed(1)}..${m.box.right.toFixed(1)}] x [${m.box.top.toFixed(1)}..${m.box.bottom.toFixed(1)}] outside ${m.inner}x${m.innerH}`);
  if (m.outside.length) bad.push(`${m.outside.length} card elements outside the card/viewport: ${m.outside.slice(0, 4).join(', ')}`);
  if (!m.band || !m.band.onTop || m.band.top < m.box.bottom - 0.5) bad.push(`the legal band is covered by the card (${JSON.stringify(m.band)}, card bottom ${m.box.bottom.toFixed(1)})`);
  if (m.legendOverlap) bad.push('a .picker-legend overlaps the card');
  if (m.facts !== 4 || !m.factsRow) bad.push(`facts: ${m.facts}, one row ${m.factsRow}`);
  if (bad.length) throw new Error(`${label}: ${bad.join('; ')}`);
}

for (const d of devices) for (const lang of ['he', 'en']) {
  const tag = `[${d.name} ${lang}]`;
  const context = await browser.newContext({ ...d.opts, locale: lang === 'he' ? 'he-IL' : 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && (m.location()?.url || '').startsWith(base)) errors.push('console: ' + m.text()); });
  await page.goto(`${base}/flow.html?project=rainbow&seg=hold-facade${lang === 'en' ? '&lang=en' : ''}`);

  const tapped = await step(`${tag} hold: 846 is tappable (its centre is the 846 pill) and a real tap opens its card`, async () => {
    await page.waitForFunction(() => window.__habait?.state?.seg?.id === 'hold-facade', null, { timeout: 30000 });
    await page.waitForFunction(() => { const el = document.querySelector('.hotspot[data-unit="846"]'); return el && el.style.display !== 'none'; }, null, { timeout: 15000 });
    await page.waitForFunction(() => !window.__habait.real?.viewEase, null, { timeout: 8000 });
    await page.waitForTimeout(300);
    const hit = await page.evaluate(() => { const el = document.querySelector('.hotspot[data-unit="846"]'); const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top && top.closest('.hotspot')?.dataset.unit; });
    if (hit !== '846') throw new Error(`the centre of the 846 pill is covered by ${hit}`);
    await page.click('.hotspot[data-unit="846"]', { timeout: 5000 }); // Playwright refuses an obscured target
    await page.waitForSelector('#unitSheet:not([hidden])');
    await settle(page); // the entry animation is over and the card/band boxes are still (was: a fixed 350 ms)
    const m = await page.evaluate(measure);
    if (m.dir !== (lang === 'he' ? 'rtl' : 'ltr')) throw new Error(`card dir ${m.dir}`);
    assertFits(m, 'card closed form');
    return `card ${m.sheetSW}/${m.sheetCW} px, ${m.dir}`;
  });
  if (!tapped) { await context.close(); continue; }

  await step(`${tag} lead form open, phone focused and typed: document, card and every card element inside ${d.name === 'desktop' ? 'the card' : 'the phone'}`, async () => {
    if (!(await page.locator('#leadBlock').count())) return 'no lead form (Eliran 2026-11-04) — nothing to open'; // the card has none now
    await page.click('#leadBlock .lead-form > .row .btn-ghost'); // "השאירו פרטים" / "Leave details"
    await page.waitForSelector('#leadBlock form:not([hidden])');
    await page.click('#leadBlock input[name=name]'); await page.keyboard.type(lang === 'he' ? 'בדיקת QA' : 'QA check');
    await page.click('#leadBlock input[name=phone]'); await page.keyboard.type('0501234567');
    await settle(page); // the form is open and the card is still (was: a fixed 300 ms)
    await page.screenshot({ path: join(shots, `${d.name}-${lang}-lead-form.png`) });
    const m = await page.evaluate(measure);
    assertFits(m, 'lead form open');
    if (!m.name || !m.phone) throw new Error('form inputs not visible');
    if (Math.min(m.name.w, m.phone.w) < 120) throw new Error(`inputs squeezed: name ${m.name.w.toFixed(0)} px, phone ${m.phone.w.toFixed(0)} px`);
    if (Math.abs(m.name.top - m.phone.top) > 1) throw new Error('name and phone are not on one row');
    return `doc ${m.docSW}/${m.inner}, card ${m.sheetSW}/${m.sheetCW}, box ${m.box.left.toFixed(0)}..${m.box.right.toFixed(0)}, inputs ${m.name.w.toFixed(0)}+${m.phone.w.toFixed(0)} px, band visible, legends ${m.legends}`;
  });

  await step(`${tag} card closed: 846 still tappable, no page errors`, async () => {
    await page.click('#unitClose');
    await page.waitForSelector('#unitSheet', { state: 'hidden' });
    const hit = await page.evaluate(() => { const el = document.querySelector('.hotspot[data-unit="846"]'); if (!el || el.style.display === 'none') return 'hidden'; const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top && top.closest('.hotspot')?.dataset.unit; });
    if (hit !== '846') throw new Error(`846 after closing the card: ${hit}`);
    await page.click('.hotspot[data-unit="846"]', { timeout: 5000 });
    await page.waitForSelector('#unitSheet:not([hidden])');
    if (errors.length) throw new Error(errors.join('\n'));
  });
  await context.close();
}
await browser.close();
server.close();
console.log(`\nshots: ${shots}`);
console.log(`card overflow: ${ok}/${ok + failures} ok (iPhone 13, Pixel 7, desktop x he, en)`);
process.exit(failures ? 1 : 0);

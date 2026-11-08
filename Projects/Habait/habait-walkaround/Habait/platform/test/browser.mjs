// End-to-end browser test of the buyer flow against a running server (default http://127.0.0.1:8850).
// Uses playwright-core (any install: set PLAYWRIGHT_CORE to its folder, or have it in node_modules)
// and a Chrome/Chromium executable (CHROME_PATH, else Google Chrome's default Windows path).
// On this machine playwright-core comes from the global rea-agents package (%APPDATA%/npm/node_modules/rea-agents).
//   node test/browser.mjs [baseUrl] [shotsDir]
// Section 4 serves a blank page from a second origin and imports js/picker.js from baseUrl, the way habait-89's
// :8899 viewer does (cross-origin ES modules + CSS + JSON need serve.mjs's Access-Control-Allow-Origin: *).
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const base = process.argv[2] || 'http://127.0.0.1:8850';
const shots = process.argv[3] || join(process.cwd(), 'test', 'shots');
mkdirSync(shots, { recursive: true });

function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_CORE, 'playwright-core', 'playwright',
    join(process.env.APPDATA || '', 'npm/node_modules/rea-agents/node_modules/playwright-core')].filter(Boolean);
  for (const c of candidates) { try { return require(c); } catch { /* next */ } }
  throw new Error('playwright-core not found; set PLAYWRIGHT_CORE');
}
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
let failures = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n')[0]); } };

async function newPage(viewport) {
  const page = await browser.newPage({ viewport, locale: 'he-IL' });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  return page;
}

// ---- 1. index ----
{
  const page = await newPage({ width: 1280, height: 760 });
  await page.goto(base + '/');
  await step('index lists the rainbow project in Hebrew RTL', async () => {
    // platform-ui-ux card 11 redesigned the home page: the project card is .home-card, its title .hb-media-card__title (h3)
    await page.waitForSelector('.home-card');
    assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
    assert.match(await page.textContent('.home-card .hb-media-card__title'), /Rainbow/);
  });
  await step('language toggle flips to English LTR', async () => {
    await page.click('#langToggle');
    assert.equal(await page.getAttribute('html', 'dir'), 'ltr');
    assert.match(await page.textContent('#galleryTitle'), /Projects/);   // card 11: the gallery heading replaced .index-title
    await page.click('#langToggle'); // back to Hebrew for the flow
  });
  await page.screenshot({ path: join(shots, 'index.png') });
  assert.deepEqual(page.errors, [], page.errors.join('\n'));
  await page.close();
}

// ---- 2. the full flow on a phone viewport ----
{
  const page = await newPage({ width: 390, height: 844 });
  await page.goto(base + '/flow.html?project=rainbow&real=0');
  await step('start overlay shows the project, start tap begins the approach video', async () => {
    await page.waitForSelector('#startBtn');
    assert.match(await page.textContent('#startTitle'), /Rainbow/);
    await page.click('#startBtn');
    await page.waitForFunction(() => window.__habait?.state.seg?.id === 'approach');
    await page.waitForFunction(() => document.getElementById('video').currentTime > 0.2, null, { timeout: 15000 });
    const ev = await page.evaluate(() => window.__habaitEvents.map((e) => e.event));
    assert.ok(ev.includes('project_open') && ev.includes('flight_start') && ev.includes('segment_start'), ev.join(','));
  });
  await step('time-based hotspot: 846 appears on approach only after t=5', async () => {
    const early = await page.evaluate(() => document.querySelectorAll('.hotspot:not(.nav)').length);
    assert.equal(early, 0, 'no unit marker before t=5');
    await page.waitForFunction(() => document.getElementById('video').currentTime >= 5.2, null, { timeout: 15000 });
    await page.waitForSelector('.hotspot:not(.nav)', { timeout: 3000 });
    await page.screenshot({ path: join(shots, 'approach-phone.png') });
  });
  await step('segments chain approach -> orbit (still) -> hold-facade (loop)', async () => {
    await page.waitForFunction(() => window.__habait?.state.seg?.id === 'orbit', null, { timeout: 15000 });
    await page.waitForFunction(() => window.__habait?.state.seg?.id === 'hold-facade', null, { timeout: 15000 });
    await page.waitForSelector('.hotspot.status-for-sale');
    const n = await page.evaluate(() => document.querySelectorAll('.hotspot:not(.nav)').length);
    assert.ok(n >= 10, `expected >= 10 unit markers, got ${n}`);
  });
  await step('drag rotates the view and markers follow', async () => {
    const before = await page.evaluate(() => window.__habait.state.viewer.yaw);
    const box = await (await page.$('#viewer')).boundingBox();
    await page.mouse.move(box.width / 2, box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.width / 2 - 120, box.height / 2, { steps: 8 });
    await page.mouse.up();
    const after = await page.evaluate(() => window.__habait.state.viewer.yaw);
    assert.ok(after > before + 5, `yaw ${before} -> ${after}`);
    await page.evaluate(() => window.__habait.state.viewer.lookAt(-6, -4)); // back on 846
  });
  await step('click 846 -> card with price/status/facts and WhatsApp link', async () => {
    await page.waitForFunction(() => { const el = [...document.querySelectorAll('.hotspot')].find((h) => h.textContent.includes('846')); return el && el.style.display !== 'none'; });
    await page.evaluate(() => [...document.querySelectorAll('.hotspot')].find((h) => h.textContent.includes('846')).click());
    await page.waitForSelector('#unitSheet:not([hidden])');
    const txt = await page.textContent('#unitBody');
    assert.match(txt, /846/); assert.match(txt, /16/); assert.match(txt, /118/); assert.match(txt, /למכירה/);
    assert.equal(await page.locator('#unitBody a.btn-whatsapp').count(), 0, 'F20: no WhatsApp button while project.leads.whatsapp_number is empty');
    await page.screenshot({ path: join(shots, 'card-phone.png') });
  });
  await step('no lead form on the card (Eliran 2026-11-04: «טופס הפנייה … לא צריך»)', async () => {
    assert.equal(await page.locator('#unitBody .lead-form, #leadBlock').count(), 0);
  });
  await step('continue -> descend-846 (video) -> enter-846 (still) -> hand-off overlay', async () => {
    await page.click('#unitContinue');
    await page.waitForFunction(() => window.__habait?.state.seg?.id === 'descend-846');
    await page.waitForFunction(() => document.getElementById('video').currentTime > 0.2, null, { timeout: 15000 });
    await page.waitForFunction(() => window.__habait?.state.seg?.id === 'enter-846', null, { timeout: 15000 });
    await page.screenshot({ path: join(shots, 'enter-phone.png') });
    await page.waitForSelector('#handoffOverlay:not([hidden])', { timeout: 10000 });
    const href = await page.getAttribute('#handoffLink', 'href');
    assert.match(href, /^http:\/\/127\.0\.0\.1:8848\/\?scope=apartment&room=terraceLiving&floor=parquet&video=0&return=.*from=flight&sid=/);
    await page.screenshot({ path: join(shots, 'handoff-phone.png') });
    const ev = await page.evaluate(() => window.__habaitEvents.map((e) => e.event));
    assert.ok(ev.includes('unit_click') && ev.includes('unit_enter'), ev.join(','));
  });
  await step('no page errors during the flow', async () => { assert.deepEqual(page.errors, [], page.errors.join('\n')); });
  await page.close();
}

// ---- 3. desktop: units drawer + placeholder flight for an invented unit + English ----
{
  const page = await newPage({ width: 1280, height: 760 });
  await page.goto(base + '/flow.html?project=rainbow&real=0&autostart=1&seg=hold-facade&lang=en');
  await step('desktop English: drawer lists 12 units by floor, picking one opens its card', async () => {
    await page.waitForFunction(() => window.__habait?.state.seg?.id === 'hold-facade');
    await page.click('#langToggle'); // he -> en (localStorage may hold he from the earlier page)
    if ((await page.getAttribute('html', 'dir')) !== 'ltr') await page.click('#langToggle');
    await page.click('#unitsBtn');
    await page.waitForSelector('#unitsDrawer:not([hidden])');
    assert.equal(await page.evaluate(() => document.querySelectorAll('.unit-row').length), 12);
    await page.evaluate(() => [...document.querySelectorAll('.unit-row')].find((r) => r.textContent.includes('857')).click());
    await page.waitForSelector('#unitSheet:not([hidden])');
    assert.match(await page.textContent('#unitBody'), /Apartment 857/);
    assert.match(await page.textContent('#unitBody'), /placeholder/i);
    await page.screenshot({ path: join(shots, 'card-desktop-en.png') });
  });
  await step('invented unit falls back to the placeholder descend and still reaches hand-off', async () => {
    await page.click('#unitContinue');
    await page.waitForFunction(() => window.__habait?.state.seg?.id === 'descend-846');
    const ev = await page.evaluate(() => window.__habaitEvents.filter((e) => e.event === 'unit_enter').pop().properties);
    assert.equal(ev.unit, '857'); assert.equal(ev.placeholder, true);
    await page.waitForSelector('#handoffOverlay:not([hidden])', { timeout: 15000 });
    assert.match(await page.textContent('#handoffTitle'), /857/);
  });
  await step('no page errors (desktop)', async () => { assert.deepEqual(page.errors, [], page.errors.join('\n')); });
  await page.close();
}

// ---- 4. js/picker.js standalone, cross-origin (habait-89's use): blank page + units.json + a fake projectFn ----
{
  const host = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${base}/css/style.css">
<style>#stage { position: fixed; inset: 0; background: #1b2433; }</style></head>
<body><div id="stage"></div>
<script type="module">
  import { createPicker } from '${base}/js/picker.js';
  import * as i18n from '${base}/js/i18n.js';
  import * as analytics from '${base}/js/analytics.js';
  const get = (f) => fetch('${base}/fixtures/rainbow/' + f).then((r) => r.json());
  const [units, project] = await Promise.all([get('units.json'), get('project.json')]);
  analytics.initAnalytics({ base: { project: project.id, lang: i18n.getLang() } });
  window.entered = [];
  window.hide = new Set(['876']);          // "behind the camera"
  const order = units.units.map((u) => u.id);
  const picker = createPicker({ units, container: document.getElementById('stage'), i18n, analytics, project,
    onEnter(unit) { window.entered.push(unit.id); } });
  // fake projector: two columns of pills, CSS px relative to the container
  const projectFn = (u) => { const i = order.indexOf(u.id); return { x: 100 + (i % 2) * 190, y: 130 + Math.floor(i / 2) * 80, visible: !window.hide.has(u.id) }; };
  (function frame() { picker.update(projectFn); requestAnimationFrame(frame); })();
  window.picker = picker;
  window.ready = true;
</script></body></html>`;
  const hostServer = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(host); });
  await new Promise((ok) => hostServer.listen(0, '127.0.0.1', ok));
  const hostUrl = `http://127.0.0.1:${hostServer.address().port}/`;
  const page = await newPage({ width: 390, height: 844 });
  const events = () => page.evaluate(() => window.__habaitEvents.map((e) => ({ event: e.event, ...e.properties })));
  await page.goto(hostUrl);
  await step('picker (cross-origin, phone): 12 pills from units.json, :8850 CSS applied, visible=false hides one', async () => {
    await page.waitForFunction(() => window.ready === true, null, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll('.hotspot').length === 12);
    const st = await page.evaluate(() => {
      const pills = [...document.querySelectorAll('.hotspot')];
      const p = document.querySelector('.hotspot[data-unit="846"]');
      const cs = getComputedStyle(p);
      return { shown: pills.filter((x) => x.style.display !== 'none').length, hidden876: document.querySelector('.hotspot[data-unit="876"]').style.display,
        pos: cs.position, radius: cs.borderRadius, sub: p.querySelector('.sub').textContent, cls: p.className, dot: getComputedStyle(p.querySelector('.dot')).backgroundColor,
        soldDot: getComputedStyle(document.querySelector('.hotspot.status-sold .dot')).backgroundColor };
    });
    assert.equal(st.shown, 11); assert.equal(st.hidden876, 'none');
    assert.equal(st.pos, 'absolute', 'style.css from :8850 not applied'); assert.equal(st.radius, '999px');
    assert.equal(st.sub, 'קומה 16 · 4 חדרים');
    assert.match(st.cls, /\bhotspot\b/); assert.match(st.cls, /\bstatus-for-sale\b/);
    // platform-ui-ux card 13: the status colours come from tokens.css (--chrome-ok #6fb385, --chrome-sold #d77a71), which style.css
    // @imports; a cross-origin host that failed to get them would compute a transparent dot, so this still proves the CSS applied.
    assert.equal(st.dot, 'rgb(111, 179, 133)'); assert.equal(st.soldDot, 'rgb(215, 122, 113)');
  });
  await step('picker chrome: title, status legend, hint, units button, legal line (Hebrew RTL)', async () => {
    await page.waitForSelector('.picker-chrome:not([hidden])');
    assert.equal(await page.textContent('.picker-title'), 'מול החזית · בחרו דירה');
    const legend = await page.textContent('.picker-legend');
    assert.match(legend, /למכירה/); assert.match(legend, /שמורה/); assert.match(legend, /נמכרה/);
    assert.equal(await page.textContent('.picker-hint'), 'לחצו על דירה');
    assert.match(await page.textContent('.picker-units-btn'), /דירות/);
    assert.match(await page.textContent('.picker-disclaimer'), /להמחשה בלבד/);
    await page.waitForTimeout(450); // let the pill / sheet entry animations finish
    await page.screenshot({ path: join(shots, 'picker-phone.png') });
  });
  await step("picker: hover sends unit_hover once; select('846') highlights the pill and opens the card", async () => {
    await page.hover('.hotspot[data-unit="846"]'); await page.mouse.move(5, 5); await page.hover('.hotspot[data-unit="846"]');
    await page.evaluate(() => window.picker.select('846'));
    await page.waitForSelector('#unitSheet:not([hidden])');
    assert.ok(await page.evaluate(() => document.querySelector('.hotspot[data-unit="846"]').classList.contains('selected')));
    const txt = await page.textContent('#unitBody');
    for (const re of [/דירה 846/, /טיפוס L/, /למכירה/, /7,950,000/, /118/, /22/, /המשיכו אל הדירה/, /עמוד הדירה/, /להמחשה בלבד/]) assert.match(txt, re);
    assert.equal(await page.locator('#unitTour').count(), 0, 'Eliran 2026-11-04: one entry — «המשיכו אל הדירה» only, no «לסיור 360°» beside it');
    assert.equal(await page.locator('#unitBody a.btn-whatsapp').count(), 0, 'F20: no WhatsApp button while project.leads.whatsapp_number is empty');
    const apt = await page.getAttribute('#unitPage', 'href');
    assert.match(apt, new RegExp(`^${base.replace(/[.]/g, '\\.')}/apartment\\.html\\?project=rainbow&unit=846&sid=[0-9a-f-]{8,}&from=flight$`), apt);
    const ev = await events();
    assert.equal(ev.filter((e) => e.event === 'unit_hover' && e.unit === '846').length, 1);
    const click = ev.filter((e) => e.event === 'unit_click').pop();
    assert.equal(click.unit, '846'); assert.equal(click.status, 'for-sale'); assert.equal(click.floor, 16); assert.equal(click.price, 7950000); assert.equal(click.project, 'rainbow');
    await page.waitForTimeout(450); // let the pill / sheet entry animations finish
    await page.screenshot({ path: join(shots, 'picker-card-phone.png') });
  });
  await step('picker: apartment page link fires unit_click {channel: apartment_page}; no lead form, no WhatsApp (Eliran 2026-11-04)', async () => {
    await page.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); }, true));
    await page.click('#unitPage');
    assert.equal(await page.locator('#unitBody a.btn-whatsapp, #unitBody .lead-form').count(), 0);
    const ev = await events();
    assert.ok(ev.some((e) => e.event === 'unit_click' && e.channel === 'apartment_page' && e.unit === '846'));
  });
  await step('picker: "continue" fires onEnter(846) + unit_enter and closes the card', async () => {
    await page.click('#unitContinue');
    assert.deepEqual(await page.evaluate(() => window.entered), ['846']);
    assert.equal(await page.evaluate(() => document.getElementById('unitSheet').hidden), true);
    const enter = (await events()).filter((e) => e.event === 'unit_enter').pop();
    assert.equal(enter.unit, '846'); assert.equal(enter.status, 'for-sale');
  });
  await step('picker: drawer grouped by floor, a row selects (card opens) without calling onEnter', async () => {
    await page.click('.picker-units-btn');
    await page.waitForSelector('#unitsDrawer:not([hidden])');
    assert.equal(await page.evaluate(() => document.querySelectorAll('.unit-row').length), 12);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.floor-label')].map((f) => f.textContent)), ['קומה 19', 'קומה 18', 'קומה 17', 'קומה 16', 'קומה 15', 'קומה 14']);
    await page.click('.unit-row[data-unit="857"]');
    await page.waitForSelector('#unitSheet:not([hidden])');
    assert.equal(await page.evaluate(() => document.getElementById('unitsDrawer').hidden), true);
    assert.match(await page.textContent('#unitBody'), /דירה 857/);
    assert.deepEqual(await page.evaluate(() => window.entered), ['846']);
    assert.equal((await events()).filter((e) => e.event === 'unit_click').pop().from, 'list');
  });
  await step('picker (card 24): a drawer pick on another floor sends floor_switch {floor, prev}', async () => {
    const fs = (await events()).filter((e) => e.event === 'floor_switch').pop();
    assert.ok(fs, 'no floor_switch');
    assert.equal(fs.floor, 17); assert.equal(fs.prev, 16); assert.equal(fs.unit, '857'); assert.equal(fs.via, 'drawer');
  });
  await step('picker (card 24): favorite toggle (on/off, kept on the device); WhatsApp has no viewed: line by default', async () => {
    assert.equal(await page.getAttribute('#unitFav', 'aria-pressed'), 'false');
    assert.equal(await page.getAttribute('#unitFav', 'aria-label'), 'שמירה למועדפים');
    await page.click('#unitFav');
    assert.equal(await page.getAttribute('#unitFav', 'aria-pressed'), 'true');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('habait.favorites') || '[]')), ['857']);
    await page.click('#unitFav');
    assert.equal(await page.getAttribute('#unitFav', 'aria-pressed'), 'false');
    const favs = (await events()).filter((e) => e.event === 'favorite');
    assert.deepEqual(favs.map((e) => [e.unit, e.on]), [['857', true], ['857', false]]);
    assert.equal(await page.locator('#unitBody a.btn-whatsapp').count(), 0, 'Eliran 2026-11-04: no WhatsApp button');
  });
  await step("picker: setLang('en') relabels pills, card, drawer and chrome and flips dir", async () => {
    await page.evaluate(() => window.picker.toggleDrawer(true));
    await page.evaluate(() => window.picker.setLang('en'));
    assert.equal(await page.getAttribute('html', 'dir'), 'ltr');
    assert.equal(await page.getAttribute('#unitSheet', 'dir'), 'ltr');
    assert.equal(await page.textContent('.hotspot[data-unit="846"] .sub'), 'Floor 16 · 4 Rooms');
    assert.match(await page.textContent('#unitBody'), /Apartment 857/);
    assert.match(await page.textContent('#unitBody'), /Apartment page/);
    assert.equal(await page.textContent('#unitsDrawer h2'), 'Apartments');
    assert.equal(await page.textContent('.picker-title'), 'At the facade · choose an apartment');
    assert.match(await page.textContent('.picker-legend'), /For sale/);
    assert.equal(await page.textContent('.picker-hint'), 'Tap an apartment');
    await page.waitForTimeout(450); // let the pill / sheet entry animations finish
    await page.screenshot({ path: join(shots, 'picker-en-phone.png') });
  });
  await step('picker: close() closes card + drawer; destroy() removes its DOM', async () => {
    await page.evaluate(() => window.picker.close());
    assert.deepEqual(await page.evaluate(() => [document.getElementById('unitSheet').hidden, document.getElementById('unitsDrawer').hidden]), [true, true]);
    await page.evaluate(() => window.picker.destroy());
    assert.deepEqual(await page.evaluate(() => [document.querySelectorAll('.hotspot').length, !!document.getElementById('unitSheet'), !!document.querySelector('.picker-chrome')]), [0, false, false]);
  });
  await step('picker (habait-98 fix): three desktop pills 120 px apart stay compact across frames (no compact/full flicker)', async () => {
    await page.setViewportSize({ width: 1280, height: 800 }); // full pill ~151 px (on a phone the pill is already 52 px)
    const samples = await page.evaluate(async (b) => {
      const { createPicker } = await import(b + '/js/picker.js');
      const doc = await (await fetch(b + '/fixtures/rainbow/units.json')).json();
      const three = doc.units.filter((u) => u.floor === 16).slice(0, 3);
      const c = document.createElement('div');
      c.style.cssText = 'position:fixed;inset:0';
      document.body.appendChild(c);
      const p2 = createPicker({ units: { ...doc, units: three }, container: c, chrome: false, favorites: false });
      const fn = (u) => ({ x: 80 + three.indexOf(u) * 120, y: 300, visible: true }); // overlap at full width (151), not at compact (52)
      const out = [];
      for (let i = 0; i < 12; i++) {
        p2.update(fn);
        await new Promise((r) => requestAnimationFrame(r));
        out.push([...c.querySelectorAll('.hotspot')].map((h) => (h.classList.contains('compact') ? 'c' : 'f')).join(''));
      }
      p2.destroy(); c.remove();
      return out;
    }, base);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(samples[0].length, 3, samples.join(' '));
    assert.ok(samples.slice(1).every((x) => x === samples[1]), `compact state changes between frames: ${samples.join(' ')}`);
    assert.ok(samples[1].includes('c'), `overlapping pills should be compact: ${samples.join(' ')}`);
    return samples.join(' ');
  });
  await step('no page errors (picker standalone)', async () => { assert.deepEqual(page.errors, [], page.errors.join('\n')); });
  await page.close();
  hostServer.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s); screenshots in ${shots}` : `\nall green; screenshots in ${shots}`);
process.exit(failures ? 1 : 0);

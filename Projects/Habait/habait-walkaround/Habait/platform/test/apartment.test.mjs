// Card 23 (D1b) test: the apartment page on iPhone / Pixel / desktop, the WhatsApp tag, no foreign requests,
// the ZIP contents and the legal caption, and the ZIP's dollhouse.html opened offline from file://.
//   node tools/build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846   (first)
//   HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps node test/apartment.test.mjs [shotsDir]
// playwright-core: $PLAYWRIGHT_CORE, $HABAIT_APP_DIR/node_modules/playwright-core, or node_modules. Chrome: $CHROME_PATH or the
// default Windows install (the same as test/browser.mjs). The tour server (:8848, habait-16) is stubbed, so this runs alone.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { start } from '../serve.mjs';
import { readZip } from '../js/zip.js';
import { TABS } from '../js/apartment.js';

const PLATFORM = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'rainbow';
const UNIT = '846';
const OUT = join(PLATFORM, '_local/dist', PROJECT, UNIT);
const shots = process.argv[2] || join(tmpdir(), 'habait-apartment-shots');
mkdirSync(shots, { recursive: true });

let failures = 0;
const step = async (name, fn) => {
  try { const r = await fn(); console.log('ok   ' + name + (r ? `  (${r})` : '')); return true; }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n').slice(0, 3).join('\n     ')); return false; }
};

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const app = process.env.HABAIT_APP_DIR;
  const candidates = [process.env.PLAYWRIGHT_CORE, app && join(app, 'node_modules/playwright-core'), 'playwright-core', 'playwright'].filter(Boolean);
  for (const c of candidates) { try { return require(c); } catch { /* next */ } }
  throw new Error('playwright-core not found; set HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps');
}

// ---------- 1. the ZIP ----------
const manifest = JSON.parse(await readFile(join(OUT, 'apartment.json'), 'utf8'));
const legal = manifest.legal;
const zipPath = join(OUT, manifest.zip.src);
const zipBytes = await readFile(zipPath);
const zip = await readZip(zipBytes);
const mb = zipBytes.length / 1048576;

await step('zip: <= 25 MB with panos, stills, plan, GLB, offline HTML, README', async () => {
  assert.ok(mb <= 25, `${mb.toFixed(2)} MB`);
  const n = (re) => zip.names.filter((x) => re.test(x)).length;
  assert.ok(n(/^panos\/.+\.webp$/) >= 11, 'panos');
  assert.ok(n(/^stills\/.+\.jpg$/) >= 11, 'stills');
  assert.equal(n(/^plan\/plan-846\.png$/), 1, 'plan');
  assert.equal(n(/^3d\/.+\.glb$/), 1, 'glb');
  assert.equal(n(/^3d\/dollhouse\.html$/), 1, 'dollhouse.html');
  assert.ok(zip.names.includes('README-he-en.txt') && zip.names.includes('unit.json'));
  const glb = await zip.bytes(zip.names.find((x) => x.endsWith('.glb')));
  assert.equal(Buffer.from(glb.subarray(0, 4)).toString('latin1'), 'glTF');
  return `zip: ${zip.names.length} files, ${mb.toFixed(2)} MB (<=25)`;
});
console.log(`zip: ${zip.names.length} files, ${mb.toFixed(2)} MB (<=25)`);

await step('zip: README carries the full legal text (he + en), variables filled, plan date', async () => {
  const readme = await zip.text('README-he-en.txt');
  assert.ok(readme.includes(legal.full.he.split('\n')[1].slice(0, 60)), 'he full');
  assert.ok(readme.includes(legal.full.en.split('\n')[1].slice(0, 60)), 'en full');
  assert.ok(readme.includes('הדמיה להמחשה בלבד') && readme.includes('Illustration only'));
  assert.ok(readme.includes('15.10.2025'), 'plan date');
  assert.doesNotMatch(readme, /\{(DEVELOPER|PROJECT|UNIT|PLAN_DATE|GEN_DATE|VERSION)\}/, 'unfilled variable');
  assert.match(legal.short.he, /846/);
  const html = await zip.text('3d/dollhouse.html');
  assert.ok(html.includes(legal.short.he) && html.includes(legal.short.en), 'caption in dollhouse.html');
  assert.doesNotMatch(html, /\s(src|href)=["']https?:/i, 'no remote src/href in dollhouse.html');
});

// ---------- 2. the page in three viewports ----------
const { chromium, devices } = loadPlaywright();
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({
  executablePath: chromePath, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'],
});
const server = await start(0, '127.0.0.1');
const base = `http://127.0.0.1:${server.address().port}`;
const LOCAL = new Set(['127.0.0.1', 'localhost']);
const strip = ({ defaultBrowserType, ...d }) => d;
const VIEWPORTS = [
  ['iphone', strip(devices['iPhone 13'])],
  ['pixel', strip(devices['Pixel 7'])],
  ['desktop', { viewport: { width: 1280, height: 800 } }],
];

async function newContext(opts) {
  const ctx = await browser.newContext({ ...opts, locale: 'he-IL' });
  ctx.requests = [];
  ctx.on('request', (r) => ctx.requests.push(r.url()));
  // the tour is habait-16's server; a stub keeps this test self-contained (the URL itself is asserted)
  await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>tour stub</title><body style="background:#123">tour stub</body>' }));
  await ctx.route('https://wa.me/**', (r) => r.abort());
  return ctx;
}
async function newPage(ctx) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  return page;
}
const foreign = (urls) => urls.filter((u) => { if (/^(data|blob|about):/.test(u)) return false; try { return !LOCAL.has(new URL(u).hostname); } catch { return true; } });

async function checkTab(page, tab) {
  await page.click(`#tab-${tab}`);
  await page.waitForSelector(`#panel-${tab}:not([hidden])`);
  const short = await page.textContent(`#panel-${tab} .legal-short`);
  assert.equal(short.trim(), legal.short.he, `${tab}: legal caption`);
  assert.ok(await page.isVisible(`#panel-${tab} .legal-short`), `${tab}: caption visible`);
  if (tab === 'tour') {
    const src = await page.getAttribute('#tourFrame', 'src');
    const u = new URL(src);
    assert.equal(u.origin, 'http://127.0.0.1:8848');
    assert.equal(u.searchParams.get('scope'), 'apartment', 'apartment scope only (own strip)');
    assert.ok(u.searchParams.get('sid') && u.searchParams.get('return'), 'sid + return');
  }
  if (tab === 'plan') await page.waitForFunction(() => document.getElementById('planImg').naturalWidth > 0, null, { timeout: 15000 });
  if (tab === 'photos') {
    assert.equal(await page.locator('#photoGrid figure').count(), manifest.stills.length);
    await page.waitForFunction(() => { const i = document.querySelector('#photoGrid img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
    await page.click('#photoGrid figure:first-child button');
    await page.waitForFunction(() => document.getElementById('lightbox').open && document.getElementById('lbImg').naturalWidth > 0, null, { timeout: 15000 });
    await page.click('#lbClose');
  }
  if (tab === '3d') {
    const frame = await (await page.waitForSelector('#dollFrame')).contentFrame();
    await frame.waitForFunction(() => window.__dollhouse && (window.__dollhouse.loaded || window.__dollhouse.error), null, { timeout: 90000 });
    const st = await frame.evaluate(() => ({ ...window.__dollhouse }));
    assert.ok(st.loaded, `dollhouse: ${st.error}`);
    assert.ok(st.triangles > 100, `triangles ${st.triangles}`);
  }
  if (tab === 'about') {
    const txt = await page.textContent('#aboutLegal');
    assert.ok(txt.includes('המסמכים המחייבים'), 'full legal text in about');
    assert.match(await page.textContent('#aboutFacts'), /118/);
  }
}

const tabsOk = {};
let sidSeen = null;
for (const [name, opts] of VIEWPORTS) {
  const ctx = await newContext(opts);
  const page = await newPage(ctx);
  await page.goto(`${base}/apartment.html?project=${PROJECT}&unit=${UNIT}`);
  await page.waitForFunction(() => window.__apt?.ready === true, null, { timeout: 20000 });
  tabsOk[name] = 0;
  await step(`${name}: Hebrew RTL, title, price, status, white-label colour`, async () => {
    assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
    assert.match(await page.textContent('#aptTitle'), /846/);
    assert.match(await page.textContent('#aptStatus'), /למכירה/);
    assert.equal((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary'))).trim(), manifest.project.brand.primary);
  });
  for (const tab of TABS) {
    const ok = await step(`${name}: tab ${tab}`, () => checkTab(page, tab));
    if (ok) tabsOk[name]++;
    if (ok && (tab === 'photos' || tab === '3d' || tab === 'tour')) await page.screenshot({ path: join(shots, `${name}-${tab}.png`) });
  }
  await step(`${name}: no contact number in the fixture -> WhatsApp and call buttons hidden (F20, Eliran 2026-11-04 "להסתיר")`, async () => {
    for (const id of ['waBtn', 'waBtn2', 'callBtn', 'callBtn2']) {
      assert.equal(await page.evaluate((i) => document.getElementById(i).hidden, id), true, `#${id} hidden`);
      assert.equal(await page.isVisible(`#${id}`), false, `#${id} not visible`);
    }
  });
  await step(`${name}: "חזרה לבניין" goes to the project level (hold node), not inside the apartment strip`, async () => {
    const back = new URL(await page.getAttribute('#backBtn', 'href'));
    assert.equal(back.searchParams.get('project'), PROJECT);
    assert.equal(back.searchParams.get('room'), manifest.tour.hold);
    assert.match(await page.textContent('#backBtn'), /חזרה לבניין/);
  });
  await step(`${name}: no requests outside 127.0.0.1 before any tap on WhatsApp`, async () => {
    const f = foreign(ctx.requests);
    assert.deepEqual(f, []);
    return `${ctx.requests.length} requests, all local`;
  });
  if (name === 'desktop') {
    // the language step runs before the popup step: a click on the opener right after a popup closes can stall on a busy machine
    await step('desktop: English LTR toggle re-renders tabs and caption', async () => {
      await page.click('#langToggle');
      assert.equal(await page.getAttribute('html', 'dir'), 'ltr');
      assert.match(await page.textContent('#tab-plan'), /Plan/);
      assert.equal((await page.textContent('#panel-about .legal-short')).trim(), legal.short.en);
      await page.click('#langToggle');
      assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
    });
    await step('desktop: tapping WhatsApp is the only way out (wa.me, new tab) — only when a number is set (F20)', async () => {
      if (await page.evaluate(() => document.getElementById('waBtn').hidden)) { assert.deepEqual(foreign(ctx.requests), []); return; }
      const [popup] = await Promise.all([ctx.waitForEvent('page'), page.click('#waBtn')]);
      await popup.waitForEvent('requestfailed', { timeout: 10000 }).catch(() => {});
      const f = foreign(ctx.requests);
      assert.ok(f.length >= 1 && f.every((u) => new URL(u).hostname === 'wa.me'), f.join(', '));
      await popup.close();
      await page.bringToFront();
    });
  }
  await step(`${name}: no page errors`, async () => { assert.deepEqual(page.errors, [], page.errors.join('\n')); });
  await ctx.close();
}
const allTabs = Object.values(tabsOk).every((n) => n === TABS.length);
console.log(`tabs ${Math.min(...Object.values(tabsOk))}/${TABS.length} ok on ${VIEWPORTS.length} viewports${allTabs ? '' : ` (FAIL: ${JSON.stringify(tabsOk)})`}`);
if (sidSeen) console.log(`wa.me link contains rainbow|846|${sidSeen}`);

// ---------- 3. session continuity from the flight (sid) + the standalone dist page ----------
{
  const ctx = await newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await newPage(ctx);
  await page.goto(`${base}/_local/dist/${PROJECT}/${UNIT}/index.html?sid=flight-sid-12345678#photos`);
  await page.waitForFunction(() => window.__apt?.ready === true, null, { timeout: 20000 });
  await step('dist page (self-contained build): opens on #photos, carries the flight sid into WhatsApp and the tour', async () => {
    assert.equal(await page.evaluate(() => window.__apt.mode), 'dist');
    assert.equal(await page.isVisible('#panel-photos'), true);
    if (!(await page.evaluate(() => document.getElementById('waBtn').hidden))) {   // F20: no number = no WhatsApp button
      const wa = decodeURIComponent(await page.getAttribute('#waBtn', 'href'));
      assert.match(wa, /rainbow\|846\|flight-sid-12345678$/);
    }
    await page.click('#tab-tour');
    assert.equal(new URL(await page.getAttribute('#tourFrame', 'src')).searchParams.get('sid'), 'flight-sid-12345678');
    await page.click('#tab-3d');
    const frame = await (await page.waitForSelector('#dollFrame')).contentFrame();
    await frame.waitForFunction(() => window.__dollhouse && (window.__dollhouse.loaded || window.__dollhouse.error), null, { timeout: 90000 });
    assert.ok(await frame.evaluate(() => window.__dollhouse.loaded));
    assert.deepEqual(foreign(ctx.requests), []);
    assert.deepEqual(page.errors, [], page.errors.join('\n'));
  });
  await ctx.close();
}

// ---------- 4. the ZIP's dollhouse.html offline (file://, every network request blocked) ----------
{
  const dir = join(tmpdir(), `habait-zip-${UNIT}-${process.pid}`);
  await rm(dir, { recursive: true, force: true });
  for (const n of zip.names) {
    await mkdir(dirname(join(dir, n)), { recursive: true });
    await writeFile(join(dir, n), await zip.bytes(n));
  }
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const net = [];
  await ctx.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); net.push(u); return r.abort(); });
  const page = await newPage(ctx);
  await page.goto(pathToFileURL(join(dir, '3d/dollhouse.html')).href);
  await step('zip: 3d/dollhouse.html opens offline from file:// and shows the GLB', async () => {
    await page.waitForFunction(() => window.__dollhouse && (window.__dollhouse.loaded || window.__dollhouse.error), null, { timeout: 90000 });
    const st = await page.evaluate(() => ({ ...window.__dollhouse }));
    assert.ok(st.loaded, st.error);
    await page.waitForFunction(() => window.__dollhouse.frames > 5);
    // the canvas is not blank: count distinct colours of the rendered frame
    const colours = await page.evaluate(() => {
      const src = document.querySelector('#v canvas');
      const c = document.createElement('canvas'); c.width = 200; c.height = 140;
      const g = c.getContext('2d'); g.drawImage(src, 0, 0, 200, 140);
      const d = g.getImageData(0, 0, 200, 140).data; const s = new Set();
      for (let i = 0; i < d.length; i += 4) s.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
      return s.size;
    });
    assert.ok(colours > 20, `only ${colours} colours: blank render`);
    assert.deepEqual(net, [], 'network requests from the offline file');
    assert.deepEqual(page.errors, [], page.errors.join('\n'));
    await page.screenshot({ path: join(shots, 'zip-dollhouse-offline.png') });
    return `${st.triangles} triangles, ${st.meshes} meshes, ${colours} colours, 0 network requests`;
  });
  await ctx.close();
  await rm(dir, { recursive: true, force: true });
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} failure(s); screenshots in ${shots}` : `\nall green; screenshots in ${shots}`);
process.exit(failures ? 1 : 0);

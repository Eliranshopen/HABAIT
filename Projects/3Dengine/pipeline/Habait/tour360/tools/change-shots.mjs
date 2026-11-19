#!/usr/bin/env node
/* Habait Tour360 — change-shots.mjs (T08, board habait-tour360) — the prepared changes, driven in a real browser.
   Phone 390×844 (touch taps) and desktop 1440×900: open the change panel, apply an example, add a second, compare with the
   original, add the third, leave the room and come back through a door marker (the changes must still be on), reset, and open a
   shared ?change= link. Screenshots land as PNG in --out (default qa-evidence/tour360/T08); convert them with
   qa-evidence/_tools/webp-lossless.mjs. playwright-core from the app's node_modules, the system Chrome, a static server inside
   this process, one Chrome instance, everything closed in `finally`.
   Usage (from the harness root, Git Bash):  timeout 540 node Habait/tour360/tools/change-shots.mjs demo-01 [--lang he] [--url https://…] */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs'; // a worktree has no Habait/MVP/app (board habait-walkaround T18)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..', '..');
const id = process.argv[2];
if (!id) { console.error('usage: node Habait/tour360/tools/change-shots.mjs <apartment-id> [--lang he|en|fr] [--url <live url>] [--out <dir>]'); process.exit(2); }
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const lang = arg('--lang', 'he');
const liveUrl = arg('--url', '');
const DIST = path.join(ROOT, 'dist', id);
const EVIDENCE = path.resolve(arg('--out', path.join(REPO, 'qa-evidence', 'tour360', 'T08')));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!liveUrl && !fs.existsSync(path.join(DIST, 'index.html'))) { console.error('change-shots: build first (build-tour.mjs ' + id + ')'); process.exit(1); }
fs.mkdirSync(EVIDENCE, { recursive: true });

/* ── --catalog (T16c, $0): the rings at rest, the hint, the chip with the filtered strip — phone and desktop, no turn sent. The page
   unlocks against a stubbed GET api/edit ({ configured: true }) so the rings show; nothing is posted. Needs a --catalog build. ── */
if (process.argv.includes('--catalog')) {
  const markersDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'apartments', id, 'markers.json'), 'utf8'));
  const apartmentDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'apartments', id, 'apartment.json'), 'utf8'));
  const room = apartmentDoc.defaultScene;
  const roomScan = markersDoc.scenes[room];
  if (!roomScan || !roomScan.markers.length) { console.error(`change-shots --catalog: ${room} has no markers — run scan-pieces first`); process.exit(1); }
  const marker = roomScan.markers.find((m) => m.category === 'sofa') || roomScan.markers[0];
  const catalogDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'items.json'), 'utf8'));
  const expectItems = catalogDoc.items.filter((it) => it.category === marker.category).length;
  const { chromium } = appRequire(REPO)('playwright-core');
  const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
  let server = null;
  let base = liveUrl ? liveUrl.replace(/\/?$/, '/') : '';
  if (!liveUrl) {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      let p = decodeURIComponent(url.pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.normalize(path.join(DIST, p));
      if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/`;
  }
  const cells = [
    { name: `phone-${lang}`, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    { name: `desktop-${lang}`, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  ];
  const results = [];
  let browser;
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] });
    for (const cell of cells) {
      const ctx = await browser.newContext({ viewport: cell.viewport, deviceScaleFactor: cell.deviceScaleFactor, isMobile: cell.isMobile, hasTouch: cell.hasTouch });
      const page = await ctx.newPage();
      const errors = [], steps = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.route('**/api/edit', async (route) => {
        if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, catalog: { items: expectItems } }) });
        errors.push('a turn was POSTED during --catalog shots');
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'not_configured' }) });
      });
      const press = (sel) => (cell.hasTouch ? page.tap(sel) : page.click(sel));
      const shot = async (label) => { const file = path.join(EVIDENCE, `catalog-${cell.name}-${label}.png`); const png = await page.screenshot({ path: file }); return Math.round(png.length / 1024); };
      const t0 = Date.now();
      let failure = null;
      try {
        await page.goto(base + `?lang=${lang}&room=${room}&key=shots`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction(() => window.__tour && window.__tour.ready === true && window.__tour.liveReady === true, null, { timeout: 90000 });
        await page.evaluate(([p, y]) => window.__tour.viewer.lookAt(p, y, window.__tour.viewer.getHfov(), false), [marker.pitch, marker.yaw]);
        await page.waitForFunction(() => !document.getElementById('pano').classList.contains('is-moving'), null, { timeout: 10000 });
        await page.waitForTimeout(600);
        const rings = await page.evaluate(() => {
          const divs = [...document.querySelectorAll('.t-mk')];
          const vis = (n) => { const b = n.getBoundingClientRect(); const cs = getComputedStyle(n); return cs.opacity !== '0' && b.width > 0 && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth; };
          return { total: window.__tour.markers, inRoom: divs.length, visible: divs.filter(vis).length, hint: !document.getElementById('t-mk-hint').hidden, hintText: document.getElementById('t-mk-hint').textContent, scrollW: document.documentElement.scrollWidth, innerW: innerWidth };
        });
        const kb1 = await shot('1-rings');
        steps.push({ label: '1-rings', ok: rings.visible >= 1 && rings.hint && rings.scrollW <= rings.innerW, kb: kb1, ...rings });
        await press(`.t-mk[data-marker="${marker.id}"]`);
        await page.waitForSelector('#t-pick:not([hidden]) .t-catalog-item', { timeout: 10000 });
        await page.waitForTimeout(400);
        const pick = await page.evaluate(() => ({
          chip: document.getElementById('t-pick-chip').textContent, items: document.querySelectorAll('#t-catalog-bar .t-catalog-item').length,
          open: document.querySelectorAll('.t-mk.is-open').length, chipOnRing: [...document.querySelectorAll('.t-mk.is-open .t-mk-chip')].map((c) => c.textContent).join('|'),
          hint: !document.getElementById('t-mk-hint').hidden, marker: window.__tour.marker, scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
          itemPx: Math.min(...[...document.querySelectorAll('#t-catalog-bar .t-catalog-item')].map((b) => parseFloat(getComputedStyle(b).fontSize))),
        }));
        const kb2 = await shot('2-pick');
        steps.push({ label: '2-pick', ok: pick.items === expectItems && pick.open === 1 && pick.chip.length > 0 && pick.chipOnRing.length > 0 && !pick.hint && pick.scrollW <= pick.innerW, kb: kb2, ...pick });
        await press('#t-pick-close');
        await page.waitForFunction(() => document.getElementById('t-pick').hidden === true, null, { timeout: 5000 });
        const closed = await page.evaluate(() => ({ open: document.querySelectorAll('.t-mk.is-open').length, marker: window.__tour.marker }));
        steps.push({ label: '3-closed', ok: closed.open === 0 && closed.marker === null, ...closed });
      } catch (e) {
        failure = String(e && e.message ? e.message : e).split('\n')[0];
        try { await shot('FAILED'); } catch { /* best effort */ }
      }
      results.push({ cell: cell.name, ok: !failure && steps.every((s) => s.ok) && errors.length === 0, ms: Date.now() - t0, failure, errors, steps });
      await ctx.close();
    }
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
  fs.writeFileSync(path.join(EVIDENCE, `catalog-shots-${lang}.json`), JSON.stringify({ apartment: id, room, marker: marker.id, lang, when: new Date().toISOString(), results }, null, 2) + '\n');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.cell}: ${r.steps.length} steps in ${r.ms} ms${r.failure ? ' · ' + r.failure : ''}${r.errors.length ? ' · errors=' + r.errors.slice(0, 2).join(' | ') : ''}`);
    for (const s of r.steps) console.log(`   ${s.ok ? 'ok ' : 'BAD'} ${s.label}${s.visible !== undefined ? ` rings ${s.visible}/${s.inRoom} of ${s.total}, hint ${s.hint}` : ''}${s.items !== undefined ? ` items ${s.items}, chip "${s.chip}", ring chip "${s.chipOnRing}", min ${s.itemPx}px` : ''}${s.kb ? ' png=' + s.kb + 'KB' : ''}`);
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

const editsDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'apartments', id, 'edits.json'), 'utf8'));
const scenesDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'apartments', id, 'scenes.json'), 'utf8'));
const apartment = JSON.parse(fs.readFileSync(path.join(ROOT, 'apartments', id, 'apartment.json'), 'utf8'));
const room = apartment.defaultScene;
const list = (editsDoc.scenes[room] || []).slice().sort((a, b) => a.order - b.order);
if (list.length < 2) { console.error(`change-shots: ${room} needs at least two prepared changes`); process.exit(1); }
const keyOf = (ids) => (ids.length ? room + '~' + ids.slice().sort((a, b) => list.find((e) => e.id === a).order - list.find((e) => e.id === b).order).join('+') : room);
const roomScene = scenesDoc.scenes.find((s) => s.id === room);
const neighbour = scenesDoc.scenes.find((s) => s.id !== room && (s.hotspots || []).some((h) => h.to === room));

const { chromium } = appRequire(REPO)('playwright-core');

const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
let server = null;
let base = liveUrl ? liveUrl.replace(/\/?$/, '/') : '';
if (!liveUrl) {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(DIST, p));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/`;
}

const cells = [
  { name: `phone-${lang}`, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: `desktop-${lang}`, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];
const results = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] });
  for (const cell of cells) {
    const ctx = await browser.newContext({ viewport: cell.viewport, deviceScaleFactor: cell.deviceScaleFactor, isMobile: cell.isMobile, hasTouch: cell.hasTouch });
    const page = await ctx.newPage();
    const errors = [];
    const steps = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', (r) => { if (!/^blob:/.test(r.url())) errors.push('request failed: ' + r.url()); });
    const press = (sel) => (cell.hasTouch ? page.tap(sel) : page.click(sel));
    const settled = async (key, extra) => {
      await page.waitForFunction(([k, orig]) => {
        const t = window.__tour;
        return t && t.ready && !t.applying && t.sceneKey === k && t.viewer.isLoaded() && (orig === null || t.original === orig);
      }, [key, extra === undefined ? null : extra], { timeout: 45000 });
      await page.waitForTimeout(1100); // the scene fade settles
    };
    const shot = async (label) => {
      const file = path.join(EVIDENCE, `${cell.name}-${label}.png`);
      const png = await page.screenshot({ path: file });
      return Math.round(png.length / 1024);
    };
    const facts = () => page.evaluate(() => {
      const vis = (id) => { const n = document.getElementById(id); if (!n) return false; const b = n.getBoundingClientRect(); const cs = getComputedStyle(n);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= innerHeight; };
      const t = window.__tour;
      return { key: t.sceneKey, scene: t.scene, edits: t.edits, original: t.original, loads: t.loads, scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
        badge: vis('tour-badge'), concept: vis('tour-concept'), ai: vis('tour-ai-note'), actions: vis('t-actions'), compare: vis('t-compare'),
        url: location.search, yaw: Math.round(t.viewer.getYaw()), pitch: Math.round(t.viewer.getPitch()), hfov: Math.round(t.viewer.getHfov()) };
    });
    const step = async (label, key, opts = {}) => {
      await settled(key, opts.original);
      const f = await facts();
      const kb = opts.noShot ? 0 : await shot(label);
      const ok = f.key === key && f.scrollW <= f.innerW && f.badge && f.concept && f.ai;
      steps.push({ label, ok, kb, ...f });
      return f;
    };
    const t0 = Date.now();
    let failure = null;
    try {
      await page.goto(base + `?lang=${lang}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__tour && window.__tour.ready === true, null, { timeout: 90000 });
      await step('1-room', room);

      // the panel
      await press('#t-change-btn');
      await page.waitForSelector('#t-change:not([hidden]) .t-change-item', { timeout: 10000 });
      const panel = await page.evaluate(() => ({
        items: [...document.querySelectorAll('#t-change .t-change-item')].map((b) => b.textContent.trim()),
        inputPx: parseFloat(getComputedStyle(document.getElementById('t-change-input')).fontSize),
        inputDisabled: document.getElementById('t-change-input').disabled,
        placeholder: document.getElementById('t-change-input').placeholder,
        note: document.getElementById('t-change-note').textContent.trim(),
      }));
      await page.waitForTimeout(300);
      const panelKb = await shot('2-panel');
      steps.push({ label: '2-panel', ok: panel.items.length === list.length && panel.inputPx >= 16 && panel.inputDisabled === true && panel.note.length > 0, kb: panelKb, ...panel });

      // one change, then a second on top
      await press(`#t-change .t-change-item[data-edit="${list[0].id}"]`);
      await step('3-' + list[0].id, keyOf([list[0].id]));
      const last = list[list.length - 1];
      await press('#t-change-btn');
      await page.waitForSelector('#t-change:not([hidden]) .t-change-item', { timeout: 10000 });
      await press(`#t-change .t-change-item[data-edit="${last.id}"]`);
      await step('4-' + list[0].id + '+' + last.id, keyOf([list[0].id, last.id]));

      // compare with the original, and back
      await press('#t-compare');
      await step('5-original', room, { original: true });
      await press('#t-compare');
      await step('5b-back', keyOf([list[0].id, last.id]), { original: false, noShot: true });

      // the remaining changes
      for (const e of list.slice(1, -1)) {
        await press('#t-change-btn');
        await page.waitForSelector('#t-change:not([hidden]) .t-change-item', { timeout: 10000 });
        await press(`#t-change .t-change-item[data-edit="${e.id}"]`);
      }
      const all = list.map((e) => e.id);
      if (list.length > 2) await step('6-' + list[1].id, keyOf(all));

      // leave by the room strip, come back through a door marker: the changes must still be on
      if (neighbour) {
        const idx = scenesDoc.scenes.indexOf(neighbour);
        await page.evaluate((i) => document.querySelectorAll('#t-strip .t-card')[i].click(), idx);
        await step('7-away', neighbour.id, { noShot: true });
        const back = await page.evaluate((target) => {
          const key = window.__tour.sceneKey;
          const hs = [...document.querySelectorAll('.t-hs')];
          // the marker whose label is the target room's name in the page language
          const name = JSON.parse(document.getElementById('tour-data').textContent).scenes.find((s) => s.id === target).name[document.documentElement.lang];
          const hit = hs.find((d) => (d.querySelector('.t-hs-label') || {}).textContent === name);
          if (!hit) return { clicked: false, key };
          hit.click();
          return { clicked: true, key };
        }, room);
        if (!back.clicked) throw new Error('no door marker back to ' + room + ' in ' + neighbour.id);
        await step('8-back-through-marker', keyOf(all));
      }

      // reset
      await press('#t-change-btn');
      await page.waitForSelector('#t-change:not([hidden]) #t-change-reset:not([hidden])', { timeout: 10000 });
      await press('#t-change-reset');
      const afterReset = await step('9-reset', room, { noShot: true });
      if (Object.keys(afterReset.edits).length !== 0) throw new Error('reset left edits on: ' + JSON.stringify(afterReset.edits));

      // a shared link opens with the change
      await page.goto(base + `?lang=${lang}&room=${room}&change=${list[0].id}`, { waitUntil: 'load', timeout: 60000 });
      await step('10-shared-link', keyOf([list[0].id]), { noShot: true });
    } catch (e) {
      failure = String(e && e.message ? e.message : e).split('\n')[0];
      try { await shot('FAILED'); } catch { /* best effort */ }
    }
    const ok = !failure && steps.every((s) => s.ok) && errors.length === 0;
    results.push({ cell: cell.name, ok, ms: Date.now() - t0, failure, errors, steps });
    await ctx.close();
  }
} finally {
  if (browser) await browser.close();
  if (server) server.close();
}
fs.writeFileSync(path.join(EVIDENCE, `change-shots-${lang}.json`), JSON.stringify({ apartment: id, room, lang, base: liveUrl || 'local dist', when: new Date().toISOString(), results }, null, 2) + '\n');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.cell}: ${r.steps.length} steps in ${r.ms} ms${r.failure ? ' · ' + r.failure : ''}${r.errors.length ? ' · errors=' + r.errors.slice(0, 2).join(' | ') : ''}`);
  for (const s of r.steps) console.log(`   ${s.ok ? 'ok ' : 'BAD'} ${s.label}${s.key ? ' key=' + s.key : ''}${s.kb ? ' png=' + s.kb + 'KB' : ''}${s.yaw !== undefined ? ` yaw=${s.yaw} pitch=${s.pitch} hfov=${s.hfov}` : ''}`);
}
process.exit(results.every((r) => r.ok) ? 0 : 1);

#!/usr/bin/env node
/* qa.mjs — the local browser check of the built tour ($0). Headless Chrome (SwiftShader) at 1440x900 and 390x844 (touch):
   the living panorama paints, room switching (strip + a door marker), the plan sheet opens, the הדמיה badge, the ruler, the
   languages, no page errors; on the --stub host the page unlocks (rings + free-text line) and a ring opens the pick bar with OUR
   items — no turn is ever sent. Writes <out>/*.png and <out>/qa-report.json.
     node tools/tour360/qa.mjs <plainBase> <stubBase> <outDir> */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const req = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = req('playwright-core');
const sharp = req('sharp');
const [, , PLAIN, STUB, OUTARG] = process.argv;
const OUT = path.resolve(OUTARG); fs.mkdirSync(OUT, { recursive: true });
const report = { when: new Date().toISOString(), plain: PLAIN, stub: STUB, cells: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function stats(file, box) {
  const img = sharp(file); const m = await img.metadata();
  const b = box || { left: Math.round(m.width * 0.25), top: Math.round(m.height * 0.3), width: Math.round(m.width * 0.5), height: Math.round(m.height * 0.4) };
  const s = await sharp(file).extract(b).stats();
  return Number((s.channels.slice(0, 3).reduce((t, c) => t + c.stdev, 0) / 3).toFixed(1));
}
async function cell(name, vp, mobile) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [], failed = [], panoReq = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => { if (/panos(-full)?\/living\.webp/.test(r.url())) panoReq.push(r.status() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '')); });
  const R = { name, viewport: vp, checks: {}, shots: [] };
  const shot = async (n) => { const f = path.join(OUT, `${name}-${n}.png`); await page.screenshot({ path: f }); R.shots.push(path.basename(f)); return f; };
  const ok = (k, v, note) => { R.checks[k] = { pass: Boolean(v), ...(note !== undefined ? { note } : {}) }; };
  await page.goto(PLAIN + '/?lang=he', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 60000 });
  await wait(2500);
  const coach = await page.$('#t-coach:not([hidden])');
  if (coach) { await page.click('#t-coach-skip').catch(() => {}); await wait(600); }
  const st0 = await page.evaluate(() => ({ scene: window.__tour.scene, lang: window.__tour.lang, markers: window.__tour.markers, look: window.__tour.lookSwitch, fullSet: window.__tour.fullSet ? true : false }));
  const f1 = await shot('01-living');
  const sd = await stats(f1);
  ok('opens on living', st0.scene === 'living', st0.scene);
  ok('living panorama requested 200', panoReq.some((x) => x.startsWith('200')), panoReq.join(' | '));
  ok('living panorama painted (centre stdev > 8)', sd > 8, sd);
  ok('badge הדמיה visible', await page.evaluate(() => [...document.querySelectorAll('.t-badge')].some((b) => b.offsetParent !== null && /הדמיה/.test(b.textContent))));
  ok('original/designed switch', st0.look === 'on', st0.look);
  // room switching by the strip
  if (await page.evaluate(() => document.documentElement.classList.contains('t-strip-closed'))) { await page.click('#t-rooms-btn').catch(() => {}); await wait(700); } // the phone keeps the strip closed until the room name is tapped
  const cards = await page.$$('#t-strip .t-card');
  const kitchen = cards[2];
  if (kitchen) { await kitchen.scrollIntoViewIfNeeded().catch(() => {}); await kitchen.click({ force: true }).catch(() => {}); }
  await page.waitForFunction(() => window.__tour.scene === 'kitchen', null, { timeout: 30000 }).catch(() => {});
  await wait(2000);
  const sc1 = await page.evaluate(() => window.__tour.scene);
  ok('strip switches to kitchen', sc1 === 'kitchen', sc1);
  await shot('02-kitchen');
  if (mobile && !(await page.evaluate(() => document.documentElement.classList.contains('t-strip-closed')))) { await page.click('#t-rooms-btn').catch(() => {}); await wait(600); } // close the strip again, as a visitor does
  // a door marker: the first visible one in the view
  await page.evaluate(() => { const v = window.__tour.viewer; if (v) v.setYaw(109, false); }); // kitchen -> dining marker at yaw 109
  await wait(800);
  const doors = await page.$$('.t-hs');
  let clicked = null;
  for (const d of doors) { if (await d.isVisible()) { const bb = await d.boundingBox(); if (bb && bb.x > 0 && bb.y > 0 && bb.x < vp.width - 10 && bb.y < vp.height - 10) { await d.click({ force: true }).catch(() => {}); clicked = true; break; } } }
  await wait(2500);
  const sc2 = await page.evaluate(() => window.__tour.scene);
  ok('a door marker moves to another room', Boolean(clicked) && sc2 !== 'kitchen', `${doors.length} door markers in the DOM; now ${sc2}`);
  await shot('03-after-door');
  // the plan sheet
  await page.click('#t-view-btn').catch(() => {}); await wait(400);
  await page.click('#t-plan-btn', { force: true }).catch(() => {}); await wait(1200);
  const planOpen = await page.evaluate(() => { const s = document.getElementById('t-sheet'); return s && !s.hidden; });
  const pin = await page.evaluate(() => document.querySelectorAll('#t-sheet svg circle, #t-sheet .t-pin, #t-sheet [class*="pin"]').length);
  ok('plan sheet opens (with pins)', planOpen && pin > 0, `pins/marks ${pin}`);
  await shot('04-plan');
  await page.click('#t-sheet-close').catch(() => {}); await wait(500);
  // the ruler in the tools menu
  const tools = await page.$('#t-tools-btn');
  const toolsShown = tools ? await tools.isVisible() : false;
  if (toolsShown) { await tools.click(); await wait(400); }
  const ruler = await page.evaluate(() => { const r = document.getElementById('t-ruler'); return Boolean(r && !r.hidden); });
  ok('measure tool present', ruler);
  if (toolsShown) { await shot('05-tools'); await page.keyboard.press('Escape'); await wait(300); }
  // the languages
  await page.goto(PLAIN + '/?lang=en&room=living', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 60000 }); await wait(1500);
  if (await page.$('#t-coach:not([hidden])')) { await page.click('#t-coach-skip').catch(() => {}); await wait(400); }
  const en = await page.evaluate(() => ({ lang: window.__tour.lang, dir: document.documentElement.dir, room: document.getElementById('t-room').textContent }));
  ok('English second (lang=en)', en.lang === 'en', JSON.stringify(en));
  await shot('06-en');
  // the phone: no walking arrows, not cluttered
  if (mobile) {
    const vis = await page.evaluate(() => {
      const shown = (e) => e && !e.hidden && e.offsetParent !== null && e.getBoundingClientRect().width > 0;
      const walk = [...document.querySelectorAll('[class*="walk"], [class*="arrow-pad"], [class*="joystick"]')].filter(shown).length;
      return { roomSwitcher: shown(document.getElementById('t-travel')), navHud: shown(document.getElementById('t-nav-hud')), walkControls: walk,
        buttons: [...document.querySelectorAll('button, a')].filter((b) => shown(b) && b.getBoundingClientRect().top < innerHeight && b.getBoundingClientRect().bottom > 0).length };
    });
    R.phone = vis;
    ok('phone: no walking arrows (no walk pad / walk HUD; the ‹ room › switcher is room navigation)', !vis.navHud && vis.walkControls === 0, JSON.stringify(vis));
  }
  R.errors = errors; R.failed = failed;
  ok('no page errors', errors.length === 0, errors.join(' || '));
  await ctx.close();
  // the unlocked page on the stub host: rings + free-text line + the pick bar with our items
  const ctx2 = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, locale: 'he-IL' });
  const p2 = await ctx2.newPage(); const err2 = [];
  p2.on('pageerror', (e) => err2.push(String(e.message).slice(0, 200)));
  await p2.goto(STUB + '/?lang=he&key=localqa-0000', { waitUntil: 'load' });
  await p2.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 60000 }); await wait(2500);
  if (await p2.$('#t-coach:not([hidden])')) { await p2.click('#t-coach-skip').catch(() => {}); await wait(400); }
  await p2.evaluate(() => { const v = window.__tour.viewer; if (v) { v.setYaw(-140, false); v.setPitch(-25, false); } }); await wait(1200);
  const un = await p2.evaluate(() => ({ unlocked: window.__tour.unlocked, rings: document.querySelectorAll('.t-mk').length, ringsVisible: [...document.querySelectorAll('.t-mk')].filter((e) => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden').length }));
  const design = await p2.$('#t-design-btn');
  if (design && await design.isVisible()) { await design.click().catch(() => {}); await wait(600); }
  const bar = await p2.evaluate(() => { const b = document.getElementById('t-change-bar'); return Boolean(b && !b.hidden && b.offsetParent !== null); });
  await p2.screenshot({ path: path.join(OUT, `${name}-07-unlocked.png`) }); R.shots.push(`${name}-07-unlocked.png`);
  if (design && await design.isVisible()) { await p2.keyboard.press('Escape'); await wait(300); }
  ok('stub host: page unlocks', un.unlocked === true, JSON.stringify(un));
  ok('stub host: rings drawn in living', un.rings > 0, JSON.stringify(un));
  ok('stub host: free-text design line shown', bar);
  // tap the sofa ring
  let pick = null;
  const rings = await p2.$$('.t-mk');
  for (const r of rings) { if (await r.isVisible()) { await r.click({ force: true }).catch(() => {}); await wait(900); pick = await p2.evaluate(() => { const p = document.getElementById('t-pick'); return p && !p.hidden ? { chip: document.getElementById('t-pick-chip').textContent, items: [...document.querySelectorAll('#t-catalog-bar .t-catalog-item')].map((b) => b.dataset.item) } : null; }); if (pick) break; } }
  await p2.screenshot({ path: path.join(OUT, `${name}-08-pick.png`) }); R.shots.push(`${name}-08-pick.png`);
  ok('stub host: a ring opens the pick bar with our items', Boolean(pick && pick.items.length), JSON.stringify(pick));
  ok('stub host: no page errors', err2.length === 0, err2.join(' || '));
  await ctx2.close();
  report.cells.push(R);
  console.log(name, Object.entries(R.checks).map(([k, v]) => `${v.pass ? 'PASS' : 'FAIL'} ${k}${v.note !== undefined ? ' [' + String(v.note).slice(0, 140) + ']' : ''}`).join('\n  '));
}
try {
  await cell('desktop-1440', { width: 1440, height: 900 }, false);
  await cell('phone-390', { width: 390, height: 844 }, true);
} finally { await browser.close(); }
report.pass = report.cells.every((c) => Object.values(c.checks).every((v) => v.pass));
fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('QA', report.pass ? 'PASS' : 'FAIL', '->', OUT);
process.exit(report.pass ? 0 : 1);

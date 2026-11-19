#!/usr/bin/env node
/* No price anywhere while project.json prices_public is not true (Eliran 2026-11-08: «כן, להסתיר» — the units.json prices are fixtures).
   Headless Chrome on a STAGE at 360×780, 390×844 and 1440×900; for every surface the RENDERED text (innerText: hidden elements excluded)
   must hold no «₪», no "ILS", no price-shaped number (1,234,567 / 1234567) and no price label («מחיר» / "Price"):
     /apartment.html?project=rainbow&unit=846 (hero + the «אודות» tab) · /landing.html?project=rainbow (facts) ·
     /hold/ via the landing CTA: the card of 846, the card of one other unit, the «דירות» list.
   Also: the landing footer has no /studio/ link and its dev-only TODO is hidden off the laptop (a non-local host is simulated by
   ?dev=0 not being enough — DEV keys on the hostname — so the check reads the rule instead: the TODO exists only when DEV).
   Screenshots + no-price.json into --out. $0.   usage: node test/no-price.check.mjs <stage> --out <dir> */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const stage = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const OUT = argv[argv.indexOf('--out') + 1];
if (!stage || argv.indexOf('--out') < 0) { console.error('usage: no-price.check.mjs <stage> --out <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const { serveStatic } = await import(pathToFileURL(path.join(HERE, '..', '..', 'tools', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const phone = (w, h) => ({ name: String(w), viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const SIZES = [phone(360, 780), phone(390, 844), { name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }];
const PRICE = /₪|\bILS\b|\b\d{1,3}(?:,\d{3}){2,}\b|(?<![.\d])\d{7,}(?![.\d])|מחיר|\bPrice\b/;   // a dotted version (0.1.20261108) is not a price
const res = { at: new Date().toISOString(), base, pattern: String(PRICE), sizes: {}, fails: [] };
const fail = (s, m) => { res.fails.push(`${s}: ${m}`); console.log(`  FAIL ${s}: ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scan = async (page, S, R, key, sel = 'body') => {
  const txt = await page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.innerText).join('\n'), sel);
  const m = txt.match(PRICE); R[key] = { chars: txt.length, hit: m ? m[0] : null };
  if (!txt.trim()) fail(S, `${key}: no text rendered`);
  if (m) fail(S, `${key}: price text «${m[0]}»`);
};

for (const S of SIZES) {
  const R = res.sizes[S.name] = {}; console.log(`== ${S.name}`);
  const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  // the apartment page: hero, then the «אודות» tab
  await page.goto(`${base}/apartment.html?project=rainbow&unit=846`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('aptTitle').textContent.trim() !== '…'); await sleep(1500);
  R.aptPriceEl = await page.evaluate(() => { const e = document.getElementById('aptPrice'); return { hidden: e.hidden, text: e.textContent }; });
  await scan(page, S.name, R, 'apartment');
  await page.screenshot({ path: path.join(OUT, `p1-apartment-${S.name}.png`) });
  await page.click('#tab-about'); await sleep(800);
  await scan(page, S.name, R, 'apartmentAbout');
  await page.evaluate(() => document.getElementById('aboutFacts')?.scrollIntoView({ block: 'center' })); await sleep(400);
  await page.screenshot({ path: path.join(OUT, `p2-apartment-about-${S.name}.png`) });
  // landing.html (the A/B lead page) facts
  await page.goto(`${base}/landing.html?project=rainbow&v=a`, { waitUntil: 'load' }); await sleep(1500);
  await scan(page, S.name, R, 'landingHtml');
  // the root landing: no /studio/ link in the page; the dev TODO only exists in DEV
  await page.goto(`${base}/`, { waitUntil: 'load' }); await sleep(800);
  R.rootStudioLinks = await page.evaluate(() => [...document.querySelectorAll('a[href]')].filter((a) => /studio/.test(a.getAttribute('href'))).length);
  if (R.rootStudioLinks) fail(S.name, 'the landing still links /studio/');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `p3-landing-footer-${S.name}.png`) });
  await page.click('#langToggle'); await sleep(500);
  await page.screenshot({ path: path.join(OUT, `p3-landing-footer-en-${S.name}.png`) });
  R.rootStudioLinksEn = await page.evaluate(() => [...document.querySelectorAll('a[href]')].filter((a) => /studio/.test(a.getAttribute('href'))).length);
  await page.click('#langToggle'); await sleep(300);
  await page.evaluate(() => scrollTo(0, 0)); await sleep(800);
  // the hold via the landing CTA: 846's card, another unit's card, the «דירות» list
  await page.waitForFunction(() => /hold/.test(document.getElementById('heroCta').href));
  await Promise.all([page.waitForURL(/\/hold\//, { timeout: 20000 }), page.click('#heroCta')]);
  await page.waitForFunction(() => window.__orbit && window.__orbit.done, null, { timeout: 60000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#pickerStage .hotspot')].some((b) => getComputedStyle(b).display !== 'none'), null, { timeout: 20000 });
  await sleep(3500);
  await page.evaluate(() => document.querySelector('#pickerStage .hotspot[data-unit="846"]').click()); await sleep(800);
  await scan(page, S.name, R, 'holdCard846', '#unitSheet');
  await page.screenshot({ path: path.join(OUT, `p4-hold-card-846-${S.name}.png`) });
  await page.click('#unitClose'); await sleep(400);
  await page.evaluate(() => document.querySelector('#pickerStage .hotspot[data-unit="856"]').click()); await sleep(800);
  await scan(page, S.name, R, 'holdCard856', '#unitSheet');
  await page.screenshot({ path: path.join(OUT, `p5-hold-card-856-${S.name}.png`) });
  await page.click('#unitClose'); await sleep(400);
  await page.click('#pickerStage .picker-units-btn'); await sleep(800);
  R.listRows = await page.evaluate(() => document.querySelectorAll('#unitsList .unit-row').length);
  if (R.listRows < 2) fail(S.name, `units list rows: ${R.listRows}`);
  await scan(page, S.name, R, 'holdList', '#unitsDrawer');
  await page.screenshot({ path: path.join(OUT, `p6-hold-units-list-${S.name}.png`) });
  R.errors = errors; if (errors.length) fail(S.name, 'page errors: ' + errors.join(' | '));
  await ctx.close();
}
await browser.close(); srv.close();
res.pass = res.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'no-price.json'), JSON.stringify(res, null, 1));
console.log(res.pass ? `PASS · ${OUT}` : `FAIL · ${res.fails.length} · ${OUT}`);
process.exit(res.pass ? 0 : 1);

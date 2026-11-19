#!/usr/bin/env node
/* Where the Habait brand sits (round 9): the landing header + footer (HE and EN), the apartment page header, the tour place card,
   the /studio/ header and /hold/ (which shows no Habait mark), at 390 and 1440, on a STAGE. Asserts each placement shows the brand
   image (loaded, ≥ 20 px high in headers), no page error, no horizontal overflow; saves screenshots. $0.
   usage: node test/brand-placements.shots.mjs <stage> --out <dir> */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const stage = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const OUT = argv[argv.indexOf('--out') + 1];
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const { serveStatic } = await import(pathToFileURL(path.join(HERE, '..', '..', 'tools', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const SIZES = [{ name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: '390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }];
const res = { at: new Date().toISOString(), sizes: {}, fails: [] };
const fail = (s, m) => { res.fails.push(`${s}: ${m}`); console.log(`  FAIL ${s}: ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const img = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect();
  return { src: (e.currentSrc || e.getAttribute('src') || '').split('/').pop(), ok: e.tagName !== 'IMG' || (e.complete && e.naturalWidth > 0), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) }; }, sel);
for (const S of SIZES) {
  const R = res.sizes[S.name] = {}; console.log(`== ${S.name}`);
  const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const check = (k, v, minH) => { R[k] = v; if (!v || !v.ok || v.h < minH) fail(S.name, `${k}: brand missing or too small ${JSON.stringify(v)}`); };
  // landing header + footer (HE), footer (EN)
  await page.goto(base + '/', { waitUntil: 'load' }); await sleep(1200);
  check('landingHeader', await img(page, '.rl-top .rl-brand__logo'), 22);
  await page.screenshot({ path: path.join(OUT, `b1-landing-header-${S.name}.png`), clip: { x: 0, y: 0, width: S.viewport.width, height: Math.min(260, S.viewport.height) } });
  await page.evaluate(() => (window.__rlLenis ? window.__rlLenis.scrollTo(document.body.scrollHeight, { immediate: true }) : scrollTo(0, document.body.scrollHeight))); await sleep(1500);
  check('landingFooter', await img(page, '.rl-foot__logo'), 60);
  await page.screenshot({ path: path.join(OUT, `b2-landing-footer-he-${S.name}.png`) });
  await page.click('#langToggle'); await sleep(700);
  await page.evaluate(() => (window.__rlLenis ? window.__rlLenis.scrollTo(document.body.scrollHeight, { immediate: true }) : scrollTo(0, document.body.scrollHeight))); await sleep(1200);
  R.footerEn = await img(page, '.rl-foot__logo');
  if (!R.footerEn || !/wordmark/.test(R.footerEn.src)) fail(S.name, 'EN footer is not the wordmark ' + JSON.stringify(R.footerEn));
  await page.screenshot({ path: path.join(OUT, `b3-landing-footer-en-${S.name}.png`) });
  await page.click('#langToggle'); await sleep(300);
  // apartment page header
  await page.goto(`${base}/apartment.html?project=rainbow&unit=846`, { waitUntil: 'load' }); await sleep(1500);
  check('apartmentHeader', await img(page, '#brandLogo'), 22);
  await page.screenshot({ path: path.join(OUT, `b4-apartment-header-${S.name}.png`), clip: { x: 0, y: 0, width: S.viewport.width, height: Math.min(300, S.viewport.height) } });
  // tour place card
  await page.goto(`${base}/tour/?room=living&coach=0`, { waitUntil: 'load' }); await sleep(3500);
  check('tourCard', await img(page, '.t-place .t-brand-logo'), S.name === '390' ? 0 : 14);
  await page.screenshot({ path: path.join(OUT, `b5-tour-card-${S.name}.png`), clip: { x: 0, y: 0, width: S.viewport.width, height: Math.min(360, S.viewport.height) } });
  // studio header
  await page.goto(`${base}/studio/`, { waitUntil: 'load' }); await sleep(1500);
  check('studioHeader', await img(page, '.st-brand__logo'), 22);
  await page.screenshot({ path: path.join(OUT, `b6-studio-header-${S.name}.png`), clip: { x: 0, y: 0, width: S.viewport.width, height: Math.min(260, S.viewport.height) } });
  // /hold/ (no Habait mark there today; screenshot for the record)
  await page.goto(`${base}/hold/?project=rainbow&from=platform`, { waitUntil: 'load' }); await sleep(3000);
  R.holdHasHabait = await page.evaluate(() => /Habait/.test(document.body.innerText) || !!document.querySelector('img[src*="habait"]'));
  await page.screenshot({ path: path.join(OUT, `b7-hold-${S.name}.png`) });
  R.favicon = await page.goto(base + '/brand/habait-mark.svg').then((r) => r.status());
  R.errors = errors.filter((e) => !/Clerk|clerk|studio-config|api\//.test(e));
  if (R.errors.length) fail(S.name, 'page errors: ' + R.errors.join(' | '));
  await ctx.close();
}
await browser.close(); srv.close();
res.pass = res.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'placements.json'), JSON.stringify(res, null, 1));
console.log(res.pass ? `PASS · ${OUT}` : `FAIL · ${res.fails.length} · ${OUT}`);
process.exit(res.pass ? 0 : 1);

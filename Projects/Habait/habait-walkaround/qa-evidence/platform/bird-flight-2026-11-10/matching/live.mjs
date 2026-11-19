// live check of the bird flight on the deployed test link, through the real path: landing -> hold -> 846 -> «כניסה לדירה» -> film -> tour.
// usage: node live.mjs <base> <out dir>
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('playwright-core');
const base = process.argv[2].replace(/\/$/, ''), OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const SIZES = [{ name: '390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { name: '1440', viewport: { width: 1440, height: 900 } }];
let bad = 0;
for (const S of SIZES) {
  const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const film = []; page.on('response', (r) => { if (/fly-846/.test(r.url())) film.push(r.status() + ' ' + r.url().split('/').pop()); });
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => /hold/.test(document.getElementById('heroCta').href));
  await Promise.all([page.waitForURL(/\/hold\//, { timeout: 30000 }), page.click('#heroCta')]);
  await page.waitForFunction(() => window.__orbit && window.__orbit.done, null, { timeout: 120000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#pickerStage .hotspot')].some((b) => b.dataset.unit === '846' && b.offsetParent), null, { timeout: 40000 });
  await sleep(1500); await page.evaluate(() => document.querySelector('#pickerStage .hotspot[data-unit="846"]').click()); await sleep(900);
  const tap = Date.now(); await page.click('#unitContinue');
  let st = null;
  for (const [t, n] of [[1200, 'start'], [3000, 'floors'], [4000, 'glass'], [5000, 'room'], [6700, 'landing']]) {
    const w = t - (Date.now() - tap); if (w > 0) await sleep(w);
    await page.screenshot({ path: path.join(OUT, `live-${n}-${S.name}.png`) });
    const f = page.frames().find((x) => /\/apartment-journey\//.test(x.url()));
    if (f) st = await f.evaluate(() => ({ mode: window.__journey.mode, flyT: window.__journey.flyT, phase: window.__journey.phase, overflow: document.documentElement.scrollWidth > innerWidth, flyStart: Math.round(window.__journey.flyStart || 0) })).catch(() => st);
  }
  let tour = true; try { await page.waitForFunction(() => { const f = document.getElementById('tourFrame'); return f && getComputedStyle(f).opacity === '1'; }, null, { timeout: 25000 }); } catch { tour = false; }
  const ms = Date.now() - tap; await sleep(1500); await page.screenshot({ path: path.join(OUT, `live-tour-${S.name}.png`) });
  const ok = st && st.mode === 'fly' && st.flyT > 4 && tour && !errors.length && !st.overflow; if (!ok) bad++;
  console.log(S.name, ok ? 'OK' : 'BAD', JSON.stringify({ st, tour, tapToTourMs: ms, film, errors }));
  await ctx.close();
}
await browser.close(); process.exit(bad ? 1 : 0);

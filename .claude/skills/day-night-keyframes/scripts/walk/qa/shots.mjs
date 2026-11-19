// Day/Night walk QA in a real browser (headless Chrome, WebGL): desktop 1440x900 and phone 390x844 load without errors,
// no sideways overflow; the visitor stands at named places and the clock is set to keyframe hours and their midpoints
// (canvas-only shots, ui=0) for analyse.py; one UI shot per size; the walk still moves (arrow key 1.5 s) with the slider on.
// Usage: node qa/shots.mjs <base url> <out dir>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_CORE_FROM || 'C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');

const [base, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
// places: the first three named places of walk-grid.json; pairs: the first and the last adjacent keyframes of daynight.json
const PLACES = Object.keys(await (await fetch(`${base}/walk-grid.json`)).json().then((g) => g.views)).slice(0, 3);
const KS = (await (await fetch(`${base}/daynight.json`)).json()).keys.map((k) => k.hour).sort((a, b) => a - b);
const PAIRS = KS.length > 2 ? [[KS[0], KS[1]], [KS[KS.length - 2], KS[KS.length - 1]]] : [[KS[0], KS[1]]];
const report = { base, at: new Date().toISOString(), sizes: {}, pairs: [] };
const stand = (page, v) => page.evaluate((v) => { const [u, vv, yaw] = window.__walk.grid.views[v]; const w = window.__walk; w.me.x = u / 100; w.me.z = vv / 100; w.me.dist = 0; w.me.goal = null; w.setYaw(yaw); w.me.pitch = -0.03; }, v);
for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  for (const ui of [true, false]) {
    if (mobile && !ui) continue;
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    const errors = [], failed = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    const t0 = Date.now();
    await page.goto(`${base}/?hour=14${ui ? '' : '&ui=0'}`, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => window.__walk && window.__walk.ready && window.__walk.dn.ready, null, { timeout: 180000 });
    } catch (e) {
      console.error('NOT READY', name, ui, JSON.stringify({ errors, failed, state: await page.evaluate(() => ({ w: !!window.__walk, load: document.getElementById('load').className })) }));
      throw e;
    }
    const r = { ui, load_s: (Date.now() - t0) / 1000, errors, failed, shots: [] };
    const shot = async (f) => { await page.waitForTimeout(600); await page.screenshot({ path: path.join(outDir, f) }); r.shots.push(f); };
    if (ui) {
      r.overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1) && e.closest('nav') === null; }).map((e) => e.id || e.tagName));
      for (const h of [14, 21]) { await stand(page, 'living'); await page.evaluate((h) => window.__walk.setHour(h), h); await shot(`${name}-ui-h${h}.png`); }
      // the walk still walks with the light panel there
      const p0 = await page.evaluate(() => [window.__walk.me.x, window.__walk.me.z]);
      await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowUp');
      const p1 = await page.evaluate(() => [window.__walk.me.x, window.__walk.me.z, window.__walk.ok(window.__walk.me.x, window.__walk.me.z)]);
      r.walked_m = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); r.on_free_floor = p1[2];
      r.mix_at_21 = await page.evaluate(() => ({ ...window.__walk.dn }));
    } else {
      for (const v of PLACES) for (const [a, b] of PAIRS) {
        const m = (a + b) / 2, files = [];
        for (const h of [a, m, b]) {
          await stand(page, v); await page.evaluate((h) => window.__walk.setHour(h), h);
          const f = `raw-${v}-h${h}.png`; await shot(f); files.push(f);
        }
        report.pairs.push({ place: v, a: files[0], mid: files[1], b: files[2], hours: [a, (a + b) / 2, b] });
      }
    }
    report.sizes[`${name}${ui ? '' : '-raw'}`] = r;
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'shots.json'), JSON.stringify(report, null, 1));
const bad = Object.values(report.sizes).some((r) => r.errors.length || r.failed.length || (r.overflow && r.overflow.length) || (r.ui && !(r.walked_m > 0.5 && r.on_free_floor)));
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.sizes).map(([k, r]) => [k, { load_s: r.load_s, errors: r.errors, failed: r.failed, overflow: r.overflow, walked_m: r.walked_m, on_free_floor: r.on_free_floor }]))));
process.exit(bad ? 1 : 0);

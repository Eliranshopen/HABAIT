// $0 browser check of the walkthrough: load, errors, frame time, screenshots at 1440x900 and 390x844, a walk test.
import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, outDir] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const res = {};
for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  p.on('requestfailed', (r) => errs.push('failed ' + r.url())); p.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  const t0 = Date.now(); await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
  await p.waitForTimeout(4000); const loadS = (Date.now() - t0) / 1000;
  await p.screenshot({ path: `${outDir}/${name}-start.png` });
  const shots = [['living', 0], ['kitchen', 1], ['parents', 2], ['mamad', 3], ['bedA', 4], ['bedB', 5], ['bath', 6], ['balcony', 7]];
  for (const [n, i] of shots) { await p.evaluate((k) => document.querySelectorAll('#rooms button')[k].click(), i); await p.waitForTimeout(2600); await p.screenshot({ path: `${outDir}/${name}-${n}.png` }); }
  // walk test: from the living room, hold ↑ for 2 s and report the distance moved and that we are still on free floor
  await p.evaluate((k) => document.querySelectorAll('#rooms button')[k].click(), 0); await p.waitForTimeout(1500);
  const before = await p.evaluate(() => ({ ...window.__walk.me }));
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(2000); await p.keyboard.up('ArrowUp');
  const after = await p.evaluate(() => ({ ...window.__walk.me, ok: window.__walk.ok(window.__walk.me.x, window.__walk.me.y), calls: window.__walk.info().calls, tris: window.__walk.info().triangles, free: window.__walk.freeCount() }));
  const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 4000) requestAnimationFrame(f); else r(+(n / ((performance.now() - t) / 1000)).toFixed(1)); }; requestAnimationFrame(f); }));
  res[name] = { loadS, errs, walked_m: Math.hypot(after.x - before.x, after.y - before.y).toFixed(2), on_free_floor: after.ok, draw_calls: after.calls, triangles: after.tris, free_cells: after.free, fps_headless: fps };
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(res, null, 1));

// Step 14 - the walkaround in a real browser (headless Chrome, WebGL on): loads it at 1440x900 and 390x844, checks for
// page errors and failed requests, walks: stands at every named place, looks around (4 headings), walks forward 2 s with the
// arrow key and checks the visitor moved and stayed on free floor, and that walking into a wall stops at the wall.
// Usage: node scripts/14_walk_check.mjs <base url> <out dir>     (a static server must serve the job root)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');

const [base, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const report = { base, at: new Date().toISOString(), sizes: {} };
for (const [name, vp, mobile] of [['desktop-1440', { width: 1440, height: 900 }, false], ['phone-390', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [], failed = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  const t0 = Date.now();
  await page.goto(`${base}/walkaround/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const r = { load_s: (Date.now() - t0) / 1000, errors, failed, shots: [], places: {} };
  await page.screenshot({ path: path.join(outDir, `${name}-start.png`) });
  r.shots.push(`${name}-start.png`);
  // overflow (RTL: both sides)
  r.overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1) && getComputedStyle(e).position !== 'fixed' && e.closest('nav') === null; }).length);
  const views = await page.evaluate(() => Object.keys(window.__walk.grid.views));
  for (const v of views) {
    await page.evaluate((v) => { const [u, vv, yaw] = window.__walk.grid.views[v]; const w = window.__walk; w.me.x = u / 100; w.me.z = vv / 100; w.setYaw(yaw); w.me.pitch = -0.03; }, v);
    await page.waitForTimeout(350);
    const free = await page.evaluate(() => window.__walk.ok(window.__walk.me.x, window.__walk.me.z));
    const f = `${name}-${v}.png`;
    await page.screenshot({ path: path.join(outDir, f) });
    r.shots.push(f);
    r.places[v] = { free };
  }
  // walk: from the living place, 2 s forward
  await page.evaluate(() => { const [u, vv, yaw] = window.__walk.grid.views.living; const w = window.__walk; w.me.x = u / 100; w.me.z = vv / 100; w.setYaw(yaw); });
  const p0 = await page.evaluate(() => ({ x: window.__walk.me.x, z: window.__walk.me.z }));
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2000); await page.keyboard.up('ArrowUp');
  const p1 = await page.evaluate(() => ({ x: window.__walk.me.x, z: window.__walk.me.z, free: window.__walk.ok(window.__walk.me.x, window.__walk.me.z) }));
  r.walk_forward_m = +Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2);
  r.walk_end_free = p1.free;
  // into a wall: 8 s forward must end on free floor (the wall stops the visitor)
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(8000); await page.keyboard.up('ArrowUp');
  r.wall_stop_free = await page.evaluate(() => window.__walk.ok(window.__walk.me.x, window.__walk.me.z));
  r.fps_draw_calls = await page.evaluate(() => window.__walk.info().calls);
  await page.screenshot({ path: path.join(outDir, `${name}-after-walk.png`) });
  report.sizes[name] = r;
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'walk-check.json'), JSON.stringify(report, null, 1));
const bad = Object.values(report.sizes).some((r) => r.errors.length || r.failed.length || !r.walk_end_free || !r.wall_stop_free || r.walk_forward_m < 1 || Object.values(r.places).some((p) => !p.free));
console.log(JSON.stringify(report, null, 1));
console.log(bad ? 'WALK CHECK FAIL' : 'WALK CHECK PASS');
process.exit(bad ? 1 : 0);

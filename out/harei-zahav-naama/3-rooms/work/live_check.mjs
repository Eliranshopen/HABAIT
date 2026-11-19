import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
for (const [n, vp, mob] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 });
  const p = await ctx.newPage(); const errs = [], bad = [];
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  const t0 = Date.now();
  await p.goto('https://hatzav-walk.vercel.app/', { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__items && window.__items.live.size >= window.__items.REG.items.length && [...window.__items.live.values()].every((q) => q.model), null, { timeout: 240000 });
  await p.evaluate(() => { const w = window.__walk; w.goTo('living'); }); await p.waitForTimeout(1500);
  await p.screenshot({ path: `qa/deploy-check/live-${n}.png` });
  console.log(n, 'ready in', ((Date.now() - t0) / 1000).toFixed(0), 's', 'errors', JSON.stringify(errs.slice(0, 3)), 'bad', JSON.stringify(bad.slice(0, 3)), 'pieces', await p.evaluate(() => window.__items.live.size));
  await ctx.close();
}
await b.close();

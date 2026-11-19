import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(process.env.URL || 'http://127.0.0.1:8895/walkaround/', { waitUntil: 'load' });
await p.waitForFunction(() => window.__daynight && window.__daynight.dn.ready && window.__items && [...window.__items.live.values()].every((q) => q.model), null, { timeout: 180000 });
await p.evaluate(() => { const w = window.__walk; w.me.x = 7.65; w.me.z = 6.4; w.setYaw(159); w.me.pitch = -0.08; });
for (const h of [8, 17.5, 21.5]) {
  await p.evaluate((h) => window.__daynight.setHour(h), h); await p.waitForTimeout(1500);
  await p.screenshot({ path: `qa/features/daynight-${h}.png` });
}
await p.evaluate(() => document.getElementById('b-time').click()); await p.waitForTimeout(400);
await p.screenshot({ path: 'qa/features/daynight-panel.png' });
console.log('errors', JSON.stringify(errs)); await b.close();

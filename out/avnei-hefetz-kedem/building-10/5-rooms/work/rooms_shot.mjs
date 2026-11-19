import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] });
const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
await p.goto(url); await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
await p.addStyleTag({ content: 'body > *:not(canvas) { visibility:hidden !important; }' });
for (const [k, x, y, yaw] of [['bedA-n', 5.75, 2.9, 0], ['bedA-w', 5.75, 2.9, 1.57], ['bedB', 9.0, 1.6, -1.57], ['mamad', 9.5, 6.5, -1.57], ['corr', 7.6, 4.0, 3.14]]) {
  await p.evaluate(([x, y, yaw]) => { const w = window.__walk; w.daynight.apply(12.5); w.me.x = x; w.me.y = y; w.me.yaw = yaw; w.me.pitch = 0; }, [x, y, yaw]);
  await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/room-${k}.png` });
}
await b.close();

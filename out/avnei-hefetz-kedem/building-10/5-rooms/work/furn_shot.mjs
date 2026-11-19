import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 160)); });
await p.goto(url, { timeout: 240000 }); await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
await p.addStyleTag({ content: 'body > *:not(canvas) { visibility:hidden !important; }' });
await p.waitForTimeout(3000);
for (const [k, x, y, yaw, pitch] of [['mamadW', 11.25, 6.5, 1.57, 0.45], ['mamadE', 9.0, 6.5, -1.57, 0.45]]) {
  await p.evaluate(([x, y, yaw, pitch]) => { const w = window.__walk; w.daynight.apply(12.5); w.me.x = x; w.me.y = y; w.me.yaw = yaw; w.me.pitch = pitch; }, [x, y, yaw, pitch]);
  await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/furn-${k}.png` });
}
console.log(JSON.stringify(errs.slice(0, 6))); await b.close();

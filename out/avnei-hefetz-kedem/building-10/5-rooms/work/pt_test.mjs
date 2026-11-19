// proof on one view: the living room toward the kitchen (Eliran's picture 01), path traced N seconds after stopping
import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1100, height: 614 } })).newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(url, { waitUntil: 'load' });
await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 300000, polling: 1000 });
await p.addStyleTag({ content: 'body > *:not(canvas) { visibility:hidden !important; }' });
await p.waitForFunction(() => window.__walk.PT && !window.__walk.PT.pt.isCompiling, null, { timeout: 300000, polling: 2000 });
const res = {};
for (const [k, x, y, yaw, pitch] of [['01', 6.5, 5.0, 1.2, -0.12], ['05', 9.1, 10.9, -2.1, -0.2], ['12', 6.75, 10.6, 1.75, -0.12]]) {
  await p.evaluate(([x, y, yaw, pitch]) => { const w = window.__walk; w.daynight.apply(12.5); w.me.x = x; w.me.y = y; w.me.yaw = yaw; w.me.pitch = pitch; w.camera.fov = 75; w.camera.updateProjectionMatrix(); }, [x, y, yaw, pitch]);
  const t0 = Date.now(); await p.waitForTimeout(35000);
  res[k] = { samples: await p.evaluate(() => window.__walk.PT ? window.__walk.PT.samples : -1), s: (Date.now() - t0) / 1000 };
  await p.screenshot({ path: `${out}/pt-${k}.png` });
}
console.log(JSON.stringify({ res, errs: errs.slice(0, 5) })); await b.close();

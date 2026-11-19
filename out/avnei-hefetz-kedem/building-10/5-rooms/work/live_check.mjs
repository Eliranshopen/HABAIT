import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const url = process.argv[2], out = process.argv[3];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] });
const res = {};
for (const [n, vp, m] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const p = await (await b.newContext({ viewport: vp, isMobile: m, hasTouch: m, deviceScaleFactor: m ? 2 : 1 })).newPage(); const errs = [], bad = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  const t0 = Date.now(); await p.goto(url, { timeout: 240000 });
  await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 300000, polling: 1000 });
  res[n] = { loadS: (Date.now() - t0) / 1000, errs, bad: bad.slice(0, 5), title: await p.title() };
  await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/live-${n}.png` });
}
console.log(JSON.stringify(res, null, 1)); await b.close();

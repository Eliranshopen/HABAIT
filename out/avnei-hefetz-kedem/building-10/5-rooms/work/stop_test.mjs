import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] });
const res = {};
for (const [n, vp, m] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const p = await (await b.newContext({ viewport: vp, isMobile: m, hasTouch: m, deviceScaleFactor: m ? 2 : 1 })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8896/index.html', { timeout: 240000 }); await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 300000, polling: 1000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => [...document.querySelectorAll('#rooms .rc')].find((e) => e.dataset.room === 'living').click());
  await p.waitForTimeout(6000);
  res[n] = { stop: await p.evaluate(() => document.querySelector('.stopview').classList.contains('on')), me: await p.evaluate(() => { const w = window.__walk; return { x: +w.me.x.toFixed(2), y: +w.me.y.toFixed(2), yaw: +w.me.yaw.toFixed(2), goal: !!w.me.goal }; }), errs };
  await p.screenshot({ path: `qa/gen/stop-${n}.png` });
}
console.log(JSON.stringify(res)); await b.close();

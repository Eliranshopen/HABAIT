import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await p.goto('http://127.0.0.1:8896/index.html', { timeout: 240000 }); await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 300000, polling: 1000 });
await p.waitForTimeout(2000);
const tgt = await p.evaluate(() => { const s = [...document.querySelectorAll('#rooms .rc')].find((e) => e.dataset.room === 'living'); s.click(); const w = window.__walk; return { path: (w.me.path || []).length, goal: w.me.goal }; });
const log = [tgt];
for (let i = 0; i < 16; i++) { await p.waitForTimeout(700); log.push(await p.evaluate(() => { const w = window.__walk; return [+w.me.x.toFixed(2), +w.me.y.toFixed(2), (w.me.path || []).length, !!w.me.goal, w.studio.mode]; })); }
console.log(JSON.stringify(log)); await b.close();

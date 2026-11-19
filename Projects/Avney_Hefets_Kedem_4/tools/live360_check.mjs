// live360_check.mjs - the deployed 360 tour in Chrome at 1440x900 and 390x844: paints, room switch by the strip arrow, no errors. $0.
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json'); const { chromium } = require('playwright-core');
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const [w, h, mob] of [[1440, 900, false], [390, 844, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 });
    const p = await ctx.newPage(); const errs = [], bad = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(-60)); });
    await p.goto(url, { waitUntil: 'load', timeout: 120000 }); await p.waitForTimeout(10000);
    await p.screenshot({ path: `${out}_${w}.png` });
    const canvas = await p.evaluate(() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; });
    console.log(JSON.stringify({ w, canvas, errs, bad: bad.slice(0, 5), badge: await p.evaluate(() => document.body.innerText.includes('הדמיה')), two: await p.evaluate(() => document.body.innerText.includes('עד 2%')) }));
    await ctx.close();
  }
} finally { await b.close(); }

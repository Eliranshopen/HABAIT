// doorshot.mjs <tour url> <out prefix> — the living room on a phone, turned to the master-suite door and to the terrace, then one step ↑ through the door
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('playwright-core');
const [base, out] = process.argv.slice(2); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const p = await c.newPage();
await p.goto(base + '?scope=apartment&room=living&floor=parquet&video=0&coach=0&auto=0', { waitUntil: 'load' });
await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded()); await sleep(1500);
for (const [n, y] of [['terrace', 10], ['suite-door', 128]]) { await p.evaluate((yy) => window.__tour.viewer.lookAt(-6, yy, undefined, false), y); await sleep(700); await p.screenshot({ path: `${out}-${n}.png` }); }
const labels = await p.evaluate(() => (window.__tour.viewer.getConfig().hotSpots || []).filter((h) => h.type === 'scene').map((h) => ({ to: h.createTooltipArgs.to, yaw: Math.round(h.yaw), label: h.div ? h.div.textContent : '' })));
console.log(JSON.stringify(labels));
await p.tap('#t-joy [data-dir="up"]'); await sleep(300); console.log('word:', await p.evaluate(() => document.getElementById('t-nav-hud-text').textContent));
await p.waitForFunction(() => window.__tour.scene !== 'living' && window.__tour.viewer.isLoaded(), null, { timeout: 9000 }); await sleep(1200);
console.log('arrived:', await p.evaluate(() => window.__tour.scene)); await p.screenshot({ path: `${out}-arrived.png` });
await b.close();

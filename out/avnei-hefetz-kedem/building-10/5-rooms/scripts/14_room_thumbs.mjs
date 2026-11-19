// $0: the room-card pictures (RAINBOW's numbered room cards) are frames of this same model, one per room stop,
// taken with every control hidden; work/thumbs/<room>.png → walk/thumbs/<room>.jpg (resized by python afterwards).
import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, outDir] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 960, height: 600 } })).newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url, { waitUntil: 'load' });
await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
await p.addStyleTag({ content: 'body > *:not(canvas) { visibility:hidden !important; }' });
const rooms = await p.evaluate(() => [...document.querySelectorAll('#rooms .rc')].map((e) => e.dataset.room));
for (let i = 0; i < rooms.length; i++) {
  await p.evaluate((k) => document.querySelectorAll('#rooms .rc')[k].click(), i);
  await p.waitForFunction(() => !window.__walk.me.goal, null, { timeout: 30000, polling: 500 }).catch(() => {});
  await p.waitForTimeout(2500); await p.screenshot({ path: `${outDir}/${rooms[i]}.png` });
}
await b.close(); console.log(JSON.stringify({ rooms, errs }));

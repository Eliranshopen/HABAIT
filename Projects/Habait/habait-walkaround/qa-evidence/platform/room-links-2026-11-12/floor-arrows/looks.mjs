// looks.mjs <tour url> <out dir> — the screenshot views: room at a yaw, level view, desktop and phone
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('playwright-core');
const [base, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true }); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEWS = [['entrance', -25], ['living', -120], ['terraceBedroom', -80], ['wardrobe', 20], ['bedroomMain', 90], ['dining', -150]];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const S of [{ n: '1440', ctx: { viewport: { width: 1440, height: 900 } } }, { n: '390', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }]) {
  const c = await b.newContext(S.ctx); const p = await c.newPage();
  for (const [room, yaw] of VIEWS) {
    await p.goto(base + `?scope=apartment&room=${room}&floor=parquet&video=0&coach=0&auto=0`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 60000 }); await sleep(700);
    await p.evaluate((y) => window.__tour.viewer.lookAt(0, y, undefined, false), yaw); await sleep(900);
    await p.screenshot({ path: `${out}/${S.n}-${room}.png` });
  }
  await c.close();
}
await b.close(); console.log('ok');

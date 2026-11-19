// levelview.mjs <tour url> — at the LEVEL view (pitch 0, the view a visitor has) on a 390 phone and a 1440 desktop: is each room
// button visible and tappable when the visitor faces it? (no tilting). Prints the ones that are not, with their pitch.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('playwright-core');
const base = process.argv[2]; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOMS = ['entrance', 'kitchen', 'dining', 'living', 'terraceLiving', 'terraceBedroom', 'bedroomMain', 'wardrobe', 'bathMain', 'bedroom2', 'bathguest'];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }); let hidden = 0, total = 0;
for (const S of [{ n: '390', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }, { n: '1440', ctx: { viewport: { width: 1440, height: 900 } } }]) {
  const c = await b.newContext(S.ctx); const p = await c.newPage();
  for (const room of ROOMS) {
    await p.goto(base + `?scope=apartment&room=${room}&floor=parquet&video=0&coach=0&auto=0`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 60000 }); await sleep(800);
    const list = await p.evaluate(() => (window.__tour.viewer.getConfig().hotSpots || []).filter((h) => h.type === 'scene' && h.createTooltipArgs && h.createTooltipArgs.to && h.createTooltipArgs.to !== 'terraceOut').map((h) => ({ to: h.createTooltipArgs.nameAs || h.createTooltipArgs.to, yaw: h.yaw, pitch: h.pitch })));
    for (const h of list) {
      total++;
      await p.evaluate((y) => window.__tour.viewer.lookAt(0, y, undefined, false), h.yaw); await sleep(350);
      const ok = await p.evaluate((to) => { const me = (window.__tour.viewer.getConfig().hotSpots || []).find((x) => x.type === 'scene' && x.createTooltipArgs && (x.createTooltipArgs.nameAs || x.createTooltipArgs.to) === to); const q = me.div.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2, e = document.elementFromPoint(x, y); return Boolean(e && me.div.contains(e)) && y > 0 && y < innerHeight; }, h.to);
      if (!ok) { hidden++; console.log(S.n, 'HIDDEN at the level view:', room, '→', h.to, 'pitch', h.pitch.toFixed(1)); }
    }
  }
  await c.close();
}
await b.close(); console.log('level view: hidden', hidden, 'of', total);

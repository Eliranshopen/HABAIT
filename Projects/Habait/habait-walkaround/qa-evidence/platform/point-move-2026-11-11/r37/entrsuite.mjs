// entrsuite.mjs <tour url> <out prefix> — from the entrance, the view of Eliran's screenshot: the button on the master suite's door, at 1440 and 390; a click / tap on it arrives in the wardrobe corner
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('playwright-core');
const [base, out] = process.argv.slice(2); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }); let bad = 0;
for (const S of [{ n: '1440', ctx: { viewport: { width: 1440, height: 900 } } }, { n: '390', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }]) {
  const c = await b.newContext(S.ctx); const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '?scope=apartment&room=entrance&floor=parquet&video=0&coach=0&auto=0', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded()); await sleep(1500);
  await p.evaluate(() => window.__tour.viewer.lookAt(-6, 45, undefined, false)); await sleep(800);
  const r = await p.evaluate(() => { const h = (window.__tour.viewer.getConfig().hotSpots || []).find((x) => x.type === 'scene' && x.createTooltipArgs.to === 'wardrobe'); if (!h || !h.div) return null; const q = h.div.getBoundingClientRect(); const x = q.left + q.width / 2, y = q.top + q.height / 2; const e = document.elementFromPoint(x, y); return { x, y, label: h.div.textContent, hit: Boolean(e && h.div.contains(e)), joy: Boolean(document.getElementById('t-joy')) }; });
  await p.screenshot({ path: `${out}-${S.n}.png` });
  let at = null; if (r && r.hit) { if (S.n === '390') await p.touchscreen.tap(r.x, r.y); else await p.mouse.click(r.x, r.y); try { await p.waitForFunction(() => window.__tour.scene === 'wardrobe' && window.__tour.viewer.isLoaded(), null, { timeout: 9000 }); } catch { /* reported below */ } at = await p.evaluate(() => window.__tour.scene); }
  const ok = r && r.hit && at === 'wardrobe' && !errs.length && !r.joy; if (!ok) bad++;
  console.log(S.n, ok ? 'OK' : 'BAD', JSON.stringify(r), '→', at, errs.join(' | '));
  await c.close();
}
await b.close(); process.exit(bad ? 1 : 0);

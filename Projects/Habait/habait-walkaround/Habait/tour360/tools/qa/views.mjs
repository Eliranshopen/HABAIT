// views.mjs <tour url> <out dir> <room:yaw[:floor[:pitch]]> ... — screenshots of chosen views at 1440x900 and 390x844, for the eye
// (2026-11-15, the Pi wrapper; from the laundry-niche checks). yaw is the viewer's yaw in degrees (0 = the picture's centre), floor
// one of the tour's floor sets (default parquet), pitch default -2. Prints page errors; exit 1 if any.
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire((process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps') + '/package.json')('playwright-core');
const [base, out, ...views] = process.argv.slice(2);
if (!base || !out || !views.length) { console.error('usage: views.mjs <tour url> <out dir> <room:yaw[:floor[:pitch]]> ...'); process.exit(2); }
fs.mkdirSync(out, { recursive: true }); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }); const errs = [];
for (const S of [{ n: '1440', ctx: { viewport: { width: 1440, height: 900 } } }, { n: '390', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }]) {
  const c = await b.newContext(S.ctx); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(S.n + ' ' + e.message));
  for (const v of views) {
    const [room, yaw, floor = 'parquet', pitch = '-2'] = v.split(':');
    await p.goto(base + `?scope=apartment&room=${room}&floor=${floor}&video=0&coach=0&auto=0`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 60000 }); await sleep(800);
    await p.evaluate(([pt, y]) => window.__tour.viewer.lookAt(pt, y, undefined, false), [Number(pitch), Number(yaw)]); await sleep(1100);
    const f = `${out}/${S.n}-${room}-${yaw}-${floor}.png`; await p.screenshot({ path: f }); console.log('shot', f);
  }
  await c.close();
}
await b.close(); console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors'); process.exit(errs.length ? 1 : 0);

// Real-browser screenshots of the Day/Night viewer (one Chrome for all shots; SwiftShader WebGL).
// node shots.mjs <outDir> <baseUrl>   — playwright-core is used read-only from the engine's appdeps.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/RnD/Projects/3Dengine/appdeps/node_modules/playwright-core');
const [out, base] = process.argv.slice(2);
const SHOTS = [
  ...[15, 16, 17, 18.5, 20, 21.5].map((h) => ({ n: `raw_h${h}`, w: 1440, h: 900, q: `ui=0&hour=${h}&yaw=-60&pitch=-6` })),
  { n: 'desk_h14', w: 1440, h: 900, q: 'hour=14' },
  { n: 'desk_h16', w: 1440, h: 900, q: 'hour=16&yaw=-110' },
  { n: 'desk_h21', w: 1440, h: 900, q: 'hour=21.5&yaw=-90' },
  { n: 'phone_h17', w: 390, h: 844, q: 'hour=17&yaw=-110', mobile: true },
  { n: 'phone_h21', w: 390, h: 844, q: 'hour=21.5', mobile: true },
];
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0;
for (const s of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1, isMobile: !!s.mobile, hasTouch: !!s.mobile });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${base}/index.html?${s.q}`);
  try {
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    await page.waitForTimeout(400);
    // horizontal overflow check (RTL-aware: both edges)
    const ovf = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect();
      return getComputedStyle(e).display !== 'none' && r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('#tabs') && !e.closest('#hotspots'); }).map((e) => e.id || e.className || e.tagName));
    const st = await page.evaluate(() => ({ hour: window.__dn.state.hour, yaw: window.__dn.state.yaw }));
    await page.screenshot({ path: `${out}/${s.n}.png` });
    console.log(`shot ${s.n} ok`, JSON.stringify(st), ovf.length ? `OVERFLOW ${ovf.join(',')}` : 'no-overflow', errs.length ? `ERRORS ${errs.join(' | ')}` : '');
    if (errs.length || ovf.length) fail = 1;
  } catch (e) { console.log(`shot ${s.n} FAILED ${e.message} ${errs.join(' | ')}`); fail = 1; }
  await ctx.close();
}
await browser.close();
process.exit(fail);

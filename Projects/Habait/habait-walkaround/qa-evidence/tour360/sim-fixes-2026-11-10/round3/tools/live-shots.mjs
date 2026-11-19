// round 3 QA on the LIVE test link: every one of the 11 tabs, two directions each, desktop 1440x900 and phone 390x844, the default
// floor (parquet) + one concrete and one marble view; page errors, failed requests and horizontal overflow recorded; contact sheets.
// usage: node live-shots.mjs <base url ending in /tour/> <out dir>
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const req = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json');
const { chromium } = req('playwright-core'); const sharp = req('sharp');
const BASE = process.argv[2], OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
const ROOMS = ['entrance', 'kitchen', 'dining', 'living', 'terraceLiving', 'terraceBedroom', 'bedroomMain', 'wardrobe', 'bathMain', 'bedroom2', 'bathguest'];
const VIEWS = []; for (const r of ROOMS) for (const yaw of [-120, 60]) VIEWS.push([r, yaw, 'parquet']);
VIEWS.push(['living', -150, 'concrete'], ['kitchen', 120, 'marble'], ['bedroomMain', -130, 'concrete'], ['wardrobe', 20, 'marble']);
const SIZES = [['1440', { width: 1440, height: 900 }, false], ['390', { width: 390, height: 844 }, true]];
let browser; const report = [];
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [sz, viewport, mobile] of SIZES) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, locale: 'he-IL' }); const files = [];
    for (const [room, yaw, floor] of VIEWS) {
      const page = await ctx.newPage(); const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 120))); page.on('requestfailed', (r) => errors.push('failed ' + r.url().slice(-60)));
      page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url().slice(-60)); });
      await page.goto(`${BASE}index.html?room=${room}&yaw=${yaw}&coach=0&lang=he&floor=${floor}`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForTimeout(7000);
      const f = path.join(OUT, `${sz}-${room}-${yaw}-${floor}.png`); await page.screenshot({ path: f }); files.push(f);
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      report.push({ size: sz, room, yaw, floor, errors, overflow: o.sw > o.cw });
      await page.close();
    }
    await ctx.close();
    const tw = mobile ? 234 : 480, th = mobile ? 506 : 300, cols = mobile ? 9 : 5;
    for (let s = 0; s * cols * (mobile ? 3 : 3) < files.length; s++) {
      const part = files.slice(s * cols * 3, (s + 1) * cols * 3); const comp = [];
      for (let i = 0; i < part.length; i++) comp.push({ input: await sharp(part[i]).resize(tw, th).toBuffer(), left: (i % cols) * (tw + 4), top: Math.floor(i / cols) * (th + 4) });
      await sharp({ create: { width: cols * (tw + 4), height: Math.ceil(part.length / cols) * (th + 4), channels: 3, background: '#222' } }).composite(comp).jpeg({ quality: 82 }).toFile(path.join(OUT, `sheet-${sz}-${s + 1}.jpg`));
    }
  }
} finally { if (browser) await browser.close(); }
fs.writeFileSync(path.join(OUT, 'live-shots.json'), JSON.stringify(report, null, 1));
const bad = report.filter((r) => r.errors.length || r.overflow);
console.log(`views ${report.length}; with errors or overflow: ${bad.length}`); for (const b of bad.slice(0, 12)) console.log(JSON.stringify(b).slice(0, 300));

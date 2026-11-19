// kedma-d1 QA ($0): the first look of every room as a visitor gets it, in a real Chrome against the local server (desktop 1920),
// and of a few rooms on a phone (390). usage: node capture-rooms.mjs <base url ending in /p/kedma-d1/tour/> <out dir> [room,room,...]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(path.join(process.env.HABAIT_APP_DIR, 'package.json'));
const { chromium } = require('playwright-core');
const [base, out, only] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const ALL = ['kitchen', 'pantry', 'living', 'dining', 'family', 'corridor', 'master', 'shower', 'bed1', 'bed2', 'bath', 'mamad', 'balcony'];
const rooms = only ? only.split(',') : ALL;
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const log = [];
try {
  for (const [w, h, list] of [[1920, 1080, rooms], [390, 844, rooms.filter((r) => ['living', 'balcony', 'master'].includes(r))]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'he-IL' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    for (const room of list) {
      await page.goto(`${base}?room=${room}&coach=0`, { waitUntil: 'load' }); await page.waitForTimeout(4500);
      for (const sel of ['#t-help-close', '.t-guide-skip', '#t-intro-skip', '.t-tip-close']) { const b = await page.$(sel); if (b && await b.isVisible()) await b.click().catch(() => {}); }
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(out, `room-${room}-${w}.png`) });
      log.push(`${room} ${w}: scene=${await page.evaluate(() => window.__tour && window.__tour.scene)}`);
    }
    log.push(`${w}: page errors ${errs.length} ${errs.slice(0, 2).join(' ; ')}`);
    await ctx.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, 'capture-rooms.log'), log.join('\n') + '\n'); console.log(log.join('\n'));

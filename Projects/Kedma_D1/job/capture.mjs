// kedma-d1 QA ($0): what a visitor sees — the first look of a few rooms and the 3D view, in a real Chrome against the local server.
// usage: node capture.mjs <base url ending in /p/kedma-d1/tour/> <out dir>
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(path.join(process.env.HABAIT_APP_DIR, 'package.json'));
const { chromium } = require('playwright-core');
const [base, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const log = [];
try {
  for (const [w, h] of [[1920, 1080], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'he-IL' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    for (const room of w > 1000 ? ['living', 'kitchen', 'master', 'bath'] : ['living']) {
      await page.goto(`${base}?room=${room}&coach=0`, { waitUntil: 'load' }); await page.waitForTimeout(4500);
      for (const sel of ['#t-help-close', '.t-guide-skip', '#t-intro-skip', '.t-tip-close']) { const b = await page.$(sel); if (b && await b.isVisible()) await b.click().catch(() => {}); }
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(out, `first-look-${room}-${w}.png`) });
      log.push(`${room} ${w}x${h}: scene=${await page.evaluate(() => window.__tour && window.__tour.scene)} cone=${JSON.stringify(await page.evaluate(() => window.__tour && window.__tour.cone))}`);
    }
    if (w > 1000) {
      await page.click('#t-view-btn'); await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(out, `view-menu-${w}.png`) });
      const items = await page.$$eval('#t-view button', (bs) => bs.map((b) => `${b.id}:${b.hidden ? 'hidden' : 'shown'}:${b.textContent.trim().slice(0, 14)}`)); log.push('view menu: ' + items.join(' | '));
      const target = await page.$('#t-plan-btn'); /* the menu's 3D entry */ if (target) { await target.click({ force: true }).catch((e) => log.push('3d click: ' + String(e).slice(0, 80))); await page.waitForTimeout(7000); await page.screenshot({ path: path.join(out, `view-3d-${w}.png`) }); }
      else log.push('no 3D control found');
    }
    log.push(`${w}: page errors ${errs.length} ${errs.slice(0, 2).join(' ; ')}`);
    await ctx.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, 'capture.log'), log.join('\n') + '\n'); console.log(log.join('\n'));

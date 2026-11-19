// kedma-d1 QA ($0): one room in a real Chrome against the local server, turned to a given yaw and pitch the way a visitor drags
// the view (the viewer's own setYaw / setPitch), at the viewer's own field of view. usage:
//   node browser-look.mjs <base url ending in /p/kedma-d1/tour/> <room> <out prefix> <yaw,pitch> [<yaw,pitch> ...] [--w 1920 --h 1080]
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.env.HABAIT_APP_DIR, 'package.json'));
const { chromium } = require('playwright-core');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [base, room, out] = args; const looks = args.slice(3).filter((a) => a === 'first' || /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(a));   // "first" = the room as it opens
const W = Number(opt('--w', 1920)), H = Number(opt('--h', 1080));
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'he-IL' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.goto(`${base}?room=${room}&coach=0${opt('--query', '') ? '&' + opt('--query', '') : ''}`, { waitUntil: 'load' }); await page.waitForTimeout(5000);
  for (const sel of ['#t-help-close', '.t-guide-skip', '#t-intro-skip', '.t-tip-close']) { const b = await page.$(sel); if (b && await b.isVisible()) await b.click().catch(() => {}); }
  for (const l of looks) {
    const [yaw, pitch] = l === 'first' ? [null, null] : l.split(',').map(Number);
    const got = await page.evaluate(([y, p]) => {
      const t = window.__tour || {}; const v = t.viewer || window.viewer; if (!v) return null;
      if (y !== null) { v.setPitch(p, false); v.setYaw(y, false); }
      return { yaw: v.getYaw(), pitch: v.getPitch(), hfov: v.getHfov(), scene: t.scene };
    }, [yaw, pitch]);
    await page.waitForTimeout(1500);
    const f = l === 'first' ? `${out}-first.png` : `${out}-y${yaw}-p${pitch}.png`; await page.screenshot({ path: f });
    console.log(JSON.stringify(got), '->', f);
  }
  console.log('page errors', errs.length, errs.slice(0, 2).join(' ; '));
} finally { await browser.close(); }

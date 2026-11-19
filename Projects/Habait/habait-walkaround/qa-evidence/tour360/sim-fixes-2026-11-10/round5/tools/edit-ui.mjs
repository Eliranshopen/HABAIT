import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('playwright-core');
const OUT = process.argv[2]; let b;
try {
  b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [sz, vp, mob] of [['1440', { width: 1440, height: 900 }, false], ['390', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: mob, hasTouch: mob, locale: 'he-IL' }); const p = await ctx.newPage();
    await p.goto('https://rainbow-v2-test.vercel.app/tour/index.html?room=living&yaw=-40&coach=0&lang=he&floor=parquet', { waitUntil: 'load', timeout: 90000 });
    await p.waitForTimeout(7000);
    if (mob) await p.touchscreen.tap(86, 702); else await p.getByText('עיצוב', { exact: false }).first().click({ timeout: 8000 });
    await p.waitForTimeout(1200);
    const info = await p.evaluate(() => { const i = document.getElementById('t-bar-input'); if (!i) return 'no input'; const r = i.getBoundingClientRect(); const cs = getComputedStyle(i); return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), vis: cs.visibility, disp: cs.display, disabled: i.disabled, ph: i.placeholder }; });
    console.log(sz, JSON.stringify(info)); await p.screenshot({ path: `${OUT}/edit-ui-${sz}.png` }); await ctx.close();
  }
} finally { if (b) await b.close(); }

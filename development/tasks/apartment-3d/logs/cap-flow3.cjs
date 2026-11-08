const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const OUT = 'C:/RnD/.wt/apartment-3d/after/flow-ref';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('https://habait-flow.vercel.app/tour/?scope=apartment&room=living&floor=parquet&video=0', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(9000);
  await p.screenshot({ path: `${OUT}/05_tour.png` });
  console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('a,button')].map((a) => ((a.textContent || '').trim() || a.getAttribute('aria-label') || a.title || '').replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean))));
  await b.close();
})();

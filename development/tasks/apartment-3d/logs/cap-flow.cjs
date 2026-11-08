const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const OUT = 'C:/RnD/.wt/apartment-3d/after/flow-ref';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('https://habait-flow.vercel.app/', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(8000);
  await p.screenshot({ path: OUT + '/01_home.png' });
  const info = await p.evaluate(() => ({ title: document.title, links: [...document.querySelectorAll('a,button')].map((a) => (a.textContent || '').trim().slice(0, 40) + ' -> ' + (a.getAttribute('href') || '')).slice(0, 60), iframes: [...document.querySelectorAll('iframe')].map((f) => f.src), canvases: document.querySelectorAll('canvas').length }));
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();

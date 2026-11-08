const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const OUT = 'C:/RnD/.wt/apartment-3d/after/flow-ref';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('https://habait-flow.vercel.app/', { waitUntil: 'load', timeout: 60000 });
  await p.click('text=לטיסה');
  for (const [i, ms] of [[2, 6000], [3, 8000], [4, 10000]]) {
    await p.waitForTimeout(ms);
    await p.screenshot({ path: `${OUT}/0${i}_after_click.png` });
    const info = await p.evaluate(() => ({ url: location.href.slice(0, 160), title: document.title, btn: [...document.querySelectorAll('a,button')].map((a) => (a.textContent || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean).slice(0, 40), iframes: [...document.querySelectorAll('iframe')].map((f) => (f.src || '').slice(0, 140)), canvases: document.querySelectorAll('canvas').length, videos: document.querySelectorAll('video').length }));
    console.log(i, JSON.stringify(info));
  }
  await b.close();
})();

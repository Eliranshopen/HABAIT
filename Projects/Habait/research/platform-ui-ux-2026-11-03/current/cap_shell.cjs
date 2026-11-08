// Capture the platform SHELL pages of habait-flow (not the video / hold / tour) at desktop and phone size.
// usage: node cap_shell.cjs <outdir>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = 'https://habait-flow.vercel.app';
const PAGES = [
  ['01_home', '/'],
  ['02_home_rainbow', '/?project=rainbow'],
  ['03_landing_a', '/landing.html?project=rainbow&v=a'],
  ['04_landing_b', '/landing.html?project=rainbow&v=b'],
  ['05_apartment', '/apartment.html?project=rainbow&unit=846'],
  ['06_apartment_plan', '/apartment.html?project=rainbow&unit=846&tab=plan'],
  ['07_apartment_images', '/apartment.html?project=rainbow&unit=846&tab=images'],
  ['08_apartment_about', '/apartment.html?project=rainbow&unit=846&tab=about'],
  ['09_flow', '/flow.html?project=rainbow'],
];
const SIZES = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const report = [];
  for (const [sz, opts] of Object.entries(SIZES)) {
    const ctx = await b.newContext(opts);
    for (const [name, path] of PAGES) {
      const p = await ctx.newPage();
      const errs = []; const bad = [];
      p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
      p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(0, 120)); });
      try { await p.goto(BASE + path, { waitUntil: 'load', timeout: 30000 }); } catch (e) { errs.push('goto ' + e.message.slice(0, 80)); }
      await p.waitForTimeout(3500);
      const info = await p.evaluate(() => ({ title: document.title, url: location.href, h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, dir: document.documentElement.dir, lang: document.documentElement.lang, text: document.body.innerText.slice(0, 1200) })).catch(() => ({}));
      await p.screenshot({ path: `${OUT}/${sz}_${name}.png` });
      await p.screenshot({ path: `${OUT}/${sz}_${name}_full.png`, fullPage: true }).catch(() => {});
      report.push({ sz, name, path, errs, bad, ...info });
      await p.close();
    }
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/capture-report.json`, JSON.stringify(report, null, 1));
  console.log(report.map((r) => `${r.sz} ${r.name} h=${r.h} w=${r.w} errs=${r.errs.length} bad=${r.bad.length}`).join('\n'));
  await b.close();
})();

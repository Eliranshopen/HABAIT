const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const path of ['/', '/tour/', '/hold/']) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
    const p = await ctx.newPage(); const errs = [], bad = [], cons = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
    p.on('console', (m) => { if (m.type() === 'error') cons.push(m.text().slice(0, 120)); });
    p.on('response', (r) => { if (r.status() >= 400 && !/favicon|posthog/i.test(r.url())) bad.push(r.status() + ' ' + r.url().slice(0, 100)); });
    const r = await p.goto('https://habait-flow.vercel.app' + path, { waitUntil: 'domcontentloaded' });
    await new Promise((s) => setTimeout(s, 9000));
    console.log(path, r.status(), 'title=' + (await p.title()), 'pageerrors', JSON.stringify(errs), '4xx', JSON.stringify(bad), 'consErr', JSON.stringify(cons));
    await ctx.close();
  }
  await b.close();
})();

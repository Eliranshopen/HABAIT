// tour-exterior-floors: the floor buttons follow an in-page hop (no reload): exterior -> apartment -> exterior. Desktop. :8851 served
// by the caller (or a URL as argv[2]).
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const base = process.argv[2] || 'http://127.0.0.1:8851/';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  try {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await p.goto(base + 'index.html?video=0&room=terraceOut', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
    const vis = () => p.evaluate(() => { const n = document.getElementById('t-floor-seg'); return { scene: window.__tour.scene, shown: !n.closest('[hidden]') && n.getBoundingClientRect().width > 0 }; });
    const hop = async (want) => {
      await p.evaluate((w) => { const v = window.__tour.viewer; const keys = Object.keys(v.getConfig().scenes || {}); const k = keys.find((x) => x === w || x.startsWith(w + '@') || x.startsWith(w + '|') || x.startsWith(w + ':')) || w; v.loadScene(k); }, want);
      await p.waitForFunction((w) => window.__tour.scene === w && window.__tour.viewer.isLoaded(), want, { timeout: 60000 });
      await p.waitForTimeout(500);
    };
    const r0 = await vis(); out.push(`${!r0.shown ? 'ok  ' : 'FAIL'} start ${JSON.stringify(r0)} (exterior: hidden)`);
    await hop('entrance'); const r1 = await vis(); out.push(`${r1.shown ? 'ok  ' : 'FAIL'} hop ${JSON.stringify(r1)} (apartment: shown)`);
    await hop('facade'); const r2 = await vis(); out.push(`${!r2.shown ? 'ok  ' : 'FAIL'} hop ${JSON.stringify(r2)} (exterior: hidden)`);
  } finally { await b.close(); }
  out.push(out.some((l) => l.startsWith('FAIL')) ? 'FAIL' : 'PASS');
  console.log(out.join('\n'));
})();

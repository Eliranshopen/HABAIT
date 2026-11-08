// Gate 1 defect repro (card 03 "11 pills in Top"): the apartment page's embedded 3D tab, Top preset, on Pixel 7 and
// iPhone 13 — labelsVisible, the hidden rooms, the frame size and band. :8851 (tour stubbed), killed by PID.
const { spawn } = require('child_process');
const fs = require('fs');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/dollhouse-in-tour/run/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = 'C:/RnD/development/tasks/dollhouse-in-tour/logs/frames';
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const lines = [];
  try {
    for (const dev of ['Pixel 7', 'iPhone 13']) {
      const ctx = await b.newContext(devices[dev]);
      await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
      const p = await ctx.newPage();
      await p.goto('http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846&tab=3d', { waitUntil: 'load' });
      const fr = await (await p.$('#dollFrame')).contentFrame();
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      await fr.evaluate(() => window.__dollhouseView.setPreset('top', { animate: false }));
      await p.waitForTimeout(1500);
      const r = await fr.evaluate(() => ({
        n: window.__dollhouse.labelsVisible, w: innerWidth, h: innerHeight,
        hidden: [...document.querySelectorAll('.dh-label')].filter((l) => l.hidden).map((l) => l.dataset.room),
        mini: [...document.querySelectorAll('.dh-label.mini')].length,
      }));
      lines.push(`${dev}: Top labels ${r.n}/11, frame ${r.w}x${r.h}, compact ${r.mini}, hidden ${r.hidden.join(',') || '-'}`);
      await p.screenshot({ path: `${OUT}/labels_embedded_${dev.replace(/\s/g, '').toLowerCase()}_top.png` });
      await ctx.close();
    }
  } finally { await b.close(); srv.kill(); }
  const txt = lines.join('\n');
  console.log(txt);
  fs.writeFileSync(__dirname + '/probe-labels-embedded.txt', txt + '\n');
})();

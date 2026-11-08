// Card 05 label probe: phone (iPhone 13) Top preset, every room's anchor, label size per form, and whether it shows.
const { spawn } = require('child_process');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const p = await (await b.newContext(devices['iPhone 13'])).newPage();
    await p.goto('http://127.0.0.1:8851/_local/dist/rainbow/846/media/dollhouse.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
    await p.evaluate(() => window.__dollhouseView.setPreset('top', { animate: false }));
    await p.waitForTimeout(1500);
    console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.dh-label')].map((l) => { const r = l.getBoundingClientRect(); return { room: l.dataset.room, hidden: l.hidden, mini: l.classList.contains('mini'), x0: Math.round(r.left), y0: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })), null, 0));

  } finally { await b.close(); srv.kill(); }
})();

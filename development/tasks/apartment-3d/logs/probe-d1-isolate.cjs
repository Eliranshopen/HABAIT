// D1 isolation (gate 3): the embedded 3D tab (apartment page), desktop DPR 2, Top preset, parquet. One crop under the
// entrance label per case: built / sun shadow off / lightmap off / floor texture off. :8851 (tour stubbed), PID-killed.
const { spawn } = require('child_process');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = 'C:/RnD/.wt/apartment-3d/after/gate3';
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846&tab=3d', { waitUntil: 'load' });
    const fr = await (await p.$('#dollFrame')).contentFrame();
    await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
    await fr.evaluate(() => { const v = window.__dollhouseView; v.setFloor('parquet'); v.setPreset('top', { animate: false }); v.setPreset('top', { animate: false }); });
    await p.waitForTimeout(2000);
    const fb = await (await p.$('#dollFrame')).boundingBox();
    const lr = await fr.evaluate(() => document.querySelector('.dh-label[data-room="r-entrance"]').getBoundingClientRect().toJSON());
    const clip = { x: fb.x + lr.x - 20, y: fb.y + lr.y + lr.height, width: 160, height: 70 };
    const cases = [
      ['built', () => {}],
      ['noshadow', () => { window.__dollhouseView.scene.traverse((o) => { if (o.isDirectionalLight) o.castShadow = false; }); }],
      ['nolightmap', () => { window.__dollhouseView.scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.lightMap) { m.userData.lm = m.lightMap; m.lightMap = null; m.needsUpdate = true; } }); }],
      ['nomap', () => { window.__dollhouseView.scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) { if (m && m.userData.lm) { m.lightMap = m.userData.lm; } if (m && m.map) { m.map = null; } m && (m.needsUpdate = true); } }); }],
    ];
    for (const [name, fn] of cases) {
      await fr.evaluate(`(${fn.toString()})(); window.__dollhouseView.renderer.render(window.__dollhouseView.scene, window.__dollhouseView.camera);`);
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${OUT}/d1_iso_${name}.png`, clip });
    }
    console.log('clip', JSON.stringify(clip));
  } finally { await b.close(); srv.kill(); }
})();

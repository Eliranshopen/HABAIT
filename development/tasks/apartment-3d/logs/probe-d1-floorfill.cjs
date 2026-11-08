// D1 hypothesis: the stripes are z-fighting between the floors and the coplanar 'floorfill' mesh (each baked dark under
// the other). Desktop DPR 2, Top preset, crop at the reviewer's spot: as built / floorfill hidden. :8851, killed by PID.
const { spawn } = require('child_process');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = 'C:/RnD/.wt/apartment-3d/after/gate3';
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
    await p.goto('http://127.0.0.1:8851/_local/dist/rainbow/846/media/dollhouse.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
    await p.evaluate(() => window.__dollhouseView.setPreset('top', { animate: false }));
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => document.querySelector('.dh-label[data-room="r-entrance"]').getBoundingClientRect().toJSON());
    const clip = { x: Math.max(0, r.x - 60), y: Math.max(0, r.y - 20), width: 240, height: 140 };
    await p.screenshot({ path: `${OUT}/d1_ff_built.png`, clip });
    const info = await p.evaluate(() => { const v = window.__dollhouseView; const names = []; v.scene.traverse((o) => { if (o.isMesh && /floorfill/.test(o.name)) { names.push(o.name); o.visible = false; } }); v.renderer.render(v.scene, v.camera); return names; });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/d1_ff_hidden.png`, clip });
    console.log('floorfill meshes hidden:', JSON.stringify(info));
  } finally { await b.close(); srv.kill(); }
})();

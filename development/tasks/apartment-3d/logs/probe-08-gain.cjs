// Card 08 tuning probe: the baked light's gain (lightMapIntensity = gain / scale) at runtime, desktop 3D preset, plus a
// Phase-1 reference (no lightmap, plain live lights). Frames to after/phase2/tune_*.png. :8851, killed by PID.
const { spawn } = require('child_process');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = 'C:/RnD/.wt/apartment-3d/after/phase2';
const gains = (process.argv[2] || '0.35,0.5,0.65').split(',').map(Number);
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await p.goto('http://127.0.0.1:8851/_local/dist/rainbow/846/media/dollhouse.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
    await p.evaluate(() => window.__dollhouseView.setPreset('3d', { animate: false }));
    for (const g of gains) {
      await p.evaluate((gain) => {
        const v = window.__dollhouseView; const s = window.__dollhouse.lightmap.scale;
        v.scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.lightMap) m.lightMapIntensity = (Math.PI * gain) / s; });
        v.renderer.render(v.scene, v.camera);
      }, g);
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${OUT}/tune_gain_${g}.png`, clip: { x: 80, y: 60, width: 1100, height: 720 } });
    }
  } finally { await b.close(); srv.kill(); }
  console.log('gains', gains.join(', '));
})();

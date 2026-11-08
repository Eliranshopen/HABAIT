// Card 08 diagnosis: where do the terrace-edge "barcode" dashes come from? The same desktop 3D frame, rendered with the
// lightmap on/off x the baked/plain live lights, cropped to the terrace edge -> after/phase2/barcode_<case>.png. :8851.
const { spawn } = require('child_process');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = 'C:/RnD/.wt/apartment-3d/after/phase2';
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await p.goto('http://127.0.0.1:8851/_local/dist/rainbow/846/media/dollhouse.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
    await p.evaluate(() => window.__dollhouseView.setPreset('3d', { animate: false }));
    await p.evaluate(() => {
      const v = window.__dollhouseView; window.__lm = [];
      v.scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.lightMap) window.__lm.push([m, m.lightMap, m.lightMapIntensity]); });
      window.__lights = []; v.scene.traverse((o) => { if (o.isLight) window.__lights.push([o, o.intensity]); });
      window.__env = v.scene.environmentIntensity;
    });
    const cases = { lm_baked: [true, 'baked'], nolm_baked: [false, 'baked'], lm_plain: [true, 'plain'], nolm_plain: [false, 'plain'], noshadow: [true, 'baked', 'noshadow'] };
    for (const [name, [lm, lights, extra]] of Object.entries(cases)) {
      await p.evaluate(([lm2, lights2, extra2]) => {
        const v = window.__dollhouseView;
        for (const [m, t] of window.__lm) { m.lightMap = lm2 ? t : null; m.needsUpdate = true; }
        const plain = lights2 === 'plain';
        for (const [o, i0] of window.__lights) { o.intensity = plain ? (o.isHemisphereLight ? 1.05 : 1.9) : i0; o.castShadow = o.isDirectionalLight ? extra2 !== 'noshadow' : o.castShadow; }
        v.scene.environmentIntensity = plain ? 0.45 : window.__env;
        v.renderer.shadowMap.needsUpdate = true;
        v.renderer.render(v.scene, v.camera);
      }, [lm, lights, extra]);
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${OUT}/barcode_${name}.png`, clip: { x: 560, y: 540, width: 560, height: 240 } });
    }
  } finally { await b.close(); srv.kill(); }
  console.log('done');
})();

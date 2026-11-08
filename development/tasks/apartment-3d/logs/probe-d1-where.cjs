// D1: the world point under the stripe block (embedded tab, DPR 2, Top, parquet): raycast a few screen points ->
// mesh + world (three) + Blender world (x = X + shift.x, y = -(Z + shift.z)). :8851, PID-killed.
const { spawn } = require('child_process');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
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
    await fr.evaluate(() => { const v = window.__dollhouseView; v.setPreset('top', { animate: false }); v.setPreset('top', { animate: false }); });
    await p.waitForTimeout(1500);
    const out = await fr.evaluate(() => {
      const v = window.__dollhouseView; const lr = document.querySelector('.dh-label[data-room="r-entrance"]').getBoundingClientRect();
      const R = v.camera.constructor; const res = [];
      return { lr: lr.toJSON(), w: innerWidth, h: innerHeight };
    });
    const pts = [];
    for (const [dx, dy] of [[40, 8], [60, 8], [80, 10], [100, 8], [60, 14]]) pts.push([out.lr.x - 20 + dx, out.lr.y + out.lr.height + dy]);
    const hits = await fr.evaluate((pts2) => {
      const v = window.__dollhouseView; const { camera, scene, renderer } = v;
      const rect = renderer.domElement.getBoundingClientRect();
      const THREE_R = window.__THREE_RAY;
      return pts2.map(([x, y]) => {
        const ndc = { x: ((x - rect.left) / rect.width) * 2 - 1, y: -((y - rect.top) / rect.height) * 2 + 1 };
        const o = camera.position.clone(); const d = camera.position.clone().set(ndc.x, ndc.y, 0.5).unproject(camera).sub(o).normalize();
        // plane y = 0 (the floor): t = -o.y / d.y
        const t = -o.y / d.y; const P = o.clone().addScaledVector(d, t);
        return { x, y, world: [+P.x.toFixed(3), +P.z.toFixed(3)] };
      });
    }, pts);
    const pos = await fr.evaluate(() => { const g = window.__dollhouseView.scene.children.find((c) => c.isGroup || (c.children && c.children.some((k) => k.isMesh || k.isGroup)) && !c.isLight); return g ? g.position.toArray() : null; });
    const blender = hits.map((h) => [+(h.world[0] - pos[0]).toFixed(3), +(-(h.world[1] - pos[2])).toFixed(3)]);
    console.log(JSON.stringify({ hits, modelPos: pos, blender }, null, 0));
  } finally { await b.close(); srv.kill(); }
})();

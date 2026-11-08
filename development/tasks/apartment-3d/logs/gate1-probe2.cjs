// Gate 1 follow-up probe: (a) which Top label is dropped on Pixel 7 embedded; (b) auto-rotation timeline on a fresh open;
// (c) the orbit margin at the tight azimuth with a long convergence wait, measured on the canvas alpha too.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = 'C:/RnD/.wt/apartment-3d/after/phase1/gate1';
const BASE = 'http://127.0.0.1:8851';
const lines = [];
const log = (m) => { lines.push(m); console.log(m); };
const ALPHA = () => {
  const v = window.__dollhouseView; v.renderer.render(v.scene, v.camera);
  const c = v.renderer.domElement; const k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
  const g = k.getContext('2d'); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, k.width, k.height).data;
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (let y = 0; y < k.height; y += 2) for (let x = 0; x < k.width; x += 2) if (d[(y * k.width + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0: x0 / k.width, x1: x1 / k.width, y0: y0 / k.height, y1: y1 / k.height };
};
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const [name, opts] of [['pixel7', devices['Pixel 7']], ['iphone13', devices['iPhone 13']], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
      const ctx = await b.newContext(opts);
      await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
      const p = await ctx.newPage();
      await p.goto(BASE + '/apartment.html?project=rainbow&unit=846&tab=3d', { waitUntil: 'load' });
      const fh = await p.$('#dollFrame'); const fr = await fh.contentFrame();
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      // (b) timeline
      const tl = [];
      for (let i = 0; i < 8; i++) { tl.push(await fr.evaluate(() => { const s = window.__dollhouse; return `f${s.frames}/az${s.view.azimuthDeg}/auto${s.autoRotate}`; })); await p.waitForTimeout(1000); }
      log(`${name} fresh-open timeline: ${tl.join('  ')}`);
      // (a) labels in Top
      await fr.evaluate(() => window.__dollhouseView.setPreset('top', { animate: false })); await p.waitForTimeout(1500);
      const L = await fr.evaluate(() => ({ vis: window.__dollhouse.labelsVisible, hidden: window.__dollhouse.rooms.filter((r) => !r.label).map((r) => r.id + ' ' + r.he), w: innerWidth, h: innerHeight }));
      log(`${name} top labels: ${JSON.stringify(L)}`);
      await p.screenshot({ path: `${OUT}/${name}_emb_top_labels2.png` });
      // (c) orbit at the worst azimuth, long wait
      await fr.evaluate(() => window.__dollhouseView.setPreset('3d', { animate: false })); await p.waitForTimeout(500);
      for (const a of [-150, 30, 150]) {
        await fr.evaluate((a) => { const v = window.__dollhouseView; const t = window.__dollhouse.target; const dy = v.camera.position.y - t[1]; const dx = v.camera.position.x - t[0], dz = v.camera.position.z - t[2]; const r = Math.hypot(dx, dz); const rad = a * Math.PI / 180; v.camera.position.set(t[0] + Math.sin(rad) * r, t[1] + dy, t[2] + Math.cos(rad) * r); v.camera.lookAt(t[0], t[1], t[2]); }, a);
        const m = [];
        for (let i = 0; i < 4; i++) { await p.waitForTimeout(1500); const al = await fr.evaluate(ALPHA); const v = await fr.evaluate(() => window.__dollhouse.view); m.push(`d${v.distance} az${v.azimuthDeg} x${al.x0.toFixed(3)}..${al.x1.toFixed(3)} y${al.y0.toFixed(3)}..${al.y1.toFixed(3)}`); }
        log(`${name} orbit start az ${a}: ${m.join(' | ')}`);
      }
      await ctx.close();
    }
  } catch (e) { log('ERROR ' + e.stack); } finally { await b.close(); srv.kill(); }
  fs.writeFileSync(path.join(__dirname, 'gate1-probe2.txt'), lines.join('\n') + '\n');
})();

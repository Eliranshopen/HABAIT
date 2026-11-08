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
    for (const [name, opts] of [['pixel7', devices['Pixel 7']], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
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
      // (c) orbit with autoRotate ON (fresh open state): drive azimuth, wait for the distance to settle, alpha bbox
      await p.goto(BASE + '/apartment.html?project=rainbow&unit=846&tab=3d', { waitUntil: 'load' });
      const fr2 = await (await p.$('#dollFrame')).contentFrame();
      await fr2.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      for (const a of [-150, -90, 0, 90, 150, 180]) {
        await fr2.evaluate((a) => { const v = window.__dollhouseView; const t = window.__dollhouse.target; const dy = v.camera.position.y - t[1]; const dx = v.camera.position.x - t[0], dz = v.camera.position.z - t[2]; const r = Math.hypot(dx, dz); const rad = a * Math.PI / 180; v.camera.position.set(t[0] + Math.sin(rad) * r, t[1] + dy, t[2] + Math.cos(rad) * r); v.camera.lookAt(t[0], t[1], t[2]); }, a);
        let last = -1, same = 0, d = 0;
        for (let i = 0; i < 40 && same < 3; i++) { await p.waitForTimeout(1000); d = (await fr2.evaluate(() => window.__dollhouse.view)).distance; if (Math.abs(d - last) < 0.005) same++; else same = 0; last = d; }
        const al = await fr2.evaluate(ALPHA); const v = await fr2.evaluate(() => ({ v: window.__dollhouse.view, auto: window.__dollhouse.autoRotate }));
        const mg = Math.min(al.x0, 1 - al.x1, al.y0, 1 - al.y1);
        log(`${name} orbit az ${a} (now ${v.v.azimuthDeg}, auto ${v.auto}) settled d=${d} alpha x${al.x0.toFixed(3)}..${al.x1.toFixed(3)} y${al.y0.toFixed(3)}..${al.y1.toFixed(3)} min margin ${mg.toFixed(3)} ${mg < 0.003 ? 'CLIPPED' : ''}`);
      }
      await ctx.close();
    }
  } catch (e) { log('ERROR ' + e.stack); } finally { await b.close(); srv.kill(); }
  fs.writeFileSync(path.join(__dirname, 'gate1-probe3.txt'), lines.join('\n') + '\n');
})();

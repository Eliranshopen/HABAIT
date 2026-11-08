// Card 05 glass probe: renders the glass alone exactly like check-05's STRIPES and prints the worst row's alpha and
// luminance across its 40 px window, plus a crop of the glass-alone frame. Desktop 1440x900, outdoor + 3d presets.
const { spawn } = require('child_process');
const fs = require('fs');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = 'C:/RnD/.wt/apartment-3d/after/phase1';
const DH = 'http://127.0.0.1:8851/_local/dist/rainbow/846/media/dollhouse.html';
const PROBE = () => {
  const v = window.__dollhouseView; const { scene, camera, renderer } = v; const hidden = [];
  scene.traverse((o) => { if (!(o.isMesh || o.isLine || o.isLineSegments)) return; const g = o.isMesh && [].concat(o.material).some((m) => m && m.name === 'glass'); if (!g && o.visible) { o.visible = false; hidden.push(o); } });
  renderer.render(scene, camera);
  const c = renderer.domElement; const k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
  const g = k.getContext('2d'); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, k.width, k.height).data;
  const url = c.toDataURL('image/png');
  for (const o of hidden) o.visible = true; renderer.render(scene, camera);
  const n = 40; let worst = { t: -1 };
  for (let y = 0; y < k.height; y += 3) {
    let run = 0; let best = null;
    for (let x = 0; x < k.width; x++) { const a = d[(y * k.width + x) * 4 + 3]; if (a > 6) { run++; if (run >= n && (!best || run > best.len)) best = { end: x, len: run }; } else run = 0; }
    if (!best) continue;
    const x0 = best.end - Math.floor(best.len / 2) - Math.floor(n / 2);
    let t = 0; let ref = null; let dir = 0; const L = []; const A = [];
    for (let x = x0; x < x0 + n; x++) { const i = (y * k.width + x) * 4; const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; L.push(Math.round(l)); A.push(d[i + 3]); if (ref === null) { ref = l; continue; } const dd = l - ref; if (Math.abs(dd) > 18) { const s = Math.sign(dd); if (s !== dir) { t++; dir = s; } ref = l; } }
    if (t > worst.t) worst = { t, y, x0, L, A };
  }
  return { worst, url };
};
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await p.goto(DH, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
    for (const preset of ['outdoor', '3d']) {
      await p.evaluate((id) => window.__dollhouseView.setPreset(id, { animate: false }), preset);
      await p.waitForTimeout(1500);
      const r = await p.evaluate(PROBE);
      fs.writeFileSync(`${OUT}/probe_glass_${preset}.png`, Buffer.from(r.url.split(',')[1], 'base64'));
      console.log(preset, 'worst', r.worst.t, 'row', r.worst.y, 'x0', r.worst.x0, '\n L', r.worst.L.join(' '), '\n A', r.worst.A.join(' '));
    }
  } finally { await b.close(); srv.kill(); }
})();

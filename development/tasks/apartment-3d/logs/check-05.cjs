// Card 05 acceptance: the look pass. Screenshots at the 3 presets (desktop 1440x900 + iPhone 13), named like the research
// folder's current/*.png; model coverage of the frame; a stripe probe over the terrace glass; render-on-demand idle;
// labels in Top; the embedded page on a phone. Serves the WORK-TREE platform on :8851 and kills it by PID.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = 'C:/RnD/.wt/apartment-3d/after/phase1';
const BASE = 'http://127.0.0.1:8851';
const DH = BASE + '/_local/dist/rainbow/846/media/dollhouse.html';
fs.mkdirSync(OUT, { recursive: true });
const res = { ok: [], fail: [], info: [] };
const check = (cond, msg) => (cond ? res.ok : res.fail).push(msg);

// in-page: the model's opaque bbox on the canvas (alpha > 0.5: ignores the soft ground shadow and the glass)
const COVER = () => {
  const c = window.__dollhouseView.renderer.domElement;
  const k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
  const g = k.getContext('2d'); g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, k.width, k.height).data;
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (let y = 0; y < k.height; y += 2) for (let x = 0; x < k.width; x += 2) if (d[(y * k.width + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { w: (x1 - x0) / k.width, h: (y1 - y0) / k.height, x0: x0 / k.width, x1: x1 / k.width, y0: y0 / k.height, y1: y1 / k.height };
};
// in-page: render the glass ALONE (everything else hidden, transparent clear) and scan it: for every pixel row of the glass
// with >= 40 css px of glass, count luminance flips (> 18 steps) across a 40 px window in its middle. Stripes = many flips.
const STRIPES = () => {
  const v = window.__dollhouseView; const { scene, camera, renderer } = v;
  const hidden = [];
  scene.traverse((o) => {
    if (!(o.isMesh || o.isLine || o.isLineSegments)) return;
    const glass = o.isMesh && [].concat(o.material).some((m) => m && m.name === 'glass');
    if (!glass && o.visible) { o.visible = false; hidden.push(o); }
  });
  renderer.render(scene, camera);
  const c = renderer.domElement; const dpr = c.width / c.clientWidth;
  const k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
  const g = k.getContext('2d'); g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, k.width, k.height).data;
  for (const o of hidden) o.visible = true;
  renderer.render(scene, camera);
  const n = Math.round(40 * dpr);
  let rows = 0; let worst = 0; let glassPx = 0;
  for (let y = 0; y < k.height; y += 3) {
    let run = 0; let best = null;
    for (let x = 0; x < k.width; x++) {
      const a = d[(y * k.width + x) * 4 + 3];
      if (a > 6) { run++; glassPx++; if (run >= n && (!best || run > best.len)) best = { end: x, len: run }; } else run = 0;
    }
    if (!best) continue;
    rows++;
    const x0 = best.end - Math.floor(best.len / 2) - Math.floor(n / 2);
    let t = 0; let ref = null; let dir = 0;
    for (let x = x0; x < x0 + n; x++) {
      const i = (y * k.width + x) * 4; const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (ref === null) { ref = l; continue; }
      const dd = l - ref; if (Math.abs(dd) > 18) { const s = Math.sign(dd); if (s !== dir) { t++; dir = s; } ref = l; }
    }
    worst = Math.max(worst, t);
  }
  return { rows, worst, glassPx };
};

(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', devices['iPhone 13']]]) {
      const ctx = await b.newContext(opts);
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(DH, { waitUntil: 'load' });
      await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      const t = await p.evaluate(() => ({ prepare: window.__dollhouse.prepare_ms, first: window.__dollhouse.first_frame_ms }));
      res.info.push(`${name}: prepare ${t.prepare} ms, first frame ${t.first} ms`);
      for (const preset of ['3d', 'top', 'outdoor']) {
        await p.evaluate((id) => window.__dollhouseView.setPreset(id, { animate: false }), preset);
        await p.evaluate((id) => window.__dollhouseView.setPreset(id, { animate: false }), preset);
        await p.waitForTimeout(1400);
        await p.screenshot({ path: `${OUT}/${name}_preset_${preset}.png` });
        const cv = await p.evaluate(COVER);
        res.info.push(`${name} ${preset}: model covers ${(cv.w * 100).toFixed(0)}% w x ${(cv.h * 100).toFixed(0)}% h (x ${cv.x0.toFixed(2)}..${cv.x1.toFixed(2)}, y ${cv.y0.toFixed(2)}..${cv.y1.toFixed(2)})`);
        if (preset === '3d') check(cv.w >= 0.7, `${name}: 3D preset model covers ${(cv.w * 100).toFixed(0)}% of the width (>= 70%)`);
        check(cv.x0 > 0.005 && cv.x1 < 0.995 && cv.y0 > 0.005 && cv.y1 < 0.995, `${name} ${preset}: model fully inside the frame`);
        if (preset === 'top') {
          const lv = await p.evaluate(() => window.__dollhouse.labelsVisible);
          check(lv === 11, `${name}: Top shows ${lv}/11 room labels`);
        }
        if (preset === 'outdoor' || preset === '3d') {
          const st = await p.evaluate(STRIPES);
          check(st.rows > 0 && st.worst <= 2, `${name} ${preset}: glass alone, ${st.rows} rows scanned, worst ${st.worst} transitions in 40 px (<= 2)`);
        }
      }
      // idle: auto-rotate off, nothing moving -> no new frames
      await p.evaluate(() => window.__dollhouseView.setPreset('3d', { animate: false }));
      await p.waitForTimeout(3000);
      const f0 = await p.evaluate(() => window.__dollhouse.frames);
      await p.waitForTimeout(2000);
      const f1 = await p.evaluate(() => window.__dollhouse.frames);
      check(f1 === f0, `${name}: idle 2 s after settling -> ${f1 - f0} new frames (render on demand)`);
      // auto-rotation still runs on a fresh open
      await p.goto(DH, { waitUntil: 'load' });
      await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      const a0 = await p.evaluate(() => window.__dollhouse.frames); await p.waitForTimeout(1500);
      const a1 = await p.evaluate(() => ({ f: window.__dollhouse.frames, rot: window.__dollhouse.autoRotate, op: getComputedStyle(window.__dollhouseView.renderer.domElement).opacity }));
      check(a1.rot && a1.f > a0 + 1, `${name}: fresh open auto-rotates and keeps rendering (${a1.f - a0} frames in 1.5 s, headless swiftshader)`);
      check(+a1.op > 0.99, `${name}: canvas faded in (opacity ${a1.op})`);
      check(errs.length === 0, `${name}: no page errors ${errs.join(' | ')}`);
      await ctx.close();
    }
    // the embedded page on a phone: the tab as a buyer sees it
    const ctx = await b.newContext(devices['iPhone 13']);
    await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
    const p = await ctx.newPage();
    await p.goto(BASE + '/apartment.html?project=rainbow&unit=846&tab=3d', { waitUntil: 'load' });
    const fr = await (await p.$('#dollFrame')).contentFrame();
    await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/phone_3d_page.png` });
    const d = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await d.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
    const q = await d.newPage();
    await q.goto(BASE + '/apartment.html?project=rainbow&unit=846&tab=3d', { waitUntil: 'load' });
    const fq = await (await q.$('#dollFrame')).contentFrame();
    await fq.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
    await q.waitForTimeout(1500);
    await q.screenshot({ path: `${OUT}/desktop_3d_page.png` });
  } catch (e) {
    res.fail.push('ERROR ' + e.message);
  } finally {
    await b.close();
    srv.kill();
  }
  const txt = `card 05 check ${new Date().toISOString()}\nPASS ${res.ok.length} · FAIL ${res.fail.length}\n` + res.fail.map((x) => 'FAIL ' + x).join('\n') + '\n' + res.ok.map((x) => 'ok   ' + x).join('\n') + '\n' + res.info.map((x) => 'info ' + x).join('\n') + '\n';
  fs.writeFileSync(path.join(__dirname, 'check-05.txt'), txt);
  console.log(txt);
  process.exit(res.fail.length ? 1 : 0);
})();

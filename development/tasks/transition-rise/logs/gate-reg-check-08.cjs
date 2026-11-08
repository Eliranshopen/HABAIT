// Card 08 acceptance: the viewer wears the baked light. Desktop 1440x900 + iPhone 13: the lightmap is applied, the 3
// presets x 3 floors are captured to after/phase2/, the floor switch still changes the floor colour (pixel probe on the
// living-room floor), no page errors. Size + fallback + CPUx4 open time are measured by the shell steps around it.
// Serves the WORK-TREE platform on :8851 and kills it by PID.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/transition-rise/run/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = 'C:/RnD/development/tasks/transition-rise/logs/gate-regframes';
const DH = 'http://127.0.0.1:8851/_local/dist/rainbow/846/media/dollhouse.html';
fs.mkdirSync(OUT, { recursive: true });
const res = { ok: [], fail: [], info: [] };
const check = (cond, msg) => (cond ? res.ok : res.fail).push(msg);
// in-page: the canvas colour (sRGB bytes, 5x5 mean) at the living-room floor centre
const FLOORPX = () => {
  const v = window.__dollhouseView; const st = window.__dollhouse;
  const r = st.rooms.find((x) => x.id === 'r-living');
  const THREE_V = v.camera.position.constructor;
  const p = new THREE_V(r.centre[0], 0.01, r.centre[2]).project(v.camera);
  v.renderer.render(v.scene, v.camera);
  const c = v.renderer.domElement;
  const k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
  const g = k.getContext('2d'); g.drawImage(c, 0, 0);
  const x = Math.round((p.x * 0.5 + 0.5) * c.width); const y = Math.round((-p.y * 0.5 + 0.5) * c.height);
  const d = g.getImageData(x - 2, y - 2, 5, 5).data;
  const m = [0, 0, 0]; for (let i = 0; i < 25; i++) for (let j = 0; j < 3; j++) m[j] += d[i * 4 + j] / 25;
  return m.map((q) => Math.round(q));
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
      const lm = await p.evaluate(() => window.__dollhouse.lightmap);
      check(lm && lm.materials > 5, `${name}: baked light applied (${lm ? `${lm.materials} materials, ${lm.px} px atlas, scale ${lm.scale}` : 'none'})`);
      res.info.push(`${name}: prepare ${await p.evaluate(() => window.__dollhouse.prepare_ms)} ms, first frame ${await p.evaluate(() => window.__dollhouse.first_frame_ms)} ms`);
      const floors = await p.evaluate(() => Object.keys(JSON.parse(document.getElementById('floors').textContent).floors || {}));
      check(floors.length === 3, `${name}: 3 floors (${floors.join(', ')})`);
      const px = {};
      for (const preset of ['3d', 'top', 'outdoor']) {
        for (const fl of floors) {
          await p.evaluate(([id, f]) => { window.__dollhouseView.setFloor(f); window.__dollhouseView.setPreset(id, { animate: false }); window.__dollhouseView.setPreset(id, { animate: false }); }, [preset, fl]);
          await p.waitForTimeout(900);
          await p.screenshot({ path: `${OUT}/${name}_preset_${preset}_${fl}.png` });
          if (preset === 'top') px[fl] = await p.evaluate(FLOORPX);
        }
      }
      res.info.push(`${name}: living floor px (Top) ${JSON.stringify(px)}`);
      const vals = Object.values(px);
      const dist = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
      let minD = 1e9; for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) minD = Math.min(minD, dist(vals[i], vals[j]));
      check(vals.length === 3 && minD > 12, `${name}: the floor switch changes the floor colour (min pairwise distance ${minD.toFixed(1)} > 12)`);
      check(errs.length === 0, `${name}: no page errors ${errs.join(' | ')}`);
      await ctx.close();
    }
  } catch (e) {
    res.fail.push('ERROR ' + e.message);
  } finally {
    await b.close();
    srv.kill();
  }
  const txt = `card 08 check ${new Date().toISOString()}\nPASS ${res.ok.length} · FAIL ${res.fail.length}\n` + res.fail.map((x) => 'FAIL ' + x).join('\n') + '\n' + res.ok.map((x) => 'ok   ' + x).join('\n') + '\n' + res.info.map((x) => 'info ' + x).join('\n') + '\n';
  fs.writeFileSync(path.join(__dirname, 'gate-check-08.txt'), txt);
  console.log(txt);
  process.exit(res.fail.length ? 1 : 0);
})();

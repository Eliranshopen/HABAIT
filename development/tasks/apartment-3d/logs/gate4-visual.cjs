// gate 3 visual/behaviour probe (qa-reviewer, fresh). Work-tree platform on :8851, killed by PID. Writes frames to
// C:/RnD/.wt/apartment-3d/after/gate4/ and prints JSON facts.
const { spawn } = require('child_process'); const fs = require('fs');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = 'C:/RnD/.wt/apartment-3d/after/gate4/'; fs.mkdirSync(OUT, { recursive: true });
const DEVS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  desktop2x: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  iphone13: devices['iPhone 13'], pixel7: devices['Pixel 7'],
};
const only = process.argv[2] ? process.argv[2].split(',') : Object.keys(DEVS);
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const facts = {};
  try {
    for (const name of only) {
      const ctx = await b.newContext(DEVS[name]);
      await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
      await p.goto('http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846&tab=3d', { waitUntil: 'load' });
      const fr = await (await p.$('#dollFrame')).contentFrame();
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      const f = {};
      f.mats = await fr.evaluate(() => {
        const v = window.__dollhouseView; const out = {};
        v.scene.traverse((o) => {
          if (!o.isMesh) return;
          for (const m of [].concat(o.material)) {
            const k = m.name || '(noname)'; const e = out[k] || (out[k] = { meshes: 0, map: 0, uv1: 0, color: m.color.toArray().map((x) => +x.toFixed(3)) });
            e.meshes++; if (m.map) e.map++; if (o.geometry.attributes.uv1) e.uv1++;
          }
        });
        return out;
      });
      f.floorTexture = await fr.evaluate(() => window.__dollhouse.floorTexture);
      f.floorState = await fr.evaluate(() => ({ floor: window.__dollhouse.floor, color: window.__dollhouse.floorColor }));
      // race: concrete (not yet decoded? decode order) then immediately parquet
      const race = await fr.evaluate(async () => {
        const v = window.__dollhouseView; const st = window.__dollhouse; const r = [];
        for (let i = 0; i < 1; i++) {
          v.setFloor('concrete'); v.setFloor('parquet');
          await new Promise((q) => setTimeout(q, 800));
          r.push({ floor: st.floor, texCurrent: st.floorTexture.current });
        }
        return r;
      });
      const shots = {};
      for (const fl of ['parquet', 'concrete', 'marble']) {
        for (const pre of ['3d', 'top', 'outdoor']) {
          await fr.evaluate(([a, c]) => { const v = window.__dollhouseView; v.setFloor(a); v.setPreset(c, { animate: false }); v.setPreset(c, { animate: false }); }, [fl, pre]);
          await p.waitForTimeout(name === 'desktop2x' ? 3500 : 2500);
          await p.screenshot({ path: `${OUT}${name}_${pre}_${fl}.png` });
        }
        const px = await fr.evaluate(() => { const v = window.__dollhouseView; v.setPreset('top', { animate: false }); v.setPreset('top', { animate: false }); return window.__dollhouse.floorTexture.current; });
        shots[fl] = px;
      }
      f.currentAfterSwitch = shots;
      f.race = race; f.errs = errs;
      facts[name] = f;
      await ctx.close();
    }
  } finally { await b.close(); srv.kill(); }
  console.log(JSON.stringify(facts, null, 1));
  fs.writeFileSync(__dirname + '/gate4-visual-' + only.join('-') + '.json', JSON.stringify(facts, null, 1));
})();

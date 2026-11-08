// Card 05 diagnosis probe (desktop 1440x900): why frames keep coming when idle, what the glass looks like alone, and the
// overlay insets (preset bar bottom, caption top). Serves the WORK-TREE platform on :8851 and kills it by PID.
const { spawn } = require('child_process');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = 'C:/RnD/.wt/apartment-3d/after/phase1';
const DH = 'http://127.0.0.1:8851/_local/dist/rainbow/846/media/dollhouse.html';
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const vp of [{ width: 1440, height: 900 }]) {
      const p = await (await b.newContext({ viewport: vp })).newPage();
      await p.goto(DH, { waitUntil: 'load' });
      await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      await p.evaluate(() => {
        window.__why = [];
        const v = window.__dollhouseView;
        new ResizeObserver(() => window.__why.push('resize ' + document.getElementById('v').clientWidth + 'x' + document.getElementById('v').clientHeight)).observe(document.getElementById('v'));
        const r0 = v.renderer.render.bind(v.renderer);
        v.renderer.render = (s, c) => { window.__why.push('render ' + performance.now().toFixed(0) + ' anim=' + window.__dollhouse.animating + ' auto=' + window.__dollhouse.autoRotate); return r0(s, c); };
      });
      await p.evaluate(() => window.__dollhouseView.setPreset('3d', { animate: false }));
      await p.waitForTimeout(3000);
      const w0 = await p.evaluate(() => window.__why.length);
      await p.waitForTimeout(2000);
      console.log('idle log', JSON.stringify(await p.evaluate((n) => window.__why.slice(n), w0)));
      console.log('insets', JSON.stringify(await p.evaluate(() => {
        const ui = document.getElementById('ui').getBoundingClientRect();
        const bar = document.querySelector('.dh-presets').getBoundingClientRect();
        const cap = document.querySelector('.cap').getBoundingClientRect();
        return { h: innerHeight, uiBottom: ui.bottom, barBottom: bar.bottom, capTop: cap.top, size: window.__dollhouse.size, tri: window.__dollhouse.triangles };
      })));
      // glass alone, saved
      const shot = await p.evaluate(() => {
        const v = window.__dollhouseView; const { scene, camera, renderer } = v; const hidden = [];
        scene.traverse((o) => { if (!(o.isMesh || o.isLine || o.isLineSegments)) return; const g = o.isMesh && [].concat(o.material).some((m) => m && m.name === 'glass'); if (!g && o.visible) { o.visible = false; hidden.push(o); } });
        renderer.setClearColor(0xffffff, 1); renderer.render(scene, camera);
        const url = renderer.domElement.toDataURL('image/png');
        for (const o of hidden) o.visible = true; renderer.setClearColor(0x000000, 0); renderer.render(scene, camera);
        const gl = []; scene.traverse((o) => { if (o.isMesh && [].concat(o.material).some((m) => m && m.name === 'glass')) { const m = [].concat(o.material).find((x) => x.name === 'glass'); gl.push({ name: o.name, side: m.side, opacity: +m.opacity.toFixed(2), color: m.color.getHexString(), tri: (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 }); } });
        return { url, gl };
      });
      require('fs').writeFileSync(OUT + '/probe_glass_alone_desktop.png', Buffer.from(shot.url.split(',')[1], 'base64'));
      console.log('glass meshes', JSON.stringify(shot.gl));
    }
  } finally { await b.close(); srv.kill(); }
})();

// qa gate probe 1: marker direction/position per interior scene, exterior hides, open/close churn, keyboard, RTL, phone, floor.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const ROOT = 'C:/RnD/.wt/dollhouse-in-tour/run/tourout/apt846';
const OUT = __dirname;
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.vtt': 'text/vtt' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(path.normalize(ROOT)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const out = [];
const log = (ok, m) => { out.push((ok === null ? 'info ' : ok ? 'ok   ' : 'FAIL ') + m); };
const wrap = (b) => ((b % 360) + 360) % 360;
const angDiff = (a, b) => { const d = wrap(a - b); return d > 180 ? 360 - d : d; };
const scenes = JSON.parse(fs.readFileSync(APT + '/scenes.json', 'utf8')).scenes;
const cams = JSON.parse(fs.readFileSync(APT + '/cameras.json', 'utf8'));
const camById = {}; for (const c of cams.scenes) camById[c.id] = c;
const ppc = cams.plan.pxPerCm;
const WEDGE_JS = () => {
  const v = window.__dollhouseView; let res = null;
  v.scene.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry' && o.geometry.parameters && o.geometry.parameters.radius === 2.4) {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements; const pos = o.geometry.attributes.position; let sx = 0, sz = 0, n = 0;
      for (let i = 1; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const wx = e[0] * x + e[4] * y + e[8] * z, wz = e[2] * x + e[6] * y + e[10] * z; const L = Math.hypot(wx, wz) || 1; sx += wx / L; sz += wz / L; n++; }
      const ang = (Math.atan2(sx, -sz) * 180) / Math.PI; // bearing: 0 = -z (plan up), clockwise
      res = { wedgeBearing: ((ang % 360) + 360) % 360, parent: { x: o.parent.position.x, z: o.parent.position.z }, vis: o.visible };
    }
  });
  return res;
};
(async () => {
  await new Promise((r) => srv.listen(8851, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
    const c = ctx;
    await p.goto('http://127.0.0.1:8851/index.html?room=kitchen&video=0', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 }); await p.waitForTimeout(600);
    await p.evaluate(() => document.getElementById('t-3d-btn').click());
    let fr = await (await p.waitForSelector('#t-3d-frame', { state: 'attached' })).contentFrame();
    await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 }); await p.waitForTimeout(500);
    const f0 = await fr.evaluate(() => window.__dollhouse.floor);
    await p.evaluate(() => document.getElementById('t-3d-close').click());
    const btn = await p.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'שיש'); bs.forEach((x, i) => x.dataset.qa = 'm' + i); return bs.map((x) => ({ i: x.dataset.qa, vis: x.getBoundingClientRect().width > 0 })); });
    log(null, 'marble buttons ' + JSON.stringify(btn) + ' floor before ' + f0);
    const target = btn.find((x) => x.vis) || btn[0];
    await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 60000 }).catch(() => {}), p.evaluate((i) => document.querySelector(`[data-qa="${i}"]`).click(), target.i)]);
    await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 }); await p.waitForTimeout(600);
    log(null, 'url after floor click: ' + p.url());
    await p.evaluate(() => document.getElementById('t-3d-btn').click());
    fr = await (await p.waitForSelector('#t-3d-frame', { state: 'attached' })).contentFrame();
    await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 }); await p.waitForTimeout(800);
    const f1 = await fr.evaluate(() => window.__dollhouse.floor); const h = await fr.evaluate(() => window.__dollhouse.here);
    const sc = await p.evaluate(() => window.__tour.scene);
    log(f1 === 'marble' && sc === 'kitchen' && h && h.room === 'r-kitchen', `live floor switch via the tour's own control: dollhouse floor ${f1}, scene ${sc}, marker ${JSON.stringify(h)}`);
    await fr.evaluate(() => parent.postMessage({ type: 'habait:enter-room', scene: 'kitchen' }, '*')); await p.waitForTimeout(300);
    log(await p.evaluate(() => document.getElementById('t-3d').hidden) && (await p.evaluate(() => window.__tour.scene)) === 'kitchen', 'enter-room for the current scene closes the layer, no reload');
    await p.evaluate(() => document.getElementById('t-3d-btn').click()); await p.waitForTimeout(300);
    await fr.evaluate(() => parent.postMessage({ type: 'habait:enter-room', scene: 'aerial' }, '*')); await p.waitForTimeout(1500);
    log(null, 'enter-room scene=aerial (exterior, in byId): tour scene now ' + (await p.evaluate(() => window.__tour.scene)) + ', layer hidden ' + (await p.evaluate(() => document.getElementById('t-3d').hidden)) + ', 3D button hidden ' + (await p.evaluate(() => document.getElementById('t-3d-btn').hidden)));
    await fr.evaluate(() => parent.postMessage({ type: 'habait:enter-room', scene: 'nonsense' }, '*')).catch(() => {});
    log(errs.length === 0, 'no page errors: ' + errs.join(' | '));
    await c.close();
  } catch (e) { out.push('FAIL ERROR ' + e.stack); }
  finally { await b.close(); srv.close(); }
  fs.writeFileSync(path.join(OUT, 'gate-probe3.txt'), out.join('\n') + '\n');
  console.log(out.join('\n'));
  process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})();

// Board transition-rise acceptance (desktop 1440x900 + iPhone 13 + Pixel 7), the test build served on :8851:
//  1 the dollhouse preloads hidden once the tour is idle; 2 the 3D button plays the RISE (motion, not the slow-device fallback:
//    __habaitMinFps = 0 on this GPU-less browser) and ends on the 3D preset; 3 the rise's first frame IS the tour's frame: the
//    deterministic transitionPreview(t = 0) vs the tour's own screenshot, mean |diff| of the central band; 4 "view in 360" DIVES
//    and the tour switches to that room under the layer, which closes; the dive's last frame vs the tour's arrival frame;
//    5 prefers-reduced-motion: no move. Writes check-rise.txt + frames/rise-*.png.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const sharp = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/sharp');
const ROOT = process.argv[2] || 'C:/RnD/.wt/transition-rise/run/tourout/apt846';
const OUT = path.join(__dirname, 'frames');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(path.normalize(ROOT)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const res = { ok: [], fail: [], info: [] };
const check = (c, m) => (c ? res.ok : res.fail).push(m);
// mean |diff| of the central band (x 30-70 %, y 35-65 %: clear of the tour's chrome) of two same-size screenshots, 0..255
async function bandDiff(a, b) {
  const meta = await sharp(a).metadata();
  const box = { left: Math.round(meta.width * 0.3), top: Math.round(meta.height * 0.35), width: Math.round(meta.width * 0.4), height: Math.round(meta.height * 0.3) };
  const [x, y] = await Promise.all([a, b].map((f) => sharp(f).extract(box).removeAlpha().raw().toBuffer()));
  let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]);
  return s / x.length;
}
(async () => {
  await new Promise((r) => srv.listen(8851, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone13', devices['iPhone 13']], ['pixel7', devices['Pixel 7']]]) {
      const ctx = await b.newContext(opts);
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', (e) => errs.push('tour: ' + e.message));
      await p.goto('https://habait-flow.vercel.app/tour/index.html?room=living&video=0&floor=parquet', { waitUntil: 'load' });
      await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
      await p.evaluate(() => { const v = window.__tour.viewer; v.stopAutoRotate && v.stopAutoRotate(); });
      // 1 preload
      await p.waitForFunction(() => (document.getElementById('t-3d-frame').getAttribute('src') || '').includes('#defer'), null, { timeout: 15000 });
      const fr = await (await p.$('#t-3d-frame')).contentFrame();
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.prepared, null, { timeout: 90000 });
      check(true, `${name}: the dollhouse preloads hidden (#defer) once the tour is idle`);
      await fr.evaluate(() => { window.__habaitMinFps = 0; });
      const tourShot = path.join(OUT, `rise-${name}-tour.png`);
      // the bare picture: the tour's chrome (shades, strip, buttons, hotspots) hidden for this screenshot only
      await p.evaluate(() => { for (const n of document.getElementById('t-root').children) if (n.id !== 'pano') { n.dataset.vis = n.style.visibility; n.style.visibility = 'hidden'; } for (const n of document.querySelectorAll('#pano .pnlm-ui, #pano .pnlm-hotspot-base, #pano .pnlm-controls-container')) n.style.visibility = 'hidden'; });
      await p.waitForTimeout(200);
      await p.screenshot({ path: tourShot });
      await p.evaluate(() => { for (const n of document.getElementById('t-root').children) if (n.id !== 'pano') n.style.visibility = n.dataset.vis || ''; for (const n of document.querySelectorAll('#pano .pnlm-ui, #pano .pnlm-hotspot-base, #pano .pnlm-controls-container')) n.style.visibility = ''; });
      // 2 the rise
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded && window.__dollhouse.transition && !window.__dollhouse.transition.running, null, { timeout: 120000 });
      const tr = await fr.evaluate(() => window.__dollhouse.transition);
      check(tr.kind === 'rise' && !tr.skipped && tr.frames > 2, `${name}: the 3D button plays the rise (${JSON.stringify(tr)})`);
      const end = await fr.evaluate(() => ({ preset: window.__dollhouse.preset, held: window.__dollhouse.held }));
      check(end.preset === '3d' && !end.held, `${name}: the rise ends on the 3D preset (${JSON.stringify(end)})`);
      check(await p.evaluate(() => document.getElementById('t-3d').style.opacity === ''), `${name}: the layer is revealed`);
      await p.screenshot({ path: path.join(OUT, `rise-${name}-end.png`) });
      // 3 the first frame of the rise vs the tour's frame
      const view = await p.evaluate(() => { const v = window.__tour.viewer; return { scene: window.__tour.scene, yaw: v.getYaw(), pitch: v.getPitch(), hfov: v.getHfov() }; });
      const t0 = await fr.evaluate(async (vw) => { const spec = window.__dollhouseSpecFor(vw.scene, { yaw: vw.yaw, pitch: vw.pitch, hfov: vw.hfov }); return window.__dollhouseView.transitionPreview(spec, 0); }, view);
      await p.waitForTimeout(300);
      const t0Shot = path.join(OUT, `rise-${name}-t0.png`);
      await p.screenshot({ path: t0Shot });
      const d0 = await bandDiff(tourShot, t0Shot);
      res.info.push(`${name}: t0 ${JSON.stringify(t0)} band |diff| ${d0.toFixed(1)}`);
      check(d0 < 22, `${name}: the rise starts on the tour's frame (central band mean |diff| ${d0.toFixed(1)} < 22 of 255)`);
      // the dollhouse's 3D preset vs that frame: a control — must be far apart, so the threshold above means something
      const dEnd = await bandDiff(tourShot, path.join(OUT, `rise-${name}-end.png`));
      check(dEnd > d0 * 1.8, `${name}: control: the 3D preset is far from the tour frame (${dEnd.toFixed(1)} vs ${d0.toFixed(1)})`);
      // back to a clean state for the dive (a tap on the model drops the preview's held room)
      await fr.evaluate(() => window.__dollhouseView.setPreset('3d', { animate: false }));
      { const fb = await (await p.$('#t-3d-frame')).boundingBox(); await p.mouse.click(fb.x + fb.width * 0.5, fb.y + fb.height * 0.85); await p.waitForTimeout(600); }
      // 4 the dive: kitchen
      await fr.evaluate(() => window.__dollhouseSelect('r-kitchen'));
      await fr.waitForTimeout(900);
      await fr.evaluate(() => document.querySelector('.dh-sheet .go').click());
      await fr.waitForFunction(() => window.__dollhouse.transition && window.__dollhouse.transition.kind === 'dive' && !window.__dollhouse.transition.running, null, { timeout: 60000 });
      const dv = await fr.evaluate(() => ({ t: window.__dollhouse.transition, held: window.__dollhouse.held }));
      check(dv.t.kind === 'dive' && !dv.t.skipped && dv.held, `${name}: "view in 360" dives into the room and holds its view (${JSON.stringify(dv)})`);
      await p.waitForFunction(() => window.__tour.scene === 'kitchen' && document.getElementById('t-3d').hidden, null, { timeout: 15000 }).catch(() => {});
      const arr = await p.evaluate(() => ({ scene: window.__tour.scene, hidden: document.getElementById('t-3d').hidden, yaw: window.__tour.viewer.getYaw(), hfov: window.__tour.viewer.getHfov() }));
      check(arr.scene === 'kitchen' && arr.hidden, `${name}: the tour switches to the kitchen under the layer, which closes (${JSON.stringify(arr)})`);
      await p.waitForTimeout(1200);
      const kitchenShot = path.join(OUT, `rise-${name}-kitchen-tour.png`);
      await p.evaluate(() => { for (const n of document.getElementById('t-root').children) if (n.id !== 'pano') { n.dataset.vis = n.style.visibility; n.style.visibility = 'hidden'; } for (const n of document.querySelectorAll('#pano .pnlm-ui, #pano .pnlm-hotspot-base, #pano .pnlm-controls-container')) n.style.visibility = 'hidden'; });
      await p.waitForTimeout(200);
      await p.screenshot({ path: kitchenShot });
      await p.evaluate(() => { for (const n of document.getElementById('t-root').children) if (n.id !== 'pano') n.style.visibility = n.dataset.vis || ''; for (const n of document.querySelectorAll('#pano .pnlm-ui, #pano .pnlm-hotspot-base, #pano .pnlm-controls-container')) n.style.visibility = ''; });
      // the dive's last frame vs the tour's arrival frame (deterministic preview at t = 0 with the room's opening view)
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await fr.waitForFunction(() => window.__dollhouse.transition && window.__dollhouse.transition.kind === 'rise' && !window.__dollhouse.transition.running, null, { timeout: 120000 });
      const kv = await p.evaluate(() => { const s = window.__tour; return { scene: s.scene, yaw: s.viewer.getYaw(), pitch: s.viewer.getPitch(), hfov: s.viewer.getHfov() }; });
      await fr.evaluate(async (vw) => window.__dollhouseView.transitionPreview(window.__dollhouseSpecFor(vw.scene, { yaw: vw.yaw, pitch: vw.pitch, hfov: vw.hfov }), 0), kv);
      await p.waitForTimeout(300);
      const kShot = path.join(OUT, `rise-${name}-kitchen-t0.png`);
      await p.screenshot({ path: kShot });
      const dk = await bandDiff(kitchenShot, kShot);
      check(dk < 22, `${name}: the kitchen's move frame matches the tour's kitchen frame (|diff| ${dk.toFixed(1)})`);
      check(errs.length === 0, `${name}: no page errors ${errs.join(' | ')}`);
      await ctx.close();
      // 4b the race: "view in 360" pressed while the rise is still loading its room -> the dive wins, the tour still moves
      { const c2 = await b.newContext(opts); const q2 = await c2.newPage();
        await q2.goto('https://habait-flow.vercel.app/tour/index.html?room=living&video=0', { waitUntil: 'load' });
        await q2.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
        await q2.evaluate(() => document.getElementById('t-3d-btn').click());
        const f2 = await (await q2.waitForSelector('#t-3d-frame')).contentFrame();
        await f2.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
        await f2.evaluate(() => { window.__dollhouseSelect('r-kitchen'); document.querySelector('.dh-sheet .go').click(); });
        await q2.waitForFunction(() => window.__tour.scene === 'kitchen' && document.getElementById('t-3d').hidden, null, { timeout: 20000 }).catch(() => {});
        const rr = await q2.evaluate(() => ({ scene: window.__tour.scene, hidden: document.getElementById('t-3d').hidden }));
        check(rr.scene === 'kitchen' && rr.hidden, `${name}: race: "view in 360" during the rise's load still moves the tour (${JSON.stringify(rr)})`);
        await c2.close(); }
      // 5 reduced motion
      const rctx = await b.newContext({ ...opts, reducedMotion: 'reduce' });
      const q = await rctx.newPage();
      await q.goto('https://habait-flow.vercel.app/tour/index.html?room=living&video=0', { waitUntil: 'load' });
      await q.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
      await q.waitForFunction(() => (document.getElementById('t-3d-frame').getAttribute('src') || '').includes('#defer'), null, { timeout: 15000 });
      const rf = await (await q.$('#t-3d-frame')).contentFrame();
      await rf.waitForFunction(() => window.__dollhouse && window.__dollhouse.prepared, null, { timeout: 90000 });
      await q.evaluate(() => document.getElementById('t-3d-btn').click());
      await rf.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded && window.__dollhouse.transition, null, { timeout: 120000 });
      const rt = await rf.evaluate(() => window.__dollhouse.transition);
      check(rt.skipped === 'reduced-motion', `${name}: prefers-reduced-motion skips the move (${JSON.stringify(rt)})`);
      await rctx.close();
    }
  } catch (e) {
    res.fail.push('ERROR ' + e.message);
  } finally {
    await b.close();
    srv.close();
  }
  const txt = `transition-rise check ${new Date().toISOString()}\nPASS ${res.ok.length} · FAIL ${res.fail.length}\n` + res.fail.map((x) => 'FAIL ' + x).join('\n') + '\n' + res.ok.map((x) => 'ok   ' + x).join('\n') + '\n' + res.info.map((x) => 'info ' + x).join('\n') + '\n';
  fs.writeFileSync(path.join(__dirname, 'check-rise.txt'), txt);
  console.log(txt);
  process.exit(res.fail.length ? 1 : 0);
})();

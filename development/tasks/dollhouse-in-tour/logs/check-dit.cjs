// Board dollhouse-in-tour acceptance: the 3D dollhouse inside the 360 tour. Serves the test build (run/tourout/apt846) over HTTP on
// :8851 (a tiny static server in this process), desktop 1440x900 + iPhone 13 + Pixel 7:
//  1 the 3D button shows in an interior room; 2 a click opens the layer and the dollhouse loads inside (same origin, no page error);
//  3 the "you are here" marker sits on the current room's camera point and its bearing follows the tour's yaw (turn the view ->
//    the marker's bearing changes by the same amount); 4 the floor finish follows the tour's; 5 a room's "view in 360" in the
//    dollhouse moves the tour to that scene and closes the layer; 6 Esc / the close button close it; 7 embedded with from=apartment
//    the button is hidden. Writes check-dit.txt + frames to logs/dit-*.png.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const ROOT = process.argv[2] || 'C:/RnD/.wt/dollhouse-in-tour/run/tourout/apt846';
const OUT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.vtt': 'text/vtt' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(path.normalize(ROOT)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const res = { ok: [], fail: [], info: [] };
const check = (c, m) => (c ? res.ok : res.fail).push(m);
const wrap = (b) => ((b % 360) + 360) % 360;
const angDiff = (a, b) => { const d = wrap(a - b); return d > 180 ? 360 - d : d; };
(async () => {
  await new Promise((r) => srv.listen(8851, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone13', devices['iPhone 13']], ['pixel7', devices['Pixel 7']]]) {
      const ctx = await b.newContext(opts);
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', (e) => errs.push('tour: ' + e.message));
      await p.goto('http://127.0.0.1:8851/index.html?room=living&video=0&floor=concrete', { waitUntil: 'load' });
      await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
      await p.waitForTimeout(800);
      const btnShown = await p.evaluate(() => { const b = document.getElementById('t-3d-btn'); return b && !b.hidden && b.getBoundingClientRect().width > 0; });
      check(btnShown, `${name}: the 3D button shows in the living room`);
      await p.evaluate(() => { try { window.__tour.viewer.stopAutoRotate && window.__tour.viewer.stopAutoRotate(); } catch (_) {} });
      // the button may sit behind the quiet chrome; click it through the DOM like a tap
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      const fr = await (await p.waitForSelector('#t-3d-frame', { state: 'attached' })).contentFrame();
      fr.on && fr.page().on('pageerror', () => {});
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      const layer = await p.evaluate(() => !document.getElementById('t-3d').hidden);
      check(layer, `${name}: the 3D layer opens with the dollhouse loaded`);
      await p.waitForTimeout(1200);
      const h1 = await fr.evaluate(() => window.__dollhouse.here);
      const tour1 = await p.evaluate(() => { const s = window.__tour; return { scene: s.scene, yaw: s.viewer.getYaw() }; });
      check(h1 && h1.room === 'r-living', `${name}: "you are here" on the living room's camera point (${JSON.stringify(h1)})`);
      const floor = await fr.evaluate(() => window.__dollhouse.floor);
      check(floor === 'concrete', `${name}: the dollhouse floor follows the tour (concrete): ${floor}`);
      await p.screenshot({ path: path.join(OUT, `dit-${name}-open.png`) });
      // turn the tour by +60 degrees (behind the layer): the marker's bearing turns the same
      await p.evaluate(() => { const v = window.__tour.viewer; v.setYaw(v.getYaw() + 60, false); });
      await p.waitForTimeout(900);
      const h2 = await fr.evaluate(() => window.__dollhouse.here);
      const turned = h1 && h2 ? angDiff(h2.bearingDeg, h1.bearingDeg) : -1;
      check(Math.abs(turned - 60) < 2, `${name}: the cone follows the view (tour +60 deg -> marker ${turned.toFixed(1)} deg)`);
      // Esc closes (focus in the tour document), the button reopens
      await p.keyboard.press('Escape');
      check(await p.evaluate(() => document.getElementById('t-3d').hidden), `${name}: Esc closes the layer`);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      check(await p.evaluate(() => !document.getElementById('t-3d').hidden), `${name}: the button reopens it (frame kept)`);
      // gate D1: a real tap inside the 3D moves focus into the frame; Esc must still close the layer (a first Esc may close a room
      // sheet the tap opened, the next closes the layer), and the tour behind is inert while the layer is open
      check(await p.evaluate(() => document.getElementById('t-tools').inert === true), `${name}: the tour behind the layer is inert`);
      const fbox = await (await p.$('#t-3d-frame')).boundingBox();
      await p.mouse.click(fbox.x + fbox.width / 2, fbox.y + fbox.height / 2);
      await p.waitForTimeout(700);
      check(await p.evaluate(() => document.activeElement && document.activeElement.id === 't-3d-frame'), `${name}: a real tap reaches the 3D (focus inside the frame)`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      if (!(await p.evaluate(() => document.getElementById('t-3d').hidden))) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
      check(await p.evaluate(() => document.getElementById('t-3d').hidden && document.getElementById('t-tools').inert !== true), `${name}: after a tap in the 3D, Esc closes the layer and the tour is live again`);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await p.waitForTimeout(500);
      // a room's "view in 360" in the dollhouse: select the kitchen, press its sheet button
      await fr.evaluate(() => window.__dollhouseSelect('r-kitchen'));
      await fr.waitForTimeout(900);
      await fr.evaluate(() => document.querySelector('.dh-sheet .go').click());
      await p.waitForFunction(() => window.__tour.scene === 'kitchen', null, { timeout: 15000 }).catch(() => {});
      const after = await p.evaluate(() => ({ scene: window.__tour.scene, layerHidden: document.getElementById('t-3d').hidden }));
      check(after.scene === 'kitchen' && after.layerHidden, `${name}: "view in 360" moves the tour to the kitchen and closes the layer (${JSON.stringify(after)})`);
      await p.waitForTimeout(1500);
      // the close button
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await p.waitForTimeout(800);
      const h3 = await fr.evaluate(() => window.__dollhouse.here);
      const sel3 = await fr.evaluate(() => window.__dollhouse.selected);
      check(sel3 === null, `${name}: reopened without the kitchen's 'view in 360' sheet (selected ${sel3})`);
      check(h3 && h3.room === 'r-kitchen', `${name}: reopened in the kitchen, the marker moved there (${h3 && h3.room})`);
      await p.screenshot({ path: path.join(OUT, `dit-${name}-kitchen.png`) });
      await p.evaluate(() => document.getElementById('t-3d-close').click());
      check(await p.evaluate(() => document.getElementById('t-3d').hidden), `${name}: the close button closes the layer`);
      check(errs.length === 0, `${name}: no page errors ${errs.join(' | ')}`);
      // embedded in the apartment page: hidden
      const q = await ctx.newPage();
      await q.goto('http://127.0.0.1:8851/index.html?room=living&video=0&from=apartment', { waitUntil: 'load' });
      await q.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 90000 });
      await q.waitForTimeout(600);
      check(await q.evaluate(() => document.getElementById('t-3d-btn').hidden), `${name}: from=apartment hides the 3D button`);
      await ctx.close();
    }
  } catch (e) {
    res.fail.push('ERROR ' + e.message);
  } finally {
    await b.close();
    srv.close();
  }
  const txt = `dollhouse-in-tour check ${new Date().toISOString()}\nPASS ${res.ok.length} · FAIL ${res.fail.length}\n` + res.fail.map((x) => 'FAIL ' + x).join('\n') + '\n' + res.ok.map((x) => 'ok   ' + x).join('\n') + '\n';
  fs.writeFileSync(path.join(OUT, 'check-dit.txt'), txt);
  console.log(txt);
  process.exit(res.fail.length ? 1 : 0);
})();

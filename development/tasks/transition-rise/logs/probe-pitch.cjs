// transition-rise: is the rise's first frame off by a constant pitch? Render transitionPreview(t = 0) at pitch offsets around the
// tour's pitch and measure the central-band difference to the tour's bare frame, desktop + iPhone 13 + Pixel 7. :8851, closed in finally.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const sharp = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/sharp');
const ROOT = 'C:/RnD/.wt/transition-rise/run/tourout/apt846';
const T = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(new URL(q.url, 'http://x').pathname); const p = path.join(ROOT, u === '/' ? 'index.html' : u); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
async function band(buf) { const m = await sharp(buf).metadata(); return sharp(buf).extract({ left: Math.round(m.width * 0.3), top: Math.round(m.height * 0.35), width: Math.round(m.width * 0.4), height: Math.round(m.height * 0.3) }).removeAlpha().raw().toBuffer(); }
const diff = (x, y) => { let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]); return s / x.length; };
(async () => {
  await new Promise((r) => srv.listen(8851, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  try {
    for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone13', devices['iPhone 13']], ['pixel7', devices['Pixel 7']]]) {
      const p = await (await b.newContext(opts)).newPage();
      await p.goto('http://127.0.0.1:8851/index.html?room=living&video=0&floor=parquet', { waitUntil: 'load' });
      await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
      await p.evaluate(() => { const v = window.__tour.viewer; v.stopAutoRotate && v.stopAutoRotate(); });
      await p.waitForFunction(() => (document.getElementById('t-3d-frame').getAttribute('src') || '').includes('#defer'), null, { timeout: 15000 });
      const fr = await (await p.$('#t-3d-frame')).contentFrame();
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.prepared, null, { timeout: 90000 });
      await p.evaluate(() => { for (const n of document.getElementById('t-root').children) if (n.id !== 'pano') n.style.visibility = 'hidden'; for (const n of document.querySelectorAll('#pano .pnlm-ui, #pano .pnlm-hotspot-base, #pano .pnlm-controls-container')) n.style.visibility = 'hidden'; });
      await p.waitForTimeout(300);
      const tour = await band(await p.screenshot());
      const view = await p.evaluate(() => { const v = window.__tour.viewer; return { scene: window.__tour.scene, yaw: v.getYaw(), pitch: v.getPitch(), hfov: v.getHfov(), vaov: v.getConfig().vaov, voffset: v.getConfig().vOffset }; });
      await p.evaluate(() => { for (const n of document.getElementById('t-root').children) n.style.visibility = ''; document.getElementById('t-3d-btn').click(); });
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded && window.__dollhouse.transition && !window.__dollhouse.transition.running, null, { timeout: 120000 });
      const rows = [];
      for (const dp of [-3, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3]) {
        await fr.evaluate(async ([vw, d]) => window.__dollhouseView.transitionPreview(window.__dollhouseSpecFor(vw.scene, { yaw: vw.yaw, pitch: vw.pitch + d, hfov: vw.hfov }), 0), [view, dp]);
        await p.waitForTimeout(150);
        rows.push([dp, +diff(tour, await band(await p.screenshot())).toFixed(1)]);
      }
      const best = rows.reduce((a, c) => (c[1] < a[1] ? c : a));
      out.push(`${name}: view ${JSON.stringify(view)} | pitch offset -> |diff| ${rows.map((r) => r.join(':')).join(' ')} | best ${best.join(':')}`);
    }
  } finally { await b.close(); srv.close(); }
  console.log(out.join('\n'));
  fs.writeFileSync(path.join(__dirname, 'probe-pitch.txt'), out.join('\n') + '\n');
})();

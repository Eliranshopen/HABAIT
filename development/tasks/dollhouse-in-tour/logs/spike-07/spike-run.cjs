// Board dollhouse-in-tour card 07 (option 3 spike): serve spike-rise.html (/plat = the test platform, /eng = its dollhouse outputs,
// /tour = the live apartment folder, read-only) on :8851 and capture the transition at fixed progress values on desktop and
// iPhone 13 -> frames/<dev>-t<t>.png; plus the tour's own living-room view (test tour build, yaw 0) for the hand-off comparison.
// One browser, the server closed in finally.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const MOUNTS = {
  '/plat/': 'C:/RnD/.wt/dollhouse-in-tour/run/Projects/Habait/habait-walkaround/Habait/platform/',
  '/eng/': 'C:/RnD/.wt/dollhouse-in-tour/run/Projects/Habait/habait-walkaround/Habait/engine/_local/apt846/dollhouse/',
  '/tour/': 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846/',
  '/tt/': 'C:/RnD/.wt/dollhouse-in-tour/run/tourout/apt846/',
  '/': __dirname + '/',
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const m = Object.keys(MOUNTS).sort((a, b) => b.length - a.length).find((k) => u.startsWith(k));
  const p = path.join(MOUNTS[m], u.slice(m.length) || 'index.html');
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const OUT = path.join(__dirname, process.argv[3] || 'frames');
fs.mkdirSync(OUT, { recursive: true });
const TS = [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1];
(async () => {
  await new Promise((r) => srv.listen(8851, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const log = [];
  try {
    for (const [dev, opts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['iphone13', devices['iPhone 13']]]) {
      const ctx = await b.newContext(opts);
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      await p.goto('http://127.0.0.1:8851/spike-rise.html' + (process.argv[2] || ''), { waitUntil: 'load' });
      await p.waitForFunction(() => window.__spike && window.__spike.ready, null, { timeout: 120000 });
      for (const t of TS) {
        const s = await p.evaluate((x) => window.__spike.at(x), t);
        await p.waitForTimeout(250);
        await p.screenshot({ path: path.join(OUT, `${dev}-t${String(t).replace('.', '')}.png`) });
        log.push(`${dev} ${JSON.stringify(s)}`);
      }
      // real-time play: measured frame rate under SwiftShader (a floor, not the phone's number)
      const fps = await p.evaluate(async () => { let n = 0; const c = () => { n++; if (on) requestAnimationFrame(c); }; let on = true; requestAnimationFrame(c); const t0 = performance.now(); await window.__spike.play(1600); on = false; return +(n / ((performance.now() - t0) / 1000)).toFixed(1); });
      log.push(`${dev} play 1600 ms: ~${fps} fps (headless SwiftShader)`);
      log.push(`${dev} errors: ${errs.length ? errs.join(' | ') : 'none'}`);
      // the tour's own view at the same point (yaw 0, its default hfov) — the hand-off frame to compare with t0
      const tp = await ctx.newPage();
      await tp.goto('http://127.0.0.1:8851/tt/index.html?room=living&video=0&floor=parquet', { waitUntil: 'load' });
      await tp.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
      await tp.evaluate(() => { const v = window.__tour.viewer; v.stopAutoRotate && v.stopAutoRotate(); v.lookAt(-2, 0, 100, false); });
      await tp.waitForTimeout(1500);
      await tp.screenshot({ path: path.join(OUT, `${dev}-tour-view.png`) });
      await ctx.close();
    }
  } catch (e) {
    log.push('ERROR ' + e.message);
  } finally {
    await b.close();
    srv.close();
  }
  fs.writeFileSync(path.join(__dirname, (process.argv[3] || 'frames') + '-run.txt'), log.join('\n') + '\n');
  console.log(log.join('\n'));
})();

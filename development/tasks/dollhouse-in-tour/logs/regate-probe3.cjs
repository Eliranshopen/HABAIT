// regate probe 3: does touch-action pan-y itself stop a horizontal one-finger orbit (top-level dollhouse page, fresh load per case)?
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const ROOT = 'C:/RnD/.wt/dollhouse-in-tour/run/tourout/apt846';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(new URL(q.url, 'http://x').pathname); const p = path.join(ROOT, u === '/' ? 'index.html' : u); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; } const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.woff2':'font/woff2'}; r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(8851, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  try {
    for (const ta of ['none', 'pan-y']) {
      const ctx = await b.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
      await p.goto('http://127.0.0.1:8851/3d/dollhouse.html', { waitUntil: 'load' });
      await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 }); await p.waitForTimeout(1500);
      await p.evaluate((ta) => { document.querySelector('canvas').style.touchAction = ta; }, ta); await p.waitForTimeout(500);
      for (let k = 0; k < 2; k++) {
        const v0 = await p.evaluate(() => window.__dollhouse.view);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 350 }] });
        for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195 + 12 * i, y: 350 }] }); await p.waitForTimeout(16); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500);
        const v1 = await p.evaluate(() => window.__dollhouse.view);
        out.push(`top-level touch-action ${ta} gesture ${k}: az ${v0.azimuthDeg} -> ${v1.azimuthDeg}`);
      }
      await ctx.close();
    }
  } catch (e) { out.push('ERR ' + e.stack); } finally { await b.close(); srv.close(); }
  fs.writeFileSync(path.join(__dirname, 'regate-probe3.txt'), out.join('\n') + '\n'); console.log(out.join('\n'));
})();

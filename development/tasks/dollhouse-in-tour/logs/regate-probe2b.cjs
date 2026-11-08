// regate probe 2: touch drag inside the layer (iPhone 13): which gestures rotate; pointer events seen in the frame.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const ROOT = 'C:/RnD/.wt/dollhouse-in-tour/run/tourout/apt846';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(new URL(q.url, 'http://x').pathname); const p = path.join(ROOT, u === '/' ? 'index.html' : u); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; } const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.woff2':'font/woff2'}; r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(8851, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  try {
    const ctx = await b.newContext(devices['iPhone 13']); const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await p.goto('http://127.0.0.1:8851/3d/dollhouse.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 }); await p.waitForTimeout(1500);
    const fr = p;
    await fr.evaluate(() => { window.__ev = []; for (const t of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove']) document.addEventListener(t, (e) => window.__ev.push(t), true); });
    out.push('touchAction ' + await fr.evaluate(() => document.querySelector('canvas').style.touchAction));
    const fb = { x: 0, y: 0, width: 390, height: 700 };
    const cx = fb.x + fb.width / 2, cy = fb.y + fb.height / 2;
    const gest = async (label, dx, dy, steps, wait) => {
      const v0 = await fr.evaluate(() => window.__dollhouse.view); await fr.evaluate(() => { window.__ev.length = 0; });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
      for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + dx * i / steps, y: cy + dy * i / steps }] }); if (wait) await p.waitForTimeout(wait); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500);
      const v1 = await fr.evaluate(() => window.__dollhouse.view); const ev = await fr.evaluate(() => { const c = {}; window.__ev.forEach((e) => c[e] = (c[e] || 0) + 1); return c; });
      out.push(`${label}: az ${v0.azimuthDeg}->${v1.azimuthDeg} polar ${v0.polarDeg}->${v1.polarDeg} events ${JSON.stringify(ev)}`);
    };
    await gest('horizontal 140px 12 steps no wait', 140, 0, 12, 0);
    await fr.evaluate(() => { document.querySelector('canvas').style.touchAction = 'none'; });
    await gest('SAME with touch-action:none (diagnostic)', 140, 0, 12, 16);
    await fr.evaluate(() => { document.querySelector('canvas').style.touchAction = 'pan-y'; });
    await gest('horizontal 140px 12 steps 16ms', -140, 0, 12, 16);
    await gest('diag 140,20 steps 16ms', 140, 20, 12, 16);
    await gest('vertical 120px 16ms', 0, 120, 12, 16);
    // playwright touchscreen has no drag; try synthetic mouse-type touch emulation off for comparison: desktop mouse drag on same page
  } catch (e) { out.push('ERR ' + e.stack); } finally { await b.close(); srv.close(); }
  fs.writeFileSync(path.join(__dirname, 'regate-probe2b.txt'), out.join('\n') + '\n'); console.log(out.join('\n'));
})();

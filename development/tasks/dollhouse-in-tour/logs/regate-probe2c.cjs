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
    await p.goto('http://127.0.0.1:8851/index.html?room=living&video=0', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 }); await p.waitForTimeout(800);
    await p.evaluate(() => document.getElementById('t-3d-btn').click());
    const fr = await (await p.waitForSelector('#t-3d-frame', { state: 'attached' })).contentFrame();
    await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 }); await p.waitForTimeout(1500);
    await fr.evaluate(() => { window.__ev = []; for (const t of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove']) document.addEventListener(t, (e) => { window.__ev.push(t); if (t === 'pointerdown') window.__tgt = e.target.tagName + '.' + e.target.className; }, true); });
    out.push('touchAction ' + await fr.evaluate(() => document.querySelector('canvas').style.touchAction));
    const fb = await (await p.$('#t-3d-frame')).boundingBox();
    const cx = fb.x + fb.width / 2, cy = fb.y + fb.height / 2;
    const gest = async (label, dx, dy, steps, wait, ox = 0, oy = 0) => {
      const cx = fb.x + fb.width / 2 + ox, cy = fb.y + fb.height / 2 + oy;
      const v0 = await fr.evaluate(() => window.__dollhouse.view); await fr.evaluate(() => { window.__ev.length = 0; });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
      for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + dx * i / steps, y: cy + dy * i / steps }] }); if (wait) await p.waitForTimeout(wait); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500);
      const v1 = await fr.evaluate(() => window.__dollhouse.view); const ev = await fr.evaluate(() => { const c = {}; window.__ev.forEach((e) => c[e] = (c[e] || 0) + 1); return c; });
      out.push(`${label}: az ${v0.azimuthDeg}->${v1.azimuthDeg} polar ${v0.polarDeg}->${v1.polarDeg} events ${JSON.stringify(ev)} target ${await fr.evaluate(() => window.__tgt)} start (${Math.round(cx)},${Math.round(cy)})`);
    };
    await gest('centre', 140, 0, 12, 16);
    await gest('upper-left of canvas', 100, 0, 12, 16, -150, -250);
    await gest('lower area', 100, 0, 12, 16, 0, 200);
    await gest('top right', -100, 0, 12, 16, 120, -260);
    // playwright touchscreen has no drag; try synthetic mouse-type touch emulation off for comparison: desktop mouse drag on same page
  } catch (e) { out.push('ERR ' + e.stack); } finally { await b.close(); srv.close(); }
  fs.writeFileSync(path.join(__dirname, 'regate-probe2c.txt'), out.join('\n') + '\n'); console.log(out.join('\n'));
})();

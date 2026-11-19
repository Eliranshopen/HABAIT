// phone_shot.mjs - phone check (390x844, touch) of the walk: a first screenshot, then a 2 s hold on the pad's up arrow and a
// screenshot after; prints the position before/after and page errors.  $0.
// usage: node tools/phone_shot.mjs <url | site_dir> <out_prefix>
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json'); const { chromium } = require('playwright-core');
const [src, out] = process.argv.slice(2);
let url = src, server = null;
if (!/^https?:/.test(src)) {
  const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
  const root = path.resolve(src);
  server = http.createServer((q, r) => { const f = path.resolve(root, '.' + decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!f.startsWith(root)) { r.writeHead(403).end(); return; } fs.readFile(f, (e, b) => { if (e) { r.writeHead(404).end(); return; } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); });
  await new Promise((r) => server.listen(8936, '127.0.0.1', r)); url = 'http://127.0.0.1:8936/';
}
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'load', timeout: 120000 }); await p.waitForTimeout(9000);
  await p.screenshot({ path: out + '_a.png' });
  const camPos = () => p.evaluate(() => { const m = window.__walk3d?.me; return m ? { x: +m.x.toFixed(3), z: +m.z.toFixed(3), yaw: +m.yaw.toFixed(3) } : null; });
  console.log('probe', await p.evaluate(() => { const e = document.getElementById('pad'); return [!!e, e && getComputedStyle(e).display, innerWidth, matchMedia('(max-width: 760px)').matches]; }));
  const pad = await p.$('#pad'); const box = pad ? await pad.boundingBox() : null; const visible = pad ? await pad.isVisible() : false;
  const before = await camPos();
  if (box && visible) {
    const cdp = await ctx.newCDPSession(p); const x = box.x + box.width / 2, y0 = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - i * 5 }] }); await p.waitForTimeout(20); }
    await p.waitForTimeout(2000); await p.screenshot({ path: out + '_b.png' });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  console.log(JSON.stringify({ pad: !!box, visible, before, after: await camPos(), errs }));
} finally { await browser.close(); if (server) server.close(); }

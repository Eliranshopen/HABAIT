// walk_check.mjs - QA of the 3D walk in real headless Chrome: page loads, WebGL draws, walking moves the visitor and walls stop him,
// every room reachable by the room strip, screenshots at 1440 and 390, no page errors.  $0.
// usage: node walk_check.mjs <site_dir> <out_dir>
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [site, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const PORT = 8931;
import http from 'node:http';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream' };
const server = http.createServer((q, r) => { const root = path.resolve(site), f = path.resolve(root, '.' + decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(root)) { r.writeHead(403).end(); return; }
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404).end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const srv = { kill: () => server.close() };
const base = `http://127.0.0.1:${PORT}/index.html`;
const res = { errors: [], views: [], walk: null, overflow: {} };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: tag === 'phone', isMobile: tag === 'phone' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => res.errors.push(tag + ': ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') res.errors.push(tag + ' console: ' + m.text()); });
    const views = tag === 'desktop' ? [['foyer', 90], ['living', 200], ['dining', 0], ['kitchen', 315], ['balcony', 0], ['corridor', 0], ['master', 60], ['ensuite', 300], ['mamad', 90], ['bath', 70], ['bedroom', 120]] : [['foyer', 90], ['living', 200], ['kitchen', 315]];
    for (const [at, yaw] of views) {
      await page.goto(`${base}?at=${at}&yaw=${yaw}`);
      await page.waitForFunction(() => window.__walk3d && window.__walk3d.ready, null, { timeout: 120000 });
      await page.waitForTimeout(1500);
      const f = path.join(outDir, `${tag}-${at}.png`);
      await page.screenshot({ path: f });
      const info = await page.evaluate(() => ({ calls: window.__walk3d.info().calls, tris: window.__walk3d.info().triangles, room: document.getElementById('room').textContent }));
      res.views.push({ tag, at, yaw, ...info, file: path.basename(f) });
    }
    res.overflow[tag] = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }).map((e) => e.tagName + '.' + e.className).slice(0, 5));
    if (tag === 'desktop') {
      // walk: from the foyer east for 4 s, then into the east wall of the living room for 6 s (must stop at the wall)
      await page.goto(`${base}?at=foyer&yaw=90`);
      await page.waitForFunction(() => window.__walk3d && window.__walk3d.ready, null, { timeout: 120000 });
      const p0 = await page.evaluate(() => ({ x: window.__walk3d.me.x, z: window.__walk3d.me.z }));
      await page.evaluate(() => { const w = window.__walk3d; w.keys.add('arrowup'); for (let i = 0; i < 64; i++) w.step(0.05); w.keys.clear(); });   // 3.2 s of walking, frame-rate independent
      const p1 = await page.evaluate(() => ({ x: window.__walk3d.me.x, z: window.__walk3d.me.z }));
      await page.evaluate(() => { const w = window.__walk3d; w.keys.add('arrowup'); for (let i = 0; i < 400; i++) w.step(0.05); w.keys.clear(); });   // 20 s more: must stop at the far wall
      const p2 = await page.evaluate(() => ({ x: window.__walk3d.me.x, z: window.__walk3d.me.z, free: window.__walk3d.ok(window.__walk3d.me.x, window.__walk3d.me.z) }));
      await page.screenshot({ path: path.join(outDir, 'desktop-walked.png') });
      res.walk = { p0, p1, p2, moved_m: Math.hypot(p1.x - p0.x, p1.z - p0.z), still_on_free_floor: p2.free };
    }
    await ctx.close();
  }
} finally { await browser.close(); srv.kill(); }
fs.writeFileSync(path.join(outDir, 'walk-check.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ errors: res.errors, walk: res.walk, overflow: res.overflow, views: res.views.map((v) => `${v.tag}/${v.at}:${v.room}:${v.calls}`) }, null, 1));

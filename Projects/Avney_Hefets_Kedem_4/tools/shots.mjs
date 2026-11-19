// shots.mjs - screenshots of the walk at given rooms (desktop 1440 / phone 390), for a look before QA.  $0.
// usage: node shots.mjs <site_dir> <out_dir> [port] [--thumbs]   --thumbs: 448x264 chrome-free room thumbnails into <site_dir>/thumbs
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json'); const { chromium } = require('playwright-core');
const [site, outDir, portArg] = process.argv.slice(2); const THUMBS = process.argv.includes('--thumbs'); const PORT = Number(portArg) || 8934;
fs.mkdirSync(outDir, { recursive: true });
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => { const root = path.resolve(site), f = path.resolve(root, '.' + decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(root)) { r.writeHead(403).end(); return; } fs.readFile(f, (e, b) => { if (e) { r.writeHead(404).end(); return; } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const grid = JSON.parse(fs.readFileSync(path.join(site, 'walk3d-grid.json'), 'utf8'));
  const jobs = THUMBS ? grid.cameras.map((c) => ({ at: c.id, w: 448, h: 264, f: path.join(site, 'thumbs', c.id + '.jpg'), shot: 1 }))
    : [['living', 1440, 900], ['dining', 1440, 900], ['kitchen', 1440, 900], ['master', 1440, 900], ['ensuite', 1440, 900], ['bath', 1440, 900], ['balcony', 1440, 900], ['living', 390, 844]].map(([at, w, h]) => ({ at, w, h, f: path.join(outDir, `${w}-${at}.png`) }));
  for (const j of jobs) {
    const ctx = await browser.newContext({ viewport: { width: j.w, height: j.h }, hasTouch: j.w < 500, isMobile: j.w < 500 }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(j.at + ': ' + e.message)); page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ' ' + r.url()); });
    await page.goto(`http://127.0.0.1:${PORT}/index.html?at=${j.at}${j.shot ? '&shot=1' : ''}`); await page.waitForFunction(() => window.__walk3d && window.__walk3d.ready, null, { timeout: 180000 }); await page.waitForTimeout(1500);
    await page.screenshot({ path: j.f, type: j.f.endsWith('.jpg') ? 'jpeg' : 'png', quality: j.f.endsWith('.jpg') ? 82 : undefined }); await ctx.close();
  }
} finally { await browser.close(); server.close(); }
console.log(JSON.stringify({ errors }, null, 1));

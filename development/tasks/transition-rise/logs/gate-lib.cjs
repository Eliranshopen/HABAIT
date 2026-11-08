// shared helpers for the qa-reviewer gate probes (transition-rise). Port 8851 only; the server is closed by the caller.
const http = require('http');
const fs = require('fs');
const path = require('path');
const AD = 'C:/RnD/Projects/Habait/tools/appdeps/node_modules/';
const { chromium, devices } = require(AD + 'playwright-core');
const sharp = require(AD + 'sharp');
const ROOT = 'C:/RnD/.wt/transition-rise/run/tourout/apt846';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };
function serve() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const p = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!p.startsWith(path.normalize(ROOT)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => srv.listen(8851, '127.0.0.1', () => r(srv)));
}
const launch = () => chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function bandDiff(a, b) {
  const meta = await sharp(a).metadata();
  const box = { left: Math.round(meta.width * 0.3), top: Math.round(meta.height * 0.35), width: Math.round(meta.width * 0.4), height: Math.round(meta.height * 0.3) };
  const [x, y] = await Promise.all([a, b].map((f) => sharp(f).extract(box).removeAlpha().raw().toBuffer()));
  let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]);
  return s / x.length;
}
const hide = (p) => p.evaluate(() => { for (const n of document.getElementById('t-root').children) if (n.id !== 'pano') { n.dataset.vis = n.style.visibility; n.style.visibility = 'hidden'; } for (const n of document.querySelectorAll('#pano .pnlm-ui, #pano .pnlm-hotspot-base, #pano .pnlm-controls-container')) n.style.visibility = 'hidden'; });
const unhide = (p) => p.evaluate(() => { for (const n of document.getElementById('t-root').children) if (n.id !== 'pano') n.style.visibility = n.dataset.vis || ''; for (const n of document.querySelectorAll('#pano .pnlm-ui, #pano .pnlm-hotspot-base, #pano .pnlm-controls-container')) n.style.visibility = ''; });
async function openTour(b, opts, room, extra = '') {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push('tour: ' + e.message));
  await p.goto(`http://127.0.0.1:8851/index.html?room=${room}&video=0${extra}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
  await p.evaluate(() => { const v = window.__tour.viewer; v.stopAutoRotate && v.stopAutoRotate(); });
  return { ctx, p, errs };
}
async function dhFrame(p, fps0 = true) {
  await p.waitForFunction(() => (document.getElementById('t-3d-frame').getAttribute('src') || '').includes('#defer'), null, { timeout: 20000 });
  const fr = await (await p.$('#t-3d-frame')).contentFrame();
  await fr.waitForFunction(() => window.__dollhouse && (window.__dollhouse.prepared || window.__dollhouse.loaded), null, { timeout: 90000 });
  if (fps0) await fr.evaluate(() => { window.__habaitMinFps = 0; });
  return fr;
}
module.exports = { serve, launch, bandDiff, hide, unhide, openTour, dhFrame, devices, sharp, path, fs };

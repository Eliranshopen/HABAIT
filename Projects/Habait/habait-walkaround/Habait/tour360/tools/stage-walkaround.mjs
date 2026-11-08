#!/usr/bin/env node
/* Habait Tour360 — stage-walkaround.mjs (board habait-walkaround T19b, D-T360-46 step 1).
   Assembles the deploy folder for the Vercel project `habait-walkaround` OUTSIDE the harness tree:
     /            the tour (an `--engine` build of dist/<id>/: today's page on the new engine + api/edit, the proven typed change)
     /lab/ …      the phone lab (Habait/tour360/spikes/lab/stage.mjs — kept as an optional speed test)
   and one vercel.json that merges both (the function, noindex everywhere, the media caches).
     timeout 540 node Habait/tour360/tools/stage-walkaround.mjs <dir>/habait-walkaround [--id demo-01] [--check]
   --check serves the staged folder alone and loads `/` (phone + desktop, the disclosure 3/3, 0 failed requests other than the
   keyless api) and `/lab/`. ⛔ Deploy only from the staged folder, never from the harness tree (standing law 3). */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');
const REPO = path.resolve(ROOT, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = process.argv[2] && path.resolve(process.argv[2]);
const id = arg('--id', 'demo-01');
if (!out || !path.basename(out).startsWith('habait-walkaround')) { console.error('usage: stage-walkaround.mjs <dir>/habait-walkaround [--id demo-01] [--check]'); process.exit(2); }
if (out.startsWith(path.resolve(REPO) + path.sep)) { console.error('refusing to stage inside the harness tree'); process.exit(2); }
const DIST = path.join(ROOT, 'dist', id);
if (!fs.existsSync(path.join(DIST, 'engine.js'))) { console.error(`dist/${id} is not an --engine build — run build-tour.mjs ${id} --engine`); process.exit(1); }

// 1. the lab (it empties `out` first)
execFileSync(process.execPath, [path.join(ROOT, 'spikes', 'lab', 'stage.mjs'), out], { stdio: 'inherit' });
const labVercel = JSON.parse(fs.readFileSync(path.join(out, 'vercel.json'), 'utf8'));

// 2. the tour at the root (its index.html replaces the lab's root pointer)
const copyDir = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const n of fs.readdirSync(from)) { const f = path.join(from, n), t = path.join(to, n); if (fs.statSync(f).isDirectory()) copyDir(f, t); else fs.copyFileSync(f, t); } };
for (const n of fs.readdirSync(DIST)) {
  if (n === 'vercel.json') continue;
  const f = path.join(DIST, n);
  if (fs.statSync(f).isDirectory()) copyDir(f, path.join(out, n)); else fs.copyFileSync(f, path.join(out, n));
}
const tourVercel = JSON.parse(fs.readFileSync(path.join(DIST, 'vercel.json'), 'utf8'));

// 3. one vercel.json
const vercel = {
  functions: tourVercel.functions,
  headers: [
    ...tourVercel.headers,
    ...labVercel.headers.filter((h) => h.source !== '/(.*)'),
    { source: '/engine.js', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
  ],
};
fs.writeFileSync(path.join(out, 'vercel.json'), JSON.stringify(vercel, null, 2) + '\n');
let files = 0, bytes = 0; const walk = (d) => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); const s = fs.statSync(f); if (s.isDirectory()) walk(f); else { files++; bytes += s.size; } } }; walk(out);
console.log(`staged ${out}: the tour at / (${id}, engine) + /lab/ + api/edit — ${files} files, ${(bytes / 1e6).toFixed(1)} MB`);

if (process.argv.includes('--check')) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (u.startsWith('/api/')) { res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"configured":false}'); return; } // static check: no function here
    let f = path.join(out, u); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!f.startsWith(out) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const { chromium } = appRequire(REPO)('playwright-core');
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  let bad = 0;
  try {
    for (const [url, size] of [['/', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['/?lang=en', { viewport: { width: 1440, height: 900 } }], ['/lab/', { viewport: { width: 390, height: 844 } }]]) {
      const page = await (await browser.newContext(size)).newPage();
      const fails = []; page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/')) fails.push(`${r.status()} ${r.url()}`); }); page.on('pageerror', (e) => fails.push('pageerror ' + e.message));
      await page.goto(base + url, { waitUntil: 'load' });
      if (url !== '/lab/') await page.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 30000 }).catch(() => fails.push('never ready'));
      const disc = await page.evaluate(() => ['tour-badge', 'tour-concept', 'tour-ai-note'].filter((i) => { const e = document.getElementById(i); return e && e.textContent.trim(); }).length);
      const engine = await page.evaluate(() => (window.pannellum && window.pannellum.engine) || null);
      const ok = fails.length === 0 && (url === '/lab/' || (disc === 3 && /photo-sphere-viewer/.test(engine || '')));
      if (!ok) bad++;
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${url} · disclosure ${disc}/3 · engine ${engine}${fails.length ? ' · ' + fails.slice(0, 3).join(' | ') : ''}`);
      await page.context().close();
    }
  } finally { await browser.close(); srv.close(); }
  console.log(bad ? `check FAIL (${bad})` : 'check OK');
  process.exit(bad ? 1 : 0);
}

#!/usr/bin/env node
/* Habait Tour360 — tools/serve-dist.mjs: a static server for dist/<id> WITH HTTP Range support (2026-11-02).
   python -m http.server answers every request with 200 + the whole file: a browser cannot seek in a video, waits for the whole
   download before some operations, and the intro "sticks". This one answers 206 for Range requests, like Vercel does.
     node Habait/tour360/tools/serve-dist.mjs apt846 [--port 8846] [--host 127.0.0.1] */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const id = args[0] || 'apt846';
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const port = Number(flag('--port', '8846'));
const host = flag('--host', '127.0.0.1');
const DIST = path.join(ROOT, 'dist', id);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.normalize(path.join(DIST, url === '/' ? 'index.html' : url));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=60', 'X-Robots-Tag': 'noindex' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    let a = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    let b = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (a >= size || a > b) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1 });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file, { start: a, end: b }).pipe(res);
    return;
  }
  res.writeHead(200, { ...head, 'Content-Length': size });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
}).listen(port, host, () => console.log(`serve-dist: ${id} on http://${host}:${port}/ (Range: yes) from ${DIST}`));

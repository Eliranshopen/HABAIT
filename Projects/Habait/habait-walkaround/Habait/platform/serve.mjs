#!/usr/bin/env node
// Static server for the platform with HTTP Range support (video seeking needs 206).
//   node serve.mjs            -> http://127.0.0.1:8850/
//   PORT=8851 node serve.mjs
import { createServer } from 'node:http';
import { stat, open } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createGzip, createBrotliCompress, constants as zc } from 'node:zlib';
import { resolve, join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventsSink } from './tools/events-sink.mjs'; // card 24: POST /api/events -> _local/events.jsonl (same origin only)

export const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT || 8850);
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function safePath(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (p.includes('\0')) return null;
  if (p.endsWith('/')) p += 'index.html';
  const full = normalize(join(ROOT, p));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null; // traversal
  return full;
}

export async function handle(req, res) {
  if (await eventsSink(req, res)) return;
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  const file = safePath(req.url || '/');
  if (!file) { res.writeHead(400); return res.end('bad path'); }
  let st;
  try { st = await stat(file); } catch { res.writeHead(404); return res.end('not found'); }
  if (st.isDirectory()) { res.writeHead(301, { Location: (req.url.split('?')[0]) + '/' }); return res.end(); }

  const ext = extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const isMedia = ext === '.mp4' || ext === '.webm' || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp';
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': isMedia ? 'public, max-age=3600' : 'no-cache',
    'Last-Modified': st.mtime.toUTCString(),
    'Access-Control-Allow-Origin': '*',
  };

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m || (m[1] === '' && m[2] === '')) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
      return res.end();
    }
    let start = m[1] === '' ? Math.max(0, st.size - Number(m[2])) : Number(m[1]);
    let end = m[1] === '' ? st.size - 1 : m[2] === '' ? st.size - 1 : Math.min(Number(m[2]), st.size - 1);
    if (start > end || start >= st.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
      return res.end();
    }
    headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
    headers['Content-Length'] = end - start + 1;
    res.writeHead(206, headers);
    if (method === 'HEAD') return res.end();
    return createReadStream(file, { start, end }).pipe(res);
  }

  // Compress text-like and 3D assets (js/css/html/json/glb/svg) when the client accepts it; media stays raw (already compressed, needs Range).
  const compressible = ['.js', '.mjs', '.css', '.html', '.json', '.svg', '.glb', '.gltf', '.txt', '.md', '.wasm'].includes(ext);
  const ae = String(req.headers['accept-encoding'] || '');
  const enc = compressible && st.size > 1024 ? (ae.includes('br') ? 'br' : ae.includes('gzip') ? 'gzip' : null) : null;
  if (enc) {
    headers['Content-Encoding'] = enc;
    headers['Vary'] = 'Accept-Encoding';
    res.writeHead(200, headers);
    if (method === 'HEAD') return res.end();
    const z = enc === 'br'
      ? createBrotliCompress({ params: { [zc.BROTLI_PARAM_QUALITY]: 5, [zc.BROTLI_PARAM_SIZE_HINT]: st.size } })
      : createGzip({ level: 6 });
    return createReadStream(file).pipe(z).pipe(res);
  }
  headers['Content-Length'] = st.size;
  res.writeHead(200, headers);
  if (method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

export function start(port = PORT, host = HOST) {
  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.writeHead(500);
      res.end('server error');
    });
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => ok(server));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().then((s) => {
    const { port } = s.address();
    console.log(`habait platform  http://${HOST}:${port}/   (root ${ROOT})`);
    console.log(`flow fixture     http://${HOST}:${port}/flow.html?project=rainbow`);
  }).catch((e) => { console.error(e.message); process.exit(1); });
}

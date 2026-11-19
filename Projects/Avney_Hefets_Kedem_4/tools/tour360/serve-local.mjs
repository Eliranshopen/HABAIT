#!/usr/bin/env node
/* serve-local.mjs — a $0 local host for the built tour (QA only). Serves <dir> on 127.0.0.1:<port>.
   /api/edit never reaches a vendor and reads no key:
     default  → GET answers the real handler's describe() with an EMPTY environment (configured: false = the page as it is before the
                keys exist on the host); POST 503.
     --stub   → GET answers configured: true (so the page unlocks: the rings and the free-text line show); POST answers 503
                {reason: 'vendor'} — no edit is ever made. This proves the interface, never the editor.
     node tools/tour360/serve-local.mjs <dir> <port> [--stub] */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , dirArg, portArg] = process.argv;
const DIR = path.resolve(dirArg); const PORT = Number(portArg || 8940); const STUB = process.argv.includes('--stub');
const { describe } = await import(pathToFileURL(path.join(DIR, 'api', '_handler.mjs')).href);
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.css': 'text/css' };
const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/edit') {
    if (req.method === 'GET') return json(res, 200, STUB ? { ...describe({}), configured: true, stub: true, catalog: { items: 8 } } : describe({}));
    for await (const _ of req) { /* drain */ }
    return json(res, 503, { ok: false, reason: 'vendor', message: 'local QA host: no vendor is called' });
  }
  let p = decodeURIComponent(url.pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIR, p);
  if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`serve-local ${STUB ? '(stub) ' : ''}http://127.0.0.1:${PORT}/  pid ${process.pid}`));

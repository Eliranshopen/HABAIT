// serve.mjs - a static local server for the walk (Python's http.server dropped connections under the glTF load).  usage: node serve.mjs <dir> [port]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(process.argv[2]), PORT = Number(process.argv[3] || 8931);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const f = path.resolve(root, '.' + u); if (!f.startsWith(root)) { r.writeHead(403).end(); return; }
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404).end(); return; } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); r.end(b); });
}).listen(PORT, '127.0.0.1', () => console.log('serving ' + root + ' at http://127.0.0.1:' + PORT + '/'));

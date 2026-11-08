// Board dollhouse-in-tour regression: the tour's own gate (tools/paint-proof.mjs: paint + the disclosure lines visible and uncovered)
// against the TEST build (run/tourout/apt846), served on :8851 with the host's noindex header; the server is closed in finally.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = 'C:/RnD/.wt/dollhouse-in-tour/run/tourout/apt846';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(path.normalize(ROOT)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream', 'X-Robots-Tag': 'noindex, nofollow' });
  fs.createReadStream(p).pipe(res);
});
srv.listen(8851, '127.0.0.1', () => {
  // spawnSync blocks this process's event loop, so the server must live in a child: run paint-proof async instead
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, ['C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/tools/paint-proof.mjs', 'http://127.0.0.1:8851', '--apt', 'apt846', '--out', path.join(__dirname, 'paint-proof')], { cwd: 'C:/RnD/Projects/Habait/habait-walkaround', stdio: 'inherit' });
  child.on('exit', (code) => { srv.close(); process.exit(code || 0); });
});

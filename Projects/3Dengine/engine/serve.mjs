// The local link (contract §5): a static file server for one folder. GET and HEAD only, never a path
// outside the root, content type by extension, no directory listing (a folder answers with its
// index.html or 404). `ensureServe` starts it DETACHED when nothing listens on serve.host:serve.port
// yet and records { root, host, port, pid } in <runtimeDir>/serve.json; it outlives the runner and the MCP server.
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPosix } from './lib/paths.mjs';
import { writeJson } from './lib/json.mjs';
import { spawnDetached } from './lib/proc.mjs';
import { isInside } from './inbox.mjs';

export const TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.pdf': 'application/pdf', '.wasm': 'application/wasm',
  '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.hdr': 'application/octet-stream',
});

export const contentType = (file) => TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';

const CLI = fileURLToPath(new URL('./cli.mjs', import.meta.url));

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(res.req.method === 'HEAD' ? undefined : body);
}

// Map a request path to a file under root, or null when it is not servable.
export function resolveRequest(root, urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath);
  } catch {
    return { status: 400 };
  }
  if (p.includes('\0')) return { status: 400 };
  const abs = path.resolve(root, `.${p.startsWith('/') ? p : `/${p}`}`);
  if (!isInside(toPosix(abs), toPosix(root))) return { status: 403 };
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    return { status: 404 };
  }
  let file = abs;
  if (st.isDirectory()) {
    if (!urlPath.endsWith('/')) return { status: 301, location: `${urlPath}/` };
    file = path.join(abs, 'index.html');
    if (!fs.existsSync(file)) return { status: 404 };
  }
  // A symlink inside the root must not lead outside it.
  const realFile = fs.realpathSync.native(file);
  if (!isInside(toPosix(realFile), toPosix(fs.realpathSync.native(root)))) return { status: 403 };
  return { status: 200, file: realFile, size: fs.statSync(realFile).size };
}

export function createStaticServer({ root }) {
  const base = path.resolve(root);
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed\n', { allow: 'GET, HEAD' });
    const url = new URL(req.url, 'http://local');
    const r = resolveRequest(base, url.pathname);
    if (r.status === 301) return send(res, 301, '', { location: r.location + url.search });
    if (r.status !== 200) return send(res, r.status, `${r.status}\n`);
    res.writeHead(200, { 'content-type': contentType(r.file), 'content-length': r.size, 'cache-control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    const s = fs.createReadStream(r.file);
    s.on('error', () => res.destroy());
    s.pipe(res);
  });
}

// Start listening; resolves with the http.Server once it listens.
export function startServe({ root, host = '127.0.0.1', port }) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return Promise.reject(new Error(`not a folder: ${root}`));
  const server = createStaticServer({ root });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

// Does anything accept a TCP connection on host:port? Never takes longer than timeoutMs.
export function isListening(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(timeoutMs, () => done(false));
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
  });
}

export const localUrl = (config) => `http://${config.serve.host}:${config.serve.port}/${config.stub.tourPath}`;
export const serveFile = (config) => `${config.runtimeDir}/serve.json`;

// Make sure the static server for `root` listens on serve.host:serve.port; start it detached if not.
// Returns { started, listening, pid? }.
export async function ensureServe(config, { root = config.stub.siteRoot, waitMs = 3000, spawn = spawnDetached, env = process.env } = {}) {
  const { host, port } = config.serve;
  if (await isListening(host, port)) return { started: false, listening: true };
  const pid = spawn(CLI, ['serve', '--root', root, '--port', String(port), '--host', host],
    { logFile: `${config.runtimeDir}/serve.log`, env, cwd: config.home });
  writeJson(serveFile(config), { root, host, port, pid, started_at: new Date().toISOString() });
  const until = Date.now() + waitMs;
  while (Date.now() < until) {
    if (await isListening(host, port, 200)) return { started: true, listening: true, pid };
    await new Promise((r) => setTimeout(r, 50));
  }
  return { started: true, listening: false, pid };
}

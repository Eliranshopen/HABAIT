// Process and port helpers for the end-to-end test: every process the test starts is recorded here
// and killed by pid with its children (taskkill /T /F on Windows) in the test's `finally`.
import fs from 'node:fs';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export const started = []; // { name, pid }

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** true when nothing listens on 127.0.0.1:<port>. */
export function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

/** A free loopback port, never one of `avoid`. */
export async function freePort(avoid = []) {
  for (let i = 0; i < 20; i++) {
    const p = await new Promise((resolve, reject) => {
      const s = net.createServer();
      s.once('error', reject);
      s.listen(0, '127.0.0.1', () => { const q = s.address().port; s.close(() => resolve(q)); });
    });
    if (!avoid.includes(p)) return p;
  }
  throw new Error('no free port');
}

/** Spawn a long-lived child, its stdout+stderr appended to `logFile`; recorded for the cleanup. */
export function startProcess(name, cmd, args, { cwd, env, logFile }) {
  const out = fs.openSync(logFile, 'a');
  const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', out, out], windowsHide: true });
  fs.closeSync(out);
  started.push({ name, pid: child.pid });
  child.on('error', (e) => fs.appendFileSync(logFile, `\n[e2e] spawn error: ${e.message}\n`));
  return child;
}

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** Kill a pid and its whole child tree. Returns what was done. */
export function killTree(pid) {
  if (!pidAlive(pid)) return 'gone';
  if (process.platform === 'win32') {
    const r = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, encoding: 'utf8' });
    return r.status === 0 ? 'killed' : `taskkill ${r.status}`;
  }
  try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ }
  return 'killed';
}

/** Poll `fn` until it returns a truthy value, or throw `what` after `timeoutMs`. */
export async function waitFor(what, fn, { timeoutMs = 30000, everyMs = 150 } = {}) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error(`timed out after ${timeoutMs} ms waiting for: ${what}`);
    await sleep(everyMs);
  }
}

/** A plain GET (loopback), `{ status, headers, body }`. */
export function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error(`GET ${url} timed out`)));
  });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.txt': 'text/plain' };

/** In-process static server for the built app (SPA fallback to index.html). Resolves `{ close }`. */
export function serveStatic(root, port) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    let file = path.resolve(base, `.${decodeURIComponent(u.pathname)}`);
    if (file !== base && !file.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }) }));
  });
}

/** Node processes whose command line mentions any of `needles` (Windows: CIM). */
export function nodeProcessesMatching(needles) {
  if (process.platform !== 'win32') return [];
  const ps = 'Get-CimInstance Win32_Process -Filter "Name=\'node.exe\' OR Name=\'chrome.exe\'" | ForEach-Object { "$($_.ProcessId)`t$($_.Name)`t$($_.CommandLine)" }';
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  const norm = (s) => s.replace(/\\/g, '/').toLowerCase();
  const ns = needles.map(norm);
  return (r.stdout || '').split(/\r?\n/).filter(Boolean).map((l) => {
    const [pid, name, ...rest] = l.split('\t');
    return { pid: Number(pid), name, cmd: rest.join('\t') };
  }).filter((p) => p.pid !== process.pid && ns.some((n) => norm(p.cmd).includes(n)));
}

/** Listening sockets on the given ports (netstat -ano). */
export function listening(ports) {
  const r = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true });
  const lines = (r.stdout || '').split(/\r?\n/);
  return lines.filter((l) => /LISTENING/.test(l) && ports.some((p) => new RegExp(`:${p}\\s`).test(l))).map((l) => l.trim());
}

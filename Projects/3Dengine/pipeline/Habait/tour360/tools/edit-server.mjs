#!/usr/bin/env node
/* Habait Tour360 — tools/edit-server.mjs (T09, T14b, T17a) — the laptop host for the live text edit.
   Serves dist/<id>/ and answers /api/edit through server/handler.mjs with the keys read BY NAME from the harness root .env
   (FAL_KEY, OPENROUTER_API_KEY; never printed). The unlock code is TOUR_EDIT_CODE from .env or the environment, or a fresh one
   printed at start. Every paid turn is reserved and settled in apartments/<id>/_local/ledger.json (the same file the offline tool
   writes), under the cap in that file. The catalog (T14b): catalog/items.json is read at start when it exists, so a catalog turn
   needs no build step on the laptop — the page still needs a `--catalog` build to show the strip and serve the photos.
   T17a (TEST-PLAN.md §6) — the recording layer: every paid turn is written as files under apartments/<id>/_local/turns/<seq>-<op>/
   (the request without its images, the crop, the editor's result, the judge's two views, the answer without the image), and the
   page's own account of a turn — the view before and after the paste, the same views wider, its attempts and the message it showed —
   arrives as `op: 'record'` (answered here, never passed to the handler) and lands beside the turn as <seq>-page/. The product photo
   is never written (it lives in catalog/_local/). `--no-record` turns the layer off; GET /api/edit says `record: true` when it is on,
   and the page posts its account only then (the hosted function never says it). `--lan` listens on every interface so a phone on
   the same Wi-Fi reaches the catalog build (the link with the code is printed in YOUR terminal only). `--ledger <file>` points a
   test host at another ledger file (the cap test), never the real one by accident.
   Usage, in YOUR OWN terminal (it keeps running while you try things; Ctrl-C stops it):
     node Habait/tour360/tools/edit-server.mjs demo-01 [--port 8720] [--lan] [--no-record] [--ledger <file>]
   then open the URL it prints (it carries ?key=<code>). Machine rules for an AGENT run: start it inside the bounded command
   that needs it and kill it by PID before the turn ends. */
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, handleEdit, catalogIndex, EditError, LIMITS } from '../server/handler.mjs';
import { fileLedger, loadEnv } from './file-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = path.resolve(ROOT, '..', '..');
const id = process.argv[2];
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) { console.error('usage: node Habait/tour360/tools/edit-server.mjs <apartment-id> [--port N] [--lan] [--no-record] [--ledger <file>]'); process.exit(2); }
const argOf = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const PORT = argOf('--port') ? Number(argOf('--port')) : 8720;
const LAN = process.argv.includes('--lan');
const RECORD = !process.argv.includes('--no-record');
const DIST = path.join(ROOT, 'dist', id);
const LEDGER = argOf('--ledger') ? path.resolve(argOf('--ledger')) : path.join(ROOT, 'apartments', id, '_local', 'ledger.json');
const TURNS = path.join(ROOT, 'apartments', id, '_local', 'turns');
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('edit-server: build first (build-tour.mjs ' + id + ')'); process.exit(1); }

// keys by name from the root .env, never logged
const env = loadEnv(HARNESS);
if (!env.TOUR_EDIT_CODE || String(env.TOUR_EDIT_CODE).length < 8) env.TOUR_EDIT_CODE = crypto.randomBytes(6).toString('base64url');

// the catalog, when the track has one (catalog/items.json; the photos are served from the --catalog build in dist/)
const CATALOG_FILE = path.join(ROOT, 'catalog', 'items.json');
const catalog = fs.existsSync(CATALOG_FILE) ? catalogIndex(JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))) : null;
const info = describe(env, catalog);
if (!info.configured) { console.error('edit-server: FAL_KEY or OPENROUTER_API_KEY is missing from the environment / the root .env'); process.exit(1); }

const ledger = fileLedger(LEDGER);

const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mjs': 'text/plain' };
const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > 4_400_000) { reject(new EditError(413, 'bad_request', 'body too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});
const json = (res, status, obj) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };

/* ── the recording layer (T17a) ──────────────────────────────────────────────────────────────────────────────────────────── */
const IMAGE_KEYS = ['crop', 'result', 'reference', 'image', 'before', 'after', 'before_wide', 'after_wide'];
const dataUrlInfo = (s) => { const m = /^data:image\/(jpeg|png|webp);base64,/.exec(String(s || '')); if (!m) return null; const i = s.indexOf(','); return { ext: m[1] === 'jpeg' ? 'jpg' : m[1], bytes: Math.floor(((s.length - i - 1) * 3) / 4), b64: s.slice(i + 1) }; };
/** The object without its images: each image key becomes { bytes, sha256 (first 16 hex) } — enough to tie the file to the ledger. */
function withoutImages(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const d = IMAGE_KEYS.includes(k) ? dataUrlInfo(v) : null;
    out[k] = d ? { bytes: d.bytes, sha256: crypto.createHash('sha256').update(Buffer.from(d.b64, 'base64')).digest('hex').slice(0, 16) } : v;
  }
  return out;
}
function writeImage(dir, name, dataUrl) {
  const d = dataUrlInfo(dataUrl); if (!d) return null;
  const file = `${name}.${d.ext}`; fs.writeFileSync(path.join(dir, file), Buffer.from(d.b64, 'base64')); return file;
}
let turnSeqs = []; // the ledger rows since the page's last account — the next `record` names them
/** A wrapped ledger that remembers the row this request reserved, so the turn's folder carries the ledger's own number. */
function watchLedger(current) {
  return {
    get cap() { return ledger.cap; },
    total: () => ledger.total(),
    reserve(row) { const i = ledger.reserve(row); current.seq = i + 1; turnSeqs.push(i + 1); return i; },
    settle(i, usd, patch) { ledger.settle(i, usd, patch); current.settled = { usd, ...withoutImages(patch) }; },
  };
}
/** The paid turn as files: <seq>-<op>/ with request.json, the images, answer.json. The reference (the product photo) is never written. */
function recordTurn(body, current, answer, error) {
  if (!RECORD || !current.seq) return;
  try {
    const op = body.op || 'edit';
    const dir = path.join(TURNS, `${String(current.seq).padStart(4, '0')}-${op}`);
    fs.mkdirSync(dir, { recursive: true });
    const files = {};
    if (body.crop) files.crop = writeImage(dir, 'crop', body.crop);
    if (body.result) files.result = writeImage(dir, op === 'edit' ? 'result' : 'result-judged', body.result);
    if (answer && answer.image) files.result = writeImage(dir, 'result', answer.image);
    fs.writeFileSync(path.join(dir, 'request.json'), JSON.stringify({ ts: new Date().toISOString(), seq: current.seq, op, ...withoutImages(body), code: body.code ? '(present)' : '(missing)', files }, null, 1));
    fs.writeFileSync(path.join(dir, 'answer.json'), JSON.stringify(error ? { ok: false, status: error.status, reason: error.reason, message: error.message, settled: current.settled || null } : { ...withoutImages(answer), settled: current.settled || null }, null, 1));
  } catch (e) { console.error(new Date().toISOString(), 'record failed', String(e && e.message || e).slice(0, 120)); }
}
/** The page's account (`op: 'record'`): the views before and after the paste and the page's lastTurn, beside the turn's rows. */
function recordPage(body) {
  const first = turnSeqs[0] || 0;
  const dir = path.join(TURNS, `${String(first).padStart(4, '0')}-page${first ? '' : '-' + Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  const files = {};
  for (const k of ['before', 'after', 'before_wide', 'after_wide']) if (body[k]) files[k] = writeImage(dir, k.replace('_', '-'), body[k]);
  const account = { ts: new Date().toISOString(), seqs: turnSeqs.slice(), ...withoutImages(body), code: '(present)', files };
  fs.writeFileSync(path.join(dir, 'turn.json'), JSON.stringify(account, null, 1));
  turnSeqs = [];
  return { ok: true, dir: path.relative(ROOT, dir).replace(/\\/g, '/'), seqs: account.seqs };
}
const codeOk = (code) => { const want = String(env.TOUR_EDIT_CODE || ''), got = String(code || ''); return want.length >= 8 && got.length === want.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got)); };
const turnsOnDisk = () => { try { return fs.readdirSync(TURNS).length; } catch { return 0; } };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/edit') {
    if (req.method === 'GET') return json(res, 200, { ...describe(env, catalog, req.headers['x-tour-code'] === undefined ? undefined : String(req.headers['x-tour-code'])), ledger: { total_usd: Number(ledger.total().toFixed(4)), cap_usd: ledger.cap }, ...(RECORD ? { record: true, turns: turnsOnDisk() } : {}) });
    if (req.method !== 'POST') return json(res, 405, { ok: false, reason: 'method' });
    let body = null; const current = {};
    try {
      body = JSON.parse(await readBody(req) || '{}');
      if (body.op === 'record') {
        // the page's account of a turn (T17a): never a vendor call, never a ledger row, never the handler
        if (!RECORD) return json(res, 404, { ok: false, reason: 'not_recording' });
        if (!codeOk(body.code)) return json(res, 403, { ok: false, reason: 'code' });
        const out = recordPage(body);
        console.log(new Date().toISOString(), `record ${out.dir} (rows ${out.seqs.join(',') || 'none'})`);
        return json(res, 200, out);
      }
      if ((body.op === undefined || body.op === 'edit') && !(body.attempt > 1)) turnSeqs = []; // a new turn begins (a retry is the same turn): the account that follows names its rows
      const out = await handleEdit(body, env, RECORD ? watchLedger(current) : ledger, { log: (m) => console.log(new Date().toISOString(), m), catalog });
      recordTurn(body, current, out, null);
      return json(res, 200, out);
    } catch (e) {
      if (e instanceof EditError) { console.log(new Date().toISOString(), 'refused', e.status, e.reason); if (body) recordTurn(body, current, null, e); return json(res, e.status, { ok: false, reason: e.reason, message: e.reason === 'vendor' ? undefined : e.message }); }
      console.error(new Date().toISOString(), 'error', String(e && e.message || e).slice(0, 200));
      return json(res, 500, { ok: false, reason: 'error' });
    }
  }
  if (url.pathname.startsWith('/api/')) return json(res, 404, { ok: false, reason: 'not_found' });
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(DIST, p));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'x-robots-tag': 'noindex, nofollow' });
  fs.createReadStream(file).pipe(res);
});
server.listen(PORT, LAN ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`edit-server: ${id} on http://127.0.0.1:${PORT}/  (ledger ${path.relative(ROOT, LEDGER).replace(/\\/g, '/')} $${ledger.total().toFixed(3)} of $${ledger.cap}, catalog ${info.catalog.items} items, record ${RECORD ? 'on → ' + path.relative(ROOT, TURNS).replace(/\\/g, '/') : 'off'}, limits ${JSON.stringify(LIMITS)})`);
  console.log(`open:  http://127.0.0.1:${PORT}/?key=${env.TOUR_EDIT_CODE}`);
  if (LAN) {
    const addrs = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);
    for (const a of addrs) console.log(`phone: http://${a}:${PORT}/?key=${env.TOUR_EDIT_CODE}   (the same Wi-Fi; the code gates the paid turns; stop the host when done)`);
    if (!addrs.length) console.log('phone: no LAN address found on this machine');
  }
});

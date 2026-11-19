/* Habait Tour360 — tools/follow-live-check.mjs (2026-11-16, plan development/plans/2026-11-16-typed-change-all-tabs.md).
   The page half of "a typed change goes to every tab that sees the spot", proven in a real browser at $0.
   It serves a LOCAL copy of a served tour (its page and media fetched once by GET and cached), with this checkout's viewer/tour.js
   and viewer/edit-live.js swapped into the page and the plan scale the new build line adds; `api/edit` never leaves the page — a
   stub inside it answers every turn by drawing two plain figures on the view it was sent (no vendor, no key, no ledger). Then, in
   headless Chrome: a change is typed in one room; the check reads which rooms the page aimed, that the follow turns went out side
   by side under the first turn's token with the first room's view as the reference, that each result landed on its own room's
   stack linked to the first change, that entering a followed room shows it, that undo clears every room, and that a room where
   nothing changed or the cap answered is reported and never pasted. The views the page cut are written out as pictures.
   What it does NOT prove: what a real editor draws from a second image — that is the paid proof (plan §6 P2).
     node tools/follow-live-check.mjs --cache <dir> --out <dir> [--live <url>] [--room kitchen] [--look pitch,yaw,hfov]
                                      [--expect dining,living] [--size 1440x900 | 390x844] [--chrome <exe>]
   exit 0 = every check passed · 1 = a check failed · 2 = usage or the rig itself */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, handleEdit, memoryLedger, EditError, MODELS, TEXT_USD } from '../server/handler.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// `--name value` or `--name=value` (a value that starts with a minus, such as a look, is safest in the second form: on 2026-11-16 a
// `--look=…` given to the older parser was silently ignored and a paid run looked at the wrong wall)
const arg = (name, def) => { const eq = process.argv.find((a) => a.startsWith('--' + name + '=')); if (eq) return eq.slice(name.length + 3); const i = process.argv.indexOf('--' + name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def; };
// --live: the served tour's URL (fetched once by GET and cached), or a stage's `tour` FOLDER on disk (read as it is, nothing cached)
const LIVE_ARG = arg('live', 'https://habait-flow.vercel.app/tour/');
const LIVE_DIR = !/^https?:/.test(LIVE_ARG) && fs.existsSync(LIVE_ARG) && fs.statSync(LIVE_ARG).isDirectory() ? path.resolve(LIVE_ARG) : null;
const LIVE = LIVE_DIR ? LIVE_DIR : LIVE_ARG.replace(/\/?$/, '/');
// --as-is: the page's own scripts and data are tested, nothing swapped in (a stage about to be deployed); only the stub is added
const AS_IS = process.argv.includes('--as-is');
const CACHE = arg('cache', null), OUT = arg('out', null);
const ROOM = arg('room', 'kitchen');
const LOOK = arg('look', '-14,-5,80').split(',').map(Number);
const EXPECT = arg('expect', '').split(',').filter(Boolean);
const [VW, VH] = arg('size', '1440x900').split('x').map(Number);
const CHROME = arg('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const TEXT = arg('text', 'להוסיף שני אנשים ליד שולחן האוכל');
// --real: no stub — the page's turns go through server/handler.mjs to the vendor (PAID). Dry unless --go; --cap is the most this run may book.
const REAL = process.argv.includes('--real'), GO = process.argv.includes('--go'), CAP = Number(arg('cap', '0'));
if (REAL && GO && !(CAP > 0)) { console.error('follow-live-check: --real --go needs --cap <usd>'); process.exit(2); }
// --remote: the DEPLOYED page at --live is driven as it is served, and its turns go to ITS OWN edit function: the canary after a
// deploy. PAID by that host (its key, its day cap, its per-visitor limit); nothing here can cap it. Dry unless --go.
const REMOTE = process.argv.includes('--remote');
if ((!CACHE && !LIVE_DIR && !REMOTE) || !OUT || LOOK.length !== 3 || LOOK.some((n) => !Number.isFinite(n)) || !VW || !VH) { console.error('usage: node tools/follow-live-check.mjs --cache <dir> --out <dir> [--live <url>] [--room <id>] [--look pitch,yaw,hfov] [--expect a,b] [--size WxH]'); process.exit(2); }
// the browser's profile: an ABSOLUTE folder (Chrome does not start on a relative one — seen 2026-11-16) and never the evidence folder
const PROFILE = path.resolve(CACHE || path.join(os.tmpdir(), 'tour360-follow-live-check'));
fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const tag = `${VW}x${VH}`;

/* ── the local copy: the page patched, every other file fetched once from the served tour ─────────────────────────────── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };
async function cached(rel) {
  if (LIVE_DIR) { const f = path.normalize(path.join(LIVE_DIR, rel)); return f.startsWith(LIVE_DIR) && fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; }
  const file = path.normalize(path.join(CACHE, rel));
  if (!file.startsWith(path.normalize(CACHE))) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  if (fs.existsSync(file + '.404')) return null;
  const r = await fetch(LIVE + rel, { signal: AbortSignal.timeout(60000) });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!r.ok) { fs.writeFileSync(file + '.404', String(r.status)); return null; }
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}
const lf = (s) => s.replace(/\r\n/g, '\n');
const apartOf = (a, b) => { const A = a.split('\n'), B = new Set(b.split('\n')), A2 = new Set(A); return A.filter((l) => !B.has(l)).length + b.split('\n').filter((l) => !A2.has(l)).length; };
const viewerSrc = (name) => lf(fs.readFileSync(path.join(ROOT, 'viewer', name), 'utf8'));
function swapInline(html, marker, src) {
  // the build inlines a script as <script>…</script> with every "</script" inside written "<\/script" (tools/build-tour.mjs inlineJs)
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) if (m[1].includes(marker)) return { html: html.slice(0, m.index) + '<script>' + src.replace(/<\/script/gi, '<\\/script') + '</script>' + html.slice(m.index + m[0].length), old: m[1].replace(/<\\\/script/gi, '</script') };
  throw new Error('the served page has no inline script with: ' + marker);
}
/* The stub the page carries instead of a host: every `api/edit` call answered in place. An edit draws two plain figures standing in
   the middle of the view it was sent; `window.__stubFail[scene]` = 'unchanged' sends the view back as it came, 'cap' answers 429,
   'huge' draws the figures over most of the view's height (the paid proof's wrong-scale answer, replayed). */
const STUB = `(() => {
  const real = window.fetch.bind(window);
  const calls = window.__stubCalls = [];
  window.__stubFail = {};
  const draw = (dataUrl, follow, big) => new Promise((ok, no) => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const W = c.width, H = c.height;
    const fig = (cx, col) => { g.fillStyle = col; if (big) { g.fillRect(cx - W * 0.09, H * 0.08, W * 0.18, H * 0.84); return; } g.fillRect(cx - W * 0.03, H * 0.44, W * 0.06, H * 0.30); g.beginPath(); g.arc(cx, H * 0.40, W * 0.026, 0, 6.3); g.fill(); };
    fig(W * 0.455, follow ? '#1565c0' : '#c2185b'); fig(W * 0.545, follow ? '#0d47a1' : '#880e4f');
    ok(c.toDataURL('image/jpeg', 0.92)); }; im.onerror = () => no(new Error('stub: the crop did not decode')); im.src = dataUrl; });
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (url, opts = {}) => {
    if (!/(^|\\/)api\\/edit(\\?|$)/.test(String(url))) return real(url, opts);
    if (!opts.method || opts.method === 'GET') return json({ configured: true, open: true, follow: true, stub: true, models: ['kontext', 'flux3', 'nb2'], catalog: { items: 0 } });
    const b = JSON.parse(opts.body);
    if (b.op === 'judge') { // the anchor judge says no where the figures were drawn huge: the furniture under them is gone
      const bad = b.anchor === true && window.__stubFail[b.scene] === 'huge';
      calls.push({ op: 'judge', scene: b.scene, anchor: b.anchor === true, t: Date.now() });
      return json({ ok: true, held: !bad, iou: bad ? 0 : 0.9, ratio: bad ? 0 : 1, object: 'stub', usd: 0 });
    }
    if (b.op) return json({ ok: false, reason: 'bad_request' }, 400);
    const follow = b.follow !== undefined;
    const call = { op: follow ? 'follow' : 'edit', scene: b.scene, attempt: b.attempt || 1, view: b.view, crop: b.crop, instruction: b.instruction === undefined ? null : b.instruction, token: follow ? b.follow.token : null, reference: follow ? b.follow.reference : null, from: follow ? b.follow.from : null, t: Date.now() };
    calls.push(call);
    await new Promise((r) => setTimeout(r, follow ? 1200 : 500)); // a vendor takes time: side-by-side turns must overlap
    const fail = follow ? window.__stubFail[b.scene] : null;
    call.done = Date.now();
    if (fail === 'cap') return json({ ok: false, reason: 'cap' }, 429);
    const image = fail === 'unchanged' ? b.crop : await draw(b.crop, follow, fail === 'huge');
    return json({ ok: true, image, prompt: 'stub: two plain figures', target: 'stub', change: 'stub', reach: 'object', living: true, attempt: b.attempt || 1, model: 'stub', modelKey: 'nb2', usd: 0, ms: follow ? 1200 : 500, ms_text: follow ? 0 : 150, ms_edit: follow ? 1200 : 350, slow: false, ...(follow ? { follow_turn: true } : { follow: 'stub-token.stub-signature' }) });
  };
})();`;
const facts = { live: LIVE, size: tag, room: ROOM, look: LOOK, text: TEXT };
if (AS_IS) console.log('follow-live-check: --as-is — the page under ' + LIVE + ' is tested with its own scripts and data');
async function page() {
  let html = fs.readFileSync(await cached('index.html'), 'utf8');
  const dm = /<script type="application\/json" id="tour-data">([\s\S]*?)<\/script>/.exec(html);
  if (!dm) throw new Error('the served page has no tour-data');
  const data = JSON.parse(dm[1]);
  // what tools/build-tour.mjs now writes: the plan sheet's pixels per centimetre, from cameras.json
  const camFile = path.join(ROOT, 'apartments', data.id, 'cameras.json');
  const cam = fs.existsSync(camFile) ? JSON.parse(fs.readFileSync(camFile, 'utf8')) : null;
  if (!cam || !cam.plan || !Number.isFinite(cam.plan.pxPerCm) || !Number.isFinite(cam.plan.planScale)) throw new Error('no cameras.json plan scale for ' + data.id);
  const scale = Math.round(cam.plan.pxPerCm * cam.plan.planScale * 10000) / 10000;
  if (AS_IS && data.apartment.plan.pxPerCm !== scale) throw new Error(`--as-is: the page's plan scale is ${data.apartment.plan.pxPerCm}, cameras.json says ${scale}`);
  data.apartment.plan.pxPerCm = scale;
  facts.apartment = data.id; facts.pxPerCm = data.apartment.plan.pxPerCm; facts.scenes = data.scenes.map((s) => s.id); facts.depth = data.depth ? Object.keys(data.depth.scenes) : [];
  html = html.slice(0, dm.index) + '<script type="application/json" id="tour-data">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>' + html.slice(dm.index + dm[0].length);
  // this checkout's two viewer files in place of the served ones; and whether the served ones are main's (HEAD) byte for byte
  const head = (name) => { try { return lf(execFileSync('git', ['show', 'HEAD:./viewer/' + name], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 })); } catch { return null; } };
  const t = swapInline(html, 'Habait Tour360 — tour.js (T01', viewerSrc('tour.js'));
  const e = swapInline(t.html, 'Habait Tour360 — edit-live.js (T09/T10', viewerSrc('edit-live.js'));
  if (AS_IS) { // the page's own bytes: what the swap WOULD have replaced is what runs
    facts.as_is = true;
    facts.page_vs_checkout_lines = { 'tour.js': apartOf(lf(t.old), viewerSrc('tour.js')), 'edit-live.js': apartOf(lf(e.old), viewerSrc('edit-live.js')) };
    const raw = fs.readFileSync(await cached('index.html'), 'utf8');
    const at0 = raw.indexOf('<script>/* Habait Tour360 — edit-live.js (T09/T10');
    if (at0 < 0) throw new Error('--as-is: the page has no edit-live script block');
    facts.served_vs_head_lines = { 'tour.js': facts.page_vs_checkout_lines['tour.js'], 'edit-live.js': facts.page_vs_checkout_lines['edit-live.js'] };
    return REAL ? raw : raw.slice(0, at0) + '<script>' + STUB + '</script>\n' + raw.slice(at0);
  }
  // how many lines the served file and main's differ by (0 = byte for byte; the stage step rewrites tour.js's one return-link line)
  const apart = (a, b) => { if (b === null) return null; const A = a.split('\n'), B = new Set(b.split('\n')), A2 = new Set(A); return A.filter((l) => !B.has(l)).length + b.split('\n').filter((l) => !A2.has(l)).length; };
  facts.served_vs_head_lines = { 'tour.js': apart(lf(t.old), head('tour.js')), 'edit-live.js': apart(lf(e.old), head('edit-live.js')) };
  const at = e.html.indexOf('<script>/* Habait Tour360 — edit-live.js (T09/T10');
  return REAL ? e.html : e.html.slice(0, at) + '<script>' + STUB + '</script>\n' + e.html.slice(at);
}
/* --real: this process is the host. The key is read by NAME (the environment, else the FAL_KEY line of the nearest keys file above
   this folder) and handed only to the handler; it is never printed or written. The ledger is the handler's own, capped at --cap,
   written to <out>/real-ledger.json after every call; every view sent and every picture answered is saved beside it. */
function falKey() {
  if (process.env.FAL_KEY && process.env.FAL_KEY.trim()) return process.env.FAL_KEY.trim();
  for (let d = ROOT; ; d = path.dirname(d)) {
    const f = path.join(d, '.env');
    if (fs.existsSync(f)) { const m = /^FAL_KEY=(.+)$/m.exec(fs.readFileSync(f, 'utf8')); if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, ''); }
    if (path.dirname(d) === d) return '';
  }
}
const realEnv = REAL && GO ? { FAL_KEY: falKey(), TOUR_EDIT_OPEN: '1' } : null;
const realLedger = REAL ? memoryLedger(CAP) : null;
const realCalls = [];
const putImg = (name, dataUrl) => { const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(dataUrl || '')); if (m) fs.writeFileSync(path.join(OUT, name), Buffer.from(m[2], 'base64')); };
async function realEdit(req, res) {
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET') return send(200, describe(realEnv, null, req.headers['x-tour-code'] === undefined ? undefined : String(req.headers['x-tour-code'])));
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || '{}');
  const kind = body.op || (body.follow !== undefined ? 'follow' : 'edit');
  const n = realCalls.length + 1, t0 = Date.now(), id = String(n).padStart(2, '0');
  const call = { n, kind, scene: body.scene, attempt: body.attempt || 1, t: t0 };
  realCalls.push(call);
  if (kind === 'edit' || kind === 'follow') { putImg(`real-${id}-${kind}-${body.scene}-a${call.attempt}-sent.jpg`, body.crop); if (kind === 'follow') putImg(`real-${id}-follow-${body.scene}-reference.jpg`, body.follow.reference); }
  try {
    const out = await handleEdit(body, realEnv, realLedger, { log: (m) => console.log('    host: ' + m) });
    Object.assign(call, { ok: out.ok === true, ms: Date.now() - t0, model: out.model, reach: out.reach, living: out.living, usd: out.usd, ms_text: out.ms_text, ms_edit: out.ms_edit, reason: out.reason, held: out.held, prompt: out.prompt });
    if (out.image) putImg(`real-${id}-${kind}-${body.scene}-a${call.attempt}-answer.jpg`, out.image);
    send(200, out);
  } catch (e) {
    Object.assign(call, { ok: false, ms: Date.now() - t0, reason: e instanceof EditError ? e.reason : 'error', error: String(e && e.message || e).slice(0, 300) });
    console.log(`    host: ${kind} ${body.scene} FAILED ${call.reason} ${call.error}`);
    send(e instanceof EditError ? e.status : 500, { ok: false, reason: call.reason });
  } finally {
    fs.writeFileSync(path.join(OUT, 'real-ledger.json'), JSON.stringify({ cap: CAP, total: Number(realLedger.total().toFixed(4)), rows: realLedger.rows() }, null, 1) + '\n');
  }
}
let pageHtml = null;
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    if (p === '/api/edit' && REAL) { await realEdit(req, res); return; }
    if (p === '/api/edit') { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"ok":false,"reason":"rig"}'); return; } // the stub answers in the page
    if (p === '/index.html') { res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' }); res.end(pageHtml); return; }
    const file = await cached(p.slice(1));
    if (!file) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (err) { res.writeHead(500); res.end(String(err && err.message || err)); }
});

/* ── a small Chrome DevTools client (no dependency): one page, evaluate, wait, screenshot ───────────────────────────── */
function cdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const waits = new Map(), events = [];
    ws.addEventListener('open', () => resolve({
      send: (method, params = {}) => new Promise((ok, no) => { const n = ++id; waits.set(n, { ok, no, method }); ws.send(JSON.stringify({ id: n, method, params })); }),
      events,
      close: () => ws.close(),
    }));
    ws.addEventListener('error', () => reject(new Error('devtools socket failed')));
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && waits.has(m.id)) { const w = waits.get(m.id); waits.delete(m.id); if (m.error) w.no(new Error(w.method + ': ' + m.error.message)); else w.ok(m.result); } else if (m.method) events.push(m);
    });
  });
}

const failed = [];
const check = (name, ok, detail = '') => { if (ok) console.log('  ok   ' + name + (detail ? ' — ' + detail : '')); else { failed.push(name); console.error('  FAIL ' + name + (detail ? ' — ' + detail : '')); } };
const saveImg = (name, dataUrl) => { const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(String(dataUrl || '')); if (m) fs.writeFileSync(path.join(OUT, name), Buffer.from(m[2], 'base64')); };

let chrome = null;
const stop = () => { try { server.close(); } catch { /* closed */ } if (chrome && chrome.pid) { try { execFileSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { try { chrome.kill(); } catch { /* gone */ } } } };

try {
  if (REAL && !GO) {
    const worst = 3 * (TEXT_USD + MODELS.nb2.usd + 0.004) + 3 * 2 * (MODELS.nb2.usd + 0.004);
    console.log(`follow-live-check --real, dry: one typed change («${TEXT}») from ${ROOM} through the real handler: a text step, an editor (up to 3 attempts for people), a judge when needed, then up to 3 follow turns (up to 2 attempts each). Worst case about $${worst.toFixed(2)}, usually about $0.25. Nothing sent. Add --go --cap <usd>.`);
    process.exit(0);
  }
  if (REMOTE && (LIVE_DIR || REAL)) { console.error('follow-live-check: --remote takes a URL for --live and no --real'); process.exit(2); }
  if (REMOTE && !GO) {
    console.log(`follow-live-check --remote, dry: one typed change («${TEXT}») from ${ROOM} on the DEPLOYED page ${LIVE}, through its own edit function, paid by that host: usually about $0.25, worst case about $0.8. Nothing sent. Add --go.`);
    process.exit(0);
  }
  if (REAL && !realEnv.FAL_KEY) { console.error('follow-live-check: no FAL_KEY in the environment or in a keys file above this folder'); process.exit(3); }
  if (!REMOTE) { pageHtml = await page(); await new Promise((r) => server.listen(0, '127.0.0.1', r)); }
  const BASE = REMOTE ? LIVE : `http://127.0.0.1:${server.address().port}/`;
  const DBG = 9400 + Math.floor(Math.random() * 400);
  chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG, '--user-data-dir=' + path.join(PROFILE, '_chrome-profile'), '--mute-audio', '--no-first-run', '--no-default-browser-check', `--window-size=${VW},${VH}`, 'about:blank'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try { target = (await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
  }
  if (!target) throw new Error('Chrome did not open its devtools port');
  const c = await cdp(target.webSocketDebuggerUrl);
  await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Log.enable');
  const phone = VW < 600;
  await c.send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
  if (phone) await c.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const ev = async (expression) => { const r = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
  const waitFor = async (expression, ms, what) => { const t = Date.now(); for (;;) { if (await ev(`Boolean(${expression})`)) return Date.now() - t; if (Date.now() - t > ms) throw new Error('timed out waiting for ' + what); await new Promise((r) => setTimeout(r, 200)); } };
  const shot = async (name) => { const r = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64')); };
  const idle = `window.__tour.applying === false && window.__tour.viewer.isLoaded()`;
  // the strip lists the page's scenes in order, the exterior chain first when the page carries it: a room's card is counted from the end
  const goRoom = async (id) => { await ev(`(() => { const b = document.querySelectorAll('#t-strip [role=listitem] button'), rooms = window.__tour.hooks.rooms(); b[b.length - rooms.length + rooms.indexOf(${JSON.stringify(id)})].click(); })()`); await waitFor(`window.__tour.scene === ${JSON.stringify(id)} && ${idle}`, 30000, 'room ' + id); };
  /** One typed change and its follow turns, start to finish; → the page's own account. */
  const typeChange = async () => {
    const n0 = await ev('window.__stubCalls.length');
    await ev(`(() => { const i = document.getElementById('t-bar-input'); i.value = ${JSON.stringify(TEXT)}; document.getElementById('t-change-bar').requestSubmit(); })()`);
    const first = await waitFor(`window.__tour.lastTurn && window.__tour.lastTurn.text === ${JSON.stringify(TEXT)} && window.__tour.lastTurn.ms_total > 0 && (window.__tour.live[${JSON.stringify(ROOM)}] || []).length > 0`, 60000, 'the first change on screen');
    const all = await waitFor(`window.__tour.lastTurn.follow && window.__tour.lastTurn.follow.ms !== null`, 120000, 'the follow turns');
    await waitFor(idle, 30000, 'the page at rest');
    const turn = await ev('JSON.parse(JSON.stringify(window.__tour.lastTurn))');
    const calls = await ev(`window.__stubCalls.slice(${n0})`);
    return { first, all, turn, calls };
  };

  await c.send('Page.navigate', { url: `${BASE}?scope=apartment&room=${ROOM}&floor=parquet&video=0&coach=0&auto=0` });
  await waitFor('window.__tour && window.__tour.ready === true && window.__tour.liveReady === true', 90000, 'the tour page');
  await waitFor(idle, 30000, 'the first room');
  if (REMOTE) { // the page's own facts: nothing was read from disk
    facts.remote = true;
    facts.apartment = await ev(`JSON.parse(document.getElementById('tour-data').textContent).id`);
    facts.pxPerCm = await ev('window.__tour.hooks.planPxPerM() / 100');
    facts.served_vs_head_lines = { 'tour.js': 'not compared', 'edit-live.js': 'not compared' };
  }
  console.log(`follow-live-check ${tag} · ${facts.apartment} · ${ROOM} look ${LOOK.join(',')} · served viewer vs this checkout's HEAD (lines apart): tour.js ${facts.served_vs_head_lines['tour.js']}, edit-live.js ${facts.served_vs_head_lines['edit-live.js']}`);
  check('the page is unlocked and can follow', await ev('window.__tour.unlocked === true && window.__tour.follow.on === true'));
  check('the page knows the plan scale and where the room stands', await ev(`window.__tour.hooks.planPxPerM() === ${facts.pxPerCm * 100} && Boolean(window.__tour.hooks.place(${JSON.stringify(ROOM)}))`), `${facts.pxPerCm} px/cm`);

  if (REAL || REMOTE) {
    const pre = REMOTE ? 'remote' : 'real';
    // ── the paid proof: one typed change through the real handler and editors; what lands is recorded, not asserted ──
    await ev(`window.__tour.viewer.lookAt(${LOOK[0]}, ${LOOK[1]}, ${LOOK[2]}, false)`);
    await new Promise((r) => setTimeout(r, 600));
    await shot(`${pre}-${tag}-1-before-${ROOM}.jpg`);
    const t0 = Date.now();
    await ev(`(() => { const i = document.getElementById('t-bar-input'); i.value = ${JSON.stringify(TEXT)}; document.getElementById('t-change-bar').requestSubmit(); })()`);
    await waitFor(`window.__tour.lastTurn && window.__tour.lastTurn.text === ${JSON.stringify(TEXT)} && (window.__tour.lastTurn.error || (window.__tour.lastTurn.ms_total > 0 && (window.__tour.live[${JSON.stringify(ROOM)}] || []).length > 0))`, 400000, 'the first change');
    const msFirst = Date.now() - t0;
    let turn = await ev('JSON.parse(JSON.stringify(window.__tour.lastTurn))');
    check('the first change landed in its own room', !turn.error && turn.ms_total > 0, turn.error ? JSON.stringify(turn.error) : `${(msFirst / 1000).toFixed(1)} s from the request to the picture; attempts ${JSON.stringify(turn.attempts.map((a) => [a.model, a.held, a.ms_text, a.ms_edit, a.ring, a.fraction]))}`);
    await waitFor(idle, 60000, 'the page at rest');
    await shot(`${pre}-${tag}-2-after-${ROOM}.jpg`);
    if (!turn.error) {
      await waitFor(`window.__tour.lastTurn.follow && window.__tour.lastTurn.follow.ms !== null`, 500000, 'the follow turns');
      await waitFor(idle, 60000, 'the page at rest');
      turn = await ev('JSON.parse(JSON.stringify(window.__tour.lastTurn))');
      const f = turn.follow;
      check('the page aimed other rooms at the spot', (f.targets || []).length >= 1, JSON.stringify(f.targets) + (f.skip ? ' skip: ' + f.skip : ''));
      for (const r of f.rooms) check(`${r.room}: the change landed there`, r.ok === true, `${(r.ms / 1000).toFixed(1)} s · ${r.reason || 'ok'} · attempts ${JSON.stringify(r.attempts.map((a) => [a.model, a.held, a.ring, a.fraction, a.judge ? a.judge.held : null]))}`);
      console.log(`  every other room was done ${((Date.now() - t0 - msFirst) / 1000).toFixed(1)} s after the first picture`);
      for (const t of f.targets || []) {
        if (!f.rooms.find((r) => r.room === t.room && r.ok)) continue;
        await goRoom(t.room);
        await ev(`window.__tour.viewer.lookAt(${t.pitch}, ${t.yaw}, ${phone ? 70 : 85}, false)`);
        await new Promise((r) => setTimeout(r, 800));
        await shot(`${pre}-${tag}-3-entered-${t.room}.jpg`);
      }
    }
    // what was booked: this process's own ledger, or — on a deployed host — the page's account of the changes that landed
    const booked = REMOTE ? await ev('Object.values(window.__tour.liveMeta).flat().reduce((t, m) => t + (m.usd || 0), 0)') : realLedger.total();
    const errs = c.events.filter((m) => m.method === 'Runtime.exceptionThrown').map((m) => (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 240));
    fs.writeFileSync(path.join(OUT, `${pre}-${tag}-record.json`), JSON.stringify({ ...facts, real: !REMOTE, remote: REMOTE, when: new Date().toISOString(), cap: CAP, booked: Number(booked.toFixed(4)), ms_first_picture: msFirst, turn, calls: (REMOTE ? [] : realCalls).map(({ prompt, ...x }) => ({ ...x, prompt: prompt ? prompt.slice(0, 400) : undefined })), failed, errors: errs }, null, 2) + '\n');
    console.log(REMOTE ? `  the page's own account of what landed: $${booked.toFixed(3)} (a refused attempt and a judge are not in it; the deployed host keeps its own ledger)` : `  booked $${booked.toFixed(3)} of the $${CAP.toFixed(2)} cap · ${realCalls.length} calls to the host`);
    c.close();
    stop();
    console.log(failed.length ? `\nfollow-live-check ${pre} ${tag}: ${failed.length} NOT as hoped` : `\nfollow-live-check ${pre} ${tag}: done`);
    process.exit(failed.length ? 1 : 0);
  }
  // ── round 1: every aimed room answers ──
  await ev(`window.__tour.viewer.lookAt(${LOOK[0]}, ${LOOK[1]}, ${LOOK[2]}, false)`);
  await new Promise((r) => setTimeout(r, 600));
  await shot(`${tag}-1-before-${ROOM}.jpg`);
  const r1 = await typeChange();
  const f1 = r1.turn.follow, edits = r1.calls.filter((x) => x.op === 'edit'), follows = r1.calls.filter((x) => x.op === 'follow');
  await shot(`${tag}-2-after-${ROOM}.jpg`);
  saveImg(`${tag}-crop-${ROOM}-first.jpg`, edits[0] && edits[0].crop);
  for (const x of follows) { saveImg(`${tag}-crop-${x.scene}-follow.jpg`, x.crop); if (x === follows[0]) saveImg(`${tag}-reference.jpg`, x.reference); }
  const aimed = (f1.targets || []).map((t) => t.room);
  check('the first change is on screen in its own room', r1.turn.attempts.length >= 1 && r1.turn.attempts[r1.turn.attempts.length - 1].held === true, `${r1.first} ms to the picture, host step times ${JSON.stringify([r1.turn.attempts[0].ms_text, r1.turn.attempts[0].ms_edit])}`);
  check('the spot was placed on the plan', f1.skip === null && !!f1.spot, JSON.stringify(f1.spot));
  check('the page aimed other rooms at the spot', aimed.length >= 1 && aimed.length <= 3 && !aimed.includes(ROOM), JSON.stringify(f1.targets));
  if (EXPECT.length) check('the aimed rooms include ' + EXPECT.join(', '), EXPECT.every((id) => aimed.includes(id)), 'aimed: ' + aimed.join(', '));
  check('one follow turn per aimed room, none for the first room', follows.length === aimed.length && aimed.every((id) => follows.some((x) => x.scene === id)));
  check('each follow turn carries the first turn\'s token, the first room\'s view as a JPEG under 1.2 MB, and no words of its own',
    follows.every((x) => x.token === 'stub-token.stub-signature' && x.from === ROOM && x.instruction === null && /^data:image\/jpeg;base64,/.test(x.reference) && x.reference.length * 0.75 < 1_200_000 && /^data:image\/jpeg;base64,/.test(x.crop)),
    follows[0] ? `reference ${Math.round(follows[0].reference.length * 0.75 / 1024)} KB` : '');
  if (follows.length > 1) {
    const starts = follows.map((x) => x.t), ends = follows.map((x) => x.done);
    check('the follow turns went out side by side', Math.max(...starts) < Math.min(...ends), `starts within ${Math.max(...starts) - Math.min(...starts)} ms; all done ${r1.all} ms after the first picture`);
  }
  check('every aimed room took the change', f1.rooms.length === aimed.length && f1.rooms.every((x) => x.ok === true), JSON.stringify(f1.rooms.map((x) => [x.room, x.ok, x.reason || '', x.ms])));
  const stacks = await ev(`(() => { const o = {}; for (const [k, v] of Object.entries(window.__tour.liveMeta)) o[k] = v.map((m) => ({ follow: m.follow === true, linked_to: m.linked_to ? m.linked_to.room : null, linked: Array.isArray(m.linked) ? m.linked.map((l) => l.room) : null, fraction: m.fraction })); return o; })()`);
  check('each aimed room has one change on its stack, linked to the first; the first lists them', aimed.every((id) => stacks[id] && stacks[id].length === 1 && stacks[id][0].follow && stacks[id][0].linked_to === ROOM) && stacks[ROOM] && stacks[ROOM].length === 1 && aimed.every((id) => (stacks[ROOM][0].linked || []).includes(id)), JSON.stringify(stacks));
  // entering a followed room shows its changed picture, at the place the page aimed
  for (const t of f1.targets || []) {
    await goRoom(t.room);
    const key = await ev('window.__tour.viewer.getScene()');
    await ev(`window.__tour.viewer.lookAt(${t.pitch}, ${t.yaw}, ${phone ? 70 : 80}, false)`);
    await new Promise((r) => setTimeout(r, 700));
    await shot(`${tag}-3-entered-${t.room}.jpg`);
    check(`entering ${t.room} shows its changed picture`, String(key).startsWith(t.room + '~live1'), key);
  }
  // undo in the first room clears every room
  await goRoom(ROOM);
  await ev(`document.getElementById('t-undo').click()`);
  await waitFor(`Object.keys(window.__tour.live).length === 0 && ${idle}`, 30000, 'the undo');
  check('undo in the first room clears every room', await ev('Object.keys(window.__tour.live).length === 0'));

  // ── round 2: one room comes back unchanged, one is refused by the cap ──
  let r2 = null, r3 = null;
  if (aimed.length >= 2) {
    await ev(`window.__stubFail = ${JSON.stringify({ [aimed[0]]: 'unchanged', [aimed[1]]: 'cap' })}`);
    await ev(`window.__tour.viewer.lookAt(${LOOK[0]}, ${LOOK[1]}, ${LOOK[2]}, false)`);
    await new Promise((r) => setTimeout(r, 600));
    r2 = await typeChange();
    const by = Object.fromEntries(r2.turn.follow.rooms.map((x) => [x.room, x]));
    const live2 = await ev('JSON.parse(JSON.stringify(window.__tour.live))');
    check('a room where nothing changed is reported "not in view" and gets no change', by[aimed[0]] && by[aimed[0]].ok === false && by[aimed[0]].reason === 'not_in_view' && !live2[aimed[0]], JSON.stringify(by[aimed[0]]));
    check('a room the cap refused is reported and gets no change', by[aimed[1]] && by[aimed[1]].ok === false && by[aimed[1]].reason === 'cap' && !live2[aimed[1]], JSON.stringify(by[aimed[1]]));
    check('the first change still stands in its own room', (live2[ROOM] || []).length === 1);
    await shot(`${tag}-4-refused-note.jpg`);
    await ev(`window.__stubFail = {}`);
    // ── round 3: one room's answer comes back drawn far too large — the paid proof's failure (2026-11-16), replayed ──
    await ev(`document.getElementById('t-undo').click()`);
    await waitFor(`Object.keys(window.__tour.live).length === 0 && ${idle}`, 30000, 'the undo');
    await ev(`window.__stubFail = ${JSON.stringify({ [aimed[0]]: 'huge' })}`);
    await ev(`window.__tour.viewer.lookAt(${LOOK[0]}, ${LOOK[1]}, ${LOOK[2]}, false)`);
    await new Promise((r) => setTimeout(r, 600));
    r3 = await typeChange();
    const by3 = Object.fromEntries(r3.turn.follow.rooms.map((x) => [x.room, x]));
    const live3 = await ev('JSON.parse(JSON.stringify(window.__tour.live))');
    const big = by3[aimed[0]];
    const judges3 = r3.calls.filter((x) => x.op === 'judge' && x.scene === aimed[0]);
    check('a room whose answer came back far too large goes to the anchor judge, is refused on both attempts and gets no change', big && big.ok === false && big.reason === 'redrawn' && big.attempts.length === 2 && big.attempts.every((a) => a.held === false && a.judge && a.judge.held === false) && judges3.length === 2 && judges3.every((x) => x.anchor === true) && !live3[aimed[0]], big ? JSON.stringify(big.attempts.map((a) => ({ ring: a.ring, fraction: a.fraction, judge: a.judge && a.judge.held }))) : 'no record');
    check('the right-size answer in the other room is still taken, without a judge', by3[aimed[1]] && by3[aimed[1]].ok === true && by3[aimed[1]].attempts[0].judge === null, by3[aimed[1]] ? JSON.stringify(by3[aimed[1]].attempts.map((a) => ({ ring: a.ring, fraction: a.fraction }))) : 'no record');
    await ev(`window.__stubFail = {}`);
  }
  const errors = c.events.filter((m) => m.method === 'Runtime.exceptionThrown' || (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon|404/.test(m.params.entry.text + ' ' + (m.params.entry.url || '')))).map((m) => (m.method === 'Runtime.exceptionThrown' ? m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text : m.params.entry.text).slice(0, 240));
  check('no page error during the run', errors.length === 0, errors.slice(0, 3).join(' | '));

  const strip = (x) => ({ ...x, crop: undefined, reference: x.reference ? Math.round(x.reference.length * 0.75) + ' bytes' : null });
  fs.writeFileSync(path.join(OUT, `${tag}-record.json`), JSON.stringify({ ...facts, when: new Date().toISOString(), failed, round1: { ms_first_picture: r1.first, ms_follow_after: r1.all, turn: r1.turn, calls: r1.calls.map(strip), stacks }, round2: r2 ? { turn: r2.turn, calls: r2.calls.map(strip) } : null, round3: r3 ? { turn: r3.turn, calls: r3.calls.map(strip) } : null, errors }, null, 2) + '\n');
  c.close();
} catch (err) {
  console.error('follow-live-check: the rig failed — ' + (err && err.message || err));
  stop();
  process.exit(2);
}
stop();
console.log(failed.length ? `\nfollow-live-check ${tag}: ${failed.length} FAILED` : `\nfollow-live-check ${tag}: all checks passed`);
process.exit(failed.length ? 1 : 0);

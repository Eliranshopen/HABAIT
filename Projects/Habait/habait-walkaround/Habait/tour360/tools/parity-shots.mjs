#!/usr/bin/env node
/* Habait Tour360 — parity-shots.mjs (board habait-walkaround T15/T18, D-T360-46 step 1).
   The same states on TWO builds of the tour, side by side: the reference (default the live design link
   https://habait-tour-design.vercel.app) and the candidate (default dist/<id>/ — an `--engine` build — served on 127.0.0.1).
   Per cell (phone 390×844 touch dsf 2 · desktop 1440×900) and language: the first room, a door (living → kitchen), the floor-plan
   sheet, the rooms strip's next room, the prepared changes panel and one prepared change applied. Each state is captured on both,
   pasted into ONE pair image (reference | candidate) for the eye, with the times (ready, a room change) and the page errors.
   Usage (from the harness root, Git Bash):
     timeout 540 node Habait/tour360/tools/parity-shots.mjs demo-01 [--lang he] [--ref <url>] [--cand <url>] [--out <dir>] [--cells phone,desktop]
   Writes <out>/<cell>-<lang>/NN-state.pair.jpg (+ the raw NN-state.{ref,cand}.png with --keep-raw) + parity-<lang>.json
   (default qa-evidence/tour360/walkaround/T15). */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');
const REPO = path.resolve(ROOT, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const id = process.argv[2] || 'demo-01';
const lang = arg('--lang', 'he');
const REF = arg('--ref', 'https://habait-tour-design.vercel.app/');
let CAND = arg('--cand', null);
const OUT = path.resolve(arg('--out', path.join(REPO, 'qa-evidence', 'tour360', 'walkaround', 'T15')));
const CELLS = arg('--cells', 'phone,desktop').split(',');
const { chromium } = createRequire('D:/AgentTeams/RealEstateTeam/Habait/MVP/app/package.json')('playwright-core');

let server = null;
if (!CAND) {
  const DIST = path.join(ROOT, 'dist', id);
  if (!fs.existsSync(path.join(DIST, 'engine.js'))) { console.error('parity-shots: dist/' + id + ' is not an --engine build'); process.exit(2); }
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
  server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (u.startsWith('/api/')) { res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"configured":false}'); return; }
    let f = path.join(DIST, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
    if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  CAND = `http://127.0.0.1:${server.address().port}/`;
}

const SIZES = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const report = { when: new Date().toISOString(), ref: REF, cand: CAND, lang, cells: [] };

/** The states, driven through the page's own controls and its __tour hook only — the same calls on both builds */
const STATES = [
  ['first-room', async () => {}],
  ['door-kitchen', async (p) => { await goRoom(p, 'kitchen'); }],
  ['plan-sheet', async (p) => { await p.click('#t-plan-btn'); await p.waitForTimeout(700); }],
  ['plan-closed', async (p) => { await p.keyboard.press('Escape'); await p.waitForTimeout(500); }],
  ['prepared-panel', async (p) => { await goRoom(p, 'living'); await p.click('#t-change-btn'); await p.waitForTimeout(700); }],
  ['prepared-sofa', async (p) => { await p.click('.t-change-item[data-edit="sofa"]'); await p.waitForTimeout(400); await p.waitForFunction(() => !window.__tour.applying, null, { timeout: 30000 }).catch(() => {}); await p.keyboard.press('Escape'); await p.waitForTimeout(1500); }],
];
/** a room through the rooms strip (its cards are in scene order) — the visitor's own control on both builds */
async function goRoom(p, room) {
  const t0 = Date.now();
  const before = await p.evaluate(() => window.__tour.loads);
  await p.evaluate((r) => {
    const i = JSON.parse(document.getElementById('tour-data').textContent).scenes.findIndex((s) => s.id === r);
    document.querySelectorAll('#t-strip .t-card')[i].click();
  }, room);
  await p.waitForFunction(({ r, n }) => window.__tour.scene === r && window.__tour.loads > n, { r: room, n: before }, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(900);
  return Date.now() - t0;
}

async function capture(url, cell, side, dir) {
  const ctx = await browser.newContext(SIZES[cell]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/')) errors.push(`http ${r.status()}: ${r.url()}`); });
  const t0 = Date.now();
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'lang=' + lang, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 60000 }).catch(() => errors.push('never ready'));
  const readyMs = Date.now() - t0;
  await page.waitForTimeout(1200);
  const shots = [];
  const times = { readyMs };
  for (const [i, [name, act]] of STATES.entries()) {
    const s0 = Date.now();
    try { await act(page); } catch (e) { errors.push(`${name}: ${e.message}`); }
    if (name === 'door-kitchen') times.roomChangeMs = Date.now() - s0;
    const f = path.join(dir, `${String(i + 1).padStart(2, '0')}-${name}.${side}.png`);
    await page.screenshot({ path: f });
    shots.push(f);
  }
  const engine = await page.evaluate(() => (window.pannellum && window.pannellum.engine) || 'pannellum');
  await ctx.close();
  return { shots, times, errors, engine };
}

try {
  for (const cell of CELLS) {
    const dir = path.join(OUT, `${cell}-${lang}`);
    fs.mkdirSync(dir, { recursive: true });
    const ref = await capture(REF, cell, 'ref', dir);
    const cand = await capture(CAND, cell, 'cand', dir);
    // pair images: reference | candidate, scaled to one height
    const pairPage = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
    for (let i = 0; i < STATES.length; i++) {
      const a = fs.readFileSync(ref.shots[i]).toString('base64'), b = fs.readFileSync(cand.shots[i]).toString('base64');
      const data = await pairPage.evaluate(async ({ a, b, label }) => {
        const load = (s) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + s; });
        const [A, B] = await Promise.all([load(a), load(b)]);
        const H = Math.min(900, A.height), wa = A.width * H / A.height, wb = B.width * H / B.height;
        const c = document.createElement('canvas'); c.width = Math.round(wa + wb + 24); c.height = H + 34;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(A, 0, 34, wa, H); g.drawImage(B, wa + 24, 34, wb, H);
        g.fillStyle = '#111'; g.font = '16px sans-serif'; g.fillText('design link (reference) — ' + label, 8, 22); g.fillText('new engine (candidate)', wa + 32, 22);
        return c.toDataURL('image/jpeg', 0.88);
      }, { a, b, label: STATES[i][0] });
      fs.writeFileSync(path.join(dir, `${String(i + 1).padStart(2, '0')}-${STATES[i][0]}.pair.jpg`), Buffer.from(data.split(',')[1], 'base64'));
    }
    await pairPage.context().close();
    // the raw per-side captures are intermediates: the pairs are the evidence (keep them with --keep-raw)
    if (!process.argv.includes('--keep-raw')) for (const f of [...ref.shots, ...cand.shots]) fs.rmSync(f, { force: true });
    report.cells.push({ cell, lang, ref: { engine: ref.engine, ...ref.times, errors: ref.errors }, cand: { engine: cand.engine, ...cand.times, errors: cand.errors } });
    console.log(`${cell}-${lang}: ref ${ref.engine} ready ${ref.times.readyMs} ms, room ${ref.times.roomChangeMs} ms, errors ${ref.errors.length} · cand ${cand.engine} ready ${cand.times.readyMs} ms, room ${cand.times.roomChangeMs} ms, errors ${cand.errors.length}`);
    for (const e of cand.errors.slice(0, 4)) console.log('  cand: ' + e);
  }
} finally {
  await browser.close();
  if (server) server.close();
}
fs.writeFileSync(path.join(OUT, `parity-${lang}.json`), JSON.stringify(report, null, 1));
const bad = report.cells.reduce((n, c) => n + c.cand.errors.length, 0);
console.log(bad ? `parity-shots: ${bad} candidate errors` : 'parity-shots: OK (now open the pairs)');
process.exit(bad ? 1 : 0);

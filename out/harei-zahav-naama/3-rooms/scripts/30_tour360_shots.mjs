/* Step 30 - the 360 tour's browser proof ($0, no vendor call). Serves tour360/dist/hatzav on 127.0.0.1 with a STUB /api/edit that
   says "configured, open" on GET (so the page shows the swap rings and the typed line, as an unlocked host would) and refuses every
   POST with 503 before anything is sent anywhere - no paid call can leave this script. Drives headless Chrome (playwright-core from
   C:/RnD/Projects/3Dengine/appdeps) at 1440x900 and 390x844 (touch), saves screenshots and a JSON record to <out>.
   Usage: node scripts/30_tour360_shots.mjs <dist dir> <out dir> [port] */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const DIST = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const PORT = Number(process.argv[4] || 8897);
const { chromium } = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json')('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.css': 'text/css' };
const posts = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/edit') {
    res.writeHead(req.method === 'GET' ? 200 : 503, { 'content-type': 'application/json' });
    if (req.method !== 'GET') posts.push(new Date().toISOString());
    return res.end(JSON.stringify(req.method === 'GET' ? { configured: true, open: true, stub: true, record: false, catalog: { items: 24 } } : { ok: false, reason: 'keys', message: 'local stub: no paid call' }));
  }
  const f = path.join(DIST, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const base = `http://127.0.0.1:${PORT}/`;
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const record = { base, shots: [], errors: [], failed: [] };
const data = JSON.parse(fs.readFileSync(path.join(DIST, 'index.html'), 'utf8').match(/<script type="application\/json" id="tour-data">([\s\S]*?)<\/script>/)[1]);
const rooms = data.scenes.map((s) => s.id);
const want = ['living', 'bedroom', 'kitchen', 'saferoom', 'dining', 'deck'].filter((r) => rooms.includes(r));
const firstMarker = data.scenes.map((s) => ({ room: s.id, m: (s.markers || []).find((m) => m.category === 'sofa') || (s.markers || [])[0] })).filter((x) => x.m).sort((a, b) => (a.room === 'living' ? -1 : b.room === 'living' ? 1 : 0))[0];

async function session(name, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => record.errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') record.errors.push(`${name} console: ${m.text()}`); });
  page.on('requestfailed', (r) => record.failed.push(`${name}: ${r.url()} ${r.failure() && r.failure().errorText}`));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/edit')) record.failed.push(`${name}: ${r.status()} ${r.url()}`); });
  const settle = async () => {
    await page.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 60000 });
    await page.waitForTimeout(2500);
    const skip = page.locator('#t-coach-skip');
    if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(600); }
  };
  for (const room of want) {
    await page.goto(base + '?room=' + room, { waitUntil: 'load' });
    await settle();
    const st = await page.evaluate(() => ({ scene: window.__tour.scene, unlocked: Boolean(window.__tour.liveReady), markers: document.querySelectorAll('.t-mk').length, badge: (document.getElementById('tour-badge') || {}).textContent, concept: (document.getElementById('tour-concept') || {}).textContent }));
    const file = `${name}-${room}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    record.shots.push({ file, ...st });
  }
  if (firstMarker) {
    await page.goto(base + '?room=' + firstMarker.room, { waitUntil: 'load' });
    await settle();
    await page.waitForFunction(() => window.__tour.liveReady === true, null, { timeout: 20000 }).catch(() => {});
    await page.evaluate((d) => document.dispatchEvent(new CustomEvent('tour:marker', { detail: d })), { room: firstMarker.room, id: firstMarker.m.id });
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ pick: window.__tour.pick ? { room: window.__tour.pick.room, category: window.__tour.pick.category || null } : null, pickVisible: !document.getElementById('t-pick').hidden, items: document.querySelectorAll('#t-catalog-bar button, #t-catalog-bar [role="listitem"]').length }));
    const file = `${name}-swap-${firstMarker.room}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    record.shots.push({ file, marker: firstMarker.m.id, ...st });
  }
  // the plan sheet
  await page.goto(base + '?room=' + want[0], { waitUntil: 'load' });
  await settle();
  await page.evaluate(() => document.getElementById('t-plan-btn').click());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `${name}-plan.png`) });
  record.shots.push({ file: `${name}-plan.png`, sheetOpen: await page.evaluate(() => !document.getElementById('t-sheet').hidden) });
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  // the ruler: the room's depth map loads and a point on the floor ahead measures a distance
  const ruler = await page.evaluate(async () => { const h = window.__tour.hooks_measure; if (!h) return { hooks: false }; const dm = await h.depthFor(window.__tour.scene); h.setMeasure(true); return { hooks: true, depth: dm ? [dm.w, dm.h] : null, rulerButton: !document.getElementById('t-ruler').hidden }; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `${name}-ruler.png`) });
  record.shots.push({ file: `${name}-ruler.png`, ...ruler });
  await page.evaluate(() => window.__tour.hooks_measure && window.__tour.hooks_measure.setMeasure(false));
  // the voice tour (written narration): start, the card shows, stop
  const g = await page.evaluate(async () => { const h = window.__tour.hooks_guide; if (!h) return { hooks: false }; h.start(); await new Promise((r) => setTimeout(r, 2500)); return { hooks: true, on: h.on, text: (document.getElementById('t-guide-text') || {}).textContent }; });
  await page.screenshot({ path: path.join(OUT, `${name}-guide.png`) });
  record.shots.push({ file: `${name}-guide.png`, ...g });
  await page.evaluate(() => window.__tour.hooks_guide && window.__tour.hooks_guide.stop());
  await ctx.close();
}
try {
  await session('desktop-1440', { viewport: { width: 1440, height: 900 } });
  await session('phone-390', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
} finally {
  await browser.close();
  server.close();
}
record.paidPostsRefused = posts.length;
fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(record, null, 1) + '\n');
console.log(`shots: ${record.shots.length} · errors ${record.errors.length} · failed requests ${record.failed.length} · POSTs refused by the stub ${posts.length}`);
for (const s of record.shots) console.log('  ' + JSON.stringify(s).slice(0, 220));
for (const e of record.errors.slice(0, 10)) console.log('  ERR ' + e.slice(0, 220));
for (const e of record.failed.slice(0, 10)) console.log('  FAIL ' + e.slice(0, 220));

/* coverage-probe.mjs — do the permanent lines stay clear? (T16i, after the warden's T15a read, finding F2; $0)

   Usage:
     timeout 540 node Habait/tour360/tools/coverage-probe.mjs <apartment> --lang he|en|fr [--out <json>] [--shots <dir>]
                                                              [--room living --marker living-270-1 --item kivik-3]

   Serves a `--catalog` build of the apartment from `dist/<apartment>/` on 127.0.0.1 (an ephemeral port), stubs `GET api/edit`
   ({ configured: true }) so the page unlocks, refuses and counts any POST (nothing is ever sent to a vendor). For every viewport of
   the matrix below and six states — A the locked public page · B unlocked · F the prepared-changes panel open (T18m) · E the pick
   bar alone · C a placed product with its item card · D the card and the pick bar together — it measures how many text lines of the three PERMANENT elements (the הדמיה badge,
   the concept line, the AI note) and of the card's own line are covered by something else: `document.elementsFromPoint` at three
   points per line (the title's pointer-events lifted for the measurement — the warden's method). The card is raised by the page's
   own path (`hooks.pushLive(room, canvas, label, { item })`), the pick bar by the page's own `tour:marker` event.
   PASS = 0 covered lines in every cell and no sideways scroll; exit 1 otherwise. One language per run (about 2 minutes); run it
   under `timeout 540`, one heavy run at a time (root CLAUDE.md §11). `--shots` writes PNG frames of the key cells (convert them to
   lossless WebP with qa-evidence/_tools/webp-lossless.mjs before filing). */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs'; // a worktree has no Habait/MVP/app (board habait-walkaround T18)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const apartment = args.find((a) => !a.startsWith('--')) || 'demo-01';
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const LANG = arg('--lang', 'he'), OUT = arg('--out', null), SHOTS = arg('--shots', null);
const ROOM = arg('--room', 'living'), MARKER = arg('--marker', 'living-270-1'), ITEM = arg('--item', 'kivik-3');
const DIST = path.normalize(path.join(ROOT, 'dist', apartment));
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error(`no build at ${DIST} — run build-tour.mjs ${apartment} --catalog first`); process.exit(2); }
const { chromium } = appRequire(REPO)('playwright-core');
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(DIST, p));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
// the matrix: the phone sizes the warden measured (portrait and landscape), two tablets, four desktops
const VIEWPORTS = [[320, 568], [360, 640], [360, 740], [360, 800], [375, 667], [390, 844], [393, 852], [412, 915], [414, 896], [428, 926],
  [667, 375], [844, 390], [768, 1024], [1024, 600], [1280, 720], [1366, 768], [1440, 900]];
const KEY = new Set(['375x667/C card', '375x667/D card+pick', '320x568/C card', '360x640/D card+pick', '667x375/C card', '667x375/E pick only', '844x390/D card+pick', '390x844/D card+pick', '1024x600/D card+pick', '1440x900/D card+pick', '390x844/F panel', '1440x900/F panel']);
const MEASURE = () => {
  const top = (x, y) => document.elementsFromPoint(x, y)[0] || null;
  const lines = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return [...rg.getClientRects()].filter((r) => r.width > 2 && r.height > 2); };
  const cov = (id) => {
    const el = document.getElementById(id); if (!el || el.hidden) return null;
    const ls = lines(el); let covered = 0; const who = [];
    for (const r of ls) {
      const y = (r.top + r.bottom) / 2; let any = false;
      for (const x of [r.left + r.width * 0.1, r.left + r.width * 0.5, r.left + r.width * 0.9]) {
        if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) { any = true; who.push(`offscreen(${Math.round(x)},${Math.round(y)})`); continue; }
        const t = top(x, y); if (!(t && (t === el || el.contains(t)))) { any = true; who.push(t ? (t.id ? '#' + t.id : '.' + String(t.className).split(' ')[0]) + `@${Math.round(x)},${Math.round(y)}` : 'none'); }
      }
      if (any) covered++;
    }
    return { covered, total: ls.length, ...(who.length ? { who: [...new Set(who)].slice(0, 4) } : {}) };
  };
  const badge = (() => { const el = document.getElementById('tour-badge'); const r = el.getBoundingClientRect(); const t = top(r.left + r.width / 2, r.top + r.height / 2); return { covered: (t && (t === el || el.contains(t))) ? 0 : 1, total: 1 }; })();
  return { badge, concept: cov('tour-concept'), ai: cov('tour-ai-note'), note: cov('t-item-note'), scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
    card: !document.getElementById('t-item-card').hidden, pick: !document.getElementById('t-pick').hidden, strip: getComputedStyle(document.getElementById('t-strip')).display !== 'none' };
};
const rows = []; let posts = 0;
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] });
try {
  for (const [w, h] of VIEWPORTS) {
    const mobile = w < 800 || h < 500;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    await page.route('**/api/edit', async (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, catalog: { items: 5 } }) });
      posts++; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'not_configured' }) });
    });
    const lift = () => page.addStyleTag({ content: '.t-title, .t-title * { pointer-events: auto !important; }' });
    const ready = () => page.waitForFunction(() => window.__tour && window.__tour.ready === true && window.__tour.viewer && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
    const settle = () => page.waitForTimeout(500);
    const rec = async (state, m) => {
      rows.push({ viewport: `${w}x${h}`, lang: LANG, state, ...m });
      if (SHOTS && KEY.has(`${w}x${h}/${state}`)) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `layout-${w}x${h}-${state.split(' ')[0]}-${LANG}.png`) }); }
    };
    const openPick = () => page.evaluate(([room, id]) => document.dispatchEvent(new CustomEvent('tour:marker', { detail: { room, id } })), [ROOM, MARKER]);
    try {
      await page.goto(base + `?lang=${LANG}&room=${ROOM}`, { waitUntil: 'load', timeout: 60000 }); await ready(); await lift(); await settle();
      await rec('A locked', await page.evaluate(MEASURE));
      await page.goto(base + `?lang=${LANG}&room=${ROOM}&key=probe`, { waitUntil: 'load', timeout: 60000 }); await ready();
      await page.waitForFunction(() => window.__tour.liveReady === true, null, { timeout: 60000 }); await lift(); await settle();
      await rec('B unlocked', await page.evaluate(MEASURE));
      // T18m (F16, D-CAT-26): the prepared-changes panel open — the permanent lines must stay legible above the backdrop
      await page.click('#t-change-btn'); await page.waitForFunction(() => document.getElementById('t-change').hidden === false, null, { timeout: 5000 }); await settle();
      await rec('F panel', await page.evaluate(MEASURE));
      await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('t-change').hidden === true, null, { timeout: 5000 }); await settle();
      await openPick(); await page.waitForSelector('#t-pick:not([hidden]) .t-catalog-item', { timeout: 10000 }); await settle();
      await rec('E pick only', await page.evaluate(MEASURE));
      await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('t-pick').hidden === true, null, { timeout: 5000 }); await settle();
      await page.evaluate(async ([room, item]) => { const hk = window.__tour.hooks; const c = await hk.currentCanvas(room); await hk.pushLive(room, c, 'coverage probe', { item }); }, [ROOM, ITEM]);
      await page.waitForFunction(() => window.__tour.applying === false && !document.getElementById('t-item-card').hidden, null, { timeout: 60000 }); await settle();
      await rec('C card', await page.evaluate(MEASURE));
      await openPick(); await page.waitForSelector('#t-pick:not([hidden]) .t-catalog-item', { timeout: 10000 }); await settle();
      await rec('D card+pick', await page.evaluate(MEASURE));
    } catch (e) { rows.push({ viewport: `${w}x${h}`, lang: LANG, state: 'FAILED', error: String(e && e.message || e).split('\n')[0] }); }
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
const bad = rows.filter((r) => r.state === 'FAILED' || ['badge', 'concept', 'ai', 'note'].some((k) => r[k] && r[k].covered > 0) || r.scrollW > r.innerW);
const f = (m) => (m ? `${m.covered}/${m.total}` : '-');
const who = (m) => (m && m.who ? ' ' + m.who.join(',') : '');
for (const r of rows) console.log(`${r.viewport.padEnd(9)} ${r.state.padEnd(12)} badge ${f(r.badge)} concept ${f(r.concept)}${who(r.concept)} ai ${f(r.ai)}${who(r.ai)} note ${f(r.note)}${who(r.note)}${r.card ? ' card' : ''}${r.pick ? ' pick' : ''}${r.strip === false ? ' strip-hidden' : ''}${r.error ? ' ' + r.error : ''}`);
console.log(`${bad.length ? 'FAIL' : 'PASS'} coverage ${apartment} ${LANG}: ${rows.length} cells over ${VIEWPORTS.length} viewports × 6 states, ${bad.length} with a covered line or a failure, posts ${posts}`);
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify({ apartment, lang: LANG, viewports: VIEWPORTS.length, rows, bad: bad.length, posts, at: new Date().toISOString() }, null, 1) + '\n'); }
process.exit(bad.length ? 1 : 0);

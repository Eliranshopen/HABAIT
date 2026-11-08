#!/usr/bin/env node
/* Habait Tour360 — shots.mjs (T01, board habait-tour360) — two screenshots for Slava's one look: phone 390×844 and desktop
   1440×900, Hebrew. playwright-core from the app's node_modules through createRequire and the system Chrome (the office-mock
   pattern, mock/developer-side/office/tools/capture-office.mjs). A static server runs inside this process on a free port; one
   Chrome instance; everything closed in `finally`.
   Usage (from the harness root, Git Bash):  timeout 540 node Habait/tour360/tools/shots.mjs demo-01 [--lang he] */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs'; // a worktree has no Habait/MVP/app (board habait-walkaround T18)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..', '..');
const id = process.argv[2];
if (!id) { console.error('usage: node Habait/tour360/tools/shots.mjs <apartment-id> [--lang he|en|fr]'); process.exit(2); }
const li = process.argv.indexOf('--lang');
const lang = li > 0 ? process.argv[li + 1] : 'he';
const DIST = path.join(ROOT, 'dist', id);
const EVIDENCE = path.join(REPO, 'qa-evidence', 'tour360', 'T01');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('shots: build first (build-tour.mjs ' + id + ')'); process.exit(1); }
fs.mkdirSync(EVIDENCE, { recursive: true });

const { chromium } = appRequire(REPO)('playwright-core');

const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(DIST, p));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

const cells = [
  { name: `phone-${lang}`, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: `desktop-${lang}`, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];
const results = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] });
  for (const cell of cells) {
    const ctx = await browser.newContext({ viewport: cell.viewport, deviceScaleFactor: cell.deviceScaleFactor, isMobile: cell.isMobile, hasTouch: cell.hasTouch });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const t0 = Date.now();
    await page.goto(base + `?lang=${lang}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__tour && window.__tour.ready === true, null, { timeout: 90000 });
    await page.waitForTimeout(1200); // the scene fade and the font swap settle
    const m = await page.evaluate(() => {
      const r = (id) => { const n = document.getElementById(id); const b = n.getBoundingClientRect(); const cs = getComputedStyle(n);
        return { text: n.textContent.trim(), visible: cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= innerHeight, fontPx: parseFloat(cs.fontSize) }; };
      return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, scene: window.__tour.scene, lang: document.documentElement.lang, dir: document.documentElement.dir,
        badge: r('tour-badge'), concept: r('tour-concept'), ai: r('tour-ai-note'), hotspots: document.querySelectorAll('.t-hs').length };
    });
    const file = path.join(EVIDENCE, cell.name + '.png');
    const png = await page.screenshot({ path: file });
    const ok = m.scrollW <= m.innerW && m.badge.visible && m.badge.fontPx >= 12 && m.concept.visible && m.ai.visible && m.hotspots > 0 && png.length > 150000 && errors.length === 0;
    results.push({ cell: cell.name, ok, ms: Date.now() - t0, pngKB: Math.round(png.length / 1024), ...m, errors });
    await ctx.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
fs.writeFileSync(path.join(EVIDENCE, `shots-${lang}.json`), JSON.stringify(results, null, 2) + '\n');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.cell}: scene=${r.scene} lang=${r.lang}/${r.dir} hotspots=${r.hotspots} badge=${r.badge.fontPx}px "${r.badge.text}" scroll=${r.scrollW}/${r.innerW} png=${r.pngKB}KB ${r.ms}ms${r.errors.length ? ' errors=' + r.errors.slice(0, 2).join(' | ') : ''}`);
}
process.exit(results.every((r) => r.ok) ? 0 : 1);

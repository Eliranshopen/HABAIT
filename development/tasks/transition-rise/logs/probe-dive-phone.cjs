// transition-rise: why does "view in 360" not move the tour on a phone? Replays check-dit's sequence on iPhone 13 and logs every
// message the dollhouse posts to the tour, the dollhouse's transition state and the tour's scene. :8851, closed in finally.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const ROOT = 'C:/RnD/.wt/transition-rise/run/tourout/apt846';
const T = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(new URL(q.url, 'http://x').pathname); const p = path.join(ROOT, u === '/' ? 'index.html' : u); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(8851, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await (await b.newContext(devices['iPhone 13'])).newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await p.goto('http://127.0.0.1:8851/index.html?room=living&video=0', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
    await p.evaluate(() => { window.__msgs = []; window.addEventListener('message', (e) => { const d = e.data || {}; if (d.type && d.type !== 'habait:view') window.__msgs.push(Math.round(performance.now()) + ' ' + d.type + (d.scene ? ' ' + d.scene : '') + (d.dove !== undefined ? ' dove=' + d.dove : '')); }); });
    await p.evaluate(() => document.getElementById('t-3d-btn').click());
    const fr = await (await p.waitForSelector('#t-3d-frame')).contentFrame();
    await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
    await p.waitForTimeout(3000);
    const s1 = await fr.evaluate(() => ({ tr: window.__dollhouse.transition, held: window.__dollhouse.held, sel: window.__dollhouse.selected }));
    await fr.evaluate(() => window.__dollhouseSelect('r-kitchen'));
    await p.waitForTimeout(900);
    const goVisible = await fr.evaluate(() => { const g = document.querySelector('.dh-sheet .go'); const sh = document.querySelector('.dh-sheet'); return { sheetHidden: sh.hidden, goHidden: g.hidden }; });
    await fr.evaluate(() => document.querySelector('.dh-sheet .go').click());
    await p.waitForTimeout(8000);
    const s2 = await fr.evaluate(() => ({ tr: window.__dollhouse.transition, held: window.__dollhouse.held }));
    const tour = await p.evaluate(() => ({ scene: window.__tour.scene, layerHidden: document.getElementById('t-3d').hidden, msgs: window.__msgs }));
    console.log(JSON.stringify({ s1, goVisible, s2, tour, errs }, null, 1));
  } finally { await b.close(); srv.close(); }
})();

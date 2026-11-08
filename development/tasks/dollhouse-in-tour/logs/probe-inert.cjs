// gate D1 follow-up: which of body's children carry inert while the 3D layer is open (test build over :8851).
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const ROOT = 'C:/RnD/.wt/dollhouse-in-tour/run/tourout/apt846';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(new URL(q.url, 'http://x').pathname); const p = path.join(ROOT, u === '/' ? 'index.html' : u); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : p.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(8851, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await p.goto('http://127.0.0.1:8851/index.html?room=living&video=0', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 90000 });
    await p.evaluate(() => document.getElementById('t-3d-btn').click());
    await p.waitForTimeout(500);
    console.log(JSON.stringify(await p.evaluate(() => ({ layerOpen: !document.getElementById('t-3d').hidden, toolsParent: document.getElementById('t-tools').parentElement.tagName + '#' + document.getElementById('t-tools').parentElement.id, kids: [...document.body.children].map((n) => `${n.tagName}#${n.id || n.className}:${n.inert}`) }))));
  } finally { await b.close(); srv.close(); }
})();

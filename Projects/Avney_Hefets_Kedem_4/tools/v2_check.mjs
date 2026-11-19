// v2_check.mjs - the v2 walk's features in headless Chrome: a catalog swap from a ring, the free text, the clock (night), the design panel,
// the view from above; desktop 1440 + phone 390; errors and overflow.  $0.   usage: node v2_check.mjs <site> <out> [port]
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json'); const { chromium } = require('playwright-core');
const [site, outDir, portArg] = process.argv.slice(2); const PORT = Number(portArg) || 8937; fs.mkdirSync(outDir, { recursive: true });
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => { const root = path.resolve(site), f = path.resolve(root, '.' + decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404).end(); return; } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const res = { steps: [], errors: [], overflow: {} }; const step = (n, ok, x = {}) => { res.steps.push({ n, ok: !!ok, ...x }); console.log((ok ? 'PASS ' : 'FAIL ') + n, JSON.stringify(x).slice(0, 200)); };
const ready = async (p) => { await p.waitForFunction(() => window.__walk3d && window.__walk3d.ready, null, { timeout: 180000 }); await p.waitForFunction(() => window.__walk3d.keysReady, null, { timeout: 180000 }); await p.waitForTimeout(800); };
try {
  for (const [w, h, tag] of [[1440, 900, 'd'], [390, 844, 'p']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: tag === 'p', isMobile: tag === 'p' }); const page = await ctx.newPage();
    page.on('pageerror', (e) => res.errors.push(tag + ': ' + e.message)); page.on('response', (r) => { if (r.status() >= 400) res.errors.push(tag + ' http ' + r.status() + ' ' + r.url()); });
    await page.goto(`http://127.0.0.1:${PORT}/index.html?at=dining&yaw=150`); await ready(page);
    await page.screenshot({ path: path.join(outDir, `${tag}1-start.png`) });
    const rings = await page.evaluate(() => window.__walk3d.design.rings()); step(tag + ' rings in view', rings.length > 0, { rings });
    await page.evaluate(() => window.__walk3d.design.openCat('sofa')); await page.waitForTimeout(300);
    step(tag + ' catalog bar with generated tiles', (await page.locator('#cat .tile').count()) >= 4); await page.screenshot({ path: path.join(outDir, `${tag}2-catalog.png`) });
    await page.locator('#cat .tile', { hasText: 'ספת עור' }).first().click();
    await page.waitForFunction(() => window.__walk3d.design.liveItems.some((i) => i.slot === 'sofa'), null, { timeout: 60000 }); await page.waitForTimeout(600);
    step(tag + ' a generated sofa is placed', true, { state: await page.evaluate(() => window.__walk3d.design.state) }); await page.locator('#cat-x').click(); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, `${tag}3-leather-sofa.png`) });
    if (tag === 'd') {
      await page.evaluate(() => window.__walk3d.design.runText('כורסת קטיפה ורצפת עץ אגוז')); await page.waitForTimeout(2500);
      const st = await page.evaluate(() => window.__walk3d.design.state); step('free text: velvet armchair + walnut floor', st['slot:armchair'] === 'cat:arm_velvet' && st.floor === 'walnut', { st });
      await page.screenshot({ path: path.join(outDir, 'd4-text.png') });
      await page.evaluate(() => window.__walk3d.design.setHour(21.5)); await page.waitForTimeout(800); await page.screenshot({ path: path.join(outDir, 'd5-night.png') });
      await page.evaluate(() => window.__walk3d.design.setHour(17.5)); await page.waitForTimeout(800); await page.screenshot({ path: path.join(outDir, 'd6-sunset.png') });
      step('clock', (await page.locator('#clock-t').textContent()) === '17:30');
      await page.evaluate(() => window.__walk3d.design.setHour(12.5));
      await page.locator('#m-design').click(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(outDir, 'd7-design.png') }); step('design panel', await page.locator('#design').isVisible());
      await page.locator('#design-x').click(); await page.locator('#m-view').click(); await page.locator('#menu-view button[data-v="doll"]').click(); await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, 'd8-above.png') }); step('view from above', true);
    } else {
      await page.locator('#m-design').tap(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(outDir, 'p4-design.png') }); step('p design sheet', await page.locator('#design').isVisible());
    }
    res.overflow[tag] = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
res.pass = res.steps.every((s) => s.ok) && !res.errors.length && !res.overflow.d && !res.overflow.p;
fs.writeFileSync(path.join(outDir, 'v2-check.json'), JSON.stringify(res, null, 1)); console.log(JSON.stringify({ pass: res.pass, errors: res.errors, overflow: res.overflow }));

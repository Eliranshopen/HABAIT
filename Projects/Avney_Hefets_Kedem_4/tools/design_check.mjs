// design_check.mjs - QA of the walk's design layer in real headless Chrome (2026-11-17): the rings, the piece card (model + colour),
// the free-text bar, the styles, the floor, undo / before-after / reset, the design link, the view from above, the tape measure, the plan;
// desktop 1440 and phone 390, no page errors, no page overflow.  $0.
// usage: node design_check.mjs <site_dir> <out_dir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [site, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const PORT = 8932;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary' };
const server = http.createServer((q, r) => { const root = path.resolve(site), f = path.resolve(root, '.' + decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(root)) { r.writeHead(403).end(); return; }
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404).end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const base = `http://127.0.0.1:${PORT}/index.html`;
const res = { errors: [], steps: [], overflow: {} };
const step = (name, ok, extra = {}) => { res.steps.push({ name, ok: Boolean(ok), ...extra }); console.log((ok ? 'PASS ' : 'FAIL ') + name, JSON.stringify(extra)); };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const shot = (page, n) => page.screenshot({ path: path.join(outDir, n + '.png') });
const ready = (page) => page.waitForFunction(() => window.__walk3d && window.__walk3d.ready, null, { timeout: 180000 }).then(() => page.waitForTimeout(1200));
const st = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__walk3d.design.state)));
try {
  // ---------------- desktop
  { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
    page.on('pageerror', (e) => res.errors.push('desktop: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) res.errors.push('desktop console: ' + m.text()); }); page.on('response', (r) => { if (r.status() >= 400) res.errors.push('desktop http ' + r.status() + ' ' + r.url()); });
    await page.goto(`${base}?at=living&yaw=200`); await ready(page); await shot(page, 'd01-living-before');
    const rings = await page.evaluate(() => window.__walk3d.design.rings()); step('rings shown in the living room', rings.includes('sofa'), { rings });
    await page.locator('.ring', { hasText: 'ספה' }).first().click(); await page.waitForTimeout(400);
    step('a ring opens the piece card', await page.locator('#card').isVisible(), { title: await page.locator('#card-t').textContent() }); await shot(page, 'd02-sofa-card');
    await page.locator('#card .chip', { hasText: 'ספה מעוגלת' }).click(); await page.locator('#card .sw[title="כחול כהה"]').click(); await page.waitForTimeout(500);
    let s = await st(page); step('model and colour from the card', s['slot:sofa'] === 'v2' && s.sofa === 'navy', { s }); await shot(page, 'd03-sofa-round-navy');
    await page.locator('#card .chip', { hasText: 'מנורת עמידה' }).click(); await page.evaluate(() => window.__walk3d.design.runText('תמונה על הקיר')); await page.waitForTimeout(400);
    s = await st(page); step('accessories from the card', s['acc:art'] === 'v1' && s['acc:floorlamp'] === 'v1', { s }); await shot(page, 'd04-accessories');
    await page.locator('#card-x').click();
    await page.locator('#b-undo').click(); s = await st(page); step('undo takes back the last change', !s['acc:art'] && s['acc:floorlamp'] === 'v1', { s });
    await page.locator('#b-compare').click(); await page.waitForTimeout(300); await shot(page, 'd05-compare-before');
    step('before/after shows the original', (await page.locator('#b-compare').getAttribute('aria-pressed')) === 'true'); await page.locator('#b-compare').click();
    // the free-text bar
    await page.locator('#b-design').click(); await page.waitForTimeout(300); step('the design panel opens', await page.locator('#design').isVisible()); await shot(page, 'd06-design-panel');
    const say = async (t) => { await page.fill('#free-in', t); await page.press('#free-in', 'Enter'); await page.waitForTimeout(500); return page.locator('#say').textContent(); };
    let r = await say('ספה ירוקה ורצפת עץ'); s = await st(page); step('free text: green sofa + wood floor', /^#/.test(s.sofa) && s.floor === 'oak' && s.floorm === 'oak', { said: r, s });
    await page.locator('#design-x').click(); await page.waitForTimeout(300); await shot(page, 'd07-text-sofa-wood');
    await page.goto(`${base}?at=kitchen&yaw=315${await page.evaluate(() => location.hash)}`); await ready(page);
    await page.locator('#b-design').click(); r = await say('מטבח כחול כהה עם משטח שחור'); s = await st(page);
    step('free text: kitchen fronts + worktop', /^#/.test(s.kitchen) && s['kitchen.top'] === '#2b2a29', { said: r, s }); await page.locator('#design-x').click(); await page.waitForTimeout(300); await shot(page, 'd08-kitchen');
    await page.locator('#b-design').click(); r = await say('להזיז את הקיר של הסלון'); step('free text refuses a structural change', /המבנה נשאר/.test(r), { said: r });
    r = await say('קירות בצבע שמנת ואווירת ערב'); s = await st(page); step('free text: walls + evening', s.walls && s.light === 'evening', { said: r, s });
    r = await say('סגנון סקנדינבי'); s = await st(page); step('free text: a style', s.floor === 'lightoak' && s.sofa === 'grey', { said: r, s });
    await page.locator('#d-style .chip', { hasText: 'כהה ואלגנטי' }).click(); await page.waitForTimeout(400); s = await st(page); step('style chip', s.floor === 'p80-dark', { s });
    await page.locator('#design-x').click(); await page.goto(`${base}?at=living&yaw=200${await page.evaluate(() => location.hash)}`); await ready(page); await shot(page, 'd09-style-dark-living');
    step('the design link restores the design', (await st(page)).floor === 'p80-dark');
    await page.locator('#b-reset').click(); s = await st(page); step('reset', Object.keys(s).length === 0, { s });
    // the view from above, the plan, the tape measure
    await page.locator('#b-doll').click(); await page.waitForTimeout(800); await shot(page, 'd10-dollhouse');
    await page.mouse.click(720, 450); await page.waitForTimeout(500);
    step('a tap in the view from above walks there', (await page.locator('#b-doll').getAttribute('aria-pressed')) === 'false', { me: await page.evaluate(() => ({ x: window.__walk3d.me.x, z: window.__walk3d.me.z })) });
    await page.goto(`${base}?at=living&yaw=200`); await ready(page);
    await page.locator('#b-measure').click(); await page.mouse.click(520, 700); await page.waitForTimeout(200); await page.mouse.click(900, 700); await page.waitForTimeout(400);
    const ml = await page.locator('#mlabel').textContent(); step('tape measure gives a length', /\d+ ס"מ/.test(ml), { ml }); await shot(page, 'd11-measure'); await page.locator('#b-measure').click();
    await page.locator('#b-plan').click(); await page.waitForTimeout(400); await shot(page, 'd12-plan');
    const box = await page.locator('#plan-c').boundingBox(); const p0 = await page.evaluate(() => ({ x: window.__walk3d.me.x, z: window.__walk3d.me.z }));
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.3); await page.waitForTimeout(300);
    const p1 = await page.evaluate(() => ({ x: window.__walk3d.me.x, z: window.__walk3d.me.z })); step('a tap on the plan moves there', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1, { p0, p1 });
    // every ring of every room opens a card with options
    const cams = ['living', 'dining', 'kitchen', 'master', 'mamad', 'bath', 'bedroom', 'ensuite'], seen = new Set();
    for (const at of cams) { await page.goto(`${base}?at=${at}`); await ready(page); for (const yaw of [0, 90, 180, 270]) { await page.evaluate((y) => { window.__walk3d.me.yaw = -y * Math.PI / 180; }, yaw); await page.waitForTimeout(250); for (const id of await page.evaluate(() => window.__walk3d.design.rings())) seen.add(id); } }
    step('rings across the apartment', seen.size >= 12, { pieces: [...seen] });
    res.overflow.desktop = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && getComputedStyle(e).position !== 'absolute' && (r.left < -1 || r.right > innerWidth + 1); }).map((e) => e.tagName + '#' + e.id).slice(0, 5));
    await ctx.close(); }
  // ---------------- phone
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const page = await ctx.newPage();
    page.on('pageerror', (e) => res.errors.push('phone: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) res.errors.push('phone console: ' + m.text()); });
    await page.goto(`${base}?at=living&yaw=200`); await ready(page); await shot(page, 'p01-living');
    const rings = await page.evaluate(() => window.__walk3d.design.rings()); step('phone: rings', rings.length >= 1, { rings });
    const ring = page.locator('.ring:visible').first(); await ring.tap(); await page.waitForTimeout(400); step('phone: a ring tap opens the card', await page.locator('#card').isVisible()); await shot(page, 'p02-card');
    await page.locator('#card .sw').first().tap(); await page.locator('#card-x').tap();
    await page.locator('#b-design').tap(); await page.waitForTimeout(300); await shot(page, 'p03-design');
    await page.fill('#free-in', 'רצפה אפורה'); await page.locator('#free button').tap(); await page.waitForTimeout(400); step('phone: free text', (await st(page)).floor === 'p80-grey');
    await page.locator('#design-x').tap(); await page.waitForTimeout(300); await shot(page, 'p04-after');
    res.overflow.phone = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth > innerWidth, els: [...document.querySelectorAll('body > *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }).map((e) => e.tagName + '#' + e.id + '.' + e.className) }));
    await ctx.close(); }
} finally { await browser.close(); server.close(); }
res.pass = res.steps.every((x) => x.ok) && !res.errors.length;
fs.writeFileSync(path.join(outDir, 'design-check.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ pass: res.pass, failed: res.steps.filter((x) => !x.ok).map((x) => x.name), errors: res.errors, overflow: res.overflow }, null, 1));

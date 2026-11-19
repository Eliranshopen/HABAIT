import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:8896/index.html'); await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
console.log('reachable from the entrance:', JSON.stringify(await p.evaluate(() => window.__walk.reach())));
// walk by keys from the kitchen into the living room: stand in the kitchen, face east, hold ↑ 3 s
const r = await p.evaluate(async () => { const w = window.__walk, G = await (await fetch('./geometry.json')).json(); const k = G.rooms.find((q) => q.id === 'kitchen').rects[0];
  w.me.x = (k[0] + k[2]) / 2; w.me.y = (k[1] + k[3]) / 2; w.me.yaw = -Math.PI / 2; w.me.goal = null; return { x: w.me.x, ok: w.ok(w.me.x, w.me.y) }; });
await p.keyboard.down('ArrowUp'); await p.waitForTimeout(3500); await p.keyboard.up('ArrowUp');
const after = await p.evaluate(() => ({ x: window.__walk.me.x, room: document.getElementById('room').textContent }));
console.log('kitchen -> east by walking:', JSON.stringify({ from_x: r.x.toFixed(2), start_ok: r.ok, to_x: after.x.toFixed(2), room_now: after.room }), 'errors:', errs.length);
await p.screenshot({ path: 'qa/walk/kitchen-to-living.png' });
// living room -> balcony on foot: click the balcony deck beyond the open sash and let the walker go there
const bal = await p.evaluate(async () => { const w = window.__walk, G = await (await fetch('./geometry.json')).json(); const L = G.rooms.find((q) => q.id === 'living').rects[0]; w.me.x = L[2] - 0.6; w.me.y = L[3] - 0.9; w.me.yaw = 0; return true; });
await p.evaluate(() => { const w = window.__walk; w.me.goal = null; });
const tgt = await p.evaluate(async () => { const G = await (await fetch('./geometry.json')).json(); const d = G.balcony.deck; return [d.reduce((s, q) => s + q[0], 0) / d.length + 1.6, d.reduce((s, q) => s + q[1], 0) / d.length]; });
await p.evaluate(([x, y]) => window.__walk.flyTo(x, y, 0), tgt); await p.waitForTimeout(2500);
const b2 = await p.evaluate(() => ({ room: document.getElementById('room').textContent, ok: window.__walk.ok(window.__walk.me.x, window.__walk.me.y) }));
console.log('living -> balcony:', JSON.stringify(b2));
await p.screenshot({ path: 'qa/walk/on-balcony.png' });
await b.close();

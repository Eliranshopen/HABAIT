// every room reached ON FOOT from the entrance: the room button walks the route; we wait until the walker stops and check the room label
import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:8896/index.html'); await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
const n = await p.evaluate(() => document.querySelectorAll('#rooms button').length);
const rows = [];
for (let i = 0; i < n; i++) {
  const name = await p.evaluate((k) => { const b = document.querySelectorAll('#rooms button')[k]; b.click(); return b.textContent; }, i);
  const t0 = Date.now(); let pathLen = await p.evaluate(() => (window.__walk.me.path || []).length + (window.__walk.me.goal ? 1 : 0));
  await p.waitForFunction(() => !window.__walk.me.goal, null, { timeout: 120000, polling: 500 }).catch(() => {});
  await p.waitForTimeout(1500);
  const st = await p.evaluate(() => ({ room: document.getElementById('room').textContent, ok: window.__walk.ok(window.__walk.me.x, window.__walk.me.y) }));
  rows.push({ button: name, waypoints: pathLen, arrived_in: st.room, on_free_floor: st.ok, seconds: ((Date.now() - t0) / 1000).toFixed(1) });
  await p.screenshot({ path: `qa/walk/route-${i}.png` });
}
// a tap on the floor of another room: from the kitchen, tap-walk to the parents' bedroom
const tap = await p.evaluate(async () => { const w = window.__walk; const P = w.G.rooms.find((r) => r.id === 'parents').rects[0]; const K = w.G.rooms.find((r) => r.id === 'kitchen').rects[0];
  w.me.x = (K[0] + K[2]) / 2; w.me.y = (K[1] + K[3]) / 2; return w.setGoal((P[0] + P[2]) / 2 - 0.6, (P[1] + P[3]) / 2 + 0.6); });
await p.waitForFunction(() => !window.__walk.me.goal, null, { timeout: 120000, polling: 500 }).catch(() => {});
const tapEnd = await p.evaluate(() => document.getElementById('room').textContent);
console.log(JSON.stringify({ rows, tap_kitchen_to_parents: { route_found: tap, arrived_in: tapEnd }, errors: errs }, null, 1));
await b.close();

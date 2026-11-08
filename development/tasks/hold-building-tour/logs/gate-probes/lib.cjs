const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const BASE = 'http://127.0.0.1:8853';
const OUT = 'C:/RnD/development/tasks/hold-building-tour/logs/gate-shots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, step = 250) { const t0 = Date.now(); for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(step); } }
const ARGS = ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
async function toHold(opts, skip = true) {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ARGS });
  const ctx = await b.newContext({ locale: 'he-IL', ...opts });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(`${BASE}/?project=rainbow`, { waitUntil: 'domcontentloaded' });
  const href = await until(() => p.evaluate(() => { const a = document.getElementById('heroCta'); return a && !a.hidden && /\/hold\//.test(a.href) ? a.href : null; }), 15000);
  await p.addInitScript(() => { window.__raf = 0; const o = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => { window.__raf++; return o(f); }; });
  await p.goto(href, { waitUntil: 'domcontentloaded' }); await sleep(2500);
  if (skip) { await p.click('#clipSkip', { timeout: 8000 }).catch(() => {}); await until(() => p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'block'), 25000); }
  return { b, p, errs };
}
const st = (p) => p.evaluate(() => ({ frames: document.querySelectorAll('#buildingFrame').length, btn: getComputedStyle(document.getElementById('buildingBtn')).display, close: getComputedStyle(document.getElementById('buildingClose')).display, ambPaused: document.getElementById('amb').paused, vol: document.getElementById('amb').volume, sound: JSON.stringify(window.__sound), icon: document.getElementById('soundBtn').textContent }));
const rate = async (p) => { const a = await p.evaluate(() => window.__raf); await sleep(1000); const c = await p.evaluate(() => window.__raf); return c - a; };
const R = []; const ok = (id, pass, info) => { R.push(pass); console.log(pass ? 'PASS' : 'FAIL', id, JSON.stringify(info)); };
module.exports = { chromium, devices, BASE, OUT, sleep, until, toHold, st, rate, R, ok };

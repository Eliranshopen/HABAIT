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
(async () => {
  // P1 double click
  { const { b, p, errs } = await toHold({ viewport: { width: 1440, height: 900 } });
    const r0 = await rate(p); const s0 = await st(p); console.log('base', r0, JSON.stringify(s0));
    await p.dblclick('#buildingBtn'); await sleep(3000);
    let s = await st(p); ok('P1 dblclick -> exactly one frame, open', s.frames === 1 && s.close === 'block', s);
    await p.click('#buildingClose'); await sleep(800);
    s = await st(p); const r1 = await rate(p);
    ok('P1b close -> one frame gone, loop rate same as before (no double loop)', s.frames === 0 && r1 < r0 * 1.6, { r0, r1, s });
    ok('P1c errors', errs.length === 0, errs); await b.close(); }
  // P2 close before load (same tick / immediate)
  { const { b, p } = await toHold({ viewport: { width: 1440, height: 900 } });
    const r0 = await rate(p);
    await p.evaluate(() => { document.getElementById('buildingBtn').click(); document.getElementById('buildingClose').click(); });
    await sleep(3000); const s = await st(p); const r1 = await rate(p);
    ok('P2 open+close same tick: no frame, loop alive, btn shown', s.frames === 0 && s.btn === 'block' && r1 > r0 * 0.5, { s, r0, r1 });
    // close while loading at 50ms
    await p.click('#buildingBtn'); await sleep(50); await p.click('#buildingClose'); await sleep(3000);
    const s2 = await st(p); const r2 = await rate(p);
    ok('P2b open, 50ms, close: loop alive', s2.frames === 0 && r2 > r0 * 0.5 && s2.btn === 'block', { s2, r2 });
    // close in the exact frame of load: poll for load then close inside same task
    await p.evaluate(() => new Promise((res) => { document.getElementById('buildingBtn').click(); const f = document.getElementById('buildingFrame'); f.addEventListener('load', () => { document.getElementById('buildingClose').click(); res(); }); }));
    await sleep(1500); const r3 = await rate(p); const s3 = await st(p);
    ok('P2c close from inside the load event: single loop', s3.frames === 0 && r3 < r0 * 1.6 && r3 > r0 * 0.5, { r0, r3, s3 });
    await b.close(); }
  // P3 sound / ambience race
  { const { b, p } = await toHold({ viewport: { width: 1440, height: 900 } });
    await sleep(1500); const s0 = await st(p); console.log('sound before', JSON.stringify(s0));
    await p.click('#buildingBtn'); await sleep(2500); const sOpen = await st(p);
    ok('P3a open: ambience paused', sOpen.ambPaused, sOpen);
    await p.click('#buildingClose'); await sleep(900); const sBack = await st(p);
    ok('P3b close: ambience back as before', sBack.ambPaused === s0.ambPaused && Math.abs(sBack.vol - 0.6) < .05, { s0, sBack });
    // quick close inside the 600ms fade
    await p.click('#buildingBtn'); await sleep(150); await p.click('#buildingClose'); await sleep(2500); const sq = await st(p);
    ok('P3c close within the 600ms fade: ambience still playing, icon consistent', !sq.ambPaused, sq);
    await p.click('#soundBtn'); await sleep(300); const sOff = await st(p); // user mutes
    await p.click('#buildingBtn'); await sleep(2500); await p.click('#buildingClose'); await sleep(800); const sOff2 = await st(p);
    ok('P3d muted by user stays muted after open/close', sOff.ambPaused && sOff2.ambPaused, { sOff, sOff2 });
    await b.close(); }
})().catch((e) => { console.error('ERR', e.stack); process.exit(2); });

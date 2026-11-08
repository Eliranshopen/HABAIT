// Board hold-building-tour, card 03 — the acceptance check.
// usage: node check-building.cjs <base url, e.g. http://127.0.0.1:8853 or https://habait-flow.vercel.app> [out dir] [devices csv]
// Per device: the platform's own project link → the hold (?orbit clip) → skip → the button → the overlay (tour in project scope, aerial,
// auto chain to the tower) → tap apartment 846 → into the rooms inside the frame → ✕ → the hold's loop runs again, focus on the button
// → Esc closes → open/close ×3 leaves no frame → REGRESSION: pill 846 → card → continue → descent → #tourFrame with scope=apartment.
// Exit 0 = every assertion PASS on every device.
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const BASE = (process.argv[2] || 'http://127.0.0.1:8853').replace(/\/$/, '');
const OUT = process.argv[3] || __dirname + '/shots';
const WANT = (process.argv[4] || 'desktop,iphone13,pixel7,tablet').split(',');
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
const DEV = {
  desktop: { viewport: { width: 1440, height: 900 } },
  iphone13: devices['iPhone 13'],
  pixel7: devices['Pixel 7'],
  tablet: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, step = 250) { const t0 = Date.now(); for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(step); } }

// the ✕ must not hide a control of the tour: sample a 5×5 grid over its box inside the frame
async function underClose(p, fr) {
  const b = await p.evaluate(() => { const q = document.getElementById('buildingClose').getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; });
  return fr.evaluate((b) => { const out = new Set(); for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const e = document.elementFromPoint(b.x + (b.w * i) / 4, b.y + (b.h * j) / 4); const c = e && e.closest('button, a, [role=button], input, select, .t-hs, .t-mk'); if (c && c.getClientRects().length) out.add(c.id || c.getAttribute('aria-label') || c.outerHTML.slice(0, 90)); } return [...out]; }, b);
}

async function run(name) {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ ...DEV[name], locale: 'he-IL' });
  const p = await ctx.newPage();
  const errs = [], bad = [], res = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  p.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 120)}`); });
  const ok = (id, pass, info) => { res.push({ id, pass: !!pass, info }); };
  try {
    await p.goto(`${BASE}/?project=rainbow`, { waitUntil: 'domcontentloaded' });
    const href = await until(() => p.evaluate(() => { const a = document.getElementById('heroCta'); return a && !a.hidden && /\/hold\//.test(a.href) ? a.href : null; }), 15000);
    ok('A1 platform link leads to /hold/', href, href && href.slice(0, 140));
    await p.goto(href, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    await p.click('#clipSkip', { timeout: 8000 }).catch(() => {});
    const shown = await until(() => p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'block'), 25000);
    ok('B1 button shown at the hold after the clip', shown);
    const btn = await p.evaluate(() => { const e = document.getElementById('buildingBtn'); const q = e.getBoundingClientRect(); const top = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
      return { text: e.textContent.trim(), h: Math.round(q.height), w: Math.round(q.width), x: Math.round(q.x), y: Math.round(q.y), onTop: e === top || e.contains(top), inView: q.right <= innerWidth && q.left >= 0, dir: getComputedStyle(e).direction }; });
    ok('B2 label + ≥44 px + on top + in view + rtl', btn.text === 'הדמיית הבניין והסביבה' && btn.h >= 44 && btn.onTop && btn.inView && btn.dir === 'rtl', btn);
    const overlap = await p.evaluate(() => { const r = document.getElementById('buildingBtn').getBoundingClientRect(); const hit = (q) => !(q.right < r.left || q.left > r.right || q.bottom < r.top || q.top > r.bottom);
      return [...document.querySelectorAll('#pickerStage .hotspot, #pickerStage .picker-bottom button, #soundBtn')].filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0 && hit(e.getBoundingClientRect())).map((e) => e.id || e.textContent.trim().slice(0, 12)); });
    ok('B3 button covers no pill / picker button / sound button', overlap.length === 0, overlap);
    await p.screenshot({ path: `${OUT}/${name}_1_hold.png` });

    await p.click('#buildingBtn');
    const fr0 = await until(async () => { const h = await p.$('#buildingFrame'); return h && (await h.contentFrame()); }, 10000);
    const src = await p.evaluate(() => window.__building && window.__building.src);
    ok('C1 frame opens, project scope (no scope=apartment), from=hold, same page URL', fr0 && src && !/scope=apartment/.test(src) && /from=hold/.test(src) && /\/hold\//.test(p.url()), { src: src && src.slice(0, 120), url: p.url().slice(0, 60) });
    const first = await until(() => fr0.evaluate(() => window.__tour && window.__tour.scene), 20000);
    ok('C2 tour opens on aerial', first === 'aerial', first);
    const tower = await until(() => fr0.evaluate(() => window.__tour.scene === 'tower' ? 'tower' : null), 90000, 500);   // 90 s: software GL on the tablet profile hit 60 s at orbit4/orbit5 (re-gate)
    ok('C3 auto chain reaches the tower (hold node)', tower, await fr0.evaluate(() => window.__tour.scene));
    const fx = await p.evaluate(() => ({ close: getComputedStyle(document.getElementById('buildingClose')).display, btn: getComputedStyle(document.getElementById('buildingBtn')).display, op: getComputedStyle(document.getElementById('buildingFrame')).opacity }));
    ok('C4 ✕ visible, button hidden, frame opaque', fx.close === 'block' && fx.btn === 'none' && fx.op === '1', fx);
    await sleep(1500);
    await p.screenshot({ path: `${OUT}/${name}_2_tower.png` });
    const hiddenTower = await underClose(p, fr0);
    ok('C4b ✕ hides no tour control (at the tower)', hiddenTower.length === 0, hiddenTower);
    // tap apartment 846 inside the frame (the tour's hotspot to approach45)
    const hs = await fr0.$('.t-hs:has-text("בדרך לדירה")') || await fr0.$('.t-hs');
    if (hs) await hs.click({ force: true, timeout: 5000 }).catch(() => {});
    const room = await until(() => fr0.evaluate(() => { const s = window.__tour.scene; return s && !/^(aerial|orbit\d|tower|approach\d+|facade|terraceOut)$/.test(s) ? s : null; }), 60000, 500);
    ok('C5 tap 846 → descent → a room of the apartment inside the frame', hs && room, { hotspot: !!hs, room, now: await fr0.evaluate(() => window.__tour.scene) });
    await sleep(1500);
    await p.screenshot({ path: `${OUT}/${name}_3_room.png` });
    const closeTop = await p.evaluate(() => { const e = document.getElementById('buildingClose'); const q = e.getBoundingClientRect(); return document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2) === e; });
    ok('C6 ✕ is on top of the tour (clickable)', closeTop);
    const hiddenRoom = await underClose(p, fr0);
    ok('C7 ✕ hides no tour control (in the room)', hiddenRoom.length === 0, hiddenRoom);

    await p.click('#buildingClose');
    await sleep(300);
    const after = await p.evaluate(() => ({ frames: document.querySelectorAll('#buildingFrame').length, btn: getComputedStyle(document.getElementById('buildingBtn')).display, focus: document.activeElement && document.activeElement.id, url: location.pathname }));
    // the loop is alive iff updateHotspot keeps re-showing the button after we hide it by hand
    await p.evaluate(() => { document.getElementById('buildingBtn').style.display = 'none'; });
    await sleep(400);
    const loop = await p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'block');
    ok('D1 ✕ → frame removed, button back + focused, hold loop running', after.frames === 0 && after.btn === 'block' && after.focus === 'buildingBtn' && loop, { ...after, loop });
    await p.screenshot({ path: `${OUT}/${name}_4_back.png` });

    await p.click('#buildingBtn'); await until(() => p.$('#buildingFrame'), 5000);
    await sleep(1200);
    await p.focus('#buildingClose'); await p.keyboard.press('Escape'); await sleep(300);
    const esc = await p.evaluate(() => ({ frames: document.querySelectorAll('#buildingFrame').length, btn: getComputedStyle(document.getElementById('buildingBtn')).display }));
    ok('D2 Esc (focus on the page) closes', esc.frames === 0 && esc.btn === 'block', esc);

    for (let i = 0; i < 3; i++) { await p.click('#buildingBtn'); await sleep(700); await p.click('#buildingClose'); await sleep(300); }
    const cyc = await p.evaluate(() => ({ frames: document.querySelectorAll('iframe').length, btn: getComputedStyle(document.getElementById('buildingBtn')).display }));
    ok('D3 open/close ×3 leaves no frame, button back', cyc.frames === 0 && cyc.btn === 'block', cyc);

    // REGRESSION — the existing hand-off: pill 846 → card → continue → descent → #tourFrame scope=apartment
    await p.click('#pickerStage .hotspot:has-text("846")', { timeout: 8000 });
    await sleep(700);
    await p.click('#unitContinue', { timeout: 4000 }).catch(async () => { await p.evaluate(() => document.querySelector('#unitContinue').click()); });
    await sleep(150);   // inside the hold's ease back to the clip pose, before the descent clip starts
    const hiddenInDescent = await p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'none');
    ok('E1 button hidden during the descent clip', hiddenInDescent);
    const tf = await until(async () => { const h = await p.$('#tourFrame'); if (!h) return null; return (await h.evaluate((e) => getComputedStyle(e).opacity)) === '1' ? h : null; }, 20000, 500);
    const tsrc = tf && await tf.getAttribute('src');
    const tscene = tf && await until(async () => (await tf.contentFrame()).evaluate(() => window.__tour && window.__tour.scene), 15000);
    ok('E2 existing hand-off unchanged: #tourFrame scope=apartment, lands in the apartment', tf && /scope=apartment/.test(tsrc) && tscene === 'terraceLiving', { src: tsrc && tsrc.slice(0, 100), scene: tscene });
    const btnAfter = await p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display);
    ok('E3 button not over the apartment tour', btnAfter === 'none', btnAfter);
    await p.screenshot({ path: `${OUT}/${name}_5_handoff.png` });
  } catch (e) {
    ok('Z run completed', false, e.message.slice(0, 200));
  }
  const ignorable = (s) => /favicon|posthog/i.test(s);
  ok('Z1 zero page errors', errs.length === 0, errs);
  ok('Z2 zero 4xx/5xx', bad.filter((x) => !ignorable(x)).length === 0, bad);
  await b.close();
  return res;
}

(async () => {
  let fail = 0; const all = {};
  for (const d of WANT) {
    const r = await run(d); all[d] = r;
    for (const x of r) { if (!x.pass) fail++; console.log(`${d.padEnd(9)} ${x.pass ? 'PASS' : 'FAIL'}  ${x.id}${x.pass ? '' : '  ' + String(JSON.stringify(x.info)).slice(0, 300)}`); }
  }
  fs.writeFileSync(`${OUT}/result.json`, JSON.stringify(all, null, 1));
  const n = Object.values(all).flat().length;
  console.log(`\n${n - fail}/${n} PASS · ${fail} FAIL · base ${BASE}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });

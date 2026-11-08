// Board exterior-film, card A4 — the acceptance check (rows A/B/D/E/Z kept from hold-building-tour's check-building.cjs;
// rows C/F are new: the building button now plays the realistic film instead of the tour's 360 stills chain).
// usage: node check-film.cjs <base url, e.g. http://127.0.0.1:8858 or https://habait-flow.vercel.app> [out dir] [devices csv]
// The server MUST answer HTTP Range (video seek): Vercel does; locally use scratchpad film/rangeserve.cjs. Exit 0 = every row PASS.
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const BASE = (process.argv[2] || 'http://127.0.0.1:8858').replace(/\/$/, '');
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
const shown = (id) => `getComputedStyle(document.getElementById('${id}')).display`;

async function run(name) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
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
    const atHold = await until(() => p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'block'), 25000);
    ok('B1 button shown at the hold after the clip', atHold);
    const btn = await p.evaluate(() => { const e = document.getElementById('buildingBtn'); const q = e.getBoundingClientRect(); const top = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
      return { text: e.textContent.trim(), h: Math.round(q.height), onTop: e === top || e.contains(top), inView: q.right <= innerWidth && q.left >= 0 }; });
    ok('B2 label + ≥44 px + on top + in view', btn.text === 'הדמיית הבניין והסביבה' && btn.h >= 44 && btn.onTop && btn.inView, btn);
    await p.screenshot({ path: `${OUT}/${name}_1_hold.png` });

    // ---- C: the film
    const url0 = p.url();
    await p.click('#buildingBtn');
    const playing = await until(() => p.evaluate(() => { const v = window.__building.video; return v.currentTime > 1 && !v.paused ? { t: v.currentTime, w: v.videoWidth, h: v.videoHeight } : null; }), 20000, 300);
    const st = await p.evaluate(() => ({ src: window.__building.src, iframes: document.querySelectorAll('#buildingFrame, iframe#buildingFrame').length, box: getComputedStyle(document.getElementById('buildingFilm')).display, op: getComputedStyle(document.getElementById('buildingFilm')).opacity, iw: innerWidth }));
    const wantHd = st.iw >= 900;
    ok('C1 overlay opens: no tour iframe, same URL, the film for this width', st.box === 'block' && st.iframes === 0 && p.url() === url0 && (wantHd ? /building-film-1080\.mp4/ : /building-film-720\.mp4/).test(st.src || ''), { ...st, wantHd });
    ok('C2 the film plays (time advances), decoded size matches (1920×1080 / 1280×720)', playing && (wantHd ? playing.w === 1920 && playing.h === 1080 : playing.w === 1280 && playing.h === 720), playing);
    const disc = await p.evaluate(() => { const box = document.getElementById('buildingFilm'); const badge = box.querySelector('.film-badge'), legal = box.querySelector('.film-legal');
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom <= innerHeight + 1; };
      return { badge: badge && badge.textContent.trim(), badgeVis: badge && vis(badge), legalSame: legal && legal.textContent === document.getElementById('clipLegal').textContent, legalVis: legal && vis(legal) }; });
    ok('C3 AI badge "הדמיה · AI-generated" + the approved legal text (= #clipLegal, byte-equal) visible on the film', disc.badge === 'הדמיה · AI-generated' && disc.badgeVis && disc.legalSame && disc.legalVis, disc);
    const fx = await p.evaluate((sh) => { const c = document.getElementById('buildingClose'); const q = c.getBoundingClientRect(); return { close: getComputedStyle(c).display, onTop: document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2) === c, w: Math.round(q.width), btn: getComputedStyle(document.getElementById('buildingBtn')).display, inView: q.top >= 0 && q.right <= innerWidth }; });
    ok('C4 ✕ visible, on top, ≥44 px, in view; the button hidden', fx.close === 'block' && fx.onTop && fx.w >= 44 && fx.inView && fx.btn === 'none', fx);
    await sleep(1500);
    await p.screenshot({ path: `${OUT}/${name}_2_film.png` });
    // jump to the end (Range seek) -> the end actions
    await p.evaluate(() => { const v = window.__building.video; v.currentTime = Math.max(0, v.duration - 0.6); });
    const ended = await until(() => p.evaluate(() => window.__building.ended && !document.getElementById('buildingEnd').hidden), 15000, 300);
    const acts = await p.evaluate(() => [...document.querySelectorAll('#buildingEnd button')].map((e) => { const q = e.getBoundingClientRect(); return { id: e.id, t: e.textContent.trim(), h: Math.round(q.height), vis: q.width > 0 && q.bottom <= innerHeight }; }));
    ok('C5 at the end: enter 846 / again / back, each ≥44 px and in view', ended && acts.length === 3 && acts.every((a) => a.h >= 44 && a.vis) && acts[0].id === 'buildingEnter', acts);
    await p.screenshot({ path: `${OUT}/${name}_3_end.png` });
    await p.click('#buildingAgain');
    const again = await until(() => p.evaluate(() => { const v = window.__building.video; return !v.paused && v.currentTime > 0.3 && v.currentTime < 5 && document.getElementById('buildingEnd').hidden ? v.currentTime : null; }), 10000, 250);
    ok('C6 "צפייה חוזרת" restarts the film', again, again);
    await p.evaluate(() => { const v = window.__building.video; v.currentTime = Math.max(0, v.duration - 0.6); });
    await until(() => p.evaluate(() => !document.getElementById('buildingEnd').hidden), 15000, 300);
    await p.click('#buildingBack');
    await sleep(300);
    const back = await p.evaluate(() => ({ box: getComputedStyle(document.getElementById('buildingFilm')).display, btn: getComputedStyle(document.getElementById('buildingBtn')).display, paused: window.__building.video.paused }));
    ok('C7 "חזרה לבחירת דירה" closes the film', back.box === 'none' && back.btn === 'block' && back.paused, back);

    // ---- D: close paths (kept)
    await p.click('#buildingBtn'); await sleep(1200);
    await p.click('#buildingClose'); await sleep(300);
    const after = await p.evaluate(() => ({ box: getComputedStyle(document.getElementById('buildingFilm')).display, btn: getComputedStyle(document.getElementById('buildingBtn')).display, focus: document.activeElement && document.activeElement.id, paused: window.__building.video.paused }));
    await p.evaluate(() => { document.getElementById('buildingBtn').style.display = 'none'; });
    await sleep(400);
    const loop = await p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'block');
    ok('D1 ✕ → film hidden + paused, button back + focused, hold loop running', after.box === 'none' && after.paused && after.btn === 'block' && after.focus === 'buildingBtn' && loop, { ...after, loop });
    await p.click('#buildingBtn'); await sleep(900);
    await p.keyboard.press('Escape'); await sleep(300);
    const esc = await p.evaluate(() => ({ box: getComputedStyle(document.getElementById('buildingFilm')).display, btn: getComputedStyle(document.getElementById('buildingBtn')).display }));
    ok('D2 Esc closes', esc.box === 'none' && esc.btn === 'block', esc);
    for (let i = 0; i < 3; i++) { await p.click('#buildingBtn'); await sleep(600); await p.click('#buildingClose'); await sleep(300); }
    const cyc = await p.evaluate(() => ({ box: getComputedStyle(document.getElementById('buildingFilm')).display, btn: getComputedStyle(document.getElementById('buildingBtn')).display, iframes: document.querySelectorAll('iframe').length }));
    ok('D3 open/close ×3 leaves the film closed, button back, no iframe', cyc.box === 'none' && cyc.btn === 'block' && cyc.iframes === 0, cyc);
    await p.screenshot({ path: `${OUT}/${name}_4_back.png` });

    // ---- E: REGRESSION — pill 846 → card → continue → descent → #tourFrame scope=apartment (kept)
    await p.click('#pickerStage .hotspot:has-text("846")', { timeout: 8000 });
    await sleep(700);
    await p.click('#unitContinue', { timeout: 4000 }).catch(async () => { await p.evaluate(() => document.querySelector('#unitContinue').click()); });
    await sleep(150);
    ok('E1 button hidden during the descent clip', await p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'none'));
    const tf = await until(async () => { const h = await p.$('#tourFrame'); if (!h) return null; return (await h.evaluate((e) => getComputedStyle(e).opacity)) === '1' ? h : null; }, 20000, 500);
    const tsrc = tf && await tf.getAttribute('src');
    const tscene = tf && await until(async () => (await tf.contentFrame()).evaluate(() => window.__tour && window.__tour.scene), 15000);
    ok('E2 existing hand-off unchanged: #tourFrame scope=apartment, lands in the apartment', tf && /scope=apartment/.test(tsrc) && tscene === 'terraceLiving', { src: tsrc && tsrc.slice(0, 100), scene: tscene });
    ok('E3 button not over the apartment tour', await p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'none'));
    await p.screenshot({ path: `${OUT}/${name}_5_handoff.png` });

    // ---- F: "כניסה לדירה 846" at the end of the film = the same hand-off (a fresh page: E left the hold)
    await p.goto(href, { waitUntil: 'domcontentloaded' }); await sleep(2500);
    await p.click('#clipSkip', { timeout: 8000 }).catch(() => {});
    await until(() => p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'block'), 25000);
    await p.click('#buildingBtn');
    await until(() => p.evaluate(() => window.__building.video.readyState >= 1), 15000, 250);
    await p.evaluate(() => { const v = window.__building.video; v.currentTime = Math.max(0, v.duration - 0.6); });
    await until(() => p.evaluate(() => !document.getElementById('buildingEnd').hidden), 15000, 300);
    await Promise.all([p.waitForURL(/scope=apartment/, { timeout: 15000 }).catch(() => {}), p.click('#buildingEnter')]);
    ok('F1 "כניסה לדירה 846" → the apartment tour (scope=apartment)', /scope=apartment/.test(p.url()), p.url().slice(0, 140));
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

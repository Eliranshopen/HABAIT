const { devices, OUT, sleep, until, toHold, st, ok, R } = require('./lib.cjs');
const settle = async (p) => { await sleep(2200); return st(p); };
const good = (s) => !s.ambPaused && Math.abs(s.vol - 0.6) < 0.01 && s.icon === '🔊';
(async () => {
  // A: close at N ms after open (in-page timer), ambience must be playing at 0.6
  for (const d of [0, 50, 200, 550, 700, 1500]) {
    const { b, p, errs } = await toHold({ viewport: { width: 1440, height: 900 } });
    await sleep(1200);
    await p.evaluate((d) => { document.getElementById('buildingBtn').click(); setTimeout(() => document.getElementById('buildingClose').click(), d); }, d);
    const s = await settle(p);
    // after 1500ms close the open fade already ended: amb paused; closeBuilding restores
    ok('A close@' + d + 'ms: ambience restored (play, 0.6, icon on)', good(s) && s.frames === 0 && errs.length === 0, { s, errs });
    await b.close();
  }
  // B: open-close-open-close fast, and repeated
  { const { b, p, errs } = await toHold({ viewport: { width: 1440, height: 900 } }); await sleep(1200);
    await p.evaluate(async () => { const w = (ms) => new Promise((r) => setTimeout(r, ms)); const o = () => document.getElementById('buildingBtn').click(), c = () => document.getElementById('buildingClose').click();
      o(); await w(30); c(); await w(30); o(); await w(80); c(); await w(10); o(); await w(300); c(); });
    const s = await settle(p); ok('B fast open/close x3: ambience playing 0.6', good(s) && s.frames === 0 && errs.length === 0, { s, errs });
    // B2: open, wait past fade (paused), close, then open again and close at 100
    await p.evaluate(async () => { const w = (ms) => new Promise((r) => setTimeout(r, ms)); document.getElementById('buildingBtn').click(); await w(1200); document.getElementById('buildingClose').click(); await w(100); document.getElementById('buildingBtn').click(); await w(100); document.getElementById('buildingClose').click(); });
    const s2 = await settle(p); ok('B2 full-open, close, reopen, close@100: ambience 0.6', good(s2), s2);
    // B3: open and stay: must be paused (fade works) 
    await p.evaluate(() => document.getElementById('buildingBtn').click()); await sleep(1500); const s3 = await st(p);
    ok('B3 open and stay: ambience faded to paused', s3.ambPaused && s3.vol < 0.01, s3);
    await p.click('#buildingClose'); const s4 = await settle(p); ok('B3b then close: restored', good(s4), s4);
    await b.close(); }
  // C: user mute then open/close at several delays
  for (const d of [0, 200, 1500]) {
    const { b, p, errs } = await toHold({ viewport: { width: 1440, height: 900 } }); await sleep(1200);
    await p.click('#soundBtn'); await sleep(300); const m = await st(p);
    await p.evaluate((d) => { document.getElementById('buildingBtn').click(); setTimeout(() => document.getElementById('buildingClose').click(), d); }, d);
    const s = await settle(p); ok('C mute, open/close@' + d + ': stays muted', m.ambPaused && s.ambPaused && s.icon === m.icon, { m, s, errs });
    // unmute afterwards works
    await p.click('#soundBtn'); await sleep(600); const u = await st(p); ok('C2 unmute after: plays', !u.ambPaused, u);
    await b.close();
  }
  // D: open, close, pill 846 -> continue -> descent: ambience fades out into the apartment tour and stays paused
  for (const d of [100, 1500]) {
    const { b, p, errs } = await toHold({ viewport: { width: 1440, height: 900 } }); await sleep(1200);
    await p.evaluate((d) => { document.getElementById('buildingBtn').click(); setTimeout(() => document.getElementById('buildingClose').click(), d); }, d);
    await settle(p);
    await p.click('#pickerStage .hotspot:has-text("846")', { timeout: 8000 }); await sleep(700); await p.click('#unitContinue', { timeout: 4000 });
    const tf = await until(async () => { const h = await p.$('#tourFrame'); if (!h) return null; return (await h.evaluate((e) => getComputedStyle(e).opacity)) === '1' ? h : null; }, 25000, 500);
    await sleep(2500); const s = await st(p); const src = tf && await tf.getAttribute('src');
    ok('D open/close@' + d + ' then 846 hand-off: #tourFrame apartment, ambience paused vol~0', tf && /scope=apartment/.test(src) && s.ambPaused && s.vol < 0.01, { s, src: src && src.slice(0, 80), errs });
    await sleep(2500); const s2 = await st(p); ok('D2 stays paused later', s2.ambPaused, s2);
    await b.close();
  }
  // E: open, then 846 path directly without closing is blocked? open overlay, wait, close, #enterBtn path if present
  { const { b, p, errs } = await toHold({ viewport: { width: 1440, height: 900 } }); await sleep(1200);
    const has = await p.evaluate(() => !!document.getElementById('enterBtn') && getComputedStyle(document.getElementById('enterBtn')).display);
    console.log('enterBtn display', has);
    await p.evaluate(() => { document.getElementById('buildingBtn').click(); setTimeout(() => document.getElementById('buildingClose').click(), 100); });
    await settle(p);
    const r = await p.evaluate(() => { const e = document.getElementById('enterBtn'); if (!e) return 'none'; e.click(); return 'clicked'; });
    await sleep(3500); const s = await st(p); console.log('E enterBtn', r, JSON.stringify(s), JSON.stringify(errs));
    await b.close(); }
  console.log(R.every(Boolean) ? 'ALL PASS' : 'SOME FAIL'); process.exit(R.every(Boolean) ? 0 : 1);
})();

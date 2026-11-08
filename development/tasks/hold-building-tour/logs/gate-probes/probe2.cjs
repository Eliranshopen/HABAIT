const { devices, OUT, sleep, until, toHold, st, ok } = require('./lib.cjs');
const openFrame = async (p) => { await p.click('#buildingBtn'); return until(async () => { const h = await p.$('#buildingFrame'); return h && (await h.contentFrame()); }, 10000); };
(async () => {
  { const { b, p } = await toHold({ viewport: { width: 1440, height: 900 } });
    await p.evaluate(() => { document.getElementById('buildingBtn').click(); setTimeout(() => document.getElementById('buildingClose').click(), 200); });
    await sleep(2500); const s = await st(p);
    ok('Q1 open then close at 200ms: ambience playing again (sound.on=true)', !s.ambPaused, s);
    await b.close(); }
  { const { b, p, errs } = await toHold({ viewport: { width: 1440, height: 900 } });
    const fr = await openFrame(p);
    await until(() => fr.evaluate(() => window.__tour && /^orbit/.test(window.__tour.scene)), 40000, 300);
    const sc = await fr.evaluate(() => window.__tour.scene); await p.click('#buildingClose'); await sleep(800);
    const s = await st(p);
    await p.click('#pickerStage .hotspot:has-text("846")', { timeout: 8000 }); await sleep(800);
    const card = await p.evaluate(() => { const c = document.getElementById('unitContinue'); return !!c && c.getClientRects().length > 0; });
    ok('Q2 close during orbit (' + sc + '): hold live, picker card opens', s.frames === 0 && s.btn === 'block' && card, { s, card, errs });
    await p.screenshot({ path: OUT + '/q2_card.png' });
    await b.close(); }
  { const { b, p, errs } = await toHold({ viewport: { width: 1440, height: 900 } });
    const fr = await openFrame(p);
    await until(() => fr.evaluate(() => window.__tour.scene === 'tower' ? 1 : null), 60000, 500);
    const hs = await fr.$('.t-hs:has-text("בדרך לדירה")') || await fr.$('.t-hs'); await hs.click({ force: true });
    const room = await until(() => fr.evaluate(() => { const s = window.__tour.scene; return s && !/^(aerial|orbit\d|tower|approach\d+|facade|terraceOut)$/.test(s) ? s : null; }), 60000, 500);
    await sleep(1000); await p.click('#buildingClose'); await sleep(800);
    await p.click('#pickerStage .hotspot:has-text("846")', { timeout: 8000 }); await sleep(700);
    await p.click('#unitContinue', { timeout: 4000 });
    const tf = await until(async () => { const h = await p.$('#tourFrame'); if (!h) return null; return (await h.evaluate((e) => getComputedStyle(e).opacity)) === '1' ? h : null; }, 25000, 500);
    const tsrc = tf && await tf.getAttribute('src');
    ok('Q3 room (' + room + ') -> close -> 846 -> continue -> apartment tour', tf && /scope=apartment/.test(tsrc), { tsrc: tsrc && tsrc.slice(0, 90), errs });
    await p.keyboard.press('Escape'); await sleep(500);
    const s = await st(p); ok('Q3b button hidden in apartment tour, Esc opens nothing', s.btn === 'none' && s.frames === 0, s);
    await b.close(); }
  { const { b, p } = await toHold({ viewport: { width: 1440, height: 900 } });
    const fr = await openFrame(p);
    await sleep(3000); await fr.evaluate(() => window.focus()); await p.keyboard.press('Escape'); await sleep(500);
    const s = await st(p); ok('Q4 Esc focus in frame: overlay stays', s.frames === 1, s);
    await p.focus('#buildingClose').catch(() => {}); await p.keyboard.press('Escape'); await sleep(400);
    const s2 = await st(p); ok('Q4b Esc on page closes', s2.frames === 0, s2);
    await b.close(); }
  { const { b, p } = await toHold({ viewport: { width: 1440, height: 900 } }, false);
    const seen = []; for (let i = 0; i < 6; i++) { seen.push(await p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display)); await sleep(500); }
    ok('Q5 button hidden during orbit clip', seen.every((x) => x === 'none'), seen);
    await p.evaluate(() => document.getElementById('buildingBtn').click()); await sleep(500);
    const s = await st(p); ok('Q5b programmatic click during clip does nothing', s.frames === 0, s);
    await p.click('#clipSkip').catch(() => {}); await until(() => p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'block'), 25000);
    await p.click('#pickerStage .hotspot:has-text("846")'); await sleep(700); await p.click('#unitContinue');
    await p.evaluate(() => document.getElementById('buildingBtn').click()); await sleep(100);
    const s3 = await st(p); ok('Q5c programmatic click during descent ease does nothing', s3.frames === 0, s3);
    await b.close(); }
  { const { b, p, errs } = await toHold({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await p.click('#buildingBtn'); await sleep(3000);
    const op = await p.evaluate(() => getComputedStyle(document.getElementById('buildingFrame')).opacity); await p.screenshot({ path: OUT + '/q6_reduced.png' });
    await p.click('#buildingClose'); await sleep(500); const s = await st(p);
    ok('Q6 reduced motion: opens opaque, closes, no errors', op === '1' && s.frames === 0 && errs.length === 0, { op, s, errs }); await b.close(); }
  for (const [name, o] of [['iphone13', devices['iPhone 13']], ['iphone13L', devices['iPhone 13 landscape']], ['pixel7L', devices['Pixel 7 landscape']]]) {
    const { b, p, errs } = await toHold(o);
    const bb = await p.evaluate(() => { const q = document.getElementById('buildingBtn').getBoundingClientRect(); const t = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.y), onTop: t.id === 'buildingBtn', vw: innerWidth }; });
    await p.screenshot({ path: OUT + `/q7_${name}_hold.png` });
    await p.tap('#buildingBtn'); await sleep(4000);
    const cb = await p.evaluate(() => { const q = document.getElementById('buildingClose').getBoundingClientRect(); const t = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2); return { x: Math.round(q.x), y: Math.round(q.y), w: q.width, onTop: t.id === 'buildingClose', vw: innerWidth }; });
    await p.screenshot({ path: OUT + `/q7_${name}_open.png` });
    await p.tap('#buildingClose'); await sleep(600); const s = await st(p);
    ok('Q7 ' + name + ' button/close reachable', bb.onTop && bb.h >= 44 && bb.x >= 0 && bb.x + bb.w <= bb.vw && cb.onTop && s.frames === 0 && s.btn === 'block' && errs.length === 0, { bb, cb, s, errs });
    await b.close(); }
})().catch((e) => { console.error('ERR', e.stack); process.exit(2); });

const { toHold, st, sleep, until, ok } = require('./lib.cjs');
(async () => {
  const { b, p, errs } = await toHold({ viewport: { width: 1440, height: 900 } });
  await p.click('#buildingBtn'); await sleep(200);
  await p.click('#buildingClose'); // ✕ at ~200ms
  await sleep(2500);
  const s = await st(p); console.log(JSON.stringify(s));
  ok('P1 closed, button back, ambience playing', s.frames === 0 && s.btn === 'block' && s.ambPaused === false && s.vol > 0 && /"on":true/.test(s.sound), s);
  await p.click('#pickerStage .hotspot:has-text("846")', { timeout: 8000 }); await sleep(700);
  await p.click('#unitContinue', { timeout: 4000 }).catch(async () => { await p.evaluate(() => document.querySelector('#unitContinue').click()); });
  const tf = await until(async () => { const h = await p.$('#tourFrame'); return h && (await h.evaluate((e) => getComputedStyle(e).opacity)) === '1' ? h : null; }, 25000, 500);
  const src = tf && await tf.getAttribute('src');
  ok('P2 846 -> #tourFrame scope=apartment', !!tf && /scope=apartment/.test(src), src && src.slice(0, 100));
  ok('P3 no page errors', errs.length === 0, errs);
  await b.close();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });

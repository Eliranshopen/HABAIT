const { sleep, toHold } = require('./lib.cjs');
(async () => {
  const { b, p, errs } = await toHold({ viewport: { width: 1440, height: 900 } }); await sleep(1200);
  await p.evaluate(() => { document.getElementById('buildingBtn').click(); setTimeout(() => document.getElementById('buildingClose').click(), 100); });
  await sleep(2200);
  const before = p.url();
  await p.evaluate(() => document.getElementById('enterBtn').click()); await sleep(4000);
  const info = await p.evaluate(() => ({ url: location.href.slice(0, 80), amb: document.getElementById('amb') && { paused: document.getElementById('amb').paused, vol: document.getElementById('amb').volume }, tf: !!document.getElementById('tourFrame') })).catch((e) => 'nav:' + e.message.slice(0, 80));
  console.log('before', before.slice(0, 60), 'after', JSON.stringify(info), JSON.stringify(errs)); await b.close();
})();

// gate probe 2: the dive's held final frame vs the tour's arrival frame. usage: node gate-probe2.cjs <device> <from> <to,to,..>
const L = require('./gate-lib.cjs');
const dev = process.argv[2] || 'desktop', from = process.argv[3] || 'living', tos = (process.argv[4] || 'kitchen').split(',');
const OUT = L.path.join(__dirname, 'gate-frames');
const opts = dev === 'desktop' ? { viewport: { width: 1440, height: 900 } } : L.devices[dev === 'iphone13' ? 'iPhone 13' : 'Pixel 7'];
const ID = { kitchen: 'r-kitchen', bedroomMain: 'r-bedroom-main', bathMain: 'r-bath-main', dining: 'r-dining', bedroom2: 'r-bedroom-2', entrance: 'r-entrance', living: 'r-living' };
(async () => {
  const srv = await L.serve(); const b = await L.launch();
  try {
    for (const to of tos) {
      const { ctx, p, errs } = await L.openTour(b, opts, from);
      try {
        const fr = await L.dhFrame(p);
        await p.evaluate(() => document.getElementById('t-3d-btn').click());
        await fr.waitForFunction(() => window.__dollhouse.loaded && window.__dollhouse.transition && !window.__dollhouse.transition.running, null, { timeout: 150000 });
        await fr.evaluate(() => { const o = window.parent.postMessage.bind(window.parent); window.parent.postMessage = (m, t) => (m && m.type === 'habait:enter-room' ? setTimeout(() => o(m, t), 4000) : o(m, t)); window.__dollhouseView.setPreset('3d', { animate: false }); });
        const sid = await fr.evaluate((s) => { const r = [...document.querySelectorAll('[data-room]')].map((x) => x.dataset.room); return r; }, to);
        const ids = await fr.evaluate(() => (window.__dollhouseView && window.__dollhouseView.rooms ? window.__dollhouseView.rooms.map((r) => r.id + ':' + r.scene) : null));
        const rid = (ids || []).map((s) => s.split(':')).find((x) => x[1] === to);
        await fr.evaluate((id) => window.__dollhouseSelect(id), rid ? rid[0] : ID[to]);
        await fr.waitForTimeout(900);
        await fr.evaluate(() => document.querySelector('.dh-sheet .go').click());
        await fr.waitForFunction(() => window.__dollhouse.transition && window.__dollhouse.transition.kind === 'dive' && !window.__dollhouse.transition.running, null, { timeout: 60000 });
        await p.waitForTimeout(300);
        const sceneBefore = await p.evaluate(() => window.__tour.scene);
        const dShot = L.path.join(OUT, `p2-${dev}-${from}-${to}-dive.png`);
        await p.screenshot({ path: dShot });
        await p.waitForFunction((t) => window.__tour.scene === t && document.getElementById('t-3d').hidden, to, { timeout: 15000 });
        await p.waitForTimeout(1500);
        await L.hide(p); await p.waitForTimeout(200);
        const aShot = L.path.join(OUT, `p2-${dev}-${from}-${to}-arrive.png`);
        await p.screenshot({ path: aShot });
        const d = await L.bandDiff(dShot, aShot);
        const arr = await p.evaluate(() => ({ yaw: window.__tour.viewer.getYaw(), pitch: window.__tour.viewer.getPitch(), hfov: window.__tour.viewer.getHfov() }));
        console.log(`${d < 22 ? 'ok  ' : 'FAIL'} ${dev} ${from}->${to} sceneBeforeSwitch=${sceneBefore} dive-vs-arrival diff ${d.toFixed(1)} arrival ${JSON.stringify(arr)} errs ${errs.length}`);
      } catch (e) { console.log(`FAIL ${dev} ${from}->${to}: ${e.message.split('\n')[0]}`); }
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
})();

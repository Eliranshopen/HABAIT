const L = require('./gate-lib.cjs');
(async () => {
  const srv = await L.serve(); const b = await L.launch();
  try {
    const { ctx, p, errs } = await L.openTour(b, { viewport: { width: 1440, height: 900 } }, process.argv[2] || 'wardrobe');
    p.on('console', (m) => console.log('tour console', m.type(), m.text().slice(0, 200)));
    p.on('requestfailed', (r) => console.log('REQFAIL', r.url().slice(-80)));
    p.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().slice(-90)); });
    const fr = await L.dhFrame(p);
    fr.page().on('console', (m) => console.log('dh console', m.type(), m.text().slice(0, 300)));
    const info = await p.evaluate(() => { const s = window.__tour; return { scene: s.scene, cfg: window.__tour.viewer.getConfig && window.__tour.viewer.getConfig().panorama }; });
    console.log(JSON.stringify(info));
    await p.evaluate(() => document.getElementById('t-3d-btn').click());
    await p.waitForTimeout(15000);
    console.log(JSON.stringify(await fr.evaluate(() => ({ d: window.__dollhouse && { loaded: window.__dollhouse.loaded, tr: window.__dollhouse.transition, held: window.__dollhouse.held }, spec: window.__dollhouseSpecFor && window.__dollhouseSpecFor('wardrobe', { yaw: 0, pitch: -2, hfov: 100 }) }))));
    console.log('opacity', await p.evaluate(() => document.getElementById('t-3d').style.opacity), errs);
    await ctx.close();
  } finally { await b.close(); srv.close(); }
})();

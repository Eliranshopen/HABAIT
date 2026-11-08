// gate probe 1: the rise's first frame (deterministic transitionPreview t=0, after the real 3D button) vs the tour's frame, per scene.
// usage: node gate-probe1.cjs <device: desktop|iphone13|pixel7> <scene,scene,...> [turned]
const L = require('./gate-lib.cjs');
const dev = process.argv[2] || 'desktop';
const scenes = (process.argv[3] || 'living').split(',');
const turned = process.argv[4] === 'turned';
const OUT = L.path.join(__dirname, 'gate-frames'); L.fs.mkdirSync(OUT, { recursive: true });
const opts = dev === 'desktop' ? { viewport: { width: 1440, height: 900 } } : L.devices[dev === 'iphone13' ? 'iPhone 13' : 'Pixel 7'];
(async () => {
  const srv = await L.serve(); const b = await L.launch(); const rows = [];
  try {
    for (const sc of scenes) {
      const { ctx, p, errs } = await L.openTour(b, opts, sc);
      try {
        if (turned) await p.evaluate(() => { const v = window.__tour.viewer; v.setYaw(v.getYaw() + 95, false); v.setPitch(12, false); v.setHfov(Math.max(70, v.getHfov() - 15), false); });
        await p.waitForTimeout(400);
        const fr = await L.dhFrame(p);
        await L.hide(p); await p.waitForTimeout(200);
        const tourShot = L.path.join(OUT, `p1-${dev}-${sc}${turned ? '-turned' : ''}-tour.png`);
        await p.screenshot({ path: tourShot });
        await L.unhide(p);
        await p.evaluate(() => document.getElementById('t-3d-btn').click());
        await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded && window.__dollhouse.transition && !window.__dollhouse.transition.running, null, { timeout: 150000 });
        const view = await p.evaluate(() => { const v = window.__tour.viewer; return { scene: window.__tour.scene, yaw: v.getYaw(), pitch: v.getPitch(), hfov: v.getHfov() }; });
        const t0 = await fr.evaluate(async (vw) => window.__dollhouseView.transitionPreview(window.__dollhouseSpecFor(vw.scene, { yaw: vw.yaw, pitch: vw.pitch, hfov: vw.hfov }), 0), view);
        await p.waitForTimeout(300);
        const sh = L.path.join(OUT, `p1-${dev}-${sc}${turned ? '-turned' : ''}-t0.png`);
        await p.screenshot({ path: sh });
        const d = await L.bandDiff(tourShot, sh);
        rows.push({ dev, sc, turned, view, t0, diff: +d.toFixed(1), errs });
        console.log(`${d < 22 ? 'ok  ' : 'FAIL'} ${dev} ${sc}${turned ? ' turned' : ''} diff ${d.toFixed(1)} view ${JSON.stringify(view)} t0 ${JSON.stringify(t0)} errs ${errs.length}`);
      } catch (e) { console.log(`FAIL ${dev} ${sc}: ${e.message.split('\n')[0]}`); }
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
})();

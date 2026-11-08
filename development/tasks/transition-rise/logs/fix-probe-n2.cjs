// transition-rise gate N2 fix: a dive into the room the buyer already stands in must leave the tour on that room's opening view
// (the dive's end view: heading, pitch -2, fitted hfov). Desktop + iPhone 13. Port 8851, closed in finally.
const L = require('./gate-lib.cjs');
(async () => {
  const srv = await L.serve();
  const b = await L.launch();
  const out = [];
  try {
    for (const [dev, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone13', L.devices['iPhone 13']]]) {
      const t = await L.openTour(b, opts, 'living');
      const fr = await L.dhFrame(t.p);
      const heading = await t.p.evaluate(() => { const v = window.__tour.viewer; const h = window.__tour.data ? null : null; v.setYaw(v.getYaw() + 70, false); return h; });
      const before = await t.p.evaluate(() => window.__tour.viewer.getYaw());
      await t.p.evaluate(() => document.getElementById('t-3d-btn').click());
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded && window.__dollhouse.transition && !window.__dollhouse.transition.running, null, { timeout: 120000 });
      const rid = await fr.evaluate(() => (JSON.parse(document.getElementById('rooms').textContent).find((r) => r.scene === 'living') || {}).room_id);
      await fr.evaluate((id) => window.__dollhouseSelect(id), rid);
      await t.p.waitForTimeout(700);
      await fr.evaluate(() => document.querySelector('.dh-sheet .go').click());
      await t.p.waitForFunction(() => document.getElementById('t-3d').hidden, null, { timeout: 15000 });
      const after = await t.p.evaluate(() => { const v = window.__tour.viewer; return { scene: window.__tour.scene, yaw: v.getYaw(), pitch: v.getPitch(), hfov: v.getHfov() }; });
      const want = await fr.evaluate(() => { const v = window.__dollhouseView; return v && v.stats && v.stats.transition ? v.stats.transition : null; });
      const tourHeading = await t.p.evaluate(() => { const c = window.__tour.viewer.getConfig(); return typeof c.yaw === 'number' ? c.yaw : null; });
      const ok = after.scene === 'living' && Math.abs(after.pitch + 2) < 0.6 && (tourHeading === null || Math.abs(((after.yaw - tourHeading + 540) % 360) - 180) < 1);
      out.push(`${ok ? 'ok  ' : 'FAIL'} ${dev} N2 same-room dive: room ${rid}, yaw before ${before.toFixed(1)} -> after ${JSON.stringify(after)} heading ${tourHeading} | dh ${JSON.stringify(want)} | errs ${t.errs.length}`);
      await t.ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(out.join('\n'));
  L.fs.writeFileSync(L.path.join(__dirname, 'fix-probe-n2.txt'), out.join('\n') + '\n');
})();

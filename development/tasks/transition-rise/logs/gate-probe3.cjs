// gate probe 3: rapid sequences. usage: node gate-probe3.cjs <device> [scenarios]
const L = require('./gate-lib.cjs');
const dev = process.argv[2] || 'desktop';
const want = (process.argv[3] || 'S1,S2,S3,S4,S5,S6,S7').split(',');
const opts = dev === 'desktop' ? { viewport: { width: 1440, height: 900 } } : L.devices[dev === 'iphone13' ? 'iPhone 13' : 'Pixel 7'];
const state = (p) => p.evaluate(() => ({ scene: window.__tour.scene, hidden: document.getElementById('t-3d').hidden, op: document.getElementById('t-3d').style.opacity, inert: [...document.getElementById('t-root').children].filter((n) => n.inert).length, load: window.__tour.viewer.isLoaded() }));
const sel = (fr, id) => fr.evaluate((i) => { window.__dollhouseSelect(i); }, id);
const go = (fr) => fr.evaluate(() => { const g = document.querySelector('.dh-sheet .go'); if (g) g.click(); return !!g; });
const out = [];
const rep = (n, ok, m) => { out.push(`${ok ? 'ok  ' : 'FAIL'} ${dev} ${n}: ${m}`); console.log(out[out.length - 1]); };
async function fresh(b, room = 'living') { const t = await L.openTour(b, opts, room); t.fr = await L.dhFrame(t.p); return t; }
const restOK = async (p, tag, expectScene) => {
  await p.waitForTimeout(6000);
  const s = await state(p);
  rep(tag, s.hidden && s.inert === 0 && s.load && (!expectScene || s.scene === expectScene), `final ${JSON.stringify(s)} expect scene ${expectScene}`);
  return s;
};
const riseDone = (fr) => fr.waitForFunction(() => window.__dollhouse.loaded && window.__dollhouse.transition && !window.__dollhouse.transition.running, null, { timeout: 150000 });
(async () => {
  const srv = await L.serve(); const b = await L.launch();
  try {
    if (want.includes('S1')) { // open, x during the rise, reopen
      const { ctx, p, fr, errs } = await fresh(b);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await p.waitForTimeout(300);
      await p.evaluate(() => document.getElementById('t-3d-close').click());
      let s = await state(p); rep('S1a x during rise', s.hidden && s.inert === 0, JSON.stringify(s));
      await p.waitForTimeout(3000);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await p.waitForTimeout(4000);
      s = await state(p); const tr = await fr.evaluate(() => ({ tr: window.__dollhouse.transition, preset: window.__dollhouse.preset, held: window.__dollhouse.held }));
      rep('S1b reopen after x-in-rise: visible', !s.hidden && s.op === '' && s.inert > 0, JSON.stringify(s) + JSON.stringify(tr));
      await p.waitForTimeout(8000);
      const tr2 = await fr.evaluate(() => ({ tr: window.__dollhouse.transition, preset: window.__dollhouse.preset }));
      rep('S1c settled on 3D preset', tr2.preset === '3d' && tr2.tr && !tr2.tr.running, JSON.stringify(tr2));
      rep('S1 errs', errs.length === 0, errs.join('|'));
      await ctx.close();
    }
    if (want.includes('S2')) { // open then "view in 360" while the rise still runs
      const { ctx, p, fr, errs } = await fresh(b);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await p.waitForTimeout(250);
      await sel(fr, 'r-kitchen'); await p.waitForTimeout(300);
      const had = await go(fr);
      rep('S2 sheet reachable during rise', had, 'go button present=' + had);
      await restOK(p, 'S2 open->view in 360', 'kitchen');
      rep('S2 errs', errs.length === 0, errs.join('|'));
      await ctx.close();
    }
    if (want.includes('S3')) { // two dives back to back
      const { ctx, p, fr, errs } = await fresh(b);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await riseDone(fr);
      await sel(fr, 'r-kitchen'); await p.waitForTimeout(700);
      await fr.evaluate(() => { const g = document.querySelector('.dh-sheet .go'); g.click(); g.click(); });
      await restOK(p, 'S3 double-click go', 'kitchen');
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await fr.waitForFunction(() => window.__dollhouse.transition && window.__dollhouse.transition.kind === 'rise' && !window.__dollhouse.transition.running, null, { timeout: 150000 });
      await sel(fr, 'r-dining'); await p.waitForTimeout(600); await go(fr);
      await p.waitForTimeout(300); await sel(fr, 'r-bedroom-main').catch(() => {}); await go(fr);
      const s = await restOK(p, 'S3b two different rooms in 300ms', null);
      rep('S3b scene is one of the two', ['dining', 'bedroomMain'].includes(s.scene), s.scene);
      rep('S3 errs', errs.length === 0, errs.join('|'));
      await ctx.close();
    }
    if (want.includes('S4')) { // Esc / x during the dive; ghost navigation
      for (const how of ['esc', 'x']) {
        const { ctx, p, fr } = await fresh(b);
        await p.evaluate(() => document.getElementById('t-3d-btn').click());
        await riseDone(fr);
        await sel(fr, 'r-kitchen'); await p.waitForTimeout(700); await go(fr);
        await p.waitForTimeout(500);
        if (how === 'esc') await p.keyboard.press('Escape'); else await p.evaluate(() => document.getElementById('t-3d-close').click());
        let s = await state(p); rep(`S4 ${how} during dive (immediate)`, s.hidden && s.inert === 0, JSON.stringify(s));
        await p.waitForTimeout(8000);
        s = await state(p);
        rep(`S4 ${how} during dive: tour stays in living (no ghost navigation)`, s.scene === 'living' && s.hidden && s.inert === 0, JSON.stringify(s));
        await ctx.close();
      }
    }
    if (want.includes('S5')) { // Esc during the rise, then reopen
      const { ctx, p, fr, errs } = await fresh(b);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await p.waitForTimeout(400); await p.keyboard.press('Escape');
      let s = await state(p); rep('S5 esc during rise', s.hidden && s.inert === 0, JSON.stringify(s));
      await p.waitForTimeout(500);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await p.waitForTimeout(6000);
      s = await state(p); const tr = await fr.evaluate(() => window.__dollhouse.transition);
      rep('S5 reopen 0.5 s after esc: visible', !s.hidden && s.op === '', JSON.stringify(s) + JSON.stringify(tr));
      rep('S5 errs', errs.length === 0, errs.join('|'));
      await ctx.close();
    }
    if (want.includes('S6')) { // 3D button spam
      const { ctx, p, errs } = await fresh(b);
      for (let i = 0; i < 6; i++) { await p.evaluate(() => { document.getElementById('t-3d-btn').click(); }); await p.waitForTimeout(120); await p.evaluate(() => document.getElementById('t-3d-close').click()); await p.waitForTimeout(80); }
      const s = await state(p); rep('S6 open/close spam leaves the tour usable', s.hidden && s.inert === 0 && s.load, JSON.stringify(s));
      await p.waitForTimeout(4000);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await p.waitForTimeout(8000);
      const s2 = await state(p); rep('S6 then opens normally', !s2.hidden && s2.op === '', JSON.stringify(s2));
      rep('S6 errs', errs.length === 0, errs.join('|'));
      await ctx.close();
    }
    if (want.includes('S7')) { // dive into the room you are already in, tour turned away from its opening view
      const { ctx, p, fr } = await fresh(b);
      await p.evaluate(() => { window.__tour.viewer.setYaw(70, false); });
      await p.waitForTimeout(300);
      const y0 = await p.evaluate(() => window.__tour.viewer.getYaw());
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await riseDone(fr);
      await sel(fr, 'r-living'); await p.waitForTimeout(700); await go(fr);
      await p.waitForTimeout(8000);
      const s = await state(p); const y1 = await p.evaluate(() => window.__tour.viewer.getYaw());
      rep('S7 dive into the room you are in: tour usable', s.hidden && s.inert === 0 && s.scene === 'living', JSON.stringify(s) + ` yaw before ${y0.toFixed(1)} after ${y1.toFixed(1)}`);
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
})();

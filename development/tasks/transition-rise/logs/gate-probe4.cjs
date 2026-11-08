// gate probe 4: memory over open/close and open/dive cycles; reduced motion dive; usage: node gate-probe4.cjs
const L = require('./gate-lib.cjs');
const opts = { viewport: { width: 1440, height: 900 } };
const snap = (fr) => fr.evaluate(() => { const v = window.__dollhouseView; const i = v.renderer.info; return { children: v.scene.children.length, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : -1, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : -1 }; });
(async () => {
  const srv = await L.serve(); const b = await L.launch();
  try {
    {
      const { ctx, p, errs } = await L.openTour(b, opts, 'living');
      const fr = await L.dhFrame(p);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await fr.waitForFunction(() => window.__dollhouse.loaded && window.__dollhouse.transition && !window.__dollhouse.transition.running, null, { timeout: 150000 });
      const base = await snap(fr); console.log('after 1st rise', JSON.stringify(base));
      for (let i = 1; i <= 10; i++) {
        await p.evaluate(() => document.getElementById('t-3d-close').click());
        await p.waitForTimeout(300);
        await fr.evaluate(() => { window.__dollhouse.transition; });
        await p.evaluate(() => document.getElementById('t-3d-btn').click());
        // a rise ends with lastTrans replaced: wait for a NEW finished move (frames counter object identity changes)
        await fr.waitForFunction(() => { const t = window.__dollhouse.transition; return t && !t.running && window.__prevT !== t && (window.__prevT = t, true); }, null, { timeout: 150000 }).catch(() => {});
        await p.waitForTimeout(500);
        const s = await snap(fr); console.log(`cycle ${i}`, JSON.stringify(s));
        if (i === 10) {
          const grew = s.children > base.children || s.geometries > base.geometries || s.textures > base.textures;
          console.log(`${grew ? 'FAIL' : 'ok  '} 10 open/close cycles: base ${JSON.stringify(base)} end ${JSON.stringify(s)}`);
        }
      }
      // dive cycles: open -> view in 360 (kitchen / living alternately)
      const b2 = await snap(fr);
      const seq = ['kitchen', 'living', 'dining', 'living', 'kitchen'];
      for (const to of seq) {
        const cur = await p.evaluate(() => window.__tour.scene);
        await p.evaluate(() => { const t = document.getElementById('t-3d'); if (t.hidden) document.getElementById('t-3d-btn').click(); });
        await fr.waitForFunction(() => { const t = window.__dollhouse.transition; return t && !t.running && t.kind === 'rise' && window.__p2 !== t && (window.__p2 = t, true); }, null, { timeout: 150000 }).catch(() => {});
        await p.waitForTimeout(400);
        await fr.evaluate((id) => window.__dollhouseSelect(id), 'r-' + to); await p.waitForTimeout(700);
        await fr.evaluate(() => document.querySelector('.dh-sheet .go').click());
        await p.waitForFunction((t) => window.__tour.scene === t && document.getElementById('t-3d').hidden, to, { timeout: 30000 }).catch(() => console.log('FAIL dive to ' + to + ' did not land (from ' + cur + ')'));
        await p.waitForTimeout(800);
        console.log('dive ' + cur + '->' + to, JSON.stringify(await snap(fr)));
      }
      const e2 = await snap(fr);
      console.log(`${e2.children > b2.children + 1 || e2.geometries > b2.geometries + 2 || e2.textures > b2.textures + 2 ? 'FAIL' : 'ok  '} 5 dive cycles: before ${JSON.stringify(b2)} after ${JSON.stringify(e2)} (a held room mesh may remain: +1 child)`);
      console.log('page errors', errs.length, errs.join('|'));
      await ctx.close();
    }
    {
      // reduced motion: rise skipped, layer revealed; dive skipped, tour still switches and the layer closes
      const { ctx, p, errs } = await L.openTour(b, { ...opts, reducedMotion: 'reduce' }, 'living');
      const fr = await L.dhFrame(p);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await fr.waitForFunction(() => window.__dollhouse.loaded && window.__dollhouse.transition, null, { timeout: 150000 });
      await p.waitForTimeout(1500);
      const t = await fr.evaluate(() => ({ tr: window.__dollhouse.transition, preset: window.__dollhouse.preset, held: window.__dollhouse.held }));
      const st = await p.evaluate(() => ({ hidden: document.getElementById('t-3d').hidden, op: document.getElementById('t-3d').style.opacity, lop: document.querySelector('#t-3d-frame').contentDocument.querySelector('.dh-layer, #layer') ? 'x' : '' }));
      console.log(`${t.tr.skipped === 'reduced-motion' && t.preset === '3d' && !t.held && !st.hidden && st.op === '' ? 'ok  ' : 'FAIL'} reduced motion rise: ${JSON.stringify(t)} ${JSON.stringify(st)}`);
      await p.screenshot({ path: L.path.join(__dirname, 'gate-frames', 'p4-reduced-open.png') });
      await fr.evaluate(() => window.__dollhouseSelect('r-kitchen')); await p.waitForTimeout(700);
      await fr.evaluate(() => document.querySelector('.dh-sheet .go').click());
      await p.waitForFunction(() => window.__tour.scene === 'kitchen' && document.getElementById('t-3d').hidden, null, { timeout: 30000 }).catch(() => {});
      const s2 = await p.evaluate(() => ({ scene: window.__tour.scene, hidden: document.getElementById('t-3d').hidden, inert: [...document.getElementById('t-root').children].filter((n) => n.inert).length }));
      console.log(`${s2.scene === 'kitchen' && s2.hidden && s2.inert === 0 ? 'ok  ' : 'FAIL'} reduced motion dive switches: ${JSON.stringify(s2)} errs ${errs.length}`);
      await ctx.close();
    }
    {
      // slow-device guard: real (no __habaitMinFps override) on this ~2-9 fps software GL -> the move must be skipped as slow-device, not left hanging
      const { ctx, p } = await L.openTour(b, opts, 'living');
      const fr = await L.dhFrame(p, false);
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await fr.waitForFunction(() => window.__dollhouse.loaded && window.__dollhouse.transition && !window.__dollhouse.transition.running, null, { timeout: 150000 });
      const t = await fr.evaluate(() => ({ tr: window.__dollhouse.transition, preset: window.__dollhouse.preset }));
      const st = await p.evaluate(() => ({ hidden: document.getElementById('t-3d').hidden, op: document.getElementById('t-3d').style.opacity }));
      console.log(`${t.tr.skipped === 'slow-device' && t.preset === '3d' && !st.hidden && st.op === '' ? 'ok  ' : 'FAIL'} slow device (measured fps): ${JSON.stringify(t)} ${JSON.stringify(st)}`);
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
})();

// regate probes (qa-reviewer, fresh): races around the D1/N2 fix. usage: node regate-races.cjs <desktop|iphone13|pixel7> [R1,..]
const L = require('./gate-lib.cjs');
const dev = process.argv[2] || 'desktop';
const want = (process.argv[3] || 'R1,R2,R3,R4,R5,R6,R7').split(',');
const base = dev === 'desktop' ? { viewport: { width: 1440, height: 900 } } : L.devices[dev === 'iphone13' ? 'iPhone 13' : 'Pixel 7'];
const state = (p) => p.evaluate(() => ({ scene: window.__tour.scene, hidden: document.getElementById('t-3d').hidden, op: document.getElementById('t-3d').style.opacity, inert: [...document.getElementById('t-root').children].filter((n) => n.inert).length, load: window.__tour.viewer.isLoaded() }));
const sel = (fr, id) => fr.evaluate((i) => { window.__dollhouseSelect(i); }, id);
const go = (fr) => fr.evaluate(() => { const g = document.querySelector('.dh-sheet .go'); if (g) g.click(); return !!g; });
const out = [];
const rep = (n, ok, m) => { out.push(`${ok ? 'ok  ' : 'FAIL'} ${dev} ${n}: ${m}`); console.log(out[out.length - 1]); };
async function fresh(b, o = base, room = 'living') { const t = await L.openTour(b, o, room); t.fr = await L.dhFrame(t.p); return t; }
const riseDone = (fr) => fr.waitForFunction(() => window.__dollhouse.loaded && window.__dollhouse.transition && !window.__dollhouse.transition.running, null, { timeout: 150000 });
const open = async (t) => { await t.p.evaluate(() => document.getElementById('t-3d-btn').click()); await riseDone(t.fr); };
(async () => {
  const srv = await L.serve(); const b = await L.launch();
  try {
    if (want.includes('R1')) { // close then quick reopen during a dive
      const t = await fresh(b); await open(t);
      await sel(t.fr, 'r-kitchen'); await t.p.waitForTimeout(700); await go(t.fr);
      await t.p.waitForTimeout(400);
      await t.p.evaluate(() => document.getElementById('t-3d-close').click());
      await t.p.waitForTimeout(150);
      await t.p.evaluate(() => document.getElementById('t-3d-btn').click());
      await t.p.waitForTimeout(9000);
      const s = await state(t.p);
      rep('R1 close+reopen during dive: tour stays living, layer still open (no stale enter-room)', s.scene === 'living' && !s.hidden && s.inert > 0, JSON.stringify(s));
      await riseDone(t.fr).catch(() => {});
      await sel(t.fr, 'r-kitchen'); await t.p.waitForTimeout(700); await go(t.fr);
      await t.p.waitForTimeout(9000);
      const s2 = await state(t.p);
      rep('R1b a new dive after the reopen still enters the room', s2.scene === 'kitchen' && s2.hidden && s2.inert === 0, JSON.stringify(s2));
      rep('R1 errs', t.errs.length === 0, t.errs.join('|'));
      await t.ctx.close();
    }
    if (want.includes('R2')) { // plain (non-dove) enter-room
      const t = await fresh(b); await open(t);
      await t.fr.evaluate(() => window.parent.postMessage({ type: 'habait:enter-room', scene: 'kitchen', room_id: 'r-kitchen' }, '*'));
      await t.p.waitForTimeout(5000);
      let s = await state(t.p);
      rep('R2a plain enter-room while open: goes + closes', s.scene === 'kitchen' && s.hidden && s.inert === 0, JSON.stringify(s));
      await t.fr.evaluate(() => window.parent.postMessage({ type: 'habait:enter-room', scene: 'living', room_id: 'r-living' }, '*'));
      await t.p.waitForTimeout(3000);
      s = await state(t.p);
      rep('R2b enter-room while closed: ignored', s.scene === 'kitchen' && s.hidden, JSON.stringify(s));
      await t.ctx.close();
    }
    if (want.includes('R3')) { // apartment-page style embed: never gets scenes / 3d-hide
      const ctx = await b.newContext(base); const p = await ctx.newPage();
      await p.goto('http://127.0.0.1:8851/3d/dollhouse.html', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await p.evaluate(() => { document.body.innerHTML = '<iframe id="f" src="/3d/dollhouse.html" style="width:900px;height:600px"></iframe>'; window.__msgs = []; window.addEventListener('message', (e) => window.__msgs.push((e.data && e.data.type) + ':' + (e.data && e.data.scene || '') + ':' + (e.data && e.data.dove))); });
      const fh = await p.waitForSelector('#f'); const fr = await fh.contentFrame();
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 120000 });
      await fr.evaluate(() => { window.__habaitMinFps = 0; window.__dollhouseSelect('r-kitchen'); });
      await p.waitForTimeout(700); const had = await go(fr);
      await p.waitForTimeout(3000);
      const msgs = await p.evaluate(() => window.__msgs);
      rep('R3 apartment-style embed (no 3d-hide ever): enter-room posted, dove false', had && msgs.some((m) => m === 'habait:enter-room:kitchen:false'), JSON.stringify(msgs));
      await p.evaluate(() => window.frames[0].postMessage({ type: 'habait:3d-hide' }, '*'));
      await p.evaluate(() => { window.__msgs.length = 0; });
      await fr.evaluate(() => { window.__dollhouseSelect(null); window.__dollhouseSelect('r-kitchen'); });
      await p.waitForTimeout(700); await go(fr); await p.waitForTimeout(3000);
      const m2 = await p.evaluate(() => window.__msgs);
      rep('R3b after a 3d-hide, a LATER click still posts enter-room', m2.some((m) => m.startsWith('habait:enter-room:kitchen')), JSON.stringify(m2));
      await ctx.close();
    }
    if (want.includes('R4')) { // Esc with focus inside the frame during a dive
      const t = await fresh(b); await open(t);
      await sel(t.fr, 'r-kitchen'); await t.p.waitForTimeout(700); await go(t.fr);
      await t.p.waitForTimeout(400);
      await t.p.evaluate(() => document.getElementById('t-3d-frame').focus());
      await t.p.keyboard.press('Escape');
      let s = await state(t.p);
      if (!s.hidden) { await t.p.waitForTimeout(150); await t.p.keyboard.press('Escape'); s = await state(t.p); }
      const closedAt = s.hidden;
      await t.p.waitForTimeout(9000);
      s = await state(t.p);
      rep('R4 Esc in frame during dive (<=2 presses): closed and no ghost navigation', closedAt && s.scene === 'living' && s.hidden && s.inert === 0, JSON.stringify(s) + ' closedWithin2=' + closedAt);
      await t.ctx.close();
    }
    if (want.includes('R5')) { // reduced motion
      const o = { ...base, reducedMotion: 'reduce' };
      let t = await fresh(b, o); await open(t);
      await sel(t.fr, 'r-kitchen'); await t.p.waitForTimeout(700); await go(t.fr);
      await t.p.waitForTimeout(8000);
      let s = await state(t.p);
      rep('R5a reduced motion: dive completes, tour in kitchen, layer closed', s.scene === 'kitchen' && s.hidden && s.inert === 0, JSON.stringify(s));
      await t.ctx.close();
      t = await fresh(b, o); await open(t);
      await sel(t.fr, 'r-kitchen'); await t.p.waitForTimeout(700); await go(t.fr);
      await t.p.keyboard.press('Escape'); await t.p.waitForTimeout(8000);
      s = await state(t.p);
      rep('R5b reduced motion: Esc right after go -> never stuck open/inert', s.hidden && s.inert === 0 && ['living', 'kitchen'].includes(s.scene), JSON.stringify(s));
      await t.ctx.close();
    }
    if (want.includes('R6')) { // two rooms fast, then Esc
      const t = await fresh(b); await open(t);
      await sel(t.fr, 'r-dining'); await t.p.waitForTimeout(600); await go(t.fr);
      await t.p.waitForTimeout(150); await sel(t.fr, 'r-kitchen'); await go(t.fr);
      await t.p.waitForTimeout(250); await t.p.keyboard.press('Escape');
      await t.p.waitForTimeout(9000);
      const s = await state(t.p);
      rep('R6 two rooms fast + Esc: usable (hidden, not inert)', s.hidden && s.inert === 0 && s.load, JSON.stringify(s));
      await t.p.evaluate(() => document.getElementById('t-3d-btn').click());
      await riseDone(t.fr);
      await sel(t.fr, 'r-kitchen'); await t.p.waitForTimeout(700); await go(t.fr); await t.p.waitForTimeout(9000);
      const s2 = await state(t.p);
      rep('R6b afterwards a normal dive works', s2.scene === 'kitchen' && s2.hidden && s2.inert === 0, JSON.stringify(s2));
      rep('R6 errs', t.errs.length === 0, t.errs.join('|'));
      await t.ctx.close();
    }
    if (want.includes('R7')) { // same-room dive from different tour yaws
      for (const yaw of [70, -120]) {
        const t = await fresh(b);
        await t.p.evaluate((y) => window.__tour.viewer.setYaw(y, false), yaw);
        await open(t);
        await sel(t.fr, 'r-living'); await t.p.waitForTimeout(700); await go(t.fr);
        await t.p.waitForTimeout(8000);
        const r = await t.p.evaluate(() => { const v = window.__tour.viewer; return { scene: window.__tour.scene, hidden: document.getElementById('t-3d').hidden, yaw: v.getYaw(), pitch: v.getPitch(), hfov: v.getHfov() }; });
        const hd = await t.p.evaluate(() => { const s = (window.__tour.data && window.__tour.data.scenes || []).find((x) => x.id === 'living'); return s ? s.heading : null; });
        const ok = r.hidden && r.scene === 'living' && Math.abs(r.pitch + 2) < 0.6 && (hd === null || Math.abs(((r.yaw - hd + 540) % 360) - 180) < 1);
        rep(`R7 same-room dive from yaw ${yaw}`, ok, JSON.stringify(r) + ' heading ' + hd);
        await t.ctx.close();
      }
    }
  } finally { await b.close(); srv.close(); }
  L.fs.writeFileSync(L.path.join(__dirname, `regate-races-${dev}.txt`), out.join('\n') + '\n');
})().catch((e) => { console.error('PROBE ERROR', e); process.exit(1); });

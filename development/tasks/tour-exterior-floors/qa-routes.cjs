// QA (fresh reviewer) for tour-exterior-floors: other routes by which the floor buttons could show on an exterior scene.
// usage: node qa-routes.cjs http://127.0.0.1:8851/ [out.txt]
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const base = process.argv[2] || 'http://127.0.0.1:8851/';
const EXT = ['aerial', 'orbit1', 'orbit2', 'orbit3', 'orbit4', 'orbit5', 'tower', 'approach45', 'approach25', 'facade', 'terraceOut'];
const out = []; let bad = 0;
const log = (ok, m) => { if (!ok) bad++; out.push((ok ? 'ok   ' : 'FAIL ') + m); };
const note = (m) => out.push('NOTE ' + m);
const state = () => ({
  scene: window.__tour.scene,
  seg: (() => { const n = document.getElementById('t-floor-seg'); const rc = n.getBoundingClientRect(); return { shown: !n.closest('[hidden]') && getComputedStyle(n).display !== 'none' && rc.width > 0, btn: n.querySelectorAll('button').length }; })(),
  bar: (() => { const n = document.getElementById('t-video-bar'); const rc = n.getBoundingClientRect(); const vb = document.getElementById('t-video-btn'); return { hiddenAttr: n.hidden, w: Math.round(rc.width), h: Math.round(rc.height), videoBtn: !vb.hidden }; })(),
  ovFloors: (() => { const n = document.getElementById('t-video-floors'); const ov = document.getElementById('t-video'); return { overlayOpen: !ov.hidden, buttons: n.querySelectorAll('button').length, shown: !ov.hidden && n.getBoundingClientRect().width > 0 }; })(),
  isExt: !!document.getElementById('t-plan-btn') && document.getElementById('t-plan-btn').hidden,
});
const ready = (p) => p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
// served copy with room clips on exterior + apartment scenes and an intro (clip requests are held open so the overlay stays up)
async function mutate(p) {
  await p.route('**/index.html*', async (route) => {
    const r = await route.fetch(); let t = await r.text();
    const rooms = '"rooms":{"aerial":"clips/a.mp4","facade":"clips/f.mp4","terraceOut":"clips/t.mp4","entrance":"clips/e.mp4"},"intro":"clips/intro.mp4"';
    t = t.replace(/"rooms":\{\}/g, rooms);
    await route.fulfill({ response: r, body: t });
  });
  await p.route('**/clips/*.mp4', () => { /* held open on purpose */ });
}
const goto = async (p, id) => { await p.evaluate((i) => window.__tour.viewer.loadScene(i), id); await p.waitForFunction((i) => window.__tour.scene === i, id, { timeout: 60000 }); await p.waitForTimeout(400); };
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [dev, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone13', devices['iPhone 13']]]) {
      // 1 real build, default video setting, every exterior id, plain / ?floor= deep links
      for (const q of ['', 'floor=concrete', 'floor=marble']) {
        const c = await b.newContext(opts); const p = await c.newPage();
        for (const id of EXT) {
          await p.goto(base + 'index.html?' + (q ? q + '&' : '') + 'room=' + id, { waitUntil: 'load' });
          try { await ready(p); } catch (e) { log(false, `${dev} ?${q} ${id} not ready`); continue; }
          await p.waitForTimeout(300);
          const s = await p.evaluate(state);
          if (s.scene !== id) { note(`${dev} ?${q} ${id} not a scene of this tour (opened ${s.scene})`); continue; }
          log(!s.seg.shown && s.isExt && !(s.bar.h > 0 && !s.bar.videoBtn), `${dev} real ?${q} ${id}: ext=${s.isExt} floorSeg=${s.seg.shown ? 'SHOWN' : 'hidden'} bar=${JSON.stringify(s.bar)}`);
        }
        await c.close();
      }
      // 2 ?scope=apartment
      { const c = await b.newContext(opts); const p = await c.newPage();
        await p.goto(base + 'index.html?video=0&scope=apartment', { waitUntil: 'load' }); await ready(p); await p.waitForTimeout(300);
        const s = await p.evaluate(state);
        log(!s.isExt && s.seg.shown, `${dev} scope=apartment scene=${s.scene} floorSeg=${s.seg.shown ? 'shown' : 'hidden'} (${s.seg.btn} buttons)`);
        await c.close(); }
      // 3 mutated copy with clips
      { const c = await b.newContext(opts); const p = await c.newPage(); await mutate(p);
        await p.goto(base + 'index.html?video=0&room=facade', { waitUntil: 'load' }); await ready(p); await p.waitForTimeout(300);
        let s = await p.evaluate(state);
        log(!s.seg.shown && s.bar.videoBtn && s.bar.h > 0, `${dev} mutated facade (has clip): floorSeg hidden=${!s.seg.shown} bar=${JSON.stringify(s.bar)}`);
        await goto(p, 'aerial');
        s = await p.evaluate(state); log(!s.seg.shown && s.bar.videoBtn, `${dev} mutated hop facade->aerial floorSeg=${s.seg.shown ? 'SHOWN' : 'hidden'} bar=${JSON.stringify(s.bar)}`);
        await p.click('#t-video-btn'); await p.waitForTimeout(300);
        s = await p.evaluate(state);
        if (s.ovFloors.shown) note(`${dev} exterior clip playing on ${s.scene}: the player's own strip #t-video-floors IS visible (${s.ovFloors.buttons} buttons)`);
        else log(true, `${dev} exterior clip overlay: no floor strip`);
        log(!s.seg.shown, `${dev} exterior clip playing: #t-floor-seg hidden=${!s.seg.shown}`);
        const fl = p.locator('#t-video-floors button').nth(1);
        if (await fl.count()) {
          await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 60000 }).catch(() => {}), fl.click()]);
          await ready(p); await p.waitForTimeout(400);
          s = await p.evaluate(state); log(!s.seg.shown && s.isExt, `${dev} after overlay floor switch: scene=${s.scene} url=${await p.evaluate(() => location.search)} floorSeg=${s.seg.shown ? 'SHOWN' : 'hidden'}`);
        }
        await goto(p, 'entrance');
        s = await p.evaluate(state); log(s.seg.shown && !s.isExt, `${dev} mutated apartment entrance: floorSeg=${s.seg.shown ? 'shown' : 'HIDDEN'}`);
        await goto(p, 'terraceOut');
        s = await p.evaluate(state); log(!s.seg.shown, `${dev} mutated back to terraceOut: floorSeg=${s.seg.shown ? 'SHOWN' : 'hidden'}`);
        for (let i = 0; i < 4; i++) { await p.click('#t-next'); await p.waitForTimeout(700); s = await p.evaluate(state); if (s.isExt) log(!s.seg.shown, `${dev} next-walk ${s.scene} floorSeg=${s.seg.shown ? 'SHOWN' : 'hidden'}`); }
        await c.close(); }
      // 4 mutated, intro flyover
      { const c = await b.newContext(opts); const p = await c.newPage(); await mutate(p);
        await p.goto(base + 'index.html?video=1', { waitUntil: 'load' }); await p.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 90000 }); await p.waitForTimeout(800);
        const s = await p.evaluate(state);
        if (s.ovFloors.overlayOpen) note(`${dev} intro flyover (building) playing: player strip #t-video-floors ${s.ovFloors.shown ? 'VISIBLE' : 'hidden'} (${s.ovFloors.buttons} buttons); #t-floor-seg ${s.seg.shown ? 'SHOWN' : 'hidden'} -- only if a build carries an intro; this build has none`);
        else log(true, `${dev} intro did not open (mutation)`);
        await c.close(); }
    }
  } finally { await b.close(); }
  out.push(bad ? `FAIL ${bad}` : 'PASS');
  console.log(out.join('\n'));
  if (process.argv[3]) fs.writeFileSync(process.argv[3], out.join('\n') + '\n');
})();

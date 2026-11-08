// tour-exterior-floors: on which scenes does the tour show the floor-finish buttons (בטון / פרקט / שיש)?
// usage: node probe-floors.cjs <base url of the tour, e.g. https://habait-flow.vercel.app/tour/> [out.txt]
// Desktop + iPhone 13; opens the tour with no room (its default) and every scene by ?room=, video off. Read-only, no server.
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const base = process.argv[2];
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  let bad = 0;
  try {
    for (const [dev, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone13', devices['iPhone 13']]]) {
      const p = await (await b.newContext(opts)).newPage();
      await p.goto(base + 'index.html?video=0', { waitUntil: 'load' });
      await p.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 90000 });
      const ids = ['aerial','orbit1','tower','approach45','facade','terraceOut','entrance','living','kitchen','bedroomMain'];
      const list = ['(default)', ...new Set(ids)];
      for (const id of list) {
        if (id !== '(default)') {
          await p.goto(base + 'index.html?video=0&room=' + encodeURIComponent(id), { waitUntil: 'load' });
          await p.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 90000 });
        }
        await p.waitForTimeout(400);
        const r = await p.evaluate(() => {
          const seg = document.getElementById('t-floor-seg');
          const vis = (n) => { if (!n) return false; const s = getComputedStyle(n); const rc = n.getBoundingClientRect(); return !n.closest('[hidden]') && s.display !== 'none' && s.visibility !== 'hidden' && rc.width > 0 && rc.height > 0; };
          return { scene: window.__tour.scene, buttons: seg ? seg.querySelectorAll('button').length : 0, visible: vis(seg) && seg.querySelectorAll('button').length > 0, plan: vis(document.getElementById('t-plan-btn')) };
        });
        // the plan button is shown only inside the apartment: it tells the two layers apart
        const exterior = !r.plan;
        const ok = exterior ? !r.visible : true;
        if (!ok) bad++;
        out.push(`${ok ? 'ok  ' : 'FAIL'} ${dev} ${id} -> scene ${r.scene} ${exterior ? 'EXTERIOR' : 'apartment'} floors ${r.visible ? 'VISIBLE' : 'hidden'} (${r.buttons} buttons)`);
      }
      await p.context().close();
    }
  } finally { await b.close(); }
  out.push(bad ? `FAIL ${bad}` : 'PASS');
  console.log(out.join('\n'));
  if (process.argv[3]) fs.writeFileSync(process.argv[3], out.join('\n') + '\n');
})();

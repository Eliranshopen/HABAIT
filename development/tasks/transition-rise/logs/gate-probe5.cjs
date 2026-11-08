// gate probe 5: the apartment page's own 3D tab (run platform serve.mjs on 8851): no move, same behaviour as before.
const { spawn } = require('child_process');
const AD = 'C:/RnD/Projects/Habait/tools/appdeps/node_modules/';
const { chromium, devices } = require(AD + 'playwright-core');
const PLAT = 'C:/RnD/.wt/transition-rise/run/Projects/Habait/habait-walkaround/Habait/platform';
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const [name, o] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone13', devices['iPhone 13']]]) {
      const ctx = await b.newContext(o); const p = await ctx.newPage();
      const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      await p.addInitScript(() => { window.__msgs = []; window.addEventListener('message', (e) => { if (e.data && e.data.type) window.__msgs.push({ t: Math.round(performance.now()), type: e.data.type, dove: e.data.dove, scene: e.data.scene }); }); });
      await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
      await p.goto('http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846&tab=3d', { waitUntil: 'load' });
      const fr = await (await p.waitForSelector('#dollFrame', { state: 'attached', timeout: 60000 })).contentFrame();
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 120000 });
      const st = await fr.evaluate(() => ({ tr: window.__dollhouse.transition, held: window.__dollhouse.held, spec: window.__dollhouseSpecFor('living', { yaw: 0 }) }));
      const okA = st.tr === null && !st.held && st.spec === null;
      console.log(`${okA ? 'ok  ' : 'FAIL'} ${name}: apartment page 3D tab loads with no move state ${JSON.stringify(st)}`);
      const t0 = await p.evaluate(() => Math.round(performance.now()));
      await fr.evaluate(() => window.__dollhouseSelect('r-kitchen')); await p.waitForTimeout(900);
      await fr.evaluate(() => document.querySelector('.dh-sheet .go').click());
      await p.waitForTimeout(2500);
      const msgs = await p.evaluate(() => window.__msgs);
      const er = msgs.find((m) => m.type === 'habait:enter-room');
      const bad = msgs.filter((m) => /rise|scenes/.test(m.type));
      console.log(`${er && !er.dove && er.t - t0 < 1800 && bad.length === 0 ? 'ok  ' : 'FAIL'} ${name}: "view in 360" posts enter-room at once without a dive; no rise messages ${JSON.stringify(msgs)} (t0 ${t0})`);
      const tr = await fr.evaluate(() => ({ tr: window.__dollhouse.transition, held: window.__dollhouse.held }));
      console.log(`${tr.tr === null && !tr.held ? 'ok  ' : 'FAIL'} ${name}: still no transition after the click ${JSON.stringify(tr)} errs ${errs.length} ${errs.join('|')}`);
      await p.screenshot({ path: 'C:/RnD/development/tasks/transition-rise/logs/gate-frames/p5-' + name + '.png' });
      await ctx.close();
    }
  } finally { await b.close(); srv.kill(); }
})();

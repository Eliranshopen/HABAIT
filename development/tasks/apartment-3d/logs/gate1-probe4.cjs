// Gate 1 page-level probe: deep link precedence, scroll-under-tabs on phones, chip visibility, 3 s fallback reload, double analytics.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const BASE = 'http://127.0.0.1:8851';
const PAGE = BASE + '/apartment.html?project=rainbow&unit=846';
const lines = [];
const log = (m) => { lines.push(m); console.log(m); };
// a stub tour that NEVER answers habait:goto (simulates a tour still loading) but does report its first scene
const STUB = `<!doctype html><body><script>const q=new URLSearchParams(location.search);window.__scene=q.get('room')||'terraceLiving';
parent.postMessage({type:'habait:view',scene:window.__scene,yaw:0,fov:90,pitch:0,floor:'parquet'},'*');
addEventListener('message',e=>{const d=e.data||{};if(d.type==='habait:view-request')parent.postMessage({type:'habait:view',scene:window.__scene,yaw:0,fov:90,pitch:0,floor:'parquet'},'*')});</script></body>`;
const tab = (p) => p.evaluate(() => document.querySelector('[role=tab][aria-selected=true]')?.dataset.tab);
const fresh = async (p, u) => { await p.goto('about:blank'); await p.goto(u, { waitUntil: 'load' }); await p.waitForTimeout(800); };
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const [name, opts] of [['iphone13', devices['iPhone 13']], ['pixel7', devices['Pixel 7']], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
      const ctx = await b.newContext(opts);
      await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: STUB }));
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      for (const [u, want] of [['&tab=3d#tour', '3d'], ['#3d', '3d'], ['&tab=photos#bogus', 'photos'], ['#bogus', 'tour'], ['', 'tour'], ['&tab=bogus#bogus', 'tour'], ['#photos', 'photos'], ['&tab=3d', '3d']]) {
        await fresh(p, PAGE + u); const t = await tab(p);
        log(`${name} ${u || '(none)'} -> ${t} (want ${want}) ${t === want ? 'ok' : 'MISMATCH'}`);
      }
      // chip hidden before any entry, in every tab
      await fresh(p, PAGE + '&tab=3d');
      log(`${name} chip before entry hidden=${await p.evaluate(() => document.getElementById('backTo3dRow').hidden)}`);
      // scroll-under-tabs after tapping a tab on phone
      if (name !== 'desktop') {
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.click('[role=tab][data-tab="photos"]'); await p.waitForTimeout(900);
        await p.click('[role=tab][data-tab="3d"]'); await p.waitForTimeout(1200);
        const g = await p.evaluate(() => { const t = document.querySelector('.apt-tabs').getBoundingClientRect(); const panel = document.querySelector('.apt-panel:not([hidden])') || document.querySelector('[role=tabpanel]:not([hidden])'); const r = panel && panel.getBoundingClientRect(); return { tabsBottom: Math.round(t.bottom), panelTop: r && Math.round(r.top), sy: Math.round(scrollY) }; });
        log(`${name} after tab tap: ${JSON.stringify(g)}`);
      }
      // chip after entry stays? goes away when user leaves tour via another tab?
      const fr = await (await p.$('#dollFrame')).contentFrame();
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      await fr.evaluate(() => window.__dollhouseSelect('r-kitchen')); await p.waitForTimeout(700);
      await fr.click('.dh-sheet .go'); await p.waitForTimeout(800);
      log(`${name} tour tab ${await tab(p)}, chip visible ${await p.evaluate(() => { const e = document.getElementById('backTo3dRow'); return !e.hidden && e.getBoundingClientRect().height > 0; })}, tour src ${(await p.evaluate(() => document.getElementById('tourFrame').src)).replace(/^.*\?/, '?')}`);
      // tour already loaded, never answers goto -> 3 s later the frame reloads with room=
      await p.click('#backTo3d'); await p.waitForTimeout(700);
      await fr.evaluate(() => window.__dollhouseSelect('r-bedroom-2')); await p.waitForTimeout(700);
      const s0 = await p.evaluate(() => document.getElementById('tourFrame').src);
      await fr.click('.dh-sheet .go'); await p.waitForTimeout(3800);
      const s1 = await p.evaluate(() => document.getElementById('tourFrame').src);
      log(`${name} fallback: src changed ${s0 !== s1}; room= ${(s1.match(/room=([^&]*)/) || [])[1]} (stub reports the scene it was loaded with, so the first goto is silently ignored)`);
      // sheet inside page after a second tab: dollhouse selection state survives tab trips
      await p.click('#backTo3d').catch(() => {}); await p.waitForTimeout(500);
      log(`${name} errors: ${errs.length ? errs.join(' | ') : 'none'}`);
      await ctx.close();
    }
  } catch (e) { log('ERROR ' + e.stack); } finally { await b.close(); srv.kill(); }
  fs.writeFileSync(path.join(__dirname, 'gate1-probe4.txt'), lines.join('\n') + '\n');
})();

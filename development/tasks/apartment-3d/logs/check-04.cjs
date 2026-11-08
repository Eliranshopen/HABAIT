// Card 04 acceptance: 3D -> 360 at that room -> back; deep links; phone layout; the fixture badge; the legal text.
// Runs the WORK-TREE platform on :8851; the tour (http://127.0.0.1:8848, not running) is answered by an in-browser stub
// that speaks the real bridge: habait:view {scene} on load / on habait:goto / on habait:view-request.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = process.argv[2] || 'C:/RnD/.wt/apartment-3d/after/card04';
const PAGE = (host) => `http://${host}:8851/apartment.html?project=rainbow&unit=846`;
fs.mkdirSync(OUT, { recursive: true });
const res = { ok: [], fail: [] };
const check = (cond, msg) => (cond ? res.ok : res.fail).push(msg);
const STUB = `<!doctype html><body style="margin:0;background:#cbb;font:20px sans-serif"><div id="s"></div><script>
const q = new URLSearchParams(location.search); window.__scene = q.get('room') || 'terraceLiving'; window.__gotos = 0;
const send = () => { document.getElementById('s').textContent = 'stub tour: ' + window.__scene; parent.postMessage({ type: 'habait:view', scene: window.__scene, yaw: 0, fov: 90, pitch: 0, floor: q.get('floor') || 'parquet' }, '*'); };
addEventListener('message', (e) => { const d = e.data || {}; if (d.type === 'habait:goto') { window.__gotos++; window.__scene = d.scene; send(); } if (d.type === 'habait:view-request') send(); });
send(); setInterval(send, 400);
</script></body>`;
const legalShort = JSON.parse(fs.readFileSync(PLAT + '/_local/dist/rainbow/846/apartment.json', 'utf8')).legal.short.he;

async function tab(p) {
  await p.waitForFunction(() => document.querySelector('[role=tab][aria-selected=true]'), null, { timeout: 15000 }).catch(() => {});
  return p.evaluate(() => document.querySelector('[role=tab][aria-selected=true]')?.dataset.tab);
}
// a fresh document load (a goto that differs only by #hash is a same-document navigation and never re-runs the page)
async function fresh(p, url) { await p.goto('about:blank'); await p.goto(url, { waitUntil: 'load' }); }
async function doll(p) {
  const fr = await (await p.$('#dollFrame')).contentFrame();
  await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 60000 });
  return fr;
}

(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--host-resolver-rules=MAP apt.test 127.0.0.1'] });
  try {
    for (const [name, opts] of [['iphone13', devices['iPhone 13']], ['pixel7', devices['Pixel 7']], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
      const ctx = await b.newContext(opts);
      await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: STUB }));
      await ctx.route('http://127.0.0.1:8899/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub hold</p>' }));
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      // deep link: ?tab=3d wins over a stale #tour
      await fresh(p, PAGE('127.0.0.1') + '&tab=3d#tour');
      const t0 = await tab(p);
      check(t0 === '3d', `${name}: ?tab=3d#tour opens ${t0}`);
      const fr = await doll(p);
      await p.waitForTimeout(900);
      // layout on phones: the 3D frame sits fully above the WhatsApp bar, no sideways scroll
      const lay = await p.evaluate(() => {
        const f = document.querySelector('.apt-frame-3d').getBoundingClientRect();
        const bar = document.getElementById('mobileBar');
        const bt = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : innerHeight;
        return { fTop: f.top, fBottom: f.bottom, barTop: bt, sw: document.documentElement.scrollWidth, w: innerWidth };
      });
      if (name !== 'desktop') check(lay.fBottom <= lay.barTop + 1 && lay.fTop >= 0, `${name}: 3D frame ${Math.round(lay.fTop)}..${Math.round(lay.fBottom)} above the bar at ${Math.round(lay.barTop)}`);
      check(lay.sw === lay.w, `${name}: no sideways scroll (${lay.sw} vs ${lay.w})`);
      await p.screenshot({ path: `${OUT}/${name}_3d_tab.png` });
      // the caption: the full short text unchanged
      const cap = await fr.evaluate(() => [...document.querySelectorAll('.cap > p')].map((x) => ({ pill: x.classList.contains('pill'), t: x.textContent })));
      check(cap.some((c) => !c.pill && c.t === legalShort), `${name}: full legal short text unchanged inside the 3D`);
      // 3D -> 360 (tour not loaded yet): room=living in the tour URL
      await fr.evaluate(() => window.__dollhouseSelect('r-living'));
      await p.waitForTimeout(900);
      await fr.click('.dh-sheet .go');
      await p.waitForTimeout(1500);
      const t1 = await p.evaluate(() => ({ src: document.getElementById('tourFrame').src, back: !document.getElementById('backTo3dRow').hidden }));
      check(await tab(p) === 'tour', `${name}: "view in 360" switches to the tour tab`);
      check(/[?&]room=living(&|$)/.test(t1.src), `${name}: the tour opened at room=living (${t1.src.slice(0, 90)}…)`);
      check(t1.back, `${name}: "back to 3D" is visible`);
      const tfr = await (await p.$('#tourFrame')).contentFrame();
      check(await tfr.evaluate(() => window.__scene) === 'living', `${name}: the tour reports scene living`);
      await p.screenshot({ path: `${OUT}/${name}_tour_living.png` });
      // back -> 3D keeps the selection
      await p.click('#backTo3d');
      await p.waitForTimeout(800);
      check(await tab(p) === '3d', `${name}: back returns to the 3D tab`);
      check(await fr.evaluate(() => window.__dollhouse.selected) === 'r-living', `${name}: the 3D kept its selection`);
      // 3D -> 360 again (tour already loaded): habait:goto kitchen
      await fr.evaluate(() => window.__dollhouseSelect('r-kitchen'));
      await p.waitForTimeout(900);
      await fr.click('.dh-sheet .go');
      await p.waitForTimeout(1200);
      const k = await tfr.evaluate(() => ({ s: window.__scene, g: window.__gotos }));
      check(k.s === 'kitchen' && k.g >= 1, `${name}: loaded tour went to kitchen by habait:goto (${JSON.stringify(k)})`);
      // #3d alone
      await fresh(p, PAGE('127.0.0.1') + '#3d');
      const t3 = await tab(p);
      check(t3 === '3d', `${name}: #3d opens ${t3}`);
      // fixture badge: shown on the laptop host, hidden elsewhere, shown with ?dev=1
      const fx = async (url) => { await fresh(p, url); await tab(p); return p.evaluate(() => !document.getElementById('aptFixture').hidden); };
      check(await fx(PAGE('127.0.0.1')) === true, `${name}: fixture badge shown on 127.0.0.1`);
      check(await fx(PAGE('apt.test')) === false, `${name}: fixture badge hidden on a public host`);
      check(await fx(PAGE('apt.test') + '&dev=1') === true, `${name}: fixture badge shown with ?dev=1`);
      check(errs.length === 0, `${name}: no page errors ${errs.join(' | ')}`);
      await ctx.close();
    }
  } catch (e) {
    res.fail.push('ERROR ' + e.message);
  } finally {
    await b.close();
    srv.kill();
  }
  const txt = `card 04 check ${new Date().toISOString()}\nPASS ${res.ok.length} · FAIL ${res.fail.length}\n` + res.fail.map((x) => 'FAIL ' + x).join('\n') + '\n' + res.ok.map((x) => 'ok   ' + x).join('\n') + '\n';
  fs.writeFileSync(path.join(__dirname, 'check-04.txt'), txt);
  console.log(txt);
  process.exit(res.fail.length ? 1 : 0);
})();

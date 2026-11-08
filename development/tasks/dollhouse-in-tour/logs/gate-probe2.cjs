// qa gate probe 2: the dollhouse inside the APARTMENT PAGE (run platform serve.mjs on 8851): no marker, selection kept, malformed messages harmless.
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PLAT = 'C:/RnD/.wt/dollhouse-in-tour/run/Projects/Habait/habait-walkaround/Habait/platform';
const OUT = __dirname; const out = []; const log = (ok, m) => out.push((ok === null ? 'info ' : ok ? 'ok   ' : 'FAIL ') + m);
const STUB = `<!doctype html><body><script>
const q = new URLSearchParams(location.search); window.__scene = q.get('room') || 'terraceLiving';
const send = () => parent.postMessage({ type: 'habait:view', scene: window.__scene, yaw: 20, fov: 90, pitch: 0, floor: 'parquet' }, '*');
addEventListener('message', (e) => { const d = e.data || {}; if (d.type === 'habait:goto') { window.__scene = d.scene; send(); } if (d.type === 'habait:view-request') send(); });
send(); setInterval(send, 400);
</script></body>`;
(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    await new Promise((r) => setTimeout(r, 2500));
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: STUB }));
    await ctx.route('http://127.0.0.1:8899/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846&tab=3d', { waitUntil: 'load' });
    const fr = await (await p.waitForSelector('#dollFrame', { state: 'attached' })).contentFrame();
    await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const h0 = await fr.evaluate(() => window.__dollhouse.here);
    const wedges = await fr.evaluate(() => { let n = 0; window.__dollhouseView.scene.traverse((o) => { if (o.geometry && o.geometry.type === 'CircleGeometry' && o.geometry.parameters.radius === 2.4) n++; }); return n; });
    log(h0 === null && wedges === 0, `apartment page 3D tab: here=${JSON.stringify(h0)}, wedge meshes ${wedges} (none expected)`);
    await fr.evaluate(() => window.__dollhouseSelect('r-living')); await p.waitForTimeout(800);
    await fr.click('.dh-sheet .go'); await p.waitForTimeout(1200);
    await p.click('#backTo3d'); await p.waitForTimeout(800);
    const sel = await fr.evaluate(() => window.__dollhouse.selected);
    const h1 = await fr.evaluate(() => window.__dollhouse.here);
    log(sel === 'r-living' && h1 === null, `after 3D->360->back: selected ${sel}, here ${JSON.stringify(h1)}`);
    // the 360 tab's real tour is the stub here; the real from=apartment case is covered in probe1/check-dit (button hidden)
    // malformed messages straight at the dollhouse frame
    const n0 = errs.length;
    const send = (m) => p.evaluate((mm) => document.getElementById('dollFrame').contentWindow.postMessage(mm, '*'), m); // from the PARENT, like the tour
    for (const m of [{ type: 'habait:you-are-here' }, { type: 'habait:you-are-here', scene: 'nope', bearing: 10, fov: 90 }, { type: 'habait:you-are-here', scene: 'living', bearing: 'x', fov: 1e9 },
      { type: 'habait:you-are-here', scene: 'living', bearing: NaN, fov: -5 }, { type: 'habait:you-are-here', scene: 'living', bearing: 720.5, fov: 0 }, null, 'str', 5, { type: 'habait:you-are-here', scene: { a: 1 } }]) { await send(m); }
    await p.waitForTimeout(500);
    const hh = await fr.evaluate(() => window.__dollhouse.here);
    log(errs.length === n0, `malformed you-are-here messages: no page errors (${errs.slice(n0).join(' | ')}); last here ${JSON.stringify(hh)}`);
    // a you-are-here for a real scene while embedded in the apartment page selects nothing / keeps selection when scene differs
    await fr.evaluate(() => window.__dollhouseSelect('r-kitchen')); await p.waitForTimeout(500);
    await send({ type: 'habait:you-are-here', scene: 'living', bearing: 90, fov: 90 }); await p.waitForTimeout(400);
    log(await fr.evaluate(() => window.__dollhouse.selected) === 'r-kitchen', 'you-are-here for another room keeps the kitchen selection');
    await send({ type: 'habait:you-are-here', scene: 'kitchen', bearing: 90, fov: 90 }); await p.waitForTimeout(400);
    const s2 = await fr.evaluate(() => window.__dollhouse.selected);
    log(s2 === null, `you-are-here for the SELECTED room closes its sheet as designed (selected ${s2}); same scene again should not re-close`);
    await fr.evaluate(() => window.__dollhouseSelect('r-kitchen')); await p.waitForTimeout(400);
    await send({ type: 'habait:you-are-here', scene: 'kitchen', bearing: 95, fov: 90 }); await p.waitForTimeout(400);
    log(await fr.evaluate(() => window.__dollhouse.selected) === 'r-kitchen', 'repeat you-are-here (same room) keeps a fresh selection');
    // clearing: unknown scene removes the marker
    await send({ type: 'habait:you-are-here', scene: 'exteriorX', bearing: 0, fov: 90 }); await p.waitForTimeout(300);
    log(await fr.evaluate(() => window.__dollhouse.here) === null, 'an unknown/exterior scene clears the marker');
    log(errs.length === n0, 'no page errors overall: ' + errs.join(' | '));
    await p.screenshot({ path: path.join(OUT, 'gate-apartment-3d.png') });
    await ctx.close();
  } catch (e) { out.push('FAIL ERROR ' + e.stack); }
  finally { await b.close(); try { srv.kill(); } catch (_) {} spawn('taskkill', ['/PID', String(srv.pid), '/T', '/F']); }
  fs.writeFileSync(path.join(OUT, 'gate-probe2.txt'), out.join('\n') + '\n'); console.log(out.join('\n'));
  process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})();

// REGATE probe 1: D1 with REAL input (mouse / touchscreen / CDP touch drag / keyboard) on desktop, iPhone 13, Pixel 7.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const ROOT = 'C:/RnD/.wt/dollhouse-in-tour/run/tourout/apt846';
const OUT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.vtt': 'text/vtt' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(path.normalize(ROOT)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const out = [];
const log = (ok, m) => { out.push((ok === null ? 'info ' : ok ? 'ok   ' : 'FAIL ') + m); };
(async () => {
  await new Promise((r) => srv.listen(8851, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone13', devices['iPhone 13']], ['pixel7', devices['Pixel 7']]]) {
      const touch = !!opts.hasTouch;
      const ctx = await b.newContext(opts);
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
      const cdp = await ctx.newCDPSession(p);
      const tap = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
      const drag = async (x0, y0, x1, y1) => {
        if (!touch) { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * i) / 12); await p.mouse.up(); return; }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
        for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 12, y: y0 + ((y1 - y0) * i) / 12 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      const centre = async (sel) => { const bb = await (await p.$(sel)).boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, bb }; };
      const st = () => p.evaluate(() => ({ hidden: document.getElementById('t-3d').hidden, active: document.activeElement && (document.activeElement.id || document.activeElement.tagName), inert: [...document.getElementById('t-root').children].filter((n) => n.inert).map((n) => n.id || n.tagName), layerInert: document.getElementById('t-3d').inert, rootInert: document.getElementById('t-root').inert, scene: window.__tour.scene, yaw: +window.__tour.viewer.getYaw().toFixed(2) }));
      const L = (m) => `${name}: ${m}`;
      await p.goto('http://127.0.0.1:8851/index.html?room=living&video=0', { waitUntil: 'load' });
      await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 }); await p.waitForTimeout(1000);
      await p.evaluate(() => { try { window.__tour.viewer.stopAutoRotate && window.__tour.viewer.stopAutoRotate(); } catch (_) {} });
      // --- open with a REAL tap on the 3D button
      const btn = await centre('#t-3d-btn');
      await tap(btn.x, btn.y); await p.waitForTimeout(400);
      let s = await st();
      log(!s.hidden && s.active === 't-3d-close', L('real tap on 3D button opens layer, focus on x: ' + JSON.stringify(s)));
      log(!s.layerInert && !s.rootInert && s.inert.length > 0 && !s.inert.includes('t-3d'), L('inert on siblings only, not layer/root: ' + JSON.stringify(s.inert)));
      const fr = await (await p.waitForSelector('#t-3d-frame', { state: 'attached' })).contentFrame();
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 }); await p.waitForTimeout(1500);
      // --- the tour behind takes no pointer input: tap where the 3D button was + tools; elementFromPoint is in the layer
      const hit = await p.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e && (e.closest('#t-3d') ? 'layer' : e.id || e.tagName); }, { x: btn.x, y: btn.y });
      log(hit === 'layer', L('point where 3D btn was hits: ' + hit));
      const before = await st();
      // tap hitting where tour tools are (t-tools area) then verify nothing changed
      const tools = await p.evaluate(() => [...document.querySelectorAll('#t-tools button')].map((e) => { const r = e.getBoundingClientRect(); return { id: e.id, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }).filter((t) => t.w > 0));
      for (const t of tools) { if (t.id === 't-3d-btn') continue; await tap(t.x, t.y); await p.waitForTimeout(120); }
      const afterTap = await st();
      log(afterTap.scene === before.scene && !afterTap.hidden, L(`taps on ${tools.length} tool positions: scene/layer unchanged (${tools.map((t) => t.id).join(',')})`));
      // Tab from x: focus must never land in the tour behind
      await p.focus('#t-3d-close'); const seen = [];
      for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); await p.waitForTimeout(40); seen.push(await p.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName))); }
      log(seen.every((a) => a === 't-3d-close' || a === 't-3d-frame' || a === 'BODY'), L('Tab x8 stays in layer: ' + seen.join(',')));
      await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(200);
      const afterKb = await st();
      log(afterKb.yaw === before.yaw && afterKb.scene === before.scene, L(`keyboard arrows do not move the tour behind (yaw ${before.yaw} -> ${afterKb.yaw})`));
      // --- 3D interactive: drag rotates dollhouse; tour yaw unchanged
      const fb = (await (await p.$('#t-3d-frame')).boundingBox());
      const v0 = await fr.evaluate(() => window.__dollhouse.view);
      const yaw0 = (await st()).yaw;
      const sy = fb.y + fb.height * 0.78; await drag(fb.x + fb.width * 0.5, sy, fb.x + fb.width * 0.5 + 140, sy + 20);
      await p.waitForTimeout(600);
      const v1 = await fr.evaluate(() => window.__dollhouse.view);
      const s1 = await st();
      log(Math.abs(v1.azimuthDeg - v0.azimuthDeg) > 3 || Math.abs(v1.polarDeg - v0.polarDeg) > 1, L(`real drag rotates the dollhouse: az ${v0.azimuthDeg}->${v1.azimuthDeg}, polar ${v0.polarDeg}->${v1.polarDeg}`));
      log(s1.yaw === yaw0, L(`tour yaw unchanged by 3D drag (${yaw0} -> ${s1.yaw})`));
      log(s1.active === 't-3d-frame', L('real drag moves focus into the frame: ' + s1.active));
      // presets by real tap
      const presets = await fr.evaluate(() => [...document.querySelectorAll('.dh-presets button')].map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent, x: r.x + r.width / 2, y: r.y + r.height / 2, p: e.getAttribute('aria-pressed') }; }));
      log(presets.length >= 2, L('preset buttons: ' + presets.map((q) => q.t + ':' + q.p).join(' ')));
      const startPreset = await fr.evaluate(() => window.__dollhouse.preset);
      const target = presets.find((q) => q.p !== 'true');
      await tap(fb.x + target.x, fb.y + target.y); await p.waitForTimeout(1500);
      const np = await fr.evaluate(() => ({ preset: window.__dollhouse.preset, view: window.__dollhouse.view }));
      log(np.preset !== startPreset, L(`real tap on preset "${target.t}" changes preset ${startPreset} -> ${np.preset}`));
      // --- Esc (focus is in the frame). Take up to 2 presses; record what each did.
      const sel0 = await fr.evaluate(() => window.__dollhouse.selected);
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
      let s2 = await st();
      log(s2.hidden, L(`Esc with focus in frame, no room selected (selected=${sel0}) closes layer in ONE press: ${JSON.stringify(s2)}`));
      log(s2.inert.length === 0 && s2.active === 't-3d-btn', L('after close: no inert left, focus back on 3D button: ' + JSON.stringify({ inert: s2.inert, active: s2.active })));
      // --- tour live again: real drag changes yaw, real tap on 3D button reopens
      const pc = await p.evaluate(() => ({ w: innerWidth, h: innerHeight }));
      const y1 = (await st()).yaw;
      await drag(pc.w * 0.5, pc.h * 0.5, pc.w * 0.5 + 160, pc.h * 0.5);
      await p.waitForTimeout(500);
      const y2 = (await st()).yaw;
      log(y2 !== y1, L(`tour drag works after close: yaw ${y1} -> ${y2}`));
      const btn2 = await centre('#t-3d-btn'); await tap(btn2.x, btn2.y); await p.waitForTimeout(500);
      log(!(await st()).hidden, L('3D button re-opens with real tap after close'));
      // --- room label tap -> sheet; Esc closes sheet only; Esc again closes layer
      const room = await fr.evaluate(() => { const r = window.__dollhouse.rooms.find((q) => q.id === 'r-kitchen'); return r; });
      const lab = await fr.evaluate((he) => { const l = [...document.querySelectorAll('.dh-label')].find((e) => !e.hidden && e.textContent.includes(he)); if (!l) return null; const r = l.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, room.he);
      log(!!lab, L('kitchen label found: ' + JSON.stringify(lab)));
      if (lab) {
        await tap(fb.x + lab.x, fb.y + lab.y); await p.waitForTimeout(900);
        const sel1 = await fr.evaluate(() => window.__dollhouse.selected);
        log(sel1 === 'r-kitchen', L('real tap on label selects kitchen: ' + sel1));
        await p.keyboard.press('Escape'); await p.waitForTimeout(500);
        s2 = await st(); const sel2 = await fr.evaluate(() => window.__dollhouse.selected);
        log(!s2.hidden && sel2 === null, L(`1st Esc closes the sheet only (layer hidden=${s2.hidden}, selected=${sel2})`));
        await p.keyboard.press('Escape'); await p.waitForTimeout(400);
        s2 = await st();
        log(s2.hidden && s2.inert.length === 0, L('2nd Esc closes the layer: ' + JSON.stringify(s2)));
        // reopen, label tap, then real tap on go
        const btn3 = await centre('#t-3d-btn'); await tap(btn3.x, btn3.y); await p.waitForTimeout(700);
        const lab2 = await fr.evaluate((he) => { const l = [...document.querySelectorAll('.dh-label')].find((e) => !e.hidden && e.textContent.includes(he)); if (!l) return null; const r = l.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, room.he);
        await tap(fb.x + lab2.x, fb.y + lab2.y); await p.waitForTimeout(900);
        const go = await fr.evaluate(() => { const g = document.querySelector('.dh-sheet .go'); if (!g) return null; const r = g.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: g.textContent }; });
        log(!!go, L('sheet go button: ' + JSON.stringify(go)));
        if (go) {
          await tap(fb.x + go.x, fb.y + go.y);
          await p.waitForFunction(() => window.__tour.scene === 'kitchen', null, { timeout: 15000 }).catch(() => {});
          await p.waitForTimeout(600);
          s2 = await st();
          log(s2.scene === 'kitchen' && s2.hidden && s2.inert.length === 0, L('real tap on "go" moves tour to kitchen, layer closed, nothing inert: ' + JSON.stringify(s2)));
        }
      }
      // --- close via x with real tap, and Esc with focus on x
      await p.waitForTimeout(1200);
      const btn4 = await centre('#t-3d-btn'); await tap(btn4.x, btn4.y); await p.waitForTimeout(600);
      const x = await centre('#t-3d-close'); await tap(x.x, x.y); await p.waitForTimeout(300);
      s2 = await st(); log(s2.hidden && s2.inert.length === 0, L('real tap on x closes: ' + JSON.stringify(s2)));
      await tap(btn4.x, btn4.y); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      s2 = await st(); log(s2.hidden && s2.inert.length === 0, L('Esc with focus on x closes: ' + JSON.stringify(s2)));
      // rapid open/close x15 leaves nothing inert
      for (let i = 0; i < 15; i++) { await p.evaluate(() => document.getElementById('t-3d-btn').click()); await p.keyboard.press('Escape'); }
      await p.waitForTimeout(300); s2 = await st(); log(s2.hidden && s2.inert.length === 0, L('x15 open/Esc churn: nothing inert, ' + JSON.stringify(s2)));
      log(errs.length === 0, L('no page/console errors ' + errs.slice(0, 3).join(' | ')));
      await p.screenshot({ path: path.join(OUT, `regate-${name}.png`) });
      await ctx.close();
    }
  } catch (e) { out.push('FAIL ERROR ' + e.stack); }
  finally { await b.close(); srv.close(); }
  fs.writeFileSync(path.join(OUT, 'regate-probe1.txt'), out.join('\n') + '\n');
  console.log(out.join('\n'));
  process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})();

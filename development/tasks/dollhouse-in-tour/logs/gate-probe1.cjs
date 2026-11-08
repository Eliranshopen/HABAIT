// qa gate probe 1: marker direction/position per interior scene, exterior hides, open/close churn, keyboard, RTL, phone, floor.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const ROOT = 'C:/RnD/.wt/dollhouse-in-tour/run/tourout/apt846';
const OUT = __dirname;
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.vtt': 'text/vtt' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(path.normalize(ROOT)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const out = [];
const log = (ok, m) => { out.push((ok === null ? 'info ' : ok ? 'ok   ' : 'FAIL ') + m); };
const wrap = (b) => ((b % 360) + 360) % 360;
const angDiff = (a, b) => { const d = wrap(a - b); return d > 180 ? 360 - d : d; };
const scenes = JSON.parse(fs.readFileSync(APT + '/scenes.json', 'utf8')).scenes;
const cams = JSON.parse(fs.readFileSync(APT + '/cameras.json', 'utf8'));
const camById = {}; for (const c of cams.scenes) camById[c.id] = c;
const ppc = cams.plan.pxPerCm;
const WEDGE_JS = () => {
  const v = window.__dollhouseView; let res = null;
  v.scene.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry' && o.geometry.parameters && o.geometry.parameters.radius === 2.4) {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements; const pos = o.geometry.attributes.position; let sx = 0, sz = 0, n = 0;
      for (let i = 1; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const wx = e[0] * x + e[4] * y + e[8] * z, wz = e[2] * x + e[6] * y + e[10] * z; const L = Math.hypot(wx, wz) || 1; sx += wx / L; sz += wz / L; n++; }
      const ang = (Math.atan2(sx, -sz) * 180) / Math.PI; // bearing: 0 = -z (plan up), clockwise
      res = { wedgeBearing: ((ang % 360) + 360) % 360, parent: { x: o.parent.position.x, z: o.parent.position.z }, vis: o.visible };
    }
  });
  return res;
};
(async () => {
  await new Promise((r) => srv.listen(8851, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
    // ---- A. every interior scene
    const interior = scenes.filter((s) => !s.exterior); const exterior = scenes.filter((s) => s.exterior);
    let ref = null;
    for (const s of interior) {
      await p.goto(`http://127.0.0.1:8851/index.html?room=${s.id}&video=0`, { waitUntil: 'load' });
      await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
      await p.evaluate(() => { try { window.__tour.viewer.stopAutoRotate && window.__tour.viewer.stopAutoRotate(); } catch (_) {} });
      const yawSet = 37;
      await p.evaluate((y) => window.__tour.viewer.setYaw(y, false), yawSet);
      await p.waitForTimeout(500);
      const vis = await p.evaluate(() => { const b = document.getElementById('t-3d-btn'); return !b.hidden && b.getBoundingClientRect().width > 0; });
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      const fr = await (await p.waitForSelector('#t-3d-frame', { state: 'attached' })).contentFrame();
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      await p.waitForTimeout(900);
      const yaw = await p.evaluate(() => window.__tour.viewer.getYaw());
      const here = await fr.evaluate(() => window.__dollhouse.here);
      const w = await fr.evaluate(WEDGE_JS);
      const exp = wrap(s.centreBearingDeg + yaw);
      const sc = await p.evaluate(() => window.__tour.scene);
      const c = camById[s.id]; const xcm = c.at[0] / ppc, ycm = c.at[1] / ppc;
      if (!ref) ref = { x: here && here.x, z: here && here.z, xcm, ycm };
      const dx = here ? (here.x - ref.x) * 100 - (xcm - ref.xcm) : 999, dz = here ? (here.z - ref.z) * 100 - (ycm - ref.ycm) : 999;
      log(vis && here && sc === s.id && angDiff(here.bearingDeg, exp) < 0.6 && w && angDiff(w.wedgeBearing, exp) < 3 && Math.abs(dx) < 1.5 && Math.abs(dz) < 1.5,
        `${s.id}: btn ${vis}, marker room ${here && here.room}, bearing marker ${here && here.bearingDeg} / wedge geometry ${w && w.wedgeBearing.toFixed(1)} / expected ${exp.toFixed(1)}, pos delta vs cameras.json ${dx.toFixed(2)},${dz.toFixed(2)} cm`);
    }
    // ---- B. exterior scenes hide the button
    for (const s of exterior) {
      await p.goto(`http://127.0.0.1:8851/index.html?room=${s.id}&video=0`, { waitUntil: 'load' });
      await p.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 90000 });
      await p.waitForTimeout(500);
      const hid = await p.evaluate(() => { const b = document.getElementById('t-3d-btn'); return b.hidden || getComputedStyle(b).display === 'none' || b.getBoundingClientRect().width === 0; });
      const sc = await p.evaluate(() => window.__tour.scene);
      log(hid && sc === s.id, `exterior ${s.id} (scene ${sc}): 3D button hidden ${hid}`);
    }
    // ---- B2. layer open while navigating into an exterior scene
    await p.goto('http://127.0.0.1:8851/index.html?room=living&video=0', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
    log(null, 'tour exports: ' + (await p.evaluate(() => Object.keys(window.__tour).join(','))));
    // ---- C. churn
    const nErr0 = errs.length;
    for (let i = 0; i < 40; i++) {
      await p.evaluate(() => document.getElementById('t-3d-btn').click());
      await p.waitForTimeout(i % 5 === 0 ? 300 : 30);
      await p.evaluate(() => document.getElementById('t-3d-close').click());
    }
    await p.waitForTimeout(600);
    const frames = await p.evaluate(() => document.querySelectorAll('#t-3d-frame').length + '/' + document.querySelectorAll('iframe').length);
    log(errs.length === nErr0, `40x open/close: no new errors (${errs.slice(nErr0).join(' | ')}), iframes #t-3d-frame/all=${frames}`);
    // msgs while closed: count posts to the frame
    await p.evaluate(() => { window.__posts = 0; const fr = document.getElementById('t-3d-frame'); const w = fr.contentWindow; const o = w.postMessage.bind(w); try { w.postMessage = (...a) => { window.__posts++; return o(...a); }; } catch (_) {} });
    await p.evaluate(() => window.__tour.viewer.setYaw(10, false)); await p.waitForTimeout(500);
    log(null, 'posts to frame while closed after a turn: ' + (await p.evaluate(() => window.__posts)) + ' (0 expected; patch may not stick cross-doc)');
    // ---- D. keyboard focus
    await p.focus('#t-3d-btn');
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const f1 = await p.evaluate(() => document.activeElement && document.activeElement.id);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    const f2 = await p.evaluate(() => document.activeElement && document.activeElement.id);
    log(f1 === 't-3d-close' && f2 === 't-3d-btn', `keyboard: Enter on button -> focus ${f1}; Esc -> focus back on ${f2}`);
    await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    await p.keyboard.press('Space'); await p.waitForTimeout(200);
    log(await p.evaluate(() => document.getElementById('t-3d').hidden), 'keyboard: Space on the focused close button closes it');
    // Tab trap check
    await p.evaluate(() => document.getElementById('t-3d-btn').click()); await p.waitForTimeout(300);
    const tabs = [];
    for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); tabs.push(await p.evaluate(() => { const a = document.activeElement; return (a && (a.id || a.tagName)) + ''; })); }
    log(null, 'Tab x4 from the close button lands on: ' + tabs.join(' > ') + ' (aria-modal, no trap implemented => focus may leave to tour controls behind the layer)');
    // Esc while focus is inside the dollhouse iframe
    const fr = await (await p.waitForSelector('#t-3d-frame', { state: 'attached' })).contentFrame();
    await fr.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const closedFromIframe = await p.evaluate(() => document.getElementById('t-3d').hidden);
    log(null, 'Esc with focus inside the dollhouse iframe closes the layer: ' + closedFromIframe);
    if (!closedFromIframe) await p.evaluate(() => document.getElementById('t-3d-close').click());
    // layer is on top?
    await p.evaluate(() => document.getElementById('t-3d-btn').click()); await p.waitForTimeout(300);
    const top = await p.evaluate(() => { const pts = [[640, 400], [640, 40], [60, 400], [1240, 760], [1240, 40]]; return pts.map(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id || e.className || e.tagName) : null; }).join(' | '); });
    log(null, 'elementFromPoint with layer open: ' + top);
    await p.screenshot({ path: path.join(OUT, 'gate-open-desktop.png') });
    await p.evaluate(() => document.getElementById('t-3d-close').click());
    log(errs.length === nErr0, 'no page errors across A-D: ' + errs.join(' | '));
    await ctx.close();
    // ---- E. RTL / LTR header per lang
    for (const lang of ['he', 'en', 'fr']) {
      const c2 = await b.newContext({ viewport: { width: 1280, height: 800 } }); const q = await c2.newPage();
      await q.goto(`http://127.0.0.1:8851/index.html?room=living&video=0&lang=${lang}`, { waitUntil: 'load' });
      await q.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 90000 }); await q.waitForTimeout(600);
      await q.evaluate(() => document.getElementById('t-3d-btn').click()); await q.waitForTimeout(500);
      const g = await q.evaluate(() => { const t = document.getElementById('t-3d-title'), c = document.getElementById('t-3d-close'), bt = document.getElementById('t-3d-btn');
        const tr = t.getBoundingClientRect(), cr = c.getBoundingClientRect(); return { dir: document.documentElement.dir, lang: document.documentElement.lang, title: t.textContent, titleX: Math.round(tr.left + tr.width / 2), closeX: Math.round(cr.left + cr.width / 2), W: innerWidth, aria: c.getAttribute('aria-label'), btnTitle: bt.title, closeW: cr.width, closeH: cr.height, titleDir: getComputedStyle(t).direction, titleAlign: getComputedStyle(t).textAlign, titleLeft: Math.round(tr.left), titleRight: Math.round(tr.right) }; });
      const rtl = g.dir === 'rtl';
      // RTL: title at the start (right), close at the end (left) => close.x < title.x ; LTR the reverse
      log((rtl ? g.closeX < g.titleX : g.closeX > g.titleX) && (lang === 'he' ? rtl : !rtl), `lang=${lang}: ${JSON.stringify(g)}`);
      await q.screenshot({ path: path.join(OUT, `gate-lang-${lang}.png`), clip: { x: 0, y: 0, width: 1280, height: 120 } });
      await c2.close();
    }
    // ---- F. phones
    for (const [name, opts] of [['iphone13', devices['iPhone 13']], ['pixel7', devices['Pixel 7']], ['se', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['iphone13-land', { ...devices['iPhone 13 landscape'] }]]) {
      const c3 = await b.newContext(opts); const q = await c3.newPage(); const e3 = []; q.on('pageerror', (e) => e3.push(e.message));
      await q.goto('http://127.0.0.1:8851/index.html?room=living&video=0&lang=he', { waitUntil: 'load' });
      await q.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 90000 }); await q.waitForTimeout(600);
      const btnBox = await q.evaluate(() => { const r = document.getElementById('t-3d-btn').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, W: innerWidth, H: innerHeight }; });
      await q.evaluate(() => document.getElementById('t-3d-btn').click());
      const fr3 = await (await q.waitForSelector('#t-3d-frame', { state: 'attached' })).contentFrame();
      await fr3.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 }); await q.waitForTimeout(800);
      const m = await q.evaluate(() => { const h = document.querySelector('.t-3d-head').getBoundingClientRect(), c = document.getElementById('t-3d-close').getBoundingClientRect(), f = document.getElementById('t-3d-frame').getBoundingClientRect();
        return { sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: innerWidth, headTop: h.top, headL: h.left, headR: h.right, headH: h.height, closeL: c.left, closeR: c.right, closeW: c.width, frameT: f.top, frameB: f.bottom, ih: innerHeight, frameW: f.width }; });
      const fm = await fr3.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      const btnOk = btnBox.l >= 0 && btnBox.r <= btnBox.W && btnBox.t >= 0 && btnBox.b <= btnBox.H && btnBox.w >= 36;
      log(m.sw <= m.iw && m.bw <= m.iw && fm.sw <= fm.iw && m.closeL >= 0 && m.closeR <= m.iw && m.headTop >= 0 && Math.abs(m.frameB - m.ih) < 2 && m.closeW >= 40 && btnOk && e3.length === 0,
        `${name}: ${JSON.stringify(m)} dollhouse scrollW ${fm.sw}/${fm.iw}; 3D button box ${JSON.stringify(btnBox)}; errors ${e3.length}`);
      await q.screenshot({ path: path.join(OUT, `gate-open-${name}.png`) });
      await c3.close();
    }
    // ---- G. floor switch
    for (const fl of ['marble', 'parquet', 'concrete']) {
      const c4 = await b.newContext({ viewport: { width: 1280, height: 800 } }); const q = await c4.newPage();
      await q.goto(`http://127.0.0.1:8851/index.html?room=living&video=0&floor=${fl}`, { waitUntil: 'load' });
      await q.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 90000 }); await q.waitForTimeout(500);
      await q.evaluate(() => document.getElementById('t-3d-btn').click());
      const f4 = await (await q.waitForSelector('#t-3d-frame', { state: 'attached' })).contentFrame();
      await f4.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 }); await q.waitForTimeout(800);
      const d1 = await f4.evaluate(() => window.__dollhouse.floor);
      log(d1 === fl, `?floor=${fl}: dollhouse floor ${d1}`);
      // switch inside the tour while the layer is open -> does the dollhouse follow? (find the tour's floor control)
      const sw = await q.evaluate(() => { const els = [...document.querySelectorAll('[data-floor], .t-floor button, [id*=floor] button, button[data-f]')]; return els.map((e) => (e.id || e.className) + ':' + (e.dataset.floor || e.dataset.f || e.textContent.trim())).slice(0, 8); });
      if (fl === 'marble') log(null, 'tour floor controls found: ' + JSON.stringify(sw));
      await c4.close();
    }
  } catch (e) { out.push('FAIL ERROR ' + e.stack); }
  finally { await b.close(); srv.close(); }
  fs.writeFileSync(path.join(OUT, 'gate-probe1.txt'), out.join('\n') + '\n');
  console.log(out.join('\n'));
  process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})();

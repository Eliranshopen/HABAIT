// Gate 1 independent probe (qa-reviewer). Different method from check-03/04/05:
//  - model fit from the mesh geometry projected through the camera (not canvas alpha) + overlap of the canvas alpha with the
//    preset bar and the caption DOM rects, at 3 presets, 3 devices, and 12 azimuths of the auto-rotation orbit
//  - tap truth from the plan polygons (point-in-polygon), every room, away from the pills; drag is not a tap; Escape; empty tap
//  - label text/bidi/lang=en/overlap; floor finishes; real HTML escaping; sheet per room posts the right scene
//  - ZIP: unzip 846.zip and open 3d/dollhouse.html from file:// counting requests
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const WT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait';
const PLAT = WT + '/platform';
const OUT = 'C:/RnD/.wt/apartment-3d/after/phase1/gate1';
const BASE = 'http://127.0.0.1:8851';
const DH = BASE + '/_local/dist/rainbow/846/media/dollhouse.html';
fs.mkdirSync(OUT, { recursive: true });
const res = { ok: [], fail: [], info: [] };
const check = (cond, msg) => (cond ? res.ok : res.fail).push(msg);
const info = (m) => res.info.push(m);
const plan = JSON.parse(fs.readFileSync(WT + '/tour360/apartments/apt846/plan.general.json', 'utf8'));
const scenesJ = JSON.parse(fs.readFileSync(WT + '/tour360/apartments/apt846/scenes.json', 'utf8')).scenes.map((s) => s.id);
const inPoly = (pt, loop) => { let c = false; for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) { const [xi, yi] = loop[i], [xj, yj] = loop[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };

// in-page: project every mesh's world bbox corners (all meshes except shadow/ground helpers) -> fraction box
const PROJ = () => {
  const v = window.__dollhouseView; const { scene, camera, renderer } = v;
  const THREE_V = camera.position.constructor; const THREE_B = (new (window.__box3 || Object)) ;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const c = new THREE_V();
  scene.updateMatrixWorld(true);
  let root = null; scene.traverse((o) => { if (!root && o.userData && o.userData.habait_kind === 'floor') root = o; });
  while (root && root.parent && root.parent !== scene) root = root.parent;
  (root || scene).traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += step) {
      c.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(camera);
      if (c.z > 1) continue;
      x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y);
    }
  });
  return { x0: (x0 + 1) / 2, x1: (x1 + 1) / 2, y0: (1 - y1) / 2, y1: (1 - y0) / 2 };
};
// in-page: share of opaque canvas pixels that fall under DOM element rects (selector list), and alpha bbox
const OVERLAP = (sels) => {
  const v = window.__dollhouseView; v.renderer.render(v.scene, v.camera);
  const cv = v.renderer.domElement; const k = document.createElement('canvas'); k.width = cv.width; k.height = cv.height;
  const g = k.getContext('2d'); g.drawImage(cv, 0, 0); const d = g.getImageData(0, 0, k.width, k.height).data;
  const cr = cv.getBoundingClientRect(); const sx = k.width / cr.width, sy = k.height / cr.height;
  const out = {};
  for (const s of sels) {
    const e = document.querySelector(s); if (!e) { out[s] = null; continue; }
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') { out[s] = null; continue; }
    const r = e.getBoundingClientRect(); if (!r.width) { out[s] = null; continue; }
    let n = 0, tot = 0;
    const X0 = Math.max(0, Math.floor((r.left - cr.left) * sx)), X1 = Math.min(k.width, Math.ceil((r.right - cr.left) * sx));
    const Y0 = Math.max(0, Math.floor((r.top - cr.top) * sy)), Y1 = Math.min(k.height, Math.ceil((r.bottom - cr.top) * sy));
    for (let y = Y0; y < Y1; y += 2) for (let x = X0; x < X1; x += 2) { tot++; if (d[(y * k.width + x) * 4 + 3] > 128) n++; }
    out[s] = { px: n * 4, frac: tot ? n / tot : 0, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] };
  }
  return out;
};

(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  try {
    for (const [name, opts] of [['iphone13', devices['iPhone 13']], ['pixel7', devices['Pixel 7']], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
      const ctx = await b.newContext(opts);
      await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
      // ---------- A. EMBEDDED in the real page (as a buyer sees it) ----------
      await p.goto(BASE + '/apartment.html?project=rainbow&unit=846&tab=3d', { waitUntil: 'load' });
      const fh = await p.$('#dollFrame'); const fr = await fh.contentFrame();
      await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      await p.waitForTimeout(1200);
      const fbox = await fh.boundingBox();
      info(`${name}: frame ${JSON.stringify(fbox)} viewport ${JSON.stringify(p.viewportSize())}`);
      for (const preset of ['3d', 'top', 'outdoor']) {
        await fr.evaluate((id) => window.__dollhouseView.setPreset(id, { animate: false }), preset);
        await p.waitForTimeout(1500);
        const pr = await fr.evaluate(PROJ);
        check(pr.x0 >= 0 && pr.x1 <= 1 && pr.y0 >= 0 && pr.y1 <= 1, `${name} embedded ${preset}: projected mesh bbox in frame x ${pr.x0.toFixed(2)}..${pr.x1.toFixed(2)} y ${pr.y0.toFixed(2)}..${pr.y1.toFixed(2)}`);
        const ov = await fr.evaluate(OVERLAP, ['.dh-presets', '.cap', '.dh-sheet']);
        for (const k of ['.dh-presets', '.cap']) if (ov[k]) check(ov[k].frac < 0.02, `${name} embedded ${preset}: model under ${k} = ${(ov[k].frac * 100).toFixed(1)}% of its area`);
        info(`${name} embedded ${preset}: overlap ${JSON.stringify(ov)}`);
        await p.screenshot({ path: `${OUT}/${name}_emb_${preset}.png` });
      }
      // overflow of the page and of the doc in the frame
      const sw = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, w: innerWidth, bs: document.body.scrollWidth }));
      check(sw.s === sw.w && sw.bs <= sw.w, `${name}: page no horizontal overflow ${JSON.stringify(sw)}`);
      const fsw = await fr.evaluate(() => ({ s: document.documentElement.scrollWidth, w: innerWidth }));
      check(fsw.s <= fsw.w, `${name}: dollhouse frame no horizontal overflow ${JSON.stringify(fsw)}`);
      // caption pill: collapsed shows short text; tap expands; legal paragraphs present word for word
      const cap0 = await fr.evaluate(() => { const c = document.querySelector('.cap'); const pl = c.querySelector('.pill'); return { open: c.classList.contains('open'), pillVis: getComputedStyle(pl).display !== 'none', pill: pl.textContent, shown: [...c.querySelectorAll(':scope>p:not(.pill),:scope>details')].map((e) => getComputedStyle(e).display) }; });
      check(cap0.pillVis && cap0.shown.every((s) => s === 'none'), `${name}: caption collapsed to a pill (${JSON.stringify(cap0)})`);
      await fr.click('.cap'); await p.waitForTimeout(300);
      const cap1 = await fr.evaluate(() => { const c = document.querySelector('.cap'); return { open: c.classList.contains('open'), p: [...c.querySelectorAll(':scope>p:not(.pill)')].map((e) => [getComputedStyle(e).display, e.textContent]) }; });
      const legal = JSON.parse(fs.readFileSync(PLAT + '/_local/dist/rainbow/846/apartment.json', 'utf8')).legal.short;
      check(cap1.open && cap1.p.some(([d, t]) => d !== 'none' && t === legal.he) && cap1.p.some(([d, t]) => d !== 'none' && t === legal.en), `${name}: tapping the pill shows legal.short he+en verbatim`);
      const ovx = await fr.evaluate(OVERLAP, ['.cap']);
      info(`${name}: opened caption overlap ${JSON.stringify(ovx)}`);
      await p.screenshot({ path: `${OUT}/${name}_emb_cap_open.png` });
      await fr.click('.cap'); await p.waitForTimeout(200);
      // ---------- B. rooms: labels in Top, text, bidi, overlap ----------
      await fr.evaluate(() => window.__dollhouseView.setPreset('top', { animate: false })); await p.waitForTimeout(1200);
      const labs = await fr.evaluate(() => [...document.querySelectorAll('.dh-label')].filter((l) => !l.hidden).map((l) => { const r = l.getBoundingClientRect(); return { t: l.textContent, html: l.innerHTML, dir: getComputedStyle(l).direction, r: [r.left, r.top, r.right, r.bottom], vw: innerWidth, vh: innerHeight }; }));
      const frH = fbox.height, frW = fbox.width;
      check(labs.length === 11, `${name}: Top shows ${labs.length} labels`);
      for (const l of labs) {
        const pr = plan.rooms.find((x) => l.t.includes(x.name_he));
        check(!!pr && /מ״ר|מ"ר/.test(l.t) && l.html.includes('<bdi') && (l.t.includes(String(Math.round(pr.area_m2))) || l.t.includes(pr.area_m2.toFixed(1))), `${name}: label "${l.t}" = name + <bdi>area</bdi> מ״ר (plan ${pr && pr.area_m2})`);
        check(l.r[0] >= -1 && l.r[2] <= l.vw + 1 && l.r[1] >= -1 && l.r[3] <= l.vh + 1, `${name}: label "${l.t}" inside the frame ${l.r.map(Math.round)}`);
      }
      let overl = 0; for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) { const a = labs[i].r, c = labs[j].r; if (a[0] < c[2] && a[2] > c[0] && a[1] < c[3] && a[3] > c[1]) overl++; }
      check(overl === 0, `${name}: ${overl} overlapping label pairs in Top`);
      await p.screenshot({ path: `${OUT}/${name}_emb_top_labels.png` });
      // ---------- C. tap truth: every room, a floor point away from pills, truth = plan polygon ----------
      const shift = await fr.evaluate(() => { const s = window.__dollhouseView; return null; });
      // model->plan mapping: living label centre (model) vs plan loop centroid is NOT used; derive from room centres by LSQ on 11 rooms' loop bbox centres
      const rooms = await fr.evaluate(() => window.__dollhouse.rooms);
      // offset = mean(model_centre - plan_bbox_centre/100); verify residual per-axis small (centroid vs bbox centre differ, so use bbox of nodes instead)
      const nb = await fr.evaluate(() => { const v = window.__dollhouseView; const out = {}; v.scene.traverse((o) => { if (o.userData && o.userData.habait_kind === 'floor' && o.userData.room_id) { let mn = [1e9, 1e9], mx = [-1e9, -1e9]; o.updateWorldMatrix(true, true); o.traverse((m) => { if (m.isMesh) { const g = m.geometry; g.computeBoundingBox(); const bb = g.boundingBox.clone().applyMatrix4(m.matrixWorld); mn = [Math.min(mn[0], bb.min.x), Math.min(mn[1], bb.min.z)]; mx = [Math.max(mx[0], bb.max.x), Math.max(mx[1], bb.max.z)]; } }); out[o.userData.room_id] = { mn, mx }; } }); return out; });
      let dx = [], dz = [];
      for (const r of plan.rooms) { const n = nb[r.id]; if (!n) continue; const bx = r.bbox_cm; dx.push((n.mn[0] + n.mx[0]) / 2 - (bx[0] + bx[2]) / 200); dz.push((n.mn[1] + n.mx[1]) / 2 - (bx[1] + bx[3]) / 200); }
      const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
      const sh = [med(dx), med(dz)];
      info(`${name}: plan->model shift ${sh.map((v) => v.toFixed(3))} spread dx ${Math.max(...dx) - Math.min(...dx)} dz ${Math.max(...dz) - Math.min(...dz)}`);
      await fr.evaluate(() => { window.__dollhouseSelect(null); window.__dollhouseView.setPreset('top', { animate: false }); });
      await p.waitForTimeout(900);
      let tapOK = 0, tapN = 0;
      for (const r of plan.rooms) {
        // candidate points: grid inside polygon, >=25 cm from the edge (poly test with 4 offsets), choose the one with greatest distance from visible pills
        const cands = [];
        const [bx0, by0, bx1, by1] = r.bbox_cm;
        for (let x = bx0; x <= bx1; x += 15) for (let y = by0; y <= by1; y += 15) {
          const ins = [[0, 0], [25, 0], [-25, 0], [0, 25], [0, -25]].every(([a, c]) => inPoly([x + a, y + c], r.loop));
          if (ins) cands.push([x, y]);
        }
        if (!cands.length) { check(false, `${name}: ${r.id} no inner point`); continue; }
        const scr = await fr.evaluate(({ cands, sh }) => { const v = window.__dollhouseView; const V = v.camera.position.constructor; const rect = v.renderer.domElement.getBoundingClientRect(); const labs = [...document.querySelectorAll('.dh-label')].filter((l) => !l.hidden).map((l) => l.getBoundingClientRect()); const bars = [...document.querySelectorAll('.dh-presets,.dh-sheet,.cap')].map((e) => e.getBoundingClientRect()); return cands.map(([x, y]) => { const q = new V(x / 100 + sh[0], 0.02, y / 100 + sh[1]).project(v.camera); const sx = rect.left + (q.x * 0.5 + 0.5) * rect.width, sy = rect.top + (-q.y * 0.5 + 0.5) * rect.height; const bad = labs.concat(bars).some((l) => sx > l.left - 10 && sx < l.right + 10 && sy > l.top - 10 && sy < l.bottom + 10); return { sx, sy, bad, inFrame: sx > 5 && sx < rect.width - 5 && sy > 5 && sy < rect.height - 5 }; }); }, { cands, sh });
        const good = cands.map((c, i) => ({ c, s: scr[i] })).filter((o) => !o.s.bad && o.s.inFrame);
        if (!good.length) { info(`${name}: ${r.id} no pill-free floor point visible`); continue; }
        const o = good[good.length >> 1];
        await p.mouse.click(fbox.x + o.s.sx, fbox.y + o.s.sy); await p.waitForTimeout(500);
        const sel = await fr.evaluate(() => window.__dollhouse.selected);
        tapN++; if (sel === r.id) tapOK++; else check(false, `${name}: floor tap at plan ${o.c} (screen ${Math.round(o.s.sx)},${Math.round(o.s.sy)}) selected ${sel}, expected ${r.id}`);
        await fr.evaluate(() => { window.__dollhouseSelect(null); window.__dollhouseView.setPreset('top', { animate: false }); }); await p.waitForTimeout(250);
      }
      check(tapN >= 8 && tapOK === tapN, `${name}: floor taps correct ${tapOK}/${tapN} (rooms with a pill-free point)`);
      // drag is not a tap
      await fr.evaluate(() => window.__dollhouseSelect(null)); await p.waitForTimeout(300);
      const cx = fbox.x + fbox.width / 2, cy = fbox.y + fbox.height / 2 - 20;
      await p.mouse.move(cx - 40, cy); await p.mouse.down(); await p.mouse.move(cx, cy, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(400);
      check((await fr.evaluate(() => window.__dollhouse.selected)) === null, `${name}: a 40 px drag does not select`);
      // tap empty space deselects (page corner of canvas, top-left minus bar)
      await fr.evaluate(() => window.__dollhouseSelect('r-living')); await p.waitForTimeout(900);
      await p.mouse.click(fbox.x + 6, fbox.y + fbox.height * 0.45); await p.waitForTimeout(500);
      check((await fr.evaluate(() => window.__dollhouse.selected)) === null && (await fr.evaluate(() => document.querySelector('.dh-sheet').hidden)), `${name}: tap on empty space deselects and hides the sheet`);
      await fr.evaluate(() => window.__dollhouseSelect('r-bedroom-2')); await p.waitForTimeout(600);
      await p.keyboard.press('Escape'); await fr.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
      // Escape pressed on the parent doc goes to the parent; the frame needs focus -> click inside frame first is a tap; dispatch to window instead
      await fr.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))); await p.waitForTimeout(300);
      check((await fr.evaluate(() => document.querySelector('.dh-sheet').hidden)), `${name}: Escape hides the sheet`);
      await fr.evaluate(() => window.__dollhouseSelect('r-bath-guest')); await p.waitForTimeout(600);
      await fr.click('.dh-sheet .x'); await p.waitForTimeout(300);
      check((await fr.evaluate(() => document.querySelector('.dh-sheet').hidden)), `${name}: × hides the sheet`);
      // every room's sheet -> the right scene posted
      const sc = [];
      for (const r of rooms) {
        await fr.evaluate(() => { window.__m = []; if (!window.__mh) { window.__mh = 1; const o = window.parent.postMessage.bind(window.parent); } });
        await p.evaluate(() => { window.__pm = []; if (!window.__pmh) { window.__pmh = 1; addEventListener('message', (e) => window.__pm.push(e.data)); } });
        await fr.evaluate((id) => window.__dollhouseSelect(id), r.id); await p.waitForTimeout(250);
        const sheetTxt = await fr.evaluate(() => document.querySelector('.dh-sheet').innerText.replace(/\s+/g, ' '));
        await fr.click('.dh-sheet .go', { force: true }).catch(() => {});
        await p.waitForTimeout(200);
        const msgs = await p.evaluate(() => window.__pm.filter((m) => m && m.type === 'habait:enter-room'));
        // the parent page reacts (tour tab): go back to 3D each time
        const expect = rooms.find((x) => x.id === r.id).scene;
        sc.push(`${r.id}->${msgs.map((m) => m.scene).join(',')}`);
        check(msgs.length >= 1 && msgs[msgs.length - 1].scene === expect && msgs[msgs.length - 1].room_id === r.id && scenesJ.includes(expect), `${name}: ${r.id} sheet "${sheetTxt}" posts scene ${expect}`);
        const bk = await p.$('#backTo3d'); if (bk && await bk.isVisible()) await bk.click(); await p.waitForTimeout(300);
      }
      info(`${name}: ${sc.join(' ')}`);
      // 3D-preset orbit: 12 azimuths. set camera position at azimuth and let the orbit distance converge
      await p.evaluate(() => window.scrollTo(0, 0));
      await fr.evaluate(() => { window.__dollhouseSelect(null); window.__dollhouseView.setPreset('3d', { animate: false }); });
      await p.waitForTimeout(800);
      const ar = await fr.evaluate(() => ({ auto: window.__dollhouse.autoRotate, view: window.__dollhouse.view }));
      info(`${name}: after setPreset(3d) autoRotate=${ar.auto}`);
      // fresh open auto-rotates?  (reload page)
      await p.goto(BASE + '/apartment.html?project=rainbow&unit=846&tab=3d', { waitUntil: 'load' });
      const fh2 = await p.$('#dollFrame'); const fr2 = await fh2.contentFrame();
      await fr2.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
      const az0 = (await fr2.evaluate(() => window.__dollhouse.view)).azimuthDeg; await p.waitForTimeout(2500);
      const st1 = await fr2.evaluate(() => ({ az: window.__dollhouse.view.azimuthDeg, auto: window.__dollhouse.autoRotate, f: window.__dollhouse.frames }));
      check(st1.auto && Math.abs(st1.az - az0) > 0.2, `${name}: fresh open, auto-rotation turns the model (azimuth ${az0} -> ${st1.az} in 2.5 s)`);
      // sample azimuths while auto-rotate on: drive the camera round the target, wait for the orbit convergence, project the mesh bbox
      let worst = { m: 9 };
      const margins = [];
      for (let a = 0; a < 360; a += 30) {
        await fr2.evaluate((a) => { const v = window.__dollhouseView; const t = window.__dollhouse.target; const off = v.camera.position.clone(); off.set(v.camera.position.x - t[0], v.camera.position.y - t[1], v.camera.position.z - t[2]); const r = Math.hypot(off.x, off.z); const rad = a * Math.PI / 180; v.camera.position.set(t[0] + Math.sin(rad) * r, t[1] + off.y, t[2] + Math.cos(rad) * r); v.camera.lookAt(t[0], t[1], t[2]); }, a);
        await p.waitForTimeout(1800);
        const pr = await fr2.evaluate(PROJ); const st = await fr2.evaluate(() => ({ a: window.__dollhouse.view.azimuthDeg, auto: window.__dollhouse.autoRotate }));
        const m = Math.min(pr.x0, 1 - pr.x1, pr.y0, 1 - pr.y1); margins.push(`${st.a}:${m.toFixed(3)}`);
        if (m < worst.m) worst = { m, a: st.a, pr };
        const ov = await fr2.evaluate(OVERLAP, ['.dh-presets', '.cap']);
        for (const k of ['.dh-presets', '.cap']) if (ov[k] && ov[k].frac > 0.02) check(false, `${name}: orbit az ${st.a}: model under ${k} ${(ov[k].frac * 100).toFixed(1)}%`);
        if (a === 90 || a === 210) await p.screenshot({ path: `${OUT}/${name}_orbit_${a}.png` });
      }
      check(worst.m >= 0, `${name}: orbit keeps the projected mesh bbox inside the frame at 12 azimuths; worst margin ${worst.m.toFixed(3)} @${worst.a}  [${margins.join(' ')}]`);
      // idle frames
      await fr2.evaluate(() => window.__dollhouseView.setPreset('top', { animate: false })); await p.waitForTimeout(3000);
      const f0 = await fr2.evaluate(() => window.__dollhouse.frames); await p.waitForTimeout(2500);
      const f1 = await fr2.evaluate(() => window.__dollhouse.frames);
      check(f0 === f1, `${name}: idle -> ${f1 - f0} frames in 2.5 s`);
      // idle also with a selected room + sheet open
      await fr2.evaluate(() => window.__dollhouseSelect('r-living')); await p.waitForTimeout(2500);
      const g0 = await fr2.evaluate(() => window.__dollhouse.frames); await p.waitForTimeout(2500);
      const g1 = await fr2.evaluate(() => window.__dollhouse.frames);
      check(g0 === g1, `${name}: idle with a selection -> ${g1 - g0} frames in 2.5 s`);
      // a resize (rotate the phone) re-renders and keeps labels
      // floor finishes
      const fcs = {};
      for (const f of ['parquet', 'concrete', 'marble']) { await p.evaluate((f) => document.getElementById('dollFrame').contentWindow.postMessage({ type: 'habait:floor', floor: f }, '*'), f); await p.waitForTimeout(500); fcs[f] = await fr2.evaluate(() => JSON.stringify(window.__dollhouse.floorColor)); }
      check(new Set(Object.values(fcs)).size === 3, `${name}: floor finishes change the colour via postMessage ${JSON.stringify(fcs)}`);
      check(errs.length === 0, `${name}: no page errors ${errs.join(' | ')}`);
      await ctx.close();
    }
    // ---------- D. standalone, lang=en labels, #floor= ----------
    {
      const ctx = await b.newContext(devices['iPhone 13']); const p = await ctx.newPage();
      await p.goto(DH + '#lang=en&preset=top&floor=marble', { waitUntil: 'load' });
      await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 }); await p.waitForTimeout(1200);
      const t = await p.evaluate(() => ({ labs: [...document.querySelectorAll('.dh-label')].filter((l) => !l.hidden).map((l) => l.textContent), fl: window.__dollhouse.floor, dir: document.documentElement.dir, lang: document.documentElement.lang }));
      check(t.fl === 'marble', `en: #floor=marble applied (${t.fl})`);
      check(t.labs.length > 0 && t.labs.every((x) => /[A-Za-z]/.test(x) && !/[\u0590-\u05ff]/.test(x.replace(/מ״ר/g, ''))), `en: labels in English ${JSON.stringify(t.labs)} dir=${t.dir} lang=${t.lang}`);
      await p.screenshot({ path: `${OUT}/iphone13_en_top.png` });
      await ctx.close();
    }
    // ---------- E. ZIP offline ----------
    {
      const zdir = 'C:/RnD/development/tasks/apartment-3d/logs/gate1-zip';
      fs.rmSync(zdir, { recursive: true, force: true }); fs.mkdirSync(zdir, { recursive: true });
      execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force '${PLAT}/_local/dist/rainbow/846/846.zip' '${zdir}'`]);
      const files = fs.readdirSync(zdir, { recursive: true });
      info('zip contents: ' + files.slice(0, 40).join(' '));
      const dh = files.find((f) => /3d[\\/]dollhouse\.html$/.test(f));
      check(!!dh, 'zip has 3d/dollhouse.html (' + dh + ')');
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
      const reqs = []; p.on('request', (r) => { if (!r.url().startsWith('data:') && !r.url().startsWith('blob:')) reqs.push(r.url().slice(0, 100)); });
      const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      await p.goto('file:///' + zdir + '/' + dh.replace(/\\/g, '/'), { waitUntil: 'load' });
      await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 }).catch(() => {});
      await p.waitForTimeout(1500);
      const L = await p.evaluate(() => ({ loaded: !!(window.__dollhouse && window.__dollhouse.loaded), tris: window.__dollhouse && window.__dollhouse.triangles, labs: document.querySelectorAll('.dh-label:not([hidden])').length, rooms: window.__dollhouse && window.__dollhouse.rooms.length }));
      const nonFile = reqs.filter((u) => !u.startsWith('file:'));
      check(L.loaded && nonFile.length === 0, `zip file://: loaded ${JSON.stringify(L)}, ${reqs.length} requests, ${nonFile.length} non-file: ${nonFile.join(' ')}`);
      info('zip requests: ' + reqs.join(' | '));
      check(errs.length === 0, 'zip: no page errors ' + errs.join(' | '));
      await p.screenshot({ path: `${OUT}/zip_file_dollhouse.png` });
      await ctx.close();
    }
  } catch (e) {
    res.fail.push('ERROR ' + e.stack);
  } finally {
    await b.close();
    srv.kill();
  }
  const txt = `gate1 probe ${new Date().toISOString()}\nPASS ${res.ok.length} · FAIL ${res.fail.length}\n` + res.fail.map((x) => 'FAIL ' + x).join('\n') + '\n' + res.ok.map((x) => 'ok   ' + x).join('\n') + '\n' + res.info.map((x) => 'info ' + x).join('\n') + '\n';
  fs.writeFileSync(path.join(__dirname, 'gate1-probe.txt'), txt);
  console.log(txt.slice(0, 6000));
  process.exit(res.fail.length ? 1 : 0);
})();

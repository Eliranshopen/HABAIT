// Card 03 acceptance: rooms block, labels, select, tap, the enter-room message. Runs the WORK-TREE platform on :8851.
//   node check-03.cjs [outDir]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const WT = 'C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait';
const PLAT = WT + '/platform';
const OUT = process.argv[2] || 'C:/RnD/development/tasks/dollhouse-in-tour/logs/frames';
const BASE = 'http://127.0.0.1:8851';
const DH = BASE + '/_local/dist/rainbow/846/media/dollhouse.html';
fs.mkdirSync(OUT, { recursive: true });
const res = { ok: [], fail: [] };
const check = (cond, msg) => (cond ? res.ok : res.fail).push(msg);

(async () => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: PLAT, env: { ...process.env, PORT: '8851' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    // 1. the rooms block vs the plan
    const html = fs.readFileSync(PLAT + '/_local/dist/rainbow/846/media/dollhouse.html', 'utf8');
    const rooms = JSON.parse(html.match(/<script type="application\/json" id="rooms">([^<]*)<\/script>/)[1]);
    const plan = JSON.parse(fs.readFileSync(WT + '/tour360/apartments/apt846/plan.general.json', 'utf8'));
    const scenes = new Set(JSON.parse(fs.readFileSync(WT + '/tour360/apartments/apt846/scenes.json', 'utf8')).scenes.map((s) => s.id));
    check(rooms.length === 11, `rooms block has ${rooms.length} entries (want 11)`);
    for (const r of rooms) {
      const p = plan.rooms.find((x) => x.id === r.room_id);
      check(p && Math.abs(p.area_m2 - r.area_m2) <= 0.01 && p.name_he === r.he, `room ${r.room_id}: he/area match the plan`);
      check(r.scene && scenes.has(r.scene), `room ${r.room_id}: scene ${r.scene} exists`);
    }
    // 2. standalone, Top preset, 3 viewports: every label visible
    for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone13', devices['iPhone 13']], ['pixel7', devices['Pixel 7']]]) {
      const ctx = await b.newContext(opts);
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(DH + '#preset=top', { waitUntil: 'load' });
      await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 60000 });
      await p.waitForTimeout(1500);
      const st = await p.evaluate(() => ({ n: window.__dollhouse.rooms.length, vis: window.__dollhouse.labelsVisible }));
      await p.screenshot({ path: `${OUT}/${name}_top_labels.png` });
      check(st.n === 11, `${name}: viewer knows ${st.n} rooms`);
      check(name !== 'desktop' || st.vis === 11, `${name}: ${st.vis}/11 labels visible in Top (desktop must show all 11)`);
      check(st.vis >= 7, `${name}: ${st.vis} labels visible in Top (>= 7)`);
      await p.evaluate(() => window.__dollhouseView.setPreset('3d', { animate: false }));
      await p.waitForTimeout(800);
      await p.screenshot({ path: `${OUT}/${name}_3d_labels.png` });
      check(errs.length === 0, `${name}: no page errors ${errs.join(' | ')}`);
      await ctx.close();
    }
    // 3. embedded in a parent page: select, the sheet, the enter-room message, a tap on the floor
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    const p = await ctx.newPage();
    await p.goto(BASE + '/apartment.html', { waitUntil: 'commit' }); // any same-origin page; replaced below
    await p.setContent(`<script>window.__msgs=[];addEventListener('message',e=>{if(e.data&&e.data.type)window.__msgs.push(e.data)})</script><iframe id="f" src="${DH}#lang=he&floor=parquet" style="border:0;width:360px;height:520px"></iframe>`);
    const fr = await (await p.$('#f')).contentFrame();
    await fr.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await fr.evaluate(() => window.__dollhouseSelect('r-living'));
    await p.waitForTimeout(1200);
    const sel = await fr.evaluate(() => ({ s: window.__dollhouse.selected, t: window.__dollhouse.target, c: window.__dollhouse.rooms.find((r) => r.id === 'r-living').centre, sheet: !document.querySelector('.dh-sheet').hidden, go: !document.querySelector('.dh-sheet .go').hidden }));
    check(sel.s === 'r-living', `select: selected = ${sel.s}`);
    check(Math.hypot(sel.t[0] - sel.c[0], sel.t[2] - sel.c[2]) < 0.3, `select: camera target within 0.3 m of the living centroid (${sel.t} vs ${sel.c})`);
    check(sel.sheet && sel.go, 'select: sheet visible with the 360 button');
    await p.screenshot({ path: `${OUT}/iphone13_embedded_selected.png` });
    await fr.click('.dh-sheet .go');
    await p.waitForTimeout(300);
    const msgs = await p.evaluate(() => window.__msgs);
    check(msgs.some((m) => m.type === 'habait:enter-room' && m.scene === 'living' && m.room_id === 'r-living'), `enter-room posted: ${JSON.stringify(msgs.filter((m) => m.type === 'habait:enter-room'))}`);
    // tap on the kitchen floor at its projected centre
    await fr.evaluate(() => window.__dollhouseSelect(null));
    await fr.evaluate(() => window.__dollhouseView.setPreset('top', { animate: false }));
    await p.waitForTimeout(600);
    const pt = await fr.evaluate(() => {
      const v = window.__dollhouseView; const c = window.__dollhouse.rooms.find((r) => r.id === 'r-kitchen').centre;
      const V = v.camera.position.constructor; const q = new V(c[0], c[1], c[2] + 0.6).project(v.camera);
      const el = v.renderer.domElement.getBoundingClientRect();
      return { x: el.left + (q.x * 0.5 + 0.5) * el.width, y: el.top + (-q.y * 0.5 + 0.5) * el.height };
    });
    const box = await (await p.$('#f')).boundingBox();
    await p.mouse.click(box.x + pt.x, box.y + pt.y);
    await p.waitForTimeout(900);
    const tapped = await fr.evaluate(() => window.__dollhouse.selected);
    check(tapped === 'r-kitchen', `tap on the kitchen floor selects ${tapped}`);
    await p.screenshot({ path: `${OUT}/iphone13_embedded_tap_kitchen.png` });
    await ctx.close();
  } catch (e) {
    res.fail.push('ERROR ' + e.message);
  } finally {
    await b.close();
    srv.kill();
  }
  const txt = `card 03 check ${new Date().toISOString()}\nPASS ${res.ok.length} · FAIL ${res.fail.length}\n` + res.fail.map((x) => 'FAIL ' + x).join('\n') + '\n' + res.ok.map((x) => 'ok   ' + x).join('\n') + '\n';
  fs.writeFileSync(path.join(__dirname, 'check-03.txt'), txt);
  console.log(txt);
  process.exit(res.fail.length ? 1 : 0);
})();

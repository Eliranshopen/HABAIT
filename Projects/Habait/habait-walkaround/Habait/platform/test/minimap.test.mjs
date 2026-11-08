// Card 10 (B4b) test: the minimap over the 360 tour + the 3D tab (presets, lazy init, floor sync).
//   node tools/build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846 [--tour-apartment <apt846 dir>]   (first)
//   HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps node test/minimap.test.mjs [shotsDir]
// Part 1 (node): the coordinate frames, checked against independent sources: cameras.json px vs plan.general.json cm,
//   the GLB's floor_<room> bounds vs the traced room loops, the top.png camera vs the alpha bbox of top.png, every camera
//   inside its room. Part 2 (Playwright, iPhone 13 + Pixel 7): the tour iframe is a MOCK that posts the contract
//   { type:'habait:view', scene, yaw, fov, floor } (the real tour does not emit it yet: habait-98); the dot's rendered
//   position is read back from the screen and compared with cameras.json (<= 20 cm). The 3D tab under Fast 4G (card 09's
//   profile) with and without 4x CPU throttle: idle preload -> tap -> first frame; and the cold deep link.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { join, dirname, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { start } from '../serve.mjs';
import * as mm from '../js/minimap.js';
import { computePresets } from '../js/apartment-3d.js';

const PLATFORM = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(PLATFORM, '_local/dist/rainbow/846');
const TOUR = process.env.HABAIT_TOUR_APT || resolve(PLATFORM, '../tour360/apartments/apt846');
const DOLL = resolve(PLATFORM, '../engine/_local/apt846/dollhouse');
const shots = process.argv[2] || join(tmpdir(), 'habait-minimap-shots');
mkdirSync(shots, { recursive: true });
const MUST = ['living', 'kitchen', 'bedroomMain']; // the card's three scenes; all 11 are checked
const TOL_CM = 20;
const FAST_4G = { offline: false, downloadThroughput: (9e6 / 8) * 0.9, uploadThroughput: (1.5e6 / 8) * 0.9, latency: 60 * 2.75 };

let failures = 0;
const step = async (name, fn) => {
  try { const r = await fn(); console.log('ok   ' + name + (r ? `  (${r})` : '')); return r ?? true; }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n').slice(0, 4).join('\n     ')); return null; }
};
const req = createRequire(import.meta.url);
function loadMod(name) {
  const app = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
  for (const c of [name === 'playwright-core' && process.env.PLAYWRIGHT_CORE, join(app, 'node_modules', name), name].filter(Boolean)) { try { return req(c); } catch { /* next */ } }
  throw new Error(`${name} not found; set HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`);
}
const readJ = async (p) => JSON.parse(await readFile(p, 'utf8'));

const manifest = await readJ(join(OUT, 'apartment.json'));
const cameras = await readJ(join(TOUR, 'cameras.json'));
const scenes = await readJ(join(TOUR, 'scenes.json'));
const plan = await readJ(join(TOUR, 'plan.general.json'));
const M = manifest.minimap;
const interior = scenes.scenes.filter((s) => !s.exterior).map((s) => s.id);

// ---------- 1. frames (node) ----------
const inPoly = ([x, y], poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i]; const [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

await step('manifest: minimap block with a point per interior scene', async () => {
  assert.ok(M, 'manifest.minimap missing: run tools/build_zip.mjs first');
  for (const id of interior) assert.ok(M.points[id], `no point for ${id}`);
  return `${Object.keys(M.points).length} scenes, ${M.w}x${M.h} px, top from: ${M.source.top}`;
});

await step('frame: cameras.json px / pxPerCm = plan.general.json camera_points (cm)', async () => {
  let worst = 0;
  for (const id of interior) {
    const cp = plan.camera_points.find((c) => c.note === `from cameras.json ${id}`) || plan.camera_points.find((c) => c.id === `cp-${id}`);
    assert.ok(cp, `no camera_point for ${id}`);
    const [x, y] = mm.cameraCm(cameras, id);
    worst = Math.max(worst, Math.hypot(x - cp.x, y - cp.y));
    // and the camera stands inside its room's traced loop
    const room = plan.rooms.find((r) => r.id === cp.room_id);
    assert.ok(room && inPoly([x, y], room.loop), `${id} is not inside ${cp.room_id}`);
  }
  assert.ok(worst < 0.5, `worst ${worst.toFixed(2)} cm`);
  return `${interior.length} cameras, worst ${worst.toFixed(3)} cm, each inside its room loop`;
});

const glbPath = manifest.glb.source;
const glbBytes = await readFile(glbPath);
const gj = mm.glbJson(glbBytes);
await step('frame: GLB floor_<room> bounds x100 = plan.general.json room loops (cm)', async () => {
  let worst = 0; let n = 0;
  for (const node of gj.nodes.filter((x) => x.extras?.habait_kind === 'floor')) {
    const room = plan.rooms.find((r) => r.id === node.extras.room_id);
    assert.ok(room, `no room ${node.extras.room_id}`);
    const b = mm.glbBounds({ ...gj, nodes: [node] });
    const xs = room.loop.map((p) => p[0]); const ys = room.loop.map((p) => p[1]);
    const d = Math.max(Math.abs(b.min[0] * 100 - Math.min(...xs)), Math.abs(b.max[0] * 100 - Math.max(...xs)), Math.abs(b.min[2] * 100 - Math.min(...ys)), Math.abs(b.max[2] * 100 - Math.max(...ys)));
    worst = Math.max(worst, d); n++;
  }
  assert.ok(n >= 11 && worst < 2, `${n} floors, worst ${worst.toFixed(2)} cm`);
  return `${n} floors, worst ${worst.toFixed(2)} cm`;
});

const sharp = loadMod('sharp');
const { data: topPx, info: topInfo } = await sharp(join(DOLL, 'top.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const alphaAt = (u, v) => topPx[(Math.round(v) * topInfo.width + Math.round(u)) * topInfo.channels + 3];
await step('frame: top.png camera (GLB bounds, exporter formula) = top.png alpha bbox', async () => {
  let u0 = 1e9; let v0 = 1e9; let u1 = -1; let v1 = -1;
  for (let v = 0; v < topInfo.height; v++) for (let u = 0; u < topInfo.width; u++) if (alphaAt(u, v) > 8) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const map = mm.topMapFromBounds(mm.glbBounds(gj), { W: topInfo.width, H: topInfo.height });
  const b = mm.glbBounds(gj);
  const [a, c] = mm.planCmToTopPx(b.min[0] * 100, b.min[2] * 100, map);
  const [e, f] = mm.planCmToTopPx(b.max[0] * 100, b.max[2] * 100, map);
  const d = Math.max(Math.abs(a - u0), Math.abs(e - (u1 + 1)), Math.abs(c - v0), Math.abs(f - (v1 + 1)));
  assert.ok(d <= 2, `${d.toFixed(2)} px`);
  for (const k of ['cx', 'cy', 's']) assert.ok(Math.abs(map[k] - M.top[k]) < 1e-6, `manifest top.${k}`);
  return `${d.toFixed(2)} px off (1 px = ${(100 * map.s / topInfo.width).toFixed(2)} cm)`;
});

await step('frame: every camera dot falls on modelled floor in top.png (alpha > 0)', async () => {
  const miss = interior.filter((id) => { const [x, y] = mm.cameraCm(cameras, id); const [u, v] = mm.planCmToTopPx(x, y, M.top); return !(alphaAt(u, v) > 8); });
  assert.deepEqual(miss, []);
  return `${interior.length}/${interior.length}`;
});

await step('presets: Top looks straight down plan-up, Outdoor from the terrace side, low', async () => {
  const p = computePresets({ size: [13.7, 2.2, 15.7], outdoor: [4, 1], fovDeg: 40, aspect: 0.46 });
  const top = p.top; const o = p.outdoor;
  const pol = (q) => Math.acos((q.position[1] - q.target[1]) / Math.hypot(q.position[0] - q.target[0], q.position[1] - q.target[1], q.position[2] - q.target[2])) * 180 / Math.PI;
  assert.ok(pol(top) < 0.5 && top.position[2] > 0, 'top: down, a hair of +z so -z (plan up) is screen up');
  assert.ok(Math.abs(pol(o) - 68) < 0.5, `outdoor polar ${pol(o)}`);
  assert.ok(o.position[0] > 0 && o.position[0] / o.position[2] > 3, 'outdoor on the terrace side');
  return `top polar ${pol(top).toFixed(2)} deg, outdoor polar ${pol(o).toFixed(1)} deg`;
});

// ---------- 2. the page (Playwright) ----------
const { chromium, devices } = loadMod('playwright-core');
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const server = await start(0, '127.0.0.1');
const base = `http://127.0.0.1:${server.address().port}`;
// a minimal static host with gzip (only to time the cold path the way a production host serves it)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };
const gzCache = new Map();
const gzServer = createServer(async (rq, rs) => {
  try {
    const p = decodeURIComponent(new URL(rq.url, 'http://h').pathname);
    const file = resolve(PLATFORM, '.' + p);
    if (!file.startsWith(PLATFORM)) { rs.writeHead(403).end(); return; }
    const type = TYPES[extname(file)] || 'application/octet-stream';
    let body = await readFile(file);
    const zip = /gzip/.test(rq.headers['accept-encoding'] || '') && /text|json|svg/.test(type);
    if (zip) { if (!gzCache.has(file)) gzCache.set(file, gzipSync(body, { level: 6 })); body = gzCache.get(file); }
    rs.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...(zip ? { 'Content-Encoding': 'gzip' } : {}) });
    rs.end(body);
  } catch { rs.writeHead(404).end(); }
});
await new Promise((ok) => gzServer.listen(0, '127.0.0.1', ok));
const gzBase = `http://127.0.0.1:${gzServer.address().port}`;
const strip = ({ defaultBrowserType, ...d }) => d;
const LOCAL = new Set(['127.0.0.1', 'localhost']);
const foreign = (urls) => urls.filter((u) => { if (/^(data|blob|about):/.test(u)) return false; try { return !LOCAL.has(new URL(u).hostname); } catch { return true; } });
// the mock tour: posts the habait:view contract when the test asks, records what the page sends back
const MOCK_TOUR = `<!doctype html><title>tour mock</title><body style="margin:0;background:#1d2633;color:#9ab;font:14px sans-serif">tour mock
<script>window.got=[];addEventListener('message',e=>{if(e.source===parent)got.push(e.data)});
window.send=(m)=>parent.postMessage(Object.assign({type:'habait:view'},m),'*');
send({scene:'living',yaw:0,fov:100,floor:'parquet'});</script></body>`;

async function newContext(dev) {
  const ctx = await browser.newContext({ ...dev, locale: 'he-IL' });
  ctx.requests = [];
  ctx.on('request', (r) => ctx.requests.push(r.url()));
  await ctx.route('http://127.0.0.1:8848/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: MOCK_TOUR }));
  return ctx;
}
async function newPage(ctx) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  return page;
}
async function throttle(page, cpu) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', FAST_4G);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  return cdp;
}
const dollFrame = async (page) => (await page.waitForSelector('#dollFrame', { state: 'attached' })).contentFrame();
const firstFrame = (frame, timeout = 60000) => frame.waitForFunction(() => window.__dollhouse && ((window.__dollhouse.loaded && window.__dollhouse.frames > 0) || window.__dollhouse.error), null, { timeout, polling: 16 });

const results = { positioned: {}, timings: {} };
for (const [vp, dev] of [['iphone', strip(devices['iPhone 13'])], ['pixel', strip(devices['Pixel 7'])]]) {
  const ctx = await newContext(dev);
  const page = await newPage(ctx);
  await page.goto(`${base}/apartment.html?project=rainbow&unit=846`, { waitUntil: 'load' });
  const tour = await (await page.waitForSelector('#tourFrame')).contentFrame();
  await page.waitForFunction(() => window.__apt?.map?.state?.scene === 'living', null, { timeout: 20000 });

  await step(`${vp}: the minimap mounts in the tour corner with the top view, the first view message lands`, async () => {
    const r = await page.evaluate(() => { const b = document.querySelector('.apt-minimap').getBoundingClientRect(); const f = document.querySelector('.apt-frame-tour').getBoundingClientRect(); return { b: [b.left, b.top, b.width, b.height], f: [f.left, f.top, f.width, f.height] }; });
    assert.ok(r.b[2] >= 100 && r.b[2] <= 180, `width ${r.b[2]}`);
    assert.ok(r.b[0] - r.f[0] < 20 && r.b[1] - r.f[1] < 20, 'top-left corner of the tour (RTL inline-end)');
    const img = await page.evaluate(() => fetch(document.querySelector('.apt-minimap image').getAttribute('href')).then((x) => x.status));
    assert.equal(img, 200);
    return `${Math.round(r.b[2])} px wide`;
  });

  // every interior scene: post the view, read the dot back from the screen, compare with cameras.json
  const errs = {};
  for (const id of interior) {
    await tour.evaluate((s) => window.send({ scene: s, yaw: 0, fov: 100 }), id);
    await page.waitForFunction((s) => window.__apt.map.state.scene === s, id);
    const p = await page.evaluate(() => {
      const svg = document.querySelector('.apt-minimap-svg');
      const r = document.querySelector('.apt-minimap .mm-dot').getBoundingClientRect();
      const pt = new DOMPoint(r.left + r.width / 2, r.top + r.height / 2).matrixTransform(svg.getScreenCTM().inverse());
      return [pt.x, pt.y];
    });
    const [x, y] = mm.imgToCm(p[0], p[1], M.affine);
    const [ex, ey] = mm.cameraCm(cameras, id);
    errs[id] = Math.hypot(x - ex, y - ey);
  }
  const okMust = MUST.filter((id) => errs[id] <= TOL_CM).length;
  const okAll = interior.filter((id) => errs[id] <= TOL_CM).length;
  results.positioned[vp] = { okMust, okAll, worst: Math.max(...Object.values(errs)) };
  await step(`${vp}: minimap dot vs cameras.json (screen read-back), living / kitchen / bedroomMain`, async () => {
    assert.equal(okMust, 3, JSON.stringify(errs));
    assert.equal(okAll, interior.length, JSON.stringify(errs));
    return MUST.map((id) => `${id} ${errs[id].toFixed(1)} cm`).join(', ') + `; all ${okAll}/${interior.length}, worst ${results.positioned[vp].worst.toFixed(1)} cm`;
  });

  await step(`${vp}: yaw and fov turn the cone (bearing = centreBearingDeg + yaw)`, async () => {
    await tour.evaluate(() => window.send({ scene: 'living', yaw: 90, fov: 60 }));
    await page.waitForFunction(() => window.__apt.map.state.scene === 'living' && window.__apt.map.state.yaw === 90);
    const tr = await page.evaluate(() => document.querySelector('.apt-minimap .mm-me').getAttribute('transform'));
    const rot = +/rotate\(([-\d.]+)\)/.exec(tr)[1];
    const want = (scenes.scenes.find((s) => s.id === 'living').centreBearingDeg + 90) % 360;
    assert.ok(Math.abs(rot - want) < 0.05, `${rot} vs ${want}`);
    await tour.evaluate(() => window.send({ scene: 'living', yaw: -400, fov: 100 }));
    await page.waitForFunction(() => window.__apt.map.state.yaw === -400);
    const rot2 = +/rotate\(([-\d.]+)\)/.exec(await page.evaluate(() => document.querySelector('.apt-minimap .mm-me').getAttribute('transform')))[1];
    assert.ok(Math.abs(rot2 - (((want - 90 - 400) % 360) + 360) % 360) < 0.05, `wraps: ${rot2}`);
    return `living yaw 90 -> ${rot.toFixed(1)} deg on the plan`;
  });

  await step(`${vp}: tapping a room on the minimap asks the tour to go there (habait:goto)`, async () => {
    await page.locator('.apt-minimap .mm-node[data-scene="kitchen"]').dispatchEvent('click');
    await tour.waitForFunction(() => window.got.some((m) => m && m.type === 'habait:goto' && m.scene === 'kitchen'));
    const got = await tour.evaluate(() => window.got.map((m) => m.type));
    assert.ok(got.includes('habait:view-request'), 'view-request sent on mount');
  });

  await page.screenshot({ path: join(shots, `${vp}-tour-minimap.png`) });
  await page.locator('.apt-minimap').screenshot({ path: join(shots, `${vp}-minimap.png`) });

  // the 3D tab: idle preload while in the tour, then the tap; floor follows the tour
  await tour.evaluate(() => window.send({ scene: 'living', yaw: 0, fov: 100, floor: 'marble' }));
  const frame = await dollFrame(page);
  await frame.waitForFunction(() => window.__dollhouse && (window.__dollhouse.prepared || window.__dollhouse.error), null, { timeout: 60000 });
  const pre = await frame.evaluate(() => ({ ...window.__dollhouse }));
  await step(`${vp}: 3D tab preloaded at idle while hidden (GLB + Draco decoded, no WebGL yet)`, async () => {
    assert.ok(pre.prepared && !pre.loaded, JSON.stringify(pre));
    assert.ok(await page.isHidden('#panel-3d'));
    return `prepare ${pre.prepare_ms} ms`;
  });
  const cdp = await throttle(page, 1);
  let t = Date.now();
  await page.click('#tab-3d');
  await firstFrame(frame);
  const warm = Date.now() - t;
  results.timings[`${vp} warm fast-4g`] = warm;
  const st = await frame.evaluate(() => ({ loaded: window.__dollhouse.loaded, error: window.__dollhouse.error, preset: window.__dollhouse.preset, floor: window.__dollhouse.floor, color: window.__dollhouse.floorColor, view: window.__dollhouse.view, tri: window.__dollhouse.triangles }));
  await step(`${vp}: 3D tab opens < 2000 ms after the tap (Fast 4G, preloaded)`, async () => {
    assert.ok(st.loaded, st.error);
    assert.ok(warm < 2000, `${warm} ms`);
    return `${warm} ms, ${st.tri} triangles`;
  });
  await step(`${vp}: the 3D floor follows the tour's floor switch (marble, then concrete live)`, async () => {
    const F = manifest.glb.floors;
    assert.equal(st.floor, 'marble');
    assert.ok(st.color.every((v, i) => Math.abs(v - F.marble.color[i]) < 1e-3), `marble colour ${st.color}`);
    await page.click('#tab-tour');
    await tour.evaluate(() => window.send({ scene: 'kitchen', yaw: 0, fov: 100, floor: 'concrete' }));
    await page.click('#tab-3d');
    await frame.waitForFunction(() => window.__dollhouse.floor === 'concrete');
    const c = await frame.evaluate(() => window.__dollhouse.floorColor);
    assert.ok(c.every((v, i) => Math.abs(v - F.concrete.color[i]) < 1e-3), `concrete colour ${c}`);
    return `${Object.keys(F).join('/')} from ${Object.keys(F).length} GLBs (one BIN chunk)`;
  });
  await step(`${vp}: presets 3D / Top / Outdoor (RTL bar, animated)`, async () => {
    const bar = await frame.evaluate(() => { const b = document.querySelector('.dh-presets'); return { dir: b.dir, labels: [...b.querySelectorAll('button')].map((x) => x.textContent) }; });
    assert.equal(bar.dir, 'rtl');
    assert.deepEqual(bar.labels, ['תלת-ממד', 'מלמעלה', 'מבחוץ']);
    const out = {};
    for (const id of ['top', 'outdoor', '3d']) {
      await frame.click(`.dh-presets button[data-preset="${id}"]`);
      await frame.waitForFunction((p) => window.__dollhouse.preset === p && !window.__dollhouse.animating, id, { timeout: 10000 });
      await page.waitForTimeout(150);
      out[id] = await frame.evaluate(() => window.__dollhouse.view);
      assert.equal(await frame.getAttribute(`.dh-presets button[data-preset="${id}"]`, 'aria-pressed'), 'true');
      await page.locator('#panel-3d .apt-frame-3d').screenshot({ path: join(shots, `${vp}-3d-${id}.png`) });
    }
    assert.ok(out.top.polarDeg < 1, `top polar ${out.top.polarDeg}`);
    assert.ok(Math.abs(out.outdoor.polarDeg - 68) < 2, `outdoor polar ${out.outdoor.polarDeg}`);
    assert.ok(out['3d'].polarDeg > 30 && out['3d'].polarDeg < 60, `3d polar ${out['3d'].polarDeg}`);
    return `polar: 3d ${out['3d'].polarDeg}, top ${out.top.polarDeg}, outdoor ${out.outdoor.polarDeg} deg`;
  });
  await cdp.detach();
  await step(`${vp}: no requests outside 127.0.0.1, no page errors`, async () => {
    const f = foreign(ctx.requests);
    assert.deepEqual(f, []);
    assert.deepEqual(page.errors, []);
    return `${ctx.requests.length} requests, all local`;
  });
  await ctx.close();

  // the same tap with 4x CPU throttle (card 09 measured 3.7 s for model-viewer there), and the cold deep link (#3d)
  for (const cpu of [4]) {
    const c2 = await newContext(dev);
    const p2 = await newPage(c2);
    await throttle(p2, cpu);
    await p2.goto(`${base}/apartment.html?project=rainbow&unit=846`, { waitUntil: 'load' });
    const f2 = await dollFrame(p2);
    await f2.waitForFunction(() => window.__dollhouse && (window.__dollhouse.prepared || window.__dollhouse.error), null, { timeout: 90000 });
    t = Date.now();
    await p2.click('#tab-3d');
    await firstFrame(f2, 90000);
    results.timings[`${vp} warm fast-4g cpu${cpu}`] = Date.now() - t;
    await c2.close();
  }
  // cold: serve.mjs (no compression) and a gzip host (what any static host / CDN does; serve.mjs is not this card's file)
  for (const [host, root] of [['serve.mjs', base], ['gzip', gzBase]]) {
    for (const cpu of [1, 4]) {
      const c3 = await newContext(dev);
      const p3 = await newPage(c3);
      await throttle(p3, cpu);
      t = Date.now();
      await p3.goto(`${root}/apartment.html?project=rainbow&unit=846#3d`, { waitUntil: 'commit' });
      const f3 = await dollFrame(p3);
      await firstFrame(f3, 90000);
      results.timings[`${vp} cold #3d fast-4g cpu${cpu} ${host}`] = Date.now() - t;
      await c3.close();
    }
  }
}

await step('3D tab timings (ms; warm = tap after the idle preload, cold = page opened on #3d)', async () => Object.entries(results.timings).map(([k, v]) => `${k} ${v}`).join('; '));
const allPos = Object.values(results.positioned);
const minMust = Math.min(...allPos.map((r) => r.okMust));
console.log(`minimap: ${minMust}/3 scenes positioned within ${TOL_CM}cm (all ${interior.length} scenes on ${allPos.length} phones; worst ${Math.max(...allPos.map((r) => r.worst)).toFixed(1)} cm)`);
const warmMax = Math.max(...Object.entries(results.timings).filter(([k]) => /warm fast-4g$/.test(k)).map(([, v]) => v));
const cold = (re) => Object.entries(results.timings).filter(([k]) => re.test(k)).map(([, v]) => v).join('/');
console.log(`3d tab (three.js + Draco, not model-viewer) loaded in ${warmMax}ms (4G) after the tap; cold #3d deep link ${cold(/cold.*cpu1 serve\.mjs$/)}ms on serve.mjs (no gzip), ${cold(/cold.*cpu1 gzip$/)}ms gzip-served`);
console.log(failures ? `\n${failures} failing; screenshots in ${shots}` : `\nall green; screenshots in ${shots}`);
await browser.close();
server.close();
gzServer.close();
process.exit(failures ? 1 : 0);

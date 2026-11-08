#!/usr/bin/env node
// Card 13 (B5) test: the 360 -> 360 move inside apartment 846 (living -> kitchen, living -> terraceLiving).
//   HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps timeout 300 node test/transition.test.mjs [--prep]
// 0. prep (always; --prep = only this): 846's Blender depth (360walkaround/tours/apt846-furnished/renders/cp-<id>/depth.png,
//    rgb24-be cm, radial) -> a 128 x 64 block-median depth PNG in the same encoding, for the 11 rooms; the three demo
//    panoramas (tour360 balanced webp) copied beside them; the manifest _local/transition/apt846.json. Read-only sources.
// 1. node: the frames (cameras.json px / 2.25 == the render's plan_cm, centreBearingDeg == the render's yaw), the depth
//    decode, the mesh (every vertex on its own ray at its depth), the yaw maths, the fallback threshold.
// 2. Playwright, headless Chromium on SwiftShader (software GL): desktop 1280 x 720, iPhone 13, Pixel 7. Per transition:
//    the real timed move, 3 runs, median (fps = rAF timestamps of the move's own frames), the yaw drift read back from the rendered camera
//    every frame, the arrival yaw in the tour's frame, the continuity of both ends (steady frame vs the move's first /
//    last frame, mean abs pixel difference), 3 shots (t = 0, 0.5, 1). The fallback: a synthetic main-thread load (busy
//    wait per rAF) before the move -> 'fade'; the same load switched on at the move's first frame -> 'mesh->fade'.
// 3. The plugin on the real tour engine (Habait/tour360/engine, bundled read-only with its own esbuild into
//    _local/transition/engine/): walkTo(door) and a tap on a door marker both run the move; the engine lands on B with the
//    bearing held; the overlay's arrival frame vs the engine's own frame of B (the hand-off, pixel difference).
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../serve.mjs';
import * as dm from '../js/depthmesh.js';
import * as tx from '../js/transition360.js';

const PLATFORM = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WALK = resolve(PLATFORM, '../..');
const TOUR = join(WALK, 'Habait/tour360/apartments/apt846');
const ENGINE = join(WALK, 'Habait/tour360/engine');
const RENDERS = join(WALK, '360walkaround/tours/apt846-furnished/renders');
const OUT = join(PLATFORM, '_local/transition');
const SHOTS = join(PLATFORM, 'test/shots');
const DEMO = ['living', 'kitchen', 'terraceLiving'];
const MOVES = [['living', 'kitchen'], ['living', 'terraceLiving']];
const FPS_DESKTOP_MIN = 24; // the card's bar; measured on SwiftShader (software GL), see the summary line
const DRIFT_MAX = 1;        // degrees
const CONT_MAX = 1;         // mean abs difference (0..255) allowed between a steady frame and the move's end frame
const HANDOFF_MAX = 3;      // overlay arrival frame vs the engine's own frame (two different renderers / filters)
const DEPTH_W = 128, DEPTH_H = 64;
const REPS = 3;             // timed runs per move; fps = the median run

const req = createRequire(import.meta.url);
function loadMod(name) {
  const app = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
  for (const c of [name === 'playwright-core' && process.env.PLAYWRIGHT_CORE, join(app, 'node_modules', name), name].filter(Boolean)) { try { return req(c); } catch { /* next */ } }
  throw new Error(`${name} not found; set HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`);
}
const sharp = loadMod('sharp');
const readJ = async (p) => JSON.parse(await readFile(p, 'utf8'));
let failures = 0;
const step = async (name, fn) => {
  try { const r = await fn(); console.log('ok   ' + name + (r ? `  (${r})` : '')); return r ?? true; }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n').slice(0, 6).join('\n     ')); return null; }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

// ---------- 0. prep ----------
const cameras = await readJ(join(TOUR, 'cameras.json'));
const scenesJ = await readJ(join(TOUR, 'scenes.json'));
const k = cameras.plan.pxPerCm || 2.25;
const camById = Object.fromEntries(cameras.scenes.map((c) => [c.id, c]));
const scById = Object.fromEntries(scenesJ.scenes.filter((s) => !s.exterior).map((s) => [s.id, s]));
const interior = Object.keys(camById).filter((id) => scById[id]);

async function prep() {
  mkdirSync(OUT, { recursive: true });
  for (const id of interior) {
    const src = join(RENDERS, 'cp-' + id, 'depth.png');
    const dst = join(OUT, id + '.depth.png');
    if (existsSync(dst) && statSync(dst).mtimeMs > statSync(src).mtimeMs) continue;
    const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
    const depth = dm.decodeDepthRGB(data, info.width, info.height, info.channels);
    const small = dm.downsampleDepth(depth, info.width, info.height, DEPTH_W, DEPTH_H);
    await sharp(Buffer.from(dm.encodeDepthRGB(small)), { raw: { width: DEPTH_W, height: DEPTH_H, channels: 3 } }).png({ compressionLevel: 9 }).toFile(dst);
  }
  const scenes = {};
  for (const id of DEMO) {
    const c = camById[id], s = scById[id];
    const pano = c.asset + '.webp';
    const psrc = join(TOUR, 'panos/balanced', pano), pdst = join(OUT, pano);
    if (!existsSync(pdst) || statSync(pdst).size !== statSync(psrc).size) await copyFile(psrc, pdst);
    scenes[id] = {
      pano, depth: id + '.depth.png',
      pos_cm: [+(c.at[0] / k).toFixed(2), +(c.at[1] / k).toFixed(2)],
      bearing0: s.centreBearingDeg,
      name: { he: s.name.he, en: s.name.en },
      hotspots: s.hotspots.filter((h) => DEMO.includes(h.to)).map((h) => ({ to: h.to, u: h.u, v: h.v })),
    };
  }
  const manifest = {
    $schema: 'habait/transition360.v1', apartment: 'apt846', eye_m: cameras.eye_m || 1.6,
    note: 'derived by test/transition.test.mjs: depth = 360walkaround/tours/apt846-furnished/renders/cp-<id>/depth.png (rgb24-be cm, radial) block-median to 128x64, same encoding; pano = Habait/tour360/apartments/apt846/panos/balanced; pos_cm = cameras.json at / pxPerCm; bearing0 = scenes.json centreBearingDeg',
    depth_all: Object.fromEntries(interior.map((id) => [id, { depth: id + '.depth.png', pos_cm: [+(camById[id].at[0] / k).toFixed(2), +(camById[id].at[1] / k).toFixed(2)], bearing0: scById[id].centreBearingDeg, asset: camById[id].asset }])),
    scenes,
  };
  await writeFile(join(OUT, 'apt846.json'), JSON.stringify(manifest, null, 1));
  return manifest;
}
const manifest = await prep();
console.log(`prep: ${interior.length} depth maps ${DEPTH_W}x${DEPTH_H} + ${DEMO.length} panoramas -> ${OUT}`);
if (process.argv.includes('--prep')) process.exit(0);

// ---------- 1. node ----------
await step('frame: cameras.json px / 2.25 == the depth render plan_cm, centreBearingDeg == its yaw (11 rooms)', async () => {
  let worstCm = 0, worstDeg = 0;
  for (const id of interior) {
    const r = await readJ(join(RENDERS, 'cp-' + id, 'pano.render.json'));
    const c = camById[id];
    worstCm = Math.max(worstCm, Math.hypot(c.at[0] / k - r.point.plan_cm[0], c.at[1] / k - r.point.plan_cm[1]));
    worstDeg = Math.max(worstDeg, tx.angleDiff(r.point.yaw_deg, scById[id].centreBearingDeg));
    assert(r.projection.col_mapping.includes('u=0.5 = camera forward') && r.depth_encoding === 'rgb24-be' && r.depth_scale === 100, id + ': encoding');
  }
  assert(worstCm <= 0.5 && worstDeg <= 0.05, `worst ${worstCm} cm / ${worstDeg} deg`);
  return `worst ${worstCm.toFixed(2)} cm, ${worstDeg.toFixed(3)} deg`;
});

const depthOf = async (id) => { const { data, info } = await sharp(join(OUT, id + '.depth.png')).raw().toBuffer({ resolveWithObject: true }); return { w: info.width, h: info.height, data: dm.decodeDepthRGB(data, info.width, info.height, info.channels) }; };
await step('depth: the derived maps decode inside the render\'s own min/max, floor below = eye height', async () => {
  const out = [];
  for (const id of DEMO) {
    const r = await readJ(join(RENDERS, 'cp-' + id, 'pano.render.json'));
    const m = await depthOf(id);
    let lo = Infinity, hi = 0; for (const d of m.data) if (d > 0) { lo = Math.min(lo, d); hi = Math.max(hi, d); }
    assert(lo >= r.depth_stats.min_m - 0.02 && hi <= r.depth_stats.max_m + 0.02, `${id}: ${lo}..${hi} vs ${r.depth_stats.min_m}..${r.depth_stats.max_m}`);
    const nadir = dm.sampleDepth(m, 0.5, 1);
    assert(Math.abs(nadir - 1.6) < 0.15, `${id}: nadir ${nadir}`);
    out.push(`${id} ${lo.toFixed(2)}-${hi.toFixed(2)} m`);
  }
  return out.join(', ');
});

await step('mesh: 65 x 33 vertices, each on its own ray from the camera at the sampled depth', async () => {
  const id = 'living', s = manifest.scenes[id];
  const m = await depthOf(id);
  const origin = tx.planCmToWorld(s.pos_cm, 1.6);
  const a = dm.buildDepthArrays(m, { segW: 64, segH: 32, origin, bearing0: s.bearing0 });
  assert(a.positions.length === 65 * 33 * 3 && a.indices.length === 64 * 32 * 6, 'sizes');
  const cut = dm.buildDepthArrays(m, { segW: 64, segH: 32, origin, bearing0: s.bearing0, maxRatio: tx.DEFAULTS.maxRatio });
  assert(cut.dropped > 0 && cut.dropped < 64 * 32 * 2 * 0.25 && cut.indices.length === 64 * 32 * 6, 'edge triangles ' + cut.dropped);
  let worst = 0;
  for (let j = 1; j < 32; j++) for (let i = 0; i <= 64; i++) {
    const n = j * 65 + i;
    const v = [a.positions[n * 3] - origin[0], a.positions[n * 3 + 1] - origin[1], a.positions[n * 3 + 2] - origin[2]];
    const [b, p] = dm.bearingPitchOfDir(...v);
    worst = Math.max(worst, tx.angleDiff(b, s.bearing0 + (i / 64 - 0.5) * 360), Math.abs(p - (0.5 - j / 32) * 180), Math.abs(Math.hypot(...v) - a.depths[n]) * 100);
  }
  assert(worst < 1e-3, 'worst ' + worst);
  return `worst ray/depth error ${worst.toExponential(1)}; depth-edge triangles pushed back at ${tx.DEFAULTS.maxRatio}x: ${cut.dropped}/${64 * 32 * 2}`;
});

await step('yaw: bearing <-> tour yaw round trip; arrival yaw = tour.js arriveYaw maths with the bearing held', () => {
  for (let i = 0; i < 200; i++) {
    const b0 = Math.random() * 360, y = Math.random() * 360 - 180;
    const b = tx.bearingOfYaw(b0, y);
    assert(tx.angleDiff(tx.yawOfBearing(b0, b), y) < 1e-9, 'round trip');
  }
  const yA = 20, b = tx.bearingOfYaw(manifest.scenes.living.bearing0, yA);
  const yB = tx.yawOfBearing(manifest.scenes.kitchen.bearing0, b);
  assert(Math.abs(yB - tx.wrap180(b - 125.5)) < 1e-9, 'kitchen');
  return `living yaw 20 -> bearing ${b.toFixed(1)} -> kitchen yaw ${yB.toFixed(1)}`;
});

await step('fallback threshold: < 15 fps -> fade, 15+ or unknown -> mesh', () => {
  assert(tx.chooseMode(14.9) === 'fade' && tx.chooseMode(15) === 'mesh' && tx.chooseMode(NaN) === 'mesh' && tx.chooseMode(60) === 'mesh', 'chooseMode');
  assert(tx.fadeWeight(tx.DEFAULTS.fadeStart) === 0 && tx.fadeWeight(1) === 1 && Math.abs(tx.fadeWeight((1 + tx.DEFAULTS.fadeStart) / 2) - 0.5) < 1e-9, 'fadeWeight');
});

// ---------- 2 + 3. the browser ----------
// the engine bundle (read-only source, the engine's own esbuild, output in our _local)
const engineJs = join(OUT, 'engine/engine.js');
await step('engine: Habait/tour360/engine bundled read-only into _local/transition/engine', () => {
  const src = join(ENGINE, 'src');
  const newest = Math.max(...['index.ts', 'pannellum-compat.ts', 'hybrid-adapter.ts', 'walk-math.ts', 'cube-math.ts', 'compat.css'].map((f) => statSync(join(src, f)).mtimeMs));
  if (!existsSync(engineJs) || statSync(engineJs).mtimeMs < newest) {
    mkdirSync(dirname(engineJs), { recursive: true });
    const bin = join(ENGINE, 'node_modules/esbuild/bin/esbuild');
    execFileSync(process.execPath, [bin, join(src, 'index.ts'), '--bundle', '--format=iife', '--minify', '--log-level=warning', '--outfile=' + engineJs], { cwd: ENGINE, stdio: 'inherit' });
  }
  return `${(statSync(engineJs).size / 1024).toFixed(0)} KB`;
});

const HARNESS = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,">
<link rel="stylesheet" href="/_local/transition/engine/engine.css">
<style>html,body{margin:0;height:100%;background:#000}#pano{position:fixed;inset:0}.door{width:36px;height:36px;border-radius:50%;background:#f2a900;border:2px solid #fff}</style>
<script type="importmap">{ "imports": { "three": "/node_modules/three/build/three.module.js" } }</script>
<script src="/_local/transition/engine/engine.js"></script></head><body><div id="pano"></div>
<script type="module">
import { createTransitionPlugin } from '/js/transition360.js';
const M = '/_local/transition/apt846.json';
const manifest = await (await fetch(M)).json();
const base = new URL(M, location.href).href;
const scenes = {};
for (const [id, s] of Object.entries(manifest.scenes)) scenes[id] = {
  type: 'equirectangular', panorama: new URL(s.pano, base).href, yaw: 0, pitch: -2, hfov: 80,
  hotSpots: s.hotspots.map((h) => ({ type: 'scene', sceneId: h.to, yaw: (h.u - 0.5) * 360, pitch: (0.5 - h.v) * 180, cssClass: 'door door-' + h.to })),
};
const viewer = window.pannellum.viewer('pano', { default: { firstScene: 'living', sceneFadeDuration: 650, walkIn: { moveMs: 650 } }, scenes });
const plugin = createTransitionPlugin({ manifest, baseUrl: base }).attach(viewer);
window.__eng = { viewer, plugin, manifest, loads: 0 };
viewer.on('load', () => { window.__eng.loads++; });
</script></body></html>`;

const server = createServer((rq, rs) => {
  if (rq.url.startsWith('/__t360-engine.html')) { rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rs.end(HARNESS); return; }
  handle(rq, rs).catch((e) => { if (!rs.headersSent) rs.writeHead(500); rs.end(String(e)); });
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
mkdirSync(SHOTS, { recursive: true });

const cpuSnap = () => os.cpus().reduce((a, c) => { const t = c.times; a.busy += t.user + t.nice + t.sys + t.irq; a.all += t.user + t.nice + t.sys + t.irq + t.idle; return a; }, { busy: 0, all: 0 });
const cpu0 = cpuSnap();
const { chromium, devices } = loadMod('playwright-core');
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });

// mean abs difference (0..255) of two PNG data URLs / buffers, on a 256-wide greyscale-free RGB downscale
async function meanDiff(a, b) {
  const buf = (x) => (typeof x === 'string' ? Buffer.from(x.split(',')[1], 'base64') : x);
  const A = await sharp(buf(a)).removeAlpha().resize(256, null, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(buf(b)).removeAlpha().resize(A.info.width, A.info.height, { fit: 'fill' }).raw().toBuffer();
  let s = 0; for (let i = 0; i < A.data.length; i++) s += Math.abs(A.data[i] - B[i]);
  const mean = s / A.data.length;
  let luma = 0; for (let i = 0; i < A.data.length; i++) luma += A.data[i];
  return { mean, lumaA: luma / A.data.length };
}

const VPS = [
  { name: 'desktop', ctx: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } },
  { name: 'iphone13', ctx: { ...devices['iPhone 13'] } },
  { name: 'pixel7', ctx: { ...devices['Pixel 7'] } },
];
const results = {}; // vp -> { moves: [], fade, inflight }
const errors = [];
for (const vp of VPS) {
  const context = await browser.newContext(vp.ctx);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${vp.name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${vp.name} console: ${m.text()}`); });
  page.on('response', (rs) => { if (rs.status() >= 400) errors.push(`${vp.name} HTTP ${rs.status()} ${rs.url()}`); });
  await page.goto(base + '/demo-transition.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__demo && (window.__demo.ready || window.__demo.error), null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__demo.error);
  if (err) { failures++; console.log(`FAIL ${vp.name}: demo did not start: ${err}`); await context.close(); continue; }
  await page.evaluate(() => Promise.all(['living', 'kitchen', 'terraceLiving'].map((id) => window.__demo.viewer.assets.ready(id))));
  await page.waitForTimeout(1200);
  const R = (results[vp.name] = { moves: [] });
  for (const [from, to] of MOVES) {
    await step(`${vp.name}: ${from} -> ${to}`, async () => {
      // stand in A facing the door to B (the parallax is strongest there), a little down
      const start = await page.evaluate(async ([from, to]) => {
        const v = window.__demo.viewer; const h = v.scenes[from].hotspots.find((x) => x.to === to);
        await v.show(from, { yaw: (h.u - 0.5) * 360 + 12, pitch: -6 }); window.__demo.renderRoom();
        return { yaw: v.view.yaw, pitch: v.view.pitch };
      }, [from, to]);
      // the move REPS times (SwiftShader runs on the CPU, which other jobs on this machine share): the reported fps is the
      // median run, every run's drift must hold
      const runs = [];
      for (let i = 0; i < REPS; i++) {
        if (i) await page.evaluate(async ([from, yaw, pitch]) => { await window.__demo.viewer.show(from, { yaw, pitch }); }, [from, start.yaw, start.pitch]);
        await page.waitForTimeout(700); // the meter fills (30 frames)
        const x = await page.evaluate(([to]) => window.__demo.viewer.goTo(to), [to]);
        assert(x && x.to === to, 'no result');
        runs.push(x);
      }
      const r = [...runs].sort((a, b) => a.fps - b.fps)[REPS >> 1];
      r.fpsRuns = runs.map((x) => x.fps);
      r.yawDriftDeg = Math.max(...runs.map((x) => x.yawDriftDeg)); r.arrivalDriftDeg = Math.max(...runs.map((x) => x.arrivalDriftDeg));
      // desktop must run the mesh; a contended phone emulation may correctly demote a run (reported, not failed)
      assert(runs.every((x) => x.mode === 'mesh' || (vp.name !== 'desktop' && x.mode === 'mesh->fade')), 'modes ' + runs.map((x) => x.mode));
      r.modes = runs.map((x) => x.mode);
      // continuity: steady A vs the move at t=0; the move at t=1 vs steady B (deterministic frames, same view)
      const frames = await page.evaluate(async ([from, to, yaw, pitch, yawB]) => {
        const v = window.__demo.viewer; const c = v.tr.canvas; const grab = () => c.toDataURL('image/png');
        await v.show(from, { yaw, pitch }); v.busy = true; const s0 = grab();
        await v.renderAt(from, to, 0, { yaw, pitch }); const m0 = grab();
        await v.renderAt(from, to, 1, { yaw, pitch }); const m1 = grab();
        v.release(); await v.show(to, { yaw: yawB, pitch }); v.busy = true; const s1 = grab();
        v.release();
        return { s0, m0, m1, s1 };
      }, [from, to, start.yaw, start.pitch, r.yawAfter]);
      const c0 = await meanDiff(frames.s0, frames.m0), c1 = await meanDiff(frames.m1, frames.s1);
      // 3 shots: t = 0, 0.5, 1
      const ready = await page.evaluate(() => { document.getElementById('hs').style.visibility = 'hidden'; return true; });
      for (const [n, t] of [[1, 0], [2, 0.5], [3, 1]]) {
        await page.evaluate(([from, to, t, yaw, pitch]) => window.__demo.viewer.renderAt(from, to, t, { yaw, pitch }), [from, to, t, start.yaw, start.pitch]);
        await page.screenshot({ path: join(SHOTS, `transition-${vp.name}-${from}-${to}-${n}.png`) });
      }
      await page.evaluate(() => { const v = window.__demo.viewer; v.release(); document.getElementById('hs').style.visibility = ''; });
      R.moves.push({ ...r, cont0: c0.mean, cont1: c1.mean });
      assert(ready && c0.lumaA > 10, 'blank frame');
      assert(r.yawDriftDeg <= DRIFT_MAX && r.arrivalDriftDeg <= DRIFT_MAX, `yaw drift ${r.yawDriftDeg} / ${r.arrivalDriftDeg}`);
      assert(c0.mean <= CONT_MAX && c1.mean <= CONT_MAX, `continuity start ${c0.mean.toFixed(2)} end ${c1.mean.toFixed(2)} (max ${CONT_MAX})`);
      return `${r.modes.join("/")}, median ${r.fps.toFixed(1)} fps of ${r.fpsRuns.map((f) => f.toFixed(1)).join('/')} (${r.frames} frames / ${r.ms.toFixed(0)} ms, before ${r.fpsBefore.toFixed(1)}), yaw drift ${r.yawDriftDeg.toFixed(4)} deg in-move / ${r.arrivalDriftDeg.toFixed(4)} deg arrival, ends ${c0.mean.toFixed(2)} / ${c1.mean.toFixed(2)}`;
    });
  }
  // the fallback, measured: a synthetic main-thread load per frame (a slow phone), before the move and from its first frame
  await step(`${vp.name}: fallback before the move (load 90 ms/frame)`, async () => {
    await page.evaluate(async () => { const v = window.__demo.viewer; await v.show('living', { yaw: 0, pitch: -5 }); v.meter.loadMs = 90; });
    await page.waitForTimeout(3500);
    const r = await page.evaluate(async () => { const v = window.__demo.viewer; const r = await v.goTo('kitchen'); v.meter.loadMs = 0; return r; });
    R.fade = r;
    assert(r.fpsBefore < 15 && r.mode === 'fade', `fps before ${r.fpsBefore} -> ${r.mode}`);
    assert(r.yawDriftDeg <= DRIFT_MAX && r.arrivalDriftDeg <= DRIFT_MAX, 'drift');
    return `measured ${r.fpsBefore.toFixed(1)} fps -> ${r.mode} (${r.fps.toFixed(1)} fps, ${r.ms.toFixed(0)} ms)`;
  });
  await step(`${vp.name}: fallback in flight (load from the move's 1st frame)`, async () => {
    await page.evaluate(async () => { const v = window.__demo.viewer; await v.show('living', { yaw: 0, pitch: -5 }); });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => { const v = window.__demo.viewer; v.debug = { loadFromFrame: 1, loadMs: 90 }; const r = await v.goTo('terraceLiving'); v.debug = {}; v.meter.loadMs = 0; return r; });
    R.inflight = r;
    assert(r.fpsBefore >= 15 && r.mode === 'mesh->fade', `fps before ${r.fpsBefore}, move ${r.fps} -> ${r.mode}`);
    return `before ${r.fpsBefore.toFixed(1)} fps -> mesh, then ${r.fps.toFixed(1)} fps in the move -> ${r.mode}`;
  });
  await context.close();
}

// ---------- 3. the plugin on the tour engine ----------
let eng = null;
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`engine: ${e.message}`));
  await page.goto(base + '/__t360-engine.html', { waitUntil: 'load' });
  await step('engine: the tour engine loads living with the plugin attached', async () => {
    await page.waitForFunction(() => window.__eng && window.__eng.loads > 0 && window.__eng.viewer.isLoaded(), null, { timeout: 60000 });
    await page.evaluate(() => Promise.all(['living', 'kitchen', 'terraceLiving'].map((id) => window.__eng.plugin.assets.ready(id))));
    await page.waitForTimeout(1500);
    return await page.evaluate(() => `scene ${window.__eng.viewer.getScene()}, engine ${window.pannellum.engine}`);
  });
  await step('engine: walkTo(door living -> kitchen) runs the move, lands on kitchen with the bearing held', async () => {
    await page.evaluate(() => { const v = window.__eng.viewer; v.lookAt(-6, 40, 80, false); });
    await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const { viewer, plugin } = window.__eng; plugin.last = null; plugin.debug.holdOverlay = true;
      const hs = viewer.getConfig().hotSpots.find((h) => h.sceneId === 'kitchen');
      viewer.walkTo(hs);
      const t0 = performance.now();
      while (!plugin.last && performance.now() - t0 < 15000) await new Promise((ok) => setTimeout(ok, 50));
      return plugin.last;
    });
    assert(r, 'the plugin did not run');
    // the hand-off: the overlay's arrival frame vs the engine's own frame of kitchen
    await page.evaluate(() => window.__eng.plugin.showArrivalFrame());
    const withOverlay = await page.screenshot();
    await page.evaluate(() => window.__eng.plugin.hideOverlay());
    await page.waitForTimeout(400);
    const engineOnly = await page.screenshot({ path: join(SHOTS, 'transition-engine-kitchen-arrival.png') });
    const h = await meanDiff(withOverlay, engineOnly);
    await page.evaluate(() => { window.__eng.plugin.debug.holdOverlay = false; });
    eng = { ...r, handoff: h.mean };
    assert(r.engineScene === 'kitchen' && r.mode === 'mesh', `${r.engineScene} / ${r.mode}`);
    assert(r.yawDriftDeg <= DRIFT_MAX && r.arrivalDriftDeg <= DRIFT_MAX, `drift ${r.yawDriftDeg} / ${r.arrivalDriftDeg}`);
    assert(h.mean <= HANDOFF_MAX, `hand-off diff ${h.mean.toFixed(2)} (max ${HANDOFF_MAX})`);
    return `${r.mode}, ${r.fps.toFixed(1)} fps after a ${r.swapMs.toFixed(0)} ms engine swap, engine yaw ${r.yawAfter.toFixed(2)}, bearing ${r.bearingBefore.toFixed(2)} -> ${r.bearingAfter.toFixed(2)} (drift ${r.arrivalDriftDeg.toFixed(3)} deg), hand-off diff ${h.mean.toFixed(2)}`;
  });
  await step('engine: a tap on the door marker (kitchen -> living) reaches the plugin through the engine\'s walk', async () => {
    const r = await page.evaluate(async () => {
      const { plugin } = window.__eng; plugin.last = null;
      const el = document.querySelector('.door-living');
      if (!el) return { err: 'no marker' };
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, vis: b.width > 0 };
    });
    if (r.err || !r.vis) {
      // the door is behind the view: turn to it first
      await page.evaluate(() => { const v = window.__eng.viewer; const h = v.getConfig().hotSpots.find((x) => x.sceneId === 'living'); v.lookAt(-10, h.yaw, 80, false); });
      await page.waitForTimeout(500);
    }
    const p = await page.evaluate(() => { const b = document.querySelector('.door-living').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await page.mouse.click(p.x, p.y);
    const res = await page.evaluate(async () => {
      const { plugin } = window.__eng; const t0 = performance.now();
      while (!plugin.last && performance.now() - t0 < 15000) await new Promise((ok) => setTimeout(ok, 50));
      return plugin.last;
    });
    assert(res && res.engineScene === 'living', 'tap did not run the move: ' + JSON.stringify(res && { s: res.engineScene }));
    assert(res.arrivalDriftDeg <= DRIFT_MAX, 'drift ' + res.arrivalDriftDeg);
    return `${res.mode}, ${res.fps.toFixed(1)} fps, drift ${res.arrivalDriftDeg.toFixed(3)} deg`;
  });
  await context.close();
}
await browser.close();
server.close();
const cpu1 = cpuSnap();
const cpuBusy = (100 * (cpu1.busy - cpu0.busy)) / Math.max(1, cpu1.all - cpu0.all);

if (errors.length) { failures++; console.log('FAIL page errors:\n     ' + errors.slice(0, 8).join('\n     ')); }

// ---------- summary ----------
const D = results.desktop || { moves: [] };
const okMoves = D.moves.filter((m) => m.mode === 'mesh' && m.yawDriftDeg <= DRIFT_MAX && m.arrivalDriftDeg <= DRIFT_MAX && m.cont0 <= CONT_MAX && m.cont1 <= CONT_MAX).length;
const allMoves = Object.values(results).flatMap((r) => r.moves);
const driftMax = Math.max(0, ...allMoves.map((m) => Math.max(m.yawDriftDeg, m.arrivalDriftDeg)), ...(eng ? [eng.arrivalDriftDeg, eng.yawDriftDeg] : []));
const fpsDesk = D.moves.length ? Math.min(...D.moves.map((m) => m.fps)) : NaN;
const fpsList = (vp) => (results[vp] ? results[vp].moves.map((m) => m.fps.toFixed(1)).join('/') : 'n/a');
const fadeOk = Object.values(results).every((r) => r.fade && r.fade.mode === 'fade' && r.inflight && r.inflight.mode === 'mesh->fade') && Object.keys(results).length === VPS.length;
const fadeFps = Object.values(results).map((r) => (r.fade ? r.fade.fpsBefore : NaN));
const line = [
  `transitions: ${okMoves}/${MOVES.length} ok`,
  driftMax <= DRIFT_MAX ? 'yaw drift <= 1deg' : `yaw drift ${driftMax.toFixed(3)}deg > 1deg`,
  fpsDesk >= FPS_DESKTOP_MIN ? `fps_desktop >= ${FPS_DESKTOP_MIN}` : `fps_desktop ${fpsDesk.toFixed(1)} < ${FPS_DESKTOP_MIN}`,
  fadeOk ? 'fallback triggers at <15fps' : 'fallback FAILED',
].join(', ');
console.log(line);
console.log(`measured (SwiftShader software GL, headless Chromium; machine CPU ${cpuBusy.toFixed(0)}% busy during the browser part, ${os.cpus().length} threads): fps_desktop ${fpsList('desktop')}, fps_iphone13 ${fpsList('iphone13')}, fps_pixel7 ${fpsList('pixel7')}; yaw drift max ${driftMax.toFixed(4)}deg; ` +
  `fallback at ${fadeFps.map((f) => f.toFixed(1)).join('/')} fps -> fade, in-flight -> mesh->fade; engine plugin ${eng ? `${eng.mode} ${eng.fps.toFixed(1)} fps, hand-off diff ${eng.handoff.toFixed(2)}/255` : 'n/a'}; shots ${SHOTS}`);
const pass = failures === 0 && okMoves === MOVES.length && driftMax <= DRIFT_MAX && fpsDesk >= FPS_DESKTOP_MIN && fadeOk;
process.exit(pass ? 0 : 1);

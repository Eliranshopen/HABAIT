/* The engine's tests (WALKAROUND-QUALITY-PLAN.md cards Q06 tiles, Q08 walk-in). Plain node 24 (it strips the types of the two pure
   .ts modules itself), no framework, no browser: the browser half is proven by tools/paint-proof.mjs and spikes/wq/*.mjs.
     timeout 300 npm test        (in Habait/tour360/engine)
   What is pinned here:
     1. the cube convention — the viewer's direction↔face maths (src/cube-math.ts) and the cutter's (tools/make-tiles.mjs) are one
        formula, PSV 5.15.1's: a round trip and a face-by-face comparison;
     2. the cutter samples what it claims — a synthetic panorama whose colour is a smooth function of the direction, cut into faces,
        read back against the formula (the seam and both poles included);
     3. the tile level a phone and a desktop get (PSV's picker, fed the device-pixel scale);
     4. the walk-in's numbers (src/walk-math.ts) and the page's arrival maths — tour.js's own block, evaluated as shipped, against
        tools/make-scenes.mjs's bearing on apartment 846, and the property the card asks for: arriving, the door back is behind you. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, '..');
const TOUR = path.resolve(ENGINE, '..');
const imp = (p) => import(pathToFileURL(p).href);
const cube = await imp(path.join(ENGINE, 'src', 'cube-math.ts'));
const walk = await imp(path.join(ENGINE, 'src', 'walk-math.ts'));
const cutter = await imp(path.join(TOUR, 'tools', 'make-tiles.mjs'));

let pass = 0;
const fails = [];
function test(name, fn) {
  try { fn(); pass++; console.log('ok   ' + name); } catch (e) { fails.push(name); console.log('FAIL ' + name + '\n     ' + (e && e.message)); }
}
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };
const near = (a, b, tol, msg) => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg}: ${a} vs ${b} (tol ${tol})`); };
const D = Math.PI / 180;
// the angle between two directions from their chord (acos of a dot product near 1 is off by ~1e-8 for identical directions)
const unit = (y, p) => [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), Math.sin(p)];
const angleBetween = (y1, p1, y2, p2) => {
  const a = unit(y1, p1), b = unit(y2, p2);
  return 2 * Math.asin(Math.min(1, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 2));
};
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

/* ── 1. the cube convention ─────────────────────────────────────────────────────────────── */
test('cube: the six face centres are PSV\'s (front yaw 0, right +90°, back 180°, left −90°, top +90° pitch, bottom −90°)', () => {
  const at = (yaw, pitch) => cube.dirToFace(yaw * D, pitch * D).face;
  eq(at(0, 0), 'front', 'yaw 0'); eq(at(90, 0), 'right', 'yaw 90'); eq(at(180, 0), 'back', 'yaw 180'); eq(at(-90, 0), 'left', 'yaw -90');
  eq(at(0, 89), 'top', 'pitch 89'); eq(at(0, -89), 'bottom', 'pitch -89');
  for (const f of ['front', 'right', 'back', 'left', 'top', 'bottom']) {
    const d = cube.faceToDir(f, 0, 0);
    eq(cube.dirToFace(d.yaw, d.pitch).face, f, 'centre of ' + f);
  }
});
test('cube: direction → face → direction is the identity (2000 random directions, < 1e-9 rad)', () => {
  for (let i = 0; i < 2000; i++) {
    const yaw = (rnd() * 2 - 1) * Math.PI, pitch = Math.asin(rnd() * 2 - 1);
    const f = cube.dirToFace(yaw, pitch);
    if (Math.abs(f.u) > 1 + 1e-12 || Math.abs(f.v) > 1 + 1e-12) throw new Error('u/v outside the face');
    const d = cube.faceToDir(f.face, f.u, f.v);
    if (angleBetween(yaw, pitch, d.yaw, d.pitch) > 1e-9) throw new Error(`round trip off at yaw ${yaw} pitch ${pitch}`);
  }
});
test('cube: the viewer and the cutter (tools/make-tiles.mjs) use one formula (every face, a 9×9 grid)', () => {
  for (const f of cutter.FACES) {
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
      const u = -1 + i / 4, v = -1 + j / 4;
      const [y1, p1] = cutter.facePointToYawPitch(f, u, v);
      const d = cube.faceToDir(f, u, v);
      if (angleBetween(y1, p1, d.yaw, d.pitch) > 1e-12) throw new Error(`${f} (${u}, ${v}) differs`);
    }
  }
});
test('cube: image x grows with yaw on the side faces and y grows downward (the cut is not mirrored)', () => {
  for (const f of ['front', 'right', 'back', 'left']) {
    const a = cube.faceToDir(f, -0.5, 0), b = cube.faceToDir(f, 0.5, 0);
    if (!(walk.wrap180((b.yaw - a.yaw) / D) > 0)) throw new Error(f + ': x does not turn right');
    const c = cube.faceToDir(f, 0, -0.5), e = cube.faceToDir(f, 0, 0.5);
    if (!(c.pitch > e.pitch)) throw new Error(f + ': y does not go down');
  }
});
test('cube: the mesh segment under a direction (PSV keys its per-segment level by the first vertex)', () => {
  eq(cube.segmentVertex(0, 0).vertex, 5 * 1536 + 6 * (16 * 8 + 8), 'front centre');
  eq(cube.segmentVertex(90 * D, 0).face, 'right', 'right');
  const s = cube.segmentVertex(-44 * D, 0); eq(s.face, 'front', 'yaw −44° is still front'); eq(s.col, 0, 'its left column');
});
test('cube: texels per degree — a 2048 face holds 17.87 at its centre and √2 that on the worse axis at its side edge', () => {
  near(cube.pxPerDegAt(0, 0, 2048), (2048 * Math.PI) / 360, 0.05, 'centre');
  // at yaw 44.9° the horizontal axis holds 1/cos² ≈ 1.99× the centre, the vertical 1/cos ≈ 1.41×; the measure is the worse axis
  near(cube.pxPerDegAt(44.9 * D, 0, 2048) / cube.pxPerDegAt(0, 0, 2048), 1 / Math.cos(44.9 * D), 0.01, 'edge / centre');
  near(cube.pxPerDegAt(45.5 * D, 0, 2048), cube.pxPerDegAt(-45.5 * D, 0, 2048), 0.01, 'symmetric');
});

/* ── 2. the cutter samples what it claims ───────────────────────────────────────────────── */
test('cutter: a smooth synthetic panorama cut into faces reads back within 2/255 everywhere (seam and poles included)', () => {
  const W = 512, H = 256;
  const col = (yaw, pitch) => [127.5 + 127.5 * Math.cos(yaw) * Math.cos(pitch), 127.5 + 127.5 * Math.sin(yaw) * Math.cos(pitch), 127.5 + 127.5 * Math.sin(pitch)];
  const img = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const yaw = ((x + 0.5) / W - 0.5) * 2 * Math.PI, pitch = (0.5 - (y + 0.5) / H) * Math.PI;
    const c = col(yaw, pitch); const o = (y * W + x) * 3;
    img[o] = Math.round(c[0]); img[o + 1] = Math.round(c[1]); img[o + 2] = Math.round(c[2]);
  }
  const F = 64;
  for (const kernel of ['cubic', 'bilinear']) {
    let worst = 0, where = '';
    for (const f of cutter.FACES) {
      const out = cutter.renderFace(f, F, img, W, H, f === 'top' || f === 'bottom' ? 2 : 1, kernel);
      for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
        const d = cube.faceToDir(f, 2 * ((x + 0.5) / F - 0.5), 2 * ((y + 0.5) / F - 0.5));
        const want = col(d.yaw, d.pitch); const o = (y * F + x) * 3;
        for (let k = 0; k < 3; k++) { const e = Math.abs(out[o + k] - want[k]); if (e > worst) { worst = e; where = `${f} (${x},${y}) ch${k}`; } }
      }
    }
    if (worst > 2) throw new Error(`${kernel}: worst ${worst.toFixed(2)}/255 at ${where}`);
  }
});
test('cutter: the top face size, the three levels and where mipmaps stop (3840 → 512/1024/2048 from 2048; 7680 → 1024/2048/4096 from 4096)', () => {
  eq(cutter.topFaceSize(3840), 2048, '3840'); eq(cutter.topFaceSize(7680), 4096, '7680'); eq(cutter.topFaceSize(2048), 1024, '2048');
  eq(JSON.stringify(cutter.levelSizes(2048)), '[512,1024,2048]', 'levels 2048'); eq(JSON.stringify(cutter.levelSizes(4096)), '[1024,2048,4096]', 'levels 4096');
  eq(cutter.noMipmapFrom(cutter.levelSizes(2048), 3840), 2048, '3840: the 2048 level (17.9/° at its centre) is denser than the source (10.7/°); 1024 (8.9/°) is not');
  eq(cutter.noMipmapFrom(cutter.levelSizes(4096), 7680), 4096, '7680: only the 4096 level (35.7/°) beats the source (21.3/°)');
  eq(cutter.noMipmapFrom([512], 3840), null, 'no level dense enough');
});

/* ── 3. the level a screen gets (PSV's picker, the scale the adapter feeds it) ─────────────────────────── */
test('levels: a 390×844 phone gets level 1 by CSS pixels and level 2 by its device pixels (×2); a 1440×900 desktop gets level 2', () => {
  const L = [{ faceSize: 512 }, { faceSize: 1024 }, { faceSize: 2048 }];
  const vf = (h, w, hh) => (2 * Math.atan(Math.tan((h * D) / 2) * (hh / w))) / D;
  eq(cube.pickLevel(L, 50, vf(50, 390, 844), 390, 844, 1), 1, 'phone, CSS pixels');
  eq(cube.pickLevel(L, 50, vf(50, 390, 844), 390, 844, 2), 2, 'phone, device pixels');
  eq(cube.pickLevel(L, 101.7, vf(101.7, 1440, 900), 1440, 900, 1), 2, 'desktop');
  eq(cube.pickLevel(L, 40, vf(40, 1440, 900), 1440, 900, 1), 2, 'desktop at full zoom: the top level');
  const L7 = [{ faceSize: 1024 }, { faceSize: 2048 }, { faceSize: 4096 }];
  eq(cube.pickLevel(L7, 50, vf(50, 390, 844), 390, 844, 2), 1, 'phone on a 7680 cut: 2048 faces');
});

/* ── 4. the walk-in ───────────────────────────────────────────────────────────────────────── */
test('walk: wrap180, the turn, the fade window, the zoom and the config clamps', () => {
  eq(walk.wrap180(190), -170, '190'); eq(walk.wrap180(-180), 180, '-180'); eq(walk.wrap180(540), 180, '540'); eq(walk.wrap180(-30), -30, '-30');
  eq(walk.turnMs(2), 0, 'under 3°'); eq(walk.turnMs(90), 358, '90°'); eq(walk.turnMs(180), 556, '180°'); eq(walk.turnMs(-400), 560, 'capped');
  const cfg = walk.walkConfig(true);
  eq(cfg.moveMs, 650, 'default move'); eq(walk.walkConfig(false), null, 'off'); eq(walk.walkConfig({ moveMs: 2000 }).moveMs, 800, 'clamped to 0.8 s');
  eq(walk.walkConfig({ moveMs: 100 }).moveMs, 500, 'clamped to 0.5 s');
  const early = walk.fadeWindow(cfg, 60);
  near(early.start, 227.5, 1e-9, 'early: the fade waits for fadeAt'); near(early.end, 650, 1e-9, 'early: ends with the move');
  const late = walk.fadeWindow(cfg, 900);
  eq(late.start, 900, 'late: starts when ready'); eq(late.ms, 260, 'late: still a fade, not a cut');
  near(walk.hfovAfterZoom(50, 1.6), (2 * Math.atan(Math.tan(25 * D) / 1.6)) / D, 1e-9, 'the narrowed field');
  if (!(walk.hfovAfterZoom(50, 1.6) < 50)) throw new Error('a magnification must narrow the field');
});

const scenes846 = JSON.parse(fs.readFileSync(path.join(TOUR, 'apartments', 'apt846', 'scenes.json'), 'utf8')).scenes;
const tourJs = fs.readFileSync(path.join(TOUR, 'viewer', 'tour.js'), 'utf8');
const block = (() => {
  const a = tourJs.indexOf('/* arrival-maths:begin'), b = tourJs.indexOf('/* arrival-maths:end */');
  if (a < 0 || b < 0 || b < a) throw new Error('tour.js lost its arrival-maths block');
  return tourJs.slice(a, b);
})();
// eslint-disable-next-line no-new-func
const page = new Function(block + '\nreturn { bearing, wrap180, arriveYaw };')();
// tools/make-scenes.mjs's own bearing, copied as an independent witness: clockwise from the top of the plan, [0, 360)
const makeScenesBearing = (from, to) => ((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180) / Math.PI + 360) % 360;

test('arrival: tour.js arriveYaw = make-scenes bearing (camera → camera) − the target centre, on all 26 links of apt846', () => {
  const by = Object.fromEntries(scenes846.map((s) => [s.id, s]));
  let n = 0;
  for (const s of scenes846) for (const h of s.hotspots) {
    const t = by[h.to];
    const want = walk.wrap180(makeScenesBearing([s.plan.x, s.plan.y], [t.plan.x, t.plan.y]) - t.centreBearingDeg);
    near(page.arriveYaw(s, t), want, 1e-9, `${s.id} → ${t.id}`);
    near(walk.arrivalYaw(s.plan, t.plan, t.centreBearingDeg), want, 1e-9, `engine ${s.id} → ${t.id}`);
    n++;
  }
  eq(n, 26, 'links');
});
test('arrival: on every apt846 link the door back to the room you left is behind you (more than 90° from where you look)', () => {
  const by = Object.fromEntries(scenes846.map((s) => [s.id, s]));
  const off = [];
  let n = 0;
  for (const s of scenes846) for (const h of s.hotspots) {
    const t = by[h.to];
    const back = t.hotspots.find((x) => x.to === s.id);
    if (!back) continue;
    n++;
    const d = Math.abs(walk.wrap180(page.arriveYaw(s, t) - (back.u - 0.5) * 360));
    if (d <= 90) off.push(`${s.id} → ${t.id} (${d.toFixed(0)}°)`);
  }
  eq(n, 26, 'reciprocal links');
  if (off.length) throw new Error('the way back is in front: ' + off.join(', '));
});
test('arrival: a scene without centreBearingDeg keeps its own heading (demo-01 and older tours unchanged)', () => {
  const s = { plan: { x: 0, y: 0 } }, t = { plan: { x: 10, y: 0 }, heading: 37 };
  eq(page.arriveYaw(s, t), 37, 'heading');
  eq(page.arriveYaw(s, { ...t, centreBearingDeg: 90 }), 0, 'due east into a panorama centred east');
});

// 5. the field-of-view policy (WALKAROUND-QUALITY-PLAN.md OQ-2, 2026-10-29): a 28 mm default, the vertical field capped
test('field of view: the defaults are a 28 mm lens, not Pannellum\'s 100°', () => {
  eq(walk.FOV_DEFAULT.hfov, 80, 'default hfov');
  eq(walk.FOV_DEFAULT.minHfov, 45, 'min hfov');
  eq(walk.FOV_DEFAULT.maxHfov, 100, 'max hfov');
  near(walk.hfovOf(walk.vfovOf(80, 1.6), 1.6), 80, 1e-9, 'vfovOf and hfovOf are inverses');
});
test('field of view: a desktop window keeps the horizontal bounds, a phone held upright is capped at 80° vertical', () => {
  const desk = walk.fovRange(45, 100, 1440 / 900);
  near(desk.max, walk.vfovOf(100, 1440 / 900), 1e-9, 'landscape: the 100° ceiling is its own vertical field (73°)');
  if (!(desk.max < 80)) throw new Error('a 16:10 window at 100° across must stay under the 80° cap');
  near(desk.min, walk.vfovOf(45, 1440 / 900), 1e-9, 'landscape: the 45° floor stands');
  const phone = walk.fovRange(45, 100, 390 / 844);
  near(phone.max, 80, 1e-9, 'portrait: capped at 80° up (it would be 137°)');
  near(phone.min, 70, 1e-9, 'portrait: a 10° zoom range stays under the cap');
  const across = walk.hfovOf(phone.max, 390 / 844);
  if (!(across > 40 && across < 46)) throw new Error(`portrait: 80° up should be about 42° across, got ${across.toFixed(1)}`);
  near(walk.vfovOf(100, 390 / 844), 137.6, 0.2, 'the old behaviour, for the record: 137.6° up on a phone');
});

console.log(`\n${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);

// walk.js — free real-time walking through Building 10, floor 1, apartment 3 (Avnei Hefetz · Kedem).
// Desktop: ↑/W walk, ↓/S back, ←/→ turn, A/D step sideways, mouse drag looks around, a click on the floor walks there.
// Phone (no on-screen walking arrows — Eliran 2026-11-11): one finger drags the look, a tap on the floor walks there.
// Everywhere: the room strip jumps to a room, the small plan shows where you stand (tap it to go there).
// Eye level 1.60 m. The visitor stays on free floor: walls, glass, fixtures and furniture are kept clear; slides along walls.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildApartment, ITEMS, ACCS, MAT, placeModel, placeItemModel } from './build.js';
import { initStudio } from './studio.js';
import { initDayNight } from './daynight.js';

const $ = (id) => document.getElementById(id);
const PANO_MODE = window.HAB_MODE === '360' || new URLSearchParams(location.search).get('mode') === '360';
let studio = null;   // studio.js: the RAINBOW baseline features (set once the scene is built)
const phone = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
const EYE = 1.6, WALK = 1.3, BACK = 0.8, TURN = 80, R_BODY = 0.2;
const G = await (await fetch('./geometry.json')).json();
// dressing from Eliran's pictures (input/supplied, 2026-11-17): picture 09 shows the 265/380 bedroom with one double bed
// between two nightstands where the sheet draws two singles — the pictures decide the furniture, the sheet the walls
{ const out = new Set(['a-bed-1', 'a-bed-2']); G.furniture = G.furniture.filter((f) => !out.has(f.id));
  const cls = "ASSUMED from Eliran's picture 09";
  G.furniture.push({ id: 'a-bed', kind: 'bed_double', r: [4.95, 0.26, 6.55, 2.26], head: 'S', room: 'bedA', class: cls },
    { id: 'a-night-1', kind: 'nightstand', r: [4.45, 0.26, 4.9, 0.71], room: 'bedA', class: cls }, { id: 'a-night-2', kind: 'nightstand', r: [6.6, 0.26, 7.05, 0.71], room: 'bedA', class: cls }); }
const CAMS = await (await fetch('./cameras.json')).json();
const ROOM_HE = { living: 'סלון ופינת אוכל', kitchen: 'מטבח', entrance: 'כניסה', lobby: 'מבואה', corridor: 'מסדרון', parents: 'חדר שינה הורים',
  parentsbath: 'חדר רחצה הורים', mamad: 'ממ"ד', bath: 'חדר רחצה', bedA: 'חדר שינה 2', bedB: 'חדר שינה 3', wc: 'שירותי אורחים', balcony: 'מרפסת' };

// ---------------------------------------------------------------- renderer, scene, light
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 1.75)); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;   // neutral: his pictures are clean white, AgX greyed them
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(PANO_MODE ? (phone ? 90 : 80) : phone ? 72 : 62, innerWidth / innerHeight, 0.05, 3000); camera.rotation.order = 'YXZ';

const SKY_ROT = THREE.MathUtils.degToRad(110);
new RGBELoader().load('./sky/env_1k.hdr', (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr;   // the equirect itself: three prefilters it for the fast picture, the path tracer samples it as light
});
scene.environmentIntensity = 0.55; scene.environmentRotation = new THREE.Euler(0, SKY_ROT, 0);
if (!PANO_MODE) new THREE.TextureLoader().load(phone ? './sky/bg_2k.jpg' : './sky/bg_4k.jpg', (t) => {   // 360: the panorama is the background
  t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; scene.background = t; scene.backgroundRotation = new THREE.Euler(0, SKY_ROT, 0); scene.backgroundIntensity = 0.85;
});
scene.background = new THREE.Color(0xcfdbe4);
// the sun (north = sheet up, ASSUMED; afternoon from the west-north-west, as in the Blender scene)
const sun = new THREE.DirectionalLight(0xfff1df, 3.2);
const xs = G.footprint.map((p) => p[0]), ys = G.footprint.map((p) => p[1]);
const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
const az = THREE.MathUtils.degToRad(290), el = THREE.MathUtils.degToRad(38);   // azimuth from north, clockwise
sun.position.set(cx + Math.sin(az) * Math.cos(el) * 30, Math.sin(el) * 30, -(cy + Math.cos(az) * Math.cos(el) * 30));
sun.target.position.set(cx, 0, -cy); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(phone ? 2048 : 4096, phone ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 5, far: 70 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
scene.add(new THREE.HemisphereLight(0xf4f6f8, 0xa9a7a3, 0.35));
// warm bounce in each room (unshadowed): stands in for the light the walls throw back
for (const r of G.rooms) {
  const a = r.rects[0], area = r.area_m2;
  const p = new THREE.PointLight(0xfff5ea, 1.2 + area * 0.25, 0, 2); p.position.set((a[0] + a[2]) / 2, G.meta.ceiling_m - 0.35, -(a[1] + a[3]) / 2); scene.add(p);
}

// baked light (scripts/12_bake_lightmaps.py): when baked/manifest.json exists, every surface shows its own texture times the
// light Cycles computed for it (sun, sky, bounce between walls, soft shadows); ?baked=0 shows the real-time version
let BAKED = null;
if (new URLSearchParams(location.search).get('baked') === '1') { try { const r = await fetch('./baked/manifest.json'); if (r.ok) BAKED = await r.json(); } catch {} }
// the realistic look (skilllook.js): the day-night-keyframes skill's baked shell, when its media is here; ?look=live = the live shell
let SKILL = null;
const wantSkill = !BAKED && !PANO_MODE && new URLSearchParams(location.search).get('look') !== 'live' && (await fetch('./skill/daynight.json').then((r) => r.ok).catch(() => false));
const { doors } = await buildApartment(scene, G, renderer, { baked: !!BAKED, skill: wantSkill });
if (wantSkill) { const { loadSkillLook } = await import('./skilllook.js'); SKILL = await loadSkillLook({ scene, renderer, phone, MAT }); }
if (BAKED) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const TLd = new THREE.TextureLoader();
  const lms = await Promise.all(BAKED.groups.map((g) => TLd.loadAsync(`./baked/${phone && g.small ? g.small : g.file}`).then((t) => { t.flipY = false; t.channel = 1; t.colorSpace = THREE.SRGBColorSpace; return t; })));
  const gl = await new GLTFLoader().loadAsync(`./baked/${BAKED.model}`);
  gl.scene.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, k = -1; while (p) { const m = /^LM_group_(\d+)/.exec(p.name || ''); if (m) { k = +m[1]; break; } p = p.parent; }
    if (k < 0) return;
    const old = o.material;
    o.material = new THREE.MeshBasicMaterial({ map: old.map || null, color: old.color ? old.color.clone() : 0xffffff, lightMap: lms[k], lightMapIntensity: BAKED.scale * Math.PI * (BAKED.exposure || 1.7) });
    if (o.material.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    old.dispose();
  });
  scene.add(gl.scene);
  for (const l of scene.children.filter((c) => c.isPointLight)) l.intensity *= 0.3;   // the plants only: the walls carry their light already
}

// ---------------------------------------------------------------- post: ambient occlusion for contact shadows in corners
let composer = null;
if (!phone && !PANO_MODE) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1.1, samples: 16 }); ao.blendIntensity = BAKED ? 0.35 : SKILL ? 0.6 : 0.85;   // the baked shell has its own soft shadows; the live furniture needs contact shadow
  composer.addPass(ao); composer.addPass(new OutputPass());
}

// ---------------------------------------------------------------- the free floor (5 cm grid)
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const inRect = (x, y, r, pad = 0) => x > r[0] - pad && x < r[2] + pad && y > r[1] - pad && y < r[3] + pad;
const blockers = [...G.fixtures.filter((f) => f.kind !== 'panel').map((f) => f.r), ...G.furniture.filter((f) => f.r && f.kind !== 'rug').map((f) => f.r),
  ...G.furniture.filter((f) => f.c).map((f) => { const rr = f.radius || 0.25; return [f.c[0] - rr, f.c[1] - rr, f.c[0] + rr, f.c[1] + rr]; })];
const walkOpen = [];   // door gaps and the open sash of the slider
for (const o of G.openings) {
  if (o.kind === 'window') continue;
  if (o.kind === 'sliding_door') { const [a, b] = o._open || [0, 0]; const r = o.r; walkOpen.push(o.axis === 'x' ? [r[0] + a, r[1] - 0.05, r[0] + b, r[3] + 0.05] : [r[0] - 0.05, r[1] + a, r[2] + 0.05, r[1] + b]); }
  else { const r = o.r; walkOpen.push(o.axis === 'x' ? [r[0] + 0.12, r[1] - 0.05, r[2] - 0.12, r[3] + 0.05] : [r[0] - 0.05, r[1] + 0.12, r[2] + 0.05, r[3] - 0.12]); }
}
for (const w of G.walls) { const wx = w.exterior.map((p) => p[0]), wy = w.exterior.map((p) => p[1]); w._bb = [Math.min(...wx), Math.min(...wy), Math.max(...wx), Math.max(...wy)]; }
const inWall = (x, y) => G.walls.some((w) => inRect(x, y, w._bb) && inPoly(x, y, w.exterior) && !w.holes.some((h) => inPoly(x, y, h)));
function freeAt(x, y) {
  // rooms that meet with no wall between them (kitchen | living, living | corridor) share an edge: no shrink here,
  // the wall test below keeps the body 20 cm off every wall
  const inside = G.rooms.some((r) => r.rects.some((a) => inRect(x, y, a, 0.03)));
  const gap = walkOpen.some((r) => inRect(x, y, r));
  if (!inside && !gap) return false;
  if (!gap) for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; if (inWall(x + Math.cos(a) * R_BODY, y + Math.sin(a) * R_BODY)) return false; }
  if (blockers.some((r) => inRect(x, y, r, 0.12))) return false;
  return true;
}
const GX0 = Math.min(...xs) - 1, GY0 = Math.min(...ys) - 1, CELL = 0.05, GW = Math.ceil((Math.max(...xs) + 1 - GX0) / CELL), GH = Math.ceil((Math.max(...ys) + 1 - GY0) / CELL);
const free = new Uint8Array(GW * GH);
const balDeck = (x, y) => inPoly(x, y, G.balcony.deck);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const x = GX0 + (i + 0.5) * CELL, y = GY0 + (j + 0.5) * CELL;
  let f = freeAt(x, y);
  if (!f && balDeck(x, y)) {   // the balcony deck, kept 25 cm off its parapet and the building
    // 25 cm off the parapet, but the deck edge against the building is open where the slider's open sash is
    let ok = true; for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, px = x + Math.cos(a) * 0.25, py = y + Math.sin(a) * 0.25;
      if (!inPoly(px, py, G.balcony.deck) && !walkOpen.some((r) => inRect(px, py, r)) && !G.rooms.some((r) => r.rects.some((q) => inRect(px, py, q)))) ok = false; }
    if (ok && !blockers.some((r) => inRect(x, y, r, 0.12))) f = true;
  }
  free[j * GW + i] = f ? 1 : 0;
}
const ok = (x, y) => { const i = Math.floor((x - GX0) / CELL), j = Math.floor((y - GY0) / CELL); return i >= 0 && j >= 0 && i < GW && j < GH && free[j * GW + i] === 1; };
const roomAt = (x, y) => { if (inPoly(x, y, G.balcony.deck)) return 'balcony'; const r = G.rooms.find((q) => q.rects.some((a) => inRect(x, y, a))); return r ? r.id : ''; };

// ---------------------------------------------------------------- the visitor
// the walk starts just inside the entrance door, looking into the living room (east)
const S = G.meta.px_per_cm, [OX, OY] = G.meta.origin_px;
const me = { x: (700 - OX) / S / 100, y: (OY - 1800) / S / 100, yaw: THREE.MathUtils.degToRad(-80), pitch: -0.03, dist: 0, goal: null };
if (!ok(me.x, me.y)) { const start = CAMS.panoramas.find((c) => c.id === 'pano_living'); me.x = start.x; me.y = start.y; }
// yaw: 0 looks north (plan +y), positive turns left
const keys = new Set();
addEventListener('keydown', (e) => { if (e.target && e.target.tagName === 'INPUT') return; if (studio && studio.mode === 'doll') return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (PANO_MODE && (k === 'ArrowUp' || k === 'w')) { e.preventDefault(); if (!e.repeat && studio && !(PANO && PANO.moving)) studio.forward(); return; } if (PANO_MODE && !(k === 'ArrowLeft' || k === 'ArrowRight')) return; if (k.startsWith('Arrow') || 'wasd'.includes(k)) { keys.add(k); me.goal = null; me.path = null; fly = null; e.preventDefault(); } });
addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key)); addEventListener('blur', () => keys.clear());
const cv = renderer.domElement; let drag = null;
const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, moved: 0, t: performance.now() }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (studio && studio.mode === 'doll') { studio.orbit(dx, dy); drag.lx = e.clientX; drag.ly = e.clientY; return; }
  const k = e.pointerType === 'mouse' ? 0.0042 : 0.0055;
  me.yaw += dx * k; me.pitch = THREE.MathUtils.clamp(me.pitch + dy * k * 0.85, -0.75, 0.55);
  drag.lx = e.clientX; drag.ly = e.clientY;
});
cv.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.moved < 8 && performance.now() - drag.t < 450 && studio && (studio.tap(e.clientX, e.clientY) || studio.mode === 'doll')) { drag = null; return; }
  if (drag.moved < 8 && performance.now() - drag.t < 450) {   // a tap / click: walk to that spot of the floor
    ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
    const p = new THREE.Vector3(); if (ray.ray.intersectPlane(floor, p)) { const gx = p.x, gy = -p.z; if (PANO) { PANO.tapFloor(gx, gy); drag = null; return; } const d = Math.hypot(gx - me.x, gy - me.y); if (d < 12) setGoal(gx, gy); }
  }
  drag = null;
});
// route finding on the free grid: breadth-first over 8 neighbours, then shortened by line of sight, so a tap in
// another room walks you there through the doors instead of pressing you against the wall between
const cellOf = (x, y) => [Math.floor((x - GX0) / CELL), Math.floor((y - GY0) / CELL)];
const centre = (i, j) => [GX0 + (i + 0.5) * CELL, GY0 + (j + 0.5) * CELL];
function sight(ax, ay, bx, by) { const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 0.04); for (let k = 1; k < n; k++) if (!ok(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n)) return false; return true; }
function findPath(x0, y0, x1, y1) {
  const [si, sj] = cellOf(x0, y0), [ti, tj] = cellOf(x1, y1), S = sj * GW + si, T = tj * GW + ti;
  if (!free[T]) return null;
  const prev = new Int32Array(GW * GH).fill(-1); prev[S] = S; const q = new Int32Array(GW * GH); let h = 0, t = 0; q[t++] = S;
  while (h < t) {
    const c = q[h++]; if (c === T) break; const i = c % GW, j = (c - i) / GW;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue; const n = nj * GW + ni;
      if (prev[n] !== -1 || !free[n]) continue; if (di && dj && (!free[j * GW + ni] || !free[nj * GW + i])) continue;
      prev[n] = c; q[t++] = n;
    }
  }
  if (prev[T] === -1) return null;
  const cells = []; for (let c = T; c !== S; c = prev[c]) cells.push(c); cells.reverse();
  const pts = cells.map((c) => centre(c % GW, (c - (c % GW)) / GW)); pts[pts.length - 1] = [x1, y1];
  const out = []; let ax = x0, ay = y0, k = 0;
  while (k < pts.length) { let far = k; for (let m = pts.length - 1; m > k; m--) if (sight(ax, ay, pts[m][0], pts[m][1])) { far = m; break; } out.push(pts[far]); [ax, ay] = pts[far]; k = far + 1; }
  return out;
}
function setGoal(x, y, opt = {}) {   // the nearest free spot to the tap, reached along a route through the doors
  if (!ok(x, y)) [x, y] = nearestFree(x, y);
  const path = findPath(me.x, me.y, x, y); if (!path || !path.length) return false;
  me.path = path; me.goal = { x: path[0][0], y: path[0][1] }; me.path.shift(); me.speed = opt.speed || WALK; me.endYaw = opt.yaw ?? null;
  if (opt.marker !== false) showMarker(x, y); return true;
}
const marker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; marker.visible = false; marker.name = 'marker'; scene.add(marker);
function showMarker(x, y) { marker.position.set(x, 0.02, -y); marker.visible = true; }
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer && composer.setSize(innerWidth, innerHeight); });

let fly = null;   // a smooth glide to a room
// a room button walks you there, briskly, through the doors (a glide only if no route exists)
function flyTo(x, y, yaw) {
  if (studio && studio.mode === 'doll') studio.setMode('walk');
  if (PANO) { PANO.goNear(x, y, yaw); return; }
  if (!ok(x, y)) [x, y] = nearestFree(x, y);
  if (setGoal(x, y, { speed: 2.2, yaw, marker: false })) return;
  fly = { x0: me.x, y0: me.y, yaw0: me.yaw, x1: x, y1: y, yaw1: me.yaw + (((yaw - me.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI), t: 0 }; me.goal = null; marker.visible = false;
}

const view = { x: 0, y: 0, yaw: 0, pitch: 0, init: false };
function step(dt) {
  if (!view.init) { Object.assign(view, { x: me.x, y: me.y, yaw: me.yaw, pitch: me.pitch, init: true }); }
  if (PANO_MODE) { view.x = me.x; view.y = me.y; }   // 360: the eye is the panorama's own point, never eased
  if (fly) {
    fly.t = Math.min(1, fly.t + dt / 1.1); const s = fly.t * fly.t * (3 - 2 * fly.t);
    me.x = fly.x0 + (fly.x1 - fly.x0) * s; me.y = fly.y0 + (fly.y1 - fly.y0) * s; me.yaw = fly.yaw0 + (fly.yaw1 - fly.yaw0) * s; me.pitch *= 0.9;
    if (fly.t >= 1) fly = null;
  } else {
    let fwd = (keys.has('ArrowUp') || keys.has('w') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('s') ? 1 : 0);
    const side = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
    me.yaw += THREE.MathUtils.degToRad(TURN) * turn * dt;
    let mvx = 0, mvy = 0;
    if (me.goal) {
      const dx = me.goal.x - me.x, dy = me.goal.y - me.y, d = Math.hypot(dx, dy);
      if (d < 0.06) {
        if (me.path && me.path.length) { const p = me.path.shift(); me.goal = { x: p[0], y: p[1] }; }
        else { me.goal = null; marker.visible = false; if (me.endYaw != null) { fly = { x0: me.x, y0: me.y, yaw0: me.yaw, x1: me.x, y1: me.y, yaw1: me.yaw + (((me.endYaw - me.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI), t: 0 }; me.endYaw = null; } }
      } else { const v = Math.min(d, (me.speed || WALK) * dt); mvx = (dx / d) * v; mvy = (dy / d) * v;
        const want = Math.atan2(-dx, dy); let dd = want - me.yaw; dd = ((dd + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; me.yaw += dd * Math.min(1, dt * 4); }
    } else if (fwd || side) {
      const v = (fwd >= 0 ? WALK : BACK) * dt, fx = -Math.sin(me.yaw), fy = Math.cos(me.yaw);
      mvx = (fx * fwd + fy * side) * v; mvy = (fy * fwd - fx * side) * v;
    }
    if (mvx || mvy) {
      // small sub-steps (a phone runs at fewer frames, so one frame's step can be 10 cm): a step that touches an obstacle slides
      // along it instead of cancelling the walk
      const n = Math.max(1, Math.ceil(Math.hypot(mvx, mvy) / 0.03)), sx = mvx / n, sy = mvy / n;
      let blocked = 0;
      for (let i = 0; i < n; i++) {
        let nx = me.x, ny = me.y;
        if (ok(me.x + sx, me.y + sy)) { nx += sx; ny += sy; } else if (ok(me.x + sx, me.y)) nx += sx; else if (ok(me.x, me.y + sy)) ny += sy; else { blocked++; break; }
        me.dist += Math.hypot(nx - me.x, ny - me.y); me.x = nx; me.y = ny;
      }
      if (blocked && me.goal && !ok(me.x + Math.sign(sx) * 0.05, me.y + Math.sign(sy) * 0.05)) { me.goal = null; me.path = null; marker.visible = false; }
    }
  }
  // smooth camera (Eliran 2026-11-18 on the phone: «התזוזה לא יציבה זה קופץ»): the view eases toward the visitor, a small step bob only
  const ph = (me.dist / 0.68) * Math.PI, bob = PANO_MODE ? 0 : phone ? 0.006 : 0.012, k = Math.min(1, dt * 10);
  view.x += (me.x - view.x) * k; view.y += (me.y - view.y) * k;
  let dy = me.yaw - view.yaw; dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; view.yaw += dy * Math.min(1, dt * 12); view.pitch += (me.pitch - view.pitch) * Math.min(1, dt * 12);
  if (Math.hypot(me.x - view.x, me.y - view.y) > 1.5) { view.x = me.x; view.y = me.y; }   // a jump (a room button glide, a shared link) is not eased
  camera.position.set(view.x, EYE + Math.abs(Math.sin(ph)) * bob - bob / 2, -view.y);
  camera.rotation.set(view.pitch * -1, view.yaw, 0);
}

// ---------------------------------------------------------------- UI: room strip, minimap, labels
const strip = $('rooms');
// the room stops, in visiting order (RAINBOW: numbered room cards + pager); studio.js draws them
const deck = G.balcony.deck, balX = deck.reduce((q, p) => q + p[0], 0) / deck.length + 1.2, balY = deck.reduce((q, p) => q + p[1], 0) / deck.length;
const cam = (id) => { const c = CAMS.panoramas.find((q) => q.id === id); return [c.x, c.y, THREE.MathUtils.degToRad(c.yaw_deg)]; };
// stop mode (Eliran 2026-11-18: the most realistic result): the 27 realism photos of the photo skin, each at its standpoint
let STOPV = []; if (!PANO_MODE) { try { const r = await fetch('./stops/stops.json'); if (r.ok) STOPV = (await r.json()).stops; } catch {} }
const PREFER = { living: 'living_1', kitchen: 'kitchen_1', parents: 'parents_0', mamad: 'mamad_1', bedA: 'bedA_1', bedB: 'bedB_1', bath: 'bath_0', balcony: 'balcony_1', entrance: 'entrance_0' };
const atStop = (room, fallback) => { const v = STOPV.find((q) => q.name === PREFER[room]); return v ? [v.x, v.y, v.yaw] : fallback; };
const STOPS = [
  { room: 'entrance', at: atStop('entrance', [me.x, me.y, me.yaw]) }, { room: 'living', at: atStop('living', cam('pano_living')) }, { room: 'kitchen', at: atStop('kitchen', cam('pano_kitchen')) },
  { room: 'balcony', at: atStop('balcony', [balX, balY, THREE.MathUtils.degToRad(-35)]) }, { room: 'parents', at: atStop('parents', cam('pano_parents')) }, { room: 'mamad', at: atStop('mamad', cam('pano_mamad')) },
  { room: 'bedA', at: atStop('bedA', cam('pano_bedA')), he: 'חדר שינה 2', en: 'Bedroom 2' }, { room: 'bedB', at: atStop('bedB', cam('pano_bedB')), he: 'חדר שינה 3', en: 'Bedroom 3' },
  { room: 'bath', at: atStop('bath', cam('pano_bath')) },
];
if (PANO_MODE) STOPS.splice(STOPS.findIndex((s) => s.room === 'parents'), 0, { room: 'corridor', at: [7.6, 5.5, Math.PI] });
const mm = $('map'), mctx = mm.getContext('2d');
const MW = Math.max(...xs) - Math.min(...xs) + 0.6, MH = Math.max(...ys) - Math.min(...ys) + 0.6 + 1.0;
const msc = () => mm.width / MW;
const toMap = (x, y) => [(x - Math.min(...xs) + 0.3) * msc(), (Math.max(...ys) + 1.3 - y) * msc()];
function drawMap() {
  if (!mm.clientWidth) { mm.width = 0; return; }
  const W = mm.clientWidth * devicePixelRatio; mm.width = W; mm.height = Math.round((W * MH) / MW);
  mctx.clearRect(0, 0, mm.width, mm.height); mctx.fillStyle = 'rgba(250,248,244,0.92)';
  mctx.beginPath(); G.footprint.forEach(([x, y], i) => { const [u, v] = toMap(x, y); i ? mctx.lineTo(u, v) : mctx.moveTo(u, v); }); mctx.closePath(); mctx.fill();
  mctx.fillStyle = 'rgba(214,190,150,0.9)'; mctx.beginPath(); G.balcony.deck.forEach(([x, y], i) => { const [u, v] = toMap(x, y); i ? mctx.lineTo(u, v) : mctx.moveTo(u, v); }); mctx.closePath(); mctx.fill();
  mctx.fillStyle = '#3a3733';
  for (const w of G.walls) { mctx.beginPath(); w.exterior.forEach(([x, y], i) => { const [u, v] = toMap(x, y); i ? mctx.lineTo(u, v) : mctx.moveTo(u, v); }); mctx.closePath(); mctx.fill(); }
}
drawMap(); addEventListener('resize', drawMap);
mm.addEventListener('click', (e) => { const r = mm.getBoundingClientRect(), u = (e.clientX - r.left) * devicePixelRatio, v = (e.clientY - r.top) * devicePixelRatio;
  const x = u / msc() + Math.min(...xs) - 0.3, y = Math.max(...ys) + 1.3 - v / msc(); flyTo(...nearestFree(x, y), me.yaw); });
const nearestFree = (x, y) => { if (ok(x, y)) return [x, y]; for (let r = 0.05; r < 1.5; r += 0.05) for (let k = 0; k < 24; k++) { const a = (k * Math.PI) / 12, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (ok(px, py)) return [px, py]; } return [me.x, me.y]; };
function drawMe() {
  if (!mm.width || !mm.height || !mm.clientWidth) { drawMapDot = null; return; }   // the plan is hidden (phone, or closed)
  drawMapDot = drawMapDot || mctx.getImageData(0, 0, mm.width, mm.height);
  mctx.putImageData(drawMapDot, 0, 0);
  const [u, v] = toMap(me.x, me.y), s = 9 * devicePixelRatio;
  mctx.fillStyle = 'rgba(217,119,6,0.30)'; mctx.beginPath(); mctx.moveTo(u, v);
  const a = -me.yaw - Math.PI / 2; mctx.arc(u, v, s * 3.2, a - 0.55, a + 0.55); mctx.closePath(); mctx.fill();
  mctx.fillStyle = '#d97706'; mctx.beginPath(); mctx.arc(u, v, s * 0.6, 0, Math.PI * 2); mctx.fill();
}
let drawMapDot = null; addEventListener('resize', () => { drawMapDot = null; });

setTimeout(() => $('hintbox').classList.add('fade'), phone ? 5000 : 9000);

let PANO = null;
if (PANO_MODE) { const { initPano } = await import('./pano.js'); PANO = await initPano({ scene, camera, renderer, me, model: scene.children.filter((o) => (o.isMesh || o.isGroup) && o !== marker) }); }
const daynight = BAKED || PANO_MODE ? null : initDayNight({ scene, renderer, sun, MAT, centre: { x: cx, y: cy }, phone, onKeys: SKILL ? (a, b, t) => SKILL.mix(a, b, t) : null, expScale: SKILL ? 0.78 : 1, lang: () => (document.documentElement.lang === 'en' ? 'en' : 'he') });
studio = BAKED ? null : await initStudio({ pano: PANO, daynight, scene, camera, renderer, G, me, roomAt, flyTo, phone, MAT, ITEMS, ACCS, placeModel, placeItemModel, strip, CAMS, ROOM_HE, ok, STOPS, setGoal, nearestFree, findPath });
// realistic mode (pathtrace.js): path traced the moment you stop walking; ?pt=1 while it is being proven
let PT = null, ptVer = '';
if (!BAKED && new URLSearchParams(location.search).get('pt') === '1') { try { const { initPathTracer } = await import('./pathtrace.js'); PT = await initPathTracer({ renderer, scene, camera, composer, MAT, phone }); ptVer = (studio ? studio.ver : 0) + ':' + (daynight ? daynight.hour.toFixed(2) : ''); } catch (e) { console.error('path tracer', e); } }
if (phone && !PANO_MODE) {
  const pad = document.createElement('div'); pad.className = 'dpad'; pad.setAttribute('aria-label', 'חיצי הליכה');
  for (const [k, label, cls] of [['ArrowUp', 'קדימה', 'd-up'], ['ArrowLeft', 'פנייה שמאלה', 'd-lf'], ['ArrowRight', 'פנייה ימינה', 'd-rt'], ['ArrowDown', 'אחורה', 'd-dn']]) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dp ' + cls; b.setAttribute('aria-label', label);
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6l7 9H5z" fill="currentColor"/></svg>';
    const on = (e) => { e.preventDefault(); keys.add(k); me.goal = null; me.path = null; fly = null; b.classList.add('on'); };
    const off = () => { keys.delete(k); b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    pad.appendChild(b);
  }
  document.body.appendChild(pad);
}
const stopEl = document.createElement('div'); stopEl.className = 'stopview'; stopEl.innerHTML = '<img alt=""><span>הדמיה · AI · צילום מעובד</span>'; document.body.appendChild(stopEl);
let idleSince = performance.now(), stopShown = null;
function stopFrame(now) {
  const changed = studio && studio.ops.length > 0;   // the photos show the apartment as designed: a visitor's change hides them
  const moving = !!(me.goal || keys.size || fly || (drag && drag.moved > 4)) || changed;
  if (moving) { idleSince = now; if (stopShown) { stopEl.classList.remove('on'); stopShown = null; } return; }
  if (stopShown || now - idleSince < 700 || !STOPV.length || (studio && studio.mode !== 'walk')) return;
  const v = STOPV.find((q) => { let d = q.yaw - me.yaw; d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return Math.hypot(q.x - me.x, q.y - me.y) < 0.6 && Math.abs(d) < 0.45; });
  if (!v) return;
  stopShown = v; const im = stopEl.querySelector('img'); im.onload = () => { if (stopShown === v) stopEl.classList.add('on'); }; im.src = `./stops/${v.name}.jpg`;
}
let last = performance.now(), shown = '';
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.05, (t - last) / 1000); last = t; if (studio && studio.mode === 'doll') studio.update(dt); else step(dt); if (studio) studio.frame(t, dt); if (!PANO_MODE) stopFrame(t); if (PANO) { const d = studio && studio.mode === 'doll'; if (d !== PANO._doll) { PANO._doll = d; PANO.doll(d); } PANO.frame(); } if (SKILL) SKILL.sync();
  if (PT) {
    const v = (studio ? studio.ver : 0) + ':' + (daynight ? daynight.hour.toFixed(2) : '');
    if (v !== ptVer) { const onlyLight = ptVer && ptVer.split(':')[0] === v.split(':')[0]; ptVer = v; onlyLight ? PT.lights() : PT.rebuild(); }
    PT.frame();
  } else composer ? composer.render(dt) : renderer.render(scene, camera);
  const r = roomAt(me.x, me.y);
  if (r && r !== shown) { shown = r; if (studio) studio.onRoom(r); else $('room').textContent = ROOM_HE[r] || ''; }
  drawMe();
});
// walking reachability: flood the free grid from where the visitor stands; for each room stop, can it be reached on foot?
function reach() {
  const seen = new Uint8Array(GW * GH), q = [];
  const i0 = Math.floor((me.x - GX0) / CELL), j0 = Math.floor((me.y - GY0) / CELL); q.push(j0 * GW + i0); seen[j0 * GW + i0] = 1;
  while (q.length) { const c = q.pop(), i = c % GW, j = (c - i) / GW;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj, n = nj * GW + ni; if (ni >= 0 && nj >= 0 && ni < GW && nj < GH && !seen[n] && free[n]) { seen[n] = 1; q.push(n); } } }
  const at = (x, y) => { const [fx, fy] = nearestFree(x, y); return !!seen[Math.floor((fy - GY0) / CELL) * GW + Math.floor((fx - GX0) / CELL)]; };
  const out = {};
  for (const r of G.rooms) { const a = r.rects[0]; out[r.id] = at((a[0] + a[2]) / 2, (a[1] + a[3]) / 2); }
  const d = G.balcony.deck; out.balcony = at(d.reduce((s, p) => s + p[0], 0) / d.length + 1.2, d.reduce((s, p) => s + p[1], 0) / d.length);
  return out;
}
// the same scene as a glTF binary (scripts/11_export_glb.mjs calls this): apartment only, no marker, no lights
async function exportGLB() {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const keep = scene.children.filter((o) => (o.isMesh && o !== marker) || o.isGroup);
  const root = new THREE.Group(); root.name = 'b10-floor1-apt3';
  for (const o of keep) root.add(o.clone());
  const buf = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
  let s = ''; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}
cv.addEventListener('wheel', (e) => { e.preventDefault(); if (studio) studio.wheel(e.deltaY); }, { passive: false });
window.__walk = { studio, daynight, SKILL, PANO, get PT() { return PT; }, G, walkOpen, freeAt, blockers, inWall, setGoal, findPath, me, ok, scene, renderer, camera, flyTo, exportGLB, reach, ready: true, info: () => renderer.info.render, freeCount: () => free.reduce((s, v) => s + v, 0) };
$('load').classList.add('hidden');

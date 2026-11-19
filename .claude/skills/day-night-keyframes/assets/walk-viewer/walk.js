// walk.js + Day/Night (2026-11-17, Files_reverse_engeneering/poc-walk): the same Hatzav walk, its light baked once per
// lighting keyframe on the SAME UV atlases (blender/walk_keyframes.py); a clock slider cross-fades the two atlas sets that
// bracket the chosen hour (linear light, in the shader), and the live parts (sky, lawn, plants) follow the same weight.
// walk.js — free walking through the Hatzav house in its true 3D model (2026-11-17, Eliran: «I want a fully interactive 3D
// Walkaround visualization, not a 3D 360° panorama»). The plan-exact Blender model with its daylight and lamps baked into texture
// atlases (scripts/blender/walk_bake.py, adapted from the apt846 walk3d), so every step is drawn from where the visitor stands.
// Desktop: ↑/W walk · ↓/S back · ←/→ (A/D) turn · mouse drag looks · click the floor to walk there.
// Phone (no on-screen arrows, Eliran 2026-11-11): one finger drag — up walks, sideways turns; a tap on the floor walks there.
// The visitor stays on the free floor (walk-grid.png: walls and furniture kept clear) and slides along walls. Eye level 1.55 m;
// the look stays near eye level (Eliran 2026-11-17: a look tilted down reads as a security camera).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const EYE = 1.55, WALK = 1.3, BACK = 0.8, TURN = 80, STEP = 0.68, BOB = 0.018;
const phone = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const $ = (id) => document.getElementById(id);
$('hint').innerHTML = phone
  ? 'גררו אצבע למעלה כדי ללכת · לצדדים כדי לפנות · הקישו על הרצפה כדי ללכת אליה<small>הדמיה ממודל תלת־ממדי לפי תכנית המכר · ריהוט וחומרים להמחשה</small>'
  : 'חיצים / WASD: הליכה ופנייה · גרירה בעכבר: הסתכלות · לחיצה על הרצפה: הליכה אליה<small>הדמיה ממודל תלת־ממדי לפי תכנית המכר · ריהוט וחומרים להמחשה</small>';
setTimeout(() => { $('hint').style.opacity = '0'; }, 9000);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.75 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd6da);
new THREE.TextureLoader().load('./model/sky.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; scene.background = t; });
// live light only for what is not baked (lawn, plants): the scene's sun, from the same direction as the bake
const SUN_AZ = THREE.MathUtils.degToRad(-142), SUN_EL = THREE.MathUtils.degToRad(22.5);
const hemi = new THREE.HemisphereLight(0xe9eef2, 0x6f6a58, 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
sun.position.set(Math.cos(SUN_EL) * Math.cos(SUN_AZ) * 50, Math.sin(SUN_EL) * 50, Math.cos(SUN_EL) * Math.sin(SUN_AZ) * 50);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(phone ? 74 : 68, innerWidth / innerHeight, 0.05, 2000);
camera.rotation.order = 'YXZ';

// ---- the free floor (frame: u,v in cm = x*100, z*100)
const grid = await (await fetch('./walk-grid.json')).json();
const free = await new Promise((res) => {
  const im = new Image();
  im.onload = () => {
    const c = document.createElement('canvas'); c.width = grid.w; c.height = grid.h;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, grid.w, grid.h).data; const a = new Uint8Array(grid.w * grid.h);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4] > 127 ? 1 : 0;
    res(a);
  };
  im.src = './walk-grid.png';
});
const ok = (xm, zm) => {
  const c = Math.round((xm * 100 - grid.x0) / grid.cell), r = Math.round((zm * 100 - grid.y0) / grid.cell);
  return r >= 0 && c >= 0 && r < grid.h && c < grid.w && free[r * grid.w + c] === 1;
};
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const roomAt = (xm, zm) => { const r = grid.rooms.find((q) => inPoly(xm * 100, zm * 100, q.loop)); return r ? r.he : ''; };

// ---- the house
const loader = new GLTFLoader();
if (phone) loader.manager.setURLModifier((u) => u.replace(/(bake_\d+)\.jpg$/, '$1_1k.jpg'));   // phones: the 1024 atlases (sync_media.py writes them)
const gltf = await loader.loadAsync('./model/walk.gltf', (e) => { if (e.total) $('prog').style.width = Math.round((100 * e.loaded) / e.total) + '%'; });
const floorMeshes = [], baked = [], curtains = [], glows = [];   // curtains and lamp glows are unlit: the clock sets their colour
function mixMat(map) {   // MeshBasic whose map is mix(map, map2, uMix): both atlases are sRGB textures, so the mix is in linear light
  const mat = new THREE.MeshBasicMaterial({ map });
  mat.userData.u = { map2: { value: map }, uMix: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.u);
    sh.fragmentShader = ['uniform sampler2D map2;', 'uniform float uMix;', sh.fragmentShader.replace('#include <map_fragment>', [
      '#ifdef USE_MAP',
      ' vec4 sampledDiffuseColor = mix(texture2D(map, vMapUv), texture2D(map2, vMapUv), uMix);',
      ' diffuseColor *= sampledDiffuseColor;',
      '#endif'].join(String.fromCharCode(10)))].join(String.fromCharCode(10));
  };
  return mat;
}
gltf.scene.traverse((o) => {
  if (!o.isMesh) return;
  const m = o.material, n = (m && m.name) || '';
  if (n.startsWith('WALK_baked')) { o.material = mixMat(m.map); baked.push({ mat: o.material, g: +n.split('_').pop(), proto: m.map }); floorMeshes.push(o); }
  else if (n === 'WALK_glass') { o.material = new THREE.MeshBasicMaterial({ color: 0xe4ecee, transparent: true, opacity: 0.08, depthWrite: false }); o.renderOrder = 2; }
  else if (/curtain/i.test(o.name) || /curtain|sheer/i.test(n)) { o.material = new THREE.MeshBasicMaterial({ color: 0xeeeae2, transparent: true, opacity: 0.93, side: THREE.DoubleSide, depthWrite: false }); o.renderOrder = 3; curtains.push(o.material); }
  else if (/downlight_glow|lamp_shade/i.test(n)) { o.material = new THREE.MeshBasicMaterial({ color: 0xfff1dc }); glows.push(o.material); }
  else if (/lawn/i.test(n)) { floorMeshes.push(o); }
  if (o.material && 'side' in o.material && !o.material.transparent) o.material.side = THREE.FrontSide;
});
scene.add(gltf.scene);

// ---- the visitor
const me = { x: grid.start.x / 100, z: grid.start.y / 100, yaw: 0, pitch: -0.03, dist: 0, goal: null };
const setYaw = (deg) => { me.yaw = -Math.PI / 2 - THREE.MathUtils.degToRad(deg); };   // plan yaw (0 = +u, positive toward +v) -> camera yaw
setYaw(grid.start.yaw_deg);
const keys = new Set();
addEventListener('keydown', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k.startsWith('Arrow') || 'wasd'.includes(k)) { keys.add(k); me.goal = null; e.preventDefault(); } });
addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener('blur', () => keys.clear());
let drag = null, walkIn = 0, turnIn = 0;
const cv = renderer.domElement;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function floorAt(cx, cy) {   // the free floor point under a screen position, or null
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(floorMeshes, false).find((h) => h.point.y < 0.08 && h.face && h.face.normal.y > 0.5);
  const p = hit ? hit.point : null;
  if (!p) { const t = -camera.position.y / ray.ray.direction.y; if (!(t > 0) || t > 25) return null; return ray.ray.at(t, new THREE.Vector3()); }
  return p;
}
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse', t: performance.now(), moved: 0 }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
  if (drag.touch) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    walkIn = Math.abs(dy) < 14 ? 0 : THREE.MathUtils.clamp(-dy / 110, -1, 1);
    turnIn = Math.abs(dx) < 14 ? 0 : THREE.MathUtils.clamp(dx / 140, -1, 1);
    if (walkIn || turnIn) me.goal = null;
  } else {
    me.yaw -= (e.clientX - drag.lx) * 0.0042;
    me.pitch = THREE.MathUtils.clamp(me.pitch - (e.clientY - drag.ly) * 0.0035, -0.55, 0.45);
  }
  drag.lx = e.clientX; drag.ly = e.clientY;
});
const up = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.moved < 8 && performance.now() - drag.t < 400) {   // a click / tap: walk to that floor point
    const p = floorAt(e.clientX, e.clientY);
    if (p && ok(p.x, p.z)) me.goal = { x: p.x, z: p.z };
  }
  drag = null; walkIn = 0; turnIn = 0;
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function move(dx, dz) {
  let nx = me.x, nz = me.z;
  if (ok(me.x + dx, me.z + dz)) { nx += dx; nz += dz; } else if (ok(me.x + dx, me.z)) nx += dx; else if (ok(me.x, me.z + dz)) nz += dz; else return false;
  me.dist += Math.hypot(nx - me.x, nz - me.z); me.x = nx; me.z = nz; return true;
}
function step(dt) {
  const fwd = (keys.has('ArrowUp') || keys.has('w') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) + walkIn;
  const turn = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0) + turnIn;
  me.yaw -= THREE.MathUtils.degToRad(TURN) * THREE.MathUtils.clamp(turn, -1, 1) * dt;
  const f = THREE.MathUtils.clamp(fwd, -1, 1), v = (f >= 0 ? WALK : BACK) * f * dt;
  if (v) move(-Math.sin(me.yaw) * v, -Math.cos(me.yaw) * v);
  else if (me.goal) {   // walk to a clicked point: turn toward it while walking
    const gx = me.goal.x - me.x, gz = me.goal.z - me.z, d = Math.hypot(gx, gz);
    if (d < 0.06) me.goal = null;
    else {
      const want = Math.atan2(-gx, -gz); let dy = ((want - me.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      me.yaw += THREE.MathUtils.clamp(dy, -3 * dt, 3 * dt);
      const s = Math.min(d, WALK * dt * (Math.abs(dy) > 1.2 ? 0.3 : 1));
      if (!move((gx / d) * s, (gz / d) * s)) me.goal = null;
    }
  }
  const ph = (me.dist / STEP) * Math.PI;
  camera.position.set(me.x, EYE + Math.abs(Math.sin(ph)) * BOB - BOB / 2, me.z);
  camera.rotation.set(me.pitch, me.yaw, Math.sin(ph) * 0.003);
}

// ---- named places
const NAMES = { living: 'סלון', dining: 'פינת אוכל', kitchen: 'מטבח', entrance: 'כניסה', hall: 'מבואה', bedroom: 'חדר שינה', saferoom: 'ממ"ד', bath: 'חדר רחצה', deck: 'דק' };
for (const [k, [u, v, yaw]] of Object.entries(grid.views)) {
  const b = document.createElement('button'); b.textContent = NAMES[k] || k; b.dataset.v = k;
  b.onclick = () => { $('fade').style.opacity = '1'; setTimeout(() => { me.x = u / 100; me.z = v / 100; setYaw(yaw); me.pitch = -0.03; me.goal = null; $('fade').style.opacity = '0'; }, 280); };
  $('nav').append(b);
}
let last = performance.now(), roomShown = '';
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.05, (t - last) / 1000); last = t; step(dt); renderer.render(scene, camera);
  const r = roomAt(me.x, me.z); if (r !== roomShown) { roomShown = r; $('room').textContent = r; $('room').classList.toggle('hidden', !r); }
});
// ---- Day/Night: the clock picks the two lighting keyframes around it and their weight (piecewise linear)
const DN = await (await fetch('./daynight.json')).json();
const KF = DN.keys.slice().sort((a, b) => a.hour - b.hour);
function bracket(h) {
  if (h <= KF[0].hour) return [KF[0], KF[0], 0];
  const z = KF[KF.length - 1]; if (h >= z.hour) return [z, z, 0];
  for (let i = 0; i < KF.length - 1; i++) if (h >= KF[i].hour && h <= KF[i + 1].hour) return [KF[i], KF[i + 1], (h - KF[i].hour) / (KF[i + 1].hour - KF[i].hour)];
  return [KF[0], KF[0], 0];
}
const tl = new THREE.TextureLoader(), cache = new Map();
function atlas(key, b) {   // one atlas of one key, with the sampler the glTF gave its group
  const url = `./media/${key}/bake_${b.g}${phone ? '_1k' : ''}.jpg`;
  if (!cache.has(url)) cache.set(url, tl.loadAsync(url).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.wrapS = b.proto.wrapS; t.wrapT = b.proto.wrapT;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t;
  }));
  return cache.get(url);
}
const lerp = (a, b, t) => a + (b - a) * t;
const lerpC = (a, b, t) => new THREE.Color(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
let seq = 0;
const dn = { hour: +(new URLSearchParams(location.search).get('hour') ?? DN.start), a: null, b: null, t: 0, ready: false };
async function setHour(h) {
  h = THREE.MathUtils.clamp(h, DN.hours[0], DN.hours[1]);
  const my = ++seq, [a, b, t] = bracket(h);
  dn.hour = h; showClock(h);
  const [ta, tb] = await Promise.all([Promise.all(baked.map((x) => atlas(a.name, x))), Promise.all(baked.map((x) => atlas(b.name, x)))]);
  if (my !== seq) return;   // a newer hour won
  baked.forEach((x, i) => { x.mat.map = ta[i]; x.mat.userData.u.map2.value = tb[i]; x.mat.userData.u.uMix.value = t; });
  scene.backgroundIntensity = lerp(a.sky, b.sky, t);
  hemi.intensity = lerp(a.hemi, b.hemi, t); sun.intensity = lerp(a.sun, b.sun, t);
  const cu = lerpC(a.curtain, b.curtain, t), gl = lerpC(a.glow, b.glow, t);
  curtains.forEach((m) => m.color.copy(cu)); glows.forEach((m) => m.color.copy(gl));
  sun.color = lerpC(a.sunColor, b.sunColor, t);
  Object.assign(dn, { a: a.name, b: b.name, t, ready: true });
  $('mixinfo').textContent = t < 0.005 || t > 0.995 ? (t > 0.995 ? b : a).label : `${a.label} ${Math.round((1 - t) * 100)}% · ${b.label} ${Math.round(t * 100)}%`;
  if (phone) for (const [u, p] of cache) if (!u.includes(`/${a.name}/`) && !u.includes(`/${b.name}/`)) { p.then((x) => x.dispose()); cache.delete(u); }
}
function showClock(h) {
  const m = Math.round(h * 60); $('clock').textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  $('hour').value = h;
}
$('hour').min = DN.hours[0]; $('hour').max = DN.hours[1];
$('hour').addEventListener('input', (e) => { playing = false; $('play').textContent = '▶'; setHour(+e.target.value); });
for (const k of KF) { const bt = document.createElement('button'); bt.textContent = k.label; bt.onclick = () => { playing = false; setHour(k.hour); }; $('ticks').append(bt); }
let playing = false;
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? '❚❚' : '▶'; if (playing && dn.hour >= DN.hours[1]) setHour(DN.hours[0]); };
for (const el of [$('light')]) for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation());
let lastPlay = 0;
renderer.setAnimationLoop((t) => {   // the walk's loop, plus the day playing at 1 hour per second
  const dt = Math.min(0.05, (t - last) / 1000); last = t; step(dt);
  if (playing && t - lastPlay > 50) { lastPlay = t; const h = dn.hour + 0.05; if (h >= DN.hours[1]) { playing = false; $('play').textContent = '▶'; } setHour(Math.min(h, DN.hours[1])); }
  renderer.render(scene, camera);
  const r = roomAt(me.x, me.z); if (r !== roomShown) { roomShown = r; $('room').textContent = r; $('room').classList.toggle('hidden', !r); }
});
await setHour(dn.hour);
if (new URLSearchParams(location.search).get('ui') === '0') document.body.classList.add('noui');
window.__walk = { me, ok, scene, renderer, camera, grid, setYaw, setHour, dn, ready: true, info: () => renderer.info.render };

$('load').classList.add('hidden');

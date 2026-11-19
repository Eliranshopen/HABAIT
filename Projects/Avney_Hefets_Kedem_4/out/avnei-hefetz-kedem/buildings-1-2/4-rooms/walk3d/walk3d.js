// walk3d.js - free walking through Avnei Hefetz Kedem apt 7 in its true 3D model (2026-11-17, Eliran: "a fully interactive 3D
// Walkaround, not a 360 panorama"). Adapted from the Rainbow walk3d page (.wt/blender-walk, 2026-11-12): the plan-exact Blender model
// with its daylight baked into texture atlases (tools/walk3d_bake.py), so every step is drawn from where the visitor stands.
// Desktop: arrows / WASD walk and turn, mouse drag looks around. Phone (no on-screen arrows, Eliran 2026-11-11): one finger drag,
// up walks, down backs, sideways turns; two fingers sideways look. The room strip jumps to a room. The visitor stays on the free floor.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const EYE = 1.6, WALK = 1.25, BACK = 0.8, TURN = 75, STEP = 0.68, BOB = 0.02;
const phone = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
const $ = (id) => document.getElementById(id);
$('hint').innerHTML = phone ? 'גררו אצבע למעלה כדי ללכת · לצדדים כדי לפנות<small>הדמיה ממודל תלת־ממדי לפי תכנית המכר · הריהוט להמחשה בלבד</small>'
  : 'חיצים או WASD: ↑ הליכה · ↓ אחורה · ← → פנייה · גרירה בעכבר: הסתכלות<small>הדמיה ממודל תלת־ממדי לפי תכנית המכר · הריהוט להמחשה בלבד</small>';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.75 : 2)); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
{ const c = document.createElement('canvas'); c.width = 2; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#8fb2d4'); gr.addColorStop(0.49, '#e3eaf0'); gr.addColorStop(0.51, '#b9b6a6'); gr.addColorStop(1, '#8d8a76'); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; scene.background = t; }
scene.add(new THREE.HemisphereLight(0xf4f1ea, 0x8a8174, 1.6)); const sun = new THREE.DirectionalLight(0xfff4e0, 1.4); sun.position.set(-3, 8, 4); scene.add(sun);
const camera = new THREE.PerspectiveCamera(phone ? 72 : 68, innerWidth / innerHeight, 0.05, 4000); camera.rotation.order = 'YXZ';

// ---- the free floor (tools/walk_grid.py)
const grid = await (await fetch('./walk3d-grid.json')).json();
const free = await new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = grid.w; c.height = grid.h;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, grid.w, grid.h).data; const a = new Uint8Array(grid.w * grid.h);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4] > 127 ? 1 : 0; res(a); }; im.src = './walk3d-grid.png'; });
const ok = (xm, zm) => { const c = Math.floor((xm * 100 - grid.x0) / grid.cell), r = Math.floor((zm * 100 - grid.y0) / grid.cell); return r >= 0 && c >= 0 && r < grid.h && c < grid.w && free[r * grid.w + c] === 1; };
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const roomAt = (xm, zm) => { const r = grid.rooms.find((q) => inPoly(xm * 100, zm * 100, q.loop)); return r ? r.he : ''; };

// ---- the apartment
const loader = new GLTFLoader(new THREE.LoadingManager());
if (phone) loader.manager.setURLModifier((u) => u.replace(/(bake_\d+)\.jpg$/, '$1_2k.jpg'));
const gltf = await loader.loadAsync('./model/walk3d.gltf', (e) => { if (e.total) $('prog').style.width = Math.round((100 * e.loaded) / e.total) + '%'; });
gltf.scene.traverse((o) => {
  if (!o.isMesh) return; const m = o.material;
  if (m && m.name.startsWith('WALK3D_baked')) { o.material = new THREE.MeshBasicMaterial({ map: m.map }); m.dispose(); }
  else if (m && m.name === 'WALK3D_glass') { o.material = new THREE.MeshBasicMaterial({ color: 0xdfe8ec, transparent: true, opacity: 0.1, depthWrite: false }); o.renderOrder = 2; }
});
scene.add(gltf.scene);

// ---- the visitor
const me = { x: grid.start.x / 100, z: grid.start.y / 100, yaw: -THREE.MathUtils.degToRad(grid.start.yaw_deg), pitch: -0.03, dist: 0 };
{ const q = new URLSearchParams(location.search), at = grid.cameras.find((c) => c.id === q.get('at'));   // QA / deep link: ?at=<room>&yaw=<deg>
  if (at) { me.x = at.x / 100; me.z = at.y / 100; } if (q.has('yaw')) me.yaw = -THREE.MathUtils.degToRad(Number(q.get('yaw'))); }
const keys = new Set();
addEventListener('keydown', (e) => { if (e.key.startsWith('Arrow') || 'wasdWASD'.includes(e.key)) { keys.add(e.key.toLowerCase()); e.preventDefault(); } });
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase())); addEventListener('blur', () => keys.clear());
let drag = null, walkIn = 0, turnIn = 0;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse' }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.touch) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    walkIn = Math.abs(dy) < 14 ? 0 : THREE.MathUtils.clamp(-dy / 110, -1, 1);
    turnIn = Math.abs(dx) < 14 ? 0 : THREE.MathUtils.clamp(dx / 140, -1, 1);
  } else {
    me.yaw -= (e.clientX - drag.lx) * 0.0042; me.pitch = THREE.MathUtils.clamp(me.pitch - (e.clientY - drag.ly) * 0.0035, -1.1, 0.9);
  }
  drag.lx = e.clientX; drag.ly = e.clientY;
});
const up = (e) => { if (drag && e.pointerId === drag.id) { drag = null; walkIn = 0; turnIn = 0; } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// the room strip: a jump to each room's standing point, facing into the room
const nav = $('rooms');
for (const c of grid.cameras) {
  const b = document.createElement('button'); b.textContent = c.he; b.type = 'button';
  b.addEventListener('click', () => { me.x = c.x / 100; me.z = c.y / 100; me.pitch = -0.03; });
  nav.append(b);
}

function step(dt) {
  const k = (n) => keys.has(n);
  const fwd = (k('arrowup') || k('w') ? 1 : 0) - (k('arrowdown') || k('s') ? 1 : 0) + walkIn;
  const turn = (k('arrowright') || k('d') ? 1 : 0) - (k('arrowleft') || k('a') ? 1 : 0) + turnIn;
  me.yaw -= THREE.MathUtils.degToRad(TURN) * THREE.MathUtils.clamp(turn, -1, 1) * dt;
  const f = THREE.MathUtils.clamp(fwd, -1, 1), v = (f >= 0 ? WALK : BACK) * f * dt;
  if (v) {
    const dx = -Math.sin(me.yaw) * v, dz = -Math.cos(me.yaw) * v; let nx = me.x, nz = me.z;
    if (ok(me.x + dx, me.z + dz)) { nx += dx; nz += dz; } else if (ok(me.x + dx, me.z)) nx += dx; else if (ok(me.x, me.z + dz)) nz += dz;
    me.dist += Math.hypot(nx - me.x, nz - me.z); me.x = nx; me.z = nz;
  }
  const ph = (me.dist / STEP) * Math.PI;
  camera.position.set(me.x + Math.cos(me.yaw) * Math.sin(ph) * 0.012, EYE + Math.abs(Math.sin(ph)) * BOB - BOB / 2, me.z - Math.sin(me.yaw) * Math.sin(ph) * 0.012);
  camera.rotation.set(me.pitch, me.yaw, Math.sin(ph) * 0.004);
}
let last = performance.now(), roomShown = '';
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.05, (t - last) / 1000); last = t; step(dt); renderer.render(scene, camera);
  const r = roomAt(me.x, me.z); if (r && r !== roomShown) { roomShown = r; $('room').textContent = r; }
});
window.__walk3d = { me, ok, step, keys, scene, renderer, camera, ready: true, info: () => renderer.info.render };
$('load').classList.add('hidden');

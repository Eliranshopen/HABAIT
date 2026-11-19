// walk3d.js - the 3D walk of Avnei Hefetz Kedem apt 7 (2026-11-17), in the look of Eliran's own pictures, with the Habait tour's
// features and look: rings on the pieces with a catalog of generated furniture (fal: nano-banana-pro -> Hunyuan 3D, made once, a swap
// is $0), the free-text design line, styles and finishes, undo / before-after / reset, the plan, a view from above, a tape measure,
// and the time of day (the day-night-keyframes skill, mode B: one baked LIGHT atlas set per keyframe on the same model, cross-faded
// by the clock in linear light). The page draws light x colour per part (walk3d_bake.py --pass light | albedo).
// Desktop: arrows / WASD walk and turn, mouse drag looks. Phone (no on-screen arrows, Eliran 2026-11-11): one finger drag walks/turns.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const EYE = 1.6, WALK = 1.25, BACK = 0.8, TURN = 75, STEP = 0.68, BOB = 0.02;
const Q = new URLSearchParams(location.search), SHOT = Q.has('shot');
const phone = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, kids = []) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); } for (const c of [].concat(kids)) if (c) n.append(c); return n; };
if (SHOT) document.documentElement.classList.add('shot');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.75 : 2)); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
function paintSky(top, hor, ground = '#b9b6a6') {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.49, hor); gr.addColorStop(0.51, ground); gr.addColorStop(1, ground); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping;
  if (scene.background) scene.background.dispose(); scene.background = t; }
scene.add(new THREE.HemisphereLight(0xf4f1ea, 0x8a8174, 1.6)); const sun = new THREE.DirectionalLight(0xfff4e0, 1.4); sun.position.set(-3, 8, 4); scene.add(sun);
const camera = new THREE.PerspectiveCamera(phone ? 72 : 68, innerWidth / innerHeight, 0.05, 4000); camera.rotation.order = 'YXZ';
const FOV0 = camera.fov;

// ---- data
const J = (u) => fetch(u).then((r) => r.json());
const [grid, D, PJ, ANCH, DN, CAT, SLOTS, LIVEL] = await Promise.all(['./walk3d-grid.json', './design.json', './model/parts.json', './anchors.json', './daynight.json', './catalog.json', './slots.json', './model/live.json'].map((u) => J(u).catch(() => ({}))));
const free = await new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = grid.w; c.height = grid.h;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, grid.w, grid.h).data; const a = new Uint8Array(grid.w * grid.h);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4] > 127 ? 1 : 0; res({ a }); }; im.src = './walk3d-grid.png'; });
const ok = (xm, zm) => { const c = Math.floor((xm * 100 - grid.x0) / grid.cell), r = Math.floor((zm * 100 - grid.y0) / grid.cell); return r >= 0 && c >= 0 && r < grid.h && c < grid.w && free.a[r * grid.w + c] === 1; };
const nearestFree = (xm, zm, maxM = 1.2) => { if (ok(xm, zm)) return [xm, zm]; for (let rr = 0.05; rr <= maxM; rr += 0.05) for (let a = 0; a < 24; a++) { const x = xm + Math.cos(a * Math.PI / 12) * rr, z = zm + Math.sin(a * Math.PI / 12) * rr; if (ok(x, z)) return [x, z]; } return null; };
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const roomObj = (xm, zm) => grid.rooms.find((q) => inPoly(xm * 100, zm * 100, q.loop)) || null;
const OPEN = new Set(['kitchen', 'living', 'foyer', 'corridor', 'balcony']);
const zoneOf = (xm, zm) => { const r = roomObj(xm, zm); return r ? (OPEN.has(r.id) ? 'open' : r.id) : ''; };
const PIECE = Object.fromEntries(D.pieces.map((p) => [p.id, p]));
const PARTS = PJ.parts;
const lin = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
const palette = (name) => (D.palettes[name] || []).map(([id, he, hex]) => ({ id, he, hex }));
const partsOf = (pid, mats) => PARTS.filter((p) => p.piece === pid && (!mats || mats.includes('*') || mats.includes(p.mat)));
const KEYS = DN.keyframes.slice().sort((a, b) => a.hour - b.hour);

// ---- the shader: light (two time-of-day keys, mixed) x colour per part
const partData = new Float32Array(64 * 4 * 4);
const partTex = new THREE.DataTexture(partData, 64, 4, THREE.RGBAFormat, THREE.FloatType); partTex.magFilter = partTex.minFilter = THREE.NearestFilter;
const wood = await new Promise((res) => new THREE.TextureLoader().load('./model/wood.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; res(t); }));
const woodMean = (() => { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); g.drawImage(wood.image, 0, 0, 16, 16); const d = g.getImageData(0, 0, 16, 16).data; const m = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) { const v = d[i + k] / 255; m[k] += (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) / 256; } return new THREE.Vector3(...m); })();
const EV_DAY = -1.28;   // calibrated 2026-11-17 against the first walk's living-room frame
const G = { expo: { value: Math.pow(2, EV_DAY) }, sat: { value: 1.12 }, con: { value: 1.06 }, warm: { value: 0.06 } };   // calibrated against Eliran's living-room picture (walls 223/216/212)
const GRADE = `uniform float expo, sat, con, warm;
  vec3 s2l(vec3 c) { return pow(c, vec3(2.2)); }
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  vec3 grade(vec3 c) { c = pow(aces(max(c * expo * 1.6, 0.0)), vec3(1.0 / 2.2)); float y = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(y), c, sat); c = (c - 0.5) * con + 0.5;
    c *= vec3(1.0 + warm * 0.07, 1.0 + warm * 0.01, 1.0 - warm * 0.12); return clamp(c, 0.0, 1.0); }`;
const MIX = { t: { value: 0 }, gA: { value: 2 }, gB: { value: 2 } };
function bakedMaterial(tA) {
  return new THREE.ShaderMaterial({
    uniforms: { tLa: { value: null }, tLb: { value: null }, tA: { value: tA }, tP: { value: partTex }, tW: { value: wood }, wMean: { value: woodMean }, ...G, ...MIX },
    vertexShader: `attribute vec2 aBake; attribute float aPart; varying vec2 vB; varying float vP; varying vec3 vW;
      void main() { vB = aBake; vP = aPart; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D tLa, tLb, tA, tP, tW; uniform vec3 wMean; uniform float t, gA, gB; varying vec2 vB; varying float vP; varying vec3 vW; ${GRADE}
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec4 row(float r) { return texture2D(tP, vec2((floor(vP + 0.5) + 0.5) / 64.0, (r + 0.5) / 4.0)); }   // round: an interpolated id can land a hair under its integer
      void main() {
        vec4 p0 = row(0.0), p3 = row(3.0); float mode = p0.a;
        if (mode > 4.5) discard;
        if (p3.a > 0.5) { gl_FragColor = vec4(1.0, 0.95, 0.86, 1.0); return; }
        vec3 L = mix(s2l(texture2D(tLa, vB).rgb) * gA, s2l(texture2D(tLb, vB).rgb) * gB, t), A = s2l(texture2D(tA, vB).rgb);
        if (mode > 0.5 && mode < 1.5) A = A * p0.rgb / max(p3.rgb, vec3(0.03));
        else if (mode > 1.5 && mode < 2.5) A = p0.rgb;
        else if (mode > 2.5 && mode < 3.5) { vec4 p1 = row(1.0), p2 = row(2.0); vec2 q = vec2(vW.x / p1.x, vW.z / p1.y); vec2 id = floor(q), f = fract(q);
          vec2 e = min(f, 1.0 - f) * p1.xy; A = mix(p0.rgb * (0.965 + 0.07 * h(id)), p2.rgb, step(min(e.x, e.y), 0.0022)); }
        else if (mode > 3.5) { vec2 q = vec2(vW.x / 1.5, vW.z / 0.21); q.x += h(vec2(floor(q.y), 3.0)); vec2 id = floor(q), f = fract(q);
          vec3 w = s2l(texture2D(tW, vec2(f.x * 0.45 + h(id) * 0.55, f.y * 0.2 + h(id + 7.0) * 0.8)).rgb);
          A = w * p0.rgb / max(wMean, vec3(0.03)) * (0.93 + 0.14 * h(id)); float e = min(min(f.x, 1.0 - f.x) * 1.5, min(f.y, 1.0 - f.y) * 0.21); A *= mix(0.72, 1.0, smoothstep(0.0005, 0.0025, e)); }
        gl_FragColor = vec4(grade(L * A), 1.0);
      }`,
  });
}
// a swapped-in piece (no bake of its own): its own colour or texture x the baked light around its slot at this hour x a soft normal term
function itemMaterial(src, light, fabric = 0) {
  const map = src.map || null, col = src.color ? new THREE.Vector3(src.color.r, src.color.g, src.color.b) : new THREE.Vector3(0.7, 0.7, 0.7);
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, hasMap: { value: map ? 1 : 0 }, col: { value: col }, tint: { value: new THREE.Vector3(1, 1, 1) }, lt: { value: new THREE.Vector3(...light) }, fab: { value: fabric }, ...G },
    vertexShader: `varying vec3 vN; varying vec2 vU; varying vec3 vP; void main() { vN = normalize(mat3(modelMatrix) * normal); vU = uv; vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D map; uniform float hasMap, fab; uniform vec3 col, tint, lt; varying vec3 vN; varying vec2 vU; varying vec3 vP; ${GRADE}
      float hh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(hh(i), hh(i + vec3(1,0,0)), f.x), mix(hh(i + vec3(0,1,0)), hh(i + vec3(1,1,0)), f.x), f.y), mix(mix(hh(i + vec3(0,0,1)), hh(i + vec3(1,0,1)), f.x), mix(hh(i + vec3(0,1,1)), hh(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main() { vec3 n = normalize(vN); float k = mix(0.48, 1.06, n.y * 0.5 + 0.5) * (0.92 + 0.08 * abs(n.x));
        vec3 a = (hasMap > 0.5 ? texture2D(map, vU).rgb : vec3(1.0)) * col * tint;
        if (fab > 0.5) { float g = vn(vP * 260.0) * 0.6 + vn(vP * 90.0) * 0.4; a *= 0.86 + 0.24 * g; }   // bouclé loops: a fine world-space grain on upholstery
        gl_FragColor = vec4(grade(a * lt * k * 1.55), 1.0); }`,
  });
}

// ---- the apartment
const loader = new GLTFLoader(new THREE.LoadingManager());
const tl = new THREE.TextureLoader();
const tex = (url) => new Promise((res, rej) => tl.load(url, (t) => { t.flipY = false; t.anisotropy = 4; res(t); }, undefined, rej));
const atlas = (name) => tex(`./model/${name}${phone ? '_1k' : ''}.jpg`);
const gltf = await loader.loadAsync('./model/walk3d.gltf', (e) => { if (e.total) $('prog').style.width = Math.round((70 * e.loaded) / e.total) + '%'; });
const groups = new Set(); gltf.scene.traverse((o) => { if (o.isMesh && o.material && /^WALK3D_baked_(\d+)/.test(o.material.name)) groups.add(Number(RegExp.$1)); });
const ATL = {}, LT = {};   // LT[key][group] = the light atlas of that hour
await Promise.all([...groups].map(async (k) => { ATL[k] = bakedMaterial(await atlas(`albedo_${k}`)); }));
const noonKey = KEYS.find((k) => k.from_walk) || KEYS[0];
LT[noonKey.name] = {}; await Promise.all([...groups].map(async (k) => { LT[noonKey.name][k] = await atlas(`light_${k}`); }));
const pickables = [], liveBase = [];
// his furniture (generated from his pictures) is LIVE in the model: baked into the room's shadows, drawn with its own textures
const LIVE_RX = /^(l-sofa|l-coffee|l-dining|chair_\d+_\d+|m-bed|m-night-\d|[sr]-bed-\d|[eb]-vanity_gen|[eb]-toilet_gen|b-tub-gen|o-table|o-chair-\d|o-planter-gen-\d)$/;
const liveRootOf = (o) => { for (let q = o; q; q = q.parent) if (LIVE_RX.test(q.name) && LIVEL[q.name]) return q; return null; };
const LIVE_SLOT = (n) => /^[sr]-bed/.test(n) ? 'beds' : /vanity_gen$/.test(n) ? 'vanities' : n === 'l-sofa' ? 'sofa' : n === 'l-coffee' ? 'coffee' : n === 'l-dining' ? 'dining' : n.startsWith('chair_') ? 'chairs' : n === 'm-bed' ? 'bedm' : n.startsWith('m-night') ? 'night' : '';
gltf.scene.traverse((o) => {
  if (!o.isMesh) return; const m = o.material;
  if (m && /^WALK3D_baked_(\d+)/.test(m.name)) {
    const k = Number(RegExp.$1), g = o.geometry, us = [g.attributes.uv, g.attributes.uv1].filter(Boolean);
    const isPart = (a) => { for (let i = 0; i < a.count; i += Math.max(1, Math.floor(a.count / 400))) { const x = a.getX(i), y = a.getY(i); if (Math.abs(y - 0.5) > 1e-4 || Math.abs(x - Math.floor(x) - 0.5) > 1e-3) return false; } return true; };
    const pa = us.find(isPart), ba = us.find((a) => a !== pa);
    const ids = new Float32Array(g.attributes.position.count); if (pa) for (let i = 0; i < ids.length; i++) ids[i] = Math.floor(pa.getX(i));
    g.setAttribute('aPart', new THREE.BufferAttribute(ids, 1)); g.setAttribute('aBake', ba);
    o.material = ATL[k]; m.dispose(); pickables.push(o);
  } else if (m && liveRootOf(o)) {
    const root = liveRootOf(o); o.material = itemMaterial(m, LIVEL[root.name], /^(l-sofa|chair_|m-bed|[sr]-bed)/.test(root.name) ? 1 : 0); liveBase.push({ root: root.name, obj: o, mat: o.material }); pickables.push(o);
  } else if (m && m.name === 'WALK3D_glass') { o.material = new THREE.MeshBasicMaterial({ color: 0xdfe8ec, transparent: true, opacity: 0.1, depthWrite: false }); o.renderOrder = 2; }
});
scene.add(gltf.scene);
// a soft mirror on the floor (desktop only): the oak of his pictures is a satin finish that reflects the windows and the furniture
let floorMirror = null;
if (!phone && !SHOT) {
  const xs = grid.rooms.flatMap((r) => r.loop.map((p) => p[0])), zs = grid.rooms.flatMap((r) => r.loop.map((p) => p[1]));
  const w = (Math.max(...xs) - Math.min(...xs)) / 100, d = (Math.max(...zs) - Math.min(...zs)) / 100;
  floorMirror = new Reflector(new THREE.PlaneGeometry(w, d), { textureWidth: Math.round(innerWidth * 0.5), textureHeight: Math.round(innerHeight * 0.5), color: 0x8a8580 });
  floorMirror.material.transparent = true; floorMirror.material.depthWrite = false;
  floorMirror.material.fragmentShader = floorMirror.material.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( base.rgb, 0.10 );');
  floorMirror.rotation.x = -Math.PI / 2; floorMirror.position.set((Math.min(...xs) + Math.max(...xs)) / 200, 0.003, (Math.min(...zs) + Math.max(...zs)) / 200); floorMirror.renderOrder = 1;
  scene.add(floorMirror);
}

// ---- the time of day: the keys that bracket the clock, mixed in linear light (each key's atlas saved at its own EV)
const keyLight = {};   // keyLight[key][partId] = mean light (for the swapped-in pieces)
keyLight[noonKey.name] = Object.fromEntries(PARTS.filter((p) => p.light).map((p) => [p.id, p.light])); keyLight[noonKey.name].live = LIVEL;
async function loadKey(k) {
  if (LT[k.name]) return; LT[k.name] = {};
  await Promise.all([...groups].map(async (g) => { LT[k.name][g] = await tex(`./model/dn/${k.name}/light_${g}.jpg`); }));
  try { keyLight[k.name] = await J(`./model/dn/${k.name}/parts_light.json`); } catch (_) { keyLight[k.name] = keyLight[noonKey.name]; }
}
let hour = Number(Q.get('h')) || noonKey.hour;
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const lerpHex = (a, b, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
function bracket(h) { let i = 0; while (i < KEYS.length - 2 && h >= KEYS[i + 1].hour) i++; const a = KEYS[i], b = KEYS[i + 1] || a; const t = b === a ? 0 : THREE.MathUtils.clamp((h - a.hour) / (b.hour - a.hour), 0, 1); return { a, b, t }; }
const keyMix = (pid) => { const { a, b, t } = bracket(hour); const A = (keyLight[a.name] || {})[pid], B = (keyLight[b.name] || {})[pid]; return A && B ? [0, 1, 2].map((c) => A[c] * (1 - t) + B[c] * t) : null; };
paintSky(noonKey.sky_colors[0], noonKey.sky_colors[1]);
function applyHour() {
  let { a, b, t } = bracket(hour);
  const ready = (k) => LT[k.name] && Object.keys(LT[k.name]).length === groups.size;
  if (!ready(a)) a = noonKey; if (!ready(b)) b = noonKey;
  const la = LT[a.name], lb = LT[b.name];
  if (!ready(a) || !ready(b)) return false;
  for (const g of groups) { ATL[g].uniforms.tLa.value = la[g]; ATL[g].uniforms.tLb.value = lb[g]; }
  MIX.t.value = t; MIX.gA.value = Math.pow(2, -a.export_ev); MIX.gB.value = Math.pow(2, -b.export_ev);
  G.expo.value = Math.pow(2, EV_DAY + a.disp_ev * (1 - t) + b.disp_ev * t); G.warm.value = 0.06 + 0.5 * Math.max(0, (hour - 15) / 6.5) * (hour < 21 ? 1 : 0.6);
  paintSky(lerpHex(a.sky_colors[0], b.sky_colors[0], t), lerpHex(a.sky_colors[1], b.sky_colors[1], t), lerpHex(a.sky_colors[2] || '#b9b6a6', b.sky_colors[2] || '#b9b6a6', t));
  for (const it of liveItems) { const l = slotLight(it.slot, keyMix); for (const q of it.mats) q.uniforms.lt.value.set(...l); }
  const floorL = (k) => { let s = [0, 0, 0], w = 0; for (const p of PARTS) if (p.piece === 'floor' && p.area > 0) { const L = (keyLight[k.name] || {})[p.id]; if (L) { for (let i = 0; i < 3; i++) s[i] += L[i] * p.area; w += p.area; } } return w ? s.map((v) => v / w) : [1, 1, 1]; };
  const fA = floorL(a), fB = floorL(b);
  for (const lb of liveBase) {   // the light a piece stands in, never below 55 % of the room floor's (the local mean includes its own shadow)
    const A = (keyLight[a.name] || {}).live?.[lb.root] || LIVEL[lb.root], B = (keyLight[b.name] || {}).live?.[lb.root] || LIVEL[lb.root];
    lb.mat.uniforms.lt.value.set(...[0, 1, 2].map((c) => Math.max(A[c], 0.95 * fA[c]) * (1 - t) + Math.max(B[c], 0.95 * fB[c]) * t)); }
  $('clock-t').textContent = hhmm(hour); $('clock-l').textContent = t < 0.5 ? a.label : b.label; $('clock-in').value = String(hour);
  for (const c of curtains) c.material.uniforms.lt.value.set(...slotLight('sofa', keyMix));
  return a.name === bracket(hour).a.name && b.name === bracket(hour).b.name;
}
$('clock-in').addEventListener('input', (e) => { hour = Number(e.target.value); if (!applyHour()) Promise.all(KEYS.map(loadKey)).then(applyHour); syncUrl(); });

// ---- the swapped-in pieces: the generated catalog (catalog.json, slots.json), lit from the baked light around their slot
const SLOT_LIGHT = { sofa: 'sofa', armchair: 'rug', coffee: 'coffee', dining: 'dining', chairs: 'chairs' };
function slotLight(slot, kl) {
  let s = [0, 0, 0], w = 0;
  for (const p of PARTS) if (p.piece === (SLOT_LIGHT[slot] || 'sofa') && p.area > 0) { const L = kl ? kl(p.id) : p.light; if (L) { for (let i = 0; i < 3; i++) s[i] += L[i] * p.area; w += p.area; } }
  return w ? s.map((v) => v / w) : [0.6, 0.58, 0.55];
}
const glbCache = {}, liveItems = [];
const itemGroup = new THREE.Group(); scene.add(itemGroup);
const dropSlot = (slot) => { for (let i = liveItems.length - 1; i >= 0; i--) if (liveItems[i].slot === slot) { itemGroup.remove(liveItems[i].obj); liveItems.splice(i, 1); } };
async function showItem(slot, id) {
  const it = CAT.items.find((x) => x.id === id), sl = SLOTS[slot]; if (!it || !sl) return;
  glbCache[id] ||= loader.loadAsync(`./catalog/${id}.glb`).then((g) => g.scene);
  const src = await glbCache[id];
  if ((curState()['slot:' + slot] || '') !== 'cat:' + id) return;   // the visitor moved on while it loaded
  dropSlot(slot);
  const L = slotLight(slot, keyMix), mats = [], obj = new THREE.Group(), sz = new THREE.Box3().setFromObject(src).getSize(new THREE.Vector3());
  for (const pl of sl.places) {
    const c = src.clone(true), s = Math.min(1, pl.w / Math.max(0.01, sz.x), pl.d / Math.max(0.01, sz.z));
    c.traverse((q) => { if (q.isMesh) { q.material = itemMaterial(q.material, L); mats.push(q.material); pickables.push(q); } });
    c.scale.setScalar(s); c.rotation.y = pl.rot; c.position.set(pl.x, 0, pl.z); obj.add(c);
  }
  itemGroup.add(obj); liveItems.push({ slot, id, obj, mats }); applyTint();
}
function applyTint() {
  const st = curState();
  for (const it of liveItems) {
    const pc = PIECE[it.slot], ch = pc && pc.channels && pc.channels[0], hex = ch && colourOf(ch, st[pc.id]);
    const mean = CAT.items.find((x) => x.id === it.id)?.mean || [0.6, 0.6, 0.6];
    const tint = hex ? lin(hex).map((v, i) => Math.min(3, v / Math.max(0.05, mean[i]))) : [1, 1, 1];
    for (const m of it.mats) m.uniforms.tint.value.set(...tint);
  }
}

// ---- sheer linen curtains at the living-room sliding door (slots.json curtains), folded cloth, translucent
const curtains = [];
for (const cu of (SLOTS.curtains || [])) {
  const W = cu.w, H = cu.h, segs = Math.max(8, Math.round(W / 0.05)), g = new THREE.PlaneGeometry(W, H, segs, 1), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / W) * Math.PI * 2 * (W / 0.12)) * 0.035);
  g.computeVertexNormals();
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { lt: { value: new THREE.Vector3(...slotLight('sofa')) }, ...G },
    vertexShader: `varying vec3 vN; varying vec2 vU; void main() { vN = normalize(mat3(modelMatrix) * normal); vU = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 lt; varying vec3 vN; varying vec2 vU; ${GRADE}
      void main() { float k = 0.82 + 0.18 * abs(vN.x + vN.z); vec3 a = vec3(0.86, 0.83, 0.77); gl_FragColor = vec4(grade(a * lt * 1.35 * k), 0.62 + 0.2 * (1.0 - vU.y) * 0.3); }` });
  const mesh = new THREE.Mesh(g, m); mesh.position.set(cu.x, cu.y + H / 2, cu.z); mesh.rotation.y = cu.rot; mesh.renderOrder = 3; scene.add(mesh); curtains.push(mesh);
}

// ---- the design state: { 'piece' | 'piece.channel': palette id | '#hex' | floor id, 'slot:x': 'cat:<id>' }
let state = {}, shown = null; const hist = [];
const BASE = D.base || {};
const curState = () => Object.assign({}, BASE, shown || state);
const chanOf = (key) => { const [pid, ch = 'main'] = key.split('.'); const p = PIECE[pid]; return p ? { p, c: (p.channels || []).find((c) => c.id === ch) } : null; };
const colourOf = (c, v) => { if (!v) return null; if (v.startsWith('#')) return v; const f = palette(c.palette).find((s) => s.id === v); return f ? f.hex : null; };
let doll = false;
function apply() {
  const st = curState(); partData.fill(0);
  for (const p of PARTS) { const o = p.id * 4; if (p.albedo) partData.set([...p.albedo], 3 * 64 * 4 + o); if (p.mat === 'lamp_warm') partData[3 * 64 * 4 + o + 3] = 1; }
  const setPart = (p, mode, rgb, r1, r2) => { const o = p.id * 4; partData.set([...(rgb || [0, 0, 0]), mode], o); if (r1) partData.set(r1, 64 * 4 + o); if (r2) partData.set([...r2, 0], 2 * 64 * 4 + o); };
  for (const [key, val] of Object.entries(st)) {
    if (key.includes(':')) continue;
    const cc = chanOf(key); if (!cc || !cc.c) continue;
    if (cc.c.finish === 'floor') {
      const f = D.floors.find((x) => x.id === (val === 'orig' ? BASE[key] : val)); if (!f || !f.mode) continue;
      for (const p of partsOf(cc.p.id, cc.c.mats)) setPart(p, f.mode === 'tile' ? 3 : 4, lin(f.hex), [f.size || 0.8, f.len || f.size || 0.8, 0, 0], lin(f.grout || f.hex));
    } else { const hex = colourOf(cc.c, val); if (hex) for (const p of partsOf(cc.p.id, cc.c.mats)) setPart(p, 1, lin(hex)); }
  }
  for (const slot of Object.keys(SLOTS)) {
    const v = st['slot:' + slot] || '';
    if (v.startsWith('cat:')) { for (const p of partsOf(slot)) setPart(p, 5); if (!liveItems.some((i) => i.slot === slot && 'cat:' + i.id === v)) showItem(slot, v.slice(4)); }
    else dropSlot(slot);
  }
  for (const lb of liveBase) {   // a swapped slot hides his piece; a colour tints it
    const slot = LIVE_SLOT(lb.root), v = st['slot:' + slot] || ''; lb.obj.visible = !v.startsWith('cat:');
    const pc = PIECE[slot], ch = pc && pc.channels && pc.channels[0], hex = ch && colourOf(ch, st[pc.id]), mean = (CAT.base || {})[slot] || [0.6, 0.6, 0.6];
    lb.mat.uniforms.tint.value.set(...(hex ? lin(hex).map((v, i) => Math.min(3, v / Math.max(0.05, mean[i]))) : [1, 1, 1]));
  }
  if (doll) for (const p of partsOf('ceiling')) setPart(p, 5);
  partTex.needsUpdate = true; applyTint(); renderUI();
}
const commit = () => { apply(); syncUrl(); };
function change(fn) { hist.push(JSON.stringify(state)); shown = null; fn(state); for (const k of Object.keys(state)) if (state[k] == null || state[k] === '' || state[k] === 'orig') delete state[k]; commit(); }
function syncUrl() { const q = new URLSearchParams(location.search); if (Math.abs(hour - noonKey.hour) > 0.01) q.set('h', String(hour)); else q.delete('h'); const qs = q.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + (Object.keys(state).length ? '#d=' + encodeURIComponent(JSON.stringify(state)) : '')); }
try { const m = /#d=(.+)$/.exec(location.hash); if (m) state = JSON.parse(decodeURIComponent(m[1])); } catch (_) { state = {}; }

// ---- the visitor
const me = { x: grid.start.x / 100, z: grid.start.y / 100, yaw: -THREE.MathUtils.degToRad(grid.start.yaw_deg), pitch: -0.03, dist: 0 };
// the most open direction from a standing point (a room jump and a thumbnail look the long way into the room)
const openYaw = (x, z) => { let best = 0, bl = -1; for (let a = 0; a < 32; a++) { const yw = a * Math.PI / 16, dx = -Math.sin(yw), dz = -Math.cos(yw); let l = 0; while (l < 8 && ok(x + dx * l, z + dz * l)) l += 0.1; if (l > bl) { bl = l; best = yw; } } return best; };
{ const at = grid.cameras.find((c) => c.id === Q.get('at'));
  if (at) { me.x = at.x / 100; me.z = at.y / 100; me.pitch = -0.06; } if (Q.has('yaw')) me.yaw = -THREE.MathUtils.degToRad(Number(Q.get('yaw'))); }
const keys = new Set(); let moving = 0;
const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
addEventListener('keydown', (e) => { if (typing(e)) return; if (e.key === 'Escape') closeAll(); if (e.key.startsWith('Arrow') || 'wasdWASD'.includes(e.key)) { keys.add(e.key.toLowerCase()); e.preventDefault(); } });
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase())); addEventListener('blur', () => keys.clear());
const orbit = { th: 0.6, ph: 0.95, r: 15, tx: 0, tz: 0 };
{ const xs = grid.rooms.flatMap((r) => r.loop.map((p) => p[0])), zs = grid.rooms.flatMap((r) => r.loop.map((p) => p[1])); orbit.tx = (Math.min(...xs) + Math.max(...xs)) / 200; orbit.tz = (Math.min(...zs) + Math.max(...zs)) / 200; }
let drag = null, walkIn = 0, turnIn = 0;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => { closeMenus(); drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, t: performance.now(), touch: e.pointerType !== 'mouse', far: false }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.far = true;
  if (doll) { orbit.th -= (e.clientX - drag.lx) * 0.006; orbit.ph = THREE.MathUtils.clamp(orbit.ph - (e.clientY - drag.ly) * 0.005, 0.25, 1.35); }
  else { const k = drag.touch ? 1.25 : 1; me.yaw -= (e.clientX - drag.lx) * 0.0042 * k; me.pitch = THREE.MathUtils.clamp(me.pitch - (e.clientY - drag.ly) * 0.0035 * k, -1.1, 0.9); }
  drag.lx = e.clientX; drag.ly = e.clientY;
});
const up = (e) => { if (drag && e.pointerId === drag.id) { const tap = !drag.far && performance.now() - drag.t < 450; drag = null; if (tap && e.type === 'pointerup') onTap(e.clientX, e.clientY); } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', (e) => { if (doll) orbit.r = THREE.MathUtils.clamp(orbit.r * (1 + Math.sign(e.deltaY) * 0.1), 6, 30); else zoom(Math.sign(e.deltaY) * 4); e.preventDefault(); }, { passive: false });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
// the first look into a room: towards its furniture (the rings of that room), else the most open direction
const lookYaw = (x, z) => { const ro = roomObj(x, z); const qs = ro ? ANCH.filter((q) => q.room === ro.id) : [];
  if (!qs.length) return openYaw(x, z); const cx = qs.reduce((s, q) => s + q.x, 0) / qs.length, cz = qs.reduce((s, q) => s + q.z, 0) / qs.length;
  if (Math.hypot(cx - x, cz - z) < 0.4) return openYaw(x, z); return Math.atan2(-(cx - x), -(cz - z)); };
const goTo = (x, z, yaw) => { const p = nearestFree(x, z); if (!p) return false; me.x = p[0]; me.z = p[1]; me.yaw = yaw ?? lookYaw(p[0], p[1]); me.pitch = -0.06; return true; };
if (Q.get('at') && !Q.has('yaw')) me.yaw = lookYaw(me.x, me.z);
const zoom = (d) => { camera.fov = THREE.MathUtils.clamp(camera.fov + d, 38, 90); camera.updateProjectionMatrix(); };

// ---- the rooms: thumbnails + the pill (the tour's strip)
const CAMS = grid.cameras;
let roomIdx = 0;
CAMS.forEach((c, i) => {
  const b = el('button', { class: 'th', type: 'button', 'aria-label': c.he, style: `background-image:url(./thumbs/${c.id}.jpg)` }, [el('i', { text: String(i + 1).padStart(2, '0') }), el('b', { text: c.he })]);
  b.addEventListener('click', () => jump(i)); $('strip').append(b);
});
function jump(i) { document.body.classList.remove("strip-on"); roomIdx = (i + CAMS.length) % CAMS.length; const c = CAMS[roomIdx]; setDoll(false); goTo(c.x / 100, c.y / 100); roomShown = ''; }
$('p-next').addEventListener('click', () => jump(roomIdx + 1)); $('p-prev').addEventListener('click', () => jump(roomIdx - 1));


// ---- the arrow pad (phone, Eliran 2026-11-18 «אולי צריך להוסיף חיצים»): hold to walk / turn; the knob gives a smooth speed
{ const pd = $('pad'), kn = pd.querySelector('i'); let pid = null;
  const set = (e) => { const r = pd.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const m = Math.hypot(dx, dy), R = r.width / 2 - 20; if (m > R) { dx *= R / m; dy *= R / m; }
    kn.style.transform = `translate(${dx}px,${dy}px)`; const fx = dx / R, fy = -dy / R; walkIn = Math.abs(fy) < 0.18 ? 0 : fy; turnIn = Math.abs(fx) < 0.18 ? 0 : fx * 0.8; };
  const end = (e) => { if (e.pointerId !== pid) return; pid = null; pd.classList.remove('on'); kn.style.transform = ''; walkIn = 0; turnIn = 0; };
  pd.addEventListener('pointerdown', (e) => { closeMenus(); pid = e.pointerId; pd.setPointerCapture(pid); pd.classList.add('on'); set(e); e.preventDefault(); });
  pd.addEventListener('pointermove', (e) => { if (e.pointerId === pid) set(e); });
  pd.addEventListener('pointerup', end); pd.addEventListener('pointercancel', end);
  pd.addEventListener('contextmenu', (e) => e.preventDefault()); }
// the room strip and the clock on demand (phone)
$('p-name').parentElement.addEventListener('click', () => document.body.classList.toggle('strip-on'));
// ---- taps: the tape measure, the view from above (a tap on the floor walks there)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const isShown = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return o.parent ? true : false; };
const hit = (cx, cy) => { ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(pickables.filter(isShown), false)[0] || null; };
const meas = { on: false, pts: [], dots: [], line: null };
function onTap(cx, cy) {
  if (meas.on) {
    const h = hit(cx, cy); if (!h) return;
    if (meas.pts.length >= 2) clearMeasure();
    meas.pts.push(h.point.clone());
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 8), new THREE.MeshBasicMaterial({ color: 0xeea927, depthTest: false })); d.position.copy(h.point); d.renderOrder = 9; scene.add(d); meas.dots.push(d);
    if (meas.pts.length === 2) { meas.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(meas.pts), new THREE.LineBasicMaterial({ color: 0xeea927, depthTest: false })); meas.line.renderOrder = 9; scene.add(meas.line);
      $('mlabel').textContent = `${Math.round(meas.pts[0].distanceTo(meas.pts[1]) * 100)} ס"מ`; $('mlabel').classList.remove('hidden'); }
    else toast('בחרו נקודה שנייה');
    return;
  }
  if (doll) { const h = hit(cx, cy); if (h && goTo(h.point.x, h.point.z)) setDoll(false); }
}
function clearMeasure() { for (const d of meas.dots) scene.remove(d); if (meas.line) scene.remove(meas.line); meas.pts = []; meas.dots = []; meas.line = null; $('mlabel').classList.add('hidden'); }
function setMeasure(on) { meas.on = on; if (!on) clearMeasure(); else { closeAll(); toast('לחצו על שתי נקודות במודל כדי למדוד'); } renderMenus(); }
function setDoll(on) { if (doll === on) return; doll = on; document.body.classList.toggle('doll', on); if (on) { orbit.th = me.yaw + Math.PI; closeAll(); toast('גררו כדי לסובב · לחיצה על הרצפה מכניסה לשם'); } roomShown = ''; apply(); renderMenus(); }

// ---- the header menus (the tour's «סגנונות צפייה», «כלי עזר», «שינוי עיצוב»)
function placeMenu(menu, btn) { const r = btn.getBoundingClientRect(), w = Math.max(230, menu.offsetWidth); menu.style.left = `${Math.round(Math.min(Math.max(12, r.right - w), innerWidth - w - 12))}px`; if (phone) { menu.style.top = 'auto'; menu.style.bottom = `${Math.round(innerHeight - r.top + 8)}px`; } else { menu.style.bottom = 'auto'; menu.style.top = `${Math.round(r.bottom + 8)}px`; } }
function toggleMenu(name) { const m = $('menu-' + name), b = $('m-' + name), open = m.classList.contains('hidden'); closeAll(); if (open) { m.classList.remove('hidden'); b.setAttribute('aria-expanded', 'true'); placeMenu(m, b); } }
function closeMenus() { for (const n of ['view', 'tools']) { $('menu-' + n).classList.add('hidden'); $('m-' + n).setAttribute('aria-expanded', 'false'); } }
function renderMenus() { for (const b of $('menu-view').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === (doll ? 'doll' : !$('plan').classList.contains('hidden') ? 'plan' : 'walk'))); $('menu-tools').querySelector('[data-t="measure"]').setAttribute('aria-pressed', String(meas.on)); }
$('m-view').addEventListener('click', () => toggleMenu('view')); $('m-tools').addEventListener('click', () => toggleMenu('tools'));
$('menu-view').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; closeMenus(); if (b.dataset.v === 'plan') { setDoll(false); openSheet('plan'); } else { closeAll(); setDoll(b.dataset.v === 'doll'); } renderMenus(); });
$('menu-tools').addEventListener('click', async (e) => { const b = e.target.closest('button'); if (!b) return; closeMenus();
  if (b.dataset.t === 'measure') setMeasure(!meas.on);
  else if (b.dataset.t === 'clock') { b.setAttribute('aria-pressed', String(document.body.classList.toggle('clock-on'))); }
  else if (b.dataset.t === 'level') { me.pitch = -0.03; camera.fov = FOV0; camera.updateProjectionMatrix(); }
  else if (b.dataset.t === 'share') { syncUrl(); try { await navigator.clipboard.writeText(location.href); toast('הקישור לעיצוב הזה הועתק'); } catch (_) { toast('הקישור נמצא בשורת הכתובת'); } } });
$('z-in').addEventListener('click', () => zoom(-6)); $('z-out').addEventListener('click', () => zoom(6));
$('r-level').addEventListener('click', () => { me.pitch = -0.03; camera.fov = FOV0; camera.updateProjectionMatrix(); });
$('r-full').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => {}); });
$('b-help').addEventListener('click', () => hint(true));

// ---- the rings on the pieces + the catalog bar (the tour: a ring -> «בחרו פריט במקום …» with product tiles)
const ringNodes = ANCH.filter((q) => PIECE[q.piece] && PIECE[q.piece].ring).map((q) => {
  const p = PIECE[q.piece], a = new THREE.Vector3(q.x, q.y, q.z);
  const b = el('button', { class: 'ring', type: 'button', 'aria-label': `החלפת ${p.he}` }, [el('i'), el('b', { text: p.he })]);
  b.addEventListener('click', (e) => { e.stopPropagation(); openCat(p.id); });
  $('rings').append(b); return { p, a, b, zone: OPEN.has(q.room) ? 'open' : q.room };
});
const v3 = new THREE.Vector3();
let catPiece = null;
function placeRings() {
  const myZone = zoneOf(me.x, me.z), cam = camera.position;
  for (const r of ringNodes) {
    let vis = !SHOT && !doll && !meas.on && (r.zone === myZone || (myZone === '' && cam.distanceTo(r.a) < 4)) && cam.distanceTo(r.a) < 8.5;
    if (vis) { v3.copy(r.a).project(camera); vis = v3.z < 1 && Math.abs(v3.x) < 0.96 && Math.abs(v3.y) < 0.9; }
    r.b.style.display = vis ? '' : 'none';
    if (vis) { r.b.style.left = `${((v3.x + 1) / 2) * innerWidth}px`; r.b.style.top = `${((1 - v3.y) / 2) * innerHeight}px`; }
    r.b.classList.toggle('on', catPiece === r.p.id);
  }
}
const DEF = (he) => (he.startsWith('ה') ? he : 'ה' + he.replace(/^(שולחן|כיסאות|מיטה|ארונות|חזיתות)/, (m) => m));
function openCat(pid) {
  const p = PIECE[pid]; if (!p) return; closeAll('cat'); catPiece = pid;
  const slot = p.slot, items = CAT.items.filter((i) => i.slot === slot), cur = state['slot:' + slot] || '';
  $('cat-lab').textContent = items.length ? `בחרו פריט במקום ${p.he}` : `${p.he} · צבע וגימור`;
  const row = $('cat-row'); row.replaceChildren(); row.parentElement.classList.toggle('hidden', !items.length);
  if (items.length) {
    const none = !partsOf(slot).length && !liveBase.some((lb) => LIVE_SLOT(lb.root) === slot);   // a slot with nothing in the pictures (the armchair): «בלי»
    const orig = el('button', { class: 'tile', type: 'button', 'aria-pressed': String(!cur) }, [el('div', { class: 'im', style: none ? '' : `background-image:url(./thumbs/piece-${slot}.jpg)`, text: none ? 'בלי' : '' }), el('span', { text: none ? `בלי ${p.he}` : 'כמו בתמונות' })]);
    orig.addEventListener('click', () => change((s) => { delete s['slot:' + slot]; })); row.append(orig);
    for (const it of items) {
      const t = el('button', { class: 'tile', type: 'button', 'aria-pressed': String(cur === 'cat:' + it.id), title: it.he }, [el('div', { class: 'im', style: `background-image:url(./catalog/${it.id}.jpg)` }), el('span', { text: it.he })]);
      t.addEventListener('click', () => change((s) => { s['slot:' + slot] = 'cat:' + it.id; })); row.append(t);
    }
  }
  const sw = $('cat-sw'); sw.replaceChildren();
  for (const c of (p.channels || []).filter((c) => !c.finish)) {
    const key = c.id === 'main' ? pid : `${pid}.${c.id}`;
    const o = el('button', { class: 'sw orig', type: 'button', title: 'צבע מקורי', 'aria-label': 'צבע מקורי', 'aria-pressed': String(!state[key]) }); o.addEventListener('click', () => change((s) => { delete s[key]; })); sw.append(o);
    for (const s_ of palette(c.palette)) { const b = el('button', { class: 'sw', type: 'button', title: `${c.he === 'צבע' ? '' : c.he + ': '}${s_.he}`, 'aria-label': s_.he, 'aria-pressed': String(state[key] === s_.id || state[key] === s_.hex), style: `background:${s_.hex}` }); b.addEventListener('click', () => change((s) => { s[key] = s_.id; })); sw.append(b); }
  }
  $('cat').classList.remove('hidden');
}
$('cat-x').addEventListener('click', () => closeAll());

// ---- the design panel (the tour's «שינוי עיצוב»)
const EXAMPLES = ['ספת עור ורצפת עץ אגוז', 'קירות בצבע שמנת', 'מטבח כחול כהה עם משטח שחור', 'סגנון סקנדינבי', 'כורסת קטיפה', 'שקיעה'];
$('examples').replaceChildren(...EXAMPLES.map((t) => el('button', { class: 'chip', type: 'button', text: t, onclick: () => { $('free-in').value = t; runText(t); } })));
function chips(row, items, cur, pick) { row.replaceChildren(...items.map((it) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(it.id === cur), text: it.he, onclick: () => pick(it.id) }))); }
function swatches(row, pal, cur, pick) {
  const o = el('button', { class: 'sw orig', type: 'button', title: 'כמו בתמונות', 'aria-label': 'כמו בתמונות', 'aria-pressed': String(!cur), onclick: () => pick(null) });
  row.replaceChildren(o, ...palette(pal).map((s) => el('button', { class: 'sw', type: 'button', title: s.he, 'aria-label': s.he, 'aria-pressed': String(s.id === cur || s.hex === cur), style: `background:${s.hex}`, onclick: () => pick(s.id) })));
}
const setFloor = (s, id) => { s.floor = id; s.floorm = id; s.floorb = id; };
function styleState(st) { const o = {}; for (const [k, v] of Object.entries(st.set || {})) { if (k === 'floor') setFloor(o, v); else o[k] = v; } return o; }
function renderDesign() {
  const cur = D.styles.find((s) => JSON.stringify(styleState(s)) === JSON.stringify(state));
  chips($('d-style'), D.styles, cur ? cur.id : (Object.keys(state).length ? '' : 'orig'), (id) => change((s) => { for (const k of Object.keys(s)) delete s[k]; Object.assign(s, styleState(D.styles.find((x) => x.id === id))); }));
  chips($('d-floor'), D.floors, state.floor || 'orig', (id) => change((s) => setFloor(s, id)));
  swatches($('d-walls'), 'wall', state.walls, (id) => change((s) => { s.walls = id; }));
  swatches($('d-kitchen'), 'front', state.kitchen, (id) => change((s) => { s.kitchen = id; }));
  swatches($('d-ktop'), 'stone', state['kitchen.top'], (id) => change((s) => { s['kitchen.top'] = id; }));
  const fl = D.floors.find((f) => f.id === state.floor); $('d-state').textContent = fl && fl.mode ? fl.he.split(' ')[0] : (Object.keys(state).length ? 'מותאם' : ''); $('d-state').classList.toggle('hidden', !$('d-state').textContent);
}
$('m-design').addEventListener('click', () => { if ($('design').classList.contains('hidden')) { closeAll('design'); $('design').classList.remove('hidden'); $('m-design').setAttribute('aria-expanded', 'true'); if (!phone) $('free-in').focus(); } else closeAll(); });
$('design-x').addEventListener('click', () => closeAll());
$('free').addEventListener('submit', (e) => { e.preventDefault(); runText($('free-in').value); });

// ---- the free-text line: read here, in the page, into changes of the model (nothing is generated)
const COLORS = [
  [/(^|\s)(ו?ה?)(לבנ|לבן|white)/, '#ecebe7', 'לבן'], [/(שחור|black)/, '#2b2a29', 'שחור'], [/(אפור|grey|gray)/, '#8d8c88', 'אפור'], [/(כחול|נייבי|navy|blue)/, '#2f3e57', 'כחול'],
  [/(תכלת|light blue)/, '#9db7cc', 'תכלת'], [/(טורקיז|turquoise|teal)/, '#3f8a8c', 'טורקיז'], [/(ירוק|מרווה|green|sage)/, '#7f8f78', 'ירוק'], [/(זית|olive)/, '#6f6d3f', 'זית'],
  [/(אדום|בורדו|red|burgundy)/, '#8c2f2f', 'אדום'], [/(ורוד|pink|blush)/, '#c9a19a', 'ורוד'], [/(צהוב|yellow)/, '#d8b740', 'צהוב'], [/(חרדל|mustard)/, '#c99a2e', 'חרדל'],
  [/(כתום|orange)/, '#c56a32', 'כתום'], [/(טרקוטה|חימר|terracotta|clay)/, '#b0623f', 'טרקוטה'], [/(סגול|purple|lilac)/, '#6c5a7c', 'סגול'], [/(בז'|בז |בז$|beige)/, '#d6c7ae', "בז'"],
  [/(שמנת|קרם|cream|ivory)/, '#e6dcc8', 'שמנת'], [/(חול|sand)/, '#c7b293', 'חול'], [/(פשתן|linen)/, '#d8d1c4', 'פשתן'], [/(גרייז|greige|taupe)/, '#aca395', "גרייז'"],
  [/(חום|brown)/, '#6b4a34', 'חום'], [/(אגוז|walnut)/, '#5e4130', 'אגוז'], [/(אלון|oak)/, '#a8875f', 'אלון'], [/(זהב|פליז|brass|gold)/, '#b08d4a', 'פליז'], [/(נחושת|copper)/, '#a5643c', 'נחושת'],
];
const firstColour = (seg) => { let best = null, bi = 1e9; for (const c of COLORS) { const m = c[0].exec(seg); if (m && m.index < bi) { bi = m.index; best = c; } } return best; };
const STYLE_WORDS = [[/(סקנדינבי|נורדי|scandi)/, 'scandi'], [/(כהה ואלגנט|אלגנט|יוקרתי|luxury|elegant|dark)/, 'dark'], [/(עץ חם|חמים|כפרי|rustic|warm)/, 'warm'], [/(טבעי|בוטני|natural|green style)/, 'nature'], [/(מודרני|מינימליסט|בהיר|modern|minimal|light)/, 'light']];
const STRUCT = /(להזיז|הזז|הורד|להוריד|להרוס|הרוס|תגדיל|להגדיל|תקטין|להקטין|חלון חדש|חלון גדול|חדר נוסף|move the wall|remove the wall|bigger window|add a room)/;
const HOURS = [[/(בוקר|morning|sunrise|זריחה)/, 7.5, 'בוקר'], [/(צהריים|noon|midday)/, 12.5, 'צהריים'], [/(שקיעה|ערב|sunset|evening|golden)/, 17.5, 'שקיעה'], [/(לילה|night)/, 21.5, 'לילה']];
const CAT_WORDS = { sofa_boucle: /(בוקלה|boucle|מעוגל)/, sofa_leather: /(עור|leather|קוניאק)/, sofa_linen: /(פשתן|linen)/, arm_boucle: /(בוקלה|boucle|עגול)/, arm_oak_cane: /(קש|ראטן|קנה|cane|rattan)/, arm_velvet: /(קטיפה|velvet)/,
  coffee_travertine: /(טרוורטין|travertine|אבן)/, coffee_walnut: /(אגוז|walnut|אובלי)/, dining_oak_oval: /(אובלי|oval)/, dining_marble: /(שיש|marble)/, chair_oak_boucle: /(בוקלה|boucle)/, chair_black_cane: /(קש|cane|שחור)/ };
const TARGETS = D.pieces.flatMap((p) => (p.words || []).map((w) => ({ w, pid: p.id }))).concat([{ w: 'פרקט', pid: 'floor' }, { w: 'קרמיקה', pid: 'bathwalls' }, { w: 'משטח', pid: 'kitchen', ch: 'top' }, { w: 'worktop', pid: 'kitchen', ch: 'top' }]).sort((a, b) => b.w.length - a.w.length);
function floorFor(t) {
  if (/(עץ|פרקט|wood|parquet|אלון|oak)/.test(t)) return /(בהיר|light)/.test(t) ? 'lightoak' : /(אגוז|כהה|walnut|dark)/.test(t) ? 'walnut' : 'oak';
  if (/(בטון|concrete)/.test(t)) return 'concrete'; if (/(בז'|חול|beige|120)/.test(t)) return 'p120-beige'; if (/(כהה|שחור|dark|black)/.test(t)) return 'p80-dark';
  if (/(אפור|grey|gray)/.test(t)) return 'p80-grey'; if (/(לבן|בהיר|white|light)/.test(t)) return 'p80-light'; if (/(מקור|כמו בתמונות|original)/.test(t)) return 'orig'; return null;
}
function focusPiece() { let best = null, bd = 1e9; for (const r of ringNodes) if (r.b.style.display !== 'none') { v3.copy(r.a).project(camera); const d = Math.hypot(v3.x, v3.y); if (d < bd) { bd = d; best = r.p.id; } } return best; }
function parse(text) {
  const t = ' ' + text.trim().toLowerCase().replace(/[.,;!?:]+/g, ' , ') + ' ', ops = [], said = [];
  if (!text.trim()) return { ops, said: ['כתבו מה לשנות, למשל: ספת עור'] };
  if (STRUCT.test(t)) return { ops, said: ['המבנה נשאר לפי תכנית המכר. אפשר לשנות צבעים, גימורים, ריצוף וריהוט.'], refused: true };
  if (/(איפוס|אפס|כמו במקור|כמו בתמונות|תחזיר הכל|reset|original)/.test(t)) return { ops: [(s) => { for (const k of Object.keys(s)) delete s[k]; }], said: ['חזרה להדמיה המקורית'] };
  for (const [rx, h, he] of HOURS) if (rx.test(t)) { ops.push(() => { hour = h; Promise.all(KEYS.map(loadKey)).then(() => { applyHour(); syncUrl(); }); }); said.push('שעה: ' + he); break; }
  const hits = []; let rest = t;
  for (const { w, pid, ch } of TARGETS) { let i = rest.indexOf(w); while (i >= 0) { hits.push({ i, pid, w, ch }); rest = rest.slice(0, i) + ' '.repeat(w.length) + rest.slice(i + w.length); i = rest.indexOf(w); } }
  hits.sort((a, b) => a.i - b.i);
  for (let k = 0; k < hits.length; k++) {
    const h = hits[k], seg = t.slice(h.i + h.w.length, k + 1 < hits.length ? hits[k + 1].i : t.length), p = PIECE[h.pid];
    if (h.pid === 'floor' || h.pid === 'floorm') { const f = floorFor(h.w === 'פרקט' ? 'פרקט ' + seg : seg); if (f) { ops.push((s) => setFloor(s, f)); said.push('ריצוף: ' + D.floors.find((x) => x.id === f).he); continue; } }
    let swapped = false;
    if (p.slot) for (const it of CAT.items.filter((i) => i.slot === p.slot)) if (CAT_WORDS[it.id] && CAT_WORDS[it.id].test(seg)) { ops.push((s) => { s['slot:' + p.slot] = 'cat:' + it.id; }); said.push(it.he); swapped = true; break; }
    const c = firstColour(seg), ch = (p.channels || []).find((x) => (h.ch ? x.id === h.ch : x.id === 'main') && !x.finish);
    if (c && ch && !(swapped && /(עור|אגוז|אלון|שחור|פשתן)/.test(seg))) { const key = ch.id === 'main' ? p.id : `${p.id}.${ch.id}`, hex = shade(c[1], seg); ops.push((s) => { s[key] = hex; }); said.push(`${ch.id === 'top' ? 'משטח המטבח' : p.he}: ${c[2]}`); }
  }
  if (!hits.length && !ops.length) {
    const st = STYLE_WORDS.find(([rx]) => rx.test(t));
    if (st) { const s0 = D.styles.find((s) => s.id === st[1]); ops.push((s) => { for (const k of Object.keys(s)) delete s[k]; Object.assign(s, styleState(s0)); }); said.push('סגנון: ' + s0.he); }
    else { const c = firstColour(t), fp = focusPiece(); if (c && fp) { const p = PIECE[fp], ch = (p.channels || []).find((x) => !x.finish); if (ch) { ops.push((s) => { s[ch.id === 'main' ? p.id : `${p.id}.${ch.id}`] = shade(c[1], t); }); said.push(`${p.he} (הפריט שמולכם): ${c[2]}`); } } }
  }
  if (!ops.length) said.push('לא הבנתי מה לשנות. נסו למשל: «ספת עור», «רצפת עץ», «קירות שמנת», «שקיעה».');
  return { ops, said };
}
function shade(hex, seg) { const k = /(כהה|dark)/.test(seg) ? 0.62 : /(בהיר|light|pastel|פסטל)/.test(seg) ? 1.35 : 1; if (k === 1) return hex; const c = [1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); }
function runText(text) { const r = parse(text); if (r.ops.length) change((s) => { for (const op of r.ops) op(s); }); $('say').textContent = (r.ops.length ? 'בוצע: ' : '') + r.said.join(' · '); }

// ---- undo, before/after, reset
$('b-undo').addEventListener('click', () => { if (!hist.length) return; state = JSON.parse(hist.pop()); shown = null; commit(); });
$('b-compare').addEventListener('click', () => { shown = shown ? null : {}; apply(); });
$('b-reset').addEventListener('click', () => change((s) => { for (const k of Object.keys(s)) delete s[k]; }));
function renderUI() {
  const n = Object.keys(state).length;
  $('acts').classList.toggle('hidden', !n && !hist.length);
  $('b-undo').disabled = !hist.length; $('n-changes').textContent = n ? String(n) : ''; $('n-changes').classList.toggle('hidden', !n);
  $('b-compare').setAttribute('aria-pressed', String(Boolean(shown))); $('b-compare').querySelector('.lbl').textContent = shown ? 'מציג: לפני' : 'לפני / אחרי';
  renderDesign(); if (catPiece && !$('cat').classList.contains('hidden')) openCat(catPiece);
}
let toastT = 0; function toast(s) { let n = document.querySelector('.toast'); if (!n) { n = el('div', { class: 'toast glass', role: 'status' }); document.body.append(n); } n.textContent = s; n.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => n.classList.add('hidden'), 2600); }
function closeAll(keep) { closeMenus(); for (const id of ['cat', 'design', 'plan']) if (id !== keep) $(id).classList.add('hidden'); if (keep !== 'cat') catPiece = null; $('m-design').setAttribute('aria-expanded', String(keep === 'design')); renderMenus(); }
function openSheet(id) { closeAll(id); $(id).classList.remove('hidden'); renderMenus(); }
let hintT = 0; function hint(force) { const h = $('hint'); h.textContent = phone ? 'החזיקו חץ כדי ללכת · גררו אצבע כדי להסתכל · נגיעה בשם החדר פותחת את החדרים' : 'חיצים או WASD להליכה · גרירה בעכבר להסתכלות · לחיצה על עיגול מחליפה פריט'; h.style.opacity = '1'; clearTimeout(hintT); hintT = setTimeout(() => { h.style.opacity = '0'; }, force ? 5000 : 7000); }

// ---- the plan sheet
const pc = $('plan-c'), pg = pc.getContext('2d');
const PB = (() => { const xs = grid.rooms.flatMap((r) => r.loop.map((p) => p[0])), ys = grid.rooms.flatMap((r) => r.loop.map((p) => p[1])); const x0 = Math.min(...xs) - 30, y0 = Math.min(...ys) - 30, w = Math.max(...xs) + 30 - x0, h = Math.max(...ys) + 30 - y0; const s = Math.min(pc.width / w, pc.height / h); return { x0, y0, s, ox: (pc.width - w * s) / 2, oy: (pc.height - h * s) / 2 }; })();
const P2C = (x, y) => [PB.ox + (x - PB.x0) * PB.s, PB.oy + (y - PB.y0) * PB.s];
function drawPlan() {
  if ($('plan').classList.contains('hidden')) return;
  pg.clearRect(0, 0, pc.width, pc.height);
  const here = roomObj(me.x, me.z)?.id;
  for (const r of grid.rooms) { pg.beginPath(); r.loop.forEach((p, i) => { const [x, y] = P2C(...p); i ? pg.lineTo(x, y) : pg.moveTo(x, y); }); pg.closePath(); pg.fillStyle = r.id === here ? 'rgba(238,169,39,0.28)' : 'rgba(249,246,243,0.07)'; pg.fill(); pg.strokeStyle = 'rgba(249,246,243,0.55)'; pg.lineWidth = 2; pg.stroke(); }
  pg.fillStyle = '#f9f6f3'; pg.font = '600 15px Heebo, system-ui'; pg.textAlign = 'center';
  const seen = new Set(); for (const c of CAMS) { const r = grid.rooms.find((q) => inPoly(c.x, c.y, q.loop)); if (r && seen.has(r.he)) continue; if (r) seen.add(r.he); const [x, y] = P2C(c.x, c.y); pg.fillText(c.he, x, y - 12); }
  const [mx, my] = P2C(me.x * 100, me.z * 100), dir = -me.yaw - Math.PI / 2;
  pg.beginPath(); pg.moveTo(mx, my); pg.arc(mx, my, 48, dir - 0.6, dir + 0.6); pg.closePath(); pg.fillStyle = 'rgba(238,169,39,0.35)'; pg.fill();
  pg.beginPath(); pg.arc(mx, my, 8, 0, Math.PI * 2); pg.fillStyle = '#eea927'; pg.fill(); pg.strokeStyle = '#1a1713'; pg.lineWidth = 3; pg.stroke();
}
pc.addEventListener('click', (e) => { const r = pc.getBoundingClientRect(), cx = (e.clientX - r.left) * pc.width / r.width, cy = (e.clientY - r.top) * pc.height / r.height; const x = (cx - PB.ox) / PB.s + PB.x0, y = (cy - PB.oy) / PB.s + PB.y0; setDoll(false); if (!goTo(x / 100, y / 100)) toast('אי אפשר לעמוד שם'); });
$('plan-x').addEventListener('click', () => closeAll());

// ---- the loop
const sm = { f: 0, t: 0 }; const BOBK = phone ? 0 : 1;
function step(dt) {
  const k = (n) => keys.has(n);
  const fwd = (k('arrowup') || k('w') ? 1 : 0) - (k('arrowdown') || k('s') ? 1 : 0) + walkIn;
  const turn = (k('arrowright') || k('d') ? 1 : 0) - (k('arrowleft') || k('a') ? 1 : 0) + turnIn;
  if (doll) {
    orbit.th -= THREE.MathUtils.degToRad(TURN) * THREE.MathUtils.clamp(turn, -1, 1) * dt; orbit.r = THREE.MathUtils.clamp(orbit.r - fwd * 6 * dt, 6, 30);
    camera.position.set(orbit.tx + orbit.r * Math.sin(orbit.ph) * Math.sin(orbit.th), orbit.r * Math.cos(orbit.ph), orbit.tz + orbit.r * Math.sin(orbit.ph) * Math.cos(orbit.th));
    camera.lookAt(orbit.tx, 0, orbit.tz); return;
  }
  const ease = 1 - Math.exp(-dt * 7); sm.f += (THREE.MathUtils.clamp(fwd, -1, 1) - sm.f) * ease; sm.t += (THREE.MathUtils.clamp(turn, -1, 1) - sm.t) * ease;
  if (Math.abs(sm.f) < 0.004) sm.f = 0; if (Math.abs(sm.t) < 0.004) sm.t = 0;
  me.yaw -= THREE.MathUtils.degToRad(TURN) * sm.t * dt;
  const f = sm.f, v = (f >= 0 ? WALK : BACK) * f * dt;
  moving = (v || sm.t || (drag && drag.far)) ? performance.now() : moving;
  if (v) {
    const dx = -Math.sin(me.yaw) * v, dz = -Math.cos(me.yaw) * v; let nx = me.x, nz = me.z;
    if (ok(me.x + dx, me.z + dz)) { nx += dx; nz += dz; } else if (ok(me.x + dx, me.z)) nx += dx; else if (ok(me.x, me.z + dz)) nz += dz;
    me.dist += Math.hypot(nx - me.x, nz - me.z); me.x = nx; me.z = nz;
  }
  const ph = (me.dist / STEP) * Math.PI;
  camera.position.set(me.x + Math.cos(me.yaw) * Math.sin(ph) * 0.012 * BOBK, EYE + (Math.abs(Math.sin(ph)) * BOB - BOB / 2) * BOBK, me.z - Math.sin(me.yaw) * Math.sin(ph) * 0.012 * BOBK);
  camera.rotation.set(me.pitch, me.yaw, Math.sin(ph) * 0.004 * BOBK);
}
const ZONE_HE = { open: 'מרחב מגורים פתוח' };
let last = performance.now(), roomShown = '', planT = 0;
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.05, (t - last) / 1000); last = t; step(dt); renderer.render(scene, camera);
  document.body.classList.toggle('moving', performance.now() - moving < 350); placeRings();
  if (meas.pts.length === 2) { v3.copy(meas.pts[0]).add(meas.pts[1]).multiplyScalar(0.5).project(camera); $('mlabel').style.left = `${((v3.x + 1) / 2) * innerWidth}px`; $('mlabel').style.top = `${((1 - v3.y) / 2) * innerHeight}px`; $('mlabel').style.display = v3.z < 1 ? '' : 'none'; }
  const ro = roomObj(me.x, me.z), r = doll ? 'מבט על' : (ro?.he || '');
  if (r && r !== roomShown) {
    roomShown = r; $('room').textContent = r; $('zone').textContent = doll ? '' : (ZONE_HE[zoneOf(me.x, me.z)] || '');
    const ci = CAMS.findIndex((c) => (roomObj(c.x / 100, c.y / 100)?.he || c.he) === r); if (ci >= 0 && (roomObj(CAMS[roomIdx].x / 100, CAMS[roomIdx].y / 100)?.he || CAMS[roomIdx].he) !== r) roomIdx = ci;
    $('p-name').textContent = r; $('p-n').textContent = `${roomIdx + 1} / ${CAMS.length}`;
    [...$('strip').children].forEach((b, i) => b.setAttribute('aria-current', String(i === roomIdx)));
  }
  if (t - planT > 120) { planT = t; drawPlan(); }
});
applyHour(); apply();
window.__walk3d = { me, ok, step, keys, scene, renderer, camera, ready: true, keysReady: false, info: () => renderer.info.render,
  design: { get state() { return state; }, parse, runText, change, undo: () => $('b-undo').click(), openCat, setDoll, partsOf, liveItems,
    rings: () => { step(0); camera.updateMatrixWorld(); placeRings(); return ringNodes.filter((r) => r.b.style.display !== 'none').map((r) => r.p.id); },
    setHour: (h) => { hour = h; return applyHour(); }, get hour() { return hour; }, bracket } };
Promise.all(KEYS.map(loadKey)).then(() => { applyHour(); window.__walk3d.keysReady = true; });
$('load').classList.add('hidden');
if (!SHOT) hint(false);

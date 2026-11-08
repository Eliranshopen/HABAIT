// Interactive flyover v2 — the real site geometry (site.glb from Blender) textured by PROJECTING the 360 nodes onto it
// (visibility from each node's depth equirect), a sky shell per node, a spline flight between the nodes, a hotspot on
// apartment 846 and a hand-off into the apartment's 360 tour. World = plan-world: X right, Y up the plan, Z up, metres.
import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { loadUnits, placeUnits } from './picker.js';
import { createPicker } from 'http://127.0.0.1:8850/js/picker.js';
import * as i18n from 'http://127.0.0.1:8850/js/i18n.js';
import * as analytics from 'http://127.0.0.1:8850/js/analytics.js';

const SKY_R = 2500;
const q = new URLSearchParams(location.search);
const clipEl = document.getElementById('clip');
let intro = null;                                         // the optional 3D orbit intro (?intro=1); set once the scene exists
// hand-off into the apartment tour: ?tour=<url> overrides the default; ?return=<url> is passed on so the tour can offer "back to the building";
// scope=apartment&from=flight tell the tour to show only the apartment's scenes (habait-ab's platform shell on :8850 links here).
function tourUrl() {
  const u = new URL(q.get('tour') || 'http://127.0.0.1:8848/?scope=apartment&room=terraceLiving&floor=parquet&video=0');
  u.searchParams.set('scope', 'apartment'); u.searchParams.set('from', 'flight');
  if (q.get('sid')) u.searchParams.set('sid', q.get('sid'));
  u.searchParams.set('return', q.get('return') || location.href.split('#')[0]);   // the tour's "חזרה לבניין" pill comes back here
  return u.toString();
}
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fc3e6);
const camera = new THREE.PerspectiveCamera(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(65.5) / 2) / (16 / 9)) * 180 / Math.PI, innerWidth / innerHeight, 0.3, 8000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, canvas);
controls.enableZoom = false; controls.enablePan = false; controls.rotateSpeed = -0.35;
controls.minDistance = controls.maxDistance = 0.01;
const status = (m) => (document.getElementById('status').textContent = m);

const meta = await (await fetch('./data/nodes.json')).json();
const site = await (await fetch('./data/site_nodes.json')).json();
const nodes = meta.nodes.map((n) => ({ ...n, pos: new THREE.Vector3(...n.pos), c: new THREE.Vector3(...n.centre_dir) }));
nodes.forEach((n) => { n.r = new THREE.Vector3(n.c.y, -n.c.x, 0); });
const hotspot = new THREE.Vector3(...(site.apartment_hotspot_world || meta.hotspot_terrace));
const hotLook = hotspot.clone();

// ---- textures --------------------------------------------------------------------------------------------------------
const loadEl = document.getElementById('loading');
const progress = (m) => { status(m); if (loadEl) loadEl.textContent = m; };
const loader = new THREE.TextureLoader();
let step = 0;
for (const n of nodes) {
  progress(`טוען את ההדמיה… פנורמה ${++step} מתוך ${nodes.length}`);
  const [rgb, dep] = await Promise.all([loader.loadAsync(`./data/${n.id}.jpg`), loader.loadAsync(`./data/${n.id}.depth8.png`)]);
  rgb.flipY = false; rgb.colorSpace = THREE.SRGBColorSpace; rgb.wrapS = THREE.RepeatWrapping;
  dep.flipY = false; dep.colorSpace = THREE.NoColorSpace; dep.minFilter = THREE.NearestFilter; dep.magFilter = THREE.NearestFilter; dep.generateMipmaps = false; dep.wrapS = THREE.RepeatWrapping;
  n.rgb = rgb; n.dep = dep;
}

// ---- the projective material (4 nodes) ---------------------------------------------------------------------------------
const N = nodes.length;
const uniforms = {
  nPos: { value: nodes.map((n) => n.pos) }, nC: { value: nodes.map((n) => n.c) }, nR: { value: nodes.map((n) => n.r) },
  nW: { value: new Array(N).fill(0.25) },
  rgb0: { value: nodes[0].rgb }, rgb1: { value: nodes[1].rgb }, rgb2: { value: nodes[2].rgb }, rgb3: { value: nodes[3].rgb },
  dep0: { value: nodes[0].dep }, dep1: { value: nodes[1].dep }, dep2: { value: nodes[2].dep }, dep3: { value: nodes[3].dep },
};
const PROJ = (i) => `
  { vec3 d = vWorld - nPos[${i}]; float dist = length(d); vec3 dn = d / dist;
    float lon = atan(dot(dn, nR[${i}]), dot(dn, nC[${i}])); float lat = asin(clamp(dn.z, -1.0, 1.0));
    vec2 uv = vec2(lon / 6.2831853 + 0.5, 0.5 - lat / 3.14159265);
    vec4 t = texture2D(dep${i}, uv); float cm = t.r * 255.0 * 256.0 + t.g * 255.0; float dm = cm / 100.0;
    float vis = (cm >= 65534.0) ? 1.0 : ((dist <= dm * 1.02 + 0.3) ? 1.0 : 0.0);
    float ang = max(0.0, dot(dn, viewDir)); float a2 = ang * ang; float w = nW[${i}] * vis * (a2 * a2 * a2 * a2 + 0.01);
    col += texture2D(rgb${i}, uv).rgb * w; wsum += w; }`;
const projMat = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: `varying vec3 vWorld; varying vec3 vNormal; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; vNormal = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 nPos[${N}]; uniform vec3 nC[${N}]; uniform vec3 nR[${N}]; uniform float nW[${N}];
    uniform sampler2D rgb0, rgb1, rgb2, rgb3, dep0, dep1, dep2, dep3; varying vec3 vWorld; varying vec3 vNormal;
    void main(){ vec3 viewDir = normalize(vWorld - cameraPosition); vec3 col = vec3(0.0); float wsum = 0.0;
      ${PROJ(0)} ${PROJ(1)} ${PROJ(2)} ${PROJ(3)}
      vec3 fallback = vec3(0.86, 0.82, 0.74) * (0.55 + 0.45 * max(0.0, dot(normalize(vNormal), normalize(vec3(-0.4, -0.6, 0.7)))));
      vec3 c = wsum > 1e-4 ? col / wsum : fallback;
      gl_FragColor = vec4(c, 1.0); }`,
  side: THREE.DoubleSide,
});

// ---- the site --------------------------------------------------------------------------------------------------------
progress('טוען את המודל התלת-ממדי של הבניין והסביבה…');
const GLB_URL = q.get('glb') === 'baked' ? './data/site_baked.glb' : './data/site.glb';
const gltf = await new Promise((res, rej) => new GLTFLoader().load(GLB_URL, res,
  (e) => progress(`טוען את המודל התלת-ממדי של הבניין והסביבה… ${Math.min(100, Math.round(e.loaded / 52473236 * 100))}%`), rej));
progress('בונה את הסצנה…');
const siteGroup = gltf.scene; siteGroup.rotation.x = Math.PI / 2;      // glTF Y-up -> plan-world Z-up
let meshCount = 0;
// HYBRID (16:10): the tower, the apartment and the orthophoto ground render with REAL materials in real time (crisp from any angle);
// only the OSM neighbours / podiums take the AI panoramas by projection; the panoramas also light the scene (environment) and fill the sky.
const HYBRID = q.get('mode') !== 'project';
const env = nodes[0].rgb.clone(); env.mapping = THREE.EquirectangularReflectionMapping; env.flipY = false; env.needsUpdate = true;
scene.environment = env; scene.environmentIntensity = 0.9;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const sun = new THREE.DirectionalLight(0xfff2e0, 2.6);
{ // the sun of the clay/skins: high, from the plan's upper-left (as seen in the panos at u≈0.11, v≈0.17 of node a)
  const n = nodes[0], lon = (0.11 - 0.5) * 2 * Math.PI, lat = (0.5 - 0.17) * Math.PI;
  const d = new THREE.Vector3().addScaledVector(n.c, Math.cos(lat) * Math.cos(lon)).addScaledVector(n.r, Math.cos(lat) * Math.sin(lon)).addScaledVector(new THREE.Vector3(0, 0, 1), Math.sin(lat));
  sun.position.copy(hotspot).addScaledVector(d, 600); sun.target.position.copy(hotspot); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const c = sun.shadow.camera; c.left = c.bottom = -260; c.right = c.top = 260; c.near = 200; c.far = 1200; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.6;
}
scene.add(sun); scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x8a7a66, 0.35));
const PBR = {
  STUDIO_clay_tower: () => new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.62, metalness: 0.0 }),
  STUDIO_clay_glazing: () => new THREE.MeshPhysicalMaterial({ color: 0x8aa3b5, roughness: 0.1, metalness: 0.6, envMapIntensity: 1.0, transparent: true, opacity: 0.55 }),
  STUDIO_clay_railglass: () => new THREE.MeshPhysicalMaterial({ color: 0xbfd6e6, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
  STUDIO_clay_mullion: () => new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.45, metalness: 0.7 }),
  STUDIO_clay_bush: () => new THREE.MeshStandardMaterial({ color: 0x4f6b3a, roughness: 0.95 }),
  STUDIO_clay_podium: () => new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.8 }),
  M_glass: () => new THREE.MeshPhysicalMaterial({ color: 0x9fb6c8, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.4 }),
};
const aptMeshes = [];
siteGroup.traverse((o) => {
  if (!o.isMesh) return; meshCount++; o.frustumCulled = true;
  const isApt = /^APT846_/.test(o.name), isTower = /^STUDIO_mass/.test(o.name), isGround = /^STUDIO_ortho/.test(o.name), isPodium = /^STUDIO_podium/.test(o.name);
  if (isApt) aptMeshes.push(o);
  if (GLB_URL.includes('baked')) { o.frustumCulled = true; if (o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; return; }   // baked textures as exported
  if (!HYBRID) { o.material = projMat; return; }
  const mname = o.material && o.material.name;
  if (isTower || isApt) {
    if (PBR[mname]) o.material = PBR[mname]();
    else if (o.material && o.material.isMeshStandardMaterial) { o.material.envMapIntensity = 0.8; }
    o.castShadow = true; o.receiveShadow = true;
  } else if (isGround) { o.receiveShadow = true; if (o.material.map) { o.material.map.colorSpace = THREE.SRGBColorSpace; o.material.roughness = 1; } }
  else { o.material = projMat; o.receiveShadow = true; }                     // OSM neighbours: AI skin by projection
});
console.log('apartment meshes', aptMeshes.length, 'hybrid', HYBRID);
scene.add(siteGroup);

// ---- sky shell per node (same equirect mapping, fixed radius) ----------------------------------------------------------
function towerU(node) { const d = new THREE.Vector3(hotspot.x - node.pos.x, hotspot.y - node.pos.y, 0).normalize(); const lon = Math.atan2(d.dot(node.r), d.dot(node.c)); return lon / (2 * Math.PI) + 0.5; }
function skyMesh(node) {
  const W = 128, H = 64; const pos = new Float32Array((W + 1) * (H + 1) * 3), uv = new Float32Array((W + 1) * (H + 1) * 2); const idx = [];
  const Z = new THREE.Vector3(0, 0, 1);
  for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) {
    const u = i / W, v = j / H, k = j * (W + 1) + i, lon = (u - 0.5) * 2 * Math.PI, lat = (0.5 - v) * Math.PI;
    const d = new THREE.Vector3().addScaledVector(node.c, Math.cos(lat) * Math.cos(lon)).addScaledVector(node.r, Math.cos(lat) * Math.sin(lon)).addScaledVector(Z, Math.sin(lat));
    pos[k * 3] = node.pos.x + d.x * SKY_R; pos[k * 3 + 1] = node.pos.y + d.y * SKY_R; pos[k * 3 + 2] = node.pos.z + d.z * SKY_R; uv[k * 2] = u; uv[k * 2 + 1] = v;
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const a = j * (W + 1) + i, b = a + 1, c2 = a + W + 1, d2 = c2 + 1; idx.push(a, c2, b, b, c2, d2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({                       // sky shell: only the pano's SKY pixels (depth = inf); the rest is the glb's job
    uniforms: { map: { value: node.rgb }, dep: { value: node.dep }, opacity: { value: 1 }, full: { value: 0 }, uTower: { value: towerU(node) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D map, dep; uniform float opacity, full, uTower; varying vec2 vUv; void main(){ vec4 t = texture2D(dep, vUv); float cm = t.r*255.0*256.0 + t.g*255.0; bool skyish = (full > 0.5) || vUv.y < 0.5 || t.b < 0.5; if (!skyish) discard; vec3 c = texture2D(map, vUv).rgb; gl_FragColor = vec4(c, opacity); }`,
  }));
  m.renderOrder = -10; m.frustumCulled = false; return m;
}
nodes.forEach((n) => { n.sky = skyMesh(n); scene.add(n.sky); });
// ring + approach nodes: sky shells only (the tower is real geometry now), picked by the camera's azimuth around the tower
const ring = [nodes[0]];
for (const x of (meta.extra || [])) {
  const n = { ...x, pos: new THREE.Vector3(...x.pos), c: new THREE.Vector3(...x.centre_dir) }; n.r = new THREE.Vector3(n.c.y, -n.c.x, 0);
  progress(`טוען פנורמת סביבה ${n.id}…`);
  const [rgb, dep] = await Promise.all([loader.loadAsync(`./data/${n.id}.jpg`), loader.loadAsync(`./data/${n.id}.depth8.png`)]);
  rgb.flipY = false; rgb.colorSpace = THREE.SRGBColorSpace; dep.flipY = false; dep.colorSpace = THREE.NoColorSpace; dep.minFilter = dep.magFilter = THREE.NearestFilter; dep.generateMipmaps = false;
  n.rgb = rgb; n.dep = dep; n.sky = skyMesh(n); n.sky.visible = false; scene.add(n.sky);
  if (/orbit/.test(n.id)) ring.push(n);
}
const azOf = (p) => Math.atan2(p.y - hotspot.y, p.x - hotspot.x);
ring.forEach((n) => { n.az = azOf(n.pos); });
function pickSky(camPos, fade = 1) {                   // the two ring nodes nearest in azimuth to the camera, crossfaded
  const az = azOf(camPos);
  const d = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const useRing = !!intro;                                                      // the ring only during the 3D orbit intro
  const sorted = (useRing ? ring : [ring[0]]).map((n) => ({ n, dd: d(az, n.az) })).sort((u, v) => u.dd - v.dd);
  const [p0] = sorted;
  ring.forEach((n) => { n.sky.visible = false; });
  p0.n.sky.visible = true; p0.n.sky.material.uniforms.opacity.value = fade; p0.n.sky.material.uniforms.full.value = 0; p0.n.sky.renderOrder = -10; p0.n.sky.material.depthTest = true;
}
document.getElementById('loading').remove();
status(`${meshCount} חלקים נטענו`);

// ---- the flight ---------------------------------------------------------------------------------------------------------
const path = new THREE.CatmullRomCurve3(nodes.map((n) => n.pos), false, 'centripetal', 0.5);
const NODE_T = (() => { const S = 4000, pts = path.getSpacedPoints(S); return nodes.map((n) => { let best = 0, bd = Infinity; pts.forEach((p, i) => { const d = p.distanceToSquared(n.pos); if (d < bd) { bd = d; best = i; } }); return best / S; }); })();
console.log('node path parameters', NODE_T.map((x) => x.toFixed(3)).join(' '));
function segAt(tt) { let i0 = 0; for (let i = 0; i < N - 1; i++) if (tt >= NODE_T[i]) i0 = i; i0 = Math.min(i0, N - 2); const f = THREE.MathUtils.clamp((tt - NODE_T[i0]) / Math.max(1e-6, NODE_T[i0 + 1] - NODE_T[i0]), 0, 1); return { i0, f }; }
const t0 = Math.min(1, Math.max(0, parseFloat(q.get('t') || '0') || 0));
let t = t0, targetT = t0, flying = false, inside = false;
const slider = document.getElementById('t');
const lookDir = new THREE.Vector3();
function placeCamera() {
  const p = path.getPointAt(t);
  camera.position.copy(p);
  if (flying) lookDir.copy(hotLook).sub(p).normalize();
  controls.target.copy(p).addScaledVector(lookDir, 0.01); controls.update();
  const { i0, f } = segAt(t); const fs = THREE.MathUtils.smoothstep(f, 0.3, 0.7);
  const land = THREE.MathUtils.smoothstep(t, 1 - 0.06, 1 - 0.005);                     // landing on the terrace: the skinned 360 takes over
  nodes.forEach((n, i) => {
    const near = i === i0 ? 1 - fs : i === i0 + 1 ? fs : 0;
    uniforms.nW.value[i] = 0.08 + near;
  });
  pickSky(p);
  nodes.forEach((n, i) => {
    if (i === 0) return;                                                         // the aerial node is the sky source, never a full sphere
    const ti = NODE_T[i]; const win = i === N - 1 ? 0.07 : 0.02;                 // landing fades in over a longer stretch
    let w = 1 - THREE.MathUtils.smoothstep(Math.abs(t - ti), 0.004, win);
    if (i === N - 1) w = land;
    const s = n.sky; if (i === 1 || i === 2) { s.visible = w > 0.001; }
    if (w > 0.001) { s.visible = true; s.material.uniforms.opacity.value = w; s.material.uniforms.full.value = 1; s.renderOrder = 50 + i; s.material.depthTest = false; }
    else if (i === N - 1) { s.visible = false; }
  });
  slider.value = Math.round((1 - t) * 1000);
  status(`נקודה ${i0 + 1}→${i0 + 2} · ${(f * 100).toFixed(0)}% · גובה ${(p.z + 51.2).toFixed(0)} מ׳ מעל הקרקע`);
}
function initLook() { lookDir.copy(nodes[0].c); lookDir.z = -0.3; lookDir.normalize(); }
initLook(); placeCamera();
// Eliran's intro (12:05): an automatic orbit around the project while the buyer may look around, then the flight stops in front of
// the building and the buyer takes control (pick an apartment). Orbit stays inside the skinned coverage (~40 deg around the tower).
const T_FACADE = NODE_T[2];                            // path parameter of node c (the facade node)
const T_HOLD = NODE_T[1]; const HOLD_LOOK = new THREE.Vector3(8.765, -9.9516, 4.1123);
const towerXY = new THREE.Vector2(hotspot.x, hotspot.y);
intro = (q.get('intro') === '1' && !q.has('t')) ? { t0: performance.now(), orbitMs: 30000, descendMs: 8000 } : null;
// the HOLD = node-b-tower (whole tower in view, every apartment clickable); node-c stays in the descent; ab's orbit video ends on this pose
const holdLook = () => { const p0 = path.getPointAt(T_HOLD); const d = new THREE.Vector3(HOLD_LOOK.x - p0.x, HOLD_LOOK.y - p0.y, 0).normalize(); d.z = -Math.tan(THREE.MathUtils.degToRad(2)); return d.normalize(); };
if (!intro && !q.has('t')) { t = targetT = T_HOLD; lookDir.copy(holdLook()); placeCamera(); status('בחרו דירה על הבניין'); }
const skipIntro = () => { if (intro) { intro = null; targetT = T_HOLD; t = T_HOLD; lookDir.copy(holdLook()); placeCamera(); status('בחרו דירה על הבניין'); } };
['wheel', 'keydown'].forEach((ev) => canvas.addEventListener(ev, skipIntro, { passive: true }));
slider.addEventListener('pointerdown', skipIntro);
function introStep(now) {
  const el = now - intro.t0; const A = nodes[0].pos;
  const r0 = Math.hypot(A.x - towerXY.x, A.y - towerXY.y); const a0 = Math.atan2(A.y - towerXY.y, A.x - towerXY.x);
  if (el < intro.orbitMs) {                               // a full circle around the project at the aerial radius (ring of skinned nodes), easing in/out
    const k = THREE.MathUtils.smoothstep(el / intro.orbitMs, 0, 1); const ang = a0 + k * Math.PI * 2;
    const r = r0; const z = A.z;
    camera.position.set(towerXY.x + r * Math.cos(ang), towerXY.y + r * Math.sin(ang), z);
    const aim = new THREE.Vector3(towerXY.x, towerXY.y, 20); lookDir.copy(aim).sub(camera.position).normalize();
    intro.endPos = camera.position.clone(); intro.endLook = lookDir.clone();
  } else if (el < intro.orbitMs + intro.descendMs) {      // descend to the facade node and stop there
    const k = THREE.MathUtils.smoothstep((el - intro.orbitMs) / intro.descendMs, 0, 1);
    const target = path.getPointAt(T_HOLD); camera.position.lerpVectors(intro.endPos, target, k);
    const aimLook = hotspot.clone().sub(camera.position).normalize(); lookDir.copy(intro.endLook).lerp(aimLook, k).normalize();
    t = THREE.MathUtils.lerp(0, T_HOLD, k); targetT = t;
  } else { skipIntro(); return; }
  controls.target.copy(camera.position).addScaledVector(lookDir, 0.01); controls.update();
  const { i0, f } = segAt(t); const fs = THREE.MathUtils.smoothstep(f, 0.3, 0.7);
  nodes.forEach((n, i) => { const near = i === i0 ? 1 - fs : i === i0 + 1 ? fs : 0; uniforms.nW.value[i] = 0.08 + near; }); pickSky(camera.position); nodes[N - 1].sky.visible = false;
  status(el < intro.orbitMs ? 'סיבוב מעל הפרויקט · אפשר להסתכל סביב' : 'מתקרבים לבניין…');
}

canvas.addEventListener('wheel', (e) => { if (inside) return; targetT = THREE.MathUtils.clamp(targetT + Math.sign(e.deltaY) * 0.03, 0, 1); flying = false; }, { passive: true });
slider.addEventListener('input', () => { if (inside) return; targetT = 1 - slider.value / 1000; flying = false; });
let userLooked = false;
canvas.addEventListener('pointerdown', () => { userLooked = true; });
controls.addEventListener('change', () => { if (!flying && !intro) lookDir.copy(controls.target).sub(camera.position).normalize(); });
function playClip(src, onEnd) {
  return new Promise((res) => {
    clipEl.src = src; clipEl.style.display = 'block'; clipEl.style.opacity = '0'; clipEl.style.transition = 'opacity .35s';
    clipEl.oncanplay = () => { clipEl.play().catch(() => {}); requestAnimationFrame(() => { clipEl.style.opacity = '1'; }); };
    let done = false;
    const finish = () => { if (done) return; done = true; onEnd && onEnd(); clipEl.style.opacity = '0'; setTimeout(() => { clipEl.style.display = 'none'; clipEl.removeAttribute('src'); res(); }, 400); };
    clipEl.onended = finish; clipEl.onerror = finish; clipEl.onstalled = () => setTimeout(finish, 3000);
    setTimeout(finish, 9000);                                                    // safety: the scene switch happens even if the video never plays
    clipEl.load();
  });
}
const DESCENT_CLIPS = { '846': './data/video/descent-846.mp4' };          // photoreal pre-rendered legs, per unit (Kling 4.0 on the clay descent)
function flyToApartment() {
  const src = DESCENT_CLIPS['846'];
  if (src && q.get('fly') !== '3d') {                                       // default: photoreal clip; ?fly=3d = the PBR flight (debug)
    status('טסים אל הדירה…'); picker.close();
    const land = () => { t = targetT = 1; flying = false; inside = true; lookDir.copy(hotspot).sub(path.getPointAt(1)).normalize(); placeCamera(); };
    setTimeout(land, 1200);                                                      // the terrace 360 is ready behind the clip from early on
    playClip(src, land);
    document.getElementById('enter').style.display = 'block'; status('הגענו למרפסת של דירה 846 · גררו להסתכל סביב');
    return;
  }
  flying = true; targetT = 1;
}
if (q.get('orbit')) { playClip(q.get('orbit')); }
if (q.get('auto') === 'fly') setTimeout(flyToApartment, 1500);
if (q.get('auto') === 'select') setTimeout(() => picker.select('846'), 3500);                 // test hook: click the apartment automatically                             // the orbit video (habait-ab's) before the hold, when the shell doesn't play it
document.getElementById('toApt').onclick = flyToApartment;
document.getElementById('hot').onclick = flyToApartment;
document.getElementById('reset').onclick = () => { inside = false; flying = false; targetT = 0; document.getElementById('enter').style.display = 'none'; document.getElementById('fade').style.opacity = 0; initLook(); };
document.getElementById('enterBtn').onclick = () => { document.getElementById('fade').style.opacity = 1; setTimeout(() => { location.href = tourUrl(); }, 650); };

// ---- the apartment picker (Eliran 13:20: a pill on every relevant unit at the hold, status dot, same data as the :8850 shell) ----------
const unitsRaw = await loadUnits(q);
const holdPos = path.getPointAt(T_HOLD);
const facadeTangent = new THREE.Vector3(hotspot.x - holdPos.x, hotspot.y - holdPos.y, 0).normalize().applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const placed = placeUnits(unitsRaw, hotspot, facadeTangent);
const posById = new Map(placed.map((u) => [String(u.id), u.pos]));
let project = { id: q.get('project') || 'rainbow' };
try { project = await (await fetch(`http://127.0.0.1:8850/fixtures/${project.id}/project.json`)).json(); } catch (e) { console.warn('project.json', e.message); }
try { analytics.initAnalytics({ base: { project: project.id, lang: i18n.getLang(), surface: 'flyover3d' } }); } catch (e) { console.warn('analytics', e.message); }
// the SAME picker as flow.html (habait-ab's js/picker.js): pills, card, drawer, legend, lead/WhatsApp, analytics — one source of truth
const picker = createPicker({
  units: unitsRaw, container: document.getElementById('pickerStage'), i18n, analytics, project,
  canEnter: (u) => String(u.id) === '846',
  onEnter: (u) => { if (String(u.id) === '846') flyToApartment(); },
});
const projectUnit = (u) => {
  const atHold = !intro && !flying && !inside && Math.abs(t - T_HOLD) < 0.02 && clipEl.style.display === 'none';
  if (!atHold) return null;
  const pos = posById.get(String(u.id)); if (!pos) return null;
  const v = pos.clone().project(camera);
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
};
console.log('units', placed.length, 'approximate positions', placed.filter((u) => u.approx).length);
const hotEl = document.getElementById('hot');
let holdEase = null, holdEaseLogged = false;
function updateHotspot() {
  const atHold = !intro && !flying && !inside && Math.abs(t - T_HOLD) < 0.02;
  picker.update(projectUnit);
  document.getElementById('bar').style.display = (atHold || inside || clipEl.style.display !== 'none') ? 'none' : 'block';
  document.getElementById('info').style.display = atHold || inside ? 'none' : 'block';
  if (atHold && holdEase === null) { holdEase = performance.now(); console.log('hold ease start ' + JSON.stringify({ intro: !!intro, flying, inside, t, T_HOLD, userLooked, units: placed.length })); }
  if (!atHold) holdEase = null;
  if (atHold && holdEase !== null && !userLooked) {
    const k = THREE.MathUtils.smoothstep((performance.now() - holdEase - 600) / 2000, 0, 1);
    const centroid = placed.length ? placed.reduce((a, u) => a.add(u.pos), new THREE.Vector3()).multiplyScalar(1 / placed.length) : hotspot;
    const aim = centroid.clone().sub(camera.position).normalize();
    lookDir.copy(holdLook()).lerp(aim, k).normalize(); controls.target.copy(camera.position).addScaledVector(lookDir, 0.01); camera.lookAt(controls.target); camera.up.set(0, 0, 1);
    if (k >= 0.99 && !holdEaseLogged) { holdEaseLogged = true; console.log('hold ease done, lookDir.z', lookDir.z.toFixed(3), 'cam dir z', camera.getWorldDirection(new THREE.Vector3()).z.toFixed(3)); }
  }
  hotEl.style.display = 'none'; return;
  const v = hotspot.clone().project(camera);
  const vis = v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
  hotEl.style.display = vis ? 'block' : 'none'; hotEl.style.left = `${(v.x + 1) / 2 * innerWidth}px`; hotEl.style.top = `${(1 - v.y) / 2 * innerHeight}px`;
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (intro) { introStep(now); }
  else if (Math.abs(targetT - t) > 1e-4) { t += (targetT - t) * Math.min(1, dt * (flying ? 0.9 : 4)); if (Math.abs(targetT - t) < 1e-4) t = targetT; placeCamera(); }
  else if (flying && t >= 0.999 && !inside) { flying = false; inside = true; document.getElementById('enter').style.display = 'block'; status('הגענו למרפסת של דירה 846 · גררו להסתכל סביב'); }
  updateHotspot(); renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

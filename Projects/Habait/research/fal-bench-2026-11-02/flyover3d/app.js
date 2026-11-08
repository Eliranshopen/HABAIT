// Interactive flyover v2 — the real site geometry (site.glb from Blender) textured by PROJECTING the 360 nodes onto it
// (visibility from each node's depth equirect), a sky shell per node, a spline flight between the nodes, a hotspot on
// apartment 846 and a hand-off into the apartment's 360 tour. World = plan-world: X right, Y up the plan, Z up, metres.
//
// v3 (habait-98, 2026-11-02 evening, Eliran's feedback on the live link: "צריך שהכל יהיה בפלואו זורם", no loading screen after the
// orbit video, the picker must not freeze): the HOLD needs only node-b's skinned sphere + the picker, so that is all that loads
// before the hold opens (~1.3 MB, decoded off the main thread with createImageBitmap). The other nodes load in the background;
// the 50 MB site.glb, the sun/shadows and the orbit ring nodes load ONLY for the debug flights (?t=, ?fly=3d, ?intro=1, "חזרה למעוף").
// The orbit video (?orbit=) is started by index.html before this module is even fetched; here we only decide when to cut.
import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { loadUnits, placeUnits } from './picker.js';
import { createArcHold } from './holdarc.js';
import { createBirds } from './birds.js';
import { createPicker } from 'http://127.0.0.1:8850/js/picker.js';
import * as i18n from 'http://127.0.0.1:8850/js/i18n.js';
import * as analytics from 'http://127.0.0.1:8850/js/analytics.js';

const SKY_R = 2500;
const q = new URLSearchParams(location.search);
const clipEl = document.getElementById('clip');
const orbit = window.__orbit || null;
const birds = createBirds({ canvas: document.getElementById('birds') });     // a few birds over the clip and the hold (Eliran: 'לראות גם ציפורים עפות')                     // step 1 (the orbit clip) is already playing: index.html started it
let clipShowing = !!orbit;                                // true while a full-screen clip covers the canvas (orbit or descent)
let intro = null;                                         // the optional 3D orbit intro (?intro=1); set once the scene exists
// hand-off into the apartment tour: ?tour=<url> overrides the default; ?return=<url> is passed on so the tour can offer "back to the building";
// scope=apartment&from=flight tell the tour to show only the apartment's scenes (habait-ab's platform shell on :8850 links here).
function tourUrl() {
  const u = new URL(q.get('tour') || 'http://127.0.0.1:8848/?scope=apartment&room=terraceLiving&floor=parquet&video=0', location.href);   // ?tour may be relative (/tour/… on Vercel)
  u.searchParams.set('scope', 'apartment'); u.searchParams.set('from', 'flight'); if (!u.searchParams.has('ui')) u.searchParams.set('ui', 'min');   // v5: the quiet tour chrome
  if (q.get('sid')) u.searchParams.set('sid', q.get('sid'));
  const back = new URL(location.href); back.hash = ''; back.searchParams.delete('orbit');                          // back to the HOLD, not to the video again
  u.searchParams.set('return', q.get('return') || back.toString());                 // the tour's "חזרה לבניין" pill comes back here
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
const loadEl = document.getElementById('loading');
const lineEl = document.getElementById('clipLine');
const progress = (m) => { status(m); if (loadEl && !orbit) loadEl.textContent = m; };
const setLine = (f) => { lineEl.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`; };

// ---- textures: fetched with progress, decoded OFF the main thread (createImageBitmap), uploaded once ----------------------
// Placeholders until a node's panorama arrives: grey colour, "infinite" depth (= sky everywhere, so nothing is discarded).
const blankRgb = new THREE.DataTexture(new Uint8Array([140, 150, 160, 255]), 1, 1); blankRgb.colorSpace = THREE.SRGBColorSpace; blankRgb.needsUpdate = true;
const blankDep = new THREE.DataTexture(new Uint8Array([255, 255, 0, 255]), 1, 1); blankDep.needsUpdate = true;
async function loadBitmap(url, onProgress) {
  const res = await fetch(url); if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const total = +res.headers.get('content-length') || 0; let blob;
  if (res.body && onProgress) {
    const reader = res.body.getReader(); const chunks = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress(total ? got / total : 0); }
    blob = new Blob(chunks);
  } else blob = await res.blob();
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); } catch (e) { console.warn('createImageBitmap', e.message); }
  }
  return new Promise((res2, rej) => { const img = new Image(); img.onload = () => res2(img); img.onerror = rej; img.src = URL.createObjectURL(blob); });
}
function texOf(img, depth = false) {
  const t = new THREE.Texture(img); t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true;
  if (depth) { t.colorSpace = THREE.NoColorSpace; t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  else t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
async function loadNodeTex(n, onProgress) {
  if (n.texPromise) return n.texPromise;
  n.texPromise = (async () => {
    let fr = 0, fd = 0; const rep = () => onProgress && onProgress((fr * 0.85 + fd * 0.15));
    const [rgb, dep] = await Promise.all([loadBitmap(`./data/${n.id}.jpg`, (f) => { fr = f; rep(); }), loadBitmap(`./data/${n.id}.depth8.png`, (f) => { fd = f; rep(); })]);
    n.rgb = texOf(rgb); n.dep = texOf(dep, true);
    renderer.initTexture(n.rgb); renderer.initTexture(n.dep);                      // upload now, not at the first frame that needs it
    n.ready = true; applyNodeTex(n); return n;
  })();
  return n.texPromise;
}
let uniforms = null;                                                               // the projective material's uniforms, once built
function applyNodeTex(n) {
  const i = nodes.indexOf(n);
  if (uniforms && i >= 0 && i < 4) { uniforms[`rgb${i}`].value = n.rgb; uniforms[`dep${i}`].value = n.dep; }
  if (n.sky) { n.sky.material.uniforms.map.value = n.rgb; n.sky.material.uniforms.dep.value = n.dep; }
  if (i === 0 && siteLoaded) setEnvironment();
}

// ---- phase 1: what the HOLD needs (node-b + the picker's data), all in parallel ----------------------------------------------
progress('טוען את ההדמיה…');
const unitsSrcQ = q;
const [meta, site, unitsRaw, projectMeta] = await Promise.all([
  fetch('./data/nodes.json').then((r) => r.json()),
  fetch('./data/site_nodes.json').then((r) => r.json()),
  loadUnits(unitsSrcQ),
  fetch(`http://127.0.0.1:8850/fixtures/${q.get('project') || 'rainbow'}/project.json`).then((r) => r.json()).catch((e) => { console.warn('project.json', e.message); return { id: q.get('project') || 'rainbow' }; }),
]);
const nodes = meta.nodes.map((n) => ({ ...n, pos: new THREE.Vector3(...n.pos), c: new THREE.Vector3(...n.centre_dir), rgb: blankRgb, dep: blankDep, ready: false }));
nodes.forEach((n) => { n.r = new THREE.Vector3(n.c.y, -n.c.x, 0); });
const hotspot = new THREE.Vector3(...(site.apartment_hotspot_world || meta.hotspot_terrace));
const hotLook = hotspot.clone();
const N = nodes.length;
const HOLD_I = 1;                                                                  // the hold = node-b-tower (whole tower in view)
// v5 "living hold": a scrubbable pre-rendered arc of frames around the facade (holdarc.js, data/holdarc); ?hold=360 = the 360 sphere
let arc = null;
if (q.get('hold') !== '360') {
  try {
    // v8: the glide/drag track is the full 360° ring (data/holdring) when it exists, else the ±45° arc; + the pull-back track
    // ?hold=ring = the Kling 360° ring as a PREVIEW (no consistent world/camera path, pills only at the hold); default = the ±45° arc
    if (q.get('hold') === 'ring') { try { arc = await createArcHold({ canvas: document.getElementById('arc'), base: './data/holdring' }); } catch (e) { console.warn('ring unavailable:', e.message); } }
    if (!arc) arc = await createArcHold({ canvas: document.getElementById('arc') });
    arc.active = true; setLine(0.85);
  }
  catch (e) { console.warn('arc hold unavailable, falling back to the 360 sphere:', e.message); arc = null; }
}
if (arc) loadNodeTex(nodes[HOLD_I]).catch(() => {});                              // the sphere stays as a fallback / for ?stop=terrace
else await loadNodeTex(nodes[HOLD_I], (f) => { setLine(f * 0.85); progress(`טוען את ההדמיה… ${Math.round(f * 100)}%`); });

// ---- v7: the 360 sphere takes over the hold on the first drag/wheel (free 360° look + zoom-out); the arc only glides before that ----
const sphere = { on: false, yaw: 0, pitch: 0, fov0: camera.fov };
function sphereTake() {
  if (sphere.on) return true;
  if (!nodes[HOLD_I].ready) return false;                                        // the skin is still loading: keep the arc
  sphere.on = true; userLooked = true;
  const d = holdLook(); sphere.yaw = Math.atan2(d.x, d.y); sphere.pitch = Math.asin(d.z);
  lookDir.copy(d); placeCamera(); document.documentElement.classList.add('sphere-on');
  const hint = document.getElementById('dragHint'); if (hint) hint.classList.remove('on');
  return true;
}
function sphereLook(dx, dy) {
  if (!sphere.on) return;
  const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  sphere.yaw -= dx * hf / innerWidth; sphere.pitch = THREE.MathUtils.clamp(sphere.pitch + dy * vf / innerHeight, -1.0, 1.0);
  lookDir.set(Math.sin(sphere.yaw) * Math.cos(sphere.pitch), Math.cos(sphere.yaw) * Math.cos(sphere.pitch), Math.sin(sphere.pitch));
  controls.target.copy(camera.position).addScaledVector(lookDir, 0.01); controls.update();
}
function sphereZoom(dy) {
  if (!sphere.on) return;
  camera.fov = THREE.MathUtils.clamp(camera.fov * Math.exp(dy * 0.0012), 24, 100); camera.updateProjectionMatrix();
}
// ---- the projective material (4 nodes) ---------------------------------------------------------------------------------
uniforms = {
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
// ring + approach nodes: sky shells only (the tower is real geometry now), picked by the camera's azimuth around the tower.
// Loaded only for the experimental 3D intro (?intro=1); the product orbit is the rendered VIDEO.
const ring = [nodes[0]];
const azOf = (p) => Math.atan2(p.y - hotspot.y, p.x - hotspot.x);
let extrasPromise = null;
function loadExtras() {
  if (extrasPromise) return extrasPromise;
  extrasPromise = (async () => {
    for (const x of (meta.extra || [])) {
      const n = { ...x, pos: new THREE.Vector3(...x.pos), c: new THREE.Vector3(...x.centre_dir), rgb: blankRgb, dep: blankDep }; n.r = new THREE.Vector3(n.c.y, -n.c.x, 0);
      progress(`טוען פנורמת סביבה ${n.id}…`);
      await loadNodeTex(n);
      n.sky = skyMesh(n); n.sky.visible = false; scene.add(n.sky); applyNodeTex(n);
      if (/orbit/.test(n.id)) { n.az = azOf(n.pos); ring.push(n); }
    }
  })();
  return extrasPromise;
}
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

// ---- the site (50 MB glb + sun + shadows + environment): ONLY for the debug flights; the buyer flow never shows it -----------
let siteLoaded = false, sitePromise = null, meshCount = 0;
const GLB_URL = q.get('glb') === 'baked' ? './data/site_baked.glb' : './data/site.glb';
const HYBRID = q.get('mode') !== 'project';
function setEnvironment() { const env = nodes[0].rgb.clone(); env.mapping = THREE.EquirectangularReflectionMapping; env.flipY = false; env.needsUpdate = true; scene.environment = env; scene.environmentIntensity = 0.9; }
function ensureSite() {
  if (sitePromise) return sitePromise;
  sitePromise = (async () => {
    await Promise.all(nodes.map((n) => loadNodeTex(n)));
    progress('טוען את המודל התלת-ממדי של הבניין והסביבה…');
    const gltf = await new Promise((res, rej) => new GLTFLoader().load(GLB_URL, res,
      (e) => progress(`טוען את המודל התלת-ממדי של הבניין והסביבה… ${Math.min(100, Math.round(e.loaded / 52473236 * 100))}%`), rej));
    progress('בונה את הסצנה…');
    const siteGroup = gltf.scene; siteGroup.rotation.x = Math.PI / 2;      // glTF Y-up -> plan-world Z-up
    // HYBRID (16:10): the tower, the apartment and the orthophoto ground render with REAL materials in real time (crisp from any angle);
    // only the OSM neighbours / podiums take the AI panoramas by projection; the panoramas also light the scene (environment) and fill the sky.
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
      const isApt = /^APT846_/.test(o.name), isTower = /^STUDIO_mass/.test(o.name), isGround = /^STUDIO_ortho/.test(o.name);
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
    scene.add(siteGroup); siteLoaded = true; setEnvironment();
    status(`${meshCount} חלקים נטענו`);
  })();
  return sitePromise;
}

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
const T_HOLD = NODE_T[HOLD_I]; const HOLD_LOOK = new THREE.Vector3(8.765, -9.9516, 4.1123);
const towerXY = new THREE.Vector2(hotspot.x, hotspot.y);
const wantIntro = q.get('intro') === '1' && !q.has('t');
const debugFlight = q.has('t') || q.get('fly') === '3d' || wantIntro;
if (debugFlight) { await ensureSite(); if (wantIntro) await loadExtras(); }   // the debug paths need the whole scene first
intro = wantIntro ? { t0: performance.now(), orbitMs: 30000, descendMs: 8000 } : null;
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

// the free flight along the path (wheel / slider) exists only once the site is loaded (debug); at the hold the buyer looks around and picks
canvas.addEventListener('wheel', (e) => { if (inside || !siteLoaded) return; targetT = THREE.MathUtils.clamp(targetT + Math.sign(e.deltaY) * 0.03, 0, 1); flying = false; }, { passive: true });
slider.addEventListener('input', () => { if (inside || !siteLoaded) return; targetT = 1 - slider.value / 1000; flying = false; });
let userLooked = q.get('ease') !== '1';                                        // v4: NO ease after the cut — the hold stays on the video's end pose (continuity); ?ease=1 restores 89's ease onto the units
canvas.addEventListener('pointerdown', () => { userLooked = true; });
controls.addEventListener('change', () => { if (!flying && !intro) lookDir.copy(controls.target).sub(camera.position).normalize(); });
function playClip(src, onEnd) {
  return new Promise((res) => {
    clipShowing = true;
    clipEl.src = src; clipEl.style.display = 'block'; clipEl.style.opacity = '0'; clipEl.style.transition = 'opacity .35s';
    clipEl.oncanplay = () => { clipEl.play().catch(() => {}); requestAnimationFrame(() => { clipEl.style.opacity = '1'; }); };
    let done = false;
    const finish = () => { if (done) return; done = true; onEnd && onEnd(); clipEl.style.opacity = '0'; clipShowing = false; setTimeout(() => { clipEl.style.display = 'none'; clipEl.removeAttribute('src'); res(); }, 400); };
    clipEl.onended = finish; clipEl.onerror = finish; clipEl.onstalled = () => setTimeout(finish, 3000);
    setTimeout(finish, 9000);                                                    // safety: the scene switch happens even if the video never plays
    clipEl.load();
  });
}
const DESCENT_CLIPS = { '846': './data/video/descent-846.mp4' };          // photoreal pre-rendered legs, per unit (Kling 4.0 on the clay descent)
function flyToApartment() {
  if (building.frame) return; building.leaving = true;   // board hold-building-tour: from the first eased frame of the descent the button is gone (tablet E1)
  if (arc && arc.active && !arc.pass && !flyToApartment._centred) { arc.goCentre(650, () => { flyToApartment._centred = true; flyToApartment(); flyToApartment._centred = false; }); return; }   // back to the clip's start pose first
  if (sphere.on && !flyToApartment._centred) {                                  // v7: the sphere eases back to the clip's start pose (look + fov) first
    const from = lookDir.clone(), to = holdLook(), f0 = camera.fov, f1 = sphere.fov0, t0 = performance.now();
    const step = () => { const k = Math.min(1, (performance.now() - t0) / 450), e = k * k * (3 - 2 * k); lookDir.copy(from).lerp(to, e).normalize(); controls.target.copy(camera.position).addScaledVector(lookDir, 0.01); controls.update(); camera.fov = f0 + (f1 - f0) * e; camera.updateProjectionMatrix(); if (k < 1) requestAnimationFrame(step); else { flyToApartment._centred = true; flyToApartment(); flyToApartment._centred = false; } };
    requestAnimationFrame(step); return;
  }
  const src = DESCENT_CLIPS['846'];
  if (src && q.get('fly') !== '3d') {                                       // default: photoreal clip; ?fly=3d = the PBR flight (debug)
    status('טסים אל הדירה…'); picker.close(); birds.active = false;
    const direct = q.get('stop') !== 'terrace';                               // v4: clip → the apartment tour directly; ?stop=terrace = 89's node-d stop
    let frame = null;
    if (direct) {                                                             // the tour loads in an iframe BEHIND the clip, so the cut is instant
      frame = document.createElement('iframe'); frame.id = 'tourFrame'; frame.src = tourUrl(); frame.allow = 'fullscreen; autoplay'; frame.allowFullscreen = true;
      frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;opacity:0;z-index:4;background:#000;transition:opacity .45s';
      document.body.appendChild(frame);
    }
    let landed = false;
    const land = async () => {
      if (landed) return; landed = true;
      if (direct) { frame.style.opacity = '1'; fadeAmbience(900); inside = true; halted = true; if (arc) arc.active = false; for (const id of ['hud', 'pickerStage', 'soundBtn', 'clipSkip', 'clipLine', 'dragHint', 'buildingBtn']) document.getElementById(id).style.display = 'none'; return; }   // nothing of the hold stays over the tour
      await loadNodeTex(nodes[N - 1]); if (arc) arc.active = false; t = targetT = 1; flying = false; inside = true; lookDir.copy(hotspot).sub(path.getPointAt(1)).normalize(); placeCamera();
    };
    if (direct) setTimeout(land, 7000);                                        // safety if the clip never ends
    else setTimeout(land, 1200);                                               // the terrace 360 is ready behind the clip from early on
    playClip(src, land);
    if (!direct) { document.getElementById('enter').style.display = 'block'; status('הגענו למרפסת של דירה 846 · גררו להסתכל סביב'); }
    return;
  }
  flying = true; targetT = 1;
}
if (q.get('auto') === 'fly') setTimeout(flyToApartment, 1500);
if (q.get('auto') === 'select') setTimeout(() => picker.select('846'), 3500);                 // test hook: click the apartment automatically
document.getElementById('toApt').onclick = flyToApartment;
document.getElementById('hot').onclick = flyToApartment;
document.getElementById('reset').onclick = async () => { await ensureSite(); building.leaving = false; inside = false; flying = false; targetT = 0; document.getElementById('enter').style.display = 'none'; document.getElementById('fade').style.opacity = 0; initLook(); };
let fadeGen = 0;   // board hold-building-tour gate D1: a newer fade or a restore cancels a running fade (bump fadeGen)
function fadeAmbience(ms = 600) { const amb = document.getElementById('amb'); if (amb && !amb.paused) { const gen = ++fadeGen; const v0 = amb.volume; const t0 = performance.now(); const f = () => { if (gen !== fadeGen) return; const k = Math.min(1, (performance.now() - t0) / ms); amb.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(f); else amb.pause(); }; f(); } }
document.getElementById('enterBtn').onclick = () => {
  document.getElementById('fade').style.opacity = 1; fadeAmbience();                 // the ambience fades with the picture
  setTimeout(() => { location.href = tourUrl(); }, 650);
};

// ---- board exterior-film (Eliran 2026-11-04: "לא רלוונטי כתמונות … הדמייה ריאליסטית ברזולוציה טובה ולא כרצף תמונות") ---------------
// "הדמיית הבניין והסביבה" plays ONE continuous realistic film over the hold (was: the tour's 360 stills chain, board hold-building-tour):
// the approved Kling clips — orbit → the facade arc → the descent to 846's terrace — upscaled to 1080p (Topaz Starlight Precise 2.5).
// 1080p from 900 CSS px wide, the 720p cut below (phones). At the end: enter 846 (the same hand-off as #enterBtn), watch again, back.
// ✕ / Esc / "חזרה לבחירת דירה" remove it and resume the hold exactly where it was. The ambience keeps playing under the film.
const FILM = { hd: './data/video/building-film-1080.mp4', sd: './data/video/building-film-720.mp4', poster: './data/video/building-film-poster.jpg' };
const bBtn = document.getElementById('buildingBtn'), bClose = document.getElementById('buildingClose');
const bBox = document.getElementById('buildingFilm'), bVid = document.getElementById('buildingVideo'), bEnd = document.getElementById('buildingEnd'), bLine = document.getElementById('buildingLine');
const building = { frame: null, leaving: false, birdsWereOn: false, ended: false };
const track = (ev, props = {}) => { try { analytics.capture(ev, props); } catch { /* analytics is optional */ } };
function filmSrc() { return window.innerWidth >= 900 ? FILM.hd : FILM.sd; }
function openBuilding() {
  if (building.frame || building.leaving || inside || clipShowing) return;
  picker.close(); building.birdsWereOn = birds.active; birds.active = false;
  building.frame = bBox; building.ended = false;
  bEnd.hidden = true; bLine.style.transform = 'scaleX(0)';
  const want = filmSrc(); if (bVid.getAttribute('src') !== want) { bVid.poster = FILM.poster; bVid.src = want; }   // gate A4: per open, not once
  bVid.currentTime = 0;
  bBox.style.display = 'block'; requestAnimationFrame(() => { bBox.style.opacity = '1'; });
  halted = true;
  bVid.play().catch((e) => { if (e && e.name === 'NotAllowedError' && building.frame) { bEnd.hidden = false; bEnd.dataset.state = 'blocked'; } });   // only a refused autoplay shows the actions (gate A4: not an AbortError)
  bBtn.style.display = 'none'; bClose.style.display = 'block'; bClose.focus();
  track('building_open', { film: bVid.getAttribute('src') });
}
function closeBuilding() {
  if (!building.frame) return;
  building.frame = null; bVid.pause(); bBox.style.opacity = '0'; bBox.style.display = 'none'; bClose.style.display = 'none'; bEnd.hidden = true;
  birds.active = building.birdsWereOn;
  if (halted && !inside) { halted = false; last = performance.now(); requestAnimationFrame(frame); }   // resume the hold's loop where it stopped
  bBtn.style.display = 'block'; bBtn.focus();
  track('building_close', { ended: building.ended, at_s: Math.round(bVid.currentTime * 10) / 10 });
}
bVid.addEventListener('timeupdate', () => { if (bVid.duration) bLine.style.transform = `scaleX(${bVid.currentTime / bVid.duration})`; });
bVid.addEventListener('ended', () => { building.ended = true; bEnd.hidden = false; bEnd.dataset.state = 'ended'; document.getElementById('buildingEnter').focus(); track('building_film_end'); });
document.getElementById('buildingAgain').addEventListener('click', () => { bEnd.hidden = true; bVid.currentTime = 0; bVid.play().catch(() => {}); });
document.getElementById('buildingBack').addEventListener('click', closeBuilding);
document.getElementById('buildingEnter').addEventListener('click', () => {
  track('building_enter'); building.leaving = true;
  const fd = document.getElementById('fade'); fd.style.zIndex = '30'; fd.style.opacity = 1; fadeAmbience();   // gate A4: above the film (z 20), so the fade is seen
  setTimeout(() => { location.href = tourUrl(); }, 650);                                                // the same hand-off as #enterBtn
});
bBtn.addEventListener('click', openBuilding);
bClose.addEventListener('click', closeBuilding);
document.addEventListener('keydown', (e) => {
  if (!building.frame) return;
  if (e.key === 'Escape') { closeBuilding(); return; }
  if (e.key === 'Tab') {   // gate A4: aria-modal means focus stays in the film (✕ and the visible end actions)
    const items = [bClose, ...(bEnd.hidden ? [] : [...bEnd.querySelectorAll('button')])];
    const i = items.indexOf(document.activeElement);
    const next = items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length] || bClose;
    e.preventDefault(); next.focus();
  }
});
window.__building = { get open() { return !!building.frame; }, get src() { return bVid.currentSrc || bVid.getAttribute('src'); }, get ended() { return building.ended; }, get video() { return bVid; } };

// ---- the apartment picker (Eliran 13:20: a pill on every relevant unit at the hold, status dot, same data as the :8850 shell) ----------
const holdPos = path.getPointAt(T_HOLD);
const facadeTangent = new THREE.Vector3(hotspot.x - holdPos.x, hotspot.y - holdPos.y, 0).normalize().applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const placed = placeUnits(unitsRaw, hotspot, facadeTangent);
const posById = new Map(placed.map((u) => [String(u.id), u.pos]));
const project = projectMeta;
{ const t = document.getElementById('clipTitle'); if (t) { const nm = (project.name && (project.name.he || project.name)) || 'Rainbow תל אביב'; const sub = (project.tagline && (project.tagline.he || project.tagline)) || (project.subtitle && project.subtitle.he) || 'שדה דב · על קו הים'; t.querySelector('.t1').textContent = typeof nm === 'string' ? nm : 'Rainbow תל אביב'; t.querySelector('.t2').textContent = typeof sub === 'string' ? sub : ''; } }
try { analytics.initAnalytics({ base: { project: project.id, lang: i18n.getLang(), surface: 'flyover3d' } }); } catch (e) { console.warn('analytics', e.message); }
// the SAME picker as flow.html (habait-ab's js/picker.js): pills, card, drawer, legend, lead/WhatsApp, analytics — one source of truth
const picker = createPicker({
  units: unitsRaw, container: document.getElementById('pickerStage'), i18n, analytics, project,
  canEnter: (u) => String(u.id) === '846',
  onEnter: (u) => { if (String(u.id) === '846') flyToApartment(); },
});
const isAtHold = () => !intro && !flying && !inside && Math.abs(t - T_HOLD) < 0.02 && !clipShowing;
// Units behind the facade we look at (habait-4b, card 19: 837/847/857 sit behind 846 from the hold, visible_frac 0.15) would land on the
// same pixel as the unit in front: a pill that is within 14 px of a NEARER unit's pill is hidden (it stays in the "דירות" drawer).
const screenPos = new Map();
function projectAll() {
  screenPos.clear(); if (!isAtHold()) return;
  const list = [];
  const useArc = arc && arc.active && !arc.pass;
  for (const u of placed) {
    if (useArc) { const a = arc.project(u.pos); list.push({ id: String(u.id), x: a.x, y: a.y, d: u.pos.distanceTo(camera.position), vis: a.visible }); continue; }
    const v = u.pos.clone().project(camera); list.push({ id: String(u.id), x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z, d: u.pos.distanceTo(camera.position), vis: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 });
  }
  for (const a of list) {
    let occluded = false;
    // a unit at least 4 m farther than another unit in the same screen column (14 px) within one floor's height (60 px) is behind it
    for (const b of list) { if (b === a) continue; if (b.d < a.d - 4 && Math.abs(a.x - b.x) < 14 && Math.abs(a.y - b.y) < 60) { occluded = true; break; } }
    screenPos.set(a.id, { x: a.x, y: a.y, visible: a.vis && !occluded });
  }
}
const projectUnit = (u) => screenPos.get(String(u.id)) || null;
console.log('units', placed.length, 'approximate positions', placed.filter((u) => u.approx).length);
const hotEl = document.getElementById('hot');
let holdEase = null, holdEaseLogged = false;
function updateHotspot() {
  const atHold = isAtHold();                                                     // the ease onto the units starts only once the clip is gone
  projectAll(); picker.update(projectUnit);
  document.getElementById('bar').style.display = (atHold || inside || clipShowing || !siteLoaded) ? 'none' : 'block';
  document.getElementById('info').style.display = atHold || inside || clipShowing ? 'none' : 'block';
  document.getElementById('hudButtons').style.display = (clipShowing || ((atHold || inside) && !siteLoaded)) ? 'none' : 'block';   // debug buttons only with the 3D site
  bBtn.style.display = atHold && !building.frame && !building.leaving ? 'block' : 'none';            // board hold-building-tour: only at the hold, after the clip
  if (atHold && holdEase === null) { holdEase = performance.now(); console.log('hold ease start ' + JSON.stringify({ intro: !!intro, flying, inside, t, T_HOLD, userLooked, units: placed.length })); }
  if (!atHold) holdEase = null;
  if (atHold && holdEase !== null && !userLooked) {
    const k = THREE.MathUtils.smoothstep((performance.now() - holdEase - 600) / 2000, 0, 1);
    const centroid = placed.length ? placed.reduce((a, u) => a.add(u.pos), new THREE.Vector3()).multiplyScalar(1 / placed.length) : hotspot;
    const aim = centroid.clone().sub(camera.position).normalize();
    lookDir.copy(holdLook()).lerp(aim, k).normalize(); controls.target.copy(camera.position).addScaledVector(lookDir, 0.01); camera.lookAt(controls.target); camera.up.set(0, 0, 1);
    if (k >= 0.99 && !holdEaseLogged) { holdEaseLogged = true; console.log('hold ease done, lookDir.z', lookDir.z.toFixed(3), 'cam dir z', camera.getWorldDirection(new THREE.Vector3()).z.toFixed(3)); }
  }
  hotEl.style.display = 'none';
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---- the cut from the orbit clip to the hold: when the clip is over AND the hold has rendered; never a black screen or text --------
let holdReady = false;
function hideOrbitClip() {
  orbit.done = true; clipShowing = false; showDragHint();   // Eliran 2026-11-04 (via rnd-67): no idle glide after the clip — its 4.5 fps drift of stills read as a freeze; the hold rests on the clip's end pose and moves only on drag
  document.getElementById('clipSkip').style.display = 'none'; lineEl.style.display = 'none'; document.getElementById('clipLegal').style.display = 'none';   // the picker chrome carries its own disclaimer at the hold
  clipEl.style.transition = 'opacity .5s'; clipEl.style.opacity = '0';
  setTimeout(() => { clipEl.style.display = 'none'; clipEl.pause(); clipEl.removeAttribute('src'); clipEl.load(); clipEl.style.opacity = '1'; }, 550);
  console.log(`orbit clip -> hold after ${Math.round(performance.now() - orbit.startedAt)} ms (ended ${orbit.ended} error ${orbit.error} skipped ${orbit.skipped})`);
}
// the drag affordance (v6, 3.11; Eliran on the hold after the video: "תקוע"): a quiet chip 1.5 s after the cut, gone on the first drag or after 9 s
function showDragHint() {
  const h = document.getElementById('dragHint'); if (!h || !arc) return;
  setTimeout(() => { if (halted || inside || arc.interacted) return; h.style.display = 'block'; requestAnimationFrame(() => h.classList.add('on'));
    const off = () => { h.classList.remove('on'); setTimeout(() => { h.style.display = 'none'; }, 700); };
    const poll = setInterval(() => { if (arc.interacted || halted || inside) { clearInterval(poll); off(); } }, 200); setTimeout(() => { clearInterval(poll); off(); }, 9000); }, 1500);
}
function clipGate() {
  if (!orbit || orbit.done) return;
  const over = orbit.ended || orbit.error || orbit.skipped;
  if (!over) return;
  if (holdReady) hideOrbitClip();
  else lineEl.style.display = 'block';                                           // the last frame of the clip (= the hold pose) + a thin progress line
}
let last = performance.now(), halted = false;
function frame(now) {
  if (halted) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (intro) { introStep(now); }
  else if (Math.abs(targetT - t) > 1e-4) { t += (targetT - t) * Math.min(1, dt * (flying ? 0.9 : 4)); if (Math.abs(targetT - t) < 1e-4) t = targetT; placeCamera(); }
  else if (flying && t >= 0.999 && !inside) { flying = false; inside = true; document.getElementById('enter').style.display = 'block'; status('הגענו למרפסת של דירה 846 · גררו להסתכל סביב'); }
  updateHotspot(); if (arc && arc.active && !arc.pass) arc.frame(now); else renderer.render(scene, camera); birds.frame(now); clipGate(); requestAnimationFrame(frame);
}
renderer.compile(scene, camera); renderer.render(scene, camera);                 // the first (shader-compiling) frame happens behind the clip
setLine(1); holdReady = true; if (loadEl) loadEl.remove(); if (!orbit) showDragHint();   // no idle glide (see hideOrbitClip)
window.__hold = { get arc() { return arc && { active: arc.active, index: arc.index, loaded: arc.loaded, N: arc.N, pass: arc.pass, mode: arc.mode, tracks: arc.tracks }; }, get sphere() { return { on: sphere.on, fov: camera.fov, look: [lookDir.x, lookDir.y, lookDir.z].map((v) => Math.round(v * 1000) / 1000) }; }, get ready() { return holdReady; }, get siteLoaded() { return siteLoaded; }, get clipShowing() { return clipShowing; }, nodesReady: () => nodes.map((n) => n.ready), units: placed.length };
requestAnimationFrame(frame);
// background: the terrace node (the landing after the descent clip), then the rest — never the glb
loadNodeTex(nodes[N - 1]).then(() => Promise.all(nodes.map((n) => loadNodeTex(n)))).then(() => console.log('all nodes loaded')).catch((e) => console.warn('node textures', e.message));

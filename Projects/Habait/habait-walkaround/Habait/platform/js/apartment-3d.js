// The apartment dollhouse viewer: one GLB, orbit controls, auto-rotate until the buyer touches it.
// Used by the standalone `dollhouse.html` that tools/build_zip.mjs writes (three + this module inlined as data: URLs,
// the GLB inlined as base64), so it opens offline from a ZIP. Imports go through the page's import map.
// Card 10 (B4b) adds: three camera presets (3D / Top / Outdoor) with an RTL button bar and an animated move between them;
// a split between prepare (base64 -> GLB parse incl. the Draco decode, no WebGL) and mount (renderer + first frame), so the
// apartment page can preload the tab while the buyer is in the tour and open it instantly; and the floor finish
// (parquet / concrete / marble): card 09's three GLBs share one byte-identical BIN chunk and differ only in the interior
// floor material, so switching = applying that GLB's floor material (the factors are read from the GLBs at build time).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function base64ToArrayBuffer(b64) {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// Draco (card 09's Blender export uses KHR_draco_mesh_compression): the decoder comes inlined, never fetched.
// draco = { wrapper: <draco_wasm_wrapper.js text>, wasm: <draco_decoder.wasm ArrayBuffer> }
function inlineDraco({ wrapper, wasm }) {
  const d = new DRACOLoader();
  d.setDecoderConfig({ type: 'wasm' });
  d._loadLibrary = (url) => Promise.resolve(url.endsWith('.wasm') ? wasm : wrapper);
  return d;
}

// ---------- presets (pure maths, testable in node) ----------
export const PRESET_IDS = ['3d', 'top', 'outdoor'];
export const PRESET_LABELS = {
  he: { '3d': 'תלת-ממד', top: 'מלמעלה', outdoor: 'מבחוץ', group: 'זווית צפייה' },
  en: { '3d': '3D', top: 'Top', outdoor: 'Outdoor', group: 'View' },
};
// board apartment-3d card 03: the room labels and the room sheet
export const STR = {
  he: { sqm: 'מ״ר', view360: 'צפו ב-360°', close: 'סגירה', rooms: 'חדרי הדירה' },
  en: { sqm: 'm²', view360: 'View in 360°', close: 'Close', rooms: 'Rooms' },
};
const deg = Math.PI / 180;

// size: [x, y, z] of the centred model (floor at y = 0, footprint centred on x = z = 0);
// outdoor: [x, z] centre of the outdoor floors (terraces) in the same frame, or null; fovDeg: vertical fov; aspect: w/h.
// Returns { id: { position: [x,y,z], target: [x,y,z] } }. Top keeps the plan's up (-z, the drawing's top) at the top of the
// screen, the same orientation as the minimap and the plan tab.
// points: optional [[x,y,z], ...] silhouette of the model (prepareDollhouse's per-height-band hulls), used instead of the
// box; band: the fraction of the frame height that is free of overlays (the preset bar on top, the caption below) — the
// model is fitted into that band, and mountDollhouse shifts the view so the band's centre is the frame's centre.
// The 3D preset also carries orbit[24]: the framing distance per azimuth (k * 15 degrees), followed by the auto-rotation.
export function computePresets({ size, outdoor = null, fovDeg = 40, aspect = 1, hull = null, points = null, band = 1 }) {
  const sy = size[1];
  // the model's real outline when known (silhouette points, else its footprint's convex hull x its height); the box otherwise
  const pts = points && points.length >= 3 ? points.map((p) => new THREE.Vector3(p[0], p[1], p[2])) : boxPoints(size, hull);
  const fitBox = (c, dir, target, fov, asp, fx, fy) => fitBoxRaw(c, dir, target, fov, asp, fx, fy * Math.max(0.3, Math.min(1, band)));
  const out = {};
  const at = (target, dir, d) => ({ position: [target[0] + dir.x * d, target[1] + dir.y * d, target[2] + dir.z * d], target });
  // 3D: the 3/4 dollhouse view (the direction card 23 shipped). Board apartment-3d card 05: framed on the model's
  // silhouette to fill ~90 % of the free band (it filled ~55 % of the width before); every azimuth of the auto-rotation
  // stays inside the whole frame (it may pass under the translucent bar or caption, never off-screen)
  {
    const dir = new THREE.Vector3(1.25, 1.7, 1.65).normalize();
    // the orbit point's height is solved so the model's projection is centred vertically (a fixed 0.3 x height left the
    // near edge on the caption and an empty strip under the bar)
    const target = centreY(pts, dir, [0, sy * 0.3, 0], fovDeg, aspect, (t) => fitBox(pts, dir, t, fovDeg, aspect, 0.92, 0.92));
    const d = fitBox(pts, dir, target, fovDeg, aspect, 0.92, 0.92);
    // the auto-rotation follows the model: per azimuth, the distance that frames it the same way (24 steps, sampled
    // between); the camera eases in and out as it turns instead of backing off for the widest angle
    const el = Math.asin(dir.y);
    const orbit = [];
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * 2 * Math.PI;
      const v = new THREE.Vector3(Math.cos(el) * Math.sin(a), Math.sin(el), Math.cos(el) * Math.cos(a));
      orbit.push(+fitBox(pts, v, target, fovDeg, aspect, 0.92, 0.92).toFixed(4));
    }
    out['3d'] = { ...at(target, dir, d), orbit };
  }
  // Top: straight down, plan-up = screen-up (a hair of +z so the orbit keeps its azimuth); room for the preset bar on top
  // and the caption pill at the bottom
  {
    const dir = new THREE.Vector3(0, 1, 1e-3).normalize();
    const d = fitBox(pts, dir, [0, 0, 0], fovDeg, aspect, 0.92, 0.9);
    out.top = { position: [0, d * dir.y, d * dir.z], target: [0, 0, 0] };
  }
  // Outdoor: from outside, on the terrace side, low (22 degrees), looking back into the apartment
  {
    let dx = 0; let dz = 1;
    if (outdoor && Math.hypot(outdoor[0], outdoor[1]) > 0.05) { const l = Math.hypot(outdoor[0], outdoor[1]); dx = outdoor[0] / l; dz = outdoor[1] / l; }
    const el = 22 * deg;
    const dir = new THREE.Vector3(dx * Math.cos(el), Math.sin(el), dz * Math.cos(el));
    const target = [0, Math.min(1.0, sy * 0.45), 0];
    out.outdoor = at(target, dir, fitBox(pts, dir, target, fovDeg, aspect, 0.92, 0.8));
  }
  return out;
}

// the camera distance along dir (unit, from target) at which the model's box [x centred, y 0..sy, z centred] fills at most
// fx of the frame's half-width and fy of its half-height (NDC). Pure math, runs in node (the presets test).
function boxPoints(size, hull) {
  const [sx, sy, sz] = size;
  const foot = hull && hull.length >= 3 ? hull : [[-sx / 2, -sz / 2], [sx / 2, -sz / 2], [sx / 2, sz / 2], [-sx / 2, sz / 2]];
  const out = [];
  for (const [x, z] of foot) for (const y of [0, sy]) out.push(new THREE.Vector3(x, y, z));
  return out;
}
// the 2D convex hull (monotone chain) of [x, z] points
function convexHull(points) {
  const P = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const p of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  const up = []; for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// moves target along world y until the points' projection (camera on dir at fit(target)) is centred vertically
function centreY(points, dir, target, fovDeg, aspect, fit) {
  const cam = new THREE.PerspectiveCamera(fovDeg, aspect, 0.01, 1e5);
  const t = target.slice();
  const p = new THREE.Vector3();
  for (let it = 0; it < 6; it++) {
    const d = fit(t);
    const T = new THREE.Vector3(...t);
    cam.position.copy(T).addScaledVector(dir, d);
    cam.lookAt(T);
    cam.updateMatrixWorld(true);
    let lo = Infinity; let hi = -Infinity;
    for (const c of points) { p.copy(c).project(cam); lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
    const cy = (lo + hi) / 2; // NDC
    if (Math.abs(cy) < 0.005) break;
    // NDC -> metres at the target's distance, then along world y (screen-up tilts by the view's elevation)
    const half = Math.tan((fovDeg * deg) / 2) * d;
    const up = Math.max(0.3, Math.sqrt(1 - dir.y * dir.y));
    t[1] += (cy * half) / up;
  }
  return t;
}
function fitBoxRaw(corners, dir, target, fovDeg, aspect, fx, fy) {
  const cam = new THREE.PerspectiveCamera(fovDeg, aspect, 0.01, 1e5);
  const T = new THREE.Vector3(...target);
  const p = new THREE.Vector3();
  const over = (d) => {
    cam.position.copy(T).addScaledVector(dir, d);
    cam.lookAt(T);
    cam.updateMatrixWorld(true);
    let m = 0;
    for (const c of corners) {
      p.copy(c).project(cam);
      if (p.z > 1 || p.z < -1) return Infinity; // a corner behind the camera: too close
      m = Math.max(m, Math.abs(p.x) / fx, Math.abs(p.y) / fy);
    }
    return m;
  };
  let lo = 0.05; let hi = 1e4;
  for (let i = 0; i < 60; i++) { const mid = Math.sqrt(lo * hi); if (over(mid) > 1) lo = mid; else hi = mid; }
  return hi;
}

// where a label may sit around its room's anchor before it gives way: on it, a row above or below, then half a label to
// either side (still over the room on any room bigger than a label)
const LABEL_SPOTS = (lw, lh) => {
  const v = lh + 3; const h = lw / 2 + 4;
  return [[0, 0], [0, -v], [0, v], [h, 0], [-h, 0], [h, -v], [-h, -v], [h, v], [-h, v]];
};

// the baked light's gain: three's lightMap is irradiance (x albedo / PI), Cycles' light-only diffuse pass is radiance
// already divided out, so PI brings it back; the rest is the exposure the tour's palette reads best at (tuned on screen)
export const LIGHT_GAIN = Math.PI * 0.45; // tuned on screen: 0.35 dark, 0.65 washed out (after/phase2/tune_strip.png)
// with the baked light the live lights only add form and the ground shadow (else the light is doubled)
export const LIVE_LIGHTS = { plain: { hemi: 1.05, sun: 1.9, env: 0.45 }, baked: { hemi: 0.25, sun: 0.7, env: 0.18 } };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------- prepare: bytes -> scene graph (no WebGL; safe to run while the tab is hidden) ----------
// lightmap: optional ArrayBuffer (light.webp from export_dollhouse --bake-light, board apartment-3d card 08) baked on the
// GLB's TEXCOORD_0; lightScale: the bake's encode scale (texel = sRGB(irradiance x scale)).
// floorTextures: optional { <floor id>: ArrayBuffer } (floor-<id>.webp, card 08b), floorTileM metres per repeat,
// floorDefault: the finish shown first.
export async function prepareDollhouse({ glb, draco = null, lightmap = null, lightScale = null, floorTextures = null, floorTileM = 2, floorDefault = null }) {
  const t0 = performance.now();
  const loader = new GLTFLoader();
  const dracoLoader = draco ? inlineDraco(draco) : null;
  if (dracoLoader) loader.setDRACOLoader(dracoLoader);
  const gltf = await new Promise((ok, fail) => loader.parse(glb, '', ok, fail));
  dracoLoader?.dispose();
  const model = gltf.scene;
  let triangles = 0;
  let meshes = 0;
  const floorMats = new Set();
  // gate 3 (D1): the export's floorfill lies coplanar under every floor; its own copy of the floor materials is pushed
  // back in depth, so the floor always draws over it (no z-fighting stripes)
  const pushed = new Map();
  model.traverse((o) => {
    if (!o.isMesh || !/^floorfill/.test(o.name)) return;
    const back = (m) => {
      if (!m) return m;
      if (!pushed.has(m)) { const c = m.clone(); c.polygonOffset = true; c.polygonOffsetFactor = 2; c.polygonOffsetUnits = 2; pushed.set(m, c); }
      return pushed.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(back) : back(o.material);
  });
  model.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      o.castShadow = true;
      o.receiveShadow = true;
      const g = o.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
      for (const m of [].concat(o.material)) if (m && /^web_floor_/.test(m.name) && !/outdoor|wet/.test(m.name)) floorMats.add(m);
    }
  });
  // centre on the floor; remember the shift so plan cm can be placed (model x = x_cm/100 - shift.x, z = y_cm/100 - shift.z)
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const shift = new THREE.Vector3(centre.x, box.min.y, centre.z);
  model.position.sub(shift);
  model.updateMatrixWorld(true);
  // the outdoor floors (card 09 extras: habait_kind 'floor', room_is_outdoor) -> the side the Outdoor preset looks from
  let ox = 0; let oz = 0; let oa = 0;
  model.traverse((o) => {
    const x = o.userData || {};
    if (x.habait_kind === 'floor' && x.room_is_outdoor) {
      const b = new THREE.Box3().setFromObject(o);
      const c = b.getCenter(new THREE.Vector3());
      const a = x.room_area_m2 || 1;
      ox += c.x * a; oz += c.z * a; oa += a;
    }
  });
  // the footprint's convex hull (card 05): frames the presets on the model's real outline, not its bounding box
  const foot = [];
  const vv = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { vv.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); foot.push([vv.x, vv.z]); }
  });
  const hull = convexHull(foot);
  // the silhouette (card 05): the footprint hull of each 0.25 m height band, lifted to the band's top. The prism
  // hull x full height overstated the 3/4 view (a 2.2 m kitchen tower made every 1.2 m wall count as 2.2 m tall)
  const bands = new Map();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      vv.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const k = Math.max(0, Math.ceil(vv.y / 0.25));
      if (!bands.has(k)) bands.set(k, []);
      bands.get(k).push([vv.x, vv.z]);
    }
  });
  const silhouette = [];
  for (const [k, pts] of [...bands.entries()].sort((a, b) => a[0] - b[0])) {
    const y = Math.min(k * 0.25, size.y);
    for (const [x, z] of convexHull(pts)) silhouette.push([x, y, z], [x, Math.max(0, y - 0.25), z]);
  }
  const rooms = [];
  model.traverse((o) => {
    const x = o.userData || {};
    if (x.habait_kind !== 'floor') return;
    // board apartment-3d card 03: the floor's centre and footprint anchor the room's label and the camera focus
    const b = new THREE.Box3().setFromObject(o);
    const c = b.getCenter(new THREE.Vector3());
    rooms.push({
      id: x.room_id, name: x.room_name_en, type: x.room_type, area_m2: x.room_area_m2, outdoor: !!x.room_is_outdoor,
      centre: [c.x, b.max.y, c.z], half: [(b.max.x - b.min.x) / 2, (b.max.z - b.min.z) / 2], node: o,
    });
  });
  // the baked light: every lit surface with UVs wears it (not glass, not the caps); the colour factors stay live,
  // so the floor switch still works (the bake is light-only)
  let light = null;
  if (lightmap && lightScale) {
    const bmp = await createImageBitmap(new Blob([lightmap], { type: 'image/webp' }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const tex = new THREE.Texture(bmp);
    tex.flipY = false;
    tex.channel = 0;
    tex.colorSpace = THREE.SRGBColorSpace;
    // mipmaps ON (gate 3, D1): without them the 2048 atlas aliases into dark stripe blocks when the model is small on
    // screen (the embedded tab). The thin-island 'barcode' they were once switched off for is cured in the bake
    // (export_dollhouse collapses islands under 2 texels), so the small mip levels have nothing thin to smear.
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const mats = new Set();
    model.traverse((o) => {
      if (!o.isMesh || !o.geometry.attributes.uv) return;
      for (const m of [].concat(o.material)) if (m && m.name !== 'glass' && m.name !== 'web_cap') mats.add(m);
    });
    for (const m of mats) { m.lightMap = tex; m.lightMapIntensity = LIGHT_GAIN / lightScale; m.needsUpdate = true; }
    light = { tex, scale: lightScale, materials: mats.size, px: bmp.width };
  }
  // board apartment-3d card 08b: the floors wear their REAL finish, taken from the tour's own panoramas
  // (floor_textures.py: a rectified, de-lit, tileable square per finish), repeated in world metres over every interior
  // floor (a second UV: plan x/z), under the baked light. Decoded lazily: the shown finish now, the others on switch.
  let floorTex = null;
  const fids = floorTextures ? Object.keys(floorTextures) : [];
  if (fids.length && floorMats.size) {
    const tileM = floorTileM || 2;
    const decode = async (id) => {
      const bmp = await createImageBitmap(new Blob([floorTextures[id]], { type: 'image/webp' }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const t = new THREE.Texture(bmp);
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.channel = 1;
      t.anisotropy = 8;
      t.needsUpdate = true;
      return t;
    };
    const p = new THREE.Vector3();
    model.traverse((o) => {
      if (!o.isMesh || !o.geometry.attributes.uv) return;
      if (![].concat(o.material).some((m) => floorMats.has(m))) return;
      const pos = o.geometry.attributes.position;
      const uv1 = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        uv1[i * 2] = p.x / tileM;
        uv1[i * 2 + 1] = p.z / tileM;
      }
      o.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    });
    const texs = {};
    floorTex = {
      ids: fids, current: null, tileM,
      want: null,
      async use(id) {
        if (!floorTextures[id]) return false;
        this.want = id;                                  // gate 3 (D4): the last request wins, a slow decode cannot
        if (!texs[id]) texs[id] = await decode(id);      // overwrite a later switch
        if (this.want !== id) return false;
        for (const m of floorMats) { m.map = texs[id]; m.color.setRGB(1, 1, 1); m.needsUpdate = true; }
        this.current = id;
        return true;
      },
    };
    await floorTex.use(floorDefault && floorTextures[floorDefault] ? floorDefault : fids[0]);
  }
  return {
    model, meshes, triangles: Math.round(triangles), size, shift, floorMats: [...floorMats], rooms, hull, silhouette, light, floorTex,
    outdoor: oa ? [ox / oa, oz / oa] : null, prepare_ms: Math.round(performance.now() - t0),
  };
}

// el: container; glb: ArrayBuffer (or prepared: prepareDollhouse()). Options (all optional):
//   ui: element for the preset bar; lang: 'he' | 'en'; preset: initial preset ('3d');
//   floors: { <id>: { color: [r,g,b] linear, roughness, metalness } }; floor: initial floor id.
// Returns { scene, camera, renderer, stats, setPreset, setFloor, dispose }.
export async function mountDollhouse(el, {
  glb, draco = null, prepared = null, background = null, autoRotate = true,
  ui = null, lang = 'he', preset = '3d', floors = null, floor = null,
  rooms: roomInfo = null, onEnterRoom = null, touchScroll = false, insets = null,
} = {}) {
  // insets(): { top, bottom } css px of the frame covered by overlays (the preset bar, the caption); the model is framed
  // into the band between them and the labels never sit under them
  const band = { top: 0, bottom: 0 };
  const readInsets = () => {
    const i = (typeof insets === 'function' ? insets() : insets) || {};
    band.top = Math.max(0, +i.top || 0);
    band.bottom = Math.max(0, +i.bottom || 0);
  };
  const t0 = performance.now();
  const P = prepared || await prepareDollhouse({ glb, draco });
  const { model, size } = P;

  // board apartment-3d card 05, the look: a transparent canvas over the page's warm gradient (the tour's palette), neutral
  // tone mapping, a soft room environment, warm grey wall caps with a dark edge, glass that never writes depth
  const phone = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || Math.min(screen.width || 9999, screen.height || 9999) < 600;
  // stencil: the glass is drawn at most once per pixel (no darker lines where panes and pane sides overlap)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.opacity = '0';
  renderer.domElement.style.transition = 'opacity .4s ease';
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = background ? new THREE.Color(background) : null;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envTex;
  const LL = P.light ? LIVE_LIGHTS.baked : LIVE_LIGHTS.plain;
  scene.environmentIntensity = LL.env;
  scene.add(new THREE.HemisphereLight(0xfbf7ef, 0x8c8478, LL.hemi));
  const sun = new THREE.DirectionalLight(0xfff3e2, LL.sun);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;      // no shadow acne (stripes) on the double-sided walls and floors
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  // glass = a flat, unlit tint drawn once per pixel (the architect's-model look): lit glass shaded its pane fronts and
  // edge-on pane sides differently, and overlapping panes stacked, which read as stripes along the terrace rail
  const glassSwap = new Map();
  const flatGlass = (m) => {
    if (!glassSwap.has(m)) {
      const g = new THREE.MeshBasicMaterial({ name: 'glass', color: m.color, opacity: Math.min(0.22, Math.max(0.12, m.opacity)), transparent: true, depthWrite: false, side: THREE.DoubleSide });
      // the first glass fragment marks the stencil, later ones at that pixel are skipped
      g.stencilWrite = true; g.stencilRef = 1; g.stencilFunc = THREE.NotEqualStencilFunc;
      g.stencilZPass = THREE.ReplaceStencilOp; g.stencilFail = THREE.KeepStencilOp; g.stencilZFail = THREE.KeepStencilOp;
      glassSwap.set(m, g);
    }
    return glassSwap.get(m);
  };
  model.traverse((o) => {
    if (!o.isMesh) return;
    const mats = [].concat(o.material);
    if (mats.some((m) => m && m.name === 'glass' && !m.isMeshBasicMaterial)) {
      o.material = Array.isArray(o.material) ? o.material.map((m) => (m && m.name === 'glass' ? flatGlass(m) : m)) : flatGlass(o.material);
    }
    if (mats.some((m) => m && m.name === 'glass')) {
      o.renderOrder = 1;
      o.castShadow = false;
      o.receiveShadow = false;
    }
    if (mats.some((m) => m && m.name === 'web_cap') && !o.userData.__capEdge) {
      for (const m of mats) if (m && m.name === 'web_cap') { m.color.setRGB(0.36, 0.34, 0.31, THREE.LinearSRGBColorSpace); m.roughness = 0.9; m.metalness = 0; m.needsUpdate = true; }
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), new THREE.LineBasicMaterial({ color: 0x4a433b }));
      edge.raycast = () => {};
      o.add(edge);
      o.userData.__capEdge = true;
    }
  });

  // render on demand (card 05): a frame is drawn only while something moves or changes; idle = no GPU work
  let dirty = true;
  const invalidate = () => { dirty = true; };
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49; // never under the floor
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 0.8;
  let anim = null;
  // embedded in the page on a phone: a vertical swipe scrolls the page, a horizontal drag orbits, a pinch zooms
  // (OrbitControls sets touch-action:none on its element; card 04 of board apartment-3d overrides it when asked)
  if (touchScroll) renderer.domElement.style.touchAction = 'pan-y';
  const stopAuto = () => { controls.autoRotate = false; anim = null; };
  controls.addEventListener('change', invalidate);
  renderer.domElement.addEventListener('pointerdown', stopAuto);
  renderer.domElement.addEventListener('wheel', stopAuto, { passive: true });

  scene.add(model);
  const radius = Math.max(size.x, size.z, size.y) * 0.5 || 1;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(radius * 3, 48), new THREE.ShadowMaterial({ opacity: 0.16, color: 0x3a2f22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -radius * 1.5;
  sun.shadow.camera.right = sun.shadow.camera.top = radius * 1.5;
  sun.shadow.camera.updateProjectionMatrix();
  controls.minDistance = radius * 0.4;
  controls.maxDistance = radius * 6;

  let presets = null;
  const state = { preset: null, floor: null, floorColor: null };
  const frameH = () => el.clientHeight || 1;
  const bandFrac = () => Math.max(0.3, 1 - (band.top + band.bottom) / frameH());
  const presetsFor = () => computePresets({ size: size.toArray(), outdoor: P.outdoor, fovDeg: camera.fov, aspect: camera.aspect || 1, hull: P.hull, points: P.silhouette, band: bandFrac() });
  // a preset move owns the camera: the orbit's damping momentum (left over from auto-rotation or a drag) is dropped, or it
  // would keep nudging the camera and drawing frames for seconds after the move (card 05, render on demand)
  const stopMomentum = () => {
    controls._sphericalDelta?.set(0, 0, 0);
    controls._panOffset?.set(0, 0, 0);
    if ('_scale' in controls) controls._scale = 1;
  };

  function setPreset(id, { animate = true, ms = 750 } = {}) {
    if (!PRESET_IDS.includes(id)) id = '3d';
    readInsets();
    presets = presetsFor();
    const p = presets[id];
    const to = { pos: new THREE.Vector3(...p.position), target: new THREE.Vector3(...p.target) };
    if (id !== '3d' || state.preset) controls.autoRotate = false;
    if (!controls.autoRotate) stopMomentum();
    if (animate && state.preset) anim = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to, t0: performance.now(), ms };
    else { camera.position.copy(to.pos); controls.target.copy(to.target); anim = null; controls.update(); }
    state.preset = id;
    invalidate();
    if (bar) for (const b of bar.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.preset === id));
    return id;
  }

  function setFloor(id) {
    const f = floors && floors[id];
    if (!f || !P.floorMats.length) return false;
    // card 08b: a finish with a real texture shows it (the colour factor stays white); else the flat colour as before
    const textured = P.floorTex && P.floorTex.ids.includes(id);
    if (textured) P.floorTex.use(id).then(() => invalidate());
    for (const m of P.floorMats) {
      if (f.color && !textured) m.color.setRGB(f.color[0], f.color[1], f.color[2], THREE.LinearSRGBColorSpace);
      if (f.roughness != null) m.roughness = f.roughness;
      if (f.metalness != null) m.metalness = f.metalness;
      m.needsUpdate = true;
    }
    state.floor = id;
    invalidate();
    // linear; gate 3 (D3): with a texture the material factor is white, so report the finish's own colour
    state.floorColor = (textured && f.color ? f.color : P.floorMats[0].color.toArray()).map((v) => +(+v).toFixed(4));
    return true;
  }

  // the RTL preset bar (3 buttons; the page is Hebrew first)
  let bar = null;
  if (ui) {
    const L = PRESET_LABELS[lang] || PRESET_LABELS.he;
    bar = document.createElement('div');
    bar.className = 'dh-presets';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', L.group);
    bar.dir = lang === 'he' ? 'rtl' : 'ltr';
    for (const id of PRESET_IDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.preset = id;
      b.textContent = L[id];
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => setPreset(id));
      bar.appendChild(b);
    }
    ui.appendChild(bar);
  }

  function resize() {
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    readInsets();
    // centre the projection on the free band between the overlays (a shift, no zoom: labels and taps use the same matrix)
    const dy = (band.top - band.bottom) / 2;
    if (Math.abs(dy) > 0.5) camera.setViewOffset(w, h, 0, -dy, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (presets) presets = presetsFor(); // the auto-rotation's per-azimuth framing follows the new aspect
    invalidate();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  if (floor) setFloor(floor);
  setPreset(preset, { animate: false });

  // ---------- board apartment-3d card 03: room labels, tap a room, the room sheet ----------
  const S = STR[lang] || STR.he;
  const info = new Map((roomInfo || []).map((r) => [r.room_id, r]));
  const roomList = P.rooms.filter((r) => r.id && r.node).map((r) => {
    const i = info.get(r.id) || {};
    return { ...r, he: i.he || r.name || r.id, en: i.en || r.name || r.id, area: i.area_m2 ?? r.area_m2 ?? null, scene: i.scene || null };
  });
  const roomName = (r) => (lang === 'en' ? r.en : r.he);
  const areaTxt = (r) => (r.area != null ? `${Math.round(r.area)}` : '');
  const layer = document.createElement('div');
  layer.className = 'dh-labels';
  layer.style.opacity = '0';
  layer.style.transition = 'opacity .4s ease';
  el.appendChild(layer);
  for (const r of roomList) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dh-label';
    b.dataset.room = r.id;
    const n = document.createElement('span'); n.className = 'n'; n.textContent = roomName(r);
    b.appendChild(n);
    if (r.area != null) {
      const a = document.createElement('span'); a.className = 'a';
      const bd = document.createElement('bdi'); bd.textContent = areaTxt(r);
      a.append(bd, ` ${S.sqm}`);
      b.appendChild(a);
    }
    b.setAttribute('aria-label', `${roomName(r)}${r.area != null ? `, ${areaTxt(r)} ${S.sqm}` : ''}`);
    b.addEventListener('click', (e) => { e.stopPropagation(); select(r.id); });
    layer.appendChild(b);
    r.label = b;
  }
  // the sheet: name, area, "view in 360" (only when the page can open the tour), close
  const sheet = document.createElement('div');
  sheet.className = 'dh-sheet';
  sheet.dir = lang === 'he' ? 'rtl' : 'ltr';
  sheet.hidden = true;
  sheet.innerHTML = '<div class="t"><b></b><span></span></div><button type="button" class="go"></button><button type="button" class="x"></button>';
  const [sName, sArea] = [sheet.querySelector('.t b'), sheet.querySelector('.t span')];
  const sGo = sheet.querySelector('.go');
  const sX = sheet.querySelector('.x');
  sGo.textContent = S.view360;
  sX.textContent = '×';
  sX.setAttribute('aria-label', S.close);
  sX.addEventListener('click', (e) => { e.stopPropagation(); select(null); });
  sGo.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = roomList.find((x) => x.id === state.selected);
    if (r && r.scene && onEnterRoom) onEnterRoom({ scene: r.scene, room_id: r.id });
  });
  el.appendChild(sheet);
  // highlight = a translucent copy of the room's floor laid just above it (no shared material is touched)
  let glow = null;
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff6e2, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  function setGlow(r) {
    invalidate();
    if (glow) { scene.remove(glow); glow = null; }
    if (!r) return;
    glow = new THREE.Group();
    r.node.updateMatrixWorld(true);
    r.node.traverse((o) => {
      if (!o.isMesh) return;
      const m = new THREE.Mesh(o.geometry, glowMat);
      m.matrixAutoUpdate = false;
      m.matrix.copy(o.matrixWorld);
      m.matrix.premultiply(new THREE.Matrix4().makeTranslation(0, 0.004, 0));
      m.renderOrder = 2;
      glow.add(m);
    });
    scene.add(glow);
  }
  state.selected = null;
  function select(id) {
    const r = id ? roomList.find((x) => x.id === id) : null;
    state.selected = r ? r.id : null;
    for (const x of roomList) x.label.classList.toggle('sel', x === r);
    setGlow(r);
    if (!r) { sheet.hidden = true; return null; }
    sName.textContent = roomName(r);
    sArea.textContent = r.area != null ? `${areaTxt(r)} ${S.sqm}` : '';
    sGo.hidden = !(r.scene && onEnterRoom);
    sheet.hidden = false;
    // ease the camera to the room: same azimuth, a 3/4 look down, the room's footprint in frame
    controls.autoRotate = false;
    stopMomentum();
    const target = new THREE.Vector3(r.centre[0], 0, r.centre[2]);
    const off = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.phi = Math.min(sph.phi, 55 * deg);
    const vf = camera.fov * deg;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * (camera.aspect || 1));
    const rad = Math.max(1.6, Math.hypot(r.half[0], r.half[1]) * 1.15);
    sph.radius = Math.max(controls.minDistance, Math.min(controls.maxDistance, Math.max(rad / Math.tan(hf / 2), rad / Math.tan(vf / 2))));
    const pos = target.clone().add(new THREE.Vector3().setFromSpherical(sph));
    anim = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to: { pos, target }, t0: performance.now(), ms: 650 };
    return r.id;
  }
  // board dollhouse-in-tour (2026-11-03): "you are here" — the 360 tour's camera point and its view cone on the floor.
  // h = { x_cm, y_cm } (plan cm = GLB metres x 100), bearingDeg (plan: 0 = up = -z, clockwise), fovDeg, room_id; null clears.
  let here = null;
  const hereMats = {
    wedge: new THREE.MeshBasicMaterial({ color: 0xf2a900, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    ring: new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, toneMapped: false }),
    dot: new THREE.MeshBasicMaterial({ color: 0x1d1a16, depthWrite: false, toneMapped: false }),
  };
  function setHere(h) {
    if (!h || !Number.isFinite(h.x_cm) || !Number.isFinite(h.y_cm)) {
      if (here) { scene.remove(here.group); here.wedge.geometry.dispose(); here = null; }
      state.here = null;
      invalidate();
      return null;
    }
    const x = h.x_cm / 100 - P.shift.x;
    const z = h.y_cm / 100 - P.shift.z;
    const fov = Math.min(150, Math.max(30, Number(h.fovDeg) || 90)) * deg;
    const b = (Number(h.bearingDeg) || 0) * deg;
    if (!here) {
      const flat = (geo, mat, y, order) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = order; m.raycast = () => {}; return m; };
      const group = new THREE.Group();
      const wedge = flat(new THREE.CircleGeometry(2.4, 40, 0, 1), hereMats.wedge, 0, 3);
      group.add(wedge, flat(new THREE.RingGeometry(0.15, 0.23, 40), hereMats.ring, 0.002, 4), flat(new THREE.CircleGeometry(0.15, 32), hereMats.dot, 0.003, 4));
      scene.add(group);
      here = { group, wedge, key: '' };
    }
    here.group.position.set(x, 0.03, z);
    // after rotation.x = -PI/2 a circle's angle t points at (cos t, 0, -sin t); the bearing points at (sin b, 0, -cos b): t = PI/2 - b
    const key = `${b.toFixed(3)}|${fov.toFixed(3)}`;
    if (key !== here.key) {
      here.wedge.geometry.dispose();
      here.wedge.geometry = new THREE.CircleGeometry(2.4, 40, Math.PI / 2 - b - fov / 2, fov);
      here.key = key;
    }
    state.here = { x: +x.toFixed(3), z: +z.toFixed(3), bearingDeg: +(b / deg).toFixed(1), fovDeg: +(fov / deg).toFixed(1), room: h.room_id || null };
    invalidate();
    return state.here;
  }

  // tap (not drag) on a floor selects its room; a tap on empty space deselects
  const ray = new THREE.Raycaster();
  const floorNodes = roomList.map((r) => r.node);
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 600) { down = null; return; }
    down = null;
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(floorNodes, true)[0];
    let o = hit && hit.object;
    while (o && !(o.userData && o.userData.habait_kind === 'floor')) o = o.parent;
    select(o ? o.userData.room_id : null);
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.selected) select(null); });  // labels follow the model every frame; overlapping ones give way to the bigger room (the selected one always shows)
  const v3 = new THREE.Vector3();
  let labelsVisible = 0;
  function placeLabels() {
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    const items = [];
    for (const r of roomList) {
      v3.set(r.centre[0], r.centre[1] + 0.05, r.centre[2]).project(camera);
      if (v3.z > 1 || v3.z < -1) { r.label.hidden = true; continue; }
      items.push({ r, x: (v3.x * 0.5 + 0.5) * w, y: (-v3.y * 0.5 + 0.5) * h });
    }
    items.sort((a, b) => (b.r.id === state.selected) - (a.r.id === state.selected) || (b.r.area || 0) - (a.r.area || 0));
    const placed = [];
    labelsVisible = 0;
    // a label's size, measured once per form (full / mini) while shown; a hidden label measures 0
    // forms: false = full, true = mini, 'bare' = mini without the area (the sheet and the aria-label keep it)
    const sizeOf = (r, mini) => {
      const k = mini === 'bare' ? 'bare' : mini ? 'mini' : 'full';
      r.sz = r.sz || {};
      if (!r.sz[k]) {
        const L = r.label; const was = [L.hidden, L.classList.contains('mini'), L.classList.contains('bare')];
        L.hidden = false; L.classList.toggle('mini', !!mini); L.classList.toggle('bare', mini === 'bare');
        r.sz[k] = [L.offsetWidth || (mini ? 70 : 90), L.offsetHeight || (mini ? 20 : 26)];
        L.hidden = was[0]; L.classList.toggle('mini', was[1]); L.classList.toggle('bare', was[2]);
      }
      return r.sz[k];
    };
    const fit = (it, lw, lh, spots) => {
      for (const [dx, dy] of spots) {
        const b = { x0: it.x + dx - lw / 2 - 3, x1: it.x + dx + lw / 2 + 3, y0: it.y + dy - lh / 2 - 2, y1: it.y + dy + lh / 2 + 2, dx, dy };
        const clash = placed.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0);
        const off = b.x0 < 0 || b.y0 < band.top || b.x1 > w || b.y1 > h - band.bottom;
        if (!clash && !off) return b;
      }
      return null;
    };
    const put = (it, box, mini) => {
      it.r.label.hidden = false;
      it.r.label.classList.toggle('mini', !!mini);
      it.r.label.classList.toggle('bare', mini === 'bare');
      it.r.label.style.transform = `translate(${Math.round(it.x + box.dx)}px, ${Math.round(it.y + box.dy)}px) translate(-50%, -50%)`;
      placed.push(box);
      labelsVisible++;
    };
    // pass 1: the full label at the anchor, then one label-height above / below, half a label aside
    // a phone-narrow frame starts every label in its compact form (one size for all, the small rooms fit too)
    const narrow = w < 520;
    const left = [];
    for (const it of items) {
      const [lw, lh] = sizeOf(it.r, narrow);
      const box = fit(it, lw, lh, LABEL_SPOTS(lw, lh));
      if (box) put(it, box, narrow); else left.push(it);
    }
    // pass 2 (card 05): a label that found no room tries its compact form (smaller type, same name and area) a little
    // further out; only then does it give way (the selected room always shows)
    for (const it of left) {
      const [lw, lh] = sizeOf(it.r, true);
      // a ring of spots, nearest first, never further than 2.5 label heights / one label width from the room's anchor
      const ring = [[0, 0]];
      for (const k of [0.5, 1, 1.5, 2, 2.5]) for (const [ax, ay] of [[0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]]) ring.push([ax * Math.min(k, 2) * (lw / 2 + 4), ay * k * (lh + 3)]);
      // gate 2 (D2): no spot further than 2.5 label heights from the anchor, in any direction
      const near = (w2, h2) => ring.filter(([dx, dy]) => Math.hypot(dx, dy) <= 2.5 * h2 + 1).map(([dx, dy]) => [dx * (w2 / lw), dy * (h2 / lh)]);
      const box = fit(it, lw, lh, near(lw, lh));
      if (box) { put(it, box, true); continue; }
      // pass 3: the name alone (narrower), still within 2.5 label heights of its room
      const [bw, bh] = sizeOf(it.r, 'bare');
      const bbox = fit(it, bw, bh, near(bw, bh));
      if (bbox) { put(it, bbox, 'bare'); continue; }
      if (it.r.id === state.selected) { put(it, { x0: 0, x1: 0, y0: 0, y1: 0, dx: 0, dy: 0 }, true); continue; }
      it.r.label.hidden = true;
    }
  }

  // ---------- board transition-rise (2026-11-04): rise out of the 360 / dive back into a room ----------
  // spec = { pano (URL), depth (URL, rgb24-be radial metres), x_cm, y_cm (the scene's camera point, plan cm), eye (m),
  //          bearing0 (the panorama centre's plan bearing), yaw, pitch, hfov (the tour's view: Pannellum degrees) }.
  // The room is the panorama on its own depth mesh (depthmesh.js, loaded on first use: node tests never import it), placed in the
  // model's frame; the camera moves from that view (A) to the 3D preset (B) — the room fades over 3-28 % of the move while the
  // camera is still near it, the climb leads the travel (85 %) — or back (the dive). The viewer drives the camera itself (the orbit
  // is paused); a device under 15 fps (measured on the move's first 0.3 s) or prefers-reduced-motion jumps to the end.
  const TRANS = { ms: 1600, fadeA: 0.03, fadeB: 0.28, liftB: 0.85, minFps: 15 };
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let trans = null;      // the move in flight
  let held = null;       // after a dive: the room mesh stays as the last frame (the tour takes over on it); the orbit stays paused
  let lastTrans = null;
  let seq = 0;           // the latest request wins: a dive cancels a rise still loading its room, and ends one in flight
  const smooth = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
  const vfovOf = (hfov, aspect) => Math.min(110, (2 * Math.atan(Math.tan(((hfov || 100) * deg) / 2) / Math.max(0.2, aspect || 1))) / deg);
  function dropRoom(r) { if (!r) return; scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.uniforms.map.value?.dispose(); r.mesh.material.dispose(); }
  async function roomFor(spec) {
    const DM = await import('habait/depthmesh.js');
    const [map, tex] = await Promise.all([DM.loadDepthMap(spec.depth), new THREE.TextureLoader().loadAsync(spec.pano)]);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    const origin = [spec.x_cm / 100 - P.shift.x, Number(spec.eye) || 1.6, spec.y_cm / 100 - P.shift.z];
    const mesh = DM.createDepthMesh(DM.buildDepthArrays(map, { segW: 128, segH: 64, origin, bearing0: spec.bearing0, maxRatio: 1.6 }), tex, { origin, bearing0: spec.bearing0 });
    mesh.material.transparent = true;
    mesh.material.depthTest = false;  // the room overlays the cut model while it stands, then fades: no z-fight with the walls
    mesh.material.depthWrite = false;
    mesh.renderOrder = 10;
    mesh.raycast = () => {};
    const look = new THREE.Vector3(...DM.dirFromBearingPitch(spec.bearing0 + (Number(spec.yaw) || 0), Number.isFinite(spec.pitch) ? spec.pitch : -2));
    const A = { pos: new THREE.Vector3(...origin), target: new THREE.Vector3(...origin).add(look), fov: vfovOf(spec.hfov, camera.aspect) };
    return { mesh, A };
  }
  function transAt(T, t) {
    const k = ease(t);
    camera.position.lerpVectors(T.A.pos, T.B.pos, k);
    camera.position.y = T.A.pos.y + (T.B.pos.y - T.A.pos.y) * smooth(0, TRANS.liftB, t);
    const target = new THREE.Vector3().lerpVectors(T.A.target, T.B.target, k);
    camera.fov = T.A.fov + (T.B.fov - T.A.fov) * k;
    // the 3D preset's frame is centred between the preset bar and the caption (resize(): a view offset); the tour's frame is not.
    // The offset grows with the move, so t = 0 is exactly the tour's projection (without this the first frame sat ~1 deg low)
    { const w = el.clientWidth || 1, h = el.clientHeight || 1, dy = ((band.top - band.bottom) / 2) * k;
      if (Math.abs(dy) > 0.5) camera.setViewOffset(w, h, 0, -dy, w, h); else camera.clearViewOffset(); }
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    const op = 1 - smooth(TRANS.fadeA, TRANS.fadeB, t);
    T.mesh.material.uniforms.opacity.value = op;
    T.mesh.visible = op > 0.002;
    layer.style.opacity = t > 0.9 ? '1' : '0';
    dirty = true;
  }
  function endState(T, toRoom) {
    if (toRoom) {
      transAt(T, 0);
      held = T;                          // the pano view stays until the page takes over (or the buyer touches the model)
    } else {
      dropRoom(T);
      camera.fov = 40;
      camera.position.copy(T.B.pos);
      controls.target.copy(T.B.target);
      camera.updateProjectionMatrix();
      stopMomentum();
      controls.update();
      state.preset = '3d';
      layer.style.opacity = '1';
    }
    if (bar) for (const b of bar.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset));
    invalidate();
  }
  function play(T, kind, onFirstFrame) {
    return new Promise((resolve) => {
      if (reduceMotion()) { endState(T, kind === 'dive'); lastTrans = { kind, skipped: 'reduced-motion' }; onFirstFrame && onFirstFrame(); resolve(lastTrans); return; }
      trans = { T, kind, t0: performance.now(), frames: 0, onFirstFrame, resolve };
    });
  }
  function stepTrans() {
    const now = performance.now();
    const tr = trans;
    tr.frames++;
    let p = Math.min(1, (now - tr.t0) / TRANS.ms);
    const el = now - tr.t0;
    let skipped = null;
    const minFps = Number.isFinite(window.__habaitMinFps) ? window.__habaitMinFps : TRANS.minFps; // tests on a GPU-less browser set 0
    if (el > 300 && tr.frames / (el / 1000) < minFps && p < 1) { p = 1; skipped = 'slow-device'; }
    transAt(tr.T, tr.kind === 'rise' ? p : 1 - p);
    if (tr.frames === 1 && tr.onFirstFrame) Promise.resolve().then(tr.onFirstFrame);
    if (p >= 1) {
      trans = null;
      endState(tr.T, tr.kind === 'dive');
      lastTrans = { kind: tr.kind, frames: tr.frames, ms: Math.round(el), fps: +(tr.frames / Math.max(0.001, el / 1000)).toFixed(1), skipped };
      tr.resolve(lastTrans);
    }
  }
  // the 360 view -> the dollhouse (the first frame IS the tour's view)
  async function rise(spec, { onFirstFrame = null } = {}) {
    if (trans) return null;
    const my = ++seq;
    if (held) { dropRoom(held); held = null; }
    select(null);
    controls.autoRotate = false;
    stopMomentum();
    const room = await roomFor(spec);
    if (my !== seq) { dropRoom(room); return null; }   // superseded while loading (a dive was asked for)
    const p3 = (presets = presetsFor())['3d'];
    const T = { ...room, B: { pos: new THREE.Vector3(...p3.position), target: new THREE.Vector3(...p3.target), fov: 40 } };
    scene.add(T.mesh);
    transAt(T, 0);
    return play(T, 'rise', onFirstFrame);
  }
  // the dollhouse -> the room's 360 view (the last frame IS the tour's opening view of that room)
  async function dive(spec) {
    const my = ++seq;
    if (trans) { const tr = trans; trans = null; endState(tr.T, tr.kind === 'dive'); tr.resolve({ kind: tr.kind, skipped: 'superseded' }); }
    if (held) { dropRoom(held); held = null; }
    select(null);
    controls.autoRotate = false;
    stopMomentum();
    const room = await roomFor(spec);
    if (my !== seq) { dropRoom(room); return null; }
    const T = { ...room, B: { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov } };
    scene.add(T.mesh);
    transAt(T, 1);
    return play(T, 'dive');
  }
  // the buyer takes the model back after a dive (e.g. the page did not switch): the 3D preset again
  renderer.domElement.addEventListener('pointerdown', () => { if (held) { const T = held; held = null; endState(T, false); } });
  // tests: a deterministic frame of a prepared move
  async function transitionPreview(spec, t) {
    if (held) { dropRoom(held); held = null; }
    const room = await roomFor(spec);
    const p3 = presetsFor()['3d'];
    const T = { ...room, B: { pos: new THREE.Vector3(...p3.position), target: new THREE.Vector3(...p3.target), fov: 40 } };
    scene.add(T.mesh);
    transAt(T, t);
    held = T;
    renderer.render(scene, camera);
    return { opacity: +T.mesh.material.uniforms.opacity.value.toFixed(3), fov: +camera.fov.toFixed(2), y: +camera.position.y.toFixed(3) };
  }

  let frames = 0;
  let raf = 0;
  let firstFrameMs = null;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (trans) stepTrans(); // board transition-rise: the move drives the camera, the orbit waits
    else if (held) { /* the dive's last frame stays: no orbit update */ }
    else if (anim) {
      const t = Math.min(1, (performance.now() - anim.t0) / anim.ms);
      const k = ease(t);
      camera.position.lerpVectors(anim.from.pos, anim.to.pos, k);
      controls.target.lerpVectors(anim.from.target, anim.to.target, k);
      if (t >= 1) anim = null;
      dirty = true;
    }
    if (!trans && !held && controls.update()) dirty = true; // damping and auto-rotation report a change
    // card 05: while it turns by itself, the camera keeps the model framed at every azimuth (presets['3d'].orbit)
    const orbit = controls.autoRotate && !anim && presets && presets['3d'] && presets['3d'].orbit;
    if (orbit) {
      const off = camera.position.clone().sub(controls.target);
      const a = ((Math.atan2(off.x, off.z) / (2 * Math.PI)) * orbit.length + orbit.length) % orbit.length;
      const i = Math.floor(a); const f = a - i;
      const want = orbit[i % orbit.length] * (1 - f) + orbit[(i + 1) % orbit.length] * f;
      const len = off.length();
      if (Math.abs(want - len) > 1e-3) {
        off.setLength(len + (want - len) * 0.08);
        camera.position.copy(controls.target).add(off);
        dirty = true;
      }
    }
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera);
    placeLabels();
    frames++;
    if (firstFrameMs === null) {
      firstFrameMs = Math.round(performance.now() - t0);
      if (trans || held) renderer.domElement.style.transition = 'none'; // a rise starts on the tour's own frame: no fade
      renderer.domElement.style.opacity = '1'; // fade in from the page's gradient; no loading text
      layer.style.opacity = '1';
    }
  };
  tick();

  const stats = {
    loaded: true, meshes: P.meshes, triangles: P.triangles, size: size.toArray().map((v) => +v.toFixed(2)),
    rooms: P.rooms.length, outdoor: P.outdoor && P.outdoor.map((v) => +v.toFixed(2)), prepare_ms: P.prepare_ms,
    lightmap: P.light ? { materials: P.light.materials, px: P.light.px, scale: P.light.scale } : null,
    get floorTexture() { return P.floorTex ? { ids: P.floorTex.ids, current: P.floorTex.current, tileM: P.floorTex.tileM } : null; },
    get frames() { return frames; },
    get first_frame_ms() { return firstFrameMs; },
    get preset() { return state.preset; },
    get floor() { return state.floor; },
    get floorColor() { return state.floorColor; },
    get animating() { return !!anim; },
    get autoRotate() { return controls.autoRotate; },
    get rooms() { return roomList.map((r) => ({ id: r.id, he: r.he, en: r.en, area_m2: r.area, scene: r.scene, centre: r.centre.map((v) => +v.toFixed(3)), label: !r.label.hidden })); },
    get selected() { return state.selected; },
    get here() { return state.here || null; },
    get transition() { return trans ? { kind: trans.kind, running: true } : (lastTrans || null); },
    get held() { return !!held; },
    get labelsVisible() { return labelsVisible; },
    get target() { return controls.target.toArray().map((v) => +v.toFixed(3)); },
    get view() {
      const off = camera.position.clone().sub(controls.target);
      const sph = new THREE.Spherical().setFromVector3(off);
      return { polarDeg: +(sph.phi / deg).toFixed(2), azimuthDeg: +(sph.theta / deg).toFixed(2), distance: +sph.radius.toFixed(2), position: camera.position.toArray().map((v) => +v.toFixed(3)), target: controls.target.toArray().map((v) => +v.toFixed(3)) };
    },
  };
  return {
    scene, camera, renderer, stats, setPreset, setFloor, select, setHere, rise, dive, transitionPreview,
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); envTex.dispose(); renderer.dispose(); renderer.domElement.remove(); bar?.remove(); layer.remove(); sheet.remove(); },
  };
}

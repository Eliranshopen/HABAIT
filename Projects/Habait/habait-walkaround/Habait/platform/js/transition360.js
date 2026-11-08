// 360 -> 360 inside the apartment without video (card 13, B5): the current panorama is projected on a low mesh of its own
// depth (js/depthmesh.js), the camera travels from point A to point B (cameras.json positions) in ~0.8 s on that mesh, and
// from 40% of the move (DEFAULTS.fadeStart) the picture cross-fades to panorama B on B's mesh, so the arrival frame IS panorama B
// seen from B. The view direction (plan bearing + pitch) is held for the whole move: no yaw jump. A slow device (rAF rate
// under 15 fps, measured, never guessed) gets a plain cross-fade instead.
//
// Two ways in:
//   - standalone: new TransitionViewer(container, { manifest }) — the demo page (demo-transition.html) and the test;
//   - plugin: createTransitionPlugin({ manifest }).attach(viewer) on the tour's engine (Habait/tour360/engine, the
//     Pannellum-compatible CompatViewer over Photo Sphere Viewer). The engine has no public 'hotspot-click' event today;
//     attach() listens for one (viewer.on('hotspot-click', (hs, ev) => ...), ev.preventDefault() cancels the default walk)
//     and, until habait-98 adds it, takes the door through the engine's own walk entry (the instance's walk(hs), which a door
//     marker tap and walkTo(hs) both reach). A door whose rooms have no depth falls through to the engine's walk-in.
//
// Manifest (written by test/transition.test.mjs --prep into _local/transition/apt846.json; URLs relative to the manifest):
//   { apartment, eye_m, scenes: { <id>: { pano, depth, pos_cm: [x, y], bearing0, hotspots: [{ to, u, v }] } } }
// Frames: see depthmesh.js (plan cm, world m, bearing). Tour yaw = bearing - bearing0 (wrapped), as tour.js's arriveYaw.
import * as THREE from 'three';
import { buildDepthArrays, createDepthMesh, equirectMaterial, loadDepthMap, bearingPitchOfDir } from './depthmesh.js';

export const DEFAULTS = Object.freeze({
  durationMs: 800,     // the move (the card: ~0.8 s)
  fadeStart: 0.4,      // the cross-fade to B starts at 40% of the move (hides the mesh smear mid-way) and ends on arrival
  fadeMs: 450,         // the fallback's plain cross-fade
  fpsThreshold: 15,    // below this (rAF rate, measured) the fallback runs
  probeFrames: 4,      // in-flight check: after this many frames of the move, under the threshold -> finish as a fade
  segW: 64, segH: 32,  // the mesh (the card: 64 x 32 is enough)
  maxRatio: 1.5,       // depth-edge triangles (corner depths differ > 1.5x) go back to the far surface: no rubber sheets (depthmesh.js)
  maxPixelRatio: 2,
  swapWaitMs: 400,     // plugin: the longest the move waits for the engine's own swap to B (see go())
  hfov: 80, maxVfov: 80, // the engine's FOV_DEFAULT: 80 deg across, never more than 80 up
});
const DEG = Math.PI / 180;

// ---------- pure maths ----------
export const norm360 = (d) => ((d % 360) + 360) % 360;
export const wrap180 = (d) => { const r = norm360(d + 180) - 180; return r === -180 ? 180 : r; };
export const bearingOfYaw = (bearing0, yaw) => norm360(bearing0 + yaw);
export const yawOfBearing = (bearing0, bearing) => wrap180(bearing - bearing0);
export const angleDiff = (a, b) => Math.abs(wrap180(a - b));
export const planCmToWorld = ([x, y], eye = 1.6) => [x / 100, eye, y / 100];
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const smoothstep = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// the weight of B at move time t (0..1): 0 until fadeStart, then a smoothstep that reaches 1 exactly on arrival
export const fadeWeight = (t, start = DEFAULTS.fadeStart) => (t <= start ? 0 : smoothstep((t - start) / (1 - start)));
// unknown fps (no frames yet) runs the mesh; the in-flight probe still catches a slow device
export const chooseMode = (fps, threshold = DEFAULTS.fpsThreshold) => (Number.isFinite(fps) && fps < threshold ? 'fade' : 'mesh');
export const vfovOf = (hfov, aspect, cap = DEFAULTS.maxVfov) => Math.min(cap, (2 * Math.atan(Math.tan((hfov * DEG) / 2) / Math.max(1e-6, aspect))) / DEG);
export const hfovOf = (vfov, aspect) => (2 * Math.atan(Math.tan((vfov * DEG) / 2) * aspect)) / DEG;
export const fpsOf = (ts) => (ts.length < 2 ? NaN : ((ts.length - 1) * 1000) / (ts[ts.length - 1] - ts[0]));

// manifest -> { id: { id, pano, depth, pos (world m), bearing0, hotspots } } with absolute URLs
export function normalizeManifest(manifest, baseUrl) {
  const eye = manifest.eye_m ?? 1.6;
  const abs = (p) => (baseUrl ? new URL(p, baseUrl).href : p);
  const out = {};
  for (const [id, s] of Object.entries(manifest.scenes || {})) {
    out[id] = { id, pano: abs(s.pano), depth: s.depth ? abs(s.depth) : null, pos: planCmToWorld(s.pos_cm, eye), pos_cm: s.pos_cm, bearing0: s.bearing0 || 0, hotspots: s.hotspots || [], name: s.name || null };
  }
  return out;
}

// ---------- the frame meter (rAF timestamps) ----------
export class FpsMeter {
  constructor({ size = 30, win = typeof window !== 'undefined' ? window : null } = {}) {
    this.size = size; this.win = win; this.ts = []; this.on = false; this.loadMs = 0;
    this._tick = (t) => {
      if (!this.on) return;
      if (this.loadMs > 0) { const end = performance.now() + this.loadMs; while (performance.now() < end) { /* debug: a slow device */ } }
      this.ts.push(t); if (this.ts.length > this.size) this.ts.shift();
      this.win.requestAnimationFrame(this._tick);
    };
  }
  start() { if (!this.on && this.win) { this.on = true; this.win.requestAnimationFrame(this._tick); } return this; }
  stop() { this.on = false; }
  // frames per second over the last `size` frames; NaN if fewer than 5 or the last one is stale (hidden tab)
  fps() {
    const ts = this.ts;
    if (ts.length < 5 || performance.now() - ts[ts.length - 1] > 500) return NaN;
    return fpsOf(ts);
  }
}

// ---------- assets ----------
function loadTexture(url) {
  return new Promise((ok, fail) => new THREE.TextureLoader().load(url, (tex) => {
    tex.colorSpace = THREE.NoColorSpace; // bytes in = bytes out (the renderer's output is linear-passthrough too)
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    tex.wrapS = THREE.RepeatWrapping; // the 360 seam samples across
    ok(tex);
  }, undefined, () => fail(new Error('panorama failed: ' + url))));
}

export class AssetCache {
  constructor(scenes, opts = {}) { this.scenes = scenes; this.opts = { ...DEFAULTS, ...opts }; this.tex = new Map(); this.mesh = new Map(); }
  texture(id) {
    if (!this.tex.has(id)) this.tex.set(id, loadTexture(this.scenes[id].pano));
    return this.tex.get(id);
  }
  // the displaced mesh (null when the scene has no depth: the move then runs on the plain sphere)
  depthMesh(id) {
    if (!this.mesh.has(id)) {
      const s = this.scenes[id];
      this.mesh.set(id, s.depth ? Promise.all([loadDepthMap(s.depth), this.texture(id)]).then(([map, tex]) => {
        const arrays = buildDepthArrays(map, { segW: this.opts.segW, segH: this.opts.segH, origin: s.pos, bearing0: s.bearing0, maxRatio: this.opts.maxRatio });
        return createDepthMesh(arrays, tex, { origin: s.pos, bearing0: s.bearing0 });
      }) : Promise.resolve(null));
    }
    return this.mesh.get(id);
  }
  async ready(id) { const [tex, mesh] = await Promise.all([this.texture(id), this.depthMesh(id)]); return { tex, mesh }; }
}

// ---------- the renderer ----------
// two layers, each = a camera-centred "sky" sphere (fills what the mesh cannot) + the scene's depth mesh; layer B is drawn
// into a render target and laid over A with opacity f. Steady view = layer with the sky only (exactly the panorama).
export class TransitionRenderer {
  constructor(parent, opts = {}) {
    this.opts = { ...DEFAULTS, ...opts };
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);
    this.canvas = this.renderer.domElement;
    if (parent) parent.appendChild(this.canvas);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 400);
    this.camera.rotation.order = 'YXZ';
    // the sky: a unit-depth sphere built with the same u/v -> bearing map as the meshes (bearing0 = 0; rotated per scene)
    const skyArrays = buildDepthArrays({ w: 1, h: 1, data: new Float32Array([1]) }, { segW: 64, segH: 32, origin: [0, 0, 0], bearing0: 0, minDepth: 0, maxDepth: 1 });
    const skyGeo = new THREE.BufferGeometry();
    skyGeo.setAttribute('position', new THREE.BufferAttribute(skyArrays.positions, 3));
    skyGeo.setAttribute('uv', new THREE.BufferAttribute(skyArrays.uvs, 2));
    skyGeo.setIndex(new THREE.BufferAttribute(skyArrays.indices, 1));
    const sky = () => { const mat = equirectMaterial({ fromCamera: true }); mat.depthTest = false; mat.depthWrite = false; const m = new THREE.Mesh(skyGeo, mat); m.scale.setScalar(150); m.renderOrder = -1; m.frustumCulled = false; return m; };
    this.layers = [0, 1].map(() => { const scene = new THREE.Scene(); const s = sky(); scene.add(s); return { scene, sky: s, mesh: null }; });
    this.rt = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true, colorSpace: THREE.NoColorSpace });
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadMat = new THREE.MeshBasicMaterial({ map: this.rt.texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    this.quadScene = new THREE.Scene();
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.quadMat));
    this.width = 0; this.height = 0;
  }
  setSize(w, h) {
    if (w === this.width && h === this.height) return;
    this.width = w; this.height = h;
    const pr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, this.opts.maxPixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.rt.setSize(Math.round(w * pr), Math.round(h * pr));
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
  // layer i shows scene s ({ tex, mesh, bearing0 }); withMesh: false = sky only
  setLayer(i, s, withMesh) {
    const L = this.layers[i];
    L.sky.material.uniforms.map.value = s.tex;
    L.sky.material.uniforms.bearing0.value = s.bearing0 * DEG;
    if (L.mesh && L.mesh !== s.mesh) { L.scene.remove(L.mesh); }
    L.mesh = s.mesh || null;
    if (L.mesh) { if (L.mesh.parent !== L.scene) L.scene.add(L.mesh); L.mesh.visible = !!withMesh; }
  }
  // view = { pos: [x,y,z] world m, bearing, pitch (deg), vfov (deg) }; f = weight of layer 1 (0: layer 0 only)
  render(view, f) {
    const cam = this.camera;
    cam.position.set(view.pos[0], view.pos[1], view.pos[2]);
    cam.rotation.set(view.pitch * DEG, -view.bearing * DEG, 0, 'YXZ');
    if (Math.abs(cam.fov - view.vfov) > 1e-6) { cam.fov = view.vfov; cam.updateProjectionMatrix(); }
    for (const L of this.layers) L.sky.position.copy(cam.position);
    const r = this.renderer;
    if (f < 1) {
      r.setRenderTarget(null); r.clear(true, true, true);
      r.render(this.layers[0].scene, cam);
    }
    if (f > 0) {
      const b = this.layers[1];
      const skyOnlyBoth = !(b.mesh && b.mesh.visible) && !(this.layers[0].mesh && this.layers[0].mesh.visible);
      if (f >= 1) { r.setRenderTarget(null); r.clear(true, true, true); r.render(b.scene, cam); }
      else if (skyOnlyBoth) { // the fallback: two camera-centred spheres need no render target
        b.sky.material.transparent = true; b.sky.material.uniforms.opacity.value = f;
        r.render(b.scene, cam);
        b.sky.material.transparent = false; b.sky.material.uniforms.opacity.value = 1;
      } else {
        r.setRenderTarget(this.rt); r.clear(true, true, true); r.render(b.scene, cam);
        r.setRenderTarget(null);
        this.quadMat.opacity = f;
        r.render(this.quadScene, this.quadCam);
      }
    }
    // what was actually drawn: the camera's world direction (the drift is measured on this, not on the inputs)
    const d = cam.getWorldDirection(new THREE.Vector3());
    return bearingPitchOfDir(d.x, d.y, d.z);
  }
  // upload a scene's panorama and compile the one shader (sky and meshes share it) ahead of a move: the first move's first
  // frames otherwise pay for both
  warm(s) {
    if (s && s.tex) this.renderer.initTexture(s.tex);
    if (!this._compiled) { this._compiled = true; this.renderer.compile(this.layers[0].scene, this.camera); this.renderer.compile(this.quadScene, this.quadCam); }
  }
  dispose() { this.renderer.dispose(); this.rt.dispose(); this.canvas.remove(); }
}

// ---------- the move ----------
// Runs one transition on `tr` from scene data A to B ({ tex, mesh, pos, bearing0 }), holding view { bearing, pitch, vfov }.
// Resolves { mode: 'mesh' | 'fade' | 'mesh->fade', frames, fps, ms, yawDriftDeg, pitchDriftDeg, fpsBefore }.
export function runTransition(tr, A, B, view, { mode = 'mesh', opts = DEFAULTS, meter = null, raf = (f) => requestAnimationFrame(f), onFrame = null, debug = {} } = {}) {
  const o = { ...DEFAULTS, ...opts };
  return new Promise((resolve) => {
    const ts = [];
    let drift = 0, pdrift = 0, t0 = null, demoted = false, freezePos = null, fadeT0 = null;
    const useMesh = mode === 'mesh';
    tr.setLayer(0, A, useMesh);
    tr.setLayer(1, B, useMesh);
    const frame = (now) => {
      if (t0 == null) t0 = now;
      ts.push(now);
      if (debug.loadFromFrame != null && ts.length === debug.loadFromFrame + 1 && meter) meter.loadMs = debug.loadMs || 90;
      let pos, f, done;
      if (useMesh && !demoted) {
        const t = Math.min(1, (now - t0) / o.durationMs);
        // in-flight probe: a device that cannot hold the threshold finishes as a plain fade from where it is
        if (ts.length >= o.probeFrames + 2 && t < o.fadeStart && fpsOf(ts.slice(-(o.probeFrames + 1))) < o.fpsThreshold) {
          demoted = true; fadeT0 = now;
          const e = easeInOutCubic(t);
          freezePos = A.pos.map((a, i) => a + (B.pos[i] - a) * e);
          tr.setLayer(1, B, false);
        }
        if (!demoted) {
          const e = easeInOutCubic(t);
          pos = A.pos.map((a, i) => a + (B.pos[i] - a) * e);
          f = fadeWeight(t, o.fadeStart);
          done = t >= 1;
        }
      }
      if (!useMesh || demoted) {
        const start = demoted ? fadeT0 : t0;
        const t = Math.min(1, (now - start) / o.fadeMs);
        pos = demoted ? freezePos : A.pos;
        f = smoothstep(t);
        done = t >= 1;
        if (done) pos = B.pos;
      }
      const [b, p] = tr.render({ pos, bearing: view.bearing, pitch: view.pitch, vfov: view.vfov }, f);
      drift = Math.max(drift, angleDiff(b, view.bearing));
      pdrift = Math.max(pdrift, Math.abs(p - view.pitch));
      if (onFrame) onFrame({ pos, f, now });
      if (!done) { raf(frame); return; }
      resolve({ mode: demoted ? 'mesh->fade' : mode, frames: ts.length, fps: fpsOf(ts), ms: ts[ts.length - 1] - ts[0], yawDriftDeg: drift, pitchDriftDeg: pdrift });
    };
    raf(frame);
  });
}

// ---------- standalone viewer (demo page, test) ----------
export class TransitionViewer {
  constructor(container, { manifest, baseUrl, options = {} } = {}) {
    this.container = container;
    this.opts = { ...DEFAULTS, ...options };
    this.scenes = normalizeManifest(manifest, baseUrl);
    this.assets = new AssetCache(this.scenes, this.opts);
    this.tr = new TransitionRenderer(container, this.opts);
    this.tr.canvas.classList.add('t360-canvas');
    this.meter = new FpsMeter().start();
    this.view = { scene: null, yaw: 0, pitch: 0, hfov: this.opts.hfov };
    this.busy = false;
    this.onView = null;       // (view) after every steady render
    this.onTransition = null; // (result)
    this.debug = {};
    this.last = null;
    this._dirty = true;
    this._ro = new ResizeObserver(() => { this._resize(); this._dirty = true; });
    this._ro.observe(container);
    this._resize();
    this._bind();
    const loop = () => { if (this._dead) return; if (this._dirty && !this.busy && this.view.scene) { this._dirty = false; this._renderSteady(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  _resize() { const r = this.container.getBoundingClientRect(); this.tr.setSize(Math.max(1, r.width), Math.max(1, r.height)); }
  get aspect() { return this.tr.width / Math.max(1, this.tr.height); }
  vfov() { return vfovOf(this.view.hfov, this.aspect, this.opts.maxVfov); }
  bearing() { return bearingOfYaw(this.scenes[this.view.scene].bearing0, this.view.yaw); }
  async show(id, { yaw = 0, pitch = 0 } = {}) {
    const a = await this.assets.ready(id);
    this.view.scene = id; this.view.yaw = wrap180(yaw); this.view.pitch = pitch;
    this.cur = { ...a, pos: this.scenes[id].pos, bearing0: this.scenes[id].bearing0 };
    this.tr.setLayer(0, this.cur, false);
    this._renderSteady();
    // the neighbours this room links to, in the background
    this.tr.warm(this.cur);
    for (const h of this.scenes[id].hotspots) if (this.scenes[h.to]) this.assets.ready(h.to).then((x) => this.tr.warm(x)).catch(() => {});
    return this.view;
  }
  _renderSteady() {
    this.tr.setLayer(0, this.cur, false);
    this.tr.render({ pos: this.cur.pos, bearing: this.bearing(), pitch: this.view.pitch, vfov: this.vfov() }, 0);
    if (this.onView) this.onView(this.view);
  }
  setView({ yaw, pitch, hfov }) {
    if (yaw != null) this.view.yaw = wrap180(yaw);
    if (pitch != null) this.view.pitch = Math.max(-85, Math.min(85, pitch));
    if (hfov != null) this.view.hfov = Math.max(40, Math.min(110, hfov));
    this._dirty = true;
  }
  // screen position (CSS px) of a direction given as plan bearing / pitch, or null behind the camera
  project(bearing, pitch) {
    const cam = this.tr.camera;
    const b = bearing * DEG, p = pitch * DEG;
    const v = new THREE.Vector3(Math.sin(b) * Math.cos(p), Math.sin(p), -Math.cos(b) * Math.cos(p)).add(cam.position);
    v.project(cam);
    if (v.z > 1 || v.z < -1) return null;
    return { x: (v.x + 1) / 2 * this.tr.width, y: (1 - v.y) / 2 * this.tr.height };
  }
  // the move to scene `to`, holding the plan bearing and pitch; resolves the measured result
  async goTo(to, { force } = {}) {
    if (this.busy || !this.view.scene || to === this.view.scene || !this.scenes[to]) return null;
    this.busy = true;
    try {
      const from = this.view.scene;
      const b = await this.assets.ready(to);
      const B = { ...b, pos: this.scenes[to].pos, bearing0: this.scenes[to].bearing0 };
      const A = this.cur;
      const fpsBefore = this.meter.fps();
      const mode = force || (A.mesh && B.mesh ? chooseMode(fpsBefore, this.opts.fpsThreshold) : 'fade');
      const bearing = this.bearing();
      const view = { bearing, pitch: this.view.pitch, vfov: this.vfov() };
      const res = await runTransition(this.tr, A, B, view, { mode, opts: this.opts, meter: this.meter, debug: this.debug });
      if (this.debug.loadFromFrame != null) this.meter.loadMs = 0; // the in-flight test's synthetic load ends with the move
      // arrival: the tour's own state for B, from the same bearing
      this.view.scene = to;
      this.view.yaw = yawOfBearing(this.scenes[to].bearing0, bearing);
      this.cur = B;
      this._renderSteady();
      const after = this.bearing();
      const result = { from, to, ...res, fpsBefore, bearingBefore: bearing, bearingAfter: after, yawAfter: this.view.yaw, arrivalDriftDeg: angleDiff(after, bearing) };
      this.last = result;
      for (const h of this.scenes[to].hotspots) if (this.scenes[h.to]) this.assets.ready(h.to).catch(() => {});
      if (this.onTransition) this.onTransition(result);
      return result;
    } finally { this.busy = false; this._dirty = true; }
  }
  // deterministic frames for screenshots / continuity: the move from -> to frozen at time t (0..1), same view as now
  async renderAt(from, to, t, { yaw, pitch } = {}) {
    const [a, b] = await Promise.all([this.assets.ready(from), this.assets.ready(to)]);
    const A = { ...a, pos: this.scenes[from].pos, bearing0: this.scenes[from].bearing0 };
    const B = { ...b, pos: this.scenes[to].pos, bearing0: this.scenes[to].bearing0 };
    const bearing = bearingOfYaw(A.bearing0, yaw ?? this.view.yaw);
    this.busy = true; // the steady loop keeps off the canvas until release()
    this.tr.setLayer(0, A, true); this.tr.setLayer(1, B, true);
    const e = easeInOutCubic(t);
    return this.tr.render({ pos: A.pos.map((x, i) => x + (B.pos[i] - x) * e), bearing, pitch: pitch ?? this.view.pitch, vfov: this.vfov() }, fadeWeight(t, this.opts.fadeStart));
  }
  release() { this.busy = false; this._dirty = true; }
  _bind() {
    const el = this.tr.canvas;
    el.style.touchAction = 'none';
    let drag = null;
    el.addEventListener('pointerdown', (e) => { if (this.busy) return; drag = { x: e.clientX, y: e.clientY, yaw: this.view.yaw, pitch: this.view.pitch }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const k = this.view.hfov / Math.max(1, this.tr.width);
      this.setView({ yaw: drag.yaw - (e.clientX - drag.x) * k, pitch: drag.pitch + (e.clientY - drag.y) * k });
    });
    const up = () => { drag = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.setView({ hfov: this.view.hfov + e.deltaY * 0.05 }); }, { passive: false });
  }
  destroy() { this._dead = true; this._ro.disconnect(); this.meter.stop(); this.tr.dispose(); }
}

// ---------- plugin for the tour engine (Habait/tour360/engine CompatViewer) ----------
// const plugin = createTransitionPlugin({ manifest, baseUrl }); plugin.attach(viewer); ... plugin.detach();
// The overlay canvas covers the engine's container during the move; under it the engine swaps to B instantly
// (loadScene(B, pitch, yawB, hfov, 0)) and the overlay goes once the engine has drawn B (its 'load').
export function createTransitionPlugin({ manifest, baseUrl, options = {} } = {}) {
  const opts = { ...DEFAULTS, ...options };
  const scenes = normalizeManifest(manifest, baseUrl);
  const assets = new AssetCache(scenes, opts);
  const meter = new FpsMeter();
  let viewer = null, tr = null, overlay = null, busy = false, restore = [];
  const plugin = {
    scenes, assets, meter, opts, last: null, debug: {},
    handles(hs) {
      const to = typeof hs === 'string' ? hs : hs && hs.sceneId;
      const from = viewer && viewer.getScene();
      return !!(viewer && to && from && to !== from && scenes[to] && scenes[from] && scenes[to].depth && scenes[from].depth);
    },
    attach(v) {
      viewer = v;
      meter.start();
      // (1) the public event, once the engine emits it: viewer.on('hotspot-click', (hs, ev) => ...)
      const onClick = (hs, ev) => { if (plugin.handles(hs)) { if (ev && ev.preventDefault) ev.preventDefault(); plugin.go(hs); } };
      if (typeof v.on === 'function') { v.on('hotspot-click', onClick); restore.push(() => v.off && v.off('hotspot-click', onClick)); }
      // (2) today: the engine's walk entry (a door marker tap -> walk(hs); walkTo(hs) -> walk(hs)); the instance property
      //     shadows the class method, the engine's source is untouched
      const key = typeof v.walk === 'function' ? 'walk' : typeof v.walkTo === 'function' ? 'walkTo' : null;
      if (key) {
        const orig = v[key];
        v[key] = function (hs) { if (plugin.handles(hs)) { plugin.go(hs); return this; } return orig.call(this, hs); };
        restore.push(() => { delete v[key]; });
      }
      // prefetch the current room and its doors as rooms load
      const pre = () => { const id = v.getScene(); if (!scenes[id]) return; ensureTr(); const w = (x) => { if (tr) tr.warm(x); }; assets.ready(id).then(w).catch(() => {}); for (const h of scenes[id].hotspots) if (scenes[h.to]) assets.ready(h.to).then(w).catch(() => {}); };
      if (typeof v.on === 'function') { v.on('load', pre); restore.push(() => v.off && v.off('load', pre)); }
      if (v.isLoaded && v.isLoaded()) pre();
      return plugin;
    },
    detach() { restore.forEach((f) => f()); restore = []; meter.stop(); if (tr) tr.dispose(); tr = null; overlay = null; viewer = null; },
    // the move to hs.sceneId (or a scene id); resolves the measured result
    async go(hs) {
      if (busy || !viewer) return null;
      const to = typeof hs === 'string' ? hs : hs.sceneId;
      const from = viewer.getScene();
      busy = true;
      try {
        const [a, b] = await Promise.all([assets.ready(from), assets.ready(to)]);
        const A = { ...a, pos: scenes[from].pos, bearing0: scenes[from].bearing0 };
        const B = { ...b, pos: scenes[to].pos, bearing0: scenes[to].bearing0 };
        ensureTr();
        const box = viewer.psv ? viewer.psv.container : overlay.parentElement;
        const r = box.getBoundingClientRect();
        tr.setSize(r.width, r.height);
        const yaw = viewer.getYaw(), pitch = viewer.getPitch(), hfov = viewer.getHfov();
        const vfov = viewer.psv && viewer.psv.state && Number.isFinite(viewer.psv.state.vFov) ? viewer.psv.state.vFov : vfovOf(hfov, r.width / r.height, 180);
        const bearing = bearingOfYaw(A.bearing0, yaw);
        const yawB = yawOfBearing(B.bearing0, bearing);
        const fpsBefore = meter.fps();
        const mode = plugin.debug.force || chooseMode(fpsBefore, opts.fpsThreshold);
        const view = { bearing, pitch, vfov };
        // first overlay frame = what the engine shows now, then the engine swaps under it
        tr.setLayer(0, A, mode === 'mesh'); tr.render({ ...view, pos: A.pos }, 0);
        overlay.style.transition = 'none'; overlay.style.opacity = '1'; overlay.hidden = false;
        // the engine swaps to B under the overlay first: its texture decode + upload is main-thread work that would
        // otherwise land in the move's first frames (measured: it demoted the first move to a fade); the overlay holds
        // frame 0 meanwhile, at most opts.swapWaitMs (a slow download keeps loading under the move)
        const loaded = once(viewer, 'load', 5000);
        viewer.loadScene(to, pitch, yawB, hfov, 0);
        const t0 = performance.now();
        await Promise.race([loaded, new Promise((ok) => setTimeout(ok, opts.swapWaitMs))]);
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
        const swapMs = performance.now() - t0;
        const res = await runTransition(tr, A, B, view, { mode, opts, meter, debug: plugin.debug });
        if (plugin.debug.loadFromFrame != null) meter.loadMs = 0;
        await loaded;
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); // the engine has drawn B
        const after = bearingOfYaw(B.bearing0, viewer.getYaw());
        plugin.lastView = { view, A, B };
        if (!plugin.debug.holdOverlay) await hideOverlay();
        const result = { from, to, ...res, fpsBefore, swapMs, bearingBefore: bearing, bearingAfter: after, yawAfter: viewer.getYaw(), arrivalDriftDeg: angleDiff(after, bearing), engineScene: viewer.getScene() };
        plugin.last = result;
        return result;
      } finally { busy = false; }
    },
    // test hooks: the overlay's arrival frame on top of the engine, and away again
    showArrivalFrame() { const { view, B } = plugin.lastView; tr.setLayer(1, B, true); tr.render({ ...view, pos: B.pos }, 1); overlay.style.transition = 'none'; overlay.style.opacity = '1'; overlay.hidden = false; },
    hideOverlay: () => hideOverlay(),
  };
  function ensureTr() {
    if (tr || !viewer) return;
    const box = viewer.psv ? viewer.psv.container : viewer.container || document.body;
    tr = new TransitionRenderer(null, opts);
    overlay = tr.canvas;
    overlay.className = 't360-overlay';
    Object.assign(overlay.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '40', pointerEvents: 'none' });
    overlay.hidden = true;
    box.appendChild(overlay);
  }
  function hideOverlay() {
    return new Promise((ok) => {
      overlay.style.transition = 'opacity 120ms linear'; overlay.style.opacity = '0';
      setTimeout(() => { overlay.hidden = true; ok(); }, 140);
    });
  }
  return plugin;
}

function once(viewer, type, timeoutMs) {
  return new Promise((ok) => {
    let done = false;
    const fn = () => { if (done) return; done = true; if (viewer.off) viewer.off(type, fn); ok(true); };
    viewer.on(type, fn);
    setTimeout(() => { if (!done) { done = true; if (viewer.off) viewer.off(type, fn); ok(false); } }, timeoutMs);
  });
}

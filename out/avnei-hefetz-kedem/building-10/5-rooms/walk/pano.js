// pano.js — the 360 version of the same app (window.HAB_MODE === '360'): at each standpoint the full Cycles panorama of the model
// (sales-sheet walls, the furniture made from Eliran's pictures) is the picture; the 3D model stays loaded but unseen, for the
// circles, the plan, the measure tool and the dollhouse. Moving = a jump to a standpoint (room cards, pager, room names on the floor,
// a click on the floor). Changes are live AI edits (RAINBOW's model): the current view goes to /api/edit (fal nano-banana/edit,
// open to all, $5/day cap on the server); only the part that changed is kept (a difference mask) and it is projected back onto the
// panorama from the same camera, so it stays in place when you turn. Undo / original / reset act on the stack of a standpoint.
// Plan: development/plans/2026-11-18-ahk-b10-two-versions.md.
import * as THREE from 'three';

export async function initPano({ scene, camera, renderer, me, model = [] }) {
  const P = await (await fetch('./pano/points.json')).json();   // {eye_m, yaw_offset_deg, points:[{id, x, y, yaw_deg, room, file}]}
  const cache = new Map();
  // a room's picture is decoded off the main thread (createImageBitmap) and uploaded to the GPU before it is shown, without
  // mipmaps (an 8K picture across 360° is about one texel per screen pixel): a jump froze the screen ~1.5 s while an 8K JPEG
  // was decoded, uploaded and mipmapped on the first frame (Eliran 2026-11-19 «האיטיות שההדמייה זזה»)
  const load = async (u) => {
    let t;
    try {
      const blob = await (await fetch(u)).blob();
      t = new THREE.Texture(await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })); t.flipY = false;
    } catch { t = await new THREE.TextureLoader().loadAsync(u); }   // an older browser without the bitmap options
    t.generateMipmaps = false; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; t.needsUpdate = true;
    renderer.initTexture(t); return t;
  };
  const url = (p) => `./pano/${big ? p.file : p.file.replace('.jpg', '_4k.jpg')}`;
  // 8K panoramas where the GPU takes them (desktop), the 4K copy on phones (max texture 4096); P.has4k says the copies exist
  const big = !P.has4k || (renderer.capabilities.maxTextureSize >= 8192 && !matchMedia('(pointer: coarse)').matches);
  const tex = (p) => {
    if (!cache.has(p.id)) cache.set(p.id, load(url(p)));
    const v = cache.get(p.id); cache.delete(p.id); cache.set(p.id, v);   // most recent last
    while (cache.size > 2) { const [k, old] = cache.entries().next().value; cache.delete(k); old.then((t) => { if (sky.material.map !== t) { t.dispose(); t.image && t.image.close && t.image.close(); } }).catch(() => {}); }   // GPU holds 2 rooms (an 8K pano = 134 MB)
    return v;
  };
  // the model stays in the scene for the circles, the measure tool and the plan (raycasts ignore .visible), hidden while you stand
  // in a panorama; the dollhouse shows it
  const setModel = (v) => { for (const o of model) o.visible = v; };
  setModel(false);
  const warmed = new Set();
  // the picture is drawn on a sphere around the eye, not as scene.background: three turns an equirect background into a cube map
  // on its first frame (170-390 ms per room on an 8K picture). Same look: x mirrored and turned half a turn = three's equirect
  // lookup (checked pixel by pixel against scene.background, mean difference < 1 level of 255)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 128, 64), new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false }));
  sky.name = 'pano-sky'; sky.renderOrder = -10; sky.frustumCulled = false; sky.scale.set(-1, 1, 1); scene.add(sky);
  scene.background = new THREE.Color(0x24211e);
  const S = { cur: null, patches: new Map(), busy: false };
  const patchGroup = new THREE.Group(); patchGroup.name = 'pano-patches'; scene.add(patchGroup);
  const KEEP = new Set(['pano-sky', 'pano-patches', 'measure', 'marker']);   // the only scene objects drawn over a panorama
  const offset = THREE.MathUtils.degToRad(P.yaw_offset_deg || 0), sign = P.yaw_sign || 1;

  async function show(p, keepYaw = true) {
    const t = await tex(p);
    sky.material.map = t; sky.material.needsUpdate = true;
    sky.rotation.set(0, sign * THREE.MathUtils.degToRad(p.yaw_deg) + offset + Math.PI, 0);
    me.x = p.x; me.y = p.y; if (!keepYaw) me.yaw = THREE.MathUtils.degToRad(p.yaw_deg);
    S.cur = p; drawPatches();
    for (const q of P.points) if (q !== p && !warmed.has(q.id)) { warmed.add(q.id); fetch(url(q)).catch(() => {}); }   // prefetch the files only (HTTP cache), not GPU textures
  }
  const nearest = (x, y, notCur) => P.points.filter((q) => !notCur || q !== S.cur).reduce((b, q) => (Math.hypot(q.x - x, q.y - y) < Math.hypot(b.x - x, b.y - y) ? q : b));
  function goNear(x, y) { const p = nearest(x, y); return show(p, false); }   // a room button: that room's panorama, facing its composed view
  function tapFloor(x, y) { const p = nearest(x, y, true); if (p) show(p); }

  // ---------------------------------------------------------------- a change, projected from the camera that saw it
  const VERT = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const FRAG = 'uniform sampler2D map; uniform mat4 vp; uniform vec3 eye; varying vec3 vW; void main(){ vec4 c = vp * vec4(eye + normalize(vW - eye) * 10.0, 1.0);'
    + ' if (c.w <= 0.0) discard; vec2 uv = c.xy / c.w * 0.5 + 0.5; if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard; vec4 t = texture2D(map, uv);'
    + ' if (t.a < 0.01) discard; gl_FragColor = vec4(t.rgb, t.a); #include <colorspace_fragment> }';
  function patchMesh(pt) {
    const m = new THREE.ShaderMaterial({ uniforms: { map: { value: pt.tex }, vp: { value: pt.vp }, eye: { value: pt.eye } }, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.BackSide });
    const s = new THREE.Mesh(new THREE.SphereGeometry(40, 64, 32), m); s.renderOrder = 5; s.frustumCulled = false; return s;
  }
  function drawPatches() {
    patchGroup.clear(); if (!S.cur || S.orig) return;
    for (const pt of S.patches.get(S.cur.id) || []) { const m = patchMesh(pt); m.position.copy(camera.position); patchGroup.add(m); }
  }
  let inDoll = false;
  function frame() {
    for (const m of patchGroup.children) m.position.copy(camera.position);
    sky.position.copy(camera.position);
    // pieces that finish loading after start (accessories, swapped models) are added to the scene later: keep them hidden too
    if (!inDoll) for (const o of scene.children) if ((o.isMesh || o.isGroup) && o.visible && !KEEP.has(o.name)) o.visible = false;
  }
  // the dollhouse draws the model, which a panorama never does: compile its shaders and upload its textures in the background after
  // start, a little at a time, so the first switch is instant (it froze 17 s on a desktop — Eliran 2026-11-18 «ההדמייה נתקעת»)
  async function warm() {
    try {
      const vis = scene.children.filter((o) => (o.isMesh || o.isGroup) && !KEEP.has(o.name));
      for (const o of vis) o.visible = true;
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
      if (!inDoll) for (const o of vis) o.visible = false;
      const tex = new Set(); scene.traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'lightMap']) if (m[k] && m[k].isTexture) tex.add(m[k]); });
      const idle = () => new Promise((ok) => (window.requestIdleCallback ? requestIdleCallback(ok, { timeout: 200 }) : setTimeout(ok, 30)));
      for (const t of tex) { await idle(); renderer.initTexture(t); }
    } catch (e) { console.warn('pano warm', e); }
  }

  // the view as the visitor sees it (panorama + earlier changes), JPEG
  function grab() {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/jpeg', 0.9);
  }
  const img = (src) => new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = no; i.src = src; });
  // keep only what changed: a soft mask from the difference between the view sent and the picture returned (RAINBOW's paste-back)
  async function maskOf(beforeUrl, afterUrl) {
    const [a, b] = await Promise.all([img(beforeUrl), img(afterUrl)]);
    const W = 1024, H = Math.round((W * a.height) / a.width);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(a, 0, 0, W, H); const A = x.getImageData(0, 0, W, H).data; x.drawImage(b, 0, 0, W, H); const B = x.getImageData(0, 0, W, H);
    const d = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) { const k = i * 4; d[i] = Math.max(Math.abs(A[k] - B.data[k]), Math.abs(A[k + 1] - B.data[k + 1]), Math.abs(A[k + 2] - B.data[k + 2])) > 26 ? 1 : 0; }
    // close small gaps and feather: box blur twice
    const blur = (s, r) => { const o = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) { let t = 0, n = 0;
      for (let j = -r; j <= r; j += 2) for (let i = -r; i <= r; i += 2) { const yy = y + j, xx = x2 + i; if (yy >= 0 && yy < H && xx >= 0 && xx < W) { t += s[yy * W + xx]; n++; } } o[y * W + x2] = t / n; } return o; };
    let m = blur(d, 8); for (let i = 0; i < m.length; i++) m[i] = m[i] > 0.12 ? 1 : 0; m = blur(m, 6);
    for (let i = 0; i < W * H; i++) B.data[i * 4 + 3] = Math.round(255 * Math.min(1, m[i] * 1.4));
    x.putImageData(B, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  async function edit(instruction, refImage = null, label = '') {
    if (S.busy) return { ok: false, reason: 'busy' };
    S.busy = true; S.orig = false;
    try {
      camera.updateMatrixWorld();
      const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const eye = camera.position.clone(); const view = grab();
      const r = await fetch('./api/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ view, ref: refImage, instruction }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) return { ok: false, reason: j.reason || `HTTP ${r.status}` };
      const t = await maskOf(view, j.url);
      const list = S.patches.get(S.cur.id) || []; list.push({ tex: t, vp, eye, label }); S.patches.set(S.cur.id, list);
      drawPatches(); return { ok: true };
    } catch (e) { return { ok: false, reason: String(e.message || e) }; } finally { S.busy = false; }
  }
  const undo = () => { const l = S.patches.get(S.cur.id) || []; l.pop(); drawPatches(); };
  const reset = () => { S.patches.set(S.cur.id, []); S.orig = false; drawPatches(); };
  const toggleOrig = () => { S.orig = !S.orig; drawPatches(); return S.orig; };
  const changes = () => (S.patches.get(S.cur.id) || []).map((p) => p.label);

  function doll(on) {   // the dollhouse: the model, no panorama
    inDoll = on;
    if (on) { scene.background = new THREE.Color(0x24211e); sky.visible = false; patchGroup.visible = false; for (const o of scene.children) if ((o.isMesh || o.isGroup) && !KEEP.has(o.name)) o.visible = true; scene.traverse((o) => { if (o.isMesh && o.material && (o.material.name === 'ceiling' || o.material.name === 'slab')) o.visible = false; }); }   // the lids stay off, as in the studio's dollhouse
    else { sky.visible = true; patchGroup.visible = true; scene.traverse((o) => { if (o.isMesh && o.material && (o.material.name === 'ceiling' || o.material.name === 'slab')) o.visible = true; }); setModel(false); }
  }
  const start = P.points.find((q) => q.id === 'living') || P.points[0];
  await show(start, false);
  setTimeout(warm, 1500);
  return { points: P.points, show, doll, goNear, tapFloor, frame, edit, undo, reset, toggleOrig, changes, get busy() { return S.busy; }, get cur() { return S.cur; }, get original() { return !!S.orig; } };
}

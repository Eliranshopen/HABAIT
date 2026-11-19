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
  const load = async (u, opt = {}) => {
    let t;
    try {
      const blob = await (await fetch(u)).blob();
      t = new THREE.Texture(await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })); t.flipY = false;
    } catch { t = await new THREE.TextureLoader().loadAsync(u); }   // an older browser without the bitmap options
    t.generateMipmaps = false; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; t.needsUpdate = true;
    if (!opt.defer) renderer.initTexture(t); return t;
  };
  const url = (p) => `./pano/${big ? p.file : p.file.replace('.jpg', '_4k.jpg')}`;
  // 8K panoramas where the GPU takes them (desktop), the 4K copy on phones (max texture 4096); P.has4k says the copies exist
  const big = !P.has4k || (renderer.capabilities.maxTextureSize >= 8192 && !matchMedia('(pointer: coarse)').matches);
  const tex = (p) => {
    if (!cache.has(p.id)) cache.set(p.id, load(url(p)));
    const v = cache.get(p.id); cache.delete(p.id); cache.set(p.id, v);   // most recent last
    while (cache.size > (big ? 2 : 5)) { const [k, old] = cache.entries().next().value; cache.delete(k); old.then((t) => { if (sky.material.map !== t) { t.dispose(); t.image && t.image.close && t.image.close(); } }).catch(() => {}); }   // GPU holds 2 rooms (an 8K pano = 134 MB)
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
  // the sharp 8K picture over the 4K one, in 8 vertical strips uploaded one per idle moment (one 8K upload froze the screen ~0.5 s
  // right after arriving); each strip is cut from the file off the main thread (createImageBitmap with a crop)
  const N8 = 8, sky8 = new THREE.Group(); sky8.name = 'pano-sky8'; sky8.scale.set(-1, 1, 1); sky8.visible = false; scene.add(sky8);
  for (let k = 0; k < N8; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(49, 24, 64, (k * 2 * Math.PI) / N8, (2 * Math.PI) / N8), new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false })); m.renderOrder = -9; m.frustumCulled = false; sky8.add(m); }
  let sharpFor = null;
  const dropSharp = () => { sharpFor = null; sky8.visible = false; for (const m of sky8.children) { const t = m.material.map; if (t) { t.dispose(); t.image && t.image.close && t.image.close(); m.material.map = null; m.material.needsUpdate = true; } } };
  const S = { cur: null, patches: new Map(), busy: false };
  const patchGroup = new THREE.Group(); patchGroup.name = 'pano-patches'; scene.add(patchGroup);
  const KEEP = new Set(['pano-sky', 'pano-sky8', 'pano-patches', 'measure', 'marker']);   // the only scene objects drawn over a panorama
  const offset = THREE.MathUtils.degToRad(P.yaw_offset_deg || 0), sign = P.yaw_sign || 1;

  // ---------------------------------------------------------------- moving between standpoints (Eliran 2026-11-19 «כשאני זז אני רוצה
  // שזה יראה התקדמות … זה באמת יתקדם לחדר»): the eye travels from A to B through the 3D model, with both panoramas projected onto
  // the model from their own points (a depth cube per point decides what each one really saw), cross-fading on the way
  const rotOf = (p) => sign * THREE.MathUtils.degToRad(p.yaw_deg) + offset + Math.PI;
  const invOf = (p) => { const o = new THREE.Object3D(); o.rotation.set(0, rotOf(p), 0); o.scale.set(-1, 1, 1); o.updateMatrixWorld(); return new THREE.Matrix3().setFromMatrix4(o.matrixWorld).invert(); };
  const posOf = (p) => new THREE.Vector3(p.x, P.eye_m || 1.6, -p.y);
  const DIST = new THREE.ShaderMaterial({ uniforms: { src: { value: new THREE.Vector3() } }, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 src; varying vec3 vW; void main(){ gl_FragColor = vec4(length(vW - src), 0.0, 0.0, 1.0); }' });
  // ready BEFORE a move (Eliran 2026-11-19 «עדיין המעברים … לא חלקים»: the move waited ~0.5 s for an 8K picture and two depth cubes):
  // per standpoint a depth cube and a 4K picture, made in idle time for the standpoints around you; the 8K comes after arriving
  const cubeRT = new Map(), mtex = new Map(), MT = big ? 8 : 4;   // rooms kept ready (4K: 33 MB each)
  const murl = (p) => `./pano/${P.has4k ? p.file.replace('.jpg', '_4k.jpg') : p.file}`;
  const moveTex = (p, defer = false) => {
    if (!big) { if (!cache.has(p.id)) cache.set(p.id, load(url(p), { defer })); return tex(p); }
    if (!mtex.has(p.id)) mtex.set(p.id, load(murl(p), { defer }));
    const v = mtex.get(p.id); mtex.delete(p.id); mtex.set(p.id, v);
    while (mtex.size > MT) { const [k, old] = mtex.entries().next().value; mtex.delete(k); old.then((t) => { if (sky.material.map !== t) { t.dispose(); t.image && t.image.close && t.image.close(); } }).catch(() => {}); }
    return v;
  };
  const PROJ = new THREE.ShaderMaterial({
    uniforms: { tA: { value: null }, tB: { value: null }, dA: { value: null }, dB: { value: null }, pA: { value: new THREE.Vector3() }, pB: { value: new THREE.Vector3() },
      iA: { value: new THREE.Matrix3() }, iB: { value: new THREE.Matrix3() }, mixv: { value: 0 }, flip: { value: 1 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D tA, tB; uniform samplerCube dA, dB; uniform vec3 pA, pB; uniform mat3 iA, iB; uniform float mixv, flip; varying vec3 vW;
      const float PI = 3.14159265;
      vec3 eq(sampler2D t, mat3 inv, vec3 d){ vec3 n = normalize(inv * d); float th = acos(clamp(n.y, -1.0, 1.0)); float ph = atan(n.z, -n.x); float u = ph / (2.0 * PI); if (u < 0.0) u += 1.0; return texture2D(t, vec2(u, 1.0 - th / PI)).rgb; }
      float seen(samplerCube c, vec3 d){ float l = length(d); float z = textureCube(c, vec3(flip * d.x, d.yz)).r; return l < z + 0.06 + 0.02 * l ? 1.0 : 0.0; }
      void main(){ vec3 a = vW - pA, b = vW - pB; float wa = (1.0 - mixv) * (0.02 + seen(dA, a)), wb = mixv * (0.02 + seen(dB, b));
        vec3 c = (eq(tA, iA, a) * wa + eq(tB, iB, b) * wb) / max(wa + wb, 1e-4); gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide, toneMapped: false });
  let move = null; window.__panoProj = PROJ;
  const modelMeshes = () => { const l = []; for (const o of scene.children) if ((o.isMesh || o.isGroup) && !KEEP.has(o.name)) o.traverse((m) => { if (m.isMesh) l.push(m); }); return l; };
  function depthCube(p) {   // distance from p to the model, all around (the model drawn with DIST, nothing else); kept per standpoint
    if (cubeRT.has(p.id)) return cubeRT.get(p.id).texture;
    const rt = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const cam = new THREE.CubeCamera(0.05, 60, rt); cubeRT.set(p.id, rt);
    const ms = modelMeshes(), keep = ms.map((m) => [m, m.material, m.visible]), roots = scene.children.filter((o) => (o.isMesh || o.isGroup) && !KEEP.has(o.name)), rv = roots.map((o) => o.visible);
    for (const o of roots) o.visible = true; for (const m of ms) { m.material = DIST; m.visible = true; } const s8 = sky8.visible; sky.visible = false; sky8.visible = false; patchGroup.visible = false;
    DIST.uniforms.src.value.copy(posOf(p)); cam.position.copy(posOf(p)); const bg = scene.background; scene.background = new THREE.Color(1000, 0, 0);
    cam.update(renderer, scene);
    scene.background = bg; for (const [m, mat, v] of keep) { m.material = mat; m.visible = v; } roots.forEach((o, k) => (o.visible = rv[k])); sky.visible = true; sky8.visible = s8; patchGroup.visible = true;
    return rt.texture;
  }
  const idle = () => new Promise((ok) => (window.requestIdleCallback ? requestIdleCallback(ok, { timeout: 400 }) : setTimeout(ok, 60)));
  // uploads (a GPU stall of 50-150 ms each) only while the picture stands still: no move, no drag, no key for 350 ms — a stall of a
  // still picture is invisible
  let lastInput = 0; const touch = () => { lastInput = performance.now(); };
  addEventListener('pointerdown', touch, true); addEventListener('keydown', touch, true); addEventListener('wheel', touch, { capture: true, passive: true });
  addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') touch(); }, true);
  const quiet = async () => { for (;;) { await idle(); if (!move && !window.__panoBusy && performance.now() - lastInput > 350) return; } };
  let prepFor = null, wantIds = [];
  async function sharpen(p) {
    if (!big) return; dropSharp(); sharpFor = p;
    try {
      const blob = await (await fetch(url(p))).blob(); const W = 8192, H = 4096, w = W / N8;
      for (let k = 0; k < N8; k++) {
        const bmp = await createImageBitmap(blob, k * w, 0, w, H, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        await quiet(); if (sharpFor !== p) { bmp.close(); return; }
        const t = new THREE.Texture(bmp); t.flipY = false; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
        renderer.initTexture(t); const m = sky8.children[k]; m.material.map = t; m.material.needsUpdate = true;
      }
      if (sharpFor === p && !move) { sky8.rotation.set(0, rotOf(p), 0); sky8.visible = true; }
    } catch (e) { console.warn('sharpen', e); }
  }
  async function prepAround(p) {   // the rooms whose arrows you see first, then the nearest: their depth cube and 4K picture, in still moments
    const tok = {}; prepFor = tok;
    const near = P.points.filter((q) => q !== p).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const order = [...new Set([...wantIds.map((id) => P.points.find((q) => q.id === id)).filter((q) => q && q !== p), ...near])].slice(0, MT - 1);
    await quiet(); if (prepFor !== tok) return; depthCube(p);
    for (const q of order) {
      await quiet(); if (prepFor !== tok) return; depthCube(q);
      const t = await moveTex(q, true).catch(() => null); if (!t) continue; await quiet(); if (prepFor !== tok) return; renderer.initTexture(t);
    }
  }
  function want(list) {   // studio: the standpoints the arrows on screen lead to
    const ids = list.map(([x, y]) => nearest(x, y).id); if (ids.join() === wantIds.join()) return; wantIds = ids; if (S.cur && !move) prepAround(S.cur);
  }
  let upgrade = 0;
  async function show(p, keepYaw = true, animate = true, face = false) {
    const A = S.cur;
    if (animate && A && A !== p && !inDoll) {
      prepFor = null; clearTimeout(upgrade); dropSharp(); touch();
      const ta = sky.material.map, tb = await moveTex(p);   // ready if prepared; otherwise a 4K picture, about a third of the wait
      PROJ.uniforms.tA.value = ta; PROJ.uniforms.tB.value = tb; PROJ.uniforms.dA.value = depthCube(A); PROJ.uniforms.dB.value = depthCube(p);
      PROJ.uniforms.pA.value.copy(posOf(A)); PROJ.uniforms.pB.value.copy(posOf(p)); PROJ.uniforms.iA.value.copy(invOf(A)); PROJ.uniforms.iB.value.copy(invOf(p)); PROJ.uniforms.mixv.value = 0;
      const ms = modelMeshes(); const keep = ms.map((m) => [m, m.material]); for (const m of ms) m.material = PROJ;
      const d = Math.hypot(p.x - A.x, p.y - A.y), y0 = me.yaw;
      const wrap = (v) => ((((v + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI, travel = Math.atan2(-(p.x - A.x), p.y - A.y);
      const want = face ? travel : keepYaw ? (Math.abs(wrap(travel - y0)) > 0.9 ? travel : y0) : THREE.MathUtils.degToRad(p.yaw_deg);   // an arrow: look where you walk; a room off to the side: turn toward it
      const y1 = y0 + wrap(want - y0);   // the short way round
      patchGroup.visible = false;
      await new Promise((done) => { move = { A, p, t0: performance.now(), dur: THREE.MathUtils.clamp(d / 3.2, 0.75, 1.5) * 1000, y0, y1, done, keep }; });
      for (const [m, mat] of move.keep) m.material = mat; move = null; patchGroup.visible = true; setModel(false);
      sky.material.map = tb; sky.material.needsUpdate = true; sky.rotation.set(0, rotOf(p), 0);
      me.x = p.x; me.y = p.y; S.cur = p; drawPatches(); prepAround(p);
      upgrade = setTimeout(() => { if (S.cur === p && !move) sharpen(p); }, 700);   // the sharp 8K once you stand
      return;
    }
    dropSharp(); const t = await moveTex(p);
    sky.material.map = t; sky.material.needsUpdate = true;
    sky.rotation.set(0, rotOf(p), 0); sharpen(p);
    me.x = p.x; me.y = p.y; if (!keepYaw) me.yaw = THREE.MathUtils.degToRad(p.yaw_deg);
    S.cur = p; drawPatches(); prepAround(p);
    for (const q of P.points) if (q !== p && !warmed.has(q.id)) { warmed.add(q.id); fetch(url(q)).catch(() => {}); }   // prefetch the files only (HTTP cache), not GPU textures
  }
  const nearest = (x, y, notCur) => P.points.filter((q) => !notCur || q !== S.cur).reduce((b, q) => (Math.hypot(q.x - x, q.y - y) < Math.hypot(b.x - x, b.y - y) ? q : b));
  function goNear(x, y) { if (move) return; const p = nearest(x, y); return show(p, false); }   // a room button: that room's panorama, facing its composed view
  function walkTo(x, y) { if (move) return; const p = nearest(x, y); if (p !== S.cur) return show(p, true, true, true); }
  function tapFloor(x, y) { if (move) return; const p = nearest(x, y, true); if (p) show(p); }

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
    if (move) {
      const k = window.__panoHold != null ? window.__panoHold : Math.min(1, (performance.now() - move.t0) / move.dur), e = k * k * (3 - 2 * k);   // __panoHold: test hook (freeze a move)
      me.x = move.A.x + (move.p.x - move.A.x) * e; me.y = move.A.y + (move.p.y - move.A.y) * e; me.yaw = move.y0 + (move.y1 - move.y0) * e;
      camera.position.set(me.x, P.eye_m || 1.6, -me.y); camera.updateMatrixWorld();
      PROJ.uniforms.mixv.value = THREE.MathUtils.smoothstep(k, 0.25, 0.8);
      for (const o of scene.children) if ((o.isMesh || o.isGroup) && !KEEP.has(o.name)) o.visible = true;
      scene.traverse((o) => { if (o.isMesh && o.material === PROJ) o.visible = true; });
      if (k >= 1) move.done();
      sky.position.copy(camera.position); sky8.position.copy(camera.position); return;
    }
    for (const m of patchGroup.children) m.position.copy(camera.position);
    sky.position.copy(camera.position); sky8.position.copy(camera.position);
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
      { const ts = new THREE.Scene(), g = new THREE.BoxGeometry(0.01, 0.01, 0.01); ts.add(new THREE.Mesh(g, PROJ), new THREE.Mesh(g, DIST)); renderer.compile(ts, camera); }   // the move's shaders, ready before the first move
      const tex = new Set(); scene.traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'lightMap']) if (m[k] && m[k].isTexture) tex.add(m[k]); });
      for (const t of tex) { await quiet(); renderer.initTexture(t); }   // never during a move or a drag
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
    if (on) { scene.background = new THREE.Color(0x24211e); sky.visible = false; sky8.visible = false; patchGroup.visible = false; for (const o of scene.children) if ((o.isMesh || o.isGroup) && !KEEP.has(o.name)) o.visible = true; scene.traverse((o) => { if (o.isMesh && o.material && (o.material.name === 'ceiling' || o.material.name === 'slab')) o.visible = false; }); }   // the lids stay off, as in the studio's dollhouse
    else { sky.visible = true; if (sharpFor && sky8.children.every((m) => m.material.map)) sky8.visible = true; patchGroup.visible = true; scene.traverse((o) => { if (o.isMesh && o.material && (o.material.name === 'ceiling' || o.material.name === 'slab')) o.visible = true; }); setModel(false); }
  }
  const start = P.points.find((q) => q.id === 'living') || P.points[0];
  await show(start, false);
  setTimeout(warm, 1500);
  return { get moving() { return !!move; }, want, walkTo, points: P.points, show, doll, goNear, tapFloor, frame, edit, undo, reset, toggleOrig, changes, get busy() { return S.busy; }, get cur() { return S.cur; }, get original() { return !!S.orig; } };
}

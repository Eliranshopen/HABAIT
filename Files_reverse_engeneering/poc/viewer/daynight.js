/* Day/Night panorama viewer — PoC (research, not production).
   One WebGL fragment shader draws an equirectangular panorama with a rectilinear projection and blends the TWO
   lighting keyframes that bracket the chosen clock time (the mechanism measured in the reference video:
   research/01-video-forensics.md §5.1). No dependencies.
   Data: scene.json  { hours:[min,max], start:{node,hour}, nodes:[{ id, label, yaw, pitch, fov,
          keyframes:[{ name, label, hour, src }], views:[{label,yaw,pitch}], hotspots:[{label,yaw,pitch,to}] }] }
   Deterministic: the picture is a pure function of (node, yaw, pitch, fov, hour); window.__dn exposes it for QA. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const canvas = $('#pano');
  const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) { $('#err').hidden = false; return; }
  const MAXTEX = gl.getParameter(gl.MAX_TEXTURE_SIZE);

  // ---------- shader ----------
  const VS = 'attribute vec2 p; varying vec2 v; void main(){ v=p; gl_Position=vec4(p,0.,1.); }';
  const FS = `precision highp float;
    varying vec2 v; uniform sampler2D A; uniform sampler2D B; uniform float mixAB;
    uniform float yaw, pitch, tanHalf, aspect, linearMix;
    const float PI=3.14159265359;
    vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); } vec3 toSrgb(vec3 c){ return pow(c, vec3(1.0/2.2)); }
    void main(){
      vec3 d = normalize(vec3(v.x*tanHalf*aspect, v.y*tanHalf, -1.0));
      float cp=cos(pitch), sp=sin(pitch);           // pitch about X
      d = vec3(d.x, d.y*cp + d.z*sp, -d.y*sp + d.z*cp);
      float cy=cos(yaw), sy=sin(yaw);               // yaw about Y
      d = vec3(d.x*cy - d.z*sy, d.y, d.x*sy + d.z*cy);
      float lon = atan(d.x, -d.z);                  // 0 = image centre
      float lat = asin(clamp(d.y,-1.0,1.0));
      vec2 uv = vec2(lon/(2.0*PI)+0.5, 0.5 - lat/PI);
      vec3 a = texture2D(A, uv).rgb, b = texture2D(B, uv).rgb;
      vec3 c = linearMix > 0.5 ? toSrgb(mix(toLin(a), toLin(b), mixAB)) : mix(a, b, mixAB);
      gl_FragColor = vec4(c, 1.0);
    }`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['A', 'B', 'mixAB', 'yaw', 'pitch', 'tanHalf', 'aspect', 'linearMix'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform1i(U.A, 0); gl.uniform1i(U.B, 1);

  // ---------- state ----------
  const S = { scene: null, node: null, yaw: 0, pitch: 0, fov: 100, hour: 14, linear: false, tex: {}, ready: false, playing: false };
  const DEG = Math.PI / 180;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function loadTex(src) {
    if (S.tex[src]) return S.tex[src];
    S.tex[src] = new Promise((res, rej) => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => {
        let source = im;
        if (im.naturalWidth > MAXTEX) { // phones: downscale to what the GPU accepts
          const c = document.createElement('canvas'); c.width = MAXTEX; c.height = MAXTEX / 2;
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); source = c;
        }
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); // NPOT-safe in WebGL1
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        res(t);
      };
      im.onerror = () => rej(new Error('load ' + src)); im.src = src;
    });
    return S.tex[src];
  }

  /** clock → the two bracketing keyframes and the weight of the later one (piecewise linear, like the reference). */
  function bracket(kfs, h) {
    const k = kfs.slice().sort((a, b) => a.hour - b.hour);
    if (h <= k[0].hour) return [k[0], k[0], 0];
    if (h >= k[k.length - 1].hour) return [k[k.length - 1], k[k.length - 1], 0];
    for (let i = 0; i < k.length - 1; i++) if (h >= k[i].hour && h <= k[i + 1].hour) {
      return [k[i], k[i + 1], (h - k[i].hour) / (k[i + 1].hour - k[i].hour)];
    }
    return [k[0], k[0], 0];
  }

  let texA = null, texB = null, w = 0, pendingDraw = false;
  async function bind() {
    const [a, b, t] = bracket(S.node.keyframes, S.hour);
    const [ta, tb] = await Promise.all([loadTex(a.src), loadTex(b.src)]);
    texA = ta; texB = tb; w = t; draw();
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(canvas.clientWidth * dpr), H = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  }
  function draw() {
    if (pendingDraw) return; pendingDraw = true;
    requestAnimationFrame(() => {
      pendingDraw = false; if (!texA) return; resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      const aspect = canvas.width / canvas.height;
      // the FOV is horizontal on landscape screens and vertical on portrait ones (phones keep a sane look)
      const vfov = aspect >= 1 ? 2 * Math.atan(Math.tan(S.fov * DEG / 2) / aspect) : S.fov * DEG * 0.75;
      gl.uniform1f(U.tanHalf, Math.tan(vfov / 2)); gl.uniform1f(U.aspect, aspect);
      gl.uniform1f(U.yaw, S.yaw * DEG); gl.uniform1f(U.pitch, S.pitch * DEG);
      gl.uniform1f(U.mixAB, w); gl.uniform1f(U.linearMix, S.linear ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      placeHotspots(vfov, aspect);
      document.body.dataset.ready = '1';
    });
  }

  // ---------- hotspots (projected each frame) ----------
  function placeHotspots(vfov, aspect) {
    const th = Math.tan(vfov / 2);
    document.querySelectorAll('.hs').forEach((el) => {
      const y = +el.dataset.yaw * DEG - S.yaw * DEG, p = +el.dataset.pitch * DEG;
      // direction of the hotspot in camera space (inverse of the shader's rotation)
      let d = [Math.cos(p) * Math.sin(y), Math.sin(p), -Math.cos(p) * Math.cos(y)];
      const cp = Math.cos(-S.pitch * DEG), sp = Math.sin(-S.pitch * DEG);
      d = [d[0], d[1] * cp + d[2] * sp, -d[1] * sp + d[2] * cp];
      if (d[2] >= -0.05) { el.hidden = true; return; }
      const x = d[0] / -d[2] / (th * aspect), yy = d[1] / -d[2] / th;
      if (Math.abs(x) > 1.1 || Math.abs(yy) > 1.1) { el.hidden = true; return; }
      el.hidden = false;
      el.style.left = ((x + 1) / 2 * 100) + '%'; el.style.top = ((1 - yy) / 2 * 100) + '%';
    });
  }

  // ---------- UI ----------
  const fmt = (h) => { const m = Math.round(h * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  function setHour(h) {
    S.hour = clamp(h, S.scene.hours[0], S.scene.hours[1]);
    $('#clock').textContent = fmt(S.hour); $('#hour').value = S.hour;
    const [a, b, t] = bracket(S.node.keyframes, S.hour);
    $('#mixinfo').textContent = (a === b || t < 0.005) ? a.label : t > 0.995 ? b.label
      : `${a.label} ${Math.round((1 - t) * 100)}% · ${b.label} ${Math.round(t * 100)}%`;
    bind();
  }
  function tween(to, ms) {
    const from = { yaw: S.yaw, pitch: S.pitch }; let dy = ((to.yaw - from.yaw + 540) % 360) - 180;
    const t0 = performance.now();
    const step = (now) => { const k = clamp((now - t0) / ms, 0, 1), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      S.yaw = from.yaw + dy * e; S.pitch = from.pitch + (to.pitch - from.pitch) * e; draw(); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  async function goNode(id, view) {
    const n = S.scene.nodes.find((x) => x.id === id); if (!n) return;
    canvas.classList.add('fade');
    S.node = n; await Promise.all(n.keyframes.map((k) => loadTex(k.src))); // preload every lighting state of the node
    S.yaw = view ? view.yaw : n.yaw; S.pitch = view ? view.pitch : n.pitch; S.fov = n.fov || 100;
    $('#room').textContent = n.label;
    const tabs = $('#tabs'); tabs.innerHTML = '';
    S.scene.nodes.forEach((m) => (m.views || [{ label: m.label, yaw: m.yaw, pitch: m.pitch }]).forEach((vw) => {
      const b = document.createElement('button'); b.textContent = vw.label; b.className = m.id === n.id ? 'here' : '';
      b.onclick = () => (m.id === n.id ? tween(vw, 900) : goNode(m.id, vw)); tabs.appendChild(b); }));
    const hs = $('#hotspots'); hs.innerHTML = '';
    (n.hotspots || []).forEach((h) => { const b = document.createElement('button'); b.className = 'hs'; b.textContent = '↗ ' + h.label;
      b.dataset.yaw = h.yaw; b.dataset.pitch = h.pitch; b.onclick = () => goNode(h.to); hs.appendChild(b); });
    setHour(S.hour);
    setTimeout(() => canvas.classList.remove('fade'), 30);
  }

  // drag (mouse + touch through pointer events), pinch + wheel zoom, keys, inertia
  const ptrs = new Map(); let last = null, vel = { x: 0, y: 0 }, pinch0 = 0, fov0 = 0;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, e); last = e; vel = { x: 0, y: 0 };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); fov0 = S.fov; } stopIntro(); });
  canvas.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, e);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      S.fov = clamp(fov0 * pinch0 / d, 45, 115); draw(); return; }
    const k = S.fov / canvas.clientWidth; const dx = (e.clientX - last.clientX) * k, dy = (e.clientY - last.clientY) * k;
    S.yaw -= dx; S.pitch = clamp(S.pitch + dy, -80, 80); vel = { x: dx, y: dy }; last = e; draw(); });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size === 0) coast(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  function coast() { const f = () => { vel.x *= 0.92; vel.y *= 0.92; if (Math.abs(vel.x) + Math.abs(vel.y) < 0.01) return;
    S.yaw -= vel.x; S.pitch = clamp(S.pitch + vel.y, -80, 80); draw(); requestAnimationFrame(f); }; requestAnimationFrame(f); }
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); S.fov = clamp(S.fov + e.deltaY * 0.05, 45, 115); draw(); }, { passive: false });
  window.addEventListener('keydown', (e) => { const m = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
    if (m && e.target.tagName !== 'INPUT') { S.yaw += m[0]; S.pitch = clamp(S.pitch + m[1], -80, 80); draw(); } });
  window.addEventListener('resize', draw);

  // slider, play (a full day in 8 s), linear-light toggle
  $('#hour').addEventListener('input', (e) => setHour(+e.target.value));
  let playRaf = 0;
  $('#play').onclick = () => {
    if (S.playing) { S.playing = false; cancelAnimationFrame(playRaf); $('#play').textContent = '▶'; return; }
    S.playing = true; $('#play').textContent = '❚❚'; const [h0, h1] = S.scene.hours; let t0 = null; const from = S.hour >= h1 ? h0 : S.hour;
    const f = (now) => { if (!S.playing) return; if (t0 === null) t0 = now; const h = from + (now - t0) / 8000 * (h1 - h0);
      if (h >= h1) { setHour(h1); S.playing = false; $('#play').textContent = '▶'; return; } setHour(h); playRaf = requestAnimationFrame(f); };
    playRaf = requestAnimationFrame(f);
  };
  $('#linear').onchange = (e) => { S.linear = e.target.checked; draw(); };
  document.querySelectorAll('[data-hour]').forEach((b) => { b.onclick = () => animateHour(+b.dataset.hour); });
  function animateHour(target) { const from = S.hour, t0 = performance.now(), ms = 1200;
    const f = (now) => { const k = clamp((now - t0) / ms, 0, 1); setHour(from + (target - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f); }
  let introOn = false; function stopIntro() { introOn = false; }

  // ---------- boot ----------
  fetch('scene.json').then((r) => r.json()).then(async (sc) => {
    S.scene = sc; const q = new URLSearchParams(location.search);
    if (q.get('ui') === '0') document.body.classList.add('noui'); // QA: the canvas alone
    $('#hour').min = sc.hours[0]; $('#hour').max = sc.hours[1];
    S.hour = q.has('hour') ? +q.get('hour') : sc.start.hour; S.linear = q.get('linear') === '1'; $('#linear').checked = S.linear;
    const view = q.has('yaw') ? { yaw: +q.get('yaw'), pitch: +(q.get('pitch') || 0) } : null;
    await goNode(q.get('node') || sc.start.node, view);
    if (q.has('fov')) { S.fov = +q.get('fov'); draw(); }
  }).catch((e) => { $('#err').hidden = false; $('#err').textContent = String(e); });

  window.__dn = { state: S, setHour, goNode, bracket, draw }; // QA hook
})();

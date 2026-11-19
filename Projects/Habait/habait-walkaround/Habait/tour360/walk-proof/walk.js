/* walk.js — the WALK PROOF (2026-11-12, Eliran: «אני לא רוצה לוותר על אופציית התנועה בדירה כאילו מישהו הולך בה»).
   Continuous walking between Blender pictures. Every walk point has a 360 picture AND its exact depth map (Cycles, the same scene),
   so each picture is drawn as a 3D shell: a grid on the sphere pushed out to the measured distance. The camera then really moves
   through space; between two points both shells are drawn from the camera's place and cross-faded, so a step can stop anywhere on
   the way. The camera is held on a rail (walk.json's links) — the places the model was rendered from.
   Desktop: hold ↑ to walk ahead, ↓ back, ← → turn, or click the floor. Phone: drag to look, tap the floor to walk there (no arrow
   buttons on a phone — Eliran 2026-11-11). Raw WebGL2, no library. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('gl'), sayEl = $('w-say'), hintEl = $('w-hint'), cmpBtn = $('w-cmp'), whereEl = $('w-where'), dotsEl = $('w-dots'), loadEl = $('w-load');
  const params = new URLSearchParams(location.search);
  const coarse = matchMedia('(pointer: coarse)').matches;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  const W = { ready: false, nodes: [], edges: [], a: 0, b: 0, s: 0, yaw: 0, pitch: 0, moving: false, compare: false, frames: 0, errors: [] };
  window.__walk = W;
  if (!gl) { $('w-load-text').textContent = 'הדפדפן הזה לא תומך בתצוגה התלת-ממדית'; return; }

  const XF0 = Number(params.get('xf0') || 0.38), XF1 = Number(params.get('xf1') || 0.62);
  const DEG = Math.PI / 180, GW = coarse ? 384 : 512, GH = GW / 2, EYE = 1.6, SPEED = 1.25, TURN = 85, SKY = 80, TEAR = 1.22;
  const FOVY = () => (canvas.clientHeight > canvas.clientWidth ? 86 : 68) * DEG;

  /* ---------- small matrix kit (column-major) ---------- */
  const persp = (fovy, asp, n, f) => { const t = 1 / Math.tan(fovy / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; };
  const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; };
  const fwd = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  const view = (eye, yaw, pitch) => {   // rows: right, up, -forward
    const f = fwd(yaw, pitch), r = [Math.cos(yaw), 0, Math.sin(yaw)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -(r[0] * eye[0] + r[1] * eye[1] + r[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1];
  };

  /* ---------- shaders ---------- */
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aUV'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  const meshP = prog(`#version 300 es
    in vec3 aPos; in vec2 aUV; uniform mat4 uMVP; uniform vec3 uOff; out vec2 vUV;
    void main() { vUV = aUV; gl_Position = uMVP * vec4(aPos + uOff, 1.0); }`, `#version 300 es
    precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform float uAlpha; out vec4 o;
    void main() { o = vec4(texture(uTex, vUV).rgb, uAlpha); }`);
  const compP = prog(`#version 300 es
    out vec2 vUV; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUV = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`, `#version 300 es
    precision highp float; in vec2 vUV; uniform sampler2D uA, uB; uniform float uT; out vec4 o;
    void main() { vec4 A = texture(uA, vUV), B = texture(uB, vUV); float wa = (1.0 - uT) * A.a, wb = uT * B.a, s = wa + wb;
      o = vec4(s > 0.0001 ? (A.rgb * wa + B.rgb * wb) / s : mix(A.rgb, B.rgb, uT), 1.0); }`);
  const U = (p, n) => gl.getUniformLocation(p, n);
  const mU = { mvp: U(meshP, 'uMVP'), off: U(meshP, 'uOff'), tex: U(meshP, 'uTex'), alpha: U(meshP, 'uAlpha') }, cU = { a: U(compP, 'uA'), b: U(compP, 'uB'), t: U(compP, 'uT') };
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const emptyVao = gl.createVertexArray();

  /* ---------- a shell: the picture's grid pushed out to its depth ---------- */
  function shell(depth, DW, DH, yaw0, gw, gh) {   // depth: Float32Array metres (null = a plain sphere, 10 m)
    const pos = new Float32Array((gw + 1) * (gh + 1) * 3), uv = new Float32Array((gw + 1) * (gh + 1) * 2), dd = new Float32Array((gw + 1) * (gh + 1));
    let k = 0, q = 0, n = 0;
    for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) {
      const u = i / gw, v = j / gh, lon = (u - 0.5) * 2 * Math.PI + yaw0, lat = (0.5 - v) * Math.PI;
      let d = 10; if (depth) { const px = Math.min(DW - 1, Math.round(u * DW)) % DW, py = Math.min(DH - 1, Math.max(0, Math.round(v * DH - 0.5))); d = depth[py * DW + px]; }
      dd[n++] = d; pos[k++] = Math.sin(lon) * Math.cos(lat) * d; pos[k++] = Math.sin(lat) * d; pos[k++] = -Math.cos(lon) * Math.cos(lat) * d; uv[q++] = u; uv[q++] = v;
    }
    const all = new Uint32Array(gw * gh * 6), clean = new Uint32Array(gw * gh * 6); let na = 0, nc = 0; const row = gw + 1;
    const tri = (p0, p1, p2) => { all[na++] = p0; all[na++] = p1; all[na++] = p2; const lo = Math.min(dd[p0], dd[p1], dd[p2]), hi = Math.max(dd[p0], dd[p1], dd[p2]); if (hi <= lo * TEAR) { clean[nc++] = p0; clean[nc++] = p1; clean[nc++] = p2; } };
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const p = j * row + i; tri(p, p + row, p + 1); tri(p + 1, p + row, p + row + 1); }
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const bp = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bp); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const bu = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bu); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    const idx = new Uint32Array(na + nc); idx.set(all.subarray(0, na), 0); idx.set(clean.subarray(0, nc), na);
    const bi = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bi); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, na, nc, bufs: [bp, bu, bi] };
  }
  async function texture(url) {
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    if (bmp.close) bmp.close(); return t;
  }
  async function depthOf(url, DW, DH) {   // rgb24 big-endian centimetres -> metres
    const bmp = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = document.createElement('canvas'); c.width = DW; c.height = DH; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, DW, DH);
    const px = x.getImageData(0, 0, DW, DH).data, d = new Float32Array(DW * DH);
    for (let i = 0; i < d.length; i++) { const v = ((px[i * 4] << 16) | (px[i * 4 + 1] << 8) | px[i * 4 + 2]) / 100; d[i] = v > 0 && v < SKY ? v : SKY; }
    return d;
  }
  const LRU = coarse ? 5 : 7; let tick = 0;
  function ensure(i) {
    const n = W.nodes[i]; n.used = ++tick;
    if (!n.load) n.load = (async () => {
      const [tex, depth] = await Promise.all([texture((coarse ? 'pano-s/' : 'pano/') + n.id + '.webp?v=' + n.sha), n.depth ? n.depth : depthOf('depth/' + n.id + '.png?v=' + n.sha, W.DW, W.DH)]);
      n.depth = depth; n.tex = tex; n.mesh = shell(depth, W.DW, W.DH, (n.yaw || 0) * DEG, GW, GH); n.ok = true; dirty = true;
      const live = W.nodes.filter((m) => m.ok).sort((p, q) => p.used - q.used);
      while (live.length > LRU) { const m = live.shift(); if (m === W.nodes[W.a] || m === W.nodes[W.b]) continue; gl.deleteTexture(m.tex); m.mesh.bufs.forEach((b) => gl.deleteBuffer(b)); gl.deleteVertexArray(m.mesh.vao); m.ok = false; m.load = null; m.tex = m.mesh = null; }
      return n;
    })().catch((e) => { n.load = null; W.errors.push(String(e)); throw e; });
    return n.load;
  }
  const near = (i) => { ensure(i); for (const j of W.nodes[i].adj) ensure(j).catch(() => {}); };

  /* ---------- frame buffers for the two shells ---------- */
  const fb = [null, null]; let fbW = 0, fbH = 0;
  function targets() {
    if (fbW === canvas.width && fbH === canvas.height) return;
    fbW = canvas.width; fbH = canvas.height;
    for (let k = 0; k < 2; k++) {
      if (fb[k]) { gl.deleteFramebuffer(fb[k].f); gl.deleteTexture(fb[k].t); gl.deleteRenderbuffer(fb[k].d); }
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fbW, fbH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, fbW, fbH);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
      fb[k] = { f, t, d };
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* ---------- the rail ---------- */
  /* A link is a ROUTE: a polyline in metres from node i to node j (walk.json's third field, else the straight line). W.s is the
     fraction of the route's length walked from W.a toward W.b. */
  const P = (i) => W.nodes[i], xz = (n) => [n.x / 100, n.y / 100];
  const GEO = new Map(), gk = (i, j) => i * 4096 + j;
  function addRoute(i, j, ptsCm) {
    const pts = (ptsCm && ptsCm.length >= 2 ? ptsCm : [[P(i).x, P(i).y], [P(j).x, P(j).y]]).map((q) => [q[0] / 100, q[1] / 100]);
    const mk = (ps) => { const cum = [0]; for (let k = 1; k < ps.length; k++) cum.push(cum[k - 1] + Math.hypot(ps[k][0] - ps[k - 1][0], ps[k][1] - ps[k - 1][1])); return { pts: ps, cum, L: cum[cum.length - 1] }; };
    GEO.set(gk(i, j), mk(pts)); GEO.set(gk(j, i), mk(pts.slice().reverse()));
  }
  const geo = (i, j) => GEO.get(gk(i, j));
  const len = (i, j) => geo(i, j).L;
  function along(g, d) {   // the point and the heading (plan bearing) at arc length d
    d = Math.max(0, Math.min(g.L, d)); let k = 1; while (k < g.cum.length - 1 && g.cum[k] < d) k++;
    const A = g.pts[k - 1], B = g.pts[k], sl = g.cum[k] - g.cum[k - 1] || 1, f = (d - g.cum[k - 1]) / sl;
    return { p: [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f], h: Math.atan2(B[0] - A[0], -(B[1] - A[1])) };
  }
  const headAt = (i, j, s) => { const g = geo(i, j); return along(g, Math.min(g.L, s * g.L + 1e-4)).h; };
  /* where a route LEADS: the bearing from a place on it to the point `ahead` metres further on (routes that share their first run
     — the entrance passage to the guest bath and to bedroom 2 — part a little later; looking ahead tells them apart) */
  function headLook(i, j, s, ahead) { const g = geo(i, j), d = s * g.L, a0 = along(g, d).p, a1 = along(g, Math.min(g.L, d + ahead)).p; return Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) < 1e-3 ? along(g, Math.min(g.L, d + 1e-4)).h : Math.atan2(a1[0] - a0[0], -(a1[1] - a0[1])); }
  const bearing = (i, j) => headLook(i, j, 0, 2.6);
  const here = () => (W.a === W.b ? xz(P(W.a)) : along(geo(W.a, W.b), W.s * len(W.a, W.b)).p);
  const atNode = () => W.a === W.b;
  const wrap = (r) => Math.atan2(Math.sin(r), Math.cos(r));
  function arrive(i) { W.a = W.b = i; W.s = 0; W.dir = 0; near(i); where(); }
  function settleNode() { if (W.a !== W.b) { if (W.s <= 1e-4) arrive(W.a); else if (W.s >= 1 - 1e-4) arrive(W.b); } }
  /* walk `dist` metres toward heading `h` (radians, plan bearing); returns false when there is no way that way */
  function stride(h, dist) {   // returns false when there is no way that way; W.walkHead = the heading of the step taken
    let guard = 0;
    while (dist > 1e-5 && guard++ < 6) {
      if (atNode()) {
        let best = -1, bc = Math.cos(72 * DEG);
        for (const j of P(W.a).adj) { const c = Math.cos(wrap(bearing(W.a, j) - h)); if (c > bc) { bc = c; best = j; } }
        if (best < 0) return false;
        if (!P(best).ok) { ensure(best).catch(() => {}); return true; }   // the next shell is still arriving: wait in place
        W.b = best; W.s = 0; W.dir = 1;
      }
      if (!W.dir) { const c = Math.cos(wrap(headAt(W.a, W.b, W.s) - h)); if (Math.abs(c) < Math.cos(80 * DEG)) return false; W.dir = c > 0 ? 1 : -1; }
      const L = len(W.a, W.b);
      if (W.dir > 0) { W.walkHead = headLook(W.a, W.b, W.s, 1.2); const room = (1 - W.s) * L; if (dist >= room) { dist -= room; arrive(W.b); h = W.walkHead; } else { W.s += dist / L; dist = 0; } }
      else { W.walkHead = wrap(headLook(W.b, W.a, 1 - W.s, 1.2)); const room = W.s * L; if (dist >= room) { dist -= room; arrive(W.a); h = W.walkHead; } else { W.s -= dist / L; dist = 0; } }
    }
    return true;
  }
  /* the rail point nearest to a floor point (metres) */
  function nearestRail(x, z) {
    let best = null;
    for (const [i, j] of W.edges) {
      const g = geo(i, j);
      for (let k = 1; k < g.pts.length; k++) {
        const A = g.pts[k - 1], B = g.pts[k], dx = B[0] - A[0], dz = B[1] - A[1], L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (z - A[1]) * dz) / L2));
        const d = Math.hypot(x - A[0] - t * dx, z - A[1] - t * dz); if (!best || d < best.d) best = { d, i, j, t: (g.cum[k - 1] + t * (g.cum[k] - g.cum[k - 1])) / g.L };
      }
    }
    return best;
  }
  function route(from, to) {   // node ids, breadth first
    const prev = new Map([[from, -1]]), q = [from];
    while (q.length) { const c = q.shift(); if (c === to) break; for (const j of P(c).adj) if (!prev.has(j)) { prev.set(j, c); q.push(j); } }
    if (!prev.has(to)) return null; const out = []; for (let c = to; c !== -1; c = prev.get(c)) out.unshift(c); return out;
  }
  let glide = null;
  function goTo(t) {   // t: { i, j, t } on a link
    const starts = atNode() ? [[W.a, 0]] : [[W.a, W.s * len(W.a, W.b)], [W.b, (1 - W.s) * len(W.a, W.b)]];
    const sameEdge = !atNode() && ((W.a === t.i && W.b === t.j) || (W.a === t.j && W.b === t.i));
    if (sameEdge) { glide = { nodes: [], end: t, user: false }; return; }
    let best = null;
    for (const [s0, d0] of starts) for (const [e0, d1] of [[t.i, t.t * len(t.i, t.j)], [t.j, (1 - t.t) * len(t.i, t.j)]]) {
      const r = route(s0, e0); if (!r) continue; let d = d0 + d1; for (let k = 1; k < r.length; k++) d += len(r[k - 1], r[k]);
      if (!best || d < best.d) best = { d, r };
    }
    if (best) glide = { nodes: best.r, end: t, user: false };
  }
  function glideStep(dist) {
    let guard = 0, head = null;
    while (glide && dist > 1e-5 && guard++ < 6) {
      if (glide.nodes.length) {
        const n = glide.nodes[0];
        if (atNode()) { if (W.a === n) { glide.nodes.shift(); continue; } if (!P(n).ok) { ensure(n).catch(() => {}); break; } W.b = n; W.s = 0; }
        const L = len(W.a, W.b);
        if (n === W.b) { head = headLook(W.a, W.b, W.s, 1.2); const room = (1 - W.s) * L; if (dist >= room) { dist -= room; arrive(W.b); glide.nodes.shift(); } else { W.s += dist / L; dist = 0; } }
        else { head = headLook(W.b, W.a, 1 - W.s, 1.2); const room = W.s * L; if (dist >= room) { dist -= room; arrive(W.a); glide.nodes.shift(); } else { W.s -= dist / L; dist = 0; } }
      } else {
        const e = glide.end;
        if (atNode()) { if (W.a === e.i) { W.b = e.j; W.s = 0; } else if (W.a === e.j) { W.a = e.i; W.b = e.j; W.s = 1; } else { glide = null; break; } if (!P(W.a).ok || !P(W.b).ok) { ensure(W.a).catch(() => {}); ensure(W.b).catch(() => {}); if (W.s === 1) arrive(e.j); else arrive(e.i); break; } }
        const want = W.a === e.i ? e.t : 1 - e.t, L = len(W.a, W.b), gap = (want - W.s) * L;
        if (Math.abs(gap) < 1e-4) { glide = null; settleNode(); break; }
        head = gap > 0 ? headLook(W.a, W.b, W.s, 1.2) : headLook(W.b, W.a, 1 - W.s, 1.2);
        if (dist >= Math.abs(gap)) { W.s = want; dist = 0; glide = null; } else { W.s += Math.sign(gap) * dist / L; dist = 0; }
        if (!glide) settleNode();
      }
    }
    return head;
  }

  /* ---------- what the eye sees from a place: the floor point under a screen point, cut at the first surface ---------- */
  function depthAt(n, dx, dy, dz) {
    if (!n.depth) return SKY; const l = Math.hypot(dx, dy, dz) || 1, lon = Math.atan2(dx, -dz) - (n.yaw || 0) * DEG, lat = Math.asin(dy / l);
    let u = lon / (2 * Math.PI) + 0.5; u -= Math.floor(u); const v = 0.5 - lat / Math.PI;
    return n.depth[Math.min(W.DH - 1, Math.max(0, Math.floor(v * W.DH))) * W.DW + Math.min(W.DW - 1, Math.floor(u * W.DW))];
  }
  const nearNode = () => P(atNode() || W.s < 0.5 ? W.a : W.b);
  function floorUnder(cx, cy) {
    const r = canvas.getBoundingClientRect(), nx = ((cx - r.left) / r.width) * 2 - 1, ny = 1 - ((cy - r.top) / r.height) * 2, t = Math.tan(FOVY() / 2), asp = r.width / r.height;
    const f = fwd(W.yaw, W.pitch), rt = [Math.cos(W.yaw), 0, Math.sin(W.yaw)], up = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]];
    const d = [f[0] + rt[0] * nx * t * asp + up[0] * ny * t, f[1] + rt[1] * nx * t * asp + up[1] * ny * t, f[2] + rt[2] * nx * t * asp + up[2] * ny * t], l = Math.hypot(d[0], d[1], d[2]);
    d[0] /= l; d[1] /= l; d[2] /= l; const h = here();
    let dist = d[1] < -0.02 ? EYE / -d[1] : 30; const n = nearNode(), N = xz(n);
    const seen = depthAt(n, h[0] + d[0] * dist - N[0], EYE + d[1] * dist - EYE, h[1] + d[2] * dist - N[1]);   // how far that node sees toward the aimed point
    const aimed = Math.hypot(h[0] + d[0] * dist - N[0], d[1] * dist, h[1] + d[2] * dist - N[1]);
    if (aimed > seen + 0.35) dist *= Math.max(0.2, (seen - 0.3) / aimed);   // the aim is behind a wall or a piece: stop in front of it
    return [h[0] + d[0] * dist, h[1] + d[2] * dist];
  }
  function target(cx, cy) { const p = floorUnder(cx, cy), t = nearestRail(p[0], p[1]); return t && t.d < 1.7 ? t : null; }

  /* ---------- words on the screen ---------- */
  let sayT = 0;
  function say(text, ms) { sayEl.textContent = text; sayEl.classList.add('is-on'); clearTimeout(sayT); sayT = setTimeout(() => sayEl.classList.remove('is-on'), ms || 900); }
  function where() { const n = atNode() ? P(W.a) : null; whereEl.innerHTML = '<b>ניסוי הליכה</b> · ' + (n && n.name ? n.name : 'דירה 846'); }
  hintEl.textContent = coarse ? 'גררו כדי להסתובב · הקישו על הרצפה כדי ללכת לשם' : 'החזיקו ↑ כדי ללכת קדימה · ↓ אחורה · ← → להסתובב · או לחצו על הרצפה';
  let hintOff = 0; const walked = () => { if (!hintOff) hintOff = setTimeout(() => hintEl.classList.add('is-off'), 6000); };

  /* ---------- input ---------- */
  const keys = {}; let drag = null, dirty = true, userTurn = 0;
  const KEY = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  addEventListener('keydown', (e) => { const k = KEY[e.code]; if (!k || e.ctrlKey || e.metaKey || e.altKey) return; e.preventDefault(); if (!keys[k]) { keys[k] = true; if (k === 'up' || k === 'down') { glide = null; W.dir = 0; setCompare(false); } } dirty = true; });
  addEventListener('keyup', (e) => { const k = KEY[e.code]; if (k) { keys[k] = false; dirty = true; } });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  canvas.addEventListener('pointerdown', (e) => { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* a pointer that is already gone */ } drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false }; canvas.classList.add('is-drag'); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) { if (!coarse) canvas.classList.toggle('can-go', Boolean(W.ready && target(e.clientX, e.clientY))); return; }
    const k = FOVY() / canvas.clientHeight; W.yaw = wrap(W.yaw - (e.clientX - drag.x) * k); W.pitch = Math.max(-80 * DEG, Math.min(80 * DEG, W.pitch + (e.clientY - drag.y) * k));
    drag.x = e.clientX; drag.y = e.clientY; if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 7) { drag.moved = true; userTurn = performance.now(); if (glide) glide.user = true; } dirty = true;
  });
  const up = (e) => {
    if (!drag) return; const d = drag; drag = null; canvas.classList.remove('is-drag');
    if (e.type === 'pointerup' && !d.moved && performance.now() - d.t < 450 && W.ready) {
      const t = target(e.clientX, e.clientY);
      if (t) { setCompare(false); goTo(t); walked(); } else say('אפשר ללכת לאורך העיגולים שעל הרצפה', 1600);
      dirty = true;
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  function setCompare(on) { on = Boolean(on && atNode() && P(W.a).compare); if (on === W.compare) return; W.compare = on; cmpBtn.classList.toggle('is-on', on); cmpBtn.textContent = on ? 'חזרה לתמונת הבלנדר' : 'השוואה לתמונת הסיור הקיים'; if (on) loadCompare(P(W.a)); dirty = true; }
  cmpBtn.addEventListener('click', () => setCompare(!W.compare));
  function loadCompare(n) { if (n.cmp) return; n.cmp = { tex: null, mesh: shell(null, 0, 0, n.compare.bearing * DEG, 96, 48) }; texture(n.compare.file + '?v=' + n.sha).then((t) => { n.cmp.tex = t; dirty = true; }).catch((e) => W.errors.push(String(e))); }

  /* ---------- the floor rings: where the rail runs, hidden behind walls ---------- */
  const dots = [];
  function layDots() {
    for (const [i, j] of W.edges) { const g = geo(i, j), k = Math.max(1, Math.round(g.L / 0.55)); for (let q = 0; q <= k; q++) { if (q === 0 && dots.some((d) => d.node === i)) continue; if (q === k && dots.some((d) => d.node === j)) continue; const p = along(g, g.L * q / k).p, el = document.createElement('div'); el.className = 'w-dot' + (q === 0 || q === k ? ' is-node' : ''); dotsEl.appendChild(el); dots.push({ x: p[0], z: p[1], el, node: q === 0 ? i : q === k ? j : -1 }); } }
  }
  function drawDots(vp, eye) {
    const n = nearNode(), N = xz(n), w = canvas.clientWidth, h = canvas.clientHeight;
    for (const d of dots) {
      const X = d.x, Y = 0.02, Z = d.z, cw = vp[3] * X + vp[7] * Y + vp[11] * Z + vp[15], dist = Math.hypot(X - eye[0], Z - eye[2]); let on = cw > 0.1 && dist > 0.75 && dist < 7 && !W.compare;
      if (on) { const seen = depthAt(n, X - N[0], Y - EYE, Z - N[1]), far = Math.hypot(X - N[0], Y - EYE, Z - N[1]); if (far > seen + 0.25) on = false; }
      if (!on) { if (d.on) { d.el.style.opacity = '0'; d.on = false; } continue; }
      const sx = ((vp[0] * X + vp[4] * Y + vp[8] * Z + vp[12]) / cw * 0.5 + 0.5) * w, sy = (0.5 - (vp[1] * X + vp[5] * Y + vp[9] * Z + vp[13]) / cw * 0.5) * h, s = Math.max(0.3, Math.min(1.6, 1.9 / dist));
      d.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${s.toFixed(3)}, ${(s * Math.min(1, Math.max(0.3, EYE / dist))).toFixed(3)})`; d.el.style.opacity = String(Math.min(0.9, (7 - dist) / 2)); d.on = true;
    }
  }

  /* ---------- drawing ---------- */
  function size() { const r = Math.min(devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * r), h = Math.round(canvas.clientHeight * r); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true; } }
  function drawShell(n, mesh, tex, mvp, off, pass) {   // pass: 'all' = the whole sheet, 'both' = sheet as a wash (alpha 0) then the clean part (alpha 1)
    gl.useProgram(meshP); gl.uniformMatrix4fv(mU.mvp, false, mvp); gl.uniform3f(mU.off, off[0], off[1], off[2]); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(mU.tex, 0);
    gl.bindVertexArray(mesh.vao); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    if (pass === 'all') { gl.uniform1f(mU.alpha, 1); gl.drawElements(gl.TRIANGLES, mesh.na, gl.UNSIGNED_INT, 0); }
    else { gl.uniform1f(mU.alpha, 0); gl.drawElements(gl.TRIANGLES, mesh.na, gl.UNSIGNED_INT, 0); gl.clear(gl.DEPTH_BUFFER_BIT); gl.uniform1f(mU.alpha, 1); gl.drawElements(gl.TRIANGLES, mesh.nc, gl.UNSIGNED_INT, mesh.na * 4); }
    gl.bindVertexArray(null);
  }
  let bob = 0;
  function draw() {
    size(); targets(); const h = here(), eye = [h[0], EYE + (W.moving && !still ? Math.sin(bob * 2 * Math.PI) * 0.012 : 0), h[1]];
    const vp = mul(persp(FOVY(), canvas.width / canvas.height, 0.03, 200), view(eye, W.yaw, W.pitch)), A = P(W.a), B = P(W.b);
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0.07, 0.07, 0.07, 0);
    if (W.compare && atNode() && A.cmp && A.cmp.tex) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); drawShell(A, A.cmp.mesh, A.cmp.tex, vp, eye, 'all'); }
    else if (atNode() || !B.ok || !A.ok) { const n = A.ok ? A : B; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); if (n.ok) drawShell(n, n.mesh, n.tex, vp, [n.x / 100, EYE, n.y / 100], 'all'); }
    else {
      [A, B].forEach((n, k) => { gl.bindFramebuffer(gl.FRAMEBUFFER, fb[k].f); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); drawShell(n, n.mesh, n.tex, vp, [n.x / 100, EYE, n.y / 100], 'both'); });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.disable(gl.DEPTH_TEST); gl.useProgram(compP); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fb[0].t); gl.uniform1i(cU.a, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fb[1].t); gl.uniform1i(cU.b, 1);
      const t = Math.max(0, Math.min(1, (W.s - XF0) / (XF1 - XF0))); gl.uniform1f(cU.t, t * t * (3 - 2 * t));   /* a short blend: less double image */ gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    }
    drawDots(vp, eye); W.frames++;
  }
  let last = 0, noWay = 0;
  function frame(now) {
    requestAnimationFrame(frame); const dt = Math.min(0.2, (now - last) / 1000 || 0);   /* walking speed is metres per second, not per frame */ last = now; if (!W.ready) return;
    let moved = false;
    if (keys.left || keys.right) { W.yaw = wrap(W.yaw + (keys.right ? 1 : -1) * TURN * DEG * dt); userTurn = now; dirty = true; say(keys.right ? 'מסתובבים ימינה ←' : '→ מסתובבים שמאלה', 500); }
    if (keys.up || keys.down) {
      const p0 = here(), ok = stride(keys.up ? W.yaw : W.yaw + Math.PI, SPEED * dt), p1 = here(); moved = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1e-6;
      if (moved) { say(keys.up ? '↑ הולכים קדימה' : '↓ הולכים אחורה', 500); walked();
        if (W.walkHead !== undefined && !(keys.left || keys.right) && !drag) { const want = keys.up ? W.walkHead : wrap(W.walkHead + Math.PI), d = wrap(want - W.yaw), stepA = 95 * DEG * dt; W.yaw = wrap(W.yaw + Math.max(-stepA, Math.min(stepA, d))); } } else if (!ok && now - noWay > 900) { noWay = now; say('אין מעבר בכיוון הזה — הסתובבו לכיוון העיגולים', 1500); }
      dirty = true;
    } else if (glide) {
      const head = glideStep(SPEED * 1.15 * dt); moved = true; dirty = true;
      if (head !== null && glide && !glide.user && now - userTurn > 600) { const d = wrap(head - W.yaw), stepA = 110 * DEG * dt; W.yaw = wrap(W.yaw + Math.max(-stepA, Math.min(stepA, d))); W.pitch += (0 - W.pitch) * Math.min(1, dt * 1.5); }
    }
    if (moved) bob += dt * 1.8; if (moved !== W.moving) { W.moving = moved; dirty = true; }
    const canCmp = atNode() && Boolean(P(W.a).compare) && !moved; if (cmpBtn.hidden === canCmp) cmpBtn.hidden = !canCmp; if (!canCmp && W.compare) setCompare(false);
    if (dirty) { dirty = false; try { draw(); } catch (e) { W.errors.push(String(e)); } }
  }
  addEventListener('resize', () => { dirty = true; });

  /* ---------- start ---------- */
  fetch('walk.json?v=' + Date.now()).then((r) => r.json()).then(async (doc) => {
    W.nodes = doc.nodes.map((n) => ({ ...n, adj: [] })); W.DW = doc.depth.size[0]; W.DH = doc.depth.size[1];
    const id = new Map(W.nodes.map((n, i) => [n.id, i])); W.edges = doc.edges.map(([p, q]) => [id.get(p), id.get(q)]);
    doc.edges.forEach(([p, q, pts]) => addRoute(id.get(p), id.get(q), pts));
    for (const [i, j] of W.edges) { P(i).adj.push(j); P(j).adj.push(i); }
    const start = id.get(params.get('at')) ?? 0; W.a = W.b = start; W.dir = 0;
    W.yaw = params.has('yaw') ? Number(params.get('yaw')) * DEG : P(start).view !== undefined ? P(start).view * DEG : (P(start).adj.length ? bearing(start, P(start).adj[0]) : 0);
    layDots(); await ensure(start); near(start); where(); W.ready = true; dirty = true; loadEl.classList.add('is-off'); requestAnimationFrame(frame);
  }).catch((e) => { W.errors.push(String(e)); $('w-load-text').textContent = 'הטעינה נכשלה'; });
  /* test hooks */
  W.goNode = (nid, t) => { const i = W.nodes.findIndex((n) => n.id === nid), j = P(i).adj[0]; goTo({ i, j, t: t || 0 }); };
  W.pos = () => { const h = here(); return { x: h[0] * 100, y: h[1] * 100, a: P(W.a).id, b: P(W.b).id, s: W.s, gliding: Boolean(glide) }; };
  W.target = target; W.setCompare = setCompare;
  W.faceNext = (k) => { const i = W.a, j = P(i).adj[k || 0]; W.yaw = bearing(i, j); W.pitch = 0; dirty = true; return P(j).id; };
  W.route = (p, q) => { const i = W.nodes.findIndex((n) => n.id === p), j = W.nodes.findIndex((n) => n.id === q); return geo(i, j); };
  W.probe = () => { draw(); const px = new Uint8Array(4), v = []; for (let j = 1; j < 10; j++) for (let i = 1; i < 10; i++) { gl.readPixels(Math.floor(canvas.width * i / 10), Math.floor(canvas.height * j / 10), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); v.push((px[0] + px[1] + px[2]) / 3); } const m = v.reduce((p, q) => p + q, 0) / v.length; return { mean: m, sd: Math.sqrt(v.reduce((p, q) => p + (q - m) * (q - m), 0) / v.length) }; };
})();

// holdarc.js — the "living hold" v8 (habait-ba, 2026-11-03): THREE pre-rendered frame tracks, all from the same Kling look, so that
// gliding, turning and pulling back never switch to a different picture (Eliran: "כשעושים זום אאוט … ההדמיה של הסביבה משתנה … צריך שזה
// ימשיך מהדמייה, חלק וריאליסטי"; "רוצה סיבוב 360 עם העכבר").
//   arc  (data/holdarc)  — the idle glide: the drone drifts along a ±45° orbit around the facade (Kling v2v over clay)
//   pan  (data/holdpan)  — drag: the camera turns in place at the hold, a 360° loop (Kling v2v over clay); frame centre = the hold pose
//   pull (data/holdpull) — wheel / pinch out: the orbit video's last seconds in reverse = the drone backs away; index 0 = the hold pose
// Every track's centre/first frame is the orbit video's end pose, so the hand-offs between tracks happen at one identical picture.
// Pills are projected per frame from each track's camera.json (Blender camera: looks along local -Z, up +Y; matrix_world = camera → world).
// A missing track degrades gracefully: no pan → the drag scrubs the arc; no pull → the wheel is a digital zoom into the frame.
//
// createArcHold({ canvas, base, onReady }) → { ready, index, loaded, N, centre, mode, frame(now), project(worldVec3), goCentre(ms, cb), resize(), active, glide, interacted }
export async function createArcHold({ canvas, base = './data/holdarc', panBase = './data/holdpan', pullBase = './data/holdpull', onReady = () => {} }) {
  const loading = new Set();
  const ctx = canvas.getContext('2d', { alpha: false });
  let vw = 0, vh = 0, dpr = 1;
  let drawn = null, drawnZoom = 1, drawnOver = 0;
  const bigScreen = innerWidth * Math.min(devicePixelRatio || 1, 2) > 1500;

  async function openTrack(name, b, required) {
    try {
      const man = await (await fetch(`${b}/manifest.json`)).json();
      if (man.disabled || !man.frames) throw new Error(`${name} disabled`);
      const cam = await (await fetch(`${b}/${man.camera || 'camera.json'}`)).json();
      const N = Math.min(cam.n_frames, man.frames || cam.n_frames), centre = Math.min(N - 1, (cam.centre_frame || Math.ceil(N / 2)) - 1);
      const W = man.width || cam.frames[0].res[0], H = man.height || cam.frames[0].res[1];
      const lens = cam.frames[0].lens_mm, sensor = cam.frames[0].sensor_mm;
      const tiers = [];
      if (man.lo && man.lo.dir) tiers.push({ dir: man.lo.dir, pattern: man.lo.pattern || man.pattern || 'frame_%04d.jpg', imgs: new Array(N).fill(null) });
      if (man.hi && man.hi.dir && bigScreen) tiers.push({ dir: man.hi.dir, pattern: man.hi.pattern || man.pattern || 'frame_%04d.jpg', imgs: new Array(N).fill(null) });
      else tiers.push({ dir: man.dir, pattern: man.pattern || 'frame_%04d.jpg', imgs: new Array(N).fill(null) });
      const t = { name, base: b, N, centre, W, H, pillsNear: Number.isFinite(man.pills_near) ? man.pills_near : null, fx: lens / (sensor / 2), inv: cam.frames.map((f) => invert4(f.matrix_world)), tiers, hi: tiers[tiers.length - 1], loop: Boolean(cam.loop || man.loop), loaded: 0, scale: 1, ox: 0, oy: 0 };
      fit(t); return t;                                                                                // cover-fit now: a track opened after resize() must not draw letterboxed
    } catch (e) { if (required) throw e; console.warn('hold track unavailable:', name, e.message); return null; }
  }
  const tracks = { arc: await openTrack('arc', base, true), pan: null, pull: null };
  const T = tracks.arc;
  const st = { ready: false, mode: 'arc', index: T.centre, vel: 0, lastInput: performance.now(), dragging: false, active: true, interacted: false,
    glideDir: +1, glideV: 0, activeSince: 0, glide: false, zoom: 1, over: 0, pending: null, goto: null };
  const cur = () => tracks[st.mode];
  const src = (t, tier, i) => `${t.base}/${tier.dir}/${tier.pattern.replace('%04d', String(i + 1).padStart(4, '0'))}`;
  function load(t, tier, i) {
    return new Promise((res) => {
      const key = t.name + tier.dir + i; if (tier.imgs[i] || loading.has(key)) return res(tier.imgs[i]);
      loading.add(key); const im = new Image(); im.decoding = 'async';
      im.onload = () => { tier.imgs[i] = im; loading.delete(key); if (tier === t.hi) t.loaded++; drawn = null; res(im); }; im.onerror = () => { loading.delete(key); res(null); }; im.src = src(t, tier, i);
    });
  }
  function order(t) {                                                       // nearest-to-centre first: every 6th, every 2nd, all
    const o = []; for (let s = 6; s >= 1; s = s === 6 ? 2 : s === 2 ? 1 : 0) { for (let d = 0; d <= Math.max(t.centre, t.N - 1 - t.centre); d += s) { for (const i of [t.centre - d, t.centre + d]) if (i >= 0 && i < t.N && !o.includes(i)) o.push(i); } if (s === 1) break; }
    return o;
  }
  async function loadTrack(t, step) { const o = order(t); for (const tier of t.tiers) for (let k = 0; k < o.length; k += 4) { await Promise.all(o.slice(k, k + 4).map((i) => load(t, tier, i))); if (step) await step(); } }
  // the arc's centre frame first (the cut from the video happens on it), then the arc, then the pan and the pull-back in parallel
  await load(T, T.tiers[0], T.centre); if (!T.tiers[0].imgs[T.centre]) throw new Error('arc centre frame missing'); st.ready = true; st.activeSince = performance.now(); resize(); draw(); onReady();
  (async () => {
    await loadTrack(T);
    tracks.pan = await openTrack('pan', panBase, false); tracks.pull = await openTrack('pull', pullBase, false);
    await Promise.all([tracks.pan && loadTrack(tracks.pan), tracks.pull && loadTrack(tracks.pull)]);
  })();
  function nearestLoaded(t, i) {
    if (t.hi.imgs[i]) return t.hi.imgs[i];
    for (const tier of t.tiers) if (tier.imgs[i]) return tier.imgs[i];
    for (let d = 1; d < t.N; d++) for (const tier of t.tiers) { const a = t.loop ? (i - d + t.N) % t.N : i - d, b = t.loop ? (i + d) % t.N : i + d; if (tier.imgs[a]) return tier.imgs[a]; if (tier.imgs[b]) return tier.imgs[b]; }
    return null;
  }
  function fit(t) { t.scale = Math.max(innerWidth / t.W, innerHeight / t.H); t.ox = (innerWidth - t.W * t.scale) / 2; t.oy = (innerHeight - t.H * t.scale) / 2; }   // object-fit: cover, centred (same as the <video>)
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); vw = innerWidth; vh = innerHeight; canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr); canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    for (const t of Object.values(tracks)) if (t) fit(t);
    drawn = null;
  }
  function wrap(t, i) { return t.loop ? ((i % t.N) + t.N) % t.N : Math.max(0, Math.min(t.N - 1, i)); }   // hoisted: draw() runs before this line during init
  function draw() {
    const t = cur(); const i = Math.round(wrap(t, st.index)) % t.N; const im = nearestLoaded(t, i); if (!im) return;
    if (im === drawn && st.zoom === drawnZoom && st.over === drawnOver) return; drawn = im; drawnZoom = st.zoom; drawnOver = st.over;
    const S = t.scale * st.zoom, OX = (vw - t.W * S) / 2 + st.over, OY = (vh - t.H * S) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingQuality = 'high'; if (st.over || st.zoom !== 1) ctx.fillRect(0, 0, vw, vh); ctx.drawImage(im, OX, OY, t.W * S, t.H * S);
  }
  // ---- the hand-offs: every switch passes through the hold pose (each track's centre), so the picture never jumps ----
  function ease(to, ms, cb) { st.goto = { from: st.index, to, t0: performance.now(), ms, cb }; st.vel = 0; st.glideV = 0; }
  function toHoldPose(ms, cb) {                                             // ease the current track to its hold frame, then cb
    const t = cur(); let target = t.centre;
    if (t.loop) { const d = ((t.centre - st.index) % t.N + t.N * 1.5) % t.N - t.N / 2; target = st.index + d; }   // the short way round
    if (Math.abs(target - st.index) < 0.6) { st.index = target; cb && cb(); return; }
    ease(target, ms, cb);
  }
  function switchTo(mode) { if (!tracks[mode] || st.mode === mode) return; st.mode = mode; st.index = mode === 'pull' ? 0 : tracks[mode].centre; st.vel = 0; st.glideV = 0; st.glide = false; st.over = 0; drawn = null; }
  const PX_PER_DEG = () => Math.max(4, vw / 180);                             // a full window width of drag ≈ 180° of turn
  const PAN_DEG = () => 360 / (tracks.pan ? tracks.pan.N : 360);
  let lastX = 0, lastT = 0;
  function dragStart(e) {
    st.interacted = true; st.lastInput = performance.now(); lastX = e.clientX; lastT = performance.now(); st.vel = 0; st.glideV = 0;
    if (st.mode === 'pull') { const next = tracks.pan ? 'pan' : 'arc'; st.pending = next; toHoldPose(260, () => { if (st.pending === next) { switchTo(next); st.pending = null; } }); }
    else if (st.mode === 'arc' && tracks.pan) { st.pending = 'pan'; toHoldPose(220, () => { if (st.pending === 'pan') { switchTo('pan'); st.pending = null; } }); }
    st.dragging = true;
  }
  function dragMove(e) {
    if (!st.dragging) return; const now = performance.now(); const dx = e.clientX - lastX; lastX = e.clientX;
    if (st.pending) { st.lastInput = now; return; }                           // still easing to the hold pose: the first pixels are swallowed
    const t = cur();
    if (st.mode === 'pan') { const di = dx / PX_PER_DEG() / PAN_DEG(); st.index = wrap(t, st.index + di); st.vel = Math.max(-2.5, Math.min(2.5, di / Math.max(1, now - lastT) * 16)); if (dx) st.glideDir = dx > 0 ? +1 : -1; }
    else if (st.mode === 'arc') { const di = dx / Math.max(2.2, vw / t.N * 1.25); const raw = st.index + di; st.index = wrap(t, raw); if (!t.loop && (raw < 0 || raw > t.N - 1)) st.over = Math.max(-48, Math.min(48, st.over + dx * 0.35)); else st.over *= 0.5; st.vel = Math.max(-1.6, Math.min(1.6, di / Math.max(1, now - lastT) * 16)); if (dx) st.glideDir = dx > 0 ? +1 : -1; }
    lastT = now; st.lastInput = now;
  }
  function dragEnd() { st.dragging = false; st.lastInput = performance.now(); }
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; dragStart(e); });
  canvas.addEventListener('pointermove', dragMove);
  const up = () => { canvas.style.cursor = 'grab'; dragEnd(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.style.cursor = 'grab';
  // wheel / pinch: out = the pull-back track (the drone backs away), in = back to the hold, then a digital zoom into the frame
  function zoomBy(dy) {                                                      // dy > 0 = out
    st.interacted = true; st.lastInput = performance.now();
    if (dy > 0 && tracks.pull) {
      if (st.zoom > 1) { st.zoom = Math.max(1, st.zoom * Math.exp(-dy * 0.0012)); drawn = null; return; }
      if (st.mode !== 'pull') { if (st.pending) { st.queued = (st.queued || 0) + dy; return; } st.pending = 'pull'; st.queued = dy; toHoldPose(240, () => { if (st.pending === 'pull') { switchTo('pull'); st.pending = null; st.index = wrap(tracks.pull, (st.queued || 0) * 0.05); st.queued = 0; } }); return; }   // the first notch is not lost: it applies once the switch is done
      st.index = wrap(tracks.pull, st.index + dy * 0.05); return;
    }
    if (dy < 0 && st.mode === 'pull' && st.index > 0) { st.index = Math.max(0, st.index + dy * 0.05); if (st.index < 0.5) switchTo(tracks.pan ? 'pan' : 'arc'); return; }
    if (dy < 0 && st.mode === 'pull') { switchTo(tracks.pan ? 'pan' : 'arc'); }
    st.zoom = Math.max(1, Math.min(1.7, st.zoom * Math.exp(-dy * 0.0012))); drawn = null;
  }
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(e.deltaY * (e.ctrlKey ? 8 : 1)); }, { passive: false });
  let pinch0 = 0;
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 2) pinch0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { if (e.touches.length === 2 && pinch0) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); zoomBy((pinch0 - d) * 6); pinch0 = d; } }, { passive: true });
  canvas.addEventListener('touchend', () => { pinch0 = 0; }, { passive: true });
  // the idle motion: on the arc the drone glides along the whole arc (v6); in the pan it keeps turning slowly the way it was last turned
  const GLIDE_FPS = 4.5, GLIDE_ACCEL = 2.4, PAN_FPS = 1.2;
  function frame(now) {
    if (!st.active) return;
    const t = cur();
    if (st.goto) { const k = Math.min(1, (now - st.goto.t0) / st.goto.ms); const e = k * k * (3 - 2 * k); st.index = st.goto.from + (st.goto.to - st.goto.from) * e; if (k >= 1) { const cb = st.goto.cb; st.goto = null; st.index = wrap(t, st.index); cb && cb(); } }
    else if (!st.dragging) {
      const dt = Math.min(0.05, (now - (st.prevNow || now)) / 1000);
      if (Math.abs(st.vel) > 0.02) { st.index = wrap(t, st.index + st.vel); st.vel *= 0.92; }
      else if (st.mode === 'arc') {
        const sinceInput = now - st.lastInput, sinceStart = now - st.activeSince;
        const go = st.glide && (st.interacted ? sinceInput > 2500 : sinceStart > 800);
        const want = go ? GLIDE_FPS * st.glideDir : 0, margin = 12;
        if (go && !t.loop && ((st.glideDir > 0 && st.index > t.N - 1 - margin) || (st.glideDir < 0 && st.index < margin))) st.glideDir = -st.glideDir;   // a ring just keeps going round
        st.glideV += Math.max(-GLIDE_ACCEL * dt, Math.min(GLIDE_ACCEL * dt, want - st.glideV)); st.index = wrap(t, st.index + st.glideV * dt);
      } else if (st.mode === 'pan' && now - st.lastInput > 4000) {
        const want = PAN_FPS * st.glideDir; st.glideV += Math.max(-GLIDE_ACCEL * dt, Math.min(GLIDE_ACCEL * dt, want - st.glideV)); st.index = wrap(t, st.index + st.glideV * dt);
      }
    }
    if (!st.dragging && st.over) { st.over *= 0.82; if (Math.abs(st.over) < 0.5) st.over = 0; drawn = null; }
    if (!st.dragging && st.zoom !== 1 && now - st.lastInput > 6000) { st.zoom += (1 - st.zoom) * 0.04; if (Math.abs(st.zoom - 1) < 0.003) st.zoom = 1; drawn = null; }
    st.prevNow = now;
    draw();
  }
  // before the descent clip: back to the hold pose on whatever track (the clip starts from that pose)
  function goCentre(ms = 700, cb) { st.pending = null; st.zoom = 1; st.over = 0; st.glide = false; drawn = null; toHoldPose(ms, cb); }
  function project(p) {                                                      // world point → screen px for the frame shown now (cover-fit applied)
    const t = cur(); const i = Math.round(wrap(t, st.index)) % t.N; const M = t.inv[i];
    if (t.pillsNear !== null) { const d = Math.abs(i - t.centre); if (Math.min(d, t.N - d) > t.pillsNear) return { x: 0, y: 0, visible: false }; }   // a preview track: pills only at the hold pose
    const x = M[0][0] * p.x + M[0][1] * p.y + M[0][2] * p.z + M[0][3], y = M[1][0] * p.x + M[1][1] * p.y + M[1][2] * p.z + M[1][3], z = M[2][0] * p.x + M[2][1] * p.y + M[2][2] * p.z + M[2][3];
    if (z >= -1e-6) return { x: 0, y: 0, visible: false };
    const nx = x / -z * t.fx, ny = y / -z * t.fx * (t.W / t.H);
    const S = t.scale * st.zoom, OX = (vw - t.W * S) / 2 + st.over, OY = (vh - t.H * S) / 2; const sx = OX + (nx + 1) / 2 * t.W * S, sy = OY + (1 - ny) / 2 * t.H * S;
    return { x: sx, y: sy, visible: sx > -20 && sx < vw + 20 && sy > -20 && sy < vh + 20 };
  }
  addEventListener('resize', () => { resize(); draw(); });
  return { get ready() { return st.ready; }, get index() { return st.index; }, get loaded() { return T.loaded; }, get interacted() { return st.interacted; }, get mode() { return st.mode; },
    get tracks() { return { pan: Boolean(tracks.pan), pull: Boolean(tracks.pull), panLoaded: tracks.pan ? tracks.pan.loaded : 0, pullLoaded: tracks.pull ? tracks.pull.loaded : 0 }; },
    N: T.N, centre: T.centre, frame, project, goCentre, resize, get pass() { return false; },
    set active(v) { st.active = v; canvas.style.display = v ? 'block' : 'none'; if (v) { st.activeSince = performance.now(); st.glideV = 0; } }, get active() { return st.active; },
    set glide(v) { st.glide = v; if (v) { st.activeSince = performance.now(); st.glideV = 0; } }, get glide() { return st.glide; } };
}
function invert4(m) {                                                     // 4x4 rigid (rotation + translation): inverse = [R^T | -R^T t]
  const R = [[m[0][0], m[0][1], m[0][2]], [m[1][0], m[1][1], m[1][2]], [m[2][0], m[2][1], m[2][2]]]; const t = [m[0][3], m[1][3], m[2][3]];
  const Rt = [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];
  const tt = Rt.map((row) => -(row[0] * t[0] + row[1] * t[1] + row[2] * t[2]));
  return [[...Rt[0], tt[0]], [...Rt[1], tt[1]], [...Rt[2], tt[2]], [0, 0, 0, 1]];
}

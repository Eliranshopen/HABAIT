// js/cine.js — card 36 (2026-11-03): the CINEMATIC flight of flow.html (the default when fixtures/<id>/flow.cine.json exists).
// The look of habait-flow inside the platform: the flight is a FLAT photoreal clip (cover-fit, no drag), it lands on the hold pose,
// the hold is a pre-rendered photoreal ARC of frames the buyer drags around the tower (inertia, a slow glide at rest, a rubber band
// at the ends, a digital zoom) with one pill per apartment projected for every frame from units.json boxes through that frame's
// camera; the unit card is js/picker.js (lead form, caption); "continue" eases the arc back to its rest frame, the descent clip
// crossfades in, the enter clip follows frame to frame, and the last frame crossfades into the tour's own panorama at that pose and
// field of view (flow.js's 360 viewer), turns to the windows while the field of view opens to the tour's, and the tour iframe is
// revealed on that same view (card 34's hand-off: room=living, yaw, ui=min, return to this hold).
// No loading screens: every next step is buffered behind the current one; a step that is not ready keeps the last frame up.
// Data: fixtures/<id>/flow.cine.json (tools/build_segments.mjs, from card 35's video manifest) + _local/segments/<id>-cine/.
// Not a module of habait-98's :8899 (holdarc.js there is the reference); nothing here is imported by another viewer.
//
// createCine({ ctx, flow, els, picker, viewer, host }) -> { start(seg?), startSegment(seg), showUnit(u), captionState(), setLang(), state }
//   host (flow.js): { t, pick, getLang, capture, onSegment(seg), updateCaption(), prepareTour(unit, handoff, yaw) -> tour,
//                     revealTour(tour), viewerRun(on), tourFov(), wantYaw(tour, yaw) }

const STR = {
  he: { drag: '⟷ גררו לסיבוב סביב המגדל', hint: 'הקישו על דירה · גררו לסיבוב', sound: 'צליל' },
  en: { drag: '⟷ Drag to circle the tower', hint: 'Tap an apartment · drag to circle', sound: 'Sound' },
};
const GLIDE_FPS = 4.5, GLIDE_ACCEL = 2.4, GLIDE_MARGIN = 12;       // the drone's idle glide along the arc (habait-flow v6 values)
const VEL_CAP = 1.6, OVER_MAX = 48, ZOOM_MAX = 1.7;
const CAPTION_OPENING_S = 3;

export async function createCine({ ctx, flow, els, picker, viewer, host }) {
  const segById = new Map(flow.segments.map((s) => [s.id, s]));
  const asset = (p) => ctx.asset(p);
  const lang = () => (host.getLang() === 'en' ? 'en' : 'he');
  const S = (k) => STR[lang()][k];
  const log = [];
  const L = (ev, o = {}) => { log.push({ ev, ...o, at: Math.round(performance.now()) }); };
  const st = { seg: null, video: null, hold: null, holdActive: false, tourShown: false, bridging: false, focus: flow.focus_x ?? 0.5, w: 0, h: 0, dpr: 1, started: false, unit: null, tour: null, title: false };

  // ---------------- DOM: one layer over the 360 viewer, under the pills ----------------
  const layer = document.createElement('div');
  layer.className = 'cine-layer'; layer.id = 'cineLayer';
  els.viewer.after(layer);
  const holdCanvas = document.createElement('canvas'); holdCanvas.className = 'cine-hold'; holdCanvas.id = 'cineHold';
  const birdsCanvas = document.createElement('canvas'); birdsCanvas.className = 'cine-birds';
  const title = document.createElement('div'); title.className = 'cine-title'; title.setAttribute('aria-hidden', 'true');
  title.innerHTML = '<div class="t1"></div><div class="t2"></div>';
  layer.append(holdCanvas, birdsCanvas, title);
  const hint = document.createElement('div'); hint.className = 'cine-drag-hint'; hint.setAttribute('aria-hidden', 'true');
  document.body.appendChild(hint);
  const legend = document.createElement('div'); legend.className = 'picker-legend cine-legend'; legend.hidden = true;
  els.hint.after(legend);
  function renderLegend() { legend.innerHTML = ['for-sale', 'reserved', 'sold'].map((k) => `<span class="lg status-${k}"><span class="dot"></span>${host.t('status.' + k)}</span>`).join(''); }
  renderLegend();
  const hctx = holdCanvas.getContext('2d', { alpha: false });
  document.body.classList.add('cine');

  function measure() {
    const r = els.stage.getBoundingClientRect();
    st.w = Math.max(1, Math.round(r.width)); st.h = Math.max(1, Math.round(r.height)); st.dpr = Math.min(devicePixelRatio || 1, 2);
    holdCanvas.width = Math.round(st.w * st.dpr); holdCanvas.height = Math.round(st.h * st.dpr);
    birdsCanvas.width = holdCanvas.width; birdsCanvas.height = holdCanvas.height;
    for (const v of videos.values()) placeVideo(v);
    if (st.hold) st.hold.drawn = null;
  }
  // cover-fit, cropped around focus_x (the same rect for every clip and the hold, so a cut never shifts the picture)
  function rectFor(W, H, zoom = 1, over = 0) {
    const s0 = Math.max(st.w / W, st.h / H), dw0 = W * s0;
    const ox0 = Math.min(0, Math.max(st.w - dw0, st.w / 2 - st.focus * dw0));
    const xc = (st.w / 2 - ox0) / dw0;                                    // the frame x at the screen centre (a zoom keeps it there)
    const s = s0 * zoom, dw = W * s, dh = H * s;
    const ox = Math.min(0, Math.max(st.w - dw, st.w / 2 - xc * dw));
    return { s, dw, dh, ox: ox + over, oy: (st.h - dh) / 2 };
  }

  // ---------------- flat clips ----------------
  const videos = new Map();
  function videoOf(seg) {
    let v = videos.get(seg.id);
    if (v) return v;
    v = document.createElement('video');
    v.className = 'cine-video'; v.dataset.seg = seg.id;
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    if (seg.poster) v.poster = asset(seg.poster);
    v.src = asset(seg.src);
    v._W = seg.size?.[0] || 1280; v._H = seg.size?.[1] || 720;
    v.addEventListener('error', () => console.error('[cine] video error', seg.id, v.error?.message || v.error?.code));
    layer.insertBefore(v, birdsCanvas);
    placeVideo(v);
    videos.set(seg.id, v);
    return v;
  }
  function placeVideo(v) { const r = rectFor(v._W, v._H); Object.assign(v.style, { width: `${r.dw}px`, height: `${r.dh}px`, left: `${r.ox}px`, top: `${r.oy}px` }); }
  function warm(seg) {
    if (!seg || seg.kind !== 'flat-video') return;
    const v = videoOf(seg);
    if (v.dataset.warm) return;
    v.dataset.warm = '1'; v.load();
    // iOS buffers a media element only once it has played: muted inline play() + pause() needs no gesture
    const p = v.play();
    if (p && p.then) p.then(() => { if (st.seg?.id !== seg.id) { v.pause(); try { v.currentTime = 0; } catch { /* ignore */ } } }).catch(() => {});
  }
  function presented(v) {                                     // resolves once a decoded frame of v is on screen
    return new Promise((ok) => {
      let done = false; const fin = () => { if (!done) { done = true; v.removeEventListener('timeupdate', tu); ok(); } };
      const tu = () => { if (v.currentTime > 0) fin(); };
      if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(() => fin());
      v.addEventListener('timeupdate', tu);
    });
  }
  function canPlay(v, ms) { return new Promise((ok) => { if (v.readyState >= 3) return ok(true); const t = setTimeout(() => ok(false), ms); v.addEventListener('canplay', () => { clearTimeout(t); ok(true); }, { once: true }); }); }
  function play(v) {
    const p = v.play();
    if (p && p.catch) p.catch((e) => { if (e && e.name === 'NotAllowedError') tapChip(v); });
  }
  let chip = null;
  function tapChip(v) {
    if (chip) return;
    chip = document.createElement('button'); chip.type = 'button'; chip.className = 'tap-chip';
    chip.textContent = lang() === 'en' ? 'Tap to continue the flight' : 'הקישו כדי להמשיך בטיסה';
    document.body.appendChild(chip);
    const go = () => { window.removeEventListener('pointerdown', go, true); chip.remove(); chip = null; v.play().catch(() => {}); };
    window.addEventListener('pointerdown', go, true);
  }
  const fadeTo = (el, o, s) => { el.style.transition = s ? `opacity ${s}s linear` : 'none'; el.style.opacity = String(o); };

  // ---------------- the hold: a track of JPEG frames + one camera per frame ----------------
  async function openHold(seg) {
    if (st.hold && st.hold.seg === seg) return st.hold;
    const cam = await (await fetch(asset(seg.camera), { cache: 'no-cache' })).json();
    const N = Math.min(seg.frames, cam.frames.length);
    const W = seg.size?.[0] || cam.res?.[0] || 1280, H = seg.size?.[1] || cam.res?.[1] || 720;
    const T = { seg, N, W, H, rest: Math.min(N - 1, (seg.rest_frame || Math.ceil(N / 2)) - 1), loop: !!seg.loop, fx: 1 / Math.tan((cam.hfov_deg * Math.PI) / 360),
      inv: cam.frames.slice(0, N).map(invert34), pillsNear: Number.isFinite(seg.pills_near) ? seg.pills_near : null,
      tiers: [], hiLoaded: 0, loLoaded: 0, drawn: null, ready: false };
    const base = asset(seg.dir).replace(/\/?$/, '/');
    if (seg.lo) T.tiers.push({ name: 'lo', dir: base + seg.lo + '/', imgs: new Array(N).fill(null) });
    T.tiers.push({ name: 'hi', dir: base + seg.hi + '/', imgs: new Array(N).fill(null) });
    T.hi = T.tiers[T.tiers.length - 1];
    st.hold = T;
    holdState.index = T.rest; holdState.vel = 0; holdState.glideV = 0; holdState.over = 0; holdState.zoom = 1;
    return T;
  }
  const frameName = (i) => `frame_${String(i + 1).padStart(4, '0')}.jpg`;
  const loading = new Set();
  function loadFrame(T, tier, i) {
    return new Promise((ok) => {
      const key = tier.name + i; if (tier.imgs[i] || loading.has(key)) return ok(tier.imgs[i]);
      loading.add(key); const im = new Image(); im.decoding = 'async';
      im.onload = () => { tier.imgs[i] = im; loading.delete(key); if (tier === T.hi) T.hiLoaded++; else T.loLoaded++; T.drawn = null; ok(im); };
      im.onerror = () => { loading.delete(key); ok(null); };
      im.src = tier.dir + frameName(i);
    });
  }
  function nearOrder(T) {                                     // the rest frame first, then every 6th, every 2nd, all, outwards
    const o = [], seen = new Set();
    for (const s of [6, 2, 1]) for (let d = 0; d < T.N; d += s) for (const i of [T.rest - d, T.rest + d]) { const j = T.loop ? ((i % T.N) + T.N) % T.N : i; if (j >= 0 && j < T.N && !seen.has(j)) { seen.add(j); o.push(j); } }
    return o;
  }
  function loadHold(T) { if (!T.loadP) T.loadP = loadHoldOnce(T); return T.loadP; }
  async function loadHoldOnce(T) {
    // the rest frame first (the cut from the orbit lands on it), lo tier then hi; then every frame of each tier, nearest first
    for (const tier of T.tiers) await loadFrame(T, tier, T.rest);
    if (!T.tiers.some((t) => t.imgs[T.rest])) throw new Error('hold rest frame missing');
    T.ready = true; L('hold-ready', { rest: T.rest + 1, tiers: T.tiers.map((t) => t.name) });
    const o = nearOrder(T);
    for (const tier of T.tiers) for (let k = 0; k < o.length; k += 6) await Promise.all(o.slice(k, k + 6).map((i) => loadFrame(T, tier, i)));
    L('hold-loaded', { hi: T.hiLoaded, lo: T.loLoaded });
  }
  function imgAt(T, i) {
    if (T.hi.imgs[i]) return T.hi.imgs[i];
    for (const t of T.tiers) if (t.imgs[i]) return t.imgs[i];
    for (let d = 1; d < T.N; d++) for (const t of T.tiers) {                  // the nearest loaded frame (never a blank)
      const a = T.loop ? (i - d + T.N) % T.N : i - d, b = T.loop ? (i + d) % T.N : i + d;
      if (a >= 0 && t.imgs[a]) return t.imgs[a]; if (b < T.N && t.imgs[b]) return t.imgs[b];
    }
    return null;
  }
  const wrapI = (T, i) => (T.loop ? ((i % T.N) + T.N) % T.N : Math.max(0, Math.min(T.N - 1, i)));
  const shownIndex = () => { const T = st.hold; return T ? Math.round(wrapI(T, holdState.index)) % T.N : 0; };
  function drawHold() {
    const T = st.hold; if (!T) return;
    const i = shownIndex(), im = imgAt(T, i); if (!im) return;
    const key = `${i}|${im.src}|${holdState.zoom}|${holdState.over}|${st.w}x${st.h}`;
    if (T.drawn === key) return; T.drawn = key; T.shownI = i;
    const r = rectFor(T.W, T.H, holdState.zoom, holdState.over);
    hctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); hctx.imageSmoothingQuality = 'high';
    if (holdState.over || holdState.zoom !== 1) { hctx.fillStyle = '#000'; hctx.fillRect(0, 0, st.w, st.h); }
    hctx.drawImage(im, r.ox, r.oy, r.dw, r.dh);
  }
  // world point -> stage px through the camera of the frame on screen (Blender camera: -Z forward, +Y up)
  function projectWorld(p, i = shownIndex()) {
    const T = st.hold; const M = T.inv[i];
    const x = M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3], y = M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7], z = M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11];
    if (z >= -1e-6) return { x: 0, y: 0, visible: false };
    const nx = (x / -z) * T.fx, ny = (y / -z) * T.fx * (T.W / T.H);
    const r = rectFor(T.W, T.H, holdState.zoom, holdState.over);
    const sx = r.ox + ((nx + 1) / 2) * r.dw, sy = r.oy + ((1 - ny) / 2) * r.dh;
    return { x: sx, y: sy, visible: sx > -20 && sx < st.w + 20 && sy > -20 && sy < st.h + 20 };
  }
  // pills: one per unit with a box, hidden when a NEARER unit's pill sits in the same column (837/847/857 behind 846, 14 px)
  let pillPos = new Map();
  function projectUnits() {
    const T = st.hold; pillPos = new Map();
    if (!T || !st.holdActive || st.bridging) return;
    const i = shownIndex();
    if (T.pillsNear !== null) { const d = Math.abs(i - T.rest); if (Math.min(d, T.N - d) > T.pillsNear) return; }   // a preview track: pills only at rest
    const M = T.inv[i], camPos = [-(M[0] * M[3] + M[4] * M[7] + M[8] * M[11]), -(M[1] * M[3] + M[5] * M[7] + M[9] * M[11]), -(M[2] * M[3] + M[6] * M[7] + M[10] * M[11])];
    const list = [];
    for (const [id, u] of Object.entries(flow.units || {})) {
      const q = projectWorld(u.centre, i);
      list.push({ id, x: q.x, y: q.y, vis: q.visible, d: Math.hypot(u.centre[0] - camPos[0], u.centre[1] - camPos[1], u.centre[2] - camPos[2]) });
    }
    for (const a of list) {
      let hidden = false;
      for (const b of list) if (b !== a && b.d < a.d - 4 && Math.abs(a.x - b.x) < 14 && Math.abs(a.y - b.y) < 60) { hidden = true; break; }
      pillPos.set(a.id, { x: Math.round(a.x), y: Math.round(a.y), visible: a.vis && !hidden });
    }
  }
  const holdState = { index: 0, vel: 0, glideV: 0, glideDir: +1, over: 0, zoom: 1, dragging: false, interacted: false, lastInput: 0, activeSince: 0, goto: null, prevNow: 0 };
  function easeIndex(to, ms, cb) { holdState.goto = { from: holdState.index, to, t0: performance.now(), ms, cb }; holdState.vel = 0; holdState.glideV = 0; }
  function goRest(ms, cb) {
    const T = st.hold; let to = T.rest;
    if (T.loop) { const d = ((((T.rest - holdState.index) % T.N) + T.N * 1.5) % T.N) - T.N / 2; to = holdState.index + d; }
    holdState.zoom = 1; holdState.over = 0; T.drawn = null;
    if (Math.abs(to - holdState.index) < 0.5) { holdState.index = to; cb && cb(); return; }
    easeIndex(to, Math.min(ms, 120 + Math.abs(to - holdState.index) * 9), cb);
  }
  // drag = scrub the arc (right = the camera moves right), inertia, rubber band at the ends; wheel / pinch = digital zoom
  let lastX = 0, lastT = 0;
  const pointers = new Map(); let pinch0 = 0;
  holdCanvas.addEventListener('pointerdown', (e) => {
    if (!st.holdActive) return;
    pointers.set(e.pointerId, e.clientX + ',' + e.clientY);
    try { holdCanvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    holdState.interacted = true; holdState.dragging = pointers.size === 1; holdState.lastInput = performance.now(); holdState.vel = 0; holdState.glideV = 0; holdState.goto = null;
    lastX = e.clientX; lastT = performance.now(); holdCanvas.classList.add('dragging'); hideHint();
    if (pointers.size === 1) L('drag-start', { index: Math.round(holdState.index * 10) / 10 });
  });
  holdCanvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e.clientX + ',' + e.clientY);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()].map((s) => s.split(',').map(Number)); const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch0) zoomBy((pinch0 - d) * 6); pinch0 = d; return;
    }
    if (!holdState.dragging) return;
    const T = st.hold, now = performance.now(), dx = e.clientX - lastX; lastX = e.clientX;
    const di = dx / Math.max(2.2, (st.w / T.N) * 1.25), raw = holdState.index + di;
    holdState.index = wrapI(T, raw);
    if (!T.loop && (raw < 0 || raw > T.N - 1)) holdState.over = Math.max(-OVER_MAX, Math.min(OVER_MAX, holdState.over + dx * 0.35)); else holdState.over *= 0.5;
    holdState.vel = Math.max(-VEL_CAP, Math.min(VEL_CAP, (di / Math.max(1, now - lastT)) * 16)); if (dx) holdState.glideDir = dx > 0 ? +1 : -1;
    lastT = now; holdState.lastInput = now; T.drawn = null;
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; if (!pointers.size) { holdState.dragging = false; holdState.lastInput = performance.now(); holdCanvas.classList.remove('dragging'); L('drag-end', { index: Math.round(holdState.index * 10) / 10 }); } };
  holdCanvas.addEventListener('pointerup', up); holdCanvas.addEventListener('pointercancel', up);
  function zoomBy(dy) { if (!st.holdActive) return; holdState.interacted = true; holdState.lastInput = performance.now(); holdState.zoom = Math.max(1, Math.min(ZOOM_MAX, holdState.zoom * Math.exp(-dy * 0.0012))); if (st.hold) st.hold.drawn = null; }
  holdCanvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(e.deltaY * (e.ctrlKey ? 8 : 1)); }, { passive: false });
  function stepHold(now) {
    const T = st.hold; if (!T) return;
    const dt = Math.min(0.05, (now - (holdState.prevNow || now)) / 1000); holdState.prevNow = now;
    if (holdState.goto) {
      const g = holdState.goto, k = Math.min(1, (now - g.t0) / g.ms), e = k * k * (3 - 2 * k);
      holdState.index = g.from + (g.to - g.from) * e;
      if (k >= 1) { holdState.goto = null; holdState.index = wrapI(T, holdState.index); g.cb && g.cb(); }
    } else if (!holdState.dragging) {
      const paused = picker.isCardOpen() || st.seg?.role !== 'hold';
      if (Math.abs(holdState.vel) > 0.02) { holdState.index = wrapI(T, holdState.index + holdState.vel); holdState.vel *= 0.92; }
      else if (!paused && st.holdActive) {
        const go = holdState.interacted ? now - holdState.lastInput > 2500 : now - holdState.activeSince > 800;
        const want = go ? GLIDE_FPS * holdState.glideDir : 0;
        if (go && !T.loop && ((holdState.glideDir > 0 && holdState.index > T.N - 1 - GLIDE_MARGIN) || (holdState.glideDir < 0 && holdState.index < GLIDE_MARGIN))) holdState.glideDir = -holdState.glideDir;
        holdState.glideV += Math.max(-GLIDE_ACCEL * dt, Math.min(GLIDE_ACCEL * dt, want - holdState.glideV));
        holdState.index = wrapI(T, holdState.index + holdState.glideV * dt);
      } else holdState.glideV = 0;
      if (holdState.over) { holdState.over *= 0.82; if (Math.abs(holdState.over) < 0.5) holdState.over = 0; T.drawn = null; }
      if (holdState.zoom !== 1 && now - holdState.lastInput > 6000) { holdState.zoom += (1 - holdState.zoom) * 0.04; if (Math.abs(holdState.zoom - 1) < 0.003) holdState.zoom = 1; T.drawn = null; }
    }
    drawHold();
  }

  // ---------------- birds (Eliran 2.11: "לראות גם ציפורים עפות"): a few flapping silhouettes over the sky, orbit + hold only ----------------
  const bctx = birdsCanvas.getContext('2d');
  const birds = { on: false, flocks: [], next: performance.now() + 1500 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  function stepBirds(now) {
    bctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); bctx.clearRect(0, 0, st.w, st.h);
    if (!birds.on || st.unit) return;
    const k = Math.max(st.w, st.h * 16 / 9) / 1280;
    if (now > birds.next && birds.flocks.length < 2) {
      const dir = Math.random() < 0.5 ? 1 : -1, n = Math.round(rnd(4, 8)), list = [];
      for (let i = 0; i < n; i++) list.push({ dx: -dir * i * rnd(14, 24) * k, dy: Math.abs(i - n / 2) * rnd(5, 10) * k, ph: rnd(0, 6.28), f: rnd(5.5, 8.5), s: rnd(5, 8) * k });
      birds.flocks.push({ t0: now, dir, v: rnd(40, 70) * k, x0: dir > 0 ? -60 : st.w + 60, y0: rnd(0.08, 0.32) * st.h, list, drift: rnd(-5, 5) });
      birds.next = now + rnd(7000, 14000);
    }
    bctx.strokeStyle = 'rgba(28,30,36,.75)'; bctx.lineWidth = Math.max(1, 1.1 * k); bctx.lineCap = 'round';
    for (const fl of birds.flocks) {
      const t = (now - fl.t0) / 1000, fx = fl.x0 + fl.dir * fl.v * t, fy = fl.y0 + fl.drift * t;
      for (const b of fl.list) {
        const x = fx + b.dx, y = fy + b.dy + Math.sin(t * 1.3 + b.ph) * 2, h = b.s * 0.55 * Math.sin(t * b.f * 2 * Math.PI + b.ph);
        bctx.beginPath(); bctx.moveTo(x - b.s, y - h); bctx.quadraticCurveTo(x - b.s * 0.35, y + h * 0.3, x, y); bctx.quadraticCurveTo(x + b.s * 0.35, y + h * 0.3, x + b.s, y - h); bctx.stroke();
      }
    }
    birds.flocks = birds.flocks.filter((fl) => { const x = fl.x0 + fl.dir * fl.v * (now - fl.t0) / 1000; return x > -300 && x < st.w + 300; });
  }

  // ---------------- sound: light sparse birdsong from the first frame (starts on the first touch; fades at the tour) ----------------
  const amb = new Audio(new URL('audio/ambience.m4a', location.href).href);
  amb.loop = true; amb.preload = 'auto'; amb.volume = 0.6;
  const sound = { on: false, userOff: false, blocked: false };
  const soundBtn = document.createElement('button');
  soundBtn.type = 'button'; soundBtn.className = 'hud-btn cine-sound'; soundBtn.id = 'soundBtn';
  els.hudActions.prepend(soundBtn);
  const icon = () => { soundBtn.textContent = sound.on ? '🔊' : '🔇'; soundBtn.title = S('sound'); soundBtn.setAttribute('aria-label', S('sound')); soundBtn.setAttribute('aria-pressed', String(sound.on)); };
  function soundOn() { if (st.tourShown) return; amb.volume = 0.6; const p = amb.play(); if (p && p.then) p.then(() => { sound.on = true; sound.blocked = false; icon(); }, () => { sound.blocked = true; icon(); }); }
  function soundOff() { amb.pause(); sound.on = false; icon(); }
  soundBtn.addEventListener('click', (e) => { e.stopPropagation(); if (sound.on) { soundOff(); sound.userOff = true; } else { sound.userOff = false; soundOn(); } });
  window.addEventListener('pointerdown', () => { if (!sound.on && !sound.userOff && !st.tourShown) soundOn(); }, true);
  function fadeSound(ms = 900) { if (amb.paused) return; const v0 = amb.volume, t0 = performance.now(); const f = () => { const k = Math.min(1, (performance.now() - t0) / ms); amb.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(f); else { amb.pause(); sound.on = false; icon(); } }; f(); }
  icon();

  // ---------------- hints, title ----------------
  let hintTimer = null;
  function showHint() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      if (!st.holdActive || holdState.interacted || picker.isCardOpen()) return;
      hint.textContent = S('drag'); hint.classList.add('on');
      hintTimer = setTimeout(hideHint, 9000);
    }, 1500);
  }
  function hideHint() { clearTimeout(hintTimer); hint.classList.remove('on'); }
  function showTitle() {
    const m = ctx.meta;
    title.querySelector('.t1').textContent = host.pick(m.name) || '';
    title.querySelector('.t2').textContent = host.pick(m.tagline) || '';
    setTimeout(() => { if (st.seg?.role === 'orbit' || st.seg?.role === 'approach') title.classList.add('on'); }, 1000);
    setTimeout(() => title.classList.remove('on'), 6500);
  }

  // ---------------- segments ----------------
  function segTime() { return st.video ? st.video.currentTime || 0 : 0; }
  function enterSegment(seg) {
    st.seg = seg; st.segStarted = performance.now();
    legend.hidden = seg.role !== 'hold';
    L('segment', { seg: seg.id, role: seg.role });
    host.onSegment(seg);
    host.capture('segment_start', { segment: seg.id, kind: seg.kind, role: seg.role, unit: seg.unit || null, mode: 'cine' });
  }
  function nextOf(seg) { return typeof seg.next === 'string' && segById.has(seg.next) ? segById.get(seg.next) : null; }

  async function playFlat(seg, { from = null, crossfade = 0 } = {}) {
    enterSegment(seg);
    const v = videoOf(seg);
    v.loop = false;
    if (v.currentTime > 0.01) { try { v.currentTime = 0; } catch { /* ignore */ } }
    st.video = v;
    const shown = presented(v);
    play(v);
    if (seg.role === 'orbit' || seg.role === 'approach') { birds.on = true; showTitle(); }
    await shown;
    if (st.seg !== seg) return;
    for (const o of videos.values()) if (o !== v) o.style.zIndex = o === from ? '2' : '1';
    v.style.zIndex = '3';
    fadeTo(v, 1, crossfade);
    L('shown', { seg: seg.id, t: Math.round(v.currentTime * 1000) / 1000, crossfade });
    if (from && from !== v) setTimeout(() => { if (st.video !== from) { fadeTo(from, 0, 0); from.style.zIndex = '1'; from.pause(); } }, crossfade * 1000 + 30);
    const nx = nextOf(seg); if (nx) warm(nx);
    if (seg.role === 'descend') prepareHandoff();
    v.onended = () => { if (st.seg === seg) onFlatEnd(seg); };
  }
  async function onFlatEnd(seg) {
    L('ended', { seg: seg.id, t: Math.round((st.video?.currentTime || 0) * 1000) / 1000 });
    if (seg.next === 'handoff') return bridge(seg);
    const nx = nextOf(seg);
    if (!nx) return;
    if (nx.kind === 'frames') return arriveHold(nx, { from: st.video, crossfade: seg.junction?.seconds ?? 0.5 });
    // descend -> enter: one take, cut frame to frame (the enter is buffered at frame 0; the descent's last frame stays up meanwhile)
    const from = st.video;
    return playFlat(nx, { from, crossfade: seg.junction?.mode === 'crossfade' ? seg.junction.seconds : 0 });
  }

  async function arriveHold(seg, { from = null, crossfade = 0 } = {}) {
    const T = await openHold(seg);
    if (!T.ready) { loadHold(T).catch((e) => console.error('[cine] hold', e.message)); await waitFor(() => T.ready); }   // the clip's last frame stays up meanwhile
    enterSegment(seg);
    st.video = null; st.holdActive = true; holdState.activeSince = performance.now(); holdState.index = T.rest; T.drawn = null;
    holdCanvas.style.display = 'block'; holdCanvas.style.pointerEvents = 'auto';
    drawHold();
    if (from) { from.style.zIndex = '3'; fadeTo(from, 0, crossfade); setTimeout(() => { from.pause(); from.style.zIndex = '1'; }, crossfade * 1000 + 50); }
    L('shown', { seg: seg.id, index: T.rest + 1, crossfade, from: from?.dataset.seg || null });
    birds.on = true;
    const d = ctx.flow.defaults?.descend; if (d && segById.has(d)) warm(segById.get(d));
    setTimeout(() => { st.pillsOn = true; }, crossfade * 1000);
    showHint();
  }
  const waitFor = (fn, ms = 60000) => new Promise((ok) => { const t0 = performance.now(); const k = () => (fn() || performance.now() - t0 > ms ? ok() : setTimeout(k, 30)); k(); });

  // "continue" (picker onEnter -> flow.js enterFlight -> startSegment(descend)): ease the arc to its rest frame, crossfade the descent in
  async function startDescent(seg) {
    if (st.descending) return; st.descending = true;
    st.unit = host.selectedUnit();
    hideHint(); st.pillsOn = false; picker.update(() => null); legend.hidden = true;
    const T = st.hold;
    if (T && st.holdActive) await new Promise((ok) => goRest(700, ok));
    L('hold-rest', { index: T ? Math.round(holdState.index * 100) / 100 + 1 : null, rest: T ? T.rest + 1 : null, zoom: holdState.zoom });
    holdCanvas.style.pointerEvents = 'none';
    birds.on = false;
    const from = null;
    await playFlat(seg, { from, crossfade: (segById.get(flow.hold)?.junction?.seconds) ?? 0.6 });
    setTimeout(() => { st.holdActive = false; holdCanvas.style.display = 'none'; }, 700);
  }

  // ---------------- the hand-off: last frame -> the tour's panorama at that pose -> turn -> the tour ----------------
  function handoffOf() {
    const enterId = ctx.flow.defaults?.enter, e = enterId && segById.get(enterId);
    if (e?.handoff) return e.handoff;
    const d = segById.get(ctx.flow.defaults?.descend); return d?.handoff || null;
  }
  let panoReady = null;
  function prepareHandoff() {
    const ho = handoffOf(); if (!ho || st.tour) return;
    const u = st.unit || host.selectedUnit();
    st.tour = host.prepareTour(u, ho, ho.view_yaw ?? 0);                      // the tour loads behind the flight, at the view the turn ends on
    panoReady = viewer.setImage(asset(ho.pano)).then(() => true, (e) => { console.error('[cine] hand-off pano', e.message); return false; });
    L('tour-prepare', { url: st.tour?.url, yaw: st.tour?.yaw });
  }
  function visibleView(seg) {
    // the clip's view on this stage (cover-fit around focus_x): the yaw of the screen centre off the camera axis and the vertical
    // field of view the stage shows (rectilinear both ways, so the 360 viewer at that yaw/fov shows the same window)
    const W = seg.size?.[0] || 1280, H = seg.size?.[1] || 720, hf = ((seg.handoff?.hfov_deg || 65.5) * Math.PI) / 180;
    const r = rectFor(W, H), xc = (st.w / 2 - r.ox) / r.dw, yc = (st.h / 2 - r.oy) / r.dh;
    const t = Math.tan(hf / 2), tv = t / (W / H);
    return { dyaw: (Math.atan((2 * xc - 1) * t) * 180) / Math.PI, dpitch: (-Math.atan((2 * yc - 1) * tv) * 180) / Math.PI,
      vfov: (2 * Math.atan(tv * (st.h / r.dh)) * 180) / Math.PI };
  }
  async function bridge(seg) {
    const ho = seg.handoff || handoffOf();
    if (!ho) { L('no-handoff'); return; }
    if (!st.tour) prepareHandoff();
    const ok = await panoReady;
    if (!ok) { L('bridge-skip', { why: 'pano' }); return revealWhenReady(); }
    st.bridging = true;
    const vv = visibleView(seg), reg = ho.registration?.applied ? ho.registration : { dyaw: 0, dpitch: 0, fov_scale: 1 };
    // the clip's last frame as the tour's panorama: the clay pose + the build's registration (Kling drifts a few degrees off its clay camera)
    const y0 = ho.start_yaw + reg.dyaw + vv.dyaw, p0 = ho.start_pitch + reg.dpitch + vv.dpitch;
    vv.vfov = (2 * Math.atan(Math.tan((vv.vfov * Math.PI) / 360) * reg.fov_scale) * 180) / Math.PI;
    viewer.minFov = Math.min(viewer.minFov, Math.floor(vv.vfov) - 1);
    const f1 = host.tourFov(); if (f1 > viewer.maxFov) viewer.maxFov = Math.ceil(f1);
    viewer.lookAt(y0, p0); viewer.setFov(vv.vfov);
    host.viewerRun(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));          // the panorama is on the canvas under the clip
    if (window.__habait?.holdBridge) await new Promise((ok) => { window.__habait.bridgeGo = ok; });   // test hook: shoot the clip's last frame
    layer.classList.add('bridging');
    L('bridge', { seg: seg.id, yaw: Math.round(y0 * 10) / 10, pitch: Math.round(p0 * 10) / 10, vfov: Math.round(vv.vfov * 10) / 10, to_yaw: ho.view_yaw, tour_fov: Math.round(f1 * 10) / 10 });
    const v = st.video;
    fadeTo(v, 0, ho.crossfade_s ?? 0.5);
    st.unit = st.unit || host.selectedUnit();
    hideTitleAndHold();
    await sleep((ho.crossfade_s ?? 0.5) * 1000 + 60);
    if (v) v.pause();
    if (window.__habait?.holdTurn) await new Promise((ok) => { window.__habait.turnGo = ok; });       // test hook: shoot the matching pose
    // the turn: to the windows (clockwise, as card 34's enter turned), pitch to the tour's -2, the field of view to the tour's
    const dYaw = ((((ho.view_yaw - y0) % 360) + 360) % 360);                    // clockwise, 0..360
    const turn = { t0: performance.now(), ms: (ho.turn_s ?? 3) * 1000, y0, y1: y0 + dYaw, p0, p1: -2, f0: vv.vfov, f1 };
    st.turn = turn;
    await new Promise((done) => {
      const step = () => {
        if (st.turn !== turn) return done();
        if (els.viewer.classList.contains('dragging') || viewer.gyro) { L('turn-cancel', { yaw: Math.round(viewer.yaw * 10) / 10 }); st.turn = null; return done(); }   // the buyer took over
        const k = Math.min(1, (performance.now() - turn.t0) / turn.ms), e = k * k * (3 - 2 * k);
        viewer.yaw = turn.y0 + (turn.y1 - turn.y0) * e; viewer.pitch = turn.p0 + (turn.p1 - turn.p0) * e; viewer.setFov(turn.f0 + (turn.f1 - turn.f0) * e);
        if (k < 1) requestAnimationFrame(step); else { st.turn = null; done(); }
      };
      requestAnimationFrame(step);
    });
    return revealWhenReady();
  }
  async function revealWhenReady() {
    const yaw = host.viewYaw();
    st.tour = host.wantYaw(st.tour, st.unit || host.selectedUnit(), yaw, handoffOf());   // the buyer turned: reload at the exact yaw (cached)
    if (window.__habait?.holdReveal) await new Promise((ok) => { window.__habait.reveal = ok; }); // test hook: shoot the bridge first
    await st.tour.ready;                                                    // no spinner: the panorama stays up until the tour painted it
    host.revealTour(st.tour);
    st.tourShown = true; st.bridging = false; birds.on = false;
    fadeSound(900);
    L('reveal', { yaw: Math.round(yaw * 10) / 10, url: st.tour.url, view: st.tour.view });
    host.viewerRun(false);
    host.updateCaption();
  }
  function hideTitleAndHold() { title.classList.remove('on'); hideHint(); holdCanvas.style.display = 'none'; st.holdActive = false; }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------- the loop ----------------
  function frame(now) {
    if (st.tourShown) return;
    requestAnimationFrame(frame);
    if (st.holdActive) stepHold(now);
    if (st.holdActive && st.pillsOn && !st.descending) { projectUnits(); picker.update((u) => pillPos.get(String(u.id)) || null); }
    legend.hidden = st.seg?.role !== 'hold' || !!st.descending || picker.isCardOpen();   // the unit card covers the bottom row on a phone
    stepBirds(now);
    if (st.video && !st.bridging && st.seg?.kind === 'flat-video' && Number.isFinite(st.video.duration)) els.progressBar.style.width = `${Math.min(100, (st.video.currentTime / st.video.duration) * 100)}%`;
    else els.progressBar.style.width = '0%';
    host.updateCaption();
  }

  // ---------------- caption (caption-v1 usage, as card 34): micro band always; short_project over the orbit's opening, the hold
  // and the descent's opening; short (unit) over the enter's opening; nothing over the tour ----------------
  function captionState() {
    const c = flow.caption?.[lang()] || {};
    const seg = st.seg, t = segTime();
    let variant = null;
    if (st.tourShown || st.bridging) variant = null;
    else if (!seg || seg.role === 'hold') variant = 'short_project';
    else if (seg.role === 'enter') variant = t < CAPTION_OPENING_S ? 'short' : null;
    else variant = t < CAPTION_OPENING_S ? 'short_project' : null;
    const unit = seg?.unit || st.unit?.id || '';
    const fill = (s) => String(s || '').replace(/\{UNIT\}/g, unit);
    return { band: fill(c.micro), over: variant ? fill(c[variant]) : '', variant };
  }

  // ---------------- public ----------------
  async function start(first) {
    if (st.started) return; st.started = true;
    // the stage's box, not the window's: the caption band (flow-real.css) takes its height after the first layout and shrinks the
    // stage; a stale size squashed the hold canvas and put the pills 23 px low (caught by test/flow-cine.test.mjs)
    measure(); new ResizeObserver(() => measure()).observe(els.stage);
    requestAnimationFrame(frame);
    const seg = first && segById.has(first.id) ? segById.get(first.id) : segById.get(flow.start);
    // the hold opens behind the flight from the first second (its rest frame is where the orbit lands)
    const holdSeg = segById.get(flow.hold);
    if (holdSeg) openHold(holdSeg).then((T) => { if (seg.kind === 'frames') return; return loadHold(T); }).catch((e) => console.error('[cine] hold', e.message));
    soundOn();
    if (seg.kind === 'frames') { const T = await openHold(seg); await loadHold(T).catch((e) => console.error(e)); return arriveHold(seg); }
    const v = videoOf(seg);
    v.style.opacity = '1'; v.style.zIndex = '3';                            // frame 1 (the poster) is up at once
    await canPlay(v, 6000);
    return playFlat(seg);
  }
  function startSegment(seg) {
    if (!seg) return;
    if (seg.role === 'descend') return startDescent(seg);
    if (seg.role === 'hold') {
      if (st.seg?.role === 'hold') return;
      const from = st.video; if (from) from.onended = null;
      return arriveHold(seg, { from, crossfade: 0.5 });                     // "to the facade" during the orbit = skip
    }
    if (seg.kind === 'flat-video') return playFlat(seg, { from: st.video });
  }
  function showUnit() { const hold = segById.get(flow.hold); if (st.seg?.role !== 'hold' && hold && !st.descending) startSegment(hold); }
  function setLang() { icon(); renderLegend(); if (hint.classList.contains('on')) hint.textContent = S('drag'); }

  const api = { start, startSegment, showUnit, captionState, setLang, log, st, holdState, flow,
    get seg() { return st.seg; }, hint: () => S('hint') };
  window.__cine = {
    log, flow,
    get seg() { return st.seg?.id || null; },
    get role() { return st.seg?.role || null; },
    get videoTime() { return st.video ? st.video.currentTime : 0; },
    get video() { return st.video ? { seg: st.video.dataset.seg, t: st.video.currentTime, paused: st.video.paused, ended: st.video.ended, opacity: st.video.style.opacity } : null; },
    get hold() { const T = st.hold; return T && { ready: T.ready, active: st.holdActive, index: holdState.index, shown: shownIndex(), N: T.N, rest: T.rest, hi: T.hiLoaded, lo: T.loLoaded, interacted: holdState.interacted, zoom: holdState.zoom, gliding: Math.abs(holdState.glideV) > 0.05, track: T.seg.track }; },
    get pills() { return Object.fromEntries([...pillPos].map(([k, v]) => [k, v])); },
    project: (id, i) => { const u = flow.units?.[id]; return u && st.hold ? projectWorld(u.centre, i ?? shownIndex()) : null; },
    get tourShown() { return st.tourShown; }, get bridging() { return st.bridging; },
    get turn() { return st.turn ? { yaw: viewer.yaw, fov: viewer.fov } : null; },
    get sound() { return { ...sound, paused: amb.paused }; },
    stage: () => ({ w: st.w, h: st.h, focus: st.focus }),
  };
  return api;
}

// 3x4 rows of a rigid camera-to-world matrix -> world-to-camera as a flat 12-array (R^T | -R^T t)
function invert34(m) {
  const R = [[m[0][0], m[0][1], m[0][2]], [m[1][0], m[1][1], m[1][2]], [m[2][0], m[2][1], m[2][2]]], t = [m[0][3], m[1][3], m[2][3]];
  const o = [];
  for (let r = 0; r < 3; r++) { const row = [R[0][r], R[1][r], R[2][r]]; o.push(...row, -(row[0] * t[0] + row[1] * t[1] + row[2] * t[2])); }
  return o;
}

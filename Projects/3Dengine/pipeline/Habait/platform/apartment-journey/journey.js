// The apartment journey of 846, round 4 (plan development/plans/2026-11-09-rainbow-v2.md §9): ONE automatic sequence, no scrolling.
//   the BIRD FLIGHT starts with the tap (Eliran 2026-11-10: no standing picture): the film media/fly-846-*.mp4 (the tower → 846's terrace →
//   through the glass into the living room, 6.2 s) plays as soon as it can, and the floors counter + «דירה 846» run OVER it (0.4–2.9 s) →
//   the living-room landing (~6–7 s) → the 360 tour. Until the film can play the still tower keeps a slow push; if it is still not ready
//   at 3.9 s (or ?fly=0): the earlier glide on the still (isolated floor 4.6–5.6 s, push 5.6–7.6 s, landing 7.2–8 s). Entered from /hold/ (?from=hold&unit=846&tour=…&return=…&fr=…) inside a full-screen frame of the hold: this page only
//   ANIMATES and tells the hold when to load the tour (habait:journey-preload) and when to show it (habait:journey-land / -skip); the hold
//   owns the tour frame, so the tour's walkthrough music keeps the AudioContext the visitor's own tap made in the hold (tour.js hostAudio).
//   Opened on its own (no parent hold), it goes to the tour itself at the end.
// The landing is the tour's first view, drawn here with the tour's own maths (tour360/viewer/tour.js: the room opens at the deep-link yaw,
// pitch −2, hfov = fitHfov(): an 85° vertical view, clamped 60–118° horizontal) from the very panorama the tour loads
// (floor=parquet → panos-parquet/04-living.webp), so the cross-fade into the tour shows the same picture on both sides.
const Q = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const html = document.documentElement;
const EMBED = window.parent !== window && Q.get('from') === 'hold';
const LIVING_YAW = 180;   // the living room's first view: looking INTO the room from the terrace side, the direction the flight film ends on (the hold's JOURNEY_YAW)
const post = (type) => { if (EMBED) { try { window.parent.postMessage({ type }, location.origin); } catch (e) { /* no parent */ } } };
const state = { phase: 'start', rendered: false, landed: false, handedOff: false, t0: performance.now() };
window.__journey = state;

// ---------- the tour (the hold passes its own hand-off URL; standalone: the site's tour) ----------
function tourHref() {
  const u = new URL(Q.get('tour') || '../tour/?scope=apartment&floor=parquet&video=0', location.href);
  u.searchParams.set('room', 'living');
  if (!u.searchParams.has('yaw')) u.searchParams.set('yaw', String(LIVING_YAW));
  if (!u.searchParams.has('scope')) u.searchParams.set('scope', 'apartment');
  if (!Q.get('tour')) { u.searchParams.set('from', 'journey'); u.searchParams.set('return', Q.get('return') || new URL('../hold/?from=platform&project=rainbow', location.href).toString()); }
  return u.toString();
}
const TOUR = tourHref();
$('#skip').href = TOUR;
function handOff(kind) {
  if (state.handedOff) return; state.handedOff = true; state.phase = kind;
  if (EMBED) post(kind === 'skip' ? 'habait:journey-skip' : 'habait:journey-land');
  else location.replace(TOUR);
}
$('#skip').addEventListener('click', (e) => { e.preventDefault(); handOff('skip'); });

// ---------- facts (units.json; no prices) ----------
fetch(new URL('../fixtures/rainbow/units.json', location.href), { cache: 'no-cache' }).then((r) => r.json()).then((d) => {
  const u = (d.units || []).find((x) => String(x.id) === (Q.get('unit') || '846')); if (!u) return;
  const set = (k, v) => { const el = $(`[data-fact="${k}"]`); if (el && v != null) el.textContent = String(v); };
  set('rooms', u.rooms); set('area', u.area_m2); set('outdoor', u.outdoor_m2);
}).catch(() => { /* the in-page facts stay (the same numbers) */ });

// ---------- the frame: the hold's own on-screen box (fr = x,y,w,h,vw,vh[,p]) when it fits this screen, else cover ----------
const frame = $('#frame');
const box = (() => {
  const vw = innerWidth, vh = innerHeight, f = (Q.get('fr') || '').split(',');
  const [x, y, w, h, fvw, fvh] = f.map(Number);
  if (f.length >= 6 && [x, y, w, h].every(Number.isFinite) && Math.abs(fvw - vw) <= 2 && Math.abs(fvh - vh) <= 2) return { x, y, w, h, portrait: f[6] === 'p', cover: f[6] !== 'p' };
  const cw = Math.max(vw, vh * 16 / 9), ch = cw * 9 / 16;
  return { x: (vw - cw) / 2, y: (vh - ch) / 2, w: cw, h: ch, portrait: false, cover: true };
})();
Object.assign(frame.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
html.classList.toggle('is-portrait', box.portrait);
// the air (portrait): navy → the frame's top-edge colour … its bottom-edge colour → navy, the stops where the hold puts them (holdarc.js edges)
if (box.portrait) {
  const im = new Image(); im.src = 'media/tower-16-960.jpg';
  im.decode().then(() => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 2; const x = c.getContext('2d', { willReadFrequently: true });
    const w = im.naturalWidth, h = im.naturalHeight, band = Math.max(1, Math.round(h * 0.08));
    x.drawImage(im, 0, 0, w, band, 0, 0, 8, 1); x.drawImage(im, 0, h - band, w, band, 0, 1, 8, 1);
    const d = x.getImageData(0, 0, 8, 2).data, AIR = [8, 19, 30];
    const avg = (row) => [0, 1, 2].map((k) => { let t = 0; for (let i = 0; i < 8; i++) t += d[(row * 8 + i) * 4 + k]; return Math.round(t / 8); });
    const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k)), rgb = (q) => `rgb(${q.join(',')})`;
    const y0 = box.y + box.h * 0.16, y1 = box.y + box.h * 0.9;
    $('#air').style.setProperty('--air', `linear-gradient(to bottom, ${rgb(AIR)} 0px, ${rgb(mix(AIR, avg(0), 0.55))} ${y0.toFixed(0)}px, ${rgb(mix(AIR, avg(1), 0.5))} ${y1.toFixed(0)}px, ${rgb(AIR)} 100%)`);
  }).catch(() => { /* the navy stays */ });
}
const AX = 0.4979, AY = 0.7883;   // 846's anchor in the frame (media/manifest.json floor16)
const portraitScreen = () => innerWidth / innerHeight <= 0.8;
function move(s, tx, ty) {        // the frame's translate that brings the anchor to (tx, ty) of the screen at scale s (origin = the anchor)
  const ax = box.x + AX * box.w, ay = box.y + AY * box.h; let dx = innerWidth * tx - ax, dy = innerHeight * ty - ay;
  if (box.cover) {                // a cover frame must keep covering the screen
    const L = ax - AX * box.w * s, R = ax + (1 - AX) * box.w * s, T = ay - AY * box.h * s, B = ay + (1 - AY) * box.h * s;
    dx = Math.min(-L, Math.max(innerWidth - R, dx)); dy = Math.min(-T, Math.max(innerHeight - B, dy));
  }
  return { x: dx, y: dy };
}

// ---------- the landing: the tour's first view of the living room, drawn on the canvas ----------
const land = $('#land');
function fitHfov() {              // tour360/viewer/tour.js fitHfov(), as written there
  const aspect = innerWidth / Math.max(1, innerHeight), v = (85 * Math.PI) / 180;
  return Math.max(60, Math.min(118, (2 * Math.atan(Math.tan(v / 2) * aspect) * 180) / Math.PI));
}
async function renderLanding() {
  const T = new URL(TOUR); const floor = T.searchParams.get('floor');
  const dir = { parquet: 'panos-parquet', concrete: 'panos-concrete', marble: 'panos-marble' }[floor] || 'panos';
  const yaw = Number(T.searchParams.get('yaw')) || 0, pitch = -2, hf = fitHfov();
  const im = new Image(); im.decoding = 'async'; im.src = new URL(`${dir}/04-living.webp`, T).toString();
  await im.decode();
  const pw = im.naturalWidth, ph = im.naturalHeight, pc = document.createElement('canvas'); pc.width = pw; pc.height = ph;
  const pctx = pc.getContext('2d', { willReadFrequently: true }); pctx.drawImage(im, 0, 0); const src = pctx.getImageData(0, 0, pw, ph).data;
  const d = Math.min(devicePixelRatio || 1, 1.5), w = Math.round(innerWidth * d), h = Math.round(innerHeight * d);
  land.width = w; land.height = h; const ctx = land.getContext('2d'); const out = ctx.createImageData(w, h); const o = out.data;
  const tx = Math.tan((hf * Math.PI) / 360), ty = tx * h / w, cp = Math.cos((pitch * Math.PI) / 180), sp = Math.sin((pitch * Math.PI) / 180), yr = (yaw * Math.PI) / 180;
  const ROWS = 48;
  for (let j0 = 0; j0 < h; j0 += ROWS) {          // in slices, so the floors animation keeps running
    for (let j = j0; j < Math.min(h, j0 + ROWS); j++) {
      const y = (1 - (2 * (j + 0.5)) / h) * ty, Y = y * cp + sp, Z0 = cp - y * sp;
      for (let i = 0; i < w; i++) {
        const X = ((2 * (i + 0.5)) / w - 1) * tx;
        const lon = Math.atan2(X, Z0) + yr, lat = Math.atan2(Y, Math.hypot(X, Z0));
        let u = (lon / (2 * Math.PI) + 0.5) % 1; if (u < 0) u += 1;
        const fx = u * pw - 0.5, fy = Math.min(ph - 1, Math.max(0, (0.5 - lat / Math.PI) * ph - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0, x1 = (x0 + 1 + pw) % pw, xa = (x0 + pw) % pw, y1 = Math.min(ph - 1, y0 + 1);
        const a = (y0 * pw + xa) * 4, b = (y0 * pw + x1) * 4, c = (y1 * pw + xa) * 4, e = (y1 * pw + x1) * 4, k = (j * w + i) * 4;
        for (let ch = 0; ch < 3; ch++) o[k + ch] = (src[a + ch] * (1 - ax) + src[b + ch] * ax) * (1 - ay) + (src[c + ch] * (1 - ax) + src[e + ch] * ax) * ay;
        o[k + 3] = 255;
      }
    }
    await new Promise((r) => requestAnimationFrame(r));
  }
  ctx.putImageData(out, 0, 0); state.rendered = true; state.landing = { yaw, pitch, hfov: hf, pano: im.src.replace(location.origin, '') };
}

// ---------- the flight film: asked for at once, so it is ready when the floors end (a slow / data-saving line gets the small file) ----------
(() => {
  const v = $('#fly'); if (!v || !html.classList.contains('is-motion') || Q.get('fly') === '0') return;
  const c = navigator.connection || {}; const small = c.saveData || /(^|-)[23]g$/.test(c.effectiveType || '');
  v.src = small ? 'media/fly-846-854.mp4' : 'media/fly-846-1280.mp4'; v.load();
})();

// ---------- the sequence ----------
function run() {
  const { gsap } = window;
  if (!html.classList.contains('is-motion') || !gsap) { handOff('skip'); return; }   // reduced motion / no GSAP: straight to the tour
  gsap.ticker.lagSmoothing(0);   // the timeline keeps the wall clock, so the copy leaves on time beside the film even on a busy phone
  const rendering = renderLanding().catch((e) => { console.warn('journey: landing not drawn', e); });
  const num = $('#num'), band = $('#band'), counter = { n: 1 };
  const z1 = portraitScreen() ? 1.55 : 1.7, z2 = z1 * 2.8;
  const t1 = portraitScreen() ? [0.56, 0.62] : [0.42, 0.56];
  gsap.set(band, { autoAlpha: 0, '--dim': 0 }); gsap.set('#pin', { autoAlpha: 0, scale: 0.4 });
  gsap.set(['#copy', '#unit', '#facts'], { autoAlpha: 0 }); gsap.set(['#unit', '#facts'], { y: 20 });
  num.textContent = '1';
  const fly = $('#fly'); if (fly) gsap.set(fly, { autoAlpha: 0 });
  const canFly = () => Boolean(fly && !fly.error && fly.readyState >= 3 && Q.get('fly') !== '0');   // enough of the film is here to start it
  const tl = gsap.timeline({ onUpdate: () => { state.t = tl.time(); } });
  state.tl = tl;
  tl.to('#copy', { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 0.4)
    // 1. the floors: the counter runs up to 16 beside the tower; floor 16 lights; «דירה 846» and the facts
    .to(counter, { n: 16, duration: 2.5, ease: 'power1.inOut', onUpdate: () => { num.textContent = String(Math.round(counter.n)); } }, 0.4)
    .fromTo(frame, { scale: 1 }, { scale: 1.06, duration: 2.5, ease: 'none' }, 0.4)
    // Eliran 2026-11-10 (screenshot of the yellow band around floor 16 with the «846» pin): «זה הריבוע הצהוב … שאני לא רוצה אלא כניסה ישירה
    // לדירה מהריחוף» — the band and the pin are never shown any more (they stay hidden; the markup is kept for the record)
    .to(['#unit', '#facts'], { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.12, ease: 'power3.out' }, 3.0)
    .call(() => { state.phase = 'floors'; post('habait:journey-preload'); }, null, 3.4)
    .add(() => { if (state.mode === 'fly') return; tl.pause(); if (canFly()) flight(); else glide(); }, 3.9);
  const landed = () => { state.phase = 'landed'; state.landed = true; state.landedAt = performance.now() - state.t0; };

  // 2a. the bird flight (Eliran 2026-11-10: «ממעוף תעופה של ציפור לתוך הדירה עצמה ישר לסלון»; «חייב להיות רציף בלי העצירה … ישר כניסה
  //     לדירה»): the film (media/fly-846-*.mp4: the tower → 846's terrace → through the glass into the living room) starts AS SOON AS IT CAN
  //     PLAY — with the tap when the hold warmed it — and the floors counter and «דירה 846» run OVER it; nothing stands still. As the film
  //     ends, the landing — the tour's own first view — takes over. Until the film can play, the still tower keeps its slow push.
  function flight() {
    if (state.mode) return; state.mode = 'fly'; state.flyStart = performance.now() - state.t0;
    const D = Number.isFinite(fly.duration) && fly.duration > 1 ? fly.duration : 6.2, X = D - 0.75, COPY_OUT = Math.min(3.3, D - 1.6);   // the copy leaves as the camera crosses the glass (film 3.0–3.4 s), so the room is seen clean
    gsap.to(fly, { autoAlpha: 1, duration: 0.5, ease: 'power1.inOut' });
    let done = false, copyGone = false;
    const show = () => {
      if (done) return; done = true;
      gsap.timeline().fromTo(land, { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 0).call(landed, null, 0.8).call(() => handOff('land'), null, 0.95);
    };
    let asked = false;
    const landNow = () => { if (asked) return; asked = true; gsap.to('#copy', { autoAlpha: 0, duration: 0.3 }); rendering.then(show); setTimeout(show, 4000); };
    const watch = () => {
      if (asked) return; state.flyT = fly.currentTime;
      if (!copyGone && fly.currentTime >= COPY_OUT) { copyGone = true; state.phase = 'glide'; gsap.to('#copy', { autoAlpha: 0, duration: 0.5, ease: 'power1.in' }); }   // the copy leaves as the camera reaches the glass
      if (fly.currentTime >= X || fly.ended) landNow(); else requestAnimationFrame(watch);
    };
    fly.addEventListener('ended', landNow, { once: true }); fly.addEventListener('error', landNow, { once: true });
    setTimeout(landNow, (D + 2.5) * 1000);          // a stalled film never holds the visitor
    try { fly.currentTime = 0; const pr = fly.play(); if (pr && pr.catch) pr.catch(() => landNow()); } catch (e) { landNow(); }
    requestAnimationFrame(watch);
  }
  // the film starts the moment enough of it is here (checked every frame until the floors end; after that the 3.9 s step decides)
  (function soon() { if (state.mode || state.handedOff || tl.time() >= 3.85) return; if (tl.time() >= 0.25 && canFly()) flight(); else requestAnimationFrame(soon); })();

  // 2b. the glide (the film is not ready, or cannot play): the floor isolated, then one continuous push toward 846's terrace
  function glide() {
    state.mode = 'glide';
    const g = gsap.timeline({ paused: true });
    g.to(frame, { scale: z1, x: () => move(z1, t1[0], t1[1]).x, y: () => move(z1, t1[0], t1[1]).y, duration: 1.0, ease: 'power2.inOut' }, 4.6)
      .to(band, { '--dim': 0.9, duration: 1.0, ease: 'power1.inOut' }, 4.6)
      .to('#eyebrow', { autoAlpha: 0, duration: 0.3 }, 4.6)
      .call(() => { state.phase = 'glide'; }, null, 5.6)
      .to('#copy', { autoAlpha: 0, duration: 0.4, ease: 'power1.in' }, 5.8)
      .to(frame, { scale: z2, x: () => move(z2, 0.5, 0.5).x, y: () => move(z2, 0.5, 0.5).y, duration: 2.0, ease: 'power2.in' }, 5.6)
      .to(band, { '--dim': 0.15, duration: 1.2, ease: 'power1.in' }, 5.8)
      .to([band, '#pin', '#scrim'], { autoAlpha: 0, duration: 0.3 }, 7.1)
      // 3. the landing: the living room, as the tour will open it (the push carries on into it)
      .add(() => { g.pause(); rendering.then(() => g.resume()); setTimeout(() => g.resume(), 4000); }, 7.2)
      .fromTo(land, { autoAlpha: 0, scale: 1.18 }, { autoAlpha: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 7.2)
      .call(landed, null, 8.0)
      // 4. the hand-off
      .call(() => handOff('land'), null, 8.15);
    g.play(3.9);
  }
  setTimeout(() => { const l = document.createElement('p'); l.className = 'hb-sr'; l.setAttribute('aria-live', 'polite'); l.textContent = 'קומה 16, דירה 846. ממשיכים לסיור 360 בדירה.'; document.body.append(l); }, 3000);
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', run, { once: true }); else run();

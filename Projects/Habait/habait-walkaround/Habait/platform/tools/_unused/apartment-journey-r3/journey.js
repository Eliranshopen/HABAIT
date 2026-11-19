// The apartment journey of 846 (plan development/plans/2026-11-09-rainbow-v2.md §8; was the v2 test page). Own module: no production
// script is imported or changed. Entered from /hold/ («המשיכו אל הדירה» on 846) with ?from=hold&unit=846&tour=…&return=…; ?intro=hero
// (a test view only; nothing links to it — /v2/ forwards to the landing) shows the 846 hero first, as the v2 test did.
// - facts and routes from fixtures/rainbow/project.json + units.json (the stage rewrites their local hosts to /tour and /hold);
// - the hero film: poster first (LCP), film after load, pause off-screen, a pause/play button (WCAG 2.2.2), none on reduced motion / Save-Data;
// - the scroll story (html.is-motion only): GSAP 3.13 ScrollTrigger scrubs sticky stages, Lenis smooths the wheel on fine pointers.
//   Reduced motion, no JS, or GSAP missing = the static page in v2.css (every stage visible, nothing moves).
// Timing learnt from the reference recording (4 fps sheets, plan §2): title fades as the camera rises; the floor number steps up to the
// chosen floor beside the tower; the floor is isolated; the cutaway arrives, its title and the room chips ~1 s later; a dive into a
// room; rooms change by a ~0.5 s crossfade with a slow push-in, the caption and the filmstrip appear after the picture settles.
const ROOT = new URL('../', location.href);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const html = document.documentElement;
const Q = new URLSearchParams(location.search);
const JOURNEY = html.classList.contains('is-journey');   // set in <head>: the apartment journey (from /hold/) opens at the floor, no project hero
const ROUTE = { hold: null, tour: null };

// ---------------- data: facts, developer, legal line, routes ----------------
async function getJson(rel) { const r = await fetch(new URL(rel, ROOT), { cache: 'no-cache' }); if (!r.ok) throw new Error(rel + ' ' + r.status); return r.json(); }
const pick = (o) => (o && (o.he || o.en)) || '';
async function loadData() {
  const [proj, units] = await Promise.all([getJson('fixtures/rainbow/project.json'), getJson('fixtures/rainbow/units.json')]);
  const dev = pick(proj.developer);
  if (dev) { $('#devName').textContent = dev; $('#devFoot').textContent = dev; }
  const full = pick(proj.disclaimer);
  if (full) { $('#legalLine').textContent = full.split(/(?<=\.)\s/)[0] || full; $('#legalFull').textContent = full; $('#legal').hidden = false; }
  const u = (units.units || []).find((x) => String(x.id) === '846');
  if (u) {
    const set = (k, v) => { const el = $(`[data-fact="${k}"]`); if (el && v != null) el.textContent = String(v); };
    set('rooms', u.rooms); set('area', u.area_m2); set('outdoor', u.outdoor_m2);   // prices are never shown (project.json prices_public=false)
  }
  const ext = proj.exterior || {};
  // the way back to the building: ?return= (the hold passes its own URL without the orbit film, so the visitor lands back at the stop);
  // else the hold from project.json (its film first, as the landing's CTA)
  let hold = Q.get('return');
  if (!hold && ext.url) {
    const h = new URL(ext.url, location.href);
    for (const [k, v] of Object.entries(ext.params || {})) h.searchParams.set(k, v);
    h.searchParams.set('project', proj.id || 'rainbow');
    if (ext.intro && ext.intro.clip && ext.intro.mode === 'inline') h.searchParams.set('orbit', new URL(`fixtures/rainbow/${ext.intro.clip}`, ROOT).toString());
    hold = h.toString();
  }
  if (hold) { ROUTE.hold = hold; $$('[data-route="hold"]').forEach((a) => { a.href = hold; }); }
  // the tour: ?tour= is the hold's own hand-off URL (scope=apartment, from=flight, ui=min, return=the hold); else project.json's
  const base = Q.get('tour') || (ext.params && ext.params.tour);
  if (base) {
    ROUTE.tour = (room) => { const t = new URL(base, location.href); t.searchParams.set('room', room); if (!Q.get('tour')) { t.searchParams.set('scope', 'apartment'); t.searchParams.set('from', 'journey'); if (ROUTE.hold) t.searchParams.set('return', ROUTE.hold); } return t.toString(); };
    $('#ctaTour').href = ROUTE.tour('living');
    $$('[data-route="tour-room"]').forEach((a) => { a.href = ROUTE.tour(a.dataset.room); });
  }
}

// ---------------- into the 360 tour, with the iOS sound unlock ----------------
// The tour's walkthrough music plays on window.parent.__habaitAudio (tour360/viewer/tour.js hostAudio): iOS plays sound only after a gesture
// in the SAME document, so — as the hold does on «המשיכו אל הדירה» — the visitor's own tap on a tour link here creates and resumes the
// AudioContext (+ the silent loop on touch WebKit) and the tour opens in a full-screen frame of THIS page. A copy of the hold's
// habaitAudioUnlock (research/…/flyover3d/app.js); never around the autoplay rule: all of it runs inside the visitor's tap.
function habaitAudioUnlock() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const H = window.__habaitAudio || (window.__habaitAudio = {});
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not there */ }
    if (!H.ac) H.ac = new AC();
    if (H.ac.state !== 'running') H.ac.resume().catch(() => {});
    const src = H.ac.createBufferSource(); src.buffer = H.ac.createBuffer(1, 1, 22050); src.connect(H.ac.destination); src.start(0);
    const touchWebKit = navigator.maxTouchPoints > 0 && window.CSS && CSS.supports && CSS.supports('-webkit-touch-callout', 'none');
    if (touchWebKit) {
      if (!H.silent) {
        const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
        w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
        let bin = ''; for (const x of b) bin += String.fromCharCode(x);
        H.silent = new Audio('data:audio/wav;base64,' + btoa(bin)); H.silent.loop = true; H.silent.setAttribute('playsinline', '');
      }
      H.silent.play().catch(() => {});
    }
  } catch (e) { /* no audio: the tour falls back to its own first tap */ }
}
function openTour(href) {
  habaitAudioUnlock();                                       // first, still inside the tap
  let f = $('#tourFrame');
  if (!f) {
    f = document.createElement('iframe'); f.id = 'tourFrame'; f.title = 'סיור 360° בדירה 846'; f.allow = 'fullscreen; autoplay'; f.allowFullscreen = true;
    document.body.append(f);
  }
  f.src = href;
  if (lenis) lenis.stop();
  html.classList.add('is-tour');
  const show = () => { f.classList.add('is-on'); };
  f.addEventListener('load', show, { once: true });
  setTimeout(show, 6000);                                    // safety: the frame comes in front even if load is slow
}
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[data-route="tour"], a[data-route="tour-room"]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); openTour(a.href);
});

// ---------------- the hero film ----------------
const hero = $('#hero'), video = $('#heroVideo'), btn = $('#heroToggle');
const saveData = Boolean(navigator.connection && navigator.connection.saveData);
let userPaused = false;
function syncToggle() {
  const playing = !video.paused && !video.ended && video.currentSrc;
  btn.dataset.state = playing ? 'playing' : 'paused';
  btn.setAttribute('aria-label', playing ? 'השהיית הסרטון' : 'הפעלת הסרטון');
}
function pickSrc() {
  if (innerWidth / innerHeight <= 0.8) return video.getAttribute('data-src-portrait');
  const w = Math.max(innerWidth, innerHeight * 16 / 9) * Math.min(devicePixelRatio || 1, 2);
  return video.getAttribute(innerWidth <= 900 || w <= 1400 ? 'data-src-720' : 'data-src-1080');
}
async function play() {
  if (!video.getAttribute('src')) { video.src = pickSrc(); video.load(); }
  try { await video.play(); } catch (e) { /* autoplay refused: the button stays on «play» */ }
  syncToggle();
}
video.addEventListener('playing', () => { hero.classList.add('is-playing'); syncToggle(); });
video.addEventListener('pause', syncToggle);
video.addEventListener('error', () => { hero.classList.remove('is-playing'); syncToggle(); });
btn.addEventListener('click', () => { if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); } });
new IntersectionObserver((es) => {
  const inView = es[0].isIntersecting;
  if (!inView && !video.paused) video.pause();
  else if (inView && video.paused && video.getAttribute('src') && !userPaused && !reduce.matches) play();
}, { threshold: 0 }).observe(hero);
const autostart = () => { if (JOURNEY || reduce.matches || saveData) { syncToggle(); return; } play(); };   // the journey has no hero film
if (document.readyState === 'complete') autostart(); else addEventListener('load', autostart, { once: true });

// ---------------- the live dollhouse (on request) ----------------
const dlg = $('#dialog3d');
let lenis = null;
$('#open3d').addEventListener('click', () => {
  const body = $('#dialog3dBody');
  if (!body.querySelector('iframe')) {
    const f = document.createElement('iframe');
    f.src = new URL('tour/3d/dollhouse.html#preset=3d', ROOT).toString();
    f.title = 'דירה 846 בתלת־ממד'; f.loading = 'eager'; f.allow = 'fullscreen';
    body.append(f);
  }
  if (lenis) lenis.stop();
  dlg.showModal();
});
$('#close3d').addEventListener('click', () => dlg.close());
dlg.addEventListener('close', () => { if (lenis) lenis.start(); });
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // a click on the backdrop

// ---------------- rooms: the active one (strip + chips) ----------------
const rooms = $$('.v2-room');
const strip = $$('.v2-strip__item');
const stripNav = $('[data-strip]');
document.documentElement.style.setProperty('--rooms', String(rooms.length));
let active = -1;
function setActive(i) {
  if (i === active) return;
  active = i;
  rooms.forEach((r, k) => r.classList.toggle('is-on', k === i));
  strip.forEach((a, k) => { a.classList.toggle('is-on', k === i); if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  const a = strip[i];
  if (a && stripNav.scrollWidth > stripNav.clientWidth + 1) {   // keep the active thumb in view inside the strip, never scroll the page
    const nr = stripNav.getBoundingClientRect(), ar = a.getBoundingClientRect();
    stripNav.scrollBy({ left: (ar.left + ar.width / 2) - (nr.left + nr.width / 2), behavior: reduce.matches ? 'auto' : 'smooth' });
  }
}

// ---------------- the scroll story ----------------
function staticMode() { html.classList.remove('is-motion'); }
async function motion() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reduce.matches) { staticMode(); return; }
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);
  if (window.Lenis && matchMedia('(pointer: fine)').matches) {
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const portrait = () => innerWidth / innerHeight <= 0.8;

  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  if (!JOURNEY) {   // 1. hero (the /v2/ test view only): the title leaves as the camera rises (reference 0.25-3.0 s: a crane up)
    gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 0.8 } })
      .to('[data-hero-media]', { scale: 1.12, yPercent: 10, ease: 'none' }, 0)
      .to('[data-hero-body]', { autoAlpha: 0, y: -48, ease: 'power1.in', duration: 0.45 }, 0)
      .to('.v2-cue', { autoAlpha: 0, duration: 0.2 }, 0);
    if (window.SplitText) {   // split after the display font is in (SplitText measures the words)
      gsap.set('#heroTitle', { autoAlpha: 0 });
      fontsReady.then(() => {
        const st = new window.SplitText('#heroTitle', { type: 'words', wordsClass: 'v2-w' });
        gsap.set('#heroTitle', { autoAlpha: 1 });
        gsap.from(st.words, { yPercent: 60, autoAlpha: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08 });
      });
    }
    gsap.from(['.v2-hero__body .v2-eyebrow', '.v2-hero__lead'], { y: 20, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 0.35 });
  }

  // 2+3. the floor: the number steps up to 16 beside the tower, floor 16 lights, the camera closes in and the rest goes dark
  const frame = $('[data-floor-frame]'), band = $('[data-band]'), num = $('[data-floor-num]'), stage = $('[data-floor-stage]');
  const counter = { n: 1 };
  const zoom = () => (portrait() ? 1.55 : 1.7);
  // the move that brings apartment 846's terrace point toward the target (tx, ty of the stage), clamped so the picture still covers the stage
  const anchor = (s = zoom(), tx = portrait() ? 0.56 : 0.4, ty = portrait() ? 0.62 : 0.56) => {
    const W0 = frame.offsetWidth, H0 = frame.offsetHeight, SW = stage.clientWidth, SH = stage.clientHeight;
    const cs = getComputedStyle(document.body), ax = parseFloat(cs.getPropertyValue('--ax')) / 100, ay = parseFloat(cs.getPropertyValue('--ay')) / 100;
    const restL = (SW - W0) / 2, restT = (SH - H0) / 2, axp = restL + ax * W0, ayp = restT + ay * H0;   // stage px; the scale origin = the anchor
    const L = axp - ax * W0 * s, R = axp + (1 - ax) * W0 * s, T = ayp - ay * H0 * s, B = ayp + (1 - ay) * H0 * s;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    return { dx: clamp(SW * tx - axp, SW - R, -L), dy: clamp(SH * ty - ayp, SH - B, -T) };
  };
  gsap.set(band, { autoAlpha: 0, '--dim': 0 });
  gsap.set('[data-pin]', { autoAlpha: 0, scale: 0.4 });
  gsap.set(['[data-floor-unit]', '[data-floor-facts]'], { autoAlpha: 0, y: 24 });
  gsap.timeline({ scrollTrigger: { trigger: '#floor', start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true } })
    .from('[data-floor-copy]', { autoAlpha: 0, x: () => (portrait() ? 0 : -40), y: () => (portrait() ? 30 : 0), duration: 0.08, ease: 'power2.out' }, 0)
    .to(counter, { n: 16, duration: 0.4, ease: 'power1.inOut', onUpdate: () => { num.textContent = String(Math.round(counter.n)); } }, 0)
    .fromTo(frame, { scale: 1 }, { scale: 1.08, duration: 0.4, ease: 'none' }, 0)
    .to(band, { autoAlpha: 1, '--dim': 0.5, duration: 0.1, ease: 'power2.out' }, 0.4)
    .to('[data-pin]', { autoAlpha: 1, scale: 1, duration: 0.08, ease: 'back.out(2)' }, 0.42)
    .to(['[data-floor-unit]', '[data-floor-facts]'], { autoAlpha: 1, y: 0, duration: 0.1, stagger: 0.04, ease: 'power3.out' }, 0.44)
    // the isolated floor: closer, and everything but floor 16 goes dark (light and crop only; the picture is not altered)
    .to(frame, { scale: zoom, x: () => anchor().dx, y: () => anchor().dy, duration: 0.26, ease: 'power2.inOut' }, 0.56)
    .to(band, { '--dim': 0.9, duration: 0.3, ease: 'power1.inOut' }, 0.56)
    .to('[data-floor-eyebrow]', { autoAlpha: 0, duration: 0.06 }, 0.56)
    // round 2, THE FLY-IN ("last frame first"): one continuous push toward 846's terrace on the hold frame (the anchor to the centre, the
    // lit floor fills the screen, the dark lifts), landing on the walk's first frame — the terrace, looking along the hold camera's own
    // bearing (302 deg). The rooms stage takes over on that same frame. No new render: the hold frame and a flat view of the gated pano.
    .to(['[data-floor-copy]', '.v2-floor .v2-badge', '.v2-scrim--floor', '[data-pin]'], { autoAlpha: 0, duration: 0.05 }, 0.84)
    .to(frame, { scale: () => zoom() * 2.8, x: () => anchor(zoom() * 2.8, 0.5, 0.5).dx, y: () => anchor(zoom() * 2.8, 0.5, 0.5).dy, duration: 0.12, ease: 'power2.in' }, 0.84)
    .to(band, { '--dim': 0.15, duration: 0.1, ease: 'power1.in' }, 0.85)
    .to(band, { autoAlpha: 0, duration: 0.04 }, 0.92)
    .fromTo('[data-flyin]', { autoAlpha: 0, scale: 1.3 }, { autoAlpha: 1, scale: 1, duration: 0.07, ease: 'power2.out' }, 0.92)
    .to({}, { duration: 0.02 }, 0.99);

  // 5. the whole apartment (after the walk, round 2): the cutaway rises out of the dark, its title and the room chips follow, it holds
  gsap.set(['[data-cut-head]', '[data-cut-foot]'], { autoAlpha: 0, y: 18 });
  gsap.timeline({ scrollTrigger: { trigger: '#cutaway', start: 'top top', end: 'bottom bottom', scrub: 1 } })
    .fromTo('.v2-cut__img', { scale: 0.78, autoAlpha: 0, rotate: -2, y: 50 }, { scale: 1, autoAlpha: 1, rotate: 0, y: 0, duration: 0.3, ease: 'power3.out' }, 0)
    .to('[data-cut-head]', { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power2.out' }, 0.2)
    .to('[data-cut-foot]', { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power2.out' }, 0.28)
    .to('.v2-cut__img', { scale: 1.04, duration: 0.6, ease: 'none' }, 0.4);

  // 4. the rooms — ONE WALK (round 2; media/walk.json from tools/make_journey_media.py): each room LANDS looking the way the visitor came
  // in, TURNS (its frame sequence, 6-deg steps of the gated pano) until the next doorway is ahead, and the page PUSHES through it into the
  // next room, which lands looking the same way. Unit = timeline seconds; the section's height follows the walk (U svh per unit).
  const N = rooms.length;
  const media = rooms.map((r) => $('[data-room-media]', r));
  const caps = rooms.map((r) => $('[data-room-cap]', r));
  const roomsStage = $('[data-rooms-stage]');
  const W = await walkData();
  const seq = W ? rooms.map((r) => W.rooms.find((x) => x.id === r.dataset.room) || null) : [];
  const walk = Boolean(W) && seq.every(Boolean);
  gsap.set(rooms, { autoAlpha: 0 });
  gsap.set(rooms[0], { autoAlpha: 1 });
  gsap.set(caps, { autoAlpha: 0, y: 26 });
  gsap.set(stripNav, { autoAlpha: 0, y: 30 });
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  const at = [];   // the timeline time at which room i has landed
  let t = 0;
  for (let i = 0; i < N; i++) {
    at.push(t);
    if (i === 0) tl.to(stripNav, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.25);
    tl.to(caps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, t + 0.2);
    const turnU = walk ? Math.max(0.5, Math.abs(seq[i].turn_deg) / 55) : 1;
    const f = { v: 0 };
    if (walk && seq[i].frames > 1) tl.to(f, { v: seq[i].frames - 1, duration: turnU, ease: 'power1.inOut', onUpdate: () => drawFrame(i, f.v) }, t + 0.45);
    else tl.to(media[i], { scale: 1.06, duration: turnU }, t + 0.45);                 // no walk data: the slow drift of round 1
    const x = t + 0.45 + turnU;                                                       // the push through the doorway (it is ahead now)
    if (i === N - 1) { t = x + 0.4; break; }
    tl.to(caps[i], { autoAlpha: 0, y: -16, duration: 0.2 }, x)
      .to(media[i], { scale: 1.55, duration: 0.6, ease: 'power2.in' }, x)
      .to(rooms[i], { autoAlpha: 0, duration: 0.3, ease: 'power1.in' }, x + 0.32)
      .fromTo(rooms[i + 1], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.out' }, x + 0.3)
      .fromTo(media[i + 1], { scale: 1.18 }, { scale: 1, duration: 0.55, ease: 'power2.out' }, x + 0.3);
    t = x + 0.6;
  }
  tl.to({}, { duration: 0.01 }, t);
  const total = tl.duration();
  const U = portrait() ? 30 : 34;                                                    // svh of scroll per timeline unit
  $('#rooms').style.setProperty('--rooms-h', `calc(${(total * U).toFixed(1)}svh + 100svh)`);
  const roomsST = ScrollTrigger.create({
    trigger: '#rooms', start: 'top top', end: 'bottom bottom', scrub: 0.5, animation: tl,
    onEnter: () => roomsStage.classList.add('is-pinned'), onLeaveBack: () => roomsStage.classList.remove('is-pinned'),
    onUpdate: (self) => { const now = self.progress * total; let k = 0; for (let i = 0; i < N; i++) if (now >= at[i] + 0.1) k = i; setActive(k); want(k); },
  });
  ScrollTrigger.create({ trigger: '#floor', start: '55% bottom', once: true, onEnter: () => { want(0); } });   // the walk's first frames before the fly-in lands
  ScrollTrigger.refresh();   // the rooms section's height was just set from the walk
  const goTo = (i) => {
    const y = roomsST.start + (roomsST.end - roomsST.start) * Math.min(1, (at[i] + 0.3) / total);
    if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: 'smooth' });
  };

  // the walk's frames: loaded per room when it is next (k and k+1), drawn cover-fit on the room's canvas; until a room's frames are in,
  // its picture (the view picked by eye) stays
  const ORI = portrait() ? 't' : 'w';
  const frames = rooms.map(() => null);
  const lastF = rooms.map(() => 0);
  const canv = rooms.map((r) => $('canvas.v2-room__walk', r));
  function want(k) { for (const i of [k, k + 1]) if (walk && i < N && !frames[i]) loadRoom(i); }
  function loadRoom(i) {
    const r = seq[i]; frames[i] = [];
    for (let k = 0; k < r.frames; k++) {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => { if (k === 0) rooms[i].classList.add('is-walk'); sizeCanvas(i); drawFrame(i, lastF[i]); };
      im.src = `media/${r.dir}/${ORI}-${String(k).padStart(2, '0')}.webp`; frames[i].push(im);
    }
  }
  function sizeCanvas(i) {
    const c = canv[i], d = Math.min(devicePixelRatio || 1, 1.5), w = Math.round(roomsStage.clientWidth * d), h = Math.round(roomsStage.clientHeight * d);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }
  function drawFrame(i, v) {
    lastF[i] = v; const list = frames[i]; if (!list) return;
    const k = Math.round(v); const ok = (im) => im && im.complete && im.naturalWidth;
    let im = list[k];
    for (let d = 1; !ok(im) && d < list.length; d++) im = ok(list[k - d]) ? list[k - d] : ok(list[k + d]) ? list[k + d] : null;
    if (!ok(im)) return;
    const c = canv[i], ctx = c.getContext('2d'), s = Math.max(c.width / im.naturalWidth, c.height / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.drawImage(im, (c.width - w) / 2, (c.height - h) / 2, w, h);
  }
  addEventListener('resize', () => { rooms.forEach((_, i) => { if (frames[i]) { sizeCanvas(i); drawFrame(i, lastF[i]); } }); });
  $$('[data-goto]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goTo(Number(a.dataset.goto)); }));

  // 6. the way on
  if (window.SplitText) fontsReady.then(() => {
    const st = new window.SplitText('#goTitle', { type: 'words', wordsClass: 'v2-w' });
    gsap.from(st.words, { yPercent: 50, autoAlpha: 0, stagger: 0.06, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: '#go', start: 'top 70%' } });
  });
  gsap.fromTo('.v2-go__media', { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '#go', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  gsap.from('.v2-go__ctas > *', { y: 20, autoAlpha: 0, stagger: 0.08, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: '#go', start: 'top 60%' } });

  addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

  // the journey's opening (reference 3.5-5.75 s: the floor number runs up beside the tower by itself): entered from the hold, the page
  // opens on the hold's own frame and plays the floor reveal up to «16 · דירה 846» on its own; any wheel, touch or key hands the scroll
  // back to the visitor at once. Not when the page is restored mid-way (back/forward) or under reduced motion (no motion() at all).
  let reveal = null;
  const stopReveal = () => {
    if (!reveal) return;
    reveal.kill();
    if (lenis) { lenis.stop(); lenis.start(); }   // stops Lenis' own scrollTo where it is
    reveal = null;
  };
  if (JOURNEY) {
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((ev) => addEventListener(ev, stopReveal, { passive: true }));
    const go = () => {
      if (scrollY > 10) return;
      const f = $('#floor'), y = Math.round(f.offsetTop + (f.offsetHeight - innerHeight) * 0.5);
      if (lenis) { reveal = { kill: () => {} }; lenis.scrollTo(y, { duration: 3.2, easing: (k) => 1 - Math.pow(1 - k, 3), onComplete: () => { reveal = null; } }); }
      else { const p = { y: scrollY }; reveal = gsap.to(p, { y, duration: 3.2, ease: 'power2.inOut', onUpdate: () => window.scrollTo(0, p.y), onComplete: () => { reveal = null; } }); }
    };
    const start = () => fontsReady.then(() => setTimeout(go, 700));
    if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
  }
  window.__v2 = { lenis, tl, roomsST, at, total, goTo, walk, get revealing() { return Boolean(reveal); } };
}

// the walk's data (media/walk.json); null = the round-1 crossfade
async function walkData() { try { const r = await fetch('media/walk.json', { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; } }

// static mode: the strip is hidden; chips jump to the room blocks with a plain anchor (no JS needed); the first room is "on"
setActive(0);
reduce.addEventListener?.('change', () => location.reload());
if (html.classList.contains('is-motion')) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', motion, { once: true }); else motion();
}
loadData().catch((e) => console.warn('v2: project data not loaded; the in-page facts and links stay', e));

// flow.html controller: project -> start tap -> segments (video/still) -> hotspots -> unit card
// -> descend-<unit> -> enter-<unit> -> hand-off to the apartment tour.
// The apartment pills, the unit card, the units drawer and their analytics are js/picker.js (shared with habait-89's
// :8899 hold); this file keeps the flight: segments, navigation hotspots, descend/enter, hand-off.
import { loadProject, applyBrand } from './config.js';
import { Viewer360, webglAvailable } from './viewer360.js';
import { getLang, setLang, t, pick, applyI18n } from './i18n.js';
import * as i18n from './i18n.js';
import { initAnalytics, capture, setBaseProps, sessionId } from './analytics.js';
import * as analytics from './analytics.js';
import { createPicker } from './picker.js';

const $ = (id) => document.getElementById(id);
const els = {
  viewer: $('viewer'), hotspots: $('hotspots'), video: $('video'), preload: $('preload'),
  segTitle: $('segTitle'), gyroBtn: $('gyroBtn'), unitsBtn: $('unitsBtn'), langToggle: $('langToggle'),
  brandLogo: $('brandLogo'), brandName: $('brandName'), progressBar: $('progressBar'), toFacadeBtn: $('toFacadeBtn'), hint: $('hint'),
  startOverlay: $('startOverlay'), startLogo: $('startLogo'), startTitle: $('startTitle'), startTagline: $('startTagline'), startBtn: $('startBtn'), fixtureNote: $('fixtureNote'),
  handoffOverlay: $('handoffOverlay'), handoffTitle: $('handoffTitle'), handoffSub: $('handoffSub'), handoffLink: $('handoffLink'), handoffBack: $('handoffBack'),
  toast: $('toast'), loading: $('loading'),
  stage: $('stage'), hudActions: document.querySelector('.hud-actions'), // card 36: the cinematic layer + the sound button
};

const state = {
  ctx: null,            // loaded project
  viewer: null,
  seg: null,            // current segment
  segStarted: 0,        // performance.now() at the start of a still segment
  stillTimer: null,
  selectedUnit: null,   // unit the buyer chose (for descend/enter/handoff)
  placeholderFlight: false,
  started: false,
  picker: null,         // js/picker.js: unit pills + card + drawer (the card unit is picker.cardUnit)
  navMarkers: new Map(), // nav hotspot id -> button
  real: null,           // card 34: the real flight (?real=1): segments.json, video pool, tour iframe, log
  activeVideo: null,    // card 34: the pool video of the current segment (real flight)
  captionKey: '',       // card 34: what the caption band/overlay show now
  cine: null,           // card 36: js/cine.js (the default flight when fixtures/<id>/flow.cine.json exists)
  cineFlow: null,       // card 36: flow.cine.json
};

function toast(msg, ms = 2600) {
  els.toast.textContent = msg; els.toast.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { els.toast.hidden = true; }, ms);
}

// ---------------- boot ----------------
async function boot() {
  const id = new URLSearchParams(location.search).get('project');
  if (!id) { showFatal(t('err.noProject')); return; }
  if (!webglAvailable()) { showFatal(t('err.webgl')); return; }
  setLang(getLang());
  try {
    state.ctx = await loadProject(id);
  } catch (e) { console.error(e); showFatal(`${t('err.load')}: ${e.message}`); return; }
  const { ctx } = state;
  initAnalytics({ base: { project: ctx.id, lang: getLang() }, config: ctx.meta.analytics || {} }); // card 24: project.json analytics block
  capture('project_open', { from: 'flow', fixture: !!ctx.meta.fixture });
  // card 36: the cinematic flight by default (flat photoreal clips + the draggable hold); ?mode=360 / ?real=1 = card 34's 360 flight,
  // ?real=0 = the placeholder fixture. A missing/invalid flow.cine.json falls back to card 34's flight, then to the placeholder.
  if (MODE === 'cine') state.cineFlow = await loadCineFlow(ctx).catch((e) => { console.warn('[flow] cinematic flight unavailable, 360 flight:', e.message); return null; });
  // card 34: ?real=1 swaps the placeholder fixture for the real segments; anything missing keeps the placeholder flight
  if (REAL_WANTED && !state.cineFlow) state.real = await loadReal(ctx).catch((e) => { console.warn('[flow] real flight unavailable, placeholder flight:', e.message); return null; });

  applyBrand(ctx.meta, ctx.dir, { logoEls: [els.brandLogo, els.startLogo], nameEls: [els.brandName] });
  document.title = `${pick(ctx.meta.name)} · Habait`;
  els.fixtureNote.hidden = !ctx.meta.fixture;
  state.picker = makePicker();
  buildCaption(); // card 34: legal caption v1 on every screen
  renderStatic();

  state.viewer = new Viewer360(els.viewer);
  state.viewer.onFrame = onFrame;
  if (Viewer360.gyroAvailable()) els.gyroBtn.hidden = false;

  if (!state.real && !state.cineFlow) {
    // show the first frame (poster or still) behind the start overlay
    const first = ctx.segById.get(ctx.flow.start);
    const poster = first.kind === 'still' ? first.src : first.poster;
    if (poster) state.viewer.setImage(ctx.asset(poster)).catch(() => {});
    // warm the first video
    if (first.kind === 'video') { els.video.src = ctx.asset(first.src); els.video.load(); }
  }

  wireUI();

  // dev/test hooks: ?autostart=1 skips the start tap (muted autoplay), ?seg=<id> starts at a segment,
  // ?yaw=&pitch= sets the initial view. window.__habait exposes state for browser tests.
  const q = new URLSearchParams(location.search);
  if (q.has('yaw') || q.has('pitch')) state.viewer.lookAt(Number(q.get('yaw') || 0), Number(q.get('pitch') || 0));
  window.__habait = { state, startSegment, openCard, enterUnit, segmentTime, activeHotspots, picker: state.picker, mode: state.cineFlow ? 'cine' : state.real ? '360' : 'placeholder' };
  if (state.cineFlow) { await bootCine(); return; } // card 36
  if (state.real) { Object.assign(window.__habait, { real: state.real, viewYaw, tourFov }); await bootReal(); return; }
  if (q.get('autostart') === '1') {
    const segId = q.get('seg');
    await start(segId && ctx.segById.has(segId) ? ctx.segById.get(segId) : undefined);
  }
}

function showFatal(msg) {
  els.startOverlay.hidden = false;
  els.startTitle.textContent = msg;
  els.startBtn.hidden = true;
  els.startTagline.textContent = '';
}

function renderStatic() {
  const { ctx } = state;
  applyI18n(document);
  els.langToggle.textContent = getLang() === 'he' ? 'EN' : 'עב';
  els.startTitle.textContent = pick(ctx.meta.name);
  els.startTagline.textContent = pick(ctx.meta.tagline);
  els.brandName.textContent = pick(ctx.meta.name);
  if (state.seg) els.segTitle.textContent = pick(state.seg.title) || state.seg.id;
  els.hint.textContent = state.seg?.role === 'hold' ? t('hud.hintHold') : t('hud.hint');
  if (state.cine) { state.cine.setLang(); els.hint.textContent = state.seg?.role === 'hold' ? state.cine.hint() : ''; } // card 36: no drag on a flat clip
  // the card and the drawer are re-labelled by picker.setLang()
  if (!els.handoffOverlay.hidden && state.selectedUnit) renderHandoff(state.selectedUnit);
  updateCaption(true);
}

function wireUI() {
  const { viewer, picker } = state;
  els.langToggle.addEventListener('click', () => { picker.setLang(getLang() === 'he' ? 'en' : 'he'); setBaseProps({ lang: getLang() }); renderStatic(); });
  els.startBtn.addEventListener('click', start);
  els.unitsBtn.addEventListener('click', () => picker.toggleDrawer());
  els.toFacadeBtn.addEventListener('click', () => { const hold = holdSegment(); if (hold) { picker.closeCard(); els.handoffOverlay.hidden = true; startSegment(hold); } });
  els.handoffBack.addEventListener('click', () => { els.handoffOverlay.hidden = true; const hold = holdSegment(); if (hold) startSegment(hold); });
  els.handoffLink.addEventListener('click', () => capture('tour_handoff', { unit: state.selectedUnit?.id, tour_url: els.handoffLink.href }));
  els.gyroBtn.addEventListener('click', async () => {
    if (viewer.gyro) { viewer.disableGyro(); els.gyroBtn.classList.remove('on'); return; }
    try { await viewer.enableGyro(); els.gyroBtn.classList.add('on'); toast(t('toast.gyroOn')); }
    catch { toast(t('toast.gyroDenied')); }
  });
  els.video.addEventListener('ended', () => { if (state.seg?.kind === 'video' && !state.seg.loop) onSegmentEnd(); });
  els.video.addEventListener('waiting', () => { els.loading.hidden = false; });
  els.video.addEventListener('playing', () => { els.loading.hidden = true; });
  els.video.addEventListener('error', () => { console.error('video error', els.video.error); els.loading.hidden = true; toast(`video: ${els.video.error?.message || 'error'}`); });
  // close sheet when tapping the panorama (not a drag); Escape (card + drawer) is handled by the picker
  els.viewer.addEventListener('pointerup', () => { if ((viewer.lastDragMoved || 0) < 6 && picker.isCardOpen() && state.seg?.role !== 'hold') picker.closeCard(); });
}

// ---------------- apartments: js/picker.js ----------------
function makePicker() {
  const { ctx } = state;
  return createPicker({
    units: ctx.units,
    container: document.body,
    layer: els.hotspots,          // shares the hotspot layer with the navigation markers
    chrome: false,                // flow.html has its own HUD (segment title, hint, units button)
    i18n, analytics,
    project: { ...ctx.meta, id: ctx.id },
    onEnter: enterFlight,
    onSelect: (u, from) => { if (from === 'list') showFromList(u); },
    onTour: (u) => { state.selectedUnit = u; },
    canEnter: (u) => !!ctx.unitSegment(u, 'descend').segment,
    cardNote: (u) => (ctx.unitSegment(u, 'descend').placeholder ? t('unit.placeholder') : ''),
    enterProps: (u) => { const { segment, placeholder } = ctx.unitSegment(u, 'descend'); return { descend: segment?.id || null, placeholder }; },
    context: () => ({ segment: state.seg?.id }),
  });
}

// a unit picked in the drawer: jump to the hold segment and look at the unit (the picker then opens its card)
function showFromList(u) {
  if (state.cine) { state.cine.showUnit(u); return; } // card 36: every unit with a box is on the hold's frames
  const hold = holdSegment();
  const hs = state.real ? (hold && realUnitHotspot(u, hold)) : u.hotspots.find((h) => hold && h.segment === hold.id);
  if (hold && state.seg !== hold) startSegment(hold);
  if (hs) state.viewer.lookAt(hs.yaw_deg, hs.pitch_deg);
}

// test/debug hooks with the pre-picker names
function openCard(unit, from) { return state.picker.select(unit.id ?? unit, from); }
function enterUnit(unit) { return state.picker.enter(unit.id ?? unit); }

// ---------------- flight ----------------
async function start(firstSeg) {
  if (state.started) return;
  state.started = true;
  els.startOverlay.hidden = true;
  // iOS: the first play() must happen inside this tap; also unlock the preload element
  try { els.video.muted = true; await els.video.play(); els.video.pause(); } catch { /* fine: play again per segment */ }
  try { els.preload.muted = true; els.preload.play().then(() => els.preload.pause()).catch(() => {}); } catch { /* ignore */ }
  const seg = (firstSeg && firstSeg.id) ? firstSeg : state.ctx.segById.get(state.ctx.flow.start);
  capture('flight_start', { start: seg.id });
  return startSegment(seg);
}

function holdSegment() {
  const { ctx } = state;
  return ctx.flow.segments.find((s) => s.role === 'hold') || ctx.segById.get('hold-facade') || null;
}

async function startSegment(seg) {
  if (state.cine) return state.cine.startSegment(seg); // card 36
  if (state.real) return startSegmentReal(seg); // card 34
  const { ctx, viewer } = state;
  clearTimeout(state.stillTimer);
  state.seg = seg;
  state.picker.resetHover();
  els.segTitle.textContent = pick(seg.title) || seg.id;
  els.hint.textContent = seg.role === 'hold' ? t('hud.hintHold') : t('hud.hint');
  els.toFacadeBtn.hidden = seg.role === 'hold' || seg.role === 'approach';
  els.progressBar.style.width = '0%';
  capture('segment_start', { segment: seg.id, kind: seg.kind, role: seg.role || null, unit: seg.unit || null, placeholder: state.placeholderFlight && (seg.role === 'descend' || seg.role === 'enter') });

  if (seg.kind === 'video') {
    const src = ctx.asset(seg.src);
    els.loading.hidden = false;
    if (!els.video.src.endsWith(src.replace(/^\.\//, ''))) { els.video.src = src; els.video.load(); }
    els.video.loop = !!seg.loop;
    els.video.currentTime = 0;
    viewer.setVideo(els.video);
    try { await els.video.play(); }
    catch (e) {
      console.warn('autoplay blocked', e);
      els.loading.hidden = true;
      // fallback: the poster as a still, with a one-tap resume
      if (seg.poster) viewer.setImage(ctx.asset(seg.poster)).catch(() => {});
      toast('tap to play');
      const resume = () => { els.video.play().then(() => viewer.setVideo(els.video)).catch(() => {}); els.viewer.removeEventListener('pointerup', resume); };
      els.viewer.addEventListener('pointerup', resume);
    }
  } else {
    els.loading.hidden = false;
    try { await viewer.setImage(ctx.asset(seg.src)); } catch (e) { console.error(e); toast(e.message); }
    els.loading.hidden = true;
    if (state.seg !== seg) return; // superseded while loading
    state.segStarted = performance.now();
    if (!seg.loop) state.stillTimer = setTimeout(() => { if (state.seg === seg) onSegmentEnd(); }, seg.duration_s * 1000);
  }
  preloadNext(seg);
}

function preloadNext(seg) {
  const { ctx } = state;
  let nextId = typeof seg.next === 'string' && ctx.segById.has(seg.next) ? seg.next : null;
  if (!nextId && seg.role === 'hold') nextId = ctx.flow.defaults?.descend || null;
  const next = nextId ? ctx.segById.get(nextId) : null;
  if (!next) return;
  if (next.kind === 'still') { const im = new Image(); im.src = ctx.asset(next.src); }
  else { els.preload.src = ctx.asset(next.src); els.preload.load(); }
}

function segmentTime() {
  const seg = state.seg;
  if (!seg) return 0;
  if (state.cine) return window.__cine?.videoTime || 0; // card 36
  if (seg.kind === 'video') return (state.real ? state.activeVideo?.currentTime : els.video.currentTime) || 0;
  const tt = (performance.now() - state.segStarted) / 1000;
  return seg.loop ? tt % seg.duration_s : Math.min(tt, seg.duration_s);
}

function onSegmentEnd() {
  const { ctx } = state;
  const seg = state.seg;
  if (!seg) return;
  if (seg.next === null || seg.next === undefined) return;        // stay (loop)
  if (seg.next === 'handoff') { showHandoff(); return; }
  if (seg.next === 'end') { toast(t('end.title')); return; }
  const next = ctx.segById.get(seg.next);
  if (next) startSegment(next);
}

// ---------------- hotspots ----------------
// the unit's hotspot on segment `segId` at time `now` (the last one wins if windows overlap)
function activeUnitHotspot(u, segId, now) {
  let hit = null;
  for (const h of u.hotspots) if (h.segment === segId && now >= h.t_start && now <= h.t_end) hit = h;
  return hit;
}

function activeHotspots() {
  const { ctx } = state;
  const seg = state.seg;
  if (!seg) return [];
  const now = segmentTime();
  const out = [];
  for (const u of ctx.units.units) {
    const h = state.real ? realUnitHotspot(u, seg) : activeUnitHotspot(u, seg.id, now);
    if (h) out.push({ key: `u:${u.id}`, kind: 'unit', unit: u, h });
  }
  for (const h of seg.hotspots || []) {
    if (now >= h.t_start && now <= h.t_end) out.push({ key: `n:${h.id}`, kind: 'nav', nav: h, h });
  }
  return out;
}

function onFrame() {
  if (state.cine) return; // card 36: js/cine.js drives the pills; the 360 viewer only carries the hand-off bridge
  const seg = state.seg;
  if (!seg) return;
  const now = segmentTime();
  els.progressBar.style.width = `${Math.min(100, (now / seg.duration_s) * 100)}%`;

  // apartments: the picker places one pill per unit whose hotspot is active now (null = not in this shot)
  const pos = {};
  updateCaption(false); // card 34: the caption variant follows the segment and its time
  if (state.real) realFrame(seg, now);
  state.picker.update((u) => {
    const h = state.real ? realUnitHotspot(u, seg) : activeUnitHotspot(u, seg.id, now);
    if (!h) return null;
    state.viewer.project(h.yaw_deg, h.pitch_deg, pos);
    if (state.real && seg.role === 'hold' && seg.kind === 'video') { const q = steadyPill(u.id, pos.x, pos.y); return { x: q.x, y: q.y, visible: pos.visible }; }
    return { x: pos.x, y: pos.y, visible: pos.visible };
  });

  // navigation hotspots of the segment (skip / goto)
  const seen = new Set();
  for (const h of seg.hotspots || []) {
    if (!(now >= h.t_start && now <= h.t_end)) continue;
    seen.add(h.id);
    let el = state.navMarkers.get(h.id);
    if (!el) { el = makeNavMarker(h); state.navMarkers.set(h.id, el); els.hotspots.appendChild(el); }
    state.viewer.project(h.yaw_deg, h.pitch_deg, pos);
    // position with left/top; the CSS transform only centres (and animates) the marker
    el.style.left = `${pos.x.toFixed(1)}px`;
    el.style.top = `${pos.y.toFixed(1)}px`;
    el.style.display = pos.visible ? '' : 'none';
  }
  for (const [id, el] of state.navMarkers) if (!seen.has(id)) { el.remove(); state.navMarkers.delete(id); }
}

function makeNavMarker(nav) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'hotspot pulse nav';
  el.textContent = pick(nav.label) || nav.id;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (nav.action.type === 'goto') startSegment(state.ctx.segById.get(nav.action.segment));
    else onSegmentEnd();
  });
  el.addEventListener('pointerdown', (e) => e.stopPropagation()); // don't start a drag from a marker
  setTimeout(() => el.classList.remove('pulse'), 400);
  return el;
}

// ---------------- entering a unit (the card's "continue", via picker onEnter) ----------------
// the picker has already sent unit_enter (with descend/placeholder from enterProps) and closed the card
function enterFlight(u) {
  const { ctx } = state;
  const { segment, placeholder } = ctx.unitSegment(u, 'descend');
  state.selectedUnit = u;
  state.placeholderFlight = placeholder;
  if (!segment) { showHandoff(); return; }
  if (placeholder) toast(t('unit.placeholder'), 3500);
  startSegment(segment);
}

// ---------------- hand-off ----------------
function showHandoff() {
  if (state.cine) return; // card 36: js/cine.js bridges into the tour itself
  if (state.real) { handoffReal(); return; } // card 34: no card, the tour opens in place
  const u = state.selectedUnit;
  if (!u) return;
  renderHandoff(u);
  els.handoffOverlay.hidden = false;
}
function renderHandoff(u) {
  els.handoffTitle.textContent = t('handoff.title', { unit: u.id });
  els.handoffSub.textContent = t('handoff.sub');
  const url = new URL(u.tour_url, location.href);
  url.searchParams.set('from', 'flight');
  url.searchParams.set('sid', sessionId());
  els.handoffLink.href = url.toString();
}

// =====================================================================================================================
// card 34 (2026-11-03): the legal caption v1 on every screen, and the real flight (?real=1)
// =====================================================================================================================
// flow.html?project=<id>&real=1 loads fixtures/<id>/flow.real.json and the segments.json next to its videos
// (_local/segments/<id>/, both written by tools/build_segments.mjs) and plays the Cycles segments instead of the placeholders:
//  - no start modal, no spinner: frame 1 of the first segment is up at once and the muted inline video starts when it can
//    play through; a blocked autoplay (iOS low-power mode) gets a small tap chip over the frame, not a modal;
//  - the next segment is buffered behind the current one, and the texture swaps only once its first frame is decoded, so the
//    previous segment's last frame (or the hold still) stays up meanwhile; segments sharing a pose start on that frame
//    (segments.json junction seam_mae); the viewer's yaw is never reset (it is relative to the camera heading, which is
//    continuous in camera.json), so a segment change never turns the buyer;
//  - unit pills on the hold come from card 19's hotspots in segments.json (visible_frac >= hotspot_min_visible), not units.json;
//    on arrival the hold eases the view (a few degrees, ~1 s, cancelled by a drag) so the pills are centred and stacked floors
//    are far enough apart to tap; the descent eases the field of view back;
//  - the hold may be a looping clip (hold-facade, 72 frames): pills follow card 19 per frame (shown once its first frame is up,
//    held still under a finger), the loop pauses while the unit card is open, and "continue" settles it on its rest frame
//    (mirror seek + 2x, <= 0.75 s) so the descent starts frame to frame;
//  - the hand-off opens the apartment tour in place: an iframe created when the descent starts (cache warm), shown once the
//    tour has painted the room at the buyer's yaw (tour yaw = viewer yaw + handoff.tour_yaw_offset_deg; pitch and field of
//    view eased to the tour's in the last second of enter) over enter's last frame, which is that room's panorama.
// Caption (caption-v1.json usage): a fixed band with `micro` on every screen; `short_project` over the stage at the start,
// on the approach and on the hold, and for the first 3 s of the descent; `short` (unit filled) for the first 3 s of enter.
// The placeholder flight (no ?real) shows the project caption (project.json disclaimer = short_project v1) in the band.
const QS = new URLSearchParams(location.search);
// card 36: which flight. ?mode=cine|360 wins; ?real=1 (card 34's links and its tour return URL) = the 360 flight; ?real=0 = the
// placeholder fixture (test/browser.mjs); nothing = the cinematic flight (falls back to 360 when flow.cine.json is missing)
const MODE = (() => { const m = QS.get('mode'); if (m === 'cine' || m === '360') return m; if (QS.get('real') === '0') return 'placeholder'; if (QS.get('real') === '1') return '360'; return 'cine'; })();
const REAL_WANTED = MODE !== 'placeholder'; // real flight by default (card 34, 2026-11-03); ?real=0 keeps the placeholder fixture (test/browser.mjs)
const wrap180 = (d) => { const r = ((((d + 180) % 360) + 360) % 360) - 180; return r === -180 ? 180 : r; };
const smooth01 = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const CAPTION_OPENING_S = 3; // caption-v1 usage.video_overlay: an opening caption of >= 3 s
const DEFAULT_FOV = 75;       // Viewer360's default vertical fov
const PILL_GAP_PX = 36;       // the hold framing keeps stacked floors >= max(this, 1.4 pill heights) apart: picker.js staggers
                              // pills closer than 1.2 heights (made for a row of bays; on a column of floors it stacks them)

async function getJSONx(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

// ---------------- caption ----------------
function buildCaption() {
  if (!document.querySelector('link[data-flow-real]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = 'css/flow-real.css'; l.dataset.flowReal = '1';
    document.head.appendChild(l);
  }
  const over = document.createElement('div');
  over.id = 'legalOverlay'; over.className = 'legal-overlay'; over.hidden = true;
  const band = document.createElement('div');
  band.id = 'legalBand'; band.className = 'legal-band'; band.setAttribute('role', 'note');
  document.body.append(over, band);
  document.body.classList.add('has-legal');
  const setH = () => { if (band.offsetHeight) document.documentElement.style.setProperty('--caption-h', `${band.offsetHeight}px`); };
  new ResizeObserver(setH).observe(band);
  els.legalBand = band; els.legalOverlay = over;
}

function captionState() {
  if (state.cine) return state.cine.captionState(); // card 36: same caption-v1 rules, on the cinematic segments
  const R = state.real;
  if (!R) return { band: pick(state.ctx.meta.disclaimer) || '', over: '', variant: null };
  const c = R.meta.caption?.[getLang() === 'en' ? 'en' : 'he'] || {};
  const seg = state.seg;
  const now = seg ? segmentTime() : 0;
  // caption-v1 usage: every clip opens with its caption for >= 3 s (short_project outside, short for the clip that ends inside
  // the apartment), the hold carries short_project all along, micro stays in the band everywhere
  let variant = null;
  if (R.tourShown) variant = null;                                // the tour: the band only (the tour carries its own line)
  else if (!seg || seg.role === 'hold') variant = 'short_project'; // before the start, and the hold
  else if (seg.role === 'enter') variant = now < CAPTION_OPENING_S ? 'short' : null;
  else variant = now < CAPTION_OPENING_S ? 'short_project' : null; // approach, orbit, descend
  const unit = seg?.unit || state.selectedUnit?.id || '';
  const fill = (s) => String(s || '').replace(/\{UNIT\}/g, unit);
  return { band: fill(c.micro), over: variant ? fill(c[variant]) : '', variant };
}

function updateCaption(force) {
  if (!els.legalBand) return;
  const st = captionState();
  const lang = getLang();
  const key = `${lang}|${st.variant}|${st.band}|${st.over}`;
  if (!force && key === state.captionKey) return;
  state.captionKey = key;
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  els.legalBand.textContent = st.band; els.legalBand.dir = dir; els.legalBand.lang = lang;
  els.legalOverlay.textContent = st.over; els.legalOverlay.dir = dir; els.legalOverlay.lang = lang;
  els.legalOverlay.hidden = !st.over;
  els.legalOverlay.dataset.variant = st.variant || '';
}

// ---------------- loading the real flight ----------------
async function loadReal(ctx) {
  const flow = await getJSONx(`${ctx.dir}/flow.real.json`);
  const firstVideo = flow.segments.find((s) => s.kind === 'video');
  if (!firstVideo) throw new Error('flow.real.json has no video segment');
  const meta = await getJSONx(new URL('segments.json', new URL(ctx.asset(firstVideo.src), location.href)).href);
  if (meta.project !== ctx.id) throw new Error(`segments.json is for "${meta.project}"`);
  const byId = new Map(meta.segments.map((s) => [s.id, s]));
  for (const s of flow.segments) if (!byId.has(s.id)) throw new Error(`segments.json lacks "${s.id}"`);
  // swap the flight in place: config.js's unitSegment() closes over ctx.flow and ctx.segById
  for (const k of Object.keys(ctx.flow)) delete ctx.flow[k];
  Object.assign(ctx.flow, flow);
  ctx.segById.clear();
  for (const s of flow.segments) ctx.segById.set(s.id, s);
  return { meta, byId, videos: new Map(), images: new Map(), log: [], tour: null, tourShown: false, ease: null, viewEase: null, holdFrame: null, settling: false, chip: null, overlaysSeen: [] };
}

async function bootReal() {
  const { ctx, viewer, real: R } = state;
  document.body.classList.add('real-flight');
  els.startOverlay.hidden = true;   // no start modal: muted inline video may autoplay; a blocked autoplay gets a chip
  els.fixtureNote.hidden = true;
  els.loading.hidden = true;        // never a spinner: a segment that is not ready keeps the previous frame up
  window.addEventListener('message', onTourMessage);
  const segId = QS.get('seg');
  const first = segId && ctx.segById.has(segId) ? ctx.segById.get(segId) : ctx.segById.get(ctx.flow.start);
  const iv = R.meta.initial_view;
  if (iv && !QS.has('yaw') && !QS.has('pitch')) viewer.lookAt(iv.yaw, iv.pitch); // the director's framing of frame 1
  const poster = first.kind === 'still' ? first.src : first.poster;
  if (poster) await viewer.setImage(ctx.asset(poster)).catch((e) => console.warn('[flow] poster', e.message));
  updateCaption(true);
  if (first.kind === 'video') await canPlayThrough(realVideo(first), 6000);
  state.started = true;
  capture('flight_start', { start: first.id });
  return startSegment(first);
}

function canPlayThrough(v, ms) {
  return new Promise((ok) => {
    if (v.readyState >= 4) { ok(true); return; }
    const timer = setTimeout(() => ok(false), ms);
    v.addEventListener('canplaythrough', () => { clearTimeout(timer); ok(true); }, { once: true });
  });
}

// one <video> per segment, kept in the render tree (invisible) so frame callbacks fire and iOS decodes
function realVideo(seg) {
  const R = state.real;
  let v = R.videos.get(seg.id);
  if (v) return v;
  v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.playsInline = true;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
  v.preload = 'auto'; v.crossOrigin = 'anonymous';
  v.className = 'flow-pool-video';
  v.style.cssText = 'position:absolute;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  v.dataset.seg = seg.id;
  v.src = state.ctx.asset(seg.src);
  v.addEventListener('ended', () => { if (state.seg === seg && !seg.loop) onSegmentEnd(); });
  v.addEventListener('error', () => console.error('[flow] video error', seg.id, v.error?.message || v.error?.code));
  els.viewer.parentNode.appendChild(v);
  v.load();
  R.videos.set(seg.id, v);
  return v;
}

// buffer a segment behind the current one
function warm(seg) {
  if (!seg) return;
  const R = state.real;
  if (seg.kind === 'still') {
    if (!R.images.has(seg.id)) { const im = new Image(); im.src = state.ctx.asset(seg.src); R.images.set(seg.id, im); }
    return;
  }
  const v = realVideo(seg);
  if (v.dataset.warm) return;
  v.dataset.warm = '1';
  // iOS Safari buffers a media element only once it has played: muted inline play() + pause() needs no gesture
  const p = v.play();
  if (p && p.then) p.then(() => { if (state.seg?.id !== seg.id) { v.pause(); try { v.currentTime = 0; } catch { /* ignore */ } } }).catch(() => {});
}

function warmNext(seg) {
  const { ctx } = state;
  if (typeof seg.next === 'string' && ctx.segById.has(seg.next)) warm(ctx.segById.get(seg.next));
  if (seg.role === 'hold') {
    const d = ctx.flow.defaults?.descend; // the descent a buyer most likely picks (each unit's own is warmed when its card opens)
    if (d && ctx.segById.has(d)) warm(ctx.segById.get(d));
  }
  if (seg.role === 'descend') prepareTour();
}

// resolves once the video has a decoded frame on screen-ready (frame callback, or time moving)
function firstFrame(v) {
  return new Promise((ok) => {
    let done = false;
    const fin = () => { if (!done) { done = true; v.removeEventListener('timeupdate', tu); ok(); } };
    const tu = () => { if (v.currentTime > 0) fin(); };
    if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(fin);
    v.addEventListener('timeupdate', tu);
  });
}

function playReal(v) {
  const p = v.play();
  if (p && p.catch) p.catch((e) => { if (e && e.name === 'NotAllowedError') showTapChip(); });
}

function showTapChip() {
  const R = state.real;
  if (R.chip) return;
  const chip = document.createElement('button');
  chip.type = 'button'; chip.className = 'tap-chip';
  chip.textContent = getLang() === 'en' ? 'Tap to continue the flight' : 'הקישו כדי להמשיך בטיסה';
  document.body.appendChild(chip);
  R.chip = chip;
  const go = () => {
    window.removeEventListener('pointerdown', go, true);
    chip.remove(); R.chip = null;
    if (state.activeVideo) state.activeVideo.play().catch(() => {});
  };
  window.addEventListener('pointerdown', go, true);
}

async function startSegmentReal(seg) {
  const { ctx, viewer, real: R } = state;
  const from = state.seg;
  // leaving a looping hold for the descent: let the loop reach its rest pose (= the descent's frame 1) first, so the cut is
  // frame to frame; usually already there (the loop stops at rest while the unit card is open)
  let holdAt = null;
  if (from && from !== seg && from.role === 'hold' && from.kind === 'video' && seg.role === 'descend') {
    const hv = R.videos.get(from.id);
    if (hv) {
      if (!atRest(hv)) { R.log.push({ ev: 'settle', seg: from.id, t: hv.currentTime, at: performance.now() }); await settleHold(hv); if (state.seg !== from) return; }
      holdAt = { t: hv.currentTime, ended: hv.ended, rest: atRest(hv) };
    }
  }
  clearTimeout(state.stillTimer);
  state.seg = seg;
  state.segStarted = performance.now();
  R.log.push({ ev: 'segment', seg: seg.id, from: from?.id || null, yaw: viewer.yaw, pitch: viewer.pitch, hold: holdAt, at: performance.now() });
  state.picker.resetHover();
  els.segTitle.textContent = pick(seg.title) || seg.id;
  els.hint.textContent = seg.role === 'hold' ? t('hud.hintHold') : t('hud.hint');
  els.toFacadeBtn.hidden = seg.role === 'hold' || seg.role === 'approach';
  els.progressBar.style.width = '0%';
  capture('segment_start', { segment: seg.id, kind: seg.kind, role: seg.role || null, unit: seg.unit || null, placeholder: state.placeholderFlight && (seg.role === 'descend' || seg.role === 'enter') });
  if (R.ease) R.ease = null;
  if (R.tourShown) hideTour();
  const target = seg.kind === 'video' ? realVideo(seg) : null;
  for (const v of R.videos.values()) if (v !== target && !v.paused) v.pause();
  for (const v of R.videos.values()) if (v !== target) v.playbackRate = 1;

  let afterSwap = null;
  if (seg.role === 'descend') {
    // the flight takes over again: back from the hold framing to the director's framing (frame centre, default fov), started
    // with the first frame so the cut itself never moves the view; a view the buyer moved at the hold is kept (yaw)
    const hf = R.holdFrame;
    const untouched = hf && !hf.cancelled && (R.viewEase?.kind === 'hold' || Math.abs(wrap180(viewer.yaw - hf.yaw)) < 0.5);
    if (R.viewEase?.kind === 'hold') R.viewEase = null;
    afterSwap = () => startViewEase({ fov: DEFAULT_FOV, ...(untouched ? { yaw: 0 } : {}) }, 1200, 'descend');
  }
  if (target) {
    state.activeVideo = target;
    target.loop = !!seg.loop;
    if (target.currentTime > 0.01) { try { target.currentTime = 0; } catch { /* ignore */ } }
    firstFrame(target).then(() => {
      if (state.seg !== seg) return;
      viewer.setVideo(target);
      // upload the decoded frame now (three's VideoTexture waits for the next frame callback): no black frame at the swap
      if (viewer.material.map) viewer.material.map.needsUpdate = true;
      R.shown = seg.id;
      R.log.push({ ev: 'swap', seg: seg.id, t: target.currentTime, yaw: viewer.yaw, at: performance.now() });
      if (afterSwap) afterSwap();
      if (seg.role === 'hold') { const fr = holdFraming(seg); R.holdFrame = fr ? { yaw: fr.yaw, cancelled: false } : null; startViewEase(fr, 1200, 'hold'); }
    });
    playReal(target);
  } else {
    state.activeVideo = null;
    // TextureLoader swaps the texture only once the image is decoded: the previous frame stays up meanwhile
    try { await viewer.setImage(ctx.asset(seg.src)); } catch (e) { console.error(e); }
    if (state.seg !== seg) return;
    R.shown = seg.id;
    R.log.push({ ev: 'swap', seg: seg.id, t: 0, yaw: viewer.yaw, at: performance.now() });
    if (seg.role === 'hold') { const fr = holdFraming(seg); R.holdFrame = fr ? { yaw: fr.yaw, cancelled: false } : null; startViewEase(fr, 1200, 'hold'); }
    state.segStarted = performance.now();
    if (!seg.loop) state.stillTimer = setTimeout(() => { if (state.seg === seg) onSegmentEnd(); }, seg.duration_s * 1000);
  }
  warmNext(seg);
  updateCaption(true);
}

// the unit's pill on a real segment: card 19's hotspot (hold only; the flight segments show no pills)
function realUnitHotspot(u, seg) {
  const R = state.real;
  const m = R?.byId.get(seg.id);
  if (!m || m.role !== 'hold') return null;
  if (state.seg === seg && R.shown !== seg.id) return null; // no pill before the hold's own first frame is on screen (and framed)
  const min = R.meta.hotspot_min_visible ?? 0.25;
  if (m.kind === 'video' && Array.isArray(m.hotspots_by_frame) && m.hotspots_by_frame.length) {
    // the loop moves the camera 0.67 m: the pill follows card 19's polygon of the frame on screen
    const n = m.hotspots_by_frame.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor((state.seg === seg ? segmentTime() : 0) * (m.fps || 24))));
    const e = (m.hotspots_by_frame[i] || {})[u.id];
    if (!e || e[2] < min) return null;
    return { segment: seg.id, yaw_deg: e[0], pitch_deg: e[1], visible_frac: e[2] };
  }
  if (!m.hotspots) return null;
  const h = m.hotspots[u.id];
  if (!h || h.visible_frac < min) return null;
  return { segment: seg.id, yaw_deg: h.yaw, pitch_deg: h.pitch, visible_frac: h.visible_frac };
}

// a pill on the looping hold: while only the loop moves it (no drag, ease, inertia or gyro) it keeps its place until the true
// position is PILL_STEP_PX away, so it stands still under a finger (and for Playwright's stable-element check) instead of
// creeping by sub-pixels every frame; any view motion makes it follow exactly again
const PILL_STEP_PX = 2;
function steadyPill(id, x, y) {
  const R = state.real, v = state.viewer;
  const moving = els.viewer.classList.contains('dragging') || !!R.viewEase || v.gyro || Math.abs(v._vel?.yaw || 0) > 0.01 || Math.abs(v._vel?.pitch || 0) > 0.01;
  const m = R.pillPos || (R.pillPos = new Map());
  const p = m.get(id);
  if (moving || !p || Math.abs(p.x - x) >= PILL_STEP_PX || Math.abs(p.y - y) >= PILL_STEP_PX) {
    const q = { x: Math.round(x), y: Math.round(y) };
    m.set(id, q);
    return q;
  }
  return p;
}

// the hold loop at its rest pose (its last frame = the node pose = the descent's frame 1)
function atRest(v) { return v.ended || (Number.isFinite(v.duration) && v.duration - v.currentTime < 0.06); }

// bring the loop to its rest frame: the hold loop goes out and back symmetrically (frame k and frame 72-k are the same pose), so
// a loop paused in its first half first jumps to the mirror time (no change on screen), then plays to the end at 2x: <= 0.75 s
const HOLD_MIRROR_S = 70 / 24; // frame k at (k-1)/24 s <-> frame 72-k at (71-k)/24 s
async function settleHold(v) {
  const R = state.real;
  R.settling = true;
  try {
    const T = Number.isFinite(v.duration) ? v.duration : 3;
    if (v.currentTime < T / 2) {
      const m = Math.max(0, Math.min(T - 0.05, HOLD_MIRROR_S - v.currentTime));
      await new Promise((ok) => { const t = setTimeout(ok, 800); v.addEventListener('seeked', () => { clearTimeout(t); ok(); }, { once: true }); v.currentTime = m; });
      R.log.push({ ev: 'settle-mirror', to: m, at: performance.now() });
    }
    await new Promise((ok) => {
      v.loop = false; v.playbackRate = 2;
      let timer = null;
      const done = () => { clearTimeout(timer); v.removeEventListener('ended', done); ok(); };
      timer = setTimeout(done, 2500);
      v.addEventListener('ended', done);
      if (v.paused || v.ended) v.play().catch(() => {});
    });
  } finally { v.playbackRate = 1; R.settling = false; }
}

// the looping hold pauses in place while the unit card is open (nothing changes on screen, nothing to decode) and loops again
// when it closes; "continue" settles it on its rest frame first (settleHold)
function holdLoopWatch(seg) {
  const R = state.real, v = state.activeVideo;
  if (!v || seg.kind !== 'video' || seg.role !== 'hold' || R.settling || R.shown !== seg.id) return;
  const open = state.picker.isCardOpen();
  if (open && !v.paused) { v.pause(); R.log.push({ ev: 'hold-pause', t: v.currentTime, at: performance.now() }); }
  else if (!open && (v.paused || v.ended)) { v.loop = true; v.playbackRate = 1; v.play().catch(() => {}); }
}

// per frame: the end-of-enter ease, and a record of anything modal (for the test: must stay empty)
function realFrame(seg, now) {
  const R = state.real;
  applyViewEase();
  if (seg.role === 'enter' && !R.tourShown) easeToTour(now, seg);
  if (seg.role === 'hold') holdLoopWatch(seg);
  if (!els.loading.hidden || !els.startOverlay.hidden || !els.handoffOverlay.hidden) R.overlaysSeen.push({ seg: seg.id, t: now });
}

// the hold's framing (the director's, once, on arrival; a drag cancels it): the unit pills centred and a field of view in
// which stacked floors are far enough apart to tap and every pill stays in view. A smooth ease of a few degrees, never a cut.
function holdFraming(seg) {
  const v = state.viewer;
  const hs = state.ctx.units.units.map((u) => realUnitHotspot(u, seg)).filter(Boolean);
  if (!hs.length) return null;
  const H = els.viewer.clientHeight || innerHeight, W = els.viewer.clientWidth || innerWidth, aspect = W / Math.max(1, H);
  const pitches = hs.map((h) => h.pitch_deg);
  const lo = Math.min(...pitches), hi = Math.max(...pitches);
  const rel = hs.map((h) => wrap180(h.yaw_deg - v.yaw));
  const ylo = Math.min(...rel), yhi = Math.max(...rel);
  let dy = Infinity;
  for (const a of hs) for (const b of hs) if (a !== b && Math.abs(wrap180(a.yaw_deg - b.yaw_deg)) < 3) dy = Math.min(dy, Math.abs(a.pitch_deg - b.pitch_deg));
  const pill = document.querySelector('.hotspot[data-unit]')?.offsetHeight || 26;
  const gap = Math.max(PILL_GAP_PX, pill * 1.4);
  const half = Math.min((yhi - ylo) / 2 + 4, 80);
  const fovYaw = (2 * Math.atan(Math.tan((half * Math.PI) / 180) / aspect) * 180) / Math.PI; // horizontal room for every pill
  let fov = Math.max(Number.isFinite(dy) ? (dy * H) / gap : 0, hi - lo + 12, fovYaw);
  fov = Math.min(Math.max(fov, v.minFov), DEFAULT_FOV);
  return { yaw: wrap180(v.yaw + (ylo + yhi) / 2), pitch: (hi + lo) / 2, fov };
}

function startViewEase(to, dur, kind) {
  if (!to) return;
  const v = state.viewer;
  state.real.viewEase = { kind, t0: performance.now(), dur, y0: v.yaw, y1: to.yaw, p0: v.pitch, p1: to.pitch, f0: v.fov, f1: to.fov };
  state.real.log.push({ ev: 'frame', kind, seg: state.seg?.id, from: { yaw: v.yaw, pitch: v.pitch, fov: v.fov }, to, at: performance.now() });
}

function applyViewEase() {
  const R = state.real, v = state.viewer, e = R.viewEase;
  if (!e) return;
  if (els.viewer.classList.contains('dragging') || v.gyro) { if (e.kind === 'hold' && R.holdFrame) R.holdFrame.cancelled = true; R.viewEase = null; return; } // the buyer took over
  const k = smooth01((performance.now() - e.t0) / e.dur);
  if (e.y1 !== undefined) v.yaw = e.y0 + wrap180(e.y1 - e.y0) * k;
  if (e.p1 !== undefined) v.pitch = e.p0 + (e.p1 - e.p0) * k;
  if (e.f1 !== undefined) v.setFov(e.f0 + (e.f1 - e.f0) * k);
  if (k >= 1) R.viewEase = null;
}

// the tour's view for this stage (tour.js fitHfov(): vertical 85 deg -> hfov clamped to 60..118, pitch -2), as our vertical fov
function tourFov() {
  const w = els.viewer.clientWidth || innerWidth, h = els.viewer.clientHeight || innerHeight, a = w / Math.max(1, h);
  const hf = Math.max(60, Math.min(118, (2 * Math.atan(Math.tan((85 * Math.PI) / 360) * a) * 180) / Math.PI));
  return (2 * Math.atan(Math.tan((hf * Math.PI) / 360) / a) * 180) / Math.PI;
}

function easeToTour(now, seg) {
  const R = state.real, v = state.viewer;
  const end = seg.duration_s, win = 1.0;
  if (now < end - win || els.viewer.classList.contains('dragging') || v.gyro) return;
  if (!R.ease) {
    const f1 = tourFov();
    if (f1 > v.maxFov) v.maxFov = Math.ceil(f1);
    R.ease = { t0: now, p0: v.pitch, f0: v.fov, p1: -2, f1 };
  }
  const k = smooth01((now - R.ease.t0) / Math.max(0.05, end - R.ease.t0));
  v.pitch = R.ease.p0 + (R.ease.p1 - R.ease.p0) * k;
  v.setFov(R.ease.f0 + (R.ease.f1 - R.ease.f0) * k);
}

// where the buyer looks, as a yaw relative to the frame centre (gyro included)
function viewYaw() {
  const v = state.viewer;
  if (!v.gyro) return wrap180(v.yaw);
  const e = v.camera.matrixWorld.elements; // the camera looks down its local -Z
  return wrap180((Math.atan2(-e[8], e[10]) * 180) / Math.PI);
}

// ---------------- hand-off: the tour in place ----------------
function returnUrl() {
  if (state.cine) { // card 36: back to the cinematic hold (no ?real, no orbit again)
    const r = new URL('flow.html', location.href);
    r.searchParams.set('project', state.ctx.id);
    r.searchParams.set('seg', state.cineFlow.hold);
    r.searchParams.set('from', 'tour');
    if (getLang() !== 'he') r.searchParams.set('lang', getLang());
    return r.href;
  }
  const hold = holdSegment();
  const r = new URL('flow.html', location.href);
  r.searchParams.set('project', state.ctx.id);
  r.searchParams.set('real', '1');
  if (hold) r.searchParams.set('seg', hold.id);
  r.searchParams.set('from', 'tour');
  if (getLang() !== 'he') r.searchParams.set('lang', getLang());
  return r.href;
}

// habait-98's tour URL (confirmed 2026-11-02): scope, room, yaw (its panorama frame; overrides every default), ui=min, floor,
// video=0, return=<the platform's hold>; lang when not Hebrew; from/sid as the placeholder hand-off sends them
function tourUrl(u, ho, tourYaw) {
  const base = new URL(u.tour_url, location.href);
  const url = new URL(base.origin + base.pathname);
  const p = url.searchParams;
  const tp = ho.tour_params || {};
  p.set('scope', tp.scope || 'apartment');
  p.set('room', ho.room);
  p.set('yaw', String(tourYaw));
  p.set('ui', tp.ui || 'min');
  p.set('floor', base.searchParams.get('floor') || tp.floor || 'parquet');
  p.set('video', tp.video || '0');
  if (getLang() !== 'he') p.set('lang', getLang());
  p.set('return', returnUrl());
  p.set('from', 'flight');
  p.set('sid', sessionId());
  return url.toString();
}

function handoffFor(u) {
  const { ctx } = state;
  const enter = u ? ctx.unitSegment(u, 'enter').segment : null;
  const ho = enter ? state.real.byId.get(enter.id)?.handoff : null;
  return ho ? { enter, ho } : null;
}

function loadTour(u, ho, viewerYaw) {
  const R = state.real;
  const tourYaw = Math.round(wrap180(viewerYaw + (ho.tour_yaw_offset_deg || 0)) * 10) / 10;
  const url = tourUrl(u, ho, tourYaw);
  let frame = R.tour?.frame;
  if (!frame) {
    frame = document.createElement('iframe');
    frame.className = 'tour-frame';
    frame.title = getLang() === 'en' ? 'Apartment tour' : 'סיור בדירה';
    frame.setAttribute('allow', 'fullscreen; gyroscope; accelerometer');
    frame.setAttribute('allowfullscreen', '');
    document.body.appendChild(frame);
  }
  const tour = { frame, url, unit: u.id, room: ho.room, yaw: tourYaw, bearing: ho.bearing_deg, view: null, loaded: false };
  tour.ready = new Promise((ok) => { tour.resolve = ok; });
  frame.onload = () => { tour.loaded = true; setTimeout(() => tour.resolve('load'), 4000); }; // a tour that never posts still shows
  frame.src = url;
  R.tour = tour;
  R.log.push({ ev: 'tour_load', url, tour_yaw: tourYaw, at: performance.now() });
  return tour;
}

function onTourMessage(e) {
  const tour = state.real?.tour;
  if (!tour || e.source !== tour.frame.contentWindow) return;
  const m = e.data && typeof e.data === 'object' ? e.data : null;
  if (!m || m.type !== 'habait:view') return;
  tour.view = { scene: m.scene, yaw: m.yaw, pitch: m.pitch, fov: m.fov, at: performance.now() };
  // ready = the tour has painted the room at the yaw we asked for (a message from a previous URL does not count)
  if (m.scene === tour.room && Number.isFinite(m.yaw) && Math.abs(wrap180(m.yaw - tour.yaw)) <= 2) tour.resolve('view');
}

// at the descent: load the tour behind the flight so the hand-off finds it painted
function prepareTour() {
  const R = state.real;
  const u = state.selectedUnit;
  const h = handoffFor(u);
  if (!h) return;
  if (R.tour && R.tour.unit === u.id) return;
  loadTour(u, h.ho, viewYaw());
}

async function handoffReal() {
  const R = state.real;
  const seg = state.seg;
  const u = state.selectedUnit || (seg?.unit ? state.ctx.unitById.get(seg.unit) : null);
  const ho = seg ? R.byId.get(seg.id)?.handoff : null;
  if (!u || !ho) { if (u) { renderHandoff(u); els.handoffOverlay.hidden = false; } return; } // nothing to open in place
  const v = state.viewer;
  if (!els.viewer.classList.contains('dragging') && !v.gyro) { v.pitch = -2; v.setFov(tourFov()); } // finish the ease
  const yaw = viewYaw();
  const want = Math.round(wrap180(yaw + (ho.tour_yaw_offset_deg || 0)) * 10) / 10;
  let tour = R.tour;
  // the buyer turned since the tour was loaded: reload at the exact yaw (cached, fast) while enter's last frame stays up
  if (!tour || tour.unit !== u.id || Math.abs(wrap180(tour.yaw - want)) > 1) tour = loadTour(u, ho, yaw);
  R.log.push({ ev: 'handoff', viewer_yaw: Math.round(yaw * 10) / 10, tour_yaw: want, bearing: Math.round((ho.bearing_deg + want) * 10) / 10, room: ho.room, url: tour.url, at: performance.now() });
  capture('tour_handoff', { unit: u.id, tour_url: tour.url, via: 'flight' });
  if (window.__habait?.holdReveal) await new Promise((ok) => { window.__habait.reveal = ok; }); // test hook: shoot the last frame first
  await tour.ready; // no spinner: enter's last frame (that very panorama) stays up until the tour has painted it
  if (state.seg !== seg || R.tour !== tour) return; // the buyer went back meanwhile
  tour.frame.classList.add('shown');
  R.tourShown = true;
  R.log.push({ ev: 'reveal', view: tour.view, at: performance.now() });
  for (const vid of R.videos.values()) vid.pause();
  state.picker.close();
  updateCaption(true);
  try { tour.frame.focus(); } catch { /* ignore */ }
}

function hideTour() {
  const R = state.real;
  if (R.tour) R.tour.frame.classList.remove('shown');
  R.tourShown = false;
}

boot();

// =====================================================================================================================
// card 36 (2026-11-03): the cinematic flight (js/cine.js), flow.html's default
// =====================================================================================================================
// fixtures/<id>/flow.cine.json (tools/build_segments.mjs, from card 35's video manifest): the orbit and the descent/enter are FLAT
// photoreal clips (cover-fit), the hold is a draggable arc of photoreal frames with pills projected per frame from units.json boxes;
// the unit card, the lead form and the caption are the same as card 34's; the hand-off reuses card 34's tour iframe (loadTour,
// habait:view readiness, return URL) after cine.js has crossfaded the last frame into the tour's own panorama in this file's 360
// viewer. Card 34's 360 flight stays as ?mode=360 / ?real=1, the placeholder as ?real=0.
async function loadCineFlow(ctx) {
  const flow = await getJSONx(`${ctx.dir}/flow.cine.json`);
  if (flow.schema !== 'habait-platform/flow.cine.v1') throw new Error(`flow.cine.json schema "${flow.schema}"`);
  if (flow.project !== ctx.id) throw new Error(`flow.cine.json is for "${flow.project}"`);
  const byId = new Map(flow.segments.map((s) => [s.id, s]));
  if (!byId.has(flow.start) || !byId.has(flow.hold)) throw new Error('flow.cine.json: start/hold segment missing');
  if (!flow.segments.some((s) => s.role === 'descend')) throw new Error('flow.cine.json: no descent');
  // swap the flight in place (config.js's unitSegment() closes over ctx.flow and ctx.segById): descend-<unit> / defaults work as in card 34
  for (const k of Object.keys(ctx.flow)) delete ctx.flow[k];
  Object.assign(ctx.flow, { start: flow.start, defaults: flow.defaults, segments: flow.segments });
  ctx.segById.clear();
  for (const s of flow.segments) ctx.segById.set(s.id, s);
  return flow;
}

// the 360 viewer stays paused (no GPU) until the hand-off bridge needs it
function viewerRun(on) {
  const v = state.viewer;
  if (!v || v._running === on) return;
  v._running = on;
  if (on) requestAnimationFrame(v._loop);
}

async function bootCine() {
  const { ctx, viewer } = state;
  if (!document.querySelector('link[data-cine]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/cine.css'; l.dataset.cine = '1'; document.head.appendChild(l);
  }
  document.body.classList.add('real-flight', 'cine-flight');
  els.startOverlay.hidden = true;   // no start modal: muted inline video may autoplay; a blocked autoplay gets a chip
  els.fixtureNote.hidden = true;
  els.loading.hidden = true;        // never a spinner: a step that is not ready keeps the last frame up
  els.gyroBtn.hidden = true;        // flat clips: nothing to steer with the phone
  els.brandLogo.hidden = true;      // board ruling 7(c) default (D-WQ-18): the project name stays, the developer's logo waits for consent
  els.toFacadeBtn.hidden = true;
  // the tour iframe (card 34's loadTour / onTourMessage) needs the real-flight record; nothing of card 34's segments is loaded
  state.real = { meta: { caption: state.cineFlow.caption }, byId: new Map(), videos: new Map(), images: new Map(), log: [], tour: null, tourShown: false, overlaysSeen: [], cine: true };
  window.addEventListener('message', onTourMessage);
  viewerRun(false);
  const host = {
    t, pick, getLang, capture,
    selectedUnit: () => state.selectedUnit,
    onSegment: (seg) => {
      state.seg = seg; state.segStarted = performance.now();
      state.picker.resetHover();
      els.segTitle.textContent = pick(seg.title) || '';
      els.hint.textContent = seg.role === 'hold' ? state.cine.hint() : '';
      els.toFacadeBtn.hidden = seg.role !== 'orbit';
      els.progressBar.style.width = '0%';
      document.body.classList.toggle('cine-at-hold', seg.role === 'hold');
      updateCaption(true);
    },
    updateCaption: () => updateCaption(false),
    prepareTour: (u, ho, yaw) => loadTour(u, ho, yaw),
    wantYaw: (tour, u, yaw, ho) => {
      const want = Math.round(wrap180(yaw + (ho.tour_yaw_offset_deg || 0)) * 10) / 10;
      if (!tour || tour.unit !== u.id || Math.abs(wrap180(tour.yaw - want)) > 1) return loadTour(u, ho, yaw);
      return tour;
    },
    revealTour: (tour) => {
      tour.frame.classList.add('shown');
      state.real.tourShown = true;
      state.real.log.push({ ev: 'reveal', view: tour.view, at: performance.now() });
      state.picker.close();
      capture('tour_handoff', { unit: tour.unit, tour_url: tour.url, via: 'cine' });
      updateCaption(true);
      try { tour.frame.focus(); } catch { /* ignore */ }
    },
    viewerRun, tourFov, viewYaw,
  };
  const { createCine } = await import('./cine.js'); // loaded only in this mode: the 360 / placeholder flights keep their module graph
  state.cine = await createCine({ ctx, flow: state.cineFlow, els, picker: state.picker, viewer, host });
  Object.assign(window.__habait, { cine: state.cine, real: state.real, viewYaw, tourFov });
  const segId = QS.get('seg');
  const first = segId && ctx.segById.has(segId) ? ctx.segById.get(segId) : null;
  state.started = true;
  capture('flight_start', { start: (first || ctx.segById.get(ctx.flow.start)).id, mode: 'cine' });
  updateCaption(true);
  return state.cine.start(first);
}

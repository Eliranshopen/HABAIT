// picker.js: the apartment picker of the Habait platform shell, one implementation for every viewer.
//   - :8850 flow.html (js/flow.js) uses it on every flight segment (time-based unit hotspots, hold-facade).
//   - habait-89's three.js hold (:8899) imports it cross-origin from http://127.0.0.1:8850/js/picker.js.
// ES module, no bundler, no dependencies beyond its siblings (i18n.js, analytics.js, lead.js), which it imports
// relative to its own URL, so it works from any origin (serve.mjs answers Access-Control-Allow-Origin: *).
// Styles live in css/style.css (.hotspot*, .sheet*, .unit-*, .drawer*, .unit-row, .picker-*).
//
//   import { createPicker } from './picker.js';
//   const picker = createPicker({ units, container, i18n, analytics, project, onEnter(unit) {} });
//   picker.update(projectFn);  // every frame; projectFn(unit) -> { x, y, visible } in CSS px relative to the container
//                              // (null/undefined = the unit is not in this shot: no marker at all)
//   picker.select(unitId);     // highlights the pill and opens the unit card
//   picker.close();            // closes card and drawer
//   picker.setLang('he'|'en'); // re-labels everything, flips dir
//   picker.destroy();
// The optional hooks (onSelect, onTour, canEnter, cardNote, enterProps, context, layer, chrome, title, apartmentUrl)
// are what flow.js needs to keep its flight behaviour; other viewers can ignore them. See README "picker.js for other viewers".
// Card 24 (D2, additive, 2026-11-02): a favorite toggle (☆/★) in the unit card -> analytics.setFavorite(unit, on)
// (opts.favorites = false hides it); a unit chosen from the drawer on another floor -> analytics.floorSwitch({ floor, prev });
// the WhatsApp `viewed:` line only when project.analytics.whatsapp_viewed_line === true (default off). Hosts whose
// analytics object lacks setFavorite / floorSwitch get the same events through its capture().
import * as i18nDefault from './i18n.js';
import * as analyticsDefault from './analytics.js';
import { renderLeadBlock, LEADS_ON } from './lead.js';

export const STATUSES = ['for-sale', 'reserved', 'sold', 'unknown'];

// strings only the picker uses; everything else comes from i18n.js (STR) so there is one dictionary
export const PICKER_STR = {
  he: { 'picker.title': 'מול החזית · בחרו דירה', 'picker.aptPage': 'עמוד הדירה', 'picker.fav': 'שמירה למועדפים', 'picker.faved': 'שמור במועדפים' },
  en: { 'picker.title': 'At the facade · choose an apartment', 'picker.aptPage': 'Apartment page', 'picker.fav': 'Save to favorites', 'picker.faved': 'Saved to favorites' },
};

// apartment.html sits next to this module's folder; absolute, so the link also works from another origin
const APARTMENT_PAGE = new URL('../apartment.html', import.meta.url).href;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createPicker(opts = {}) {
  const {
    container,
    onEnter = () => {},
    onSelect = null,          // (unit, from) before the card opens; from = 'hotspot' | 'list' | 'api'
    onTour = null,            // (unit) when the card's 360 tour link is clicked
    canEnter = () => true,    // (unit) -> false disables "continue"
    cardNote = () => '',      // (unit) -> extra note under the card actions
    enterProps = () => ({}),  // (unit) -> extra props for unit_enter
    context = () => ({}),     // () -> extra props for unit_hover / unit_click (e.g. { segment })
    layer: givenLayer = null, // an existing element to host the pills (default: a new .hotspot-layer in the container)
    chrome = true,            // title, legend, hint, units button, disclaimer line (flow.html has its own HUD: false)
    title = null,             // {he, en} | string for the chrome title (default 'picker.title')
    apartmentUrl,             // (unit, sid) -> URL of the apartment page; false = no link; default ../apartment.html
    favorites: showFav = true, // card 24: the ☆ toggle in the unit card; false hides it
  } = opts;
  if (!container) throw new Error('createPicker: container is required');
  const i18n = opts.i18n || i18nDefault;
  const analytics = opts.analytics || analyticsDefault;
  const unitsDoc = Array.isArray(opts.units) ? { units: opts.units } : (opts.units || { units: [] });
  const units = unitsDoc.units || [];
  const currency = unitsDoc.currency || 'ILS';
  const byId = new Map(units.map((u) => [String(u.id), u]));
  const project = typeof opts.project === 'string' ? { id: opts.project } : (opts.project || {});
  const projectId = project.id || unitsDoc.project || '';
  const doc = container.ownerDocument || document;
  const win = doc.defaultView || window;

  // ---- i18n through the passed module, with the shared dictionary as fallback ----
  const getLang = () => (typeof i18n.getLang === 'function' ? i18n.getLang() : (doc.documentElement.lang === 'en' ? 'en' : 'he'));
  const tr = (key, vars = {}) => {
    const s = typeof i18n.t === 'function' ? i18n.t(key, vars) : key;
    if (s && s !== key) return s;
    const l = getLang();
    const raw = PICKER_STR[l]?.[key] ?? i18nDefault.STR[l]?.[key] ?? PICKER_STR.en[key] ?? i18nDefault.STR.en[key] ?? key;
    return raw.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
  };
  const pick = (obj) => {
    if (typeof i18n.pick === 'function') return i18n.pick(obj);
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[getLang()] || obj.en || obj.he || Object.values(obj)[0] || '';
  };
  const price = (n) => {
    if (typeof i18n.formatPrice === 'function') return i18n.formatPrice(n, currency);
    if (!n) return tr('unit.poa');
    try { return new Intl.NumberFormat(getLang() === 'he' ? 'he-IL' : 'en-IL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n); }
    catch { return `${currency} ${Math.round(n).toLocaleString()}`; }
  };

  // ---- analytics through the passed object ----
  const viewed = [];
  const noteViewed = (id) => { if (!viewed.includes(id)) viewed.push(id); };
  const cap = (event, props) => (typeof analytics.capture === 'function' ? analytics.capture(event, props) : null);
  const unitsViewed = () => (typeof analytics.unitsViewed === 'function' ? analytics.unitsViewed() : viewed.slice());
  const sessionId = () => (typeof analytics.sessionId === 'function' ? analytics.sessionId() : analyticsDefault.sessionId());
  const ctxProps = () => ({ segment: null, ...(context() || {}) });
  // card 24: favorites (device only) and floor switches, through the host's analytics object when it has them
  const isFav = (u) => {
    try { return typeof analytics.isFavorite === 'function' ? !!analytics.isFavorite(u.id) : analyticsDefault.isFavorite(u.id); } catch { return false; }
  };
  const setFav = (u, on) => {
    if (typeof analytics.setFavorite === 'function') return analytics.setFavorite(u.id, on, { status: u.status, floor: u.floor });
    analyticsDefault.storeFavorite(u.id, on);
    return cap('favorite', { unit: u.id, on: !!on, status: u.status, floor: u.floor });
  };
  let lastFloor = null;
  const floorPicked = (u, from) => {
    const prev = lastFloor;
    lastFloor = u.floor;
    if (from !== 'list' || u.floor === prev) return;
    if (typeof analytics.floorSwitch === 'function') analytics.floorSwitch({ floor: u.floor, prev, unit: u.id, via: 'drawer' });
    else cap('floor_switch', { floor: u.floor, prev, unit: u.id, via: 'drawer' });
  };
  const viewedLine = () => {
    if (project.analytics && typeof project.analytics === 'object') return project.analytics.whatsapp_viewed_line === true;
    try { return typeof analytics.configValue === 'function' ? analytics.configValue('whatsapp_viewed_line') === true : false; } catch { return false; }
  };
  const aptHref = (u) => {
    if (apartmentUrl === false) return null;
    if (typeof apartmentUrl === 'function') return apartmentUrl(u, sessionId());
    const url = new URL(typeof apartmentUrl === 'string' ? apartmentUrl : APARTMENT_PAGE, doc.baseURI);
    url.searchParams.set('project', projectId);
    url.searchParams.set('unit', u.id);
    url.searchParams.set('sid', sessionId());
    url.searchParams.set('from', 'flight');
    return url.toString();
  };

  // ---- DOM ----
  const el = (tag, cls) => { const e = doc.createElement(tag); if (cls) e.className = cls; return e; };
  if (container !== doc.body && win.getComputedStyle(container).position === 'static') container.style.position = 'relative';

  const layer = givenLayer || el('div', 'hotspot-layer picker-layer');
  if (!givenLayer) container.appendChild(layer);

  const sheet = el('aside', 'sheet');
  sheet.id = 'unitSheet';
  sheet.hidden = true;
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('role', 'dialog');
  sheet.innerHTML = '<div class="sheet-handle"></div><button class="sheet-close" id="unitClose" type="button" aria-label="close">×</button><div class="sheet-body" id="unitBody"></div>';
  const body = sheet.querySelector('.sheet-body');
  sheet.querySelector('.sheet-close').addEventListener('click', () => closeCard());

  const drawer = el('aside', 'drawer');
  drawer.id = 'unitsDrawer';
  drawer.hidden = true;
  drawer.innerHTML = '<header class="drawer-head"><h2></h2><button class="sheet-close" id="unitsClose" type="button" aria-label="close">×</button></header><div class="drawer-body" id="unitsList"></div>';
  const drawerTitle = drawer.querySelector('h2');
  const drawerList = drawer.querySelector('.drawer-body');
  drawer.querySelector('.sheet-close').addEventListener('click', () => { drawer.hidden = true; });

  const ch = chrome === true ? { title: true, legend: true, hint: true, units: true, disclaimer: true }
    : chrome && typeof chrome === 'object' ? { title: true, legend: true, hint: true, units: true, disclaimer: true, ...chrome } : null;
  let chromeEl = null;
  if (ch) {
    chromeEl = el('div', 'picker-chrome');
    chromeEl.hidden = true; // shown once update() puts at least one unit in the shot
    chromeEl.innerHTML = `
      ${ch.title ? '<div class="picker-title"></div>' : ''}
      <div class="picker-bottom">
        ${ch.legend ? '<div class="picker-legend"></div>' : ''}
        ${ch.units || ch.hint ? `<div class="picker-row">${ch.units ? '<button class="hud-chip picker-units-btn" type="button"></button>' : ''}${ch.hint ? '<span class="picker-hint"></span>' : ''}</div>` : ''}
        ${ch.disclaimer ? '<div class="picker-disclaimer"></div>' : ''}
      </div>`;
    chromeEl.querySelector('.picker-units-btn')?.addEventListener('click', () => toggleDrawer());
    container.appendChild(chromeEl);
  }
  container.appendChild(drawer);
  container.appendChild(sheet);

  // ---- state ----
  const markers = new Map(); // unit id -> button
  const hoverSent = new Set();
  let cardUnit = null;
  let destroyed = false;
  let inSetLang = false;

  const badge = (u) => `<span class="badge badge-${esc(u.status)}">${esc(tr(`status.${u.status}`))}</span>`;
  const markerHTML = (u) => `<span class="dot"></span><span>${esc(u.id)}</span><span class="sub">${esc(tr('unit.floor'))} ${esc(u.floor)} · ${esc(u.rooms)} ${esc(tr('unit.rooms'))}</span>`;

  function makeMarker(u) {
    const b = el('button', `hotspot pulse status-${u.status}`);
    b.type = 'button';
    b.dataset.unit = u.id;
    b.innerHTML = markerHTML(u);
    b.addEventListener('pointerenter', () => {
      if (!hoverSent.has(u.id)) { hoverSent.add(u.id); cap('unit_hover', { unit: u.id, segment: ctxProps().segment }); }
    });
    b.addEventListener('click', (e) => { e.stopPropagation(); select(u.id, 'hotspot'); });
    b.addEventListener('pointerdown', (e) => e.stopPropagation()); // don't start a drag from a marker
    setTimeout(() => b.classList.remove('pulse'), 400);
    return b;
  }

  // projectFn(unit) -> { x, y, visible } (CSS px relative to the container/layer) | null = not in this shot
  function update(projectFn) {
    if (destroyed) return;
    let present = 0;
    for (const u of units) {
      const p = projectFn ? projectFn(u) : null;
      let m = markers.get(u.id);
      if (!p) { if (m) { m.remove(); markers.delete(u.id); } continue; }
      present++;
      if (!m) { m = makeMarker(u); markers.set(u.id, m); layer.appendChild(m); }
      const show = p.visible !== false && Number.isFinite(p.x) && Number.isFinite(p.y);
      if (show) {
        // position with left/top; the CSS transform only centres (and animates) the marker
        m.style.left = `${p.x.toFixed(1)}px`;
        m.style.top = `${p.y.toFixed(1)}px`;
      }
      m.style.display = show ? '' : 'none';
      m.classList.toggle('selected', cardUnit?.id === u.id);
      m._px = show ? p.x : NaN; m._py = show ? p.y : NaN;
    }
    resolveOverlaps();
    if (chromeEl) chromeEl.hidden = present === 0;
  }

  // Three bays on one floor sit ~120 px apart on desktop while a full pill is ~150 px wide: when two pills would
  // overlap on the same row, both drop to the compact form (dot + number) unless selected, and the row is staggered
  // by 0.6 pill heights so the compact pills never touch either. Pure DOM read/write, once per frame.
  function resolveOverlaps() {
    const list = [...markers.values()].filter((m) => Number.isFinite(m._px));
    const h = list.length ? (list[0].offsetHeight || 26) : 26;
    for (const m of list) { m._compact = false; m._stag = 0; }
    list.sort((a, b) => a._px - b._px);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (Math.abs(a._py - b._py) > h * 1.2) continue;
        // habait-98 fix (2026-11-02): measure the FULL width only while the label is not compact and cache it, so a compact
        // label is compared by its full width and does not flip compact <-> full every frame (flicker + swallowed clicks)
        const fw = (m) => { if (!m.classList.contains('compact')) m._fullW = m.offsetWidth || 150; return m._fullW || 150; };
        const wa = fw(a), wb = fw(b);
        if (b._px - a._px < (wa + wb) / 2 + 8) { a._compact = b._compact = true; if (!b._stag) b._stag = a._stag ? -a._stag : 0.6; }
      }
    }
    for (const m of list) {
      const sel = m.classList.contains('selected');
      m.classList.toggle('compact', m._compact && !sel);
      const dy = m._compact ? m._stag * h : 0;
      m.style.top = `${(m._py + dy).toFixed(1)}px`;
    }
  }

  function markSelected() { for (const [id, m] of markers) m.classList.toggle('selected', cardUnit?.id === id); }

  function select(unitId, from = 'api') {
    const u = byId.get(String(unitId));
    if (!u || destroyed) { if (!u) console.warn('[picker] unknown unit', unitId); return null; }
    if (onSelect) onSelect(u, from);
    cardUnit = u;
    noteViewed(u.id);
    cap('unit_click', { unit: u.id, status: u.status, floor: u.floor, price: u.price, ...ctxProps(), from });
    floorPicked(u, from);
    renderCard(u);
    sheet.hidden = false;
    drawer.hidden = true;
    markSelected();
    return u;
  }

  // what the card's "continue" button does; exposed so hosts/tests can trigger it
  function enter(unitId) {
    const u = byId.get(String(unitId));
    if (!u || destroyed) return null;
    noteViewed(u.id);
    cap('unit_enter', { unit: u.id, status: u.status, ...(enterProps(u) || {}) });
    closeCard();
    onEnter(u);
    return u;
  }

  function closeCard() { sheet.hidden = true; cardUnit = null; markSelected(); }
  function close() { closeCard(); drawer.hidden = true; }

  function renderCard(u) {
    const can = canEnter(u) !== false;
    const note = cardNote(u) || '';
    const page = aptHref(u);
    body.innerHTML = `
    <div class="unit-head">
      <h2>${esc(tr('unit.apt'))} ${esc(u.id)}</h2>
      <span class="type">${esc(tr('unit.type'))} ${esc(u.type)}</span>
      ${badge(u)}
      ${showFav ? '<button class="unit-fav" id="unitFav" type="button" aria-pressed="false"></button>' : ''}
    </div>
    <div class="unit-price">${esc(price(u.price))}</div>
    <div class="unit-facts">
      <div class="fact"><b>${esc(u.floor)}</b><span>${esc(tr('unit.floor'))}</span></div>
      <div class="fact"><b>${esc(u.rooms)}</b><span>${esc(tr('unit.rooms'))}</span></div>
      <div class="fact"><b>${esc(u.area_m2)}</b><span>${esc(tr('unit.area'))}</span></div>
      <div class="fact"><b>${esc(u.outdoor_m2)}</b><span>${esc(tr('unit.outdoor'))}</span></div>
    </div>
    <div class="unit-actions">
      <button class="btn btn-primary" id="unitContinue" type="button" ${can ? '' : 'disabled'}>${esc(u.status === 'sold' ? tr('unit.continueSold') : tr('unit.continue'))}</button>
      ${can ? '' : `<a class="btn btn-ghost" id="unitTour" href="${esc(u.tour_url)}" rel="noopener">${esc(tr('unit.openTour'))}</a>`}<!-- Eliran 2026-11-04: «המשיכו אל הדירה» and «לסיור 360» do the same; one entry, the tour link only where continue cannot run -->
      ${page ? `<a class="btn btn-ghost" id="unitPage" href="${esc(page)}" rel="noopener">${esc(tr('picker.aptPage'))}</a>` : ''}
    </div>
    ${note ? `<div class="unit-note">${esc(note)}</div>` : ''}
    ${LEADS_ON ? '<div id="leadBlock"></div>' : ''}
    <div class="unit-note unit-disclaimer">${esc(pick(project.disclaimer) || '')}</div>`;
    body.querySelector('#unitContinue').addEventListener('click', () => enter(u.id));
    const fav = body.querySelector('#unitFav');
    if (fav) {
      const paint = (on) => {
        fav.textContent = on ? '★' : '☆';
        fav.setAttribute('aria-pressed', on ? 'true' : 'false');
        fav.setAttribute('aria-label', tr(on ? 'picker.faved' : 'picker.fav'));
        fav.title = tr(on ? 'picker.faved' : 'picker.fav');
        fav.classList.toggle('on', on);
      };
      paint(isFav(u));
      fav.addEventListener('click', () => { const on = fav.getAttribute('aria-pressed') !== 'true'; setFav(u, on); paint(on); });
    }
    body.querySelector('#unitTour')?.addEventListener('click', () => {
      if (onTour) onTour(u);
      cap('tour_handoff', { unit: u.id, tour_url: u.tour_url, from: 'card' });
    });
    body.querySelector('#unitPage')?.addEventListener('click', () => {
      cap('unit_click', { unit: u.id, status: u.status, floor: u.floor, price: u.price, ...ctxProps(), from: 'card', channel: 'apartment_page' });
    });
    if (LEADS_ON) renderLeadBlock(body.querySelector('#leadBlock'), {
      project: projectId, projectName: pick(project.name), unit: u,
      whatsappNumber: project.leads?.whatsapp_number, webhookUrl: project.leads?.webhook_url,
      capture: cap, t: tr, unitsViewed, sessionId, viewedLine: viewedLine(),
    });
  }

  function renderDrawer() {
    drawerTitle.textContent = tr('units.title');
    const byFloor = new Map();
    for (const u of units) { if (!byFloor.has(u.floor)) byFloor.set(u.floor, []); byFloor.get(u.floor).push(u); }
    const floors = [...byFloor.keys()].sort((a, b) => b - a);
    drawerList.innerHTML = '';
    for (const f of floors) {
      const g = el('div', 'floor-group');
      g.innerHTML = `<div class="floor-label">${esc(tr('unit.floor'))} ${esc(f)}</div>`;
      for (const u of byFloor.get(f).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
        const b = el('button', 'unit-row');
        b.type = 'button';
        b.dataset.unit = u.id;
        b.innerHTML = `<b>${esc(u.id)}</b><span class="meta">${esc(u.type)} · ${esc(u.rooms)} ${esc(tr('unit.rooms'))} · ${esc(u.area_m2)} ${esc(tr('unit.area'))}</span><span class="price">${esc(price(u.price))}</span>${badge(u)}`;
        b.addEventListener('click', () => select(u.id, 'list')); // select only; onEnter is not called from the list
        g.appendChild(b);
      }
      drawerList.appendChild(g);
    }
  }

  function toggleDrawer(force) {
    const open = force === undefined ? drawer.hidden : !!force;
    drawer.hidden = !open;
    if (open) renderDrawer();
    return open;
  }

  function renderChrome() {
    if (!chromeEl) return;
    const q = (s) => chromeEl.querySelector(s);
    if (q('.picker-title')) q('.picker-title').textContent = (title && pick(title)) || tr('picker.title');
    if (q('.picker-legend')) {
      const present = STATUSES.filter((s) => units.some((u) => u.status === s));
      q('.picker-legend').innerHTML = present.map((s) => `<span class="lg status-${s}"><span class="dot"></span>${esc(tr(`status.${s}`))}</span>`).join('');
    }
    if (q('.picker-units-btn')) { q('.picker-units-btn').textContent = `▤ ${tr('hud.units')}`; }
    if (q('.picker-hint')) q('.picker-hint').textContent = tr('hud.hintHold');
    if (q('.picker-disclaimer')) q('.picker-disclaimer').textContent = pick(project.disclaimer) || '';
  }

  function relabel() {
    if (destroyed) return;
    const dir = getLang() === 'he' ? 'rtl' : 'ltr';
    for (const r of [sheet, drawer, chromeEl, givenLayer ? null : layer]) if (r) r.dir = dir;
    for (const [id, m] of markers) { const u = byId.get(id); if (u) m.innerHTML = markerHTML(u); }
    renderChrome();
    drawerTitle.textContent = tr('units.title');
    if (cardUnit) renderCard(cardUnit);
    if (!drawer.hidden) renderDrawer();
  }

  function setLang(lang) {
    inSetLang = true;
    try { if (typeof i18n.setLang === 'function') i18n.setLang(lang); } finally { inSetLang = false; }
    relabel();
    return getLang();
  }

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const onLangChange = () => { if (!inSetLang) relabel(); };
  win.addEventListener('keydown', onKey);
  doc.addEventListener('langchange', onLangChange);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    win.removeEventListener('keydown', onKey);
    doc.removeEventListener('langchange', onLangChange);
    for (const m of markers.values()) m.remove();
    markers.clear();
    sheet.remove();
    drawer.remove();
    if (chromeEl) chromeEl.remove();
    if (!givenLayer) layer.remove();
  }

  relabel();

  return {
    update, select, close, setLang, destroy,
    // extras (flow.js and tests)
    enter, closeCard, toggleDrawer, relabel,
    toggleFavorite: (unitId, on) => { const u = byId.get(String(unitId)); if (!u) return null; const v = on === undefined ? !isFav(u) : !!on; setFav(u, v); if (cardUnit?.id === u.id) renderCard(u); return v; },
    resetHover: () => hoverSent.clear(),
    isCardOpen: () => !sheet.hidden,
    isDrawerOpen: () => !drawer.hidden,
    get cardUnit() { return cardUnit; },
    get units() { return units; },
    elements: { layer, sheet, drawer, chrome: chromeEl },
  };
}

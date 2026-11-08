// The apartment sales page (D1b): five tabs (360 tour / plan / photos / 3D / about), an agent card with a WhatsApp
// link carrying project|unit|session, and the per-unit ZIP. One file, two modes:
//   live:  apartment.html?project=rainbow&unit=846[&sid=..&lang=en&tab=plan&return=<url>]
//          reads the manifest tools/build_zip.mjs wrote to _local/dist/<project>/<unit>/apartment.json;
//          without one it falls back to units.json (facts + WhatsApp only, the tabs say "not built yet").
//   dist:  _local/dist/<project>/<unit>/index.html (written by the builder; window.__HABAIT_APT points at ./apartment.json).
// The legal caption (short) sits at the bottom of every tab and of the page; the full text is in "about" and the footer.
import { LEADS_ON } from './lead.js';
import { STR, getLang, setLang, t, pick, formatPrice, applyI18n } from './i18n.js';
import { capture, initAnalytics, sessionId, floorSwitch } from './analytics.js';
import { buildWhatsAppLink } from './lead.js';

export const TABS = ['tour', 'plan', 'photos', '3d', 'about'];

export const APT_STR = {
  he: {
    'apt.back': 'חזרה לבניין',
    'apt.title': 'דירה {unit}',
    'apt.tab.tour': 'סיור 360°',
    'apt.tab.plan': 'תכנית',
    'apt.tab.photos': 'תמונות',
    'apt.tab.3d': 'תלת-ממד',
    'apt.tab.about': 'אודות',
    'apt.tour.open': 'פתיחה במסך מלא',
    'apt.tour.none': 'הסיור של הדירה עוד לא פורסם.',
    'apt.plan.note': 'לפי תכנית המכר מיום {date}',
    'apt.plan.none': 'התכנית של הדירה עוד לא הוכנה.',
    'apt.photos.none': 'אין עדיין תמונות לדירה הזו.',
    'apt.3d.hint': 'לחצו על חדר כדי לראות את שטחו ולהיכנס אליו ב-360°. גררו לסיבוב, צביטה או גלגלת לזום.',
    'apt.3d.back': 'חזרה לתלת-ממד',
    'apt.3d.placeholder': 'מודל זמני: מסת clay של הקירות מתוך התכנית. בית הבובות המלא יחליף אותו אוטומטית.',
    'apt.3d.none': 'מודל התלת-ממד עוד לא מוכן.',
    'apt.about.title': 'אודות הדירה וההדמיה',
    'apt.about.legal': 'הכיתוב המשפטי המלא',
    'apt.about.generated': 'הופק {date} · גרסה {version}',
    'apt.about.status': 'סטטוס הכיתוב: {status}',
    'apt.legal.full': 'הכיתוב המשפטי המלא',
    'apt.agent.team': 'צוות המכירות',
    'apt.agent.role': 'ייעוץ מכירות · {project}',
    'apt.agent.call': 'התקשרו',
    'apt.agent.email': 'מייל',
    'apt.zip': 'הורדת חבילת הדירה (ZIP)',
    'apt.zip.building': 'מכין ZIP…',
    'apt.wa.text': 'שלום, אני מתעניין/ת בדירה {unit} (קומה {floor}) בפרויקט {project}. אשמח לפרטים.',
    'apt.notBuilt': 'חבילת הדירה עוד לא נבנתה (tools/build_zip.mjs); מוצגים פרטים בסיסיים בלבד.',
    'apt.err': 'שגיאה בטעינת הדירה',
    'apt.fact.floor': 'קומה',
    'apt.fact.rooms': 'חדרים',
    'apt.fact.area': 'מ״ר',
    'apt.fact.outdoor': 'מ״ר מרפסת',
    'apt.fact.type': 'טיפוס',
    'apt.fact.price': 'מחיר',
    'apt.fact.status': 'סטטוס',
    'apt.fact.developer': 'יזם',
    'apt.map.label': 'מפת הדירה: איפה אתם עכשיו ולאן אתם מסתכלים',
  },
  en: {
    'apt.back': 'Back to the building',
    'apt.title': 'Apartment {unit}',
    'apt.tab.tour': '360° tour',
    'apt.tab.plan': 'Plan',
    'apt.tab.photos': 'Photos',
    'apt.tab.3d': '3D',
    'apt.tab.about': 'About',
    'apt.tour.open': 'Open full screen',
    'apt.tour.none': 'The apartment tour is not published yet.',
    'apt.plan.note': 'Per the sales plan dated {date}',
    'apt.plan.none': 'The apartment plan is not ready yet.',
    'apt.photos.none': 'No photos for this apartment yet.',
    'apt.3d.hint': 'Tap a room to see its area and enter it in 360°. Drag to orbit, pinch or wheel to zoom.',
    'apt.3d.back': 'Back to 3D',
    'apt.3d.placeholder': 'Temporary model: a clay massing of the walls from the plan. The full dollhouse replaces it automatically.',
    'apt.3d.none': 'The 3D model is not ready yet.',
    'apt.about.title': 'About the apartment and the visualization',
    'apt.about.legal': 'Full legal notice',
    'apt.about.generated': 'Produced {date} · version {version}',
    'apt.about.status': 'Notice status: {status}',
    'apt.legal.full': 'Full legal notice',
    'apt.agent.team': 'Sales team',
    'apt.agent.role': 'Sales advice · {project}',
    'apt.agent.call': 'Call',
    'apt.agent.email': 'Email',
    'apt.zip': 'Download the apartment pack (ZIP)',
    'apt.zip.building': 'Preparing the ZIP…',
    'apt.wa.text': 'Hi, I am interested in apartment {unit} (floor {floor}) in {project}. Please send me details.',
    'apt.notBuilt': 'The apartment pack is not built yet (tools/build_zip.mjs); showing the basic facts only.',
    'apt.err': 'Could not load the apartment',
    'apt.fact.floor': 'Floor',
    'apt.fact.rooms': 'Rooms',
    'apt.fact.area': 'm²',
    'apt.fact.outdoor': 'm² outdoor',
    'apt.fact.type': 'Type',
    'apt.fact.price': 'Price',
    'apt.fact.status': 'Status',
    'apt.fact.developer': 'Developer',
    'apt.map.label': 'Apartment map: where you are and where you look',
  },
};
// extend the shared string table (i18n.js stays untouched; t() reads STR live)
Object.assign(STR.he, APT_STR.he);
Object.assign(STR.en, APT_STR.en);

// ---------- pure helpers (also used by the builder and the test) ----------

// the project level. project.json exterior.mode = external: exterior.url + exterior.params + project (the same link
// index.html builds; today habait-16's continuous tour on :8848), landing on the tour's hold node (`room=<hold>`, the
// building with every apartment clickable) instead of replaying the orbit. Legacy `exterior.tour` (the :8899 flyover)
// still gets tour + return. Otherwise the internal flight at the facade.
// the page's own URL as the base for relative links (node tests have no location: a neutral local base)
const pageBase = () => (typeof location !== 'undefined' && location.href ? location.href : 'http://127.0.0.1/');

export function backToBuildingUrl(project, { platformRoot, override, hold } = {}) {
  if (override) return override;
  // no film (project.json film:false): "back to the building" is the project's landing page, not flow.html's empty hold-facade
  if (project.film === false) return new URL(`landing.html?project=${encodeURIComponent(project.id)}`, platformRoot || pageBase()).toString();
  const ext = project.exterior;
  if (ext && ext.mode === 'external' && ext.url) {
    // a relative exterior.url (stage_flow rewrites :8899 to /hold) resolves against the page; it used to throw and empty every tab
    const u = new URL(ext.url, pageBase());
    for (const [k, v] of Object.entries(ext.params || {})) u.searchParams.set(k, v);
    if (ext.tour) {
      u.searchParams.set('tour', ext.tour);
      if (platformRoot) u.searchParams.set('return', platformRoot);
    }
    u.searchParams.set('project', project.id);
    if (hold && !ext.tour) u.searchParams.set('room', hold);
    return u.toString();
  }
  return new URL(`flow.html?project=${encodeURIComponent(project.id)}&seg=hold-facade`, platformRoot || 'http://127.0.0.1:8850/').toString();
}

// the apartment tour, apartment scope only (its own strip, "back to the building" -> back)
export function apartmentTourUrl(base, { sid, back, lang, room } = {}) {
  if (!base) return null;
  const u = new URL(base, pageBase());
  u.searchParams.set('scope', 'apartment');
  u.searchParams.set('from', 'apartment');
  if (back) u.searchParams.set('return', back);
  if (sid) u.searchParams.set('sid', sid);
  if (lang) u.searchParams.set('lang', lang);
  if (room) u.searchParams.set('room', room); // board apartment-3d card 04: a room tapped in the 3D tab
  return u.toString();
}

export function apartmentWhatsApp({ number, project, projectName, unit, floor, session, lang }) {
  const msg = (STR[lang] || STR.he)['apt.wa.text'].replace('{unit}', unit).replace('{floor}', floor ?? '-').replace('{project}', projectName || project);
  return buildWhatsAppLink({ number, project, unit, session, message: msg });
}

export function phoneHref(num) {
  const d = String(num || '').replace(/\D/g, '');
  return d ? `tel:+${d}` : null;
}

// ---------- the page ----------
const isBrowser = typeof document !== 'undefined';
if (isBrowser && document.body?.classList.contains('page-apartment')) main().catch((e) => {
  console.error(e);
  const h = document.getElementById('aptTitle');
  if (h) h.textContent = `${t('apt.err')}: ${e.message}`;
});

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

// the built manifest, or a minimal one from the live project files
async function loadManifest(params) {
  const cfg = window.__HABAIT_APT;
  if (cfg && cfg.manifest) {
    const url = new URL(cfg.manifest, location.href);
    return { m: await getJSON(url), base: new URL('.', url), mode: 'dist' };
  }
  const project = params.get('project');
  const unit = params.get('unit');
  if (!project || !unit) throw new Error('missing ?project=&unit=');
  const url = new URL(`_local/dist/${encodeURIComponent(project)}/${encodeURIComponent(unit)}/apartment.json`, location.href);
  try {
    return { m: await getJSON(url), base: new URL('.', url), mode: 'live' };
  } catch {
    const { loadProject } = await import('./config.js');
    const p = await loadProject(project);
    const u = p.unitById.get(unit);
    if (!u) throw new Error(`unknown unit "${unit}"`);
    const disc = p.meta.disclaimer || {};
    return {
      mode: 'fallback',
      base: new URL(`${p.dir}/`, location.href),
      m: {
        schema: 'habait.apartment-page.v0',
        project: { ...p.meta, id: project, currency: p.units.currency },
        unit: { ...u, currency: p.units.currency },
        tour: { url: u.tour_url || null },
        plan: null, panos: [], stills: [], glb: null, zip: null,
        legal: { short: disc, full: disc, status: 'fallback: project.json disclaimer' },
      },
    };
  }
}

async function main() {
  const params = new URLSearchParams(location.search);
  // the hand-off from the flight/flyover carries its session; keep it so the WhatsApp tag ties the two layers together
  const sid = params.get('sid');
  if (sid && /^[\w-]{6,80}$/.test(sid)) { try { sessionStorage.setItem('habait.session', sid); } catch { /* private mode */ } }
  setLang(getLang());

  const { m, base, mode } = await loadManifest(params);
  const P = m.project;
  const U = m.unit;
  const asset = (p) => (p ? new URL(p, base).toString() : null);
  const platformRoot = mode === 'dist' ? null : new URL('.', location.href).toString();
  const back = params.get('return') || (mode === 'dist' && m.back?.url) || backToBuildingUrl(P, { platformRoot, hold: m.tour?.hold });

  // card 24: project.json "analytics" (PostHog key, whatsapp_viewed_line, lead_secret); absent/empty key = local only
  initAnalytics({ base: { project: P.id, unit: U.id, page: 'apartment', mode }, config: P.analytics || {} });

  // white-label
  const b = P.brand || {};
  const root = document.documentElement;
  if (b.primary) root.style.setProperty('--primary', b.primary);
  if (b.accent) root.style.setProperty('--accent', b.accent);
  if (b.background) { root.style.setProperty('--bg', b.background); document.querySelector('meta[name=theme-color]')?.setAttribute('content', b.background); }
  const logo = document.getElementById('brandLogo');
  if (b.logo) { logo.src = asset(b.logo); logo.hidden = false; }
  document.getElementById('brand').href = back;
  document.getElementById('backBtn').href = back;
  document.getElementById('aptNotBuilt').hidden = mode !== 'fallback';

  const state = { tab: null, opened: new Set(), stillIdx: 0, waHref: null, m, mode, back };
  window.__apt = state;

  const $ = (id) => document.getElementById(id);
  const legalShort = () => pick(m.legal?.short);
  const legalFull = () => pick(m.legal?.full);
  const lang = () => getLang();
  const unitFacts = () => [
    ['apt.fact.floor', U.floor], ['apt.fact.rooms', U.rooms], ['apt.fact.area', U.area_m2], ['apt.fact.outdoor', U.outdoor_m2],
  ].filter(([, v]) => v !== undefined && v !== null);

  function renderLegal(el, text) {
    el.innerHTML = '';
    for (const para of String(text || '').split(/\n+/)) {
      if (!para.trim()) continue;
      const p = document.createElement('p');
      p.textContent = para.trim();
      el.appendChild(p);
    }
  }

  function renderStatic() {
    applyI18n(document);
    $('langToggle').textContent = lang() === 'he' ? 'EN' : 'עב';
    const pname = pick(P.name);
    document.title = `${t('apt.title', { unit: U.id })} · ${pname}`;
    $('brandName').textContent = pname;
    // platform-ui-ux card 16: title + summary with every number in <bdi>
    const withBdi = (node, text, value) => { const [pre, post] = text.split('\u0000'); const b = document.createElement('bdi'); b.textContent = String(value); node.replaceChildren(pre, b, post ?? ''); };
    withBdi($('aptTitle'), t('apt.title', { unit: '\u0000' }), U.id);
    const sum = $('aptSummary'); sum.replaceChildren();
    for (const [k, v, unit] of [['apt.fact.rooms', U.rooms], ['apt.fact.area', U.area_m2, true], ['apt.fact.floor', U.floor]]) {
      if (v === undefined || v === null) continue;
      if (sum.childNodes.length) sum.append(' · ');
      const b = document.createElement('bdi'); b.textContent = String(v);
      if (k === 'apt.fact.floor') sum.append(`${t(k)} `, b); else sum.append(b, ` ${t(k)}`);
    }
    $('aptProject').textContent = [pname, pick(P.tagline)].filter(Boolean).join(' · ');
    $('aptPrice').textContent = formatPrice(U.price, U.currency || P.currency || 'ILS');
    const st = $('aptStatus');
    const CHIP = { 'for-sale': 'hb-chip--available', reserved: 'hb-chip--reserved', sold: 'hb-chip--sold' };
    if (U.status) { st.hidden = false; st.className = `hb-chip ${CHIP[U.status] || ''}`; st.textContent = t(`status.${U.status}`); }
    // development badge: only on the laptop or with ?dev=1, the same rule as index.html (board apartment-3d card 04)
    const DEV = params.get('dev') === '1' || ['127.0.0.1', 'localhost'].includes(location.hostname);
    $('aptFixture').hidden = !(P.fixture && DEV);
    // the spec grid (components.css .hb-spec): label + value, numbers in <bdi>
    $('aptFacts').replaceChildren(...[...unitFacts().filter(([k]) => !['apt.fact.rooms', 'apt.fact.area', 'apt.fact.floor'].includes(k)), ...(U.type ? [['apt.fact.type', U.type]] : [])].map(([k, v]) => { const d = document.createElement('div'); const dt = document.createElement('dt'); dt.textContent = t(k); const dd = document.createElement('dd'); const b = document.createElement('bdi'); b.textContent = String(v); dd.append(b); d.append(dt, dd); return d; }));

    for (const el of document.querySelectorAll('.legal-short')) el.textContent = legalShort();
    $('footShort').textContent = legalShort();
    renderLegal($('footLegal'), legalFull());
    renderLegal($('aboutLegal'), legalFull());

    // plan
    $('planNone').hidden = !!m.plan;
    $('planLink').hidden = !m.plan;
    if (m.plan) {
      $('planLink').href = asset(m.plan.src);
      $('planImg').alt = `${t('apt.tab.plan')} · ${U.id}`;
      $('planNote').textContent = m.plan.date ? t('apt.plan.note', { date: m.plan.date }) + (m.plan.architect ? ` · ${m.plan.architect}` : '') : '';
    }
    // photos
    const grid = $('photoGrid');
    grid.innerHTML = '';
    (m.stills || []).forEach((s, i) => {
      const fig = document.createElement('figure');
      fig.className = 'apt-photo';
      // platform-ui-ux Phase 4 A4: every AI still carries the disclosure badge (root CLAUDE.md §6)
      fig.innerHTML = `<button type="button" data-i="${i}"><img loading="lazy" decoding="async" alt=""><span class="hb-ai-badge">הדמיה · <bdi>AI-generated</bdi></span></button><figcaption></figcaption>`;
      fig.querySelector('img').src = asset(s.src);
      fig.querySelector('img').alt = pick(s.name);
      fig.querySelector('figcaption').textContent = pick(s.name);
      fig.querySelector('button').addEventListener('click', () => openLightbox(i));
      grid.appendChild(fig);
    });
    $('photosNone').hidden = (m.stills || []).length > 0;
    // 3D
    $('dollNone').hidden = !!m.glb?.html;
    $('dollNote').textContent = m.glb ? (m.glb.placeholder ? `${t('apt.3d.placeholder')} ` : '') + t('apt.3d.hint') : '';
    // tour
    $('tourNone').hidden = !!m.tour?.url;
    // about
    $('aboutTagline').textContent = [pname, pick(P.tagline)].filter(Boolean).join(' · ');
    const rows = [
      ...unitFacts(),
      ['apt.fact.type', U.type],
      ['apt.fact.price', formatPrice(U.price, U.currency || 'ILS')],
      ['apt.fact.status', U.status ? t(`status.${U.status}`) : null],
      ['apt.fact.developer', pick(P.developer)],
    ].filter(([, v]) => v !== undefined && v !== null && v !== '');
    $('aboutFacts').innerHTML = '';
    for (const [k, v] of rows) {
      const dt = document.createElement('dt'); dt.textContent = t(k);
      const dd = document.createElement('dd'); dd.textContent = v;
      $('aboutFacts').append(dt, dd);
    }
    const meta = [];
    if (m.generated) meta.push(t('apt.about.generated', { date: m.generated.slice(0, 10), version: m.version || '-' }));
    if (m.legal?.status) meta.push(t('apt.about.status', { status: m.legal.status }));
    $('aboutMeta').textContent = meta.join(' · ');
    // agent + leads
    renderAgent();
    // zip
    $('zipSize').textContent = m.zip?.bytes ? `${(m.zip.bytes / 1048576).toFixed(1)} MB` : '';
  }

  function renderAgent() {
    const leads = P.leads || {};
    const agent = leads.agent || {};
    const name = pick(agent.name) || t('apt.agent.team');
    $('agentName').textContent = name;
    $('agentRole').textContent = pick(agent.role) || t('apt.agent.role', { project: pick(P.name) });
    $('agentAvatar').textContent = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
    const phone = agent.phone || leads.phone || leads.whatsapp_number;
    const tel = phoneHref(phone);
    for (const id of ['callBtn', 'callBtn2']) { $(id).hidden = !tel; if (tel) $(id).href = tel; }
    const email = agent.email || leads.email;
    $('mailBtn').hidden = !email;
    if (email) $('mailBtn').href = `mailto:${email}?subject=${encodeURIComponent(`${pick(P.name)} | ${U.id}`)}`;
    const wa = apartmentWhatsApp({
      number: agent.whatsapp || leads.whatsapp_number, project: P.id, projectName: pick(P.name),
      unit: U.id, floor: U.floor, session: sessionId(), lang: lang(),
    });
    // F20 (Eliran 2026-11-04, "להסתיר"): an empty number hides the WhatsApp buttons, as the call buttons above
    const hasWa = LEADS_ON && /\d/.test(String(agent.whatsapp || leads.whatsapp_number || '')); // Eliran 2026-11-04: no WhatsApp
    state.waHref = hasWa ? wa : null;
    for (const id of ['waBtn', 'waBtn2']) { $(id).hidden = !hasWa; if (hasWa) $(id).href = wa; }
  }

  function showTab(tab, { from = 'click' } = {}) {
    if (!TABS.includes(tab)) tab = 'tour';
    state.tab = tab;
    for (const btn of document.querySelectorAll('[role=tab]')) {
      const on = btn.dataset.tab === tab;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
      if (on && btn.parentElement.scrollWidth > btn.parentElement.clientWidth) btn.scrollIntoView({ inline: 'nearest', block: 'nearest' });   // platform-ui-ux F11
    }
    for (const k of TABS) $(`panel-${k}`).hidden = k !== tab;
    if (!state.opened.has(tab)) {
      state.opened.add(tab);
      // heavy content loads on first open only (phones)
      if (tab === 'tour' && m.tour?.url) {
        const url = apartmentTourUrl(m.tour.url, { sid: sessionId(), back, lang: lang(), room: state.pendingRoom || null });
        state.pendingRoom = null;
        $('tourFrame').src = url;
        $('tourOpen').href = url;
        mountMap();
      }
      if (tab === 'plan' && m.plan) $('planImg').src = asset(m.plan.src);
      if (tab === '3d' && m.glb?.html) ensureDoll({ defer: false });
    }
    if (tab === '3d') postDoll({ type: 'habait:3d-show' });
    if (!m.tour?.url) $('tourFrame').parentElement.hidden = $('tourOpen').parentElement.hidden = true;
    if (!m.glb?.html) $('dollFrame').parentElement.hidden = true;
    if (from !== 'init') {
      // the hash records the tab; a ?tab= deep link is consumed so it cannot override the buyer's later choice
      const u = new URL(location.href); u.searchParams.delete('tab'); u.hash = tab;
      history.replaceState(null, '', u);
    }
    // phones: bring the opened panel up under the sticky tab strip (deep link or tap)
    if ((from !== 'init' || state.deepLink) && window.matchMedia('(max-width: 899px)').matches) {
      requestAnimationFrame(() => $(`panel-${tab}`).scrollIntoView({ block: 'start', behavior: from === 'init' ? 'auto' : 'smooth' }));
    }
    capture('room_view', { unit: U.id, tab, from });
    capture('apartment_tab', { unit: U.id, tab, from }); // card 24: the D2 name (room_view{tab} kept for older dashboards)
  }

  // ---- card 10: the minimap over the tour, the 3D tab preloaded while the buyer is in the tour, the tour's floor -> 3D ----
  state.floor = params.get('floor') || m.glb?.default_floor || null;
  state.map = null;
  function dollUrl({ defer }) {
    const h = new URLSearchParams({ lang: lang() });
    if (state.floor) h.set('floor', state.floor);
    if (defer) h.set('defer', '1');
    return `${asset(m.glb.html)}#${h}`;
  }
  function ensureDoll({ defer }) {
    const f = $('dollFrame');
    if (f.getAttribute('src')) return false;
    f.src = dollUrl({ defer });
    state.doll = { defer };
    return true;
  }
  function postDoll(msg) {
    const f = $('dollFrame');
    if (f.getAttribute('src') && f.contentWindow) f.contentWindow.postMessage(msg, '*');
  }
  // lazy init: nothing 3D on first paint; once the page is idle (and the buyer did not ask to save data) the hidden 3D tab
  // decodes its GLB + Draco, so opening it later only creates the WebGL view
  function preload3d() {
    if (!m.glb?.html || state.opened.has('3d') || navigator.connection?.saveData) return;
    ensureDoll({ defer: true });
  }
  // the 3D document says it listens: resend what it may have missed while it was parsing
  window.addEventListener('message', (e) => {
    if (e.source !== $('dollFrame').contentWindow || !e.data || e.data.type !== 'habait:3d-ready') return;
    if (state.floor) postDoll({ type: 'habait:floor', floor: state.floor });
    if (state.tab === '3d') postDoll({ type: 'habait:3d-show' });
  });
  // ---- board apartment-3d card 04: a room tapped in 3D opens the tour at that room; "back to 3D" returns ----
  state.lastScene = null;
  window.addEventListener('message', (e) => {
    if (e.source === $('tourFrame').contentWindow && e.data && e.data.type === 'habait:view' && typeof e.data.scene === 'string') state.lastScene = e.data.scene;
  });
  window.addEventListener('message', (e) => {
    if (e.source !== $('dollFrame').contentWindow || !e.data || e.data.type !== 'habait:enter-room' || typeof e.data.scene !== 'string') return;
    enterRoom(e.data.scene);
  });
  function enterRoom(scene) {
    capture('room_view', { unit: U.id, tab: 'tour', scene, from: '3d' });
    $('backTo3dRow').hidden = false;
    if (!m.tour?.url) return;
    if (!state.opened.has('tour')) { state.pendingRoom = scene; showTab('tour', { from: '3d' }); return; }
    showTab('tour', { from: '3d' });
    const frame = $('tourFrame');
    let origin = '*';
    try { origin = new URL(frame.src).origin; } catch { /* keep * */ }
    frame.contentWindow?.postMessage({ type: 'habait:goto', scene }, origin);
    // the tour ignores goto while a scene is still loading: if it has not arrived in 3 s, reload it at that room
    state.awaitScene = scene;
    setTimeout(() => {
      if (state.awaitScene !== scene || state.lastScene === scene) return;
      const url = apartmentTourUrl(m.tour.url, { sid: sessionId(), back, lang: lang(), room: scene });
      frame.src = url;
      $('tourOpen').href = url;
    }, 3000);
  }
  $('backTo3d').addEventListener('click', () => { state.awaitScene = null; showTab('3d', { from: 'back' }); });

  const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 600));
  const afterLoad = () => setTimeout(() => idle(preload3d), 1200);
  if (document.readyState === 'complete') afterLoad(); else window.addEventListener('load', afterLoad, { once: true });

  async function mountMap() {
    if (state.map || !m.minimap || !m.tour?.url) return;
    const frame = $('tourFrame');
    // the tour may speak before the lazy module is in: keep its last view message and replay it
    let early = null;
    const keep = (e) => { if (e.source === frame.contentWindow && e.data && e.data.type === 'habait:view') early = e.data; };
    window.addEventListener('message', keep);
    const mm = await import('./minimap.js');
    window.removeEventListener('message', keep);
    const data = { ...m.minimap, img: asset(m.minimap.img) };
    let tourOrigin = '*';
    try { tourOrigin = new URL(frame.src).origin; } catch { /* keep * */ }
    const map = mm.mountMinimap(frame.parentElement, data, {
      label: t('apt.map.label'), pick,
      onGoto: (scene) => frame.contentWindow?.postMessage({ type: mm.GOTO_MSG, scene }, tourOrigin),
    });
    state.map = map;
    let last = { scene: null, t: 0 };
    const onView = (v) => {
      map.update(v);
      if (v.scene !== last.scene) {
        const now = performance.now();
        capture('room_view', { unit: U.id, tab: 'tour', scene: v.scene, prev: last.scene, dwell_ms: last.scene ? Math.round(now - last.t) : null });
        last = { scene: v.scene, t: now };
      }
      if (v.floor && v.floor !== state.floor) {
        if (state.floor) floorSwitch({ unit: U.id, finish: v.floor, prev: state.floor }); // card 24 (the tour's floor finish)
        state.floor = v.floor;
        postDoll({ type: 'habait:floor', floor: v.floor });
      }
    };
    mm.listenTourView(frame, onView);
    const ev = mm.parseViewMessage(early);
    if (ev) onView(ev);
    // ask the tour for its current view (optional on the tour side; harmless if it does not answer)
    frame.contentWindow?.postMessage({ type: 'habait:view-request' }, tourOrigin);
  }

  // lightbox
  const lb = $('lightbox');
  function openLightbox(i) {
    const list = m.stills || [];
    if (!list.length) return;
    state.stillIdx = (i + list.length) % list.length;
    const s = list[state.stillIdx];
    $('lbImg').src = asset(s.src);
    $('lbImg').alt = pick(s.name);
    $('lbCap').textContent = pick(s.name);
    if (!lb.open) { if (lb.showModal) lb.showModal(); else lb.setAttribute('open', ''); }
  }
  $('lbClose').addEventListener('click', () => lb.close());
  $('lbPrev').addEventListener('click', () => openLightbox(state.stillIdx + (lang() === 'he' ? 1 : -1)));
  $('lbNext').addEventListener('click', () => openLightbox(state.stillIdx + (lang() === 'he' ? -1 : 1)));
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });

  // tabs: click + arrow keys (RTL-aware)
  const tabsEl = $('tabs');
  tabsEl.addEventListener('click', (e) => { const b = e.target.closest('[role=tab]'); if (b) showTab(b.dataset.tab); });
  tabsEl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const dir = (e.key === 'ArrowRight') === (root.dir === 'rtl') ? -1 : 1;
    const next = TABS[(TABS.indexOf(state.tab) + dir + TABS.length) % TABS.length];
    showTab(next);
    $(`tab-${next}`).focus();
  });

  // leads
  const lead = (channel) => () => capture('lead_click', { unit: U.id, channel, tab: state.tab });
  $('waBtn').addEventListener('click', lead('whatsapp'));
  $('waBtn2').addEventListener('click', lead('whatsapp'));
  $('callBtn').addEventListener('click', lead('phone'));
  $('callBtn2').addEventListener('click', lead('phone'));
  $('mailBtn').addEventListener('click', lead('email'));

  // ZIP: the prebuilt pack when it exists, else a small pack built here (facts + legal) with the vendored JSZip
  const zipBtn = $('zipBtn');
  if (m.zip?.src) {
    zipBtn.href = asset(m.zip.src);
    zipBtn.setAttribute('download', m.zip.name || `${U.id}.zip`);
  }
  const zipBtn2 = $('zipBtn2');
  if (zipBtn2) { if (m.zip?.src) { zipBtn2.href = zipBtn.href; zipBtn2.setAttribute('download', zipBtn.getAttribute('download')); }
    zipBtn2.addEventListener('click', (e) => { e.preventDefault(); zipBtn.click(); }); }
  zipBtn.addEventListener('click', async (e) => {
    capture('lead_click', { unit: U.id, channel: 'zip', tab: state.tab });
    capture('zip_download', { unit: U.id, tab: state.tab }); // card 24: the D2 name (lead_click{zip} kept for older dashboards)
    if (m.zip?.src) return;
    e.preventDefault();
    const label = zipBtn.querySelector('[data-i18n]');
    label.textContent = t('apt.zip.building');
    try {
      const { zipFiles, downloadBytes } = await import('./zip.js');
      const readme = [`${pick(P.name)} | ${t('apt.title', { unit: U.id })}`, '', ...unitFacts().map(([k, v]) => `${t(k)}: ${v}`), '', pick(m.legal?.full), ''].join('\r\n');
      const bytes = await zipFiles([
        { name: 'README-he-en.txt', data: readme },
        { name: 'unit.json', data: JSON.stringify(U, null, 2) },
      ]);
      downloadBytes(bytes, `${U.id}.zip`);
    } finally {
      label.textContent = t('apt.zip');
    }
  });

  $('langToggle').addEventListener('click', () => { setLang(lang() === 'he' ? 'en' : 'he'); renderStatic(); });

  renderStatic();
  capture('unit_enter', { unit: U.id, via: params.get('from') || 'apartment_page', mode });
  // first tab: a valid ?tab= deep link wins, then a valid #hash, then the tour (an unknown value never hides ?tab)
  const tabParam = params.get('tab');
  const hashTab = (location.hash || '').slice(1);
  state.deepLink = TABS.includes(tabParam) || TABS.includes(hashTab);
  const first = TABS.includes(tabParam) ? tabParam : TABS.includes(hashTab) ? hashTab : 'tour';
  showTab(first, { from: 'init' });
  state.ready = true;
}
